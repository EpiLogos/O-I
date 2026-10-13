/**
 * Chronology navigation identity (lane-2 T19–T22). Pure logic only:
 *   T19  an event's evidence: the passage its source opens at, or honestly the
 *        source's top when the reading discloses no passage (no invented anchor);
 *   T20  the round trip event → relation → endpoint → back, as one trail whose
 *        hops keep the subject and the selection by ref;
 *   T21  "Show on the globe": the event's located place (the subject's LOCATED_AT
 *        to a disclosed place facet) and the event's own validity as the window;
 *   T22  a crossing refuses by name when the session is not the one it was planned
 *        on, and the status line discloses the subject, reading basis and window.
 * Refs move only through the DisclosureSession. Nothing here mints a ref, keeps a
 * shadow route, or upgrades a precision.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {DisclosureSession, TechneReading, TechneSourceSelector} from "../../contract.ts";
import type {SessionCrossingIdentity} from "../../session.ts";
import type {SharedTimeWindow, TechneTimeAxis, TimeAxisEvent} from "./timeAxis.ts";

// ---------------------------------------------------------------------------
// T19 — evidence: the passage an event's source opens at
// ---------------------------------------------------------------------------

/** A source unit that locates a passage. An `other` selector names an identity and locates nothing. */
export type LocatableSelector = Extract<TechneSourceSelector, {unit: "text_span" | "timestamp_range" | "image_region"}>;

/** Whether a carried selector locates a passage of its source (shape-checked; never coerced). */
export function isLocatableSelector(value: unknown): value is LocatableSelector {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const selector = value as Record<string, unknown>;
  if (selector.unit === "text_span") {
    return Number.isInteger(selector.start) && Number.isInteger(selector.end)
      && (selector.start as number) >= 0 && (selector.start as number) <= (selector.end as number);
  }
  if (selector.unit === "timestamp_range") return typeof selector.from === "string" && typeof selector.to === "string";
  if (selector.unit === "image_region") {
    return ["x", "y", "width", "height"].every(key => typeof selector[key] === "number" && Number.isFinite(selector[key] as number));
  }
  return false;
}

/** The relationship properties the bridge writes for a temporal facet (lane-2 T3, T19). */
export interface CarriedFacetEvidence {
  temporal_source_ref?: unknown;
  temporal_provenance_selector?: unknown;
}

export type EvidenceAnchor =
  | {state: "passage"; source_ref: string; selector: LocatableSelector}
  | {state: "top"; source_ref: string; reason: string}
  | {state: "absent"; reason: string};

/** The evidence of one event: its passage when the reading disclosed one, the source's top otherwise. */
export function evidenceAnchorOf(carried: CarriedFacetEvidence): EvidenceAnchor {
  const source = typeof carried.temporal_source_ref === "string" && carried.temporal_source_ref.length > 0
    ? carried.temporal_source_ref : null;
  if (source === null) return {state: "absent", reason: "No source is disclosed for this event."};
  if (isLocatableSelector(carried.temporal_provenance_selector)) {
    return {state: "passage", source_ref: source, selector: carried.temporal_provenance_selector};
  }
  return {state: "top", source_ref: source, reason: "No passage is disclosed for this event; its source opens at the top."};
}

/** The evidence control: present only when a passage exists. A source without a selector has no anchor control. */
export function evidenceControlOf(anchor: EvidenceAnchor): {present: true; label: string} | {present: false; reason: string} {
  if (anchor.state === "passage") return {present: true, label: "Open source at its passage"};
  return {present: false, reason: anchor.reason};
}

/** What the source-open route is asked for: the source ref, with a selector only when a passage exists. */
export function evidenceOpenPlan(anchor: EvidenceAnchor): {source_ref: string; selector: LocatableSelector | null} | null {
  if (anchor.state === "absent") return null;
  return {source_ref: anchor.source_ref, selector: anchor.state === "passage" ? anchor.selector : null};
}

// ---------------------------------------------------------------------------
// T20 — the traversal trail: event → relation → endpoint → back
// ---------------------------------------------------------------------------

export type TraversalHop =
  | {kind: "event"; ref: string; subject_ref: string; selection_ref: string}
  | {kind: "relation"; ref: string | null; from_ref: string; to_ref: string; subject_ref: string; selection_ref: string}
  | {kind: "endpoint"; ref: string; side: "from" | "to"; subject_ref: string; selection_ref: string};

/** A trail is the hops taken from one event. The first hop is always that event. */
export interface NavigationTrail {
  readonly hops: readonly TraversalHop[];
}

export type TraversalStep = {ok: true; trail: NavigationTrail} | {ok: false; reason: string};

/** A trail begins at an event, carrying the subject and selection by ref. */
export function trailFromEvent(eventRef: string, subjectRef: string, selectionRef: string): NavigationTrail {
  return {hops: [{kind: "event", ref: eventRef, subject_ref: subjectRef, selection_ref: selectionRef}]};
}

/** The hop the trail stands on. */
export function currentHop(trail: NavigationTrail): TraversalHop {
  return trail.hops[trail.hops.length - 1];
}

/** The event the trail began at. */
export function originEvent(trail: NavigationTrail): {ref: string; subject_ref: string; selection_ref: string} {
  const origin = trail.hops[0];
  if (origin.kind !== "event") throw new Error("A navigation trail begins at an event");
  return {ref: origin.ref, subject_ref: origin.subject_ref, selection_ref: origin.selection_ref};
}

/**
 * Take the event's relation. A relation without a native ref is derived and is named as such: it is never
 * opened as if it were a native relation. It must touch the current event or its subject.
 */
export function openRelation(
  trail: NavigationTrail,
  relation: {relation_ref: string | null; from_ref: string; to_ref: string},
): TraversalStep {
  const here = currentHop(trail);
  if (here.kind !== "event") return {ok: false, reason: "A relation opens from its event."};
  if (relation.relation_ref === null) {
    return {ok: false, reason: "derived (no native relation_ref disclosed)"};
  }
  const touches = [relation.from_ref, relation.to_ref].some(ref => ref === here.ref || ref === here.subject_ref);
  if (!touches) return {ok: false, reason: "This relation does not touch the event it was opened from."};
  return {
    ok: true,
    trail: {hops: [...trail.hops, {
      kind: "relation",
      ref: relation.relation_ref,
      from_ref: relation.from_ref,
      to_ref: relation.to_ref,
      subject_ref: here.subject_ref,
      selection_ref: here.selection_ref,
    }]},
  };
}

/** Take one endpoint of the relation the trail stands on. */
export function openEndpoint(trail: NavigationTrail, side: "from" | "to"): TraversalStep {
  const here = currentHop(trail);
  if (here.kind !== "relation") return {ok: false, reason: "An endpoint opens from its relation."};
  const ref = side === "from" ? here.from_ref : here.to_ref;
  return {
    ok: true,
    trail: {hops: [...trail.hops, {kind: "endpoint", ref, side, subject_ref: here.subject_ref, selection_ref: here.selection_ref}]},
  };
}

/** Go back one hop. The origin event is never popped: back from it returns the same trail. */
export function backTrail(trail: NavigationTrail): NavigationTrail {
  return trail.hops.length > 1 ? {hops: trail.hops.slice(0, -1)} : trail;
}

/** Where the trail stands, one line: the hop kinds it has taken from its event, e.g. "event → relation → endpoint". */
export function trailStanding(trail: NavigationTrail): string {
  return trail.hops.map(hop => hop.kind).join(" → ");
}

/** The native relation ref a bridge disclosed on a relation's properties, or null when the relation is derived. */
export function relationRefOf(properties: Record<string, unknown>): string | null {
  const ref = properties.native_relation_ref;
  return typeof ref === "string" && ref.length > 0 ? ref : null;
}

// ---------------------------------------------------------------------------
// T21 — Show on the globe: the event's place and its own validity
// ---------------------------------------------------------------------------

/** The subject-to-place relation an event's location is read from (walk.ts's placeGraphNodeId vocabulary). */
export const EVENT_LOCATION_RELATION = "LOCATED_AT";

export type GlobeCarry =
  | {state: "offer"; place_ref: string; window: SharedTimeWindow | null}
  | {state: "absent"; reason: string};

/** The event's own dated extent as a shared window, read from the T6 projection. Null when the event discloses no bound. */
export function eventWindowOf(event: TimeAxisEvent | undefined): SharedTimeWindow | null {
  if (!event) return null;
  if (typeof event.instant === "string" && event.instant.length > 0) return {from: event.instant, to: event.instant};
  const from = event.interval?.from ?? null, to = event.interval?.to ?? null;
  return from === null && to === null ? null : {from, to};
}

/**
 * "Show on the globe" for an event of this subject: the one place the subject is LOCATED_AT that the reading
 * discloses as a place facet. Zero or several located places are named, not chosen between.
 */
export function showOnGlobeOf(reading: TechneReading, subjectRef: string, event: TimeAxisEvent | undefined): GlobeCarry {
  const located = [...new Set((reading.whole?.relations ?? [])
    .filter(row => row.from_ref === subjectRef && row.relation === EVENT_LOCATION_RELATION)
    .map(row => row.to_ref))];
  if (located.length === 0) return {state: "absent", reason: "No location is disclosed for this event's subject."};
  const placed = located.filter(ref => (reading.spatial ?? []).some(facet => facet.place_ref === ref));
  if (placed.length === 0) {
    return {state: "absent", reason: "The located place is not disclosed as a place facet, so nothing is flown to."};
  }
  if (placed.length > 1) {
    return {state: "absent", reason: "More than one place is located for this subject; choose one in Places."};
  }
  return {state: "offer", place_ref: placed[0], window: eventWindowOf(event)};
}

/** The T6 event that an event ref names on a projected axis, or undefined. */
export function axisEventOf(axis: TechneTimeAxis, eventRef: string): TimeAxisEvent | undefined {
  return axis.events.find(event => event.facet_ref === eventRef);
}

// ---------------------------------------------------------------------------
// T22 — identity-honest handoff
// ---------------------------------------------------------------------------

/**
 * Why a crossing planned on `planned` must not proceed on `current`, in the owner's words, or null when it may.
 * A drifted session is refused by name; nothing here re-targets the crossing onto whatever is open now.
 */
export function handoffRefusal(planned: SessionCrossingIdentity, current: DisclosureSession | null): string | null {
  if (current === null) return "No Technē session is open, so this crossing was not carried. Select the subject again.";
  if (current.session_ref !== planned.session_ref) {
    return "The shared session changed since this crossing was planned; it was not re-targeted. Read it again before crossing.";
  }
  if (current.subject_ref !== planned.subject_ref || current.reading_ref !== planned.reading_ref) {
    return "This DisclosureSession discloses another native reading";
  }
  if ((current.selection.snapshot_revision ?? null) !== planned.snapshot_revision) {
    return "The session source snapshot changed; explicitly refresh its native selection before changing shared time";
  }
  if (current.selection.selection_ref !== planned.selection_ref || !sameWindow(current.time_window ?? null, planned.window)) {
    return "The shared session, window or actual selection/instrument changed; read it before setting time";
  }
  return null;
}

function sameWindow(a: {from: string | null; to: string | null} | null, b: {from: string | null; to: string | null} | null): boolean {
  if (a === null || b === null) return a === b;
  return a.from === b.from && a.to === b.to;
}

/** The status line's plain disclosure: subject, reading basis and window, exactly as the session holds them. */
export function handoffDisclosure(session: DisclosureSession): string {
  const basis = session.selection.snapshot_revision ?? null;
  const window = session.time_window
    ? `${session.time_window.from ?? "open"} to ${session.time_window.to ?? "open"}`
    : "none set";
  return `Subject ${session.subject_ref} · reading basis ${session.reading_ref}, revision ${basis ?? "not disclosed"} · window ${window}`;
}
