from __future__ import annotations

from dataclasses import dataclass
from typing import List

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import KnowledgeChunk
from app.services.embedding_service import cosine_similarity, get_text_embedding


@dataclass
class ChunkMatch:
    chunk: KnowledgeChunk
    score: float


class RAGService:
    def __init__(self, db: Session) -> None:
        self.db = db

    async def get_relevant_chunks(
        self,
        query: str,
        *,
        limit: int = 5,
        min_relevance: float | None = None,
    ) -> list[ChunkMatch]:
        if not query.strip():
            return []
        vector = await get_text_embedding(query)
        chunks = (
            self.db.query(KnowledgeChunk)
            .filter(KnowledgeChunk.embedding.isnot(None))
            .order_by(KnowledgeChunk.chunk_index.asc())
            .all()
        )
        matches: list[ChunkMatch] = []
        for chunk in chunks:
            embedding = chunk.embedding or []
            score = cosine_similarity(embedding, vector)
            matches.append(ChunkMatch(chunk=chunk, score=score))
        matches.sort(key=lambda match: match.score, reverse=True)
        min_score = min_relevance if min_relevance is not None else settings.RAG_MIN_RELEVANCE
        filtered = [match for match in matches if match.score >= min_score]
        return filtered[:limit]
