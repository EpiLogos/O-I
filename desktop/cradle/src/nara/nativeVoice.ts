import {kernelOp} from '../kernel/bridge';
import type {KernelTransportStatus} from '../kernel/types';
import type {NativeDialogueRequest} from './nativeDialogue';
import type {NaraDialogueContext} from './dialogueContext';

export type NativeVoiceRequest =
  | {operation: 'open'; binding: NativeDialogueRequest; context: NaraDialogueContext}
  | {operation: 'read' | 'listen' | 'close'; voice_ref: string}
  | {operation: 'transcribe'; voice_ref: string; capture_ref: string; wav_base64: string}
  | {operation: 'speak'; voice_ref: string; answer_block_id: number}
  | {operation: 'complete'; voice_ref: string; response_ref: string};
export interface NativeVoiceResult {
  schema: 'oi.nara-voice/v1'; voice_ref: string; capture_ref?: string; response_ref?: string;
  constitution?: unknown; receipt?: unknown; conditions?: unknown;
  transcription?: {text: string; [key: string]: unknown};
  audio?: {audio_base64: string; content_type: string; [key: string]: unknown};
  answer?: {text: string; answer_block_ids: number[]}; closed?: boolean;
}
export async function nativeVoice(transport: KernelTransportStatus, project: string, request: NativeVoiceRequest): Promise<NativeVoiceResult> {
  const reply = await kernelOp(transport, {op: 'nara_voice', project, request});
  if (reply.error || reply.outcome?.result !== 'nara_voice') throw new Error(reply.error ?? 'The native voice owner did not return.');
  const result = reply.outcome.data;
  if (result.schema !== 'oi.nara-voice/v1' || !result.voice_ref
      || ('voice_ref' in request && result.voice_ref !== request.voice_ref)) throw new Error('The native voice response belongs to a different session.');
  return result;
}

export function encodeAudio(bytes: Uint8Array): string {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}
export function decodeAudio(encoded: string): ArrayBuffer {
  if (encoded.length > 32 * 1024 * 1024) throw new Error('The native voice response exceeds the playback limit.');
  const text = atob(encoded), bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
}
