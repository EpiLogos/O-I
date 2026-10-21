// The Answer's voice in the shell (answerVoice.ts AnswerVoice): one voice for the window, on the conversation the Answer is bound to,
// with the real ports — the kernel op nara_voice (desktop/cradle/src/nara/nativeVoice.ts), the microphone (nara/voiceCapture.ts
// VoiceCapture, its blocks' loudness for the ear) and the speakers (Web Audio through agent/faceVoice.ts playVoice, which moves the
// face's mouth with the sound). Where no native owner stands, or no conversation is bound, the voice is closed and says why.
import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {EncounterReading} from '../../../../../../desktop/cradle/src/encounter/client'
import {decodeAudio, encodeAudio, nativeVoice} from '../../../../../../desktop/cradle/src/nara/nativeVoice'
import {VoiceCapture} from '../../../../../../desktop/cradle/src/nara/voiceCapture'
import {playVoice} from '../../agent/faceVoice'
import {AnswerVoice, exchangeOf, type AnswerVoicePorts, type AnswerVoiceState, type VoiceKey} from './answerVoice'
import {voiceOpening, type ConversationWriteAperture} from './centralDeviceWrites'

/** The window's one Answer voice: the rack, the pool, the pane and the rail read the same. */
const shared = new AnswerVoice()
export const answerVoice = (): AnswerVoice => shared
const writeVoice = (key: VoiceKey, value: unknown): Promise<void> => shared.write(key, value)

/** The window's speakers, made once and woken inside a press (a browser starts sound only after one). */
let speakers: AudioContext | null = null
const speakersNow = (): AudioContext => {
  if (!speakers || speakers.state === 'closed') speakers = new AudioContext()
  return speakers
}

/** Why the voice cannot open here, or null when it can. */
export function voiceAbsence(transport: KernelTransportStatus, bound: boolean, canSend: boolean): string | null {
  if (transport.kind === 'unavailable') return `Voice needs the desktop's own speech on this machine (the kernel op nara_voice: whisper.cpp hears, Kokoro speaks), and no native kernel stands here: ${transport.reason}`
  if (!bound || !canSend) return 'The conversation is not bound: no session hears your words or answers aloud. Bind it (the light), on an expression with its identity.'
  return null
}

export interface AnswerVoiceInput {
  readonly transport: KernelTransportStatus
  readonly conversation: ConversationWriteAperture | null
  readonly bound: boolean
  readonly session: string | null
  /** The `sent` path: the encounter session's own draft and Send. */
  readonly send: ((text: string) => Promise<void>) | null
  /** The bound session's exchange, from the shared observer. */
  readonly reading?: EncounterReading
}

/** The voice's readings and its write, for the Answer's binding (answerBinding.ts). */
export function useAnswerVoice(input: AnswerVoiceInput): {state: AnswerVoiceState; write: (key: VoiceKey, value: unknown) => Promise<void>; why: string | null} {
  const {transport, conversation, bound, session, send, reading} = input
  const why = voiceAbsence(transport, bound, !!send)
  const latest = useRef({transport, conversation, send})
  latest.current = {transport, conversation, send}
  const project = conversation?.project ?? null, expression = conversation?.expressionRef ?? null
  const key = why === null && session && expression ? JSON.stringify([session, project, expression]) : null
  const ports = useMemo<AnswerVoicePorts | null>(() => {
    if (key === null) return null
    const now = () => latest.current
    return {
      voice: request => nativeVoice(now().transport, now().conversation?.project ?? '', request),
      opening: () => { const {transport: t, conversation: c} = now(); if (!c) throw new Error('No conversation is selected.'); return voiceOpening(t, c) },
      send: async text => { const s = now().send; if (!s) throw new Error('The conversation is not bound: no session receives your words.'); await s(text) },
      capture: async hear => {
        const recorder = await VoiceCapture.start(failure => hear.ended(failure), (rms, ms) => hear.level(rms, ms))
        return {finish: () => recorder.finish(), discard: () => recorder.discard()}
      },
      play: async wav => {
        const context = speakersNow()
        if (context.state === 'suspended') await context.resume()
        const sound = await context.decodeAudioData(wav)
        return playVoice(context, sound)
      },
      wake: () => { void speakersNow().resume().catch(() => undefined) },
      encode: encodeAudio,
      decode: decodeAudio,
    }
  }, [key])
  useEffect(() => { shared.attach(key, ports) }, [key, ports])
  // The chain that holds the Answer goes (another mode, the window closing): the microphone and the sound stop with it.
  useEffect(() => () => shared.attach(null, null), [])
  const blocks = reading?.blocks
  useEffect(() => {
    if (key !== null && blocks) shared.observe(exchangeOf(blocks))
  }, [key, blocks])
  const state = useSyncExternalStore(shared.subscribe, shared.snapshot, shared.snapshot)
  return {state, write: writeVoice, why}
}
