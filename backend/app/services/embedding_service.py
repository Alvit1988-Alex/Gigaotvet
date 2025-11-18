from __future__ import annotations

import hashlib
import logging
import math
from typing import Iterable

from app.services import gigachat
from app.services.gigachat import GigaChatError

logger = logging.getLogger(__name__)


def _local_embedding(text: str, dimensions: int = 64) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    values = [digest[i % len(digest)] for i in range(dimensions)]
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [float(v) / norm for v in values]


async def get_text_embedding(text: str) -> list[float]:
    client = gigachat.get_client()
    if client.is_configured:
        try:
            return await gigachat.get_embedding(text)
        except GigaChatError as exc:  # pragma: no cover - network errors mocked in tests
            logger.warning("Falling back to local embedding: %s", exc)
    return _local_embedding(text)


def cosine_similarity(vec_a: Iterable[float], vec_b: Iterable[float]) -> float:
    a = list(vec_a)
    b = list(vec_b)
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if not norm_a or not norm_b:
        return 0.0
    return float(dot / (norm_a * norm_b))
