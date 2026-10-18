// Live's MIDI tools in Clip view (manual §21.1; Live caps 02–06): each press rewrites the clip's notes, as Live's own buttons do —
// to the selected note, or to all of them when none is selected — and the result is written to the set's owner as the clip's notes
// (live/liveWrites.ts writeLiveClip). The tools' settings are what the view holds until the press (interval, stretch, the grid,
// humanize, the transform's and generator's own). Pure: notes in, notes (and, for Duplicate, the loop's new length) out.
import type {LiveNote} from '../../../../../desktop/cradle/src/kernel/types'

export interface ToolNote extends LiveNote {id?: number; p: number; at: number; len: number; vel: number; chance: number}
export interface ToolSpan {start: number; end: number; position: number; length: number; loop: boolean}
export interface ToolScale {root: number; steps: readonly number[]}
export interface ToolResult {notes: ToolNote[]; set?: Record<string, unknown>}

/** The seven modes' steps (clips/live.tsx MODES). */
export const MODE_STEPS: Readonly<Record<string, readonly number[]>> = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
}
/** The design's grids in beats. */
export const GRID_BEATS: Readonly<Record<string, number>> = {'1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125}

const clampPitch = (p: number) => Math.max(0, Math.min(127, Math.round(p)))
const clampVel = (v: number) => Math.max(1, Math.min(127, Math.round(v)))
const inScale = (p: number, scale: ToolScale) => scale.steps.includes(((p - scale.root) % 12 + 12) % 12)

/** The notes a tool acts on: the selected one, else all. */
function chosen(notes: readonly ToolNote[], selected: number | null): (n: ToolNote) => boolean {
  return selected !== null && notes.some(n => n.id === selected) ? n => n.id === selected : () => true
}
const each = (notes: readonly ToolNote[], selected: number | null, f: (n: ToolNote) => ToolNote): ToolNote[] => {
  const on = chosen(notes, selected)
  return notes.map(n => (on(n) ? f(n) : n))
}

/** Move a pitch by scale degrees in the scale (chromatic steps where there is none). */
export function byDegrees(p: number, degrees: number, scale: ToolScale | null): number {
  if (!scale) return clampPitch(p + degrees)
  let pitch = p
  // Snap down into the scale first, then walk the degrees.
  while (!inScale(pitch, scale) && pitch > 0) pitch--
  const step = Math.sign(degrees)
  for (let moved = 0; moved < Math.abs(degrees); ) {
    pitch += step
    if (pitch < 0 || pitch > 127) break
    if (inScale(pitch, scale)) moved++
  }
  return clampPitch(pitch)
}

/** Duplicate: doubles the loop and copies its notes into the second half. */
export function duplicate(notes: readonly ToolNote[], span: ToolSpan): ToolResult {
  const from = span.loop ? span.position : span.start
  const length = span.loop ? span.length : span.end - span.start
  const inside = notes.filter(n => n.at >= from && n.at < from + length)
  const copies = inside.map(({id: _id, ...n}) => ({...n, at: n.at + length}))
  const set = span.loop ? {length: length * 2, end: Math.max(span.end, from + length * 2)} : {end: span.start + length * 2}
  return {notes: [...notes, ...copies], set}
}

/** Fit to Scale: each note to the nearest pitch of the clip's mode (the lower on a tie). */
export function fitToScale(notes: readonly ToolNote[], selected: number | null, scale: ToolScale | null): ToolNote[] {
  if (!scale) return [...notes]
  return each(notes, selected, n => {
    for (let d = 0; d < 12; d++) {
      if (inScale(n.p - d, scale)) return {...n, p: clampPitch(n.p - d)}
      if (inScale(n.p + d, scale)) return {...n, p: clampPitch(n.p + d)}
    }
    return n
  })
}

/** Invert: the notes' pitches mirrored between their lowest and highest. */
export function invert(notes: readonly ToolNote[], selected: number | null): ToolNote[] {
  const on = chosen(notes, selected), ps = notes.filter(on).map(n => n.p)
  if (!ps.length) return [...notes]
  const lo = Math.min(...ps), hi = Math.max(...ps)
  return notes.map(n => (on(n) ? {...n, p: clampPitch(hi + lo - n.p)} : n))
}

/** Add Interval: a copy of each note, the interval away in scale degrees. */
export function addInterval(notes: readonly ToolNote[], selected: number | null, degrees: number, scale: ToolScale | null): ToolNote[] {
  if (!degrees) return [...notes]
  const on = chosen(notes, selected)
  return [...notes, ...notes.filter(on).map(({id: _id, ...n}) => ({...n, p: byDegrees(n.p, degrees, scale)}))]
}

/** ×2 and ÷2, and Stretch: the notes' places and lengths scaled from the clip's start. */
export function stretch(notes: readonly ToolNote[], selected: number | null, factor: number, origin: number): ToolNote[] {
  if (!(factor > 0)) return [...notes]
  return each(notes, selected, n => ({...n, at: origin + (n.at - origin) * factor, len: n.len * factor}))
}

/** Set Length: every note the grid's length. */
export function setLength(notes: readonly ToolNote[], selected: number | null, grid: string): ToolNote[] {
  const len = GRID_BEATS[grid] ?? 0.25
  return each(notes, selected, n => ({...n, len}))
}

/** Humanize: each note moved in time at random, up to the amount (percent of a sixteenth). */
export function humanize(notes: readonly ToolNote[], selected: number | null, amount: number, random: () => number = Math.random): ToolNote[] {
  const reach = 0.25 * Math.max(0, Math.min(100, amount)) / 100
  return each(notes, selected, n => ({...n, at: Math.max(0, n.at + (random() * 2 - 1) * reach)}))
}

/** Reverse: the notes mirrored in time across the clip. */
export function reverse(notes: readonly ToolNote[], selected: number | null, span: ToolSpan): ToolNote[] {
  return each(notes, selected, n => ({...n, at: Math.max(0, span.start + span.end - n.at - n.len)}))
}

/** Legato: each note lasts until the next note starts (the last keeps its length). */
export function legato(notes: readonly ToolNote[], selected: number | null): ToolNote[] {
  const on = chosen(notes, selected)
  const starts = [...new Set(notes.filter(on).map(n => n.at))].sort((a, b) => a - b)
  return notes.map(n => {
    if (!on(n)) return n
    const next = starts.find(at => at > n.at)
    return next === undefined ? n : {...n, len: next - n.at}
  })
}

/** Randomize: each velocity moved at random, up to the amount. */
export function randomize(notes: readonly ToolNote[], selected: number | null, amount: number, random: () => number = Math.random): ToolNote[] {
  return each(notes, selected, n => ({...n, vel: clampVel(n.vel + (random() * 2 - 1) * Math.max(0, amount))}))
}

/** Quantize: the notes moved toward the grid by the amount. */
export function quantize(notes: readonly ToolNote[], selected: number | null, grid: string, amount: number): ToolNote[] {
  const g = GRID_BEATS[grid] ?? 0.25, a = Math.max(0, Math.min(100, amount)) / 100
  return each(notes, selected, n => ({...n, at: n.at + (Math.round(n.at / g) * g - n.at) * a}))
}

/** Span: legato joins each note to the next, tenuto holds 90 %, staccato half. */
export function span(notes: readonly ToolNote[], selected: number | null, mode: string): ToolNote[] {
  const joined = legato(notes, selected)
  const keep = mode === 'staccato' ? 0.5 : mode === 'tenuto' ? 0.9 : 1
  const on = chosen(notes, selected)
  return joined.map(n => (on(n) ? {...n, len: n.len * keep} : n))
}

/** Strum: the notes of each chord spread in time, the lowest by `low` and the highest by `high` (percent of a sixteenth). */
export function strum(notes: readonly ToolNote[], selected: number | null, low: number, high: number): ToolNote[] {
  const on = chosen(notes, selected), byStart = new Map<number, ToolNote[]>()
  for (const n of notes.filter(on)) byStart.set(n.at, [...(byStart.get(n.at) ?? []), n])
  const shift = new Map<ToolNote, number>()
  for (const chord of byStart.values()) {
    const sorted = [...chord].sort((a, b) => a.p - b.p)
    sorted.forEach((n, i) => {
      const t = sorted.length > 1 ? i / (sorted.length - 1) : 0
      shift.set(n, 0.25 * ((low + (high - low) * t) / 100))
    })
  }
  return notes.map(n => (shift.has(n) ? {...n, at: Math.max(0, n.at + shift.get(n)!)} : n))
}

/** Rhythm: a Euclidean pattern of `density` hits over `steps` steps of `step`, on one pitch, rotated by `pattern` and `shift`,
 * velocities between low and high, written from the clip's start across its span. */
export function rhythm(notes: readonly ToolNote[], from: number, to: number, o: {steps: number; density: number; pattern: number; shift: number; pitch: number; step: string; velLow: number; velHigh: number}): ToolNote[] {
  const steps = Math.max(1, Math.round(o.steps)), hits = Math.max(1, Math.min(steps, Math.round(o.density)))
  const pattern = Array.from({length: steps}, (_, i) => Math.floor((i * hits) / steps) !== Math.floor(((i - 1) * hits) / steps) || i === 0)
  const rotate = ((Math.round(o.pattern) - 1 + Math.round(o.shift)) % steps + steps) % steps
  const step = GRID_BEATS[o.step] ?? 0.5
  const written: ToolNote[] = []
  for (let k = 0, at = from; at < to; k++, at += step) {
    if (!pattern[(k + rotate) % steps]) continue
    const t = written.length % 2
    written.push({p: clampPitch(o.pitch), at, len: step, vel: clampVel(t ? o.velLow : o.velHigh), chance: 1})
  }
  return [...notes, ...written]
}
