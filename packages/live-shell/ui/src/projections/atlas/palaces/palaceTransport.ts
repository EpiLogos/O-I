// Technē's transport while a palace is entered (T-PALACES-ONTO-ATLAS; lane-5 T17 "walk chrome is the playback transport grammar … a walk
// may hold still at a locus; nothing forces per-locus churn"; manual §8 "The transport walks: tempo is the walk's pace, the time
// signature tells you which stop of how many"; lock §7.1 "one shared time control … while a thread's walk stands, the one transport
// button serves it; the clock's own play yields", AE src/ui/time-control.ts:33).
//
// The frame's Palace walked by its own buttons (palaceInstrument.tsx:487-492 Start ← →), which move to the M5 plate's Path. The walk's
// playing is the one transport's: while a palace stands, Play walks it — one locus per dwell, wrapping — and Stop holds it still where it
// stands; Walk pace reads the dwell and Stop n/8 reads the locus of how many. Tempo sets the dwell (O-I 761; manual §17.7 Transport
// "Tempo — Sets how long the walk stays in a room"): › quickens the walk, ‹ slows it (palaceSession.ts stepTempo). Outside a palace these
// bindings stand down and the atlas's own time serves the transport (places/placesTransport.ts). Pure over the palace's reading, so the
// binding and the tests read the same.

import {useSyncExternalStore} from 'react'
import type {TransportBindings} from '../../../frame/transport/slots'
import {inside, palaceState, startWalking, stepTempo, stopWalking, subscribePalace, walkOf, type PalaceState} from './palaceSession'

/** The transport over the palace stood in; none while outside, so the atlas's own time serves Play and Stop. */
export function palaceWalkBindings(state: PalaceState, acts: {start(): void; stop(): void; tempo(direction: 1 | -1): void} = {start: startWalking, stop: stopWalking, tempo: stepTempo}): TransportBindings {
  if (state.phase !== 'inside') return {}
  const {steps, index, focus} = walkOf(state)
  const empty = !steps.length
  const name = state.palace.title
  const dwell = state.dwellMs / 1000
  return {
    play: empty ? {refused: `Nothing stands in ${name}'s whole, so the walk focuses nothing.`}
      : {press: state.walking ? acts.stop : acts.start, lit: state.walking,
        title: state.walking ? `Walk — ${name}'s walk is walking, one locus every ${dwell} s; press to hold it still.`
          : `Walk — walk ${name} from locus ${index + 1}, one locus every ${dwell} s, wrapping at its end.`},
    stop: state.walking ? {press: acts.stop, title: `Stop — hold ${name}'s walk still at locus ${index + 1}.`}
      : {refused: 'The walk holds still: nothing walks, so there is nothing to stop.'},
    signature: {readout: {value: empty ? '—' : `${index + 1}/${steps.length}`,
      title: empty ? `Stop n/N — ${name}'s whole composes nothing to walk.` : `Stop n/N — locus ${index + 1} of ${steps.length}: ${focus?.office ?? ''} · ${focus?.ref ?? ''}`}},
    tempo: {step: acts.tempo, readout: {value: `${dwell} s`, title: `Tempo — the walk stays ${dwell} s in each room. › quickens it, ‹ slows it.`},
      title: 'Tempo — sets how long the walk stays in a room: › quickens the walk, ‹ slows it.'},
  }
}

/** The bindings the Technē transport adds while a palace stands (they take Play and Stop from the atlas's time, as a walk does). */
export function usePalaceWalkBindings(): TransportBindings {
  const state = useSyncExternalStore(subscribePalace, palaceState, palaceState)
  return palaceWalkBindings(inside() ? state : {phase: 'outside'})
}
