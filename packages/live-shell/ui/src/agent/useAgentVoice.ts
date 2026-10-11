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

export async function stopAgentVoice(session: DictationSession): Promise<string> {
  try {
    const outcome = await session.end()
    if (outcome.kind === 'transcript') return outcome.text
    return `Voice ended: ${outcome.kind}${('detail' in outcome && outcome.detail) ? ` — ${outcome.detail}` : ''}`
  } catch (error) {
    return `Voice ended without a transcript: ${error instanceof Error ? error.message : String(error)}`
  }
}
