import type { ReactNode } from "react";
import "../styles/globals.css";
import { ThemeProvider } from "../contexts/ThemeContext";

export const metadata = {
  title: "Gigaotvet Panel",
  description: "Панель администратора / оператора для ИИ-бота",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="app-body-root">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
