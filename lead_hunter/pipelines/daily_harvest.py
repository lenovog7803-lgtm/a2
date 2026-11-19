"""
Ежедневный автономный пайплайн сбора, обогащения и квалификации лидов (daily_harvest):
1. Сбор свежих горячих компаний через rabota.by (вакансии 24ч) и реестры ЕАЭС.
2. Обогащение контактами и УНП.
3. 4-уровневая дедупликация (Клиенты, WB/Ozon, B2B Горячие, Архив).
4. AI-скоринг и генерация персонализированного скрипта первого контакта.
5. Загрузка в CRM (db.leads) и мгновенный алерт в Telegram по супер-горячим лидам.
"""

import time
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone

from lead_hunter.services.mongo_client import HunterMongoClient
from lead_hunter.services.gemini_classifier import GeminiClassifier
from lead_hunter.services.sheets_client import HunterSheetsClient
from lead_hunter.services.telegram_notifier import TelegramNotifier
from lead_hunter.services.phone_enricher import normalize_phone, clean_company_name, search_unp_and_contacts
from lead_hunter.collectors.rabota_by_parser import RabotaByParser
from lead_hunter.collectors.eaeu_registry_parser import EaeuRegistryParser
from lead_hunter.collectors.tg_chats_listener import TelegramChatsListener

logger = logging.getLogger("lead_hunter.daily")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def run_daily_harvest() -> Dict[str, Any]:
    """Запуск ежедневного цикла сбора и квалификации новых лидов."""
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

    # rabota.by вакансии за последние 24ч
    try:
        rabota_parser = RabotaByParser()
        vac_leads = rabota_parser.collect_all_daily()
        raw_candidates.extend(vac_leads)
    except Exception as e:
        logger.error(f"Ошибка в коллекторе rabota.by: {e}")

    # ЕАЭС декларации соответствия
    try:
        eaeu_parser = EaeuRegistryParser()
        decl_leads = eaeu_parser.collect_recent_declarations()
        raw_candidates.extend(decl_leads)
    except Exception as e:
        logger.error(f"Ошибка в коллекторе ЕАЭС: {e}")

    stats["total"] = len(raw_candidates)
    logger.info(f"Всего собрано кандидатов из внешних источников: {len(raw_candidates)}")

    if not raw_candidates:
        logger.info("Новых кандидатов за последние 24 часа не обнаружено.")
        notifier.send_message("ℹ️ <b>Lead Hunter (08:30):</b> Свежих вакансий и деклараций за последние 24ч не обнаружено.")
        return stats

    # 2. Обогащение и дедупликация
    filtered_candidates = []
    seen_in_run = set()

    for item in raw_candidates:
        c_name = item.get("company") or item.get("name") or ""
        clean_name = clean_company_name(c_name)
        if not clean_name:
            continue

        if clean_name in seen_in_run:
            continue
        seen_in_run.add(clean_name)

        current_phone = item.get("phone")
        norm_phone = normalize_phone(current_phone)

        # Быстрая проверка на дубликат по имени/телефону до сетевого обогащения
        if mongo.is_duplicate(norm_phone, clean_name):
            stats["duplicates_skipped"] += 1
            continue

        # Для уникальных кандидатов обогащаем УНП и недостающие контакты
        enriched = search_unp_and_contacts(c_name, city=item.get("city", "Минск"))
        if enriched.get("unp"):
            item["unp"] = enriched["unp"]
        if not norm_phone and enriched.get("phones"):
            norm_phone = normalize_phone(enriched["phones"][0])

        item["phone"] = norm_phone or current_phone or ""
        filtered_candidates.append(item)

    logger.info(f"После дедупликации отобрано {len(filtered_candidates)} уникальных компаний.")

    if not filtered_candidates:
        notifier.send_message(
            f"ℹ️ <b>Lead Hunter:</b> Собрано {stats['total']} кандидатов, но все они уже есть в CRM или архиве (дубликаты: {stats['duplicates_skipped']})."
        )
        return stats

    # 3. AI-квалификация через Gemini батчами
    top_leads = []
    rows_wb_sheets = []
    rows_b2b_sheets = []

    qualifications = classifier.classify_batch(filtered_candidates)

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
        website = lead.get("website") or enriched.get("website") or ""
        if website and not website.startswith("http"):
            website = f"https://{website}"

        # Форматирование заметок под карточку звонка в CRM
        formatted_notes = (
            f"🎯 Скрипт: {pitch}\n"
            f"💡 Почему взят: {reason}\n"
            f"🔥 Скоринг: {heat_score}/100 | Воронка: {funnel} ({niche})\n"
            f"⚡ Источник: {lead.get('source', '')} ({lead.get('trigger', '')})\n"
            + (f"🌐 Сайт: {website}\n" if website else "")
            + f"УНП: {lead.get('unp', 'уточняется')}\n"
            f"----------------------------------------\n"
            f"{lead.get('notes', '')}"
        ).strip()

        target_industry = "WB/Ozon (Минск)" if funnel == "WB_OZON" else "B2B Горячие (Минск)"

        lead_doc = {
            **lead,
            "city": "Минск",
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

        # Сохранение прямо в CRM (db.leads)
        mongo.upsert_lead(lead_doc)

        if funnel == "WB_OZON":
            stats["wb_ozon"] += 1
            rows_wb_sheets.append([
                heat_score, niche, c_name, website, lead.get("contact_person", ""),
                lead_doc.get("phone", ""), lead.get("email", ""), "Минск", "Новый",
                lead.get("source", ""), reason, pitch, formatted_notes,
                datetime.now(timezone.utc).strftime("%Y-%m-%d")
            ])
        else:
            stats["b2b_hot"] += 1
            rows_b2b_sheets.append([
                heat_score, "FTL/LTL РФ", niche, c_name, website, lead.get("contact_person", ""),
                lead_doc.get("phone", ""), lead.get("email", ""), "Минск", "Новый",
                lead.get("source", ""), reason, pitch, formatted_notes,
                datetime.now(timezone.utc).strftime("%Y-%m-%d")
            ])

        # Если супер-горячий лид — мгновенный алерт
        if heat_score >= 85:
            notifier.send_hot_lead_alert(lead_doc)

        top_leads.append(lead_doc)

    # Запись в Google Sheets при доступности
    if rows_wb_sheets:
        sheets.append_rows_safe("База_WB_Ozon_Минск", rows_wb_sheets)
    if rows_b2b_sheets:
        sheets.append_rows_safe("Обзвон_Минск_Горячие", rows_b2b_sheets)

    top_leads.sort(key=lambda x: x.get("heat_score", 0), reverse=True)

    elapsed = round(time.time() - start_time, 1)
    logger.info(
        f"=== DAILY HARVEST ЗАВЕРШЕН ({elapsed}s) ===\n"
        f"Новых в WB_OZON: +{stats['wb_ozon']} | В B2B_HOT: +{stats['b2b_hot']} | "
        f"Архив: {stats['archived']} | Пропущено дублей: {stats['duplicates_skipped']}"
    )

    # Итоговый утренний отчет в Telegram
    notifier.send_summary_report(
        title="☀️ Утренний сбор лидов A2Group (08:30)",
        stats=stats,
        top_leads=top_leads[:3]
    )

    return stats
