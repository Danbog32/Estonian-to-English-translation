export function convertFloatToPcm16(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    // Scale to 16-bit signed int range
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// Simple high-quality-ish resampler using linear interpolation, streaming stateful
export class StreamingResampler {
  private readonly inputSampleRate: number;
  private readonly outputSampleRate: number;
  private readonly ratio: number;
  private lastInputSample: number | null = null;
  private phase: number = 0;

  constructor(inputSampleRate: number, outputSampleRate: number) {
    this.inputSampleRate = inputSampleRate;
    this.outputSampleRate = outputSampleRate;
    this.ratio = inputSampleRate / outputSampleRate;
  }

  resample(input: Float32Array): Float32Array {
    if (this.inputSampleRate === this.outputSampleRate) {
      return input.slice();
    }

    const outputLength = Math.floor((input.length + this.phase) / this.ratio);
    const output = new Float32Array(outputLength);

    const last = this.lastInputSample ?? input[0] ?? 0;

    for (let i = 0; i < outputLength; i++) {
      const indexFloat = i * this.ratio + this.phase;
      const idx = Math.floor(indexFloat);
      const frac = indexFloat - idx;

      const a =
        idx >= 0
          ? idx < input.length
            ? input[idx]
            : input[input.length - 1]
          : last;
      const b = idx + 1 < input.length ? input[idx + 1] : a;
      output[i] = a + (b - a) * frac;
    }

    // Update phase and last sample for continuity
    const totalInputAdvanced = outputLength * this.ratio;
    const fractional = input.length + this.phase - totalInputAdvanced;
    this.phase = fractional;
    this.lastInputSample =
      input.length > 0 ? input[input.length - 1] : this.lastInputSample;

    return output;
  }
}
