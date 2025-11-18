from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Admin, KnowledgeFile
from app.schemas.knowledge_file import KnowledgeFileOut
from app.services.audit import log_action
from app.services.knowledge_base import KnowledgeBaseService
from app.services.security import get_current_admin

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def _get_file(db: Session, file_id: int) -> KnowledgeFile:
    file = db.query(KnowledgeFile).filter(KnowledgeFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")
    return file


@router.get("/files", response_model=list[KnowledgeFileOut])
def list_files(
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
) -> list[KnowledgeFileOut]:
    files = db.query(KnowledgeFile).order_by(KnowledgeFile.created_at.desc()).all()
    return [KnowledgeFileOut.model_validate(file) for file in files]


@router.post("/files", response_model=KnowledgeFileOut, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
) -> KnowledgeFileOut:
    service = KnowledgeBaseService(db)
    knowledge_file = await service.create_from_upload(file)
    log_action(
        db,
        admin_id=admin.id,
        action="upload_knowledge_file",
        params={"file_id": knowledge_file.id, "filename": knowledge_file.filename_original},
        commit=True,
    )
    return KnowledgeFileOut.model_validate(knowledge_file)


@router.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
):
    file = _get_file(db, file_id)
    path = Path(file.stored_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл недоступен")
    return FileResponse(path, media_type=file.mime_type or "application/octet-stream", filename=file.filename_original)


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
) -> None:
    file = _get_file(db, file_id)
    service = KnowledgeBaseService(db)
    service.delete_file(file)
    log_action(
        db,
        admin_id=admin.id,
        action="delete_knowledge_file",
        params={"file_id": file_id, "filename": file.filename_original},
        commit=True,
    )
