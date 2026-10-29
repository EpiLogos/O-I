// Picking a chat up again (DLW §19.1 "Projects and chats"): "drag it onto an empty track: the session reopens where it stopped, with its
// tasks as clips. Drag it onto the rail and its agent's tile opens with the chat, ready to talk."
//
// The owner's reopen. The kernel exposes AIKit's `session-space open` (persisted semantic state) and `session-space working-surface
// open|focus` as no op — only `working_surface_read`/`working_surface_attachment` (reads) — so the reopen here is the encounter
// owner's own: `encounter {action: reconnect}` ("Resume the actually recorded native session identity", kernel/src/agency.rs
// EncounterRequest::Reconnect; the thread's "Reconnect recorded session", encounter/session.ts reconnect). Its provider is the one
// the owner recorded for the session: the `binding` event at the head of the session's journal (`encounter {action: read}`), never a
// provider the face picks. A session the owner holds open is not reopened (its view says so), a session whose journal records no
// binding is refused in words, and the owner's refusal of the reconnect is said in its own words. The face keeps no session state.
//
// The kernel gates every `encounter` verb on the project: the chat's space must be one of that project's discovered spaces and the
// session attached to it (kernel/src/agency.rs encounter_once), so the op is sent with the project the chat was dragged from.
//
// Ports: agent/agentChainDrag.ts (the one drag type the empty track accepts), timeline/factoryTrackAdapter.ts (the seat action this
// wraps — an agent still starts a new agent there), the thread's reconnect (desktop/cradle/src/encounter/session.ts:397).
//
// Pure TypeScript apart from the owner calls; no React.
import {encounter, type EncounterReading, type JournalPage} from '../../../../../desktop/cradle/src/encounter/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {tellOwnerChanged} from '../owners/notices'
import type {WorldTrackSet} from '../timeline/worldTrackAdapter'
import {CONVERSATION_PLACE} from '../widgets/agentConversation'
import {AGENT_CHAIN_MIME} from './agentChainDrag'
import {chatTrackKey, decodeChatDrag, glanceOfView, type ChatGlance, type FactoryChat} from './factoryChatsModel'

/** The op a chat's reopen runs, as the refusals name it. */
export const REOPEN_OP = 'encounter reconnect'
/** How many events from the head of the journal are read to find the recorded binding. */
export const JOURNAL_HEAD = 16
/** The rail widget that holds a conversation (shell/widgets.tsx `agent`). */
export const RAIL_AGENT_WIDGET = 'agent'

export type ReopenReceipt = {ok: true; note: string} | {ok: false; error: string}

/** The owner call: the cradle's encounter client (desktop/cradle/src/encounter/client.ts), injectable for a harness. */
export type EncounterCall = typeof encounter

const wordsOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))
const nameOf = (chat: FactoryChat): string => chat.purpose ?? chat.spaceLabel ?? chat.sessionRef

const NO_CARRIER = (chat: FactoryChat, reason: string): string =>
  `“${nameOf(chat)}” was not reopened: the op that reopens it, ${REOPEN_OP}, has no kernel carrier — ${reason}`

/** The owner's encounter view of one chat, reduced to what its row shows. Throws the owner's words when it refuses. */
export async function readChatGlance(transport: KernelTransportStatus, chat: FactoryChat, call: EncounterCall = encounter): Promise<ChatGlance> {
  return glanceOfView(await call<EncounterReading>(transport, chat.project, {action: 'view', agent_session: chat.sessionRef}))
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** The provider the owner recorded for the session: the first `binding` event at the head of its journal. */
function recordedProvider(head: JournalPage): string | null {
  for (const entry of head.events ?? []) {
    const event = entry.event
    if (isObject(event) && event.kind === 'binding' && typeof event.provider === 'string' && event.provider) return event.provider
  }
  return null
}

/** Reopen one chat where it stopped, through the owner. Reads the view first (a session the owner holds open is left as it is),
 * then the journal's head for the recorded provider, then asks the owner to reconnect; the shell is told the agency moved. */
export async function reopenChat(transport: KernelTransportStatus, chat: FactoryChat, call: EncounterCall = encounter): Promise<ReopenReceipt> {
  const name = nameOf(chat)
  if (transport.kind === 'unavailable') return {ok: false, error: NO_CARRIER(chat, transport.reason)}
  let view: EncounterReading
  try {
    view = await call<EncounterReading>(transport, chat.project, {action: 'view', agent_session: chat.sessionRef})
  } catch (error) {
    return {ok: false, error: `“${name}” was not reopened: AIKit's encounter view of it refused — ${wordsOf(error)}`}
  }
  const connection = view.connection
  if (connection?.resident === true) return {ok: true, note: `“${name}” is already open (${(connection.state ?? 'resident').toLowerCase()}); the owner holds it, so nothing was reopened.`}
  let head: JournalPage
  try {
    head = await call<JournalPage>(transport, chat.project, {action: 'read', agent_session: chat.sessionRef, after: 0, limit: JOURNAL_HEAD})
  } catch (error) {
    return {ok: false, error: `“${name}” was not reopened: AIKit's journal for it refused — ${wordsOf(error)}`}
  }
  const provider = recordedProvider(head)
  if (!provider) {
    return {ok: false, error: `“${name}” was not reopened: the first ${JOURNAL_HEAD} events of its journal (AIKit's encounter read) record no binding, so the owner has no recorded provider to reopen it with. Connect one from its thread.`}
  }
  try {
    await call(transport, chat.project, {action: 'reconnect', space: chat.spaceRef, agent_session: chat.sessionRef, provider})
  } catch (error) {
    return {ok: false, error: `“${name}” was not reopened: AIKit refused ${REOPEN_OP} on provider ${provider} — ${wordsOf(error)}`}
  }
  tellOwnerChanged({topic: 'agency', cause: `a chat was reopened (${name})`, agentSession: chat.sessionRef})
  return {ok: true, note: `Reopened “${name}” of ${chat.project}: the owner reconnected its recorded ${provider} session.`}
}

export interface ChatDropPorts {
  readonly transport: KernelTransportStatus
  /** The ids of the tracks the Session pane draws (WorldTrack.id = the session's track key). */
  readonly trackIds?: readonly string[]
  readonly call?: EncounterCall
}

/** What the Session pane draws for the chat, said after the owner reopened it. */
function standing(chat: FactoryChat, trackIds: readonly string[] | undefined): string {
  if (trackIds?.includes(chatTrackKey(chat))) return ' It stands on its track in the Session pane, its tasks the clips the pane reads for it.'
  return ` The Session pane draws the sessions of ${CONVERSATION_PLACE}, and this chat is in none of their spaces, so no track appears for it.`
}

const notAChat = 'Only a chat reopens here: the drop carried no chat from the Projects category of Factory\'s browser.'

/** A chat dropped on an empty track: reopened by the owner. A payload that is no chat, or no carrier to send it by, is refused in
 * words and nothing is sent. */
export async function dropChatOnTrack(payload: string, ports: ChatDropPorts): Promise<ReopenReceipt> {
  const chat = decodeChatDrag(payload)
  if (!chat) return {ok: false, error: notAChat}
  const receipt = await reopenChat(ports.transport, chat, ports.call)
  return receipt.ok ? {ok: true, note: `${receipt.note}${standing(chat, ports.trackIds)}`} : receipt
}

/** The rail's book, as far as a chat's drop needs it (frame/widgets/widgets.ts WidgetRailBook, with whether the tile is open). */
export interface ChatRail {
  isOpen(widgetId: string): boolean
  toggle(widgetId: string): void
  pin(widgetId: string, ref: string | null): void
}

export interface ChatRailPorts extends ChatDropPorts {
  readonly rail: ChatRail
}

/** A chat dropped on the rail: reopened by the owner, and only then its agent's tile opened and held on that session (the tile
 * follows the selection until it is pinned, widgets/agentConversation.ts). A chat that did not reopen leaves the rail alone. */
export async function dropChatOnRail(payload: string, ports: ChatRailPorts): Promise<ReopenReceipt> {
  const chat = decodeChatDrag(payload)
  if (!chat) return {ok: false, error: notAChat}
  const receipt = await reopenChat(ports.transport, chat, ports.call)
  if (!receipt.ok) return receipt
  if (!ports.rail.isOpen(RAIL_AGENT_WIDGET)) ports.rail.toggle(RAIL_AGENT_WIDGET)
  ports.rail.pin(RAIL_AGENT_WIDGET, chatTrackKey(chat))
  return {ok: true, note: `${receipt.note} The agent's tile holds it, ready to talk.${ports.trackIds?.includes(chatTrackKey(chat)) ? '' : ` The tile follows the sessions of ${CONVERSATION_PLACE}, and this chat is in none of their spaces, so it may show nothing of it.`}`}
}

/** The Session pane's seat action with a chat's drop added (frame/tracks/SessionGrid.tsx draws the empty track from `actions.seat`,
 * which accepts the one chain drag type): a chat's payload reopens the chat; anything else goes to the seat it replaces — an agent
 * still starts a new agent on the bound harness — and a set with no seat refuses an agent in words. */
export function withChatSeat(set: WorldTrackSet, ports: {readonly transport: KernelTransportStatus; readonly call?: EncounterCall}): WorldTrackSet {
  const original = set.actions?.seat
  const trackIds = set.tracks.map(track => track.id)
  return {
    ...set,
    actions: {
      ...set.actions,
      seat: {
        op: original
          ? `${REOPEN_OP} (a chat, where it stopped; its recorded provider) · ${original.op} (an agent)`
          : `${REOPEN_OP} (a chat, where it stopped; its recorded provider) — no harness binding is resolved, so an agent cannot be started here`,
        accepts: AGENT_CHAIN_MIME,
        run: (payload: string) => {
          if (decodeChatDrag(payload)) return dropChatOnTrack(payload, {transport: ports.transport, trackIds, call: ports.call})
          if (original) return original.run(payload)
          return Promise.resolve({ok: false as const, error: 'Only a chat reopens here: no harness binding is resolved, so an agent cannot be started on a track.'})
        },
      },
    },
  }
}
