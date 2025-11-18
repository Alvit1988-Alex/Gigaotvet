export type Admin = {
  id: number;
  full_name: string;
  username?: string | null;
  email?: string | null;
  telegram_id: number;
  is_superadmin: boolean;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LoginIntentResponse = {
  token: string;
  login_url: string | null;
  expires_at: string;
};

export type PendingLoginStatusResponse = {
  status: "pending" | "confirmed" | "success" | "rejected" | "expired";
  admin: Admin | null;
  confirmed_at?: string | null;
};

export type LoginStatus = "pending" | "success" | "rejected" | "expired";

export type NormalizedLoginStatusResponse = {
  status: LoginStatus;
  admin: Admin | null;
  confirmedAt: string | null;
};

export type AuthMeResponse = {
  admin: Admin;
};

export type LogoutResponse = {
  success: boolean;
};
