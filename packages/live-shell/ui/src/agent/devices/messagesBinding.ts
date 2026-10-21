// Messages on its owners (lane W1-Factory; DLW §19.24, ai-kit:messages — "Kind: instrument · Rail: born on the widget rail, and opens full
// in a pane, in every mode"). Its tile is the rail's first device (agent/agentDockTiles.ts); its Full holds your agents down the side and
// the conversation of the one you pick, with the Agency gateway's mark across its head (§19.10 "Stands: in the head of Messages").
//
// What the owners report (real shape in tests/fixtures/workcell-readings-2026-10-21.json, read-only):
//   `aikit gateway who --project-world <W> --json` (aikit.population-reading/v1), which the kernel runs as inhabitation_read {kind:
//     population} (usePopulationAnswer.ts): positions [{position_ref, handle, label, occupancy {state occupied | vacant, agent_ref,
//     workcell_ref}, communiques {undelivered}}] — the agents you address — and agents [{agent_ref, purpose, positions}] — what each is for.
//     The list: each Position by its label, what its agent is for, at rest while no one occupies it (§19.24 "An agent with nothing running
//     shows at rest"), the workcell its occupant runs in, the messages that wait for it. The Agency gateway's inbox is their sum;
//   harness_agent_read through AIKit's gateway (useAgentChainReading.ts; mainTrackBindings.ts gatewayAnswer): whether the Agency gateway
//     answered — its state in the mark;
//   `aikit gateway conversation --position P --with W --json`, which the kernel runs as inhabitation_read {kind: conversation}
//     (useConversationAnswer.ts): the Communiques to and from the open agent's Position, {communique_ref, from_position_ref,
//     to_position_ref, body, sent_at_unix_ms, sequence} — the open agent's conversation, as the Thread's rows (its own `thread`, which the
//     design lays under `conv.`), and its last line.
// What nothing reads yet, each absent with the operation it waits for: an occupied agent's working, waiting or stalled state, its model and
// its type, the session's light and its last check-in (a Position's conversation reports neither), the groups (`aikit gateway team`), the
// card's choices. The writes: a send (`aikit gateway send`), a message dragged onto a track (`aikit gateway delegate`) and the
// conversation's acts (Approve, Retry, Hard stop… answer a session, not a Position's journal) stand disabled with the AIKit command no
// kernel route reaches (T-COVERAGE §1.2); Make, Accept and Discard (`agent-profile.express`, `accept`, `remove`) stand disabled naming the
// kernel route that carries the person's authority (T-COVERAGE §1.1). The list's settings, the agent you open, the composer's draft, the
// conversation's filters and the card's fields are the shell's own holds. Pure, apart from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {AgentChainReading} from './agentChainDevices'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice, gatewayAnswer} from './mainTrackBindings'
import type {WorkcellAnswer} from './workcellBindings'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

export const MESSAGES_DESIGN = 'ai-kit:messages'
/** Messages on the door: one device for the rail's tile and its Full. */
export const MESSAGES_ID = 'ai-kit:messages'

/** Messages as a device of the runtime: AIKit's admitted `messages` face (aiKitFamilyManifest.ts — an instrument born on the rail), so
 * designKey('ai-kit', 'messages') is the design's id by the family's own declaration. Null when the family does not admit it. Its design
 * draws its binding's keys. */
export function messagesDevice(): DeviceInstance | null {
  return familyFaceDevice(MESSAGES_ID, 'ai-kit', 'messages', 'Messages', 'contact')
}

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const unread = (what: string, op: string, owner: string) => `${what}: no reading reaches it yet — missing op: ${op} (${owner}).`
const AUTHORITY = 'the kernel route that carries the person\'s authority (T-COVERAGE §1.1)'

export const MESSAGES_REFUSE = {
  send: missing('Send', '`aikit gateway send` through the kernel (T-COVERAGE §1.2)', 'AIKit'),
  delegate: missing('A message dragged onto a track', '`aikit gateway delegate` through the kernel (T-COVERAGE §1.2)', 'AIKit'),
  team: unread('Your groups', '`aikit gateway team` through the kernel (T-COVERAGE §1.2)', 'AIKit'),
  /** The conversation's session acts: a Position's journal names no session, so nothing here answers its proposals or stalls. */
  conversation: missing('The conversation\'s session acts (Approve, Diff, Retry, Hard stop, Tell parent, a spawn\'s thread)', 'a session for the Position\'s conversation (`aikit gateway conversation` carries Communiques, not a session\'s turns)', 'AIKit'),
  session: unread('The session\'s light and its last check-in', 'a session for the Position\'s conversation (`aikit gateway conversation` carries Communiques, not a session)', 'AIKit'),
  make: missing('Make', `Central's agent-profile.express (scope, world_ref, intent_expression, ratified_world_refs) through ${AUTHORITY}`, 'Central'),
  accept: missing('Accept', `Central's agent-profile.accept through ${AUTHORITY}`, 'Central'),
  discard: missing('Discard', `Central's agent-profile.remove through ${AUTHORITY}`, 'Central'),
  card: unread('The card\'s choices (types, worlds, skillsets)', `a reading for the card, which serves Make — and Make waits for ${AUTHORITY}`, 'Central'),
} as const

/** What each key no owner reports waits for. */
export const MESSAGES_ABSENT: Readonly<Record<string, string>> = {
  groups: MESSAGES_REFUSE.team,
  types: MESSAGES_REFUSE.card, worlds: MESSAGES_REFUSE.card, skillsets: MESSAGES_REFUSE.card,
  proposal: unread('Central\'s proposal', `agent-profile.express, which answers Make — Make waits for ${AUTHORITY}`, 'Central'),
  'conv.light': MESSAGES_REFUSE.session, 'conv.age': MESSAGES_REFUSE.session, 'conv.writes': MESSAGES_REFUSE.session,
}

/** The writes no owner carries, by key: the card's acts, the composer, a drop onto a track, and the conversation's own controls (the
 * Thread's Full under `conv.`, software-factory__thread.tsx: Input, Voice, the proposal's and the stall's buttons, a spawn row's open). */
export const MESSAGES_REFUSED: Readonly<Record<string, string>> = {
  make: MESSAGES_REFUSE.make, accept: MESSAGES_REFUSE.accept, discard: MESSAGES_REFUSE.discard, delegate: MESSAGES_REFUSE.delegate,
  'conv.sent': MESSAGES_REFUSE.send, 'conv.input': MESSAGES_REFUSE.send, 'conv.voice': MESSAGES_REFUSE.send,
  'conv.approve': MESSAGES_REFUSE.conversation, 'conv.diff': MESSAGES_REFUSE.conversation, 'conv.retry': MESSAGES_REFUSE.conversation,
  'conv.hardStop': MESSAGES_REFUSE.conversation, 'conv.tellParent': MESSAGES_REFUSE.conversation, 'conv.session': MESSAGES_REFUSE.conversation,
}

/** The shell's own keys, and the starting value of the ones the manual gives one (§19.24: Show All, Order Needs you; the conversation's
 * filters as the Thread starts them, §17.10). The rest start empty: the agent you open, the search, the draft, the card's fields. */
export const MESSAGES_VIEW: Readonly<Record<string, Value>> = {show: 'both', order: 'need', 'conv.toolRows': 'lines', 'conv.subagents': 'linked', 'conv.messages': 'all'}
export const MESSAGES_LOCAL: readonly string[] = ['open', 'show', 'order', 'search', 'conv.draft', 'conv.toolRows', 'conv.subagents', 'conv.messages',
  'new.for', 'new.type', 'new.world', 'new.scope', 'new.carries', 'new.members']

/** The first line of an owner's words, clipped for a list row. */
const firstLine = (text: string): string => {
  const line = text.split('\n').map(part => part.trim()).find(Boolean) ?? ''
  return line.length > 160 ? `${line.slice(0, 159)}…` : line
}

/** The population as Messages' agents (ai-kit__messages.tsx:7-11): each Position by its label (else its handle), what it is for (the
 * purpose of the agent who occupies it, else of the agent the reading places there), at rest while it is vacant — an occupied Position's
 * working, waiting or stalled is not reported, so it stands absent — the workcell its occupant runs in, and the messages that wait for it.
 * Null when the reading carries no Positions. */
export function messagesAgents(population: unknown): Record<string, unknown>[] | null {
  if (!isObj(population) || !Array.isArray(population.positions)) return null
  const agents = Array.isArray(population.agents) ? population.agents.filter(isObj) : []
  return population.positions.flatMap(row => {
    if (!isObj(row) || !str(row.position_ref)) return []
    const ref = String(row.position_ref)
    const occupancy = isObj(row.occupancy) ? row.occupancy : {}
    const occupant = str(occupancy.agent_ref)
    const agent = (occupant ? agents.find(item => item.agent_ref === occupant) : undefined)
      ?? agents.find(item => Array.isArray(item.positions) && item.positions.includes(ref))
    const purpose = agent ? str(agent.purpose) : undefined
    const unread = isObj(row.communiques) ? num(row.communiques.undelivered) : undefined
    const workcell = occupancy.state === 'occupied' ? str(occupancy.workcell_ref) : undefined
    return [{id: ref, name: str(row.label) ?? str(row.handle) ?? ref, ...(purpose ? {for: firstLine(purpose)} : {}),
      ...(occupancy.state === 'vacant' ? {state: 'rest'} : {}), ...(workcell ? {where: {workcell}} : {}), ...(unread !== undefined ? {unread} : {})}]
  })
}

/** The Positions of the population, by ref: the other side of each pair the open agent's conversation is read with. */
export function positionRefs(population: unknown): string[] {
  if (!isObj(population) || !Array.isArray(population.positions)) return []
  return population.positions.flatMap(row => (isObj(row) && str(row.position_ref) ? [String(row.position_ref)] : []))
}

/** The open agent's conversation (useConversationAnswer.ts: the Communiques to and from its Position) as the Thread's rows
 * (software-factory__thread.tsx:10): what its Position sent is the agent's, by its name; what another Position sent stands under that
 * Position's name. No Position stands for you, so no row is yours. The journal's order is kept. */
export function conversationRows(conversation: unknown, names: ReadonlyMap<string, string>): Record<string, string>[] | null {
  if (!isObj(conversation) || !str(conversation.position_ref) || !Array.isArray(conversation.communiques)) return null
  const self = String(conversation.position_ref)
  return conversation.communiques.flatMap((record): Record<string, string>[] => {
    const body = isObj(record) ? record.body : undefined
    if (!isObj(record) || typeof body !== 'string') return []
    const from = str(record.from_position_ref)
    const who = from ? names.get(from) ?? from : undefined
    return [{...(who ? {who} : {}), kind: from === self ? 'agent' : 'text', text: body}]
  })
}

/** The messages that wait across the Positions: the Agency gateway's inbox (§19.10 Inbox, "Read from the gateway"). */
export function inboxOf(population: unknown): number | undefined {
  if (!isObj(population) || !Array.isArray(population.positions)) return undefined
  const counts = population.positions.flatMap(row => (isObj(row) && isObj(row.communiques) && num(row.communiques.undelivered) !== undefined ? [num(row.communiques.undelivered)!] : []))
  return counts.length ? counts.reduce((sum, n) => sum + n, 0) : undefined
}

export interface MessagesInput {
  /** AIKit's population (`aikit gateway who --json`) as the window holds it. */
  readonly population: WorkcellAnswer
  /** The Agency gateway's answer to harness_agent_read (the chain's gateway reading). */
  readonly gateway: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>
  /** The open agent's conversation (useConversationAnswer.ts), read while an agent is open; absent, none is read. */
  readonly conversation?: WorkcellAnswer
  readonly holds: ChainHolds
}

/** Messages' values: the agents and the inbox from the population, the gateway's state from its own answer, the shell's holds. */
export function messagesValues(input: MessagesInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, MESSAGES_ID)
  for (const key of MESSAGES_LOCAL) { const held = view[key] ?? MESSAGES_VIEW[key]; if (held !== undefined) values[key] = held }
  const known = input.population.status === 'answered' ? input.population.value : null
  const agents = known ? messagesAgents(known) : null
  // The open agent carries its conversation, as the design reads it (`thread` on the agent, laid under `conv.`), and its last line.
  const open = typeof values.open === 'string' ? values.open : undefined
  const said = open && input.conversation?.status === 'answered' && isObj(input.conversation.value) && input.conversation.value.position_ref === open
    ? conversationRows(input.conversation.value, new Map((agents ?? []).map(agent => [String(agent.id), String(agent.name)]))) : null
  if (agents) values.agents = JSON.stringify(said ? agents.map(agent => agent.id !== open ? agent
    : {...agent, thread: said, ...(said.length ? {last: firstLine(said[said.length - 1]!.text!)} : {})}) : agents)
  // The Agency gateway's mark: Ready when it answered the read (it carried it, whatever the harness said), Refused when it did not.
  const answer = gatewayAnswer(input.gateway)
  const state = answer.kind === 'answered' || answer.kind === 'refused' ? 'Ready' : answer.kind === 'unreachable' ? 'Refused' : undefined
  const waiting = known ? inboxOf(known) : undefined
  if (state !== undefined || waiting !== undefined) values.gateway = JSON.stringify({...(state ? {state} : {}), ...(waiting !== undefined ? {waiting} : {})})
  return values
}

export function messagesBinding(input: MessagesInput): DesignBinding {
  const values = messagesValues(input)
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(MESSAGES_ABSENT)) standing[key] = {disabled: why}
  for (const [key, why] of Object.entries(MESSAGES_REFUSED)) standing[key] = {disabled: why}
  if (!('agents' in values)) standing.agents = {disabled: input.population.status === 'refused' && input.population.error ? input.population.error
    : input.population.status === 'answered' ? unread('Your agents', 'the Positions in AIKit\'s population (the reading carries none)', 'AIKit') : 'AIKit\'s population has not answered yet (`aikit gateway who`).'}
  if (!('gateway' in values)) standing.gateway = {disabled: 'The Agency gateway has not answered yet (harness_agent_read through AIKit\'s gateway), and the population names no inbox.'}
  // The open agent's conversation, when it is not read: why, in the owner's words.
  if (input.conversation?.status === 'refused' && input.conversation.error) standing.thread = {disabled: input.conversation.error}
  return {
    id: MESSAGES_ID,
    values,
    standing,
    local: Object.fromEntries(MESSAGES_LOCAL.map(key => [key, (value: Value | undefined) => holdView(MESSAGES_ID, key, value)])),
    writes: key => key in MESSAGES_REFUSED || key.startsWith('conv.'),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key} of changes) throw Error(MESSAGES_REFUSED[key] ?? (key.startsWith('conv.') ? MESSAGES_REFUSE.conversation : `${key} is a reading: its owner reports it; nothing here changes it.`))
    },
  }
}
