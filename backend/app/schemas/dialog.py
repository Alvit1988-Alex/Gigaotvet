from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.models.dialog import DialogStatus
from app.schemas.admin import AdminOut
from app.schemas.message import MessageOut


class DialogShort(BaseModel):
    id: int
    telegram_user_id: int
    status: DialogStatus
    last_message_at: datetime | None = None
    unread_messages_count: int
    is_locked: bool
    locked_until: datetime | None = None
    assigned_admin: AdminOut | None = None
    waiting_time_seconds: int | None = None

    class Config:
        from_attributes = True


class DialogDetail(DialogShort):
    messages: list[MessageOut]
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DialogListResponse(BaseModel):
    items: list[DialogShort]
    total: int
    page: int
    per_page: int
    has_next: bool  # <-- исправлено, теперь здесь есть поле has_next


class DialogAssignRequest(BaseModel):
    admin_id: int | None = None


class DialogSwitchAutoResponse(BaseModel):
    dialog_id: int
    status: DialogStatus
