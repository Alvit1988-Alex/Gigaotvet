from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.models import Admin, PendingLogin
from app.schemas.admin import AdminOut
from app.schemas.auth import (
    AuthLoginRequest,
    AuthMeResponse,
    LogoutResponse,
    PendingLoginInitResponse,
    PendingLoginStatusResponse,
    TelegramCallbackPayload,
    TokenResponse,
)
from app.services.audit import log_action
from app.services.security import (
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_admin,
)

router = APIRouter(prefix="/auth", tags=["auth"])

PENDING_LOGIN_TTL = timedelta(minutes=10)


def _build_login_url(token: str) -> str | None:
    if settings.TELEGRAM_BOT_USERNAME:
        return f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start=login_{token}"
    return None


def _set_jwt_cookies(response: Response, access: str, refresh: str) -> None:
    secure = settings.APP_ENV == "prod"
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )


def _clear_jwt_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE_NAME)
    response.delete_cookie(REFRESH_COOKIE_NAME)


@router.post("/init", response_model=PendingLoginInitResponse)
def init_pending_login(request: Request, db: Session = Depends(get_db)):
    token = secrets.token_urlsafe(32)
    pending = PendingLogin(
        token=token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(pending)
    db.commit()
    db.refresh(pending)

    log_action(
        db,
        admin_id=None,
        action="pending_login_created",
        params={"token": token, "ip": pending.ip_address},
    )
    db.commit()

    expires_at = pending.created_at + PENDING_LOGIN_TTL
    return PendingLoginInitResponse(token=token, login_url=_build_login_url(token), expires_at=expires_at)


def _get_pending_login(db: Session, token: str) -> PendingLogin:
    pending = db.query(PendingLogin).filter(PendingLogin.token == token).first()
    if not pending:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")
    return pending


def _ensure_not_expired(pending: PendingLogin) -> None:
    created = pending.created_at or datetime.now(timezone.utc)
    if created + PENDING_LOGIN_TTL < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token expired")


@router.get("/status", response_model=PendingLoginStatusResponse)
def pending_login_status(token: str, db: Session = Depends(get_db)):
    pending = _get_pending_login(db, token)
    try:
        _ensure_not_expired(pending)
    except HTTPException:
        return PendingLoginStatusResponse(status="expired", admin=None, confirmed_at=pending.confirmed_at)

    admin: Admin | None = None
    if pending.is_confirmed and pending.telegram_id:
        admin = (
            db.query(Admin)
            .filter(Admin.telegram_id == int(pending.telegram_id))
            .first()
        )

    return PendingLoginStatusResponse(
        status="confirmed" if pending.is_confirmed else "pending",
        admin=AdminOut.model_validate(admin) if admin else None,
        confirmed_at=pending.confirmed_at,
    )


@router.post("/telegram_callback")
def telegram_callback(
    payload: TelegramCallbackPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if settings.TELEGRAM_WEBHOOK_SECRET and secret != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")

    pending = _get_pending_login(db, payload.token)
    _ensure_not_expired(pending)

    admin = db.query(Admin).filter(Admin.telegram_id == payload.telegram_id).first()
    if not admin:
        admin = Admin(
            telegram_id=payload.telegram_id,
            full_name=payload.full_name,
            username=payload.username,
            is_active=True,
        )
        db.add(admin)
    else:
        admin.full_name = payload.full_name
        admin.username = payload.username

    pending.telegram_id = str(payload.telegram_id)
    pending.is_confirmed = True
    pending.confirmed_at = datetime.now(timezone.utc)

    db.commit()

    log_action(
        db,
        admin_id=admin.id,
        action="pending_login_confirmed",
        params={"token": pending.token},
        commit=True,
    )

    return {"status": "ok"}


@router.post("/login", response_model=TokenResponse)
def login_with_token(
    payload: AuthLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    pending = _get_pending_login(db, payload.token)
    _ensure_not_expired(pending)
    if not pending.is_confirmed or not pending.telegram_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pending login not confirmed")

    admin = db.query(Admin).filter(Admin.telegram_id == int(pending.telegram_id)).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin disabled")

    access = create_access_token(admin.id)
    refresh = create_refresh_token(admin.id)
    _set_jwt_cookies(response, access, refresh)

    log_action(db, admin_id=admin.id, action="admin_login", params={"token": payload.token}, commit=True)

    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    admin = db.query(Admin).filter(Admin.id == int(payload.get("sub"))).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")

    access = create_access_token(admin.id)
    refresh = create_refresh_token(admin.id)
    _set_jwt_cookies(response, access, refresh)

    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/logout", response_model=LogoutResponse)
def logout_admin(
    response: Response,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _clear_jwt_cookies(response)
    log_action(db, admin_id=current_admin.id, action="admin_logout", commit=True)
    return LogoutResponse(success=True)


@router.get("/me", response_model=AuthMeResponse)
def get_me(current_admin: Admin = Depends(get_current_admin)):
    return AuthMeResponse(admin=AdminOut.model_validate(current_admin))
