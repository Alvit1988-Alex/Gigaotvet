from __future__ import annotations

from datetime import datetime, timezone

import pytest
from unittest.mock import AsyncMock

from app.models import Admin, Dialog, DialogStatus


@pytest.mark.asyncio
async def test_dialog_assignment_message_and_auto_switch(
    async_client,
    db_session,
    admin,
    auth_headers,
    monkeypatch,
):
    secondary_admin = Admin(
        telegram_id=999,
        full_name="Second", 
        username="second",
        is_superadmin=False,
        is_active=True,
    )
    db_session.add(secondary_admin)

    dialog = Dialog(
        telegram_user_id=42,
        status=DialogStatus.WAIT_OPERATOR,
        last_message_at=datetime.now(timezone.utc),
        unread_messages_count=1,
        is_locked=False,
    )
    db_session.add(dialog)
    db_session.commit()
    db_session.refresh(dialog)

    monkeypatch.setattr(
        "app.api.v1.messages.send_telegram_message", AsyncMock(return_value=None)
    )

    assign_resp = await async_client.post(
        f"/api/dialogs/{dialog.id}/assign",
        json={"admin_id": secondary_admin.id},
        headers=auth_headers,
    )
    assert assign_resp.status_code == 200
    assign_data = assign_resp.json()
    assert assign_data["assigned_admin"]["id"] == secondary_admin.id

    db_session.refresh(dialog)
    assert dialog.assigned_admin_id == secondary_admin.id
    assert dialog.is_locked

    send_resp = await async_client.post(
        "/api/messages/send",
        json={"dialog_id": dialog.id, "content": "Hello from operator"},
        headers=auth_headers,
    )
    assert send_resp.status_code == 200
    message_payload = send_resp.json()
    assert message_payload["role"] == "admin"
    db_session.refresh(dialog)
    assert dialog.status == DialogStatus.WAIT_USER
    assert dialog.unread_messages_count == 0
    assert dialog.locked_by_admin_id == admin.id

    switch_resp = await async_client.post(
        f"/api/dialogs/{dialog.id}/switch_auto",
        headers=auth_headers,
    )
    assert switch_resp.status_code == 200
    switch_data = switch_resp.json()
    assert switch_data["status"] == DialogStatus.AUTO.value

    db_session.refresh(dialog)
    assert dialog.assigned_admin_id is None
    assert dialog.is_locked is False
