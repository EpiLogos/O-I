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
// - status: queued → waiting, running → running, done → stopped, stalled → stalled; a task whose owner and temporal stream say
//   nothing carries no status (the grid says "State not disclosed" rather than guess).
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
//   handed in (no carrier, no resolved binding), no actions: the grid stays read-only.
// - takes (attempts) are absent: the attempts owner (`factory_attempt_read`) is addressed by run, and the sessions reading names
//   none. Launch quantize and follow are absent: the armed timing is shell state, not a reading of the task.
//
// Pure TypeScript. No React.
import {AGENT_CHAIN_MIME, decodeChainDrag} from '../agent/agentChainDrag'
import {sharedAxis, trackKey, type AgentSessionTrack, type TaskClip, type TaskState} from '../agent/agentRunModel'
import type {
  ClipStatus,
  WorldTrack,
  WorldTrackActions,
  WorldTrackAdapter,
  WorldTrackClip,
  WorldTrackColumn,
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
export const FACTORY_LAUNCH_OP = `${FACTORY_GRAIN} · harness_agent_control:restart (a stalled task) · resume (a queued one) — the bound harness's conversation; the owner takes no task`
export const FACTORY_SEAT_OP = 'harness_agent_control:new — starts a NEW agent conversation on the bound harness; the agent dropped is named in the receipt, not sent (the owner takes no agent ref)'
export const FACTORY_RETRY_OP = `${FACTORY_GRAIN} · harness_agent_control:restart — the bound harness's stalled task, from its last good step; the owner takes no session`
export const FACTORY_BATCH_OP = `${FACTORY_GRAIN} · harness_agent_control:resume — the bound harness's queued tasks; the owner takes no row`

export interface FactorySessionsReading {
  /** The agency tracks with their tasks and needles (agent/useAgencySessions.ts). */
  tracks: readonly AgentSessionTrack[]
  /** The clock the shared axis ends at when no needle carries one. */
  nowUnixMs: number
  /** The owner call for the actions; absent, the set has no actions. */
  controls?: FactoryControls
}

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

const STATUS: Record<TaskState, ClipStatus | undefined> = {queued: 'waiting', running: 'running', done: 'stopped', stalled: 'stalled', unknown: undefined}

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
      const word = clip.status === 'stopped' ? 'finished' : clip.status ?? 'in a state its owner does not disclose'
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

export const factoryTrackAdapter: WorldTrackAdapter<FactorySessionsReading> = {
  id: FACTORY_TRACK_ADAPTER_ID,
  project({tracks: agency, nowUnixMs, controls}): WorldTrackSet {
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
        clips.push({
          id: factoryTaskRef(trackId, task.n),
          trackId,
          columnId: `${BATCH_PREFIX}${task.n}`,
          label: task.title ?? `task ${task.n}`,
          state: task.state,
          ...(status ? {status} : {}),
          ...(at ? {at} : {}),
          ...(task.disclosure ? {note: task.disclosure} : {}),
        })
      }
    }

    const set: WorldTrackSet = {
      columns, tracks, clips,
      // The run viewer's fixed window: the hour ending now, with now at its edge (agent/AgentArrangementView.tsx:39, :200).
      ruler: {unit: 'seconds', label: at => new Date(axis.startUnixMs + at * 1000).toTimeString().slice(0, 8),
        end: secs(axis.endUnixMs), now: secs(axis.endUnixMs), duration: span => `${Math.floor(span / 60)}m ${String(Math.floor(span % 60)).padStart(2, '0')}s`},
    }
    if (controls) set.actions = actionsFor(controls, tracks, clips, columns)
    return set
  },
}
