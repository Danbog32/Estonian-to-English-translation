"use client";

import { createContext, useContext, useMemo, useState } from "react";

type TurnstileContextValue = {
  enabled: boolean;
  siteKey: string;
  token: string;
  setToken: (token: string) => void;
};

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

const TurnstileContext = createContext<TurnstileContextValue | null>(null);

export function TurnstileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState("");

  const value = useMemo<TurnstileContextValue>(
    () => ({
      enabled: Boolean(TURNSTILE_SITE_KEY),
      siteKey: TURNSTILE_SITE_KEY,
      token,
      setToken,
    }),
    [token],
  );

  return (
    <TurnstileContext.Provider value={value}>
      {children}
    </TurnstileContext.Provider>
  );
}

export function useTurnstile() {
  const context = useContext(TurnstileContext);
  if (!context) {
    throw new Error("useTurnstile must be used inside TurnstileProvider");
  }
  return context;
}
