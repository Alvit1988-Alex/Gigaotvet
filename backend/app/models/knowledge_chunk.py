from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import relationship

from app.core.db import Base


class KnowledgeChunk(Base):
    """Отдельный чанк текста из базы знаний."""

    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True)
    file_id = Column(Integer, ForeignKey("knowledge_files.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)

    file = relationship("KnowledgeFile", back_populates="chunks")
