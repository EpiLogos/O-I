/**
 * The dictation encoder: whatever the microphone gave, the local whisper
 * server needs 16 kHz mono PCM16 WAV. Linear-interpolation resample from the
 * AudioContext's rate, then a minimal RIFF/WAVE container. No codec, no
 * dependency, no worker script (CSP allows no blob scripts) — a plain
 * synchronous encode of the accumulated capture chunks.
 */

export const DICTATION_SAMPLE_RATE = 16000;

/** Linear-interpolated resample to 16 kHz. Identity at 16 kHz. */
export function resampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === DICTATION_SAMPLE_RATE) return input;
  if (!Number.isFinite(inputRate) || inputRate <= 0 || input.length === 0) return new Float32Array(0);
  const ratio = inputRate / DICTATION_SAMPLE_RATE;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const a = input[index] ?? 0;
    const b = input[index + 1] ?? a;
    out[i] = a + (b - a) * fraction;
  }
  return out;
}

/** Encode mono float samples (already at 16 kHz) as a PCM16 WAV blob. */
export function encodeWav16kMono(samples: Float32Array): Blob {
  const sampleCount = samples.length;
  const dataBytes = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);            // PCM chunk size
  view.setUint16(20, 1, true);             // PCM format
  view.setUint16(22, 1, true);             // mono
  view.setUint32(24, DICTATION_SAMPLE_RATE, true);
  view.setUint32(28, DICTATION_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true);             // block align
  view.setUint16(34, 16, true);            // bits per sample
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < sampleCount; i++, offset += 2) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
