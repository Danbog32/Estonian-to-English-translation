"use client";

import { useMemo } from "react";
import { useTranslationHealth } from "../hooks/useTranslationHealth";

export default function ServerStatus() {
  const { status, message, lastCheckedAt, refresh } = useTranslationHealth();

  const ui = useMemo(() => {
    switch (status) {
      case "healthy":
        return {
          color: "bg-green-500",
          label: "Translation server is ready",
          hint: message || "",
        };
      case "starting_up":
        return {
          color: "bg-yellow-500",
          label: "Translation server is waking up",
          hint: message || "This may take about a minute.",
        };
      case "unconfigured":
        return {
          color: "bg-red-500",
          label: "Server URL not configured",
          hint:
            message ||
            "Set HF_TRANSLATE_API_BASE and HF_TRANSLATE_MODEL in your environment.",
        };
      case "unhealthy":
        return {
          color: "bg-red-500",
          label: "Translation server is responding with an error",
          hint: message || "",
        };
      default:
        return {
          color: "bg-gray-400",
          label: "Unable to reach translation server",
          hint: message || "",
        };
    }
  }, [message, status]);

  return (
    <div className="flex items-center justify-between rounded border p-3">
      <div className="flex items-center gap-3">
        <span className={`inline-block h-3 w-3 rounded-full ${ui.color}`} />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{ui.label}</span>
          {ui.hint && <span className="text-xs text-gray-600">{ui.hint}</span>}
          {lastCheckedAt && (
            <span className="text-xs text-gray-500">
              Checked {new Date(lastCheckedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      <button
        className="rounded-md bg-gray-200 text-black px-3 py-1 text-sm"
        onClick={() => refresh()}
      >
        Refresh
      </button>
    </div>
  );
}
