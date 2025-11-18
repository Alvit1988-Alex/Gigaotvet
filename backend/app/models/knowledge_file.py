from __future__ import annotations

from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.core.db import Base


class KnowledgeFile(Base):
    """Файлы базы знаний для RAG."""

    __tablename__ = "knowledge_files"

    id = Column(Integer, primary_key=True)
    filename_original = Column(String(255), nullable=False)
    stored_path = Column(Text, nullable=False)
    mime_type = Column(String(128), nullable=True)
    size_bytes = Column(Integer, nullable=False)
    total_chunks = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chunks = relationship("KnowledgeChunk", back_populates="file", cascade="all, delete-orphan")
