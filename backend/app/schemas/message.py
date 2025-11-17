from __future__ import annotations

from datetime import datetime

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
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class MessageSendRequest(BaseModel):
    dialog_id: int
    content: str = Field(..., min_length=1)
