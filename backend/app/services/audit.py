from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog


def log_action(
    db: Session,
    *,
    admin_id: int | None,
    action: str,
    params: dict[str, Any] | None = None,
    commit: bool = False,
) -> AuditLog:
    """Сохраняет запись аудита."""

    log = AuditLog(admin_id=admin_id, action=action, params=params or {})
    db.add(log)
    db.flush()
    if commit:
        db.commit()
    return log
