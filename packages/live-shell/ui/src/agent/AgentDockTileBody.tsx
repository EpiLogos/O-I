import {useEffect, useState, type ReactElement} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {CutIcon} from './agentIcons'
import {NativeContextPanel} from '../components/NativeContextPanel'
import {useWorkspace} from '../shell/workspaceContext'
import {scalarEntries, safeJson} from './RefusalCard'
import type {AgentTileId} from './AgentShellContext'
import {useHarnessBinding} from './useHarnessBinding'

/** Tile marks: the specimen's where it has one (dock = companion, folder =
 * files family, link = frames); otherwise a monoline mark held to the
 * specimen's drawing conventions (24 viewBox, stroke 1.7, round caps) —
 * named as convention-held in the lane return, not silently invented. */
const held = (inner: string, size = 12): ReactElement => (
  <span
    aria-hidden
    style={{display: 'inline-flex', lineHeight: 0}}
    dangerouslySetInnerHTML={{__html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`}}
  />
)

export const TILE_ICONS: Record<AgentTileId, ReactElement> = {
  sessions: held('<path d="M4 5h6M8 12h8M8 19h8M6 5v14"/>'),
  agents: <CutIcon name="dock" size={12} />,
  terminal: held('<path d="M5 6.5l5 5-5 5M12 17h7"/>'),
  files: held('<path d="M3.5 6.5a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/>'),
  web: <CutIcon name="browser" size={12} />,
  graph: held('<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4V4M12 14.6V20M9.4 12H4M14.6 12H20"/>'),
  diff: held('<path d="M8 4v10M4 8h8"/><path d="M16 11v9M12 15.5h8"/>'),
  frames: <CutIcon name="link" size={12} />,
  ledger: held('<path d="M5 6h14M5 12h10M5 18h13"/>'),
  approvals: held('<path d="M12 4l7 8-7 8-7-8z"/>'),
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
  const {binding} = useHarnessBinding(transport)
  const [ledger, setLedger] = useState<string | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [diff, setDiff] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [frames, setFrames] = useState<string | null>(null)
  const [framesLoading, setFramesLoading] = useState(false)
  const [gitNote, setGitNote] = useState<string | null>(null)

  useEffect(() => {
    if (id !== 'ledger' && id !== 'approvals') return
    let live = true
    setLedgerLoading(true)
    void (async () => {
      if (transport.kind === 'unavailable' || !sessionRef) {
        if (live) {
          setLedger(transport.kind === 'unavailable' ? transport.reason ?? 'Unavailable' : 'Select a session track')
          setLedgerLoading(false)
        }
        return
      }
      const task = await kernelOp(transport, {op: 'encounter_task_read', project: 'O-I', agent_session: sessionRef})
      if (!live) return
      if (task.error || task.outcome?.result !== 'encounter_task_reading') {
        setLedger(task.error ?? 'Task reading unavailable')
      } else {
        setLedger(safeJson(task.outcome.data))
      }
      setLedgerLoading(false)
    })()
    return () => { live = false }
  }, [id, sessionRef, transport])

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
    if (id !== 'frames') return
    let live = true
    setFramesLoading(true)
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) {
          setFrames(transport.reason ?? 'Unavailable')
          setFramesLoading(false)
        }
        return
      }
      const gateway = await kernelOp(transport, {op: 'harness_agent_read', binding})
      if (!live) return
      if (gateway.error || gateway.outcome?.result !== 'harness_agent_reading') {
        setFrames(gateway.error ?? 'Harness gateway unavailable')
      } else {
        setFrames(safeJson(gateway.outcome.document))
      }
      setFramesLoading(false)
    })()
    return () => { live = false }
  }, [id, transport, binding])

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
  if (id === 'ledger') return <ReadingRows label="Encounter task (ledger basis)" text={ledger} loading={ledgerLoading} />
  if (id === 'approvals') return <ReadingRows label="Task record (approval hooks)" text={ledger} loading={ledgerLoading} />
  if (id === 'diff') return <ReadingRows label="git_diff_read · seat" text={diff} loading={diffLoading} />
  if (id === 'frames') return <ReadingRows label="Harness gateway (frame monitor basis)" text={frames} loading={framesLoading} />
  if (id === 'files') return <ReadingRows label="git_repository_read · O-I" text={gitNote} />
  if (id === 'graph') return <ReadingRows label="Graph" text="Open Bimba / knowledge graph from the world browser; no kernel graph_read in this shell yet." />
  if (id === 'web') return <ReadingRows label="Web" text="Browser surfaces live in the workbench; agent shell exposes git and harness readings here." />
  if (id === 'terminal') return <ReadingRows label="Terminal" text="Terminal tiles reconcile through workbench terminal_reconcile; use Workbench Terminal for live PTY." />
  return <ReadingRows label={TILE_TITLES[id] ?? id} text="No native inspector registered for this tile." />
}
