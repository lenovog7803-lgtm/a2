"""
Google Sheets sync module for CRM.
- Один лист на сущность: Заказы / Клиенты / Перевозчики
- Полная замена содержимого листа при синхронизации (одностороннее: CRM -> Sheets)
- Безопасно к ошибкам: ошибки логируются, но не валят основной API
"""
import os
import re
import logging
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional

import gspread
from google.oauth2.service_account import Credentials

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Заголовки колонок (русские)
ORDER_HEADERS = [
    "№ Заявки", "Дата создания", "Клиент", "Перевозчик",
    "Откуда", "Адрес погрузки", "Куда", "Адрес выгрузки",
    "Дата погрузки", "Дата выгрузки",
    "Водитель", "Телефон водителя", "ТС", "Гос.номер",
    "Груз", "Вес, т",
    "Ставка клиента", "Ставка перевозчика", "Маржа",
    "Статус", "Оплата от клиента", "Оплата перевозчику",
    "Док-ты клиенту", "Док-ты от клиента",
    "Док-ты перевозчику", "Док-ты от перевозчика",
    "Примечания",
]

CLIENT_HEADERS = [
    "Название", "Контактное лицо", "Телефон", "Email",
    "ИНН", "КПП", "Юр. адрес",
    "Банк", "Расч. счёт", "БИК", "Корр. счёт",
    "Условия оплаты", "Виды грузов", "Направления",
    "Примечания", "Создан",
]

CARRIER_HEADERS = [
    "Компания", "Водитель", "Телефон", "Email",
    "ИНН", "КПП", "Юр. адрес",
    "Банк", "Расч. счёт", "БИК", "Корр. счёт",
    "Тип ТС", "Гос.номер", "Грузоподъёмность, т", "Объём, м³",
    "Виды грузов", "Регионы", "Рейтинг",
    "Примечания", "Создан",
]


def _bool(v) -> str:
    return "Да" if v else "Нет"


def _money(v) -> str:
    try:
        return f"{float(v or 0):.0f}"
    except Exception:
        return "0"


def _status_label(s: str) -> str:
    return {
        "new": "Новая",
        "in_progress": "В работе",
        "delivered": "Доставлено",
        "cancelled": "Отменено",
    }.get(s or "", s or "")


def order_row(o: Dict[str, Any]) -> List[str]:
    revenue = float(o.get("client_rate") or 0)
    cost = float(o.get("carrier_rate") or 0)
    margin = revenue - cost
    return [
        str(o.get("order_number", "")),
        str(o.get("created_at", ""))[:10],
        str(o.get("client_name", "")),
        str(o.get("carrier_name", "")),
        str(o.get("route_from", "")),
        str(o.get("route_from_address", "")),
        str(o.get("route_to", "")),
        str(o.get("route_to_address", "")),
        str(o.get("load_date", "")),
        str(o.get("unload_date", "")),
        str(o.get("driver_name", "")),
        str(o.get("driver_phone", "")),
        str(o.get("vehicle_type", "")),
        str(o.get("vehicle_plate", "")),
        str(o.get("cargo", "")),
        _money(o.get("weight_tons")),
        _money(revenue),
        _money(cost),
        _money(margin),
        _status_label(o.get("status", "")),
        _bool(o.get("client_paid")),
        _bool(o.get("carrier_paid")),
        _bool(o.get("docs_to_client_sent")),
        _bool(o.get("docs_from_client_received")),
        _bool(o.get("docs_to_carrier_sent")),
        _bool(o.get("docs_from_carrier_received")),
        str(o.get("notes", "")),
    ]


def client_row(c: Dict[str, Any]) -> List[str]:
    return [
        str(c.get("name", "")),
        str(c.get("contact_person", "")),
        str(c.get("phone", "")),
        str(c.get("email", "")),
        str(c.get("inn", "")),
        str(c.get("kpp", "")),
        str(c.get("legal_address", "")),
        str(c.get("bank_name", "")),
        str(c.get("bank_account", "")),
        str(c.get("bank_bik", "")),
        str(c.get("bank_corr_account", "")),
        str(c.get("payment_terms", "")),
        str(c.get("cargo_types", "")),
        str(c.get("directions", "")),
        str(c.get("notes", "")),
        str(c.get("created_at", ""))[:10],
    ]


def carrier_row(c: Dict[str, Any]) -> List[str]:
    return [
        str(c.get("company_name", "")),
        str(c.get("driver_name", "")),
        str(c.get("phone", "")),
        str(c.get("email", "")),
        str(c.get("inn", "")),
        str(c.get("kpp", "")),
        str(c.get("legal_address", "")),
        str(c.get("bank_name", "")),
        str(c.get("bank_account", "")),
        str(c.get("bank_bik", "")),
        str(c.get("bank_corr_account", "")),
        str(c.get("vehicle_type", "")),
        str(c.get("plate", "")),
        _money(c.get("capacity_tons")),
        _money(c.get("capacity_m3")),
        str(c.get("cargo_types", "")),
        str(c.get("regions", "")),
        str(c.get("rating", "")),
        str(c.get("notes", "")),
        str(c.get("created_at", ""))[:10],
    ]


class SheetsSync:
    def __init__(self):
        self.sheet_id: Optional[str] = os.environ.get("GOOGLE_SHEET_ID")
        creds_path = os.environ.get("GOOGLE_CREDENTIALS_PATH", "google_credentials.json")
        self.creds_path = creds_path if os.path.isabs(creds_path) else str(ROOT_DIR / creds_path)
        self._client: Optional[gspread.Client] = None
        self._spreadsheet = None
        self.last_status: Dict[str, Any] = {"ok": False, "message": "Не запускалась", "synced": {}}

    def _connect(self):
        if self._client is None:
            if not os.path.exists(self.creds_path):
                raise FileNotFoundError(f"Service account JSON не найден: {self.creds_path}")
            if not self.sheet_id:
                raise ValueError("GOOGLE_SHEET_ID не задан в .env")
            creds = Credentials.from_service_account_file(self.creds_path, scopes=SCOPES)
            self._client = gspread.authorize(creds)
            self._spreadsheet = self._client.open_by_key(self.sheet_id)
        return self._spreadsheet

    def _get_or_create_ws(self, ss, title: str, headers: List[str]):
        try:
            ws = ss.worksheet(title)
        except gspread.WorksheetNotFound:
            ws = ss.add_worksheet(title=title, rows=200, cols=max(len(headers), 10))
        return ws

    def _replace_sheet(self, ws, headers: List[str], rows: List[List[str]]):
        """Перезаписать всё содержимое листа (header + data)."""
        ws.clear()
        data = [headers] + rows
        if data:
            ws.update(values=data, range_name="A1", value_input_option="USER_ENTERED")
        # Жирный заголовок
        try:
            ws.format("A1:Z1", {"textFormat": {"bold": True}})
        except Exception:
            pass

    def sync_all(self, orders: List[Dict], clients: List[Dict], carriers: List[Dict]) -> Dict[str, Any]:
        try:
            ss = self._connect()

            ws_orders = self._get_or_create_ws(ss, "Заказы", ORDER_HEADERS)
            self._replace_sheet(ws_orders, ORDER_HEADERS, [order_row(o) for o in orders])

            ws_clients = self._get_or_create_ws(ss, "Клиенты", CLIENT_HEADERS)
            self._replace_sheet(ws_clients, CLIENT_HEADERS, [client_row(c) for c in clients])

            ws_carriers = self._get_or_create_ws(ss, "Перевозчики", CARRIER_HEADERS)
            self._replace_sheet(ws_carriers, CARRIER_HEADERS, [carrier_row(c) for c in carriers])

            self.last_status = {
                "ok": True,
                "message": "Синхронизация выполнена",
                "synced": {
                    "orders": len(orders),
                    "clients": len(clients),
                    "carriers": len(carriers),
                },
                "sheet_url": f"https://docs.google.com/spreadsheets/d/{self.sheet_id}",
            }
            logger.info(f"[Sheets] Synced: {self.last_status['synced']}")
            return self.last_status
        except Exception as e:
            # Сделаем сообщение понятнее (для PermissionError, 403 и т.п. — str(e) пустой)
            err_msg = str(e) or repr(e) or e.__class__.__name__
            # Если это APIError из gspread — там бывает ответ внутри
            try:
                if hasattr(e, 'response') and getattr(e, 'response') is not None:
                    err_msg = e.response.text[:600]
                elif e.__cause__ is not None and hasattr(e.__cause__, 'response'):
                    err_msg = e.__cause__.response.text[:600]
            except Exception:
                pass
            logger.error(f"[Sheets] Sync failed: {err_msg}", exc_info=True)
            self.last_status = {"ok": False, "message": err_msg, "synced": {}}
            return self.last_status


_sync_instance: Optional[SheetsSync] = None


def get_sync() -> SheetsSync:
    global _sync_instance
    if _sync_instance is None:
        _sync_instance = SheetsSync()
    return _sync_instance


# ====== Async helper для вызова из FastAPI ======
def _order_sort_key(o: Dict[str, Any]):
    """Заявка № → (год, номер), чтобы лист в Google Таблице шёл по порядку
    номеров, а не в произвольном порядке выдачи из Mongo. Заявки с номером,
    который не удаётся разобрать, уходят в конец — отсортированные по дате
    создания, а не теряются."""
    m = re.match(r"^З-(\d+)/(\d{4})$", o.get("order_number", "") or "")
    if m:
        return (0, int(m.group(2)), int(m.group(1)))
    return (1, o.get("created_at", "") or "", 0)


async def trigger_sync(db) -> Dict[str, Any]:
    """Полностью пересинхронизировать все 3 коллекции."""
    orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    orders.sort(key=_order_sort_key)
    clients = await db.clients.find({}, {"_id": 0}).to_list(5000)
    carriers = await db.carriers.find({}, {"_id": 0}).to_list(5000)
    sync = get_sync()
    # gspread синхронный — выполняем в отдельном треде, чтобы не блокировать event loop
    return await asyncio.to_thread(sync.sync_all, orders, clients, carriers)


def schedule_background_sync(db):
    """Не дожидаясь, запустить фоновую синхронизацию."""
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(trigger_sync(db))
    except Exception as e:
        logger.error(f"[Sheets] Could not schedule background sync: {e}")
