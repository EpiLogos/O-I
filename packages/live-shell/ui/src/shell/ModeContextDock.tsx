/**
 * The per-mode context dock — Revision 4's right side: the context tiles
 * above (the agent per mode — Fizz / Anima / Epii — Packet, Trail, Field,
 * Agents, Terminal, Results, Sky, NOWs), the launcher below that opens
 * tiles and never feeds the centre, and the resize wedge on the left edge
 * that exists only while the dock is open (the toggle collapses cleanly —
 * the wedge stays dead).
 *
 * Every tile body composes what IS landed and readable — the agency
 * reading (real sessions), the civil day/NOW (the one temporal reading),
 * the selected subject — and renders a DESIGNED frame naming its owner
 * read where no owner lands. No fabricated activity anywhere (the honesty
 * boundaries). Tile headers carry the pin and close marks (the guide's §3.8
 * dock law); the launcher's cells open and close tiles; search filters.
 *
 * Per-mode identities are the grammar's world (Rev 3's companion column):
 * Base = the situated agent, Expressions = Anima, Technē = Epii. Pure
 * presentation over landed readings: no second store, no owner writes.
 */

import {TrailWidget} from './TrailWidget'
import {useRef, useState, type PointerEvent as ReactPointerEvent} from 'react'
import {MODE_GRAMMAR, type SurfMode} from './modeGrammar'
import {useAgencySessions} from '../agent/useAgencySessions'
import {Icon} from '../inhabitants/sdk/Icon'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {carrierOf} from './runContext'
import './modeSurface.css'
import {COMPANIONS, TILES} from './modeDockTiles'

export {COMPANIONS, TILES} from './modeDockTiles'

/** Per-mode tile sets and defaults (Rev 4's tile set, per arrangement). */
const DOCKS: Record<SurfMode, {tiles: string[]; open: string[]}> = {
  live: {tiles: ['agent', 'trail', 'nows'], open: ['agent']},
  base: {tiles: ['agent', 'packet', 'trail', 'field', 'agents', 'nows'], open: ['agent', 'packet', 'trail']},
  factory: {tiles: ['agents', 'terminal', 'results'], open: []},
  expressions: {tiles: ['agent', 'packet', 'trail', 'agents'], open: ['agent']},
  techne: {tiles: ['agent', 'field', 'trail', 'agents', 'nows'], open: ['agent', 'field', 'trail']},
}

export function ModeContextDock({mode, world, transport, subject, initialOpen}: {
  mode: SurfMode
  /** The World cut's one temporal reading (the NOWs tile reads it). */
  world: WorldTimelineView | null
  /** The kernel carrier — the agents tile reads the agency surface through it. */
  transport: KernelTransportStatus
  /** The selected Central subject, when one is selected. */
  subject: CentralSubjectSelection | null
  /** Override the mode's default open set (the harness's entry). */
  initialOpen?: string[]
}) {
  const dock = DOCKS[mode]
  const [open, setOpen] = useState<string[]>(() => (initialOpen ?? dock.open).filter(id => !TILES[id]?.launcherOnly))
  const [pinned, setPinned] = useState<string[]>([])
  const [needle, setNeedle] = useState('')
  const frameRef = useRef<HTMLElement | null>(null)

  const openTiles = open.map(id => TILES[id]).filter(Boolean)
  const launcherQuery = needle.trim().toLocaleLowerCase()
  const launcherTiles = dock.tiles
    .map(id => TILES[id]).filter(Boolean)
    .filter(tile => !launcherQuery || tile.name.toLocaleLowerCase().includes(launcherQuery))

  const drag = (event: ReactPointerEvent) => {
    const frame = frameRef.current?.closest('.frame')
    if (!frame) return
    const startX = event.clientX
    const startWidth = parseInt(getComputedStyle(frame).getPropertyValue('--dock-w')) || 300
    const move = (moveEvent: PointerEvent) => {
      const width = Math.max(260, Math.min(900, startWidth + (startX - moveEvent.clientX)))
      ;(frame as HTMLElement).style.setProperty('--dock-w', `${Math.round(width)}px`)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return <aside ref={frameRef} className="mode-dock" data-mode-dock={mode} aria-label="Context dock">
    <div className="mode-dock-wedge" onPointerDown={drag} data-i="Resize|Drag left to give the context more room; tiles reflow. The wedge exists only while the dock is open."
      role="separator" aria-orientation="vertical" aria-label="Resize the context dock" />
    <div className="mode-dock-tilesh">
      <span>Context</span>
      <span className="mode-dock-count">{openTiles.length} open</span>
    </div>
    <div className="mode-dock-tiles">
      {openTiles.length === 0 && <div className="mode-dock-empty">Open context from the launcher below.</div>}
      {openTiles.map(tile => <section key={tile.id} className="mode-dock-tile" data-tile={tile.id}>
        <header className="mode-dock-tile-head">
          <span className="mode-dock-tile-mark"><Icon name={tile.mark} size={12} /></span>
          <span className="mode-dock-tile-name">{tile.id === 'agent' ? COMPANIONS[mode].name : tile.name}</span>
          <span className="mode-dock-tile-marks">
            <button type="button" aria-pressed={pinned.includes(tile.id)} aria-label={`Pin ${tile.name}`}
              data-i="Pin|Stop following; keep this view."
              title="Pin — stop following; keep this view."
              onClick={() => setPinned(current => current.includes(tile.id) ? current.filter(id => id !== tile.id) : [...current, tile.id])}>⌖</button>
            <button type="button" aria-label={`Close ${tile.name}`}
              data-i="Close|Close the tile; it stays in the launcher."
              title="Close — the tile stays in the launcher."
              onClick={() => setOpen(current => current.filter(id => id !== tile.id))}>✕</button>
          </span>
        </header>
        <div className="mode-dock-tile-body">
          <TileBody id={tile.id} mode={mode} world={world} transport={transport} subject={subject} />
        </div>
      </section>)}
    </div>
    <section className="mode-dock-launch" aria-label="Launcher">
      <div className="mode-dock-launch-head">
        <input type="search" value={needle} onChange={event => setNeedle(event.target.value)} placeholder="Open context…"
          data-i="Open context|search the dock's tiles; a cell opens or closes its tile above" aria-label="Open context" />
        <span className="mode-dock-launch-more" data-i="Library|the full context library is also in the browser" aria-hidden="true">⋯</span>
      </div>
      <div className="mode-dock-launch-grid">
        {launcherTiles.map(tile => {
          const isOpen = open.includes(tile.id)
          return <button key={tile.id} type="button" className={`mode-dock-cell${isOpen ? ' open' : ''}`}
            data-i={`${tile.name}|${isOpen ? 'close the tile' : 'open the tile'} — the launcher never feeds the centre`}
            aria-pressed={isOpen}
            onClick={() => setOpen(current => current.includes(tile.id) ? current.filter(id => id !== tile.id) : [...current, tile.id])}>
            <span className="mode-dock-cell-preview" aria-hidden="true"><Icon name={tile.mark} size={17} /></span>
            <span className="mode-dock-cell-name">{tile.id === 'agent' ? COMPANIONS[mode].name : tile.name}{isOpen && <span className="mode-dock-cell-dot" aria-label="open" />}</span>
          </button>
        })}
      </div>
      <button type="button" className="mode-dock-preset" disabled
        data-i="Curate|Save a composition of tiles as a context preset. The curate operation is not wired here yet; the button holds its place."
        title="Save current tiles as preset… — the curate operation is not wired here yet; the button holds its place.">
        + Save current tiles as preset…
      </button>
    </section>
  </aside>
}

/** One tile's body — the landed readings it composes, or the designed
 * frame naming its owner read. */
export function TileBody({id, mode, world, transport, subject}: {
  id: string
  mode: SurfMode
  world: WorldTimelineView | null
  transport: KernelTransportStatus
  subject: CentralSubjectSelection | null
}) {
  if (id === 'agent') {
    const companion = COMPANIONS[mode]
    return <div className="mode-dock-companion">
      <div className="mode-dock-companion-name"><b>{companion.name}</b><span>{MODE_GRAMMAR[mode].title}</span></div>
      <div className="mode-dock-companion-tabs">{companion.tabs}</div>
      <p className="mode-dock-note">{companion.note}</p>
    </div>
  }
  if (id === 'agents') return <AgentsTile transport={transport} />
  if (id === 'nows') {
    const source = world?.source
    const now = source?.status === 'live' ? source.now : null
    return <div className="mode-dock-rows">
      {now?.dayRef && <div className="mode-dock-row"><span>day</span><b>{now.dayRef}</b></div>}
      {now?.instantUnixMs != null && <div className="mode-dock-row"><span>now</span><b>{new Date(now.instantUnixMs).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</b></div>}
      {!now && <p className="mode-dock-note">The civil field is unread — the day and its Now land here when the kernel's temporal read answers.</p>}
    </div>
  }
  if (id === 'packet') {
    return <div className="mode-dock-rows">
      <div className="mode-dock-row"><span>subject</span><b>{subject ? subject.path.split('/').pop() : 'not selected'}</b></div>
      <p className="mode-dock-note">Exactly what the agent receives — selection · entry · document. Select a document in the browser; the packet composes from it in the Document detail.</p>
    </div>
  }
  if (id === 'trail') return <TrailWidget />
  if (id === 'field') {
    return <div className="mode-dock-rows">
      <div className="mode-dock-row"><span>carrier</span><b>{transport.kind === 'unavailable' ? '—' : carrierOf(transport)}</b></div>
      <p className="mode-dock-note">{mode === 'techne'
        ? 'The field\'s presence — other Worlds arriving. Presence lands here when the field carrier answers.'
        : 'The field around this ground — presence and arrivals land here when the carrier answers.'}</p>
    </div>
  }
  // The launcher-only tiles: designed frames naming their owner read.
  const owners: Record<string, string> = {
    terminal: 'the sessions\' shells — the terminal read is the agency surface\'s',
    files: 'the run\'s files — the agent/files inspection surface',
    results: 'run results and diffs — the Factory owner\'s receiving',
    sky: 'the sky\'s dated state — the QL family\'s sky owner',
  }
  return <p className="mode-dock-note">{owners[id] ?? 'its owner read'} — declared, waiting; the tile holds its place.</p>
}

/** The agents tile — the agency surface's OWN reading: one row per session,
 * its state as a light. A light is a reading, never decoration. */
function AgentsTile({transport}: {transport: KernelTransportStatus}) {
  const agency = useAgencySessions(transport)
  const tracks = agency.tracks.filter(track => !track.group)
  const stateColour: Record<string, string> = {live: 'var(--accent)', stalled: 'var(--stall)', idle: 'var(--text-faint)'}
  // One line per session (the mockup's agents tile, world-shell-mockup.html 1632): its light only where the reading states it.
  return <div className="mode-dock-lines" aria-label="Agents">
    {transport.kind === 'unavailable' && <p className="mode-dock-note">The carrier is unavailable — the agency reading waits: {transport.reason}</p>}
    {tracks.slice(0, 8).map(track => <div key={track.sessionRef} className="mode-dock-line" data-i={`${track.purpose ?? track.sessionRef}|${track.needle?.state ?? 'unknown'} — the agency surface's own reading`}>
      {stateColour[track.needle?.state ?? ''] && <span className="mode-dock-row-light" style={{background: stateColour[track.needle?.state ?? '']}} aria-hidden="true" />}
      <span className="mode-dock-line-text">{track.agentName && <b>{track.agentName} </b>}{track.purpose ?? track.sessionRef.slice(0, 24)}</span>
      <span className="mode-dock-line-meta">{track.needle?.state ?? '—'}</span>
    </div>)}
    {transport.kind !== 'unavailable' && !tracks.length && <p className="mode-dock-note">No sessions in the agency reading yet.</p>}
  </div>
}
