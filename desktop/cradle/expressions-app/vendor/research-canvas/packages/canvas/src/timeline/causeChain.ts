/**
 * Cause chains along the axis (lane-2 T10). A pure walk over the relation
 * field's own cause family: no React, no DOM. The chronology's relationship
 * layer and the relation field's cause mode both read this one model.
 *
 * Laws this module keeps:
 *   - FAMILY BY THE AUTHORITY: a hop joins a chain only when
 *     `projectionForRelation(relation) === "cause"`. An unrecognised type never
 *     becomes causal here.
 *   - DIRECTION AND ORDER BY THE AUTHORITY: chains are the authority's
 *     `directedChains` (the owner's from → to, lowest id first). This module
 *     calls that function; it does not restate the walk.
 *   - TIME ONLY WHEN DISCLOSED: a hop's time is its own dated extent, read from
 *     the authority's extents. A hop with no disclosed date says
 *     `NO_DATE_DISCLOSED`. An offset is computed only when both hops are dated.
 *   - STANDING NEVER UPGRADED: a hop carries its standing class and verbatim
 *     string, as the caller read them through `standingOf`.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import { directedChains, projectionForRelation, type RelationEdge } from "../../../../../../../src/techne/m0m5/timeline/relations";
import { calendarYear } from "./instant";
import { precisionLabel, spanLabel } from "./labels";
import type { GraphRelationship } from "./contracts";
import { bandExtent, type TimelineItem } from "./projection";
import { standingOfRelationshipProperties } from "./standingStyle";
import type { StandingVisual } from "../../../../../../../src/techne/m0m5/timeline/standing";

/** The one label a hop or an offset carries when no date is disclosed for it. */
export const NO_DATE_DISCLOSED = "no date disclosed";

const DAY_MS = 86_400_000;
/** Spans of 365 days or more always cross a calendar-year boundary, so they read in years. */
const YEAR_SPAN_MIN_MS = 365 * DAY_MS;

/** A hop's own dated extent, read from the authority. `toMs` null = open-ended or a point. */
export interface HopTime {
  fromMs: number;
  toMs: number | null;
  /** The precision label, stated verbatim from the authority's precision. */
  label: string;
}

/** The standing of a hop: the authority's class and the owner's verbatim string. */
export interface HopStanding {
  visual: StandingVisual;
  verbatim: string | null;
}

/** One relation as the chain walk reads it. Built by the caller from its own native edge. */
export interface CauseSource {
  /** Stable edge identity (the native relation identity, or the bridge's id). */
  id: string;
  /** The provider's relation type, verbatim. */
  relation: string;
  from_ref: string;
  to_ref: string;
  standing: HopStanding;
  /** The hop's own dated extent, or null when none is disclosed or loaded. */
  time: HopTime | null;
  /** Why there is no time, for the honest tooltip. Null when a time is present. */
  timeNote: string | null;
}

export type HopOffset =
  | { state: "dated"; ms: number; label: string }
  | { state: "undated"; label: typeof NO_DATE_DISCLOSED };

export interface CauseHop extends CauseSource {
  /** Null for the first hop (the walk's origin). */
  offset: HopOffset | null;
}

export interface CauseChain {
  /** The first hop's id: a chain's stable identity within one reading. */
  id: string;
  hops: CauseHop[];
}

/**
 * The signed calendar offset from one instant to another, stated in the
 * authority's units: days under a year, calendar years beyond that.
 */
export function offsetLabel(fromMs: number, toMs: number): string {
  const delta = toMs - fromMs;
  if (delta === 0) return "same start";
  const sign = delta > 0 ? "+" : "−";
  const span = Math.abs(delta);
  if (span < DAY_MS) return `${sign}under a day`;
  if (span < YEAR_SPAN_MIN_MS) {
    const days = Math.floor(span / DAY_MS);
    return `${sign}${days} day${days === 1 ? "" : "s"}`;
  }
  const years = Math.max(1, Math.abs(calendarYear(toMs) - calendarYear(fromMs)));
  return `${sign}${years} year${years === 1 ? "" : "s"}`;
}

/** The offset of a hop from the one before it: computed only when both are dated. */
function offsetOf(previous: HopTime | null, current: HopTime | null, index: number): HopOffset | null {
  if (index === 0) return null;
  if (previous === null || current === null) return { state: "undated", label: NO_DATE_DISCLOSED };
  return { state: "dated", ms: current.fromMs - previous.fromMs, label: offsetLabel(previous.fromMs, current.fromMs) };
}

/**
 * The cause chains over a set of relations. Only the cause family joins; the
 * maximal chains come from the authority's `directedChains`, so the walk order
 * and the chain identities are the authority's.
 */
export function causeChains(sources: readonly CauseSource[]): CauseChain[] {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const cause = sources.filter((source) => projectionForRelation(source.relation) === "cause");
  // directedChains reads only id, from_ref and to_ref and returns the objects it was
  // given; the cast passes the minimal shape through the authority's own walk.
  const chains = directedChains(cause as unknown as RelationEdge[]) as unknown as CauseSource[][];
  return chains.map((chain) => {
    const hops = chain.map((entry, index): CauseHop => {
      const source = byId.get(entry.id) ?? entry;
      const previous = index === 0 ? null : chain[index - 1].time;
      return { ...source, offset: offsetOf(previous ?? null, source.time, index) };
    });
    return { id: hops[0].id, hops };
  });
}

/**
 * The chain a relation id belongs to, or null when it is in none. Where the
 * authority's walk carries a relation in more than one chain (a shorter chain
 * can repeat a longer chain's tail), the longest chain is the one followed.
 */
export function chainContaining(chains: readonly CauseChain[], relationId: string): CauseChain | null {
  let best: CauseChain | null = null;
  for (const chain of chains) {
    if (!chain.hops.some((hop) => hop.id === relationId)) continue;
    if (best === null || chain.hops.length > best.hops.length) best = chain;
  }
  return best;
}

/** The label a hop states for its time: its precision label, or the honest absence. */
export function hopLabel(hop: Pick<CauseHop, "time">): string {
  return hop.time ? hop.time.label : NO_DATE_DISCLOSED;
}

/** The instant the camera centres on when following a dated hop: the middle of its extent. */
export function hopCenterMs(time: HopTime): number {
  return (time.fromMs + (time.toMs ?? time.fromMs)) / 2;
}

/**
 * The chronology's source for one relationship. Its time is the authority
 * extent of the temporal anchor the relation qualifies (its temporal_facet_ref
 * names the anchor's graph node id), read from the items already placed on this
 * camera. A ref that is not loaded, or no ref at all, is an undated hop.
 */
export function chronologyCauseSource(
  relationship: Pick<GraphRelationship, "id" | "relType" | "sourceGraphNodeId" | "targetGraphNodeId" | "properties">,
  itemsByGraphNodeId: ReadonlyMap<string, TimelineItem>,
): CauseSource {
  const standing = standingOfRelationshipProperties(relationship.properties);
  const facet = typeof relationship.properties.temporal_facet_ref === "string" ? relationship.properties.temporal_facet_ref : null;
  const item = facet === null ? undefined : itemsByGraphNodeId.get(facet);
  let time: HopTime | null = null;
  let timeNote: string | null = null;
  if (facet === null) {
    timeNote = "no temporal qualification is disclosed for this relation";
  } else if (item === undefined) {
    timeNote = `its temporal qualification ${facet} is not loaded in this view`;
  } else {
    time = { fromMs: item.startMs, toMs: bandExtent(item).toMs, label: precisionLabel(item) };
  }
  return {
    id: relationship.id,
    relation: relationship.relType,
    from_ref: relationship.sourceGraphNodeId,
    to_ref: relationship.targetGraphNodeId,
    standing: { visual: standing.visual, verbatim: standing.verbatim },
    time,
    timeNote,
  };
}

/**
 * The relation field's source for one native edge. Its time is the relation's
 * own resolved temporal qualification, from the authority (`facetRange`).
 */
export function relationFieldCauseSource(edge: RelationEdge): CauseSource {
  const temporal = edge.temporal;
  const time: HopTime | null = temporal.state === "dated" && temporal.fromMs !== null
    ? { fromMs: temporal.fromMs, toMs: temporal.toMs, label: spanLabel(temporal.fromMs, temporal.toMs ?? temporal.fromMs, 0) }
    : null;
  return {
    id: edge.id,
    relation: edge.relation,
    from_ref: edge.from_ref,
    to_ref: edge.to_ref,
    standing: { visual: edge.standing_visual, verbatim: edge.standing_verbatim },
    time,
    timeNote: time ? null : (temporal.problem ?? "no temporal qualification is disclosed for this relation"),
  };
}
