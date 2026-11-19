"""
Pydantic-схемы для Gemini Structured Outputs, валидации и сохранения в CRM MongoDB.
"""

from typing import Literal, Optional, List, Any, Dict
from pydantic import BaseModel, Field
from datetime import datetime, timezone

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# --- Схемы для квалификации Gemini AI ---
class GeminiLeadQualification(BaseModel):
    is_minsk: bool = Field(description="Находится ли офис, склад или производство в Минске или Минском районе")
    is_valid_shipper: bool = Field(description="Является ли прямым грузовладельцем (НЕ перевозчик, НЕ экспедитор, НЕ курьер)")
    funnel: Literal["WB_OZON", "B2B_HOT", "B2B_WARM", "ARCHIVE"] = Field(
        description="Целевая воронка: WB_OZON (селлеры/фулфилмент), B2B_HOT (горячие заводы/импортеры РФ с маржой >20%), B2B_WARM (потенциальные), ARCHIVE (не Минск или мусор/конкурент)"
    )
    heat_score: int = Field(
        description="Балл горячести от 1 до 100: 85-100 явный триггер отгрузок в РФ прямо сейчас; 60-84 целевая ниша; <60 низкий приоритет",
        ge=1,
        le=100
    )
    niche: str = Field(description="Отрасль: Селлер WB/Ozon, Фулфилмент, FMCG/Продукты, Одежда/Текстиль, Запчасти/Оборудование, Химия/Упаковка, Медтехника, Другое")
    pitch_script: str = Field(description="Персонализированная фраза-зацепка на 1-2 предложения для первого звонка или сообщения в Telegram")
    selection_reason: str = Field(default="", description="Четкая коммерческая причина, почему взят этот клиент (например: Частный производитель косметики в Минске, отгрузки на маркетплейсы РФ)")
    disqualification_reason: Optional[str] = Field(default="", description="Причина отсева, если воронка ARCHIVE")

class GeminiBatchItem(BaseModel):
    index: int = Field(description="Порядковый номер компании из переданного списка")
    is_minsk: bool
    is_valid_shipper: bool
    funnel: Literal["WB_OZON", "B2B_HOT", "B2B_WARM", "ARCHIVE"]
    heat_score: int
    niche: str
    pitch_script: str
    selection_reason: Optional[str] = ""
    disqualification_reason: Optional[str] = ""

class GeminiBatchQualification(BaseModel):
    items: List[GeminiBatchItem]

# --- Модель лида для MongoDB CRM (db.leads) ---
class LeadRecord(BaseModel):
    id: str
    name: str
    company: Optional[str] = ""
    phone: str
    contact_person: Optional[str] = ""
    contact_position: Optional[str] = ""
    email: Optional[str] = ""
    website: Optional[str] = ""
    industry: Optional[str] = ""
    city: Optional[str] = "Минск"
    region: Optional[str] = "Минская область"
    stage: str = "new"
    notes: Optional[str] = ""
    directions: Optional[str] = ""
    assigned_to: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)
    updated_at: Optional[str] = None
    
    # Расширенные поля скоринга и воронки
    funnel: Optional[str] = ""             # "WB_OZON", "B2B_HOT", "B2B_WARM"
    heat_score: Optional[int] = 0          # 1 - 100
    niche: Optional[str] = ""              # "Селлер WB/Ozon", "Одежда/Текстиль", и т.д.
    pitch_script: Optional[str] = ""       # Персонализированный питч
    selection_reason: Optional[str] = ""   # Четкое обоснование отбора клиента
    source: Optional[str] = ""             # "rabota_by", "eaeu_registry", "tg_chat", "Обзвон_для_срм"
    unp: Optional[str] = ""                # УНП компании (РБ)

# --- Модель отсеянного лида (db.leads_archive) ---
class ArchiveLeadRecord(BaseModel):
    id: str
    name: Optional[str] = ""
    company: Optional[str] = ""
    phone: Optional[str] = ""
    city: Optional[str] = ""
    industry: Optional[str] = ""
    archive_reason: str
    created_at: str = Field(default_factory=now_iso)
    original_data: Optional[Dict[str, Any]] = None
