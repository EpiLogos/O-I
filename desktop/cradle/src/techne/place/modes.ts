/**
 * The Place presentations (L5 Technē T4) — map, globe and street as pure
 * view transforms over the SAME facet list. There are no separate spatial
 * stores: each mode is a function from (facets, view options) to a render
 * model, and the instrument's mode switch merely picks which model to draw.
 *
 *   map    — flat equirectangular projection (project.ts).
 *   globe  — simple orthographic disc projection, front hemisphere only,
 *            pure math, no basemap.
 *   street — a schematic single-place detail view: identity, precision,
 *            hierarchy, sources; no geography.
 *
 * The honest state of the aperture over a reading is derived here too
 * (`placeState`): disclosure-driven, never hard-coded, and an absent facet
 * field is data — an empty honest state, not an error.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechnePlaceFacet, TechnePlaceName, TechneReading } from "../contract.ts";
import {
  DEFAULT_CAMERA,
  precisionMarker,
  projectPlaces,
  type CameraState,
  type PlaceMarker,
  type PlaceProjection,
} from "./project.ts";
import { nameInWindow, placesInWindow, type TimeWindow } from "./filter.ts";

export type PlaceMode = "map" | "globe" | "street";

export const PLACE_MODES: readonly PlaceMode[] = ["map", "globe", "street"];

export const DEFAULT_VIEW = { width: 720, height: 360 };

export interface PlaceViewOptions {
  width?: number;
  height?: number;
  camera?: CameraState;
  /** The presentation time window (local control, seeded from the session). */
  window?: TimeWindow | null;
  /** The inspected place, when one is selected. */
  selectedRef?: string | null;
}

// ---------------------------------------------------------------------------
// The honest state of the aperture over a reading
// ---------------------------------------------------------------------------

export type PlaceReadingStatus = "no-reading" | "unavailable" | "empty" | "present";

export interface PlaceReadingState {
  status: PlaceReadingStatus;
  /** Why the aperture stands empty — always shown when present. */
  reason: string | null;
  /** The disclosed facets, verbatim; empty unless status is "present" or "empty". */
  facets: TechnePlaceFacet[];
}

/** Derive what the aperture may honestly show from the reading's own disclosure. */
export function placeState(reading: TechneReading | null): PlaceReadingState {
  if (!reading) return { status: "no-reading", reason: "No Technē reading is open — the place aperture discloses nothing yet.", facets: [] };
  const facets = Array.isArray(reading.spatial) ? reading.spatial : [];
  const entry = reading.disclosure?.instruments?.find((candidate) => candidate.instrument === "place");
  if (entry && !entry.available) {
    return { status: "unavailable", reason: entry.reason ?? "the place instrument is not available for this reading", facets };
  }
  if (facets.length === 0) {
    return { status: "empty", reason: "No place facets are disclosed for this subject.", facets };
  }
  return { status: "present", reason: null, facets };
}

// ---------------------------------------------------------------------------
// map — flat equirectangular
// ---------------------------------------------------------------------------

export interface MapModel {
  mode: "map";
  width: number;
  height: number;
  projection: PlaceProjection;
}

export function renderMapModel(facets: readonly TechnePlaceFacet[], options: PlaceViewOptions = {}): MapModel {
  const width = options.width ?? DEFAULT_VIEW.width;
  const height = options.height ?? DEFAULT_VIEW.height;
  return {
    mode: "map",
    width,
    height,
    projection: projectPlaces(facets, {
      width,
      height,
      camera: options.camera ?? DEFAULT_CAMERA,
      window: options.window ?? null,
    }),
  };
}

// ---------------------------------------------------------------------------
// globe — simple orthographic disc, front hemisphere only
// ---------------------------------------------------------------------------

export interface GlobePoint {
  place_ref: string;
  precision: TechnePlaceFacet["precision"];
  marker: PlaceMarker;
  label: string | null;
  /** View coordinates on the disc; null when the place is on the far side. */
  position: { x: number; y: number } | null;
  /** Rings clipped to the front hemisphere: contiguous visible runs. */
  rings: Array<Array<{ x: number; y: number }>>;
  valid_from: string | null | undefined;
  valid_to: string | null | undefined;
}

export interface GlobeEdge {
  from_ref: string;
  to_ref: string;
  relation: string;
  from: { x: number; y: number } | null;
  to: { x: number; y: number } | null;
  valid_from: string | null | undefined;
  valid_to: string | null | undefined;
}

export interface GlobeModel {
  mode: "globe";
  width: number;
  height: number;
  center: { lon: number; lat: number };
  disc: { cx: number; cy: number; r: number };
  places: GlobePoint[];
  edges: GlobeEdge[];
}

interface OrthographicPoint {
  x: number;
  y: number;
  visible: boolean;
}

/** Orthographic projection onto the disc: front hemisphere only, pure math. */
function projectOrthographic(lon: number, lat: number, center: { lon: number; lat: number }, r: number, cx: number, cy: number): OrthographicPoint {
  const rad = Math.PI / 180;
  const phi = lat * rad;
  const lambda = lon * rad;
  const phi0 = center.lat * rad;
  const lambda0 = center.lon * rad;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosPhi0 = Math.cos(phi0);
  const sinPhi0 = Math.sin(phi0);
  const cosDLambda = Math.cos(lambda - lambda0);
  const cosC = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDLambda;
  return {
    x: cx + r * cosPhi * Math.sin(lambda - lambda0),
    y: cy - r * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDLambda),
    visible: cosC >= 0,
  };
}

export function renderGlobeModel(facets: readonly TechnePlaceFacet[], options: PlaceViewOptions = {}): GlobeModel {
  const width = options.width ?? DEFAULT_VIEW.width;
  const height = options.height ?? DEFAULT_VIEW.height;
  const camera = options.camera ?? DEFAULT_CAMERA;
  const center = { lon: camera.lon, lat: camera.lat };
  const r = Math.max(24, (Math.min(width, height) / 2 - 12) * Math.min(4, Math.max(0.5, camera.zoom)));
  const cx = width / 2;
  const cy = height / 2;
  const window = options.window ?? null;

  const places: GlobePoint[] = [];
  const byRef = new Map<string, GlobePoint>();
  for (const facet of facets) {
    const point = facet.geometry?.type === "point" && Array.isArray(facet.geometry.coordinates)
      ? facet.geometry.coordinates
      : null;
    const lon = point && typeof point[0] === "number" ? point[0] : null;
    const lat = point && typeof point[1] === "number" ? point[1] : null;
    let projected: OrthographicPoint | null = null;
    const rings: Array<Array<{ x: number; y: number }>> = [];
    if (lon !== null && lat !== null) {
      projected = projectOrthographic(lon, lat, center, r, cx, cy);
    } else if (facet.geometry?.type === "polygon" && Array.isArray(facet.geometry.coordinates)) {
      // Rings of vertices, or one flat ring — both read as rings.
      const source = facet.geometry.coordinates as Array<unknown>;
      const vertexRings: Array<Array<[number, number]>> = Array.isArray((source[0] as unknown[])?.[0])
        ? (source as Array<Array<[number, number]>>)
        : [source as Array<[number, number]>];
      for (const ring of vertexRings) {
        // Keep contiguous visible runs; the limb breaks the ring honestly.
        let run: Array<{ x: number; y: number }> = [];
        for (const vertex of ring) {
          if (typeof vertex[0] !== "number" || typeof vertex[1] !== "number") continue;
          const pointOnDisc = projectOrthographic(vertex[0], vertex[1], center, r, cx, cy);
          if (pointOnDisc.visible) run.push({ x: pointOnDisc.x, y: pointOnDisc.y });
          else if (run.length) { rings.push(run); run = []; }
        }
        if (run.length) rings.push(run);
      }
    }
    const view: GlobePoint = {
      place_ref: facet.place_ref,
      precision: facet.precision,
      marker: precisionMarker(facet.precision),
      label: nameInWindow(facet, window)?.name ?? null,
      position: projected?.visible ? { x: projected.x, y: projected.y } : null,
      rings,
      valid_from: facet.valid_from ?? null,
      valid_to: facet.valid_to ?? null,
    };
    places.push(view);
    byRef.set(facet.place_ref, view);
  }

  const edges: GlobeEdge[] = [];
  for (const child of facets) {
    for (const entry of child.hierarchy ?? []) {
      const parent = byRef.get(entry.place_ref);
      edges.push({
        from_ref: entry.place_ref,
        to_ref: child.place_ref,
        relation: entry.relation,
        from: parent?.position ?? null,
        to: byRef.get(child.place_ref)?.position ?? null,
        valid_from: entry.valid_from ?? null,
        valid_to: entry.valid_to ?? null,
      });
    }
  }

  return { mode: "globe", width, height, center, disc: { cx, cy, r }, places, edges };
}

// ---------------------------------------------------------------------------
// street — schematic single-place detail
// ---------------------------------------------------------------------------

export interface StreetHierarchyRow {
  place_ref: string;
  relation: string;
  valid_from: string | null | undefined;
  valid_to: string | null | undefined;
  /** The parent's standing name, when the parent facet is in the same list. */
  parent_name: string | null;
  /** The parent facet from the same list, when present — never invented. */
  parent: TechnePlaceFacet | null;
}

export interface StreetModel {
  mode: "street";
  /** The facet in detail, verbatim; null when the list stands empty. */
  place: TechnePlaceFacet | null;
  place_ref: string | null;
  names: TechnePlaceName[];
  standing_name: string | null;
  precision: TechnePlaceFacet["precision"] | null;
  precision_note: string | null;
  geometry: { kind: "point"; lon: number; lat: number } | { kind: "polygon"; vertices: number } | { kind: "none" };
  hierarchy: StreetHierarchyRow[];
  source_ref: string | null;
  observer_frame: string | null;
  valid_from: string | null | undefined;
  valid_to: string | null | undefined;
}

export function renderStreetModel(facets: readonly TechnePlaceFacet[], options: PlaceViewOptions = {}): StreetModel {
  const place = (options.selectedRef ? facets.find((facet) => facet.place_ref === options.selectedRef) : null) ?? facets[0] ?? null;
  if (!place) {
    return {
      mode: "street",
      place: null, place_ref: null, names: [], standing_name: null,
      precision: null, precision_note: null,
      geometry: { kind: "none" },
      hierarchy: [], source_ref: null, observer_frame: null,
      valid_from: null, valid_to: null,
    };
  }
  const window = options.window ?? null;
  const geometry = place.geometry;
  let detail: StreetModel["geometry"] = { kind: "none" };
  if (geometry?.type === "point" && Array.isArray(geometry.coordinates)
    && typeof geometry.coordinates[0] === "number" && typeof geometry.coordinates[1] === "number") {
    detail = { kind: "point", lon: geometry.coordinates[0], lat: geometry.coordinates[1] };
  } else if (geometry?.type === "polygon" && Array.isArray(geometry.coordinates)) {
    // A flat ring is one ring; otherwise coordinates are rings of vertices.
    const source = geometry.coordinates as Array<unknown>;
    const isRings = Array.isArray((source[0] as unknown[] | undefined)?.[0]);
    const vertices = isRings
      ? (source as Array<unknown[]>).reduce((total, ring) => total + ring.length, 0)
      : source.length;
    detail = { kind: "polygon", vertices };
  }
  const hierarchy: StreetHierarchyRow[] = (place.hierarchy ?? []).map((entry) => {
    const parent = facets.find((facet) => facet.place_ref === entry.place_ref) ?? null;
    return {
      place_ref: entry.place_ref,
      relation: entry.relation,
      valid_from: entry.valid_from ?? null,
      valid_to: entry.valid_to ?? null,
      parent,
      parent_name: parent ? nameInWindow(parent, window)?.name ?? null : null,
    };
  });
  return {
    mode: "street",
    place,
    place_ref: place.place_ref,
    names: place.identity?.names ?? [],
    standing_name: nameInWindow(place, window)?.name ?? null,
    precision: place.precision,
    precision_note: precisionMarker(place.precision).note,
    geometry: detail,
    hierarchy,
    source_ref: place.source_ref ?? null,
    observer_frame: place.observer_frame ?? null,
    valid_from: place.valid_from ?? null,
    valid_to: place.valid_to ?? null,
  };
}

// ---------------------------------------------------------------------------
// The mode dispatch — one entry point over the same data
// ---------------------------------------------------------------------------

export type PlaceModel = MapModel | GlobeModel | StreetModel;

/** The render model for one presentation; the same facet list feeds every mode. */
export function renderForMode(mode: PlaceMode, facets: readonly TechnePlaceFacet[], options: PlaceViewOptions = {}): PlaceModel {
  switch (mode) {
    case "globe": return renderGlobeModel(facets, options);
    case "street": return renderStreetModel(facets, options);
    case "map":
    default: return renderMapModel(facets, options);
  }
}

/** The facets a mode draws: the window filter applies before any projection. */
export function facetsForView(facets: readonly TechnePlaceFacet[], options: PlaceViewOptions = {}): TechnePlaceFacet[] {
  return placesInWindow(facets, options.window ?? null);
}
