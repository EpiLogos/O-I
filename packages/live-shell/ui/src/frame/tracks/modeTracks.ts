// Each mode's tracks for the one Session and Arrangement (FOUNDATION F3), by registration: the mode's adapter over the
// reading the frame publishes. A table, never a branch in the frame. Live's adapter is the reference (the open set);
// Central's are its five streams (useCentralTracks.ts); Factory's its agent sessions and their tasks (useFactoryTracks.ts);
// Technē's its native streams with the walks' stops as rows (useTechneTracks.ts); Expressions' the open work's scenes.
import type {SurfMode} from '../../shell/modeGrammar'
import type {SetDocument} from '../../shell/document'
import type {SetSummary} from '../../shell/useSet'
import type {NativeExpressionsContent} from '../../shell/nativeContent'
import type {WorldTimelineView} from '../../projections/useWorldTemporalReading'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {liveSetTrackAdapter} from '../../timeline/liveSetTrackAdapter'
import {expressionsTrackAdapter} from '../../timeline/expressionsTrackAdapter'
import {useFactoryTracks} from './useFactoryTracks'
import {useCentralTracks} from './useCentralTracks'
import {useTechneTracks} from './useTechneTracks'
import type {JourneyPresentation} from '../../timeline/JourneyRows'

export interface TracksReading {
  /** The kernel carrier, for a mode whose tracks read their own owner. */
  transport?: KernelTransportStatus
  set: SetSummary | null
  document: SetDocument | null
  colors?: readonly string[]
  world?: WorldTimelineView
  native?: NativeExpressionsContent | null
  /** The shell's door to open an Expression a walk stop carries (the World modes' journey). */
  journey?: JourneyPresentation
  workName?: string
}

/** Several sets as one: their tracks and clips side by side, their rows in first-seen order. */
export function mergeSets(sets: readonly WorldTrackSet[]): WorldTrackSet {
  const columns = new Map<string, WorldTrackSet['columns'][number]>()
  for (const set of sets) for (const column of set.columns) if (!columns.has(column.id)) columns.set(column.id, column)
  return {columns: [...columns.values()], tracks: sets.flatMap(set => set.tracks), clips: sets.flatMap(set => set.clips)}
}

/** The open Expression as a track, its scenes as clips (lock §9.1: an Expression is a track; its scenes are its clips). */
export function nativeTracks(content: NativeExpressionsContent | null | undefined, workName?: string): WorldTrackSet | null {
  const scenes = content?.scenes?.scenes
  if (!content || !scenes) return null
  return expressionsTrackAdapter.project({expressions: [{id: content.basis.expression_ref, name: workName ?? content.basis.expression_ref,
    scenes: scenes.map(scene => ({id: scene.scene_ref, name: scene.title || scene.native_title, duration: scene.working?.duration ?? scene.snapshot.duration ?? 0}))}]})
}

/** A mode's tracks: a hook over the published reading (a mode may read its own owner — Central's streams, Factory's
 * sessions); called once per render from a component keyed by the mode, so each mode keeps its own hook order. */
export type UseModeTracks = (reading: TracksReading) => WorldTrackSet | ModeTracksWaiting | null

/** A mode's owner has not answered yet, or refused: the pane says why instead of drawing tracks. */
export interface ModeTracksWaiting { waiting: string }

/** The tracks, or nothing while the mode is waiting. */
export const tracksOf = (answer: WorldTrackSet | ModeTracksWaiting | null): WorldTrackSet | null =>
  answer && !('waiting' in answer) ? answer : null

export const MODE_TRACKS: Readonly<Record<SurfMode, UseModeTracks>> = {
  live: reading => liveSetTrackAdapter.project({set: reading.set, document: reading.document, colors: reading.colors}),
  base: useCentralTracks,
  factory: useFactoryTracks,
  techne: useTechneTracks,
  expressions: reading => nativeTracks(reading.native, reading.workName),
}
