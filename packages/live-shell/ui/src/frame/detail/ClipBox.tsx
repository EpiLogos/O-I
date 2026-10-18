// THE selection as the detail area reads it: its ref, and the clip it names in the tracks the pane shows, with that clip's track
// (FOUNDATION F4). The clip bindings read it (agent/clipBinding.ts, central/, live/, techne/, components/expressions/clip/). The
// shell-owned clip box strip this file drew (ClipBox, clipBoxRows) is retired: a clip's name, colour, launch and follow action are
// its Clip view's head, Clip panel and Launch panel (manual §16.5; T-REALIGN R2).
import {useTimelineReading} from '../../projections/timelinePaneHost'
import {useShownTracks} from '../tracks/tracksDoor'
import type {WorldTrack, WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'

/** THE selection, and the clip it names in the tracks the pane shows (frame/tracks/tracksDoor.ts) — the mode's owner is read
 * once, there. `clip` is null when the selection is not one of the shown clips (a browser subject, another mode's clip). */
export interface SelectedClip {
  ref: string | null
  clip: WorldTrackClip | null
  track: WorldTrack | null
  set: WorldTrackSet | null
}

export function useSelectedClip(): SelectedClip {
  const ref = useTimelineReading()?.selectedRef ?? null
  const set = useShownTracks()
  return selectedClipOf(ref, set)
}

export function selectedClipOf(ref: string | null, set: WorldTrackSet | null): SelectedClip {
  const clip = ref ? set?.clips.find(item => item.id === ref) ?? null : null
  const track = clip ? set?.tracks.find(item => item.id === clip.trackId) ?? null : null
  return {ref, clip, track, set}
}
