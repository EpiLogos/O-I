// T-PROCEDURAL-BODY, Lane A: every dial of the World's Body page does what the manual (§17.2 "Build a planet") and the ticket's dial
// table say it does, measured on the picture. Ticket §5 table: sea level, continents, relief, coast, warmth and moisture, ice caps,
// atmosphere and clouds, axial tilt.
//
// How the dials are measured. The body is drawn 512 wide (the coast at 256 and 1024 as well) for at least three seeds, and a dial's
// effect is the AVERAGE over the seeds, so one lucky noise sample decides nothing. A dial moves while the others stay at the World
// design's defaults (sea 50 %, continents 1.7, relief 55 %, smooth, warmth 58 %, moisture 60 %, ice caps 30 %, air 60 %, clouds 35 %,
// tilt 18°) unless the test says it isolates the dial (no ice caps when it counts land, no clouds when it reads colour).
// Thresholds come from first principles or from the Earth: where a number is the Earth's, it was measured on public/textures/earth-2k.jpg
// with the classifiers below (20 Oct 2026) and is named in a comment; where it is not, the reasoning stands beside it.
//
// The classifiers read colour the way the shader does (shaders.ts EARTH_COMMON): sea is blue well above red; ice and snow are bright and
// unsaturated (the lead's `iceMask`); vegetation is green over red and blue; arid land is tan, red over blue and not dark.
//
// Run the red state: W3Q_GATE=enforce node --experimental-strip-types --test tests/w3q-gen-dials.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {waterMask, iceMask, coastMeasure, iceEdge} from './lib/planetMetrics.mjs'

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

const body = await import(new URL('../src/projections/atlas/src/globe/body.ts', import.meta.url).href)

const ENFORCE = process.env.W3Q_GATE === 'enforce'
/** Tests that are red until generator version 2 lands carry this (the lead's gate does the same); W3Q_GATE=enforce makes them real. */
const pending = ENFORCE ? {} : {todo: 'T-PROCEDURAL-BODY: red until generator v2 lands (W3Q_GATE=enforce runs it as a test)'}

// ── fixtures and measures ───────────────────────────────────────────────────────────────────────────────────────────────

const DIALS = {landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3}, sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}}
/** The gate's seeds (default, seedB, fjord): three bodies that are not one body seen three times. */
const SEEDS = [20261018, 7, 42]
const make = (seed, change = {}) => ({
  body_ref: 'body:dials', seed, generator: {id: 'fbm-sphere', version: 2},
  landmass: {...DIALS.landmass, ...change.landmass}, climate: {...DIALS.climate, ...change.climate}, sky: {...DIALS.sky, ...change.sky},
})
const cache = new Map()
const imageOf = (record, width = 512) => { const key = `${JSON.stringify(record)}@${width}`; if (!cache.has(key)) cache.set(key, body.bodyImage(record, width)); return cache.get(key) }
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length
/** The mean over the seeds of a measure of the body drawn with `change`. */
const over = (change, measure, width = 512, seeds = SEEDS) => mean(seeds.map(seed => measure(imageOf(make(seed, change), width), make(seed, change))))
const latOf = (j, h) => 90 - (j + .5) * 180 / h
const f = (x, digits = 3) => (typeof x === 'number' ? +x.toFixed(digits) : x)
const NO_ICE = {climate: {ice_caps: 0}}

/** Per pixel: 0 sea, 1 snow or ice, 2 vegetated, 3 arid, 4 other land (rock, tundra, scrub). */
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
/** The shares of land that are snow, vegetated, arid and other, between |lat| `lo` and `hi`, pooled over images (counts, not means of shares). */
function zonal(images, lo, hi) {
  const n = [0, 0, 0, 0, 0]
  for (const image of images) {
    const cls = classes(image), {width: w, height: h} = image
    for (let j = 0; j < h; j++) { const la = Math.abs(latOf(j, h)); if (la < lo || la >= hi) continue; for (let i = 0; i < w; i++) n[cls[j * w + i]]++ }
  }
  const land = n[1] + n[2] + n[3] + n[4] || 1
  return {land, snow: n[1] / land, veg: n[2] / land, arid: n[3] / land, other: n[4] / land}
}
const zonalOf = (change, lo, hi, width = 512) => zonal(SEEDS.map(seed => imageOf(make(seed, change), width)), lo, hi)

/** Connected pieces of land (not water, not ice; 4-neighbour, wrapping in longitude), largest first, in pixels. */
function lands(image) {
  const {width: w, height: h} = image, water = waterMask(image), ice = iceMask(image), seen = new Uint8Array(w * h), sizes = []
  const stack = []
  for (let start = 0; start < w * h; start++) {
    if (water[start] || ice[start] || seen[start]) continue
    let size = 0
    stack.length = 0; stack.push(start); seen[start] = 1
    while (stack.length) {
      const at = stack.pop(); size++
      const j = (at / w) | 0, i = at - j * w
      for (const next of [j > 0 ? at - w : -1, j < h - 1 ? at + w : -1, j * w + ((i + 1) % w), j * w + ((i + w - 1) % w)]) {
        if (next >= 0 && !seen[next] && !water[next] && !ice[next]) { seen[next] = 1; stack.push(next) }
      }
    }
    sizes.push(size)
  }
  return sizes.sort((a, b) => b - a)
}
/** The lands that hold at least a hundredth of all land: the continents and the large islands, not the specks. */
const majorLands = image => { const sizes = lands(image), land = sizes.reduce((s, x) => s + x, 0); return sizes.filter(size => size >= land / 100) }

/** The latitude (degrees from the equator) of the ice margin: per column, where three ice pixels in a row first stand going poleward from 25°, north and south
 * together, and the median over the columns (a snow-capped range in a few columns does not move the median; the cap in most columns does). NaN where fewer than a
 * quarter of the columns have any. */
function iceMargin(image) {
  const {width: w, height: h} = image, ice = iceMask(image), found = []
  const row25n = Math.floor(65 * h / 180), row25s = h - 1 - row25n
  for (let i = 0; i < w; i++) {
    for (let j = row25n; j >= 2; j--) if (ice[j * w + i] && ice[(j - 1) * w + i] && ice[(j - 2) * w + i]) { found.push(latOf(j, h)); break }
    for (let j = row25s; j <= h - 3; j++) if (ice[j * w + i] && ice[(j + 1) * w + i] && ice[(j + 2) * w + i]) { found.push(-latOf(j, h)); break }
  }
  if (found.length < w / 4) return NaN
  const sorted = found.map(Math.abs).sort((x, y) => x - y)
  return sorted[Math.floor(sorted.length / 2)]
}
/** Land and sea shares by the area of each cell, of a body drawn with no ice. */
function areaShare(image, wanted) {
  const {width: w, height: h} = image, water = waterMask(image)
  let on = 0, all = 0
  for (let j = 0; j < h; j++) { const area = Math.cos(latOf(j, h) * Math.PI / 180); for (let i = 0; i < w; i++) { all += area; if (!!water[j * w + i] === wanted) on += area } }
  return on / all
}

// ── sea level ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('S1 sea level: the land falls steadily as the sea rises, with no dead stretch and no cliff', () => {
  const levels = [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1]
  const share = levels.map(sea => mean(SEEDS.map(seed => body.landShare(make(seed, {landmass: {sea_level: sea}}), 128))))
  for (let k = 1; k < share.length; k++) assert.ok(share[k] < share[k - 1], `land share falls from sea ${levels[k - 1]} to ${levels[k]}: ${f(share[k - 1])} then ${f(share[k])}`)
  // "steadily": the whole range is covered in ten steps, so the average step is (land at 0 − land at 1) / 10; no step may be a fifth of
  // that (a stretch of the dial that does nothing) nor more than two and a half times it (a cliff the dial jumps over)
  const step = (share[0] - share[10]) / 10
  for (let k = 1; k < share.length; k++) {
    const drop = share[k - 1] - share[k]
    assert.ok(drop >= .2 * step && drop <= 2.5 * step, `the step from sea ${levels[k - 1]} to ${levels[k]} takes ${f(drop)} of the land; the average step is ${f(step)}, so between ${f(.2 * step)} and ${f(2.5 * step)}`)
  }
})

test('S2 sea level: at 0 the world is land and at 1 it is sea', pending, () => {
  // "a world of land": the sea is under a tenth of the surface, so its water is lakes and straits; "a world of sea": land is under a twentieth, islands
  const dry = SEEDS.map(seed => body.landShare(make(seed, {landmass: {sea_level: 0}}), 128)), wet = SEEDS.map(seed => body.landShare(make(seed, {landmass: {sea_level: 1}}), 128))
  assert.ok(mean(dry) >= .9 && Math.min(...dry) >= .85, `sea level 0 gives land ${dry.map(x => f(x, 2)).join(', ')}: a world of land is at least 90% land (no seed under 85%)`)
  assert.ok(mean(wet) <= .05 && Math.max(...wet) <= .1, `sea level 1 gives land ${wet.map(x => f(x, 2)).join(', ')}: a world of sea is at most 5% land (no seed over 10%)`)
})

test('S3 sea level: the default is Earth-like, near the Earth’s 29 % of land (22 to 40 %)', pending, () => {
  // the ticket's band (§5): the Earth's land is 29.2 % of its surface; the dial's default (50 %) must give a world like it
  const shares = SEEDS.map(seed => body.landShare(make(seed), 128))
  assert.ok(mean(shares) >= .22 && mean(shares) <= .4, `the default dials give ${shares.map(x => f(x, 2)).join(', ')} land (mean ${f(mean(shares), 2)}): between .22 and .40`)
  assert.ok(Math.min(...shares) >= .18 && Math.max(...shares) <= .45, 'and no seed is far from it (between .18 and .45)')
})

// ── continents ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('C1 continents: one supercontinent near 0.6, six or more lands near 3.6, and more at every step between', pending, () => {
  const lo = SEEDS.map(seed => majorLands(imageOf(make(seed, {...NO_ICE, landmass: {continents: .6}})))), mid = SEEDS.map(seed => majorLands(imageOf(make(seed, {...NO_ICE, landmass: {continents: 1.7}})))),
    hi = SEEDS.map(seed => majorLands(imageOf(make(seed, {...NO_ICE, landmass: {continents: 3.6}}))))
  const count = lands => mean(lands.map(l => l.length))
  assert.ok(count(lo) < count(mid) && count(mid) < count(hi), `lands (each of at least 1% of all land) rise with the dial: ${f(count(lo), 1)} at .6, ${f(count(mid), 1)} at 1.7, ${f(count(hi), 1)} at 3.6`)
  // one supercontinent: the Earth's biggest piece (Afro-Eurasia) holds .60 of its land; a supercontinent holds clearly more than that
  const share = lands => mean(lands.map(l => l[0] / l.reduce((s, x) => s + x, 0)))
  assert.ok(share(lo) >= .75, `at .6 the biggest land holds ${f(share(lo), 2)} of the land (at least .75; the Earth’s is .60)`)
  assert.ok(count(hi) >= 6, `at 3.6 there are ${f(count(hi), 1)} lands on average (at least six)`)
})

test('C2 continents: the dial arranges the land and does not add or take it', () => {
  // the amount of land is the sea level's: moving continents from .6 to 3.6 may not move the land share by more than a tenth of the surface
  const share = continents => mean(SEEDS.map(seed => body.landShare(make(seed, {landmass: {continents}}), 128)))
  assert.ok(Math.abs(share(.6) - share(3.6)) <= .1, `land share ${f(share(.6), 2)} at .6 continents and ${f(share(3.6), 2)} at 3.6: within a tenth of the surface`)
})

// ── relief ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Height of the land (above the sea, in the field's own 0–1) on a grid of `n` × `n/2` cells of the sphere, with each cell's distance from the coast in cells. */
function relief(record, n = 256) {
  const cols = n, rows = n / 2, high = new Float32Array(cols * rows), land = new Uint8Array(cols * rows)
  const sea = body.seaHeight(record)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const p = body.unitOf(latOf(j, rows), -180 + (i + .5) * 360 / cols), height = body.heightAt(record, p.x, p.y, p.z)
    high[j * cols + i] = height - sea; land[j * cols + i] = body.isLand(record, height) ? 1 : 0
  }
  // distance from the coast in cells, by two passes (the chessboard distance to the nearest sea cell)
  const d = new Float32Array(cols * rows).fill(1e9)
  for (let at = 0; at < cols * rows; at++) if (!land[at]) d[at] = 0
  const index = (i, j) => j * cols + ((i % cols) + cols) % cols
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let v = d[j * cols + i]
    if (j > 0) v = Math.min(v, d[index(i - 1, j - 1)] + 1, d[index(i, j - 1)] + 1, d[index(i + 1, j - 1)] + 1)
    d[j * cols + i] = Math.min(v, d[index(i - 1, j)] + 1)
  }
  for (let j = rows - 1; j >= 0; j--) for (let i = cols - 1; i >= 0; i--) {
    let v = d[j * cols + i]
    if (j < rows - 1) v = Math.min(v, d[index(i - 1, j + 1)] + 1, d[index(i, j + 1)] + 1, d[index(i + 1, j + 1)] + 1)
    d[j * cols + i] = Math.min(v, d[index(i + 1, j)] + 1)
  }
  return {cols, rows, high, land, distance: d}
}
const quantile = (xs, q) => { const s = Float64Array.from(xs).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }
/** The spread of the land's height, from the 5th to the 95th percentile of what stands above the sea. */
const spread = r => { const h = []; for (let at = 0; at < r.high.length; at++) if (r.land[at]) h.push(r.high[at]); return quantile(h, .95) - quantile(h, .05) }

test('R1 relief: plains at 0, ranges at 1: the land’s spread of height grows with the dial and at 0 the land is flat', pending, () => {
  const spreadAt = value => mean(SEEDS.map(seed => spread(relief(make(seed, {landmass: {relief: value}})))))
  const flat = spreadAt(0), mid = spreadAt(.5), high = spreadAt(1)
  assert.ok(flat < mid && mid < high, `the spread of the land’s height rises with relief: ${f(flat)} at 0, ${f(mid)} at .5, ${f(high)} at 1`)
  // "flat plains": 95% of the land at relief 0 lies within a twentieth of the field's whole height range (0–1) of its median; at relief 1 it is at least four times that
  assert.ok(flat <= .1, `at relief 0 the land’s 5th to 95th percentile spread is ${f(flat)} of the height range: at most .1 (flat)`)
  assert.ok(high >= 4 * flat, `and at relief 1 it is at least four times that (${f(high)} against ${f(flat)})`)
})

/** How thin the high ground is: the highest tenth of the land, and what share of it is gone when the mask is opened by a 5×5 square (eroded by two cells and grown back).
 * A round mass of high ground is many cells across and survives the opening; a crest, a ridge or a range is a few cells wide and does not. 0 is all mass, 1 all crest. */
function thinness(record, n = 256) {
  const r = relief(record, n), {cols, rows} = r, heights = []
  for (let at = 0; at < cols * rows; at++) if (r.land[at]) heights.push(r.high[at])
  const cut = quantile(heights, .9), top = new Uint8Array(cols * rows)
  let area = 0
  for (let at = 0; at < cols * rows; at++) if (r.land[at] && r.high[at] >= cut) { top[at] = 1; area++ }
  const R = 2, eroded = new Uint8Array(cols * rows), opened = new Uint8Array(cols * rows)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let whole = 1
    for (let dj = -R; dj <= R && whole; dj++) for (let di = -R; di <= R; di++) { const jj = j + dj; if (jj < 0 || jj >= rows || !top[jj * cols + ((i + di + cols) % cols)]) { whole = 0; break } }
    eroded[j * cols + i] = whole
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (eroded[j * cols + i]) for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) { const jj = j + dj; if (jj >= 0 && jj < rows) opened[jj * cols + ((i + di + cols) % cols)] = 1 }
  let kept = 0
  for (let at = 0; at < cols * rows; at++) if (top[at] && opened[at]) kept++
  return 1 - kept / area
}

test('R2 relief: the mountains are ranges, not peaks: the high ground at relief 1 is thin, crests and ridges and not masses', pending, () => {
  // "ranges of ridged mountains". Measured on the field (20 Oct, scratch): the highest tenth of the land of version 1, whose noise is smooth value noise, is gone by .09 to .26 when
  // opened by a 5×5 square (its high ground is masses); ridged noise's is gone by .88 to .97 (its high ground is crests). The bound is .6, over four seeds. (The first form of this
  // test took the elongation of the pieces of high ground: version 1 gave 1.9 and ridged noise 2.2 to 3.4, too close to hold; this one separates them by .6.)
  const t = mean([...SEEDS, 99].map(seed => thinness(make(seed, {landmass: {relief: 1}}))))
  assert.ok(t >= .6, `${f(100 * t, 0)}% of the highest tenth of the land at relief 1 is crest and ridge (gone when opened by a 5×5 square): at least 60%`)
})

test('R3 relief: the mountains stand in a continent’s interior and the coast is lowland', () => {
  // at relief 1: the highest land (95th percentile of what stands above the sea) more than 5 cells from any coast is at least 3 times the highest land within 2 cells of the coast
  const high = (r, lo, hi) => { const h = []; for (let at = 0; at < r.high.length; at++) if (r.land[at] && r.distance[at] >= lo && r.distance[at] < hi) h.push(r.high[at]); return h.length >= 30 ? quantile(h, .95) : NaN }
  const ratios = SEEDS.map(seed => { const r = relief(make(seed, {landmass: {relief: 1, continents: 1.2}})); return high(r, 6, 1e9) / high(r, 0, 3) })
  assert.ok(ratios.every(Number.isFinite), 'every seed has an interior to measure')
  assert.ok(mean(ratios) >= 3, `interior peaks against coastal ground at relief 1: ${ratios.map(x => f(x, 1)).join(', ')} (mean at least 3)`)
})

test('R4 relief: the share of rock and snow rises with it, and a world without relief has no snow below the polar caps', pending, () => {
  // a cool world with no ice caps, so snow is the mountains’ and not the poles’; the band is within 45° of the equator
  const at = value => { const images = SEEDS.map(seed => imageOf(make(seed, {...NO_ICE, climate: {ice_caps: 0, warmth: .4}, landmass: {relief: value}}))), z = zonal(images, 0, 45); return z }
  const flat = at(0), high = at(1)
  assert.ok(high.snow >= flat.snow + .01, `snow on the land within 45° of the equator: ${f(flat.snow, 4)} at relief 0, ${f(high.snow, 4)} at 1 (at least one point of the land more)`)
  assert.ok(flat.snow <= .005, `a flat world has next to no snow there (${f(flat.snow, 4)})`)
  assert.ok(high.other > flat.other, `rock and bare ground (land that is neither green, tan nor snow) rises: ${f(flat.other, 3)} at relief 0, ${f(high.other, 3)} at 1`)
})

// ── coast ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const COASTS = ['smooth', 'fjord', 'archipelago']
/** Shoreline in units of the picture's width (boundary pixels of land, over the width), and per land pixel. */
const shore = (image) => { const c = coastMeasure(image); return {length: c.coastDensity * image.height, perLand: c.coastDensity / Math.max(c.landShare, 1e-9), pieces: c.pieces} }
const coastOf = (coast, width) => { const out = SEEDS.map(seed => shore(imageOf(make(seed, {...NO_ICE, landmass: {coast}}), width))); return {length: mean(out.map(o => o.length)), perLand: mean(out.map(o => o.perLand)), pieces: mean(out.map(o => o.pieces))} }

test('K1 coast: smooth, fjord and archipelago differ in shoreline per land pixel, at every scale', () => {
  for (const width of [256, 512, 1024]) {
    const [smooth, fjord, archipelago] = COASTS.map(coast => coastOf(coast, width))
    assert.ok(fjord.perLand >= 1.3 * smooth.perLand, `${width} wide: a fjord coast has ${f(fjord.perLand, 4)} shoreline per land pixel, a smooth one ${f(smooth.perLand, 4)}: at least 1.3 times`)
    assert.ok(archipelago.perLand >= 1.3 * smooth.perLand, `${width} wide: an archipelago has ${f(archipelago.perLand, 4)} against ${f(smooth.perLand, 4)}: at least 1.3 times`)
  }
})

test('K2 coast: an archipelago has at least twice as many separate lands as a smooth coast', () => {
  const smooth = coastOf('smooth', 512), archipelago = coastOf('archipelago', 512)
  assert.ok(archipelago.pieces >= 2 * smooth.pieces, `separate lands: ${f(archipelago.pieces, 1)} for an archipelago, ${f(smooth.pieces, 1)} for a smooth coast (at least twice)`)
})

test('K3 coast: each coast is fractal, with more shoreline to find the finer you look', pending, () => {
  // The Earth's coast, measured here at 256, 512, 1024 and 2048 wide (the image box-reduced), has boundary length/width 4.41, 5.17, 6.27, 7.43:
  // 1.42 times as long at four times the resolution, a fractal dimension of 1.25 (Mandelbrot’s Britain is 1.25). A coast that is a smooth curve
  // gains nothing; a band-limited noise gains until its finest octave and then stops. The fjord and the archipelago must gain at least 1.3 times
  // from 256 to 1024 wide (dimension 1.19 and up), the smooth coast at least 1.15 (1.10), and the smooth coast must gain less than the fjord.
  const growth = coast => coastOf(coast, 1024).length / coastOf(coast, 256).length
  const g = Object.fromEntries(COASTS.map(coast => [coast, growth(coast)]))
  assert.ok(g.fjord >= 1.3, `a fjord coast is ${f(g.fjord, 2)} times as long measured at 1024 as at 256 wide (at least 1.3; the Earth’s is 1.42)`)
  assert.ok(g.archipelago >= 1.3, `an archipelago’s coast is ${f(g.archipelago, 2)} times as long (at least 1.3)`)
  assert.ok(g.smooth >= 1.15, `a smooth coast is ${f(g.smooth, 2)} times as long (at least 1.15)`)
  assert.ok(g.smooth < g.fjord, `and a smooth coast gains less than a fjord (${f(g.smooth, 2)} against ${f(g.fjord, 2)})`)
})

// ── warmth and moisture ─────────────────────────────────────────────────────────────────────────────────────────────────

test('W1 climate: moisture follows the latitude bands: a wet equator, dry subtropics, wet mid-latitudes', pending, () => {
  // The Earth (earth-2k.jpg, the classifiers above, over these very bands): vegetated land is .70 of the land within 10° of the equator, .16 at 18 to 32°,
  // .64 at 45 to 58°; arid land is .08, .58, .13. The generated world is held to 40% of the Earth’s differences (.2 of the .5, .15 of the .45).
  const eq = zonalOf({}, 0, 10), sub = zonalOf({}, 18, 32), mid = zonalOf({}, 45, 58)
  assert.ok(eq.land > 2000 && sub.land > 2000 && mid.land > 2000, `every band has land to measure (${eq.land}, ${sub.land}, ${mid.land} pixels)`)
  assert.ok(eq.veg >= sub.veg + .2, `vegetated land: equator ${f(eq.veg, 2)}, subtropics ${f(sub.veg, 2)}: the equator is at least .2 wetter (the Earth’s is .5 wetter)`)
  assert.ok(mid.veg >= sub.veg + .2, `mid-latitudes ${f(mid.veg, 2)} against subtropics ${f(sub.veg, 2)}: at least .2 wetter (the Earth’s is .55 wetter)`)
  assert.ok(sub.arid >= eq.arid + .15 && sub.arid >= mid.arid + .15, `arid land: ${f(eq.arid, 2)} at the equator, ${f(sub.arid, 2)} in the subtropics, ${f(mid.arid, 2)} in mid-latitudes: the deserts are in the subtropics`)
})

test('W2 climate: the moisture dial makes the land green: vegetated land rises with it, and at 0 the world is dry', () => {
  const veg = moisture => zonalOf({climate: {moisture}}, 0, 60).veg
  const dry = veg(0), mid = veg(.5), wet = veg(1)
  assert.ok(dry < mid && mid < wet, `vegetated land within 60° of the equator: ${f(dry, 2)} at moisture 0, ${f(mid, 2)} at .5, ${f(wet, 2)} at 1`)
  assert.ok(wet - dry >= .3, `from the driest to the wettest world the vegetated share moves by ${f(wet - dry, 2)} (at least .3)`)
})

test('W3 climate: the warmth dial pushes the cold back: the ice and snow retreat poleward as it rises, and a hot world has less snow than a cold one', pending, () => {
  const margin = warmth => over({climate: {warmth, ice_caps: .5}}, iceMargin), snow = warmth => zonalOf({climate: {warmth, ice_caps: .5}}, 0, 90).snow
  const [cold, mid, hot] = [0, .5, 1].map(margin)
  assert.ok([cold, mid, hot].every(Number.isFinite), 'every world has an ice margin to measure')
  assert.ok(cold + 4 <= mid && mid + 4 <= hot, `the ice margin sits at ${f(cold, 1)}° at warmth 0, ${f(mid, 1)}° at .5, ${f(hot, 1)}° at 1: each at least 4° nearer the pole (the caps are “in step with warmth”)`)
  const [sCold, sMid, sHot] = [0, .5, 1].map(snow)
  assert.ok(sCold > sMid && sMid > sHot, `and the share of land under snow falls: ${f(sCold, 3)}, ${f(sMid, 3)}, ${f(sHot, 3)}`)
})

test('W4 climate: the four corners of the climate look like themselves: hot and wet is green, hot and dry is tan, cold is white', pending, () => {
  const hotWet = zonalOf({climate: {warmth: .85, moisture: .9, ice_caps: .3}}, 0, 60), hotDry = zonalOf({climate: {warmth: .85, moisture: .1, ice_caps: .3}}, 0, 60),
    cold = zonalOf({climate: {warmth: .15, moisture: .5, ice_caps: .3}}, 0, 60)
  assert.ok(hotWet.veg >= hotDry.veg + .15 && hotWet.veg >= cold.veg + .15, `hot and wet is the greenest: vegetated land ${f(hotWet.veg, 2)} against ${f(hotDry.veg, 2)} (hot, dry) and ${f(cold.veg, 2)} (cold)`)
  assert.ok(hotDry.arid >= hotWet.arid + .15 && hotDry.arid >= cold.arid + .15, `hot and dry is the tannest: arid land ${f(hotDry.arid, 2)} against ${f(hotWet.arid, 2)} and ${f(cold.arid, 2)}`)
  assert.ok(cold.snow >= hotWet.snow + .1 && cold.snow >= hotDry.snow + .1, `cold is the whitest: snow ${f(cold.snow, 2)} against ${f(hotWet.snow, 2)} and ${f(hotDry.snow, 2)} (within 60° of the equator)`)
})

// ── ice caps ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('I1 ice caps: none at 0, and the ice reaches further toward the equator as the dial rises (about 60–80° at the default, past 50° at 1)', () => {
  // Earth: the median ice margin (this function, on earth-2k.jpg) stands at 71°, from 66° to 78° over the middle four fifths of its columns; the default dial (30 %) is Earth-like.
  const poles = image => { const {width: w, height: h} = image, ice = iceMask(image); let n = 0, all = 0; for (let j = 0; j < h; j++) { if (Math.abs(latOf(j, h)) < 70) continue; for (let i = 0; i < w; i++) { all++; n += ice[j * w + i] } } return n / all }
  const share0 = over({climate: {ice_caps: 0}}, poles)
  assert.ok(share0 <= .05, `with no ice caps ${f(share0, 3)} of the pixels beyond 70° are ice (at most .05: none, allowing a few bright pixels)`)
  const levels = [.25, .5, .75, 1], margins = levels.map(ice_caps => over({climate: {ice_caps}}, iceMargin))
  assert.ok(margins.every(Number.isFinite), `every dial setting has a margin to measure (${margins.map(x => f(x, 1)).join(', ')})`)
  for (let k = 1; k < margins.length; k++) assert.ok(margins[k] < margins[k - 1] - 2, `the ice margin moves toward the equator by at least 2° from ice caps ${levels[k - 1]} to ${levels[k]} (${f(margins[k - 1], 1)}° then ${f(margins[k], 1)}°)`)
  const dflt = over({}, iceMargin)
  assert.ok(dflt >= 58 && dflt <= 80, `at the default 30% the margin stands at ${f(dflt, 1)}° (between 58° and 80°: the Earth’s is 71°)`)
  assert.ok(margins[3] <= 50, `at 100% it stands at ${f(margins[3], 1)}° (at most 50°)`)
})

test('I2 ice caps: the margin is ragged, not a latitude ruler: its spread across longitudes is the Earth’s, 2 to 15°', pending, () => {
  // the lead's gate band for the ice edge at 2048 wide, the same number here at 512: .4 to 3 times the Earth's 5.1° (planetMetrics assessPlanet 'ice edge spread')
  const spreads = SEEDS.map(seed => iceEdge(imageOf(make(seed), 512)).spreadDeg)
  assert.ok(mean(spreads) >= 2.04 && mean(spreads) <= 15.3, `the ice edge wanders ${spreads.map(x => f(x, 2)).join('°, ')}° (mean ${f(mean(spreads), 2)}°) across the longitudes: between 2.04° and 15.3° (the Earth’s is 5.1°)`)
  assert.ok(spreads.every(x => x >= 1), 'and no seed is a ruler (each at least 1°)')
})

// ── atmosphere and clouds ───────────────────────────────────────────────────────────────────────────────────────────────

test('A1 atmosphere: the air is none at 0, the Earth’s at the default 60 %, and thicker above it', () => {
  const air = atmosphere => body.airOf(make(SEEDS[0], {sky: {atmosphere}}))
  assert.equal(air(0), 0, 'no atmosphere, no air')
  assert.ok(Math.abs(air(.6) - 1) <= .05, `the default 60% is the Earth’s own air (1.0): ${f(air(.6), 3)}`)
  const steps = [0, .2, .4, .6, .8, 1].map(air)
  for (let k = 1; k < steps.length; k++) assert.ok(steps[k] > steps[k - 1], `the air thickens with the dial: ${steps.map(x => f(x, 2)).join(', ')}`)
})

test('A2 atmosphere: the air shows at the limb, in step with `airOf`: nothing at 0, more as the dial rises, in proportion to the air', () => {
  // the disc seen whole: the glow in the ring just beyond the rim (radius 1 to 1.12 of the disc) is the air at the limb
  const glow = atmosphere => {
    const size = 96, disc = body.bodyDisc(make(SEEDS[0], {sky: {atmosphere}}), size)
    let sum = 0, n = 0
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const r = Math.hypot(-1 + (i + .5) * 2 / size, 1 - (j + .5) * 2 / size)
      if (r >= 1 && r <= 1.12) { sum += disc.data[(j * size + i) * 4 + 3] / 255; n++ }
    }
    return n ? sum / n : 0
  }
  assert.equal(glow(0), 0, 'no atmosphere, no glow at the limb')
  const dials = [.3, .6, 1], glows = dials.map(glow), ratios = dials.map((a, k) => glows[k] / body.airOf(make(SEEDS[0], {sky: {atmosphere: a}})))
  assert.ok(glows[0] > 0 && glows[0] < glows[1] && glows[1] < glows[2], `the limb brightens with the dial: ${glows.map(x => f(x, 4)).join(', ')}`)
  assert.ok(ratios.every(r => Math.abs(r / mean(ratios) - 1) <= .25), `and in proportion to airOf (glow per unit of air ${ratios.map(x => f(x, 4)).join(', ')}: within 25% of their mean)`)
})

/** Cover of a cloud mask 0–1 over the whole sphere, by the area of each cell. */
function cover(mask, lo = 0, hi = 90) {
  const {width: w, height: h, data} = mask
  let sum = 0, area = 0
  for (let j = 0; j < h; j++) {
    const la = Math.abs(latOf(j, h)); if (la < lo || la >= hi) continue
    const a = Math.cos(latOf(j, h) * Math.PI / 180)
    for (let i = 0; i < w; i++) { sum += a * data[(j * w + i) * 4] / 255; area += a }
  }
  return sum / area
}
const cloudsOf = (clouds, seed) => body.cloudImage(make(seed, {sky: {clouds}}), 256)

test('A3 clouds: the cover is none at 0 and rises with the dial, and a cloudy world is at least half cloud', pending, () => {
  const dials = [0, .25, .5, .75, 1], covers = dials.map(c => mean(SEEDS.map(seed => cover(cloudsOf(c, seed)))))
  assert.ok(covers[0] <= .001, `no clouds at 0 (cover ${f(covers[0], 4)})`)
  for (let k = 1; k < covers.length; k++) assert.ok(covers[k] > covers[k - 1] + .02, `the cover rises with the dial: ${covers.map(x => f(x, 3)).join(', ')} (each step by at least .02)`)
  assert.ok(covers[4] >= .5, `at 100% the sky is ${f(covers[4], 2)} cloud: at least half (the Earth’s real cover is .67)`)
})

test('A4 clouds: the bands follow latitude: cloudier at the equator and in the storm tracks than in the subtropics', pending, () => {
  // Earth, zonal-mean cloud fraction (ISCCP, about .65 to .70 at the equator, .50 to .55 at 25°, .75 to .85 at 60°): the equator is about .12 above the subtropics
  // and mid-latitudes about .25 above. The generated cover is held to .08 above, each, averaged over the seeds (at a dial of .5).
  const band = (lo, hi) => mean(SEEDS.map(seed => cover(cloudsOf(.5, seed), lo, hi)))
  const eq = band(0, 8), sub = band(18, 32), mid = band(45, 65)
  assert.ok(eq >= sub + .08, `cover ${f(eq, 3)} at the equator, ${f(sub, 3)} in the subtropics: the equator is at least .08 cloudier`)
  assert.ok(mid >= sub + .08, `cover ${f(mid, 3)} in mid-latitudes against ${f(sub, 3)} in the subtropics: at least .08 cloudier`)
})

// ── axial tilt ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('T1 axial tilt: the Sun’s declination is the tilt’s: none for an upright body, the tilt itself at the solstice, and the Earth’s tilt gives the Earth’s year', () => {
  // body.ts bodySunDir: sin δ = sin τ · sin λ. (Also asserted in w3b-your-system.test.mjs; this row of the dial table has its test here.)
  const sun = {x: 1, y: 0, z: 0}, declination = (tilt, lon) => Math.asin(body.bodySunDir(sun, lon, tilt).y) * 180 / Math.PI
  for (const lon of [0, 45, 90, 180, 270]) assert.ok(Math.abs(declination(0, lon)) < 1e-9, `an upright body has no seasons (declination ${f(declination(0, lon), 6)} at sun longitude ${lon}°)`)
  for (const tilt of [10, 23.4393, 45]) {
    assert.ok(Math.abs(declination(tilt, 90) - tilt) < 1e-6, `at the solstice (sun longitude 90°) the declination is the tilt: ${f(declination(tilt, 90), 4)}° for ${tilt}°`)
    assert.ok(Math.abs(declination(tilt, 270) + tilt) < 1e-6, `and its opposite at 270°`)
    assert.ok(Math.abs(declination(tilt, 0)) < 1e-6 && Math.abs(declination(tilt, 180)) < 1e-6, 'and none at the equinoxes')
  }
})

test('T2 axial tilt: the disc is seen with its axis leaned by the tilt: the picture at 0° and at 45° are not the same picture', () => {
  assert.notEqual(Buffer.from(body.bodyDisc(make(SEEDS[0], {sky: {axial_tilt_deg: 0}}), 64).data).toString('base64'), Buffer.from(body.bodyDisc(make(SEEDS[0], {sky: {axial_tilt_deg: 45}}), 64).data).toString('base64'))
})

// ── the dials are separate ──────────────────────────────────────────────────────────────────────────────────────────────

test('X1 the climate and the sky never move the coast: the land the Place tool reads is the same at every warmth, moisture, ice, air, cloud and tilt', () => {
  // The land is the landmass dials' and the seed's. A location placed on a shore must not drift into the sea because the person made the world warmer.
  const points = Array.from({length: 300}, (_, k) => { const y = 1 - 2 * (k + .5) / 300, r = Math.sqrt(1 - y * y), a = k * 2.399963229728653; return [r * Math.cos(a), y, r * Math.sin(a)] })
  const field = record => points.map(([x, y, z]) => body.heightAt(record, x, y, z))
  const reference = field(make(SEEDS[0]))
  for (const change of [{climate: {warmth: 0}}, {climate: {warmth: 1}}, {climate: {moisture: 0}}, {climate: {moisture: 1}}, {climate: {ice_caps: 0}}, {climate: {ice_caps: 1}},
    {sky: {atmosphere: 0}}, {sky: {clouds: 1}}, {sky: {axial_tilt_deg: 45}}]) {
    assert.deepEqual(field(make(SEEDS[0], change)), reference, `heightAt after ${JSON.stringify(change)}`)
    assert.equal(body.landShare(make(SEEDS[0], change), 64), body.landShare(make(SEEDS[0]), 64), `landShare after ${JSON.stringify(change)}`)
  }
})

test('X2 relief and coast shape the land and do not add or take it: the land share stays within a tenth of the surface as they move', () => {
  const share = change => mean(SEEDS.map(seed => body.landShare(make(seed, change), 128)))
  const reliefs = [0, .5, 1].map(relief => share({landmass: {relief}})), coasts = COASTS.map(coast => share({landmass: {coast}}))
  assert.ok(Math.max(...reliefs) - Math.min(...reliefs) <= .1, `land share by relief 0, .5, 1: ${reliefs.map(x => f(x, 2)).join(', ')} (within .1)`)
  assert.ok(Math.max(...coasts) - Math.min(...coasts) <= .1, `land share by coast smooth, fjord, archipelago: ${coasts.map(x => f(x, 2)).join(', ')} (within .1)`)
})
