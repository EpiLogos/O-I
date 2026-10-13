/**
 * Movement routes and hierarchy edges on the Places globe — lane-4 T11 and T12.
 * Pure presentation rules: no DOM and no maplibre, so the renderer, the side
 * panel and `node --test` read the same functions.
 *
 * Laws carried here:
 *   - a route is the authority's own ordering (`routeModel`, world.ts) of the
 *     reading's TRAVELLED_TO facets. It is read, never re-sorted, and no route
 *     identity is minted: the authority's note comes through verbatim;
 *   - a stop is drawn only at the disclosed point of its own facet, and only
 *     when its precision is drawable (an unlocated stop stays in the register).
 *     Fewer than two drawable stops is no route at all (null), never a forced path;
 *   - a hierarchy edge is the authority's parent→child edge (`projectPlaces`,
 *     project.ts). Only LOCATED_IN edges are drawn; an edge whose endpoint has no
 *     real position is listed for the panel, never drawn at a register slot;
 *   - the shared validity window drops an edge by its own validity and touches
 *     nothing else. Facet objects and identities are the reading's own.
 *
 * Erasable TypeScript: loadable by Vite, the renderer, the panel and `node --test`.
 */
import type { TechnePlaceFacet } from "../../../../../../../src/techne/contract";
import { MOVEMENT_RELATION, routeModel, type RouteStop } from "../../../../../../../src/techne/m0m5/place/world";
import { projectPlaces, type ProjectedPlace } from "../../../../../../../src/techne/m0m5/place/project";
import { validInWindow, type TimeWindow } from "../../../../../../../src/techne/m0m5/place/filter";
import { greatCircleArc, type LatLng, type LonLat } from "./geometry";
import { markerStyleForPrecision } from "./placeNavigation";
import { toLonLat, UNIT_FRAME } from "./placeLayers";

/** The one hierarchy relation the globe draws. Other hierarchy relations are listed, not drawn. */
export const HIERARCHY_DRAWN_RELATION = "LOCATED_IN";

const ROUTE_SEGMENTS = 32;
const HIERARCHY_SEGMENTS = 32;

// ---------------------------------------------------------------------------
// T11 — the route and its numbered stops
// ---------------------------------------------------------------------------

export interface RouteStopDraw {
  place_ref: string;
  /** 1-based, counting the stops drawn, in the authority's order. */
  number: number;
  /** The identity name standing in the window, or null. */
  label: string | null;
  /** The validity bound the authority ordered this stop by, verbatim; null when open. */
  ordering_bound: string | null;
  /** The stop's own disclosed point, [lon, lat]. */
  lonLat: LonLat;
}

export interface PlaceRouteDraw {
  stops: RouteStopDraw[];
  /** A dense great-circle path through the drawn stops, in stop order. */
  path: LonLat[];
  /** The authority's presentation-only note, verbatim. */
  note: string;
}

/**
 * The route to draw for the reading's admitted facets, or null. The facets
 * passed are the presentation-filtered reading's own objects; the stop order is
 * `routeModel`'s, and open-bound stops stay last.
 */
export function placeRouteForMap(facets: readonly TechnePlaceFacet[], window?: TimeWindow | null): PlaceRouteDraw | null {
  const model = routeModel(facets, window);
  if (!model) return null;

  // routeModel orders points but carries no geometry; each stop's own point is
  // read from the first TRAVELLED_TO facet of that place.
  const movement = new Map<string, TechnePlaceFacet>();
  for (const facet of facets) {
    if (facet.relation === MOVEMENT_RELATION && !movement.has(facet.place_ref)) movement.set(facet.place_ref, facet);
  }

  const drawn: Array<{ stop: RouteStop; lonLat: LonLat }> = [];
  for (const stop of model.stops) {
    // An unlocated stop stays in the register: the precision grammar never draws it.
    if (!markerStyleForPrecision(stop.precision).drawn) continue;
    const geometry = movement.get(stop.place_ref)?.geometry;
    if (!geometry || geometry.type !== "point" || !Array.isArray(geometry.coordinates)) continue;
    const [lon, lat] = geometry.coordinates;
    if (typeof lon !== "number" || typeof lat !== "number") continue;
    drawn.push({ stop, lonLat: [lon, lat] });
  }
  // Fewer than two drawable stops is no movement to draw.
  if (drawn.length < 2) return null;

  const stops: RouteStopDraw[] = drawn.map(({ stop, lonLat }, index) => ({
    place_ref: stop.place_ref,
    number: index + 1,
    label: stop.label,
    ordering_bound: stop.ordering_bound,
    lonLat,
  }));

  const path: LonLat[] = [drawn[0].lonLat];
  for (let index = 1; index < drawn.length; index += 1) {
    const arc = greatCircleArc(toLatLng(drawn[index - 1].lonLat), toLatLng(drawn[index].lonLat), ROUTE_SEGMENTS);
    path.push(...arc.slice(1));
  }

  return { stops, path, note: model.note };
}

// ---------------------------------------------------------------------------
// T12 — hierarchy edges on the globe
// ---------------------------------------------------------------------------

export interface HierarchyEdgeDraw {
  from_ref: string;
  to_ref: string;
  relation: string;
  from: LonLat;
  to: LonLat;
  /** A dense great-circle path from parent to child. */
  path: LonLat[];
}

export interface HierarchyEdgeUndrawn {
  from_ref: string;
  to_ref: string;
  relation: string;
  /** Why the edge stands undrawn, in the words the panel shows. */
  reason: string;
}

export interface PlaceHierarchy {
  drawn: HierarchyEdgeDraw[];
  /** Edges the reading discloses but the globe cannot honestly draw. Listed, never hidden. */
  undrawn: HierarchyEdgeUndrawn[];
}

/** A place's real globe position, [lon, lat], or null. A region's position is the authority's centroid, the same anchor its label uses. */
function globePosition(place: ProjectedPlace | undefined): LonLat | null {
  if (!place || place.shape === "none" || !place.position) return null;
  if (!markerStyleForPrecision(place.precision).drawn) return null;
  return toLonLat(place.position);
}

/**
 * The hierarchy edges of the reading, resolved by the authority's projection.
 * `allFacets` is the whole reading (so a parent is known even when filtered);
 * `admittedRefs` is the set the presentation filter admits. An edge whose child
 * or known parent the filter hides is left out, as the map hides its marker.
 */
export function placeHierarchy(
  allFacets: readonly TechnePlaceFacet[],
  admittedRefs: ReadonlySet<string>,
  window?: TimeWindow | null,
): PlaceHierarchy {
  const projection = projectPlaces(allFacets, { width: UNIT_FRAME.width, height: UNIT_FRAME.height });
  const byRef = new Map(projection.places.map((place) => [place.place_ref, place] as const));
  const drawn: HierarchyEdgeDraw[] = [];
  const undrawn: HierarchyEdgeUndrawn[] = [];

  for (const edge of projection.edges) {
    // An expired edge drops out by its own validity; nothing else changes.
    if (!validInWindow(edge.valid_from, edge.valid_to, window)) continue;
    if (!admittedRefs.has(edge.to_ref)) continue;
    if (byRef.has(edge.from_ref) && !admittedRefs.has(edge.from_ref)) continue;

    const base = { from_ref: edge.from_ref, to_ref: edge.to_ref, relation: edge.relation };
    if (edge.relation !== HIERARCHY_DRAWN_RELATION) {
      undrawn.push({ ...base, reason: `${edge.relation} is not drawn as a hierarchy edge; only ${HIERARCHY_DRAWN_RELATION} is` });
      continue;
    }
    if (!byRef.has(edge.from_ref)) {
      undrawn.push({ ...base, reason: `parent ${edge.from_ref} is not disclosed in this reading` });
      continue;
    }
    const from = globePosition(byRef.get(edge.from_ref));
    if (!from) {
      undrawn.push({ ...base, reason: `parent ${edge.from_ref} has no coordinate to draw from` });
      continue;
    }
    const to = globePosition(byRef.get(edge.to_ref));
    if (!to) {
      undrawn.push({ ...base, reason: `child ${edge.to_ref} has no coordinate to draw to` });
      continue;
    }
    drawn.push({
      ...base,
      from,
      to,
      path: greatCircleArc(toLatLng(from), toLatLng(to), HIERARCHY_SEGMENTS),
    });
  }

  return { drawn, undrawn };
}

function toLatLng(point: LonLat): LatLng {
  return { latitude: point[1], longitude: point[0] };
}
