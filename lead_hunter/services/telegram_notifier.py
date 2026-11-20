"""
Сервис Telegram-уведомлений: ежедневные сводки, статистика воронок и алерты по супер-горячим лидам.
"""

import html
import logging
from typing import Dict, Any, List, Optional
import requests

from lead_hunter.config import TG_BOT_TOKEN, TG_CHAT_ID

logger = logging.getLogger("lead_hunter.telegram")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


class TelegramNotifier:
    def __init__(self, token: Optional[str] = None, chat_id: Optional[str] = None):
        self.token = (token or TG_BOT_TOKEN).strip()
        self.chat_id = (chat_id or TG_CHAT_ID).strip()

    def send_message(self, text: str) -> bool:
        """Отправка сообщения в Telegram с HTML-разметкой (напрямую или через бэкенд A2)."""
        # 1. Попытка прямой отправки через Telegram Bot API
        if self.token and self.chat_id:
            url = f"https://api.telegram.org/bot{self.token}/sendMessage"
            payload = {
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True
            }
            try:
                resp = requests.post(url, json=payload, timeout=10)
                if resp.status_code == 200:
                    return True
                else:
                    logger.warning(f"Прямой Telegram API вернул {resp.status_code}: {resp.text}. Пробуем бэкенд A2...")
            except Exception as e:
                logger.warning(f"Исключение при прямой отправке в Telegram: {e}. Пробуем бэкенд A2...")

        # 2. Fallback через бэкенд А2 Group на Render (где токен A2_INFO_BOT_TOKEN настроен на сервере)
        try:
            backend_url = "https://logistics-crm-backend.onrender.com/api/leads/morning-digest"
            resp = requests.post(backend_url, json={"text": text}, timeout=10)
            if resp.status_code == 200 and resp.json().get("ok"):
                return True
            else:
                logger.error(f"Ошибка отправки через бэкенд: {resp.status_code} - {resp.text}")
        except Exception as e:
            logger.error(f"Исключение при отправке через бэкенд: {e}")

        return False

    def send_summary_report(self, title: str, stats: Dict[str, Any], top_leads: Optional[List[Dict[str, Any]]] = None) -> bool:
        """Отправка структурированного отчета после чистки базы или ежедневного сбора."""
        lines = [
            f"🎯 <b>{html.escape(title)}</b>\n",
            f"📊 <b>Результаты обработки:</b>",
            f"• Всего обработано: <b>{stats.get('total', 0)}</b>",
            f"• В воронку <b>WB / Ozon Минск</b>: <b>+{stats.get('wb_ozon', 0)}</b>",
            f"• В воронку <b>B2B Минск Горячие</b>: <b>+{stats.get('b2b_hot', 0)}</b>",
            f"• Отсеяно в архив (не Минск / мусор): <b>{stats.get('archived', 0)}</b>",
        ]

        if stats.get('duplicates_skipped'):
            lines.append(f"• Пропущено повторов (дедупликация): <b>{stats.get('duplicates_skipped', 0)}</b>")

        if stats.get('follow_up_count'):
            lines.append(f"\n📌 <b>Ждут дожима после КП: {stats.get('follow_up_count')} клиентов</b> (кнопка в 1 клик в CRM)")

        if top_leads:
            lines.append("\n🔥 <b>ТОП самых горячих лидов дня:</b>")
            for i, l in enumerate(top_leads[:3], 1):
                c_name = html.escape(str(l.get('company') or l.get('name') or 'Компания'))
                score = l.get('heat_score', 0)
                niche = html.escape(str(l.get('niche') or 'B2B'))
                phone = html.escape(str(l.get('phone') or ''))
                pitch = html.escape(str(l.get('pitch_script') or ''))

                lines.append(f"\n<b>{i}. {c_name}</b> (Скоринг: {score}/100 | {niche})")
                if phone:
                    lines.append(f"   📞 <code>+{phone}</code>")
                if pitch:
                    lines.append(f"   💬 <i>«{pitch}»</i>")

        lines.append('\n👉 <a href="https://crm-v2-khaki.vercel.app/?p=leads"><b>Открыть базу обзвона в CRM</b></a>')

        text = "\n".join(lines)
        return self.send_message(text)

    def send_hot_lead_alert(self, lead: Dict[str, Any]) -> bool:
        """Мгновенный алерт менеджеру по супер-горячему лиду (Балл >= 85)."""
        score = lead.get("heat_score", 0)
        if score < 85:
            return False

        c_name = html.escape(str(lead.get("company") or lead.get("name") or "Компания"))
        phone = html.escape(str(lead.get("phone") or "нет"))
        niche = html.escape(str(lead.get("niche") or "WB / B2B"))
        pitch = html.escape(str(lead.get("pitch_script") or ""))
        source = html.escape(str(lead.get("source") or "lead_hunter"))

        text = (
            f"🚨 <b>СУПЕР-ГОРЯЧИЙ ЛИД ({score} БАЛЛОВ)!</b>\n\n"
            f"🏢 <b>Компания:</b> {c_name}\n"
            f"🏷 <b>Ниша:</b> {niche}\n"
            f"📞 <b>Телефон:</b> {phone}\n"
            f"⚡ <b>Источник / Триггер:</b> {source}\n\n"
            f"💬 <b>Скрипт звонка:</b>\n<i>«{pitch}»</i>\n\n"
            f"<i>Лид уже загружен в CRM (Обзвон) и готов к первому звонку!</i>"
        )
        return self.send_message(text)
