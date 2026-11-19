"""
Модуль конфигурации lead_hunter.
Загрузка переменных окружения, пороговые ставки рентабельности и правила гео-фильтрации.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Поиск .env в текущей папке или в backend/.env
BASE_DIR = Path(__file__).resolve().parent
ENV_CANDIDATES = [
    BASE_DIR / ".env",
    BASE_DIR.parent / "backend" / ".env",
    BASE_DIR.parent / ".env",
    Path("/Users/egoraleksandrorvic/Downloads/a2-main/backend/.env"),
]

for env_path in ENV_CANDIDATES:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

# --- Ключи и сервисы ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite").strip()

# Google Sheets
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "1G0vzuwRKMH6lqG2iZ8Mdub2zDkOG1ViBPrVQEq3rjtU").strip()
GOOGLE_CREDS_PATH = os.getenv("GOOGLE_CREDS_PATH") or os.getenv("GOOGLE_CREDENTIALS_PATH")
if not GOOGLE_CREDS_PATH or not Path(GOOGLE_CREDS_PATH).exists():
    fallback_creds = BASE_DIR.parent / "backend" / "google_credentials.json"
    if fallback_creds.exists():
        GOOGLE_CREDS_PATH = str(fallback_creds)
    else:
        GOOGLE_CREDS_PATH = "google_credentials.json"

# MongoDB
MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URL", "mongodb+srv://admin:12369874@cluster0.fec1srg.mongodb.net/?appName=Cluster0")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME") or os.getenv("DB_NAME", "logistics_crm")

# Прямой fallback URI для MongoDB Atlas (если системный DNS macOS блокирует SRV-запросы через UDP)
DIRECT_ATLAS_URI = (
    "mongodb://admin:12369874@"
    "ac-03wq2ij-shard-00-00.fec1srg.mongodb.net:27017,"
    "ac-03wq2ij-shard-00-01.fec1srg.mongodb.net:27017,"
    "ac-03wq2ij-shard-00-02.fec1srg.mongodb.net:27017/"
    "?ssl=true&replicaSet=atlas-5vd158-shard-0&authSource=admin"
)

# Telegram
TG_BOT_TOKEN = os.getenv("TG_BOT_TOKEN") or os.getenv("A2_INFO_BOT_TOKEN", "").strip()
TG_CHAT_ID = os.getenv("TG_CHAT_ID") or os.getenv("A2_INFO_ONLY_CHAT_IDS", "558556324").split(",")[0].strip()

# Telethon (для парсинга чатов селлеров в Telegram)
TG_API_ID = int(os.getenv("TG_API_ID", "0")) if os.getenv("TG_API_ID") else None
TG_API_HASH = os.getenv("TG_API_HASH", "").strip()

# --- Пороговые ставки отключены ---
MINIMUM_RATES = []

# --- Правила фильтрации географии (СТРОГО МИНСК И МИНСКИЙ РАЙОН) ---
MINSK_ALLOWED_KEYWORDS = [
    "минск", "мкад", "колядичи", "боровляны", "ждановичи", "гатово",
    "привольный", "фаниполь", "заславль", "шабаны", "мачулищи",
    "колодищи", "хатежино", "сенница", "сеница", "тарасово",
    "щомыслица", "лесной", "озерцо", "самохваловичи", "юзуфово",
    "новый двор", "острошицкий", "минский р-н", "минский район"
]

NON_MINSK_STOPWORDS = [
    "гомель", "брест", "гродно", "витебск", "могилев", "могилёв",
    "лида", "барановичи", "пинск", "бобруйск", "новополоцк", "полоцк",
    "орша", "светлогорск", "жлобин", "речица", "мозырь", "солигорск",
    "слуцк", "кобрин", "волковыск", "слоним", "сморгонь", "калинковичи",
    "рогачев", "рогачёв", "горки", "осиповичи", "береза", "берёза",
    "ивацевичи", "лунинец", "москва", "спб", "санкт-петербург",
    "смоленск", "брянск", "рязань", "ульяновск", "россия", "тверь",
    "калуга", "воронеж", "краснодар", "ростов", "казань"
]

# --- Стоп-слова тестового мусора ---
TEST_GARBAGE_STOPWORDS = [
    "тест", "test", "акака", "акак", "какакаак", "ромошка",
    "йцук", "asdf", "qwerty", "12345", "проверка", "фыва"
]

# --- Стоп-слова конкурентов (перевозчики, экспедиторы, курьеры) ---
COMPETITOR_STOPWORDS = [
    "экспедитор", "экспедиция", "транспортная компания", "перевозчик",
    "автопарк", "курьерская", "курьер", "грузовое такси", "эвакуатор",
    "попутный груз", "автоперевозки", "логистический оператор",
    "такси", "пассажирские", "диспетчер"
]

# --- Стоп-слова госорганизаций и бюджетных учреждений (СТРОГО ЗАПРЕЩЕНО) ---
import re

STATE_ORG_REGEX = re.compile(
    r'(?:\b(?:руп|куп|гуп|гу|учреждение|суд|мвд|мчс)\b|'
    r'государствен|поликлиник|больниц|клиническ|рнпц|бгу|бнту|бгэу|бгуир|бгму|бгту|'
    r'университет|институт|академи|колледж|гимнази|министерств|ведомств|комитет|'
    r'департамент|администраци|бюджет|коммунальн|жилкомхоз|жрэо|водоканал|'
    r'белтаможсервис|белпочта|белтелеком|белфармация|центр гигиены|санитарн|надзор|'
    r'прокуратур|таможн|военком|исполком|райисполком|горсовет|'
    r'республиканск.*унитарн|коммунальн.*унитарн|государственн.*учрежден|технопарк|санатори)',
    re.IGNORECASE
)

def is_state_or_budget_org(text: str) -> bool:
    """Проверка текста на принадлежность к госсектору или бюджетным структурам."""
    if not text:
        return False
    return bool(STATE_ORG_REGEX.search(text))

SERVICE_AGENCY_REGEX = re.compile(
    r'(маркетинг|агентство|веб-студи|web-студи|софт|soft|dev\b|разработка по|'
    r'консалтинг|бухгалтер|юридическ|рекламн|клининг|подбор персонал|рекрутинг)',
    re.IGNORECASE
)

def is_service_agency(text: str) -> bool:
    """Проверка на сервисные агентства (IT, реклама, консалтинг), не имеющие физических грузов."""
    if not text:
        return False
    return bool(SERVICE_AGENCY_REGEX.search(text))

STATE_GOV_STOPWORDS = [
    "государственн", "госпредприяти", "рнпц", "университет", "институт",
    "поликлиник", "больниц", "клиническ", "министерств", "ведомств",
    "комитет", "управлени", "департамент", "администраци", "учреждени",
    "бюджет", "коммунальн", "жилкомхоз", "жрэо", "водоканал", "белтаможсервис",
    "белпочта", "белтелеком", "белфармация", "академи", "колледж", "гимнази",
    "школ", "центр гигиены", "санитарн", "надзор", "суд", "прокуратур",
    "мвд", "мчс", "таможн", "военком", "исполком", "райисполком", "горсовет",
    "казенн", "казённ", "технопарк", "санатори",
    "республиканское унитарное", "коммунальное унитарное", "государственное учреждение"
]
