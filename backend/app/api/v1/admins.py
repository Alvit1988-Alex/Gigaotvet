from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Admin
from app.schemas.admin import AdminCreate, AdminOut, AdminUpdate
from app.services.audit import log_action
from app.services.security import get_current_superadmin

router = APIRouter(prefix="/admin", tags=["admins"])


@router.get("/admins", response_model=list[AdminOut])
def list_admins(db: Session = Depends(get_db), _current_admin: Admin = Depends(get_current_superadmin)):
    admins = db.query(Admin).order_by(Admin.id.asc()).all()
    return [AdminOut.model_validate(admin) for admin in admins]


@router.post("/admins", response_model=AdminOut, status_code=status.HTTP_201_CREATED)
def create_admin(
    payload: AdminCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_superadmin),
):
    if db.query(Admin).filter(Admin.telegram_id == payload.telegram_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Telegram ID already exists")

    admin = Admin(
        telegram_id=payload.telegram_id,
        full_name=payload.full_name,
        username=payload.username,
        email=payload.email,
        is_superadmin=payload.is_superadmin,
        is_active=payload.is_active,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    log_action(
        db,
        admin_id=current_admin.id,
        action="admin_created",
        params={"admin_id": admin.id},
        commit=True,
    )

    return AdminOut.model_validate(admin)


@router.patch("/admins/{admin_id}", response_model=AdminOut)
def update_admin(
    admin_id: int,
    payload: AdminUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_superadmin),
):
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(admin, field, value)

    db.commit()
    db.refresh(admin)

    log_action(
        db,
        admin_id=current_admin.id,
        action="admin_updated",
        params={"admin_id": admin.id},
        commit=True,
    )

    return AdminOut.model_validate(admin)
