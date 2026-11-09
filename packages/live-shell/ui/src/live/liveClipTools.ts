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

/** Arpeggiate's styles as Live 12's reference manual states them (MIDI Transformations, Arpeggiate; round 47 item 5): the order each
 * step of a run takes the chord's notes in. */
export const ARP_STYLES = ['up', 'down', 'play order', 'chord trigger', 'random', 'random other', 'random once'] as const
/** The styles Live offers whose order the chapter does not state: refused in words, never guessed. */
export const ARP_UNSTATED: Readonly<Record<string, string>> = {'up down': 'Up Down', 'down up': 'Down Up', converge: 'Converge', diverge: 'Diverge'}
export interface ArpSettings {readonly style: string; readonly distance: number; readonly steps: number; readonly rate: string; readonly gate: number}

/** A pitch moved by `by`: semitones, or the clip's scale degrees while its scale is on (a pitch off the scale moves from the degree
 * below it). */
function transposed(p: number, by: number, scale: ToolScale | null): number {
  if (!scale || by === 0 || !scale.steps.length) return p + by
  const degree = (q: number) => { let d = 0; while (!inScale(q - d, scale)) d++; return q - d }
  const octave = scale.steps.length
  const base = degree(p), offset = p - base
  const index = scale.steps.indexOf(((base - scale.root) % 12 + 12) % 12)
  const whole = index + by, up = Math.floor(whole / octave), at = ((whole % octave) + octave) % octave
  return base - scale.steps[index]! + scale.steps[at]! + 12 * up + offset
}

/** Arpeggiate (Live 12's reference manual, MIDI Transformations, Arpeggiate; round 47 item 5): each chord — the notes that share a start,
 * the selected note's chord, else every chord — is played as a run over the chord's own length. A step lasts `rate`, and its note holds
 * `gate` percent of it. The run takes the chord's notes in `style`'s order, then again `steps` times, each pass moved by `distance`
 * (semitones, or the clip's scale degrees while its scale is on): Distance +12 with Steps 2 plays C3, C4, C5 from a C3. Chord Trigger
 * plays each pass's notes together. The random styles take `random`: Random a note at each step, Random Other every note once before any
 * again, Random Once one order kept. A note outside MIDI's range is left out. A style whose order the chapter does not state is refused. */
export function arpeggiate(notes: readonly ToolNote[], selected: number | null, o: ArpSettings, scale: ToolScale | null,
  random: () => number = Math.random): ToolNote[] | {refused: string} {
  const unstated = ARP_UNSTATED[o.style]
  if (unstated) return {refused: `Arpeggiate's ${unstated} style is not made here: Live's manual does not state the order it takes, so only Up, Down, Play Order, Chord Trigger and the three Random styles are.`}
  if (!(ARP_STYLES as readonly string[]).includes(o.style)) return {refused: `${o.style} is no style of Arpeggiate.`}
  const rate = GRID_BEATS[o.rate]
  if (rate === undefined) return {refused: `${o.rate} is no rate of Arpeggiate: ${Object.keys(GRID_BEATS).join(', ')}.`}
  const on = chosen(notes, selected), pick = notes.find(n => n.id === selected)
  const acted = notes.filter(n => on(n) || (pick !== undefined && n.at === pick.at))
  if (!acted.length) return {refused: 'The clip holds no notes to arpeggiate.'}
  const byStart = new Map<number, ToolNote[]>()
  for (const n of acted) byStart.set(n.at, [...(byStart.get(n.at) ?? []), n])
  const gone = new Set(acted), passes = Math.max(0, Math.round(o.steps)) + 1, hold = rate * Math.max(1, o.gate) / 100
  const shuffled = (xs: readonly ToolNote[]) => { const out = [...xs]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!] } return out }
  const made: ToolNote[] = []
  for (const [start, chord] of byStart) {
    const length = Math.max(...chord.map(n => n.len))
    const order = o.style === 'down' ? [...chord].sort((a, b) => b.p - a.p) : o.style === 'play order' ? [...chord].sort((a, b) => (a.id ?? Infinity) - (b.id ?? Infinity))
      : o.style === 'random once' ? shuffled([...chord].sort((a, b) => a.p - b.p)) : [...chord].sort((a, b) => a.p - b.p)
    const pass = (k: number) => order.map(n => ({...n, p: transposed(n.p, k * o.distance, scale)}))
    const run = o.style === 'chord trigger' ? Array.from({length: passes}, (_, k) => pass(k)) : Array.from({length: passes}, (_, k) => pass(k)).flat().map(n => [n])
    let bag: ToolNote[][] = []
    for (let step = 0; start + step * rate < start + length - 1e-9; step++) {
      let played: ToolNote[]
      if (o.style === 'random') played = run[Math.floor(random() * run.length)]!
      else if (o.style === 'random other') { if (!bag.length) bag = shuffled(run.map(n => n[0]!)).map(n => [n]); played = bag.shift()! }
      else played = run[step % run.length]!
      for (const n of played) {
        if (n.p < 0 || n.p > 127) continue
        const {id: _id, ...fields} = n
        made.push({...fields, at: start + step * rate, len: hold})
      }
    }
  }
  return [...notes.filter(n => !gone.has(n)), ...made]
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

// The roll's hand (walk of O-I 857, LN02; DLW build ruling 2026-11-07): a note drawn where the hand double-clicks an empty row, one
// removed where it double-clicks a note, one moved or lengthened by a drag. Each keeps every other note, ids and all; a drawn note has
// no id (the set's owner gives it one), velocity 100 and its chance whole, as Live draws one.
const minLen = 1 / 128

/** A note drawn at `at` on row `p`, `len` long. */
export function drawNote(notes: readonly ToolNote[], p: number, at: number, len: number): ToolNote[] {
  return [...notes, {p: clampPitch(p), at: Math.max(0, at), len: Math.max(minLen, len), vel: 100, chance: 1}]
}

const named = (notes: readonly ToolNote[], id: number) => {
  if (!notes.some(n => n.id === id)) throw new Error(`There is no note ${id} in the clip: it was read again since the hand found it.`)
}

/** The clip's notes without note `id`. */
export function eraseNote(notes: readonly ToolNote[], id: number): ToolNote[] {
  named(notes, id)
  return notes.filter(n => n.id !== id)
}

/** Note `id` moved to `at` on row `p`. */
export function moveNote(notes: readonly ToolNote[], id: number, at: number, p: number): ToolNote[] {
  named(notes, id)
  return notes.map(n => (n.id === id ? {...n, at: Math.max(0, at), p: clampPitch(p)} : n))
}

/** Note `id` made `len` long. */
export function lengthenNote(notes: readonly ToolNote[], id: number, len: number): ToolNote[] {
  named(notes, id)
  return notes.map(n => (n.id === id ? {...n, len: Math.max(minLen, len)} : n))
}
