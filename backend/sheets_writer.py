"""
БЕЗОПАСНАЯ запись в Google Sheets (двусторонняя синхронизация).
- НИКОГДА не очищает листы
- Находит существующую строку по ключу (номер заявки / название компании) и обновляет нужные ячейки
- Если строки нет — добавляет новую в конец таблицы

Структура листов сохраняется как у пользователя:
- "Заказы": заголовки в строке 4 (row=4), данные с строки 5
- "Клиенты": заголовки в строке 1, статистика-подзаголовки в строке 2, данные с строки 3
- "Перевозчики": заголовки в строке 1, данные с строки 2

ВНИМАНИЕ: индексы строк/колонок в gspread — 1-based.
"""
import os
import logging
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional
import re

import gspread
from google.oauth2.service_account import Credentials

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Где начинаются данные (1-based)
ORDERS_DATA_START_ROW = 5
CLIENTS_DATA_START_ROW = 3
CARRIERS_DATA_START_ROW = 2


def _date_dot(s: str) -> str:
    """ISO YYYY-MM-DD -> DD.MM.YYYY (как в листах пользователя)."""
    if not s:
        return ''
    s = str(s).split('T')[0]
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        return f"{m.group(3)}.{m.group(2)}.{m.group(1)}"
    return s


def _money(v) -> str:
    try:
        f = float(v or 0)
        return f"{f:.2f}".replace('.', ',')
    except Exception:
        return ''


def _status_label(s: str) -> str:
    return {
        'new': 'Новая',
        'in_progress': 'В работе',
        'delivered': 'Завершён',
        'cancelled': 'Отменён',
    }.get(s or '', s or '')


def _pay_label(b: bool) -> str:
    return 'Оплачено' if b else 'Не оплачено'


def _doc_label(b: bool) -> str:
    return '✔️ Выполнено' if b else ''


def _month_label(unload: str, load: str) -> str:
    s = unload or load or ''
    if not s:
        return ''
    s = s.split('T')[0]
    m = re.match(r'^\d{4}-(\d{2})', s)
    if not m:
        return ''
    months = {'01': 'Январь', '02': 'Февраль', '03': 'Март', '04': 'Апрель',
              '05': 'Май', '06': 'Июнь', '07': 'Июль', '08': 'Август',
              '09': 'Сентябрь', '10': 'Октябрь', '11': 'Ноябрь', '12': 'Декабрь'}
    return months.get(m.group(1), '')


# ===== Order -> ячейки в "Заказы" =====
# Маппинг: индекс колонки (1-based) -> значение
def order_cells(o: Dict[str, Any]) -> Dict[int, Any]:
    return {
        2:  _date_dot((o.get('created_at') or '')[:10]),
        3:  o.get('client_name', ''),
        4:  o.get('carrier_name', ''),
        5:  f"{o.get('route_from', '')}-{o.get('route_to', '')}".strip('-'),
        6:  _date_dot(o.get('load_date', '')),
        7:  _date_dot(o.get('unload_date', '')),
        8:  _money(o.get('client_rate')),
        9:  _money(o.get('carrier_rate')),
        10: _status_label(o.get('status', '')),
        11: _pay_label(o.get('client_paid', False)),
        12: _pay_label(o.get('carrier_paid', False)),
        13: _month_label(o.get('unload_date', ''), o.get('load_date', '')),
        17: _doc_label(o.get('docs_from_carrier_received', False)),
        18: _doc_label(o.get('docs_to_carrier_sent', False)),
        19: _doc_label(o.get('docs_to_client_sent', False)),
        20: _doc_label(o.get('docs_from_client_received', False)),
        # Документы — кликабельные ссылки (35,36,37 = AI, AJ, AK)
        35: o.get('doc_url_client', '') or '',
        36: o.get('doc_url_carrier', '') or '',
        37: o.get('doc_url_act', '') or '',
        47: o.get('driver_name', ''),
        48: o.get('cargo', ''),
        49: o.get('route_from_address', ''),
        50: o.get('route_to_address', ''),
        51: o.get('notes', ''),
    }


def client_cells(c: Dict[str, Any]) -> Dict[int, Any]:
    return {
        1:  c.get('name', ''),
        2:  c.get('contact_person', ''),
        3:  c.get('phone', ''),
        4:  c.get('email', ''),
        5:  c.get('legal_address', ''),
        6:  c.get('cargo_types', ''),
        7:  c.get('inn', ''),
        9:  c.get('bank_account', ''),
        10: c.get('bank_name', ''),
        11: c.get('bank_bik', ''),
    }


def carrier_cells(cr: Dict[str, Any]) -> Dict[int, Any]:
    return {
        1:  cr.get('company_name', ''),
        2:  cr.get('driver_name', ''),
        3:  cr.get('vehicle_type', ''),
        4:  cr.get('capacity_tons', '') or '',
        5:  cr.get('legal_address', ''),
        6:  cr.get('plate', ''),
        7:  cr.get('inn', ''),
        9:  cr.get('bank_account', ''),
        10: cr.get('bank_name', ''),
        11: cr.get('bank_bik', ''),
    }


class SheetsWriter:
    def __init__(self):
        self.sheet_id = os.environ.get("GOOGLE_SHEET_ID")
        creds_path = os.environ.get("GOOGLE_CREDENTIALS_PATH", "google_credentials.json")
        from load_credentials import get_credentials_path; self.creds_path = get_credentials_path()
        self._client = None
        self._ss = None

    def _connect(self):
        if self._ss is None:
            creds = Credentials.from_service_account_file(self.creds_path, scopes=SCOPES)
            self._client = gspread.authorize(creds)
            self._ss = self._client.open_by_key(self.sheet_id)
        return self._ss

    def _find_row_by_key(self, ws, key: str, key_col: int = 1, start_row: int = 1) -> Optional[int]:
        """Ищет строку, у которой в колонке key_col значение == key. Возвращает 1-based индекс или None."""
        if not key:
            return None
        col_vals = ws.col_values(key_col)
        for i, v in enumerate(col_vals, start=1):
            if i < start_row:
                continue
            if str(v).strip() == str(key).strip():
                return i
        return None

    def _last_row_with_data(self, ws, key_col: int = 1) -> int:
        col_vals = ws.col_values(key_col)
        # ищем последний непустой
        for i in range(len(col_vals), 0, -1):
            if str(col_vals[i - 1]).strip():
                return i
        return 0

    def _upsert(self, sheet_name: str, key: str, cells: Dict[int, Any], data_start_row: int) -> str:
        ss = self._connect()
        ws = ss.worksheet(sheet_name)
        row = self._find_row_by_key(ws, key, key_col=1, start_row=data_start_row)
        if row is None:
            # добавляем новую строку в конец
            last = max(self._last_row_with_data(ws), data_start_row - 1)
            row = last + 1

        # batch update только нужных ячеек (НЕ трогаем остальные!)
        updates = []
        for col, val in cells.items():
            if val is None:
                continue
            # gspread cell address e.g. "C5"
            addr = gspread.utils.rowcol_to_a1(row, col)
            updates.append({'range': addr, 'values': [[str(val)]]})
        if updates:
            ws.batch_update(updates, value_input_option='USER_ENTERED')
        return f"row {row}"

    def upsert_order(self, order: Dict[str, Any]) -> str:
        return self._upsert('Заказы', order.get('order_number', ''), order_cells(order), ORDERS_DATA_START_ROW)

    def upsert_client(self, client: Dict[str, Any]) -> str:
        return self._upsert('Клиенты', client.get('name', ''), client_cells(client), CLIENTS_DATA_START_ROW)

    def upsert_carrier(self, carrier: Dict[str, Any]) -> str:
        return self._upsert('Перевозчики', carrier.get('company_name', ''), carrier_cells(carrier), CARRIERS_DATA_START_ROW)

    def delete_order_row(self, order_number: str) -> bool:
        """Удалить строку из 'Заказы' по номеру заявки. Возвращает True если строка найдена и удалена."""
        ss = self._connect()
        ws = ss.worksheet('Заказы')
        row = self._find_row_by_key(ws, order_number, 1, ORDERS_DATA_START_ROW)
        if row is None:
            return False
        ws.delete_rows(row)
        return True


_writer: Optional[SheetsWriter] = None


def get_writer() -> SheetsWriter:
    global _writer
    if _writer is None:
        _writer = SheetsWriter()
    return _writer


# ===== Async wrappers =====
async def push_order(order: Dict[str, Any]) -> str:
    try:
        return await asyncio.to_thread(get_writer().upsert_order, order)
    except Exception as e:
        logger.error(f"[sheets push order] {e}", exc_info=True)
        return f"error: {e}"


async def push_client(client: Dict[str, Any]) -> str:
    try:
        return await asyncio.to_thread(get_writer().upsert_client, client)
    except Exception as e:
        logger.error(f"[sheets push client] {e}", exc_info=True)
        return f"error: {e}"


async def push_carrier(carrier: Dict[str, Any]) -> str:
    try:
        return await asyncio.to_thread(get_writer().upsert_carrier, carrier)
    except Exception as e:
        logger.error(f"[sheets push carrier] {e}", exc_info=True)
        return f"error: {e}"


async def delete_order(order_number: str) -> bool:
    try:
        return await asyncio.to_thread(get_writer().delete_order_row, order_number)
    except Exception as e:
        logger.error(f"[sheets delete order] {e}", exc_info=True)
        return False
