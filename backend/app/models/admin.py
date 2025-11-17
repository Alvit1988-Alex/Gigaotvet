from sqlalchemy import Boolean, BigInteger, Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship

from app.core.db import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    username = Column(String(64), nullable=True, index=True)
    email = Column(String(255), nullable=True, unique=True)

    is_superadmin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    dialogs = relationship(
        "Dialog",
        back_populates="assigned_admin",
        foreign_keys="Dialog.assigned_admin_id",
    )
    locked_dialogs = relationship(
        "Dialog",
        foreign_keys="Dialog.locked_by_admin_id",
        viewonly=True,
    )
    audit_logs = relationship("AuditLog", back_populates="admin")
