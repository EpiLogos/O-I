/**
 * The Place projection (L5 Technē T4) — pure equirectangular projection of
 * `TechnePlaceFacet` geometry into view coordinates, plus the precision
 * rendering data (exact → solid, approximate → halo, region → outline,
 * unlocated → an honest "no coordinate" register).
 *
 * Schematic by law (wayfinder §8, §18 T4): lat/lon into the view, no tiles,
 * no basemap dependency — the mature tiled basemap is a later provider
 * concern, recorded as an open item. Uncertainty is data: the marker kind is
 * derived from the facet's own precision and never upgraded to look nicer.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechnePlaceFacet, TechnePlacePrecision } from "../contract.ts";
import { nameInWindow, type TimeWindow } from "./filter.ts";

// ---------------------------------------------------------------------------
// Camera (presentation state; the instrument owns it, this file only reads it)
// ---------------------------------------------------------------------------

/** The local camera: centre lon/lat in degrees and a zoom factor. */
export interface CameraState {
  lon: number;
  lat: number;
  zoom: number;
}

export const DEFAULT_CAMERA: CameraState = { lon: 0, lat: 0, zoom: 1 };

/** The world window the camera looks at, in degrees. */
export interface WorldBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

/** The equirectangular window for a camera: zoom 1 shows the whole world. */
export function equirectBounds(camera: CameraState): WorldBounds {
  const zoom = camera.zoom > 0 ? camera.zoom : 1;
  const spanLon = 360 / zoom;
  const spanLat = 180 / zoom;
  return {
    west: camera.lon - spanLon / 2,
    east: camera.lon + spanLon / 2,
    south: camera.lat - spanLat / 2,
    north: camera.lat + spanLat / 2,
  };
}

/** Equirectangular projection of one degree coordinate into view coordinates. */
export function projectEquirect(lon: number, lat: number, bounds: WorldBounds, width: number, height: number): { x: number; y: number } {
  return {
    x: ((lon - bounds.west) / (bounds.east - bounds.west)) * width,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * height,
  };
}

// ---------------------------------------------------------------------------
// Precision rendering data — precision is data, never upgraded
// ---------------------------------------------------------------------------

/** The four precision renderings. `uncertainty` marks what must NOT read as exact. */
export type PlaceMarkerKind = "solid" | "halo" | "outline" | "no-coordinate";

export interface PlaceMarker {
  kind: PlaceMarkerKind;
  /** True when the rendering must stay visibly uncertain. */
  uncertainty: boolean;
  /** The honest note the view may show beside the marker. */
  note: string;
}

/** The precision rendering data for one facet precision. */
export function precisionMarker(precision: TechnePlacePrecision): PlaceMarker {
  switch (precision) {
    case "exact":
      return { kind: "solid", uncertainty: false, note: "exact position" };
    case "approximate":
      return { kind: "halo", uncertainty: true, note: "approximate — halo, not a solid fix" };
    case "region":
      return { kind: "outline", uncertainty: true, note: "regional — outline only, not a point" };
    case "unlocated":
      return { kind: "no-coordinate", uncertainty: true, note: "no coordinate disclosed" };
  }
}

// ---------------------------------------------------------------------------
// The projection of a facet list
// ---------------------------------------------------------------------------

export interface ProjectedPlace {
  place_ref: string;
  /** The caller's own facet object, carried verbatim — never cloned. */
  facet: TechnePlaceFacet;
  precision: TechnePlacePrecision;
  marker: PlaceMarker;
  /** point | polygon | none (no or malformed geometry, or unlocated). */
  shape: "point" | "polygon" | "none";
  /** View coordinates of the point fix, or the label anchor for regions, or
   * the honest "no coordinate" register slot. Null only for degenerate views. */
  position: { x: number; y: number } | null;
  /** Projected polygon rings (first is the outline ring), when polygon. */
  rings: Array<Array<{ x: number; y: number }>> | null;
  /** The identity name standing in the window, for the map label. */
  label: string | null;
  /** Validity window, exposed for the time filter and the detail view. */
  valid_from: string | null | undefined;
  valid_to: string | null | undefined;
}

/** One parent→child hierarchy edge; endpoints are null when that side has no
 * projected position (the edge is then listed honestly but not drawn). */
export interface ProjectedEdge {
  from_ref: string;
  to_ref: string;
  relation: string;
  from: { x: number; y: number } | null;
  to: { x: number; y: number } | null;
  valid_from: string | null | undefined;
  valid_to: string | null | undefined;
}

export interface PlaceProjection {
  width: number;
  height: number;
  bounds: WorldBounds;
  places: ProjectedPlace[];
  edges: ProjectedEdge[];
}

export interface ProjectOptions {
  width: number;
  height: number;
  camera?: CameraState;
  /** The presentation time window, used only to resolve identity labels. */
  window?: TimeWindow | null;
}

function ringPoints(ring: unknown): Array<[number, number]> {
  if (!Array.isArray(ring)) return [];
  const points: Array<[number, number]> = [];
  for (const vertex of ring) {
    if (Array.isArray(vertex) && typeof vertex[0] === "number" && typeof vertex[1] === "number") {
      points.push([vertex[0], vertex[1]]);
    }
  }
  return points;
}

/** Point coordinates [lon, lat] as numbers, else null. */
function pointCoordinates(geometry: TechnePlaceFacet["geometry"]): [number, number] | null {
  if (!geometry || geometry.type !== "point" || !Array.isArray(geometry.coordinates)) return null;
  const [lon, lat] = geometry.coordinates;
  return typeof lon === "number" && typeof lat === "number" ? [lon, lat] : null;
}

/** Polygon coordinates as rings of [lon, lat]; a flat ring is accepted as one ring. */
function polygonRings(geometry: TechnePlaceFacet["geometry"]): Array<Array<[number, number]>> {
  if (!geometry || geometry.type !== "polygon" || !Array.isArray(geometry.coordinates)) return [];
  const coordinates = geometry.coordinates;
  const flat = ringPoints(coordinates);
  if (flat.length) return [flat];
  const rings: Array<Array<[number, number]>> = [];
  for (const ring of coordinates) {
    const points = ringPoints(ring);
    if (points.length) rings.push(points);
  }
  return rings;
}

function centroid(ring: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (ring.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const point of ring) {
    x += point.x;
    y += point.y;
  }
  return { x: x / ring.length, y: y / ring.length };
}

/** Where an unlocated place stands in the view: an honest "no coordinate"
 * register along the lower edge, left to right in facet order. */
function unlocatedSlot(index: number, width: number, height: number): { x: number; y: number } {
  const perRow = Math.max(1, Math.floor((width - 24) / 96));
  return {
    x: 24 + (index % perRow) * 96,
    y: Math.max(24, height - 18 - Math.floor(index / perRow) * 28),
  };
}

/**
 * Project a facet list into one view. Pure: the facets are read, never
 * written; hierarchy edges are resolved parent→child against the same list
 * and keep their own validity for the time filter.
 */
export function projectPlaces(facets: readonly TechnePlaceFacet[], options: ProjectOptions): PlaceProjection {
  const { width, height } = options;
  const bounds = equirectBounds(options.camera ?? DEFAULT_CAMERA);
  const places: ProjectedPlace[] = [];
  const byRef = new Map<string, ProjectedPlace>();
  let unlocatedIndex = 0;

  for (const facet of facets) {
    const marker = precisionMarker(facet.precision);
    const point = pointCoordinates(facet.geometry);
    const rings = polygonRings(facet.geometry);
    let shape: ProjectedPlace["shape"] = "none";
    let position: { x: number; y: number } | null = null;
    let projectedRings: Array<Array<{ x: number; y: number }>> | null = null;
    if (point) {
      shape = "point";
      position = projectEquirect(point[0], point[1], bounds, width, height);
    } else if (rings.length) {
      shape = "polygon";
      projectedRings = rings.map((ring) => ring.map(([lon, lat]) => projectEquirect(lon, lat, bounds, width, height)));
      position = centroid(projectedRings[0]);
    } else {
      position = unlocatedSlot(unlocatedIndex, width, height);
      unlocatedIndex += 1;
    }
    const name = nameInWindow(facet, options.window);
    const view: ProjectedPlace = {
      place_ref: facet.place_ref,
      facet,
      precision: facet.precision,
      marker,
      shape,
      position,
      rings: projectedRings,
      label: name?.name ?? null,
      valid_from: facet.valid_from ?? null,
      valid_to: facet.valid_to ?? null,
    };
    places.push(view);
    byRef.set(facet.place_ref, view);
  }

  const edges: ProjectedEdge[] = [];
  for (const child of places) {
    for (const entry of child.facet.hierarchy ?? []) {
      const parent = byRef.get(entry.place_ref);
      edges.push({
        from_ref: entry.place_ref,
        to_ref: child.place_ref,
        relation: entry.relation,
        from: parent?.position ?? null,
        to: child.position,
        valid_from: entry.valid_from ?? null,
        valid_to: entry.valid_to ?? null,
      });
    }
  }

  return { width, height, bounds, places, edges };
}
