"use client";

import { FormEvent, useMemo, useState } from "react";

type SearchResult = {
  id: string;
  source: string;
  customer: string;
  topic: string;
  messages: number;
  owner: string;
  status: "open" | "closed" | "scheduled";
};

const RESULTS: SearchResult[] = [
  {
    id: "SR-88",
    source: "Telegram",
    customer: "Лариса Тимофеева",
    topic: "Бронирование доставки",
    messages: 12,
    owner: "Иван", 
    status: "open",
  },
  {
    id: "SR-77",
    source: "Email",
    customer: "ООО \"ГолдТрейд\"",
    topic: "Подписание договора",
    messages: 8,
    owner: "Мария",
    status: "scheduled",
  },
  {
    id: "SR-66",
    source: "Чат на сайте",
    customer: "Валентина",
    topic: "Статус оплаты",
    messages: 4,
    owner: "Оператор-бот",
    status: "closed",
  },
];

export default function SearchView() {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [results, setResults] = useState(RESULTS);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResults(
      RESULTS.filter((row) => {
        const matchesQuery = query
          ? row.customer.toLowerCase().includes(query.toLowerCase()) ||
            row.topic.toLowerCase().includes(query.toLowerCase())
          : true;
        const matchesChannel = channel === "all" ? true : row.source.toLowerCase().includes(channel);
        const matchesStatus = status === "all" ? true : row.status === status;
        return matchesQuery && matchesChannel && matchesStatus;
      }),
    );
  };

  const hasFilters = useMemo(() => query.length > 0 || channel !== "all" || status !== "all", [query, channel, status]);

  return (
    <div className="search-view">
      <form className="search-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Поиск по клиенту или теме</span>
          <input
            type="search"
            placeholder="Имя клиента, номер заказа, тег"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Канал</span>
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="all">Все каналы</option>
            <option value="telegram">Telegram</option>
            <option value="email">Email</option>
            <option value="vk">VK</option>
          </select>
        </label>
        <label className="field">
          <span>Статус</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Все</option>
            <option value="open">Открытые</option>
            <option value="scheduled">Запланированные</option>
            <option value="closed">Закрытые</option>
          </select>
        </label>
        <button type="submit" className="primary-button">
          Найти
        </button>
      </form>

      <div className="search-summary">
        {hasFilters ? "Показаны отфильтрованные результаты" : "Показаны последние взаимодействия"} — найдено {results.length}
        {" "}
        записей.
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Источник</th>
              <th>Клиент</th>
              <th>Тема</th>
              <th>Сообщений</th>
              <th>Ответственный</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.source}</td>
                <td>{row.customer}</td>
                <td>{row.topic}</td>
                <td>{row.messages}</td>
                <td>{row.owner}</td>
                <td>
                  <span className={`status-pill status-${row.status}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && <div className="empty-state">Ничего не найдено, уточните запрос.</div>}
      </div>
    </div>
  );
}
