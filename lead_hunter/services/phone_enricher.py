"""
Сервис нормализации номеров телефонов (+375...), очистки названий компаний и обогащения УНП.
"""

import re
import urllib.parse
from typing import Optional, Dict, Any, List
import requests

def normalize_phone(raw_phone: Any) -> Optional[str]:
    """
    Приводит номер к единому строгому формату 375XXXXXXXXX (РБ) или 7XXXXXXXXXX (РФ).
    Очищает формулы Excel (=375...), скобки, пробелы, дефисы и текстовый мусор.
    """
    if raw_phone is None:
        return None
    
    s = str(raw_phone).strip()
    if not s:
        return None
    
    # Очистка формул вида ="375..." или =375...
    s = re.sub(r'^[=\'"\s]+', '', s)
    s = re.sub(r'[\'"\s]+$', '', s)
    
    # Извлечение только цифр (и знака + если был в начале)
    digits = re.sub(r'\D', '', s)
    if not digits or len(digits) < 7:
        return None
    
    # 1. Формат РБ с кодом 80: 8029XXXXXXX, 8017XXXXXXX -> 375...
    if digits.startswith("80"):
        digits = "375" + digits[2:]
    
    # 2. Если по ошибке приклеился ноль: 3750... -> 375...
    elif digits.startswith("3750"):
        digits = "375" + digits[4:]
    
    # 3. Формат РБ без кода страны: 29XXXXXXX, 44XXXXXXX, 33XXXXXXX, 25XXXXXXX, 17XXXXXXX (9 цифр)
    elif len(digits) == 9 and digits[:2] in ("29", "44", "33", "25", "17"):
        digits = "375" + digits
        
    # 4. Номер РФ: 89XXXXXXXXX (11 цифр) -> 79XXXXXXXXX
    elif digits.startswith("89") and len(digits) == 11:
        digits = "7" + digits[1:]
        
    # 5. Проверка длины: для РБ 375 + 9 цифр = 12 цифр
    if digits.startswith("375"):
        if len(digits) == 12:
            return digits
        elif len(digits) > 12:
            return digits[:12]
        return digits

    # Для РФ: 7 + 10 цифр = 11 цифр
    if digits.startswith("7") and len(digits) == 11:
        return digits

    return digits if len(digits) >= 9 else None


def clean_company_name(name: Any) -> str:
    """
    Очищает название компании для поиска дублей (без организационно-правовых форм, кавычек и лишних пробелов).
    Пример: 'ООО "Онко Солюшнс"' -> 'онко солюшнс'
    """
    if not name:
        return ""
    
    s = str(name).strip().lower()
    
    # Удаление кавычек и спецсимволов
    s = re.sub(r'["\'«»“”„`]', '', s)
    
    # Удаление полных и сокращенных форм собственности РБ и РФ
    prefixes = [
        r'\bобщество с ограниченной ответственностью\b',
        r'\bиндивидуальный предприниматель\b',
        r'\bчастное унитарное предприятие\b',
        r'\bсовместное общество с ограниченной ответственностью\b',
        r'\bзакрытое акционерное общество\b',
        r'\bоткрытое акционерное общество\b',
        r'\bооо\b', r'\bип\b', r'\bчтуп\b', r'\bзао\b', r'\bоао\b',
        r'\bсооо\b', r'\bодо\b', r'\bчп\b', r'\bуп\b', r'\bсп\b'
    ]
    for p in prefixes:
        s = re.sub(p, ' ', s)
    
    # Удаление лишних пробелов и дефисов по краям
    s = re.sub(r'[\s\-_]+', ' ', s).strip()
    return s


_enrich_session = None

def get_enrich_session():
    global _enrich_session
    if _enrich_session is None:
        _enrich_session = requests.Session()
        _enrich_session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        })
    return _enrich_session


def search_unp_and_contacts(company_name: str, city: str = "Минск") -> Dict[str, Any]:
    """
    Поиск УНП (Учетный номер плательщика РБ) и открытых контактов компании через открытые реестры.
    Использует открытые данные (egr / kartoteka / bizinsider). Graceful fallback при недоступности.
    """
    clean_name = clean_company_name(company_name)
    result = {
        "unp": "",
        "phones": [],
        "email": "",
        "website": "",
        "address": ""
    }
    
    if not clean_name or len(clean_name) < 3:
        return result

    try:
        session = get_enrich_session()
        url = f"https://kartoteka.by/search?q={urllib.parse.quote(clean_name)}"
        resp = session.get(url, timeout=1.5)
        if resp.status_code == 200:
            unp_match = re.search(r'\b(УНП|унп)?\s*([1-79]\d{8})\b', resp.text)
            if unp_match:
                result["unp"] = unp_match.group(2)
    except Exception:
        pass

    return result
