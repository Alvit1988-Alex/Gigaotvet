"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  WSClient,
  type ChannelMessageHandler,
  type ConnectionStatus,
} from "../src/services/wsClient";

const STATUS_PRIORITY: Record<ConnectionStatus, number> = {
  connected: 0,
  idle: 1,
  connecting: 2,
  reconnecting: 3,
  disconnected: 4,
  error: 5,
};

function calculateAggregatedStatus(statuses: Map<string, ConnectionStatus>): ConnectionStatus {
  if (statuses.size === 0) {
    return "idle";
  }
  let worstStatus: ConnectionStatus = "connected";
  for (const status of statuses.values()) {
    if (STATUS_PRIORITY[status] > STATUS_PRIORITY[worstStatus]) {
      worstStatus = status;
    }
  }
  return worstStatus;
}

type WSClientContextValue = {
  client: WSClient;
  subscribe: (channel: string, handler: ChannelMessageHandler) => () => void;
  closeAll: () => void;
  connectionStatus: ConnectionStatus;
};

const WSClientContext = createContext<WSClientContextValue | null>(null);

type WSClientProviderProps = {
  client: WSClient;
  children: ReactNode;
};

export function WSClientProvider({ client, children }: WSClientProviderProps) {
  const statusesRef = useRef<Map<string, ConnectionStatus>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");

  const updateAggregatedStatus = useCallback(() => {
    setConnectionStatus((prev) => {
      const nextStatus = calculateAggregatedStatus(statusesRef.current);
      return prev === nextStatus ? prev : nextStatus;
    });
  }, []);

  useEffect(() => {
    statusesRef.current.clear();
    setConnectionStatus("idle");
    return () => {
      statusesRef.current.clear();
    };
  }, [client]);

  const closeAll = useCallback(() => {
    statusesRef.current.clear();
    setConnectionStatus("idle");
    client.closeAll();
  }, [client]);

  const subscribe = useCallback(
    (channel: string, handler: ChannelMessageHandler) => {
      const detachStatus = client.onStatus(channel, (status) => {
        statusesRef.current.set(channel, status);
        updateAggregatedStatus();
      });
      const unsubscribe = client.subscribe(channel, handler);
      return () => {
        detachStatus();
        statusesRef.current.delete(channel);
        updateAggregatedStatus();
        unsubscribe();
      };
    },
    [client, updateAggregatedStatus],
  );

  const value = useMemo<WSClientContextValue>(
    () => ({
      client,
      subscribe,
      closeAll,
      connectionStatus,
    }),
    [client, subscribe, closeAll, connectionStatus],
  );

  return <WSClientContext.Provider value={value}>{children}</WSClientContext.Provider>;
}

export function useWSClient(): WSClientContextValue {
  const context = useContext(WSClientContext);
  if (!context) {
    throw new Error("useWSClient должен использоваться внутри WSClientProvider");
  }
  return context;
}
