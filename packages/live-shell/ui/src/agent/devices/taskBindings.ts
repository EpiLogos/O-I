// Tasks (DLW §19.1, software-factory:tasks) and Runs (§19.11, software-factory:attempt-review) on their owners (lane BF2).
//
// Tasks are the clips on a session's track: the run model's tasks of the selected session (agent/agentRunModel.ts TaskClip — n,
// title, state running · queued · stalled · done, start and last activity — built by AgentSessionsProvider from agency_read, the
// session's task record and temporal_events_read), the session list the Thread offers (threadBinding.ts sessionRowsOf), and the
// task THE selection names (`<track>#task/<n>`, timeline/factoryTrackAdapter.ts parseFactoryTaskRef). Launch quantize is the
// transport's Quantize — the Agent's interrupt timing (one binding feeds both). A new task goes the Agent's own way (its declared
// new-task row, act:aikit.gateway.agent: AIKit's `new`, whose words it does not carry). Launch, Retry and Stop after are Software Factory's
// own Actions on the session's track in Factory's Set (kernel mode_set.rs, O-I ticket 1006): a written task runs from its clip
// (factory.task.run), a running one stops from its track's Stop (factory.task.stop), a stalled one runs again from its track's retry
// (factory.attempt.retry), each pressed where the task stands — the Session grid, and the Agent rack on its chain
// (agent/factoryTaskActs.ts sessionSetAct). The Tasks device's own ports for them are retired (O-I 804 round 24, ticket 1006). The per-task
// settings (Mode, Then, Effort, Autonomy, Register, Form here; every setting of the Clip view through TASK_SEAMS) are the
// session's settings on their owner, AIKit's `encounter-session-settings` (kernel encounter_session_settings, agent/sessionSettings.ts),
// written against the revision that stands. The task's log is not read: the temporal stream names the session, not the task's
// tools along its time.
//
// Runs lists a piece of work's attempts. The agency reading names no Factory run for a session, but the take lanes do (T-COVERAGE §1.3):
// AIKit's `encounter_task_attempts_list` says which Factory attempts the session's bound task serves, each with its Run and Factory state,
// and Factory's `factory_attempt_read` says what each is (owners/attemptTakes.ts readAttemptTakes, agent/factoryTakes.ts FactoryTake).
// Runs reads those takes: the session's Runs are its works, the selected Run's attempts its attempts, and the one whose Return Central
// received the one that stands. Stands writes through the take lanes' own act: Factory's factory.attempt.choose by `act` (attemptTakes.ts
// chooseAttempt), which proposes the attempt's Return to Central's receiving field, into its Run's Flow. Without the takes
// handed in, the attempts are absent and Stands stands disabled, saying so. Its view settings are the shell's. Pure, apart from the
// view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {AgentSessionTrack} from '../agentRunModel'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {sessionRowsOf} from './threadBinding'
import type {EncounterSessionSettingsReading, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {takeNames, takeWords, type FactoryTake, type TakeState} from '../factoryTakes'
import {journeyOf, type RunJourneyRead} from './runJourney'
import {NO_RUN, collectedOf, type ListedWorld} from './workcellMaterial'
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

// A task's lifecycle is Software Factory's (Factory README: an attempt Action owns start, retry, cancel and Return, and a retry is a new
// attempt record), and Factory's Set lays each of its acts where the task stands (kernel mode_set.rs, O-I ticket 1006): a task written on a
// session runs from its clip (factory.task.run), a running one stops from its track's Stop (factory.task.stop: paused, pressed again its
// attempt cancelled), a stalled one runs again from its track's retry (factory.attempt.retry, a new attempt under the retry grant its failed
// one consumed). The Session grid presses them there, and the Agent rack on its chain's session (agent/factoryTaskActs.ts sessionSetAct).
// aikit.gateway.agent addresses the whole bound harness, never one task.
// REPLACED (BD r24, O-I 804): "Launch: no carrier to AIKit's realisation and Factory's attempt-launch stands here". No screen has drawn the
// Tasks device since ticket 725, so its launch port (TasksPorts.launch) was never pressed: it is retired, and Launch names where a task is
// launched. REPLACED (O-I ticket 1006): "Retry: no carrier to Factory's attempt-task-units and attempt-retry stands here" and its Stop after
// beside it: Retry and Stop after are the task's track's, as Launch is its clip's, and their ports here are retired with Launch's.
export const TASKS_REFUSE: Readonly<Record<string, string>> = {
  launch: 'Launch: a task launches where it stands: its clip\'s ▶ in the Session grid, or the Agent rack\'s Launch on its chain, each Software Factory\'s factory.task.run. The Tasks device starts none.',
  retry: 'Retry: a stalled task runs again from its track\'s retry in the Session grid, or the Agent rack\'s Retry on its chain, each Software Factory\'s factory.attempt.retry. The Tasks device retries none.',
  stopAfter: 'Stop after: a running task stops from its track\'s Stop in the Session grid, or the Agent rack\'s Stop after on its chain, each Software Factory\'s factory.task.stop. The Tasks device stops none.',
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
          await context.holdFirst?.(settingSubject(input.session.sessionRef, key))
          await writeSessionSettings(context.transport, context.project, input.session.sessionRef, made.change)
          continue
        }
        throw Error(TASKS_REFUSE[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- Runs

/** The Journey the work belongs to (lane W8; the Run map's Journey, software-factory__run-map.tsx `journey`): read by runJourney.ts
 * through factory_development_read — the shown Run's reading names its Journey, the Journey's reading its purpose, status and Runs — for
 * the Run the take lanes name (its state path and ref). Why it is not drawn, when it is not. */
export const RUNS_JOURNEY_UNREAD = 'The Journey the work belongs to: no Run is shown — the take lanes name a Run (its state and ref) only for a selected session\'s attempts, and factory_development_read `run` and `journey` read it from there.'
export const RUNS_JOURNEY_READING = 'The Journey the work belongs to: Factory has not answered yet (factory_development_read `run`, then `journey`).'
export const RUNS_JOURNEY_NONE = 'The Journey the work belongs to: Factory names none for this Run (its reading\'s owningJourneyRefs is empty).'

export const RUNS_REFUSE = {
  /** No takes handed in: the chain has not given Runs the take lanes' reading of the session. */
  stands: 'Stands: Runs is not handed the session\'s takes here (the take lanes\' reading, owners/attemptTakes.ts useAttemptTakes), so no attempt is chosen from it; Factory\'s factory.attempt.choose is the write.',
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
 * names nothing for it) and their act: choosing the attempt that stands (`choose`, Factory's factory.attempt.choose), which answers {ok, note}
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

/** Outputs (lanes W10, W12; the Results tile's outputs, §19.1 On the rail: `collected`, `collect`): `workcell --receipt R collect` on the receipt of
 * the world the attempt ran in — the receipt `workcell worlds` lists whose world_ref is the attempt's materialWorldRef (workcellMaterial.ts
 * collectedOf). Where none is named, the outputs stand absent and Collect disabled, saying why. */
export const RUNS_OUTPUTS = {
  collected: `What Workcell collected from each attempt's world: no reading reaches it yet — missing op: ${NO_RUN} (Workcell).`,
  collect: `Collect: no owner operation carries it yet — missing op: ${NO_RUN} (Workcell).`,
  noCarrier: 'Collect: the kernel carrier is unavailable here, so Workcell cannot be asked (`workcell collect`).',
} as const

/** An attempt's standing in the words the retired attempt review used (queued, running, done, failed), from Factory's (factoryTakes.ts TakeState). */
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
        // Factory's own Action (factory.attempt.choose): the attempt's Return proposed to Central's receiving field, answered in its words.
        const answer = await takes!.choose(take) as {ok?: unknown; error?: unknown} | undefined
        if (answer && answer.ok === false) throw Error(typeof answer.error === 'string' ? answer.error : 'Factory did not receive the attempt.')
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- Results

/** The Results tile (DLW §19.1 On the rail; O-I 745, carried from 772; BD round 25): "The takes of the selected run: each result with
 * its author and its diff. Open a diff to read it. Press Accept to send a result to review in Approvals. Beside them, the outputs Workcell
 * collected from the world the run stood in, each with where it lies, and what it left out; Collect gathers them again." Its settings are
 * the tile's own: Run (a run, the selected one by default: the newest take's) and Show. */
export const RESULTS_SHOW = ['results', 'diffs', 'both'] as const
export type ResultsShow = typeof RESULTS_SHOW[number]
export const RESULTS_SHOW_WORDS: Readonly<Record<ResultsShow, string>> = {results: 'Results', diffs: 'Diffs', both: 'Both'}
/** Factory's Return names no diff of its own, so the tile's diffs stand absent in these words. */
export const RESULTS_DIFFS_ABSENT = 'Diffs: a take\'s Return names no diff of its own — Factory\'s readable Return (attempt_runtime.rs ReadableReturn) '
  + 'carries its summary and its artifact and evidence refs, and no reading here turns one into a diff. What changed in a seat is Files\' Diff page.'
export const RESULTS_UNREAD = {
  session: 'Results: no session is selected, so no run is chosen. Select a session\'s track: its newest take\'s run shows here.',
  carrier: 'Results: the kernel carrier is unavailable here, so no session\'s takes are read (AIKit encounter_task_attempts_list, then factory_attempt_read).',
  reading: 'Results: AIKit has not answered which attempts the session\'s task serves, or answered for it with none (encounter_task_attempts_list).',
  none: `Results: ${RUNS_UNREAD.noneServed}`,
} as const

/** One take of the chosen run as the tile lists it: its name on its lane, its author (the session's agent), Factory's words for its state,
 * its Return's summary, whether it stands (Central received it), and whether Accept can send it to review, or why not. */
export interface ResultRow {
  readonly attempt: string
  readonly name: string
  readonly author: string
  readonly state: string
  readonly summary: string | null
  readonly stands: boolean
  readonly accept: {readonly ok: true} | {readonly ok: false; readonly why: string}
}
/** What Workcell collected from one take's world (workcellMaterial.ts collectedOf), the receipt Collect asks it on, or why there is none. */
export interface ResultOutputs {
  readonly attempt: string
  readonly receipt: string | null
  readonly collected: Record<string, unknown> | null
  readonly why: string | null
}
export interface ResultsReading {
  /** Why no run is listed, in words; null when the takes are read. */
  readonly why: string | null
  readonly runs: readonly {readonly ref: string; readonly name: string}[]
  readonly run: string | null
  readonly results: readonly ResultRow[]
  readonly diffs: string
  readonly outputs: readonly ResultOutputs[]
}
export interface ResultsInput {
  readonly session: Pick<AgentSessionTrack, 'sessionRef' | 'agentName'> | null
  /** The session's takes (owners/attemptTakes.ts useAttemptTakes `of`): undefined where no carrier reads them, null while AIKit has not answered. */
  readonly takes: readonly FactoryTake[] | null | undefined
  /** The run the tile's Run names; absent, or one the takes do not name, the newest take's. */
  readonly run?: string | null
  /** `workcell worlds`'s receipts (workcellMaterial.ts worldsOf); null while unread or refused, with `worldsWhy`. */
  readonly worlds?: readonly Pick<ListedWorld, 'receipt' | 'worldRef'>[] | null
  readonly worldsWhy?: string | null
  /** What Workcell collected from each take's world, by attempt ref: its reading or its refusal. */
  readonly collected?: Readonly<Record<string, {readonly value?: unknown; readonly error?: string}>>
}

/** Accept on a take: Factory's factory.attempt.choose proposes a returned take's Return to Central's receiving field, where Approvals lists it. */
function acceptOf(take: FactoryTake): ResultRow['accept'] {
  switch (take.state) {
    case 'returned': return take.receivingRef ? {ok: false, why: `Accept: Central received it already (${take.receivingRef}), so it waits in Approvals.`} : {ok: true}
    case 'running': return {ok: false, why: 'Accept: the take is still running, so it has no Return to send.'}
    case 'failed': return {ok: false, why: 'Accept: the take failed, so it has no Return to send.'}
    case 'prepared': return {ok: false, why: 'Accept: the take is prepared and not yet dispatched, so it has no Return to send.'}
  }
}

/** The Results tile's reading of the selected session's takes. Pure. */
export function resultsOf(input: ResultsInput): ResultsReading {
  const empty = (why: string): ResultsReading => ({why, runs: [], run: null, results: [], diffs: RESULTS_DIFFS_ABSENT, outputs: []})
  if (!input.session) return empty(RESULTS_UNREAD.session)
  if (input.takes === undefined) return empty(RESULTS_UNREAD.carrier)
  if (input.takes === null) return empty(RESULTS_UNREAD.reading)
  const takes = input.takes
  if (!takes.length) return empty(RESULTS_UNREAD.none)
  const runs: {ref: string; name: string}[] = []
  for (const one of takes) if (!runs.some(run => run.ref === one.runRef)) runs.push({ref: one.runRef, name: one.unit ? `${one.unit} · ${one.runRef}` : one.runRef})
  const newest = takes.reduce((best, one) => ((one.startUnixMs ?? 0) >= (best.startUnixMs ?? 0) ? one : best))
  const run = input.run && runs.some(row => row.ref === input.run) ? input.run : newest.runRef
  const mine = takes.filter(one => one.runRef === run)
  const names = takeNames(mine)
  const author = input.session.agentName ?? input.session.sessionRef
  const results = mine.map((one): ResultRow => ({attempt: one.attemptRef, name: names.get(one.attemptRef) ?? one.attemptRef, author, state: takeWords(one),
    summary: one.summary, stands: !!one.receivingRef, accept: acceptOf(one)}))
  const outputs = mine.map((one): ResultOutputs => {
    if (!one.materialWorldRef) return {attempt: one.attemptRef, receipt: null, collected: null, why: 'Factory names no world this take ran in, so Workcell has nothing to collect.'}
    if (!input.worlds) return {attempt: one.attemptRef, receipt: null, collected: null, why: input.worldsWhy ?? 'Workcell\'s receipts of its worlds are not read here (`workcell worlds`).'}
    const listed = input.worlds.find(world => world.worldRef === one.materialWorldRef)
    if (!listed) return {attempt: one.attemptRef, receipt: null, collected: null, why: `Workcell lists no receipt of ${one.materialWorldRef}, the world this take ran in (\`workcell worlds\`).`}
    const read = input.collected?.[one.attemptRef]
    const collected = read?.value !== undefined ? collectedOf(one.attemptRef, read.value) : null
    return {attempt: one.attemptRef, receipt: listed.receipt, collected, why: read?.error ?? null}
  })
  return {why: null, runs, run, results, diffs: RESULTS_DIFFS_ABSENT, outputs}
}
