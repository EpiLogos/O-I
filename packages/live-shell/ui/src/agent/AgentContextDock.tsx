import {useState} from 'react'
import {AgentDockTileBody} from './AgentDockTileBody'
import {AGENT_DATA_I, AGENT_TRANSPORT_TIPS} from './agentFidelity'
import {useAgentShell, type AgentTileId} from './AgentShellContext'
import {useAgencySessions} from './useAgencySessions'
import {useWorkspace} from '../shell/workspaceContext'
import './agentShell.css'

const LAUNCHER: {id: AgentTileId; label: string}[] = [
  {id: 'sessions', label: 'Sessions'},
  {id: 'terminal', label: 'Terminal'},
  {id: 'files', label: 'Files'},
  {id: 'web', label: 'Web'},
  {id: 'graph', label: 'Graph'},
  {id: 'diff', label: 'Diff'},
  {id: 'frames', label: 'Frames'},
  {id: 'ledger', label: 'Ledger'},
  {id: 'approvals', label: 'Approvals'},
  {id: 'agents', label: 'Agents'},
]

export function AgentContextDock() {
  const shell = useAgentShell()
  const {transport} = useWorkspace()
  const {tracks} = useAgencySessions(transport)
  const track = tracks.find(item => item.id === shell.selectedTrackId) ?? tracks[0]
  const sessionRef = track?.sessionRef ?? null
  const [query, setQuery] = useState('')
  const filtered = LAUNCHER.filter(item => !query.trim() || item.label.toLowerCase().includes(query.toLowerCase()))
  const widen = (delta: number) => shell.setDockWidth(Math.max(180, Math.min(640, shell.dockWidth + delta)))
  return (
    <aside className="agent-context-dock" data-region="context-dock" style={{width: shell.dockWidth}}>
      <div className="agent-tile-h">
        Context · {shell.openTiles.length} tile(s)
        <span style={{float: 'right', display: 'inline-flex', gap: 4}}>
          <button type="button" id="narrower" data-i={AGENT_DATA_I.narrower} title={AGENT_TRANSPORT_TIPS.narrower} onClick={() => widen(-40)}>⇥</button>
          <button type="button" id="wider" data-i={AGENT_DATA_I.wider} title={AGENT_TRANSPORT_TIPS.wider} onClick={() => widen(40)}>⇤</button>
        </span>
      </div>
      <div className="agent-tiles" style={{gridTemplateColumns: shell.dockWidth >= 420 ? '1fr 1fr' : '1fr'}}>
        {shell.openTiles.map(id => (
          <section key={id} className="agent-tile">
            <div className="agent-tile-h">{id}<button type="button" style={{float: 'right'}} onClick={() => shell.toggleTile(id)} aria-label="Close tile">✕</button></div>
            <div style={{flex: 1, minHeight: 0, overflow: 'auto'}}><AgentDockTileBody id={id} sessionRef={sessionRef} /></div>
          </section>
        ))}
      </div>
      <section className={'agent-launch' + (shell.dockFolded ? ' folded' : '')}>
        <div style={{display: 'flex', gap: 4}}>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Open context… terminal, files, web" aria-label="Open context" />
          <button type="button" id="lfold" data-i={AGENT_DATA_I.lfold} title={AGENT_TRANSPORT_TIPS.fold} onClick={() => shell.setDockFolded(!shell.dockFolded)}>{shell.dockFolded ? '▾' : '▴'}</button>
        </div>
        {!shell.dockFolded && (
          <div className="agent-lgrid">
            {filtered.map(item => (
              <button key={item.id} type="button" className="browser-item" onClick={() => shell.toggleTile(item.id)}>{item.label}</button>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}
