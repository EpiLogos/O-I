import {useEffect, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {NativeContextPanel} from '../components/NativeContextPanel'
import {useWorkspace} from '../shell/workspaceContext'
import type {AgentTileId} from './AgentShellContext'
import {useHarnessBinding} from './useHarnessBinding'

function NativeReading({label, text, loading}: {label: string; text: string | null; loading?: boolean}) {
  return (
    <section className="native-context-panel" aria-label={label}>
      <h4>{label}</h4>
      {loading ? <p role="status">Reading…</p> : <pre style={{margin: 0, whiteSpace: 'pre-wrap', fontSize: 10}}>{text ?? '—'}</pre>}
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
        setLedger(JSON.stringify(task.outcome.data, null, 2))
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
        setDiff(patch.error ?? JSON.stringify(patch.outcome))
      } else {
        setDiff(JSON.stringify(patch.outcome.document, null, 2))
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
        setFrames(JSON.stringify(gateway.outcome.document, null, 2))
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
      setGitNote(git.error ?? JSON.stringify(git.outcome?.result === 'git_repository_reading' ? git.outcome.document : git.outcome, null, 2))
    })()
    return () => { live = false }
  }, [id, transport])

  if (id === 'sessions') return <NativeContextPanel project="O-I" />
  if (id === 'agents') return <NativeContextPanel project="O-I" initialTab="agents" />
  if (id === 'ledger') return <NativeReading label="Encounter task (ledger basis)" text={ledger} loading={ledgerLoading} />
  if (id === 'approvals') return <NativeReading label="Task record (approval hooks)" text={ledger} loading={ledgerLoading} />
  if (id === 'diff') return <NativeReading label="git_diff_read · seat" text={diff} loading={diffLoading} />
  if (id === 'frames') return <NativeReading label="Harness gateway (frame monitor basis)" text={frames} loading={framesLoading} />
  if (id === 'files') return <NativeReading label="git_repository_read · O-I" text={gitNote} />
  if (id === 'graph') return <NativeReading label="Graph" text="Open Bimba / knowledge graph from the world browser; no kernel graph_read in this shell yet." />
  if (id === 'web') return <NativeReading label="Web" text="Browser surfaces live in the workbench; agent shell exposes git and harness readings here." />
  if (id === 'terminal') return <NativeReading label="Terminal" text="Terminal tiles reconcile through workbench terminal_reconcile; use Workbench Terminal for live PTY." />
  return <NativeReading label={id} text="No native inspector registered for this tile." />
}
