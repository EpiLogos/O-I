// Where Factory's devices stand (lane W1-Factory; DLW §16.1 "Six kinds of device", §16.2 "Chains on tracks", §19.1, §19.23). Pure: the
// chain each place draws, in order, and the devices that stand inside another's slot; FactoryDeviceChain.tsx draws exactly these.
//
// - A session's chain is "Agent, skills rack, scope" (§16.2), the member inside the rack (§19.7). A group's chain leads with the Agentset
//   rack (§19.15), then the same. "A track has no gateway and no landing of its own" (§19.23 Rules).
// - Factory's Main track carries "the Run map, Approvals and the prompt pads" (§16.2; §19.1 "The Main track"), in that order. The Run map
//   (§19.25) and the Prompt pads (§19.22) are bound (runMapBinding.ts, promptPadsBinding.ts) and stand where their devices do. "The Ledger is
//   a monitor, on the rail and in panes; the frames are the Gateway's (§19.2); Link is the transport's" (§19.1).
// - A workcell's chain is its rack (§19.23, kind rack) and the road it carries: "its Gateway, the Remote carrier that names the machine it
//   runs on, and Git / landing with the Seat inside it" (§16.2) — the Seat is Git / landing's Seat page (§19.17), not a device of its own.
// - A monitor stands "On the rail, and full in a pane. Never on a chain"; a connection "On a workcell's chain; Link stands in the transport.
//   Never on a track's chain" (§16.1): neither stands on a session's chain or the Main track's.
// - Retired in the 22 Oct manual rewrite, so standing on no chain: the Knowledge route (Scope's Knowledge page, §19.9), Capture skill (the
//   Skillset rack's Capture page, §19.11), the Decision helper (the Agentset rack's Helper page, §19.20), the Experiment (a task launched
//   with Repeat and its takes set side by side with Compare, §19.5) and the Seat (Git / landing's Seat page, §19.17). Their pages are the
//   carrying devices' own, hosted by prefixing the retired bindings (FactoryDeviceChain.tsx, oneAgentBinding.ts carryPages).
import {chainDeviceId} from './agentChainDevices'
import {AGENT_DESIGN, GATEWAY_DESIGN, LANDING_DESIGN, MEMBER_DESIGN, MEMBER_DEVICE_ID, RACK_DESIGN, SCOPE_DESIGN} from './designBindings'
import {APPROVALS_DESIGN, APPROVALS_ID} from './receiptBindings'
import {AGENTSET_DESIGN, AGENTSET_ID} from './sessionChainBindings'
import {CARRIER_DESIGN, CARRIER_ID} from './workcellBindings'
import {WORKCELL_RACK_DESIGN, WORKCELL_RACK_ID} from './workcellRackBinding'
import {RUN_MAP_DESIGN, RUN_MAP_ID} from './runMapBinding'
import {PROMPT_PADS_DESIGN, PROMPT_PADS_ID} from './promptPadsBinding'

/** A plate on one of Factory's chains. `agent`, `skillset`, `world`, `gateway` and `git` are the agent chain's slots (agentChainDevices.ts). */
export type FactorySlot = 'agentset' | 'agent' | 'skillset' | 'world' | 'run-map' | 'approvals' | 'prompt-pads'
  | 'workcell' | 'gateway' | 'remote-carrier' | 'git'
/** A device that stands inside another's slot: the rack's member (§19.7). */
export type FactoryMember = 'member'

/** Where the Device side stands: a workcell's return track, a session (or a group of them), or the Main track. */
export type FactoryPlace = {readonly kind: 'main'} | {readonly kind: 'session'; readonly group: boolean} | {readonly kind: 'workcell'; readonly name: string}

export const SESSION_CHAIN: readonly FactorySlot[] = ['agent', 'skillset', 'world']
export const GROUP_LEAD: readonly FactorySlot[] = ['agentset']
export const MAIN_CHAIN: readonly FactorySlot[] = ['approvals']
export const WORKCELL_CHAIN: readonly FactorySlot[] = ['workcell', 'gateway', 'remote-carrier', 'git']
export const INSIDE: Readonly<Partial<Record<FactorySlot, FactoryMember>>> = {skillset: 'member'}

/** The agent chain's slots: drawn with their grip and their drop target (FactoryDeviceChain.tsx). */
export const AGENT_SLOTS: ReadonlySet<FactorySlot> = new Set(['agent', 'skillset', 'world', 'gateway', 'git'])

/** Each plate's device on the door, and the design that draws it. */
export const SLOT_DEVICE: Readonly<Record<FactorySlot | FactoryMember, {readonly id: string; readonly design: string}>> = {
  agentset: {id: AGENTSET_ID, design: AGENTSET_DESIGN},
  agent: {id: chainDeviceId('agent'), design: AGENT_DESIGN},
  skillset: {id: chainDeviceId('skillset'), design: RACK_DESIGN},
  member: {id: MEMBER_DEVICE_ID, design: MEMBER_DESIGN},
  world: {id: chainDeviceId('world'), design: SCOPE_DESIGN},
  'run-map': {id: RUN_MAP_ID, design: RUN_MAP_DESIGN},
  approvals: {id: APPROVALS_ID, design: APPROVALS_DESIGN},
  'prompt-pads': {id: PROMPT_PADS_ID, design: PROMPT_PADS_DESIGN},
  workcell: {id: WORKCELL_RACK_ID, design: WORKCELL_RACK_DESIGN},
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
 * (`runMap`, `pads`). */
export function chainSlots(place: FactoryPlace, stands: {readonly runMap?: boolean; readonly pads?: boolean} = {}): readonly FactorySlot[] {
  if (place.kind === 'workcell') return WORKCELL_CHAIN
  if (place.kind === 'main') return [...(stands.runMap ? ['run-map' as const] : []), ...MAIN_CHAIN, ...(stands.pads ? ['prompt-pads' as const] : [])]
  return place.group ? [...GROUP_LEAD, ...SESSION_CHAIN] : SESSION_CHAIN
}
