from sqlalchemy import Boolean, BigInteger, Column, Integer, String
from sqlalchemy.orm import relationship

from app.core.db import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    username = Column(String(64), nullable=True, index=True)

    is_superadmin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    dialogs = relationship("Dialog", back_populates="assigned_admin")
