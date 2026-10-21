// Generator version 2, the field (T-PROCEDURAL-BODY): the land of a body as one pure function of a point of the unit sphere, evaluated to any level of detail, so the
// base image, a tile and the Place tool's land test are one function. From the record's landmass dials and its seed alone; the climate and the sky never move a coast.
//
// How the land is made, from the largest thing to the smallest:
//   a plate-like mask `C` (warped, low-frequency simplex noise, with a dipole that is a supercontinent at the lowest `continents` and fades as they rise) says where
//   the continents are; coast detail `D` is fractal at every scale (smooth, fjord or archipelago set its character, its roughness and its amplitude), and together
//   they are `Ec`, the surface a coast is cut from. The sea stands where `Ec` falls under `Esea`, a quantile of `Ec` over the whole sphere taken from the sea-level dial
//   (so the dial is the share of land and the arrangement of it is the seed's: land share is steady in the dial and the same for every seed).
//   On land the height is plains that rise from the coast, hills, and ridged mountains in belts, strongest in a continent's interior and as high as `relief` says.
//   At sea the height is the sea floor: shelf, slope and abyssal plain, with ridges and trenches.
// Heights are 0–1 with the sea at SEA; `heightAt` above it is land (`isLand`), below it is sea.
//
// Pure TypeScript with no DOM and no three.js: it runs in a worker. Nothing here is random, and nothing reads a clock.
import {simplex3, tablesOf, type NoiseTables} from './bodyNoise'
import type {WorldBodyRecord} from './body'

/** The height the sea stands at, in the field's 0–1. Land is above it by at most LAND_RANGE; the sea floor is below it. */
export const SEA = .5
export const LAND_RANGE = 1 - SEA
/** The finest detail `heightAt` is asked for when no one says (radians; about 14 km on a body the size of the Earth): the Place tool's land test. */
export const DEFAULT_DETAIL = .0004

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
export const smooth = (e0: number, e1: number, x: number): number => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t) }

/** The land share the sea-level dial asks for, 0 (a world of land: .96) to 1 (a world of sea: .02), through the Earth-like .31 at the default .5. A monotone cubic
 * through three anchors: steady in the dial (no stretch that does nothing, no step that jumps). */
export function landFractionOf(seaLevel: number): number {
  const s = clamp01(seaLevel)
  // Hermite on [0, .5] and [.5, 1] with slopes −1.66, −.802, −.22 (the monotone, shape-preserving choice for the anchors .96, .31, .02)
  const [a, b, ma, mb, t0] = s <= .5 ? [.96, .31, -1.66, -.802, s / .5] : [.31, .02, -.802, -.22, (s - .5) / .5]
  const t2 = t0 * t0, t3 = t2 * t0
  return (2 * t3 - 3 * t2 + 1) * a! + (t3 - 2 * t2 + t0) * .5 * ma! + (-2 * t3 + 3 * t2) * b! + (t3 - t2) * .5 * mb!
}

/** Everything about a record's land that is computed once and kept: the noise tables, the dials turned into the field's constants, and the sea level's quantile. */
export interface LandParams {
  readonly seed: number
  readonly t: NoiseTables
  readonly relief: number
  readonly coast: 'smooth' | 'fjord' | 'archipelago'
  /** frequency of the continent mask, the weight of the supercontinent's dipole and its axis */
  readonly cf: number
  readonly dip: number
  readonly ax: number
  readonly ay: number
  readonly az: number
  /** the coast detail's first frequency, its first amplitude and its gain per octave (its roughness) */
  readonly df: number
  readonly da: number
  readonly dg: number
  readonly landFraction: number
  /** the value of `Ec` at the coast, the span of it above (to a continent's heart) and below (to the abyss) */
  Esea: number
  span: number
  seaSpan: number
  /** set once the sea level is known: the coast detail finer than its second octave is then skipped where it cannot change which side of the coast a point is on */
  exitOK: boolean
  /** the slope of the mask's smooth outline (per radian) on a grid of the sphere, made once when a sea floor is first asked for: how steep a coast is, so how wide its shelf */
  slope: Float32Array | null
  /** the regional slope of every coast cell of the grid, sorted gentlest first (made with the grid): where a coast stands among them is how gentle it is */
  coastSlopes: Float32Array | null
}

const byRecord = new WeakMap<object, LandParams>()
const byKey = new Map<string, LandParams>()

/** The field's constants for a record (its landmass dials and its seed: nothing of the climate or the sky). Kept by the record and by its dials, a few at a time. */
export function landParamsOf(record: WorldBodyRecord): LandParams {
  const known = byRecord.get(record)
  if (known) return known
  const {seed, landmass: {sea_level, continents, relief, coast}} = record
  const key = `${seed}|${sea_level}|${continents}|${relief}|${coast}`
  let P = byKey.get(key)
  if (!P) {
    P = buildParams(seed, sea_level, continents, relief, coast)
    if (byKey.size >= 12) byKey.delete(byKey.keys().next().value as string)
    byKey.set(key, P)
  }
  byRecord.set(record, P)
  return P
}

// the character of each coast: first frequency, first amplitude, gain per octave (the Hurst exponent H of the coast: gain = 2^−H, so the coast's dimension is 2 − H)
const COAST = {smooth: {f: 5, a: .045, g: .54}, fjord: {f: 6, a: .14, g: .6}, archipelago: {f: 10, a: .17, g: .58}} as const

function buildParams(seed: number, seaLevel: number, continents: number, relief: number, coast: 'smooth' | 'fjord' | 'archipelago'): LandParams {
  const t = tablesOf(seed)
  // the supercontinent's axis, from the seed
  const ux = simplex3(t, 3.17, .31, .77), uy = simplex3(t, .59, 3.41, 1.13), uz = simplex3(t, 1.91, .83, 3.29), un = Math.hypot(ux, uy, uz) || 1
  const style = COAST[coast]
  const P: LandParams = {
    seed, t, relief, coast,
    cf: .5 + .62 * continents,
    dip: 1.25 * (1 - smooth(.6, 1.9, continents)),
    ax: ux / un, ay: uy / un, az: uz / un,
    df: style.f, da: style.a, dg: style.g,
    landFraction: landFractionOf(seaLevel),
    Esea: 0, span: 1, seaSpan: 1, exitOK: false, slope: null, coastSlopes: null,
  }
  // the quantiles of Ec over the sphere (an even spread of points: a golden-angle spiral), once
  const N = 6144, samples = new Float64Array(N)
  for (let k = 0; k < N; k++) {
    const y = 1 - 2 * (k + .5) / N, r = Math.sqrt(1 - y * y), a = k * 2.399963229728653
    samples[k] = maskE(P, r * Math.cos(a), y, r * Math.sin(a), .0015)
  }
  samples.sort()
  P.Esea = samples[Math.min(N - 1, Math.max(0, Math.floor((1 - P.landFraction) * N)))]!
  const top = samples[Math.min(N - 1, Math.floor(.985 * N))]!, bottom = samples[Math.floor(.01 * N)]!
  P.span = Math.max(1e-3, top - P.Esea)
  P.seaSpan = Math.max(1e-3, P.Esea - bottom)
  P.exitOK = true
  return P
}

// ── the coast surface ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The warped point the land is made at (set by `maskE`), and the mask with only its two coarsest coast octaves (the smooth outline a shelf follows). */
const Q = new Float64Array(3)
let SMOOTH = 0

/** How much of the fine coast detail (from the third octave on) a point still gets, 0–1: all of it near the coast, none far from it, and a smooth fade between, so no line is cut
 * across the land where the detail stops. `dist` is the point's distance from the sea level in `Ec`, `bound` the most the fine octaves can add: beyond 1.5 times it they cannot
 * change which side of the coast the point is on, and are not made. */
function fineFade(dist: number, bound: number): number {
  return 1 - smooth(.5 * bound, 1.5 * bound, dist)
}

/** `Ec`: the continent mask and the coast detail on the warped sphere. The sea stands where this is under `Esea`. `detail` is the finest wavelength asked for, in
 * radians: octaves finer than it are not made. */
export function maskE(P: LandParams, x: number, y: number, z: number, detail: number): number {
  const t = P.t
  // the continents' first octave is warped (continents that are not round); the finer octaves and the coast are not, so nothing is sheared into streaks
  const wx = x + .13 * simplex3(t, x * 1.05 + 11.3, y * 1.05 - 4.7, z * 1.05 + 2.9)
  const wy = y + .13 * simplex3(t, x * 1.05 - 6.1, y * 1.05 + 8.3, z * 1.05 - 13.7)
  const wz = z + .13 * simplex3(t, x * 1.05 + 2.2, y * 1.05 - 9.9, z * 1.05 + 5.5)
  Q[0] = x; Q[1] = y; Q[2] = z
  const f = P.cf
  let C = .68 * simplex3(t, wx * f + 1.7, wy * f + 9.2, wz * f - 3.1) + .22 * simplex3(t, x * f * 2.13 - 7, y * f * 2.13 + 2, z * f * 2.13 + 5) +
    .08 * simplex3(t, x * f * 4.4 + 3, y * f * 4.4 - 5, z * f * 4.4 + 8)
  C += P.dip * (wx * P.ax + wy * P.ay + wz * P.az)
  // the coast detail, an octave at a time, as fine as the detail asks
  const fmax = .9 / detail
  let fr = P.df, amp = P.da, D = 0, Dsm = 0
  // what the octaves from the third on can add at most (the noise stays inside ±1, a fjord's ridged term inside ±1.8): far from the coast they cannot change the answer
  const reach = P.coast === 'fjord' ? 1.8 : 1
  if (P.coast === 'fjord') {
    // thin dips cut into the coast by ridged noise (a fjord is long and narrow), with the smooth fractal under them
    for (let o = 0; fr <= fmax && o < 15; o++, fr *= 2.03, amp *= P.dg) {
      if (o === 2 && P.exitOK) { const k = fineFade(Math.abs(C + Dsm - P.Esea), reach * amp / (1 - P.dg)); if (k <= 0) break; amp *= k }
      const n = simplex3(t, x * fr + 21 + o * 5.3, y * fr - 17, z * fr + 9 - o * 3.1)
      const r = 1 - Math.abs(n)
      const term = amp * (.55 * n - 1.25 * r * r * r * r)
      D += term
      if (o < 2) Dsm += term
    }
  } else {
    for (let o = 0; fr <= fmax && o < 15; o++, fr *= 2.03, amp *= P.dg) {
      if (o === 2 && P.exitOK) { const k = fineFade(Math.abs(C + Dsm - P.Esea), reach * amp / (1 - P.dg)); if (k <= 0) break; amp *= k }
      const term = amp * simplex3(t, x * fr + 21 + o * 5.3, y * fr - 17, z * fr + 9 - o * 3.1)
      D += term
      if (o < 2) Dsm += term
    }
  }
  SMOOTH = C + Dsm
  return C + D
}

// ── the terrain: land and sea floor ───────────────────────────────────────────────────────────────────────────────────────

/** Rivers and lakes are drawn, and valleys cut for them, where a pixel is no wider than this (radians): a base of 1024 or more. */
export const WATER_DETAIL = .0075

/** The valley a river cuts, as a weight 0–1 at a point (set by bodyRivers.ts when it is loaded): the field is lower where the water goes, at every resolution that draws it. */
type ValleyHook = (P: LandParams, x: number, y: number, z: number, detail: number) => number
let valleyHook: ValleyHook | null = null
export function setValleyHook(hook: ValleyHook | null): void { valleyHook = hook }

/** What `terrain` finds at a point: [0] height 0–1, [1] on land continentality 0 (the coast) to 1 (a continent's heart), at sea the water's colour depth 0 (the coast) to 1 (the open sea),
 * [2] the land's elevation 0–1 above the sea (0 at sea), [3] the sea floor's depth 0 (at the coast) to ~1 (the abyss; 0 on land). */
export const T = new Float64Array(8)

/** The terrain at a point of the unit sphere to the detail asked for (a wavelength in radians): fills `T`, and returns the height. */
export function terrain(P: LandParams, x: number, y: number, z: number, detail: number): number {
  const t = P.t, d = maskE(P, x, y, z, detail)
  const qx = Q[0]!, qy = Q[1]!, qz = Q[2]!
  const above = d - P.Esea
  if (above > 0) {
    const cn = Math.min(1, above / P.span), relief = P.relief, fmax = .9 / detail
    // the plains, rising from the coast to a low plateau
    let L = .062 * (1 - Math.exp(-cn * 7))
    // hills, everywhere inland (a little more with relief)
    let hills = 0, hf = 8.5, ha = .5
    for (let o = 0; o < 3 && hf <= fmax; o++, hf *= 2.1, ha *= .5) hills += ha * simplex3(t, qx * hf - 31, qy * hf + 12, qz * hf + 7)
    L += (.022 + .035 * relief) * (.5 + hills) * smooth(.01, .18, cn)
    if (relief > 0 && cn > .1) {
      // ranges: ridged noise, in belts (the lines where a slow noise is near zero), strongest in a continent's interior
      const belt = beltAt(t, qx, qy, qz)
      let m = 0, amp = 1, wgt = 1, norm = 0, mf = 4.2
      for (let o = 0; o < 12 && mf <= fmax; o++, mf *= 2.05, amp *= .52) {
        let n = 1 - Math.abs(simplex3(t, qx * mf + 51 + o * 7.7, qy * mf - 23, qz * mf + 14 - o * 2.9))
        n *= n
        m += amp * n * wgt; norm += amp
        wgt = Math.min(1, n * 2.2)
      }
      L += relief ** 1.15 * (m / norm) * belt * smooth(.1, .55, cn) * 1.2
    }
    // micro-relief: the ground's roughness, octave on octave as fine as the detail asks (it is what a close tile shows of a plain)
    let micro = 0, mf = 52, ma = .0055 * (.55 + .9 * relief)
    for (let o = 0; o < 9 && mf <= fmax; o++, mf *= 2.1, ma *= .56) micro += ma * simplex3(t, qx * mf + 17 + o * 3.7, qy * mf - 29, qz * mf + 5 - o * 6.1)
    L += micro * smooth(.005, .06, cn)
    // valleys: where a river runs the land is cut down toward its bed, a few hundredths of the plain's height at most, nothing at the coast (the sea floor is the sea's)
    if (valleyHook !== null && detail <= WATER_DETAIL && cn > .015) {
      const w = valleyHook(P, x, y, z, detail)
      if (w > 0) L -= Math.min(.6 * L, .03) * w * smooth(.015, .12, cn)
    }
    if (L > 1) L = 1
    else if (L < 1e-9) L = 1e-9
    T[1] = cn; T[2] = L; T[3] = 0
    return (T[0] = SEA + LAND_RANGE * L)
  }
  // the sea floor: a shelf, a slope and the abyssal plain, by the distance from the coast (below); quiet basins and ridges on the plain
  const dnCoast = -above / P.seaSpan, u = Math.exp(-((dnCoast / .1) ** 2)), dnSmooth = Math.max(0, (P.Esea - SMOOTH) / P.seaSpan)
  const dn = u * dnCoast + (1 - u) * dnSmooth
  // how far: a distance in radians, not a level of the mask. The mask is a coast's own measure but its slope differs from coast to coast (a gentle slope of it is a shelf of fifty pixels
  // and a steep one of three), so the distance is the mask's deficit over the slope of its smooth outline: the shelf is as wide as the coast is gentle, in the same units everywhere
  let dist = 4, gentle = 1
  if (dn < DEEP_DN) {
    // under the polar ice the shelf is the common one (the ice's pressure ridges against a coast follow the shelf's width, and the ice is the same ice whatever the sea floor under it)
    const g = smoothSlope(P, x, y, z), ice = smooth(.82, .94, qy < 0 ? -qy : qy), floor = P.seaSpan / (MAX_SHELF + (OLD_SHELF - MAX_SHELF) * ice), gg = g > floor ? g : floor
    dist = dn * P.seaSpan / gg
    // the distance above is a geometric one, the same off a gentle coast as off a steep one; and a gentle coast has a wide shelf (Sunda, Patagonia, the Yellow Sea): by where its slope
    // stands among the coasts', the gentlest few have a shelf of ten times the common width and more, and the steeper half the common
    gentle = 1 + (gentleOf(P, smoothSlope(P, x, y, z, 1)) - 1) * (1 - ice)
    // the distance runs on to the deep's own (4) over the last fifth of the span, not in a step at its end: the colour and the lines read the shelf's measure of it, and a step is a straight edge
    const into = smooth(.8 * DEEP_DN, DEEP_DN, dn)
    if (into > 0) dist += (4 - dist) * into
  }
  // a shelf is also as wide as the land behind it is low: narrow where a mountain belt meets the sea, wide off a plain, changing slowly along the coast (never in blobs)
  const belt = beltAt(t, qx, qy, qz)
  const wide = 1.55 - 1.15 * belt + .4 * simplex3(t, qx * 2.6 + 19, qy * 2.6 + 5, qz * 2.6 - 3)
  const s = dist / (SHELF_WIDTH * gentle * (wide < .45 ? .45 : wide > 2.4 ? 2.4 : wide))
  // the floor: a shelf, the slope below it, and the plain, falling slowly the rest of the way (the height). The colour is not the height's: the water darkens from a thin turquoise
  // rim to the open sea's one tone within a few widths of the shelf, whatever the shelf is, so it takes its own measure of the distance (T[1], 0 at the coast to 1 in the open sea)
  const shore = 1 - Math.exp(-s)
  // the floor drops away from the coast at once, by the distance and not by the shelf's width (a wide shelf is as deep a step at the shore as a narrow one, a pixel off it: the pixels at a
  // coast are blended with the land by how far under the sea level they are, and a shallow rim over a wide shelf would mix the land's colour into the sea)
  let depth = RIM_STEP * (1 - Math.exp(-dist / RIM_RUN)) + .08 * smooth(0, 2.5, s) + .72 * smooth(2, 9, s) + .15 * smooth(8, 45, s)
  const plain = smooth(5, 14, s)
  if (plain > 0) {
    const fmax = .9 / detail
    // the plain's own shapes, quiet: broad basins and swells, and the long low lines of the mid-ocean ridges (shallow relief; the colour barely sees them)
    depth += plain * .045 * simplex3(t, qx * 1.35 + 8.2, qy * 1.35 - 5.1, qz * 1.35 + 2.7)
    seaLines(t, qx, qy, qz)
    depth -= plain * .05 * LINES[0]!
    let rf = 3.1, ra = .03
    for (let o = 0; o < 3 && rf <= fmax; o++, rf *= 2.3, ra *= .6) depth += plain * ra * simplex3(t, qx * rf - 3 + o * 4.1, qy * rf + 41, qz * rf + 19)
  }
  if (depth < 0) depth = 0
  else if (depth > .99) depth = .99
  T[1] = shore; T[2] = 0; T[3] = depth
  return (T[0] = SEA * (1 - depth))
}

/** The mountain belts: 1 on the slow noise's zero lines, where a range stands inland and a shelf is narrow, .22 between (the same belts the ranges and the shelf's width follow). */
export function beltAt(t: NoiseTables, x: number, y: number, z: number): number {
  return .22 + .78 * Math.exp(-((simplex3(t, x * 1.7 + 4.4, y * 1.7 - 8.1, z * 1.7 + 6.2) / .19) ** 2))
}

/** The lines of the open sea floor at a point of the sphere, as weights 0-1 (set in `LINES`) for the floor's relief and the water's colour alike: [0] the mid-ocean ridge's axis, a long
 * line where a slow noise is nearly zero; [1] the fracture zones, thin straight lines, long round the world, in the ridge's reach (a noise that changes fast from the equator to the pole and
 * slowly round the globe, so that its zero lines are long, parallel and not loops). Few and long, in the place of a mottle. [2] and [3] are the two noises the ridge and the fracture zones
 * are the zero lines of, for a colour that draws them wider than the relief does, and [4] the latitude fade of the colour's lines (none under the polar ice, where a line along the parallels
 * would be a ring round the cap). A trench at a constant distance from the shelf was tried and is not here: it closed round every island's shelf and read as an outline drawn on the sea. */
export const LINES = new Float64Array(5)
export function seaLines(t: NoiseTables, x: number, y: number, z: number): void {
  const a = simplex3(t, x * 1.1 - 2.4, y * 1.1 + 7.7, z * 1.1 - 5.5), c = simplex3(t, x * 1.3 + 5.1, y * 7.5 - 2.9, z * 1.3 + 8.3)
  LINES[0] = Math.exp(-((a / .09) ** 2))
  LINES[1] = Math.exp(-((a / .55) ** 2)) * Math.exp(-((c / .12) ** 2))
  LINES[2] = a; LINES[3] = c; LINES[4] = 1 - smooth(.82, .94, Math.abs(y))
}
/** How much wider than the common the gentlest coast's shelf is (the shelf of a steep coast is a few pixels of a 2048 picture, the gentlest's is tens), and the share of coasts (the gentler end) that have a wider shelf at all. */
const GENTLE_MAX = 6, GENTLE_SHARE = .5
/** The factor a coast's shelf is wider by, from its regional slope: 1 for the steeper half of the coasts, and from there up to `GENTLE_MAX` for the gentlest, by the coast's rank among them. */
function gentleOf(P: LandParams, regional: number): number {
  const c = P.coastSlopes
  if (c === null || c.length < 20) return 1
  let lo = 0, hi = c.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (c[mid]! < regional) lo = mid + 1; else hi = mid }
  const k = smooth(GENTLE_SHARE, 0, lo / c.length)
  return 1 + (GENTLE_MAX - 1) * k
}

/** The distance (radians) at which the shelf's own scale is set: a shelf of one width is about six pixels of a 2048 base, as the Earth's average is. */
const SHELF_WIDTH = .018
/** The least slope of the mask's smooth outline taken, as the sea's span over it (radians): no distance asked of a flat outline is more than this (a third of a radian under the polar ice,
 * where the shelf is the common one). */
const MAX_SHELF = 1.2, OLD_SHELF = .35
/** The step down at the shore (of the height's 0-1 of the sea floor) and the distance (radians, a pixel of a 2048 base) it is made over. */
const RIM_STEP = .0012, RIM_RUN = .002
/** The mask's deficit (over the sea's span) beyond which a point is in the deep and no distance is asked. */
const DEEP_DN = 1.2
/** The grid the slope is kept on: columns of longitude and rows of latitude, a degree and two thirds a cell. */
const SLOPE_NX = 216, SLOPE_NY = 108

/** The slope of the mask's smooth outline over the sphere, made once for a body, in two layers of the grid (the second starts at `SLOPE_NX * SLOPE_NY`): the first is `SMOOTH` (the coarse
 * mask alone) at the centre of every cell and the size of its change per radian from the cells round it, which the outline keeps whole (it has no feature smaller than a few cells);
 * the second is that slope as it is along the coast over a few cells round (a coast's gentleness is a regional thing: a margin, not a point of it), averaged over the cells the coast
 * runs through only, and what the shelf's width follows. Sets `P.coastSlopes`. */
function slopeGrid(P: LandParams): Float32Array {
  const n = SLOPE_NX * SLOPE_NY, v = new Float32Array(n), grid = new Float32Array(2 * n)
  const dlon = 2 * Math.PI / SLOPE_NX, dlat = Math.PI / SLOPE_NY
  for (let j = 0; j < SLOPE_NY; j++) {
    const lat = Math.PI / 2 - (j + .5) * dlat, c = Math.cos(lat), sy = Math.sin(lat)
    for (let i = 0; i < SLOPE_NX; i++) {
      const lon = -Math.PI + (i + .5) * dlon
      maskE(P, c * Math.cos(lon), sy, c * Math.sin(lon), .05)
      v[j * SLOPE_NX + i] = SMOOTH
    }
  }
  for (let j = 0; j < SLOPE_NY; j++) {
    const lat = Math.PI / 2 - (j + .5) * dlat, cl = Math.max(.08, Math.cos(lat))
    const jn = j > 0 ? j - 1 : j, js = j < SLOPE_NY - 1 ? j + 1 : j
    for (let i = 0; i < SLOPE_NX; i++) {
      const e = v[j * SLOPE_NX + (i + 1) % SLOPE_NX]!, w = v[j * SLOPE_NX + (i + SLOPE_NX - 1) % SLOPE_NX]!
      const a = (e - w) / (2 * dlon * cl), b = (v[jn * SLOPE_NX + i]! - v[js * SLOPE_NX + i]!) / ((js - jn) * dlat)
      grid[j * SLOPE_NX + i] = Math.sqrt(a * a + b * b)
    }
  }
  // the coast's band: the cells the shelf is made in, with a weight that falls from 1 to 0 across the band's edge (the mask within a fifth of the sea's span of the sea level), so that
  // what is averaged below changes smoothly from a cell to the next; and the slope of a coast with no neighbour (the typical coast's, the median) as the average's prior
  const wring = new Float32Array(n), local: number[] = []
  for (let at = 0; at < n; at++) { const dev = (v[at]! - P.Esea) / P.seaSpan; wring[at] = 1 - smooth(.6 * COAST_BAND, COAST_BAND, dev > 0 ? 3 * dev : -dev); if (wring[at]! > .5) local.push(Math.log(grid[at]! + 1e-3)) }
  local.sort((a, b) => a - b)
  const prior = local.length ? local[local.length >> 1]! : 0, coast: number[] = []
  for (let j = 0; j < SLOPE_NY; j++) {
    const cl = Math.max(.15, Math.cos(Math.PI / 2 - (j + .5) * dlat)), reachI = Math.min(SLOPE_NX / 2 - 1, Math.ceil(2 * REGION_CELLS / cl)), reachJ = Math.ceil(2 * REGION_CELLS)
    for (let i = 0; i < SLOPE_NX; i++) {
      let sum = 0, weight = 0
      for (let dj = -reachJ; dj <= reachJ; dj++) {
        const jj = j + dj
        if (jj < 0 || jj >= SLOPE_NY) continue
        for (let di = -reachI; di <= reachI; di++) {
          const at = jj * SLOPE_NX + (i + di + SLOPE_NX) % SLOPE_NX, w = wring[at]!
          if (w <= 0) continue
          const k = w * Math.exp(-(dj * dj + di * di * cl * cl) / (2 * REGION_CELLS * REGION_CELLS))
          sum += k * Math.log(grid[at]! + 1e-3); weight += k
        }
      }
      const g = Math.exp((sum + PRIOR_WEIGHT * prior) / (weight + PRIOR_WEIGHT))
      grid[n + j * SLOPE_NX + i] = g
      if (wring[j * SLOPE_NX + i]! > .5 && weight >= 1) for (let k = Math.max(1, Math.round(6 * cl)); k > 0; k--) coast.push(g) // as often as the cell is wide: a coast is counted by its length, not by its cells (they crowd at the poles)
    }
  }
  // the coasts' slopes, gentlest first: where a slope stands among them is how gentle a coast is, whatever the body's own spread of slopes
  P.coastSlopes = Float32Array.from(coast).sort()
  return grid
}

/** The coast's band in the mask (the share of the sea's span from the sea level on the sea's side, a third of it on the land's: a margin is both its shelf and the land behind), and the cells round a cell (a margin's reach: a kernel of under two cells' width, three degrees) its gentleness is taken over. */
const COAST_BAND = .6, REGION_CELLS = 1.8, PRIOR_WEIGHT = .4

/** The slope of the mask's smooth outline at a point of the sphere (per radian), by bilinear lookup in the body's slope grid: `layer` 0 the slope there, 1 the coast's regional slope. */
function smoothSlope(P: LandParams, x: number, y: number, z: number, layer = 0): number {
  const grid = P.slope ?? (P.slope = slopeGrid(P)), o = layer * SLOPE_NX * SLOPE_NY
  const lat = Math.asin(y < -1 ? -1 : y > 1 ? 1 : y), lon = Math.atan2(z, x)
  const u = (lon + Math.PI) / (2 * Math.PI) * SLOPE_NX - .5, v = (Math.PI / 2 - lat) / Math.PI * SLOPE_NY - .5
  const i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0
  const ia = (i0 + SLOPE_NX) % SLOPE_NX, ib = (i0 + 1 + SLOPE_NX) % SLOPE_NX, ja = j0 < 0 ? 0 : j0 > SLOPE_NY - 1 ? SLOPE_NY - 1 : j0, jb = j0 + 1 < 0 ? 0 : j0 + 1 > SLOPE_NY - 1 ? SLOPE_NY - 1 : j0 + 1
  return (grid[o + ja * SLOPE_NX + ia]! * (1 - fu) + grid[o + ja * SLOPE_NX + ib]! * fu) * (1 - fv) + (grid[o + jb * SLOPE_NX + ia]! * (1 - fu) + grid[o + jb * SLOPE_NX + ib]! * fu) * fv
}

/** Height at a point of the sphere, 0–1: the Place tool's land test is `heightAt > SEA`. */
export function heightAt(record: WorldBodyRecord, x: number, y: number, z: number): number {
  return terrain(landParamsOf(record), x, y, z, DEFAULT_DETAIL)
}

/** The height the sea stands at. */
export const seaHeight = (_record: WorldBodyRecord): number => SEA
