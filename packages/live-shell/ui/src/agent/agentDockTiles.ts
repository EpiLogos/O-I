// The agent tiles' marks and titles, and the rail widgets the Main track's devices claim, apart from the tiles' bodies
// (AgentDockTileBody.tsx): the rail draws their heads and the claimed devices before any body's code has loaded
// (shell/widgets.tsx; shell/loadWhenDrawn.ts).
import type {IconName} from '../inhabitants/sdk/Icon'
import type {AgentTileId} from './AgentShellContext'
import {claimRailWidget} from '../frame/widgets/deviceWidgets'
import {FRAMES_ID} from './devices/mainTrackBindings'
import {APPROVALS_ID, LEDGER_ID} from './devices/receiptBindings'

// The rail's Frames is the Frames monitor's widget (DLW §19.6 "Frames is the Frames monitor on the rail"; §19.5): its tile draws the
// device's own Widget view on the binding the Gateway's Full and the pool read (agent/devices/mainTrackBindings.ts framesBinding),
// bare, as the rail draws any device's widget. It replaced this tile's raw harness_agent_read receipt (MOVED, lane BF2).
claimRailWidget('frames', FRAMES_ID)
// The rail's Ledger and Approvals are the Main track's devices' widgets the same way (§23.9, §23.10; agent/devices/receiptBindings.ts):
// the Ledger on Central's change horizon, Approvals on the Gateway's approvals key and the shown session's consent requests. They
// replaced these tiles' raw task-record receipts (MOVED, lane BF3).
claimRailWidget('ledger', LEDGER_ID)
claimRailWidget('approvals', APPROVALS_ID)

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
