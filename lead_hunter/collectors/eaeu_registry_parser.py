"""
Парсер свежих деклараций и сертификатов соответствия ЕАЭС (Беларусь, г. Минск).
Декларация ЕАЭС — прямой индикатор того, что компания производит или импортирует продукцию
для обращения на рынках Беларуси и России (одежда, косметика, FMCG, упаковка, автокомпоненты).
"""

import logging
from typing import List, Dict, Any
import requests

from lead_hunter.services.phone_enricher import clean_company_name

logger = logging.getLogger("lead_hunter.eaeu")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Целевые категории ТН ВЭД / продукции
TARGET_EAEU_CATEGORIES = [
    {"niche": "Одежда/Текстиль", "product": "Изделия трикотажные, швейные, обувь (ТР ТС 017/2011)"},
    {"niche": "Косметика/Парфюмерия", "product": "Парфюмерно-косметическая продукция (ТР ТС 009/2011)"},
    {"niche": "FMCG/Продукты", "product": "Пищевая продукция, напитки (ТР ТС 021/2011)"},
    {"niche": "Химия/Упаковка", "product": "Упаковка и укупорочные средства (ТР ТС 005/2011)"},
    {"niche": "Запчасти/Оборудование", "product": "Безопасность колесных транспортных средств (ТР ТС 018/2011)"}
]


class EaeuRegistryParser:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*"
        })

    def collect_recent_declarations(self) -> List[Dict[str, Any]]:
        """
        Запрашивает открытый API Единого реестра деклараций ЕАЭС по юрадресам в г. Минске.
        В случае недоступности внешнего портала или смены протокола используется graceful fallback.
        """
        logger.info("[ЕАЭС Реестр] Запуск проверки свежих деклараций соответствия по г. Минску...")
        collected = []

        # Открытый шлюз Единого реестра сертификатов и деклараций ЕАЭС
        base_api = "https://pub.fsa.gov.ru/api/v1/rds/common/declarations"
        
        try:
            # Попытка запроса с фильтром по юрадресу заявителя "Минск" и статусу "Действует"
            payload = {
                "size": 25,
                "page": 0,
                "filter": {
                    "status": ["active"],
                    "applicant": {"address": "Минск"}
                }
            }
            resp = self.session.post(base_api, json=payload, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("items", []):
                    applicant = item.get("applicantName") or item.get("declarantName")
                    if not applicant:
                        continue
                    
                    prod_name = item.get("productName") or "Товары народного потребления"
                    decl_number = item.get("number") or ""
                    
                    collected.append({
                        "company": applicant,
                        "name": applicant,
                        "city": "Минск",
                        "phone": item.get("applicantPhone") or "",
                        "source": "ЕАЭС Реестр",
                        "trigger": f"Декларация ЕАЭС: {decl_number}",
                        "notes": f"Оформлена декларация соответствия ЕАЭС на продукцию: {prod_name}".strip(),
                        "directions": "Минск ↔ РФ (ЕАЭС)",
                        "funnel_hint": "B2B_HOT",
                        "industry": "B2B Горячие (Минск)"
                    })
                if collected:
                    logger.info(f"[ЕАЭС Реестр] Найдено {len(collected)} актуальных минских деклараций.")
                    return collected
        except Exception as e:
            logger.debug(f"[ЕАЭС Реестр] Внешний API pub.fsa.gov.ru недоступен ({e}). Активирован graceful fallback.")

        # Graceful fallback: если государственный портал под капчей или меняет вёрстку
        logger.info("[ЕАЭС Реестр] Внешний реестр временно недоступен или изменил схему API. Пайплайн продолжит работу.")
        return collected
