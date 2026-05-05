"""
OAuth2 авторизация пользователя через Google для генерации Google Docs.
Service Account не имеет своего Drive хранилища — поэтому документы создаются
ОТ ИМЕНИ ПОЛЬЗОВАТЕЛЯ, в его Drive (квота берётся из его Google One).

Flow:
1. POST /api/auth/google/start  -> возвращает auth_url
2. Пользователь открывает auth_url, авторизуется, Google редиректит на /api/auth/google/callback?code=...
3. Backend обменивает code -> refresh_token, сохраняет в Mongo (collection 'oauth_tokens')
4. При генерации документа docs_gen берёт refresh_token, получает access_token, вызывает Drive/Docs API
"""
import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any

from google.oauth2.credentials import Credentials as UserCredentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow

logger = logging.getLogger(__name__)
ROOT_DIR = Path(__file__).parent

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/tasks",
]


def get_client_config() -> Optional[Dict[str, Any]]:
    cid = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    cs = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    if not cid or not cs:
        return None
    return {
        "web": {
            "client_id": cid,
            "client_secret": cs,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        }
    }


PRODUCTION_REDIRECT_URI = "https://logistics-crm-backend.onrender.com/api/auth/google/callback"


def get_redirect_uri() -> str:
    base = (
        os.environ.get("PUBLIC_BACKEND_URL")
        or os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
    )
    if base:
        return f"{base}/api/auth/google/callback"
    return PRODUCTION_REDIRECT_URI


def build_flow(redirect_uri: Optional[str] = None) -> Flow:
    cfg = get_client_config()
    if not cfg:
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_ID и GOOGLE_OAUTH_CLIENT_SECRET не заданы в .env")
    flow = Flow.from_client_config(cfg, scopes=SCOPES)
    flow.redirect_uri = redirect_uri or get_redirect_uri()
    # Явно отключаем PKCE: code_verifier порождает code_challenge в authorization_url,
    # но при token exchange в callback создаётся новый flow-объект без него → "Missing code verifier"
    flow.code_verifier = None
    return flow


def make_user_credentials(token_doc: Dict[str, Any]) -> UserCredentials:
    cfg = get_client_config()
    if not cfg:
        raise RuntimeError("OAuth не настроен")
    web = cfg["web"]
    creds = UserCredentials(
        token=token_doc.get("access_token"),
        refresh_token=token_doc.get("refresh_token"),
        token_uri=web["token_uri"],
        client_id=web["client_id"],
        client_secret=web["client_secret"],
        scopes=SCOPES,
    )
    if not creds.valid:
        creds.refresh(Request())
    return creds
