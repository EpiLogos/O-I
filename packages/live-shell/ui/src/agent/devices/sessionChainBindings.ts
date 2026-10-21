// The session's own devices beside the chain on their owners (lane BF3): the Run (DLW §19.1, software-factory:run-device — "on the
// session's chain"), Custody (§19.13, software-factory:agent-custody — "on the Agent device; the Agent's face shows it") and the
// Agentset rack (§19.18, software-factory:agentset-rack — "a group's chain in Factory").
//
// What the owners report, read 16 Oct 2026 (scratch lane-bf3/shapes/, lane-bf2/shapes/):
//   the agency reading (agency_read + the roster + each session's task record + temporal_events_read, built by
//     AgentSessionsProvider into agent/agentRunModel.ts tracks): a session's tasks (TaskClip n, title, state, start, last activity),
//     its needle (the last check-in on the shared axis, sharedAxis agentRunModel.ts:280 — a window ending at the reading instant),
//     its budget, and a group track for each SessionSpace with its member sessions at depth 1 (buildTracks agentRunModel.ts:302);
//   the session's task record (encounter_task_read, agentChainDevices.ts taskReading): `custody` or `autonomy` — Custody's Autonomy;
//   AIKit's encounter view (the Thread's rows, threadBinding.ts threadJson) — the Run's full view is the thread.
// What no kernel op reaches: a session's Factory run (factory_attempt_read needs a run ref the agency reading never names, so the
//   Run's takes are absent), the event lanes (the temporal stream names the session, not Messages · Files · Terminal · Web · Graph),
//   Hermes' subagent tree and delegation block (subagent.list over tui_gateway; no config.set key), Factory's custody holds and
//   RetryGrant, Central's agent-set records for a SessionSpace (agency_read names no set for it). Each is absent here and each write
//   that needs one stands disabled with the operation it lacks. Pure, apart from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {AgentSessionTrack, TaskClip} from '../agentRunModel'
import {chainHolds, holdView, viewHolds, type ChainHolds} from './designBindings'
import {rackStateOf, runStateOfSession} from './runFaces'
import {familyFaceDevice} from './mainTrackBindings'
import {sessionRowsOf} from './threadBinding'

export const RUN_DESIGN = 'software-factory:run-device'
export const CUSTODY_DESIGN = 'software-factory:agent-custody'
export const AGENTSET_DESIGN = 'software-factory:agentset-rack'
export const RUN_ID = 'factory:run'
export const CUSTODY_ID = 'factory:custody'
export const AGENTSET_ID = 'factory:agentset'
export const SESSION_DEVICE_IDS: readonly string[] = [RUN_ID, CUSTODY_ID, AGENTSET_ID]

/** The three as devices of the runtime, each of its admitted face (designKey(family, face.id) is its design's id); null when the family
 * does not admit the face. */
export const sessionDevices = (): {run: DeviceInstance | null; custody: DeviceInstance | null; agentset: DeviceInstance | null} => ({
  run: familyFaceDevice(RUN_ID, 'software-factory', 'run-device', 'Run', 'arrangement'),
  custody: familyFaceDevice(CUSTODY_ID, 'software-factory', 'agent-custody', 'Custody', 'arm'),
  agentset: familyFaceDevice(AGENTSET_ID, 'software-factory', 'agentset-rack', 'Agentset rack', 'bind'),
})

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}
const reading = (key: string) => `${key} is a reading: its owner reports it; nothing here changes it.`

// ---------------------------------------------------------------------------------------------------------------- the Run

export const RUN_REFUSE = {
  telemetry: missing('Telemetry', 'a session\'s telemetry switch (agency_read reports none; the shell\'s Telemetry flag is its own)', 'Actuation'),
  solo: missing('Solo', 'a session solo that pauses the others (harness_agent_control addresses the whole bound harness)', 'Actuation'),
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

/** A session's tasks as the Run reads them (software-factory__run-device.tsx:13-14): the Tasks device's rows, and `from` and `last`,
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
// --to-position P, --expected-revision N]`, both answering factory.work-custody-receipt/v1). They carry a Position's custody of a piece of
// work, its state and a hand-off Position: none of Custody's settings. So each stays disabled, naming exactly what the command lacks.
/** What Factory's custody commands carry, for a refusal that names what they do not. */
const CUSTODY_CARRIES = 'Factory\'s custody assign and update (factory_owner) carry a Position, its work, a reason, the custody state — in-progress, blocked, released, completed or handed-off — and a Position to hand off to'
export const CUSTODY_REFUSE = {
  autonomy: missing('Autonomy', `a write of the session's autonomy (${CUSTODY_CARRIES}, and no autonomy; encounter_task_read reads it; agentParamAddresses.ts autonomy has no write path)`, 'Software Factory'),
  gate: missing('Review gate', `a review gate in Factory's custody record (${CUSTODY_CARRIES}, and no gate)`, 'Software Factory'),
  escalate: missing('Escalate to', `an escalation contact in Factory's custody record (${CUSTODY_CARRIES}: a hand-off moves the work to that Position, which names no one to ask)`, 'Software Factory'),
  handBack: missing('Hand back', `a custody state for giving back what you edited (${CUSTODY_CARRIES}; giving control back is none of these states), and the custody refs of what the session holds (\`factory development custody list\` has no kernel route)`, 'Software Factory'),
} as const
/** Custody's readings no owner reports here, each with what it waits for. */
const unread = (what: string, op: string, owner: string) => `${what}: no reading reaches it yet — missing op: ${op} (${owner}).`
export const CUSTODY_ABSENT = {
  held: unread('What the agent holds', '`factory development custody list` through the kernel (factory_owner carries custody assign and update, and lists none)', 'Software Factory'),
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

/** One grant of Actuation's listing as the design's row (software-factory__agent-custody.tsx:17-21): {ref, holder, issuedBy, operations,
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
  /** Who is current at the moment of the press (`currentIdentity()` read again): Revoke goes only when it is still the person the page
   * was drawn for. Absent: the person drawn stands. */
  readonly personNow?: () => string | null
}

/** The next grant's settings and the revocation's reason: the hand's own holds (software-factory__agent-custody.tsx:21-22). */
export const CUSTODY_GRANT_SETTINGS: readonly string[] = ['grant:determine-agency', 'grant:configure-agency', 'grant:actualise-agency', 'grant:reintegrate-return',
  'grant:world', 'grant:expires', 'revoke:reason']

export interface CustodyInput {
  /** The chain's session, null when none is selected. */
  readonly sessionRef: string | null
  /** The session's task record's custody word (encounter_task_read `custody` or `autonomy`), null when unread. */
  readonly autonomy: string | null
  /** The Agent's values (its light: Custody stands on the Agent). */
  readonly agent: Values
  /** The hand's holds (the next grant's settings); absent, the store as it stands. */
  readonly holds?: ChainHolds
  /** Actuation's authority list (actuation_read {authority-list}); absent: not read here. */
  readonly grants?: GrantsReading
  /** The current person (`currentIdentity()`'s person ref): the only one Custody writes to Actuation as. */
  readonly person?: string | null
}

/** Custody's values: the Agent's light and the custody the session's task record names. Write mode is Scope's reading, and none is
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
  put(values, 'autonomy', input.autonomy)
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
        // Issue: the desk composes no authority record, whoever the value names as its issuer.
        if (key === 'issue') throw Error(CUSTODY_GRANTS_REFUSE.issue)
        throw Error(CUSTODY_REFUSE[key as keyof typeof CUSTODY_REFUSE] ?? reading(key))
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Agentset rack

const DELEGATION = (what: string, key: string) => missing(what, `Hermes' delegation block (${key}) through the kernel: no config.set key carries it`, 'Hermes')
export const AGENTSET_REFUSE = {
  fanOut: DELEGATION('Fan-out', 'delegation.max_concurrent_children'),
  depth: DELEGATION('Depth', 'delegation.max_spawn_depth'),
  handBack: DELEGATION('Hand-back', 'the helper\'s return form'),
  returnCap: DELEGATION('Summary cap', 'delegation.max_summary_chars'),
  model: DELEGATION('Subagent model', 'delegation.model'),
  join: missing('Join', 'the agent set\'s join, how its members\' returns combine, through the kernel: no agent-set record carries it', 'Central'),
  retry: missing('Retry', 'Factory\'s RetryGrant (factory/src/orchestration.rs) through the kernel', 'Software Factory'),
} as const

export interface AgentsetInput {
  /** The selected group track (a SessionSpace), null when the selection is no group. */
  readonly group: AgentSessionTrack | null
  readonly tracks: readonly AgentSessionTrack[] | null
  /** The models AIKit's catalogue names (kernel model_catalogue), for the Subagent model chooser. */
  readonly models?: readonly string[] | null
  /** The instant the tracks were read at (AgentSessionsProvider nowUnixMs): a member's needle is aged against it. */
  readonly nowUnixMs?: number
  readonly holds: ChainHolds
}

/** A member's state (lane W5): the run state of its session (runFaces.ts runStateOfSession: its task's state, its needle against the 90 s
 * horizon) as the rack names it — Working, Idle (queued), Stalled, Done or Failed (runFaces.ts rackStateOf). A member's thread is not read
 * here, so a running member is Working and no failure is read; a state nobody said is left out. */
function memberState(track: AgentSessionTrack, nowUnixMs: number): ReturnType<typeof rackStateOf> {
  return rackStateOf(runStateOfSession(track, null, nowUnixMs))
}

/** The group's members as the rack reads them (software-factory__agentset-rack.tsx:8-13): each session of the SessionSpace, named by
 * its agent (else its purpose), its goal the session's purpose, its state from its tasks. agency_read discloses no spawn parent below
 * the space (agentRunModel.ts GROUP_DISCLOSURE), so every member stands at the top; no model, tool count or files are reported. */
export function agentsetMembers(group: AgentSessionTrack, tracks: readonly AgentSessionTrack[], nowUnixMs = 0): Record<string, Value>[] {
  return tracks.filter(track => !track.group && track.parentRef === group.sessionRef).map(track => {
    const state = memberState(track, nowUnixMs)
    return {id: track.sessionRef, name: track.agentName ?? track.purpose ?? track.sessionRef,
      ...(track.purpose ? {goal: track.purpose} : {}), ...(state ? {state} : {})}
  })
}

/** The rack's values: the group's name, its members, the member you chose, the models to choose from. The delegation settings are
 * Hermes', and none is read. */
export function agentsetValues(input: AgentsetInput): Values {
  const values: Record<string, Value> = {}
  const group = input.group
  if (!group || !group.group) return values
  put(values, 'crew', group.spaceLabel ?? group.purpose)
  if (input.tracks) {
    const members = agentsetMembers(group, input.tracks, input.nowUnixMs ?? 0)
    values.members = JSON.stringify(members)
    values.light = members.some(member => member.state === 'working') ? 'lit' : 'dark'
  }
  put(values, 'member', viewHolds(input.holds, AGENTSET_ID).member)
  if (input.models?.length) values.models = JSON.stringify(input.models.map(id => ({id})))
  return values
}

/** The rack's binding: the chosen member is the view's own; every delegation setting and Retry stands disabled with what it lacks. */
export function agentsetBinding(input: AgentsetInput): DesignBinding {
  return {
    id: AGENTSET_ID,
    values: agentsetValues(input),
    standing: disabled(AGENTSET_REFUSE),
    local: {member: value => holdView(AGENTSET_ID, 'member', typeof value === 'string' ? value : undefined)},
    writes: key => key in AGENTSET_REFUSE,
    write: async changes => {
      for (const {key} of changes) throw Error(AGENTSET_REFUSE[key as keyof typeof AGENTSET_REFUSE] ?? reading(key))
    },
  }
}
