"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../contexts/AuthContext";
import { useWSClient } from "../../../contexts/WSClientContext";
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
import type { Admin } from "../../../types/auth";

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

type DialogEventPayload = {
  event?: string;
  dialog_id?: number;
  status?: DialogStatus;
  assigned_admin_id?: number | null;
  unread_messages_count?: number;
  is_locked?: boolean;
  locked_until?: string | null;
  last_message_at?: string | null;
};

type MessageEventPayload = {
  event?: string;
  dialog_id?: number;
  message?: MessageOut;
};

type OperatorEventPayload = {
  event?: string;
  dialog_id?: number;
  assigned_admin?: Admin | null;
};

const NOTIFICATION_PERMISSION_KEY = "gigaotvet.notifications.permission";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeDialogEventPayload(payload: unknown): DialogEventPayload | null {
  if (!isRecord(payload)) {
    return null;
  }
  const dialogId = toNumber(payload.dialog_id);
  return {
    event: typeof payload.event === "string" ? payload.event : undefined,
    dialog_id: dialogId,
    status: typeof payload.status === "string" ? (payload.status as DialogStatus) : undefined,
    assigned_admin_id:
      payload.assigned_admin_id === null
        ? null
        : toNumber(payload.assigned_admin_id) ?? undefined,
    unread_messages_count: toNumber(payload.unread_messages_count),
    is_locked:
      typeof payload.is_locked === "boolean" ? payload.is_locked : undefined,
    locked_until:
      typeof payload.locked_until === "string" || payload.locked_until === null
        ? (payload.locked_until as string | null | undefined)
        : undefined,
    last_message_at:
      typeof payload.last_message_at === "string" || payload.last_message_at === null
        ? (payload.last_message_at as string | null | undefined)
        : undefined,
  };
}

function normalizeMessageEventPayload(payload: unknown): MessageEventPayload | null {
  if (!isRecord(payload)) {
    return null;
  }
  return {
    event: typeof payload.event === "string" ? payload.event : undefined,
    dialog_id: toNumber(payload.dialog_id),
    message: payload.message as MessageOut | undefined,
  };
}

function normalizeOperatorEventPayload(payload: unknown): OperatorEventPayload | null {
  if (!isRecord(payload)) {
    return null;
  }
  return {
    event: typeof payload.event === "string" ? payload.event : undefined,
    dialog_id: toNumber(payload.dialog_id),
    assigned_admin: (payload.assigned_admin as Admin | null | undefined) ?? undefined,
  };
}

function getStoredNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined") {
    return "default";
  }
  const stored = window.localStorage.getItem(NOTIFICATION_PERMISSION_KEY) as NotificationPermission | null;
  if (stored) {
    return stored;
  }
  if (typeof Notification === "undefined") {
    return "denied";
  }
  return Notification.permission;
}

export default function DialogsView() {
  const { user } = useAuth();
  const { subscribe } = useWSClient();
  const [statusFilter, setStatusFilter] = useState<DialogStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [dialogs, setDialogs] = useState<DialogShort[]>([]);
  const [totalDialogs, setTotalDialogs] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(null);
  const [selectedDialog, setSelectedDialog] = useState<DialogDetail | null>(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [isAssigning, setIsAssigning] = useState(false);
  const [isSwitchingAuto, setIsSwitchingAuto] = useState(false);
  const [threadActionError, setThreadActionError] = useState<string | null>(null);

  const [isThreadOpenMobile, setThreadOpenMobile] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    getStoredNotificationPermission,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const listRequestIdRef = useRef(0);
  const dialogRequestIdRef = useRef(0);
  const selectedDialogIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedDialogIdRef.current = selectedDialogId;
  }, [selectedDialogId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!("Notification" in window)) {
      setNotificationPermission("denied");
      window.localStorage.setItem(NOTIFICATION_PERMISSION_KEY, "denied");
      return;
    }
    const stored = window.localStorage.getItem(NOTIFICATION_PERMISSION_KEY) as NotificationPermission | null;
    if (stored) {
      setNotificationPermission(stored);
      return;
    }
    if (Notification.permission !== "default") {
      const permission = Notification.permission;
      setNotificationPermission(permission);
      window.localStorage.setItem(NOTIFICATION_PERMISSION_KEY, permission);
      return;
    }
    let cancelled = false;
    Notification.requestPermission()
      .then((permission) => {
        if (cancelled) {
          return;
        }
        setNotificationPermission(permission);
        window.localStorage.setItem(NOTIFICATION_PERMISSION_KEY, permission);
      })
      .catch((error) => {
        console.error("Не удалось запросить разрешение на уведомления", error);
        setNotificationPermission("denied");
        window.localStorage.setItem(NOTIFICATION_PERMISSION_KEY, "denied");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toastMessage || typeof window === "undefined") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 5000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toastMessage]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const triggerNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (typeof window === "undefined" || !title) {
        return;
      }
      if (!("Notification" in window)) {
        showToast(options?.body ? `${title}: ${options.body}` : title);
        return;
      }
      if (notificationPermission === "granted") {
        try {
          new Notification(title, options);
        } catch (error) {
          console.error("Не удалось показать уведомление", error);
          showToast(options?.body ? `${title}: ${options.body}` : title);
        }
        return;
      }
      showToast(options?.body ? `${title}: ${options.body}` : title);
    },
    [notificationPermission, showToast],
  );

  const loadDialogs = useCallback(async () => {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    setIsListLoading(true);
    setListError(null);
    try {
      const response = await fetchDialogs({
        page,
        status: statusFilter === "all" ? undefined : statusFilter,
        assignedAdminId: assignedOnly && user?.id ? user.id : undefined,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
      });

      if (listRequestIdRef.current !== requestId) {
        return;
      }

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
      if (listRequestIdRef.current !== requestId) {
        return;
      }
      console.error("Не удалось загрузить список диалогов", error);
      setListError("Не удалось загрузить диалоги");
    } finally {
      if (listRequestIdRef.current === requestId) {
        setIsListLoading(false);
      }
    }
  }, [assignedOnly, page, searchQuery, statusFilter, user?.id]);

  useEffect(() => {
    loadDialogs();
  }, [loadDialogs]);

  const loadDialog = useCallback(async (dialogId: number | null) => {
    if (!dialogId) {
      setSelectedDialog(null);
      setDialogError(null);
      setThreadActionError(null);
      return;
    }
    const requestId = dialogRequestIdRef.current + 1;
    dialogRequestIdRef.current = requestId;
    setIsDialogLoading(true);
    setDialogError(null);
    setThreadActionError(null);
    try {
      const response = await fetchDialog(dialogId);
      if (dialogRequestIdRef.current !== requestId) {
        return;
      }
      setSelectedDialog(response);
    } catch (error) {
      if (dialogRequestIdRef.current !== requestId) {
        return;
      }
      console.error("Не удалось загрузить диалог", error);
      setDialogError("Не удалось загрузить выбранный диалог");
    } finally {
      if (dialogRequestIdRef.current === requestId) {
        setIsDialogLoading(false);
        setMessageInput("");
      }
    }
  }, []);

  useEffect(() => {
    loadDialog(selectedDialogId);
  }, [loadDialog, selectedDialogId]);

  const handleMessageEvent = useCallback(
    (payload: unknown) => {
      const data = normalizeMessageEventPayload(payload);
      if (!data?.dialog_id || !data.message) {
        return;
      }
      const { dialog_id: dialogId, message } = data;
      setSelectedDialog((prev) => {
        if (!prev || prev.id !== dialogId) {
          return prev;
        }
        const alreadyExists = prev.messages.some((item) => item.id === message.id);
        if (alreadyExists) {
          return {
            ...prev,
            last_message_at: message.created_at ?? prev.last_message_at,
          };
        }
        return {
          ...prev,
          last_message_at: message.created_at ?? prev.last_message_at,
          messages: [...prev.messages, message],
        };
      });
      setDialogs((prev) =>
        prev.map((dialog) =>
          dialog.id === dialogId
            ? { ...dialog, last_message_at: message.created_at ?? dialog.last_message_at }
            : dialog,
        ),
      );
      if (message.role === "user") {
        const body = message.content?.slice(0, 140) ?? "Новое сообщение";
        triggerNotification(`Новое сообщение в диалоге #${dialogId}`, {
          body,
        });
      }
    },
    [triggerNotification],
  );

  const handleDialogEvent = useCallback(
    (payload: unknown) => {
      const data = normalizeDialogEventPayload(payload);
      if (!data?.dialog_id) {
        return;
      }
      const dialogId = data.dialog_id;
      if (data.event === "dialog.created") {
        triggerNotification(`Создан новый диалог #${dialogId}`);
        loadDialogs();
        return;
      }
      let removal: { removedId: number; fallbackId: number | null } | null = null;
      setDialogs((prev) => {
        const index = prev.findIndex((dialog) => dialog.id === dialogId);
        if (index === -1) {
          return prev;
        }
        const current = prev[index];
        const updated: DialogShort = {
          ...current,
          status: data.status ?? current.status,
          unread_messages_count:
            typeof data.unread_messages_count === "number"
              ? data.unread_messages_count
              : current.unread_messages_count,
          is_locked:
            typeof data.is_locked === "boolean" ? data.is_locked : current.is_locked,
          locked_until:
            data.locked_until !== undefined ? data.locked_until : current.locked_until,
          last_message_at:
            data.last_message_at !== undefined ? data.last_message_at : current.last_message_at,
        };
        if (data.assigned_admin_id !== undefined) {
          if (data.assigned_admin_id === null) {
            updated.assigned_admin = null;
          } else if (current.assigned_admin && current.assigned_admin.id === data.assigned_admin_id) {
            updated.assigned_admin = current.assigned_admin;
          } else if (user && user.id === data.assigned_admin_id) {
            updated.assigned_admin = user;
          } else {
            updated.assigned_admin = null;
          }
        }
        const matchesStatus = statusFilter === "all" || updated.status === statusFilter;
        const matchesAssignment =
          !assignedOnly || (user?.id ? updated.assigned_admin?.id === user.id : false);
        if (!matchesStatus || !matchesAssignment) {
          const filtered = prev.filter((dialog) => dialog.id !== current.id);
          removal = {
            removedId: current.id,
            fallbackId: filtered[0]?.id ?? null,
          };
          return filtered;
        }
        const next = [...prev];
        next[index] = updated;
        return next;
      });

      setSelectedDialog((prev) => {
        if (!prev || prev.id !== dialogId) {
          return prev;
        }
        const updated: DialogDetail = {
          ...prev,
          status: data.status ?? prev.status,
          unread_messages_count:
            typeof data.unread_messages_count === "number"
              ? data.unread_messages_count
              : prev.unread_messages_count,
          is_locked: typeof data.is_locked === "boolean" ? data.is_locked : prev.is_locked,
          locked_until: data.locked_until ?? prev.locked_until,
          last_message_at: data.last_message_at ?? prev.last_message_at,
        };
        if (data.assigned_admin_id !== undefined) {
          if (data.assigned_admin_id === null) {
            updated.assigned_admin = null;
          } else if (prev.assigned_admin && prev.assigned_admin.id === data.assigned_admin_id) {
            updated.assigned_admin = prev.assigned_admin;
          } else if (user && user.id === data.assigned_admin_id) {
            updated.assigned_admin = user;
          } else {
            updated.assigned_admin = null;
          }
        }
        return updated;
      });

      if (removal) {
        const wasSelected = removal.removedId === selectedDialogIdRef.current;
        if (wasSelected) {
          setSelectedDialog(null);
          setDialogError(null);
          setThreadActionError(null);
          setMessageInput("");
          setSelectedDialogId(removal.fallbackId);
        }
        loadDialogs();
      }
    },
    [assignedOnly, loadDialogs, statusFilter, triggerNotification, user],
  );

  const handleOperatorEvent = useCallback((payload: unknown) => {
    const data = normalizeOperatorEventPayload(payload);
    if (!data?.dialog_id || data.assigned_admin === undefined) {
      return;
    }
    const dialogId = data.dialog_id;
    setDialogs((prev) =>
      prev.map((dialog) =>
        dialog.id === dialogId ? { ...dialog, assigned_admin: data.assigned_admin } : dialog,
      ),
    );
    setSelectedDialog((prev) => {
      if (!prev || prev.id !== dialogId) {
        return prev;
      }
      return {
        ...prev,
        assigned_admin: data.assigned_admin ?? null,
      };
    });
  }, []);

  useEffect(() => {
    const unsubscribeMessages = subscribe("messages", handleMessageEvent);
    const unsubscribeDialogs = subscribe("dialogs", handleDialogEvent);
    const unsubscribeOperators = subscribe("operators", handleOperatorEvent);
    return () => {
      unsubscribeMessages();
      unsubscribeDialogs();
      unsubscribeOperators();
    };
  }, [handleDialogEvent, handleMessageEvent, handleOperatorEvent, subscribe]);

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
    loadDialogs();
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
    <>
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
              onClick={() => loadDialog(selectedDialogId)}
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
      {toastMessage && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className="toast">{toastMessage}</div>
        </div>
      )}
    </>
  );
}
