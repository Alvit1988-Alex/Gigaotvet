"use client";

import { useMemo, useState } from "react";

type DialogStatus = "new" | "waiting" | "resolved";

type Dialog = {
  id: string;
  client: string;
  channel: "telegram" | "vk" | "site";
  status: DialogStatus;
  unread: number;
  lastMessage: string;
  priority: "low" | "medium" | "high";
  tags: string[];
  messages: Array<{
    id: string;
    author: "bot" | "operator" | "client";
    text: string;
    time: string;
  }>;
};

const DIALOGS: Dialog[] = [
  {
    id: "DLG-1031",
    client: 'ООО "Эко-Маркет"',
    channel: "telegram",
    status: "new",
    unread: 3,
    lastMessage: "Пришлите акты и сроки поставки",
    priority: "high",
    tags: ["B2B", "срочно"],
    messages: [
      {
        id: "1",
        author: "client",
        text: "Здравствуйте! Нужен актуальный статус заказа #451",
        time: "10:07",
      },
      {
        id: "2",
        author: "operator",
        text: "Проверяем информацию у склада",
        time: "10:09",
      },
      {
        id: "3",
        author: "client",
        text: "Пришлите акты и сроки поставки",
        time: "10:11",
      },
    ],
  },
  {
    id: "DLG-1030",
    client: "Роман Куприянов",
    channel: "vk",
    status: "waiting",
    unread: 0,
    lastMessage: "Спасибо, жду",
    priority: "medium",
    tags: ["retail"],
    messages: [
      {
        id: "1",
        author: "client",
        text: "Есть ли свободные места на доставку завтра?",
        time: "09:38",
      },
      {
        id: "2",
        author: "operator",
        text: "Да, можем поставить в 14:00",
        time: "09:40",
      },
      {
        id: "3",
        author: "client",
        text: "Спасибо, жду",
        time: "09:42",
      },
    ],
  },
  {
    id: "DLG-1028",
    client: "Клавдия Веретенникова",
    channel: "site",
    status: "resolved",
    unread: 0,
    lastMessage: "Готово, закрыла задачу",
    priority: "low",
    tags: ["NPS"],
    messages: [
      {
        id: "1",
        author: "operator",
        text: "Обновили адрес доставки, проверьте",
        time: "08:15",
      },
    ],
  },
];

const STATUS_LABEL: Record<DialogStatus, string> = {
  new: "Новые",
  waiting: "В ожидании",
  resolved: "Закрытые",
};

export default function DialogsView() {
  const [statusFilter, setStatusFilter] = useState<DialogStatus | "all">("all");
  const [selectedDialogId, setSelectedDialogId] = useState<string>(DIALOGS[0]?.id ?? "");
  const [isThreadOpenMobile, setThreadOpenMobile] = useState(false);

  const filteredDialogs = useMemo(() => {
    if (statusFilter === "all") return DIALOGS;
    return DIALOGS.filter((dialog) => dialog.status === statusFilter);
  }, [statusFilter]);

  const selectedDialog = filteredDialogs.find((dialog) => dialog.id === selectedDialogId)
    ?? filteredDialogs[0];

  return (
    <div className={`dialogs-view ${isThreadOpenMobile ? "dialogs-view-thread-open" : ""}`}>
      <div className="dialogs-panel">
        <div className="panel-heading">
          <h3>Диалоги</h3>
          <div className="status-tabs" role="tablist">
            <button
              type="button"
              className={`status-tab ${statusFilter === "all" ? "status-tab-active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              Все ({DIALOGS.length})
            </button>
            {(Object.keys(STATUS_LABEL) as DialogStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                className={`status-tab ${statusFilter === status ? "status-tab-active" : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {STATUS_LABEL[status]}
              </button>
            ))}
          </div>
        </div>
        <div className="dialogs-list">
          {filteredDialogs.map((dialog) => (
            <button
              type="button"
              key={dialog.id}
              className={`dialog-card ${selectedDialog?.id === dialog.id ? "dialog-card-active" : ""}`}
              onClick={() => {
                setSelectedDialogId(dialog.id);
                setThreadOpenMobile(true);
              }}
            >
              <div className="dialog-card-row">
                <strong>{dialog.client}</strong>
                <span className={`status-pill status-${dialog.status}`}>{STATUS_LABEL[dialog.status]}</span>
              </div>
              <div className="dialog-card-row">
                <small className="text-muted">{dialog.id}</small>
                {dialog.unread > 0 && <span className="badge">+{dialog.unread}</span>}
              </div>
              <p>{dialog.lastMessage}</p>
              <div className="dialog-tags">
                {dialog.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="dialog-thread" aria-live="polite">
        {selectedDialog ? (
          <>
            <div className="thread-heading">
              <div>
                <div className="thread-id">{selectedDialog.id}</div>
                <div className="thread-client">{selectedDialog.client}</div>
              </div>
              <div className="thread-actions">
                <button type="button" className="ghost-button" onClick={() => setThreadOpenMobile(false)}>
                  Список
                </button>
                <button type="button" className="ghost-button">
                  История
                </button>
                <button type="button" className="primary-button">
                  Ответить
                </button>
              </div>
            </div>
            <div className="message-list">
              {selectedDialog.messages.map((message) => (
                <div key={message.id} className={`message message-${message.author}`}>
                  <div className="message-meta">
                    <span>{message.author === "client" ? "Клиент" : message.author === "bot" ? "Бот" : "Оператор"}</span>
                    <small>{message.time}</small>
                  </div>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
            <form className="thread-reply" onSubmit={(event) => event.preventDefault()}>
              <textarea rows={3} placeholder="Введите ответ оператору или клиенту" />
              <div className="thread-reply-actions">
                <label className="checkbox-field">
                  <input type="checkbox" defaultChecked />
                  <span>Отправить копию в CRM</span>
                </label>
                <button type="submit" className="primary-button">
                  Отправить ответ
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="empty-state">
            <p>Нет доступных диалогов для выбранного фильтра.</p>
          </div>
        )}
      </div>
    </div>
  );
}
