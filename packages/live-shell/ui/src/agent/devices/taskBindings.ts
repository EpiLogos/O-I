// Tasks (DLW §19.1, software-factory:tasks) and Runs (§19.11, software-factory:attempt-review) on their owners (lane BF2).
//
// Tasks are the clips on a session's track: the run model's tasks of the selected session (agent/agentRunModel.ts TaskClip — n,
// title, state running · queued · stalled · done, start and last activity — built by AgentSessionsProvider from agency_read, the
// session's task record and temporal_events_read), the session list the Thread offers (threadBinding.ts sessionRowsOf), and the
// task THE selection names (`<track>#task/<n>`, timeline/factoryTrackAdapter.ts parseFactoryTaskRef). Launch quantize is the
// transport's Quantize — the Agent's interrupt timing (one binding feeds both). A new task goes the Agent's own way (its declared
// new-task row, kernel:harness_agent_control configure {prompt}). Launch, Retry and Stop after have only the whole bound harness
// as their grain (factoryTrackAdapter.ts FACTORY_GRAIN), never one task, so they stand disabled with that reason. The per-task
// settings (Mode, Then, To, Effort, Autonomy, Register, Form here; every setting of the Clip view through TASK_SEAMS) are the
// session's settings on their owner, AIKit's `encounter-session-settings` (kernel encounter_session_settings, agent/sessionSettings.ts),
// written against the revision that stands. The task's log is not read: the temporal stream names the session, not the task's
// tools along its time.
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
import type {EncounterSessionSettingsReading, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {SETTINGS_WHY, TASKS_DEVICE_SETTINGS, settingsRefusal, taskSettingChange, tasksDeviceChange, tasksDeviceValues, writeSessionSettings,
  type TasksDeviceSetting} from '../sessionSettings'

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
}

/** Where the session's settings are written: the transport and register its owner is reached through, and the reading the
 * change is made against (null while it is read). */
export interface TaskSeamContext {
  readonly transport: KernelTransportStatus
  readonly project: string
  readonly settings: EncounterSessionSettingsReading | null
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

/** The seam each task setting writes through (T-REALIGN R2: "Owner ops that do not exist yet are built, not listed"): the session's
 * settings on their owner. A seam whose owner op does not stand names why (`refused`) and its control stands disabled with it. */
export interface TaskSeam {
  /** Why no owner takes it; absent once the op stands. */
  readonly refused?: string
  readonly send: (task: TaskAddress, value: Value, context: TaskSeamContext) => Promise<void>
}

const settingSeam = (setting: TaskSetting): TaskSeam => ({
  send: async (task, value, context) => {
    if (task.n !== 1) throw new Error(SETTINGS_WHY.oneTask)
    const made = taskSettingChange(setting, value, context.settings)
    if ('refused' in made) throw new Error(made.refused)
    await writeSessionSettings(context.transport, context.project, task.sessionRef, made.change)
  },
})

export const TASK_SEAMS: Readonly<Record<TaskSetting, TaskSeam>> = {
  name: settingSeam('name'),
  colour: settingSeam('colour'),
  active: settingSeam('active'),
  register: settingSeam('register'),
  form: settingSeam('form'),
  launch: settingSeam('launch'),
  then: settingSeam('then'),
  handoff: settingSeam('handoff'),
  quantize: settingSeam('quantize'),
  effort: settingSeam('effort'),
  autonomy: settingSeam('autonomy'),
  envelopeMode: settingSeam('envelopeMode'),
  envelopeLink: settingSeam('envelopeLink'),
}

/** The owner op the task's own acts wait for, in its exact shape. */
export const TASK_OP_SHAPES: Readonly<Record<string, string>> = {
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
  /** The session's settings on their owner, and where they are written; null where nothing reads them. */
  readonly settings?: TaskSeamContext | null
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
  // The settings are the bound task's: the first on the track.
  if (input.settings?.settings && (task?.n ?? 1) === 1) Object.assign(values, tasksDeviceValues(input.settings.settings, typeof values.elapsed === 'number' ? values.elapsed : 0))
  return values
}

const isDeviceSetting = (key: string): key is TasksDeviceSetting => (TASKS_DEVICE_SETTINGS as readonly string[]).includes(key)

export interface TasksPorts {
  /** Move THE selection to a task of the session (its clip). */
  readonly selectTask: (n: number) => void
  /** Queue a new task the Agent's own way (its new-task row); rejects with the owner's refusal. */
  readonly queue: (text: string) => Promise<void>
}

export function tasksBinding(input: TasksInput, agent: Pick<DesignBinding, 'write'> | null, ports: TasksPorts): DesignBinding {
  const settingsWhy = input.session ? settingsRefusal(input.settings, input.selectedTask) : null
  return {
    id: TASKS_ID,
    values: tasksValues(input),
    standing: {...disabled(TASKS_REFUSE), ...(settingsWhy ? Object.fromEntries(TASKS_DEVICE_SETTINGS.map(key => [key, {disabled: settingsWhy}])) : {})},
    local: {task: value => { const n = typeof value === 'number' ? value : Number(value); if (Number.isSafeInteger(n) && n >= 1) ports.selectTask(n) }},
    writes: key => key === 'quantize' || key === 'newTask' || key in TASKS_REFUSE || isDeviceSetting(key),
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
        if (isDeviceSetting(key)) {
          const context = input.settings
          if (!input.session) throw Error('No session is selected: a task\'s settings are its session\'s.')
          const why = settingsRefusal(context, input.selectedTask)
          if (why || !context) throw Error(why ?? SETTINGS_WHY.notHere)
          const made = tasksDeviceChange(key, value, context.settings)
          if ('refused' in made) throw Error(made.refused)
          await writeSessionSettings(context.transport, context.project, input.session.sessionRef, made.change)
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
