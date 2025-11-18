from __future__ import annotations

import logging
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import KnowledgeChunk, KnowledgeFile
from app.services import chunking, embedding_service, text_extractor

logger = logging.getLogger(__name__)


class KnowledgeBaseService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.storage_dir = Path(settings.KNOWLEDGE_FILES_DIR)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _current_storage_size(self) -> int:
        total = self.db.query(func.coalesce(func.sum(KnowledgeFile.size_bytes), 0)).scalar()
        return int(total or 0)

    async def _read_file(self, upload_file: UploadFile) -> tuple[bytes, str]:
        content = await upload_file.read()
        upload_file.file.seek(0)
        size = len(content)
        if size == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл пустой")
        max_size = settings.KNOWLEDGE_MAX_FILE_SIZE_MB * 1024 * 1024
        if size > max_size:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл превышает 2 МБ")
        total_limit = settings.KNOWLEDGE_TOTAL_STORAGE_MB * 1024 * 1024
        if self._current_storage_size() + size > total_limit:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Общий объём базы знаний превышает 10 МБ")
        ext = Path(upload_file.filename or "").suffix.lower()
        if ext not in text_extractor.ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недопустимый тип файла")
        return content, ext

    async def create_from_upload(self, upload_file: UploadFile) -> KnowledgeFile:
        content, ext = await self._read_file(upload_file)
        unique_name = f"{uuid4().hex}{ext}"
        stored_path = self.storage_dir / unique_name
        stored_path.write_bytes(content)

        knowledge_file = KnowledgeFile(
            filename_original=upload_file.filename or unique_name,
            stored_path=str(stored_path),
            mime_type=upload_file.content_type,
            size_bytes=len(content),
            total_chunks=0,
        )
        self.db.add(knowledge_file)
        self.db.commit()
        self.db.refresh(knowledge_file)

        try:
            await self._process_file(knowledge_file, ext)
        except Exception:
            logger.exception("Failed to process knowledge file %s", knowledge_file.id)
            self._safe_delete_file(stored_path)
            self.db.delete(knowledge_file)
            self.db.commit()
            raise
        return knowledge_file

    def _safe_delete_file(self, stored_path: Path | str) -> None:
        path = Path(stored_path)
        try:
            if path.exists():
                path.unlink()
        except Exception:
            logger.warning("Failed to delete file %s", path)

    def delete_file(self, file: KnowledgeFile) -> None:
        self._safe_delete_file(file.stored_path)
        self.db.delete(file)
        self.db.commit()

    async def _process_file(self, knowledge_file: KnowledgeFile, ext: str) -> None:
        text = text_extractor.extract_text(Path(knowledge_file.stored_path), extension=ext)
        chunks = chunking.split_into_chunks(text)
        if not chunks:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось подготовить чанк")
        existing = self.db.query(KnowledgeChunk).filter(KnowledgeChunk.file_id == knowledge_file.id)
        for chunk in existing:
            self.db.delete(chunk)
        self.db.flush()

        for index, chunk_text in enumerate(chunks):
            chunk = KnowledgeChunk(file_id=knowledge_file.id, chunk_index=index, text=chunk_text)
            self.db.add(chunk)
        knowledge_file.total_chunks = len(chunks)
        self.db.commit()

        await self._recompute_embeddings(knowledge_file.id)

    async def _recompute_embeddings(self, file_id: int) -> None:
        chunks = (
            self.db.query(KnowledgeChunk)
            .filter(KnowledgeChunk.file_id == file_id)
            .order_by(KnowledgeChunk.chunk_index.asc())
            .all()
        )
        for chunk in chunks:
            chunk.embedding = await embedding_service.get_text_embedding(chunk.text)
            self.db.add(chunk)
        self.db.commit()
