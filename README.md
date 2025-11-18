# Gigaotvet — автоответчик на базе ИИ + веб-панель

Gigaotvet объединяет Telegram-бота, FastAPI backend и панель оператора на Next.js. Репозиторий уже содержит docker-compose и системные юниты, так что один источник правды покрывает локальную разработку, тестирование и продакшен.

## Содержание
1. [Структура проекта](#структура-проекта)
2. [Предварительные требования](#предварительные-требования)
3. [Настройка `.env`](#настройка-env)
4. [Локальная разработка](#локальная-разработка)
5. [Тестирование](#тестирование)
6. [Docker и docker-compose](#docker-и-docker-compose)
7. [Ручная проверка функциональности](#ручная-проверка-функциональности)
8. [Фронтенд (Next.js) Docker-образ](#фронтенд-nextjs-docker-образ)
9. [Продакшен-деплой: docker, nginx, systemd](#продакшен-деплой-docker-nginx-systemd)
10. [Траблшутинг](#траблшутинг)

## Структура проекта
- `backend/` — FastAPI-приложение, интеграции (Telegram, RAG), миграции Alembic и тесты.
- `frontend/` — панель администратора/оператора на Next.js + TypeScript, Vitest и React Testing Library.
- `infra/` — вспомогательные скрипты и docker-compose для CI/CD.
- `deploy/` — systemd-юниты и шаблоны для продакшена.
- `docker-compose.yml` — единый entrypoint, объединяющий БД, backend, frontend и прочие сервисы.

## Предварительные требования
### Backend
- Python 3.11+ (pyproject допускает 3.10, но dev/test собраны под 3.11).
- [Poetry](https://python-poetry.org/) ≥ 1.7 для управления зависимостями.
- PostgreSQL 15+ (локально может подниматься контейнером).

### Frontend
- Node.js 20 (LTS) + npm 10.
- NVM опционально, чтобы переключать версии.

### Общие
- Docker 24+ и Docker Compose Plugin (или `docker-compose` 1.29+).
- Make/PowerShell не обязательны, все команды приведены ниже.

## Настройка `.env`
### Backend
1. Скопируйте шаблон: `cp backend/.env.example backend/.env`.
2. Минимальный набор переменных:
   - `POSTGRES_*` — хост, порт, имя БД, пользователь и пароль.
   - `BACKEND_CORS_ORIGINS` — разрешённые origin-ы (разделяются запятыми, без пробелов).
   - `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`.
   - Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`).
   - Интеграции (например, GigaChat) — оставляйте пустыми, если не используются.
3. Backend читает `.env` автоматически (через `pydantic-settings`). Для docker/systemd укажите путь в `EnvironmentFile` или пробросьте `env_file` в compose.

### Frontend
- Для разработки создайте `frontend/.env.local` и пропишите `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
- В продакшене переменные `NEXT_PUBLIC_*` необходимо прокидывать либо как `--build-arg` при сборке Docker-образа, либо в `.env.production` перед `npm run build`.

## Локальная разработка
### Backend API
```bash
cd backend
poetry install --sync
cp .env.example .env  # если ещё не создан
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- `--reload` обеспечивает горячую перезагрузку.
- Если БД поднимается через docker-compose, обновите `POSTGRES_HOST=postgres`.

### Telegram-бот
Для локальной проверки можно выполнить `poetry run python -m app.bot`. Убедитесь, что в `.env` выставлен тестовый токен и webhook отключён/прокинут через ngrok.

### Frontend
```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```
- Next.js слушает порт `3000` (меняется переменной `PORT`).
- Если используете `.env.local`, переменную можно не передавать вручную.

## Тестирование
### Backend (pytest)
```bash
cd backend
poetry run pytest
```
- Покрывает FastAPI-эндпоинты, сервисы Telegram/RAG и миграции.
- Для ускорения можно добавить `-k` или `-m` с пометками.

### Frontend (Vitest)
```bash
cd frontend
npm run test          # однократный прогон
npm run test -- --watch  # режим наблюдения для локальной разработки
```
- Vitest использует `jsdom`, а MSW доступен в `vitest.setup.ts` для стабов API.

## Docker и docker-compose
1. **Сборка**: `docker compose build` (или `docker-compose build`).
2. **Запуск**: `docker compose up -d` — поднимет PostgreSQL, backend и frontend (при наличии сервисов в `docker-compose.yml`).
3. **Логи**: `docker compose logs -f backend`, `docker compose logs -f frontend`.
4. **Пересборка фронта с новым API URL**:
   ```bash
   docker compose build frontend \
     --build-arg NEXT_PUBLIC_API_BASE_URL=https://backend.example.com
   docker compose up -d frontend
   ```
5. **Остановка/очистка**: `docker compose down` (добавьте `-v`, чтобы удалить тома).

## Ручная проверка функциональности
1. **QR-вход в Telegram-бота**
   - Запустите backend и бот.
   - В панели оператора откройте раздел «Настройки → Интеграции» и запросите QR-код.
   - Отсканируйте QR в мобильном Telegram, подтвердите вход и убедитесь, что сессия появляется в интерфейсе.
2. **Диалоги и ответы**
   - Отправьте сообщение боту, откройте соответствующий диалог в веб-панели.
   - Проверьте, что история сообщений синхронизирована, а автоответчик формирует черновик.
   - Отредактируйте ответ в UI и отправьте — убедитесь, что сообщение доходит до пользователя.
3. **Реальное время / обновления**
   - Откройте панель в двух браузерных вкладках.
   - Введите ответ в одной вкладке и наблюдайте обновление статуса во второй (через WebSocket/SSE).
   - При отсутствии обновления убедитесь, что `BACKEND_CORS_ORIGINS` и прокси (nginx) пропускают WebSocket-соединения.

## Фронтенд (Next.js) Docker-образ
В каталоге `frontend/` есть production Dockerfile. Он собирает приложение на Node.js 20 в два этапа (`npm ci` → `npm run build`) и публикует минимальный рантайм (`.next/standalone`, `.next/static`, `public/`). Исполняется командой `node server.js` (эквивалент `next start`) и слушает порт `3000`.

**Сборка образа**:
```bash
docker build \
  -f frontend/Dockerfile \
  -t gigaotvet-frontend \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://backend.example.com \
  ./frontend
```

**Запуск**:
```bash
docker run -p 3000:3000 -e PORT=3000 gigaotvet-frontend
```

| Переменная | Уровень | Назначение |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `--build-arg` или `.env.local/.env.production` | URL backend API без завершающего `/`. Попадает в клиентский бандл. |
| `PORT` | переменная окружения рантайма | Порт, который слушает `next start`. Должен совпадать с проброшенным наружу. |

> ⚠️ Все `NEXT_PUBLIC_*` внедряются во время `npm run build`. Для production образов обязательно прокидывайте их на этапе сборки.

## Продакшен-деплой: docker, nginx, systemd
### Docker-образы
- **Backend** (`backend/Dockerfile`): ожидает `backend/.env` или набор переменных (`POSTGRES_*`, `JWT_*`, `TELEGRAM_*`).
- **Frontend** (`frontend/Dockerfile`): принимает `NEXT_PUBLIC_API_BASE_URL` на этапе сборки и `PORT` в рантайме.
- **Bot**: используется тот же backend-образ с отдельной командой `python -m app.bot`.

### docker-compose в проде
- Скопируйте `docker-compose.yml` или профиль из `infra/`.
- Задайте `COMPOSE_PROFILES=prod` (если применимо) и `env_file` для каждого сервиса.
- Пример запуска: `docker compose --env-file backend/.env -f docker-compose.yml up -d backend frontend`.

### nginx
- Проксируйте `frontend` на `https://app.example.com` и `backend` на `https://api.example.com` или `/api`.
- Включите поддержку WebSocket: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection upgrade;`.
- Добавьте `proxy_read_timeout 300s`, чтобы длинные сессии (диалоги, QR-подтверждения) не обрывались.

### Systemd-юниты
`deploy/systemd/` содержит:
- `giga_backend.service` — запускает `uvicorn app.main:app --host 0.0.0.0 --port 8000`, читает `/opt/gigaotvet/backend/.env`.
- `giga_frontend.service` — ожидает собранный Next.js и выполняет `next start -p 3000`, берёт `/opt/gigaotvet/frontend/.env.production`.
- `giga_bot.service` — `python -m app.bot`, использует тот же `.env`, что и backend.

Установка:
```bash
sudo cp deploy/systemd/giga_*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now giga_backend.service giga_frontend.service giga_bot.service
```
Перед копированием обновите `WorkingDirectory` и `EnvironmentFile` так, чтобы они указывали на ваши пути (`/opt/gigaotvet`).

### Переменные окружения в продакшене
- Храните секреты в `/opt/gigaotvet/backend/.env` и экспортируйте через `EnvironmentFile` либо `docker secret`.
- Для фронтенда заведите `.env.production` (используется `next build`) и `PORT` в окружении systemd/docker.
- Общие значения: `APP_ENV=prod`, `APP_HOST=0.0.0.0`, `BACKEND_CORS_ORIGINS=https://app.example.com`.

## Траблшутинг
| Симптом | Возможная причина | Решение |
| --- | --- | --- |
| QR-логин не появляется | Неверный `TELEGRAM_BOT_TOKEN` или отсутствует доступ к бот API | Проверьте токен через `@BotFather`, перезапустите `giga_bot.service`, убедитесь, что IP в allowlist. |
| Диалоги не обновляются в реальном времени | WebSocket заблокирован nginx/файрволом | Проверьте заголовки `Upgrade/Connection`, `proxy_read_timeout`, наличие `wss://` в CORS. |
| Frontend не может обратиться к API | `NEXT_PUBLIC_API_BASE_URL` задан с `/` в конце или без HTTPS | Обновите переменную, пересоберите образ/запустите `npm run dev` заново. |
| `poetry run uvicorn` падает при старте | Не применены миграции или БД недоступна | Выполните `poetry run alembic upgrade head`, проверьте `POSTGRES_HOST` и `docker compose ps postgres`. |
| Vitest не видит DOM API | Отсутствует `jsdom` в dev-зависимостях или не подключён `vitest.setup.ts` | Выполните `npm install`, убедитесь, что `vitest.config.ts` импортирует setup. |

Эти шаги должны покрыть полный цикл: от развёртывания и разработки до тестирования и ручной приёмки.
