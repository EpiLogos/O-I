import type { UseSet } from '../shell/useSet'

/** Bottom status strip: what is open, where the data comes from. */
export function StatusBar({ state }: { state: UseSet }) {
  const { set, path, error, loading } = state
  return (
    <footer className="statusbar">
      <span className="statusbar-path" title={path ?? undefined}>
        {error ? (
          <span className="statusbar-error">open failed: {error}</span>
        ) : loading ? (
          'opening…'
        ) : set ? (
          set.path
        ) : (
          'no set open'
        )}
      </span>
      {set && (
        <span className="statusbar-counts">
          {set.tracks.length} tracks · {set.scene_count} scenes ·{' '}
          {set.arrangement_clips} arrangement clips
        </span>
      )}
      <span className="statusbar-spacer" />
      <span className="statusbar-meta micro-label">
        m2 frame · data: /api/summary · panels: ui/PANELS.md
      </span>
    </footer>
  )
}
