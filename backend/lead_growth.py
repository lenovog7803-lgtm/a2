"""Measures and qualification fields for A2 Group's outbound leads."""

from collections import defaultdict
from datetime import date, datetime, timedelta
import math
import re
from statistics import median
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

TRACKS = ("marketplace", "lookalike")
COMPLETED = ("done", "delivered", "Доставлено", "Завершён", "Завершено")
MINSK = ZoneInfo("Europe/Minsk")
SIGNAL_WEIGHTS = {
    "quote_request": 5,
    "warehouse_supply": 4,
    "warehouse_opening": 3,
    "new_channel": 2,
    "hiring": 1,
}
ORDER_FIELDS = {
    "_id": 0, "id": 1, "order_number": 1, "client_id": 1, "client_name": 1, "route_from": 1, "route_to": 1,
    "unload_date": 1, "load_date": 1, "created_at": 1, "client_rate": 1, "carrier_rate": 1,
    "client_paid": 1, "client_paid_date": 1, "client_pp_date": 1, "client_payments": 1,
}
CLIENT_FIELDS = {"_id": 0, "id": 1, "name": 1, "phone": 1, "contact_person": 1}


class LeadQualification(BaseModel):
    platform: str = Field(default="", max_length=32)
    scheme: str = Field(default="", max_length=32)
    warehouse: str = Field(default="", max_length=160)
    packaging: str = Field(default="", max_length=160)
    pickup_city: str = Field(default="", max_length=120)
    delivery_city: str = Field(default="", max_length=120)
    cargo: str = Field(default="", max_length=240)
    volume: str = Field(default="", max_length=120)
    frequency: str = Field(default="", max_length=120)
    next_shipment: date | None = None
    payment_terms: str = Field(default="", max_length=160)
    decision_maker: str = Field(default="", max_length=160)
    quote_requested: bool = False


def day(value):
    if isinstance(value, datetime):
        return value.astimezone(MINSK).date() if value.tzinfo else value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        try:
            return day(datetime.fromisoformat(value))
        except ValueError:
            try:
                return datetime.strptime(value, "%d.%m.%Y").date()
            except ValueError:
                pass
    return None


def amount(value):
    try:
        number = float(value or 0)
        return number if math.isfinite(number) else 0
    except (TypeError, ValueError):
        return 0


def order_day(order):
    return day(order.get("unload_date")) or day(order.get("load_date")) or day(order.get("created_at"))


def payment_day(order):
    dates = [day(p.get("pp_date")) for p in order.get("client_payments") or [] if isinstance(p, dict)]
    return max(filter(None, dates), default=None) or day(order.get("client_pp_date")) or day(order.get("client_paid_date"))


def company_name(value):
    text = re.sub(r"[^\w\s]", " ", str(value or "").casefold().replace("ё", "е"))
    text = re.sub(r"\b(?:ооо|чтуп|чуп|зао|оао|ао|ип|сооо|одо|уп)\b", " ", text)
    return " ".join(text.split())


def group_orders(orders, clients):
    clients_by_id = {client["id"] for client in clients if client.get("id")}
    names = defaultdict(set)
    for client in clients:
        name = company_name(client.get("name"))
        if name and client.get("id"):
            names[name].add(client["id"])
    groups = defaultdict(list)
    for order in orders:
        cid = order.get("client_id")
        if cid not in clients_by_id:
            matches = names[company_name(order.get("client_name"))]
            cid = next(iter(matches)) if len(matches) == 1 else None
        if cid:
            groups[cid].append(order)
    return groups


def priority_leads(leads, today, limit=7):
    def rank(lead):
        signal_day = day(lead.get("signal_date"))
        weight = SIGNAL_WEIGHTS.get(lead.get("signal_type"), 0)
        if not signal_day or not 0 <= (today - signal_day).days <= 30:
            weight = 0
        return (
            weight,
            amount(lead.get("heat_score")),
            bool(lead.get("phone") or lead.get("email")),
            str(lead.get("created_at") or ""),
            str(lead.get("id") or ""),
        )
    return sorted(leads, key=rank, reverse=True)[:limit]


def paid_conversion(leads, orders, clients, *, start, today):
    """Cohort by lead arrival; count completed customer-paid orders up to the report date."""
    result = {
        track: {
            "track": track, "leads": 0, "quote_requested": 0, "first_paid": 0,
            "repeat_paid": 0, "margin": 0, "paid_orders": 0,
            "payment_days": None, "payment_dates": 0,
        }
        for track in TRACKS
    }
    client_leads = {}
    for lead in sorted(leads, key=lambda row: str(row.get("created_at") or "")):
        arrival = day(lead.get("created_at"))
        totals = result.get(lead.get("codex_track"))
        if totals is None or not arrival or arrival > today:
            continue
        if lead.get("client_id"):
            client_leads.setdefault(lead["client_id"], (lead, arrival))
        if arrival < start:
            continue
        totals["leads"] += 1
        totals["quote_requested"] += int(bool((lead.get("qualification") or {}).get("quote_requested")))

    delays = defaultdict(list)
    assigned_orders = set()
    for cid, client_orders in group_orders(orders, clients).items():
        if cid not in client_leads:
            continue
        lead, arrival = client_leads[cid]
        if arrival < start:
            continue
        totals = result[lead["codex_track"]]
        paid = 0
        for order in client_orders:
            shipment, payment = order_day(order), payment_day(order)
            order_id = order.get("id")
            if (
                not shipment or not arrival <= shipment <= today
                or order_id in assigned_orders
                or (payment and (payment < arrival or payment > today))
                or not order.get("client_paid")
            ):
                continue
            if order_id:
                assigned_orders.add(order_id)
            paid += 1
            totals["margin"] += amount(order.get("client_rate")) - amount(order.get("carrier_rate"))
            if payment:
                delays[lead["codex_track"]].append(max(0, (payment - shipment).days))
        totals["paid_orders"] += paid
        totals["first_paid"] += int(paid >= 1)
        totals["repeat_paid"] += int(paid >= 2)

    for track, totals in result.items():
        totals["margin"] = round(totals["margin"], 2)
        if delays[track]:
            totals["payment_days"] = median(delays[track])
            totals["payment_dates"] = len(delays[track])
    return list(result.values())


def reactivation_list(tasks, orders, clients, today, limit=5):
    """Prioritize the CRM's existing outreach tasks by twelve-month margin."""
    eligible = {row["id"]: row for row in clients if row.get("id")}
    grouped = group_orders(orders, clients)
    suggested = []
    for task in tasks:
        cid = task.get("client_id")
        client = eligible.get(cid)
        if not client:
            continue
        history = [(order_day(o), o) for o in grouped.get(cid, [])]
        history = [(shipped, o) for shipped, o in history if shipped and shipped <= today]
        if not history:
            continue
        last_day, last_order = max(history, key=lambda pair: pair[0])
        days_idle = (today - last_day).days
        if days_idle < 21 or days_idle > 180 or last_day > (day(task.get("last_order_day")) or last_day):
            continue
        margin = sum(amount(o.get("client_rate")) - amount(o.get("carrier_rate"))
                     for shipped, o in history if shipped >= today - timedelta(days=365))
        if margin <= 0:
            continue
        route = " → ".join(filter(None, (last_order.get("route_from"), last_order.get("route_to"))))
        suggested.append({
            "task_id": task.get("id"), "client_id": cid, "company": client.get("name"),
            "phone": client.get("phone") or "", "contact_person": client.get("contact_person") or "",
            "last_day": last_day.isoformat(), "last_route": route, "days_idle": days_idle,
            "last_order_id": last_order.get("id"), "last_order_number": last_order.get("order_number"),
            "margin_year": round(margin, 2),
            "question": f"Планируются ли новые грузы по маршруту {route}?" if route else "Какие отгрузки планируете сейчас?",
        })
    suggested.sort(key=lambda row: (-row["margin_year"], row["company"] or ""))
    return suggested[:limit]
