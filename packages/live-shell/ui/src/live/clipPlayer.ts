// Live plays a clip (O-I #790). DLW §21.2 Views: "In Clip view, the Torus plays the notes of the clip that you select"; §21.2 Transport:
// "Play | Plays the clips of the part on the torus"; "What strikes the Torus": "A note in a clip | Its key's point, as the clip plays".
//
//   the notes   the clip THE selection names, read whole from the set's owner (kernel live_clip_read, packages/live-set/src/edit.rs
//               clip_reading; the read is live/liveWrites.ts useLiveClipWhole's, made once per press): its notes {p, at, len, vel, chance,
//               on} in the clip's own beats, and its markers as edit.rs `markers` gives them. Nothing is played that the owner did not read.
//   the order   Live's: loop off, the clip plays from its start marker to its end, once; loop on, from its start marker to the loop's end,
//               then the loop (position to position + length) again and again. A switched-off note never sounds; a note's chance is
//               drawn each time it comes round, as Live draws it. An edit to the clip (a write, Live saving it) plays from the next pass.
//   the strike  until a key's point on its helix is ruled (MT1), each note-on strikes through the key path: the Jankó's own `janko` stage
//               command (live/janko/jankoInput.ts), its pitch class at velocity over 127, which the frame strikes as the owner's played
//               voices for that key (nativeField.ts playJanko). Keys struck together at one velocity are one act, as a chord is.
//               Nothing here synthesises a sound: a refusal is the owner's, named.
//   the time    each note-on's moment is measured from the press, at the set's tempo, on one monotonic clock: never summed from timers,
//               so a late wake never drifts the clip. The path that strikes allocates no plan and does no UI work: the passes are planned
//               when the clip is read, and the state the transport draws changes only on play, stop, a new refusal or a missed note.
//               A note-on later than CLIP_MISSED_AFTER_SECONDS is let go and counted, never struck late in a burst (the owner's own
//               pump law: "never a catch-up burst", instrument-session.mjs pump).
// The owner strikes "now" (instrument-session.mjs strike and strikeAt take no time), so a note sounds behind the sound the owner has
// already scheduled, one presentation lookahead late, on the owner's block. Placing it on the owner's audio clock needs a strike at a
// sample cursor, which the owner does not take yet.
//
// Ported from: the store with its owners handed in (inhabitants/ql/devices/qlSitting.ts: now, later, cancel, its bell rung through
// commitLiveStage); the chord as one act (live/janko/jankoInput.ts flush); the clip's markers (packages/live-set/src/edit.rs markers).
import {useEffect, useSyncExternalStore} from 'react'
import type {StageCommand, StageResult} from '@epilogos/expressions-boundary'
import {detectTransport, kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {LiveClipAt, LiveClipReading} from '../../../../../desktop/cradle/src/kernel/types'
import type {WorldSelection} from '../../../../../desktop/cradle/src/workspace/store'
import type {SlotBinding, TransportBindings} from '../frame/transport/slots'
import {subscribeSet} from '../native/application'
import {setSelectionOf} from '../shell/liveSelection'
import {clipAtOf} from './liveWrites'
import {commitLiveStage, useLiveTorusReading, type LiveTorusState} from './torusInstrument'

/** A note-on this late (seconds) at its wake is let go and counted as missed rather than struck late. A quarter second: a wake that
 * late is a stalled thread, not a slow timer, and striking what it passed would burst its backlog at once. */
export const CLIP_MISSED_AFTER_SECONDS = 0.25
/** A timer may wake a hair before its moment; a strike due within this many seconds is struck at that wake. */
const DUE_EARLY_SECONDS = 0.002

export type JankoCommand = Extract<StageCommand, {command: 'janko'}>

/** One act of the clip: where it stands in the clip's own beats, and the strike it is. */
export interface ClipStrike {
  readonly beat: number
  /** The act: its keys' pitch classes, struck at the notes' velocity over 127. */
  readonly command: JankoCommand
  /** Each key's chance (Live's Probability), in the order of the act's keys; null when every key always sounds. */
  readonly chances: readonly number[] | null
}

/** One pass of the clip: its window in the clip's own beats, and its acts in time order. */
export interface ClipPass {readonly from: number; readonly to: number; readonly strikes: readonly ClipStrike[]}

/** The clip as Live plays it: its first pass, and the loop it repeats (null when its loop is off); or why it cannot play. */
export type ClipPlan =
  | {readonly ok: true; readonly name: string; readonly first: ClipPass; readonly again: ClipPass | null}
  | {readonly ok: false; readonly reason: string}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const refuse = (reason: string): ClipPlan => ({ok: false, reason})

/** The acts between `from` and `to`: each switched-on note with a velocity, grouped by its moment and its velocity. Pure. */
function clipPass(notes: NonNullable<LiveClipReading['notes']>, from: number, to: number): ClipPass {
  const sounding = notes.filter(note => note.on !== false && finite(note.vel) && note.vel > 0 && Number.isInteger(note.p) && note.p >= 0 && note.p <= 127
    && finite(note.at) && note.at >= from && note.at < to)
  const acts = new Map<string, {beat: number; vel: number; chance: Map<number, number>}>()
  for (const note of sounding) {
    const key = `${note.at}|${note.vel}`
    const act = acts.get(key) ?? {beat: note.at, vel: note.vel, chance: new Map<number, number>()}
    acts.set(key, act)
    const pc = note.p % 12, chance = finite(note.chance) ? Math.max(0, Math.min(1, note.chance)) : 1
    act.chance.set(pc, Math.max(act.chance.get(pc) ?? 0, chance))
  }
  const strikes = [...acts.values()].sort((a, b) => a.beat - b.beat || a.vel - b.vel).map(act => {
    const pitch_classes = [...act.chance.keys()].sort((a, b) => a - b)
    const chances = pitch_classes.map(pc => act.chance.get(pc)!)
    return {beat: act.beat, command: {command: 'janko', action: 'play', pitch_classes, amplitude: Math.min(1, act.vel / 127)} as JankoCommand,
      chances: chances.every(chance => chance >= 1) ? null : chances}
  })
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

/** What the player reaches: the set's owner, the torus's owner, and the clock. Tests hand in their own. */
export interface ClipPlayerOwners {
  /** The clip whole, from the set's owner; a refusal throws in the owner's words. */
  readonly read: (address: ClipAddress) => Promise<LiveClipReading>
  /** One strike through the torus's owner, settling with its answer. */
  readonly strike: (command: StageCommand) => Promise<StageResult>
  /** Tell `changed` when the set the clip stands in is read again (a write, Live saving it). Returns the unsubscribe. */
  readonly watch: (address: ClipAddress, changed: () => void) => () => void
  /** The clock, in seconds: monotonic. */
  readonly now: () => number
  readonly later: (run: () => void, ms: number) => unknown
  readonly cancel: (handle: unknown) => void
  /** A draw in [0, 1), for a note's chance. */
  readonly random: () => number
}

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
}

export interface ClipPlayer {
  state(): ClipPlayState
  subscribe(listener: () => void): () => void
  /** Play the clip at `address` from its start marker at `bpm`; a clip already playing starts again. */
  play(address: ClipAddress, bpm: number): void
  /** Stop: nothing more strikes; what was struck rings out on the torus. */
  stop(): void
}

const IDLE: ClipPlayState = {playing: null, starting: false, refused: null, missed: 0, fault: null}
const said = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

interface Run {
  readonly address: ClipAddress
  /** Seconds per beat at the tempo the clip plays at. */
  readonly spb: number
  plan: Extract<ClipPlan, {ok: true}>
  pass: ClipPass
  /** The clock's reading at the pass's first beat. */
  passStart: number
  /** The next act of the pass. */
  index: number
  timer: unknown
  unwatch: () => void
  readonly fire: () => void
  readonly turn: () => void
}

/** A clip player over its owners. */
export function createClipPlayer(owners: ClipPlayerOwners): ClipPlayer {
  let state: ClipPlayState = IDLE
  let run: Run | null = null
  /** The press in progress: a Stop or a later press makes an earlier read stale. */
  let press = 0
  const listeners = new Set<() => void>()
  const publish = (next: Partial<ClipPlayState>) => { state = {...state, ...next}; for (const listener of [...listeners]) listener() }

  const answer = (result: StageResult) => { if (!result.ok && result.error !== state.refused) publish({refused: result.error}) }
  const failed = (cause: unknown) => answer({ok: false, error: said(cause)})
  const missed = (count: number) => { if (count > 0) publish({missed: state.missed + count}) }

  const send = (strike: ClipStrike) => {
    let command: StageCommand = strike.command
    const chances = strike.chances
    if (chances) {
      const keys = strike.command.pitch_classes.filter((_, i) => chances[i]! >= 1 || owners.random() < chances[i]!)
      if (keys.length === 0) return
      command = {...strike.command, pitch_classes: keys}
    }
    owners.strike(command).then(answer, failed)
  }

  const halt = () => {
    const was = run
    run = null
    if (!was) return
    if (was.timer !== null) owners.cancel(was.timer)
    was.timer = null
    was.unwatch()
  }

  /** Wait for the pass's next act, or for its end. */
  const arm = (r: Run) => {
    const next = r.pass.strikes[r.index]
    const due = r.passStart + ((next ? next.beat : r.pass.to) - r.pass.from) * r.spb
    r.timer = owners.later(next ? r.fire : r.turn, Math.max(0, (due - owners.now()) * 1000))
  }

  /** Strike every act whose moment has come; one too late is let go. */
  const fire = (r: Run) => {
    if (r !== run) return
    r.timer = null
    const now = owners.now(), strikes = r.pass.strikes
    let late = 0
    while (r.index < strikes.length) {
      const strike = strikes[r.index]!
      const due = r.passStart + (strike.beat - r.pass.from) * r.spb
      if (due > now + DUE_EARLY_SECONDS) break
      r.index++
      if (now - due > CLIP_MISSED_AFTER_SECONDS) late++
      else send(strike)
    }
    missed(late)
    arm(r)
  }

  /** The pass ends: the loop comes round again, or the clip has played to its end. Loops a stall passed whole are skipped, their
   * note-ons missed. */
  const turn = (r: Run) => {
    if (r !== run) return
    r.timer = null
    const again = r.plan.again
    if (!again) { halt(); publish({playing: null}); return }
    r.passStart += (r.pass.to - r.pass.from) * r.spb
    r.pass = again
    r.index = 0
    const length = (again.to - again.from) * r.spb, now = owners.now()
    let late = 0
    while (r.passStart + length + CLIP_MISSED_AFTER_SECONDS < now) { late += again.strikes.length; r.passStart += length }
    missed(late)
    arm(r)
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

  const begin = (address: ClipAddress, bpm: number, plan: Extract<ClipPlan, {ok: true}>) => {
    const r: Run = {address, spb: 60 / bpm, plan, pass: plan.first, passStart: owners.now(), index: 0, timer: null, unwatch: () => {},
      fire: () => fire(r), turn: () => turn(r)}
    run = r
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
        if (!plan.ok) publish({starting: false, fault: plan.reason})
        else begin(address, bpm, plan)
      }, cause => { if (mine === press) publish({starting: false, fault: `The set's owner did not read the clip: ${said(cause)}`}) })
    },
    stop() {
      press++
      halt()
      if (state.playing !== null || state.starting) publish({playing: null, starting: false})
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
    strike: command => commitLiveStage(command),
    watch: (address, changed) => subscribeSet(address.path, changed),
    now: () => performance.now() / 1000,
    later: (run, ms) => setTimeout(run, ms),
    cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
    random: () => Math.random(),
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
  const notes = [state.fault, state.refused && `The torus refused a note: ${state.refused}`,
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

/** Live's Play and Stop: the clip THE selection names, played on the torus at the set's tempo. Leaving Live's transport stops it. */
export function useLiveClipPlay(selection: WorldSelection | undefined, tempoBpm: number | null): TransportBindings {
  const state = useSyncExternalStore(liveClipPlayer.subscribe, liveClipPlayer.state, liveClipPlayer.state)
  const torus = useLiveTorusReading()
  useEffect(() => () => liveClipPlayer.stop(), [])
  return clipPlayBindings({address: clipAddressOf(selection), title: selection?.title ?? null, bpm: tempoBpm, torus, state,
    play: liveClipPlayer.play, stop: liveClipPlayer.stop})
}
