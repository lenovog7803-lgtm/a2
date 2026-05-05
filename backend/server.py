from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

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
    from oauth_google import build_flow as _oauth_build_flow, get_redirect_uri as _oauth_get_redirect, SCOPES as _OAUTH_SCOPES
except Exception as _e:  # pragma: no cover
    _oauth_build_flow = None
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_auto_sync_loop())
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

TAX_RATE = 0.20  # 20% — для расчёта прибыли (маржа − налог)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    # 4 раздельных статуса по документам
    docs_to_client_sent: bool = False       # Документы Клиенту — отправлены
    docs_from_client_received: bool = False  # Документы от Клиента — получены
    docs_to_carrier_sent: bool = False       # Документы Перевозчику — отправлены/получены им
    docs_from_carrier_received: bool = False # Документы от Перевозчика — получены/они отправили
    cargo: Optional[str] = ""
    weight_tons: Optional[float] = 0
    notes: Optional[str] = ""
    # Ссылки на сгенерированные документы Google Docs
    doc_url_client: Optional[str] = ""
    doc_url_carrier: Optional[str] = ""
    doc_url_act: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


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
    docs_to_client_sent: bool = False
    docs_from_client_received: bool = False
    docs_to_carrier_sent: bool = False
    docs_from_carrier_received: bool = False
    cargo: Optional[str] = ""
    weight_tons: Optional[float] = 0
    notes: Optional[str] = ""
    doc_url_client: Optional[str] = ""
    doc_url_carrier: Optional[str] = ""
    doc_url_act: Optional[str] = ""


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
    docs_to_client_sent: Optional[bool] = None
    docs_from_client_received: Optional[bool] = None
    docs_to_carrier_sent: Optional[bool] = None
    docs_from_carrier_received: Optional[bool] = None
    cargo: Optional[str] = None
    weight_tons: Optional[float] = None
    notes: Optional[str] = None
    doc_url_client: Optional[str] = None
    doc_url_carrier: Optional[str] = None
    doc_url_act: Optional[str] = None


class Lead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company: Optional[str] = ""
    phone: str
    city: Optional[str] = ""
    status: str = "new"
    last_contact: Optional[str] = ""
    next_call: Optional[str] = ""
    notes: Optional[str] = ""
    directions: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class LeadPayload(BaseModel):
    name: str
    company: Optional[str] = ""
    phone: str
    city: Optional[str] = ""
    status: str = "new"
    last_contact: Optional[str] = ""
    next_call: Optional[str] = ""
    notes: Optional[str] = ""
    directions: Optional[str] = ""


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    status: Optional[str] = None
    last_contact: Optional[str] = None
    next_call: Optional[str] = None
    notes: Optional[str] = None
    directions: Optional[str] = None


# ===== CRUD helper =====
def make_crud(prefix: str, collection: str, ModelCls, PayloadCls, sync_to_sheets: bool = False):
    @api_router.get(f"/{prefix}", response_model=List[ModelCls])
    async def list_items():
        docs = await db[collection].find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
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
        doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Not found")
        return ModelCls(**doc)

    @api_router.put(f"/{prefix}/{{item_id}}", response_model=ModelCls)
    async def update_item(item_id: str, payload: PayloadCls, background_tasks: BackgroundTasks):
        await db[collection].update_one({"id": item_id}, {"$set": payload.dict()})
        doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Not found")
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
        if sync_to_sheets and collection == "leads":
            doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
            if doc:
                background_tasks.add_task(_bg_delete_lead, doc.get("name", ""))
        if sync_to_sheets and collection == "clients":
            doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
            if doc:
                background_tasks.add_task(_bg_delete_client, doc.get("name", ""))
        await db[collection].delete_one({"id": item_id})
        return {"ok": True}


make_crud("clients", "clients", Client, ClientPayload, sync_to_sheets=True)
make_crud("carriers", "carriers", Carrier, CarrierPayload, sync_to_sheets=True)
make_crud("leads", "leads", Lead, LeadUpdate, sync_to_sheets=True)


@api_router.get("/orders", response_model=List[Order])
async def list_orders():
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [Order(**d) for d in docs]


@api_router.get("/orders/next_number")
async def next_order_number():
    """Возвращает следующий номер заявки в формате 'З-NNN/YYYY'.
    Берёт максимальный номер из существующих заявок текущего года и прибавляет 1.
    Если года нет — начинает с 'З-001/YYYY'.
    """
    import re as _re
    year = datetime.now(timezone.utc).year
    # ищем все номера типа "З-NNN/YYYY" или "3-NNN/YYYY"
    docs = await db.orders.find({}, {"_id": 0, "order_number": 1}).to_list(5000)
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
async def create_order(payload: OrderPayload, background_tasks: BackgroundTasks):
    obj = Order(**payload.dict())
    await db.orders.insert_one(obj.dict())
    background_tasks.add_task(_bg_push_order, obj.dict())
    background_tasks.add_task(_bg_trigger_apps_script, obj.order_number)
    return obj


@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    return Order(**doc)


@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, payload: OrderUpdate, background_tasks: BackgroundTasks):
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if update_data:
        await db.orders.update_one({"id": order_id}, {"$set": update_data})
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    background_tasks.add_task(_bg_push_order, doc)
    return Order(**doc)


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, background_tasks: BackgroundTasks):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0, "order_number": 1})
    await db.orders.delete_one({"id": order_id})
    if doc and doc.get("order_number"):
        background_tasks.add_task(_bg_delete_order_row, doc["order_number"])
    return {"ok": True}


# ====== OAuth Google (для генерации Docs от имени пользователя) ======
from fastapi.responses import HTMLResponse, RedirectResponse


@api_router.get("/auth/google/start")
async def auth_google_start(request: Request = None):  # type: ignore  # noqa
    """Возвращает auth_url для перехода пользователя на consent screen Google."""
    if _oauth_build_flow is None:
        raise HTTPException(500, "OAuth не настроен")
    try:
        flow = _oauth_build_flow()
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',  # обязательно — без этого может не вернуться refresh_token
        )
        return {"auth_url": auth_url, "state": state, "redirect_uri": flow.redirect_uri}
    except Exception as e:
        raise HTTPException(500, f"OAuth start failed: {e}")


@api_router.get("/auth/google/callback")
async def auth_google_callback(code: str = "", state: str = "", error: str = ""):
    """Принимает code от Google, обменивает на refresh_token и сохраняет в Mongo."""
    if error:
        return HTMLResponse(_callback_html("Ошибка авторизации: " + error, success=False))
    if not code:
        return HTMLResponse(_callback_html("Не получен код авторизации", success=False))
    if _oauth_build_flow is None:
        return HTMLResponse(_callback_html("OAuth не настроен на сервере", success=False))

    try:
        flow = _oauth_build_flow()
        flow.fetch_token(code=code)
        creds = flow.credentials
        token_doc = {
            "_id": "google",
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
            "scopes": list(creds.scopes or []),
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
    all_orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    orders = [o for o in all_orders if order_in_period(o, period)]

    clients_count = await db.clients.count_documents({})
    carriers_count = await db.carriers.count_documents({})
    leads_count = await db.leads.count_documents({})

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
        "debtors": debtors,
        "creditors": creditors,
        "status_breakdown": status_breakdown,
        "chart_orders": [
            {"d": o.get("unload_date") or o.get("load_date"), "cr": o.get("client_rate", 0), "car": o.get("carrier_rate", 0)}
            for o in all_orders
            if o.get("unload_date") or o.get("load_date")
        ],
    }


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
        Lead(name="Захарова Анна", company="ТД Полюс", phone="+7 (812) 700-20-30", city="СПб", status="in_progress", last_contact="2026-02-08", next_call="2026-02-13", notes="Просили КП на реф направление"),
        Lead(name="Николаев Пётр", company="АО Стройка-Сервис", phone="+7 (343) 700-30-40", city="Екатеринбург", status="in_progress", last_contact="2026-02-09", next_call="2026-02-11", notes="Готовы к тестовому рейсу"),
        Lead(name="Григорьев Олег", company="ИП Григорьев", phone="+7 (961) 700-40-50", city="Краснодар", status="won", last_contact="2026-02-07", notes="Стал клиентом"),
        Lead(name="Соколова Мария", company="ООО АгроТранс", phone="+7 (902) 700-50-60", city="Воронеж", status="new", next_call="2026-02-14", notes="Сезон — март-октябрь"),
    ]
    for l in leads: await db.leads.insert_one(l.dict())

    return {"ok": True, "clients": len(clients), "carriers": len(carriers), "orders": len(orders_data), "leads": len(leads)}


@api_router.get("/")
async def root():
    return {"message": "Logistics CRM API"}


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)




# Keep-alive endpoint
@api_router.get("/ping")
async def ping():
    return {"ok": True}


# Keep-alive endpoint
@api_router.get("/ping")
async def ping():
    return {"ok": True}


# Keep-alive endpoint
@api_router.get("/ping")
async def ping():
    return {"ok": True}
