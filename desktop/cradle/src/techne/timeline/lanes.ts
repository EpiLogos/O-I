/**
 * The timeline lane model (L5 Technē T3) — a pure projection of a reading's
 * `temporal[]` facets into lanes. This file is the general temporal aperture
 * over any subject whose reading carries time: human DAY material, Agent NOW
 * clearings, sessions, Factory runs, and bare occurrences/receipts all arrive
 * as facets and leave as lanes. It never duplicates a temporal ontology and
 * never mutates lifecycle: native refs ride verbatim, a graphical move here
 * is presentation only — no DAY closes, no NOW carries, no Run completes.
 *
 * Lane grouping is by continuity identity, in a fixed precedence:
 *   day_ref → a DAY lane; now_ref → a NOW lane; session_ref → a Session
 *   lane; run_ref → a Run lane; a facet carrying none of those (a bare
 *   occurrence / receipt / valid / source-created / source-modified) lands
 *   in an Events lane, one per kind.
 * Occurrence and receipt stay distinct rows — never merged — and every
 * `uncertainty` note is preserved verbatim for display.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {
  DisclosureSelection,
  TechneInstrument,
  TechneReading,
  TechneTemporalFacet,
  TechneTemporalInterval,
  TechneTemporalKind,
  TechneTemporalPrecision,
} from "../contract.ts";
import { facetRange } from "./scale.ts";

export type TimelineLaneOwner = "day" | "now" | "session" | "run" | "events";

export interface TimelineItem {
  /** The facet's own ref when the reading supplies one; otherwise a derived
   * stable id (position in the reading), deterministic across identical
   * readings — fit for `focus_refs`, never passed off as a native ref. */
  id: string;
  facet_ref: string | null;
  kind: TechneTemporalKind;
  lane_id: string;
  positioned: boolean;
  fromMs: number | null;
  toMs: number | null;
  /** Verbatim facet carriers and qualifiers — never re-keyed, never shortened. */
  instant?: string;
  interval?: TechneTemporalInterval;
  precision?: TechneTemporalPrecision;
  day_ref?: string;
  now_ref?: string;
  session_ref?: string;
  run_ref?: string;
  source_ref?: string | null;
  timezone_policy_ref?: string | null;
  uncertainty?: string | null;
}

export interface TimelineLane {
  id: string;
  owner: TimelineLaneOwner;
  /** Names the native owner kind: DAY / NOW / Session / Run / Events · <kind>. */
  label: string;
  /** The lane's continuity ref, verbatim; events lanes have none. */
  ref: string | null;
  items: TimelineItem[];
}

const OWNER_LABEL: Record<Exclude<TimelineLaneOwner, "events">, string> = {
  day: "DAY",
  now: "NOW",
  session: "Session",
  run: "Run",
};

const EVENTS_KINDS: readonly TechneTemporalKind[] = ["occurrence", "receipt", "valid", "source-created", "source-modified"];

const LANE_ORDER: readonly TimelineLaneOwner[] = ["day", "now", "session", "run"];

/** The facet's continuity identity, if it carries one (precedence: day, now,
 * session, run). */
export function continuityOf(facet: TechneTemporalFacet): { owner: Exclude<TimelineLaneOwner, "events">; ref: string } | null {
  if (facet.day_ref) return { owner: "day", ref: facet.day_ref };
  if (facet.now_ref) return { owner: "now", ref: facet.now_ref };
  if (facet.session_ref) return { owner: "session", ref: facet.session_ref };
  if (facet.run_ref) return { owner: "run", ref: facet.run_ref };
  return null;
}

function derivedItemId(index: number): string {
  return `derived:techne:timeline:temporal[${index}]`;
}

function toItem(facet: TechneTemporalFacet, index: number, laneId: string): TimelineItem {
  const span = facetRange(facet);
  return {
    id: facet.facet_ref ?? derivedItemId(index),
    facet_ref: facet.facet_ref ?? null,
    kind: facet.kind,
    lane_id: laneId,
    positioned: span.positioned,
    fromMs: span.fromMs,
    toMs: span.toMs,
    ...(facet.instant !== undefined ? { instant: facet.instant } : {}),
    ...(facet.interval !== undefined ? { interval: facet.interval } : {}),
    ...(facet.precision !== undefined ? { precision: facet.precision } : {}),
    ...(facet.day_ref !== undefined ? { day_ref: facet.day_ref } : {}),
    ...(facet.now_ref !== undefined ? { now_ref: facet.now_ref } : {}),
    ...(facet.session_ref !== undefined ? { session_ref: facet.session_ref } : {}),
    ...(facet.run_ref !== undefined ? { run_ref: facet.run_ref } : {}),
    ...(facet.source_ref !== undefined ? { source_ref: facet.source_ref } : {}),
    ...(facet.timezone_policy_ref !== undefined ? { timezone_policy_ref: facet.timezone_policy_ref } : {}),
    ...(facet.uncertainty !== undefined ? { uncertainty: facet.uncertainty } : {}),
  };
}

/**
 * Group temporal facets into lanes. Facets with a continuity ref share that
 * owner's lane; bare event facets land in an Events lane per kind. Lane order
 * is deterministic: DAY, NOW, Session, Run, then Events lanes in the fixed
 * event-kind order. Occurrence and receipt are always distinct items.
 */
export function buildLanes(temporal: readonly TechneTemporalFacet[] | null | undefined): TimelineLane[] {
  const lanes = new Map<string, TimelineLane>();
  const laneFor = (id: string, owner: TimelineLaneOwner, label: string, ref: string | null): TimelineLane => {
    const existing = lanes.get(id);
    if (existing) return existing;
    const lane: TimelineLane = { id, owner, label, ref, items: [] };
    lanes.set(id, lane);
    return lane;
  };

  (temporal ?? []).forEach((facet, index) => {
    const continuity = continuityOf(facet);
    if (continuity) {
      const lane = laneFor(`${continuity.owner}:${continuity.ref}`, continuity.owner, OWNER_LABEL[continuity.owner], continuity.ref);
      lane.items.push(toItem(facet, index, lane.id));
      return;
    }
    const lane = laneFor(`events:${facet.kind}`, "events", `Events · ${facet.kind}`, null);
    lane.items.push(toItem(facet, index, lane.id));
  });

  const rankOf = (lane: TimelineLane): number => {
    if (lane.owner !== "events") return LANE_ORDER.indexOf(lane.owner);
    const kind = lane.id.slice("events:".length) as TechneTemporalKind;
    const at = EVENTS_KINDS.indexOf(kind);
    return LANE_ORDER.length + (at === -1 ? EVENTS_KINDS.length : at);
  };
  return [...lanes.values()].sort((a, b) => rankOf(a) - rankOf(b));
}

/** The lanes for a whole reading (its `temporal` facet list, or none). */
export function lanesFromReading(reading: TechneReading): TimelineLane[] {
  return buildLanes(reading.temporal);
}

/** True when the reading discloses nothing placeable — the honest empty
 * state (no fabricated events). */
export function timelineIsEmpty(lanes: readonly TimelineLane[]): boolean {
  return lanes.length === 0 || lanes.every((lane) => lane.items.length === 0);
}

// ---------------------------------------------------------------------------
// View projection — aggregation at broad zoom
// ---------------------------------------------------------------------------

export interface AggregateWindow {
  fromMs: number;
  toMs: number;
}

export interface AggregateBucket {
  fromMs: number;
  toMs: number;
  count: number;
  item_ids: string[];
}

export interface LaneAggregation {
  lane_id: string;
  owner: TimelineLaneOwner;
  buckets: AggregateBucket[];
}

/**
 * Compress a lane set into view buckets — a pure view projection. Each
 * positioned item is assigned by its centre to one bucket of the window; the
 * input lanes are never touched and the reading is never seen here. At broad
 * zoom this is what keeps many near-coincident facts legible as one honest
 * count instead of overlapping marks.
 */
export function aggregate(lanes: readonly TimelineLane[], window: AggregateWindow, bucketCount = 48): LaneAggregation[] {
  const span = window.toMs - window.fromMs;
  const count = Math.max(1, Math.floor(bucketCount));
  const width = span > 0 ? span / count : span;
  return lanes.map((lane) => {
    const buckets: AggregateBucket[] = [];
    const bucketAt = (index: number): AggregateBucket => {
      const clamped = Math.min(Math.max(index, 0), count - 1);
      let bucket = buckets[clamped];
      if (!bucket) {
        bucket = {
          fromMs: window.fromMs + clamped * width,
          toMs: clamped === count - 1 ? window.toMs : window.fromMs + (clamped + 1) * width,
          count: 0,
          item_ids: [],
        };
        buckets[clamped] = bucket;
      }
      return bucket;
    };
    for (const item of lane.items) {
      if (!item.positioned || item.fromMs === null || item.toMs === null) continue;
      const centre = (item.fromMs + item.toMs) / 2;
      if (centre < window.fromMs || centre > window.toMs) continue;
      const index = span > 0 ? Math.floor((centre - window.fromMs) / width) : 0;
      const bucket = bucketAt(index);
      bucket.count += 1;
      bucket.item_ids.push(item.id);
    }
    return {
      lane_id: lane.id,
      owner: lane.owner,
      buckets: buckets.filter(Boolean),
    };
  });
}

// ---------------------------------------------------------------------------
// Selection — the DisclosureSession co-reference
// ---------------------------------------------------------------------------

/**
 * The selection a click produces: the current selection with focus narrowed
 * to the clicked item (its facet_ref, or the derived stable id) and the
 * instrument naming this one. `subject_ref` and `reading_ref` ride along
 * byte-identical — co-reference is preserved, never re-minted.
 */
export function selectionFocusedOnItem(
  selection: DisclosureSelection,
  item: Pick<TimelineItem, "id">,
  instrument: TechneInstrument = "timeline",
): DisclosureSelection {
  return { ...selection, instrument, focus_refs: [item.id] };
}
