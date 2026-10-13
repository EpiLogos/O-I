// The atlas face bodies' acts (atlasFaceBodies.tsx), as pure functions over the atlas's own objects. Each act calls the
// atlas's own setter; none keeps a copy of the state it changes. The bodies call these, and the tests call them on the
// same objects the Earth pane reads, so the one state is what both see.
//
// Pure: no React, no DOM, no store. The objects are the atlas's: the GraphView the controller holds (its controls()
// are the state GraphTools draws), the TimeModel the pane's time control reads, the globe engine.

import type {GraphControls} from '../projections/atlas/src/graph/view'
import type {Forces} from '../projections/atlas/src/graph/forces'
import {DEFAULT_FORCES} from '../projections/atlas/src/graph/forces'
import type {KindFlags} from '../projections/atlas/src/graph/settings'
import {DEFAULT_TIE_BASES, type TieBasis} from '../projections/atlas/src/types/field'

/** The atlas's own domains, as the declared parameter rows (agentNativeP0.ts) and the shell's writers (shellSetterBridge.ts)
 * both carry them. The graph's depth is clamped to these three by GraphView.setDepth; the clock's are the TimeModel's
 * own bounds before any range is set; the tiers and the tie bases are the graph's own. */
export const DEPTH_RANGE = {min: 1, max: 3} as const
export const CLOCK_DOMAIN = {min: 0, max: 1} as const
export const KIND_NAMES: readonly (keyof KindFlags)[] = ['archetype', 'theoretic', 'family']
export const TIE_BASE_IDS: readonly TieBasis[] = DEFAULT_TIE_BASES.map(basis => basis.id)

/** The graph's surface the bodies drive: the controls it reports and the setters the pane's GraphTools calls. */
export interface AtlasGraphSurface {
  controls(): GraphControls
  setDepth(depth: number): void
  setDust(on: boolean): void
  setKinds(kinds: KindFlags): void
  setTies(bases: TieBasis[]): void
  setForces(forces: Forces): void
  setSkyAnchors(on: boolean): void
  reframe(): void
}

/** The deep-time clock's surface: the TimeModel the pane's time control reads. The moves that the shared window binds
 * (T-ATLAS-TIME) return the refusal, named, when the window refuses the move; null is a move that stands. */
export interface AtlasClockSurface {
  readonly mode: 'all' | 'cursor'
  readonly cursorU: number
  readonly playing: boolean
  readonly cumulative: boolean
  scrub(u: number): string | null
  setAll(): string | null
  play(): string | null
  pause(): void
  setCumulative(on: boolean): void
}

/** The controller's user-time notice (the pane's time control sends it on each user move). */
export interface AtlasUserTimeSurface {
  onUserTime(): void
}

export function stepDepth(graph: AtlasGraphSurface, delta: 1 | -1): void {
  graph.setDepth(graph.controls().depth + delta)
}

export function toggleOccurrences(graph: AtlasGraphSurface): void {
  graph.setDust(!graph.controls().dust)
}

export function toggleKind(graph: AtlasGraphSurface, kind: keyof KindFlags): void {
  const kinds = graph.controls().kinds
  graph.setKinds({...kinds, [kind]: !kinds[kind]})
}

export function toggleTie(graph: AtlasGraphSurface, basis: TieBasis): void {
  const ties = graph.controls().ties
  graph.setTies(ties.includes(basis) ? ties.filter(b => b !== basis) : [...ties, basis])
}

export function setForce(graph: AtlasGraphSurface, key: keyof Forces, value: number): void {
  graph.setForces({...graph.controls().forces, [key]: value})
}

export function resetForces(graph: AtlasGraphSurface): void {
  graph.setForces({...DEFAULT_FORCES})
}

/** Sky anchors: on from off or unavailable; off while on or loading (the pane's GraphTools rule). */
export function toggleSky(graph: AtlasGraphSurface): void {
  const sky = graph.controls().sky
  graph.setSkyAnchors(sky === 'off' || sky === 'unavailable')
}

/** A scrub of the Earth: the one move the shared window writes (the pane, the face body and shell.setAtlasCursor all come here). */
export function scrubClock(ctl: AtlasUserTimeSurface, clock: AtlasClockSurface, u: number): string | null {
  ctl.onUserTime()
  return clock.scrub(u)
}

export function allTime(ctl: AtlasUserTimeSurface, clock: AtlasClockSurface): string | null {
  ctl.onUserTime()
  return clock.setAll()
}

/** Play or pause. Play advances the shared window through the clock's own commit, at most one write per frame. */
export function playOrPause(ctl: AtlasUserTimeSurface, clock: AtlasClockSurface): string | null {
  ctl.onUserTime()
  if (clock.playing) {
    clock.pause()
    return null
  }
  return clock.play()
}

export function toggleCumulative(clock: AtlasClockSurface): void {
  clock.setCumulative(!clock.cumulative)
}

export function setWholeField(engine: {setWholeField(on: boolean): void}, on: boolean): void {
  engine.setWholeField(on)
}
