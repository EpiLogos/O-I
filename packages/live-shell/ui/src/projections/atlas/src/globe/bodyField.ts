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
export const DEFAULT_DETAIL = .0022

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
const COAST = {smooth: {f: 5, a: .055, g: .54}, fjord: {f: 6, a: .15, g: .6}, archipelago: {f: 9, a: .19, g: .58}} as const

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
    Esea: 0, span: 1, seaSpan: 1, exitOK: false,
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
  let C = .66 * simplex3(t, wx * f + 1.7, wy * f + 9.2, wz * f - 3.1) + .24 * simplex3(t, x * f * 2.13 - 7, y * f * 2.13 + 2, z * f * 2.13 + 5) +
    .1 * simplex3(t, x * f * 4.4 + 3, y * f * 4.4 - 5, z * f * 4.4 + 8)
  C += P.dip * (wx * P.ax + wy * P.ay + wz * P.az)
  // the coast detail, an octave at a time, as fine as the detail asks
  const fmax = .9 / detail
  let fr = P.df, amp = P.da, D = 0, Dsm = 0
  // what the octaves from the third on can add at most (the noise stays inside ±1, a fjord's ridged term inside ±1.8): far from the coast they cannot change the answer
  const reach = P.coast === 'fjord' ? 1.8 : 1
  if (P.coast === 'fjord') {
    // thin dips cut into the coast by ridged noise (a fjord is long and narrow), with the smooth fractal under them
    for (let o = 0; fr <= fmax && o < 15; o++, fr *= 2.03, amp *= P.dg) {
      if (o === 2 && P.exitOK && Math.abs(C + Dsm - P.Esea) > reach * amp / (1 - P.dg)) break
      const n = simplex3(t, x * fr + 21 + o * 5.3, y * fr - 17, z * fr + 9 - o * 3.1)
      const r = 1 - Math.abs(n)
      const term = amp * (.55 * n - 1.25 * r * r * r * r)
      D += term
      if (o < 2) Dsm += term
    }
  } else {
    for (let o = 0; fr <= fmax && o < 15; o++, fr *= 2.03, amp *= P.dg) {
      if (o === 2 && P.exitOK && Math.abs(C + Dsm - P.Esea) > reach * amp / (1 - P.dg)) break
      const term = amp * simplex3(t, x * fr + 21 + o * 5.3, y * fr - 17, z * fr + 9 - o * 3.1)
      D += term
      if (o < 2) Dsm += term
    }
  }
  SMOOTH = C + Dsm
  return C + D
}

// ── the terrain: land and sea floor ───────────────────────────────────────────────────────────────────────────────────────

/** What `terrain` finds at a point: [0] height 0–1, [1] continentality 0 (the coast) to 1 (a continent's heart), [2] the land's elevation 0–1 above the sea (0 at sea),
 * [3] the sea floor's depth 0 (at the coast) to ~1 (the abyss; 0 on land). */
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
      const belt = .22 + .78 * Math.exp(-((simplex3(t, qx * 1.7 + 4.4, qy * 1.7 - 8.1, qz * 1.7 + 6.2) / .19) ** 2))
      let m = 0, amp = 1, wgt = 1, norm = 0, mf = 4.2
      for (let o = 0; o < 12 && mf <= fmax; o++, mf *= 2.05, amp *= .52) {
        let n = 1 - Math.abs(simplex3(t, qx * mf + 51 + o * 7.7, qy * mf - 23, qz * mf + 14 - o * 2.9))
        n *= n
        m += amp * n * wgt; norm += amp
        wgt = Math.min(1, n * 2.2)
      }
      L += relief ** 1.15 * (m / norm) * belt * smooth(.1, .55, cn) * 1.2
    }
    if (L > 1) L = 1
    T[1] = cn; T[2] = L; T[3] = 0
    return (T[0] = SEA + LAND_RANGE * L)
  }
  // the sea floor: shelf, slope, abyssal plain; ridges rise from the plain and trenches sink beside the continents
  // how deep: by the coast's own line close to it, and by its smooth outline farther out (a shelf has a smooth edge, whatever the coast's detail)
  const dnCoast = -above / P.seaSpan, u = Math.exp(-((dnCoast / .1) ** 2)), dnSmooth = Math.max(0, (P.Esea - SMOOTH) / P.seaSpan)
  const dn = Math.min(1, u * dnCoast + (1 - u) * dnSmooth)
  let depth = .1 * smooth(0, .22, dn) + .7 * smooth(.1, .46, dn) + .17 * smooth(.4, 1, dn)
  const plain = smooth(.32, .7, dn)
  if (plain > 0) {
    const fmax = .9 / detail
    let rf = 3.1, ra = .06
    for (let o = 0; o < 4 && rf <= fmax; o++, rf *= 2.3, ra *= .55) depth -= plain * ra * (1 - Math.abs(simplex3(t, qx * rf - 3 + o * 4.1, qy * rf + 41, qz * rf + 19)))
    depth += plain * .045
  }
  depth += .05 * Math.exp(-(((dn - .36) / .07) ** 2)) // the trench along the foot of the slope
  if (depth < 0) depth = 0
  else if (depth > .99) depth = .99
  T[1] = 0; T[2] = 0; T[3] = depth
  return (T[0] = SEA * (1 - depth))
}

/** Height at a point of the sphere, 0–1: the Place tool's land test is `heightAt > SEA`. */
export function heightAt(record: WorldBodyRecord, x: number, y: number, z: number): number {
  return terrain(landParamsOf(record), x, y, z, DEFAULT_DETAIL)
}

/** The height the sea stands at. */
export const seaHeight = (_record: WorldBodyRecord): number => SEA
