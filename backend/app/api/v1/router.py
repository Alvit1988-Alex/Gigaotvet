from fastapi import APIRouter

from app.api.v1 import admins, ai_instructions, auth, dialogs, knowledge, messages, ws

router = APIRouter()

router.include_router(auth.router)
router.include_router(dialogs.router)
router.include_router(messages.router)
router.include_router(admins.router)
router.include_router(knowledge.router)
router.include_router(ai_instructions.router)
router.include_router(ws.router)


@router.get("/ping", tags=["system"])
async def ping() -> dict:
    """Простой тестовый эндпоинт API."""
    return {"message": "pong"}


api_router = router
