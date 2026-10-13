// The Jankó keyboard's layout (T-LIVE-JANKO-DEVICE; DEVICE-SEMANTICS-LOCK §0.2 item 4). The surface is the owner's: `ql music janko window`
// (schema ql.janko-surface/v1) lays out six rows of keys, each row a whole-tone family, each pitch class held by repeated touch-points. The
// shell reads that document exactly and never lays a key out by eye. The excitation point of a key on the torus is not in the window: its
// angular placement is the kernel derivation (QL-MEF packet K), so the device names it as awaiting that derivation.
import {useSyncExternalStore} from 'react'

export const JANKO_SCHEMA = 'ql.janko-surface/v1'
export const JANKO_ROWS = 6
/** The excitation point is not published: the device says so and never supplies an angle. */
export const JANKO_PLACEMENT_NOTE = 'Excitation point: placement awaits the kernel derivation (packet K).'
/** Conventional names of the twelve pitch classes, for the piano alternative only (presentation; the Jankó keys carry QL's own names). */
const PIANO_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const PIANO_BLACK = new Set([1, 3, 6, 8, 10])

export interface JankoKey {
  readonly row: number
  readonly column: number
  readonly pitchClass: number
  readonly pitchName: string
  /** The repeated touch-point of this pitch class (0, 1, 2…): one pitch class, several keys. */
  readonly touchPoint: number
  /** The whole-tone family of the row (0 or 1). */
  readonly family: number
  readonly face: 'direct' | 'prime'
  readonly position: number
}

export interface JankoWindow {
  readonly rows: readonly (readonly JankoKey[])[]
  readonly columns: readonly number[]
}

export type JankoWindowState = {readonly ok: true; readonly window: JankoWindow} | {readonly ok: false; readonly fault: string}

const isInt = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
const obj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** The owner's window, exactly, or a named fault. A key the owner does not state is refused, never defaulted. */
export function parseJankoWindow(raw: unknown): JankoWindow {
  if (!obj(raw) || raw.schema !== JANKO_SCHEMA) throw new Error(`janko: expected the ${JANKO_SCHEMA} window`)
  if (!Array.isArray(raw.surface) || raw.surface.length !== JANKO_ROWS) throw new Error(`janko.surface: expected ${JANKO_ROWS} rows`)
  if (!Array.isArray(raw.substrate_pitch_classes) || raw.substrate_pitch_classes.length !== 12) throw new Error('janko.substrate_pitch_classes: expected the twelve classes')
  const seen = new Set<string>()
  const touches = new Map<number, Set<number>>()
  const columns = new Set<number>()
  const rows = raw.surface.map((row, index) => {
    if (!obj(row) || row.row !== index) throw new Error(`janko.surface[${index}]: row index mismatch`)
    if (!isInt(row.whole_tone_row_family, 0, 1)) throw new Error(`janko.surface[${index}].whole_tone_row_family: expected 0 or 1`)
    if (!Array.isArray(row.keys) || row.keys.length < 1) throw new Error(`janko.surface[${index}].keys: expected keys`)
    return row.keys.map((key): JankoKey => {
      if (!obj(key) || !obj(key.key) || !obj(key.coordinate)) throw new Error(`janko.surface[${index}]: malformed key`)
      if (key.key.row !== index || !isInt(key.key.column, 0, 1 << 20)) throw new Error(`janko key at row ${index}: row or column mismatch`)
      const {column} = key.key as {column: number}
      if (!isInt(key.sounding_pitch_class, 0, 11)) throw new Error(`janko key ${index}/${column}: pitch class outside 0–11`)
      if (!isInt(key.repeated_touch_point, 0, 1 << 10)) throw new Error(`janko key ${index}/${column}: touch-point index`)
      if (key.whole_tone_row_family !== row.whole_tone_row_family) throw new Error(`janko key ${index}/${column}: family differs from its row`)
      if (key.coordinate.face !== 'direct' && key.coordinate.face !== 'prime') throw new Error(`janko key ${index}/${column}: face`)
      if (!isInt(key.coordinate.position, 0, 1 << 20)) throw new Error(`janko key ${index}/${column}: position`)
      if (typeof key.pitch_name !== 'string' || key.pitch_name.length === 0 || key.pitch_name.length > 8) throw new Error(`janko key ${index}/${column}: pitch name`)
      const id = `${index}/${column}`
      if (seen.has(id)) throw new Error(`janko key ${id}: duplicate position`)
      seen.add(id)
      columns.add(column)
      const pc = key.sounding_pitch_class as number, touch = key.repeated_touch_point as number
      touches.set(pc, (touches.get(pc) ?? new Set<number>()).add(touch))
      return {row: index, column, pitchClass: pc, pitchName: key.pitch_name, touchPoint: touch, family: row.whole_tone_row_family as number,
        face: key.coordinate.face, position: key.coordinate.position as number}
    })
  })
  // Each pitch class's touch-points are contiguous from 0: the repeated touch-points the owner serves, never gaps.
  for (const [pc, indices] of touches) {
    for (let i = 0; i < indices.size; i += 1) if (!indices.has(i)) throw new Error(`janko pitch class ${pc}: touch-point ${i} missing`)
  }
  return {rows, columns: [...columns].sort((a, b) => a - b)}
}

/** The window the owner served, or a named refusal. */
export function readJankoWindow(raw: unknown): JankoWindowState {
  try {return {ok: true, window: parseJankoWindow(raw)}}
  catch (cause) {return {ok: false, fault: cause instanceof Error ? cause.message : String(cause)}}
}

export interface PianoKey {readonly pitchClass: number; readonly pitchName: string; readonly black: boolean}
/** The admitted alternative: the twelve pitch classes, one key each, in chromatic order. */
export function pianoKeys(): readonly PianoKey[] {
  return PIANO_NAMES.map((pitchName, pitchClass) => ({pitchClass, pitchName, black: PIANO_BLACK.has(pitchClass)}))
}

// The window the shell holds: published when the kernel serves the owner's window (native/liveJankoWindow.ts), or the refusal it named.
let windowState: JankoWindowState | null = null
const listeners = new Set<() => void>()
/** Publish the owner's window (raw, as served), or null to withdraw it. Readers are told only of a change. */
export function publishLiveJankoWindow(raw: unknown | null): void {
  const next = raw === null ? null : readJankoWindow(raw)
  if (JSON.stringify(next) === JSON.stringify(windowState)) return
  windowState = next
  for (const listener of [...listeners]) listener()
}
/** Publish the kernel's named refusal: no key is laid out from a surface the owner did not serve. */
export function refuseLiveJankoWindow(reason: string): void {
  const next: JankoWindowState = {ok: false, fault: reason}
  if (JSON.stringify(next) === JSON.stringify(windowState)) return
  windowState = next
  for (const listener of [...listeners]) listener()
}
export function liveJankoWindow(): JankoWindowState | null {
  return windowState
}
export function subscribeLiveJanko(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function useLiveJankoWindow(): JankoWindowState | null {
  return useSyncExternalStore(subscribeLiveJanko, liveJankoWindow, liveJankoWindow)
}
