from __future__ import annotations

import pytest
from unittest.mock import AsyncMock

from app.core.config import settings
from app.models import Dialog, DialogStatus


@pytest.mark.asyncio
async def test_websocket_broadcasts_for_messages_and_knowledge(
    test_client,
    db_session,
    admin,
    websocket_token,
    auth_headers,
    tmp_path,
    monkeypatch,
):
    dialog = Dialog(
        telegram_user_id=777,
        status=DialogStatus.WAIT_OPERATOR,
    )
    db_session.add(dialog)
    db_session.commit()
    db_session.refresh(dialog)

    monkeypatch.setattr(
        "app.api.v1.messages.send_telegram_message", AsyncMock(return_value=None)
    )

    monkeypatch.setattr(settings, "KNOWLEDGE_FILES_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.services.knowledge_base.chunking.split_into_chunks",
        lambda text: [text],
    )

    async def fake_embedding(text: str) -> list[float]:
        return [0.1]

    monkeypatch.setattr(
        "app.services.knowledge_base.embedding_service.get_text_embedding",
        fake_embedding,
    )
    monkeypatch.setattr(
        "app.services.knowledge_base.text_extractor.extract_text",
        lambda *_args, **_kwargs: "payload",
    )

    with test_client.websocket_connect(
        f"/api/events/messages?token={websocket_token}"
    ) as ws_messages, test_client.websocket_connect(
        f"/api/events/dialogs?token={websocket_token}"
    ) as ws_dialogs:
        response = test_client.post(
            "/api/messages/send",
            json={"dialog_id": dialog.id, "content": "Ping"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert ws_messages.receive_json()["event"] == "message.created"
        assert ws_dialogs.receive_json()["event"] == "dialog.updated"

    with test_client.websocket_connect(
        f"/api/events/system?token={websocket_token}"
    ) as ws_system:
        files = {"file": ("info.txt", b"body", "text/plain")}
        upload_resp = test_client.post(
            "/api/knowledge/files", files=files, headers=auth_headers
        )
        assert upload_resp.status_code == 201
        assert ws_system.receive_json()["event"] == "knowledge.uploaded"

        file_id = upload_resp.json()["id"]
        delete_resp = test_client.delete(
            f"/api/knowledge/files/{file_id}", headers=auth_headers
        )
        assert delete_resp.status_code == 204
        assert ws_system.receive_json()["event"] == "knowledge.deleted"
