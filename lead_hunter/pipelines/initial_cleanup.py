"""
Пайплайн разовой генеральной чистки базы обзвона CRM:
1. Вырезает дубликаты, тестовый мусор и конкурентов-перевозчиков.
2. Отсекает всё, что не относится к Минску и Минскому району, перенося в db.leads_archive.
3. Разделяет минских клиентов на 2 воронки: WB_OZON и B2B_HOT.
4. Обогащает питч-скриптами, баллами горячести (1-100) и сохраняет прямо в CRM (db.leads).
5. Экспортирует результат в Google Sheets (если настроены) и отправляет сводный отчет в Telegram.
"""

import time
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone

from lead_hunter.services.mongo_client import HunterMongoClient
from lead_hunter.services.gemini_classifier import GeminiClassifier
from lead_hunter.services.sheets_client import HunterSheetsClient
from lead_hunter.services.telegram_notifier import TelegramNotifier
from lead_hunter.services.phone_enricher import normalize_phone, clean_company_name

logger = logging.getLogger("lead_hunter.cleanup")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

BATCH_SIZE = 35


def run_initial_cleanup(dry_run: bool = False) -> Dict[str, Any]:
    """
    Запуск полной генеральной чистки текущей базы CRM.
    dry_run=True позволяет оценить объемы отсева без записи в базу данных.
    """
    logger.info("=== НАЧАЛО ГЕНЕРАЛЬНОЙ ЧИСТКИ БАЗЫ CRM ===")
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
        "b2b_warm": 0,
        "archived": 0,
        "duplicates_skipped": 0,
    }

    top_hot_leads = []
    seen_phones = set()
    seen_companies = set()

    # Загружаем всех клиентов для исключения повторов
    existing_clients = mongo.db.clients.find({}, {"phone": 1, "company": 1, "name": 1})
    for c in existing_clients:
        p = normalize_phone(c.get("phone"))
        if p:
            seen_phones.add(p)
        cn = clean_company_name(c.get("company") or c.get("name"))
        if cn:
            seen_companies.add(cn)

    cursor = mongo.db.leads.find({})
    all_leads = list(cursor)
    stats["total"] = len(all_leads)
    logger.info(f"Загружено {len(all_leads)} лидов из базы CRM для анализа.")

    batch_buffer = []
    rows_wb_sheets = []
    rows_b2b_sheets = []
    rows_archive_sheets = []

    def flush_batch(batch: List[Dict[str, Any]]):
        if not batch:
            return

        qualifications = classifier.classify_batch(batch)

        for lead, qual in zip(batch, qualifications):
            lead_id = lead.get("id")
            norm_p = normalize_phone(lead.get("phone"))
            c_name = lead.get("company") or lead.get("name") or "Компания"
            cl_cname = clean_company_name(c_name)

            # Проверка на дубликат внутри текущей обработки
            if (norm_p and norm_p in seen_phones) or (cl_cname and len(cl_cname) >= 4 and cl_cname in seen_companies):
                stats["duplicates_skipped"] += 1
                stats["archived"] += 1
                if not dry_run:
                    mongo.move_to_archive(lead_id, "Дубликат компании / телефона", lead)
                continue

            if norm_p:
                seen_phones.add(norm_p)
            if cl_cname:
                seen_companies.add(cl_cname)

            funnel = qual.get("funnel", "ARCHIVE")
            heat_score = qual.get("heat_score", 0)
            niche = qual.get("niche", "B2B")
            pitch = qual.get("pitch_script", "")
            disqual_reason = qual.get("disqualification_reason", "")

            # 1. Если не Минск или мусор -> в архив
            if funnel == "ARCHIVE" or not qual.get("is_minsk") or not qual.get("is_valid_shipper"):
                stats["archived"] += 1
                reason = disqual_reason or "Не Минский регион / не прямой грузовладелец"
                if not dry_run:
                    mongo.move_to_archive(lead_id, reason, lead)
                
                rows_archive_sheets.append([
                    c_name,
                    norm_p or lead.get("phone", ""),
                    lead.get("city", ""),
                    lead.get("industry", ""),
                    reason,
                    datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
                ])
                continue

            # 2. Если целевой клиент Минска (WB_OZON / B2B_HOT / B2B_WARM)
            formatted_notes = (
                f"🎯 Скрипт: {pitch}\n"
                f"🔥 Скоринг: {heat_score}/100 | Воронка: {funnel} ({niche})\n"
                f"----------------------------------------\n"
                f"{lead.get('notes', '')}"
            ).strip()

            target_industry = "WB/Ozon (Минск)" if funnel == "WB_OZON" else "B2B Горячие (Минск)"

            updated_lead = {
                **lead,
                "phone": norm_p or lead.get("phone", ""),
                "city": "Минск",
                "funnel": funnel,
                "heat_score": heat_score,
                "niche": niche,
                "pitch_script": pitch,
                "industry": target_industry,
                "notes": formatted_notes,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            if funnel == "WB_OZON":
                stats["wb_ozon"] += 1
                rows_wb_sheets.append([
                    heat_score, niche, c_name, lead.get("contact_person", ""),
                    norm_p or lead.get("phone", ""), lead.get("email", ""),
                    "Минск", lead.get("stage", "new"), "База обзвона CRM",
                    pitch, formatted_notes, datetime.now(timezone.utc).strftime("%Y-%m-%d")
                ])
            elif funnel == "B2B_HOT":
                stats["b2b_hot"] += 1
                rows_b2b_sheets.append([
                    heat_score, "FTL/LTL РФ", niche, c_name, lead.get("contact_person", ""),
                    norm_p or lead.get("phone", ""), lead.get("email", ""),
                    "Минск", lead.get("stage", "new"), "База обзвона CRM",
                    pitch, formatted_notes, datetime.now(timezone.utc).strftime("%Y-%m-%d")
                ])
            else:
                stats["b2b_warm"] += 1

            if not dry_run:
                mongo.upsert_lead(updated_lead)

            if heat_score >= 80:
                top_hot_leads.append(updated_lead)

    # Обработка лидов батчами
    for i, lead in enumerate(all_leads):
        batch_buffer.append(lead)
        if len(batch_buffer) >= BATCH_SIZE:
            flush_batch(batch_buffer)
            batch_buffer = []
            logger.info(f"Обработано {i + 1}/{len(all_leads)} строк... (В работе: WB={stats['wb_ozon']}, B2B={stats['b2b_hot']}, Архив={stats['archived']})")

    if batch_buffer:
        flush_batch(batch_buffer)

    # Синхронизация данных в Google Sheets (если настроены)
    if rows_wb_sheets:
        sheets.append_rows_safe("База_WB_Ozon_Минск", rows_wb_sheets)
    if rows_b2b_sheets:
        sheets.append_rows_safe("Обзвон_Минск_Горячие", rows_b2b_sheets)
    if rows_archive_sheets:
        sheets.append_rows_safe("Архив_Не_Минск", rows_archive_sheets)

    # Сортировка топ лидов по баллу
    top_hot_leads.sort(key=lambda x: x.get("heat_score", 0), reverse=True)

    elapsed = round(time.time() - start_time, 1)
    logger.info(
        f"=== ГЕНЕРАЛЬНАЯ ЧИСТКА ЗАВЕРШЕНА ({elapsed}s) ===\n"
        f"Всего: {stats['total']} | WB_OZON: +{stats['wb_ozon']} | B2B_HOT: +{stats['b2b_hot']} | "
        f"Архив: {stats['archived']} | Дубликаты: {stats['duplicates_skipped']}"
    )

    # Отправка отчета в Telegram
    notifier.send_summary_report(
        title="🧹 Генеральная чистка базы CRM A2Group завершена",
        stats=stats,
        top_leads=top_hot_leads[:3]
    )

    return stats
