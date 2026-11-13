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
//   the open agent's conversation (O-I ticket 1003): the session its Position's occupant works (the agency reading's track whose agent is the
//     occupant), observed through the one encounter session (EncounterObservers.tsx; encounter/session.ts), as the Thread's rows
//     (threadBinding.ts threadRowsOf: its own `thread`, which the design lays under `conv.`) and its last line;
//   Central's agent-profile.review of the proposal Make wrote: its profile (role, purpose, world, sources, revision) and its content digest.
// What nothing reads yet, each absent with the operation it waits for: an agent's model and type, the session's light and its last check-in
// in the conversation, the types and skillsets the card offers.
//   Central's agent sets (`central.agent-set.list {scope}`, root and the project's, read through invoke_action as a reading; lane W7):
//     records [{record {ref, members [{kind agent, agent_ref}], orchestrator_agent_ref?, proposal {reason}}, source_path}] — your groups,
//     each by its ref, what it is for (the reason Central keeps with it), and its members as the Positions their agents occupy or are
//     placed at in the population; a member no Position names stands as its own agent ref. A group's join, its last line and its unread
//     have no owner reading. `aikit gateway team` acts on one admitted member's delivery for an occupying parent and lists no groups.
// Send is the one send (O-I ticket 1003): the composer's words as the next turn in the open agent's conversation (session.ts `submit`: the
// draft, then the owner's prompt), refused in the owner's words; the line stands in the conversation as queued until the session's own
// rows hold it. Input stands at Queue: the conversation takes a turn when its owner takes a prompt, and no steer into a running turn is
// carried there. The gateway's own writes are AIKit's Actions through the kernel's `act` (O-I 1002; ownerRoutes.ts gatewayWriteOp):
//   a drop   a message dragged onto a track → aikit.gateway.delegate {project, communique, work, reason[, run, journey,
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
//            central.agent-set.save of Central's own record at its revision; its Discard is central.agent-set.remove {scope, ref,
//            expected_revision} at the revision Central wrote, the person's own act (PERSON_ACTS since C26 6311e404c).
// Every refusal is its owner's own words. The list's settings, the agent you open, the composer's draft, the conversation's filters, the
// card's fields and the proposal the card is on are the shell's own holds. Pure, apart from the view holds (designBindings.ts holdView); the
// acts go through the ports the publisher gives (AgentRailDevices.tsx: the kernel's invoke_action for Central's, act for AIKit's).
import {gatewayMoved} from '../../owners/gatewayGeneration'
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {GatewayWriteRequest} from '../../../../../../desktop/cradle/src/kernel/types'
import type {AgentChainReading} from './agentChainDevices'
import {chainHolds, holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice, gatewayAnswer} from './mainTrackBindings'
import type {WorkcellAnswer} from './workcellBindings'
import type {RunState} from '../../inhabitants/catalogue/faces/agency'
import {messagesStateOf} from './runFaces'
import {MESSAGES_ID} from './railTileIds'
import {threadLight, threadRowsOf} from './threadBinding'
import type {EncounterReading, EncounterStatus} from '../../../../../../desktop/cradle/src/encounter/client'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

export const MESSAGES_DESIGN = 'ai-kit:messages'
export {MESSAGES_ID} from './railTileIds'

/** Messages as a device of the runtime: AIKit's admitted `messages` face (aiKitFamilyManifest.ts — an instrument born on the rail), so
 * designKey('ai-kit', 'messages') is the design's id by the family's own declaration. Null when the family does not admit it. Its design
 * draws its binding's keys. */
export function messagesDevice(): DeviceInstance | null {
  return familyFaceDevice(MESSAGES_ID, 'ai-kit', 'messages', 'Messages', 'contact')
}

const unread = (what: string, op: string, owner: string) => `${what}: no reading reaches it yet — missing op: ${op} (${owner}).`

export const MESSAGES_REFUSE = {
  /** Send with no agent open: your words go to the conversation its occupant works, or to your own with an unseated agent. */
  send: 'Send: open an agent in the list first — your words are the next turn in the conversation it works.',
  /** The open Position has no occupant: no session works there, so there is no conversation to send in. */
  unseated: 'No agent occupies this Position, so no conversation works here to send in: seat an agent at it first.',
  /** The occupant's session is not among the agency's sessions read. */
  noSession: 'The session this agent works is not among the agency\'s sessions read here (`agency_read`), so its conversation cannot be opened.',
  /** The agency's sessions not read yet. */
  sessionsUnread: 'The agency\'s sessions have not been read yet (`agency_read`), so the conversation this agent works cannot be found.',
  /** Input: the one send lands as the next turn. */
  input: 'Input: your words are the next turn in the agent\'s conversation, taken when its owner takes a prompt (the one send, O-I ticket 1003); no steer into a running turn is carried there.',
  /** A drop that does not name everything `aikit gateway delegate` takes. */
  delegate: 'A message dragged onto a track: `aikit gateway delegate` takes the Communique, the work it becomes and why (--communique C --work W --reason R), and the drop did not name all three.',
  /** The groups while Central has not answered its agent-set listing. */
  team: 'Your groups: Central has not answered its agent-set listing yet (`central.agent-set.list`).',
  /** The conversation's Voice: speech turned into the composer's words by the kernel's local dictation (dictation_probe, then
   * dictation_transcribe; agent/useAgentVoice.ts), which needs the native kernel carrier. */
  voice: 'Voice: the kernel carrier is unavailable here, so its local dictation (dictation_probe, then dictation_transcribe) cannot be asked.',
  /** The conversation's session acts: a Position's journal names no session, so nothing here answers its proposals or stalls. */
  conversation: 'The conversation\'s session acts (Approve, Diff, Retry, Hard stop, Tell parent, a spawn\'s thread) are the Agent\'s: open its Thread for them. Messages carries the conversation\'s words.',
  /** The open conversation's light and last check-in with no agent open: both are the session its occupant works. */
  session: 'The conversation\'s light and its last check-in are the session its occupant works: open an agent in the list first.',
  /** The occupant's session observed, its connection state not reported yet. */
  opening: 'The conversation this agent works is being opened.',
  /** The session's needle: the agency's temporal reading names no check-in for it yet. */
  checkIn: 'Its last check-in: the agency\'s temporal reading has not reached the session this agent works yet.',
  /** Whether a change waits for your answer: the Arm's write mode, which no owner enforces on a session's writes yet. */
  writes: unread('Whether its changes wait for you', 'write-arm enforcement on the session\'s writes (WO-SF2): proposals · direct', 'Software Factory'),
  types: unread('The agent types to choose from', 'a type on Central\'s agent profile (agent-profile.express takes none; the six families are the face rig\'s ontology, held by no owner)', 'Central'),
  skillsets: unread('The skillsets it may carry', 'AIKit\'s sets for the card through the kernel', 'AIKit'),
  worlds: unread('The worlds it may work in', 'the World refs AIKit\'s population names (`aikit gateway who`: local_world_ref, project_world_ref) — not read yet', 'AIKit'),
  noProposal: 'Nothing is proposed yet: say what it is for and press Make.',
  noCarrier: 'The kernel carrier is unavailable here, so Central cannot be asked.',
  noWorld: 'Choose where it works first: no World is read (AIKit\'s population names none).',
  noMembers: 'Drag the members\' faces onto the card: a group needs at least one agent whose Position names it.',
  sameWords: 'Change keeps your words as Central received them (the proposal\'s provenance is verbatim): Discard it and Make again to say it differently.',
} as const

/** The person's own Central acts Messages carries (desktop/cradle/kernel/src/action.rs PERSON_ACTS), and the review it reads. */
export const PERSON_ACTS = {express: 'agent-profile.express', review: 'agent-profile.review', accept: 'agent-profile.accept', save: 'agent-profile.save',
  remove: 'agent-profile.remove', propose: 'central.agent-set.propose', saveSet: 'central.agent-set.save', removeSet: 'central.agent-set.remove'} as const

/** What each key no owner reports waits for. */
export const MESSAGES_ABSENT: Readonly<Record<string, string>> = {
  types: MESSAGES_REFUSE.types, skillsets: MESSAGES_REFUSE.skillsets,
  'conv.writes': MESSAGES_REFUSE.writes,
}

/** The writes no owner carries here, by key: the conversation's own controls (the Thread's Full under `conv.`, thread.tsx:8-17:
 * the proposal's and the stall's buttons, a spawn row's open), and Input. Send (`conv.sent`) writes through the open agent's
 * conversation (MessagesPorts.send), a drop onto a track (`delegate`) through AIKit's gateway (MessagesPorts.gateway), Voice
 * (`conv.voice`) through the kernel's dictation (MessagesPorts.voice). */
export const MESSAGES_REFUSED: Readonly<Record<string, string>> = {
  'conv.approve': MESSAGES_REFUSE.conversation, 'conv.diff': MESSAGES_REFUSE.conversation, 'conv.retry': MESSAGES_REFUSE.conversation,
  'conv.hardStop': MESSAGES_REFUSE.conversation, 'conv.tellParent': MESSAGES_REFUSE.conversation, 'conv.session': MESSAGES_REFUSE.conversation,
  'conv.input': MESSAGES_REFUSE.input,
}

/** The shell's own keys, and the starting value of the ones the manual gives one (§19.24: Show All, Order Needs you; the conversation's
 * filters as the Thread starts them, §17.10; Input on Queue, where the one send lands). The rest start empty: the agent you open, the
 * search, the draft, the card's fields. */
export const MESSAGES_VIEW: Readonly<Record<string, Value>> = {show: 'both', order: 'need', 'conv.toolRows': 'lines', 'conv.subagents': 'linked', 'conv.messages': 'all',
  'conv.input': 'queue'}
export const MESSAGES_LOCAL: readonly string[] = ['open', 'show', 'order', 'search', 'conv.draft', 'conv.toolRows', 'conv.subagents', 'conv.messages',
  'new.for', 'new.type', 'new.world', 'new.scope', 'new.carries', 'new.members']

/** The line you last sent and where it went (held by the hand once the conversation's owner took it): the Position and your words. */
export const sentOf = (held: unknown): {to: string; words: string} | null => {
  if (typeof held !== 'string') return null
  try {
    const sent = JSON.parse(held) as {to?: unknown; words?: unknown}
    return typeof sent.to === 'string' && typeof sent.words === 'string' ? {to: sent.to, words: sent.words} : null
  } catch { return null }
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
export function messagesAgents(population: unknown, accepted?: ReadonlySet<string>): Record<string, unknown>[] | null {
  if (!isObj(population) || !Array.isArray(population.positions)) return null
  const agents = Array.isArray(population.agents) ? population.agents.filter(isObj) : []
  const placed: Record<string, unknown>[] = population.positions.flatMap(row => {
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
  // The rest of your roster (§19.24 "Until you accept, the agent stands proposed, in Messages"): every agent Central keeps that no
  // Position names yet, by its AgentRef — at rest, its name and purpose as Central keeps them, else the words you made it with.
  const seated = new Set(placed.flatMap(row => [String(row.id)]))
  const named = new Set(agents.flatMap(agent => (Array.isArray(agent.positions) ? agent.positions.filter((ref): ref is string => typeof ref === 'string') : [])
    .filter(ref => seated.has(ref)).length ? [String(agent.agent_ref)] : []))
  const roster = agents.flatMap(agent => {
    const ref = str(agent.agent_ref)
    if (!ref || named.has(ref) || seated.has(ref)) return []
    const provenance = isObj(agent.source_relation) && isObj(agent.source_relation.intent_provenance) ? agent.source_relation.intent_provenance : {}
    const words = str(provenance.intent_expression)
    const purpose = str(agent.purpose) ?? words
    const profile = isObj(agent.source_relation) ? str(agent.source_relation.profile_ref) : undefined
    // Proposed until Central accepts it (agent-profile.roster `accepted`); the provenance stays generated either way.
    const proposed = provenance.recognition === 'unrecognised' && !(profile && accepted?.has(profile))
    const revision = isObj(agent.source_relation) ? str(agent.source_relation.revision) : undefined
    return [{id: ref, name: str(agent.label) ?? (words ? firstWords(words) : undefined) ?? str(agent.handle) ?? ref, ...(purpose ? {for: firstLine(purpose)} : {}),
      state: 'rest', last: proposed ? AGENT_PROPOSED : AGENT_UNSEATED, ...(proposed && profile ? {proposed: profile, ...(revision ? {revision} : {})} : {})}]
  })
  return [...placed, ...roster]
}

/** Central's roster of agent profiles with their acceptance (ctrl agent_profile_acceptance.rs ROSTER): a reading. */
export const AGENT_ROSTER = 'agent-profile.roster'
/** The profile refs Central's roster answers as accepted. Pure. */
export function acceptedProfilesOf(answer: unknown): ReadonlySet<string> {
  const rows = typeof answer === 'object' && answer !== null && Array.isArray((answer as {profiles?: unknown}).profiles) ? (answer as {profiles: unknown[]}).profiles : []
  return new Set(rows.flatMap(row => {
    const r = row as {accepted?: unknown; profile?: {ref?: unknown}} | null
    return r && r.accepted === true && typeof r.profile?.ref === 'string' ? [r.profile.ref] : []
  }))
}

/** An agent you made and have not accepted: what it waits for (§19.24). */
export const AGENT_PROPOSED = 'Proposed — Accept keeps it in your roster.'
/** An agent Central keeps that stands at no Position yet: it works only where you seat it (§19.24). */
export const AGENT_UNSEATED = 'Not seated yet — it works where you seat it.'
/** The first few words of what you made an agent for, as its name until Central keeps one. */
const firstWords = (words: string) => { const line = firstLine(words); const cut = line.split(/\s+/).slice(0, 5).join(' '); return cut.length < line.length ? `${cut}…` : cut }

/** The Positions of the population, by ref: the other side of each pair the open agent's conversation is read with. */
export function positionRefs(population: unknown): string[] {
  if (!isObj(population) || !Array.isArray(population.positions)) return []
  return population.positions.flatMap(row => (isObj(row) && str(row.position_ref) ? [String(row.position_ref)] : []))
}

/** An agent of your roster that stands at no Position (§19.24): its conversation is its own (the kernel's agent_conversation, made by
 * the one provision), observed and sent in through the one encounter session like an occupant's (O-I ticket 1003). */
export const isRosterAgent = (id: unknown): id is string => typeof id === 'string' && id.startsWith('agent:')

/** The agent that occupies a Position, by its agent ref (the population's occupancy): the agent whose session is the Position's
 * conversation. Undefined where the Position is vacant or not in the reading. Pure. */
export function occupantOf(population: unknown, positionRef: string): string | undefined {
  if (!isObj(population) || !Array.isArray(population.positions)) return undefined
  const row = population.positions.find(item => isObj(item) && item.position_ref === positionRef)
  return isObj(row) && isObj(row.occupancy) && row.occupancy.state === 'occupied' ? str(row.occupancy.agent_ref) : undefined
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
  /** The open agent's conversation (O-I ticket 1003): the session its occupant works, as the one encounter session observes it, with the
   * agent's name; `why` where there is none to observe (a vacant Position, a session not read, a refused observer). Absent: no agent
   * is open. */
  readonly conversation?: {readonly agent: string | null; readonly reading?: EncounterReading; readonly status?: EncounterStatus; readonly why?: string
    /** Seconds since the session's last check-in (its track's needle on the agency's temporal reading); -1 read and none. */
    readonly age?: number}
  /** Central's review of the agent profile Make wrote (agent-profile.review through invoke_action), read while one is held. */
  readonly review?: {readonly status: 'reading' | 'answered' | 'refused'; readonly value?: unknown; readonly error?: string}
  /** The run state of the session each agent works, by its agent ref (runFaces.ts runStateOfSession over the agency reading's tracks). */
  readonly runs?: ReadonlyMap<string, RunState>
  /** The project a project-scoped agent belongs to (the shell's project). */
  readonly project?: string
  /** The profiles Central has accepted, by profile ref (agent-profile.roster `accepted`): an agent you made stands proposed until then. */
  readonly accepted?: ReadonlySet<string>
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
  /** The one send (O-I ticket 1003): your words as the next turn in the conversation the Position's occupant works (session.ts `submit`);
   * rejects in the owner's words, or when the Position is not the one whose conversation is observed. Absent: none is observed. */
  readonly send?: (position: string, words: string) => Promise<void>
  /** AIKit's gateway writes, its Actions through the kernel's act (ownerRoutes.ts gatewayWriteOp): resolves with AIKit's reading or rejects
   * with its words. Absent: no carrier stands. */
  readonly gateway?: (request: GatewayWriteRequest) => Promise<unknown>
  /** Your words to the open roster agent's direct conversation (AIKit's encounter draft, then its prompt). Absent: no carrier stands. */
  readonly chat?: (words: string) => Promise<void>
  /** The kernel's local dictation (agent/useAgentVoice.ts agentVoicePort): start arms the capture, stop resolves with the transcript or
   * rejects with the dictation's named refusal. Absent: no carrier stands. */
  readonly voice?: {readonly start: () => Promise<void>; readonly stop: () => Promise<string>}
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
  // Voice: listening while the hand holds it on (the composer draws the wave), off otherwise.
  values['conv.voice'] = view['conv.voice'] === true
  // Input stands at Queue: the one send is the conversation's next turn.
  values['conv.input'] = 'queue'
  const known = input.population.status === 'answered' ? input.population.value : null
  const listed = known ? messagesAgents(known, input.accepted) : null
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
  // The line you sent to the open agent: the Thread draws it queued until the conversation's own rows hold it.
  const sent = sentOf(view.sent)
  if (open && sent?.to === open) values['conv.sent'] = sent.words
  // The open agent's conversation: the session its occupant works, as the Thread's rows.
  // Who answers: the occupant's name, else the open agent's own (an agent of your roster at no Position).
  const who = input.conversation?.agent ?? (open ? (agents ?? []).find(agent => agent.id === open)?.name : undefined)
  const said = open && input.conversation?.reading ? threadRowsOf(input.conversation.reading, input.conversation.status, typeof who === 'string' ? who : null) : null
  // Its light (the owner's connection state, as the Thread reads it) and its last check-in (its track's needle), while one is observed.
  if (open && input.conversation?.status) values['conv.light'] = threadLight(input.conversation.status)
  if (open && typeof input.conversation?.age === 'number') values['conv.age'] = input.conversation.age
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
  // The open agent's conversation, when there is none to observe: why.
  if (input.conversation?.why) standing.thread = {disabled: input.conversation.why}
  // The card's acts: Make while a carrier stands; Accept and Discard on the proposal Make wrote, once Central has reviewed it.
  const review = made?.kind === 'agent' ? input.review : undefined
  const reviewWhy = made?.kind === 'agent' && review?.status !== 'answered' ? review?.status === 'refused' && review.error ? review.error : 'Central has not answered the review of the proposal yet (agent-profile.review).' : null
  if (!ports.act) for (const key of ['make', 'accept', 'discard']) standing[key] = {disabled: MESSAGES_REFUSE.noCarrier}
  else {
    if (!made) for (const key of ['accept', 'discard']) standing[key] = {disabled: MESSAGES_REFUSE.noProposal}
    else if (reviewWhy) standing.accept = {disabled: reviewWhy}
  }
  if (!('proposal' in values) && made && !view.editing) standing.proposal = {disabled: reviewWhy ?? MESSAGES_REFUSE.noProposal}
  // Send: into the open agent's conversation, while one is observed; a drop onto a track names its own Communique, so only the carrier
  // gates it.
  const positions = positionRefs(known)
  if (!ports.voice) standing['conv.voice'] = {disabled: MESSAGES_REFUSE.voice}
  const unopened = typeof values.open !== 'string' || !(positions.includes(values.open) || isRosterAgent(values.open))
  if (unopened) standing['conv.sent'] = {disabled: MESSAGES_REFUSE.send}
  else if (!ports.send) standing['conv.sent'] = {disabled: input.conversation?.why ?? (ports.gateway ? MESSAGES_REFUSE.opening : MESSAGES_REFUSE.noCarrier)}
  // The conversation's light and last check-in: the session its occupant works, or why it is not read.
  for (const [key, waits] of [['conv.light', MESSAGES_REFUSE.opening], ['conv.age', MESSAGES_REFUSE.checkIn]] as const)
    if (!(key in values)) standing[key] = {disabled: unopened ? MESSAGES_REFUSE.session : input.conversation?.why ?? waits}
  if (!ports.gateway) for (const key of ['delegate', 'service']) standing[key] = {disabled: MESSAGES_REFUSE.noCarrier}

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
    const data = await act(PERSON_ACTS.express, {...scopeInput(scope), world_ref: world, intent_expression: words, purpose: words, ratified_world_refs: [world], ...(carries ? {skill_set_refs: carries} : {})})
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
    if (made.kind === 'group') {
      await act(PERSON_ACTS.removeSet, {...scopeInput(made), ref: made.ref, expected_revision: made.revision})
      hold(null)
      return
    }
    const reviewed = input.review?.status === 'answered' && isObj(input.review.value) && isObj(input.review.value.profile) ? input.review.value.profile : null
    await act(PERSON_ACTS.remove, {...scopeInput(made), profile_ref: made.ref, expected_revision: String(reviewed?.revision ?? made.revision)})
    hold(null)
  }
  /** Send: your words as the next turn in the conversation of the agent open when you press (the one send, O-I ticket 1003); the owner's
   * refusal is its own words. Once the owner took them, the line stands in the conversation until its rows hold it. */
  const send = async (words: Value | undefined) => {
    if (typeof words !== 'string' || !words.trim()) throw Error('Send: write the message first.')
    const open = pressed().open
    if (typeof open !== 'string' || !(positions.includes(open) || isRosterAgent(open))) throw Error(MESSAGES_REFUSE.send)
    if (!ports.send) throw Error(input.conversation?.why ?? MESSAGES_REFUSE.noCarrier)
    await ports.send(open, words)
    holdView(MESSAGES_ID, 'sent', JSON.stringify({to: open, words: words.trim()}))
  }
  /** Voice: on arms the kernel's dictation; off ends it and lands the transcript after the draft, editable and unsent. A refused
   * dictation rejects in its own words and nothing lands. */
  const voice = async (on: Value | undefined) => {
    if (!ports.voice) throw Error(MESSAGES_REFUSE.voice)
    if (on === true) {
      await ports.voice.start()
      holdView(MESSAGES_ID, 'conv.voice', true)
      return
    }
    holdView(MESSAGES_ID, 'conv.voice', false)
    const words = (await ports.voice.stop()).trim()
    if (!words) return
    const draft = pressed()['conv.draft']
    holdView(MESSAGES_ID, 'conv.draft', typeof draft === 'string' && draft.trim() ? `${draft.trimEnd()} ${words}` : words)
  }
  /** A message dropped onto a track: the Communique crosses into that work (`aikit gateway delegate`; Factory assigns custody). */
  const delegate = async (drop: Value | undefined) => {
    if (!ports.gateway) throw Error(MESSAGES_REFUSE.noCarrier)
    const named = delegationOf(drop)
    if (!named) throw Error(MESSAGES_REFUSE.delegate)
    await ports.gateway({kind: 'delegate', ...(project ? {project} : {}), ...named})
  }
  /** The Agency gateway's Service (§19.10, On by default): starts the gateway when none answers; the kernel holds it for this window. */
  const service = async (on: Value | undefined) => {
    if (!ports.gateway) throw Error(MESSAGES_REFUSE.noCarrier)
    await ports.gateway({kind: 'service', on: on !== false})
    gatewayMoved()
  }
  return {
    id: MESSAGES_ID,
    values,
    standing,
    local: {
      ...Object.fromEntries(MESSAGES_LOCAL.map(key => [key, (value: Value | undefined) => holdView(MESSAGES_ID, key, value)])),
      // Opening an agent you made and have not accepted opens Central's proposal of it (§19.24: it stands proposed, in Messages), for
      // Accept or Discard; opening any other lets a proposal opened that way go.
      open: (value: Value | undefined) => {
        holdView(MESSAGES_ID, 'open', value)
        const row = (known ? messagesAgents(known, input.accepted) ?? [] : []).find(agent => agent.id === value)
        if (row && typeof row.proposed === 'string') hold({kind: 'agent', scope: 'root', ref: row.proposed, revision: typeof row.revision === 'string' ? row.revision : 'r1'})
        else if (made?.kind === 'agent' && (known ? messagesAgents(known, input.accepted) ?? [] : []).some(agent => agent.proposed === made.ref)) hold(null)
      },
      // Change: back to the card's fields, the proposal still held; Make then saves the change.
      proposal: value => { if (value === undefined && made) holdView(MESSAGES_ID, 'editing', true) },
    },
    writes: key => key !== 'conv.light' && key !== 'conv.age' && (key in MESSAGES_REFUSED || key.startsWith('conv.')) || key === 'delegate' || key === 'service' || key === 'make' || key === 'accept' || key === 'discard',
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'conv.sent') { await send(value); continue }
        if (key === 'conv.voice') { await voice(value); continue }
        if (key === 'delegate') { await delegate(value); continue }
        if (key === 'service') { await service(value); continue }
        if (key === 'make') { await make(value); continue }
        if (key === 'accept') { await accept(); continue }
        if (key === 'discard') { await discard(); continue }
        throw Error(MESSAGES_REFUSED[key] ?? (key.startsWith('conv.') ? MESSAGES_REFUSE.conversation : `${key} is a reading: its owner reports it; nothing here changes it.`))
      }
    },
  }
}
