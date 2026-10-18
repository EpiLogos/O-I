// Factory's clip binding (manual §19.1 Clip view; §16.5's table: "Factory — A task — The log — Mode, Then, Quantize — The Agent's
// Effort and Autonomy for this task"): the task THE selection names, on the owners the replaced bodies read, mapped onto the keys of
// the designed clip `clip:factory` (inhabitants/catalogue/clips/factory.tsx). It replaces the Clip side's Tasks device
// (agent/devices/TaskClipDevice.tsx, the Tasks binding at compact size) and the task log's Clip view (shell/ModeDetail.tsx
// FactoryTaskLogDetail). Ported from:
//   - the task THE selection names, or a session track's first task (shell/modeDetails.tsx FactoryClip, :93-107 as it stood);
//   - the task itself — its title, state, start and last activity — from the agency reading's track (agent/agentRunModel.ts TaskClip);
//     the session's budget as the task's turns (FactoryTaskLogDetail's budget row); the session list for Hand off to
//     (agent/devices/threadBinding.ts sessionRowsOf);
//   - the log: the session's temporal events (the sessions provider's one read, agentRunModel.ts eventsForSession), within the task's
//     own span (its start to the next task's), each the owner's own row — its time, its kind and what it says (FactoryTaskLogDetail).
// Every per-task setting writes through its seam in agent/devices/taskBindings.ts TASK_SEAMS, which refuses in its owner's words
// today and stands disabled with them; the owner op wires in one line there. Pure, apart from the hook at the end.
import type {Value, Values} from '../frame/devices/designed'
import {clipBinding, type ClipBinding, type ClipWiring} from '../frame/detail/clipBinding'
import {useViewHoldsVersion} from '../frame/detail/clipBinding'
import {useSelectedClip} from '../frame/detail/ClipBox'
import {useDetailReading} from '../frame/detail/detailReading'
import {useTimelinePanePresentation} from '../projections/timelinePaneHost'
import {parseFactoryTaskRef} from '../timeline/factoryTrackAdapter'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {eventsForSession, trackKey, type AgentSessionTrack, type TaskClip, type TemporalEventLike} from './agentRunModel'
import {TASK_SEAMS, type TaskAddress, type TaskSetting} from './devices/taskBindings'

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
}

/** The task's readings on the design's keys. A key no owner reports is left out (the design draws "—"). Pure. */
export function factoryClipValues(track: AgentSessionTrack, task: TaskClip | null, input: Pick<FactoryClipInput, 'tracks' | 'events' | 'colour'>): Values {
  const values: Record<string, Value> = {}
  put(values, 'name', task?.title ?? track.purpose)
  put(values, 'colour', input.colour)
  if (task && task.state !== 'unknown') values.state = task.state
  // The turns are the session's budget reading: the agency reading budgets a session, and a task runs on its session's turns.
  put(values, 'turns.used', track.budget.used)
  put(values, 'turns.cap', track.budget.max)
  values.sessions = JSON.stringify(input.tracks.filter(item => !item.group && item.sessionRef !== track.sessionRef)
    .map(item => ({id: item.sessionRef, name: item.purpose ?? item.agentName ?? item.sessionRef.slice(0, 12)})))
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
  name: 'name', colour: 'colour', active: 'active', 'style.register': 'register', 'style.form': 'form', launch: 'launch', then: 'then',
  handoff: 'handoff', quantize: 'quantize', 'env.agent.effort': 'effort', 'env.agent.autonomy': 'autonomy', 'env.mode': 'envelopeMode', 'env.linked': 'envelopeLink',
}

/** clip:factory's wiring: every key the design draws or sets. */
export function factoryWiring(task: TaskAddress | null): ClipWiring {
  const acts: Record<string, (value: Value) => Promise<void>> = {}
  const refused: Record<string, string> = {}
  for (const [key, setting] of Object.entries(SETTING_OF)) {
    const seam = TASK_SEAMS[setting]
    if (seam.refused || !task) refused[key] = seam.refused ?? 'No task is selected: select a task on a session\'s track.'
    else acts[key] = value => seam.send(task, value)
  }
  return {
    reads: {
      name: 'the task\'s title (agency reading: TaskClip.title), else its session\'s purpose', colour: 'the session track\'s colour (the tracks pane)',
      state: 'the task\'s state: queued · running · stalled · done (agentRunModel.ts), left out where the owner and the activity do not say',
      'turns.used': 'the session\'s budget: turns used', 'turns.cap': 'the session\'s budget: turns allowed',
      sessions: 'the other sessions of the agency reading, for Hand off to', log: 'the session\'s temporal events inside the task\'s span',
      elapsed: 'the task\'s start to its last activity, in seconds',
    },
    absent: {
      'style.register': 'no owner reports an output style for one task', 'style.form': 'no owner reports an output style for one task',
      launch: 'no task record holds a launch mode', then: 'no task record holds a follow action', handoff: 'no task record holds a hand-off',
      quantize: 'no task record holds a launch quantize', 'env.agent.effort': 'no owner reports a per-task effort', 'env.agent.autonomy': 'no owner reports a per-task autonomy',
      active: 'no owner reports a task\'s activator', 'env.mode': 'no task envelope is reported', 'env.linked': 'no task envelope is reported',
    },
    acts,
    view: {
      fold: 'Fold keeps only the lanes of the tools the agent used: how the log shows, not the log',
      event: 'the log row selected in Clip view', 'env.control': 'which of the Agent\'s controls the envelope editor shows',
    },
    refused,
  }
}

/** Factory's clip binding: the task THE selection names, or null when it names none. Pure. */
export function factoryClipBinding(input: FactoryClipInput): ClipBinding | null {
  const chosen = factoryTaskOf(input.ref, input.tracks)
  if (!chosen) return null
  const {track, task, trackId} = chosen
  const address: TaskAddress | null = task ? {sessionRef: track.sessionRef, n: task.n} : null
  return clipBinding({mode: 'factory', ref: task ? `${trackId}#task/${task.n}` : trackId, values: factoryClipValues(track, task, input),
    wiring: factoryWiring(address), placed: input.placed, viewDefaults: {'view.panel': 'launch', 'view.editor': 'log', fold: true}})
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
  return factoryClipBinding({ref: selected.ref, tracks: factory.tracks, events: sessions ? sessions.events : null, colour, placed: presentation === 'arrangement'})
}
