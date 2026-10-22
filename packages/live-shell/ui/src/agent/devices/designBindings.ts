// The agent chain's designed devices on their owners (lane BF): the Agent (actuation:harness-model, DLW §19.4), the Skillset rack
// (ai-kit:skillset-rack, §19.6), its member device (ai-kit:skill-device, §19.7) and Scope (software-factory:context-write-mode,
// §19.14). Each design's value keys are filled from the owners' readings and each change goes to the owner's own write — the
// binding the runtime hosts a design on (frame/devices/designed.ts DesignBinding; DEVICE-UI §8 "The shell brings the values, the
// writes, the navigation between views, and the standing of each parameter").
//
// The laws, in this module's terms:
//   • owners write, faces read: a key no owner reports is absent from `values` (the kit draws "—"); a key no owner writes is
//     refused, by name, with the owner and the missing operation (agentChainDrag.ts MISSING_OPS grammar);
//   • the designs' own `defaults` and `fixtures` are never passed as readings: nothing here imports them;
//   • some changes ask first (DEVICE-UI §5.2): what the hand holds before an owner is asked — a raised reach before Confirm, a
//     composition before Preview and Apply, a review before Trust, the composer's text — is held here, and nothing is sent until
//     the person confirms. The raised reach and the review ask are the view's own keys (DesignBinding.local): the runtime hands
//     each set of them — Cancel's drop included — to the hold at once, never to an owner.
//
// Pure, except the one hold store at the end (the shell's own state, never an owner reading).
import {useSyncExternalStore} from 'react'
import type {DesignBinding, DesignedDevice, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import type {DispatchReceipt} from '../../inhabitants/sdk/shellSetters'
import type {Form, Member, Rung} from '../../inhabitants/catalogue/panels/practice'
import type {ConfigRequestWire} from '../../../../../../desktop/cradle/src/kernel/types'
import {MISSING_OPS, missingOpRemedy} from '../agentChainDrag'
import {gatewayDisclosed, type AgentChainReading} from './agentChainDevices'
import type {OwnerAcceptedValues} from './ownerAccepted'
import type {TaskClip, TemporalEventLike} from '../agentRunModel'
import {runStateOfSession, stageRecordingOf, threadRowsFrom} from './runFaces'
import {armedOf, bypassesOf, contextPressureOf, contextTurnOf, historyOf, procedureDiffOf, proceduresOf, rootsOf, sourcesOf, unusedOf, whyOf, type AikitAnswer} from './aikitPages'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []

// ---------------------------------------------------------------------------------------------------------------- the designs

export const GATEWAY_DESIGN = 'actuation:gateway'
export const AGENT_DESIGN = 'actuation:harness-model'
export const RACK_DESIGN = 'ai-kit:skillset-rack'
export const MEMBER_DESIGN = 'ai-kit:skill-device'
export const SCOPE_DESIGN = 'software-factory:context-write-mode'
/** Git / landing, the chain's last device (DLW §19.16; its binding is workcellBindings.ts gitBinding, lane BF3). */
export const LANDING_DESIGN = 'workcell:git-seat'

/** The face of each chain slot the catalogue designs (agentDeviceCatalogue.ts CHAIN_SLOTS: one of the slot's admitted faces), so the
 * published device's `designKey(family, face.id)` is the design's id. The world slot's Scope is Software Factory's face (§19.14). */
export const SLOT_DESIGN_FACE: Readonly<Record<string, {family: string; faceId: string}>> = {
  gateway: {family: 'actuation', faceId: 'gateway'},
  agent: {family: 'actuation', faceId: 'harness-model'},
  skillset: {family: 'ai-kit', faceId: 'skillset-rack'},
  world: {family: 'software-factory', faceId: 'context-write-mode'},
  git: {family: 'workcell', faceId: 'git-seat'},
}

/** The member device: one chain inside the rack (§19.7), published under its own id. */
export const MEMBER_DEVICE_ID = 'factory:skillset:member'

/** The material a design must read from its values for its picture to be the owner's (catalogue/panels/design.ts:5-10, the
 * bindable contract: "Material the picture shows … is a value key — a JSON string for structured content"). A design that declares
 * none of these keys in its `defaults` would draw that material as if an owner had reported it, so its binding waits and the kit's
 * generic plate draws the owner's rows. Since the documentation lane's retrofits (3a97afb10 Scope, 4a6c051b9 the Agent, the rack and
 * the member) every chain design reads them from its values (actuation__harness-model.tsx:257, skills.tsx:86, member.tsx:170,
 * scope.tsx:89), so all five are hosted; the guard stays for a design that would draw its own list again. */
export const OWNER_LISTS: Readonly<Record<string, readonly string[]>> = {
  [GATEWAY_DESIGN]: ['frames'],
  [AGENT_DESIGN]: ['thread', 'models', 'harnesses'],
  [RACK_DESIGN]: ['members'],
  [MEMBER_DESIGN]: ['members'],
  [SCOPE_DESIGN]: ['reads', 'writes'],
  [LANDING_DESIGN]: ['commits', 'diff', 'checks'],
}

/** Why a design cannot be hosted on its owner yet (null: it can): not loaded, or it draws its own fixture where an owner list
 * belongs. */
export function designWaits(id: string, design: DesignedDevice | undefined): string | null {
  if (!design) return `${id} has not loaded; the generic plate draws its rows.`
  const missing = (OWNER_LISTS[id] ?? []).filter(key => !(key in design.defaults))
  return missing.length
    ? `${id} draws a list of its own where the owner's ${missing.join(' and ')} belong (its values declare no ${missing.join(', ')}); the generic plate draws the owner's rows until it reads them.`
    : null
}

/** The shell's one set of kind marks (agent/agentIcons.tsx:168 WOOD_SET; DEVICE-UI §8.2 "the whole shell uses it"). The person's
 * Settings choice between the blade and the pen has no holder yet; this is the set the shell draws, not an owner reading. */
export const SHELL_MARK_SET = 'blade'

// ---------------------------------------------------------------------------------------------------------------- refusals

/** A write no owner operation carries: refused in words that name the owner and the operation it lacks. */
const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`

const REFUSE = {
  power: 'Power is a reading: the harness reports whether the agent is on; Actuation exposes no Power write.',
  budget: 'Budget is a reading here: used and cap come from the session\'s task record (encounter_task_read); Actuation exposes no budget write.',
  reading: (key: string) => `${key} is a reading: its owner reports it; nothing here changes it.`,
  set: `The set on the chain: ${missingOpRemedy('skillset')} — missing op: ${MISSING_OPS.skillset}.`,
  // Lane W3 routes AIKit's store writes (desktop/cradle/kernel/src/owner_routes.rs AikitWrite; ownerRoutes.ts aikitWriteOp). Export's
  // `aikit set package export SET --target T --out DIR` writes into an absolute directory the desk names, and the rack has no field naming
  // one; Run's `aikit praxis method run REF --input JSON` takes the Method's exact input and Prove's `aikit praxis method prove --method REF
  // --proof-json J` the run's proof, and the member carries neither. Trust writes (memberBinding, MemberPorts.trust).
  export: missing('Export', 'the directory the package is written into (`aikit set package export <set> --target <t> --out <dir>` through the kernel\'s aikit_write takes an absolute --out, and the rack has no field naming one; the owner\'s own default, ./<package>-<target>, is relative to a working directory the kernel does not choose)', 'AIKit'),
  trust: 'Trust: the kernel carrier is unavailable here, so AIKit cannot be asked (`aikit trust record <capability>` through the kernel\'s aikit_write).',
  run: missing('Run', 'the exact JSON input `aikit praxis method run <ref> --input` takes (the kernel\'s aikit_write method-run carries it; the member has no field for it)', 'AIKit'),
  prove: missing('Prove', 'the run\'s proof `aikit praxis method prove --method <ref> --proof-json` takes (its Activity, Return, Evidence and verification refs; the member holds no run receipt)', 'AIKit'),
  reach: missing('Reach', 'the scope reach write on the world device\'s apply path (WO-SF2)', 'Software Factory'),
  knowledge: 'Knowledge: set on the Knowledge route inside this Scope (§19.9), whose lenses wait on a lens-level request on the AgentProfile (knowledgeRouteBinding.ts).',
  place: missing('A place in reach', 'the scope places write (WO-SF2)', 'Software Factory'),
  scope: 'Choose where the composition applies — Home, Project or Session — then Preview.',
  noPlan: 'Nothing is previewed: press Preview, read the change, then Apply.',
  noKernel: 'The configuration plane is not reachable here: the kernel transport is unavailable.',
  heartbeat: missing('Heartbeat', 'the cron-stratum heartbeat cadence (WO-A3)', 'Actuation'),
  writeMode: missing('Write mode', 'write-arm enforcement on the device apply path (WO-SF2)', 'Software Factory'),
}

/** The writes a design's controls ask for that no owner carries, each with the owner's missing operation: the host draws each
 * control disabled with its reason (DesignBinding.standing; DEVICE-UI §6 "disabled"), so nothing is pressed only to be refused. */
const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))

/** The Agent's Context page (lanes W7, W8; D5, actuation__harness-model.tsx `ctx.pressure`, `ctx.armed`, `ctx.turn`): AIKit's continuity,
 * read through the kernel's aikit_read {continuity-pressure, continuity-commands} (aikitPages.ts) where the chain hands them in; the last
 * turn's bounded blocks no command reports (T-COVERAGE §1.5, AIKit: "a read of the last turn's bounded blocks (Context)"). Why each is
 * absent when it is. */
export const AGENT_CONTEXT_ABSENT: Readonly<Record<string, string>> = {
  'ctx.pressure': 'The context pressure: AIKit\'s continuity is not read here (`aikit work continuity pressure` through the kernel\'s aikit_read).',
  'ctx.armed': 'The star commands armed: AIKit\'s continuity is not read here (`aikit work continuity commands` through the kernel\'s aikit_read).',
  'ctx.turn': 'The last turn\'s bounded blocks: AIKit\'s continuity is not read here (`aikit work continuity turn` through the kernel\'s aikit_read).',
}

/** Each chain design's refused writes, by key (the refusals its binding's write gives, below). The Agent's light is among them since
 * the kit's activator says why it only reads (inhabitants/sdk/panel.tsx Panel `lightWhy`, c5afc4aa0): the design stands its activator
 * disabled on the light's standing (actuation__harness-model.tsx head: `st(p, 'light').disabled`), so nothing is pressed only to be
 * refused. */
export const REFUSED_WRITES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  [AGENT_DESIGN]: {light: REFUSE.power, cap: REFUSE.budget, heartbeat: REFUSE.heartbeat},
  [RACK_DESIGN]: {set: REFUSE.set, exported: REFUSE.export},
  [MEMBER_DESIGN]: {reviewed: REFUSE.trust, run: REFUSE.run, proved: REFUSE.prove},
  [SCOPE_DESIGN]: {reach: REFUSE.reach, writeMode: REFUSE.writeMode, knowledge: REFUSE.knowledge},
}

// ---------------------------------------------------------------------------------------------------------------- the hold store
// What the hand holds before an owner is asked. One store for the chain, so the chain, the pool, the pane and the rail draw the
// same hold. Nothing here is an owner reading; each hold ends when the owner answers the act it waits for.

export type ComposeScope = 'home' | 'project' | 'session'
export interface ComposePlan {readonly changeset: unknown; readonly plans: readonly unknown[]}

export interface ChainHolds {
  /** The composer's text, and the last line an owner accepted from it (the shell's record of what it sent). */
  readonly composer: {readonly draft?: string; readonly sent?: string}
  /** The composition before Apply: your requests by member, the scope and profile it applies under, and the owner's plan once
   * previewed (§19.6 "A change applies only after Preview and Apply"). */
  readonly compose: {
    readonly requests: Readonly<Record<string, boolean>>
    readonly scope?: ComposeScope
    readonly profile?: string
    readonly target?: string
    readonly plan?: ComposePlan
  }
  /** A raised reach waiting for Confirm (DEVICE-UI §5.2). */
  readonly reachPending?: number
  /** The member device's asks: a review before Trust, a run after its preflight. */
  readonly member: {readonly reviewAsk?: boolean; readonly run?: 'asked'}
  /** Each device's view-held keys, by device id (DesignBinding.local): what the person chose of a device's own view — the Thread's
   * pin and filters, the rack's chosen chain, the Frames monitor's filters — never an owner reading and never sent to one. */
  readonly views: Readonly<Record<string, Readonly<Record<string, Value>>>>
}

const EMPTY: ChainHolds = Object.freeze({composer: {}, compose: {requests: {}}, member: {}, views: {}})
let holds: ChainHolds = EMPTY
const listeners = new Set<() => void>()

export const chainHolds = (): ChainHolds => holds
export function updateHolds(change: (was: ChainHolds) => ChainHolds): void {
  const next = change(holds)
  if (next === holds) return
  holds = next
  for (const listener of [...listeners]) listener()
}
export function subscribeHolds(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function resetHolds(): void { updateHolds(() => EMPTY) }
/** Set (or drop, with undefined) one view-held key of one device. */
export function holdView(id: string, key: string, value: Value | undefined): void {
  updateHolds(was => {
    const view = was.views[id] ?? {}
    if (view[key] === value || (value === undefined && !(key in view))) return was
    const next: Record<string, Value> = {...view}
    if (value === undefined) delete next[key]; else next[key] = value
    return {...was, views: {...was.views, [id]: next}}
  })
}
/** One device's view-held keys. */
export const viewHolds = (held: ChainHolds, id: string): Readonly<Record<string, Value>> => held.views[id] ?? {}
export function useChainHolds(): ChainHolds {
  return useSyncExternalStore(subscribeHolds, chainHolds, chainHolds)
}

const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

// ---------------------------------------------------------------------------------------------------------------- the Gateway

export interface GatewayInput {
  readonly reading: Pick<AgentChainReading, 'gateway' | 'gatewayAdmitted' | 'gatewayDoc'>
  readonly harness: {readonly binding: string; readonly resolved: boolean}
}

/** The Gateway's values (§19.1; catalogue/panels/actuation__gateway.tsx:6-13 names its keys): what the harness_agent_read answer
 * discloses under the carrier's own field names (agentChainDevices.ts gatewayDisclosed — readiness, transport, approvals, connect;
 * stall_after_seconds), the light from whether the gateway answered, and its refusal in the owner's words. The session counters
 * (epoch, seq, peers, beatAge, inflight, running, ring, ringCap, frames, viaLead) and autoContinue and fanOut are not in any
 * document the shell has read — the gateway was unreachable on this machine (16 Oct: cli.gateway_unreachable) — so they stay
 * absent until its document is read and their fields named. */
export function gatewayValues(input: GatewayInput): Values {
  const {reading, harness} = input
  const values: Record<string, Value> = {}
  put(values, 'light', reading.gatewayAdmitted === true ? 'lit' : reading.gatewayAdmitted === false ? 'dark' : undefined)
  if (harness.resolved) put(values, 'harness', harness.binding)
  if (reading.gateway.kind === 'refused') put(values, 'refused', reading.gateway.line)
  for (const [key, value] of Object.entries(gatewayDisclosed(reading.gatewayDoc))) put(values, key, value)
  const doc = isObj(reading.gatewayDoc) && !('refused' in reading.gatewayDoc) ? reading.gatewayDoc : null
  if (doc && typeof doc.stall_after_seconds === 'number') put(values, 'stallAfter', doc.stall_after_seconds)
  return values
}

/** The Gateway's rows with a write: the address table's (agentParamAddresses.ts:70-73), each to kernel:harness_agent_control. */
export interface GatewayRows {
  readonly transport?: SdkParamRow
  readonly approvals?: SdkParamRow
  readonly connect?: SdkParamRow
  readonly stallAfter?: SdkParamRow
}

const GATEWAY_KEYS: Readonly<Record<string, keyof GatewayRows>> = {transport: 'transport', approvals: 'approvals', connect: 'connect', stallAfter: 'stallAfter'}

// The Gateway's link readings (lane W10, from builder A's environ work; actuation__gateway.tsx `beatAge`, `running`, `inflight`, `frames`):
// the reading gatewayValues takes is the kernel's harness_agent_read, which runs `aikit --json gateway agent --binding B sessions`, and
// AIKit answers {agent_session_ref, harness, sessions [{agent_session_ref, state}]} (aikit-adapters gateway_conversation_engine.rs
// sessions). It names no check-in instant, no turn count, no frames in flight and no frames, so none of the four is carried: each stands
// absent with that reason, and stands as a reading the day the document names it.
const GATEWAY_DOCUMENT = 'the gateway\'s document (the kernel\'s harness_agent_read: `aikit gateway agent --binding B sessions`, which answers the binding\'s agent session, its harness and its native sessions with their state)'
export const GATEWAY_ABSENT: Readonly<Record<string, string>> = {
  beatAge: `The time since the last check-in: no reading reaches it yet — missing op: a check-in instant in ${GATEWAY_DOCUMENT} (AIKit).`,
  running: `The turns running: no reading reaches them yet — missing op: a count of running turns in ${GATEWAY_DOCUMENT}; a native session's state is not a turn (AIKit).`,
  inflight: `The frames in flight: no reading reaches them yet — missing op: a count of frames in flight in ${GATEWAY_DOCUMENT} (AIKit).`,
  frames: `The gateway's frames: no reading reaches them yet — missing op: the binding's latest frames in ${GATEWAY_DOCUMENT}; the Agency gateway's own journal (\`aikit gateway replay\`) is the Frames monitor's reading (AIKit).`,
}

/** The Gateway's binding: each setting through its row's own write path (the harness control's value carrier); the two the carrier
 * does not carry are refused by name; the link readings its document does not name stand absent with why. */
export function gatewayBinding(id: string, input: GatewayInput, rows: GatewayRows, write: RowWrite): DesignBinding {
  const values = gatewayValues(input)
  return {
    id,
    values,
    standing: Object.fromEntries(Object.entries(GATEWAY_ABSENT).filter(([key]) => !(key in values)).map(([key, why]) => [key, {disabled: why}])),
    writes: key => key in GATEWAY_KEYS || key === 'autoContinue' || key === 'fanOut',
    write: async changes => {
      for (const {key, value} of changes) {
        const rowKey = GATEWAY_KEYS[key]
        if (rowKey) {
          const row = rows[rowKey]
          if (!row?.writePath) throw Error(`${key}: the row is not adopted on this chain, so nothing carries it.`)
          const receipt = await write(row, value)
          if (receipt.kind === 'refused') throw Error(receipt.reason)
          continue
        }
        if (key === 'autoContinue') throw Error(missing('Auto-continue', 'kernel:harness_agent_control configure {auto_continue}', 'Actuation'))
        if (key === 'fanOut') throw Error(missing('Fan-out', 'kernel:harness_agent_control configure {fan_out}', 'Actuation'))
        throw Error(REFUSE.reading(key))
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Agent

/** The selected session as the agency reading builds it (agent/agentRunModel.ts AgentSessionTrack). */
export interface AgentTrackReading {
  readonly agentRef: string | null
  readonly agentName: string | null
  readonly needle: {readonly atUnixMs: number | null; readonly state?: 'live' | 'stalled' | 'idle'} | null
  readonly budget: {readonly used: number | null; readonly max: number | null}
  /** The session's task clips (agentRunModel.ts TaskClip), whose state stands the agent in its run state (runFaces.ts). */
  readonly tasks?: readonly TaskClip[]
  /** The SessionSpace the session stands in, whose events are its run where the session's own name none. */
  readonly spaceRef?: string
}

export interface AgentInput {
  readonly sessionRef: string | null
  /** The selected session's track (agency_read + roster + temporal events), null when none is selected or read. */
  readonly track: AgentTrackReading | null
  /** The reading instant the tracks were built at (AgentSessionsProvider nowUnixMs), never a later clock. */
  readonly nowUnixMs: number
  readonly reading: Pick<AgentChainReading, 'attached' | 'budget' | 'autonomy' | 'gatewayAdmitted' | 'gatewayDoc'>
  readonly accepted: OwnerAcceptedValues
  /** The harness the gateway binding names, and whether its owner named it (useHarnessBinding: until it has, the binding is only
   * the shell's default and is no reading). */
  readonly harness: {readonly binding: string; readonly resolved: boolean}
  readonly holds: ChainHolds
  /** The session's thread as rows (threadBinding.ts threadRowsOf over AIKit's encounter view — the reading the thread pane draws),
   * JSON; absent while unread. The Thread device reads the same rows (one binding feeds both). */
  readonly thread?: string
  /** The models AIKit's catalogue names (`aikit model-catalogue show --json` entries[].model, kernel model_catalogue). */
  readonly models?: readonly string[] | null
  /** The harnesses found on this machine (`aikit --json client status` clients[] detected, kernel harness_status). */
  readonly harnesses?: readonly string[] | null
  /** The kernel's temporal events (the sessions provider's one read): the session's run as the stage plays it. */
  readonly events?: readonly TemporalEventLike[] | null
  /** AIKit's continuity for the Context page (aikitPages.ts): `aikit work continuity pressure` and `commands`; absent: not read here. */
  readonly context?: {readonly pressure: AikitAnswer; readonly commands: AikitAnswer; readonly turn?: AikitAnswer}
  /** Actuation's usage records of the selected session (`actuation usage list --session S`, the kernel's actuation_read {usage-list}; lane
   * K0): the model the session last reported using, where the gateway names none. Absent: not read here. */
  readonly usage?: AikitAnswer
}

/** The model the session last reported using: the newest usage record's `usage.model.name` that Actuation lists for it
 * (actuation.usage-listing/v1, records in stream order), where a record names one. Pure. */
export function lastUsageModelOf(listing: unknown): string | undefined {
  if (!isObj(listing) || listing.schema !== 'actuation.usage-listing/v1' || !Array.isArray(listing.records)) return undefined
  for (const record of [...listing.records].reverse()) {
    const model = isObj(record) && isObj(record.usage) && isObj(record.usage.model) ? record.usage.model : null
    if (model && typeof model.name === 'string' && model.name) return model.name
  }
  return undefined
}

/** The Agent's values: each key from the owner that reports it, or absent. */
/** Why each Context key the values lack is absent: AIKit's refusal, its silence, or no reading handed in; the last turn always. */
function contextStanding(context: AgentInput['context'], values: Values): Record<string, string> {
  const why = (answer: AikitAnswer | undefined, key: string) => (answer?.status === 'refused' ? answer.error ?? AGENT_CONTEXT_ABSENT[key]!
    : answer?.status === 'reading' ? 'AIKit has not answered its continuity yet (`aikit work continuity`).' : answer ? `\`aikit work continuity\` answered no ${key === 'ctx.armed' ? 'armed list' : 'brackets'}.` : AGENT_CONTEXT_ABSENT[key]!)
  const turn = context?.turn?.status === 'answered' ? contextTurnOf(context.turn.value) : null
  const turnWhy = turn && !turn.kept ? `The last turn's bounded blocks: AIKit kept no turn for ${turn.scope ?? 'this scope'} (\`aikit work continuity turn\` answered turn: null — nothing is kept until a turn's hook output is).`
    : context?.turn?.status === 'refused' ? context.turn.error ?? AGENT_CONTEXT_ABSENT['ctx.turn']!
      : context?.turn?.status === 'reading' ? 'AIKit has not answered its continuity turn yet (`aikit work continuity turn`).'
        : context?.turn ? '`aikit work continuity turn` answered something other than its turn reading.' : AGENT_CONTEXT_ABSENT['ctx.turn']!
  return {...('ctx.turn' in values ? {} : {'ctx.turn': turnWhy}), ...('ctx.pressure' in values ? {} : {'ctx.pressure': why(context?.pressure, 'ctx.pressure')}),
    ...('ctx.armed' in values ? {} : {'ctx.armed': why(context?.commands, 'ctx.armed')})}
}

export function agentValues(input: AgentInput): Values {
  const values = agentOwnValues(input)
  const pressure = input.context?.pressure.status === 'answered' ? contextPressureOf(input.context.pressure.value) : null
  if (pressure) values['ctx.pressure'] = JSON.stringify(pressure)
  const armed = input.context?.commands.status === 'answered' ? armedOf(input.context.commands.value) : null
  if (armed) values['ctx.armed'] = JSON.stringify(armed)
  const turn = input.context?.turn?.status === 'answered' ? contextTurnOf(input.context.turn.value) : null
  if (turn?.kept) values['ctx.turn'] = JSON.stringify(turn.turn)
  return values
}

function agentOwnValues(input: AgentInput): Record<string, Value> {
  const {sessionRef, track, reading, accepted, harness, holds: held} = input
  const values: Record<string, Value> = {}
  // The light: the owner's task record for the selected session ("attached", agentChainDevices.ts LIGHT_KEY). Nothing reports a
  // benched agent, so the light is lit or not read — never dark on the shell's say.
  put(values, 'light', sessionRef != null && reading.attached === true ? 'lit' : 'unknown')
  if (sessionRef != null && track) {
    put(values, 'agent', track.agentName ?? track.agentRef)
    // The needle: seconds since the session's last check-in on the temporal reading; -1 when it was read and there is none.
    if (track.needle) put(values, 'age', track.needle.atUnixMs == null ? -1 : Math.max(0, Math.round((input.nowUnixMs - track.needle.atUnixMs) / 1000)))
    // The run state its face stands in (lane W5, runFaces.ts): the task's state, the needle against the 90 s horizon, the thread's last row.
    if (track.tasks) put(values, 'run', runStateOfSession({tasks: track.tasks, needle: track.needle}, threadRowsFrom(input.thread), input.nowUnixMs))
    // The session's run as the stage plays it: the kernel's temporal events at their own instants (runFaces.ts stageRecordingOf).
    const stage = input.events ? stageRecordingOf(input.events, [sessionRef, ...(track.spaceRef ? [track.spaceRef] : [])]) : null
    if (stage) values.stage = JSON.stringify(stage)
  }
  if (harness.resolved) put(values, 'harness', harness.binding)
  const doc = reading.gatewayAdmitted === true && isObj(reading.gatewayDoc) ? reading.gatewayDoc : null
  if (doc && typeof doc.model === 'string') put(values, 'model', doc.model)
  // Where the gateway names no model, the one the session last reported using (Actuation's usage records, lane K0).
  else if (sessionRef != null && input.usage?.status === 'answered') put(values, 'model', lastUsageModelOf(input.usage.value))
  put(values, 'effort', accepted.effort)
  put(values, 'input', accepted.input)
  put(values, 'quantize', accepted.quantize)
  if (sessionRef != null) {
    put(values, 'used', reading.budget?.used ?? track?.budget.used)
    put(values, 'cap', reading.budget?.cap ?? track?.budget.max)
    put(values, 'autonomy', reading.autonomy)
  }
  // The composer is the shell's own: its text while you type, and the last line an owner accepted from it — absent until then
  // (design.ts:8-10: an absent key stays absent). Nobody reports a holder of Effort, so effortHeld is absent too; a holder the
  // shell learns of stands in the binding's heldBy.
  put(values, 'draft', held.composer.draft)
  put(values, 'sent', held.composer.sent)
  // The owners' lists the choosers and the well draw (the design's `thread`, `models` and `harnesses`, actuation__harness-model.tsx:
  // 20-21): each the owner's own, or absent.
  if (sessionRef != null) put(values, 'thread', input.thread)
  if (input.models) values.models = JSON.stringify(input.models)
  if (input.harnesses) values.harnesses = JSON.stringify(input.harnesses)
  return values
}

/** The rows an Agent change goes through: the address table's (agentParamAddresses.ts — effort, input, heartbeat) and the declared
 * P0 rows (AGENT_P0_ROWS below — interrupt-quantize, steer-line, new-task), each with its own write path. */
export interface AgentRows {
  readonly effort?: SdkParamRow
  readonly input?: SdkParamRow
  readonly heartbeat?: SdkParamRow
  readonly quantize?: SdkParamRow
  readonly steerLine?: SdkParamRow
  readonly newTask?: SdkParamRow
}

export type RowWrite = (row: SdkParamRow, value: unknown) => Promise<DispatchReceipt>

/** The Agent's three declared rows beyond the address table: interrupt timing and the steer line on Actuation's agent face, the new
 * task on Software Factory's. They stand here, restated from inhabitants/agentNativeP0.ts:126-156 (key, family, values and write
 * path), because the shell never loads that batch (ql/devices/atlasDevices.ts:7-9 for the same reason); the binding test loads
 * the batch and fails on any drift between the two. */
export const AGENT_P0_ROWS: Readonly<{quantize: SdkParamRow; steerLine: SdkParamRow; newTask: SdkParamRow}> = {
  quantize: {family: 'actuation', deviceInstance: 'agent', key: 'interrupt-quantize', title: 'Interrupt timing', type: 'enumerated',
    values: ['now', 'next tool', 'next turn'], writePath: 'shell.setQuantize'},
  steerLine: {family: 'actuation', deviceInstance: 'agent', key: 'steer-line', title: 'Steer line', type: 'string', writePath: 'kernel:harness_agent_control'},
  newTask: {family: 'software-factory', deviceInstance: 'agent', key: 'new-task', title: 'New task', type: 'string', writePath: 'kernel:harness_agent_control'},
}

const AGENT_WRITES = new Set(['effort', 'input', 'heartbeat', 'quantize', 'draft', 'sent', 'light', 'cap'])

/** The Agent's binding: its values, and each change through its row's own write path (or held, for the composer's text). */
/** Why the Agent stands in no run state: no session is selected, or its task, needle and thread say none (runFaces.ts runStateOfSession). */
export const RUN_UNREAD = 'The run state is a reading: no session is selected, or its task, its needle and its thread (runFaces.ts) stand it in none yet.'

export function agentBinding(id: string, input: AgentInput, rows: AgentRows, write: RowWrite, steering: () => boolean): DesignBinding {
  const values = agentValues(input)
  const through = async (row: SdkParamRow | undefined, name: string, value: unknown) => {
    if (!row?.writePath) throw Error(`${name}: the row is not adopted on this chain, so nothing carries it.`)
    const receipt = await write(row, value)
    if (receipt.kind === 'refused') throw Error(receipt.reason)
    return receipt
  }
  return {
    id,
    values,
    standing: {...disabled(contextStanding(input.context, values)), ...disabled(REFUSED_WRITES[AGENT_DESIGN]!), ...('run' in values ? {} : {run: {disabled: RUN_UNREAD}})},
    writes: key => AGENT_WRITES.has(key),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        switch (key) {
          case 'effort': await through(rows.effort, 'Effort', value); break
          // The shell's steer setter takes the boolean the transport gives it (agentChainDevices.ts carryValue).
          case 'input': await through(rows.input, 'Input', value === 'steer'); break
          case 'heartbeat': await through(rows.heartbeat, 'Heartbeat', value); break
          case 'quantize': await through(rows.quantize, 'Interrupt', value); break
          case 'draft': updateHolds(was => ({...was, composer: {...was.composer, draft: String(value)}})); break
          case 'sent': {
            const text = String(value).trim()
            if (!text) break
            // Steer: the words reach the turn that runs (configure {steer}); Queue: they wait as the next task (configure {prompt}).
            const steer = input.accepted.input ? input.accepted.input === 'steer' : steering()
            await through(steer ? rows.steerLine : rows.newTask, steer ? 'Steer line' : 'New task', text)
            updateHolds(was => ({...was, composer: {draft: '', sent: text}}))
            break
          }
          case 'light': throw Error(REFUSE.power)
          case 'cap': throw Error(REFUSE.budget)
          default: throw Error(REFUSE.reading(key))
        }
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- carried practice

/** The rack's owner readings (agent_definition, through the kernel): the seated agent's profile, each of its sets as AIKit replies
 * (`aikit set show`), the set list (`aikit set list`, for a child set's size), the skills catalogue (`aikit session-space
 * agent-session-skills`), and the configuration plane's resolution of your requests and profile at a scope. */
export interface RackInput {
  /** The seated agent's accepted profile (central.agent-profile/v1), null when none is seated or read. */
  readonly profile: {readonly skill_refs?: unknown; readonly skill_set_refs?: unknown} | null
  /** Each carried set's reply, by name (null while read; an Error-like {error} when refused). */
  readonly sets: Readonly<Record<string, unknown>>
  readonly setList: unknown
  readonly skills: unknown
  /** `ai-kit:skills:skills.capabilities` resolved at the composition's scope. */
  readonly capabilities: unknown
  /** `ai-kit:resolution:resolution.profiles` resolved at the composition's scope. */
  readonly profiles: unknown
  readonly holds: ChainHolds
}

const setName = (ref: string) => ref.replace(/^sets\//, '')

/** The seated agent's accepted profile in the roster (central.agent-profile-roster/v1): the one whose agent_ref is the session's
 * agent. Another agent's profile is not this one's; an unaccepted profile carries nothing onto a chain. */
export function seatedProfile(roster: unknown, agentRef: string | null): RackInput['profile'] {
  if (!agentRef || !isObj(roster) || !Array.isArray(roster.profiles)) return null
  for (const entry of roster.profiles) {
    if (!isObj(entry) || entry.accepted !== true || !isObj(entry.profile)) continue
    if (entry.profile.agent_ref === agentRef) return entry.profile
  }
  return null
}
const FORM_PREFIX: readonly [string, Form][] = [['METHODOLOGY:', 'methodology'], ['METHOD:', 'method']]

/** A capability's form, by AIKit's own rule (`aikit method`: "skills whose description carries the METHOD: prefix"; the
 * Methodology's `METHODOLOGY:`). The counts agree with `aikit praxis list` (217 skills · 70 methods · 6 methodologies, read 16 Oct). */
export function formOf(description: string): Form {
  return FORM_PREFIX.find(([prefix]) => description.startsWith(prefix))?.[1] ?? 'skill'
}

interface CatalogueRow {ref: string; name: string; description: string; revision: string; eligible: boolean | null; reason: string | null}
function catalogue(skills: unknown): Map<string, CatalogueRow> {
  const rows = isObj(skills) && Array.isArray(skills.rows) ? skills.rows : []
  const out = new Map<string, CatalogueRow>()
  for (const row of rows) {
    if (!isObj(row) || typeof row.ref !== 'string') continue
    out.set(row.ref, {
      ref: row.ref, name: typeof row.name === 'string' ? row.name : row.ref,
      description: typeof row.description === 'string' ? row.description : '',
      revision: typeof row.revision === 'string' ? row.revision : '',
      eligible: typeof row.eligible === 'boolean' ? row.eligible : null,
      reason: typeof row.reason_code === 'string' ? row.reason_code : null,
    })
  }
  return out
}

/** One member, from what the owners report of it. The ladder lights only what was observed: carried (a set or the profile holds
 * it), catalogued (AIKit's catalogue lists it), available (it projects here, or AIKit withholds it with a reason). Selected,
 * projected into a harness, loaded, invoked, relied on, succeeded and verified are AIKit's operative evidence (`aikit praxis
 * disclose`), which no kernel operation reaches yet, so they stay hollow — not observed, never inferred upward. */
function member(ref: string, row: CatalogueRow | undefined, available: boolean | null, withheld: string | null): Member {
  const form = row ? formOf(row.description) : 'skill'
  const rungs: Rung[] = [true, row ? true : false, available, null, null, null, null, null, null, null]
  const prefix = FORM_PREFIX.find(([p]) => row?.description.startsWith(p))?.[0]
  return {
    id: ref,
    name: row?.name ?? ref.split('/').pop() ?? ref,
    form,
    rev: row?.revision ? row.revision.slice(0, 7) : '',
    says: row ? (prefix ? row.description.slice(prefix.length).trim() : row.description) : '',
    rungs,
    ...(withheld ? {withheld: {why: withheld, ...(/not been reviewed|unreviewed|unseen/i.test(withheld) ? {fix: 'review' as const} : {})}} : {}),
  }
}

/** The repertoire the seated agent carries: every set's members as AIKit replies (projected, or withheld with its reason), each
 * child set by reference, and the skills the profile names directly. Null when nothing is read yet. */
export function rackMembers(input: Pick<RackInput, 'profile' | 'sets' | 'setList' | 'skills'>): Member[] | null {
  if (!input.profile) return null
  const rows = catalogue(input.skills)
  const out = new Map<string, Member>()
  const sizes = new Map<string, number>()
  if (isObj(input.setList) && Array.isArray(input.setList.sets)) {
    for (const set of input.setList.sets) if (isObj(set) && typeof set.name === 'string' && typeof set.members === 'number') sizes.set(set.name, set.members)
  }
  for (const ref of strings(input.profile.skill_set_refs)) {
    const reply = input.sets[setName(ref)]
    if (!isObj(reply)) continue
    for (const cap of strings(reply.projected)) if (!out.has(cap)) out.set(cap, member(cap, rows.get(cap), true, null))
    for (const held of Array.isArray(reply.withheld) ? reply.withheld : []) {
      if (!isObj(held) || typeof held.capability !== 'string') continue
      out.set(held.capability, member(held.capability, rows.get(held.capability), false, typeof held.reason === 'string' ? held.reason : 'Withheld.'))
    }
    for (const child of strings(reply.child_refs)) {
      const name = setName(child)
      out.set(child, {id: child, name, form: 'skillset', rev: '', says: '', rungs: [true, sizes.has(name), null, null, null, null, null, null, null, null],
        ...(sizes.has(name) ? {holds: sizes.get(name)!} : {})})
    }
  }
  for (const ref of strings(input.profile.skill_refs)) {
    if (out.has(ref)) continue
    const row = rows.get(ref)
    out.set(ref, member(ref, row, row ? row.eligible : null, row && row.eligible === false ? row.reason ?? 'Not eligible here.' : null))
  }
  return [...out.values()]
}

/** Your request for a member: the intent held at the scope, else whether AIKit has it active (the plane's native reading). */
function requestOf(capabilities: unknown, id: string): boolean | undefined {
  if (!isObj(capabilities)) return undefined
  const desired = isObj(capabilities.desired) && isObj(capabilities.desired.value) ? capabilities.desired.value : null
  if (desired && typeof desired[id] === 'boolean') return desired[id] as boolean
  const native = isObj(capabilities.native) && isObj(capabilities.native.active) ? capabilities.native.active.value : undefined
  return Array.isArray(native) ? native.includes(id) : undefined
}

function profileOf(profiles: unknown): string | undefined {
  if (!isObj(profiles)) return undefined
  const desired = isObj(profiles.desired) ? profiles.desired.value : undefined
  const effective = isObj(profiles.native) && isObj(profiles.native.effective) ? profiles.native.effective.value : undefined
  const first = (value: unknown) => typeof value === 'string' ? value : strings(value)[0]
  return first(desired) ?? first(effective)
}

const composeState = (held: ChainHolds): 'previewed' | 'changed' | 'applied' =>
  held.compose.plan ? 'previewed' : Object.keys(held.compose.requests).length || held.compose.profile !== undefined ? 'changed' : 'applied'

/** The rack's values (§19.6): the set, its members with their marks and evidence, your requests, the composition. */
export function rackValues(input: RackInput): Values {
  const values: Record<string, Value> = {}
  const members = rackMembers(input)
  values.marks = SHELL_MARK_SET
  if (members) {
    values.members = JSON.stringify(members)
    put(values, 'light', members.length ? (members.some(m => m.rungs[2] === true) ? 'lit' : 'dark') : 'dark')
    for (const m of members) put(values, `req:${m.id}`, input.holds.compose.requests[m.id] ?? requestOf(input.capabilities, m.id))
  }
  const sets = input.profile ? strings(input.profile.skill_set_refs) : []
  if (sets.length) {
    put(values, 'set', setName(sets[0]!))
    const reply = input.sets[setName(sets[0]!)]
    if (isObj(reply) && typeof reply.revision === 'string') put(values, 'revision', reply.revision)
  }
  put(values, 'scope', input.holds.compose.scope)
  put(values, 'profile', input.holds.compose.profile ?? profileOf(input.profiles))
  put(values, 'target', input.holds.compose.target)
  values.compose = composeState(input.holds)
  return values
}

/** The configuration plane's scope for each of the rack's (§19.6 Scope: Home · Project · Session). */
export function planeScope(scope: ComposeScope, project: string, sessionRef: string | null): ConfigRequestWire['scope'] | null {
  if (scope === 'home') return {scope_kind: 'machine', scope_ref: null}
  if (scope === 'project') return {scope_kind: 'project', scope_ref: project}
  return sessionRef ? {scope_kind: 'agent-session', scope_ref: sessionRef} : null
}

/** The composition as the plane's requests: your member requests as `ai-kit:skills:skills.capabilities` (the scope's
 * enable/disable deltas, AIKit's own toggle pipeline) and the profile as `ai-kit:resolution:resolution.profiles`. */
export function composeRequests(held: ChainHolds, scope: ConfigRequestWire['scope']): ConfigRequestWire[] {
  const requests: ConfigRequestWire[] = []
  if (Object.keys(held.compose.requests).length) requests.push({setting_ref: 'ai-kit:skills:skills.capabilities', scope, value: {...held.compose.requests}})
  if (held.compose.profile !== undefined) requests.push({setting_ref: 'ai-kit:resolution:resolution.profiles', scope, value: [held.compose.profile]})
  return requests
}

/** The configuration plane, as the kernel carries it: `config_plan_reviewed` (`oi config plan`: owner-native plans, nothing
 * moves) and `config_apply_reviewed` (`oi config apply`: the admitted ChangeSet, verified by re-read, receipts back). */
export interface ComposePorts {
  readonly plan: (requests: ConfigRequestWire[]) => Promise<ComposePlan>
  readonly apply: (plan: ComposePlan) => Promise<void>
}

/** A change to the composition: a request, the scope, the profile — held until Preview; Preview asks the plane for the plan;
 * Apply carries exactly that plan; Cancel (or any new change) drops it. */
async function compose(change: ValueChange, ports: ComposePorts | null, place: {project: string; sessionRef: string | null}): Promise<boolean> {
  const {key, value} = change
  if (key.startsWith('req:')) {
    const id = key.slice(4)
    updateHolds(was => ({...was, compose: {...was.compose, plan: undefined, requests: {...was.compose.requests, [id]: value === true}}}))
    return true
  }
  if (key === 'scope') {
    if (value === 'home' || value === 'project' || value === 'session') updateHolds(was => ({...was, compose: {...was.compose, plan: undefined, scope: value}}))
    return true
  }
  if (key === 'profile') { updateHolds(was => ({...was, compose: {...was.compose, plan: undefined, profile: String(value)}})); return true }
  if (key !== 'compose') return false
  if (value === 'changed') { updateHolds(was => (was.compose.plan ? {...was, compose: {...was.compose, plan: undefined}} : was)); return true }
  const held = chainHolds()
  if (value === 'previewed') {
    if (!ports) throw Error(REFUSE.noKernel)
    const scope = held.compose.scope ? planeScope(held.compose.scope, place.project, place.sessionRef) : null
    if (!scope) throw Error(held.compose.scope === 'session' ? 'Session scope needs a selected session.' : REFUSE.scope)
    const requests = composeRequests(held, scope)
    if (!requests.length) throw Error('Nothing has changed since the last apply.')
    const plan = await ports.plan(requests)
    updateHolds(was => ({...was, compose: {...was.compose, plan}}))
    return true
  }
  if (value === 'applied') {
    if (!ports) throw Error(REFUSE.noKernel)
    const plan = held.compose.plan
    if (!plan) throw Error(REFUSE.noPlan)
    await ports.apply(plan)
    // Applied: the owner's reading now holds what you asked; the hold ends (the scope you chose stays your choice).
    updateHolds(was => ({...was, compose: {requests: {}, ...(was.compose.scope ? {scope: was.compose.scope} : {}), ...(was.compose.target ? {target: was.compose.target} : {})}}))
    return true
  }
  return true
}

// `members` stands for the chain list's request squares (skills.tsx ChainList reads st(p, 'members')): each request is its own
// `req:<id>` key, so `members` is no reading the host should draw disabled; a write of the list itself is refused as a reading.
// The rack's upkeep pages (lanes W7, W8; D5, skills.tsx: Set's Unused filter, Sources, Adopt, Procedures): AIKit's `unused`, `collate`,
// `adopt` (its plan, without --yes), `procedure list` and `bypass list`, read through the kernel's aikit_read (lane W3 round 3) where the
// chain stands (aikitPages.ts maps each answer; FactoryDeviceChain.tsx reads them), with `aikit source list` and the chosen procedure's
// `aikit procedure diff` (lane W9, the kernel's round of cdbde6fe7); Sync, Promote, Rollback, Undo and Revoke write through aikit_write on
// the thing the page chose, Apply adopts only at the digest of the plan you reviewed (`aikit adopt <root> --yes --expect-digest`), and Run
// applies the chosen procedure only at the digest its diff names (`aikit procedure run <id> --expect-digest`). Issue writes the bypass
// through aikit_write bypass-issue (lane K0: `aikit bypass issue --scope S --reason R`, whose answer is the bypass's id — the id `bypass
// list` shows, no secret); AIKit refuses a scope it does not take and an empty reason in its own words. The pages' settings are the hand's
// own holds.
/** Why each upkeep reading is absent when nothing is handed in (lane W8 reads them through aikit_read where the chain stands). */
export const RACK_UPKEEP_ABSENT: Readonly<Record<string, string>> = {
  unused: 'The members never seen used: AIKit\'s `aikit unused` is not read here.',
  sources: 'The sources the practice comes from: AIKit\'s `aikit source list` is not read here.',
  roots: 'The skill trees AIKit does not own: AIKit\'s `aikit collate` is not read here.',
  adoption: 'The adoption plan: choose a root and press Preview (`aikit adopt <root> --namespace <ns>` without --yes, a plan; nothing moves).',
  procedures: 'The changes AIKit made to the machine: AIKit\'s `aikit procedure list` is not read here.',
  bypasses: 'The hook bypasses: AIKit\'s `aikit bypass list` is not read here.',
}
/** The upkeep acts that stay refused, naming what each lacks: none since the kernel routes `aikit bypass issue` (lane K0). */
export const RACK_UPKEEP_REFUSE: Readonly<Record<string, string>> = {}
/** The acts routed to AIKit's own commands (aikit_write), each a person's press on the thing the page chose. */
export const RACK_UPKEEP_WRITES: Readonly<Record<string, string>> = {
  sync: 'source-sync', promote: 'source-promote', rollback: 'source-rollback', procUndo: 'procedure-undo', revoke: 'bypass-revoke',
  adoptApply: 'adopt', procRun: 'procedure-run', issue: 'bypass-issue',
}
/** AIKit's upkeep readings as the rack's chain holds them (workcellReads.ts useAikitRead). */
export interface RackUpkeep {
  readonly unused?: AikitAnswer
  /** `aikit source list` (the kernel's aikit_read source-list). */
  readonly sources?: AikitAnswer
  readonly collate?: AikitAnswer
  readonly bypasses?: AikitAnswer
  readonly procedures?: AikitAnswer
  /** The adoption plan for the root chosen (`aikit adopt <root>` without --yes); absent while no root is chosen. */
  readonly adoption?: AikitAnswer
  /** The procedure chosen, as `aikit procedure diff <id>` reads it ({procedure, kind, digest, diff}); absent while none is chosen. */
  readonly procedure?: AikitAnswer
  /** AIKit's writes through the kernel (aikit_write). Absent: no carrier stands. */
  readonly write?: (request: {kind: string; [field: string]: unknown}) => Promise<unknown>
}

/** The adoption plan as the design reads it ({root, namespace, digest, isolation, items}), each field where AIKit names it. Pure. */
export function adoptionOf(plan: unknown): Record<string, unknown> | null {
  if (!isObj(plan)) return null
  const items = Array.isArray(plan.items) ? plan.items.filter(isObj) : null
  const kept = Object.fromEntries((['root', 'namespace', 'digest', 'isolation'] as const).flatMap(key => (typeof plan[key] === 'string' ? [[key, plan[key]]] : [])))
  return Object.keys(kept).length || items ? {...kept, ...(items ? {items} : {})} : null
}

/** The upkeep pages' settings: the hand's own holds (skills.tsx: unusedOnly, source, adoptRoot, namespace, procedure, bypassScope, bypassReason). */
export const RACK_UPKEEP_SETTINGS: readonly string[] = ['unusedOnly', 'source', 'adoptRoot', 'namespace', 'procedure', 'bypassScope', 'bypassReason']

const RACK_WRITES = (key: string) => key.startsWith('req:') || ['scope', 'profile', 'compose', 'target', 'exported', 'set', 'members', 'adoptPreview'].includes(key)
  || key in RACK_UPKEEP_REFUSE || key in RACK_UPKEEP_WRITES

export interface RackPlace {readonly project: string; readonly sessionRef: string | null}

/** The Skillset rack's binding: every control is an AIKit operation through the configuration plane, or refused by name. */
export function rackBinding(id: string, input: RackInput, ports: ComposePorts | null, place: RackPlace, upkeep: RackUpkeep = {}): DesignBinding {
  const values: Record<string, Value> = {...rackValues(input)}
  const view = viewHolds(input.holds, id)
  for (const key of RACK_UPKEEP_SETTINGS) put(values, key, view[key])
  const read = <T>(answer: AikitAnswer | undefined, map: (value: unknown) => T | null): T | null => (answer?.status === 'answered' ? map(answer.value) : null)
  const unused = read(upkeep.unused, unusedOf), roots = read(upkeep.collate, rootsOf), bypasses = read(upkeep.bypasses, bypassesOf)
  const sources = read(upkeep.sources, sourcesOf)
  const listed = read(upkeep.procedures, proceduresOf), adoption = read(upkeep.adoption, adoptionOf)
  const diff = read(upkeep.procedure, procedureDiffOf)
  // The procedure chosen carries its kind and digest where AIKit's diff of it answered; the others stand by their ids.
  const procedures = listed && diff ? listed.map(row => (row.id === diff.id ? {...row, ...diff} : row)) : listed
  if (unused) values.unused = JSON.stringify(unused)
  if (sources) values.sources = JSON.stringify(sources)
  if (roots) values.roots = JSON.stringify(roots)
  if (bypasses) values.bypasses = JSON.stringify(bypasses)
  if (procedures) values.procedures = JSON.stringify(procedures)
  if (adoption) values.adoption = JSON.stringify(adoption)
  const standing: Record<string, Standing> = {...disabled(RACK_UPKEEP_REFUSE), ...disabled(REFUSED_WRITES[RACK_DESIGN]!)}
  const absentWhy = (key: string, answer: AikitAnswer | undefined) => (answer?.status === 'refused' ? answer.error ?? RACK_UPKEEP_ABSENT[key]!
    : answer?.status === 'reading' ? `AIKit has not answered yet (${RACK_UPKEEP_ABSENT[key]!.split(': ')[1] ?? key}).` : answer ? `AIKit answered something other than ${key}.` : RACK_UPKEEP_ABSENT[key]!)
  for (const [key, answer] of [['unused', upkeep.unused], ['sources', upkeep.sources], ['roots', upkeep.collate], ['bypasses', upkeep.bypasses], ['procedures', upkeep.procedures], ['adoption', upkeep.adoption]] as const) {
    if (!(key in values)) standing[key] = {disabled: absentWhy(key, answer)}
  }
  const noCarrier = 'The kernel carrier is unavailable here, so AIKit cannot be asked (aikit_write).'
  if (!upkeep.write) for (const key of Object.keys(RACK_UPKEEP_WRITES)) standing[key] = {disabled: noCarrier}
  else {
    if (!sources) for (const key of ['sync', 'promote', 'rollback']) standing[key] = {disabled: standing.sources?.disabled ?? 'No source is read.'}
    if (!procedures) standing.procUndo = {disabled: standing.procedures?.disabled ?? 'No procedure is read.'}
    if (!bypasses) standing.revoke = {disabled: standing.bypasses?.disabled ?? 'No bypass is read.'}
    if (!adoption) standing.adoptApply = {disabled: standing.adoption?.disabled ?? 'No adoption plan is read.'}
    if (!diff) standing.procRun = {disabled: 'Run: choose a procedure first; Run applies it only at the digest AIKit\'s diff of it names (`aikit procedure diff`).'}
  }
  /** The AIKit request for one upkeep act on the thing the page chose, or why it cannot be asked. Each is checked against what was read. */
  const upkeepRequest = (key: string, value: string): {kind: string; [field: string]: unknown} => {
    const kind = RACK_UPKEEP_WRITES[key]!
    switch (key) {
      case 'sync': case 'promote': case 'rollback': {
        const source = sources?.find(row => row.id === value)
        if (!source) throw Error(`${key}: that source is not in AIKit's list.`)
        if (key === 'rollback' && !source.rollback) throw Error('Rollback: AIKit names no earlier promoted snapshot for this source.')
        return {kind, id: value}
      }
      case 'procUndo':
        if (!procedures?.some(row => row.id === value)) throw Error('Undo: that procedure is not in AIKit\'s list.')
        return {kind, procedure: value}
      case 'revoke':
        if (!bypasses?.some(row => row.id === value)) throw Error('Revoke: that bypass is not in AIKit\'s list.')
        return {kind, id: value}
      case 'issue': {
        // The design's press: JSON {scope, reason}. The scope and the reason go as written; AIKit takes or refuses them in its words.
        let pressed: {scope?: unknown; reason?: unknown}
        try { pressed = JSON.parse(value) as {scope?: unknown; reason?: unknown} } catch { throw Error('Issue: the press names no scope and reason.') }
        if (typeof pressed?.reason !== 'string') throw Error('Issue: give a reason first.')
        return {kind, reason: pressed.reason, ...(typeof pressed.scope === 'string' && pressed.scope ? {scope: pressed.scope} : {})}
      }
      case 'adoptApply': {
        // Apply only the plan you reviewed: the digest pressed is the digest of the plan read.
        if (!adoption || typeof adoption.digest !== 'string' || adoption.digest !== value) throw Error('Apply: the plan changed since you reviewed it, or names no digest; read it again with Preview.')
        const root = typeof adoption.root === 'string' ? adoption.root : view.adoptRoot, namespace = typeof adoption.namespace === 'string' ? adoption.namespace : view.namespace
        if (typeof root !== 'string' || !root) throw Error('Apply: choose a root and press Preview first.')
        return {kind, root, ...(typeof namespace === 'string' && namespace ? {namespace} : {}), expect_digest: value}
      }
      case 'procRun': {
        // `<id>@<digest>`: the procedure chosen, at the digest its diff names.
        const at = value.lastIndexOf('@'), procedure = at > 0 ? value.slice(0, at) : value, digest = at > 0 ? value.slice(at + 1) : ''
        if (!diff || diff.id !== procedure || diff.digest !== digest) throw Error('Run: the procedure or its digest is not the one AIKit\'s diff names now; choose it again.')
        return {kind, procedure, expect_digest: digest}
      }
      default: throw Error(REFUSE.reading(key))
    }
  }
  /** One of AIKit's upkeep writes; its refusal is AIKit's own words. */
  const upkeepWrite = async (key: string, value: Value | undefined) => {
    if (standing[key]?.disabled) throw Error(standing[key]!.disabled!)
    if (typeof value !== 'string' || !value) throw Error(`${key}: choose what it acts on first.`)
    await upkeep.write!(upkeepRequest(key, value))
  }
  return {
    id,
    values,
    standing,
    local: Object.fromEntries(RACK_UPKEEP_SETTINGS.map(key => [key, (value: Value | undefined) => holdView(id, key, value)])),
    writes: RACK_WRITES,
    write: async changes => {
      for (const change of changes) {
        if (await compose(change, ports, place)) continue
        if (change.key in RACK_UPKEEP_WRITES) { await upkeepWrite(change.key, change.value); continue }
        switch (change.key) {
          // The package target is your choice for the next export, held here; Export itself has no carrier.
          case 'target': updateHolds(was => ({...was, compose: {...was.compose, target: String(change.value)}})); break
          // Preview: the root chosen, whose plan the chain then reads (a reading, never a write).
          case 'adoptPreview': holdView(id, 'adoptRoot', typeof change.value === 'string' && change.value ? change.value : undefined); break
          case 'exported': throw Error(REFUSE.export)
          case 'set': throw Error(REFUSE.set)
          default: throw Error(RACK_UPKEEP_REFUSE[change.key] ?? REFUSE.reading(change.key))
        }
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the member

/** The member device's values (§19.7): the rack's chosen member over the same members, your request, and the asks it holds. */
export function memberValues(rack: Values, chosen: string | null, held: ChainHolds): Values {
  const values: Record<string, Value> = {marks: SHELL_MARK_SET}
  if (typeof rack.members === 'string') values.members = rack.members
  if (chosen) {
    put(values, 'member', chosen)
    put(values, 'requested', rack[`req:${chosen}`])
  }
  if (held.member.reviewAsk) values.reviewAsk = true
  if (held.member.run) values.run = held.member.run
  return values
}

/** The rack's members as chains for its selector (skillRackSelection.ts chosenChain: the one chosen, else the first). */
export function memberChains(rack: Values): {ref: string}[] | null {
  return typeof rack.members === 'string' ? (JSON.parse(rack.members) as Member[]).map(m => ({ref: m.id})) : null
}

// The member's upkeep pages (lanes W7, W8; D5, member.tsx: Why and History, with Retire and Restore). `aikit explain` and `aikit history` of
// the chosen member are read through the kernel's aikit_read (lane W3 round 3) and handed in (MemberPorts why, history). Central's
// control.skills.inspect reads its ground by skill name and path, and no reading here ties an AIKit capability ref to a ground path, so
// `ground` stands absent. control.skills.retire and
// control.skills.restore write Central's ground, and the kernel's invoke_action carries the person's authority only for the acts
// desktop/cradle/kernel/src/action.rs PERSON_ACTS names — which names neither — so both stand disabled with that reason.
export const MEMBER_UPKEEP_ABSENT: Readonly<Record<string, string>> = {
  why: 'Why it stands as it does: AIKit\'s `aikit explain <capability>` is not read here (choose a member in the rack).',
  history: 'Its recorded changes: AIKit\'s `aikit history <capability>` is not read here (choose a member in the rack).',
  ground: 'Its standing in Central\'s ground: no reading reaches it yet — missing op: a tie from an AIKit capability ref to its ground path (control.skills.inspect lists skills by ground name and path; `aikit explain` names what selects the capability and where it is projected, not its ground path) (Central).',
}
export const MEMBER_UPKEEP_REFUSE: Readonly<Record<string, string>> = {
  retire: missing('Retire', 'control.skills.retire carried with the person\'s authority (desktop/cradle/kernel/src/action.rs PERSON_ACTS names it not)', 'Central'),
  restore: missing('Restore', 'control.skills.restore carried with the person\'s authority (desktop/cradle/kernel/src/action.rs PERSON_ACTS names it not)', 'Central'),
}
/** The member's upkeep holds: the reason Retire would record, its asks, and the history row chosen. */
const MEMBER_UPKEEP_HOLDS: readonly string[] = ['retireReason', 'retireAsk', 'restoreAsk', 'event']

const MEMBER_WRITES = new Set(['requested', 'reviewed', 'run', 'proved', ...Object.keys(MEMBER_UPKEEP_REFUSE)])

/** The member's writes to AIKit through the kernel's routes (ownerRoutes.ts). Absent: no carrier stands. */
export interface MemberPorts {
  /** Record that you reviewed the capability's revision (`aikit trust record <capability>`, aikit_write trust-record). */
  readonly trust?: (capability: string) => Promise<unknown>
  /** AIKit's readings of the chosen member (lane W8, aikit_read explain and history), and the clock History's instants are read on. */
  readonly why?: AikitAnswer
  readonly history?: AikitAnswer
  readonly timezone?: string
}

/** The member's binding: Enabled is your request in the rack's composition (Preview and Apply carry it); Review is asked first —
 * the ask is the view's own key, held here until Trust or Cancel drops it; Trust records the review with AIKit (`aikit trust record`)
 * on the chosen capability; Run and Prove stand refused, each naming what the member does not carry. */
export function memberBinding(id: string, rack: Values, chosen: string | null, held: ChainHolds, ports: MemberPorts = {}): DesignBinding {
  const refused: Record<string, string> = {...MEMBER_UPKEEP_ABSENT, ...MEMBER_UPKEEP_REFUSE, ...REFUSED_WRITES[MEMBER_DESIGN]!}
  if (ports.trust) delete refused.reviewed
  const values: Record<string, Value> = {...memberValues(rack, chosen, held)}
  const view = viewHolds(held, id)
  for (const key of MEMBER_UPKEEP_HOLDS) put(values, key, view[key])
  const why = chosen && ports.why?.status === 'answered' ? whyOf(ports.why.value) : null
  const history = chosen && ports.history?.status === 'answered' ? historyOf(ports.history.value, ports.timezone) : null
  if (why) { values.why = JSON.stringify(why); delete refused.why }
  else if (chosen && ports.why) refused.why = ports.why.status === 'refused' ? ports.why.error ?? MEMBER_UPKEEP_ABSENT.why! : ports.why.status === 'reading' ? 'AIKit has not answered yet (`aikit explain`).' : '`aikit explain` answered something other than an explanation.'
  if (history) { values.history = JSON.stringify(history); delete refused.history }
  else if (chosen && ports.history) refused.history = ports.history.status === 'refused' ? ports.history.error ?? MEMBER_UPKEEP_ABSENT.history! : ports.history.status === 'reading' ? 'AIKit has not answered yet (`aikit history`).' : '`aikit history` answered something other than a history.'
  return {
    id,
    values,
    local: {reviewAsk: value => updateHolds(was => ({...was, member: {...was.member, reviewAsk: value === true ? true : undefined}})),
      ...Object.fromEntries(MEMBER_UPKEEP_HOLDS.map(key => [key, (value: Value | undefined) => holdView(id, key, value)]))},
    standing: disabled(refused),
    writes: key => MEMBER_WRITES.has(key),
    write: async changes => {
      for (const {key, value} of changes) {
        switch (key) {
          case 'requested':
            if (!chosen) throw Error('No member is chosen in the rack.')
            updateHolds(was => ({...was, compose: {...was.compose, plan: undefined, requests: {...was.compose.requests, [chosen]: value === true}}}))
            break
          case 'reviewed':
            updateHolds(was => ({...was, member: {...was.member, reviewAsk: undefined}}))
            if (!ports.trust) throw Error(REFUSE.trust)
            if (!chosen) throw Error('No member is chosen in the rack.')
            await ports.trust(chosen)
            break
          case 'run':
            if (value === 'asked') { updateHolds(was => ({...was, member: {...was.member, run: 'asked'}})); break }
            updateHolds(was => ({...was, member: {...was.member, run: undefined}}))
            if (value === 'ran') throw Error(REFUSE.run)
            break
          case 'proved': throw Error(REFUSE.prove)
          default: throw Error(MEMBER_UPKEEP_REFUSE[key] ?? REFUSE.reading(key))
        }
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- Scope

/** Scope's values (§19.14). No owner reports the reach, the write mode, the knowledge bounds, the basis, the places or the receipts
 * (the address table's world rows are readings with no source: agentParamAddresses.ts:93-97), so every one is absent; the only
 * value is a raised reach waiting for your Confirm. */
export function scopeValues(held: ChainHolds): Values {
  const values: Record<string, Value> = {}
  if (held.reachPending !== undefined) values.reachPending = held.reachPending
  return values
}

const SCOPE_WRITES = (key: string) => ['reach', 'writeMode', 'knowledge'].includes(key) || key.startsWith('w:')

/** A raised reach the view holds: a ring, or none (Cancel's drop). */
const reachOf = (value: Value | undefined): number | undefined => {
  const ring = typeof value === 'number' ? value : value === undefined ? NaN : Number(value)
  return Number.isFinite(ring) ? ring : undefined
}

/** Scope's binding: a raised reach is the view's own key, held until Confirm — nothing is sent before, and Cancel drops it — and
 * Confirm goes to the owner; the write mode goes through the world row's own write path (the shell write arm, which its dispatcher
 * refuses until WO-SF2 reads it). */
export function scopeBinding(id: string, held: ChainHolds, writeModeRow: SdkParamRow | undefined, write: RowWrite): DesignBinding {
  return {
    id,
    values: scopeValues(held),
    local: {reachPending: value => updateHolds(was => (was.reachPending === reachOf(value) ? was : {...was, reachPending: reachOf(value)}))},
    standing: disabled(REFUSED_WRITES[SCOPE_DESIGN]!),
    writes: SCOPE_WRITES,
    write: async changes => {
      for (const {key, value} of changes) {
        if (key === 'reach') {
          // Confirmed (or lowered): the hold ends, and the reach goes to its owner.
          updateHolds(was => (was.reachPending === undefined ? was : {...was, reachPending: undefined}))
          throw Error(REFUSE.reach)
        }
        if (key === 'writeMode') {
          if (!writeModeRow?.writePath) throw Error('Write mode: the row is not adopted on this chain, so nothing carries it.')
          // The shell's write arm carries propose and direct as a boolean; draft has no writer (agentChainDevices.ts carryValue).
          if (value !== 'propose' && value !== 'direct') throw Error(writeModeRow.disclosure ?? `"${String(value)}" has no writer.`)
          const receipt = await write(writeModeRow, value === 'direct')
          if (receipt.kind === 'refused') throw Error(receipt.reason)
          continue
        }
        if (key === 'knowledge') throw Error(REFUSE.knowledge)
        if (key.startsWith('w:')) throw Error(REFUSE.place)
        throw Error(REFUSE.reading(key))
      }
    },
  }
}
