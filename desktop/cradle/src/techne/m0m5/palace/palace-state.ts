/**
 * Palace composition state (L5 Technē M5′, QL-MEF #218) — the session-scoped
 * presentation state of the Palace surface: whether the integral composition
 * is bound, each region's arrangement, and the visitor's bookmarks.
 *
 * Laws carried here:
 *   - this is PRESENTATION state of one surface, never semantic data: binding
 *     the composition mutates no reading, mints no native ref, and writes no
 *     store (no localStorage, no IndexedDB, no Palace record). It lives as
 *     long as the desktop session and is re-derived from the reading after a
 *     full restart — re-entry within the session recovers it (the surface's
 *     restart/re-enter continuity); app-restart recovery is a recorded join
     on the owner's presentation-artifact path;
 *   - state is keyed by the reading basis (subject_ref + reading_ref), so
 *     two subjects never share a composition;
 *   - no stochastic identity: keys are derived, never random; every
 *     transition is a pure function of its inputs.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechneReading } from "../../contract.ts";
import { defaultArrangement, locusOrder, palaceElements, type PalaceArrangement, type PalaceLocus } from "./composition.ts";
import {
  arrangeRegion,
  defaultRegionPlacements,
  PALACE_REGION_ORDER,
  palaceRegions,
  type PalaceRegion,
  type PalaceRegionKey,
  type PalaceRegionPlacement,
} from "./regions.ts";

/** The reading basis a composition hangs from: the subject and the exact
 * reading, joined by the same separator the surface already uses. */
export function palaceBasis(reading: TechneReading): string {
  return `${reading.subject.subject_ref}\u0000${reading.reading_ref}`;
}

/** The honest claim rule: when the reading's own disclosure names the Palace
 * unavailable, the surface may still offer to bind the integral composition
 * ONLY when the reading itself names an unclaimed composition — an
 * Expression whose composition_ref exists (the TB0 specimen's stated
 * reason). When the reading's reason is that there is nothing to compose,
 * the claimable answer is false and the Palace stays absent with the
 * reading's own reason; the surface never puts words in the owner's mouth.
 * The binding itself, when made, remains local presentation state. */
export function palaceClaim(reading: TechneReading): {
  disclosedAvailable: boolean;
  claimable: boolean;
  reason: string | null;
} {
  const entry = reading.disclosure.instruments.find((candidate) => candidate.instrument === "palace");
  const disclosedAvailable = entry?.available ?? false;
  const claimable =
    !disclosedAvailable &&
    (reading.expressions ?? []).some((binding) => typeof binding.composition_ref === "string" && binding.composition_ref.trim());
  return {
    disclosedAvailable,
    claimable,
    reason: entry && entry.available === false ? entry.reason ?? null : null,
  };
}

/** One bookmark: a meaningful position in the palace — a region and the
 * native ref that stood there. Refs stay verbatim. */
export interface PalaceBookmark {
  region: PalaceRegionKey;
  ref: string;
  locus: PalaceLocus | null;
}

/** The composition state of one basis. */
export interface PalaceComposition {
  basis: string;
  /** Whether the Palace surface has bound the integral composition. Local
   * presentation truth; the reading's own disclosure is untouched by it. */
  bound: boolean;
  regions: PalaceRegion[];
  placements: Partial<Record<PalaceRegionKey, PalaceRegionPlacement[]>>;
  /** The 3:3 expression arrangement (the original locus floor), kept in the
   * composition so it survives re-entry within the session. */
  expressions: PalaceArrangement;
  bookmarks: PalaceBookmark[];
}

/** Derive the initial composition of one reading: regions from the reading's
 * real refs, each arranged deterministically. Pure. */
export function deriveComposition(reading: TechneReading): PalaceComposition {
  const regions = palaceRegions(reading);
  const placements: Partial<Record<PalaceRegionKey, PalaceRegionPlacement[]>> = {};
  for (const region of regions) {
    placements[region.key] = defaultRegionPlacements(region.entries);
  }
  return {
    basis: palaceBasis(reading),
    bound: false,
    regions,
    placements,
    expressions: defaultArrangement(palaceElements(reading)),
    bookmarks: [],
  };
}

/** Move one entry within its region. Pure over the composition. */
export function placeAt(composition: PalaceComposition, region: PalaceRegionKey, ref: string, locus: PalaceLocus): PalaceComposition {
  const placements = composition.placements[region];
  if (!placements) return composition;
  return {
    ...composition,
    placements: { ...composition.placements, [region]: arrangeRegion(placements, ref, locus) },
  };
}

/** Bookmark the position of one native ref in one region; a repeated
 * bookmark for the same ref is idempotent. */
export function addBookmark(composition: PalaceComposition, region: PalaceRegionKey, ref: string): PalaceComposition {
  if (composition.bookmarks.some((bookmark) => bookmark.ref === ref)) return composition;
  const locus = composition.placements[region]?.find((placement) => placement.ref === ref)?.locus ?? null;
  return { ...composition, bookmarks: [...composition.bookmarks, { region, ref, locus }] };
}

export function removeBookmark(composition: PalaceComposition, ref: string): PalaceComposition {
  return { ...composition, bookmarks: composition.bookmarks.filter((bookmark) => bookmark.ref !== ref) };
}

// ---------------------------------------------------------------------------
// The session-scoped store — one composition per basis, presentation only
// ---------------------------------------------------------------------------

const compositions = new Map<string, PalaceComposition>();

/** The composition of one basis, derived from the reading on first visit and
 * recovered unchanged on re-entry within the session. */
export function palaceComposition(reading: TechneReading): PalaceComposition {
  const basis = palaceBasis(reading);
  const existing = compositions.get(basis);
  if (existing) return existing;
  const derived = deriveComposition(reading);
  compositions.set(basis, derived);
  return derived;
}

/** Replace one basis's composition (the surface's local acts). Returns the
 * stored composition. */
export function storeComposition(composition: PalaceComposition): PalaceComposition {
  compositions.set(composition.basis, composition);
  return composition;
}

/** Bind the integral composition of one basis: the Palace surface claims the
 * composition the reading's Expression already names. Local presentation
 * act; the reading is not rewritten. */
export function bindComposition(reading: TechneReading): PalaceComposition {
  const composition = palaceComposition(reading);
  return storeComposition({ ...composition, bound: true });
}

/** Test/dev reset — production code never clears the compositions. */
export function resetPalaceCompositions() {
  compositions.clear();
}

// ---------------------------------------------------------------------------
// Guided traversal — the canonical walk over the bound whole
// ---------------------------------------------------------------------------

/** One step of the guided traversal: a region and the native ref standing
 * there, in canonical M0′→M5′ order and spatial walk order within each
 * region. */
export interface PalaceTraversalStep {
  region: PalaceRegionKey;
  ref: string;
  locus: PalaceLocus;
}

/** The guided traversal of one composition: every region in canonical order,
 * each region's occupied loci in spatial order. Free exploration is the same
 * palace entered directly — the traversal is an ordering, never a gate. */
export function palaceTraversal(composition: PalaceComposition): PalaceTraversalStep[] {
  const steps: PalaceTraversalStep[] = [];
  for (const key of PALACE_REGION_ORDER) {
    const placements = composition.placements[key];
    if (!placements) continue;
    for (const placement of [...placements].sort((a, b) => locusOrder(a.locus, b.locus))) {
      steps.push({ region: key, ref: placement.ref, locus: placement.locus });
    }
  }
  return steps;
}

/** The regions actually present in the composition, in canonical order. */
export function compositionRegions(composition: PalaceComposition): PalaceRegion[] {
  return PALACE_REGION_ORDER.map((key) => composition.regions.find((region) => region.key === key)).filter(
    (region): region is PalaceRegion => region !== undefined,
  );
}
