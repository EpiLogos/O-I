// Live plays a clip (O-I #790). DLW §21.2 Views: "In Clip view, the Torus plays the notes of the clip that you select"; §21.2 Transport:
// "Play | Plays the clips of the part on the torus"; "What strikes the Torus": "A note in a clip | Its key's point, as the clip plays".
//
//   the notes   the clip THE selection names, read whole from the set's owner (kernel live_clip_read, packages/live-set/src/edit.rs
//               clip_reading; the read is live/liveWrites.ts useLiveClipWhole's, made once per press): its notes {p, at, len, vel, chance,
//               on} in the clip's own beats, and its markers as edit.rs `markers` gives them. Nothing is played that the owner did not read.
//   the order   Live's: loop off, the clip plays from its start marker to its end, once; loop on, from its start marker to the loop's end,
//               then the loop (position to position + length) again and again. A switched-off note never sounds; a note's chance is
//               drawn each time it comes round, as Live draws it. An edit to the clip (a write, Live saving it) plays from the next pass.
//   the strike  MT1 is ruled (owner, 1 Nov: a key's point is dynamic; O-I #790): each note-on strikes its key on the Torus's M1′ session
//               through the part's one playing path (keyboardLayout.ts livePlayingPath, live/janko/jankoInput.ts clipStrike): the key a
//               MIDI note of its number strikes, so the clip, the keys and MIDI agree on a note's key, struck as `janko` strike (QL-MEF
//               torus-play, which strikes the key's moving point, the second helix included) at velocity over 127. Notes struck together
//               at one velocity are one act, as a chord is. The path counts the clip's notes with the keys' and MIDI's: past Polyphony
//               the oldest make way, and a note that made way is owed no release. Nothing here synthesises a sound: a refusal is the
//               owner's, named.
//   the end     each note is held for its own length, cut at its pass's end as Live cuts a note at its loop end or the clip's end, and
//               let go then (`janko` release, QL-MEF torus-release). The owner's release takes no sample (it moves no native state: the
//               body rings on), so each is sent in its sample's turn, one owner lookahead ahead as a note-on is, and the owner takes the
//               clip's acts in the order their samples come; an end and a note-on at one moment go end first.
//   the time    the owner's audio clock (O-I #809; the musical law: schedule ahead on the audio clock). At the press the player reads it
//               (the `audio-clock` stage command: the sample its rendered sound stands at, its rate, its lookahead and its block) and
//               anchors the clip's start one owner lookahead past that sound. Each note-on's sample is the anchor plus its time from the
//               start at the set's tempo, and it strikes with that sample (`at_samples_elapsed`): the owner lands it in its render at
//               exactly that sample (QL-MEF instrument session and native render), never on its block and never "now". The player sends
//               each note-on as its sample comes within one owner lookahead of the owner's render, waking on the page's monotonic clock;
//               the wake only carries the note there, so a late wake never moves it. A wake later than the owner's slack (its lookahead
//               less the block it may render meanwhile) would land behind the owner's cursor: that note-on is let go and counted, never
//               struck late in a burst (the owner's own pump law: "never a catch-up burst", instrument-session.mjs pump); a note never
//               struck is never let go. The path that strikes allocates no plan and does no UI work: the passes are planned when the
//               clip is read, and the state the transport draws changes only on play, stop, a new refusal or a missed note.
//   Stop        nothing more is struck, and every note the clip holds is let go at once, as Panic lets the keys' go; a note-on already
//               sent lands at its sample, within one owner lookahead, and what was struck rings out on the torus.
//   a take      a clip Record laid (O-I #855: its TakeId, and what it keeps beside the set) sets the Torus again as it stood when the
//               take began before the owner's clock is read (live/liveTake.ts prepareTake), each of its notes strikes the touch-point it
//               was played at, at its own strength (a note written since plays as any clip's), and each move of the Torus made during
//               the take is made again at its beat: an instrument edit takes no sample, so it is sent as its beat's sound is rendered,
//               one owner lookahead after the note-ons of that beat are sent, and lands within a block of it (a move in the pass's last
//               lookahead is made at the pass's end). Play says from which state the take resumes.
//   its lanes   what a take's moves and lanes write stands Automated while the take plays (O-I #853; Live: a parameter its lane
//               plays is automated). A hand move of one of them (an instrument edit sent BY_HAND, torusInstrument.ts) overrides its lane:
//               the take writes it no more, as Live leaves an overridden parameter where the hand put it, and it stays Overridden, across
//               a Stop and the next play, until Re-enable gives it back; Re-enable while the take plays writes the value its lane last
//               reached (sent by no hand), else it plays its lane from the take's next point. A session-held value (the Scale tie) is
//               no instrument edit, so its hand moves are not heard here.
//   its course  a take with its course (O-I #855 round 6d), its clip as it was laid, plays as it was played: the Torus rings again from the
//               state it rang in as the take began (prepareTake restores the owner's checkpoint, which lands at the owner's sample R),
//               and each act of the course lands at R + (its sample − the take's first sample): the keys it struck, at its strength (the
//               path's clipStrike with the very keys), each touch of the surface and each singlet at its strength (the frame's own
//               `strike-at` and `singlet` commands with `at_samples_elapsed`), each release in its sample's turn, each setting of the
//               Torus at its sample (the instrument command with `at_samples_elapsed`). Each is sent as its sample comes within one owner lookahead of the render;
//               one behind the render when it comes is missed and counted, a setting made at the owner's cursor and said. The level and
//               effects move at their beats, as any take's. The take ends where its course ends, and lets go what it holds; Stop too.
//
// Ported from: the store with its owners handed in (inhabitants/ql/devices/qlSitting.ts: now, later, cancel, its bell rung through
// commitLiveStage); the chord as one act (live/janko/jankoInput.ts flush); the clip's markers (packages/live-set/src/edit.rs markers).
// MIDI out: a clip's notes do not leave as MIDI yet (jankoInput.ts: they are sent one owner lookahead before they sound).
import {useEffect, useSyncExternalStore} from 'react'
import type {InstrumentEdit, StageAudioClock, StageCommand, StageKey, StageResult, StageTakeAct} from '@epilogos/expressions-boundary'
import {detectTransport, kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {LiveClipAt, LiveClipReading} from '../../../../../desktop/cradle/src/kernel/types'
import type {WorldSelection} from '../../../../../desktop/cradle/src/workspace/store'
import type {SlotBinding, TransportBindings} from '../frame/transport/slots'
import {subscribeSet} from '../native/application'
import {setSelectionOf} from '../shell/liveSelection'
import type {ClipHold} from './janko/jankoInput'
import {livePlayingPath} from './keyboardLayout'
import {clipAtOf} from './liveWrites'
import {prepareTake} from './liveTake'
import {commitLiveInstrumentEdit, commitLiveStage, liveTorusState, subscribeAcceptedLiveWrites, useLiveTorusReading, type LiveTorusState} from './torusInstrument'
import type {MapValue} from './midiMap/midiMapModel'
import {mapTargetIdsOfEdit, writeMapTarget} from './midiMap/midiMapTargets'

/** A timer may wake a hair before its moment; a strike due within this many seconds is sent at that wake. */
const DUE_EARLY_SECONDS = 0.002

/** One note of an act: its number as MIDI numbers notes, its chance (Live's Probability, 1 when it always sounds), and the beat its
 * length ends at, in the clip's own beats: cut at its pass's end, as Live cuts a note at its loop end or the clip's end. */
export interface ClipNote {readonly note: number; readonly chance: number; readonly end: number}

/** One act of the clip: where it stands in the clip's own beats, its notes in ascending order, and their strength (velocity over 127). */
export interface ClipStrike {
  readonly beat: number
  readonly notes: readonly ClipNote[]
  readonly amplitude: number
}

/** One pass of the clip: its window in the clip's own beats, and its acts in time order. */
export interface ClipPass {readonly from: number; readonly to: number; readonly strikes: readonly ClipStrike[]}

/** The clip as Live plays it: its first pass, and the loop it repeats (null when its loop is off); or why it cannot play. */
export type ClipPlan =
  | {readonly ok: true; readonly name: string; readonly first: ClipPass; readonly again: ClipPass | null}
  | {readonly ok: false; readonly reason: string}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const refuse = (reason: string): ClipPlan => ({ok: false, reason})

/** The acts between `from` and `to`: each switched-on note with a velocity, grouped by its moment and its velocity, each held to its own
 * end or the pass's. A note written twice at one moment and velocity is struck once, at its greater chance and for its longer length. */
function clipPass(notes: NonNullable<LiveClipReading['notes']>, from: number, to: number): ClipPass {
  const sounding = notes.filter(note => note.on !== false && finite(note.vel) && note.vel > 0 && Number.isInteger(note.p) && note.p >= 0 && note.p <= 127
    && finite(note.at) && note.at >= from && note.at < to)
  const acts = new Map<string, {beat: number; vel: number; notes: Map<number, {chance: number; end: number}>}>()
  for (const note of sounding) {
    const key = `${note.at}|${note.vel}`
    const act = acts.get(key) ?? {beat: note.at, vel: note.vel, notes: new Map<number, {chance: number; end: number}>()}
    acts.set(key, act)
    const chance = finite(note.chance) ? Math.max(0, Math.min(1, note.chance)) : 1
    const end = Math.min(to, note.at + (finite(note.len) && note.len > 0 ? note.len : 0))
    const was = act.notes.get(note.p)
    act.notes.set(note.p, {chance: Math.max(was?.chance ?? 0, chance), end: Math.max(was?.end ?? note.at, end)})
  }
  const strikes = [...acts.values()].sort((a, b) => a.beat - b.beat || a.vel - b.vel).map(act => ({beat: act.beat,
    notes: [...act.notes.entries()].sort(([a], [b]) => a - b).map(([note, {chance, end}]) => ({note, chance, end})),
    amplitude: Math.min(1, act.vel / 127)}))
  return {from, to, strikes}
}

/** The clip's plan, from its owner's reading: its passes and their acts, or why it has nothing to play. Pure. */
export function clipPlan(clip: LiveClipReading): ClipPlan {
  if (clip.kind !== 'midi') return refuse('An audio clip has no notes to play on the torus: the torus plays a MIDI clip\'s notes.')
  const notes = clip.notes ?? []
  if (notes.length === 0) return refuse('The clip holds no notes, so Play has nothing to strike.')
  const {start, end, position, length} = clip
  if (!finite(start) || !finite(end) || (clip.loop && (!finite(position) || !finite(length))))
    return refuse('The set\'s owner reports no markers for this clip, so it has no time to play in.')
  let first: ClipPass, again: ClipPass | null = null
  if (clip.loop) {
    if (!(length! > 0)) return refuse('The clip\'s loop has no length, so it has no time to play in.')
    const loopEnd = position! + length!
    again = clipPass(notes, position!, loopEnd)
    first = clipPass(notes, start < loopEnd ? start : position!, loopEnd)
  } else {
    if (!(end > start)) return refuse('The clip ends where it starts, so it has no time to play in.')
    first = clipPass(notes, start, end)
  }
  if (first.strikes.length === 0 && !again?.strikes.length) return refuse('No note of the clip stands between its start and end markers, so Play would strike nothing.')
  return {ok: true, name: clip.name, first, again}
}

// ── the player ──────────────────────────────────────────────────────────────

/** Where the clip stands: the set's file, the track, and its arrangement index or session slot. */
export interface ClipAddress {readonly path: string; readonly track: number; readonly at: LiveClipAt}

/** What the player reaches: the set's owner, the torus's owner and its audio clock, and the page's clock. Tests hand in their own. */
export interface ClipPlayerOwners {
  /** The clip whole, from the set's owner; a refusal throws in the owner's words. */
  readonly read: (address: ClipAddress) => Promise<LiveClipReading>
  /** Before a clip a take gave plays: the Torus set again as it stood when the take began (live/liveTake.ts prepareTake, O-I #855),
   * answering where the take resumes from and how each of its notes was played; null for a clip no take gave. Absent, nothing is
   * prepared. */
  readonly prepare?: (clip: LiveClipReading, bpm: number) => Promise<ClipPrepared | null>
  /** The torus owner's audio clock, read once per press (readAudioClock); a refusal throws in the owner's words. */
  readonly clock: () => Promise<StageAudioClock>
  /** One instrument edit of a take's move, at the owner's sample `at` where a take's course names one (the `instrument` stage command),
   * settling with the owner's answer. Absent, no move is made. */
  readonly edit?: (edit: InstrumentEdit, at?: string) => Promise<StageResult>
  /** One point of a take's automation lane, through its parameter's own write (midiMap/midiMapTargets.ts writeMapTarget, O-I 853),
   * settling with its owner's answer. Absent, no lane is written. */
  readonly set?: (parameter: string, value: MapValue) => Promise<StageResult>
  /** One act of the clip on the part's one playing path (keyboardLayout.ts livePlayingPath, jankoInput.ts clipStrike): its notes' keys
   * struck at the owner's sample `at`, each held until its hold is let go; settling with the owner's answer. */
  readonly strike: (notes: readonly ClipHold[], amplitude: number, at: string) => Promise<StageResult>
  /** A touch of a take's course: its points of the surface struck at one strength at the owner's sample `at` (the frame's `strike-at`
   * stage command, as controller.ts playAt strikes a touch); settling with the owner's answer. */
  readonly touch: (points: readonly {theta: number; phi: number}[], amplitude: number, at: string) => Promise<StageResult>
  /** A singlet of a take's course: its codon struck at its strength at the owner's sample `at` (the frame's `singlet` stage command,
   * O-I #771); settling with the owner's answer. */
  readonly singlet: (codon: number, amplitude: number, at: string) => Promise<StageResult>
  /** The clip lets these notes go: the end of each note's length, or Stop. */
  readonly release: (holds: readonly string[]) => void
  /** Tell `changed` when the set the clip stands in is read again (a write, Live saving it). Returns the unsubscribe. */
  readonly watch: (address: ClipAddress, changed: () => void) => () => void
  /** The page's clock, in seconds: monotonic. It only paces when a note-on is sent; the note's time is its sample. */
  readonly now: () => number
  readonly later: (run: () => void, ms: number) => unknown
  readonly cancel: (handle: unknown) => void
  /** A draw in [0, 1), for a note's chance. */
  readonly random: () => number
  /** Tell `moved` the map parameters each hand move writes (an instrument edit the owner took, sent BY_HAND). Returns the unsubscribe.
   * Absent, no lane is overridden. */
  readonly hand?: (moved: (parameters: readonly string[]) => void) => () => void
}

/** A take prepared to play again: where it resumes from, in words; how a note of it was played (the touch-point it struck and its exact
 * strength), by its number and its beat in the clip, null for a note the take did not play (one written since); and the moves of the
 * Torus made during it, each the instrument edits it made, at its beat in the clip, in time order. */
export interface ClipPrepared {
  readonly resumes: string
  readonly voice?: (note: number, beat: number) => {readonly touch: number; readonly strength: number} | null
  readonly moves?: readonly ClipMove[]
  /** A take that plays as it was played: its course, from the sample the Torus rang again from (`landed`). */
  readonly exact?: TakeExact
}
/** A take's course to play at its samples (live/liveTake.ts TakeCourse): the owner's sample the Torus rang again from its checkpoint, the
 * take's first sample, its length and rate, its acts at their samples in order, and the note a key of it was played as. */
export interface TakeExact {
  readonly landed: string
  readonly from: string
  readonly frames: number
  readonly sample_rate: number
  readonly acts: readonly StageTakeAct[]
  readonly noteOf?: (key: StageKey) => number | null
}
/** A take's move at its beat: the instrument edits that took the Torus there, and the points of its lanes written there (`sets`). */
export interface ClipMove {readonly beat: number; readonly edits: readonly InstrumentEdit[]; readonly sets?: readonly {readonly parameter: string; readonly value: MapValue}[]}
/** A move that moves something. */
const moving = (move: ClipMove) => finite(move.beat) && (move.edits.length > 0 || (move.sets?.length ?? 0) > 0)

export interface ClipPlayState {
  /** The clip that plays: where it stands, its name and the tempo it plays at; null while none plays. */
  readonly playing: {readonly address: ClipAddress; readonly name: string; readonly bpm: number} | null
  /** A press whose clip is still being read from the set's owner. */
  readonly starting: boolean
  /** The torus's last refusal of a note, in its words. */
  readonly refused: string | null
  /** Note-ons let go because they came too late to strike. */
  readonly missed: number
  /** Why the clip did not play, or stopped. */
  readonly fault: string | null
  /** A take's words on the state it resumes from, as it was prepared to play; null for a clip no take gave. */
  readonly resumes: string | null
  /** The standing of the take's lanes (O-I #853): what its moves and lanes write while it plays, and what the hand overrode. */
  readonly lanes: ClipLaneStanding
}

/** The parameters a take's moves and lanes write while it plays (Automated), and those a hand move took off them (Overridden), by map
 * parameter id (midiMap/midiMapTargets.ts). Overridden stands until Re-enable, across a Stop. */
export interface ClipLaneStanding {readonly automated: readonly string[]; readonly overridden: readonly string[]}
const NO_LANES: ClipLaneStanding = Object.freeze({automated: Object.freeze([]), overridden: Object.freeze([])}) as ClipLaneStanding
/** The map parameters a move writes. Pure. */
export const moveParameters = (move: ClipMove): string[] => [...move.edits.flatMap(edit => mapTargetIdsOfEdit(edit)), ...(move.sets ?? []).map(set => set.parameter)]
/** An edit as the take still writes it, with what the hand overrode taken out: a Torus session edit loses its overridden macros, any
 * other edit stands or falls whole; null when nothing of it is the take's to write. Pure. */
export function unheldEdit(edit: InstrumentEdit, overridden: ReadonlySet<string>): InstrumentEdit | null {
  const ids = mapTargetIdsOfEdit(edit)
  if (!ids.some(id => overridden.has(id))) return edit
  if (edit.kind !== 'torus') return null
  const kept = Object.fromEntries(Object.entries(edit.edit).filter(([key]) => !overridden.has(key)))
  return Object.keys(kept).length ? {kind: 'torus', edit: kept as typeof edit.edit} : null
}

export interface ClipPlayer {
  state(): ClipPlayState
  subscribe(listener: () => void): () => void
  /** Play the clip at `address` from its start marker at `bpm`; a clip already playing starts again. */
  play(address: ClipAddress, bpm: number): void
  /** Stop: nothing more strikes, and every note the clip holds is let go at once; what was struck rings out on the torus. */
  stop(): void
  /** Re-enable (O-I #853): give `parameter`, or every overridden one, back to the take's lanes. */
  reenable(parameter?: string): Promise<ClipActAnswer>
}

const IDLE: ClipPlayState = {playing: null, starting: false, refused: null, missed: 0, fault: null, resumes: null, lanes: NO_LANES}
const said = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

/** Where a press stands on the owner's audio clock: the sample the clip's start lands at (one owner lookahead past the sound it has
 * rendered), the owner's rate, and how late a wake may be and still land a note-on (the lookahead less the block the owner may render
 * meanwhile); or why the clock leaves no time to strike ahead. Pure. */
export type ClipTiming = {readonly anchor: bigint; readonly rate: number; readonly slack: number} | {readonly refused: string}

export function clipTiming(clock: StageAudioClock): ClipTiming {
  const slack = clock.lookahead_seconds - clock.block_frames / clock.sample_rate
  if (!(slack > 0)) return {refused: 'The torus renders its whole lookahead in one block, so it leaves no time to strike ahead of it.'}
  return {anchor: BigInt(clock.samples_elapsed) + BigInt(Math.round(clock.lookahead_seconds * clock.sample_rate)), rate: clock.sample_rate, slack}
}

/** The owner's audio clock through a stage channel (the `audio-clock` stage command, which the frame answers from its native field's
 * controller): the clock its answer carries, or its refusal thrown in its words. */
export async function readAudioClock(commit: (command: StageCommand) => Promise<StageResult>): Promise<StageAudioClock> {
  const answer = await commit({command: 'audio-clock'})
  if (!answer.ok) throw new Error(answer.error)
  if (!answer.clock) throw new Error('The torus answered without its audio clock')
  return answer.clock
}

interface Run {
  readonly address: ClipAddress
  /** Seconds per beat at the tempo the clip plays at. */
  readonly spb: number
  /** The page clock's reading when the owner's clock was read: a note-on is sent at origin + its time from the clip's start. */
  readonly origin: number
  /** Where the clip stands on the owner's audio clock. */
  readonly timing: Extract<ClipTiming, {anchor: bigint}>
  /** How a take's notes were played, as it was prepared; null for a clip no take gave. */
  readonly voice: ClipPrepared['voice'] | null
  /** A take's moves, in time order, the next of them, and the owner's lookahead (seconds): a move is sent as its beat is rendered. */
  readonly moves: readonly ClipMove[]
  move: number
  readonly lead: number
  plan: Extract<ClipPlan, {ok: true}>
  pass: ClipPass
  /** Seconds from the clip's start to the pass's first beat. */
  passStart: number
  /** The next act of the pass. */
  index: number
  /** The notes the clip holds, each let go at its time (seconds from the clip's start), in time order. */
  readonly ends: {readonly at: number; readonly holds: string[]}[]
  timer: unknown
  unwatch: () => void
  readonly fire: () => void
  readonly turn: () => void
}

/** A take's course playing: its acts with the time each is due (seconds from the clip's anchor) and the sample it lands at, the frame's
 * own moves by beat, where the course begins and ends (seconds from the anchor), and the keys it holds. */
interface Course {
  readonly address: ClipAddress
  readonly origin: number
  readonly timing: Extract<ClipTiming, {anchor: bigint}>
  readonly spb: number
  readonly lead: number
  readonly acts: readonly {readonly seconds: number; readonly at: string; readonly act: StageTakeAct}[]
  index: number
  readonly moves: readonly ClipMove[]
  move: number
  readonly start: number
  readonly end: number
  readonly holds: Map<string, string[]>
  readonly noteOf: TakeExact['noteOf']
  timer: unknown
  readonly fire: () => void
}

/** A clip player over its owners. */
export function createClipPlayer(owners: ClipPlayerOwners): ClipPlayer {
  let state: ClipPlayState = IDLE
  let run: Run | null = null
  let course: Course | null = null
  /** The press in progress: a Stop or a later press makes an earlier read stale. */
  let press = 0
  /** Every note the player strikes is its own hold on the path. */
  let held = 0
  const listeners = new Set<() => void>()
  const publish = (next: Partial<ClipPlayState>) => { state = {...state, ...next}; for (const listener of [...listeners]) listener() }

  /** The take's lanes (O-I #853): what the hand overrode, which the take no longer writes; the last value each lane reached, for Re-enable;
   * and the hand's watch while a take plays. */
  const overridden = new Set<string>()
  const reached = new Map<string, {readonly edit?: InstrumentEdit; readonly value?: MapValue}>()
  let unhand: (() => void) | null = null
  const standing = (automated: readonly string[]) => publish({lanes: {automated: Object.freeze([...automated]), overridden: Object.freeze([...overridden])}})
  /** A take begins: what its moves and lanes write stands Automated, and a hand move of one of those overrides it. */
  const automate = (moves: readonly ClipMove[], settings: readonly InstrumentEdit[]) => {
    unhand?.()
    reached.clear()
    const automated = [...new Set([...moves.flatMap(moveParameters), ...settings.flatMap(edit => mapTargetIdsOfEdit(edit))])]
    standing(automated)
    if (!automated.length) { unhand = null; return }
    unhand = owners.hand?.(moved => {
      const taken = moved.filter(id => automated.includes(id) && !overridden.has(id))
      if (!taken.length) return
      for (const id of taken) overridden.add(id)
      standing(state.lanes.automated)
    }) ?? null
  }
  /** The take ends: nothing of it is Automated; what the hand overrode stays so. */
  const unautomate = () => {
    unhand?.(); unhand = null
    if (state.lanes.automated.length) standing([])
  }
  /** An edit of the take as it still writes it, and what its lane reached kept for Re-enable. */
  const lanesEdit = (edit: InstrumentEdit): InstrumentEdit | null => {
    if (edit.kind === 'torus') for (const [key, value] of Object.entries(edit.edit)) reached.set(key, {edit: {kind: 'torus', edit: {[key]: value} as typeof edit.edit}})
    else for (const id of mapTargetIdsOfEdit(edit)) reached.set(id, {edit})
    return unheldEdit(edit, overridden)
  }

  const answer = (result: StageResult) => { if (!result.ok && result.error !== state.refused) publish({refused: result.error}) }
  const failed = (cause: unknown) => answer({ok: false, error: said(cause)})
  const missed = (count: number) => { if (count > 0) publish({missed: state.missed + count}) }

  /** Seconds from the clip's start to `beat` of the run's pass. */
  const timeOf = (r: Run, beat: number) => r.passStart + (beat - r.pass.from) * r.spb

  /** A note the clip holds, to be let go `at` seconds from the clip's start; ends at one moment are one release. */
  const endAt = (r: Run, at: number, hold: string) => {
    let i = r.ends.length
    while (i > 0 && r.ends[i - 1]!.at > at) i--
    const same = r.ends[i - 1]
    if (same && same.at === at) same.holds.push(hold)
    else r.ends.splice(i, 0, {at, holds: [hold]})
  }

  /** One act, struck to land at its own sample (`seconds` from the clip's start); each note that sounds is held until its own end. */
  const send = (r: Run, strike: ClipStrike, seconds: number) => {
    const sounding: ClipHold[] = []
    // A take's note strikes the touch-point it was played at, at its own strength; the act's strength is the strongest of its notes.
    let amplitude = r.voice ? 0 : strike.amplitude
    for (const note of strike.notes) {
      if (note.chance < 1 && !(owners.random() < note.chance)) continue
      const hold = `clip:${++held}`
      const voiced = r.voice?.(note.note, strike.beat) ?? null
      sounding.push(voiced ? {hold, note: note.note, touch: voiced.touch} : {hold, note: note.note})
      if (r.voice) amplitude = Math.max(amplitude, voiced ? voiced.strength : strike.amplitude)
      endAt(r, timeOf(r, note.end), hold)
    }
    if (sounding.length === 0) return
    const at = String(r.timing.anchor + BigInt(Math.round(seconds * r.timing.rate)))
    owners.strike(sounding, amplitude, at).then(answer, failed)
  }

  /** The run ends: no timer, no watch, and every note it holds let go at once. */
  const halt = () => {
    haltCourse()
    unautomate()
    const was = run
    run = null
    if (!was) return
    if (was.timer !== null) owners.cancel(was.timer)
    was.timer = null
    was.unwatch()
    const holds = was.ends.flatMap(ending => ending.holds)
    was.ends.length = 0
    if (holds.length) owners.release(holds)
  }

  /** The take's next move within the run's pass, if any. */
  const nextMove = (r: Run) => { const move = r.moves[r.move]; return move && move.beat < r.pass.to ? move : undefined }
  /** A take's move made again: each of its edits through the instrument command; a refusal is said once, with where the take resumes,
   * even when the take has played to its end before the owner answers (a later press or Stop leaves it unsaid). */
  const makeMove = (move: ClipMove) => {
    const mine = press
    const told = (words: string) => { if (mine === press && !state.resumes?.includes(words)) publish({resumes: state.resumes ? `${state.resumes} ${words}` : words}) }
    for (const made of move.edits) {
      const edit = lanesEdit(made)
      if (!edit) continue
      void owners.edit?.(edit).catch(cause => ({ok: false as const, error: said(cause)})).then(result => {
        if (!result.ok) told(`The Torus refused a move of the take: ${result.error}`)
      })
    }
    for (const point of move.sets ?? []) {
      reached.set(point.parameter, {value: point.value})
      if (overridden.has(point.parameter)) continue
      void owners.set?.(point.parameter, point.value).catch(cause => ({ok: false as const, error: said(cause)})).then(result => {
        if (!result.ok) told(`A lane of the take was not written again: ${result.error}`)
      })
    }
  }

  /** Wait until the next note-on or note end comes within one owner lookahead of the owner's render, a take's move's beat is rendered,
   * or for the pass's end. */
  const arm = (r: Run) => {
    const next = r.pass.strikes[r.index]
    const passEnd = timeOf(r, r.pass.to)
    const move = nextMove(r)
    const due = Math.min(next ? timeOf(r, next.beat) : Infinity, r.ends[0]?.at ?? Infinity, move ? timeOf(r, move.beat) + r.lead : Infinity)
    r.timer = owners.later(due <= passEnd ? r.fire : r.turn, Math.max(0, (r.origin + Math.min(due, passEnd) - owners.now()) * 1000))
  }

  /** Send every act whose time has come, in the order of their samples, an end before a note-on at one moment. A note-on whose wake is
   * past the owner's slack is let go and counted; an end is always sent, as it moves no sound. */
  const fire = (r: Run) => {
    if (r !== run) return
    r.timer = null
    const now = owners.now() - r.origin, strikes = r.pass.strikes
    let late = 0
    for (;;) {
      const strike = strikes[r.index]
      const seconds = strike ? timeOf(r, strike.beat) : Infinity
      const ending = r.ends[0]
      if (ending && ending.at <= seconds && ending.at <= now + DUE_EARLY_SECONDS) { r.ends.shift(); owners.release(ending.holds); continue }
      if (!strike || seconds > now + DUE_EARLY_SECONDS) break
      r.index++
      if (now - seconds > r.timing.slack) late += strike.notes.length
      else send(r, strike, seconds)
    }
    for (let move = nextMove(r); move && timeOf(r, move.beat) + r.lead <= now + DUE_EARLY_SECONDS; move = nextMove(r)) { r.move++; makeMove(move) }
    missed(late)
    arm(r)
  }

  /** The pass ends: the loop comes round again, or the clip has played to its end. Loops a stall passed whole are skipped, their
   * note-ons missed. A note-on at the loop's start is sent in this same wake, never one wake later. */
  const turn = (r: Run) => {
    if (r !== run) return
    r.timer = null
    for (let move = nextMove(r); move; move = nextMove(r)) { r.move++; makeMove(move) }
    const again = r.plan.again
    if (!again) { halt(); publish({playing: null}); return }
    r.passStart += (r.pass.to - r.pass.from) * r.spb
    r.pass = again
    r.index = 0
    r.move = r.moves.findIndex(move => move.beat >= again.from)
    if (r.move < 0) r.move = r.moves.length
    const length = (again.to - again.from) * r.spb, now = owners.now() - r.origin
    let late = 0
    while (r.passStart + length + r.timing.slack < now) { for (const strike of again.strikes) late += strike.notes.length; r.passStart += length }
    missed(late)
    fire(r)
  }

  /** The clip was read again while it plays: its edit plays from the next pass; a clip that is gone stops. */
  const retake = (r: Run) => {
    owners.read(r.address).then(clip => {
      if (r !== run) return
      const plan = clipPlan(clip)
      if (plan.ok) { r.plan = plan; return }
      halt()
      publish({playing: null, fault: plan.reason})
    }, cause => { if (r === run) publish({fault: `The clip's edit was not read, so it plays as it was: ${said(cause)}`}) })
  }

  /** A take's course ends: no timer, and every key it holds let go at once. */
  const haltCourse = () => {
    const was = course
    course = null
    if (!was) return
    if (was.timer !== null) owners.cancel(was.timer)
    was.timer = null
    const holds = [...was.holds.values()].flat()
    was.holds.clear()
    if (holds.length) owners.release(holds)
  }
  /** Said once: a setting of the take's course that came too late to land at its sample was made at the owner's cursor. */
  const LATE_SETTING = 'A setting of the take came too late to land at its sample, so the Torus made it as its sound then stood.'
  const tellOnce = (words: string) => { if (!state.resumes?.includes(words)) publish({resumes: state.resumes ? `${state.resumes} ${words}` : words}) }
  /** Wait for the course's next act, the frame's next move, or its end. */
  const armCourse = (c: Course) => {
    const next = c.acts[c.index], move = c.moves[c.move]
    const due = Math.min(next ? next.seconds : Infinity, move ? c.start + move.beat * c.spb + c.lead : Infinity, c.end)
    c.timer = owners.later(c.fire, Math.max(0, (c.origin + due - owners.now()) * 1000))
  }
  /** Send every act of the course whose sample has come within one owner lookahead of the render, in the order of their samples. */
  const fireCourse = (c: Course) => {
    if (c !== course) return
    c.timer = null
    const now = owners.now() - c.origin
    let late = 0
    while (c.index < c.acts.length) {
      const next = c.acts[c.index]!
      if (next.seconds > now + DUE_EARLY_SECONDS) break
      c.index++
      const behind = now - next.seconds > c.timing.slack
      const act = next.act
      if (act.action === 'release') {
        const holds = act.keys.flatMap(key => { const id = `${key.row}/${key.column}`, held = c.holds.get(id) ?? []; c.holds.delete(id); return held })
        if (holds.length) owners.release(holds)
      } else if (act.action === 'strike') {
        if (behind) { late += act.keys.length; continue }
        const notes: ClipHold[] = act.keys.map(key => {
          const hold = `take:${++held}`, id = `${key.row}/${key.column}`
          c.holds.set(id, [...(c.holds.get(id) ?? []), hold])
          return {hold, note: c.noteOf?.(key) ?? -1, key}
        })
        owners.strike(notes, act.amplitude, next.at).then(answer, failed)
      } else if (act.action === 'strike-at') {
        if (behind) { late += 1; continue }
        owners.touch(act.points, act.amplitude, next.at).then(answer, failed)
      } else if (act.action === 'singlet') {
        if (behind) { late += 1; continue }
        owners.singlet(act.codon, act.amplitude, next.at).then(answer, failed)
      } else {
        const edit = lanesEdit({kind: 'torus', edit: act.edit})
        if (!edit) continue
        if (behind) tellOnce(LATE_SETTING)
        const mine = press
        void owners.edit?.(edit, behind ? undefined : next.at).catch((cause: unknown) => ({ok: false as const, error: said(cause)})).then(result => {
          if (mine === press && !result.ok) tellOnce(`The Torus refused a setting of the take: ${result.error}`)
        })
      }
    }
    for (let move = c.moves[c.move]; move && c.start + move.beat * c.spb + c.lead <= now + DUE_EARLY_SECONDS; move = c.moves[c.move]) { c.move++; makeMove(move) }
    missed(late)
    if (c.index >= c.acts.length && now + DUE_EARLY_SECONDS >= c.end) {
      for (let move = c.moves[c.move]; move; move = c.moves[c.move]) { c.move++; makeMove(move) }
      haltCourse()
      unautomate()
      publish({playing: null})
      return
    }
    armCourse(c)
  }
  /** A take's course begins: each act at R + (its sample − the take's first), R the sample the Torus rang again from. */
  const beginCourse = (address: ClipAddress, bpm: number, name: string, timing: Extract<ClipTiming, {anchor: bigint}>, take: ClipPrepared, exact: TakeExact,
    lead: number) => {
    const shift = BigInt(exact.landed) - BigInt(exact.from)
    const seconds = (sample: bigint) => Number(sample - timing.anchor) / timing.rate
    const acts = exact.acts.map(act => { const at = BigInt(act.at_samples_elapsed) + shift; return {seconds: seconds(at), at: String(at), act} })
    const moves = [...(take.moves ?? [])].filter(moving).sort((a, b) => a.beat - b.beat)
    const start = seconds(BigInt(exact.landed))
    const c: Course = {address, origin: owners.now(), timing, spb: 60 / bpm, lead, acts, index: 0, moves, move: 0, start, end: start + exact.frames / exact.sample_rate,
      holds: new Map(), noteOf: exact.noteOf, timer: null, fire: () => fireCourse(c)}
    course = c
    automate(moves, exact.acts.flatMap((act): InstrumentEdit[] => act.action === 'set' ? [{kind: 'torus', edit: act.edit}] : []))
    publish({starting: false, playing: {address, name, bpm}})
    armCourse(c)
  }

  const begin = (address: ClipAddress, bpm: number, plan: Extract<ClipPlan, {ok: true}>, timing: Extract<ClipTiming, {anchor: bigint}>,
    take: ClipPrepared | null, lead: number) => {
    const moves = [...(take?.moves ?? [])].filter(moving).sort((a, b) => a.beat - b.beat)
    const first = moves.findIndex(move => move.beat >= plan.first.from)
    const r: Run = {address, spb: 60 / bpm, origin: owners.now(), timing, voice: take?.voice ?? null, moves, move: first < 0 ? moves.length : first, lead,
      plan, pass: plan.first, passStart: 0, index: 0, ends: [], timer: null,
      unwatch: () => {}, fire: () => fire(r), turn: () => turn(r)}
    run = r
    automate(moves, [])
    r.unwatch = owners.watch(address, () => retake(r))
    publish({starting: false, playing: {address, name: plan.name, bpm}})
    arm(r)
  }

  return {
    state: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    play(address, bpm) {
      halt()
      const mine = ++press
      if (!finite(bpm) || bpm <= 0) { publish({...IDLE, fault: 'The set discloses no tempo, so the clip has no time to play in.'}); return }
      publish({...IDLE, starting: true})
      owners.read(address).then(clip => {
        if (mine !== press) return
        const plan = clipPlan(clip)
        if (!plan.ok) { publish({starting: false, fault: plan.reason}); return }
        // A take's Torus is set again first; the owner's clock is read last, so the clip's anchor stands on the sound the owner has
        // rendered as the clip begins.
        let take: ClipPrepared | null = null
        const prepared: Promise<ClipPrepared | null> = owners.prepare
          ? owners.prepare(clip, bpm).catch((cause: unknown) => ({resumes: `The take's Torus was not set again: ${said(cause)}`}))
          : Promise.resolve(null)
        return prepared.then(ready => {
          if (mine !== press) return
          take = ready
          const resumes = ready?.resumes ?? null
          if (resumes !== state.resumes) publish({resumes})
          return owners.clock()
        }).then(clock => {
          if (mine !== press || clock === undefined) return
          const timing = clipTiming(clock)
          const exact = (take as ClipPrepared | null)?.exact
          if ('refused' in timing) publish({starting: false, fault: timing.refused})
          else if (exact && exact.sample_rate !== clock.sample_rate)
            publish({starting: false, fault: `The torus renders at ${clock.sample_rate} Hz, and the take was played at ${exact.sample_rate} Hz.`})
          else if (exact) beginCourse(address, bpm, plan.name, timing, take!, exact, clock.lookahead_seconds)
          else begin(address, bpm, plan, timing, take, clock.lookahead_seconds)
        }, cause => { if (mine === press) publish({starting: false, fault: `The torus did not read its audio clock: ${said(cause)}`}) })
      }, cause => { if (mine === press) publish({starting: false, fault: `The set's owner did not read the clip: ${said(cause)}`}) })
    },
    stop() {
      press++
      halt()
      if (state.playing !== null || state.starting) publish({playing: null, starting: false})
    },
    async reenable(parameter) {
      const given = parameter === undefined ? [...overridden] : overridden.has(parameter) ? [parameter] : []
      if (!given.length) return parameter === undefined ? {ok: true, note: 'Nothing is held off a take\'s lane.'}
        : {ok: false, error: `${parameter} is not held off a take's lane.`}
      for (const id of given) overridden.delete(id)
      standing(state.lanes.automated)
      const playing = given.filter(id => state.lanes.automated.includes(id))
      const refused: string[] = []
      // While its take plays, each goes back to the value its lane last reached, sent by no hand; else it plays its lane from the next point.
      for (const id of playing) {
        const last = reached.get(id)
        const written = last?.edit ? owners.edit?.(last.edit) : last?.value !== undefined ? owners.set?.(id, last.value) : undefined
        const result = written ? await written.catch((cause: unknown) => ({ok: false as const, error: said(cause)})) : {ok: true as const}
        if (!result.ok) refused.push(`${id}: ${result.error}`)
      }
      const named = given.join(', ')
      if (refused.length) return {ok: false, error: `${named} went back to the take's lanes, and the owner refused the value its lane reached (${refused.join('; ')}).`}
      return {ok: true, note: playing.length ? `${named} plays from the take's lanes again.` : `${named} plays from the take's lanes again when the take plays.`}
    },
  }
}

// ── the candidate's player, and Live's transport over it ────────────────────

/** The set's owner, the torus's owner and the page's clock. */
function candidateOwners(): ClipPlayerOwners {
  return {
    // As live/liveWrites.ts useLiveClipWhole reads the clip, once.
    read: async address => {
      const transport = detectTransport()
      if (transport.kind === 'unavailable') throw new Error(transport.reason)
      const answer = await kernelOp(transport, {op: 'live_clip_read', path: address.path, track: address.track, clip: address.at})
      if (answer.error || answer.outcome?.result !== 'live_clip_reading') throw new Error(answer.error ?? 'The set\'s owner did not answer the clip')
      return answer.outcome.reading.clip
    },
    prepare: (clip, bpm) => prepareTake(clip, commitLiveInstrumentEdit, {stage: commitLiveStage, bpm}),
    clock: () => readAudioClock(commitLiveStage),
    edit: (edit, at) => commitLiveStage({command: 'instrument', edit, ...(at === undefined ? {} : {at_samples_elapsed: at})}),
    set: writeMapTarget,
    strike: (notes, amplitude, at) => livePlayingPath().clipStrike(notes, amplitude, at),
    touch: (points, amplitude, at) => commitLiveStage({command: 'strike-at', points: [...points], amplitude, at_samples_elapsed: at}),
    singlet: (codon, amplitude, at) => commitLiveStage({command: 'singlet', codon, amplitude, at_samples_elapsed: at}),
    release: holds => livePlayingPath().clipRelease(holds),
    watch: (address, changed) => subscribeSet(address.path, changed),
    now: () => performance.now() / 1000,
    later: (run, ms) => setTimeout(run, ms),
    cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
    random: () => Math.random(),
    hand: moved => subscribeAcceptedLiveWrites((command, how) => { if (how.hand && command.command === 'instrument') moved(mapTargetIdsOfEdit(command.edit)) }),
  }
}

/** The one clip player the candidate's Live transport plays through. */
export const liveClipPlayer: ClipPlayer = createClipPlayer(candidateOwners())

const SET_OF = /^als:(.+)#track\/\d+/

/** The clip THE selection names: a session slot or an arrangement clip of a Live set; null for anything else (shell/liveSelection.ts
 * setSelectionOf reads only Live's own selection). Pure. */
export function clipAddressOf(selection: WorldSelection | undefined): ClipAddress | null {
  const path = selection ? SET_OF.exec(selection.ref)?.[1] : undefined
  const place = path ? setSelectionOf(selection, path) : null
  const at = place ? clipAtOf(place) : null
  return path && place && at ? {path, track: place.track, at} : null
}

export interface ClipPlayInput {
  readonly address: ClipAddress | null
  /** The selection's own title ("3-LABS · clip 1"). */
  readonly title: string | null
  readonly bpm: number | null
  readonly torus: LiveTorusState | null
  readonly state: ClipPlayState
  readonly play: (address: ClipAddress, bpm: number) => void
  readonly stop: () => void
}

const NO_CLIP = 'Select a clip in Session or Arrangement view: Play plays its notes on the torus.'
const NO_TEMPO = 'The set discloses no tempo, so the clip has no time to play in.'

/** Why the torus cannot take the clip's notes now, from its owner's reading; null when it plays. */
function torusRefusal(torus: LiveTorusState | null): string | null {
  if (torus === null) return 'The torus is not open, so the clip has nothing to sound on. Open it in Live.'
  if (!torus.ok) return `The torus is refused: ${torus.fault}`
  return torus.value.standing === 'following' ? null : `The torus is ${torus.value.standing}: resume it, and Play plays the clip on it.`
}

/** Live's Play and Stop over the clip player. Play lights while the clip plays (so Space stops it). Pure. */
export function clipPlayBindings(input: ClipPlayInput): {play: SlotBinding; stop: SlotBinding} {
  const {address, bpm, state} = input
  const lit = state.playing !== null
  const notes = [state.fault, state.resumes, state.refused && `The torus refused a note: ${state.refused}`,
    state.missed > 0 && `${state.missed} note-on${state.missed === 1 ? ' came' : 's came'} too late to strike and ${state.missed === 1 ? 'was' : 'were'} let go.`]
    .filter((note): note is string => typeof note === 'string' && note.length > 0).join(' ')
  const tell = (text: string) => notes ? `${text} ${notes}` : text
  const stop: SlotBinding = lit || state.starting
    ? {press: input.stop, title: 'Stop — the clip stops; what it struck rings out on the torus.'}
    : {refused: 'Nothing plays, so there is nothing to stop.'}
  const why = !address ? NO_CLIP : bpm === null || !(bpm > 0) ? NO_TEMPO : torusRefusal(input.torus) ?? (state.starting ? 'Reading the clip from the set…' : null)
  if (why || !address || bpm === null) return {play: {lit, refused: tell(why ?? NO_CLIP)}, stop}
  const what = input.title ?? 'the clip you select'
  return {play: {press: () => input.play(address, bpm), lit,
    title: tell(lit ? `Play — ${state.playing!.name} plays on the torus; press again to start it from its start marker.`
      : `Play — the torus plays the notes of ${what} from its start marker, at ${bpm.toFixed(2)} BPM.`)}, stop}
}

/** An act's answer, as the set's views show it (timeline/worldTrackAdapter.ts WorldActionReceipt). */
export type ClipActAnswer = {ok: true; note: string} | {ok: false; error: string}

/** Launch, Stop and Stop all as the set's acts (manual §10.9: a clip's Launch and Stop, an empty slot's Stop the track, the Main track's
 * Stop all clips; §21.2 "Play | Plays the clips of the part on the torus"). Launch runs the player's Play on the clip it names and answers
 * as the transport's Play would: refused before it plays where the torus cannot take it or the set has no tempo, else once the owner has
 * read the clip, in the player's words. Stop the track stops the clip that plays where it stands on that track; Stop all stops whatever
 * plays. The player plays one clip at a time, so a row's launch (every clip of a row at once) is not one of these. */
export interface ClipLaunchActs {
  launch(address: ClipAddress, bpm: number): Promise<ClipActAnswer>
  stop(path: string, track: number, named: string): ClipActAnswer
  stopAll(): ClipActAnswer
  /** Re-enable (O-I #853): an overridden parameter, or every one, back to the take's lanes. */
  reenable(parameter?: string): Promise<ClipActAnswer>
}

/** How long Launch waits for the set's owner to read the clip before it answers that it is reading it. */
const LAUNCH_ANSWER_MS = 4000

export function clipLaunchActs(player: ClipPlayer, torus: () => LiveTorusState | null): ClipLaunchActs {
  const same = (a: ClipAddress, b: ClipAddress) => a.path === b.path && a.track === b.track && JSON.stringify(a.at) === JSON.stringify(b.at)
  return {
    launch(address, bpm) {
      const why = !(bpm > 0) ? NO_TEMPO : torusRefusal(torus())
      if (why) return Promise.resolve({ok: false, error: why})
      return new Promise(resolve => {
        let settled = false
        const finish = (answer: ClipActAnswer) => { if (settled) return; settled = true; off(); clearTimeout(timer); resolve(answer) }
        const settle = () => {
          const state = player.state()
          if (state.starting) return
          if (state.playing && same(state.playing.address, address)) finish({ok: true, note: `${state.playing.name || 'The clip'} plays on the torus.`})
          else finish({ok: false, error: state.fault ?? 'The clip did not play.'})
        }
        const off = player.subscribe(settle)
        const timer = setTimeout(() => finish({ok: true, note: 'Reading the clip from the set…'}), LAUNCH_ANSWER_MS)
        player.play(address, bpm)
        settle()
      })
    },
    stop(path, track, named) {
      const state = player.state()
      const here = state.playing ? state.playing.address.path === path && state.playing.address.track === track : state.starting
      if (!here) return {ok: true, note: `Nothing plays on ${named}.`}
      const name = state.playing?.name || 'The clip'
      player.stop()
      return {ok: true, note: `${name} stops; what it struck rings out on the torus.`}
    },
    stopAll() {
      const state = player.state()
      if (!state.playing && !state.starting) return {ok: true, note: 'Nothing plays.'}
      player.stop()
      return {ok: true, note: 'Every clip stops; what was struck rings out on the torus.'}
    },
    reenable: parameter => player.reenable(parameter),
  }
}

/** The candidate's Launch and Stop: its one clip player and the torus's owner reading. */
export const liveClipActs: ClipLaunchActs = clipLaunchActs(liveClipPlayer, liveTorusState)

/** Live's Play and Stop: the clip THE selection names, played on the torus at the set's tempo. Leaving Live's transport stops it. */
export function useLiveClipPlay(selection: WorldSelection | undefined, tempoBpm: number | null): TransportBindings {
  const state = useSyncExternalStore(liveClipPlayer.subscribe, liveClipPlayer.state, liveClipPlayer.state)
  const torus = useLiveTorusReading()
  useEffect(() => () => liveClipPlayer.stop(), [])
  return clipPlayBindings({address: clipAddressOf(selection), title: selection?.title ?? null, bpm: tempoBpm, torus, state,
    play: liveClipPlayer.play, stop: liveClipPlayer.stop})
}
