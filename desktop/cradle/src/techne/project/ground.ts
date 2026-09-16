/**
 * The M0′ Project / Knowledge Map ground model (L5 Technē, amended
 * geometry) — step 0 of the canonical traversal. The ground is the user's
 * existing Central/ProjectCentral/AIKit world; this aperture discloses the
 * reading's ground identity, its bounded whole, its sources and its native
 * Actions — including the governed-write Action that carries a Return leg.
 *
 * Laws: refs verbatim; the ground owns no graph, no store and no identity;
 * the deep editor body is the existing Knowledge surface, not this pane.
 * Pure functions only; erasable TypeScript loadable by `node --test`.
 */
import type { NativeActionRef, TechneReading } from "../contract.ts";

export interface GroundSource {
  source_ref: string;
  native_owner: string;
  standing: string | null;
}

export interface GroundModel {
  subject_ref: string;
  native_owner: string;
  kind: string | null;
  standing: string | null;
  ground_ref: string;
  whole_ref: string | null;
  member_refs: string[];
  relations_by_origin: Record<string, number>;
  sources: GroundSource[];
  /** The disclosed governed-write Action — the Return leg's route. */
  return_action: NativeActionRef | null;
}

const GOVERNED_AUTHORITIES = new Set(["governed-write", "staged", "reviewed-write"]);

/** The ground model of one reading. Absent facets are data: a reading with
 * no whole, sources or actions yields an honest, sparser ground. */
export function groundModel(reading: TechneReading): GroundModel {
  const relationsByOrigin: Record<string, number> = {};
  // provenance and actions are optional facets; absence is honest sparseness.
  for (const relation of reading.whole?.relations ?? []) {
    const origin = relation.origin ?? "undisclosed";
    relationsByOrigin[origin] = (relationsByOrigin[origin] ?? 0) + 1;
  }
  return {
    subject_ref: reading.subject.subject_ref,
    native_owner: reading.subject.native_owner,
    kind: reading.subject.kind ?? null,
    standing: reading.subject.standing ?? null,
    ground_ref: reading.whole?.whole_ref ?? reading.subject.subject_ref,
    whole_ref: reading.whole?.whole_ref ?? null,
    member_refs: [...(reading.whole?.member_refs ?? [])],
    relations_by_origin: relationsByOrigin,
    sources: (reading.provenance ?? []).map((provenance) => ({
      source_ref: provenance.source_ref,
      native_owner: provenance.native_owner,
      standing: provenance.standing ?? null,
    })),
    return_action:
      (reading.actions ?? []).find(
        (action) =>
          action.authority.startsWith("governed") ||
          [...GOVERNED_AUTHORITIES].some((authority) => action.authority === authority),
      ) ?? null,
  };
}

/** Capability honesty for the pane: the ground is available exactly when a
 * subject is disclosed — which the contract requires — so the pane is
 * available with any valid reading; the reason path exists for the
 * no-reading surface state. */
export function groundAvailability(reading: TechneReading | null): { available: boolean; reason: string | null } {
  if (!reading) return { available: false, reason: null };
  return { available: true, reason: null };
}
