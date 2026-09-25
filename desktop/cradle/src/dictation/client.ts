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
 * 16 kHz mono WAV, submits through the native loopback transcription operation, and places the
 * returned text in the composer as EDITABLE text. It never sends.
 *
 * Honest states, each named (copy.ts): service down (probe before capture —
 * the gap renders without touching the microphone), permission refused,
 * no microphone, transcript failure, empty transcript. Never fake text.
 */

import {readDictationStipulation} from "./store";
import {detectTransport,kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import {DICTATION_SAMPLE_RATE, encodeWav16kMono, resampleTo16k} from "./wav";

export type DictationRefusal =
  | {kind: "service-down"; detail?: string; endpoint?:string}
  | {kind: "mic-denied"}
  | {kind: "mic-unavailable"}
  | {kind: "failed"; detail: string}
  | {kind: "empty"};

export type DictationOutcome = {kind: "transcript"; text: string} | DictationRefusal;

/** The native probe is the only route to a single-use recording lease. */
export async function probeTranscriptionEndpoint(transport:KernelTransportStatus=detectTransport()) {
 const stipulation=await readDictationStipulation(transport);
 const result=await kernelOp(transport,{op:"dictation_probe"});
 if(result.outcome?.result!=="dictation_prepared")throw {kind:"service-down",detail:result.error,endpoint:stipulation.stt_url} satisfies DictationRefusal;
 return result.outcome;
}
export async function transcribeWav(transport:KernelTransportStatus,captureRef:string,wav:Blob):Promise<DictationOutcome>{
 if(wav.size>44+16000*2*300)return {kind:"failed",detail:"The recording exceeds five minutes; record a shorter passage."};
 const bytes=new Uint8Array(await wav.arrayBuffer());let binary="";
 for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
 const result=await kernelOp(transport,{op:"dictation_transcribe",capture_ref:captureRef,wav_base64:btoa(binary)});
 if(result.outcome?.result!=="dictation_transcribed")return {kind:"failed",detail:result.error??"Native local transcription returned no result"};
 return result.outcome.outcome;
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
  private captureRef:string|null=null;
  private cancelled=false;
  private capturedSamples=0;
  private overflow=false;
  private transport:KernelTransportStatus;
  constructor(transport:KernelTransportStatus=detectTransport()) {this.transport=transport;}

  /** Probe the stipulated endpoint, then open the microphone. Throws the
   * named DictationRefusal — the surface renders it, word for word. */
  async begin(): Promise<string> {
    const prepared=await probeTranscriptionEndpoint(this.transport);
    if(this.cancelled)throw new DOMException("Capture cancelled","AbortError");
    this.captureRef=prepared.capture_ref;
    const stipulation=prepared.stipulation;
    const media = await navigator.mediaDevices.getUserMedia({audio: true}).catch(error => {
      throw dictationRefusalFromCaptureError(error);
    });
    if(this.cancelled){media.getTracks().forEach(track=>track.stop());throw new DOMException("Capture cancelled","AbortError");}
    this.stream = media;
    try {
    const context = new AudioContext();
    this.context = context;
    this.sampleRate = context.sampleRate;
    this.chunks = [];
    const source = context.createMediaStreamSource(media);
    const processor = context.createScriptProcessor(4096, 1, 1);
    this.processor = processor;
    processor.onaudioprocess = event => {
      const chunk=event.inputBuffer.getChannelData(0);
      this.capturedSamples+=chunk.length;
      if(this.capturedSamples>this.sampleRate*300){this.overflow=true;this.stream?.getTracks().forEach(track=>track.stop());processor.onaudioprocess=null;return;}
      this.chunks.push(new Float32Array(chunk));
    };
    // ScriptProcessor pulls only when wired toward the destination; a zero
    // gain keeps the capture silent to the room.
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);
    return stipulation.stt_url;
    } catch(error) { this.cancel(); throw error; }
  }

  /** Stop the capture and transcribe. Never throws for ordinary failures —
   * every failure is a named outcome. */
  async end(): Promise<DictationOutcome> {
    try {
      this.processor && (this.processor.onaudioprocess = null);
      this.stream?.getTracks().forEach(track => track.stop());
      if(this.overflow)return {kind:"failed",detail:"The recording exceeds five minutes; record a shorter passage."};
      if(this.cancelled)return {kind:"failed",detail:"Capture was cancelled."};
      const flat = this.flatChunks();
      if (!this.context) return {kind: "failed", detail: "no capture was running"};
      const wav = encodeWav16kMono(resampleTo16k(flat, this.sampleRate));
      if(!this.captureRef)return {kind:"failed",detail:"No native capture lease exists."};
      const outcome=await transcribeWav(this.transport,this.captureRef,wav);
      return this.cancelled?{kind:"failed",detail:"Capture was cancelled."}:outcome;
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

  /** Disposal never transcribes or sends; it releases the local mic. */
  cancel():void {
    this.cancelled=true;
    if(this.processor)this.processor.onaudioprocess=null;
    this.stream?.getTracks().forEach(track=>track.stop());
    void this.context?.close().catch(()=>undefined);
    this.context=null;this.stream=null;this.processor=null;this.chunks=[];
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
