from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.bot.utils import send_telegram_message
from app.models import Dialog, DialogStatus, Message, MessageRole
from app.services.audit import log_action

OPERATOR_KEYWORDS = [
    "оператор",
    "поддержка",
    "support",
    "живой человек",
]


def _release_lock_if_needed(db: Session, dialog: Dialog) -> None:
    now = datetime.now(timezone.utc)
    if dialog.is_locked and dialog.locked_until and dialog.locked_until < now:
        dialog.is_locked = False
        dialog.locked_by_admin_id = None
        dialog.locked_until = None
        log_action(
            db,
            admin_id=None,
            action="dialog_unlocked",
            params={"dialog_id": dialog.id},
        )


def _find_or_create_dialog(db: Session, telegram_user_id: int) -> Dialog:
    dialog = (
        db.query(Dialog)
        .filter(Dialog.telegram_user_id == telegram_user_id)
        .order_by(Dialog.id.desc())
        .first()
    )
    if dialog:
        _release_lock_if_needed(db, dialog)
        return dialog

    dialog = Dialog(telegram_user_id=telegram_user_id, status=DialogStatus.AUTO)
    db.add(dialog)
    db.flush()
    return dialog


def _needs_operator(text: str) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in OPERATOR_KEYWORDS)


async def handle_update(update: dict, db: Session) -> None:
    message = update.get("message")
    if not message or "text" not in message:
        return

    chat = message.get("chat") or {}
    from_user = message.get("from") or {}
    telegram_user_id = chat.get("id")
    if telegram_user_id is None:
        return

    dialog = _find_or_create_dialog(db, telegram_user_id)
    now = datetime.now(timezone.utc)

    content = message.get("text", "")
    previous_status = dialog.status
    db_message = Message(
        dialog_id=dialog.id,
        role=MessageRole.USER,
        sender_id=str(telegram_user_id),
        sender_name=from_user.get("username") or from_user.get("first_name"),
        content=content,
    )
    db.add(db_message)

    dialog.last_message_at = now
    dialog.unread_messages_count = (dialog.unread_messages_count or 0) + 1

    if _needs_operator(content):
        dialog.status = DialogStatus.WAIT_OPERATOR
    elif dialog.status == DialogStatus.WAIT_USER:
        dialog.status = DialogStatus.AUTO

    if dialog.status != previous_status:
        log_action(
            db,
            admin_id=None,
            action="dialog_status_changed",
            params={"dialog_id": dialog.id, "status": dialog.status},
        )

    db.commit()

    try:
        await send_telegram_message(telegram_user_id, "Автоответ: спасибо за сообщение")
    except Exception:
        pass
