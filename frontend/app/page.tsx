import SettingsView from "../components/SettingsView";

type OverviewStat = {
  label: string;
  value: string;
  trend: string;
  caption: string;
};

type ConversationRow = {
  client: string;
  topic: string;
  channel: string;
  status: string;
  updated: string;
};

type TeamStatus = {
  name: string;
  role: string;
  status: "online" | "busy" | "offline";
};

type AutomationStat = {
  label: string;
  value: string;
  trend: string;
};

const overviewStats: OverviewStat[] = [
  { label: "Новых диалогов", value: "182", trend: "+14%", caption: "за сегодня" },
  { label: "Автоответ", value: "76%", trend: "+4%", caption: "точность распознавания" },
  { label: "Передано операторам", value: "38", trend: "-8%", caption: "за последние 24 часа" },
  { label: "CSAT", value: "4.82", trend: "+0.12", caption: "оценка клиентов" },
];

const conversations: ConversationRow[] = [
  {
    client: "Анна Мартынова",
    topic: "Онбординг / тариф",
    channel: "Telegram",
    status: "В работе",
    updated: "12:45",
  },
  {
    client: "Игорь Колосов",
    topic: "Рассылка для VIP",
    channel: "Email",
    status: "Автоматически",
    updated: "12:31",
  },
  {
    client: "Дарья Мартыненко",
    topic: "Биллинг",
    channel: "Виджет",
    status: "Оператор",
    updated: "12:19",
  },
  {
    client: "Лев Крылов",
    topic: "Интеграция CRM",
    channel: "Telegram",
    status: "В приоритете",
    updated: "11:58",
  },
];

const teamStatuses: TeamStatus[] = [
  { name: "Полина", role: "AI-тренер", status: "online" },
  { name: "Артём", role: "оператор", status: "busy" },
  { name: "Наташа", role: "аналитик", status: "offline" },
];

const teamStatusLabels: Record<TeamStatus["status"], string> = {
  online: "онлайн",
  busy: "занят",
  offline: "офлайн",
};

const automationStats: AutomationStat[] = [
  { label: "SLA 5 минут", value: "92%", trend: "+3%" },
  { label: "QoS ассистента", value: "98.1%", trend: "+1%" },
  { label: "Ручных действий", value: "24", trend: "-12%" },
];

const navLinks = ["Обзор", "Диалоги", "Рассылки", "Аналитика", "Настройки"];

export default function HomePage() {
  return (
    <div className="app">
      <aside className="sidebar card">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Gigaotvet</p>
            <h1>Операционный центр</h1>
          </div>
          <span className="status-pill status-success">стабильно</span>
        </div>

        <nav className="sidebar-nav" aria-label="Основная навигация">
          {navLinks.map((link, index) => (
            <a key={link} className={index === 0 ? "sidebar-link active" : "sidebar-link"} href="#">
              {link}
            </a>
          ))}
        </nav>

        <div className="sidebar-panel">
          <p className="eyebrow">Состояние ассистента</p>
          <ul className="sidebar-stats">
            <li>
              <span>Очередь</span>
              <strong>12 диалогов</strong>
            </li>
            <li>
              <span>Покрытие AI</span>
              <strong>76%</strong>
            </li>
            <li>
              <span>Инциденты</span>
              <strong className="text-danger">0</strong>
            </li>
          </ul>
        </div>

        <div className="sidebar-panel">
          <p className="eyebrow">Смены</p>
          <ul className="team-list">
            {teamStatuses.map((member) => (
              <li key={member.name}>
                <div>
                  <p>{member.name}</p>
                  <span>{member.role}</span>
                </div>
                <span className={`status-pill status-${member.status}`}>
                  {teamStatusLabels[member.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="main">
        <header className="top-nav">
          <div>
            <p className="eyebrow">Сводка за сутки</p>
            <h2>Контрольная панель</h2>
          </div>
          <div className="top-nav-links">
            {navLinks.map((link, index) => (
              <button key={link} type="button" className={index === 0 ? "top-nav-link active" : "top-nav-link"}>
                {link}
              </button>
            ))}
          </div>
          <div className="top-nav-actions">
            <input type="search" placeholder="Поиск по диалогам" />
            <button type="button" className="primary-button">
              Новая рассылка
            </button>
          </div>
        </header>

        <section className="card-grid">
          {overviewStats.map((stat) => (
            <article key={stat.label} className="card stat-card">
              <header>
                <p className="eyebrow">{stat.label}</p>
                <span className={stat.trend.startsWith("-") ? "trend trend-down" : "trend trend-up"}>{stat.trend}</span>
              </header>
              <div className="stat-value">{stat.value}</div>
              <p className="stat-caption">{stat.caption}</p>
            </article>
          ))}
        </section>

        <section className="panels-grid">
          <article className="card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Последние диалоги</p>
                <h3>Очередь обращений</h3>
              </div>
              <button type="button" className="ghost-button">
                Выгрузить CSV
              </button>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Тема</th>
                    <th>Канал</th>
                    <th>Статус</th>
                    <th>Обновлено</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((conversation) => (
                    <tr key={conversation.client}>
                      <td>{conversation.client}</td>
                      <td>{conversation.topic}</td>
                      <td>{conversation.channel}</td>
                      <td>
                        <span className="status-pill">{conversation.status}</span>
                      </td>
                      <td>{conversation.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Автоматизация</p>
                <h3>Контроль качества</h3>
              </div>
              <span className="tag">live</span>
            </div>
            <ul className="automation-list">
              {automationStats.map((stat) => (
                <li key={stat.label}>
                  <div>
                    <p>{stat.label}</p>
                    <span>{stat.trend}</span>
                  </div>
                  <strong>{stat.value}</strong>
                </li>
              ))}
            </ul>
            <div className="chart-placeholder">
              <p>Диаграмма прогресса</p>
              <span>Обновление каждые 15 минут</span>
            </div>
          </article>
        </section>

        <section className="panels-grid">
          <article className="card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Мониторинг</p>
                <h3>Лента событий</h3>
              </div>
              <span className="tag">SLA 15 мин</span>
            </div>
            <ul className="timeline">
              <li>
                <p>Запущена A/B проверка нового промта для биллинга</p>
                <span>12:20 · Полина</span>
              </li>
              <li>
                <p>Добавлены ответы на новые тарифы в базу знаний</p>
                <span>11:40 · Автообновление</span>
              </li>
              <li>
                <p>Оператор Артём закрыл диалог #4821</p>
                <span>11:05 · Рейтинг 5/5</span>
              </li>
            </ul>
          </article>

          <SettingsView />
        </section>
      </div>
    </div>
  );
}
