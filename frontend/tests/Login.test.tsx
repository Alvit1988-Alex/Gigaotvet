import React from "react";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { act, render, screen, waitFor } from "@testing-library/react";

import LoginPage from "../app/login/page";
import { server } from "./msw/server";

const mockUseAuth = vi.fn();
const replaceMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("polls login status and redirects on success", async () => {
    vi.useFakeTimers();
    const refreshUser = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      refreshUser,
      isAuthenticated: false,
      isLoading: false,
    });

    let pollCount = 0;
    server.use(
      http.post("/api/auth/init", () =>
        HttpResponse.json({
          token: "abc",
          login_url: "https://t.me/giga",
          expires_at: "2024-03-01T12:00:00Z",
        }),
      ),
      http.get("/api/auth/status", () => {
        pollCount += 1;
        if (pollCount === 1) {
          return HttpResponse.json({
            status: "pending",
            admin: null,
            confirmed_at: null,
          });
        }
        return HttpResponse.json({
          status: "success",
          admin: { id: 1, full_name: "Test" },
          confirmed_at: "2024-03-01T12:01:00Z",
        });
      }),
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Авторизоваться через Telegram" }));
    expect(await screen.findByText("Ждём подтверждения")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(await screen.findByText("Авторизация подтверждена")).toBeInTheDocument();

    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/");

    await user.click(screen.getByRole("button", { name: "Открыть в Telegram" }));
    expect(window.open).toHaveBeenCalledWith("https://t.me/giga", "_blank", "noopener,noreferrer");
  }, 10000);

  test("surfaces rejection errors", async () => {
    const refreshUser = vi.fn();
    mockUseAuth.mockReturnValue({
      refreshUser,
      isAuthenticated: false,
      isLoading: false,
    });

    server.use(
      http.post("/api/auth/init", () =>
        HttpResponse.json({
          token: "abc",
          login_url: "https://t.me/giga",
          expires_at: "2024-03-01T12:00:00Z",
        }),
      ),
      http.get("/api/auth/status", () =>
        HttpResponse.json({
          status: "rejected",
          admin: null,
          confirmed_at: null,
        }),
      ),
    );

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Авторизоваться через Telegram" }));

    expect(await screen.findByText("В доступе отказано")).toBeInTheDocument();
    expect(await screen.findByText("Аккаунт не был подтверждён. Попробуйте снова.")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(refreshUser).not.toHaveBeenCalled();
  }, 10000);
});
