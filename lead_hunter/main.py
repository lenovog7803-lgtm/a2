#!/usr/bin/env python3
"""
Главная точка входа CLI автономного сервиса a2group_lead_hunter.

Использование:
  python main.py clean          # Разовая генеральная чистка базы CRM (3505 строк -> Минск WB/B2B + Архив)
  python main.py clean --dry    # Тестовая чистка без изменения базы
  python main.py daily          # Ежедневный сбор горячих лидов (rabota.by, ЕАЭС, чаты)
  python main.py test           # Диагностика подключения к MongoDB, Gemini и Telegram
"""

import sys
import logging
from lead_hunter.pipelines.initial_cleanup import run_initial_cleanup
from lead_hunter.pipelines.daily_harvest import run_daily_harvest
from lead_hunter.services.mongo_client import HunterMongoClient
from lead_hunter.services.sheets_client import HunterSheetsClient
from lead_hunter.services.telegram_notifier import TelegramNotifier
from lead_hunter.services.gemini_classifier import GeminiClassifier

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("lead_hunter")


def cmd_test():
    """Проверка всех подключений (MongoDB, Gemini, Telegram, Sheets)."""
    print("--- ДИАГНОСТИКА ПОДКЛЮЧЕНИЙ LEAD HUNTER ---")
    
    # 1. MongoDB
    try:
        mongo = HunterMongoClient()
        total_leads = mongo.db.leads.count_documents({})
        total_arch = mongo.db.leads_archive.count_documents({})
        print(f"✅ MongoDB: Подключено (Лидов в CRM: {total_leads}, В архиве: {total_arch})")
    except Exception as e:
        print(f"❌ MongoDB: Ошибка подключения: {e}")

    # 2. Gemini
    try:
        classifier = GeminiClassifier()
        if classifier.client:
            test_res = classifier.classify_batch([{
                "name": "ООО Тестовый Селлер",
                "company": "ООО Тестовый Селлер",
                "city": "Минск",
                "industry": "Одежда на Wildberries",
                "notes": "Поставки в Коледино"
            }])
            print(f"✅ Gemini API: Подключено (Модель: {classifier.model_name}, Ответ: {test_res[0].get('funnel')})")
        else:
            print("⚠️ Gemini API: GEMINI_API_KEY не задан, используется эвристика.")
    except Exception as e:
        print(f"❌ Gemini API: Ошибка: {e}")

    # 3. Telegram
    try:
        notifier = TelegramNotifier()
        if notifier.token and notifier.chat_id:
            ok = notifier.send_message("🩺 <b>Тест связи Lead Hunter:</b> Все системы работают штатно.")
            if ok:
                print(f"✅ Telegram: Тестовое сообщение отправлено в чат {notifier.chat_id}")
            else:
                print("⚠️ Telegram: Не удалось отправить тестовое сообщение.")
        else:
            print("⚠️ Telegram: Токен или chat_id не заданы.")
    except Exception as e:
        print(f"❌ Telegram: Ошибка: {e}")

    # 4. Google Sheets
    try:
        sheets = HunterSheetsClient()
        if sheets.ss:
            print(f"✅ Google Sheets: Подключено ({sheets.ss.title})")
        else:
            print("⚠️ Google Sheets: Не подключено (лиды будут писаться прямо в CRM MongoDB).")
    except Exception as e:
        print(f"⚠️ Google Sheets: {e}")

    print("------------------------------------------")


def cmd_thresholds():
    """Пороговые ставки отключены."""
    print("--- ПОРОГОВЫЕ СТАВКИ ОТКЛЮЧЕНЫ ---")
    mongo = HunterMongoClient()
    mongo.remove_rate_thresholds()
    sheets = HunterSheetsClient()
    sheets.remove_thresholds_sheet()
    print("✅ Пороговые ставки полностью удалены из CRM и Google Таблицы.")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    command = sys.argv[1].lower()

    if command == "clean":
        dry_run = "--dry" in sys.argv
        if dry_run:
            print("🧪 Запуск чистки в режиме DRY-RUN (без перезаписи базы)...")
        run_initial_cleanup(dry_run=dry_run)
    elif command == "daily":
        run_daily_harvest()
    elif command == "thresholds":
        cmd_thresholds()
    elif command == "test":
        cmd_test()
    else:
        print(f"Неизвестная команда: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
