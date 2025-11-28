"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ReadyMessage = {
  type: "ready";
  session_id: string;
};
type TranscriptMessage = {
  type: "transcript";
  session_id: string;
  text: string;
  is_final: boolean;
  confidence?: number;
};
type ErrorMessage = {
  type: "error";
  message: string;
};

type ServerMessage = ReadyMessage | TranscriptMessage | ErrorMessage;

export type UseAsrWebSocketOptions = {
  url?: string;
  sampleRate?: number;
  language?: string;
  /**
   * Delta mode for models like fastconformer_ctc_en that return NEW text each time
   * (not cumulative). In delta mode, every transcript is treated as a final append.
   * Default: false (cumulative mode for Estonian)
   */
  deltaMode?: boolean;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onFlushComplete?: (text: string) => void;
  onError?: (message: string) => void;
  onStreamStarted?: () => void;
};

export function useAsrWebSocket(options?: UseAsrWebSocketOptions) {
  const url = options?.url ?? "wss://tekstiks.ee/asr/v2";
  const sampleRate = options?.sampleRate ?? 16000;
  const language = options?.language;
  const deltaMode = options?.deltaMode ?? false;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [partialText, setPartialText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const partialTextRef = useRef<string>("");

  // Always use the latest callbacks to avoid stale-closure issues in ws handlers
  const callbacksRef = useRef<UseAsrWebSocketOptions | undefined>(options);
  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  const pendingStartRef = useRef(false);
  const hasSentAudioRef = useRef(false);
  const startInFlightRef = useRef(false);

  const resetState = useCallback(() => {
    setIsConnected(false);
    setIsStreamActive(false);
    setPartialText("");
    partialTextRef.current = "";
    setError(null);
    pendingStartRef.current = false;
    sessionIdRef.current = null;
  }, []);

  const connect = useCallback(() => {
    console.log("[ASR] Connecting to:", url);
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log("[ASR] Already connected or connecting; skipping");
      return;
    }
    try {
      const ws = new WebSocket(url);
      // Assign immediately so subsequent connect() calls see CONNECTING state
      wsRef.current = ws;
      // v2 protocol uses JSON for all messages, no binary

      ws.onopen = () => {
        console.log("[ASR] WebSocket connected");
        setIsConnected(true);
        setError(null);
        // If a start was requested before connect, send it immediately
        if (pendingStartRef.current) {
          console.log("[ASR] Sending deferred start after connect");
          const startPayload: {
            type: string;
            sample_rate: number;
            format: string;
            language?: string;
          } = {
            type: "start",
            sample_rate: sampleRate,
            format: "pcm",
          };
          if (language) {
            startPayload.language = language;
          }
          sendJson(startPayload);
          startInFlightRef.current = true;
          pendingStartRef.current = false;
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = event.data;
          // Server should send JSON strings according to protocol
          if (typeof data !== "string") {
            console.log("[ASR] Ignoring non-text frame", typeof data);
            return;
          }
          const message: ServerMessage = JSON.parse(data);
          //   console.log("[ASR] Message:", message);

          if (message.type === "error") {
            const errMsg = message.message;
            setError(errMsg);
            callbacksRef.current?.onError?.(errMsg);
            return;
          }

          if (message.type === "ready") {
            console.log("[ASR] Stream ready, session_id:", message.session_id);
            sessionIdRef.current = message.session_id;
            setIsStreamActive(true);
            hasSentAudioRef.current = false;
            startInFlightRef.current = false;
            callbacksRef.current?.onStreamStarted?.();
            return;
          }

          if (message.type === "transcript") {
            const text = message.text ?? "";

            // Handle [Session Ended] marker
            if (text === "[Session Ended]") {
              console.log("[ASR] Session ended marker received");
              const currentPartial = partialTextRef.current;
              if (currentPartial) {
                console.log("[ASR] Finalizing partial text before session end:", currentPartial);
                callbacksRef.current?.onFlushComplete?.(currentPartial);
              }
              setPartialText("");
              partialTextRef.current = "";
              hasSentAudioRef.current = false;
              return;
            }

            // Delta mode: English fastconformer returns NEW text each time (append-only)
            if (deltaMode) {
              if (text.trim()) {
                console.log("[ASR] Delta:", text);
                // In delta mode, every transcript is treated as final (append)
                callbacksRef.current?.onFinal?.(text);
              }
              hasSentAudioRef.current = false;
              return;
            }

            // Cumulative mode: Estonian returns full hypothesis (replace partial)
            if (message.is_final) {
              console.log("[ASR] Final:", text);
              if (text) {
                callbacksRef.current?.onFinal?.(text);
              }
              setPartialText("");
              partialTextRef.current = "";
              hasSentAudioRef.current = false;
            } else {
              // console.log("[ASR] Partial:", text);
              setPartialText(text);
              partialTextRef.current = text;
              callbacksRef.current?.onPartial?.(text);
            }
            return;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = (ev) => {
        console.error("[ASR] WebSocket error", ev);
        setError("WebSocket error");
        callbacksRef.current?.onError?.("WebSocket error");
      };

      ws.onclose = (ev) => {
        console.warn("[ASR] WebSocket closed", ev?.code, ev?.reason);
        resetState();
        callbacksRef.current?.onError?.("");
        startInFlightRef.current = false;
        hasSentAudioRef.current = false;
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to connect";
      setError(message);
      options?.onError?.(message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleRate, resetState, url]);

  const ensureSocketOpen = useCallback(() => {
    const ws = wsRef.current;
    return ws && ws.readyState === WebSocket.OPEN;
  }, []);

  const sendJson = useCallback(
    (payload: unknown) => {
      if (!ensureSocketOpen()) return false;
      try {
        const json = JSON.stringify(payload);
        // console.log("[ASR] >>", json);
        wsRef.current!.send(json);
        return true;
      } catch {
        return false;
      }
    },
    [ensureSocketOpen]
  );

  const startStream = useCallback(() => {
    console.log("[ASR] startStream()");
    if (isStreamActive || startInFlightRef.current) {
      console.log("[ASR] Stream already active or starting");
      return;
    }
    if (!ensureSocketOpen()) {
      console.log("[ASR] Socket not open; will start after connect");
      pendingStartRef.current = true;
      connect();
      return;
    }
    pendingStartRef.current = false;
    const startPayload: {
      type: string;
      sample_rate: number;
      format: string;
      language?: string;
    } = {
      type: "start",
      sample_rate: sampleRate,
      format: "pcm",
    };
    if (language) {
      startPayload.language = language;
    }
    sendJson(startPayload);
    startInFlightRef.current = true;
  }, [
    connect,
    ensureSocketOpen,
    sendJson,
    isStreamActive,
    sampleRate,
    language,
  ]);

  const sendAudio = useCallback(
    (pcm16: Int16Array) => {
      if (!ensureSocketOpen()) {
        console.warn("[ASR] Cannot send audio; socket not open");
        return;
      }
      try {
        // Convert Int16Array to base64 string
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        // Send as JSON message with base64-encoded audio data
        sendJson({ type: "audio", data: base64 });
        // console.log("[ASR] >> audio", pcm16.length, "samples");
        hasSentAudioRef.current = true;
      } catch {
        // ignore
      }
    },
    [ensureSocketOpen, sendJson]
  );

  const flush = useCallback(() => {
    console.log("[ASR] flush() -> stop()");
    if (!isStreamActive && !hasSentAudioRef.current) {
      console.warn("[ASR] No active stream and no audio sent; ignoring stop");
      return;
    }
    sendJson({ type: "stop" });
    setIsStreamActive(false);
  }, [sendJson, isStreamActive]);

  const endStream = useCallback(() => {
    console.log("[ASR] endStream() -> stop()");
    sendJson({ type: "stop" });
    setIsStreamActive(false);
  }, [sendJson]);

  const close = useCallback(() => {
    if (!wsRef.current) return;
    try {
      // Send stop before closing
      if (isStreamActive || hasSentAudioRef.current) {
        sendJson({ type: "stop" });
      }
      wsRef.current.close();
    } catch {
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
    }
  }, [sendJson, isStreamActive]);

  const ping = useCallback(() => {
    sendJson({ type: "ping" });
  }, [sendJson]);

  // Auto-start if requested earlier but socket wasn't open yet
  useEffect(() => {
    if (isConnected && pendingStartRef.current) {
      startStream();
    }
  }, [isConnected, startStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
    };
  }, []);

  return useMemo(
    () => ({
      // state
      isConnected,
      isStreamActive,
      partialText,
      error,
      // actions
      connect,
      startStream,
      sendAudio,
      flush,
      endStream,
      close,
      ping,
    }),
    [
      isConnected,
      isStreamActive,
      partialText,
      error,
      connect,
      startStream,
      sendAudio,
      flush,
      endStream,
      close,
      ping,
    ]
  );
}
