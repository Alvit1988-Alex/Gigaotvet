from __future__ import annotations

import ipaddress

import httpx
from fastapi import HTTPException, Request, status

from app.core.config import settings

TELEGRAM_IP_RANGES = [
    "149.154.160.0/20",
    "91.108.4.0/22",
]


def _is_ip_allowed(ip: str) -> bool:
    if ip in {"127.0.0.1", "::1"}:
        return True
    try:
        ip_obj = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for cidr in TELEGRAM_IP_RANGES:
        if ip_obj in ipaddress.ip_network(cidr):
            return True
    return False


def verify_telegram_request(request: Request) -> None:
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if settings.TELEGRAM_WEBHOOK_SECRET and secret != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")

    client_host = request.client.host if request.client else None
    if settings.APP_ENV != "prod":
        return
    if client_host and not _is_ip_allowed(client_host):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="IP is not allowed")


async def send_telegram_message(chat_id: int, text: str) -> None:
    if not settings.TELEGRAM_BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(url, json={"chat_id": chat_id, "text": text})
