"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "../../../contexts/AuthContext";
import {
  assignDialog,
  fetchDialog,
  fetchDialogs,
  switchDialogAuto,
  type DialogDetail,
  type DialogShort,
  type DialogStatus,
} from "../../../services/dialogsApi";
import { sendMessage } from "../../../services/messagesApi";
import type { MessageOut } from "../../../services/messagesApi";

const STATUS_LABEL: Record<DialogStatus, string> = {
  auto: "Автоматические",
  wait_operator: "Ожидают оператора",
  wait_user: "Ожидают клиента",
};

const STATUS_CLASS: Record<DialogStatus, string> = {
  auto: "status-new",
  wait_operator: "status-waiting",
  wait_user: "status-resolved",
};

function formatTime(dateString?: string | null) {
  if (!dateString) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));
  } catch {
    return "";
  }
}

function formatDate(dateString?: string | null) {
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

function getMessageRoleLabel(message: MessageOut) {
  if (message.sender_name) {
    return message.sender_name;
  }

  switch (message.role) {
    case "ai":
      return "ИИ";
    case "admin":
      return "Оператор";
    default:
      return "Клиент";
  }
}

function getMessageRoleClass(message: MessageOut) {
  if (message.role === "admin") {
    return "operator";
  }
  if (message.role === "ai") {
    return "bot";
  }
  return "client";
}

export default function DialogsView() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<DialogStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [dialogs, setDialogs] = useState<DialogShort[]>([]);
  const [totalDialogs, setTotalDialogs] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listRefreshCounter, setListRefreshCounter] = useState(0);

  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(null);
  const [selectedDialog, setSelectedDialog] = useState<DialogDetail | null>(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogRefreshCounter, setDialogRefreshCounter] = useState(0);

  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [isAssigning, setIsAssigning] = useState(false);
  const [isSwitchingAuto, setIsSwitchingAuto] = useState(false);
  const [threadActionError, setThreadActionError] = useState<string | null>(null);

  const [isThreadOpenMobile, setThreadOpenMobile] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    async function loadDialogs() {
      setIsListLoading(true);
      setListError(null);
      try {
        const response = await fetchDialogs({
          page,
          status: statusFilter === "all" ? undefined : statusFilter,
          assignedAdminId: assignedOnly && user?.id ? user.id : undefined,
          search: searchQuery.trim() ? searchQuery.trim() : undefined,
        });

        if (isCancelled) return;

        setDialogs(response.items);
        setTotalDialogs(response.total);
        setHasNextPage(response.has_next);

        if (response.items.length === 0) {
          setSelectedDialog(null);
          setSelectedDialogId(null);
          setMessageInput("");
          setThreadActionError(null);
        } else {
          setSelectedDialogId((currentSelectedId) => {
            if (
              currentSelectedId &&
              response.items.some((dialog) => dialog.id === currentSelectedId)
            ) {
              return currentSelectedId;
            }
            return response.items[0].id;
          });
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Не удалось загрузить список диалогов", error);
          setListError("Не удалось загрузить диалоги");
        }
      } finally {
        if (!isCancelled) {
          setIsListLoading(false);
        }
      }
    }

    loadDialogs();

    return () => {
      isCancelled = true;
    };
  }, [statusFilter, assignedOnly, searchQuery, page, user?.id, listRefreshCounter]);

  useEffect(() => {
    if (!selectedDialogId) {
      setSelectedDialog(null);
      setDialogError(null);
      setThreadActionError(null);
      return;
    }

    let isCancelled = false;

    async function loadDialog() {
      setIsDialogLoading(true);
      setDialogError(null);
      setThreadActionError(null);
      try {
        const response = await fetchDialog(selectedDialogId);
        if (!isCancelled) {
          setSelectedDialog(response);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Не удалось загрузить диалог", error);
          setDialogError("Не удалось загрузить выбранный диалог");
        }
      } finally {
        if (!isCancelled) {
          setIsDialogLoading(false);
          setMessageInput("");
        }
      }
    }

    loadDialog();

    return () => {
      isCancelled = true;
    };
  }, [selectedDialogId, dialogRefreshCounter]);

  const handleStatusChange = (nextStatus: DialogStatus | "all") => {
    setStatusFilter(nextStatus);
    setPage(1);
  };

  const handleAssignedOnlyChange = (value: boolean) => {
    setAssignedOnly(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDialog) return;
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage) return;

    setIsSending(true);
    setSendError(null);
    setThreadActionError(null);
    const currentDialogId = selectedDialog.id;

    try {
      const message = await sendMessage(currentDialogId, trimmedMessage);
      setSelectedDialog((prev) =>
        prev && prev.id === currentDialogId ? { ...prev, messages: [...prev.messages, message] } : prev,
      );
      setDialogs((prev) =>
        prev.map((dialog) =>
          dialog.id === currentDialogId
            ? {
                ...dialog,
                unread_messages_count: 0,
                last_message_at: message.created_at ?? dialog.last_message_at,
              }
            : dialog,
        ),
      );
      setMessageInput("");
    } catch (error) {
      console.error("Не удалось отправить сообщение", error);
      setSendError("Не удалось отправить сообщение");
    } finally {
      setIsSending(false);
    }
  };

  const handleAssignDialog = async () => {
    if (!selectedDialog || !user?.id) return;
    const currentDialogId = selectedDialog.id;
    setIsAssigning(true);
    setThreadActionError(null);
    try {
      const updatedDialog = await assignDialog(currentDialogId, user.id);
      setSelectedDialog((prev) => (prev && prev.id === currentDialogId ? updatedDialog : prev));
      setDialogs((prev) =>
        prev.map((dialog) =>
          dialog.id === updatedDialog.id
            ? {
                ...dialog,
                status: updatedDialog.status,
                unread_messages_count: updatedDialog.unread_messages_count,
                is_locked: updatedDialog.is_locked,
                locked_until: updatedDialog.locked_until,
                assigned_admin: updatedDialog.assigned_admin,
              }
            : dialog,
        ),
      );
    } catch (error) {
      console.error("Не удалось взять диалог в работу", error);
      setThreadActionError("Не удалось взять диалог в работу");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSwitchAuto = async () => {
    if (!selectedDialog) return;
    const currentDialogId = selectedDialog.id;
    setIsSwitchingAuto(true);
    setThreadActionError(null);
    try {
      const response = await switchDialogAuto(currentDialogId);
      setSelectedDialog((prev) =>
        prev && prev.id === currentDialogId
          ? {
              ...prev,
              status: response.status,
              assigned_admin: response.status === "auto" ? null : prev.assigned_admin,
            }
          : prev,
      );
      setDialogs((prev) =>
        prev.map((dialog) =>
          dialog.id === currentDialogId
            ? {
                ...dialog,
                status: response.status,
                assigned_admin: response.status === "auto" ? null : dialog.assigned_admin,
              }
            : dialog,
        ),
      );
    } catch (error) {
      console.error("Не удалось переключить режим диалога", error);
      setThreadActionError("Не удалось переключить режим диалога");
    } finally {
      setIsSwitchingAuto(false);
    }
  };

  const handleRetryDialogs = () => {
    setListRefreshCounter((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <div className={`dialogs-view ${isThreadOpenMobile ? "dialogs-view-thread-open" : ""}`}>
      <div className="dialogs-panel">
        <div className="panel-heading">
          <h3>Диалоги</h3>
          <div className="status-tabs" role="tablist">
            <button
              type="button"
              className={`status-tab ${statusFilter === "all" ? "status-tab-active" : ""}`}
              onClick={() => handleStatusChange("all")}
            >
              Все ({totalDialogs})
            </button>
            {(Object.keys(STATUS_LABEL) as DialogStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                className={`status-tab ${statusFilter === status ? "status-tab-active" : ""}`}
                onClick={() => handleStatusChange(status)}
              >
                {STATUS_LABEL[status]}
              </button>
            ))}
          </div>
          <div className="panel-filters">
            <input
              type="search"
              placeholder="Поиск по ID или пользователю"
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={assignedOnly}
                onChange={(event) => handleAssignedOnlyChange(event.target.checked)}
                disabled={!user}
              />
              <span>Только мои</span>
            </label>
          </div>
        </div>
        <div className="dialogs-list" aria-live="polite">
          {isListLoading && dialogs.length === 0 ? (
            <div className="loading-state">
              <p>Загружаем диалоги...</p>
            </div>
          ) : listError ? (
            <div className="error-state">
              <p>{listError}</p>
              <button type="button" className="ghost-button" onClick={handleRetryDialogs}>
                Повторить
              </button>
            </div>
          ) : dialogs.length === 0 ? (
            <div className="empty-state">
              <p>Нет диалогов для выбранных фильтров.</p>
            </div>
          ) : (
            dialogs.map((dialog) => (
              <button
                type="button"
                key={dialog.id}
                className={`dialog-card ${selectedDialogId === dialog.id ? "dialog-card-active" : ""}`}
                onClick={() => {
                  setSelectedDialogId(dialog.id);
                  setThreadOpenMobile(true);
                }}
              >
                <div className="dialog-card-row">
                  <strong>Диалог #{dialog.id}</strong>
                  <span className={`status-pill ${STATUS_CLASS[dialog.status]}`}>
                    {STATUS_LABEL[dialog.status]}
                  </span>
                </div>
                <div className="dialog-card-row">
                  <small className="text-muted">Пользователь #{dialog.telegram_user_id}</small>
                  {dialog.unread_messages_count > 0 && <span className="badge">+{dialog.unread_messages_count}</span>}
                </div>
                {dialog.assigned_admin && (
                  <div className="dialog-card-row">
                    <small className="text-muted">Назначен: {dialog.assigned_admin.full_name}</small>
                  </div>
                )}
                <p>Обновлён {formatDate(dialog.last_message_at) || "нет данных"}</p>
              </button>
            ))
          )}
        </div>
        <div className="pagination-controls">
          <button type="button" className="ghost-button" onClick={handlePrevPage} disabled={page <= 1}>
            Назад
          </button>
          <span className="text-muted">Страница {page}</span>
          <button type="button" className="ghost-button" onClick={handleNextPage} disabled={!hasNextPage}>
            Вперёд
          </button>
        </div>
      </div>

      <div className="dialog-thread" aria-live="polite">
        {isDialogLoading ? (
          <div className="loading-state">
            <p>Загружаем диалог...</p>
          </div>
        ) : dialogError ? (
          <div className="error-state">
            <p>{dialogError}</p>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setDialogRefreshCounter((prev) => prev + 1)}
            >
              Повторить
            </button>
          </div>
        ) : !selectedDialog ? (
          <div className="empty-state">
            <p>Выберите диалог из списка слева.</p>
          </div>
        ) : (
          <>
            <div className="thread-heading">
              <div>
                <div className="thread-id">Диалог #{selectedDialog.id}</div>
                <div className="thread-client">Пользователь #{selectedDialog.telegram_user_id}</div>
                <div className="thread-meta">
                  <span className={`status-pill ${STATUS_CLASS[selectedDialog.status]}`}>
                    {STATUS_LABEL[selectedDialog.status]}
                  </span>
                  <small className="text-muted">
                    {selectedDialog.assigned_admin
                      ? `Оператор: ${selectedDialog.assigned_admin.full_name}`
                      : "Без оператора"}
                  </small>
                </div>
              </div>
              <div className="thread-actions">
                <button type="button" className="ghost-button" onClick={() => setThreadOpenMobile(false)}>
                  Список
                </button>
                <button type="button" className="ghost-button" onClick={handleSwitchAuto} disabled={isSwitchingAuto}>
                  {selectedDialog.status === "auto" ? "Забрать" : "Вернуть"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleAssignDialog}
                  disabled={!user || isAssigning}
                >
                  Взять в работу
                </button>
              </div>
            </div>
            {threadActionError && (
              <div className="error-state">
                <p>{threadActionError}</p>
              </div>
            )}
            <div className="message-list">
              {selectedDialog.messages.length === 0 ? (
                <div className="empty-state">
                  <p>Сообщений пока нет.</p>
                </div>
              ) : (
                selectedDialog.messages.map((message) => (
                  <div key={message.id} className={`message message-${getMessageRoleClass(message)}`}>
                    <div className="message-meta">
                      <span>{getMessageRoleLabel(message)}</span>
                      <small>{formatTime(message.created_at)}</small>
                    </div>
                    <p>{message.content}</p>
                  </div>
                ))
              )}
            </div>
            <form className="thread-reply" onSubmit={handleSendMessage}>
              <textarea
                rows={3}
                placeholder="Введите ответ оператору или клиенту"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                disabled={isSending}
              />
              {sendError && (
                <div className="error-state">
                  <p>{sendError}</p>
                </div>
              )}
              <div className="thread-reply-actions">
                <label className="checkbox-field">
                  <input type="checkbox" defaultChecked />
                  <span>Отправить копию в CRM</span>
                </label>
                <button type="submit" className="primary-button" disabled={isSending || !messageInput.trim()}>
                  {isSending ? "Отправляем..." : "Отправить ответ"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
