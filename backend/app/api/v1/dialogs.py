from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.db import get_db
from app.models import Admin, Dialog, DialogStatus, Message
from app.schemas.dialog import (
    DialogAssignRequest,
    DialogDetail,
    DialogListResponse,
    DialogShort,
    DialogSwitchAutoResponse,
)
from app.schemas.message import MessageOut
from app.services.audit import log_action
from app.services.security import get_current_admin

LOCK_TIMEOUT = timedelta(minutes=5)

router = APIRouter(prefix="/dialogs", tags=["dialogs"])


def _release_lock_if_expired(db: Session, dialog: Dialog) -> None:
    """Если время блокировки истекло — снять блокировку."""
    now = datetime.now(timezone.utc)
    if dialog.is_locked and dialog.locked_until and dialog.locked_until < now:
        dialog.is_locked = False
        dialog.locked_by_admin_id = None
        dialog.locked_until = None
        log_action(
            db,
            admin_id=None,
            action="dialog_unlocked",
            params={"dialog_id": dialog.id},
        )
        db.commit()


def _calc_waiting_time(dialog: Dialog) -> int | None:
    """Время ожидания в секундах с момента последнего сообщения."""
    if not dialog.last_message_at:
        return None
    delta = datetime.now(timezone.utc) - dialog.last_message_at
    return max(int(delta.total_seconds()), 0)


def _dialog_to_short(dialog: Dialog) -> DialogShort:
    """Преобразование ORM-диалога в короткую схему списка."""
    return DialogShort.model_validate(
        dialog,
        update={"waiting_time_seconds": _calc_waiting_time(dialog)},
    )


def _dialog_to_detail(dialog: Dialog) -> DialogDetail:
    """Преобразование ORM-диалога в детальную схему с сообщениями."""
    messages = [MessageOut.model_validate(m) for m in sorted(dialog.messages, key=lambda m: m.created_at)]
    return DialogDetail.model_validate(
        dialog,
        update={
            "messages": messages,
            "waiting_time_seconds": _calc_waiting_time(dialog),
        },
    )


def _get_dialog(db: Session, dialog_id: int) -> Dialog:
    """Получить диалог или 404, заодно проверить блокировку на протухание."""
    dialog = (
        db.query(Dialog)
        .options(joinedload(Dialog.messages), joinedload(Dialog.assigned_admin))
        .filter(Dialog.id == dialog_id)
        .first()
    )
    if not dialog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")
    _release_lock_if_expired(db, dialog)
    return dialog


@router.get("", response_model=DialogListResponse)
def list_dialogs(
    *,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: DialogStatus | None = Query(default=None),
    assigned_admin_id: int | None = Query(default=None),
    search: str | None = Query(default=None, min_length=1),
) -> DialogListResponse:
    """
    Список диалогов с фильтрами и пагинацией.

    Формат ответа по ТЗ:
    {
        "items": [...],
        "page": <номер_страницы>,
        "per_page": <количество_на_странице>,
        "total": <всего_диалогов>,
        "has_next": <true|false>
    }
    """
    query = db.query(Dialog).options(joinedload(Dialog.assigned_admin))

    if status:
        query = query.filter(Dialog.status == status)
    if assigned_admin_id:
        query = query.filter(Dialog.assigned_admin_id == assigned_admin_id)
    if search:
        subq = select(Message.dialog_id).where(Message.content.ilike(f"%{search}%"))
        query = query.filter(Dialog.id.in_(subq))

    total = query.count()

    dialogs = (
        query.order_by(Dialog.last_message_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = [_dialog_to_short(dialog) for dialog in dialogs]
    has_next = page * per_page < total

    return DialogListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_next=has_next,
    )


@router.get("/{dialog_id}", response_model=DialogDetail)
def get_dialog(
    dialog_id: int,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
) -> DialogDetail:
    """Получить один диалог с сообщениями."""
    dialog = _get_dialog(db, dialog_id)
    return _dialog_to_detail(dialog)


@router.post("/{dialog_id}/assign", response_model=DialogDetail)
def assign_dialog(
    dialog_id: int,
    payload: DialogAssignRequest,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
) -> DialogDetail:
    """
    Назначить диалог на администратора.

    Правила:
    - если диалог залочен другим админом и блокировка ещё актуальна — 409;
    - переназначать на другого админа может только суперадмин.
    """
    dialog = _get_dialog(db, dialog_id)

    now = datetime.now(timezone.utc)
    if dialog.is_locked and dialog.locked_by_admin_id not in {None, current_admin.id}:
        if dialog.locked_until and dialog.locked_until > now:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Dialog locked by another admin",
            )

    target_admin_id = payload.admin_id or current_admin.id
    if payload.admin_id and payload.admin_id != current_admin.id:
        if not current_admin.is_superadmin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only superadmin can reassign",
            )
        target_admin = db.query(Admin).filter(Admin.id == payload.admin_id).first()
        if not target_admin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Admin not found",
            )
    else:
        target_admin = current_admin

    dialog.assigned_admin_id = target_admin.id
    dialog.is_locked = True
    dialog.locked_by_admin_id = target_admin.id
    dialog.locked_until = now + LOCK_TIMEOUT

    db.commit()
    log_action(
        db,
        admin_id=current_admin.id,
        action="dialog_assigned",
        params={"dialog_id": dialog.id, "assigned_admin_id": target_admin.id},
        commit=True,
    )
    db.refresh(dialog)
    return _dialog_to_detail(dialog)


@router.post("/{dialog_id}/switch_auto", response_model=DialogSwitchAutoResponse)
def switch_to_auto(
    dialog_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
) -> DialogSwitchAutoResponse:
    """
    Перевести диалог в автоматический режим.

    Сбрасывает назначенного администратора и блокировку.
    """
    dialog = _get_dialog(db, dialog_id)

    dialog.status = DialogStatus.AUTO
    dialog.assigned_admin_id = None
    dialog.is_locked = False
    dialog.locked_by_admin_id = None
    dialog.locked_until = None

    db.commit()
    log_action(
        db,
        admin_id=current_admin.id,
        action="dialog_switched_auto",
        params={"dialog_id": dialog.id},
    )
    log_action(
        db,
        admin_id=current_admin.id,
        action="dialog_unlocked",
        params={"dialog_id": dialog.id},
    )
    log_action(
        db,
        admin_id=current_admin.id,
        action="dialog_status_changed",
        params={"dialog_id": dialog.id, "status": dialog.status},
        commit=True,
    )

    return DialogSwitchAutoResponse(dialog_id=dialog.id, status=dialog.status)
