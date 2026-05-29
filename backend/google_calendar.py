"""
Google Calendar API v3 integration for CRM.
Token doc is fetched by the async caller (server.py) and passed in directly —
no async calls happen inside these sync functions.
"""
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# colorId mapping: https://developers.google.com/calendar/api/v3/reference/colors/get
# 7 = peacock (blue), 9 = blueberry (dark blue), 10 = basil (green), 8 = graphite
_STATUS_COLOR: Dict[str, str] = {
    "new":        "9",   # blueberry
    "in_progress": "7",  # peacock
    "delivered":  "10",  # basil (green)
    "cancelled":  "8",   # graphite
}


def _build_service(token_doc: Dict[str, Any]):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    if not token_doc:
        raise ValueError("No Google OAuth token stored — user must authorize first")

    creds = Credentials(
        token=token_doc.get("access_token"),
        refresh_token=token_doc.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/calendar"],
    )
    if not creds.valid and creds.refresh_token:
        creds.refresh(Request())

    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _event_body(order: dict) -> dict:
    load_date = (order.get("load_date") or "").strip()
    unload_date = (order.get("unload_date") or "").strip()

    if not load_date:
        raise ValueError("load_date is required to create a calendar event")

    if not unload_date or unload_date < load_date:
        unload_date = load_date

    # All-day events: end date is exclusive, so add 1 day to unload_date
    end_dt = datetime.strptime(unload_date, "%Y-%m-%d") + timedelta(days=1)
    end_date = end_dt.strftime("%Y-%m-%d")

    status = order.get("status", "new")
    color_id = _STATUS_COLOR.get(status, "7")

    desc_lines = [
        f"Маршрут: {order.get('route_from', '—')} → {order.get('route_to', '—')}",
        f"Клиент: {order.get('client_name', '—')}",
        f"Перевозчик: {order.get('carrier_name', '—')}",
        f"Ставка клиента: {order.get('client_rate', 0)} Br",
        f"Ставка перевозчика: {order.get('carrier_rate', 0)} Br",
    ]
    if order.get("cargo"):
        desc_lines.append(f"Груз: {order['cargo']}")
    if order.get("notes"):
        desc_lines.append(f"Заметки: {order['notes']}")

    return {
        "summary": f"Заявка №{order.get('order_number', '')} | {order.get('client_name', '—')}",
        "description": "\n".join(desc_lines),
        "start": {"date": load_date},
        "end": {"date": end_date},
        "colorId": color_id,
    }


def create_calendar_event(order: dict, token_doc: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """Create event in primary Google Calendar.

    Returns {"event_id": ..., "html_link": ...} or None on failure.
    """
    try:
        service = _build_service(token_doc)
        body = _event_body(order)
        result = service.events().insert(calendarId="primary", body=body).execute()
        return {
            "event_id": result.get("id", ""),
            "html_link": result.get("htmlLink", ""),
        }
    except Exception as e:
        logger.error(f"create_calendar_event failed: {e}")
        return None


def update_calendar_event(event_id: str, order: dict, token_doc: Dict[str, Any]) -> None:
    try:
        service = _build_service(token_doc)
        body = _event_body(order)
        service.events().update(
            calendarId="primary", eventId=event_id, body=body
        ).execute()
    except Exception as e:
        logger.error(f"update_calendar_event failed: {e}")


def delete_calendar_event(event_id: str, token_doc: Dict[str, Any]) -> None:
    try:
        service = _build_service(token_doc)
        service.events().delete(calendarId="primary", eventId=event_id).execute()
    except Exception as e:
        logger.error(f"delete_calendar_event failed: {e}")


def create_simple_calendar_event(title: str, date: str, description: str, token_doc: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """Create a simple all-day event with arbitrary title/date/description."""
    try:
        service = _build_service(token_doc)
        end_dt = datetime.strptime(date, "%Y-%m-%d") + timedelta(days=1)
        body = {
            "summary": title,
            "description": description,
            "start": {"date": date},
            "end": {"date": end_dt.strftime("%Y-%m-%d")},
            "colorId": "11",
        }
        result = service.events().insert(calendarId="primary", body=body).execute()
        return {"event_id": result.get("id", ""), "html_link": result.get("htmlLink", "")}
    except Exception as e:
        logger.error(f"create_simple_calendar_event failed: {e}")
        return None
