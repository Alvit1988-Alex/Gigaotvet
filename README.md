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

## Фронтенд (Next.js)

### Docker-образ

В каталоге `frontend/` теперь есть production Dockerfile. Он собирает Next.js-приложение на Node.js 20 с помощью multi-stage пайплайна (`npm ci` → `npm run build`) и на выходе публикует только минимально необходимые артефакты (`.next/standalone`, `.next/static`, `public/`). Рантайм-образ запускается командой `node server.js` (эквивалент `next start`) и выставляет порт `3000`.

Сборка образа:

```bash
docker build \
  -f frontend/Dockerfile \
  -t gigaotvet-frontend \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://backend.example.com \
  ./frontend
```

Запуск (порт можно пробрасывать в compose/nginx):

```bash
docker run -p 3000:3000 -e PORT=3000 gigaotvet-frontend
```

### Переменные окружения / build args

| Имя | Уровень | Назначение |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `--build-arg` при сборке, либо `.env.local` для разработки | URL backend API, который попадает в клиентский бандл. Обязательно должен оканчиваться без `/`. |
| `PORT` | переменная окружения в рантайме контейнера | Какой порт будет слушать `next start`. По умолчанию `3000`, этот же порт публикуется через `EXPOSE` и используется в docker-compose/nginx. |

> ⚠️ Все переменные, начинающиеся на `NEXT_PUBLIC_`, внедряются в статический бандл во время `npm run build`. Поэтому для production-образа их нужно передавать на этапе `docker build`.

## Systemd-юниты для продакшен-развертывания

В каталоге `deploy/systemd/` лежат готовые unit-файлы `giga_backend.service`, `giga_frontend.service` и `giga_bot.service`.

- Backend запускает `uvicorn app.main:app --host 0.0.0.0 --port 8000` и читает переменные из `/opt/gigaotvet/backend/.env`.
- Frontend ожидает собранный Next.js-проект и выполняет `next start -p 3000`, подхватывая настройки из `/opt/gigaotvet/frontend/.env.production`.
- Bot-сервис предназначен для запуска скрипта Telegram-бота (`python -m app.bot`) рядом с backend-кодом и также использует `/opt/gigaotvet/backend/.env`.

Перед установкой отредактируйте `WorkingDirectory` и `EnvironmentFile`, чтобы они указывали на реальные пути деплоя (например, `/opt/gigaotvet`). Затем установите юниты:

```bash
sudo cp deploy/systemd/giga_*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now giga_backend.service giga_frontend.service giga_bot.service
```

Такой порядок копирования → `daemon-reload` → `enable --now` гарантирует корректную регистрацию unit-файлов и автоматический старт сервисов при перезагрузке.
