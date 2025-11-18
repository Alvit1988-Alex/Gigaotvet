"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

import { useAuth } from "./AuthContext";
import { WSClient } from "../src/services/wsClient";

const WSClientContext = createContext<WSClient | null>(null);

export function WSClientProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const clientRef = useRef<WSClient | null>(null);

  if (!clientRef.current) {
    clientRef.current = new WSClient({ auth: { refreshUser: auth.refreshUser, logout: auth.logout } });
  } else {
    clientRef.current.attachAuth({ refreshUser: auth.refreshUser, logout: auth.logout });
  }

  useEffect(() => {
    return () => {
      clientRef.current?.closeAll();
    };
  }, []);

  useEffect(() => {
    if (!auth.user) {
      clientRef.current?.handleLogout();
    }
  }, [auth.user]);

  return <WSClientContext.Provider value={clientRef.current}>{children}</WSClientContext.Provider>;
}

export function useWSClient(): WSClient {
  const context = useContext(WSClientContext);
  if (!context) {
    throw new Error("useWSClient должен использоваться внутри WSClientProvider");
  }
  return context;
}
