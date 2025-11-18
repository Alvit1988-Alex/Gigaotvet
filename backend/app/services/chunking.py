from __future__ import annotations

import re

from app.core.config import settings

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def _split_paragraph(paragraph: str) -> list[str]:
    parts = [part.strip() for part in _SENTENCE_SPLIT_RE.split(paragraph) if part.strip()]
    return parts or [paragraph.strip()]


def split_into_chunks(
    text: str,
    *,
    min_size: int | None = None,
    max_size: int | None = None,
) -> list[str]:
    min_size = min_size or settings.RAG_MIN_CHUNK_SIZE
    max_size = max_size or settings.RAG_MAX_CHUNK_SIZE
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    chunks: list[str] = []
    buffer = ""

    def _flush() -> None:
        nonlocal buffer
        if buffer:
            chunks.append(buffer.strip())
            buffer = ""

    for paragraph in paragraphs:
        sentences = _split_paragraph(paragraph)
        for sentence in sentences:
            candidate = f"{buffer} {sentence}".strip() if buffer else sentence
            if len(candidate) <= max_size:
                buffer = candidate
            else:
                if buffer:
                    _flush()
                if len(sentence) <= max_size:
                    buffer = sentence
                else:
                    for idx in range(0, len(sentence), max_size):
                        part = sentence[idx : idx + max_size]
                        if part.strip():
                            chunks.append(part.strip())
                    buffer = ""
            if buffer and len(buffer) >= min_size:
                _flush()

    if buffer:
        chunks.append(buffer.strip())

    cleaned = [chunk for chunk in chunks if chunk]
    if len(cleaned) > 1 and len(cleaned[-1]) < min_size:
        cleaned[-2] = f"{cleaned[-2]} {cleaned[-1]}".strip()
        cleaned.pop()
    return cleaned
