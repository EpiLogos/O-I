// Aion as the Timeline's epoch navigation — the L5 jump design, as code.
//
// Commission (L5 Phase 3): "Aion becomes the Timeline's epoch navigation entry
// point (the jump lands as an encounter transition)". The Timeline lane has
// already published the neutral contract this lands through:
// `src/timeline/worldTrackAdapter.ts` ("A family projects its own reading into
// the Timeline projection's neutral shape… The Timeline renders this shape; it
// knows no family"). This module implements that contract for the atlas's Aion
// readings and defines the epoch jump's encounter payload.
//
// Ownership: this file is the atlas port's (L5's zone). The Timeline-side
// consumer that calls it is L4's — the proposed registration hunk ships as a
// patch in the lane's evidence directory (see AION-TIMELINE-JUMP.patch notes).
// Nothing here writes Timeline state: the jump returns a payload; the
// encounter spine owns transitions (WORLD-SHELL-DESIGN §2 — no second
// selection model).

import type { Epoch, History, HistoryReading } from './src/types/history';
// [r2 import-depth fix] the Timeline lane's neutral contract lives at the
// package's src/timeline/ — two levels up from this directory (same depth
// error family as the manifest's).
import type { WorldTrack, WorldTrackClip, WorldTrackColumn, WorldTrackLayer, WorldTrackSection, WorldTrackSet, WorldTrackAdapter, WorldTrackTake, WorldWalk, WorldWalkStop } from '../../timeline/worldTrackAdapter';
// The ported walk functions (AE aion/walk.ts): the adapter calls them, never reimplements them.
import { WHOLE_READING_WALK, walksOf } from './src/aion/walk';
import { hexToRgb, rgbToHex } from './src/data/palette';
import { stopPlace } from './walkTimeline';

/** The encounter-transition payload an Aion epoch jump carries. The spine
 * addresses subjects by ref (design §10.6); the atlas's own deep-link grammar
 * (`#/aion/<reading>/<kind>/<id>`, state/router.ts) stays the linkable truth
 * and travels in `hash`. */
export interface AionEpochJump {
  kind: 'atlas-epoch';
  /** the corpus provider the reading came from (bundle id) */
  providerId: string;
  readingId: string;
  epochId: string;
  /** the epoch's own claim, as the reading gives it (never regenerated) */
  from: number;
  to: number;
  /** display, as written */
  label: string;
  /** the atlas's own linkable state — Back works (the atlas law the shell adopts) */
  hash: string;
}

/** The jump payload for one epoch of one reading. Pure. */
export function aionEpochJump(reading: HistoryReading, epoch: Epoch, providerId: string): AionEpochJump {
  return {
    kind: 'atlas-epoch',
    providerId,
    readingId: reading.id,
    epochId: epoch.id,
    from: epoch.from,
    to: epoch.to,
    label: epoch.name,
    hash: `#/aion/${reading.id}/epoch/${epoch.id}`,
  };
}

/** Which epoch a Timeline cursor year stands in (the narrowest containing span —
 * the same rule aion/model.ts `epochAt` states; imported there in host code,
 * restated here as data so the adapter stays decoupled from the pane). */
export function epochForYear(reading: HistoryReading, year: number): Epoch | undefined {
  return reading.epochs
    .filter((e) => year >= e.from && year < e.to)
    .sort((a, b) => a.to - a.from - (b.to - b.from))[0];
}

// ── the WorldTrackAdapter implementation ─────────────────────────────────────

interface AionReadingSource {
  history: History;
  providerId: string;
}

const EVENT_TRACK_KIND = 'atlas-aion-events';
const WALK_TRACK_KIND = 'walk';

/** The top-level epoch a given epoch nests under (itself when top-level). */
function topEpochOf(epochById: Map<string, Epoch>, epochId: string): string | undefined {
  let epoch = epochById.get(epochId);
  const seen = new Set<string>();
  while (epoch?.parentId && !seen.has(epoch.id)) {
    seen.add(epoch.id);
    epoch = epochById.get(epoch.parentId);
  }
  return epoch?.id;
}

/** Every reading is a layer; later readings extend, never rewrite. Columns are the top epochs of each reading in
 * reading order (the renderer's time blocks, kept). Each epoch is a section, nested by its parent, its span from/to,
 * its atmosphere the epoch palette's core as hex. Each reading's events are clips on that reading's events track.
 * Each curated thread and the derived whole-reading walk is a walk: its stops stand its events in walk order (clipId,
 * year, place, `also` = the event's occurrence ids), and a walk track draws them on the ruler. Time spans are in
 * reading years ("units are the family's own", worldTrackAdapter.ts). The history is read, never written. */
export function projectAionReading(source: AionReadingSource): WorldTrackSet {
  const layers: WorldTrackLayer[] = [];
  const sections: WorldTrackSection[] = [];
  const columns: WorldTrackColumn[] = [];
  const tracks: WorldTrack[] = [];
  const clips: WorldTrackClip[] = [];
  const walks: WorldWalk[] = [];
  const seenColumns = new Set<string>();

  source.history.readings.forEach((reading, index) => {
    layers.push({ id: reading.id, name: reading.title, ...(reading.extends ? { extends: reading.extends } : {}) });

    const epochById = new Map(reading.epochs.map((e) => [e.id, e]));
    const topEpochs = reading.epochs.filter((e) => !e.parentId);
    for (const e of topEpochs) {
      if (seenColumns.has(e.id)) continue;
      seenColumns.add(e.id);
      columns.push({ id: e.id, name: e.name });
    }
    for (const e of reading.epochs) {
      const atmosphere = e.palette?.core ? rgbToHex(hexToRgb(e.palette.core)) : undefined;
      sections.push({
        id: e.id,
        name: e.name,
        span: { start: e.from, end: e.to },
        layerId: reading.id,
        ...(e.parentId ? { parentId: e.parentId } : {}),
        ...(atmosphere ? { atmosphere } : {}),
      });
    }

    // Each epoch's column is its top-level ancestor; an event whose epoch the reading does not carry falls to the
    // reading's first column, as before.
    const columnOfEpoch = (epochId: string): string | undefined => topEpochOf(epochById, epochId) ?? topEpochs[0]?.id;

    // The founding reading keeps the track id its Timeline consumers name; later readings get their own.
    const eventTrackId = index === 0 ? 'aion-events' : `aion-events:${reading.id}`;
    tracks.push({ id: eventTrackId, name: reading.title, kind: EVENT_TRACK_KIND, layerId: reading.id });
    const eventById = new Map(reading.events.map((e) => [e.id, e]));
    for (const event of reading.events) {
      const col = columnOfEpoch(event.epochId);
      if (!col) continue;
      clips.push({
        id: `aion-event-${event.id}`,
        trackId: eventTrackId,
        columnId: col,
        label: event.name,
        // a moment event stands at its year; the reading's events are moments, so span is the year itself, width 1
        span: { start: event.year, end: event.year + 1 },
        state: event.polarity,
      });
    }

    // Curated threads, then the derived whole-reading walk first (walksOf's order is the Options order).
    for (const walk of walksOf(reading)) {
      const derived = walk.id === WHOLE_READING_WALK;
      const walkId = `${reading.id}:${walk.id}`;
      const trackId = `walk:${walkId}`;
      tracks.push({ id: trackId, name: walk.name, kind: WALK_TRACK_KIND, layerId: reading.id });
      const stops: WorldWalkStop[] = [];
      for (const eventId of walk.eventIds) {
        const event = eventById.get(eventId);
        if (!event) continue;
        // A stop is never dropped: a stop whose epoch has no column stands no clip, but is still reached.
        const col = columnOfEpoch(event.epochId);
        const clipId = col ? `${trackId}:${event.id}` : undefined;
        if (col && clipId) {
          clips.push({ id: clipId, trackId, columnId: col, label: event.name, span: { start: event.year, end: event.year + 1 }, state: walk.polarity });
        }
        const place = stopPlace(event);
        stops.push({
          id: event.id,
          label: event.name,
          ...(clipId ? { clipId } : {}),
          year: event.year,
          ...(place ? { place } : {}),
          also: [...(event.occurrenceIds ?? [])],
        });
      }
      walks.push({ id: walkId, name: walk.name, layerId: reading.id, kind: derived ? 'aion-whole-reading' : 'aion-thread', derived, stops });
    }
  });

  return { columns, tracks, clips, layers, sections, walks };
}

/** The adapter as the Timeline contract declares it. `project` consumes a
 * reading source (the mounted atlas's history bundle); the Timeline knows no
 * family. Takes: none — the reading's cursor is the atlas's own Occasion
 * clock, not a Transport take (time-spine law, design §15). */
export function aionTrackAdapter(): WorldTrackAdapter<AionReadingSource> {
  return {
    id: 'atlas-aion',
    project: projectAionReading,
  } as WorldTrackAdapter<AionReadingSource>;
}

export type { WorldTrackTake };
