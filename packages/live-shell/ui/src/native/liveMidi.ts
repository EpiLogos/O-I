// Live MIDI input for the Jankó keyboard (T-LIVE-MIDI, first leg). The native host (desktop/cradle/src-tauri/src/midi.rs) opens the
// system's MIDI inputs and sends each note-on and note-off to this window as `oi://midi-note`, one batch per task; it names the ports it
// hears on `oi://midi-ports`. This module only listens and converts: each note becomes a NoteEvent with source 'midi' for the one Jankó
// input path (jankoInput.ts). Without the native host there is no MIDI access, and that is named here, never thrown.

import {nativeHost} from './application'
import type {NoteEvent} from '../live/janko/jankoInput'

export const MIDI_NOTE_EVENT = 'oi://midi-note'
export const MIDI_PORTS_EVENT = 'oi://midi-ports'

/** One note as the host decoded it. `velocity` is 1 to 127; `on` false is a release (a note-on at velocity 0 included). */
export interface MidiNote {
  readonly port: string
  readonly channel: number
  readonly note: number
  readonly velocity: number
  readonly on: boolean
}

export type LiveMidiState =
  | {readonly kind: 'reading'}
  | {readonly kind: 'ports'; readonly ports: readonly string[]; readonly refusal: string | null}
  | {readonly kind: 'refused'; readonly reason: string}

/** The named absence: this window is not the native host, so it has no MIDI access. */
export const LIVE_MIDI_ABSENT = 'this window is not the native O:I host, so it has no MIDI access'

/** The state before the host has answered, or the one this window starts in: the native host reads, elsewhere the named absence. */
export function liveMidiInitial(native: boolean = nativeHost()): LiveMidiState {
  return native ? {kind: 'reading'} : {kind: 'refused', reason: LIVE_MIDI_ABSENT}
}

/** The one line the device shows for MIDI: the port names it hears, "no MIDI input connected", or the named refusal. */
export function liveMidiLine(state: LiveMidiState): string {
  if (state.kind === 'reading') return 'MIDI input: reading the native host'
  if (state.kind === 'refused') return `MIDI input refused: ${state.reason}`
  if (state.ports.length === 0) return state.refusal ? `MIDI input refused: ${state.refusal}` : 'no MIDI input connected'
  return `MIDI input: ${state.ports.join(', ')}${state.refusal ? ` (${state.refusal})` : ''}`
}

/** A note as the Jankó input takes it. A note-on at velocity 1 to 127 is a down, striking at velocity/127 (which replaces pressure for
 * MIDI); a note-on at velocity 0 and every note-off is an up. The pitch class is the note modulo twelve. */
export function midiNoteEvent(note: MidiNote): NoteEvent {
  const down = note.on && note.velocity > 0
  return {
    kind: down ? 'down' : 'up',
    pitchClass: note.note % 12,
    source: 'midi',
    velocity: down ? note.velocity / 127 : null,
    press: `${note.port}/${note.channel}/${note.note}`,
  }
}

export interface LiveMidiOptions {
  /** One batch of notes, in arrival order: the notes of one task, so a chord arriving together is one act. */
  readonly onNotes: (notes: readonly MidiNote[]) => void
  /** Each state the host reports, and the named absence. */
  readonly onState: (state: LiveMidiState) => void
  /** Whether this window is the native host. Defaults to the host marker. */
  readonly native?: boolean
  /** The host's event listener. Defaults to the Tauri event API, loaded only in the native host. */
  readonly listen?: (event: string, handler: (event: {readonly payload: unknown}) => void) => Promise<() => void>
}

async function tauriListen(event: string, handler: (event: {readonly payload: unknown}) => void): Promise<() => void> {
  const {listen} = await import('@tauri-apps/api/event')
  return listen<unknown>(event, handler)
}

const isNote = (value: unknown): value is MidiNote => {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.port === 'string' && Number.isInteger(row.channel) && Number.isInteger(row.note) && (row.note as number) >= 0 && (row.note as number) <= 127
    && Number.isInteger(row.velocity) && (row.velocity as number) >= 0 && (row.velocity as number) <= 127 && typeof row.on === 'boolean'
}

const isPorts = (value: unknown): value is {ports: string[]; refusal: string | null} => {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return Array.isArray(row.ports) && row.ports.every(port => typeof port === 'string') && (row.refusal === null || typeof row.refusal === 'string')
}

/** Subscribe to the host's MIDI. Returns the unsubscribe, which the device calls on unmount: after it, no note reaches the device. */
export function subscribeLiveMidi(options: LiveMidiOptions): () => void {
  if (!(options.native ?? nativeHost())) {
    options.onState({kind: 'refused', reason: LIVE_MIDI_ABSENT})
    return () => {}
  }
  let live = true
  const stops: Array<() => void> = []
  const listen = options.listen ?? tauriListen
  const attach = async (event: string, handler: (event: {readonly payload: unknown}) => void) => {
    const stop = await listen(event, handler)
    if (live) stops.push(stop)
    else stop()
  }
  options.onState({kind: 'reading'})
  void Promise.all([
    attach(MIDI_NOTE_EVENT, event => {
      if (!live) return
      if (!Array.isArray(event.payload) || !event.payload.every(isNote)) {
        options.onState({kind: 'refused', reason: 'the native host sent a note this device does not read'})
        return
      }
      if (event.payload.length > 0) options.onNotes(event.payload)
    }),
    attach(MIDI_PORTS_EVENT, event => {
      if (!live) return
      if (!isPorts(event.payload)) {
        options.onState({kind: 'refused', reason: 'the native host sent a port state this device does not read'})
        return
      }
      options.onState({kind: 'ports', ports: event.payload.ports, refusal: event.payload.refusal})
    }),
  ]).catch(cause => {
    if (live) options.onState({kind: 'refused', reason: `the native host did not answer MIDI listening: ${cause instanceof Error ? cause.message : String(cause)}`})
  })
  return () => {
    live = false
    for (const stop of stops.splice(0)) stop()
  }
}

// ── control changes: the MIDI map's input (T-LIVE-MIDI leg 2) ──────────────────────────────────────────────────────────────────
// The host sends each control change as `oi://midi-cc`, a sibling of the notes. This is the map's input, not the Jankó's: a control
// moves a mapped parameter (midi map model, midiMap/), and no note is struck by it.

export const MIDI_CC_EVENT = 'oi://midi-cc'

/** One control change as the host decoded it: `value` is 0 to 127; `controller` is 0 to 119 (channel-mode messages are not controls). */
export interface MidiControl {
  readonly port: string
  readonly channel: number
  readonly controller: number
  readonly value: number
}

export interface LiveMidiControlOptions {
  /** One batch of control changes, in arrival order. */
  readonly onControls: (controls: readonly MidiControl[]) => void
  /** A named refusal: outside the native host, a payload this window does not read, or a listener that did not attach. */
  readonly onRefused?: (reason: string) => void
  /** Whether this window is the native host. Defaults to the host marker. */
  readonly native?: boolean
  /** The host's event listener. Defaults to the Tauri event API, loaded only in the native host. */
  readonly listen?: (event: string, handler: (event: {readonly payload: unknown}) => void) => Promise<() => void>
}

const isControl = (value: unknown): value is MidiControl => {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.port === 'string'
    && Number.isInteger(row.channel) && (row.channel as number) >= 0 && (row.channel as number) <= 15
    && Number.isInteger(row.controller) && (row.controller as number) >= 0 && (row.controller as number) <= 119
    && Number.isInteger(row.value) && (row.value as number) >= 0 && (row.value as number) <= 127
}

/** Subscribe to the host's control changes. Returns the unsubscribe, which releases the listener: after it, no control reaches the map. */
export function subscribeLiveMidiControls(options: LiveMidiControlOptions): () => void {
  if (!(options.native ?? nativeHost())) {
    options.onRefused?.(LIVE_MIDI_ABSENT)
    return () => {}
  }
  let live = true
  let stop: (() => void) | null = null
  const listen = options.listen ?? tauriListen
  listen(MIDI_CC_EVENT, event => {
    if (!live) return
    if (!Array.isArray(event.payload) || !event.payload.every(isControl)) {
      options.onRefused?.('the native host sent a control change this device does not read')
      return
    }
    if (event.payload.length > 0) options.onControls(event.payload)
  }).then(released => {
    if (live) stop = released
    else released()
  }, cause => {
    if (live) options.onRefused?.(`the native host did not answer MIDI control listening: ${cause instanceof Error ? cause.message : String(cause)}`)
  })
  return () => {
    live = false
    stop?.()
    stop = null
  }
}
