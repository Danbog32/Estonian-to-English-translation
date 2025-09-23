"use client";

import { useMemo, useEffect, useState } from "react";
import { useTranslationHealth } from "../hooks/useTranslationHealth";

export default function ServerStatus() {
  const { status, message, lastCheckedAt, refresh } = useTranslationHealth();
  const [isVisible, setIsVisible] = useState(true);

  const ui = useMemo(() => {
    switch (status) {
      case "healthy":
        return {
          color: "bg-emerald-400",
          ring: "ring-emerald-400/30",
          label: "Translation server is ready",
          hint: message || "You're good to go.",
          icon: "check",
        };
      case "starting_up":
        return {
          color: "bg-amber-400",
          ring: "ring-amber-400/30",
          label: "Translation server is waking up",
          hint: message || "This may take about a minute.",
          icon: "clock",
        };
      case "unconfigured":
        return {
          color: "bg-rose-500",
          ring: "ring-rose-500/30",
          label: "Server URL not configured",
          hint:
            message ||
            "Set HF_TRANSLATE_API_BASE and HF_TRANSLATE_MODEL in your environment.",
          icon: "cog",
        };
      case "unhealthy":
        return {
          color: "bg-rose-500",
          ring: "ring-rose-500/30",
          label: "Translation server is responding with an error",
          hint: message || "Try again in a moment.",
          icon: "alert",
        };
      default:
        return {
          color: "bg-gray-400",
          ring: "ring-white/20",
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
  if (!isVisible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-4 z-50 -translate-x-1/2"
    >
      <div
        className={
          "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-white shadow-xl backdrop-blur-md " +
          "ring-1 " +
          (ui.ring || "")
        }
      >
        <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${ui.color} opacity-30`}
          />
          <span
            className={`relative inline-flex h-3.5 w-3.5 rounded-full ${ui.color}`}
          />
        </span>
        <div className="flex min-w-[16rem] flex-col">
          <div className="flex items-center gap-2">
            {ui.icon === "check" && (
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4 text-emerald-400"
              >
                <path
                  fill="currentColor"
                  d="M7.8 14.6 3.9 10.7l1.4-1.4 2.5 2.5 6.9-6.9 1.4 1.4z"
                />
              </svg>
            )}
            {ui.icon === "alert" && (
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4 text-rose-400"
              >
                <path
                  fill="currentColor"
                  d="M10 2 1 18h18L10 2Zm1 12H9v2h2v-2Zm0-8H9v6h2V6Z"
                />
              </svg>
            )}
            {ui.icon === "offline" && (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 text-white/70"
              >
                <path
                  fill="currentColor"
                  d="M2 8.8A15.9 15.9 0 0 1 12 5c3.6 0 7 1.2 9.7 3.3l-1.6 1.2A13.6 13.6 0 0 0 12 7c-3 0-5.9 1-8.2 2.7L2 8.8Zm3.6 2.7c1.8-1.2 3.9-1.9 6.4-1.9 2.4 0 4.7.7 6.5 1.9l-1.6 1.2a11 11 0 0 0-4.9-1.2c-1.8 0-3.5.4-4.9 1.2l-1.5-1.2Zm3.4 2.6c1-.5 2.1-.8 3.2-.8 1.2 0 2.3.3 3.3.8l-1.6 1.2c-.5-.2-1.1-.3-1.7-.3s-1.2.1-1.7.3L9 14.1Zm3 2.6c.6 0 1.1.5 1.1 1.1S12.6 19 12 19s-1.1-.5-1.1-1.1.5-1.2 1.1-1.2Z"
                />
              </svg>
            )}
            {ui.icon === "cog" && (
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4 text-rose-400"
              >
                <path
                  fill="currentColor"
                  d="M8.7 1h2.6l.4 2.2 2 .9 2-1.2 1.8 1.8-1.2 2 .9 2 .2.4v2.6l-2.2.4-.9 2 1.2 2-1.8 1.8-2-1.2-2 .9-.4 2.2H8.7l-.4-2.2-2-.9-2 1.2L2.5 16l1.2-2-.9-2-.2-.4V8.7l2.2-.4.9-2-1.2-2L7 2.5l2 1.2 2-.9L8.7 1Zm1.3 5.3A3.7 3.7 0 1 0 14 10a3.7 3.7 0 0 0-4-3.7Z"
                />
              </svg>
            )}
            <span className="text-sm font-medium tracking-tight">
              {ui.label}
            </span>
          </div>
          {ui.hint && (
            <span className="text-[11px] text-white/70">{ui.hint}</span>
          )}
          {lastCheckedAt && (
            <span className="text-[10px] text-white/50">
              Checked {new Date(lastCheckedAt).toLocaleTimeString()}
            </span>
          )}
          {status === "starting_up" && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-[progress_1.8s_ease_infinite] rounded-full bg-amber-400/80" />
            </div>
          )}
        </div>
        <button
          className="ml-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/15 active:bg-white/10"
          onClick={() => refresh()}
          aria-label="Refresh translation server status"
        >
          Refresh
        </button>
      </div>
      <style>{`@keyframes progress{0%{transform:translateX(-60%)}50%{transform:translateX(30%)}100%{transform:translateX(120%)}}`}</style>
    </div>
  );
}
