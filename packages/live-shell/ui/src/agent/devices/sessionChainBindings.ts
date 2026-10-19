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
import {holdView, viewHolds, type ChainHolds} from './designBindings'
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
    standing: disabled(RUN_REFUSE),
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

export const CUSTODY_REFUSE = {
  autonomy: missing('Autonomy', 'a write of the session\'s custody (encounter_task_read reads it; agentParamAddresses.ts autonomy has no write path)', 'Software Factory'),
  gate: missing('Review gate', 'a review gate in the session\'s custody record', 'Software Factory'),
  escalate: missing('Escalate to', 'an escalation contact in the session\'s custody record', 'Software Factory'),
  handBack: missing('Hand back', 'Factory\'s custody release through the kernel (the custody hold, software-factory.custody.hold, has no kernel op)', 'Software Factory'),
} as const

export interface CustodyInput {
  /** The chain's session, null when none is selected. */
  readonly sessionRef: string | null
  /** The session's task record's custody word (encounter_task_read `custody` or `autonomy`), null when unread. */
  readonly autonomy: string | null
  /** The Agent's values (its light: Custody stands on the Agent). */
  readonly agent: Values
}

/** Custody's values: the Agent's light and the custody the session's task record names. Write mode is Scope's reading, and none is
 * reported (designBindings.ts scopeValues); the gate, the contact, the people, the held items and the hand-back light have no owner
 * reading (the transport's Re-enable light is the shell's own flag, never set by an owner). */
export function custodyValues(input: CustodyInput): Values {
  const values: Record<string, Value> = {}
  if (input.sessionRef == null) return values
  put(values, 'light', input.agent.light)
  put(values, 'autonomy', input.autonomy)
  return values
}

/** Custody's binding: Write mode is Scope's own key and row (one binding feeds both: the same write, the same standing); every other
 * setting has no owner write and stands disabled with the operation it lacks. */
export function custodyBinding(input: CustodyInput, scope: Pick<DesignBinding, 'write' | 'standing'> | null): DesignBinding {
  const standing: Record<string, Standing> = disabled(CUSTODY_REFUSE)
  standing.writeMode = scope?.standing?.writeMode ?? {disabled: 'Write mode is Scope\'s: the chain\'s Scope is not drawn on its owner here.'}
  return {
    id: CUSTODY_ID,
    values: custodyValues(input),
    standing,
    writes: key => key === 'writeMode' || key in CUSTODY_REFUSE,
    write: async changes => {
      for (const {key, value} of changes) {
        if (key === 'writeMode') {
          if (!scope?.write) throw Error(standing.writeMode!.disabled!)
          await scope.write([{key, value}])
          continue
        }
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
  readonly holds: ChainHolds
}

/** A member's state from its own task clips, as the run model holds them: a running task is Working, a stalled one Stalled, every
 * task done is Done. Anything else is not said (idle and failed have no reading here). */
function memberState(track: AgentSessionTrack): 'working' | 'stalled' | 'done' | undefined {
  const tasks = track.tasks.filter(task => !task.softStop)
  if (tasks.some(task => task.state === 'running')) return 'working'
  if (tasks.some(task => task.state === 'stalled')) return 'stalled'
  return tasks.length && tasks.every(task => task.state === 'done') ? 'done' : undefined
}

/** The group's members as the rack reads them (software-factory__agentset-rack.tsx:8-13): each session of the SessionSpace, named by
 * its agent (else its purpose), its goal the session's purpose, its state from its tasks. agency_read discloses no spawn parent below
 * the space (agentRunModel.ts GROUP_DISCLOSURE), so every member stands at the top; no model, tool count or files are reported. */
export function agentsetMembers(group: AgentSessionTrack, tracks: readonly AgentSessionTrack[]): Record<string, Value>[] {
  return tracks.filter(track => !track.group && track.parentRef === group.sessionRef).map(track => {
    const state = memberState(track)
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
    const members = agentsetMembers(group, input.tracks)
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
