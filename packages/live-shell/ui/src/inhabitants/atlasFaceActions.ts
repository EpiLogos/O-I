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
import type {TieBasis} from '../projections/atlas/src/types/field'

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

/** The deep-time clock's surface: the TimeModel the pane's time control reads. */
export interface AtlasClockSurface {
  readonly mode: 'all' | 'cursor'
  readonly cursorU: number
  readonly playing: boolean
  readonly cumulative: boolean
  scrub(u: number): void
  setAll(): void
  play(): void
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

export function scrubClock(ctl: AtlasUserTimeSurface, clock: AtlasClockSurface, u: number): void {
  ctl.onUserTime()
  clock.scrub(u)
}

export function allTime(ctl: AtlasUserTimeSurface, clock: AtlasClockSurface): void {
  ctl.onUserTime()
  clock.setAll()
}

export function playOrPause(ctl: AtlasUserTimeSurface, clock: AtlasClockSurface): void {
  ctl.onUserTime()
  if (clock.playing) clock.pause()
  else clock.play()
}

export function toggleCumulative(clock: AtlasClockSurface): void {
  clock.setCumulative(!clock.cumulative)
}

export function setWholeField(engine: {setWholeField(on: boolean): void}, on: boolean): void {
  engine.setWholeField(on)
}
