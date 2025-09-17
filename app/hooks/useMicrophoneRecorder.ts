"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StreamingResampler, convertFloatToPcm16 } from "../utils/audio";

export type UseMicrophoneRecorderOptions = {
  targetSampleRate?: number; // default 16000
  targetChunkDurationMs?: number; // default 200ms
  onChunk?: (pcm16: Int16Array) => void;
  onError?: (message: string) => void;
};

export function useMicrophoneRecorder(options?: UseMicrophoneRecorderOptions) {
  const targetSampleRate = options?.targetSampleRate ?? 16000;
  const targetChunkDurationMs = options?.targetChunkDurationMs ?? 200;

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const resamplerRef = useRef<StreamingResampler | null>(null);
  const floatBufferRef = useRef<Float32Array>(new Float32Array(0));

  const clearAudioGraph = useCallback(() => {
    try {
      workletNodeRef.current?.disconnect();
    } catch {
      /* noop */
    }
    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      /* noop */
    }
    workletNodeRef.current = null;
    sourceNodeRef.current = null;
  }, []);

  const cleanup = useCallback(async () => {
    setIsRecording(false);
    clearAudioGraph();
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        /* noop */
      }
    }
    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          /* noop */
        }
      }
    }
    resamplerRef.current = null;
    floatBufferRef.current = new Float32Array(0);
  }, [clearAudioGraph]);

  const handleError = useCallback(
    (message: string) => {
      setError(message);
      options?.onError?.(message);
    },
    [options]
  );

  const start = useCallback(async () => {
    if (isRecording) {
      console.log("[MIC] Already recording");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      console.log("[MIC] Mic access granted");
      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      audioContextRef.current = audioContext;
      console.log("[MIC] AudioContext created; sr=", audioContext.sampleRate);

      // Prepare resampler from input sample rate to target
      resamplerRef.current = new StreamingResampler(
        audioContext.sampleRate,
        targetSampleRate
      );
      console.log(
        "[MIC] Resampler configured",
        audioContext.sampleRate,
        "->",
        targetSampleRate
      );

      // Load worklet
      try {
        await audioContext.audioWorklet.addModule("/worklets/pcm-processor.js");
        console.log("[MIC] Worklet loaded");
      } catch (e) {
        handleError("Failed to load audio worklet");
        throw e;
      }

      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
      });
      workletNodeRef.current = workletNode;
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      // Receive float32 chunk from worklet, resample and emit fixed-size chunks
      const targetChunkSamples = Math.max(
        1,
        Math.floor((targetSampleRate * targetChunkDurationMs) / 1000)
      );
      workletNode.port.onmessage = (event: MessageEvent) => {
        const floatChunk = event.data as Float32Array;
        const resampler = resamplerRef.current;
        if (!resampler) return;

        const resampled = resampler.resample(floatChunk);

        // Append to buffer
        const prev = floatBufferRef.current;
        const combined = new Float32Array(prev.length + resampled.length);
        combined.set(prev, 0);
        combined.set(resampled, prev.length);

        // Emit fixed-size chunks
        let offset = 0;
        while (combined.length - offset >= targetChunkSamples) {
          const slice = combined.subarray(offset, offset + targetChunkSamples);
          const pcm16 = convertFloatToPcm16(slice);
          options?.onChunk?.(pcm16);
          offset += targetChunkSamples;
        }

        // Keep leftover
        if (offset < combined.length) {
          floatBufferRef.current = combined.subarray(offset).slice();
        } else {
          floatBufferRef.current = new Float32Array(0);
        }
      };

      sourceNode.connect(workletNode);
      workletNode.connect(silentGain);
      silentGain.connect(audioContext.destination);

      setIsRecording(true);
      setError(null);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to start microphone";
      handleError(message);
      await cleanup();
    }
  }, [
    cleanup,
    handleError,
    isRecording,
    targetChunkDurationMs,
    targetSampleRate,
    options,
  ]);

  const stop = useCallback(async () => {
    if (!isRecording) return;
    await cleanup();
  }, [cleanup, isRecording]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return useMemo(
    () => ({
      isRecording,
      error,
      start,
      stop,
    }),
    [isRecording, error, start, stop]
  );
}
