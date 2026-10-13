/**
 * Place navigation identity (lane-4 T22–T24). Pure logic only:
 *   - T22 "fly here": the place facets a subject's reading discloses, one offer
 *     per place (none → no offer; honest absence);
 *   - T23 "Open in Timeline": the facet's own validity as the shared time window,
 *     and the place ref the Timeline reads back as spatial focus (the round trip);
 *   - the offline gazetteer's hits as a separate basemap-context group, never
 *     offered as subjects.
 * Refs move only through the DisclosureSession (`selectionForPlace`,
 * `placeFocusFromSession` in register.ts; `setSpatialFocus` in session.ts). Nothing
 * here mints a ref, keeps a route, or upgrades a precision.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {DisclosureSession, TechnePlaceFacet, TechnePlacePrecision} from "../../contract.ts";
import {placeFocusFromSession} from "./register.ts";

/** A shared time window as the session declares it (`null` bounds are open). */
export type PlaceTimeWindow = NonNullable<DisclosureSession["time_window"]>;

/** One place a subject discloses, offered as "fly here". */
export interface PlaceOffer {
  place_ref: string;
  title: string;
  precision: TechnePlacePrecision;
  source_ref: string | null;
  /** The facet's own validity, or null when the facet discloses none. */
  validity: PlaceTimeWindow | null;
}

/** One offline gazetteer hit: basemap context, never a subject. */
export interface BasemapContextHit {
  id: string;
  label: string;
  source: string;
  precision: TechnePlacePrecision;
  coordinate: {latitude: number; longitude: number} | null;
}

/** The slice of a gazetteer entry this module reads (GazetteerEntry is a superset). */
export interface GazetteerLike {
  id: string;
  source: string;
  names: readonly {language: string; name: string}[];
  precision: TechnePlacePrecision;
  latitude?: number;
  longitude?: number;
}

/** The slice of GazetteerIndex this module calls. */
export interface GazetteerSearchPort {
  searchByName(name: string, options?: {limit?: number}): readonly GazetteerLike[];
}

export const PLACES_ON_MAP_LABEL = "Places on the map";
export const FLY_HERE_PREFIX = "Fly here · ";

/** The title a place offer reads under: its first disclosed name, else its ref. */
function placeTitle(facet: TechnePlaceFacet): string {
  const name = facet.identity?.names?.[0]?.name;
  return typeof name === "string" && name.trim() ? name.trim() : facet.place_ref;
}

/**
 * The place offers of a set of disclosed facets: one per distinct place ref, in
 * the reading's own order. A facet without a usable ref is skipped, never
 * invented into an offer.
 */
export function placeOffersOf(facets: readonly TechnePlaceFacet[] | null | undefined): PlaceOffer[] {
  if (!Array.isArray(facets)) return [];
  const seen = new Set<string>();
  const offers: PlaceOffer[] = [];
  for (const facet of facets) {
    if (!facet || typeof facet.place_ref !== "string" || !facet.place_ref.trim()) continue;
    if (seen.has(facet.place_ref)) continue;
    seen.add(facet.place_ref);
    offers.push({
      place_ref: facet.place_ref,
      title: placeTitle(facet),
      precision: facet.precision,
      source_ref: typeof facet.source_ref === "string" && facet.source_ref ? facet.source_ref : null,
      validity: validityWindowOf(facet),
    });
  }
  return offers;
}

/**
 * The place offers of a wire reading payload (the provider's reading, whose
 * `spatial` array carries the place facets). A payload with no spatial array
 * offers nothing.
 */
export function placeOffersOfPayload(payload: unknown): PlaceOffer[] {
  if (!payload || typeof payload !== "object") return [];
  const spatial = (payload as {spatial?: unknown}).spatial;
  return placeOffersOf(Array.isArray(spatial) ? (spatial as TechnePlaceFacet[]) : null);
}

/**
 * A facet's own validity as a shared time window: `from`/`to` exactly as the
 * facet discloses them. A facet that discloses neither bound returns null, so the
 * window is never invented for it.
 */
export function validityWindowOf(facet: Pick<TechnePlaceFacet, "valid_from" | "valid_to">): PlaceTimeWindow | null {
  const from = typeof facet.valid_from === "string" && facet.valid_from ? facet.valid_from : null;
  const to = typeof facet.valid_to === "string" && facet.valid_to ? facet.valid_to : null;
  if (from === null && to === null) return null;
  return {from, to};
}

/**
 * The place the Places lens opens selected. A focus the session declares (its
 * spatial ref, or its selection's focus refs) governs the opening, even when it is
 * stale: the lens then opens unselected rather than on an earlier selection of its
 * own. With no declared focus, the lens's remembered selection stands.
 */
export function openingPlaceSelection(
  session: DisclosureSession | null,
  facets: readonly TechnePlaceFacet[],
  remembered: string | null,
): string | null {
  if (!session) return remembered;
  const declared = session.spatial_focus_ref !== undefined || (session.selection.focus_refs?.length ?? 0) > 0;
  if (!declared) return remembered;
  return placeFocusFromSession(session, facets);
}

/**
 * The plan for "Open in Timeline" from a selected place: the window set from the
 * facet's own validity (null when it discloses none, so the window is left as it
 * is), and the place ref the session carries as `spatial_focus_ref`, so Places
 * reopened from the Timeline lands on the same facet.
 */
export function timelineOpenPlan(facet: TechnePlaceFacet): {window: PlaceTimeWindow | null; spatial_focus_ref: string} {
  if (!facet || typeof facet.place_ref !== "string" || !facet.place_ref.trim()) {
    throw new Error("timelineOpenPlan: a place carries its place ref verbatim");
  }
  return {window: validityWindowOf(facet), spatial_focus_ref: facet.place_ref};
}

/**
 * The gazetteer's hits for a query, as basemap context. Blank queries return
 * nothing. A hit with no point (region or unlocated) carries no coordinate; none is
 * fabricated.
 */
export function basemapContextHits(index: GazetteerSearchPort, query: string, limit = 8): BasemapContextHit[] {
  const needle = query.trim();
  if (!needle) return [];
  return index.searchByName(needle, {limit}).slice(0, limit).map(entry => {
    const label = entry.names.find(name => name.name.trim())?.name ?? entry.id;
    const hasPoint = (entry.precision === "exact" || entry.precision === "approximate")
      && typeof entry.latitude === "number" && typeof entry.longitude === "number";
    return {
      id: entry.id,
      label,
      source: entry.source,
      precision: entry.precision,
      coordinate: hasPoint ? {latitude: entry.latitude!, longitude: entry.longitude!} : null,
    };
  });
}

/** The fly-here label for one place offer. */
export function flyHereLabel(offer: PlaceOffer): string {
  return `${FLY_HERE_PREFIX}${offer.title}`;
}
