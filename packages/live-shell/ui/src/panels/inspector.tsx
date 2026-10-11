import type { SetSummary } from '../shell/useSet'
import { registerPanel } from '../shell/panels'

/** Inspector — the opened set's summary JSON, pretty-printed. */
export function InspectorPanel({ set, loading, error }: { set: SetSummary | null; loading: boolean; error: string | null }) {
  if (loading) return <div className="panel-hint">reading set…</div>
  if (error) return <div className="panel-hint panel-hint-error">open failed: {error}</div>
  if (!set) return <div className="panel-hint">no set open — open one from the browser</div>
  return <pre className="inspector-json">{JSON.stringify(set, null, 2)}</pre>
}

registerPanel({
  id: 'core.inspector',
  title: 'Inspector',
  icon: 'inspector',
  slot: 'right-dock',
  component: InspectorPanel,
  order: 10,
  note: 'The opened set summary (the /api/summary JSON) pretty-printed',
})
