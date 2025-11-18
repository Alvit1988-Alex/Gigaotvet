import asyncio

from app.models import KnowledgeChunk, KnowledgeFile
from app.services import rag_service
from app.services.rag_service import RAGService


def test_rag_returns_relevant_chunk(db_session, monkeypatch):
    knowledge_file = KnowledgeFile(
        filename_original="test.txt",
        stored_path="/tmp/test.txt",
        mime_type="text/plain",
        size_bytes=10,
        total_chunks=0,
    )
    db_session.add(knowledge_file)
    db_session.commit()

    first_chunk = KnowledgeChunk(
        file_id=knowledge_file.id,
        chunk_index=0,
        text="Информация о доставке и оплате.",
        embedding=[1.0, 0.0],
    )
    second_chunk = KnowledgeChunk(
        file_id=knowledge_file.id,
        chunk_index=1,
        text="Другие сведения",
        embedding=[0.0, 1.0],
    )
    db_session.add_all([first_chunk, second_chunk])
    db_session.commit()

    async def fake_embedding(_: str):
        return [1.0, 0.0]

    monkeypatch.setattr(rag_service, "get_text_embedding", fake_embedding)

    service = RAGService(db_session)
    matches = asyncio.run(service.get_relevant_chunks("Как оплатить доставку?", limit=2, min_relevance=0.1))
    assert matches
    assert matches[0].chunk.text.startswith("Информация")


def test_rag_returns_empty_when_low_score(db_session, monkeypatch):
    knowledge_file = KnowledgeFile(
        filename_original="test.txt",
        stored_path="/tmp/test.txt",
        mime_type="text/plain",
        size_bytes=10,
        total_chunks=0,
    )
    db_session.add(knowledge_file)
    db_session.commit()

    chunk = KnowledgeChunk(
        file_id=knowledge_file.id,
        chunk_index=0,
        text="Информация",
        embedding=[1.0, 0.0],
    )
    db_session.add(chunk)
    db_session.commit()

    async def fake_embedding(_: str):
        return [0.0, 1.0]

    monkeypatch.setattr(rag_service, "get_text_embedding", fake_embedding)

    service = RAGService(db_session)
    matches = asyncio.run(service.get_relevant_chunks("Вопрос", limit=2, min_relevance=0.9))
    assert matches == []
