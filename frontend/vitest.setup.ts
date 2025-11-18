import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import "@testing-library/jest-dom/vitest";

import { server } from "./tests/msw/server";

class MockNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn(async () => {
    MockNotification.permission = "granted";
    return "granted" as NotificationPermission;
  });

  constructor(public title: string, public options?: NotificationOptions) {
    // eslint-disable-next-line no-console
    if (!title) {
      throw new Error("Notification title is required");
    }
  }
}

Object.defineProperty(global, "Notification", {
  value: MockNotification,
  writable: true,
});

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return React.createElement("img", props);
  },
}));

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  if (typeof window !== "undefined") {
    window.open = vi.fn();
  }
});
