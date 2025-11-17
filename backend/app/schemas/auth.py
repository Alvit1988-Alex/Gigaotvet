from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.admin import AdminOut


class PendingLoginInitResponse(BaseModel):
    token: str
    login_url: str | None = None
    expires_at: datetime


class PendingLoginStatusResponse(BaseModel):
    status: str
    admin: AdminOut | None = None
    confirmed_at: datetime | None = None


class TelegramCallbackPayload(BaseModel):
    token: str = Field(..., min_length=8)
    telegram_id: int
    full_name: str
    username: str | None = None


class AuthLoginRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LogoutResponse(BaseModel):
    success: bool


class AuthMeResponse(BaseModel):
    admin: AdminOut
