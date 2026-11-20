"""
Парсер белорусских предприятий-экспортеров с Национального портала export.by.
Собирает реальных производителей и экспортеров РБ с проверенными телефонными номерами (+375...),
официальными сайтами и описанием поставляемой продукции.
"""

import time
import logging
from typing import List, Dict, Any, Optional
import requests
import urllib3

from lead_hunter.services.phone_enricher import normalize_phone, clean_company_name
from lead_hunter.config import is_state_or_budget_org, COMPETITOR_STOPWORDS

urllib3.disable_warnings()

logger = logging.getLogger("lead_hunter.export_by")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

BASE_URL = "https://export.by"


class ExportByParser:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Referer": "https://export.by/"
        })

    def collect_export_companies(self, target_count: int = 40, max_pages: int = 15) -> List[Dict[str, Any]]:
        """
        Собирает предприятия-экспортеры из Беларуси с подтвержденными телефонными номерами.
        """
        logger.info(f"[export.by] Старт сбора целевых экспортеров (цель: {target_count} компаний)...")
        results = []
        seen_names = set()

        for page in range(1, max_pages + 1):
            if len(results) >= target_count:
                break

            try:
                url = f"{BASE_URL}/back/search/company?page={page}"
                resp = self.session.get(url, verify=False, timeout=10)
                if resp.status_code != 200:
                    logger.warning(f"[export.by] Страница {page} вернула статус {resp.status_code}")
                    break

                items = resp.json()
                if not isinstance(items, list) or not items:
                    logger.info(f"[export.by] Достигнут конец списка на стр. {page}")
                    break

                for item in items:
                    if len(results) >= target_count:
                        break

                    c_id = item.get("id")
                    name = item.get("name") or item.get("short_name") or ""
                    country = str(item.get("country") or "").strip()

                    # Фильтруем только Беларусь
                    if country and "беларусь" not in country.lower() and "belarus" not in country.lower():
                        continue

                    # Проверка на госорганизации
                    if is_state_or_budget_org(name):
                        continue

                    # Проверка на конкурентов-перевозчиков
                    name_lower = name.lower()
                    if any(comp in name_lower for comp in COMPETITOR_STOPWORDS):
                        continue

                    clean_name = clean_company_name(name)
                    if clean_name in seen_names or len(clean_name) < 3:
                        continue

                    # Запрос детальной карточки компании для получения проверенного телефона и сайта
                    det = self._fetch_company_details(c_id)
                    if not det:
                        continue

                    phones = det.get("phone") or det.get("phones") or []
                    raw_phone = phones[0] if isinstance(phones, list) and phones else str(phones)
                    norm_phone = normalize_phone(raw_phone)

                    # ЖЕСТКОЕ ПРАВИЛО: только компании с валидным номером РБ (+375...)
                    if not norm_phone or not norm_phone.startswith("375") or len(norm_phone) < 11:
                        continue

                    website = str(det.get("website") or det.get("site") or "").strip()
                    if website and not website.startswith("http"):
                        website = f"https://{website}"

                    address = str(det.get("address") or "").strip()
                    desc = str(det.get("description") or "").replace("<br/>", " ").replace("<p>", "").replace("</p>", "").strip()
                    email = str(det.get("email") or "").strip()

                    # Город
                    city = "Минск"
                    if "минск" in address.lower() or "минский" in address.lower() or "боровая" in address.lower() or "ратомка" in address.lower() or "фаниполь" in address.lower():
                        city = "Минск"
                    elif address:
                        # Если другой город РБ, отмечаем
                        city_match = address.split(",")
                        if len(city_match) > 1:
                            city = city_match[1].strip()

                    lead = {
                        "company": name,
                        "name": det.get("short_name") or name,
                        "city": city,
                        "phone": norm_phone,
                        "email": email,
                        "website": website,
                        "address": address,
                        "source": "export.by",
                        "source_url": f"https://export.by/companies?id={c_id}",
                        "trigger": "Экспортёр РБ (Национальный портал export.by)",
                        "notes": f"Экспортёр РБ. Продукция: {desc[:250]}".strip(),
                        "directions": "Минск ↔ РФ / ЕАЭС",
                        "funnel_hint": "B2B_HOT",
                        "industry": "B2B Горячие (Минск)"
                    }

                    seen_names.add(clean_name)
                    results.append(lead)
                    time.sleep(0.15)

            except Exception as e:
                logger.error(f"[export.by] Ошибка на стр. {page}: {e}")
                time.sleep(1)

        logger.info(f"[export.by] Собрано {len(results)} валидных предприятий-экспортеров с проверенными телефонами.")
        return results

    def _fetch_company_details(self, company_id: int) -> Optional[Dict[str, Any]]:
        """Получает карточку компании с контактами."""
        try:
            url = f"{BASE_URL}/back/company/get/{company_id}"
            resp = self.session.get(url, verify=False, timeout=5)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return None
