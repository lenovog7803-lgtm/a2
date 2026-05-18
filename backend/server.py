from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, asyncio, hashlib, secrets
import jwt as _jwt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Google Sheets sync (lazy import to keep module-level safe even if libs missing)
try:
    from sheets_sync import trigger_sync as _sheets_trigger_sync, get_sync as _get_sheets_sync
except Exception as _e:  # pragma: no cover
    _sheets_trigger_sync = None
    _get_sheets_sync = None
    logging.getLogger(__name__).warning(f"sheets_sync import failed: {_e}")

try:
    from sheets_import import run_import as _sheets_run_import, get_last_status as _sheets_import_status
except Exception as _e:  # pragma: no cover
    _sheets_run_import = None
    _sheets_import_status = None
    logging.getLogger(__name__).warning(f"sheets_import import failed: {_e}")

try:
    from sheets_writer import (push_order as _sw_push_order, push_client as _sw_push_client,
                                push_carrier as _sw_push_carrier, delete_order as _sw_delete_order,
                                push_lead as _sw_push_lead, delete_lead as _sw_delete_lead, delete_client as _sw_delete_client)
except Exception as _e:  # pragma: no cover
    _sw_push_order = _sw_push_client = _sw_push_carrier = _sw_delete_order = _sw_push_lead = _sw_delete_lead = _sw_delete_client = None
    logging.getLogger(__name__).warning(f"sheets_writer import failed: {_e}")

try:
    from docs_gen import get_generator as _docs_get_generator, kind_to_field as _docs_kind_to_field, TEMPLATES as _DOC_TEMPLATES
except Exception as _e:  # pragma: no cover
    _docs_get_generator = None
    _docs_kind_to_field = None
    _DOC_TEMPLATES = {}
    logging.getLogger(__name__).warning(f"docs_gen import failed: {_e}")

try:
    from google_tasks import (create_google_task as _gt_create,
                               update_google_task as _gt_update,
                               delete_google_task as _gt_delete)
except Exception as _e:  # pragma: no cover
    _gt_create = _gt_update = _gt_delete = None
    logging.getLogger(__name__).warning(f"google_tasks import failed: {_e}")

try:
    from google_calendar import (create_calendar_event as _gc_create,
                                  update_calendar_event as _gc_update,
                                  delete_calendar_event as _gc_delete)
except Exception as _e:  # pragma: no cover
    _gc_create = _gc_update = _gc_delete = None
    logging.getLogger(__name__).warning(f"google_calendar import failed: {_e}")

try:
    from oauth_google import (
        build_auth_url as _oauth_build_auth_url,
        fetch_token as _oauth_fetch_token,
        get_redirect_uri as _oauth_get_redirect,
        SCOPES as _OAUTH_SCOPES,
    )
except Exception as _e:  # pragma: no cover
    _oauth_build_auth_url = None
    _oauth_fetch_token = None
    _oauth_get_redirect = None
    _OAUTH_SCOPES = []
    logging.getLogger(__name__).warning(f"oauth_google import failed: {_e}")


# Регистрируем провайдер user-credentials для генерации документов
async def _get_oauth_token_doc():
    """Прочитать сохранённый refresh_token из коллекции oauth_tokens."""
    return await db.oauth_tokens.find_one({"_id": "google"}, {"_id": 0})


def _sync_user_creds_provider():
    """gspread/Drive API ожидают синхронную функцию. Запускаем async через временный loop."""
    import asyncio as _asyncio
    try:
        loop = _asyncio.get_event_loop()
    except RuntimeError:
        loop = _asyncio.new_event_loop()
    if loop.is_running():
        # вызывается из потока (asyncio.to_thread) — создаём новый loop
        new_loop = _asyncio.new_event_loop()
        try:
            return new_loop.run_until_complete(_get_oauth_token_doc())
        finally:
            new_loop.close()
    return loop.run_until_complete(_get_oauth_token_doc())


if _docs_get_generator is not None:
    try:
        _docs_get_generator().set_user_credentials_provider(_sync_user_creds_provider)
    except Exception as _e:
        logging.getLogger(__name__).warning(f"docs_gen user creds wiring failed: {_e}")


async def _bg_sheets_sync():
    """Полная пересинхронизация ОТКЛЮЧЕНА (опасно — может перезаписать).
    Вместо этого — точечный upsert в _bg_push_order/_bg_push_client/_bg_push_carrier.
    """
    return  # no-op


async def _bg_push_order(order_obj: dict):
    if _sw_push_order is None:
        return
    try:
        await _sw_push_order(order_obj)
    except Exception as e:
        logging.getLogger(__name__).error(f"push_order bg failed: {e}")


async def _bg_push_client(client_obj: dict):
    if _sw_push_client is None:
        return
    try:
        await _sw_push_client(client_obj)
    except Exception as e:
        logging.getLogger(__name__).error(f"push_client bg failed: {e}")


async def _bg_push_carrier(carrier_obj: dict):
    if _sw_push_carrier is None:
        return
    try:
        await _sw_push_carrier(carrier_obj)
    except Exception as e:
        logging.getLogger(__name__).error(f"push_carrier bg failed: {e}")


async def _bg_push_lead(lead_obj: dict):
    if _sw_push_lead is None:
        return
    try:
        await _sw_push_lead(lead_obj)
    except Exception as e:
        logging.getLogger(__name__).error(f"push_lead bg failed: {e}", exc_info=True)


async def _bg_delete_lead(name: str):
    if not name or _sw_delete_lead is None:
        return
    try:
        await _sw_delete_lead(name)
    except Exception as e:
        logging.getLogger(__name__).error(f"delete_lead bg failed: {e}", exc_info=True)

async def _bg_delete_client(name: str):
    if not name or _sw_delete_client is None:
        return
    try:
        await _sw_delete_client(name)
    except Exception as e:
        logging.getLogger(__name__).error(f"delete_client bg failed: {e}", exc_info=True)


async def _bg_trigger_apps_script(order_number: str):
    url = os.environ.get("GOOGLE_APPS_SCRIPT_URL")
    if not url:
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(url, json={"orderNumber": order_number})
    except Exception as e:
        logging.getLogger(__name__).error(f"apps_script trigger failed: {e}")


async def _bg_delete_order_row(order_number: str):
    if _sw_delete_order is None or not order_number:
        return
    try:
        await _sw_delete_order(order_number)
    except Exception as e:
        logging.getLogger(__name__).error(f"delete_order bg failed: {e}")


async def _auto_sync_loop():
    while True:
        await asyncio.sleep(600)  # каждые 10 минут
        # keep-alive ping
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                await client.get("https://logistics-crm-backend.onrender.com/api/ping", timeout=10)
        except Exception:
            pass
        if _sheets_run_import is None:
            continue
        try:
            await _sheets_run_import(db)
        except Exception as e:
            logging.getLogger(__name__).error(f"auto sync failed: {e}")


# ====== Backup helpers ======
_BACKUP_COLLECTIONS = ["orders", "clients", "carriers", "leads", "tasks", "users"]
_TRASH_COLLECTIONS = ["orders", "clients", "carriers", "leads"]


async def _create_backup():
    snapshot: dict = {}
    for cname in _BACKUP_COLLECTIONS:
        docs = await db[cname].find({}, {"_id": 0}).to_list(100000)
        snapshot[cname] = docs
    backup_doc = {
        "id": str(uuid.uuid4()),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": now_iso(),
        "collections": snapshot,
    }
    await db.backups.insert_one(backup_doc)
    # Keep only last 30 backups
    all_bk = await db.backups.find({}, {"_id": 1, "created_at": 1}).sort("created_at", -1).to_list(100)
    if len(all_bk) > 30:
        await db.backups.delete_many({"_id": {"$in": [b["_id"] for b in all_bk[30:]]}})
    logging.getLogger(__name__).info(f"Backup created: {backup_doc['id']}")


async def _purge_old_trash():
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    for cname in _TRASH_COLLECTIONS:
        await db[cname].delete_many({"deleted": True, "deleted_at": {"$lt": cutoff}})
    logging.getLogger(__name__).info("Trash auto-purge completed")


async def _backup_loop():
    last_date = None
    while True:
        now = datetime.now(timezone.utc)
        if now.hour == 23 and now.minute == 0 and last_date != now.date():
            last_date = now.date()
            try:
                await _create_backup()
            except Exception as e:
                logging.getLogger(__name__).error(f"Nightly backup failed: {e}")
        await asyncio.sleep(60)


async def _trash_purge_loop():
    last_date = None
    while True:
        now = datetime.now(timezone.utc)
        if now.hour == 0 and now.minute == 5 and last_date != now.date():
            last_date = now.date()
            try:
                await _purge_old_trash()
            except Exception as e:
                logging.getLogger(__name__).error(f"Trash purge failed: {e}")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_auto_sync_loop())
    asyncio.create_task(_backup_loop())
    asyncio.create_task(_trash_purge_loop())
    count = await db.users.count_documents({"role": "admin"})
    if count == 0:
        admin = {
            "id": str(uuid.uuid4()),
            "name": "Администратор",
            "login": "admin",
            "password_hash": _hash_password("admin123"),
            "role": "admin",
            "created_at": now_iso(),
        }
        await db.users.insert_one(admin)
        logging.getLogger(__name__).info("Created default admin user (login=admin, password=admin123)")
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

TAX_RATE = 0.20  # 20% — для расчёта прибыли (маржа − налог)

JWT_SECRET = os.environ.get("JWT_SECRET", "crm-secret-key-change-in-production-2024")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7

_http_bearer = HTTPBearer(auto_error=False)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"{salt}${key.hex()}"


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, key_hex = password_hash.split("$", 1)
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
        return key.hex() == key_hex
    except Exception:
        return False


def _create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return _jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def _get_user_from_token(credentials: HTTPAuthorizationCredentials = Depends(_http_bearer)) -> Optional[dict]:
    if not credentials:
        return None
    try:
        payload = _jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        return await db.users.find_one({"id": user_id}, {"_id": 0})
    except Exception:
        return None


async def _require_user(credentials: HTTPAuthorizationCredentials = Depends(_http_bearer)) -> dict:
    if not credentials:
        raise HTTPException(401, "Требуется авторизация")
    try:
        payload = _jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Неверный токен")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(401, "Пользователь не найден")
        return user
    except HTTPException:
        raise
    except _jwt.ExpiredSignatureError:
        raise HTTPException(401, "Токен истёк")
    except Exception:
        raise HTTPException(401, "Неверный токен")


# ====== Models ======
class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    inn: Optional[str] = ""
    kpp: Optional[str] = ""
    legal_address: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_account: Optional[str] = ""
    bank_bik: Optional[str] = ""
    bank_corr_account: Optional[str] = ""
    payment_terms: Optional[str] = ""
    cargo_types: Optional[str] = ""
    directions: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class ClientPayload(BaseModel):
    name: str
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    inn: Optional[str] = ""
    kpp: Optional[str] = ""
    legal_address: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_account: Optional[str] = ""
    bank_bik: Optional[str] = ""
    bank_corr_account: Optional[str] = ""
    payment_terms: Optional[str] = ""
    cargo_types: Optional[str] = ""
    directions: Optional[str] = ""
    notes: Optional[str] = ""


class Carrier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_name: str
    driver_name: Optional[str] = ""
    phone: Optional[str] = ""
    inn: Optional[str] = ""
    kpp: Optional[str] = ""
    legal_address: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_account: Optional[str] = ""
    bank_bik: Optional[str] = ""
    bank_corr_account: Optional[str] = ""
    vehicle_type: Optional[str] = ""
    plate: Optional[str] = ""
    capacity_tons: Optional[float] = 0
    capacity_m3: Optional[float] = 0
    cargo_types: Optional[str] = ""
    regions: Optional[str] = ""
    rating: Optional[float] = 5.0
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class CarrierPayload(BaseModel):
    company_name: str
    driver_name: Optional[str] = ""
    phone: Optional[str] = ""
    inn: Optional[str] = ""
    kpp: Optional[str] = ""
    legal_address: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_account: Optional[str] = ""
    bank_bik: Optional[str] = ""
    bank_corr_account: Optional[str] = ""
    vehicle_type: Optional[str] = ""
    plate: Optional[str] = ""
    capacity_tons: Optional[float] = 0
    capacity_m3: Optional[float] = 0
    cargo_types: Optional[str] = ""
    regions: Optional[str] = ""
    rating: Optional[float] = 5.0
    notes: Optional[str] = ""


class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    client_id: Optional[str] = ""
    client_name: Optional[str] = ""
    carrier_id: Optional[str] = ""
    carrier_name: Optional[str] = ""
    route_from: str
    route_to: str
    route_from_address: Optional[str] = ""
    route_to_address: Optional[str] = ""
    load_date: Optional[str] = ""
    unload_date: Optional[str] = ""
    driver_name: Optional[str] = ""
    driver_phone: Optional[str] = ""
    vehicle_type: Optional[str] = ""
    vehicle_plate: Optional[str] = ""
    client_rate: float = 0
    carrier_rate: float = 0
    status: str = "new"
    client_paid: bool = False
    carrier_paid: bool = False
    client_paid_date: Optional[str] = ""
    carrier_paid_date: Optional[str] = ""
    # 4 раздельных статуса по документам
    docs_to_client_sent: bool = False       # Документы Клиенту — отправлены
    docs_from_client_received: bool = False  # Документы от Клиента — получены
    docs_to_carrier_sent: bool = False       # Документы Перевозчику — отправлены/получены им
    docs_from_carrier_received: bool = False # Документы от Перевозчика — получены/они отправили
    docs_to_client_date: Optional[str] = ""
    docs_from_client_date: Optional[str] = ""
    docs_to_carrier_date: Optional[str] = ""
    docs_from_carrier_date: Optional[str] = ""
    cargo: Optional[str] = ""
    weight_tons: Optional[float] = 0
    notes: Optional[str] = ""
    # Ссылки на сгенерированные документы Google Docs
    doc_url_client: Optional[str] = ""
    doc_url_carrier: Optional[str] = ""
    doc_url_act: Optional[str] = ""
    calendar_event_id: Optional[str] = ""
    calendar_event_url: Optional[str] = ""
    assigned_to: Optional[str] = ""
    created_by: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)
    is_overdue: Optional[bool] = False


class OrderPayload(BaseModel):
    order_number: str
    client_id: Optional[str] = ""
    client_name: Optional[str] = ""
    carrier_id: Optional[str] = ""
    carrier_name: Optional[str] = ""
    route_from: str
    route_to: str
    route_from_address: Optional[str] = ""
    route_to_address: Optional[str] = ""
    load_date: Optional[str] = ""
    unload_date: Optional[str] = ""
    driver_name: Optional[str] = ""
    driver_phone: Optional[str] = ""
    vehicle_type: Optional[str] = ""
    vehicle_plate: Optional[str] = ""
    client_rate: float = 0
    carrier_rate: float = 0
    status: str = "new"
    client_paid: bool = False
    carrier_paid: bool = False
    client_paid_date: Optional[str] = ""
    carrier_paid_date: Optional[str] = ""
    docs_to_client_sent: bool = False
    docs_from_client_received: bool = False
    docs_to_carrier_sent: bool = False
    docs_from_carrier_received: bool = False
    docs_to_client_date: Optional[str] = ""
    docs_from_client_date: Optional[str] = ""
    docs_to_carrier_date: Optional[str] = ""
    docs_from_carrier_date: Optional[str] = ""
    cargo: Optional[str] = ""
    weight_tons: Optional[float] = 0
    notes: Optional[str] = ""
    doc_url_client: Optional[str] = ""
    doc_url_carrier: Optional[str] = ""
    doc_url_act: Optional[str] = ""
    assigned_to: Optional[str] = ""


class OrderUpdate(BaseModel):
    order_number: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    carrier_id: Optional[str] = None
    carrier_name: Optional[str] = None
    route_from: Optional[str] = None
    route_to: Optional[str] = None
    route_from_address: Optional[str] = None
    route_to_address: Optional[str] = None
    load_date: Optional[str] = None
    unload_date: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_plate: Optional[str] = None
    client_rate: Optional[float] = None
    carrier_rate: Optional[float] = None
    status: Optional[str] = None
    client_paid: Optional[bool] = None
    carrier_paid: Optional[bool] = None
    client_paid_date: Optional[str] = None
    carrier_paid_date: Optional[str] = None
    docs_to_client_sent: Optional[bool] = None
    docs_from_client_received: Optional[bool] = None
    docs_to_carrier_sent: Optional[bool] = None
    docs_from_carrier_received: Optional[bool] = None
    docs_to_client_date: Optional[str] = None
    docs_from_client_date: Optional[str] = None
    docs_to_carrier_date: Optional[str] = None
    docs_from_carrier_date: Optional[str] = None
    cargo: Optional[str] = None
    weight_tons: Optional[float] = None
    notes: Optional[str] = None
    doc_url_client: Optional[str] = None
    doc_url_carrier: Optional[str] = None
    doc_url_act: Optional[str] = None
    calendar_event_id: Optional[str] = None
    calendar_event_url: Optional[str] = None
    assigned_to: Optional[str] = None


class Lead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company: Optional[str] = ""
    phone: str
    city: Optional[str] = ""
    email: Optional[str] = ""
    industry: Optional[str] = ""
    status: str = "new"
    last_contact: Optional[str] = ""
    next_call: Optional[str] = ""
    notes: Optional[str] = ""
    directions: Optional[str] = ""
    call_notes: Optional[List] = Field(default_factory=list)
    assigned_to: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class LeadPayload(BaseModel):
    name: str
    company: Optional[str] = ""
    phone: str
    city: Optional[str] = ""
    email: Optional[str] = ""
    industry: Optional[str] = ""
    status: str = "new"
    last_contact: Optional[str] = ""
    next_call: Optional[str] = ""
    notes: Optional[str] = ""
    directions: Optional[str] = ""
    call_notes: Optional[List] = Field(default_factory=list)
    assigned_to: Optional[str] = ""


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    email: Optional[str] = None
    industry: Optional[str] = None
    status: Optional[str] = None
    last_contact: Optional[str] = None
    next_call: Optional[str] = None
    notes: Optional[str] = None
    directions: Optional[str] = None
    call_notes: Optional[List] = None
    assigned_to: Optional[str] = None


# ===== CRUD helper =====
def make_crud(prefix: str, collection: str, ModelCls, PayloadCls, sync_to_sheets: bool = False, user_filter: bool = False, soft_delete: bool = False):
    @api_router.get(f"/{prefix}", response_model=List[ModelCls])
    async def list_items(current_user: Optional[dict] = Depends(_get_user_from_token)):
        filter_q: dict = {}
        if soft_delete:
            filter_q["deleted"] = {"$ne": True}
        if user_filter and current_user and current_user.get("role") == "manager":
            perms = current_user.get("permissions") or {}
            if not perms.get("can_view_all_leads"):
                filter_q["assigned_to"] = current_user["id"]
        docs = await db[collection].find(filter_q, {"_id": 0}).sort("created_at", -1).to_list(50000)
        return [ModelCls(**d) for d in docs]

    @api_router.post(f"/{prefix}", response_model=ModelCls)
    async def create_item(payload: PayloadCls, background_tasks: BackgroundTasks):
        obj = ModelCls(**payload.dict())
        await db[collection].insert_one(obj.dict())
        if sync_to_sheets:
            if collection == "clients":
                background_tasks.add_task(_bg_push_client, obj.dict())
            elif collection == "carriers":
                background_tasks.add_task(_bg_push_carrier, obj.dict())
            elif collection == "leads":
                background_tasks.add_task(_bg_push_lead, obj.dict())
        return obj

    @api_router.get(f"/{prefix}/{{item_id}}", response_model=ModelCls)
    async def get_item(item_id: str):
        q: dict = {"id": item_id}
        if soft_delete:
            q["deleted"] = {"$ne": True}
        doc = await db[collection].find_one(q, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Not found")
        return ModelCls(**doc)

    @api_router.put(f"/{prefix}/{{item_id}}", response_model=ModelCls)
    async def update_item(item_id: str, payload: PayloadCls, background_tasks: BackgroundTasks,
                          current_user: Optional[dict] = Depends(_get_user_from_token)):
        old_status = None
        if collection == "leads":
            old_doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
            old_status = (old_doc or {}).get("status")
        await db[collection].update_one({"id": item_id}, {"$set": payload.dict(exclude_none=True)})
        doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Not found")
        if collection == "leads":
            new_status = doc.get("status")
            p_dict = payload.dict(exclude_none=True)
            if new_status != old_status:
                action = "status_change"
            elif any(k in p_dict for k in ("call_notes", "last_contact", "next_call")):
                action = "call"
            else:
                action = "update"
            await db.lead_activity.insert_one({
                "id": str(uuid.uuid4()),
                "lead_id": item_id,
                "user_id": (current_user or {}).get("id", ""),
                "action": action,
                "old_status": old_status,
                "new_status": new_status,
                "timestamp": datetime.now(timezone.utc),
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            })
        if sync_to_sheets:
            if collection == "clients":
                background_tasks.add_task(_bg_push_client, doc)
            elif collection == "carriers":
                background_tasks.add_task(_bg_push_carrier, doc)
            elif collection == "leads":
                background_tasks.add_task(_bg_push_lead, doc)
        return ModelCls(**doc)

    @api_router.delete(f"/{prefix}/{{item_id}}")
    async def delete_item(item_id: str, background_tasks: BackgroundTasks):
        doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
        if soft_delete:
            if doc:
                if sync_to_sheets and collection == "leads":
                    background_tasks.add_task(_bg_delete_lead, doc.get("name", ""))
                if sync_to_sheets and collection == "clients":
                    background_tasks.add_task(_bg_delete_client, doc.get("name", ""))
                await db[collection].update_one({"id": item_id}, {"$set": {"deleted": True, "deleted_at": now_iso()}})
            return {"ok": True}
        if doc:
            if sync_to_sheets and collection == "leads":
                background_tasks.add_task(_bg_delete_lead, doc.get("name", ""))
            if sync_to_sheets and collection == "clients":
                background_tasks.add_task(_bg_delete_client, doc.get("name", ""))
        await db[collection].delete_one({"id": item_id})
        return {"ok": True}


make_crud("clients", "clients", Client, ClientPayload, sync_to_sheets=True, soft_delete=True)
make_crud("carriers", "carriers", Carrier, CarrierPayload, sync_to_sheets=True, soft_delete=True)



@api_router.get("/leads/activity/stats")
async def leads_activity_stats():
    today = datetime.now(timezone.utc)
    days = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    docs = await db.lead_activity.find({"date": {"$gte": days[0]}}, {"_id": 0}).to_list(10000)
    counts: dict = {d: 0 for d in days}
    for doc in docs:
        dt = doc.get("date", "")
        if dt in counts:
            counts[dt] += 1
    return [{"date": k, "count": v} for k, v in sorted(counts.items())]


@api_router.get("/leads/industries", response_model=List[str])
async def leads_industries():
    docs = await db.leads.distinct("industry", {"deleted": {"$ne": True}, "industry": {"$nin": [None, ""]}})
    return sorted([d for d in docs if d], key=lambda x: x.lower())


@api_router.get("/leads", response_model=List[Lead])
async def list_leads_filtered(industry: Optional[str] = None, current_user: Optional[dict] = Depends(_get_user_from_token)):
    filter_q: dict = {"deleted": {"$ne": True}}
    if current_user and current_user.get("role") == "manager":
        perms = current_user.get("permissions") or {}
        if not perms.get("can_view_all_leads"):
            filter_q["assigned_to"] = current_user["id"]
    if industry:
        filter_q["industry"] = industry
    docs = await db.leads.find(filter_q, {"_id": 0}).sort("created_at", -1).to_list(50000)
    return [Lead(**d) for d in docs]


make_crud("leads", "leads", Lead, LeadUpdate, sync_to_sheets=True, user_filter=True, soft_delete=True)


# ====== Task models ======
class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    task_type: str = "other"  # call / meeting / docs / order / other
    due_date: Optional[str] = ""
    due_time: Optional[str] = ""
    status: str = "pending"  # pending / done
    google_task_id: Optional[str] = None
    created_by: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    task_type: str = "other"
    due_date: Optional[str] = ""
    due_time: Optional[str] = ""
    status: str = "pending"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    status: Optional[str] = None
    google_task_id: Optional[str] = None


# ====== Google Tasks background helpers ======
async def _bg_gt_create(task_obj: dict):
    if _gt_create is None:
        return
    try:
        token_doc = await db.oauth_tokens.find_one({"_id": "google"}, {"_id": 0})
        if not token_doc:
            return
        gid = await asyncio.to_thread(_gt_create, task_obj, token_doc)
        if gid:
            await db.tasks.update_one({"id": task_obj["id"]}, {"$set": {"google_task_id": gid}})
    except Exception as e:
        logging.getLogger(__name__).error(f"_bg_gt_create failed: {e}")


async def _bg_gt_update(task_obj: dict):
    if _gt_update is None or not task_obj.get("google_task_id"):
        return
    try:
        token_doc = await db.oauth_tokens.find_one({"_id": "google"}, {"_id": 0})
        if not token_doc:
            return
        await asyncio.to_thread(_gt_update, task_obj["google_task_id"], task_obj, token_doc)
    except Exception as e:
        logging.getLogger(__name__).error(f"_bg_gt_update failed: {e}")


async def _bg_gt_delete(google_task_id: str):
    if _gt_delete is None or not google_task_id:
        return
    try:
        token_doc = await db.oauth_tokens.find_one({"_id": "google"}, {"_id": 0})
        if not token_doc:
            return
        await asyncio.to_thread(_gt_delete, google_task_id, token_doc)
    except Exception as e:
        logging.getLogger(__name__).error(f"_bg_gt_delete failed: {e}")


# ====== Google Calendar background helpers ======
async def _bg_cal_create(order_obj: dict):
    if _gc_create is None:
        return
    try:
        token_doc = await db.oauth_tokens.find_one({"_id": "google"}, {"_id": 0})
        if not token_doc:
            return
        result = await asyncio.to_thread(_gc_create, order_obj, token_doc)
        if result:
            await db.orders.update_one(
                {"id": order_obj["id"]},
                {"$set": {"calendar_event_id": result["event_id"], "calendar_event_url": result["html_link"]}},
            )
    except Exception as e:
        logging.getLogger(__name__).error(f"_bg_cal_create failed: {e}")


async def _bg_cal_update(order_doc: dict):
    if _gc_update is None or not order_doc.get("calendar_event_id"):
        return
    try:
        token_doc = await db.oauth_tokens.find_one({"_id": "google"}, {"_id": 0})
        if not token_doc:
            return
        await asyncio.to_thread(_gc_update, order_doc["calendar_event_id"], order_doc, token_doc)
    except Exception as e:
        logging.getLogger(__name__).error(f"_bg_cal_update failed: {e}")


async def _bg_cal_delete(event_id: str):
    if _gc_delete is None or not event_id:
        return
    try:
        token_doc = await db.oauth_tokens.find_one({"_id": "google"}, {"_id": 0})
        if not token_doc:
            return
        await asyncio.to_thread(_gc_delete, event_id, token_doc)
    except Exception as e:
        logging.getLogger(__name__).error(f"_bg_cal_delete failed: {e}")


# ====== Task CRUD endpoints ======
@api_router.get("/tasks", response_model=List[Task])
async def list_tasks(current_user: Optional[dict] = Depends(_get_user_from_token)):
    filter_q: dict = {}
    if current_user and current_user.get("role") == "manager":
        filter_q["created_by"] = current_user["id"]
    docs = await db.tasks.find(filter_q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [Task(**d) for d in docs]


@api_router.post("/tasks", response_model=Task)
async def create_task(payload: TaskCreate, background_tasks: BackgroundTasks,
                      current_user: Optional[dict] = Depends(_get_user_from_token)):
    task_data = payload.dict()
    if current_user:
        task_data["created_by"] = current_user["id"]
    obj = Task(**task_data)
    await db.tasks.insert_one(obj.dict())
    background_tasks.add_task(_bg_gt_create, obj.dict())
    return obj


@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, payload: TaskUpdate, background_tasks: BackgroundTasks):
    await db.tasks.update_one({"id": task_id}, {"$set": payload.dict(exclude_none=True)})
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    background_tasks.add_task(_bg_gt_update, doc)
    return Task(**doc)


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, background_tasks: BackgroundTasks):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if doc and doc.get("google_task_id"):
        background_tasks.add_task(_bg_gt_delete, doc["google_task_id"])
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


@api_router.get("/orders", response_model=List[Order])
async def list_orders(current_user: Optional[dict] = Depends(_get_user_from_token)):
    filter_q: dict = {"deleted": {"$ne": True}}
    if current_user and current_user.get("role") == "manager":
        perms = current_user.get("permissions") or {}
        if not perms.get("can_view_all_orders"):
            filter_q["assigned_to"] = current_user["id"]
    docs = await db.orders.find(filter_q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = []
    for d in docs:
        unload = (d.get("unload_date") or "")[:10]
        status = d.get("status", "")
        d["is_overdue"] = bool(unload and unload < today and status not in ("delivered", "cancelled"))
        result.append(Order(**d))
    return result


@api_router.get("/orders/next_number")
async def next_order_number():
    """Возвращает следующий номер заявки в формате 'З-NNN/YYYY'.
    Берёт max среди активных (не удалённых) заявок текущего года и прибавляет 1.
    """
    import re as _re
    year = datetime.now(timezone.utc).year
    docs = await db.orders.find({"deleted": {"$ne": True}}, {"_id": 0, "order_number": 1}).to_list(5000)
    pattern = _re.compile(r"[ЗЗз3]\s*[-–—]\s*(\d+)\s*/\s*(\d{4})", _re.IGNORECASE)
    max_num = 0
    for d in docs:
        m = pattern.search(d.get("order_number", "") or "")
        if not m:
            continue
        n, y = int(m.group(1)), int(m.group(2))
        if y == year and n > max_num:
            max_num = n
    next_n = max_num + 1
    return {"next_number": f"З-{next_n:03d}/{year}", "year": year, "n": next_n}


@api_router.post("/orders", response_model=Order)
async def create_order(payload: OrderPayload, background_tasks: BackgroundTasks,
                       current_user: Optional[dict] = Depends(_get_user_from_token)):
    order_data = payload.dict()
    order_data["created_by"] = current_user["id"] if current_user else "admin"
    obj = Order(**order_data)
    await db.orders.insert_one(obj.dict())
    background_tasks.add_task(_bg_push_order, obj.dict())
    background_tasks.add_task(_bg_trigger_apps_script, obj.order_number)
    background_tasks.add_task(_bg_cal_create, obj.dict())
    return obj


@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    doc = await db.orders.find_one({"id": order_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    return Order(**doc)


@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, payload: OrderUpdate, background_tasks: BackgroundTasks,
                       current_user: Optional[dict] = Depends(_get_user_from_token)):
    old_doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not old_doc:
        raise HTTPException(404, "Order not found")
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if update_data.get("client_paid") is True and "client_paid_date" not in update_data:
        if not old_doc.get("client_paid"):
            update_data["client_paid_date"] = today
    if update_data.get("carrier_paid") is True and "carrier_paid_date" not in update_data:
        if not old_doc.get("carrier_paid"):
            update_data["carrier_paid_date"] = today
    if update_data:
        await db.orders.update_one({"id": order_id}, {"$set": update_data})
        # Log changes
        actor = (current_user or {}).get("name") or "admin"
        log_entries = []
        skip_log = {"calendar_event_id", "calendar_event_url", "doc_url_client", "doc_url_carrier", "doc_url_act",
                    "client_paid_date", "carrier_paid_date"}
        for field, new_val in update_data.items():
            if field in skip_log:
                continue
            old_val = old_doc.get(field)
            if old_val != new_val:
                log_entries.append({
                    "id": str(uuid.uuid4()),
                    "order_id": order_id,
                    "order_number": old_doc.get("order_number", ""),
                    "field": field,
                    "old_value": str(old_val) if old_val is not None else "",
                    "new_value": str(new_val) if new_val is not None else "",
                    "timestamp": now_iso(),
                    "user": actor,
                })
        if log_entries:
            await db.order_logs.insert_many(log_entries)
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    background_tasks.add_task(_bg_push_order, doc)
    background_tasks.add_task(_bg_cal_update, doc)
    return Order(**doc)


@api_router.get("/orders/{order_id}/logs")
async def get_order_logs(order_id: str):
    logs = await db.order_logs.find({"order_id": order_id}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return logs


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, background_tasks: BackgroundTasks):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        return {"ok": True}
    await db.orders.update_one({"id": order_id}, {"$set": {"deleted": True, "deleted_at": now_iso()}})
    if doc.get("order_number"):
        background_tasks.add_task(_bg_delete_order_row, doc["order_number"])
    if doc.get("calendar_event_id"):
        background_tasks.add_task(_bg_cal_delete, doc["calendar_event_id"])
    return {"ok": True}


@api_router.post("/orders/{order_id}/duplicate", response_model=Order)
async def duplicate_order(order_id: str, background_tasks: BackgroundTasks,
                           current_user: dict = Depends(_require_user)):
    doc = await db.orders.find_one({"id": order_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    import re as _re
    year = datetime.now(timezone.utc).year
    all_docs = await db.orders.find({"deleted": {"$ne": True}}, {"_id": 0, "order_number": 1}).to_list(5000)
    pattern = _re.compile(r"[ЗЗз3]\s*[-–—]\s*(\d+)\s*/\s*(\d{4})", _re.IGNORECASE)
    max_num = 0
    for d in all_docs:
        m = pattern.search(d.get("order_number", "") or "")
        if not m:
            continue
        n, y = int(m.group(1)), int(m.group(2))
        if y == year and n > max_num:
            max_num = n
    next_number = f"З-{max_num + 1:03d}/{year}"
    exclude = {"_id", "order_number", "created_at", "status", "client_paid", "carrier_paid",
               "client_paid_date", "carrier_paid_date", "calendar_event_id",
               "letter_to_client_sent", "letter_from_client_received", "is_overdue"}
    new_data = {k: v for k, v in doc.items() if k not in exclude}
    new_data["id"] = str(uuid.uuid4())
    new_data["order_number"] = next_number
    new_data["status"] = "new"
    new_data["client_paid"] = False
    new_data["carrier_paid"] = False
    new_data["client_paid_date"] = ""
    new_data["carrier_paid_date"] = ""
    new_data["calendar_event_id"] = ""
    new_data["created_at"] = now_iso()
    new_data["created_by"] = current_user["id"]
    obj = Order(**new_data)
    await db.orders.insert_one(obj.dict())
    background_tasks.add_task(_bg_push_order, obj.dict())
    background_tasks.add_task(_bg_cal_create, obj.dict())
    return obj


# ====== OAuth Google (для генерации Docs от имени пользователя) ======
from fastapi.responses import HTMLResponse, RedirectResponse


@api_router.get("/auth/google/start")
async def auth_google_start(request: Request = None):  # type: ignore  # noqa
    """Возвращает auth_url для перехода пользователя на consent screen Google."""
    if _oauth_build_auth_url is None:
        raise HTTPException(500, "OAuth не настроен")
    try:
        auth_url, state = _oauth_build_auth_url()
        redirect_uri = _oauth_get_redirect()
        return {"auth_url": auth_url, "state": state, "redirect_uri": redirect_uri}
    except Exception as e:
        raise HTTPException(500, f"OAuth start failed: {e}")


@api_router.get("/auth/google/callback")
async def auth_google_callback(code: str = "", state: str = "", error: str = ""):
    """Принимает code от Google, обменивает на refresh_token и сохраняет в Mongo."""
    if error:
        return HTMLResponse(_callback_html("Ошибка авторизации: " + error, success=False))
    if not code:
        return HTMLResponse(_callback_html("Не получен код авторизации", success=False))
    if _oauth_fetch_token is None:
        return HTMLResponse(_callback_html("OAuth не настроен на сервере", success=False))

    try:
        token = _oauth_fetch_token(code=code, state=state)
        token_doc = {
            "_id": "google",
            "access_token": token.get("access_token"),
            "refresh_token": token.get("refresh_token"),
            "expiry": token.get("expires_at"),
            "scopes": _OAUTH_SCOPES,
            "saved_at": now_iso(),
        }
        # сохраняем (upsert)
        await db.oauth_tokens.replace_one({"_id": "google"}, token_doc, upsert=True)
        # сбросим кеш сервисов в docs_gen
        if _docs_get_generator is not None:
            try:
                _docs_get_generator()._drive = None
                _docs_get_generator()._docs = None
            except Exception:
                pass
        return HTMLResponse(_callback_html("Авторизация успешна! Можно закрыть это окно и вернуться в приложение.", success=True))
    except Exception as e:
        logging.getLogger(__name__).error(f"OAuth callback failed: {e}", exc_info=True)
        return HTMLResponse(_callback_html(f"Ошибка обмена кода: {e}", success=False))


@api_router.get("/auth/google/status")
async def auth_google_status():
    doc = await db.oauth_tokens.find_one({"_id": "google"}, {"_id": 0, "access_token": 0})
    if not doc:
        return {"connected": False}
    return {
        "connected": bool(doc.get("refresh_token")),
        "saved_at": doc.get("saved_at"),
        "scopes": doc.get("scopes", []),
    }


@api_router.delete("/auth/google")
async def auth_google_disconnect():
    await db.oauth_tokens.delete_one({"_id": "google"})
    if _docs_get_generator is not None:
        try:
            _docs_get_generator()._drive = None
            _docs_get_generator()._docs = None
        except Exception:
            pass
    return {"ok": True}


def _callback_html(msg: str, success: bool = True) -> str:
    color = "#0A8C3E" if success else "#D4351C"
    return f"""<!doctype html>
<html><head><meta charset='utf-8'><title>Google Auth</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
       background: #0A0A0C; color: #fff; display: flex; align-items: center; justify-content: center;
       min-height: 100vh; margin: 0; }}
.box {{ max-width: 480px; padding: 40px; text-align: center; }}
.icon {{ width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 50%;
        background: {color}; display: flex; align-items: center; justify-content: center;
        font-size: 32px; }}
h1 {{ font-size: 22px; font-weight: 600; margin: 0 0 8px; }}
p {{ color: #A1A1AA; line-height: 1.5; }}
</style></head>
<body>
<div class='box'>
  <div class='icon'>{('✓' if success else '✕')}</div>
  <h1>{('Готово' if success else 'Не получилось')}</h1>
  <p>{msg}</p>
</div></body></html>
"""


# ====== User Auth & Management ======
class _LoginPayload(BaseModel):
    login: str
    password: str


class _CreateUserPayload(BaseModel):
    name: str
    login: str
    password: str
    role: str = "manager"
    permissions: Optional[dict] = None


@api_router.post("/auth/login")
async def auth_login(payload: _LoginPayload):
    user = await db.users.find_one({"login": payload.login}, {"_id": 0})
    if not user or not _verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(401, "Неверный логин или пароль")
    token = _create_token(user["id"], user["role"])
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return {"token": token, "user": safe_user}


@api_router.get("/auth/me")
async def auth_me(current_user: dict = Depends(_require_user)):
    return {k: v for k, v in current_user.items() if k != "password_hash"}


@api_router.get("/users")
async def list_users(current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api_router.post("/users")
async def create_user(payload: _CreateUserPayload, current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    existing = await db.users.find_one({"login": payload.login})
    if existing:
        raise HTTPException(400, "Логин уже занят")
    user = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "login": payload.login,
        "password_hash": _hash_password(payload.password),
        "role": payload.role,
        "permissions": payload.permissions or {},
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    return {k: v for k, v in user.items() if k not in ("password_hash", "_id")}


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    if user_id == current_user.get("id"):
        raise HTTPException(400, "Нельзя удалить себя")
    target = await db.users.find_one({"id": user_id})
    if target and target.get("role") == "admin":
        admin_count = await db.users.count_documents({"role": "admin"})
        if admin_count <= 1:
            raise HTTPException(400, "Нельзя удалить последнего администратора")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


@api_router.get("/users/activity_summary")
async def get_users_activity_summary(current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    now_dt = datetime.now(timezone.utc)
    month_start = f"{now_dt.year}-{now_dt.month:02d}-01"
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    # Count orders_created per user
    created_agg = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": month_start}, "deleted": {"$ne": True}}},
        {"$group": {"_id": "$created_by", "count": {"$sum": 1}}},
    ]).to_list(1000)
    orders_created_by_user = {item["_id"]: item["count"] for item in created_agg}
    # Count orders_assigned per user
    assigned_agg = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": month_start}, "deleted": {"$ne": True}}},
        {"$group": {"_id": "$assigned_to", "count": {"$sum": 1}}},
    ]).to_list(1000)
    orders_assigned_by_user = {item["_id"]: item["count"] for item in assigned_agg}
    # Count orders_total (created_by OR assigned_to, unique per user)
    all_month_orders = await db.orders.find(
        {"created_at": {"$gte": month_start}, "deleted": {"$ne": True}},
        {"_id": 0, "created_by": 1, "assigned_to": 1},
    ).to_list(10000)
    orders_total_by_user: dict = {}
    for o in all_month_orders:
        for uid in set(filter(None, [o.get("created_by"), o.get("assigned_to")])):
            orders_total_by_user[uid] = orders_total_by_user.get(uid, 0) + 1
    leads_agg = await db.leads.aggregate([
        {"$group": {"_id": "$assigned_to", "lead_ids": {"$push": "$id"}}},
    ]).to_list(1000)
    leads_by_user = {item["_id"]: item["lead_ids"] for item in leads_agg}
    start_30 = (now_dt - timedelta(days=29)).strftime("%Y-%m-%d")
    activity_docs = await db.lead_activity.find(
        {"date": {"$gte": start_30}}, {"_id": 0, "lead_id": 1}
    ).to_list(50000)
    activity_by_lead: dict = {}
    for doc in activity_docs:
        lid = doc.get("lead_id")
        if lid:
            activity_by_lead[lid] = activity_by_lead.get(lid, 0) + 1
    result = []
    for u in users:
        uid = u["id"]
        user_leads = leads_by_user.get(uid, [])
        calls = sum(activity_by_lead.get(lid, 0) for lid in user_leads)
        orders_created = orders_created_by_user.get(uid, 0)
        orders_assigned = orders_assigned_by_user.get(uid, 0)
        orders_total = orders_total_by_user.get(uid, 0)
        result.append({
            **u,
            "orders_month": orders_total,
            "orders_created": orders_created,
            "orders_assigned": orders_assigned,
            "orders_total": orders_total,
            "calls_month": calls,
        })
    return result


class _UpdateUserPayload(BaseModel):
    name: Optional[str] = None
    login: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[dict] = None


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, payload: _UpdateUserPayload, current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    update_data: dict = {}
    if payload.name is not None:
        update_data["name"] = payload.name
    if payload.login is not None:
        existing = await db.users.find_one({"login": payload.login, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(400, "Логин уже занят")
        update_data["login"] = payload.login
    if payload.password:
        update_data["password_hash"] = _hash_password(payload.password)
    if payload.role is not None:
        if user_id == current_user.get("id"):
            raise HTTPException(400, "Нельзя изменить свою роль")
        update_data["role"] = payload.role
    if payload.permissions is not None:
        if user_id == current_user.get("id"):
            raise HTTPException(400, "Нельзя изменить свои права")
        update_data["permissions"] = payload.permissions
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return user


@api_router.get("/users/{user_id}/activity")
async def get_user_activity(user_id: str, current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    now_dt = datetime.now(timezone.utc)
    month_start = f"{now_dt.year}-{now_dt.month:02d}-01"
    orders_month = await db.orders.count_documents({
        "created_by": user_id,
        "created_at": {"$gte": month_start},
    })
    leads = await db.leads.find({"assigned_to": user_id}, {"_id": 0, "id": 1, "status": 1}).to_list(10000)
    lead_ids = [l["id"] for l in leads]
    won_leads = sum(1 for l in leads if l.get("status") == "won")
    total_leads = len(leads)
    conversion = round(won_leads / total_leads * 100) if total_leads else 0
    start_30 = (now_dt - timedelta(days=29)).strftime("%Y-%m-%d")
    if lead_ids:
        activity_docs = await db.lead_activity.find(
            {"lead_id": {"$in": lead_ids}, "date": {"$gte": start_30}}, {"_id": 0}
        ).to_list(10000)
    else:
        activity_docs = []
    calls_by_day: dict = {}
    for doc in activity_docs:
        dt = doc.get("date", "")
        if dt:
            calls_by_day[dt] = calls_by_day.get(dt, 0) + 1
    calls_total = sum(calls_by_day.values())
    activity_chart = [{"date": k, "count": v} for k, v in sorted(calls_by_day.items())]
    return {
        "orders_month": orders_month,
        "calls_total": calls_total,
        "total_leads": total_leads,
        "won_leads": won_leads,
        "conversion": conversion,
        "activity_chart": activity_chart,
    }


@api_router.get("/users/{user_id}/stats")
async def get_user_stats(user_id: str, month: Optional[str] = None, current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    now_dt = datetime.now(timezone.utc)
    if month and len(month) == 7:
        y, m = int(month[:4]), int(month[5:7])
    else:
        y, m = now_dt.year, now_dt.month
    month_start = f"{y}-{m:02d}-01"
    month_end = f"{y + 1}-01-01" if m == 12 else f"{y}-{m + 1:02d}-01"
    all_user_orders = await db.orders.find(
        {"$or": [{"created_by": str(user_id)}, {"assigned_to": str(user_id)}], "deleted": {"$ne": True}},
        {"_id": 0, "client_rate": 1, "unload_date": 1, "created_at": 1},
    ).to_list(10000)
    orders_in_month = [
        o for o in all_user_orders
        if month_start <= (o.get("unload_date") or o.get("created_at", ""))[:10] < month_end
    ]
    orders_created = len(orders_in_month)
    revenue_month = sum(o.get("client_rate", 0) for o in orders_in_month)
    calls_made = await db.lead_activity.count_documents(
        {"user_id": user_id, "date": {"$gte": month_start, "$lt": month_end}}
    )
    leads = await db.leads.find({"assigned_to": user_id, "deleted": {"$ne": True}}, {"_id": 0, "status": 1}).to_list(10000)
    won = sum(1 for l in leads if l.get("status") == "won")
    total = len(leads)
    conversion = round(won / total * 100) if total else 0
    return {
        "orders_created": orders_created,
        "calls_made": calls_made,
        "conversion": conversion,
        "revenue_month": revenue_month,
        "total_leads": total,
        "won_leads": won,
    }


@api_router.get("/users/{user_id}/orders")
async def get_user_orders(user_id: str, month: Optional[str] = None, current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    now_dt = datetime.now(timezone.utc)
    if month and len(month) == 7:
        y, m = int(month[:4]), int(month[5:7])
    else:
        y, m = now_dt.year, now_dt.month
    month_start = f"{y}-{m:02d}-01"
    month_end = f"{y + 1}-01-01" if m == 12 else f"{y}-{m + 1:02d}-01"
    all_user_orders = await db.orders.find(
        {"$or": [{"created_by": str(user_id)}, {"assigned_to": str(user_id)}], "deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "order_number": 1, "client_name": 1, "route_from": 1,
         "route_to": 1, "client_rate": 1, "status": 1, "unload_date": 1, "created_at": 1},
    ).to_list(10000)
    orders = [
        o for o in all_user_orders
        if month_start <= (o.get("unload_date") or o.get("created_at", ""))[:10] < month_end
    ]
    orders.sort(key=lambda o: (o.get("unload_date") or o.get("created_at", "")), reverse=True)
    return orders


@api_router.get("/users/{user_id}/leads")
async def get_user_leads(user_id: str, current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    leads = await db.leads.find(
        {"assigned_to": user_id, "deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "company": 1, "status": 1, "last_contact": 1, "phone": 1},
    ).sort("last_contact", -1).to_list(10000)
    return leads


# ====== Documents generation ======
@api_router.post("/orders/{order_id}/docs/{kind}")
async def generate_order_doc(order_id: str, kind: str, regenerate: bool = False):
    """Сгенерировать (или перегенерировать) документ для заявки.
    kind: 'client' | 'carrier' | 'act'
    Возвращает {url, kind}.
    """
    if kind not in ("client", "carrier", "act"):
        raise HTTPException(400, "kind должен быть client | carrier | act")
    if _docs_get_generator is None:
        raise HTTPException(500, "Docs generation недоступна")

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")

    # Если уже есть и не просим перегенерировать — возвращаем существующий
    field = _docs_kind_to_field(kind)
    existing = order.get(field) or ""
    if existing and not regenerate:
        return {"url": existing, "kind": kind, "cached": True}

    # Подгружаем реквизиты клиента/перевозчика
    client_doc = None
    carrier_doc = None
    if order.get("client_id"):
        client_doc = await db.clients.find_one({"id": order["client_id"]}, {"_id": 0})
    if not client_doc and order.get("client_name"):
        client_doc = await db.clients.find_one({"name": order["client_name"]}, {"_id": 0})
    if order.get("carrier_id"):
        carrier_doc = await db.carriers.find_one({"id": order["carrier_id"]}, {"_id": 0})
    if not carrier_doc and order.get("carrier_name"):
        carrier_doc = await db.carriers.find_one({"company_name": order["carrier_name"]}, {"_id": 0})

    try:
        gen = _docs_get_generator()
        url = await asyncio.to_thread(gen.generate, kind, order, client_doc, carrier_doc)
    except Exception as e:
        # Сообщение пользователю
        msg = str(e) or repr(e)
        try:
            if hasattr(e, 'reason'):
                msg = f"{msg} ({e.reason})"
        except Exception:
            pass
        logging.getLogger(__name__).error(f"docs generate failed: {e}", exc_info=True)
        raise HTTPException(500, f"Не удалось создать документ: {msg}")

    # Сохраняем URL в Mongo + пушим в таблицу
    await db.orders.update_one({"id": order_id}, {"$set": {field: url}})
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if updated and _sw_push_order:
        try:
            await _sw_push_order(updated)
        except Exception:
            pass
    return {"url": url, "kind": kind, "cached": False}


# ====== Google Sheets sync endpoints ======
@api_router.post("/sync/sheets")
async def sync_sheets_now():
    """ОТКЛЮЧЕНО. Выгрузка из CRM в Google Sheets отключена,
    чтобы случайно не перезаписать данные пользователя.
    Источник истины — Google Таблица. Импорт идёт только в одну сторону: Sheets → CRM.
    """
    raise HTTPException(
        409,
        "Выгрузка из CRM в Google Sheets отключена. Используйте импорт из таблицы (POST /api/sync/import_from_sheets).",
    )


@api_router.get("/sync/sheets/status")
async def sync_sheets_status():
    """Статус последней синхронизации."""
    if _get_sheets_sync is None:
        return {"ok": False, "message": "Sheets sync not available"}
    s = _get_sheets_sync()
    return s.last_status


@api_router.post("/sync/import_from_sheets")
async def import_from_sheets():
    """Импорт всех клиентов / перевозчиков / заказов из Google Таблицы в CRM.
    ОДНОСТОРОННЕ: только Sheets -> CRM. Таблица не изменяется.
    Полностью заменяет данные в коллекциях clients/carriers/orders в MongoDB.
    """
    if _sheets_run_import is None:
        raise HTTPException(500, "Импорт недоступен")
    return await _sheets_run_import(db)


@api_router.get("/sync/import_status")
async def import_status():
    if _sheets_import_status is None:
        return {"ok": False, "message": "Импорт недоступен", "imported": {}}
    return _sheets_import_status()


# ====== Dashboard ======
def order_in_period(o: dict, period: str) -> bool:
    if period == "all":
        return True
    # ВАЖНО: считаем по дате ВЫГРУЗКИ (когда заказ фактически закрылся в этом месяце)
    ud = o.get("unload_date") or ""
    if not ud:
        # если нет даты выгрузки — пробуем дату загрузки, иначе created_at
        ud = o.get("load_date") or (o.get("created_at", "")[:10])
    return ud.startswith(period)


@api_router.get("/dashboard")
async def dashboard(period: str = "all"):
    all_orders = await db.orders.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(5000)
    orders = [o for o in all_orders if order_in_period(o, period)]

    clients_count = await db.clients.count_documents({"deleted": {"$ne": True}})
    carriers_count = await db.carriers.count_documents({"deleted": {"$ne": True}})
    leads_count = await db.leads.count_documents({"deleted": {"$ne": True}})

    total_revenue = sum(o.get("client_rate", 0) for o in orders)
    total_cost = sum(o.get("carrier_rate", 0) for o in orders)
    total_margin = total_revenue - total_cost
    profit = total_margin * (1 - TAX_RATE)  # после 20% налога

    delivered = [o for o in orders if o.get("status") == "delivered"]
    active = [o for o in orders if o.get("status") in ("new", "in_progress")]

    unpaid_by_clients = sum(o.get("client_rate", 0) for o in orders if not o.get("client_paid", False))
    owed_to_carriers = sum(o.get("carrier_rate", 0) for o in orders if not o.get("carrier_paid", False))

    # === Должники (клиенты, которые нам должны) ===
    debtors_map: dict = {}
    for o in orders:
        if o.get("client_paid"):
            continue
        name = o.get("client_name") or "—"
        if name not in debtors_map:
            debtors_map[name] = {"name": name, "amount": 0, "orders": 0}
        debtors_map[name]["amount"] += o.get("client_rate", 0)
        debtors_map[name]["orders"] += 1
    debtors = sorted(debtors_map.values(), key=lambda x: x["amount"], reverse=True)

    # === Те, кому мы должны (перевозчики) ===
    creditors_map: dict = {}
    for o in orders:
        if o.get("carrier_paid"):
            continue
        name = o.get("carrier_name") or "—"
        if name not in creditors_map:
            creditors_map[name] = {"name": name, "amount": 0, "orders": 0}
        creditors_map[name]["amount"] += o.get("carrier_rate", 0)
        creditors_map[name]["orders"] += 1
    creditors = sorted(creditors_map.values(), key=lambda x: x["amount"], reverse=True)

    client_totals: dict = {}
    for o in orders:
        n = o.get("client_name") or "—"
        client_totals[n] = client_totals.get(n, 0) + o.get("client_rate", 0)
    top_clients = sorted([{"name": k, "revenue": v} for k, v in client_totals.items()],
                         key=lambda x: x["revenue"], reverse=True)[:5]

    client_margin_map: dict = {}
    for o in orders:
        n = o.get("client_name") or "—"
        if n not in client_margin_map:
            client_margin_map[n] = {"name": n, "orders_count": 0, "revenue": 0.0, "cost": 0.0}
        client_margin_map[n]["orders_count"] += 1
        client_margin_map[n]["revenue"] += o.get("client_rate", 0)
        client_margin_map[n]["cost"] += o.get("carrier_rate", 0)
    top_clients_margin = []
    for item in client_margin_map.values():
        margin = item["revenue"] - item["cost"]
        pct = round(margin / item["revenue"] * 100, 1) if item["revenue"] else 0
        top_clients_margin.append({**item, "margin": margin, "margin_percent": pct})
    top_clients_margin = sorted(top_clients_margin, key=lambda x: x["margin_percent"], reverse=True)[:10]

    status_breakdown = {
        "new": len([o for o in orders if o.get("status") == "new"]),
        "in_progress": len([o for o in orders if o.get("status") == "in_progress"]),
        "delivered": len(delivered),
        "cancelled": len([o for o in orders if o.get("status") == "cancelled"]),
    }

    # === Сравнение с предыдущим месяцем (только если period — конкретный месяц) ===
    prev_margin = None
    prev_revenue = None
    prev_period = None
    margin_change_pct = None
    import re as _re2
    if _re2.match(r"^\d{4}-\d{2}$", period):
        y, m = int(period[:4]), int(period[5:7])
        py, pm = (y - 1, 12) if m == 1 else (y, m - 1)
        prev_period = f"{py:04d}-{pm:02d}"
        prev_orders = [o for o in all_orders if order_in_period(o, prev_period)]
        prev_revenue = sum(o.get("client_rate", 0) for o in prev_orders)
        prev_cost = sum(o.get("carrier_rate", 0) for o in prev_orders)
        prev_margin = prev_revenue - prev_cost
        if prev_margin and abs(prev_margin) > 0.01:
            margin_change_pct = round((total_margin - prev_margin) / abs(prev_margin) * 100, 1)
        elif total_margin:
            margin_change_pct = None  # не было данных за прошлый месяц — без сравнения

    # Только валидные YYYY-MM (по дате выгрузки)
    import re as _re
    valid_ym = _re.compile(r"^\d{4}-\d{2}$")
    months = sorted({(o.get("unload_date") or o.get("load_date") or "")[:7]
                     for o in all_orders
                     if (o.get("unload_date") or o.get("load_date"))
                     and valid_ym.match((o.get("unload_date") or o.get("load_date") or "")[:7])},
                    reverse=True)[:24]

    return {
        "period": period,
        "available_months": months,
        "total_revenue": total_revenue,  # для совместимости
        "total_cost": total_cost,
        "total_margin": total_margin,
        "profit": profit,
        "tax_rate": TAX_RATE,
        "prev_period": prev_period,
        "prev_margin": prev_margin,
        "prev_revenue": prev_revenue,
        "margin_change_pct": margin_change_pct,
        "margin_percent": round((total_margin / total_revenue * 100), 1) if total_revenue else 0,
        "active_orders": len(active),
        "delivered_orders": len(delivered),
        "total_orders": len(orders),
        "unpaid_by_clients": unpaid_by_clients,
        "owed_to_carriers": owed_to_carriers,
        "clients_count": clients_count,
        "carriers_count": carriers_count,
        "leads_count": leads_count,
        "top_clients": top_clients,
        "top_clients_margin": top_clients_margin,
        "debtors": debtors,
        "creditors": creditors,
        "status_breakdown": status_breakdown,
        "chart_orders": [
            {"d": o.get("unload_date") or o.get("load_date"), "cr": o.get("client_rate", 0), "car": o.get("carrier_rate", 0)}
            for o in all_orders
            if o.get("unload_date") or o.get("load_date")
        ],
    }


# ====== App Settings ======
_DEFAULT_RATE_MINIMUMS = [
    {"route": "Москва↔Минск",       "cost": 720,  "current": 50,  "threshold": 865,  "status": "red"},
    {"route": "СПб↔Минск",          "cost": 406,  "current": 75,  "threshold": 487,  "status": "red"},
    {"route": "Минск↔Москва",       "cost": 492,  "current": 150, "threshold": 590,  "status": "red"},
    {"route": "Жодино↔Москва",      "cost": 543,  "current": 250, "threshold": 651,  "status": "yellow"},
    {"route": "Ульяновск–Минск",    "cost": 1328, "current": 900, "threshold": 1594, "status": "yellow"},
    {"route": "Минск–Минск (лок.)", "cost": 130,  "current": 0,   "threshold": 200,  "status": "red"},
    {"route": "Смоленск–Минск",     "cost": 335,  "current": 160, "threshold": 402,  "status": "yellow"},
]

_DEFAULT_GOALS = {
    "margin_goal": 10000,
    "new_clients_goal": 9,
    "trips_goal": 45,
    "avg_margin_goal": 230,
}


@api_router.get("/settings")
async def get_settings(current_user: dict = Depends(_require_user)):
    doc = await db.app_settings.find_one({"_id": "main"})
    if not doc:
        return {**_DEFAULT_GOALS, "rate_minimums": _DEFAULT_RATE_MINIMUMS}
    return {
        "margin_goal": doc.get("margin_goal", _DEFAULT_GOALS["margin_goal"]),
        "new_clients_goal": doc.get("new_clients_goal", _DEFAULT_GOALS["new_clients_goal"]),
        "trips_goal": doc.get("trips_goal", _DEFAULT_GOALS["trips_goal"]),
        "avg_margin_goal": doc.get("avg_margin_goal", _DEFAULT_GOALS["avg_margin_goal"]),
        "rate_minimums": doc.get("rate_minimums", _DEFAULT_RATE_MINIMUMS),
    }


@api_router.put("/settings")
async def update_settings(request: Request, current_user: dict = Depends(_require_user)):
    payload = await request.json()
    await db.app_settings.update_one({"_id": "main"}, {"$set": payload}, upsert=True)
    return {"ok": True}


# ====== Analytics ======
MONTHS_RU = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]


@api_router.get("/analytics")
async def analytics(month: Optional[str] = None, current_user: dict = Depends(_require_user)):
    all_orders = await db.orders.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(5000)

    period = month or "all"
    orders = [o for o in all_orders if order_in_period(o, period)]

    def _margin(o: dict) -> float:
        return o.get("client_rate", 0) - o.get("carrier_rate", 0)

    revenue = sum(o.get("client_rate", 0) for o in orders)
    expenses = sum(o.get("carrier_rate", 0) for o in orders)
    margin = revenue - expenses
    margin_pct = round(margin / revenue * 100, 1) if revenue else 0
    trips_count = len(orders)
    avg_margin = round(margin / trips_count, 1) if trips_count else 0

    # Goals — всегда текущий месяц
    cur_ym = datetime.now(timezone.utc).strftime("%Y-%m")
    cur_orders = [o for o in all_orders if order_in_period(o, cur_ym)]
    margin_fact = sum(_margin(o) for o in cur_orders)
    trips_fact = len(cur_orders)
    avg_margin_fact = round(margin_fact / trips_fact, 1) if trips_fact else 0
    prev_clients = {o.get("client_name") or "" for o in all_orders
                    if not order_in_period(o, cur_ym) and o.get("client_name")}
    cur_clients = {o.get("client_name") or "" for o in cur_orders if o.get("client_name")}
    new_clients_fact = len(cur_clients - prev_clients)

    # Clients top-10
    client_map: dict = {}
    for o in orders:
        n = o.get("client_name") or "—"
        if n not in client_map:
            client_map[n] = {"name": n, "trips": 0, "revenue": 0.0, "margin": 0.0}
        client_map[n]["trips"] += 1
        client_map[n]["revenue"] += o.get("client_rate", 0)
        client_map[n]["margin"] += _margin(o)
    clients_list = []
    for it in client_map.values():
        mp = round(it["margin"] / it["revenue"] * 100, 1) if it["revenue"] else 0
        clients_list.append({**it, "margin_pct": mp})
    clients_list = sorted(clients_list, key=lambda x: x["margin"], reverse=True)[:10]

    # Routes top-8
    route_map: dict = {}
    for o in orders:
        rf = (o.get("route_from") or "").strip()
        rt = (o.get("route_to") or "").strip()
        route = f"{rf}–{rt}" if rf and rt else rf or rt or "—"
        if route not in route_map:
            route_map[route] = {"route": route, "trips": 0, "total_margin": 0.0}
        route_map[route]["trips"] += 1
        route_map[route]["total_margin"] += _margin(o)
    routes_list = []
    for it in route_map.values():
        avg_m = round(it["total_margin"] / it["trips"], 1) if it["trips"] else 0
        routes_list.append({**it, "avg_margin": avg_m})
    routes_list = sorted(routes_list, key=lambda x: x["total_margin"], reverse=True)[:8]

    # Loss trips (маржа < 0)
    loss_trips = []
    for o in orders:
        m = _margin(o)
        if m < 0:
            rf = (o.get("route_from") or "").strip()
            rt = (o.get("route_to") or "").strip()
            route = f"{rf}–{rt}" if rf and rt else rf or rt or "—"
            loss_trips.append({
                "number": o.get("order_number", ""),
                "client": o.get("client_name") or "—",
                "route": route,
                "client_rate": o.get("client_rate", 0),
                "carrier_rate": o.get("carrier_rate", 0),
                "loss": m,
            })
    loss_trips = sorted(loss_trips, key=lambda x: x["loss"])

    # Monthly breakdown (по всем заявкам, не по периоду)
    monthly_map: dict = {}
    for o in all_orders:
        ym = (o.get("unload_date") or o.get("load_date") or o.get("created_at", ""))[:7]
        if not ym or len(ym) < 7:
            continue
        if ym not in monthly_map:
            monthly_map[ym] = {"month": ym, "revenue": 0.0, "expenses": 0.0, "margin": 0.0, "trips": 0}
        monthly_map[ym]["revenue"] += o.get("client_rate", 0)
        monthly_map[ym]["expenses"] += o.get("carrier_rate", 0)
        monthly_map[ym]["margin"] += _margin(o)
        monthly_map[ym]["trips"] += 1
    monthly_list = []
    for it in sorted(monthly_map.values(), key=lambda x: x["month"]):
        try:
            m_idx = int(it["month"][5:7]) - 1
            label = MONTHS_RU[m_idx]
        except Exception:
            label = it["month"]
        monthly_list.append({**it, "label": label})

    return {
        "period": period,
        "summary": {
            "revenue": revenue, "expenses": expenses, "margin": margin,
            "margin_pct": margin_pct, "trips_count": trips_count, "avg_margin": avg_margin,
        },
        "goals": {
            "margin_goal": 10000, "margin_fact": round(margin_fact, 1),
            "new_clients_goal": 9, "new_clients_fact": new_clients_fact,
            "trips_goal": 45, "trips_fact": trips_fact,
            "avg_margin_goal": 230, "avg_margin_fact": avg_margin_fact,
        },
        "monthly": monthly_list,
        "clients": clients_list,
        "routes": routes_list,
        "loss_trips": loss_trips,
    }


# ====== Global Search ======
@api_router.get("/search")
async def global_search(q: str = "", current_user: dict = Depends(_require_user)):
    if len(q) < 2:
        return {"orders": [], "clients": [], "carriers": [], "leads": []}
    regex = {"$regex": q, "$options": "i"}

    async def _search_orders():
        return await db.orders.find(
            {"deleted": {"$ne": True}, "$or": [{"order_number": regex}, {"client_name": regex}, {"carrier_name": regex}]},
            {"_id": 0, "id": 1, "order_number": 1, "client_name": 1, "carrier_name": 1, "status": 1},
        ).to_list(5)

    async def _search_clients():
        return await db.clients.find(
            {"deleted": {"$ne": True}, "$or": [{"name": regex}, {"phone": regex}, {"city": regex}]},
            {"_id": 0, "id": 1, "name": 1, "phone": 1, "city": 1},
        ).to_list(5)

    async def _search_carriers():
        return await db.carriers.find(
            {"deleted": {"$ne": True}, "$or": [{"company_name": regex}, {"phone": regex}, {"city": regex}]},
            {"_id": 0, "id": 1, "company_name": 1, "phone": 1, "city": 1},
        ).to_list(5)

    async def _search_leads():
        return await db.leads.find(
            {"deleted": {"$ne": True}, "$or": [{"name": regex}, {"company": regex}, {"phone": regex}]},
            {"_id": 0, "id": 1, "name": 1, "company": 1, "phone": 1, "status": 1},
        ).to_list(5)

    orders_r, clients_r, carriers_r, leads_r = await asyncio.gather(
        _search_orders(), _search_clients(), _search_carriers(), _search_leads()
    )
    return {"orders": orders_r, "clients": clients_r, "carriers": carriers_r, "leads": leads_r}


# ====== Seed ======
@api_router.post("/seed")
async def seed_data():
    await db.orders.delete_many({})
    await db.clients.delete_many({})
    await db.carriers.delete_many({})
    await db.leads.delete_many({})

    clients = [
        Client(name="ООО Логистик-Прайм", contact_person="Иванов И.И.", phone="+7 (495) 111-22-33", email="info@logistic-prime.ru",
               inn="7701234567", kpp="770101001", legal_address="г. Москва, ул. Тверская, д. 10",
               bank_name="ПАО Сбербанк", bank_account="40702810400000012345", bank_bik="044525225", bank_corr_account="30101810400000000225",
               payment_terms="10 дней", cargo_types="Электроника, бытовая техника", directions="МСК-СПб, МСК-НСК"),
        Client(name="ТД Северный Ветер", contact_person="Петрова О.С.", phone="+7 (812) 222-33-44", email="op@nordwind.ru",
               inn="7802345678", kpp="780201001", legal_address="г. СПб, Невский пр., д. 22",
               bank_name="АО Альфа-Банк", bank_account="40702810500000098765", bank_bik="044030786", bank_corr_account="30101810200000000593",
               payment_terms="7 дней", cargo_types="Продукты питания (реф)", directions="СПб-Урал"),
        Client(name="АО МеталлТорг", contact_person="Сидоров А.В.", phone="+7 (343) 333-44-55", email="logistics@metalltorg.ru",
               inn="6603456789", kpp="660301001", legal_address="г. Екатеринбург, ул. Ленина, д. 50",
               bank_name="ВТБ", bank_account="40702810700000054321", bank_bik="046577751", bank_corr_account="30101810700000000751",
               payment_terms="14 дней", cargo_types="Металлопрокат, арматура", directions="Урал-юг РФ"),
        Client(name="ИП Смирнов В.П.", contact_person="Смирнов В.П.", phone="+7 (903) 444-55-66", email="smirnov@mail.ru",
               inn="770345678901", payment_terms="3 дня", cargo_types="Хим. продукция в IBC"),
        Client(name="ООО Гранд Пром", contact_person="Кузнецова Е.Н.", phone="+7 (495) 555-66-77", email="grand@grandprom.ru",
               inn="7704567890", kpp="770401001", bank_name="Тинькофф", bank_account="40702810900000067890", bank_bik="044525974",
               payment_terms="5 дней", cargo_types="Запчасти", directions="ЦФО"),
    ]
    for c in clients: await db.clients.insert_one(c.dict())

    carriers = [
        Carrier(company_name="ИП Морозов А.Н.", driver_name="Морозов Андрей Николаевич", phone="+7 (905) 100-20-30",
                inn="503012345678", legal_address="МО, г. Подольск, ул. Кирова, д. 5",
                bank_name="Сбербанк", bank_account="40802810400001234567", bank_bik="044525225",
                vehicle_type="Тент", plate="А123БВ77", capacity_tons=20, capacity_m3=86, rating=4.8,
                cargo_types="Стандартные грузы", regions="ЦФО, СЗФО"),
        Carrier(company_name="ООО ТрансЛайн", driver_name="Волков Сергей Иванович", phone="+7 (916) 200-30-40",
                inn="7706123456", kpp="770601001", bank_name="ВТБ", bank_account="40702810800009876543", bank_bik="046577751",
                vehicle_type="Реф", plate="М456КН99", capacity_tons=20, capacity_m3=82, rating=4.9,
                cargo_types="Продукты, медикаменты", regions="Россия + Беларусь"),
        Carrier(company_name="ИП Гусев Д.Л.", driver_name="Гусев Дмитрий", phone="+7 (921) 300-40-50",
                inn="780234567890", vehicle_type="Изотерм", plate="К789ЕР78", capacity_tons=10, capacity_m3=45, rating=4.5,
                regions="СЗФО"),
        Carrier(company_name="АвтоПарк-Юг", driver_name="Романов Виктор", phone="+7 (988) 400-50-60",
                inn="2308765432", bank_name="Сбербанк", bank_account="40702810400005554433", bank_bik="040349602",
                vehicle_type="Тент", plate="Е321ОТ23", capacity_tons=20, capacity_m3=90, rating=4.7,
                regions="ЮФО, СКФО"),
        Carrier(company_name="ИП Беляев К.С.", driver_name="Беляев Константин", phone="+7 (962) 500-60-70",
                inn="660345678123", vehicle_type="Тент", plate="У654АХ66", capacity_tons=5, capacity_m3=24, rating=4.3,
                regions="УФО"),
    ]
    for c in carriers: await db.carriers.insert_one(c.dict())

    # Несколько заявок старше 15 дней с неоплатами для подсветки
    orders_data = [
        # старая неоплаченная (должна подсветиться красным)
        ("№2025-0120", clients[0], carriers[0], "Москва", "СПб", "г. Москва, Каширское ш., 23", "г. СПб, ул. Софийская, 14А", "2026-01-15", "2026-01-16", 95000, 75000, "delivered", False, False, True, False, False, False, "Электроника", 12),
        ("№2025-0118", clients[2], carriers[3], "Екатеринбург", "Краснодар", "г. Екатеринбург, ул. Шефская, 2В", "г. Краснодар, ул. Дзержинского, 100", "2026-01-10", "2026-01-13", 220000, 175000, "delivered", False, True, True, True, True, False, "Металлопрокат", 20),
        # свежие
        ("№2025-0142", clients[0], carriers[0], "Москва", "Санкт-Петербург", "г. Москва, Каширское ш., 23, склад №4", "г. СПб, ул. Софийская, 14А", "2026-02-12", "2026-02-13", 95000, 75000, "in_progress", True, False, True, True, False, False, "Электроника", 12),
        ("№2025-0141", clients[1], carriers[1], "Санкт-Петербург", "Екатеринбург", "г. СПб, пр. Обуховской Обороны, 271", "г. Екатеринбург, ул. Машинная, 31", "2026-02-10", "2026-02-12", 180000, 145000, "delivered", True, True, True, True, True, True, "Продукты питания (реф)", 18),
        ("№2025-0139", clients[3], carriers[2], "Москва", "Казань", "МО, Дмитровский р-н, склад", "г. Казань, ул. Гаврилова, 5", "2026-02-14", "2026-02-15", 65000, 48000, "new", False, False, False, False, False, False, "Хим. продукция", 8),
        ("№2025-0138", clients[4], carriers[4], "Нижний Новгород", "Москва", "г. Н.Новгород, ул. Кузбасская, 1", "г. Москва, МКАД 41 км", "2026-02-09", "2026-02-09", 38000, 28000, "delivered", True, True, True, True, True, True, "Запчасти", 4),
        ("№2025-0137", clients[0], carriers[1], "Москва", "Новосибирск", "г. Москва, Каширское ш., 23", "г. Новосибирск, ул. Петухова, 17", "2026-02-15", "2026-02-19", 320000, 260000, "in_progress", False, False, True, False, False, False, "Бытовая техника", 19),
        ("№2025-0136", clients[2], carriers[0], "Челябинск", "Москва", "г. Челябинск, ул. Производственная, 8Б", "г. Москва, склад МКАД 23", "2026-02-11", "2026-02-13", 145000, 115000, "in_progress", True, False, True, True, False, False, "Стройматериалы", 20),
    ]
    for od in orders_data:
        (num, cl, cr, rf, rt, raf, rat, ld, ud, c_rate, cr_rate, status, cp, crp, dtcs, dfcr, dtcrs, dfcrr, cargo, w) = od
        await db.orders.insert_one(Order(
            order_number=num, client_id=cl.id, client_name=cl.name,
            carrier_id=cr.id, carrier_name=cr.company_name,
            route_from=rf, route_to=rt, route_from_address=raf, route_to_address=rat,
            load_date=ld, unload_date=ud,
            driver_name=cr.driver_name, driver_phone=cr.phone,
            vehicle_type=cr.vehicle_type, vehicle_plate=cr.plate,
            client_rate=c_rate, carrier_rate=cr_rate,
            status=status, client_paid=cp, carrier_paid=crp,
            docs_to_client_sent=dtcs, docs_from_client_received=dfcr,
            docs_to_carrier_sent=dtcrs, docs_from_carrier_received=dfcrr,
            cargo=cargo, weight_tons=w,
        ).dict())

    leads = [
        Lead(name="Орлов Михаил", company="ООО Восток-Логистик", phone="+7 (495) 700-10-20", city="Москва", status="new", next_call="2026-02-12", notes="Интерес — еженедельные перевозки МСК-СПб"),
        Lead(name="Захарова Анна", company="ТД Полюс", phone="+7 (812) 700-20-30", city="СПб", status="sent_kp", last_contact="2026-02-08", next_call="2026-02-13", notes="Просили КП на реф направление"),
        Lead(name="Николаев Пётр", company="АО Стройка-Сервис", phone="+7 (343) 700-30-40", city="Екатеринбург", status="thinking", last_contact="2026-02-09", next_call="2026-02-11", notes="Готовы к тестовому рейсу"),
        Lead(name="Григорьев Олег", company="ИП Григорьев", phone="+7 (961) 700-40-50", city="Краснодар", status="won", last_contact="2026-02-07", notes="Стал клиентом"),
        Lead(name="Соколова Мария", company="ООО АгроТранс", phone="+7 (902) 700-50-60", city="Воронеж", status="new", next_call="2026-02-14", notes="Сезон — март-октябрь"),
    ]
    for l in leads: await db.leads.insert_one(l.dict())

    return {"ok": True, "clients": len(clients), "carriers": len(carriers), "orders": len(orders_data), "leads": len(leads)}


# ====== Finance: Withdrawals ======
class FinanceWithdrawal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amount: float
    date: str
    note: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class FinanceWithdrawalPayload(BaseModel):
    amount: float
    date: str
    note: Optional[str] = ""


@api_router.get("/finance/withdrawals", response_model=List[FinanceWithdrawal])
async def list_withdrawals():
    docs = await db.finance_withdrawals.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    return [FinanceWithdrawal(**d) for d in docs]


@api_router.post("/finance/withdrawals", response_model=FinanceWithdrawal)
async def create_withdrawal(payload: FinanceWithdrawalPayload):
    obj = FinanceWithdrawal(**payload.dict())
    await db.finance_withdrawals.insert_one(obj.dict())
    return obj


@api_router.delete("/finance/withdrawals/{wid}")
async def delete_withdrawal(wid: str):
    await db.finance_withdrawals.delete_one({"id": wid})
    return {"ok": True}


# ====== Finance: Transactions ======
class FinanceTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "income" | "expense"
    amount: float
    date: str
    description: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class FinanceTransactionPayload(BaseModel):
    type: str
    amount: float
    date: str
    description: Optional[str] = ""


@api_router.get("/finance/transactions", response_model=List[FinanceTransaction])
async def list_finance_transactions():
    docs = await db.finance_transactions.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    return [FinanceTransaction(**d) for d in docs]


@api_router.post("/finance/transactions", response_model=FinanceTransaction)
async def create_finance_transaction(payload: FinanceTransactionPayload):
    obj = FinanceTransaction(**payload.dict())
    await db.finance_transactions.insert_one(obj.dict())
    return obj


@api_router.delete("/finance/transactions/{tid}")
async def delete_finance_transaction(tid: str):
    await db.finance_transactions.delete_one({"id": tid})
    return {"ok": True}


# ====== Notes ======
class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    text: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class NotePayload(BaseModel):
    title: str
    text: Optional[str] = ""


@api_router.get("/notes", response_model=List[Note])
async def list_notes():
    docs = await db.notes.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [Note(**d) for d in docs]


@api_router.post("/notes", response_model=Note)
async def create_note(payload: NotePayload):
    obj = Note(**payload.dict())
    await db.notes.insert_one(obj.dict())
    return obj


@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    await db.notes.delete_one({"id": note_id})
    return {"ok": True}


# ====== Trash ======
_TRASH_LABELS = {
    "orders": "Заявка",
    "clients": "Клиент",
    "carriers": "Перевозчик",
    "leads": "Лид",
}


@api_router.get("/trash")
async def list_trash(current_user: dict = Depends(_require_user)):
    result = []
    for cname, type_label in _TRASH_LABELS.items():
        docs = await db[cname].find({"deleted": True}, {"_id": 0}).sort("deleted_at", -1).to_list(1000)
        for d in docs:
            label = d.get("order_number") or d.get("name") or d.get("company_name") or d.get("id", "")
            result.append({
                "id": d.get("id"),
                "collection": cname,
                "type": type_label,
                "label": label,
                "deleted_at": d.get("deleted_at"),
            })
    result.sort(key=lambda x: x.get("deleted_at") or "", reverse=True)
    return result


@api_router.post("/trash/restore/{collection}/{item_id}")
async def restore_trash(collection: str, item_id: str, current_user: dict = Depends(_require_user)):
    if collection not in _TRASH_LABELS:
        raise HTTPException(400, "Неизвестная коллекция")
    result = await db[collection].update_one(
        {"id": item_id, "deleted": True},
        {"$unset": {"deleted": "", "deleted_at": ""}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Запись не найдена в корзине")
    return {"ok": True}


@api_router.post("/trash/purge")
async def purge_trash(current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    total = 0
    for cname in _TRASH_LABELS:
        r = await db[cname].delete_many({"deleted": True})
        total += r.deleted_count
    return {"ok": True, "deleted_count": total}


# ====== Backup ======
@api_router.get("/backup/list")
async def list_backups(current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    docs = await db.backups.find({}, {"_id": 0, "collections": 0}).sort("created_at", -1).to_list(50)
    return docs


@api_router.post("/backup/create")
async def create_backup_manual(current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    await _create_backup()
    return {"ok": True}


@api_router.post("/backup/restore/{backup_id}")
async def restore_backup(backup_id: str, current_user: dict = Depends(_require_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Только для администратора")
    doc = await db.backups.find_one({"id": backup_id})
    if not doc:
        raise HTTPException(404, "Бэкап не найден")
    snapshot = doc.get("collections", {})
    for cname, docs_list in snapshot.items():
        if not isinstance(docs_list, list):
            continue
        await db[cname].delete_many({})
        if docs_list:
            await db[cname].insert_many(docs_list)
    return {"ok": True, "restored_at": now_iso()}


@api_router.get("/")
async def root():
    return {"message": "Logistics CRM API"}


@app.post("/api/admin/restore")
async def restore_admin():
    await db.users.update_one(
        {"login": "admin"},
        {"$set": {"role": "admin", "permissions": {"can_view_finance": True, "can_view_all_orders": True, "can_view_all_clients": True, "can_view_all_leads": True, "can_create_orders": True}}}
    )
    return {"ok": True}


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)




@api_router.get("/ping")
async def ping():
    return {"ok": True}


@api_router.post("/admin/restore")
async def admin_restore():
    all_perms = {
        "can_view_finance": True,
        "can_view_all_orders": True,
        "can_view_all_clients": True,
        "can_view_all_leads": True,
        "can_create_orders": True,
    }
    result = await db.users.update_one(
        {"login": "admin"},
        {"$set": {"role": "admin", "permissions": all_perms}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Пользователь admin не найден")
    user = await db.users.find_one({"login": "admin"}, {"_id": 0, "password_hash": 0})
    return {"ok": True, "user": user}
