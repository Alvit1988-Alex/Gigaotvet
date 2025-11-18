"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, type ReactNode } from "react";

import { useAuth } from "../contexts/AuthContext";

const PUBLIC_ROUTES = ["/login"];

export default function AppRouterGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
    } else if (isAuthenticated && pathname === "/login") {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, isPublicRoute, pathname, router]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [logout, router]);

  const showLoader = !isPublicRoute && (isLoading || !isAuthenticated);

  return (
    <div className="app-shell">
      {isAuthenticated && (
        <header className="app-header">
          <div className="app-header__info">
            <p className="app-header__caption">Вы вошли как</p>
            <div className="app-header__user">
              <strong>{user?.full_name}</strong>
              {user?.username && <span className="app-header__username">@{user.username}</span>}
            </div>
          </div>
          <button type="button" className="link-button" onClick={handleLogout}>
            Выйти
          </button>
        </header>
      )}
      <main className="app-content">
        {showLoader ? <p className="muted-text">Проверяем авторизацию…</p> : children}
      </main>
    </div>
  );
}
