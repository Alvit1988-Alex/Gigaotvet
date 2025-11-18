import type { ReactNode } from "react";
import "../styles/globals.css";
import { ThemeProvider } from "../contexts/ThemeContext";
import Providers from "./providers";
import AppRouterGuard from "../components/AppRouterGuard";

export const metadata = {
  title: "Gigaotvet Panel",
  description: "Панель администратора / оператора для ИИ-бота",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="app-body-root">
        <ThemeProvider>
          <Providers>
            <AppRouterGuard>{children}</AppRouterGuard>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
