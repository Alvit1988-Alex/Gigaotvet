import React from "react";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";

import DialogsView from "../src/components/views/DialogsView";
import { server } from "./msw/server";

const mockUseAuth = vi.fn();
const mockUseWSClient = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../contexts/WSClientContext", () => ({
  useWSClient: () => mockUseWSClient(),
}));

const authValue = {
  user: { id: 1, full_name: "Test Admin" },
  isAuthenticated: true,
  isLoading: false,
  setUser: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

function setupListHandlers() {
  const dialogs = [
    {
      id: 101,
      telegram_user_id: 501,
      status: "auto",
      last_message_at: "2024-03-01T10:00:00Z",
      unread_messages_count: 0,
      is_locked: false,
      assigned_admin: null,
    },
    {
      id: 202,
      telegram_user_id: 902,
      status: "wait_operator",
      last_message_at: "2024-03-01T11:00:00Z",
      unread_messages_count: 2,
      is_locked: false,
      assigned_admin: null,
    },
  ];

  server.use(
    http.get("/api/dialogs", () =>
      HttpResponse.json({
        items: dialogs,
        total: dialogs.length,
        page: 1,
        per_page: 20,
        has_next: false,
      }),
    ),
    http.get("/api/dialogs/:id", ({ params }) => {
      const id = Number(params.id);
      const dialog = dialogs.find((item) => item.id === id);
      if (!dialog) {
        return HttpResponse.json({ message: "Not found" }, { status: 404 });
      }
      return HttpResponse.json({
        ...dialog,
        messages: [
          {
            id: id * 10,
            dialog_id: id,
            role: "user",
            content: id === 101 ? "Нужен оператор" : "Подтвердите заказ",
            message_type: "text",
            is_fallback: false,
            used_rag: false,
            ai_reply_during_operator_wait: false,
            created_at: dialog.last_message_at,
          },
        ],
      });
    }),
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue(authValue);
  mockUseWSClient.mockReturnValue({
    subscribe: vi.fn(() => vi.fn()),
  });
});

describe("DialogsView", () => {
  test("loads dialogs, switches selection and sends replies", async () => {
    setupListHandlers();

    const sendResponse = {
      id: 999,
      dialog_id: 202,
      role: "admin" as const,
      content: "Ответ клиенту",
      message_type: "text",
      is_fallback: false,
      used_rag: false,
      ai_reply_during_operator_wait: false,
      created_at: "2024-03-01T12:00:00Z",
    };

    server.use(
      http.post("/api/messages/send", async ({ request }) => {
        const body = (await request.json()) as { content: string };
        if (body.content === "Ответ клиенту") {
          return HttpResponse.json(sendResponse);
        }
        return new HttpResponse(null, { status: 400 });
      }),
    );

    render(<DialogsView />);

    expect(await screen.findByRole("button", { name: /Диалог #101/ })).toBeInTheDocument();
    await screen.findByText("Диалог #101");

    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Диалог #202/ }));
    await screen.findByText("Диалог #202", { selector: ".thread-id" });

    const textarea = await screen.findByPlaceholderText(/Введите ответ/i);
    await user.type(textarea, "Ответ клиенту");
    await user.click(screen.getByRole("button", { name: "Отправить ответ" }));

    await screen.findByText("Ответ клиенту");
    expect(textarea).toHaveValue("");
  });

  test("shows list error and retries loading", async () => {
    let attempt = 0;
    const dialogs = [
      {
        id: 101,
        telegram_user_id: 501,
        status: "auto",
        last_message_at: "2024-03-01T10:00:00Z",
        unread_messages_count: 0,
        is_locked: false,
        assigned_admin: null,
      },
    ];

    server.use(
      http.get("/api/dialogs", () => {
        attempt += 1;
        if (attempt === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({
          items: dialogs,
          total: dialogs.length,
          page: 1,
          per_page: 20,
          has_next: false,
        });
      }),
      http.get("/api/dialogs/:id", () =>
        HttpResponse.json({
          ...dialogs[0],
          messages: [],
        }),
      ),
    );

    const user = userEvent.setup();
    render(<DialogsView />);

    expect(await screen.findByText("Не удалось загрузить диалоги")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Повторить" }));

    await waitFor(() => expect(screen.queryByText("Не удалось загрузить диалоги")).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: /Диалог #101/ })).toBeInTheDocument();
  });

  test("shows error when sending message fails", async () => {
    setupListHandlers();

    server.use(
      http.post("/api/messages/send", () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    render(<DialogsView />);

    const textarea = await screen.findByPlaceholderText(/Введите ответ/i);
    await user.type(textarea, "Ошибка отправки");
    await user.click(screen.getByRole("button", { name: "Отправить ответ" }));

    expect(await screen.findByText("Не удалось отправить сообщение")).toBeInTheDocument();
  });
});
