import type { SetSummary } from '../shell/useSet'

/**
 * Arrangement view — timeline ruler + per-track lanes. The set's
 * arrangement_clips count renders as placeholder blocks pinned at bar 0;
 * real clip positions land M5 (arrangement + warp).
 */

const BAR_W = 26 // px per bar
const TOTAL_BARS = 64
const LABEL_EVERY = 4
const MAX_PLACEHOLDER_BLOCKS = 12

function Ruler() {
  const bars = Array.from({ length: TOTAL_BARS }, (_, i) => i)
  return (
    <div className="arrange-ruler" style={{ width: TOTAL_BARS * BAR_W }}>
      {bars.map((b) => (
        <div key={b} className="arrange-bar" style={{ left: b * BAR_W }}>
          {(b % LABEL_EVERY === 0 || b === 0) && (
            <span className="arrange-bar-label">{b + 1}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function ArrangementView({ set }: { set: SetSummary | null }) {
  if (!set) {
    return (
      <div className="view-empty">
        <p>No set open.</p>
        <p className="view-empty-hint">
          The arrangement timeline shows the opened set's lanes and its clip
          count as placeholders.
        </p>
      </div>
    )
  }

  const clips = set.arrangement_clips
  const shown = Math.min(clips, MAX_PLACEHOLDER_BLOCKS)
  const overflow = clips - shown

  return (
    <div className="arrange-scroll">
      <div className="arrange-inner" style={{ width: TOTAL_BARS * BAR_W }}>
        <div className="arrange-ruler-row">
          <div className="arrange-lane-label micro-label">bars</div>
          <Ruler />
        </div>

        {clips > 0 && (
          <div className="arrange-row">
            <div className="arrange-lane-label" title="Clip count from the opened set">
              <span className="track-kind track-kind-audio">clp</span>
              <span className="track-name">clips ({clips})</span>
            </div>
            <div className="arrange-lane">
              {Array.from({ length: shown }, (_, i) => (
                <div
                  key={i}
                  className="arrange-clip arrange-clip-placeholder"
                  style={{ left: 2 + i * 4, top: 2 + i * 3, width: 64 }}
                  title={`Arrangement clip ${i + 1} of ${clips} — placeholder at bar 0; timeline positions land M5 (arrangement + warp)`}
                >
                  clip
                </div>
              ))}
              {overflow > 0 && (
                <div
                  className="arrange-clip arrange-clip-overflow"
                  style={{ left: 74, top: 2 }}
                  title={`${overflow} more arrangement clips — placeholders land M5`}
                >
                  +{overflow}
                </div>
              )}
            </div>
          </div>
        )}

        {set.tracks.map((t, i) => (
          <div className="arrange-row" key={i}>
            <div className={`arrange-lane-label track-kind-${t.kind}`} title={t.name}>
              <span className="track-name">{t.name}</span>
            </div>
            <div
              className="arrange-lane"
              title={`${t.name} arrangement lane — clip content lands M5 (arrangement + warp)`}
            />
          </div>
        ))}

        <div className="arrange-note">
          {clips} arrangement clip{clips === 1 ? '' : 's'} in this set —
          rendered as placeholders at bar 0; timeline positions and editing
          land M5 (arrangement + warp)
        </div>
      </div>
    </div>
  )
}
