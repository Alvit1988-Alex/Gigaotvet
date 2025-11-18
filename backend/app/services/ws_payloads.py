from __future__ import annotations

from app.models import Dialog, KnowledgeFile, Message
from app.schemas.knowledge_file import KnowledgeFileOut
from app.schemas.message import MessageOut


def message_created_payload(message: Message) -> dict:
    return {
        "event": "message.created",
        "dialog_id": message.dialog_id,
        "message": MessageOut.model_validate(message).model_dump(),
    }


def dialog_updated_payload(dialog: Dialog, *, event: str = "dialog.updated") -> dict:
    return {
        "event": event,
        "dialog_id": dialog.id,
        "status": dialog.status,
        "assigned_admin_id": dialog.assigned_admin_id,
        "unread_messages_count": dialog.unread_messages_count,
        "locked_by_admin_id": dialog.locked_by_admin_id,
        "is_locked": dialog.is_locked,
        "locked_until": dialog.locked_until.isoformat() if dialog.locked_until else None,
        "last_message_at": dialog.last_message_at.isoformat() if dialog.last_message_at else None,
    }


def knowledge_file_payload(knowledge_file: KnowledgeFile, *, event: str) -> dict:
    return {
        "event": event,
        "file": KnowledgeFileOut.model_validate(knowledge_file).model_dump(),
    }
