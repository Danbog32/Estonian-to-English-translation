"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/react";
import { useAsrWebSocket } from "../hooks/useAsrWebSocket";
import { useMicrophoneRecorder } from "../hooks/useMicrophoneRecorder";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useFirebaseCaptions } from "../hooks/useFirebaseCaptions";
import { formatTextForDisplay } from "../utils/textFormatting";
import ResizableSplit from "./ResizableSplit";
import HeaderControls from "./HeaderControls";
import WordDisplay from "./WordDisplay";
import LangDropdown from "./LangDropdown";
import { useObsCaptionPublisher } from "../hooks/useObsCaptionPublisher";
import { AudioLevelIndicator } from "./AudioLevelIndicator";
import {
  getStoredObsSettings,
  storeObsSettings,
  type ObsConnectionSettings,
} from "./FirebaseApiSwitchComponent";
import {
  LANGUAGES,
  LanguageCode,
  SOURCE_LANGUAGES,
  generateSystemPrompt,
  generatePlaceholder,
} from "../utils/languages";

type HistoryEntry = {
  source: string;
  target: string;
};

export default function Transcriber() {
  const [transcript, setTranscript] = useState<string>("");
  const [translation, setTranslation] = useState<string>("");

  // Default to "left" (source language) on mobile, "split" on desktop
  const [viewMode, setViewMode] = useState<"left" | "split" | "right">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "left";
    }
    return "split";
  });

  const [sourceLang, setSourceLang] = useState<LanguageCode>("et");
  const [targetLang, setTargetLang] = useState<LanguageCode>("en");

  // OBS Settings state
  const [obsSettings, setObsSettings] = useState<ObsConnectionSettings>(() =>
    getStoredObsSettings()
  );

  const pendingWordsRef = useRef<string[]>([]);
  const preparedChunksRef = useRef<string[]>([]);
  const isSendingRef = useRef(false);
  const currentSegmentWordsRef = useRef<string[]>([]);
  const emittedInSegmentRef = useRef(0);
  const lastTargetBatchSizeRef = useRef(0);
  const targetWordsRef = useRef<string[]>([]);
  const [revealActiveIndex, setRevealActiveIndex] = useState<number | null>(
    null
  );
  const revealBaseIndexRef = useRef(0);
  const revealStartTimeRef = useRef(0);
  const revealRafRef = useRef<number | null>(null);
  const REVEAL_DELAY_MS = 120;

  const TRANSLATION_WINDOW_THRESHOLD = 6;
  const TRANSLATION_CHUNK_SIZE = 5;

  // Local translation chat history: pairs of Estonian input and target output
  const historyRef = useRef<HistoryEntry[]>([]);
  const HISTORY_MAX = 10;

  const appendText = useCallback((text: string) => {
    if (!text) return;
    setTranscript((prev) => (prev ? prev + " " + text : text));
  }, []);

  const appendTranslation = useCallback((text: string) => {
    if (!text) return;
    const newWords = text.trim().split(/\s+/).filter(Boolean);
    lastTargetBatchSizeRef.current = newWords.length;
    if (newWords.length) {
      targetWordsRef.current.push(...newWords);
    }
    setTranslation((prev) => {
      const next = prev ? prev + " " + text : text;
      return formatTextForDisplay(next);
    });
  }, []);

  const resetSessionState = useCallback(() => {
    setTranscript("");
    setTranslation("");
    setRevealActiveIndex(null);
    pendingWordsRef.current = [];
    preparedChunksRef.current = [];
    historyRef.current = [];
    targetWordsRef.current = [];
    lastTargetBatchSizeRef.current = 0;
    currentSegmentWordsRef.current = [];
    emittedInSegmentRef.current = 0;
    revealBaseIndexRef.current = 0;
    revealStartTimeRef.current = 0;
    if (revealRafRef.current) {
      cancelAnimationFrame(revealRafRef.current);
      revealRafRef.current = null;
    }
  }, []);

  const normalize = useCallback((text: string) => {
    return text
      .replace(/\s+([.,!?;:])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const ingestPartialDelta = useCallback(
    (partialText: string) => {
      const cleaned = normalize(partialText);
      if (!cleaned) return;
      const words = cleaned.split(/\s+/);
      currentSegmentWordsRef.current = words;
      if (emittedInSegmentRef.current > words.length) {
        emittedInSegmentRef.current = words.length;
      }
      while (
        words.length - emittedInSegmentRef.current >=
        TRANSLATION_WINDOW_THRESHOLD
      ) {
        const chunkWords = words.slice(
          emittedInSegmentRef.current,
          emittedInSegmentRef.current + TRANSLATION_CHUNK_SIZE
        );
        preparedChunksRef.current.push(chunkWords.join(" "));
        emittedInSegmentRef.current += TRANSLATION_CHUNK_SIZE;
      }
    },
    [normalize]
  );

  const drainQueue = useCallback(async () => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      while (preparedChunksRef.current.length) {
        const chunk = preparedChunksRef.current.shift();
        if (!chunk) break;

        const systemPrompt = generateSystemPrompt(sourceLang, targetLang);
        const messages: Array<{
          role: "system" | "user" | "assistant";
          content: string;
        }> = [
          {
            role: "system",
            content: systemPrompt,
          },
        ];
        for (const pair of historyRef.current) {
          messages.push({ role: "user", content: pair.source });
          messages.push({ role: "assistant", content: pair.target });
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
          const data = await resp.json();
          const translated: string = data?.translated_text ?? "";
          if (translated) {
            appendTranslation(translated);
            historyRef.current.push({ source: chunk, target: translated });
            if (historyRef.current.length > HISTORY_MAX) {
              historyRef.current.splice(
                0,
                historyRef.current.length - HISTORY_MAX
              );
            }
          }
        } catch {
          // On failure, drop this window from history and continue
        }
      }
    } finally {
      isSendingRef.current = false;
    }
  }, [appendTranslation, sourceLang, targetLang]);

  // Map source language to ASR server model/language identifier
  const getAsrLanguage = (lang: LanguageCode): string => {
    if (lang === "en") return "fastconformer_ctc_en_1040ms";
    return lang; // 'et' and others passed as-is
  };

  // English fastconformer uses delta mode (each message is NEW text, not cumulative)
  const isDeltaMode = sourceLang === "en";

  const asr = useAsrWebSocket({
    language: getAsrLanguage(sourceLang),
    deltaMode: isDeltaMode,
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
      while (
        words.length - emittedInSegmentRef.current >=
        TRANSLATION_WINDOW_THRESHOLD
      ) {
        const chunkWords = words.slice(
          emittedInSegmentRef.current,
          emittedInSegmentRef.current + TRANSLATION_CHUNK_SIZE
        );
        preparedChunksRef.current.push(chunkWords.join(" "));
        emittedInSegmentRef.current += TRANSLATION_CHUNK_SIZE;
      }
      const remainder = words.slice(emittedInSegmentRef.current);
      if (remainder.length) {
        pendingWordsRef.current.push(...remainder);
        while (pendingWordsRef.current.length >= TRANSLATION_WINDOW_THRESHOLD) {
          const chunkWords = pendingWordsRef.current.splice(
            0,
            TRANSLATION_CHUNK_SIZE
          );
          preparedChunksRef.current.push(chunkWords.join(" "));
        }
      }
      void drainQueue();
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
        while (
          words.length - emittedInSegmentRef.current >=
          TRANSLATION_WINDOW_THRESHOLD
        ) {
          const chunkWords = words.slice(
            emittedInSegmentRef.current,
            emittedInSegmentRef.current + TRANSLATION_CHUNK_SIZE
          );
          preparedChunksRef.current.push(chunkWords.join(" "));
          emittedInSegmentRef.current += TRANSLATION_CHUNK_SIZE;
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
      emittedInSegmentRef.current = 0;
      currentSegmentWordsRef.current = [];
    },
    onError: () => {},
    onStreamStarted: () => {
      emittedInSegmentRef.current = 0;
      currentSegmentWordsRef.current = [];
    },
  });

  const mic = useMicrophoneRecorder({
    targetSampleRate: 16000,
    targetChunkDurationMs: 100,
    onChunk: (pcm16) => {
      asr.sendAudio(pcm16);
    },
    onError: () => {},
  });

  const isBusy = useMemo(
    () => mic.isRecording || asr.isStreamActive,
    [mic.isRecording, asr.isStreamActive]
  );

  const stopStream = useCallback(
    async ({ flush = true }: { flush?: boolean } = {}) => {
      if (!mic.isRecording && !asr.isStreamActive) return;
      try {
        await mic.stop();
      } catch {
        /* noop */
      }
      if (flush) {
        setTimeout(() => {
          asr.flush();
        }, 100);
      } else {
        setTimeout(() => {
          asr.endStream();
          asr.close();
        }, 0);
      }
    },
    [asr, mic]
  );

  const handleStart = useCallback(() => {
    resetSessionState();
    asr.startStream();
    setTimeout(() => {
      mic.start();
    }, 150);
  }, [asr, mic, resetSessionState]);

  const handleStop = useCallback(() => {
    void stopStream({ flush: true });
  }, [stopStream]);

  const handleTargetLanguageChange = useCallback(
    async (lang: LanguageCode) => {
      if (lang === targetLang) return;
      if (isBusy) return;
      await stopStream({ flush: false });
      resetSessionState();
      // If new target matches current source, swap them
      if (lang === sourceLang) {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
      } else {
        setTargetLang(lang);
      }
    },
    [isBusy, resetSessionState, stopStream, targetLang, sourceLang]
  );

  const handleSourceLanguageChange = useCallback(
    async (lang: LanguageCode) => {
      if (lang === sourceLang) return;
      if (isBusy) return;
      await stopStream({ flush: false });
      resetSessionState();
      // If new source matches current target, swap them
      if (lang === targetLang) {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
      } else {
        setSourceLang(lang);
      }
    },
    [isBusy, resetSessionState, stopStream, sourceLang, targetLang]
  );

  const handleClear = useCallback(() => {
    resetSessionState();
  }, [resetSessionState]);

  const sourceLanguageLabel = LANGUAGES[sourceLang]?.label || sourceLang;
  const targetLanguageLabel = LANGUAGES[targetLang]?.label || targetLang;
  const placeholder = generatePlaceholder(targetLang);

  const etDisplay = useMemo(() => {
    return [transcript, asr.partialText].filter(Boolean).join(" ").trim();
  }, [transcript, asr.partialText]);

  const targetDisplay = useMemo(
    () => formatTextForDisplay(translation),
    [translation]
  );

  // Send captions to Firebase when translation updates
  useFirebaseCaptions(translation);

  const {
    enabled: obsStreamingEnabled,
    status: obsStreamingStatus,
    error: obsStreamingError,
    setEnabled: setObsStreamingEnabled,
  } = useObsCaptionPublisher(targetDisplay, {
    debounceMs: 250,
    maxWords: 16, // Show only last 16 words (TV caption style)
    maxCharsPerLine: 45, // Wrap lines at ~45 chars
    maxLines: 2, // 2 lines max with \n between them
    connectionSettings: obsSettings,
  });

  const handleObsSettingsChange = useCallback(
    (newSettings: ObsConnectionSettings) => {
      setObsSettings(newSettings);
      storeObsSettings(newSettings);
    },
    []
  );

  const targetWords = targetWordsRef.current;
  const lastToastErrorRef = useRef<string | null>(null);

  const fadeStart = useMemo(() => {
    return Math.max(0, targetWords.length - lastTargetBatchSizeRef.current);
  }, [targetWords.length]);

  useEffect(() => {
    const batchSize = lastTargetBatchSizeRef.current;
    if (!batchSize || targetWords.length === 0) {
      setRevealActiveIndex(null);
      return;
    }
    const base = Math.max(0, targetWords.length - batchSize);
    revealBaseIndexRef.current = base;
    revealStartTimeRef.current = performance.now();
    if (revealRafRef.current) cancelAnimationFrame(revealRafRef.current);
    const step = () => {
      const elapsed = performance.now() - revealStartTimeRef.current;
      const progressed = Math.min(
        batchSize - 1,
        Math.floor(elapsed / REVEAL_DELAY_MS)
      );
      setRevealActiveIndex(base + progressed);
      if (progressed < batchSize - 1) {
        revealRafRef.current = requestAnimationFrame(step);
      } else {
        revealRafRef.current = null;
        setTimeout(() => {
          setRevealActiveIndex(null);
          lastTargetBatchSizeRef.current = 0;
        }, REVEAL_DELAY_MS);
      }
    };
    revealRafRef.current = requestAnimationFrame(step);
    return () => {
      if (revealRafRef.current) cancelAnimationFrame(revealRafRef.current);
    };
  }, [targetWords.length]);

  const splitForHighlight = useCallback((text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 0) return { lead: "", tail: "" };
    const highlightStart = Math.max(0, words.length - 2);
    return {
      lead: words.slice(0, highlightStart).join(" "),
      tail: words.slice(highlightStart).join(" "),
    };
  }, []);

  const etSplit = useMemo(
    () => splitForHighlight(etDisplay),
    [etDisplay, splitForHighlight]
  );

  const {
    scrollRef: etScrollRef,
    isScrolledUp: etIsScrolledUp,
    scrollToBottom: etScrollToBottom,
  } = useAutoScroll<HTMLDivElement>({
    content: etDisplay,
    threshold: 50,
    buttonThreshold: 200,
    enabled: true,
  });

  const {
    scrollRef: targetScrollRef,
    isScrolledUp: targetIsScrolledUp,
    scrollToBottom: targetScrollToBottom,
  } = useAutoScroll<HTMLDivElement>({
    content: targetDisplay,
    threshold: 50,
    buttonThreshold: 200,
    enabled: true,
  });

  useEffect(() => {
    if (obsStreamingEnabled && obsStreamingError) {
      // Only show toast if error message changed
      if (lastToastErrorRef.current !== obsStreamingError) {
        lastToastErrorRef.current = obsStreamingError;
        addToast({
          title: "OBS sync issue",
          description: obsStreamingError,
          color: "danger",
        });
      }
    } else {
      lastToastErrorRef.current = null;
    }
  }, [obsStreamingEnabled, obsStreamingError]);

  return (
    <div className="relative h-screen w-full bg-[radial-gradient(1200px_600px_at_-10%_-10%,#0f172a_0%,#0b0f12_40%,#050607_80%)] text-neutral-100 overflow-hidden">
      {/* Mobile View Switcher & Language Selector */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-center pt-safe bg-gradient-to-b from-[#0f172a]/95 via-[#0b0f12]/90 to-transparent backdrop-blur-sm pb-3">
        <div className="flex w-full flex-col items-center gap-3 px-4">
          <div className="flex gap-2 items-center">
            <LangDropdown
              currentLang={sourceLang}
              onLanguageChange={handleSourceLanguageChange}
              disabled={isBusy}
              availableLanguages={SOURCE_LANGUAGES}
            />
            <button
              onClick={() => setViewMode("left")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 min-w-[100px] ${
                viewMode === "left"
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              {sourceLanguageLabel}
            </button>
            <button
              onClick={() => setViewMode("right")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 min-w-[100px] ${
                viewMode === "right"
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              {targetLanguageLabel}
            </button>
            <LangDropdown
              currentLang={targetLang}
              onLanguageChange={handleTargetLanguageChange}
              disabled={isBusy}
            />
            {/* <button
              type="button"
              onClick={() => setObsStreamingEnabled(!obsStreamingEnabled)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                obsStreamingEnabled
                  ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                  : "border-white/20 text-white/70"
              } ${
                obsStreamingStatus === "error"
                  ? "border-red-500/60 bg-red-500/10 text-red-200"
                  : ""
              }`}
            >
              <span>OBS</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  obsStreamingStatus === "error"
                    ? "bg-red-400"
                    : obsStreamingStatus === "sending"
                      ? "bg-amber-300"
                      : obsStreamingEnabled
                        ? "bg-emerald-400"
                        : "bg-white/40"
                }`}
              />
              <span>
                {obsStreamingStatus === "error"
                  ? "Error"
                  : obsStreamingEnabled
                    ? obsStreamingStatus === "sending"
                      ? "Syncing"
                      : "On"
                    : "Off"}
              </span>
            </button> */}
          </div>
        </div>
      </div>

      {/* Desktop language selector */}

      <ResizableSplit
        initialLeftFraction={0.5}
        minLeftPx={240}
        minRightPx={240}
        gutterWidth={12}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        left={
          <section className="relative h-full flex flex-col px-3 md:px-4">
            <div className="hidden md:block absolute left-3 md:left-4 top-4 sm:top-6 z-10">
              <HeaderControls
                side="left"
                label={sourceLanguageLabel}
                mode={viewMode}
                onChange={setViewMode}
                sourceLang={sourceLang}
                onSourceLanguageChange={handleSourceLanguageChange}
                disabled={isBusy}
              />
            </div>
            <div
              ref={etScrollRef}
              className="pb-32 md:pb-26 !mt-20 md:!mt-12 sm:!mt-2 flex-1 h-full overflow-y-auto pt-4 md:pt-12 sm:md:pt-2 w-full text-left font-mono font-semibold uppercase tracking-[0.06em] leading-[1.08] text-[clamp(20px,5.2vw,42px)] md:text-[clamp(22px,5.6vw,42px)] custom-scrollbar"
            >
              {etDisplay ? (
                <>
                  {etSplit.lead && (
                    <span className="text-white/90">
                      {etSplit.lead + (etSplit.tail ? " " : "")}
                    </span>
                  )}
                  {etSplit.tail && (
                    <span className="text-emerald-400">{etSplit.tail}</span>
                  )}
                </>
              ) : (
                <span className="text-white/30">
                  Speak in {sourceLanguageLabel} to begin…
                </span>
              )}
            </div>
            {etIsScrolledUp && (
              <button
                onClick={etScrollToBottom}
                className="absolute cursor-pointer bottom-20 md:bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center justify-center w-12 h-12 md:w-10 md:h-10 rounded-full bg-emerald-500/90 hover:bg-emerald-400 active:bg-emerald-500 backdrop-blur-sm shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Scroll to bottom"
              >
                <svg
                  className="w-6 h-6 md:w-5 md:h-5 text-black"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
              </button>
            )}
          </section>
        }
        right={
          <section className="relative h-full flex flex-col px-3 md:px-4 bg-white/[0.01]">
            <div className="hidden md:block absolute left-3 md:left-4 top-4 sm:top-6 z-10">
              <HeaderControls
                side="right"
                label={targetLanguageLabel}
                mode={viewMode}
                onChange={setViewMode}
                currentLang={targetLang}
                onLanguageChange={handleTargetLanguageChange}
                disabled={isBusy}
                obsEnabled={obsStreamingEnabled}
                obsStatus={obsStreamingStatus}
                obsError={obsStreamingError}
                obsSettings={obsSettings}
                onObsEnabledChange={setObsStreamingEnabled}
                onObsSettingsChange={handleObsSettingsChange}
              />
            </div>
            <div
              ref={targetScrollRef}
              className="pb-32 md:pb-26 !mt-20 md:!mt-12 sm:!mt-2 flex-1 h-full overflow-y-auto pt-4 md:pt-12 sm:md:pt-2 w-full text-left font-mono font-semibold uppercase tracking-[0.06em] leading-[1.08] text-[clamp(20px,5.2vw,42px)] md:text-[clamp(22px,5.6vw,42px)] custom-scrollbar"
            >
              {targetWords.length > 0 ? (
                <WordDisplay
                  words={targetWords}
                  revealActiveIndex={revealActiveIndex}
                  fadeStart={fadeStart}
                  revealDelayMs={REVEAL_DELAY_MS}
                />
              ) : (
                <span className="text-white/30">{placeholder}</span>
              )}
            </div>
            {targetIsScrolledUp && (
              <button
                onClick={targetScrollToBottom}
                className="absolute cursor-pointer bottom-20 md:bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center justify-center w-12 h-12 md:w-10 md:h-10 rounded-full bg-emerald-500/90 hover:bg-emerald-400 active:bg-emerald-500 backdrop-blur-sm shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Scroll to bottom"
              >
                <svg
                  className="w-6 h-6 md:w-5 md:h-5 text-black"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
              </button>
            )}
          </section>
        }
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-4 md:bottom-6 flex items-center justify-center pb-safe">
        <div className="pointer-events-auto flex items-center gap-2 md:gap-2 rounded-full border border-white/10 bg-white/5 px-3 md:px-2 py-2 md:py-1.5 backdrop-blur-md shadow-lg">
          {mic.isRecording ? (
            <AudioLevelIndicator level={mic.audioLevel} className="mx-1" />
          ) : (
            <span className="inline-flex h-2.5 w-2.5 md:h-2 md:w-2 rounded-full bg-white/30" />
          )}
          <Button
            className="rounded-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-500 text-black px-6 md:px-4 py-2.5 md:py-2 text-base md:text-sm font-medium disabled:opacity-50 min-h-[44px] md:min-h-0"
            onPress={handleStart}
            disabled={isBusy}
          >
            Start
          </Button>
          <Button
            className="rounded-full bg-white/10 hover:bg-white/20 text-white px-6 md:px-4 py-2.5 md:py-2 text-base md:text-sm font-medium disabled:opacity-50 min-h-[44px] md:min-h-0"
            onPress={handleStop}
            disabled={!mic.isRecording && !asr.isStreamActive}
          >
            Stop
          </Button>
          <Button
            className="rounded-full bg-white/0 hover:bg-white/10 text-white/80 px-5 md:px-3 py-2.5 md:py-2 text-base md:text-sm min-h-[44px] md:min-h-0"
            onPress={handleClear}
          >
            Clear
          </Button>
        </div>
      </div>

      {(asr.error || mic.error) && (
        <div className="fixed left-1/2 top-20 md:top-4 -translate-x-1/2 rounded-md bg-red-500/10 text-red-300 px-4 py-2 md:px-3 md:py-1.5 text-base md:text-sm border border-red-500/20 max-w-[90vw] z-40">
          {asr.error || mic.error}
        </div>
      )}
    </div>
  );
}
