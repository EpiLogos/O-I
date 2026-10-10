import {useState, type CSSProperties} from 'react'
import {AgentDockTileBody, TILE_ICONS, tileTitle} from './AgentDockTileBody'
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

/** A launcher preview cell's body: a tiny honest hint of the tile, drawn in
 * mono over the .pv well (mockup .lcell .pv geometry). */
function LauncherPreview({id}: {id: AgentTileId}) {
  const previews: Partial<Record<AgentTileId, string>> = {
    sessions: '▸ space ▸ session',
    terminal: '$ …',
    files: '▾ repo/  M …',
    web: 'url …',
    graph: '◦—◦',
    diff: '+ … − …',
    frames: 'tool.start …',
    ledger: '#… receipt',
    approvals: '◆ proposal',
    agents: '◦ agent',
  }
  return (
    <span className="pv">
      <span style={{fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--text-faint)', padding: 5, display: 'block', whiteSpace: 'pre'}}>
        {previews[id] ?? '…'}
      </span>
    </span>
  )
}

export function AgentContextDock() {
  const shell = useAgentShell()
  const {transport} = useWorkspace()
  const {tracks} = useAgencySessions(transport)
  const track = tracks.find(item => item.id === shell.selectedTrackId) ?? tracks[0]
  const sessionRef = track?.sessionRef ?? null
  const [query, setQuery] = useState('')
  const filtered = LAUNCHER.filter(item => !query.trim() || item.label.toLowerCase().includes(query.toLowerCase()))
  // The mockup's widen step: ±260, bounded 260–900; tiles reflow into columns.
  const widen = (delta: number) => shell.setDockWidth(Math.max(260, Math.min(900, shell.dockWidth + delta)))
  return (
    <aside className="agent-context-dock" data-region="context-dock" style={{width: shell.dockWidth}}>
      <div className="agent-tilesh">
        <span>Context</span>
        <span className="agent-disclosed">{shell.openTiles.length} open</span>
        <span className="r">
          <button type="button" id="narrower" data-i={AGENT_DATA_I.narrower} title={AGENT_TRANSPORT_TIPS.narrower} onClick={() => widen(-40)}>⇥</button>
          <button type="button" id="wider" data-i={AGENT_DATA_I.wider} title={AGENT_TRANSPORT_TIPS.wider} onClick={() => widen(40)}>⇤</button>
        </span>
      </div>
      <div className="agent-tiles" style={{gridTemplateColumns: shell.dockWidth >= 560 ? '1fr 1fr' : '1fr'} as CSSProperties}>
        {shell.openTiles.map(id => (
          <section key={id} className="agent-tile">
            <div className="agent-tile-h">
              {TILE_ICONS[id]}
              <span className="t">{tileTitle(id)}</span>
              <span className="x">
                <span role="button" tabIndex={0} data-i={AGENT_DATA_I.close} title="Close the tile; it stays in the launcher."
                  onClick={() => shell.toggleTile(id)}
                  onKeyDown={event => { if (event.key === 'Enter') shell.toggleTile(id) }}
                  aria-label={`Close ${id} tile`}
                >✕</span>
              </span>
            </div>
            <div className="agent-tile-b"><AgentDockTileBody id={id} sessionRef={sessionRef} /></div>
          </section>
        )) || []}
      </div>
      {shell.openTiles.length === 0 && (
        <p className="agent-empty-note">Open context from the launcher below.</p>
      )}
      <section className={'agent-launch' + (shell.dockFolded ? ' folded' : '')}>
        <div className="agent-lh">
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Open context… terminal, files, web" aria-label="Open context" />
          <button type="button" className="f" id="lfold" data-i={AGENT_DATA_I.lfold} title={AGENT_TRANSPORT_TIPS.fold} onClick={() => shell.setDockFolded(!shell.dockFolded)}>{shell.dockFolded ? '▴' : '▾'}</button>
        </div>
        {!shell.dockFolded && (
          <div className="agent-lgrid">
            {filtered.map(item => (
              <button
                key={item.id} type="button"
                className={'agent-lcell' + (shell.openTiles.includes(item.id) ? ' on' : '')}
                data-i={`${item.label}|Click to open or close it above.`}
                onClick={() => shell.toggleTile(item.id)}
              >
                <LauncherPreview id={item.id} />
                <span className="nm">{TILE_ICONS[item.id]}{item.label}</span>
                {shell.openTiles.includes(item.id) && <span className="dot" />}
              </button>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}
