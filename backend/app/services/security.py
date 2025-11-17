from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.models import Admin

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"


def _create_token(*, data: dict, expires_delta: timedelta, token_type: str) -> str:
    now = datetime.now(timezone.utc)
    to_encode = data.copy()
    to_encode.update({"exp": now + expires_delta, "iat": now, "type": token_type})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(admin_id: int) -> str:
    return _create_token(
        data={"sub": str(admin_id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(admin_id: int) -> str:
    return _create_token(
        data={"sub": str(admin_id)},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def extract_token_from_request(request: Request, *, cookie_name: str | None = ACCESS_COOKIE_NAME) -> str | None:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1]
    if cookie_name:
        return request.cookies.get(cookie_name)
    return None


def get_current_admin(
    request: Request,
    db: Session = Depends(get_db),
    *,
    require_active: bool = True,
) -> Admin:
    if hasattr(request.state, "admin") and request.state.admin is not None:
        admin = request.state.admin
        if require_active and not admin.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin disabled")
        return admin

    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    admin_id = payload.get("sub")
    admin = db.query(Admin).filter(Admin.id == int(admin_id)).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")
    if require_active and not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin disabled")
    request.state.admin = admin
    return admin


def get_current_superadmin(request: Request, db: Session = Depends(get_db)) -> Admin:
    admin = get_current_admin(request, db)
    if not admin.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin privileges required")
    return admin
