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
 * the owners' Actions the kernel's `act` runs (the gateway's, Workcell's
 * landing Actions for the git seat), the shell's own setters for armed
 * controls. A row without a
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
/** A session's settings and its bound task's: AIKit's Action `aikit.session.settings` (O-I 1006). */
const SESSION_SETTINGS_ACTION = 'act:aikit.session.settings'

/** What owns each setting a binding's conversation does not carry, in AIKit's words (aikit-cli gateway_ops.rs OWNED_ELSEWHERE, O-I 1006):
 * `aikit gateway agent` refuses each with its owner, so no row writes it through the conversation. */
const OWNED_ELSEWHERE = {
  transport: 'A binding\'s conversation has no transport of its own: the transport is the whole gateway\'s, its entry mode, chosen by `aikit gateway setup` (AIKit).',
  approvals: 'A harness\'s approvals are its own and read only: the session\'s answer to its requests to use a tool is its task\'s Tool calls, which AIKit\'s Action aikit.session.settings writes (Scope\'s Tool calls).',
  'stall-after': 'No AIKit operation holds a stall-after: AIKit keeps no time without progress after which a session counts as stalled.',
  input: 'Input goes with each Communique, not with the conversation: AIKit\'s Action aikit.gateway.send takes it as `handling`, queue or steer; the window\'s words reach the agent through its encounter\'s one send, which takes none.',
} as const

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
  // REPLACED (O-I 1006): Transport, Approvals and Stall after wrote through aikit.gateway.agent, which has no operation for them; AIKit names
  // what owns each, and they are readings here.
  enumed('actuation', 'gateway', 'transport', ['stdio', 'ws', 'remote'], undefined, OWNED_ELSEWHERE.transport),
  enumed('actuation', 'gateway', 'approvals', ['ask', 'session', 'always'], undefined, OWNED_ELSEWHERE.approvals),
  agentParamAddress({family: 'actuation', deviceInstance: 'gateway', key: 'stall-after', type: 'duration', disclosure: OWNED_ELSEWHERE['stall-after']}),
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
  // Test: the session's own Repeat over Skillset, set by AIKit's Action aikit.session.settings (O-I 1006; REPLACED: kernel:encounter_session_settings).
  agentParamAddress({family: 'ai-kit', deviceInstance: 'skillset', key: 'refine.run', type: 'boolean', writePath: SESSION_SETTINGS_ACTION}),
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

  // — Git / landing (workcell): readings from the seat; Land lands the held seat through Workcell's own Actions (O-I 1006) —
  reading('workcell', 'git', 'branch', 'string'),
  reading('workcell', 'git', 'uncommitted', 'number', {unit: 'files'}),
  reading('workcell', 'git', 'ahead', 'number', {unit: 'commits'}),
  reading('workcell', 'git', 'behind', 'number', {unit: 'commits'}),
  enumed('workcell', 'git', 'commit-policy', ['per turn', 'per task', 'manual'], undefined,
    'No owner commits on a cadence (per turn or per task): Land commits the seat\'s work first, through Workcell\'s workcell.lane.commit.'),
  enumed('workcell', 'git', 'push-policy', ['off', 'on land'], undefined,
    'The hand\'s: Land waits while Push is Off; On land, Land pushes the lane to the project\'s remote (Workcell\'s workcell.lane.push) before it lands it.'),
  enumed('workcell', 'git', 'landAs', ['draft', 'mr', 'merge'], undefined, 'The hand\'s: how Land lands the lane (workcell.lane.land `as`).'),
  agentParamAddress({family: 'workcell', deviceInstance: 'git', key: 'land', type: 'boolean', writePath: 'act:workcell.lane.land',
    disclosure: 'Land runs Workcell\'s own Actions on the held seat, in order: workcell.lane.commit where the work has no commit, workcell.lane.push, then workcell.lane.land as Land as says. It waits while Push is Off.'}),
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
/** A session's own settings in AIKit as the World Model's scope slice holds them (world_model.rs `scope`: your world's root register's
 * sessions under `settings`, a project's under `projects`), each written by AIKit's Action aikit.session.settings (O-I 1006). */
const SETTINGS: ModelField = 'scope:settings'
const SESSION_SETTINGS = {action: 'aikit.session.settings'} as const

/** The four devices of a session's chain (§16.2 Factory: Gateway → Agent (model, effort) → Scope → Git / landing). */
export const CHAIN_DECLARATIONS: readonly ChainDeviceDeclaration[] = Object.freeze<ChainDeviceDeclaration[]>([
  {
    device: 'gateway', face: 'actuation:gateway', slice: 'sessions',
    fields: {binding: `${GATEWAY}.binding`, readiness: `${HARNESS}.state`, transport: `${HARNESS}.transport`, approvals: `${HARNESS}.approvals`,
      connect: `${HARNESS}.connect`, frames: `${GATEWAY}.ecology`},
    unheld: {'stall-after': 'AIKit\'s harness reading names no stall-after.', spend: 'spend_ledger has no writer in O-I — the meter discloses absence.'},
    // AIKit's gateway takes pause and resume for Connect. The others are not the conversation's: AIKit names what owns each (O-I 1006;
    // aikitGatewayOps.ts harnessKeyUncarried), and the harness's approvals are its own reading — Scope's Tool calls is the session's answer.
    controls: {transport: {none: OWNED_ELSEWHERE.transport}, approvals: {none: OWNED_ELSEWHERE.approvals}, 'stall-after': {none: OWNED_ELSEWHERE['stall-after']},
      connect: GATEWAY_AGENT},
  },
  {
    device: 'agent', face: 'actuation:harness-model', slice: 'sessions',
    // The Harness chooser offers the census's agents that start (O-I ticket 1003), the Model chooser the catalogue's models.
    // Effort is the level the session's task starts at, its Effort envelope as AIKit holds it in the session's settings (the scope slice).
    fields: {harness: `${GATEWAY}.binding`, model: `${HARNESS}.model`, harnesses: 'agents:agents', models: 'models:entries', effort: SETTINGS},
    unheld: {
      'budget-used': 'AIKit\'s task record of the session (encounter_task_read): the World Model holds no session\'s task record yet.',
      held: 'Factory\'s custody list of the session (factory development custody), drawn on the Agent\'s Run page.',
      identity: 'Central\'s roster (agent-profile.roster), read with the Skillset rack.',
      input: OWNED_ELSEWHERE.input,
      heartbeat: 'Heartbeat is presentation-state: its owner is the cron-stratum cadence (WO-A3).',
    },
    // Effort is the session's task's, by AIKit's Action aikit.session.settings (`task.set.effort`, one level for the whole task); Input is
    // each Communique's, which no window's send carries (O-I 1006).
    controls: {model: GATEWAY_AGENT, effort: SESSION_SETTINGS, input: {none: OWNED_ELSEWHERE.input},
      heartbeat: {none: 'Heartbeat is presentation-state: its owner is the cron-stratum cadence (WO-A3), which declares no Action.'}},
  },
  {
    device: 'world', face: 'software-factory:context-write-mode', slice: 'sessions',
    // Tool calls, Wait and On no answer are the session's settings in AIKit (its task's Tool calls envelope; where the task inherits it,
    // the harness's approvals stand); Calls to other agents are AIKit's rule for the sender kind agent, as its ecology reads it.
    fields: {'tool-calls': SETTINGS, wait: SETTINGS, 'on-no-answer': SETTINGS, calls: `${GATEWAY}.ecology`},
    unheld: {
      reads: 'Central declares no scope reading of a session yet.', writes: 'Central declares no scope reading of a session yet.',
      'knowledge-route': 'protocol_read is available but unwired — the route discloses absence.',
      'write-mode': 'Write arm is presentation-state: its owner is Factory receiving\'s enforcement (WO-SF2).',
      'write-receipts': 'Factory receiving\'s receipts of the device apply path (WO-SF2) are not written yet.',
    },
    // AIKit's Actions (O-I 1006): the session's settings for Tool calls (`task.set.tool_calls`), Wait and On no answer (`track`), and the
    // ingress rule for the sender kind agent on each of the session's bindings for Calls to other agents.
    controls: {
      'tool-calls': SESSION_SETTINGS,
      'write-mode': {none: 'Write arm is presentation-state: Factory receiving\'s enforcement on the device apply path (WO-SF2) declares no Action yet.'},
      calls: {action: 'aikit.gateway.ingress'},
      wait: SESSION_SETTINGS,
      'on-no-answer': SESSION_SETTINGS,
    },
  },
  {
    device: 'git', face: 'workcell:git-seat', slice: 'workcells',
    // The workcell's seat of the session's project: its live branch, its files with no commit (tracked changes and untracked files), and
    // its commits against main.
    fields: {branch: 'workcells:seats.reading', uncommitted: 'workcells:seats.reading', ahead: 'workcells:seats.reading',
      behind: 'workcells:seats.reading', workcell: 'workcells:workcells.reading.workcell_ref'},
    unheld: {
      'push-policy': 'Push is the hand\'s setting: Land waits while it is Off. No owner holds it, so the World Model holds none.',
      landAs: 'Land as is the hand\'s setting: how Land lands the lane (workcell.lane.land `as`). No owner holds it, so the World Model holds none.',
    },
    // Land is Workcell's landing Actions on the held seat: the work committed (workcell.lane.commit), the lane pushed
    // (workcell.lane.push), then landed (workcell.lane.land) as Land as says (workcellBindings.ts landSteps). Push and Land as are the
    // hand's settings (unheld), which no owner holds; Land waits while Push is Off.
    controls: {
      'commit-policy': {none: 'Commit policy: no owner commits on a cadence (per turn or per task); Land commits the seat\'s work first (workcell.lane.commit).'},
      land: {action: 'workcell.lane.land'},
    },
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
