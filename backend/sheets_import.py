"""
Импорт данных из Google Sheets в MongoDB.
ОДНОНАПРАВЛЕННО: Sheets -> CRM. Ничего в таблице не изменяется.

Структура листов (как в таблице пользователя):

Лист "Заказы":
  row3 — заголовки, row4+ — данные
  col0  Номер заявки
  col1  Дата заявки (DD.MM.YYYY)
  col2  Клиент
  col3  Перевозчик
  col4  Маршрут (А-Б)
  col5  Дата загрузки
  col6  Дата выгрузки
  col7  Ставка клиента
  col8  Ставка перевозчика
  col9  Статус (Завершён/В работе/Новая/Отменён)
  col10 Оплата от К (Оплачено/Не оплачено)
  col11 Оплата от П
  col16 От перевозчика (✔️ Выполнено = да)
  col17 Перевозчику
  col18 Клиенту
  col19 От клиента
  col46 Водитель
  col47 Данные о грузе
  col48 Адрес загрузки
  col49 Адрес выгрузки
  col50 Доп. информация

Лист "Клиенты":
  row0 — заголовки, row1 — служебные, row2+ — данные
  col0..col12: компания, лицо, телефон, email, юр.адрес, сфера, унп/инн, почт.адрес,
               р/с, банк, бик, директор, основание

Лист "Перевозчики":
  row0 — заголовки, row1+ — данные
  col0..col12: компания, контакт, машина, тоннаж, юр.адрес, номер/тип, унп/инн,
               почт.адрес, р/с, банк, бик, директор, основание
"""
from __future__ import annotations
import os
import re
import logging
import asyncio
import uuid
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone

import gspread
from google.oauth2.service_account import Credentials

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


# ===== helpers =====
def _s(v) -> str:
    return (str(v) if v is not None else "").strip()


def _money(v) -> float:
    if v is None:
        return 0.0
    s = str(v).strip()
    if not s:
        return 0.0
    # убираем валюту, пробелы и неразрывные пробелы
    s = re.sub(r"[^\d,.\-]", "", s)
    s = s.replace(" ", "").replace(",", ".")
    if s.count(".") > 1:
        # 1.234.56 → 1234.56
        parts = s.split(".")
        s = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return float(s)
    except Exception:
        return 0.0


def _date(v) -> str:
    """DD.MM.YYYY -> YYYY-MM-DD; '' -> ''"""
    s = _s(v)
    if not s:
        return ""
    # уже ISO?
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # DD.MM.YYYY или DD/MM/YYYY
    m = re.match(r"^(\d{1,2})[./](\d{1,2})[./](\d{2,4})", s)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        if len(y) == 2:
            y = "20" + y
        return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
    return s  # fallback


def _bool_pay(v) -> bool:
    s = _s(v).lower()
    return "оплач" in s and "не " not in s and "не оплач" not in s


def _bool_check(v) -> bool:
    """✔, ✔️, Выполнено, Да -> True"""
    s = _s(v).lower()
    if not s:
        return False
    if "не " in s:
        return False
    return any(t in s for t in ["✔", "✓", "выполн", "готов", "да", "отправ", "получен"])


_STATUS_MAP = {
    "завершён": "done", "завершен": "done", "доставлен": "done", "выполнен": "done", "delivered": "done", "done": "done",
    "в работе": "in_progress", "впроцессе": "in_progress", "в процессе": "in_progress", "загрузк": "in_progress",
    "новая": "new", "новый": "new",
    "отмен": "cancelled",
}

_LEAD_STATUS_MAP = {
    "перезвонить": "callback",
    "клиент": "won",
    "потерян": "lost",
    "думают": "thinking",
    "выслал кп": "sent_kp",
    "кп": "sent_kp",
    "в работе": "thinking",
    "новый": "new",
    "новая": "new",
}


def _status(v) -> str:
    s = _s(v).lower()
    for k, val in _STATUS_MAP.items():
        if k in s:
            return val
    return "new"


def _lead_status(v) -> str:
    s = _s(v).lower()
    for k, val in _LEAD_STATUS_MAP.items():
        if k in s:
            return val
    return "new"


def _split_route(route: str) -> Tuple[str, str]:
    s = _s(route)
    if not s:
        return ("", "")
    # делим по тире/дефису/em-dash
    parts = re.split(r"\s*[-—–]\s*", s, maxsplit=1)
    if len(parts) == 2:
        return (parts[0].strip(), parts[1].strip())
    return (s, "")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ===== row -> dict =====
def parse_client(row: List[str]) -> Optional[Dict[str, Any]]:
    name = _s(row[0]) if len(row) > 0 else ""
    if not name or len(name) < 2:
        return None
    # пропускаем явно мусорные строки (заголовки и т.п.)
    if name.lower() in ("компания", "клиенты", "название"):
        return None
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "contact_person": _s(row[1]) if len(row) > 1 else "",
        "phone": _s(row[2]) if len(row) > 2 else "",
        "email": _s(row[3]) if len(row) > 3 else "",
        "legal_address": _s(row[4]) if len(row) > 4 else "",
        "cargo_types": _s(row[5]) if len(row) > 5 else "",
        "inn": _s(row[6]) if len(row) > 6 else "",
        "kpp": "",
        "bank_account": _s(row[8]) if len(row) > 8 else "",
        "bank_name": _s(row[9]) if len(row) > 9 else "",
        "bank_bik": _s(row[10]) if len(row) > 10 else "",
        "bank_corr_account": "",
        "payment_terms": "",
        "directions": "",
        "notes": " | ".join([
            f"Почт.адрес: {_s(row[7])}" if len(row) > 7 and _s(row[7]) and _s(row[7]) != "-" else "",
            f"Директор: {_s(row[11])}" if len(row) > 11 and _s(row[11]) and _s(row[11]) != "-" else "",
            f"Основание: {_s(row[12])}" if len(row) > 12 and _s(row[12]) else "",
        ]).strip(" |").replace(" |  | ", " | ").replace("| |", "|"),
        "created_at": _now_iso(),
    }


def parse_carrier(row: List[str]) -> Optional[Dict[str, Any]]:
    name = _s(row[0]) if len(row) > 0 else ""
    if not name or len(name) < 2:
        return None
    if name.lower() in ("компания", "перевозчики", "название"):
        return None
    return {
        "id": str(uuid.uuid4()),
        "company_name": name,
        "driver_name": _s(row[1]) if len(row) > 1 else "",
        "phone": "",
        "vehicle_type": _s(row[2]) if len(row) > 2 else "",
        "capacity_tons": _money(row[3]) if len(row) > 3 else 0,
        "capacity_m3": 0,
        "legal_address": _s(row[4]) if len(row) > 4 else "",
        "postal_address": _s(row[7]) if len(row) > 7 else "",
        "plate": _s(row[5]) if len(row) > 5 else "",
        "unp": _s(row[6]) if len(row) > 6 else "",
        "inn": "",
        "kpp": "",
        "rs": _s(row[8]) if len(row) > 8 else "",
        "bank_account": _s(row[8]) if len(row) > 8 else "",
        "bank": _s(row[9]) if len(row) > 9 else "",
        "bank_name": _s(row[9]) if len(row) > 9 else "",
        "bik": _s(row[10]) if len(row) > 10 else "",
        "bank_bik": _s(row[10]) if len(row) > 10 else "",
        "bank_corr_account": "",
        "director": _s(row[11]) if len(row) > 11 else "",
        "basis": _s(row[12]) if len(row) > 12 else "свидетельства о гос. регистрации",
        "cargo_types": "",
        "regions": "",
        "rating": 5.0,
        "notes": "",
        "created_at": _now_iso(),
    }


def parse_order(row: List[str], client_idx: Dict[str, str], carrier_idx: Dict[str, str]) -> Optional[Dict[str, Any]]:
    num = _s(row[0]) if len(row) > 0 else ""
    if not num:
        return None
    if num.lower() in ("номер заявки", "номер", "№"):
        return None

    client_name = _s(row[2]) if len(row) > 2 else ""
    carrier_name = _s(row[3]) if len(row) > 3 else ""
    rfrom, rto = _split_route(_s(row[4]) if len(row) > 4 else "")

    return {
        "id": str(uuid.uuid4()),
        "order_number": num,
        "client_id": client_idx.get(client_name.lower(), ""),
        "client_name": client_name,
        "carrier_id": carrier_idx.get(carrier_name.lower(), ""),
        "carrier_name": carrier_name,
        "route_from": rfrom,
        "route_to": rto,
        "route_from_address": _s(row[48]) if len(row) > 48 else "",
        "route_to_address": _s(row[49]) if len(row) > 49 else "",
        "load_date": _date(row[5]) if len(row) > 5 else "",
        "unload_date": _date(row[6]) if len(row) > 6 else "",
        "driver_name": _s(row[46]) if len(row) > 46 else "",
        "driver_phone": "",
        "vehicle_type": "",
        "vehicle_plate": "",
        "client_rate": _money(row[7]) if len(row) > 7 else 0,
        "carrier_rate": _money(row[8]) if len(row) > 8 else 0,
        "status": _status(row[9]) if len(row) > 9 else "new",
        "client_paid": _bool_pay(row[10]) if len(row) > 10 else False,
        "carrier_paid": _bool_pay(row[11]) if len(row) > 11 else False,
        "docs_from_carrier_received": _bool_check(row[16]) if len(row) > 16 else False,
        "docs_to_carrier_sent": _bool_check(row[17]) if len(row) > 17 else False,
        "docs_to_client_sent": _bool_check(row[18]) if len(row) > 18 else False,
        "docs_from_client_received": _bool_check(row[19]) if len(row) > 19 else False,
        "cargo": _s(row[47]) if len(row) > 47 else "",
        "weight_tons": 0,
        "notes": _s(row[50]) if len(row) > 50 else "",
        "doc_url_client": _s(row[34]) if len(row) > 34 else "",
        "doc_url_carrier": _s(row[35]) if len(row) > 35 else "",
        "doc_url_act": _s(row[36]) if len(row) > 36 else "",
        "created_at": _date(row[1]) + "T00:00:00+00:00" if (len(row) > 1 and _date(row[1])) else _now_iso(),
    }


def parse_lead(row: List[str]) -> Optional[Dict[str, Any]]:
    name = _s(row[0]) if len(row) > 0 else ""
    if not name or len(name) < 2:
        return None
    if name.lower() in ("имя", "контакт", "лид", "обзвон", "фио"):
        return None
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "company": _s(row[1]) if len(row) > 1 else "",
        "phone": _s(row[2]) if len(row) > 2 else "",
        "city": _s(row[3]) if len(row) > 3 else "",
        "status": _lead_status(row[4]) if len(row) > 4 else "new",
        "next_call": _s(row[5]) if len(row) > 5 else "",
        "notes": _s(row[6]) if len(row) > 6 else "",
        "directions": _s(row[7]) if len(row) > 7 else "",
        "email": _s(row[8]) if len(row) > 8 else "",
        "industry": _s(row[9]) if len(row) > 9 else "",
        "last_contact": "",
        "created_at": _now_iso(),
    }


# ===== main importer =====
class SheetsImporter:
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

    def _read_tab(self, title: str) -> List[List[str]]:
        ss = self._connect()
        ws = ss.worksheet(title)
        return ws.get_all_values()

    def import_clients(self) -> List[Dict[str, Any]]:
        rows = self._read_tab("Клиенты")
        out = []
        seen = set()
        # row0 — заголовки, row1 — служебные подзаголовки, данные с row2
        for r in rows[2:]:
            obj = parse_client(r)
            if not obj:
                continue
            key = obj["name"].lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(obj)
        return out

    def import_carriers(self) -> List[Dict[str, Any]]:
        rows = self._read_tab("Перевозчики")
        out = []
        seen = set()
        # row0 — заголовки; данные с row1
        for r in rows[1:]:
            obj = parse_carrier(r)
            if not obj:
                continue
            key = obj["company_name"].lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(obj)
        return out

    def import_orders(self, clients: List[Dict[str, Any]], carriers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        rows = self._read_tab("Заказы")
        # row0 — секция "Движения почты", row3 — заголовки, данные с row4
        client_idx = {c["name"].lower(): c["id"] for c in clients}
        carrier_idx = {c["company_name"].lower(): c["id"] for c in carriers}
        out = []
        for r in rows[4:]:
            obj = parse_order(r, client_idx, carrier_idx)
            if not obj:
                continue
            out.append(obj)
        return out

    def import_leads(self) -> List[Dict[str, Any]]:
        rows = self._read_tab("Обзвон для срм")
        out = []
        seen = set()
        # row0 — заголовки, данные с row1
        for r in rows[1:]:
            obj = parse_lead(r)
            if not obj:
                continue
            key = obj["name"].lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(obj)
        return out


async def run_import(db) -> Dict[str, Any]:
    """Полный импорт: читаем 3 листа -> заменяем коллекции в Mongo.
    Sheet остаётся неизменной.
    """
    importer = SheetsImporter()

    def _fetch():
        clients = importer.import_clients()
        carriers = importer.import_carriers()
        orders = importer.import_orders(clients, carriers)
        leads = importer.import_leads()
        return clients, carriers, orders, leads

    try:
        clients, carriers, orders, leads = await asyncio.to_thread(_fetch)
    except Exception as e:
        # Понятное сообщение об ошибке
        err_msg = str(e) or repr(e) or e.__class__.__name__
        try:
            if hasattr(e, 'response') and getattr(e, 'response') is not None:
                err_msg = e.response.text[:600]
        except Exception:
            pass
        logger.error(f"[Sheets import] failed: {err_msg}", exc_info=True)
        return {"ok": False, "message": err_msg, "imported": {}}

    # Клиенты и перевозчики: полная замена из Sheet
    await db.clients.delete_many({})
    if clients:
        await db.clients.insert_many(clients)

    await db.carriers.delete_many({})
    if carriers:
        await db.carriers.insert_many(carriers)

    # Заявки: upsert по order_number — не перезаписываем статус если в CRM уже done/cancelled
    _CRM_ONLY_ORDER_FIELDS = {"client_paid", "carrier_paid", "client_paid_date", "carrier_paid_date",
                               "docs_to_client_sent", "docs_from_client_received",
                               "docs_to_carrier_sent", "docs_from_carrier_received",
                               "docs_to_client_sent_date", "docs_from_client_received_date",
                               "docs_to_carrier_sent_date", "docs_from_carrier_received_date",
                               "calendar_event_id", "calendar_event_url",
                               "doc_url_client", "doc_url_carrier", "doc_url_act",
                               "notes", "deleted", "deleted_at"}
    existing_orders = {o["order_number"]: o for o in await db.orders.find(
        {"order_number": {"$exists": True, "$ne": ""}}, {"_id": 0}
    ).to_list(100000)}

    for order in orders:
        num = order.get("order_number", "")
        existing = existing_orders.get(num)
        if existing:
            # Keep CRM-managed status if it's a terminal state
            crm_status = existing.get("status", "")
            if crm_status in ("done", "cancelled", "in_progress") and order.get("status") == "new":
                order["status"] = crm_status
            # Preserve CRM-only fields
            for field in _CRM_ONLY_ORDER_FIELDS:
                if field in existing and existing[field]:
                    order[field] = existing[field]
            await db.orders.replace_one({"order_number": num}, order, upsert=True)
        else:
            await db.orders.insert_one(order)

    # Remove orders that no longer exist in Sheet (soft check — only if sheet has data)
    if orders:
        sheet_numbers = {o["order_number"] for o in orders if o.get("order_number")}
        await db.orders.delete_many({
            "order_number": {"$nin": list(sheet_numbers), "$exists": True, "$ne": ""},
            "deleted": {"$ne": True},
        })

    # Лиды: upsert по имени чтобы не затирать call_notes / last_call из CRM
    _LEADS_MONGO_ONLY = {"call_notes", "last_call", "id"}
    for lead in leads:
        sheet_fields = {k: v for k, v in lead.items() if k not in _LEADS_MONGO_ONLY}
        await db.leads.update_one(
            {"name": lead["name"]},
            {
                "$set": sheet_fields,
                "$setOnInsert": {
                    "id": lead["id"],
                    "call_notes": [],
                    "last_call": "",
                },
            },
            upsert=True,
        )

    # Кэшируем последний статус
    last = {
        "ok": True,
        "message": "Импорт выполнен",
        "imported": {
            "clients": len(clients),
            "carriers": len(carriers),
            "orders": len(orders),
            "leads": len(leads),
        },
        "at": _now_iso(),
    }
    _last_import_status.update(last)
    logger.info(f"[Sheets import] {last['imported']}")
    return last


_last_import_status: Dict[str, Any] = {"ok": False, "message": "Импорт ещё не запускался", "imported": {}}


def get_last_status() -> Dict[str, Any]:
    return dict(_last_import_status)
