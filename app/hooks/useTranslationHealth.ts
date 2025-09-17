"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type HealthStatus =
  | "healthy"
  | "starting_up"
  | "unhealthy"
  | "unreachable"
  | "unconfigured";

type HealthResponse = {
  status: HealthStatus;
  message?: string;
  http_status?: number;
};

export function useTranslationHealth(pollMs: number = 10000) {
  const [status, setStatus] = useState<HealthStatus>("unreachable");
  const [message, setMessage] = useState<string>("");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const resp = await fetch("/api/translate/health", { cache: "no-store" });
      const data = (await resp.json()) as HealthResponse;
      setStatus(data.status);
      setMessage(data.message || "");
      setLastCheckedAt(Date.now());
    } catch {
      setStatus("unreachable");
      setMessage("Failed to contact translation service.");
      setLastCheckedAt(Date.now());
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    timerRef.current = window.setInterval(() => {
      void fetchHealth();
    }, pollMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [fetchHealth, pollMs]);

  return useMemo(
    () => ({ status, message, lastCheckedAt, refresh: fetchHealth }),
    [status, message, lastCheckedAt, fetchHealth]
  );
}
