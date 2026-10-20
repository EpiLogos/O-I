// T-PROCEDURAL-BODY, Lane A: the elements a planet is made of, one by one: rivers and lakes (water in low ground that reaches the sea),
// the sea floor from the coast outward, biomes in their order by latitude, snow only above the snow line, ice with a ragged margin,
// and relief shading that follows the height. Ticket §5 "Also in version 2" and the table's climate rows.
//
// What the picture is asked, and by whom. The picture (bodyImage, bodyTile) is read as the shader reads it (shaders.ts EARTH_COMMON): sea
// is blue well above red; ice and snow are bright and unsaturated. The height under a pixel is asked of the same field the Place tool asks
// (`heightAt`, globe/body.ts), so "low ground" and "above the snow line" are measured on the body's own ground, not guessed from colour.
// The Earth (public/textures/earth-2k.jpg) is the yardstick wherever a number is its: the classifiers below were run on it (20 Oct 2026) and
// it passes the biome-order test; the numbers are named beside the thresholds.
//
// Water in the picture. A river or lake is water in the picture that is not the sea. Wide water is the sea: the morphological opening of the
// water mask by 3 pixels (water that survives being eroded by 3 and grown back); what is left, "thin water", is rivers, small lakes and
// narrow straits; thin water at least 6 pixels from open water is inland. A lake is a body of water that is not the sea's.
//
// Run the red state: W3Q_GATE=enforce node --experimental-strip-types --test tests/w3q-gen-elements.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {waterMask, iceMask, lumaPlane, boxBlur} from './lib/planetMetrics.mjs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const source = (await readFile(new URL(u), 'utf8')).replace(/import\\.meta\\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(source, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const globe = new URL('../src/projections/atlas/src/globe/', import.meta.url)
const body = await import(new URL('body.ts', globe).href)
const {lonOfX, latOfY, yOfLat, TILE_PX} = await import(new URL('tilemath.ts', globe).href)
const shaders = await import(new URL('shaders.ts', globe).href)
const noiseModule = await import(new URL('bodyNoise.ts', globe).href)
const noiseTables = () => noiseModule.tablesOf(12345), simplexOf = (t, x, y, z) => noiseModule.simplex3(t, x, y, z)
/** A module this ticket adds: `{}` until it exists, so the test that needs it fails on an assertion, not on an import. */
async function optional(name) {
  try { return await import(new URL(name, globe).href) } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return {}
    throw error
  }
}


// ── fixtures and measures ───────────────────────────────────────────────────────────────────────────────────────────────

const DIALS = {landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3}, sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}}
const SEEDS = [20261018, 7, 42]
const make = (seed, change = {}) => ({
  body_ref: 'body:elements', seed, generator: {id: 'fbm-sphere', version: 2},
  landmass: {...DIALS.landmass, ...change.landmass}, climate: {...DIALS.climate, ...change.climate}, sky: {...DIALS.sky, ...change.sky},
})
const cache = new Map()
const imageOf = (record, width = 512) => { const key = `${JSON.stringify(record)}@${width}`; if (!cache.has(key)) cache.set(key, body.bodyImage(record, width)); return cache.get(key) }
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length
const f = (x, digits = 3) => (typeof x === 'number' ? +x.toFixed(digits) : x)
const latOf = (j, h) => 90 - (j + .5) * 180 / h
const D2R = Math.PI / 180
/** The height the Place tool asks at a latitude and longitude. */
const heightAtLL = (record, lat, lon) => { const p = body.unitOf(lat, lon); return body.heightAt(record, p.x, p.y, p.z) }
const quantile = (xs, q) => { const s = Float64Array.from(xs).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))] }

/** The distance in pixels from each pixel to the nearest pixel where `seed` is 1 (a chamfer of 1 and √2), wrapping in longitude. */
function distanceTo(seed, w, h) {
  const d = new Float32Array(w * h), at = (i, j) => j * w + ((i % w) + w) % w
  for (let k = 0; k < w * h; k++) d[k] = seed[k] ? 0 : 1e9
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let v = d[j * w + i]
    if (j > 0) v = Math.min(v, d[at(i, j - 1)] + 1, d[at(i - 1, j - 1)] + 1.414, d[at(i + 1, j - 1)] + 1.414)
    d[j * w + i] = Math.min(v, d[at(i - 1, j)] + 1)
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    let v = d[j * w + i]
    if (j < h - 1) v = Math.min(v, d[at(i, j + 1)] + 1, d[at(i - 1, j + 1)] + 1.414, d[at(i + 1, j + 1)] + 1.414)
    d[j * w + i] = Math.min(v, d[at(i + 1, j)] + 1)
  }
  return d
}
/** The water of a picture in its parts: the sea's wide water (`open`), thin water (rivers, small lakes, straits), the pixels' distance to open water,
 * and the 4-connected bodies of water with whether each is the sea's (a body of at least 5% of all water is the sea). */
function waterParts(image, radius = 3) {
  const {width: w, height: h} = image, water = waterMask(image), ice = iceMask(image)
  const notWater = new Uint8Array(w * h), core = new Uint8Array(w * h), open = new Uint8Array(w * h), thin = new Uint8Array(w * h)
  for (let k = 0; k < w * h; k++) notWater[k] = water[k] ? 0 : 1
  const toLand = distanceTo(notWater, w, h)
  for (let k = 0; k < w * h; k++) core[k] = water[k] && toLand[k] > radius ? 1 : 0
  const toCore = distanceTo(core, w, h)
  for (let k = 0; k < w * h; k++) if (water[k]) { if (toCore[k] <= radius) open[k] = 1; else thin[k] = 1 }
  const toOpen = distanceTo(open, w, h), body_ = new Int32Array(w * h).fill(-1), sizes = [], stack = []
  for (let start = 0; start < w * h; start++) {
    if (!water[start] || body_[start] >= 0) continue
    let n = 0; stack.length = 0; stack.push(start); body_[start] = sizes.length
    while (stack.length) {
      const at = stack.pop(); n++
      const j = (at / w) | 0, i = at - j * w
      for (const next of [j > 0 ? at - w : -1, j < h - 1 ? at + w : -1, j * w + ((i + 1) % w), j * w + ((i + w - 1) % w)]) if (next >= 0 && water[next] && body_[next] < 0) { body_[next] = sizes.length; stack.push(next) }
    }
    sizes.push(n)
  }
  const total = sizes.reduce((s, n) => s + n, 0)
  return {w, h, water, ice, open, thin, toOpen, bodyOf: body_, sizes, isSea: sizes.map(n => n >= .05 * total)}
}
/** Connected pieces of thin water (8-neighbour, bridged across one-pixel gaps), each with its area, the pixels of it at least 6 from open water, its nearest approach to open water, and its fill of its bounding box. */
function thinPieces(parts) {
  const {w, h, thin, toOpen} = parts, grown = new Uint8Array(w * h), seen = new Uint8Array(w * h), out = [], stack = []
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (thin[j * w + i]) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const jj = j + dj; if (jj >= 0 && jj < h) grown[jj * w + ((i + di + w) % w)] = 1 }
  for (let start = 0; start < w * h; start++) {
    if (!thin[start] || seen[start]) continue
    const members = []
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, nearest = 1e9, inland = 0
    stack.length = 0; stack.push(start); seen[start] = 1
    while (stack.length) {
      const at = stack.pop(), j = (at / w) | 0, i = at - j * w
      if (thin[at]) { members.push(at); if (toOpen[at] >= 6) inland++; nearest = Math.min(nearest, toOpen[at]); x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j) }
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const jj = j + dj; if (jj < 0 || jj >= h) continue; const next = jj * w + ((i + di + w) % w); if (grown[next] && !seen[next]) { seen[next] = 1; stack.push(next) } }
    }
    out.push({members, area: members.length, inland, nearest, fill: members.length / Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1))})
  }
  return out
}
/** Per pixel: 0 sea, 1 snow or ice, 2 vegetated, 3 arid, 4 other land (the classes of the dials test, from the same colours). */
function classes(image) {
  const {width: w, height: h, data} = image, water = waterMask(image), ice = iceMask(image), out = new Uint8Array(w * h)
  for (let at = 0; at < w * h; at++) {
    const r = data[at * 4] / 255, g = data[at * 4 + 1] / 255, b = data[at * 4 + 2] / 255
    if (water[at]) out[at] = 0
    else if (ice[at]) out[at] = 1
    else if (g > r + .02 && g > b + .02) out[at] = 2
    else if (r - b >= .12 && .299 * r + .587 * g + .114 * b >= .3) out[at] = 3
    else out[at] = 4
  }
  return out
}
function zonal(images, lo, hi) {
  const n = [0, 0, 0, 0, 0]
  for (const image of images) {
    const cls = classes(image), {width: w, height: h} = image
    for (let j = 0; j < h; j++) { const la = Math.abs(latOf(j, h)); if (la < lo || la >= hi) continue; for (let i = 0; i < w; i++) n[cls[j * w + i]]++ }
  }
  const land = n[1] + n[2] + n[3] + n[4] || 1
  return {land, snow: n[1] / land, veg: n[2] / land, arid: n[3] / land, other: n[4] / land}
}

// ── rivers and lakes ────────────────────────────────────────────────────────────────────────────────────────────────────

const RIVER_WIDTH = 1024
const rivers = SEEDS.map(seed => make(seed))
const waterOf = record => { const image = imageOf(record, RIVER_WIDTH), parts = waterParts(image); return {image, parts, pieces: thinPieces(parts)} }

test('H1 there are rivers and lakes: thin water inland, a few tenths of a percent to a few percent of the land', () => {
  // The Earth (earth-2k.jpg reduced to 1024 wide, the definition above) has thin inland water on 1.8% of its land (its lakes are a further 2.2%).
  // The body must have some that a person can see, at least a sixth of that (.3%), and not so much that the land is marsh, at most four times it (8%).
  const shares = rivers.map(record => {
    const {image, parts} = waterOf(record), land = lumaPlane(image).length - parts.water.reduce((s, v) => s + v, 0) - parts.ice.reduce((s, v) => s + v, 0)
    let inland = 0
    for (let k = 0; k < parts.w * parts.h; k++) if (parts.thin[k] && parts.toOpen[k] >= 6) inland++
    return inland / land
  })
  assert.ok(mean(shares) >= .003, `thin inland water is ${shares.map(x => f(100 * x, 2)).join('%, ')}% of the land (mean ${f(100 * mean(shares), 2)}%): at least .3%`)
  assert.ok(mean(shares) <= .08 && Math.max(...shares) <= .12, `and not a marsh: at most 8% (no seed over 12%)`)
})

test('H2 rivers reach the sea: the long thin waters of a body run to open water, or are lakes', () => {
  // river-like: a thin piece of at least 20 pixels that is long and narrow (fills at most a third of its bounding box) and runs at least 6 pixels from open water.
  // Earth, 1024 wide: 21 river-like pieces, every one touching the sea. A river that ends in a dry basin is real (the Okavango, the Tarim) but rare: at least 80%.
  const pieces = rivers.flatMap(record => waterOf(record).pieces).filter(p => p.area >= 20 && p.inland >= 1 && p.fill <= .35)
  assert.ok(pieces.length >= 5, `the three bodies have at least five river-like waters between them (found ${pieces.length}; the Earth has 21)`)
  const reaching = pieces.filter(p => p.nearest <= 3).length
  assert.ok(reaching / pieces.length >= .8, `${reaching} of ${pieces.length} river-like waters reach open water (at least 80%)`)
})

/** The rim of a set of pixels: the heights asked of the body in a ring `radius` pixels round a pixel (eight points). */
const ringHeights = (record, image, at, radius) => {
  const {width: w, height: h} = image, j = (at / w) | 0, i = at - j * w, out = []
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, jj = j + radius * Math.sin(a), ii = i + radius * Math.cos(a)
    if (jj < 1 || jj > h - 2) continue
    out.push(heightAtLL(record, latOf(jj, h), -180 + (ii + .5) * 360 / w))
  }
  return out
}

test('H3 rivers run in valleys and lakes lie in basins: inland water stands lower than the ground round it, and in the lower half of the land', () => {
  const lower = [], low = []
  for (const record of rivers) {
    const {image, parts} = waterOf(record), {w, h} = parts
    const inland = []
    for (let k = 0; k < w * h; k++) if (parts.thin[k] && parts.toOpen[k] >= 6) inland.push(k)
    const landHeights = []
    for (let j = 8; j < h - 8; j += 8) for (let i = 0; i < w; i += 8) { const at = j * w + i; if (!parts.water[at] && !parts.ice[at]) landHeights.push(heightAtLL(record, latOf(j, h), -180 + (i + .5) * 360 / w)) }
    const median = quantile(landHeights, .5), step = Math.max(1, Math.floor(inland.length / 600))
    for (let n = 0; n < inland.length; n += step) {
      const at = inland[n], j = (at / w) | 0, i = at - j * w, here = heightAtLL(record, latOf(j, h), -180 + (i + .5) * 360 / w), ring = ringHeights(record, image, at, 6)
      if (ring.length < 6) continue
      lower.push(here <= mean(ring) ? 1 : 0)
      low.push(here <= median ? 1 : 0)
    }
  }
  assert.ok(lower.length >= 200, `there is inland water to measure (${lower.length} sampled pixels)`)
  assert.ok(mean(lower) >= .75, `${f(100 * mean(lower), 1)}% of the inland water stands lower than the ground 6 pixels round it (at least 75%: valleys and basins)`)
  assert.ok(mean(low) >= .7, `and ${f(100 * mean(low), 1)}% of it lies below the median height of the land (at least 70%: a river starts in the hills and spends its length in the lowland)`)
})

test('H5 a river is in a valley at any scale it is drawn: where the river is drawn as water by a wide margin, the ground is lower than the ground two degrees round, nine times in ten', async () => {
  // H3 reads the picture, and what it counts depends on the colour of a river's banks as much as on the ground. This reads the field itself where the generator draws a river
  // (bodyRivers.ts waterAt, the river's own weight above .9) and asks the Place tool's height (`heightAt`) there and in a ring of eight points two degrees round: a river that
  // has found its way down the grid's valleys but is drawn a pixel or two aside, across a ridge, is no river in a valley.
  const riv = await optional('bodyRivers.ts'), fieldModule = await optional('bodyField.ts')
  assert.equal(typeof riv.waterAt, 'function', 'bodyRivers.ts exports waterAt')
  const D = Math.PI / 180, unit = (lat, lon) => [Math.cos(lat * D) * Math.cos(lon * D), Math.sin(lat * D), Math.cos(lat * D) * Math.sin(lon * D)]
  let samples = 0, lowerThanRing = 0
  for (const record of rivers) {
    const P = fieldModule.landParamsOf(record), net = riv.riverNetworkOf(record, P), height = (lat, lon) => { const [x, y, z] = unit(lat, lon); return fieldModule.terrain(P, x, y, z, .0004) }
    for (let lat = -70; lat <= 70; lat += .21) for (let lon = -180; lon < 180; lon += .21) {
      const here = height(lat, lon)
      if (here <= .5) continue
      const [x, y, z] = unit(lat, lon)
      riv.waterAt(net, x, y, z, here, .0031)
      if (riv.WATER[0] < .9) continue
      let sum = 0
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; sum += height(lat + 2.1 * Math.sin(a), lon + 2.1 * Math.cos(a) / Math.cos(lat * D)) }
      samples++
      if (here <= sum / 8) lowerThanRing++
    }
  }
  assert.ok(samples >= 500, `there are river pixels to measure (${samples})`)
  assert.ok(lowerThanRing / samples >= .9, `${f(100 * lowerThanRing / samples, 1)}% of the river's own points stand lower than the ground two degrees round (at least 90%: rivers run in valleys)`)
})

test('H4 lakes lie in basins and are not the sea: bodies of water that the sea does not hold sit lower than their shores', () => {
  // Every body of water on land that is not the sea's (the Caspian, the Great Lakes: 59 of them in the Earth at 1024 wide) is a basin: the land within five pixels of it is higher than it is.
  const verdicts = []
  for (const record of rivers) {
    const {image, parts} = waterOf(record), {w, h} = parts, members = new Map()
    for (let k = 0; k < w * h; k++) { const b = parts.bodyOf[k]; if (b >= 0 && !parts.isSea[b] && parts.sizes[b] >= 12) { if (!members.has(b)) members.set(b, []); members.get(b).push(k) } }
    for (const list of members.values()) {
      const lat = latOf((list[0] / w) | 0, h)
      if (Math.abs(lat) > 75) continue
      const every = Math.max(1, Math.floor(list.length / 24)), inside = [], shore = new Set()
      for (let n = 0; n < list.length; n += every) {
        const j = (list[n] / w) | 0, i = list[n] - j * w
        inside.push(heightAtLL(record, latOf(j, h), -180 + (i + .5) * 360 / w))
        for (let dj = -5; dj <= 5; dj += 2) for (let di = -5; di <= 5; di += 2) {
          const jj = j + dj, ii = (i + di + w) % w, k = jj * w + ii
          if (jj >= 0 && jj < h && !parts.water[k] && !parts.ice[k]) shore.add(k)
        }
      }
      if (shore.size < 4) continue
      // a body of water whose own height is under the sea level is the sea, cut off by ice at a pole or by a neck narrower than a pixel: not a lake
      if (mean(inside) <= body.seaHeight(record)) continue
      const ground = [...shore].filter((_, n) => n % Math.max(1, Math.floor(shore.size / 40)) === 0).map(k => { const j = (k / w) | 0, i = k - j * w; return heightAtLL(record, latOf(j, h), -180 + (i + .5) * 360 / w) })
      verdicts.push(mean(inside) <= mean(ground) ? 1 : 0)
    }
  }
  assert.ok(verdicts.length >= 3, `the three bodies have lakes between them (found ${verdicts.length})`)
  assert.ok(mean(verdicts) >= .9, `${f(100 * mean(verdicts), 0)}% of ${verdicts.length} lakes sit lower than the ground within five pixels of them (at least 90%)`)
})

// ── the sea floor ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('B1 bathymetry runs from the coast outward: the sea is lightest at the shore and darkens to a deep floor, as the shader’s shelf expects', () => {
  // Sea luma by distance from the nearest land, in pixels, 512 wide, within 45° of the equator (the ice caps' margin is not the coast's).
  // The Earth (earth-2k.jpg reduced to 512 wide): .20 within 2 px, .14 at 2–4, .087 at 4–8, .061 at 8–16, .055 beyond 16: a shelf over three times as light as the deep.
  // The shader (EARTH_COMMON) reads `shelf = smoothstep(.05, .3, luma)`: a floor at or under about .08 is deep sea, a shore over .2 is shelf.
  const bins = [[1, 2], [2, 4], [4, 8], [8, 16], [16, 64]], sums = bins.map(() => [0, 0])
  for (const seed of SEEDS) {
    const image = imageOf(make(seed), 512), {width: w, height: h} = image, water = waterMask(image), ice = iceMask(image), luma = lumaPlane(image)
    const land = new Uint8Array(w * h)
    for (let k = 0; k < w * h; k++) land[k] = water[k] || ice[k] ? 0 : 1
    const d = distanceTo(land, w, h)
    for (let j = 0; j < h; j++) {
      if (Math.abs(latOf(j, h)) > 45) continue
      for (let i = 0; i < w; i++) {
        const at = j * w + i
        if (!water[at]) continue
        bins.forEach(([lo, hi], b) => { if (d[at] >= lo && d[at] < hi) { sums[b][0] += luma[at]; sums[b][1]++ } })
      }
    }
  }
  const levels = sums.map(([s, n]) => s / Math.max(1, n))
  assert.ok(sums.every(([, n]) => n >= 500), `every distance has sea to measure (${sums.map(([, n]) => n).join(', ')} pixels)`)
  for (let b = 1; b < levels.length; b++) assert.ok(levels[b] < levels[b - 1], `the sea darkens with distance from the coast: ${levels.map(x => f(x)).join(', ')}`)
  // The ratio is held to the lead's gate (w3q-planet-gate.test.mjs `B shelf`, tests/lib/planetMetrics.mjs shelfMeasure), which supersedes the 2.5 this test took from its own reading of the
  // Earth at this width (3.6 times: the 4-pixel box reduction mixes the Earth's bright land into the shore band, so that reading is dear to the land beside it): at 2048 wide, shore pixels
  // within 3 of land over the open sea beyond 48, the Earth is 2.10 and a body must be within .6 to 1.5 of it, 1.26 to 3.16. Here, at 512 wide, a body measured 1.74 the day it was
  // made to the gate and the Earth is held to the same band: not a halo (a shore over three times the deep is one), and not nothing.
  assert.ok(levels[0] >= 1.26 * levels[4] && levels[0] <= 3.16 * levels[4], `the shore is 1.26 to 3.16 times as light as the deep (${f(levels[0])} against ${f(levels[4])}: ${f(levels[0] / levels[4], 2)} times; the gate’s band for the Earth’s 2.10)`)
  assert.ok(levels[4] <= .08, `the deep floor is at or under .08 (${f(levels[4])}; the Earth’s is .055)`)
})

test('B2 the sea reads as sea and the land as land, by the cues the shader reads, wherever the field says so', () => {
  // waterOf in EARTH_COMMON: smoothstep(0.3, 0.56, (b − r)/(b + 0.05)). Read from the shader itself, so a change to it is a change here.
  const match = /smoothstep\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*\(s\.b - s\.r\)\s*\/\s*\(s\.b \+ ([\d.]+)\)\s*\)/.exec(shaders.EARTH_COMMON)
  assert.ok(match, 'waterOf in EARTH_COMMON is smoothstep(a, b, (s.b - s.r) / (s.b + c))')
  const [from, to, soft] = [+match[1], +match[2], +match[3]], cue = (r, b) => (b - r) / (b + soft)
  for (const seed of SEEDS) {
    const record = make(seed), image = imageOf(record, 256), ice = iceMask(image), {width: w, height: h, data} = image
    let sea = 0, seaRead = 0, land = 0, landRead = 0
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const at = j * w + i
      if (ice[at]) continue
      const c = cue(data[at * 4] / 255, data[at * 4 + 2] / 255)
      if (body.isLand(record, heightAtLL(record, latOf(j, h), -180 + (i + .5) * 360 / w))) { land++; if (c <= from) landRead++ } else { sea++; if (c >= to) seaRead++ }
    }
    // coast pixels, rivers and lakes are the exceptions: a tenth of the land may read as water (inland water is at most 8% of it), a twentieth of the sea may not read as full water (the shallows)
    assert.ok(landRead / land >= .9, `seed ${seed}: ${f(100 * landRead / land, 1)}% of the land reads as land (cue at most ${from}); at least 90%`)
    assert.ok(seaRead / sea >= .95, `seed ${seed}: ${f(100 * seaRead / sea, 1)}% of the sea reads as full water (cue at least ${to}); at least 95%`)
  }
})

/** Per coast cell (96 px squares of a 2048-wide picture between 50 degrees north and south with enough shore and shelf in them: 25 sea pixels within 3 of land and 200 at 12 to 48), how
 * much lighter the sea 12 to 48 px from land is than the open sea beyond 60 px: a narrow shelf is a few pixels of turquoise and then the open sea (1 and under), a wide one (Sunda, Patagonia,
 * the Yellow Sea) is light tens of pixels out. The mean luma of the sea in the band over the mean luma of the open sea of the whole picture. */
function outerShelfRatios(image, cell = 96) {
  const {width: w, height: h} = image, luma = lumaPlane(image), water = waterMask(image), ice = iceMask(image), land = new Uint8Array(w * h), sea = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    if (Math.abs(latOf(j, h)) > 50) continue
    for (let i = 0; i < w; i++) { const at = j * w + i; if (water[at]) sea[at] = 1; else if (!ice[at]) land[at] = 1 }
  }
  const d = distanceTo(land, w, h)
  let deepSum = 0, deepN = 0
  for (let at = 0; at < w * h; at++) if (sea[at] && d[at] > 60) { deepSum += luma[at]; deepN++ }
  const deep = deepSum / deepN, ratios = []
  for (let cj = Math.ceil(h * 40 / 180); cj + cell <= h * 140 / 180; cj += cell) for (let ci = 0; ci < w; ci += cell) {
    let sum = 0, band = 0, shore = 0
    for (let j = cj; j < cj + cell; j++) for (let i = ci; i < ci + cell; i++) {
      const at = j * w + i
      if (!sea[at]) continue
      if (d[at] <= 3) shore++
      if (d[at] > 12 && d[at] <= 48) { sum += luma[at]; band++ }
    }
    if (shore >= 25 && band >= 200) ratios.push(sum / band / deep)
  }
  return ratios
}

test('B3 the shelf is not one width: a few gentle coasts have a shelf several times the common one (Sunda, Patagonia, the Yellow Sea), and most coasts do not', () => {
  // The Earth (earth-2k.jpg, 2048 wide, 77 coast cells by this measure): the sea 12 to 48 px from land is lighter than the open sea by 1.3 times and more at 27% of coasts (1.6 and more at
  // 16%), and its median coast is .84 (no outer shelf at all). The generator's was 1.10 at most, at every coast of all four bodies of the gate (default, second seed, fjord, archipelago):
  // the width followed `wide` (the land behind: a slow noise) and the distance it was taken as, the mask's deficit over the mask's slope, was a geometric one, the same on a gentle coast as on
  // a steep one, so the shelf was of one width to within a third. The lead's gate holds the pooled shelf (brightness 1.26 to 3.16, reach 2.3 to 9.1 px, deep tone .12 to .41) and is not weakened.
  for (const seed of SEEDS.slice(0, 2)) {
    const ratios = outerShelfRatios(imageOf(make(seed), 2048)), wide = ratios.filter(x => x >= 1.3).length / ratios.length, median = quantile(ratios, .5)
    assert.ok(ratios.length >= 60, `seed ${seed}: enough coast to measure (${ratios.length} cells)`)
    assert.ok(wide >= .06 && wide <= .4, `seed ${seed}: a few coasts, not most or none, have an outer shelf 1.3 times the open sea's tone: ${f(100 * wide, 1)}% of ${ratios.length} cells (the Earth's 27%; a share of 6 to 40%; the most any coast reached was ${f(Math.max(...ratios), 2)})`)
    assert.ok(median <= 1.15, `seed ${seed}: and most coasts have none: the median coast's outer sea is ${f(median, 2)} times the open sea's tone (the Earth's .84; at most 1.15)`)
  }
})

/** The coherence of the deep sea's structure between a 17-px and a 49-px box (the scales of ridges and trenches, 20 to 60 px): the structure tensor of the band's gradient over 41-px windows,
 * |gxx − gyy, 2 gxy| / (gxx + gyy), weighted by energy: 0 for no direction, 1 for one. Over sea at least 61 px from land, within `lat` of the equator, or everywhere (`everywhere`). */
function bandCoherence(image, {lat = 40, everywhere = false, near = 8, far = 24, win = 20} = {}) {
  const {width: w, height: h} = image, water = waterMask(image), ice = iceMask(image), luma = lumaPlane(image), land = new Uint8Array(w * h)
  for (let at = 0; at < w * h; at++) land[at] = water[at] || ice[at] ? 0 : 1
  const d = everywhere ? null : distanceTo(land, w, h), tone = new Float32Array(w * h)
  for (let at = 0; at < w * h; at++) tone[at] = Math.log(Math.max(luma[at], 1e-3))
  const a = boxBlur(tone, w, h, near), b = boxBlur(tone, w, h, far), band = new Float32Array(w * h), gxx = new Float32Array(w * h), gyy = new Float32Array(w * h), gxy = new Float32Array(w * h), ok = new Uint8Array(w * h)
  for (let at = 0; at < w * h; at++) band[at] = a[at] - b[at]
  for (let j = 1; j < h - 1; j++) for (let i = 0; i < w; i++) {
    const at = j * w + i, gx = (band[j * w + (i + 1) % w] - band[j * w + (i + w - 1) % w]) / 2, gy = (band[at + w] - band[at - w]) / 2
    gxx[at] = gx * gx; gyy[at] = gy * gy; gxy[at] = gx * gy
    ok[at] = Math.abs(latOf(j, h)) <= lat && (everywhere || (water[at] && !ice[at] && d[at] > 48 + win)) ? 1 : 0
  }
  const xx = boxBlur(gxx, w, h, win), yy = boxBlur(gyy, w, h, win), xy = boxBlur(gxy, w, h, win)
  let weighted = 0, energy = 0, n = 0
  for (let at = 0; at < w * h; at++) {
    if (!ok[at]) continue
    const tr = xx[at] + yy[at]
    if (!(tr > 0)) continue
    weighted += Math.hypot(xx[at] - yy[at], 2 * xy[at]) / tr * tr; energy += tr; n++
  }
  return {coherence: energy ? weighted / energy : NaN, n}
}

test('B4 the deep sea has a few long lines (a ridge, fracture zones) in place of part of the mottle: its 20 to 60 px structure has a direction an isotropic field has not', () => {
  // Measured on the picture's luma (log), as the eye reads it. The isotropic yardstick is a field of simplex noise on the sphere at 9 and 22 cycles to the radian (the mottle's own scales,
  // 36 and 15 px at 2048) through the same estimator over the same latitudes: .26 to .36 by its spectrum. The generator's mottle was that field (.25 to .31, the same as noise), and the Earth,
  // a few lines and island chains in a flat navy, is .49 (earth-2k.jpg, 2048 wide, over sea 61 px from land within 40 degrees of the equator).
  const t = noiseTables(), w = 2048, h = 1024, data = new Uint8ClampedArray(w * h * 4)
  const references = [[9], [22], [9, 22], [5, 9, 22]].map(octaves => {
    for (let j = 0; j < h; j++) {
      const lat = latOf(j, h) * D2R, c = Math.cos(lat), y = Math.sin(lat)
      for (let i = 0; i < w; i++) {
        const lon = (-180 + (i + .5) * 360 / w) * D2R, x = c * Math.cos(lon), z = c * Math.sin(lon)
        let v = 0
        for (const o of octaves) v += simplexOf(t, x * o + 3.3, y * o - 1.1, z * o + 7.7)
        const g = Math.max(0, Math.min(255, 20 + 6 * v)), at = (j * w + i) * 4
        data[at] = 5; data[at + 1] = g * .8; data[at + 2] = g; data[at + 3] = 255
      }
    }
    return bandCoherence({width: w, height: h, data}, {everywhere: true}).coherence
  })
  const isotropic = Math.max(...references)
  assert.ok(isotropic > .2 && isotropic < .45, `the isotropic yardstick is a middling coherence (${references.map(x => f(x, 3)).join(', ')})`)
  for (const seed of SEEDS.slice(0, 2)) {
    const {coherence, n} = bandCoherence(imageOf(make(seed), 2048))
    assert.ok(n >= 20000, `seed ${seed}: enough deep sea to measure (${n} pixels)`)
    assert.ok(coherence >= 1.25 * isotropic, `seed ${seed}: the deep sea's 20 to 60 px structure is at least 1.25 times as directional as isotropic noise (${f(coherence, 3)} against ${f(isotropic, 3)} the most of four spectra: ${f(coherence / isotropic, 2)} times; the Earth's .49)`)
    assert.ok(coherence <= .8, `seed ${seed}: and it is a few lines, not a grain of stripes (${f(coherence, 3)}, at most .8)`)
  }
})

// ── biomes by latitude ──────────────────────────────────────────────────────────────────────────────────────────────────

test('L1 the biomes stand in their order by latitude: forest at the equator, desert in the subtropics, forest again in mid-latitudes, snow at the poles', () => {
  // The dominant kind of land (vegetated, arid or other, snow), by band, pooled over the seeds, at the default dials. The Earth, by the same classifiers (earth-2k.jpg):
  // 0–10°: vegetated .70; 18–32°: arid .58 (vegetated .16); 45–58°: vegetated .64; 72–90°: snow .88; snow .00 everywhere under 60°.
  const band = (lo, hi) => zonal(SEEDS.map(seed => imageOf(make(seed), 512)), lo, hi)
  const eq = band(0, 10), sub = band(18, 32), mid = band(45, 58), pole = band(72, 90)
  assert.ok(eq.veg > eq.arid && eq.veg > eq.other, `the equatorial belt is vegetated: vegetated ${f(eq.veg, 2)}, arid ${f(eq.arid, 2)}, other ${f(eq.other, 2)}`)
  assert.ok(sub.arid > sub.veg && sub.arid > sub.other, `the subtropical belt is arid: arid ${f(sub.arid, 2)}, vegetated ${f(sub.veg, 2)}, other ${f(sub.other, 2)}`)
  assert.ok(mid.veg > mid.arid && mid.veg > mid.other, `the mid-latitudes are vegetated: vegetated ${f(mid.veg, 2)}, arid ${f(mid.arid, 2)}, other ${f(mid.other, 2)}`)
  assert.ok(pole.snow >= .5, `the poles are snow: ${f(pole.snow, 2)} of the land beyond 72° (at least .5; the Earth’s is .88)`)
  const snow = [[0, 20], [20, 40], [40, 60], [60, 75], [75, 90]].map(([lo, hi]) => band(lo, hi).snow)
  for (let k = 1; k < snow.length; k++) assert.ok(snow[k] >= snow[k - 1] - .005, `snow does not fall toward the pole: ${snow.map(x => f(x, 3)).join(', ')}`)
  assert.ok(snow[0] <= .02, `and there is next to none within 20° of the equator (${f(snow[0], 3)})`)
})

test('L2 there is snow above the snow line, in the tropics and the temperate zones, and none below it', () => {
  // A cool world (warmth .4, no polar caps) of high relief, so snow is the mountains' and not the poles'. For each 10° band within 50°, the snow that stands
  // (at least 15 pixels, pooled over the seeds) is above the snow line: its low tenth is higher than the median height of the land in that band that is not snow.
  const bands = [[0, 10], [10, 20], [20, 30], [30, 40], [40, 50]], tally = bands.map(() => ({snow: [], rest: []}))
  for (const seed of SEEDS) {
    const record = make(seed, {climate: {warmth: .4, ice_caps: 0}, landmass: {relief: 1}}), image = imageOf(record, 512), cls = classes(image), {width: w, height: h} = image
    for (let j = 0; j < h; j++) {
      const la = Math.abs(latOf(j, h)), b = bands.findIndex(([lo, hi]) => la >= lo && la < hi)
      if (b < 0) continue
      for (let i = 0; i < w; i += 1) {
        const c = cls[j * w + i]
        if (c === 0 || (c !== 1 && (i + j) % 6)) continue // every snow pixel, one land pixel in six
        ;(c === 1 ? tally[b].snow : tally[b].rest).push(heightAtLL(record, latOf(j, h), -180 + (i + .5) * 360 / w))
      }
    }
  }
  const withSnow = tally.filter(t => t.snow.length >= 15)
  assert.ok(withSnow.length >= 2, `snow stands in at least two of the five bands under 50° (it stands in ${withSnow.length}: ${tally.map(t => t.snow.length).join(', ')} pixels)`)
  for (const t of withSnow) assert.ok(quantile(t.snow, .1) >= quantile(t.rest, .5), `in a band the snow’s low tenth (${f(quantile(t.snow, .1))}) is at least the median of the land that is not snow (${f(quantile(t.rest, .5))})`)
})

// ── ice ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('C1 the ice caps are sea ice and land ice: ice stands over both the sea and the land of a body (its margin and its absence at 0 are the dials’ I1 and I2)', () => {
  // Ice over the sea is sea ice and ice over the land is a sheet: at the default dials, pooled over four seeds, each is at least a tenth of all the ice beyond 55°.
  let sea = 0, land = 0
  for (const seed of [...SEEDS, 99]) {
    const record = make(seed), image = imageOf(record, 512), ice = iceMask(image), {width: w, height: h} = image
    for (let j = 0; j < h; j++) {
      if (Math.abs(latOf(j, h)) < 55) continue
      for (let i = 0; i < w; i++) if (ice[j * w + i]) { if (body.isLand(record, heightAtLL(record, latOf(j, h), -180 + (i + .5) * 360 / w))) land++; else sea++ }
    }
  }
  assert.ok(sea + land >= 2000, `there is ice to measure (${sea + land} pixels)`)
  assert.ok(sea / (sea + land) >= .1 && land / (sea + land) >= .1, `sea ice is ${f(100 * sea / (sea + land), 0)}% and land ice ${f(100 * land / (sea + land), 0)}% of the ice (each at least 10%)`)
})

test('C2 ice is as crisp as a pixel: a close tile at the margin of the sea ice has ice and water and next to nothing between, not a haze over a hundred pixels', async () => {
  // The margin's softness is set in pixels (bodySurface.ts iceOver): a ramp that is right for a 2048 base is a hundred pixels of translucent white in a tile at zoom 8, a fog between the
  // ice and the sea that the Place tool's land test (the sea) and the eye (neither ice nor water) disagree about. Found at the 256-wide picture: a sea pixel beside an ice one, near the cap.
  const tiles = await optional('bodyTiles.ts'), z = 8, n = 2 ** z, record = make(SEEDS[0]), small = imageOf(record, 256), ice0 = iceMask(small), water0 = waterMask(small), w = small.width
  let found
  for (let j = 8; j < small.height / 2 && !found; j++) for (let i = 1; i < w - 1; i++) {
    const at = j * w + i, lat = latOf(j, small.height)
    if (lat < 50 || !ice0[at] || !water0[at + 1] || !water0[at + 2]) continue
    found = {lat, lon: -180 + (i + 1.5) * 360 / w}
    break
  }
  assert.ok(found, 'the northern cap has a margin on the sea at this body')
  const x = Math.floor((found.lon + 180) / 360 * n), y = Math.floor(n * (1 - Math.asinh(Math.tan(found.lat * Math.PI / 180)) / Math.PI) / 2)
  let ice = 0, water = 0, other = 0
  for (const dx of [0, 1]) for (const dy of [0, 1]) {
    const tile = tiles.bodyTile(record, z, x + dx - 1, y + dy - 1), i2 = iceMask(tile), w2 = waterMask(tile)
    for (let k = 0; k < tile.width * tile.height; k++) { if (i2[k]) ice++; else if (w2[k]) water++; else other++ }
  }
  const total = ice + water + other
  assert.ok(ice / total >= .1 && water / total >= .1, `the four tiles round the margin hold ice and water (${f(100 * ice / total, 0)}% ice, ${f(100 * water / total, 0)}% water)`)
  assert.ok(other / total <= .02, `and next to nothing that is neither: ${f(100 * other / total, 2)}% of the pixels (at most 2%)`)
})

// ── ice sheets ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What the ice at a 1024-wide picture of a body is made of, beyond 60° either way: for every ice pixel (every second one), whether the field says land or sea under it, how far it is
 * from a pixel that is not ice, and how far from the field's land (sea ice only); with the luma's residual about its 4-pixel blur and the blue over red of its colour. */
function iceFacts(record, width = 1024) {
  const image = imageOf(record, width), {width: w, height: h} = image, ice = iceMask(image), luma = lumaPlane(image), blur = boxBlur(luma, w, h, 4)
  const notIce = new Uint8Array(w * h), landField = new Uint8Array(w * h)
  for (let k = 0; k < w * h; k++) notIce[k] = ice[k] ? 0 : 1
  const rows = []
  for (let j = 0; j < h; j += 2) {
    const lat = latOf(j, h); if (Math.abs(lat) < 60) continue
    for (let i = 0; i < w; i += 2) { const p = body.unitOf(lat, -180 + (i + .5) * 360 / w); landField[j * w + i] = body.isLand(record, body.heightAt(record, p.x, p.y, p.z)) ? 1 : 0 }
    rows.push(j)
  }
  const fromOpen = distanceTo(notIce, w, h), fromLand = distanceTo(landField, w, h), out = []
  for (const j of rows) for (let i = 0; i < w; i += 2) {
    const at = j * w + i; if (!ice[at]) continue
    out.push({land: !!landField[at], open: fromOpen[at], fromLand: fromLand[at], res: Math.abs(luma[at] - blur[at]), blue: (image.data[at * 4 + 2] - image.data[at * 4]) / 255, luma: luma[at]})
  }
  return out
}
const avg = (rows, pick) => rows.length ? mean(rows.map(pick)) : NaN

test('I1 an ice sheet is one white with the sea ice beside it: no ghost of the land under the ice, in tone or in blue', () => {
  // The land under a cap showed through as a greyer shape (the land ice [.94, .955, .965] and the sea ice [.925, .952, .975] are two whites, and a sheet is shaded by its relief while sea ice is not).
  // In the interior of the ice (15 pixels or more from open ground or water, at 1024 wide) the land ice and the sea ice differ in blue over red by at most .015 and in luma by at most .012 (they
  // were .025 and .010 at 2048: the blue is the outline).
  const rows = SEEDS.flatMap(seed => iceFacts(make(seed))).filter(r => r.open >= 15), land = rows.filter(r => r.land), sea = rows.filter(r => !r.land)
  assert.ok(land.length >= 400 && sea.length >= 3000, `there is interior ice of both kinds (${land.length} land, ${sea.length} sea)`)
  assert.ok(Math.abs(avg(land, r => r.blue) - avg(sea, r => r.blue)) <= .015, `land ice is ${f(avg(land, r => r.blue), 3)} blue over red inside, sea ice ${f(avg(sea, r => r.blue), 3)}: at most .015 apart`)
  assert.ok(Math.abs(avg(land, r => r.luma) - avg(sea, r => r.luma)) <= .012, `and ${f(avg(land, r => r.luma), 3)} against ${f(avg(sea, r => r.luma), 3)} in luma: at most .012 apart`)
})

test('I2 a sheet is bluer where it is thick: the interior of the land ice is bluer than its margin', () => {
  // The Earth's sheets are nearly neutral (blue .008 inside, .022 at the edge); the lead asked for a slightly bluer shade in the thick interior. The first sheet was .027 inside and .026 at the margin.
  const rows = SEEDS.flatMap(seed => iceFacts(make(seed))).filter(r => r.land), inner = rows.filter(r => r.open >= 15), rim = rows.filter(r => r.open <= 3)
  assert.ok(inner.length >= 400 && rim.length >= 100, `there is a margin and an interior (${rim.length}, ${inner.length})`)
  assert.ok(avg(inner, r => r.blue) >= avg(rim, r => r.blue) + .02, `the interior is ${f(avg(inner, r => r.blue), 3)} blue over red, the margin ${f(avg(rim, r => r.blue), 3)}: at least .02 bluer`)
})

test('I3 an ice sheet has a little texture at scale, and the sea ice is ridged where it meets land, and no texture is a noise', () => {
  // Sastrugi and crevasse fields; pressure ridges against a coast. The mean |luma - its 4-pixel blur| over the interior: land ice at least .008, sea ice at least .006 (they were .0099 and .0049
  // at 2048; the Earth's sheets .0050), and neither over .03 (a texture, not a noise). Sea ice within 30 pixels of land has at least 1.4 times the residual of sea ice 60 or more from it.
  const rows = SEEDS.flatMap(seed => iceFacts(make(seed))), landInner = rows.filter(r => r.land && r.open >= 15), seaInner = rows.filter(r => !r.land && r.open >= 15)
  assert.ok(avg(landInner, r => r.res) >= .008 && avg(landInner, r => r.res) <= .03, `land ice interior texture ${f(avg(landInner, r => r.res), 4)} (between .008 and .03)`)
  assert.ok(avg(seaInner, r => r.res) >= .006 && avg(seaInner, r => r.res) <= .03, `sea ice interior texture ${f(avg(seaInner, r => r.res), 4)} (between .006 and .03)`)
  const near = rows.filter(r => !r.land && r.open >= 4 && r.fromLand <= 30), far = rows.filter(r => !r.land && r.open >= 4 && r.fromLand >= 60)
  assert.ok(near.length >= 300 && far.length >= 300, `there is sea ice near land and far from it (${near.length}, ${far.length})`)
  assert.ok(avg(near, r => r.res) >= 1.4 * avg(far, r => r.res), `sea ice against land is ridged: texture ${f(avg(near, r => r.res), 4)} within 30 px of it, ${f(avg(far, r => r.res), 4)} beyond 60 (at least 1.4 times)`)
})

/** East-west over north-south gradient energy of a picture's luma, pooled over the pixels of its interior (`inside(lat, lon)`) in a latitude band, on equal steps of the sphere (0.0025 radian,
 * about 0.14 degree): the longitude step widens by 1 / cos(latitude), so that the energies are of equal distances and a texture stretched by the equirect shows. */
function sphereGradients(image, lat0, lat1, inside) {
  const {width: w, height: h} = image, luma = lumaPlane(image), step = .0025 / (Math.PI / 180)
  const at = (lat, lon) => { const u = ((lon + 180) / 360) * w - .5, v = (90 - lat) / 180 * h - .5, i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0
    const px = (i, j) => luma[Math.max(0, Math.min(h - 1, j)) * w + (((i % w) + w) % w)]
    return (px(i0, j0) * (1 - fu) + px(i0 + 1, j0) * fu) * (1 - fv) + (px(i0, j0 + 1) * (1 - fu) + px(i0 + 1, j0 + 1) * fu) * fv }
  let ew = 0, ns = 0, n = 0
  for (let lat = lat0 + .5; lat < lat1; lat += 1) for (let lon = -180; lon < 180; lon += 3) {
    const dLon = step / Math.cos(lat * Math.PI / 180)
    if (!inside(lat, lon) || !inside(lat + 2 * step, lon) || !inside(lat - 2 * step, lon)) continue
    ew += Math.abs(at(lat, lon + dLon) - at(lat, lon - dLon)); ns += Math.abs(at(lat + step, lon) - at(lat - step, lon)); n++
  }
  return {ratio: ew / Math.max(ns, 1e-12), n}
}

test('I4 the ice has no direction of its own near the pole: from 68 to 84 degrees the texture of the ice is as strong east-west as it is north-south', () => {
  // The first sastrugi were stretched along the parallels by scaling the sphere's y, which near a pole is a stripe along the circles of latitude: concentric rings round the cap (the lead's
  // system view). Pooled over 2048-wide pictures of three bodies, in the interior of the ice (10 or more pixels from open ground or water), 68 to 84 degrees, on equal steps of the sphere, the
  // east-west over north-south energy of the luma was .82 to .98 (.82 and .93 at 68 to 84 on the second body). The estimator is first shown fair: a picture of an isotropic field (simplex noise at
  // 30 cycles to the radian, in the same equirect) reads within .06 of one; the ice then within .1 of it.
  const tables = noiseTables(), size = 1024, synthetic = {width: size * 2, height: size, data: new Uint8ClampedArray(size * size * 8)}
  for (let j = 0; j < size; j++) for (let i = 0; i < 2 * size; i++) {
    const p = body.unitOf(90 - (j + .5) * 180 / size, -180 + (i + .5) * 360 / (2 * size)), v = Math.round(127 + 100 * simplexOf(tables, p.x * 30, p.y * 30, p.z * 30))
    synthetic.data.set([v, v, v, 255], (j * 2 * size + i) * 4)
  }
  const fair = sphereGradients(synthetic, 68, 84, () => true).ratio
  assert.ok(Math.abs(fair - 1) <= .06, `an isotropic picture reads ${f(fair, 3)} east-west over north-south (within .06 of one)`)
  for (const seed of SEEDS) {
    const image = imageOf(make(seed), 2048), {width: w, height: h} = image, ice = iceMask(image), notIce = new Uint8Array(w * h)
    for (let k = 0; k < w * h; k++) notIce[k] = ice[k] ? 0 : 1
    const away = distanceTo(notIce, w, h), inside = (lat, lon) => { const i = Math.min(w - 1, Math.max(0, Math.floor((lon + 180) / 360 * w))), j = Math.min(h - 1, Math.max(0, Math.floor((90 - lat) / 180 * h))); return away[j * w + i] >= 10 }
    const {ratio, n} = sphereGradients(image, 68, 84, inside)
    assert.ok(n >= 600, `there is ice to measure at seed ${seed} (${n} samples)`)
    assert.ok(Math.abs(ratio - 1) <= .1, `seed ${seed}: the ice at 68 to 84 degrees reads ${f(ratio, 3)} east-west over north-south (one within .1)`)
  }
})

// ── the ground at the finest tile ──────────────────────────────────────────────────────────────────────────────────────────

/** The places are those of the lead's round 2: a mountain belt, a green lowland, a desert with a river, each in the zoom-8 tile that holds it, on the default body. */

test('Z1 steep ground is bare rock: at the finest tile the ground on a steep face is greyer than the ground on a flat, whatever grows on it', async () => {
  // Lighting darkens and lightens a slope but does not change how coloured it is; the rock under a thin cover shows on the faces too steep to hold it. In the zoom-8 tile of a mountain belt
  // (the default body at 44.2 S, 77.6 W), the steepest quarter of the land is less saturated than the flattest quarter by at least a twentieth (saturation is (max - min) / max of the colour).
  const tiles = await optional('bodyTiles.ts'), record = make(SEEDS[0]), at = {lat: -44.2, lon: -77.6}
  const z = 8, n = 2 ** z, x = Math.floor((at.lon + 180) / 360 * n), y = Math.floor(yOfLat(z, at.lat)), tile = tiles.bodyTile(record, z, x, y), {width: w} = tile
  const samples = []
  for (let j = 2; j < TILE_PX - 2; j += 2) for (let i = 2; i < TILE_PX - 2; i += 2) {
    const o = (j * w + i) * 4, r = tile.data[o], g = tile.data[o + 1], b = tile.data[o + 2]
    if (b > 1.3 * r) continue // water
    const lat = latOfY(z, y + (j + .5) / TILE_PX), lon = lonOfX(z, x + (i + .5) / TILE_PX), dl = 5e-5 * 180 / Math.PI, dlo = dl / Math.cos(lat * Math.PI / 180)
    const slope = Math.hypot(heightAtLL(record, lat, lon + dlo) - heightAtLL(record, lat, lon - dlo), heightAtLL(record, lat + dl, lon) - heightAtLL(record, lat - dl, lon)) / (2 * 5e-5)
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    samples.push({slope, sat: mx ? (mx - mn) / mx : 0})
  }
  assert.ok(samples.length >= 8000, `there is land to measure (${samples.length} pixels)`)
  samples.sort((a, b) => a.slope - b.slope)
  const q = Math.floor(samples.length / 4), flat = mean(samples.slice(0, q).map(s => s.sat)), steep = mean(samples.slice(-q).map(s => s.sat))
  assert.ok(flat - steep >= .05, `the steepest quarter of the land is ${f(steep, 3)} saturated, the flattest ${f(flat, 3)}: the steep faces are at least .05 greyer`)
})

test('Z2 the ground is patched at the scale of fields: in a lowland tile at zoom 8 the colour changes between ten pixels and two, patch on patch', async () => {
  // Forest and clearing, crops and scrub: a tile a hundred and forty kilometres across holds cover that changes over a few kilometres. The measure is the root-mean-square of the greenness
  // (g - r, in levels of 255) with its 12-pixel box blur taken from its 2-pixel one, over the tile. The lowland (the default body at 11 S, 92.4 W) was 1.9; a mountain face 2.9.
  const tiles = await optional('bodyTiles.ts'), record = make(SEEDS[0]), z = 8, n = 2 ** z
  const tile = tiles.bodyTile(record, z, Math.floor((-92.4 + 180) / 360 * n), Math.floor(yOfLat(z, -11))), w = tile.width, h = tile.height, green = new Float32Array(w * h)
  for (let k = 0; k < w * h; k++) green[k] = tile.data[k * 4 + 1] - tile.data[k * 4]
  const a = boxBlur(green, w, h, 2), b = boxBlur(green, w, h, 12)
  let s2 = 0
  for (let k = 0; k < w * h; k++) s2 += (a[k] - b[k]) ** 2
  const rms = Math.sqrt(s2 / (w * h))
  assert.ok(rms >= 3, `the greenness changes by ${f(rms, 2)} levels between 2 and 12 pixels (at least 3)`)
})

// ── relief shading ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** How well the picture's fine shading follows the ground's slope: the correlation, over land pixels, of the luma with its own broad tone taken out (box blur, radius 4)
 * against the slope of the field east and north (`heightAt` a quarter pixel either side); the greater of the two directions' strength, the length of the pair of correlations. */
function shadingFollowsSlope(record, image, at) {
  const {width: w, height: h} = image, luma = lumaPlane(image), tone = boxBlur(luma, w, h, 4), water = waterMask(image), ice = iceMask(image)
  const hp = [], ge = [], gn = []
  for (let j = 6; j < h - 6; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i
    if (water[k] || ice[k]) continue
    const {lat, lon, dlat, dlon} = at(i, j)
    if (Math.abs(lat) > 60) continue
    if (!body.isLand(record, heightAtLL(record, lat, lon))) continue
    const east = (heightAtLL(record, lat, lon + dlon / 4) - heightAtLL(record, lat, lon - dlon / 4)) / (dlon / 2 * Math.cos(lat * D2R)), north = (heightAtLL(record, lat + dlat / 4, lon) - heightAtLL(record, lat - dlat / 4, lon)) / (dlat / 2)
    hp.push(luma[k] - tone[k]); ge.push(east); gn.push(north)
  }
  const corr = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let k = 0; k < a.length; k++) { sab += (a[k] - ma) * (b[k] - mb); saa += (a[k] - ma) ** 2; sbb += (b[k] - mb) ** 2 } return sab / Math.sqrt(saa * sbb || 1) }
  return {n: hp.length, r: Math.hypot(corr(hp, ge), corr(hp, gn))}
}

test('R1 relief is shaded from the height: the picture’s fine shading follows the slope of the ground', () => {
  // A picture shaded with no regard to the ground has correlation about 0 (±.01 over this many pixels); a shaded relief has the slope in its light. Version 1 measures
  // .32 to .39 at relief 1 (20 Oct, this function). Held to .15, fifteen times the noise: room for the biomes’ own colours and for rivers laid over the shading.
  for (const seed of SEEDS) {
    const record = make(seed, {landmass: {relief: 1}}), image = imageOf(record, 512), {width: w, height: h} = image
    const {n, r} = shadingFollowsSlope(record, image, (i, j) => ({lat: latOf(j, h), lon: -180 + (i + .5) * 360 / w, dlat: 180 / h, dlon: 360 / w}))
    assert.ok(n >= 5000, `seed ${seed}: there is land to measure (${n} pixels)`)
    assert.ok(r >= .15, `seed ${seed}: the shading follows the slope with strength ${f(r, 3)} over ${n} land pixels (at least .15)`)
  }
})

test('R2 a close tile is shaded by its own slope, not by its base’s: the same measure holds on a z7 tile of high relief', async () => {
  const tiles = await optional('bodyTiles.ts')
  assert.equal(typeof tiles.bodyTile, 'function', 'bodyTiles.ts exports bodyTile(record, z, x, y, look?)')
  const record = make(SEEDS[0], {landmass: {relief: 1, continents: 1.2}}), z = 7, n = 2 ** z
  // a tile whose centre is land (by the field), at a middle latitude; the first such tile scanning from the equator's north
  let found = null
  for (let y = Math.floor(n * .35); y < Math.floor(n * .45) && !found; y++) for (let x = 0; x < n && !found; x++) {
    if (body.isLand(record, heightAtLL(record, latOfY(z, y + .5), lonOfX(z, x + .5)))) found = {x, y}
  }
  assert.ok(found, 'the body has land at a middle latitude')
  const tile = tiles.bodyTile(record, z, found.x, found.y), {x, y} = found
  const {n: count, r} = shadingFollowsSlope(record, tile, (i, j) => ({
    lat: latOfY(z, y + (j + .5) / TILE_PX), lon: lonOfX(z, x + (i + .5) / TILE_PX),
    dlat: Math.abs(latOfY(z, y + (j + 1) / TILE_PX) - latOfY(z, y + j / TILE_PX)), dlon: 360 / (2 ** z * TILE_PX),
  }))
  assert.ok(count >= 5000, `the tile has land to measure (${count} pixels)`)
  assert.ok(r >= .15, `the tile’s shading follows the slope with strength ${f(r, 3)} (at least .15)`)
})
