// The keyboard, held in the shell: its layout, the part's input settings, and the one playing path every surface and the part's MIDI play
// through (O-I #853). One keyboard, one layout: the chain's plate, its picture in the pool, a pane or the rail, and the Jankó under the
// torus's Full all draw the layout held here, so a change in one place shows in every other at once (manual §16.3). Moved out of the
// plate's own state (KeyboardOnChain.tsx useState) when the keyboard was drawn in more than one place. One path: a note pressed on any
// surface and a note from a controller are notes of the same part, so Sustain holds them alike and Panic releases them all.
import {useSyncExternalStore} from 'react'
import type {KeyboardLayoutName} from './liveChainDevices'
import type {StageResult} from '@epilogos/expressions-boundary'
import {createJankoInput, KEYBOARD_RANGE, KEYBOARD_SETTINGS_DEFAULT, KEYBOARD_TRANSPOSE, keyToSound, keyToSoundByInput, type EngineLatency, type JankoInput, type KeyboardSettings} from './janko/jankoInput'
import {commitLiveStage} from './torusInstrument'
import {liveEngineLatency} from './liveEngine'
import {liveTakeRecorder} from './liveTake'
import {sendLiveMidiOut} from '../native/liveMidi'

let layout: KeyboardLayoutName = 'janko'
const listeners = new Set<() => void>()

export function keyboardLayout(): KeyboardLayoutName {
  return layout
}

export function setKeyboardLayout(next: KeyboardLayoutName): void {
  if (next === layout) return
  layout = next
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

export function useKeyboardLayout(): KeyboardLayoutName {
  return useSyncExternalStore(subscribe, keyboardLayout, keyboardLayout)
}

// ── the part's input settings (DLW §21.1 The input) ────────────────────────────────────────────────────────────────────────────

let settings: KeyboardSettings = KEYBOARD_SETTINGS_DEFAULT
const settingsListeners = new Set<() => void>()

export function keyboardSettings(): KeyboardSettings {
  return settings
}

/** Change some settings. Transpose is held to −24…24 whole semitones, Range to 2…8 whole octaves. With Sustain switched off, every note no
 * key holds is let go. */
export function setKeyboardSettings(patch: Partial<KeyboardSettings>): void {
  const transpose = patch.transpose === undefined ? settings.transpose
    : Math.max(KEYBOARD_TRANSPOSE.min, Math.min(KEYBOARD_TRANSPOSE.max, Math.round(Number.isFinite(patch.transpose) ? patch.transpose : 0)))
  const range = patch.range === undefined ? settings.range
    : Math.max(KEYBOARD_RANGE.min, Math.min(KEYBOARD_RANGE.max, Math.round(Number.isFinite(patch.range) ? patch.range : KEYBOARD_SETTINGS_DEFAULT.range)))
  const next: KeyboardSettings = {...settings, ...patch, transpose, range, inputs: {...settings.inputs, ...patch.inputs}}
  if (JSON.stringify(next) === JSON.stringify(settings)) return
  settings = next
  live?.input.refresh()
  for (const listener of [...settingsListeners]) listener()
}

const subscribeSettings = (listener: () => void) => { settingsListeners.add(listener); return () => { settingsListeners.delete(listener) } }

export function useKeyboardSettings(): KeyboardSettings {
  return useSyncExternalStore(subscribeSettings, keyboardSettings, keyboardSettings)
}

// ── key-to-sound (O-I #853 round 18) ───────────────────────────────────────────────────────────────────────────────────────────

/** The engine's legs of key-to-sound while it plays the Torus (live/liveEngine.ts liveEngineLatency); none while it does not. */
export const engineLatency = (): EngineLatency | null => liveEngineLatency()

// ── the one playing path ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** What the surfaces draw of the path: the pitch classes held down, the points struck (jankoInput.ts `struck`: the keys sounding, the
 * hand's and a clip's), the owner's last refusal (null after an act it took), and whether the last act it took sounded late, in words
 * (null when it was on time). */
export interface LivePlaying {
  readonly held: readonly number[]; readonly struck: readonly string[]; readonly refusal: string | null; readonly late: string | null
}

/** A key the frame answered late (late_ms): it waited for the field's own reading in flight, and sounded when that was answered (round 54
 * item 0: never refused for it). */
export const lateWords = (ms: number): string => `the note waited ${(ms / 1000).toFixed(1)} s for the field's own reading`

/** The path's state after the owner answered an act: refused in its words, taken, or taken late. */
export const playingAfter = (state: LivePlaying, result: StageResult): LivePlaying =>
  ({...state, refusal: result.ok ? null : result.error, late: result.ok && result.late_ms !== undefined ? lateWords(result.late_ms) : null})

type Transform = (pitchClasses: readonly number[]) => readonly number[]
let live: {input: JankoInput; state: LivePlaying; transform: Transform | null} | null = null
const playingListeners = new Set<() => void>()
const IDLE: LivePlaying = Object.freeze({held: [], struck: [], refusal: null, late: null})

function publish(next: LivePlaying): void {
  if (!live || (live.state.refusal === next.refusal && live.state.late === next.late && live.state.held.join() === next.held.join()
    && live.state.struck.join() === next.struck.join())) return
  live.state = next
  for (const listener of [...playingListeners]) listener()
}

/** The part's one playing path: every surface and the part's MIDI play through it, to the Torus through the hosted channel, and what it
 * plays leaves through MIDI out; each note it plays is told to Record (live/liveTake.ts, O-I #855). Made once. Its window is the owner's
 * (jankoLayout.ts), its settings these. */
export function livePlayingPath(): JankoInput {
  if (live) return live.input
  const input = createJankoInput({
    send: command => commitLiveStage(command),
    settings: keyboardSettings,
    transform: pitchClasses => live?.transform ? live.transform(pitchClasses) : pitchClasses,
    midiOut: (messages, afterMs) => sendLiveMidiOut(messages, undefined, afterMs),
    onResult: result => { if (live) publish(playingAfter(live.state, result)) },
    onHeld: held => { if (live) publish({...live.state, held}) },
    // The points struck change with every strike and let-go, the hand's and the clip's alike (G19 of walk O-I 857).
    onChange: () => { if (live) publish({...live.state, struck: live.input.struck()}) },
    onNote: played => liveTakeRecorder.played(played),
    onTouch: touch => liveTakeRecorder.touched(touch),
  })
  live = {input, state: IDLE, transform: null}
  if (typeof window !== 'undefined' && typeof globalThis === 'object') {
    // The measurement hook (O-I #853): the last strikes' timing, read from the inspector as `__oiKeyLatency()`, and each joined with the
    // engine's legs while it plays (round 18) as `__oiKeyToSound()`.
    (globalThis as {__oiKeyLatency?: () => unknown}).__oiKeyLatency = () => input.latency();
    (globalThis as {__oiKeyToSound?: () => unknown}).__oiKeyToSound = () => input.latency().map(strike => keyToSound(strike, engineLatency()))
    // The engine's own key-to-sound, the latest strike of each input (DLW build ruling 2026-11-06), as `__oiKeyToSoundByInput()`.
    ;(globalThis as {__oiKeyToSoundByInput?: () => unknown}).__oiKeyToSoundByInput = () => keyToSoundByInput(input.latency(), engineLatency())
  }
  return input
}

/** The note-device chain under the mode in force, as the surface or the part's input last drew it: a note folds through it. */
export function setLivePlayingTransform(transform: Transform | null): void {
  livePlayingPath()
  live!.transform = transform
}

/** Panic (DLW §21.1 Rules): every note the part holds is released at once. */
export function panicLivePlaying(): void {
  livePlayingPath().panic()
}

const subscribePlaying = (listener: () => void) => { playingListeners.add(listener); return () => { playingListeners.delete(listener) } }
const playingState = (): LivePlaying => live?.state ?? IDLE

export function useLivePlaying(): LivePlaying {
  return useSyncExternalStore(subscribePlaying, playingState, playingState)
}
