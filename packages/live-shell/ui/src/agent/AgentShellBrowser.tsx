import {useEffect, useMemo, useState} from 'react'
import type {AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import {AgentDevicePool} from './AgentDevicePool'
import {useAgentShell} from './AgentShellContext'
import {useWorkspace} from '../shell/workspaceContext'
import {useHarnessBinding} from './useHarnessBinding'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import './agentShell.css'

const CATEGORIES = [
  {id: 'sess', label: 'Sessions'},
  {id: 'context', label: 'Context'},
  {id: 'agents', label: 'Agents'},
  {id: 'skillsets', label: 'Skillsets'},
  {id: 'git', label: 'Git'},
] as const

const CONTEXT_TILES = [
  {id: 'sessions' as const, name: 'Sessions'},
  {id: 'terminal' as const, name: 'Terminal'},
  {id: 'files' as const, name: 'Files'},
  {id: 'web' as const, name: 'Web'},
  {id: 'graph' as const, name: 'Graph'},
  {id: 'diff' as const, name: 'Diff'},
  {id: 'frames' as const, name: 'Frames'},
  {id: 'ledger' as const, name: 'Ledger'},
  {id: 'approvals' as const, name: 'Approvals'},
  {id: 'agents' as const, name: 'Agents'},
]

const SKILLSETS = ['Porting', 'Review', 'Research', 'Ops']

export function AgentShellBrowser({rows, error, loading}: {rows: AgencySessionRow[]; error: string | null; loading: boolean}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('sess')
  const shell = useAgentShell()
  const {transport} = useWorkspace()
  const {binding} = useHarnessBinding(transport)
  const [gatewayNote, setGatewayNote] = useState('Reading gateway…')
  const [gitNote, setGitNote] = useState('Reading seat…')

  useEffect(() => {
    let live = true
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) {
          setGatewayNote(transport.reason ?? 'Transport unavailable')
          setGitNote('Workcell unavailable')
        }
        return
      }
      const gateway = await kernelOp(transport, {op: 'harness_agent_read', binding})
      if (live) {
        setGatewayNote(gateway.error ?? JSON.stringify(gateway.outcome).slice(0, 200))
      }
      const git = await kernelOp(transport, {op: 'git_repository_read', project: 'O-I'})
      if (live) setGitNote(git.error ?? JSON.stringify(git.outcome).slice(0, 200))
    })()
    return () => { live = false }
  }, [transport, binding])

  const list = useMemo(() => {
    if (category === 'sess') return rows.map(row => ({key: `${row.spaceRef}:${row.sessionRef}`, label: row.purpose ?? row.sessionRef, meta: row.agentRef ?? row.spaceLabel ?? ''}))
    if (category === 'context') return CONTEXT_TILES.map(tile => ({key: tile.id, label: tile.name, meta: shell.openTiles.includes(tile.id) ? '● open' : ''}))
    if (category === 'git') return [{key: 'seat', label: 'Git · seat (env-1)', meta: 'workcell'}]
    if (category === 'skillsets') return SKILLSETS.map(name => ({key: name, label: `Skillset · ${name}`, meta: 'drop on chain'}))
    if (category === 'agents') {
      const names = [...new Set(rows.map(row => row.agentRef).filter((value): value is string => !!value))]
      return names.length ? names.map(name => ({key: name, label: name, meta: 'agent'})) : [{key: 'empty-agents', label: loading ? 'Reading…' : 'No agent_ref disclosed yet.', meta: ''}]
    }
    return [{key: 'empty', label: loading ? 'Reading…' : 'Nothing disclosed for this category yet.', meta: ''}]
  }, [category, rows, shell.openTiles, loading])

  return (
    <aside className="agent-shell-browser" data-region="browser">
      <div className="browser-search"><input readOnly placeholder="Search (⌘F)" aria-label="Search browser" /></div>
      <div className="browser-columns">
        <nav className="agent-bcats" aria-label="Browser categories">
          {CATEGORIES.map(cat => (
            <button key={cat.id} type="button" className={'agent-bcat' + (category === cat.id ? ' on' : '')} onClick={() => setCategory(cat.id)}>{cat.label}</button>
          ))}
        </nav>
        <div className="browser-results">
          {error && <p className="native-error" role="alert">{error}</p>}
          {list.map(item => (
            <button
              key={item.key}
              type="button"
              className="browser-item"
              onClick={() => {
                if (category === 'context') shell.toggleTile(item.key as typeof CONTEXT_TILES[number]['id'])
                if (category === 'git') shell.toggleTile('diff')
                if (category === 'sess') {
                  shell.setSelectedTrackId(item.key)
                  shell.openThread(item.key)
                }
              }}
            >
              <span>{item.label}</span>
              <span className="tag">{item.meta}</span>
            </button>
          ))}
        </div>
      </div>
      <AgentDevicePool
        gatewayNote={gatewayNote}
        gitNote={gitNote}
        effort={shell.effort}
        autonomy={shell.steer ? 'steer' : 'review'}
        budgetUsed={0}
        budgetCap={12}
      />
    </aside>
  )
}
