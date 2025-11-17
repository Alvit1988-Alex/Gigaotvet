from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text, func
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

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    dialog = relationship("Dialog", back_populates="messages")
