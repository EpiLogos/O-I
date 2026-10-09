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
import type { WorldTrackClip, WorldTrackColumn, WorldTrackSet, WorldTrackAdapter, WorldTrackTake, WorldTrack } from '../../timeline/worldTrackAdapter';

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

/** Columns are the reading's top-level epochs (nested epochs fold into their
 * parent — the reading's own nesting, kept); tracks are the reading's threads
 * plus one events lane; clips are events in their epoch's column. Time spans
 * are in reading years — "units are the family's own" (worldTrackAdapter.ts). */
export function projectAionReading(source: AionReadingSource): WorldTrackSet {
  const reading = source.history.readings[0];
  if (!reading) return { columns: [], tracks: [], clips: [] };
  const topEpochs = reading.epochs.filter((e) => !e.parentId);
  const columns: WorldTrackColumn[] = topEpochs.map((e) => ({ id: e.id, name: e.name }));
  const epochById = new Map(reading.epochs.map((e) => [e.id, e]));
  const columnOfEvent = (epochId: string): string => {
    const e = epochById.get(epochId);
    if (!e) return topEpochs[0]?.id ?? '';
    return e.parentId ?? e.id;
  };
  const eventTrack: WorldTrack = { id: 'aion-events', name: reading.title, kind: 'atlas-aion-events' };
  const threadTracks: WorldTrack[] = reading.threads.map((t) => ({ id: `aion-thread-${t.id}`, name: t.name, kind: 'atlas-aion-thread' }));
  const clips: WorldTrackClip[] = [];
  for (const event of reading.events) {
    const col = columnOfEvent(event.epochId);
    if (!col) continue;
    clips.push({
      id: `aion-event-${event.id}`,
      trackId: 'aion-events',
      columnId: col,
      label: event.name,
      // a moment event stands at its year; a spanning one would carry from/to —
      // the reading's events are moments, so span is the year itself, width 1
      span: { start: event.year, end: event.year + 1 },
      state: event.polarity,
    });
  }
  for (const thread of reading.threads) {
    for (const eventId of thread.eventIds) {
      const event = reading.events.find((e) => e.id === eventId);
      if (!event) continue;
      const col = columnOfEvent(event.epochId);
      if (!col) continue;
      clips.push({ id: `aion-thread-${thread.id}-${event.id}`, trackId: `aion-thread-${thread.id}`, columnId: col, label: event.name, span: { start: event.year, end: event.year + 1 }, state: thread.polarity });
    }
  }
  return { columns, tracks: [eventTrack, ...threadTracks], clips };
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
