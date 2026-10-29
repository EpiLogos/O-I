// The clip THE selection names in the open Live set (manual §21.1): an arrangement clip with its place on the ruler, or a session
// slot's clip. Read by Live's clip binding (live/clipBinding.ts, which hosts the clip in the one Clip view after Live, T-REALIGN R2)
// and by the detail head (shell/modeDetails.tsx). The Clip view this file drew — its props rows and its empty pitch-class roll —
// is retired: clip:live draws the clip, Live's anatomy panel for panel.
import type {SetDocument} from '../shell/document'
import type {SetSummary} from '../shell/useSet'
import type {SetSelection} from '../shell/liveSelection'

/** What Live's Clip side says while no clip is selected (shell/modeDetails.tsx; components/DeviceChainPanel.tsx re-exports it). */
export const LIVE_CLIP_WAITS = 'Select a clip in the Session or the Arrangement to see it here.'

/** The clip THE selection names in the open set: an arrangement clip (with its own start and end) or a session slot's clip. */
export interface LiveClipReading {
  name: string
  track: string | null
  /** The clip's own kind when the document gives it; a session slot's clip is the kind of its track (a MIDI track holds MIDI clips). */
  kind: 'audio' | 'midi' | null
  /** An arrangement clip's place, in beats from the set's start. */
  at: {start: number; end: number} | null
}

export function liveClipOf(set: SetSummary | null, document: SetDocument | null, selection: SetSelection): LiveClipReading | null {
  const deep = document?.tracks[selection.track]
  const track = set?.tracks[selection.track] ?? null
  const arrangement = selection.clip === undefined ? undefined : deep?.arrangementClips[selection.clip]
  if (arrangement) return {name: arrangement.name, track: track?.name ?? deep?.name ?? null, kind: arrangement.kind, at: {start: arrangement.start, end: arrangement.end}}
  const slot = selection.scene === null ? null : deep?.sessionSlots[String(selection.scene)] ?? null
  if (!slot) return null
  const trackKind = track?.kind ?? deep?.kind
  return {name: slot, track: track?.name ?? deep?.name ?? null, kind: trackKind === 'midi' ? 'midi' : trackKind === 'return' || trackKind === 'master' || !trackKind ? null : 'audio', at: null}
}
