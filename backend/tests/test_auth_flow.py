import pytest


@pytest.mark.asyncio
async def test_login_flow_and_auth_me(async_client):
    init_resp = await async_client.post("/api/auth/init")
    assert init_resp.status_code == 200
    payload = init_resp.json()
    token = payload["token"]
    assert payload["login_url"] is None

    status_resp = await async_client.get("/api/auth/status", params={"token": token})
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "pending"

    callback_payload = {
        "token": token,
        "telegram_id": 987654321,
        "full_name": "Operator",
        "username": "operator",
    }
    callback_resp = await async_client.post("/api/auth/telegram_callback", json=callback_payload)
    assert callback_resp.status_code == 200

    status_resp = await async_client.get("/api/auth/status", params={"token": token})
    status_data = status_resp.json()
    assert status_data["status"] == "confirmed"
    assert status_data["admin"]["telegram_id"] == 987654321

    login_resp = await async_client.post("/api/auth/login", json={"token": token})
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert "refresh_token" in login_data

    me_resp = await async_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {login_data['access_token']}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["admin"]["username"] == "operator"


@pytest.mark.asyncio
async def test_auth_me_requires_valid_token(async_client):
    response = await async_client.get(
        "/api/auth/me", headers={"Authorization": "Bearer invalid"}
    )
    assert response.status_code == 401
