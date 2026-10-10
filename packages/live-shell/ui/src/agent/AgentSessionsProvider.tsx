import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {readAgency} from '../../../../../desktop/cradle/src/agency/agencySources'
import type {AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import {readRoster} from '../../../../../desktop/cradle/src/agency/roster'
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
import {budgetFromReading, readEncounterTask} from './useAgentMetrics'
import {useTemporalEvents} from './useTemporalEvents'
import {RefusalCard} from './RefusalCard'

const AGENCY_POLL_MS = 3000
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
  /** Additive: the reading instant the tracks were built at. */
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
 * The ONE poll source for the agent shell: agency every 3 s, temporal events
 * every 4 s, the roster once, and `encounter_task_read` for the selected
 * session on the agency cadence. Tracks are built here — group containers
 * from spaces, members at depth 1, roster names joined, clips and needles
 * from the readings. Mount it once above every consumer (App's agent-shell
 * tree); a nested mount passes through, so re-wiring a late consumer never
 * doubles the polling.
 */
export function AgentSessionsProvider({children}: {children: ReactNode}) {
  const parent = useContext(Ctx)
  if (parent) return <>{children}</>
  return <AgentSessionsSource>{children}</AgentSessionsSource>
}

function AgentSessionsSource({children}: {children: ReactNode}) {
  const {transport} = useWorkspace()
  const [rows, setRows] = useState<AgencySessionRow[]>([])
  const [roster, setRoster] = useState<Map<string, RosterEntry>>(() => new Map())
  const [error, setError] = useState<string | null>(null)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [readings, setReadings] = useState<Record<string, unknown>>({})
  const [selectedSessionRef, setSelectedSessionRef] = useState<string | null>(null)
  const [nowUnixMs, setNowUnixMs] = useState(() => Date.now())
  const mounted = useRef(true)
  // A cold agency read runs the AIKit owner subprocess for tens of seconds;
  // ticks that overlap it only pile subprocesses on the bridge.
  const agencyInFlight = useRef(false)
  const {events, error: temporalError, refresh: refreshTemporal} = useTemporalEvents(transport)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const selectSession = useCallback((ref: string) => setSelectedSessionRef(ref), [])

  const refresh = useCallback(async () => {
    if (agencyInFlight.current) return
    if (transport.kind === 'unavailable') {
      if (mounted.current) {
        setError(transport.reason ?? 'Native transport unavailable')
        setRows([])
        setLoading(false)
      }
      return
    }
    agencyInFlight.current = true
    try {
    const outcome = await readAgency(transport, PROJECT)
    if (!mounted.current) return
    if ('error' in outcome) {
      setError(outcome.error)
      setRows([])
      setLoading(false)
      return
    }
    setError(null)
    setRows(outcome.reading.rows)
    setNowUnixMs(Date.now())
    setLoading(false)
    const wanted = selectedSessionRef
    if (wanted) {
      const task = await readEncounterTask(transport, PROJECT, wanted)
      if (!mounted.current) return
      if ('reading' in task) {
        setReadings(current => ({...current, [wanted]: task.reading}))
      }
    }
    } finally {
      agencyInFlight.current = false
    }
  }, [transport, selectedSessionRef])

  // One agency + selected-metrics cadence.
  useEffect(() => {
    setLoading(true)
    void refresh()
    const id = setInterval(() => void refresh(), AGENCY_POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // The roster reads once — identity does not move with a 3 s cadence — but
  // a dev-bridge fetch can fail transiently, so transport-level failures
  // retry; a named owner refusal is terminal and disclosed as-is.
  useEffect(() => {
    let live = true
    if (transport.kind === 'unavailable') return
    void (async () => {
      for (let attempt = 0; live && attempt < 6; attempt++) {
        try {
          const agents = await readRoster(transport, PROJECT)
          if (!live) return
          setRoster(new Map(agents.map(agent => [agent.ref, {name: agent.name, accepted: agent.accepted}])))
          setRosterError(null)
          return
        } catch (cause) {
          if (!live) return
          const message = cause instanceof Error ? cause.message : String(cause)
          setRosterError(message)
          if (!/fetch|network|abort/i.test(message)) return
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
    })()
    return () => { live = false }
  }, [transport])

  // Every session's task record, fetched once when the roster of sessions
  // changes (sequentially, so the bridge never sees a pile), then the selected
  // session re-read on the agency cadence. Without this the grid's clip slots
  // would read empty for every track but the selected one.
  const sessionRefs = useMemo(() => rows.map(row => row.sessionRef), [rows])
  const fetchedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (transport.kind === 'unavailable') return
    let live = true
    void (async () => {
      for (const ref of sessionRefs) {
        if (!live) return
        if (fetchedRef.current.has(ref)) continue
        fetchedRef.current.add(ref)
        const task = await readEncounterTask(transport, PROJECT, ref)
        if (!live) return
        if ('reading' in task) {
          setReadings(current => ({...current, [ref]: task.reading}))
        }
      }
    })()
    return () => { live = false }
  }, [sessionRefs, transport])

  const axis = useMemo(() => sharedAxis(events, nowUnixMs), [events, nowUnixMs])

  const tracks = useMemo(() => buildTracks(rows, roster, {nowUnixMs}).map(track => {
    if (track.group) return track
    const reading = readings[track.sessionRef] ?? null
    return {
      ...track,
      tasks: buildTaskClips(reading, events, track.sessionRef, nowUnixMs),
      needle: needleFor(events, track.sessionRef, axis),
      budget: budgetFromReading(reading),
    }
  }), [rows, roster, readings, events, nowUnixMs, axis])

  // Auto-select the first real session so the dock and meters have a subject.
  useEffect(() => {
    if (selectedSessionRef) return
    const first = tracks.find(track => !track.group)
    if (first) setSelectedSessionRef(first.sessionRef)
  }, [tracks, selectedSessionRef])

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
    refresh: () => { void refresh(); refreshTemporal() },
    selectedSessionRef,
    selectSession,
    nowUnixMs,
  }), [transport, tracks, rows, roster, events, error, rosterError, temporalError, loading, refresh, refreshTemporal, selectedSessionRef, selectSession, nowUnixMs])

  // A named owner refusal is shell-level truth, not a view's property: the
  // source itself discloses it at the top of whatever tree it powers — as the
  // disclosure card (named, receipt folded), never a raw dump — so no centre
  // view or context consumer can swallow it.
  return (
    <Ctx.Provider value={value}>
      {rosterError && (
        <div data-region="agent-disclosures">
          <RefusalCard
            title="Roster refused"
            line={`Agent roster read failed. Central owner Action refused: ${rosterError}`}
            receipt={rosterError}
          />
        </div>
      )}
      {children}
    </Ctx.Provider>
  )
}
