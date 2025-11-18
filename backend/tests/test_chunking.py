from app.services.chunking import split_into_chunks


def test_split_into_chunks_keeps_lengths():
    text = " ".join([f"Раздел {i}. Это тестовое предложение." for i in range(200)])
    chunks = split_into_chunks(text, min_size=200, max_size=400)
    assert len(chunks) > 1
    assert all(len(chunk) <= 400 for chunk in chunks)
    assert all(len(chunk) >= 200 for chunk in chunks[:-1])
