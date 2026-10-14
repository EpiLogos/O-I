// The world's widgets (FOUNDATION F8), one registration: every tile of the two old docks — the mode dock's (the agent of the
// mode in front of you, the packet, the trail, the field, the NOWs, results, the sky) and the agent dock's (sessions,
// agents, terminal, files, web, graph, diff, frames, ledger, approvals) — as widgets of the one rail. Each body is the old
// tile's body, unchanged; where both docks had a tile of the same id, the agent dock's reads its owner and stands.
// The bodies read what the App hands them through WidgetReadingContext.
import {createContext, useContext, type ReactNode} from 'react'
import type {SurfMode} from './modeGrammar'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import type {WidgetDeclaration} from '../frame/widgets/widgets'
import {COMPANIONS, TILES, TileBody} from './ModeContextDock'
import {AgentDockTileBody, TILE_ICONS, tileTitle} from '../agent/AgentDockTileBody'
import {useAgentShell, type AgentTileId} from '../agent/AgentShellContext'
import {useAgencySessions} from '../agent/useAgencySessions'

export interface WidgetReading {
  mode: SurfMode
  world: WorldTimelineView | null
  transport: KernelTransportStatus
  subject: CentralSubjectSelection | null
}

const WidgetReadingContext = createContext<WidgetReading | null>(null)
export function WidgetReadingProvider({value, children}: {value: WidgetReading; children: ReactNode}) {
  return <WidgetReadingContext.Provider value={value}>{children}</WidgetReadingContext.Provider>
}

/** A mode-dock tile as a widget body: the tile's own body over the reading. */
const modeTile = (id: string) => function ModeTileWidget() {
  const reading = useContext(WidgetReadingContext)
  return reading ? <TileBody id={id} mode={reading.mode} world={reading.world} transport={reading.transport} subject={reading.subject} /> : null
}
/** An agent-dock tile as a widget body: the tile's own body over the selected session (as the agent dock read it). */
const agentTile = (id: AgentTileId) => function AgentTileWidget() {
  const reading = useContext(WidgetReadingContext)
  const shell = useAgentShell()
  const {tracks} = useAgencySessions(reading?.transport ?? {kind: 'unavailable', reason: 'no carrier'})
  const track = tracks.find(item => item.id === shell.selectedTrackId) ?? tracks[0]
  return <AgentDockTileBody id={id} sessionRef={track?.sessionRef ?? null} />
}
/** The agent of the mode in front of you (Fizz, Anima, Epii …) — one widget whose companion follows the mode. */
function AgentWidget() {
  const reading = useContext(WidgetReadingContext)
  return reading ? <TileBody id="agent" mode={reading.mode} world={reading.world} transport={reading.transport} subject={reading.subject} /> : null
}

const MODE_TILES = ['packet', 'trail', 'field', 'nows', 'results', 'sky'] as const
const AGENT_TILES: readonly AgentTileId[] = ['sessions', 'agents', 'terminal', 'files', 'web', 'graph', 'diff', 'frames', 'ledger', 'approvals']

export const WIDGETS: readonly WidgetDeclaration[] = [
  {id: 'agent', name: 'Agent', mark: TILES.agent.mark, hint: 'the agent you are talking to', Body: AgentWidget},
  ...MODE_TILES.map((id): WidgetDeclaration => ({id, name: TILES[id].name, mark: TILES[id].mark, Body: modeTile(id)})),
  ...AGENT_TILES.map((id): WidgetDeclaration => ({id, name: tileTitle(id), mark: TILE_ICONS[id], Body: agentTile(id)})),
]

export {DEFAULT_WIDGETS} from './widgetDefaults'

/** The companion's name in a mode, for the agent widget's title where a caller needs it. */
export const companionOf = (mode: SurfMode): string => COMPANIONS[mode].name
