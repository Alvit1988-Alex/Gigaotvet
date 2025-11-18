from __future__ import annotations

import logging
import re
from pathlib import Path

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".txt", ".doc", ".docx", ".pdf"}


class TextExtractionError(RuntimeError):
    """Ошибка при извлечении текста из файла."""


def _normalize_text(value: str) -> str:
    text = value.replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[\t ]{2,}", " ", text)
    return text.strip()


def extract_text(path: Path, extension: str | None = None) -> str:
    suffix = (extension or path.suffix).lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недопустимый формат файла")

    try:
        if suffix == ".txt":
            content = path.read_text(encoding="utf-8")
        elif suffix == ".docx":
            try:
                from docx import Document  # type: ignore
            except ImportError as exc:  # pragma: no cover - optional dependency
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Поддержка .docx недоступна на сервере") from exc

            document = Document(str(path))
            content = "\n".join(paragraph.text for paragraph in document.paragraphs)
        elif suffix == ".pdf":
            try:
                import pdfplumber  # type: ignore
            except ImportError as exc:  # pragma: no cover - optional dependency
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Поддержка .pdf недоступна на сервере") from exc

            chunks: list[str] = []
            with pdfplumber.open(str(path)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text() or ""
                    chunks.append(text)
            content = "\n".join(chunks)
        else:  # .doc
            try:
                import textract  # type: ignore
            except ImportError as exc:  # pragma: no cover - depends on optional system packages
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Поддержка .doc недоступна на сервере") from exc

            raw = textract.process(str(path))  # type: ignore[arg-type]
            content = raw.decode("utf-8", errors="ignore")
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - depends on external libs
        logger.exception("Failed to extract text from %s", path)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось прочитать файл") from exc

    normalized = _normalize_text(content)
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл не содержит текста")
    return normalized
