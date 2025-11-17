from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import relationship

from app.core.db import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    action = Column(String(128), nullable=False)
    params = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    admin = relationship("Admin", back_populates="audit_logs")
