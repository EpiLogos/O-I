// Voice on its owner (lane W4; DLW §19.21, actuation:voice — "Kind: effect · Chain: after the Agent, on any track an agent speaks on").
// The one voice owner the shell has is the Answer's voice (central/devices/answerVoice.ts AnswerVoice, useAnswerVoice.ts): the kernel op
// nara_voice — whisper.cpp hears, Kokoro speaks, loopback endpoints only (desktop/cradle/kernel/src/nara_voice.rs: open returns mode
// `turn-based-native-cascade`) — on the conversation the Answer is bound to. That is the Local body. Voice reads it and writes it through
// it: Body Local opens the voice (Speaks on: nara_voice open), Body Off closes it (Speaks and Hears off: nara_voice close). A Factory
// session has no voice owner, so Voice stands on the track Nara speaks on (Central's), after its Agent.
//
// What the owner reports, by key:
//   voice.body   Local while the voice is open (Speaks or Hears on, the owner's open answered), Off while it is closed; absent while it
//                opens (waiting).
//   bodies       Local: available where the native kernel and a bound conversation stand, else closed with the voice's own words
//                (useAnswerVoice.ts voiceAbsence). Face, Realtime aligned and Realtime own voice: closed, each with the route it lacks.
//   reason       why no turn is drawn: Kokoro measures no timing and the voice keeps no record of the turn it spoke; or the voice's words.
// What nothing reports, each absent with the reading it waits for: the declared voice and the voices (the open's constitution names the
// TTS stage's declared voice — nara_voice_constitution.rs stage configuration `declared_voice` — and AnswerVoice keeps only the lease), the
// body's duplex, barge-in and stop (the constitution's `interaction` and `interruption`, not kept either), the latency and the receipt of a
// turn (the speak result's receipt, not kept), the turn itself (Kokoro measures no word or phone timing: agent/faceVoice.ts).
// Speed, Mouth, Affect, Interrupt, Egress, Console and Voice stand disabled with the operation each lacks. Pure.
import type {DesignBinding, Standing, Value, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {AnswerVoiceState, VoiceKey} from '../../central/devices/answerVoice'
import {familyFaceDevice} from './mainTrackBindings'

export const VOICE_DESIGN = 'actuation:voice'
/** Voice on the door: after the Agent on the track the Answer speaks on (Central's chain places it: CentralDevices.tsx). */
export const VOICE_ID = 'central:voice'

/** Voice as a device of the runtime: Actuation's admitted `voice` face (actuationFamilyManifest.ts), so designKey('actuation', 'voice')
 * is the design's id by the family's own declaration. Null when the family does not admit it. */
export function voiceDevice(id: string = VOICE_ID): DeviceInstance | null {
  return familyFaceDevice(id, 'actuation', 'voice', 'Voice', 'form')
}

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const unread = (what: string, op: string, owner: string) => `${what}: no reading reaches it yet — missing op: ${op} (${owner}).`

/** The bodies no route reaches, each with the route it lacks. */
export const BODY_CLOSED = {
  face: 'Face: the face rig\'s own body (Piper, every phone measured) speaks through its chat server, and no kernel route reaches it from the shell.',
  realtime: 'Realtime: AIKit holds the contract and a fixture translator, and no live Realtime client runs here.',
} as const

/** The readings nothing reports here, each with what it waits for. */
export const VOICE_ABSENT = {
  'voice.voice': unread('The voice', 'the TTS stage\'s declared voice from nara_voice open\'s constitution (nara_voice_constitution.rs `declared_voice`), kept by the Answer\'s voice (answerVoice.ts keeps the lease only)', 'Central (the Answer\'s voice)'),
  'voice.voices': unread('The voices', 'a list of the voices the Local body offers (aikit.local-speech-config declares one per stage)', 'AIKit'),
  'body.duplex': unread('Duplex', 'the constitution\'s `interaction` (full-duplex-realtime), kept by the Answer\'s voice', 'Central (the Answer\'s voice)'),
  'body.bargeIn': unread('Barge-in', 'the constitution\'s `interaction` (barge-in), kept by the Answer\'s voice', 'Central (the Answer\'s voice)'),
  'body.interrupt': unread('Stop', 'the constitution\'s `interruption`, kept by the Answer\'s voice', 'Central (the Answer\'s voice)'),
  'body.latencyMs': unread('Latency', 'a measured interval from a sentence\'s text to its first sound in nara_voice speak\'s receipt', 'Central (the kernel op nara_voice)'),
  'body.receipt': unread('The receipt', 'the last speak\'s receipt, kept by the Answer\'s voice', 'Central (the Answer\'s voice)'),
  turn: unread('The last turn', 'word and phone timing for a spoken turn (Kokoro measures none: agent/faceVoice.ts) and a record of the turn spoken', 'Central (the kernel op nara_voice)'),
} as const

/** The controls no owner operation carries, each with the operation it lacks. */
export const VOICE_REFUSE = {
  'voice.voice': missing('Voice', 'a voice choice on the Local body\'s TTS stage (aikit.local-speech-config `voice`) through nara_voice', 'AIKit'),
  'voice.speed': missing('Speed', 'a speaking rate on the Local body\'s TTS stage through nara_voice', 'AIKit'),
  'voice.mouth': missing('Mouth', 'a mouth source for the face (the Answer\'s playback moves it with the loudness: agent/faceVoice.ts playVoice)', 'Central (the Answer\'s voice)'),
  'voice.affect': missing('Affect', 'K-E-V\'s affect per sentence on the spoken turn', 'Central (K-E-V)'),
  'voice.interrupt': missing('Interrupt', 'an interruption contract on the body (the constitution declares it unsupported)', 'Central (the kernel op nara_voice)'),
  'voice.egress': missing('Egress', 'an egress policy for spoken Nara material (the Local body admits loopback endpoints only: nara_voice_constitution.rs local_endpoint)', 'Central'),
  'voice.console': missing('Console', 'the Epii console beside the face', 'Central'),
} as const

export const NO_TURN = 'Nothing spoken is drawn: Kokoro measures no word or phone timing (agent/faceVoice.ts), and the voice keeps no record of the turn it spoke.'

export interface VoiceInput {
  /** The Answer's voice now (useAnswerVoice.ts). */
  readonly state: AnswerVoiceState
  /** Why the voice cannot open here (useAnswerVoice.ts voiceAbsence), or null. */
  readonly why: string | null
}

/** Voice's values: the body speaking now, what each body can do, and why no turn is drawn. */
export function voiceValues(input: VoiceInput): Values {
  const {state, why} = input
  const values: Record<string, Value> = {}
  if (!state.busy) values['voice.body'] = state.speaks === 'on' || state.hears === 'on' ? 'local' : 'off'
  values.bodies = JSON.stringify([
    why === null ? {id: 'local', available: true} : {id: 'local', available: false, why},
    {id: 'face', available: false, why: BODY_CLOSED.face},
    {id: 'realtime-aligned', available: false, why: BODY_CLOSED.realtime},
    {id: 'realtime-native', available: false, why: BODY_CLOSED.realtime},
  ])
  values.reason = state.refused.speaks ?? state.refused.hears ?? why ?? NO_TURN
  return values
}

/** Voice's binding: Body writes through the Answer's voice (Local: Speaks on; Off: Speaks and Hears off), refused in its words where
 * the voice cannot open; every other control stands disabled with the operation it lacks; every absent reading with what it waits for. */
export function voiceBinding(input: VoiceInput, write: (key: VoiceKey, value: unknown) => Promise<void>, id: string = VOICE_ID): DesignBinding {
  const standing: Record<string, Standing> = Object.fromEntries(Object.entries({...VOICE_ABSENT, ...VOICE_REFUSE}).map(([key, why]) => [key, {disabled: why}]))
  if (input.why !== null && !(input.state.speaks === 'on' || input.state.hears === 'on')) standing['voice.body'] = {disabled: input.why}
  return {
    id,
    values: voiceValues(input),
    standing,
    ...(input.state.busy ? {waiting: ['voice.body']} : {}),
    writes: key => key === 'voice.body' || key in VOICE_REFUSE,
    write: async changes => {
      for (const {key, value} of changes) {
        if (key === 'voice.body') {
          if (value === 'local') {
            if (input.why !== null) throw Error(input.why)
            await write('speaks', 'on')
            continue
          }
          if (value === 'off') {
            await write('speaks', 'off')
            await write('hears', 'off')
            continue
          }
          throw Error(value === 'face' ? BODY_CLOSED.face : BODY_CLOSED.realtime)
        }
        throw Error(VOICE_REFUSE[key as keyof typeof VOICE_REFUSE] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
