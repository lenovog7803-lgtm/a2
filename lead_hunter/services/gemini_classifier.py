"""
AI-квалификация, скоринг горячести (1-100) и генерация питч-скриптов через Google Gemini API.
"""

import time
import json
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types

from lead_hunter.config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    MINSK_ALLOWED_KEYWORDS,
    NON_MINSK_STOPWORDS,
    TEST_GARBAGE_STOPWORDS,
    COMPETITOR_STOPWORDS,
    STATE_GOV_STOPWORDS,
    is_state_or_budget_org,
    is_service_agency
)
from lead_hunter.schemas import GeminiBatchQualification, GeminiBatchItem

logger = logging.getLogger("lead_hunter.gemini")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


class GeminiClassifier:
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = (api_key or GEMINI_API_KEY).strip()
        if not self.api_key:
            logger.warning("GEMINI_API_KEY не задан! Классификация будет использовать эвристический fallback.")
            self.client = None
        else:
            # Инициализация официального SDK google-genai с v1beta для Structured JSON
            self.client = genai.Client(api_key=self.api_key, http_options={"api_version": "v1beta"})

        self.model_name = (model_name or GEMINI_MODEL).strip() or "gemini-2.5-flash-lite"
        self.fallback_models = ["gemini-2.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-pro"]

    def pre_filter_fast(self, lead: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Быстрый предварительный фильтр на базе регулярных выражений и стоп-слов.
        Если компания заведомо не из Минска, является перевозчиком или тестовым мусором —
        отсеиваем до запроса к Gemini, экономя токены и время.
        """
        name = str(lead.get("name") or "").lower()
        company = str(lead.get("company") or "").lower()
        city = str(lead.get("city") or "").lower()
        industry = str(lead.get("industry") or "").lower()
        notes = str(lead.get("notes") or "").lower()
        directions = str(lead.get("directions") or "").lower()
        phone = str(lead.get("phone") or "")

        full_text = f"{name} {company} {city} {industry} {notes} {directions}"

        # 1. Проверка на тестовый мусор
        for stop in TEST_GARBAGE_STOPWORDS:
            if stop in name or stop in company or stop in notes:
                return {
                    "is_minsk": False,
                    "is_valid_shipper": False,
                    "funnel": "ARCHIVE",
                    "heat_score": 0,
                    "niche": "Мусор",
                    "pitch_script": "",
                    "disqualification_reason": f"Тестовая запись / мусор ({stop})"
                }

        # 2. Номер телефона: если указан, но содержит явный огрызок (меньше 6 цифр)
        if phone:
            clean_digits = "".join(filter(str.isdigit, phone))
            if 0 < len(clean_digits) < 6:
                return {
                    "is_minsk": False,
                    "is_valid_shipper": False,
                    "funnel": "ARCHIVE",
                    "heat_score": 0,
                    "niche": "Некорректный номер",
                    "pitch_script": "",
                    "disqualification_reason": "Некорректный номер телефона (менее 6 цифр)"
                }

        # 3. Проверка на конкурентов (перевозчики, экспедиторы, курьеры)
        for comp_word in COMPETITOR_STOPWORDS:
            if comp_word in company or comp_word in industry or comp_word in notes:
                return {
                    "is_minsk": False,
                    "is_valid_shipper": False,
                    "funnel": "ARCHIVE",
                    "heat_score": 0,
                    "niche": "Конкурент",
                    "pitch_script": "",
                    "selection_reason": "",
                    "disqualification_reason": f"Перевозчик/экспедитор/курьер ({comp_word})"
                }

        # 4. Проверка на госорганизации и бюджетные учреждения (СТРОГО ЗАПРЕЩЕНО)
        if is_state_or_budget_org(full_text):
            return {
                "is_minsk": True,
                "is_valid_shipper": False,
                "funnel": "ARCHIVE",
                "heat_score": 0,
                "niche": "Госорганизация",
                "pitch_script": "",
                "selection_reason": "",
                "disqualification_reason": "Госорганизация / бюджетное или научное учреждение"
            }

        # 5. Проверка на сервисные агентства (IT, маркетинг, консалтинг)
        if is_service_agency(full_text):
            return {
                "is_minsk": True,
                "is_valid_shipper": False,
                "funnel": "ARCHIVE",
                "heat_score": 0,
                "niche": "Сервисные услуги",
                "pitch_script": "",
                "selection_reason": "",
                "disqualification_reason": "Сервисное агентство / IT / реклама (нет физических грузов)"
            }

        # 4. Проверка на явный Не-Минск (Гомель, Брест, Гродно, Витебск, Могилев, Лида, Москва и др.)
        # Проверяем поле city в первую очередь
        if city:
            is_minsk_city = any(m in city for m in MINSK_ALLOWED_KEYWORDS)
            if not is_minsk_city:
                for non_minsk in NON_MINSK_STOPWORDS:
                    if non_minsk in city:
                        return {
                            "is_minsk": False,
                            "is_valid_shipper": True,
                            "funnel": "ARCHIVE",
                            "heat_score": 10,
                            "niche": "Регион РБ/РФ",
                            "pitch_script": "",
                            "disqualification_reason": f"Не Минск (город: {city})"
                        }

        # Если в тексте явно фигурирует областной центр, и ни одного упоминания Минска
        has_non_minsk = any(f" {nm} " in f" {full_text} " for nm in NON_MINSK_STOPWORDS)
        has_minsk = any(m in full_text for m in MINSK_ALLOWED_KEYWORDS)
        if has_non_minsk and not has_minsk:
            return {
                "is_minsk": False,
                "is_valid_shipper": True,
                "funnel": "ARCHIVE",
                "heat_score": 15,
                "niche": "Регион РБ/РФ",
                "pitch_script": "",
                "disqualification_reason": "Геолокация вне Минского региона"
            }

        return None

    def classify_batch(self, batch_leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Батчевая AI-квалификация (25–35 компаний за один запрос) с экспоненциальным backoff.
        Возвращает список результатов для каждой компании в том же порядке.
        """
        if not batch_leads:
            return []

        results = [None] * len(batch_leads)
        pending_indices = []

        # 1. Быстрый локальный фильтр
        for idx, lead in enumerate(batch_leads):
            fast_res = self.pre_filter_fast(lead)
            if fast_res:
                results[idx] = fast_res
            else:
                pending_indices.append(idx)

        # Если все отсеялись пре-фильтром — сразу возвращаем
        if not pending_indices:
            return results

        # Если нет клиента Gemini — применяем эвристику
        if not self.client:
            for idx in pending_indices:
                results[idx] = self._heuristic_qualification(batch_leads[idx])
            return results

        # 2. Формируем список для отправки в Gemini
        items_payload = []
        for p_idx in pending_indices:
            lead = batch_leads[p_idx]
            items_payload.append({
                "index": p_idx,
                "company": lead.get("company") or lead.get("name") or "",
                "city": lead.get("city") or "Минск",
                "industry": lead.get("industry") or "",
                "notes": lead.get("notes") or "",
                "directions": lead.get("directions") or "",
                "trigger": lead.get("trigger") or lead.get("source") or ""
            })

        system_prompt = (
            "Ты — ведущий AI-аналитик логистической компании А2 Group (Минск, грузоперевозки РБ ↔ РФ: сборные LTL, FTL, догрузы).\n"
            "Твоя задача — строго квалифицировать каждую компанию из переданного JSON-списка и распределить по воронкам:\n\n"
            "ПРАВИЛА КВАЛИФИКАЦИИ:\n"
            "1. География (is_minsk): СТРОГО Минск или Минский район (МКАД, Колядичи, Боровляны, Ждановичи, Гатово, Привольный, Фаниполь, Заславль). "
            "Если компания из Гомеля, Бреста, Гродно, Витебска, Могилева, России — is_minsk=false и funnel='ARCHIVE'.\n"
            "2. Грузовладелец (is_valid_shipper): ДОЛЖЕН быть прямым производителем, селлером или импортером. "
            "Экспедиторы, транспортные компании, курьеры — is_valid_shipper=false и funnel='ARCHIVE'.\n"
            "3. СТРОГИЙ ЗАПРЕТ НА ГОССТРУКТУРЫ: Никаких поликлиник, больниц, университетов, институтов, РУП, КУП, ГУ, министерств и госорганов! "
            "Брать ИСКЛЮЧИТЕЛЬНО частный коммерческий сектор (ООО, ЧТУП, ЗАО, ИП). Все госструктуры — funnel='ARCHIVE'!\n"
            "4. Воронки (funnel):\n"
            "   - 'WB_OZON': Белорусские селлеры Wildberries / Ozon, бренды одежды, обуви, косметики, фулфилменты в Минске (под сборные рейсы Минск -> Москва).\n"
            "   - 'B2B_HOT': Минские частные заводы, производители и дистрибьюторы FMCG, упаковки, продуктов, стройматериалов, автозапчастей, химии с постоянными отправками в РФ.\n"
            "   - 'B2B_WARM': Прочие потенциальные клиенты Минска.\n"
            "   - 'ARCHIVE': Не Минск, мусор, физлица, госорганизации, конкуренты-перевозчики.\n"
            "5. Скоринг (heat_score от 1 до 100):\n"
            "   - 85-100: Прямо сейчас ищет доставку на маркетплейсы РФ, есть свежая вакансия ВЭД/логиста/селлера или сертификат ЕАЭС.\n"
            "   - 60-84: Целевая ниша FMCG, одежды, косметики, запчастей в Минске.\n"
            "   - <60: Низкий приоритет.\n"
            "6. Питч-скрипт (pitch_script):\n"
            "   - Для WB_OZON: 'Добрый день! Возим регулярные сборные грузы из Минска на склады Wildberries и Ozon (Коледино, Электросталь, Подольск) точно в тайм-слоты без штрафов и очередей. Сколько поставок в неделю сейчас отправляете в РФ?'\n"
            "   - Для B2B_HOT: 'Здравствуйте! Предоставляем проверенный транспорт под ваши поставки на РФ с фиксированной ставкой и гарантией подачи авто. Какие направления в Россию у вас сейчас самые регулярные?'\n"
            "7. Обоснование отбора (selection_reason): Четко укажи 1 емким предложением, ПОЧЕМУ взят клиент (например: 'Частный производитель гофроупаковки в Минске, регулярные отгрузки на заводы РФ')."
        )

        user_content = f"Квалифицируй следующие {len(items_payload)} компаний:\n" + json.dumps(items_payload, ensure_ascii=False)

        # Вызов Gemini с повторными попытками (backoff)
        max_retries = 3
        backoff_sec = 2.0
        parsed_batch = None

        for attempt in range(max_retries):
            # Пробуем основную модель или fallback
            model_to_use = self.model_name
            if attempt == 1 and len(self.fallback_models) > 0:
                model_to_use = self.fallback_models[0]
            elif attempt >= 2 and len(self.fallback_models) > 1:
                model_to_use = self.fallback_models[1]

            try:
                response = self.client.models.generate_content(
                    model=model_to_use,
                    contents=user_content,
                    config={
                        "system_instruction": system_prompt,
                        "response_mime_type": "application/json",
                        "response_schema": GeminiBatchQualification,
                        "temperature": 0.2,
                    }
                )
                if response.text:
                    parsed_batch = GeminiBatchQualification.model_validate_json(response.text)
                    break
            except Exception as e:
                err_msg = str(e)
                logger.warning(f"Ошибка вызова Gemini (попытка {attempt+1}/{max_retries}, модель {model_to_use}): {err_msg}")
                if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "503" in err_msg:
                    time.sleep(backoff_sec)
                    backoff_sec *= 2.0
                elif "404" in err_msg:
                    # Модель недоступна — переключаемся на fallback
                    self.model_name = "gemini-2.5-flash-lite"
                else:
                    time.sleep(1.0)

        # Обработка полученного результата
        if parsed_batch and parsed_batch.items:
            for item in parsed_batch.items:
                if 0 <= item.index < len(results):
                    results[item.index] = {
                        "is_minsk": item.is_minsk,
                        "is_valid_shipper": item.is_valid_shipper,
                        "funnel": item.funnel,
                        "heat_score": item.heat_score,
                        "niche": item.niche,
                        "pitch_script": item.pitch_script,
                        "disqualification_reason": item.disqualification_reason or ""
                    }

        # Для тех, кто по какой-то причине остался пустым (таймаут/сбой) — заполняем эвристикой
        for idx in pending_indices:
            if results[idx] is None:
                results[idx] = self._heuristic_qualification(batch_leads[idx])

        return results

    def _heuristic_qualification(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        """Локальная эвристическая квалификация при недоступности сети/API."""
        full_text = f"{lead.get('name','')} {lead.get('company','')} {lead.get('industry','')} {lead.get('notes','')}".lower()
        
        is_wb = any(w in full_text for w in ["wildberries", "вайлдберриз", "вайлдбериз", "ozon", "озон", "маркетплейс", "фулфилмент"])
        
        if is_wb:
            return {
                "is_minsk": True,
                "is_valid_shipper": True,
                "funnel": "WB_OZON",
                "heat_score": 88,
                "niche": "Селлер WB/Ozon",
                "pitch_script": "Добрый день! Возим сборные грузы из Минска на склады Wildberries и Ozon (Коледино, Электросталь, Подольск) точно в слоты без штрафов. Как часто делаете поставки в РФ?",
                "disqualification_reason": ""
            }
        
        return {
            "is_minsk": True,
            "is_valid_shipper": True,
            "funnel": "B2B_HOT",
            "heat_score": 75,
            "niche": lead.get("industry") or "B2B Производство/Торговля",
            "pitch_script": "Здравствуйте! Предоставляем проверенный транспорт под ваши поставки на РФ с фиксированной ставкой и гарантией подачи авто. Какие направления в РФ у вас самые регулярные?",
            "disqualification_reason": ""
        }
