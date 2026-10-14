// The one Session view (manual §3, FOUNDATION F3): "the grid: tracks across, rows down, everything launchable, nothing in
// any fixed order." Every mode's tracks arrive through its adapter as one WorldTrackSet; this grid knows no mode. A clip
// shows its state (waiting, running, stopped, recording, stalled); a row's stop launches it whole; a track's square stops
// it. Launch, stop and record run only through the set's actions port, so a set whose owner gives none stays read-only
// and says so. Craft floor: world-shell-mockup.html `sessView` and `.sg/.trk/.cs`.
import type {CSSProperties} from 'react'
import type {WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import './tracks.css'

export interface TracksSelection {
  /** The selected ref (a clip's or a track's id), if it is in this set. */
  ref?: string
  select(target: {kind: 'clip' | 'track'; ref: string; title: string; track?: string}): void
}

const STATUS_WORD: Record<string, string> = {waiting: 'Waiting', running: 'Running', stopped: 'Stopped', recording: 'Recording', stalled: 'Stalled'}

export function SessionGrid({set, selection}: {set: WorldTrackSet; selection: TracksSelection}) {
  const rows = set.columns
  const inRow = new Map<string, WorldTrackClip>()
  for (const clip of set.clips) if (clip.columnId) inRow.set(`${clip.trackId}\u0000${clip.columnId}`, clip)
  // Grouped lanes (sight and sound of one Expression) are one track in the Session grid: the visual lane stands for it.
  const tracks = set.tracks.filter(track => !track.groupId || !track.lane || track.lane === 'visual')
  const launch = set.actions?.launch, launchStop = set.actions?.launchStop, stopTrack = set.actions?.stopTrack
  if (!tracks.length) return <div className="tracks-empty" role="status">No tracks in this work yet.</div>
  return <div className="sg" role="grid" aria-label="Session" data-tracks-view="session">
    {tracks.map(track => {
      const style = {'--tc': track.color ?? 'var(--track-default, var(--bg-3))'} as CSSProperties
      const selectedTrack = selection.ref === track.id
      const depth = track.depth ?? 0
      return <div key={track.id} className={`trk${depth ? ' sub' : ''}`} role="row" style={{...style, ...(depth ? {'--rail': `${depth * 3}px`} : {})} as CSSProperties} data-track={track.id} data-depth={depth || undefined}>
        {depth > 0 && <span className="rail" aria-hidden="true" />}
        <button type="button" className={`thd${selectedTrack ? ' sel' : ''}`} title={`${track.name} · ${track.kind}`} aria-pressed={selectedTrack}
          onClick={() => selection.select({kind: 'track', ref: track.id, title: track.name})}>{track.name}</button>
        {rows.map(row => {
          const clip = inRow.get(`${track.id}\u0000${row.id}`) ?? (track.groupId ? set.clips.find(c => c.columnId === row.id && set.tracks.find(t => t.id === c.trackId)?.groupId === track.groupId) : undefined)
          if (!clip) return <div key={row.id} className="cs" role="gridcell" title={stopTrack ? 'Empty slot · its square stops the track' : 'Empty slot'}>
            <button type="button" className="sg2" aria-label={`Stop ${track.name}`} disabled={!stopTrack} title={stopTrack ? `Stop ${track.name} (${stopTrack.op})` : 'No stop: the owner discloses no stop for this track'}
              onClick={() => stopTrack?.run(track.id)} />
          </div>
          const selected = selection.ref === clip.id
          const word = clip.status ? STATUS_WORD[clip.status] : 'State not disclosed'
          return <div key={row.id} role="gridcell" className={`cs clip${clip.status ? ` ${clip.status}` : ''}${selected ? ' sel' : ''}`} data-clip={clip.id} data-clip-status={clip.status ?? 'undisclosed'}
            title={`${clip.label} · ${word}${clip.launch?.quantize ? ` · launches ${clip.launch.quantize}` : ''}${clip.launch?.follow ? ` · then ${clip.launch.follow}` : ''}${clip.takes?.length ? ` · ${clip.takes.length} takes` : ''}`}
            onClick={() => selection.select({kind: 'clip', ref: clip.id, title: clip.label, track: clip.trackId})}>
            <button type="button" className="tri" aria-label={`Launch ${clip.label}`} disabled={!launch} title={launch ? `Launch (${launch.op})` : 'No launch: the owner discloses no launch for this clip'}
              onClick={event => { event.stopPropagation(); launch?.run(clip.id) }} />
            <span className="cs-label">{clip.label}</span>
            {!!clip.takes?.length && <span className="cs-takes" aria-label={`${clip.takes.length} takes`}>{clip.takes.length}</span>}
          </div>
        })}
      </div>
    })}
    <div className="sg-fill" />
    <div className="trk trk-main" role="row" aria-label="Stops">
      <div className="thd">Main</div>
      {rows.map((row, index) => <div key={row.id} className="cs" role="gridcell">
        <button type="button" className="stop-launch" disabled={!launchStop} title={launchStop ? `Launch the row: every clip in it (${launchStop.op})` : 'No row launch: the owner discloses none'}
          onClick={() => launchStop?.run(row.id)}>▸</button>
        <span className="cs-label">{row.name || index + 1}</span>
      </div>)}
    </div>
  </div>
}
