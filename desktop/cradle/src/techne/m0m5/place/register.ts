/**
 * The Place instrument registration (L5 Technē T4) — the lane's composition
 * entry. `registerPlaceSurface()` mounts the Place surface in the shared
 * Technē registry ("map | globe | street are presentations of the same
 * Place readings"); nothing here edits shared files.
 *
 * Selection law (wayfinder §3–§5, K9 co-reference): clicking a place sets
 * the DisclosureSession selection with `focus_refs = [place_ref]` — subject,
 * reading basis, source qualification and agent-session ref are carried
 * verbatim, never minted or rewritten. Cross-open affordances are offered
 * strictly from the reading's own disclosure.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import { registerTechneSurface } from "../registry";
import type { DisclosureSelection, DisclosureSession, TechneDisclosureEntry, TechnePlaceFacet, TechneReading } from "../../contract";
import { PlaceInstrument } from "./PlaceInstrument";

/** Mount the Place surface (map | globe | street). Returns the unregister
 * function. A duplicate registration is a composition bug and is refused by
 * the registry. */
export function registerPlaceSurface(): () => void {
  return registerTechneSurface("place", PlaceInstrument);
}

/**
 * The selection for a clicked place: the session's own selection with the
 * place as focus and the instrument co-referenced — refs verbatim, nothing
 * else moves.
 */
export function selectionForPlace(session: DisclosureSession, placeRef: string): DisclosureSelection {
  if (!placeRef.trim()) throw new Error("selectionForPlace: a place selection carries the place ref verbatim");
  return {
    ...session.selection,
    instrument: "place",
    focus_refs: [placeRef],
  };
}

/**
 * The place the session's shared selection focuses, when it names one this
 * reading discloses: the selection's focus refs first, then the session's
 * spatial focus. This is the reopen seam for cross-instrument focus (e.g. a
 * Journey Scene frame binding a real Place ref — M3′↔M4′, #217 §7): another
 * instrument sets the shared selection, and this aperture honours it instead
 * of substituting its own. Never minted: the ref must match a disclosed
 * facet, else null.
 */
export function placeFocusFromSession(
  session: DisclosureSession | null,
  facets: readonly TechnePlaceFacet[],
): string | null {
  if (!session) return null;
  const candidates = [...(session.selection.focus_refs ?? [])];
  if (session.spatial_focus_ref) candidates.push(session.spatial_focus_ref);
  for (const ref of candidates) {
    if (facets.some((facet) => facet.place_ref === ref)) return ref;
  }
  return null;
}

/**
 * The instruments this reading itself offers for cross-open, from its
 * disclosure only — never a hard-coded route, and never the place
 * instrument itself (that is the current aperture).
 */
export function crossOpenTargets(reading: TechneReading | null): TechneDisclosureEntry[] {
  const entries = reading?.disclosure?.instruments ?? [];
  return entries.filter((entry) => entry.available && entry.instrument !== "place");
}
