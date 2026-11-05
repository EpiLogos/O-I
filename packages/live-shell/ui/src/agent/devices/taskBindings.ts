// Tasks (DLW §19.1, software-factory:tasks) and Runs (§19.11, software-factory:attempt-review) on their owners (lane BF2).
//
// Tasks are the clips on a session's track: the run model's tasks of the selected session (agent/agentRunModel.ts TaskClip — n,
// title, state running · queued · stalled · done, start and last activity — built by AgentSessionsProvider from agency_read, the
// session's task record and temporal_events_read), the session list the Thread offers (threadBinding.ts sessionRowsOf), and the
// task THE selection names (`<track>#task/<n>`, timeline/factoryTrackAdapter.ts parseFactoryTaskRef). Launch quantize is the
// transport's Quantize — the Agent's interrupt timing (one binding feeds both). A new task goes the Agent's own way (its declared
// new-task row, kernel:harness_agent_control configure {prompt}). Launch, Retry and Stop after are Software Factory's acts on a Run's
// unit: Factory names the units a task stands on (factory_owner attempt-task-units), so Retry reads them and retries the task's unit
// (retryTask), and Stop after asks the unit its current attempt stands on to stop (stopAfterTask); Launch waits on Software Factory, which
// has no way yet to start a unit from its owners' readings (TASKS_REFUSE). The per-task
// settings (Mode, Then, Effort, Autonomy, Register, Form here; every setting of the Clip view through TASK_SEAMS) are the
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
import type {AgentSessionTrack} from '../agentRunModel'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {sessionRowsOf} from './threadBinding'
import type {EncounterSessionSettingsReading, FactoryAttemptCancellation, FactoryOwnerRequest, FactoryTaskUnit, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {FactoryTake, TakeState} from '../factoryTakes'
import {journeyOf, type RunJourneyRead} from './runJourney'
import {NO_RUN, collectedOf} from './workcellMaterial'
import {SETTINGS_WHY, TASKS_DEVICE_SETTINGS, settingsRefusal, taskSettingChange, tasksDeviceChange, tasksDeviceValues, writeSessionSettings,
  type TasksDeviceSetting} from '../sessionSettings'

export const TASKS_DESIGN = 'software-factory:tasks'
export const RUNS_DESIGN = 'software-factory:attempt-review'
export const TASKS_ID = 'factory:tasks'
export const RUNS_ID = 'factory:runs'

// Tasks and Runs have no devices of their own (tickets 725 and 772): a task is a clip, its attempts the track's takes in Arrangement view
// (§16.1, §19.1). Their ids stay as the keys their view holds are kept under (RUNS_ID's `viewHolds`), and nothing publishes them (ticket 804);
// their bindings stay for the tests that read the owners through them.

const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

// ---------------------------------------------------------------------------------------------------------------- Tasks

// A task's lifecycle is Software Factory's (lane K0; Factory README: an attempt Action owns start, retry, cancel and Return, and a retry
// is a new attempt record): Factory starts, retries and cancels the attempt of a Run's workflow unit (`factory attempt action`, operations
// start-serial, retry, request-cancellation), not a clip of a session. Factory names the units a task stands on (`factory attempt units`,
// the kernel's factory_owner attempt-task-units, O-I ticket 772), so Retry reads them for the session's bound task and retries its unit
// (factory_owner attempt-retry, as the Run map's Retry), and Stop after asks the unit its current attempt stands on to stop
// (factory_owner attempt-request-cancellation, O-I ticket 842; kernel factory_retry.rs). Launch waits on Software Factory: no reading of its
// owners says which unit to start, and Factory has no start of one from them yet. harness_agent_control addresses the whole bound
// harness, never one task.
export const TASKS_REFUSE: Readonly<Record<string, string>> = {
  launch: 'Launch: Software Factory has no way yet to start a unit from its owners\' readings, so a task\'s unit is not started from here (Software Factory).',
  retry: 'Retry: no carrier to Factory\'s attempt-task-units and attempt-retry stands here, so the task\'s unit cannot be read or retried (Software Factory).',
  stopAfter: 'Stop after: no carrier to Factory\'s attempt-task-units and attempt-request-cancellation stands here, so the task\'s unit cannot be read or stopped (Software Factory).',
}

/** Factory's units of a task (factory.attempt-task-units-reading/v1 `units`), or null when the answer is not that reading. Pure. */
export function taskUnitsOf(reading: unknown): FactoryTaskUnit[] | null {
  const doc = reading && typeof reading === 'object' && !Array.isArray(reading) ? reading as Record<string, unknown> : null
  if (!doc || doc.contract !== 'factory.attempt-task-units-reading/v1' || !Array.isArray(doc.units)) return null
  return doc.units.flatMap(row => {
    const unit = row && typeof row === 'object' ? row as Record<string, unknown> : null
    if (!unit || typeof unit.runRef !== 'string' || typeof unit.workflowUnitRef !== 'string') return []
    return [{runRef: unit.runRef, workflowUnitRef: unit.workflowUnitRef, currentAttemptRef: typeof unit.currentAttemptRef === 'string' ? unit.currentAttemptRef : null,
      status: typeof unit.status === 'string' ? unit.status : null, attempts: typeof unit.attempts === 'number' ? unit.attempts : 0, runRevision: unit.runRevision,
      required: unit.required === true}]
  })
}

/** The one unit a task's Retry addresses: the failed one where one of its current attempts failed, else its one current unit, else its one
 * unit; or the refusal in words — Factory retries one unit at a time, so a task on several says which they are. Pure. */
export function retryTargetOf(units: readonly FactoryTaskUnit[], taskRef: string): FactoryTaskUnit | {refused: string} {
  if (!units.length) return {refused: `Retry: Factory retains no attempt of ${taskRef} on any Run (\`factory attempt units\`), so there is no unit to retry.`}
  const current = units.filter(unit => unit.currentAttemptRef)
  const failed = current.filter(unit => unit.status === 'failed')
  const pick = failed.length === 1 ? failed[0] : current.length === 1 ? current[0] : units.length === 1 ? units[0] : undefined
  if (pick) return pick
  const named = (failed.length ? failed : current.length ? current : units).map(unit => `${unit.runRef} · ${unit.workflowUnitRef}`)
  return {refused: `Retry: ${taskRef} stands on ${named.length} units (${named.join(', ')}); Factory retries one unit at a time, so retry the one you mean from the Run map.`}
}

/** A task's Retry through Factory: the units it stands on read (factory_owner attempt-task-units), then its unit retried (attempt-retry,
 * under the unit's retry grant). Factory's answer stands when it retried; its refusal, or the driver's own named as such, is thrown in its
 * words. `owner` is the kernel's factory_owner (ownerRoutes.ts factoryOwnerWrite). */
export async function retryTask(owner: (request: FactoryOwnerRequest) => Promise<unknown>, statePath: string, taskRef: string): Promise<void> {
  const reading = await owner({kind: 'attempt-task-units', state_path: statePath, task_ref: taskRef})
  const units = taskUnitsOf(reading)
  if (!units) throw Error(`Retry: \`factory attempt units\` answered something other than its units of ${taskRef}.`)
  const target = retryTargetOf(units, taskRef)
  if ('refused' in target) throw Error(target.refused)
  const answer = await owner({kind: 'attempt-retry', state_path: statePath, run_ref: target.runRef, workflow_unit_ref: target.workflowUnitRef}) as
    {status?: unknown; refusal?: {message?: unknown} | null} | null
  if (answer?.status === 'retried' || answer?.status === 'already-retried') return
  const words = typeof answer?.refusal?.message === 'string' ? answer.refusal.message : 'Factory answered no retry.'
  throw Error(answer?.status === 'uncertain' ? `Factory did not answer and may have run: ${words} Read the Run again before retrying.` : words)
}

/** The one unit a task's Stop after addresses: the unit the task's current attempt stands on (its `currentAttemptRef`, which Factory names
 * only where the current attempt is the task's); or the refusal in words — none current is nothing to stop, and Factory stops one unit at a
 * time, so a task current on several says which they are. Pure. */
export function stopTargetOf(units: readonly FactoryTaskUnit[], taskRef: string): FactoryTaskUnit | {refused: string} {
  const current = units.filter(unit => unit.currentAttemptRef)
  if (current.length === 1) return current[0]!
  if (!current.length) return {refused: `Stop after: no attempt of ${taskRef} is current on any unit (\`factory attempt units\`), so there is nothing to stop.`}
  const named = current.map(unit => `${unit.runRef} · ${unit.workflowUnitRef}`)
  return {refused: `Stop after: ${taskRef} stands current on ${named.length} units (${named.join(', ')}); Factory stops one unit at a time, so stop the one you mean from the Run map.`}
}

/** A task's Stop after through Factory: the units it stands on read (factory_owner attempt-task-units), then the unit its current attempt
 * stands on asked to stop (attempt-request-cancellation; kernel factory_retry.rs, the answer an oi.factory-attempt-cancellation/v1). It stops
 * no process: Factory's lifecycle takes the request. Cancel-requested or already-requested stands; refused or uncertain is thrown in
 * Factory's words (or the driver's, named as such). `owner` is the kernel's factory_owner (ownerRoutes.ts factoryOwnerWrite). */
export async function stopAfterTask(owner: (request: FactoryOwnerRequest) => Promise<unknown>, statePath: string, taskRef: string): Promise<void> {
  const units = taskUnitsOf(await owner({kind: 'attempt-task-units', state_path: statePath, task_ref: taskRef}))
  if (!units) throw Error(`Stop after: \`factory attempt units\` answered something other than its units of ${taskRef}.`)
  const target = stopTargetOf(units, taskRef)
  if ('refused' in target) throw Error(target.refused)
  const answer = await owner({kind: 'attempt-request-cancellation', state_path: statePath, run_ref: target.runRef, workflow_unit_ref: target.workflowUnitRef}) as
    Partial<FactoryAttemptCancellation> | null
  if (answer?.status === 'cancel-requested' || answer?.status === 'already-requested') return
  if ((answer?.status === 'refused' || answer?.status === 'uncertain') && typeof answer.refusal?.message === 'string') throw Error(answer.refusal.message)
  throw Error(`Stop after: Factory answered without its cancellation of ${target.runRef} · ${target.workflowUnitRef}.`)
}

/** Where the session's settings are written: the transport and register its owner is reached through, and the reading the
 * change is made against (null while it is read). */
export interface TaskSeamContext {
  readonly transport: KernelTransportStatus
  readonly project: string
  readonly settings: EncounterSessionSettingsReading | null
  /** The owner's refusal of the read, in its words, when it refused. */
  readonly refused?: string | null
  /** The hold an edit of what the agent holds takes first (§19.4; sessionChainBindings.ts holdBeforeEdit), with what is edited; it rejects,
   * in words, where the hold cannot be taken, and nothing is written. Absent: no custody is read here, and the edit is written as before. */
  readonly holdFirst?: (subject: string) => Promise<void>
}

/** What an edit of a task's setting names as edited, on the hold it takes first: the session's setting. */
export const settingSubject = (sessionRef: string, setting: string): string => `${sessionRef}/settings/${setting}`

// ---------------------------------------------------------------------------------------------------------------- one task's own ops

/** One task, as its owner would address it: its session and its ordinal in that session (`<track>#task/<n>`). */
export interface TaskAddress {
  readonly sessionRef: string
  readonly n: number
}

/** The settings that belong to one task (manual §19.1 Clip view: its name, colour and activator, its output style, its Loop with its stop
 * condition and cap, its Launch mode, Then and Quantize, what a Repeat varies — Variable, Levels, Repeats, Stop when — and its envelopes:
 * the Agent's Effort and Scope's Tool calls for this task, as Automation or Modulation, linked or not; the Agent's Autonomy is retired),
 * the Success conditions typed for it in the Intent panel, and Compare, the takes' own setting (O-I 795 round 14). */
export type TaskSetting = 'name' | 'colour' | 'active' | 'register' | 'form' | 'loop' | 'loopUntil' | 'loopCap' | 'launch' | 'then' | 'quantize'
  | 'repeatVariable' | 'repeatLevels' | 'repeatRepeats' | 'repeatStop' | 'effort' | 'toolCalls' | 'envelopeMode' | 'envelopeLink' | 'success' | 'compare'

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
    // An edit of what the agent holds takes the hold first, in this path (§19.4; DLW build ruling 2026-11-05).
    await context.holdFirst?.(settingSubject(task.sessionRef, setting))
    await writeSessionSettings(context.transport, context.project, task.sessionRef, made.change)
  },
})

export const TASK_SEAMS: Readonly<Record<TaskSetting, TaskSeam>> = {
  name: settingSeam('name'),
  colour: settingSeam('colour'),
  active: settingSeam('active'),
  register: settingSeam('register'),
  form: settingSeam('form'),
  loop: settingSeam('loop'),
  loopUntil: settingSeam('loopUntil'),
  loopCap: settingSeam('loopCap'),
  launch: settingSeam('launch'),
  then: settingSeam('then'),
  quantize: settingSeam('quantize'),
  repeatVariable: settingSeam('repeatVariable'),
  repeatLevels: settingSeam('repeatLevels'),
  repeatRepeats: settingSeam('repeatRepeats'),
  repeatStop: settingSeam('repeatStop'),
  effort: settingSeam('effort'),
  toolCalls: settingSeam('toolCalls'),
  envelopeMode: settingSeam('envelopeMode'),
  envelopeLink: settingSeam('envelopeLink'),
  // The Intent panel's Add: a Success condition typed for the task, kept with its settings (O-I 795).
  success: settingSeam('success'),
  // Compare (§19.1 The Launch panel; Arrangement view's take settings): the takes' own setting, kept with the task's (O-I 795 round 14).
  compare: settingSeam('compare'),
}

/** The owner op the task's own acts wait for, in its exact shape. */
export const TASK_OP_SHAPES: Readonly<Record<string, string>> = {
  'Software Factory · factory attempt action': 'operation start-serial | retry | request-cancellation on {run_ref, workflow_unit_ref} → factory.attempt-action/v1 receipt (retry routed: factory_owner attempt-retry); a task clip must first name its Run and unit',
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

/** The session's tasks as the design reads them (a task is a clip: clips/factory.tsx:38 STATE_WORD; the Tasks device was retired into it, §16.1): {n, name, state, idle} — a state the owner and the
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
  /** Retry the session's bound task through Factory (retryTask: its units read, its unit retried). Absent: no carrier stands. */
  readonly retry?: (sessionRef: string) => Promise<void>
  /** Stop after: the session's bound task's current unit asked to stop through Factory (stopAfterTask). Absent: no carrier stands. */
  readonly stopAfter?: (sessionRef: string) => Promise<void>
}

export function tasksBinding(input: TasksInput, agent: Pick<DesignBinding, 'write'> | null, ports: TasksPorts): DesignBinding {
  const settingsWhy = input.session ? settingsRefusal(input.settings, input.selectedTask) : null
  return {
    id: TASKS_ID,
    values: tasksValues(input),
    standing: {...disabled(Object.fromEntries(Object.entries(TASKS_REFUSE).filter(([key]) => !(key === 'retry' && ports.retry) && !(key === 'stopAfter' && ports.stopAfter)))), ...(settingsWhy ? Object.fromEntries(TASKS_DEVICE_SETTINGS.map(key => [key, {disabled: settingsWhy}])) : {})},
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
          await context.holdFirst?.(settingSubject(input.session.sessionRef, key))
          await writeSessionSettings(context.transport, context.project, input.session.sessionRef, made.change)
          continue
        }
        if (key === 'retry' && ports.retry) {
          if (!input.session) throw Error('Retry: no session is selected, so no task is named to retry.')
          await ports.retry(input.session.sessionRef)
          continue
        }
        if (key === 'stopAfter' && ports.stopAfter) {
          if (!input.session) throw Error('Stop after: no session is selected, so no task is named to stop.')
          await ports.stopAfter(input.session.sessionRef)
          continue
        }
        throw Error(TASKS_REFUSE[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- Runs

/** The Journey the work belongs to (lane W8; D3's Journey view, software-factory__attempt-review.tsx `journey`): read by runJourney.ts
 * through factory_development_read — the shown Run's reading names its Journey, the Journey's reading its purpose, status and Runs — for
 * the Run the take lanes name (its state path and ref). Why it is not drawn, when it is not. */
export const RUNS_JOURNEY_UNREAD = 'The Journey the work belongs to: no Run is shown — the take lanes name a Run (its state and ref) only for a selected session\'s attempts, and factory_development_read `run` and `journey` read it from there.'
export const RUNS_JOURNEY_READING = 'The Journey the work belongs to: Factory has not answered yet (factory_development_read `run`, then `journey`).'
export const RUNS_JOURNEY_NONE = 'The Journey the work belongs to: Factory names none for this Run (its reading\'s owningJourneyRefs is empty).'

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
  /** The Journey of the Run shown (runJourney.ts useRunJourney), as the window holds it; absent: not read. */
  readonly journey?: {readonly status: 'reading' | 'answered' | 'refused'; readonly value: RunJourneyRead | null; readonly error: string | null}
  /** The world receipt each attempt's run stood in, by attempt ref, where a reading names one; absent or empty: none is named (NO_RUN). */
  readonly receipts?: Readonly<Record<string, string>>
  /** What Workcell collected from each attempt's world (`workcell --receipt R collect`), by attempt ref: its reading or its refusal. */
  readonly collected?: Readonly<Record<string, {readonly value?: unknown; readonly error?: string}>>
  /** Collect one attempt's world (workcell_read {collect} on its receipt). Absent: no carrier stands. */
  readonly collect?: (attemptRef: string, receipt: string) => Promise<unknown>
  /** Why no attempt's world receipt is named, in words (Workcell's refusal, nothing listed, no attempt naming a world), where the chain knows. */
  readonly outputsWhy?: string
}

/** Outputs (lanes W10, W12; software-factory__attempt-review.tsx `collected`, `collect`): `workcell --receipt R collect` on the receipt of
 * the world the attempt ran in — the receipt `workcell worlds` lists whose world_ref is the attempt's materialWorldRef (workcellMaterial.ts
 * collectedOf). Where none is named, the outputs stand absent and Collect disabled, saying why. */
export const RUNS_OUTPUTS = {
  collected: `What Workcell collected from each attempt's world: no reading reaches it yet — missing op: ${NO_RUN} (Workcell).`,
  collect: `Collect: no owner operation carries it yet — missing op: ${NO_RUN} (Workcell).`,
  noCarrier: 'Collect: the kernel carrier is unavailable here, so Workcell cannot be asked (`workcell collect`).',
} as const

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
    const journey = takes.journey?.status === 'answered' && takes.journey.value ? journeyOf(takes.journey.value) : null
    if (journey) values.journey = JSON.stringify(journey)
    const collected = Object.entries(takes.collected ?? {}).flatMap(([attempt, read]) => {
      const row = read.value !== undefined ? collectedOf(attempt, read.value) : null
      return row ? [row] : []
    })
    if (takes.receipts && Object.keys(takes.receipts).length) values.collected = JSON.stringify(collected)
  }
  return values
}

/** Why Runs' attempts and Stands cannot stand now, by key; empty when the takes are read. */
function runsStanding(session: string | null, takes?: RunsTakes): Record<string, Standing> {
  const held = takes?.journey
  const drawn = !!session && !!takes?.takes && held?.status === 'answered' && !!held.value && journeyOf(held.value) !== null
  const journey: Record<string, Standing> = drawn ? {} : {journey: {disabled: !session || !takes?.takes || !held ? RUNS_JOURNEY_UNREAD
    : held.status === 'refused' ? held.error ?? RUNS_JOURNEY_READING : held.status === 'reading' ? RUNS_JOURNEY_READING : RUNS_JOURNEY_NONE}}
  const receipts = takes?.receipts && Object.keys(takes.receipts).length ? takes.receipts : null
  const outputs: Record<string, Standing> = !receipts ? {collected: {disabled: takes?.outputsWhy ? `What Workcell collected from each attempt's world: ${takes.outputsWhy}` : RUNS_OUTPUTS.collected},
    collect: {disabled: takes?.outputsWhy ? `Collect: ${takes.outputsWhy}` : RUNS_OUTPUTS.collect}}
    : !takes?.collect ? {collect: {disabled: RUNS_OUTPUTS.noCarrier}} : {}
  if (!takes) return {...journey, ...outputs, stands: {disabled: RUNS_REFUSE.stands}}
  if (!session) return {...journey, ...outputs, stands: {disabled: 'Stands: no session is selected; an attempt stands on its session\'s Run.'}}
  if (!takes.takes) return {...journey, ...outputs, stands: {disabled: `Stands: ${RUNS_UNREAD.noneServed}`}}
  return {...journey, ...outputs}
}

export function runsBinding(session: string | null, holds: ChainHolds, takes?: RunsTakes): DesignBinding {
  const standing = runsStanding(session, takes)
  return {
    id: RUNS_ID,
    values: runsValues(session, holds, takes),
    standing,
    local: Object.fromEntries(RUNS_LOCAL.map(key => [key, (value: Value | undefined) => holdView(RUNS_ID, key, value)])),
    writes: key => key === 'stands' || key === 'collect',
    write: async changes => {
      for (const {key, value} of changes) {
        if (key === 'collect') {
          // Collect: the attempt's world, on the receipt a reading named for it; Workcell's refusal is its own words.
          if (standing.collect?.disabled) throw Error(standing.collect.disabled)
          const receipt = typeof value === 'string' ? takes?.receipts?.[value] : undefined
          if (!receipt) throw Error(`Collect: no world receipt is named for ${String(value)}.`)
          await takes!.collect!(value as string, receipt)
          continue
        }
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
