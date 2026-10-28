// Factory's clip binding (manual §19.1 Clip view; §16.5's table: "Factory — A task — The log — Mode, Then, Quantize — The Agent's
// Effort and Autonomy for this task"): the task THE selection names, on the owners the replaced bodies read, mapped onto the keys of
// the designed clip `clip:factory` (inhabitants/catalogue/clips/factory.tsx). It replaces the Clip side's Tasks device
// (agent/devices/TaskClipDevice.tsx, the Tasks binding at compact size) and the task log's Clip view (shell/ModeDetail.tsx
// FactoryTaskLogDetail). Ported from:
//   - the task THE selection names, or a session track's first task (shell/modeDetails.tsx FactoryClip, :93-107 as it stood);
//   - the task itself — its title, state, start and last activity — from the agency reading's track (agent/agentRunModel.ts TaskClip);
//     the session's budget as the task's turns (FactoryTaskLogDetail's budget row);
//   - the log: the session's temporal events (the sessions provider's one read, agentRunModel.ts eventsForSession), within the task's
//     own span (its start to the next task's), each the owner's own row — its time, its kind and what it says (FactoryTaskLogDetail).
//   - the task's own settings — its name and colour as the person set them, its activator, output style, Loop with its stop condition
//     and cap, Launch mode, Then, Quantize, what a Repeat varies, and envelopes — from the session's settings on their owner (AIKit
//     `encounter-session-settings`, agent/sessionSettings.ts), every default stated by the owner, in the manual's words, which are the
//     owner's: read and written as they are, with no table between them.
// Every per-task setting writes through its seam in agent/devices/taskBindings.ts TASK_SEAMS, against the settings' standing
// revision. The Intent panel (§19.1, the design's D3 panel) has no reading a kernel route reaches: its keys stand absent and its writes
// refused, each with the operation it waits for (INTENT_ABSENT, INTENT_REFUSED). Of the Launch panel, Compare and the takes a Repeat made
// stand absent and refused the same way (LAUNCH_ABSENT, LAUNCH_REFUSED). Hand off to is retired: the task is dragged onto another
// session's track (§19.1). Pure, apart from the hook at the end.
import type {Value, Values} from '../frame/devices/designed'
import {clipBinding, missingOp, type ClipBinding, type ClipWiring} from '../frame/detail/clipBinding'
import {withMadeOf, type ClipSource} from '../frame/detail/clipSource'
import {useViewHoldsVersion} from '../frame/detail/clipBinding'
import {useSelectedClip} from '../frame/detail/ClipBox'
import {useDetailReading} from '../frame/detail/detailReading'
import {useTimelinePanePresentation} from '../projections/timelinePaneHost'
import {parseFactoryTaskRef} from '../timeline/factoryTrackAdapter'
import {useSettingsAnswer} from '../owners/readers'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {eventsForSession, trackKey, type AgentSessionTrack, type TaskClip, type TemporalEventLike} from './agentRunModel'
import {TASK_SEAMS, type TaskAddress, type TaskSeamContext, type TaskSetting} from './devices/taskBindings'
import {clipValuesOfSettings, settingsRefusal} from './sessionSettings'

/** The register the sessions provider reads its agency in (AgentSessionsProvider.tsx PROJECT): the session's settings are read there. */
export const SETTINGS_PROJECT = 'O-I'
const UNAVAILABLE = {kind: 'unavailable', reason: 'No sessions provider is mounted here.'} as const

/** The log keeps the latest rows of a long thread (FactoryTaskLogDetail's LOG_ROWS). */
export const LOG_ROWS = 200

/** The task THE selection names: `<session track>#task/<n>`, or a session track whose first real task it opens (ported from
 * modeDetails.tsx FactoryClip). Null when the selection names no session of the agency reading. */
export function factoryTaskOf(ref: string | null, tracks: readonly AgentSessionTrack[]): {track: AgentSessionTrack; task: TaskClip | null; trackId: string} | null {
  if (!ref) return null
  const named = parseFactoryTaskRef(ref)
  const trackId = named?.trackId ?? ref
  const track = tracks.find(item => trackKey(item) === trackId && !item.group) ?? null
  if (!track) return null
  const task = track.tasks.find(item => !item.softStop && (named ? item.n === named.n : true)) ?? null
  return {track, task, trackId}
}

/** One row of the design's log (factory.tsx Entry): at seconds from the task's start, the owner's own kind as the tool, its words. */
export interface LogRow {readonly at: number; readonly kind: 'tool'; readonly tool: string; readonly text: string}

/** The task's log: the session's temporal events inside the task's span (its start to the next task's start), each placed at its
 * seconds from the task's start, its kind the owner's own word, its text the owner's summary. An event with no instant has no place
 * on the task's time and is left out; a task with no start reads the session's events from its first. The latest LOG_ROWS. Pure. */
export function taskLogOf(track: AgentSessionTrack, task: TaskClip | null, events: readonly TemporalEventLike[]): LogRow[] {
  const mine = eventsForSession([...events], track.sessionRef).filter(event => typeof event.instant_unix_ms === 'number')
    .sort((a, b) => a.instant_unix_ms! - b.instant_unix_ms!)
  const next = task ? track.tasks.find(item => !item.softStop && item.n === task.n + 1)?.startUnixMs ?? null : null
  const from = task?.startUnixMs ?? null
  const within = mine.filter(event => (from === null || event.instant_unix_ms! >= from) && (next === null || event.instant_unix_ms! < next))
  const origin = from ?? within[0]?.instant_unix_ms ?? 0
  return within.slice(-LOG_ROWS).map(event => ({at: Math.max(0, (event.instant_unix_ms! - origin) / 1000), kind: 'tool',
    tool: event.kind ?? event.stream ?? 'event', text: event.summary ?? event.subject_ref}))
}

const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

export interface FactoryClipInput {
  /** THE selection's ref. */
  readonly ref: string | null
  /** The agency reading's session tracks. */
  readonly tracks: readonly AgentSessionTrack[]
  /** The session's temporal events (the sessions provider's one read); null when no provider reads them here. */
  readonly events: readonly TemporalEventLike[] | null
  /** The selected clip's track colour, as the tracks pane gives it. */
  readonly colour?: string | null
  /** The clip stands on Arrangement view's ruler: no Launch tab. */
  readonly placed?: boolean
  /** The selected session's settings on their owner, and where they are written; null where nothing reads them. */
  readonly settings?: TaskSeamContext | null
}

/** The task's readings on the design's keys. A key no owner reports is left out (the design draws "—"). Pure. */
export function factoryClipValues(track: AgentSessionTrack, task: TaskClip | null, input: Pick<FactoryClipInput, 'tracks' | 'events' | 'colour' | 'settings'>): Values {
  const values: Record<string, Value> = {}
  put(values, 'name', task?.title ?? track.purpose)
  put(values, 'colour', input.colour)
  // The bound task's settings, as the owner states them (its name as set, else its purpose; a colour set, else the track's).
  if (task && task.n === 1) Object.assign(values, clipValuesOfSettings(input.settings?.settings ?? null))
  if (task && task.state !== 'unknown') values.state = task.state
  // The turns are the session's budget reading: the agency reading budgets a session, and a task runs on its session's turns.
  put(values, 'turns.used', track.budget.used)
  put(values, 'turns.cap', track.budget.max)
  if (input.events) {
    const log = taskLogOf(track, task, input.events)
    values.log = JSON.stringify(log)
    if (task?.startUnixMs != null && task.lastActivityUnixMs != null) values.elapsed = Math.max(0, Math.round((task.lastActivityUnixMs - task.startUnixMs) / 1000))
    else if (log.length) values.elapsed = Math.round(log[log.length - 1]!.at)
  }
  return values
}

/** The design's keys, each to the seam it writes through (taskBindings.ts TASK_SEAMS). */
const SETTING_OF: Readonly<Record<string, TaskSetting>> = {
  name: 'name', colour: 'colour', active: 'active', 'style.register': 'register', 'style.form': 'form', loop: 'loop', 'loop.until': 'loopUntil',
  'loop.cap': 'loopCap', launch: 'launch', then: 'then', quantize: 'quantize', 'repeat.variable': 'repeatVariable', 'repeat.levels': 'repeatLevels',
  'repeat.repeats': 'repeatRepeats', 'repeat.stop': 'repeatStop', 'env.agent.effort': 'effort', 'env.agent.autonomy': 'autonomy', 'env.mode': 'envelopeMode',
  'env.linked': 'envelopeLink',
}

/** The Intent panel's readings (manual §19.1 "The Intent panel"; clip:factory, D3): what the task is for, its source, its success conditions,
 * its context and constraints. Factory keeps them — the required difference in the Development Field (`factory development field read`),
 * the conditions, their evaluation, the context and the constraints in the bounded intent of its project-development ledger — and no kernel
 * route reaches either: the kernel's factory_development_read carries project, journey, run, workflow-units, workflow-unit,
 * execution-telemetry and commission-read only. Each key is absent, with the read it waits for. */
const LEDGER_READ = 'a read of the project-development ledger (bounded intent, success criteria, PraxisCondition) through the kernel (T-COVERAGE §1.2)'
export const INTENT_ABSENT: Readonly<Record<string, string>> = {
  intent: 'The intent: no reading reaches it yet — missing op: `factory development field read` through the kernel (factory_development_read carries no Development Field) (Software Factory).',
  'intent.source': `Where the intent is written: no reading reaches it yet — missing op: ${LEDGER_READ} (Software Factory).`,
  criteria: `The success conditions and their return: no reading reaches them yet — missing op: ${LEDGER_READ} (Software Factory).`,
  constraints: `The constraints the task keeps: no reading reaches them yet — missing op: ${LEDGER_READ} (Software Factory).`,
  context: `The context the task resolves in: no reading reaches it yet — missing op: ${LEDGER_READ} (Software Factory).`,
}
/** The Intent panel's writes, each refused with the operation it lacks. */
export const INTENT_REFUSED: Readonly<Record<string, string>> = {
  intent: 'Intent: no owner operation carries it yet — missing op: `factory development field set` through the kernel (Software Factory).',
  criterion: 'A success condition: no owner operation carries it yet — missing op: a success-condition write on the bounded intent of the project-development ledger (Software Factory has none) (Software Factory).',
}

/** Compare and the takes (manual §19.1 The Launch panel): Loop, the launch mode and what a Repeat varies are the session's settings (AIKit
 * `encounter-session-settings`), but the takes a Repeat makes are the take lanes' reading (AIKit encounter_task_attempts_list), not handed to
 * Clip view, and no owner compares takes. Each stands absent, and Compare refused, with the operation it waits for. */
export const LAUNCH_ABSENT: Readonly<Record<string, string>> = {
  compare: 'Compare: no reading reaches it yet — missing op: no owner compares takes side by side (Software Factory).',
  takes: 'The takes a Repeat made: not handed to Clip view — the take lanes read them (AIKit encounter_task_attempts_list, each Run by factory_attempt_read) (AIKit).',
}
export const LAUNCH_REFUSED: Readonly<Record<string, string>> = {
  compare: 'Compare: no owner operation carries it yet — missing op: a comparison of takes (Software Factory).',
}

/** A task's source (manual §19.1 The Clip panel: "Constellation — The one the task was made of — The task's source"): no owner keeps it
 * yet. The task's own settings are AIKit's (encounter-session-settings, ai-kit encounter_task_settings.rs), and they hold no source, so
 * the key stands absent and Show in Browser names the operation AIKit lacks (PROPOSE, O-I #768). */
export const TASK_SOURCE: ClipSource = {made: 'unread', why: missingOp('The task\'s constellation',
  'task_source {session, task} → the constellation_ref the task was made of, kept with the task\'s settings, and set when a constellation dropped on a session\'s track makes the task',
  'AIKit encounter-session-settings')}

/** clip:factory's wiring: every key the design draws or sets. */
export function factoryWiring(task: TaskAddress | null, context: TaskSeamContext | null = null): ClipWiring {
  return withMadeOf(taskWiring(task, context), TASK_SOURCE)
}

function taskWiring(task: TaskAddress | null, context: TaskSeamContext | null): ClipWiring {
  const acts: Record<string, (value: Value) => Promise<void>> = {}
  const refused: Record<string, string> = {}
  const why = task ? settingsRefusal(context, task.n) : 'No task is selected: select a task on a session\'s track.'
  for (const [key, setting] of Object.entries(SETTING_OF)) {
    const seam = TASK_SEAMS[setting]
    if (seam.refused) refused[key] = seam.refused
    else if (why || !task || !context) refused[key] = why ?? 'No task is selected: select a task on a session\'s track.'
    else acts[key] = value => seam.send(task, value, context)
  }
  return {
    reads: {
      name: 'the task\'s name as set on the session\'s settings, else its purpose (the task\'s title)', colour: 'the colour set on the session\'s settings, else the session track\'s colour (the tracks pane)',
      active: 'the session\'s settings: the task\'s activator', 'style.register': 'the session\'s settings: the task\'s register', 'style.form': 'the session\'s settings: the task\'s form',
      launch: 'the session\'s settings: Launch mode — trigger · gate · toggle · repeat, the owner\'s words as the design\'s',
      then: 'the session\'s settings: Then, the follow action on the task\'s own track — next · again · stop',
      loop: 'the session\'s settings: Loop, which runs the task again after each finish (On) or not (Off)',
      'loop.until': 'the session\'s settings: Loop\'s stop condition — done · pass', 'loop.cap': 'the session\'s settings: Loop\'s cap, the most runs (absent: none)',
      'repeat.variable': 'the session\'s settings: Repeat\'s Variable', 'repeat.levels': 'the session\'s settings: Repeat\'s Levels, comma-separated (absent: none chosen)',
      'repeat.repeats': 'the session\'s settings: Repeat\'s Repeats', 'repeat.stop': 'the session\'s settings: Repeat\'s Stop when',
      quantize: 'the session\'s settings: Quantize', 'env.mode': 'the session\'s settings: the envelopes\' mode', 'env.linked': 'the session\'s settings: the envelopes\' link',
      'env.agent.effort': 'the session\'s settings: the Effort envelope', 'env.agent.autonomy': 'the session\'s settings: the Autonomy envelope',
      state: 'the task\'s state: queued · running · stalled · done (agentRunModel.ts), left out where the owner and the activity do not say',
      'turns.used': 'the session\'s budget: turns used', 'turns.cap': 'the session\'s budget: turns allowed',
      log: 'the session\'s temporal events inside the task\'s span',
      elapsed: 'the task\'s start to its last activity, in seconds',
    },
    absent: {...INTENT_ABSENT, ...LAUNCH_ABSENT},
    acts,
    view: {
      fold: 'Fold keeps only the lanes of the tools the agent used: how the log shows, not the log',
      event: 'the log row selected in Clip view', 'env.control': 'which of the Agent\'s controls the envelope editor shows',
      'criteria.page': 'the page of success conditions Clip view shows',
    },
    refused: {...refused, ...INTENT_REFUSED, ...LAUNCH_REFUSED},
  }
}

/** Factory's clip binding: the task THE selection names, or null when it names none. Pure. */
export function factoryClipBinding(input: FactoryClipInput): ClipBinding | null {
  const chosen = factoryTaskOf(input.ref, input.tracks)
  if (!chosen) return null
  const {track, task, trackId} = chosen
  const address: TaskAddress | null = task ? {sessionRef: track.sessionRef, n: task.n} : null
  return clipBinding({mode: 'factory', ref: task ? `${trackId}#task/${task.n}` : trackId, values: factoryClipValues(track, task, input),
    wiring: factoryWiring(address, input.settings ?? null), placed: input.placed, viewDefaults: {'view.panel': 'launch', 'view.editor': 'log', fold: true}})
}

/** The selected task's clip binding, from the frame's detail reading, THE selection and the sessions provider. */
export function useFactoryClip(): ClipBinding | null {
  const {factory} = useDetailReading()
  const selected = useSelectedClip()
  const sessions = useAgentSessionsOptional()
  const presentation = useTimelinePanePresentation()
  useViewHoldsVersion()
  const trackId = selected.ref ? parseFactoryTaskRef(selected.ref)?.trackId ?? selected.ref : null
  const colour = selected.set?.tracks.find(item => item.id === trackId)?.color ?? selected.track?.color ?? null
  const sessionRef = factoryTaskOf(selected.ref, factory.tracks)?.track.sessionRef ?? null
  const transport = sessions?.transport ?? UNAVAILABLE
  const answer = useSettingsAnswer(transport, sessions ? sessionRef : null, SETTINGS_PROJECT)
  const settings: TaskSeamContext | null = sessions && sessionRef
    ? {transport, project: SETTINGS_PROJECT, settings: answer.reading.status === 'answered' ? answer.reading.value : null, refused: answer.reading.error} : null
  return factoryClipBinding({ref: selected.ref, tracks: factory.tracks, events: sessions ? sessions.events : null, colour, placed: presentation === 'arrangement', settings})
}
