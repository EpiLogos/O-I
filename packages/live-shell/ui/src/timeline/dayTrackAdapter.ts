// Central day track — the civil day as a Timeline lane (WORLD-SHELL-DESIGN
// §6: "Day / NOW history → Timeline tracks (a day is a lane; returns,
// handoffs, clearings are clips on it)" and §10 seam 5).
//
// Projection, over the kernel's ONE temporal read (temporal_events_read —
// K1's bounded, cached read; nothing is copied into a second store):
// - columns: the civil days the reading covers (the reading's own day refs);
//   an undated reading lands in an honest 'undated' column (relative time,
//   never a fake date — crosswalk lane-2 T5);
// - tracks: Central's civil material (central-now clearings, wiki returns),
//   machine NOWs (aikit-history), the kernel event log — the mockup's
//   Authored/Development→Day, Machines·NOW groups as one reading's lanes;
// - clips: one moment per event, day-local position in hours. Events are
//   readings of record → standing 'fact'; placement never upgrades it.
//
// Pure TypeScript. No React, no transport, no family names in the shape —
// the Timeline renders WorldTrackSet and knows no family.

import type {WorldTrack, WorldTrackAdapter, WorldTrackClip, WorldTrackColumn, WorldTrackSet} from './worldTrackAdapter';
import {eventDayKey, eventStanding, type TemporalEventRow} from './timeSpine';

export const DAY_TRACK_ADAPTER_ID = 'central-day-track';

const UNDATED_COLUMN_ID = 'day:undated';

interface DayLane {
  id: string;
  name: string;
  kind: string;
  /** The streams this lane honestly receives — nothing else lands on it. */
  streams: ReadonlySet<string>;
}

const LANES: DayLane[] = [
  {id: 'central-day', name: 'Central · day', kind: 'day', streams: new Set(['central-now', 'wiki-returns'])},
  {id: 'machines-now', name: 'Machines · NOW', kind: 'machine-now', streams: new Set(['aikit-history'])},
  {id: 'kernel-log', name: 'Kernel · event log', kind: 'kernel-log', streams: new Set(['kernel-event-log'])},
];

const laneFor = (event: TemporalEventRow): DayLane | undefined =>
  LANES.find((lane) => lane.streams.has(event.stream ?? ''));

const shortSummary = (summary: string | undefined, ref: string): string => {
  const text = (summary ?? '').trim();
  if (!text) return ref.length > 48 ? `${ref.slice(0, 45)}…` : ref;
  return text.length > 64 ? `${text.slice(0, 61)}…` : text;
};

// The clip id builder is shared between the projection and the clip→event
// index so an occasion selection can recover the exact event a clip was
// drawn from (both walk the same lane-filtered sequence, in order).
const dayClipId = (event: TemporalEventRow, ordinal: number): string =>
  `day-clip:${event.subject_ref}:${event.instant_unix_ms ?? 'undated'}:${ordinal}`;

/** The clip→event index for the day projection: same iteration, same ids. */
export function dayClipEventIndex(events: TemporalEventRow[]): Map<string, TemporalEventRow> {
  const index = new Map<string, TemporalEventRow>();
  let ordinal = 0;
  for (const event of events) {
    if (!laneFor(event)) continue;
    index.set(dayClipId(event, ordinal), event);
    ordinal += 1;
  }
  return index;
}

export function projectDayTracks(events: TemporalEventRow[]): WorldTrackSet {
  const dayKeys: string[] = [];
  for (const event of events) {
    if (!laneFor(event)) continue;
    const day = eventDayKey(event) ?? UNDATED_COLUMN_ID;
    if (!dayKeys.includes(day)) dayKeys.push(day);
  }
  dayKeys.sort((a, b) => (a === UNDATED_COLUMN_ID ? 1 : b === UNDATED_COLUMN_ID ? -1 : a.localeCompare(b)));
  // The undated column stands FIRST — relative material is visible, never
  // silently mixed into dated days.
  const columns: WorldTrackColumn[] = dayKeys.map((day) => ({
    id: day === UNDATED_COLUMN_ID ? UNDATED_COLUMN_ID : `day:${day}`,
    name: day === UNDATED_COLUMN_ID ? 'undated · relative order' : day,
  }));

  const tracks: WorldTrack[] = LANES.map(({id, name, kind}) => ({id, name, kind}));

  const clips: WorldTrackClip[] = [];
  let ordinal = 0;
  for (const event of events) {
    const lane = laneFor(event);
    if (!lane) continue;
    const day = eventDayKey(event);
    const columnId = day ? `day:${day}` : UNDATED_COLUMN_ID;
    clips.push({
      id: dayClipId(event, ordinal),
      trackId: lane.id,
      columnId,
      label: shortSummary(event.summary, event.subject_ref),
      // A clearing is a moment: no span is fabricated. The renderer draws
      // moment clips as points at their day-local hour (the mockup's pt
      // form), thinning side labels where dots crowd.
      state: eventStanding(event),
    });
    ordinal += 1;
  }

  return {columns, tracks, clips};
}

export const dayTrackAdapter: WorldTrackAdapter<TemporalEventRow[]> = {
  id: DAY_TRACK_ADAPTER_ID,
  project: projectDayTracks,
};
