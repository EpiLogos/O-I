// The clip box (manual §3, lock §9.4: "a clip's name and colour, when and how it launches, what follows it, where it starts
// and ends and loops"), the same over every mode's clip editor (FOUNDATION F4: shell-owned). It reads THE selection and the
// clip as the mode's tracks give it; it writes nothing until a clip's owner discloses a write, and says so. A clip body that is
// a Clip view (ClipView.tsx) carries the same facts in its props column (`clipBoxRows`), and the strip stands down over it
// (detail.css).
import type {CSSProperties} from 'react'
import {useTimelineReading} from '../../projections/timelinePaneHost'
import {useShownTracks} from '../tracks/tracksDoor'
import type {WorldTrack, WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {ClipRow} from './ClipView'

const STATUS_WORD: Record<string, string> = {waiting: 'waiting', running: 'running', stopped: 'stopped', recording: 'recording', stalled: 'stalled'}

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

/** The clip box's facts as rows of a Clip view's props column: its track, how it stands, where it starts and ends, when its
 * launch lands, what follows it, its takes. A fact the clip's owner does not disclose is undisclosed (null), never guessed. */
export function clipBoxRows({clip, track, set}: SelectedClip): ClipRow[] {
  if (!clip) return []
  const label = set?.ruler?.label ?? ((at: number) => String(at))
  const start = clip.at?.start ?? clip.span?.start, end = clip.at?.end ?? clip.span?.end
  const rows: ClipRow[] = [
    {key: 'track', value: track?.name ?? clip.trackId, title: 'The track it sits on'},
    {key: 'state', value: clip.status ? STATUS_WORD[clip.status] : null, title: clip.note ?? 'How it stands now'},
    {key: 'span', value: start !== undefined ? `${label(start)}${end !== undefined && end !== start ? ` – ${label(end)}` : ''}` : null, title: 'Where it starts and ends'},
    {key: 'launch', value: clip.launch?.quantize ?? null, title: 'When a launch lands'},
    {key: 'then', value: clip.launch?.follow ?? null, title: 'Follow action: what comes after it'},
  ]
  if (clip.takes?.length) {
    const standing = clip.takes.find(take => take.standing)
    rows.push({key: 'takes', value: `${clip.takes.length}${standing ? ` · ${standing.name} stands` : ''}`, title: 'Takes stacked under it'})
  }
  return rows
}

export function ClipBox() {
  const selected = useSelectedClip()
  return selected.clip ? <ClipBoxOf selected={selected} /> : null
}

function ClipBoxOf({selected}: {selected: SelectedClip}) {
  const {clip, track, set} = selected
  if (!clip || !set) return null
  const label = set.ruler?.label ?? ((at: number) => String(at))
  const start = clip.at?.start ?? clip.span?.start, end = clip.at?.end ?? clip.span?.end
  const style = {'--tc': track?.color ?? 'var(--bg-3)'} as CSSProperties
  return <section className="clip-box" aria-label="Clip" style={style} data-clip-box={clip.id}>
    <span className="clip-box-colour" title={track?.color ? `Colour ${track.color}` : 'Colour not given by the owner'} />
    <b className="clip-box-name" title={clip.id}>{clip.label}</b>
    <span className="clip-box-field" title="The track it sits on">{track?.name ?? clip.trackId}</span>
    <span className="clip-box-field" data-clip-status={clip.status ?? 'undisclosed'} title="How it stands now">{clip.status ? STATUS_WORD[clip.status] : 'state not disclosed'}</span>
    {start !== undefined && <span className="clip-box-field" title="Where it starts and ends">{label(start)}{end !== undefined && end !== start ? ` – ${label(end)}` : ''}</span>}
    <span className="clip-box-field" title="Launch: when a launch lands">{clip.launch?.quantize ? `launches ${clip.launch.quantize}` : 'launch not disclosed'}</span>
    <span className="clip-box-field" title="Follow action: what comes after it">{clip.launch?.follow ? `then ${clip.launch.follow}` : 'no follow action'}</span>
    {!!clip.takes?.length && <span className="clip-box-field" title="Takes stacked under it">{clip.takes.length} takes{clip.takes.some(take => take.standing) ? ` · ${clip.takes.find(take => take.standing)!.name} stands` : ''}</span>}
  </section>
}
