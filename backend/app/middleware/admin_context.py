from __future__ import annotations

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.db import SessionLocal
from app.models import Admin
from app.services.security import decode_token, extract_token_from_request


class AdminContextMiddleware(BaseHTTPMiddleware):
    """Извлекает текущего администратора из JWT и сохраняет в request.state."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request.state.admin = None
        token = extract_token_from_request(request)
        if token:
            try:
                payload = decode_token(token)
                if payload.get("type") == "access" and payload.get("sub"):
                    admin_id = int(payload["sub"])
                    db = SessionLocal()
                    try:
                        admin = db.query(Admin).filter(Admin.id == admin_id).first()
                        if admin and admin.is_active:
                            request.state.admin = admin
                    finally:
                        db.close()
            except HTTPException:
                pass
            except Exception:
                pass
        response = await call_next(request)
        return response
