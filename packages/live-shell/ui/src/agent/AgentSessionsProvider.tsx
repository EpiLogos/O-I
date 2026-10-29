import {createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode} from 'react'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {useWorkspace} from '../shell/workspaceContext'
import {
  buildTaskClips,
  buildTracks,
  needleFor,
  sharedAxis,
  type AgentSessionTrack,
  type RosterEntry,
  type TemporalEventLike,
} from './agentRunModel'
import {budgetFromReading} from './useAgentMetrics'
import {useTemporalEvents} from './useTemporalEvents'
import {agencyFingerprint, createAgencyDriver, type AgencyDriver} from '../owners/agency'
import {taskReadingEntry, useWorldRosterAgents, useTaskEntries} from '../owners/readers'
import {tellOwnerChanged} from '../owners/notices'
import {projectOfSession, useWorldAgencyEntries, type WorldSessionRow} from './worldScope'
import {useTaskActivity, withTaskActivity} from './taskActivity'

export interface AgentSessionsValue {
  transport: KernelTransportStatus
  tracks: AgentSessionTrack[]
  /** Every session of the world: the root register's and each project's, each with the register it was read under (`project`). */
  rows: WorldSessionRow[]
  roster: Map<string, RosterEntry>
  /** Additive beyond the fixed contract: the arrangement readout renders the
   * latest event per thread, and this is the one reading it may use. */
  events: TemporalEventLike[]
  source: 'live' | 'unavailable'
  reason?: string
  error: string | null
  /** Additive: the roster read's own refusal, kept apart from the agency error. */
  rosterError: string | null
  /** Additive: the temporal read's own refusal. */
  temporalError: string | null
  loading: boolean
  refresh: () => void
  selectedSessionRef: string | null
  selectSession: (ref: string) => void
  /** Additive: the reading instant the tracks were built at — when the agency answer was read, never a later clock. */
  nowUnixMs: number
  /** Additive: the registers read (the root register '' first, then each project Central discloses) and each one's refusal. */
  scopes: readonly string[]
  refusals: readonly {project: string; error: string}[]
}

const Ctx = createContext<AgentSessionsValue | null>(null)

export function useAgentSessions(): AgentSessionsValue {
  const value = useContext(Ctx)
  if (!value) throw new Error('AgentSessionsProvider is not mounted above this view.')
  return value
}

export function useAgentSessionsOptional(): AgentSessionsValue | null {
  return useContext(Ctx)
}

/**
 * The ONE agency source for the agent shell, told rather than polled (owners/agency.ts): the agency answer is read on mount
 * and the spine's epoch, when the person comes back to the window, after the shell's own acts that change sessions (their
 * receipt), on a kernel receipt that can move it, and otherwise at a 30 s floor while the window is seen — never while it is
 * hidden. Each completed agency read re-reads the selected session's `encounter_task_read`, as the 3 s cadence did. The
 * roster is the shared roster answer (owners/readers.ts `useRosterAgents`), every session's task record the shared task
 * answers, each read once and shared with every other view that reads it. Temporal events are not read here: they are the
 * frame's one temporal read (timeline/temporalPoll.ts), which the World cut reads too — this provider takes its 24 h window
 * of it. Tracks are built here — group containers from spaces, members at depth 1, roster names joined, clips and needles from
 * the readings. Mount it once above every consumer (main.tsx); a nested mount passes through, so re-wiring a late consumer
 * never doubles the reading.
 */
export function AgentSessionsProvider({children}: {children: ReactNode}) {
  const parent = useContext(Ctx)
  if (parent) return <>{children}</>
  return <AgentSessionsSource>{children}</AgentSessionsSource>
}

function AgentSessionsSource({children}: {children: ReactNode}) {
  const {transport, receipts} = useWorkspace()
  // The world's agency: the root register and every project Central discloses (worldScope.ts), never one named project.
  const {scopes, entries, agency, epoch} = useWorldAgencyEntries(transport)
  const [selectedSessionRef, setSelectedSessionRef] = useState<string | null>(null)
  const selected = useRef(selectedSessionRef)
  selected.current = selectedSessionRef
  const placed = useRef<readonly WorldSessionRow[]>([])
  placed.current = agency.rows
  const {events, error: temporalError, refresh: refreshTemporal} = useTemporalEvents(transport)

  // One agency driver per register for the window, under this epoch: a new epoch, transport or register set is a new set of drivers.
  const drivers = useRef<AgencyDriver[]>([])
  useEffect(() => {
    if (transport.kind === 'unavailable' || !entries.length) return
    const created = entries.map(([project, entry]) => {
      let fingerprint: string | null = null
      return createAgencyDriver(entry, {
        epoch,
        onRead: (reading, cause) => {
          if (reading.status !== 'answered') return
          // The selected session's task record is re-read with its register's agency read, as the agency cadence always carried it.
          const session = selected.current
          const wanted = session && projectOfSession(placed.current, session) === project ? taskReadingEntry(transport, project, session) : null
          if (wanted && wanted.readers > 0) void wanted.refresh(epoch)
          // The sessions moved (one started, one ended): the run streams the temporal field reads moved with them.
          const next = agencyFingerprint(reading.value)
          if (fingerprint !== null && next !== fingerprint) tellOwnerChanged({topic: 'temporal', cause: `the agency reading moved (${cause})`})
          fingerprint = next
        },
      })
    })
    drivers.current = created
    return () => { for (const driver of created) driver.stop(); if (drivers.current === created) drivers.current = [] }
  }, [transport, entries, epoch])
  useEffect(() => { for (const driver of drivers.current) driver.observe(receipts) }, [receipts])

  const selectSession = useCallback((ref: string) => setSelectedSessionRef(ref), [])

  const rows = agency.rows
  const error = transport.kind === 'unavailable' ? transport.reason ?? 'Native transport unavailable' : agency.error
  const loading = transport.kind !== 'unavailable' && agency.loading
  // The instant the tracks are built at is the instant the agency answer was read: a needle never runs past its reading.
  const [mountedAt] = useState(() => Date.now())
  const nowUnixMs = agency.readAtUnixMs ?? mountedAt

  // The roster: the root register's and each of the world's projects', shared with every other roster reader.
  const projects = useMemo(() => (scopes ?? []).filter(scope => scope !== ''), [scopes])
  const rosterReading = useWorldRosterAgents(transport, projects, scopes !== null)
  const roster = useMemo(() => new Map<string, RosterEntry>(rosterReading.agents.map(agent => [agent.ref, {name: agent.name, accepted: agent.accepted}])), [rosterReading.agents])
  const rosterError = transport.kind === 'unavailable' ? null : rosterReading.state === 'error' ? rosterReading.error ?? 'The agent roster did not answer' : null

  // Every session's task record, each the shared answer read in the session's own register: read once when its session appears
  // (sequentially, so the bridge never sees a pile), then again when a notice reaches it. Without these the grid's clip slots would
  // read empty for every track but the selected one.
  const sessionRefs = useMemo(() => rows.map(row => row.sessionRef), [rows])
  const projectOf = useCallback((ref: string) => projectOfSession(placed.current, ref), [])
  const [taskRevision, bumpTasks] = useReducer((value: number) => value + 1, 0)
  useTaskEntries(transport, projectOf, sessionRefs, epoch, bumpTasks)
  const readings = useMemo(() => {
    const held: Record<string, unknown> = {}
    if (transport.kind === 'unavailable') return held
    for (const row of rows) {
      const standing = taskReadingEntry(transport, row.project, row.sessionRef).snapshot()
      if (standing.status === 'answered' && standing.epoch === epoch) held[row.sessionRef] = standing.value
    }
    return held
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, rows, epoch, taskRevision])

  const axis = useMemo(() => sharedAxis(events, nowUnixMs), [events, nowUnixMs])

  const read = useMemo(() => buildTracks(rows, roster, {nowUnixMs}).map(track => {
    if (track.group) return track
    const taskReading = readings[track.sessionRef] ?? null
    return {
      ...track,
      tasks: buildTaskClips(taskReading, events, track.sessionRef, nowUnixMs),
      needle: needleFor(events, track.sessionRef, axis),
      budget: budgetFromReading(taskReading),
    }
  }), [rows, roster, readings, events, nowUnixMs, axis])
  // How each task stands is Factory's reading of the owners' evidence (taskActivity.ts): AIKit's status of the session, its check-ins
  // and Factory's custody of the task. The tasks and needles above carry positions and spans; their state is Factory's alone.
  const activity = useTaskActivity(transport, read, events, projectOf, nowUnixMs)
  const tracks = useMemo(() => withTaskActivity(read, activity), [read, activity])

  // Auto-select the first real session so the dock and meters have a subject.
  useEffect(() => {
    if (selectedSessionRef) return
    const first = tracks.find(track => !track.group)
    if (first) setSelectedSessionRef(first.sessionRef)
  }, [tracks, selectedSessionRef])

  // The person's Retry: ask again whatever stands, a remembered refusal included — every register's agency.
  const retryRoster = rosterReading.retry
  const refresh = useCallback(() => {
    for (const [, entry] of entries) void entry.retry(epoch)
    retryRoster()
    if (selected.current && transport.kind !== 'unavailable') void taskReadingEntry(transport, projectOfSession(placed.current, selected.current), selected.current).retry(epoch)
    void refreshTemporal()
  }, [entries, retryRoster, transport, epoch, refreshTemporal])

  const value = useMemo<AgentSessionsValue>(() => ({
    transport,
    tracks,
    rows,
    roster,
    events,
    source: transport.kind === 'unavailable' ? 'unavailable' : 'live',
    reason: transport.kind === 'unavailable' ? transport.reason : undefined,
    error,
    rosterError,
    temporalError,
    loading,
    refresh,
    selectedSessionRef,
    selectSession,
    nowUnixMs,
    scopes: scopes ?? [],
    refusals: agency.refusals,
  }), [transport, tracks, rows, roster, events, error, rosterError, temporalError, loading, refresh, selectedSessionRef, selectSession, nowUnixMs, scopes, agency.refusals])

  // A named owner refusal is disclosed where its reading is used — Factory's centre and browser, the agent widget — each as
  // the named disclosure card. This provider stands above the whole window (main.tsx), so a card drawn here pushed the
  // frame down out of the window's grid; it draws nothing of its own.
  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  )
}
