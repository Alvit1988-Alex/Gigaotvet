import type { AuthContextValue } from "../../contexts/AuthContext";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const ACCESS_COOKIE_NAME = "access_token";
const PING_INTERVAL = 20_000;
const INITIAL_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_DELAY = 30_000;

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export type ChannelMessageHandler = (payload: unknown) => void;
export type ChannelStatusHandler = (status: ConnectionStatus) => void;

const isBrowser = typeof window !== "undefined";

function readCookie(name: string): string | null {
  if (!isBrowser) {
    return null;
  }
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.split("=");
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
}

function normalizeChannel(channel: string): string {
  return channel.replace(/^\/+/, "");
}

function isUnauthorizedClose(event: CloseEvent): boolean {
  if (event.code === 4401 || event.code === 4403) {
    return true;
  }
  if (event.code === 1008) {
    return /token|auth/i.test(event.reason ?? "");
  }
  return false;
}

type ChannelState = {
  socket: WebSocket | null;
  listeners: Set<ChannelMessageHandler>;
  statusListeners: Set<ChannelStatusHandler>;
  reconnectAttempts: number;
  reconnectTimeoutId: ReturnType<typeof setTimeout> | null;
  pingIntervalId: ReturnType<typeof setInterval> | null;
  status: ConnectionStatus;
  shouldReconnect: boolean;
};

export type WSClientOptions = {
  auth?: Pick<AuthContextValue, "refreshUser" | "logout">;
};

export class WSClient {
  private readonly baseUrl: string;
  private auth?: Pick<AuthContextValue, "refreshUser" | "logout">;
  private readonly channels = new Map<string, ChannelState>();

  constructor(options: WSClientOptions = {}) {
    this.baseUrl = API_BASE_URL || (isBrowser ? window.location.origin : "");
    this.auth = options.auth;
  }

  public attachAuth(auth: Pick<AuthContextValue, "refreshUser" | "logout">): void {
    this.auth = auth;
  }

  public subscribe(channel: string, handler: ChannelMessageHandler): () => void {
    if (!isBrowser) {
      return () => undefined;
    }
    const normalizedChannel = normalizeChannel(channel);
    const state = this.ensureState(normalizedChannel);
    state.listeners.add(handler);
    state.shouldReconnect = true;
    this.connect(normalizedChannel);
    return () => {
      this.unsubscribe(normalizedChannel, handler);
    };
  }

  public unsubscribe(channel: string, handler?: ChannelMessageHandler): void {
    const normalizedChannel = normalizeChannel(channel);
    const state = this.channels.get(normalizedChannel);
    if (!state) {
      return;
    }
    if (handler) {
      state.listeners.delete(handler);
    } else {
      state.listeners.clear();
    }

    if (state.listeners.size === 0) {
      this.closeChannel(normalizedChannel);
    }
  }

  public onStatus(channel: string, handler: ChannelStatusHandler): () => void {
    if (!isBrowser) {
      return () => undefined;
    }
    const normalizedChannel = normalizeChannel(channel);
    const state = this.ensureState(normalizedChannel);
    state.statusListeners.add(handler);
    handler(state.status);
    return () => {
      this.offStatus(normalizedChannel, handler);
    };
  }

  public offStatus(channel: string, handler: ChannelStatusHandler): void {
    const normalizedChannel = normalizeChannel(channel);
    const state = this.channels.get(normalizedChannel);
    if (!state) {
      return;
    }
    state.statusListeners.delete(handler);
    if (state.listeners.size === 0 && state.statusListeners.size === 0) {
      this.closeChannel(normalizedChannel);
    }
  }

  public closeAll(): void {
    for (const channel of [...this.channels.keys()]) {
      this.closeChannel(channel);
    }
  }

  public handleLogout(): void {
    this.closeAll();
  }

  private ensureState(channel: string): ChannelState {
    let state = this.channels.get(channel);
    if (!state) {
      state = {
        socket: null,
        listeners: new Set(),
        statusListeners: new Set(),
        reconnectAttempts: 0,
        reconnectTimeoutId: null,
        pingIntervalId: null,
        status: "idle",
        shouldReconnect: false,
      };
      this.channels.set(channel, state);
    }
    return state;
  }

  private buildUrl(channel: string): string {
    const fallback = isBrowser ? window.location.origin : "http://localhost";
    const base = (this.baseUrl || fallback).replace(/\/$/, "");
    const url = new URL(`/ws/${normalizeChannel(channel)}`, base || undefined);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const token = readCookie(ACCESS_COOKIE_NAME);
    if (token) {
      url.searchParams.set("token", token);
    }
    return url.toString();
  }

  private connect(channel: string): void {
    if (!isBrowser) {
      return;
    }
    const state = this.ensureState(channel);
    if (
      state.socket &&
      (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (state.listeners.size === 0) {
      return;
    }
    this.clearReconnect(channel);
    this.setStatus(channel, state.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    try {
      const socket = new WebSocket(this.buildUrl(channel));
      state.socket = socket;
      socket.addEventListener("open", () => {
        state.reconnectAttempts = 0;
        this.setStatus(channel, "connected");
        this.startPing(channel);
      });
      socket.addEventListener("message", (event) => {
        this.dispatchMessage(channel, event.data);
      });
      socket.addEventListener("error", () => {
        this.setStatus(channel, "error");
      });
      socket.addEventListener("close", async (event) => {
        this.stopPing(channel);
        state.socket = null;
        if (!state.shouldReconnect || state.listeners.size === 0) {
          this.setStatus(channel, "disconnected");
          return;
        }
        if (isUnauthorizedClose(event) && this.auth?.refreshUser) {
          try {
            await this.auth.refreshUser();
          } catch (error) {
            console.error("Не удалось обновить токен", error);
          }
        }
        this.scheduleReconnect(channel);
      });
    } catch (error) {
      console.error("Не удалось подключиться к WebSocket", error);
      this.scheduleReconnect(channel);
    }
  }

  private dispatchMessage(channel: string, data: MessageEvent["data"]): void {
    const state = this.channels.get(channel);
    if (!state) {
      return;
    }
    let payload: unknown = data;
    if (typeof data === "string") {
      try {
        payload = JSON.parse(data);
      } catch {
        payload = data;
      }
    }
    for (const listener of state.listeners) {
      listener(payload);
    }
  }

  private setStatus(channel: string, status: ConnectionStatus): void {
    const state = this.channels.get(channel);
    if (!state || state.status === status) {
      return;
    }
    state.status = status;
    for (const listener of state.statusListeners) {
      listener(status);
    }
  }

  private scheduleReconnect(channel: string): void {
    const state = this.channels.get(channel);
    if (!state || state.listeners.size === 0) {
      return;
    }
    state.reconnectAttempts += 1;
    const delay = Math.min(MAX_RECONNECT_DELAY, INITIAL_RECONNECT_DELAY * 2 ** (state.reconnectAttempts - 1));
    this.clearReconnect(channel);
    state.reconnectTimeoutId = setTimeout(() => {
      this.connect(channel);
    }, delay);
  }

  private clearReconnect(channel: string): void {
    const state = this.channels.get(channel);
    if (state?.reconnectTimeoutId) {
      clearTimeout(state.reconnectTimeoutId);
      state.reconnectTimeoutId = null;
    }
  }

  private startPing(channel: string): void {
    const state = this.channels.get(channel);
    if (!state || state.pingIntervalId || !state.socket) {
      return;
    }
    state.pingIntervalId = setInterval(() => {
      if (state?.socket?.readyState === WebSocket.OPEN) {
        try {
          state.socket.send("ping");
        } catch (error) {
          console.error("Не удалось отправить ping", error);
        }
      }
    }, PING_INTERVAL);
  }

  private stopPing(channel: string): void {
    const state = this.channels.get(channel);
    if (state?.pingIntervalId) {
      clearInterval(state.pingIntervalId);
      state.pingIntervalId = null;
    }
  }

  private closeChannel(channel: string): void {
    const state = this.channels.get(channel);
    if (!state) {
      return;
    }
    state.shouldReconnect = false;
    this.clearReconnect(channel);
    this.stopPing(channel);
    if (
      state.socket &&
      (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)
    ) {
      state.socket.close();
    }
    state.socket = null;
    this.setStatus(channel, "disconnected");
    if (state.listeners.size === 0 && state.statusListeners.size === 0) {
      this.channels.delete(channel);
    }
  }
}
