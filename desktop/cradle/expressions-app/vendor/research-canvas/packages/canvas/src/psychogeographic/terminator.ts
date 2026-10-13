/**
 * Day and night on the Places map (lane-4 T27). Pure: no DOM, no maplibre import, so the
 * surface reads these functions and `node --test` loads them directly.
 *
 * Laws: nothing here computes astronomy. The subsolar point is a value the native sky reading
 * STATES, with its epoch, provider and snapshot_ref. This module draws the terminator that
 * stated value implies (the great circle 90 degrees from the subsolar point, drawn from the
 * stated latitude and longitude, never derived from body positions) and names the reading's
 * provenance. When the reading states no subsolar point, or the producer is unavailable, the
 * answer is the reason, and nothing is drawn.
 *
 * Erasable TypeScript: loadable by Vite, the surface and `node --test`.
 */

/** A subsolar point as the sky reading states it, in degrees. */
export interface StatedSubsolar {
  latitude_degrees: number;
  longitude_degrees: number;
}

/** What the day/night layer may show: the stated reading, or the owner's reason it cannot be shown. */
export type DaylightAnswer =
  | {
      status: "stated";
      subsolar: StatedSubsolar;
      epoch_utc: string;
      provider: string;
      snapshot_ref: string;
    }
  | { status: "unavailable"; reason: string };

/** The host's port: the reading for an ISO instant, or for now when the instant is null. */
export interface DaylightHost {
  read(instant: string | null): Promise<DaylightAnswer>;
}

/** The field a sky reading must carry for the terminator to be drawn. The producer does not state one today. */
export const SUBSOLAR_FIELD = "subsolar";

/** The layer's standing, said on the surface whenever the terminator is shown. */
export const DAYLIGHT_LAW =
  "Drawn from the sky reading's stated subsolar point. The renderer computes no astronomy.";

/** The reason given when the reading carries a sky snapshot but no subsolar point. Verbatim from the producer's own shape. */
export const SUBSOLAR_NOT_STATED =
  "the sky snapshot gives body longitudes on the ecliptic and states no subsolar point, and the renderer computes none";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteIn = (value: unknown, limit: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;

/**
 * The stated subsolar point of a sky reading (the `sky` object of a `ql.nara-transit/v1` reading), or the reason
 * it is not stated. Only a `subsolar` object with finite latitude in [-90, 90] and longitude in [-180, 180] is
 * accepted; no other field is read as a subsolar point, and no value is derived from body positions.
 */
export function daylightFromSky(sky: unknown): DaylightAnswer {
  if (!isRecord(sky)) {
    return { status: "unavailable", reason: "the native sky reading carries no sky snapshot" };
  }
  const snapshotRef = typeof sky.snapshot_ref === "string" && sky.snapshot_ref.length > 0 ? sky.snapshot_ref : null;
  const epoch = typeof sky.epoch_utc === "string" && sky.epoch_utc.length > 0 ? sky.epoch_utc : null;
  if (!snapshotRef || !epoch) {
    return { status: "unavailable", reason: "the native sky reading does not disclose its snapshot or epoch" };
  }
  const subsolar = sky[SUBSOLAR_FIELD];
  if (!isRecord(subsolar) || !finiteIn(subsolar.latitude_degrees, 90) || !finiteIn(subsolar.longitude_degrees, 180)) {
    return {
      status: "unavailable",
      reason: `the sky reading (${snapshotRef}) states no subsolar point: ${SUBSOLAR_NOT_STATED}`,
    };
  }
  return {
    status: "stated",
    subsolar: { latitude_degrees: subsolar.latitude_degrees, longitude_degrees: subsolar.longitude_degrees },
    epoch_utc: epoch,
    provider: providerLabel(sky.provider),
    snapshot_ref: snapshotRef,
  };
}

/** The provider the reading names, as text: a string as given, an object compactly, truncated; "not disclosed" when absent. */
export function providerLabel(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (value === null || value === undefined) return "not disclosed";
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    return "not disclosed";
  }
  if (!text || text === "{}" || text === "[]") return "not disclosed";
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/**
 * The instant a time window stands for: its midpoint when both edges are bounded, the bounded edge when one is,
 * and null (now) when the window is open. A window whose edges do not parse stands for now.
 */
export function windowInstant(window: { from: string | null; to: string | null } | null | undefined): string | null {
  if (!window) return null;
  const from = window.from ? Date.parse(window.from) : Number.NaN;
  const to = window.to ? Date.parse(window.to) : Number.NaN;
  if (Number.isFinite(from) && Number.isFinite(to)) return new Date((from + to) / 2).toISOString();
  if (Number.isFinite(from)) return new Date(from).toISOString();
  if (Number.isFinite(to)) return new Date(to).toISOString();
  return null;
}

/** The basis the surface shows beside the layer: which instant the reading was asked for, in words. */
export function daylightBasis(instant: string | null): string {
  return instant === null
    ? "now (the shared time window is open)"
    : `window midpoint ${instant}`;
}

/** The `ql.sky-request/v1` epoch for an instant (UTC, seconds, no zone suffix); null means now. */
export function skyRequestEpoch(instant: string | null, now: Date = new Date()): string {
  const at = instant === null ? now : new Date(instant);
  return at.toISOString().slice(0, 19);
}

/**
 * The terminator as a closed ring of [longitude, latitude] pairs enclosing the NIGHT side of the stated subsolar
 * point. Each longitude gives the latitude where the great circle 90 degrees from the subsolar point crosses it;
 * the ring is then closed through the pole on the night side. Samples every `step` degrees.
 */
export function nightRing(subsolar: StatedSubsolar, step = 2): Array<[number, number]> {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const toDeg = (radians: number) => (radians * 180) / Math.PI;
  const decl = toRad(subsolar.latitude_degrees);
  const sinD = Math.sin(decl);
  const cosD = Math.cos(decl);
  const sign = sinD < 0 ? -1 : 1;
  // A subsolar point on the equator has sin(decl) = 0; the floor keeps atan2 well-defined without moving the ring.
  const absSin = Math.max(Math.abs(sinD), 1e-9);
  const samples = Math.max(1, Math.round(360 / step));
  const ring: Array<[number, number]> = [];
  for (let index = 0; index <= samples; index += 1) {
    const longitude = -180 + (index * 360) / samples;
    const hour = toRad(longitude - subsolar.longitude_degrees);
    const latitude = toDeg(Math.atan2(-sign * cosD * Math.cos(hour), absSin));
    ring.push([longitude, latitude]);
  }
  // The day pole is the one the sun's declination leans toward; the night pole is the other.
  const nightPole = sinD >= 0 ? -90 : 90;
  ring.push([180, nightPole], [-180, nightPole]);
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

/** The night side as a GeoJSON polygon feature. */
export interface TerminatorFeature {
  type: "Feature";
  properties: { kind: "night" };
  geometry: { type: "Polygon"; coordinates: Array<Array<[number, number]>> };
}

/** The night side as a GeoJSON polygon feature, for the renderer's source. */
export function terminatorFeature(subsolar: StatedSubsolar): TerminatorFeature {
  return {
    type: "Feature",
    properties: { kind: "night" },
    geometry: { type: "Polygon", coordinates: [nightRing(subsolar)] },
  };
}
