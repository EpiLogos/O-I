// Technē's transport over the atlas's time (T-PLACES-ONTO-ATLAS; lane-4 T14–T16; manual §10.5 Technē column: Play "Walk", Stop "Stop
// the walk", Loop and punch "Mark the window of a past moment you stand in"; lock §7.1 "one shared time control … while a thread's
// walk stands, the one transport button serves it; the clock's own play yields", AE src/ui/time-control.ts:33).
//
// The frame's Places map had its own docked time control (psychogeographic/placeTimeControl.ts), which retires with the map. The
// atlas has one: its time control (ui/time-control.ts), bound to the session's shared window by the shared clock (sharedClock.ts) —
// never a second clock. Its button and its readings move here, to the one transport: Play presses the atlas's own button (the walk
// when one stands, else the Earth's clock, which writes the window's end as it plays, through the shared clock's commit), Stop pauses
// what plays, and punch-in and punch-out read the window's two edges. The scrubber stays the Deep time device (atlasFaceBodies.tsx).
import {useEffect, useState, useSyncExternalStore} from 'react'
import type {SlotBinding, TransportBindings} from '../../../frame/transport/slots'
import {disclosureSession} from '../../../../../../../desktop/cradle/src/techne/session'
import {useAtlasHandle} from '../AtlasProjectionPanel'
import {windowEdgeYear} from '../sharedClock'

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
