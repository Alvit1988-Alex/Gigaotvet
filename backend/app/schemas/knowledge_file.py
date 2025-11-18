from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class KnowledgeFileOut(BaseModel):
    id: int
    filename_original: str
    size_bytes: int
    total_chunks: int
    created_at: datetime

    class Config:
        from_attributes = True
