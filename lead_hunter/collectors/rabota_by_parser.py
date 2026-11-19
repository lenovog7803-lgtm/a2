"""
Парсер свежих вакансий Минска (area=1002) за 24 часа через rabota.by (API + graceful HTML fallback).
Ищет компании, нанимающие селлеров WB/Ozon, логистов ВЭД и специалистов по экспорту в РФ.
"""

import time
import logging
import urllib.parse
from typing import List, Dict, Any
import requests
from bs4 import BeautifulSoup

from lead_hunter.services.phone_enricher import normalize_phone, search_unp_and_contacts

logger = logging.getLogger("lead_hunter.rabota_by")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

WB_OZON_QUERIES = [
    "менеджер Wildberries",
    "менеджер Ozon",
    "менеджер маркетплейсов",
    "фулфилмент"
]

B2B_EXPORT_QUERIES = [
    "логист ВЭД",
    "специалист по логистике Россия",
    "экспорт менеджер",
    "снабжение Россия"
]


class RabotaByParser:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8"
        }

    def collect_all_daily(self) -> List[Dict[str, Any]]:
        """Собирает все целевые вакансии по обеим группам за последние 24 часа."""
        leads = []
        seen_companies = set()

        # 1. Группа WB / Ozon
        for q in WB_OZON_QUERIES:
            logger.info(f"[rabota.by] Сбор по запросу WB/Ozon: '{q}'...")
            found = self._fetch_vacancies(q, funnel_hint="WB_OZON")
            for item in found:
                c_key = item.get("company", "").lower()
                if c_key and c_key not in seen_companies:
                    seen_companies.add(c_key)
                    leads.append(item)
            time.sleep(0.5)

        # 2. Группа B2B РФ Экспорт
        for q in B2B_EXPORT_QUERIES:
            logger.info(f"[rabota.by] Сбор по запросу B2B: '{q}'...")
            found = self._fetch_vacancies(q, funnel_hint="B2B_HOT")
            for item in found:
                c_key = item.get("company", "").lower()
                if c_key and c_key not in seen_companies:
                    seen_companies.add(c_key)
                    leads.append(item)
            time.sleep(0.5)

        logger.info(f"[rabota.by] Всего собрано уникальных компаний-работодателей: {len(leads)}")
        return leads

    def _fetch_vacancies(self, query: str, funnel_hint: str) -> List[Dict[str, Any]]:
        """Пытается получить вакансии через API rabota.by, а при 403 — парсит поисковую выдачу."""
        results = []
        
        # 1. Попытка через публичный API rabota.by
        api_url = f"https://api.rabota.by/vacancies?area=1002&period=1&text={urllib.parse.quote(query)}"
        try:
            resp = requests.get(api_url, headers=self.headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("items", []):
                    employer = item.get("employer", {})
                    c_name = employer.get("name")
                    if not c_name:
                        continue
                    
                    vac_title = item.get("name")
                    snippet = item.get("snippet", {})
                    requirement = snippet.get("requirement") or ""
                    responsibility = snippet.get("responsibility") or ""

                    lead = {
                        "company": c_name,
                        "name": c_name,
                        "city": "Минск",
                        "phone": "",
                        "source": "rabota.by",
                        "trigger": f"Вакансия: {vac_title}",
                        "notes": f"Активная вакансия: '{vac_title}'. {responsibility} {requirement}".strip(),
                        "directions": "Минск ↔ Москва/РФ",
                        "funnel_hint": funnel_hint,
                        "industry": "Селлер WB/Ozon (Минск)" if funnel_hint == "WB_OZON" else "B2B Горячие (Минск)"
                    }
                    results.append(lead)
                if results:
                    return results
        except Exception as e:
            logger.debug(f"[rabota.by API] fallback на HTML: {e}")

        # 2. Graceful HTML Fallback через поисковую выдачу rabota.by
        try:
            search_url = f"https://rabota.by/search/vacancy?area=1002&search_period=1&text={urllib.parse.quote(query)}"
            r = requests.get(search_url, headers=self.headers, timeout=6)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                vac_links = soup.find_all("a", href=lambda h: h and "/vacancy/" in h)
                
                for a in vac_links:
                    vac_title = a.text.strip()
                    if not vac_title:
                        continue
                    
                    # Ищем родительскую карточку
                    card = a.find_parent("div", class_=lambda c: c and any(k in str(c) for k in ("serp", "card", "item"))) or a.parent.parent
                    emp_tag = card.find("a", href=lambda h: h and "/employer/" in h) if card else None
                    c_name = emp_tag.text.strip() if emp_tag else None
                    
                    if not c_name:
                        # Пробуем найти текст компании
                        c_div = card.find("div", class_=lambda c: c and "employer" in str(c)) if card else None
                        c_name = c_div.text.strip() if c_div else None

                    if not c_name or "wildberries" in c_name.lower() or "ozon" in c_name.lower():
                        # Пропускаем сами маркетплейсы (они не клиенты на грузоперевозку)
                        continue

                    # Пропускаем ПВЗ (пункты выдачи заказов - они не возят сборные грузы на склады РФ)
                    if "пвз" in vac_title.lower() or "пункт выдачи" in vac_title.lower():
                        continue

                    lead = {
                        "company": c_name,
                        "name": c_name,
                        "city": "Минск",
                        "phone": "",
                        "source": "rabota.by",
                        "trigger": f"Вакансия: {vac_title}",
                        "notes": f"Компания ищет в Минске: '{vac_title}'. Ссылка: {a.get('href', '')}".strip(),
                        "directions": "Минск ↔ РФ",
                        "funnel_hint": funnel_hint,
                        "industry": "WB/Ozon (Минск)" if funnel_hint == "WB_OZON" else "B2B Горячие (Минск)"
                    }
                    results.append(lead)
        except Exception as e:
            logger.warning(f"[rabota.by HTML] ошибка парсинга: {e}")

        return results
