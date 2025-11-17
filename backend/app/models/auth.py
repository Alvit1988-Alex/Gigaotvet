from sqlalchemy import Column, DateTime, Integer, String, Boolean, func

from app.core.db import Base


class PendingLogin(Base):
    """pending_login для авторизации через Telegram (QR / start=login_token)."""

    __tablename__ = "pending_logins"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(128), unique=True, nullable=False, index=True)
    telegram_id = Column(String(64), nullable=True)

    is_confirmed = Column(Boolean, default=False)

    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
