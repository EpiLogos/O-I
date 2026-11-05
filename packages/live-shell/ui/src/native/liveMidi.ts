// Live MIDI input for the Jankó keyboard (T-LIVE-MIDI, first leg). The native host (desktop/cradle/src-tauri/src/midi.rs) opens the
// system's MIDI inputs and sends each note-on and note-off to this window as `oi://midi-note`, one batch per task; it names the ports it
// hears on `oi://midi-ports`. This module only listens and converts: each note becomes a NoteEvent with source 'midi' for the one Jankó
// input path (jankoInput.ts). Without the native host there is no MIDI access, and that is named here, never thrown.

import {useSyncExternalStore} from 'react'
import {nativeHost} from './application'
import {tauriInvoke} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {MidiOutMessage, NoteEvent} from '../live/janko/jankoInput'

export const MIDI_NOTE_EVENT = 'oi://midi-note'
export const MIDI_PORTS_EVENT = 'oi://midi-ports'

/** One note as the host decoded it. `velocity` is 1 to 127; `on` false is a release (a note-on at velocity 0 included). */
export interface MidiNote {
  readonly port: string
  readonly channel: number
  readonly note: number
  readonly velocity: number
  readonly on: boolean
  /** When the host received it, in milliseconds since the epoch (its wall clock; O-I #853 latency): absent from an older host. */
  readonly received_ms?: number
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
    note: note.note,
    port: note.port,
    ...(typeof note.received_ms === 'number' && Number.isFinite(note.received_ms) ? {receivedAt: note.received_ms} : {}),
  }
}

/** The ports a new state no longer hears, of those the state before it heard: a device lost (a refused state loses them all). */
export function lostMidiPorts(before: LiveMidiState, after: LiveMidiState): string[] {
  const heard = before.kind === 'ports' ? before.ports : []
  return after.kind === 'ports' ? heard.filter(port => !after.ports.includes(port)) : after.kind === 'refused' ? [...heard] : []
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
    && (row.received_ms === undefined || (typeof row.received_ms === 'number' && Number.isFinite(row.received_ms)))
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

/** One of the host's batched MIDI events, each row read exactly: a batch the window does not read is refused as `what`, and the named
 * absence outside the native host. Returns the unsubscribe, which releases the listener, including one that attaches after it. */
function subscribeBatch<T>(event: string, is: (value: unknown) => value is T, what: string, listening: string,
  onBatch: (batch: readonly T[]) => void, options: {readonly onRefused?: (reason: string) => void; readonly native?: boolean;
    readonly listen?: (event: string, handler: (event: {readonly payload: unknown}) => void) => Promise<() => void>}): () => void {
  if (!(options.native ?? nativeHost())) {
    options.onRefused?.(LIVE_MIDI_ABSENT)
    return () => {}
  }
  let live = true
  let stop: (() => void) | null = null
  const listen = options.listen ?? tauriListen
  listen(event, heard => {
    if (!live) return
    if (!Array.isArray(heard.payload) || !heard.payload.every(is)) {
      options.onRefused?.(`the native host sent ${what} this device does not read`)
      return
    }
    if (heard.payload.length > 0) onBatch(heard.payload)
  }).then(released => {
    if (live) stop = released
    else released()
  }, cause => {
    if (live) options.onRefused?.(`the native host did not answer MIDI ${listening} listening: ${cause instanceof Error ? cause.message : String(cause)}`)
  })
  return () => {
    live = false
    stop?.()
    stop = null
  }
}

/** Subscribe to the host's control changes. Returns the unsubscribe, which releases the listener: after it, no control reaches the map. */
export function subscribeLiveMidiControls(options: LiveMidiControlOptions): () => void {
  return subscribeBatch(MIDI_CC_EVENT, isControl, 'a control change', 'control', options.onControls, options)
}

// ── pitch bend and channel pressure: the part's instrument's input (O-I #853 round 16) ─────────────────────────────────────────────
// The host sends each pitch bend and channel pressure as `oi://midi-expression`, a sibling of the notes and the controls (midi.rs
// decode_expression). The part's input hands each to the part's instrument (live/liveEngine.ts touchInEngine); no note is struck by it.

export const MIDI_EXPRESSION_EVENT = 'oi://midi-expression'

/** A pitch bend (`value` −8192 to 8191, 0 at rest) or a channel pressure (`value` 0 to 127), as the host decoded it. */
export interface MidiExpression {
  readonly port: string
  readonly channel: number
  readonly kind: 'bend' | 'pressure'
  readonly value: number
}

/** The amount the engine takes: a bend −1 (all the way down) to just short of 1 (8191 of 8192 up), a pressure 0 to 1. */
export function midiExpressionAmount(expression: MidiExpression): number {
  return expression.kind === 'bend' ? expression.value / 8192 : expression.value / 127
}

export interface LiveMidiExpressionOptions {
  /** One batch of bends and pressures, in arrival order. */
  readonly onExpressions: (expressions: readonly MidiExpression[]) => void
  /** A named refusal: outside the native host, a payload this window does not read, or a listener that did not attach. */
  readonly onRefused?: (reason: string) => void
  /** Whether this window is the native host. Defaults to the host marker. */
  readonly native?: boolean
  /** The host's event listener. Defaults to the Tauri event API, loaded only in the native host. */
  readonly listen?: (event: string, handler: (event: {readonly payload: unknown}) => void) => Promise<() => void>
}

const isExpression = (value: unknown): value is MidiExpression => {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  const [least, most] = row.kind === 'bend' ? [-8192, 8191] : row.kind === 'pressure' ? [0, 127] : [1, 0]
  return typeof row.port === 'string'
    && Number.isInteger(row.channel) && (row.channel as number) >= 0 && (row.channel as number) <= 15
    && Number.isInteger(row.value) && (row.value as number) >= least && (row.value as number) <= most
}

/** Subscribe to the host's pitch bends and channel pressures. Returns the unsubscribe, which releases the listener: after it, none reaches
 * the part. */
export function subscribeLiveMidiExpression(options: LiveMidiExpressionOptions): () => void {
  return subscribeBatch(MIDI_EXPRESSION_EVENT, isExpression, 'a pitch bend or channel pressure', 'bend and pressure', options.onExpressions, options)
}

// ── MIDI out: what a part plays leaves for a MIDI output (O-I #853) ───────────────────────────────────────────────────────────────
// The native host lists the system's MIDI outputs, connects the one the person chooses and sends the notes the playing path plays to it
// (desktop/cradle/src-tauri/src/midi.rs `midi_out`). Nothing is sent until a port is chosen, and outside the native host there is none.

export const MIDI_OUT_COMMAND = 'midi_out'

export type LiveMidiOutState =
  | {readonly kind: 'reading'}
  | {readonly kind: 'ports'; readonly ports: readonly string[]; readonly port: string | null}
  | {readonly kind: 'refused'; readonly reason: string; readonly ports: readonly string[]; readonly port: string | null}

/** The named absence: this window is not the native host, so it has no MIDI output. */
export const LIVE_MIDI_OUT_ABSENT = 'this window is not the native O:I host, so it has no MIDI output'

export type MidiOutInvoke = (command: string, args: Record<string, unknown>) => Promise<unknown>
const words = (cause: unknown) => typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : String(cause)

/** The host's answer, read exactly: the outputs it offers and the one connected. */
function readOutState(raw: unknown): {ports: string[]; port: string | null} | null {
  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as Record<string, unknown>
  if (!Array.isArray(row.ports) || !row.ports.every(port => typeof port === 'string')) return null
  if (row.port !== null && typeof row.port !== 'string') return null
  return {ports: row.ports as string[], port: row.port as string | null}
}

let outState: LiveMidiOutState = nativeHost() ? {kind: 'reading'} : {kind: 'refused', reason: LIVE_MIDI_OUT_ABSENT, ports: [], port: null}
const outListeners = new Set<() => void>()
/** Readers are told only of a change: a note sent to the connected output moves nothing they draw. */
const publishOut = (next: LiveMidiOutState) => {
  if (JSON.stringify(next) === JSON.stringify(outState)) return
  outState = next
  for (const listener of [...outListeners]) listener()
}
export const liveMidiOut = (): LiveMidiOutState => outState
export const subscribeLiveMidiOut = (listener: () => void) => { outListeners.add(listener); return () => { outListeners.delete(listener) } }
export const useLiveMidiOut = (): LiveMidiOutState => useSyncExternalStore(subscribeLiveMidiOut, liveMidiOut, liveMidiOut)

/** One request of the host's MIDI output: read its ports, choose one (null lets it go), or send messages. A refusal is published in
 * the host's words. After a refused send the host is read again, so the picker shows the output it holds now: it lets go an output that
 * went away, and keeps one that refused only a batch it could not carry. */
async function outRequest(request: Record<string, unknown>, invoke: MidiOutInvoke): Promise<boolean> {
  if (!(nativeHost() || invoke !== tauriOut)) { publishOut({kind: 'refused', reason: LIVE_MIDI_OUT_ABSENT, ports: [], port: null}); return false }
  try {
    const answer = readOutState(await invoke(MIDI_OUT_COMMAND, {request}))
    if (!answer) { publishOut({kind: 'refused', reason: 'the native host answered MIDI output in a form this window does not read', ports: [], port: null}); return false }
    publishOut({kind: 'ports', ...answer})
    return true
  } catch (cause) {
    let known: {ports: readonly string[]; port: string | null} = outState.kind === 'reading' ? {ports: [], port: null} : {ports: outState.ports, port: outState.port}
    if (request.kind === 'send') {
      try { known = readOutState(await invoke(MIDI_OUT_COMMAND, {request: {kind: 'read'}})) ?? {ports: known.ports, port: null} }
      catch { known = {ports: known.ports, port: null} }
    }
    publishOut({kind: 'refused', reason: words(cause), ...known})
    return false
  }
}
const tauriOut: MidiOutInvoke = (command, args) => tauriInvoke(command, args)

/** Read the outputs the host offers and the one it is connected to. */
export const readLiveMidiOut = (invoke: MidiOutInvoke = tauriOut) => outRequest({kind: 'read'}, invoke)
/** Connect the output named `port`, or let the connected one go (null). */
export const chooseLiveMidiOut = (port: string | null, invoke: MidiOutInvoke = tauriOut) => outRequest({kind: 'choose', port}, invoke)
/** Send what the part plays to the connected output; nothing leaves while no output is connected. An output still connected after a
 * refusal still takes the notes that follow. `afterMs` (O-I #853 round 22): a clip's notes are sent one owner lookahead before they
 * sound, so the host holds them that long before they leave (midi.rs `after_ms`); none, or 0, leaves at once. A held send names when it
 * was sent on the machine's wall clock (`sent_at_ms`, O-I #849 round 23), so the host counts the hold from the send, not from its
 * receipt, the time on the way taken off. */
export function sendLiveMidiOut(messages: readonly MidiOutMessage[], invoke: MidiOutInvoke = tauriOut, afterMs?: number, wallNow: () => number = Date.now): void {
  if (messages.length === 0 || outState.kind === 'reading' || outState.port === null) return
  void outRequest({kind: 'send', messages, ...(afterMs !== undefined && afterMs > 0 ? {after_ms: afterMs, sent_at_ms: wallNow()} : {})}, invoke)
}
/** The one MIDI out line: the output connected, none chosen, or the named refusal. */
export function liveMidiOutLine(state: LiveMidiOutState): string {
  if (state.kind === 'reading') return 'MIDI output: reading the native host'
  if (state.kind === 'refused') return `MIDI output refused: ${state.reason}`
  if (state.port !== null) return `MIDI output: ${state.port}`
  return state.ports.length ? 'MIDI output: none chosen' : 'no MIDI output connected'
}
