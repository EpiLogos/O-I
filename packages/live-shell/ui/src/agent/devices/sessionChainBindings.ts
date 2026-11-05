// The session's own devices beside the chain on their owners (lane BF3): the Run (DLW §19.1, software-factory:run-device — "on the
// session's chain"), Custody (§19.13, software-factory:agent-custody — "on the Agent device; the Agent's face shows it") and the
// Agent rack (§19.15, software-factory:agentset-rack — on every session's track: "A session of one agent has a rack of that one chain";
// O-I #842).
//
// What the owners report, read 16 Oct 2026 (scratch lane-bf3/shapes/, lane-bf2/shapes/):
//   the agency reading (agency_read + the roster + each session's task record + temporal_events_read, built by
//     AgentSessionsProvider into agent/agentRunModel.ts tracks): a session's tasks (TaskClip n, title, state, start, last activity),
//     its needle (the last check-in on the shared axis, sharedAxis agentRunModel.ts:280 — a window ending at the reading instant),
//     its budget, and a group track for each SessionSpace with its member sessions at depth 1 (buildTracks agentRunModel.ts:302);
//   the session's task record (encounter_task_read, agentChainDevices.ts taskReading): its turns (a `custody` or `autonomy` word is no
//     setting: the Agent's Autonomy is retired, DLW §19.4 and §19.12, Scope's Tool calls carrying what it set);
//   AIKit's encounter view (the Thread's rows, threadBinding.ts threadJson) — the Run's full view is the thread.
// What no kernel op reaches: a session's Factory run (factory_attempt_read needs a run ref the agency reading never names, so the
//   Run's takes are absent), the event lanes (the temporal stream names the session, not Messages · Files · Terminal · Web · Graph),
//   Hermes' subagent tree and delegation block (subagent.list over tui_gateway; no config.set key). Each is absent here and each write
//   that needs one stands disabled with the operation it lacks. The Run and workflow unit a member's task stands on are Factory's own
//   reading (factory_owner attempt-task-units), which the rack's Retry carrier reads at the press. Pure, apart from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {HeadAct, HeadActEntry} from '../../frame/devices/deviceDoor'
import type {AgentSessionTrack, TaskClip} from '../agentRunModel'
import type {ActionAnswer} from '../../central/devices/centralActions'
import {AGENT_AUTONOMY_RETIRED, chainHolds, holdView, viewHolds, type ChainHolds} from './designBindings'
import {rackStateOf, runStateOfSession} from './runFaces'
import {familyFaceDevice} from './mainTrackBindings'
import {sessionRowsOf} from './threadBinding'
import {DECISION_HELPER_DESIGN, DECISION_HELPER_ID} from './decisionHelperBinding'
import {macroTurns, RACK_MACROS, type RackMacro, type RackNode} from '../../inhabitants/sdk/chains'
import {trackKey} from '../agentRunModel'
import {decodeChainDrag} from '../agentChainDrag'
import {ROOT_REGISTER} from '../worldScope'
import type {NativeModelReading, NativeModelRequest} from '../../../../../../desktop/cradle/src/encounter/nativeModel'

export const RUN_DESIGN = 'software-factory:run-device'
export const CUSTODY_DESIGN = 'software-factory:agent-custody'
export const AGENTSET_DESIGN = 'software-factory:agentset-rack'
export const RUN_ID = 'factory:run'
export const CUSTODY_ID = 'factory:custody'
export const AGENTSET_ID = 'factory:agentset'

/** The session's devices of the runtime, each of its admitted face (designKey(family, face.id) is its design's id); null when the family
 * does not admit the face. The Run was retired (tickets 725 and 772: a session's course is its track in Arrangement view, §16.1); RUN_ID
 * stays as the key the Run binding's view holds are kept under, and nothing publishes it (ticket 804). */
export const sessionDevices = (): {custody: DeviceInstance | null; agentset: DeviceInstance | null} => ({
  custody: familyFaceDevice(CUSTODY_ID, 'software-factory', 'agent-custody', 'Custody', 'arm'),
  agentset: familyFaceDevice(AGENTSET_ID, 'software-factory', 'agentset-rack', 'Agent rack', 'bind'),
})

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}
const reading = (key: string) => `${key} is a reading: its owner reports it; nothing here changes it.`

// ---------------------------------------------------------------------------------------------------------------- the Run

// Telemetry is the session's own setting on AIKit (lane K0 corrected): `encounter-session-settings` `track.telemetry`, written through
// the kernel's encounter_session_settings against the revision that stands (agent/sessionSettings.ts trackSettingChange) — the Session
// view's mixer reads and writes it (timeline/factoryTrackAdapter.ts FACTORY_TELEMETRY_OP). Solo is what you attend to, never what runs
// (§16.1, §16.6): the shell holds it on the book (agent/AgentShellContext.tsx setSolo), and AIKit's own session Solo, a gate on its
// executor's launches, is never written. The Run device is handed neither, so it names each route and stands disabled here.
// AIKit's gateway agent controls (`aikit gateway agent --binding B pause|resume`) address a gateway binding's connector, never a session.
export const RUN_REFUSE = {
  telemetry: 'Telemetry: the session\'s own setting on AIKit (encounter_session_settings {track: {telemetry}}, as the Session view\'s mixer writes it); the Run device is not handed the session\'s settings or their writer, so it does not write it here (AIKit).',
  solo: 'Solo: what you attend to, which the shell holds on the book (agent/AgentShellContext.tsx setSolo), as the Session view\'s mixer solos it; the Run device is not handed the attention, so it does not solo here (the live shell).',
  take: 'No takes are read: factory_attempt_read needs the run ref of the session\'s work, and the agency reading names none.',
  open: 'No events are read into lanes: the temporal stream names the session, not Messages, Files, Terminal, Web or Graph.',
} as const

/** Whether the Run still stands on the structure its sources declare (lane W7; D3, software-factory__run-device.tsx `structure`): Factory's
 * StructuralFidelityEvidence (factory/src/structural_ground.rs:187), which T-COVERAGE §1.2's Software Factory row names and no kernel route
 * reads. */
export const RUN_STRUCTURE_UNREAD = 'The Run\'s structure: no reading reaches it yet — missing op: StructuralFidelityEvidence through the kernel (T-COVERAGE §1.2, Software Factory: "StructuralFidelityEvidence") (Software Factory).'

/** The Run's own settings the shell holds, with the manual's starting value of each (§19.17: Watch Auto, Event lanes Messages,
 * Overview On). Watch routes the session into the shell's own widgets; the lanes and the overview are the view's. */
export const RUN_VIEW: Readonly<Record<string, Value>> = {watch: 'auto', lanes: 'messages', overview: true}

export interface RunInput {
  /** The chain's session (its track); null with none, or a group. */
  readonly session: AgentSessionTrack | null
  readonly tracks: readonly AgentSessionTrack[] | null
  /** The instant the tracks were read at (AgentSessionsProvider nowUnixMs). */
  readonly nowUnixMs: number
  /** The Agent's values: its light and its session's thread (one binding feeds them). */
  readonly agent: Values
  readonly holds: ChainHolds
}

const minutes = (ms: number) => Math.max(0, Math.round(ms / 6000) / 10)

/** A session's tasks as the Run reads them (the lanes under a track in Arrangement view, dlw__arrangement-ruler.tsx:39; the Run was retired into it, §16.1): the Tasks device's rows, and `from` and `last`,
 * the minutes before the reading instant at which the task began and its output last moved. A state nobody said is left out. */
export function runTaskRows(track: AgentSessionTrack, nowUnixMs: number): Record<string, Value>[] {
  return track.tasks.filter(task => !task.softStop).map((task: TaskClip) => ({
    n: task.n,
    ...(task.title ? {name: task.title} : {}),
    ...(task.state !== 'unknown' ? {state: task.state} : {}),
    ...(task.state === 'stalled' && task.lastActivityUnixMs != null ? {idle: Math.max(0, Math.round((nowUnixMs - task.lastActivityUnixMs) / 1000))} : {}),
    ...(task.startUnixMs != null ? {from: minutes(nowUnixMs - task.startUnixMs)} : {}),
    ...(task.lastActivityUnixMs != null ? {last: minutes(nowUnixMs - task.lastActivityUnixMs)} : {}),
  }))
}

/** The Run's values: the session's lane on the run model's own axis, its needle, its thread, the sessions to choose from, the view's
 * settings. Takes, event lanes, the session's colour, Telemetry and Solo have no reading. */
export function runValues(input: RunInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, RUN_ID)
  for (const [key, value] of Object.entries(RUN_VIEW)) values[key] = view[key] ?? value
  const track = input.session
  if (!track || track.group) return values
  values.session = track.sessionRef
  if (input.tracks) values.sessions = JSON.stringify(sessionRowsOf(input.tracks))
  values.tasks = JSON.stringify(runTaskRows(track, input.nowUnixMs))
  put(values, 'light', input.agent.light)
  put(values, 'thread', input.agent.thread)
  const needle = track.needle
  if (needle) {
    if (needle.atUnixMs != null) values.needle = Math.max(0, Math.round((input.nowUnixMs - needle.atUnixMs) / 1000))
    // The ruler: the shared axis the needle stands on, one window ending at the reading instant.
    if (needle.axisEndUnixMs > needle.axisStartUnixMs) values.window = Math.round((needle.axisEndUnixMs - needle.axisStartUnixMs) / 60000)
    const at = new Date(needle.axisEndUnixMs)
    values.now = at.getHours() * 60 + at.getMinutes() + at.getSeconds() / 60
  }
  return values
}

export interface RunPorts {
  /** Move THE selection to a session (the Session chooser follows it). */
  readonly select: (sessionRef: string) => void
}

const RUN_LOCAL = Object.keys(RUN_VIEW)

/** The Run's binding: the view's settings held by the shell; the Session chooser moves THE selection; Telemetry and Solo have no owner
 * write; with no takes and no event lanes read, choosing a take or an event stands disabled with why. */
export function runBinding(input: RunInput, ports: RunPorts): DesignBinding {
  return {
    id: RUN_ID,
    values: runValues(input),
    standing: {...disabled(RUN_REFUSE), structure: {disabled: RUN_STRUCTURE_UNREAD}},
    local: {
      ...Object.fromEntries(RUN_LOCAL.map(key => [key, (value: Value | undefined) => holdView(RUN_ID, key, value)])),
      session: value => { if (typeof value === 'string' && value) ports.select(value) },
    },
    writes: key => key in RUN_REFUSE,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key} of changes) throw Error(RUN_REFUSE[key as keyof typeof RUN_REFUSE] ?? reading(key))
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- Custody

// Factory's custody writes reach the kernel since lane W3 (factory_owner {custody-assign, custody-update}: `factory development custody
// assign <state> --position P --work W --reason R [--run, --workflow-unit, --journey, --origin-communique, --state in-progress|blocked,
// --custody]` and `… update <state> --custody C --state in-progress|blocked|released|completed|handed-off --reason R [--reopen,
// --to-position P, --expected-revision N]`, both answering factory.work-custody-receipt/v1). Factory's custody record carries Review gate
// and Escalate to since EpiLogos/Factory PR 288 (set at assignment: `custody assign --review-gate diffs|approvals|both --escalate-to
// <ref>`; `update` does not change them), and the kernel's CustodyAssign carries both since lane W6 round 2 (cdbde6fe7). Autonomy is
// retired on both (lane BD round 12): Factory's `custody assign` refuses `--autonomy` in words and drops it from a record an earlier
// Factory kept, and the kernel's CustodyAssign refuses a request that still names one. Factory's custody list reaches the kernel since
// lane W6 round 3 (factory_owner custody-list: `factory development custody list <state> [--position P] [--run R] [--state S]`,
// factory.work-custody-listing/v1 {count, custody [factory.work-custody/v1: custody_ref, position_ref, work_ref, state, review_gate?,
// escalate_to?, …]}; real shape in desktop/cradle/kernel/tests/
// fixtures/owner-routes/factory-custody-list-2026-10-21.json). Lane W11 reads it for the project's Factory state:
//   held        the open records (in-progress, blocked) of the Position the session's agent holds (AIKit's population), as the held items;
//   the settings Review gate and Escalate to from the open record of the session's work (its bound task), where one stands. The manual
//   retired the Agent's Autonomy (§19.4: Factory owns what the agent holds and what it does when it stalls; §19.12: Scope's Tool calls
//   answers the harness's request to use a tool).
// Custody's held items and Hand back stand on the Agent's Run page (§19.4). Each setting is written (CustodyAssign with that one
// setting) only on the person's own press (re-checked at the press), only while the session's work is not yet assigned: the assignment's
// Position is the one the session's agent holds, the work its bound task, and the reason says who set what from the desk. A session whose
// agent holds no Position refuses naming that. Once the work is assigned, changing a setting waits for the owner's ruling, said verbatim
// (CUSTODY_SETTINGS_RULING).
/** What Factory's custody commands carry, for a refusal that names what they do not. */
const CUSTODY_CARRIES = 'Factory\'s custody assign and update (factory_owner) carry a Position, its work, a reason, the custody state — in-progress, blocked, released, completed or handed-off — and a Position to hand off to'
/** Who may change a custody record's settings after assignment: the owner's ruling to make (lane W8, 3a). */
export const CUSTODY_SETTINGS_RULING = 'Changing it after assignment waits for the owner\'s ruling on who may: `custody update` admits only the holding occupant, and Factory names no person authority for custody.'
const custodySetting = (what: string, flag: string) => `${what}: set when Factory assigns custody (\`factory development custody assign ${flag}\`); Factory's custody list is not read here for this session (\`factory development custody list\`, the kernel's factory_owner custody-list), so whether its work is assigned is not known.`
/** The settings Custody writes through CustodyAssign, each with the field and the words Factory admits. The Agent's Autonomy is not one:
 * it is retired (DLW §19.4, §19.12), and Scope's Tool calls carries what it set (AGENT_AUTONOMY_RETIRED). */
export const CUSTODY_SETTING_FIELDS: Readonly<Record<'gate' | 'escalate', {readonly field: 'review_gate' | 'escalate_to'; readonly what: string; readonly admits?: readonly string[]}>> = {
  gate: {field: 'review_gate', what: 'Review gate', admits: ['diffs', 'approvals', 'both']},
  escalate: {field: 'escalate_to', what: 'Escalate to'},
}
/** Why a setting cannot be written now, by what is missing. */
export const CUSTODY_SETTING_WHY = {
  noWork: 'no reading names the session\'s work (its bound task: encounter_task_read request.central.task_ref)',
  noState: 'Factory keeps no state for this project here (`factory development locate`)',
  noPerson: 'only the person sets it from here, and no person is current (the Nara identity names none)',
  noPosition: 'the session\'s agent holds no Position (AIKit\'s population names none whose occupant is this agent), and custody is assigned to a Position',
  noCarrier: 'the kernel carrier is unavailable here, so Factory cannot be asked',
} as const
/** The custody record states that hold work (the others close it). */
const OPEN_CUSTODY: readonly string[] = ['in-progress', 'blocked']
// The Agent's Autonomy, retired (designBindings.ts AGENT_AUTONOMY_RETIRED): Custody refuses a press that still names it in those words.
export {AGENT_AUTONOMY_RETIRED}
export const CUSTODY_REFUSE = {
  autonomy: AGENT_AUTONOMY_RETIRED,
  gate: custodySetting('Review gate', '--review-gate diffs|approvals|both'),
  escalate: custodySetting('Escalate to', '--escalate-to'),
  // The custody refs of what the session holds are read (the kernel's factory_owner custody-list); giving control back waits on Factory's
  // custody hold of what you edited (BD r19): none of the custody states is giving control back.
  handBack: missing('Hand back', `Factory's custody hold: a custody state for giving back what you edited among what the agent holds (${CUSTODY_CARRIES}; giving control back is none of these states)`, 'Software Factory'),
} as const
/** What the agent holds, where no custody is handed to the binding: the list is read on the session's own chain (FactoryDeviceChain.tsx). */
export const CUSTODY_HELD_ELSEWHERE = 'What the agent holds: Factory\'s custody list (the kernel\'s factory_owner custody-list) is read on the session\'s own chain, where Custody stands on its Agent.'
/** Custody's readings no owner reports here, each with what it waits for. */
const unread = (what: string, op: string, owner: string) => `${what}: no reading reaches it yet — missing op: ${op} (${owner}).`
export const CUSTODY_ABSENT = {
  people: unread('The people the agent may ask', 'a list of escalation contacts (no owner holds one)', 'Software Factory'),
  handBackLit: unread('The hand-back light', 'a reading of what you edited among the agent\'s held items (Factory\'s custody states name no edit)', 'Software Factory'),
} as const

// The Grants page (lanes W7, W8; D7, software-factory__agent-custody.tsx `grants`, `holder`, `worlds`, `readAt`): Actuation's governing
// authority records, read through the kernel's actuation_read {kind authority-list} (`actuation authority list --json`,
// actuation.local-authority-listing/v1: authorities [{authority_source_ref, record {holder, issued_by, metagency_grant {operations},
// allowed_world_refs, …}, issued_at_unix_seconds, revoked? {at_unix_seconds, reason}}]; real shape in desktop/cradle/kernel/tests/fixtures/
// owner-routes/actuation-authority-2026-10-21.json). Every grant in Actuation's store stands, each with its own holder: no reading names
// the Actuation holder ref of the session's agent, so `holder` and `worlds` stay absent.
// The writes: Actuation authenticates no issuer — its record is local material protected by file access, and it accepts whatever issuer a
// record names — so this binding is the only guard, and it writes only as the person's own press, with the person as who acts
// (`currentIdentity()`, handed in as `person`), never a value the desk composes:
//   Revoke  actuation_write {authority-revoke, authority_source_ref: the grant chosen, reason: the hand's reason} — only while a person is
//           current, and only for a grant the list holds and has not revoked.
//   Issue   stands disabled: `actuation authority issue` takes a whole actuation.local-authority/v1 record — the holder's governing binding
//           (actuation.agency/v1: binding, agent, agency, world, scope, bounds and authority refs) and the grant's agency, binding and
//           authority refs — and no reading here holds the holder's binding; the desk does not compose one.
const unreadGrant = (what: string, op: string) => `${what}: no reading reaches it yet — missing op: ${op} (Actuation).`
export const CUSTODY_GRANTS_ABSENT = {
  grants: 'The agent\'s grants: Actuation has not answered its authority list yet (`actuation authority list`).',
  holder: unreadGrant('Whom the grants are for', 'the Actuation holder ref of the session\'s agent (no reading here names it; each grant in the list names its own holder)'),
  worlds: unreadGrant('The worlds a grant may name', 'the World refs Actuation admits for the session\'s agent (no reading here names them)'),
  readAt: 'When the grants were read: Actuation has not answered its authority list yet.',
} as const
export const CUSTODY_GRANTS_REFUSE = {
  issue: missing('Issue', 'the holder\'s governing binding for a new actuation.local-authority/v1 record (`actuation authority issue` takes the whole record — the holder\'s actuation.agency/v1 binding and the grant\'s agency, binding and authority refs — and no reading here holds the holder\'s binding; the desk composes none)', 'Actuation'),
  /** Revoke with no person current: Actuation authenticates no one, so the desk writes only as the person. */
  revoke: 'Revoke: no person is current here (the Nara identity names none). Actuation authenticates no one, so a grant is revoked only as the current person\'s own press.',
  revokeChoose: 'Revoke: choose a grant in force in the list first.',
  /** The person changed between the drawing and the press. */
  revokePerson: 'Revoke: the current person is no longer the one this page was drawn for; nothing was sent to Actuation.',
} as const

/** One grant of Actuation's listing as the design's row (agent-custody.tsx:21-22, the Agent's Custody page's Grants): {ref, holder, issuedBy, operations,
 * worlds, issuedAt (s), revoked: {at, reason} | null}. `expiresAt` is left out: an Actuation authority record carries no expiry. Pure. */
export function grantRows(listing: unknown): Record<string, unknown>[] | null {
  const doc = listing && typeof listing === 'object' && !Array.isArray(listing) ? listing as Record<string, unknown> : null
  if (!doc || doc.schema !== 'actuation.local-authority-listing/v1' || !Array.isArray(doc.authorities)) return null
  const obj = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null)
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined)
  const words = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  return doc.authorities.flatMap(row => {
    const entry = obj(row), record = obj(entry?.record), grant = obj(record?.metagency_grant), revoked = obj(entry?.revoked)
    const ref = text(entry?.authority_source_ref)
    if (!entry || !record || !ref) return []
    const issuedAt = typeof entry.issued_at_unix_seconds === 'number' ? entry.issued_at_unix_seconds : undefined
    return [{ref, ...(text(record.holder) ? {holder: record.holder} : {}), ...(text(record.issued_by) ? {issuedBy: record.issued_by} : {}),
      operations: words(grant?.operations), worlds: words(record.allowed_world_refs), ...(issuedAt !== undefined ? {issuedAt} : {}),
      revoked: revoked ? {at: typeof revoked.at_unix_seconds === 'number' ? revoked.at_unix_seconds : null, reason: text(revoked.reason) ?? null} : null}]
  })
}

/** Actuation's authority list as the window holds it, with when it was read. */
export interface GrantsReading {
  readonly status: 'reading' | 'answered' | 'refused'
  readonly value: unknown
  readonly error: string | null
  readonly readAtUnixMs?: number | null
}

/** Custody's writes to Actuation (ownerRoutes.ts actuation_write). Absent: no carrier stands. */
export interface CustodyPorts {
  readonly revoke?: (authoritySourceRef: string, reason: string | undefined) => Promise<unknown>
  /** Factory's custody assignment (factory_owner custody-assign) with one setting. Absent: no carrier stands. */
  readonly assign?: (request: {kind: 'custody-assign'; state_path: string; position_ref: string; work_ref: string; reason: string} & Partial<Record<'review_gate' | 'escalate_to', string>>) => Promise<unknown>
  /** Who is current at the moment of the press (`currentIdentity()` read again): Revoke goes only when it is still the person the page
   * was drawn for. Absent: the person drawn stands. */
  readonly personNow?: () => string | null
}

/** The next grant's settings and the revocation's reason: the hand's own holds (agent-custody.tsx:23-24). */
export const CUSTODY_GRANT_SETTINGS: readonly string[] = ['grant:determine-agency', 'grant:configure-agency', 'grant:actualise-agency', 'grant:reintegrate-return',
  'grant:world', 'grant:expires', 'revoke:reason']

export interface CustodyInput {
  /** The chain's session, null when none is selected. */
  readonly sessionRef: string | null
  /** The Agent's values (its light: Custody stands on the Agent). */
  readonly agent: Values
  /** The hand's holds (the next grant's settings); absent, the store as it stands. */
  readonly holds?: ChainHolds
  /** Actuation's authority list (actuation_read {authority-list}); absent: not read here. */
  readonly grants?: GrantsReading
  /** The current person (`currentIdentity()`'s person ref): the only one Custody writes to Actuation as. */
  readonly person?: string | null
  /** Factory's custody of the session's work (lane W11): the project's Factory state, its custody list, the Position the session's agent
   * holds, the Position the person holds and the session's work. Absent: not read here. */
  readonly custody?: CustodyRead
}

/** Factory's custody as the chain read it for the session. */
export interface CustodyRead {
  readonly statePath: string | null
  readonly listing: {readonly status: 'reading' | 'answered' | 'refused'; readonly value: unknown; readonly error: string | null} | null
  /** The Position the session's agent holds (AIKit's population): what it holds, and where an assignment of its work goes. */
  readonly agentPosition: string | null
  readonly work: string | null
}

/** The open custody records of Factory's listing (in-progress or blocked); null when the answer is not the listing. Pure. */
export function openCustody(listing: unknown): Record<string, unknown>[] | null {
  const doc = listing && typeof listing === 'object' && !Array.isArray(listing) ? listing as Record<string, unknown> : null
  if (!doc || doc.schema !== 'factory.work-custody-listing/v1' || !Array.isArray(doc.custody)) return null
  return doc.custody.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && OPEN_CUSTODY.includes(String((row as Record<string, unknown>).state)))
}

/** Custody's values: the Agent's light, the grants, and Factory's custody of the session's work. Write mode is Scope's reading, and none is
 * reported (designBindings.ts scopeValues); the gate, the contact, the people, the held items and the hand-back light have no owner
 * reading (the transport's Re-enable light is the shell's own flag, never set by an owner). */
export function custodyValues(input: CustodyInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds ?? chainHolds(), CUSTODY_ID)
  for (const key of CUSTODY_GRANT_SETTINGS) put(values, key, view[key])
  const rows = input.grants?.status === 'answered' ? grantRows(input.grants.value) : null
  if (rows) {
    values.grants = JSON.stringify(rows)
    if (typeof input.grants?.readAtUnixMs === 'number') values.readAt = Math.floor(input.grants.readAtUnixMs / 1000)
  }
  if (input.sessionRef == null) return values
  put(values, 'light', input.agent.light)
  const open = input.custody?.listing?.status === 'answered' ? openCustody(input.custody.listing.value) : null
  if (open) {
    // What the session's agent holds: the open records of its Position, each a piece of work in its custody state.
    const position = input.custody!.agentPosition
    values.held = JSON.stringify(position ? open.filter(row => row.position_ref === position).flatMap(row => (typeof row.custody_ref === 'string' && typeof row.work_ref === 'string'
      ? [{id: row.custody_ref, name: row.work_ref, kind: 'work', state: row.state}] : [])) : [])
    // The session's work, where it is assigned: its record's settings are Factory's own.
    const record = input.custody!.work ? open.find(row => row.work_ref === input.custody!.work) : undefined
    if (record) for (const [key, {field}] of Object.entries(CUSTODY_SETTING_FIELDS)) put(values, key, typeof record[field] === 'string' ? record[field] as string : undefined)
  }
  return values
}

/** Custody's binding: Write mode is Scope's own key and row (one binding feeds both: the same write, the same standing); every other
 * setting has no owner write and stands disabled with the operation it lacks. */
export function custodyBinding(input: CustodyInput, scope: Pick<DesignBinding, 'write' | 'standing'> | null, ports: CustodyPorts = {}): DesignBinding {
  const values = custodyValues(input)
  const standing: Record<string, Standing> = {...disabled(CUSTODY_ABSENT), ...disabled(CUSTODY_REFUSE), issue: {disabled: CUSTODY_GRANTS_REFUSE.issue}}
  for (const key of ['holder', 'worlds'] as const) standing[key] = {disabled: CUSTODY_GRANTS_ABSENT[key]}
  const listWhy = input.grants?.status === 'refused' ? input.grants.error ?? CUSTODY_GRANTS_ABSENT.grants
    : input.grants?.status === 'answered' && !('grants' in values) ? '`actuation authority list` answered something other than its listing.' : null
  if (!('grants' in values)) standing.grants = {disabled: listWhy ?? CUSTODY_GRANTS_ABSENT.grants}
  if (!('readAt' in values)) standing.readAt = {disabled: listWhy ?? CUSTODY_GRANTS_ABSENT.readAt}
  const person = typeof input.person === 'string' && input.person.trim() ? input.person : null
  const revokeWhy = !ports.revoke ? 'Revoke: the kernel carrier is unavailable here, so Actuation cannot be asked (`actuation authority revoke` through the kernel\'s actuation_write).'
    : !person ? CUSTODY_GRANTS_REFUSE.revoke : !('grants' in values) ? standing.grants!.disabled! : null
  if (revokeWhy) standing.revoke = {disabled: revokeWhy}
  standing.writeMode = scope?.standing?.writeMode ?? {disabled: 'Write mode is Scope\'s: the chain\'s Scope is not drawn on its owner here.'}
  // Factory's custody (lane W11): what the agent holds, and each setting on the session's work.
  const custody = input.custody ?? null
  const listing = custody?.listing ?? null
  const open = listing?.status === 'answered' ? openCustody(listing.value) : null
  const listingWhy = !custody ? null : listing?.status === 'refused' ? listing.error ?? 'Factory refused its custody list.'
    : listing?.status === 'reading' ? 'Factory has not answered its custody list yet (`factory development custody list`).'
      : !listing ? (custody.statePath ? 'Factory\'s custody list is not read yet.' : `Factory's custody list: ${CUSTODY_SETTING_WHY.noState}.`)
        : !open ? '`factory development custody list` answered something other than its listing.' : null
  if ('held' in values) delete standing.held
  else standing.held = {disabled: listingWhy ?? CUSTODY_HELD_ELSEWHERE}
  const assigned = open && custody?.work ? open.find(row => row.work_ref === custody.work) : undefined
  /** Why one setting cannot be written now, in words; null when the person's press may assign it. */
  const settingWhy = (key: keyof typeof CUSTODY_SETTING_FIELDS): string | null => {
    const {what} = CUSTODY_SETTING_FIELDS[key]
    if (!custody) return CUSTODY_REFUSE[key]
    if (listingWhy) return `${what}: ${listingWhy}`
    if (!custody.work) return `${what}: ${CUSTODY_SETTING_WHY.noWork}.`
    if (assigned) return `${what}: the session's work is assigned already (${String(assigned.custody_ref)}, held by ${String(assigned.position_ref)}). ${CUSTODY_SETTINGS_RULING}`
    if (!custody.statePath) return `${what}: ${CUSTODY_SETTING_WHY.noState}.`
    if (!person) return `${what}: ${CUSTODY_SETTING_WHY.noPerson}.`
    if (!custody.agentPosition) return `${what}: ${CUSTODY_SETTING_WHY.noPosition}.`
    if (!ports.assign) return `${what}: ${CUSTODY_SETTING_WHY.noCarrier}.`
    return null
  }
  for (const key of ['gate', 'escalate'] as const) {
    const why = settingWhy(key)
    if (why) standing[key] = {disabled: why}
    else delete standing[key]
  }
  /** One setting written as the assignment of the session's work to the person's Position (CustodyAssign with that one setting). */
  const assign = async (key: keyof typeof CUSTODY_SETTING_FIELDS, value: Value | undefined) => {
    const why = settingWhy(key)
    if (why) throw Error(why)
    if (ports.personNow && ports.personNow() !== person) throw Error(`${CUSTODY_SETTING_FIELDS[key].what}: the current person is no longer the one this page was drawn for; nothing was sent to Factory.`)
    const {field, what, admits} = CUSTODY_SETTING_FIELDS[key]
    if (typeof value !== 'string' || !value.trim() || (admits && !admits.includes(value))) throw Error(`${what}: ${admits ? `one of ${admits.join(', ')}` : 'a person to escalate to'}.`)
    await ports.assign!({kind: 'custody-assign', state_path: custody!.statePath!, position_ref: custody!.agentPosition!, work_ref: custody!.work!,
      reason: `${person} set ${what} to ${value} from the desk.`, [field]: value})
  }
  /** Revoke: the grant the list holds and has not revoked, as the current person's own press; Actuation's refusal is its own words. */
  const revoke = async (value: Value | undefined) => {
    if (revokeWhy) throw Error(revokeWhy)
    if (ports.personNow && ports.personNow() !== person) throw Error(CUSTODY_GRANTS_REFUSE.revokePerson)
    const rows = (input.grants?.status === 'answered' ? grantRows(input.grants.value) : null) ?? []
    const row = rows.find(grant => grant.ref === value)
    if (typeof value !== 'string' || !row || row.revoked) throw Error(CUSTODY_GRANTS_REFUSE.revokeChoose)
    const reason = viewHolds(input.holds ?? chainHolds(), CUSTODY_ID)['revoke:reason']
    await ports.revoke!(value, typeof reason === 'string' && reason.trim() ? reason.trim() : undefined)
  }
  return {
    id: CUSTODY_ID,
    values,
    standing,
    local: Object.fromEntries(CUSTODY_GRANT_SETTINGS.map(key => [key, (value: Value | undefined) => holdView(CUSTODY_ID, key, value)])),
    writes: key => key === 'writeMode' || key in CUSTODY_REFUSE || key === 'issue' || key === 'revoke',
    write: async changes => {
      for (const {key, value} of changes) {
        if (key === 'writeMode') {
          if (!scope?.write) throw Error(standing.writeMode!.disabled!)
          await scope.write([{key, value}])
          continue
        }
        if (key === 'revoke') { await revoke(value); continue }
        if (key === 'gate' || key === 'escalate') { await assign(key, value); continue }
        // Issue: the desk composes no authority record, whoever the value names as its issuer.
        if (key === 'issue') throw Error(CUSTODY_GRANTS_REFUSE.issue)
        throw Error(CUSTODY_REFUSE[key as keyof typeof CUSTODY_REFUSE] ?? reading(key))
      }
    },
  }
}

/** The keys of Scope's Asks and Grants pages that Custody's binding owns (§19.12): Before it lands (`gate`) and Escalate to (`escalate`,
 * among `people`) are Factory's custody record's review gate and escalation contact, and the grants are Actuation's authority list, with
 * the next grant's settings, Issue and Revoke. */
export const SCOPE_CUSTODY_KEYS: readonly string[] = ['gate', 'escalate', 'people', 'grants', 'holder', 'worlds', 'readAt', ...CUSTODY_GRANT_SETTINGS, 'issue', 'revoke']

/** Scope with Custody's keys laid in under their own names: a value is Custody's reading, a change goes to Custody's owner, a refusal is
 * that owner's; every other key stays Scope's. One binding feeds both, so the Agent's Custody page and Scope draw the same gate. Pure. */
export function withCustodyAsks(scope: DesignBinding, custody: DesignBinding): DesignBinding {
  const mine = (key: string) => SCOPE_CUSTODY_KEYS.includes(key)
  const pick = <T>(record: Readonly<Record<string, T>> | undefined): Record<string, T> => Object.fromEntries(Object.entries(record ?? {}).filter(([key]) => mine(key)))
  const owner = (key: string) => (mine(key) ? custody : scope)
  return {
    ...scope,
    values: {...scope.values, ...pick(custody.values)},
    standing: {...(scope.standing ?? {}), ...pick(custody.standing)},
    local: {...(scope.local ?? {}), ...pick(custody.local)},
    writes: key => { const at = owner(key); return !!at.write && (at.writes ? at.writes(key) : true) },
    write: async changes => {
      for (const change of changes) {
        const at = owner(change.key)
        if (!at.write) throw Error(reading(change.key))
        await at.write([change])
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Agent rack

// The rack on every session's track (O-I #842; §19.15 "A session of one agent has a rack of that one chain"): a group's chains are the
// sessions of its SessionSpace (and the Decision helper where one stands); a lone session's one chain is its own agent, whose devices stand
// beside the rack on the track's chain itself (FactoryDeviceChain.tsx), every setting live, so the rack keeps no copy of them (`beside`).
// The chain list's controls are AIKit's session-space operations (#745 with #772), each through the kernel: the Activator benches a chain's
// session in its space (bench-agent-session; encounter_session_bench), Add a chain attaches a standing session to the rack's space
// (attach-agent-session; encounter_session_attach), Drag out seats a chain's session in a space of its own, chain and all
// (`aikit session-space drag-out`; encounter_session_drag_out), Hot-Swap seats the agent dropped on it from the browser in the chain's place
// (`aikit session-space hot-swap`; encounter_session_hot_swap: a separately attributed session of that agent, with the chain's bench, track
// settings and task, the old one detached last, so a session still never becomes another agent), and a Decision helper dropped under the
// chain list becomes the space's helper (bind-decision-helper; encounter_session_decision_helper). A group's Model and Effort macros turn
// each agent chain's own session through AIKit's model select of that session (the encounter's model-read and model-select, the cradle's
// route: encounter/nativeModel.ts), never the focused harness's Effort (shell.setEffort). Join is Central's set. Where no carrier stands
// the control stands dimmed and names it.
const DELEGATION = (what: string, key: string) => missing(what, `Hermes' delegation block (${key}) through the kernel: no config.set key carries it`, 'Hermes')
/** A macro turns one setting of the Agent on every chain (§19.15 Macros); the rack holds each chain's session, never another session's Agent. */
const MACRO = (what: string) => missing(what, `the ${what} macro turning the Agent's ${what} on every chain: the rack holds each chain's session, and no address of its Agent's ${what}`, 'Software Factory')
/** A group's Model and Effort turn each chain's own session, through AIKit's model select of that session (the encounter's model-read, then
 * model-select, bound to the native session the read names: desktop/cradle/src/encounter/nativeModel.ts, the cradle's own route). */
const SESSION_MACRO = (what: string) => `${what}: no carrier to AIKit's model select of each chain's session (its encounter's model-read and model-select, through the kernel) stands on this rack.`
export const AGENTSET_REFUSE = {
  fanOut: DELEGATION('Fan-out', 'delegation.max_concurrent_children'),
  depth: DELEGATION('Depth', 'delegation.max_spawn_depth'),
  handBack: DELEGATION('Hand-back', 'the helper\'s return form'),
  returnCap: DELEGATION('Summary cap', 'delegation.max_summary_chars'),
  model: SESSION_MACRO('Model'),
  effort: SESSION_MACRO('Effort'),
  budget: MACRO('Budget'),
  unmapped: missing('Unmap', 'keeping one chain\'s setting apart from its macro, with the rack\'s macros', 'Software Factory'),
  store: missing('Store', 'keeping where every macro stands as a variation of the rack', 'Software Factory'),
  variation: missing('Variations', 'moving every macro to where a stored variation keeps it', 'Software Factory'),
  // The chain list's controls (§19.15): each acts on a chain's session in its session space, or on what you attend to. With no carrier
  // handed to the rack, each names the operation that carries it (O-I #772, #745).
  bench: 'Activator: no carrier to AIKit\'s bench of a chain\'s session in its space (the kernel\'s encounter_session_bench) stands on this chain.',
  // Solo is what you attend to, never what runs (§16.1 Live's acts: Solo is never "A limit on what may run"; §16.6 Rules): the shell's
  // attention on the book (AgentRackPorts.solo, the agent shell's setSolo), the one the Session view's mixer solos. AIKit's session Solo is
  // a launch gate (encounter_task_executor.rs, the Solo gate) and is never written. Refused only where no attention is handed.
  solo: missing('Solo', 'what you attend to, handed to this rack: the book\'s world context holds it (agent/AgentShellContext.tsx soloed, setSolo)', 'the live shell'),
  // Hot-Swap keeps the chain and swaps its agent (§19.15). AIKit keeps a session's agent for good (encounter_agency.rs configure_agency), so
  // its hot-swap seats a separately attributed session of the other agent in the chain's place and takes the old one off.
  swap: 'Hot-Swap: no carrier to AIKit\'s hot-swap of a chain\'s agent in its space (the kernel\'s encounter_session_hot_swap) stands on this chain.',
  extract: 'Drag out: no carrier to AIKit\'s drag out of a chain\'s session into a space of its own (the kernel\'s encounter_session_drag_out) stands on this chain.',
  add: 'Add a chain: no carrier to AIKit\'s attach of a standing session to this rack\'s space (the kernel\'s encounter_session_attach) stands on this chain.',
  // Delete (⌫ on the chosen chain, as Live deletes a chain) does what the chain's own session track's Delete does (§10.9 Track: Delete):
  // AIKit detaches the session from the space that holds it; on the Decision helper, AIKit takes the helper off with its session.
  delete: 'Delete: no carrier to AIKit\'s detach of a chain\'s session from its space (the kernel\'s encounter_session_detach, as the session track\'s own Delete) stands on this chain.',
  // The Devices view (§19.15 "Change a setting there and you change the agent"): each device of a chain answers to its own owner, and the
  // rack holds each chain's session, never the binding of a device of another session's chain.
  // A device of another session's chain is that session's (DLW build ruling 2026-11-05): the change goes to it as a message through
  // Messages' delegate (AIKit's gateway send to its agent's Position, then delegate onto the session's task: the route a message dropped on a
  // track takes, O-I ticket 757), never a write of another chain's binding.
  dev: 'Devices: no carrier to Messages\' delegate stands on this rack. A change of a device of another session\'s chain goes as a message to that session through Messages\' delegate (AIKit\'s gateway send, then delegate onto its task).',
  // Factory retries a unit of a Run under the unit's retry grant (factory_owner attempt-retry, lane K0; the Run map's Retry), and names the
  // units a task stands on (factory_owner attempt-task-units, O-I ticket 772): the chosen chain's task's units read, then its unit retried
  // (taskBindings.ts retryTask).
  retry: 'Retry: no carrier to Factory\'s attempt-task-units and attempt-retry stands on this rack, so the chosen chain\'s task cannot be read or retried (Software Factory).',
} as const
/** What the chain list refuses with its carriers standing: a press on what is no chain of the rack, the Decision helper where it has nothing
 * to do (it answers every agent of a group's rack and is given no work), a drop that names no standing session (AIKit attaches a session
 * that stands; an agent from the browser has none yet), and a Hot-Swap that names no other agent. */
const FAMILY_WORD: Readonly<Record<string, string>> = {skillset: 'skill set', git: 'Git seat'}
export const CHAIN_LIST_REFUSE = {
  notChain: (control: string, id: string) => `${control}: "${id}" is not a chain of this rack.`,
  helperBench: 'Activator: the Decision helper answers the agents of the rack and is given no work of its own, so there is nothing of it to bench.',
  helperOut: 'Drag out: the Decision helper answers every agent of the rack, so it does not work alone on a track of its own.',
  helperStands: 'Add a chain: one Decision helper answers every agent of a rack, and this rack\'s already stands.',
  helperLone: 'Add a chain: a Decision helper answers the agents of a group\'s rack, and this session works alone. Group it with other chains first.',
  helperUncarried: 'Add a chain: no carrier to AIKit\'s Decision helper of this rack\'s space (the kernel\'s encounter_session_decision_helper) stands on this chain.',
  agent: 'Add a chain: only a session that stands joins the list, and an agent from the browser has no session yet. Seat it on a track first, then drag its session here.',
  family: (family: string) => `Add a chain: only a session that stands joins the list, and a ${FAMILY_WORD[family] ?? family} is not one.`,
  already: (name: string) => `Add a chain: ${name} is already a chain of this rack.`,
  unnamed: 'Add a chain: what was dropped names no session.',
  noRack: 'Add a chain: choose a session or a group first: no rack stands here to add to.',
  swapPress: 'Hot-Swap: drag the other agent from the browser onto Hot-Swap: AIKit seats that agent\'s own session in this chain\'s place, with its settings, bench and task, and takes this one off.',
  swapSame: (name: string) => `Hot-Swap: ${name} is already this chain's agent.`,
  swapSession: 'Hot-Swap: a session already stands, and Hot-Swap swaps in an agent from the browser. To add the session as a chain, drop it under the chain list.',
  swapFamily: (family: string) => `Hot-Swap: only an agent from the browser swaps into a chain, and a ${FAMILY_WORD[family] ?? family} is not one.`,
  swapUnnamed: 'Hot-Swap: what was dropped names no agent.',
  swapHelper: 'Hot-Swap: the Decision helper answers every agent of the rack and holds no agent to swap.',
  helperUnnamed: 'Delete: no Decision helper stands on this rack: AIKit\'s record of its space names none, so there is none to take off.',
  noneChosen: (control: string) => `${control}: choose a chain in the list first.`,
  helperRetry: 'Retry: the Decision helper answers the agents of the rack and is given no task of its own, so there is nothing of it to retry.',
  devChange: 'Devices: the change names no setting and value (a JSON object of the device\'s settings), so no message was sent.',
  devUnseated: (name: string) => `Devices: ${name}'s session seats no agent, so no Position takes a message for it.`,
} as const

/** What the rack's Hot-Swap sends when an agent is dropped on it (software-factory__agentset-rack.tsx): the chosen chain and the drop. */
export const hotSwapDrop = (chain: string, dropped: string): string => JSON.stringify({chain, agent: dropped})

/** A drop under the chain list that names the Decision helper (its device, ai-kit:decision-helper, or its chain). */
const namesHelper = (value: Value | undefined): boolean => typeof value === 'string' && value.includes('decision-helper')

/** The session a drop under the chain list names (a browser row's drag, AgentShellBrowser.tsx: `${spaceRef}:${sessionRef}`; or a session's
 * own ref), or why it names none. */
function droppedSession(value: Value | undefined): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw Error(CHAIN_LIST_REFUSE.unnamed)
  const decoded = decodeChainDrag(text)
  let session = text
  if (decoded?.kind === 'chain-item') {
    if (decoded.drag.family === 'agent') throw Error(CHAIN_LIST_REFUSE.agent)
    if (decoded.drag.family !== 'session') throw Error(CHAIN_LIST_REFUSE.family(decoded.drag.family))
    const at = decoded.drag.ref.indexOf(':')
    session = at >= 0 ? decoded.drag.ref.slice(at + 1) : decoded.drag.ref
  } else if (decoded) throw Error(CHAIN_LIST_REFUSE.unnamed)
  if (!/^agent-session\/[^\s:]+$/.test(session)) throw Error(CHAIN_LIST_REFUSE.unnamed)
  return session
}

/** A chain's own key (`bench:<id>`, `solo:<id>`, `dev:<id>@<device>`): the refusal of the control it belongs to. */
const memberControl = (key: string): keyof typeof AGENTSET_REFUSE | undefined =>
  (key.startsWith('bench:') ? 'bench' : key.startsWith('solo:') ? 'solo' : key.startsWith('dev:') ? 'dev' : undefined)

// Join (O-I ticket 684): how the chains' returns combine is Central's agent set's (central.agent-set/v1 `join`). The group is an AIKit SessionSpace,
// whose record names the set it runs (AIKit `agent_set`: tied when Central's team is prepared into the space, inhabit_team_native.rs
// tie_team_set, or staged as `aikit session-space stage` bind-agent-set); the rack reads the set (central.agent-set.read {scope root, ref}) and
// writes a new join through central.agent-set.save at the set's next revision (`rN` to `rN+1`, compare-and-swap on the one it read).
// Where the returns combine: Software Factory's barrier reads a team step's join from the set as the Run starts and keeps it with the Run
// (O-I ticket 684; orchestration.rs record_step_join, barrier_reading): All waits for every chain before an independent reviewer synthesises, First
// closes the step on the first acceptable return, and Quorum and Weighted are refused (the set names no count and no weights). AIKit's team
// hands each member's Return to its parent one by one (`aikit gateway team read`); None is one Return read alone. A lone session's rack is
// no set of agents, so it has no Join to read, and says how to tie one (§19.15 Join).
export const JOINS = ['none', 'all', 'first', 'quorum', 'weighted'] as const
export const JOIN_UNTIED = 'Join: this rack names no Central agent set, so no record says how its returns combine. AIKit ties a session space to its set when '
  + 'the set\'s team is prepared into it; tie one by hand with `aikit session-space stage` and the bind-agent-set intent (AIKit).'
const JOIN_READING = (ref: string) => `Join: Central has not answered its agent set ${ref} yet (\`central.agent-set.read\`).`
const JOIN_UNSAVED = (ref: string) => `Central's set ${ref} names no join: none was saved with it. Choose one to save it.`

// Group (§19.15 "Making a rack and a set": "select agents' chains and choose Group … Central proposes the set, and you accept it as you
// accept an agent"): the chains you choose (`grouping`, the hand's) open the card with them (`new.chains`); Make asks Central to propose them as
// a set of agents — central.agent-set.propose {scope root, ref, revision r1, members [{kind agent, agent_ref}], reason: what it is for}, the
// person's own act (desktop/cradle/kernel/src/action.rs PERSON_ACTS), as Messages' group does (messagesBinding.ts make), with the set's type
// (a pattern's id, Central PR 318); Accept saves Central's record at its revision (central.agent-set.save); Discard removes the proposal at the
// revision Central wrote (central.agent-set.remove {scope, ref, expected_revision}, among PERSON_ACTS since C26 6311e404c).
export const GROUP_REFUSE = {
  few: 'Group: choose at least two chains to make a set of them.',
  purpose: 'Say what the set is for first.',
  noCarrier: 'Group: no carrier to Central\'s central.agent-set.propose stands on this chain.',
  noProposal: 'Nothing is proposed yet: choose the chains, say what the set is for and press Make.',
  unseated: (name: string) => `${name}: its session seats no agent, so Central cannot hold it in a set.`,
  /** A type Central would refuse: a pattern's id is a lowercase word (ctrl world.rs validate_set_type). */
  badType: (type: string) => `Type: a set's type is a pattern's id — a lowercase word of at most 64 letters, digits or -, letters first — not "${type}".`,
  noRemover: 'Discard: no carrier to Central\'s central.agent-set.remove stands on this chain.',
} as const
/** A set's type as Central admits it (ctrl/src/world.rs validate_set_type: at most 64 characters, a lowercase letter first, then lowercase
 * letters, digits or `-`). */
export const SET_TYPE = /^[a-z][a-z0-9-]{0,63}$/
/** The card's keys the hand holds (the design's `new.*` and the chains chosen for Group). */
const CARD_LOCAL = ['grouping', 'new.open', 'new.for', 'new.type', 'new.chains', 'new.proposal'] as const

/** The rack's carriers: Central's central.agent-set.save and .propose, the person's own acts through the kernel's invoke_action; the
 * session's own Agent, whose own writes a macro turns on a lone session's chain; a fresh suffix for a proposed set's ref and for the space a
 * chain is dragged out into; AIKit's bench, attach, drag out, hot-swap and detach of a chain's session and its Decision helper of a space
 * (the kernel's encounter_session_bench, _attach, _drag_out, _hot_swap, _detach and _decision_helper). Each absent: no carrier stands. */
export interface AgentRackPorts {
  readonly saveSet?: (input: {scope: 'root'; record: Record<string, unknown>; expected_revision: string}) => Promise<unknown>
  readonly propose?: (input: {scope: 'root'; ref: string; revision: 'r1'; members: {kind: 'agent'; agent_ref: string}[]; reason: string; type?: string}) => Promise<unknown>
  /** Discard: Central's central.agent-set.remove of the proposal, at the revision Central wrote. */
  readonly removeSet?: (input: {scope: 'root'; ref: string; expected_revision: string}) => Promise<unknown>
  /** Retry: the chosen chain's session's task through Factory (its units read, its unit retried: taskBindings.ts retryTask). */
  readonly retry?: (input: {project: string; agent_session: string}) => Promise<unknown>
  /** A device of another session's chain changed: the words go to that session as a message through Messages' delegate. */
  readonly ask?: (input: {project: string; agent_session: string; agent_ref: string; device: string; change: Readonly<Record<string, unknown>>; words: string}) => Promise<unknown>
  readonly agent?: DesignBinding | null
  readonly suffix?: () => string
  /** Solo a chain (on) or lift its solo, by its track's key: what you attend to (the agent shell's setSolo), no owner asked. */
  readonly solo?: (trackRef: string, on: boolean) => void
  /** The Activator: bench a chain's session in its space (true) or lift its bench. */
  readonly bench?: (input: {project: string; space: string; agent_session: string; benched: boolean}) => Promise<unknown>
  /** Add a chain: attach a standing session to the rack's space. */
  readonly attach?: (input: {project: string; space: string; agent_session: string}) => Promise<unknown>
  /** Drag out: seat a chain's session in a space of its own (`into`, named for it), chain and all, and take it out of its space. */
  readonly dragOut?: (input: {project: string; space: string; agent_session: string; into: string; label: string}) => Promise<unknown>
  /** Hot-Swap: seat the other agent's own session in the chain's place, with its settings, and take the chain's session off. */
  readonly hotSwap?: (input: {project: string; space: string; agent_session: string; agent_ref: string}) => Promise<unknown>
  /** The Decision helper: seat one session of the space as the helper that answers its agents' asks (bound), or take it off. */
  readonly decisionHelper?: (input: {project: string; space: string; bound: boolean}) => Promise<unknown>
  /** Delete: detach a chain's session from the space that holds it, as its own session track's Delete does (§10.9). */
  readonly detach?: (input: {project: string; agent_session: string}) => Promise<unknown>
  /** A group's Model and Effort macros, and a lone session's Model: each chain's session's model as its harness reports it, and its select
   * of a model and effort. */
  readonly sessionModel?: {
    readonly read: (input: {project: string; agent_session: string}) => Promise<NativeModelReading>
    readonly select: (input: {project: string; request: SessionModelSelect}) => Promise<unknown>
  }
}

/** AIKit's model select of one session: the model, and the reasoning effort, the harness is asked for. */
export type SessionModelSelect = Extract<NativeModelRequest, {action: 'model-select'}>
/** A chain's session's model, as AIKit read it (the encounter's model-read), or why it was not. */
export type ChainModelReading = {readonly status: 'answered'; readonly reading: NativeModelReading} | {readonly status: 'refused'; readonly error: string}

/** The set's next revision by Central's own convention (`r1`, `r2`, … : central.agent-set.save refuses a revision that does not move). */
export function nextSetRevision(revision: string): string {
  const n = /^r(\d+)$/.exec(revision)
  if (!n) throw Error(`Central's set is at revision ${revision}, which names no next revision in the rN form the rack writes.`)
  return `r${Number(n[1]) + 1}`
}

export interface AgentRackInput {
  /** The selected group track (a SessionSpace), null when the selection is no group. */
  readonly group: AgentSessionTrack | null
  /** The selected lone session (no group): its rack has one chain, its own agent. */
  readonly session?: AgentSessionTrack | null
  /** The session's own Agent's values (designBindings.ts agentValues: model, effort, cap), where a lone session's rack reads its macros. */
  readonly agent?: Values | null
  /** Central's answer to central.agent-set.read for the set the group's space names (group.agentSet); absent while not asked. */
  readonly set?: ActionAnswer | null
  readonly tracks: readonly AgentSessionTrack[] | null
  /** The models AIKit's catalogue names (kernel model_catalogue), for the Model macro. */
  readonly models?: readonly string[] | null
  /** The instant the tracks were read at (AgentSessionsProvider nowUnixMs): a chain's needle is aged against it. */
  readonly nowUnixMs?: number
  /** The Decision helper's values (decisionHelperBinding.ts), where one stands on the group: a chain of the rack beside the agents. */
  readonly helper?: Values | null
  /** What you attend to, by the tracks' keys (the agent shell's soloed): each chain's Solo reads it. Absent: unread, and Solo stands disabled. */
  readonly soloed?: ReadonlySet<string> | null
  /** The model each session last reported using (designBindings.ts lastUsageModels, Actuation's usage records): each chain's chip. */
  readonly chainModels?: ReadonlyMap<string, string> | null
  /** Each agent chain's session's model as its harness reports it (AIKit's encounter model-read), by session: where a group's Model and
   * Effort macros stand, and the models its Model macro offers. */
  readonly chainModelReadings?: ReadonlyMap<string, ChainModelReading> | null
  readonly holds: ChainHolds
}

/** A chain's state (lane W5): the run state of its session (runFaces.ts runStateOfSession: its task's state, its needle against Factory's
 * check-in bound) as the rack names it — Working, Idle (queued), Stalled, Done or Failed (runFaces.ts rackStateOf). A chain's thread is not read
 * here, so a running chain is Working and no failure is read; a state nobody said is left out. */
function memberState(track: AgentSessionTrack, nowUnixMs: number): ReturnType<typeof rackStateOf> {
  return rackStateOf(runStateOfSession(track, null, nowUnixMs))
}

/** One session as a chain of the rack: named by its agent (else its purpose), its goal the session's purpose, its state from its tasks, its
 * chip the model it last reported using, where that is read. */
function sessionChain(track: AgentSessionTrack, nowUnixMs: number, models?: ReadonlyMap<string, string> | null): Record<string, Value> {
  const state = memberState(track, nowUnixMs), model = models?.get(track.sessionRef)
  return {id: track.sessionRef, name: track.agentName ?? track.purpose ?? track.sessionRef, ...(track.purpose ? {goal: track.purpose} : {}), ...(state ? {state} : {}),
    ...(model ? {model} : {})}
}

/** The group's chains as the rack reads them (software-factory__agentset-rack.tsx `members`): each session of the SessionSpace. agency_read
 * discloses no spawn parent below the space (agentRunModel.ts GROUP_DISCLOSURE), so every chain stands at the top; its model is the one
 * its session last reported (Actuation's usage records), and no tool count or files are reported. */
export function agentsetMembers(group: AgentSessionTrack, tracks: readonly AgentSessionTrack[], nowUnixMs = 0, models?: ReadonlyMap<string, string> | null): Record<string, Value>[] {
  return tracks.filter(track => isAgentChain(track, group)).map(track => sessionChain(track, nowUnixMs, models))
}
/** The sessions of a group's agent chains, each in its own register: what a group's Model and Effort macros read (AIKit's model-read). */
export function agentChainSessions(group: AgentSessionTrack | null, tracks: readonly AgentSessionTrack[] | null, lone?: AgentSessionTrack | null): {project: string; session: string}[] | null {
  if (!group?.group && lone && !lone.group) return [{project: lone.project ?? ROOT_REGISTER, session: lone.sessionRef}]
  if (!group?.group || !tracks) return null
  return tracks.filter(track => isAgentChain(track, group)).map(track => ({project: track.project ?? ROOT_REGISTER, session: track.sessionRef}))
}
/** A session of the group's space that is an agent's chain: the space's Decision helper is listed once, as the helper (helperMember). */
const isAgentChain = (track: AgentSessionTrack, group: AgentSessionTrack | null | undefined): boolean =>
  !!group && !track.group && track.parentRef === group.sessionRef && !track.decisionHelper

/** The Decision helper as the rack lists it (§19.15 "A decision helper is a chain like any other"): a chain whose instrument is the
 * Decision helper where an agent's chain has its Agent, its model as the helper's own binding reads it. */
export function helperMember(helper: Values): Record<string, unknown> {
  const model = typeof helper.model === 'string' ? helper.model : undefined
  return {id: DECISION_HELPER_ID, name: 'Decision helper', ...(model ? {model} : {}), chain: [{device: DECISION_HELPER_DESIGN, name: 'Decision helper'}]}
}
/** The key of a device of a chain in the rack's Devices view (software-factory__agentset-rack.tsx: `dev:<chain>@<device>`). */
export const memberDeviceKey = (member: string, device: string) => `dev:${member}@${device}`

/** The Agent's own key each macro turns (designBindings.ts agentValues: `model`, `effort`, `cap`). */
const AGENT_KEY: Readonly<Record<RackMacro, string>> = {model: 'model', effort: 'effort', budget: 'cap'}
const MACRO_WORD: Readonly<Record<RackMacro, string>> = {model: 'Model', effort: 'Effort', budget: 'Budget'}

/** The lone session whose own agent is the rack's one chain, when the selection is no group. */
const loneOf = (input: AgentRackInput): AgentSessionTrack | null => (!input.group?.group && input.session && !input.session.group ? input.session : null)

/** The rack's chains as its macros see them (inhabitants/sdk/chains.ts RackNode). */
function rackNodes(input: AgentRackInput): RackNode[] {
  const lone = loneOf(input)
  if (lone) return [{id: lone.sessionRef, kind: 'agent'}]
  const group = input.group
  if (!group?.group || !input.tracks) return []
  return [...agentsetMembers(group, input.tracks).map((chain): RackNode => ({id: String(chain.id), kind: 'agent'})),
    ...(input.helper ? [{id: DECISION_HELPER_ID, kind: 'helper' as const}] : [])]
}

/** The rack's values: its chains (a group's sessions and the Decision helper, where one stands; a lone session's own agent, its devices
 * beside the rack), the chain you chose, the models to choose from, the macros where the one agent stands, the card's holds. The
 * delegation settings are Hermes', and none is read. */
export function agentsetValues(input: AgentRackInput): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(input.holds, AGENTSET_ID)
  const group = input.group, lone = loneOf(input)
  if (lone) {
    const model = typeof input.agent?.model === 'string' ? input.agent.model : undefined
    const chain: Record<string, Value> = {...sessionChain(lone, input.nowUnixMs ?? 0), ...(model ? {model} : {}), beside: true}
    values.members = JSON.stringify([chain])
    values.light = chain.state === 'working' ? 'lit' : 'dark'
    if (input.soloed) values[`solo:${lone.sessionRef}`] = input.soloed.has(trackKey(lone))
    values[`bench:${lone.sessionRef}`] = lone.benched === true
    // The macros stand where the one agent's settings stand: one chain, so the rack keeps no value of its own. Its Model turns through the
    // session's model select, so where AIKit read the session's model the macro stands on it, and offers the models its harness offers.
    for (const macro of RACK_MACROS) put(values, macro, input.agent?.[AGENT_KEY[macro]])
    const own = groupMacroValues([lone], input.chainModelReadings)
    if (own.model !== undefined) values.model = own.model
    if (own.models !== undefined) values.models = own.models
  } else {
    if (!group || !group.group) return values
    // The crew is the agent set's ref in Central (the design's `crew`) where the space names the set it runs; else the space's own label.
    put(values, 'crew', group.agentSet?.ref ?? group.spaceLabel ?? group.purpose)
    if (input.tracks) {
      const members = agentsetMembers(group, input.tracks, input.nowUnixMs ?? 0, input.chainModels)
      values.members = JSON.stringify(input.helper ? [...members, helperMember(input.helper)] : members)
      values.light = members.some(member => member.state === 'working') ? 'lit' : 'dark'
      const soloed = input.soloed
      for (const track of input.tracks) {
        if (!isAgentChain(track, group)) continue
        if (soloed) values[`solo:${track.sessionRef}`] = soloed.has(trackKey(track))
        // The Activator reads the space's own record: a benched chain stays in the rack and is given no work.
        values[`bench:${track.sessionRef}`] = track.benched === true
      }
    }
    if (input.helper) values[memberDeviceKey(DECISION_HELPER_ID, DECISION_HELPER_DESIGN)] = JSON.stringify(input.helper)
    if (input.tracks) Object.assign(values, groupMacroValues(input.tracks.filter(track => isAgentChain(track, group)), input.chainModelReadings))
  }
  put(values, 'member', view.member)
  for (const key of CARD_LOCAL) put(values, key, view[key])
  // A lone session's Model macro offers the models its harness offers where AIKit read them; unread, AIKit's catalogue, as its Agent does.
  // A group's, the models every chain's harness offers.
  if (lone && values.models === undefined && input.models?.length) values.models = JSON.stringify(input.models.map(id => ({id})))
  const join = setRecordOf(input)?.join
  if (typeof join === 'string' && (JOINS as readonly string[]).includes(join)) values.join = join
  return values
}

/** Central's record of the group's set, when Central answered it for the set the space names. */
function setRecordOf(input: AgentRackInput): Record<string, any> | null {
  const tie = input.group?.agentSet, answer = input.set
  if (!tie || answer?.status !== 'answered') return null
  const value = answer.value as {ref?: unknown; revision?: unknown; record?: unknown} | null
  const record = value && typeof value.record === 'object' && value.record !== null ? value.record as Record<string, any> : null
  return record && record.ref === tie.ref ? record : null
}

/** Why the rack's Join is not drawn or not pressable, or null where it reads and writes. */
function joinStanding(input: AgentRackInput, ports: AgentRackPorts | undefined): Standing | null {
  const tie = input.group?.agentSet
  if (!tie) return {disabled: JOIN_UNTIED}
  const answer = input.set
  if (!answer || answer.status === 'reading') return {disabled: JOIN_READING(tie.ref)}
  if (answer.status === 'refused') return {disabled: `Join: ${answer.error}`}
  const record = setRecordOf(input)
  if (!record) return {disabled: `Join: Central answered another set than ${tie.ref}.`}
  if (!ports?.saveSet) return {disabled: 'Join: no carrier to Central\'s central.agent-set.save stands on this chain.'}
  return typeof record.join === 'string' ? null : {refused: JOIN_UNSAVED(tie.ref)}
}

/** The Agent's Effort in the macro's words (§19.4: Low · Medium · High · Max). */
const EFFORT_WORD: Readonly<Record<string, string>> = {low: 'Low', medium: 'Medium', high: 'High', max: 'Max'}
const listed = (items: readonly string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const said = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/\.$/, '')

/** Where a group's Model and Effort macros stand, from every agent chain's reading: the models every chain's harness offers (in the first
 * chain's order), the model they all use, and the Effort they all work at in the macro's words. A chain unread or refused leaves all three
 * unread: the rack keeps no value of its own. Pure. */
function groupMacroValues(chains: readonly AgentSessionTrack[], readings: ReadonlyMap<string, ChainModelReading> | null | undefined): Record<string, Value> {
  const observed = chains.map(chain => { const read = readings?.get(chain.sessionRef); return read?.status === 'answered' ? read.reading.model_observation : null })
  if (!observed.length || observed.some(o => !o)) return {}
  const all = observed as NonNullable<NativeModelReading['model_observation']>[]
  const values: Record<string, Value> = {}
  const shared = all[0]!.available_models.filter(model => all.every(o => o.available_models.some(m => m.modelId === model.modelId)))
  if (shared.length) values.models = JSON.stringify(shared.map(model => ({id: model.modelId, label: model.name})))
  const models = new Set(all.map(o => o.current_model_id))
  if (models.size === 1) values.model = [...models][0]!
  const efforts = new Set(all.map(o => o.reasoning_effort?.currentValue))
  const effort = efforts.size === 1 ? [...efforts][0] : undefined
  if (effort && effort in EFFORT_WORD) values.effort = effort
  return values
}

/** AIKit's model select for one chain's session from its fresh reading: the Model macro asks for the model (the effort left as the harness
 * holds it), the Effort macro for the reasoning effort on the model the session uses (or its policy pins). Throws in the owner's words where
 * the harness, the session's model policy or the reading does not allow it (the cradle's own checks: nativeModel.ts select). Pure. */
export function sessionModelSelectOf(reading: NativeModelReading, session: string, macro: 'model' | 'effort', value: string, name: string): SessionModelSelect {
  if (reading.agent_session !== session || !reading.native_session_id) throw Error(`AIKit's model reading of ${name} names another session: read it again.`)
  const word = MACRO_WORD[macro], observation = reading.model_observation, controls = reading.model_controls
  if (!observation) throw Error(`${name}'s harness reports no model yet, so no ${word} can be set on it.`)
  const base = {action: 'model-select' as const, agent_session: session, expected_native_session_id: reading.native_session_id}
  if (macro === 'model') {
    if (!controls?.model_selection) throw Error(`${name}'s harness turns no Model here: ${controls?.reason ?? 'it advertises no writable model selector'}`)
    if (reading.pinned_model_id && reading.pinned_model_id !== value) throw Error(`${name}'s model policy pins ${reading.pinned_model_id}: change the policy through its owner.`)
    if (!observation.available_models.some(model => model.modelId === value)) {
      throw Error(`${name}'s harness does not offer ${value} (it offers ${listed(observation.available_models.map(model => model.name)) || 'none'})`)
    }
    return {...base, provider_model_id: value}
  }
  if (!controls?.reasoning_effort_selection) throw Error(`${name}'s harness turns no Effort here: ${controls?.reason ?? 'it advertises no writable reasoning effort'}`)
  const options = observation.reasoning_effort?.options ?? []
  if (!options.some(option => option.value === value)) {
    throw Error(`${name}'s harness offers no Effort ${EFFORT_WORD[value] ?? value} (it offers ${listed(options.map(option => option.name)) || 'none'})`)
  }
  return {...base, provider_model_id: reading.pinned_model_id ?? observation.current_model_id, provider_reasoning_effort: value}
}

/** Whether AIKit's model select confirmed what was asked of this session (the cradle's own check: nativeModel.ts select). */
function confirmSelect(receipt: unknown, request: SessionModelSelect, name: string): void {
  const r = receipt as {agent_session?: unknown; native_session_id?: unknown; selected?: unknown; model_observation?: NativeModelReading['model_observation']} | null
  if (!r || r.agent_session !== request.agent_session || r.native_session_id !== request.expected_native_session_id || r.selected !== true) {
    throw Error(`AIKit's model select of ${name} did not confirm this session; its outcome is unknown, so read the rack again before you turn it`)
  }
  const observed = r.model_observation
  if (observed && (observed.current_model_id !== request.provider_model_id
    || (request.provider_reasoning_effort !== undefined && observed.reasoning_effort?.currentValue !== request.provider_reasoning_effort))) {
    throw Error(`AIKit's model select of ${name} did not confirm what was asked; its outcome is unknown, so read the rack again before you turn it`)
  }
}

/** Why a macro cannot turn, or null where it turns: on a group, Model and Effort turn each chain's session through AIKit's model select
 * where its carrier stands, and Budget names the operation each chain waits for; on a lone session, Model turns the same way, and Effort and
 * Budget stand on the Agent's own word for the setting it does not write. */
function macroStanding(macro: RackMacro, input: AgentRackInput, ports: AgentRackPorts | undefined): Standing | null {
  if (!loneOf(input)) return macro !== 'budget' && ports?.sessionModel ? null : {disabled: AGENTSET_REFUSE[macro]}
  // A lone session's Model takes the path a group's chains take: the session's own model select (the Agent writes no Model).
  if (macro === 'model') return ports?.sessionModel ? null : {disabled: AGENTSET_REFUSE.model}
  const agent = ports?.agent, key = AGENT_KEY[macro], word = MACRO_WORD[macro]
  if (!agent) return {disabled: `${word}: the session's Agent is not bound on this chain, so the macro reaches no agent.`}
  const own = agent.standing?.[key]?.disabled
  if (own) return {disabled: own}
  if (!agent.write || (agent.writes && !agent.writes(key))) return {disabled: `${word}: the Agent's ${word} is a reading here: its owner reports it, and nothing here turns it.`}
  return null
}

/** The proposal the card stands on (the hand's hold after Make): its ref, its chains, and Central's record at its revision. */
interface Proposal {readonly ref: string; readonly name: string; readonly members: readonly string[]; readonly revision: string; readonly record: Record<string, unknown>}
const proposalOf = (held: unknown): Proposal | null => {
  if (typeof held !== 'string') return null
  try {
    const p = JSON.parse(held) as Proposal
    return p && typeof p.ref === 'string' && typeof p.revision === 'string' && p.record && typeof p.record === 'object' && Array.isArray(p.members) ? p : null
  } catch { return null }
}

/** The rack's binding: the chosen chain, the chains chosen for Group and the card's fields are the view's own; a lone session's Effort and
 * Budget turn its one agent through the Agent itself, and its Model, as a group's Model and Effort, through each chain's session's model
 * select; Join reads and writes Central's agent set the group runs; Make and Accept propose and save a set through Central; the Activator,
 * Add a chain, Drag out, Hot-Swap, Delete and the Decision helper act through AIKit's session-space operations; every
 * delegation setting, device of another session's chain and Retry stands disabled with what it lacks. */
export function agentsetBinding(input: AgentRackInput, ports?: AgentRackPorts): DesignBinding {
  const standing: Record<string, Standing> = disabled(AGENTSET_REFUSE)
  for (const macro of RACK_MACROS) { const why = macroStanding(macro, input, ports); if (why) standing[macro] = why; else delete standing[macro] }
  const join = joinStanding(input, ports)
  if (join) standing.join = join
  if (ports?.solo) delete standing.solo
  if (ports?.bench) delete standing.bench
  if (ports?.dragOut) delete standing.extract
  if (ports?.attach) delete standing.add
  if (ports?.hotSwap) delete standing.swap
  if (ports?.detach) delete standing.delete
  if (ports?.retry) delete standing.retry
  if (ports?.ask) delete standing.dev
  if (!ports?.removeSet) standing['new.discard'] = {disabled: GROUP_REFUSE.noRemover}
  const writable = join === null || join.refused !== undefined
  const lone = loneOf(input)
  const tracks = input.tracks ?? []
  const pressed = () => viewHolds(chainHolds(), AGENTSET_ID)
  const clearCard = () => { for (const key of CARD_LOCAL) holdView(AGENTSET_ID, key, undefined) }

  /** A macro's turn: every chain it reaches (inhabitants/sdk/chains.ts macroTurns), each through its own owner. */
  const turn = async (macro: RackMacro, value: Value | undefined) => {
    const why = macroStanding(macro, input, ports)
    if (why?.disabled) throw Error(why.disabled)
    if (value === undefined) throw Error(`${MACRO_WORD[macro]}: the macro was turned to no value.`)
    if ((!lone && macro !== 'budget') || (lone && macro === 'model')) { await turnSessions(macro as 'model' | 'effort', value); return }
    for (const reached of macroTurns(rackNodes(input), macro, value)) {
      if (lone && reached.chain === lone.sessionRef && ports?.agent?.write) await ports.agent.write([{key: AGENT_KEY[macro], value}])
      else throw Error(AGENTSET_REFUSE[macro])
    }
  }
  /** A group's Model or Effort: every agent chain the macro reaches, each through its own session's model select in AIKit. Every chain is
   * read and checked before any is written, so a value one harness does not offer turns none; a write that stops partway says what stands
   * and what to press next. The macro keeps no value: each session's harness holds its own. */
  const turnSessions = async (macro: 'model' | 'effort', value: Value) => {
    const port = ports?.sessionModel, word = MACRO_WORD[macro]
    if (!port) throw Error(AGENTSET_REFUSE[macro])
    if (typeof value !== 'string' || !value) throw Error(`${word}: the macro was turned to no ${macro === 'model' ? 'model' : 'Effort'}.`)
    const chains = macroTurns(rackNodes(input), macro, value).flatMap(reached => { const chain = reached.kind === 'agent' ? chainOf(reached.chain) : null; return chain ? [chain] : [] })
    const planned: {name: string; project: string; request: SessionModelSelect; label: string}[] = []
    for (const chain of chains) {
      const name = chain.agentName ?? chain.purpose ?? chain.sessionRef, project = chain.project ?? ROOT_REGISTER
      let reading: NativeModelReading
      try { reading = await port.read({project, agent_session: chain.sessionRef}) } catch (error) {
        throw Error(`${word}: AIKit did not read ${name}'s model (${said(error)}), so no chain was turned.`)
      }
      try {
        const request = sessionModelSelectOf(reading, chain.sessionRef, macro, value, name)
        const label = macro === 'model' ? reading.model_observation?.available_models.find(model => model.modelId === value)?.name ?? value : EFFORT_WORD[value] ?? value
        planned.push({name, project, request, label})
      } catch (error) { throw Error(`${word}: ${said(error)}, so no chain was turned.`) }
    }
    const done: string[] = []
    for (const [at, step] of planned.entries()) {
      try { confirmSelect(await port.select({project: step.project, request: step.request}), step.request, step.name) } catch (error) {
        const left = planned.slice(at).map(p => p.name), noun = macro === 'model' ? 'model' : 'Effort'
        const now = macro === 'model' ? (done.length > 1 ? `use ${step.label}` : `uses ${step.label}`) : (done.length > 1 ? `work at Effort ${step.label}` : `works at Effort ${step.label}`)
        const stands = done.length ? `${listed(done)} now ${now}` : 'nothing changed'
        const keep = `${listed(left)} ${left.length > 1 ? `keep the ${noun} they had` : `keeps the ${noun} it had`}`
        throw Error(`${word} stopped at ${step.name}: ${stands}, and ${keep}; ${said(error)}. Turn ${word} again to set the rest.`)
      }
      done.push(step.name)
    }
  }
  /** Solo a chain: what you attend to changes, by the chain's track (the key the views read); no owner is asked. */
  const solo = (id: string, value: Value | undefined) => {
    if (!ports?.solo) throw Error(AGENTSET_REFUSE.solo)
    if (id === DECISION_HELPER_ID) throw Error('Solo: the Decision helper is a chain of the rack, not a session: the views, the tiles and the instruments draw sessions, so there is nothing of it to attend to alone.')
    const chain = chainOf(id)
    if (!chain) throw Error(`Solo: "${id}" is not a chain of this rack.`)
    ports.solo(trackKey(chain), value === true)
  }
  /** A chain of this rack by its id: the lone session's own, or an agent's session of the group's space. */
  function chainOf(id: string): AgentSessionTrack | null {
    return lone && lone.sessionRef === id ? lone : tracks.find(track => track.sessionRef === id && isAgentChain(track, input.group)) ?? null
  }
  /** The Activator: off benches the chain's session in its space (it stays in the rack and is given no work); on lifts the bench. */
  const bench = async (id: string, value: Value | undefined) => {
    if (!ports?.bench) throw Error(AGENTSET_REFUSE.bench)
    if (id === DECISION_HELPER_ID) throw Error(CHAIN_LIST_REFUSE.helperBench)
    const chain = chainOf(id)
    if (!chain) throw Error(CHAIN_LIST_REFUSE.notChain('Activator', id))
    await ports.bench({project: chain.project ?? ROOT_REGISTER, space: chain.spaceRef, agent_session: chain.sessionRef, benched: value === true})
  }
  /** Drag out: the chosen chain's session leaves its space for a space of its own, named for it, on a track of its own, chain and all. */
  const dragOut = async (value: Value | undefined) => {
    if (!ports?.dragOut) throw Error(AGENTSET_REFUSE.extract)
    const id = typeof value === 'string' ? value : String(value)
    if (id === DECISION_HELPER_ID) throw Error(CHAIN_LIST_REFUSE.helperOut)
    const chain = chainOf(id)
    if (!chain) throw Error(CHAIN_LIST_REFUSE.notChain('Drag out', id))
    const name = String(sessionChain(chain, 0).name)
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'session'
    await ports.dragOut({project: chain.project ?? ROOT_REGISTER, space: chain.spaceRef, agent_session: chain.sessionRef,
      into: `session-space/${slug}-${ports.suffix?.() ?? '1'}`, label: name})
  }
  /** Hot-Swap: the agent dropped on the chosen chain's Hot-Swap takes the chain's place, its own session seated with the chain's settings. */
  const hotSwap = async (value: Value | undefined) => {
    if (!ports?.hotSwap) throw Error(AGENTSET_REFUSE.swap)
    let asked: {chain?: unknown; agent?: unknown} = {}
    try { asked = typeof value === 'string' && value.startsWith('{') ? JSON.parse(value) as typeof asked : {} } catch { /* a press */ }
    const id = typeof asked.chain === 'string' ? asked.chain : typeof value === 'string' ? value : String(value)
    if (id === DECISION_HELPER_ID) throw Error(CHAIN_LIST_REFUSE.swapHelper)
    const chain = chainOf(id)
    if (!chain) throw Error(CHAIN_LIST_REFUSE.notChain('Hot-Swap', id))
    const dropped = typeof asked.agent === 'string' ? asked.agent.trim() : ''
    if (!dropped) throw Error(CHAIN_LIST_REFUSE.swapPress)
    const decoded = decodeChainDrag(dropped)
    let agent = dropped
    if (decoded?.kind === 'chain-item') {
      if (decoded.drag.family === 'session') throw Error(CHAIN_LIST_REFUSE.swapSession)
      if (decoded.drag.family !== 'agent') throw Error(CHAIN_LIST_REFUSE.swapFamily(decoded.drag.family))
      agent = decoded.drag.ref
    } else if (decoded) throw Error(CHAIN_LIST_REFUSE.swapUnnamed)
    if (!/^agent\/[^\s:]+$/.test(agent)) throw Error(CHAIN_LIST_REFUSE.swapUnnamed)
    if (agent === chain.agentRef) throw Error(CHAIN_LIST_REFUSE.swapSame(String(sessionChain(chain, 0).name)))
    await ports.hotSwap({project: chain.project ?? ROOT_REGISTER, space: chain.spaceRef, agent_session: chain.sessionRef, agent_ref: agent})
  }
  /** The Decision helper dropped under a group's chain list: AIKit seats one session of the space as the helper of its agents. */
  const addHelper = async () => {
    const group = input.group?.group ? input.group : null
    if (!group) throw Error(lone ? CHAIN_LIST_REFUSE.helperLone : CHAIN_LIST_REFUSE.noRack)
    if (input.helper || group.decisionHelper) throw Error(CHAIN_LIST_REFUSE.helperStands)
    if (!ports?.decisionHelper) throw Error(CHAIN_LIST_REFUSE.helperUncarried)
    await ports.decisionHelper({project: group.project ?? ROOT_REGISTER, space: group.spaceRef, bound: true})
  }
  /** Delete (⌫ on the chosen chain): its session leaves the space that holds it, as its own session track's Delete takes it off the set
   * (§10.9); the session, its task and its settings stay AIKit's. On the Decision helper, the helper's session leaves, and AIKit takes the
   * helper off its space with it. */
  const remove = async (value: Value | undefined) => {
    if (!ports?.detach) throw Error(AGENTSET_REFUSE.delete)
    const id = typeof value === 'string' ? value : String(value)
    if (id === DECISION_HELPER_ID) {
      const group = input.group?.group ? input.group : null, session = group?.decisionHelper
      if (!group || typeof session !== 'string' || !session) throw Error(CHAIN_LIST_REFUSE.helperUnnamed)
      await ports.detach({project: group.project ?? ROOT_REGISTER, agent_session: session})
      return
    }
    const chain = chainOf(id)
    if (!chain) throw Error(CHAIN_LIST_REFUSE.notChain('Delete', id))
    await ports.detach({project: chain.project ?? ROOT_REGISTER, agent_session: chain.sessionRef})
  }
  /** Add a chain: a standing session dropped under the chain list joins the rack's space; a Decision helper becomes the space's helper. */
  const addChain = async (value: Value | undefined) => {
    if (namesHelper(value)) return addHelper()
    if (!ports?.attach) throw Error(AGENTSET_REFUSE.add)
    const rack = input.group?.group ? input.group : lone
    if (!rack) throw Error(CHAIN_LIST_REFUSE.noRack)
    const session = droppedSession(value)
    const standing = chainOf(session)
    if (standing) throw Error(CHAIN_LIST_REFUSE.already(String(sessionChain(standing, 0).name)))
    await ports.attach({project: rack.project ?? ROOT_REGISTER, space: rack.spaceRef, agent_session: session})
  }
  /** Make: the chosen chains, proposed to Central as a set of agents, the proposal held on the card. */
  const make = async (value: Value | undefined) => {
    let asked: {for?: unknown; chains?: unknown; type?: unknown} = {}
    try { asked = typeof value === 'string' ? JSON.parse(value) as typeof asked : {} } catch { /* refused below */ }
    const words = typeof asked.for === 'string' ? asked.for.trim() : ''
    const type = typeof asked.type === 'string' && asked.type ? asked.type : undefined
    if (type !== undefined && !SET_TYPE.test(type)) throw Error(GROUP_REFUSE.badType(type))
    const ids = Array.isArray(asked.chains) ? asked.chains.filter((id): id is string => typeof id === 'string') : []
    if (!words) throw Error(GROUP_REFUSE.purpose)
    if (ids.length < 2) throw Error(GROUP_REFUSE.few)
    const members = ids.map(id => {
      const chain = tracks.find(item => item.sessionRef === id)
      if (!chain?.agentRef) throw Error(GROUP_REFUSE.unseated(chain?.agentName ?? chain?.purpose ?? id))
      return {kind: 'agent' as const, agent_ref: chain.agentRef}
    })
    if (!ports?.propose) throw Error(GROUP_REFUSE.noCarrier)
    const slug = words.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'set'
    const ref = `agent-set:${slug}-${ports.suffix?.() ?? 'r1'}`
    const data = await ports.propose({scope: 'root', ref, revision: 'r1', members, reason: words, ...(type ? {type} : {})})
    const record = data && typeof data === 'object' && typeof (data as {record?: unknown}).record === 'object' && (data as {record?: unknown}).record !== null
      ? (data as {record: Record<string, unknown>}).record : null
    if (!record) throw Error('Central answered the proposal without the set\'s record.')
    holdView(AGENTSET_ID, 'new.proposal', JSON.stringify({ref, name: slug, members: ids, revision: typeof record.revision === 'string' ? record.revision : 'r1', record,
      ...(type ? {type} : {})}))
  }
  /** Discard: Central's proposal removed at the revision it wrote, and the card let go. */
  const discard = async () => {
    if (!ports?.removeSet) throw Error(GROUP_REFUSE.noRemover)
    const proposal = proposalOf(pressed()['new.proposal'])
    if (!proposal) throw Error(GROUP_REFUSE.noProposal)
    await ports.removeSet({scope: 'root', ref: proposal.ref, expected_revision: proposal.revision})
    clearCard()
  }
  /** Retry: the chosen chain's task, through Factory (its units read, its unit retried). */
  const retry = async () => {
    if (!ports?.retry) throw Error(AGENTSET_REFUSE.retry)
    const id = pressed().member
    if (typeof id !== 'string' || !id) throw Error(CHAIN_LIST_REFUSE.noneChosen('Retry'))
    if (id === DECISION_HELPER_ID) throw Error(CHAIN_LIST_REFUSE.helperRetry)
    const chain = chainOf(id)
    if (!chain) throw Error(CHAIN_LIST_REFUSE.notChain('Retry', id))
    await ports.retry({project: chain.project ?? ROOT_REGISTER, agent_session: chain.sessionRef})
  }
  /** A device of another session's chain (`dev:<chain>@<device>`): the change goes to that session as a message (Messages' delegate), in
   * words its agent reads; nothing of that chain's binding is written from here. */
  const askChain = async (key: string, value: Value | undefined) => {
    if (!ports?.ask) throw Error(AGENTSET_REFUSE.dev)
    const at = key.indexOf('@')
    const id = key.slice('dev:'.length, at < 0 ? undefined : at), device = at < 0 ? '' : key.slice(at + 1)
    const chain = chainOf(id)
    if (!chain || !device) throw Error(CHAIN_LIST_REFUSE.notChain('Devices', id))
    const name = String(sessionChain(chain, 0).name)
    if (!chain.agentRef) throw Error(CHAIN_LIST_REFUSE.devUnseated(name))
    let change: Record<string, unknown> | null = null
    try { const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : null; change = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null }
    catch { change = null }
    if (!change || !Object.keys(change).length) throw Error(CHAIN_LIST_REFUSE.devChange)
    const said = Object.entries(change).map(([setting, to]) => `${setting.charAt(0).toUpperCase()}${setting.slice(1)} to ${typeof to === 'string' ? to : JSON.stringify(to)}`)
    const words = `From the Agent rack: set ${said.join(', ')} on ${device} in your chain.`
    await ports.ask({project: chain.project ?? ROOT_REGISTER, agent_session: chain.sessionRef, agent_ref: chain.agentRef, device, change, words})
  }
  const accept = async () => {
    const proposal = proposalOf(pressed()['new.proposal'])
    if (!proposal) throw Error(GROUP_REFUSE.noProposal)
    if (!ports?.saveSet) throw Error('Accept: no carrier to Central\'s central.agent-set.save stands on this chain.')
    await ports.saveSet({scope: 'root', record: proposal.record, expected_revision: proposal.revision})
    clearCard()
  }

  return {
    id: AGENTSET_ID,
    values: agentsetValues(input),
    standing,
    local: {
      member: value => holdView(AGENTSET_ID, 'member', typeof value === 'string' ? value : undefined),
      ...Object.fromEntries(CARD_LOCAL.map(key => [key, (value: Value | undefined) => holdView(AGENTSET_ID, key, value)])),
    },
    writes: key => key in AGENTSET_REFUSE || memberControl(key) !== undefined || (key === 'join' && writable) || key === 'new.make' || key === 'new.accept' || key === 'new.discard',
    write: async changes => {
      for (const {key, value} of changes) {
        if ((RACK_MACROS as readonly string[]).includes(key)) { await turn(key as RackMacro, value); continue }
        if (key === 'new.make') { await make(value); continue }
        if (key === 'new.accept') { await accept(); continue }
        if (key === 'new.discard') { await discard(); continue }
        if (key === 'retry') { await retry(); continue }
        if (key.startsWith('dev:')) { await askChain(key, value); continue }
        if (key.startsWith('solo:')) { solo(key.slice('solo:'.length), value); continue }
        if (key.startsWith('bench:')) { await bench(key.slice('bench:'.length), value); continue }
        if (key === 'extract') { await dragOut(value); continue }
        if (key === 'add') { await addChain(value); continue }
        if (key === 'swap') { await hotSwap(value); continue }
        if (key === 'delete') { await remove(value); continue }
        if (key !== 'join') throw Error(AGENTSET_REFUSE[memberControl(key) ?? key as keyof typeof AGENTSET_REFUSE] ?? reading(key))
        if (typeof value !== 'string' || !(JOINS as readonly string[]).includes(value)) throw Error(`Join is none, all, first, quorum or weighted, not ${String(value)}.`)
        if (!ports?.saveSet) throw Error('Join: no carrier to Central\'s central.agent-set.save stands on this chain.')
        const record = setRecordOf(input)
        if (!record) throw Error(join?.disabled ?? JOIN_UNTIED)
        const revision = String(record.revision)
        await ports.saveSet({scope: 'root', record: {...record, join: value, revision: nextSetRevision(revision)}, expected_revision: revision})
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the agent's profile

// The chain is the profile Central keeps for the agent (§19.4; Central PR 318): Rename on the Agent's head gives the Agent its name
// (agent-profile.rename), a SkillSet dropped on the Skillset rack stands where the one it carries stood (agent-profile.chain-replace, the
// rack's Hot-swap), and the order of what it carries before its Agent is agent-profile.chain-order — each at the profile's revision as the
// roster read it, under compare-and-swap, and refused by Central in its own words.
export const PROFILE_ACTS = {rename: 'agent-profile.rename', replace: 'agent-profile.chain-replace', order: 'agent-profile.chain-order'} as const

/** The agent's accepted profile as the chain's acts address it (Central's AgentProfile: profile_ref, revision, name, skill_set_refs). */
export interface ChainProfile {
  readonly profileRef: string
  readonly revision: string
  readonly name?: string
  readonly skillSetRefs: readonly string[]
}
/** The profile the roster holds for the seated agent (designBindings.ts seatedProfile), or null when it names no ref or revision. Pure. */
export function chainProfileOf(profile: unknown): ChainProfile | null {
  const doc = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile as Record<string, unknown> : null
  if (!doc || typeof doc.profile_ref !== 'string' || !doc.profile_ref || typeof doc.revision !== 'string' || !doc.revision) return null
  const sets = Array.isArray(doc.skill_set_refs) ? doc.skill_set_refs.filter((ref): ref is string => typeof ref === 'string') : []
  return {profileRef: doc.profile_ref, revision: doc.revision, ...(typeof doc.name === 'string' && doc.name ? {name: doc.name} : {}), skillSetRefs: sets}
}
export const PROFILE_REFUSE = {
  unread: (what: string) => `${what}: no accepted profile of this session's agent is read here (Central's roster names none), so Central cannot be asked.`,
  noCarrier: (what: string) => `${what}: the kernel carrier is unavailable here, so Central cannot be asked.`,
  swapPress: (carried: string) => `Hot-swap: drag a SkillSet from the browser onto the Skillset rack: Central's agent-profile.chain-replace puts it where ${carried} stands.`,
  swapNone: 'Hot-swap: the agent carries no SkillSet to swap; adding one is another act (missing op: agent-chain skillset admit, AIKit).',
  swapSame: (ref: string) => `Hot-swap: the agent carries ${ref} already, and a SkillSet stands once on its chain.`,
} as const

/** One of Central's acts on the profile: the action and its input, at the profile's revision as read. */
export interface ProfileRequest {readonly action: string; readonly input: Readonly<Record<string, unknown>>}
const profileInput = (profile: ChainProfile) => ({scope: 'root', profile_ref: profile.profileRef, expected_revision: profile.revision})
/** Rename: the Agent's name. Pure. */
export const renameRequest = (profile: ChainProfile, name: string): ProfileRequest => ({action: PROFILE_ACTS.rename, input: {...profileInput(profile), name}})
/** The Skillset rack's Hot-swap: the SkillSet dropped stands where the first the agent carries stood (the set the rack shows), or the
 * refusal in words. Pure. */
export function replaceRequest(profile: ChainProfile, dropped: string): ProfileRequest | {refused: string} {
  const carried = profile.skillSetRefs[0]
  if (!carried) return {refused: PROFILE_REFUSE.swapNone}
  if (profile.skillSetRefs.includes(dropped)) return {refused: PROFILE_REFUSE.swapSame(dropped)}
  return {action: PROFILE_ACTS.replace, input: {...profileInput(profile), replace: carried, with: dropped}}
}

/** The head acts the agent's profile carries: the Agent's Rename (it asks the name, the one standing first), and the Skillset rack's
 * Hot-swap, which a drop from the browser carries (the press says so). `act` is Central's invoke_action; absent, no carrier stands. */
export function profileHeadActs(profile: ChainProfile | null, act?: (action: string, input: Readonly<Record<string, unknown>>) => Promise<unknown>): {
  readonly agent: Partial<Readonly<Record<HeadAct, HeadActEntry>>>
  readonly skillset: Partial<Readonly<Record<HeadAct, HeadActEntry>>>
} {
  const rename: HeadActEntry = !profile ? {refused: PROFILE_REFUSE.unread('Rename')} : !act ? {refused: PROFILE_REFUSE.noCarrier('Rename')}
    : {ask: 'name', label: 'Name', ...(profile.name ? {value: profile.name} : {}), run: async text => { const asked = renameRequest(profile, text); await act(asked.action, asked.input) }}
  const swap: HeadActEntry = !profile ? {refused: PROFILE_REFUSE.unread('Hot-swap')} : !profile.skillSetRefs[0] ? {refused: PROFILE_REFUSE.swapNone}
    : {refused: PROFILE_REFUSE.swapPress(profile.skillSetRefs[0])}
  return {agent: {rename}, skillset: {'hot-swap': swap}}
}
