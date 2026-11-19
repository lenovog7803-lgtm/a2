"""
Клиент работы с Google Sheets (gspread): создание листов, форматирование и экспорт.
Включает graceful fallback — если Google Sheets недоступны, работа CRM продолжается без сбоев.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

from lead_hunter.config import GOOGLE_SHEET_ID, GOOGLE_CREDS_PATH, MINIMUM_RATES

logger = logging.getLogger("lead_hunter.sheets")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


class HunterSheetsClient:
    def __init__(self, sheet_id: Optional[str] = None, creds_path: Optional[str] = None):
        self.sheet_id = (sheet_id or GOOGLE_SHEET_ID).strip()
        self.creds_path = (creds_path or GOOGLE_CREDS_PATH).strip()
        self.gc = None
        self.ss = None
        self._init_client()

    def _init_client(self):
        """Авторизация в Google Sheets API."""
        if not Path(self.creds_path).exists():
            logger.warning(f"Файл ключей Google Sheets не найден по пути: {self.creds_path}. Экспорт в Sheets будет пропущен.")
            return

        try:
            import gspread
            from google.oauth2.service_account import Credentials
            scopes = [
                "https://spreadsheets.google.com/feeds",
                "https://www.googleapis.com/auth/drive"
            ]
            creds = Credentials.from_service_account_file(self.creds_path, scopes=scopes)
            self.gc = gspread.authorize(creds)
            self.ss = self.gc.open_by_key(self.sheet_id)
            logger.info(f"Успешное подключение к Google Таблице: {self.ss.title}")
        except Exception as e:
            logger.warning(f"Не удалось подключиться к Google Sheets ({e}). Пайплайн CRM продолжит работу автономно.")
            self.ss = None

    def ensure_worksheets(self):
        """Создает и форматирует структуру листов, если они отсутствуют."""
        if not self.ss:
            return

        sheets_config = {
            "База_WB_Ozon_Минск": [
                "Балл", "Ниша", "Компания", "Сайт", "Контакт", "Телефон", "Email",
                "Город", "Статус", "Триггер / Источник", "Почему взят", "Скрипт-зацепка", "Заметки", "Дата добавления"
            ],
            "Обзвон_Минск_Горячие": [
                "Балл", "Сегмент", "Ниша", "Компания", "Сайт", "Контакт", "Телефон", "Email",
                "Город", "Статус", "Триггер / Источник", "Почему взят", "Скрипт-зацепка", "Заметки", "Дата добавления"
            ],
            "Архив_Не_Минск": [
                "Компания", "Телефон", "Город (исх.)", "Отрасль", "Причина отсева", "Дата переноса"
            ]
        }

        try:
            existing = {w.title: w for w in self.ss.worksheets()}
            for title, headers in sheets_config.items():
                if title not in existing:
                    ws = self.ss.add_worksheet(title=title, rows=1000, cols=len(headers) + 2)
                    ws.append_row(headers)
                    # Форматирование: закрепляем первую строку
                    ws.freeze(rows=1)
                    logger.info(f"Создан лист Google Таблицы: {title}")
                else:
                    ws = existing[title]
                    first_row = ws.row_values(1)
                    if not first_row:
                        ws.append_row(headers)
                        ws.freeze(rows=1)
        except Exception as e:
            logger.warning(f"Ошибка при настройке листов Google Таблицы: {e}")

    def append_rows_safe(self, sheet_title: str, rows: List[List[Any]]):
        """Пакетное добавление строк в указанный лист."""
        if not self.ss or not rows:
            return

        try:
            ws = self.ss.worksheet(sheet_title)
            ws.append_rows(rows, value_input_option="USER_ENTERED")
        except Exception as e:
            logger.warning(f"Не удалось записать строки в лист {sheet_title}: {e}")

    def remove_thresholds_sheet(self):
        """Удаляет лист 'Пороговые_ставки' из Google Таблицы."""
        if not self.ss:
            return
        try:
            ws = self.ss.worksheet("Пороговые_ставки")
            self.ss.del_worksheet(ws)
            logger.info("Лист 'Пороговые_ставки' удален из Google Таблицы.")
        except Exception:
            pass

    def sync_threshold_rates(self, rates: Optional[List[Dict[str, Any]]] = None):
        """Пороговые ставки отключены пользователем."""
        self.remove_thresholds_sheet()
