from __future__ import annotations

import pytest

from app.core.config import settings
from app.models import KnowledgeChunk, KnowledgeFile


@pytest.mark.asyncio
async def test_upload_and_delete_knowledge_file(
    async_client,
    db_session,
    admin,
    auth_headers,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(settings, "KNOWLEDGE_FILES_DIR", str(tmp_path))

    chunks = ["chunk-one", "chunk-two", "chunk-three"]
    monkeypatch.setattr(
        "app.services.knowledge_base.chunking.split_into_chunks",
        lambda text: chunks,
    )

    async_calls: list[str] = []

    async def fake_embedding(value: str) -> list[float]:
        async_calls.append(value)
        return [1.0]

    monkeypatch.setattr(
        "app.services.knowledge_base.embedding_service.get_text_embedding",
        fake_embedding,
    )
    monkeypatch.setattr(
        "app.services.knowledge_base.text_extractor.extract_text",
        lambda *_args, **_kwargs: "extracted",
    )

    files = {"file": ("notes.txt", b"hello world", "text/plain")}
    response = await async_client.post("/api/knowledge/files", files=files, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["total_chunks"] == len(chunks)
    assert async_calls == chunks

    file_in_db = db_session.query(KnowledgeFile).first()
    assert file_in_db is not None
    assert db_session.query(KnowledgeChunk).count() == len(chunks)

    delete_resp = await async_client.delete(
        f"/api/knowledge/files/{data['id']}", headers=auth_headers
    )
    assert delete_resp.status_code == 204
    assert db_session.query(KnowledgeFile).count() == 0
