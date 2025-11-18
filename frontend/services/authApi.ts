import { apiFetch } from "./apiClient";
import type {
  AuthMeResponse,
  LoginIntentResponse,
  LogoutResponse,
  NormalizedLoginStatusResponse,
  PendingLoginStatusResponse,
} from "../types/auth";

const LOGIN_INTENT_PATH = "/api/auth/init";
const LOGIN_STATUS_PATH = "/api/auth/status";
const ME_PATH = "/api/auth/me";
const LOGOUT_PATH = "/api/auth/logout";

function normalizeStatus(status: PendingLoginStatusResponse["status"]): NormalizedLoginStatusResponse["status"] {
  switch (status) {
    case "confirmed":
    case "success":
      return "success";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
}

export async function createLoginIntent(): Promise<LoginIntentResponse> {
  return apiFetch<LoginIntentResponse>(LOGIN_INTENT_PATH, {
    method: "POST",
  });
}

export async function pollLoginStatus(token: string): Promise<NormalizedLoginStatusResponse> {
  const params = new URLSearchParams({ token });
  const raw = await apiFetch<PendingLoginStatusResponse>(`${LOGIN_STATUS_PATH}?${params.toString()}`);
  return {
    status: normalizeStatus(raw.status),
    admin: raw.admin ?? null,
    confirmedAt: raw.confirmed_at ?? null,
  };
}

export async function fetchMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>(ME_PATH);
}

export async function logout(): Promise<LogoutResponse> {
  return apiFetch<LogoutResponse>(LOGOUT_PATH, { method: "POST" });
}
