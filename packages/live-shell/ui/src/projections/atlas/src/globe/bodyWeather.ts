// Generator version 2, the weather (T-PROCEDURAL-BODY): the clouds of a body, and how the sky carries them. The cloud mask is a layer of its own (never baked into the
// picture of the ground: white there would read as land to the shader, and the land the Place tool reads must not see weather). Its cover rises with the clouds dial; its
// bands follow latitude (cloudy at the equator, clear in the subtropics, cloudy in the storm tracks, thin at the poles).
//
// Weather is `weatherShift`: the degrees of longitude the mask is carried at a latitude at a time. The wind differs by latitude band (trade winds, westerlies, polar
// easterlies, as the Earth's do), smoothly, and is a pure function of the seed, the latitude and the time: the same occasion shows the same weather, a past occasion shows
// the weather it had, and a body in step with the Sun moves its clouds slowly. The shader (shaders.ts EARTH_FRAG, uWeatherT) slides the mask by the same formula, from
// the same table.
//
// Pure TypeScript with no DOM and no three.js: it runs in a worker. Nothing here is random, and nothing reads a clock: a caller that means Now gives the clock's reading.
import {simplex3, tablesOf} from './bodyNoise'
import type {BodyLook, WorldBodyRecord} from './body'

const R2D = 180 / Math.PI
const smooth = (e0: number, e1: number, x: number): number => { const t = x < e0 ? 0 : x > e1 ? 1 : (x - e0) / (e1 - e0); return t * t * (3 - 2 * t) }
export const barrenOfLook = (look?: BodyLook | null): number => {
  const b = look?.barren
  return typeof b === 'number' && Number.isFinite(b) ? (b < 0 ? 0 : b > 1 ? 1 : b) : 0
}

// ── the wind ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The bands of the wind: a Gaussian each, at a latitude (degrees), of a width (degrees), with a weight (negative westward, as the trades and the polar easterlies are;
 * positive eastward, as the westerlies are). The rate at a latitude is their sum times the body's own scale. Shared with the shader. */
export const WEATHER_BANDS: readonly {readonly centre: number; readonly width: number; readonly weight: number}[] = [
  {centre: 0, width: 17, weight: -.55},
  {centre: 47, width: 15, weight: 1},
  {centre: 80, width: 11, weight: -.45},
]

/** The degrees per day the wind carries the clouds at its fastest, for a seed: 16 to 28 (the Earth's clouds circle a mid-latitude in 13 to 22 days). */
export function weatherScale(seed: number): number {
  let h = (seed ^ 0x2f6e2b1) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0
  return 16 + 12 * (((h ^ (h >>> 16)) >>> 0) / 4294967296)
}

/** The wind's rate in degrees of longitude per day at a latitude. */
export function weatherRate(seed: number, latDeg: number): number {
  const a = Math.abs(latDeg)
  let r = 0
  for (const band of WEATHER_BANDS) r += band.weight * Math.exp(-(((a - band.centre) / band.width) ** 2))
  return r * weatherScale(seed)
}

/** The degrees of longitude the cloud mask is carried at a latitude at a time (ms; the same record, latitude and time give the same number), within a turn. A body of
 * generator version 1 has no weather: its clouds do not move. */
export function weatherShift(record: WorldBodyRecord, latDeg: number, timeMs: number): number {
  if (record.generator.version < 2) return 0
  return (weatherRate(record.seed, latDeg) * (timeMs / 86400000)) % 360
}

// ── the cloud mask ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The cover the clouds dial asks for, and the look takes away from: 0 at 0, .75 at 1. */
export const cloudTarget = (clouds: number, barren: number): number => .75 * Math.max(0, Math.min(1, clouds)) * (1 - barren)

/** The bands of the sky: more cloud at the equator (the convergence zone) and in the storm tracks, less in the subtropics and at the poles. */
function bandBias(alat: number): number {
  return .17 * Math.exp(-((alat / 9) ** 2)) + .22 * Math.exp(-(((alat - 55) / 13) ** 2)) - .2 * Math.exp(-(((alat - 25) / 9) ** 2)) - .1 * smooth(75, 90, alat)
}

const edges = new Map<number, Float64Array>()

/** The sorted values of the cloud field over the sphere, for a seed (kept: the edge of the cover is read from them). */
function fieldQuantiles(seed: number): Float64Array {
  const hit = edges.get(seed >>> 0)
  if (hit) return hit
  const N = 3072, v = new Float64Array(N)
  for (let k = 0; k < N; k++) {
    const y = 1 - 2 * (k + .5) / N, r = Math.sqrt(1 - y * y), a = k * 2.399963229728653
    v[k] = cloudField(seed, r * Math.cos(a), y, r * Math.sin(a))
  }
  v.sort()
  if (edges.size >= 8) edges.delete(edges.keys().next().value as number)
  edges.set(seed >>> 0, v)
  return v
}

/** The cloud field at a point: noise stretched along the latitude circles (a cloud is longer than it is wide, east to west) with the bands of the sky laid on it. */
export function cloudField(seed: number, x: number, y: number, z: number): number {
  const t = tablesOf(seed ^ 0x51ed270b), ys = y * 2.4
  const wy = ys + .35 * simplex3(t, x * 1.3 + 4.1, y * 1.3 - 2.2, z * 1.3 + 8.8)
  let n = .5 * simplex3(t, x * 2.3 + 1.2, wy * 2.3 - 5.0, z * 2.3 + 3.3) + .3 * simplex3(t, x * 4.9 - 7.7, wy * 4.9 + 2.5, z * 4.9 - 1.1) + .2 * simplex3(t, x * 10.7 + 6.6, wy * 10.7 - 8.4, z * 10.7 + 9.2)
  n += bandBias(Math.abs(Math.asin(y < -1 ? -1 : y > 1 ? 1 : y)) * R2D)
  return n
}

/** The edge of the cloud field that leaves `target` of the sphere above it. */
export function cloudEdge(seed: number, target: number): number {
  const v = fieldQuantiles(seed)
  return v[Math.min(v.length - 1, Math.max(0, Math.floor((1 - target) * v.length)))]!
}

/** The cloud cover at a point, 0–1, given the edge: a soft edge so the globe does not draw the field's cells. `timeShiftDeg` carries the mask east. */
export function cloudCover(seed: number, edge: number, x: number, y: number, z: number, shiftDeg = 0): number {
  if (shiftDeg !== 0) {
    // the mask carried east by `shift` is the mask as it was west of here by `shift`: rotate the point about the axis the other way
    const a = -shiftDeg / R2D, c = Math.cos(a), s = Math.sin(a), nx = x * c - z * s, nz = x * s + z * c
    x = nx; z = nz
  }
  return smooth(edge - .07, edge + .07, cloudField(seed, x, y, z))
}
