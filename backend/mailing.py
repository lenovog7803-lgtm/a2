"""Модуль «Рассылка»: холодные письма по базе с лимитами, напоминаниями и проверкой ответов.

Подключение в server.py:
    from mailing import build_mailing_router, mailing_loop
    api_router.include_router(build_mailing_router(db, _require_user, require_director))
    asyncio.create_task(mailing_loop(db))      # в _deferred_init

Коллекции Mongo: mail_settings, mail_contacts, mail_log.
"""
import asyncio
import email.utils
import imaplib
import io
import logging
import os
import random
import re
import smtplib
import ssl
import uuid
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

logger = logging.getLogger("mailing")
MSK = ZoneInfo("Europe/Moscow")

ST_NEW = "new"
ST_SENT = "sent"
ST_FOLLOW = "followup"
ST_REPLY = "replied"
ST_INTEREST = "interested"
ST_REFUSED = "refused"
ST_DEAL = "deal"
ST_BOUNCE = "bounce"
ST_ERROR = "error"
ST_SKIP = "skip"
STATUSES = [ST_NEW, ST_SENT, ST_FOLLOW, ST_REPLY, ST_INTEREST, ST_REFUSED, ST_DEAL, ST_BOUNCE, ST_ERROR, ST_SKIP]

DEFAULT_BODY = """{приветствие}

Меня зовут {моё_имя}, компания {моя_компания}. Мы напрямую закупаем Monster Energy в Европе и возим его крупными партиями в Россию с доставкой до вашего склада в Москве.

Можем привезти любые вкусы и линейки Monster: Original, Zero, Ultra, Juice, Rehab, лимитированные серии и другие. Объём собираем под ваш заказ.

Также можем привезти из Европы и другой нужный вам товар под ключ: найдём поставщика, выкупим, растаможим, промаркируем и доставим до вашего склада.

Хотел узнать, интересны ли вам такие поставки. Если да, подскажите, какие вкусы и объёмы вы берёте или какой товар вам нужен, и я подготовлю предложение под вас.

С уважением,
{моё_имя}, {моя_компания}
{телефон}

P.S. Если тема для вас неактуальна — просто ответьте «нет», и я больше не буду беспокоить."""

DEFAULT_FOLLOWUP = """{приветствие}

Подскажите, актуально ли для вас предложение по поставкам Monster Energy из Европы (и другого товара под ключ, с растаможкой и доставкой до Москвы)?

Если сейчас не нужно — просто напишите «нет», чтобы я не беспокоил.

{моё_имя}, {моя_компания}
{телефон}"""

DEFAULT_SETTINGS = {
    "smtp_host": "smtp.yandex.ru", "smtp_port": 465,
    "imap_host": "imap.yandex.ru", "imap_port": 993,
    "login": "", "password": "", "from_name": "Егор, A2Group",
    "my_name": "Егор", "my_company": "A2Group", "phone": "",
    "daily_limit": 20, "min_delay": 90, "max_delay": 240,
    "hour_start": 9, "hour_end": 18, "weekdays_only": True,
    "followup_enabled": True, "followup_days": 4,
    "subjects": ["Поставки Monster Energy из Европы — интересно?",
                 "Monster Energy из Европы — поставки до Москвы",
                 "Поставки Monster Energy из Европы"],
    "body": DEFAULT_BODY, "followup_body": DEFAULT_FOLLOWUP,
    # smtp — через почтовый сервер по паролю приложения;
    # gmail_api — через подключённый в CRM Google-аккаунт (HTTPS, работает на бесплатном Render)
    "transport": "smtp",
    "running": False,
}
INT_KEYS = ("smtp_port", "imap_port", "daily_limit", "min_delay", "max_delay", "hour_start", "hour_end", "followup_days")
BOOL_KEYS = ("weekdays_only", "followup_enabled")

EMAIL_RE = re.compile(r"[\w.+'-]+@[\w-]+(?:\.[\w-]+)+", re.UNICODE)
PASSWORD_MASK = "••••••••"

# состояние фонового цикла (в памяти процесса)
_runtime = {"state": "Остановлено", "next_at": None, "last_inbox": None}
_wake = asyncio.Event()


# ---------------- утилиты ----------------
def now_msk() -> datetime:
    return datetime.now(MSK)


def today_str() -> str:
    return now_msk().date().isoformat()


def clean_email(v) -> str:
    m = EMAIL_RE.search(str(v or ""))
    return m.group(0).strip().lower() if m else ""


def clean_company(name) -> str:
    name = re.sub(r"\s*\(.*?\)\s*", " ", str(name or ""))
    name = re.sub(r"[«»\"]", "", name)
    return re.sub(r"\s+", " ", name).strip()


def ascii_addr(addr: str) -> str:
    local, _, domain = addr.partition("@")
    try:
        domain.encode("ascii")
    except UnicodeEncodeError:
        domain = domain.encode("idna").decode()
    return f"{local}@{domain}"


def greeting(company: str, contact_name: str) -> str:
    if contact_name:
        return random.choice([f"Добрый день, {contact_name}!", f"Здравствуйте, {contact_name}!"])
    if company:
        return random.choice([f"Добрый день, коллеги из «{company}»!",
                              f"Здравствуйте, коллеги из «{company}»!", "Добрый день!"])
    return random.choice(["Добрый день!", "Здравствуйте!"])


def render(template: str, contact: dict, s: dict) -> str:
    company = clean_company(contact.get("company"))
    name = (contact.get("contact_name") or "").strip()
    for k, v in {
        "{приветствие}": greeting(company, name),
        "{компания}": company,
        "{имя_контакта}": name,
        "{моё_имя}": s.get("my_name", ""), "{мое_имя}": s.get("my_name", ""),
        "{моя_компания}": s.get("my_company", ""),
        "{телефон}": s.get("phone", ""),
    }.items():
        template = template.replace(k, v)
    return template


def password_of(s: dict) -> str:
    # Пароль можно не хранить в базе, а задать переменной окружения MAIL_PASSWORD на Render
    return os.environ.get("MAIL_PASSWORD") or s.get("password") or ""


def build_message(s: dict, to: str, subject: str, body: str, reply_to_id: Optional[str] = None) -> EmailMessage:
    login = s["login"].strip()
    msg = EmailMessage()
    msg["From"] = email.utils.formataddr((s.get("from_name", ""), login))
    msg["To"] = ascii_addr(to)
    msg["Subject"] = subject
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain=login.split("@")[-1] or "localhost")
    msg["Reply-To"] = login
    msg["List-Unsubscribe"] = f"<mailto:{login}?subject=unsubscribe>"
    if reply_to_id:
        msg["In-Reply-To"] = reply_to_id
        msg["References"] = reply_to_id
    # Только простой текст — без картинок, ссылок-трекеров и вложений: так меньше шансов попасть в спам
    msg.set_content(body, charset="utf-8", cte="base64")
    return msg


def make_letter(contact: dict, s: dict, kind: str) -> EmailMessage:
    if kind == "first":
        subject = random.choice([x for x in s.get("subjects", []) if x.strip()] or ["Предложение о сотрудничестве"])
        return build_message(s, contact["email"], subject, render(s["body"], contact, s))
    subject = contact.get("subject") or (s.get("subjects") or [""])[0]
    return build_message(s, contact["email"], "Re: " + subject,
                         render(s["followup_body"], contact, s), contact.get("message_id"))


def _smtp_connect(s: dict, timeout: int = 60):
    host, port = s["smtp_host"].strip(), int(s["smtp_port"])
    ctx = ssl.create_default_context()
    if port == 465:
        srv = smtplib.SMTP_SSL(host, port, context=ctx, timeout=timeout)
    else:
        srv = smtplib.SMTP(host, port, timeout=timeout)
        srv.ehlo()
        if srv.has_extn("starttls"):
            srv.starttls(context=ctx)
            srv.ehlo()
    srv.login(s["login"].strip(), password_of(s))
    return srv


class GmailAuthError(Exception):
    """Нет доступа к отправке через Gmail API — нужно переподключить Google."""


# Свой Google-аккаунт рассылки: токен лежит отдельно от основного ("google"),
# которым CRM пользуется для Docs/Calendar/Tasks.
MAIL_TOKEN_ID = "google_mail"
MAIL_STATE_ID = "google_mail_pending"


async def mail_token(db) -> Optional[dict]:
    return await db.oauth_tokens.find_one({"_id": MAIL_TOKEN_ID}, {"_id": 0})


async def is_mailing_oauth_state(db, state: str) -> bool:
    if not state:
        return False
    return bool(await db.oauth_tokens.find_one({"_id": MAIL_STATE_ID, "state": state}))


def _google_email_sync(access_token: str) -> str:
    import requests
    r = requests.get("https://openidconnect.googleapis.com/v1/userinfo",
                     headers={"Authorization": f"Bearer {access_token}"}, timeout=20)
    return (r.json().get("email") or "").lower() if r.ok else ""


async def save_mailing_oauth_token(db, token: dict):
    """Вызывается из /auth/google/callback, когда state принадлежит рассылке."""
    existing = await mail_token(db) or {}
    email_addr = await asyncio.to_thread(_google_email_sync, token.get("access_token") or "")
    await db.oauth_tokens.replace_one({"_id": MAIL_TOKEN_ID}, {
        "_id": MAIL_TOKEN_ID,
        "refresh_token": token.get("refresh_token") or existing.get("refresh_token"),
        "email": email_addr or existing.get("email", ""),
        "saved_at": datetime.utcnow().isoformat(),
    }, upsert=True)
    await db.oauth_tokens.delete_one({"_id": MAIL_STATE_ID})
    upd = {"transport": "gmail_api"}
    if email_addr:
        upd["login"] = email_addr  # письма всё равно уходят от этого ящика — показываем его же
    await db.mail_settings.update_one({"_id": "main"}, {"$set": upd}, upsert=True)


def _gmail_access_token(token_doc: dict) -> str:
    from google.oauth2.credentials import Credentials as UserCredentials
    from google.auth.transport.requests import Request
    from oauth_google import GMAIL_SEND_SCOPE, TOKEN_URL, _client_id, _client_secret
    if not token_doc or not token_doc.get("refresh_token"):
        raise GmailAuthError("Gmail для рассылки не подключён — нажмите «Подключить Gmail» в настройках рассылки")
    creds = UserCredentials(token=None, refresh_token=token_doc["refresh_token"], token_uri=TOKEN_URL,
                            client_id=_client_id(), client_secret=_client_secret(), scopes=[GMAIL_SEND_SCOPE])
    try:
        creds.refresh(Request())
    except Exception as e:
        raise GmailAuthError("Google не дал право отправлять письма — нажмите «Подключить Gmail» "
                             f"и разрешите отправку почты ({e})")
    return creds.token


def gmail_api_send_sync(token_doc: dict, msg: EmailMessage):
    import base64
    import requests
    token = _gmail_access_token(token_doc)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    r = requests.post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                      headers={"Authorization": f"Bearer {token}"}, json={"raw": raw}, timeout=60)
    if r.status_code in (401, 403):
        raise GmailAuthError(f"Gmail API отказал в доступе ({r.status_code}): {r.text[:200]}")
    if r.status_code == 400 and "invalid to header" in r.text.lower():
        raise smtplib.SMTPRecipientsRefused({msg["To"]: (400, b"Invalid To")})
    if r.status_code >= 400:
        raise RuntimeError(f"Gmail API {r.status_code}: {r.text[:300]}")


async def deliver(db, s: dict, msg: EmailMessage):
    """Отправляет письмо выбранным способом (SMTP или Gmail API)."""
    if s.get("transport") == "gmail_api":
        await asyncio.to_thread(gmail_api_send_sync, await mail_token(db), msg)
    else:
        await asyncio.to_thread(smtp_send_sync, s, msg)


async def is_configured(db, s: dict) -> bool:
    if s.get("transport") == "gmail_api":
        return bool((await mail_token(db) or {}).get("refresh_token"))
    return bool(s.get("login") and password_of(s))


def smtp_send_sync(s: dict, msg: EmailMessage):
    srv = _smtp_connect(s)
    try:
        srv.send_message(msg)
    finally:
        try:
            srv.quit()
        except Exception:
            pass


def test_connection_sync(s: dict, token_doc: Optional[dict] = None) -> dict:
    res = {}
    if s.get("transport") == "gmail_api":
        try:
            _gmail_access_token(token_doc or {})
            res["smtp"] = "ok"
        except Exception as e:
            res["smtp"] = f"ошибка: {e}"
    else:
        try:
            srv = _smtp_connect(s, timeout=20)
            srv.quit()
            res["smtp"] = "ok"
        except OSError as e:
            res["smtp"] = (f"ошибка: {e}. Похоже, сервер CRM не выпускает почту по SMTP "
                           "(так бывает на бесплатном Render) — выберите способ отправки «Через Google»")
        except Exception as e:
            res["smtp"] = f"ошибка: {e}"
    if s.get("imap_host") and password_of(s):
        try:
            im = imaplib.IMAP4_SSL(s["imap_host"].strip(), int(s.get("imap_port") or 993), timeout=20)
            im.login(s["login"].strip(), password_of(s))
            im.logout()
            res["imap"] = "ok"
        except Exception as e:
            res["imap"] = f"ошибка: {e}"
    return res


def scan_inbox_sync(s: dict, waiting: list) -> tuple:
    """Возвращает (ids ответивших, ids с возвратом)."""
    replied, bounced = set(), set()
    im = imaplib.IMAP4_SSL(s["imap_host"].strip(), int(s.get("imap_port") or 993), timeout=30)
    try:
        im.login(s["login"].strip(), password_of(s))
        im.select("INBOX", readonly=True)
        fmt = lambda d: date.fromisoformat(d).strftime("%d-%b-%Y")
        for c in waiting:
            typ, data = im.search(None, "FROM", f'"{ascii_addr(c["email"])}"', "SINCE", fmt(c["first_sent"]))
            if typ == "OK" and data and data[0].split():
                replied.add(c["id"])
        since = fmt(min(c["first_sent"] for c in waiting))
        ids = []
        for sender in ("mailer-daemon", "postmaster"):
            typ, data = im.search(None, "FROM", sender, "SINCE", since)
            if typ == "OK" and data:
                ids += data[0].split()
        for i in ids[-300:]:
            typ, data = im.fetch(i, "(BODY.PEEK[TEXT])")
            if typ != "OK" or not data or not isinstance(data[0], tuple):
                continue
            text = data[0][1].decode("utf-8", "ignore").lower()
            for c in waiting:
                if c["id"] not in replied and ascii_addr(c["email"]) in text:
                    bounced.add(c["id"])
    finally:
        try:
            im.logout()
        except Exception:
            pass
    return replied, bounced


# ---------------- база ----------------
async def get_settings(db) -> dict:
    doc = await db.mail_settings.find_one({"_id": "main"}) or {}
    s = {**DEFAULT_SETTINGS, **{k: v for k, v in doc.items() if k != "_id"}}
    return s


async def save_settings(db, data: dict):
    upd = {}
    for k, v in data.items():
        if k not in DEFAULT_SETTINGS or k == "running":
            continue
        if k == "password" and (v == PASSWORD_MASK or v is None):
            continue
        if k in INT_KEYS:
            try:
                v = int(v)
            except (TypeError, ValueError):
                raise HTTPException(400, f"Поле «{k}» должно быть числом")
        if k == "transport" and v not in ("smtp", "gmail_api"):
            raise HTTPException(400, "Неизвестный способ отправки")
        if k in BOOL_KEYS:
            v = bool(v) and v not in ("0", "false", "False")
        if k == "subjects" and isinstance(v, str):
            v = [x.strip() for x in v.splitlines() if x.strip()]
        upd[k] = v
    if "min_delay" in upd or "max_delay" in upd:
        cur = await get_settings(db)
        lo, hi = upd.get("min_delay", cur["min_delay"]), upd.get("max_delay", cur["max_delay"])
        if lo > hi:
            raise HTTPException(400, "Минимальная пауза больше максимальной")
    if upd:
        await db.mail_settings.update_one({"_id": "main"}, {"$set": upd}, upsert=True)


async def set_running(db, running: bool):
    await db.mail_settings.update_one({"_id": "main"}, {"$set": {"running": running}}, upsert=True)


async def add_log(db, contact: Optional[dict], kind: str, ok: bool, detail: str = ""):
    await db.mail_log.insert_one({
        "id": str(uuid.uuid4()), "ts": now_msk().isoformat(timespec="seconds"),
        "day": today_str(), "contact_id": contact.get("id") if contact else None,
        "company": contact.get("company", "") if contact else "", "email": contact.get("email", "") if contact else "",
        "kind": kind, "ok": ok, "detail": detail,
    })


async def sent_today(db) -> int:
    return await db.mail_log.count_documents({"day": today_str(), "ok": True, "kind": {"$in": ["письмо", "напоминание"]}})


PRIORITY_ORDER = {"A": 0, "B": 1, "C": 2}


async def next_in_queue(db, s: dict):
    if s.get("followup_enabled"):
        border = (now_msk().date() - timedelta(days=int(s.get("followup_days") or 4))).isoformat()
        c = await db.mail_contacts.find_one(
            {"status": ST_SENT, "followup_sent": None, "first_sent": {"$lte": border}, "email": {"$ne": ""}},
            {"_id": 0}, sort=[("first_sent", 1)])
        if c:
            return c, "follow"
    # адреса, которым уже что-то отправляли, повторно не берём
    used = set(await db.mail_contacts.distinct("email", {"status": {"$ne": ST_NEW}, "email": {"$ne": ""}}))
    cands = await db.mail_contacts.find({"status": ST_NEW, "email": {"$ne": ""}}, {"_id": 0}).to_list(5000)
    cands = [c for c in cands if c["email"] not in used]
    if not cands:
        return None, None
    cands.sort(key=lambda c: (PRIORITY_ORDER.get((c.get("priority") or "").strip(), 3), c.get("created_at", "")))
    return cands[0], "first"


async def queue_sizes(db, s: dict):
    used = set(await db.mail_contacts.distinct("email", {"status": {"$ne": ST_NEW}, "email": {"$ne": ""}}))
    new = len({e for e in await db.mail_contacts.distinct("email", {"status": ST_NEW, "email": {"$ne": ""}}) if e not in used})
    fol = 0
    if s.get("followup_enabled"):
        border = (now_msk().date() - timedelta(days=int(s.get("followup_days") or 4))).isoformat()
        fol = await db.mail_contacts.count_documents(
            {"status": ST_SENT, "followup_sent": None, "first_sent": {"$lte": border}, "email": {"$ne": ""}})
    return new, fol


async def on_reply(db, c: dict):
    """Ответ пришёл: статус, запись в журнал, задача в CRM, отметка в лиде."""
    await db.mail_contacts.update_one({"id": c["id"]}, {"$set": {"status": ST_REPLY, "replied_at": now_msk().isoformat()}})
    await add_log(db, c, "ответ", True, "Пришёл ответ — проверьте почту")
    try:
        await db.tasks.insert_one({
            "id": str(uuid.uuid4()), "title": f"Ответ на рассылку: {c.get('company') or c['email']}",
            "description": f"Компания ответила на письмо ({c['email']}). Проверьте почту и ответьте.",
            "task_type": "kp", "due_date": today_str(), "due_time": "", "status": "pending",
            "created_by": "mailing", "assigned_user_id": None, "created_at": datetime.utcnow().isoformat(),
        })
    except Exception as e:
        logger.warning(f"[mailing] task create failed: {e}")
    if c.get("lead_id"):
        try:
            await db.leads.update_one({"id": c["lead_id"]}, {"$push": {"call_notes": {
                "text": "📧 Ответил на рассылку", "created_at": datetime.utcnow().isoformat()}}})
        except Exception:
            pass


async def check_inbox(db, s: dict) -> tuple:
    if not s.get("imap_host") or not password_of(s) or not s.get("login"):
        return 0, 0  # без пароля приложения ответы не проверяем (отправка через Gmail API работает и без него)
    waiting = await db.mail_contacts.find(
        {"status": {"$in": [ST_SENT, ST_FOLLOW]}, "email": {"$ne": ""}, "first_sent": {"$ne": None}}, {"_id": 0}).to_list(5000)
    if not waiting:
        return 0, 0
    replied, bounced = await asyncio.to_thread(scan_inbox_sync, s, waiting)
    by_id = {c["id"]: c for c in waiting}
    for cid in replied:
        await on_reply(db, by_id[cid])
    for cid in bounced:
        await db.mail_contacts.update_one({"id": cid}, {"$set": {"status": ST_BOUNCE, "last_error": "Письмо вернулось: адрес не существует"}})
        await add_log(db, by_id[cid], "возврат", False, "Адрес не существует")
    return len(replied), len(bounced)


async def send_one(db, contact: dict, kind: str, s: dict) -> str:
    msg = make_letter(contact, s, kind)
    label = "письмо" if kind == "first" else "напоминание"
    try:
        await deliver(db, s, msg)
    except smtplib.SMTPRecipientsRefused:
        await db.mail_contacts.update_one({"id": contact["id"]}, {"$set": {"status": ST_BOUNCE, "last_error": "Сервер отклонил адрес"}})
        await add_log(db, contact, label, False, "Сервер отклонил адрес")
        return "bounce"
    except smtplib.SMTPAuthenticationError:
        await add_log(db, contact, label, False, "Почта не приняла логин/пароль — проверьте настройки")
        return "auth"
    except GmailAuthError as e:
        await add_log(db, contact, label, False, str(e)[:300])
        return "auth"
    except Exception as e:
        await db.mail_contacts.update_one({"id": contact["id"]}, {"$set": {"status": ST_ERROR, "last_error": str(e)[:300]}})
        await add_log(db, contact, label, False, f"Ошибка: {e}")
        return "error"
    if kind == "first":
        await db.mail_contacts.update_one({"id": contact["id"]}, {"$set": {
            "status": ST_SENT, "first_sent": today_str(), "subject": str(msg["Subject"]),
            "message_id": str(msg["Message-ID"]), "last_error": None}})
        if contact.get("lead_id"):
            try:
                await db.leads.update_one({"id": contact["lead_id"]}, {"$push": {"call_notes": {
                    "text": f"📧 Отправлено письмо: {msg['Subject']}", "created_at": datetime.utcnow().isoformat()}}})
            except Exception:
                pass
    else:
        await db.mail_contacts.update_one({"id": contact["id"]}, {"$set": {"status": ST_FOLLOW, "followup_sent": today_str()}})
    await add_log(db, contact, label, True, str(msg["Subject"]))
    return "ok"


# ---------------- фоновый цикл ----------------
async def _wait(seconds: int, state: str):
    _runtime["state"] = state
    _runtime["next_at"] = (now_msk() + timedelta(seconds=seconds)).strftime("%H:%M:%S")
    _wake.clear()
    try:
        await asyncio.wait_for(_wake.wait(), timeout=seconds)
    except asyncio.TimeoutError:
        pass
    _runtime["next_at"] = None


async def mailing_loop(db):
    """Работает всегда. Отправляет, только когда в настройках running=True (переживает перезапуск сервера)."""
    await asyncio.sleep(20)
    while True:
        try:
            s = await get_settings(db)
            if not s.get("running"):
                await _wait(60, "Остановлено")
                continue
            now = now_msk()
            last = _runtime.get("last_inbox")
            if not last or (now - last).total_seconds() > 900:
                _runtime["state"] = "Проверяю входящие…"
                try:
                    await check_inbox(db, s)
                except Exception as e:
                    await add_log(db, None, "проверка почты", False, str(e)[:300])
                _runtime["last_inbox"] = now
            if s.get("weekdays_only") and now.weekday() >= 5:
                await _wait(600, "Выходной — продолжу в понедельник")
                continue
            if not (int(s["hour_start"]) <= now.hour < int(s["hour_end"])):
                await _wait(300, f"Нерабочее время — жду {s['hour_start']}:00 (Мск)")
                continue
            if await sent_today(db) >= int(s["daily_limit"]):
                await _wait(600, "Дневной лимит выполнен — продолжу завтра")
                continue
            contact, kind = await next_in_queue(db, s)
            if not contact:
                await _wait(600, "Очередь пуста — добавьте контакты с email")
                continue
            _runtime["state"] = f"Отправляю: {contact.get('company') or contact['email']}"
            result = await send_one(db, contact, kind, s)
            if result == "auth":
                await set_running(db, False)
                _runtime["state"] = "Остановлено: почта не приняла логин/пароль"
                continue
            if result == "error":
                await _wait(900, "Ошибка отправки — повтор через 15 минут")
                continue
            await _wait(random.randint(int(s["min_delay"]), int(s["max_delay"])), "Пауза между письмами")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"[mailing] loop error: {e}")
            await asyncio.sleep(60)


# ---------------- API ----------------
CONTACT_FIELDS = ("company", "email", "contact_name", "site", "city", "priority", "status", "notes")


def build_mailing_router(db, require_user, require_director) -> APIRouter:
    r = APIRouter(prefix="/mailing", tags=["mailing"])

    @r.get("/state")
    async def state(_: dict = Depends(require_user)):
        s = await get_settings(db)
        pipeline = [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]
        counts = {d["_id"]: d["n"] async for d in db.mail_contacts.aggregate(pipeline)}
        total = await db.mail_contacts.count_documents({})
        with_email = await db.mail_contacts.count_documents({"email": {"$ne": ""}})
        log = await db.mail_log.find({}, {"_id": 0}).sort("ts", -1).to_list(100)
        new, fol = await queue_sizes(db, s)
        return {
            "running": bool(s.get("running")), "state": _runtime["state"] if s.get("running") else "Остановлено",
            "next_at": _runtime["next_at"] if s.get("running") else None,
            "counts": counts, "total": total, "with_email": with_email,
            "sent_today": await sent_today(db), "limit": int(s["daily_limit"]),
            "queue_new": new, "queue_follow": fol,
            "configured": await is_configured(db, s), "log": log,
        }

    @r.post("/start")
    async def start(_: dict = Depends(require_director)):
        s = await get_settings(db)
        if not await is_configured(db, s):
            raise HTTPException(400, "Сначала заполните почту и способ отправки в настройках рассылки")
        await set_running(db, True)
        _runtime["state"] = "Запускаю…"
        _wake.set()
        return {"ok": True}

    @r.post("/stop")
    async def stop(_: dict = Depends(require_director)):
        await set_running(db, False)
        _runtime["state"] = "Остановлено"
        _wake.set()
        return {"ok": True}

    @r.post("/check-inbox")
    async def check_now(_: dict = Depends(require_user)):
        try:
            rep, bnc = await check_inbox(db, await get_settings(db))
        except Exception as e:
            raise HTTPException(400, f"Не удалось проверить почту: {e}")
        return {"replied": rep, "bounced": bnc}

    # --- контакты ---
    @r.get("/contacts")
    async def contacts(q: str = "", status: str = "", _: dict = Depends(require_user)):
        flt: dict = {}
        if status:
            flt["status"] = status
        if q.strip():
            rx = {"$regex": re.escape(q.strip()), "$options": "i"}
            flt["$or"] = [{"company": rx}, {"email": rx}, {"city": rx}, {"site": rx}]
        items = await db.mail_contacts.find(flt, {"_id": 0}).to_list(10000)
        items.sort(key=lambda c: (PRIORITY_ORDER.get((c.get("priority") or "").strip(), 3), c.get("created_at", "")))
        return items

    @r.post("/contacts")
    async def add_contact(payload: dict, _: dict = Depends(require_user)):
        company, em = (payload.get("company") or "").strip(), clean_email(payload.get("email"))
        if not company and not em:
            raise HTTPException(400, "Укажите компанию или email")
        if em and await db.mail_contacts.find_one({"email": em}):
            raise HTTPException(400, "Такой email уже есть в рассылке")
        doc = {"id": str(uuid.uuid4()), "company": company, "email": em,
               "contact_name": (payload.get("contact_name") or "").strip(), "site": payload.get("site", ""),
               "city": payload.get("city", ""), "priority": payload.get("priority", ""), "status": ST_NEW,
               "first_sent": None, "followup_sent": None, "lead_id": payload.get("lead_id"),
               "created_at": datetime.utcnow().isoformat()}
        await db.mail_contacts.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.patch("/contacts/{cid}")
    async def edit_contact(cid: str, payload: dict, _: dict = Depends(require_user)):
        upd = {k: v for k, v in payload.items() if k in CONTACT_FIELDS}
        if "email" in upd:
            raw = upd["email"]
            upd["email"] = clean_email(raw)
            if raw and not upd["email"]:
                raise HTTPException(400, "Это не похоже на email")
        if "status" in upd and upd["status"] not in STATUSES:
            raise HTTPException(400, "Неизвестный статус")
        if upd:
            await db.mail_contacts.update_one({"id": cid}, {"$set": upd})
        return {"ok": True}

    @r.delete("/contacts/{cid}")
    async def del_contact(cid: str, _: dict = Depends(require_user)):
        await db.mail_contacts.delete_one({"id": cid})
        return {"ok": True}

    async def _insert_many(rows: list) -> tuple:
        emails = set(await db.mail_contacts.distinct("email", {"email": {"$ne": ""}}))
        keys = {((c.get("company") or "").lower() + "|" + (c.get("site") or "").lower())
                async for c in db.mail_contacts.find({}, {"company": 1, "site": 1})}
        added = skipped = 0
        docs = []
        for row in rows:
            company, em = (row.get("company") or "").strip(), clean_email(row.get("email"))
            if not company and not em:
                continue
            key = company.lower() + "|" + (row.get("site") or "").lower()
            if (em and em in emails) or key in keys:
                skipped += 1
                continue
            docs.append({"id": str(uuid.uuid4()), "company": company, "email": em,
                         "contact_name": row.get("contact_name", ""), "site": row.get("site", ""),
                         "city": row.get("city", ""), "priority": row.get("priority", ""), "status": ST_NEW,
                         "first_sent": None, "followup_sent": None, "lead_id": row.get("lead_id"),
                         "created_at": datetime.utcnow().isoformat()})
            keys.add(key)
            if em:
                emails.add(em)
            added += 1
        if docs:
            await db.mail_contacts.insert_many(docs)
        return added, skipped

    @r.post("/contacts/import")
    async def import_xlsx(file: UploadFile = File(...), _: dict = Depends(require_user)):
        import openpyxl
        try:
            wb = openpyxl.load_workbook(io.BytesIO(await file.read()), data_only=True, read_only=True)
        except Exception:
            raise HTTPException(400, "Не удалось прочитать файл. Нужен .xlsx")
        ws = None
        for w in wb.worksheets:
            hdr = [str(c or "").strip().lower() for c in next(w.iter_rows(max_row=1, values_only=True), [])]
            if "компания" in hdr or "email" in hdr:
                ws = w
                break
        if ws is None:
            raise HTTPException(400, "В первой строке нет колонок «Компания» или «Email»")
        hdr = [str(c or "").strip().lower() for c in next(ws.iter_rows(max_row=1, values_only=True))]

        def col(*names):
            return next((hdr.index(n) for n in names if n in hdr), None)

        ci = dict(company=col("компания", "название", "company"), email=col("email", "e-mail", "почта"),
                  contact_name=col("имя контакта", "контакт", "имя"), site=col("сайт", "site"),
                  city=col("город / регионы", "город", "регион"), priority=col("приоритет"))
        rows = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            rows.append({k: (str(row[i]).strip() if i is not None and i < len(row) and row[i] is not None else "")
                         for k, i in ci.items()})
        added, skipped = await _insert_many(rows)
        return {"added": added, "skipped": skipped}

    @r.post("/contacts/from-leads")
    async def from_leads(payload: dict = None, _: dict = Depends(require_user)):
        payload = payload or {}
        flt = {"email": {"$nin": ["", None]}, "deleted": {"$ne": True}}
        if payload.get("industry"):
            flt["industry"] = payload["industry"]
        leads = await db.leads.find(flt, {"_id": 0}).to_list(20000)
        rows = [{"company": l.get("company") or l.get("name", ""), "email": l.get("email"),
                 "contact_name": l.get("contact_person", ""), "site": l.get("website", ""),
                 "city": l.get("city", ""), "lead_id": l.get("id")} for l in leads]
        added, skipped = await _insert_many(rows)
        return {"added": added, "skipped": skipped}

    # --- настройки и письмо ---
    @r.get("/settings")
    async def read_settings(_: dict = Depends(require_director)):
        s = await get_settings(db)
        s["password"] = PASSWORD_MASK if password_of(s) else ""
        s["password_from_env"] = bool(os.environ.get("MAIL_PASSWORD"))
        tok = await mail_token(db) or {}
        s["gmail_connected"] = tok.get("email") or ("подключён" if tok.get("refresh_token") else "")
        return s

    # --- свой Gmail для рассылки (отдельно от Google-аккаунта CRM) ---
    @r.get("/google/start")
    async def google_start(_: dict = Depends(require_director)):
        from oauth_google import build_auth_url, MAIL_AUTH_SCOPES
        try:
            auth_url, state = build_auth_url(scopes=MAIL_AUTH_SCOPES)
        except Exception as e:
            raise HTTPException(500, f"Не удалось начать подключение Google: {e}")
        await db.oauth_tokens.replace_one({"_id": MAIL_STATE_ID},
                                          {"_id": MAIL_STATE_ID, "state": state, "created_at": datetime.utcnow().isoformat()},
                                          upsert=True)
        return {"auth_url": auth_url}

    @r.delete("/google")
    async def google_disconnect(_: dict = Depends(require_director)):
        await db.oauth_tokens.delete_one({"_id": MAIL_TOKEN_ID})
        return {"ok": True}

    @r.put("/settings")
    async def write_settings(payload: dict, _: dict = Depends(require_director)):
        await save_settings(db, payload)
        return {"ok": True}

    @r.post("/test-connection")
    async def test_conn(_: dict = Depends(require_director)):
        return await asyncio.to_thread(test_connection_sync, await get_settings(db), await mail_token(db))

    @r.post("/preview")
    async def preview(payload: dict = None, _: dict = Depends(require_user)):
        s = await get_settings(db)
        payload = payload or {}
        for k in ("body", "followup_body"):
            if payload.get(k) is not None:
                s[k] = payload[k]
        if isinstance(payload.get("subjects"), str):
            s["subjects"] = [x.strip() for x in payload["subjects"].splitlines() if x.strip()]
        c = await db.mail_contacts.find_one({"company": {"$ne": ""}}, {"_id": 0}) or {
            "company": "Пример компании", "contact_name": "", "email": "test@example.com"}
        c = {**c, "email": c.get("email") or "test@example.com"}
        first = make_letter(c, s, "first")
        follow = make_letter({**c, "subject": str(first["Subject"])}, s, "follow")
        return {"company": c.get("company", ""),
                "first": {"subject": str(first["Subject"]), "body": first.get_content()},
                "follow": {"subject": str(follow["Subject"]), "body": follow.get_content()}}

    @r.post("/test-email")
    async def test_email(payload: dict, _: dict = Depends(require_director)):
        to = clean_email(payload.get("to"))
        if not to:
            raise HTTPException(400, "Укажите свой email для проверки")
        s = await get_settings(db)
        msg = make_letter({"company": "Пример компании", "contact_name": "", "email": to}, s, "first")
        try:
            await deliver(db, s, msg)
        except Exception as e:
            raise HTTPException(400, f"Не отправилось: {e}")
        await add_log(db, None, "тест", True, f"Пробное письмо на {to}")
        return {"ok": True}

    return r
