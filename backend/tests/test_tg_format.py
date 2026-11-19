"""Сообщения бота: единый шаблон, теги закрыты, в лимит Telegram укладываются."""
import ast, re, os, html, pathlib
from typing import Optional

src = pathlib.Path(__file__).resolve().parents[1].joinpath("server.py").read_text(encoding="utf-8")
WANT = {"_esc", "_byn", "_tg_buttons", "_tg_head", "_tg_table", "_tg_list", "_fmt_leg", "fmt_date_ru",
        "format_report_text", "format_morning_text", "format_fleet_briefing_text"}
VARS = {"_CRM_URL", "_TG_PAGES", "_REPORT_LABELS", "_RU_MONTHS", "TAX_RATE"}
ns = {"re": re, "os": os, "_html": html, "Optional": Optional}
for node in ast.parse(src).body:   # только форматтеры, без запуска всего сервера
    name = getattr(node, "name", None) or (getattr(node.targets[0], "id", None) if isinstance(node, ast.Assign) else None)
    if name in WANT | VARS:
        exec(compile(ast.Module([node], []), "server.py", "exec"), ns)

LEG = {"order_number": "A2-512", "route_from": "Минск", "route_to": "Москва", "client_name": "ООО «Ромашка & Ко»", "carrier_name": "ИП Петров"}
REPORT = {"period": "daily", "generated_at": "2026-11-16T18:00:00", "basis": "unload", "revenue": 12450, "margin": 2310, "net_profit": 1848,
          "orders_count": 5, "delivered": 3, "client_paid_count": 2, "client_paid_sum": 4200, "carrier_paid_count": 1, "carrier_paid_sum": 1500,
          "overdue_carrier_count": 2, "overdue_carrier_sum": 3100, "debtors_count": 7, "debtors_sum": 34120, "calls_total": 25, "calls_won": 1,
          "top_clients": [("Ромашка", 5200), ("Лютик", 3100)], "tomorrow_date": "2026-11-17", "tomorrow_loads": [LEG] * 6, "tomorrow_unloads": []}
MORNING = {"date": "2026-11-16", "loads": [LEG, LEG], "unloads": [],
           "carrier_pay_today": [{"id": "ord-1", "order_number": "A2-512", "carrier_name": "ИП Петров", "amount": 800, "overdue": False}],
           "client_pay_today": [{"id": "ord-2", "order_number": "A2-510", "client_name": "ООО «Ромашка»", "amount": 2100, "overdue": True}],
           "delayed_docs": [{"id": "ord-3", "order_number": "A2-498", "carrier_name": "ИП Сидоров", "phone": "+375291234567", "days_waiting": 7}],
           "tasks": [{"title": "Позвонить <Ромашке>", "due_time": "10:00", "overdue": False}, {"title": "Счёт Лютику", "due_time": "", "overdue": True}]}
FLEET = {"date": "2026-11-16", "loads_today": [{"order_number": "F-7", "route": "Минск → Брест", "client_name": "Лютик", "vehicle": "AB 1234-7"}],
         "loads_tomorrow": [], "unloads_today": [], "overdue": [{"client_name": "Лютик", "amount": 520.0, "days": 12, "order_number": "F-3"}], "to_invoice": []}


def ok(text):
    assert len(text) < 4096
    for tag in ("b", "i", "pre", "blockquote"):
        assert len(re.findall(rf"<{tag}[ >]", text)) == text.count(f"</{tag}>"), tag
    assert "<Ромашке>" not in text   # названия экранируются, иначе Telegram отвергнет сообщение
    return text


def test_all_formats():
    texts = [ok(ns["format_report_text"](dict(REPORT, period=p)) ) for p in ("daily", "weekly", "quarterly")]
    texts += [ok(ns["format_morning_text"](MORNING)), ok(ns["format_fleet_briefing_text"](FLEET))]
    assert "blockquote expandable" in texts[0] and texts[0].count("<pre>") == 1   # 6 загрузок свёрнуты, цифры одним блоком
    assert ns["_tg_buttons"](["orders", ""])["inline_keyboard"][0][0]["url"].endswith("/?p=orders")
    return texts


if __name__ == "__main__":
    for t in test_all_formats():
        print(t, "\n" + "=" * 40)
