import type { SetSummary, TrackSummary } from '../shell/useSet'

/**
 * Session view — track columns × scene rows, from the opened set's real
 * summary data. Clip slots are empty launch cells with hover state; launch
 * semantics land M4.
 */

const KIND_LABEL: Record<TrackSummary['kind'], string> = {
  audio: 'aud',
  midi: 'midi',
  return: 'ret',
  master: 'mst',
}

function TrackHeader({ track }: { track: TrackSummary }) {
  return (
    <div className={`track-header track-kind-${track.kind}`} title={track.name}>
      <span className="track-kind">{KIND_LABEL[track.kind]}</span>
      <span className="track-name">{track.name}</span>
      {track.devices.length > 0 && (
        <span className="track-device-dot" title={track.devices.join(' › ')} />
      )}
    </div>
  )
}

export function SessionView({ set }: { set: SetSummary | null }) {
  if (!set) {
    return (
      <div className="view-empty">
        <p>No set open.</p>
        <p className="view-empty-hint">
          Open a set from the browser (Sets), or start the server with one —
          the session grid renders its real tracks and scenes.
        </p>
      </div>
    )
  }

  const tracks = set.tracks
  const scenes = Array.from({ length: set.scene_count }, (_, i) => i)

  return (
    <div className="session-scroll">
      <div
        className="session-grid"
        style={{
          gridTemplateColumns: `var(--session-label-w) repeat(${tracks.length}, var(--session-slot-w))`,
        }}
      >
        {/* header row */}
        <div className="session-corner micro-label">scenes</div>
        {tracks.map((t, i) => (
          <TrackHeader key={i} track={t} />
        ))}

        {/* clip-slot rows */}
        {scenes.map((s) => (
          <div className="session-row-frag" key={s} style={{ display: 'contents' }}>
            <div className="scene-label" title={`Scene ${s + 1}`}>
              <span className="scene-number">{s + 1}</span>
              <span className="scene-name">Scene {s + 1}</span>
            </div>
            {tracks.map((t, i) => (
              <button
                type="button"
                key={i}
                className={[
                  'clip-slot',
                  t.kind === 'master' ? 'clip-slot-master' : '',
                ].join(' ')}
                title={`Clip slot ${t.name} / scene ${s + 1} — clip launch lands M4 (session workflow)`}
                aria-label={`Clip slot: ${t.name}, scene ${s + 1}`}
              />
            ))}
          </div>
        ))}

        {set.scene_count === 0 && (
          <div className="session-noscenes">
            this set registers no scenes — the slot grid appears once a set
            with scenes is opened
          </div>
        )}
      </div>
    </div>
  )
}
