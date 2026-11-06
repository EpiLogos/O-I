// Where Factory's devices stand (lane W1-Factory; DLW §16.1 "Six kinds of device", §16.2 "Chains on tracks", §19.1, §19.23). Pure: the
// chain each place draws, in order, and the devices that stand inside another's slot; FactoryDeviceChain.tsx draws exactly these.
//
// - A session's chain is §16.2's Factory row: "Gateway and Remote carrier; the Sources every agent reads; the Agent rack, whose chains are
//   the agents and agent sets the session may use; the Scope that bounds them all; then Git / landing" (O-I #842; §19.15 "A session of one
//   agent has a rack of that one chain"). Every session holds the one rack, a group's and a lone session's alike. The session's own agent is
//   one chain of the rack, and its devices stand inside the rack (§16.4): its own Sources, what it carries, the Skillset rack with its member
//   inside it (§19.7), before the Agent (§19.4 "Sources, the Skillset rack, the Agent, Scope"). The Decision helper is a chain of the rack,
//   in place of an Agent (§19.20), so it takes no slot of the track's chain.
// - Sources stands before the Agent in two places (§19.9 "Chain: before the Agent … ahead of the Agent rack for every agent, or inside one
//   agent's chain"; DLW build ruling 2026-11-05): ahead of the rack it is the shared reading every agent of the rack reads (`sources`),
//   inside the agent's chain it is that agent's own (`chain-sources`). AIKit keeps where it stands, and its settings, among the session's
//   settings (encounter-session-settings: `sources`, or `rack_sources` for the shared reading).
// - How far each reaches is where it stands (§16.1 "How far a setting reaches"; §19.15 "What stands outside the rack"): the connections, the
//   Scope and the landing on the track's chain reach every chain of the rack; a device inside a chain reaches that agent alone (reachOf).
// - Factory's Main track carries "the Run map, Approvals and the prompt pads" (§16.2; §19.1 "The Main track"), in that order. The Run map
//   (§19.25) and the Prompt pads (§19.22) are bound (runMapBinding.ts, promptPadsBinding.ts) and stand where their devices do. "The Ledger is
//   a monitor, on the rail and in panes; the frames are the Gateway's (§19.2); Link is the transport's" (§19.1).
// - A workcell's chain is the road: the Gateway, the Remote carrier and Git / landing, in that order (§16.2 "Connections keep the same
//   order") — the Seat is Git / landing's Seat page (§19.17), not a device of its own. Workcell's instrument "stands on no chain" (§19.23):
//   it stands full in a pane and as its tile on the rail (AgentRailDevices.tsx).
// - A monitor stands "On the rail, and full in a pane. Never on a chain"; a connection "On a workcell's chain; Link stands in the transport.
//   Never on a track's chain" (§16.1): neither stands on a session's chain or the Main track's.
// - Retired in the 22 Oct manual rewrite, so standing on no chain: the Knowledge route (now Sources, §19.9, which stands in the two places
//   above), Capture skill (the Skillset rack's Capture page, §19.11), the Experiment (a task launched with Repeat and its takes set side by
//   side with Compare, §19.5) and the Seat (Git / landing's Seat, Lane and Release, §19.17). Their pages are the
//   carrying devices' own, hosted by prefixing the retired bindings (FactoryDeviceChain.tsx, oneAgentBinding.ts carryPages).
import {chainDeviceId, SOURCES_DESIGN, SOURCES_DEVICE_IDS} from './agentChainDevices'
import {AGENT_DESIGN, GATEWAY_DESIGN, LANDING_DESIGN, MEMBER_DESIGN, MEMBER_DEVICE_ID, RACK_DESIGN, SCOPE_DESIGN} from './designBindings'
import {APPROVALS_DESIGN, APPROVALS_ID} from './receiptBindings'
import {AGENTSET_DESIGN, AGENTSET_ID} from './sessionChainBindings'
import {CARRIER_DESIGN, CARRIER_ID} from './workcellBindings'
import {RUN_MAP_DESIGN, RUN_MAP_ID} from './runMapBinding'
import {PROMPT_PADS_DESIGN, PROMPT_PADS_ID} from './promptPadsBinding'

/** A plate on one of Factory's chains. `agent`, `skillset`, `world`, `gateway` and `git` are the agent chain's slots (agentChainDevices.ts). */
export type FactorySlot = 'sources' | 'agentset' | 'chain-sources' | 'agent' | 'skillset' | 'world' | 'run-map' | 'approvals' | 'prompt-pads'
  | 'gateway' | 'remote-carrier' | 'git'
/** A device that stands inside another's slot: the rack's member (§19.7). */
export type FactoryMember = 'member'

/** Where the Device side stands: a workcell's return track, a session (or a group of them), or the Main track. */
export type FactoryPlace = {readonly kind: 'main'} | {readonly kind: 'session'; readonly group: boolean} | {readonly kind: 'workcell'; readonly name: string}

export const SESSION_CHAIN: readonly FactorySlot[] = ['gateway', 'remote-carrier', 'sources', 'agentset', 'world', 'git']
/** The session's own agent's chain, inside the rack (§19.15 "An agent's chain shows its Sources, its Skillset rack, its Agent and its
 * Scope"): the devices bound here, in the order they work. */
export const RACK_CHAIN: readonly FactorySlot[] = ['chain-sources', 'skillset', 'agent']
export const MAIN_CHAIN: readonly FactorySlot[] = ['approvals']
export const WORKCELL_CHAIN: readonly FactorySlot[] = ['gateway', 'remote-carrier', 'git']
export const INSIDE: Readonly<Partial<Record<FactorySlot, FactoryMember>>> = {skillset: 'member'}

/** The agent chain's slots: drawn with their grip and their drop target (FactoryDeviceChain.tsx). */
export const AGENT_SLOTS: ReadonlySet<FactorySlot> = new Set(['agent', 'skillset', 'world', 'gateway', 'git'])

/** Each plate's device on the door, and the design that draws it. */
export const SLOT_DEVICE: Readonly<Record<FactorySlot | FactoryMember, {readonly id: string; readonly design: string}>> = {
  sources: {id: SOURCES_DEVICE_IDS.rack, design: SOURCES_DESIGN},
  agentset: {id: AGENTSET_ID, design: AGENTSET_DESIGN},
  'chain-sources': {id: SOURCES_DEVICE_IDS.chain, design: SOURCES_DESIGN},
  agent: {id: chainDeviceId('agent'), design: AGENT_DESIGN},
  skillset: {id: chainDeviceId('skillset'), design: RACK_DESIGN},
  member: {id: MEMBER_DEVICE_ID, design: MEMBER_DESIGN},
  world: {id: chainDeviceId('world'), design: SCOPE_DESIGN},
  'run-map': {id: RUN_MAP_ID, design: RUN_MAP_DESIGN},
  approvals: {id: APPROVALS_ID, design: APPROVALS_DESIGN},
  'prompt-pads': {id: PROMPT_PADS_ID, design: PROMPT_PADS_DESIGN},
  gateway: {id: chainDeviceId('gateway'), design: GATEWAY_DESIGN},
  'remote-carrier': {id: CARRIER_ID, design: CARRIER_DESIGN},
  git: {id: chainDeviceId('git'), design: LANDING_DESIGN},
}

/** The place the Device side stands for: a selected workcell's return track, else a selected session (a group's head is a session of its
 * own), else the Main track (§16.2; Live shows the Main track's chain when no other track is chosen). */
export function factoryPlace(input: {readonly sessionRef: string | null; readonly group: boolean; readonly workcell: string | null}): FactoryPlace {
  if (input.workcell) return {kind: 'workcell', name: input.workcell}
  if (input.sessionRef != null) return {kind: 'session', group: input.group}
  return {kind: 'main'}
}

/** The chain a place draws, left to right. The Run map leads the Main track and the Prompt pads close it where their devices stand
 * (`runMap`, `pads`). A session's chain is the same for a group and a lone session: the rack's chains differ, never the track's. */
export function chainSlots(place: FactoryPlace, stands: {readonly runMap?: boolean; readonly pads?: boolean} = {}): readonly FactorySlot[] {
  if (place.kind === 'workcell') return WORKCELL_CHAIN
  if (place.kind === 'main') return [...(stands.runMap ? ['run-map' as const] : []), ...MAIN_CHAIN, ...(stands.pads ? ['prompt-pads' as const] : [])]
  return SESSION_CHAIN
}

/** A chain of the rack, as reachOf names it. */
export interface RackChainName {
  readonly id: string
  readonly name: string
}

/** How far a device on a session's chain reaches (§16.1 "How far a setting reaches"; §19.15 "What stands outside the rack"): every chain of
 * the rack, the rack's own chains each in its own chain, one chain alone, or — off a session's chain — the track it stands on. */
export type Reach =
  | {readonly reaches: 'every-chain'; readonly chains: readonly string[]; readonly says: string}
  | {readonly reaches: 'rack'; readonly chains: readonly string[]; readonly says: string}
  | {readonly reaches: 'chain'; readonly chain: string; readonly says: string}
  | {readonly reaches: 'track'; readonly says: string}

/** Off a session's chain (the Main track's, a workcell's), a device reaches the track it stands on. */
export const ON_ITS_TRACK: Reach = {reaches: 'track', says: 'The track it stands on.'}

/** What each device outside the rack does for every chain, in §19.15's words. */
const OUTSIDE: Readonly<Partial<Record<FactorySlot, (names: string) => string>>> = {
  gateway: names => `The road in for every chain of the Agent rack (${names}), unless a chain holds one of its own.`,
  sources: names => `The shared reading every chain of the Agent rack reads (${names}); an agent's own Sources adds to it.`,
  'remote-carrier': names => `Where every chain of the Agent rack runs (${names}), unless a chain holds one of its own.`,
  world: names => `What every chain of the Agent rack may do (${names}). An agent's own Scope only narrows it.`,
  git: names => `Where the work of every chain of the Agent rack lands (${names}), unless a chain holds one of its own.`,
}

/** How far the device in `slot` reaches, given the rack's chains and the chain whose devices stand inside the rack (`inside`, the session's
 * own). Pure. */
export function reachOf(slot: FactorySlot, chains: readonly RackChainName[], inside?: string): Reach {
  const names = chains.length ? chains.map(chain => chain.name).join(', ') : 'no chain yet'
  const ids = chains.map(chain => chain.id)
  const outside = OUTSIDE[slot]
  if (outside) return {reaches: 'every-chain', chains: ids, says: outside(names)}
  if (slot === 'agentset') return {reaches: 'rack', chains: ids, says: `Each agent and each set in its own chain (${names}); their returns are mixed by Join as they leave the rack.`}
  if (RACK_CHAIN.includes(slot) && inside !== undefined) {
    const name = chains.find(chain => chain.id === inside)?.name ?? inside
    return {reaches: 'chain', chain: inside, says: `${name} alone: it stands inside ${name}'s chain of the Agent rack.`}
  }
  return ON_ITS_TRACK
}

// ---------------------------------------------------------------- where a dropped Sources stands (§19.9 To use Sources)

/** Where a Sources dropped on a session's chain stands: inside the agent's own chain where it is dropped on a device of that chain (its
 * Sources, its Skillset rack, its Agent), else ahead of the Agent rack, the shared reading ("For every agent of a track, drop it ahead of
 * the Agent rack"). `card` is the slot of the device it was dropped on, null for the drop zone. Pure. */
export function sourcesPlacementOf(card: string | null): 'rack' | 'chain' {
  return card !== null && (RACK_CHAIN as readonly string[]).includes(card) ? 'chain' : 'rack'
}

/** The setting AIKit keeps for a Sources placed there (encounter-session-settings `track`): `sources` on the agent's own chain,
 * `rack_sources` for the shared reading. Pure. */
export const sourcesPlaceRequest = (placement: 'rack' | 'chain'): {readonly track: Readonly<Record<string, boolean>>} =>
  ({track: {[placement === 'chain' ? 'sources' : 'rack_sources']: true}})

/** Sources taken off where it stood (DLW build ruling 2026-11-06), by ⌫ on its plate or a drag off the chain: AIKit's `sources: false` on the
 * agent's own chain, `rack_sources: false` for the shared reading. Its settings stay AIKit's, and stand again when it is placed again. Pure. */
export const sourcesUnplaceRequest = (placement: 'rack' | 'chain'): {readonly track: Readonly<Record<string, boolean>>} =>
  ({track: {[placement === 'chain' ? 'sources' : 'rack_sources']: false}})

/** The drag a placed Sources carries off its chain: where it stands (`rack` or `chain`). Dropped anywhere outside the chain, it comes off. */
export const SOURCES_OFF_DRAG = 'application/x-oi-sources-off'
