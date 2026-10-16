import {useEffect, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {IconName} from '../inhabitants/sdk/Icon'
import {NativeContextPanel} from '../components/NativeContextPanel'
import {useWorkspace} from '../shell/workspaceContext'
import {scalarEntries, safeJson} from './RefusalCard'
import type {AgentTileId} from './AgentShellContext'
import {DEVICE_WIDGET_PREFIX} from '../frame/devices/deviceDoor'
import {claimRailWidget, deviceWidget} from '../frame/widgets/deviceWidgets'
import {FRAMES_ID} from './devices/mainTrackBindings'
import {APPROVALS_ID, LEDGER_ID} from './devices/receiptBindings'

// The rail's Frames is the Frames monitor's widget (DLW §23.8 "Frames is the Frames monitor on the rail"; §19.5): its tile draws the
// device's own Widget view on the binding the Gateway's Full and the pool read (agent/devices/mainTrackBindings.ts framesBinding),
// bare, as the rail draws any device's widget. It replaced this tile's raw harness_agent_read receipt (MOVED, lane BF2).
claimRailWidget('frames', FRAMES_ID)
// The rail's Ledger and Approvals are the Main track's devices' widgets the same way (§23.9, §23.10; agent/devices/receiptBindings.ts):
// the Ledger on Central's change horizon, Approvals on the Gateway's approvals key and the shown session's consent requests. They
// replaced these tiles' raw task-record receipts (MOVED, lane BF3).
claimRailWidget('ledger', LEDGER_ID)
claimRailWidget('approvals', APPROVALS_ID)

/** Tile marks, every one from the icon cut through the SDK Icon (icon-cut.html; inhabitants/sdk/icons.ts): the rail draws
 * them in the tile's head and, at preview scale, in its launcher cell. */
export const TILE_ICONS: Record<AgentTileId, IconName> = {
  sessions: 'session',
  agents: 'bind',
  terminal: 'keys',
  files: 'lib',
  web: 'browser',
  graph: 'orbit',
  diff: 'select',
  frames: 'link',
  ledger: 'chain',
  approvals: 'arm',
}

const TILE_TITLES: Record<AgentTileId, string> = {
  sessions: 'Sessions',
  agents: 'Agents',
  terminal: 'Terminal',
  files: 'Files',
  web: 'Web',
  graph: 'Graph',
  diff: 'Diff',
  frames: 'Frames',
  ledger: 'Ledger',
  approvals: 'Approvals',
}
export const tileTitle = (id: AgentTileId): string => TILE_TITLES[id] ?? id

/** An owner reading as designed rows: scalar fields one level deep as kv
 * rows, the full document folded as the receipt. The raw JSON is never the
 * surface — it is the receipt. */
function ReadingRows({label, text, loading}: {label: string; text: string | null; loading?: boolean}) {
  let document: unknown = null
  if (text && (text.startsWith('{') || text.startsWith('['))) {
    try { document = JSON.parse(text) } catch { document = null }
  }
  const rows = scalarEntries(document)
  return (
    <section className="native-context-panel" aria-label={label}>
      <h4>{label}</h4>
      {loading
        ? <p role="status" className="agent-disclosed">Reading…</p>
        : rows.length > 0
          ? (
            <>
              {rows.map(([key, value]) => (
                <div className="agent-kv" key={key} style={{padding: '1px 0'}}>
                  <span>{key}</span>
                  <span>{String(value)}</span>
                </div>
              ))}
              <details className="agent-fold" style={{borderTop: 'none', marginTop: 2}}>
                <summary>Receipt</summary>
                <pre style={{fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0 0', maxHeight: 140, overflow: 'auto'}}>{text}</pre>
              </details>
            </>
          )
          : (
            <>
              <p className="agent-disclosed" style={{margin: '0 0 4px'}}>{text ?? '—'}</p>
              {text && (text.startsWith('{') || text.startsWith('[')) && (
                <details className="agent-fold" style={{borderTop: 'none'}}>
                  <summary>Receipt</summary>
                  <pre style={{fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0 0', maxHeight: 140, overflow: 'auto'}}>{text}</pre>
                </details>
              )}
            </>
          )}
    </section>
  )
}

export function AgentDockTileBody({id, sessionRef}: {id: AgentTileId; sessionRef: string | null}) {
  const {transport} = useWorkspace()
  const [diff, setDiff] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [gitNote, setGitNote] = useState<string | null>(null)

  useEffect(() => {
    if (id !== 'diff') return
    let live = true
    setDiffLoading(true)
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) {
          setDiff(transport.reason ?? 'Unavailable')
          setDiffLoading(false)
        }
        return
      }
      const repo = await kernelOp(transport, {op: 'git_repository_read', project: 'O-I'})
      if (!live) return
      if (repo.error || repo.outcome?.result !== 'git_repository_reading') {
        setDiff(repo.error ?? 'git_repository_read unavailable')
        setDiffLoading(false)
        return
      }
      const doc = repo.outcome.document as {repo_root?: string; head?: string} | undefined
      const root = doc?.repo_root
      if (!root) {
        setDiff('Repository root not disclosed')
        setDiffLoading(false)
        return
      }
      const patch = await kernelOp(transport, {
        op: 'git_diff_read',
        request: {repo_root: root, from: 'HEAD', to: 'working-tree', max_bytes: 48_000, max_files: 40},
      })
      if (!live) return
      if (patch.error || patch.outcome?.result !== 'git_diff_reading') {
        setDiff(patch.error ?? 'git_diff_read unavailable')
      } else {
        setDiff(safeJson(patch.outcome.document))
      }
      setDiffLoading(false)
    })()
    return () => { live = false }
  }, [id, transport])

  useEffect(() => {
    if (id !== 'files') return
    let live = true
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) setGitNote(transport.reason ?? 'Unavailable')
        return
      }
      const git = await kernelOp(transport, {op: 'git_repository_read', project: 'O-I'})
      if (!live) return
      setGitNote(git.error ?? safeJson(git.outcome?.result === 'git_repository_reading' ? git.outcome.document : git.outcome))
    })()
    return () => { live = false }
  }, [id, transport])

  if (id === 'sessions') return <NativeContextPanel project="O-I" />
  if (id === 'agents') return <NativeContextPanel project="O-I" initialTab="agents" />
  if (id === 'ledger' || id === 'approvals') { const Device = deviceWidget(`${DEVICE_WIDGET_PREFIX}${id === 'ledger' ? LEDGER_ID : APPROVALS_ID}`).Body; return <Device subject={sessionRef} pinned={false} /> }
  if (id === 'diff') return <ReadingRows label="git_diff_read · seat" text={diff} loading={diffLoading} />
  if (id === 'frames') { const Frames = deviceWidget(`${DEVICE_WIDGET_PREFIX}${FRAMES_ID}`).Body; return <Frames subject={sessionRef} pinned={false} /> }
  if (id === 'files') return <ReadingRows label="git_repository_read · O-I" text={gitNote} />
  if (id === 'graph') return <ReadingRows label="Graph" text="Open Bimba / knowledge graph from the world browser; no kernel graph_read in this shell yet." />
  if (id === 'web') return <ReadingRows label="Web" text="Browser surfaces live in the workbench; agent shell exposes git and harness readings here." />
  if (id === 'terminal') return <ReadingRows label="Terminal" text="Terminal tiles reconcile through workbench terminal_reconcile; use Workbench Terminal for live PTY." />
  return <ReadingRows label={TILE_TITLES[id] ?? id} text="No native inspector registered for this tile." />
}
