import { apiFetch } from "./apiClient";
import type { Admin } from "../types/auth";
import type { MessageOut } from "./messagesApi";

const DIALOGS_PATH = "/api/dialogs";

export type DialogStatus = "auto" | "wait_operator" | "wait_user";

export type DialogShort = {
  id: number;
  telegram_user_id: number;
  status: DialogStatus;
  last_message_at?: string | null;
  unread_messages_count: number;
  is_locked: boolean;
  locked_until?: string | null;
  assigned_admin?: Admin | null;
  waiting_time_seconds?: number | null;
};

export type DialogDetail = DialogShort & {
  messages: MessageOut[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type DialogListResponse = {
  items: DialogShort[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
};

export type DialogSwitchAutoResponse = {
  dialog_id: number;
  status: DialogStatus;
};

export type FetchDialogsParams = {
  page?: number;
  perPage?: number;
  status?: DialogStatus;
  assignedAdminId?: number;
  search?: string;
};

export async function fetchDialogs(params: FetchDialogsParams = {}): Promise<DialogListResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set("page", params.page.toString());
  }
  if (params.perPage) {
    searchParams.set("per_page", params.perPage.toString());
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.assignedAdminId) {
    searchParams.set("assigned_admin_id", params.assignedAdminId.toString());
  }
  if (params.search) {
    searchParams.set("search", params.search);
  }

  const queryString = searchParams.toString();
  const url = queryString ? `${DIALOGS_PATH}?${queryString}` : DIALOGS_PATH;

  return apiFetch<DialogListResponse>(url);
}

export async function fetchDialog(dialogId: number): Promise<DialogDetail> {
  return apiFetch<DialogDetail>(`${DIALOGS_PATH}/${dialogId}`);
}

export async function assignDialog(dialogId: number, adminId?: number | null): Promise<DialogDetail> {
  return apiFetch<DialogDetail>(`${DIALOGS_PATH}/${dialogId}/assign`, {
    method: "POST",
    body: JSON.stringify({ admin_id: adminId ?? null }),
  });
}

export async function switchDialogAuto(dialogId: number): Promise<DialogSwitchAutoResponse> {
  return apiFetch<DialogSwitchAutoResponse>(`${DIALOGS_PATH}/${dialogId}/switch_auto`, {
    method: "POST",
  });
}
