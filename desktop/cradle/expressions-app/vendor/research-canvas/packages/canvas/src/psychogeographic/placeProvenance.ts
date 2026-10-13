/**
 * Provenance on every pinned place — lane-4 T13. Pure: it reads the reading's
 * own provenance rows (the contract's `provenance`, produced by
 * desktop/cradle/src/techne/spatialFacets.ts) and matches them to one facet.
 *
 * Laws carried here:
 *   - the match is the producer's own recorded selector for that place
 *     (kind `techne-spatial-facet`, value = the place ref), narrowed to the
 *     facet's own source ref when the facet discloses one;
 *   - nothing is invented. A facet with no matching row says so ("no provenance
 *     disclosed"); a row without a revision says "revision not disclosed";
 *   - the rows are read verbatim. Nothing here upgrades a standing.
 *
 * Erasable TypeScript: loadable by Vite, the panel and `node --test`.
 */
import type {
  TechnePlaceFacet,
  TechneSourceProvenance,
  TechneSourceSelector,
} from "../../../../../../../src/techne/contract";

/** The producer's selector kind for a spatial facet (spatialFacets.ts records it). */
export const SPATIAL_FACET_SELECTOR_KIND = "techne-spatial-facet";

export interface FacetProvenanceRow {
  source_ref: string;
  /** The source revision as the producer disclosed it, or null. */
  source_revision: string | null;
  native_owner: string;
  /** The producer's selector read as a sentence, or null when none was recorded. */
  selector: string | null;
  /** The row's standing, verbatim, or null. */
  standing: string | null;
}

export interface FacetProvenance {
  /** The rows that match this facet; empty when none does. */
  rows: FacetProvenanceRow[];
  /** The facet's own source ref, verbatim, or null. */
  source_ref: string | null;
}

/** The provenance rows that match one facet, in the reading's order. */
export function facetProvenance(
  provenance: readonly TechneSourceProvenance[] | undefined,
  facet: TechnePlaceFacet,
): FacetProvenance {
  const rows = (provenance ?? [])
    .filter((row) => {
      const selector = row.selector;
      if (!selector || selector.unit !== "other") return false;
      if (selector.kind !== SPATIAL_FACET_SELECTOR_KIND || selector.value !== facet.place_ref) return false;
      return !facet.source_ref || row.source_ref === facet.source_ref;
    })
    .map((row): FacetProvenanceRow => ({
      source_ref: row.source_ref,
      source_revision: row.source_revision ?? null,
      native_owner: row.native_owner,
      selector: selectorText(row.selector),
      standing: row.standing ?? null,
    }));
  return { rows, source_ref: facet.source_ref ?? null };
}

/** A producer's selector read as a sentence, or null when none was recorded. */
export function selectorText(selector: TechneSourceSelector | null | undefined): string | null {
  if (!selector) return null;
  switch (selector.unit) {
    case "text_span":
      return `characters ${selector.start}–${selector.end}${selector.anchor_ref ? ` at ${selector.anchor_ref}` : ""}`;
    case "timestamp_range":
      return `${selector.from} – ${selector.to}`;
    case "image_region":
      return `image region ${selector.x}, ${selector.y}, ${selector.width}×${selector.height}`;
    case "other":
      return `${selector.kind} = ${selector.value}`;
  }
}
