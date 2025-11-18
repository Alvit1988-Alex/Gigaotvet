from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.bot.utils import send_telegram_message
from app.core.db import get_db
from app.core.ws_manager import WebSocketManager, get_ws_manager
from app.models import Admin, Dialog, DialogStatus, Message, MessageRole
from app.schemas.message import MessageOut, MessageSendRequest
from app.services.audit import log_action
from app.services.security import get_current_admin
from app.services.ws_payloads import dialog_updated_payload, message_created_payload

router = APIRouter(prefix="/messages", tags=["messages"])


def _ensure_dialog(db: Session, dialog_id: int) -> Dialog:
    dialog = db.query(Dialog).filter(Dialog.id == dialog_id).first()
    if not dialog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")
    return dialog


@router.post("/send", response_model=MessageOut)
async def send_message(
    payload: MessageSendRequest,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    dialog = _ensure_dialog(db, payload.dialog_id)

    now = datetime.now(timezone.utc)
    if dialog.is_locked and dialog.locked_by_admin_id not in {None, current_admin.id}:
        if dialog.locked_until and dialog.locked_until > now:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Dialog locked by another admin")

    if dialog.assigned_admin_id not in {None, current_admin.id} and not current_admin.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dialog assigned to another admin")

    dialog.assigned_admin_id = current_admin.id
    dialog.is_locked = True
    dialog.locked_by_admin_id = current_admin.id
    dialog.locked_until = now + timedelta(minutes=5)

    message = Message(
        dialog_id=dialog.id,
        role=MessageRole.ADMIN,
        sender_id=str(current_admin.id),
        sender_name=current_admin.full_name,
        content=payload.content,
    )
    db.add(message)

    dialog.status = DialogStatus.WAIT_USER
    dialog.last_message_at = now
    dialog.unread_messages_count = 0

    db.commit()
    db.refresh(message)
    db.refresh(dialog)

    log_action(
        db,
        admin_id=current_admin.id,
        action="admin_message_sent",
        params={"dialog_id": dialog.id, "message_id": message.id},
    )
    log_action(
        db,
        admin_id=current_admin.id,
        action="dialog_status_changed",
        params={"dialog_id": dialog.id, "status": dialog.status},
        commit=True,
    )

    if dialog.telegram_user_id:
        try:
            await send_telegram_message(dialog.telegram_user_id, payload.content)
        except Exception:
            # Не прерываем ответ оператору, если Telegram временно недоступен
            pass

    await ws_manager.broadcast("messages", message_created_payload(message))
    await ws_manager.broadcast("dialogs", dialog_updated_payload(dialog))

    return MessageOut.model_validate(message)
