// Live's set as tracks, the reference adapter for the shared Session and Arrangement (FOUNDATION F3; lock §9.1 Live row:
// track = audio / MIDI / group / return, clip = audio / MIDI clip, stop = scene).
//
// Projection:
// - tracks: the set's tracks in order, each with its kind and its display colour;
// - columns: the set's scenes, the Session grid's rows (Live's scenes are the DLW's stops);
// - clips: every filled session slot (a clip in its scene's row), and every arrangement clip placed on the ruler by its
//   own start and end in beats — an arrangement clip stands in no row;
// - ruler: beats, labelled bar.beat as Live's own ruler counts them.
// Clip and track ids are the refs THE selection already speaks for Live (shell/liveSelection.ts: als:<set>#track/<i>,
// …/slot/<scene>, …/clip/<j>), so selecting a clip on the shared grid is selecting it everywhere.
//
// The set's owner discloses no playback state and no launch op, so clips carry no status and the set no actions: the grid
// stays honest and read-only until the owner gives them. Pure TypeScript.
import type {SetDocument} from '../shell/document'
import type {SetSummary} from '../shell/useSet'
import type {WorldTrackAdapter, WorldTrackClip, WorldTrackSet} from './worldTrackAdapter'

export interface LiveSetReading {
  set: SetSummary | null
  document: SetDocument | null
  /** Each track's display colour, by index (the shell's palette and the person's overrides). */
  colors?: readonly string[]
}

export const LIVE_SET_TRACK_ADAPTER_ID = 'live-set-tracks'

const barBeat = (beats: number): string => `${Math.floor(beats / 4) + 1}.${Math.floor(beats % 4) + 1}`

export const liveSetTrackAdapter: WorldTrackAdapter<LiveSetReading> = {
  id: LIVE_SET_TRACK_ADAPTER_ID,
  project({set, document, colors}): WorldTrackSet {
    if (!set) return {columns: [], tracks: [], clips: []}
    const trackRef = (index: number) => `als:${set.path}#track/${index}`
    const tracks = set.tracks.map((track, index) => ({id: trackRef(index), name: track.name, kind: track.kind, ...(colors?.[index] ? {color: colors[index]} : {})}))
    const columns = Array.from({length: set.scene_count}, (_, scene) => ({id: `scene:${scene}`, name: String(scene + 1)}))
    const clips: WorldTrackClip[] = []
    document?.tracks.forEach((track, index) => {
      if (index >= tracks.length) return
      for (const [slot, name] of Object.entries(track.sessionSlots)) {
        const scene = Number(slot)
        if (name === null || !Number.isSafeInteger(scene) || scene < 0 || scene >= set.scene_count) continue
        clips.push({id: `${trackRef(index)}/slot/${scene}`, trackId: trackRef(index), columnId: `scene:${scene}`, label: name})
      }
      track.arrangementClips.forEach((clip, at) => {
        clips.push({id: `${trackRef(index)}/clip/${at}`, trackId: trackRef(index), columnId: '', label: clip.name, at: {start: clip.start, end: clip.end}})
      })
    })
    return {columns, tracks, clips, ruler: {unit: 'beats', label: barBeat}}
  },
}
