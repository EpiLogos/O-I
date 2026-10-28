// One agent session's settings on their owner (AIKit `encounter-session-settings`, kernel `encounter_session_settings`): the track's
// Telemetry and Solo, and its bound task's name, colour, activator, output style, Loop, Launch mode, Then, Quantize, what a Repeat varies
// and envelopes (manual §19.1 Clip view, the Clip and Launch panels and the Envelopes). The owner keeps them under a revision with their
// history and states every default, in the manual's words (ai-kit encounter_task_settings.rs: Launch mode trigger · gate · toggle ·
// repeat, Then next · again · stop, Loop's stop condition done · pass, Repeat's variable and stop when); this module puts its reading on
// the keys of the designed clip `clip:factory` and a control's change on the owner's request, each word as it is — the owner judges
// it — and writes it against the revision that stands. Pure, apart from `writeSessionSettings`.
import type {Value, Values} from '../frame/devices/designed'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {EncounterEnvelopePoint, EncounterSessionSettingsReading, EncounterSessionSettingsRequest, KernelTransportStatus}
  from '../../../../../desktop/cradle/src/kernel/types'
import {settingsReadingEntry} from '../owners/readers'
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

/** The envelope editor's rows (clips/factory.tsx EFFORT, AUTONOMY): Automation draws the level at a row; Modulation draws the five
 * steps −2…+2 on the same rows. */
export const EFFORT_LEVELS = ['inherit', 'low', 'medium', 'high', 'max'] as const
export const AUTONOMY_LEVELS = ['inherit', 'suggest', 'review', 'auto'] as const
const MODULATION_ROWS = 5

/** The design's Quantize words to the owner's. */
const QUANTIZE_TO_OWNER: Readonly<Record<string, string>> = {global: 'global', now: 'now', 'next tool': 'next-tool', 'next turn': 'next-turn'}
const QUANTIZE_TO_DESIGN: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(QUANTIZE_TO_OWNER).map(([d, o]) => [o, d]))

/** Hand off to is retired with Then's handoff on the owner (manual §19.1 The Launch panel: "To hand the work to another session, drag the
 * task onto that session's track"). */
export const HANDOFF_RETIRED = 'Hand off to: retired with Then\'s handoff on the session\'s settings (AIKit encounter-session-settings) — to hand the work to another session, drag the task onto that session\'s track.'

type Envelope = 'effort' | 'autonomy'
const levelsOf = (envelope: Envelope): readonly string[] => envelope === 'effort' ? EFFORT_LEVELS : AUTONOMY_LEVELS

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
    'env.agent.autonomy': JSON.stringify(rowsOfPoints(task.autonomy, 'autonomy', modulation)),
  }
  if (task.colour) values.colour = task.colour
  const own = (key: string, value: Value | null | undefined) => { if (value !== null && value !== undefined) values[key] = value }
  own('loop', task.loop); own('loop.until', task.loop_until); own('loop.cap', task.loop_cap)
  own('launch', task.launch); own('then', task.then)
  own('repeat.variable', task.repeat_variable); own('repeat.repeats', task.repeat_repeats); own('repeat.stop', task.repeat_stop)
  if (task.repeat_levels?.length) values['repeat.levels'] = task.repeat_levels.join(', ')
  return values
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
      const carried = (envelope: Envelope) => pointsOfRows(rowsOfPoints(task[envelope], envelope, from), envelope, to)
      return set({envelope_mode: mode, effort: carried('effort'), autonomy: carried('autonomy')})
    }
    case 'effort':
    case 'autonomy': {
      const rows = parseRows(value)
      if (!rows) return {refused: `The ${setting} envelope is a list of [second, step] points.`}
      return set({[setting]: pointsOfRows(rows, setting, task.envelope_mode === 'modulation')})
    }
  }
}

/** A track's Telemetry or Solo as the owner's request. */
export const trackSettingChange = (setting: 'telemetry' | 'solo', on: boolean): EncounterSessionSettingsRequest => ({track: {[setting]: on}})

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
  const effort = levelAt(task.effort, elapsedSeconds, modulation), autonomy = levelAt(task.autonomy, elapsedSeconds, modulation)
  if (effort) values.effort = effort
  if (autonomy) values.autonomy = autonomy
  return values
}

/** The Tasks device's keys the settings take. */
export const TASKS_DEVICE_SETTINGS = ['mode', 'then', 'to', 'effort', 'autonomy', 'register', 'form'] as const
export type TasksDeviceSetting = typeof TASKS_DEVICE_SETTINGS[number]

/** A Tasks device control's change as the owner's request. Effort and Autonomy set one level for the whole task: an Automation
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
    case 'autonomy': {
      const task = reading?.task
      if (!reading || !task) return taskSettingChange(key, value, reading)
      const level = typeof value === 'string' ? value : ''
      if (!(levelsOf(key) as readonly string[]).includes(level)) return {refused: `${key === 'effort' ? 'Effort' : 'Autonomy'} takes one of ${levelsOf(key).join(', ')}.`}
      const other: Envelope = key === 'effort' ? 'autonomy' : 'effort'
      const carried = pointsOfRows(rowsOfPoints(task[other], other, task.envelope_mode === 'modulation'), other, false)
      return {change: {task: {task_ref: task.task_ref, set: {envelope_mode: 'automation', [key]: level === 'inherit' ? [] : [[0, level]], [other]: carried}}}}
    }
  }
}
