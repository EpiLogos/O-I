// Where Factory's devices stand (lane W1-Factory; DLW §16.1 "Six kinds of device", §16.2 "Chains on tracks", §19.1, §19.23). Pure: the
// chain each place draws, in order, and the devices that stand inside another's slot; FactoryDeviceChain.tsx draws exactly these.
//
// - A session's chain is "Agent, skills rack, scope" (§16.2), the member inside the rack (§19.7), the Knowledge route inside Scope (§16.1
//   "one Scope … with the Knowledge route inside it"; §19.9 "Chain: inside the Scope device"). A group's chain leads with the Agentset
//   rack (§19.15) and the Decision helper (§19.20), then the same. "A track has no gateway and no landing of its own" (§19.23 Rules).
// - Capture skill stands "on the armed Factory track" (§19.11): Factory's armed track is the selected session's (the transport's Voice
//   records "into the armed track"), so it closes a session's chain, after Scope — never a group's, a workcell's or the Main track's.
// - Factory's Main track carries "the Run map, the experiments, Approvals and the prompt pads" (§16.2), in that order. The Run map (§19.25)
//   and the Prompt pads (§19.22) are bound (runMapBinding.ts, promptPadsBinding.ts) and stand where their devices do: Software Factory's
//   family admits neither face yet, so until it does the Main track's chain is the Experiment, then Approvals. "The gateways, the frames and the ledger are monitors, on the rail and in panes; Link is the transport's" (§19.1).
// - A workcell's chain is its rack (§19.23, kind rack) and the road it carries: "its Gateway, the Remote carrier that names the machine it
//   runs on, and Git / landing with the Seat inside it" (§16.2).
// - A monitor stands "On the rail, and full in a pane. Never on a chain"; a connection "On a workcell's chain; Link stands in the transport.
//   Never on a track's chain" (§16.1): neither stands on a session's chain or the Main track's.
import {chainDeviceId} from './agentChainDevices'
import {AGENT_DESIGN, GATEWAY_DESIGN, LANDING_DESIGN, MEMBER_DESIGN, MEMBER_DEVICE_ID, RACK_DESIGN, SCOPE_DESIGN} from './designBindings'
import {DECISION_HELPER_DESIGN, DECISION_HELPER_ID} from './decisionHelperBinding'
import {EXPERIMENT_DESIGN, EXPERIMENT_ID} from './mainTrackBindings'
import {APPROVALS_DESIGN, APPROVALS_ID} from './receiptBindings'
import {AGENTSET_DESIGN, AGENTSET_ID} from './sessionChainBindings'
import {CARRIER_DESIGN, CARRIER_ID, SEAT_DESIGN, SEAT_ID} from './workcellBindings'
import {KNOWLEDGE_ROUTE_DESIGN, KNOWLEDGE_ROUTE_ID} from './knowledgeRouteBinding'
import {WORKCELL_RACK_DESIGN, WORKCELL_RACK_ID} from './workcellRackBinding'
import {CAPTURE_SKILL_DESIGN, CAPTURE_SKILL_ID} from './captureSkillBinding'
import {RUN_MAP_DESIGN, RUN_MAP_ID} from './runMapBinding'
import {PROMPT_PADS_DESIGN, PROMPT_PADS_ID} from './promptPadsBinding'

/** A plate on one of Factory's chains. `agent`, `skillset`, `world`, `gateway` and `git` are the agent chain's slots (agentChainDevices.ts). */
export type FactorySlot = 'agentset' | 'decision-helper' | 'agent' | 'skillset' | 'world' | 'capture' | 'run-map' | 'experiment' | 'approvals' | 'prompt-pads'
  | 'workcell' | 'gateway' | 'remote-carrier' | 'git'
/** A device that stands inside another's slot: the rack's member (§19.7), the Knowledge route inside Scope (§19.9), the Seat inside Git /
 * landing (§19.17). */
export type FactoryMember = 'member' | 'knowledge' | 'seat'

/** Where the Device side stands: a workcell's return track, a session (or a group of them), or the Main track. */
export type FactoryPlace = {readonly kind: 'main'} | {readonly kind: 'session'; readonly group: boolean} | {readonly kind: 'workcell'; readonly name: string}

export const SESSION_CHAIN: readonly FactorySlot[] = ['agent', 'skillset', 'world']
export const GROUP_LEAD: readonly FactorySlot[] = ['agentset', 'decision-helper']
export const MAIN_CHAIN: readonly FactorySlot[] = ['experiment', 'approvals']
export const WORKCELL_CHAIN: readonly FactorySlot[] = ['workcell', 'gateway', 'remote-carrier', 'git']
export const INSIDE: Readonly<Partial<Record<FactorySlot, FactoryMember>>> = {skillset: 'member', world: 'knowledge', git: 'seat'}

/** The agent chain's slots: drawn with their grip and their drop target (FactoryDeviceChain.tsx). */
export const AGENT_SLOTS: ReadonlySet<FactorySlot> = new Set(['agent', 'skillset', 'world', 'gateway', 'git'])

/** Each plate's device on the door, and the design that draws it. */
export const SLOT_DEVICE: Readonly<Record<FactorySlot | FactoryMember, {readonly id: string; readonly design: string}>> = {
  agentset: {id: AGENTSET_ID, design: AGENTSET_DESIGN},
  'decision-helper': {id: DECISION_HELPER_ID, design: DECISION_HELPER_DESIGN},
  agent: {id: chainDeviceId('agent'), design: AGENT_DESIGN},
  skillset: {id: chainDeviceId('skillset'), design: RACK_DESIGN},
  member: {id: MEMBER_DEVICE_ID, design: MEMBER_DESIGN},
  world: {id: chainDeviceId('world'), design: SCOPE_DESIGN},
  capture: {id: CAPTURE_SKILL_ID, design: CAPTURE_SKILL_DESIGN},
  knowledge: {id: KNOWLEDGE_ROUTE_ID, design: KNOWLEDGE_ROUTE_DESIGN},
  'run-map': {id: RUN_MAP_ID, design: RUN_MAP_DESIGN},
  experiment: {id: EXPERIMENT_ID, design: EXPERIMENT_DESIGN},
  approvals: {id: APPROVALS_ID, design: APPROVALS_DESIGN},
  'prompt-pads': {id: PROMPT_PADS_ID, design: PROMPT_PADS_DESIGN},
  workcell: {id: WORKCELL_RACK_ID, design: WORKCELL_RACK_DESIGN},
  gateway: {id: chainDeviceId('gateway'), design: GATEWAY_DESIGN},
  'remote-carrier': {id: CARRIER_ID, design: CARRIER_DESIGN},
  git: {id: chainDeviceId('git'), design: LANDING_DESIGN},
  seat: {id: SEAT_ID, design: SEAT_DESIGN},
}

/** The place the Device side stands for: a selected workcell's return track, else a selected session (a group's head is a session of its
 * own), else the Main track (§16.2; Live shows the Main track's chain when no other track is chosen). */
export function factoryPlace(input: {readonly sessionRef: string | null; readonly group: boolean; readonly workcell: string | null}): FactoryPlace {
  if (input.workcell) return {kind: 'workcell', name: input.workcell}
  if (input.sessionRef != null) return {kind: 'session', group: input.group}
  return {kind: 'main'}
}

/** The chain a place draws, left to right. The Decision helper stands on a group's chain only where its device does (`helper`); Capture
 * skill closes a session's chain where its device stands (`capture`: the armed track's); the Run map leads the Main track and the Prompt
 * pads close it where their devices stand (`runMap`, `pads`). */
export function chainSlots(place: FactoryPlace, stands: {readonly helper: boolean; readonly capture?: boolean; readonly runMap?: boolean; readonly pads?: boolean} = {helper: true}): readonly FactorySlot[] {
  if (place.kind === 'workcell') return WORKCELL_CHAIN
  if (place.kind === 'main') return stands.runMap || stands.pads
    ? [...(stands.runMap ? ['run-map' as const] : []), ...MAIN_CHAIN, ...(stands.pads ? ['prompt-pads' as const] : [])] : MAIN_CHAIN
  return place.group ? [...GROUP_LEAD.filter(slot => slot !== 'decision-helper' || stands.helper), ...SESSION_CHAIN]
    : stands.capture ? [...SESSION_CHAIN, 'capture'] : SESSION_CHAIN
}
