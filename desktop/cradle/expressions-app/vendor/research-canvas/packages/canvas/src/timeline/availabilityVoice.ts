/**
 * The instrument's one availability voice (lane-2 T25). Every absence keeps its honest sentence and gains
 * its positive twin, all rendered from the same availability facts the reading gives
 * (`projectionAvailability`, src/techne/m0m5/timeline/relations.ts). Pure: no DOM, no placeholder is invented.
 * The sentences below are the authority's own; the timeline reason is pinned to it by a test.
 */

/** The honest absence of the chronology: the reading places no event on a time axis. */
export const NO_DATES_SENTENCE = "No dates disclosed by this source";
/** The authority's reason when the timeline projection has nothing to place. */
export const NO_TIMELINE_REASON = "no temporal facets and no dated relations are disclosed — nothing is placed on a time axis, and none is invented";
/** The authority's reason when the relation projections have no typed relation to draw. */
export const NO_RELATIONS_REASON = "the reading discloses no typed relations";

/** One projection's availability, as `projectionAvailability` reports it. Only the fields the voice reads. */
export interface AvailabilityFact {
  readonly mode: string;
  readonly available: boolean;
  readonly count: number | null;
  readonly reason: string | null;
}

export interface ChronologyVoice {
  /** Whether the chronology can place anything, and the reason it cannot. */
  readonly timeline: {readonly available: boolean; readonly reason: string | null};
  /** Whether the relation projections can draw anything, and the reason they cannot. */
  readonly relations: {readonly available: boolean; readonly reason: string | null};
  /** The one status-line sentence for the chronology: the positive twin when dates exist, the honest absence when not. */
  readonly chronology: string;
  /** The one status-line sentence for the relation field. */
  readonly relationField: string;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function factOf(availability: readonly AvailabilityFact[], mode: string): AvailabilityFact | undefined {
  return availability.find((fact) => fact.mode === mode);
}

/**
 * The chronology and relation voice from one reading's availability. A projection that is absent from the
 * availability is reported unavailable with its reason, never invented as available.
 */
export function chronologyVoice(availability: readonly AvailabilityFact[]): ChronologyVoice {
  const timeline = factOf(availability, "timeline");
  const relations = factOf(availability, "relations");
  const timelineAvailable = timeline?.available === true;
  const relationsAvailable = relations?.available === true;
  const timelineReason = timelineAvailable ? null : timeline?.reason ?? NO_TIMELINE_REASON;
  const relationsReason = relationsAvailable ? null : relations?.reason ?? NO_RELATIONS_REASON;
  const relationCount = relations?.count ?? 0;

  let chronology: string;
  if (timelineAvailable) {
    chronology = `Timeline · ${plural(timeline?.count ?? 0, "dated item", "dated items")}`;
  } else if (relationsAvailable) {
    chronology = `${NO_DATES_SENTENCE} · ${plural(relationCount, "typed relation is", "typed relations are")} in Relations`;
  } else {
    chronology = NO_DATES_SENTENCE;
  }

  const relationField = relationsAvailable
    ? `Relations · ${plural(relationCount, "typed relation", "typed relations")}`
    : `Relations · ${relationsReason}`;

  return {
    timeline: {available: timelineAvailable, reason: timelineReason},
    relations: {available: relationsAvailable, reason: relationsReason},
    chronology,
    relationField,
  };
}
