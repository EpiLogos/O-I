// Live's Record on the Torus, and the Torus kept with the set (O-I #855; manual §21.2 Transport, "Record | Records what you play into
// Arrangement view as notes"; §21.1 Takes and Arrangement lanes, "Record a part and each pass lies as a take lane under its track";
// §21.2 Rules, "A recorded performance keeps what it needs to be played on … Where the field's motion cannot be replayed exactly, the
// recording says from which state it resumes", and "A saved sound keeps every parameter … It opens with the same sound").
//
// What is recorded is what the part's one playing path played (live/janko/jankoInput.ts onNote): each note's number, the key it struck on
// the Jankó surface, its strength and its source, from the moment it was struck until it ended. A clip's notes and the sitting's bell are
// not played by hand and are not recorded. The Torus as its owner announced it when the take began (its settings with the tuning, its
// determinants, its level and effects, and what it read as it stood: the Fundamental the map gave, the map's 1:1, the comma gathered, the
// band, the figure and the tunings resident) is the state the take is played on again, and each move the owner took during the take is
// kept with its beat.
//
// Where it lands is the set's own (packages/live-set acts.rs `take_record`, through the kernel's live_set_act): the notes as a MIDI clip in a
// new take lane of the part, laid in its main lane, carrying the set's next TakeId; what Live's document cannot hold — the keys, the exact
// strengths, the Torus and its moves — stands beside the set by that TakeId (sources.rs `takes`). A take played again sets the Torus as it
// stood before its notes strike, strikes each note at its touch-point and strength, and makes its moves again at their beats (prepareTake,
// live/clipPlayer.ts `prepare`). The open set keeps the Torus with a MIDI part (`torus_keep`,
// sources.rs `parts`) each time what sets it changes and rests, and when a take is laid on a part; a set opened again sets the Torus as its
// part keeps it before anything more is kept (createTorusKeeper).
//
// The Torus's course (round 6d): the owner keeps the Torus as it rings (the frame's `torus` checkpoint, QL-MEF torus-checkpoint: its body,
// form and forces, the M1′ session's steps, comma and notes, the event and its seeds) and journals each act it takes with the sample it
// landed at (`performance-journal`). Record keeps the checkpoint taken as the take begins and the acts of the journal that land in it
// (takeCourse), so each note lies at the sample it landed at. A take played again with its clip as it was laid sets the Torus as it
// stood, rings it again from the checkpoint (`torus` restore) and lands each act at its own sample after that (ClipPrepared `exact`,
// live/clipPlayer.ts); Export Audio on the take's clip renders the course offline (`render-take`), part after part, each part from the
// checkpoint the last one ended at (renderTake, exportTake). A take whose course cannot be kept (an act that moved the scene, an owner
// that kept no state of it) says why, plays as before from the body as it then rings (TAKE_RESUMES), and is not exported.
import {useEffect, useState, useSyncExternalStore} from 'react'
import {isStageSampleCursor, readInstrumentEdit, readStageTorusCheckpoint, stageJournalLanding, STAGE_JANKO_KEYS_MAX, STAGE_RENDER_FRAMES_MAX, type InstrumentEdit,
  type StageCommand, type StageKey, type StagePerformanceJournal, type StageResult, type StageTakeAct, type StageTorusCheckpoint} from '@epilogos/expressions-boundary'
import type {LiveClipAt, LiveClipReading, LiveNote, LiveSetAct, LiveSetActed} from '../../../../../desktop/cradle/src/kernel/types'
import type {SlotBinding} from '../frame/transport/slots'
import type {NoteSource, PlayedNote} from './janko/jankoInput'
import type {ClipMove, ClipPrepared} from './clipPlayer'
import type {LiveTorusState} from './torusInstrument'

export const TAKE_SCHEMA = 'oi.live-take/v1'
export const TORUS_KEPT_SCHEMA = 'oi.live-torus/v1'

/** What a take cannot yet replay exactly, and the state it resumes from: said with the take, and when it plays. */
export const TAKE_RESUMES = 'The take plays each note again at the touch-point it struck and at its strength, on the Torus set as it stood '
  + 'when the take began, and makes each move of the Torus again at its beat, within a block of the sound. The body\'s course, its form and '
  + 'forces, the comma it had gathered and the seeds are not kept yet, so it resumes from the body as it then rings.'
/** What the take does not keep, named for the record. */
export const TAKE_NOT_KEPT = Object.freeze(['the course of the body', 'the form and the forces', 'the seeds', 'the sample each note landed at',
  'the sample each move landed at', 'how the ruler met the sound'] as const)

export const TAKE_COURSE_SCHEMA = 'oi.live-take-course/v1'
/** What a take with its course replays, and how: said with the take, and when it plays. */
export const TAKE_REPLAYS = 'The take plays again as it was played: the Torus rings again from the state it rang in when the take began (its body, '
  + 'its form and forces, the comma it had gathered and its seeds), and each note, touch, singlet, release and setting of the Torus lands '
  + 'at the sample it landed at. The level and effects move at their beats, within a block of the sound.'
/** Where a take that keeps its course resumes when it cannot play it (its clip changed, or the Torus did not ring again from its state). */
export const TAKE_RESUMES_INSTEAD = 'It plays its notes as its clip holds them, each at the touch-point it struck and at its strength, on the Torus set as it '
  + 'stood when the take began, and makes each move again at its beat, within a block of the sound: it resumes from the body as it then rings.'
/** What a take with its course does not keep: the frame's own sound moves by beat, not by sample. */
export const TAKE_COURSE_NOT_KEPT = Object.freeze(['the sample each move of the level and effects landed at'] as const)
/** Said with a take laid with its course. */
export const TAKE_EXPORTS = 'Export Audio on its clip renders it as it was played, sample for sample.'
const noCourse = (why: string) => `This take keeps no course of the Torus, so Export Audio cannot render it: ${sentence(why)}`
/** The most a set keeps beside one take (packages/live-set sources.rs KEEP_BYTES_MAX): a course past it is not kept. */
const KEEP_BYTES_MAX = 256 * 1024

// ── the Torus, kept ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Plain = Record<string, unknown>
const plain = (value: unknown): value is Plain => !!value && typeof value === 'object' && !Array.isArray(value)

/** The Torus as its owner announced it: what the instrument command sets again (`edits`, each the command's own), and what it read as it
 * stood, which nothing sets (`stood`). */
export interface TorusKept {
  readonly schema: typeof TORUS_KEPT_SCHEMA
  readonly edits: readonly InstrumentEdit[]
  readonly stood: Readonly<Plain>
}

/** The Torus as it stands now, kept; null while its owner announces no session (no frame, or a refusal). Pure. */
export function torusKept(state: LiveTorusState | null): TorusKept | null {
  if (state === null || !state.ok || !state.parameters?.torus) return null
  const {torus, level, effects} = state.parameters
  const d = state.determinants
  const raw: unknown[] = [{kind: 'torus', edit: torus.settings}, {kind: 'level', value: level}]
  if (d) raw.push({kind: 'lens', lens12: d.lens.lens12}, {kind: 'context-frame', context_frame: d.contextFrame},
    {kind: 'harmonic', source: d.harmonic}, {kind: 'transcription', rna: d.rna})
  if (effects) {
    raw.push({kind: 'effect-chain', chain: [...effects.chain]})
    for (const effect of ['filter', 'dynamics', 'delay', 'reverb', 'resonator'] as const) {
      for (const [key, value] of Object.entries(effects[effect] ?? {})) raw.push({kind: 'effect', effect, key, value})
    }
  }
  const edits = raw.map(readInstrumentEdit).filter((edit): edit is InstrumentEdit => edit !== null)
  // The count of notes sounding is the playing's, not the Torus's state, so it is not kept.
  const {settings: _settings, notes: _notes, ...stood} = torus
  return {schema: TORUS_KEPT_SCHEMA, edits, stood: structuredClone(stood) as Plain}
}

/** Whether two kept Tori set the Torus alike (what they read as they stood aside). Pure. */
export const sameTorusEdits = (a: TorusKept | null, b: TorusKept | null): boolean => JSON.stringify(a?.edits ?? null) === JSON.stringify(b?.edits ?? null)

/** A kept Torus read back from the set: each edit through the instrument command's own reader, or null when it is no kept Torus. Pure. */
export function torusKeptOf(raw: unknown): TorusKept | null {
  if (!plain(raw) || raw.schema !== TORUS_KEPT_SCHEMA || !Array.isArray(raw.edits) || !plain(raw.stood)) return null
  const edits = raw.edits.map(readInstrumentEdit)
  return edits.every(edit => edit !== null) ? {schema: TORUS_KEPT_SCHEMA, edits: edits as InstrumentEdit[], stood: raw.stood} : null
}

/** The edits that move the Torus from one kept state to the next: each edit of `next` that `previous` did not make alike. Pure. */
export function torusMoveEdits(previous: TorusKept | null, next: TorusKept): InstrumentEdit[] {
  const made = new Set((previous?.edits ?? []).map(edit => JSON.stringify(edit)))
  return next.edits.filter(edit => !made.has(JSON.stringify(edit)))
}

/** Set the Torus again as it was kept: each edit in turn through the instrument command. Answers what the owner refused, in its words. */
export async function setTorusAgain(kept: TorusKept, commit: (edit: InstrumentEdit) => Promise<StageResult>): Promise<{readonly refused: readonly string[]}> {
  const refused: string[] = []
  for (const edit of kept.edits) {
    const answer = await commit(edit).catch((cause: unknown) => ({ok: false as const, error: cause instanceof Error ? cause.message : String(cause)}))
    if (!answer.ok) refused.push(answer.error)
  }
  return {refused}
}

// ── the recorder ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Where and on what a take is recorded: the set, the part (its index and name), the set's tempo, the beat of the ruler it lies from, the
 * Torus as it stood and the mode in force. */
export interface TakeContext {
  readonly path: string
  readonly track: number
  readonly part: string
  readonly bpm: number
  readonly start: number
  readonly torus: TorusKept | null
  readonly mode: {readonly root: number; readonly scale: string | null} | null
}

/** One note played during the take: its number, the key and touch-point it struck, its strength and source, and when it was struck and
 * ended (page ms; null: still held). */
export interface RecordedNote {
  readonly note: number
  readonly key: {readonly row: number; readonly column: number}
  readonly touch: number
  readonly amplitude: number
  readonly source: NoteSource | null
  readonly on: number
  off: number | null
}

export interface RecordedTake {
  readonly context: TakeContext
  readonly startedAt: number
  readonly stoppedAt: number
  readonly notes: readonly RecordedNote[]
  /** The Torus after each move its owner took during the take (page ms). */
  readonly moves: readonly {readonly at: number; readonly torus: TorusKept}[]
}

export interface TakeRecorder {
  /** Begin a take at the page's `at` (ms). A take already recording is replaced. */
  start(context: TakeContext, at: number): void
  /** A note the path played (jankoInput onNote). */
  played(note: PlayedNote): void
  /** The Torus's owner announced its state: a change to what sets it is a move, kept with its time. */
  moved(torus: TorusKept | null, at: number): void
  /** End the take at `at`: every note still held ends there. Null when none records. */
  stop(at: number): RecordedTake | null
  recording(): TakeContext | null
}

export function createTakeRecorder(): TakeRecorder {
  let take: {context: TakeContext; startedAt: number; notes: RecordedNote[]; open: Map<string, RecordedNote>; moves: {at: number; torus: TorusKept}[]; last: TorusKept | null} | null = null
  return {
    start(context, at) {
      take = {context, startedAt: at, notes: [], open: new Map(), moves: [], last: context.torus}
    },
    played(event) {
      if (!take || event.at < take.startedAt) return
      const open = take.open.get(event.id)
      if (open) { open.off = event.at; take.open.delete(event.id) }
      if (event.kind === 'off') return
      const note: RecordedNote = {note: event.note, key: {row: event.key.row, column: event.key.column}, touch: event.touch, amplitude: event.amplitude,
        source: event.source, on: event.at, off: null}
      take.notes.push(note)
      take.open.set(event.id, note)
    },
    moved(torus, at) {
      // A move is a change to what sets the Torus; its readings change as it plays (the comma it gathers) and are not moves.
      if (!take || torus === null || sameTorusEdits(torus, take.last)) return
      take.last = torus
      take.moves.push({at, torus})
    },
    stop(at) {
      if (!take) return null
      const done = take
      take = null
      for (const note of done.open.values()) note.off = at
      return {context: done.context, startedAt: done.startedAt, stoppedAt: Math.max(at, done.startedAt), notes: done.notes, moves: done.moves}
    },
    recording: () => take?.context ?? null,
  }
}

// ── the Torus's course ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The Torus's course over a take: the state it rang in as the take began (its owner's checkpoint), the take's length in samples at the
 * owner's rate, and each act the owner took that lands in it, at its sample, as render-take makes it, in the order of their samples. */
export interface TakeCourse {
  readonly schema: typeof TAKE_COURSE_SCHEMA
  readonly checkpoint: StageTorusCheckpoint
  readonly from_samples_elapsed: string
  readonly frames: number
  readonly sample_rate: number
  readonly acts: readonly StageTakeAct[]
}

/** What Record read of the owner for a take: its course, with the samples each note struck now (a key, MIDI, a pointer: an act naming no
 * sample of its own) and each release landed at, by key; or why it has none. */
export type TakeLanding =
  | {readonly course: TakeCourse; readonly struck: ReadonlyMap<string, readonly bigint[]>; readonly released: ReadonlyMap<string, readonly bigint[]>}
  | {readonly refused: string}

/** The owner's acts that move no sound: its stage's slots. The journal leaves out every read. */
const STILL_OPERATIONS: ReadonlySet<string> = new Set(['stage-retire', 'stage-bind', 'stage-unbind'])
const keyOf = (key: StageKey) => `${key.row}/${key.column}`
/** The most points one touch strikes (the frame's STAGE_STRIKE_AT_MAX_POINTS). */
const TAKE_POINTS_MAX = 64
/** 1..64 points of the sheet, each its two angles in [0, 2π) (the frame's `strike-at`); null for anything else. Pure. */
function takePoints(raw: unknown): {theta: number; phi: number}[] | null {
  const onSheet = (angle: unknown): angle is number => typeof angle === 'number' && Number.isFinite(angle) && angle >= 0 && angle < 2 * Math.PI
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > TAKE_POINTS_MAX) return null
  const points = raw.map(point => plain(point) && onSheet(point.theta) && onSheet(point.phi) ? {theta: point.theta, phi: point.phi} : null)
  return points.every(point => point !== null) ? points as {theta: number; phi: number}[] : null
}
const isStrength = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1
const isCodon = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 64
/** 1..32 keys of the surface, read exact; null for anything else. Pure. */
function takeKeys(raw: unknown): StageKey[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > STAGE_JANKO_KEYS_MAX) return null
  const keys = raw.map(key => plain(key) && Number.isSafeInteger(key.row) && (key.row as number) >= 0 && (key.row as number) < 6 && Number.isSafeInteger(key.column)
    && (key.column as number) >= 0 && (key.column as number) <= 65535 ? {row: key.row as number, column: key.column as number} : null)
  return keys.every(key => key !== null) && new Set(keys.map(key => keyOf(key!))).size === keys.length ? keys as StageKey[] : null
}

/** The take's course from what its owner kept: the checkpoint as the take began, and each act of its journal admitted before Stop (`until`,
 * the owner's cursor then) that lands in the take's `frames`, made as render-take makes it. An act no render makes moved the scene: a take
 * over it has no course. Pure. */
export function takeCourse(checkpoint: StageTorusCheckpoint, journal: StagePerformanceJournal, until: string, frames: number): TakeLanding {
  if (!Number.isSafeInteger(frames) || frames < 1) return {refused: 'the take has no length to render'}
  const from = BigInt(checkpoint.taken_at_samples), stop = BigInt(until), end = from + BigInt(frames)
  const acts: {at: bigint; act: StageTakeAct}[] = []
  const struck = new Map<string, bigint[]>(), released = new Map<string, bigint[]>()
  const note = (into: Map<string, bigint[]>, keys: readonly StageKey[], at: bigint) => { for (const key of keys) into.set(keyOf(key), [...(into.get(keyOf(key)) ?? []), at]) }
  for (const entry of journal.acts) {
    if (entry.kind !== 'act' || BigInt(entry.acknowledged.samples_elapsed) >= stop) continue
    const at = stageJournalLanding(entry), sample = BigInt(at)
    if (sample < from || sample >= end) continue
    const command = entry.command
    if (entry.operation === 'torus-play') {
      const keys = takeKeys(command.keys), amplitude = command.amplitude
      if (!Array.isArray(amplitude) || amplitude.length !== 2 || amplitude[1] !== 0)
        return {refused: `torus-play struck at sample ${at} with a second amplitude, which a take's render does not strike`}
      const strength = amplitude[0]
      if (!keys || typeof strength !== 'number' || !(strength > 0 && strength <= 1)) return {refused: `torus-play at sample ${at} names no keys at a strength in (0, 1]`}
      acts.push({at: sample, act: {action: 'strike', at_samples_elapsed: at, keys, amplitude: strength}})
      if (!isStageSampleCursor(command.at_samples_elapsed)) note(struck, keys, sample)
    } else if (entry.operation === 'torus-release') {
      const keys = takeKeys(command.keys)
      if (!keys) return {refused: `torus-release at sample ${at} names no keys`}
      acts.push({at: sample, act: {action: 'release', at_samples_elapsed: at, keys}})
      note(released, keys, sample)
    } else if (entry.operation === 'torus-set') {
      const edit = readInstrumentEdit({kind: 'torus', edit: command.edit})
      if (!edit || edit.kind !== 'torus') return {refused: `torus-set at sample ${at} carries no setting a take's render makes`}
      acts.push({at: sample, act: {action: 'set', at_samples_elapsed: at, edit: edit.edit}})
    } else if (entry.operation === 'strike-at') {
      // A touch strikes each of its points at the one impulse (the frame's controller.ts playAt), as a take's render strikes it again.
      const raw = Array.isArray(command.points) ? command.points as unknown[] : []
      const points = takePoints(raw)
      if (!points) return {refused: `strike-at at sample ${at} names no points on the sheet`}
      const impulses = raw.map(point => (point as Plain).amplitude)
      if (!impulses.every(pair => Array.isArray(pair) && pair.length === 2 && pair[1] === 0))
        return {refused: `strike-at struck at sample ${at} with a second amplitude, which a take's render does not strike`}
      const strengths = new Set(impulses.map(pair => (pair as unknown[])[0]))
      if (strengths.size !== 1) return {refused: `strike-at at sample ${at} struck its points at more than one strength, which a take's render does not strike`}
      const strength = (impulses[0] as unknown[])[0]
      if (!isStrength(strength)) return {refused: `strike-at at sample ${at} names no points at a strength in (0, 1]`}
      acts.push({at: sample, act: {action: 'strike-at', at_samples_elapsed: at, points, amplitude: strength}})
    } else if (entry.operation === 'torus-singlet') {
      const amplitude = command.amplitude
      if (!Array.isArray(amplitude) || amplitude.length !== 2 || amplitude[1] !== 0)
        return {refused: `torus-singlet struck at sample ${at} with a second amplitude, which a take's render does not strike`}
      if (!isCodon(command.codon) || !isStrength(amplitude[0])) return {refused: `torus-singlet at sample ${at} names no codon of the 64 at a strength in (0, 1]`}
      acts.push({at: sample, act: {action: 'singlet', at_samples_elapsed: at, codon: command.codon, amplitude: amplitude[0]}})
    } else if (!STILL_OPERATIONS.has(entry.operation)) return {refused: `${entry.operation} moved the scene at sample ${at} during the take`}
  }
  // In the order of their samples; acts at one sample in the order the owner took them.
  const ordered = acts.map((entry, index) => ({...entry, index})).sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : a.index - b.index)
  return {course: {schema: TAKE_COURSE_SCHEMA, checkpoint, from_samples_elapsed: checkpoint.taken_at_samples, frames, sample_rate: checkpoint.sample_rate,
    acts: ordered.map(entry => entry.act)}, struck, released}
}

/** A kept course read back from the set, exact (its checkpoint within its bounds, each act within the take and in sample order); null
 * for anything else. Pure. */
export function takeCourseOf(raw: unknown): TakeCourse | null {
  if (!plain(raw) || raw.schema !== TAKE_COURSE_SCHEMA || !Array.isArray(raw.acts)) return null
  const checkpoint = readStageTorusCheckpoint(raw.checkpoint)
  if (!checkpoint || raw.from_samples_elapsed !== checkpoint.taken_at_samples || raw.sample_rate !== checkpoint.sample_rate) return null
  const frames = raw.frames
  if (!Number.isSafeInteger(frames) || (frames as number) < 1) return null
  const from = BigInt(checkpoint.taken_at_samples), end = from + BigInt(frames as number)
  const acts: StageTakeAct[] = []
  let last = from
  for (const act of raw.acts) {
    if (!plain(act) || !isStageSampleCursor(act.at_samples_elapsed)) return null
    const at = BigInt(act.at_samples_elapsed)
    if (at < last || at >= end) return null
    last = at
    const keys = act.action === 'strike' || act.action === 'release' ? takeKeys(act.keys) : null
    const only = (...names: string[]) => Object.keys(act).every(name => ['action', 'at_samples_elapsed', ...names].includes(name))
    if (act.action === 'strike' && keys && typeof act.amplitude === 'number' && act.amplitude > 0 && act.amplitude <= 1) acts.push({action: 'strike', at_samples_elapsed: act.at_samples_elapsed, keys, amplitude: act.amplitude})
    else if (act.action === 'release' && keys) acts.push({action: 'release', at_samples_elapsed: act.at_samples_elapsed, keys})
    else if (act.action === 'strike-at' && only('points', 'amplitude') && isStrength(act.amplitude)) {
      const points = takePoints(act.points)
      if (!points || !(act.points as unknown[]).every(point => Object.keys(point as Plain).length === 2)) return null
      acts.push({action: 'strike-at', at_samples_elapsed: act.at_samples_elapsed, points, amplitude: act.amplitude})
    } else if (act.action === 'singlet' && only('codon', 'amplitude') && isCodon(act.codon) && isStrength(act.amplitude))
      acts.push({action: 'singlet', at_samples_elapsed: act.at_samples_elapsed, codon: act.codon, amplitude: act.amplitude})
    else if (act.action === 'set') {
      const edit = readInstrumentEdit({kind: 'torus', edit: act.edit})
      if (!edit || edit.kind !== 'torus') return null
      acts.push({action: 'set', at_samples_elapsed: act.at_samples_elapsed, edit: edit.edit})
    } else return null
  }
  return {schema: TAKE_COURSE_SCHEMA, checkpoint, from_samples_elapsed: checkpoint.taken_at_samples, frames: frames as number, sample_rate: checkpoint.sample_rate, acts}
}

/** A bar of 4/4: a take lies from a bar's start and lasts whole bars, as a new clip does. */
export const TAKE_BAR_BEATS = 4
/** Said when Record is stopped with nothing played. */
export const NOTHING_PLAYED = 'Nothing was played on the part, so no take was laid.'

const beatsOf = (ms: number, bpm: number) => (ms / 1000) * (bpm / 60)
const round = (value: number) => Math.round(value * 1e6) / 1e6

/** A take's length in beats: the whole bars it spans, one at least. Pure. */
export function takeLength(take: RecordedTake): number {
  const span = beatsOf(take.stoppedAt - take.startedAt, take.context.bpm)
  return Math.max(TAKE_BAR_BEATS, Math.ceil(round(span) / TAKE_BAR_BEATS) * TAKE_BAR_BEATS)
}

/** Said of a take Record laid with no stage channel to the Torus's owner. */
const NO_STAGE = 'Record reached no stage channel to the Torus\'s owner, which keeps its state and journal'

/** The set's act that lays the take (packages/live-set acts.rs take_record): its notes in beats of the take's own time, velocity from each
 * strength, its length the whole bars it spans, and what it keeps beyond its notes; or why there is nothing to lay. With the Torus's
 * course (`landing`), each note lies at the sample it landed at and is let go at the sample its release landed at, and the take keeps the
 * course; else at the page's time, and the take says why it keeps none. Pure. */
export function takeRecordAct(take: RecordedTake, name: string, landing?: TakeLanding): Extract<LiveSetAct, {kind: 'take_record'}> | {readonly refused: string} {
  const {context, startedAt, stoppedAt} = take
  const length = takeLength(take)
  // A note struck as the take ends has no time in it to sound.
  const played = take.notes.filter(note => round(beatsOf(note.on - startedAt, context.bpm)) < length)
  if (played.length === 0) return {refused: NOTHING_PLAYED}
  const course = landing && 'course' in landing ? landing : null
  // Each key's strikes and releases as the owner landed them, taken in turn by the notes played on it.
  const used = new Map<string, number>()
  const landed = (note: RecordedNote): LiveNote | null => {
    if (!course) return null
    const key = keyOf(note.key), turn = used.get(key) ?? 0
    const on = course.struck.get(key)?.[turn]
    if (on === undefined) return null
    used.set(key, turn + 1)
    const {from_samples_elapsed, sample_rate} = course.course
    const beatOf = (samples: bigint) => (Number(samples) / sample_rate) * (context.bpm / 60)
    const at = round(beatOf(on - BigInt(from_samples_elapsed)))
    if (at >= length) return null
    const off = course.released.get(key)?.find(sample => sample >= on)
    const len = off !== undefined ? beatOf(off - on) : beatsOf((note.off ?? stoppedAt) - note.on, context.bpm)
    return {p: note.note, at, len: round(Math.max(0, Math.min(length - at, len))), vel: velocityOf(note.amplitude)}
  }
  const notes: LiveNote[] = played.map(note => {
    const sampled = landed(note)
    if (sampled) return sampled
    const at = round(beatsOf(note.on - startedAt, context.bpm))
    const len = round(Math.max(0, Math.min(length - at, beatsOf((note.off ?? stoppedAt) - note.on, context.bpm))))
    return {p: note.note, at, len, vel: velocityOf(note.amplitude)}
  })
  const base = {
    schema: TAKE_SCHEMA,
    // How each note was played, by its number and beat: the key and touch-point it struck, its exact strength and its source; and its
    // length and velocity as it was laid, so a clip changed since is known.
    notes: played.map((note, i) => ({p: note.note, at: notes[i]!.at, len: notes[i]!.len, vel: notes[i]!.vel, key: note.key, touch: note.touch,
      strength: note.amplitude, source: note.source})),
    torus: context.torus,
    moves: take.moves.map(move => ({beat: round(beatsOf(move.at - startedAt, context.bpm)), torus: move.torus})),
    mode: context.mode,
    bpm: context.bpm,
  }
  const without = (why: string) => ({...base, course: null, course_refused: why, resumes: TAKE_RESUMES, not_kept: [...TAKE_NOT_KEPT]})
  let keeps: Record<string, unknown> = course ? {...base, course: course.course, resumes: TAKE_REPLAYS, not_kept: [...TAKE_COURSE_NOT_KEPT]}
    : without(landing && 'refused' in landing ? landing.refused : NO_STAGE)
  const bytes = new TextEncoder().encode(JSON.stringify(keeps)).length
  if (course && bytes > KEEP_BYTES_MAX) keeps = without(`its course takes ${Math.ceil(bytes / 1024)} KiB beside the take, past the 256 KiB the set keeps beside one`)
  return {kind: 'take_record', track: context.track, start: context.start, length, name, notes, keeps}
}
const velocityOf = (amplitude: number) => Math.max(1, Math.min(127, Math.round(amplitude * 127)))

/** The beat a new take lies from: the first bar after everything the part's main lane holds. Pure. */
export function takeStartOf(clips: readonly {readonly end: number}[]): number {
  const end = clips.reduce((most, clip) => Number.isFinite(clip.end) ? Math.max(most, clip.end) : most, 0)
  return Math.ceil(round(end) / TAKE_BAR_BEATS) * TAKE_BAR_BEATS
}

// ── a take played again ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A note's place in a take, to a thousandth of a beat: what the set keeps of its time, read back. */
const placeOf = (note: number, beat: number) => `${note}|${Math.round(beat * 1000)}`

/** How each note of a take was played, from what it keeps: the touch-point it struck and its exact strength, by its number and beat. Pure. */
export function takeVoice(keeps: unknown): ClipPrepared['voice'] | undefined {
  const played = plain(keeps) && Array.isArray(keeps.notes) ? keeps.notes : []
  const voices = new Map<string, {touch: number; strength: number}>()
  for (const note of played) {
    if (!plain(note) || !Number.isSafeInteger(note.p) || typeof note.at !== 'number' || !Number.isFinite(note.at)) continue
    const touch = Number.isSafeInteger(note.touch) && (note.touch as number) >= 0 ? note.touch as number : 0
    const strength = typeof note.strength === 'number' && note.strength > 0 && note.strength <= 1 ? note.strength : null
    if (strength !== null) voices.set(placeOf(note.p as number, note.at), {touch, strength})
  }
  return voices.size ? (note, beat) => voices.get(placeOf(note, beat)) ?? null : undefined
}

/** What a take's clip plays through beside the instrument command: the frame's stage channel (the Torus rung again from the take's state)
 * and the set's tempo. */
export interface TakePlay {
  readonly stage: (command: StageCommand) => Promise<StageResult>
  readonly bpm: number
}

/** The edits the frame makes on its own sound: they move by beat in a take played as it was played, and are not in its render. */
const FRAME_SOUND_KINDS: ReadonlySet<string> = new Set(['level', 'effect-chain', 'effect'])
/** Notes as Live writes them back: a beat to well within a thousandth. */
const SAME_BEAT = 5e-4

/** Why a take's clip cannot play its course: it loops, plays from another start, at another tempo, or its notes changed since it was
 * laid; null when it is as it was laid. Pure. */
function clipChanged(clip: LiveClipReading, keeps: Plain, bpm: number): string | null {
  if (clip.loop) return 'This take\'s clip loops, and its course plays once, from its beginning.'
  if (typeof clip.start === 'number' && Math.abs(clip.start) > SAME_BEAT) return 'This take\'s clip plays from a start marker after its beginning, and its course plays from its beginning.'
  if (typeof keeps.bpm === 'number' && Math.abs(keeps.bpm - bpm) > 1e-6) return `The set plays at ${bpm} BPM, and the take was played at ${keeps.bpm} BPM.`
  const order = (a: {p: number; at: number}, b: {p: number; at: number}) => a.at - b.at || a.p - b.p
  const now = (clip.notes ?? []).filter(note => note.on !== false).map(note => ({p: note.p, at: note.at, len: note.len, vel: note.vel})).sort(order)
  const laid = (Array.isArray(keeps.notes) ? keeps.notes : []).filter(plain).map(note => ({p: Number(note.p), at: Number(note.at), len: Number(note.len), vel: Number(note.vel)})).sort(order)
  const same = now.length === laid.length && now.every((note, i) => {
    const was = laid[i]!
    return note.p === was.p && note.vel === was.vel && Math.abs(note.at - was.at) <= SAME_BEAT && Math.abs(note.len - was.len) <= SAME_BEAT
  })
  return same ? null : 'This take\'s clip was changed since it was laid, and its course plays the take as it was played.'
}

/** Before a take's clip plays (live/clipPlayer.ts `prepare`): the Torus is set again as it stood when the take began, and the take says
 * where it resumes. A take with its course, its clip as it was laid, rings again from the state the Torus rang in when it began (the
 * owner's checkpoint, restored through the frame's stage channel) and answers the course to play at its samples from there (`exact`),
 * with the moves of the frame's own sound by beat. Any other take voices each note as it was played and makes its moves at their beats.
 * A clip no take gave answers null; a take whose Torus was not kept says it plays on the Torus as it now stands. */
export async function prepareTake(clip: LiveClipReading, commit: (edit: InstrumentEdit) => Promise<StageResult>, play?: TakePlay): Promise<ClipPrepared | null> {
  const keeps = clip.take?.keeps
  if (!clip.take) return null
  if (!plain(keeps) || keeps.schema !== TAKE_SCHEMA) {
    return {resumes: clip.take.keepsRefused
      ? `What this take keeps could not be read (${clip.take.keepsRefused}), so it plays as its notes are written, on the Torus as it now stands.`
      : 'This take keeps nothing beside its notes, so it plays as its notes are written, on the Torus as it now stands.'}
  }
  const voice = takeVoice(keeps)
  const kept = torusKeptOf(keeps.torus)
  const moves = takeMoves(kept, keeps.moves)
  const played = {...(voice ? {voice} : {}), ...(moves.length ? {moves} : {})}
  // A take from before courses says what it said; one with a course that cannot play says why, and resumes from the body as it then rings.
  const course = 'course' in keeps ? takeCourseOf(keeps.course) : undefined
  const why = course === undefined ? null
    : course === null ? (typeof keeps.course_refused === 'string' ? `This take keeps no course of the Torus: ${sentence(keeps.course_refused)}`
      : 'This take\'s course could not be read.')
    : !play ? 'Nothing here reaches the Torus\'s owner to ring it again from the take\'s state.'
      : clipChanged(clip, keeps, play.bpm)
  const resumes = why ? `${why} ${course === null ? TAKE_RESUMES : TAKE_RESUMES_INSTEAD}` : typeof keeps.resumes === 'string' ? keeps.resumes : course ? TAKE_REPLAYS : TAKE_RESUMES
  if (!kept && !(course && !why)) return {resumes: `The Torus was not kept with this take, so it plays on the Torus as it now stands. ${resumes}`, ...played}
  const {refused} = kept ? await setTorusAgain(kept, commit) : {refused: [] as string[]}
  const told = (words: string) => refused.length ? `${words} The Torus did not take all of it again: ${refused.join('; ')}.` : words
  if (!course || why || !play) return {resumes: told(resumes), ...played}
  const restored = await play.stage({command: 'torus', action: 'restore', checkpoint: course.checkpoint})
    .catch((cause: unknown): StageResult => ({ok: false, error: said(cause)}))
  if (!restored.ok || !isStageSampleCursor(restored.landed_at_samples_elapsed)) {
    const words = restored.ok ? 'its owner named no sample it rings again from' : restored.error
    return {resumes: told(`The Torus did not ring again from the take's state: ${sentence(words)} ${TAKE_RESUMES_INSTEAD}`), ...played}
  }
  // The frame's own sound moves by beat; the Torus's moves are its course's acts.
  const frameMoves = moves.map(move => ({beat: move.beat, edits: move.edits.filter(edit => FRAME_SOUND_KINDS.has(edit.kind))})).filter(move => move.edits.length > 0)
  const numbers = new Map<string, number>()
  for (const note of Array.isArray(keeps.notes) ? keeps.notes : []) {
    if (plain(note) && Number.isSafeInteger(note.p) && plain(note.key)) numbers.set(`${note.key.row}/${note.key.column}`, note.p as number)
  }
  return {resumes: told(resumes), ...(frameMoves.length ? {moves: frameMoves} : {}),
    exact: {landed: restored.landed_at_samples_elapsed!, from: course.from_samples_elapsed, frames: course.frames, sample_rate: course.sample_rate, acts: course.acts,
      noteOf: key => numbers.get(keyOf(key)) ?? null}}
}

/** A take's moves as the clip player makes them again: at each move's beat, the edits that took the Torus there from where it stood. A
 * move whose Torus is no kept Torus is left out, and the next move's edits are from the last one kept. Pure. */
export function takeMoves(start: TorusKept | null, raw: unknown): ClipMove[] {
  const moves: ClipMove[] = []
  let previous = start
  for (const move of Array.isArray(raw) ? raw : []) {
    const torus = plain(move) && typeof move.beat === 'number' && Number.isFinite(move.beat) && move.beat >= 0 ? torusKeptOf(move.torus) : null
    if (!torus) continue
    const edits = torusMoveEdits(previous, torus)
    previous = torus
    if (edits.length) moves.push({beat: (move as Plain).beat as number, edits})
  }
  return moves
}

// ── Export Audio of a take ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The take's course rendered offline by its owner (the frame's `render-take`, QL-MEF torus-render: a second owner of the scene set to the
 * checkpoint, each act made at its sample; the live Torus neither moves nor sounds), in parts of at most `partFrames` (2^24, the most one
 * render makes), each part from the checkpoint the last one ended at. Its PCM whole at the owner's rate, or why not, in words. */
export async function renderTake(course: TakeCourse, stage: (command: StageCommand) => Promise<StageResult>, partFrames: number = STAGE_RENDER_FRAMES_MAX):
  Promise<{readonly pcm: Float32Array; readonly sample_rate: number} | {readonly refused: string}> {
  const pcm = new Float32Array(course.frames)
  const from = BigInt(course.from_samples_elapsed)
  let checkpoint = course.checkpoint, done = 0
  while (done < course.frames) {
    const frames = Math.min(partFrames, course.frames - done)
    const start = from + BigInt(done), end = start + BigInt(frames)
    if (BigInt(checkpoint.taken_at_samples) !== start)
      return {refused: `The Torus's render did not end where the next part begins: it ended at sample ${checkpoint.taken_at_samples}, and the next part begins at ${start}.`}
    const acts = course.acts.filter(act => { const at = BigInt(act.at_samples_elapsed); return at >= start && at < end })
    const answer = await stage({command: 'render-take', checkpoint, acts: [...acts], frames}).catch((cause: unknown): StageResult => ({ok: false, error: said(cause)}))
    if (!answer.ok) return {refused: `The Torus's owner did not render the take: ${sentence(answer.error)}`}
    const render = answer.render
    if (!render || render.from_samples_elapsed !== String(start) || render.frames !== frames || render.sample_rate !== course.sample_rate || render.pcm.length !== frames)
      return {refused: 'The Torus\'s owner rendered another stretch than the take asked of it.'}
    pcm.set(render.pcm, done)
    checkpoint = render.ended
    done += frames
  }
  if (BigInt(checkpoint.taken_at_samples) !== from + BigInt(course.frames))
    return {refused: `The Torus's render did not end where the take ends: it ended at sample ${checkpoint.taken_at_samples}.`}
  return {pcm, sample_rate: course.sample_rate}
}

/** The level the take played at, as gain steps over its PCM: the frame's presentation level as the take began, then each move of it at
 * its beat (the frame's own gain, frame/native-field controller.ts setLevel). Pure. */
export function takeLevels(keeps: Plain, course: TakeCourse): {readonly steps: readonly {readonly at: number; readonly gain: number}[]; readonly kept: boolean} {
  const kept = torusKeptOf(keeps.torus)
  const levelOf = (edits: readonly InstrumentEdit[]) => { const edit = edits.find(e => e.kind === 'level'); return edit && edit.kind === 'level' ? edit.value : undefined }
  const steps = [{at: 0, gain: kept ? levelOf(kept.edits) ?? 1 : 1}]
  const bpm = typeof keeps.bpm === 'number' && keeps.bpm > 0 ? keeps.bpm : null
  if (bpm !== null) for (const move of takeMoves(kept, keeps.moves)) {
    const gain = levelOf(move.edits)
    const at = Math.round(move.beat * (60 / bpm) * course.sample_rate)
    if (gain !== undefined && at < course.frames) steps.push({at, gain})
  }
  return {steps, kept: kept !== null}
}

/** Mono IEEE-754 32-bit float WAV (format tag 3) at `rate`, as live-engine writes it (wav.rs). Pure. */
export function takeWav(pcm: Float32Array, rate: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(44 + pcm.length * 4))
  const view = new DataView(bytes.buffer)
  const text = (at: number, word: string) => { for (let i = 0; i < word.length; i++) view.setUint8(at + i, word.charCodeAt(i)) }
  text(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 4, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 3, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 32, true)
  text(36, 'data'); view.setUint32(40, pcm.length * 4, true)
  for (let i = 0; i < pcm.length; i++) view.setFloat32(44 + i * 4, pcm[i]!, true)
  return bytes
}

/** What Export Audio reaches: the frame's stage channel, and where the file is saved (a download, which the native host lands in
 * Downloads and says where, studioExports.ts). */
export interface TakeExportOwners {
  readonly stage: (command: StageCommand) => Promise<StageResult>
  readonly save: (name: string, bytes: Uint8Array<ArrayBuffer>) => Promise<unknown>
}

/** Export Audio of a take's clip (manual §21.2, "What Export Audio renders is what you heard, sample for sample"): its course rendered by
 * the Torus's owner, at the level the take played at, written as WAV and saved; answered in words. A clip no take gave, or a take that
 * keeps no course, is refused in words. The frame's effects are its own sound after the Torus and are not in the render: said. */
export async function exportTake(clip: LiveClipReading, owners: TakeExportOwners): Promise<{readonly ok: true; readonly note: string} | {readonly ok: false; readonly error: string}> {
  const named = clip.name || 'This clip'
  if (!clip.take) return {ok: false, error: `${named} is not a take: Export Audio renders a take Record laid, as it was played.`}
  const keeps = clip.take.keeps
  if (!plain(keeps) || keeps.schema !== TAKE_SCHEMA) return {ok: false, error: noCourse(clip.take.keepsRefused ?? 'what it keeps beside its notes could not be read')}
  const course = takeCourseOf(keeps.course)
  if (!course) return {ok: false, error: noCourse(typeof keeps.course_refused === 'string' ? keeps.course_refused : 'it was laid before the Torus kept one')}
  const rendered = await renderTake(course, owners.stage)
  if ('refused' in rendered) return {ok: false, error: rendered.refused}
  const {steps, kept} = takeLevels(keeps, course)
  const pcm = rendered.pcm
  for (const [i, step] of steps.entries()) {
    const end = steps[i + 1]?.at ?? pcm.length
    for (let n = step.at; n < end; n++) pcm[n] = pcm[n]! * step.gain
  }
  const name = `${(clip.name || `Take ${clip.take.id}`).replace(/[\\/:*?"<>|]/g, '-')}.wav`
  try { await owners.save(name, takeWav(pcm, rendered.sample_rate)) } catch (cause) { return {ok: false, error: `${name} was not saved: ${sentence(said(cause))}`} }
  const chain = torusKeptOf(keeps.torus)?.edits.find(edit => edit.kind === 'effect-chain')
  const effects = chain && chain.kind === 'effect-chain' && chain.chain.length ? ` The frame's effects (${chain.chain.join(', ')}) are not in the file: they are its own sound, after the Torus.` : ''
  const level = kept ? '' : ' The Torus was not kept with this take, so the file is at the owner\'s own level.'
  return {ok: true, note: `Exported ${clip.name || `Take ${clip.take.id}`} as “${name}”: ${(pcm.length / rendered.sample_rate).toFixed(2)} s of the Torus at ${rendered.sample_rate} Hz, as the take played it.${effects}${level}`}
}

/** The candidate's Export Audio of the take at `at` on `track` of the set at `path`: the clip read whole from the set's owner (kernel
 * live_clip_read), rendered through the frame's stage channel, saved as a download. */
export async function exportLiveTake(address: {readonly path: string; readonly track: number; readonly at: LiveClipAt}): Promise<{readonly ok: true; readonly note: string} | {readonly ok: false; readonly error: string}> {
  const [{detectTransport, kernelOp}, torus] = await Promise.all([import('../../../../../desktop/cradle/src/kernel/bridge'), import('./torusInstrument')])
  const transport = detectTransport()
  if (transport.kind === 'unavailable') return {ok: false, error: transport.reason}
  const answer = await kernelOp(transport, {op: 'live_clip_read', path: address.path, track: address.track, clip: address.at})
  if (answer.error || answer.outcome?.result !== 'live_clip_reading') return {ok: false, error: answer.error ?? 'The set\'s owner did not answer the clip'}
  return exportTake(answer.outcome.reading.clip, {stage: torus.commitLiveStage, save: download})
}

/** A file saved as the page's download: the native host lands it in Downloads and says where (`oi:native-download`). */
async function download(name: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes], {type: 'audio/wav'}))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// ── Record, in Live's transport ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface RecordState {
  /** The take recording now; null while none does. */
  readonly recording: TakeContext | null
  /** The set is being read or written. */
  readonly busy: boolean
  /** What the last take came to, in words; null before any. */
  readonly said: string | null
}

/** The part THE selection chooses in the open set: its index, name and kind. */
export interface ChosenPart {readonly track: number; readonly name: string; readonly kind: string}

export interface RecordInput {
  readonly setPath: string | null
  /** The part chosen in the set; null when none is. */
  readonly part: ChosenPart | null
  readonly bpm: number | null
  readonly torus: LiveTorusState | null
  readonly state: RecordState
  /** What the set's Torus came to when the set opened, in words; null when it kept none. */
  readonly opened?: string | null
  readonly start: () => void
  readonly stop: () => void
}

/** Live's Record over the Torus: refused in words until a set, a MIDI part of it, a tempo and a following Torus stand; lit while a take
 * records; pressed again, the take is laid. Pure. */
export function recordBinding(input: RecordInput): SlotBinding {
  const {state} = input
  const words = [state.said, input.opened].filter((text): text is string => typeof text === 'string' && text.length > 0).join(' ')
  const tell = (text: string) => words ? `${text} ${words}` : text
  if (state.recording) return {press: input.stop, lit: true, title: tell(`Record — recording what you play on ${state.recording.part}; press again to lay the take.`)}
  if (state.busy) return {lit: false, refused: tell('The set is laying the take…')}
  const why = !input.setPath ? 'Open a set: Record records what you play on one of its parts.'
    : !input.part ? 'Select a MIDI part of the set: Record records what you play on it.'
      : input.part.kind !== 'midi' ? `${input.part.name} is not a MIDI part: Record records notes on a MIDI part.`
        : input.bpm === null || !(input.bpm > 0) ? 'The set discloses no tempo, so a take has no beats to lie on.'
          : input.torus === null ? 'The torus is not open, so there is nothing to record. Open it in Live.'
            : !input.torus.ok ? `The torus is refused: ${input.torus.fault}`
              : input.torus.value.standing !== 'following' ? `The torus is ${input.torus.value.standing}: resume it, then record.` : null
  if (why) return {lit: false, refused: tell(why)}
  return {press: input.start, lit: false, title: tell(`Record — records what you play on ${input.part!.name} into Arrangement view as a take.`)}
}

/** The part of a set's document at `track`, or null when there is none. Pure. */
export function chosenPartOf(document: unknown, track: number | null): ChosenPart | null {
  const tracks = plain(document) && Array.isArray(document.tracks) ? document.tracks : []
  const part = track === null ? undefined : tracks[track]
  if (!plain(part) || typeof part.kind !== 'string') return null
  return {track: track!, name: typeof part.name === 'string' && part.name ? part.name : `part ${track! + 1}`, kind: part.kind}
}

/** What Record reaches: the set's owner and the Torus's, the part keeping the Torus, and the page's clock. The candidate's are below;
 * tests hand in their own. */
export interface RecordOwners {
  readonly readSet: (path: string) => Promise<{readonly document: unknown}>
  readonly act: (path: string, act: LiveSetAct) => Promise<LiveSetActed>
  readonly torus: () => LiveTorusState | null
  readonly subscribeTorus: (listener: () => void) => () => void
  /** The part the take was laid on keeps the Torus as it then stands (createTorusKeeper keepOn); answers why not, or null. */
  readonly keepTorus: (path: string, track: number) => Promise<string | null>
  readonly now: () => number
  /** The frame's stage channel to the Torus's owner (torusInstrument.ts commitLiveStage): its checkpoint as a take begins, and at Stop its
   * cursor and journal, which make the take's course. Absent, a take keeps no course and says so. */
  readonly stage?: (command: StageCommand) => Promise<StageResult>
}

const said = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const sentence = (text: string) => /[.!?…]$/.test(text) ? text : `${text}.`

/** The Torus as it rings, kept by its owner as a take begins; or why it was not. */
type Begun = {readonly checkpoint: StageTorusCheckpoint} | {readonly refused: string}

/** The Torus's checkpoint through the stage channel, or why there is none, in the owner's words. */
async function checkpointOf(stage: (command: StageCommand) => Promise<StageResult>): Promise<Begun> {
  const answer = await stage({command: 'torus', action: 'checkpoint'}).catch((cause: unknown): StageResult => ({ok: false, error: said(cause)}))
  if (!answer.ok) return {refused: `the Torus's owner kept no state of it as the take began: ${answer.error}`}
  return answer.checkpoint ? {checkpoint: answer.checkpoint} : {refused: 'the Torus\'s owner answered without its checkpoint as the take began'}
}

/** At Stop, the take's course from the owner: its cursor (what it was sent before Stop is the take's), then its journal from the take's first
 * sample. The take lasts whole bars, or to the cursor when it rendered past them. */
async function landingOf(stage: (command: StageCommand) => Promise<StageResult>, begun: Begun, bpm: number, beats: number): Promise<TakeLanding> {
  if ('refused' in begun) return begun
  const {checkpoint} = begun
  const failed = (cause: unknown): StageResult => ({ok: false, error: said(cause)})
  const clock = await stage({command: 'audio-clock'}).catch(failed)
  if (!clock.ok || !clock.clock) return {refused: `the Torus's owner did not read its audio clock at Stop: ${clock.ok ? 'it answered without one' : clock.error}`}
  if (clock.clock.sample_rate !== checkpoint.sample_rate) return {refused: `the Torus's owner renders at ${clock.clock.sample_rate} Hz now, and the take began at ${checkpoint.sample_rate} Hz`}
  const from = BigInt(checkpoint.taken_at_samples), until = BigInt(clock.clock.samples_elapsed)
  if (until < from) return {refused: 'the Torus\'s owner began again during the take: its cursor stands before the take\'s first sample'}
  const journal = await stage({command: 'performance-journal', from_samples_elapsed: checkpoint.taken_at_samples}).catch(failed)
  if (!journal.ok || !journal.journal) return {refused: `the Torus's owner did not give its journal: ${journal.ok ? 'it answered without one' : journal.error}`}
  const frames = Math.max(Number(until - from), Math.round(beats * (60 / bpm) * checkpoint.sample_rate))
  return takeCourse(checkpoint, journal.journal, clock.clock.samples_elapsed, frames)
}

/** Record's store: one take at a time, on the recorder the playing path tells its notes to. */
export function createLiveRecord(recorder: TakeRecorder, owners: RecordOwners) {
  let state: RecordState = {recording: null, busy: false, said: null}
  const listeners = new Set<() => void>()
  let unwatch: (() => void) | null = null
  let begun: Begun | null = null
  let takes = 0
  const publish = (next: Partial<RecordState>) => { state = {...state, ...next}; for (const listener of [...listeners]) listener() }
  return {
    state: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    /** Begin a take on `track` of the set at `path`, at `bpm` in `mode`: from the first bar after what its main lane holds. */
    async start(path: string, track: number, bpm: number, mode: TakeContext['mode']): Promise<void> {
      if (state.recording || state.busy) return
      publish({busy: true})
      try {
        const {document} = await owners.readSet(path)
        const part = chosenPartOf(document, track)
        if (!part || part.kind !== 'midi') throw new Error('the part chosen is not a MIDI part of the set')
        const lane = (document as {tracks: Plain[]}).tracks[track]!.arrangement_clips
        const clips = Array.isArray(lane) ? lane.filter(plain).map(clip => ({end: Number(clip.end)})) : []
        const context: TakeContext = {path, track, part: part.name, bpm, start: takeStartOf(clips), torus: torusKept(owners.torus()), mode}
        // The Torus as it rings as the take begins, then the take: its first beat stands on the owner's sample.
        begun = owners.stage ? await checkpointOf(owners.stage) : null
        recorder.start(context, owners.now())
        unwatch = owners.subscribeTorus(() => recorder.moved(torusKept(owners.torus()), owners.now()))
        publish({recording: context, busy: false, said: null})
      } catch (cause) {
        publish({busy: false, said: `No take was begun: ${sentence(said(cause))}`})
      }
    },
    /** End the take and lay it in the set; the part keeps the Torus as it then stands. */
    async stop(): Promise<void> {
      const take = recorder.stop(owners.now())
      unwatch?.(); unwatch = null
      if (!take) return
      publish({recording: null, busy: true})
      const name = `Take ${++takes}`
      const nothing = takeRecordAct(take, name)
      if ('refused' in nothing) { publish({busy: false, said: nothing.refused}); return }
      const from = begun
      begun = null
      const landing = owners.stage && from ? await landingOf(owners.stage, from, take.context.bpm, takeLength(take)) : undefined
      const act = takeRecordAct(take, name, landing) as Extract<LiveSetAct, {kind: 'take_record'}>
      const exported = act.keeps?.course ? TAKE_EXPORTS : noCourse(String(act.keeps?.course_refused ?? NO_STAGE))
      try {
        const laid = await owners.act(take.context.path, act)
        const kept = await owners.keepTorus(take.context.path, take.context.track)
        publish({busy: false, said: [laid.done, laid.keepsRefused, kept, exported].filter(Boolean).map(text => sentence(text!)).join(' ')})
      } catch (cause) {
        publish({busy: false, said: `The take was not laid: ${sentence(said(cause))}`})
      }
    },
  }
}

export type LiveRecord = ReturnType<typeof createLiveRecord>

// ── the Torus kept with the set, and set again when it opens ──────────────────────────────────────────────────────────────────────

/** The part whose kept Torus a set opened again plays on: the part chosen, when it keeps one, else the first part that does. Pure. */
export function keptTorusOf(document: unknown, chosen: number | null): {readonly track: number; readonly part: string; readonly torus: TorusKept} | null {
  const tracks = plain(document) && Array.isArray(document.tracks) ? document.tracks : []
  const kept = (index: number) => {
    const track = tracks[index]
    const torus = plain(track) ? torusKeptOf(track.torus) : null
    return torus && plain(track) ? {track: index, part: typeof track.name === 'string' && track.name ? track.name : `part ${index + 1}`, torus} : null
  }
  if (chosen !== null && kept(chosen)) return kept(chosen)
  for (let index = 0; index < tracks.length; index += 1) { const found = kept(index); if (found) return found }
  return null
}

/** The MIDI part that keeps the Torus as it changes: the part that kept it when the set opened (or last laid a take), else the part
 * chosen, else the set's first MIDI part; null in a set with no MIDI part. Pure. */
export function torusHomeOf(document: unknown, home: number | null, chosen: number | null): number | null {
  const tracks = plain(document) && Array.isArray(document.tracks) ? document.tracks : []
  const midi = (index: number | null) => index !== null && plain(tracks[index]) && (tracks[index] as Plain).kind === 'midi'
  if (midi(home)) return home
  if (midi(chosen)) return chosen
  const first = tracks.findIndex(track => plain(track) && track.kind === 'midi')
  return first < 0 ? null : first
}

/** What keeps the Torus with the set: the set's owner and the Torus's, and the page's timers. */
export interface TorusKeeperOwners {
  readonly readSet: (path: string) => Promise<{readonly document: unknown}>
  readonly act: (path: string, act: LiveSetAct) => Promise<LiveSetActed>
  readonly torus: () => LiveTorusState | null
  readonly subscribeTorus: (listener: () => void) => () => void
  readonly commit: (edit: InstrumentEdit) => Promise<StageResult>
  readonly later: (run: () => void, ms: number) => unknown
  readonly cancel: (handle: unknown) => void
}

/** How long the Torus stands unchanged before the set keeps it: a turn of a knob is kept once, when it rests. */
export const TORUS_KEEP_REST_MS = 1500

const writable = (state: LiveTorusState | null) => state !== null && state.ok && (state.value.standing === 'following' || state.value.standing === 'held')

/** The Torus kept with the open set (manual §21.2, "A saved sound keeps every parameter … It opens with the same sound"). When a set
 * opens, the Torus is set again as its part keeps it, once the Torus can take edits; only then is it kept, so the sound a set opens
 * with is never overwritten by the one that stood before it. From then on each change to what sets the Torus is kept with the set's
 * MIDI part (torusHomeOf) once it rests. `tell` hears what was done, in words. */
export function createTorusKeeper(owners: TorusKeeperOwners, tell: (words: string | null) => void) {
  type Open = {path: string; chosen: number | null; home: number | null; last: TorusKept | null; keeping: boolean; unwatch: (() => void) | null; timer: unknown; closed: boolean}
  let open: Open | null = null

  const keepOn = async (here: Open, track: number | null): Promise<string | null> => {
    const kept = torusKept(owners.torus())
    if (!kept) return 'The Torus is not open, so the part keeps no Torus.'
    const {document} = await owners.readSet(here.path)
    const target = torusHomeOf(document, track ?? here.home, here.chosen)
    if (target === null) return 'The set has no MIDI part to keep the Torus with.'
    await owners.act(here.path, {kind: 'torus_keep', track: target, torus: {...kept}})
    here.home = target
    here.last = kept
    return null
  }
  const rest = (here: Open) => {
    if (here.closed || !here.keeping || !writable(owners.torus())) return
    if (here.timer !== null) owners.cancel(here.timer)
    here.timer = owners.later(() => {
      here.timer = null
      if (here.closed || sameTorusEdits(torusKept(owners.torus()), here.last)) return
      keepOn(here, null).then(refused => { if (refused && !here.closed) tell(refused) },
        cause => { if (!here.closed) tell(`The set did not keep the Torus: ${sentence(said(cause))}`) })
    }, TORUS_KEEP_REST_MS)
  }
  const keepFromNow = (here: Open) => {
    if (here.closed) return
    here.keeping = true
    here.last ??= torusKept(owners.torus())
    here.unwatch = owners.subscribeTorus(() => rest(here))
  }
  const close = () => {
    if (!open) return
    open.closed = true
    open.unwatch?.()
    if (open.timer !== null) owners.cancel(open.timer)
    open = null
  }

  return {
    /** The set at `path` is open with `chosen` its part chosen; a set already open only changes its part chosen. */
    open(path: string, chosen: number | null): void {
      if (open && open.path === path) { open.chosen = chosen; return }
      close()
      const here: Open = {path, chosen, home: null, last: null, keeping: false, unwatch: null, timer: null, closed: false}
      open = here
      tell(null)
      owners.readSet(path).then(({document}) => {
        if (here.closed) return
        const found = keptTorusOf(document, chosen)
        if (!found) { keepFromNow(here); return }
        here.home = found.track
        const apply = () => {
          if (here.closed || !writable(owners.torus())) return false
          here.unwatch?.(); here.unwatch = null
          void setTorusAgain(found.torus, owners.commit).then(({refused}) => {
            if (here.closed) return
            here.last = found.torus
            tell(refused.length ? `The Torus was set again as ${found.part} keeps it, except: ${refused.join('; ')}.` : `The Torus was set again as ${found.part} keeps it.`)
            keepFromNow(here)
          })
          return true
        }
        if (!apply()) here.unwatch = owners.subscribeTorus(() => { apply() })
      }, cause => { if (!here.closed) tell(`The set's Torus was not read: ${sentence(said(cause))}`) })
    },
    /** The part `track` keeps the Torus as it stands now (a take was laid on it); answers why not, in words, or null. */
    async keepOn(path: string, track: number): Promise<string | null> {
      if (!open || open.path !== path) return 'The set is not open, so the part keeps no Torus.'
      try { return await keepOn(open, track) } catch (cause) { return `The part did not keep the Torus: ${sentence(said(cause))}` }
    },
    /** The set closed: nothing more is kept, and a Torus not yet set again is not. */
    close,
  }
}

export type TorusKeeper = ReturnType<typeof createTorusKeeper>

// ── the candidate's ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The recorder the part's one playing path tells its notes to (live/keyboardLayout.ts livePlayingPath). */
export const liveTakeRecorder: TakeRecorder = createTakeRecorder()

let opened: string | null = null
const openedListeners = new Set<() => void>()
const hearOpened = (words: string | null) => { if (words === opened) return; opened = words; for (const listener of [...openedListeners]) listener() }

let candidate: {record: LiveRecord; keeper: TorusKeeper} | null = null
/** Record's store and the Torus's keeper in the candidate, made at first use (their owners are loaded then: the set's and the Torus's). */
export async function liveRecord(): Promise<{readonly record: LiveRecord; readonly keeper: TorusKeeper}> {
  if (candidate) return candidate
  const [{readSet}, {writeLiveSetAct}, torus] = await Promise.all([import('../native/application'), import('./liveWrites'), import('./torusInstrument')])
  if (candidate) return candidate
  const keeper = createTorusKeeper({
    readSet: path => readSet(path),
    act: (path, act) => writeLiveSetAct(path, act),
    torus: torus.liveTorusState,
    subscribeTorus: torus.subscribeLiveTorus,
    commit: torus.commitLiveInstrumentEdit,
    later: (run, ms) => setTimeout(run, ms),
    cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  }, hearOpened)
  const record = createLiveRecord(liveTakeRecorder, {
    readSet: path => readSet(path),
    act: (path, act) => writeLiveSetAct(path, act),
    torus: torus.liveTorusState,
    subscribeTorus: torus.subscribeLiveTorus,
    keepTorus: (path, track) => keeper.keepOn(path, track),
    now: () => performance.now(),
    stage: torus.commitLiveStage,
  })
  candidate = {record, keeper}
  return candidate
}

const NO_RECORD: RecordState = {recording: null, busy: false, said: null}
let shown: RecordState = NO_RECORD
const shownListeners = new Set<() => void>()
let attached = false
const attach = () => {
  if (attached) return
  attached = true
  void liveRecord().then(({record}) => {
    const follow = () => { shown = record.state(); for (const listener of [...shownListeners]) listener() }
    record.subscribe(follow)
    follow()
  })
}
const subscribeShown = (listener: () => void) => { attach(); shownListeners.add(listener); openedListeners.add(listener); return () => { shownListeners.delete(listener); openedListeners.delete(listener) } }

/** Live's Record for the transport, on the part `track` of the open set (THE selection's), and the Torus kept with that set. Leaving
 * Live's transport ends a take recording; the set stays open while Live's transport is away. */
export function useLiveRecord(input: {readonly setPath: string | null; readonly track: number | null; readonly bpm: number | null; readonly torus: LiveTorusState | null;
  readonly mode: TakeContext['mode']}): SlotBinding {
  const state = useSyncExternalStore(subscribeShown, () => shown, () => NO_RECORD)
  const words = useSyncExternalStore(subscribeShown, () => opened, () => null)
  const {setPath, track, bpm, torus, mode} = input
  const [part, setPart] = useState<ChosenPart | null>(null)
  useEffect(() => {
    if (!setPath) { setPart(null); void liveRecord().then(({keeper}) => keeper.close()); return }
    let live = true
    void liveRecord().then(({keeper}) => { if (live) keeper.open(setPath, track) })
    const read = () => { void import('../native/application').then(({readSet}) => readSet(setPath)).then(({document}) => { if (live) setPart(chosenPartOf(document, track)) }, () => { if (live) setPart(null) }) }
    read()
    let unsubscribe: (() => void) | null = null
    void import('../native/application').then(({subscribeSet}) => { if (live) unsubscribe = subscribeSet(setPath, read) })
    return () => { live = false; unsubscribe?.() }
  }, [setPath, track])
  useEffect(() => () => { void liveRecord().then(({record}) => { if (record.state().recording) void record.stop() }) }, [])
  return recordBinding({setPath, part, bpm, torus, state, opened: words,
    start: () => { if (setPath && part && bpm) void liveRecord().then(({record}) => record.start(setPath, part.track, bpm, mode)) },
    stop: () => { void liveRecord().then(({record}) => record.stop()) }})
}
