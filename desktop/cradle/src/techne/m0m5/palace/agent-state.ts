/**
 * Palace structured state for the situated agencies (L5 Technē M5′, QL-MEF
 * #218 §9) — the structured description of the current composition that
 * Aletheia_5 / Technē_5 (and Epii, the canonical M5 Guardian) co-reference
 * instead of scraping any DOM or reconstructing UI text.
 *
 * Laws carried here:
 *   - everything returned is either verbatim from the reading (native refs,
 *     actions, agency bindings, provenance) or derived presentation fact of
 *     the composition (regions, placements, bookmarks) — clearly separated;
 *   - unresolved evidence is named, never smoothed over: refs without a
 *     disclosed revision, and subjects without provenance, appear with the
 *     reason they are unresolved (a Recognition target, not a defect to hide);
 *   - no runtime, no session store, no Agent framework: this module is a
 *     pure function over the reading and the composition.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { NativeActionRef, TechneReading } from "../../contract.ts";
import { palaceBasis, type PalaceComposition } from "./palace-state.ts";
import { palaceReturnAction } from "./return.ts";

/** The structured state the M5 agencies co-reference. */
export interface PalaceAgentState {
  basis: {
    subject_ref: string;
    reading_ref: string;
    snapshot_revision: string | null;
    native_owner: string;
  };
  composition: {
    bound: boolean;
    regions: { key: string; office: string; m_prime: number | null; entry_refs: string[] }[];
    bookmarks: { region: string; ref: string }[];
  };
  /** The reading's own Expression/Scene bindings, verbatim. */
  expressions: TechneReading["expressions"];
  /** The reading's own provenance, verbatim. */
  provenance: TechneReading["provenance"];
  /** The disclosed native Actions, verbatim — the same ActionRefs a human
   * operation uses. */
  actions: NativeActionRef[];
  /** The disclosed Return action's ref, when the reading provides one. */
  return_action_ref: string | null;
  /** The reading's own situated-Agency bindings, verbatim. */
  agency: TechneReading["agency"];
  /** Unresolved evidence: what the composition composes that the reading
   * does not ground, with the reason. */
  unresolved: { ref: string; reason: string }[];
}

/** Compose the structured state. Pure. */
export function palaceAgentState(reading: TechneReading, composition: PalaceComposition): PalaceAgentState {
  const provenanceSources = new Set((reading.provenance ?? []).map((entry) => entry.source_ref));
  const provenanceSubjects = new Set((reading.provenance ?? []).flatMap((entry) => entry.evidence_refs ?? []));

  const unresolved: { ref: string; reason: string }[] = [];
  for (const region of composition.regions) {
    for (const entry of region.entries) {
      // Expression/scene entries are grounded by their binding; they are
      // unresolved when no revision is disclosed.
      if (entry.kind === "expression" || entry.kind === "journey") {
        if (!entry.revision) unresolved.push({ ref: entry.ref, reason: "no Expression revision disclosed" });
        continue;
      }
      // A source is its own ground; whole membership is grounded by the
      // disclosed whole; agency bindings are co-references, not claims.
      if (entry.kind === "sources" || entry.kind === "ground" || entry.kind === "agency") continue;
      // Relation/world entries are grounded when the reading's provenance
      // covers them or the facet names its own source — otherwise the gap
      // is named, never smoothed over.
      const grounded = provenanceSources.has(entry.ref) || provenanceSubjects.has(entry.ref) || Boolean(entry.source);
      if (!grounded) {
        unresolved.push({ ref: entry.ref, reason: "no provenance entry or facet source discloses this ref" });
      }
    }
  }

  return {
    basis: {
      subject_ref: reading.subject.subject_ref,
      reading_ref: reading.reading_ref,
      snapshot_revision: reading.snapshot?.revision ?? null,
      native_owner: reading.subject.native_owner,
    },
    composition: {
      bound: composition.bound,
      regions: composition.regions.map((region) => ({
        key: region.key,
        office: region.office,
        m_prime: region.m_prime,
        entry_refs: region.entries.map((entry) => entry.ref),
      })),
      bookmarks: composition.bookmarks.map((bookmark) => ({ region: bookmark.region, ref: bookmark.ref })),
    },
    expressions: reading.expressions,
    provenance: reading.provenance,
    actions: reading.actions ?? [],
    return_action_ref: palaceReturnAction(reading)?.action_ref ?? null,
    agency: reading.agency,
    unresolved,
  };
}

/** The basis string the agencies quote for this composition — one definition,
 * shared with the state store. */
export function agentStateBasis(reading: TechneReading): string {
  return palaceBasis(reading);
}
