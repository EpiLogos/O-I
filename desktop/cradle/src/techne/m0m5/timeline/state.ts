/**
 * The M2′ structured state and Expression-crossing gate (QL-MEF #215 §7–§8).
 *
 * `relationFieldState` is what `Aletheia_2 / Technē_2` reads: the active
 * projection, every relation with its verbatim standing and temporal
 * qualification, the time window, the derived-vs-native identity split, the
 * reading's own disclosed Actions and Agency role bindings — all carried
 * verbatim from the reading, never reconstructed from UI text. An agency
 * operates through these refs and the disclosed Actions, never through DOM
 * scraping.
 *
 * `expressionCrossing` is the M2′ ↔ 3:3 gate. The law (#215 §7): only
 * source-backed or canonically derived relations may drive an Expression
 * profile; a temporal or causal relation does not become sonic/harmonic
 * meaning by default. The gate is mechanical and conservative — it
 * warrants the crossing ONLY when the reading's own disclosure opens the
 * 3:3 reading AND the focused relation's standing is sourced or derived.
 * Warranting the crossing asserts NOTHING about resonance, correspondence,
 * music or colour: those semantics stay with the Expression owner.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {
  DisclosureSelection,
  NativeActionRef,
  AgencyRole,
  TechneReading,
} from "../../contract.ts";
import {
  relationField,
  type RelationEdge,
  type RelationField,
  type RelationProjectionMode,
} from "./relations.ts";

export const RELATION_FIELD_STATE_SCHEMA = "ql.techne.relation-field-state/v1";

export interface RelationStateEntry {
  id: string;
  native_ref: string | null;
  derived_id: boolean;
  relation: string;
  from_ref: string;
  to_ref: string;
  standing_verbatim: string | null;
  temporal_qualification: {
    state: "dated" | "trans-temporal" | "unresolved";
    facet_ref: string | null;
    problem: string | null;
  };
  source_ref: string | null;
  evidence_refs: string[];
  derivation_ref: string | null;
  confidence: string | null;
}

export interface RelationFieldState {
  schema: typeof RELATION_FIELD_STATE_SCHEMA;
  instrument: "timeline";
  m_prime: 2;
  projection: RelationProjectionMode;
  subject_ref: string;
  reading_ref: string;
  snapshot_revision: string | null;
  /** The window the projection is read over: the session's own window when
   * the session declares one, else the reading's honest domain is NOT
   * invented here — null means no window is in force. */
  time_window: { from: string | null; to: string | null } | null;
  focused_refs: string[];
  relations: RelationStateEntry[];
  /** Which entry ids are derived rather than native — the derivation split
   * an agency needs so it never mistakes a derived id for a native ref. */
  derivation: { derived_ids: string[]; unresolved_temporal_refs: string[] };
  disclosed_actions: NativeActionRef[];
  /** The reading's situated-Agency role bindings, verbatim (role floor). */
  agency: AgencyRole[];
}

/** The structured M2′ state for the situated agency, over one reading.
 * `timeWindow` is the DisclosureSession's own declared window when one is
 * in force; it is never derived here from zoom/pan (those are presentation
 * state, deliberately inexpressible in the contract). */
export function relationFieldState(
  reading: TechneReading,
  projection: RelationProjectionMode,
  selection?: DisclosureSelection | null,
  timeWindow?: { from: string | null; to: string | null } | null,
): RelationFieldState {
  const field: RelationField = relationField(reading);
  return {
    schema: RELATION_FIELD_STATE_SCHEMA,
    instrument: "timeline",
    m_prime: 2,
    projection,
    subject_ref: reading.subject.subject_ref,
    reading_ref: reading.reading_ref,
    snapshot_revision: reading.snapshot?.revision ?? null,
    time_window: timeWindow ?? null,
    focused_refs: selection?.focus_refs ?? [],
    relations: field.edges.map((edge) => ({
      id: edge.id,
      native_ref: edge.derived_id ? null : edge.id,
      derived_id: edge.derived_id,
      relation: edge.relation,
      from_ref: edge.from_ref,
      to_ref: edge.to_ref,
      standing_verbatim: edge.standing_verbatim,
      temporal_qualification: {
        state: edge.temporal.state,
        facet_ref: edge.temporal.facet_ref,
        problem: edge.temporal.problem,
      },
      source_ref: edge.source_ref,
      evidence_refs: [...edge.evidence_refs],
      derivation_ref: edge.derivation_ref,
      confidence: edge.confidence,
    })),
    derivation: {
      derived_ids: field.edges.filter((edge) => edge.derived_id).map((edge) => edge.id),
      unresolved_temporal_refs: [...field.unresolved_temporal_refs],
    },
    disclosed_actions: reading.actions ?? [],
    agency: reading.agency ?? [],
  };
}

// ---------------------------------------------------------------------------
// The M2′ ↔ 3:3 Expression crossing gate
// ---------------------------------------------------------------------------

export type M2ExpressionCrossing =
  | {
      warranted: true;
      /** The reading's disclosed crossing Action, when it discloses one. */
      action_ref: string | null;
      /** What makes this warranted — shown on the surface. */
      reason: string;
    }
  | { warranted: false; reason: string };

const CROSSING_ACTION_HINT = /expression/i;

/**
 * The mechanical warrant for crossing the focused M2′ selection into the
 * 3:3 Expression reading. Requires:
 *   1. the reading's own disclosure opens the expressions instrument (or
 *      the 3:3-conjugate cut) — capability comes from the reading, never
 *      from this instrument;
 *   2. the focused relation is source-backed with a non-interpretive
 *      standing (visual "sourced"), OR canonically derived (the owner
 *      supplies a derivation_ref). An interpretation that merely cites a
 *      source is STILL an interpretation — it does not warrant the crossing,
 *      and its verbatim standing names the reason.
 * A warranted crossing carries subject/relation/source refs unchanged and
 * asserts no harmonic/correspondential meaning whatsoever.
 */
export function expressionCrossing(
  reading: TechneReading,
  selection: DisclosureSelection | null,
  field?: RelationField,
): M2ExpressionCrossing {
  const entry = reading.disclosure.instruments.find((candidate) => candidate.instrument === "expressions");
  const cut = reading.disclosure.application_cuts?.find((candidate) => candidate.cut === "3:3-conjugate");
  const disclosureOpen = entry?.available === true || cut?.available === true;
  if (!disclosureOpen) {
    const reason = entry?.reason ?? cut?.reason ?? "the reading does not open the 3:3-conjugate reading";
    return { warranted: false, reason: `the 3:3 Expression reading is unavailable — ${reason}` };
  }
  const field_ = field ?? relationField(reading);
  const focused = selection?.focus_refs ?? [];
  const focusedEdges: RelationEdge[] = focused
    .map((ref) => field_.edges.find((edge) => edge.id === ref))
    .filter((edge): edge is RelationEdge => edge !== undefined);
  if (focusedEdges.length === 0) {
    return { warranted: false, reason: "no relation is focused — focus a source-backed or derived relation to warrant the M2 crossing (a plain instrument change needs no warrant)" };
  }
  const edge = focusedEdges[0];
  const canonicallyDerived = edge.derivation_ref != null;
  if (edge.standing_visual !== "sourced" && !canonicallyDerived) {
    return {
      warranted: false,
      reason: `the focused relation ${edge.relation} carries standing ${edge.standing_verbatim ?? "unknown"} — only source-backed or canonically derived relations may drive an Expression profile; an interpretation stays an interpretation even when it cites a source`,
    };
  }
  const disclosedCrossing = (reading.actions ?? []).find((action) => CROSSING_ACTION_HINT.test(action.action_ref));
  return {
    warranted: true,
    action_ref: disclosedCrossing?.action_ref ?? null,
    reason: `relation ${edge.relation} is ${canonicallyDerived && edge.standing_visual !== "sourced" ? "canonically derived" : "source-backed"}${edge.standing_verbatim ? ` (standing "${edge.standing_verbatim}")` : ""} with source refs carried unchanged — the crossing asserts no resonance, correspondence or musical meaning; those semantics stay with the Expression owner`,
  };
}
