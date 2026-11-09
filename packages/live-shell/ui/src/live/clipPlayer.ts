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
//               reached (sent by no hand), else it plays its lane from the take's next point. A hand move of a session-held value (the
//               Scale tie, held by the note-device chain, not the owner) overrides its lane as any other does (DLW build ruling
//               2026-11-05: "Hand moves of session-held values (the Scale tie and the rest) are heard as overrides, like any other";
//               liveHandMoves). While the take plays, each lane stands as its own under the take's clip (O-I #743 round 20): the
//               parameter it writes, its points at their beats in the clip, so each has its own Overridden mark and Re-enable. A
//               slot's clip has no place on the Arrangement's ruler, so where it landed on the launch grid is its take's (`at`, the
//               grid's beats from where it began; O-I #849 round 21). Every player's take is followed, a row's among them (the set's
//               acts' `lanes`), and Re-enable reaches each player that holds the parameter off its take's lanes.
//   its course  a take with its course (O-I #855 round 6d), its clip as it was laid, plays as it was played: the Torus rings again from the
//               state it rang in as the take began (prepareTake restores the owner's checkpoint, which lands at the owner's sample R),
//               and each act of the course lands at R + (its sample − the take's first sample): the keys it struck, at its strength (the
//               path's clipStrike with the very keys), each touch of the surface and each singlet at its strength (the frame's own
//               `strike-at` and `singlet` commands with `at_samples_elapsed`), each release in its sample's turn, each setting of the
//               Torus at its sample (the instrument command with `at_samples_elapsed`). Each is sent as its sample comes within one owner lookahead of the render;
//               one behind the render when it comes is missed and counted, a setting made at the owner's cursor and said. The level and
//               effects move at their beats, as any take's. The take ends where its course ends, and lets go what it holds; Stop too.
//   the launch  where a launch lands is the clip's own (O-I #743; DLW manual §21.1: "How a clip launches, when it lands and what follows it
//               are the clip's own, in its Launch tab. The transport's Quantize is the launch quantize for every clip set to Global"):
//               its Quantize (edit.rs clip_reading `quantize`, Live's LaunchQuantisation), Global the set's (model.rs `global_quantize`,
//               Live's GlobalQuantisation), a step of the launch grid; the grid runs from where the first launch landed while nothing
//               played, and a launch lands on its first step at or after the earliest it can (the clip's anchor), its notes struck and
//               paced from there. A row's launch plays every MIDI clip of the row at once on its own track's player (Live's scene
//               launch); its clips land together where one quantize is theirs. A take's course lands where its Torus rang again, so no
//               quantize moves it, and begins the grid where none stands. One Torus rings at a time: of a row's takes, the first to set
//               it again holds it for the press (torusTurn), and the others play their notes as played on it as that one set it. A
//               bar is the set's, read from its time signature (O-I #849 round 21; four beats where it keeps none).
//
// Ported from: the store with its owners handed in (inhabitants/ql/devices/qlSitting.ts: now, later, cancel, its bell rung through
// commitLiveStage); the chord as one act (live/janko/jankoInput.ts flush); the clip's markers (packages/live-set/src/edit.rs markers).
// MIDI out (O-I #853 round 22; DLW build ruling 2026-11-05: "MIDI out for clip notes (#853), through the host"): each note-on and each
// end leaves as MIDI when it sounds. It is sent one owner lookahead before, so the player names the time to its sample (the page's clock
// at the owner's clock read, plus the owner's lookahead, plus its time from the clip's start) and the host holds it until then
// (jankoInput.ts clipStrike and clipRelease `sounds`, midi.rs `after_ms`); Stop lets go at once, and the host holds each note-off behind
// its note-on. A take frozen on its part strikes nothing, and its notes still leave as MIDI when they sound, at the strength each was
// played, as Live's Freeze still sends a frozen track's MIDI (O-I #849 round 23); Stop lets them go at once.
//
// A frozen take lands on its holder's course (O-I #849 round 23; DLW build ruling 2026-11-05: "Lay a frozen take sample-aligned to its
// holder's course, not on the grid"): the take that holds the Torus says where its course rang from (torusTurn `ring`, the sample the
// Torus rang again from, which is no step of the launch grid), and a take frozen while it holds waits for that word (`rung`) and lands on
// that course: launched within its first step, as a row launched with it is, at its first sample; launched later, at the course's next
// step of the launch quantize. Laid before the engine's render reaches it, its sound plays from where the engine then stands.
import {useEffect, useMemo, useSyncExternalStore} from 'react'
import type {InstrumentEdit, StageAudioClock, StageCommand, StageKey, StageResult, StageTakeAct} from '@epilogos/expressions-boundary'
import {detectTransport, kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {LiveClipAt, LiveClipReading} from '../../../../../desktop/cradle/src/kernel/types'
import type {WorldSelection} from '../../../../../desktop/cradle/src/workspace/store'
import type {SlotBinding, TransportBindings} from '../frame/transport/slots'
import {subscribeSet} from '../native/application'
import {followLiveJankoWindow, jankoLensOf} from '../native/liveJankoWindow'
import {sendLiveMidiOut} from '../native/liveMidi'
import {setSelectionOf} from '../shell/liveSelection'
import type {ClipHold, MidiOutMessage} from './janko/jankoInput'
import {livePlayingPath} from './keyboardLayout'
import {clipAtOf} from './liveWrites'
import {liveEngineState} from './liveEngine'
import {partFreeze, prepareTake, torusKept} from './liveTake'
import {commitLiveInstrumentEdit, commitLiveStage, liveTorusState, subscribeAcceptedLiveWrites, useLiveTorusReading, type LiveTorusState} from './torusInstrument'
import type {MapValue} from './midiMap/midiMapModel'
import {mapTargetIdsOfEdit, readMapTargets, writeMapTarget} from './midiMap/midiMapTargets'
import {subscribeHeldHandMoves} from './noteDevices/noteDeviceHold'

/** A timer may wake a hair before its moment; a strike due within this many seconds is sent at that wake. */
const DUE_EARLY_SECONDS = 0.002
/** The channel a frozen take's notes leave on as MIDI: the keys' own (janko/jankoInput.ts OUT_CHANNEL). */
const MIDI_CHANNEL = 0

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
   * answering where the take resumes from and how each of its notes was played; null for a clip no take gave. `turn`, given, is the
   * one Torus among the takes of one press (a row's launch): a take asks it before it sets the Torus again. Absent, nothing is
   * prepared. `address` is where the clip stands, the part a held take is frozen on (O-I #849 round 22). */
  readonly prepare?: (clip: LiveClipReading, bpm: number, turn?: ClipTorusTurn, address?: ClipAddress) => Promise<ClipPrepared | null>
  /** The torus owner's audio clock, read once per press (readAudioClock); a refusal throws in the owner's words. */
  readonly clock: () => Promise<StageAudioClock>
  /** One instrument edit of a take's move, at the owner's sample `at` where a take's course names one (the `instrument` stage command),
   * settling with the owner's answer. Absent, no move is made. */
  readonly edit?: (edit: InstrumentEdit, at?: string) => Promise<StageResult>
  /** One point of a take's automation lane, through its parameter's own write (midiMap/midiMapTargets.ts writeMapTarget, O-I 853),
   * settling with its owner's answer. Absent, no lane is written. */
  readonly set?: (parameter: string, value: MapValue) => Promise<StageResult>
  /** One act of the clip on the part's one playing path (keyboardLayout.ts livePlayingPath, jankoInput.ts clipStrike): its notes' keys
   * struck at the owner's sample `at`, each held until its hold is let go; settling with the owner's answer. `sounds`: ms from now until
   * that sample sounds, when its notes leave as MIDI. */
  readonly strike: (notes: readonly ClipHold[], amplitude: number, at: string, sounds?: number) => Promise<StageResult>
  /** A touch of a take's course: its points of the surface struck at one strength at the owner's sample `at` (the frame's `strike-at`
   * stage command, as controller.ts playAt strikes a touch); settling with the owner's answer. */
  readonly touch: (points: readonly {theta: number; phi: number}[], amplitude: number, at: string) => Promise<StageResult>
  /** A singlet of a take's course: its codon struck at its strength at the owner's sample `at` (the frame's `singlet` stage command,
   * O-I #771); settling with the owner's answer. */
  readonly singlet: (codon: number, amplitude: number, at: string) => Promise<StageResult>
  /** The clip lets these notes go: the end of each note's length (`sounds`: ms from now until it sounds, when its note-off leaves as
   * MIDI), or Stop (at once). */
  readonly release: (holds: readonly string[], sounds?: number) => void
  /** What a frozen take's notes play, as MIDI (O-I #849 round 23): it strikes nothing on the playing path, so its notes leave here, each
   * `afterMs` from now, when it sounds (none: at once). Absent, nothing of a frozen take leaves as MIDI. */
  readonly midi?: (messages: readonly MidiOutMessage[], afterMs?: number) => void
  /** Tell `changed` when the set the clip stands in is read again (a write, Live saving it). Returns the unsubscribe. */
  readonly watch: (address: ClipAddress, changed: () => void) => () => void
  /** The page's clock, in seconds: monotonic. It only paces when a note-on is sent; the note's time is its sample. */
  readonly now: () => number
  readonly later: (run: () => void, ms: number) => unknown
  readonly cancel: (handle: unknown) => void
  /** A draw in [0, 1), for a note's chance. */
  readonly random: () => number
  /** Tell `moved` the map parameters each hand move writes (an instrument edit the owner took, sent BY_HAND, or a session-held value the
   * hand moved: liveHandMoves). Returns the unsubscribe. Absent, no lane is overridden. */
  readonly hand?: (moved: (parameters: readonly string[]) => void) => () => void
  /** A map parameter as the surface names it, for a take's lane; absent or unnamed, its id. */
  readonly label?: (parameter: string) => string | undefined
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
  /** A take frozen on its part, its own Torus rendered into its sound (O-I #849 round 22). */
  readonly frozen?: ClipFrozen
}
/** A take frozen on its part (O-I #849 round 22; DLW build ruling 2026-11-05: "A rendered take is a frozen take"): its course rendered with
 * its Torus's moves and effects, heard through its part from where its clip lands until the take ends, in place of the part's live Torus,
 * as Live's Freeze Track plays a frozen track. While frozen it strikes no note and makes no move, and its lanes (its `moves` and `settings`,
 * as they were baked in) carry no Overridden mark. `words` say it is frozen; `seconds`, how long its sound is; `land` freezes it at the
 * owner's sample its clip lands at, settling null once the engine took it, else in the words the take then plays in on the live Torus;
 * `unfreeze` returns the part to its live Torus (null, or why not, in words), and the take then says `unfrozen`. */
export interface ClipFrozen {
  readonly words: string
  readonly seconds: number
  readonly moves: readonly ClipMove[]
  readonly settings: readonly {readonly beat: number; readonly edit: InstrumentEdit}[]
  readonly land: (landed: bigint) => Promise<string | null>
  readonly unfreeze: () => Promise<string | null>
  readonly unfrozen: string
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
 * parameter id (midiMap/midiMapTargets.ts). Overridden stands until Re-enable, across a Stop. While a take plays, its clip (`take`) and
 * its lanes, each its own (O-I #743 round 20); and, where it landed on a launch grid, where the clip's own beat 0 stands on the transport
 * (`at`: the grid's beats from where it began), a Session clip's place on the ruler (O-I #849 round 21). A frozen take's (O-I #849 round
 * 22) says so in words (`frozen`): its lanes are baked into its sound, and nothing of them stands Automated. A looping clip's take names its
 * loop in the clip's own beats (`loop`: its first pass from `start`, then `from` to `to` again): its lanes are drawn again for each pass,
 * as Live draws a looped clip's envelope (DLW build ruling 2026-11-05). A clip whose loop is off and that plays from a start marker past its
 * beat 0 names it (`start`, O-I #849 round 24): an arrangement clip lies on the ruler from its start marker, looping or not. */
export interface ClipLaneStanding {
  readonly automated: readonly string[]
  readonly overridden: readonly string[]
  readonly take?: {readonly address: ClipAddress; readonly name: string; readonly at?: number; readonly frozen?: string
    readonly loop?: {readonly start: number; readonly from: number; readonly to: number}; readonly start?: number}
  readonly lanes?: readonly ClipLane[]
}
/** One lane of the take that plays: the map parameter it writes, as the surface names it, and its points at their beats in the clip, each
 * value within the lane's own span (laneValues), in the order it writes them. */
export interface ClipLane {readonly parameter: string; readonly label: string; readonly points: readonly {readonly beat: number; readonly value: number}[]}
/** A take that plays on one of the set's players, and its lanes. */
export interface ClipTakeLanes {readonly take: NonNullable<ClipLaneStanding['take']>; readonly lanes: readonly ClipLane[]}
/** The lanes' standing over every player of the set (clipLaunchActs `lanes`, O-I #849 round 21): what any take that plays writes, what the
 * hand holds off any take's lanes, and each take that plays with its lanes, the set's own player's first, then a row's by track. */
export interface ClipLanesStanding extends ClipLaneStanding {readonly takes: readonly ClipTakeLanes[]}

/** A value a lane writes as a number, where it is one: a number, on (1) or off (0), or the one number a setting holds (a Rate's steps a
 * second); else null. */
function laneNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value !== null && typeof value === 'object') {
    const numbers = Object.values(value).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    return numbers.length === 1 ? numbers[0]! : null
  }
  return null
}
/** A lane's values drawn 0–1: numbers within their own span (low at 0, high at 1; one value throughout at 0), else each value stepped in
 * the order it first comes (a choice's options as the take reached them). Pure. */
export function laneValues(values: readonly unknown[]): number[] {
  const numbers = values.map(laneNumber)
  if (numbers.every((v): v is number => v !== null)) {
    const min = Math.min(...numbers), max = Math.max(...numbers)
    return numbers.map(v => max > min ? (v - min) / (max - min) : 0)
  }
  const order: string[] = []
  const keys = values.map(v => { const key = JSON.stringify(v) ?? String(v); if (!order.includes(key)) order.push(key); return key })
  return keys.map(key => order.length > 1 ? order.indexOf(key) / (order.length - 1) : 0)
}
/** What an instrument edit writes to map parameter `id`: a session macro its own, Sound the edit's not-muted, else the one setting it
 * carries (or the whole of it where it carries more). */
function editValueOf(edit: InstrumentEdit, id: string): unknown {
  if (edit.kind === 'torus') return (edit.edit as Readonly<Record<string, unknown>>)[id]
  if (edit.kind === 'muted') return !edit.muted
  const {kind: _kind, ...rest} = edit as {readonly kind: string} & Readonly<Record<string, unknown>>
  const fields = Object.values(rest)
  return fields.length === 1 ? fields[0] : rest
}
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

/** Where the clip that plays is heard (G13; DLW build ruling 2026-11-08: Live's Session Record with a clip playing on an armed part
 * overdubs into that clip): the clip and its name; the page's clock (seconds) at which its first pass's first beat is heard, one owner
 * lookahead past the clock its start was anchored on, as a note-on struck at its sample sounds; its seconds per beat; its first pass and
 * the loop it plays again (none when its loop is off), in the clip's own beats. A key the hand plays lands at the owner's cursor, so it
 * sounds as it is played, with what the clip sounds then. */
export interface ClipHeard {
  readonly address: ClipAddress
  readonly name: string
  readonly heard: number
  readonly spb: number
  readonly first: {readonly from: number; readonly to: number}
  readonly again: {readonly from: number; readonly to: number} | null
}

/** The clip's own beat heard at the page's clock `at` (seconds), and the end of the pass it falls in (a loop's end, or the clip's); null
 * before its start is heard, or once a clip whose loop is off has ended. Pure. */
export function clipBeatHeard(heard: ClipHeard, at: number): {readonly beat: number; readonly end: number} | null {
  const seconds = at - heard.heard
  if (!(seconds >= 0) || !(heard.spb > 0)) return null
  const beats = seconds / heard.spb, first = heard.first.to - heard.first.from
  if (beats < first) return {beat: heard.first.from + beats, end: heard.first.to}
  const again = heard.again
  if (!again || !(again.to > again.from)) return null
  return {beat: again.from + ((beats - first) % (again.to - again.from)), end: again.to}
}

/** A press of Launch on a player: the clip it was asked to play, from the moment of the press. Each press is its own object, and `n`
 * orders presses across every player (46c item 5: a relaunch is the player's own launch, not what is heard going quiet). */
export interface ClipLaunch {readonly address: ClipAddress; readonly n: number}
let launches = 0

export interface ClipPlayer {
  state(): ClipPlayState
  /** Where the clip that plays is heard (G13), while one plays; null while none does or one is still being read. */
  heard(): ClipHeard | null
  /** The press the player was last asked to play, told before what it played is let go (so a listener told of the quiet between the
   * halt and the start already knows a press made it); null once it is stopped. */
  launched(): ClipLaunch | null
  subscribe(listener: () => void): () => void
  /** Play the clip at `address` from its start marker at `bpm`; a clip already playing starts again. `land`, given, says where on the
   * owner's clock the clip lands (a launch quantize): the earliest it can, its anchor, or later; a take's course is not moved. `grid`,
   * given, is the launch grid it lands on, from which the take's lanes have their place on the transport; `turn`, the one Torus among
   * the takes of its press. */
  play(address: ClipAddress, bpm: number, land?: ClipLanding, grid?: ClipGrid, turn?: ClipTorusTurn): void
  /** Stop: nothing more strikes, and every note the clip holds is let go at once; what was struck rings out on the torus. */
  stop(): void
  /** Re-enable (O-I #853): give `parameter`, or every overridden one, back to the take's lanes. */
  reenable(parameter?: string): Promise<ClipActAnswer>
  /** Unfreeze (O-I #849 round 22): the take frozen on the part is let go, and the part plays its notes on its live Torus from here. */
  unfreeze(): Promise<ClipActAnswer>
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

/** Where a launch lands on the owner's clock, given the clip read and the earliest it can land (its timing's anchor); `course`, given, is
 * the sample the course of the take that holds the Torus rang from, which a frozen take lands on in place of the launch grid. */
export type ClipLanding = (clip: LiveClipReading, timing: Extract<ClipTiming, {anchor: bigint}>, course?: bigint) => bigint
/** The launch grid a set's clips land on (clipLaunchActs): where it began on the owner's clock, null while none stands; `began` is told
 * where a clip began, which begins the grid where none stands (a take's course, which no quantize moves and no landing asked for). */
export interface ClipGrid {readonly origin: () => bigint | null; readonly began: (at: bigint) => void}
/** Whose the one Torus is among the takes that play (O-I #849 round 21): one Torus rings at a time, so the first take to ask sets it again
 * (`take` answers null), and any other is answered the name of the take whose it is. The turn is that take's until it ends (DLW build
 * ruling 2026-11-05: "The turn belongs to the first take until it ends, and any launch meanwhile is held in the same words, a single
 * launch included"): its player gives it back (`release`) as the take ends, stops or is launched over. */
export interface ClipTorusTurn {
  readonly take: (name: string) => string | null
  readonly release?: (name: string) => void
  /** The holder begins (O-I #849 round 23): its course rang from the owner's sample `at`, or (null) it plays no course. */
  readonly ring?: (name: string, at: bigint | null) => void
  /** Where the holder's course rang from, once it begins; null when none holds, it plays no course, or it ends first. */
  readonly rung?: () => Promise<bigint | null>
}
/** A turn of the Torus, held by none yet. */
export function torusTurn(): ClipTorusTurn {
  let holder: string | null = null
  /** The holder's word, once it began: where its course rang from, or null. */
  let course: {readonly at: bigint | null} | null = null
  let waiting: ((at: bigint | null) => void)[] = []
  const tell = (at: bigint | null) => { const told = waiting; waiting = []; for (const resolve of told) resolve(at) }
  return {take: name => { if (holder !== null) return holder; holder = name; course = null; return null },
    release: name => { if (holder === name) { holder = null; course = null; tell(null) } },
    ring: (name, at) => { if (holder === name && course === null) { course = {at}; tell(at) } },
    rung: () => holder === null ? Promise.resolve(null) : course ? Promise.resolve(course.at) : new Promise(resolve => waiting.push(resolve))}
}

/** A word of Live's launch quantisation (edit.rs QUANTIZE, without Global) as a step of the launch grid, in beats: bars of `bar` beats (the
 * set's, read from its time signature: shell/document.ts barBeats; four where it keeps none), a note value of a whole note of four beats,
 * a triplet two thirds of it; null for None (no step: a launch lands as soon as it can); undefined for a word that is none of them. Pure. */
export function quantumBeats(word: string, bar = 4): number | null | undefined {
  if (word === 'none') return null
  const bars = /^(1|2|4|8) bars?$/.exec(word)
  if (bars) return Number(bars[1]) * bar
  const note = /^1\/(2|4|8|16|32)(t?)$/.exec(word)
  if (!note || (note[2] && note[1] === '32')) return undefined
  return (4 / Number(note[1])) * (note[2] ? 2 / 3 : 1)
}

/** The first step of the grid from `origin`, every `step` samples, at or after `earliest`; `earliest` itself where there is no grid or no
 * step. Each step is rounded once from the origin, so steps of a fraction of a sample never drift. Pure. */
export function landAt(earliest: bigint, origin: bigint | null, step: number | null): bigint {
  if (origin === null || step === null || !(step > 0)) return earliest
  if (earliest <= origin) return origin
  const k = Math.max(0, Math.ceil(Number(earliest - origin) / step - 1e-9))
  return origin + BigInt(Math.round(k * step))
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
  /** The take frozen on its part while it plays frozen (its sound from the clip's start for its `seconds`); null once it is let go. */
  frozen: ClipFrozen | null
  /** The notes a frozen take sounds as MIDI only, each hold to its note's number: let go as MIDI at their ends, or at once on Stop. */
  readonly outs: Map<string, number>
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

/** Every note a player strikes is its own hold on the path: named across every player, as a row's players strike through the part's one
 * playing path. */
let held = 0

/** A clip player over its owners. */
export function createClipPlayer(owners: ClipPlayerOwners): ClipPlayer {
  let state: ClipPlayState = IDLE
  let run: Run | null = null
  let course: Course | null = null
  /** The press in progress: a Stop or a later press makes an earlier read stale. */
  let press = 0
  let launch: ClipLaunch | null = null
  const listeners = new Set<() => void>()
  const publish = (next: Partial<ClipPlayState>) => { state = {...state, ...next}; for (const listener of [...listeners]) listener() }
  /** The turn of the Torus this player's take holds, by the take's name, given back as the take ends (ClipTorusTurn `release`). */
  let turned: {readonly turn: ClipTorusTurn; readonly name: string} | null = null
  const letTurnGo = () => { const was = turned; turned = null; was?.turn.release?.(was.name) }

  /** The take's lanes (O-I #853): what the hand overrode, which the take no longer writes; the last value each lane reached, for Re-enable;
   * and the hand's watch while a take plays. */
  const overridden = new Set<string>()
  const reached = new Map<string, {readonly edit?: InstrumentEdit; readonly value?: MapValue}>()
  let unhand: (() => void) | null = null
  /** The take that plays and its lanes, while one does. */
  let playingLanes: {readonly take: NonNullable<ClipLaneStanding['take']>; readonly lanes: readonly ClipLane[]} | null = null
  const standing = (automated: readonly string[]) => publish({lanes: {automated: Object.freeze([...automated]), overridden: Object.freeze([...overridden]),
    ...(playingLanes && (automated.length || playingLanes.take.frozen !== undefined) ? playingLanes : {})}})
  /** The lanes of a take: each parameter its moves and settings write, in `automated`'s order, with its points at their beats in order. */
  const lanesOf = (automated: readonly string[], moves: readonly ClipMove[], settings: readonly {readonly beat: number; readonly edit: InstrumentEdit}[]): ClipLane[] => {
    const raw = new Map<string, {beat: number; value: unknown}[]>()
    const put = (id: string, beat: number, value: unknown) => { if (value !== undefined) raw.set(id, [...(raw.get(id) ?? []), {beat, value}]) }
    const edits = [...moves.flatMap(move => move.edits.map(edit => ({beat: move.beat, edit}))), ...settings]
    for (const {beat, edit} of edits) for (const id of mapTargetIdsOfEdit(edit)) put(id, beat, editValueOf(edit, id))
    for (const move of moves) for (const point of move.sets ?? []) put(point.parameter, move.beat, point.value)
    return automated.flatMap(parameter => {
      const points = [...(raw.get(parameter) ?? [])].sort((a, b) => a.beat - b.beat)
      if (!points.length) return []
      const values = laneValues(points.map(point => point.value))
      return [{parameter, label: owners.label?.(parameter) ?? parameter, points: points.map((point, i) => ({beat: point.beat, value: values[i]!}))}]
    })
  }
  /** A take begins: what its moves and lanes write stands Automated, each lane its own under the take's clip, and a hand move of one of
   * those overrides it. */
  const automate = (take: NonNullable<ClipLaneStanding['take']>, moves: readonly ClipMove[],
    settings: readonly {readonly beat: number; readonly edit: InstrumentEdit}[]) => {
    unhand?.()
    reached.clear()
    const automated = [...new Set([...moves.flatMap(moveParameters), ...settings.flatMap(({edit}) => mapTargetIdsOfEdit(edit))])]
    const lanes = lanesOf(automated, moves, settings)
    playingLanes = lanes.length ? {take: Object.freeze({...take}), lanes: Object.freeze(lanes)} : null
    standing(automated)
    if (!automated.length) { unhand = null; return }
    unhand = owners.hand?.(moved => {
      const taken = moved.filter(id => automated.includes(id) && !overridden.has(id))
      if (!taken.length) return
      for (const id of taken) overridden.add(id)
      standing(state.lanes.automated)
    }) ?? null
  }
  /** A frozen take begins (O-I #849 round 22): its lanes stand under its clip as they were baked into its sound, saying so; nothing of them
   * is Automated, so no hand move overrides them. */
  const bake = (take: NonNullable<ClipLaneStanding['take']>, frozen: ClipFrozen) => {
    unhand?.(); unhand = null
    reached.clear()
    const baked = [...new Set([...frozen.moves.flatMap(moveParameters), ...frozen.settings.flatMap(({edit}) => mapTargetIdsOfEdit(edit))])]
    const lanes = lanesOf(baked, frozen.moves, frozen.settings)
    playingLanes = lanes.length ? {take: Object.freeze({...take, frozen: frozen.words}), lanes: Object.freeze(lanes)} : null
    standing([])
  }
  /** The take ends: nothing of it is Automated and its lanes are gone; what the hand overrode stays so. */
  const unautomate = () => {
    unhand?.(); unhand = null
    playingLanes = null
    if (state.lanes.automated.length || state.lanes.take) standing([])
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

  /** One act, struck to land at its own sample (`seconds` from the clip's start); each note that sounds is held until its own end. A take
   * frozen on its part strikes none: its sound is the engine's. */
  const send = (r: Run, strike: ClipStrike, seconds: number) => {
    if (r.frozen) { sendFrozen(r, strike, seconds); return }
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
    owners.strike(sounding, amplitude, at, soundsIn(r.origin, r.lead, seconds)).then(answer, failed)
  }
  /** A frozen take's act (O-I #849 round 23): it strikes nothing, as the engine sounds it, and each of its notes leaves as MIDI when it
   * sounds, at the strength it was played (the act's where the take does not say), held until its own end. Every note: it was played. */
  const sendFrozen = (r: Run, strike: ClipStrike, seconds: number) => {
    if (!owners.midi) return
    const ons: MidiOutMessage[] = []
    for (const note of strike.notes) {
      if (!Number.isSafeInteger(note.note) || note.note < 0 || note.note > 127) continue
      const hold = `clip:${++held}`
      const strength = r.voice?.(note.note, strike.beat)?.strength ?? strike.amplitude
      ons.push({kind: 'on', channel: MIDI_CHANNEL, note: note.note, velocity: Math.max(1, Math.min(127, Math.round(strength * 127)))})
      r.outs.set(hold, note.note)
      endAt(r, timeOf(r, note.end), hold)
    }
    if (ons.length) owners.midi(ons, soundsIn(r.origin, r.lead, seconds))
  }
  /** Ms from now until the moment `seconds` from a clip's start sounds: its anchor stands one owner lookahead past the page's clock at
   * `origin`. */
  const soundsIn = (origin: number, lead: number, seconds: number) => (origin + lead + seconds - owners.now()) * 1000

  /** The run ends: no timer, no watch, and every note it holds let go at once; a take frozen on its part that has not ended is let go with
   * it, as Live stops a frozen clip; and the turn of the Torus its take held is given back. */
  const halt = () => {
    haltCourse()
    unautomate()
    const was = run
    run = null
    if (!was) return
    if (was.frozen && owners.now() - was.origin < was.frozen.seconds) void was.frozen.unfreeze()
    was.frozen = null
    if (was.timer !== null) owners.cancel(was.timer)
    was.timer = null
    was.unwatch()
    const holds = was.ends.flatMap(ending => ending.holds)
    was.ends.length = 0
    letGo(was, holds)
  }
  /** The holds let go, `sounds` ms from now (none: at once): a frozen take's as MIDI note-offs, the rest on the playing path. */
  const letGo = (r: Run, holds: readonly string[], sounds?: number) => {
    const offs: MidiOutMessage[] = [], path: string[] = []
    for (const hold of holds) {
      const note = r.outs.get(hold)
      if (note === undefined) { path.push(hold); continue }
      r.outs.delete(hold)
      offs.push({kind: 'off', channel: MIDI_CHANNEL, note, velocity: 0})
    }
    if (offs.length) owners.midi?.(offs, sounds)
    if (path.length) owners.release(path, sounds)
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
      if (ending && ending.at <= seconds && ending.at <= now + DUE_EARLY_SECONDS) {
        r.ends.shift()
        letGo(r, ending.holds, soundsIn(r.origin, r.lead, ending.at))
        continue
      }
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

  /** A take's course ends: no timer, and every key it holds let go at once. Whatever of the player's ends here (every halt comes this way),
   * the turn of the Torus its take held is given back. */
  const haltCourse = () => {
    letTurnGo()
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
        if (holds.length) owners.release(holds, soundsIn(c.origin, c.lead, next.seconds))
      } else if (act.action === 'strike') {
        if (behind) { late += act.keys.length; continue }
        const notes: ClipHold[] = act.keys.map(key => {
          const hold = `take:${++held}`, id = `${key.row}/${key.column}`
          c.holds.set(id, [...(c.holds.get(id) ?? []), hold])
          return {hold, note: c.noteOf?.(key) ?? -1, key}
        })
        owners.strike(notes, act.amplitude, next.at, soundsIn(c.origin, c.lead, next.seconds)).then(answer, failed)
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
    lead: number, at: number | undefined) => {
    const shift = BigInt(exact.landed) - BigInt(exact.from)
    const seconds = (sample: bigint) => Number(sample - timing.anchor) / timing.rate
    const acts = exact.acts.map(act => { const at = BigInt(act.at_samples_elapsed) + shift; return {seconds: seconds(at), at: String(at), act} })
    const moves = [...(take.moves ?? [])].filter(moving).sort((a, b) => a.beat - b.beat)
    const start = seconds(BigInt(exact.landed))
    const c: Course = {address, origin: owners.now(), timing, spb: 60 / bpm, lead, acts, index: 0, moves, move: 0, start, end: start + exact.frames / exact.sample_rate,
      holds: new Map(), noteOf: exact.noteOf, timer: null, fire: () => fireCourse(c)}
    course = c
    // The holder's course rang from here: a take frozen while it holds lands on it (O-I #849 round 23).
    turned?.turn.ring?.(turned.name, BigInt(exact.landed))
    automate({address, name, ...(at === undefined ? {} : {at})}, moves, exact.acts.flatMap(act => act.action === 'set'
      ? [{beat: Number(BigInt(act.at_samples_elapsed) - BigInt(exact.from)) / exact.sample_rate / c.spb, edit: {kind: 'torus', edit: act.edit} as InstrumentEdit}] : []))
    publish({starting: false, playing: {address, name, bpm}})
    armCourse(c)
  }

  /** A clip begins: `delay` seconds after now on the page's clock its start lands at `timing.anchor` (later than the earliest it could
   * by the delay, where a launch quantize put it). */
  const begin = (address: ClipAddress, bpm: number, plan: Extract<ClipPlan, {ok: true}>, timing: Extract<ClipTiming, {anchor: bigint}>,
    take: ClipPrepared | null, lead: number, delay: number, at: number | undefined) => {
    // A frozen take makes none of its moves: they are in its sound.
    const frozen = take?.frozen ?? null
    const moves = frozen ? [] : [...(take?.moves ?? [])].filter(moving).sort((a, b) => a.beat - b.beat)
    const first = moves.findIndex(move => move.beat >= plan.first.from)
    const r: Run = {address, spb: 60 / bpm, origin: owners.now() + delay, timing, voice: take?.voice ?? null, moves, move: first < 0 ? moves.length : first, lead,
      plan, pass: plan.first, passStart: 0, index: 0, ends: [], timer: null,
      unwatch: () => {}, fire: () => fire(r), turn: () => turn(r), frozen, outs: new Map()}
    run = r
    turned?.turn.ring?.(turned.name, null)
    const playing = {address, name: plan.name, ...(at === undefined ? {} : {at}), ...(plan.again ? {loop: {start: plan.first.from, from: plan.again.from, to: plan.again.to}}
      : plan.first.from !== 0 ? {start: plan.first.from} : {})}
    if (frozen) {
      bake(playing, frozen)
      // Frozen at the sample its clip lands at; refused, it plays its notes on the live Torus from here, and says so.
      void frozen.land(timing.anchor).then(words => {
        if (words === null || r !== run || r.frozen !== frozen) return
        r.frozen = null
        unautomate()
        publish({resumes: words})
      })
    } else automate(playing, moves, [])
    r.unwatch = owners.watch(address, () => retake(r))
    publish({starting: false, playing: {address, name: plan.name, bpm}})
    arm(r)
  }

  return {
    state: () => state,
    heard() {
      const name = state.playing?.name ?? ''
      // A take's course: from where the Torus rang again, once, for as long as the course lasts.
      if (course) return {address: course.address, name, heard: course.origin + course.lead + course.start, spb: course.spb,
        first: {from: 0, to: (course.end - course.start) / course.spb}, again: null}
      if (!run) return null
      const {plan} = run
      return {address: run.address, name: plan.name, heard: run.origin + run.lead, spb: run.spb, first: {from: plan.first.from, to: plan.first.to},
        again: plan.again ? {from: plan.again.from, to: plan.again.to} : null}
    },
    launched: () => launch,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    play(address, bpm, land, grid, turn) {
      launch = {address, n: ++launches}
      halt()
      const mine = ++press
      if (!finite(bpm) || bpm <= 0) { publish({...IDLE, fault: 'The set discloses no tempo, so the clip has no time to play in.'}); return }
      publish({...IDLE, starting: true})
      owners.read(address).then(clip => {
        if (mine !== press) return
        const plan = clipPlan(clip)
        if (!plan.ok) { publish({starting: false, fault: plan.reason}); return }
        // A take's Torus is set again first; the owner's clock is read last, so the clip's anchor stands on the sound the owner has
        // rendered as the clip begins. The turn of the Torus the take takes is the player's to give back as the take ends.
        let take: ClipPrepared | null = null
        const ours: ClipTorusTurn | undefined = turn && {take: name => {
          const holder = turn.take(name)
          if (holder === null && mine === press) turned = {turn, name}
          else if (holder === null) turn.release?.(name)
          return holder
        }}
        /** Where the holder's course rang from, for a frozen take to land on (O-I #849 round 23). */
        let course: bigint | null = null
        const prepared: Promise<ClipPrepared | null> = owners.prepare
          ? owners.prepare(clip, bpm, ours, address).catch((cause: unknown) => ({resumes: `The take's Torus was not set again: ${said(cause)}`}))
          : Promise.resolve(null)
        return prepared.then(ready => {
          if (mine !== press) return
          take = ready
          const resumes = ready?.resumes ?? null
          if (resumes !== state.resumes) publish({resumes})
          // A frozen take lands on its holder's course: it waits for the holder to say where that rang from, then reads the clock.
          if (ready?.frozen && turn?.rung) return turn.rung().then(at => { course = at; return mine === press ? owners.clock() : undefined })
          return owners.clock()
        }).then(clock => {
          if (mine !== press || clock === undefined) return
          const timing = clipTiming(clock)
          const exact = (take as ClipPrepared | null)?.exact
          // Where the clip's beat `from` stands on the launch grid, in its beats from where the grid began, once it begins at `sample`. The
          // grid's beat 0 is where its first launch landed: Live's insert marker would stand there instead (LiveSet/Transport/CurrentTime,
          // LOM Song.current_song_time; corpus racks-session-model.md §3.3), and live-set parses no CurrentTime yet (DLW build ruling
          // 2026-11-05: "otherwise leave beat 0 at the grid origin and note where it would come from").
          const onGrid = (sample: bigint, from: number) => {
            grid?.began(sample)
            const origin = grid?.origin() ?? null
            return origin === null || !('rate' in timing) ? undefined : Number(sample - origin) / timing.rate * (bpm / 60) - from
          }
          // A press that does not begin gives back the turn its take took.
          const fault = (words: string) => { letTurnGo(); publish({starting: false, fault: words}) }
          if ('refused' in timing) fault(timing.refused)
          else if (exact && exact.sample_rate !== clock.sample_rate)
            fault(`The torus renders at ${clock.sample_rate} Hz, and the take was played at ${exact.sample_rate} Hz.`)
          else if (exact) beginCourse(address, bpm, plan.name, timing, take!, exact, clock.lookahead_seconds, onGrid(BigInt(exact.landed), 0))
          else {
            // Where the launch lands: never sooner than a note can still land at its sample (the owner's slack before the anchor). A frozen
            // take lands on its holder's course, where the engine plays its sound from as it then stands, though that be past.
            const frozen = (take as ClipPrepared | null)?.frozen
            const landed = land ? land(clip, timing, frozen && course !== null ? course : undefined) : timing.anchor
            const soonest = timing.anchor - BigInt(Math.floor(timing.slack * timing.rate))
            const anchor = landed >= soonest || (frozen && course !== null) ? landed : timing.anchor
            begin(address, bpm, plan, {...timing, anchor}, take, clock.lookahead_seconds, Number(anchor - timing.anchor) / timing.rate,
              onGrid(anchor, plan.first.from))
          }
        }, cause => { if (mine === press) { letTurnGo(); publish({starting: false, fault: `The torus did not read its audio clock: ${said(cause)}`}) } })
      }, cause => { if (mine === press) publish({starting: false, fault: `The set's owner did not read the clip: ${said(cause)}`}) })
    },
    stop() {
      press++
      launch = null
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
    async unfreeze() {
      const r = run, frozen = r?.frozen
      if (!r || !frozen) return {ok: false, error: 'No take plays frozen on this part.'}
      // The engine lets the take go first; until it has, the part still sounds it, and no note of it strikes the live Torus.
      const refused = await frozen.unfreeze()
      if (refused !== null) return {ok: false, error: refused}
      if (r === run && r.frozen === frozen) {
        r.frozen = null
        unautomate()
        publish({resumes: frozen.unfrozen})
      }
      return {ok: true, note: frozen.unfrozen}
    },
  }
}

// ── the candidate's player, and Live's transport over it ────────────────────

/** Whether a take of the set at `path` can be frozen on its part: the native candidate's engine plays that set. */
const engineFreezes = (path: string): boolean => {
  const reading = liveEngineState().reading
  return detectTransport().kind === 'tauri' && reading?.path === path && reading.playing
}

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
    // A held take is frozen on its part where the engine plays its set (O-I #849 round 22).
    prepare: (clip, bpm, turn, address) => prepareTake(clip, commitLiveInstrumentEdit,
      {stage: commitLiveStage, bpm, ...(address && engineFreezes(address.path) ? {frozen: partFreeze(address)} : {})}, turn, () => torusKept(liveTorusState())),
    clock: () => readAudioClock(commitLiveStage),
    edit: (edit, at) => commitLiveStage({command: 'instrument', edit, ...(at === undefined ? {} : {at_samples_elapsed: at})}),
    set: writeMapTarget,
    strike: (notes, amplitude, at, sounds) => livePlayingPath().clipStrike(notes, amplitude, at, sounds),
    touch: (points, amplitude, at) => commitLiveStage({command: 'strike-at', points: [...points], amplitude, at_samples_elapsed: at}),
    singlet: (codon, amplitude, at) => commitLiveStage({command: 'singlet', codon, amplitude, at_samples_elapsed: at}),
    release: (holds, sounds) => livePlayingPath().clipRelease(holds, sounds),
    // A frozen take's notes leave through the host's MIDI out as the keys' do (keyboardLayout.ts midiOut).
    midi: (messages, afterMs) => sendLiveMidiOut(messages, undefined, afterMs),
    watch: (address, changed) => subscribeSet(address.path, changed),
    now: () => performance.now() / 1000,
    later: (run, ms) => setTimeout(run, ms),
    cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
    random: () => Math.random(),
    hand: liveHandMoves,
    label: parameter => readMapTargets().find(target => target.id === parameter)?.label,
  }
}

/** Tell `moved` the map parameters each hand move writes: an instrument edit the owner took, sent BY_HAND, and a session-held value the
 * hand moved (the Scale tie: noteDeviceHold.ts, DLW build ruling 2026-11-05). Returns the unsubscribe. */
export function liveHandMoves(moved: (parameters: readonly string[]) => void): () => void {
  const owner = subscribeAcceptedLiveWrites((command, how) => { if (how.hand && command.command === 'instrument') moved(mapTargetIdsOfEdit(command.edit)) })
  const held = subscribeHeldHandMoves(moved)
  return () => { owner(); held() }
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

/** What a row holds on one track (O-I #743): a clip, MIDI or audio, by its name; or an empty slot that keeps its stop button, which stops
 * the track when the row launches. An empty slot whose stop was removed is not of the row: "A row launches only what is in it" (§21.1). */
export type RowSlot = {readonly track: number; readonly name: string; readonly kind: 'midi' | 'audio'} | {readonly track: number; readonly kind: 'stop'}

/** Launch, Stop and Stop all as the set's acts (manual §10.9: a clip's Launch and Stop, an empty slot's Stop the track, the Main track's
 * Stop all clips; §21.2 "Play | Plays the clips of the part on the torus"). Launch runs the player's Play on the clip it names and answers
 * as the transport's Play would: refused before it plays where the torus cannot take it or the set has no tempo, else once the owner has
 * read the clip, in the player's words. A row's launch plays every MIDI clip of the row together, each on its own track's player (O-I
 * #743). Each launch lands on the launch grid where its quantize says (`quantize`: the set's, for a clip set to Global). Stop the track
 * stops the clip that plays where it stands on that track; Stop all stops whatever plays. */
export interface ClipLaunchActs {
  /** `bar`: the set's bar in beats (shell/document.ts barBeats), what a quantize of bars counts; four where it is not given. */
  launch(address: ClipAddress, bpm: number, quantize?: string | null, bar?: number): Promise<ClipActAnswer>
  /** Launch row `row` (0-based) of the set at `path`: what it holds on each track. */
  launchRow(path: string, row: number, bpm: number, slots: readonly RowSlot[], quantize?: string | null, bar?: number): Promise<ClipActAnswer>
  stop(path: string, track: number, named: string): ClipActAnswer
  stopAll(): ClipActAnswer
  /** Re-enable (O-I #853): an overridden parameter, or every one, back to the take's lanes: on every player that holds it off its take's
   * lanes (O-I #849 round 21), in the set's own player's words where none or one does. */
  reenable(parameter?: string): Promise<ClipActAnswer>
  /** Unfreeze (O-I #849 round 22): the take frozen on `track` of the set at `path` let go, the part's live Torus heard again. */
  unfreeze(path: string, track: number): Promise<ClipActAnswer>
  /** The lanes' standing over every player, one reading while none moves (O-I #849 round 21). */
  lanes(): ClipLanesStanding
  /** Where the clip that plays on `track` of the set at `path` is heard (G13): the set's own player's, else the row's; null when none plays. */
  heard(path: string, track: number): ClipHeard | null
  /** The latest press of Launch on `track` of the set at `path`, on the set's own player or the row's; null when neither was pressed for it
   * since it last stopped. */
  launched(path: string, track: number): ClipLaunch | null
  /** Hear every player, a row's players made later among them. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void
}

/** How long Launch waits for the set's owner to read the clip before it answers that it is reading it. */
const LAUNCH_ANSWER_MS = 4000
/** The launch quantize of a set that keeps none: the bar, as the corpus's one set keeps it (racks-session-model.md §3.3, GlobalQuantisation 4). */
export const SET_QUANTIZE = '1 bar'
/** The words of the set's own Quantize, in Live's GlobalQuantisation order (packages/live-set edit.rs QUANTIZE after its Global, a clip's). */
export const SET_QUANTIZE_WORDS: readonly string[] = Object.freeze(['none', '8 bars', '4 bars', '2 bars', '1 bar', '1/2', '1/2t', '1/4', '1/4t', '1/8',
  '1/8t', '1/16', '1/16t', '1/32'])

const listed = (names: readonly string[]) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

/** The answer of a player's Play of the clip at `address`: once the owner has read it, in the player's words; that it is reading it, if
 * the owner takes longer than LAUNCH_ANSWER_MS. Heard from once the press is made: what the player says as it lets go of what played
 * before (a take's lanes ending) is not the press's answer. */
function played(player: ClipPlayer, address: ClipAddress, start: () => void): Promise<ClipActAnswer> {
  const same = (a: ClipAddress, b: ClipAddress) => a.path === b.path && a.track === b.track && JSON.stringify(a.at) === JSON.stringify(b.at)
  return new Promise(resolve => {
    let settled = false
    let off = () => {}
    const finish = (answer: ClipActAnswer) => { if (settled) return; settled = true; off(); clearTimeout(timer); resolve(answer) }
    const settle = () => {
      const state = player.state()
      if (state.starting) return
      if (state.playing && same(state.playing.address, address)) finish({ok: true, note: `${state.playing.name || 'The clip'} plays on the torus.`})
      else finish({ok: false, error: state.fault ?? 'The clip did not play.'})
    }
    const timer = setTimeout(() => finish({ok: true, note: 'Reading the clip from the set…'}), LAUNCH_ANSWER_MS)
    start()
    if (!settled) off = player.subscribe(settle)
    settle()
  })
}

/** The set's acts over its one clip player and, for a row's launch, a player of each track (`rowPlayer`, made once for each track). */
export function clipLaunchActs(player: ClipPlayer, torus: () => LiveTorusState | null, rowPlayer?: (track: number) => ClipPlayer): ClipLaunchActs {
  const rows = new Map<number, ClipPlayer>()
  /** The launch grid's origin on the owner's clock: where the first launch landed while nothing played. */
  let origin: bigint | null = null
  const grid: ClipGrid = {origin: () => origin, began: at => { if (origin === null) origin = at }}
  /** One Torus rings at a time: the first take to set it again holds it until it ends, whichever launch played it (DLW build ruling
   * 2026-11-05), and every take launched meanwhile is held, a row's or one launched alone. */
  const turn = torusTurn()
  /** The set's own player, then a row's by track. */
  const players = () => [player, ...[...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row)]
  const listeners = new Set<() => void>()
  const heard = () => { for (const listener of [...listeners]) listener() }
  player.subscribe(heard)
  /** The track's row player, made once and heard from then on. */
  const rowOf = (track: number, made: (track: number) => ClipPlayer) => {
    const known = rows.get(track)
    if (known) return known
    const own = made(track)
    rows.set(track, own)
    own.subscribe(heard)
    return own
  }
  let lanesRead: {readonly from: readonly ClipLaneStanding[]; readonly value: ClipLanesStanding} | null = null
  const lanes = (): ClipLanesStanding => {
    const from = players().map(each => each.state().lanes)
    if (lanesRead && lanesRead.from.length === from.length && lanesRead.from.every((standing, i) => standing === from[i])) return lanesRead.value
    const value: ClipLanesStanding = Object.freeze({automated: Object.freeze([...new Set(from.flatMap(standing => standing.automated))]),
      overridden: Object.freeze([...new Set(from.flatMap(standing => standing.overridden))]),
      takes: Object.freeze(from.flatMap(standing => standing.take && standing.lanes ? [Object.freeze({take: standing.take, lanes: standing.lanes})] : []))})
    lanesRead = {from, value}
    return value
  }
  const sounding = () => players().some(p => { const state = p.state(); return state.playing !== null || state.starting })
  /** Where a launch lands: on its clip's own quantize, Global the set's; a row's clips at one earliest, where each could land by then. */
  const landing = (bpm: number, quantize: string | null | undefined, bar: number | undefined, row?: {earliest: bigint | null}): ClipLanding => (clip, timing, course) => {
    const own = quantumBeats(clip.quantize ?? 'global', bar)
    const beats = own !== undefined ? own : quantumBeats(quantize ?? SET_QUANTIZE, bar) ?? null
    // A frozen take lands on its holder's course (O-I #849 round 23): within the course's first step (a row launched with it), at its first
    // sample; later, at the course's next step; with no quantize, as soon as it can.
    if (course !== undefined) {
      const step = beats === null ? null : beats * (60 / bpm) * timing.rate
      return step === null ? timing.anchor : Number(timing.anchor - course) < step ? course : landAt(timing.anchor, course, step)
    }
    let earliest = timing.anchor
    if (row) {
      if (row.earliest === null) row.earliest = earliest
      else if (earliest >= row.earliest && earliest - row.earliest <= BigInt(Math.floor(timing.slack * timing.rate))) earliest = row.earliest
    }
    if (origin === null) origin = earliest
    return landAt(earliest, origin, beats === null ? null : beats * (60 / bpm) * timing.rate)
  }
  /** Stop what plays on `track` of the set at `path`: its own clip player's clip there, and the row's. */
  const stopTrack = (path: string, track: number) => {
    const state = player.state()
    if (state.playing && state.playing.address.path === path && state.playing.address.track === track) player.stop()
    rows.get(track)?.stop()
  }
  return {
    launch(address, bpm, quantize, bar) {
      const why = !(bpm > 0) ? NO_TEMPO : torusRefusal(torus())
      if (why) return Promise.resolve({ok: false, error: why})
      if (!sounding()) origin = null
      rows.get(address.track)?.stop()
      return played(player, address, () => player.play(address, bpm, landing(bpm, quantize, bar), grid, turn))
    },
    async launchRow(path, row, bpm, slots, quantize, bar) {
      const named = `Row ${row + 1}`
      const why = !(bpm > 0) ? NO_TEMPO : torusRefusal(torus())
      if (why) return {ok: false, error: why}
      if (!rowPlayer) return {ok: false, error: `${named} cannot launch here: this player plays one clip at a time.`}
      const clips = slots.filter((slot): slot is Extract<RowSlot, {name: string}> => slot.kind !== 'stop')
      const midi = clips.filter(slot => slot.kind === 'midi')
      // A slot's clip is a MIDI clip or an audio clip (RowSlot): what is not MIDI is audio.
      const audio = clips.filter(slot => slot.kind !== 'midi')
        .map(slot => ` ${slot.name || 'A clip'} is an audio clip, which the engine plays where it lies in the Arrangement, not from a slot.`).join('')
      if (!midi.length) return {ok: false, error: `${named} holds no MIDI clip to play on the torus.${audio}`}
      if (!sounding()) origin = null
      // What the row holds on a track takes its place there; its empty slot's stop stops it.
      for (const slot of slots) stopTrack(path, slot.track)
      const together = {earliest: null as bigint | null}
      const answers = await Promise.all(midi.map(slot => {
        const own = rowOf(slot.track, rowPlayer)
        const address: ClipAddress = {path, track: slot.track, at: {slot: row}}
        return played(own, address, () => own.play(address, bpm, landing(bpm, quantize, bar, together), grid, turn))
      }))
      const playing = midi.filter((_, i) => answers[i]!.ok).map(slot => slot.name || 'a clip')
      const refused = midi.flatMap((slot, i) => { const answer = answers[i]!; return answer.ok ? [] : [`${slot.name || 'A clip'}: ${answer.error}`] })
      if (!playing.length) return {ok: false, error: `${named} played nothing on the torus. ${refused.join(' ')}${audio}`}
      return {ok: true, note: `${named} plays on the torus: ${listed(playing)}.${refused.length ? ` ${refused.join(' ')}` : ''}${audio}`}
    },
    stop(path, track, named) {
      const state = player.state()
      const own = state.playing ? state.playing.address.path === path && state.playing.address.track === track : state.starting
      const row = rows.get(track)?.state()
      const name = (own ? state.playing?.name : row?.playing?.name) || 'The clip'
      if (!own && !row?.playing && !row?.starting) return {ok: true, note: `Nothing plays on ${named}.`}
      if (own) player.stop()
      rows.get(track)?.stop()
      return {ok: true, note: `${name} stops; what it struck rings out on the torus.`}
    },
    stopAll() {
      if (!sounding()) return {ok: true, note: 'Nothing plays.'}
      for (const each of players()) each.stop()
      return {ok: true, note: 'Every clip stops; what was struck rings out on the torus.'}
    },
    async reenable(parameter) {
      const holding = players().filter(each => { const held = each.state().lanes.overridden; return parameter === undefined ? held.length > 0 : held.includes(parameter) })
      if (holding.length < 2) return (holding[0] ?? player).reenable(parameter)
      const answers = await Promise.all(holding.map(each => each.reenable(parameter)))
      const errors = answers.flatMap(answer => answer.ok ? [] : [answer.error]), notes = answers.flatMap(answer => answer.ok ? [answer.note] : [])
      return errors.length ? {ok: false, error: [...new Set(errors)].join(' ')} : {ok: true, note: [...new Set(notes)].join(' ')}
    },
    async unfreeze(path, track) {
      const own = (each: ClipPlayer) => { const at = each.state().playing?.address; return at?.path === path && at.track === track }
      const playing = players().find(own)
      return playing ? playing.unfreeze() : {ok: false, error: 'No take plays frozen on this part.'}
    },
    lanes,
    heard(path, track) {
      for (const each of [player, rows.get(track)]) {
        const heard = each?.heard() ?? null
        if (heard && heard.address.path === path && heard.address.track === track) return heard
      }
      return null
    },
    launched(path, track) {
      let latest: ClipLaunch | null = null
      for (const each of [player, rows.get(track)]) {
        const launch = each?.launched() ?? null
        if (launch && launch.address.path === path && launch.address.track === track && (!latest || launch.n > latest.n)) latest = launch
      }
      return latest
    },
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}

/** The candidate's Launch and Stop: its one clip player, a player of each track for a row's launch, and the torus's owner reading. */
export const liveClipActs: ClipLaunchActs = clipLaunchActs(liveClipPlayer, liveTorusState, () => createClipPlayer(candidateOwners()))

/** The clip that plays on part `track` of the set at `path` (G13), by its name, as the players hear it: Record on that part, armed,
 * overdubs into it (liveTake.ts). Null while none plays there. */
export function useLiveOverdub(path: string | null, track: number | null): {readonly name: string} | null {
  const name = useSyncExternalStore(liveClipActs.subscribe,
    () => path && track !== null ? liveClipActs.heard(path, track)?.name ?? null : null, () => null)
  return useMemo(() => name === null ? null : {name: name || 'the clip'}, [name])
}

/** Live's Play and Stop: the clip THE selection names, played on the torus at the set's tempo. Leaving Live's transport stops it. */
export function useLiveClipPlay(selection: WorldSelection | undefined, tempoBpm: number | null): TransportBindings {
  const state = useSyncExternalStore(liveClipPlayer.subscribe, liveClipPlayer.state, liveClipPlayer.state)
  const torus = useLiveTorusReading()
  useEffect(() => () => liveClipPlayer.stop(), [])
  // The keys a clip strikes are the owner's window (janko/jankoInput.ts): Live's transport stands in every view, so it follows the window
  // for the instrument's lens, and a row launched in Session view finds its keys with no keyboard surface mounted (G4).
  const lens = jankoLensOf(torus)
  useEffect(() => { void followLiveJankoWindow(lens) }, [lens])
  return clipPlayBindings({address: clipAddressOf(selection), title: selection?.title ?? null, bpm: tempoBpm, torus, state,
    play: liveClipPlayer.play, stop: liveClipPlayer.stop})
}
