// The one Arrangement view (manual §3, FOUNDATION F3): "lays the same material along one ruler, so you can see the course
// of it". Tracks down, time across. A clip with a place on the ruler stands there; a set with no ruler lays its rows end
// to end, each as wide as its longest clip. A track's needle marks where it has got to. Craft floor: world-shell-mockup.html
// `tlBody` / `tlClips`.
import type {CSSProperties} from 'react'
import type {WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {TracksSelection} from './SessionGrid'
import './tracks.css'

interface Placed {clip: WorldTrackClip; start: number; end: number}
/** A grouped track's two sides, as the ruler names them (lock §9.3: sight and sound of one state). */
const LANE_WORD = {visual: 'sight', audio: 'sound'} as const

/** Every clip's place on one ruler: its own `at`, else its row's offset plus its span (rows end to end). */
export function placeClips(set: WorldTrackSet): {placed: Placed[]; end: number} {
  const offsets = new Map<string, number>()
  let cursor = 0
  for (const row of set.columns) {
    offsets.set(row.id, cursor)
    const widest = Math.max(1, ...set.clips.filter(clip => clip.columnId === row.id).map(clip => clip.span?.end ?? 1))
    cursor += widest
  }
  const placed: Placed[] = []
  for (const clip of set.clips) {
    if (clip.at) placed.push({clip, start: clip.at.start, end: clip.at.end ?? clip.at.start})
    else if (offsets.has(clip.columnId)) {
      const base = offsets.get(clip.columnId)!
      placed.push({clip, start: base + (clip.span?.start ?? 0), end: base + (clip.span?.end ?? 1)})
    }
  }
  const end = Math.max(cursor, 1, ...placed.map(p => p.end), ...set.tracks.map(track => track.needle ?? 0))
  return {placed, end}
}

export function ArrangementRuler({set, selection}: {set: WorldTrackSet; selection: TracksSelection}) {
  const {placed, end} = placeClips(set)
  const pct = (at: number) => `${(at / end) * 100}%`
  const marks = Array.from({length: 9}, (_, i) => (end * i) / 8)
  const label = set.ruler?.label ?? ((at: number) => String(Math.round(at * 10) / 10))
  if (!set.tracks.length) return <div className="tracks-empty" role="status">No tracks in this work yet.</div>
  return <div className="tl" aria-label="Arrangement" data-tracks-view="arrangement">
    <div className="tl-ruler" aria-label={`Ruler${set.ruler ? ` in ${set.ruler.unit}` : ''}`}>
      <span className="tl-head" />
      <div className="tl-marks">{marks.map(at => <span key={at} style={{left: pct(at)}}>{label(at)}</span>)}</div>
    </div>
    {set.tracks.map(track => {
      const style = {'--tc': track.color ?? 'var(--track-default, var(--bg-3))'} as CSSProperties
      const clips = placed.filter(p => p.clip.trackId === track.id)
      return <div key={track.id} className={`tl-lane${track.lane ? ` lane-${track.lane}` : ''}`} style={style} data-track={track.id}>
        <button type="button" className={`tl-head${selection.ref === track.id ? ' sel' : ''}`} title={`${track.name} · ${track.kind}`}
          onClick={() => selection.select({kind: 'track', ref: track.id, title: track.name})}>{track.name}{track.lane ? <small>{LANE_WORD[track.lane]}</small> : null}</button>
        <div className="tl-body">
          {clips.map(({clip, start, end: stop}) => <button type="button" key={clip.id} data-clip={clip.id} data-clip-status={clip.status ?? 'undisclosed'}
            className={`tl-clip${clip.status ? ` ${clip.status}` : ''}${selection.ref === clip.id ? ' sel' : ''}`}
            style={{left: pct(start), width: `max(6px, ${((Math.max(stop, start) - start) / end) * 100}%)`}}
            title={`${clip.label} · ${label(start)}${stop > start ? ` – ${label(stop)}` : ''}`}
            onClick={() => selection.select({kind: 'clip', ref: clip.id, title: clip.label, track: clip.trackId})}>{clip.label}</button>)}
          {track.needle !== undefined && <span className="tl-needle" style={{left: pct(track.needle)}} title={`${track.name} has got to ${label(track.needle)}`} />}
        </div>
      </div>
    })}
  </div>
}
