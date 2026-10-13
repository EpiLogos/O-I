/**
 * Relation layers and region polygons for the Places map (lane-4 T8 + T9) —
 * pure presentation rules over the reading's own spatial facets. No DOM and no
 * maplibre: the map and the renderer read these functions, and `node --test`
 * loads them directly.
 *
 * Laws carried here:
 *   - a layer is a relation, grouped by the authority's `placeRelations`. Its
 *     standing class is `relationStandingClass`, a function of the relation
 *     alone, so grouping by relation and by relation × class is the same grouping;
 *   - toggles narrow only what is SHOWN, through the one presentation filter the
 *     side panel writes (`filteredFacets`, placeReading.ts). The facet objects
 *     returned are the reading's own, in the reading's order; nothing is cloned,
 *     rewritten or re-minted;
 *   - a facet whose geometry reads as a polygon is drawn as that polygon and
 *     never also as a point marker. The polygon's rings are read by the
 *     authority's own ring reader (`projectPlaces`, project.ts), and its label
 *     sits at the centroid that reader gives;
 *   - standing colours come from the one vocabulary the chronology draws with
 *     (timeline/standingStyle.ts). A layer reads "sourced" only when every facet
 *     in it discloses a source ref; otherwise its standing is shown as unknown.
 *     Nothing here upgrades a standing.
 *
 * Erasable TypeScript: loadable by Vite, the renderer and `node --test`.
 */
import type { TechnePlaceFacet, TechneReading } from "../../../../../../../src/techne/contract";
import {
  placeRelations,
  relationStandingClass,
  type RelationStandingClass,
} from "../../../../../../../src/techne/m0m5/place/world";
import { projectPlaces } from "../../../../../../../src/techne/m0m5/place/project";
import type { StandingVisual } from "../../../../../../../src/techne/m0m5/timeline/standing";
import { STANDING_DRAWING, type StandingDrawing } from "../timeline/standingStyle";
import {
  filteredFacets,
  OPEN_PLACE_FILTER,
  toggleFilterMembership,
  type PlaceFilterState,
} from "../../../../../../field-studies-journeys/src/placeReading";

/** The relation a facet without a disclosed relation is grouped under (placeReading's own label). */
const UNDISCLOSED_RELATION = "(relation not disclosed)";

/** The frame the authority's ring reader projects into. At the default camera
 * (lon 0, lat 0, zoom 1) longitude and latitude map 1:1 onto x and y, so the
 * rings invert exactly back to degrees. */
const UNIT_FRAME = { width: 360, height: 180 } as const;

/** The relation a facet is grouped and filtered under, as the filter reads it. */
export function relationKey(relation: string | null | undefined): string {
  return relation ?? UNDISCLOSED_RELATION;
}

// ---------------------------------------------------------------------------
// Layers: one per relation, with the standing the chronology draws with
// ---------------------------------------------------------------------------

export interface PlaceLayer {
  /** The native relation, verbatim. */
  relation: string;
  standingClass: RelationStandingClass;
  /** The standing visual the layer is drawn with (see `layerStanding`). */
  visual: StandingVisual;
  /** The shared drawing for that visual (stroke colour, dash pattern). */
  drawing: StandingDrawing;
  /** How many facets the reading discloses under this relation. */
  count: number;
}

/**
 * The standing visual of one layer. Mythic relations read as mythic. Any other
 * layer reads as sourced only when every facet in it carries a source ref, and
 * as unknown otherwise: a place facet discloses no standing of its own, so the
 * conservative reading is the honest one.
 */
export function layerStanding(standingClass: RelationStandingClass, facets: readonly TechnePlaceFacet[]): StandingVisual {
  if (standingClass === "mythic") return "mythic";
  const sourced = facets.length > 0
    && facets.every((facet) => typeof facet.source_ref === "string" && facet.source_ref.trim().length > 0);
  return sourced ? "sourced" : "unavailable";
}

/** The reading's layers, one per relation, in the authority's grouping order. */
export function placeLayers(facets: readonly TechnePlaceFacet[]): PlaceLayer[] {
  return placeRelations(facets).map((group) => {
    const visual = layerStanding(group.standingClass, group.facets);
    return {
      relation: group.relation,
      standingClass: group.standingClass,
      visual,
      drawing: STANDING_DRAWING[visual],
      count: group.facets.length,
    };
  });
}

/** Whether a layer is on under the filter: its relation and its standing class both admitted. */
export function layerVisible(filter: PlaceFilterState, layer: Pick<PlaceLayer, "relation" | "standingClass">): boolean {
  return (!filter.relations || filter.relations.has(layer.relation))
    && (!filter.standing || filter.standing.has(layer.standingClass));
}

/**
 * The filter after one layer's toggle. Only the relation set changes; the
 * window and the standing set are carried over untouched. Collapses to open
 * once every layer is on again (placeReading's own toggle law).
 */
export function toggleLayer(filter: PlaceFilterState, layers: readonly PlaceLayer[], relation: string): PlaceFilterState {
  return {
    ...filter,
    relations: toggleFilterMembership(filter.relations, layers.map((layer) => layer.relation), relation),
  };
}

// ---------------------------------------------------------------------------
// Narrowing: the same law the side panel and the repository apply
// ---------------------------------------------------------------------------

/** The facets the filter admits: the reading's own objects, in the reading's order. */
export function admittedFacets(facets: readonly TechnePlaceFacet[], filter: PlaceFilterState): TechnePlaceFacet[] {
  // `filteredFacets` reads only the reading's spatial facets; the rest of the reading is not needed here.
  return filteredFacets({ spatial: facets } as unknown as TechneReading, filter);
}

/**
 * The place refs the reading names but the filter does not admit. The map hides
 * them exactly as the host's filtered repository does. A ref the reading does
 * not name is never hidden, since the filter has nothing to test it against.
 */
export function placeRefsHidden(facets: readonly TechnePlaceFacet[], filter: PlaceFilterState): Set<string> {
  const admitted = new Set(admittedFacets(facets, filter).map((facet) => facet.place_ref));
  const known = new Set(facets.map((facet) => facet.place_ref));
  return new Set([...known].filter((ref) => !admitted.has(ref)));
}

// ---------------------------------------------------------------------------
// Regions: polygon geometry drawn as its region, never as a point
// ---------------------------------------------------------------------------

/**
 * The place refs whose geometry reads as a polygon. Each is drawn as its
 * polygon and never also as a point marker, whatever its precision.
 */
export function polygonPlaceRefs(facets: readonly TechnePlaceFacet[]): Set<string> {
  const projection = projectPlaces(facets, UNIT_FRAME);
  return new Set(projection.places.filter((place) => place.shape === "polygon").map((place) => place.place_ref));
}

export interface PlaceRegion {
  place_ref: string;
  relation: string | null;
  precision: TechnePlaceFacet["precision"];
  /** The authority's own note for this precision, verbatim. */
  note: string;
  /** The identity name standing in the window, or null. */
  label: string | null;
  /** The layer's standing colour, from the shared drawing table. */
  colour: string;
  /** Rings of [lon, lat]; the first is the outline ring. */
  rings: Array<Array<[number, number]>>;
  /** The label anchor [lon, lat]: the authority's centroid of the outline ring. */
  anchor: [number, number];
}

/** Inverts the unit frame back to degrees. */
function toLonLat(point: { x: number; y: number }): [number, number] {
  return [point.x - 180, 90 - point.y];
}

/**
 * The polygon regions the filter admits, read by the authority's ring reader.
 * A facet with point geometry is not a region here, even at region precision:
 * it stays a point marker, which the marker grammar draws as an outline.
 */
export function placeRegions(facets: readonly TechnePlaceFacet[], filter: PlaceFilterState = OPEN_PLACE_FILTER): PlaceRegion[] {
  const admitted = admittedFacets(facets, filter);
  if (admitted.length === 0) return [];
  const colourByRelation = new Map(placeLayers(facets).map((layer) => [layer.relation, layer.drawing.stroke] as const));
  const projection = projectPlaces(admitted, { ...UNIT_FRAME, window: filter.window });
  const regions: PlaceRegion[] = [];
  for (const place of projection.places) {
    if (place.shape !== "polygon" || !place.rings || !place.position) continue;
    regions.push({
      place_ref: place.place_ref,
      relation: place.relation,
      precision: place.precision,
      note: place.marker.note,
      label: place.label,
      colour: colourByRelation.get(relationKey(place.relation)) ?? STANDING_DRAWING.unavailable.stroke,
      rings: place.rings.map((ring) => ring.map(toLonLat)),
      anchor: toLonLat(place.position),
    });
  }
  return regions;
}
