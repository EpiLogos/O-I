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
import type { DisclosureSelection, DisclosureSession, TechneDisclosureEntry, TechneReading } from "../contract";
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
 * The instruments this reading itself offers for cross-open, from its
 * disclosure only — never a hard-coded route, and never the place
 * instrument itself (that is the current aperture).
 */
export function crossOpenTargets(reading: TechneReading | null): TechneDisclosureEntry[] {
  const entries = reading?.disclosure?.instruments ?? [];
  return entries.filter((entry) => entry.available && entry.instrument !== "place");
}
