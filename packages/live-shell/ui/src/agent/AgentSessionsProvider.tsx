import {createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode} from 'react'
import type {AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
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
import {agencyEntry, agencyFingerprint, createAgencyDriver, useAgencyAnswer} from '../owners/agency'
import {taskReadingEntry, useRosterAgents, useTaskEntries} from '../owners/readers'
import {tellOwnerChanged} from '../owners/notices'
import {useSpineEpoch} from '../owners/spine'

const PROJECT = 'O-I'

export interface AgentSessionsValue {
  transport: KernelTransportStatus
  tracks: AgentSessionTrack[]
  rows: AgencySessionRow[]
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
  const epoch = useSpineEpoch()
  const agency = useAgencyAnswer(transport, PROJECT)
  const [selectedSessionRef, setSelectedSessionRef] = useState<string | null>(null)
  const selected = useRef(selectedSessionRef)
  selected.current = selectedSessionRef
  const {events, error: temporalError, refresh: refreshTemporal} = useTemporalEvents(transport)

  // The one agency driver for the window, under this epoch: a new epoch or transport is a new driver.
  const driver = useRef<ReturnType<typeof createAgencyDriver> | null>(null)
  useEffect(() => {
    if (transport.kind === 'unavailable') return
    const entry = agencyEntry(transport, PROJECT)
    let fingerprint: string | null = null
    const created = createAgencyDriver(entry, {
      epoch,
      onRead: (reading, cause) => {
        if (reading.status !== 'answered') return
        // The selected session's task record is re-read with every agency read, as the agency cadence always carried it.
        const wanted = selected.current ? taskReadingEntry(transport, PROJECT, selected.current) : null
        if (wanted && wanted.readers > 0) void wanted.refresh(epoch)
        // The sessions moved (one started, one ended): the run streams the temporal field reads moved with them.
        const next = agencyFingerprint(reading.value)
        if (fingerprint !== null && next !== fingerprint) tellOwnerChanged({topic: 'temporal', cause: `the agency reading moved (${cause})`})
        fingerprint = next
      },
    })
    driver.current = created
    return () => { created.stop(); if (driver.current === created) driver.current = null }
  }, [transport, epoch])
  useEffect(() => { driver.current?.observe(receipts) }, [receipts])

  const selectSession = useCallback((ref: string) => setSelectedSessionRef(ref), [])

  const reading = agency.reading
  const rows = useMemo<AgencySessionRow[]>(() => reading.status === 'answered' && reading.value ? reading.value.rows : [], [reading])
  const error = transport.kind === 'unavailable' ? transport.reason ?? 'Native transport unavailable' : reading.status === 'refused' ? reading.error : null
  const loading = transport.kind !== 'unavailable' && reading.status === 'reading'
  // The instant the tracks are built at is the instant the agency answer was read: a needle never runs past its reading.
  const [mountedAt] = useState(() => Date.now())
  const nowUnixMs = reading.readAtUnixMs ?? mountedAt

  // The roster: the root register and O-I's own, shared with every other roster reader.
  const rosterReading = useRosterAgents(transport, PROJECT)
  const roster = useMemo(() => new Map<string, RosterEntry>(rosterReading.agents.map(agent => [agent.ref, {name: agent.name, accepted: agent.accepted}])), [rosterReading.agents])
  const rosterError = transport.kind === 'unavailable' ? null : rosterReading.state === 'error' ? rosterReading.error ?? 'The agent roster did not answer' : null

  // Every session's task record, each the shared answer: read once when its session appears (sequentially, so the bridge
  // never sees a pile), then again when a notice reaches it. Without these the grid's clip slots would read empty for every
  // track but the selected one.
  const sessionRefs = useMemo(() => rows.map(row => row.sessionRef), [rows])
  const [taskRevision, bumpTasks] = useReducer((value: number) => value + 1, 0)
  useTaskEntries(transport, PROJECT, sessionRefs, epoch, bumpTasks)
  const readings = useMemo(() => {
    const held: Record<string, unknown> = {}
    if (transport.kind === 'unavailable') return held
    for (const ref of sessionRefs) {
      const standing = taskReadingEntry(transport, PROJECT, ref).snapshot()
      if (standing.status === 'answered' && standing.epoch === epoch) held[ref] = standing.value
    }
    return held
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, sessionRefs, epoch, taskRevision])

  const axis = useMemo(() => sharedAxis(events, nowUnixMs), [events, nowUnixMs])

  const tracks = useMemo(() => buildTracks(rows, roster, {nowUnixMs}).map(track => {
    if (track.group) return track
    const taskReading = readings[track.sessionRef] ?? null
    return {
      ...track,
      tasks: buildTaskClips(taskReading, events, track.sessionRef, nowUnixMs),
      needle: needleFor(events, track.sessionRef, axis),
      budget: budgetFromReading(taskReading),
    }
  }), [rows, roster, readings, events, nowUnixMs, axis])

  // Auto-select the first real session so the dock and meters have a subject.
  useEffect(() => {
    if (selectedSessionRef) return
    const first = tracks.find(track => !track.group)
    if (first) setSelectedSessionRef(first.sessionRef)
  }, [tracks, selectedSessionRef])

  // The person's Retry: ask again whatever stands, a remembered refusal included.
  const retryAgency = agency.retry, retryRoster = rosterReading.retry
  const refresh = useCallback(() => {
    retryAgency()
    retryRoster()
    if (selected.current && transport.kind !== 'unavailable') void taskReadingEntry(transport, PROJECT, selected.current).retry(epoch)
    void refreshTemporal()
  }, [retryAgency, retryRoster, transport, epoch, refreshTemporal])

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
  }), [transport, tracks, rows, roster, events, error, rosterError, temporalError, loading, refresh, selectedSessionRef, selectSession, nowUnixMs])

  // A named owner refusal is disclosed where its reading is used — Factory's centre and browser, the agent widget — each as
  // the named disclosure card. This provider stands above the whole window (main.tsx), so a card drawn here pushed the
  // frame down out of the window's grid; it draws nothing of its own.
  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  )
}
