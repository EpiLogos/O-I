// The MIDI and Key map model (T-LIVE-MIDI leg 2). A binding ties one source (a MIDI control change, or a computer key) to one mappable
// parameter. This module is pure: no React, no store, no I/O. The owner writes; a mapped source moves the parameter only through the
// parameter's own write (midiMapTargets.ts), which is the one write path (commitLiveInstrumentEdit, or the note-device setter).
//
// Choices (lens 0–11, context frame 1–7, and the other owner options) take the 0–127 range evenly: each option owns an equal slice of
// it. Toggles are on from 64. Ranges (level, scale units) run linearly across 0–127, snapped to the control's own step; a range that
// spans decades (the Torus's Rate, one step a year to 40,000 a second) runs on a log curve, equal ratios for equal turns.
//
// Live's own mapping model is the decode (O-I #853 round 23; DLW build ruling 2026-11-05: "Use Live's own mapping model as the decode in
// docs/research describes it"): every parameter stores a `MidiControllerRange` {Min, Max} in its own units, which "documents the
// control-surface mapping range" (session-model.md §6), and every on/off parameter its `MidiCCOnOffThresholds` {Min 64, Max 127}
// (evidence/devices/Simpler/default.xml). A mapping's control runs from its Min at 0 to its Max at 127 on the parameter's own scale (its
// step, its curve), the whole span where the mapping names none; a choice runs over its options by index, as an enum's range is its
// indexes (Glue's Attack, 0 to 6); a Min above its Max turns the control round. A toggle is on within Live's thresholds. How 0–127 falls
// on an enum's indexes the corpus does not say: the equal slices stand.

import type {StageResult} from '@epilogos/expressions-boundary'
import type {LiveWriteHow} from '../torusInstrument'
import {COMPUTER_KEY_PITCH} from '../janko/jankoLayout'

export type MapMode = 'off' | 'midi' | 'key'

/** Where a binding listens: a controller on one port, channel and number, or one computer key (lower case). */
export type MapSource =
  | {readonly kind: 'cc'; readonly port: string; readonly channel: number; readonly controller: number}
  | {readonly kind: 'key'; readonly key: string}

export interface MapBinding {
  readonly target: string
  readonly source: MapSource
  /** The mapping's own range (Live's MidiControllerRange): a range's two values in its units, a choice's two options by index. Absent:
   * the parameter's whole span. A toggle has none: it takes Live's on/off thresholds (MIDI_CC_ON_OFF). */
  readonly span?: MapSpan
}

/** A mapping's own range: the value its control gives at 0 (`min`) and at 127 (`max`); a min above its max turns the control round. */
export interface MapSpan {readonly min: number; readonly max: number}
/** Live's on/off thresholds, as it stores them for every on/off parameter (MidiCCOnOffThresholds): a toggle is on from 64 to 127. */
export const MIDI_CC_ON_OFF: MapSpan = Object.freeze({min: 64, max: 127})
/** A toggle's mapping, in words. */
export const TOGGLE_THRESHOLDS = `on from ${MIDI_CC_ON_OFF.min} to ${MIDI_CC_ON_OFF.max}, as Live's on/off thresholds stand`

/** A value a parameter takes: a choice's option value, a toggle's state, or a range's number. */
export type MapValue = string | boolean | number

export interface ChoiceTarget {
  readonly kind: 'choice'
  readonly id: string
  readonly label: string
  readonly group: string
  readonly writer: MapWriter
  readonly options: readonly {readonly value: string; readonly label: string}[]
  /** The owner's current option value, or null while the owner states none. */
  readonly current: string | null
  /** The parameter's own write: the hand's (a mapped control), unless `how` says no hand sent it (a take's lane played again,
   * writeMapTarget). A session-held value has no hand to tell, and takes it the same either way. */
  readonly apply: (value: string, how?: LiveWriteHow) => Promise<StageResult>
}

export interface ToggleTarget {
  readonly kind: 'toggle'
  readonly id: string
  readonly label: string
  readonly group: string
  readonly writer: MapWriter
  readonly current: boolean | null
  readonly apply: (value: boolean, how?: LiveWriteHow) => Promise<StageResult>
}

/** A range's span. Linear (the default) snaps to `step`; a log curve (min above zero) takes equal ratios for equal turns and keeps four
 * significant figures, so `step` is not read. */
export interface MapRange {
  readonly min: number
  readonly max: number
  readonly step: number
  readonly curve?: 'linear' | 'log'
}

export interface RangeTarget {
  readonly kind: 'range'
  readonly id: string
  readonly label: string
  readonly group: string
  readonly writer: MapWriter
  readonly range: MapRange
  readonly current: number | null
  readonly apply: (value: number, how?: LiveWriteHow) => Promise<StageResult>
}

/** Whose write a parameter's value goes to: the owner's (an instrument edit the owner accepts), or the session's own hold (a note device the
 * session keeps, which the owner does not write). A session value is never presented as owner-accepted. */
export type MapWriter = 'owner' | 'session'

/** A mappable parameter as the owner reads it now. */
export type MapTarget = ChoiceTarget | ToggleTarget | RangeTarget

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** The option a control value selects, of `count` evenly sized slices across 0–127. 127 selects the last option. */
export function choiceIndex(value: number, count: number): number {
  return Math.min(count - 1, Math.floor((clamp(value, 0, 127) * count) / 128))
}

/** A range's value for a control value: linear across the range, snapped to its step, or on a log curve, equal ratios for equal turns
 * to four significant figures; never past its ends, and 0 and 127 its very ends. A mapping's own range (`span`) is run across instead,
 * still on the range's own step from its least and its own curve, never past the span's ends. */
export function rangeValue(value: number, range: MapRange, span?: MapSpan): number {
  const from = span?.min ?? range.min, to = span?.max ?? range.max
  const least = Math.min(from, to), most = Math.max(from, to)
  const turn = clamp(value, 0, 127) / 127
  if (range.curve === 'log') {
    if (turn === 0) return from
    if (turn === 1) return to
    return clamp(Number((from * (to / from) ** turn).toPrecision(4)), least, most)
  }
  const raw = from + (to - from) * turn
  const snapped = clamp(range.min + Math.round((raw - range.min) / range.step) * range.step, least, most)
  return Number(snapped.toFixed(6))
}

/** A toggle's state for a control value: on within Live's thresholds, from 64 to 127. */
export function toggleValue(value: number): boolean {
  const at = clamp(value, 0, 127)
  return at >= MIDI_CC_ON_OFF.min && at <= MIDI_CC_ON_OFF.max
}

/** The value a control change moves a parameter to, across the mapping's own range where it has one. */
export function controlValue(target: MapTarget, value: number, span?: MapSpan): MapValue {
  switch (target.kind) {
    case 'choice': {
      const from = span?.min ?? 0, to = span?.max ?? target.options.length - 1
      const step = choiceIndex(value, Math.abs(to - from) + 1)
      return target.options[from <= to ? from + step : from - step].value
    }
    case 'toggle': return toggleValue(value)
    case 'range': return rangeValue(value, target.range, span)
  }
}

/** A mapping's range as its parameter holds it: a range's within its span, a choice's whole options within its own; refused in words for
 * a toggle (Live's thresholds stand) and for a Min or Max that is no number. */
export function mapSpanOf(target: MapTarget, span: MapSpan): {readonly ok: true; readonly span: MapSpan} | {readonly ok: false; readonly reason: string} {
  if (target.kind === 'toggle') return {ok: false, reason: `${target.label} is a toggle: it turns ${TOGGLE_THRESHOLDS}.`}
  if (!Number.isFinite(span.min) || !Number.isFinite(span.max)) return {ok: false, reason: `A mapping's Min and Max are numbers: ${target.label} keeps its range.`}
  if (target.kind === 'choice') {
    const last = target.options.length - 1
    return {ok: true, span: {min: clamp(Math.round(span.min), 0, last), max: clamp(Math.round(span.max), 0, last)}}
  }
  return {ok: true, span: {min: clamp(span.min, target.range.min, target.range.max), max: clamp(span.max, target.range.min, target.range.max)}}
}

/** A mapping's Min and Max in its parameter's words: a range's values, a choice's options; its whole span where it names none. */
export function mapSpanWords(target: Exclude<MapTarget, ToggleTarget>, span: MapSpan | undefined): [string, string] {
  if (target.kind === 'choice') {
    const label = (index: number) => target.options[index]?.label ?? String(index)
    return [label(span?.min ?? 0), label(span?.max ?? target.options.length - 1)]
  }
  return [String(span?.min ?? target.range.min), String(span?.max ?? target.range.max)]
}

/** Whether a key can step a parameter: a choice steps, a toggle flips. A range takes a control, not a key. */
export function keyable(target: MapTarget): boolean {
  return target.kind !== 'range'
}

/** The value one key press steps a parameter to, from `base` (the owner's value, or the last value sent while it is in flight). Null
 * for a range, which a key cannot step. A choice steps to the next option and wraps; a toggle flips. */
export function keyStepValue(target: MapTarget, base: MapValue | null): MapValue | null {
  if (target.kind === 'choice') {
    const index = target.options.findIndex(option => option.value === base)
    return target.options[(index + 1) % target.options.length].value
  }
  if (target.kind === 'toggle') return base !== true
  return null
}

/** Whether a key may be mapped. A letter, digit or symbol key may; the A–J row plays the keyboard, and the named keys (Escape, Delete,
 * arrows and the rest) belong to the surface. */
export function mappableKey(raw: string): {readonly ok: true; readonly key: string} | {readonly ok: false; readonly reason: string} {
  if (raw.length !== 1) return {ok: false, reason: 'Use a letter, digit or symbol key. Named keys belong to the surface.'}
  const key = raw.toLowerCase()
  if (key === ' ') return {ok: false, reason: 'Space is not mappable: it scrolls the page.'}
  if (COMPUTER_KEY_PITCH[key] !== undefined) return {ok: false, reason: `${key.toUpperCase()} plays the keyboard, so it is not mappable.`}
  return {ok: true, key}
}

export function sameSource(a: MapSource, b: MapSource): boolean {
  if (a.kind === 'cc' && b.kind === 'cc') return a.port === b.port && a.channel === b.channel && a.controller === b.controller
  if (a.kind === 'key' && b.kind === 'key') return a.key === b.key
  return false
}

/** Bind a source to a parameter. A parameter has one binding (a second source replaces it), and a source drives one parameter (it moves
 * off the parameter it was on). `moved` names the parameter the source left, or null. */
export function planBinding(bindings: readonly MapBinding[], targetId: string, source: MapSource): {readonly bindings: MapBinding[]; readonly moved: string | null} {
  const movedFrom = bindings.find(binding => binding.target !== targetId && sameSource(binding.source, source))?.target ?? null
  const kept = bindings.filter(binding => binding.target !== targetId && !sameSource(binding.source, source))
  // The mapping's range stands on its parameter, as Live keeps MidiControllerRange on it: a new control for the parameter keeps it.
  const span = bindings.find(binding => binding.target === targetId)?.span
  return {bindings: [...kept, {target: targetId, source, ...(span ? {span} : {})}], moved: movedFrom}
}

/** The bindings with a parameter's mapping range set (null: its whole span again). */
export function spanBinding(bindings: readonly MapBinding[], targetId: string, span: MapSpan | null): MapBinding[] {
  return bindings.map(binding => {
    if (binding.target !== targetId) return binding
    const {span: _was, ...rest} = binding
    return span ? {...rest, span} : rest
  })
}

/** The bindings without a parameter's binding. */
export function removeBinding(bindings: readonly MapBinding[], targetId: string): MapBinding[] {
  return bindings.filter(binding => binding.target !== targetId)
}

/** Whether a control change can reach anything: the map is in MIDI mode (it arms and binds), or the map is off and a binding listens for a
 * control. Otherwise the host's control changes are dropped before any per-frame work. */
export function controlsReach(mode: MapMode, bindings: readonly MapBinding[]): boolean {
  return mode === 'midi' || (mode === 'off' && bindings.some(binding => binding.source.kind === 'cc'))
}

/** The bindings a control change reaches: the same port, channel and controller. */
export function routeCc(bindings: readonly MapBinding[], control: {readonly port: string; readonly channel: number; readonly controller: number}): MapBinding[] {
  return bindings.filter(binding => binding.source.kind === 'cc' && binding.source.port === control.port
    && binding.source.channel === control.channel && binding.source.controller === control.controller)
}

/** The bindings a key reaches. The key is lower case, as the input gives it. */
export function routeKey(bindings: readonly MapBinding[], key: string): MapBinding[] {
  return bindings.filter(binding => binding.source.kind === 'key' && binding.source.key === key)
}

/** A source as a short label: the chip a mapped parameter shows. */
export function shortSourceLabel(source: MapSource): string {
  return source.kind === 'cc' ? `CC ${source.controller}` : `key ${source.key.toUpperCase()}`
}

/** A source in full: the controller's port and channel, or the key. */
export function sourceLabel(source: MapSource): string {
  return source.kind === 'cc' ? `CC ${source.controller} · channel ${source.channel + 1} · ${source.port}` : `key ${source.key.toUpperCase()}`
}

/** Apply a value to a parameter through its own write. The kind decides the value's type; the write is the owner's. */
export function applyMapValue(target: MapTarget, value: MapValue): Promise<StageResult> {
  switch (target.kind) {
    case 'choice': return target.apply(String(value))
    case 'toggle': return target.apply(value === true)
    case 'range': return target.apply(Number(value))
  }
}
