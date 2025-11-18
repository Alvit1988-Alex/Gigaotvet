import { apiFetch } from "./apiClient";

const MESSAGES_PATH = "/api/messages";

export type MessageRole = "user" | "ai" | "admin";

export type MessageOut = {
  id: number;
  dialog_id: number;
  role: MessageRole;
  sender_id?: string | null;
  sender_name?: string | null;
  content: string;
  attachments?: string | null;
  message_type: string;
  metadata_json?: Record<string, unknown> | null;
  is_fallback: boolean;
  used_rag: boolean;
  ai_reply_during_operator_wait: boolean;
  created_at?: string | null;
};

export async function sendMessage(dialogId: number, content: string): Promise<MessageOut> {
  return apiFetch<MessageOut>(`${MESSAGES_PATH}/send`, {
    method: "POST",
    body: JSON.stringify({ dialog_id: dialogId, content }),
  });
}
