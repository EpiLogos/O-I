// Factory's Main track readers of what the agents did and ask (lane BF3): the Ledger (DLW §19.13, its widget §23.9;
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
// The proposals stand in the Ledger too (lane W9), from Central's source returns (the kernel's source_returns_read, central.source-returns/v1,
// the read Approvals makes): a pending or applying return is Waiting, or Commented once a reviewer commented on it (its entry's `comments`,
// Central PR 290: the count of the comments the return keeps); an accepted one is Approved and a rejected one Refused (source_return.rs
// statuses). A return carries no receipt number: its row's `n` is the instant Central minted it (its ref names it, in ms), and who accepted
// it is not in the list, so `by` is left out.
//
// Approvals' Default answer is the Gateway's `approvals` key — the same read (agentChainDevices.ts gatewayDisclosed) and the same write
// (the Gateway row, kernel harness_agent_control configure {approvals}); its queue is the shown session's pending consent requests
// (AIKit's encounter view `permissions`, the Thread's own reading, threadBinding.ts pendingPermissions), each answered with the
// harness's own choice (allow once, allow always, reject) through the encounter's `permission` verb. Wait and On no answer have no
// owner write (Hermes' approvals.timeout is not a harness_agent_control configure field, harnessAgentControl.ts:14-25); the proposals are
// Central's source returns, which the kernel reads since lane K1 (`source_returns_read`, central.source-returns/v1: workcellReads.ts) —
// the pending and applying ones stand in the queue. Approve accepts one through Central's projectcentral.source.return_accept, the person's
// press the kernel carries (central/devices/sourceReturnAccept.ts, handed in as a port). Changes comments on the waiting return through
// Central's projectcentral.source.return_comment in the words written in the thread: a chain carries it by wrapping this binding with
// central/devices/sourceReturnComment.ts withReturnComments; unwrapped, it stands disabled saying so.
// Factory's unit decisions (lane W9, unitDecisions.ts) stand in the queue as requests: the questions the shown session's Runs wait on, each
// answered as the person — Allow once answers Resume bounded work, Deny answers Cancel bounded work — through Central's receiving Review of
// the question Factory put to Central; Allow always is refused (a unit decision takes one answer). Pure, apart from the view holds
// (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {EncounterReading, NativePermission, PermissionDecision} from '../../../../../../desktop/cradle/src/encounter/client'
import {describePermission} from '../../../../../../desktop/cradle/src/agent/chat/PermissionCard'
import type {AgentSessionTrack} from '../agentRunModel'
import type {SourceReturnEntry} from '../../../../../../desktop/cradle/src/kernel/types'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'
import {pendingPermissions, verbStanding} from './threadBinding'
import {unitAnswer, unitRows, waitingDecisions, type UnitDecisionsRead} from './unitDecisions'

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
  /** Central's source returns of the project (kernel source_returns_read), null while unread; absent: not read here. */
  readonly returns?: {readonly entries: readonly SourceReturnEntry[]} | null
  /** The agency tracks, which name a return's agent. */
  readonly tracks?: readonly AgentSessionTrack[] | null
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

/** A return's outcome in the Ledger's words: Waiting, or Commented once it keeps a comment; Approved; Refused. Undefined for a status Central
 * may add later. */
function returnOutcome(entry: SourceReturnEntry): string | undefined {
  const comments = (entry as {comments?: unknown}).comments
  if (entry.status === 'pending' || entry.status === 'applying') return typeof comments === 'number' && comments > 0 ? 'commented' : 'waiting'
  return entry.status === 'accepted' ? 'approved' : entry.status === 'rejected' ? 'refused' : undefined
}

/** Central's source returns as Ledger receipts (software-factory__ledger.tsx `receipts`): {n (the instant Central minted it, ms), name (the
 * source it proposes to change), agent (the session's agent, else its session), outcome, day, time (minted, in the civil time zone), session}.
 * A return whose ref names no instant has no `n` and is left out. Pure. */
export function returnReceiptRows(entries: readonly SourceReturnEntry[], tracks: readonly AgentSessionTrack[] | null | undefined, timeZone: string | undefined): Record<string, Value>[] {
  return entries.flatMap(entry => {
    const minted = returnMintedMs(entry.return_ref)
    if (minted === null) return []
    const outcome = returnOutcome(entry)
    const track = tracks?.find(item => item.sessionRef === entry.agent_session_ref)
    const at = civil(Math.floor(minted / 1000), timeZone)
    return [{n: minted, name: pathOfSource(entry.source_ref), agent: track?.agentName ?? track?.agentRef ?? entry.agent_session_ref, ...(outcome ? {outcome} : {}),
      day: at.day, time: at.time, session: entry.agent_session_ref}]
  })
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
    const zone = policy ? str(policy.timezone) : undefined
    const proposed = input.returns ? returnReceiptRows(input.returns.entries, input.tracks, zone) : []
    values.receipts = JSON.stringify([...receiptRows(sources.data, zone), ...proposed].sort((a, b) => Number(b.n) - Number(a.n)))
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

/** Why Actuation's usage reading reaches no Ledger key (lane W3): the kernel's actuation_read {kind usage} runs `actuation usage - --json` on
 * ONE record it is handed — an `actuation.model-usage/v1` observation (usage_ref, actuation_ref, invocation_ref, correlation, model,
 * tokens {input, output}, cache, timing, cost, outcome, provenance; real shape in desktop/cradle/kernel/tests/fixtures/owner-routes/
 * actuation-usage-2026-10-21.json) — and reads no store. No reading the shell holds carries such a record for a receipt's session (the
 * change horizon, the session's task record, the agency reading and AIKit's encounter view hold none); Actuation makes them from a harness
 * transcript with `actuation stream usage` into its own store, which no kernel route runs or reads. */
const NO_USAGE_RECORD = 'a model-usage record for the receipt\'s session to hand Actuation\'s `usage` (the kernel\'s actuation_read takes one actuation.model-usage/v1 record and reads no store; no reading here holds one — Actuation keeps them in its own store through `actuation stream usage`, which no kernel route reads)'

/** What the Ledger draws that no change carries (the task, the run, turns, tokens and spend), each with the read it waits for. */
export const LEDGER_ABSENT: Readonly<Record<string, string>> = {
  run: 'The run: no reading reaches it yet — missing op: the run a change belongs to (a source change names no run) (Software Factory).',
  used: 'The turns: no reading reaches them yet — missing op: the turns of the receipt\'s run (a model-usage record counts a model message\'s tokens, never turns; the Ledger reads no session\'s task record) (Actuation).',
  cap: 'The turns allowed: no reading reaches them yet — missing op: the turn budget of the receipt\'s run (no model-usage record carries one) (Actuation).',
  tokensIn: `The tokens read: no reading reaches them yet — missing op: ${NO_USAGE_RECORD} (Actuation).`,
  tokensOut: `The tokens written: no reading reaches them yet — missing op: ${NO_USAGE_RECORD} (Actuation).`,
  spend: `The spend: no reading reaches it yet — missing op: ${NO_USAGE_RECORD}, whose cost Actuation reports only where the harness did (Actuation).`,
}

/** The Ledger's binding: it only reads (§19.13 "The Ledger only reads"); its filters and the receipt you read are the view's own;
 * Open log selects the receipt's agent session, whose log Clip view shows. A key no owner reports stands absent with what it waits for. */
export function ledgerBinding(input: LedgerInput, ports: LedgerPorts): DesignBinding {
  const values = ledgerValues(input)
  const receipts = typeof values.receipts === 'string' ? JSON.parse(values.receipts) as {n: number; session?: string}[] : []
  const why = ledgerWaits(input)
  const unread = why ?? 'Central\'s ground has not answered yet (the kernel\'s central inspect carries the change horizon and the civil date).'
  const standing: Record<string, Standing> = Object.fromEntries(Object.entries(LEDGER_ABSENT).map(([key, reason]) => [key, {disabled: reason}]))
  for (const key of ['light', 'receipts', 'today']) if (!(key in values)) standing[key] = {disabled: unread}
  if (why) standing.openLog = {disabled: why}
  return {
    id: LEDGER_ID,
    values,
    standing,
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
  changes: 'Changes: this chain passes no comment hand (Central\'s projectcentral.source.return_comment comments on the waiting return in the words written in the thread: central/devices/sourceReturnComment.ts).',
} as const

/** Approve where the chain hands no acceptance port (ApprovalsPorts.approve): Central's action exists and the kernel carries it as the
 * person's press (central/devices/sourceReturnAccept.ts), but this chain does not pass it. */
export const APPROVE_UNWIRED = 'Approve: this chain does not carry Central\'s projectcentral.source.return_accept to the return (no acceptance port is passed here).'

/** The view's settings and the manual's starting value of each (§19.16: Both, Oldest first). */
export const APPROVALS_VIEW: Readonly<Record<string, Value>> = {show: 'both', order: 'oldest'}
const APPROVALS_LOCAL = [...Object.keys(APPROVALS_VIEW), 'pick'] as const

export interface ApprovalsInput {
  /** The Gateway's values (designBindings.ts gatewayValues): its `approvals` is this device's Default answer. */
  readonly gateway: Values
  /** Central's source returns of the project (kernel source_returns_read), null while unread; the agency tracks name their agents. */
  readonly returns?: {readonly entries: readonly SourceReturnEntry[]} | null
  readonly tracks?: readonly AgentSessionTrack[] | null
  /** The instant the queue is read at, for a proposal's age (its return was minted at the instant its ref names). */
  readonly nowUnixMs?: number
  /** The session whose requests the queue shows (the Thread's shown session), null when none. */
  readonly session: AgentSessionTrack | null
  /** That session's encounter view, while it is observed. */
  readonly encounter: Pick<EncounterReading, 'permissions' | 'actions'> | null
  readonly holds: ChainHolds
  /** Factory's unit decisions of the shown session's Runs (unitDecisions.ts useUnitDecisions); absent: not read here. */
  readonly units?: UnitDecisionsRead | null
  /** The person Central's personal anchor names: only the unit's resolver answers a unit decision. */
  readonly person?: string | null
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

/** A source path as the return names it (`central:source:<world>:<path>`), else the ref itself. */
const pathOfSource = (ref: string): string => ref.replace(/^central:source:(?:control:root|project:[^:]+):/, '')
/** The instant a return was minted, from its ref (Central's source_return.rs mints `<prefix><unix nanos>-<pid>`), in ms; else null. */
export function returnMintedMs(returnRef: string): number | null {
  const match = /:(\d{13,})-\d+$/.exec(returnRef)
  return match ? Math.floor(Number(match[1]) / 1e6) : null
}

/** Central's returned work that waits as the queue's proposals (software-factory__approvals.tsx:14-16): each return pending or applying,
 * {id (its ref), kind proposal, who (the session's agent, else its session), text and where (the source it proposes to change), session,
 * age (seconds since it was minted)}. Accepted and rejected returns wait no more. */
export function proposalRows(entries: readonly SourceReturnEntry[], tracks: readonly AgentSessionTrack[] | null | undefined, nowUnixMs: number | undefined): Record<string, Value>[] {
  return entries.filter(entry => entry.status === 'pending' || entry.status === 'applying').map(entry => {
    const track = tracks?.find(item => item.sessionRef === entry.agent_session_ref)
    const minted = returnMintedMs(entry.return_ref)
    const path = pathOfSource(entry.source_ref)
    return {id: entry.return_ref, kind: 'proposal', who: track?.agentName ?? track?.agentRef ?? entry.agent_session_ref, text: path, where: path,
      session: track?.purpose ?? entry.agent_session_ref, ...(entry.status === 'applying' ? {flag: 'applying'} : {}),
      ...(minted !== null && nowUnixMs ? {age: Math.max(0, Math.round((nowUnixMs - minted) / 1000))} : {})}
  })
}

export function approvalsValues(input: ApprovalsInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, APPROVALS_ID)
  for (const [key, value] of Object.entries(APPROVALS_VIEW)) values[key] = view[key] ?? value
  put(values, 'pick', view.pick)
  put(values, 'approvals', input.gateway.approvals)
  const requests = input.session && input.encounter ? queueRows(pendingPermissions(input.encounter), input.session) : null
  const proposals = input.returns ? proposalRows(input.returns.entries, input.tracks, input.nowUnixMs) : null
  const units = input.units ? unitRows(input.units, input.session, input.nowUnixMs) : null
  if (requests || proposals || units) {
    const rows = [...(proposals ?? []), ...(units ?? []), ...(requests ?? [])]
    values.queue = JSON.stringify(rows)
    values.light = rows.length ? 'lit' : 'dark'
  }
  return values
}

export interface ApprovalsPorts {
  /** The shown session's encounter `permission` verb (absent: not observed). */
  readonly permission?: (requestId: string, decision: PermissionDecision) => Promise<void>
  /** Accept one returned proposal through Central (projectcentral.source.return_accept, the person's press: sourceReturnAccept.ts
   * acceptSourceReturn), with the row as Central lists it. Rejects with the refusal, or Central's words. Absent: Approve stands disabled. */
  readonly approve?: (row: SourceReturnEntry) => Promise<unknown>
  /** Answer one unit decision's question through Central's receiving Review (the kernel's `receiving` op, the person's press), in the
   * register its return belongs to. Absent: no carrier stands. */
  readonly answerUnit?: (project: string | null, review: {kind: 'review'; return_ref: string; expected_return_revision: string; disposition: 'answered'; answer: string}) => Promise<unknown>
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
 * shown session's encounter, with the harness's own choice; Approve through Central's acceptance (the `approve` port); the view's
 * settings held by the shell; Wait, On no answer and Changes stand disabled with what they lack. */
export function approvalsBinding(input: ApprovalsInput, gateway: Pick<DesignBinding, 'write' | 'standing'> | null, ports: ApprovalsPorts, id: string = APPROVALS_ID): DesignBinding {
  const requests = input.encounter ? pendingPermissions(input.encounter) : []
  const standing: Record<string, Standing> = disabled(APPROVALS_REFUSE)
  const verb = !input.session ? 'No session is shown: select one, or pin the Thread to one.' : !input.encounter ? 'The session\'s conversation is not read yet.'
    : verbStanding(input.encounter, 'permission')
  // A unit decision needs no conversation: while one waits, each answer is judged at the press, on the item chosen.
  const unitsWait = waitingDecisions(input.units).length > 0
  if (verb && !unitsWait) for (const key of ['allowOnce', 'allowAlways', 'deny']) standing[key] = {disabled: verb}
  if (gateway?.standing?.approvals) standing.approvals = gateway.standing.approvals
  if (!ports.approve) standing.approve = {disabled: APPROVE_UNWIRED}
  return {
    // `id` is the chain's own (Factory's Main track, or Central's: CentralDevices.tsx); the view's settings are the one Approvals'.
    id,
    values: approvalsValues(input),
    standing,
    local: Object.fromEntries(APPROVALS_LOCAL.map(key => [key, (value: Value | undefined) => holdView(APPROVALS_ID, key, value)])),
    writes: key => key === 'approvals' || key === 'allowOnce' || key === 'allowAlways' || key === 'deny' || key === 'approve' || key in APPROVALS_REFUSE,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'approvals') {
          if (!gateway?.write) throw Error('The Gateway is not drawn on its owner here, so nothing carries the default answer.')
          await gateway.write([{key, value}])
          continue
        }
        if (key === 'allowOnce' || key === 'allowAlways' || key === 'deny') {
          if (waitingDecisions(input.units).some(item => item.humanRequestRef === value)) {
            const asked = unitAnswer(input.units, value, key, input.person ?? null)
            if ('refused' in asked) throw Error(asked.refused)
            if (!ports.answerUnit) throw Error('The kernel carrier is unavailable here, so Central\'s receiving field cannot be asked.')
            await ports.answerUnit(asked.project, asked.review)
            continue
          }
          if (verb || !ports.permission) throw Error(verb ?? 'The session\'s conversation is not observed here.')
          const request = requests.find(item => item.native_request_id === value)
          if (!request) throw Error('That request no longer waits: AIKit reports it answered or gone.')
          const decision = choiceFor(request, key)
          if (!decision) throw Error(`The request offers no ${key === 'allowOnce' ? 'once' : 'always'} choice; answer it in the thread pane.`)
          await ports.permission(request.native_request_id, decision)
          continue
        }
        if (key === 'approve') {
          // The proposal as Central lists it, read again at the press: its basis and status are what the acceptance is checked on.
          if (!ports.approve) throw Error(APPROVE_UNWIRED)
          if (!input.returns) throw Error('Approve: Central\'s source returns have not answered, so no proposal stands to accept.')
          const row = input.returns.entries.find(entry => entry.return_ref === value)
          if (!row) throw Error('Approve: that proposal is not among the returns Central lists now.')
          await ports.approve(row)
          continue
        }
        throw Error(APPROVALS_REFUSE[key as keyof typeof APPROVALS_REFUSE] ?? reading(key))
      }
    },
  }
}
