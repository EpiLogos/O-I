// Each mode's tracks for the one Session and Arrangement (FOUNDATION F3), by registration: the mode's adapter over the
// reading the frame publishes. A table, never a branch in the frame. Live's adapter is the reference (the open set);
// Central, Factory and Technē stand on the World cut's sets until their own adapters land (Central's five streams,
// Factory's sessions and tasks, Technē's readings — module work after F3); Expressions stands on the open work's scenes.
import type {SurfMode} from '../../shell/modeGrammar'
import type {SetDocument} from '../../shell/document'
import type {SetSummary} from '../../shell/useSet'
import type {NativeExpressionsContent} from '../../shell/nativeContent'
import type {WorldTimelineView} from '../../projections/useWorldTemporalReading'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {liveSetTrackAdapter} from '../../timeline/liveSetTrackAdapter'
import {expressionsTrackAdapter} from '../../timeline/expressionsTrackAdapter'

export interface TracksReading {
  /** The kernel carrier, for a mode whose tracks read their own owner. */
  transport?: KernelTransportStatus
  set: SetSummary | null
  document: SetDocument | null
  colors?: readonly string[]
  world?: WorldTimelineView
  native?: NativeExpressionsContent | null
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

const worldTracks = (reading: TracksReading): WorldTrackSet | null => reading.world ? mergeSets(reading.world.source.sets) : null

/** A mode's tracks: a hook over the published reading (a mode may read its own owner — Central's streams, Factory's
 * sessions); called once per render from a component keyed by the mode, so each mode keeps its own hook order. */
export type UseModeTracks = (reading: TracksReading) => WorldTrackSet | null

export const MODE_TRACKS: Readonly<Record<SurfMode, UseModeTracks>> = {
  live: reading => liveSetTrackAdapter.project({set: reading.set, document: reading.document, colors: reading.colors}),
  base: worldTracks,
  factory: worldTracks,
  techne: worldTracks,
  expressions: reading => nativeTracks(reading.native, reading.workName),
}
