"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchMe, logout as logoutRequest } from "../services/authApi";
import { UnauthorizedError } from "../services/apiClient";
import type { Admin } from "../types/auth";

export type AuthContextValue = {
  user: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: Admin | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((next: Admin | null) => {
    setUserState(next);
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchMe();
      setUserState(response.admin);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        setUserState(null);
      } else {
        console.error("Не удалось загрузить профиль", error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        console.error("Не удалось выйти", error);
      }
    } finally {
      setUserState(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      setUser,
      logout,
      refreshUser,
    }),
    [user, isLoading, setUser, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }
  return context;
}
