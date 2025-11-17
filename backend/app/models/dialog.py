import enum
from sqlalchemy import Column, Enum, ForeignKey, Integer, String, DateTime, func
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
    assigned_admin = relationship("Admin", back_populates="dialogs")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    messages = relationship("Message", back_populates="dialog", cascade="all, delete-orphan")
