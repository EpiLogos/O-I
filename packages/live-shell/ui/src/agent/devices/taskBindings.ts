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
// Runs lists a piece of work's attempts. The agency reading names no Factory run for a session, but the take lanes do (T-COVERAGE §1.3):
// AIKit's `encounter_task_attempts_list` says which Factory attempts the session's bound task serves, each with its Run and Factory state,
// and Factory's `factory_attempt_read` says what each is (owners/attemptTakes.ts readAttemptTakes, agent/factoryTakes.ts FactoryTake).
// Runs reads those takes: the session's Runs are its works, the selected Run's attempts its attempts, and the one whose Return Central
// received the one that stands. Stands writes through the take lanes' own act: Factory's `factory_owner` AttemptReceiving (kernel
// factory.rs:373; attemptTakes.ts chooseAttempt), which proposes the attempt's Return to Central's receiving field. Without the takes
// handed in, the attempts are absent and Stands stands disabled, saying so. Its view settings are the shell's. Pure, apart from the
// view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {AgentSessionTrack} from '../agentRunModel'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {sessionRowsOf} from './threadBinding'
import {familyFaceDevice} from './mainTrackBindings'
import type {EncounterSessionSettingsReading, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {FactoryTake, TakeState} from '../factoryTakes'
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
  /** The owner's refusal of the read, in its words, when it refused. */
  readonly refused?: string | null
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

/** The Journey the work belongs to (lane W7; D3's Journey view, software-factory__attempt-review.tsx `journey`): factory_development_read
 * `journey` and `commission-read` read a Journey by its ref, and the run reading (`run`) names the Run's Journey — reads that exist. The
 * take lanes read each Run's attempts (factory.attempt-reading/v1, which names its Run and no Journey) and ask neither, so the Journey stands
 * absent with that reason until a reader chains the run reading to the Journey's. */
export const RUNS_JOURNEY_UNREAD = 'The Journey the work belongs to: not read here yet — the take lanes read each Run\'s attempts (factory.attempt-reading/v1 names its Run, not its Journey), and nothing here asks the run reading (factory_development_read `run`) for its Journey or the Journey\'s own reads (`journey`, `commission-read`), which exist.'

export const RUNS_REFUSE = {
  /** No takes handed in: the chain has not given Runs the take lanes' reading of the session. */
  stands: 'Stands: Runs is not handed the session\'s takes here (the take lanes\' reading, owners/attemptTakes.ts useAttemptTakes), so no attempt is chosen from it; Factory\'s factory_owner AttemptReceiving is the write.',
} as const
/** Why the session's attempts stand absent. */
export const RUNS_UNREAD = {
  noTakes: 'The session\'s attempts are the take lanes\' reading (AIKit encounter_task_attempts_list, each Run read by factory_attempt_read), which is not handed to Runs here.',
  noneServed: 'AIKit names no Factory attempt that the session\'s bound task serves.',
  none: 'Factory receives a whole attempt: no owner operation takes a Return back from Central\'s receiving field, so nothing un-stands an attempt.',
} as const

/** The view's own settings and the shell's starting value of each (§19.11: Show All, Group by Attempt, View Tree, Compare None). */
export const RUNS_VIEW: Readonly<Record<string, Value>> = {show: 'all', group: 'attempt', view: 'tree', compare: 'none'}
const RUNS_LOCAL = ['work', 'attempt', 'show', 'group', 'view', 'compare', 'task', 'standsPending'] as const

/** The take lanes' reading of the selected session (owners/attemptTakes.ts useAttemptTakes `of`: null while AIKit has not answered, or
 * names nothing for it) and their act: choosing the attempt that stands (`choose`, Factory's AttemptReceiving), which answers {ok, note}
 * or {ok: false, error} in the owner's words. `timezone` is the clock an attempt's day and time are read on (the window's, absent). */
export interface RunsTakes {
  readonly takes: readonly FactoryTake[] | null
  readonly choose: (take: FactoryTake) => Promise<unknown>
  readonly timezone?: string
}

/** An attempt's standing in the design's words (software-factory__attempt-review.tsx STATES), from Factory's (factoryTakes.ts TakeState). */
const ATTEMPT_STATE: Readonly<Record<TakeState, string>> = {prepared: 'queued', running: 'running', returned: 'done', failed: 'failed'}

/** A take's day and time on a clock (`14 Oct`, `09:40`); nothing where the owner disclosed no admission time. */
function dayAndTime(atUnixMs: number | null, timezone: string | undefined): {day?: string; at?: string} {
  if (atUnixMs === null || !Number.isFinite(atUnixMs)) return {}
  try {
    const at = new Date(atUnixMs)
    return {day: new Intl.DateTimeFormat('en-GB', {timeZone: timezone, day: 'numeric', month: 'short'}).format(at),
      at: new Intl.DateTimeFormat('en-GB', {timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(at)}
  } catch { return {} }
}

/** The session's Runs as the design's works ({id: the Run's ref, name: the unit it works, when the owner's ref says one}), in the order
 * the takes give them, and the attempts of the chosen Run as the design's attempts, oldest first by admission (the owner's order where
 * it disclosed none): {id, n, state, session, day, at, seen (minutes from admission to its Return or failure), current (Central received
 * its Return), ret {summary, receiving}, tasks: [] (no reading gives an attempt's tasks)}. Pure. */
export function runsOfTakes(takes: readonly FactoryTake[], work: string | undefined, timezone?: string): {works: Record<string, Value>[]; work: string | undefined; attempts: Record<string, unknown>[]} {
  const works: Record<string, Value>[] = []
  for (const take of takes) if (!works.some(row => row.id === take.runRef)) works.push({id: take.runRef, ...(take.unit ? {name: take.unit} : {})})
  const chosen = work !== undefined && works.some(row => row.id === work) ? work : (works[works.length - 1]?.id as string | undefined)
  const mine = takes.filter(take => take.runRef === chosen)
  const ordered = mine.every(take => take.startUnixMs !== null) ? [...mine].sort((a, b) => a.startUnixMs! - b.startUnixMs!) : mine
  const attempts = ordered.map((take, at) => {
    const seen = take.startUnixMs !== null && take.endUnixMs !== null ? Math.max(0, Math.round((take.endUnixMs - take.startUnixMs) / 60_000)) : undefined
    return {id: take.attemptRef, n: at + 1, state: ATTEMPT_STATE[take.state], session: take.sessionRef, ...dayAndTime(take.startUnixMs, timezone), ...(seen !== undefined ? {seen} : {}),
      current: !!take.receivingRef, ret: {...(take.summary ? {summary: take.summary} : {}), receiving: !!take.receivingRef}, tasks: []}
  })
  return {works, work: chosen, attempts}
}

/** Runs' values: the selected session (the Thread's own key), the view's settings; with the takes, the session's Runs, the chosen Run's
 * attempts and the one that stands. */
export function runsValues(session: string | null, holds: ChainHolds, takes?: RunsTakes): Values {
  const view = viewHolds(holds, RUNS_ID)
  const values: Record<string, Value> = {}
  for (const key of RUNS_LOCAL) put(values, key, view[key] ?? RUNS_VIEW[key])
  put(values, 'session', session)
  if (session && takes?.takes) {
    const read = runsOfTakes(takes.takes, typeof view.work === 'string' ? view.work : undefined, takes.timezone)
    values.works = JSON.stringify(read.works)
    values.attempts = JSON.stringify(read.attempts)
    put(values, 'work', read.work)
    const stands = read.attempts.find(attempt => attempt.current === true)
    put(values, 'stands', stands ? String(stands.id) : undefined)
  }
  return values
}

/** Why Runs' attempts and Stands cannot stand now, by key; empty when the takes are read. */
function runsStanding(session: string | null, takes?: RunsTakes): Record<string, Standing> {
  const journey = {journey: {disabled: RUNS_JOURNEY_UNREAD}}
  if (!takes) return {...journey, stands: {disabled: RUNS_REFUSE.stands}}
  if (!session) return {...journey, stands: {disabled: 'Stands: no session is selected; an attempt stands on its session\'s Run.'}}
  if (!takes.takes) return {...journey, stands: {disabled: `Stands: ${RUNS_UNREAD.noneServed}`}}
  return journey
}

export function runsBinding(session: string | null, holds: ChainHolds, takes?: RunsTakes): DesignBinding {
  const standing = runsStanding(session, takes)
  return {
    id: RUNS_ID,
    values: runsValues(session, holds, takes),
    standing,
    local: Object.fromEntries(RUNS_LOCAL.map(key => [key, (value: Value | undefined) => holdView(RUNS_ID, key, value)])),
    writes: key => key === 'stands',
    write: async changes => {
      for (const {key, value} of changes) {
        holdView(RUNS_ID, 'standsPending', undefined)
        if (key !== 'stands') throw Error(`${key} is a reading: its owner reports it; nothing here changes it.`)
        if (standing.stands?.disabled) throw Error(standing.stands.disabled)
        if (value === 'none') throw Error(RUNS_UNREAD.none)
        const take = takes!.takes!.find(row => row.attemptRef === value && row.sessionRef === session)
        if (!take) throw Error(`Stands: ${String(value)} is no attempt of the session's takes.`)
        // Factory's own act (AttemptReceiving): the attempt's Return proposed to Central's receiving field, answered in its words.
        const answer = await takes!.choose(take) as {ok?: unknown; error?: unknown} | undefined
        if (answer && answer.ok === false) throw Error(typeof answer.error === 'string' ? answer.error : 'Factory did not receive the attempt.')
      }
    },
  }
}
