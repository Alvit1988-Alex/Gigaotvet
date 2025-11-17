from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.bot.handlers import handle_update
from app.bot.utils import verify_telegram_request
from app.core.db import get_db

router = APIRouter(prefix="/bot", tags=["telegram"])


@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    verify_telegram_request(request)
    payload = await request.json()
    await handle_update(payload, db)
    return {"ok": True}
