// Factory's Main track devices and the Frames monitor on their owners (lane BF2): the Gateways rack (DLW §19.2, actuation:
// gateways-rack — "Factory's Main track", first device), the Agency gateway (§19.9, ai-kit:agency-gateway — "one chain in the
// Gateways rack"), the Experiment (§19.4, actuation:experiment — "any Factory track"; it compares sessions, so it stands on the Main
// track) and the Frames monitor (§19.5 and its widget §23.8, actuation:frames-monitor — the Gateway's Full, and the rail's Frames).
//
// What the owners report, read 16 Oct 2026 through the installed owners (scratch lane-bf2/shapes/):
//   harness_agent_read {binding} — `aikit --json gateway agent --binding <b> sessions`: the AIKit agency gateway's answer about the
//     bound harness. On this machine the gateway is not running: `{"ok":false,"error":{"code":"cli.gateway_unreachable","message":
//     "connect gateway socket …/gateway.sock: No such file or directory …; start one with `aikit gateway serve`"}}`, which the kernel
//     passes as `{refused: true, error, message}` (agency.rs:144-176). It is the only gateway reading a kernel op reaches.
//   `aikit --json gateway modes|coexistence|who|connector list|remote list` answer (entry modes and their terms, the foreign
//     harness gateways, the Positions and their inbox, the connectors, the declared remotes) — but no kernel op runs any of them, so
//     the Agency gateway's surfaces, agents, harnesses, peers, entry and inbox stay absent, and each write stands disabled with the
//     operation it lacks.
//   Actuation's research comparison (comparison.rs run_with) and the gateway's frame ring have no kernel op at all: the Experiment's
//     declaration and runs, and the monitor's frames, are absent.
// The chains of the rack are the four the Actuation family declares (actuationFamilyManifest.ts:15 invariant.chains) — the
// registered gateways — each with the state its reading earns: Ready (it answered), Refused (its owner's words), or none read. The
// Remote carrier's chain reads Workcell's own status (lane BF3, workcellBindings.ts carrierChainState: Composed while a machine is
// connected, since nothing has carried a session through it).
// Pure, apart from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {IconName} from '../../inhabitants/sdk/icons'
import {allFamilyManifests} from '../../inhabitants/familyManifest'
import {inhabitantManifest} from '../../inhabitants/manifest'
import {gatewayDisclosed, type AgentChainReading} from './agentChainDevices'
import {gatewayValues, holdView, viewHolds, type ChainHolds, type GatewayInput} from './designBindings'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

export const GATEWAYS_RACK_DESIGN = 'actuation:gateways-rack'
export const AGENCY_GATEWAY_DESIGN = 'ai-kit:agency-gateway'
export const EXPERIMENT_DESIGN = 'actuation:experiment'
export const FRAMES_DESIGN = 'actuation:frames-monitor'

export const GATEWAYS_RACK_ID = 'factory:main:gateways'
export const AGENCY_GATEWAY_ID = 'factory:main:agency-gateway'
export const EXPERIMENT_ID = 'factory:main:experiment'
export const FRAMES_ID = 'factory:frames'
export const MAIN_DEVICE_IDS: readonly string[] = [GATEWAYS_RACK_ID, AGENCY_GATEWAY_ID, EXPERIMENT_ID, FRAMES_ID]

/** A device of an admitted family face (designKey(family, face.id) is its design's id), its values its design's from the binding;
 * null when the family does not admit the face. The family as composed (inhabitants/manifest.ts inhabitantManifest: its base and the
 * extensions declared onto it, Software Factory's attempt-review among them). */
export function familyFaceDevice(id: string, family: string, faceId: string, title: string, icon: IconName): DeviceInstance | null {
  const face = (inhabitantManifest(family)?.faces ?? allFamilyManifests().find(manifest => manifest.id === family)?.faces)?.find(candidate => candidate.id === faceId)
  if (!face) return null
  return {id, family, rows: [], values: {},
    face: {id: face.id, title, icon, liveSemantic: face.liveSemantic, ...(face.invariant ? {invariant: face.invariant} : {}), ...(face.note ? {note: face.note} : {})}}
}

export const mainDevices = () => ({
  rack: familyFaceDevice(GATEWAYS_RACK_ID, 'actuation', 'gateways-rack', 'Gateways', 'chain'),
  agency: familyFaceDevice(AGENCY_GATEWAY_ID, 'ai-kit', 'agency-gateway', 'Agency gateway', 'link'),
  experiment: familyFaceDevice(EXPERIMENT_ID, 'actuation', 'experiment', 'Experiment', 'metroDots'),
  frames: familyFaceDevice(FRAMES_ID, 'actuation', 'frames-monitor', 'Frames', 'detail'),
})

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

// ---------------------------------------------------------------------------------------------------------------- the gateway's answer

/** What harness_agent_read's answer says of the AIKit agency gateway and of the harness behind it. */
export type GatewayAnswer =
  | {readonly kind: 'unread'}
  /** The gateway answered about the binding. */
  | {readonly kind: 'answered'}
  /** The gateway itself did not answer (its socket is absent, it is not running): the owner's words. */
  | {readonly kind: 'unreachable'; readonly words: string}
  /** The gateway answered, and refused the binding: the owner's words. */
  | {readonly kind: 'refused'; readonly words: string}

const UNREACHABLE = new Set(['owner_unreachable', 'cli.gateway_unreachable'])

export function gatewayAnswer(reading: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>): GatewayAnswer {
  if (reading.gatewayAdmitted === true) return {kind: 'answered'}
  const doc = reading.gatewayDoc
  if (reading.gatewayAdmitted !== false || !isObj(doc) || !('refused' in doc)) return {kind: 'unread'}
  const error = isObj(doc.error) ? doc.error : {}
  const words = str(doc.message) ?? str(error.message) ?? 'The gateway gave no reason.'
  return UNREACHABLE.has(String(error.code)) ? {kind: 'unreachable', words} : {kind: 'refused', words}
}

// ---------------------------------------------------------------------------------------------------------------- the Gateways rack

/** The chains of the rack: the Actuation family's declared gateways (actuationFamilyManifest.ts:15), by the manual's names (§19.2). */
export const GATEWAY_CHAINS: readonly {readonly id: string; readonly name: string}[] = [
  {id: 'hermes', name: 'Hermes gateway'},
  {id: 'aikit-agency-gateway', name: 'AIKit agency gateway'},
  {id: 'actuation-frank', name: 'Actuation gateway'},
  {id: 'remote-carrier', name: 'Remote carrier'},
]

/** The registered chains: the family's declaration, else none (a rack never invents a chain). */
export function registeredChains(): readonly string[] {
  const face = allFamilyManifests().find(manifest => manifest.id === 'actuation')?.faces.find(candidate => candidate.id === 'gateways-rack')
  const chains = face?.invariant && Array.isArray((face.invariant as {chains?: unknown}).chains) ? (face.invariant as {chains: unknown[]}).chains : []
  return chains.filter((chain): chain is string => typeof chain === 'string')
}

export const RACK_REFUSE = {
  fanOut: missing('Fan-out', 'kernel:harness_agent_control configure {fan_out}', 'Actuation'),
} as const

export interface RackInput {
  readonly reading: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>
  readonly holds: ChainHolds
  /** The Remote carrier's standing as a chain (workcellBindings.ts carrierChainState), where Workcell's status was read. */
  readonly carrier?: {readonly state?: 'ready' | 'composed' | 'refused'; readonly why?: string}
}

/** One chain's row (actuation__gateways-rack.tsx:7-10): its state from the reading that reaches it, the refusal in the owner's words.
 * The Hermes harness is read through AIKit's gateway, so with that gateway down it is not read at all; the Actuation gateway has no
 * reading a kernel op reaches; the Remote carrier's is Workcell's status. */
function chainRow(id: string, name: string, answer: GatewayAnswer, doc: unknown, carrier: RackInput['carrier']): Record<string, Value> {
  const row: Record<string, Value> = {id, name}
  if (id === 'remote-carrier') {
    if (carrier?.state) row.state = carrier.state
    if (carrier?.why) row.why = carrier.why
  }
  if (id === 'aikit-agency-gateway') {
    if (answer.kind === 'answered' || answer.kind === 'refused') row.state = 'ready'
    if (answer.kind === 'unreachable') { row.state = 'refused'; row.why = answer.words }
  }
  if (id === 'hermes') {
    if (answer.kind === 'answered') {
      row.state = 'ready'
      const transport = gatewayDisclosed(doc).transport
      if (typeof transport === 'string') row.transport = transport
    }
    if (answer.kind === 'refused') { row.state = 'refused'; row.why = answer.words }
  }
  return row
}

export function rackValues(input: RackInput): Values {
  const values: Record<string, Value> = {}
  const answer = gatewayAnswer(input.reading)
  const names = new Map(GATEWAY_CHAINS.map(chain => [chain.id, chain.name]))
  const rows = registeredChains().map(id => chainRow(id, names.get(id) ?? id, answer, input.reading.gatewayDoc, input.carrier))
  if (rows.length) values.chains = JSON.stringify(rows)
  // The rack's light: on when a chain is ready, off when the chains read are all refused or only composed, unread otherwise.
  if (rows.some(row => row.state === 'ready')) values.light = 'lit'
  else if (rows.some(row => row.state === 'refused' || row.state === 'composed')) values.light = 'dark'
  put(values, 'chain', viewHolds(input.holds, GATEWAYS_RACK_ID).chain)
  return values
}

/** The rack's binding: the chosen chain is the view's own (and shows that gateway whole in the pool); Fan-out has no carrier. */
export function rackBinding(input: RackInput, ports: {readonly show: (chain: string) => void}): DesignBinding {
  return {
    id: GATEWAYS_RACK_ID,
    values: rackValues(input),
    standing: disabled(RACK_REFUSE),
    local: {chain: value => { holdView(GATEWAYS_RACK_ID, 'chain', typeof value === 'string' ? value : undefined); if (typeof value === 'string') ports.show(value) }},
    writes: key => key === 'fanOut',
    write: async changes => {
      for (const {key} of changes) throw Error(key === 'fanOut' ? RACK_REFUSE.fanOut : `${key} is a reading: its owner reports it; nothing here changes it.`)
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Agency gateway

export const AGENCY_REFUSE = {
  service: missing('Service', 'aikit gateway serve · shutdown through the kernel', 'AIKit'),
  entry: missing('Entry', 'aikit gateway setup --mode <entry> --apply through the kernel', 'AIKit'),
  coexist: missing('Coexist', 'aikit gateway coexistence --policy through the kernel', 'AIKit'),
  agentPolicy: missing('Calls', 'an ingress rule for the sender kind agent (GatewayIngressDecision has no write for it)', 'AIKit'),
  surfaces: missing('Surfaces', 'aikit gateway connector add · remove through the kernel', 'AIKit'),
} as const

/** The Agency gateway's values (§19.9): its light and state from whether it answered, its refusal in its own words; nothing else a
 * kernel op reaches. */
export function agencyValues(reading: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>, holds: ChainHolds): Values {
  const values: Record<string, Value> = {}
  const answer = gatewayAnswer(reading)
  if (answer.kind === 'answered' || answer.kind === 'refused') { values.light = 'lit'; values.state = 'ready' }
  if (answer.kind === 'unreachable') { values.light = 'dark'; values.refused = answer.words }
  put(values, 'entryPending', viewHolds(holds, AGENCY_GATEWAY_ID).entryPending)
  return values
}

export function agencyBinding(reading: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>, holds: ChainHolds): DesignBinding {
  return {
    id: AGENCY_GATEWAY_ID,
    values: agencyValues(reading, holds),
    standing: disabled(AGENCY_REFUSE),
    // A changed entry waits for Confirm (the view's own ask); Confirm itself has no carrier.
    local: {entryPending: value => holdView(AGENCY_GATEWAY_ID, 'entryPending', typeof value === 'string' ? value : undefined)},
    writes: key => key in AGENCY_REFUSE || key.startsWith('on:'),
    write: async changes => {
      for (const {key} of changes) {
        holdView(AGENCY_GATEWAY_ID, 'entryPending', undefined)
        throw Error(key.startsWith('on:') ? AGENCY_REFUSE.surfaces : AGENCY_REFUSE[key as keyof typeof AGENCY_REFUSE] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Experiment

const EXPERIMENT_OP = 'Actuation\'s matched comparison (research comparison.rs run_with) through the kernel'
/** Every statement and reading the Experiment asks the owner to write (actuation__experiment.tsx:13-19). */
export const EXPERIMENT_WRITES: readonly string[] = ['question', 'task', 'variable', 'levels', 'agents', 'repeats', 'stop', 'capTurns', 'capTime',
  'readTokens', 'readTime', 'readCalls', 'readTests', 'readSpend', 'readStalls', 'beat', 'compare', 'fork']
export const EXPERIMENT_REFUSE = missing('The Experiment', EXPERIMENT_OP, 'Actuation')

/** The Experiment's values: no kernel op reaches its owner, so its declaration, runs and state are all absent; the reading the picture
 * draws (`plot`) is the view's own. */
export function experimentValues(holds: ChainHolds): Values {
  const values: Record<string, Value> = {}
  put(values, 'plot', viewHolds(holds, EXPERIMENT_ID).plot)
  return values
}

export function experimentBinding(holds: ChainHolds): DesignBinding {
  return {
    id: EXPERIMENT_ID,
    values: experimentValues(holds),
    standing: disabled(Object.fromEntries(EXPERIMENT_WRITES.map(key => [key, EXPERIMENT_REFUSE]))),
    local: {plot: value => holdView(EXPERIMENT_ID, 'plot', typeof value === 'string' ? value : undefined)},
    writes: key => EXPERIMENT_WRITES.includes(key),
    write: async changes => { for (const {key} of changes) throw Error(EXPERIMENT_WRITES.includes(key) ? EXPERIMENT_REFUSE : `${key} is a reading.`) },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Frames monitor

/** The monitor's own settings and the shell's starting value of each (§19.5: All sessions, Both, every kind, Follow on, Pause off,
 * Keep 1000). The shell holds them; nothing here is written to the harness. */
export const FRAMES_VIEW: Readonly<Record<string, Value>> = {
  session: 'all', direction: 'both', kinds: 'messages,tools,heartbeat,approvals,errors', follow: true, pause: false, keep: 1000,
}

/** The monitor's values: the Gateway's own readings under the Gateway's own names (actuation__frames-monitor.tsx:8-13 — one reading,
 * the same as the Gateway device's: designBindings.ts gatewayValues), the view's settings, and no frames: no kernel op reads the
 * gateway's frame ring. */
export function framesValues(gateway: GatewayInput, holds: ChainHolds): Values {
  const view = viewHolds(holds, FRAMES_ID)
  const values: Record<string, Value> = {...gatewayValues(gateway)}
  for (const [key, value] of Object.entries(FRAMES_VIEW)) values[key] = view[key] ?? value
  return values
}

/** The monitor only reads (§19.5 "It sends nothing and changes no frame"): no write; its settings are the view's own. */
export function framesBinding(gateway: GatewayInput, holds: ChainHolds): DesignBinding {
  const hold = (key: string) => (value: Value | undefined) => holdView(FRAMES_ID, key, value)
  return {
    id: FRAMES_ID,
    values: framesValues(gateway, holds),
    local: Object.fromEntries(Object.keys(FRAMES_VIEW).map(key => [key, hold(key)])),
  }
}
