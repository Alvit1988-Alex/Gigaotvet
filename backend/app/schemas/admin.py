from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr


class AdminBase(BaseModel):
    full_name: str
    username: str | None = None
    email: EmailStr | None = None


class AdminCreate(AdminBase):
    telegram_id: int
    is_superadmin: bool = False
    is_active: bool = True


class AdminUpdate(BaseModel):
    full_name: str | None = None
    username: str | None = None
    email: EmailStr | None = None
    is_active: bool | None = None
    is_superadmin: bool | None = None


class AdminOut(AdminBase):
    id: int
    telegram_id: int
    is_superadmin: bool
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
