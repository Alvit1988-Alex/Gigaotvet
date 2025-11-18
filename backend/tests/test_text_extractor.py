from pathlib import Path

import pytest

from app.services.text_extractor import extract_text


def test_extract_text_from_txt(tmp_path):
    path = tmp_path / "note.txt"
    path.write_text("Привет\n\nМир", encoding="utf-8")
    text = extract_text(path)
    assert "Привет" in text and "Мир" in text


def test_extract_text_from_docx(tmp_path):
    docx = pytest.importorskip("docx")
    Document = docx.Document
    document = Document()
    document.add_paragraph("Документ ИИ")
    path = tmp_path / "note.docx"
    document.save(path)
    text = extract_text(path)
    assert "Документ ИИ" in text
