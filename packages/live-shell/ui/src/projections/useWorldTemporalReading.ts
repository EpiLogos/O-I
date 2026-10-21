// The World cut's one temporal read — the Timeline projection's civil-field
// reader (WORLD-SHELL-DESIGN §6, §10 seams 5/7).
//
// The read itself is the frame's, not this hook's: timeline/temporalPoll.ts
// reads the kernel's 'temporal_events_read' once for every reader (this cut
// and the agent shell's run needles), over the civil week through tomorrow
// bounded at UTC midnights, behind one in-flight guard — when told the field
// may have moved (a receipt, an act, the window regained, the epoch), else at
// its slow floor while seen. This hook consumes that reading and binds the time spine to
// it (declare/arm/fire the read cadence; qualify the retained occasions) — a
// different concern over the same owner read. It ports the receiving pattern
// the agent shell's poller had (src/agent/useTemporalEvents.ts) into the one
// poll; it does not read the op itself.
//
// Honesty: every cadence firing recorded here is a real read execution (one
// per completed execution of the shared read, processed once by its
// revision); Now is derived from the reading's own civil instants and day
// refs, never from the wall clock; the wall clock bounds the query window
// only. Nothing is copied: adapters project the events; the reading is not a
// second store.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types';
import {
  createTimeSpine,
  eventDayKey,
  type CivilReading,
  type TemporalEventRow,
  type TemporalStreamAbsence,
  type TimeSpine,
} from '../timeline/timeSpine';
import {projectDayTracks, dayClipEventIndex} from '../timeline/dayTrackAdapter';
import {projectRunTracks, runClipEventIndex, type AdmittedRun} from '../timeline/runTrackAdapter';
import {projectConversationTracks, conversationClipEventIndex} from '../timeline/conversationTrackAdapter';
import {projectLaneWorldTracks, projectWorldTracks} from '../timeline/registerWorldTrackAdapters';
import {useTemporalReading} from '../timeline/temporalPoll';
import {agencyEntry, useAgencyAnswer} from '../owners/agency';
import {useSpineEpoch} from '../owners/spine';
import type {WorldTrackSet} from '../timeline/worldTrackAdapter';
import {useAtlasAionReading} from './atlas/AtlasProjectionPanel';

// The read's real cost is the owner's (K1: the temporal read walks every
// stream) — so it is read when the kernel says the ground moved (`readings_changed`) or an act tells it, and its only timer is the
// civil week's window moving at UTC midnight: that day is the declared cadence.
const READ_CADENCE_MS = 24 * 60 * 60 * 1000;
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
  /** The streams the reading names as contributing nothing, each with its owner's named cause (the reading's
   * `absences`; empty when every stream answered or the reading is not live). */
  absences: TemporalStreamAbsence[];
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

/** Read the civil field (the frame's one temporal read: once now, then when
 * told, else at its floor), arm the read cadence, and project the World track
 * sets. This hook polls nothing of its own — the Timeline projection is
 * mounted once per shell frame, and the read is shared with the agent shell;
 * its run lanes are the window's one agency answer (owners/agency.ts). */
export function useWorldTemporalReading(transport: KernelTransportStatus): WorldTimelineView {
  const spine = useMemo(() => createTimeSpine(), []);
  const [events, setEvents] = useState<TemporalEventRow[]>([]);
  const [absences, setAbsences] = useState<TemporalStreamAbsence[]>([]);
  const [status, setStatus] = useState<'reading' | 'live' | 'unavailable'>('reading');
  const [error, setError] = useState<string | null>(null);
  const [readAtUnixMs, setReadAtUnixMs] = useState<number | null>(null);
  const [admittedRuns, setAdmittedRuns] = useState<AdmittedRun[] | null>(null);
  const [admittedRunsError, setAdmittedRunsError] = useState<string | null>(null);
  const [, bumpRevision] = useState(0);
  // The atlas's Aion reading (held by the mounted Earth pane, by reference). Its walks reach the World's sets through
  // the family door — the atlas-aion-timeline declaration the atlas manifest admits — so the one derivation is the
  // adapter's. Absent while the atlas holds no reading: no set, never an empty placeholder.
  const atlasAion = useAtlasAionReading();
  const [aionSet, setAionSet] = useState<WorldTrackSet | null>(null);
  useEffect(() => {
    if (!atlasAion) {
      setAionSet(null);
      return;
    }
    let alive = true;
    projectWorldTracks('atlas-aion-timeline', {history: atlasAion.history, providerId: atlasAion.providerId})
      .then((set) => { if (alive) setAionSet(set); })
      .catch(() => { if (alive) setAionSet(null); });
    return () => { alive = false; };
  }, [atlasAion]);

  // The read cadence is a declared cron parameter; each real execution
  // fires it and lands a clip. Declared once per spine; the spine's
  // subscription re-renders the occasion/transport/clip consumers.
  useEffect(() => {
    spine.declareCadence({
      id: READ_CADENCE_ID,
      everyMs: READ_CADENCE_MS,
      label: 'civil-field read',
      declaredBy: 'timeline projection (K1-measured owner cost: the temporal read walks every stream) — read when the kernel reports the ground moved; the UTC midnight, when its window moves, is its only timer',
    });
    spine.armCadence(READ_CADENCE_ID, true);
    return spine.subscribe(() => bumpRevision((value) => value + 1));
  }, [spine]);

  // The frame's one temporal read (timeline/temporalPoll.ts). Each completed execution lands here once, by its revision;
  // an execution the owner refused, or a transport that cannot serve, is named, never silently empty.
  const {reading} = useTemporalReading(transport);
  // The run lanes' source: the window's one agency answer, held while this cut stands.
  useAgencyAnswer(transport, 'O-I');
  const epoch = useSpineEpoch();
  const processed = useRef(-1);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (reading.status === 'reading') return;
    if (reading.status === 'unavailable') {
      setStatus('unavailable');
      setError(reading.error ?? 'Temporal events reading unavailable');
      return;
    }
    if (processed.current === reading.revision) return;
    processed.current = reading.revision;
    const fresh = reading.events;
    const freshAbsences = reading.absences;
    void (async () => {
      // The owner's admitted runs — the run LANES come from the agency
      // reading (the agent shell's own track source), the clips from the
      // temporal read. A refused agency read is named, never silently empty.
      let admittedRuns: AdmittedRun[] | null = null;
      let admittedRunsError: string | null = null;
      // The window's one agency answer (owners/agency.ts): the standing answer when one stands for this epoch, else the one
      // shared read — never a read of this cut's own.
      const agency = agencyEntry(transport, 'O-I');
      await agency.ensure(epoch);
      const answer = agency.snapshot();
      if (answer.status !== 'answered' || !answer.value) {
        admittedRunsError = (transport.kind === 'unavailable' ? transport.reason : answer.error) ?? 'The agency reading is unavailable; run lanes come only from the temporal read.';
      } else {
        admittedRuns = answer.value.rows.map((row) => ({sessionRef: row.sessionRef}));
      }
      if (!mounted.current) return;
      // The execution's own instant (never the window bound): the firing
      // clip records when the read actually ran.
      const readAt = reading.readAtUnixMs ?? Date.now();
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
      setAbsences(freshAbsences);
      setAdmittedRuns(admittedRuns);
      setAdmittedRunsError(admittedRunsError);
      setStatus('live');
      setError(null);
      setReadAtUnixMs(readAt);
    })();
  }, [reading, transport, spine, epoch]);

  // The World stands on a reading only while one is live; otherwise it states the absence (status + error), never a set.
  const live = status === 'live';

  const sets = useMemo((): WorldTrackSet[] => {
    if (!live) return [];
    // Central's civil day first (the mockup's Day group), then runs, then
    // conversations, then the atlas's Aion readings when the Earth pane holds
    // one. The lane adapters are pure; the family door
    // (projectLaneWorldTracks / projectWorldTracks) stays the path for
    // family-declared adapters such as the atlas epoch jump.
    const lanes = [projectDayTracks(events), projectRunTracks(events, admittedRuns ?? undefined), projectConversationTracks(events)];
    return aionSet ? [...lanes, aionSet] : lanes;
  }, [events, status, admittedRuns, aionSet]);

  const eventByClipId = useMemo((): Map<string, TemporalEventRow> => {
    if (!live) return new Map();
    return new Map([
      ...dayClipEventIndex(events),
      ...runClipEventIndex(events),
      ...conversationClipEventIndex(events),
    ]);
  }, [events, status]);

  const source = useMemo(
    (): WorldTimelineSource => ({
      status,
      error: live ? null : error,
      now: live ? spine.now() : null,
      events: live ? events : [],
      absences: live ? absences : [],
      sets,
      eventByClipId,
      admittedRuns: live ? admittedRuns : null,
      admittedRunsError: live ? admittedRunsError : null,
      readAtUnixMs: live ? readAtUnixMs : null,
      readCadence: spine.cadences().find((cadence) => cadence.id === READ_CADENCE_ID) ?? null,
    }),
    [status, error, events, absences, sets, eventByClipId, admittedRuns, admittedRunsError, readAtUnixMs, spine],
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
