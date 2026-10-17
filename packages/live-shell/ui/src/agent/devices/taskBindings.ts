// Tasks (DLW §19.1, software-factory:tasks) and Runs (§19.11, software-factory:attempt-review) on their owners (lane BF2).
//
// Tasks are the clips on a session's track: the run model's tasks of the selected session (agent/agentRunModel.ts TaskClip — n,
// title, state running · queued · stalled · done, start and last activity — built by AgentSessionsProvider from agency_read, the
// session's task record and temporal_events_read), the session list the Thread offers (threadBinding.ts sessionRowsOf), and the
// task THE selection names (`<track>#task/<n>`, timeline/factoryTrackAdapter.ts parseFactoryTaskRef). Launch quantize is the
// transport's Quantize — the Agent's interrupt timing (one binding feeds both). A new task goes the Agent's own way (its declared
// new-task row, kernel:harness_agent_control configure {prompt}). Launch, Retry and Stop after have only the whole bound harness
// as their grain (factoryTrackAdapter.ts FACTORY_GRAIN), never one task, so they stand disabled with that reason; the per-task
// settings (mode, then, effort, autonomy, register, form) have no owner at all. The task's log is not read: the temporal stream
// names the session, not the task's tools along its time.
//
// Runs lists a piece of work's attempts (kernel factory_attempt_read, addressed by a Factory state path and a run ref). The agency
// reading names neither for a session (shell/ModeDetail.tsx FactoryTaskLogDetail: "the sessions reading names none"), so its
// attempts and works are absent and say so; its view settings are the shell's; Stands has no owner write. Pure, apart from the
// view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {AgentSessionTrack} from '../agentRunModel'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {sessionRowsOf} from './threadBinding'
import {familyFaceDevice} from './mainTrackBindings'

export const TASKS_DESIGN = 'software-factory:tasks'
export const RUNS_DESIGN = 'software-factory:attempt-review'
export const TASKS_ID = 'factory:tasks'
export const RUNS_ID = 'factory:runs'

/** Software Factory's tasks and runs as devices of the runtime, of their admitted faces (designKey is the design's id): `tasks` is the
 * family's own (softwareFactoryFamilyManifest.ts), `attempt-review` the extension declared onto it (worldShellFamilies.ts). Null when
 * the family does not admit the face. */
export const tasksDevice = (): DeviceInstance | null => familyFaceDevice(TASKS_ID, 'software-factory', 'tasks', 'Tasks', 'session')
export const runsDevice = (): DeviceInstance | null => familyFaceDevice(RUNS_ID, 'software-factory', 'attempt-review', 'Runs', 'arrangement')

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

// ---------------------------------------------------------------------------------------------------------------- Tasks

const GRAIN = (what: string) => missing(what, `a ${what.toLowerCase()} of one task (harness_agent_control addresses the whole bound harness; the owner takes no task)`, 'Actuation')
export const TASKS_REFUSE: Readonly<Record<string, string>> = {
  launch: GRAIN('Launch'),
  retry: GRAIN('Retry'),
  stopAfter: GRAIN('Stop after'),
  mode: missing('Mode', 'a task\'s launch mode in its task record', 'Software Factory'),
  then: missing('Then', 'a task\'s follow action in its task record', 'Software Factory'),
  to: missing('To', 'a hand-off to another session', 'Software Factory'),
  effort: missing('Effort for this task', 'a per-task effort (the Agent\'s Effort is the session\'s)', 'Actuation'),
  autonomy: missing('Autonomy for this task', 'a per-task autonomy (Custody sets the session\'s)', 'Software Factory'),
  register: missing('Register', 'an output style for one task', 'Actuation'),
  form: missing('Form', 'an output style for one task', 'Actuation'),
}

export interface TasksInput {
  /** The chain's session (its track), null when none is selected. */
  readonly session: AgentSessionTrack | null
  readonly tracks: readonly AgentSessionTrack[] | null
  /** The instant the tracks were read at. */
  readonly nowUnixMs: number
  /** The task THE selection names in this session, by its ordinal. */
  readonly selectedTask: number | null
  /** The Agent's values (its light and interrupt timing). */
  readonly agent: Values
}

/** The session's tasks as the design reads them (software-factory__tasks.tsx:8-9): {n, name, state, idle} — a state the owner and the
 * activity do not say is left out, never guessed; idle is a stalled task's seconds since its last output. */
export function taskRowsOf(track: AgentSessionTrack, nowUnixMs: number): Record<string, Value>[] {
  return track.tasks.filter(task => !task.softStop).map(task => ({
    n: task.n,
    ...(task.title ? {name: task.title} : {}),
    ...(task.state !== 'unknown' ? {state: task.state} : {}),
    ...(task.state === 'stalled' && task.lastActivityUnixMs != null ? {idle: Math.max(0, Math.round((nowUnixMs - task.lastActivityUnixMs) / 1000))} : {}),
  }))
}

export function tasksValues(input: TasksInput): Values {
  const values: Record<string, Value> = {}
  const track = input.session
  if (!track || track.group) return values
  values.session = track.sessionRef
  put(values, 'light', input.agent.light)
  put(values, 'quantize', input.agent.quantize)
  if (input.tracks) values.sessions = JSON.stringify(sessionRowsOf(input.tracks))
  values.tasks = JSON.stringify(taskRowsOf(track, input.nowUnixMs))
  const task = input.selectedTask == null ? undefined : track.tasks.find(clip => !clip.softStop && clip.n === input.selectedTask)
  if (task) {
    values.task = task.n
    if (task.startUnixMs != null && task.lastActivityUnixMs != null) values.elapsed = Math.max(0, Math.round((task.lastActivityUnixMs - task.startUnixMs) / 1000))
  }
  return values
}

export interface TasksPorts {
  /** Move THE selection to a task of the session (its clip). */
  readonly selectTask: (n: number) => void
  /** Queue a new task the Agent's own way (its new-task row); rejects with the owner's refusal. */
  readonly queue: (text: string) => Promise<void>
}

export function tasksBinding(input: TasksInput, agent: Pick<DesignBinding, 'write'> | null, ports: TasksPorts): DesignBinding {
  return {
    id: TASKS_ID,
    values: tasksValues(input),
    standing: disabled(TASKS_REFUSE),
    local: {task: value => { const n = typeof value === 'number' ? value : Number(value); if (Number.isSafeInteger(n) && n >= 1) ports.selectTask(n) }},
    writes: key => key === 'quantize' || key === 'newTask' || key in TASKS_REFUSE,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'quantize') {
          if (!agent?.write) throw Error('The chain\'s Agent is not drawn on its owner here, so nothing carries the timing.')
          await agent.write([{key, value}])
          continue
        }
        if (key === 'newTask') {
          const text = String(value).trim()
          if (!input.session) throw Error('No session is selected: a task is written on a session\'s track.')
          if (text) await ports.queue(text)
          continue
        }
        throw Error(TASKS_REFUSE[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- Runs

export const RUNS_REFUSE = {
  stands: missing('Stands', 'an attempt\'s acceptance through the kernel (factory_attempt_read only reads)', 'Software Factory'),
} as const

/** The view's own settings and the shell's starting value of each (§19.11: Show All, Group by Attempt, View Tree, Compare None). */
export const RUNS_VIEW: Readonly<Record<string, Value>> = {show: 'all', group: 'attempt', view: 'tree', compare: 'none'}
const RUNS_LOCAL = ['work', 'attempt', 'show', 'group', 'view', 'compare', 'task', 'standsPending'] as const

/** Runs' values: the selected session (the Thread's own key), the view's settings; no attempts and no works: no reading names the
 * session's Factory run. */
export function runsValues(session: string | null, holds: ChainHolds): Values {
  const view = viewHolds(holds, RUNS_ID)
  const values: Record<string, Value> = {}
  for (const key of RUNS_LOCAL) put(values, key, view[key] ?? RUNS_VIEW[key])
  put(values, 'session', session)
  return values
}

export function runsBinding(session: string | null, holds: ChainHolds): DesignBinding {
  return {
    id: RUNS_ID,
    values: runsValues(session, holds),
    standing: disabled(RUNS_REFUSE),
    local: Object.fromEntries(RUNS_LOCAL.map(key => [key, (value: Value | undefined) => holdView(RUNS_ID, key, value)])),
    writes: key => key === 'stands',
    write: async changes => {
      for (const {key} of changes) {
        holdView(RUNS_ID, 'standsPending', undefined)
        throw Error(key === 'stands' ? RUNS_REFUSE.stands : `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
