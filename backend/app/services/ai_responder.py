from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import AIInstructions, Dialog, Message, MessageRole
from app.services.gigachat import GigaChatError, chat_with_context, get_client
from app.services.rag_service import ChunkMatch, RAGService

logger = logging.getLogger(__name__)

FALLBACK_TEXT = "Для ответа на ваш вопрос мне нужно посоветоваться с коллегами, после этого вернусь к вам с решением."


@dataclass
class AiReplyResult:
    text: str
    is_fallback: bool
    used_rag: bool
    matches: list[ChunkMatch]
    max_score: float


def _get_active_instructions(db: Session) -> str:
    instructions = (
        db.query(AIInstructions)
        .filter(AIInstructions.is_active.is_(True))
        .order_by(AIInstructions.updated_at.desc())
        .first()
    )
    if instructions:
        return instructions.text
    return "Ты — помощник службы поддержки. Отвечай вежливо и по делу."


def _load_history(db: Session, dialog: Dialog) -> list[Message]:
    history = (
        db.query(Message)
        .filter(Message.dialog_id == dialog.id)
        .order_by(Message.created_at.desc())
        .limit(settings.RAG_HISTORY_MESSAGE_LIMIT)
        .all()
    )
    return list(reversed(history))


def _build_context_block(matches: list[ChunkMatch]) -> str:
    blocks = []
    for match in matches:
        blocks.append(match.chunk.text)
    return "\n---\n".join(blocks)


def _build_messages(instructions: str, matches: list[ChunkMatch], history: list[Message], user_text: str) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": instructions,
        }
    ]
    if matches:
        context = _build_context_block(matches)
        messages.append(
            {
                "role": "system",
                "content": (
                    "Контекст из базы знаний. Отвечай только если информация есть в блоках ниже.\n"
                    f"{context}"
                ),
            }
        )
    for message in history:
        role = "user" if message.role == MessageRole.USER else "assistant"
        messages.append({"role": role, "content": message.content})
    messages.append({"role": "user", "content": user_text})
    return messages


def _has_sufficient_context(matches: list[ChunkMatch]) -> bool:
    if not matches:
        return False
    max_score = matches[0].score
    long_enough = any(len(match.chunk.text) > 50 for match in matches)
    return max_score >= settings.RAG_MIN_RELEVANCE and long_enough


async def _call_model(messages: list[dict[str, str]], matches: list[ChunkMatch]) -> str:
    client = get_client()
    if client.is_configured:
        try:
            return await chat_with_context(messages)
        except GigaChatError as exc:  # pragma: no cover - network errors
            logger.warning("GigaChat chat failed: %s", exc)
    # Локальный запасной ответ — берём первый релевантный чанк
    if matches:
        snippet = matches[0].chunk.text.strip()
        return f"Согласно внутренней базе знаний:\n{snippet}"
    return ""


async def generate_ai_reply(
    db: Session,
    *,
    dialog: Dialog,
    user_text: str,
    precomputed_matches: list[ChunkMatch] | None = None,
) -> AiReplyResult:
    rag_service = RAGService(db)
    matches = precomputed_matches or await rag_service.get_relevant_chunks(user_text)
    instructions = _get_active_instructions(db)
    history = _load_history(db, dialog)

    max_score = matches[0].score if matches else 0.0
    if not _has_sufficient_context(matches):
        return AiReplyResult(text=FALLBACK_TEXT, is_fallback=True, used_rag=bool(matches), matches=matches, max_score=max_score)

    prompt_messages = _build_messages(instructions, matches, history, user_text)
    response_text = await _call_model(prompt_messages, matches)
    if not response_text:
        return AiReplyResult(text=FALLBACK_TEXT, is_fallback=True, used_rag=bool(matches), matches=matches, max_score=max_score)
    return AiReplyResult(text=response_text, is_fallback=False, used_rag=True, matches=matches, max_score=max_score)
