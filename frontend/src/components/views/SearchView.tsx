"use client";

import { FormEvent, useMemo, useState } from "react";

import { fetchDialogs, type DialogShort, type DialogStatus } from "../../../services/dialogsApi";

type UiStatus = "all" | "open" | "scheduled" | "closed";

const UI_STATUS_TO_DIALOG_STATUS: Record<Exclude<UiStatus, "all">, DialogStatus> = {
  open: "wait_operator",
  scheduled: "wait_user",
  closed: "auto",
};

const STATUS_PRESENTATION: Record<DialogStatus, { label: string; className: string }> = {
  auto: { label: "Автоматические", className: "status-closed" },
  wait_operator: { label: "Ожидают оператора", className: "status-open" },
  wait_user: { label: "Ожидают клиента", className: "status-scheduled" },
};

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));
  } catch {
    return "";
  }
}

export default function SearchView() {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState<UiStatus>("all");
  const [results, setResults] = useState<DialogShort[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeQuery, setActiveQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<DialogStatus | undefined>(undefined);
  const [totalResults, setTotalResults] = useState(0);

  const hasFilters = useMemo(
    () => Boolean(activeQuery) || Boolean(activeStatus),
    [activeQuery, activeStatus],
  );

  const loadResults = async (
    targetPage: number,
    searchValue: string,
    statusValue: DialogStatus | undefined,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchDialogs({
        page: targetPage,
        perPage: 20,
        search: searchValue || undefined,
        status: statusValue,
      });

      setResults(response.items);
      setPage(response.page ?? targetPage);
      setHasNext(response.has_next);
      setTotalResults(response.total ?? response.items.length);
      setHasSearched(true);
    } catch (fetchError) {
      console.error("Не удалось загрузить результаты поиска", fetchError);
      setError("Не удалось загрузить результаты поиска");
      setResults([]);
      setHasNext(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    const mappedStatus = status === "all" ? undefined : UI_STATUS_TO_DIALOG_STATUS[status];

    setActiveQuery(trimmedQuery);
    setActiveStatus(mappedStatus);

    await loadResults(1, trimmedQuery, mappedStatus);
  };

  const handlePreviousPage = () => {
    if (page <= 1 || isLoading) {
      return;
    }
    loadResults(page - 1, activeQuery, activeStatus);
  };

  const handleNextPage = () => {
    if (!hasNext || isLoading) {
      return;
    }
    loadResults(page + 1, activeQuery, activeStatus);
  };

  const renderStatusPill = (dialogStatus: DialogStatus) => {
    const presentation = STATUS_PRESENTATION[dialogStatus];
    return (
      <span className={`status-pill ${presentation.className}`}>
        {presentation.label}
      </span>
    );
  };

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
          <select value={status} onChange={(event) => setStatus(event.target.value as UiStatus)}>
            <option value="all">Все</option>
            <option value="open">Открытые</option>
            <option value="scheduled">Запланированные</option>
            <option value="closed">Закрытые</option>
          </select>
        </label>
        <button type="submit" className="primary-button" disabled={isLoading}>
          {isLoading ? "Поиск..." : "Найти"}
        </button>
      </form>

      <div className="search-summary">
        {hasFilters ? "Показаны отфильтрованные результаты" : "Показаны последние взаимодействия"} — найдено
        {" "}
        {hasSearched ? totalResults : 0} записей. Страница {page}.
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Telegram ID</th>
              <th>Непрочитанные</th>
              <th>Ответственный</th>
              <th>Последнее сообщение</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr key={row.id}>
                <td>#{row.id}</td>
                <td>{row.telegram_user_id}</td>
                <td>{row.unread_messages_count}</td>
                <td>{row.assigned_admin?.full_name ?? "Не назначен"}</td>
                <td>{formatDateTime(row.last_message_at) || "—"}</td>
                <td>{renderStatusPill(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="empty-state">Загрузка...</div>}
        {error && !isLoading && <div className="empty-state">{error}</div>}
        {!isLoading && !error && results.length === 0 && hasSearched && (
          <div className="empty-state">Ничего не найдено, уточните запрос.</div>
        )}
      </div>

      {hasSearched && (
        <div>
          <button type="button" onClick={handlePreviousPage} disabled={page <= 1 || isLoading}>
            Назад
          </button>
          <button type="button" onClick={handleNextPage} disabled={!hasNext || isLoading}>
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}
