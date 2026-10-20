// Close-zoom tiles of a generated body (T-PROCEDURAL-BODY): a 256 × 256 picture of the body at a Web-Mercator slippy tile (tilemath.ts: row 0 at the north edge, z 0..8), made from
// the same field and the same surface as the base image (bodyV2.ts), so a tile is the base made finer and not another body: the land and the sea agree with the base and with the
// Place tool's land test (`heightAt`), and the detail is the field's own, octaves finer than the base resolved. They take the place of the Earth's GIBS tiles for a generated body
// (globe/tiles.ts takes a tile source); the globe asks the worker for them, never the network.
//
// A tile is made on its own grid and a border of one pixel, so the relief shading at its edges is cut from the same heights its neighbour's is, and neighbouring tiles meet without a
// seam. A body of generator version 1 has no tiles (the World design's value noise has no detail finer than its base): `hasTiles` says so, and the globe asks for none.
//
// Pure TypeScript with no DOM and no three.js: it runs in a worker. Nothing here is random.
import {landParamsOf, terrain, T} from './bodyField'
import {surfaceOf} from './bodySurface'
import {riverNetworkOf, WATER_DETAIL} from './bodyRivers'
import {pixelColour} from './bodyV2'
import {barrenOfLook} from './bodyWeather'
import {lonOfX, latOfY, TILE_PX} from './tilemath'
import type {BodyImage, BodyLook, WorldBodyRecord} from './body'

const D2R = Math.PI / 180
const byte = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 255 : Math.round(x * 255))

/** The first tile level that is denser than a base `baseWidth` wide: log2(base / 256) + 1, the rule the Earth's GIBS tiles follow (6 for the 8192-wide base, 5 for 4096). A tile at
 * that level has twice the pixels round the equator that the base has; none shallower adds anything the base does not show. */
export function tileLevelFor(baseWidth: number): number {
  return Math.round(Math.log2(Math.max(TILE_PX, baseWidth) / TILE_PX)) + 1
}

/** Whether a body has tiles: the bodies of generator version 2 and later do, a body of version 1 does not. */
export const hasTiles = (record: WorldBodyRecord): boolean => record.generator.version >= 2

/** The tile at `z`/`x`/`y` of the body: 256 × 256 RGBA. Deterministic. A body of generator version 1 has none (`hasTiles`). */
export function bodyTile(record: WorldBodyRecord, z: number, x: number, y: number, look?: BodyLook): BodyImage {
  if (!hasTiles(record)) throw new Error('a body of generator version 1 has no tiles: its next change rebuilds it as version 2')
  const n = TILE_PX, g = n + 2
  const P = landParamsOf(record), count = 2 ** z
  const dlon = 2 * Math.PI / count / n
  // the pixel's place on the sphere: a column of longitude and a Web-Mercator row, at the pixel's centre, with one pixel of border all round
  const cosLon = new Float64Array(g), sinLon = new Float64Array(g), cosLat = new Float64Array(g), sinLat = new Float64Array(g)
  for (let i = 0; i < g; i++) { const lon = lonOfX(z, x + (i - .5) / n) * D2R; cosLon[i] = Math.cos(lon); sinLon[i] = Math.sin(lon) }
  for (let j = 0; j < g; j++) { const lat = latOfY(z, y + (j - .5) / n) * D2R; cosLat[j] = Math.cos(lat); sinLat[j] = Math.sin(lat) }
  const pixel = (j: number): number => Math.max(dlon * cosLat[j]!, 1e-7)
  const barren = barrenOfLook(look), detail = pixel(Math.floor(g / 2))
  const S = surfaceOf(record, P, barren, detail <= WATER_DETAIL ? riverNetworkOf(record, P) : null)
  const hs = new Float32Array(g * g), cs = new Uint8Array(g * g)
  for (let j = 0; j < g; j++) {
    const d = pixel(j)
    for (let i = 0; i < g; i++) {
      hs[j * g + i] = terrain(P, cosLat[j]! * cosLon[i]!, sinLat[j]!, cosLat[j]! * sinLon[i]!, d)
      cs[j * g + i] = Math.round(T[1]! * 255)
    }
  }
  const data = new Uint8ClampedArray(n * n * 4), col = new Float64Array(3)
  for (let j = 1; j <= n; j++) {
    const east = dlon * cosLat[j]!, north = (Math.asin(sinLat[j - 1]!) - Math.asin(sinLat[j + 1]!)) / 2
    const d = pixel(j)
    for (let i = 1; i <= n; i++) {
      const at = j * g + i, hgt = hs[at]!
      const sx = (hs[at + 1]! - hs[at - 1]!) / (2 * east), sy = (hs[at - g]! - hs[at + g]!) / (2 * Math.max(north, 1e-9))
      const spread = .75 * (Math.abs(hs[at + 1]! - hs[at - 1]!) + Math.abs(hs[at - g]! - hs[at + g]!)) / 2
      pixelColour(S, cosLat[j]! * cosLon[i]!, sinLat[j]!, cosLat[j]! * sinLon[i]!, hgt, cs[at]! / 255, .7071 * (sx - sy), spread, d, Math.hypot(sx, sy), col)
      const o = ((j - 1) * n + (i - 1)) * 4
      data[o] = byte(col[0]!); data[o + 1] = byte(col[1]!); data[o + 2] = byte(col[2]!); data[o + 3] = 255
    }
  }
  return {width: n, height: n, data}
}
