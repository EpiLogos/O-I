// The world's widgets (FOUNDATION F8), one registration: every tile of the two old docks — the mode dock's (the agent of the
// mode in front of you, the packet, the trail, the field, the NOWs, results, the sky) and the agent dock's (sessions,
// agents, terminal, files, web, graph, diff, frames, ledger, approvals) — as widgets of the one rail. The agent, the packet
// and the trail are their own bodies (src/widgets/, shell/TrailWidget.tsx): the real conversation, the owner's prepared
// context and THE selection's stops. Every other body is the old tile's body, unchanged; where both docks had a tile of
// the same id, the agent dock's reads its owner and stands. The bodies read what the App hands them (widgets/widgetReading).
import type {ComponentType} from 'react'
import type {SurfMode} from './modeGrammar'
import type {WidgetBodyProps, WidgetDeclaration} from '../frame/widgets/widgets'
import {COMPANIONS, TILES} from './modeDockTiles'
import {DEVICE_TILES, TILE_ICONS, tileTitle} from '../agent/agentDockTiles'
import {useAgentShell, type AgentTileId} from '../agent/AgentShellContext'
import {useAgencySessions} from '../agent/useAgencySessions'
import {useWidgetReading} from '../widgets/widgetReading'
import {AgentWidgetName} from '../widgets/AgentWidgetName'
import {loadWhenDrawn} from './loadWhenDrawn'
import {getPanels} from './panels'
import {panelWidgets} from '../frame/widgets/panelWidgets'
// The devices born on the rail claim the rail's widget of their id when their module loads (widgets/railDevices.tsx).
import '../widgets/railDevices'

export {WidgetReadingProvider, type WidgetReading} from '../widgets/widgetReading'

// The bodies load when a widget first draws on the rail, not with the shell: the rail's names and marks above stand without
// them (shell/loadWhenDrawn.ts; scripts/load-census.mjs).
const TileBody = loadWhenDrawn('The mode dock\'s tiles', () => import('./ModeContextDock').then(module => module.TileBody))
const TrailWidget = loadWhenDrawn('Trail', () => import('./TrailWidget').then(module => module.TrailWidget))
const AgentDockTileBody = loadWhenDrawn('The agent dock\'s tiles', () => import('../agent/AgentDockTileBody').then(module => module.AgentDockTileBody))
const AgentWidget = loadWhenDrawn('Agent', () => import('../widgets/AgentWidget').then(module => module.AgentWidget))
const PacketWidget = loadWhenDrawn('Packet', () => import('../widgets/PacketWidget').then(module => module.PacketWidget))

/** A mode-dock tile as a widget body: the tile's own body over the reading. */
const modeTile = (id: string) => function ModeTileWidget() {
  const reading = useWidgetReading()
  return reading ? <TileBody id={id} mode={reading.mode} world={reading.world} transport={reading.transport} subject={reading.subject} /> : null
}
/** An agent-dock tile as a widget body: the tile's own body over the selected session (as the agent dock read it). */
const agentTile = (id: AgentTileId) => function AgentTileWidget() {
  const reading = useWidgetReading()
  const shell = useAgentShell()
  const {tracks} = useAgencySessions(reading?.transport ?? {kind: 'unavailable', reason: 'no carrier'})
  const track = tracks.find(item => item.id === shell.selectedTrackId) ?? tracks[0]
  return <AgentDockTileBody id={id} sessionRef={track?.sessionRef ?? null} />
}

// Sessions, Agents and Results are views now, not widgets (DLW §16.1 "The views are not devices"; lock §0.3.1; R4): the sessions are
// Factory's tracks, the agents at work their needles, a run's results its takes in Arrangement view.
const MODE_TILES = ['packet', 'trail', 'field', 'nows', 'sky'] as const
const AGENT_TILES: readonly AgentTileId[] = ['terminal', 'files', 'web', 'graph', 'diff', 'frames', 'ledger', 'approvals']
/** The tiles that are their own widget bodies now, by id. */
const OWN_BODIES: Partial<Record<string, ComponentType<WidgetBodyProps>>> = {packet: PacketWidget, trail: TrailWidget}
/** What each holds, for its launcher cell (the mockup's WID hints, world-shell-mockup.html 1624–1626). */
const HINTS: Record<string, string> = {
  packet: 'exactly what the agent will receive', trail: 'every place you went, to return to', field: 'who is present; what waits for admission',
  nows: 'the day and its Now', results: 'run results and diffs', sky: 'the dated sky', sessions: 'the agency\'s sessions',
  agents: 'agents at work', terminal: 'the sessions\' shells', files: 'the seat\'s repository', web: 'web surfaces',
  graph: 'the knowledge graph', diff: 'the seat\'s working diff', frames: 'the harness gateway', ledger: 'the task record',
  approvals: 'the task\'s approval hooks',
}

/** The devices born on the rail that no old tile held (DLW §23): registered so the rail lists them; each draws its device
 * (widgets/railDevices.tsx claims it), so the body here never draws. */
const RAIL_BORN: readonly WidgetDeclaration[] = [
  {id: 'wiki', name: 'Wiki', mark: 'orbit', hint: 'the wiki pages an agent may use, read here', Body: () => null},
  {id: 'calendar', name: 'Calendar', mark: 'metro', hint: 'what is due around your work, from a calendar provider', Body: () => null},
]

/** The devices' own tiles that no old tile held — Messages (DLW §19.24), Gateways (§19.3) and the Workcells tile (§19.23 Widget): registered
 * so the rail lists them; agent/agentDockTiles.ts claims each for its device, so the body here never draws. */
const DEVICE_BORN: readonly WidgetDeclaration[] = DEVICE_TILES.map((tile): WidgetDeclaration => ({...tile, Body: () => null}))

export const WIDGETS: readonly WidgetDeclaration[] = [
  // Messages is the rail's first device (§19.24 "born on the widget rail … in every mode").
  ...DEVICE_BORN.filter(widget => widget.id === 'messages'),
  {id: 'agent', name: 'Agent', Name: AgentWidgetName, mark: TILES.agent.mark, hint: 'the agent you are talking to', Body: AgentWidget},
  ...MODE_TILES.map((id): WidgetDeclaration => ({id, name: TILES[id].name, mark: TILES[id].mark, hint: HINTS[id], Body: OWN_BODIES[id] ?? modeTile(id)})),
  ...AGENT_TILES.map((id): WidgetDeclaration => ({id, name: tileTitle(id), mark: TILE_ICONS[id], hint: HINTS[id], Body: agentTile(id)})),
  ...RAIL_BORN,
  // Gateways and the Workcells tile after the old tiles.
  ...DEVICE_BORN.filter(widget => widget.id !== 'messages'),
]

/** Every widget of the world: the rail's own, then each panel a family registers in the widget slot (frame/widgets/
 * panelWidgets.ts) — read when the rail draws, so a family admitted after boot stands in the rail too. */
export function worldWidgets(): readonly WidgetDeclaration[] {
  return [...WIDGETS, ...panelWidgets(getPanels('right-dock'), new Set(WIDGETS.map(widget => widget.id)))]
}

export {DEFAULT_WIDGETS} from './widgetDefaults'

/** The companion's name in a mode, for the agent widget's title where a caller needs it. */
export const companionOf = (mode: SurfMode): string => COMPANIONS[mode].name
