// The ids Factory's and AIKit's rail tiles stand under, apart from the devices' bindings, as widgets/railDeviceIds.ts holds the
// rail-born devices': the rail claims its tiles by these before any binding's code has loaded (agent/agentDockTiles.ts), so the first
// load carries the ids and not the bindings (first-load-budget.test.mjs). The drag a message of Messages carries stands here too, for the
// same reason: Factory's tracks take it before Messages' binding has loaded.

/** The rail's Frames tile: the Gateway's widget on the frames' binding (§19.6; mainTrackBindings.ts). */
export const FRAMES_ID = 'factory:frames'
/** Workcell's instrument on the door: one device, drawn full in a pane and as the Workcells tile on the rail (workcellRackBinding.ts). */
export const WORKCELL_RACK_ID = 'factory:workcell'
/** Messages on the door: one device for the rail's tile and its Full (messagesBinding.ts). */
export const MESSAGES_ID = 'ai-kit:messages'
/** The Main track's Ledger and Approvals on the door (receiptBindings.ts). */
export const LEDGER_ID = 'factory:main:ledger'
export const APPROVALS_ID = 'factory:main:approvals'

/** The drag a message of Messages' conversation carries onto a track (§19.24 Rules: "To turn one into work, drag it onto the agent's
 * track"; O-I ticket 757), held here beside Messages' id so Factory's tracks take it without loading Messages' binding: JSON of the
 * CommuniqueDrag below (messagesBinding.ts conversationRows writes it; frame/tracks/useFactoryTracks.ts withDelegateDrop reads it). */
export const COMMUNIQUE_DRAG = 'application/x-oi-communique'
export const COMMUNIQUE_DRAG_SCHEMA = 'oi.communique-drag/v1'

/** What a dragged message names: its Communique, the Position it went to by its ref and its name, the agent standing there (its
 * occupant, else the agent AIKit's population places there), and its words — the first line, the purpose of the new task it becomes
 * (DLW build ruling 2026-11-05: §19.24 "the agent takes it as a task with a receipt"). */
export interface CommuniqueDrag {
  readonly schema: typeof COMMUNIQUE_DRAG_SCHEMA
  readonly communique: string
  readonly to: string
  readonly name: string
  readonly agent?: string
  readonly concern: string
}

const word = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

/** A dragged message from the drag's payload, or null when the payload is not one (a constellation's ref, a song's clip) or names no
 * words to make its task of. Pure. */
export function communiqueDragOf(payload: string): CommuniqueDrag | null {
  if (!payload.trim().startsWith('{')) return null
  let raw: unknown
  try { raw = JSON.parse(payload) } catch { return null }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const drag = raw as Record<string, unknown>
  const communique = word(drag.communique), to = word(drag.to), name = word(drag.name), concern = word(drag.concern)
  if (drag.schema !== COMMUNIQUE_DRAG_SCHEMA || !communique || !to || !name || !concern) return null
  const agent = word(drag.agent)
  return {schema: COMMUNIQUE_DRAG_SCHEMA, communique, to, name, ...(agent ? {agent} : {}), concern}
}
