"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StreamingResampler, convertFloatToPcm16 } from "../utils/audio";

export type UseMicrophoneRecorderOptions = {
  targetSampleRate?: number; // default 16000
  targetChunkDurationMs?: number; // default 200ms
  onChunk?: (pcm16: Int16Array) => void;
  onError?: (message: string) => void;
  onAudioLevel?: (level: number) => void; // 0-1 range, called ~60fps
};

export function useMicrophoneRecorder(options?: UseMicrophoneRecorderOptions) {
  const targetSampleRate = options?.targetSampleRate ?? 16000;
  const targetChunkDurationMs = options?.targetChunkDurationMs ?? 200;

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const resamplerRef = useRef<StreamingResampler | null>(null);
  const floatBufferRef = useRef<Float32Array>(new Float32Array(0));
  const levelAnimationFrameRef = useRef<number | null>(null);
  const smoothedLevelRef = useRef(0);

  const clearAudioGraph = useCallback(() => {
    try {
      workletNodeRef.current?.disconnect();
    } catch {
      /* noop */
    }
    try {
      analyserNodeRef.current?.disconnect();
    } catch {
      /* noop */
    }
    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      /* noop */
    }
    if (levelAnimationFrameRef.current !== null) {
      cancelAnimationFrame(levelAnimationFrameRef.current);
      levelAnimationFrameRef.current = null;
    }
    workletNodeRef.current = null;
    analyserNodeRef.current = null;
    sourceNodeRef.current = null;
    smoothedLevelRef.current = 0;
    setAudioLevel(0);
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      // console.log("[MIC] Mic access granted");
      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      audioContextRef.current = audioContext;
      // console.log("[MIC] AudioContext created; sr=", audioContext.sampleRate);

      // Prepare resampler from input sample rate to target
      resamplerRef.current = new StreamingResampler(
        audioContext.sampleRate,
        targetSampleRate
      );

      // Load worklet
      try {
        await audioContext.audioWorklet.addModule("/worklets/pcm-processor.js");
      } catch (e) {
        handleError("Failed to load audio worklet");
        throw e;
      }

      // Create analyser for audio level detection
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 512; // Increased for better frequency resolution
      analyserNode.smoothingTimeConstant = 0.2; // Less smoothing for more responsiveness
      analyserNodeRef.current = analyserNode;

      // Start audio level monitoring
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (!analyserNodeRef.current) return;

        // Use frequency data instead of time domain for better speech detection
        analyserNode.getByteFrequencyData(dataArray);

        // Focus on speech frequency range (80Hz - 3000Hz)
        // At 48kHz sample rate with 512 FFT, each bin is ~94Hz
        // At 44.1kHz, each bin is ~86Hz
        const nyquist = audioContext.sampleRate / 2;
        const binWidth = nyquist / bufferLength;
        const lowFreqBin = Math.floor(80 / binWidth);
        const highFreqBin = Math.floor(3000 / binWidth);

        // Calculate average amplitude in speech frequency range
        let sum = 0;
        let count = 0;
        for (let i = lowFreqBin; i < Math.min(highFreqBin, bufferLength); i++) {
          sum += dataArray[i];
          count++;
        }
        const avgAmplitude = count > 0 ? sum / count : 0;

        // Normalize to 0-1 range (byte range is 0-255)
        const normalized = avgAmplitude / 255;

        // Apply less aggressive smoothing for more responsiveness
        const smoothingFactor = 1;
        smoothedLevelRef.current =
          smoothingFactor * normalized + (1 - smoothingFactor) * smoothedLevelRef.current;

        // Noise gate: ignore values below threshold to filter ambient noise
        const NOISE_GATE_THRESHOLD = 0.08; // Lower threshold for gradual response
        const gated = smoothedLevelRef.current > NOISE_GATE_THRESHOLD 
          ? smoothedLevelRef.current - NOISE_GATE_THRESHOLD 
          : 0;

        // Apply logarithmic scaling with gentle boost for gradual response
        // Higher power (0.85) + lower boost (1.2) = gradual curve with middle levels
        const boosted = Math.pow(gated, 1.6) * 4;
        const normalizedLevel = Math.min(1, boosted);

        setAudioLevel(normalizedLevel);
        options?.onAudioLevel?.(normalizedLevel);

        levelAnimationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      levelAnimationFrameRef.current = requestAnimationFrame(updateAudioLevel);

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

      // Connect: source -> analyser -> worklet -> silent gain -> destination
      sourceNode.connect(analyserNode);
      analyserNode.connect(workletNode);
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
      audioLevel,
      start,
      stop,
    }),
    [isRecording, error, audioLevel, start, stop]
  );
}
