// T-PROCEDURAL-BODY, Lane A: the land test the Place tool reads is the land the globe draws. `heightAt`, `isLand` and `shoreOf`
// (globe/body.ts) decide where a location sits and where it is drawn when its own point is sea; `bodyImage` and `bodyTile` are what
// the person sees. Ticket §5: "the base image, a tile and the Place tool's land test are one function"; they must agree at sampled
// points, 97 % or better, which keeps the Place tool honest: a place never stands in the sea on the picture, nor is drawn "on the
// shore" over dry land.
//
// Channels: scripted. The generator is the shell's own TypeScript run in memory; the records are FIXTURES shaped to the owner's contract.
// Pixels are read as the shader reads them: sea is blue well above red (shaders.ts EARTH_COMMON waterOf), through the lead's own
// `waterMask` (tests/lib/planetMetrics.mjs).
//
// What is kept out of the comparison, and why: a pixel that reads as ice (sea ice hides the water, land ice the ground; the
// field cannot be asked what is under it); and, for the share of land, a record with no ice caps (so nothing hides anything).
// What is not kept out: a river or a lake. A location beside a lake is on land; the picture shows water at that pixel; that costs
// the Place tool a fraction of a percent, which the 97 % allows for (ticket §5: inland water is at most a few percent of land).
//
// Run the red state: W3Q_GATE=enforce node --experimental-strip-types --test tests/w3q-gen-places-consistency.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'
import {waterMask, iceMask} from './lib/planetMetrics.mjs'

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
/** A module this ticket adds: `{}` until it exists, so the test that needs it fails on an assertion, not on an import. */
async function optional(name) {
  try { return await import(new URL(name, globe).href) } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return {}
    throw error
  }
}

const ENFORCE = process.env.W3Q_GATE === 'enforce'
const pending = ENFORCE ? {} : {todo: 'T-PROCEDURAL-BODY: red until generator v2 lands (W3Q_GATE=enforce runs it as a test)'}

const DIALS = {landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3}, sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}}
const base = (seed, change = {}, version = 2) => ({
  body_ref: 'body:places', seed, generator: {id: 'fbm-sphere', version},
  landmass: {...DIALS.landmass, ...change.landmass}, climate: {...DIALS.climate, ...change.climate}, sky: {...DIALS.sky, ...change.sky},
})
// The gate's four bodies (tests/w3q-planet-gate.test.mjs BODIES).
const BODIES = {
  default: base(20261018), seedB: base(7),
  fjord: base(42, {landmass: {coast: 'fjord', continents: 2.6, relief: .8}}),
  archipelago: base(99, {landmass: {coast: 'archipelago', sea_level: .6}}),
}
/** A small fixed generator of numbers in [0, 1) (an LCG): the sample points are chosen the same way on every run, by this test, not by the generator under test. */
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) }
/** `n` points evenly spread over the sphere's area (latitude by the arcsine of a uniform number), as {lat, lon} in degrees. */
function scatter(n, seed, maxLat = 90) {
  const next = lcg(seed), out = []
  while (out.length < n) {
    const lat = Math.asin(2 * next() - 1) * 180 / Math.PI, lon = -180 + 360 * next()
    if (Math.abs(lat) <= maxLat) out.push({lat, lon})
  }
  return out
}
const landAt = (record, lat, lon) => { const p = body.unitOf(lat, lon); return body.isLand(record, body.heightAt(record, p.x, p.y, p.z)) }
const cache = new Map()
const imageOf = (record, width) => { const key = `${JSON.stringify(record)}@${width}`; if (!cache.has(key)) cache.set(key, body.bodyImage(record, width)); return cache.get(key) }

// ── the base image ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('P1 the Place tool’s land test agrees with the base image at 97 % of sampled points, on every body of the gate', () => {
  for (const [name, record] of Object.entries(BODIES)) {
    const image = imageOf(record, 1024), water = waterMask(image), ice = iceMask(image), {width: w, height: h} = image
    let agree = 0, counted = 0
    for (const {lat, lon} of scatter(4000, 17)) {
      const i = Math.min(w - 1, Math.floor((lon + 180) / 360 * w)), j = Math.min(h - 1, Math.floor((90 - lat) / 180 * h)), at = j * w + i
      if (ice[at]) continue
      counted++
      if (landAt(record, lat, lon) === !water[at]) agree++
    }
    assert.ok(counted >= 3000, `${name}: enough of the sample is not under ice (${counted} of 4000)`)
    assert.ok(agree / counted >= .97, `${name}: heightAt/isLand and the picture agree at ${(100 * agree / counted).toFixed(2)}% of ${counted} points (at least 97%)`)
  }
})

test('P2 the field a person places on is the version of the record: a version 2 body is not asked its land by the version 1 field', pending, () => {
  // `heightAt` and `isLand` take the record and so must read its generator version, as `bodyImage` does (ticket §5 "Version policy").
  const v1 = base(20261018, {}, 1), v2 = base(20261018, {}, 2), points = scatter(300, 5)
  const same = points.filter(({lat, lon}) => landAt(v1, lat, lon) === landAt(v2, lat, lon)).length
  // two unrelated bodies at about 30 % land agree on about 58 % of the sphere (.3² + .7²); a body drawn by the same field would agree on all of it
  assert.ok(same / points.length <= .8, `version 2 and version 1 agree on ${(100 * same / points.length).toFixed(0)}% of the sphere’s land and sea: a version 2 body still answers with the version 1 field`)
})

test('P3 the land share the device reads is the land the picture shows: `landShare` and the image agree within three points', () => {
  // No ice caps and no clouds: nothing hides the ground. `landShare` weights each cell by its area; so does this.
  for (const [name, record] of Object.entries(BODIES)) {
    const clear = {...record, climate: {...record.climate, ice_caps: 0}}, image = imageOf(clear, 512), water = waterMask(image), {width: w, height: h} = image
    let land = 0, all = 0
    for (let j = 0; j < h; j++) {
      const area = Math.cos((90 - (j + .5) * 180 / h) * Math.PI / 180)
      for (let i = 0; i < w; i++) { all += area; if (!water[j * w + i]) land += area }
    }
    const shown = land / all, read = body.landShare(clear, 256)
    assert.ok(Math.abs(shown - read) <= .03, `${name}: the picture shows ${(100 * shown).toFixed(1)}% land, landShare says ${(100 * read).toFixed(1)}%`)
  }
})

test('P4 a location on sea is drawn on land: `shoreOf` hands back a point that the picture shows as land, within 20°, and never moves a point that is on land', () => {
  for (const [name, record] of Object.entries(BODIES)) {
    const image = imageOf(record, 1024), water = waterMask(image), ice = iceMask(image), {width: w, height: h} = image
    const pixel = (lat, lon) => { const i = Math.min(w - 1, Math.floor((((lon + 540) % 360) / 360) * w)), j = Math.min(h - 1, Math.floor((90 - lat) / 180 * h)); return j * w + i }
    let shores = 0, onLand = 0, shown = 0, kept = 0
    for (const {lat, lon} of scatter(160, 9, 70)) {
      const out = body.shoreOf(record, lat, lon)
      if (landAt(record, lat, lon)) { onLand++; if (out.lat === lat && out.lon === lon && out.shore === false) kept++; continue }
      if (!out.found) continue
      assert.ok(Math.hypot(out.lat - lat, ((out.lon - lon + 540) % 360) - 180) <= 20.5, `${name}: the shore is within 20°`)
      const at = pixel(out.lat, out.lon)
      if (ice[at]) continue // the field cannot be asked what lies under ice
      shores++
      // shoreOf returns the first land its 2°-ring search meets, which is within a pixel of the coast more often than not (a pixel
      // here is .35°); so the picture is asked for land at that pixel or beside it, not for the one pixel exactly
      const around = [-w - 1, -w, -w + 1, -1, 0, 1, w - 1, w, w + 1].map(d => at + d).filter(k => k >= 0 && k < w * h)
      if (around.some(k => !water[k] && !ice[k])) shown++
    }
    assert.equal(kept, onLand, `${name}: a point on land is drawn where it is, and not said to be on a shore`)
    assert.ok(shores >= 40, `${name}: the sample has sea to draw on a shore (${shores})`)
    assert.ok(shown / shores >= .97, `${name}: ${(100 * shown / shores).toFixed(1)}% of the shores shoreOf draws on are land (or beside land) in the picture (at least 97%)`)
  }
})

// ── a tile ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A tile at zoom z that holds a coast: both land and sea on its 8×8 sample of the Place tool’s own land test, at a middle latitude. */
function coastalTile(record, z) {
  const n = 2 ** z
  for (let y = Math.floor(n * .3); y < Math.floor(n * .42); y++) for (let x = 0; x < n; x++) {
    let land = 0
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (landAt(record, latOfY(z, y + (j + .5) / 8), lonOfX(z, x + (i + .5) / 8))) land++
    if (land >= 16 && land <= 48) return {x, y}
  }
  throw new Error(`no tile at zoom ${z} holds a coast in the sampled band`)
}

for (const z of [5, 8]) {
  test(`P5 a z${z} tile agrees with the Place tool’s land test at 97 % of its pixels: the tile and the land test are one function`, pending, async () => {
    const tiles = await optional('bodyTiles.ts')
    assert.equal(typeof tiles.bodyTile, 'function', 'bodyTiles.ts exports bodyTile(record, z, x, y, look?)')
    const record = BODIES.default, {x, y} = coastalTile(record, z), tile = tiles.bodyTile(record, z, x, y), water = waterMask(tile), ice = iceMask(tile)
    let agree = 0, counted = 0
    for (let j = 1; j < TILE_PX; j += 4) for (let i = 1; i < TILE_PX; i += 4) {
      const at = j * TILE_PX + i
      if (ice[at]) continue
      counted++
      // the pixel's own place on the sphere: a Web-Mercator row and a column of longitude (tilemath.ts), at the pixel's centre
      if (landAt(record, latOfY(z, y + (j + .5) / TILE_PX), lonOfX(z, x + (i + .5) / TILE_PX)) === !water[at]) agree++
    }
    assert.ok(counted >= 3000, `the tile is not mostly ice (${counted} of 4096 sampled pixels)`)
    assert.ok(agree / counted >= .97, `z${z} tile ${x}/${y}: the land test and the tile agree at ${(100 * agree / counted).toFixed(2)}% of ${counted} pixels (at least 97%)`)
  })
}

// ── the System scale's disc ─────────────────────────────────────────────────────────────────────────────────────────────

test('P6 the disc is the same body: its land and sea are the Place tool’s, at 95 % of the disc’s pixels, tilt and all', () => {
  // bodyDisc looks down the +z axis of a frame turned by the tilt (body.ts bodyDisc): pixel (xm, ym) of the disc is the body point
  // (xm·cosτ + ym·sinτ, −xm·sinτ + ym·cosτ, √(1 − r²)). No clouds and no ice: the disc then shows the ground and the sea and the lit side of both.
  // Sea reads as blue above red; land (rock, green, sand) never does. Pixels within one of the coast are not asked: a disc is small.
  for (const [name, record] of Object.entries({default: BODIES.default, tilted: base(42, {sky: {axial_tilt_deg: 40}})})) {
    const clear = {...record, sky: {...record.sky, clouds: 0}, climate: {...record.climate, ice_caps: 0}}, size = 96, disc = body.bodyDisc(clear, size)
    const tilt = clear.sky.axial_tilt_deg * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt)
    let agree = 0, counted = 0
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const xm = -1 + (i + .5) * 2 / size, ym = 1 - (j + .5) * 2 / size, r2 = xm * xm + ym * ym
      if (r2 >= .85 * .85) continue // inside the disc, short of its rim where the air and the grazing light hide the ground
      const at = (j * size + i) * 4, r = disc.data[at], b = disc.data[at + 2]
      const x = xm * ct + ym * st, y = -xm * st + ym * ct, z = Math.sqrt(1 - r2)
      counted++
      if (body.isLand(clear, body.heightAt(clear, x, y, z)) === (b <= r + .1 * Math.max(r, b))) agree++
    }
    assert.ok(counted > 3000)
    assert.ok(agree / counted >= .95, `${name}: the disc and the field agree at ${(100 * agree / counted).toFixed(1)}% of ${counted} pixels (at least 95%)`)
  }
})

// ── the Body page's preview ─────────────────────────────────────────────────────────────────────────────────────────────

test('P7 the World design’s BodyArt draws the generator’s body, not a second noise of its own: the Body page and the globe draw one body', pending, () => {
  // Today the preview (inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx) carries its own hash3, noise3, fbm, heightAt and
  // isLand: a copy of version 1 that version 2 leaves behind, so the page would show one planet and the globe another. The preview's
  // drawing is to come from globe/body.ts. (A GPU-less, DOM-less read of the source: the panel is React.)
  const file = readFileSync(new URL('../src/inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx', import.meta.url), 'utf8')
  const code = file.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(line => line.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n')
  assert.match(code, /from\s+['"][^'"]*projections\/atlas\/src\/globe\/body['"]/, 'the panel imports the generator (projections/atlas/src/globe/body)')
  assert.match(code, /\bbodyDisc\s*\(/, 'and draws the preview from bodyDisc')
  for (const own of ['hash3', 'noise3', 'fbm', 'heightAt']) assert.doesNotMatch(code, new RegExp(`function\\s+${own}\\b`), `the panel keeps no copy of ${own}`)
  assert.doesNotMatch(code, /const\s+isLand\b/, 'nor of isLand')
  assert.match(code, /\bshoreOf\s*\(/, 'a location is drawn on the shore through the generator’s shoreOf')
})
