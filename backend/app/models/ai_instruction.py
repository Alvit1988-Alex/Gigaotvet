from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Integer, Text, func

from app.core.db import Base


class AIInstructions(Base):
    """Хранение активных инструкций для ИИ."""

    __tablename__ = "ai_instructions"

    id = Column(Integer, primary_key=True)
    text = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
