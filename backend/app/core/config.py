from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl


class Settings(BaseSettings):
    APP_NAME: str = "Gigaotvet Backend"
    APP_ENV: str = "dev"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    BACKEND_CORS_ORIGINS: list[AnyHttpUrl] | List[str] = ["http://localhost:3000"]

    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "gigaotvet"
    POSTGRES_USER: str = "gigaotvet"
    POSTGRES_PASSWORD: str = "change_me"

    JWT_SECRET: str = "change_me_secret_key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_WEBHOOK_SECRET: str | None = None
    TELEGRAM_BOT_USERNAME: str | None = None

    GIGACHAT_CLIENT_ID: str | None = None
    GIGACHAT_CLIENT_SECRET: str | None = None
    GIGACHAT_API_URL: str | None = None
    GIGACHAT_OAUTH_URL: str | None = None
    GIGACHAT_SSL_VERIFY: bool = False
    GIGACHAT_SCOPE: str = "GIGACHAT_API_PERS"

    KNOWLEDGE_FILES_DIR: str = "app_data/knowledge_files"
    KNOWLEDGE_MAX_FILE_SIZE_MB: int = 2
    KNOWLEDGE_TOTAL_STORAGE_MB: int = 10

    RAG_MIN_CHUNK_SIZE: int = 500
    RAG_MAX_CHUNK_SIZE: int = 1500
    RAG_MIN_RELEVANCE: float = 0.3
    RAG_OPERATOR_HIGH_CONFIDENCE: float = 0.5
    RAG_HISTORY_MESSAGE_LIMIT: int = 15

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
