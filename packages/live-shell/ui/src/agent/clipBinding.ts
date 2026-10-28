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
//     and cap, Launch mode, Then, Quantize, what a Repeat varies, envelopes and its source (the constellation it was made of, taskSourceOf)
//     — from the session's settings on their owner (AIKit `encounter-session-settings`, agent/sessionSettings.ts), every default stated by
//     the owner, in the manual's words, which are the owner's: read and written as they are, with no table between them.
// A constellation dropped on a session's track makes the session's task of it (makeTaskOf, the maker the Factory set carries: taskMaker).
// Every per-task setting writes through its seam in agent/devices/taskBindings.ts TASK_SEAMS, against the settings' standing
// revision. The Intent panel (§19.1, the design's D3 panel) has no reading a kernel route reaches: its keys stand absent and its writes
// refused, each with the operation it waits for (INTENT_ABSENT, INTENT_REFUSED). Of the Launch panel, Compare and the takes a Repeat made
// stand absent and refused the same way (LAUNCH_ABSENT, LAUNCH_REFUSED). Hand off to is retired: the task is dragged onto another
// session's track (§19.1). Pure, apart from the hook at the end.
import type {Value, Values} from '../frame/devices/designed'
import {clipBinding, type ClipBinding, type ClipWiring} from '../frame/detail/clipBinding'
import {madeOfValues, withMadeOf, type ClipSource} from '../frame/detail/clipSource'
import {CONSTELLATION_DRAG} from '../frame/browser/constellationFocus'
import {constellationNamed, constellationsNow, useConstellations, type Constellation} from '../owners/constellations'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {EncounterSessionSettingsReading, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {WorldActionReceipt, WorldTrackActions} from '../timeline/worldTrackAdapter'
import {useViewHoldsVersion} from '../frame/detail/clipBinding'
import {useSelectedClip} from '../frame/detail/ClipBox'
import {useDetailReading} from '../frame/detail/detailReading'
import {useTimelinePanePresentation} from '../projections/timelinePaneHost'
import {parseFactoryTaskRef} from '../timeline/factoryTrackAdapter'
import {readSettingsOf, settingsReadingEntry, useSettingsAnswer} from '../owners/readers'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {eventsForSession, trackKey, type AgentSessionTrack, type TaskClip, type TemporalEventLike} from './agentRunModel'
import {TASK_SEAMS, type TaskAddress, type TaskSeamContext, type TaskSetting} from './devices/taskBindings'
import {clipValuesOfSettings, settingsRefusal, SETTINGS_RESULT} from './sessionSettings'

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
  /** The wiki's constellations, which name the task's source (owners/constellations.ts). */
  readonly constellations?: readonly Constellation[] | null
}

/** The task's readings on the design's keys. A key no owner reports is left out (the design draws "—"). Pure. */
export function factoryClipValues(track: AgentSessionTrack, task: TaskClip | null, input: Pick<FactoryClipInput, 'tracks' | 'events' | 'colour' | 'settings' | 'constellations'>): Values {
  const values: Record<string, Value> = {}
  // The task's source, the constellation it was made of, named from the wiki (taskSourceOf).
  Object.assign(values, madeOfValues(taskSourceOf(task ? {sessionRef: track.sessionRef, n: task.n} : null, input.settings ?? null), input.constellations))
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
 * `encounter-session-settings`), and so is the set of takes a Repeat runs (`task.takes`, O-I 795): the takes it made are read once the
 * set ends. Before a set stands, the takes are absent; no owner compares takes, so Compare stands absent and refused with the operation it
 * waits for. */
export const LAUNCH_ABSENT: Readonly<Record<string, string>> = {
  compare: 'Compare: no reading reaches it yet — missing op: no owner compares takes side by side (Software Factory).',
  // REPLACED (O-I 795): "not handed to Clip view — the take lanes read them": a Repeat's set of takes is now the task's settings on AIKit.
  takes: 'The takes a Repeat made: no set of takes stands yet — a Repeat\'s press starts one on AIKit (encounter-session-settings task.takes), its takes made by Actuation\'s comparison run (AIKit).',
}
export const LAUNCH_REFUSED: Readonly<Record<string, string>> = {
  compare: 'Compare: no owner operation carries it yet — missing op: a comparison of takes (Software Factory).',
}

/** Repeat's fields, which do not change while its takes run (§19.1 The Launch panel: "Once the first run starts, these do not change. A
 * change starts a new set of takes"; AIKit refuses them in the same words). */
const REPEAT_KEYS: ReadonlySet<string> = new Set(['repeat.variable', 'repeat.levels', 'repeat.repeats', 'repeat.stop'])
const takesRunning = (trace: string) => `Once the first run starts, these do not change: the takes ${trace} are running. A change starts a new set of takes once they end.`

/** A task's source (manual §19.1 The Clip panel: "Constellation — The one the task was made of — The task's source, as a sample is an
 * audio clip's"): the task's own settings on AIKit keep it (encounter-session-settings `task.source`, ai-kit encounter_task_settings.rs:
 * the constellation the task was made with, until the person sets another; null when it was made of none). It REPLACES part one's
 * TASK_SOURCE, which stood absent naming a missing `task_source` op. Where the settings are not read here, or name no task, the key is
 * unread with that reason (sessionSettings.ts settingsRefusal). Pure. */
export function taskSourceOf(task: TaskAddress | null, context: TaskSeamContext | null): ClipSource {
  const why = task ? settingsRefusal(context, task.n) : 'No task is selected: select a task on a session\'s track.'
  const settings = context?.settings?.task
  if (why || !settings) return {made: 'unread', why: why ?? SETTINGS_WHY_NO_TASK}
  // An AIKit installed before it kept a task's source reads no `source` at all: unread, never None.
  if (!('source' in settings)) return {made: 'unread', why: SOURCE_UNKEPT}
  return settings.source ? {made: 'of', ref: settings.source, by: SOURCE_BY} : {made: 'none', by: SOURCE_BY}
}
const SOURCE_BY = 'the task\'s settings on AIKit (encounter-session-settings task.source)'
const SETTINGS_WHY_NO_TASK = 'No task is bound to this session: its owner keeps no settings for a task it does not hold.'
/** The settings reading of an AIKit that does not keep a task's source yet (installed before ai-kit a3f43f84). */
export const SOURCE_UNKEPT = 'The task\'s source is not read: the AIKit installed here keeps no source in a task\'s settings (its reading names none); install an AIKit that does.'

/** clip:factory's wiring: every key the design draws or sets. */
export function factoryWiring(task: TaskAddress | null, context: TaskSeamContext | null = null): ClipWiring {
  return withMadeOf(taskWiring(task, context), taskSourceOf(task, context))
}

function taskWiring(task: TaskAddress | null, context: TaskSeamContext | null): ClipWiring {
  const acts: Record<string, (value: Value) => Promise<void>> = {}
  const refused: Record<string, string> = {}
  const why = task ? settingsRefusal(context, task.n) : 'No task is selected: select a task on a session\'s track.'
  const takes = why ? null : context?.settings?.task?.takes ?? null
  for (const [key, setting] of Object.entries(SETTING_OF)) {
    const seam = TASK_SEAMS[setting]
    if (seam.refused) refused[key] = seam.refused
    else if (why || !task || !context) refused[key] = why ?? 'No task is selected: select a task on a session\'s track.'
    else if (takes?.running && REPEAT_KEYS.has(key)) refused[key] = takesRunning(takes.trace_ref)
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
      'repeat.variable': 'the session\'s settings: Repeat\'s Variable', 'repeat.levels': 'the session\'s settings: Repeat\'s Levels, comma-separated (absent: none chosen, and Actuation\'s comparison run takes its own default three conditions)',
      'repeat.repeats': 'the session\'s settings: Repeat\'s Repeats', 'repeat.stop': 'the session\'s settings: Repeat\'s Stop when',
      quantize: 'the session\'s settings: Quantize', 'env.mode': 'the session\'s settings: the envelopes\' mode', 'env.linked': 'the session\'s settings: the envelopes\' link',
      'env.agent.effort': 'the session\'s settings: the Effort envelope', 'env.agent.autonomy': 'the session\'s settings: the Autonomy envelope',
      state: 'the task\'s state: queued · running · stalled · done (agentRunModel.ts), left out where the owner and the activity do not say',
      'turns.used': 'the session\'s budget: turns used', 'turns.cap': 'the session\'s budget: turns allowed',
      log: 'the session\'s temporal events inside the task\'s span',
      elapsed: 'the task\'s start to its last activity, in seconds',
      ...(takes ? {takes: 'the session\'s settings: the Repeat\'s set of takes (task.takes) — the takes it made, read once the set ends'} : {}),
    },
    absent: {...INTENT_ABSENT, ...(takes ? {compare: LAUNCH_ABSENT.compare} : LAUNCH_ABSENT)},
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
  const constellations = useConstellations().rows
  return factoryClipBinding({ref: selected.ref, tracks: factory.tracks, events: sessions ? sessions.events : null, colour, placed: presentation === 'arrangement', settings,
    constellations})
}

// ---------------------------------------------------------------------------------------------------------------- the drop

/** Why a session can take no task made of a constellation: it holds none (AIKit binds a session's task when the session is prepared for it,
 * `encounter-task-configure`, whose request names the constellation as the task's `source`; the shell does not prepare tasks). */
const noTask = (label: string) => `${label} holds no task, so no task is made of it here: AIKit binds a session's task when the session is prepared `
  + 'for one (encounter-task-configure, whose request takes the constellation as the task\'s source); drop it on a session that works a task.'

/** Factory's clip of a constellation (manual §10.3: "Drag it onto a track and this mode makes its own clip of it, with the constellation as
 * its source: … a task in Factory"; §16.7 Make this mode's clip; §19.1 the Clip panel's Constellation: "The one the task was made of"):
 * a session's track holds the one task AIKit binds to the session, so the drop makes that task of the constellation — the task's own
 * settings take it as their `source` on AIKit, written against the revision read (the owner's CAS), and AIKit's reading gives the source
 * back. A session that holds no task is refused in words (noTask). Every reader of the session's settings is asked again. */
export async function makeTaskOf(transport: KernelTransportStatus, session: {readonly sessionRef: string; readonly label: string},
  constellation: {readonly ref: string; readonly title: string}, project = SETTINGS_PROJECT): Promise<WorldActionReceipt> {
  const {ref, title} = constellation
  const owner = readSettingsOf(transport, project, session.sessionRef)
  const read = async (): Promise<{reading: EncounterSessionSettingsReading} | {error: string}> => {
    const answer = await owner()
    return 'error' in answer ? {error: answer.error} : {reading: answer.value}
  }
  const before = await read()
  if ('error' in before) return {ok: false, error: `${session.label}'s settings were not read, so no task is made of ${title}: ${before.error}`}
  const task = before.reading.task
  if (!task) return {ok: false, error: noTask(session.label)}
  const written = await kernelOp(transport, {op: 'encounter_session_settings', project, agent_session: session.sessionRef,
    request: {task: {task_ref: task.task_ref, set: {source: ref}}}, ...(before.reading.revision ? {expected_revision: before.reading.revision} : {})})
  if (written.error || written.outcome?.result !== SETTINGS_RESULT) return {ok: false, error: `AIKit did not make ${task.name} of ${title}: ${written.error ?? 'it gave no reading'}`}
  const after = await read()
  // Every reader of the session's settings is asked again (the Clip panel, the mixer row), as a settings write does (sessionSettings.ts).
  const entry = settingsReadingEntry(transport, project, session.sessionRef)
  const epoch = entry.snapshot().epoch
  if (epoch !== null) void entry.refresh(epoch)
  if ('error' in after) return {ok: false, error: `AIKit kept ${title} as ${task.name}'s source, but did not read it back: ${after.error}`}
  const kept = after.reading.task
  if (!kept || kept.task_ref !== task.task_ref) return {ok: false, error: `AIKit kept the change, but its settings now read another task than ${task.name}.`}
  if (kept.source !== ref) return {ok: false, error: `AIKit kept the change, but reads ${task.name}'s source as ${kept.source ?? 'none'}, not ${ref}.`}
  return {ok: true, note: `${task.name} on ${session.label} is made of ${title}; AIKit reads the task's source as ${title}.`}
}

type Maker = NonNullable<WorldTrackActions['makeClip']>

/** The maker the Factory set carries (frame/tracks/useFactoryTracks.ts; frame/tracks/clipMakers.ts withClipMaker): a constellation dropped
 * on a session's track makes that session's task of it (makeTaskOf). A drop on another track, or of a ref the wiki's reading does not
 * hold, is refused in words. */
export function taskMaker(transport: KernelTransportStatus, tracks: readonly AgentSessionTrack[],
  named: (ref: string) => Constellation | null = ref => constellationNamed(constellationsNow().rows, ref)): Maker {
  return {accepts: CONSTELLATION_DRAG,
    op: 'AIKit encounter-session-settings: the session\'s task takes the constellation as its source (task.source), read back from AIKit',
    run: async (trackId: string, payload: string): Promise<WorldActionReceipt> => {
      const track = tracks.find(item => trackKey(item) === trackId && !item.group)
      if (!track) return {ok: false, error: 'Only a session\'s track makes a task of a constellation: drop it on a session.'}
      const ref = payload.trim()
      const found = named(ref)
      if (!found) return {ok: false, error: `${ref} is no constellation the wiki's reading holds now.`}
      return makeTaskOf(transport, {sessionRef: track.sessionRef, label: track.agentName ?? track.purpose ?? track.sessionRef}, found)
    }}
}
