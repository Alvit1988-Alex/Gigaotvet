from __future__ import annotations

from datetime import datetime

from typing import Any

from pydantic import BaseModel, Field

from app.models.message import MessageRole


class MessageOut(BaseModel):
    id: int
    dialog_id: int
    role: MessageRole
    sender_id: str | None = None
    sender_name: str | None = None
    content: str
    attachments: str | None = None
    message_type: str
    metadata: dict[str, Any] | None = Field(default=None, alias="metadata_json")
    is_fallback: bool = False
    used_rag: bool = False
    ai_reply_during_operator_wait: bool = False
    created_at: datetime | None = None

    class Config:
        from_attributes = True
        populate_by_name = True


class MessageSendRequest(BaseModel):
    dialog_id: int
    content: str = Field(..., min_length=1)
