// The agent tiles' marks and titles, and the rail widgets Factory's devices claim (Messages, the monitors, Approvals, Workcells), apart from the tiles' bodies
// (AgentDockTileBody.tsx): the rail draws their heads and the claimed devices before any body's code has loaded
// (shell/widgets.tsx; shell/loadWhenDrawn.ts).
import type {IconName} from '../inhabitants/sdk/Icon'
import type {AgentTileId} from './AgentShellContext'
import {claimRailWidget} from '../frame/widgets/deviceWidgets'
import {FRAMES_ID} from './devices/mainTrackBindings'
import {APPROVALS_ID, LEDGER_ID} from './devices/receiptBindings'
import {MESSAGES_ID} from './devices/messagesBinding'
import {WORKCELL_RACK_ID} from './devices/workcellRackBinding'

// Messages is the rail's first device (DLW §19.24 "born on the widget rail, and opens full in a pane, in every mode"): its tile draws the
// device's own Widget view on its binding (agent/devices/messagesBinding.ts: AIKit's population, the Agency gateway's mark).
claimRailWidget('messages', MESSAGES_ID)

// The rail's Frames is the Gateway's widget (DLW §19.6 "What passed between the shell and the harness, frame by frame, is the Gateway's
// Frames page and its Full (§19.2); its tile on the rail is the Gateway's widget"): its tile draws the Gateway design's own Widget view — the
// last eleven frames — on the frames' binding (agent/devices/mainTrackBindings.ts framesBinding), bare, as the rail draws any device's
// widget. The Frames monitor was retired as a device of its own in the 22 Oct manual rewrite. It replaced this tile's raw
// harness_agent_read receipt (MOVED, lane BF2).
claimRailWidget('frames', FRAMES_ID)
// The rail's Ledger and Approvals are the Main track's devices' widgets the same way (§23.9, §23.10; agent/devices/receiptBindings.ts):
// the Ledger on Central's change horizon, Approvals on the Gateway's approvals key and the shown session's consent requests. They
// replaced these tiles' raw task-record receipts (MOVED, lane BF3).
claimRailWidget('ledger', LEDGER_ID)
claimRailWidget('approvals', APPROVALS_ID)
// The Workcells tile is the workcell rack's widget (§19.23 Widget; workcellRackBinding.ts), and lists every gateway your machines reach, with
// its state (§19.3: "Every gateway your machines reach, with its state, is listed on the Workcells tile"): the Gateways monitor and its own
// tile were retired in the 22 Oct manual rewrite, and the rack carries their reading under `gw.` (AgentRailDevices.tsx).
claimRailWidget('workcells', WORKCELL_RACK_ID)

/** The rail tiles these claims draw that no old tile registered, in the rail's order — Messages first (§19.24) — each with its name, its
 * mark and what it holds for its launcher cell. The rail registers them (shell/widgets.tsx); each draws its device. */
export const DEVICE_TILES: readonly {readonly id: string; readonly name: string; readonly mark: IconName; readonly hint: string}[] = [
  {id: 'messages', name: 'Messages', mark: 'contact', hint: 'your agents and groups, each with its conversation'},
  {id: 'workcells', name: 'Workcells', mark: 'ret', hint: 'each workcell with its lane, its claim and the agents working in it, and every gateway your machines reach, with its state'},
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
