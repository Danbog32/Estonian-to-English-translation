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

type UseTranslationHealthOptions = {
  pollMs?: number | null;
  turnstileToken?: string;
  turnstileEnabled?: boolean;
};

export function useTranslationHealth({
  pollMs = null,
  turnstileToken = "",
  turnstileEnabled = false,
}: UseTranslationHealthOptions = {}) {
  const [status, setStatus] = useState<HealthStatus>("unreachable");
  const [message, setMessage] = useState<string>("");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const fetchHealth = useCallback(async () => {
    if (turnstileEnabled && !turnstileToken) {
      return;
    }

    try {
      const healthUrl = turnstileToken
        ? `/api/translate/health?turnstileToken=${encodeURIComponent(turnstileToken)}`
        : "/api/translate/health";
      const resp = await fetch(healthUrl, { cache: "no-store" });
      const data = (await resp.json()) as HealthResponse;
      setStatus(data.status);
      setMessage(data.message || "");
      setLastCheckedAt(Date.now());
    } catch {
      setStatus("unreachable");
      setMessage("Failed to contact translation service.");
      setLastCheckedAt(Date.now());
    }
  }, [turnstileEnabled, turnstileToken]);

  useEffect(() => {
    void fetchHealth();
    if (!pollMs || pollMs <= 0) {
      return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
      };
    }

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
