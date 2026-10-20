// Generator version 2, the surface (T-PROCEDURAL-BODY): what a body's land and sea look like, from the field (bodyField.ts) and the record's climate. Temperature from
// latitude, height and warmth; moisture from the bands of the sky (wet equator, dry subtropics, wet mid-latitudes, dry poles), the distance from the sea and the
// moisture dial; a biome from the two (desert, steppe, savanna, grass, forest, jungle, taiga, tundra); snow above a snow line; ice caps with a ragged margin and sea
// ice and land ice, in step with warmth and none at 0. The colours carry the cues EARTH_FRAG grades (globe/shaders.ts EARTH_COMMON): sea is blue well above red, deepest
// where it is deepest and lightest on the shelf; land's tone is its luma with its relief shading in it; ice and snow are bright and unsaturated.
//
// Everything is a pure function of a point and the record. Pure TypeScript with no DOM and no three.js: it runs in a worker.
import {simplex3, type NoiseTables} from './bodyNoise'
import {SEA, clamp01, smooth, type LandParams} from './bodyField'
import {waterAt, WATER, type RiverNetwork} from './bodyRivers'
import type {WorldBodyRecord} from './body'

const R2D = 180 / Math.PI

/** The climate of a record turned into the constants the surface uses. */
export interface Surface {
  readonly t: NoiseTables
  /** added to the temperature everywhere: the warmth dial against the Earth-like default .58 */
  readonly warmShift: number
  /** the factor the moisture dial puts on the sky's bands */
  readonly moistFactor: number
  /** the latitude (degrees) of the ice margin at its middle, and whether there is a cap at all (0 at ice caps 0) */
  readonly capBase: number
  readonly capOn: number
  /** the lowest latitude any ice can reach (a floor to skip the cap's noise below it) */
  readonly capFloor: number
  /** the look: 0 lived in, 1 a grey, dry, airless moon */
  readonly barren: number
  /** the rivers and lakes of the land, where the picture resolves them (null: none drawn) */
  readonly net: RiverNetwork | null
}

export function surfaceOf(record: WorldBodyRecord, P: LandParams, barren = 0, net: RiverNetwork | null = null): Surface {
  const {warmth, moisture, ice_caps} = record.climate
  const capOn = smooth(0, .05, ice_caps)
  // the margin: 78° at a little ice, 38° at all of it, and 20° poleward for a world 1.0 warmer than the default, equatorward for a colder one
  const capBase = 80 - 38 * ice_caps + 20 * (warmth - .58)
  return {t: P.t, warmShift: (warmth - .58) * 1.25, moistFactor: .3 + 1.5 * moisture, capBase, capOn, capFloor: capBase - 22, barren, net}
}

// ── colours ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The land's colours by temperature (rows, cold to hot) and moisture (columns, dry to wet): bare rock and tundra, steppe, desert, savanna, grass, forest, jungle. */
const BIOME: readonly (readonly [number, number, number])[][] = [
  [[.4, .4, .33], [.38, .39, .3], [.3, .34, .26], [.25, .3, .22], [.22, .28, .21]],
  [[.46, .42, .33], [.4, .39, .28], [.12, .19, .11], [.1, .17, .1], [.08, .15, .09]],
  [[.66, .57, .42], [.5, .46, .32], [.3, .37, .14], [.12, .2, .08], [.1, .18, .07]],
  [[.7, .6, .44], [.58, .5, .34], [.44, .42, .24], [.13, .22, .07], [.09, .17, .05]],
  [[.74, .62, .45], [.6, .51, .33], [.45, .42, .23], [.11, .2, .06], [.07, .15, .04]],
]
const ROCK = [.43, .39, .34] as const
const SNOW = [.95, .96, .97] as const
const LAND_ICE = [.94, .955, .965] as const
const SEA_ICE = [.925, .952, .975] as const

/** How much snow (0) and ice (1) the surface just computed carries: the relief shading is kept off them so that they stay as bright as they are. */
export const WHITE = new Float64Array(2)
const SHELF = [.1, .26, .47] as const, MID = [.04, .13, .31] as const, DEEP = [.012, .05, .19] as const, ABYSS = [.004, .017, .09] as const

/** The zonal moisture of the sky: wet at the equator, dry at about 25°, wet again in the mid-latitudes (about 52°), dry at the poles; 0.1 to 1. */
function zonal(alat: number): number {
  const eq = Math.exp(-((alat / 16) ** 2)), mid = .88 * Math.exp(-(((alat - 52) / 17) ** 2))
  return .1 + .9 * (eq > mid ? eq : mid)
}

/** The land's colour at a point, without its relief shading: `L` the elevation above the sea 0–1, `cn` the continentality, `alat` the latitude in degrees (absolute).
 * Writes the colour to `col`; returns the snow it carries (0–1). `fmax` is the finest frequency of detail asked for. */
export function landColour(S: Surface, x: number, y: number, z: number, L: number, cn: number, alat: number, fmax: number, col: Float64Array): number {
  const t = S.t
  const cl = Math.cos(alat / R2D)
  // temperature: warm at the equator, cold at the poles, colder with height
  const T = .27 + .73 * Math.pow(cl, 1.4) + S.warmShift - .95 * L + .07 * simplex3(t, x * 2.3 + 3.1, y * 2.3 - 7.7, z * 2.3 + 1.9)
  // moisture: the sky's bands, drier in a continent's interior, and the dial
  let M = zonal(alat) * S.moistFactor * (1 - .35 * smooth(.15, .7, cn)) + .16 * simplex3(t, x * 3.1 - 5.3, y * 3.1 + 2.7, z * 3.1 + 8.1)
  // the ground's cover is patchy at every scale a picture resolves (forest and clearing, scrub and bare ground), in patches that grow finer with the zoom
  if (fmax > 30) M += .03 * simplex3(t, x * 38 + 3.7, y * 38 - 11.2, z * 38 + 6.1)
  if (fmax > 90) M += .03 * simplex3(t, x * 115 - 5.9, y * 115 + 2.3, z * 115 - 9.4)
  if (fmax > 300) M += .03 * simplex3(t, x * 340 + 8.1, y * 340 - 3.6, z * 340 + 1.2)
  M = clamp01(M)
  const ti = clamp01(T) * 4, mi = M * 4
  const t0 = Math.min(3, Math.floor(ti)), m0 = Math.min(3, Math.floor(mi)), tf = ti - t0, mf = mi - m0
  const a = BIOME[t0]![m0]!, b = BIOME[t0]![m0 + 1]!, c = BIOME[t0 + 1]![m0]!, d = BIOME[t0 + 1]![m0 + 1]!
  let r = (a[0] * (1 - mf) + b[0] * mf) * (1 - tf) + (c[0] * (1 - mf) + d[0] * mf) * tf
  let g = (a[1] * (1 - mf) + b[1] * mf) * (1 - tf) + (c[1] * (1 - mf) + d[1] * mf) * tf
  let bl = (a[2] * (1 - mf) + b[2] * mf) * (1 - tf) + (c[2] * (1 - mf) + d[2] * mf) * tf
  // the ground's own character varies from place to place (red earth here, pale there; a lighter, thinner green, a darker, denser one)
  const g1 = simplex3(t, x * 6.3 + 14.2, y * 6.3 - 3.9, z * 6.3 + 7.5), g2 = simplex3(t, x * 7.9 - 8.8, y * 7.9 + 12.1, z * 7.9 - 2.6), g3 = simplex3(t, x * 5.1 + 3.3, y * 5.1 + 9.9, z * 5.1 - 11.7)
  r *= 1 + .16 * g1 + .09 * g2; g *= 1 + .14 * g2 - .04 * g1; bl *= 1 + .24 * g3 - .1 * g1
  // and its lightness, in broad stretches (a pale plain, a dark forest, a scorched basin), apart from its hue
  const v = 1 + .2 * simplex3(t, x * 3.4 - 6.7, y * 3.4 + 1.2, z * 3.4 + 9.6) + .1 * simplex3(t, x * 9.7 + 2.2, y * 9.7 - 4.1, z * 9.7 + 6.3)
  r *= v; g *= v; bl *= v
  // bare rock on the high ground
  const rock = smooth(.3, .75, L) * .7
  r += (ROCK[0] - r) * rock; g += (ROCK[1] - g) * rock; bl += (ROCK[2] - bl) * rock
  // mottle: the ground is never one colour; as fine as the detail asks
  let mot = 1 + .1 * simplex3(t, x * 31 + 9.1, y * 31 - 3.3, z * 31 + 4.7) + .06 * simplex3(t, x * 97 - 2.2, y * 97 + 6.4, z * 97 - 8.8)
  for (let f = 290, amp = .04; f <= fmax && amp > .004; f *= 3.1, amp *= .7) mot += amp * simplex3(t, x * f + 1.3, y * f - 2.9, z * f + 5.1)
  r *= mot; g *= mot; bl *= mot
  // snow above the snow line
  const snow = smooth(.15, .04, T) * (1 - S.barren)
  WHITE[0] = snow
  if (snow > 0) { r += (SNOW[0] - r) * snow; g += (SNOW[1] - g) * snow; bl += (SNOW[2] - bl) * snow }
  col[0] = r; col[1] = g; col[2] = bl
  return snow
}

/** The sea's colour at a depth 0 (the coast) to ~1 (the abyss): turquoise on the shelf, navy in the deep, darker in the basins, with the floor's own mottle. */
export function seaColour(S: Surface, x: number, y: number, z: number, depth: number, fmax: number, col: Float64Array): void {
  const t = S.t
  const k1 = smooth(0, .26, depth), k2 = smooth(.2, .72, depth), k3 = smooth(.74, 1.02, depth)
  let r = SHELF[0] + (MID[0] - SHELF[0]) * k1, g = SHELF[1] + (MID[1] - SHELF[1]) * k1, b = SHELF[2] + (MID[2] - SHELF[2]) * k1
  r += (DEEP[0] - r) * k2; g += (DEEP[1] - g) * k2; b += (DEEP[2] - b) * k2
  // the abyss is darker than the deep: its basins read against the ridges that rise from them
  r += (ABYSS[0] - r) * k3; g += (ABYSS[1] - g) * k3; b += (ABYSS[2] - b) * k3
  let mot = 1 + .15 * simplex3(t, x * 11 + 5.5, y * 11 + 1.1, z * 11 - 2.2) + .11 * simplex3(t, x * 3.7 - 1.9, y * 3.7 + 6.3, z * 3.7 + 2.4)
  for (let f = 130, amp = .05; f <= fmax && amp > .004; f *= 2.1, amp *= .66) mot += amp * simplex3(t, x * f - 4.7, y * f + 9.3, z * f + 2.2)
  col[0] = r * mot; col[1] = g * mot; col[2] = b * mot
}

/** The ice of the caps over a colour already written to `col`: the margin is lobed (a cap is not a ring: its edge runs tens of degrees of latitude in longitude), ragged, and the
 * sea ice breaks into floes toward it; sea ice and land ice differ at the margin and are one white inside; none where the dial is 0. Returns how much ice stands there 0–1.
 * `detail` is the wavelength the picture resolves (radians): the finest cracks are drawn only where a picture shows them. */
export function iceOver(S: Surface, x: number, y: number, z: number, alat: number, sea: boolean, detail: number, col: Float64Array): number {
  WHITE[1] = 0
  if (S.capOn <= 0 || alat < S.capFloor || S.barren >= 1) return 0
  const t = S.t, fmax = .9 / detail
  const edge = 95 - S.capOn * (95 - S.capBase) + 11 * simplex3(t, x * 1.5 - 12.4, y * 1.5 + 6.6, z * 1.5 + 3.7) + 5 * simplex3(t, x * 3.9 + 4.4, y * 3.9 - 9.1, z * 3.9 + 12.3)
    + 1.7 * simplex3(t, x * 14 - 3.8, y * 14 + 7.4, z * 14 + 2.6) + (fmax > 40 ? .7 * simplex3(t, x * 41 + 5.2, y * 41 - 2.2, z * 41 + 8.8) : 0)
  let k: number
  if (sea) {
    // the marginal ice zone: ice thins over ten degrees of latitude into floes, and the floes into open water
    const c = smooth(edge - 8, edge + 3, alat)
    const n = .5 * simplex3(t, x * 11 + 7.2, y * 11 - 1.8, z * 11 + 9.4) + .32 * simplex3(t, x * 27 - 3.1, y * 27 + 5.5, z * 27 - 6.4) + (fmax > 60 ? .18 * simplex3(t, x * 63 + 1.7, y * 63 - 8.3, z * 63 + 2.9) : 0)
    const cc = c * 1.14 - .07
    k = smooth(-.035, .035, cc - (.5 + .5 * n))
  } else k = smooth(edge - .45, edge + .45, alat)
  k *= 1 - S.barren
  WHITE[1] = k
  if (k <= 0) return 0
  const ice = sea ? SEA_ICE : LAND_ICE
  // ice is not one white: pressure ridges, crevasses and drifts, a little blue in the hollows
  const tex = .5 * simplex3(t, x * 23 + 2.7, y * 23 - 8.1, z * 23 + 4.3) + .3 * simplex3(t, x * 71 - 6.6, y * 71 + 1.9, z * 71 - 3.2) + .2 * simplex3(t, x * 190 + 9.4, y * 190 - 5.5, z * 190 + 7.7)
  let lift = 1 + .03 * tex, blue = 0
  if (fmax > 12) {
    // crevasses and pressure ridges: thin lines where a slow noise is near zero, darker and bluer than the white round them
    const crack = Math.exp(-((simplex3(t, x * 9 + 3.4, y * 9 - 6.1, z * 9 + 1.3) / .07) ** 2)) * (.6 + .4 * simplex3(t, x * 4 - 1.1, y * 4 + 2.9, z * 4 - 7.7))
    lift -= .045 * crack; blue = .035 * crack
  }
  col[0] += (Math.min(1, ice[0] * lift * (1 + .02 * tex)) - col[0]) * k; col[1] += (Math.min(1, ice[1] * lift) - col[1]) * k; col[2] += (Math.min(1, ice[2] * lift * (1 - .015 * tex) + blue) - col[2]) * k
  return k
}

const DUST = [.31, .29, .26] as const

/** What a body's look does to a colour: the land loses its colour toward a grey, a little darker, with the brown of dust in it. */
function barrenLand(S: Surface, col: Float64Array): void {
  const b = S.barren
  if (b <= 0) return
  const lum = .299 * col[0]! + .587 * col[1]! + .114 * col[2]!, k = b * .96, dark = 1 - .22 * b
  col[0] += (lum * 1.03 * dark - col[0]) * k; col[1] += (lum * .99 * dark - col[1]) * k; col[2] += (lum * .94 * dark - col[2]) * k
}

const RIVER = [.08, .21, .37] as const, LAKE_SHALLOW = [.1, .25, .42] as const, LAKE_DEEP = [.05, .14, .3] as const

/** The rivers and lakes laid over the land's colour at a point (dried by a barren look). */
function waterOver(S: Surface, x: number, y: number, z: number, hgt: number, detail: number, col: Float64Array): void {
  waterAt(S.net!, x, y, z, hgt, detail)
  const dry = 1 - S.barren
  const river = WATER[0]! * dry, lake = WATER[1]! * dry
  if (lake > 0) {
    const d = WATER[2]!, r = LAKE_SHALLOW[0] + (LAKE_DEEP[0] - LAKE_SHALLOW[0]) * d, g = LAKE_SHALLOW[1] + (LAKE_DEEP[1] - LAKE_SHALLOW[1]) * d, b = LAKE_SHALLOW[2] + (LAKE_DEEP[2] - LAKE_SHALLOW[2]) * d
    col[0] += (r - col[0]) * lake; col[1] += (g - col[1]) * lake; col[2] += (b - col[2]) * lake
  }
  if (river > 0) { col[0] += (RIVER[0] - col[0]) * river; col[1] += (RIVER[1] - col[1]) * river; col[2] += (RIVER[2] - col[2]) * river }
}

/** The land's surface at a point, with its ice: the colour (before the relief shading), the elevation `L` above the sea 0–1 and the continentality `cn`. */
export function landSurface(S: Surface, x: number, y: number, z: number, L: number, cn: number, detail: number, col: Float64Array): void {
  const alat = Math.abs(Math.asin(y < -1 ? -1 : y > 1 ? 1 : y)) * R2D
  landColour(S, x, y, z, L, cn, alat, .9 / detail, col)
  barrenLand(S, col)
  if (S.net) waterOver(S, x, y, z, SEA + L * (1 - SEA), detail, col)
  iceOver(S, x, y, z, alat, false, detail, col)
}

/** The sea's surface at a point at a depth 0 (the coast) to ~1: the water, or where the look has dried it, the dust of its floor; with the ice of the caps. */
export function seaSurface(S: Surface, x: number, y: number, z: number, depth: number, detail: number, col: Float64Array): void {
  WHITE[0] = 0
  const alat = Math.abs(Math.asin(y < -1 ? -1 : y > 1 ? 1 : y)) * R2D
  seaColour(S, x, y, z, depth, .9 / detail, col)
  const b = S.barren
  if (b > 0) {
    // the sea draws back to dust: the floor's own tone, darkest in the basins, in the water's own mottle
    const lum = (.299 * col[0]! + .587 * col[1]! + .114 * col[2]!) / (.299 * SHELF[0] + .587 * SHELF[1] + .114 * SHELF[2]), tone = (.55 + .45 * (1 - depth)) * (.8 + .2 * Math.min(1, lum * 2.2))
    col[0] += (DUST[0] * tone - col[0]) * b; col[1] += (DUST[1] * tone - col[1]) * b; col[2] += (DUST[2] * tone - col[2]) * b
  }
  iceOver(S, x, y, z, alat, true, detail, col)
}

/** The colour of the surface at a point where the field says the height is `h` (and, on land, the continentality `cn`): sets `col` to red, green, blue 0–1 before the relief
 * shading is laid over it. `detail` is the wavelength the picture resolves, in radians. Returns 1 if the point is land, 0 if sea. */
export function surfaceAt(S: Surface, x: number, y: number, z: number, h: number, cn: number, detail: number, col: Float64Array): number {
  if (h > SEA) { landSurface(S, x, y, z, (h - SEA) / (1 - SEA), cn, detail, col); return 1 }
  seaSurface(S, x, y, z, 1 - h / SEA, detail, col)
  return 0
}
