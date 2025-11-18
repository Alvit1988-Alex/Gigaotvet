"use client";

import { useState } from "react";

type NotificationChannel = "email" | "telegram" | "webhook";

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  email: "Email",
  telegram: "Telegram",
  webhook: "Webhook",
};

export default function SettingsView() {
  const [notifications, setNotifications] = useState<Record<NotificationChannel, boolean>>({
    email: true,
    telegram: true,
    webhook: false,
  });
  const [autoAssign, setAutoAssign] = useState(true);
  const [slaMinutes, setSlaMinutes] = useState(15);

  return (
    <div className="settings-view">
      <section className="settings-card">
        <header>
          <h3>Уведомления</h3>
          <p>Настройте каналы, куда прилетают алерты об эскалациях.</p>
        </header>
        <div className="settings-grid">
          {(Object.keys(CHANNEL_LABEL) as NotificationChannel[]).map((channel) => (
            <label key={channel} className="checkbox-field">
              <input
                type="checkbox"
                checked={notifications[channel]}
                onChange={(event) =>
                  setNotifications((prev) => ({
                    ...prev,
                    [channel]: event.target.checked,
                  }))
                }
              />
              <span>{CHANNEL_LABEL[channel]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <header>
          <h3>Маршрутизация обращений</h3>
          <p>Правила распределения новых диалогов по очередям.</p>
        </header>
        <label className="switch-field">
          <span>Назначать автоматически по загруженности</span>
          <input type="checkbox" checked={autoAssign} onChange={(event) => setAutoAssign(event.target.checked)} />
        </label>
        <label className="field">
          <span>Максимальное время SLA, мин</span>
          <input type="number" min={5} max={60} value={slaMinutes} onChange={(event) => setSlaMinutes(Number(event.target.value))} />
        </label>
        <button type="button" className="primary-button">
          Сохранить
        </button>
      </section>

      <section className="settings-card">
        <header>
          <h3>Интеграции</h3>
          <p>Подключите CRM и BI системы для расширенной аналитики.</p>
        </header>
        <div className="integrations">
          <article>
            <h4>Bitrix24</h4>
            <p>Синхронизация сделок и автоматическое создание задач.</p>
            <button type="button" className="ghost-button">
              Подключить
            </button>
          </article>
          <article>
            <h4>Power BI</h4>
            <p>Экспорт KPI по очередям в реальном времени.</p>
            <button type="button" className="ghost-button">
              Настроить
            </button>
          </article>
        </div>
      </section>
    </div>
  );
}
