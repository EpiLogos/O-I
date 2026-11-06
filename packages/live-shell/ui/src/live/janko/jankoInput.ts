// The keyboard's one playing path (T-LIVE-JANKO-DEVICE; O-I #853). Pointer, touch, the computer keys and MIDI (liveMidi.ts) give the same
// note events, and every one reaches the Torus the same way: each note is a key of the owner's Jankó surface (jankoLayout.ts), struck on
// the Torus's M1′ session (`janko` strike, QL-MEF `torus-play`) and let go from it (`janko` release, QL-MEF `torus-release`). Notes struck
// within one task are one chord, one owner act; releases within one task are one act too, and the acts go in the order they were played.
//
// The path keeps each note exactly as long as it should live (DLW §21.1 The input and Rules; §21.2 The keyboard):
//   a press         strikes its note; a release of its last press releases it, and the body rings on (a held note keeps its own tail)
//   Sustain         the setting, or a sustain pedal: a note whose keys are all lifted keeps sounding until Sustain ends
//   Repeat touch    One note: keys of one pitch hold one note, released with the last of them; Each key: every key is its own note
//   Polyphony       the owner's: past it the oldest notes make way, the owner names them, and the path lets them go
//   Panic           releases every note at once; losing focus or a device releases the notes it held
//   Transpose       moves every note, the fingering kept: the key struck is the one that sounds the moved pitch
//   a clip          (O-I #790) strikes the key a MIDI note of its number strikes, at the owner's sample it names, and holds it until its
//                   own length ends (clipStrike, clipRelease); the clip's notes are written, not played in, so Sustain, Transpose, the
//                   inputs and the note devices leave them as they are. A key a press and the clip both hold is one note of the owner:
//                   struck by each, released with the last of them. Polyphony, the notes that make way and Panic count the clip's notes
//                   with the keys'.
// Nothing here synthesises a sound, places a point or counts voices: the owner does. What a part plays also leaves as MIDI (midiOut); a
// clip's notes leave when they sound (O-I #853 round 22): they are sent one owner lookahead before, so the clip names how long until its
// sample sounds (clipStrike's and clipRelease's `sounds`) and the host holds each message that long (midi.rs `after_ms`). A strike that
// names no time (a bell), and a key that names no note, leave nothing.
import type {StageCommand, StageKey, StageResult} from '@epilogos/expressions-boundary'
import {COMPUTER_KEY_PITCH, keyboardGate, liveJankoWindow, type JankoKey, type JankoWindow, type JankoWindowState} from './jankoLayout'

export type NoteSource = 'pointer' | 'touch' | 'keyboard' | 'midi'
export interface NoteEvent {
  readonly kind: 'down' | 'up'
  readonly pitchClass: number
  readonly source: NoteSource
  /** Pen pressure in (0, 1], where the input carries it. Mouse and touch carry none. */
  readonly pressure?: number | null
  /** MIDI note-on velocity over 127, in (0, 1]. A MIDI note strikes at it; no other source carries it. */
  readonly velocity?: number | null
  /** The press's own identity: a pointer id, a MIDI port, channel and note, a computer key. Absent: one press per source and class. */
  readonly press?: string
  /** The key pressed on the Jankó surface: the note sounds at that key's own touch-point. Absent: the pitch's first touch-point. */
  readonly key?: {readonly row: number; readonly column: number}
  /** The note's number, as MIDI numbers notes. Absent: the surface and the computer keys play the octave from middle C. */
  readonly note?: number
  /** Where on its key the press landed, 0 at the key's far edge to 1 at its near edge: a note's strength under Pointer height. */
  readonly height?: number | null
  /** The MIDI port the note came in on: losing that device releases its notes. */
  readonly port?: string
  /** When the native host received the note, in milliseconds since the epoch (its wall clock): the first leg of the key's latency. */
  readonly receivedAt?: number
}

/** The owner's default strike (controller.playVoices: 0.35 modal metres). A note with no strength of its own strikes at it. */
export const JANKO_DEFAULT_AMPLITUDE = 0.35
/** The surface and the computer keys play the octave from middle C (MIDI 60). */
export const SURFACE_NOTE = 60
/** Transpose's own range in semitones (DLW §21.1 The input). */
export const KEYBOARD_TRANSPOSE = Object.freeze({min: -24, max: 24})

export type KeyboardVelocity = 'pointer-height' | 'pressure' | 'fixed'
export type KeyboardRepeatTouch = 'one-note' | 'each-key'
/** The ways of playing a part, each On or Off (DLW §21.1 The input: Input). */
export interface KeyboardInputs {readonly pointer: boolean; readonly keys: boolean; readonly midi: boolean}
/** The part's input settings (DLW §21.1 The input). Layout is held beside them (keyboardLayout.ts). */
export interface KeyboardSettings {
  readonly inputs: KeyboardInputs
  readonly transpose: number
  readonly velocity: KeyboardVelocity
  readonly sustain: boolean
  readonly repeatTouch: KeyboardRepeatTouch
  /** Pressure (DLW §21.1 The input): "Lets pressure on a held key move the sound. Pressure records into the clip's MPE tab." */
  readonly pressure: boolean
}
/** The manual's defaults: every input On, no Transpose, Velocity from Pointer height, Sustain Off, Repeat touch One note, Pressure On. */
export const KEYBOARD_SETTINGS_DEFAULT: KeyboardSettings = Object.freeze({
  inputs: Object.freeze({pointer: true, keys: true, midi: true}), transpose: 0, velocity: 'pointer-height', sustain: false, repeatTouch: 'one-note',
  pressure: true,
})

const unit = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1
/** The Studio's own pressure law: 0.9 × pressure, clamped to 0.15–0.9. */
const pressureLaw = (pressure: number) => Math.min(0.9, Math.max(0.15, pressure * 0.9))
/** A touch's strike: the pressure law's 0.9 × the rise of the hand's force, with no floor, since a small rise is a small strike. */
export const TOUCH_LAW = 0.9

/** A touch of the hand on the notes it holds (O-I #853): its pressure into them (0 to 1) or its pitch bend along them (−1 down to 1 up). */
export type KeyboardTouch = 'bend' | 'pressure'
/** A touch the part's playing made (O-I #855: Record keeps it on each note it touched, live/liveTake.ts): its kind and amount, its
 * source, the notes it touched (their PlayedNote ids) and when (the page's clock, ms). Told whether or not it struck. */
export interface PlayedTouch {
  readonly kind: KeyboardTouch
  readonly amount: number
  readonly source: NoteSource
  readonly ids: readonly string[]
  readonly at: number
}

/** A note's strength, inside the owner's (0, 1] bound, from where Velocity says it comes. Fixed: every note at the owner's default.
 * MIDI: the note-on velocity over 127, which is the controller's own strength. Pointer height: where the press landed on its key,
 * 0.15 at the far edge to 0.9 at the near edge, a pen's pressure where the press names no height. Pressure: pen pressure by the
 * Studio's law. The computer keys, and a press that carries neither, strike at the owner's default. */
export function strikeAmplitude(event: Pick<NoteEvent, 'source' | 'pressure' | 'velocity' | 'height'>, velocity: KeyboardVelocity = 'pointer-height'): number {
  if (velocity === 'fixed') return JANKO_DEFAULT_AMPLITUDE
  if (event.source === 'midi') return unit(event.velocity) ? event.velocity : JANKO_DEFAULT_AMPLITUDE
  if (event.source === 'keyboard') return JANKO_DEFAULT_AMPLITUDE
  const height = event.height
  if (velocity === 'pointer-height' && typeof height === 'number' && Number.isFinite(height) && height >= 0 && height <= 1) return 0.15 + 0.75 * height
  if (event.source === 'pointer' && unit(event.pressure)) return pressureLaw(event.pressure)
  return JANKO_DEFAULT_AMPLITUDE
}

// The computer keys' row and their gate are the layout's (jankoLayout.ts): the map's faces read them without the keyboard's engine.
export {COMPUTER_KEY_PITCH, keyboardGate, typingTarget} from './jankoLayout'

// ── the sources (O-I #853 round 23) ────────────────────────────────────────────────────────────────────────────────────────────
// What each way of playing gives the one path, as the keyboard device (JankoDevice.tsx) reads it from the event it hears; MIDI's is the
// host's note (liveMidi.ts midiNoteEvent). Every source plays the same keys by the same rules: the tests drive each rule through each.

/** A pointer's press on a key of the surface as the device reads it from its PointerEvent: its kind ('mouse', 'pen', 'touch'), its own id,
 * its pressure, and where on the key it landed (0 at the key's far edge to 1 at its near edge; null where the key has no height). */
export interface SurfacePointer {readonly pointerType: string; readonly pointerId: number; readonly pressure: number; readonly height?: number | null}
/** A finger is touch; a mouse and a pen are the pointer. */
export const pointerSource = (pointerType: string): NoteSource => pointerType === 'touch' ? 'touch' : 'pointer'
/** The note a pointer or a touch plays on a key of the surface: its source by the pointer's kind, the pointer's own identity (so two
 * touch-points of one pitch let go independently), a pen's pressure (a mouse and a finger carry none), and, as it goes down, the key and
 * where on it the press landed. */
export function pointerNote(kind: 'down' | 'up', pitchClass: number, pointer: SurfacePointer, key?: {readonly row: number; readonly column: number}): NoteEvent {
  const source = pointerSource(pointer.pointerType), press = `pointer-${pointer.pointerId}`
  if (kind === 'up') return {kind, pitchClass, source, press}
  return {kind, pitchClass, source, pressure: pointer.pointerType === 'pen' ? pointer.pressure : null, press, height: pointer.height ?? null,
    ...(key ? {key: {row: key.row, column: key.column}} : {})}
}
/** A computer key's event as the device reads it: the key's name, whether it is a held repeat, whether a modifier is held. */
export interface ComputerKey {readonly key: string; readonly repeat: boolean; readonly modifier: boolean}
/** The note a computer key plays, or null where it plays none: a key off the row (COMPUTER_KEY_PITCH), or, going down, one the gate holds
 * back (keyboardGate: the keyboard not armed by its focus, typing in a field, a modifier held, a held repeat). Lifted, it lets its note go
 * only while the keyboard is armed. */
export function computerKeyNote(kind: 'down' | 'up', key: ComputerKey, at: {readonly armed: boolean; readonly editable: boolean}): NoteEvent | null {
  const pitchClass = COMPUTER_KEY_PITCH[key.key.toLowerCase()]
  if (pitchClass === undefined) return null
  const plays = kind === 'up' ? at.armed : keyboardGate({armed: at.armed, editable: at.editable, modifier: key.modifier, repeat: key.repeat})
  return plays ? {kind, pitchClass, source: 'keyboard'} : null
}
/** The presses a surface holds, which its keyboard or the window losing focus lets go: the pointer's, touch's and the computer keys'. A
 * controller's notes are its device's: a hardware key plays whatever holds focus. */
export const surfacePress = (press: PlayingPress): boolean => press.source !== 'midi'
/** The presses of the MIDI devices lost (liveMidi.ts lostMidiPorts), which losing them lets go. */
export const lostDevicePress = (ports: readonly string[]) => (press: PlayingPress): boolean => press.source === 'midi' && ports.includes(press.port ?? '')

// ── the keys of the surface ────────────────────────────────────────────────────────────────────────────────────────────────────
// The owner's window is one period of the surface: six rows by six columns, every pitch class at each of its touch-points once. The
// surface repeats every period (QL-MEF janko.rs COLUMN_PERIOD), so a note names its key in the window and the period it is played in:
// the same place on the helix, the octave as a column a whole period on. The octave is the note's own, never a guess: two notes an
// octave apart are two notes, each released by its own key.

/** Periods below the note numbers' zero: Transpose's lowest note (−24) still stands at a column of the surface. */
const PERIODS_BELOW = 2
const COLUMN_MAX = 65535

export interface SurfaceKeys {
  readonly first: number
  readonly period: number
  readonly at: ReadonlyMap<string, JankoKey>
  readonly place: ReadonlyMap<string, JankoKey>
}

/** The keys of the owner's window, by pitch class and touch-point and by place; null when the window is not one whole period. */
export function surfaceKeys(window: JankoWindow): SurfaceKeys | null {
  const columns = window.columns, period = columns.length
  if (period < 1 || columns.some((column, i) => column !== columns[0] + i)) return null
  const at = new Map<string, JankoKey>(), place = new Map<string, JankoKey>()
  for (const row of window.rows) for (const key of row) {
    at.set(`${key.pitchClass}/${key.touchPoint}`, key)
    place.set(`${key.row}/${key.column}`, key)
  }
  for (let pc = 0; pc < 12; pc += 1) if (!at.has(`${pc}/0`)) return null
  return {first: columns[0], period, at, place}
}

const mod = (value: number, by: number) => ((value % by) + by) % by

/** The key that sounds `note` at `touchPoint` (its first touch-point when it has no such one), or null off the surface. */
export function keyForNote(keys: SurfaceKeys, note: number, touchPoint = 0): StageKey | null {
  if (!Number.isSafeInteger(note)) return null
  const pc = mod(note, 12), periods = Math.floor(note / 12) + PERIODS_BELOW
  const key = keys.at.get(`${pc}/${touchPoint}`) ?? keys.at.get(`${pc}/0`)
  if (!key || periods < 0) return null
  const column = key.column + keys.period * periods
  return column >= 0 && column <= COLUMN_MAX ? {row: key.row, column} : null
}

/** The key each MIDI note 0–127 strikes on the surface `window` holds, by the one pitch→key law (keyForNote at touch-point 0, as a clip's
 * note with no touch strikes; O-I #853), or null where the law gives a note no key: what the Torus in the desktop's one engine strikes a
 * MIDI note on its part by (O-I #849), so a note sounds there as it sounds through the frame. Null for a window that is not one surface. */
export function noteKeys(window: JankoWindow): (StageKey | null)[] | null {
  const keys = surfaceKeys(window)
  return keys ? Array.from({length: 128}, (_, note) => keyForNote(keys, note)) : null
}

/** The touch-point a key of the surface sounds its pitch at (keyForNote's `touchPoint`), or null for a key the window does not hold. */
export function touchOfKey(keys: SurfaceKeys, key: StageKey): number | null {
  return keys.place.get(`${key.row}/${keys.first + mod(key.column - keys.first, keys.period)}`)?.touchPoint ?? null
}

/** The note a key sounds (the inverse of keyForNote), or null for a key the window does not hold. */
export function noteOfKey(keys: SurfaceKeys, key: StageKey): number | null {
  const offset = key.column - keys.first
  const found = keys.place.get(`${key.row}/${keys.first + mod(offset, keys.period)}`)
  return found ? 12 * (Math.floor(offset / keys.period) - PERIODS_BELOW) + found.pitchClass : null
}

// ── MIDI out and the measurement hook ──────────────────────────────────────────────────────────────────────────────────────────

/** What leaves as MIDI: a note struck or let go (channel 0–15, note and velocity 0–127), or every note of a channel let go (Panic). */
export type MidiOutMessage =
  | {readonly kind: 'on' | 'off'; readonly channel: number; readonly note: number; readonly velocity: number}
  | {readonly kind: 'all-off'; readonly channel: number}

/** One strike's timing, for the key-to-sound measurement: when the first note of the act was pressed (the page's clock), when its act
 * was sent and when the owner answered (ms on the same clock), for MIDI the host's leg, from its receipt of the note to the page (ms on
 * the wall clock both share), and when its act was sent on that wall clock (`sentAt`, O-I #849 round 22: the clock of the engine's
 * pairs). */
export interface KeyLatency {
  readonly sources: readonly NoteSource[]
  readonly keys: number
  readonly pressedAt: number
  readonly queuedMs: number
  readonly ownerMs: number | null
  readonly hostMs: number | null
  readonly ok: boolean
  readonly sentAt?: number
  /** When the host received the act's earliest MIDI note, on its wall clock (O-I #853 round 23): a hardware key's first leg. */
  readonly receivedAt?: number
}
const LATENCY_KEPT = 64

/** One strike's pair on the host (live_engine_host.rs latency `strikes`, O-I #849 round 22): the part and the frame it sounds at, when
 * the host sent it to the engine and when the engine mixed that frame (ms on the host's wall clock), and the span between. */
export interface EngineStrike {
  readonly track: number
  readonly frame: number
  readonly sent_at_ms: number
  readonly sounds_at_ms: number
  readonly ms: number
  /** The engine's own key-to-sound (DLW build ruling 2026-11-06; live-engine StrikeTime): the frame the strike reached the engine, the
   * first frame its part sounded (null: it sounded nothing), and the span between in frames, ms and the engine's blocks (null with it). */
  readonly reached_frame?: number
  readonly sounded_frame?: number | null
  readonly to_sound?: {readonly frames: number; readonly ms: number; readonly blocks: number} | null
}
/** The engine's own legs of key-to-sound, as its host reads them (live_engine_host.rs reading `latency`, O-I #853 round 18), with the
 * latest strikes' pairs, oldest first (round 22). */
export interface EngineLatency {
  readonly block_frames: number
  readonly block_ms: number
  readonly longest_wait_ms: number
  readonly output_latency_ms: number
  readonly strikes?: readonly EngineStrike[]
}
/** One strike's key-to-sound, joined from the parts that exist: each part with its ms, their sum, the parts not measured, in words, and
 * the engine's pair it was joined with, where one was. */
export interface KeyToSound {
  readonly ms: number
  readonly parts: readonly (readonly [string, number])[]
  readonly unmeasured: readonly string[]
  readonly engine?: EngineStrike
}
/** How far the page's wall clock and the host's are read apart: a pair this much outside the owner's strike is still its own. */
const PAIR_SLACK_MS = 1
/** Join one strike's timing with the engine's legs while the engine plays the Torus (`engine`; null: the owner sounds it itself): the
 * host's leg (MIDI), the page's queue, the owner's strike, then the engine's block at worst and the device's output. A hardware key joined
 * with its pair is read on the host's clock from the host's receipt of its note (`receivedAt`, round 23): to the engine, the engine to its
 * sound, then the device's output. What is not measured
 * is named: the controller's leg to the host for MIDI, and the owner's lead over the engine (or, alone, the owner's own sound). Null for a
 * strike the owner refused: it sounded nothing. Pure.
 *
 * Where the engine names the pair of a strike the host sent it while the owner struck this act (from its send to its answer, on the wall
 * clock), that is this act's sound (O-I #849 round 22): the page's leg to the engine and the engine's to its sound are measured, and the
 * owner's lead over the engine is no longer unmeasured; the first such pair is joined, and named. */
/** The engine's pair of a strike the host sent it while the owner struck this act (from its send to its answer, on the wall clock), or none. */
function pairOf(strike: KeyLatency, engine: EngineLatency | null): EngineStrike | undefined {
  const sentAt = strike.sentAt, ownerMs = strike.ownerMs
  return engine && sentAt !== undefined && ownerMs !== null
    ? engine.strikes?.find(e => e.sent_at_ms >= sentAt - PAIR_SLACK_MS && e.sent_at_ms <= sentAt + ownerMs + PAIR_SLACK_MS) : undefined
}
export function keyToSound(strike: KeyLatency, engine: EngineLatency | null): KeyToSound | null {
  if (!strike.ok || strike.ownerMs === null) return null
  const parts: [string, number][] = []
  const sentAt = strike.sentAt
  const pair = pairOf(strike, engine)
  // A hardware key (O-I #853 round 23): read as the engine's pairs are, on the host's own clock, from its receipt of the note.
  const receivedAt = strike.receivedAt
  if (engine && pair && receivedAt !== undefined) {
    const legs: [string, number][] = [['MIDI in, from the host\'s receipt to the engine', Math.max(0, pair.sent_at_ms - receivedAt)],
      ['the engine, to its sound', pair.ms], ['the device\'s output', engine.output_latency_ms]]
    return {ms: Math.round(legs.reduce((sum, [, ms]) => sum + ms, 0) * 100) / 100, parts: legs, unmeasured: ['the controller to the host'], engine: pair}
  }
  if (strike.hostMs !== null) parts.push(['the host to the page', strike.hostMs])
  if (engine && pair) {
    parts.push(['the page\'s queue', strike.queuedMs], ['the page to the engine', Math.max(0, pair.sent_at_ms - sentAt!)],
      ['the engine, to its sound', pair.ms], ['the device\'s output', engine.output_latency_ms])
    return {ms: Math.round(parts.reduce((sum, [, ms]) => sum + ms, 0) * 100) / 100, parts,
      unmeasured: strike.hostMs !== null ? ['the controller to the host'] : [], engine: pair}
  }
  parts.push(['the page\'s queue', strike.queuedMs], ['the owner\'s strike', strike.ownerMs])
  if (engine) parts.push(['the engine\'s block, at worst', engine.block_ms], ['the device\'s output', engine.output_latency_ms])
  const unmeasured = [...(strike.hostMs !== null ? ['the controller to the host'] : []),
    engine ? 'the owner\'s lead over the engine, which renders behind it' : 'the owner\'s own sound after its strike']
  return {ms: Math.round(parts.reduce((sum, [, ms]) => sum + ms, 0) * 100) / 100, parts, unmeasured}
}
const msText = (ms: number) => String(Math.round(ms * 100) / 100)
/** The joined measurement as one plain line. */
export const keyToSoundLine = (joined: KeyToSound) =>
  `Key to sound: ${msText(joined.ms)} ms (${joined.parts.map(([part, ms]) => `${part} ${msText(ms)}`).join(' · ')}); not measured: ${joined.unmeasured.join(', ')}.`

/** The inputs the engine's key-to-sound is read back by (DLW build ruling 2026-11-06): the pointer (a touch is a pointer's), the computer
 * keys and MIDI. */
export const KEY_TO_SOUND_INPUTS = ['pointer', 'keys', 'midi'] as const
export type KeyToSoundInput = (typeof KEY_TO_SOUND_INPUTS)[number]
const INPUT_OF: Readonly<Record<NoteSource, KeyToSoundInput>> = {pointer: 'pointer', touch: 'pointer', keyboard: 'keys', midi: 'midi'}
/** One input's latest key-to-sound as the engine measured it: the frame it reached the engine, the frame its part first sounded, and the
 * span in frames, ms and blocks; the last four null where it sounded nothing. */
export interface EngineKeyToSound {
  readonly reached_frame: number
  readonly sounded_frame: number | null
  readonly frames: number | null
  readonly ms: number | null
  readonly blocks: number | null
}
export type KeyToSoundByInput = Readonly<Record<KeyToSoundInput, EngineKeyToSound | null>>
/** The candidate's readback of key-to-sound (DLW build ruling 2026-11-06, #849 and #853: "The candidate's readback carries the latest of
 * each, per input kind (pointer, keys, MIDI), in ms and in blocks"): for each input, the latest strike of it the owner took that is joined
 * with the engine's pair as keyToSound joins it, read as the engine measured it; null for an input none was. A strike's input is its first
 * note's. Pure. */
export function keyToSoundByInput(strikes: readonly KeyLatency[], engine: EngineLatency | null): KeyToSoundByInput {
  const by: Record<KeyToSoundInput, EngineKeyToSound | null> = {pointer: null, keys: null, midi: null}
  for (const strike of strikes) {
    const source = strike.sources[0]
    if (!strike.ok || source === undefined) continue
    const pair = pairOf(strike, engine)
    if (!pair || typeof pair.reached_frame !== 'number' || pair.sounded_frame === undefined) continue
    const to = pair.to_sound ?? null
    by[INPUT_OF[source]] = {reached_frame: pair.reached_frame, sounded_frame: pair.sounded_frame, frames: to?.frames ?? null, ms: to?.ms ?? null, blocks: to?.blocks ?? null}
  }
  return by
}
const INPUT_WORD: Readonly<Record<KeyToSoundInput, string>> = {pointer: 'pointer', keys: 'keys', midi: 'MIDI'}
/** The readback as one plain line, each input measured in ms and blocks; null while none is. */
export function keyToSoundByInputLine(by: KeyToSoundByInput): string | null {
  const said = KEY_TO_SOUND_INPUTS.flatMap(kind => {
    const it = by[kind]
    if (!it) return []
    return [it.ms === null || it.blocks === null ? `${INPUT_WORD[kind]} sounded nothing` : `${INPUT_WORD[kind]} ${msText(it.ms)} ms (${msText(it.blocks)} blocks)`]
  })
  return said.length ? `In the engine, key to sound: ${said.join(' · ')}.` : null
}

// ── the path ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Said when no surface is there to play: the owner has not served its window (or refused it), so a note has no key. */
export const NO_SURFACE = 'the keyboard has no surface from the owner yet, so the note has no key to strike'

export interface JankoInputOptions {
  /** The owner's channel: one janko stage command per act. */
  readonly send: (command: StageCommand) => Promise<StageResult>
  /** Each act's answer: the owner's refusal names what did not sound. */
  readonly onResult?: (result: StageResult) => void
  /** The pitch classes held down, after every change. */
  readonly onHeld?: (held: readonly number[]) => void
  /** Anything the path holds changed: the keys sounding, the presses, a refusal. */
  readonly onChange?: () => void
  /** The note-device chain (T-LIVE-MODE-SCALES item 3): a note's pitch class in, the classes it sounds out, before its key is found.
   * Absent is the identity. */
  readonly transform?: (pitchClasses: readonly number[]) => readonly number[]
  /** The owner's window. Defaults to the one the shell holds (jankoLayout.ts). */
  readonly window?: () => JankoWindowState | null
  /** The part's input settings. Defaults to the manual's. */
  readonly settings?: () => KeyboardSettings
  /** What the part plays, as MIDI, in the order it is played: at once, or `afterMs` from now, when a clip's note sounds. */
  readonly midiOut?: (messages: readonly MidiOutMessage[], afterMs?: number) => void
  /** The page's monotonic clock and the wall clock (both in ms), for the measurement hook. */
  readonly now?: () => number
  readonly wallNow?: () => number
  /** Each note the part's playing strikes and lets go, as it happens (O-I #855: Record keeps them, live/liveTake.ts). A clip's notes and a
   * bell are not played by hand and are not told. */
  readonly onNote?: (played: PlayedNote) => void
  /** Each touch of the hand on the notes it holds, as it happens (O-I #853: Record keeps it on the notes it touched). */
  readonly onTouch?: (touch: PlayedTouch) => void
}

/** A note the part's playing struck (`on`: its number, its key and the touch-point it sounds at, its strength and source) or that ended
 * (`off`: let go, made way, or Panic), at the page's clock (ms). A key struck again while it sounds is a new note: an `on` with no `off`
 * between. */
export interface PlayedNote {
  readonly kind: 'on' | 'off'
  readonly id: string
  readonly note: number
  readonly key: StageKey
  readonly touch: number
  readonly amplitude: number
  readonly source: NoteSource | null
  readonly at: number
}

export interface PlayingPress {readonly id: string; readonly source: NoteSource; readonly port: string | null}

/** One note of a clip on the path (O-I #790): its number, as MIDI numbers notes, the hold that keeps it until the clip lets it go, and the
 * touch-point it strikes at (a take keeps the one each note was played at, O-I #855; absent, the pitch's first). A take's course names
 * the very key each act struck (`key`, O-I #855 round 6d): that key is struck, whatever the window, and its number is the one it was
 * played as (-1 where the take did not name it). */
export interface ClipHold {readonly hold: string; readonly note: number; readonly touch?: number; readonly key?: StageKey}

export interface JankoInput {
  down(event: NoteEvent): void
  up(event: NoteEvent): void
  /** The pitch classes held down now. */
  held(): readonly number[]
  /** The keys sounding now: struck, not released, not made way. */
  sounding(): readonly StageKey[]
  /** A sustain pedal (MIDI controller 64): pressed, lifted notes sound on; lifted, every note no key holds is released. */
  pedal(down: boolean): void
  /** The settings changed: with Sustain now off, every note no key holds is released. */
  refresh(): void
  /** Release every note at once, held or sustained. */
  panic(): void
  /** Let go of the presses `which` names (focus lost, a device lost): every note they alone held is released, Sustain or not. */
  releaseWhere(which: (press: PlayingPress) => boolean): void
  /** The last strikes' timing, oldest first. */
  latency(): readonly KeyLatency[]
  /** A clip's note-ons, one act at one strength, landing at the owner's sample `at` (DLW §21.2 "A note in a clip | Its key's point, as
   * the clip plays"). Each note strikes the key a MIDI note of its number strikes and is held by its hold until clipRelease; a key a press
   * or the clip already sounds is struck again and held by both. Settles with the owner's answer, or the refusal when there is no surface.
   * `sounds`: ms from now until the sample sounds; each note of a MIDI number then leaves as MIDI that long from now (O-I #853 round 22). */
  clipStrike(notes: readonly ClipHold[], amplitude: number, at: string, sounds?: number): Promise<StageResult>
  /** The clip lets these holds go (a note's length ended, or Stop): each note sounds on only while a press or another hold keeps it. A hold
   * whose note made way, or that Panic let go, is owed nothing. `sounds`: ms from now until the end sounds, when its note-off leaves; none
   * (Stop) leaves at once, and the host holds it behind its note-on. */
  clipRelease(holds: readonly string[], sounds?: number): void
  /** A touch of the hand on the notes it holds (O-I #853; DLW §21.2 The keyboard: "Velocity and pressure set how hard each point is
   * struck"; §21.4 Rules: "Pressure or bend on a held note moves the sound. It does not change the tuning"): `kind`'s `amount` (pressure
   * 0 to 1; bend −1 to 1, its force either way from rest) on the notes the presses of `source` hold (of `press` alone, where named, as a
   * pen's pressure is its own press's). A rise of the hand's force strikes those keys again, as one act, by TOUCH_LAW × the rise; a fall
   * lets go, and the body rings on. No note begins or ends, and no key moves: the tuning stays. Pressure Off moves nothing by pressure.
   * Answers whether it struck. Told (onTouch) whenever it touched a note. */
  touch(kind: KeyboardTouch, amount: number, source: NoteSource, press?: string): boolean
  /** A bell (the QL sitting's, inhabitants/ql/devices/qlSitting.ts): one note of `pitchClass` in the octave from middle C, struck at the
   * owner's own cursor and let go at once, so it rings out on the body and keeps no place among the notes Polyphony counts. A key a press
   * holds is struck again and sounds on under the press. Settles with the strike's answer, or the refusal in words. */
  ring(pitchClass: number, amplitude: number): Promise<StageResult>
}

interface Press extends PlayingPress {readonly pitchClass: number; readonly notes: readonly string[]}
/** A sounding note: one key of the owner. Its number, the presses and the clip's holds keeping it, the act that struck it, the press that
 * lifted last (Sustain then holds it for that press's source, so losing that source's focus or device lets it go), and whether its
 * note-on left as MIDI. */
interface Note {
  readonly id: string; readonly key: StageKey; readonly note: number
  presses: Set<string>; clips: Set<string>; act: number; lifted: PlayingPress | null; out: boolean
  /** A press struck it: its end is told (onNote). */
  played: boolean
}
type Act =
  | {kind: 'strike'; seq: number; keys: Map<string, StageKey>; amplitude: number; sources: Set<NoteSource>; pressedAt: number; hostMs: number | null; receivedAt: number | null
    /** A clip's act (or a bell's): the owner's sample it lands at (a bell's, none: the owner's own cursor), and its answer to the clip.
     * Never merged with a press's act. */
    clip: {readonly at: string | undefined; readonly settle: (result: StageResult) => void} | null
    /** A touch's act: held keys struck again by a rise of the hand's force, never merged with a note's, and not timed as a key's. */
    touch?: true}
  | {kind: 'release'; keys: Map<string, StageKey>}

const keyId = (key: StageKey) => `${key.row}/${key.column}`
/** A key of the owner's six-row surface: row 0..5, column 0..65535. */
const onSurface = (key: StageKey) => Number.isSafeInteger(key.row) && key.row >= 0 && key.row < 6 && Number.isSafeInteger(key.column) && key.column >= 0 && key.column <= COLUMN_MAX
const enabled = (inputs: KeyboardInputs, source: NoteSource) => source === 'midi' ? inputs.midi : source === 'keyboard' ? inputs.keys : inputs.pointer
const failed = (cause: unknown): StageResult => ({ok: false, error: String(cause instanceof Error ? cause.message : cause)})
const OUT_CHANNEL = 0
const MAX_KEYS = 32
/** Said when a bell names no pitch class. */
export const NO_BELL_NOTE = 'the bell names no note of the twelve, so it has no key to strike'

/** One input path for every source, each note held exactly as long as it should be. */
export function createJankoInput(options: JankoInputOptions): JankoInput {
  const settings = options.settings ?? (() => KEYBOARD_SETTINGS_DEFAULT)
  const windowOf = options.window ?? liveJankoWindow
  const now = options.now ?? (() => performance.now())
  const wallNow = options.wallNow ?? (() => Date.now())
  const presses = new Map<string, Press>()
  const notes = new Map<string, Note>()
  /** The clip's holds, each to the note it keeps. */
  const holds = new Map<string, string>()
  const timings: KeyLatency[] = []
  /** The hand's force of each touch, by kind and its source (or press): where its next rise is measured from. */
  const forces = new Map<string, number>()
  let pedalDown = false
  let seq = 0
  let queue: Act[] = []
  let flushing = false
  let bells = 0

  const heldClasses = () => [...new Set([...presses.values()].map(press => press.pitchClass))].sort((a, b) => a - b)
  const changed = () => { options.onHeld?.(heldClasses()); options.onChange?.() }
  const out = (messages: MidiOutMessage[], afterMs?: number) => { if (messages.length > 0) options.midiOut?.(messages, afterMs) }
  const velocityOf = (amplitude: number) => Math.max(1, Math.min(127, Math.round(amplitude * 127)))
  /** A note of a MIDI number, which can leave as MIDI. */
  const numbered = (note: Note) => note.note >= 0 && note.note <= 127
  const sustaining = () => settings().sustain || pedalDown
  const schedule = () => { if (!flushing) { flushing = true; queueMicrotask(flush) } }
  /** The note sounding on `key`, whoever holds it: the owner counts one note a key. */
  const onKey = (key: StageKey) => { for (const note of notes.values()) if (keyId(note.key) === keyId(key)) return note; return undefined }
  const gone = (note: Note) => {
    notes.delete(note.id)
    for (const hold of note.clips) holds.delete(hold)
    if (note.played) options.onNote?.({kind: 'off', id: note.id, note: note.note, key: note.key, touch: 0, amplitude: 0, source: null, at: now()})
  }
  const unheld = (note: Note) => note.presses.size === 0 && note.clips.size === 0

  const strike = (note: Note, amplitude: number, source: NoteSource, hostMs: number | null, receivedAt: number | null, touch: number) => {
    const last = queue.at(-1)
    const act = last?.kind === 'strike' && last.clip === null && !last.touch && !last.keys.has(keyId(note.key)) && last.keys.size < MAX_KEYS ? last
      : {kind: 'strike' as const, seq: ++seq, keys: new Map<string, StageKey>(), amplitude, sources: new Set<NoteSource>(), pressedAt: now(), hostMs, receivedAt, clip: null}
    if (act !== last) queue.push(act)
    act.keys.set(keyId(note.key), note.key)
    act.amplitude = Math.max(act.amplitude, amplitude)
    act.sources.add(source)
    if (hostMs !== null) act.hostMs = Math.max(act.hostMs ?? 0, hostMs)
    if (receivedAt !== null) act.receivedAt = Math.min(act.receivedAt ?? receivedAt, receivedAt)
    note.act = act.seq
    note.played = true
    options.onNote?.({kind: 'on', id: note.id, note: note.note, key: note.key, touch, amplitude, source, at: now()})
    if (numbered(note)) {
      out([{kind: 'on', channel: OUT_CHANNEL, note: note.note, velocity: velocityOf(amplitude)}])
      note.out = true
    }
    schedule()
  }
  /** Let the note go at the owner; its note-off leaves at once, or `afterMs` from now when a clip's end sounds then. */
  const release = (note: Note, afterMs?: number) => {
    gone(note)
    const last = queue.at(-1)
    const act = last?.kind === 'release' && last.keys.size < MAX_KEYS ? last : {kind: 'release' as const, keys: new Map<string, StageKey>()}
    if (act !== last) queue.push(act)
    act.keys.set(keyId(note.key), note.key)
    if (note.out) out([{kind: 'off', channel: OUT_CHANNEL, note: note.note, velocity: 0}], afterMs)
    schedule()
  }
  /** The owner named notes that made way: they no longer sound, so they are let go here too (no release is owed for them). A key this
   * same act struck again is its own new note, never one that made way. */
  const madeWay = (act: Extract<Act, {kind: 'strike'}>, keys: readonly StageKey[]) => {
    let moved = false
    for (const key of keys) {
      if (act.keys.has(keyId(key))) continue
      for (const note of [...notes.values()]) {
        if (keyId(note.key) !== keyId(key) || note.act > act.seq) continue
        gone(note)
        if (note.out) out([{kind: 'off', channel: OUT_CHANNEL, note: note.note, velocity: 0}])
        moved = true
      }
    }
    if (moved) options.onChange?.()
  }
  const answered = (result: StageResult) => { options.onResult?.(result); options.onChange?.() }
  function flush() {
    flushing = false
    const acts = queue
    queue = []
    for (const act of acts) {
      const keys = [...act.keys.values()]
      if (act.kind === 'release') {
        void options.send({command: 'janko', action: 'release', keys}).then(result => { if (!result.ok) answered(result) }, cause => answered(failed(cause)))
        continue
      }
      const clip = act.clip
      if (clip) {
        const landing = clip.at === undefined ? {} : {at_samples_elapsed: clip.at}
        void options.send({command: 'janko', action: 'strike', keys, amplitude: act.amplitude, ...landing}).then(result => {
          if (result.ok && result.made_way?.length) madeWay(act, result.made_way)
          answered(result)
          clip.settle(result)
        }, cause => { const result = failed(cause); answered(result); clip.settle(result) })
        continue
      }
      if (act.touch) {
        void options.send({command: 'janko', action: 'strike', keys, amplitude: act.amplitude}).then(result => {
          if (result.ok && result.made_way?.length) madeWay(act, result.made_way)
          if (!result.ok) answered(result)
        }, cause => answered(failed(cause)))
        continue
      }
      const sentAt = now(), sentWall = wallNow()
      const timed = (ok: boolean) => {
        timings.push({sources: [...act.sources], keys: keys.length, pressedAt: act.pressedAt, queuedMs: sentAt - act.pressedAt, ownerMs: now() - sentAt, hostMs: act.hostMs, ok,
          sentAt: sentWall, ...(act.receivedAt !== null ? {receivedAt: act.receivedAt} : {})})
        if (timings.length > LATENCY_KEPT) timings.splice(0, timings.length - LATENCY_KEPT)
      }
      void options.send({command: 'janko', action: 'strike', keys, amplitude: act.amplitude}).then(result => {
        timed(result.ok)
        if (result.ok && result.made_way?.length) madeWay(act, result.made_way)
        answered(result)
      }, cause => { timed(false); answered(failed(cause)) })
    }
  }

  /** Notes struck and held by their holds, in acts of their own at the sample `at` (none: the owner's own cursor); each of a MIDI number
   * leaves as MIDI `sounds` ms from now, when its sample sounds (none: nothing leaves). */
  function holdStrike(clipNotes: readonly ClipHold[], amplitude: number, at: string | undefined, sounds?: number): Promise<StageResult> {
    const state = windowOf()
    const keys = state?.ok ? surfaceKeys(state.window) : null
    // A key of its own needs no window: only a note the path must find a key for does.
    if (!keys && clipNotes.some(clip => clip.key === undefined)) {
      const refusal: StageResult = {ok: false, error: state && !state.ok ? `${NO_SURFACE} (${state.fault})` : NO_SURFACE}
      options.onResult?.(refusal)
      options.onChange?.()
      return Promise.resolve(refusal)
    }
    const struck: Note[] = []
    for (const {hold, note, touch, key: own} of clipNotes) {
      if (!Number.isSafeInteger(note) || holds.has(hold)) continue
      const key = own !== undefined ? (onSurface(own) ? {row: own.row, column: own.column} : null)
        : keyForNote(keys!, note, Number.isSafeInteger(touch) && touch! >= 0 ? touch : 0)
      if (!key) continue
      const sounding = onKey(key)
      const target = sounding ?? {id: `clip:${keyId(key)}`, key, note, presses: new Set<string>(), clips: new Set<string>(), act: 0, lifted: null, out: false, played: false}
      target.clips.add(hold)
      target.lifted = null
      holds.set(hold, target.id)
      notes.set(target.id, target)
      if (!struck.includes(target)) struck.push(target)
    }
    if (struck.length === 0) return Promise.resolve({ok: true})
    if (sounds !== undefined && Number.isFinite(sounds)) {
      const leaving = struck.filter(numbered)
      out(leaving.map(note => ({kind: 'on' as const, channel: OUT_CHANNEL, note: note.note, velocity: velocityOf(amplitude)})), Math.max(0, sounds))
      for (const note of leaving) note.out = true
    }
    let waiting = Math.ceil(struck.length / MAX_KEYS)
    let first: StageResult | null = null
    const answer = new Promise<StageResult>(resolve => {
      const settle = (result: StageResult) => {
        if (first === null || (first.ok && !result.ok)) first = result
        else if (first.ok && result.ok && result.made_way?.length) first = {ok: true, made_way: [...(first.made_way ?? []), ...result.made_way]}
        if (--waiting === 0) resolve(first)
      }
      for (let from = 0; from < struck.length; from += MAX_KEYS) {
        const act = {kind: 'strike' as const, seq: ++seq, keys: new Map<string, StageKey>(), amplitude, sources: new Set<NoteSource>(), pressedAt: now(),
          hostMs: null, receivedAt: null, clip: {at, settle}}
        for (const note of struck.slice(from, from + MAX_KEYS)) { act.keys.set(keyId(note.key), note.key); note.act = act.seq }
        queue.push(act)
      }
    })
    schedule()
    options.onChange?.()
    return answer
  }
  /** The holds let go: each note sounds on only while a press or another hold keeps it; a note-off leaves `sounds` ms from now (none: at
   * once). */
  function holdRelease(gone: readonly string[], sounds?: number): void {
    let moved = false
    for (const hold of gone) {
      const id = holds.get(hold)
      holds.delete(hold)
      const note = id === undefined ? undefined : notes.get(id)
      if (!note || !note.clips.delete(hold)) continue
      if (unheld(note) && !(note.lifted !== null && sustaining())) {
        release(note, sounds !== undefined && Number.isFinite(sounds) ? Math.max(0, sounds) : undefined)
        moved = true
      }
    }
    if (moved) options.onChange?.()
  }

  return {
    down(event) {
      if (!Number.isInteger(event.pitchClass) || event.pitchClass < 0 || event.pitchClass > 11) return
      const set = settings()
      if (!enabled(set.inputs, event.source)) return
      const id = `${event.source}:${event.press ?? event.pitchClass}`
      if (presses.has(id)) return
      const state = windowOf()
      const keys = state?.ok ? surfaceKeys(state.window) : null
      if (!keys) { options.onResult?.({ok: false, error: state && !state.ok ? `${NO_SURFACE} (${state.fault})` : NO_SURFACE}); options.onChange?.(); return }
      const pressed = event.key ? keys.place.get(keyId(event.key)) : undefined
      const touchPoint = pressed?.touchPoint ?? 0
      const base = (Number.isSafeInteger(event.note) ? event.note! : SURFACE_NOTE + (pressed?.pitchClass ?? event.pitchClass)) + set.transpose
      const classes = options.transform ? [...new Set(options.transform([mod(base, 12)]))] : [mod(base, 12)]
      const amplitude = strikeAmplitude(event, set.velocity)
      const receivedAt = event.source === 'midi' && typeof event.receivedAt === 'number' && Number.isFinite(event.receivedAt) ? event.receivedAt : null
      const hostMs = receivedAt !== null ? Math.max(0, wallNow() - receivedAt) : null
      const held: string[] = []
      for (const pc of classes) {
        if (!Number.isInteger(pc) || pc < 0 || pc > 11) continue
        const note = base + mod(pc - mod(base, 12) + 6, 12) - 6
        const key = keyForNote(keys, note, touchPoint)
        if (!key) continue
        const identity = set.repeatTouch === 'one-note' ? `note:${note}` : `key:${keyId(key)}`
        // One note a key: a key the clip sounds is that note, whatever repeat touch names it.
        const sounding = notes.get(identity) ?? onKey(key)
        if (held.includes(sounding?.id ?? identity)) continue
        held.push(sounding?.id ?? identity)
        if (sounding && sounding.presses.size > 0) { sounding.presses.add(id); continue }
        // A note only Sustain or the clip holds is struck again on its own key, as a sustained piano key is; a new note strikes the key
        // pressed.
        const struck = sounding ?? {id: identity, key, note, presses: new Set<string>(), clips: new Set<string>(), act: 0, lifted: null, out: false, played: false}
        struck.presses = new Set([id])
        struck.lifted = null
        notes.set(struck.id, struck)
        strike(struck, amplitude, event.source, hostMs, receivedAt, touchOfKey(keys, struck.key) ?? 0)
      }
      presses.set(id, {id, source: event.source, port: event.port ?? null, pitchClass: event.pitchClass, notes: held})
      changed()
    },
    up(event) {
      const id = `${event.source}:${event.press ?? event.pitchClass}`
      const press = presses.get(id)
      if (!press) return
      presses.delete(id)
      for (const kind of ['bend', 'pressure']) forces.delete(`${kind}|${id}`)
      for (const identity of press.notes) {
        const note = notes.get(identity)
        if (!note) continue
        note.presses.delete(id)
        if (note.presses.size > 0) continue
        if (sustaining()) note.lifted = press
        else if (note.clips.size === 0) release(note)
      }
      changed()
    },
    held: heldClasses,
    sounding: () => [...notes.values()].map(note => note.key),
    pedal(down) {
      pedalDown = down
      this.refresh()
    },
    refresh() {
      if (sustaining()) return
      let moved = false
      for (const note of [...notes.values()]) if (unheld(note)) { release(note); moved = true }
      if (moved) changed()
    },
    panic() {
      const all = [...notes.values()]
      presses.clear()
      for (const note of all) release(note)
      out([{kind: 'all-off', channel: OUT_CHANNEL}])
      changed()
    },
    releaseWhere(which) {
      const gone = [...presses.values()].filter(which)
      const sustained = [...notes.values()].filter(note => unheld(note) && note.lifted !== null && which(note.lifted))
      if (gone.length === 0 && sustained.length === 0) return
      for (const press of gone) {
        presses.delete(press.id)
        for (const identity of press.notes) {
          const note = notes.get(identity)
          if (!note) continue
          note.presses.delete(press.id)
          if (unheld(note)) release(note)
        }
      }
      for (const note of sustained) release(note)
      changed()
    },
    latency: () => [...timings],
    touch(kind, amount, source, press) {
      const range = kind === 'bend' ? amount >= -1 && amount <= 1 : amount >= 0 && amount <= 1
      if ((kind !== 'bend' && kind !== 'pressure') || !Number.isFinite(amount) || !range) return false
      const by = press === undefined ? null : `${source}:${press}`
      const at = `${kind}|${by ?? source}`
      const force = Math.abs(amount), rise = force - (forces.get(at) ?? 0)
      forces.set(at, force)
      const touched = [...notes.values()].filter(note => [...note.presses].some(id => by === null ? presses.get(id)?.source === source : id === by))
      if (touched.length === 0) return false
      options.onTouch?.({kind, amount, source, ids: touched.map(note => note.id), at: now()})
      if (rise <= 0 || (kind === 'pressure' && !settings().pressure)) return false
      for (let from = 0; from < touched.length; from += MAX_KEYS) {
        const act = {kind: 'strike' as const, seq: ++seq, keys: new Map<string, StageKey>(), amplitude: TOUCH_LAW * rise, sources: new Set([source]),
          pressedAt: now(), hostMs: null, receivedAt: null, clip: null, touch: true as const}
        for (const note of touched.slice(from, from + MAX_KEYS)) act.keys.set(keyId(note.key), note.key)
        queue.push(act)
      }
      schedule()
      return true
    },
    clipStrike: (clipNotes, amplitude, at, sounds) => holdStrike(clipNotes, amplitude, at, sounds),
    clipRelease: holdRelease,
    ring(pitchClass, amplitude) {
      if (!Number.isInteger(pitchClass) || pitchClass < 0 || pitchClass > 11) return Promise.resolve({ok: false, error: NO_BELL_NOTE})
      const hold = `bell:${++bells}`
      const answer = holdStrike([{hold, note: SURFACE_NOTE + pitchClass}], amplitude, undefined)
      holdRelease([hold])
      return answer
    },
  }
}
