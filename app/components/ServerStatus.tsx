"use client";

import { useMemo, useEffect, useState } from "react";
import { useTranslationHealth } from "../hooks/useTranslationHealth";
import { useTurnstile } from "../contexts/TurnstileContext";
import StatusBanner, {
  type StatusBannerIcon,
  type StatusBannerTone,
} from "./StatusBanner";

type ServerStatusUi = {
  tone: StatusBannerTone;
  label: string;
  hint: string;
  icon: StatusBannerIcon;
};

export default function ServerStatus() {
  const {
    enabled: turnstileEnabled,
    token: turnstileToken,
  } = useTurnstile();
  const { status, message, lastCheckedAt, refresh } = useTranslationHealth({
    turnstileToken,
    turnstileEnabled,
  });
  const [isVisible, setIsVisible] = useState(true);
  const shouldHideForTurnstile = turnstileEnabled && !turnstileToken;

  const ui = useMemo<ServerStatusUi>(() => {
    switch (status) {
      case "healthy":
        return {
          tone: "success" as const,
          label: "Translation server is ready",
          hint: message || "You're good to go.",
          icon: "check",
        };
      case "starting_up":
        return {
          tone: "warning" as const,
          label: "Translation server is waking up",
          hint: message || "This may take about a minute.",
          icon: "clock",
        };
      case "unconfigured":
        return {
          tone: "danger" as const,
          label: "Server URL not configured",
          hint:
            message ||
            "Set HF_TRANSLATE_API_BASE and HF_TRANSLATE_MODEL in your environment.",
          icon: "cog",
        };
      case "unhealthy":
        return {
          tone: "danger" as const,
          label: "Translation server is responding with an error",
          hint: message || "Try again in a moment.",
          icon: "alert",
        };
      default:
        return {
          tone: "neutral" as const,
          label: "Unable to reach translation server",
          hint: message || "Check your connection and retry.",
          icon: "offline",
        };
    }
  }, [message, status]);

  // Auto-hide when healthy for 5 seconds
  useEffect(() => {
    if (status === "healthy") {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [status]);

  // Don't render if not visible
  if (!isVisible || shouldHideForTurnstile) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-4 z-50 -translate-x-1/2"
    >
      <StatusBanner
        tone={ui.tone}
        icon={ui.icon}
        title={ui.label}
        hint={ui.hint}
        detail={
          lastCheckedAt
            ? `Checked ${new Date(lastCheckedAt).toLocaleTimeString()}`
            : null
        }
        action={{
          label: "Refresh",
          onClick: refresh,
          ariaLabel: "Refresh translation server status",
        }}
        footer={
          status === "starting_up" ? (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-[progress_1.8s_ease_infinite] rounded-full bg-amber-400/80" />
            </div>
          ) : null
        }
      />
      <style>{`@keyframes progress{0%{transform:translateX(-60%)}50%{transform:translateX(30%)}100%{transform:translateX(120%)}}`}</style>
    </div>
  );
}
