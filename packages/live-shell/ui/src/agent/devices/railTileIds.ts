// The ids Factory's and AIKit's rail tiles stand under, apart from the devices' bindings, as widgets/railDeviceIds.ts holds the
// rail-born devices': the rail claims its tiles by these before any binding's code has loaded (agent/agentDockTiles.ts), so the first
// load carries the ids and not the bindings (first-load-budget.test.mjs).

/** The rail's Frames tile: the Gateway's widget on the frames' binding (§19.6; mainTrackBindings.ts). */
export const FRAMES_ID = 'factory:frames'
/** Workcell's instrument on the door: one device, drawn full in a pane and as the Workcells tile on the rail (workcellRackBinding.ts). */
export const WORKCELL_RACK_ID = 'factory:workcell'
/** Messages on the door: one device for the rail's tile and its Full (messagesBinding.ts). */
export const MESSAGES_ID = 'ai-kit:messages'
/** The Main track's Ledger and Approvals on the door (receiptBindings.ts). */
export const LEDGER_ID = 'factory:main:ledger'
export const APPROVALS_ID = 'factory:main:approvals'
