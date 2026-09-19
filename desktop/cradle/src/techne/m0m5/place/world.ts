/**
 * The World model (L5 Technē M4′ — World / Places) — pure derivation over a
 * `TechneReading` (ql.techne/v1, TB0-1): the instrument is the situated
 * whole — place, reference frame, Earth relation — of which Map, Street and
 * Globe are the concrete spatial interaction body, not the office itself
 * (`docs/L5-TECHNE-DUAL-READING-LOCK.md` §10, QL-MEF #217).
 *
 * Laws carried here:
 *   - the hard geography distinctions (OCCURRED_AT, LOCATED_IN, OPERATED_IN,
 *     TRAVELLED_TO, MYTH_LOCATED_AT) are preserved verbatim and are never
 *     interchangeable; a mythic location does not become a historical one
 *     because both can render on a map. Standing classes below exist for
 *     visual distinction only — identity and vocabulary stay the owner's;
 *   - Place identity is independent of coordinates: an unlocated place is a
 *     honest state with its identity, never a defect to fill;
 *   - time filtering constrains a Place reading without reminting identity
 *     (the filter in `./filter` owns that law; this model only reads it);
 *   - the wider reference-frame depth (M1 harmonic, M2 planetary/
 *     correspondential, M3 world-clock, M4 EarthBody/Nara) is consumed from
 *     producers and from what the reading itself carries — NEVER recomputed
 *     in renderer code. Producer depth that is not callable from this tree
 *     stays explicitly unavailable, with the reason, exactly like the TB0
 *     specimen's degraded Place facet;
 *   - privacy rides the contract's own disclosure terms (the situated-Agency
 *     roles' `privacy` fields): Nara-private state is never rendered here,
 *     only its constraint is named.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {
  ApplicationCutDisclosure,
  NativeActionRef,
  TechneInstrument,
  TechnePlaceFacet,
  TechneReading,
  TechneTemporalFacet,
} from "../../contract.ts";
import { nameInWindow, type TimeWindow } from "./filter.ts";

// ---------------------------------------------------------------------------
// The hard geography relations
// ---------------------------------------------------------------------------

/** The hard geography distinctions (#217). Not interchangeable; the list is
 * the legend the instrument renders, never a normalisation target. */
export const GEOGRAPHY_RELATIONS: readonly string[] = [
  "OCCURRED_AT",
  "LOCATED_IN",
  "OPERATED_IN",
  "TRAVELLED_TO",
  "MYTH_LOCATED_AT",
];

/** The mythic relation, kept distinct from every historical one. */
export const MYTHIC_RELATION = "MYTH_LOCATED_AT";

/** The movement relation of the hard set; route overlays order its facets. */
export const MOVEMENT_RELATION = "TRAVELLED_TO";

/**
 * Standing class for VISUAL DISTINCTION ONLY: factual (a relation of the
 * hard historical set), mythic (MYTH_LOCATED_AT), owner-vocabulary (any
 * other native relation, preserved verbatim and never relabelled). This
 * class never rewrites the relation itself and never upgrades standing.
 */
export type RelationStandingClass = "factual" | "mythic" | "owner-vocabulary";

export function relationStandingClass(relation: string | null | undefined): RelationStandingClass {
  if (relation === MYTHIC_RELATION) return "mythic";
  if (relation && GEOGRAPHY_RELATIONS.includes(relation)) return "factual";
  return "owner-vocabulary";
}

// ---------------------------------------------------------------------------
// The subject's place relations, grouped verbatim
// ---------------------------------------------------------------------------

export interface PlaceRelationGroup {
  /** The native relation, verbatim. */
  relation: string;
  standingClass: RelationStandingClass;
  /** The facets carrying it, in reading order, verbatim. */
  facets: TechnePlaceFacet[];
}

/** The reading's place relations grouped by their relation type — the
 * factual and the mythic stay visibly distinct groups. */
export function placeRelations(facets: readonly TechnePlaceFacet[]): PlaceRelationGroup[] {
  const groups: PlaceRelationGroup[] = [];
  const byRelation = new Map<string, PlaceRelationGroup>();
  for (const facet of facets) {
    const relation = facet.relation ?? "(relation not disclosed)";
    let group = byRelation.get(relation);
    if (!group) {
      group = { relation, standingClass: relationStandingClass(facet.relation), facets: [] };
      byRelation.set(relation, group);
      groups.push(group);
    }
    group.facets.push(facet);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Movement: an ordered traversal of the reading's own movement facets
// ---------------------------------------------------------------------------

export interface RouteStop {
  place_ref: string;
  /** The identity name standing in the window, when the facet names one. */
  label: string | null;
  /** The facet's own relation, verbatim (expected: TRAVELLED_TO). */
  relation: string;
  /** The validity bound the ordering used, verbatim; null when open. */
  ordering_bound: string | null;
  precision: TechnePlaceFacet["precision"];
}

export interface RouteModel {
  stops: RouteStop[];
  /** Why this is presentation ordering and not a minted route identity. */
  note: string;
}

/**
 * Order the georeferenced movement facets (relation TRAVELLED_TO) by their
 * own validity from-bounds — a PRESENTATION ordering of the reading's own
 * facets, since the contract carries no sequence field. Fewer than two
 * georeferenced stops is no route at all: null, never a forced path. A real
 * route/movement identity must come from a producer (recorded join).
 */
export function routeModel(facets: readonly TechnePlaceFacet[], window?: TimeWindow | null): RouteModel | null {
  const stops: Array<RouteStop & { bound: string | null }> = [];
  for (const facet of facets) {
    if (facet.relation !== MOVEMENT_RELATION) continue;
    const geometry = facet.geometry;
    const georeferenced = geometry?.type === "point" && Array.isArray(geometry.coordinates)
      && typeof geometry.coordinates[0] === "number" && typeof geometry.coordinates[1] === "number";
    if (!georeferenced) continue;
    stops.push({
      place_ref: facet.place_ref,
      label: nameInWindow(facet, window)?.name ?? null,
      relation: facet.relation,
      ordering_bound: facet.valid_from ?? null,
      precision: facet.precision,
      bound: facet.valid_from ?? null,
    });
  }
  if (stops.length < 2) return null;
  // Open bounds order last, stably — never an invented date.
  stops.sort((a, b) => {
    if (a.bound === null && b.bound === null) return 0;
    if (a.bound === null) return 1;
    if (b.bound === null) return -1;
    return a.bound < b.bound ? -1 : a.bound > b.bound ? 1 : 0;
  });
  return {
    stops: stops.map(({ bound: _bound, ...stop }) => stop),
    note: "stops ordered by their own validity from-bounds — a presentation ordering of the reading's "
      + `${MOVEMENT_RELATION} facets; no route identity is minted here`,
  };
}

// ---------------------------------------------------------------------------
// The carried world occasion — Central DAY/NOW refs the reading already bears
// ---------------------------------------------------------------------------

export interface CarriedOccasion {
  day_refs: string[];
  now_refs: string[];
  session_refs: string[];
  run_refs: string[];
  timezone_policy_refs: string[];
}

/**
 * The shared world occasion as the reading itself carries it: the temporal
 * facets' day/now/session/run refs and timezone-policy refs, verbatim and in
 * reading order, de-duplicated. These are native-carried facts (Central owns
 * DAY/NOW); this model consumes them and computes nothing about time.
 */
export function carriedOccasion(temporal: readonly TechneTemporalFacet[] | undefined): CarriedOccasion {
  const occasion: CarriedOccasion = { day_refs: [], now_refs: [], session_refs: [], run_refs: [], timezone_policy_refs: [] };
  const seen = new Set<string>();
  const carry = (list: string[], key: string, value: string | undefined) => {
    if (!value || seen.has(key)) return;
    seen.add(key);
    list.push(value);
  };
  for (const facet of temporal ?? []) {
    carry(occasion.day_refs, `day:${facet.day_ref ?? ""}`, facet.day_ref);
    carry(occasion.now_refs, `now:${facet.now_ref ?? ""}`, facet.now_ref);
    carry(occasion.session_refs, `session:${facet.session_ref ?? ""}`, facet.session_ref);
    carry(occasion.run_refs, `run:${facet.run_ref ?? ""}`, facet.run_ref);
    carry(occasion.timezone_policy_refs, `tz:${facet.timezone_policy_ref ?? ""}`, facet.timezone_policy_ref ?? undefined);
  }
  return occasion;
}

// ---------------------------------------------------------------------------
// The reference-frame depth chain — provider-bound, honestly unavailable
// ---------------------------------------------------------------------------

/** One rung of the M4′ depth ladder (issue #217: M1 → M2 → M3 → M4). */
export type WorldDepth = "m1-harmonic" | "m2-planetary" | "m3-world-clock" | "m4-nara-earthbody";

export type DepthAvailability = "disclosed" | "absent-facet" | "producer-unavailable";

export interface DepthState {
  depth: WorldDepth;
  /** The M′ coordinate the depth belongs to; the geography body itself is
   * this instrument (M4′) and needs no producer. */
  m_prime: 1 | 2 | 3 | 4;
  availability: DepthAvailability;
  /** What the reading itself discloses at this depth, verbatim, when
   * availability is "disclosed". */
  disclosed: string[];
  /** Required when availability is not "disclosed" — the honest reason. */
  reason: string | null;
  /** Privacy constraints that bind this depth, from the reading's own
   * situated-Agency disclosure terms. Never the private state itself. */
  privacy: string[];
}

/** The structural truth of this refinement home (scouted 2026-09-16): the
 * M2/M3/M4 producers are landed as Rust libraries in this repo
 * (`crates/ql-mef/src/m2.rs`, `m2_condition.rs`, `m3_state.rs`, `nara.rs`)
 * but expose no service, CLI or transport leg a renderer surface could call
 * (`ql-service` serves capabilities/locate/refract/relate/synthesise only;
 * the surface tree's only native transport is the desktop kernel bridge,
 * absent here). Renderer-side recomputation of astronomy/QL/personal state
 * is forbidden, so these depths stay explicitly unavailable. */
export const PRODUCER_UNAVAILABLE_REASONS: Record<Exclude<WorldDepth, "m1-harmonic">, string> = {
  "m2-planetary":
    "no M2 planetary/correspondential producer is callable from this surface tree — the ql.m2-engine/v1 "
    + "and ql.m2-condition/v1 producers expose no service, CLI or transport leg here; renderer-side "
    + "recomputation is forbidden",
  "m3-world-clock":
    "no M3 world-clock producer is callable from this surface tree — ql.m3-state/v1 exposes no service, "
    + "CLI or transport leg here; the shared Earth-relative occasion the reading itself carries is shown "
    + "under the occasion refs instead",
  "m4-nara-earthbody":
    "no M4 EarthBody/Nara producer is callable from this surface tree — ql.nara-personal-field/v1 exposes "
    + "no service, CLI or transport leg here; Nara-private state stays outside this disclosure in any case",
};

/**
 * The depth chain of one reading, each rung provider-bound:
 *   M1 harmonic/phase — disclosed only when the warranted QL facet carries a
 *     harmonic reading (the warrant rides the facet; nothing is derived);
 *   M2 planetary/correspondential — producer-bound, currently unavailable;
 *   M3 world-clock — producer-bound, currently unavailable (carried DAY/NOW
 *     occasion refs render separately, from `carriedOccasion`);
 *   M4 EarthBody/Nara — producer-bound, currently unavailable, and
 *     privacy-bounded by the reading's own agency terms.
 */
export function depthChain(reading: TechneReading | null): DepthState[] {
  const privacy = (reading?.agency ?? [])
    .map((role) => role.privacy ?? null)
    .filter((term): term is string => typeof term === "string" && term.trim().length > 0);
  const harmonic = reading?.ql?.harmonic_reading ?? null;
  return [
    {
      depth: "m1-harmonic",
      m_prime: 1,
      availability: harmonic !== null ? "disclosed" : "absent-facet",
      disclosed: harmonic !== null ? [harmonic] : [],
      reason: harmonic !== null
        ? null
        : reading?.ql
          ? "the warranted QL facet discloses no harmonic reading"
          : "no warranted QL facet is disclosed for this subject",
      privacy: [],
    },
    {
      depth: "m2-planetary",
      m_prime: 2,
      availability: "producer-unavailable",
      disclosed: [],
      reason: PRODUCER_UNAVAILABLE_REASONS["m2-planetary"],
      privacy: [],
    },
    {
      depth: "m3-world-clock",
      m_prime: 3,
      availability: "producer-unavailable",
      disclosed: [],
      reason: PRODUCER_UNAVAILABLE_REASONS["m3-world-clock"],
      privacy: [],
    },
    {
      depth: "m4-nara-earthbody",
      m_prime: 4,
      availability: "producer-unavailable",
      disclosed: [],
      reason: PRODUCER_UNAVAILABLE_REASONS["m4-nara-earthbody"],
      privacy,
    },
  ];
}

/** One rung of the scale ladder the World instrument renders (#217):
 * solar/planetary → Earth/shared occasion → geography → region/place/route
 * → Nara/situated body. */
export interface LadderRung {
  rung: "solar-planetary" | "earth-occasion" | "geography" | "places-routes" | "nara-situated";
  label: string;
  availability: DepthAvailability;
  /** What stands at this rung, from the reading only. */
  disclosed: string[];
  reason: string | null;
}

/**
 * The scale ladder of one reading, data-driven: geography and place/route
 * rungs stand when the reading itself carries spatial facets; the occasion
 * rung stands when the reading carries DAY/NOW refs; the solar and Nara
 * rungs follow the producer-bound depth chain. Nothing is fabricated to
 * complete the ladder.
 */
export function referenceFrameLadder(reading: TechneReading | null): LadderRung[] {
  const depths = depthChain(reading);
  const m2 = depths.find((depth) => depth.depth === "m2-planetary");
  const m4 = depths.find((depth) => depth.depth === "m4-nara-earthbody");
  const occasion = carriedOccasion(reading?.temporal);
  const occasionRefs = [...occasion.day_refs, ...occasion.now_refs];
  const facets = reading?.spatial ?? [];
  const routes = routeModel(facets, null);
  const named = facets.filter((facet) => nameInWindow(facet, null) !== null).length;
  return [
    {
      rung: "solar-planetary",
      label: "solar / planetary system",
      availability: m2?.availability ?? "producer-unavailable",
      disclosed: [...(reading?.ql?.harmonic_reading ? [reading.ql.harmonic_reading] : [])],
      reason: m2?.reason ?? null,
    },
    {
      rung: "earth-occasion",
      label: "Earth / shared world occasion",
      availability: occasionRefs.length > 0 ? "disclosed" : "absent-facet",
      disclosed: occasionRefs,
      reason: occasionRefs.length > 0 ? null : "the reading carries no DAY/NOW occasion refs",
    },
    {
      rung: "geography",
      label: "historical / current geography",
      availability: facets.length > 0 ? "disclosed" : "absent-facet",
      disclosed: facets.length > 0 ? [`${facets.length} place facet${facets.length === 1 ? "" : "s"} disclosed`] : [],
      reason: facets.length > 0 ? null : "no place facets are disclosed for this subject",
    },
    {
      rung: "places-routes",
      label: "region / place / route",
      availability: facets.length > 0 ? "disclosed" : "absent-facet",
      disclosed: [
        `${named} named place${named === 1 ? "" : "s"}`,
        routes ? `movement ordering of ${routes.stops.length} ${MOVEMENT_RELATION} stops` : "no movement ordering stands",
      ],
      reason: facets.length > 0 ? null : "no place facets are disclosed for this subject",
    },
    {
      rung: "nara-situated",
      label: "Nara / current situated body",
      availability: m4?.availability ?? "producer-unavailable",
      disclosed: [],
      reason: m4?.reason ?? null,
    },
  ];
}

// ---------------------------------------------------------------------------
// Structured World state for Aletheia_4 / Technē_4
// ---------------------------------------------------------------------------

export interface SelectedPlaceState {
  place_ref: string;
  relation: string | null;
  standing_class: RelationStandingClass;
  precision: TechnePlaceFacet["precision"];
  uncertainty: string | null;
  valid_from: string | null;
  valid_to: string | null;
  source_ref: string | null;
  observer_frame: string | null;
  names: string[];
  /** The parent refs of the facet's own hierarchy, verbatim. */
  hierarchy_refs: string[];
}

export interface WorldState {
  subject_ref: string;
  reading_ref: string;
  snapshot_revision: string | null;
  /** The active presentation body (camera/mode/window are presentation
   * state; reported so an Agency co-refers without scraping the DOM). */
  view: { mode: string; time_window: TimeWindow | null };
  selected: SelectedPlaceState | null;
  relations: PlaceRelationGroup[];
  route: RouteModel | null;
  occasion: CarriedOccasion;
  depths: DepthState[];
  ladder: LadderRung[];
  /** Privacy constraints, verbatim from the reading's agency terms. */
  privacy_constraints: string[];
  /** The disclosed application cuts, verbatim; null when undisclosed. */
  application_cuts: ApplicationCutDisclosure[] | null;
  /** Available cross-open instruments from the reading's own disclosure. */
  cross_open: TechneInstrument[];
  /** The reading's disclosed native Actions, verbatim (routing only). */
  actions: NativeActionRef[];
}

function selectedState(facet: TechnePlaceFacet): SelectedPlaceState {
  return {
    place_ref: facet.place_ref,
    relation: facet.relation ?? null,
    standing_class: relationStandingClass(facet.relation),
    precision: facet.precision,
    uncertainty: facet.uncertainty ?? null,
    valid_from: facet.valid_from ?? null,
    valid_to: facet.valid_to ?? null,
    source_ref: facet.source_ref ?? null,
    observer_frame: facet.observer_frame ?? null,
    names: (facet.identity?.names ?? []).map((entry) => entry.name),
    hierarchy_refs: (facet.hierarchy ?? []).map((entry) => entry.place_ref),
  };
}

/**
 * The structured M4′ state an Aletheia_4 / Technē_4 agency perceives (#217
 * §8): selected place/world relation, active presentation body, validity and
 * uncertainty, the carried world occasion, the provider-bound depth chain,
 * source/standing, privacy constraints, disclosed cuts, cross-open targets
 * and native Actions. Pure and serialisable; refs are the reading's own,
 * verbatim. Native operation routes the Actions through the adapter —
 * nothing here executes.
 */
export function worldState(
  reading: TechneReading | null,
  options: {
    mode: string;
    window: TimeWindow | null;
    selectedRef: string | null;
  },
): WorldState | null {
  if (!reading) return null;
  const facets = reading.spatial ?? [];
  const selected = facets.find((facet) => facet.place_ref === options.selectedRef) ?? null;
  const relations = placeRelations(facets);
  const depths = depthChain(reading);
  const available = new Set((reading.disclosure.instruments ?? []).filter((entry) => entry.available).map((entry) => entry.instrument));
  available.delete("place");
  return {
    subject_ref: reading.subject.subject_ref,
    reading_ref: reading.reading_ref,
    snapshot_revision: reading.snapshot?.revision ?? null,
    view: { mode: options.mode, time_window: options.window },
    selected: selected ? selectedState(selected) : null,
    relations,
    route: routeModel(facets, options.window),
    occasion: carriedOccasion(reading.temporal),
    depths,
    ladder: referenceFrameLadder(reading),
    privacy_constraints: depths.flatMap((depth) => depth.privacy),
    application_cuts: reading.disclosure.application_cuts ?? null,
    cross_open: [...available],
    actions: reading.actions ?? [],
  };
}
