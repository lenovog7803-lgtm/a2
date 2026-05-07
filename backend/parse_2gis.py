#!/usr/bin/env python3
"""
Парсер компаний через 2GIS API -> Google Sheets "Обзвон для срм"

Использование:
    python3 backend/parse_2gis.py
"""

import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import requests
import gspread
from google.oauth2.service_account import Credentials

# ─── Конфигурация ─────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
ENV_PATH   = SCRIPT_DIR / ".env"


def _load_env(path: Path) -> Dict[str, str]:
    result: Dict[str, str] = {}
    if not path.exists():
        return result
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip().strip('"').strip("'")
    return result


_env = _load_env(ENV_PATH)

SHEET_ID   = _env.get("GOOGLE_SHEET_ID", os.environ.get("GOOGLE_SHEET_ID", ""))
CREDS_FILE = SCRIPT_DIR / _env.get("GOOGLE_CREDENTIALS_PATH", "google_credentials.json")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

DEFAULT_API_KEY = "cd5ee789-3e47-4efb-a536-bd437347f0b5"
API_BASE        = "https://catalog.api.2gis.com"
PAGE_SIZE       = 20
DELAY           = 0.3
BATCH_SIZE      = 50
MAX_PAGES       = 50   # максимум страниц на одну комбинацию город+запрос

CITIES = [
    "Минск",
    "Москва",
    "Санкт-Петербург",
    "Екатеринбург",
    "Новосибирск",
    "Казань",
]

QUERIES = [
    "производитель",
    "оптовая торговля",
    "дистрибьютор",
    "завод",
    "фабрика",
    "продукты питания оптом",
    "строительные материалы оптом",
    "металл оптом",
    "химия оптом",
    "упаковка оптом",
]

# ─── HTTP ─────────────────────────────────────────────────────────────────────

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept":     "application/json",
    })
    return s


def get_json(session: requests.Session, url: str, **params) -> Optional[dict]:
    try:
        time.sleep(DELAY)
        r = session.get(url, params=params, timeout=20)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        print(f"    [WARN] GET {url}: {exc}")
        return None

# ─── Города ───────────────────────────────────────────────────────────────────

def find_city_id(session: requests.Session, city_name: str, api_key: str) -> Optional[str]:
    data = get_json(
        session,
        f"{API_BASE}/2.0/region/search",
        q=city_name,
        key=api_key,
        locale="ru_RU",
    )
    if not data:
        return None

    items = (
        (data.get("result") or {}).get("items")
        or data.get("items")
        or []
    )
    for item in items:
        name = str(item.get("name") or "").strip().lower()
        if city_name.lower() in name or name in city_name.lower():
            return str(item["id"])
    # Первый результат как запасной вариант
    if items:
        return str(items[0]["id"])
    return None

# ─── Парсинг компаний ─────────────────────────────────────────────────────────

def iter_items(
    session: requests.Session,
    api_key: str,
    city_id: str,
    query: str,
    city_name: str,
):
    """Генератор: отдаёт (item, city_name, query) постранично."""
    seen_ids: Set[str] = set()
    page = 1

    while page <= MAX_PAGES:
        data = get_json(
            session,
            f"{API_BASE}/3.0/items",
            q=query,
            city_id=city_id,
            key=api_key,
            page=page,
            page_size=PAGE_SIZE,
            fields="items.contacts,items.address",
            locale="ru_RU",
            type="branch",
        )
        if not data:
            break

        result = data.get("result") or {}
        items  = result.get("items") or data.get("items") or []
        total  = int(result.get("total") or data.get("total") or 0)

        if not items:
            break

        # Стоп если страница содержит только уже виденные id
        page_ids = {str(item.get("id", "")) for item in items if item.get("id")}
        if page_ids and page_ids.issubset(seen_ids):
            print(f"      [{city_name}] «{query}» стр.{page}: дубликаты, стоп")
            break
        seen_ids.update(page_ids)

        last_page = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE) if total else page
        print(f"      [{city_name}] «{query}» стр.{page}/{last_page}: {len(items)} компаний")

        for item in items:
            yield item, city_name, query

        if not total or page * PAGE_SIZE >= total:
            break
        page += 1


def _first_phone(item: dict) -> str:
    """Берёт первый телефон из contact_groups."""
    for group in item.get("contact_groups") or []:
        for c in group.get("contacts") or []:
            if c.get("type") in ("phone", "mobile_phone", "fax"):
                val = str(c.get("value") or c.get("text") or "").strip()
                if val:
                    return val
    return ""


def build_lead(item: dict, city_name: str, query: str) -> Optional[Dict[str, str]]:
    name = str(item.get("name") or "").strip()
    if not name:
        return None

    phone = _first_phone(item)

    address_obj = item.get("address") or {}
    address_str = str(
        address_obj.get("name") or address_obj.get("comment") or ""
    ).strip()

    notes = query
    if address_str:
        notes += ": " + address_str
    notes = notes[:255]

    return {
        "name":    name,
        "company": name,
        "phone":   phone,
        "city":    city_name,
        "notes":   notes,
        "status":  "new",
    }

# ─── Google Sheets ────────────────────────────────────────────────────────────

LEADS_DATA_START_ROW = 2   # строка 1 — заголовок


def get_worksheet() -> gspread.Worksheet:
    creds = Credentials.from_service_account_file(str(CREDS_FILE), scopes=SCOPES)
    gc    = gspread.authorize(creds)
    ss    = gc.open_by_key(SHEET_ID)
    return ss.worksheet("Обзвон для срм")


def load_existing_names(ws: gspread.Worksheet) -> Set[str]:
    col = ws.col_values(2)   # колонка company
    return {v.strip().lower() for v in col if v.strip()}


def last_data_row(ws: gspread.Worksheet) -> int:
    col = ws.col_values(1)
    for i in range(len(col), 0, -1):
        if str(col[i - 1]).strip():
            return i
    return LEADS_DATA_START_ROW - 1


def flush_batch(ws: gspread.Worksheet, rows: List[Tuple[int, Dict[str, str]]]) -> None:
    if not rows:
        return
    # Структура листа: 1=name  2=company  3=phone  4=city  5=status  7=notes
    col_map = {1: "name", 2: "company", 3: "phone", 4: "city", 7: "notes"}
    updates = []
    for row_num, lead in rows:
        for col, field in col_map.items():
            val = lead.get(field, "")
            if val:
                addr = gspread.utils.rowcol_to_a1(row_num, col)
                updates.append({"range": addr, "values": [[str(val)]]})
        addr = gspread.utils.rowcol_to_a1(row_num, 5)
        updates.append({"range": addr, "values": [["Новый"]]})
    ws.batch_update(updates, value_input_option="USER_ENTERED")

# ─── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 64)
    print("   Парсер компаний  2GIS API  ->  Google Sheets")
    print("=" * 64)

    entered = input(f"\nAPI ключ 2GIS (Enter = использовать встроенный): ").strip()
    api_key = entered or DEFAULT_API_KEY

    session = make_session()

    # 1. Поиск city_id
    print(f"\n[1/3] Поиск ID городов ({len(CITIES)})...")
    city_ids: Dict[str, str] = {}
    for city in CITIES:
        cid = find_city_id(session, city, api_key)
        if cid:
            print(f"  {city}: id={cid}")
            city_ids[city] = cid
        else:
            print(f"  {city}: не найден, пропускаем")

    if not city_ids:
        print("Ни один город не найден. Проверьте API ключ.")
        sys.exit(1)

    # 2. Google Sheets
    print("\n[2/3] Подключение к Google Sheets...")
    ws       = get_worksheet()
    existing = load_existing_names(ws)
    next_row = last_data_row(ws) + 1
    print(f"  В таблице: {len(existing)} записей, пишем с строки {next_row}")

    # 3. Парсинг
    print(f"\n[3/3] Парсинг: {len(city_ids)} городов × {len(QUERIES)} запросов...\n")
    total_added = 0
    total_skip  = 0
    batch: List[Tuple[int, Dict[str, str]]] = []

    for city_name, city_id in city_ids.items():
        for query in QUERIES:
            print(f"  ▸ {city_name} / «{query}»")

            for item, city, q in iter_items(session, api_key, city_id, query, city_name):
                lead = build_lead(item, city, q)
                if not lead:
                    continue

                key = lead["company"].lower()
                if key in existing:
                    total_skip += 1
                    continue

                existing.add(key)
                batch.append((next_row, lead))
                next_row += 1
                print(f"      + {lead['name'][:45]:<45} | {lead['phone']}")

                if len(batch) >= BATCH_SIZE:
                    flush_batch(ws, batch)
                    total_added += len(batch)
                    batch = []
                    print(f"      → Записано в таблицу: {total_added}")

    if batch:
        flush_batch(ws, batch)
        total_added += len(batch)

    print("\n" + "=" * 64)
    print(f"  Готово.  Добавлено: {total_added}  |  Пропущено (дубли): {total_skip}")
    print("=" * 64)


if __name__ == "__main__":
    main()
