// The agent tiles' marks and titles, and the rail widgets Factory's devices claim (Messages, the monitors, Approvals, Workcells), apart from the tiles' bodies
// (AgentDockTileBody.tsx): the rail draws their heads and the claimed devices before any body's code has loaded
// (shell/widgets.tsx; shell/loadWhenDrawn.ts).
import type {IconName} from '../inhabitants/sdk/Icon'
import type {AgentTileId} from './AgentShellContext'
import {claimRailWidget} from '../frame/widgets/deviceWidgets'
import {FRAMES_ID, GATEWAYS_RACK_ID} from './devices/mainTrackBindings'
import {APPROVALS_ID, LEDGER_ID} from './devices/receiptBindings'
import {MESSAGES_ID} from './devices/messagesBinding'
import {WORKCELL_RACK_ID} from './devices/workcellRackBinding'

// Messages is the rail's first device (DLW §19.24 "born on the widget rail, and opens full in a pane, in every mode"): its tile draws the
// device's own Widget view on its binding (agent/devices/messagesBinding.ts: AIKit's population, the Agency gateway's mark).
claimRailWidget('messages', MESSAGES_ID)

// The rail's Frames is the Frames monitor's widget (DLW §19.6 "Frames is the Frames monitor on the rail"; §19.5): its tile draws the
// device's own Widget view on the binding the Gateway's Full and the pool read (agent/devices/mainTrackBindings.ts framesBinding),
// bare, as the rail draws any device's widget. It replaced this tile's raw harness_agent_read receipt (MOVED, lane BF2).
claimRailWidget('frames', FRAMES_ID)
// The rail's Ledger and Approvals are the Main track's devices' widgets the same way (§23.9, §23.10; agent/devices/receiptBindings.ts):
// the Ledger on Central's change horizon, Approvals on the Gateway's approvals key and the shown session's consent requests. They
// replaced these tiles' raw task-record receipts (MOVED, lane BF3).
claimRailWidget('ledger', LEDGER_ID)
claimRailWidget('approvals', APPROVALS_ID)
// Gateways is a monitor (§19.3 "Kind: monitor · Rail: the widget rail, and a pane, in every mode"): with the Frames monitor and the Ledger it
// stands only on the rail and full in a pane, never on a chain (§16.1) — its tile on the binding that reads every gateway's state
// (mainTrackBindings.ts rackBinding). The Workcells tile is the workcell rack's widget (§19.23 Widget; workcellRackBinding.ts).
claimRailWidget('gateways', GATEWAYS_RACK_ID)
claimRailWidget('workcells', WORKCELL_RACK_ID)

/** The rail tiles these claims draw that no old tile registered, in the rail's order — Messages first (§19.24) — each with its name, its
 * mark and what it holds for its launcher cell. The rail registers them (shell/widgets.tsx); each draws its device. */
export const DEVICE_TILES: readonly {readonly id: string; readonly name: string; readonly mark: IconName; readonly hint: string}[] = [
  {id: 'messages', name: 'Messages', mark: 'contact', hint: 'your agents and groups, each with its conversation'},
  {id: 'gateways', name: 'Gateways', mark: 'chain', hint: 'every gateway your machines reach, with its state'},
  {id: 'workcells', name: 'Workcells', mark: 'ret', hint: 'each workcell with its lane, its claim and the agents working in it'},
]

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
