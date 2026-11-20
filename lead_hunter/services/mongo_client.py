"""
Клиент MongoDB для CRM A2Group: синхронизация лидов, строгая дедупликация и архивирование.
Поддерживает прямое подключение к реплика-сету Atlas при блокировке UDP SRV на macOS.
"""

import logging
import uuid
from typing import Dict, Any, List, Optional
import pymongo
from pymongo import MongoClient

from lead_hunter.config import (
    MONGODB_URI,
    MONGODB_DB_NAME,
    DIRECT_ATLAS_URI,
    MINIMUM_RATES
)
from lead_hunter.services.phone_enricher import clean_company_name, normalize_phone

logger = logging.getLogger("lead_hunter.mongo")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


class HunterMongoClient:
    def __init__(self, uri: Optional[str] = None, db_name: Optional[str] = None):
        self.db_name = db_name or MONGODB_DB_NAME
        self.client = self._connect(uri or MONGODB_URI)
        self.db = self.client[self.db_name]
        self._ensure_indexes()

    def _connect(self, uri: str) -> MongoClient:
        """Попытка подключения с graceful fallback на прямой replica-set URI."""
        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=4000)
            # Проверочный пинг
            client.admin.command('ping')
            return client
        except Exception as e:
            logger.warning(f"Не удалось подключиться через SRV URI ({e}). Пробуем прямой URI Atlas...")
            try:
                client = MongoClient(DIRECT_ATLAS_URI, serverSelectionTimeoutMS=5000)
                client.admin.command('ping')
                logger.info("Успешное прямое подключение к MongoDB Atlas.")
                return client
            except Exception as e2:
                logger.error(f"Критическая ошибка подключения к MongoDB: {e2}")
                raise e2

    def _ensure_indexes(self):
        """Создание необходимых индексов для быстрой дедупликации и работы в CRM."""
        try:
            self.db.leads.create_index("id", background=True)
            self.db.leads.create_index("phone", background=True)
            self.db.leads.create_index("company", background=True)
            self.db.leads.create_index("funnel", background=True)
            self.db.leads.create_index("industry", background=True)
            self.db.leads.create_index("heat_score", background=True)

            self.db.leads_archive.create_index("id", background=True)
            self.db.leads_archive.create_index("phone", background=True)
            self.db.leads_archive.create_index("company", background=True)
        except Exception as e:
            logger.warning(f"Ошибка создания индексов MongoDB: {e}")

    def is_duplicate(self, phone: Optional[str], company_name: Optional[str]) -> bool:
        """
        Проверяет наличие компании сразу по 3 базам:
        1. Действующие клиенты CRM (db.clients)
        2. Текущие лиды в обзвоне (db.leads)
        3. Архив отсева (db.leads_archive)
        """
        norm_p = normalize_phone(phone)
        cl_name = clean_company_name(company_name)

        or_conditions = []
        if norm_p and len(norm_p) >= 9:
            # Ищем точное совпадение или вхождение в телефон
            or_conditions.append({"phone": {"$regex": norm_p[-9:]}})
        
        if cl_name and len(cl_name) >= 4:
            # Регулярка по очищенному имени компании без учета регистра
            import re
            escaped = re.escape(cl_name)
            or_conditions.append({"company": {"$regex": escaped, "$options": "i"}})
            or_conditions.append({"name": {"$regex": escaped, "$options": "i"}})

        if not or_conditions:
            return False

        query = {"$or": or_conditions}

        # 1. Проверка в клиентах
        if self.db.clients.count_documents(query, limit=1) > 0:
            return True

        # 2. Проверка в активных лидах
        if self.db.leads.count_documents(query, limit=1) > 0:
            return True

        # 3. Проверка в архиве
        if self.db.leads_archive.count_documents(query, limit=1) > 0:
            return True

        return False

    def upsert_lead(self, lead: Dict[str, Any]) -> str:
        """Вставляет или обновляет лид в коллекции db.leads CRM."""
        lead_id = lead.get("id") or str(uuid.uuid4())
        lead["id"] = lead_id
        
        # Гарантируем строковые значения
        lead["name"] = lead.get("name") or lead.get("company") or "Новый лид"
        lead["phone"] = normalize_phone(lead.get("phone")) or str(lead.get("phone") or "")
        lead["city"] = lead.get("city") or "Минск"

        self.db.leads.update_one(
            {"id": lead_id},
            {"$set": lead},
            upsert=True
        )
        return lead_id

    def move_to_archive(self, lead_id: str, reason: str, original_lead: Optional[Dict[str, Any]] = None):
        """Удаляет лид из активных db.leads и переносит в db.leads_archive с причиной отсева."""
        if not original_lead:
            original_lead = self.db.leads.find_one({"id": lead_id})

        archive_doc = {
            "id": lead_id,
            "name": original_lead.get("name") if original_lead else "",
            "company": original_lead.get("company") if original_lead else "",
            "phone": original_lead.get("phone") if original_lead else "",
            "city": original_lead.get("city") if original_lead else "",
            "industry": original_lead.get("industry") if original_lead else "",
            "archive_reason": reason,
            "original_data": original_lead or {}
        }

        # Вставляем в архив
        self.db.leads_archive.update_one(
            {"id": lead_id},
            {"$set": archive_doc},
            upsert=True
        )

        # Удаляем из активных лидов CRM
        self.db.leads.delete_one({"id": lead_id})

    def remove_rate_thresholds(self):
        """Удаляет пороговые ставки из настроек CRM."""
        self.db.app_settings.update_one(
            {"_id": "main"},
            {"$unset": {"rate_minimums": ""}}
        )
        logger.info("Пороговые ставки удалены из app_settings CRM.")

    def sync_rate_thresholds(self, rates: Optional[List[Dict[str, Any]]] = None):
        """Пороговые ставки отключены пользователем."""
        self.remove_rate_thresholds()

    def count_follow_ups_needed(self) -> int:
        """Считает количество лидов, которым отправлено КП и требуется дожим."""
        try:
            return self.db.leads.count_documents({
                "$or": [
                    {"stage": "proposal_sent"},
                    {"last_outcome": "quote"}
                ]
            })
        except Exception:
            return 0
