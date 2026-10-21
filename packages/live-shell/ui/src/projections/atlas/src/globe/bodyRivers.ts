// Generator version 2, the water on the land (T-PROCEDURAL-BODY): rivers in valleys that reach the sea, lakes in basins. Hydrology here is terrain: a river is a line of
// water in a valley, a lake a basin (no creatures, no ecology).
//
// A river is not a line of noise (that would end nowhere); it is where the land's water goes. The land is read once on a coarse grid (half a degree), the depressions are filled
// (Barnes' priority flood: every cell then drains to the sea, and what had to be filled is a lake), each cell's water is carried to its lowest neighbour, and the cells that
// gather enough water are rivers: a polyline from a cell's centre to the next, down to the sea. At any resolution a point's distance to those lines, bent by a meander noise
// (the same at every scale, finer octaves added as the detail asks), says how much of it is river; a lake is a point of a depression whose own height, as fine as the picture
// resolves it, is under the lake's level. The network is made once for a body's landmass dials, seed and moisture and kept (a few at a time); the same body gives the same
// network on every machine.
//
// The Place tool's land test does not see the water: a place beside a river is on land. Pure TypeScript with no DOM and no three.js: it runs in a worker. Nothing here is random.
import {simplex3, type NoiseTables} from './bodyNoise'
import {SEA, WATER_DETAIL, landParamsOf, setValleyHook, terrain, type LandParams} from './bodyField'
import type {WorldBodyRecord} from './body'

const NX = 720, NY = 360, CELL = 360 / NX
const R2D = 180 / Math.PI
const D2R = Math.PI / 180
/** The water a cell must gather (in cells' worth at the equator, scaled by the rain) to be a river at all, and to be a full one. */
const ACC_MIN = 40, ACC_FULL = 120
/** A depression is a lake if it had to be filled by at least this height (in the field's 0–1). */
const LAKE_DEPTH = .022
export {WATER_DETAIL}
const SKIP_LAT = 78

export interface RiverNetwork {
  readonly t: NoiseTables
  /** per cell: the cell its water goes to (−1 off the map), the water it gathers, whether a river is within a cell of it, and the level of the lake it lies in (−1: none) */
  readonly down: Int32Array
  readonly acc: Float32Array
  readonly near: Uint8Array
  readonly lakeLevel: Float32Array
  readonly lakeNear: Uint8Array
}

const byKey = new Map<string, RiverNetwork>()
const byRecord = new WeakMap<object, RiverNetwork>()

/** The zonal rain of a latitude (degrees): the sky's bands (wet equator, dry subtropics, wet mid-latitudes), 0.1 to 1. */
function zonalRain(alat: number): number {
  const eq = Math.exp(-((alat / 16) ** 2)), mid = .88 * Math.exp(-(((alat - 52) / 17) ** 2))
  return .1 + .9 * (eq > mid ? eq : mid)
}

export function riverNetworkOf(record: WorldBodyRecord, P: LandParams = landParamsOf(record)): RiverNetwork {
  const known = byRecord.get(record)
  if (known) return known
  const {seed, landmass: {sea_level, continents, relief, coast}, climate: {moisture}} = record
  const key = `${seed}|${sea_level}|${continents}|${relief}|${coast}|${moisture}`
  let net = byKey.get(key)
  if (!net) {
    net = buildNetwork(P, moisture)
    if (byKey.size >= 6) byKey.delete(byKey.keys().next().value as string)
    byKey.set(key, net)
  }
  byRecord.set(record, net)
  return net
}

function buildNetwork(P: LandParams, moisture: number): RiverNetwork {
  const N = NX * NY
  const z = new Float32Array(N), sea = new Uint8Array(N)
  const cosLat = new Float64Array(NY)
  for (let j = 0; j < NY; j++) cosLat[j] = Math.cos((90 - (j + .5) * CELL) * D2R)
  for (let j = 0; j < NY; j++) {
    const lat = (90 - (j + .5) * CELL) * D2R, c = cosLat[j]!, s = Math.sin(lat)
    for (let i = 0; i < NX; i++) {
      const lon = (-180 + (i + .5) * CELL) * D2R, h = terrain(P, c * Math.cos(lon), s, c * Math.sin(lon), .012)
      z[j * NX + i] = h
      sea[j * NX + i] = h > SEA ? 0 : 1
    }
  }
  // priority flood from the sea (and the rim of the map): each land cell's water goes to the cell that reached it first, and a depression is raised to its spill level
  const filled = Float32Array.from(z), down = new Int32Array(N).fill(-1), seen = new Uint8Array(N), order = new Int32Array(N)
  const heapKey = new Float64Array(N + 8), heapIdx = new Int32Array(N + 8)
  let size = 0
  const push = (key: number, idx: number) => {
    let k = size++
    while (k > 0) {
      const p = (k - 1) >> 1
      if (heapKey[p]! <= key) break
      heapKey[k] = heapKey[p]!; heapIdx[k] = heapIdx[p]!; k = p
    }
    heapKey[k] = key; heapIdx[k] = idx
  }
  const pop = (): number => {
    const top = heapIdx[0]!, key = heapKey[--size]!, idx = heapIdx[size]!
    let k = 0
    for (;;) {
      let c = 2 * k + 1
      if (c >= size) break
      if (c + 1 < size && heapKey[c + 1]! < heapKey[c]!) c++
      if (heapKey[c]! >= key) break
      heapKey[k] = heapKey[c]!; heapIdx[k] = heapIdx[c]!; k = c
    }
    heapKey[k] = key; heapIdx[k] = idx
    return top
  }
  for (let c = 0; c < N; c++) if (sea[c]) seen[c] = 1
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const c = j * NX + i
    if (sea[c]) continue
    let rim = j === 0 || j === NY - 1
    if (!rim) for (let dj = -1; dj <= 1 && !rim; dj++) for (let di = -1; di <= 1; di++) { if (sea[(j + dj) * NX + ((i + di + NX) % NX)]) { rim = true; break } }
    if (rim) {
      seen[c] = 1; push(z[c]!, c)
      // its water goes to the sea beside it (or off the map)
      let to = -1
      for (let dj = -1; dj <= 1 && to < 0; dj++) for (let di = -1; di <= 1; di++) { const jj = j + dj; if (jj < 0 || jj >= NY) continue; const n = jj * NX + ((i + di + NX) % NX); if (sea[n]) { to = n; break } }
      down[c] = to
    }
  }
  let count = 0
  while (size > 0) {
    const c = pop(), i = c % NX, j = (c / NX) | 0
    order[count++] = c
    for (let dj = -1; dj <= 1; dj++) {
      const jj = j + dj
      if (jj < 0 || jj >= NY) continue
      for (let di = -1; di <= 1; di++) {
        if (!dj && !di) continue
        const n = jj * NX + ((i + di + NX) % NX)
        if (seen[n]) continue
        seen[n] = 1
        down[n] = c
        const level = filled[c]! + 1e-6
        filled[n] = z[n]! > level ? z[n]! : level
        push(filled[n]!, n)
      }
    }
  }
  // the water each cell gathers: rain on its area (rain follows the sky's bands and the moisture dial), carried downhill in the order the flood visited
  const acc = new Float32Array(N), wet = .35 + 1.3 * moisture
  for (let j = 0; j < NY; j++) {
    const rain = (.2 + .8 * zonalRain(Math.abs(90 - (j + .5) * CELL))) * wet * cosLat[j]!
    for (let i = 0; i < NX; i++) if (!sea[j * NX + i]) acc[j * NX + i] = rain
  }
  for (let k = count - 1; k >= 0; k--) {
    const c = order[k]!, d = down[c]!
    if (d >= 0 && !sea[d]) acc[d] = acc[d]! + acc[c]!
  }
  // lakes: the depressions that had to be filled, at their spill level
  const lakeLevel = new Float32Array(N).fill(-1), lakeNear = new Uint8Array(N), near = new Uint8Array(N)
  for (let c = 0; c < N; c++) if (!sea[c] && filled[c]! - z[c]! >= LAKE_DEPTH) lakeLevel[c] = filled[c]!
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const c = j * NX + i
    if (sea[c]) continue
    const river = acc[c]! >= ACC_MIN && Math.abs(90 - (j + .5) * CELL) < SKIP_LAT, lake = lakeLevel[c]! >= 0
    if (!river && !lake) continue
    for (let dj = -1; dj <= 1; dj++) { const jj = j + dj; if (jj < 0 || jj >= NY) continue; for (let di = -1; di <= 1; di++) { const n = jj * NX + ((i + di + NX) % NX); if (river) near[n] = 1; if (lake) lakeNear[n] = 1 } }
  }
  return {t: P.t, down, acc, near, lakeLevel, lakeNear}
}

/** What the water does to a pixel of land at a point: [0] how much of it is river, [1] how much lake, [2] the lake's depth under the point (0–1, for its colour). */
export const WATER = new Float64Array(4)

/** The distance (degrees, on the plane tangent at the query) from the origin to the segment a→b. */
function segmentDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy
  let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const px = ax + t * dx, py = ay + t * dy
  return Math.sqrt(px * px + py * py)
}

/** The wrapped longitude difference of two longitudes in degrees, −180 to 180. */
const wrapLon = (d: number): number => (d > 180 ? d - 360 : d < -180 ? d + 360 : d)

/** The water at a point of the sphere on land, whose own height is `hgt` and whose picture resolves `detail` radians: fills `WATER`. */
export function waterAt(net: RiverNetwork, x: number, y: number, z: number, hgt: number, detail: number): void {
  WATER[0] = 0; WATER[1] = 0; WATER[2] = 0
  const lat = Math.asin(y < -1 ? -1 : y > 1 ? 1 : y) * R2D
  if (Math.abs(lat) > SKIP_LAT + 2) return
  const lon = Math.atan2(z, x) * R2D
  const cj = Math.min(NY - 1, Math.max(0, Math.floor((90 - lat) / CELL))), ci = Math.min(NX - 1, Math.floor((lon + 180) / CELL))
  const cell = cj * NX + ci
  if (!net.near[cell] && !net.lakeNear[cell]) return
  const px = detail * R2D
  // the meander: the query point bent by noise, the same at every scale and finer where the detail is
  const t = net.t, cl = Math.max(.05, Math.cos(lat * D2R))
  let wl = .24 * simplex3(t, x * 41 + 3.1, y * 41 - 5.7, z * 41 + 8.3), wa = .24 * simplex3(t, x * 41 - 9.4, y * 41 + 2.2, z * 41 - 1.6)
  wl += .09 * simplex3(t, x * 123 + 7.7, y * 123 + 1.3, z * 123 - 6.2); wa += .09 * simplex3(t, x * 123 - 2.8, y * 123 - 8.1, z * 123 + 4.4)
  const fmax = .9 / detail
  for (let f = 370, a = .03; f <= fmax && a > .0006; f *= 2.9, a *= .42) {
    wl += a * simplex3(t, x * f + 1.9, y * f - 4.3, z * f + 6.8); wa += a * simplex3(t, x * f - 6.1, y * f + 3.7, z * f - 2.4)
  }
  if (net.near[cell]) {
    const qlon = lon + wl / cl, qlat = lat + wa
    let best = 0
    for (let dj = -1; dj <= 1; dj++) {
      const jj = cj + dj
      if (jj < 0 || jj >= NY) continue
      for (let di = -1; di <= 1; di++) {
        const ii = (ci + di + NX) % NX, r = jj * NX + ii, Q = net.acc[r]!
        if (Q < ACC_MIN) continue
        const d = net.down[r]!
        if (d < 0) continue
        const rl = -180 + (ii + .5) * CELL, ra = 90 - (jj + .5) * CELL
        const di2 = d % NX, dj2 = (d / NX) | 0, dl = -180 + (di2 + .5) * CELL, da = 90 - (dj2 + .5) * CELL
        const ax = wrapLon(rl - qlon) * cl, ay = ra - qlat, bx = wrapLon(dl - qlon) * cl, by = da - qlat
        const dist = segmentDistance(ax, ay, bx, by)
        // the river's width follows what it carries; no river is drawn thinner than a pixel can show
        const width = .0125 * Math.pow(Q, .45), half = Math.max(.5 * (width > .9 ? .9 : width), .9 * px)
        const cover = Math.min(1, Math.max(0, (half - dist) / Math.max(px, 1e-9) + .5))
        if (cover <= 0) continue
        const strength = cover * (Q >= ACC_FULL ? 1 : (Q - ACC_MIN) / (ACC_FULL - ACC_MIN) * .8 + .2)
        if (strength > best) best = strength
      }
    }
    WATER[0] = best
  }
  if (net.lakeNear[cell]) {
    // the lake: the level of the depression under the point, with the shore bent by the same noise (stronger) and weighted by a smooth bilinear, so it is not the grid's
    const qlon = lon + 1.1 * wl / cl, qlat = lat + 1.1 * wa
    const u = (qlon + 180) / CELL - .5, v = (90 - qlat) / CELL - .5, i0 = Math.floor(u), j0 = Math.floor(v)
    let fu = u - i0, fv = v - j0
    fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv)
    let weight = 0, level = -1
    for (let dj = 0; dj <= 1; dj++) for (let di = 0; di <= 1; di++) {
      const jj = j0 + dj
      if (jj < 0 || jj >= NY) continue
      const r = jj * NX + (((i0 + di) % NX) + NX) % NX, wgt = (di ? fu : 1 - fu) * (dj ? fv : 1 - fv), l = net.lakeLevel[r]!
      if (l >= 0) { weight += wgt; if (l > level) level = l }
    }
    if (weight >= .35 && hgt < level) {
      WATER[1] = Math.min(1, (weight - .35) / .12 + .25) * Math.min(1, (level - hgt) / Math.max(px * 6e-2, .0015) + .3)
      WATER[2] = Math.min(1, (level - hgt) / .03)
    }
  }
}

// ── the valleys the rivers cut ────────────────────────────────────────────────────────────────────────────────────────────

/** The networks the valleys follow: one for a body's landmass (its seed and dials) at the wettest rain, so every river any moisture draws runs in a valley (a dry world has the beds
 * of rivers it has not the water for). Built from the field at a pixel wider than the water is drawn at, where no valley is cut, so building needs no valley. */
interface Valleys { readonly net: RiverNetwork; readonly near: Uint8Array }
const valleyNets = new WeakMap<LandParams, Valleys>()
/** The cells within VALLEY_REACH cells of a river cell: beyond them (a degree) a valley's weight is under 2 % and nothing is asked. */
const VALLEY_REACH = 2
const valleyOf = (P: LandParams): Valleys => {
  let v = valleyNets.get(P)
  if (!v) {
    const net = buildNetwork(P, 1), near = new Uint8Array(NX * NY)
    for (let j = 0; j < NY; j++) {
      if (Math.abs(90 - (j + .5) * CELL) >= SKIP_LAT) continue
      for (let i = 0; i < NX; i++) {
        if (net.acc[j * NX + i]! < ACC_MIN || net.down[j * NX + i]! < 0) continue
        for (let dj = -VALLEY_REACH; dj <= VALLEY_REACH; dj++) { const jj = j + dj; if (jj < 0 || jj >= NY) continue; for (let di = -VALLEY_REACH; di <= VALLEY_REACH; di++) near[jj * NX + ((i + di + NX) % NX)] = 1 }
      }
    }
    v = {net, near}
    valleyNets.set(P, v)
  }
  return v
}

/** How far a point is into a river's valley, 0 (outside) to 1 (on its line): the distance (degrees) to the nearest river, bent by the meander the river is drawn with, over the valley's
 * half-width, which grows with what the river carries (at most half a degree). */
function valleyWeight(P: LandParams, x: number, y: number, z: number, detail: number): number {
  const lat = Math.asin(y < -1 ? -1 : y > 1 ? 1 : y) * R2D
  if (Math.abs(lat) > SKIP_LAT + 2) return 0
  const {net, near} = valleyOf(P), lon = Math.atan2(z, x) * R2D
  const cj = Math.min(NY - 1, Math.max(0, Math.floor((90 - lat) / CELL))), ci = Math.min(NX - 1, Math.floor((lon + 180) / CELL))
  if (!near[cj * NX + ci]) return 0
  const t = net.t, cl = Math.max(.05, Math.cos(lat * D2R))
  let wl = .24 * simplex3(t, x * 41 + 3.1, y * 41 - 5.7, z * 41 + 8.3), wa = .24 * simplex3(t, x * 41 - 9.4, y * 41 + 2.2, z * 41 - 1.6)
  wl += .09 * simplex3(t, x * 123 + 7.7, y * 123 + 1.3, z * 123 - 6.2); wa += .09 * simplex3(t, x * 123 - 2.8, y * 123 - 8.1, z * 123 + 4.4)
  const fmax = .9 / detail
  for (let f = 370, a = .03; f <= fmax && a > .0006; f *= 2.9, a *= .42) {
    wl += a * simplex3(t, x * f + 1.9, y * f - 4.3, z * f + 6.8); wa += a * simplex3(t, x * f - 6.1, y * f + 3.7, z * f - 2.4)
  }
  const qlon = lon + wl / cl, qlat = lat + wa
  let best = 0
  for (let dj = -VALLEY_REACH; dj <= VALLEY_REACH; dj++) {
    const jj = cj + dj
    if (jj < 0 || jj >= NY) continue
    for (let di = -VALLEY_REACH; di <= VALLEY_REACH; di++) {
      const ii = (ci + di + NX) % NX, r = jj * NX + ii, Q = net.acc[r]!
      if (Q < ACC_MIN) continue
      const d = net.down[r]!
      if (d < 0) continue
      const rl = -180 + (ii + .5) * CELL, ra = 90 - (jj + .5) * CELL
      const di2 = d % NX, dj2 = (d / NX) | 0, dl = -180 + (di2 + .5) * CELL, da = 90 - (dj2 + .5) * CELL
      const dist = segmentDistance(wrapLon(rl - qlon) * cl, ra - qlat, wrapLon(dl - qlon) * cl, da - qlat)
      const half = Math.min(.5, .28 + .035 * Math.pow(Q, .45)), g = dist / half
      if (g > 2.2) continue
      const w = Math.exp(-g * g) * (Q >= ACC_FULL ? 1 : (Q - ACC_MIN) / (ACC_FULL - ACC_MIN) * .8 + .2)
      if (w > best) best = w
    }
  }
  return best
}

setValleyHook(valleyWeight)
