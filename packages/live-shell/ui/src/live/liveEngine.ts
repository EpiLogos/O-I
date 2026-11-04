// Live's mixer in the one engine (O-I #849). The desktop's audio path hosts live-engine (the owner: desktop/cradle/src-tauri/src/
// live_engine_host.rs over packages/live-engine); these are its owner ops, and nothing here keeps a mixer of its own:
//   live_engine_open {path}    bridge the set into the engine (no sound)
//   live_engine_play / _stop   start / stop the engine on the default output
//   live_engine_send {event}   a note, a Torus act, Panic, or a mixer move — applied at the next audio block
//   live_engine_torus          the Torus its owner handed over (QL's torus-native, kept by the kernel under the field's lease; named
//                              here only by its digest) sounds on a MIDI part, continuing the owner's field from the sample it stood at;
//                              the host follows the owner from then on: each act it lands, and each time it is handed over again; the
//                              part's notes are the owner's: the host hands each over as the key the one pitch→key law gives it
//                              (jankoInput.ts noteKeys, O-I #853) at its sample (oi:live-engine-torus-notes), and the shell plays it on
//                              the owner through the frame's Jankó strike (playTorusNotes); the Torus's effects go with it; the part
//                              takes it when the frame's sound of it stops (heardAtMs, the frame's heard_at_ms)
//   live_engine_torus_effects  the Torus's effects as the frame now holds them (its reading's `parameters.effects`), on the part after it:
//                              each as Live's device of its kind, the engine's own where it has one (followTorusEffects)
// Play hands the Torus over (the frame's `torus-engine` stage command: its owner hands it over and the frame's own sound of it is shut) and
// puts it on the set's first MIDI part, so it sounds once, through the engine's mixer and Main; Stop gives the frame its sound back. A Torus
// that cannot be handed over leaves the set playing and says why (EngineState.torus).
//   live_engine_mixer          the reading: the mixer as the engine APPLIED it (a move asked is not in it until a block applied it)
//   live_engine_export         Export Audio: the samples the engine played, rendered offline, as a 32-bit float WAV, to the file
//                              the person chooses in the host's own save dialog (the webview never names the path)
// The set's own mixer writes (live/liveWrites.ts liveSetWrites: Activator, Solo, Volume, Pan, a send) land in the .als through the set's owner and,
// while the engine plays that set, follow into it as the same move, so what you hear moves without the set being bridged again; Play
// bridges the file as it then stands. The engine runs in the native candidate only; elsewhere each act refuses, naming its op.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, tauriInvoke} from '../../../../../desktop/cradle/src/kernel/bridge'
import {readSet} from '../native/application'
import {readSetSummary} from '../shell/useSet'
import type {SlotBinding} from '../frame/transport/slots'
import type {StageCommand, StageResult} from '@epilogos/expressions-boundary'
import {commitLiveStage, liveTorusState, subscribeLiveTorus} from './torusInstrument'
import {liveJankoWindow} from './janko/jankoLayout'
import {noteKeys} from './janko/jankoInput'

/** A part as the engine names it: one of the set's parts, one of its returns, one of its groups (a bus, O-I #849 round 16), or the
 * Main track. */
export type LiveEnginePart = {track: number} | {return: number} | {group: number} | 'main'
export type LiveEngineEvent =
  | {kind: 'note_on'; track: number; key: number; velocity: number}
  | {kind: 'note_off'; track: number; key: number}
  | {kind: 'panic'}
  | {kind: 'volume'; part: LiveEnginePart; gain: number}
  | {kind: 'pan'; part: LiveEnginePart; pan: number}
  | {kind: 'send'; track: number; send: number; gain: number}
  | {kind: 'active'; part: LiveEnginePart; on: boolean}
  | {kind: 'solo'; track: number; on: boolean}
  /** An act of the Torus's keys on a part its owner's Torus was handed over to (O-I #849), as its owner's torus-play names it. */
  | {kind: 'torus_play'; track: number; keys: {row: number; column: number}[]; amplitude: [number, number]}
  /** A part's pitch bend, −1 (down) to 1 (up), and its channel pressure, 0 to 1, to the part's instrument (O-I #853 round 16). */
  | {kind: 'bend'; track: number; amount: number}
  | {kind: 'pressure'; track: number; amount: number}

/** The Torus a part holds: the digest it was handed over by, the owner's sample it stood at, and the engine frame it sounds from once
 * the engine has taken it. */
export interface LiveEngineTorus {track: number; sha256: string; at_samples_elapsed: string; sounding_from_frame: number | null}

/** One of the Torus's effects as the engine stands it after the Torus (live_engine_host.rs torus_chain): Live's device of its kind,
 * whether it sounds there, the settings carried onto it, and in words what does not sound as the frame's. */
export interface LiveEngineTorusEffect {effect: string; device: string | null; on: boolean; sounds: boolean; carried?: Record<string, number>; words?: string | null}
/** The Torus's effects on the part it sounds on: the part, each effect on the frame's chain, the frame the engine put them there from,
 * and the last refusal. */
export interface LiveEngineTorusEffects {track: number | null; chain: LiveEngineTorusEffect[]; sounding_from_frame: number | null; refusal: string | null}

/** One part's mixer as the engine applied it (gain and sends linear, pan −1…1). */
export interface LiveEnginePartMix {name: string; gain: number; pan: number; active: boolean; solo: boolean; sends: number[]; midi: boolean}
export interface LiveEngineReading {
  path: string
  sample_rate: number
  /** Frames the engine has played. */
  position: number
  playing: boolean
  /** What the bridge could not host, in its words (an unhosted device, a group, an audio part's clips). */
  warnings: string[]
  mixer: {tracks: LiveEnginePartMix[]; returns: LiveEnginePartMix[]; groups?: LiveEnginePartMix[]; main: LiveEnginePartMix}
  /** The Torus each part holds (O-I #849); none until its owner hands it over. */
  toruses: LiveEngineTorus[]
  /** The Torus's effects on its part (round 13); null until they go with it. */
  torus_effects?: LiveEngineTorusEffects | null
}
export interface LiveEngineExport {path: string; frames: number; events: number; complete: boolean}

export const LIVE_ENGINE_OPS = ['live_engine_open', 'live_engine_play', 'live_engine_stop', 'live_engine_send', 'live_engine_torus', 'live_engine_torus_effects', 'live_engine_mixer', 'live_engine_export'] as const
type LiveEngineOp = typeof LIVE_ENGINE_OPS[number]

const words = (e: unknown) => typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)

async function op<T>(command: LiveEngineOp, args: Record<string, unknown> = {}): Promise<T> {
  if (detectTransport().kind !== 'tauri') throw new Error(`The Live engine plays in the desktop's audio path, the native candidate's; it is out of reach here (${command})`)
  try { return await tauriInvoke<T>(command, args) } catch (e) { throw new Error(words(e)) }
}

/** The part the engine hosts for the set's part `index` (the set owner's index: its parts, returns and groups in order, then the Main
 * track), from the set's kinds when the engine bridged it: a group is the engine's bus (O-I #849 round 16). */
export function enginePartOf(kinds: readonly string[], index: number): LiveEnginePart | null {
  const before = (match: (kind: string) => boolean) => kinds.slice(0, index).filter(match).length
  const kind = kinds[index]
  if (kind === 'master') return 'main'
  if (kind === 'return') return {return: before(k => k === 'return')}
  if (kind === 'group') return {group: before(k => k === 'group')}
  if (PART_KINDS.has(kind)) return {track: before(k => PART_KINDS.has(k))}
  return null
}
/** The set's kinds the engine hosts as parts (an audio or a MIDI part). */
const PART_KINDS: ReadonlySet<string> = new Set(['audio', 'midi'])

/** The engine part the Torus sounds on (O-I #849; manual §21.2 "The torus is the only generator"): the set's first MIDI part, or null
 * for a set with none. */
export function torusPartOf(kinds: readonly string[]): number | null {
  const index = kinds.indexOf('midi')
  const part = index < 0 ? null : enginePartOf(kinds, index)
  return part && typeof part === 'object' && 'track' in part ? part.track : null
}

/** The engine's move for one of the set's mixer writes; null where the write changes nothing the engine plays (Arm, Monitor) or the
 * engine has no such move while it plays (the solo or sends of a return or a group). Volume is linear gain and Pan −1…1, as the set
 * keeps them. */
export function engineEventOfMixerWrite(kinds: readonly string[], track: number, control: string, value: unknown): LiveEngineEvent | null {
  const part = enginePartOf(kinds, track)
  if (!part) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (control === 'volume') return {kind: 'volume', part, gain: value}
    if (control === 'pan') return {kind: 'pan', part, pan: value}
    return null
  }
  if (typeof value !== 'boolean') return null
  if (control === 'activator') return {kind: 'active', part, on: value}
  if (control === 'solo' && typeof part === 'object' && 'track' in part) return {kind: 'solo', track: part.track, on: value}
  return null
}

export function engineEventOfSendWrite(kinds: readonly string[], track: number, index: number, gain: number): LiveEngineEvent | null {
  const part = enginePartOf(kinds, track)
  return part && typeof part === 'object' && 'track' in part ? {kind: 'send', track: part.track, send: index, gain} : null
}

export interface EngineState {
  readonly reading: LiveEngineReading | null
  /** The set's part kinds when the engine bridged it: the index space the set's writes name. */
  readonly kinds: readonly string[]
  /** The engine's last refusal, in its words. */
  readonly error: string | null
  /** Why the Torus does not sound in the engine while the set plays (it could not be handed over), in its owner's or the engine's words. */
  readonly torus: string | null
  /** The set's notes on the Torus part, played on its owner through the frame (torusNotes): at their sample, at once because the owner
   * had passed their sample (late), or refused, with the last refusal's words. */
  readonly notes: TorusNotesPlayed
  /** Why the Torus's effects as the frame last changed them did not follow into the engine, in its words. */
  readonly effects: string | null
}
export interface TorusNotesPlayed {readonly played: number; readonly late: number; readonly refused: number; readonly refusal: string | null}
const NO_NOTES: TorusNotesPlayed = {played: 0, late: 0, refused: 0, refusal: null}
let state: EngineState = {reading: null, kinds: [], error: null, torus: null, notes: NO_NOTES, effects: null}
const listeners = new Set<() => void>()
let poll: ReturnType<typeof setInterval> | null = null
/** While the engine plays, its reading is read again this often (ms): a move shows once a block applied it. */
export const LIVE_ENGINE_READ_MS = 250

function settle(next: Partial<EngineState>) {
  state = {...state, ...next}
  const playing = !!state.reading?.playing
  if (playing && !poll) poll = setInterval(() => void liveEngine.read().catch(() => {}), LIVE_ENGINE_READ_MS)
  if (!playing && poll) { clearInterval(poll); poll = null }
  for (const listener of [...listeners]) listener()
}
async function adopt<T extends LiveEngineReading>(answer: Promise<T>): Promise<T> {
  try { const reading = await answer; settle({reading, error: null}); return reading } catch (e) { settle({error: words(e)}); throw e }
}

/** The frame's stage, as the engine's Torus asks it (torusInstrument.ts commitLiveStage, the one channel to the live instrument). */
type Stage = (command: StageCommand) => Promise<StageResult>
/** The host's events, by the Tauri event API (the native candidate's). */
async function listenHost(event: string, handler: (event: {readonly payload: unknown}) => unknown): Promise<() => void> {
  const {listen} = await import('@tauri-apps/api/event')
  return listen<unknown>(event, handler)
}

/** The event the host hands the Torus's owner the set's due notes by (live_engine_host.rs TORUS_NOTES_EVENT). */
export const TORUS_NOTES_EVENT = 'oi:live-engine-torus-notes'
type Key = {row: number; column: number}
/** The notes the host hands the Torus's owner (live_engine_host.rs `torus_notes`): each act the keys of one frame at one strength, at the
 * owner's sample the frame falls on (or at once for a MIDI note sent to the part), and the keys let go. */
export interface TorusNotes {
  readonly lease: string
  readonly acts: readonly {readonly keys: readonly Key[]; readonly amplitude: number; readonly at_samples_elapsed?: string}[]
  readonly releases: readonly Key[]
}
const isKey = (k: unknown): k is Key => !!k && typeof k === 'object' && Number.isInteger((k as Key).row) && Number.isInteger((k as Key).column)
/** A TorusNotes read exactly, or null. */
export function readTorusNotes(raw: unknown): TorusNotes | null {
  if (!raw || typeof raw !== 'object') return null
  const due = raw as Record<string, unknown>
  if (typeof due.lease !== 'string' || !Array.isArray(due.acts) || !Array.isArray(due.releases) || !due.releases.every(isKey)) return null
  const acts = due.acts.every(a => !!a && typeof a === 'object' && Array.isArray(a.keys) && a.keys.length > 0 && a.keys.every(isKey)
    && typeof a.amplitude === 'number' && Number.isFinite(a.amplitude) && (a.at_samples_elapsed === undefined || (typeof a.at_samples_elapsed === 'string' && /^\d+$/.test(a.at_samples_elapsed))))
  return acts ? {lease: due.lease, acts: due.acts, releases: due.releases} : null
}

/** The set's notes on the Torus part are its owner's (O-I #849 round 13): each act the host hands over is played on the owner through the
 * frame, as its Jankó keys strike (`janko` strike at the act's sample), and the keys it lets go as their release. A sample the owner has
 * passed is played at once and counted late; a note the owner refuses is counted with its words. The owner's acts reach the engine back
 * through the kernel's tap, so the owner, the picture and the engine hold one ringing. */
async function playTorusNotes(due: TorusNotes, stage: Stage): Promise<void> {
  for (const act of due.acts) {
    const strike: StageCommand = {command: 'janko', action: 'strike', keys: [...act.keys], amplitude: act.amplitude}
    let answer = await stage(act.at_samples_elapsed === undefined ? strike : {...strike, at_samples_elapsed: act.at_samples_elapsed})
    let late = false
    if (!answer.ok && act.at_samples_elapsed !== undefined) { late = true; answer = await stage(strike) }
    const notes = state.notes
    settle({notes: answer.ok ? {...notes, played: notes.played + 1, late: notes.late + (late ? 1 : 0)}
      : {...notes, refused: notes.refused + 1, refusal: answer.error}})
  }
  if (due.releases.length) await stage({command: 'janko', action: 'release', keys: [...due.releases]})
}
let unlistenNotes: (() => void) | null = null
let notesPlayed: Promise<void> = Promise.resolve()
/** Listen for the notes the host hands the owner under `lease`, each payload played in order after the last; the handler answers that
 * payload's play. */
async function listenTorusNotes(lease: string, stage: Stage): Promise<void> {
  unlistenNotes?.()
  unlistenNotes = await listenHost(TORUS_NOTES_EVENT, event => {
    const due = readTorusNotes(event.payload)
    if (!due || due.lease !== lease) return notesPlayed
    notesPlayed = notesPlayed.then(() => playTorusNotes(due, stage)).catch(e => { settle({notes: {...state.notes, refused: state.notes.refused + 1, refusal: words(e)}}) })
    return notesPlayed
  })
}

/** The Torus's effects as the frame reports them (its hosted reading's `parameters.effects`, effectsLaw.ts EffectsState), or null. */
function torusEffects(): unknown {
  const torus = liveTorusState()
  return torus?.ok ? torus.parameters?.effects ?? null : null
}
let unfollowEffects: (() => void) | null = null
let effectsSent: Promise<void> = Promise.resolve()
/** The Torus's effects follow into the engine while it sounds there (O-I #849 round 13): each change the frame reports after `sent` is
 * put on the part after the Torus, in the order made; a refusal stands in `effects`, in the engine's words. */
function followTorusEffects(sent: unknown): void {
  unfollowEffects?.()
  let last = JSON.stringify(sent)
  unfollowEffects = subscribeLiveTorus(() => {
    const effects = torusEffects()
    const now = JSON.stringify(effects)
    if (effects === null || now === last || !state.reading?.playing) return
    last = now
    effectsSent = effectsSent.then(() => op<LiveEngineReading>('live_engine_torus_effects', {effects})
      .then(reading => settle({reading, effects: null}), e => settle({effects: words(e)})))
  })
}
/** The changes to the Torus's effects sent to the engine so far, settled. */
export const torusEffectsSettled = (): Promise<void> => effectsSent

/** The Torus handed over to the engine as it plays (O-I #849): the frame's owner hands it over and shuts the frame's own sound of it, and
 * the engine takes it onto the set's first MIDI part with the key each MIDI note strikes, when the frame's sound of it stops (round 13). Refused anywhere on the way, the set plays on
 * without it and the refusal stands in `torus`; the frame keeps sounding it. */
async function handTorus(stage: Stage): Promise<void> {
  const track = torusPartOf(state.kinds)
  if (track === null) { settle({torus: 'The set has no MIDI part for the Torus to sound on'}); return }
  const handed = await stage({command: 'torus-engine', on: true})
  if (!handed.ok || !handed.torus_engine) {
    settle({torus: handed.ok ? 'The live instrument answered with no Torus handed over' : handed.error})
    return
  }
  const window = liveJankoWindow()
  const notes = window?.ok ? noteKeys(window.window) : null
  // its effects go with it, and follow each change the frame reports
  const effects = torusEffects()
  // when the frame's sound of the sample it was handed over at is heard: the engine takes it then, so the part sounds on from where the
  // frame stops (round 13); none named, at once
  const heardAtMs = handed.torus_engine.heard_at_ms ?? null
  try {
    await adopt(op<LiveEngineReading>('live_engine_torus', {lease: handed.torus_engine.lease, track, sha256: handed.torus_engine.sha256, notes, effects, heardAtMs}))
    settle({torus: null, notes: NO_NOTES, effects: null})
    followTorusEffects(effects)
  } catch (e) {
    settle({torus: words(e)})
    await stage({command: 'torus-engine', on: false})
    return
  }
  // the part's notes are the owner's: unheard, they are not played, which the Play title says
  try { await listenTorusNotes(handed.torus_engine.lease, stage) } catch (e) {
    settle({notes: {...NO_NOTES, refusal: `the host's notes for the Torus's owner cannot be heard here: ${words(e)}`}})
  }
}

/** The engine's acts, each through its owner op; each answers the engine's reading (Export, what it wrote). */
export const liveEngine = {
  /** Play the set at `path`: bridge it as the file now stands (unless the engine already plays it), then start the output, and hand the
   * Torus over to it (handTorus, through `stage`), then play the notes the host hands its owner. The set's part kinds come from its
   * owner's reading (`read`, the shell's own by default). */
  async play(path: string, read: (path: string) => Promise<{summary: unknown}> = readSet, stage: Stage = commitLiveStage): Promise<LiveEngineReading> {
    if (state.reading?.path === path && state.reading.playing) return state.reading
    // the set's owner reads it first: a set it cannot read is never bridged, and its refusal is the engine's to show
    let summary: ReturnType<typeof readSetSummary>
    try { summary = readSetSummary((await read(path)).summary) } catch (e) { settle({error: words(e)}); throw e }
    await adopt(op<LiveEngineReading>('live_engine_open', {path}))
    settle({kinds: summary.tracks.map(track => track.kind)})
    const playing = await adopt(op<LiveEngineReading>('live_engine_play'))
    await handTorus(stage)
    return state.reading ?? playing
  },
  /** Stop the engine; the frame sounds the Torus again (its `torus-engine` off), and a Play hands it over again. */
  async stop(stage: Stage = commitLiveStage): Promise<LiveEngineReading> {
    const stopped = await adopt(op<LiveEngineReading>('live_engine_stop'))
    unlistenNotes?.(); unlistenNotes = null
    unfollowEffects?.(); unfollowEffects = null
    settle({torus: null, effects: null})
    await stage({command: 'torus-engine', on: false})
    return stopped
  },
  send: (event: LiveEngineEvent): Promise<LiveEngineReading> => adopt(op<LiveEngineReading>('live_engine_send', {event})),
  /** The Torus its owner handed over sounds on the set's part `track`: `lease` is the field's, `sha256` the digest the kernel relayed
   * for the owner's torus-native (the document stays with the kernel); `notes`, the key each MIDI note 0–127 strikes (noteKeys), or null
   * for none. From then on the host follows the owner: each act it lands, and each hand-over again. */
  torus: (lease: string, track: number, sha256: string, notes: readonly ({row: number; column: number} | null)[] | null = null,
    effects: unknown = null): Promise<LiveEngineReading> =>
    adopt(op<LiveEngineReading>('live_engine_torus', {lease, track, sha256, notes, effects})),
  /** The Torus's effects as the frame holds them (effectsLaw.ts EffectsState), on the part following its owner, after the Torus. */
  torusEffects: (effects: unknown): Promise<LiveEngineReading> => adopt(op<LiveEngineReading>('live_engine_torus_effects', {effects})),
  read: (): Promise<LiveEngineReading> => adopt(op<LiveEngineReading>('live_engine_mixer')),
  /** Export Audio: the samples the engine played since Play, to the `.wav` the person chooses in the host's save dialog (the same act
   * as File › Export Audio…); a cancelled dialog is a refusal in the host's words. No path is named from here. */
  exportAudio: (): Promise<LiveEngineExport> => op<LiveEngineExport>('live_engine_export'),
}

/** A touch of the part's: its pitch bend or its channel pressure. */
export type LiveEngineTouch = 'bend' | 'pressure'
const TOUCH_NAME: Record<LiveEngineTouch, string> = {bend: 'pitch bend', pressure: 'channel pressure'}
/** The amount of each touch waiting to go, the latest only, and what the engine last answered for each (null: it moved the part). */
const touchWaiting: Partial<Record<LiveEngineTouch, number>> = {}
const touchAnswer: Record<LiveEngineTouch, string | null> = {bend: null, pressure: null}
let touchSending: Promise<void> | null = null
async function sendTouches(track: number): Promise<void> {
  try {
    for (let kind = nextTouch(); kind; kind = nextTouch()) {
      const amount = touchWaiting[kind]!
      delete touchWaiting[kind]
      try { await op<LiveEngineReading>('live_engine_send', {event: {kind, track, amount}}); touchAnswer[kind] = null } catch (e) { touchAnswer[kind] = words(e) }
    }
  } finally { touchSending = null }
}
const nextTouch = (): LiveEngineTouch | undefined => (['bend', 'pressure'] as const).find(kind => touchWaiting[kind] !== undefined)
/** A pitch bend or channel pressure of the part's (MIDI's, liveMidi.ts midiExpressionAmount) to the instrument the Torus's part holds in
 * the engine (O-I #853 round 16): it moves it from the next block (graph.rs Instrument bend / pressure). A wheel moves faster than the
 * host answers, so one touch is in flight at a time and the latest of each kind goes next; none is queued behind it. Answers null once
 * the engine moved the part, or why it did not, in the engine's words (an instrument that takes no such touch says so); a touch is the
 * part input's to say, never the transport's refusal. While the engine does not play, the part's instrument is the Torus in the live
 * instrument, which takes neither, and that is said. */
export function touchInEngine(kind: LiveEngineTouch, amount: number): Promise<string | null> {
  if (!state.reading?.playing) return Promise.resolve(`A ${TOUCH_NAME[kind]} moves the part's instrument in the engine while the set plays there: the Torus in the live instrument takes none.`)
  const track = torusPartOf(state.kinds)
  if (track === null) return Promise.resolve(`The set has no MIDI part for a ${TOUCH_NAME[kind]} to move.`)
  touchWaiting[kind] = amount
  touchSending ??= sendTouches(track)
  return touchSending.then(() => touchAnswer[kind])
}

/** One of the set's mixer writes, followed into the engine while it plays that set (nothing otherwise: Play bridges the file). */
export async function followInEngine(path: string, event: (kinds: readonly string[]) => LiveEngineEvent | null): Promise<void> {
  if (state.reading?.path !== path || !state.reading.playing) return
  const move = event(state.kinds)
  if (!move) return
  try { await liveEngine.send(move) } catch (e) { throw new Error(`The set keeps it; the engine refused it: ${words(e)}`) }
}

export const liveEngineState = (): EngineState => state
export function subscribeLiveEngine(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
/** The engine's reading and refusal as it stands (the applied mixer, never a move asked). */
export function useLiveEngine(): EngineState {
  return useSyncExternalStore(subscribeLiveEngine, liveEngineState, liveEngineState)
}

const NATIVE_ONLY = 'The Live engine plays in the desktop\'s audio path, the native candidate\'s; it is out of reach here.'
const setName = (path: string) => path.split('/').pop()?.replace(/\.als$/i, '') || path

/** Live's Play and Stop over the open set, when no clip is selected (manual §21.2 Transport, "Play | Plays the clips of the part";
 * §21.1 Rules: every part sounds in one engine, from the first device of its chain to the Main track). Play bridges the set as the file
 * stands and starts the engine; Stop stops it. Play is lit while the engine plays THIS set; what the bridge could not host is said on
 * it; the engine's last refusal stands in its own words. Off the native candidate Play is refused before a press. */
export function engineTransportBindings(setPath: string | null, engine: EngineState, native = detectTransport().kind === 'tauri'): {play: SlotBinding; stop: SlotBinding} {
  const reading = engine.reading
  const refusal = engine.error ? ` The engine refused: ${engine.error}` : ''
  const stop: SlotBinding = reading?.playing
    ? {press: () => void liveEngine.stop().catch(() => {}), title: reading.path === setPath
      ? 'Stop — the engine stops; what it played can be exported (File › Export Audio…).'
      : `Stop — the engine stops ${setName(reading.path)}, the set it plays.`}
    : {refused: 'Nothing plays in the engine, so there is nothing to stop.'}
  if (!setPath) return {play: {lit: false, refused: 'Open a set: Play plays its parts in the engine.'}, stop}
  if (!native) return {play: {lit: false, refused: NATIVE_ONLY}, stop}
  const lit = !!reading?.playing && reading.path === setPath
  const unhosted = lit && reading.warnings.length ? ` Not hosted: ${reading.warnings.join('; ')}.` : ''
  const torus = lit && engine.torus ? ` The Torus sounds in the live instrument, not the engine: ${engine.torus}` : ''
  const notes = lit && engine.notes.refusal ? ` A note of the Torus part was not played: ${engine.notes.refusal}` : ''
  // the Torus's effects in the engine: what does not sound as the frame's, and why the last change did not follow
  const said = lit ? (reading.torus_effects?.chain ?? []).filter(e => e.on && e.words).map(e => e.words) : []
  const effects = said.length ? ` The Torus's effects in the engine: ${said.join(' ')}` : ''
  const unfollowed = lit ? engine.effects ?? reading.torus_effects?.refusal ?? null : null
  const effectsRefused = unfollowed ? ` The Torus's effects did not follow into the engine: ${unfollowed}` : ''
  return {play: {press: () => void liveEngine.play(setPath).catch(() => {}), lit,
    title: `${lit ? `Play — ${setName(setPath)} plays in the engine, every part through its chain to the Main track.`
      : `Play — ${setName(setPath)} plays in the engine as the file stands: every part through its chain to the Main track.`}${unhosted}${torus}${notes}${effects}${effectsRefused}${refusal}`}, stop}
}

/** Live's transport over the engine: its Play and Stop for the open set, as the engine stands. Leaving Live's transport stops the
 * engine, as it stops the clip player (live/clipPlayer.ts useLiveClipPlay): nothing sounds that no bar in front of you can stop. */
export function useLiveEngineTransport(setPath: string | null): {play: SlotBinding; stop: SlotBinding} {
  const engine = useLiveEngine()
  useEffect(() => () => { if (liveEngineState().reading?.playing) void liveEngine.stop().catch(() => {}) }, [])
  return engineTransportBindings(setPath, engine)
}
