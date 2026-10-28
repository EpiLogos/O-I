// One agent session's settings on their owner (AIKit `encounter-session-settings`, kernel `encounter_session_settings`): the track's
// Telemetry and Solo, and its bound task's name, colour, activator, output style, Launch, Then, Hand off to, Quantize and envelopes
// (manual §19.1 Clip view, the Launch panel and the Envelopes). The owner keeps them under a revision with their history and states
// every default; this module maps its reading onto the keys of the designed clip `clip:factory` and a control's change back onto the
// owner's request, and writes it against the revision that stands. Pure, apart from `writeSessionSettings`.
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

/** The manual's launch modes and follow actions (§19.1 The Launch panel: Trigger · Gate · Toggle · Repeat; Next task · Again · Stop) in the
 * owner's words (ai-kit encounter_task_settings.rs:28-29: Launch once · hold · loop, Then next · handoff · stop): Trigger is once and Gate is
 * hold; Next task and Stop are the owner's own. Toggle, Repeat and Again have no owner word. */
const LAUNCH_TO_OWNER: Readonly<Record<string, string>> = {trigger: 'once', gate: 'hold'}
const THEN_TO_OWNER: Readonly<Record<string, string>> = {next: 'next', stop: 'stop'}
const LAUNCH_TO_DESIGN: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(LAUNCH_TO_OWNER).map(([d, o]) => [o, d]))
const THEN_TO_DESIGN: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(THEN_TO_OWNER).map(([d, o]) => [o, d]))
const WORD: Readonly<Record<string, string>> = {trigger: 'Trigger', gate: 'Gate', toggle: 'Toggle', repeat: 'Repeat', next: 'Next task', again: 'Again', stop: 'Stop'}
/** The owner's loop (encounter_task_executor.rs:701-708: the task is submitted again after each finish) is the Clip panel's Loop, which
 * names no launch mode; so Launch mode reads nothing while it stands. */
export const OWNER_LOOP_WORDS = 'Launch mode: the session\'s settings keep Launch as loop, which is the Clip panel\'s Loop (the task runs again after each finish) and names no launch mode (AIKit encounter-session-settings).'
/** The owner's handoff is no follow action (§19.1 "Next task, Again and Stop are Live's follow actions, and like Live's they stay on the
 * clip's own track. To hand the work to another session, drag the task onto that session's track"); so Then reads nothing while it stands. */
export const OWNER_HANDOFF_WORDS = 'Then: the session\'s settings keep Then as handoff, which the manual makes no follow action (to hand the work to another session, drag the task onto that session\'s track) (AIKit encounter-session-settings).'
/** A launch mode or a follow action with no owner word, refused naming the words the owner keeps. */
const NO_OWNER_WORD = (setting: 'launch' | 'then', word: string): string => setting === 'launch'
  ? `${WORD[word] ?? word}: no owner operation carries it yet — missing op: a ${WORD[word] ?? word} launch on the task's session settings, which keep Launch as once · hold · loop (AIKit).`
  : `${WORD[word] ?? word}: no owner operation carries it yet — missing op: an ${WORD[word] ?? word} follow action on the task's session settings, which keep Then as next · handoff · stop (AIKit).`

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

/** The owner's reading on the design's keys. Name and colour as the owner states them (a null colour takes the session's). */
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
  if (task.handoff_to) values.handoff = task.handoff_to
  // Launch and Then in the manual's words where the owner's mean the same (Trigger, Gate; Next task, Stop); the owner's loop is the Clip
  // panel's Loop and names no launch mode (OWNER_LOOP_WORDS); its handoff is no follow action (OWNER_HANDOFF_WORDS).
  const launch = LAUNCH_TO_DESIGN[task.launch]
  if (launch) values.launch = launch
  if (launch || task.launch === 'loop') values.loop = task.launch === 'loop'
  const then = THEN_TO_DESIGN[task.then]
  if (then) values.then = then
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
  switch (setting) {
    case 'name': return set({name: text(value)})
    case 'colour': return set({colour: text(value)})
    case 'active': return typeof value === 'boolean' ? set({active: value}) : {refused: 'The clip activator is on or off.'}
    case 'register': return set({register: text(value)})
    case 'form': return set({form: text(value)})
    case 'launch':
    case 'then': {
      const word = text(value) ?? ''
      const owner = (setting === 'launch' ? LAUNCH_TO_OWNER : THEN_TO_OWNER)[word]
      if (owner) return set({[setting]: owner})
      if (word in WORD) return {refused: NO_OWNER_WORD(setting, word)}
      return {refused: setting === 'launch' ? 'Launch mode is Trigger, Gate, Toggle or Repeat.' : 'Then is Next task, Again or Stop.'}
    }
    case 'handoff': return set({handoff_to: text(value)})
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
  if (task.handoff_to) values.to = task.handoff_to
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
    // The Tasks design speaks the owner's own words (once · hold · loop; next · handoff · stop), so its Mode and Then go to the owner as they are.
    case 'mode':
    case 'then': {
      const task = reading?.task
      if (!reading || !task) return taskSettingChange(key === 'mode' ? 'launch' : 'then', value, reading)
      return {change: {task: {task_ref: task.task_ref, set: {[key === 'mode' ? 'launch' : 'then']: typeof value === 'string' && value.trim() ? value.trim() : null}}}}
    }
    case 'to': return taskSettingChange('handoff', value, reading)
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
