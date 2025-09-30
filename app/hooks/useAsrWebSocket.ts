"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StreamStartedMessage = { event: "stream_started" };
type FlushingMessage = { event: "flushing" };
type FlushCompleteMessage = {
  event: "flush_complete";
  alternatives: { text: string; confidence?: number }[];
  is_final: true;
  duration?: number;
};
type FinalMessage = {
  alternatives: { text: string; confidence?: number }[];
  is_final: true;
  duration?: number;
};
type PartialMessage = { text: string; is_final: false };
type ErrorMessage = { error: string };
type ConnectionClosedMessage = { event: "connection_closed" };

type ServerMessage =
  | StreamStartedMessage
  | FlushingMessage
  | FlushCompleteMessage
  | FinalMessage
  | PartialMessage
  | ErrorMessage
  | ConnectionClosedMessage;

export type UseAsrWebSocketOptions = {
  url?: string;
  nBest?: number;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onFlushComplete?: (text: string) => void;
  onError?: (message: string) => void;
  onStreamStarted?: () => void;
};

export function useAsrWebSocket(options?: UseAsrWebSocketOptions) {
  const url = options?.url ?? "wss://tekstiks.ee/asr/ws/asr";
  const requestedNBest = options?.nBest ?? 1;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [partialText, setPartialText] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    pendingStartRef.current = false;
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
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("[ASR] WebSocket connected");
        setIsConnected(true);
        setError(null);
        // If a start was requested before connect, send it immediately
        if (pendingStartRef.current) {
          console.log("[ASR] Sending deferred start after connect");
          sendJson({ event: "start" });
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
          if (typeof data !== "string") {
            // Server only sends JSON text according to protocol; ignore binaries
            return;
          }
          const message: ServerMessage = JSON.parse(data);
          //   console.log("[ASR] Message:", message);
          if ((message as ErrorMessage).error) {
            const errMsg = (message as ErrorMessage).error;
            setError(errMsg);
            callbacksRef.current?.onError?.(errMsg);
            return;
          }
          if ((message as StreamStartedMessage).event === "stream_started") {
            console.log("[ASR] Stream started");
            setIsStreamActive(true);
            hasSentAudioRef.current = false;
            startInFlightRef.current = false;
            callbacksRef.current?.onStreamStarted?.();
            // Optionally configure n_best after stream starts
            if (requestedNBest && requestedNBest > 1) {
              console.log("[ASR] Sending config n_best=", requestedNBest);
              sendConfig(requestedNBest);
            }
            return;
          }
          if ((message as FlushingMessage).event === "flushing") {
            // No-op for UI; stream considered inactive during flushing
            setIsStreamActive(false);
            return;
          }
          if ((message as FlushCompleteMessage).event === "flush_complete") {
            const text =
              (message as FlushCompleteMessage).alternatives?.[0]?.text ?? "";
            // console.log("[ASR] Flush complete. Text:", text);
            callbacksRef.current?.onFlushComplete?.(text);
            setPartialText("");
            hasSentAudioRef.current = false;
            return;
          }
          if ((message as FinalMessage).is_final) {
            const text =
              (message as FinalMessage).alternatives?.[0]?.text ?? "";
            console.log("[ASR] Final:", text);
            callbacksRef.current?.onFinal?.(text);
            setPartialText("");
            hasSentAudioRef.current = false;
            return;
          }
          const maybePartial = message as PartialMessage;
          if (
            typeof maybePartial.text === "string" &&
            maybePartial.is_final === false
          ) {
            // console.log("[ASR] Partial:", maybePartial.text);
            setPartialText(maybePartial.text);
            callbacksRef.current?.onPartial?.(maybePartial.text);
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
  }, [requestedNBest, resetState, url]);

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
    sendJson({ event: "start" });
    startInFlightRef.current = true;
    // Send config immediately per protocol if n_best > 1
    if (requestedNBest && requestedNBest > 1) {
      sendJson({ event: "config", n_best: requestedNBest });
    }
  }, [connect, ensureSocketOpen, sendJson, isStreamActive, requestedNBest]);

  const sendConfig = useCallback(
    (nBest: number) => {
      sendJson({ event: "config", n_best: nBest });
    },
    [sendJson]
  );

  const sendAudio = useCallback(
    (pcm16: Int16Array) => {
      if (!ensureSocketOpen()) {
        console.warn("[ASR] Cannot send audio; socket not open");
        return;
      }
      try {
        wsRef.current!.send(pcm16.buffer);
        // console.log("[ASR] >> audio", pcm16.length, "samples");
        hasSentAudioRef.current = true;
      } catch {
        // ignore
      }
    },
    [ensureSocketOpen]
  );

  const flush = useCallback(() => {
    console.log("[ASR] flush()");
    if (!isStreamActive && !hasSentAudioRef.current) {
      console.warn("[ASR] No active stream and no audio sent; ignoring flush");
      return;
    }
    sendJson({ event: "flush" });
  }, [sendJson, isStreamActive]);

  const endStream = useCallback(() => {
    console.log("[ASR] end()");
    sendJson({ event: "end" });
  }, [sendJson]);

  const close = useCallback(() => {
    if (!wsRef.current) return;
    try {
      // Politely request close, then close socket
      sendJson({ event: "close" });
      wsRef.current.close();
    } catch {
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
    }
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
      sendConfig,
      sendAudio,
      flush,
      endStream,
      close,
    }),
    [
      isConnected,
      isStreamActive,
      partialText,
      error,
      connect,
      startStream,
      sendConfig,
      sendAudio,
      flush,
      endStream,
      close,
    ]
  );
}
