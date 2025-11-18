from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import app.middleware.admin_context as admin_context
from app.core.db import Base, get_db
from app.core.ws_manager import WebSocketManager, get_ws_manager
from app.main import app as fastapi_app
from app.models import Admin
from app.services.security import create_access_token


@pytest.fixture()
def engine():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture()
def session_factory(engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture()
def db_session(session_factory) -> Session:
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def ws_manager() -> WebSocketManager:
    return WebSocketManager()


@pytest.fixture()
def app(db_session: Session, session_factory, ws_manager: WebSocketManager) -> FastAPI:
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.rollback()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.dependency_overrides[get_ws_manager] = lambda: ws_manager
    original_session_local = admin_context.SessionLocal
    admin_context.SessionLocal = session_factory
    try:
        yield fastapi_app
    finally:
        fastapi_app.dependency_overrides.clear()
        admin_context.SessionLocal = original_session_local


@pytest.fixture()
async def async_client(app: FastAPI):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture()
def admin(db_session: Session) -> Admin:
    admin = Admin(
        telegram_id=123,
        full_name="Test Admin",
        username="tester",
        is_superadmin=True,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture()
def auth_headers(admin: Admin) -> dict[str, str]:
    token = create_access_token(admin.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def websocket_token(admin: Admin) -> str:
    return create_access_token(admin.id)


@pytest.fixture()
def test_client(app: FastAPI) -> TestClient:
    with TestClient(app) as client:
        yield client
