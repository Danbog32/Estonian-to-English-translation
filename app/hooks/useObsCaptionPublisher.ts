"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import OBSWebSocket from "obs-websocket-js";

export type ObsStreamingStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "sending"
  | "error";

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

/**
 * Build WebSocket address for OBS connection.
 * Works with both local IPs and hostnames.
 */
function buildObsAddress(host: string, port: string): string {
  const hasProtocol = host.startsWith("ws://") || host.startsWith("wss://");
  if (hasProtocol) {
    return host;
  }
  return `ws://${host}:${port}`;
}

/**
 * Hook that connects directly to OBS WebSocket from the browser.
 *
 * This client-side approach is required because:
 * - OBS typically runs on a local/private network (e.g., 10.x.x.x, 192.168.x.x)
 * - A production server cannot reach private network IPs
 * - The browser runs on the user's machine, which CAN reach local OBS
 */
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

  const obsRef = useRef<OBSWebSocket | null>(null);
  const connectionPromiseRef = useRef<Promise<void> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");
  const connectionSettingsRef = useRef(connectionSettings);
  const isConnectedRef = useRef(false);

  // Keep connection settings ref updated
  useEffect(() => {
    connectionSettingsRef.current = connectionSettings;
  }, [connectionSettings]);

  /**
   * Ensure OBS WebSocket is connected.
   * Reuses existing connection if already connected.
   */
  const ensureConnected = useCallback(async (): Promise<OBSWebSocket> => {
    const settings = connectionSettingsRef.current;

    if (!settings?.host || !settings?.port) {
      throw new Error("OBS connection settings not configured");
    }

    // Already connected
    if (obsRef.current && isConnectedRef.current) {
      return obsRef.current;
    }

    // Connection in progress, wait for it
    if (connectionPromiseRef.current) {
      await connectionPromiseRef.current;
      if (obsRef.current && isConnectedRef.current) {
        return obsRef.current;
      }
      throw new Error("Connection failed");
    }

    // Create new connection
    const obs = new OBSWebSocket();
    obsRef.current = obs;

    const address = buildObsAddress(settings.host, settings.port);
    console.log(`[obs-client] Connecting to ${address}...`);
    setStatus("connecting");
    setError(null);

    connectionPromiseRef.current = obs
      .connect(address, settings.password || undefined, {
        rpcVersion: 1,
      })
      .then(() => {
        console.log(`[obs-client] Connected to OBS at ${address}`);
        isConnectedRef.current = true;
        setStatus("connected");
        setError(null);
      })
      .catch((err) => {
        console.error(`[obs-client] Connection failed:`, err);
        isConnectedRef.current = false;
        connectionPromiseRef.current = null;
        obsRef.current = null;

        const message = err instanceof Error ? err.message : String(err);
        setStatus("error");
        setError(`Cannot connect to OBS at ${address}: ${message}`);
        throw err;
      });

    // Set up disconnect handler
    obs.on("ConnectionClosed", () => {
      console.log("[obs-client] Connection closed");
      isConnectedRef.current = false;
      connectionPromiseRef.current = null;
      if (obsRef.current === obs) {
        obsRef.current = null;
        setStatus("idle");
      }
    });

    obs.on("ConnectionError", (err) => {
      console.error("[obs-client] Connection error:", err);
      isConnectedRef.current = false;
      connectionPromiseRef.current = null;
      if (obsRef.current === obs) {
        obsRef.current = null;
        setStatus("error");
        setError(`OBS connection error: ${err.message || "Unknown error"}`);
      }
    });

    await connectionPromiseRef.current;
    return obs;
  }, []);

  /**
   * Disconnect from OBS WebSocket.
   */
  const disconnect = useCallback(() => {
    if (obsRef.current) {
      try {
        obsRef.current.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      obsRef.current = null;
    }
    isConnectedRef.current = false;
    connectionPromiseRef.current = null;
    lastPayloadRef.current = "";
    setStatus("idle");
    setError(null);
  }, []);

  /**
   * Push caption text to OBS.
   */
  const pushUpdate = useCallback(
    async (value: string, pushOptions: PushOptions = {}) => {
      const { force = false } = pushOptions;
      const settings = connectionSettingsRef.current;

      if (!settings?.captionSource) {
        setError("OBS caption source not configured");
        return;
      }

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

      try {
        const obs = await ensureConnected();

        setStatus("sending");

        await obs.call("SetInputSettings", {
          inputName: settings.captionSource,
          inputSettings: { text: captionText },
          overlay: true,
        });

        setStatus("connected");
        setError(null);
        console.log(
          `[obs-client] Updated caption source "${settings.captionSource}"`
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown OBS error";

        // Only set error if it's not a connection-in-progress situation
        if (!message.includes("Connection failed")) {
          setStatus("error");
          setError(message);
        }

        console.error("[obs-client] Failed to update captions:", err);
      }
    },
    [ensureConnected, maxWords, maxCharsPerLine, maxLines]
  );

  // Auto-push when text changes (with debounce)
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

  // Handle enable/disable state changes
  useEffect(() => {
    if (!enabled) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      disconnect();
    }
  }, [enabled, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

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
