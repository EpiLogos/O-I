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
import type {DesignBinding, DesignedDevice, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import type {DispatchReceipt} from '../../inhabitants/sdk/shellSetters'
import type {Form, Member, Rung} from '../../inhabitants/catalogue/panels/practice'
import type {ConfigRequestWire, ModelSliceName} from '../../../../../../desktop/cradle/src/kernel/types'
import {censusOf, type CensusReading} from '../../../../../../desktop/cradle/src/agency/census'
import {sliceValue, type ModelSliceReading} from '../../owners/model'
import {chainDeclaration, declaredValue, gatewayBindingIn, type ModelField} from '../../inhabitants/agentParamAddresses'
import {parseSeatStatusJson, type SeatReading} from '../../inhabitants/centralHygieneModel'
import {refusalLine, safeJson} from '../RefusalCard'
import type {AgentGit} from './oneAgentBinding'
import {CHAIN_ADMIT_WORDS, OWNER_BINDINGS, SKILLSETS_ARRIVE, ownerRefusalLine} from '../agentChainDrag'
import {harnessKeyUncarried} from '../aikitGatewayOps'
import {INITIAL_READING, chainDeviceId, gatewayLine, rosterAdmits, rosterChains, rosterIdentity, taskReading, type AgentChainReading, type LandingSeat} from './agentChainDevices'
import {flipDevice, publishedDevice, selectDevice, subscribeDeviceDoor} from '../../frame/devices/deviceDoor'
import {setHostPage} from '../../frame/devices/deviceHost'
import type {OwnerAcceptedValues} from './ownerAccepted'
import type {TaskClip, TemporalEventLike} from '../agentRunModel'
import {runStateOfSession, stageRecordingOf, threadRowsFrom} from './runFaces'
import {armedOf, bypassesOf, contextPressureOf, contextTurnOf, historyOf, procedureDiffOf, proceduresOf, rootsOf, sourcesOf, unusedOf, whyOf, type AikitAnswer} from './aikitPages'
import {aikitAdoptionPlan, aikitAdoptRequest, type AikitAdoptionPlan} from '../../settings/aikitAdoption'

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

/** Scope's Calls to other agents (§19.12 Asks): AIKit's ingress rule for the sender kind agent on each gateway binding of the session
 * (GatewayIngressPolicy kind_rules, decided after a sender's own id and before the binding's one default), set through the kernel's
 * harness_ingress_rule. Why it is not pressable, or a value it does not take. */
export const CALLS_REFUSE = {
  uncarried: 'Calls to other agents: no carrier to AIKit\'s ingress rule for the sender kind agent (the kernel\'s harness_ingress_rule) stands on this chain.',
  unread: 'Calls to other agents: AIKit\'s gateway has not answered yet, so no rule for calls from other agents is read.',
  unbound: 'Calls to other agents: this session holds no conversation on AIKit\'s gateway, so no binding of it takes a rule for calls from other agents.',
  refused: (why: string) => `Calls to other agents: AIKit's gateway did not answer, so no rule for calls from other agents is read. ${why}`,
  decision: (value: string) => `Calls to other agents is Allow, Ask or Deny, not ${value}.`,
} as const

/** Calls to other agents as the design's words name each rule: what a binding now does with a call from another agent. */
const CALLS_SAID: Readonly<Record<string, {readonly one: string; readonly many: string; readonly word: string}>> = {
  allow: {one: 'lets it through', many: 'let it through', word: 'Allow'}, pair: {one: 'asks you', many: 'ask you', word: 'Ask'},
  deny: {one: 'denies it', many: 'deny it', word: 'Deny'}}
const listed = (items: readonly string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
/** Set one rule for calls from other agents on every binding of a session, one binding at a time (AIKit keeps a rule per binding: the
 * kernel's harness_ingress_rule). The bindings are not set as one: where one refuses, the words say which now answer the new way, which
 * keep the rule they had, and what to press next. */
export async function callsOnEvery(bindings: readonly string[], decision: CallsDecision,
  set: (binding: string, decision: CallsDecision) => Promise<unknown>): Promise<void> {
  for (const [at, binding] of bindings.entries()) {
    try { await set(binding, decision) } catch (cause) {
      const done = bindings.slice(0, at), left = bindings.slice(at)
      const said = CALLS_SAID[decision] ?? {one: `answers ${decision}`, many: `answer ${decision}`, word: decision}
      const why = cause instanceof Error ? cause.message : String(cause)
      const stands = done.length ? `${listed(done)} now ${done.length > 1 ? said.many : said.one}` : 'nothing changed'
      const keep = `${listed(left)} ${left.length > 1 ? 'keep the rule they had' : 'keeps the rule it had'}`
      throw Error(`Calls to other agents stopped at ${binding}: ${stands}, and ${keep}; ${why.replace(/\.$/, '')}. Choose ${said.word} again to set ${left.length > 1 || done.length ? 'the rest' : 'it'}.`)
    }
  }
}

/** Scope's Wait and On no answer (§19.12 Asks: Wait 15 min–24 h, default 4 h; On no answer Hold or Deny, default Hold): the session's own
 * settings in AIKit (`track.wait` in seconds, `track.no_answer`; ai-kit encounter_task_settings.rs), written through the kernel's
 * encounter_session_settings. AIKit's executor plays them: a request nobody answered by its Wait is denied with the harness's own deny, or
 * held in Approvals past its Wait, as the person chose (ai-kit encounter_task_executor.rs settle_asks). */
export const WAIT_SECONDS = {min: 900, max: 86_400} as const
export const NO_ANSWERS: readonly string[] = ['hold', 'deny']
export const WAIT_REFUSE = {
  wait: 'Wait: no carrier to AIKit\'s Wait on the session\'s own settings (the kernel\'s encounter_session_settings, track wait) stands on this chain.',
  noAnswer: 'On no answer: no carrier to AIKit\'s On no answer on the session\'s own settings (the kernel\'s encounter_session_settings, track no_answer) stands on this chain.',
  unread: (what: string) => `${what}: AIKit has not read the session's settings yet.`,
  older: (what: string) => `${what}: this AIKit's session settings carry no ${what}, so it is neither read nor set (an AIKit before O-I round 860).`,
  range: 'Wait is 15 min to 24 h: a whole number of seconds from 900 to 86400.',
  noAnswerValue: (value: string) => `On no answer is Hold or Deny, not ${value}.`,
} as const
/** The session's Wait and On no answer as a Scope is handed them: AIKit's track settings (null while unread), why they are not read (AIKit's
 * refusal, or where the Scope stands on no one session), and their write. */
export interface ScopeWaits {
  readonly track: {readonly wait?: unknown; readonly no_answer?: unknown} | null
  readonly why?: string
  readonly write?: (change: {wait?: number; no_answer?: 'hold' | 'deny'}) => Promise<unknown>
}
const WAIT_KEYS = {wait: {field: 'wait', what: 'Wait'}, noAnswer: {field: 'no_answer', what: 'On no answer'}} as const
type WaitKey = keyof typeof WAIT_KEYS
/** Why Wait or On no answer is not pressable, or null where it writes. */
function waitWhy(key: WaitKey, waits: ScopeWaits | undefined): string | null {
  const {field, what} = WAIT_KEYS[key]
  if (waits?.why) return `${what}: ${waits.why}`
  if (!waits?.write) return WAIT_REFUSE[key]
  if (!waits.track) return WAIT_REFUSE.unread(what)
  return field in waits.track ? null : WAIT_REFUSE.older(what)
}
/** Wait and On no answer as AIKit reads them, in Scope's keys. */
export function waitValues(waits: ScopeWaits | undefined): Record<string, Value> {
  const values: Record<string, Value> = {}
  const track = waits?.track
  if (typeof track?.wait === 'number') values.wait = track.wait
  if (typeof track?.no_answer === 'string' && NO_ANSWERS.includes(track.no_answer)) values.noAnswer = track.no_answer
  return values
}
/** Each of Wait and On no answer that is not pressable, with why. */
export function waitStanding(waits: ScopeWaits | undefined): Record<string, Standing> {
  const standing: Record<string, Standing> = {}
  for (const key of Object.keys(WAIT_KEYS) as WaitKey[]) { const why = waitWhy(key, waits); if (why) standing[key] = {disabled: why} }
  return standing
}
/** Write Wait or On no answer to the session's own settings, or refuse in the words of what stands in the way. */
export async function waitWrite(key: WaitKey, value: Value | undefined, waits: ScopeWaits | undefined): Promise<void> {
  const why = waitWhy(key, waits)
  if (why) throw Error(why)
  if (key === 'wait') {
    const seconds = typeof value === 'number' ? Math.round(value) : NaN
    if (!(seconds >= WAIT_SECONDS.min && seconds <= WAIT_SECONDS.max)) throw Error(WAIT_REFUSE.range)
    await waits!.write!({wait: seconds})
    return
  }
  if (typeof value !== 'string' || !NO_ANSWERS.includes(value)) throw Error(WAIT_REFUSE.noAnswerValue(String(value)))
  await waits!.write!({no_answer: value as 'hold' | 'deny'})
}

const REFUSE = {
  power: 'Power is a reading: the harness reports whether the agent is on; Actuation exposes no Power write.',
  budget: 'Budget is a reading here: used and cap come from the session\'s task record (encounter_task_read); Actuation exposes no budget write.',
  reading: (key: string) => `${key} is a reading: its owner reports it; nothing here changes it.`,
  set: `The set on the chain is chosen by a drop: drag a SkillSet from the browser onto the chain and ${CHAIN_ADMIT_WORDS} adds it to what the agent carries, or onto the Skillset rack to stand where the one it carries stood (agent-profile.chain-replace).`,
  // Lane W3 routes AIKit's store writes (desktop/cradle/kernel/src/owner_routes.rs AikitWrite; ownerRoutes.ts aikitWriteOp). Export's
  // `aikit set package export SET --target T --out DIR` writes into an absolute directory the rack's Into field names (`outDir`),
  // through the rack's AIKit write (rackBinding: kind set-package-export); Run's `aikit praxis method run REF --input JSON` takes the Method's exact input and Prove's `aikit praxis method prove --method REF
  // --proof-json J` the run's proof, and the member carries neither. Trust writes (memberBinding, MemberPorts.trust).
  export: 'Export: name the directory the package is written into, as an absolute path (Into): `aikit set package export <set> --target <t> --out <dir>` takes an absolute --out, and the owner\'s own default, ./<package>-<target>, is relative to a working directory the kernel does not choose.',
  trust: 'Trust: the kernel carrier is unavailable here, so AIKit cannot be asked (`aikit trust record <capability>` through the kernel\'s aikit_write).',
  run: missing('Run', 'the exact JSON input `aikit praxis method run <ref> --input` takes (the kernel\'s aikit_write method-run carries it; the member has no field for it)', 'AIKit'),
  prove: missing('Prove', 'the run\'s proof `aikit praxis method prove --method <ref> --proof-json` takes (its Activity, Return, Evidence and verification refs; the member holds no run receipt)', 'AIKit'),
  reach: missing('Reach', 'the scope reach write on the world device\'s apply path (WO-SF2)', 'Software Factory'),
  // Scope's Asks page (§19.12 Asks): Calls to other agents is AIKit's ingress rule for the sender kind agent (CALLS_REFUSE; scopeBinding
  // writes it where the chain hands in its carrier). Wait and On no answer are the session's own settings in AIKit, which its executor plays
  // (WAIT_REFUSE; scopeBinding writes them where the chain hands in the session's settings).
  calls: CALLS_REFUSE.uncarried,
  wait: WAIT_REFUSE.wait,
  noAnswer: WAIT_REFUSE.noAnswer,
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

/** The Context page (lanes W7, W8; D5; AIKit's instrument's since §19.26, ai-kit__ai-kit.tsx `ctx.pressure`, `ctx.armed`, `ctx.turn`; the
 * Agent's binding still carries them, and no design of the Agent's reads them now): AIKit's continuity,
 * read through the kernel's aikit_read {continuity-pressure, continuity-commands} (aikitPages.ts) where the chain hands them in; the last
 * turn's bounded blocks no command reports (T-COVERAGE §1.5, AIKit: "a read of the last turn's bounded blocks (Context)"). Why each is
 * absent when it is. */
export const AGENT_CONTEXT_ABSENT: Readonly<Record<string, string>> = {
  'ctx.pressure': 'The context pressure: AIKit\'s continuity is not read here (`aikit work continuity pressure` through the kernel\'s aikit_read).',
  'ctx.armed': 'The star commands armed: AIKit\'s continuity is not read here (`aikit work continuity commands` through the kernel\'s aikit_read).',
  'ctx.turn': 'The last turn\'s bounded blocks: AIKit\'s continuity is not read here (`aikit work continuity turn` through the kernel\'s aikit_read).',
  // The Git row (O-I ticket 748): the chain lays the session's checkout in over this (oneAgentBinding.ts withAgentGit) — the workcell's seat
  // of its project, from the World Model's workcells slice (sessionGitOf). No design draws it: the manual names no Git row (§19.4, §19.26).
  'ctx.git': 'The session\'s checkout: the chain that holds the Agent reads the workcell\'s seat of its project and lays it in; it is not read here.',
}
/** The Git row's Diff, a press with no value of its own: it waits on the checkout the chain lays in. */
const AGENT_DIFF_ABSENT = 'Diff opens Files\' Diff page on the session\'s checkout, which the chain that holds the Agent reads; it is not read here.'

/** Each chain design's refused writes, by key (the refusals its binding's write gives, below). The Agent's light is among them since
 * the kit's activator says why it only reads (inhabitants/sdk/panel.tsx Panel `lightWhy`, c5afc4aa0): the design stands its activator
 * disabled on the light's standing (actuation__harness-model.tsx head: `st(p, 'light').disabled`), so nothing is pressed only to be
 * refused. */
export const REFUSED_WRITES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  [AGENT_DESIGN]: {light: REFUSE.power, cap: REFUSE.budget, heartbeat: REFUSE.heartbeat},
  [RACK_DESIGN]: {set: REFUSE.set},
  [MEMBER_DESIGN]: {reviewed: REFUSE.trust, run: REFUSE.run, proved: REFUSE.prove},
  [SCOPE_DESIGN]: {reach: REFUSE.reach, writeMode: REFUSE.writeMode, calls: REFUSE.calls, wait: REFUSE.wait, noAnswer: REFUSE.noAnswer},
}

// ---------------------------------------------------------------------------------------------------------------- the hold store
// The hold store is chainHolds.ts (the frame's first load carries it without these bindings).
export {chainHolds, updateHolds, subscribeHolds, resetHolds, holdView, viewHolds, useChainHolds, type ComposeScope, type ComposePlan, type ChainHolds} from './chainHolds'
import {chainHolds, updateHolds, holdView, viewHolds, type ComposeScope, type ComposePlan, type ChainHolds} from './chainHolds'

const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

// ---------------------------------------------------------------------------------------------------------------- the Gateway

// The Gateway's values and link readings are gatewayValues.ts (the frame's first load carries them without these bindings).
export {gatewayValues, gatewayLinkOf, linkFrames, gatewayLinkValues, type GatewayInput} from './gatewayValues'
import {gatewayValues, gatewayLinkOf, type GatewayInput} from './gatewayValues'

/** What each link reading is, for its standing. */
const LINK_WORDS: Readonly<Record<string, string>> = {
  beatAge: 'The time since the last check-in', running: 'The turns running', inflight: 'The frames in flight', frames: 'The gateway\'s frames',
}
const LINK_DOCUMENT = '`aikit gateway agent --binding B sessions`, the kernel\'s harness_agent_read'

/** Why a link reading the binding does not carry is absent: the gateway refused or has not answered, its answer carries no link (a gateway
 * that predates it), or — beatAge only — its frames were journaled before it stamped them. */
export function gatewayLinkStanding(reading: GatewayInput['reading'], values: Values): Record<string, Standing> {
  const doc = reading.gatewayDoc
  const why = (key: string): string => {
    const what = LINK_WORDS[key]!
    if (reading.gateway.kind === 'refused') return `${what}: the gateway refused its reading — ${reading.gateway.line}`
    if (!isObj(doc)) return `${what}: the gateway has not answered ${LINK_DOCUMENT} yet.`
    if (!gatewayLinkOf(doc)) return `${what}: the gateway's answer (${LINK_DOCUMENT}) carries no link — the gateway running predates it; update AIKit and restart its gateway (AIKit).`
    return `${what}: the gateway journaled its frames before it stamped them, so it names no check-in; the next frame names one (AIKit).`
  }
  return Object.fromEntries(Object.keys(LINK_WORDS).filter(key => !(key in values)).map(key => [key, {disabled: why(key)}]))
}

/** The Gateway's rows with a write: the address table's (agentParamAddresses.ts:70-73), each to act:aikit.gateway.agent. Its approvals
 * row is Scope's Tool calls (§19.12; ScopeAsks). */
export interface GatewayRows {
  readonly transport?: SdkParamRow
  readonly connect?: SdkParamRow
  readonly stallAfter?: SdkParamRow
}

const GATEWAY_KEYS: Readonly<Record<string, keyof GatewayRows>> = {transport: 'transport', connect: 'connect', stallAfter: 'stallAfter'}

/** The Gateway's settings AIKit's gateway has no operation for, by the design's key and the row key its refusal names
 * (aikitGatewayOps.ts): they stand disabled with AIKit's missing operation named, and a press is refused with the same words. Connect is
 * AIKit's pause/resume of the binding's connector and stands. */
const GATEWAY_UNCARRIED: Readonly<Record<string, string>> = {transport: 'transport', stallAfter: 'stall-after', autoContinue: 'auto-continue', fanOut: 'fan-out'}
const uncarriedWhy = (rowKey: string): string => harnessKeyUncarried(rowKey)!.reason

/** The Gateway's binding: Connect through its row's own write path (AIKit's pause/resume); the settings AIKit's gateway has no operation
 * for stand disabled and are refused by name; a link reading the gateway's answer does not carry stands absent with why. */
export function gatewayBinding(id: string, input: GatewayInput, rows: GatewayRows, write: RowWrite): DesignBinding {
  const values = gatewayValues(input)
  return {
    id,
    values,
    standing: {...gatewayLinkStanding(input.reading, values),
      ...Object.fromEntries(Object.entries(GATEWAY_UNCARRIED).map(([key, rowKey]) => [key, {disabled: uncarriedWhy(rowKey)}]))},
    writes: key => key in GATEWAY_KEYS || key === 'autoContinue' || key === 'fanOut',
    write: async changes => {
      for (const {key, value} of changes) {
        if (key in GATEWAY_UNCARRIED) throw Error(uncarriedWhy(GATEWAY_UNCARRIED[key]!))
        const rowKey = GATEWAY_KEYS[key]
        if (rowKey) {
          const row = rows[rowKey]
          if (!row?.writePath) throw Error(`${key}: the row is not adopted on this chain, so nothing carries it.`)
          const receipt = await write(row, value)
          if (receipt.kind === 'refused') throw Error(receipt.reason)
          continue
        }
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
  readonly reading: Pick<AgentChainReading, 'attached' | 'budget' | 'gatewayAdmitted' | 'gatewayDoc'>
  readonly accepted: OwnerAcceptedValues
  /** The binding AIKit's gateway names, and whether it named one (chainFromModel, from the World Model's sessions slice: until it has, the
   * binding is only the shell's default and is no reading). */
  readonly harness: {readonly binding: string; readonly resolved: boolean}
  readonly holds: ChainHolds
  /** The session's thread as rows (threadBinding.ts threadRowsOf over AIKit's encounter view — the reading the thread pane draws),
   * JSON; absent while unread. The Thread device reads the same rows (one binding feeds both). */
  readonly thread?: string
  /** The models AIKit's catalogue names (`aikit model-catalogue show --json` entries[].model, the World Model's models slice). */
  readonly models?: readonly string[] | null
  /** The agents that start on this machine, by their census slug (harnessChoices: the World Model's agents slice, O-I ticket 1003):
   * what the Harness chooser offers. Null while the census is not read. */
  readonly harnesses?: readonly string[] | null
  /** The kernel's temporal events (the sessions provider's one read): the session's run as the stage plays it. */
  readonly events?: readonly TemporalEventLike[] | null
  /** AIKit's continuity for the Context page (aikitPages.ts): `aikit work continuity pressure` and `commands`; absent: not read here. */
  readonly context?: {readonly pressure: AikitAnswer; readonly commands: AikitAnswer; readonly turn?: AikitAnswer}
  /** Actuation's usage records of the selected session (`actuation usage list --session S`, the kernel's actuation_read {usage-list}; lane
   * K0): the model the session last reported using, where the gateway names none. Absent: not read here. */
  readonly usage?: AikitAnswer
}

/** The Harness chooser's options: the census's agents that start, by slug (the census is the one list of the agents on this machine,
 * O-I ticket 1003; AIKit adds detail to its rows, never a row). Null while the census is not read; empty where it lists none that
 * starts. Pure. */
export function harnessChoices(census: CensusReading): string[] | null {
  return census.state === 'read' ? census.agents.filter(agent => agent.starts).map(agent => agent.slug) : null
}

/** Why the Harness chooser offers nothing: the census lists no agent that starts here. */
export const AGENT_NO_HARNESS = 'No agent on this computer starts, so there is no harness to choose. Settings › Harnesses & models says why each one does not.'

/** The models AIKit's catalogue names, in its order (`aikit model-catalogue show --json` entries[].model, the World Model's models
 * slice): the Model chooser's choices. A model's availability is the owner's to say. Null when the answer carries no entries. Pure. */
export function catalogueModels(data: unknown): string[] | null {
  const entries = isObj(data) ? data.entries : undefined
  if (!Array.isArray(entries)) return null
  return entries.flatMap(entry => (isObj(entry) && typeof entry.model === 'string' && entry.model ? [entry.model] : []))
}

// ---------------------------------------------------------------------------------------------------------------- the chain's reading

/** An owner's answer as the window's shared readers hold it (owners/readers.ts). */
interface SharedAnswer {readonly status: 'reading' | 'answered' | 'refused'; readonly value?: unknown; readonly error?: string | null}

/** What the Factory chain's declared devices read (inhabitants/agentParamAddresses.ts CHAIN_DECLARATIONS): the World Model's slices they
 * name, where the chain stands, and the two shared answers the World Model does not hold yet — Central's roster (the Skillset rack's) and
 * AIKit's task record of the session (the Agent's turn budget). */
export interface ChainModelInput {
  /** The slices as the window holds them (owners/model.ts useModelSlice), by name: the CHAIN_SLICES names. */
  readonly slices: Readonly<Partial<Record<ModelSliceName, ModelSliceReading>>>
  readonly sessionRef: string | null
  /** The session's register (agent/worldScope.ts): a project's name, or '' for your world's root register. */
  readonly project: string
  /** Why the session names no checkout, in the world scope's words (worldScope.ts gitRepositoryAbsence: no session, or your world's root
   * register); null where it names one. */
  readonly absent: string | null
  readonly roster?: SharedAnswer
  readonly task?: SharedAnswer
  /** The kernel carrier's words when it cannot be reached: every owner is then not reached. */
  readonly unreachable?: string | null
}

/** The chain's reading from the World Model: the reading its devices are built over (agentChainDevices.ts AgentChainReading), the binding
 * the harness controls address, the Harness and Model choosers' choices, AIKit's gateway ecology (Scope's Calls, the Frames), and the
 * session's checkout for the Agent's Context page. */
export interface ChainFromModel {
  readonly reading: AgentChainReading
  /** The binding AIKit's gateway names; until it has (`resolved`), 'cursor' is only the shell's default and nothing writes to it. */
  readonly binding: string
  readonly resolved: boolean
  /** The census's agents that start, by slug (harnessChoices); null while the census is not read. */
  readonly harnesses: string[] | null
  readonly models: string[] | null
  readonly ecology: {readonly status: 'reading' | 'answered' | 'refused'; readonly value: unknown; readonly error: string | null}
  readonly git: AgentGit
}

const GATEWAY_TITLE = 'Gateway · hermes'
/** The parts of the slices the declared fields stand in (world_model.rs `part`: `{state: read, reading}` or `{state: refused, why}`). */
const GATEWAY_PART: ModelField = 'sessions:gateway'
const HARNESS_PART: ModelField = 'sessions:gateway.reading.agent'
const SEATS_PART: ModelField = 'workcells:seats'
const CELLS_PART: ModelField = 'workcells:workcells'
const declared = (device: string, key: string): ModelField => chainDeclaration(device)?.fields[key] ?? `sessions:${key}`

type Part = {readonly state: 'read'; readonly reading: unknown} | {readonly state: 'refused'; readonly why: string}
const partOf = (value: unknown): Part | null => (!isObj(value) ? null
  : value.state === 'read' ? {state: 'read', reading: value.reading}
    : value.state === 'refused' ? {state: 'refused', why: refusalLine(typeof value.why === 'string' ? value.why : null, 'The owner gave no reason.')} : null)
/** A slice as held: still being read, its owner's words (or the kernel's) where it holds no value, or its value. */
function heldSlice(reading: ModelSliceReading | undefined): {state: 'reading'} | {state: 'refused'; why: string} | {state: 'held'; value: unknown} {
  if (!reading || reading.state === 'reading') return {state: 'reading'}
  const held = sliceValue(reading)
  return held.ok ? {state: 'held', value: held.value} : {state: 'refused', why: refusalLine(held.reason, 'The World Model holds no value.')}
}

/** The workcell's seat of a project, from the seat instrument's reading: the one seat of the project, else the one held among several. A
 * project with no seat, or several none of which is the one held, names no checkout, and says why. Pure. */
export function projectSeatOf(status: unknown, project: string): {seat: SeatReading} | {why: string} {
  const seats = parseSeatStatusJson(typeof status === 'string' ? status : JSON.stringify(status ?? null))
  if (!seats) return {why: 'The seat instrument\'s answer is not a seat reading (`workcell seat status`).'}
  const mine = seats.filter(seat => seat.product.toLowerCase() === project.toLowerCase())
  const held = mine.filter(seat => seat.state !== 'free')
  const seat = mine.length === 1 ? mine[0] : held.length === 1 ? held[0] : undefined
  if (seat) return {seat}
  return {why: mine.length
    ? `${mine.length} seats of ${project} stand in the workcells (${mine.map(one => one.workcell).join(', ')}), ${held.length ? `${held.length} of them held` : 'none held'}: Git / landing names no checkout it cannot tell is the session's (\`workcell seat status\`).`
    : `No workcell holds a seat of ${project} (\`workcell seat status\`), so the session's work has no checkout to land from.`}
}

/** The gateway's part of the reading, from the sessions slice's gateway (world_model.rs `gateway`). */
function gatewayOf(sessions: ModelSliceReading | undefined) {
  const slice = heldSlice(sessions)
  const refused = (why: string, receipt: unknown = why) => ({
    gateway: {kind: 'refused' as const, title: GATEWAY_TITLE, line: ownerRefusalLine('gateway', why), receipt: safeJson(receipt)},
    admitted: false, doc: null as unknown, waiting: OWNER_BINDINGS.gateway.owner as string | null,
  })
  if (slice.state === 'reading') {
    return {gateway: INITIAL_READING.gateway, admitted: null, doc: null as unknown, waiting: null as string | null, binding: null, ecology: {status: 'reading' as const, value: null, error: null}}
  }
  if (slice.state === 'refused') return {...refused(slice.why), binding: null, ecology: {status: 'refused' as const, value: null, error: slice.why}}
  const values = {sessions: slice.value}
  const part = partOf(declaredValue(values, GATEWAY_PART))
  if (!part || part.state === 'refused') {
    const why = part?.why ?? 'The World Model\'s sessions slice holds no gateway: the kernel running predates it.'
    return {...refused(why), binding: null, ecology: {status: 'refused' as const, value: null, error: why}}
  }
  const binding = gatewayBindingIn(slice.value)
  const ecology = {status: 'answered' as const, value: declaredValue(values, declared('gateway', 'frames')) ?? null, error: null}
  const harness = partOf(declaredValue(values, HARNESS_PART))
  if (!harness || harness.state === 'refused') return {...refused(harness?.why ?? 'AIKit\'s gateway gave no reading of its binding.'), binding, ecology}
  const doc = harness.reading
  if (isObj(doc) && 'refused' in doc) return {...refused(gatewayLine(doc), doc), binding, ecology}
  return {gateway: {kind: 'reading' as const, title: GATEWAY_TITLE, line: `binding ${binding} · ${gatewayLine(doc)}`, receipt: safeJson(doc)},
    admitted: true, doc, waiting: null as string | null, binding, ecology}
}

/** Git / landing's part of the reading, from the workcells slice: Workcell's status for its line, and the workcell's seat of the session's
 * project for its branch and its files with no commit. No session, or your world's root register, names no checkout (`absent`). */
function landingOf(workcells: ModelSliceReading | undefined, sessionRef: string | null, project: string, absent: string | null) {
  const slice = heldSlice(workcells)
  if (slice.state === 'reading') {
    return {git: INITIAL_READING.git, admitted: null, repo: {}, waiting: null as string | null, seat: null as LandingSeat | null,
      own: {sessionRef, project, repo: null, error: absent} as AgentGit}
  }
  if (slice.state === 'refused') {
    return {git: {kind: 'refused' as const, title: 'Git', line: ownerRefusalLine('workcell', slice.why), receipt: safeJson(slice.why)}, admitted: false, repo: {},
      waiting: OWNER_BINDINGS.workcell.owner as string | null, seat: null as LandingSeat | null, own: {sessionRef, project, repo: null, error: absent ?? slice.why} as AgentGit}
  }
  const values = {workcells: slice.value}
  const cells = partOf(declaredValue(values, CELLS_PART)), seats = partOf(declaredValue(values, SEATS_PART))
  const answered = cells?.state === 'read'
  const ref = declaredValue(values, declared('git', 'workcell'))
  const cellLine = answered ? (typeof ref === 'string' && ref ? `workcell ${ref}` : 'workcell status answered — no workcell_ref disclosed')
    : ownerRefusalLine('workcell', cells?.state === 'refused' ? cells.why : 'Workcell status unavailable')
  const found = absent ? {why: absent} : seats?.state === 'read' ? projectSeatOf(declaredValue(values, declared('git', 'branch')), project)
    : {why: seats?.state === 'refused' ? seats.why : 'The seat instrument has not answered (`workcell seat status`).'}
  const seat = 'seat' in found ? found.seat : null
  const why = 'why' in found ? found.why : null
  const uncommitted = seat && seat.dirty != null && seat.untracked != null ? seat.dirty + seat.untracked : undefined
  const repo = seat ? {...(seat.branch ? {branch: seat.branch} : {}), ...(uncommitted !== undefined ? {uncommitted} : {}),
    ...(seat.ahead != null ? {ahead: seat.ahead} : {}), ...(seat.behind != null ? {behind: seat.behind} : {})} : {}
  const seatLine = seat ? `seat ${seat.workcell}/${seat.product}${seat.branch ? ` on ${seat.branch}` : ''}` : why ?? ''
  return {
    git: {kind: answered && seat ? 'reading' as const : 'refused' as const, title: 'Git', line: `${cellLine} · ${seatLine}`,
      receipt: safeJson({workcell: cells ?? null, seat: seat ?? why})},
    admitted: answered, repo, waiting: answered ? null : OWNER_BINDINGS.workcell.owner as string | null,
    // The seat Land lands from (workcellBindings.ts gitBinding): Workcell's landing Actions name it by its workcell and product.
    seat: seat ? {workcell: seat.workcell, product: seat.product, held: seat.state !== 'free'} as LandingSeat : null,
    own: {sessionRef, project, repo: seat ? repo : null, error: seat ? null : why} as AgentGit,
  }
}

/** The session's checkout as the Agent's Context page reads it (oneAgentBinding.ts AgentGit): the workcell's seat of its project, from the
 * World Model's workcells slice, or why it names none. Pure. */
export function sessionGitOf(workcells: ModelSliceReading | undefined, sessionRef: string | null, project: string, absent: string | null): AgentGit {
  return landingOf(workcells, sessionRef, project, absent).own
}

/** The chain's reading from the World Model's slices its declared devices read, and the two shared answers it does not hold yet. Pure. */
export function chainFromModel(input: ChainModelInput): ChainFromModel {
  const {slices, sessionRef, project, absent, roster, task, unreachable} = input
  const harnesses = harnessChoices(censusOf(slices.agents ?? {state: 'reading'}))
  const catalogue = heldSlice(slices.models)
  const models = catalogue.state === 'held' ? catalogueModels(catalogue.value) : null
  if (unreachable) {
    return {
      reading: {
        ...INITIAL_READING,
        gateway: {kind: 'refused', title: GATEWAY_TITLE, line: ownerRefusalLine('gateway', unreachable, 'not-reached'), receipt: null},
        gatewayAdmitted: false, gatewayDoc: null, gitAdmitted: false,
        git: {kind: 'refused', title: 'Git', line: ownerRefusalLine('workcell', unreachable, 'not-reached'), receipt: null},
        chains: [], skillsNote: ownerRefusalLine('roster', unreachable, 'not-reached'),
        waitingOn: {gateway: OWNER_BINDINGS.gateway.owner, skillset: OWNER_BINDINGS.roster.owner, git: OWNER_BINDINGS.workcell.owner},
      },
      binding: 'cursor', resolved: false, harnesses, models,
      ecology: {status: 'refused', value: null, error: unreachable}, git: {sessionRef, project, repo: null, error: absent ?? unreachable},
    }
  }
  const gateway = gatewayOf(slices.sessions)
  const landing = landingOf(slices.workcells, sessionRef, project, absent)
  const reading: AgentChainReading = {
    ...INITIAL_READING,
    gateway: gateway.gateway, gatewayAdmitted: gateway.admitted, gatewayDoc: gateway.doc,
    git: landing.git, gitAdmitted: landing.admitted, gitRepo: landing.repo, gitSeat: landing.seat,
    waitingOn: {gateway: gateway.waiting, skillset: null, git: landing.waiting},
  }
  // The roster: the shared answer of the root register.
  if (roster?.status === 'refused') {
    Object.assign(reading, {chains: [], skillsNote: ownerRefusalLine('roster', refusalLine(roster.error ?? undefined, 'Roster reading unavailable')), identity: null})
    reading.waitingOn.skillset = OWNER_BINDINGS.roster.owner
  } else if (roster?.status === 'answered') {
    const admits = rosterAdmits(roster.value)
    Object.assign(reading, {
      chains: rosterChains(roster.value),
      skillsNote: admits > 0 ? `${admits} accepted agent${admits === 1 ? '' : 's'} with skill refs disclosed.` : `No accepted agents with skill refs disclosed yet — ${SKILLSETS_ARRIVE}.`,
      identity: rosterIdentity(roster.value),
    })
    reading.waitingOn.skillset = admits > 0 ? null : OWNER_BINDINGS.skillset.owner
  }
  // The selected session's task record: a refusal or an empty answer says nothing about the agent, so it leaves the light dark rather
  // than off; another session's record is not this one's (the shared answer is keyed by session).
  if (sessionRef && task?.status === 'answered' && task.value) {
    const read = taskReading(task.value)
    reading.budget = read.used !== undefined || read.cap !== undefined ? {used: read.used, cap: read.cap} : null
    reading.attached = true
  }
  return {reading, binding: gateway.binding ?? 'cursor', resolved: gateway.binding !== null, harnesses, models, ecology: gateway.ecology, git: landing.own}
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

/** The model each session last reported using, from one listing of Actuation's usage records over every session
 * (`actuation usage list --json`, actuation.usage-listing/v1): the last record of a session that names a model. Pure. */
export function lastUsageModels(listing: unknown): ReadonlyMap<string, string> {
  const models = new Map<string, string>()
  if (!isObj(listing) || listing.schema !== 'actuation.usage-listing/v1' || !Array.isArray(listing.records)) return models
  for (const record of listing.records) {
    const model = isObj(record) && isObj(record.usage) && isObj(record.usage.model) ? record.usage.model : null
    if (model && typeof model.name === 'string' && model.name && typeof record.agent_session_ref === 'string') models.set(record.agent_session_ref, model.name)
  }
  return models
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
    ...('ctx.armed' in values ? {} : {'ctx.armed': why(context?.commands, 'ctx.armed')}),
    ...('ctx.git' in values ? {} : {'ctx.git': AGENT_CONTEXT_ABSENT['ctx.git']!, 'ctx.diff': AGENT_DIFF_ABSENT})}
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
  }
  // The composer is the shell's own: its text while you type, and the last line an owner accepted from it — absent until then
  // (design.ts:8-10: an absent key stays absent). Nobody reports a holder of Effort, so effortHeld is absent too; a holder the
  // shell learns of stands in the binding's heldBy.
  put(values, 'draft', held.composer.draft)
  put(values, 'sent', held.composer.sent)
  // The owners' lists the choosers and the well draw (the design's `thread`, `models` and `harnesses`, actuation__harness-model.tsx:
  // 20-21): each the owner's own, or absent. The harnesses are the census's agents that start (harnessChoices).
  if (sessionRef != null) put(values, 'thread', input.thread)
  if (input.models) values.models = JSON.stringify(input.models)
  if (input.harnesses) values.harnesses = JSON.stringify(input.harnesses)
  return values
}

/** The rows an Agent change goes through: the address table's (agentParamAddresses.ts — effort, input, heartbeat) and the declared
 * P0 rows (AGENT_P0_ROWS below — interrupt-quantize, steer-line, new-task), each with its own write path. */
export interface AgentRows {
  /** The binding's harness model (AIKit's `gateway agent model --model ID`, the address table's model row). */
  readonly model?: SdkParamRow
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
  steerLine: {family: 'actuation', deviceInstance: 'agent', key: 'steer-line', title: 'Steer line', type: 'string', writePath: 'act:aikit.gateway.agent'},
  newTask: {family: 'software-factory', deviceInstance: 'agent', key: 'new-task', title: 'New task', type: 'string', writePath: 'act:aikit.gateway.agent'},
}

/** The Agent's Autonomy, retired (DLW §19.4: the Agent's pages are Run, Identity and Type, its macros Model, Effort, Budget and Input;
 * §19.12 Asks: Tool calls is "the answer to the harness's request to use a tool"): what took its place, for a press that still names it. */
export const AGENT_AUTONOMY_RETIRED = 'Autonomy is retired: Scope\'s Tool calls, on its Asks page, answers the harness\'s request to use a tool — Ask, Session or Always — and a task\'s Envelopes set it for that task.'

// `autonomy` is taken only to be refused in words (AGENT_AUTONOMY_RETIRED): a preset or a hold from before may still name it.
const AGENT_WRITES = new Set(['model', 'effort', 'input', 'heartbeat', 'quantize', 'draft', 'sent', 'light', 'cap', 'autonomy'])

/** The Agent's settings AIKit's gateway has no operation for, by the design's key and the row key its refusal names (aikitGatewayOps.ts):
 * Effort, Input and Interrupt timing, and the composer's words (a steer line into the running turn, or a queued task's words — AIKit's
 * `new` carries none). They stand disabled with AIKit's missing operation named. */
const AGENT_UNCARRIED: Readonly<Record<string, string>> = {effort: 'effort', input: 'input', quantize: 'interrupt-quantize'}
export const AGENT_SEND_UNCARRIED = `Send: AIKit's gateway carries no words into a binding's conversation — ${harnessKeyUncarried('steer-line')!.reason} ${harnessKeyUncarried('new-task')!.reason}`

/** The Agent's binding: its values, and each change through its row's own write path (or held, for the composer's text). */
/** Why the Agent stands in no run state: no session is selected, or its task, needle and thread say none (runFaces.ts runStateOfSession). */
/** Where no agent session is seated (a fresh world, before any agent has run), a message has nowhere to go: the composer says so
 * instead of taking the words and losing them (the DLW map, 12 Nov empty-start walk). */
export const AGENT_NO_SESSION = 'No agent is running in this world yet, so a message has nowhere to go. Start one first.'
export const RUN_UNREAD = 'The run state is a reading: no session is selected, or its task, its needle and its thread (runFaces.ts) stand it in none yet.'

// `_steering` (whether the shell steers) chose the composer's route while AIKit's gateway was assumed to carry words; it carries none, so
// nothing reads it now. The parameter stays for the chain's call.
export function agentBinding(id: string, input: AgentInput, rows: AgentRows, write: RowWrite, _steering: () => boolean): DesignBinding {
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
    standing: {...disabled(contextStanding(input.context, values)), ...disabled(REFUSED_WRITES[AGENT_DESIGN]!), ...('run' in values ? {} : {run: {disabled: RUN_UNREAD}}),
      autonomy: {disabled: AGENT_AUTONOMY_RETIRED},
      ...Object.fromEntries(Object.entries(AGENT_UNCARRIED).map(([key, rowKey]) => [key, {disabled: harnessKeyUncarried(rowKey)!.reason}])),
      sent: {disabled: input.sessionRef == null ? AGENT_NO_SESSION : AGENT_SEND_UNCARRIED},
      // A census that lists no agent that starts leaves the chooser nothing to offer: it says so instead of drawing an empty list.
      ...(input.harnesses?.length === 0 ? {harness: {disabled: AGENT_NO_HARNESS}} : {}),
      ...(rows.model?.writePath ? {} : {model: {disabled: 'Model: the row is not adopted on this chain, so nothing carries it.'}})},
    writes: key => AGENT_WRITES.has(key),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        // What AIKit's gateway has no operation for is refused here, in the words its control stands disabled with, and nothing is sent.
        if (key in AGENT_UNCARRIED) throw Error(harnessKeyUncarried(AGENT_UNCARRIED[key]!)!.reason)
        switch (key) {
          case 'model': await through(rows.model, 'Model', value); break
          case 'heartbeat': await through(rows.heartbeat, 'Heartbeat', value); break
          case 'draft': updateHolds(was => ({...was, composer: {...was.composer, draft: String(value)}})); break
          case 'sent': {
            // Steer would be a steer line into the turn that runs, Queue a new task's words: AIKit's gateway carries neither
            // (AGENT_SEND_UNCARRIED), so the words stay in the draft and nothing is sent.
            if (!String(value).trim()) break
            throw Error(input.sessionRef == null ? AGENT_NO_SESSION : AGENT_SEND_UNCARRIED)
          }
          case 'light': throw Error(REFUSE.power)
          case 'cap': throw Error(REFUSE.budget)
          case 'autonomy': throw Error(AGENT_AUTONOMY_RETIRED)
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
  /** The seated session's practice (`aikit praxis activity --session`, aikit.praxis-session/v1), absent while not read. */
  readonly activity?: unknown
  /** What AIKit refused of the reading, by part (useRackReading.ts: `set:<name>` for a carried set it would not show). */
  readonly refused?: Readonly<Record<string, string>>
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

/** What the seated session did with its practice, as AIKit's development entry keeps it (aikit.praxis-session/v1, O-I 745): what it
 * loaded and invoked from its own tool events, and — once its ticket's close named them — what it relied on. Null where AIKit keeps
 * no record of the session (unrecorded) or was not read. */
interface SessionPractice {readonly loaded: ReadonlySet<string>; readonly invoked: ReadonlySet<string>; readonly relied: ReadonlySet<string> | null}
function sessionPractice(reading: unknown): SessionPractice | null {
  if (!isObj(reading) || reading.schema !== 'aikit.praxis-session/v1' || !isObj(reading.activity)) return null
  if (reading.standing !== 'open' && reading.standing !== 'closed') return null
  const activity = reading.activity
  return {loaded: new Set(strings(activity.loaded)), invoked: new Set(strings(activity.invoked)),
    relied: reading.standing === 'closed' ? new Set(strings(activity.relied_upon)) : null}
}

/** One member, from what the owners report of it. The ladder lights only what was observed: carried (a set or the profile holds
 * it), catalogued (AIKit's catalogue lists it), available (it projects here, or AIKit withholds it with a reason), and from the
 * seated session's record (`aikit praxis activity`): loaded and invoked, yes or no, while the session is recorded; relied on once
 * its close named what it relied on. Selected, projected into a harness, succeeded and verified no kernel operation reports, so
 * they stay hollow — not observed, never inferred upward. */
function member(ref: string, row: CatalogueRow | undefined, available: boolean | null, withheld: string | null, practice: SessionPractice | null = null): Member {
  const form = row ? formOf(row.description) : 'skill'
  const rungs: Rung[] = [true, row ? true : false, available, null, null,
    practice ? practice.loaded.has(ref) : null, practice ? practice.invoked.has(ref) : null, practice?.relied ? practice.relied.has(ref) : null,
    null, null]
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
export function rackMembers(input: Pick<RackInput, 'profile' | 'sets' | 'setList' | 'skills' | 'activity'>): Member[] | null {
  if (!input.profile) return null
  const rows = catalogue(input.skills)
  const practice = sessionPractice(input.activity)
  const out = new Map<string, Member>()
  const sizes = new Map<string, number>()
  if (isObj(input.setList) && Array.isArray(input.setList.sets)) {
    for (const set of input.setList.sets) if (isObj(set) && typeof set.name === 'string' && typeof set.members === 'number') sizes.set(set.name, set.members)
  }
  for (const ref of strings(input.profile.skill_set_refs)) {
    const reply = input.sets[setName(ref)]
    if (!isObj(reply)) continue
    // Each member stands under the set that holds it (round 869), set by set in the profile's order.
    const set = setName(ref)
    for (const cap of strings(reply.projected)) if (!out.has(cap)) out.set(cap, {...member(cap, rows.get(cap), true, null, practice), set})
    for (const held of Array.isArray(reply.withheld) ? reply.withheld : []) {
      if (!isObj(held) || typeof held.capability !== 'string') continue
      out.set(held.capability, {...member(held.capability, rows.get(held.capability), false, typeof held.reason === 'string' ? held.reason : 'Withheld.', practice), set})
    }
    for (const child of strings(reply.child_refs)) {
      const name = setName(child)
      out.set(child, {id: child, name, form: 'skillset', rev: '', says: '', rungs: [true, sizes.has(name), null, null, null, null, null, null, null, null],
        ...(sizes.has(name) ? {holds: sizes.get(name)!} : {}), set})
    }
  }
  for (const ref of strings(input.profile.skill_refs)) {
    if (out.has(ref)) continue
    const row = rows.get(ref)
    out.set(ref, member(ref, row, row ? row.eligible : null, row && row.eligible === false ? row.reason ?? 'Not eligible here.' : null, practice))
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

/** One SkillSet the agent carries, as the rack draws it: its name, and what AIKit says of it (how many members, its revision), or
 * AIKit's words for why it would not show it. */
export interface CarriedSet {readonly name: string; readonly members?: number; readonly revision?: string; readonly why?: string}
/** Every SkillSet the agent carries, in the order Central keeps on its profile (round 869): the rack draws each, not only the first. Pure. */
function carriedSets(input: Pick<RackInput, 'sets' | 'refused'>, refs: readonly string[]): CarriedSet[] {
  return refs.map(ref => {
    const name = setName(ref), reply = input.sets[name], why = input.refused?.[`set:${name}`]
    if (!isObj(reply)) return {name, ...(why ? {why} : {})}
    return {name, ...(typeof reply.members === 'number' ? {members: reply.members} : {}), ...(typeof reply.revision === 'string' ? {revision: reply.revision} : {})}
  })
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
    values.carried = JSON.stringify(carriedSets(input, sets))
  }
  put(values, 'scope', input.holds.compose.scope)
  put(values, 'profile', input.holds.compose.profile ?? profileOf(input.profiles))
  put(values, 'target', input.holds.compose.target)
  values.compose = composeState(input.holds)
  return values
}

/** The configuration plane's scope for each of the rack's (§19.6 Scope: Home · Project · Session). `project` is the session's register
 * (agent/worldScope.ts): your world's root register ('') has no Project scope, so none stands for it. */
export function planeScope(scope: ComposeScope, project: string, sessionRef: string | null): ConfigRequestWire['scope'] | null {
  if (scope === 'home') return {scope_kind: 'machine', scope_ref: null}
  if (scope === 'project') return project ? {scope_kind: 'project', scope_ref: project} : null
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
// The upkeep pages (lanes W7, W8; D5): AIKit's instrument's Run (its Unused filter), Sources, Adopt, Package and Procedures (§19.26,
// ai-kit__ai-kit.tsx), which the rack drew before and the rack's binding still carries: AIKit's `unused`, `collate`,
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
  /** Central's agent-profile.chain-order on the seated agent's profile: every SkillSet ref it carries, in the new order (Central PR 318).
   * Absent: no carrier stands, or no profile is read to write at. */
  readonly reorder?: (skillSetRefs: readonly string[]) => Promise<unknown>
}

/** Why the order of the sets cannot change now, in words that name Central's act (round 869). */
export const RACK_ORDER_REFUSE = {
  unread: 'Order: no profile of this session\'s agent is read here, so no SkillSet stands on the chain to order.',
  one: 'Order: the agent carries one SkillSet, so there is no order to change. Central keeps the order of two or more (agent-profile.chain-order).',
  noCarrier: 'Order: the kernel carrier is unavailable here, so Central cannot be asked (agent-profile.chain-order). The sets stand in the order Central returns.',
  each: 'Order: a new order holds every SkillSet the agent carries, each once.',
} as const

/** AIKit's plan (settings/aikitAdoption.ts, the reading Setup adopts by) as the design reads it ({root, namespace, digest, items}): the root
 * chosen the plan was read for, the review digest Apply presses (`aikit adopt --expect-digest` confirms it; the Procedure's own `digest` is
 * not it), and a line for each capsule it adopts. AIKit refuses a plan whole, so every item adopts. Pure. */
export function adoptionOf(plan: AikitAdoptionPlan, root: string): Record<string, unknown> {
  const prefix = `skill/${plan.namespace}/`
  return {root, namespace: plan.namespace, digest: plan.reviewDigest,
    items: plan.capsules.map(capsule => ({name: capsule.startsWith(prefix) ? capsule.slice(prefix.length) : capsule, act: 'adopt'}))}
}

/** The upkeep pages' settings: the hand's own holds (ai-kit__ai-kit.tsx: unusedOnly, source, adoptRoot, namespace, procedure, bypassScope,
 * bypassReason), and Export's directory (outDir, the absolute --out of `aikit set package export`). */
export const RACK_UPKEEP_SETTINGS: readonly string[] = ['unusedOnly', 'source', 'adoptRoot', 'namespace', 'procedure', 'bypassScope', 'bypassReason', 'outDir']

const RACK_WRITES = (key: string) => key.startsWith('req:') || ['scope', 'profile', 'compose', 'target', 'exported', 'set', 'members', 'adoptPreview', 'order'].includes(key)
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
  // The design names a root by AIKit's label (collate's where[].root, `@claude`); `aikit adopt` takes its path. The hold is the path the
  // chain asks the plan for, shown by its label.
  const rootPath = (value: Value | undefined) => (typeof value === 'string' ? (roots?.find(row => row.root === value && typeof row.path === 'string')?.path as string | undefined) ?? value : undefined)
  const rootLabel = (path: string) => (roots?.find(row => row.path === path && typeof row.root === 'string')?.root as string | undefined) ?? path
  if (typeof view.adoptRoot === 'string') values.adoptRoot = rootLabel(view.adoptRoot)
  const plan = read(upkeep.adoption, aikitAdoptionPlan)
  const listed = read(upkeep.procedures, proceduresOf), adoption = plan ? adoptionOf(plan, typeof values.adoptRoot === 'string' ? values.adoptRoot : rootLabel(plan.source)) : null
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
  // Export: the set on the chain, the target you chose and the directory you named (Into), through AIKit's set-package-export.
  const outDir = typeof view.outDir === 'string' ? view.outDir : ''
  const exportWhy = !upkeep.write ? noCarrier : typeof values.set !== 'string' ? 'Export: no set stands on the chain to package.'
    : !outDir.startsWith('/') ? REFUSE.export : null
  if (exportWhy) standing.exported = {disabled: exportWhy}
  // Order: the sets the agent carries, moved through Central's chain-order with every ref as the profile carries it (round 869).
  const carriedRefs = input.profile ? strings(input.profile.skill_set_refs) : []
  const orderWhy = !input.profile ? RACK_ORDER_REFUSE.unread : carriedRefs.length < 2 ? RACK_ORDER_REFUSE.one : !upkeep.reorder ? RACK_ORDER_REFUSE.noCarrier : null
  if (orderWhy) standing.order = {disabled: orderWhy}
  /** The refs in the order the names give, each the profile's own ref, or the words for why not. */
  const orderRefs = (value: Value | undefined): string[] => {
    let names: unknown
    try { names = typeof value === 'string' ? JSON.parse(value) : null } catch { names = null }
    const given = Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string') : []
    const refs = given.map(name => carriedRefs.find(ref => setName(ref) === name))
    if (!Array.isArray(names) || given.length !== names.length || refs.length !== carriedRefs.length || new Set(refs).size !== refs.length || refs.some(ref => !ref)) {
      throw Error(RACK_ORDER_REFUSE.each)
    }
    return refs as string[]
  }
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
      case 'adoptApply':
        // Apply only the plan you reviewed: the digest pressed is the review digest of the plan read, confirmed on the root AIKit surveyed.
        if (!plan || !adoption || plan.reviewDigest !== value) throw Error('Apply: the plan changed since you reviewed it, or names no digest; read it again with Preview.')
        return aikitAdoptRequest(plan)
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
    local: Object.fromEntries(RACK_UPKEEP_SETTINGS.map(key => [key, (value: Value | undefined) => holdView(id, key, key === 'adoptRoot' ? rootPath(value) : value)])),
    writes: RACK_WRITES,
    write: async changes => {
      for (const change of changes) {
        if (await compose(change, ports, place)) continue
        if (change.key in RACK_UPKEEP_WRITES) { await upkeepWrite(change.key, change.value); continue }
        switch (change.key) {
          // The package target is your choice for the next export, held here; Export itself has no carrier.
          case 'target': updateHolds(was => ({...was, compose: {...was.compose, target: String(change.value)}})); break
          // Preview: the root chosen, whose plan the chain then reads (a reading, never a write).
          case 'adoptPreview': holdView(id, 'adoptRoot', typeof change.value === 'string' && change.value ? rootPath(change.value) : undefined); break
          case 'exported': {
            // AIKit's own export (`aikit set package export <set> --target <t> --out <dir>`), its refusal in AIKit's words.
            if (exportWhy) throw Error(exportWhy)
            const target = String(change.value ?? '')
            if (!['openai', 'codex', 'claude', 'pi'].includes(target)) throw Error('Export: choose the harness to package the set for.')
            await upkeep.write!({kind: 'set-package-export', ...(place.project ? {project: place.project} : {}), set: values.set as string, target, out: outDir})
            break
          }
          case 'set': throw Error(REFUSE.set)
          case 'order': {
            if (orderWhy) throw Error(orderWhy)
            await upkeep.reorder!(orderRefs(change.value))
            break
          }
          default: throw Error(RACK_UPKEEP_REFUSE[change.key] ?? REFUSE.reading(change.key))
        }
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Refining page
// The Skillset rack's Refining page (manual §19.7 "Refining a skill"; skills.tsx `refine.` keys, carried under the rack by
// oneAgentBinding.ts REFINE_PAGE). AIKit keeps a proposed revision where it keeps the member's revisions — a snapshot of the member's own
// source beside the snapshot in use (`aikit source refine list|accept|discard`, the kernel's aikit_read refinement-list and aikit_write
// refinement-accept · refinement-discard) — with the closes that showed its reason (Why) and the takes that ran under it (Test). The Test
// is the session's own Repeat over Skillset (sessionSettings.ts testRefinement, the same runner as Launch): its levels the set with the
// proposed revision in it beside the set as it stands, which AIKit's take body carries into each take's World and reads back. Accept keeps
// the proposal as the member's next revision (History's Rollback takes it back); Discard drops it. Member is the hand's own hold.

/** One proposed revision as AIKit lists it (ai-kit skill_sources.rs Refinement). */
export interface Refinement {
  readonly member: string
  readonly source: string
  /** Who keeps the member's source: AIKit, or Central (a Control skill: AIKit's Accept hands its revision to Central). */
  readonly owner: 'aikit' | 'central'
  /** Where a Control skill's revision waits once AIKit handed it to Central (ai-kit skill_sources.rs HandedToCentral); null before. */
  readonly handed: HandedRevision | null
  readonly why: readonly {readonly task: string; readonly reason: string}[]
  readonly proposed: {readonly snapshot: string; readonly revision: string}
  readonly inUse: {readonly snapshot: string; readonly revision: string} | null
  /** The source moved on since the proposal was drafted against it. */
  readonly stale: boolean
  readonly proposedAt: number | null
  /** The takes that ran under the proposed revision, the takes of their Repeat beside them, and what each of those takes answered to the
   * task's Success conditions, by its trace (ai-kit skill_sources.rs RefinementTest `answers`). */
  readonly tests: readonly {readonly trace: string; readonly beside: readonly string[]; readonly answers: Readonly<Record<string, readonly TakeAnswer[]>>}[]
}

/** A Control skill's revision as Central keeps it beside the skill in use (ctrl control_skills.rs, `control.skills.revision.propose`):
 * its ref, the digest the person reviews, the skill by its scope and name, and the act that writes it (the person's Accept there). */
export interface HandedRevision {
  readonly revisionRef: string
  readonly proposedDigest: string
  readonly scope: string
  readonly name: string
  readonly acceptAction: string
}

/** AIKit's record of a hand to Central, or null where it is not one. Pure. */
function handedOf(value: unknown): HandedRevision | null {
  if (!isObj(value)) return null
  const {revision_ref: revisionRef, proposed_digest: proposedDigest, scope, name, accept_action: acceptAction} = value
  return typeof revisionRef === 'string' && typeof proposedDigest === 'string' && typeof scope === 'string' && typeof name === 'string'
    && typeof acceptAction === 'string' ? {revisionRef, proposedDigest, scope, name, acceptAction} : null
}

/** One take's answer to one of the task's Success conditions, as Actuation held it to its evidence (ai-kit RefinementAnswer). */
export interface TakeAnswer {
  readonly condition: string
  readonly answer: 'met' | 'not met' | 'open'
  readonly evidence: readonly string[]
  readonly why: string | null
}
const ANSWER_WORDS: readonly TakeAnswer['answer'][] = ['met', 'not met', 'open']

/** The answers AIKit keeps with a Test, by trace; what is not an answer in its shape is left out. Pure. */
function answersOf(value: unknown): Record<string, TakeAnswer[]> {
  if (!isObj(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, rows]) => Array.isArray(rows)).map(([trace, rows]) => [trace,
    (rows as unknown[]).filter(isObj).flatMap((row): TakeAnswer[] => typeof row.condition === 'string'
      && ANSWER_WORDS.includes(row.answer as TakeAnswer['answer'])
      ? [{condition: row.condition, answer: row.answer as TakeAnswer['answer'], evidence: strings(row.evidence),
        why: typeof row.why === 'string' ? row.why : null}] : [])]))
}

/** Central as the keeper of a member's source, in AIKit's listing (`owner`): an owner's name, not the shell's Central mode. */
const CENTRAL_SOURCE = 'central' as const

const revisionAt = (value: unknown): {snapshot: string; revision: string} | null =>
  (isObj(value) && typeof value.snapshot === 'string' && typeof value.revision === 'string' ? {snapshot: value.snapshot, revision: value.revision} : null)

/** AIKit's proposals (`aikit source refine list`: {proposals}), or null where the answer is not that listing. Pure. */
export function refinementsOf(value: unknown): Refinement[] | null {
  if (!isObj(value) || !Array.isArray(value.proposals)) return null
  const rows: Refinement[] = []
  for (const row of value.proposals) {
    if (!isObj(row) || typeof row.member !== 'string' || typeof row.source !== 'string') continue
    const proposed = revisionAt(row.proposed)
    if (!proposed) continue
    rows.push({member: row.member, source: row.source, owner: row.owner === CENTRAL_SOURCE ? CENTRAL_SOURCE : 'aikit', handed: handedOf(row.handed),
      why: (Array.isArray(row.why) ? row.why : []).filter(isObj).filter(item => typeof item.reason === 'string')
        .map(item => ({task: typeof item.task_ref === 'string' ? item.task_ref : '', reason: item.reason as string})),
      proposed, inUse: revisionAt(row.in_use), stale: row.stale === true,
      proposedAt: typeof row.proposed_at_unix_seconds === 'number' ? row.proposed_at_unix_seconds : null,
      tests: (Array.isArray(row.tests) ? row.tests : []).filter(isObj).filter(item => typeof item.trace === 'string')
        .map(item => ({trace: item.trace as string, beside: strings(item.beside), answers: answersOf(item.answers)}))})
  }
  return rows
}

/** Why a proposal's Result reads as it does (§19.7: "A proposal whose test did not run, or whose takes did not answer a condition that the
 * revision touches, shows Open"). */
export const RESULT_WHY = {
  untested: 'Open: no take has run under the proposed revision yet. Press Test to run the task\'s own Repeat over Skillset — the set with '
    + 'the proposed revision in it, beside the set as it stands.',
  // REPLACED (O-I 795, round 13): "AIKit hands Actuation a task with no Success conditions, and nothing reads a take against one".
  noConditions: 'Open: the takes ran while the task had no Success conditions, so none was read against one. Add them in the task\'s '
    + 'Intent panel (Clip view), then press Test again: each take answers each one.',
  answered: (takes: number) => `What ${takes} take${takes === 1 ? '' : 's'} answered to the task's Success conditions, each held to its `
    + 'evidence by Actuation: across a level\'s takes, not met if one is not met, open if one is open, met when all are met.',
} as const

/** The takes that ran under the proposed revision, beside the takes of the same Repeat that ran under the revision in use. Pure. */
export function refinementTakes(refinement: Refinement): {trace: string; level: 'proposed' | 'in use'}[] {
  const proposed = new Set(refinement.tests.map(test => test.trace))
  const inUse = [...new Set(refinement.tests.flatMap(test => test.beside))].filter(trace => !proposed.has(trace))
  return [...[...proposed].map(trace => ({trace, level: 'proposed' as const})), ...inUse.map(trace => ({trace, level: 'in use' as const}))]
}

type Outcome = TakeAnswer['answer']
/** Across a level's takes, Return's rule (§19.1 The Intent panel): not met if one is not met, open if one is open, met when all are met. */
const across = (answers: readonly Outcome[]): Outcome =>
  answers.includes('not met') ? 'not met' : answers.length && answers.every(answer => answer === 'met') ? 'met' : 'open'

export interface ResultRow {
  readonly task: string
  readonly condition: string
  readonly proposed: Outcome
  readonly inUse: Outcome
  /** The evidence each level's takes named, in words. */
  readonly evidence?: string
  /** Why an Open row reads Open, in the reading's words. */
  readonly why?: string
}

/** Result for each of the task's Success conditions at each level — Met · Not met · Open — from what each take answered (the Test's
 * answers, by trace): the takes under the proposed revision, beside the takes of the same Repeat under the revision in use. A take that
 * answered nothing to a condition stands Open for it. Where no take answered any, each close's reason in Why stands Open, saying why.
 * Pure. */
export function refinementResult(refinement: Refinement): {rows: ResultRow[]; why: string} {
  const levels = refinementTakes(refinement)
  const answers: Record<string, readonly TakeAnswer[]> = Object.assign({}, ...refinement.tests.map(test => test.answers))
  const conditions = [...new Set(levels.flatMap(take => (answers[take.trace] ?? []).map(answer => answer.condition)))]
  if (!conditions.length) {
    const rows = refinement.why.map(item => ({task: item.task, condition: item.reason, proposed: 'open' as const, inUse: 'open' as const}))
    return {rows, why: refinement.tests.length ? RESULT_WHY.noConditions : RESULT_WHY.untested}
  }
  const answered = levels.filter(take => answers[take.trace]?.length)
  const rows = conditions.map((condition): ResultRow => {
    const at = (level: 'proposed' | 'in use') => levels.filter(take => take.level === level)
      .map(take => answers[take.trace]?.find(answer => answer.condition === condition) ?? null)
    const proposed = at('proposed'), inUse = at('in use')
    const outcome = (found: (TakeAnswer | null)[]) => across(found.map(answer => answer?.answer ?? 'open'))
    const named = (found: (TakeAnswer | null)[]) => [...new Set(found.flatMap(answer => answer?.evidence ?? []))].join(', ')
    const evidence = [named(proposed) && `proposed: ${named(proposed)}`, named(inUse) && `in use: ${named(inUse)}`].filter(Boolean).join(' · ')
    const open = [...proposed, ...inUse].find(answer => answer?.answer === 'open' && answer.why)
    const row: ResultRow = {task: '', condition, proposed: outcome(proposed), inUse: outcome(inUse), ...(evidence ? {evidence} : {})}
    return open?.why ? {...row, why: open.why} : row
  })
  return {rows, why: RESULT_WHY.answered(answered.length)}
}

/** The AIKit acts of a refinement (aikit_write), each on the member chosen. Follow picks up what the person's Accept wrote in Central:
 * AIKit syncs the member's source from Central and promotes it, with a receipt (`aikit source refine follow`, O-I 795 round 14). */
export const REFINE_WRITES: Readonly<Record<'accept' | 'discard' | 'follow', string>> = {accept: 'refinement-accept', discard: 'refinement-discard',
  follow: 'refinement-follow'}

/** Central's own acts on a revision it keeps, the person's presses (ownerRoutes.ts centralRevisionWrite): the revision as AIKit handed it. */
export type CentralRevisionHand = (verb: 'accept' | 'discard', handed: HandedRevision) => Promise<unknown>

/** Why Accept or Discard cannot reach Central for a revision that waits there: no hand carries the person's act to it here. */
const centralUnwired = (verb: 'accept' | 'discard', refinement: Refinement, handed: HandedRevision) =>
  `${verb === 'accept' ? 'Accept' : 'Discard'}: the revision of ${refinement.member} waits in Central (${handed.revisionRef}) for your `
  + `${verb === 'accept' ? 'Accept' : 'Discard'} there (control.skills.revision.${verb}), and no hand carries it to Central here.`

/** Why Accept stands refused for a proposal, or null where its owner can be asked. Shared with Approvals' answer. A Control skill's
 * revision is Central's: AIKit's Accept hands it there, and once it waits there, Accept is the person's own act in Central. */
export function refinementAcceptWhy(refinement: Refinement, hands: {readonly central?: boolean} = {}): string | null {
  // REPLACED (O-I 795 round 13): "missing op: AIKit handing its proposed revision to Central's control.skills.revision.propose (AIKit)" —
  // AIKit's Accept hands it now (ai-kit skill_sources.rs accept_revision), and Central keeps it beside the skill in use.
  const handed = refinement.owner === CENTRAL_SOURCE ? refinement.handed : null
  if (handed) return hands.central ? null : centralUnwired('accept', refinement, handed)
  // The person's one Accept hands it, writes it in Central and has AIKit follow (O-I 795 round 14): with no hand to Central, it would stop
  // half way, so it is not asked.
  if (refinement.owner === CENTRAL_SOURCE && !hands.central) {
    return `Accept: Central keeps ${refinement.member}, a Control skill: your Accept hands its revision to Central and writes it there `
      + '(control.skills.revision.accept), and no hand carries it to Central here.'
  }
  if (refinement.stale) return `Accept: the revision of ${refinement.member} this was drafted against is no longer in use (its source moved on since); Discard it and propose again.`
  return null
}

/** Discard on a revision that waits in Central with no hand to Central here, or null. */
export function refinementDiscardWhy(refinement: Refinement, hands: {readonly central?: boolean} = {}): string | null {
  const handed = refinement.owner === CENTRAL_SOURCE ? refinement.handed : null
  return handed && !hands.central ? centralUnwired('discard', refinement, handed) : null
}

/** Central's words when no proposed revision waits there: it was written (or dropped) already. */
const NOTHING_WAITS = /no proposed revision of \S+ waits/

/** Accept or Discard on one proposed revision, through its owners: AIKit's own verbs (`aikit source refine accept|discard|follow`) and,
 * for a Control skill Central keeps, Central's own act on the person's authority. The person's one Accept of a Control skill's revision
 * is enough (O-I 795 round 14): AIKit's Accept hands it to Central where it is not yet handed (its answer names where it waits), Central's
 * Accept writes it at the digest reviewed, and AIKit's Follow syncs the member's source from Central and promotes it, with a receipt —
 * nothing is left for the person to sync or promote. A revision Central already wrote (nothing waits there) is followed, and AIKit judges
 * whether Central accepted it. Discard on one that waits in Central drops it there first, then AIKit's copy; one Central no longer keeps
 * is dropped from AIKit alone. Shared by the Refining page and Approvals. */
export async function answerRefinement(refinement: Refinement, verb: 'accept' | 'discard',
  ports: {readonly write?: RefiningPorts['write']; readonly central?: CentralRevisionHand}): Promise<void> {
  const why = verb === 'accept' ? refinementAcceptWhy(refinement, {central: !!ports.central}) : refinementDiscardWhy(refinement, {central: !!ports.central})
  if (why) throw Error(why)
  if (!ports.write) throw Error(REFINE_NO_CARRIER)
  const member = refinement.member
  const central = refinement.owner === CENTRAL_SOURCE ? ports.central : undefined
  let handed = refinement.owner === CENTRAL_SOURCE ? refinement.handed : null
  if (verb === 'accept' && central) {
    if (!handed) {
      // AIKit's answer is its reading ({route, data}): where the revision now waits in Central (`handed`).
      const answer = await ports.write({kind: REFINE_WRITES.accept, member})
      handed = handedOf(isObj(answer) && isObj(answer.data) ? answer.data.handed : null)
      if (!handed) throw Error(`Accept: AIKit did not say where the revision of ${member} waits in Central, so Central's Accept is not asked.`)
    }
    try {
      await central('accept', handed)
    } catch (error) {
      if (!NOTHING_WAITS.test(error instanceof Error ? error.message : String(error))) throw error
    }
    await ports.write({kind: REFINE_WRITES.follow, member})
    return
  }
  if (handed && central) {
    try {
      await central(verb, handed)
    } catch (error) {
      if (!NOTHING_WAITS.test(error instanceof Error ? error.message : String(error))) throw error
    }
    await ports.write({kind: REFINE_WRITES.discard, member})
    return
  }
  await ports.write({kind: REFINE_WRITES[verb], member})
}

export interface RefiningPorts {
  /** AIKit's writes through the kernel (aikit_write), each answering AIKit's reading ({route, data}). Absent: no carrier stands. */
  readonly write?: (request: {kind: string; member: string}) => Promise<unknown>
  /** The session's own Repeat over Skillset (sessionSettings.ts testRefinement). Absent: no session's task stands here. */
  readonly test?: (set: string, member: string) => Promise<{ok: true; note: string} | {ok: false; error: string}>
  /** Central's own acts on a revision that waits there (ownerRoutes.ts centralRevisionWrite). Absent: no kernel carries them here. */
  readonly central?: CentralRevisionHand
}

export interface RefiningInput {
  /** `aikit source refine list` (the kernel's aikit_read refinement-list). */
  readonly refinements?: AikitAnswer
  /** The set on the chain (rackValues `set`). */
  readonly set: string | null
  readonly holds: ChainHolds
}

export const REFINE_ABSENT = 'The proposed revisions: AIKit\'s `aikit source refine list` is not read here.'
const REFINE_NO_CARRIER = 'The kernel carrier is unavailable here, so AIKit cannot be asked (aikit_write).'
const REFINE_NO_SESSION = 'Test runs the selected session\'s own Repeat, and no session\'s task stands here: select a session on the Factory track.'
const REFINE_NO_SET = 'Test: no set stands on the chain, so there is no set to carry the proposed revision in.'

/** The refinement the person chose by member, or why there is none. */
function refinementNamed(refinements: readonly Refinement[] | null, member: string): Refinement {
  const found = refinements?.find(row => row.member === member)
  if (!found) throw Error(`${member}: no proposed revision of ${member} stands in AIKit's list.`)
  return found
}

/** The Refining page's binding (`refine.` keys): AIKit's proposals, the member chosen with its Why, Revision beside the revision in use,
 * Test and Result, and Accept, Discard and Test through their owners. */
export function refiningBinding(id: string, input: RefiningInput, ports: RefiningPorts = {}): DesignBinding {
  const answer = input.refinements
  const refinements = answer?.status === 'answered' ? refinementsOf(answer.value) : null
  const values: Record<string, Value> = {}
  const standing: Record<string, Standing> = {}
  const listWhy = answer?.status === 'refused' ? answer.error ?? REFINE_ABSENT : answer?.status === 'reading' ? 'AIKit has not answered yet (`aikit source refine list`).'
    : answer ? 'AIKit answered something other than its proposed revisions.' : REFINE_ABSENT
  const held = viewHolds(input.holds, id).refineMember
  const chosen = refinements?.find(row => row.member === held) ?? refinements?.[0] ?? null
  if (refinements) values.proposals = JSON.stringify(refinements.map(row => ({id: row.member, source: row.source, owner: row.owner, stale: row.stale, revision: row.proposed.revision})))
  else standing.proposals = {disabled: listWhy}
  const noneWhy = refinements ? 'No proposed revision stands: a close whose reason Kev picks a member for sends one here.' : listWhy
  if (chosen) {
    const result = refinementResult(chosen)
    values.member = chosen.member
    values.owner = chosen.owner
    if (chosen.owner === CENTRAL_SOURCE && chosen.handed) values.handed = chosen.handed.revisionRef
    values.stale = chosen.stale
    values.why = JSON.stringify(chosen.why)
    values.revision = chosen.proposed.revision
    if (chosen.inUse) values.inUse = chosen.inUse.revision
    values.test = JSON.stringify(refinementTakes(chosen))
    values.result = JSON.stringify(result.rows)
    values.resultWhy = result.why
    if (input.set) values.levels = `${input.set}+${chosen.member} · ${input.set}`
  } else for (const key of ['member', 'why', 'revision', 'test', 'result']) standing[key] = {disabled: noneWhy}
  const hands = {central: !!ports.central}
  const acceptWhy = !ports.write ? REFINE_NO_CARRIER : !chosen ? noneWhy : refinementAcceptWhy(chosen, hands)
  if (acceptWhy) standing.accept = {disabled: acceptWhy}
  const discardWhy = !ports.write ? REFINE_NO_CARRIER : !chosen ? noneWhy : refinementDiscardWhy(chosen, hands)
  if (discardWhy) standing.discard = {disabled: discardWhy}
  const runWhy = !chosen ? noneWhy : !input.set ? REFINE_NO_SET : !ports.test ? REFINE_NO_SESSION : null
  if (runWhy) standing.run = {disabled: runWhy}
  const memberOf = (value: Value | undefined) => (typeof value === 'string' && value ? value : chosen?.member ?? '')
  return {
    id,
    values,
    standing,
    local: {member: (value: Value | undefined) => holdView(id, 'refineMember', value)},
    writes: key => key === 'accept' || key === 'discard' || key === 'run',
    write: async changes => {
      for (const change of changes) {
        if (change.key === 'accept' || change.key === 'discard') {
          if (!ports.write) throw Error(REFINE_NO_CARRIER)
          await answerRefinement(refinementNamed(refinements, memberOf(change.value)), change.key, ports)
          continue
        }
        if (change.key === 'run') {
          if (runWhy || !chosen || !input.set || !ports.test) throw Error(runWhy ?? noneWhy)
          const made = await ports.test(input.set, chosen.member)
          if (!made.ok) throw Error(made.error)
          continue
        }
        throw Error(REFUSE.reading(change.key))
      }
    },
  }
}

/** The Skillset rack on the door (factoryPlaces.ts SLOT_DEVICE.skillset), its Refining page (skills.tsx PAGES), and Factory, the mode whose
 * session chains stand it (factoryPlaces.ts RACK_CHAIN: every session holds the one rack). */
export const SKILLSET_RACK_ID = chainDeviceId('skillset')
export const REFINING_PAGE = 'refine'
export const REFINING_MODE = 'factory' as const
/** Why a refinement cannot be shown where it is opened: no chain here stands the rack. */
export const REFINING_ELSEWHERE = (member: string) => `${member}: the Skillset rack stands on a session's chain in Factory, and no chain stands it `
  + `here now. Select a session on the Factory track: its rack stands on its Refining page with ${member} chosen.`

/** The band a refinement waits to open, until its rack comes onto the door (one at a time: a later open replaces it). */
let waitingBand: (() => void) | null = null

/** Open a proposed revision on the Skillset rack's Refining page (§19.7) from where it is named: the Day's Patterns pad (§18.2: "A pattern
 * whose items point at one skill or method can open a refinement of it") and Approvals' Open on a refinement (§19.14: "Open, which opens it
 * where it belongs"). The rack holds the member and stands on its Refining page wherever it is drawn, and its whole view opens in its band
 * above the chain. Where no chain stands the rack now, `toFactory` turns the shell to Factory and the band opens once a session's chain puts
 * the rack on the door; with no such hand, the press says where the rack stands. It writes nothing to any owner. */
export function openRefinement(member: string, hands: {readonly toFactory?: () => void} = {}): void {
  if (!member) throw Error('Refine: no skill or method is named to open.')
  holdView(SKILLSET_RACK_ID, 'refineMember', member)
  setHostPage(SKILLSET_RACK_ID, REFINING_PAGE)
  waitingBand?.()
  waitingBand = null
  const show = () => { selectDevice(SKILLSET_RACK_ID); flipDevice(SKILLSET_RACK_ID) }
  if (publishedDevice(SKILLSET_RACK_ID)) { show(); return }
  if (!hands.toFactory) throw Error(REFINING_ELSEWHERE(member))
  const stop = subscribeDeviceDoor(() => {
    if (!publishedDevice(SKILLSET_RACK_ID)) return
    stop()
    waitingBand = null
    show()
  })
  waitingBand = stop
  hands.toFactory()
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

/** Scope's Tool calls on the chain (§19.12 Asks): the harness's approvals mode — ask · session · always — as the gateway's reading discloses
 * it (agentChainDevices.ts gatewayDisclosed `approvals`), and the Gateway slot's `approvals` row, whose write path is the registry's
 * aikit.gateway.agent — which has no approvals operation in AIKit's gateway (aikitGatewayOps.ts), so it stands disabled. Absent: the chain hands
 * in neither. */
export interface ScopeAsks {
  readonly toolCalls?: Value
  readonly toolCallsRow?: SdkParamRow
  /** Calls to other agents: AIKit's rule for the sender kind agent on the session's gateway bindings (callsOf), null while the gateway's
   * ecology is unread, its refusal where it refused; and the write that sets one rule on every binding (the kernel's harness_ingress_rule). */
  readonly calls?: CallsReading | {readonly refused: string} | null
  readonly callsWrite?: (bindings: readonly string[], decision: CallsDecision) => Promise<void>
  /** Wait and On no answer: the session's own settings in AIKit, and their write (ScopeWaits). */
  readonly waits?: ScopeWaits
}

/** Calls to other agents as Scope's design names them: Allow, Ask (AIKit's pair: the call waits in Approvals) and Deny. */
export type CallsDecision = 'allow' | 'pair' | 'deny'
const CALLS_DECISIONS: readonly string[] = ['allow', 'pair', 'deny']
/** The session's gateway bindings, and the one rule for calls from other agents they agree on (absent where they disagree or none). */
export interface CallsReading {readonly bindings: readonly string[]; readonly decision?: CallsDecision}

/** Calls to other agents on a session, from AIKit's gateway ecology (`aikit gateway ecology`, as the World Model's sessions slice carries it): each
 * conversation surface of the session sits on a gateway binding, which decides a call from another agent by its rule for the sender kind
 * agent, else by its one default (AIKit gateway_runtime.rs GatewayEcologySurface ingress_kinds, ingress_default). Null when the reading
 * is not the ecology. Pure. */
export function callsOf(ecology: unknown, sessionRef: string | null | undefined): CallsReading | null {
  const doc = isObj(ecology) && ecology.type === 'ecology' && isObj(ecology.ecology) ? ecology.ecology : null
  if (!doc || !Array.isArray(doc.agencies)) return null
  const surfaces = doc.agencies.flatMap(agency => (isObj(agency) && Array.isArray(agency.sessions) ? agency.sessions : []))
    .flatMap(row => (isObj(row) && row.agent_session_ref === sessionRef && Array.isArray(row.surfaces) ? row.surfaces : []))
    .filter((surface): surface is Obj => isObj(surface) && typeof surface.binding_ref === 'string' && !!surface.binding_ref)
  const bindings = [...new Set(surfaces.map(surface => surface.binding_ref as string))]
  const decisions = new Set(surfaces.map(surface => (isObj(surface.ingress_kinds) && surface.ingress_kinds.agent !== undefined ? surface.ingress_kinds.agent : surface.ingress_default)))
  const [only] = decisions
  return decisions.size === 1 && typeof only === 'string' && CALLS_DECISIONS.includes(only) ? {bindings, decision: only as CallsDecision} : {bindings}
}

/** Why Calls to other agents is not pressable, or null where it writes. */
const callsWhy = (asks: ScopeAsks): string | null =>
  (!asks.callsWrite ? CALLS_REFUSE.uncarried : !asks.calls ? CALLS_REFUSE.unread : 'refused' in asks.calls ? CALLS_REFUSE.refused(asks.calls.refused)
    : !asks.calls.bindings.length ? CALLS_REFUSE.unbound : null)
/** The session's gateway bindings, where the ecology answered. */
const callsReadingOf = (asks: ScopeAsks): CallsReading | null => (asks.calls && !('refused' in asks.calls) ? asks.calls : null)

/** Scope's values (§19.12). No owner reports the reach, the write mode, the basis, the places or the receipts (the address table's world
 * rows are readings with no source: agentParamAddresses.ts:93-97), so every one is absent; Tool calls is the harness's own reading, Calls to
 * other agents AIKit's rule on the session's bindings and Wait and On no answer the session's own settings in AIKit, where the chain hands
 * them in, and the only other value is a raised reach waiting for your Confirm. */
export function scopeValues(held: ChainHolds, asks: ScopeAsks = {}): Values {
  const values: Record<string, Value> = {}
  if (held.reachPending !== undefined) values.reachPending = held.reachPending
  if (asks.toolCalls !== undefined) values.toolCalls = asks.toolCalls
  const calls = callsReadingOf(asks)
  if (calls?.decision) values.calls = calls.decision
  Object.assign(values, waitValues(asks.waits))
  return values
}

/** Tool calls with no row to carry it. */
const TOOL_CALLS_UNCARRIED = 'Tool calls: the Gateway\'s approvals row is not adopted on this chain, so nothing carries it.'

const SCOPE_WRITES = (key: string) => ['reach', 'writeMode', 'toolCalls'].includes(key) || key in REFUSED_WRITES[SCOPE_DESIGN]! || key.startsWith('w:')

/** Scope's refused settings, Tool calls where no row carries it, and Calls to other agents, Wait and On no answer where they are not
 * pressable. */
function scopeStanding(asks: ScopeAsks): Record<string, Standing> {
  // Tool calls is the harness's approvals mode, which AIKit's gateway has no operation to set (aikitGatewayOps.ts).
  const standing: Record<string, Standing> = {...disabled(REFUSED_WRITES[SCOPE_DESIGN]!),
    toolCalls: {disabled: asks.toolCallsRow?.writePath ? harnessKeyUncarried('approvals')!.reason : TOOL_CALLS_UNCARRIED}}
  const why = callsWhy(asks)
  if (why) standing.calls = {disabled: why}
  else delete standing.calls
  delete standing.wait
  delete standing.noAnswer
  return {...standing, ...waitStanding(asks.waits)}
}

/** A raised reach the view holds: a ring, or none (Cancel's drop). */
const reachOf = (value: Value | undefined): number | undefined => {
  const ring = typeof value === 'number' ? value : value === undefined ? NaN : Number(value)
  return Number.isFinite(ring) ? ring : undefined
}

/** Scope's binding: a raised reach is the view's own key, held until Confirm — nothing is sent before, and Cancel drops it — and
 * Confirm goes to the owner; the write mode goes through the world row's own write path (the shell write arm, which its dispatcher
 * refuses until WO-SF2 reads it); Tool calls through the Gateway slot's approvals row (the harness's own control). Before it lands, Escalate
 * to and the Grants page are Custody's binding's, laid in by the chain (sessionChainBindings.ts withCustodyAsks). */
export function scopeBinding(id: string, held: ChainHolds, writeModeRow: SdkParamRow | undefined, write: RowWrite, asks: ScopeAsks = {}): DesignBinding {
  return {
    id,
    values: scopeValues(held, asks),
    local: {reachPending: value => updateHolds(was => (was.reachPending === reachOf(value) ? was : {...was, reachPending: reachOf(value)}))},
    standing: scopeStanding(asks),
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
        if (key === 'toolCalls') {
          // AIKit's gateway has no operation that sets the harness's approvals mode: refused in the words it stands disabled with.
          throw Error(asks.toolCallsRow?.writePath ? harnessKeyUncarried('approvals')!.reason : TOOL_CALLS_UNCARRIED)
        }
        if (key === 'calls') {
          const why = callsWhy(asks)
          if (why) throw Error(why)
          if (typeof value !== 'string' || !CALLS_DECISIONS.includes(value)) throw Error(CALLS_REFUSE.decision(String(value)))
          await asks.callsWrite!(callsReadingOf(asks)!.bindings, value as CallsDecision)
          continue
        }
        if (key === 'wait' || key === 'noAnswer') { await waitWrite(key, value, asks.waits); continue }
        const refused = REFUSED_WRITES[SCOPE_DESIGN]![key]
        if (refused) throw Error(refused)
        if (key.startsWith('w:')) throw Error(REFUSE.place)
        throw Error(REFUSE.reading(key))
      }
    },
  }
}
