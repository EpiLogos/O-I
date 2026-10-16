// Factory's Main track readers of what the agents did and ask (lane BF3): the Ledger (DLW §19.15, its widget §23.9;
// software-factory:ledger — "Factory's Main track") and Approvals (§19.16, its widget §23.10; software-factory:approvals).
//
// The Ledger's receipts are Central's source changes: the change horizon (projectcentral.change.horizon, ctrl/src/source_horizon.rs:118
// SourceChange), which the kernel's `central` op carries inside the ground it inspects (desktop/cradle/kernel/src/central.rs:191,
// "sources") — the root register's ground the window already holds once (central/devices/useCentralReadings.ts
// useCentralGroundAnswer). A receipt is a change an agent made: the change names its actor kind `agent` or its agent session.
// Read 16 Oct 2026 (scratch lane-bf3/shapes/horizon-*.json): the root horizon holds 830 changes (human, native-operation,
// native-service, unattributed) and O-I's 204 — none attributed to an agent, so the Ledger reads an empty list, truly. A horizon
// change is a write that landed (the proposals that wait, are accepted or rejected are Central's source returns,
// projectcentral.source.returns, which no kernel op runs: the kernel's client has it, flow.rs:780 source_returns, and nothing calls it).
// The task, the run, turns, tokens and spend are no part of a change.
//
// Approvals' Default answer is the Gateway's `approvals` key — the same read (agentChainDevices.ts gatewayDisclosed) and the same write
// (the Gateway row, kernel harness_agent_control configure {approvals}); its queue is the shown session's pending consent requests
// (AIKit's encounter view `permissions`, the Thread's own reading, threadBinding.ts pendingPermissions), each answered with the
// harness's own choice (allow once, allow always, reject) through the encounter's `permission` verb. Wait and On no answer have no
// owner write (Hermes' approvals.timeout is not a harness_agent_control configure field, harnessAgentControl.ts:14-25); the proposals
// (Approve, Changes) are source returns, which no kernel op reads or answers here. Pure, apart from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {EncounterReading, NativePermission, PermissionDecision} from '../../../../../../desktop/cradle/src/encounter/client'
import {describePermission} from '../../../../../../desktop/cradle/src/agent/chat/PermissionCard'
import type {AgentSessionTrack} from '../agentRunModel'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'
import {pendingPermissions, verbStanding} from './threadBinding'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

export const LEDGER_DESIGN = 'software-factory:ledger'
export const APPROVALS_DESIGN = 'software-factory:approvals'
export const LEDGER_ID = 'factory:main:ledger'
export const APPROVALS_ID = 'factory:main:approvals'
export const RECEIPT_DEVICE_IDS: readonly string[] = [LEDGER_ID, APPROVALS_ID]

export const receiptDevices = (): {ledger: DeviceInstance | null; approvals: DeviceInstance | null} => ({
  ledger: familyFaceDevice(LEDGER_ID, 'software-factory', 'ledger', 'Ledger', 'chain'),
  approvals: familyFaceDevice(APPROVALS_ID, 'software-factory', 'approvals', 'Approvals', 'arm'),
})

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}
const reading = (key: string) => `${key} is a reading: its owner reports it; nothing here changes it.`

// ---------------------------------------------------------------------------------------------------------------- the Ledger

/** The Ledger's view settings and the manual's starting value of each (§19.15: Today, All, All, Newest first). */
export const LEDGER_VIEW: Readonly<Record<string, Value>> = {period: 'today', agent: 'all', outcome: 'all', order: 'newest'}
const LEDGER_LOCAL = [...Object.keys(LEDGER_VIEW), 'task'] as const

/** Central's ground as the window holds it (desktop/cradle/src/central/client.ts CentralGroundReading): the change horizon and the
 * civil time, each a reading with its own state. */
export interface LedgerGround {
  readonly sources?: {readonly state: string; readonly data?: unknown; readonly error?: {readonly message?: string}}
  readonly time?: {readonly state: string; readonly data?: unknown}
}

export interface LedgerInput {
  /** The root register's ground (useCentralGroundAnswer), null while unread. */
  readonly ground: LedgerGround | null
  /** The ground's refusal in the owner's words, or the carrier's, when there is one. */
  readonly groundError: string | null
  readonly holds: ChainHolds
}

/** One civil instant as the Day writes it, in the policy's time zone (else this machine's). */
function civil(unixSeconds: number, timeZone: string | undefined): {day: string; time: string} {
  const at = new Date(unixSeconds * 1000)
  const zone = timeZone ? {timeZone} : {}
  const parts = (format: Intl.DateTimeFormatOptions) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {...format, ...zone}).formatToParts(at).map(part => [part.type, part.value]))
  const d = parts({year: 'numeric', month: '2-digit', day: '2-digit'}), t = parts({hour: '2-digit', minute: '2-digit', hourCycle: 'h23'})
  return {day: `${d.year}-${d.month}-${d.day}`, time: `${t.hour}:${t.minute}`}
}

const KINDS = new Set(['added', 'modified', 'removed'])

/** The receipts of a change horizon (software-factory__ledger.tsx:16-19 `receipts`): each change an agent made — its actor kind is
 * `agent`, or it names an agent session — newest first, as {n (the horizon's cursor), agent (the actor), outcome landed, day, time (in
 * the civil time zone), files [{path, kind, from, to}], session}. A change no agent made is not a receipt. */
export function receiptRows(horizon: unknown, timeZone: string | undefined): Record<string, Value | readonly unknown[]>[] {
  const changes = isObj(horizon) && Array.isArray(horizon.changes) ? horizon.changes : []
  const rows: Record<string, Value | readonly unknown[]>[] = []
  for (const change of changes) {
    if (!isObj(change) || typeof change.cursor !== 'number') continue
    const session = str(change.agent_session_ref)
    if (change.actor_kind !== 'agent' && !session) continue
    const at = typeof change.observed_at_unix_seconds === 'number' ? civil(change.observed_at_unix_seconds, timeZone) : null
    const path = str(change.source_path)
    rows.push({
      n: change.cursor,
      ...(str(change.actor) ? {agent: String(change.actor)} : {}),
      outcome: 'landed',
      ...(at ? {day: at.day, time: at.time} : {}),
      ...(path ? {files: [{path, ...(KINDS.has(String(change.kind)) ? {kind: String(change.kind)} : {}),
        ...(str(change.before_revision) ? {from: String(change.before_revision)} : {}), ...(str(change.after_revision) ? {to: String(change.after_revision)} : {})}]} : {}),
      ...(session ? {session} : {}),
    })
  }
  return rows.sort((a, b) => Number(b.n) - Number(a.n))
}

const timeData = (ground: LedgerGround | null) => (ground?.time?.state === 'ready' && isObj(ground.time.data) ? ground.time.data : null)

/** The Ledger's values: the light (the horizon answered, or refused), today, the receipts, the view's settings. */
export function ledgerValues(input: LedgerInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, LEDGER_ID)
  for (const [key, value] of Object.entries(LEDGER_VIEW)) values[key] = view[key] ?? value
  put(values, 'task', view.task)
  const sources = input.ground?.sources
  if (sources?.state === 'ready' && sources.data !== undefined) {
    const time = timeData(input.ground)
    const policy = time && isObj(time.policy) ? time.policy : null
    values.receipts = JSON.stringify(receiptRows(sources.data, policy ? str(policy.timezone) : undefined))
    values.light = 'lit'
  } else if (sources || input.groundError) values.light = 'dark'
  const time = timeData(input.ground)
  if (time) put(values, 'today', str(time.civil_date))
  return values
}

/** Why the horizon is not read, in the owner's words. */
export function ledgerWaits(input: LedgerInput): string | null {
  const sources = input.ground?.sources
  if (sources?.state === 'ready') return null
  return sources?.error?.message ?? input.groundError ?? (input.ground ? `Central's change horizon stands ${sources?.state ?? 'unread'}.` : null)
}

export interface LedgerPorts {
  /** Open a receipt's log: select its session's track, whose task log Clip view shows. Null: the session is no track here. */
  readonly openSession: (sessionRef: string) => string | null
}

/** The Ledger's binding: it only reads (§19.15 "The Ledger only reads"); its filters and the receipt you read are the view's own;
 * Open log selects the receipt's agent session, whose log Clip view shows. */
export function ledgerBinding(input: LedgerInput, ports: LedgerPorts): DesignBinding {
  const values = ledgerValues(input)
  const receipts = typeof values.receipts === 'string' ? JSON.parse(values.receipts) as {n: number; session?: string}[] : []
  const why = ledgerWaits(input)
  return {
    id: LEDGER_ID,
    values,
    ...(why ? {standing: {openLog: {disabled: why}}} : {}),
    local: Object.fromEntries(LEDGER_LOCAL.map(key => [key, (value: Value | undefined) => holdView(LEDGER_ID, key, value)])),
    writes: key => key === 'openLog',
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key !== 'openLog') throw Error(reading(key))
        const receipt = receipts.find(row => row.n === Number(value))
        if (!receipt) throw Error('That receipt is not in the change horizon.')
        if (!receipt.session) throw Error('This change names no agent session, so there is no task log to open.')
        const refused = ports.openSession(receipt.session)
        if (refused) throw Error(refused)
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- Approvals

export const APPROVALS_REFUSE = {
  wait: missing('Wait', 'Hermes\' approvals.timeout through harness_agent_control configure (it carries approvals, transport, connect and stall-after only)', 'Actuation'),
  noAnswer: missing('On no answer', 'a timed-out request\'s outcome through harness_agent_control configure', 'Actuation'),
  approve: missing('Approve', 'a proposal\'s acceptance through the kernel (projectcentral.source.returns has no kernel op, so no proposal is read)', 'Central'),
  changes: missing('Changes', 'a comment on a source return', 'Central'),
} as const

/** The view's settings and the manual's starting value of each (§19.16: Both, Oldest first). */
export const APPROVALS_VIEW: Readonly<Record<string, Value>> = {show: 'both', order: 'oldest'}
const APPROVALS_LOCAL = [...Object.keys(APPROVALS_VIEW), 'pick'] as const

export interface ApprovalsInput {
  /** The Gateway's values (designBindings.ts gatewayValues): its `approvals` is this device's Default answer. */
  readonly gateway: Values
  /** The session whose requests the queue shows (the Thread's shown session), null when none. */
  readonly session: AgentSessionTrack | null
  /** That session's encounter view, while it is observed. */
  readonly encounter: Pick<EncounterReading, 'permissions' | 'actions'> | null
  readonly holds: ChainHolds
}

/** The tool a consent request names (its tool call's kind or title). */
function toolOf(request: NativePermission): string | undefined {
  const call = isObj(request.tool_call) ? request.tool_call : {}
  return str(call.kind) ?? str(call.title)?.split(':')[0]
}

/** The shown session's consent requests as the queue's rows (software-factory__approvals.tsx:15-17): {id (the native request id), kind
 * request, who (the session's agent), text (what it would do: the command or the file), where (the tool), session}. The view says
 * nothing of when a request was made, so no age is given. */
export function queueRows(requests: readonly NativePermission[], session: AgentSessionTrack | null): Record<string, Value>[] {
  return requests.map(request => {
    const said = describePermission(request)
    const tool = toolOf(request)
    const who = session?.agentName ?? session?.agentRef ?? undefined
    return {id: request.native_request_id, kind: 'request', text: said.target ?? said.wants,
      ...(who ? {who} : {}), ...(tool ? {where: tool} : {}), ...(session ? {session: session.purpose ?? session.sessionRef} : {})}
  })
}

export function approvalsValues(input: ApprovalsInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, APPROVALS_ID)
  for (const [key, value] of Object.entries(APPROVALS_VIEW)) values[key] = view[key] ?? value
  put(values, 'pick', view.pick)
  put(values, 'approvals', input.gateway.approvals)
  if (input.session && input.encounter) {
    const rows = queueRows(pendingPermissions(input.encounter), input.session)
    values.queue = JSON.stringify(rows)
    values.light = rows.length ? 'lit' : 'dark'
  }
  return values
}

export interface ApprovalsPorts {
  /** The shown session's encounter `permission` verb (absent: not observed). */
  readonly permission?: (requestId: string, decision: PermissionDecision) => Promise<void>
}

/** The harness's own choice for an answer: allow once, allow always, or reject (PermissionCard.tsx reads the same kinds). */
function choiceFor(request: NativePermission, answer: 'allowOnce' | 'allowAlways' | 'deny'): PermissionDecision | null {
  const kind = answer === 'allowOnce' ? 'allow_once' : answer === 'allowAlways' ? 'allow_always' : 'reject_once'
  const exact = request.choices.find(choice => choice.kind === kind)
  if (exact) return {outcome: 'selected', option_id: exact.option_id}
  if (answer === 'deny') {
    const reject = request.choices.find(choice => choice.kind?.startsWith('reject'))
    return reject ? {outcome: 'selected', option_id: reject.option_id} : {outcome: 'cancelled'}
  }
  return null
}

/** Approvals' binding: the Default answer through the Gateway's own write (one key, one row); each answer to a request through the
 * shown session's encounter, with the harness's own choice; the view's settings held by the shell; Wait, On no answer and the proposal
 * answers stand disabled with what they lack. */
export function approvalsBinding(input: ApprovalsInput, gateway: Pick<DesignBinding, 'write' | 'standing'> | null, ports: ApprovalsPorts): DesignBinding {
  const requests = input.encounter ? pendingPermissions(input.encounter) : []
  const standing: Record<string, Standing> = disabled(APPROVALS_REFUSE)
  const verb = !input.session ? 'No session is shown: select one, or pin the Thread to one.' : !input.encounter ? 'The session\'s conversation is not read yet.'
    : verbStanding(input.encounter, 'permission')
  if (verb) for (const key of ['allowOnce', 'allowAlways', 'deny']) standing[key] = {disabled: verb}
  if (gateway?.standing?.approvals) standing.approvals = gateway.standing.approvals
  return {
    id: APPROVALS_ID,
    values: approvalsValues(input),
    standing,
    local: Object.fromEntries(APPROVALS_LOCAL.map(key => [key, (value: Value | undefined) => holdView(APPROVALS_ID, key, value)])),
    writes: key => key === 'approvals' || key === 'allowOnce' || key === 'allowAlways' || key === 'deny' || key in APPROVALS_REFUSE,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'approvals') {
          if (!gateway?.write) throw Error('The Gateway is not drawn on its owner here, so nothing carries the default answer.')
          await gateway.write([{key, value}])
          continue
        }
        if (key === 'allowOnce' || key === 'allowAlways' || key === 'deny') {
          if (verb || !ports.permission) throw Error(verb ?? 'The session\'s conversation is not observed here.')
          const request = requests.find(item => item.native_request_id === value)
          if (!request) throw Error('That request no longer waits: AIKit reports it answered or gone.')
          const decision = choiceFor(request, key)
          if (!decision) throw Error(`The request offers no ${key === 'allowOnce' ? 'once' : 'always'} choice; answer it in the thread pane.`)
          await ports.permission(request.native_request_id, decision)
          continue
        }
        throw Error(APPROVALS_REFUSE[key as keyof typeof APPROVALS_REFUSE] ?? reading(key))
      }
    },
  }
}
