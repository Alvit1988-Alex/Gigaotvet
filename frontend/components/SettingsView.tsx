"use client";

import { ChangeEvent } from "react";
import { useTheme } from "../contexts/ThemeContext";

type ChannelPreset = {
  id: string;
  label: string;
  description: string;
};

const channelPresets: ChannelPreset[] = [
  {
    id: "telegram",
    label: "Telegram / VIP",
    description: "Ответ до 5 минут, передача оператору по ключевым словам",
  },
  {
    id: "email",
    label: "Email / Поддержка",
    description: "Ассистент отвечает на 80% шаблонных вопросов",
  },
  {
    id: "site",
    label: "Виджет на сайте",
    description: "Тёплые лиды автоматически получают подборку тарифов",
  },
];

export default function SettingsView() {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextTheme = event.target.value === "light" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <section className="card settings-card" aria-labelledby="settings-title">
      <div className="card-header">
        <div>
          <p className="eyebrow">Настройки рабочей среды</p>
          <h2 id="settings-title">Оформление и автоматизация</h2>
        </div>
        <span className="tag">beta</span>
      </div>

      <div className="settings-grid">
        <label className="form-field" htmlFor="theme-select">
          <span className="form-label">Тема интерфейса</span>
          <div className="form-control">
            <select id="theme-select" value={theme} onChange={handleThemeChange}>
              <option value="dark">Тёмная</option>
              <option value="light">Светлая</option>
            </select>
          </div>
          <p className="form-hint">Сохраняется в браузере и синхронизируется между вкладками.</p>
        </label>

        <label className="form-field" htmlFor="traffic-limit">
          <span className="form-label">Суточный лимит трафика</span>
          <div className="form-control">
            <input id="traffic-limit" name="traffic-limit" type="number" placeholder="1500" defaultValue={1200} />
            <span className="input-suffix">диалогов</span>
          </div>
          <p className="form-hint">При достижении лимита уведомим оператора и расширим очередь.</p>
        </label>

        <label className="form-field" htmlFor="handoff-threshold">
          <span className="form-label">Порог авто-передачи оператору</span>
          <div className="form-control">
            <input id="handoff-threshold" name="handoff-threshold" type="range" min="30" max="95" defaultValue="65" />
            <div className="range-legend">
              <span>30%</span>
              <span>65%</span>
              <span>95%</span>
            </div>
          </div>
          <p className="form-hint">Уровень уверенности модели, при котором диалог отдаётся оператору.</p>
        </label>
      </div>

      <div className="preset-list">
        {channelPresets.map((preset) => (
          <article key={preset.id} className="preset-card">
            <div>
              <p className="preset-title">{preset.label}</p>
              <p className="preset-description">{preset.description}</p>
            </div>
            <button type="button" className="ghost-button">
              Настроить
            </button>
          </article>
        ))}
      </div>

      <footer className="settings-footer">
        <button type="button" className="primary-button">
          Сохранить изменения
        </button>
        <button type="button" className="ghost-button">
          Сбросить
        </button>
      </footer>
    </section>
  );
}
