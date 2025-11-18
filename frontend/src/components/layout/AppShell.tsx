"use client";

import { useEffect, useMemo, useState } from "react";
import DialogsView from "../views/DialogsView";
import SearchView from "../views/SearchView";
import SettingsView from "../views/SettingsView";
import InstructionsView from "../views/InstructionsView";
import StatsView from "../views/StatsView";

type Role = "admin" | "superadmin";
type ViewId = "dialogs" | "search" | "settings" | "instructions" | "stats";

interface ViewConfig {
  id: ViewId;
  label: string;
  description: string;
  roles: Role[];
  component: () => JSX.Element;
}

const VIEW_CONFIG: ViewConfig[] = [
  {
    id: "dialogs",
    label: "Диалоги",
    description: "Живые переписки и статусы операторов",
    roles: ["admin", "superadmin"],
    component: DialogsView,
  },
  {
    id: "search",
    label: "Поиск",
    description: "Фильтры по всем контактам",
    roles: ["admin", "superadmin"],
    component: SearchView,
  },
  {
    id: "settings",
    label: "Настройки",
    description: "Маршрутизация и интеграции",
    roles: ["admin", "superadmin"],
    component: SettingsView,
  },
  {
    id: "instructions",
    label: "Инструкции",
    description: "Шаблоны ответов и требования",
    roles: ["admin", "superadmin"],
    component: InstructionsView,
  },
  {
    id: "stats",
    label: "Статистика",
    description: "Показатели команды и SLA",
    roles: ["superadmin"],
    component: StatsView,
  },
];

const ROLE_LABEL: Record<Role, string> = {
  admin: "Администратор",
  superadmin: "Суперадминистратор",
};

export default function AppShell() {
  const [role, setRole] = useState<Role>("admin");
  const [activeView, setActiveView] = useState<ViewId>("dialogs");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const allowedViews = useMemo(
    () => VIEW_CONFIG.filter((view) => view.roles.includes(role)),
    [role],
  );

  useEffect(() => {
    if (!allowedViews.some((view) => view.id === activeView) && allowedViews.length) {
      setActiveView(allowedViews[0].id);
    }
  }, [activeView, allowedViews]);

  const currentViewDescription = allowedViews.find((view) => view.id === activeView)?.description;

  return (
    <div className={`app-shell role-${role}`}>
      <header className="app-header">
        <div className="logo-block">
          <div className="logo-circle">G</div>
          <div>
            <div className="logo-title">Gigaotvet Control</div>
            <div className="logo-subtitle">панель {ROLE_LABEL[role].toLowerCase()}</div>
          </div>
        </div>
        <div className="header-actions">
          <div className="role-switcher" role="radiogroup" aria-label="Переключение роли">
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <button
                key={value}
                className={`role-chip ${role === value ? "role-chip-active" : ""}`}
                onClick={() => setRole(value as Role)}
                type="button"
                role="radio"
                aria-checked={role === value}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="header-profile">
            <div>
              <div className="profile-name">Софья Лебедева</div>
              <div className="profile-role">{ROLE_LABEL[role]}</div>
            </div>
            <button className="ghost-button" type="button">
              Выйти
            </button>
          </div>
          <button
            className="mobile-menu-toggle"
            type="button"
            aria-label="Меню"
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            ☰
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className={`app-sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
          <nav className="app-nav" aria-label="Основная навигация">
            {allowedViews.map((view) => (
              <button
                key={view.id}
                className={`nav-link ${activeView === view.id ? "nav-link-active" : ""}`}
                onClick={() => {
                  setActiveView(view.id);
                  setMobileNavOpen(false);
                }}
                type="button"
              >
                <span>{view.label}</span>
                <small>{view.description}</small>
              </button>
            ))}
          </nav>
          <div className="sidebar-card fixed-profile-card">
            <div className="profile-mini">
              <div className="avatar-placeholder">SL</div>
              <div>
                <strong>Софья Лебедева</strong>
                <div className="text-muted">смена до 21:00</div>
              </div>
            </div>
            <p className="text-muted">
              Роль определяет доступность вкладок и действий. Выберите «Суперадминистратор», чтобы открыть отчётность и глобальные настройки.
            </p>
            <div className="status-pill status-online">На смене</div>
          </div>
        </aside>

        <main className="app-content">
          <div className="view-heading">
            <div>
              <h1>{allowedViews.find((view) => view.id === activeView)?.label ?? ""}</h1>
              <p>{currentViewDescription}</p>
            </div>
            <div className="view-controls">
              <button type="button" className="ghost-button">
                Экспорт
              </button>
              <button type="button" className="primary-button">
                Создать задачу
              </button>
            </div>
          </div>

          <div className="views-wrapper">
            {VIEW_CONFIG.map((view) => {
              const ViewComponent = view.component;
              const isActive = view.id === activeView;
              const isAccessible = allowedViews.some((allowed) => allowed.id === view.id);
              return (
                <section
                  key={view.id}
                  className={`view ${isActive ? "view-active" : ""} ${!isAccessible ? "view-disabled" : ""}`}
                  aria-hidden={!isActive}
                >
                  {isAccessible ? <ViewComponent /> : <RestrictedViewMessage />} 
                </section>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

function RestrictedViewMessage() {
  return (
    <div className="restricted-view">
      <h3>Недостаточно прав</h3>
      <p>Переключитесь в роль «Суперадминистратор», чтобы увидеть содержимое этой секции.</p>
    </div>
  );
}
