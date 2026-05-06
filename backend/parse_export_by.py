#!/usr/bin/env python3
"""
Парсер компаний с export.by (JSON API + токен-авторизация) -> Google Sheets "Обзвон для срм"

Использование:
    python3 backend/parse_export_by.py
"""

import os
import re
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

BASE_URL  = "https://export.by"
DELAY     = 0.5
BATCH_SIZE = 50

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer":    "https://export.by/",
    "Accept":     "application/json",
}

SECTIONS: Dict[str, List[str]] = {
    "Бытовые товары": [
        "Автотовары", "Аксессуары и украшения", "Все для отпуска", "Дом и сад",
        "Домашние животные и зоотовары", "Инструмент", "Канцтовары",
        "Красота и здоровье", "Материалы для ремонта",
        "Медикаменты и медицинские товары", "Одежда и обувь",
        "Подарки хобби книги", "Продукты питания напитки", "Прочее",
        "Спорт и отдых", "Строительство", "Техника и электроника",
        "Товары для детей",
    ],
    "Промышленные товары": [
        "Авиа ж/д водный транспорт", "Безопасность и защита",
        "Грузовики автобусы спецтехника", "Изделия из металла пластика резины",
        "Контрольно-измерительные приборы", "Медицинское оборудование",
        "Недвижимость", "Неликвидные запасы", "Оборудование и товары для услуг",
        "Отопление", "Промышленная химия", "Промышленное оборудование и станки",
        "Сельхозпродукция техника и оборудование", "Сырьё и материалы",
        "Тара и упаковка", "Телекоммуникации и связь", "Электрооборудование",
    ],
}

# ─── HTTP-сессия ──────────────────────────────────────────────────────────────

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def get_json(session: requests.Session, url: str, **params) -> Optional[dict]:
    try:
        time.sleep(DELAY)
        r = session.get(url, params=params or None, timeout=20)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        print(f"    [WARN] GET {url}: {exc}")
        return None

# ─── Авторизация ──────────────────────────────────────────────────────────────

def set_token(session: requests.Session, token: str) -> None:
    session.cookies.set("export_access_token", token, domain="export.by")
    session.headers.update({
        "Access-Token":    token,
        "Accept":          "application/json",
        "Accept-Language": "ru",
    })


def check_auth(session: requests.Session) -> bool:
    prof = get_json(session, f"{BASE_URL}/back/user/profile")
    return bool(prof and not prof.get("error") and (prof.get("id") or prof.get("data")))


# ─── Дерево категорий ─────────────────────────────────────────────────────────

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _walk(node, lookup: Dict[str, Tuple[str, str]], found: Dict[Tuple[str, str], int]) -> None:
    """Рекурсивно обходит дерево узлов. node — dict с полями id, text, nodes."""
    if not isinstance(node, dict):
        return

    text = str(node.get("text") or "").strip().lower()
    # Нечёткий поиск: проверяем совпадение с каждым ключом из lookup
    for key, key_pair in lookup.items():
        if key_pair in found:
            continue
        if key in text or text in key:
            node_id = node.get("id")
            if node_id is not None:
                found[key_pair] = int(node_id)
                break

    for child in node.get("nodes") or []:
        _walk(child, lookup, found)


def find_category_ids(session: requests.Session) -> Dict[Tuple[str, str], int]:
    data = get_json(session, f"{BASE_URL}/back/site/get-tree")
    if data is None:
        return {}

    lookup: Dict[str, Tuple[str, str]] = {
        _norm(cat): (section, cat)
        for section, cats in SECTIONS.items()
        for cat in cats
    }
    found: Dict[Tuple[str, str], int] = {}

    # Ответ — один dict (корневой узел) или список узлов
    if isinstance(data, list):
        for node in data:
            _walk(node, lookup, found)
    else:
        _walk(data, lookup, found)

    return found


# ─── Список компаний ──────────────────────────────────────────────────────────

def iter_companies(session: requests.Session, cat_id: int):
    """Генератор: отдаёт dict каждой компании из листинга."""
    page = 1
    while True:
        resp = get_json(
            session,
            f"{BASE_URL}/back/search/company",
            filter_category_id=cat_id,
            page=page,
        )
        if resp is None:
            break

        if isinstance(resp, list):
            items = resp
            last_page = 1
        else:
            items = resp.get("data") or []
            meta  = resp.get("meta") or resp.get("pagination") or {}
            last_page = int(
                meta.get("last_page")
                or meta.get("total_pages")
                or meta.get("pageCount")
                or 1
            )

        if not items:
            break

        for item in items:
            yield item
        print(f"      стр.{page}/{last_page}: {len(items)} компаний")
        if page >= last_page:
            break
        page += 1


# ─── Детали компании ──────────────────────────────────────────────────────────

def get_company_details(session: requests.Session, company_id: int) -> Optional[dict]:
    return get_json(session, f"{BASE_URL}/back/company/get/{company_id}")


_INDEX_RE = re.compile(r"^\d{6}\s*,?\s*")       # почтовый индекс в начале
_CITY_RE  = re.compile(r"г\.?\s*([А-ЯЁа-яё][А-ЯЁа-яё\-\s]{2,}?)(?:[,.]|$)")


def _extract_city(address: str) -> str:
    """Извлекает город из строки адреса (убирает индекс, ищет «г. Минск» и т.п.)."""
    if not address:
        return ""
    addr = _INDEX_RE.sub("", address).strip()

    m = _CITY_RE.search(addr)
    if m:
        return m.group(1).strip()

    # Первый токен до запятой как запасной вариант
    parts = [p.strip() for p in addr.split(",")]
    return parts[0][:60] if parts else ""


def _first_phone(company: dict) -> str:
    phones = company.get("phones") or company.get("phone") or []
    if isinstance(phones, str):
        return phones.strip()
    if isinstance(phones, list) and phones:
        p = phones[0]
        if isinstance(p, dict):
            return str(p.get("value") or p.get("phone") or p.get("number") or "").strip()
        return str(p).strip()
    return ""


def build_lead(
    listing: dict,
    details: Optional[dict],
    section: str,
    cat_name: str,
) -> Optional[Dict[str, str]]:
    src = {**listing, **(details or {})}   # details перезаписывают листинг

    name = str(
        src.get("short_name") or src.get("name") or src.get("title") or ""
    ).strip()
    if not name:
        return None

    full_name = str(
        src.get("name") or src.get("full_name") or name
    ).strip()

    phone = _first_phone(src)

    address = str(src.get("address") or src.get("legal_address") or "")
    city    = _extract_city(address)

    description = str(
        src.get("description") or src.get("about") or src.get("activity") or ""
    ).strip()

    notes = f"{section}: {cat_name}"
    if description:
        notes += ". " + description[:200]
    notes = notes[:255]

    email = str(src.get("email") or src.get("e_mail") or "").strip()

    return {
        "name":    name,
        "company": full_name,
        "phone":   phone,
        "city":    city,
        "email":   email,
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
    col = ws.col_values(2)   # колонка company (col 2)
    return {_norm(v) for v in col if v.strip()}


def last_data_row(ws: gspread.Worksheet) -> int:
    col = ws.col_values(1)
    for i in range(len(col), 0, -1):
        if str(col[i - 1]).strip():
            return i
    return LEADS_DATA_START_ROW - 1


def flush_batch(ws: gspread.Worksheet, rows: List[Tuple[int, Dict[str, str]]]) -> None:
    if not rows:
        return
    # Структура листа: 1=name  2=company  3=phone  4=city  5=status  7=notes  9=email
    col_map = {1: "name", 2: "company", 3: "phone", 4: "city", 7: "notes", 9: "email"}
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
    print("   Парсер компаний  export.by  ->  Google Sheets")
    print("=" * 64)

    token = input("\nВставьте export_access_token из браузера: ").strip()
    if not token:
        print("Токен обязателен.")
        sys.exit(1)

    session = make_session()

    # 1. Авторизация
    print("\n[1/5] Авторизация на export.by...")
    set_token(session, token)
    ok = check_auth(session)
    if not ok:
        print("  Ошибка: токен недействителен или истёк. Проверьте export_access_token.")
        sys.exit(1)
    print("  Авторизован.")

    # 2. Дерево категорий
    total_need = sum(len(v) for v in SECTIONS.values())
    print(f"\n[2/5] Получение дерева категорий (нужно {total_need})...")
    cat_ids = find_category_ids(session)
    print(f"  Найдено: {len(cat_ids)} категорий")
    if not cat_ids:
        print("  Не найдено ни одной категории. Проверьте /back/site/get-tree.")
        sys.exit(1)
    for (sec, cat), cid in sorted(cat_ids.items()):
        print(f"    [{sec}] {cat}  id={cid}")

    # 3. Sheets
    print("\n[3/5] Подключение к Google Sheets...")
    ws = get_worksheet()
    existing = load_existing_names(ws)
    next_row = last_data_row(ws) + 1
    print(f"  В таблице: {len(existing)} записей, пишем с строки {next_row}")

    # 4. Парсинг
    print("\n[4/5] Парсинг компаний...\n")
    total_added = 0
    total_skip  = 0
    batch: List[Tuple[int, Dict[str, str]]] = []

    for (section, cat_name), cat_id in cat_ids.items():
        print(f"  ▸ [{section}] {cat_name}  id={cat_id}")
        cat_added = 0

        for listing in iter_companies(session, cat_id):
            company_id = listing.get("id") or listing.get("company_id")

            # Запрашиваем детали только если в листинге нет телефона/описания
            details = None
            if company_id and (not listing.get("phones") and not listing.get("phone")):
                details = get_company_details(session, int(company_id))

            lead = build_lead(listing, details, section, cat_name)
            if not lead:
                continue

            if _norm(lead["company"]) in existing:
                total_skip += 1
                continue

            existing.add(_norm(lead["company"]))
            batch.append((next_row, lead))
            next_row  += 1
            cat_added += 1

            print(
                f"      + {lead['name'][:45]:<45} | "
                f"{lead['city']:<15} | {lead['phone']}"
            )

            if len(batch) >= BATCH_SIZE:
                flush_batch(ws, batch)
                total_added += len(batch)
                batch = []
                print(f"      → Записано в таблицу: {total_added}")

        print(f"    Добавлено: {cat_added}\n")

    # 5. Остаток
    if batch:
        flush_batch(ws, batch)
        total_added += len(batch)

    print("=" * 64)
    print(f"  Готово.  Добавлено: {total_added}  |  Пропущено (дубли): {total_skip}")
    print("=" * 64)


if __name__ == "__main__":
    main()
