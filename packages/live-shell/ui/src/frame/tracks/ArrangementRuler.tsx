// The one Arrangement view (manual §3, FOUNDATION F3): "lays the same material along one ruler, so you can see the course
// of it". Tracks down, time across. A clip with a place on the ruler stands there; a set with no ruler lays its rows end
// to end, each as wide as its longest clip, while a set with a ruler lays only the clips that have an `at` (no `at`, no
// place on it) and says how many it left to the Session. A track's needle marks where it has got to, and stalls in the
// stall colour with its age. A ruler that fixes its window and says where now stands gets a now line. A running clip has no
// right edge (its needle is the edge) and a waiting one with no length is a dash. Craft floor: world-shell-mockup.html
// `tlBody` / `tlClips`; ported from agent/AgentArrangementView.tsx (the run viewer).
import type {CSSProperties} from 'react'
import type {WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {STATUS_WORD, stalledLanes, trackColour, trackTree, type TracksSelection} from './SessionGrid'
import './tracks.css'

interface Placed {clip: WorldTrackClip; start: number; end: number}
/** A grouped track's two sides, as the ruler names them (lock §9.3: sight and sound of one state). */
const LANE_WORD = {visual: 'sight', audio: 'sound'} as const

/** Every clip's place on one ruler: its own `at`; else, on a set with no ruler, its row's offset plus its span (rows end to
 * end). On a set with a ruler a clip with no `at` has no place. `end` is the ruler's fixed window when the set gives one
 * (`ruler.end`, the run viewer's window: agent/AgentArrangementView.tsx:39), else what the clips and needles hold. */
export function placeClips(set: WorldTrackSet): {placed: Placed[]; end: number} {
  const ruled = set.ruler !== undefined
  const offsets = new Map<string, number>()
  let cursor = 0
  if (!ruled) {
    for (const row of set.columns) {
      offsets.set(row.id, cursor)
      const widest = Math.max(1, ...set.clips.filter(clip => clip.columnId === row.id).map(clip => clip.span?.end ?? 1))
      cursor += widest
    }
  }
  const placed: Placed[] = []
  for (const clip of set.clips) {
    if (clip.at) placed.push({clip, start: clip.at.start, end: clip.at.end ?? clip.at.start})
    else if (offsets.has(clip.columnId)) {
      const base = offsets.get(clip.columnId)!
      placed.push({clip, start: base + (clip.span?.start ?? 0), end: base + (clip.span?.end ?? 1)})
    }
  }
  const fixed = set.ruler?.end
  if (typeof fixed === 'number' && Number.isFinite(fixed) && fixed > 0) return {placed, end: fixed}
  const end = Math.max(cursor, 1, ...placed.map(p => p.end), ...set.tracks.map(track => track.needle ?? 0))
  return {placed, end}
}

/** A length on the ruler when the set gives no way to say it: the number and the ruler's unit. */
const plainDuration = (unit: string) => (span: number): string => `${Math.round(span)} ${unit}`

export function ArrangementRuler({set, selection, empty}: {set: WorldTrackSet; selection: TracksSelection; empty?: string}) {
  const {placed, end} = placeClips(set)
  const held = (at: number) => Math.min(Math.max(at, 0), end)
  const pct = (at: number) => `${(held(at) / end) * 100}%`
  const marks = Array.from({length: 9}, (_, i) => (end * i) / 8)
  const label = set.ruler?.label ?? ((at: number) => String(Math.round(at * 10) / 10))
  const now = set.ruler?.now
  const tree = trackTree(set.tracks)
  const {own: stalled} = stalledLanes(set, tree)
  const left = set.clips.length - new Set(placed.map(p => p.clip.id)).size
  // An empty work draws the ruler and the lane area with the reason in it, as the Session does — never a blank box.
  if (!set.tracks.length) return <div className="tl" aria-label="Arrangement" data-tracks-view="arrangement" data-empty="true">
    <div className="tl-ruler" aria-label="Ruler"><span className="tl-head" /><div className="tl-marks">{marks.map((at, i) => <span key={at} className={i === marks.length - 1 ? 'end' : undefined} style={{left: pct(at)}}>{label(at)}</span>)}</div></div>
    <div className="sg-drop" role="status">{empty ?? 'No tracks in this work yet.'}</div>
  </div>
  return <div className="tl" aria-label="Arrangement" data-tracks-view="arrangement">
    <div className="tl-ruler" aria-label={`Ruler${set.ruler ? ` in ${set.ruler.unit}` : ''}`}>
      <span className="tl-head" />
      <div className="tl-marks">{marks.map((at, i) => <span key={at} className={i === marks.length - 1 ? 'end' : undefined} style={{left: pct(at)}}>{label(at)}</span>)}</div>
    </div>
    {set.tracks.map(track => {
      const style = {'--tc': trackColour(track)} as CSSProperties
      const clips = placed.filter(p => p.clip.trackId === track.id)
      // A rail per level, in each ancestor's colour, as the Session draws them (manual §6).
      const rails = tree.ancestorsOf(track).map(trackColour)
      const stoppedNeedle = track.needle !== undefined && stalled.has(track.id)
      const age = stoppedNeedle && now !== undefined ? (set.ruler?.duration ?? plainDuration(set.ruler?.unit ?? ''))(Math.max(0, now - track.needle!)) : undefined
      const readout = stoppedNeedle ? `${track.name} · stalled${age ? ` ${age}` : ''}` : undefined
      return <div key={track.id} className={`tl-lane${track.lane ? ` lane-${track.lane}` : ''}`} style={{...style, ...(rails.length ? {'--rails': rails.length} : {})} as CSSProperties} data-track={track.id}>
        <button type="button" className={`tl-head${selection.ref === track.id ? ' sel' : ''}`} title={`${track.name} · ${track.kind}`}
          onClick={() => selection.select({kind: 'track', ref: track.id, title: track.name})}>
          {rails.length > 0 && <span className="rails" aria-hidden="true">{rails.map((colour, i) => <i key={i} style={{background: colour}} />)}</span>}
          {track.name}{track.lane ? <small>{LANE_WORD[track.lane]}</small> : null}</button>
        <div className="tl-body">
          {now !== undefined && <span className="tl-now" style={{left: pct(now)}} aria-hidden="true" />}
          {clips.map(({clip, start, end: stop}) => {
            const lengthless = !(stop > start)
            // A waiting clip with no length is a dash: nobody knows how long it will take. Near the window's end it reaches
            // back from its point instead of past the edge.
            const dash = clip.status === 'waiting' && lengthless
            const flip = dash && held(start) / end > 0.85
            const word = clip.status ? STATUS_WORD[clip.status] : undefined
            const when = `${label(start)}${stop > start ? ` – ${label(stop)}` : ''}`
            const edge = clip.status === 'running' ? ' · no end is drawn: its needle is the edge' : dash ? ' · no length is drawn' : ''
            return <button type="button" key={clip.id} data-clip={clip.id} data-clip-status={clip.status ?? 'undisclosed'}
              className={`tl-clip${clip.status ? ` ${clip.status}` : ''}${dash ? ' dash' : ''}${selection.ref === clip.id ? ' sel' : ''}`}
              style={dash ? (flip ? {right: `calc(100% - ${pct(start)})`} : {left: pct(start)}) : {left: pct(start), width: `max(6px, ${((held(Math.max(stop, start)) - held(start)) / end) * 100}%)`}}
              title={`${clip.label} · ${when}${word ? ` · ${word}` : ''}${edge}${clip.note ? ` · ${clip.note}` : ''}`}
              onClick={() => selection.select({kind: 'clip', ref: clip.id, title: clip.label, track: clip.trackId})}>{dash ? `▸ ${clip.label}` : clip.label}</button>
          })}
          {track.needle !== undefined && <span className="tl-needle" style={{left: pct(track.needle)}} data-stalled={stoppedNeedle ? 'true' : undefined} data-edge={held(track.needle) / end > 0.6 ? 'end' : undefined}
            title={readout ?? `${track.name} has got to ${label(track.needle)}`}>{readout && <span className="tl-readout">{readout}</span>}</span>}
        </div>
      </div>
    })}
    {left > 0 && <p className="tl-note" role="status">{left} {left === 1 ? 'clip has' : 'clips have'} no place on this ruler: its owner gives none. The Session grid holds {left === 1 ? 'it' : 'them'}.</p>}
  </div>
}
