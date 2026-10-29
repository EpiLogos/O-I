import {useEffect, useState} from 'react'
import {kernelRead} from '../../../../../desktop/cradle/src/kernel/bridge'
import {NativeContextPanel} from '../components/NativeContextPanel'
import {useWorkspace} from '../shell/workspaceContext'
import {scalarEntries, safeJson} from './RefusalCard'
import type {AgentTileId} from './AgentShellContext'
import {DEVICE_WIDGET_PREFIX} from '../frame/devices/deviceDoor'
import {deviceWidget} from '../frame/widgets/deviceWidgets'
import {FRAMES_ID} from './devices/mainTrackBindings'
import {APPROVALS_ID, LEDGER_ID} from './devices/receiptBindings'
import {tileTitle} from './agentDockTiles'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {gitRepositoryAbsence, placeWord, projectOfSession} from './worldScope'

// The tiles' marks, titles and the rail widgets the Main track's devices claim stand in agentDockTiles.ts, so the rail has them
// before this body's code loads.
export {TILE_ICONS, tileTitle} from './agentDockTiles'

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

// No Diff tile (ticket 804): the seat's working diff is read on Files' Diff page (§23.4 "Reading what changed before you approve it … is
// the Diff page of Files"; widgets/railDevices.tsx useDiffReading, kernel git_diff_read through Central's central.git.diff).
export function AgentDockTileBody({id, sessionRef}: {id: AgentTileId; sessionRef: string | null}) {
  const {transport} = useWorkspace()
  const [gitNote, setGitNote] = useState<string | null>(null)
  // The tile's register: the selected session's own (agent/worldScope.ts), else your world's root register.
  const sessions = useAgentSessionsOptional()
  const project = projectOfSession(sessions?.rows ?? [], sessionRef)

  useEffect(() => {
    if (id !== 'files') return
    let live = true
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) setGitNote(transport.reason ?? 'Unavailable')
        return
      }
      const words = gitRepositoryAbsence(sessionRef, project)
      if (words) { if (live) setGitNote(words); return }
      const git = await kernelRead(transport, {op: 'git_repository_read', project})
      if (!live) return
      setGitNote(git.error ?? safeJson(git.outcome?.result === 'git_repository_reading' ? git.outcome.document : git.outcome))
    })()
    return () => { live = false }
  }, [id, transport, sessionRef, project])

  if (id === 'sessions') return <NativeContextPanel project={project} />
  if (id === 'agents') return <NativeContextPanel project={project} initialTab="agents" />
  if (id === 'ledger' || id === 'approvals') { const Device = deviceWidget(`${DEVICE_WIDGET_PREFIX}${id === 'ledger' ? LEDGER_ID : APPROVALS_ID}`).Body; return <Device subject={sessionRef} pinned={false} /> }
  if (id === 'frames') { const Frames = deviceWidget(`${DEVICE_WIDGET_PREFIX}${FRAMES_ID}`).Body; return <Frames subject={sessionRef} pinned={false} /> }
  if (id === 'files') return <ReadingRows label={`git_repository_read · ${placeWord(project)}`} text={gitNote} />
  if (id === 'graph') return <ReadingRows label="Graph" text="Open Bimba / knowledge graph from the world browser; no kernel graph_read in this shell yet." />
  if (id === 'web') return <ReadingRows label="Web" text="Browser surfaces live in the workbench; agent shell exposes git and harness readings here." />
  if (id === 'terminal') return <ReadingRows label="Terminal" text="Terminal tiles reconcile through workbench terminal_reconcile; use Workbench Terminal for live PTY." />
  return <ReadingRows label={tileTitle(id)} text="No native inspector registered for this tile." />
}
