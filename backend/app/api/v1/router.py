from fastapi import APIRouter

from app.api.v1 import admins, auth, dialogs, messages

router = APIRouter()

router.include_router(auth.router)
router.include_router(dialogs.router)
router.include_router(messages.router)
router.include_router(admins.router)


@router.get("/ping", tags=["system"])
async def ping() -> dict:
    """Простой тестовый эндпоинт API."""
    return {"message": "pong"}


api_router = router
