// Generator version 1 (`fbm-sphere` 1), moved here byte for byte from globe/body.ts when version 2 took the name (T-PROCEDURAL-BODY): a body
// built by version 1 keeps drawing exactly as it did, and its next change rebuilds it as version 2 (body.ts dispatches on the record's version).
// Nothing in this file may change what it draws: tests/w3q-planet-gate.test.mjs C1 and tests/w3q-gen-determinism.test.mjs D1 hold its bytes.
//
// The World design's value noise, ported: the noise, the height and the land test are the design's own preview
// (inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx hash3, noise3, fbm, heightAt, isLand). The colours carry the cues EARTH_FRAG grades
// (globe/shaders.ts EARTH_COMMON waterOf: sea is blue well above red; the bathymetry shelf is the sea's luma; land tone is luma with its relief
// shading baked in; ice is white). The clouds are a layer of their own, never baked into the image (the land test must not see weather).
//
// Pure TypeScript with no DOM and no three.js, so it runs in a worker. Nothing here is random.
import type {BodyImage, WorldBodyRecord} from './body'

/** The point on the unit sphere at a latitude and longitude (body.ts unitOf; a copy, so this module stands on nothing but its types). */
function unitOf(lat: number, lon: number): {x: number; y: number; z: number} {
  return {x: Math.cos(lat * D2R) * Math.cos(lon * D2R), y: Math.sin(lat * D2R), z: Math.cos(lat * D2R) * Math.sin(lon * D2R)}
}

// ── the noise: the design's own value noise on the unit sphere, seeded ────────────────────────────────────────────────

/** A hash at a lattice corner (the design's hash3). */
function hash3(seed: number, x: number, y: number, z: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
/** Value noise, smoothly blended between lattice corners (the design's noise3, the same arithmetic in the same order, unrolled so a
 * full-size body does not allocate a closure per sample). */
function noise3(seed: number, x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const fx = x - xi, fy = y - yi, fz = z - zi
  const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy), t = fz * fz * (3 - 2 * fz)
  const c000 = hash3(seed, xi, yi, zi), c100 = hash3(seed, xi + 1, yi, zi), c010 = hash3(seed, xi, yi + 1, zi), c110 = hash3(seed, xi + 1, yi + 1, zi)
  const c001 = hash3(seed, xi, yi, zi + 1), c101 = hash3(seed, xi + 1, yi, zi + 1), c011 = hash3(seed, xi, yi + 1, zi + 1), c111 = hash3(seed, xi + 1, yi + 1, zi + 1)
  const a0 = c000 + (c100 - c000) * u, b0 = c010 + (c110 - c010) * u, a1 = c001 + (c101 - c001) * u, b1 = c011 + (c111 - c011) * u
  const near = a0 + (b0 - a0) * w, far = a1 + (b1 - a1) * w
  return near + (far - near) * t
}
/** Fractal noise: octaves of value noise, each finer and weaker by `rough` (the design's fbm). */
function fbm(seed: number, x: number, y: number, z: number, octaves: number, rough: number): number {
  let sum = 0, amp = 1, norm = 0, f = 1
  for (let o = 0; o < octaves; o++) { sum += amp * noise3(seed + o * 101, x * f, y * f, z * f); norm += amp; amp *= rough; f *= 2.02 }
  return sum / norm
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const D2R = Math.PI / 180

/** Height at a point of the sphere, 0–1 (the design's heightAt). */
export function heightAt(record: WorldBodyRecord, x: number, y: number, z: number): number {
  const {continents, relief, coast} = record.landmass
  const k = continents * 1.1, detail = coast === 'fjord' ? .62 : coast === 'archipelago' ? .7 : .48
  const base = fbm(record.seed, x * k + 7, y * k + 7, z * k + 7, coast === 'smooth' ? 3 : 5, detail)
  return clamp01(.5 + (base - .5) * (1 + relief * 1.6))
}

/** The height the sea stands at (the design's isLand threshold). */
export const seaHeight = (record: WorldBodyRecord): number => .28 + record.landmass.sea_level * .44

// The cues EARTH_FRAG reads (shaders.ts EARTH_COMMON): sea is strongly blue against red (waterOf takes (b − r)/(b + .05) above .56),
// deep sea dark and the shelf light (shelf = smoothstep(.05, .3, luma)); land's tone is its luma, relief shading baked in, with
// chroma that keeps wet, dry and rock apart; ice and snow are white, never blue against red.
const DEEP = [0.012, 0.035, 0.13], SHELF = [0.07, 0.33, 0.56]
const WET = [0.16, 0.3, 0.1], DRY = [0.55, 0.45, 0.27], ROCK = [0.46, 0.42, 0.38], ICE = [0.9, 0.92, 0.93]
const smooth = (e0: number, e1: number, x: number) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t) }
const byte = (x: number) => Math.round(clamp01(x) * 255)

/** The body as an equirect image, `width` × `width / 2`. Deterministic: the same record and width give the same bytes. */
export function bodyImage(record: WorldBodyRecord, width = 1024): BodyImage {
  const w = Math.max(8, Math.floor(width / 2) * 2), h = w / 2
  // the sphere's points by column and row, once: x = cos(lat)·cos(lon), y = sin(lat), z = cos(lat)·sin(lon) (unitOf)
  const cosLon = new Float64Array(w), sinLon = new Float64Array(w), cosLat = new Float64Array(h), sinLat = new Float64Array(h)
  for (let i = 0; i < w; i++) { const lon = (-180 + (i + .5) * 360 / w) * D2R; cosLon[i] = Math.cos(lon); sinLon[i] = Math.sin(lon) }
  for (let j = 0; j < h; j++) { const lat = (90 - (j + .5) * 180 / h) * D2R; cosLat[j] = Math.cos(lat); sinLat[j] = Math.sin(lat) }
  const heights = new Float32Array(w * h)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) heights[j * w + i] = heightAt(record, cosLat[j] * cosLon[i], sinLat[j], cosLat[j] * sinLon[i])
  const sea = seaHeight(record), {relief} = record.landmass, {warmth, moisture, ice_caps} = record.climate
  const polar = 1 - ice_caps * .45, lift = 6 + relief * 18
  const data = new Uint8ClampedArray(w * h * 4)
  for (let j = 0; j < h; j++) {
    const coslat = Math.max(cosLat[j], .05), ice = Math.abs(sinLat[j]) > polar
    for (let i = 0; i < w; i++) {
      const at = j * w + i, height = heights[at]
      let r: number, g: number, b: number
      if (height <= sea) {
        // the sea: dark in the deep, lifting to the shelf as it nears the coast
        const k = smooth(sea - .14, sea, height)
        r = DEEP[0] + (SHELF[0] - DEEP[0]) * k; g = DEEP[1] + (SHELF[1] - DEEP[1]) * k; b = DEEP[2] + (SHELF[2] - DEEP[2]) * k
      } else {
        // the land: wet or dry by the climate (the design's `wet`), rock with height, its relief shaded from the north-west
        const x = cosLat[j] * cosLon[i], y = sinLat[j], z = cosLat[j] * sinLon[i]
        const wet = smooth(.35, .65, clamp01(moisture * 1.2 - (warmth - .5) * .6 + (fbm(record.seed + 9, x * 3, y * 3, z * 3, 2, .5) - .5)))
        const above = (height - sea) / Math.max(1 - sea, .05), rock = smooth(.45, .9, above)
        const east = heights[j * w + ((i + 1) % w)], west = heights[j * w + ((i + w - 1) % w)]
        const north = heights[Math.max(0, j - 1) * w + i], south = heights[Math.min(h - 1, j + 1) * w + i]
        const shade = Math.max(.35, Math.min(1.35, 1 + (north - south - (east - west) / coslat) * lift)) * (.75 + .35 * above)
        r = (DRY[0] + (WET[0] - DRY[0]) * wet) * (1 - rock) + ROCK[0] * rock
        g = (DRY[1] + (WET[1] - DRY[1]) * wet) * (1 - rock) + ROCK[1] * rock
        b = (DRY[2] + (WET[2] - DRY[2]) * wet) * (1 - rock) + ROCK[2] * rock
        r *= shade; g *= shade; b *= shade
      }
      // the ice caps (the design's polar test: |y| above 1 − ice × .45)
      if (ice) {
        const k = height <= sea ? .85 : .95
        r += (ICE[0] - r) * k; g += (ICE[1] - g) * k; b += (ICE[2] - b) * k
      }
      data[at * 4] = byte(r)
      data[at * 4 + 1] = byte(g)
      data[at * 4 + 2] = byte(b)
      data[at * 4 + 3] = 255
    }
  }
  return {width: w, height: h, data}
}

/** How much of the body is land, 0–1, on the image's own cells weighted by their area (a reading for the device, not a setting). */
export function landShare(record: WorldBodyRecord, width = 128): number {
  const w = Math.max(8, Math.floor(width / 2) * 2), h = w / 2, sea = seaHeight(record)
  let land = 0, all = 0
  for (let j = 0; j < h; j++) {
    const lat = 90 - (j + .5) * 180 / h, area = Math.cos(lat * D2R)
    for (let i = 0; i < w; i++) {
      const p = unitOf(lat, -180 + (i + .5) * 360 / w)
      if (heightAt(record, p.x, p.y, p.z) > sea) land += area
      all += area
    }
  }
  return land / all
}

/** The cloud cover as an equirect mask in the body image's convention (row 0 the north edge, column 0 longitude −180): its red, green
 * and blue are the cover 0–255, alpha 255. `width` × `width / 2`. Deterministic, and empty (all 0) when the record asks for no cloud. */
export function cloudImage(record: WorldBodyRecord, width = 512): BodyImage {
  const w = Math.max(8, Math.floor(width / 2) * 2), h = w / 2
  const data = new Uint8ClampedArray(w * h * 4)
  const cover = record.sky.clouds, edge = 1 - cover * .55
  for (let j = 0; j < h; j++) {
    const lat = (90 - (j + .5) * 180 / h) * D2R, cl = Math.cos(lat), sl = Math.sin(lat)
    for (let i = 0; i < w; i++) {
      const lon = (-180 + (i + .5) * 360 / w) * D2R
      const k = cover <= 0 ? 0 : smooth(edge - .05, edge + .05, fbm(record.seed + 51, cl * Math.cos(lon) * 2.4, sl * 2.4, cl * Math.sin(lon) * 2.4, 3, .55))
      const at = (j * w + i) * 4, v = byte(k)
      data[at] = v; data[at + 1] = v; data[at + 2] = v; data[at + 3] = 255
    }
  }
  return {width: w, height: h, data}
}

/** How thick the body's air shows, as the globe's atmosphere takes it: 1 is the Earth's own (the World device's default 60 %), 0 none. */
export const airOf = (record: WorldBodyRecord): number => Math.min(1.7, record.sky.atmosphere / .6)

// ── the body as a disc (the System scale draws each world's body small, beside your planet) ──────────────────────────────────────

/** The body seen whole as a small disc, `size` × `size` RGBA (transparent outside it): from over its equator at longitude 0, its axis
 * leaned by the tilt (the World design's BodyArt, its view rotated back into the body's frame), lit from the upper left, its clouds
 * over the land and its air at the rim. For a picture beside your planet, not for the globe. Deterministic. */
export function bodyDisc(record: WorldBodyRecord, size = 48): BodyImage {
  const n = Math.max(8, Math.floor(size)), data = new Uint8ClampedArray(n * n * 4)
  const sea = seaHeight(record), {warmth, moisture, ice_caps} = record.climate, {clouds, atmosphere} = record.sky
  const tilt = record.sky.axial_tilt_deg * D2R, ct = Math.cos(tilt), st = Math.sin(tilt), polar = 1 - ice_caps * .45
  const lit = {x: -.55, y: .35, z: .76}, edge = 1 - clouds * .55
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const xm = -1 + (i + .5) * 2 / n, ym = 1 - (j + .5) * 2 / n, r2 = xm * xm + ym * ym, at = (j * n + i) * 4
      if (r2 >= 1) {
        // the air: a thin glow just past the rim, as thick as the atmosphere
        const out = Math.sqrt(r2) - 1, glow = atmosphere * Math.exp(-out * 14) * (out < .18 ? 1 : 0)
        data[at] = byte(.55); data[at + 1] = byte(.72); data[at + 2] = byte(.95); data[at + 3] = byte(glow * .7)
        continue
      }
      const zm = Math.sqrt(1 - r2)
      const bx = xm * ct + ym * st, by = -xm * st + ym * ct, bz = zm
      const height = heightAt(record, bx, by, bz)
      let r: number, g: number, b: number
      if (height <= sea) {
        const k = smooth(sea - .14, sea, height)
        r = DEEP[0] + (SHELF[0] - DEEP[0]) * k; g = DEEP[1] + (SHELF[1] - DEEP[1]) * k; b = DEEP[2] + (SHELF[2] - DEEP[2]) * k
      } else {
        const wet = smooth(.35, .65, clamp01(moisture * 1.2 - (warmth - .5) * .6 + (fbm(record.seed + 9, bx * 3, by * 3, bz * 3, 2, .5) - .5)))
        const rock = smooth(.45, .9, (height - sea) / Math.max(1 - sea, .05))
        r = (DRY[0] + (WET[0] - DRY[0]) * wet) * (1 - rock) + ROCK[0] * rock
        g = (DRY[1] + (WET[1] - DRY[1]) * wet) * (1 - rock) + ROCK[1] * rock
        b = (DRY[2] + (WET[2] - DRY[2]) * wet) * (1 - rock) + ROCK[2] * rock
      }
      if (Math.abs(by) > polar) { r += (ICE[0] - r) * .9; g += (ICE[1] - g) * .9; b += (ICE[2] - b) * .9 }
      if (clouds > 0) {
        const c = smooth(edge - .05, edge + .05, fbm(record.seed + 51, bx * 2.4, by * 2.4, bz * 2.4, 3, .55)) * .85
        r += (.95 - r) * c; g += (.96 - g) * c; b += (.97 - b) * c
      }
      const shade = .35 + .65 * Math.max(0, xm * lit.x + ym * lit.y + zm * lit.z)
      const rim = atmosphere * Math.pow(1 - zm, 2.6) * .5
      data[at] = byte(r * shade + .45 * rim); data[at + 1] = byte(g * shade + .62 * rim); data[at + 2] = byte(b * shade + .9 * rim); data[at + 3] = 255
    }
  }
  return {width: n, height: n, data}
}
