from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, WebSocket, status
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.ws_manager import WebSocketManager, get_ws_manager
from app.services.security import ACCESS_COOKIE_NAME, verify_token

router = APIRouter(prefix="/events", tags=["events"])


async def _authorize_websocket(websocket: WebSocket, db: Session) -> bool:
    token = websocket.query_params.get("token") or websocket.cookies.get(ACCESS_COOKIE_NAME)
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return False
    try:
        verify_token(token, db=db)
    except HTTPException as exc:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=exc.detail)
        return False
    return True


async def _subscribe(
    websocket: WebSocket,
    channel: str,
    *,
    manager: WebSocketManager,
) -> None:
    await manager.connect(websocket, channel)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(websocket, channel)


async def _ws_endpoint(
    websocket: WebSocket,
    channel: str,
    db: Session,
    manager: WebSocketManager,
) -> None:
    authorized = await _authorize_websocket(websocket, db)
    if not authorized:
        return
    await _subscribe(websocket, channel, manager=manager)


@router.websocket("/dialogs")
async def dialogs_events(
    websocket: WebSocket,
    db: Session = Depends(get_db),
    manager: WebSocketManager = Depends(get_ws_manager),
) -> None:
    await _ws_endpoint(websocket, "dialogs", db, manager)


@router.websocket("/messages")
async def messages_events(
    websocket: WebSocket,
    db: Session = Depends(get_db),
    manager: WebSocketManager = Depends(get_ws_manager),
) -> None:
    await _ws_endpoint(websocket, "messages", db, manager)


@router.websocket("/operators")
async def operators_events(
    websocket: WebSocket,
    db: Session = Depends(get_db),
    manager: WebSocketManager = Depends(get_ws_manager),
) -> None:
    await _ws_endpoint(websocket, "operators", db, manager)


@router.websocket("/system")
async def system_events(
    websocket: WebSocket,
    db: Session = Depends(get_db),
    manager: WebSocketManager = Depends(get_ws_manager),
) -> None:
    await _ws_endpoint(websocket, "system", db, manager)
