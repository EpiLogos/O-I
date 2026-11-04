// One agent session's settings on their owner (AIKit `encounter-session-settings`, kernel `encounter_session_settings`): the track's
// Telemetry and Solo, Scope's Wait and On no answer (§19.12), and its bound task's name, colour, activator, output style, Loop, Launch mode, Then, Quantize, what a Repeat varies
// and envelopes (manual §19.1 Clip view, the Clip and Launch panels and the Envelopes: the Agent's Effort and Scope's Tool calls; the
// Agent's Autonomy is retired, §19.4, §19.12). The owner keeps them under a revision with their
// history and states every default, in the manual's words (ai-kit encounter_task_settings.rs: Launch mode trigger · gate · toggle ·
// repeat, Then next · again · stop, Loop's stop condition done · pass, Repeat's variable and stop when); this module puts its reading on
// the keys of the designed clip `clip:factory` and a control's change on the owner's request, each word as it is — the owner judges
// it — and writes it against the revision that stands. Pure, apart from `writeSessionSettings`, the acts built on it and `useScopeWaits`.
import {useMemo} from 'react'
import type {Value, Values} from '../frame/devices/designed'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {ActuationComparisonRunRequest, ActuationComparisonTakes, EncounterEnvelopePoint, EncounterSessionSettingsReading,
  EncounterSessionSettingsRequest, EncounterTakeRun, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {settingsReadingEntry, useSettingsAnswer} from '../owners/readers'
import type {ScopeWaits} from './devices/designBindings'
import {routeAnswerOf} from './devices/ownerRoutes'
import type {TaskSetting} from './devices/taskBindings'

export const SETTINGS_RESULT = 'encounter_session_settings_reading'

/** Why a task's settings cannot be changed where they are drawn, in words. */
export const SETTINGS_WHY = {
  notHere: 'The session\'s settings are not read here.',
  reading: 'The session\'s settings are being read.',
  noTask: 'No task is bound to this session: its owner keeps no settings for a task it does not hold.',
  oneTask: 'The session\'s owner holds one bound task: its settings are the first task\'s on the track.',
} as const

/** Why the settings of a session's task `n` cannot be changed with this context, or null when they can. */
export function settingsRefusal(context: {readonly settings: EncounterSessionSettingsReading | null; readonly refused?: string | null} | null | undefined,
  n: number | null): string | null {
  if (!context) return SETTINGS_WHY.notHere
  if (!context.settings) return context.refused ? `The session's settings are unread — the owner refused: ${context.refused}` : SETTINGS_WHY.reading
  if (!context.settings.task) return SETTINGS_WHY.noTask
  if (n !== null && n !== 1) return SETTINGS_WHY.oneTask
  return null
}

/** The envelope editor's rows (clips/factory.tsx EFFORT, TOOL_CALLS): Automation draws the level at a row; Modulation draws the five
 * steps −2…+2 on the same rows. Tool calls (§19.1 Envelopes, §19.12 Asks) is the answer to the harness's request to use a tool: Inherit
 * takes the session's Scope; the owner moves no Tool calls under Modulation (it reads no session value of it) and says so. */
export const EFFORT_LEVELS = ['inherit', 'low', 'medium', 'high', 'max'] as const
export const TOOL_CALLS_LEVELS = ['inherit', 'ask', 'session', 'always'] as const
const MODULATION_ROWS = 5

/** The design's Quantize words to the owner's. */
const QUANTIZE_TO_OWNER: Readonly<Record<string, string>> = {global: 'global', now: 'now', 'next tool': 'next-tool', 'next turn': 'next-turn'}
const QUANTIZE_TO_DESIGN: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(QUANTIZE_TO_OWNER).map(([d, o]) => [o, d]))

/** Hand off to is retired with Then's handoff on the owner (manual §19.1 The Launch panel: "To hand the work to another session, drag the
 * task onto that session's track"). */
export const HANDOFF_RETIRED = 'Hand off to: retired with Then\'s handoff on the session\'s settings (AIKit encounter-session-settings) — to hand the work to another session, drag the task onto that session\'s track.'

type Envelope = 'effort' | 'tool_calls'
const levelsOf = (envelope: Envelope): readonly string[] => envelope === 'effort' ? EFFORT_LEVELS : TOOL_CALLS_LEVELS

/** The owner's points to the editor's: [second, row]. A point the rows cannot hold is left out, never moved. */
export function rowsOfPoints(points: readonly EncounterEnvelopePoint[], envelope: Envelope, modulation: boolean): [number, number][] {
  const levels = levelsOf(envelope)
  const rows: [number, number][] = []
  for (const [at, value] of points) {
    const row = modulation ? (typeof value === 'number' ? value + 2 : -1) : typeof value === 'string' ? levels.indexOf(value) : -1
    if (row >= 0 && row < (modulation ? MODULATION_ROWS : levels.length)) rows.push([at, row])
  }
  return rows
}

/** The editor's points to the owner's, under a mode: a row past the control's levels takes its highest. */
export function pointsOfRows(rows: readonly (readonly [number, number])[], envelope: Envelope, modulation: boolean): EncounterEnvelopePoint[] {
  const levels = levelsOf(envelope)
  return rows.map(([at, row]) => {
    const index = Math.max(0, Math.min(Math.round(row), (modulation ? MODULATION_ROWS : levels.length) - 1))
    return [at, modulation ? index - 2 : levels[index]!] as EncounterEnvelopePoint
  })
}

const parseRows = (value: Value): [number, number][] | null => {
  try {
    const rows = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(rows) && rows.every(row => Array.isArray(row) && row.length === 2 && row.every(Number.isFinite)) ? rows as [number, number][] : null
  } catch { return null }
}

/** The owner's reading on the design's keys. Name and colour as the owner states them (a null colour takes the session's); Loop, Launch
 * mode, Then and what a Repeat varies in the owner's words, which are the design's: a null cap and levels not yet chosen stand absent, and
 * the levels read as the design writes them, comma-separated. */
export function clipValuesOfSettings(reading: EncounterSessionSettingsReading | null): Values {
  const task = reading?.task
  if (!task) return {}
  const modulation = task.envelope_mode === 'modulation'
  const values: Record<string, Value> = {
    name: task.name, active: task.active, 'style.register': task.register, 'style.form': task.form,
    quantize: QUANTIZE_TO_DESIGN[task.quantize] ?? task.quantize, 'env.mode': task.envelope_mode, 'env.linked': task.envelope_linked,
    'env.agent.effort': JSON.stringify(rowsOfPoints(task.effort, 'effort', modulation)),
    'env.scope.toolCalls': JSON.stringify(rowsOfPoints(task.tool_calls ?? [], 'tool_calls', modulation)),
  }
  if (task.colour) values.colour = task.colour
  const own = (key: string, value: Value | null | undefined) => { if (value !== null && value !== undefined) values[key] = value }
  own('loop', task.loop); own('loop.until', task.loop_until); own('loop.cap', task.loop_cap)
  own('launch', task.launch); own('then', task.then)
  own('repeat.variable', task.repeat_variable); own('repeat.repeats', task.repeat_repeats); own('repeat.stop', task.repeat_stop)
  if (task.repeat_levels?.length) values['repeat.levels'] = task.repeat_levels.join(', ')
  // The takes a Repeat's set made, once it ends (O-I 795).
  own('takes', task.takes?.ended?.takes)
  // The Success conditions typed for the task (§19.1 The Intent panel), each without an answer until a run returns one; absent from an
  // AIKit that keeps none.
  if (Array.isArray(task.success)) values.criteria = JSON.stringify(task.success.map((text, i) => ({id: `c${i}`, text})))
  // What AIKit's executor did with Loop's last pass of a song (O-I #844, task.loop_pass): the take Factory started and its Run, or why
  // the loop stopped; nothing before a song's first pass, or from an AIKit before loop_pass.
  own('loop.pass', loopPassWords(task as {loop_pass?: unknown; loop_song?: unknown}))
  // What the owner kept in retired words and left out, in its words (AIKit `retired`), and what Tool calls did at its last answer.
  own('env.retired', retiredWords(task.retired))
  own('env.toolCalls.play', toolCallsPlayWords(task.tool_calls_play))
  return values
}

/** The settings the owner kept in retired words, said once: which were left out, and the owner's words for what took their place. */
function retiredWords(retired: NonNullable<EncounterSessionSettingsReading['task']>['retired']): string | null {
  if (!Array.isArray(retired) || !retired.length) return null
  const fields = retired.map(row => row.field === 'repeat_variable' ? 'Repeat over Autonomy' : row.field === 'autonomy' ? 'Autonomy envelope' : row.field)
  const words = [...new Set(retired.map(row => row.words).filter(Boolean))]
  return `Your ${fields.join(' and ')} ${fields.length > 1 ? 'were' : 'was'} left out: ${words.join(' ')}.`
}

/** What Tool calls did at its last answer to the harness (AIKit's `{answered, option_id}` or `{waiting, reason}`), in words. Pure. */
function toolCallsPlayWords(play: unknown): string | null {
  if (!play || typeof play !== 'object') return null
  const said = play as {answered?: unknown; option_id?: unknown; waiting?: unknown; reason?: unknown; tool_calls?: unknown}
  if (typeof said.answered === 'string' && typeof said.option_id === 'string')
    return `Tool calls (${String(said.tool_calls ?? '')}) answered the harness's last request with its own ${said.option_id}.`
  if (typeof said.waiting === 'string' && typeof said.reason === 'string') return `A tool's request waits for you: ${said.reason}`
  return null
}

/** Loop's last pass of a song in words (AIKit's `{take, run_ref}` or `{refused}`), or null where AIKit names none. Pure. */
function loopPassWords(task: {loop_pass?: unknown; loop_song?: unknown}): string | null {
  const pass = task.loop_pass && typeof task.loop_pass === 'object' ? task.loop_pass as {take?: unknown; run_ref?: unknown; refused?: unknown} : null
  if (!pass) return null
  if (typeof pass.refused === 'string' && pass.refused) return `The loop stopped: ${pass.refused}`
  if (typeof pass.take !== 'number' || typeof pass.run_ref !== 'string') return null
  const song = task.loop_song && typeof task.loop_song === 'object' ? (task.loop_song as {unit?: unknown}).unit : null
  return `Take ${pass.take}${typeof song === 'string' && song ? ` of ${song}` : ''} · Run ${pass.run_ref}`
}

/** A control's change as the owner's request, against the reading it was made on; or why the owner cannot take it. */
export function taskSettingChange(setting: TaskSetting, value: Value, reading: EncounterSessionSettingsReading | null):
  {change: EncounterSessionSettingsRequest} | {refused: string} {
  const task = reading?.task
  if (!reading) return {refused: SETTINGS_WHY.reading}
  if (!task) return {refused: SETTINGS_WHY.noTask}
  const set = (fields: Record<string, unknown>) => ({change: {task: {task_ref: task.task_ref, set: fields}}})
  const text = (x: Value) => typeof x === 'string' && x.trim() ? x.trim() : null
  // A number as the control gives it, cleared as none; what is not a number goes as written, for the owner to refuse in its words
  // (JSON would carry NaN as null, which clears the field).
  const count = (x: Value): unknown => {
    if (typeof x === 'number') return Number.isFinite(x) ? x : String(x)
    const written = text(x)
    return written === null ? null : Number.isFinite(Number(written)) ? Number(written) : written
  }
  switch (setting) {
    case 'name': return set({name: text(value)})
    case 'colour': return set({colour: text(value)})
    case 'active': return typeof value === 'boolean' ? set({active: value}) : {refused: 'The clip activator is on or off.'}
    case 'register': return set({register: text(value)})
    case 'form': return set({form: text(value)})
    case 'loop': return typeof value === 'boolean' ? set({loop: value}) : {refused: 'Loop is on or off.'}
    case 'loopUntil': return set({loop_until: text(value)})
    case 'loopCap': return set({loop_cap: count(value)})
    // The owner's words are the design's: each goes as the control says it, and the owner refuses a word it does not take, in its words.
    case 'launch': return set({launch: text(value)})
    case 'then': return set({then: text(value)})
    case 'repeatVariable': return set({repeat_variable: text(value)})
    case 'repeatLevels': {
      // The design writes the levels as text, comma-separated; the owner keeps them as a list and refuses more than three.
      const levels = typeof value === 'string' ? value.split(',').map(level => level.trim()).filter(Boolean) : []
      return set({repeat_levels: levels.length ? levels : null})
    }
    case 'repeatRepeats': return set({repeat_repeats: count(value)})
    case 'repeatStop': return set({repeat_stop: text(value)})
    // Add: one condition more, after those that stand (§19.1 The Intent panel: "A new success condition. Press Enter to add it").
    case 'success': {
      const written = text(value)
      if (written === null) return {refused: 'A success condition is its own words: type one, then press Enter.'}
      return set({success: [...(task.success ?? []), written]})
    }
    case 'quantize': {
      const word = text(value)
      return set({quantize: word === null ? null : QUANTIZE_TO_OWNER[word] ?? word})
    }
    case 'envelopeLink': return typeof value === 'boolean' ? set({envelope_linked: value}) : {refused: 'The envelope link is on or off.'}
    case 'envelopeMode': {
      const mode = text(value)
      if (mode !== 'automation' && mode !== 'modulation') return {refused: 'The envelope mode is Automation or Modulation.'}
      // The owner takes the points with the mode: each point keeps its row, read as the new mode reads it.
      const from = task.envelope_mode === 'modulation', to = mode === 'modulation'
      const carried = (envelope: Envelope) => pointsOfRows(rowsOfPoints(task[envelope] ?? [], envelope, from), envelope, to)
      return set({envelope_mode: mode, effort: carried('effort'), tool_calls: carried('tool_calls')})
    }
    case 'effort':
    case 'toolCalls': {
      const envelope: Envelope = setting === 'effort' ? 'effort' : 'tool_calls'
      const rows = parseRows(value)
      if (!rows) return {refused: `The ${setting === 'effort' ? 'Effort' : 'Tool calls'} envelope is a list of [second, step] points.`}
      return set({[envelope]: pointsOfRows(rows, envelope, task.envelope_mode === 'modulation')})
    }
  }
}

/** A track's Telemetry as the owner's request. Solo is what you attend to, the shell's on the book (§16.1, §16.6): AIKit's own session
 * Solo, a gate on its executor's launches, is never written from here. */
export const trackSettingChange = (setting: 'telemetry', on: boolean): EncounterSessionSettingsRequest => ({track: {[setting]: on}})

/** Write one change to a session's settings against the revision its standing reading holds, then read them again. The owner's
 * refusal (a stale revision, another task, a word outside the manual's) is thrown in its words. */
export async function writeSessionSettings(transport: KernelTransportStatus, project: string, agentSession: string,
  change: EncounterSessionSettingsRequest): Promise<EncounterSessionSettingsReading> {
  const entry = settingsReadingEntry(transport, project, agentSession)
  const standing = entry.snapshot()
  const epoch = standing.epoch ?? ''
  if (standing.status !== 'answered' || !standing.value) throw new Error('The session\'s settings are not read yet; read them before changing them.')
  const revision = (standing.value as EncounterSessionSettingsReading).revision
  const result = await kernelOp(transport, {op: 'encounter_session_settings', project, agent_session: agentSession, request: change,
    ...(revision ? {expected_revision: revision} : {})})
  if (result.error || result.outcome?.result !== SETTINGS_RESULT) {
    void entry.refresh(epoch)
    throw new Error(result.error ?? 'AIKit did not return the session\'s settings')
  }
  // Every reader of these settings holds this one entry: the re-read reaches them all.
  await entry.refresh(epoch)
  return result.outcome.data
}

/** Scope's Wait and On no answer on one session (§19.12 Asks): AIKit's own track settings of it, from the one settings reading every reader
 * of it holds, written against its revision, with the reading itself (`settings`, for Approvals). `why` stands where the Scope is on no one
 * session (a group's: each session keeps its own). */
export function useScopeWaits(transport: KernelTransportStatus, session: string | null, project: string, why?: string):
  ScopeWaits & {readonly settings: EncounterSessionSettingsReading | null} {
  const answer = useSettingsAnswer(transport, why ? null : session, project).reading
  return useMemo(() => {
    if (why) return {track: null, why, settings: null}
    if (!session) return {track: null, why: 'no session stands on this chain, so no settings of one are read.', settings: null}
    const write = transport.kind === 'unavailable' ? undefined
      : (change: {wait?: number; no_answer?: 'hold' | 'deny'}) => writeSessionSettings(transport, project, session, {track: change})
    const settings = answer.status === 'answered' ? answer.value as EncounterSessionSettingsReading | null : null
    const refused = answer.status === 'refused' ? `AIKit did not read the session's settings: ${answer.error ?? 'it refused'}` : undefined
    return {track: settings?.track ?? null, settings, ...(refused ? {why: refused} : {}), ...(write ? {write} : {})}
  }, [transport, session, project, why, answer])
}

// ---------------------------------------------------------------------------------------------------------------- Repeat's takes

/** The run every take of a Repeat shares, in Actuation's own words (research comparison.rs run_with, application.rs run): `run` names the
 * session's own task as Actuation's provided task (`task`: its id, prompt, success conditions and the test a Test pass reads), the
 * session's agent as the body (`body`, protocol agent-jsonl: the agent's process, which applies the level each take is given and reads
 * it back), and its steps and calls; `basis` the revisions the takes are held to. Its carrier is AIKit's, which owns the session's task
 * and its agent: the session's settings hand it (`task.take_run`, takeRunOf). */
export interface ResearchRun {
  readonly run: Record<string, unknown>
  readonly basis?: Record<string, unknown>
}

/** The run AIKit hands with a session's settings for its takes (`task.take_run`): the run, AIKit's words for why there is none, or null
 * from an AIKit before O-I 795's take body. Pure. */
export function takeRunOf(task: EncounterSessionSettingsReading['task'] | null | undefined): ResearchRun | {refused: string} | null {
  const handed: EncounterTakeRun | undefined = task?.take_run
  if (!handed) return null
  if ('refused' in handed) return {refused: handed.refused}
  return {run: handed.run, ...(handed.basis ? {basis: handed.basis} : {})}
}

/** Why a Repeat makes no takes, in words. */
export const TAKES_WHY = {
  notRepeat: 'This task is not launched with Repeat: set Launch mode to Repeat first.',
  levels: (variable: string) => `Repeat's levels are not set: name one to three values of ${variable} for the takes to run over. `
    + 'The default of three is a count; only the condition has values of its own.',
  noRun: 'Actuation runs a comparison over a session\'s own task with its agent as the body, but this AIKit hands the shell no run for '
    + 'the session\'s takes — missing op: `take_run` on the session\'s task settings, the task as a provided task and its agent as an '
    + 'agent-jsonl body, `encounter-take-body` (AIKit).',
  refused: (words: string) => `AIKit has no run for this session's takes: ${words}`,
  noTest: 'Stop when Test pass reads the task\'s own test, and the run AIKit hands for this task carries none (AIKit keeps no test for '
    + 'a task): choose Task done, a Turn cap or a Time cap.',
} as const

/** The comparison request a Repeat's takes run with (§19.1 The Launch panel): Variable is what it varies, Levels the values it takes
 * (the condition with none chosen runs Actuation's own default three — "Levels: 1–3 values. Default: Three"; any other variable needs
 * its values), Repeats its repetitions, and Stop when the condition that ends each take. Or why Actuation cannot make them. Pure. */
export function comparisonRequestOf(task: NonNullable<EncounterSessionSettingsReading['task']>, traceRef: string,
  research: ResearchRun | {refused: string} | null): {request: ActuationComparisonRunRequest} | {refused: string} {
  if (task.launch !== 'repeat') return {refused: TAKES_WHY.notRepeat}
  const variable = task.repeat_variable
  if (variable !== 'condition' && !task.repeat_levels.length) return {refused: TAKES_WHY.levels(variable)}
  if (!research) return {refused: TAKES_WHY.noRun}
  if ('refused' in research) return {refused: TAKES_WHY.refused(research.refused)}
  // Actuation refuses Test pass for a provided task without its test (comparison.rs); said here, before AIKit starts a set.
  const runTask = research.run.task as {test?: unknown} | undefined
  if (task.repeat_stop === 'pass' && runTask && !runTask.test) return {refused: TAKES_WHY.noTest}
  return {request: {trace_ref: traceRef, repetitions: task.repeat_repeats, variable,
    ...(task.repeat_levels.length ? {levels: [...task.repeat_levels]} : {}), stop: {when: task.repeat_stop},
    run: research.run, ...(research.basis ? {basis: research.basis} : {})}}
}

type Receipt = {ok: true; note: string} | {ok: false; error: string}

/** A Repeat's takes (manual §19.1 The Launch panel: "Each run is a take … Once the first run starts, these do not change. A change starts
 * a new set of takes"): the set starts on AIKit (`encounter-session-settings` takes start, which freezes Repeat's fields and refuses a
 * second set while one runs), Actuation's comparison run makes the takes in a root the kernel reserves (kernel actuation_write
 * comparison-run), and the set ends on AIKit with what it made, or failed with Actuation's words. Refused, before any write, where the
 * task is not launched with Repeat or Actuation cannot make its takes (comparisonRequestOf). */
export async function makeTakes(transport: KernelTransportStatus, project: string, agentSession: string,
  research: ResearchRun | {refused: string} | null, now: () => number = Date.now): Promise<Receipt> {
  const standing = settingsReadingEntry(transport, project, agentSession).snapshot()
  const task = standing.status === 'answered' ? (standing.value as EncounterSessionSettingsReading | null)?.task ?? null : null
  if (!task) return {ok: false, error: SETTINGS_WHY.reading}
  const traceRef = `takes:${agentSession}:${now()}`
  const composed = comparisonRequestOf(task, traceRef, research)
  if ('refused' in composed) return {ok: false, error: composed.refused}
  const said = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
  const end = (fields: {outcome: 'made' | 'failed'; takes?: number; root?: string; reason?: string}) =>
    writeSessionSettings(transport, project, agentSession, {takes: {end: {task_ref: task.task_ref, trace_ref: traceRef, ...fields}}})
  try {
    await writeSessionSettings(transport, project, agentSession, {takes: {start: {task_ref: task.task_ref, trace_ref: traceRef}}})
  } catch (cause) { return {ok: false, error: `AIKit did not start the takes: ${said(cause)}`} }
  let made: ActuationComparisonTakes
  try {
    made = routeAnswerOf(await kernelOp(transport, {op: 'actuation_write', request: {kind: 'comparison-run', request: composed.request}}),
      '`actuation-research comparison.run`').data as ActuationComparisonTakes
  } catch (cause) {
    const reason = said(cause)
    try { await end({outcome: 'failed', reason: reason.slice(0, 1024)}) } catch (ending) {
      return {ok: false, error: `Actuation made no takes: ${reason}. AIKit did not end the set either: ${said(ending)}`}
    }
    return {ok: false, error: `Actuation made no takes: ${reason}`}
  }
  try { await end({outcome: 'made', takes: made.takes, root: made.root}) } catch (cause) {
    return {ok: false, error: `Actuation made ${made.takes} takes in ${made.root}, but AIKit did not end the set: ${said(cause)}`}
  }
  return {ok: true, note: `Actuation's comparison run made ${made.takes} takes of ${task.name} (${traceRef}), kept in ${made.root}; AIKit ended the set.`}
}

/** A refinement's Test as the session's own Repeat (manual §19.7 Refining a skill: "Test — the takes of a Repeat, Variable: Skillset"):
 * Variable Skillset, its two levels the set with the member's proposed revision in it (`set+member`, which the take body carries into
 * the take's World and reads back) beside the set as it stands. Or why not, in words. Pure. */
export function refinementRepeat(task: EncounterSessionSettingsReading['task'] | null | undefined, set: string, member: string):
  {change: EncounterSessionSettingsRequest} | {refused: string} {
  if (!task) return {refused: SETTINGS_WHY.noTask}
  return {change: {task: {task_ref: task.task_ref, set: {repeat_variable: 'skillset', repeat_levels: [`${set}+${member}`, set]}}}}
}

/** Run a refinement's Test: set the session's task's Repeat to the refinement's levels on AIKit, then make its takes through the same
 * runner as Launch (makeTakes); it is not a second runner. Refused in words where the session holds no task or the task is not launched
 * with Repeat (makeTakes). */
export async function testRefinement(transport: KernelTransportStatus, project: string, agentSession: string, set: string,
  member: string): Promise<Receipt> {
  const standing = settingsReadingEntry(transport, project, agentSession).snapshot()
  if (standing.status !== 'answered' || !standing.value) return {ok: false, error: SETTINGS_WHY.reading}
  const repeat = refinementRepeat((standing.value as EncounterSessionSettingsReading).task, set, member)
  if ('refused' in repeat) return {ok: false, error: repeat.refused}
  let reading: EncounterSessionSettingsReading
  try {
    reading = await writeSessionSettings(transport, project, agentSession, repeat.change)
  } catch (cause) { return {ok: false, error: `AIKit did not set Repeat to the refinement: ${cause instanceof Error ? cause.message : String(cause)}`} }
  return makeTakes(transport, project, agentSession, takeRunOf(reading.task))
}

// ---------------------------------------------------------------------------------------------------------------- the Tasks device

/** The level an Automation envelope stands at a second of the task: its last point at or before it, else its first; an empty
 * envelope inherits. Null under Modulation: a step off the session's value is not a level. */
export function levelAt(points: readonly EncounterEnvelopePoint[], seconds: number, modulation: boolean): string | null {
  if (modulation) return null
  if (!points.length) return 'inherit'
  let standing = points[0]![1]
  for (const [at, value] of points) if (at <= seconds) standing = value
  return typeof standing === 'string' ? standing : null
}

/** The keys of the Tasks device (software-factory__tasks.tsx) the owner's settings answer, at the task's elapsed seconds. */
export function tasksDeviceValues(reading: EncounterSessionSettingsReading | null, elapsedSeconds: number): Values {
  const task = reading?.task
  if (!task) return {}
  const modulation = task.envelope_mode === 'modulation'
  const values: Record<string, Value> = {mode: task.launch, then: task.then, register: task.register, form: task.form}
  const effort = levelAt(task.effort, elapsedSeconds, modulation), toolCalls = levelAt(task.tool_calls ?? [], elapsedSeconds, modulation)
  if (effort) values.effort = effort
  if (toolCalls) values.toolCalls = toolCalls
  return values
}

/** The Tasks device's keys the settings take. */
export const TASKS_DEVICE_SETTINGS = ['mode', 'then', 'to', 'effort', 'toolCalls', 'register', 'form'] as const
export type TasksDeviceSetting = typeof TASKS_DEVICE_SETTINGS[number]

/** A Tasks device control's change as the owner's request. Effort and Tool calls set one level for the whole task: an Automation
 * envelope of one point at its start (Inherit clears it), the other envelope carried into Automation with it. */
export function tasksDeviceChange(key: TasksDeviceSetting, value: Value, reading: EncounterSessionSettingsReading | null):
  {change: EncounterSessionSettingsRequest} | {refused: string} {
  switch (key) {
    // The owner's words are the manual's (trigger · gate · toggle · repeat; next · again · stop), so Mode and Then go to the owner as they are.
    case 'mode':
    case 'then': {
      const task = reading?.task
      if (!reading || !task) return taskSettingChange(key === 'mode' ? 'launch' : 'then', value, reading)
      return {change: {task: {task_ref: task.task_ref, set: {[key === 'mode' ? 'launch' : 'then']: typeof value === 'string' && value.trim() ? value.trim() : null}}}}
    }
    // Hand off to is retired: the work moves when the task is dragged onto another session's track.
    case 'to': return {refused: HANDOFF_RETIRED}
    case 'register': return taskSettingChange('register', value, reading)
    case 'form': return taskSettingChange('form', value, reading)
    case 'effort':
    case 'toolCalls': {
      const task = reading?.task
      if (!reading || !task) return taskSettingChange(key, value, reading)
      const envelope: Envelope = key === 'effort' ? 'effort' : 'tool_calls'
      const level = typeof value === 'string' ? value : ''
      if (!(levelsOf(envelope) as readonly string[]).includes(level)) return {refused: `${key === 'effort' ? 'Effort' : 'Tool calls'} takes one of ${levelsOf(envelope).join(', ')}.`}
      const other: Envelope = envelope === 'effort' ? 'tool_calls' : 'effort'
      const carried = pointsOfRows(rowsOfPoints(task[other] ?? [], other, task.envelope_mode === 'modulation'), other, false)
      return {change: {task: {task_ref: task.task_ref, set: {envelope_mode: 'automation', [envelope]: level === 'inherit' ? [] : [[0, level]], [other]: carried}}}}
    }
  }
}
