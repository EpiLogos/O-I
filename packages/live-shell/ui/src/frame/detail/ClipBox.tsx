// The clip box (manual §3, lock §9.4: "a clip's name and colour, when and how it launches, what follows it, where it starts
// and ends and loops"), the same over every mode's clip editor (FOUNDATION F4: shell-owned). It reads THE selection and the
// clip as the mode's tracks give it; it writes nothing until a clip's owner discloses a write, and says so.
import type {CSSProperties} from 'react'
import {useTimelineReading, type TimelineHostReading} from '../../projections/timelinePaneHost'
import {MODE_TRACKS} from '../tracks/modeTracks'

const STATUS_WORD: Record<string, string> = {waiting: 'waiting', running: 'running', stopped: 'stopped', recording: 'recording', stalled: 'stalled'}

export function ClipBox() {
  const reading = useTimelineReading()
  return reading ? <ModeClipBox key={reading.mode} reading={reading} /> : null
}

function ModeClipBox({reading}: {reading: TimelineHostReading}) {
  const set = MODE_TRACKS[reading.mode](reading)
  const clip = set?.clips.find(item => item.id === reading.selectedRef)
  if (!clip || !set) return null
  const track = set.tracks.find(item => item.id === clip.trackId)
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
