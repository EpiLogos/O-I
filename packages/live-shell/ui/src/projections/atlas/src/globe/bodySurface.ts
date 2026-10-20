// Generator version 2, the surface (T-PROCEDURAL-BODY): what a body's land and sea look like, from the field (bodyField.ts) and the record's climate. Temperature from
// latitude, height and warmth; moisture from the bands of the sky (wet equator, dry subtropics, wet mid-latitudes, dry poles), the distance from the sea and the
// moisture dial; a biome from the two (desert, steppe, savanna, grass, forest, jungle, taiga, tundra); snow above a snow line; ice caps with a ragged margin and sea
// ice and land ice, in step with warmth and none at 0. The colours carry the cues EARTH_FRAG grades (globe/shaders.ts EARTH_COMMON): sea is blue well above red, deepest
// where it is deepest and lightest on the shelf; land's tone is its luma with its relief shading in it; ice and snow are bright and unsaturated.
//
// Everything is a pure function of a point and the record. Pure TypeScript with no DOM and no three.js: it runs in a worker.
import {simplex3, type NoiseTables} from './bodyNoise'
import {SEA, LINES, beltAt, clamp01, seaLines, smooth, type LandParams} from './bodyField'
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
const INNER_ICE = [.94, .957, .97] as const, THICK_ICE = [.9, .94, .98] as const

/** How much snow (0) and ice (1) the surface just computed carries: the relief shading is kept off them so that they stay as bright as they are. */
export const WHITE = new Float64Array(2)
const SHELF = [.07, .22, .37] as const, MID = [.04, .14, .27] as const, DEEP = [.02, .08, .2] as const

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
  if (fmax > 30) M += .09 * simplex3(t, x * 38 + 3.7, y * 38 - 11.2, z * 38 + 6.1)
  if (fmax > 90) M += .07 * simplex3(t, x * 115 - 5.9, y * 115 + 2.3, z * 115 - 9.4)
  if (fmax > 300) M += .08 * simplex3(t, x * 340 + 8.1, y * 340 - 3.6, z * 340 + 1.2)
  if (fmax > 1100) M += .08 * simplex3(t, x * 1200 - 4.4, y * 1200 + 9.7, z * 1200 + 2.5)
  if (fmax > 3200) M += .055 * simplex3(t, x * 3500 + 1.8, y * 3500 - 6.3, z * 3500 + 7.9)
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

/** How much each of the floor's lines lightens (the ridge's swell) or darkens (the fracture zones, the trench) the water, and how wide, as the half-width of the noise band each is drawn
 * from (bodyField.ts LINES [3] and [4]): the ridge a swell some fifty pixels across of a 2048 picture, a fracture zone a line a dozen. */
const RIDGE_TONE = .6, FRACTURE_TONE = .55, TRENCH_TONE = .35, RIDGE_WIDTH = .22, FRACTURE_WIDTH = .35
/** How much darker the water is, at its darkest, far from a coast than a few shelf-widths out (none under the polar ice, where the water between floes is read as water by its blue). */
const FAR_DIM = .22
/** The darkest the water goes (as a share of its tone), however many lines cross and however far from a coast: the shader and the tests read the sea by its blue above its red, which a very dark pixel has not. */
const MOT_MIN = .45
/** The mean of each line's weight over the open sea (measured on the noise): the lines take the water's tone about its own, lightening on a ridge and darkening between, and the sea's mean tone is the mottle's alone. */
const RIDGE_MEAN = .31, FRACTURE_MEAN = .31

/** The sea's colour at a depth 0 (the coast) to ~1 (the plain): a thin turquoise rim at the shore, which darkens within a few pixels to the blue of the open sea, which is nearly one tone
 * (teal navy) and changes slowly; the floor's own mottle on it, fine and weak at the broad scales. */
export function seaColour(S: Surface, x: number, y: number, z: number, depth: number, fmax: number, col: Float64Array): void {
  const t = S.t
  const k1 = smooth(0, .42, depth), k2 = smooth(.3, .95, depth)
  let r = SHELF[0] + (MID[0] - SHELF[0]) * k1, g = SHELF[1] + (MID[1] - SHELF[1]) * k1, b = SHELF[2] + (MID[2] - SHELF[2]) * k1
  r += (DEEP[0] - r) * k2; g += (DEEP[1] - g) * k2; b += (DEEP[2] - b) * k2
  // the floor's texture, at the scales between a fracture zone and a pixel: no swirl (a broad, smooth, strong relief reads as one), a grain that is finer as the picture is, and
  // busy in some places and calm in others, as a sea floor is
  const act = .5 + 1.0 * smooth(-.35, .45, simplex3(t, x * 2.1 + 12.4, y * 2.1 - 4.2, z * 2.1 + 8.8))
  let tex = .018 * simplex3(t, x * 3.7 - 1.9, y * 3.7 + 6.3, z * 3.7 + 2.4) + .04 * simplex3(t, x * 9 + 5.5, y * 9 + 1.1, z * 9 - 2.2) + .12 * simplex3(t, x * 22 - 3.3, y * 22 + 7.7, z * 22 + 4.1)
  if (fmax > 52) tex += .052 * simplex3(t, x * 52 + 1.2, y * 52 - 6.4, z * 52 + 9.9)
  if (fmax > 100) tex += .032 * simplex3(t, x * 100 - 8.8, y * 100 + 2.6, z * 100 - 5.7)
  // however strong, never so dark that the water is no longer read as water (the shader and the tests read the sea by its blue above its red, which a very dark pixel has not)
  let mot = 1 + .6 * Math.tanh(1.3 * act * tex / .6)
  for (let f = 130, amp = .05; f <= fmax && amp > .004; f *= 2.1, amp *= .66) mot += amp * simplex3(t, x * f - 4.7, y * f + 9.3, z * f + 2.2)
  // the floor's few long lines, in the place of the broad part of the mottle (bodyField.ts seaLines, the lines the relief has): the ridge a lighter swell, the fracture zones faint thin dark
  // lines out from it, the trench a dark line along a steep margin; only on the open floor, and not under the polar ice. `s` is the shelf's own measure of the distance (the water's depth
  // was made from it: depth = 1 - exp(-s)), which the picture keeps to about eleven widths. The deep darkens slowly with it, over the first tens of pixels beyond the shelf.
  if (depth > .9) {
    const s = -Math.log(1 - Math.min(depth, 1 - 1e-12)), plain = smooth(5, 14, s)
    seaLines(t, x, y, z, s, beltAt(t, x, y, z))
    const a = LINES[3]!, c = LINES[4]!, ridge = Math.exp(-((a / RIDGE_WIDTH) ** 2)), fracture = Math.exp(-((a / .55) ** 2)) * Math.exp(-((c / FRACTURE_WIDTH) ** 2))
    mot *= (1 + LINES[5]! * (plain * (RIDGE_TONE * (ridge - RIDGE_MEAN) - FRACTURE_TONE * (fracture - FRACTURE_MEAN)) - TRENCH_TONE * LINES[2]!)) * (1 - FAR_DIM * LINES[5]! * smooth(3, 11, s))
    if (mot < MOT_MIN) mot = MOT_MIN
  }
  col[0] = r * mot; col[1] = g * mot; col[2] = b * mot
}

/** The ice of the caps over a colour already written to `col`: the margin is lobed (a cap is not a ring: its edge runs tens of degrees of latitude in longitude), ragged, and the
 * sea ice breaks into floes toward it; sea ice and land ice differ at the margin and are one white inside; none where the dial is 0. Returns how much ice stands there 0–1.
 * `detail` is the wavelength the picture resolves (radians): the finest cracks are drawn only where a picture shows them. */
export function iceOver(S: Surface, x: number, y: number, z: number, alat: number, sea: boolean, detail: number, col: Float64Array, shore = 1): number {
  WHITE[1] = 0
  if (S.capOn <= 0 || alat < S.capFloor || S.barren >= 1) return 0
  const t = S.t, fmax = .9 / detail
  const edge = 95 - S.capOn * (95 - S.capBase) + 11 * simplex3(t, x * 1.5 - 12.4, y * 1.5 + 6.6, z * 1.5 + 3.7) + 5 * simplex3(t, x * 3.9 + 4.4, y * 3.9 - 9.1, z * 3.9 + 12.3)
    + 1.7 * simplex3(t, x * 14 - 3.8, y * 14 + 7.4, z * 14 + 2.6) + (fmax > 40 ? .7 * simplex3(t, x * 41 + 5.2, y * 41 - 2.2, z * 41 + 8.8) : 0)
  // an edge is as soft as a pixel is wide: at a close view the ice has crisp margins (a floe, a sheet's edge), not a haze over a hundred pixels (the ramp widths below are those of a 2048 base)
  const px = detail / .003
  let k: number
  if (sea) {
    // the marginal ice zone: ice thins over ten degrees of latitude into floes, and the floes into open water
    const c = smooth(edge - 8, edge + 3, alat)
    let n = .5 * simplex3(t, x * 11 + 7.2, y * 11 - 1.8, z * 11 + 9.4) + .32 * simplex3(t, x * 27 - 3.1, y * 27 + 5.5, z * 27 - 6.4) + (fmax > 60 ? .18 * simplex3(t, x * 63 + 1.7, y * 63 - 8.3, z * 63 + 2.9) : 0)
    // finer floes where the picture shows them
    if (fmax > 200) n += .12 * simplex3(t, x * 190 - 5.5, y * 190 + 3.1, z * 190 + 8.2)
    if (fmax > 700) n += .08 * simplex3(t, x * 640 + 2.4, y * 640 - 9.6, z * 640 + 5.3)
    const cc = c * 1.14 - .07, w = px < 1 ? (px < .05 ? .002 : .035 * px) : .035
    k = smooth(-w, w, cc - (.5 + .5 * n))
  } else {
    const half = px < 1 ? (px < .03 ? .01 : .45 * px) : .45
    k = smooth(edge - half, edge + half, alat)
  }
  k *= 1 - S.barren
  WHITE[1] = k
  if (k <= 0) return 0
  // one white inside, two at the margin: the sea ice is bluer and a little darker where it breaks into floes, a sheet's edge a little warmer, and inside both are the same white that
  // goes slightly bluer where the ice is thick (so the land under a cap does not show through as a shape of another tone)
  const into = alat - edge, edgeTone = sea ? SEA_ICE : LAND_ICE, inner = smooth(0, 7, into), thick = smooth(1.5, 7, into)
  let r = edgeTone[0] + ((INNER_ICE[0] + (THICK_ICE[0] - INNER_ICE[0]) * thick) - edgeTone[0]) * inner
  let g = edgeTone[1] + ((INNER_ICE[1] + (THICK_ICE[1] - INNER_ICE[1]) * thick) - edgeTone[1]) * inner
  let b = edgeTone[2] + ((INNER_ICE[2] + (THICK_ICE[2] - INNER_ICE[2]) * thick) - edgeTone[2]) * inner
  // ice is not one white: drifts and sastrugi, crevasses at a sheet's margin, pressure ridges where sea ice meets land
  const tex = .5 * simplex3(t, x * 23 + 2.7, y * 23 - 8.1, z * 23 + 4.3) + .3 * simplex3(t, x * 71 - 6.6, y * 71 + 1.9, z * 71 - 3.2) + .2 * simplex3(t, x * 190 + 9.4, y * 190 - 5.5, z * 190 + 7.7)
  let lift = 1 + .03 * tex, blue = 0
  // (sastrugi are wind-cut ridges, long along the wind; the sphere's own y scaled up to make them long along the parallels is a stripe round every pole: the texture is isotropic)
  if (fmax > 26) { const sas = simplex3(t, x * 26 + 8.2, y * 26 - 1.1, z * 26 + 3.8) + .6 * simplex3(t, x * 61 - 2.2, y * 61 + 5.5, z * 61 - 9.1); lift += .03 * sas }
  if (fmax > 12) {
    // crevasses and ridges: thin lines where a slow noise is near zero, darker and bluer than the white round them
    const crack = Math.exp(-((simplex3(t, x * 9 + 3.4, y * 9 - 6.1, z * 9 + 1.3) / .07) ** 2)) * (.6 + .4 * simplex3(t, x * 4 - 1.1, y * 4 + 2.9, z * 4 - 7.7))
    const margin = 1 - smooth(0, 9, into)
    lift -= (.045 + .06 * margin) * crack; blue = (.035 + .04 * margin) * crack
    if (sea && fmax > 30) {
      // sea ice against a coast is crushed into ridges (the water's own measure of the distance from the shore, T[1], is 0 at the coast)
      const against = Math.pow(Math.max(0, 1 - shore), .4), ridge = Math.exp(-((simplex3(t, x * 34 + 5.1, y * 34 - 3.3, z * 34 + 7.7) / .1) ** 2)) + .6 * Math.exp(-((simplex3(t, x * 83 - 6.4, y * 83 + 2.8, z * 83 - 1.7) / .1) ** 2))
      lift -= .13 * against * ridge; blue += .04 * against * ridge
    }
  }
  col[0] += (Math.min(1, r * lift * (1 + .02 * tex)) - col[0]) * k; col[1] += (Math.min(1, g * lift) - col[1]) * k; col[2] += (Math.min(1, b * lift * (1 - .015 * tex) + blue) - col[2]) * k
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

/** The slope (per radian) from which a face is too steep to hold its cover, and the slope by which it is all rock: a picture of 2048 wide sees slopes under about 8, a tile of zoom 8 the
 * faces of a mountain belt at 15 and more, so only a close picture shows bare rock. */
const ROCK_FROM = 6, ROCK_ALL = 16

/** Bare rock showing through the cover on steep ground: the colour is taken toward the rock of the high ground (with a grain of its own, a little warmer or cooler from place to place),
 * and what snow lay there is shed (the snow the shading keeps bright is lessened by the same share). */
function rockOver(S: Surface, x: number, y: number, z: number, steep: number, col: Float64Array): void {
  const k = .85 * smooth(ROCK_FROM, ROCK_ALL, steep)
  if (k <= 0) return
  const t = S.t, g = 1 + .16 * simplex3(t, x * 140 + 6.1, y * 140 - 2.7, z * 140 + 9.3) + .1 * simplex3(t, x * 530 - 1.4, y * 530 + 8.8, z * 530 - 5.2), warm = .05 * simplex3(t, x * 17 + 3.3, y * 17 + 1.7, z * 17 - 6.6)
  col[0] += (ROCK[0] * g * (1 + warm) - col[0]) * k; col[1] += (ROCK[1] * g - col[1]) * k; col[2] += (ROCK[2] * g * (1 - warm) - col[2]) * k
  WHITE[0] *= 1 - k
}

/** The land's surface at a point, with its ice: the colour (before the relief shading), the elevation `L` above the sea 0–1 and the continentality `cn`. */
export function landSurface(S: Surface, x: number, y: number, z: number, L: number, cn: number, detail: number, col: Float64Array, steep = 0): void {
  const alat = Math.abs(Math.asin(y < -1 ? -1 : y > 1 ? 1 : y)) * R2D
  landColour(S, x, y, z, L, cn, alat, .9 / detail, col)
  if (steep > ROCK_FROM) rockOver(S, x, y, z, steep, col)
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
  iceOver(S, x, y, z, alat, true, detail, col, depth)
}

/** The colour of the surface at a point where the field says the height is `h` (and, on land, the continentality `cn`): sets `col` to red, green, blue 0–1 before the relief
 * shading is laid over it (`cn`: on land the continentality, at sea the water's colour depth). `detail` is the wavelength the picture resolves, in radians. Returns 1 if the point is land, 0 if sea. */
export function surfaceAt(S: Surface, x: number, y: number, z: number, h: number, cn: number, detail: number, col: Float64Array, steep = 0): number {
  if (h > SEA) { landSurface(S, x, y, z, (h - SEA) / (1 - SEA), cn, detail, col, steep); return 1 }
  seaSurface(S, x, y, z, cn, detail, col)
  return 0
}
