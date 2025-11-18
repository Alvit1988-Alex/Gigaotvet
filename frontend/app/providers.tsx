"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "../contexts/AuthContext";
import { WSClientProvider } from "../contexts/WSClientContext";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <WSClientProvider>{children}</WSClientProvider>
    </AuthProvider>
  );
}
