"""«Чаты»: список переписок и сама переписка из Gmail — без сети, ответы Gmail подменены."""
import base64
import os
import sys
from email.message import EmailMessage

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mailing  # noqa: E402

ME = "me@gmail.com"


def raw_mail(frm, to, subject, body):
    m = EmailMessage()
    m["From"], m["To"], m["Subject"], m["Message-ID"] = frm, to, subject, f"<{abs(hash(subject))}@test>"
    m.set_content(body)
    return m.as_bytes()


def h(frm, to, subject="Тема"):
    return {"payload": {"headers": [{"name": "From", "value": frm}, {"name": "To", "value": to},
                                    {"name": "Subject", "value": subject}]}}


def test_peer_is_first_foreign_sender_or_recipient():
    hs = [{"from": f"Я <{ME}>", "to": "Иван <ivan@firm.by>"}, {"from": "Иван <ivan@firm.by>", "to": ME}]
    assert mailing.chat_peer(hs, ME) == ("Иван", "ivan@firm.by")
    # все письма наши — собеседник тот, кому писали
    assert mailing.chat_peer([{"from": ME, "to": "Petr <petr@x.by>, other@x.by"}], ME) == ("Petr", "petr@x.by")


def test_chats_list_and_thread(monkeypatch):
    threads = {
        "t1": [{"id": "m1", "internalDate": "1000", "snippet": "привет", "labelIds": ["INBOX"], **h(f"<{ME}>", "a@x.by", "Счёт")},
               {"id": "m2", "internalDate": "3000", "snippet": "ответ", "labelIds": ["INBOX", "UNREAD"], **h("Анна <a@x.by>", ME, "Re: Счёт")}],
        "t2": [{"id": "m3", "internalDate": "2000", "snippet": "моё", "labelIds": ["SENT"], **h(ME, "b@y.by", "КП")}],
    }
    raws = {"m1": raw_mail(ME, "a@x.by", "Счёт", "Добрый день"), "m2": raw_mail("Анна <a@x.by>", ME, "Re: Счёт", "Получили")}

    def fake_get(access, path, **params):
        if path == "threads":
            assert params["q"].startswith("(in:sent OR (in:inbox -category:promotions")  # отправленные — все, без фильтров
            return {"threads": [{"id": "t2"}, {"id": "t1"}], "nextPageToken": "p2"}
        if path.startswith("threads/"):
            return {"messages": threads[path.split("/")[1]]}
        raise AssertionError(path)

    monkeypatch.setattr(mailing, "_gmail_access_token", lambda tok: "x")
    monkeypatch.setattr(mailing, "_gmail_get", fake_get)
    monkeypatch.setattr(mailing, "_raw_of", lambda access, mid: (raws[mid], {}))

    res = mailing.gmail_chats_sync({}, ME)
    assert [c["id"] for c in res["chats"]] == ["t1", "t2"]  # свежие сверху
    t1, t2 = res["chats"]
    assert (t1["peer_email"], t1["gmail_unread"], t1["last_from_me"], t1["count"]) == ("a@x.by", True, False, 2)
    assert (t2["peer_email"], t2["last_from_me"]) == ("b@y.by", True)
    assert res["next_page"] == "p2"

    th = mailing.gmail_chat_sync({}, ME, "t1")
    assert [m["from_me"] for m in th["messages"]] == [True, False]
    assert th["messages"][1]["text"] == "Получили"
    assert th["peer_email"] == "a@x.by"


def test_login_expired_only_on_invalid_grant(monkeypatch):
    import asyncio
    mailing._login_checks.clear()
    errors = {"a": None, "b": mailing.GmailAuthError("... (invalid_grant: Token has been expired or revoked.)"),
              "c": mailing.GmailAuthError("... (connection reset)")}

    def fake(tok):
        if errors[tok["refresh_token"]]:
            raise errors[tok["refresh_token"]]
        return "x"
    monkeypatch.setattr(mailing, "_gmail_access_token", fake)
    ok = lambda rt: asyncio.run(mailing.gmail_login_ok({"refresh_token": rt}))
    assert (ok("a"), ok("b"), ok("c")) == (True, False, True)
    assert asyncio.run(mailing.gmail_login_ok(None)) is True  # не подключён — не «вышел»
    errors["b"] = None
    assert ok("b") is False  # результат держится 10 минут
