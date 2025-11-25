"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ObsStreamingStatus = "idle" | "sending" | "error";

export type ObsConnectionSettings = {
  host: string;
  port: string;
  password: string;
  captionSource: string;
};

type Options = {
  debounceMs?: number;
  /** Maximum number of words to display (default: 16) */
  maxWords?: number;
  /** Maximum characters per line before wrapping (default: 45) */
  maxCharsPerLine?: number;
  /** Maximum number of lines (default: 2) */
  maxLines?: number;
  /** Connection settings for OBS WebSocket */
  connectionSettings?: ObsConnectionSettings;
};

type PushOptions = {
  force?: boolean;
};

const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_MAX_WORDS = 16;
const DEFAULT_MAX_CHARS_PER_LINE = 45;
const DEFAULT_MAX_LINES = 2;

/**
 * Creates TV-style live captions optimized for readability:
 * - Takes only the last N words (rolling window)
 * - Wraps into multiple lines using \n
 * - Each line respects a max character width
 * - Returns only the last N lines
 *
 * This approach works regardless of punctuation, perfect for live transcription.
 */
function createLiveCaptions(
  text: string,
  maxWords: number,
  maxCharsPerLine: number,
  maxLines: number
): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  // Take only the last N words for a rolling window effect
  const recentWords = words.slice(-maxWords);

  // Build lines by wrapping at maxCharsPerLine
  const lines: string[] = [];
  let currentLine = "";

  for (const word of recentWords) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length > maxCharsPerLine && currentLine) {
      // Current line is full, start a new one
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  // Don't forget the last line
  if (currentLine) {
    lines.push(currentLine);
  }

  // Keep only the last N lines (most recent text)
  const finalLines = lines.slice(-maxLines);

  return finalLines.join("\n");
}

export function useObsCaptionPublisher(text: string, options: Options = {}) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    maxWords = DEFAULT_MAX_WORDS,
    maxCharsPerLine = DEFAULT_MAX_CHARS_PER_LINE,
    maxLines = DEFAULT_MAX_LINES,
    connectionSettings,
  } = options;

  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<ObsStreamingStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPayloadRef = useRef<string>("");
  const connectionSettingsRef = useRef(connectionSettings);

  // Keep connection settings ref updated
  useEffect(() => {
    connectionSettingsRef.current = connectionSettings;
  }, [connectionSettings]);

  const pushUpdate = useCallback(
    async (value: string, pushOptions: PushOptions = {}) => {
      const { force = false } = pushOptions;

      // Create TV-style live captions (word-based, multi-line)
      const captionText = createLiveCaptions(
        value,
        maxWords,
        maxCharsPerLine,
        maxLines
      );

      if (!force && lastPayloadRef.current === captionText) {
        return;
      }

      lastPayloadRef.current = captionText;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("sending");
      setError(null);

      try {
        const response = await fetch("/api/obs/captions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: captionText,
            settings: connectionSettingsRef.current,
          }),
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            data.error || `OBS update failed with status ${response.status}`
          );
        }

        setStatus("idle");
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unknown OBS error");
      }
    },
    [maxWords, maxCharsPerLine, maxLines]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void pushUpdate(text);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [debounceMs, enabled, pushUpdate, text]);

  useEffect(() => {
    if (!enabled) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      abortRef.current?.abort();
      lastPayloadRef.current = "";
      setStatus("idle");
      setError(null);
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const sendNow = useCallback(
    (value?: string) => {
      void pushUpdate(value ?? text, { force: true });
    },
    [pushUpdate, text]
  );

  return {
    enabled,
    status,
    error,
    toggle,
    setEnabled,
    sendNow,
  };
}
