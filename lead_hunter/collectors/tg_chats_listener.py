"""
Слушатель триггерных сообщений в Telegram-чатах белорусских селлеров Wildberries и Ozon (Telethon).
Отслеживает запросы на перевозку: "кто возит на Коледино", "нужен сборный груз в Москву", "ищу фуру".

ИНСТРУКЦИЯ ПО ПОДКЛЮЧЕНИЮ:
1. Зайди на https://my.telegram.org под своим номером Telegram и создай приложение в разделе 'API development tools'.
2. Скопируй полученные `api_id` и `api_hash`.
3. Добавь их в `.env`:
   TG_API_ID=12345678
   TG_API_HASH=abcdef1234567890abcdef1234567890
4. При первом запуске скрипт запросит код подтверждения из Telegram и создаст локальную сессию `session_telethon.session`.
"""

import os
import re
import logging
from typing import List, Dict, Any, Optional

from lead_hunter.config import TG_API_ID, TG_API_HASH

logger = logging.getLogger("lead_hunter.tg_chats")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

TRIGGER_PATTERNS = [
    r'коледино',
    r'электростал',
    r'подольск',
    r'шушар',
    r'сборн\w*\s+груз',
    r'доставк\w*\s+(в|до)\s+москв',
    r'кто\s+воз\w*',
    r'ищ\w*\s+(машин|транспорт|перевозчик|фуру|газель)',
    r'фулфилмент',
    r'поставк\w*\s+на\s+вб',
    r'поставк\w*\s+на\s+wb',
    r'поставк\w*\s+на\s+ozon'
]

TARGET_CHATS = [
    "wb_belarus",
    "ozon_belarus",
    "sellers_minsk",
    "minsk_fulfillment"
]


class TelegramChatsListener:
    def __init__(self, api_id: Optional[int] = None, api_hash: Optional[str] = None):
        self.api_id = api_id or TG_API_ID
        self.api_hash = (api_hash or TG_API_HASH).strip()
        self.enabled = bool(self.api_id and self.api_hash)

    def is_configured(self) -> bool:
        return self.enabled

    async def scan_recent_messages(self, limit_per_chat: int = 50) -> List[Dict[str, Any]]:
        """
        Асинхронное сканирование последних сообщений в чатах селлеров на наличие триггеров поиска доставки.
        """
        if not self.is_configured():
            logger.info("[TG Чаты] Модуль Telethon не настроен (TG_API_ID / TG_API_HASH не заданы в .env). Пропуск.")
            return []

        try:
            from telethon import TelegramClient
        except ImportError:
            logger.warning("[TG Чаты] Библиотека Telethon не установлена. Для включения установи: pip install telethon")
            return []

        collected_leads = []
        client = TelegramClient("lead_hunter_tg_session", self.api_id, self.api_hash)

        try:
            await client.start()
            logger.info("[TG Чаты] Успешное подключение к Telegram Client через Telethon.")

            for chat_username in TARGET_CHATS:
                try:
                    logger.info(f"[TG Чаты] Проверка чата @{chat_username}...")
                    async for message in client.iter_messages(chat_username, limit=limit_per_chat):
                        text = (message.message or "").strip()
                        if not text:
                            continue

                        text_lower = text.lower()
                        # Проверяем триггеры
                        matched_triggers = [p for p in TRIGGER_PATTERNS if re.search(p, text_lower)]
                        if matched_triggers:
                            sender = await message.get_sender()
                            sender_name = getattr(sender, 'first_name', '') or getattr(sender, 'username', 'Селлер')
                            username = getattr(sender, 'username', '')
                            phone = getattr(sender, 'phone', '')

                            collected_leads.append({
                                "company": f"Селлер @{username}" if username else f"Контакт {sender_name}",
                                "name": sender_name,
                                "phone": phone or "",
                                "city": "Минск",
                                "source": f"Telegram чат @{chat_username}",
                                "trigger": f"Сообщение: {matched_triggers[0]}",
                                "notes": f"Запрос в чате @{chat_username}: «{text[:200]}»",
                                "directions": "Минск ↔ Москва/РФ (WB/Ozon)",
                                "funnel_hint": "WB_OZON",
                                "industry": "WB/Ozon (Минск)"
                            })
                except Exception as chat_err:
                    logger.debug(f"[TG Чаты] Не удалось прочитать @{chat_username}: {chat_err}")

            await client.disconnect()
        except Exception as e:
            logger.warning(f"[TG Чаты] Ошибка при работе с Telethon: {e}")

        logger.info(f"[TG Чаты] Найдено {len(collected_leads)} горячих запросов на доставку.")
        return collected_leads
