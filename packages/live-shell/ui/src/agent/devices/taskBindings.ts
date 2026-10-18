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

// ---------------------------------------------------------------------------------------------------------------- one task's own ops

/** One task, as its owner would address it: its session and its ordinal in that session (`<track>#task/<n>`). */
export interface TaskAddress {
  readonly sessionRef: string
  readonly n: number
}

/** The settings that belong to one task (manual §19.1 Clip view: its name, colour and activator, its output style, its Launch, Then,
 * Hand off to and Quantize, and its envelopes — the Agent's Effort and Autonomy for this task, as Automation or Modulation, linked or
 * not). */
export type TaskSetting = 'name' | 'colour' | 'active' | 'register' | 'form' | 'launch' | 'then' | 'handoff' | 'quantize' | 'effort' | 'autonomy'
  | 'envelopeMode' | 'envelopeLink'

/** The seam each task setting writes through (T-REALIGN R2: "Owner ops that do not exist yet are built, not listed"). Today every one
 * refuses in its owner's words and stands disabled with them (`refused`); the owner op wires in one line — replace the entry with
 * `{send: (task, value) => <the op>}` and the Clip view control enables, its change going to the owner on release. The op shapes the
 * owners need are TASK_OP_SHAPES. */
export interface TaskSeam {
  /** Why no owner takes it yet; absent once the op stands. */
  readonly refused?: string
  readonly send: (task: TaskAddress, value: Value) => Promise<void>
}
const refusedSeam = (why: string): TaskSeam => ({refused: why, send: async () => { throw new Error(why) }})

export const TASK_REFUSE: Readonly<Record<TaskSetting, string>> = {
  name: missing('Name', 'a task\'s title in its task record', 'Software Factory'),
  colour: missing('Colour', 'a task clip\'s colour in its task record (a task takes its session\'s colour)', 'Software Factory'),
  active: missing('Clip activator', 'a task\'s activator: an off task stays queued and does not run', 'Software Factory'),
  register: TASKS_REFUSE.register!,
  form: TASKS_REFUSE.form!,
  launch: TASKS_REFUSE.mode!,
  then: TASKS_REFUSE.then!,
  handoff: TASKS_REFUSE.to!,
  quantize: missing('Quantize for this task', 'a task\'s launch quantize in its task record (Global follows the transport\'s Quantize, the Agent\'s interrupt timing)', 'Software Factory'),
  effort: TASKS_REFUSE.effort!,
  autonomy: TASKS_REFUSE.autonomy!,
  envelopeMode: missing('Envelope mode', 'a task envelope\'s Automation or Modulation (the per-task effort and autonomy op carries it)', 'Actuation'),
  envelopeLink: missing('Envelope link', 'a task envelope\'s own length and loop (the per-task effort and autonomy op carries it)', 'Actuation'),
}

export const TASK_SEAMS: Readonly<Record<TaskSetting, TaskSeam>> = {
  name: refusedSeam(TASK_REFUSE.name),
  colour: refusedSeam(TASK_REFUSE.colour),
  active: refusedSeam(TASK_REFUSE.active),
  register: refusedSeam(TASK_REFUSE.register),
  form: refusedSeam(TASK_REFUSE.form),
  launch: refusedSeam(TASK_REFUSE.launch),
  then: refusedSeam(TASK_REFUSE.then),
  handoff: refusedSeam(TASK_REFUSE.handoff),
  quantize: refusedSeam(TASK_REFUSE.quantize),
  effort: refusedSeam(TASK_REFUSE.effort),
  autonomy: refusedSeam(TASK_REFUSE.autonomy),
  envelopeMode: refusedSeam(TASK_REFUSE.envelopeMode),
  envelopeLink: refusedSeam(TASK_REFUSE.envelopeLink),
}

/** The owner ops the seams wait for, in their exact shapes (the lead builds them; PROPOSE). */
export const TASK_OP_SHAPES: Readonly<Record<string, string>> = {
  'Software Factory · task_record_set': 'request {session_ref, task: n, set: {title?, colour?, active?, launch?: once|hold|loop, then?: next|handoff|stop, handoff_to?: session_ref, quantize?: global|now|next tool|next turn}} → answer the task record at its new revision, or the refusal in words',
  'Actuation · harness_task_settings': 'request {session_ref, task: n, effort?: inherit|low|medium|high|max (or steps as [[second, step]…]), autonomy?: inherit|suggest|review|auto, mode?: automation|modulation, linked?: boolean, style?: {register?: plain|warm|terse, form?: technical|narrative|list}} → answer the task\'s settings as the agent will read them',
  'Actuation · harness_task_control': 'request {session_ref, task: n, act: launch|retry|stop} → answer the task\'s state (one task, not the whole bound harness)',
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
