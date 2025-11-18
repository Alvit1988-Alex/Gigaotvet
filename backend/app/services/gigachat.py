from __future__ import annotations

import base64
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class GigaChatError(RuntimeError):
    """Ошибка при обращении к Гигачату."""


class _GigaChatClient:
    def __init__(self) -> None:
        self._token: str | None = None
        self._expires_at: datetime | None = None

    @property
    def is_configured(self) -> bool:
        return bool(settings.GIGACHAT_CLIENT_ID and settings.GIGACHAT_CLIENT_SECRET)

    async def _refresh_token(self) -> None:
        if not self.is_configured:
            raise GigaChatError("GigaChat credentials are not configured")

        oauth_url = settings.GIGACHAT_OAUTH_URL or "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
        auth_bytes = f"{settings.GIGACHAT_CLIENT_ID}:{settings.GIGACHAT_CLIENT_SECRET}".encode("utf-8")
        headers = {
            "Authorization": f"Basic {base64.b64encode(auth_bytes).decode('ascii')}",
            "Content-Type": "application/x-www-form-urlencoded",
            "RqUID": str(uuid.uuid4()),
        }
        data = {"scope": settings.GIGACHAT_SCOPE}

        async with httpx.AsyncClient(verify=settings.GIGACHAT_SSL_VERIFY, timeout=30) as client:
            response = await client.post(oauth_url, data=data, headers=headers)
            if response.status_code >= 400:
                logger.error("Failed to obtain GigaChat token: %s", response.text)
                raise GigaChatError("Failed to obtain GigaChat token")
            payload = response.json()

        expires_in = int(payload.get("expires_in", 1800))
        self._token = payload.get("access_token")
        if not self._token:
            raise GigaChatError("Empty access token from GigaChat")
        self._expires_at = datetime.now(timezone.utc) + timedelta(seconds=max(expires_in - 30, 60))
        logger.info("GigaChat token refreshed, expires at %s", self._expires_at)

    async def _get_token(self) -> str:
        if self._token and self._expires_at and self._expires_at > datetime.now(timezone.utc):
            return self._token
        await self._refresh_token()
        return self._token or ""

    async def _request(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        token = await self._get_token()
        api_url = settings.GIGACHAT_API_URL or "https://gigachat.devices.sberbank.ru/api/v1"
        url = f"{api_url.rstrip('/')}/{endpoint.lstrip('/')}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        async with httpx.AsyncClient(verify=settings.GIGACHAT_SSL_VERIFY, timeout=60) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code >= 400:
                logger.error("GigaChat request failed (%s): %s", endpoint, response.text)
                raise GigaChatError("GigaChat request failed")
            return response.json()

    async def chat_completion(self, messages: list[dict[str, str]]) -> str:
        payload = {
            "model": "GigaChat",
            "messages": messages,
        }
        data = await self._request("chat/completions", payload)
        choices = data.get("choices") or []
        if not choices:
            raise GigaChatError("Empty response from GigaChat")
        message = choices[0].get("message") or {}
        return (message.get("content") or "").strip()

    async def get_embedding(self, text: str) -> list[float]:
        payload = {
            "model": "Embeddings",
            "input": text,
        }
        data = await self._request("embeddings", payload)
        embeddings = data.get("data") or []
        if not embeddings:
            raise GigaChatError("Empty embedding response")
        vector = embeddings[0].get("embedding")
        if not isinstance(vector, list):
            raise GigaChatError("Invalid embedding payload")
        return [float(v) for v in vector]


def get_client() -> _GigaChatClient:
    return _client


_client = _GigaChatClient()


async def chat_with_context(messages: list[dict[str, str]]) -> str:
    client = get_client()
    if not client.is_configured:
        raise GigaChatError("GigaChat credentials are not configured")
    return await client.chat_completion(messages)


async def get_embedding(text: str) -> list[float]:
    client = get_client()
    if not client.is_configured:
        raise GigaChatError("GigaChat credentials are not configured")
    return await client.get_embedding(text)
