"""
Генерация документов из Google Docs шаблонов.
Логика повторяет AppScript createAllDocumentsFromAppSheet:
1. Находит реквизиты клиента и перевозчика в Mongo (или в листах при необходимости)
2. Копирует шаблон в указанную папку (с именем "Заявка №X - Клиент")
3. Заменяет плейсхолдеры {{ПолеИмя}} на значения
4. Возвращает URL созданного документа
"""
import os
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]

# ID шаблонов и папок (взяты из AppScript)
TEMPLATES = {
    "client": {
        "name": "Заявка клиенту",
        "template_id": "1R7Q99u_LFw080lQyL4hpBkAj1Q6an2pnUtkCdrqx-eY",
        "folder_id":   "1Vlc98uFl5QRLMpOUhrfig82qv6tVKDv3",
        "filename": lambda o: f"Заявка №{o.get('order_number', '')} - {o.get('client_name', '')}",
    },
    "carrier": {
        "name": "Договор-заявка перевозчику",
        "template_id": "1Us_NhuCvZ_vMsVSPcJRXPAf6ZkwXITna0MoaK2_OMBw",
        "folder_id":   "17U94rS1jEVUoNYPR2jNBf5cY38pzvyL7",
        "filename": lambda o: f"Договор-заявка №{o.get('order_number', '')} - {o.get('carrier_name', '')}",
    },
    "act": {
        "name": "Счет-Акт",
        "template_id": "1J8PtN8xaiAkbKgwbyyHGVOARQlEQhH7rqnxsWIsx4-I",
        "folder_id":   "1alXzA9GyhQ9JHCVrntl7_Cjw6sYUR8gk",
        "filename": lambda o: f"Счет-Акт №{o.get('order_number', '')} - {o.get('client_name', '')}",
    },
}


# ===== число прописью (как в AppScript) =====
_ED = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
_DESYAT = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
_OT11_19 = ['одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
_SOT = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']


def number_to_words(num: float) -> str:
    """Сумма прописью на русском, для белорусских рублей."""
    rub = int(num)
    kop = round((num - rub) * 100)
    text = ''
    tys = rub // 1000
    rub = rub % 1000
    if tys > 0:
        if tys == 1:
            text += 'одна тысяча '
        elif tys == 2:
            text += 'две тысячи '
        elif tys < 5:
            text += _ED[tys] + ' тысячи '
        else:
            text += _ED[tys] + ' тысяч '
    s = rub // 100
    d = (rub % 100) // 10
    e = rub % 10
    if s > 0:
        text += _SOT[s] + ' '
    if d == 1 and e > 0:
        text += _OT11_19[e - 1] + ' '
    else:
        if d > 1:
            text += _DESYAT[d] + ' '
        if e > 0 or (d == 0 and s == 0):
            text += _ED[e] + ' '
    text += 'белорусских рублей '
    text += (f'0{kop}' if kop < 10 else str(kop)) + ' копеек'
    return text.strip()


def _format_date(s: str) -> str:
    """ISO YYYY-MM-DD -> DD.MM.YYYY"""
    if not s:
        return '—'
    s = str(s)
    try:
        if 'T' in s:
            s = s.split('T')[0]
        if '-' in s and len(s) >= 10 and s[4] == '-':
            y, m, d = s[:4], s[5:7], s[8:10]
            return f"{d}.{m}.{y}"
    except Exception:
        pass
    return s


class DocsGenerator:
    def __init__(self):
        creds_path = os.environ.get("GOOGLE_CREDENTIALS_PATH", "google_credentials.json")
        self.creds_path = creds_path if os.path.isabs(creds_path) else str(ROOT_DIR / creds_path)
        self._drive = None
        self._docs = None
        self._user_creds_provider = None  # callable -> dict с access/refresh_token

    def set_user_credentials_provider(self, fn):
        """Установить функцию, возвращающую dict {access_token, refresh_token}.
        Если установлена — генерация будет идти от имени пользователя (его Drive, его квота).
        """
        self._user_creds_provider = fn
        # сбрасываем кеш сервисов, чтобы пересоздались
        self._drive = None
        self._docs = None

    def _services(self):
        if self._drive is None:
            if self._user_creds_provider is not None:
                from oauth_google import make_user_credentials
                token_doc = self._user_creds_provider()
                if not token_doc or not token_doc.get('refresh_token'):
                    raise RuntimeError(
                        "Сначала авторизуйтесь через Google: откройте /api/auth/google/start"
                    )
                creds = make_user_credentials(token_doc)
            else:
                creds = Credentials.from_service_account_file(self.creds_path, scopes=SCOPES)
            self._drive = build('drive', 'v3', credentials=creds, cache_discovery=False)
            self._docs = build('docs', 'v1', credentials=creds, cache_discovery=False)
        return self._drive, self._docs

    def _build_replacements(self, order: Dict[str, Any], client: Dict[str, Any], carrier: Dict[str, Any]) -> Dict[str, str]:
        """Все плейсхолдеры под русские теги в шаблонах."""
        price_cl = float(order.get('client_rate') or 0)
        price_car = float(order.get('carrier_rate') or 0)
        return {
            '{{НомерЗаявки}}': str(order.get('order_number', '')),
            '{{ДатаЗаявки}}': _format_date((order.get('created_at') or '')[:10]),
            '{{Компания}}': str(order.get('client_name', '')),
            '{{Перевозчик}}': str(order.get('carrier_name', '')),
            '{{Маршрут}}': f"{order.get('route_from', '')} - {order.get('route_to', '')}".strip(' -'),
            '{{ДатаЗагрузки}}': _format_date(order.get('load_date', '')),
            '{{ДатаВыгрузки}}': _format_date(order.get('unload_date', '')),
            '{{СтавкаКлиента}}': f"{price_cl:.2f}",
            '{{СтавкаПеревозчика}}': f"{price_car:.2f}",
            '{{СуммаПрописью}}': number_to_words(price_cl),

            '{{Водитель}}': str(order.get('driver_name', '') or '—'),
            '{{Груз}}': str(order.get('cargo', '') or '—'),
            '{{АдресЗагрузки}}': str(order.get('route_from_address', '') or '—'),
            '{{АдресВыгрузки}}': str(order.get('route_to_address', '') or '—'),
            '{{ДопИнфо}}': str(order.get('notes', '') or '—'),

            # Реквизиты клиента
            '{{УНПИНН}}':  str((client or {}).get('inn', '') or ''),
            '{{ЮрАдрес}}': str((client or {}).get('legal_address', '') or ''),
            '{{РС}}':      str((client or {}).get('bank_account', '') or ''),
            '{{Банк}}':    str((client or {}).get('bank_name', '') or ''),
            '{{БИК}}':     str((client or {}).get('bank_bik', '') or ''),

            # Реквизиты перевозчика
            '{{Директор}}':  _extract_director((carrier or {}).get('notes', '')),
            '{{Основание}}': _extract_osnovanie((carrier or {}).get('notes', '')),
            '{{ПерУНП}}':    str((carrier or {}).get('inn', '') or ''),
            '{{ПерАдрес}}':  str((carrier or {}).get('legal_address', '') or ''),
            '{{ПерРС}}':     str((carrier or {}).get('bank_account', '') or ''),
            '{{ПерБанк}}':   str((carrier or {}).get('bank_name', '') or ''),
            '{{ПерБИК}}':    str((carrier or {}).get('bank_bik', '') or ''),
        }

    def generate(
        self,
        kind: str,
        order: Dict[str, Any],
        client: Optional[Dict[str, Any]],
        carrier: Optional[Dict[str, Any]],
    ) -> str:
        cfg = TEMPLATES.get(kind)
        if not cfg:
            raise ValueError(f"Неизвестный тип документа: {kind}")

        drive, docs = self._services()
        filename = cfg['filename'](order)

        # 1. Копируем шаблон в нужную папку
        copied = drive.files().copy(
            fileId=cfg['template_id'],
            body={'name': filename, 'parents': [cfg['folder_id']]},
            supportsAllDrives=True,
        ).execute()
        new_id = copied['id']

        # 2. Подставляем все плейсхолдеры одним batchUpdate
        replacements = self._build_replacements(order, client, carrier)
        requests = [
            {
                'replaceAllText': {
                    'containsText': {'text': k, 'matchCase': True},
                    'replaceText': v,
                }
            }
            for k, v in replacements.items()
        ]
        if requests:
            docs.documents().batchUpdate(documentId=new_id, body={'requests': requests}).execute()

        # 3. Делаем файл доступным «по ссылке» (чтобы пользователь мог открыть)
        try:
            drive.permissions().create(
                fileId=new_id,
                body={'type': 'anyone', 'role': 'reader'},
                supportsAllDrives=True,
            ).execute()
        except Exception as e:
            logger.warning(f"[docs] could not set anyone permission: {e}")

        return f"https://docs.google.com/document/d/{new_id}/edit"


def _extract_director(notes: str) -> str:
    if not notes:
        return ''
    for chunk in notes.split('|'):
        c = chunk.strip()
        if c.lower().startswith('директор'):
            return c.split(':', 1)[1].strip() if ':' in c else c
    return ''


def _extract_osnovanie(notes: str) -> str:
    if not notes:
        return ''
    for chunk in notes.split('|'):
        c = chunk.strip()
        if c.lower().startswith('основание'):
            return c.split(':', 1)[1].strip() if ':' in c else c
    return ''


_instance: Optional[DocsGenerator] = None


def get_generator() -> DocsGenerator:
    global _instance
    if _instance is None:
        _instance = DocsGenerator()
    return _instance


def kind_to_field(kind: str) -> str:
    return {
        'client': 'doc_url_client',
        'carrier': 'doc_url_carrier',
        'act': 'doc_url_act',
    }[kind]
