import type { ReactNode } from "react";
import "./globals.css";

import AppRouterGuard from "../components/AppRouterGuard";
import Providers from "./providers";

export const metadata = {
  title: "Gigaotvet Panel",
  description: "Панель администратора / оператора для ИИ-бота",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <AppRouterGuard>{children}</AppRouterGuard>
        </Providers>
      </body>
    </html>
  );
}
