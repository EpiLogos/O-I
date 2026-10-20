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
const {lonOfX, latOfY, TILE_PX} = await import(new URL('tilemath.ts', globe).href)
const shaders = await import(new URL('shaders.ts', globe).href)
/** A module this ticket adds: `{}` until it exists, so the test that needs it fails on an assertion, not on an import. */
async function optional(name) {
  try { return await import(new URL(name, globe).href) } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return {}
    throw error
  }
}

const ENFORCE = process.env.W3Q_GATE === 'enforce'
/** Tests that are red until generator version 2 lands carry this (the lead's gate does the same); W3Q_GATE=enforce makes them real. */
const pending = ENFORCE ? {} : {todo: 'T-PROCEDURAL-BODY: red until generator v2 lands (W3Q_GATE=enforce runs it as a test)'}

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

test('H1 there are rivers and lakes: thin water inland, a few tenths of a percent to a few percent of the land', pending, () => {
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

test('H2 rivers reach the sea: the long thin waters of a body run to open water, or are lakes', pending, () => {
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

test('H3 rivers run in valleys and lakes lie in basins: inland water stands lower than the ground round it, and in the lower half of the land', pending, () => {
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

test('H4 lakes lie in basins and are not the sea: bodies of water that the sea does not hold sit lower than their shores', () => {
  // Every body of water that is not the sea's (the Caspian, the Great Lakes: 59 of them in the Earth at 1024 wide) is a basin: the land within five pixels of it is higher than it is.
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
  assert.ok(levels[0] >= 2.5 * levels[4], `the shore is at least 2.5 times as light as the deep (${f(levels[0])} against ${f(levels[4])}; the Earth’s is 3.6 times)`)
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

// ── biomes by latitude ──────────────────────────────────────────────────────────────────────────────────────────────────

test('L1 the biomes stand in their order by latitude: forest at the equator, desert in the subtropics, forest again in mid-latitudes, snow at the poles', pending, () => {
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

test('L2 there is snow above the snow line, in the tropics and the temperate zones, and none below it', pending, () => {
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

test('R2 a close tile is shaded by its own slope, not by its base’s: the same measure holds on a z7 tile of high relief', pending, async () => {
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
