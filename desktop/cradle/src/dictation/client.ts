/**
 * The dictation client — the generic voice-INPUT path of the agent chat.
 *
 * Scope law (owner commission, 2026-09-19): the agent-chat microphone is
 * LOCAL DICTATION, an input aid. It is not Nara voice — Nara's chat-voice
 * dialogue stays its own mode with its own constitution, provider credential
 * and adapter story (docs/contracts/NARA-SPEECH-EXPERIENCE-V1.md § Dictation
 * is not Nara voice). Nothing here knows or names a provider; the only
 * endpoint is the user's own loopback speech server.
 *
 * The agent invocation path (the AIKit encounter owner's actions: start,
 * open, draft, prompt, …) has no voice input hook on this cut — audio is not
 * an encounter currency. So the transcript rides the door typed text already
 * uses: the owner-owned shared draft. The desktop captures locally, encodes
 * 16 kHz mono WAV, POSTs to the stipulated loopback endpoint, and places the
 * returned text in the composer as EDITABLE text. It never sends.
 *
 * Honest states, each named (copy.ts): service down (probe before capture —
 * the gap renders without touching the microphone), permission refused,
 * no microphone, transcript failure, empty transcript. Never fake text.
 */

import {readDictationStipulation} from "./store";
import {DICTATION_SAMPLE_RATE, encodeWav16kMono, resampleTo16k} from "./wav";

export type DictationRefusal =
  | {kind: "service-down"; detail?: string}
  | {kind: "mic-denied"}
  | {kind: "mic-unavailable"}
  | {kind: "failed"; detail: string}
  | {kind: "empty"};

export type DictationOutcome = {kind: "transcript"; text: string} | DictationRefusal;

/** A minimal valid PCM16 WAV (3 ms of silence at 16 kHz) used to probe the
 * endpoint: any HTTP answer — including an error — proves the server is
 * there; only a transport failure proves it is not. */
function probeWav(): Blob {
  return encodeWav16kMono(new Float32Array(48));
}

function multipart(wav: Blob): FormData {
  const form = new FormData();
  form.append("file", new File([wav], "dictation.wav", {type: "audio/wav"}));
  form.append("response_format", "json");
  return form;
}

/** Reachability probe: runs BEFORE the microphone is touched, so the named
 * "local speech is not running" gap renders without a permission prompt.
 * Throws the typed refusal; any HTTP answer — even an error — means alive. */
export async function probeTranscriptionEndpoint(url: string, signal?: AbortSignal): Promise<void> {
  try {
    const response = await fetch(url, {method: "POST", body: multipart(probeWav()), signal});
    await response.arrayBuffer().catch(() => undefined);
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw {kind: "service-down", detail: String(error)} satisfies DictationRefusal;
  }
}

/** One transcription attempt against the stipulated endpoint. Returns the
 * outcome as data — the surface renders it, it never invents text. */
export async function transcribeWav(url: string, wav: Blob, signal?: AbortSignal): Promise<DictationOutcome> {
  let response: Response;
  try {
    response = await fetch(url, {method: "POST", body: multipart(wav), signal});
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    return {kind: "service-down", detail: String(error)};
  }
  if (!response.ok) return {kind: "failed", detail: `the local server answered HTTP ${response.status}`};
  let parsed: unknown;
  try {
    parsed = JSON.parse(await response.text());
  } catch (error) {
    return {kind: "failed", detail: `the local server's answer was not JSON (${String(error)})`};
  }
  const text = (parsed as {text?: unknown})?.text;
  if (typeof text !== "string") return {kind: "failed", detail: "the local server's answer carried no \"text\" field"};
  if (text.trim().length === 0) return {kind: "empty"};
  return {kind: "transcript", text};
}

/** Map a getUserMedia refusal to its named state (pure, conformance-tested). */
export function dictationRefusalFromCaptureError(error: unknown): Extract<DictationRefusal, {kind: "mic-denied" | "mic-unavailable"}> {
  const denied = error instanceof DOMException
    ? error.name === "NotAllowedError" || error.name === "SecurityError"
    : false;
  return denied ? {kind: "mic-denied"} : {kind: "mic-unavailable"};
}

/** One dictation: begin captures (after the endpoint probe), end encodes and
 * transcribes. The surface owns the phase display; this owns the facts. */
export class DictationSession {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = DICTATION_SAMPLE_RATE;

  /** Probe the stipulated endpoint, then open the microphone. Throws the
   * named DictationRefusal — the surface renders it, word for word. */
  async begin(): Promise<string> {
    const stipulation = readDictationStipulation();
    await probeTranscriptionEndpoint(stipulation.stt_url);
    const media = await navigator.mediaDevices.getUserMedia({audio: true}).catch(error => {
      throw dictationRefusalFromCaptureError(error);
    });
    this.stream = media;
    const context = new AudioContext();
    this.context = context;
    this.sampleRate = context.sampleRate;
    this.chunks = [];
    const source = context.createMediaStreamSource(media);
    const processor = context.createScriptProcessor(4096, 1, 1);
    this.processor = processor;
    processor.onaudioprocess = event => {
      this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    // ScriptProcessor pulls only when wired toward the destination; a zero
    // gain keeps the capture silent to the room.
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);
    return stipulation.stt_url;
  }

  /** Stop the capture and transcribe. Never throws for ordinary failures —
   * every failure is a named outcome. */
  async end(): Promise<DictationOutcome> {
    try {
      this.processor && (this.processor.onaudioprocess = null);
      this.stream?.getTracks().forEach(track => track.stop());
      const flat = this.flatChunks();
      if (!this.context) return {kind: "failed", detail: "no capture was running"};
      const wav = encodeWav16kMono(resampleTo16k(flat, this.sampleRate));
      return await transcribeWav(readDictationStipulation().stt_url, wav);
    } finally {
      try {
        await this.context?.close();
      } catch {
        // An already-closed context is still a closed context.
      }
      this.context = null;
      this.processor = null;
      this.stream = null;
      this.chunks = [];
    }
  }

  private flatChunks(): Float32Array {
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const flat = new Float32Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      flat.set(chunk, offset);
      offset += chunk.length;
    }
    return flat;
  }
}
