from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.bot.utils import send_telegram_message
from app.core.config import settings
from app.core.ws_manager import get_ws_manager
from app.models import Dialog, DialogStatus, Message, MessageRole
from app.services.ai_responder import AiReplyResult, FALLBACK_TEXT, generate_ai_reply
from app.services.audit import log_action
from app.services.rag_service import RAGService
from app.services.ws_payloads import dialog_updated_payload, message_created_payload

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
    ws_manager = get_ws_manager()

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
    db.flush()

    dialog.last_message_at = now
    dialog.unread_messages_count = (dialog.unread_messages_count or 0) + 1

    ai_result: AiReplyResult | None = None
    ai_during_wait = False

    if _needs_operator(content):
        dialog.status = DialogStatus.WAIT_OPERATOR
        ai_result = AiReplyResult(
            text=FALLBACK_TEXT,
            is_fallback=True,
            used_rag=False,
            matches=[],
            max_score=0.0,
        )
    else:
        if dialog.status == DialogStatus.WAIT_OPERATOR:
            rag_service = RAGService(db)
            precomputed = await rag_service.get_relevant_chunks(content)
            max_score = precomputed[0].score if precomputed else 0.0
            if max_score >= settings.RAG_OPERATOR_HIGH_CONFIDENCE:
                ai_result = await generate_ai_reply(
                    db,
                    dialog=dialog,
                    user_text=content,
                    precomputed_matches=precomputed,
                )
                ai_during_wait = not ai_result.is_fallback
        else:
            ai_result = await generate_ai_reply(db, dialog=dialog, user_text=content)

    events: list[tuple[str, dict]] = [("messages", message_created_payload(db_message))]

    if ai_result:
        metadata = None
        if ai_result.matches:
            metadata = {
                "chunk_ids": [match.chunk.id for match in ai_result.matches],
                "relevance": [match.score for match in ai_result.matches],
            }
        ai_message = Message(
            dialog_id=dialog.id,
            role=MessageRole.AI,
            sender_name="AI",
            content=ai_result.text,
            metadata_json=metadata,
            is_fallback=ai_result.is_fallback,
            used_rag=ai_result.used_rag,
            ai_reply_during_operator_wait=ai_during_wait,
        )
        db.add(ai_message)
        dialog.last_message_at = now

        if ai_result.is_fallback:
            dialog.status = DialogStatus.WAIT_OPERATOR
        else:
            if previous_status == DialogStatus.WAIT_OPERATOR:
                dialog.status = DialogStatus.WAIT_OPERATOR
            else:
                dialog.status = DialogStatus.AUTO
                dialog.unread_messages_count = 0

        db.flush()
        events.append(("messages", message_created_payload(ai_message)))

        log_action(
            db,
            admin_id=None,
            action="ai_message_sent",
            params={
                "dialog_id": dialog.id,
                "message_id": ai_message.id,
                "is_fallback": ai_result.is_fallback,
            },
        )

        try:
            await send_telegram_message(telegram_user_id, ai_result.text)
        except Exception:
            pass

    if dialog.status != previous_status:
        log_action(
            db,
            admin_id=None,
            action="dialog_status_changed",
            params={"dialog_id": dialog.id, "status": dialog.status},
        )

    db.commit()

    for channel, payload in events:
        await ws_manager.broadcast(channel, payload)
    await ws_manager.broadcast("dialogs", dialog_updated_payload(dialog))
