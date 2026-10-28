// Technē's transport over the atlas's time (T-PLACES-ONTO-ATLAS; lane-4 T14–T16; manual §10.5 Technē column: Play "Walk", Stop "Stop
// the walk", Loop and punch "Mark the window of a past moment you stand in"; lock §7.1 "one shared time control … while a thread's
// walk stands, the one transport button serves it; the clock's own play yields", AE src/ui/time-control.ts:33).
//
// The frame's Places map had its own docked time control (psychogeographic/placeTimeControl.ts), which retires with the map. The
// atlas has one: its time control (ui/time-control.ts), bound to the session's shared window by the shared clock (sharedClock.ts) —
// never a second clock. Its button and its readings move here, to the one transport: Play presses the atlas's own button (the walk
// when one stands, else the Earth's clock, which writes the window's end as it plays, through the shared clock's commit), Stop pauses
// what plays, and punch-in and punch-out read the window's two edges. The scrubber stays the Deep time device (atlasFaceBodies.tsx).
//
// O-I #760: the World's own writes on the same transport (manual §10.5 Technē column: Arm "Let the instrument write", Record "Record a
// walk", Stop "Stop the walk", Capture "Keep the view as a scene"; §17.2 Transport: "Record — Records a walk. Each place you visit becomes
// a stop", "Capture — Keeps the present view as a scene"). Arm, Record and Capture press the World's walk (walks/walkSession.ts), which
// keeps a take or a view in the walk's Expression through its owner. While Record runs, Stop keeps the take; while a recorded take
// walks, Play and Stop are its own and the time signature reads which stop of how many; with a stop of a take selected, Play walks the
// take from it. Otherwise Play and Stop stay the atlas's time, above.
import {useEffect, useState, useSyncExternalStore} from 'react'
import type {SlotBinding, TransportBindings} from '../../../frame/transport/slots'
import {disclosureSession} from '../../../../../../../desktop/cradle/src/techne/session'
import type {WorldSelection} from '../../../../../../../desktop/cradle/src/workspace/store'
import {useAtlasHandle} from '../AtlasProjectionPanel'
import {windowEdgeYear} from '../sharedClock'
import {walkStopOfClip} from '../../../timeline/techneTrackAdapter'
import {takeWalkId} from '../walks/walkRecord'
import {WALK_NOT_ARMED, WALK_NOT_OPEN, walkSession, type WalkState} from '../walks/walkSession'

/** What the transport reads of the atlas's time: whether it stands, the walk that holds its button, and whether its clock plays. */
export interface AtlasTimeReading {
  readonly mounted: boolean
  readonly walk: {readonly playing: boolean} | null
  readonly clockPlaying: boolean
  press(): void
  pause(): void
}

/** The mounted atlas's time, re-read on its own notices (its clock, and the face notices a walk taking the button sends). */
export function useAtlasTime(): AtlasTimeReading {
  const handle = useAtlasHandle()
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!handle) return
    const bump = () => setTick(n => n + 1)
    const offClock = handle.time.subscribe(bump)
    const offFaces = handle.ctl.subscribeFaces(bump)
    return () => { offClock(); offFaces() }
  }, [handle])
  if (!handle) return {mounted: false, walk: null, clockPlaying: false, press: () => {}, pause: () => {}}
  const control = handle.ctl.timeControl
  const walk = control.walk
  return {
    mounted: true, walk: walk ? {playing: walk.playing} : null, clockPlaying: handle.time.playing,
    press: () => control.togglePlay(),
    pause: () => { if (walk ? walk.playing : handle.time.playing) control.togglePlay() },
  }
}

/** The session's shared window as the transport reads its edges. */
export function useSharedWindow(): {from: string | null; to: string | null} | null {
  return useSyncExternalStore(disclosureSession.subscribe, () => disclosureSession.get()?.time_window ?? null, () => null)
}

const NOT_MOUNTED = 'The Earth is not open in this session, so there is no clock or walk to play. Open Earth from the browser\'s Instruments.'

/** Technē's Play, Stop, punch-in and punch-out over the atlas's time. Pure over its readings, so the transport binding and the tests
 * read the same words. */
export function atlasTimeBindings(time: AtlasTimeReading, window: {from: string | null; to: string | null} | null): TransportBindings {
  const playing = time.walk ? time.walk.playing : time.clockPlaying
  const play: SlotBinding = !time.mounted
    ? {refused: NOT_MOUNTED}
    : {press: time.press, lit: playing,
      title: time.walk
        ? `Walk — ${playing ? 'pause' : 'resume'} the thread's walk that stands on the Earth (the atlas's one time button).`
        : `Walk — no walk stands, so the Earth's clock ${playing ? 'pauses' : 'plays'} through the window, writing the window's end as it goes (the shared clock).`}
  const stop: SlotBinding = !time.mounted ? {refused: NOT_MOUNTED}
    : playing ? {press: time.pause, title: `Stop — pause the ${time.walk ? 'walk' : 'Earth\'s clock'} where it stands.`}
      : {refused: 'Nothing plays, so there is nothing to stop.'}
  const from = window ? windowEdgeYear(window.from) : null, to = window ? windowEdgeYear(window.to) : null
  const edge = (year: number | null, open: string, which: string): SlotBinding => ({readout: {
    value: !window ? '—' : year === null ? open : String(year),
    title: !window ? `Window · ${which} — no window stands: every pane shows all time.` : `Window · ${which} — the shared session's window, ${window.from ?? 'open'} to ${window.to ?? 'open'}.`,
  }})
  return {play, stop, 'punch-in': edge(from, 'open', 'from'), 'punch-out': edge(to, 'open', 'to')}
}

/** The bindings the Technē transport adds for the atlas's time. */
export function useAtlasTimeBindings(): TransportBindings {
  return atlasTimeBindings(useAtlasTime(), useSharedWindow())
}

// ── the World's walk (O-I #760) ──────────────────────────────────────────

/** A stop of a recorded take, as THE selection names it. */
export interface SelectedWalkStop {walkId: string; index: number; name: string}

/** The acts the walk's slots press (walks/walkSession.ts). */
export interface WalkActs {
  arm(on: boolean): void
  record(): void
  stop(): void
  capture(): void
  play(walkId: string, from: number): string | null
  halt(): void
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** Technē's Arm, Record and Capture over the World's walk, and Play, Stop and the time signature while it records or walks. Pure over the
 * walk's reading, so the binding and the tests read the same words. Slots it does not take are absent: the atlas's time serves them. */
export function walkBindings(state: WalkState, acts: WalkActs, selected: SelectedWalkStop | null): TransportBindings {
  const said = state.line ? ` ${state.line}` : ''
  if (!state.bound) {
    const refused = {refused: WALK_NOT_OPEN}
    return {arm: refused, record: refused, capture: refused}
  }
  const busy = state.busy ? 'The walk\'s owner is still answering the last act.' : null
  const recording = state.recording
  const bindings: TransportBindings = {
    arm: recording ? {lit: true, refused: 'Arm holds while Record runs: press Stop to keep the take, then disarm.'}
      : {press: () => acts.arm(!state.armed), lit: state.armed,
        title: state.armed ? `Instrument writes — armed: Record writes a walk into its Expression. Press to disarm.${said}` : `Instrument writes — let the World write: armed, Record keeps a walk.${said}`},
    record: recording ? {press: acts.stop, lit: true, title: `Record — recording: ${plural(recording.stops.length, 'stop', 'stops')} so far, each a place you visited. Press to stop and keep the take.${said}`}
      : busy ? {refused: busy}
      : !state.armed ? {refused: WALK_NOT_ARMED}
      : {press: acts.record, lit: false, title: `Record — record a walk: each place you visit on the World becomes a stop, and Stop keeps it as a take.${said}`},
    capture: busy ? {refused: busy}
      : {press: acts.capture, title: `Capture — keep the present view as a Scene of the walk${recording ? ', and a stop of the take that carries it' : ''}.${said}`},
  }
  if (recording) {
    bindings.stop = {press: acts.stop, title: `Stop — stop recording and keep the take of ${plural(recording.stops.length, 'stop', 'stops')}.`}
    bindings.signature = {readout: {value: `${recording.stops.length}/${recording.stops.length}`, title: `Stop n/N — recording: stop ${recording.stops.length} is the last you visited.`}}
    return bindings
  }
  const playing = state.playing
  if (playing) {
    bindings.play = {press: acts.halt, lit: true, title: `Walk — the recorded walk is walking, stop ${playing.index + 1} of ${playing.total}; press to stop it there.`}
    bindings.stop = {press: acts.halt, title: `Stop — stop the walk at stop ${playing.index + 1}.`}
    bindings.signature = {readout: {value: `${playing.index + 1}/${playing.total}`, title: `Stop n/N — stop ${playing.index + 1} of ${playing.total} of the recorded walk.`}}
    return bindings
  }
  if (selected) {
    bindings.play = {press: () => { acts.play(selected.walkId, selected.index) }, lit: false,
      title: `Walk — walk ${selected.name} from stop ${selected.index + 1}: each stop stands on the World and holds for its pace.`}
  }
  return bindings
}

/** The recorded take a selection stands on: a stop's clip of a take the walk keeps. */
export function selectedWalkStop(state: WalkState, selection: Pick<WorldSelection, 'kind' | 'ref'> | null | undefined): SelectedWalkStop | null {
  if (!selection || selection.kind !== 'clip' || state.reading.phase !== 'read') return null
  const stop = walkStopOfClip(selection.ref)
  const take = stop ? state.reading.walk.takes.find(row => takeWalkId(row.name) === stop.walkId) : undefined
  return stop && take && stop.index < take.stops.length ? {walkId: stop.walkId, index: stop.index, name: take.name} : null
}

const WALK_ACTS: WalkActs = {
  arm: on => walkSession.arm(on),
  record: () => walkSession.record(),
  stop: () => { void walkSession.stop() },
  capture: () => { void walkSession.capture() },
  play: (walkId, from) => walkSession.play(walkId, from),
  halt: () => walkSession.halt(),
}

/** The bindings the Technē transport adds for the World's walk, with THE selection a take's stop may stand on. */
export function useWalkBindings(selection: Pick<WorldSelection, 'kind' | 'ref'> | null | undefined): TransportBindings {
  const state = useSyncExternalStore(walkSession.subscribe, walkSession.get, walkSession.get)
  return walkBindings(state, WALK_ACTS, selectedWalkStop(state, selection))
}
