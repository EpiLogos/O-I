import {DictationSession, dictationRefusalFromCaptureError} from '../../../../../desktop/cradle/src/dictation/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

export async function startAgentVoice(transport: KernelTransportStatus): Promise<{ok: true; session: DictationSession} | {ok: false; note: string}> {
  if (transport.kind === 'unavailable') {
    return {ok: false, note: transport.reason ?? 'Native transport unavailable — voice cannot probe dictation.'}
  }
  const session = new DictationSession(transport)
  try {
    await session.begin()
    return {ok: true, session}
  } catch (error) {
    const refused = dictationRefusalFromCaptureError(error)
    const detail = error && typeof error === 'object' && 'kind' in error ? JSON.stringify(error) : refused.kind
    return {ok: false, note: `Voice not armed: ${detail}`}
  }
}

/** End a dictation: the transcript, or the dictation's named refusal as a note (never text in the composer's place). */
export async function endAgentVoice(session: Pick<DictationSession, 'end'>): Promise<{ok: true; text: string} | {ok: false; note: string}> {
  try {
    const outcome = await session.end()
    if (outcome.kind === 'transcript') return {ok: true, text: outcome.text}
    return {ok: false, note: `Voice ended: ${outcome.kind}${('detail' in outcome && outcome.detail) ? ` — ${outcome.detail}` : ''}`}
  } catch (error) {
    return {ok: false, note: `Voice ended without a transcript: ${error instanceof Error ? error.message : String(error)}`}
  }
}

export async function stopAgentVoice(session: DictationSession): Promise<string> {
  const ended = await endAgentVoice(session)
  return ended.ok ? ended.text : ended.note
}

/** One composer's Voice over the kernel's dictation (Messages' Thread, MessagesPorts.voice): start arms a capture (probe, then the
 * microphone) or rejects with its refusal; stop ends it and resolves with the transcript, or rejects with the dictation's named refusal.
 * `open` is the session's start, injectable for tests. */
export function agentVoicePort(
  transport: KernelTransportStatus,
  open: (transport: KernelTransportStatus) => Promise<{ok: true; session: Pick<DictationSession, 'end' | 'cancel'>} | {ok: false; note: string}> = startAgentVoice,
): {start: () => Promise<void>; stop: () => Promise<string>} {
  let session: Pick<DictationSession, 'end' | 'cancel'> | null = null
  return {
    start: async () => {
      session?.cancel()
      session = null
      const opened = await open(transport)
      if (!opened.ok) throw new Error(opened.note)
      session = opened.session
    },
    stop: async () => {
      const running = session
      session = null
      if (!running) throw new Error('Voice: no capture is running, so there is nothing to transcribe.')
      const ended = await endAgentVoice(running)
      if (!ended.ok) throw new Error(ended.note)
      return ended.text
    },
  }
}
