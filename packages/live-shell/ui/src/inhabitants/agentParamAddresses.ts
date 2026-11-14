import type {FamilyManifestId} from './familyManifest.ts'
import type {ModelSliceName} from '../../../../../desktop/cradle/src/kernel/types'

/** Agent-shell parameter addresses (WORLD-SHELL-DESIGN §14).
 *
 * One visible device face may combine parameters from several families; every
 * parameter carries exactly ONE owning address {family, deviceInstance, key,
 * type, values/range/unit, writePath}. The owning family per row is the
 * verified ownership map (AGENT-DEVICE-OWNERSHIP.md, 8 October 2026), not a
 * convenience: the split agent face addresses effort to actuation, what it
 * holds to software-factory and identity to central on one visible face.
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

/** A harness's conversation controls: AIKit's Action `aikit.gateway.agent` (`aikit gateway agent`), run by the kernel's `act` (O-I #1002). */
const HARNESS_AGENT_ACTION = 'act:aikit.gateway.agent'

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
 * skillset → world → git (agent-shell-mockup.html Rev 5; WORLD-SHELL-DESIGN §7.1). */
export const AGENT_SHELL_ADDRESS_TABLE: readonly AgentParamAddress[] = Object.freeze([
  // — Gateway device (actuation): harness connection, its answers verbatim —
  enumed('actuation', 'gateway', 'transport', ['stdio', 'ws', 'remote'], HARNESS_AGENT_ACTION),
  enumed('actuation', 'gateway', 'approvals', ['ask', 'session', 'always'], HARNESS_AGENT_ACTION),
  agentParamAddress({family: 'actuation', deviceInstance: 'gateway', key: 'stall-after', type: 'duration', writePath: HARNESS_AGENT_ACTION}),
  agentParamAddress({family: 'actuation', deviceInstance: 'gateway', key: 'connect', type: 'boolean', writePath: HARNESS_AGENT_ACTION}),
  reading('actuation', 'gateway', 'readiness', 'string', {disclosure: 'Readiness is AIKit\'s harness reading of the gateway\'s binding, which the World Model\'s sessions slice carries; nothing here writes it.'}),
  reading('actuation', 'gateway', 'frames', 'stream', {disclosure: 'Frames flow from the temporal adapters; the monitor is the Frames dock tile.'}),
  reading('actuation', 'gateway', 'spend', 'number', {unit: 'USD', disclosure: 'spend_ledger has no writer in O-I — the meter discloses absence.'}),

  // — Agent device, ONE face composed of three families (the §14 point) —
  // Model: AIKit's gateway selects the binding's harness model (`aikit gateway agent --binding B model --model ID`).
  agentParamAddress({family: 'actuation', deviceInstance: 'agent', key: 'model', type: 'string', writePath: HARNESS_AGENT_ACTION,
    disclosure: 'The binding\'s harness model, selected through AIKit\'s own operation: `aikit gateway agent --binding B model --model ID` (the registry\'s aikit.gateway.agent, operation model).'}),
  enumed('actuation', 'agent', 'effort', ['low', 'medium', 'high', 'max'], 'shell.setEffort'),
  reading('actuation', 'agent', 'budget-used', 'number', {unit: 'turns', disclosure: 'Reading only — used/cap come from the session task.'}),
  enumed('actuation', 'agent', 'input', ['steer', 'queue'], 'shell.setSteer'),
  agentParamAddress({family: 'actuation', deviceInstance: 'agent', key: 'heartbeat', type: 'boolean', writePath: 'shell.setHeartbeat'}),
  // Software Factory's share (DLW §19.4 "One agent, three owners": it owns what the agent holds). The Agent's Autonomy, which this row
  // once was, is retired (§19.4, §19.12): Scope's Tool calls on its Asks page answers the harness's request to use a tool.
  reading('software-factory', 'agent', 'held', 'list', {disclosure: 'Reading only — what the agent holds is Factory\'s custody list, drawn on the Agent\'s Run page.'}),
  reading('central', 'agent', 'identity', 'string', {disclosure: 'Read-only from the kernel roster (agent-profile.roster); never a hardcoded crowd.'}),

  // — Skillset rack (ai-kit): admits are readings; macros have no live source —
  reading('ai-kit', 'skillset', 'thoroughness', 'enumerated'),
  reading('ai-kit', 'skillset', 'test-depth', 'enumerated'),
  reading('ai-kit', 'skillset', 'reach', 'enumerated'),
  reading('ai-kit', 'skillset', 'risk', 'enumerated'),
  // Its Refining page (DLW §19.7 "Refining a skill"; skills.tsx `refine.` keys): AIKit's proposed revisions (`aikit source refine list`),
  // answered through AIKit's own verbs, and tested by the session's own Repeat over Skillset.
  reading('ai-kit', 'skillset', 'refine.member', 'string', {disclosure: 'The member chosen is the hand\'s own hold over AIKit\'s proposed revisions.'}),
  reading('ai-kit', 'skillset', 'refine.why', 'list', {disclosure: 'Reading only — the closes that show the reason, as AIKit keeps them with the proposal.'}),
  reading('ai-kit', 'skillset', 'refine.revision', 'string', {disclosure: 'Reading only — the proposed revision beside the revision in use.'}),
  reading('ai-kit', 'skillset', 'refine.test', 'list', {disclosure: 'Reading only — the takes AIKit\'s take body kept under the proposed revision, beside its Repeat\'s other takes.'}),
  reading('ai-kit', 'skillset', 'refine.result', 'list', {disclosure: 'Met · Not met · Open per condition and level: what each take answered to the task\'s Success conditions, held to its evidence by Actuation.'}),
  agentParamAddress({family: 'ai-kit', deviceInstance: 'skillset', key: 'refine.run', type: 'boolean', writePath: 'kernel:encounter_session_settings'}),
  // Accept (O-I 795 round 14): the person's one Accept of a Control skill's revision is Central's own act, which writes it at the digest
  // reviewed (control.skills.revision.accept through the kernel's invoke_action, on the person's authority); AIKit's verbs carry the
  // hand before it and the follow after it (aikit_write refinement-accept, refinement-follow). REPLACED: writePath kernel:aikit_write.
  agentParamAddress({family: 'central', deviceInstance: 'skillset', key: 'refine.accept', type: 'boolean', writePath: 'kernel:invoke_action',
    disclosure: 'Your Accept of a Control skill\'s revision is Central\'s act, control.skills.revision.accept: AIKit\'s Accept hands it there first '
      + '(aikit_write refinement-accept) and AIKit follows after it, syncing and promoting its source from Central (refinement-follow); a member '
      + 'AIKit keeps is kept by AIKit\'s own Accept (aikit_write refinement-accept).'}),
  agentParamAddress({family: 'ai-kit', deviceInstance: 'skillset', key: 'refine.discard', type: 'boolean', writePath: 'kernel:aikit_write'}),

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

// ---------------------------------------------------------------------------------------------------------------- the declarations

/** A field of the World Model: `<slice>:<path>`, the path dotted into the slice's value as the kernel holds it (world_model.rs). */
export type ModelField = `${ModelSliceName}:${string}`

/** What a control invokes: the registry's Action (`oi act`), or why none carries it. `kernelOp` names the kernel op that still writes it,
 * outside the registry, where one does (gates/foundation/lint.mjs counts the code that sends it until its owner declares the Action). */
export type ControlAction = {readonly action: string} | {readonly none: string; readonly kernelOp?: string}

/** One device of the Factory chain as a declaration (docs/architecture/world-shell.md §9.2.5; O-I ticket 1006): its face in its family's
 * manifest, which carries its kind and its Live meaning (manual §16); the World Model slice it reads; the field each parameter reads
 * there, or why the World Model holds none for it yet (`unheld`); and the Action each control invokes. The chain reads the slices its
 * declarations name and no owner (agent/devices/designBindings.ts chainFromModel). */
export interface ChainDeviceDeclaration {
  /** The address table's device (its rows' `deviceInstance`). */
  readonly device: string
  /** `${family}:${face}` in its family's manifest. */
  readonly face: string
  readonly slice: ModelSliceName
  readonly fields: Readonly<Record<string, ModelField>>
  readonly unheld: Readonly<Record<string, string>>
  readonly controls: Readonly<Record<string, ControlAction>>
}

/** AIKit's gateway as the sessions slice holds it (world_model.rs `gateway`): its ecology, its conversation binding, and that binding's
 * harness reading (`aikit gateway agent --binding B sessions`). */
const GATEWAY: ModelField = 'sessions:gateway.reading'
const HARNESS = `${GATEWAY}.agent.reading` as const
const GATEWAY_AGENT = {action: 'aikit.gateway.agent'} as const
const WORKCELL_NO_ACTION = (what: string): ControlAction => ({none: `${what}: Workcell declares no Action that carries it (its Actions write a seat's join and release, workcell.seat.join and workcell.seat.release), so it stands disabled.`})

/** The four devices of a session's chain (§16.2 Factory: Gateway → Agent (model, effort) → Scope → Git / landing). */
export const CHAIN_DECLARATIONS: readonly ChainDeviceDeclaration[] = Object.freeze<ChainDeviceDeclaration[]>([
  {
    device: 'gateway', face: 'actuation:gateway', slice: 'sessions',
    fields: {binding: `${GATEWAY}.binding`, readiness: `${HARNESS}.state`, transport: `${HARNESS}.transport`, approvals: `${HARNESS}.approvals`,
      connect: `${HARNESS}.connect`, frames: `${GATEWAY}.ecology`},
    unheld: {'stall-after': 'AIKit\'s harness reading names no stall-after.', spend: 'spend_ledger has no writer in O-I — the meter discloses absence.'},
    // AIKit's gateway takes pause and resume for Connect; for the others it has no operation, and the dispatch refuses them by name
    // before anything is sent (aikitGatewayOps.ts harnessKeyUncarried).
    controls: {transport: GATEWAY_AGENT, approvals: GATEWAY_AGENT, 'stall-after': GATEWAY_AGENT, connect: GATEWAY_AGENT},
  },
  {
    device: 'agent', face: 'actuation:harness-model', slice: 'sessions',
    // The Harness chooser offers the census's agents that start (O-I ticket 1003), the Model chooser the catalogue's models.
    fields: {harness: `${GATEWAY}.binding`, model: `${HARNESS}.model`, harnesses: 'agents:agents', models: 'models:entries'},
    unheld: {
      'budget-used': 'AIKit\'s task record of the session (encounter_task_read): the World Model holds no session\'s task record yet.',
      held: 'Factory\'s custody list of the session (factory development custody), drawn on the Agent\'s Run page.',
      identity: 'Central\'s roster (agent-profile.roster), read with the Skillset rack.',
      effort: 'No owner holds it: AIKit\'s gateway has no operation that carries it.', input: 'No owner holds it: AIKit\'s gateway has no operation that carries it.',
      heartbeat: 'Heartbeat is presentation-state: its owner is the cron-stratum cadence (WO-A3).',
    },
    // Effort and input go to AIKit's gateway, which refuses them by name (no operation carries them).
    controls: {model: GATEWAY_AGENT, effort: GATEWAY_AGENT, input: GATEWAY_AGENT,
      heartbeat: {none: 'Heartbeat is presentation-state: its owner is the cron-stratum cadence (WO-A3), which declares no Action.'}},
  },
  {
    device: 'world', face: 'software-factory:context-write-mode', slice: 'sessions',
    // Tool calls are the harness's approvals; Calls to other agents are AIKit's rule for the sender kind agent, as its ecology reads it.
    fields: {'tool-calls': `${HARNESS}.approvals`, calls: `${GATEWAY}.ecology`},
    unheld: {
      wait: 'AIKit\'s settings of the session (encounter_session_settings): the World Model holds no session\'s settings yet.',
      'on-no-answer': 'AIKit\'s settings of the session (encounter_session_settings): the World Model holds no session\'s settings yet.',
      reads: 'Central declares no scope reading of a session yet.', writes: 'Central declares no scope reading of a session yet.',
      'knowledge-route': 'protocol_read is available but unwired — the route discloses absence.',
      'write-mode': 'Write arm is presentation-state: its owner is Factory receiving\'s enforcement (WO-SF2).',
      'write-receipts': 'Factory receiving\'s receipts of the device apply path (WO-SF2) are not written yet.',
    },
    controls: {
      'tool-calls': GATEWAY_AGENT,
      'write-mode': {none: 'Write arm is presentation-state: Factory receiving\'s enforcement on the device apply path (WO-SF2) declares no Action yet.'},
      calls: {none: 'AIKit declares no Action for a gateway binding\'s ingress rule (its Actions: aikit.gateway.send, .agent, .delegate, .who and .heard).', kernelOp: 'harness_ingress_rule'},
      wait: {none: 'AIKit declares no Action for a session\'s settings.', kernelOp: 'encounter_session_settings'},
      'on-no-answer': {none: 'AIKit declares no Action for a session\'s settings.', kernelOp: 'encounter_session_settings'},
    },
  },
  {
    device: 'git', face: 'workcell:git-seat', slice: 'workcells',
    // The workcell's seat of the session's project: its live branch, and its files with no commit (tracked changes and untracked files).
    fields: {branch: 'workcells:seats.reading', uncommitted: 'workcells:seats.reading', workcell: 'workcells:workcells.reading.workcell_ref'},
    unheld: {},
    controls: {'commit-policy': WORKCELL_NO_ACTION('Commit policy'), 'push-policy': WORKCELL_NO_ACTION('Push policy'), land: WORKCELL_NO_ACTION('Land')},
  },
])

/** The declaration of one chain device, by the address table's device. */
export const chainDeclaration = (device: string): ChainDeviceDeclaration | undefined => CHAIN_DECLARATIONS.find(declared => declared.device === device)

/** The slices the chain's declared devices read, each once. */
export const CHAIN_SLICES: readonly ModelSliceName[] = Object.freeze([...new Set(CHAIN_DECLARATIONS.flatMap(declared =>
  [declared.slice, ...Object.values(declared.fields).map(field => field.slice(0, field.indexOf(':')) as ModelSliceName)]))])

/** A declared field's value in the slices held (each slice's value as `model_subscribe` answers it), or undefined where the path stands
 * on nothing. Pure. */
export function declaredValue(values: Readonly<Partial<Record<ModelSliceName, unknown>>>, field: ModelField): unknown {
  const at = field.indexOf(':')
  let value: unknown = values[field.slice(0, at) as ModelSliceName]
  for (const key of field.slice(at + 1).split('.')) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

/** The conversation binding AIKit's gateway names in the sessions slice's value (the Gateway's declared `binding`), or null where it names
 * none: until it does, 'cursor' is only the shell's default, and nothing is written to it. Pure. */
export function gatewayBindingIn(sessions: unknown): string | null {
  const named = declaredValue({sessions}, `${GATEWAY}.binding`)
  return typeof named === 'string' && named ? named : null
}

/** The addresses of one chain device, in table order. */
export function agentAddressesForDevice(deviceInstance: string): AgentParamAddress[] {
  return AGENT_SHELL_ADDRESS_TABLE.filter(row => row.deviceInstance === deviceInstance)
}

/** The one owning address of a key on a device, or undefined. */
export function agentAddress(deviceInstance: string, key: string): AgentParamAddress | undefined {
  return agentAddressesForDevice(deviceInstance).find(row => row.key === key)
}
