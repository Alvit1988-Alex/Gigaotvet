# Gigaotvet — автоответчик на базе ИИ + веб-панель

Этот репозиторий содержит:
- `backend/` — API, интеграция с Telegram-ботом, БД, RAG.
- `frontend/` — панель администратора / оператора (Next.js + TypeScript).
- `infra/` — docker-compose и инфраструктура.

## Быстрый старт (черновой)

1. Скопируйте содержимое архива в папку проекта (например, `H:\TG_bot\Gigaotvet`).
2. Заполните `backend/.env` на основе `backend/.env.example`.
3. В каталоге `infra/` выполните:

   ```bash
   docker-compose up --build
   ```

Это поднимет PostgreSQL и backend (фронтенд будет добавлен на следующих этапах).
