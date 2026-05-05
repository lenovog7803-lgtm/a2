"""
Google Tasks API integration for CRM.
token_doc is fetched by the async caller (server.py) and passed in directly —
no async calls happen inside these sync functions.
"""
import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

TASK_LIST_NAME = "CRM Tasks"


def _build_service(token_doc: Dict[str, Any]):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    if not token_doc:
        raise ValueError("No Google OAuth token stored — user must authorize first")

    creds = Credentials(
        token=token_doc.get("access_token"),
        refresh_token=token_doc.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/tasks"],
    )
    if not creds.valid and creds.refresh_token:
        creds.refresh(Request())

    return build("tasks", "v1", credentials=creds, cache_discovery=False)


def _get_or_create_tasklist(service) -> str:
    result = service.tasklists().list(maxResults=100).execute()
    for tl in result.get("items", []):
        if tl.get("title") == TASK_LIST_NAME:
            return tl["id"]
    new_list = service.tasklists().insert(body={"title": TASK_LIST_NAME}).execute()
    return new_list["id"]


def _due_rfc3339(due_date: str, due_time: str) -> Optional[str]:
    if not due_date:
        return None
    t = due_time.strip() if due_time else ""
    if t and len(t) >= 5:
        return f"{due_date}T{t}:00Z"
    return f"{due_date}T00:00:00Z"


def _task_body(task: dict) -> dict:
    body: dict = {
        "title": task.get("title") or "(без названия)",
        "notes": task.get("description") or "",
    }
    due = _due_rfc3339(task.get("due_date", ""), task.get("due_time", ""))
    if due:
        body["due"] = due
    body["status"] = "completed" if task.get("status") == "done" else "needsAction"
    return body


def create_google_task(task: dict, token_doc: Dict[str, Any]) -> Optional[str]:
    """Create task in Google Tasks. Returns google_task_id or None."""
    try:
        service = _build_service(token_doc)
        tasklist_id = _get_or_create_tasklist(service)
        result = service.tasks().insert(tasklist=tasklist_id, body=_task_body(task)).execute()
        return result.get("id")
    except Exception as e:
        logger.error(f"create_google_task failed: {e}")
        return None


def update_google_task(google_task_id: str, task: dict, token_doc: Dict[str, Any]):
    try:
        service = _build_service(token_doc)
        tasklist_id = _get_or_create_tasklist(service)
        body = _task_body(task)
        body["id"] = google_task_id
        service.tasks().update(
            tasklist=tasklist_id, task=google_task_id, body=body
        ).execute()
    except Exception as e:
        logger.error(f"update_google_task failed: {e}")


def delete_google_task(google_task_id: str, token_doc: Dict[str, Any]):
    try:
        service = _build_service(token_doc)
        tasklist_id = _get_or_create_tasklist(service)
        service.tasks().delete(tasklist=tasklist_id, task=google_task_id).execute()
    except Exception as e:
        logger.error(f"delete_google_task failed: {e}")
