"""
Ежедневный автономный пайплайн сбора, обогащения и квалификации лидов (daily_harvest):
1. Сбор свежих целевых компаний через rabota.by (вакансии 24ч), export.by (экспортёры РБ) и реестры ЕАЭС.
2. Строгая калибровка квоты: ровно 30–45 целевых клиентов в день.
3. 100% валидация телефонов: лиды без подтвержденного номера (+375...) отправляются в архив,
   в базе обзвона (db.leads) ВСЕГДА только актуальные номера.
4. AI-скоринг через Gemini и генерация персонального питча.
5. Загрузка в CRM (db.leads) и утренний Telegram-дайджест директору (08:35).
"""

import time
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone

from lead_hunter.services.mongo_client import HunterMongoClient
from lead_hunter.services.gemini_classifier import GeminiClassifier
from lead_hunter.services.sheets_client import HunterSheetsClient
from lead_hunter.services.telegram_notifier import TelegramNotifier
from lead_hunter.services.phone_enricher import normalize_phone, is_valid_phone, clean_company_name, search_unp_and_contacts
from lead_hunter.collectors.rabota_by_parser import RabotaByParser
from lead_hunter.collectors.export_by_parser import ExportByParser
from lead_hunter.collectors.eaeu_registry_parser import EaeuRegistryParser
from lead_hunter.config import is_state_or_budget_org

logger = logging.getLogger("lead_hunter.daily")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Строгая дневная квота лидов для базы обзвона
TARGET_MIN = 30
TARGET_MAX = 45


def run_daily_harvest() -> Dict[str, Any]:
    """Запуск ежедневного цикла сбора и квалификации новых лидов (квота 30-45)."""
    logger.info("=== СТАРТ ЕЖЕДНЕВНОГО ПАРСЕРА ЛИДОВ (DAILY HARVEST) ===")
    start_time = time.time()

    mongo = HunterMongoClient()
    classifier = GeminiClassifier()
    sheets = HunterSheetsClient()
    notifier = TelegramNotifier()

    sheets.ensure_worksheets()

    stats = {
        "total": 0,
        "wb_ozon": 0,
        "b2b_hot": 0,
        "archived": 0,
        "duplicates_skipped": 0,
    }

    # 1. Запуск сборщиков лидов
    raw_candidates: List[Dict[str, Any]] = []

    # 1.1 rabota.by (вакансии селлеров WB/Ozon и менеджеров ВЭД за 24ч)
    try:
        rabota_parser = RabotaByParser()
        vac_leads = rabota_parser.collect_all_daily()
        raw_candidates.extend(vac_leads)
        logger.info(f"[rabota.by] Собрано {len(vac_leads)} кандидатов")
    except Exception as e:
        logger.error(f"Ошибка в коллекторе rabota.by: {e}")

    # 1.2 export.by (производители и экспортёры РБ с прямыми номерами)
    try:
        export_parser = ExportByParser()
        exp_leads = export_parser.collect_export_companies(target_count=35, max_pages=8)
        raw_candidates.extend(exp_leads)
        logger.info(f"[export.by] Собрано {len(exp_leads)} проверенных предприятий")
    except Exception as e:
        logger.error(f"Ошибка в коллекторе export.by: {e}")

    # 1.3 ЕАЭС декларации соответствия
    try:
        eaeu_parser = EaeuRegistryParser()
        decl_leads = eaeu_parser.collect_recent_declarations()
        raw_candidates.extend(decl_leads)
    except Exception as e:
        logger.error(f"Ошибка в коллекторе ЕАЭС: {e}")

    stats["total"] = len(raw_candidates)
    logger.info(f"Всего собрано кандидатов из внешних источников: {len(raw_candidates)}")

    if not raw_candidates:
        logger.info("Новых кандидатов не обнаружено.")
        notifier.send_message("ℹ️ <b>Lead Hunter (08:35):</b> Новых кандидатов за последние 24ч не обнаружено.")
        return stats

    # 2. Обогащение, дедупликация и ЖЕСТКИЙ фильтр по наличию телефона
    filtered_candidates = []
    seen_in_run = set()

    for item in raw_candidates:
        c_name = item.get("company") or item.get("name") or ""
        clean_name = clean_company_name(c_name)
        if not clean_name or len(clean_name) < 3:
            continue

        if is_state_or_budget_org(c_name):
            stats["archived"] += 1
            continue

        if clean_name in seen_in_run:
            continue
        seen_in_run.add(clean_name)

        current_phone = item.get("phone")
        norm_phone = normalize_phone(current_phone)

        # Быстрая проверка на дубликат по имени/телефону в CRM и архиве
        if mongo.is_duplicate(norm_phone, clean_name):
            stats["duplicates_skipped"] += 1
            continue

        # Для уникальных кандидатов пробуем обогатить УНП и контакты
        enriched = search_unp_and_contacts(c_name, city=item.get("city", "Минск"))
        if enriched.get("unp"):
            item["unp"] = enriched["unp"]
        if not norm_phone and enriched.get("phones"):
            norm_phone = normalize_phone(enriched["phones"][0])

        # ЖЕСТКОЕ ПРАВИЛО: если телефона нет или он некорректный — лид уходит в архив
        if not is_valid_phone(norm_phone):
            stats["archived"] += 1
            mongo.move_to_archive(item.get("id", ""), "Нет контактного номера телефона", item)
            continue

        item["phone"] = norm_phone
        filtered_candidates.append(item)

    # Добор до квоты (минимум 30 кандидатов), если после дедупликации осталось мало
    if len(filtered_candidates) < TARGET_MIN:
        needed = TARGET_MIN - len(filtered_candidates) + 10
        logger.info(f"Кандидатов меньше квоты ({len(filtered_candidates)} < {TARGET_MIN}). Добираем еще {needed} с export.by...")
        try:
            extra_exp = export_parser.collect_export_companies(target_count=needed, max_pages=20)
            for item in extra_exp:
                c_name = item.get("company") or item.get("name") or ""
                clean_name = clean_company_name(c_name)
                if clean_name in seen_in_run or not is_valid_phone(item.get("phone")):
                    continue
                seen_in_run.add(clean_name)
                if not mongo.is_duplicate(item.get("phone"), clean_name):
                    filtered_candidates.append(item)
                    if len(filtered_candidates) >= TARGET_MIN:
                        break
        except Exception as e:
            logger.error(f"Ошибка при доборе кандидатов: {e}")

    logger.info(f"После дедупликации и фильтра телефонов отобрано {len(filtered_candidates)} уникальных компаний.")

    if not filtered_candidates:
        notifier.send_message(
            f"ℹ️ <b>Lead Hunter (08:35):</b> Собрано {stats['total']} кандидатов, но все они уже есть в CRM или не имеют контактов (дубликаты: {stats['duplicates_skipped']})."
        )
        return stats

    # 3. AI-квалификация через Gemini батчами
    qualifications = classifier.classify_batch(filtered_candidates)

    qualified_docs = []
    rows_wb_sheets = []
    rows_b2b_sheets = []

    for lead, qual in zip(filtered_candidates, qualifications):
        funnel = qual.get("funnel", "ARCHIVE")
        heat_score = qual.get("heat_score", 0)
        niche = qual.get("niche", "B2B")
        pitch = qual.get("pitch_script", "")
        c_name = lead.get("company") or lead.get("name")

        if funnel == "ARCHIVE" or not qual.get("is_minsk") or not qual.get("is_valid_shipper"):
            stats["archived"] += 1
            mongo.move_to_archive(lead.get("id", ""), qual.get("disqualification_reason", "Отсев AI"), lead)
            continue

        reason = qual.get("selection_reason") or f"Частная компания из Минска ({niche}), регулярные отгрузки на РФ"
        website = lead.get("website") or ""
        if website and not website.startswith("http") and not website.lower().startswith("нет"):
            website = f"https://{website}"

        # Форматирование заметок под карточку звонка в CRM
        formatted_notes = (
            f"🎯 Скрипт: {pitch}\n"
            f"💡 Почему взят: {reason}\n"
            f"🔥 Скоринг: {heat_score}/100 | Воронка: {funnel} ({niche})\n"
            f"⚡ Источник: {lead.get('source', '')} ({lead.get('trigger', '')})\n"
            + (f"🌐 Сайт: {website}\n" if website and not website.lower().startswith("нет") else "🌐 Сайт: Нет сайта\n")
            + f"УНП: {lead.get('unp', 'уточняется')}\n"
            f"----------------------------------------\n"
            f"{lead.get('notes', '')}"
        ).strip()

        target_industry = "WB/Ozon (Минск)" if funnel == "WB_OZON" else "B2B Горячие (Минск)"

        lead_doc = {
            **lead,
            "city": lead.get("city") or "Минск",
            "funnel": funnel,
            "heat_score": heat_score,
            "niche": niche,
            "pitch_script": pitch,
            "selection_reason": reason,
            "website": website,
            "industry": target_industry,
            "notes": formatted_notes,
            "stage": "new",
            "next_call": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        qualified_docs.append(lead_doc)

    # 4. Калибровка квоты: сортируем по скорингу и оставляем ровно до TARGET_MAX (45 лидов)
    qualified_docs.sort(key=lambda x: x.get("heat_score", 0), reverse=True)
    if len(qualified_docs) > TARGET_MAX:
        logger.info(f"Квалифицировано {len(qualified_docs)} лидов (больше максимума {TARGET_MAX}). Берём Топ-{TARGET_MAX} самых горячих.")
        qualified_docs = qualified_docs[:TARGET_MAX]

    logger.info(f"Итого отобрано для загрузки в CRM: {len(qualified_docs)} целевых лидов.")

    # 5. Сохранение в MongoDB и Google Sheets
    top_leads = []
    for lead_doc in qualified_docs:
        c_name = lead_doc.get("company") or lead_doc.get("name")
        funnel = lead_doc.get("funnel", "B2B_HOT")
        heat_score = lead_doc.get("heat_score", 0)
        niche = lead_doc.get("niche", "B2B")
        reason = lead_doc.get("selection_reason", "")
        pitch = lead_doc.get("pitch_script", "")
        formatted_notes = lead_doc.get("notes", "")
        website = lead_doc.get("website", "")

        mongo.upsert_lead(lead_doc)

        if funnel == "WB_OZON":
            stats["wb_ozon"] += 1
            rows_wb_sheets.append([
                heat_score, niche, c_name, website, lead_doc.get("contact_person", ""),
                lead_doc.get("phone", ""), lead_doc.get("email", ""), "Минск", "Новый",
                lead_doc.get("source", ""), reason, pitch, formatted_notes,
                datetime.now(timezone.utc).strftime("%Y-%m-%d")
            ])
        else:
            stats["b2b_hot"] += 1
            rows_b2b_sheets.append([
                heat_score, "FTL/LTL РФ", niche, c_name, website, lead_doc.get("contact_person", ""),
                lead_doc.get("phone", ""), lead_doc.get("email", ""), "Минск", "Новый",
                lead_doc.get("source", ""), reason, pitch, formatted_notes,
                datetime.now(timezone.utc).strftime("%Y-%m-%d")
            ])

        # Мгновенный алерт по супер-горячим лидам
        if heat_score >= 85:
            notifier.send_hot_lead_alert(lead_doc)

        top_leads.append(lead_doc)

    # Запись в Google Sheets
    if rows_wb_sheets:
        sheets.append_rows_safe("База_WB_Ozon_Минск", rows_wb_sheets)
    if rows_b2b_sheets:
        sheets.append_rows_safe("Обзвон_Минск_Горячие", rows_b2b_sheets)

    elapsed = round(time.time() - start_time, 1)
    stats["follow_up_count"] = mongo.count_follow_ups_needed()
    logger.info(
        f"=== DAILY HARVEST ЗАВЕРШЕН ({elapsed}s) ===\n"
        f"Новых в WB_OZON: +{stats['wb_ozon']} | В B2B_HOT: +{stats['b2b_hot']} | "
        f"Архив: {stats['archived']} | Пропущено дублей: {stats['duplicates_skipped']} | "
        f"Ждут дожима: {stats['follow_up_count']}"
    )

    # 6. Итоговый утренний отчет в Telegram (08:35)
    notifier.send_summary_report(
        title="☀️ Утренний сбор лидов A2 Group (08:35)",
        stats=stats,
        top_leads=top_leads[:3]
    )

    return stats
