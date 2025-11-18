"use client";

import { useAuth } from "../contexts/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <section className="panel-card">
      <p className="muted-text">Добро пожаловать в панель Gigaotvet</p>
      <h1>Рабочая панель администратора</h1>
      <p>
        Здесь появятся виджеты статистики, очередь обращений пользователей и инструменты для
        операторов. Пока что мы подтверждаем, что пользователь авторизован как администратор
        Telegram и можем хранить его профиль локально.
      </p>
      {user && (
        <div className="panel-card__profile">
          <h2>Текущий администратор</h2>
          <ul>
            <li>
              <strong>Имя:</strong> {user.full_name}
            </li>
            {user.username && (
              <li>
                <strong>Ник:</strong> @{user.username}
              </li>
            )}
            <li>
              <strong>Telegram ID:</strong> {user.telegram_id}
            </li>
            <li>
              <strong>Статус:</strong> {user.is_active ? "Активен" : "Отключён"}
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
