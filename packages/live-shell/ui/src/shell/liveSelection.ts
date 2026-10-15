// Live's selection as THE selection (FOUNDATION F1): a track, a session slot or an arrangement clip of the open set,
// written into WorldContext.selection with a ref the set's own path anchors, and read back the same way. Live's views
// keep their index-based SetSelection; this is the only translation between the two.
import type {WorldSelection} from '../../../../../desktop/cradle/src/workspace/store'
import type {SetSummary} from './useSet'

/** Live's own selection in the open set, by index: a track, and on it a session slot (`scene`) or an arrangement clip. */
export type SetSelection = { track: number; scene: number | null; clip?: number }

const REF = /^als:(.+)#track\/(\d+)(?:\/(slot|clip)\/(\d+))?$/

/** The world selection for a Live selection over a set (null with no set: nothing of Live's is selected). */
export function liveWorldSelection(value: SetSelection, set: SetSummary | null): WorldSelection | null {
  if (!set) return null
  const track = set.tracks[value.track]
  const trackRef = `als:${set.path}#track/${value.track}`
  const trackName = track?.name ?? `Track ${value.track + 1}`
  if (value.clip !== undefined) return {mode: 'live', kind: 'live-clip', ref: `${trackRef}/clip/${value.clip}`, title: `${trackName} · clip ${value.clip + 1}`, track: trackRef}
  if (value.scene !== null) return {mode: 'live', kind: 'live-slot', ref: `${trackRef}/slot/${value.scene}`, title: `${trackName} · slot ${value.scene + 1}`, track: trackRef}
  return {mode: 'live', kind: 'live-track', ref: trackRef, title: trackName}
}

/** Live's selection read from the world selection, when that selection is a place in this set; null otherwise. */
export function setSelectionOf(selection: WorldSelection | undefined, setPath: string | undefined): SetSelection | null {
  if (!selection || selection.mode !== 'live' || !setPath) return null
  const match = REF.exec(selection.ref)
  if (!match || match[1] !== setPath) return null
  const track = Number(match[2]), at = match[4] === undefined ? undefined : Number(match[4])
  if (match[3] === 'clip') return {track, scene: null, clip: at}
  if (match[3] === 'slot') return {track, scene: at ?? null}
  return {track, scene: null}
}
