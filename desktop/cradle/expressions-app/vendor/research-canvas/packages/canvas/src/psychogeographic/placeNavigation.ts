/**
 * Place navigation — pure presentation rules for the globe camera and the
 * precision grammar on the live globe (lane-4 T1, T2, T10).
 *
 * No DOM and no maplibre import: the renderer and the surface read these
 * functions, and `node --test` loads them directly.
 *
 * Law: the marker kind and the flight zoom are derived from the facet's own
 * precision through the cradle authority `precisionMarker`
 * (desktop/cradle/src/techne/m0m5/place/project.ts). Nothing here upgrades a
 * precision to look nicer, and nothing re-declares that vocabulary.
 *
 * Erasable TypeScript: loadable by Vite, the renderer and `node --test`.
 */
import { precisionMarker, type PlaceMarkerKind } from "../../../../../../../src/techne/m0m5/place/project";
import type { TechnePlacePrecision } from "../../../../../../../src/techne/contract";
import { toVector, type LatLng } from "./geometry";
import { GLOBE } from "./mapStyle";

// ---------------------------------------------------------------------------
// Camera state: pitch and bearing, with defaults for records saved before T1
// ---------------------------------------------------------------------------

/** The map view state. `pitch` and `bearing` are degrees and optional so that
 * records saved before T1 (latitude, longitude, zoom only) stay valid. */
export interface PlaceViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

/** MapLibre's own default ceiling for pitch. */
export const PITCH_MAX = 85;

/** Pitch in degrees, clamped to [0, PITCH_MAX]; anything not finite reads as 0. */
export function clampPitch(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(PITCH_MAX, Math.max(0, value));
}

/** Bearing in degrees, wrapped into [-180, 180); anything not finite reads as 0. */
export function normalizeBearing(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

/** Fills pitch and bearing with their defaults (0) on a view state that may
 * predate them. Latitude, longitude and zoom are carried unchanged. */
export function withCameraDefaults(state: PlaceViewState): PlaceViewState & { pitch: number; bearing: number } {
  return {
    latitude: state.latitude,
    longitude: state.longitude,
    zoom: state.zoom,
    pitch: clampPitch(state.pitch),
    bearing: normalizeBearing(state.bearing),
  };
}

/** The saved place viewport record, as the native owner stores it today
 * (`x` = longitude, `y` = latitude). `pitch` and `bearing` are written only
 * when the camera is actually tilted or rotated, so an untilted view stays
 * byte-compatible with the record shape already accepted by the owner. */
export interface PlaceViewportRecord {
  x: number;
  y: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export function placeRecordFromViewState(state: PlaceViewState): PlaceViewportRecord {
  const camera = withCameraDefaults(state);
  const record: PlaceViewportRecord = { x: camera.longitude, y: camera.latitude, zoom: camera.zoom };
  if (camera.pitch !== 0 || camera.bearing !== 0) {
    record.pitch = camera.pitch;
    record.bearing = camera.bearing;
  }
  return record;
}

/** Reads a saved place viewport record. Records without pitch or bearing (all
 * records saved before T1) read as untilted. Returns null for a record that
 * does not carry a finite longitude, latitude and zoom. */
export function viewStateFromPlaceRecord(record: unknown): PlaceViewState | null {
  if (!record || typeof record !== "object") return null;
  const value = record as Record<string, unknown>;
  const { x, y, zoom } = value;
  if (typeof x !== "number" || typeof y !== "number" || typeof zoom !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return null;
  return withCameraDefaults({
    latitude: y,
    longitude: x,
    zoom,
    pitch: value.pitch as number | undefined,
    bearing: value.bearing as number | undefined,
  });
}

// ---------------------------------------------------------------------------
// Precision: the honest vocabulary, read from the cradle authority
// ---------------------------------------------------------------------------

const PRECISIONS: readonly TechnePlacePrecision[] = ["exact", "approximate", "region", "unlocated"];

function isPlacePrecision(value: string): value is TechnePlacePrecision {
  return (PRECISIONS as readonly string[]).includes(value);
}

/** The marker kind for a precision, read from `precisionMarker`. An
 * unrecognised precision has no disclosed kind and is treated as no-coordinate. */
function markerKindFor(precision: string): PlaceMarkerKind {
  return isPlacePrecision(precision) ? precisionMarker(precision).kind : "no-coordinate";
}

// ---------------------------------------------------------------------------
// T2: flight zoom by precision kind, eased flight, duration by distance
// ---------------------------------------------------------------------------

/** Flight zoom per marker kind: street scale for an exact fix, city scale for
 * an approximate one, a continent frame for a region, and no flight at all for
 * a place with no coordinate. Keyed by the kind, so the zoom follows the same
 * authority as the marker. */
const FLIGHT_ZOOM_BY_KIND: Record<PlaceMarkerKind, number | null> = {
  solid: 16,
  halo: 11,
  outline: 4,
  "no-coordinate": null,
};

/** The zoom a flight to a place of this precision lands at, or null when the
 * place must not fly. */
export function flightZoomForPrecision(precision: string): number | null {
  return FLIGHT_ZOOM_BY_KIND[markerKindFor(precision)];
}

/** The easing shared with the Canvas's flyToNode: xyflow's default transition
 * ease, a cubic in-out (d3-ease `easeCubic`), which the Canvas's 500 ms
 * setCenter/setViewport transitions use. */
export function flightEase(t: number): number {
  const x = t * 2;
  return (x <= 1 ? x * x * x : (x - 2) * (x - 2) * (x - 2) + 2) / 2;
}

/** Great-circle angle between two places, in degrees, from the canvas's own
 * unit-sphere geometry. */
export function angularDistanceDegrees(a: LatLng, b: LatLng): number {
  const va = toVector(a);
  const vb = toVector(b);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  return (Math.acos(dot) * 180) / Math.PI;
}

/** Flight duration grows with the angle travelled: 900 ms for a short hop,
 * 3600 ms at most. */
export function flightDurationMs(distanceDegrees: number): number {
  const distance = Number.isFinite(distanceDegrees) ? Math.max(0, distanceDegrees) : 0;
  return Math.min(3600, Math.max(900, Math.round(900 + 15 * distance)));
}

export interface PlaceFlightInput {
  precision: string;
  title: string;
  /** The place's point, or null when it has none (a region's centroid, etc.). */
  point: LatLng | null;
  from: LatLng;
}

export type PlaceFlightPlan =
  | {
      flies: true;
      kind: PlaceMarkerKind;
      latitude: number;
      longitude: number;
      zoom: number;
      durationMs: number;
      easing: (t: number) => number;
    }
  | {
      flies: false;
      reason: "unlocated" | "no-point" | "unknown-precision";
      /** The honest line the surface shows: the place is named, and no camera moves. */
      note: string;
    };

/** Plans a flight to a place. Pure: the renderer performs the flight. An
 * unlocated place never flies; the note names it for the no-coordinate register. */
export function planPlaceFlight(input: PlaceFlightInput): PlaceFlightPlan {
  const known = isPlacePrecision(input.precision);
  const kind = markerKindFor(input.precision);
  const zoom = FLIGHT_ZOOM_BY_KIND[kind];
  if (!known) {
    return {
      flies: false,
      reason: "unknown-precision",
      note: `${input.title}: precision not disclosed. No flight; it stands in the no-coordinate register.`,
    };
  }
  if (zoom === null) {
    return {
      flies: false,
      reason: "unlocated",
      note: `${input.title}: no coordinate disclosed. No flight; it stands in the no-coordinate register.`,
    };
  }
  if (!input.point || !isLatLng(input.point)) {
    return {
      flies: false,
      reason: "no-point",
      note: `${input.title}: no point to fly to. No flight.`,
    };
  }
  return {
    flies: true,
    kind,
    latitude: input.point.latitude,
    longitude: input.point.longitude,
    zoom,
    durationMs: flightDurationMs(angularDistanceDegrees(input.from, input.point)),
    easing: flightEase,
  };
}

// ---------------------------------------------------------------------------
// T10: four renderings from the precision kind; unlocated never on the map
// ---------------------------------------------------------------------------

export interface PlaceMarkerStyle {
  kind: PlaceMarkerKind;
  /** False for no-coordinate: the place stands in the register, never on the map. */
  drawn: boolean;
  diameterPx: number;
  background: string;
  border: string;
  boxShadow: string;
  /** The authority's honest note, shown beside the marker when uncertain. */
  note: string;
  uncertainty: boolean;
}

function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The rendering for a precision. Four are distinct: solid (exact), halo
 * (approximate), dashed outline (region), and no marker at all (unlocated,
 * which lives in the register). */
export function markerStyleForPrecision(precision: string): PlaceMarkerStyle {
  const known = isPlacePrecision(precision);
  const marker = known ? precisionMarker(precision) : null;
  const note = marker?.note ?? "precision not disclosed";
  const uncertainty = marker?.uncertainty ?? true;
  switch (markerKindFor(precision)) {
    case "solid":
      return {
        kind: "solid",
        drawn: true,
        diameterPx: 16,
        background: GLOBE.marker,
        border: "2px solid #17171d",
        boxShadow: `0 0 0 3px ${alpha(GLOBE.marker, 0.18)}, 0 2px 10px rgba(0,0,0,.6)`,
        note,
        uncertainty,
      };
    case "halo":
      return {
        kind: "halo",
        drawn: true,
        diameterPx: 24,
        background: `radial-gradient(circle, ${alpha(GLOBE.marker, 0.55)} 0%, ${alpha(GLOBE.marker, 0.18)} 45%, ${alpha(GLOBE.marker, 0)} 70%)`,
        border: "0",
        boxShadow: "none",
        note,
        uncertainty,
      };
    case "outline":
      return {
        kind: "outline",
        drawn: true,
        diameterPx: 18,
        background: "transparent",
        border: `2px dashed ${GLOBE.marker}`,
        boxShadow: "none",
        note,
        uncertainty,
      };
    case "no-coordinate":
      return {
        kind: "no-coordinate",
        drawn: false,
        diameterPx: 0,
        background: "none",
        border: "0",
        boxShadow: "none",
        note,
        uncertainty,
      };
  }
}

export interface PlaceMarkerPlan {
  style: PlaceMarkerStyle;
  latitude: number;
  longitude: number;
}

/** The marker to draw for a place, or null. Null for a no-coordinate place and
 * for any place without a finite, in-range point, so an unlocated place is
 * never drawn at (0,0) or anywhere else. */
export function placeMarkerPlan(input: {
  precision: string;
  latitude: unknown;
  longitude: unknown;
}): PlaceMarkerPlan | null {
  const style = markerStyleForPrecision(input.precision);
  if (!style.drawn) return null;
  const point = { latitude: input.latitude, longitude: input.longitude };
  if (!isLatLng(point)) return null;
  return { style, latitude: point.latitude, longitude: point.longitude };
}

function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;
  const { latitude, longitude } = value as Record<string, unknown>;
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
