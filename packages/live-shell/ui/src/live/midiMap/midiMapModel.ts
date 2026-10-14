// The MIDI and Key map model (T-LIVE-MIDI leg 2). A binding ties one source (a MIDI control change, or a computer key) to one mappable
// parameter. This module is pure: no React, no store, no I/O. The owner writes; a mapped source moves the parameter only through the
// parameter's own write (midiMapTargets.ts), which is the one write path (commitLiveInstrumentEdit, or the note-device setter).
//
// Choices (lens 0–11, context frame 1–7, and the other owner options) take the 0–127 range evenly: each option owns an equal slice of
// it. Toggles are on from 64. Ranges (level, scale units) run linearly across 0–127, snapped to the control's own step.

import type {StageResult} from '@epilogos/expressions-boundary'
import {COMPUTER_KEY_PITCH} from '../janko/jankoInput'

export type MapMode = 'off' | 'midi' | 'key'

/** Where a binding listens: a controller on one port, channel and number, or one computer key (lower case). */
export type MapSource =
  | {readonly kind: 'cc'; readonly port: string; readonly channel: number; readonly controller: number}
  | {readonly kind: 'key'; readonly key: string}

export interface MapBinding {
  readonly target: string
  readonly source: MapSource
}

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
  readonly apply: (value: string) => Promise<StageResult>
}

export interface ToggleTarget {
  readonly kind: 'toggle'
  readonly id: string
  readonly label: string
  readonly group: string
  readonly writer: MapWriter
  readonly current: boolean | null
  readonly apply: (value: boolean) => Promise<StageResult>
}

export interface RangeTarget {
  readonly kind: 'range'
  readonly id: string
  readonly label: string
  readonly group: string
  readonly writer: MapWriter
  readonly range: {readonly min: number; readonly max: number; readonly step: number}
  readonly current: number | null
  readonly apply: (value: number) => Promise<StageResult>
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

/** A range's value for a control value: linear across the range, snapped to its step, never past its ends. */
export function rangeValue(value: number, range: {readonly min: number; readonly max: number; readonly step: number}): number {
  const raw = range.min + ((range.max - range.min) * clamp(value, 0, 127)) / 127
  const snapped = Math.min(range.max, range.min + Math.round((raw - range.min) / range.step) * range.step)
  return Number(snapped.toFixed(6))
}

/** A toggle's state for a control value: on from 64. */
export function toggleValue(value: number): boolean {
  return clamp(value, 0, 127) >= 64
}

/** The value a control change moves a parameter to. */
export function controlValue(target: MapTarget, value: number): MapValue {
  switch (target.kind) {
    case 'choice': return target.options[choiceIndex(value, target.options.length)].value
    case 'toggle': return toggleValue(value)
    case 'range': return rangeValue(value, target.range)
  }
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
  return {bindings: [...kept, {target: targetId, source}], moved: movedFrom}
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
