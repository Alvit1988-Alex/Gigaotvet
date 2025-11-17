import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Gigaotvet Panel",
  description: "Панель администратора / оператора для ИИ-бота",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
