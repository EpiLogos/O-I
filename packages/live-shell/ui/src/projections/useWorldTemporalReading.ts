// The World cut's one temporal read — the Timeline projection's civil-field
// poller (WORLD-SHELL-DESIGN §6, §10 seams 5/7).
//
// Port law: the receiving pattern is ported from the agent shell's ONE
// poller (src/agent/useTemporalEvents.ts:24-71) — the same kernelOp
// 'temporal_events_read' over a bounded last-civil-day window, the same
// in-flight guard, the K1-measured 90 s cadence. It is re-ported here, not
// imported, because the agent dir is another lane's zone and this poller
// binds the time spine (declare/arm/fire the read cadence; qualify the
// retained occasions) — a different concern over the same owner read.
//
// Honesty: every cadence firing recorded here is a real read execution;
// Now is derived from the reading's own civil instants and day refs, never
// from the wall clock; the wall clock bounds the query window only (the
// same bound the agent shell's read uses). Nothing is copied: adapters
// project the events; the reading is not a second store.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge';
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types';
import {
  createTimeSpine,
  eventDayKey,
  type CivilReading,
  type TemporalEventRow,
  type TimeSpine,
} from '../timeline/timeSpine';
import {projectDayTracks, dayClipEventIndex} from '../timeline/dayTrackAdapter';
import {projectRunTracks, runClipEventIndex, type AdmittedRun} from '../timeline/runTrackAdapter';
import {projectConversationTracks, conversationClipEventIndex} from '../timeline/conversationTrackAdapter';
import {projectLaneWorldTracks} from '../timeline/registerWorldTrackAdapters';
import type {WorldTrackSet} from '../timeline/worldTrackAdapter';

// The read's real cost is the owner's (K1: the temporal read walks every
// stream; the 2 s answer cache makes repeats identical) — the needle
// cadence serves that cost: once at mount, then every 90 s.
const READ_CADENCE_MS = 90_000;
const READ_CADENCE_ID = 'central-temporal-read';

export interface WorldTimelineSource {
  /** 'reading' — first read in flight; 'live' — a reading stands; 'unavailable' — honest absence. */
  status: 'reading' | 'live' | 'unavailable';
  error: string | null;
  /** The situated civil field, derived from the reading (Now). */
  now: CivilReading | null;
  /** The read events, exactly as the kernel gave them (the kernel is the
   * one store; this is the reading, held for projection). */
  events: TemporalEventRow[];
  /** The projected World track sets (day · run · conversation), built
   * through the adapters over the reading. */
  sets: WorldTrackSet[];
  /** Clip id → the exact event a clip was drawn from (occasion selection
   * recovers the event; the adapters' index walks the same sequence). */
  eventByClipId: Map<string, TemporalEventRow>;
  /** The run lanes the owner admits (the agency reading). Null when the
   * agency read was not available — named, never silently empty. */
  admittedRuns: AdmittedRun[] | null;
  admittedRunsError: string | null;
  /** When the standing reading was read (the read execution's instant). */
  readAtUnixMs: number | null;
  /** The read cadence, as declared (a cron parameter of this poller). */
  readCadence: {id: string; everyMs: number; label: string; declaredBy: string} | null;
}

/** What a Session/Arrangement presentation consumes: the source plus the
 * spine it stands on. Occasion selection mutates the spine; consumers
 * re-render through the spine's subscription. */
export interface WorldTimelineView {
  source: WorldTimelineSource;
  spine: TimeSpine;
  selectOccasion: (event: TemporalEventRow) => void;
}

/** Read the civil field once now and every 90 s, arm the read cadence, and
 * project the World track sets. One poller per call site — the Timeline
 * projection is mounted once per shell frame. */
export function useWorldTemporalReading(transport: KernelTransportStatus): WorldTimelineView {
  const spine = useMemo(() => createTimeSpine(), []);
  const [events, setEvents] = useState<TemporalEventRow[]>([]);
  const [status, setStatus] = useState<'reading' | 'live' | 'unavailable'>('reading');
  const [error, setError] = useState<string | null>(null);
  const [readAtUnixMs, setReadAtUnixMs] = useState<number | null>(null);
  const [admittedRuns, setAdmittedRuns] = useState<AdmittedRun[] | null>(null);
  const [admittedRunsError, setAdmittedRunsError] = useState<string | null>(null);
  const [, bumpRevision] = useState(0);

  // The read cadence is a declared cron parameter; each real execution
  // fires it and lands a clip. Declared once per spine; the spine's
  // subscription re-renders the occasion/transport/clip consumers.
  useEffect(() => {
    spine.declareCadence({
      id: READ_CADENCE_ID,
      everyMs: READ_CADENCE_MS,
      label: 'civil-field read',
      declaredBy: 'timeline projection (K1-measured owner cost: the temporal read walks every stream)',
    });
    spine.armCadence(READ_CADENCE_ID, true);
    return spine.subscribe(() => bumpRevision((value) => value + 1));
  }, [spine]);

  const refresh = useCallback(async () => {
    if (transport.kind === 'unavailable') {
      setStatus('unavailable');
      setError(transport.reason ?? 'Transport unavailable');
      return;
    }
    // The window is the day track's own scale: the last seven civil days
    // through tomorrow, bounded at UTC midnights. Day-bounded keys also
    // keep the kernel's 2 s answer cache warm within a day (K1) — a
    // per-poll millisecond bound would defeat it and re-read every stream
    // cold each time. Measured against the live ground (9 Oct): ~10 s
    // cold, ~13 ms warm, over the walks' full streams. (The agent shell's
    // run needle reads a 24 h window for the same cost reason; this cut's
    // scale is the civil week so returns and clearings stay reachable.)
    const nowDate = new Date();
    const fromUnixMs = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate() - 7);
    const toUnixMs = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate() + 1);
    const result = await kernelOp(transport, {
      op: 'temporal_events_read',
      query: {window: {window: 'between', from_unix_ms: fromUnixMs, to_unix_ms: toUnixMs}},
    });
    if (result.error || result.outcome?.result !== 'temporal_events_reading') {
      setStatus('unavailable');
      setError(result.error ?? 'Temporal events reading unavailable');
      return;
    }
    const document = result.outcome.document as {events?: TemporalEventRow[]} | undefined;
    const fresh = Array.isArray(document?.events) ? document.events : [];
    // The owner's admitted runs — the run LANES come from the agency
    // reading (the agent shell's own track source), the clips from the
    // temporal read. A refused agency read is named, never silently empty.
    let admittedRuns: AdmittedRun[] | null = null;
    let admittedRunsError: string | null = null;
    const agency = await kernelOp(transport, {op: 'agency_read', project: 'O-I'});
    if (agency.error || agency.outcome?.result !== 'agency_reading') {
      admittedRunsError = agency.error ?? 'The agency reading is unavailable; run lanes come only from the temporal read.';
    } else {
      const spaces = (agency.outcome as {spaces?: unknown[]}).spaces ?? [];
      admittedRuns = spaces.flatMap((space) => Object.keys((space as {agent_sessions?: Record<string, unknown>}).agent_sessions ?? {}))
        .map((sessionRef) => ({sessionRef}));
    }
    // The execution's own instant (never the window bound): the firing
    // clip records when the read actually ran.
    const readAt = Date.now();
    // A real execution of the read cadence lands as a clip (§15.3). The
    // clip count is therefore the number of reads this projection ran —
    // real executions only, never synthetic history.
    spine.fireCadence(READ_CADENCE_ID, {
      atUnixMs: readAt,
      label: 'civil-field read',
      disclosure: 'the Timeline projection read the civil field',
    });
    spine.qualifyOccasions(fresh, readAt, 'qualified against this refresh of the temporal reading');
    // Now: the newest civil instant the reading itself carries.
    const dated = [...fresh]
      .filter((event) => event.instant_unix_ms != null)
      .sort((a, b) => (b.instant_unix_ms ?? 0) - (a.instant_unix_ms ?? 0));
    const newest = dated[0];
    const now: CivilReading = newest
      ? {instantUnixMs: newest.instant_unix_ms ?? readAt, dayRef: eventDayKey(newest), source: 'kernel temporal read'}
      : {instantUnixMs: readAt, dayRef: null, source: 'kernel temporal read (no dated events in window)'};
    spine.readNow(now);
    setEvents(fresh);
    setAdmittedRuns(admittedRuns);
    setAdmittedRunsError(admittedRunsError);
    setStatus('live');
    setError(null);
    setReadAtUnixMs(readAt);
  }, [transport, spine]);

  const inFlight = useRef(false);
  useEffect(() => {
    const ticked = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await refresh();
      } finally {
        inFlight.current = false;
      }
    };
    void ticked();
    const id = setInterval(() => void ticked(), READ_CADENCE_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const sets = useMemo((): WorldTrackSet[] => {
    if (status !== 'live') return [];
    // Central's civil day first (the mockup's Day group), then runs, then
    // conversations. The lane adapters are pure; the family door
    // (projectLaneWorldTracks / projectWorldTracks) stays the path for
    // family-declared adapters such as the atlas epoch jump.
    return [projectDayTracks(events), projectRunTracks(events, admittedRuns ?? undefined), projectConversationTracks(events)];
  }, [events, status, admittedRuns]);

  const eventByClipId = useMemo((): Map<string, TemporalEventRow> => {
    if (status !== 'live') return new Map();
    return new Map([
      ...dayClipEventIndex(events),
      ...runClipEventIndex(events),
      ...conversationClipEventIndex(events),
    ]);
  }, [events, status]);

  const source = useMemo(
    (): WorldTimelineSource => ({
      status,
      error: status === 'live' ? null : error,
      now: status === 'live' ? spine.now() : null,
      events: status === 'live' ? events : [],
      sets,
      eventByClipId,
      admittedRuns: status === 'live' ? admittedRuns : null,
      admittedRunsError: status === 'live' ? admittedRunsError : null,
      readAtUnixMs: status === 'live' ? readAtUnixMs : null,
      readCadence: spine.cadences().find((cadence) => cadence.id === READ_CADENCE_ID) ?? null,
    }),
    [status, error, events, sets, eventByClipId, admittedRuns, admittedRunsError, readAtUnixMs, spine],
  );

  const selectOccasion = useCallback(
    (event: TemporalEventRow) => {
      spine.selectOccasion(event, Date.now());
    },
    [spine],
  );

  return {source, spine, selectOccasion};
}

// Re-exported so a harness can exercise the family door without importing
// the registry twice; the door remains the single neutral path.
export {projectLaneWorldTracks};
