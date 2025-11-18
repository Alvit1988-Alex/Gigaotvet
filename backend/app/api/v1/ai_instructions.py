from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import AIInstructions, Admin
from app.schemas.ai_instructions import AIInstructionsIn, AIInstructionsOut
from app.services.audit import log_action
from app.services.security import get_current_superadmin

router = APIRouter(prefix="/ai-instructions", tags=["ai"])


def _get_active(db: Session) -> AIInstructions | None:
    return (
        db.query(AIInstructions)
        .filter(AIInstructions.is_active.is_(True))
        .order_by(AIInstructions.updated_at.desc())
        .first()
    )


@router.get("/current", response_model=AIInstructionsOut)
def get_current_instructions(
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_superadmin),
) -> AIInstructionsOut:
    instructions = _get_active(db)
    if not instructions:
        return AIInstructionsOut(text="")
    return AIInstructionsOut.model_validate(instructions)


@router.put("", response_model=AIInstructionsOut)
def update_instructions(
    payload: AIInstructionsIn,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_superadmin),
) -> AIInstructionsOut:
    db.query(AIInstructions).update({AIInstructions.is_active: False})
    new_record = AIInstructions(text=payload.text, is_active=True)
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    log_action(
        db,
        admin_id=current_admin.id,
        action="update_ai_instructions",
        params={"instruction_id": new_record.id},
        commit=True,
    )

    return AIInstructionsOut.model_validate(new_record)
