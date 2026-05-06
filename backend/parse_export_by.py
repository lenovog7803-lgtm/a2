#!/usr/bin/env python3
"""
Парсер компаний с export.by -> Google Sheets "Обзвон для срм"

Авторизуется на сайте, обходит все указанные категории бытовых и
промышленных товаров, собирает контакты компаний и записывает их
в лист "Обзвон для срм" Google Sheets.
"""

import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
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
LOGIN_URL = f"{BASE_URL}/login"
DELAY     = 1.0   # секунд между HTTP-запросами

# Категории для парсинга: раздел -> список подкатегорий
SECTIONS: Dict[str, List[str]] = {
    "Бытовые товары": [
        "Автотовары", "Аксессуары и украшения", "Все для отпуска", "Дом и сад",
        "Домашние животные и зоотовары", "Инструмент", "Канцтовары", "Красота и здоровье",
        "Материалы для ремонта", "Медикаменты и медицинские товары", "Одежда и обувь",
        "Подарки хобби книги", "Продукты питания напитки", "Прочее", "Спорт и отдых",
        "Строительство", "Техника и электроника", "Товары для детей",
    ],
    "Промышленные товары": [
        "Авиа ж/д водный транспорт", "Безопасность и защита", "Грузовики автобусы спецтехника",
        "Изделия из металла пластика резины", "Контрольно-измерительные приборы",
        "Медицинское оборудование", "Недвижимость", "Неликвидные запасы",
        "Оборудование и товары для услуг", "Отопление", "Промышленная химия",
        "Промышленное оборудование и станки", "Сельхозпродукция техника и оборудование",
        "Сырьё и материалы", "Тара и упаковка", "Телекоммуникации и связь", "Электрооборудование",
    ],
}

# Сколько строк накапливать перед batch-записью в Sheets
BATCH_SIZE = 20

# ─── HTTP / авторизация ───────────────────────────────────────────────────────

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    return s


def login(session: requests.Session, email: str, password: str) -> bool:
    resp = session.get(LOGIN_URL, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    # Собираем все hidden-поля формы (CSRF и прочее)
    form_data: Dict[str, str] = {"email": email, "password": password}
    form = soup.find("form")
    if form:
        for inp in form.find_all("input", type="hidden"):
            name = inp.get("name")
            val  = inp.get("value", "")
            if name:
                form_data[name] = val

    time.sleep(DELAY)
    resp2 = session.post(LOGIN_URL, data=form_data, timeout=20, allow_redirects=True)

    text_low = resp2.text.lower()
    # Если появился «выйти» или «logout» — вход успешен
    if "выйти" in text_low or "logout" in text_low or "log out" in text_low:
        return True
    # Если нас не вернули обратно на /login — скорее всего ОК
    if "login" not in resp2.url.lower():
        return True
    return False


def get_page(session: requests.Session, url: str) -> Optional[BeautifulSoup]:
    try:
        time.sleep(DELAY)
        resp = session.get(url, timeout=20)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as exc:
        print(f"    [WARN] {url}: {exc}")
        return None

# ─── Поиск URL категорий ──────────────────────────────────────────────────────

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _abs(href: str) -> str:
    if href.startswith("http"):
        return href
    return BASE_URL + ("" if href.startswith("/") else "/") + href


def find_category_urls(session: requests.Session) -> Dict[Tuple[str, str], str]:
    """
    Возвращает {(раздел, подкатегория): url}.
    Сначала ищет на странице каталога, затем на страницах разделов.
    """
    # Плоский справочник: нормализованное_имя -> (раздел, оригинал)
    lookup: Dict[str, Tuple[str, str]] = {
        _norm(cat): (section, cat)
        for section, cats in SECTIONS.items()
        for cat in cats
    }
    found: Dict[Tuple[str, str], str] = {}

    def scan(soup: BeautifulSoup) -> None:
        for a in soup.find_all("a", href=True):
            key = _norm(a.get_text())
            if key in lookup and lookup[key] not in found:
                found[lookup[key]] = _abs(a["href"])

    # Основная страница каталога
    for catalog_path in ("/catalog", "/tovar", "/catalog/all", "/"):
        soup = get_page(session, BASE_URL + catalog_path)
        if soup:
            scan(soup)
        if len(found) >= sum(len(v) for v in SECTIONS.values()):
            return found

    # Страницы разделов (несколько вариантов транслитерации)
    section_paths = [
        "/bytovyetovary", "/bytovye-tovary", "/bytoviietovary", "/bytoviie-tovary",
        "/byt", "/bytovye",
        "/promyshlennyetovary", "/promyshlennye-tovary", "/prom",
        "/industrial", "/b2b",
    ]
    for path in section_paths:
        if len(found) >= sum(len(v) for v in SECTIONS.values()):
            break
        soup = get_page(session, BASE_URL + path)
        if soup:
            scan(soup)

    return found

# ─── Пагинация и сбор ссылок на компании ─────────────────────────────────────

# Паттерны URL страниц компаний на export.by
_COMPANY_URL_RE = re.compile(
    r"/(company|supplier|firma|organization|profile|vendor|producer|exporter)/[^/?#]+/?$",
    re.IGNORECASE,
)
# Также числовые ID вида /catalog/123456 или /firms/12345
_COMPANY_ID_RE = re.compile(r"/(?:catalog|firms?|org)/\d+/?$", re.IGNORECASE)


def _company_links(soup: BeautifulSoup) -> List[str]:
    links = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if _COMPANY_URL_RE.search(href) or _COMPANY_ID_RE.search(href):
            url = _abs(href).split("?")[0].rstrip("/")
            if url not in seen:
                seen.add(url)
                links.append(url)
    return links


def _next_page(soup: BeautifulSoup) -> Optional[str]:
    # rel="next"
    tag = soup.find("a", rel="next")
    if tag and tag.get("href"):
        return _abs(tag["href"])
    # Текстовые маркеры
    for a in soup.find_all("a", href=True):
        txt = a.get_text().strip()
        if txt in ("Следующая", "следующая", "»", ">", "→", "Далее", "далее"):
            return _abs(a["href"])
    # aria-label="Next"
    tag = soup.find("a", attrs={"aria-label": re.compile(r"next|следующ", re.I)})
    if tag and tag.get("href"):
        return _abs(tag["href"])
    return None


def collect_company_urls(
    session: requests.Session, cat_url: str, label: str
) -> List[str]:
    urls: List[str] = []
    seen: set = set()
    current = cat_url
    page = 1

    while current:
        soup = get_page(session, current)
        if not soup:
            break

        batch = _company_links(soup)
        new = [u for u in batch if u not in seen]
        seen.update(new)
        urls.extend(new)

        print(f"      стр.{page}: +{len(new)} компаний (итого {len(urls)})")

        nxt = _next_page(soup)
        if not nxt or nxt == current:
            break
        current = nxt
        page += 1

    return urls

# ─── Парсинг страницы компании ────────────────────────────────────────────────

_PHONE_RE   = re.compile(r"\+?[\d][\d\s\-\(\)]{6,}\d")
_CITY_RU_RE = re.compile(r"г\.?\s*([А-ЯЁа-яё][А-ЯЁа-яё\-\s]{2,30}?)(?:[,.]|$)")


def _extract_city(text: str) -> str:
    m = _CITY_RU_RE.search(text)
    if m:
        return m.group(1).strip()
    parts = [p.strip() for p in text.split(",")]
    return parts[0][:60] if parts else ""


def scrape_company(
    session: requests.Session, url: str, section: str, cat_name: str
) -> Optional[Dict[str, str]]:
    soup = get_page(session, url)
    if not soup:
        return None

    # ── Название ──────────────────────────────────────────────────────────────
    name = ""
    for sel in ["h1", ".company-name", ".org-name", ".profile-name",
                "[itemprop='name']", ".card-title", ".firm-title"]:
        tag = soup.select_one(sel)
        if tag:
            name = tag.get_text(strip=True)
            break
    if not name:
        title = soup.find("title")
        if title:
            name = title.get_text(strip=True).split("|")[0].split("—")[0].strip()

    if not name:
        return None

    # ── Телефон ───────────────────────────────────────────────────────────────
    phone = ""
    tel_tag = soup.find("a", href=re.compile(r"^tel:"))
    if tel_tag:
        phone = tel_tag["href"].replace("tel:", "").strip()
    if not phone:
        m = _PHONE_RE.search(soup.get_text())
        if m:
            phone = m.group(0).strip()

    # ── Город ─────────────────────────────────────────────────────────────────
    city = ""
    for sel in [".address", "[itemprop='address']", ".location", ".city",
                ".contact-address", ".org-address"]:
        tag = soup.select_one(sel)
        if tag:
            city = _extract_city(tag.get_text(strip=True))
            break
    if not city:
        m = _CITY_RU_RE.search(soup.get_text())
        if m:
            city = m.group(1).strip()

    # ── Описание (первые 200 символов) ────────────────────────────────────────
    description = ""
    for sel in [".description", ".about", ".company-description",
                "[itemprop='description']", ".about-text", ".firm-about"]:
        tag = soup.select_one(sel)
        if tag:
            description = tag.get_text(strip=True)
            break
    if not description:
        meta = soup.find("meta", attrs={"name": "description"})
        if meta:
            description = meta.get("content", "").strip()

    notes = f"{section}: {cat_name}"
    if description:
        clean_desc = description[:200]
        notes = f"{notes}. {clean_desc}"
    notes = notes[:255]

    return {
        "name":    name,
        "company": name,
        "phone":   phone,
        "city":    city,
        "notes":   notes,
        "status":  "new",
    }

# ─── Google Sheets ────────────────────────────────────────────────────────────

# Структура листа "Обзвон для срм" (1-based колонки):
# 1=name  2=company  3=phone  4=city  5=status  6=next_call  7=notes  8=directions
LEADS_DATA_START_ROW = 2


def get_worksheet() -> gspread.Worksheet:
    creds = Credentials.from_service_account_file(str(CREDS_FILE), scopes=SCOPES)
    gc = gspread.authorize(creds)
    ss = gc.open_by_key(SHEET_ID)
    return ss.worksheet("Обзвон для срм")


def last_data_row(ws: gspread.Worksheet) -> int:
    col_vals = ws.col_values(1)
    for i in range(len(col_vals), 0, -1):
        if str(col_vals[i - 1]).strip():
            return i
    return LEADS_DATA_START_ROW - 1


def flush_batch(ws: gspread.Worksheet, rows: List[Tuple[int, Dict[str, str]]]) -> None:
    if not rows:
        return
    updates = []
    col_map = {1: "name", 2: "company", 3: "phone", 4: "city", 7: "notes"}
    for row_num, lead in rows:
        for col, field in col_map.items():
            val = lead.get(field, "")
            if val:
                addr = gspread.utils.rowcol_to_a1(row_num, col)
                updates.append({"range": addr, "values": [[str(val)]]})
        # Статус «Новый» всегда
        addr = gspread.utils.rowcol_to_a1(row_num, 5)
        updates.append({"range": addr, "values": [["Новый"]]})
    ws.batch_update(updates, value_input_option="USER_ENTERED")

# ─── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 62)
    print("   Парсер компаний  export.by  ->  Google Sheets")
    print("=" * 62)

    email    = input("\nEmail для входа на export.by: ").strip()
    password = input("Пароль: ").strip()
    if not email or not password:
        print("Email и пароль обязательны.")
        sys.exit(1)

    # 1. Авторизация
    print("\n[1/4] Авторизация на export.by...")
    session = make_session()
    ok = login(session, email, password)
    print("  Вход выполнен." if ok else "  Предупреждение: не удалось подтвердить вход. Продолжаем.")

    # 2. Поиск URL категорий
    total_cats = sum(len(v) for v in SECTIONS.values())
    print(f"\n[2/4] Поиск URL категорий (всего нужно {total_cats})...")
    cat_urls = find_category_urls(session)
    print(f"  Найдено: {len(cat_urls)} категорий")
    if not cat_urls:
        print("  Не найдено ни одной категории. Проверьте структуру сайта.")
        sys.exit(1)
    for (sec, cat), url in cat_urls.items():
        print(f"    [{sec}] {cat}  ->  {url}")

    # 3. Подключение к Sheets
    print("\n[3/4] Подключение к Google Sheets...")
    ws = get_worksheet()
    next_row = last_data_row(ws) + 1
    print(f"  Запись начнётся со строки {next_row}")

    # 4. Парсинг
    print("\n[4/4] Парсинг компаний...\n")
    total_added = 0
    seen_company_urls: set = set()
    batch: List[Tuple[int, Dict[str, str]]] = []

    for (section, cat_name), cat_url in cat_urls.items():
        print(f"  ▸ [{section}] {cat_name}")
        print(f"    {cat_url}")

        company_urls = collect_company_urls(session, cat_url, f"{section} / {cat_name}")
        new_urls = [u for u in company_urls if u not in seen_company_urls]
        seen_company_urls.update(new_urls)
        print(f"    Новых компаний: {len(new_urls)}")

        for idx, url in enumerate(new_urls, 1):
            lead = scrape_company(session, url, section, cat_name)
            if not lead:
                print(f"    [{idx}/{len(new_urls)}] — пропущено: {url}")
                continue

            batch.append((next_row, lead))
            next_row += 1

            name_short = lead["name"][:45]
            print(f"    [{idx}/{len(new_urls)}] + {name_short:<45} | {lead['city']:<15} | {lead['phone']}")

            # Flush batch to Sheets
            if len(batch) >= BATCH_SIZE:
                flush_batch(ws, batch)
                total_added += len(batch)
                batch = []
                print(f"      → Записано {total_added} компаний в таблицу")

    # Записываем остаток
    if batch:
        flush_batch(ws, batch)
        total_added += len(batch)

    print("\n" + "=" * 62)
    print(f"  Готово. Добавлено компаний в таблицу: {total_added}")
    print("=" * 62)


if __name__ == "__main__":
    main()
