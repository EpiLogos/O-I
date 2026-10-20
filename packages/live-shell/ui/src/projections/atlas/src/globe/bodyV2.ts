// Generator version 2 (T-PROCEDURAL-BODY): the pictures. The base image is an equirect of the body (the Earth's seam takes it as it takes the Earth's own imagery), its cloud
// layer is a mask of its own, and the disc is the body small and whole for the System scale. All three are made from the one field (bodyField.ts) and the one surface
// (bodySurface.ts), as a tile is (bodyTiles.ts): the same record, look and (for the disc) occasion give the same bytes, in a worker or not.
//
// The image is made in two passes. The first asks the field for the height at every pixel; the second colours the surface and lays the relief shading over it from the
// height's slope between neighbours, and blends the coast by how much of the pixel is land. A tile does the same on its own grid and a border of one pixel, so that its
// shading is continuous across its edges.
//
// Pure TypeScript with no DOM and no three.js: it runs in a worker. Nothing here is random.
import {SEA, LAND_RANGE, DEFAULT_DETAIL, landParamsOf, terrain, T, heightAt as fieldHeight, seaHeight as fieldSeaHeight, smooth} from './bodyField'
import {surfaceOf, surfaceAt, landSurface, seaSurface, WHITE, type Surface} from './bodySurface'
import {riverNetworkOf, WATER_DETAIL} from './bodyRivers'
import {barrenOfLook, cloudCover, cloudEdge, cloudTarget, weatherShift} from './bodyWeather'
import type {BodyImage, BodyLook, WorldBodyRecord} from './body'

const D2R = Math.PI / 180

export const heightAt = fieldHeight
export const seaHeight = fieldSeaHeight

/** How thick the body's air shows: 1 is the Earth's (the World device's 60 %), 0 none; a barren look thins it to nothing. */
export const airOf = (record: WorldBodyRecord, look?: BodyLook): number => Math.min(1.7, record.sky.atmosphere / .6) * (1 - barrenOfLook(look))

const byte = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 255 : Math.round(x * 255))

/** The height's slope from its neighbours, as the shading wants it: the rise toward the east less the rise toward the north (light from the north-west), per radian. */
export function shadeSlope(hs: Float32Array, w: number, h: number, i: number, j: number, east: number, west: number, dlon: number, dlat: number, cosLat: number): number {
  const at = j * w + i
  const sx = (hs[j * w + east]! - hs[j * w + west]!) / (2 * dlon * cosLat)
  const north = hs[(j > 0 ? j - 1 : j) * w + i]!, south = hs[(j < h - 1 ? j + 1 : j) * w + i]!
  const sy = (north - south) / (2 * dlat)
  void at
  return .7071 * (sx - sy)
}

/** The colour of a pixel from its surface, its slope and (at the coast) the share of it that is land. `col` is the surface colour on entry and the pixel's on exit. */
export function shadePixel(hgt: number, slope: number, col: Float64Array): void {
  let shade: number
  if (hgt > SEA) {
    shade = 1 + .5 * Math.tanh(.22 * slope)
    // a little lighter with height, as thin air is clear
    shade *= .9 + .2 * smooth(0, .8, (hgt - SEA) / LAND_RANGE)
  } else shade = 1 + .11 * Math.tanh(.45 * slope)
  // snow and ice keep their brightness: shaded a little, never into grey
  const white = WHITE[0]! > WHITE[1]! ? WHITE[0]! : WHITE[1]!
  // snow keeps its relief a little, a sheet of ice hardly any (an ice sheet is nearly one white)
  if (white > 0) shade = shade + (Math.min(1.03 - .01 * WHITE[1]!, Math.max(.93 + .04 * WHITE[1]!, shade)) - shade) * white
  // the sea floor's relief is not seen through the ice that covers it
  if (hgt <= SEA && WHITE[1]! > 0) shade += (1 - shade) * WHITE[1]!
  col[0] *= shade; col[1] *= shade; col[2] *= shade
}

const landC = new Float64Array(3), seaC = new Float64Array(3)

/** A pixel's colour, given its position, its height and the slope under it: the surface, the shading, and at the coast the blend of both sides by how much of the pixel is land
 * (`spread` is the height a pixel spans there; 0 for none). Writes red, green, blue 0–1 to `out`. */
export function pixelColour(S: Surface, x: number, y: number, z: number, hgt: number, cn: number, slope: number, spread: number, detail: number, out: Float64Array): void {
  if (spread > 0 && Math.abs(hgt - SEA) < spread) {
    const land = smooth(.33, .73, .5 + (hgt - SEA) / (2 * spread))
    if (hgt > SEA) {
      landSurface(S, x, y, z, (hgt - SEA) / LAND_RANGE, cn, detail, landC); shadePixel(SEA + 1e-6, slope, landC)
      seaSurface(S, x, y, z, .02, detail, seaC); shadePixel(SEA - 1e-6, slope, seaC)
    } else {
      seaSurface(S, x, y, z, 1 - hgt / SEA, detail, seaC); shadePixel(SEA - 1e-6, slope, seaC)
      landSurface(S, x, y, z, .004, .01, detail, landC); shadePixel(SEA + 1e-6, slope, landC)
    }
    out[0] = landC[0]! * land + seaC[0]! * (1 - land); out[1] = landC[1]! * land + seaC[1]! * (1 - land); out[2] = landC[2]! * land + seaC[2]! * (1 - land)
    return
  }
  surfaceAt(S, x, y, z, hgt, cn, detail, out)
  shadePixel(hgt, slope, out)
}

/** The body as an equirect image, `width` × `width / 2`, row 0 the north edge, column 0 longitude −180. */
export function bodyImage(record: WorldBodyRecord, width = 1024, look?: BodyLook): BodyImage {
  const w = Math.max(8, Math.floor(width / 2) * 2), h = w / 2
  const P = landParamsOf(record), dlat0 = Math.PI / h, S = surfaceOf(record, P, barrenOfLook(look), dlat0 <= WATER_DETAIL ? riverNetworkOf(record, P) : null)
  const dlon = 2 * Math.PI / w, dlat = Math.PI / h, detail = dlat
  const cosLon = new Float64Array(w), sinLon = new Float64Array(w), cosLat = new Float64Array(h), sinLat = new Float64Array(h)
  for (let i = 0; i < w; i++) { const lon = (-180 + (i + .5) * 360 / w) * D2R; cosLon[i] = Math.cos(lon); sinLon[i] = Math.sin(lon) }
  for (let j = 0; j < h; j++) { const lat = (90 - (j + .5) * 180 / h) * D2R; cosLat[j] = Math.cos(lat); sinLat[j] = Math.sin(lat) }
  const hs = new Float32Array(w * h), cs = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      hs[j * w + i] = terrain(P, cosLat[j]! * cosLon[i]!, sinLat[j]!, cosLat[j]! * sinLon[i]!, detail)
      cs[j * w + i] = Math.round(T[1]! * 255)
    }
  }
  const data = new Uint8ClampedArray(w * h * 4), col = new Float64Array(3)
  for (let j = 0; j < h; j++) {
    const cl = Math.max(cosLat[j]!, .05)
    for (let i = 0; i < w; i++) {
      const at = j * w + i, hgt = hs[at]!, east = i + 1 < w ? i + 1 : 0, west = i > 0 ? i - 1 : w - 1
      const slope = shadeSlope(hs, w, h, i, j, east, west, dlon, dlat, cl)
      const spread = .75 * (Math.abs(hs[j * w + east]! - hs[j * w + west]!) + Math.abs(hs[(j > 0 ? j - 1 : j) * w + i]! - hs[(j < h - 1 ? j + 1 : j) * w + i]!)) / 2
      pixelColour(S, cosLat[j]! * cosLon[i]!, sinLat[j]!, cosLat[j]! * sinLon[i]!, hgt, cs[at]! / 255, slope, spread, detail, col)
      data[at * 4] = byte(col[0]!); data[at * 4 + 1] = byte(col[1]!); data[at * 4 + 2] = byte(col[2]!); data[at * 4 + 3] = 255
    }
  }
  return {width: w, height: h, data}
}

/** How much of the body is land, 0–1, on the image's own cells weighted by their area (a reading for the device, not a setting). */
export function landShare(record: WorldBodyRecord, width = 128): number {
  const w = Math.max(8, Math.floor(width / 2) * 2), h = w / 2, P = landParamsOf(record), detail = DEFAULT_DETAIL
  let land = 0, all = 0
  for (let j = 0; j < h; j++) {
    const lat = (90 - (j + .5) * 180 / h) * D2R, c = Math.cos(lat), s = Math.sin(lat)
    for (let i = 0; i < w; i++) {
      const lon = (-180 + (i + .5) * 360 / w) * D2R
      if (terrain(P, c * Math.cos(lon), s, c * Math.sin(lon), detail) > SEA) land += c
      all += c
    }
  }
  return land / all
}

/** The cloud cover as an equirect mask (row 0 the north edge, column 0 longitude −180): red, green and blue are the cover 0–255. Empty when the record asks for no cloud
 * or the look is barren. */
export function cloudImage(record: WorldBodyRecord, width = 512, look?: BodyLook): BodyImage {
  const w = Math.max(8, Math.floor(width / 2) * 2), h = w / 2, data = new Uint8ClampedArray(w * h * 4)
  const target = cloudTarget(record.sky.clouds, barrenOfLook(look))
  const edge = target > 0 ? cloudEdge(record.seed, target) : 0
  for (let j = 0; j < h; j++) {
    const lat = (90 - (j + .5) * 180 / h) * D2R, cl = Math.cos(lat), sl = Math.sin(lat)
    for (let i = 0; i < w; i++) {
      const lon = (-180 + (i + .5) * 360 / w) * D2R, at = (j * w + i) * 4, v = target > 0 ? byte(cloudCover(record.seed, edge, cl * Math.cos(lon), sl, cl * Math.sin(lon))) : 0
      data[at] = v; data[at + 1] = v; data[at + 2] = v; data[at + 3] = 255
    }
  }
  return {width: w, height: h, data}
}

/** The body seen whole as a small disc, `size` × `size` RGBA (transparent outside it), from over its equator at longitude 0 with its axis leaned by the tilt, lit from the
 * upper left, its clouds as they stand at `timeMs` (absent or null: the weather's own zero) and its air at the rim. */
export function bodyDisc(record: WorldBodyRecord, size = 48, look?: BodyLook, timeMs?: number | null): BodyImage {
  const n = Math.max(8, Math.floor(size)), data = new Uint8ClampedArray(n * n * 4)
  const P = landParamsOf(record), barren = barrenOfLook(look), S = surfaceOf(record, P, barren), air = airOf(record, look)
  const tilt = record.sky.axial_tilt_deg * D2R, ct = Math.cos(tilt), st = Math.sin(tilt)
  const lit = {x: -.55, y: .35, z: .76}, detail = Math.max(2.4 / n, .004)
  const target = cloudTarget(record.sky.clouds, barren), edge = target > 0 ? cloudEdge(record.seed, target) : 0, time = typeof timeMs === 'number' && Number.isFinite(timeMs) ? timeMs : 0
  const col = new Float64Array(3)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const xm = -1 + (i + .5) * 2 / n, ym = 1 - (j + .5) * 2 / n, r2 = xm * xm + ym * ym, at = (j * n + i) * 4
      if (r2 >= 1) {
        // the air: a thin glow just past the rim, as thick as the atmosphere
        const out = Math.sqrt(r2) - 1, glow = air * .6 * Math.exp(-out * 14) * (out < .18 ? 1 : 0)
        data[at] = byte(.55); data[at + 1] = byte(.72); data[at + 2] = byte(.95); data[at + 3] = byte(glow * .7)
        continue
      }
      const zm = Math.sqrt(1 - r2)
      const bx = xm * ct + ym * st, by = -xm * st + ym * ct, bz = zm
      const hgt = terrain(P, bx, by, bz, detail)
      surfaceAt(S, bx, by, bz, hgt, T[1]!, detail, col)
      let r = col[0]!, g = col[1]!, b = col[2]!
      if (target > 0) {
        const lat = Math.asin(by < -1 ? -1 : by > 1 ? 1 : by) / D2R, c = cloudCover(record.seed, edge, bx, by, bz, weatherShift(record, lat, time)) * .85
        r += (.95 - r) * c; g += (.96 - g) * c; b += (.97 - b) * c
      }
      const shade = .35 + .65 * Math.max(0, xm * lit.x + ym * lit.y + zm * lit.z)
      const rim = air * Math.pow(1 - zm, 2.6) * .5
      data[at] = byte(r * shade + .45 * rim); data[at + 1] = byte(g * shade + .62 * rim); data[at + 2] = byte(b * shade + .9 * rim); data[at + 3] = 255
    }
  }
  return {width: n, height: n, data}
}
