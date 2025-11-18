from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, func, Boolean
from sqlalchemy.orm import relationship
import enum

from app.core.db import Base


class MessageRole(str, enum.Enum):
    USER = "user"
    AI = "ai"
    ADMIN = "admin"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    dialog_id = Column(Integer, ForeignKey("dialogs.id", ondelete="CASCADE"), nullable=False)

    role = Column(Enum(MessageRole), nullable=False)
    sender_id = Column(String(64), nullable=True)  # telegram_id или admin_id, по ситуации
    sender_name = Column(String(255), nullable=True)

    content = Column(Text, nullable=False)
    attachments = Column(Text, nullable=True)
    message_type = Column(String(32), default="text", nullable=False)
    metadata_json = Column("metadata", JSON, nullable=True)
    is_fallback = Column(Boolean, default=False, nullable=False)
    used_rag = Column(Boolean, default=False, nullable=False)
    ai_reply_during_operator_wait = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    dialog = relationship("Dialog", back_populates="messages")
