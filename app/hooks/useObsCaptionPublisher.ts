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
  /** Maximum characters per line before wrapping (default: 45) */
  maxCharsPerLine?: number;
  /** Maximum number of lines to display (default: 3) */
  maxLines?: number;
  /** Delay between queued OBS updates when text is appended (default: 120) */
  queueDelayMs?: number;
  /** Split each appended update into this many parts before queueing (default: 2) */
  splitParts?: number;
  /** Connection settings for OBS WebSocket */
  connectionSettings?: ObsConnectionSettings;
};

type PushOptions = {
  force?: boolean;
};

const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_MAX_CHARS_PER_LINE = 45;
const DEFAULT_MAX_LINES = 3;
const DEFAULT_QUEUE_DELAY_MS = 120;
const DEFAULT_SPLIT_PARTS = 3;

/**
 * Creates stable captions based on the previous project's algorithm:
 * - Takes the full text (no word limit) to maintain context
 * - Breaks text into lines based on character width
 * - Shows only the last N lines to prevent shifting
 *
 * This approach prevents words from constantly shifting around because
 * lines remain stable until they naturally scroll off as new content arrives.
 */
function createStableCaptions(
  text: string,
  maxCharsPerLine: number,
  maxLines: number
): string {
  const normalized = text.trim().replace(/(\r\n|\n|\r)/gm, "");
  if (!normalized) return "";

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  // Build lines by wrapping at maxCharsPerLine
  // This maintains the full text context, preventing shifting
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
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

  // Show only the last N lines (most recent text)
  // This prevents shifting because earlier lines remain stable
  const finalLines = lines.slice(-maxLines);

  return finalLines.join("\n");
}

function normalizeObsText(text: string): string {
  return text
    .replace(/(\r\n|\n|\r)/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitObsWords(text: string): string[] {
  const normalized = normalizeObsText(text);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function isWordPrefix(prefix: string[], full: string[]): boolean {
  if (prefix.length > full.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (prefix[i] !== full[i]) return false;
  }
  return true;
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
    maxCharsPerLine = DEFAULT_MAX_CHARS_PER_LINE,
    maxLines = DEFAULT_MAX_LINES,
    queueDelayMs = DEFAULT_QUEUE_DELAY_MS,
    splitParts = DEFAULT_SPLIT_PARTS,
    connectionSettings,
  } = options;

  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<ObsStreamingStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const obsRef = useRef<OBSWebSocket | null>(null);
  const connectionPromiseRef = useRef<Promise<void> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");
  const queueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedChunksRef = useRef<string[][]>([]);
  const publishedWordsRef = useRef<string[]>([]);
  const lastObservedWordsRef = useRef<string[]>([]);
  const isDrainingRef = useRef(false);
  const enabledRef = useRef(false);
  const latestTextRef = useRef(text);
  const connectionSettingsRef = useRef(connectionSettings);
  const isConnectedRef = useRef(false);

  // Keep connection settings ref updated
  useEffect(() => {
    connectionSettingsRef.current = connectionSettings;
  }, [connectionSettings]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    latestTextRef.current = text;
  }, [text]);

  const stopQueue = useCallback(() => {
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    queuedChunksRef.current = [];
    isDrainingRef.current = false;
  }, []);

  const resetWordTracking = useCallback(() => {
    lastObservedWordsRef.current = [];
    publishedWordsRef.current = [];
  }, []);

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
    stopQueue();
    resetWordTracking();
    isConnectedRef.current = false;
    connectionPromiseRef.current = null;
    lastPayloadRef.current = "";
    setStatus("idle");
    setError(null);
  }, [resetWordTracking, stopQueue]);

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

      // Create stable captions (full text, line-based, show last N lines)
      const captionText = createStableCaptions(
        value,
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

        console.log(
          `[obs-client] Updating caption source "${settings.captionSource}" with text: "${captionText}"`
        );

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
    [ensureConnected, maxCharsPerLine, maxLines]
  );

  const enqueueWords = useCallback(
    (words: string[]) => {
      if (!words.length) return;
      const parts = Math.max(1, splitParts);
      if (parts === 1 || words.length === 1) {
        queuedChunksRef.current.push(words);
        return;
      }

      const chunkSize = Math.max(1, Math.ceil(words.length / parts));
      for (let i = 0; i < words.length; i += chunkSize) {
        queuedChunksRef.current.push(words.slice(i, i + chunkSize));
      }
    },
    [splitParts]
  );

  const drainQueue = useCallback(async () => {
    if (isDrainingRef.current || !enabledRef.current) return;
    isDrainingRef.current = true;

    const step = async () => {
      if (!enabledRef.current) {
        isDrainingRef.current = false;
        queueTimerRef.current = null;
        return;
      }

      const nextChunk = queuedChunksRef.current.shift();
      if (!nextChunk) {
        isDrainingRef.current = false;
        queueTimerRef.current = null;
        return;
      }

      if (nextChunk.length) {
        publishedWordsRef.current.push(...nextChunk);
        try {
          await pushUpdate(publishedWordsRef.current.join(" "));
        } catch {
          // Push errors are already handled inside pushUpdate
        }
      }

      if (!enabledRef.current) {
        isDrainingRef.current = false;
        queueTimerRef.current = null;
        return;
      }

      queueTimerRef.current = setTimeout(() => {
        void step();
      }, queueDelayMs);
    };

    void step();
  }, [pushUpdate, queueDelayMs]);

  const syncToText = useCallback(
    (value: string) => {
      stopQueue();
      const words = splitObsWords(value);
      lastObservedWordsRef.current = words;
      publishedWordsRef.current = [...words];
      void pushUpdate(words.join(" "), { force: true });
    },
    [pushUpdate, stopQueue]
  );

  const handleIncomingText = useCallback(
    (value: string) => {
      const nextWords = splitObsWords(value);
      const prevWords = lastObservedWordsRef.current;

      if (!isWordPrefix(prevWords, nextWords)) {
        syncToText(value);
        return;
      }

      const newWords = nextWords.slice(prevWords.length);
      lastObservedWordsRef.current = nextWords;

      if (!newWords.length) {
        return;
      }

      enqueueWords(newWords);
      void drainQueue();
    },
    [drainQueue, enqueueWords, syncToText]
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
      handleIncomingText(text);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [debounceMs, enabled, handleIncomingText, text]);

  // Handle enable/disable state changes
  useEffect(() => {
    if (!enabled) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      disconnect();
      return;
    }

    syncToText(latestTextRef.current);
  }, [enabled, disconnect, syncToText]);

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
      syncToText(value ?? text);
    },
    [syncToText, text]
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
