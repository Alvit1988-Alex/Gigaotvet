from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import Any, DefaultDict

from fastapi import WebSocket


class WebSocketManager:
    """Tracks WebSocket connections per logical channel."""

    def __init__(self) -> None:
        self._connections: DefaultDict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, channel: str) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[channel].add(websocket)

    async def disconnect(self, websocket: WebSocket, channel: str) -> None:
        async with self._lock:
            connections = self._connections.get(channel)
            if not connections:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(channel, None)

    async def broadcast(self, channel: str, payload: Any) -> None:
        message = json.dumps(payload, default=str)
        connections: list[WebSocket]
        async with self._lock:
            connections = list(self._connections.get(channel, set()))
        for connection in connections:
            try:
                await connection.send_text(message)
            except Exception:
                await self.disconnect(connection, channel)


_ws_manager = WebSocketManager()


def get_ws_manager() -> WebSocketManager:
    return _ws_manager
