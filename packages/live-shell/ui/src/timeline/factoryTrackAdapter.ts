// Factory's sessions and tasks as the shared Session and Arrangement's tracks (FOUNDATION F3; lock §9.1 Factory row: track =
// a session, clip = a task, stop = a launched batch, takes = attempts; manual §6: "Each agent works a track, and its tasks are
// the clips").
//
// Projection, ported from the agent shell's own grid and run viewer (agent/AgentSessionGrid.tsx, agent/AgentArrangementView.tsx):
// - tracks: the agency tracks (agent/agentRunModel.ts) in their order, each id `trackKey(track)` — the ref THE selection already
//   holds for a session (`kind: 'agent-session'`). A group (a SessionSpace) is a track at depth 0; what it spawned steps in beneath
//   it, `depth` and `parentId` walked up the parent chain exactly as the grid walks it; each carries the grid's palette colour.
// - clips: every real task of a session, id `<track id>#task/<n>` (the task log opens by the session; `parseFactoryTaskRef` gives
//   it back). The trailing soft-stop slot is not a task: it is the empty cell whose square stops the track. A group carries no
//   clips of its own — its header folds its helpers; what it would show is a roll-up the view derives from `parentId`.
// - status: queued → waiting, running → running, done → done, stalled → stalled, stopped → stopped (Factory's words); a task Factory says
//   no word of carries no status (the grid says "State not disclosed" rather than guess).
// - columns: the batch rows, `batch:<n>` for the n-th task of every session, with one trailing row so each session has its empty
//   soft-stop slot, never fewer than the shipped four (the grid's Main column).
// - ruler: seconds from the start of the one shared axis (an hour ending now, `sharedAxis`), labelled with the clock. A task
//   stands where it ran: from its start (the axis edge when no start is disclosed) to its last output — so a stalled task is
//   frozen where its output stopped and a running one reaches its needle, which is its live edge — and a queued task is a point
//   at the live edge with no length at all. A task with no disclosed state has no place on the ruler. A session's needle stands at
//   its last activity; one with no activity in the window has none.
// - actions: only through the owner the agent shell already uses — `harness_agent_control` on the bound harness. The owner takes
//   a binding and a control word, never a task, a row, a session or an agent, so the grain of every action is the whole harness
//   and each op leads with it (FACTORY_GRAIN), as does each receipt: a Stop pressed on one track says it stopped the harness, a
//   Retry says it restarted the harness's stalled task, a seat says it started a NEW agent and names the one dragged. The mockup
//   draws these per session (agent-shell-mockup.html:625); that needs a per-session owner op, which does not exist. No controls
//   handed in (no carrier, no resolved binding), no actions: the grid stays read-only. One act is finer: a track's Stop, where
//   `sessionStop` is handed in, cancels that session's running turn on its own encounter owner (`encounter` cancel, as the
//   Thread's Hard stop does), and its control says no grain; Stop All stays the harness's.
// - takes (attempts): each Software Factory attempt a session's bound task serves is a take lane under its track (agent/factoryTakes.ts:
//   AIKit says which attempts the task serves, Factory says what each is), laid on the ruler from its admission to its Return or
//   failure, a running one reaching the live edge. The take that stands is the one whose Return Central has received, and the main
//   lane shows it. Choosing a take is Factory's own op, the comp action: the attempt's Return proposed to Central's receiving field
//   (`factory_owner` attempt-receiving); Factory receives a whole attempt, so a stretch dragged across a take chooses the take and
//   copies no part of it. The same attempts stack under the task's clip (`takes`), matched by the task_ref they serve.
// - launch (W4): how a task plays once launched, what follows it and when a launch lands are its own settings on AIKit
//   (`encounter-session-settings` `task`: launch, then, quantize — its defaults stated), read with the session's Telemetry
//   and Solo and carried only onto the task whose task_ref they name. Factory reads no expected length for a task, so no clip carries
//   progress.
// - R3 (manual §19.1 "The mixer row", §16.6): each session's mixer row — Monitor is Watch (In · Auto · Off), the activator is
//   Telemetry, Solo, and Arm, which is the shell's one write arm (`shell.setWriteArm`, the transport's own; its light is the flag
//   the shell moves only when the owner accepts); the way in is the Gateway and the way out the landing, routes not settings. The
//   Main track holds the gateways, the Experiment, Approvals, the Ledger and the Link; Stop All is the harness's stop. Under each
//   session its event lanes, one per kind of event the temporal stream gives for it (agent/agentRunModel.ts eventsForSession),
//   each event where it happened on the run's ruler. Telemetry and Solo are the session's own settings on their owner (AIKit
//   `encounter-session-settings`, read for every track at once and written one session at a time, against the revision that
//   stands); Watch has no owner op, the attempts (takes) and the effort over a run (automation) no owner reading: each stands
//   disabled or absent with the op it lacks.
// - status: done → done (manual §19.1: Done is "dim and settled"; Stopped is ready, in full colour).
//
// Pure TypeScript. No React.
import {AGENT_CHAIN_MIME, decodeChainDrag} from '../agent/agentChainDrag'
import {takeNames, takeWords, type FactoryTake} from '../agent/factoryTakes'
import {eventsForSession, sharedAxis, trackKey, type AgentSessionTrack, type TaskClip, type TaskState, type TemporalEventLike} from '../agent/agentRunModel'
import type {
  ClipLaunch,
  ClipStatus,
  WorldCompStretch,
  WorldEventLane,
  WorldMixer,
  WorldTakeLane,
  WorldTrack,
  WorldTrackActions,
  WorldTrackAdapter,
  WorldTrackClip,
  WorldTrackColumn,
  WorldTrackLanes,
  WorldTrackSet,
} from './worldTrackAdapter'

export const FACTORY_TRACK_ADAPTER_ID = 'factory-session-tracks'

/** The grid's track colours, by position (agent/AgentSessionGrid.tsx:55). */
export const FACTORY_TRACK_PALETTE = ['#79b6ce', '#779dcc', '#9885bc', '#8baf9c', '#b096b2', '#6caaa9'] as const
/** The shipped batch-row count (agent/AgentSessionGrid.tsx:59-61, the Main column's rows). */
export const FACTORY_MIN_BATCH_ROWS = 4

/** The control words `harness_agent_control` takes that a track's actions use (agent/harnessAgentControl.ts:4). */
export type FactoryControl = 'stop' | 'restart' | 'resume' | 'new'
/** The owner's answer, verbatim in shape from `harnessAgentControl`: a one-line note, or the refusal. */
export type FactoryControlReceipt = {ok: true; note: string; document?: unknown} | {ok: false; error: string}
/** The one owner call: `harness_agent_control` on the bound harness. Handed in by whoever holds the carrier and the binding. */
export interface FactoryControls {
  control(control: FactoryControl): Promise<FactoryControlReceipt>
}

/** The grain every action here takes: the owner addresses the bound harness, never one session, task, row or agent. */
export const FACTORY_GRAIN = 'whole harness'

/** The ops the actions name, each leading with its grain (the grid prints an op in the control's title). */
export const FACTORY_STOP_OP = `${FACTORY_GRAIN} · harness_agent_control:stop — the bound harness's conversation; the owner takes no session, so this is not a stop of this track alone`
export const FACTORY_STOP_ALL_OP = `${FACTORY_GRAIN} · harness_agent_control:stop — Stop All: the bound harness's conversation, the one the owner reaches`
export const FACTORY_LAUNCH_OP = `${FACTORY_GRAIN} · harness_agent_control:restart (a stalled task) · resume (a queued one) — the bound harness's conversation; the owner takes no task`
export const FACTORY_SEAT_OP = 'harness_agent_control:new — starts a NEW agent conversation on the bound harness; the agent dropped is named in the receipt, not sent (the owner takes no agent ref)'
export const FACTORY_RETRY_OP = `${FACTORY_GRAIN} · harness_agent_control:restart — the bound harness's stalled task, from its last good step; the owner takes no session`
export const FACTORY_BATCH_OP = `${FACTORY_GRAIN} · harness_agent_control:resume — the bound harness's queued tasks; the owner takes no row`

/** A session's current task's own settings as AIKit states them (`encounter-session-settings` `task`, its defaults stated: launch trigger,
 * then next, quantize global): how it plays once launched, what follows it on its own track, and when a launch lands. */
export interface FactoryTaskSettings {
  task_ref: string
  launch: string
  then: string
  quantize: string
}

/** The sessions' own settings (AIKit `encounter-session-settings`): each session's Telemetry and Solo as its owner states them
 * (absent while unread), its current task's settings where the reading names a task (`task`; absent or null: none read), and the
 * write of one, which answers with the owner's reading or its refusal. */
export interface FactorySettingsPort {
  of(sessionRef: string): {telemetry: boolean; solo: boolean; task?: FactoryTaskSettings | null} | null
  set(sessionRef: string, setting: 'telemetry' | 'solo', on: boolean): Promise<unknown>
}

/** A task's launch in the owner's words (manual §3: launch quantize and follow actions; the design's mode): the mode as AIKit names
 * it, the follow as its `then`, the quantize as its word with spaces. */
export function factoryTaskLaunch(task: FactoryTaskSettings): ClipLaunch {
  const follow = task.then
  return {...(task.launch ? {mode: task.launch} : {}), ...(follow ? {follow} : {}), ...(task.quantize ? {quantize: task.quantize.replace(/-/g, ' ')} : {})}
}

/** The sessions' attempts as takes (agent/factoryTakes.ts): a session's takes as its owners state them (null while unread, empty
 * when its task serves none), and the choice of one, which answers with the owner's receipt in words or its refusal. */
export interface FactoryTakesPort {
  of(sessionRef: string): readonly FactoryTake[] | null
  choose(take: FactoryTake): Promise<unknown>
}

/** The op the comp names: choosing an attempt, which the owner does whole. */
export const FACTORY_CHOOSE_OP = 'factory_owner attempt-receiving — the attempt\'s Return proposed to Central\'s receiving field, in the Flow its Run is associated with; Factory receives a whole attempt, so the stretch dragged chooses the take and copies no part of it'

/** The ops the mixer's settings name. */
export const FACTORY_SESSION_STOP_OP = 'encounter cancel — this session\'s running turn, on its own resident owner; the session stays and the harness\'s other sessions run on'
export const FACTORY_TELEMETRY_OP = 'encounter_session_settings {track: {telemetry}} — the session\'s own Telemetry on AIKit, against the revision that stands'
export const FACTORY_SOLO_OP = 'encounter_session_settings {track: {solo}} — the session\'s own Solo on AIKit, against the revision that stands'

/** The shell's one write arm (the transport's `shell.setWriteArm`, agent/shellSetterBridge.ts): its flag, which moves only when
 * the owner accepts (null when no shell holds one), and its dispatch, which answers with the owner's receipt or refusal. */
export interface FactoryWriteArm {
  on: boolean | null
  set(on: boolean): Promise<unknown>
}

export interface FactorySessionsReading {
  /** The agency tracks with their tasks and needles (agent/useAgencySessions.ts). */
  tracks: readonly AgentSessionTrack[]
  /** The clock the shared axis ends at when no needle carries one. */
  nowUnixMs: number
  /** The owner call for the actions; absent, the set has no actions. */
  controls?: FactoryControls
  /** The temporal events the sessions provider holds (AgentSessionsProvider `events`): each session's event lanes. Absent: unread. */
  events?: readonly TemporalEventLike[]
  /** The shell's write arm, for every session's Arm. Absent: no shell holds one, and Arm stands disabled. */
  writeArm?: FactoryWriteArm
  /** The sessions' own settings, for every session's Telemetry and Solo. Absent: unread here, and both stand disabled. */
  settings?: FactorySettingsPort
  /** The sessions' attempts as takes. Absent: unread here, and the take lanes stand absent with that reason. */
  takes?: FactoryTakesPort
  /** Stop one session: cancel its running turn on its own encounter owner. Absent: a track's Stop is the harness's. */
  sessionStop?: (sessionRef: string) => Promise<FactoryControlReceipt>
  /** Make a Repeat's takes (agent/sessionSettings.ts makeTakes): the session's task's set of takes, through Actuation's comparison run.
   * Absent: a Repeat's press says what it waits for (FACTORY_REPEAT_ABSENT). */
  repeat?: (sessionRef: string, label: string) => Promise<FactoryControlReceipt>
}

/** Why a Repeat's press makes no takes where no port is handed. */
export const FACTORY_REPEAT_ABSENT = 'Repeat makes its takes through Actuation\'s comparison run (kernel actuation_write comparison-run), and no carrier reaches it here.'

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`

/** Factory's mixer row (manual §19.1), each control's meaning in the manual's words. */
export const FACTORY_MIXER: WorldMixer = {
  activator: {meaning: 'Telemetry: on, the session feeds the widgets, the Ledger and other agents; off, it is muted — it keeps working, in silence, and stops sending to the tiles',
    disabled: missing('Telemetry', 'harness_agent_control {binding, control: "telemetry", session_ref, on: bool} → {ok, note} | {ok: false, error}; agency_read rows report `telemetry: bool` (the shell\'s flag is its own, never the owner\'s)', 'Actuation')},
  solo: {meaning: 'Only soloed sessions may run',
    disabled: missing('Solo', 'harness_agent_control {binding, control: "solo", session_ref, on: bool} — pauses every other session of the harness; agency_read rows report `solo: bool`', 'Actuation')},
  arm: {meaning: 'Lets the session\'s agent write directly, with receipts, where Scope allows; off, every write is a proposal. Arm and press Record to speak a new task onto it',
    grain: 'the shell\'s one write arm: arming one session arms every one'},
  monitor: {meaning: 'Watch: In streams the session into the widgets always; Auto streams it when it is armed or selected; Off does not stream it',
    disabled: missing('Watch', 'shell.setSessionWatch(sessionRef, "in" | "auto" | "off") — a per-session watch the widgets read (the Run device holds one Watch for its chain)', 'shell')},
  input: {meaning: 'The way in: the Gateway at the head of the chain decides what the agent must ask your permission for', route: 'Gateway'},
  output: {meaning: 'The way out: the landing at the end of the chain — commits, and a request to merge with the checks that tested it', route: 'Landing'},
}

/** Factory's Main track (manual §19.1): what works on the whole run. */
export const FACTORY_MAIN_CHAIN = ['Gateways', 'Experiment', 'Approvals', 'Ledger', 'Link'] as const

/** Why the lanes the owners do not give are absent, in their terms. */
export const FACTORY_LANES_ABSENT = {
  takes: 'The attempts are unread here: the sessions\' served attempts (AIKit encounter_task_attempts_list) and the Runs that hold them (factory_attempt_read) arrive when the shell publishes a kernel carrier.',
  automation: missing('The Agent\'s effort over a run', 'a recorded automation of the Agent\'s effort per session — harness_agent_control {binding, control: "configure", effort} carries one value, and no owner keeps its moves over time', 'Actuation'),
  events: 'The temporal stream gives each session\'s events by their kind (run, return, generation …): those kinds are the lanes. Messages, Files, Terminal and Pages read are not kinds it names — missing op: temporal_events_read rows with `lane: "messages" | "files" | "terminal" | "pages"` for a session\'s tool runs (Actuation · kernel).',
} as const

/** Why a take lane is absent when the attempts were read and none is served. */
export const FACTORY_NO_ATTEMPTS = 'No session\'s task serves a Factory attempt yet: Factory records each attempt it dispatches on the session\'s AIKit task.'

const TASK_MARK = '#task/'
const BATCH_PREFIX = 'batch:'

/** A task clip's id: its session's track id and its ordinal in that session. */
export const factoryTaskRef = (trackId: string, n: number): string => `${trackId}${TASK_MARK}${n}`

/** The session track id and ordinal a task clip id names; null for anything else. */
export function parseFactoryTaskRef(ref: string): {trackId: string; n: number} | null {
  const at = ref.lastIndexOf(TASK_MARK)
  if (at <= 0) return null
  const n = Number(ref.slice(at + TASK_MARK.length))
  return Number.isSafeInteger(n) && n >= 1 ? {trackId: ref.slice(0, at), n} : null
}

// Stopped: "Ready, in full colour" (DLW §19.1) — Factory's word for a task whose session AIKit reports closed (agent/taskActivity.ts).
const STATUS: Record<TaskState, ClipStatus | undefined> = {queued: 'waiting', running: 'running', done: 'done', stalled: 'stalled', stopped: 'stopped', unknown: undefined}

/** The header the grid draws (agent/AgentSessionGrid.tsx:67-70). */
const trackName = (track: AgentSessionTrack): string =>
  track.purpose ?? (track.group
    ? track.spaceLabel ?? track.spaceRef
    : track.agentName ? `${track.agentName} · ${track.sessionRef.slice(0, 10)}` : track.sessionRef.slice(0, 12))

/** The groups above a track, outermost first (agent/AgentSessionGrid.tsx:101-111; a cycle in the parent links ends the walk). */
function ancestorsOf(tracks: readonly AgentSessionTrack[], track: AgentSessionTrack): AgentSessionTrack[] {
  const out: AgentSessionTrack[] = []
  const seen = new Set([trackKey(track)])
  let ref = track.parentRef
  while (ref) {
    const parent = tracks.find(item => item.group && item.spaceRef === ref)
    if (!parent || seen.has(trackKey(parent))) break
    seen.add(trackKey(parent))
    out.unshift(parent)
    ref = parent.parentRef
  }
  return out
}

const refused = (error: string): Promise<FactoryControlReceipt> => Promise.resolve({ok: false, error})

/** A session's event lanes: one per kind of event the temporal stream gives for it, each event at its instant on the run's ruler.
 * An event with no instant has no place on the ruler and is left out; a kind with none placed has no lane. */
export function factoryEventLanes(trackId: string, sessionRef: string, events: readonly TemporalEventLike[], secs: (unixMs: number) => number): WorldEventLane[] {
  const byKind = new Map<string, WorldEventLane['events'][number][]>()
  eventsForSession([...events], sessionRef).forEach((event, index) => {
    if (typeof event.instant_unix_ms !== 'number' || !Number.isFinite(event.instant_unix_ms)) return
    const kind = event.kind ?? event.stream ?? 'event'
    const list = byKind.get(kind) ?? []
    list.push({id: `${trackId}#event/${index}`, at: secs(event.instant_unix_ms), label: event.summary || kind, ...(event.stream ? {detail: `${event.stream} · ${kind}`} : {}), ref: event.subject_ref})
    byKind.set(kind, list)
  })
  return [...byKind].map(([kind, list]) => ({id: `${trackId}#events/${kind}`, trackId, kind, name: kind, events: list}))
}

/** The owner's answer with the grain said first. The control was pressed on one session, task or row, but the owner takes none of
 * them, so what it reached is the bound harness; the receipt (the grid prints it where the press was) says that, then the owner's
 * own words. */
function atWholeHarness(answer: Promise<FactoryControlReceipt>, pressed: string): Promise<FactoryControlReceipt> {
  return answer.then(receipt => {
    const said = `Whole harness: ${pressed} reached the bound harness, because the owner takes no session, task or row.`
    return receipt.ok ? {...receipt, note: `${said} ${receipt.note}`} : {...receipt, error: `${said} ${receipt.error}`}
  })
}

/** The actions the owner gives, over the set's own ids: an id the set does not hold is refused before any owner call. Every one
 * reaches the whole harness (FACTORY_GRAIN) and its receipt says so. */
function actionsFor(controls: FactoryControls, tracks: readonly WorldTrack[], clips: readonly WorldTrackClip[], columns: readonly WorldTrackColumn[]): WorldTrackActions {
  const trackById = new Map(tracks.map(track => [track.id, track]))
  const columnById = new Map(columns.map(column => [column.id, column]))
  const clipById = new Map(clips.map(clip => [clip.id, clip]))
  return {
    grain: FACTORY_GRAIN,
    // The Main track's Stop All (Live cap 41): the bound harness's stop, which is every session the owner can reach.
    stopAll: {op: FACTORY_STOP_ALL_OP, run: () => atWholeHarness(controls.control('stop'), 'Stop All')},
    stopTrack: {op: FACTORY_STOP_OP, run: trackId => {
      const track = trackById.get(trackId)
      return track ? atWholeHarness(controls.control('stop'), `Stop on “${track.name}”`) : refused(`"${trackId}" is not a session of this work.`)
    }},
    launch: {op: FACTORY_LAUNCH_OP, run: clipId => {
      const clip = clipById.get(clipId)
      if (!clip) return refused(`"${clipId}" is not a task of this work.`)
      const pressed = `Launch of “${clip.label}”`
      if (clip.status === 'stalled') return atWholeHarness(controls.control('restart'), pressed)
      if (clip.status === 'waiting') return atWholeHarness(controls.control('resume'), pressed)
      const word = clip.status === 'done' ? 'finished' : clip.status ?? 'in a state its owner does not disclose'
      return refused(`${clip.label} is ${word}: the owner has no op that launches a task in that state.`)
    }},
    launchStop: {op: FACTORY_BATCH_OP, run: columnId => {
      const column = columnById.get(columnId)
      return column ? atWholeHarness(controls.control('resume'), `Launch of row ${column.name || column.id}`) : refused(`"${columnId}" is not a batch row of this work.`)
    }},
    // A stalled lane lights its retry (manual §6); the owner restarts the bound harness's stalled task.
    retry: {op: FACTORY_RETRY_OP, run: trackId => {
      const track = trackById.get(trackId)
      return track ? atWholeHarness(controls.control('restart'), `Retry on “${track.name}”`) : refused(`"${trackId}" is not a session of this work.`)
    }},
    // An agent dropped on the empty track starts a NEW agent on the bound harness, as the agent chain's own drop does
    // (agent/agentChainDrag.ts chainDropDecision). `harness_agent_control` carries a binding and a control word and no agent ref
    // (agent/harnessAgentControl.ts), so the dragged agent is not seated: it is named in the receipt and the harness is not told
    // which agent it was.
    seat: {op: FACTORY_SEAT_OP, accepts: AGENT_CHAIN_MIME, run: payload => {
      const dropped = decodeChainDrag(payload)
      if (dropped?.kind !== 'chain-item' || dropped.drag.family !== 'agent') return refused('Only an agent starts on a track; drop a session, skillset or seat on the agent chain.')
      const dragged = `“${dropped.drag.label}” (${dropped.drag.ref})`
      return controls.control('new').then((receipt): FactoryControlReceipt => receipt.ok
        ? {...receipt, note: `Dragged ${dragged}: started a NEW agent on the bound harness. The harness was not told which agent, because harness_agent_control carries no agent ref. ${receipt.note}`}
        : {...receipt, error: `Dragged ${dragged}: the owner did not start a new agent on the bound harness (no agent was seated). ${receipt.error}`})
    }},
  }
}

/** A task's launch played by its Launch mode (manual §19.1 The Launch panel): "Trigger starts the task when you press its launch. Gate
 * runs it only while you hold the launch. Toggle starts it with one press and stops it with the next. Repeat launches it again at each
 * quantize step while you hold the launch, each run a take of its own." A launch is the harness's, as it always was (FACTORY_LAUNCH_OP);
 * a stop is the session's own (`sessionStop`, its running turn cancelled), else the harness's. Gate's release stops what its press
 * launched, and only a launch the owner took; Toggle's press on a running task stops it; Repeat makes its takes through the `repeat`
 * port; Trigger, and a task whose mode no reading names, launches as it always did. */
/** The launch each Gate's press made, by its clip, kept until its release: only a launch the owner took is stopped when it is let go. The
 * grid projects a new set on every render (the press's own receipt is one cause), so the press and its release can reach two sets. */
const GATE_HELD = new Map<string, Promise<unknown>>()

function launchByMode(launch: {op: string; run(clipId: string): unknown}, clips: readonly WorldTrackClip[], sessionOf: ReadonlyMap<string, string>,
  controls: FactoryControls, sessionStop: FactorySessionsReading['sessionStop'], repeat: FactorySessionsReading['repeat']): NonNullable<WorldTrackActions['launch']> {
  const clipById = new Map(clips.map(clip => [clip.id, clip]))
  const held = GATE_HELD
  const stop = (clip: WorldTrackClip, pressed: string): Promise<FactoryControlReceipt> => {
    const session = sessionOf.get(clip.trackId)
    if (sessionStop && session) return sessionStop(session).then(receipt => receipt.ok
      ? {...receipt, note: `${pressed} stopped this session's running turn. ${receipt.note}`} : {...receipt, error: `${pressed}: ${receipt.error}`})
    return atWholeHarness(controls.control('stop'), pressed)
  }
  return {
    op: launch.op,
    run: clipId => {
      const clip = clipById.get(clipId)
      const mode = clip?.launch?.mode
      if (!clip || !mode || mode === 'trigger') return launch.run(clipId)
      if (mode === 'toggle' && clip.status === 'running') return stop(clip, `Toggle's second press on “${clip.label}”`)
      if (mode === 'repeat') {
        const session = sessionOf.get(clip.trackId)
        if (!repeat || !session) return refused(`${clip.label} is launched with Repeat: ${FACTORY_REPEAT_ABSENT}`)
        return repeat(session, clip.label)
      }
      const answer = Promise.resolve(launch.run(clipId))
      if (mode === 'gate') held.set(clipId, answer)
      return answer
    },
    release: clipId => {
      const clip = clipById.get(clipId)
      const pressed = held.get(clipId)
      held.delete(clipId)
      if (!clip || clip.launch?.mode !== 'gate' || !pressed) return undefined
      return pressed.then((receipt): Promise<FactoryControlReceipt> | FactoryControlReceipt => (receipt as FactoryControlReceipt | undefined)?.ok
        ? stop(clip, `Gate's release on “${clip.label}”`)
        : {ok: false, error: `${clip.label}'s launch was not taken, so its release stops nothing.`})
    },
  }
}

export const factoryTrackAdapter: WorldTrackAdapter<FactorySessionsReading> = {
  id: FACTORY_TRACK_ADAPTER_ID,
  project(reading): WorldTrackSet {
    const {tracks: agency, nowUnixMs, controls} = reading
    if (!agency.length) return {columns: [], tracks: [], clips: []}
    // The one shared axis: the provider's own (every needle carries it), else an hour ending now.
    const needled = agency.find(track => track.needle)?.needle
    const axis = needled ? {startUnixMs: needled.axisStartUnixMs, endUnixMs: needled.axisEndUnixMs} : sharedAxis(agency, nowUnixMs)
    // Seconds from the axis start, held inside the window as the run viewer holds a point (agent/AgentArrangementView.tsx:39).
    const secs = (unixMs: number): number => (Math.min(Math.max(unixMs, axis.startUnixMs), axis.endUnixMs) - axis.startUnixMs) / 1000

    const tracks: WorldTrack[] = agency.map((track, index) => {
      const ancestors = ancestorsOf(agency, track)
      const parent = ancestors[ancestors.length - 1]
      const at = track.needle?.atUnixMs
      return {
        id: trackKey(track),
        name: trackName(track),
        color: FACTORY_TRACK_PALETTE[index % FACTORY_TRACK_PALETTE.length],
        kind: track.group ? 'group' : 'session',
        depth: ancestors.length,
        ...(parent ? {parentId: trackKey(parent)} : {}),
        ...(typeof at === 'number' ? {needle: secs(at)} : {}),
        ...(track.needle?.state === 'stalled' ? {stalled: true} : {}),
      }
    })

    const realTasks = (track: AgentSessionTrack): TaskClip[] => track.group ? [] : track.tasks.filter(clip => !clip.softStop)
    const rowCount = Math.max(FACTORY_MIN_BATCH_ROWS, ...agency.flatMap(realTasks).map(task => task.n + 1))
    const columns: WorldTrackColumn[] = Array.from({length: rowCount}, (_, i) => ({id: `${BATCH_PREFIX}${i + 1}`, name: String(i + 1)}))

    const clips: WorldTrackClip[] = []
    for (const track of agency) {
      const trackId = trackKey(track)
      for (const task of realTasks(track)) {
        const status = STATUS[task.state]
        const start = task.startUnixMs !== null ? secs(task.startUnixMs) : 0
        const end = task.lastActivityUnixMs !== null ? Math.max(start, secs(task.lastActivityUnixMs)) : start
        const at = task.state === 'queued' ? {start: secs(axis.endUnixMs)}
          : task.state === 'unknown' ? undefined
          : {start, end}
        // W4: a task's own launch and its attempts, each read under its task_ref — the settings AIKit states for the session's current
        // task (only when that task is this one), and the attempts the task serves (agent/factoryTakes.ts `taskRef`), named as their
        // take lanes are and standing where Central received the Return. A task no reading names carries neither. Factory reads no
        // expected length for a task, so a running one carries no progress.
        const own = task.taskRef ? reading.settings?.of(track.sessionRef)?.task : undefined
        const launch = own && own.task_ref === task.taskRef ? factoryTaskLaunch(own) : undefined
        const attempts = task.taskRef ? reading.takes?.of(track.sessionRef) ?? [] : []
        const names = takeNames(attempts)
        const takes = attempts.filter(take => take.taskRef === task.taskRef)
          .map(take => ({id: `${trackId}#take/${take.attemptRef}`, name: names.get(take.attemptRef) ?? 'take', ...(take.receivingRef ? {standing: true} : {})}))
        clips.push({
          id: factoryTaskRef(trackId, task.n),
          trackId,
          columnId: `${BATCH_PREFIX}${task.n}`,
          label: task.title ?? `task ${task.n}`,
          state: task.state,
          ...(status ? {status} : {}),
          ...(at ? {at} : {}),
          ...(task.disclosure ? {note: task.disclosure} : {}),
          ...(launch && Object.keys(launch).length ? {launch} : {}),
          ...(takes.length ? {takes} : {}),
        })
      }
    }

    const set: WorldTrackSet = {
      columns, tracks, clips,
      // The run viewer's fixed window: the hour ending now, with now at its edge (agent/AgentArrangementView.tsx:39, :200).
      ruler: {unit: 'seconds', label: at => new Date(axis.startUnixMs + at * 1000).toTimeString().slice(0, 8),
        end: secs(axis.endUnixMs), now: secs(axis.endUnixMs), duration: span => `${Math.floor(span / 60)}m ${String(Math.floor(span % 60)).padStart(2, '0')}s`},
    }
    // R3: the mixer row, the Main track and the lanes.
    set.mixer = FACTORY_MIXER
    set.main = {name: 'Main', chain: FACTORY_MAIN_CHAIN}
    const arm = reading.writeArm
    if (arm && arm.on !== null) for (const track of tracks) track.mix = {arm: arm.on}
    // Telemetry and Solo: each session's own settings, as the owner states them; a session unread draws them unread.
    const port = reading.settings
    const sessionOf: Map<string, string> = new Map(agency.filter(track => !track.group).map(track => [trackKey(track), track.sessionRef]))
    if (port) {
      for (const track of tracks) {
        const session = sessionOf.get(track.id)
        const own = session ? port.of(session) : null
        if (own) track.mix = {...track.mix, activator: own.telemetry, solo: own.solo}
      }
      const {disabled: _telemetry, ...activator} = FACTORY_MIXER.activator!
      const {disabled: _solo, ...solo} = FACTORY_MIXER.solo!
      set.mixer = {...FACTORY_MIXER, activator, solo}
    }
    const events = reading.events
      ? agency.flatMap(track => track.group ? [] : factoryEventLanes(trackKey(track), track.sessionRef, reading.events!, secs))
      : []
    // The takes: a lane for each attempt a session's task serves, the one that stands marked and shown on the main lane.
    const takePort = reading.takes
    const takeOfLane = new Map<string, FactoryTake>()
    const takeLanes: WorldTakeLane[] = []
    const comp: WorldCompStretch[] = []
    if (takePort) {
      for (const track of agency) {
        if (track.group) continue
        const trackId = trackKey(track)
        const takes = takePort.of(track.sessionRef) ?? []
        const names = takeNames(takes)
        for (const take of takes) {
          // Where it ran: from its admission to its Return or failure, a running one to the live edge. An attempt whose owner
          // disclosed no admission time has no place on the ruler (its lane stands with no stretch).
          const start = take.startUnixMs !== null ? secs(take.startUnixMs) : null
          const end = start === null ? null : take.endUnixMs !== null ? Math.max(start, secs(take.endUnixMs)) : take.state === 'running' ? secs(axis.endUnixMs) : start
          const id = `${trackId}#take/${take.attemptRef}`
          const name = names.get(take.attemptRef) ?? 'take'
          takeOfLane.set(id, take)
          takeLanes.push({id, trackId, name, spans: start === null || end === null ? [] : [{start, end, label: takeWords(take)}], ...(take.receivingRef ? {standing: true} : {})})
          if (take.receivingRef && start !== null && end !== null) comp.push({trackId, takeId: id, start, end})
        }
      }
    }
    const absent: NonNullable<WorldTrackLanes['absent']> = {...FACTORY_LANES_ABSENT, ...(reading.events ? {} : {events: 'The temporal events are unread here: the sessions provider is not mounted above this pane.'})}
    if (takePort && takeLanes.length) delete absent.takes
    else if (takePort) absent.takes = FACTORY_NO_ATTEMPTS
    set.lanes = {events, ...(takePort ? {takes: takeLanes, comp} : {}), absent}
    if (controls) set.actions = actionsFor(controls, tracks, clips, columns)
    // Choosing a take: the comp action, through the attempt's owner. An id the set does not hold is refused before any owner call.
    if (takePort) {
      set.actions = {...set.actions, comp: {op: FACTORY_CHOOSE_OP, run: (_trackId, takeId) => {
        const take = takeOfLane.get(takeId)
        return take ? takePort.choose(take) : refused(`"${takeId}" is not an attempt of this work.`)
      }}}
    }
    if (arm) set.actions = {...set.actions, mixer: {arm: {op: 'shell.setWriteArm — the shell\'s one write arm (agent/shellSetterBridge.ts): its receipt names the owner that enforces it', run: (_trackId, on) => arm.set(on)}}}
    // A track's Stop is that session's own: its running turn cancelled on its encounter owner (Stop All stays the harness's).
    const sessionStop = reading.sessionStop
    if (sessionStop) set.actions = {...set.actions, stopTrack: {op: FACTORY_SESSION_STOP_OP, grain: null, run: trackId => {
      const session = sessionOf.get(trackId)
      return session ? sessionStop(session) : refused(`"${trackId}" is not a session of this work.`)
    }}}
    const launch = set.actions?.launch
    if (launch && controls) set.actions = {...set.actions, launch: launchByMode(launch, clips, sessionOf, controls, sessionStop, reading.repeat)}
    if (port) {
      const own = (setting: 'telemetry' | 'solo') => (trackId: string, on: boolean) => {
        const session = sessionOf.get(trackId)
        return session ? port.set(session, setting, on) : Promise.resolve({ok: false, error: `"${trackId}" is not a session of this work.`})
      }
      set.actions = {...set.actions, mixer: {...set.actions?.mixer, activator: {op: FACTORY_TELEMETRY_OP, run: own('telemetry')}, solo: {op: FACTORY_SOLO_OP, run: own('solo')}}}
    }
    return set
  },
}
