"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useAsrWebSocket } from "../hooks/useAsrWebSocket";
import { useMicrophoneRecorder } from "../hooks/useMicrophoneRecorder";

export default function Transcriber() {
  const [transcript, setTranscript] = useState<string>("");
  const [translation, setTranslation] = useState<string>("");

  const pendingWordsRef = useRef<string[]>([]);
  const preparedChunksRef = useRef<string[]>([]);
  const isSendingRef = useRef(false);
  // Track current ASR segment words and how many have been emitted into chunks
  const currentSegmentWordsRef = useRef<string[]>([]);
  const emittedInSegmentRef = useRef(0);

  // Local translation chat history (mirrors translation.md): pairs of Estonian input and English output
  const historyRef = useRef<Array<{ et: string; en: string }>>([]);
  const HISTORY_MAX = 10;
  const SYSTEM_PROMPT =
    "You are a professional Estonian-to-English simultaneous interpreter. Translate the following conversations into English with maximal faithfulness. Do not paraphrase, summarize, add, or omit information. Preserve tone, tense, named entities, and numbers exactly as they appear. For short or ambiguous fragments, prefer a literal translation. Return only the translation.";

  const appendText = useCallback((text: string) => {
    if (!text) return;
    setTranscript((prev) => (prev ? prev + " " + text : text));
  }, []);

  const appendTranslation = useCallback((text: string) => {
    if (!text) return;
    setTranslation((prev) => {
      const next = prev ? prev + " " + text : text;
      return next;
    });
  }, []);

  const resetSessionState = useCallback(() => {
    setTranscript("");
    setTranslation("");
    pendingWordsRef.current = [];
    preparedChunksRef.current = [];
    historyRef.current = [];
  }, []);

  const normalize = useCallback((text: string) => {
    return text
      .replace(/\s+([.,!?;:])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const ingestEtText = useCallback(
    (text: string, flushRemainder: boolean) => {
      if (!text) {
        if (flushRemainder && pendingWordsRef.current.length) {
          preparedChunksRef.current.push(pendingWordsRef.current.join(" "));
          pendingWordsRef.current = [];
        }
        return;
      }
      const cleaned = normalize(text);
      if (!cleaned) {
        if (flushRemainder && pendingWordsRef.current.length) {
          preparedChunksRef.current.push(pendingWordsRef.current.join(" "));
          pendingWordsRef.current = [];
        }
        return;
      }
      const newWords = cleaned.split(/\s+/);
      pendingWordsRef.current.push(...newWords);
      while (pendingWordsRef.current.length >= 7) {
        const chunkWords = pendingWordsRef.current.splice(0, 6);
        preparedChunksRef.current.push(chunkWords.join(" "));
      }
      if (flushRemainder && pendingWordsRef.current.length) {
        preparedChunksRef.current.push(pendingWordsRef.current.join(" "));
        pendingWordsRef.current = [];
      }
    },
    [normalize]
  );

  const ingestPartialDelta = useCallback(
    (partialText: string) => {
      const cleaned = normalize(partialText);
      if (!cleaned) return;
      const words = cleaned.split(/\s+/);
      currentSegmentWordsRef.current = words;
      if (emittedInSegmentRef.current > words.length) {
        emittedInSegmentRef.current = words.length;
      }
      while (words.length - emittedInSegmentRef.current >= 7) {
        const chunkWords = words.slice(
          emittedInSegmentRef.current,
          emittedInSegmentRef.current + 6
        );
        preparedChunksRef.current.push(chunkWords.join(" "));
        emittedInSegmentRef.current += 6;
      }
    },
    [normalize]
  );

  const drainQueue = useCallback(async () => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    // console.log("[TRANSLATE] drainQueue", sessionId);
    try {
      // console.log("[TRANSLATE] drainQueue", sessionId);
      while (preparedChunksRef.current.length) {
        const chunk = preparedChunksRef.current.shift();
        if (!chunk) break;
        // Build messages per translation.md: system, then alternating user/assistant from history, then current user window
        const messages: Array<{
          role: "system" | "user" | "assistant";
          content: string;
        }> = [{ role: "system", content: SYSTEM_PROMPT }];
        for (const pair of historyRef.current) {
          messages.push({ role: "user", content: pair.et });
          messages.push({ role: "assistant", content: pair.en });
        }
        messages.push({ role: "user", content: chunk });

        const payload = {
          messages,
          max_tokens: 256,
          temperature: 0.0,
        } as const;
        try {
          const resp = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          console.log("[TRANSLATE] payload", payload);
          const data = await resp.json();
          const translated: string = data?.translated_text ?? "";
          console.log("[TRANSLATE] translated", translated);
          if (translated) {
            appendTranslation(translated);
            historyRef.current.push({ et: chunk, en: translated });
            if (historyRef.current.length > HISTORY_MAX) {
              historyRef.current.splice(
                0,
                historyRef.current.length - HISTORY_MAX
              );
            }
          }
        } catch {
          // Best-effort: drop this window from history on failure
        }
      }
    } finally {
      isSendingRef.current = false;
    }
  }, [appendTranslation]);

  const asr = useAsrWebSocket({
    nBest: 1,
    onPartial: (text) => {
      ingestPartialDelta(text);
      void drainQueue();
    },
    onFinal: (text) => {
      appendText(text);
      const cleaned = normalize(text);
      const words = cleaned ? cleaned.split(/\s+/) : [];
      currentSegmentWordsRef.current = words;
      if (emittedInSegmentRef.current > words.length) {
        emittedInSegmentRef.current = words.length;
      }
      while (words.length - emittedInSegmentRef.current >= 7) {
        const chunkWords = words.slice(
          emittedInSegmentRef.current,
          emittedInSegmentRef.current + 6
        );
        preparedChunksRef.current.push(chunkWords.join(" "));
        emittedInSegmentRef.current += 6;
      }
      const remainder = words.slice(emittedInSegmentRef.current);
      if (remainder.length) {
        pendingWordsRef.current.push(...remainder);
        while (pendingWordsRef.current.length >= 7) {
          const chunkWords = pendingWordsRef.current.splice(0, 6);
          preparedChunksRef.current.push(chunkWords.join(" "));
        }
      }
      void drainQueue();
      // Reset per-segment counters for next ASR segment
      emittedInSegmentRef.current = 0;
      currentSegmentWordsRef.current = [];
    },
    onFlushComplete: (text) => {
      if (text) {
        appendText(text);
        const cleaned = normalize(text);
        const words = cleaned ? cleaned.split(/\s+/) : [];
        currentSegmentWordsRef.current = words;
        if (emittedInSegmentRef.current > words.length) {
          emittedInSegmentRef.current = words.length;
        }
        while (words.length - emittedInSegmentRef.current >= 7) {
          const chunkWords = words.slice(
            emittedInSegmentRef.current,
            emittedInSegmentRef.current + 6
          );
          preparedChunksRef.current.push(chunkWords.join(" "));
          emittedInSegmentRef.current += 6;
        }
        const remainder = words.slice(emittedInSegmentRef.current);
        if (remainder.length) {
          pendingWordsRef.current.push(...remainder);
        }
      }
      if (pendingWordsRef.current.length) {
        preparedChunksRef.current.push(pendingWordsRef.current.join(" "));
        pendingWordsRef.current = [];
      }
      void drainQueue();
      // Reset per-segment counters
      emittedInSegmentRef.current = 0;
      currentSegmentWordsRef.current = [];
    },
    onError: () => {},
    onStreamStarted: () => {
      // When stream is confirmed, if mic is already recording we can proceed
      // If mic is not yet started, it will start shortly via timeout in handleStart
      console.log("[ASR] onStreamStarted");
      // Ensure counters are reset at the start of a fresh stream
      emittedInSegmentRef.current = 0;
      currentSegmentWordsRef.current = [];
    },
  });

  const mic = useMicrophoneRecorder({
    targetSampleRate: 16000,
    targetChunkDurationMs: 100,
    onChunk: (pcm16) => {
      // Send audio unconditionally; internal sender checks socket state.
      // Avoid gating on asr.isStreamActive here to prevent stale-closure issues
      // that can block audio from ever being sent.
      asr.sendAudio(pcm16);
    },
    onError: () => {},
  });

  const isBusy = useMemo(
    () => mic.isRecording || asr.isStreamActive,
    [mic.isRecording, asr.isStreamActive]
  );

  const handleStart = useCallback(() => {
    // Start a stream (connects if needed); begin mic shortly after
    resetSessionState();
    asr.startStream();
    setTimeout(() => {
      mic.start();
    }, 150);
  }, [asr, mic, resetSessionState]);

  const handleStop = useCallback(async () => {
    await mic.stop();
    // Give a brief moment for last audio chunk to flush into onChunk
    setTimeout(() => {
      asr.flush();
    }, 100);
  }, [asr, mic]);

  const handleClear = useCallback(() => {
    resetSessionState();
  }, [resetSessionState]);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
          onClick={handleStart}
          disabled={isBusy}
        >
          Start
        </button>
        <button
          className="rounded-md bg-gray-700 text-white px-4 py-2 disabled:opacity-50"
          onClick={handleStop}
          disabled={!mic.isRecording && !asr.isStreamActive}
        >
          Stop
        </button>
        <button
          className="rounded-md bg-gray-200 text-black px-4 py-2"
          onClick={handleClear}
        >
          Clear
        </button>
      </div>

      {asr.partialText && (
        <div className="text-gray-500 italic">{asr.partialText}</div>
      )}

      <div className="whitespace-pre-wrap rounded border p-3 min-h-32">
        {transcript || "Transcript will appear here..."}
      </div>

      <div className=" ">
        {translation || "Translation will appear here..."}
      </div>

      {asr.error && <div className="text-red-600">{asr.error}</div>}
      {mic.error && <div className="text-red-600">{mic.error}</div>}
    </div>
  );
}
