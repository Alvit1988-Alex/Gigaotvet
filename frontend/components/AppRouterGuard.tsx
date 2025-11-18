"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "../contexts/AuthContext";

const PUBLIC_ROUTES = new Set(["/login"]);

export default function AppRouterGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && pathname === "/login") {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, isPublicRoute, pathname, router]);

  if (isLoading) {
    return <GuardLoader message="Проверяем авторизацию…" />;
  }

  if (!isAuthenticated && !isPublicRoute) {
    return <GuardLoader message="Перенаправляем на страницу входа…" />;
  }

  if (isAuthenticated && pathname === "/login") {
    return <GuardLoader message="Открываем панель…" />;
  }

  return <>{children}</>;
}

function GuardLoader({ message }: { message: string }) {
  return (
    <div className="app-shell">
      <main className="app-content">
        <p className="muted-text">{message}</p>
      </main>
    </div>
  );
}
