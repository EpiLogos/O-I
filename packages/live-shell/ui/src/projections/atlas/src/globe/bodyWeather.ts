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

/** The weather's own clock, in days: a smooth, bounded function of the time (ms) and the seed, so that the wind carries the clouds back and forth about where they began and never
 * winds them up. A wind that blew the same way for ever would shear the mask by the difference between neighbouring latitudes' rates times the days since 1970 (tens of thousands of
 * degrees to the degree of latitude: the clouds would be dust, and a globe covered in rings); a clock of nine days still shears them ten degrees to the degree, and the sky is a
 * smear of hairlines. The bound is the shear: the wind's rate changes by at most 1.7 degrees of longitude a day for each degree of latitude (at the fastest scale), so a clock
 * of at most 1.4 days keeps the shear under about 2.4 degrees to the degree, which is a streak, as a band of real cloud is, and not a smear. Two swings (29 and 13 days) with
 * the seed's own phases, up to a day and a third either way: the clouds are carried at most about 38 degrees from where they began, at most about eleven degrees a day at the
 * fastest band (a few at the others), and stand still where a swing turns. */
export function weatherClock(seed: number, timeMs: number): number {
  const d = timeMs / 86400000
  let h = (seed ^ 0x6a09e667) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0
  const p1 = ((h ^ (h >>> 16)) >>> 0) / 4294967296, p2 = (Math.imul(h, 0x9e3779b1) >>> 0) / 4294967296
  return .85 * (Math.sin(2 * Math.PI * (d / 29.3 + p1)) + .6 * Math.sin(2 * Math.PI * (d / 13.1 + p2)))
}

/** The degrees of longitude the cloud mask is carried at a latitude at a time (ms; the same record, latitude and time give the same number), within a turn. A body of generator
 * version 1 has no weather: its clouds do not move. */
export function weatherShift(record: WorldBodyRecord, latDeg: number, timeMs: number): number {
  if (record.generator.version < 2) return 0
  return (weatherRate(record.seed, latDeg) * weatherClock(record.seed, timeMs)) % 360
}

// ── the cloud mask ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The mask's opacity ramp over the field: a cloud is thin where the field is just above its edge and thick only well above it, so most of a cloud is translucent and the opaque cores are
 * the dense bands'. `RAMP_LOW` of the field's range below the edge is already faintly cloud, `RAMP_HIGH` above it is full. */
export const RAMP_LOW = .3, RAMP_HIGH = .5

/** The mean opacity the clouds dial asks for, and the look takes away from: 0 at 0, .75 at 1. The cover is what the dial says, as an area-weighted mean of the opacity. */
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

/** Cellular noise at a point (the distance to the nearest and to the second nearest of jittered points, one per cell of a lattice `f` cells to the unit): the walls between cells are where
 * they are nearly equal. Eight cells about the point, enough for the walls. Integer hashes of the cell and the seed: nothing is random. */
function cells(seed: number, x: number, y: number, z: number, f: number): number {
  const px = x * f, py = y * f, pz = z * f, bx = Math.floor(px - .5), by = Math.floor(py - .5), bz = Math.floor(pz - .5)
  let d1 = 9, d2 = 9
  for (let k = 0; k < 8; k++) {
    const cx = bx + (k & 1), cy = by + ((k >> 1) & 1), cz = bz + ((k >> 2) & 1)
    let h = Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263) ^ Math.imul(cz, 2147483647) ^ seed
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    const jx = ((h >>> 0) & 1023) / 1023
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
    const jy = ((h >>> 0) & 1023) / 1023
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
    const jz = ((h >>> 0) & 1023) / 1023
    const dx = cx + .15 + .7 * jx - px, dy = cy + .15 + .7 * jy - py, dz = cz + .15 + .7 * jz - pz, d = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (d < d1) { d2 = d1; d1 = d } else if (d < d2) d2 = d
  }
  return d2 - d1
}

/** The cloud field at a point: noise stretched along the latitude circles (a cloud is longer than it is wide, east to west), curled by a slow vector noise (a front is a curve, not a
 * line), laid on the bands of the sky, the bands waved in longitude (a storm track meanders) and, in the subtropics, cellular lanes (open-cell convection over the sea: rings of cloud
 * round clear air). */
export function cloudField(seed: number, x: number, y: number, z: number): number {
  const t = tablesOf(seed ^ 0x51ed270b)
  // curl: the point carried by a slow vector noise, so features bend and turn
  const cx = x + .2 * simplex3(t, x * 1.25 + 7.3, y * 1.25 - 1.9, z * 1.25 + 4.4), cy = y + .2 * simplex3(t, x * 1.25 - 5.1, y * 1.25 + 8.2, z * 1.25 - 3.3), cz = z + .2 * simplex3(t, x * 1.25 + 2.6, y * 1.25 - 6.4, z * 1.25 + 9.1)
  const ys = cy * 2.4
  const wy = ys + .35 * simplex3(t, cx * 1.3 + 4.1, cy * 1.3 - 2.2, cz * 1.3 + 8.8)
  let n = .42 * simplex3(t, cx * 2.3 + 1.2, wy * 2.3 - 5.0, cz * 2.3 + 3.3) + .27 * simplex3(t, cx * 4.9 - 7.7, wy * 4.9 + 2.5, cz * 4.9 - 1.1) + .19 * simplex3(t, cx * 10.7 + 6.6, wy * 10.7 - 8.4, cz * 10.7 + 9.2) +
    .13 * simplex3(t, cx * 23 - 2.4, wy * 23 + 5.1, cz * 23 - 7.3) + .1 * simplex3(t, cx * 48 + 8.8, wy * 48 - 3.7, cz * 48 + 1.9)
  const alat = Math.abs(Math.asin(y < -1 ? -1 : y > 1 ? 1 : y)) * R2D, lon = Math.atan2(z, x)
  // the bands, waved: a storm track meanders in longitude (a few waves round the globe, the mid-latitudes' the larger), the convergence zone a little
  const phase = ((seed ^ 0x3c6ef372) >>> 0) / 4294967296 * 6.2831853
  const wave = 7 * Math.sin(4 * lon + phase + 1.6 * simplex3(t, x * 1.4 + 2, y * 1.4 - 3, z * 1.4 + 6)) * Math.exp(-(((alat - 52) / 17) ** 2)) + 3.5 * Math.sin(3 * lon + 2.1 * phase) * Math.exp(-((alat / 18) ** 2))
  n += bandBias(Math.abs(alat + wave))
  // open cells in the subtropics: clear centres ringed by cloud
  const sub = Math.exp(-(((alat - 27) / 11) ** 2))
  if (sub > .05) n += .36 * sub * (1 - smooth(0, .2, cells(seed >>> 0, cx, cy, cz, 11)) - .3)
  return n
}

/** The mean opacity over the sphere of a field with its edge at `edge`: the ramp's value at every one of the sorted samples. */
function meanOpacity(v: Float64Array, edge: number): number {
  let sum = 0
  for (let k = 0; k < v.length; k++) sum += smooth(edge - RAMP_LOW, edge + RAMP_HIGH, v[k]!)
  return sum / v.length
}

/** The edge of the cloud field that gives the cover `target`: found so that the mean opacity of the mask over the sphere is the target (the opacity is a ramp, not a threshold). */
export function cloudEdge(seed: number, target: number): number {
  const v = fieldQuantiles(seed)
  let lo = v[0]! - RAMP_HIGH, hi = v[v.length - 1]! + RAMP_LOW
  for (let k = 0; k < 28; k++) { const mid = .5 * (lo + hi); if (meanOpacity(v, mid) > target) lo = mid; else hi = mid }
  return .5 * (lo + hi)
}

/** The cloud cover at a point, 0–1, given the edge: thin where the field just passes the edge, thick well above it, so the clouds are translucent and soft at their edges.
 * `timeShiftDeg` carries the mask east. */
export function cloudCover(seed: number, edge: number, x: number, y: number, z: number, shiftDeg = 0): number {
  if (shiftDeg !== 0) {
    // the mask carried east by `shift` is the mask as it was west of here by `shift`: rotate the point about the axis the other way
    const a = -shiftDeg / R2D, c = Math.cos(a), s = Math.sin(a), nx = x * c - z * s, nz = x * s + z * c
    x = nx; z = nz
  }
  return smooth(edge - RAMP_LOW, edge + RAMP_HIGH, cloudField(seed, x, y, z))
}
