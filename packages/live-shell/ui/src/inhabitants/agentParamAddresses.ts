import type {FamilyManifestId} from './familyManifest.ts'

/** Agent-shell parameter addresses (WORLD-SHELL-DESIGN §14).
 *
 * One visible device face may combine parameters from several families; every
 * parameter carries exactly ONE owning address {family, deviceInstance, key,
 * type, values/range/unit, writePath}. The owning family per row is the
 * verified ownership map (AGENT-DEVICE-OWNERSHIP.md, 8 October 2026), not a
 * convenience: the split agent face addresses effort to actuation, autonomy
 * to software-factory and identity to central on one visible face.
 *
 * writePath is present ONLY where a real owner write exists in the tree —
 * the kernel harness control for the gateway, the shell's own setters for
 * armed controls, the workcell-cli ops for the git seat. A row without a
 * writePath is a READING or a declared scope, never a silent fake control;
 * rows whose source is absent carry their disclosure verbatim.
 *
 * Pure: no view, no store, no I/O. */

export interface AgentParamAddress {
  /** The one owning family. */
  readonly family: FamilyManifestId
  /** The chain device instance the control renders on. */
  readonly deviceInstance: string
  /** The admitted key of the value inside the device grammar. */
  readonly key: string
  readonly type: string
  /** Enumeration values, when the source declares them. */
  readonly values?: readonly string[]
  /** Declared numeric range, when the source states one. */
  readonly range?: {readonly min?: number; readonly max?: number}
  readonly unit?: string
  /** The path the owner writes. Absent = no writer exists; the row is a reading. */
  readonly writePath?: string
  /** Verbatim disclosed absence, when the source itself is missing. */
  readonly disclosure?: string
}

const KERNEL_HARNESS_CONTROL = 'kernel:harness_agent_control'

function agentParamAddress(address: AgentParamAddress): AgentParamAddress {
  return Object.freeze({...address})
}

const enumed = (
  family: FamilyManifestId,
  deviceInstance: string,
  key: string,
  values: readonly string[],
  writePath?: string,
  disclosure?: string,
): AgentParamAddress =>
  agentParamAddress({family, deviceInstance, key, type: 'enumerated', values, ...(writePath ? {writePath} : {}), ...(disclosure ? {disclosure} : {})})

const reading = (
  family: FamilyManifestId,
  deviceInstance: string,
  key: string,
  type: string,
  extra?: {unit?: string; disclosure?: string},
): AgentParamAddress =>
  agentParamAddress({family, deviceInstance, key, type, ...(extra?.unit ? {unit: extra.unit} : {}), ...(extra?.disclosure ? {disclosure: extra.disclosure} : {})})

/** THE AGENT-SHELL ADDRESS TABLE — every control the agent devices render,
 * each with exactly one owning family. Chain order: gateway → agent →
 * skillset → world → git (AGENTIC-CONVERGENCE Rev 5). */
export const AGENT_SHELL_ADDRESS_TABLE: readonly AgentParamAddress[] = Object.freeze([
  // — Gateway device (actuation): harness connection, its answers verbatim —
  enumed('actuation', 'gateway', 'transport', ['stdio', 'ws', 'remote'], KERNEL_HARNESS_CONTROL),
  enumed('actuation', 'gateway', 'approvals', ['ask', 'session', 'always'], KERNEL_HARNESS_CONTROL),
  agentParamAddress({family: 'actuation', deviceInstance: 'gateway', key: 'stall-after', type: 'duration', writePath: KERNEL_HARNESS_CONTROL}),
  agentParamAddress({family: 'actuation', deviceInstance: 'gateway', key: 'connect', type: 'boolean', writePath: KERNEL_HARNESS_CONTROL}),
  reading('actuation', 'gateway', 'readiness', 'string', {disclosure: 'Readiness is a harness_status reading; nothing here writes it.'}),
  reading('actuation', 'gateway', 'frames', 'stream', {disclosure: 'Frames flow from the temporal adapters; the monitor is the Frames dock tile.'}),
  reading('actuation', 'gateway', 'spend', 'number', {unit: 'USD', disclosure: 'spend_ledger has no writer in O-I — the meter discloses absence.'}),

  // — Agent device, ONE face composed of three families (the §14 point) —
  reading('actuation', 'agent', 'model', 'string', {disclosure: 'No shell writer yet — the model arrives with harness disclosure.'}),
  enumed('actuation', 'agent', 'effort', ['low', 'medium', 'high', 'max'], 'shell.setEffort'),
  reading('actuation', 'agent', 'budget-used', 'number', {unit: 'turns', disclosure: 'Reading only — used/cap come from the session task.'}),
  enumed('actuation', 'agent', 'input', ['steer', 'queue'], 'shell.setSteer'),
  agentParamAddress({family: 'actuation', deviceInstance: 'agent', key: 'heartbeat', type: 'boolean', writePath: 'shell.setHeartbeat'}),
  enumed('software-factory', 'agent', 'autonomy', ['suggest', 'review', 'auto'], undefined, 'Custody is a reading here; writes ride review and hand-back.'),
  reading('central', 'agent', 'identity', 'string', {disclosure: 'Read-only from the kernel roster (agent-profile.roster); never a hardcoded crowd.'}),

  // — Skillset rack (ai-kit): admits are readings; macros have no live source —
  reading('ai-kit', 'skillset', 'thoroughness', 'enumerated'),
  reading('ai-kit', 'skillset', 'test-depth', 'enumerated'),
  reading('ai-kit', 'skillset', 'reach', 'enumerated'),
  reading('ai-kit', 'skillset', 'risk', 'enumerated'),

  // — Context-world device: central reads + ai-kit route + software-factory receipts —
  reading('central', 'world', 'reads', 'scope'),
  reading('central', 'world', 'writes', 'scope'),
  reading('ai-kit', 'world', 'knowledge-route', 'route', {disclosure: 'protocol_read is available but unwired — the route discloses absence.'}),
  enumed('software-factory', 'world', 'write-mode', ['propose', 'draft', 'direct'], 'shell.setWriteArm', 'The shell write arm carries propose·direct today; draft awaits its writer.'),
  reading('software-factory', 'world', 'write-receipts', 'receipts'),

  // — Git seat (workcell): readings from the seat, writes through workcell-cli —
  reading('workcell', 'git', 'branch', 'string'),
  reading('workcell', 'git', 'uncommitted', 'number', {unit: 'files'}),
  enumed('workcell', 'git', 'commit-policy', ['per turn', 'per task', 'manual'], 'workcell-cli:git commit'),
  enumed('workcell', 'git', 'push-policy', ['off', 'on land'], 'workcell-cli:git push'),
  agentParamAddress({family: 'workcell', deviceInstance: 'git', key: 'land', type: 'boolean', writePath: 'workcell-cli:seat land'}),
])

/** The addresses of one chain device, in table order. */
export function agentAddressesForDevice(deviceInstance: string): AgentParamAddress[] {
  return AGENT_SHELL_ADDRESS_TABLE.filter(row => row.deviceInstance === deviceInstance)
}

/** The one owning address of a key on a device, or undefined. */
export function agentAddress(deviceInstance: string, key: string): AgentParamAddress | undefined {
  return agentAddressesForDevice(deviceInstance).find(row => row.key === key)
}
