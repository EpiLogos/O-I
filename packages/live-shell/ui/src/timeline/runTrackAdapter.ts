// Factory run track — runs and agent sessions as Timeline lanes
// (WORLD-SHELL-DESIGN §7: "Factory work appears as Timeline tracks (runs,
// stages, messages)"; the software-factory family manifest declares
// 'factory-run-track-adapter' and time.contributes ['run-clips']).
//
// Projection, over the kernel's ONE temporal read (nothing copied):
// - columns: the civil days the runs stood in;
// - tracks: one lane per run subject (agent-session / factory / run refs),
//   bounded to the twelve most active — honest overflow names the count,
//   it never truncates silently (the never-silently-truncate law);
// - clips: the run's real events as moments, day-local in hours, standing
//   kept as read. A run with no events in the window draws no clips — its
//   absence is disclosed by the presentation, not invented.
//
// Pure TypeScript. No React, no session-store: the agency/agent session
// rows remain their owner's (agentRunModel.ts); this adapter only places
// what the temporal read already gave.

import type {WorldTrack, WorldTrackAdapter, WorldTrackClip, WorldTrackColumn, WorldTrackSet} from './worldTrackAdapter';
import {eventDayKey, eventStanding, type TemporalEventRow} from './timeSpine';

export const RUN_TRACK_ADAPTER_ID = 'factory-run-track-adapter';

const MAX_RUN_TRACKS = 12;

/** The subjects that are run material: agency sessions, Factory runs, and
 * explicit run refs. Conversation spaces are NOT runs (their adapter is
 * conversationTrackAdapter); Central civil material is not either. */
export function isRunSubject(subjectRef: string): boolean {
  return (
    subjectRef.startsWith('agent-session/') ||
    subjectRef.startsWith('factory/') ||
    subjectRef.startsWith('run:') ||
    /(^|[:/#])run\d+/i.test(subjectRef)
  );
}

const trackName = (subjectRef: string): string => {
  const tail = subjectRef.split('/').pop() ?? subjectRef;
  return tail.length > 40 ? `${tail.slice(0, 37)}…` : tail;
};

/** A run the owner admits — one agency/Factory session identity from the
 * owner's own reading (`agency_read`; the agent shell's track source,
 * agentRunModel.ts). The adapter only places it; nothing is copied. */
export interface AdmittedRun {
  sessionRef: string;
  label?: string;
}

const shortSummary = (summary: string | undefined, ref: string): string => {
  const text = (summary ?? '').trim();
  if (!text) return ref.length > 40 ? `${ref.slice(0, 37)}…` : ref;
  return text.length > 56 ? `${text.slice(0, 53)}…` : text;
};

// Shared id builder for the projection and its clip→event index (same
// kept-subject iteration, same order).
const runClipId = (event: TemporalEventRow): string =>
  `run-clip:${event.subject_ref}:${event.instant_unix_ms ?? 'unindexed'}`;

/** The clip→event index for the run projection: same iteration, same ids. */
export function runClipEventIndex(events: TemporalEventRow[]): Map<string, TemporalEventRow> {
  const bySubject = new Map<string, TemporalEventRow[]>();
  for (const event of events) {
    if (!isRunSubject(event.subject_ref)) continue;
    const lane = bySubject.get(event.subject_ref) ?? [];
    lane.push(event);
    bySubject.set(event.subject_ref, lane);
  }
  const subjects = [...bySubject.keys()].sort(
    (a, b) => (bySubject.get(b)?.length ?? 0) - (bySubject.get(a)?.length ?? 0),
  );
  const kept = new Set(subjects.slice(0, MAX_RUN_TRACKS));
  const index = new Map<string, TemporalEventRow>();
  for (const subject of subjects) {
    if (!kept.has(subject)) continue;
    for (const event of bySubject.get(subject) ?? []) {
      const day = eventDayKey(event);
      if (!day) continue;
      index.set(runClipId(event), event);
    }
  }
  return index;
}

export function projectRunTracks(events: TemporalEventRow[], admitted?: readonly AdmittedRun[]): WorldTrackSet {
  const bySubject = new Map<string, TemporalEventRow[]>();
  for (const event of events) {
    if (!isRunSubject(event.subject_ref)) continue;
    const lane = bySubject.get(event.subject_ref) ?? [];
    lane.push(event);
    bySubject.set(event.subject_ref, lane);
  }

  // The lanes are the OWNER'S admitted runs when the caller supplies that
  // reading (a run exists because its owner admits it, not because the
  // temporal read happened to carry an event); the read's own run subjects
  // join them. Events the read did carry still place as clips; an admitted
  // run with no events in the window shows an honestly empty lane.
  const subjects = admitted?.length
    ? [
        ...new Set([
          ...admitted.map((run) => run.sessionRef),
          ...[...bySubject.keys()],
        ]),
      ]
    : [...bySubject.keys()].sort(
        (a, b) => (bySubject.get(b)?.length ?? 0) - (bySubject.get(a)?.length ?? 0),
      );
  const labels = new Map((admitted ?? []).map((run) => [run.sessionRef, run.label]));
  const kept = subjects.slice(0, MAX_RUN_TRACKS);
  const overflow = subjects.length - kept.length;

  const dayKeys: string[] = [];
  for (const subject of kept) {
    for (const event of bySubject.get(subject) ?? []) {
      const day = eventDayKey(event);
      if (day && !dayKeys.includes(day)) dayKeys.push(day);
    }
  }
  dayKeys.sort((a, b) => a.localeCompare(b));
  const columns: WorldTrackColumn[] = dayKeys.map((day) => ({id: `day:${day}`, name: day}));

  const tracks: WorldTrack[] = kept.map((subject) => ({
    id: `run:${subject}`,
    name: labels.get(subject) ?? trackName(subject),
    kind: 'run',
  }));
  if (overflow > 0) {
    tracks.push({id: 'run:overflow', name: `…${overflow} more runs beyond the lane bound`, kind: 'run-overflow'});
  }

  const clips: WorldTrackClip[] = [];
  for (const subject of kept) {
    for (const event of bySubject.get(subject) ?? []) {
      const day = eventDayKey(event);
      if (!day) continue;
      clips.push({
        id: runClipId(event),
        trackId: `run:${subject}`,
        columnId: `day:${day}`,
        label: shortSummary(event.summary, event.subject_ref),
        // A run event is a moment (a receipt, an attempt): the read gives
        // no honest span, so none is fabricated.
        state: eventStanding(event),
      });
    }
  }

  return {columns, tracks, clips};
}

export const runTrackAdapter: WorldTrackAdapter<TemporalEventRow[]> = {
  id: RUN_TRACK_ADAPTER_ID,
  project: projectRunTracks,
};
