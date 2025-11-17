from fastapi import APIRouter

router = APIRouter()

# Здесь позже будут подключены роутеры:
# - auth (авторизация через Telegram / JWT)
# - dialogs (диалоги, статусы)
# - admin (администраторы)
# - rag (работа с базой знаний, файлы)


@router.get("/ping", tags=["system"])
async def ping() -> dict:
    """Простой тестовый эндпоинт API."""
    return {"message": "pong"}


api_router = router
