"""
OAuth2 авторизация пользователя через Google для генерации Google Docs.
Использует requests_oauthlib.OAuth2Session напрямую — без PKCE.

Flow:
1. build_auth_url()  -> (auth_url, state)
2. Пользователь открывает auth_url, Google редиректит на /api/auth/google/callback?code=...
3. fetch_token(code, state)  -> token_doc (access_token, refresh_token, ...)
4. make_user_credentials(token_doc)  -> UserCredentials для Drive/Docs/Tasks API
"""
import os
import logging
from typing import Optional, Dict, Any, Tuple

from requests_oauthlib import OAuth2Session
from google.oauth2.credentials import Credentials as UserCredentials
from google.auth.transport.requests import Request

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]

AUTHORIZATION_BASE_URL = "https://accounts.google.com/o/oauth2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"

PRODUCTION_REDIRECT_URI = "https://logistics-crm-backend.onrender.com/api/auth/google/callback"


def _client_id() -> str:
    v = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    if not v:
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_ID не задан в .env")
    return v


def _client_secret() -> str:
    v = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
    if not v:
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_SECRET не задан в .env")
    return v


def get_redirect_uri() -> str:
    base = (
        os.environ.get("PUBLIC_BACKEND_URL")
        or os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
    )
    if base:
        return f"{base}/api/auth/google/callback"
    return PRODUCTION_REDIRECT_URI


def build_auth_url(redirect_uri: Optional[str] = None) -> Tuple[str, str]:
    """Возвращает (auth_url, state). PKCE не используется."""
    uri = redirect_uri or get_redirect_uri()
    oauth = OAuth2Session(
        client_id=_client_id(),
        scope=SCOPES,
        redirect_uri=uri,
    )
    auth_url, state = oauth.authorization_url(
        AUTHORIZATION_BASE_URL,
        access_type="offline",
        prompt="consent",
    )
    return auth_url, state


def fetch_token(code: str, state: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
    """Обменивает code на токены. Возвращает dict с access_token, refresh_token и др."""
    uri = redirect_uri or get_redirect_uri()
    oauth = OAuth2Session(
        client_id=_client_id(),
        redirect_uri=uri,
        state=state,
    )
    token = oauth.fetch_token(
        TOKEN_URL,
        code=code,
        client_secret=_client_secret(),
        include_client_id=True,
    )
    return token


def make_user_credentials(token_doc: Dict[str, Any]) -> Tuple[UserCredentials, Optional[str]]:
    """Returns (credentials, new_access_token_or_None).
    Always forces a refresh when refresh_token is present so callers get a
    non-expired token and can persist the new access_token back to the DB.
    """
    creds = UserCredentials(
        token=token_doc.get("access_token"),
        refresh_token=token_doc.get("refresh_token"),
        token_uri=TOKEN_URL,
        client_id=_client_id(),
        client_secret=_client_secret(),
        scopes=SCOPES,
    )
    new_token: Optional[str] = None
    if creds.refresh_token:
        try:
            creds.refresh(Request())
            new_token = creds.token
        except Exception as e:
            logger.warning(f"Token refresh failed: {e}")
    elif not creds.valid:
        logger.warning("No refresh_token and credentials are invalid")
    return creds, new_token
