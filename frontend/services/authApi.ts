import { apiFetch } from "./apiClient";
import type {
  AuthMeResponse,
  LoginIntentResponse,
  LogoutResponse,
  NormalizedLoginStatusResponse,
  PendingLoginStatusResponse,
} from "../types/auth";

const LOGIN_INTENT_PATH = "/api/auth/login-intent";
const LOGIN_STATUS_PATH = "/auth/status";
const ME_PATH = "/auth/me";
const LOGOUT_PATH = "/auth/logout";

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

export async function getLoginStatus(token: string): Promise<NormalizedLoginStatusResponse> {
  const params = new URLSearchParams({ token });
  const raw = await apiFetch<PendingLoginStatusResponse>(`${LOGIN_STATUS_PATH}?${params.toString()}`);
  return {
    status: normalizeStatus(raw.status),
    admin: raw.admin ?? null,
    confirmedAt: raw.confirmed_at ?? null,
  };
}

export async function getCurrentUser(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>(ME_PATH);
}

export async function logout(): Promise<LogoutResponse> {
  return apiFetch<LogoutResponse>(LOGOUT_PATH, { method: "POST" });
}
