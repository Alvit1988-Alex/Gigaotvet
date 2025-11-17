import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import relationship

from app.core.db import Base


class DialogStatus(str, enum.Enum):
    AUTO = "auto"  # Ведётся автоматически
    WAIT_OPERATOR = "wait_operator"  # Ожидает ответа оператора
    WAIT_USER = "wait_user"  # Ожидает ответа пользователя


class Dialog(Base):
    __tablename__ = "dialogs"

    id = Column(Integer, primary_key=True, index=True)
    telegram_user_id = Column(Integer, index=True, nullable=False)

    status = Column(Enum(DialogStatus), default=DialogStatus.AUTO, nullable=False)

    # Ответственный админ (если есть)
    assigned_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    assigned_admin = relationship(
        "Admin",
        back_populates="dialogs",
        foreign_keys=[assigned_admin_id],
    )

    last_message_at = Column(DateTime(timezone=True), server_default=func.now())
    is_locked = Column(Boolean, default=False)
    locked_by_admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    locked_by_admin = relationship(
        "Admin",
        foreign_keys=[locked_by_admin_id],
        viewonly=True,
    )
    locked_until = Column(DateTime(timezone=True), nullable=True)
    unread_messages_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    messages = relationship("Message", back_populates="dialog", cascade="all, delete-orphan")
