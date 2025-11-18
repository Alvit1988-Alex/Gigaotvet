import React from "react";
import { render, screen } from "@testing-library/react";

import AppRouterGuard from "../components/AppRouterGuard";

const mockUseAuth = vi.fn();
const replaceMock = vi.fn();
let pathname = "/";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => pathname,
}));

describe("AppRouterGuard", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    pathname = "/";
  });

  test("renders loader during auth initialization", () => {
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
    render(
      <AppRouterGuard>
        <div>content</div>
      </AppRouterGuard>,
    );

    expect(screen.getByText("Проверяем авторизацию…")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test("redirects anonymous users to login", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
    render(
      <AppRouterGuard>
        <div>content</div>
      </AppRouterGuard>,
    );

    expect(screen.getByText("Перенаправляем на страницу входа…")).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });

  test("redirects authenticated users away from /login", () => {
    pathname = "/login";
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });

    render(
      <AppRouterGuard>
        <div>content</div>
      </AppRouterGuard>,
    );

    expect(screen.getByText("Открываем панель…")).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  test("renders children for authorized users on private routes", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
    render(
      <AppRouterGuard>
        <div>Protected content</div>
      </AppRouterGuard>,
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
