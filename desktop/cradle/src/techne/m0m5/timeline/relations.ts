/**
 * The M2′ Relation Field model (QL-MEF #215) — pure projections over a
 * reading's native typed relations. This is the non-chronological half of
 * the Timeline instrument's office: becoming, efficient relation,
 * transformation, recurrence, opposition, phase.
 *
 * Laws this module keeps:
 *   - PROJECTIONS, NOT A STORE: everything here is derived from
 *     `whole.relations[]` + `temporal[]` as the owner disclosed them; no
 *     relation is re-keyed, no participant minted, no date invented. A
 *     relation without a temporal qualification is trans-temporal and stays
 *     so — `Do not invent chronology for non-chronological relation`.
 *   - TEMPORAL QUALIFICATION RESOLVES HONESTLY: a relation's
 *     `temporal_facet_ref` must resolve to a `facet_ref` in the same
 *     reading's `temporal[]`; a dangling ref is "unresolved" and is
 *     reported, never silently dated and never silently dropped.
 *   - TYPED RELATIONS KEEP THEIR IDENTITY: INSTANTIATES ≠ ECHOES ≠ CAUSES ≠
 *     INFLUENCES ≠ OPPOSES ≠ INHERITS ≠ TRANSFORMS_INTO ≠ SOURCED_FROM ≠
 *     RESONATES_WITH. Family classification is pattern-based and explicit;
 *     an unrecognised relation type lands only in the relation field itself
 *     — it never silently joins cause, echo or opposition.
 *   - EPISTEMIC STANDING IS OWNER-SUPPLIED: the visual grammar lives in
 *     `./standing` and is mechanical; nothing here infers standing,
 *     confidence or derivation.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {
  TechneReading,
  TechneTemporalFacet,
  TechneWholeRelation,
} from "../../contract.ts";
import { standingOf, type StandingVisual } from "./standing.ts";
import { facetRange } from "./scale.ts";

// ---------------------------------------------------------------------------
// The edge model
// ---------------------------------------------------------------------------

/** How a relation's temporal qualification resolved against the reading. */
export type RelationTemporalState = "dated" | "trans-temporal" | "unresolved";

export interface RelationTemporalQualification {
  state: RelationTemporalState;
  /** The owner's verbatim temporal_facet_ref (may name an unpositioned
   * facet — continuity without wall-clock time). */
  facet_ref: string | null;
  /** Resolved facet kind (e.g. occurrence, valid) when the ref resolved. */
  facet_kind: string | null;
  positioned: boolean;
  fromMs: number | null;
  toMs: number | null;
  /** For "unresolved": what went wrong, verbatim-ish, for honest display. */
  problem: string | null;
}

export interface RelationEdge {
  /** The relation's stable identity: the native relation_ref when the owner
   * supplies one, otherwise a derived stable id (position in the reading) —
   * fit for focus_refs, never passed off as a native ref. */
  id: string;
  /** True when `id` is derived rather than a native relation_ref. */
  derived_id: boolean;
  /** The provider's relation vocabulary, verbatim — never relabelled. */
  relation: string;
  from_ref: string;
  to_ref: string;
  /** Coarse visual class from `./standing` — presentation only. */
  standing_visual: StandingVisual;
  /** The owner's verbatim standing string, or null. */
  standing_verbatim: string | null;
  origin: string | null;
  origin_ref: string | null;
  source_ref: string | null;
  evidence_refs: string[];
  derivation_ref: string | null;
  confidence: string | null;
  temporal: RelationTemporalQualification;
}

function derivedEdgeId(index: number): string {
  return `derived:techne:relation[${index}]`;
}

/**
 * Resolve a relation's temporal qualification against the reading's own
 * temporal facets. Absent ref = trans-temporal (the honest default). A ref
 * that names no facet in the reading is "unresolved" and reported — never
 * silently dated, never silently dropped.
 */
export function resolveTemporalQualification(
  relation: Pick<TechneWholeRelation, "temporal_facet_ref">,
  temporal: readonly TechneTemporalFacet[],
): RelationTemporalQualification {
  const ref = relation.temporal_facet_ref ?? null;
  if (ref === null) {
    return { state: "trans-temporal", facet_ref: null, facet_kind: null, positioned: false, fromMs: null, toMs: null, problem: null };
  }
  const facet = temporal.find((candidate) => candidate.facet_ref === ref);
  if (!facet) {
    return { state: "unresolved", facet_ref: ref, facet_kind: null, positioned: false, fromMs: null, toMs: null, problem: `temporal_facet_ref ${ref} names no facet in this reading's temporal[]` };
  }
  const span = facetRange(facet);
  return {
    state: span.positioned ? "dated" : "unresolved",
    facet_ref: ref,
    facet_kind: facet.kind,
    positioned: span.positioned,
    fromMs: span.fromMs,
    toMs: span.toMs,
    problem: span.positioned ? null : `temporal_facet_ref ${ref} resolves to a facet with no wall-clock position (continuity without a date)`,
  };
}

/** All edges of one reading's whole, with standing and temporal resolution. */
export function relationEdges(reading: TechneReading): RelationEdge[] {
  const relations = reading.whole?.relations ?? [];
  const temporal = reading.temporal ?? [];
  return relations.map((relation, index) => {
    const native = relation.relation_ref ?? null;
    const standing = standingOf(relation);
    return {
      id: native ?? derivedEdgeId(index),
      derived_id: native === null,
      relation: relation.relation,
      from_ref: relation.from_ref,
      to_ref: relation.to_ref,
      standing_visual: standing.visual,
      standing_verbatim: standing.verbatim,
      origin: relation.origin ?? null,
      origin_ref: relation.origin_ref ?? null,
      source_ref: relation.source_ref ?? null,
      evidence_refs: relation.evidence_refs ?? [],
      derivation_ref: relation.derivation_ref ?? null,
      confidence: relation.confidence ?? null,
      temporal: resolveTemporalQualification(relation, temporal),
    };
  });
}

// ---------------------------------------------------------------------------
// The relation field
// ---------------------------------------------------------------------------

export interface RelationParticipant {
  ref: string;
  /** Distinct relation types this participant touches, verbatim. */
  relations: string[];
  outgoing: number;
  incoming: number;
}

export interface RelationFamily {
  /** The relation type, verbatim. */
  relation: string;
  edges: RelationEdge[];
}

export interface RelationField {
  reading_ref: string;
  whole_ref: string | null;
  edges: RelationEdge[];
  participants: RelationParticipant[];
  /** Edges grouped by verbatim relation type, in first-appearance order. */
  families: RelationFamily[];
  /** Temporal qualification refs that did not resolve — reported, never
   * silently repaired. */
  unresolved_temporal_refs: string[];
  /** Distinct relation types no family rule recognises. */
  unclassified_relations: string[];
}

/** The whole relation field of one reading. */
export function relationField(reading: TechneReading): RelationField {
  const edges = relationEdges(reading);
  const participants = new Map<string, RelationParticipant>();
  const families = new Map<string, RelationFamily>();
  for (const edge of edges) {
    for (const [ref, direction] of [[edge.from_ref, "outgoing"], [edge.to_ref, "incoming"]] as const) {
      let participant = participants.get(ref);
      if (!participant) {
        participant = { ref, relations: [], outgoing: 0, incoming: 0 };
        participants.set(ref, participant);
      }
      participant[direction] += 1;
      if (!participant.relations.includes(edge.relation)) participant.relations.push(edge.relation);
    }
    let family = families.get(edge.relation);
    if (!family) {
      family = { relation: edge.relation, edges: [] };
      families.set(edge.relation, family);
    }
    family.edges.push(edge);
  }
  return {
    reading_ref: reading.reading_ref,
    whole_ref: reading.whole?.whole_ref ?? null,
    edges,
    participants: [...participants.values()],
    families: [...families.values()],
    unresolved_temporal_refs: edges
      .filter((edge) => edge.temporal.state === "unresolved" && edge.temporal.facet_ref !== null)
      .map((edge) => edge.temporal.facet_ref as string),
    unclassified_relations: [...families.keys()].filter((relation) => projectionForRelation(relation) === "field"),
  };
}

// ---------------------------------------------------------------------------
// Projection families — explicit patterns; unknown types never join silently
// ---------------------------------------------------------------------------

export type RelationProjectionMode =
  | "timeline"
  | "relations"
  | "cause"
  | "echo"
  | "opposition"
  | "phase"
  | "activity";

export type RelationFamilyName = "cause" | "echo" | "opposition" | "field";

const FAMILY_RULES: readonly { family: Exclude<RelationFamilyName, "field">; pattern: RegExp }[] = [
  // Becoming / efficient relation: something brings something else about or
  // depends on it. SOURCED_FROM is provenance-causal (the claim flows from
  // its source) — distinct from CAUSES and kept distinct here only as
  // family membership; the type string itself is always what is shown.
  { family: "cause", pattern: /^(causes?|influences?|depends[ _-]?on|triggers?|prevents?|blocks?|enables?|sourced[ _-]?from)$/i },
  // Recurrence / echo / trans-temporal resonance: ECHOES, RESONATES_WITH,
  // INSTANTIATES (a dated instance instantiating a trans-temporal work),
  // recurrence.
  { family: "echo", pattern: /^(echo(es)?|resonates?[ _-]?with|instantiates|recurs?([ _-]?with)?|parallels?)$/i },
  // Opposition / inheritance / transformation.
  { family: "opposition", pattern: /^(opposes?|contradicts?|conflicts?[ _-]?with|inherits?|transforms?[ _-]?into|evolves?[ _-]?into|supersedes)$/i },
];

/** Which projection family a relation type belongs to. "field" means the
 * relation shows in the relation field only — an unrecognised type never
 * silently becomes causal, echoing or oppositional. */
export function projectionForRelation(relation: string): RelationFamilyName {
  for (const rule of FAMILY_RULES) {
    if (rule.pattern.test(relation.trim())) return rule.family;
  }
  return "field";
}

export function edgesForProjection(edges: readonly RelationEdge[], mode: RelationProjectionMode): RelationEdge[] {
  if (mode === "relations") return [...edges];
  const family = mode as Exclude<RelationFamilyName, "field">;
  return edges.filter((edge) => projectionForRelation(edge.relation) === family);
}

// ---------------------------------------------------------------------------
// Per-projection availability — capability honesty for the mode bar
// ---------------------------------------------------------------------------

export interface ProjectionAvailability {
  mode: RelationProjectionMode;
  available: boolean;
  /** Edge/facet count when available. */
  count: number | null;
  /** The honest reason when unavailable. */
  reason: string | null;
}

const CONTINUITY_KINDS: readonly string[] = ["day", "now", "session", "run"];

/** Availability of every projection over one reading, from its actual data. */
export function projectionAvailability(reading: TechneReading): ProjectionAvailability[] {
  const field = relationField(reading);
  const temporal = reading.temporal ?? [];
  const continuityCount = temporal.filter((facet) => CONTINUITY_KINDS.includes(facet.kind)).length;
  const validityFacets = temporal.filter((facet) => facet.kind === "valid");
  const cycles = transformationCycles(field.edges);
  const datedEdges = field.edges.filter((edge) => edge.temporal.state === "dated").length;
  const modes: { mode: RelationProjectionMode; available: boolean; count: number | null; reason: string | null }[] = [
    { mode: "timeline", available: temporal.length > 0 || datedEdges > 0, count: temporal.length + datedEdges || null, reason: temporal.length === 0 && datedEdges === 0 ? "no temporal facets and no dated relations are disclosed — nothing is placed on a time axis, and none is invented" : null },
    { mode: "relations", available: field.edges.length > 0, count: field.edges.length || null, reason: field.edges.length === 0 ? "the reading discloses no typed relations" : null },
    { mode: "cause", available: edgesForProjection(field.edges, "cause").length > 0, count: edgesForProjection(field.edges, "cause").length || null, reason: edgesForProjection(field.edges, "cause").length === 0 ? "no CAUSES / INFLUENCES / dependency-family relations are disclosed" : null },
    { mode: "echo", available: edgesForProjection(field.edges, "echo").length > 0, count: edgesForProjection(field.edges, "echo").length || null, reason: edgesForProjection(field.edges, "echo").length === 0 ? "no ECHOES / RESONATES_WITH / INSTANTIATES-family relations are disclosed" : null },
    { mode: "opposition", available: edgesForProjection(field.edges, "opposition").length > 0, count: edgesForProjection(field.edges, "opposition").length || null, reason: edgesForProjection(field.edges, "opposition").length === 0 ? "no OPPOSES / INHERITS / TRANSFORMS_INTO-family relations are disclosed" : null },
    { mode: "phase", available: validityFacets.length > 0 || cycles.length > 0, count: validityFacets.length + cycles.length || null, reason: validityFacets.length === 0 && cycles.length === 0 ? "no validity intervals and no transformation cycles are disclosed — no phase is fabricated" : null },
    { mode: "activity", available: continuityCount > 0, count: continuityCount || null, reason: continuityCount === 0 ? "no DAY / NOW / session / run continuity facets are disclosed" : null },
  ];
  return modes;
}

// ---------------------------------------------------------------------------
// Cause chains and transformation cycles — walks over the owner's directions
// ---------------------------------------------------------------------------

/**
 * Maximal directed chains within one edge set, following the owner's own
 * from → to directions (A —CAUSES→ B —CAUSES→ C). Purely structural: no
 * chronology is inferred — an undated edge chains exactly like a dated one
 * and carries its absence with it. Deterministic: edges extend forward by
 * lowest id first, chains are ordered by their first edge's id, and an edge
 * already claimed by a chain starts none.
 */
export function directedChains(edges: readonly RelationEdge[]): RelationEdge[][] {
  const byFrom = new Map<string, RelationEdge[]>();
  for (const edge of edges) {
    const list = byFrom.get(edge.from_ref) ?? [];
    list.push(edge);
    byFrom.set(edge.from_ref, list);
  }
  const chains: RelationEdge[][] = [];
  const visited = new Set<string>();
  for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (visited.has(edge.id)) continue;
    const chain: RelationEdge[] = [edge];
    for (;;) {
      const tip = chain[chain.length - 1];
      const next = (byFrom.get(tip.to_ref) ?? [])
        .filter((candidate) => !chain.some((entry) => entry.id === candidate.id))
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!next) break;
      chain.push(next);
    }
    for (const entry of chain) visited.add(entry.id);
    chains.push(chain);
  }
  return chains;
}

/** Convenience: the causal-chain projection of a whole field. */
export function causalChains(field: RelationField): RelationEdge[][] {
  return directedChains(edgesForProjection(field.edges, "cause"));
}

/**
 * Cycles within one edge set (e.g. TRANSFORMS_INTO loops — the phase/cycle
 * projection). Each cycle is reported once, starting from its lowest-id
 * edge. Deterministic. No chronology: a cycle is a structure the owner's
 * directions assert, not a schedule.
 */
export function cyclesOf(edges: readonly RelationEdge[]): RelationEdge[][] {
  const byFrom = new Map<string, RelationEdge[]>();
  for (const edge of edges) {
    const list = byFrom.get(edge.from_ref) ?? [];
    list.push(edge);
    byFrom.set(edge.from_ref, list);
  }
  const cycles: RelationEdge[][] = [];
  // A cycle is reported once, keyed by its canonical (id-sorted) membership.
  const seen = new Set<string>();
  const visit = (start: RelationEdge, chain: RelationEdge[]): void => {
    const tip = chain[chain.length - 1];
    for (const next of (byFrom.get(tip.to_ref) ?? []).sort((a, b) => a.id.localeCompare(b.id))) {
      if (next.id === start.id) {
        const key = chain.map((entry) => entry.id).sort().join(">");
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push([...chain]);
        }
        continue;
      }
      if (chain.some((entry) => entry.id === next.id)) continue;
      visit(start, [...chain, next]);
    }
  };
  for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
    visit(edge, [edge]);
  }
  return cycles;
}

/** Convenience: the cycle projection over transformation/opposition edges. */
export function transformationCycles(edges: readonly RelationEdge[]): RelationEdge[][] {
  return cyclesOf(edgesForProjection(edges, "opposition"));
}

// ---------------------------------------------------------------------------
// Phase bands — validity intervals the owner actually disclosed
// ---------------------------------------------------------------------------

export interface PhaseBand {
  /** The facet's ref (or derived stable id), verbatim-first. */
  id: string;
  facet_ref: string | null;
  fromMs: number | null;
  toMs: number | null;
  uncertainty: string | null;
  source_ref: string | null;
}

/** The validity facets of a reading, as honest phase bands (open-ended stays
 * open: toMs null means the reading claims no end — none is invented). */
export function phasesFromFacets(temporal: readonly TechneTemporalFacet[]): PhaseBand[] {
  return temporal
    .filter((facet) => facet.kind === "valid")
    .map((facet, index) => {
      const span = facetRange(facet);
      return {
        id: facet.facet_ref ?? `derived:techne:phase[${index}]`,
        facet_ref: facet.facet_ref ?? null,
        fromMs: span.fromMs,
        toMs: span.toMs,
        uncertainty: facet.uncertainty ?? null,
        source_ref: facet.source_ref ?? null,
      };
    });
}

// ---------------------------------------------------------------------------
// Selection — the DisclosureSession co-reference for relations
// ---------------------------------------------------------------------------

/**
 * The selection a relation click produces: the current selection with focus
 * narrowed to the clicked edge (its relation_ref, or the derived stable id)
 * and the instrument naming this one. subject_ref and reading_ref ride along
 * byte-identical — co-reference is preserved, never re-minted.
 */
export function selectionFocusedOnRelation<D extends { id: string }>(
  selection: import("../../contract.ts").DisclosureSelection,
  edge: D,
  instrument: import("../../contract.ts").TechneInstrument = "timeline",
): import("../../contract.ts").DisclosureSelection {
  return { ...selection, instrument, focus_refs: [edge.id] };
}

// ---------------------------------------------------------------------------
// Arc layout — the relation-field view's pure geometry
// ---------------------------------------------------------------------------

export interface ArcNode {
  ref: string;
  x: number;
}

export interface ArcEdge {
  id: string;
  fromX: number;
  toX: number;
  /** Arc height grows with distance, capped; sign alternates by index in
   * the sorted edge list so opposite-direction pairs stay legible. */
  controlY: number;
}

export interface ArcLayout {
  nodes: ArcNode[];
  edges: ArcEdge[];
}

/**
 * The relation-field arc layout: every distinct participant once on a
 * horizontal axis (ordered by ref, deterministic), each edge an arc between
 * its endpoints. Pure geometry over owner data — no simulation, no hidden
 * semantics in the shape: the arc carries NOTHING but endpoints; standing
 * and temporality are separate visual variables the surface draws from the
 * edge's own fields. Participant order is sorted so the same field always
 * lays out identically.
 */
export function arcLayout(participantRefs: readonly string[], edges: readonly RelationEdge[], width: number): ArcLayout {
  const unique = [...new Set(participantRefs)].sort((a, b) => a.localeCompare(b));
  const span = Math.max(unique.length - 1, 1);
  const pad = width * 0.06;
  const usable = width - pad * 2;
  const nodes: ArcNode[] = unique.map((ref, index) => ({ ref, x: pad + (index / span) * usable }));
  const xOf = new Map(nodes.map((node) => [node.ref, node.x]));
  const maxArc = width * 0.28;
  const edgesOut: ArcEdge[] = edges.map((edge, index) => {
    const fromX = xOf.get(edge.from_ref) ?? pad;
    const toX = xOf.get(edge.to_ref) ?? pad;
    const distance = Math.abs(toX - fromX);
    const lift = Math.min(pad + distance * 0.35, maxArc);
    return { id: edge.id, fromX, toX, controlY: (index % 2 === 0 ? -1 : 1) * lift };
  });
  return { nodes, edges: edgesOut };
}
