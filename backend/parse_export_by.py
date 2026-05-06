#!/usr/bin/env python3
"""
Парсер компаний с export.by (через JSON API) -> Google Sheets "Обзвон для срм"

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

API_BASE  = "https://export.by/back"
DELAY     = 0.5   # секунд между запросами
BATCH_SIZE = 30   # строк перед flush в Sheets

# Нужные подкатегории: раздел -> список названий
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

# ─── HTTP-клиент ──────────────────────────────────────────────────────────────

class ApiClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "Accept":       "application/json",
            "Content-Type": "application/json",
            "User-Agent":   "Mozilla/5.0 (compatible; export-by-parser/1.0)",
        })

    def _get(self, path: str, **params) -> Optional[dict]:
        url = f"{API_BASE}{path}"
        try:
            time.sleep(DELAY)
            r = self.session.get(url, params=params, timeout=20)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            print(f"    [WARN] GET {url} -> {exc}")
            return None

    def _post(self, path: str, payload: dict) -> Optional[dict]:
        url = f"{API_BASE}{path}"
        try:
            time.sleep(DELAY)
            r = self.session.post(url, json=payload, timeout=20)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            print(f"    [WARN] POST {url} -> {exc}")
            return None

    # ── Auth ──────────────────────────────────────────────────────────────────

    def login(self, email: str, password: str) -> bool:
        data = self._post("/auth/login", {"email": email, "password": password})
        if data is None:
            return False

        # Токен может быть в поле token / access_token / data.token
        token = (
            data.get("token")
            or data.get("access_token")
            or (data.get("data") or {}).get("token")
            or (data.get("data") or {}).get("access_token")
        )
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"
            return True

        # Если нет токена, но ответ 200 — возможно куки достаточно
        return True

    # ── Категории ─────────────────────────────────────────────────────────────

    def get_tree(self) -> Optional[list]:
        data = self._get("/catalog/get-tree")
        if data is None:
            return None
        # Ответ может быть списком или {data: [...]}
        if isinstance(data, list):
            return data
        return data.get("data") or data.get("categories") or data.get("tree")

    # ── Компании ──────────────────────────────────────────────────────────────

    def get_companies_page(self, category_id: int, page: int) -> Optional[dict]:
        return self._get(
            "/search/company",
            filter_category_id=category_id,
            page=page,
        )

    def get_company(self, company_id: int) -> Optional[dict]:
        return self._get(f"/company/{company_id}")


# ─── Работа с деревом категорий ──────────────────────────────────────────────

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _walk_tree(nodes: list, lookup: Dict[str, Tuple[str, str]], found: Dict[Tuple[str, str], int]) -> None:
    """Рекурсивно обходит дерево, ищет узлы по названию."""
    for node in nodes:
        if not isinstance(node, dict):
            continue
        # Варианты поля с названием
        name_raw = (
            node.get("name")
            or node.get("title")
            or node.get("label")
            or ""
        )
        key = _norm(str(name_raw))
        if key in lookup:
            section_cat = lookup[key]
            if section_cat not in found:
                node_id = node.get("id") or node.get("category_id")
                if node_id is not None:
                    found[section_cat] = int(node_id)

        # Дочерние узлы
        children = (
            node.get("children")
            or node.get("items")
            or node.get("subcategories")
            or []
        )
        if children:
            _walk_tree(children, lookup, found)


def find_category_ids(
    tree: list,
) -> Dict[Tuple[str, str], int]:
    """Возвращает {(раздел, подкатегория): id}."""
    lookup: Dict[str, Tuple[str, str]] = {
        _norm(cat): (section, cat)
        for section, cats in SECTIONS.items()
        for cat in cats
    }
    found: Dict[Tuple[str, str], int] = {}
    _walk_tree(tree, lookup, found)
    return found


# ─── Извлечение данных компании ───────────────────────────────────────────────

_CITY_RE = re.compile(r"г\.?\s*([А-ЯЁа-яё][А-ЯЁа-яё\-\s]{2,30}?)(?:[,.]|$)")


def _extract_city(address: str) -> str:
    if not address:
        return ""
    m = _CITY_RE.search(address)
    if m:
        return m.group(1).strip()
    parts = [p.strip() for p in address.split(",")]
    return parts[0][:60] if parts else ""


def _first_phone(data: dict) -> str:
    # Поле phone может быть строкой или списком
    phones = data.get("phones") or data.get("phone") or []
    if isinstance(phones, str):
        return phones.strip()
    if isinstance(phones, list) and phones:
        p = phones[0]
        return str(p.get("value", p) if isinstance(p, dict) else p).strip()
    return ""


def build_lead(company: dict, section: str, cat_name: str) -> Optional[Dict[str, str]]:
    # Название: короткое имя или полное
    name = (
        company.get("short_name")
        or company.get("name")
        or company.get("title")
        or ""
    ).strip()
    if not name:
        return None

    full_name = (
        company.get("name")
        or company.get("full_name")
        or name
    ).strip()

    phone = _first_phone(company)

    address = (
        company.get("address")
        or company.get("legal_address")
        or ""
    )
    city = _extract_city(str(address))

    description = (
        company.get("description")
        or company.get("about")
        or company.get("activity")
        or ""
    ).strip()
    notes = f"{section}: {cat_name}"
    if description:
        notes += ". " + description[:200]
    notes = notes[:255]

    return {
        "name":    name,
        "company": full_name,
        "phone":   phone,
        "city":    city,
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
    """Возвращает множество нормализованных названий компаний уже в таблице."""
    col = ws.col_values(1)   # колонка name
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
    # Структура: 1=name  2=company  3=phone  4=city  5=status  6=next_call  7=notes
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
    print("   Парсер компаний  export.by API  ->  Google Sheets")
    print("=" * 64)

    email    = input("\nEmail для входа на export.by: ").strip()
    password = input("Пароль: ").strip()
    if not email or not password:
        print("Email и пароль обязательны.")
        sys.exit(1)

    client = ApiClient()

    # 1. Авторизация
    print("\n[1/5] Авторизация...")
    if client.login(email, password):
        print("  OK")
    else:
        print("  Предупреждение: авторизация не подтверждена, продолжаем.")

    # 2. Дерево категорий
    print("\n[2/5] Получение дерева категорий...")
    tree = client.get_tree()
    if not tree:
        print("  Ошибка: не удалось получить дерево категорий.")
        sys.exit(1)

    cat_ids = find_category_ids(tree)
    total_need = sum(len(v) for v in SECTIONS.values())
    print(f"  Найдено {len(cat_ids)} из {total_need} категорий")
    if not cat_ids:
        print("  Ни одна категория не найдена. Проверьте ответ API.")
        sys.exit(1)
    for (sec, cat), cid in sorted(cat_ids.items()):
        print(f"    [{sec}] {cat}  ->  id={cid}")

    # 3. Google Sheets
    print("\n[3/5] Подключение к Google Sheets...")
    ws = get_worksheet()
    existing_names = load_existing_names(ws)
    next_row = last_data_row(ws) + 1
    print(f"  Уже в таблице: {len(existing_names)} записей, новые — с строки {next_row}")

    # 4. Обход компаний
    print("\n[4/5] Парсинг компаний...\n")
    total_added  = 0
    total_skip   = 0
    batch: List[Tuple[int, Dict[str, str]]] = []

    for (section, cat_name), cat_id in cat_ids.items():
        print(f"  ▸ [{section}] {cat_name}  (id={cat_id})")
        page      = 1
        cat_added = 0

        while True:
            resp = client.get_companies_page(cat_id, page)
            if resp is None:
                break

            # Нормализуем структуру ответа
            items      = (
                resp.get("data")
                or resp.get("items")
                or resp.get("companies")
                or (resp if isinstance(resp, list) else [])
            )
            meta       = resp.get("meta") or resp.get("pagination") or {}
            last_page  = (
                meta.get("last_page")
                or meta.get("total_pages")
                or meta.get("pageCount")
                or 1
            )

            if not items:
                break

            print(f"    стр.{page}/{last_page}: {len(items)} компаний")

            for item in items:
                company_id = item.get("id") or item.get("company_id")

                # Подробности (если в листинге нет полного набора полей)
                if company_id and not item.get("description") and not item.get("phones"):
                    details = client.get_company(int(company_id))
                    if details:
                        # Мержим: детали приоритетнее листинга
                        company_data = {**item, **details}
                    else:
                        company_data = item
                else:
                    company_data = item

                lead = build_lead(company_data, section, cat_name)
                if not lead:
                    continue

                # Проверка дублей
                if _norm(lead["name"]) in existing_names:
                    total_skip += 1
                    continue

                existing_names.add(_norm(lead["name"]))
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
                    print(f"      → Записано в таблицу: {total_added} итого")

            if page >= int(last_page):
                break
            page += 1

        print(f"    Добавлено в категории: {cat_added}\n")

    # 5. Финальный flush
    if batch:
        flush_batch(ws, batch)
        total_added += len(batch)

    print("=" * 64)
    print(f"  Готово. Добавлено: {total_added}  |  Пропущено (дубли): {total_skip}")
    print("=" * 64)


if __name__ == "__main__":
    main()
