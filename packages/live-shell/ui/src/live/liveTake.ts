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
// What is not kept yet, because its owner keeps no record of it: the course of the body, the form and the forces, the seeds, and the sample
// each note and move landed at. The take says so, and that it resumes from the body as it then rings (TAKE_RESUMES). Export
// Audio renders what live-engine played, and the Torus does not sound there yet, so a take is not in its file (TAKE_NOT_EXPORTED).
import {useEffect, useState, useSyncExternalStore} from 'react'
import {readInstrumentEdit, type InstrumentEdit, type StageResult} from '@epilogos/expressions-boundary'
import type {LiveClipReading, LiveNote, LiveSetAct, LiveSetActed} from '../../../../../desktop/cradle/src/kernel/types'
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

/** A bar of 4/4: a take lies from a bar's start and lasts whole bars, as a new clip does. */
export const TAKE_BAR_BEATS = 4
/** Said when Record is stopped with nothing played. */
export const NOTHING_PLAYED = 'Nothing was played on the part, so no take was laid.'

const beatsOf = (ms: number, bpm: number) => (ms / 1000) * (bpm / 60)
const round = (value: number) => Math.round(value * 1e6) / 1e6

/** The set's act that lays the take (packages/live-set acts.rs take_record): its notes in beats of the take's own time, velocity from each
 * strength, its length the whole bars it spans, and what it keeps beyond its notes; or why there is nothing to lay. Pure. */
export function takeRecordAct(take: RecordedTake, name: string): Extract<LiveSetAct, {kind: 'take_record'}> | {readonly refused: string} {
  const {context, startedAt, stoppedAt} = take
  const span = beatsOf(stoppedAt - startedAt, context.bpm)
  const length = Math.max(TAKE_BAR_BEATS, Math.ceil(round(span) / TAKE_BAR_BEATS) * TAKE_BAR_BEATS)
  // A note struck as the take ends has no time in it to sound.
  const played = take.notes.filter(note => round(beatsOf(note.on - startedAt, context.bpm)) < length)
  if (played.length === 0) return {refused: NOTHING_PLAYED}
  const notes: LiveNote[] = played.map(note => {
    const at = round(beatsOf(note.on - startedAt, context.bpm))
    const len = round(Math.max(0, Math.min(length - at, beatsOf((note.off ?? stoppedAt) - note.on, context.bpm))))
    return {p: note.note, at, len, vel: Math.max(1, Math.min(127, Math.round(note.amplitude * 127)))}
  })
  const keeps = {
    schema: TAKE_SCHEMA,
    // How each note was played, by its number and beat: the key and touch-point it struck, its exact strength and its source.
    notes: played.map((note, i) => ({p: note.note, at: notes[i]!.at, key: note.key, touch: note.touch, strength: note.amplitude, source: note.source})),
    torus: context.torus,
    moves: take.moves.map(move => ({beat: round(beatsOf(move.at - startedAt, context.bpm)), torus: move.torus})),
    mode: context.mode,
    bpm: context.bpm,
    resumes: TAKE_RESUMES,
    not_kept: [...TAKE_NOT_KEPT],
  }
  return {kind: 'take_record', track: context.track, start: context.start, length, name, notes, keeps}
}

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

/** Before a take's clip plays (live/clipPlayer.ts `prepare`): the Torus is set again as it stood when the take began, each note is voiced as
 * it was played, and the take says where it resumes. A clip no take gave answers null; a take whose Torus was not kept says it plays on the
 * Torus as it now stands. */
export async function prepareTake(clip: LiveClipReading, commit: (edit: InstrumentEdit) => Promise<StageResult>): Promise<ClipPrepared | null> {
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
  const resumes = typeof keeps.resumes === 'string' ? keeps.resumes : TAKE_RESUMES
  if (!kept) return {resumes: `The Torus was not kept with this take, so it plays on the Torus as it now stands. ${resumes}`, ...played}
  const {refused} = await setTorusAgain(kept, commit)
  return {resumes: refused.length ? `${resumes} The Torus did not take all of it again: ${refused.join('; ')}.` : resumes, ...played}
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
}

const said = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const sentence = (text: string) => /[.!?…]$/.test(text) ? text : `${text}.`

/** What Export Audio does with a take, until the Torus sounds in its render: said with every take laid. */
export const TAKE_NOT_EXPORTED = 'Export Audio renders what the engine played, and the Torus does not sound in it yet, so this take is not in the file.'

/** Record's store: one take at a time, on the recorder the playing path tells its notes to. */
export function createLiveRecord(recorder: TakeRecorder, owners: RecordOwners) {
  let state: RecordState = {recording: null, busy: false, said: null}
  const listeners = new Set<() => void>()
  let unwatch: (() => void) | null = null
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
      const act = takeRecordAct(take, `Take ${++takes}`)
      if ('refused' in act) { publish({busy: false, said: act.refused}); return }
      try {
        const laid = await owners.act(take.context.path, act)
        const kept = await owners.keepTorus(take.context.path, take.context.track)
        publish({busy: false, said: [laid.done, laid.keepsRefused, kept, TAKE_NOT_EXPORTED].filter(Boolean).map(text => sentence(text!)).join(' ')})
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
