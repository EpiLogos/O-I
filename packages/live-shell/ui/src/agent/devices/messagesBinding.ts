// Messages on its owners (DLW §19.24, ai-kit:messages — "Kind: instrument · Rail: born on the widget rail, and opens full in a pane, in every
// mode"). Its tile is the rail's first device (agent/agentDockTiles.ts); its Full holds your agents down the side and the conversation of the
// one you pick, with the Agency gateway's mark across its head (§19.10 "Stands: in the head of Messages").
//
// What the owners report (real shapes in tests/fixtures/workcell-readings-2026-10-21.json, read-only):
//   `aikit gateway who --project-world <W> --json` (aikit.population-reading/v1), which the kernel runs as inhabitation_read {kind:
//     population} (usePopulationAnswer.ts): positions [{position_ref, handle, label, occupancy {state occupied | vacant, agent_ref,
//     workcell_ref}, communiques {undelivered}}] — the agents you address — and agents [{agent_ref, purpose, positions}] — what each is for;
//     local_world_ref and project_world_ref — the worlds a new agent may work in. The list: each Position by its label, what its agent is
//     for, at rest while no one occupies it (§19.24 "An agent with nothing running shows at rest"), the workcell its occupant runs in, the
//     messages that wait for it. The Agency gateway's inbox is their sum;
//   the run state of the session an occupant works (runFaces.ts runStateOfSession over the agency reading's tracks: its task, its needle, its
//     thread): working, waiting on you, stalled — its face's posture (lane W5);
//   harness_agent_read through AIKit's gateway (useAgentChainReading.ts; mainTrackBindings.ts gatewayAnswer): whether the Agency gateway
//     answered — its state in the mark;
//   `aikit gateway conversation --position P --with W --json`, which the kernel runs as inhabitation_read {kind: conversation}
//     (useConversationAnswer.ts): the Communiques to and from the open agent's Position — the open agent's conversation, as the Thread's rows
//     (its own `thread`, which the design lays under `conv.`), and its last line;
//   Central's agent-profile.review of the proposal Make wrote: its profile (role, purpose, world, sources, revision) and its content digest.
// What nothing reads yet, each absent with the operation it waits for: an agent's model and type, the session's light and its last check-in
// in the conversation, the types and skillsets the card offers.
//   Central's agent sets (`central.agent-set.list {scope}`, root and the project's, read through invoke_action as a reading; lane W7):
//     records [{record {ref, members [{kind agent, agent_ref}], orchestrator_agent_ref?, proposal {reason}}, source_path}] — your groups,
//     each by its ref, what it is for (the reason Central keeps with it), and its members as the Positions their agents occupy or are
//     placed at in the population; a member no Position names stands as its own agent ref. A group's join, its last line and its unread
//     have no owner reading. `aikit gateway team` acts on one admitted member's delivery for an occupying parent and lists no groups.
// The gateway's writes go through the kernel's routes to AIKit's own commands (lane W3, desktop/cradle/kernel/src/owner_routes.rs
// GatewayWrite; ownerRoutes.ts), each answered in AIKit's words and earning an `owner_changed` receipt, after which the conversation is read
// again:
//   Send     the composer's words to the open agent's Position → gateway_write {kind send, project, to: the Position, body: your words
//            [, handling steer]} (`aikit gateway send --to P --body-file - [--handling steer]`, the words on stdin). Input says where they
//            land while the agent works, as Buzz's harness lets its sender say (buzz-acp config.rs:63-88 MultipleEventHandling; O-I
//            campaign-evidence/2026-10-07-buzz-grok-agent-messaging-re/CONTRACT.md Behaviours 2-3): Queue waits for its next turn — AIKit's
//            way before steer, and where Input starts — and Steer reaches the turn that runs at its next tool call, framed as a message that
//            arrived while it worked. A gateway that does not keep a steer refuses it in AIKit's words rather than quietly queue it, so
//            Input starts where the running gateway can land the words: Steer when its protocol advertises `communique-handling`
//            (ai-kit PR 566; `aikit gateway protocol`, aikit_read {gateway-protocol}), Queue otherwise and while it is unread. The line you
//            sent stands in the conversation under Input's word until you send another: no Position stands for you, so the journal's
//            rows never hold it. Whether the agent has heard it is AIKit's desk read of that one Communique by the ref its send
//            answered (`aikit gateway heard C`, inhabitation_read {communique}): its delivery standing, never its words — Heard once
//            delivered to the occupant, not heard yet while it waits;
//   a drop   a message dragged onto a track → gateway_write {kind delegate, project, communique, work, reason[, run, journey,
//            workflow_unit]} (`aikit gateway delegate`): the drop names the Communique, the work it becomes and why — AIKit takes all three.
// No control of Messages' design writes a team operation: `aikit gateway team` prepares, delegates to, reads, cancels or releases one
// admitted member for the parent that occupies a Position, and the desk occupies none. The conversation's Voice and its session acts stand
// disabled, each with what it lacks. Making an agent (§19.24 "Making an agent", lane W2) is
// Central's, and the kernel's invoke_action carries the person's authority for it (desktop/cradle/kernel/src/action.rs PERSON_ACTS):
//   Make     your words → agent-profile.express {scope, project?, world_ref, intent_expression (verbatim), ratified_world_refs, skill_set_refs?}:
//            Central allocates the profile and writes it generated-proposal/unrecognised; the card turns to it, read back through
//            agent-profile.review;
//   Change   back to the card's fields; Make then saves the change (agent-profile.save at the reviewed revision) — your words stay as Central
//            received them, so a changed For is refused in words;
//   Accept   agent-profile.accept {profile_ref, expected_revision, expected_content_digest}: the exact revision and digest Central reviewed;
//   Discard  agent-profile.remove {profile_ref, expected_revision};
//   a group  central.agent-set.propose {ref, revision r1, members [{kind agent, agent_ref}], reason: your words}, accepted by
//            central.agent-set.save of Central's own record at its revision; its Discard (central.agent-set.remove) carries no person's
//            authority, so it stands disabled with that reason.
// Every refusal is its owner's own words. The list's settings, the agent you open, the composer's draft, the conversation's filters, the
// card's fields and the proposal the card is on are the shell's own holds. Pure, apart from the view holds (designBindings.ts holdView); the
// acts go through the ports the publisher gives (AgentRailDevices.tsx: the kernel's invoke_action for Central's, gateway_write for AIKit's).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {GatewayWriteRequest} from '../../../../../../desktop/cradle/src/kernel/types'
import type {AgentChainReading} from './agentChainDevices'
import {chainHolds, holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice, gatewayAnswer} from './mainTrackBindings'
import type {WorkcellAnswer} from './workcellBindings'
import type {RunState} from '../../inhabitants/catalogue/faces/agency'
import {messagesStateOf} from './runFaces'

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

export const MESSAGES_REFUSE = {
  /** Send with no agent of the population open: a message is addressed to a Position. */
  send: 'Send: open an agent in the list first — a message goes to its Position (`aikit gateway send --to P`).',
  /** A drop that does not name everything `aikit gateway delegate` takes. */
  delegate: 'A message dragged onto a track: `aikit gateway delegate` takes the Communique, the work it becomes and why (--communique C --work W --reason R), and the drop did not name all three.',
  /** The groups while Central has not answered its agent-set listing. */
  team: 'Your groups: Central has not answered its agent-set listing yet (`central.agent-set.list`).',
  /** The conversation's Voice: speech turned into the composer's words. */
  voice: missing('Voice', 'dictation into Messages\' composer (`aikit gateway send` carries words; the Thread holds no capture of its own)', 'AIKit'),
  /** The conversation's session acts: a Position's journal names no session, so nothing here answers its proposals or stalls. */
  conversation: missing('The conversation\'s session acts (Approve, Diff, Retry, Hard stop, Tell parent, a spawn\'s thread)', 'a session for the Position\'s conversation (`aikit gateway conversation` carries Communiques, not a session\'s turns)', 'AIKit'),
  session: unread('The session\'s light and its last check-in', 'a session for the Position\'s conversation (`aikit gateway conversation` carries Communiques, not a session)', 'AIKit'),
  types: unread('The agent types to choose from', 'a type on Central\'s agent profile (agent-profile.express takes none; the six families are the face rig\'s ontology, held by no owner)', 'Central'),
  skillsets: unread('The skillsets it may carry', 'AIKit\'s sets for the card through the kernel', 'AIKit'),
  worlds: unread('The worlds it may work in', 'the World refs AIKit\'s population names (`aikit gateway who`: local_world_ref, project_world_ref) — not read yet', 'AIKit'),
  groupDiscard: missing('Discard a group', 'central.agent-set.remove carried with the person\'s authority (desktop/cradle/kernel/src/action.rs PERSON_ACTS names only propose and save)', 'Central'),
  noProposal: 'Nothing is proposed yet: say what it is for and press Make.',
  noCarrier: 'The kernel carrier is unavailable here, so Central cannot be asked.',
  noWorld: 'Choose where it works first: no World is read (AIKit\'s population names none).',
  noMembers: 'Drag the members\' faces onto the card: a group needs at least one agent whose Position names it.',
  sameWords: 'Change keeps your words as Central received them (the proposal\'s provenance is verbatim): Discard it and Make again to say it differently.',
} as const

/** The person's own Central acts Messages carries (desktop/cradle/kernel/src/action.rs PERSON_ACTS), and the review it reads. */
export const PERSON_ACTS = {express: 'agent-profile.express', review: 'agent-profile.review', accept: 'agent-profile.accept', save: 'agent-profile.save',
  remove: 'agent-profile.remove', propose: 'central.agent-set.propose', saveSet: 'central.agent-set.save'} as const

/** What each key no owner reports waits for. */
export const MESSAGES_ABSENT: Readonly<Record<string, string>> = {
  types: MESSAGES_REFUSE.types, skillsets: MESSAGES_REFUSE.skillsets,
  'conv.light': MESSAGES_REFUSE.session, 'conv.age': MESSAGES_REFUSE.session, 'conv.writes': MESSAGES_REFUSE.session,
}

/** The writes no owner carries, by key: the conversation's own controls (the Thread's Full under `conv.`, thread.tsx:8-17:
 * Input, Voice, the proposal's and the stall's buttons, a spawn row's open). Send (`conv.sent`) and a drop onto a track (`delegate`) write
 * through AIKit's gateway (MessagesPorts.gateway). */
export const MESSAGES_REFUSED: Readonly<Record<string, string>> = {
  'conv.voice': MESSAGES_REFUSE.voice,
  'conv.approve': MESSAGES_REFUSE.conversation, 'conv.diff': MESSAGES_REFUSE.conversation, 'conv.retry': MESSAGES_REFUSE.conversation,
  'conv.hardStop': MESSAGES_REFUSE.conversation, 'conv.tellParent': MESSAGES_REFUSE.conversation, 'conv.session': MESSAGES_REFUSE.conversation,
}

/** The shell's own keys, and the starting value of the ones the manual gives one (§19.24: Show All, Order Needs you; the conversation's
 * filters as the Thread starts them, §17.10; Input on Queue, where AIKit lands a Communique that names no handling — Input starts on Steer
 * instead where the gateway advertises it keeps one, inputDefaultOf). The rest start empty: the agent you open, the search, the draft, the
 * card's fields. */
export const MESSAGES_VIEW: Readonly<Record<string, Value>> = {show: 'both', order: 'need', 'conv.toolRows': 'lines', 'conv.subagents': 'linked', 'conv.messages': 'all',
  'conv.input': 'queue'}
export const MESSAGES_LOCAL: readonly string[] = ['open', 'show', 'order', 'search', 'conv.draft', 'conv.toolRows', 'conv.subagents', 'conv.messages', 'conv.input',
  'new.for', 'new.type', 'new.world', 'new.scope', 'new.carries', 'new.members']

/** Where your words land while the agent works (the Thread's Input, AIKit's `--handling`): Steer only when it is chosen. */
export const handlingOf = (input: Value | undefined): 'steer' | undefined => (input === 'steer' ? 'steer' : undefined)

/** The gateway feature that keeps a steer as a steer (ai-kit PR 566 GATEWAY_FEATURE_COMMUNIQUE_HANDLING). */
export const HANDLING_FEATURE = 'communique-handling'

/** Whether the running gateway advertises that it keeps a steer, from its protocol answer (`aikit gateway protocol`: `{type: protocol,
 * features}`; a gateway that predates advertisement names none, and keeps none). Undefined while the answer is not read. Pure. */
export function handlingAdvertisedOf(protocol: unknown): boolean | undefined {
  if (!isObj(protocol) || protocol.type !== 'protocol') return undefined
  return Array.isArray(protocol.features) && protocol.features.includes(HANDLING_FEATURE)
}

/** Where Input starts while the hand has not moved it (as Buzz starts on steer): Steer where the gateway advertises it keeps one, Queue
 * otherwise — a gateway that does not keep a steer refuses every one. Pure. */
export const inputDefaultOf = (advertised: boolean | undefined): 'steer' | 'queue' => (advertised === true ? 'steer' : 'queue')

/** The line you last sent and where it went (held by the hand once AIKit took it): the Position, your words, and the Communique AIKit's
 * send answered with, whose delivery says whether the agent heard it. */
export const sentOf = (held: unknown): {to: string; words: string; ref?: string} | null => {
  if (typeof held !== 'string') return null
  try {
    const sent = JSON.parse(held) as {to?: unknown; words?: unknown; ref?: unknown}
    return typeof sent.to === 'string' && typeof sent.words === 'string'
      ? {to: sent.to, words: sent.words, ...(typeof sent.ref === 'string' && sent.ref ? {ref: sent.ref} : {})} : null
  } catch { return null }
}

/** The Communique AIKit's send answered with (`aikit gateway send --json`: the route's reading carries `communique`, the record it
 * accepted), by its ref. Undefined when the answer names none. Pure. */
export function communiqueRefOf(answer: unknown): string | undefined {
  const data = isObj(answer) && 'data' in answer ? answer.data : answer
  const record = isObj(data) && isObj(data.communique) ? data.communique : null
  return record ? str(record.communique_ref) : undefined
}

/** The first line of an owner's words, clipped for a list row. */
const firstLine = (text: string): string => {
  const line = text.split('\n').map(part => part.trim()).find(Boolean) ?? ''
  return line.length > 160 ? `${line.slice(0, 159)}…` : line
}

/** The population as Messages' agents (ai-kit__messages.tsx:7-11): each Position by its label (else its handle), what it is for (the
 * purpose of the agent who occupies it, else of the agent the reading places there), at rest while it is vacant — an occupied Position's
 * working, waiting or stalled is its occupant's run (messagesValues), not the population's — the workcell its occupant runs in, and the
 * messages that wait for it.
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
 * (thread.tsx:12-17): what its Position sent is the agent's, by its name; what another Position sent stands under that
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

/** What Make wrote and the card is on (held by the hand, never an owner reading): an agent's profile, or a group's record, with the scope
 * Central wrote it in and the revision it wrote. */
export interface Made {
  readonly kind: 'agent' | 'group'
  readonly scope: 'root' | 'project'
  readonly project?: string
  readonly ref: string
  readonly revision: string
  /** A group's record as Central wrote it (central.agent-set.propose `record`): Accept saves it at its revision. */
  readonly record?: unknown
}
export const madeOf = (held: unknown): Made | null => {
  if (typeof held !== 'string') return null
  try {
    const made = JSON.parse(held) as Made
    return made && (made.kind === 'agent' || made.kind === 'group') && typeof made.ref === 'string' && typeof made.revision === 'string' ? made : null
  } catch { return null }
}
const scopeInput = (made: Pick<Made, 'scope' | 'project'>) => ({scope: made.scope, ...(made.scope === 'project' && made.project ? {project: made.project} : {})})

/** The Position an agent stands at in the population: the one it occupies, else the first the reading places it at. Null when none. */
export function positionOfAgent(agentRef: string, population: unknown): string | null {
  if (!isObj(population)) return null
  const positions = Array.isArray(population.positions) ? population.positions.filter(isObj) : []
  const occupied = positions.find(row => isObj(row.occupancy) && row.occupancy.state === 'occupied' && row.occupancy.agent_ref === agentRef)
  if (occupied && str(occupied.position_ref)) return String(occupied.position_ref)
  const agent = (Array.isArray(population.agents) ? population.agents.filter(isObj) : []).find(row => row.agent_ref === agentRef)
  const placed = agent && Array.isArray(agent.positions) ? agent.positions.find((ref): ref is string => typeof ref === 'string' && positions.some(row => row.position_ref === ref)) : undefined
  return placed ?? null
}

/** Central's agent sets (central.agent-set.list's `records`, central.agent-set/v1 each) as Messages' groups (ai-kit__messages.tsx:9): each by
 * its ref, what it is for (the first line of the reason Central keeps with its proposal), its join where Central's record carries one
 * (central.agent-set/v1 `join`: none · all · first · quorum · weighted, Central PR 291; a set saved without one has none, and AIKit's team names
 * none), and its members as the Positions their agents stand at — a member no Position names stands as its agent ref, never a Position it
 * does not hold. A set of the project's scope is told apart from the root's by the project it was read in. Last line, time and unread have
 * no reading and are left out. Pure. */
/** The joins Central's agent-set record admits (ctrl/src/world.rs AgentSetJoin). */
export const SET_JOINS: readonly string[] = ['none', 'all', 'first', 'quorum', 'weighted']

export function groupsOf(listings: readonly {readonly scope: 'root' | 'project'; readonly project?: string; readonly value: unknown}[], population: unknown): Record<string, unknown>[] {
  return listings.flatMap(({scope, project, value}) => (isObj(value) && Array.isArray(value.records) ? value.records : []).flatMap(row => {
    const record = isObj(row) && isObj(row.record) ? row.record : null
    const ref = record ? str(record.ref) : undefined
    if (!record || !ref) return []
    const members = (Array.isArray(record.members) ? record.members : []).flatMap(member => {
      const agentRef = isObj(member) ? str(member.agent_ref) : undefined
      return agentRef ? [positionOfAgent(agentRef, population) ?? agentRef] : []
    })
    const reason = isObj(record.proposal) ? str(record.proposal.reason) : undefined
    const join = typeof record.join === 'string' && SET_JOINS.includes(record.join) ? record.join : undefined
    return [{id: scope === 'project' && project ? `${project}/${ref}` : ref, name: ref, ...(reason ? {for: firstLine(reason)} : {}), ...(join ? {join} : {}), members}]
  }))
}

/** The World refs AIKit's population names (canonical refs Central disclosed for the scope): the worlds an agent may work in. */
export function worldsOf(population: unknown): string[] {
  if (!isObj(population)) return []
  return [...new Set([str(population.project_world_ref), str(population.local_world_ref)].filter((ref): ref is string => !!ref))]
}

/** Central's review of a profile (agent-profile.review, central.agent-profile-review/v1: profile, content_digest) as the card's proposal
 * (ai-kit__messages.tsx `proposal`): its role and purpose, the world it stands in, the sources it may read, its revision — each only where
 * Central's profile holds it. */
export function proposalOfReview(review: unknown): Record<string, unknown> | null {
  if (!isObj(review) || !isObj(review.profile)) return null
  const profile = review.profile
  const sources = Array.isArray(profile.knowledge_source_refs) ? profile.knowledge_source_refs.filter((ref): ref is string => typeof ref === 'string') : []
  return {...(str(profile.role) ? {role: profile.role} : {}), ...(str(profile.purpose) ? {purpose: profile.purpose} : {}), ...(str(profile.world_ref) ? {world: profile.world_ref} : {}),
    ...(sources.length ? {sources} : {}), ...(str(profile.revision) ? {revision: profile.revision} : {})}
}

/** A group's record (central.agent-set/v1) as the card's proposal: what it is for (the reason Central keeps with the proposal) and its
 * revision. A group has no role, world or sources of its own. */
export function proposalOfRecord(record: unknown): Record<string, unknown> | null {
  if (!isObj(record)) return null
  const proposal = isObj(record.proposal) ? record.proposal : {}
  return {...(str(proposal.reason) ? {purpose: proposal.reason} : {}), ...(str(record.revision) ? {revision: record.revision} : {})}
}

/** The agent refs a group's members name: each token of the card's members (a Position of the population, or an agent ref), as the agent
 * its Position names (its occupant, else the agent the reading places there). */
export function membersOf(tokens: unknown, population: unknown): string[] {
  if (typeof tokens !== 'string' || !isObj(population)) return []
  const positions = Array.isArray(population.positions) ? population.positions.filter(isObj) : []
  const agents = Array.isArray(population.agents) ? population.agents.filter(isObj) : []
  return [...new Set(tokens.split(/[\s,]+/).filter(Boolean).flatMap(token => {
    const position = positions.find(row => row.position_ref === token)
    if (!position) return agents.some(agent => agent.agent_ref === token) ? [token] : []
    const occupant = isObj(position.occupancy) ? str(position.occupancy.agent_ref) : undefined
    const placed = agents.find(agent => Array.isArray(agent.positions) && agent.positions.includes(token))
    const ref = occupant ?? (placed ? str(placed.agent_ref) : undefined)
    return ref ? [ref] : []
  }))]
}

export interface MessagesInput {
  /** AIKit's population (`aikit gateway who --json`) as the window holds it. */
  readonly population: WorkcellAnswer
  /** The Agency gateway's answer to harness_agent_read (the chain's gateway reading). */
  readonly gateway: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>
  /** The open agent's conversation (useConversationAnswer.ts), read while an agent is open; absent, none is read. */
  readonly conversation?: WorkcellAnswer
  /** Central's review of the agent profile Make wrote (agent-profile.review through invoke_action), read while one is held. */
  readonly review?: {readonly status: 'reading' | 'answered' | 'refused'; readonly value?: unknown; readonly error?: string}
  /** The run state of the session each agent works, by its agent ref (runFaces.ts runStateOfSession over the agency reading's tracks). */
  readonly runs?: ReadonlyMap<string, RunState>
  /** The project a project-scoped agent belongs to (the shell's project). */
  readonly project?: string
  /** Whether the running gateway advertises that it keeps a steer (handlingAdvertisedOf over `aikit gateway protocol`); undefined
   * while unread. Input starts by it. */
  readonly handlingAdvertised?: boolean
  /** AIKit's desk read of the Communique you last sent (`aikit gateway heard C`), by its ref; absent while none is sent or read. */
  readonly heard?: {readonly ref: string; readonly status: 'reading' | 'answered' | 'refused'; readonly value?: unknown; readonly error?: string}
  /** Central's agent-set listings (`central.agent-set.list {scope}`), root and the project's, as the window holds them. Absent: not read. */
  readonly agentSets?: readonly {readonly scope: 'root' | 'project'; readonly answer: {readonly status: 'reading'} | {readonly status: 'answered'; readonly value: unknown} | {readonly status: 'refused'; readonly error: string}}[]
  readonly holds: ChainHolds
}

/** The person's own Central acts, through the publisher's carrier (the kernel's invoke_action, which carries the person's authority for
 * them). Each resolves to Central's data or rejects with Central's own words. Absent: no carrier stands. */
export interface MessagesPorts {
  readonly act?: (action: string, input: Readonly<Record<string, unknown>>) => Promise<unknown>
  /** The card the pane stands on (the host's page: 'new-agent' or 'new-group'), read when Make is pressed. */
  readonly page?: () => string | null
  /** A fresh suffix for a group's ref (Central's propose takes the ref from its caller). */
  readonly suffix?: () => string
  /** AIKit's gateway writes through the kernel's route (ownerRoutes.ts gateway_write): resolves with AIKit's reading or rejects with its
   * words. Absent: no carrier stands. */
  readonly gateway?: (request: GatewayWriteRequest) => Promise<unknown>
}

/** What a drop onto a track names for `aikit gateway delegate` (the drop's value, JSON): the Communique, the work it becomes and why, and
 * the run, journey or workflow unit it belongs to where the track names one. Null when it does not name the three AIKit requires. Pure. */
export function delegationOf(value: Value | undefined): {communique: string; work: string; reason: string; run?: string; journey?: string; workflow_unit?: string} | null {
  let drop: unknown = value
  if (typeof value === 'string') { try { drop = JSON.parse(value) } catch { return null } }
  if (!isObj(drop)) return null
  const communique = str(drop.communique), work = str(drop.work), reason = str(drop.reason)
  if (!communique || !work || !reason) return null
  const run = str(drop.run), journey = str(drop.journey), unit = str(drop.workflow_unit)
  return {communique, work, reason, ...(run ? {run} : {}), ...(journey ? {journey} : {}), ...(unit ? {workflow_unit: unit} : {})}
}

/** Messages' values: the agents and the inbox from the population, the gateway's state from its own answer, the card's worlds and the
 * proposal Central wrote, the shell's holds. */
export function messagesValues(input: MessagesInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, MESSAGES_ID)
  for (const key of MESSAGES_LOCAL) { const held = view[key] ?? MESSAGES_VIEW[key]; if (held !== undefined) values[key] = held }
  // Input starts where the running gateway can land the words, until the hand moves it.
  if (view['conv.input'] === undefined) values['conv.input'] = inputDefaultOf(input.handlingAdvertised)
  const known = input.population.status === 'answered' ? input.population.value : null
  const listed = known ? messagesAgents(known) : null
  // An occupied agent stands in the state of the session its occupant works (runFaces.ts): working, waiting on you, stalled; none read, absent.
  const occupants = new Map<string, string>()
  if (isObj(known) && Array.isArray(known.positions)) for (const row of known.positions) {
    if (isObj(row) && str(row.position_ref) && isObj(row.occupancy) && row.occupancy.state === 'occupied' && str(row.occupancy.agent_ref)) occupants.set(String(row.position_ref), String(row.occupancy.agent_ref))
  }
  const agents = listed?.map(agent => {
    const occupant = occupants.get(String(agent.id))
    const state = occupant && input.runs ? messagesStateOf(input.runs.get(occupant) ?? null) : undefined
    return state ? {...agent, state} : agent
  }) ?? null
  // The open agent carries its conversation, as the design reads it (`thread` on the agent, laid under `conv.`), and its last line.
  const open = typeof values.open === 'string' ? values.open : undefined
  // The line you sent to the open agent, which its journal rows never hold (no Position stands for you).
  const sent = sentOf(view.sent)
  if (open && sent?.to === open) {
    values['conv.sent'] = sent.words
    // Heard: AIKit's delivery standing of that one Communique, read by the ref its send answered.
    const heard = input.heard
    if (sent.ref && heard?.ref === sent.ref && heard.status === 'answered' && isObj(heard.value) && typeof heard.value.heard === 'boolean') values['conv.heard'] = heard.value.heard
  }
  const said = open && input.conversation?.status === 'answered' && isObj(input.conversation.value) && input.conversation.value.position_ref === open
    ? conversationRows(input.conversation.value, new Map((agents ?? []).map(agent => [String(agent.id), String(agent.name)]))) : null
  if (agents) values.agents = JSON.stringify(said ? agents.map(agent => agent.id !== open ? agent
    : {...agent, thread: said, ...(said.length ? {last: firstLine(said[said.length - 1]!.text!)} : {})}) : agents)
  // The Agency gateway's mark: Ready when it answered the read (it carried it, whatever the harness said), Refused when it did not.
  const answer = gatewayAnswer(input.gateway)
  const state = answer.kind === 'answered' || answer.kind === 'refused' ? 'Ready' : answer.kind === 'unreachable' ? 'Refused' : undefined
  const waiting = known ? inboxOf(known) : undefined
  if (state !== undefined || waiting !== undefined) values.gateway = JSON.stringify({...(state ? {state} : {}), ...(waiting !== undefined ? {waiting} : {})})
  // The groups: Central's agent sets read in each scope that answered, their members at the population's Positions.
  const answeredSets = (input.agentSets ?? []).flatMap(set => (set.answer.status === 'answered' ? [{scope: set.scope, ...(input.project ? {project: input.project} : {}), value: set.answer.value}] : []))
  if (answeredSets.length) values.groups = JSON.stringify(groupsOf(answeredSets, known))
  // The card: the worlds AIKit names (Works in starts on the project's world, where the hand has not chosen), and the proposal Central wrote.
  const worlds = known ? worldsOf(known) : []
  if (worlds.length) {
    values.worlds = JSON.stringify(worlds)
    if (values['new.world'] === undefined) values['new.world'] = worlds[0]!
  }
  const made = madeOf(view.made)
  if (made && view.editing !== true) {
    const proposal = made.kind === 'group' ? proposalOfRecord(made.record)
      : input.review?.status === 'answered' ? proposalOfReview(input.review.value) : null
    if (proposal) values.proposal = JSON.stringify(proposal)
  }
  return values
}

export function messagesBinding(input: MessagesInput, ports: MessagesPorts = {}): DesignBinding {
  const values = messagesValues(input)
  const view = viewHolds(input.holds, MESSAGES_ID)
  const made = madeOf(view.made)
  const known = input.population.status === 'answered' ? input.population.value : null
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(MESSAGES_ABSENT)) standing[key] = {disabled: why}
  for (const [key, why] of Object.entries(MESSAGES_REFUSED)) standing[key] = {disabled: why}
  if (!('agents' in values)) standing.agents = {disabled: input.population.status === 'refused' && input.population.error ? input.population.error
    : input.population.status === 'answered' ? unread('Your agents', 'the Positions in AIKit\'s population (the reading carries none)', 'AIKit') : 'AIKit\'s population has not answered yet (`aikit gateway who`).'}
  if (!('gateway' in values)) standing.gateway = {disabled: 'The Agency gateway has not answered yet (harness_agent_read through AIKit\'s gateway), and the population names no inbox.'}
  if (!('worlds' in values)) standing.worlds = {disabled: MESSAGES_REFUSE.worlds}
  if (!('groups' in values)) {
    const refused = (input.agentSets ?? []).flatMap(set => (set.answer.status === 'refused' ? [set.answer.error] : []))
    standing.groups = {disabled: refused.length ? [...new Set(refused)].join(' ') : MESSAGES_REFUSE.team}
  }
  // The open agent's conversation, when it is not read: why, in the owner's words.
  if (input.conversation?.status === 'refused' && input.conversation.error) standing.thread = {disabled: input.conversation.error}
  // The card's acts: Make while a carrier stands; Accept and Discard on the proposal Make wrote, once Central has reviewed it.
  const review = made?.kind === 'agent' ? input.review : undefined
  const reviewWhy = made?.kind === 'agent' && review?.status !== 'answered' ? review?.status === 'refused' && review.error ? review.error : 'Central has not answered the review of the proposal yet (agent-profile.review).' : null
  if (!ports.act) for (const key of ['make', 'accept', 'discard']) standing[key] = {disabled: MESSAGES_REFUSE.noCarrier}
  else {
    if (!made) for (const key of ['accept', 'discard']) standing[key] = {disabled: MESSAGES_REFUSE.noProposal}
    else if (reviewWhy) standing.accept = {disabled: reviewWhy}
    if (made?.kind === 'group') standing.discard = {disabled: MESSAGES_REFUSE.groupDiscard}
  }
  if (!('proposal' in values) && made && !view.editing) standing.proposal = {disabled: reviewWhy ?? MESSAGES_REFUSE.noProposal}
  // Send: to the open agent's Position, while a carrier stands; a drop onto a track names its own Communique, so only the carrier gates it.
  const positions = positionRefs(known)
  if (!ports.gateway) for (const key of ['conv.sent', 'delegate']) standing[key] = {disabled: MESSAGES_REFUSE.noCarrier}
  else if (typeof values.open !== 'string' || !positions.includes(values.open)) standing['conv.sent'] = {disabled: MESSAGES_REFUSE.send}
  // Heard, where it has no reading: AIKit's send named no Communique, or its desk read refused (in its words), or it is being read.
  const line = sentOf(view.sent)
  if (line && line.to === values.open && !('conv.heard' in values)) {
    standing['conv.heard'] = {disabled: !line.ref ? 'Whether the agent heard it: AIKit\'s send answered no Communique ref, so there is none to read (`aikit gateway heard`).'
      : input.heard?.ref === line.ref && input.heard.status === 'refused' ? input.heard.error ?? 'AIKit refused the heard read.'
      : 'Whether the agent heard it: AIKit has not answered its read of the Communique yet (`aikit gateway heard`).'}
  }

  const hold = (made: Made | null) => { holdView(MESSAGES_ID, 'made', made ? JSON.stringify(made) : undefined); holdView(MESSAGES_ID, 'editing', undefined) }
  const act = async (action: string, body: Readonly<Record<string, unknown>>) => { if (!ports.act) throw Error(MESSAGES_REFUSE.noCarrier); return ports.act(action, body) }
  const project = input.project
  const scopeOf = (): Pick<Made, 'scope' | 'project'> => (pressed()['new.scope'] === 'project' ? {scope: 'project', ...(project ? {project} : {})} : {scope: 'root'})

  /** Why Central's review does not stand (Accept and Change wait for it). */
  const reviewWhyOf = () => (input.review?.status === 'answered' ? null : input.review?.status === 'refused' && input.review.error ? input.review.error
    : 'Central has not answered the review of the proposal yet (agent-profile.review).')
  /** What the hand holds when it presses (the holds as they stand then, not as this binding was drawn). */
  const pressed = () => viewHolds(chainHolds(), MESSAGES_ID)

  /** Make: an agent's words to Central (express, or — while you change a proposal — save at the reviewed revision), or a group's proposal. */
  const make = async (words: Value | undefined) => {
    if (!ports.act) throw Error(MESSAGES_REFUSE.noCarrier)
    if (typeof words !== 'string' || !words) throw Error('Say what it is for first.')
    const view = pressed(), made = madeOf(view.made)
    if (ports.page?.() === 'new-group') {
      const members = membersOf(view['new.members'], known)
      if (!members.length) throw Error(MESSAGES_REFUSE.noMembers)
      const scope = scopeOf()
      const ref = `agent-set:${words.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'group'}-${ports.suffix?.() ?? 'r1'}`
      const data = await act(PERSON_ACTS.propose, {...scopeInput(scope), ref, revision: 'r1', members: members.map(agent_ref => ({kind: 'agent', agent_ref})), reason: words})
      const record = isObj(data) ? data.record : undefined
      hold({kind: 'group', ...scope, ref, revision: isObj(record) && str(record.revision) ? String(record.revision) : 'r1', record})
      return
    }
    const world = typeof view['new.world'] === 'string' ? view['new.world'] : typeof values['new.world'] === 'string' ? values['new.world'] : undefined
    if (!world) throw Error(MESSAGES_REFUSE.noWorld)
    const carries = typeof view['new.carries'] === 'string' && view['new.carries'] ? [view['new.carries']] : undefined
    if (made?.kind === 'agent' && view.editing === true) {
      // Change: the reviewed profile, with the world and what it carries as you set them, saved at the revision Central reviewed.
      const reviewed = input.review?.status === 'answered' && isObj(input.review.value) && isObj(input.review.value.profile) ? input.review.value.profile : null
      if (!reviewed) throw Error(reviewWhyOf() ?? MESSAGES_REFUSE.noProposal)
      const provenance = isObj(reviewed.intent_provenance) ? reviewed.intent_provenance : {}
      if (str(provenance.intent_expression) && provenance.intent_expression !== words) throw Error(MESSAGES_REFUSE.sameWords)
      const profile = {...reviewed, world_ref: world, ratified_world_refs: [world], ...(carries ? {skill_set_refs: carries} : {})}
      const data = await act(PERSON_ACTS.save, {...scopeInput(made), profile, expected_revision: String(reviewed.revision ?? made.revision)})
      const receipt = isObj(data) && isObj(data.receipt) ? data.receipt : {}
      hold({...made, revision: str(receipt.revision) ?? String(reviewed.revision ?? made.revision)})
      return
    }
    const scope = scopeOf()
    const data = await act(PERSON_ACTS.express, {...scopeInput(scope), world_ref: world, intent_expression: words, ratified_world_refs: [world], ...(carries ? {skill_set_refs: carries} : {})})
    const allocation = isObj(data) && isObj(data.allocation) ? data.allocation : null
    if (!allocation || !str(allocation.profile_ref)) throw Error('Central answered Make without the profile it allocated.')
    hold({kind: 'agent', ...scope, ref: String(allocation.profile_ref), revision: str(allocation.revision) ?? 'r1'})
  }
  const accept = async () => {
    if (!ports.act) throw Error(MESSAGES_REFUSE.noCarrier)
    const made = madeOf(pressed().made)
    if (!made) throw Error(MESSAGES_REFUSE.noProposal)
    if (made.kind === 'group') {
      await act(PERSON_ACTS.saveSet, {...scopeInput(made), record: made.record, expected_revision: made.revision})
      hold(null)
      return
    }
    const reviewed = input.review?.status === 'answered' && isObj(input.review.value) ? input.review.value : null
    if (!reviewed || !isObj(reviewed.profile)) throw Error(reviewWhyOf() ?? MESSAGES_REFUSE.noProposal)
    await act(PERSON_ACTS.accept, {...scopeInput(made), profile_ref: made.ref, expected_revision: String(reviewed.profile.revision ?? made.revision),
      expected_content_digest: String(reviewed.content_digest ?? '')})
    hold(null)
  }
  const discard = async () => {
    if (!ports.act) throw Error(MESSAGES_REFUSE.noCarrier)
    const made = madeOf(pressed().made)
    if (!made) throw Error(MESSAGES_REFUSE.noProposal)
    if (made.kind === 'group') throw Error(MESSAGES_REFUSE.groupDiscard)
    const reviewed = input.review?.status === 'answered' && isObj(input.review.value) && isObj(input.review.value.profile) ? input.review.value.profile : null
    await act(PERSON_ACTS.remove, {...scopeInput(made), profile_ref: made.ref, expected_revision: String(reviewed?.revision ?? made.revision)})
    hold(null)
  }
  /** Send: your words to the Position of the agent open when you press (`aikit gateway send`), landing as Input says; AIKit's refusal is
   * its own words. Once AIKit took them, the line stands in the conversation. */
  const send = async (words: Value | undefined) => {
    if (!ports.gateway) throw Error(MESSAGES_REFUSE.noCarrier)
    if (typeof words !== 'string' || !words.trim()) throw Error('Send: write the message first.')
    const held = pressed(), open = held.open
    if (typeof open !== 'string' || !positions.includes(open)) throw Error(MESSAGES_REFUSE.send)
    const handling = handlingOf(held['conv.input'] ?? inputDefaultOf(input.handlingAdvertised))
    const answer = await ports.gateway({kind: 'send', ...(project ? {project} : {}), to: open, body: words, ...(handling ? {handling} : {})})
    const ref = communiqueRefOf(answer)
    holdView(MESSAGES_ID, 'sent', JSON.stringify({to: open, words: words.trim(), ...(ref ? {ref} : {})}))
  }
  /** A message dropped onto a track: the Communique crosses into that work (`aikit gateway delegate`; Factory assigns custody). */
  const delegate = async (drop: Value | undefined) => {
    if (!ports.gateway) throw Error(MESSAGES_REFUSE.noCarrier)
    const named = delegationOf(drop)
    if (!named) throw Error(MESSAGES_REFUSE.delegate)
    await ports.gateway({kind: 'delegate', ...(project ? {project} : {}), ...named})
  }
  return {
    id: MESSAGES_ID,
    values,
    standing,
    local: {
      ...Object.fromEntries(MESSAGES_LOCAL.map(key => [key, (value: Value | undefined) => holdView(MESSAGES_ID, key, value)])),
      // Change: back to the card's fields, the proposal still held; Make then saves the change.
      proposal: value => { if (value === undefined && made) holdView(MESSAGES_ID, 'editing', true) },
    },
    writes: key => key in MESSAGES_REFUSED || key.startsWith('conv.') || key === 'delegate' || key === 'make' || key === 'accept' || key === 'discard',
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'conv.sent') { await send(value); continue }
        if (key === 'delegate') { await delegate(value); continue }
        if (key === 'make') { await make(value); continue }
        if (key === 'accept') { await accept(); continue }
        if (key === 'discard') { await discard(); continue }
        throw Error(MESSAGES_REFUSED[key] ?? (key.startsWith('conv.') ? MESSAGES_REFUSE.conversation : `${key} is a reading: its owner reports it; nothing here changes it.`))
      }
    },
  }
}
