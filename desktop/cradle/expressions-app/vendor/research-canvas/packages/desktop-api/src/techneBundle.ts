/**
 * ql.techne/v1 → Research Canvas substrate bridge (lane T2-transport).
 *
 * `bundleFromTechneReadings` converts an array of ql.techne/v1 reading objects
 * (canonical contract: Quaternal-Logic `schemas/techne/ql-techne-reading-v1.schema.json`)
 * into the substrate-shaped records the read-only `createTechneTransport`
 * serves. The bridge is for migration/adaptation, not a second business layer
 * (Wayfinder §12): it adds no domain semantics, no substrate record produced
 * here is canonical, and conversions are pure — no clock, no randomness — so
 * identical readings convert byte-identically. Absent facets produce absent
 * records, never placeholders.
 *
 * Mapping table (reading field → substrate record field):
 *
 *   subject.subject_ref / whole.whole_ref / whole.member_refs[] /
 *   whole.focus_refs[] / whole.relations[].{from_ref,to_ref}
 *       → GraphNode.graphNodeId, used VERBATIM (never minted, never
 *         rewritten). Relation endpoints get pointer nodes so no served
 *         relationship dangles. Node title is the native ref itself — the
 *         contract discloses no display name, and minting one would be a new
 *         semantic. Node entityType is "Source" (the substrate's neutral
 *         native-record type) except spatial facets, which become "Place".
 *   subject.kind → subject node `sourceKind`, verbatim.
 *   whole.relations[].relation → GraphRelationship.relType, VERBATIM (never
 *       relabelled into the substrate vocabulary).
 *   whole.relations[].origin / .origin_ref
 *       → properties.relation_origin / properties.relation_origin_ref, verbatim.
 *   every relationship → properties.techne_origin = reading_ref (the
 *       pointer back to its native reading) and id =
 *       `techne:rel:<reading_ref>:<n>` — the one bridge-minted identifier;
 *       native refs are never minted.
 *   temporal[i] with instant/interval → one anchor GraphNode: graphNodeId is
 *       facet_ref when disclosed, otherwise the derived
 *       `${subject_ref}@techne:temporal:${kind}:${i}`; isTemporal = true;
 *       validFrom/validTo are the instant / interval bounds verbatim;
 *       temporalPrecision is the facet precision verbatim when the substrate
 *       enum can carry it (millennium|century|decade|year|month|day).
 *       Finer-than-day precisions (hour|minute|second|subsecond) and absent
 *       precision coarsen to "day" — an understatement that never claims more
 *       precision than the source warrants, because the substrate runtime
 *       model cannot be widened here; the anchor instants themselves keep
 *       their full precision verbatim. A relationship subject→anchor with
 *       relType = the facet kind (verbatim: occurrence, receipt, day, run…)
 *       links the anchor, so occurrence and receipt stay distinct records.
 *   temporal[i] with only day_ref/now_ref/session_ref/run_ref (no instant) →
 *       no anchor node; a relationship subject→ref with relType = kind
 *       (verbatim) plus a pointer node for the target ref. Every facet's
 *       continuity refs ride the relationship properties verbatim.
 *   spatial[i] → Place GraphNode carrying the Temporal Place projection:
 *       precision enum verbatim (exact|approximate|region|unlocated);
 *       names verbatim with language "und" (the contract discloses none);
 *       hierarchy as parentPlaceId + validity verbatim (the substrate
 *       hierarchy entry has no relation-label slot); validity as
 *       identityValidFrom/To; source_ref into node sourceCoordinates.
 *   expressions[i].scene_ref → Scene stub, id = scene_ref verbatim. Fields
 *       the contract does not disclose carry explicit neutral carriers
 *       (TECHNE_NO_TIME_DISCLOSED, TECHNE_UNDISCLOSED_PLACE_ID) that resolve
 *       to nothing, so surfaces degrade honestly instead of acting on a
 *       fabricated place or time.
 *   expressions[i].composition_ref → SceneSequence stub, id = composition_ref
 *       verbatim, sceneIds = its scenes.
 *   disclosure → one TechneBundleDiagnostic per reading listing the
 *       unavailable and degraded instruments, so surfaces can honestly
 *       degrade.
 *
 * Not projected on purpose: the ql facet (the substrate's ql* GraphNode
 * columns are Research Canvas domain semantics, not ql.techne/v1 facts) and
 * provenance selectors / native actions (no substrate slot; they stay with
 * the reading, which remains the owner of its own meaning).
 */

import { EMPTY_GRAPH_NODE_METADATA } from "@research-canvas/schema";

import type { GraphNode, GraphRelationship } from "./graph";
import type { Scene, SceneSequence } from "./scenes";

/**
 * Minimal structural mirror of a ql.techne/v1 reading (see the canonical
 * schema for the authoritative contract). Field names stay in the contract's
 * snake_case; vocabulary-bearing values are typed loosely on purpose so
 * provider vocabulary is never narrowed away.
 */
export interface TechneReadingLite {
  contract?: string;
  reading_ref: string;
  snapshot?: { revision?: string | null; basis_ref?: string | null };
  subject: {
    subject_ref: string;
    native_owner: string;
    native_revision?: string | null;
    readings?: Array<{ ref: string; revision?: string | null }>;
    kind?: string | null;
    standing?: string | null;
  };
  whole?: {
    whole_ref: string;
    member_refs?: string[];
    relations?: TechneRelationLite[];
    focus_refs?: string[];
  };
  /** Carried for provenance; intentionally not projected (see header). */
  ql?: {
    address?: string | null;
    shape_ref?: string | null;
    constellation_ref?: string | null;
    lens_ref?: string | null;
    sublens_ref?: string | null;
    context_frame_ref?: string | null;
    warrant: { result_class: string; evidence_refs: string[]; provenance_ref: string };
  };
  temporal?: TechneTemporalFacetLite[];
  spatial?: TechnePlaceFacetLite[];
  provenance?: TechneSourceProvenanceLite[];
  expressions?: TechneExpressionBindingLite[];
  actions?: TechneNativeActionLite[];
  disclosure: TechneDisclosureLite;
}

export interface TechneRelationLite {
  relation: string;
  from_ref: string;
  to_ref: string;
  origin?: string | null;
  origin_ref?: string | null;
}

export interface TechneTemporalFacetLite {
  facet_ref?: string | null;
  kind: string;
  instant?: string;
  interval?: {
    from?: string | null;
    to?: string | null;
    from_precision?: string | null;
    to_precision?: string | null;
  };
  precision?: string;
  day_ref?: string;
  now_ref?: string;
  session_ref?: string;
  run_ref?: string;
  timezone_policy_ref?: string | null;
  uncertainty?: string | null;
  source_ref?: string | null;
}

export interface TechnePlaceFacetLite {
  place_ref: string;
  identity?: {
    names?: Array<{ name: string; valid_from?: string | null; valid_to?: string | null }>;
  };
  geometry?: { type: "point" | "polygon"; coordinates?: unknown };
  precision: "exact" | "approximate" | "region" | "unlocated";
  hierarchy?: Array<{
    place_ref: string;
    relation: string;
    valid_from?: string | null;
    valid_to?: string | null;
  }>;
  valid_from?: string | null;
  valid_to?: string | null;
  observer_frame?: string | null;
  source_ref?: string | null;
}

export interface TechneSourceProvenanceLite {
  source_ref: string;
  source_revision?: string | null;
  native_owner: string;
  selector?: unknown;
  standing?: string | null;
  evidence_refs?: string[];
}

export interface TechneExpressionBindingLite {
  expression_ref: string;
  revision?: string | null;
  scene_ref?: string | null;
  composition_ref?: string | null;
  profile_ref?: string | null;
}

export interface TechneNativeActionLite {
  action_ref: string;
  native_owner: string;
  authority: string;
  summary?: string | null;
  expected_effects?: string[];
  input_schema_ref?: string | null;
}

export interface TechneDisclosureLite {
  instruments: Array<{ instrument: string; available: boolean; reason?: string }>;
  degraded?: Array<{ instrument: string; reason: string }>;
  suggestions?: Array<{ instrument: string; reason: string }>;
}

export interface TechneBundleDiagnostic {
  reading_ref: string;
  subject_ref: string;
  unavailable: Array<{ instrument: string; reason: string }>;
  degraded: Array<{ instrument: string; reason: string }>;
}

/** One bounded local whole per reading (Wayfinder §18 T2: no global hairball). */
export interface TechneBundleCanvas {
  canvasId: string;
  readingRef: string;
  nodeIds: string[];
  relationshipIds: string[];
}

export interface TechneFieldBundle {
  /** Stable workspace identity the timeline/palace reads expect. */
  workspaceId: string;
  readingRefs: string[];
  canvases: TechneBundleCanvas[];
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  scenes: Scene[];
  sceneSequences: SceneSequence[];
  diagnostics: TechneBundleDiagnostic[];
}

/** Stable workspace identity for any techne field bundle. */
export const TECHNE_WORKSPACE_ID = "techne:field-bundle:v1";

/** The canvas id of one reading's bounded local whole. */
export function techneCanvasId(readingRef: string): string {
  return `techne:canvas:${readingRef}`;
}

/**
 * Projection-record timestamp: NOT a native fact. A fixed epoch keeps
 * conversions deterministic (byte-equal for identical readings); nothing
 * about the native record's age is claimed.
 */
const PROJECTION_EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * The scene stub's time carrier: the contract does not disclose a scene time,
 * so the stub carries this explicit neutral instant (which matches nothing)
 * rather than a fabricated window.
 */
export const TECHNE_NO_TIME_DISCLOSED = "1970-01-01T00:00:00.000Z";

/** The scene stub's place carrier: matches no place, resolves to nothing. */
export const TECHNE_UNDISCLOSED_PLACE_ID = "techne:place:undisclosed";

type SubstrateTemporalPrecision = NonNullable<GraphNode["temporalPrecision"]>;

const SUBSTRATE_TEMPORAL_PRECISIONS: ReadonlySet<string> = new Set([
  "millennium",
  "century",
  "decade",
  "year",
  "month",
  "day",
]);

function substrateTemporalPrecision(precision: string | null | undefined): SubstrateTemporalPrecision {
  if (precision !== null && precision !== undefined && SUBSTRATE_TEMPORAL_PRECISIONS.has(precision)) {
    return precision as SubstrateTemporalPrecision;
  }
  // Finer-than-day precision or no precision at all: coarsen to "day". The
  // substrate enum cannot carry the finer value and coarsening never claims
  // more precision than the source warrants; the anchor instants themselves
  // stay verbatim.
  return "day";
}

function pointerNode(graphNodeId: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    graphNodeId,
    entityType: "Source",
    // No display name is disclosed by the contract; the native ref itself is
    // the title, so nothing is minted and ref fragments stay searchable.
    title: graphNodeId,
    body: "",
    summary: "",
    archetypalResonance: null,
    coordinate: null,
    sourceCoordinates: [],
    ...EMPTY_GRAPH_NODE_METADATA,
    isTemporal: false,
    validFrom: null,
    validTo: null,
    temporalPrecision: null,
    createdAt: PROJECTION_EPOCH,
    updatedAt: PROJECTION_EPOCH,
    ...overrides,
  };
}

type TemporalPlaceProjection = NonNullable<GraphNode["place"]>;

function placeProjectionFrom(facet: TechnePlaceFacetLite): TemporalPlaceProjection {
  const names = (facet.identity?.names ?? []).map((name) => ({
    // The contract discloses no language; "und" (undetermined) is carried
    // because the substrate projection requires the slot.
    language: "und",
    name: name.name,
    validFrom: name.valid_from ?? null,
    validTo: name.valid_to ?? null,
  }));
  // Native place names are optional. Preserve that absence; the host supplies
  // a display label independently, never an authored place identity.

  return {
    graphNodeId: facet.place_ref,
    names,
    coordinate: placeCoordinateFrom(facet),
    hierarchy: (facet.hierarchy ?? []).map((entry) => ({
      parentPlaceId: entry.place_ref,
      relationValidFrom: entry.valid_from ?? null,
      relationValidTo: entry.valid_to ?? null,
    })),
    identityValidFrom: facet.valid_from ?? null,
    identityValidTo: facet.valid_to ?? null,
    // The contract carries no gazetteer identity; adding one would be fabrication.
    externalRefs: [],
    // Passage refs need a native selector unit; the contract's bare source_ref
    // rides the node's sourceCoordinates instead.
    provenance: { sourceRefs: [] },
  };
}

function placeCoordinateFrom(facet: TechnePlaceFacetLite): TemporalPlaceProjection["coordinate"] {
  const geometry = facet.geometry;

  if (facet.precision === "unlocated") {
    return { precision: "unlocated" };
  }

  if (facet.precision === "region") {
    if (!geometry || geometry.type !== "polygon") {
      throw new Error(`techne place ${facet.place_ref}: precision "region" requires polygon geometry`);
    }
    return {
      precision: "region",
      geometry: {
        type: "Polygon",
        coordinates: geometry.coordinates as [number, number][][],
      },
    };
  }

  if (!geometry || geometry.type !== "point") {
    throw new Error(
      `techne place ${facet.place_ref}: precision "${facet.precision}" requires point geometry`,
    );
  }
  const coordinates = geometry.coordinates;
  if (
    !Array.isArray(coordinates)
    || coordinates.length < 2
    || typeof coordinates[0] !== "number"
    || typeof coordinates[1] !== "number"
  ) {
    throw new Error(
      `techne place ${facet.place_ref}: point geometry must be [longitude, latitude]`,
    );
  }
  // GeoJSON position order: [longitude, latitude].
  return {
    precision: facet.precision,
    longitude: coordinates[0],
    latitude: coordinates[1],
  };
}

function sceneStub(readingRef: string, sceneRef: string): Scene {
  return {
    id: sceneRef,
    profileScope: `techne:${readingRef}`,
    placeFrame: {
      placeId: TECHNE_UNDISCLOSED_PLACE_ID,
      validAt: { instant: TECHNE_NO_TIME_DISCLOSED },
    },
    timeWindow: { start: TECHNE_NO_TIME_DISCLOSED, end: TECHNE_NO_TIME_DISCLOSED },
    people: [],
    passages: [],
    consents: [],
    redactions: [],
    languageVariants: [],
    assembledBy: "agent",
    curationEvents: [],
    nestedSequenceIds: [],
    createdAt: PROJECTION_EPOCH,
    updatedAt: PROJECTION_EPOCH,
  };
}

function sequenceStub(readingRef: string, compositionRef: string, sceneIds: string[]): SceneSequence {
  return {
    id: compositionRef,
    profileScope: `techne:${readingRef}`,
    sceneIds,
    createdAt: PROJECTION_EPOCH,
    updatedAt: PROJECTION_EPOCH,
  };
}

/**
 * Convert ql.techne/v1 readings into the substrate-shaped records the
 * read-only techne transport serves. Pure and total: identical inputs yield
 * byte-identical bundles; absent facets yield absent records; contradictory
 * input (a precision its geometry cannot back, an unnamed place, a facet
 * with neither an instant nor a continuity ref) fails loudly instead of
 * producing a quietly wrong record.
 */
export function bundleFromTechneReadings(readings: TechneReadingLite[]): TechneFieldBundle {
  const nodes = new Map<string, GraphNode>();
  const relationships: GraphRelationship[] = [];
  const scenes: Scene[] = [];
  const sceneSequences = new Map<string, SceneSequence>();
  const diagnostics: TechneBundleDiagnostic[] = [];
  const canvases: TechneBundleCanvas[] = [];

  for (const reading of readings) {
    const readingRef = reading.reading_ref;
    const subjectRef = reading.subject.subject_ref;
    const canvas: TechneBundleCanvas = {
      canvasId: techneCanvasId(readingRef),
      readingRef,
      nodeIds: [],
      relationshipIds: [],
    };
    const membership = new Set<string>();
    let relationshipCounter = 0;
    const relationshipStart = relationships.length;

    const ensureNode = (ref: string, overrides?: Partial<GraphNode>) => {
      if (!nodes.has(ref)) {
        nodes.set(ref, pointerNode(ref, overrides));
      }
      membership.add(ref);
    };

    const pushRelationship = (
      relType: string,
      fromRef: string,
      toRef: string,
      extra: Record<string, unknown>,
    ) => {
      const relationship: GraphRelationship = {
        id: `techne:rel:${readingRef}:${relationshipCounter}`,
        // Provider relation vocabulary, verbatim — never relabelled.
        relType,
        sourceGraphNodeId: fromRef,
        targetGraphNodeId: toRef,
        properties: { techne_origin: readingRef, ...extra },
      };
      relationshipCounter += 1;
      relationships.push(relationship);
    };

    ensureNode(subjectRef, { sourceKind: reading.subject.kind ?? null });

    const whole = reading.whole;
    if (whole) {
      ensureNode(whole.whole_ref);
      for (const memberRef of whole.member_refs ?? []) {
        ensureNode(memberRef);
      }
      for (const focusRef of whole.focus_refs ?? []) {
        ensureNode(focusRef);
      }
      for (const relation of whole.relations ?? []) {
        ensureNode(relation.from_ref);
        ensureNode(relation.to_ref);
        pushRelationship(relation.relation, relation.from_ref, relation.to_ref, {
          relation_origin: relation.origin ?? null,
          relation_origin_ref: relation.origin_ref ?? null,
        });
      }
    }

    (reading.temporal ?? []).forEach((facet, index) => {
      const temporalProperties = {
        temporal_kind: facet.kind,
        temporal_uncertainty: facet.uncertainty ?? null,
        temporal_source_ref: facet.source_ref ?? null,
        temporal_day_ref: facet.day_ref ?? null,
        temporal_now_ref: facet.now_ref ?? null,
        temporal_session_ref: facet.session_ref ?? null,
        temporal_run_ref: facet.run_ref ?? null,
      };
      const instant = facet.instant ?? null;
      const intervalFrom = facet.interval?.from ?? null;
      const intervalTo = facet.interval?.to ?? null;
      const validFrom = instant ?? intervalFrom;

      if (validFrom !== null) {
        // One anchor record per temporal facet: occurrence, receipt, validity
        // and continuity stay distinct; nothing collapses onto the subject.
        const anchorId =
          facet.facet_ref ?? `${subjectRef}@techne:temporal:${facet.kind}:${index}`;
        ensureNode(anchorId, {
          isTemporal: true,
          validFrom,
          validTo: intervalTo ?? null,
          temporalPrecision: substrateTemporalPrecision(
            facet.precision ?? facet.interval?.from_precision ?? facet.interval?.to_precision,
          ),
        });
        pushRelationship(facet.kind, subjectRef, anchorId, temporalProperties);
        return;
      }

      const continuityRef =
        facet.day_ref ?? facet.now_ref ?? facet.session_ref ?? facet.run_ref ?? null;
      if (continuityRef !== null) {
        ensureNode(continuityRef);
        pushRelationship(facet.kind, subjectRef, continuityRef, temporalProperties);
        return;
      }

      throw new Error(
        `techne reading ${readingRef}: temporal facet ${index} carries neither an instant/interval nor a continuity ref`,
      );
    });

    for (const facet of reading.spatial ?? []) {
      ensureNode(facet.place_ref, {
        entityType: "Place",
        place: placeProjectionFrom(facet),
        sourceCoordinates: facet.source_ref ? [facet.source_ref] : [],
      });
    }

    const sceneIdsByComposition = new Map<string, string[]>();
    for (const expression of reading.expressions ?? []) {
      if (expression.scene_ref) {
        scenes.push(sceneStub(readingRef, expression.scene_ref));
        if (expression.composition_ref) {
          const ids = sceneIdsByComposition.get(expression.composition_ref) ?? [];
          ids.push(expression.scene_ref);
          sceneIdsByComposition.set(expression.composition_ref, ids);
        }
      }
    }
    for (const [compositionRef, sceneIds] of sceneIdsByComposition) {
      sceneSequences.set(
        compositionRef,
        sequenceStub(readingRef, compositionRef, sceneIds),
      );
    }

    diagnostics.push({
      reading_ref: readingRef,
      subject_ref: subjectRef,
      unavailable: (reading.disclosure.instruments ?? [])
        .filter((entry) => entry.available === false)
        .map((entry) => ({
          instrument: entry.instrument,
          reason: entry.reason ?? "instrument unavailable",
        })),
      degraded: (reading.disclosure.degraded ?? []).map((entry) => ({
        instrument: entry.instrument,
        reason: entry.reason,
      })),
    });

    canvas.nodeIds = [...membership];
    canvas.relationshipIds = relationships
      .slice(relationshipStart)
      .map((relationship) => relationship.id);
    canvases.push(canvas);
  }

  return {
    workspaceId: TECHNE_WORKSPACE_ID,
    readingRefs: readings.map((reading) => reading.reading_ref),
    canvases,
    nodes: [...nodes.values()],
    relationships,
    scenes,
    sceneSequences: [...sceneSequences.values()],
    diagnostics,
  };
}
