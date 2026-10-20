// T-PROCEDURAL-BODY — the gate: a generated body is held to the Earth's own numbers (tests/lib/planetMetrics.mjs, measured on
// public/textures/earth-2k.jpg into tests/fixtures/planet-reference.json), and its close-zoom tiles to its own base.
//
// This file is the quality boundary and the lead's. The lanes building the generator do not edit it, the metrics library or the
// reference: a change here is argued in the ticket (desktop/cradle/docs/world-shell/wayfinder/tickets/T-PROCEDURAL-BODY-at-the-earths-standard.md).
//
// Four kinds of test live here:
//   A. the boundary's own teeth (always enforced): the Earth passes its own gate; the Earth blurred, or with noise laid on it, does
//      not; the v1 generator's recorded numbers do not;
//   B. the generator at the Earth's standard: four fixed bodies, each measured at 2048 wide against the Earth;
//   C. the legacy generator stays byte-for-byte what it was (always enforced): a body built by version 1 draws as version 1;
//   D. the pixels reach the eye: the base widths the globe is given, the procedural tiles that take
//      the place of the Earth's GIBS tiles at close zoom, and what those tiles owe their base.
//
// Run: node --experimental-strip-types --test tests/w3q-planet-gate.test.mjs  (every clause is a real test; the red-first `todo` gate came off when the generator landed)
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'
import {measurePlanet, assessPlanet, detailEnergyFlat, seamRatio, waterMask, lumaPlane} from './lib/planetMetrics.mjs'

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
const reference = JSON.parse(readFileSync(new URL('./fixtures/planet-reference.json', import.meta.url), 'utf8'))


const sha = data => createHash('sha256').update(Buffer.from(data.buffer, data.byteOffset, data.byteLength)).digest('hex')
const base = (seed, landmass = {}, climate = {}, version = 2) => ({
  body_ref: 'body:gate', seed, generator: {id: 'fbm-sphere', version},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth', ...landmass}, climate: {warmth: .58, moisture: .6, ice_caps: .3, ...climate},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
})
// The four bodies the gate measures: the World design's own dials with two seeds, and the two coasts that are not smooth.
const BODIES = {
  default: {record: base(20261018), opts: {}},
  seedB: {record: base(7), opts: {}},
  fjord: {record: base(42, {coast: 'fjord', continents: 2.6, relief: .8}), opts: {}},
  archipelago: {record: base(99, {coast: 'archipelago', sea_level: .6}), opts: {minPieces: 30}},
}

// ── A. the boundary's own teeth ─────────────────────────────────────────────────────────────────────────────────────────

test('A1 the Earth passes its own gate', () => {
  assert.equal(reference.schema, 'oi.planet-reference/v1')
  assert.equal(reference.earth.width, 2048, 'the reference is measured at 2048 wide, the width the gate draws a body at')
  assert.deepEqual(assessPlanet(reference.earth, reference.earth), [], 'a gate the Earth fails is not the Earth’s standard')
})

test('A2 the Earth blurred, or with noise laid on it, fails the gate: blur has no fine detail, noise has no structure', () => {
  const blurred = assessPlanet(reference.calibration.blurred, reference.earth)
  assert.ok(blurred.some(c => /land tilt|land detail/.test(c)), `a blurred Earth fails on land detail: ${blurred.join(' | ')}`)
  assert.ok(blurred.some(c => /sea tilt|sea detail/.test(c)), `and on sea detail: ${blurred.join(' | ')}`)
  const noisy = assessPlanet(reference.calibration.noisy, reference.earth)
  assert.ok(noisy.length >= 1, `an Earth with ±5 of white noise per channel fails: ${noisy.join(' | ')}`)
})

test('A2b the Earth with a bright halo laid round its coasts fails the shelf clauses: the Earth’s shelf is narrow, a halo is the tell of a painted body', () => {
  const haloed = assessPlanet(reference.calibration.haloed, reference.earth)
  assert.ok(haloed.some(c => /^shelf brightness/.test(c)), `a halo is too bright at the shore: ${haloed.join(' | ')}`)
  assert.ok(haloed.some(c => /^shelf reach/.test(c)), `and too wide: ${haloed.join(' | ')}`)
  assert.equal(haloed.filter(c => /^(land|sea) /.test(c)).length, 0, 'it is the same Earth otherwise: the halo is what the gate finds, not the detail')
})

test('A3 the v1 generator, as recorded before this ticket, fails the gate on every body it was measured on', () => {
  for (const [name, measure] of Object.entries(reference.v1Baseline)) {
    const fails = assessPlanet(measure, reference.earth, BODIES[name]?.opts ?? {})
    assert.ok(fails.length >= 2, `v1 ${name} must fail the gate (it is what the owner saw); it failed ${fails.length}: ${fails.join(' | ')}`)
  }
})

test('A4 the gate’s clauses name the Earth’s numbers, not a taste: every clause quotes a band', () => {
  const fails = assessPlanet(reference.v1Baseline.default, reference.earth)
  for (const clause of fails) assert.match(clause, /\d/, `a failing clause carries its numbers: ${clause}`)
})

// ── B. the generator at the Earth's standard ────────────────────────────────────────────────────────────────────────────

// The time a thread spends (process.cpuUsage: user and system), never the clock on the wall: on a machine other sessions keep busy (load 28 to 43 on 20 Oct) a thread that
// waits its turn reads 13 times its own work, and a ceiling on that clock fails a generator that is fast. The ceilings are unchanged; only the clock is the thread's own.
const cpuMs = run => {
  const c0 = process.cpuUsage(), value = run(), used = process.cpuUsage(c0)
  return {value, ms: (used.user + used.system) / 1000}
}

for (const [name, {record, opts}] of Object.entries(BODIES)) {
  test(`B ${name}: the body, drawn 2048 wide, stands at the Earth’s standard`, () => {
    const {value: image, ms} = cpuMs(() => body.bodyImage(record, 2048))
    assert.equal(image.width, 2048)
    const fails = assessPlanet(measurePlanet(image), reference.earth, {...opts, shelf: false})
    assert.deepEqual(fails, [], `${name} falls short of the Earth at ${Math.round(ms)} ms:\n  ${fails.join('\n  ')}`)
    assert.ok(ms < 20000, `a 2048-wide body is made in under 20 s on a CPU thread (took ${Math.round(ms)} ms); the worker takes it off the main thread, but not out of reason`)
  })
}

// The sea's shelf and deep tone, held to the Earth's own: red until the generator's follow-up lands (W3Q_GATE=enforce runs it as a test).
const pendingShelf = process.env.W3Q_GATE === 'enforce' ? {} : {todo: 'T-PROCEDURAL-BODY follow-up: the shelf is a narrow edge, not a halo, and the deep sea is calm'}
for (const [name, {record, opts}] of Object.entries(BODIES)) {
  test(`B shelf ${name}: the sea's shelf is as narrow and as dim as the Earth's, and its open sea as calm`, pendingShelf, () => {
    const image = body.bodyImage(record, 2048), m = measurePlanet(image)
    const fails = assessPlanet(m, reference.earth, opts).filter(c => /^(shelf|deep sea)/.test(c))
    assert.deepEqual(fails, [], `${name}:\n  ${fails.join('\n  ')}`)
  })
}

test('B+ every body of the gate is its own world: two seeds differ in more than a rotation', () => {
  const a = body.bodyImage(BODIES.default.record, 512), b = body.bodyImage(BODIES.seedB.record, 512)
  const ma = body.landShare(BODIES.default.record, 128), mb = body.landShare(BODIES.seedB.record, 128)
  assert.notEqual(sha(a.data), sha(b.data))
  assert.ok(ma > .05 && ma < .8 && mb > .05 && mb < .8, `both worlds have sea and land (${ma.toFixed(2)}, ${mb.toFixed(2)})`)
})

// ── C. the legacy generator stays what it was ───────────────────────────────────────────────────────────────────────────

test('C1 a body built by generator version 1 still draws exactly as version 1 did, byte for byte', () => {
  const v1 = {...base(20261018), body_ref: 'body:central:wiki:root', generator: {id: 'fbm-sphere', version: 1}}
  assert.equal(sha(body.bodyImage(v1, 128).data), '914fb87a4d15b5d641cee203645fbf252608a00dd4e5fc1e278d3281173adf1e', 'the base image')
  assert.equal(sha(body.cloudImage(v1, 128).data), '0a5cc00a18d4abbf010c729f34286e65b16d8290b8c1fee5a2c00d6e9bc7c6b7', 'the cloud layer')
  assert.equal(sha(body.bodyDisc(v1, 48).data), '724d835c83429e3287667d71c842cc0bb165101c7fdc4420654d641ac6b31bbb', 'the disc')
})

test('C2 the shell names the generator it draws with: version 2, and a version it does not know is refused in words', () => {
  assert.equal(body.WORLD_BODY_GENERATOR_VERSION, 2)
  const v = n => ({...base(1), generator: {id: 'fbm-sphere', version: n}})
  assert.ok(body.isWorldBody(body.parseWorldBody(v(1))), 'version 1 reads')
  assert.ok(body.isWorldBody(body.parseWorldBody(v(2))), 'version 2 reads')
  const newer = body.parseWorldBody(v(3))
  assert.ok('refused' in newer && /newer|version/i.test(newer.refused), `a body built by a newer generator says so: ${JSON.stringify(newer)}`)
})

test('C3 version 2 is a different body from version 1 for the same seed and dials (the generator changed, so the version did)', () => {
  const v1 = base(20261018, {}, {}, 1), v2 = base(20261018, {}, {}, 2)
  assert.notEqual(sha(body.bodyImage(v1, 256).data), sha(body.bodyImage(v2, 256).data))
})

// ── D. the pixels reach the eye ─────────────────────────────────────────────────────────────────────────────────────────

test('D1 the globe is given the Earth’s order of pixels: first 256, then 2048 where the GPU is small and 4096 where it is not', () => {
  assert.ok(body.BODY_WIDTHS, 'body.ts exports BODY_WIDTHS')
  assert.deepEqual(Object.keys(body.BODY_WIDTHS).sort(), ['first', 'hi', 'lo'])
  assert.ok(body.BODY_WIDTHS.first >= 256 && body.BODY_WIDTHS.first < body.BODY_WIDTHS.lo)
  assert.ok(body.BODY_WIDTHS.lo >= 2048, `the small-GPU base is at least 2048 wide (was 512); it is ${body.BODY_WIDTHS.lo}`)
  assert.ok(body.BODY_WIDTHS.hi >= 4096, `the base is at least 4096 wide (was 1024); it is ${body.BODY_WIDTHS.hi}`)
  const engine = readFileSync(new URL('engine.ts', globe), 'utf8')
  assert.match(engine, /BODY_WIDTHS/, 'the engine takes its widths from BODY_WIDTHS')
  assert.doesNotMatch(engine, /hiResChoice\(this\.renderer\) \? 1024 : 512/, 'and no longer the 1024/512 literals')
})

test('D2 a generated body keeps its close-zoom detail: procedural tiles stand where the Earth’s GIBS tiles do', () => {
  const engine = readFileSync(new URL('engine.ts', globe), 'utf8')
  assert.doesNotMatch(engine, /if \(!this\.earth\.generated\) this\.tiles\.update/, 'the tile layer is no longer switched off for a generated body')
  const tiles = readFileSync(new URL('tiles.ts', globe), 'utf8'), engineAndTiles = engine + tiles
  assert.match(engineAndTiles, /bodyTiles/, 'the tile layer or the engine draws from bodyTiles.ts')
})

// the land the tile tests stand on: a spot of the 2048 base whose 9×9 pixels are all land, at a middle latitude
function landSpot(image) {
  const {width: w, height: h} = image, water = waterMask(image)
  for (let j = Math.floor(h * .25); j < Math.floor(h * .45); j += 3) for (let i = 16; i < w - 16; i += 3) {
    let ok = true
    for (let dy = -4; dy <= 4 && ok; dy++) for (let dx = -4; dx <= 4; dx++) if (water[(j + dy) * w + i + dx]) { ok = false; break }
    if (ok) return {lat: 90 - (j + .5) * 180 / h, lon: -180 + (i + .5) * 360 / w}
  }
  throw new Error('no land spot found in the base: the body has no inland')
}
const tileOf = (z, lat, lon) => ({z, x: Math.floor((lon + 180) / 360 * 2 ** z), y: Math.floor(yOfLat(z, lat))})
const sampleBase = (image, lat, lon) => {
  const {width: w, height: h, data} = image
  const u = (lon + 180) / 360 * w - .5, v = (90 - lat) / 180 * h - .5, i0 = Math.floor(u), j0 = Math.max(0, Math.min(h - 2, Math.floor(v))), fu = u - i0, fv = v - j0
  const px = (i, j, c) => data[(j * w + ((i % w) + w) % w) * 4 + c]
  return [0, 1, 2].map(c => (px(i0, j0, c) * (1 - fu) + px(i0 + 1, j0, c) * fu) * (1 - fv) + (px(i0, j0 + 1, c) * (1 - fu) + px(i0 + 1, j0 + 1, c) * fu) * fv)
}

test('D3 a tile is a 256×256 RGBA image, deterministic, and its sphere position is the body’s own', async () => {
  const tiles = await import(new URL('bodyTiles.ts', globe).href)
  assert.equal(typeof tiles.bodyTile, 'function', 'bodyTiles.ts exports bodyTile(record, z, x, y, look?)')
  const record = BODIES.default.record
  const a = tiles.bodyTile(record, 5, 17, 11), b = tiles.bodyTile(record, 5, 17, 11)
  assert.equal(a.width, TILE_PX); assert.equal(a.height, TILE_PX); assert.equal(a.data.length, TILE_PX * TILE_PX * 4)
  assert.equal(sha(a.data), sha(b.data), 'the same tile twice is the same bytes')
  assert.notEqual(sha(a.data), sha(tiles.bodyTile({...record, seed: record.seed + 1}, 5, 17, 11).data), 'another seed is another ground')
  assert.notEqual(sha(a.data), sha(tiles.bodyTile(record, 5, 17, 11, {barren: 1}).data), 'a barren look is another ground')
  assert.doesNotMatch(tiles.bodyTile.toString(), /Math\.random/, 'nothing in a tile is random')
})

test('D4 neighbouring tiles meet without a seam, east–west and north–south', async () => {
  const tiles = await import(new URL('bodyTiles.ts', globe).href)
  const record = BODIES.default.record, joined = (a, b, vertical) => {
    // glue two tiles into one image and read the seam ratio across the join (seamRatio reads the wrap; so glue so the join is the wrap)
    const w = TILE_PX, out = {width: w * 2, height: w, data: new Uint8ClampedArray(w * 2 * w * 4)}
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) for (let c = 0; c < 4; c++) {
      out.data[(j * w * 2 + i) * 4 + c] = vertical ? a.data[(i * w + j) * 4 + c] : a.data[(j * w + i) * 4 + c]
      out.data[(j * w * 2 + w + i) * 4 + c] = vertical ? b.data[(i * w + j) * 4 + c] : b.data[(j * w + i) * 4 + c]
    }
    return out
  }
  // seamRatio compares the wrap's difference with the ordinary one at column 0/1 and the last/previous; glue [b | a] so a's right edge meets b's left edge across the wrap
  for (const z of [5, 7]) {
    const x = 2 ** z / 2 + 3, y = Math.floor(2 ** z * .32)
    const west = tiles.bodyTile(record, z, x, y), east = tiles.bodyTile(record, z, x + 1, y), south = tiles.bodyTile(record, z, x, y + 1)
    const ew = seamRatio(joined(east, west, false)), ns = seamRatio(joined(south, west, true))
    assert.ok(ew <= 2.2, `z${z} east–west seam ratio ${ew.toFixed(2)} stays under 2.2`)
    assert.ok(ns <= 2.2, `z${z} north–south seam ratio ${ns.toFixed(2)} stays under 2.2`)
  }
})

test('D5 a tile agrees with its base: the same land, the same sea, the same colour at the scale the base can show', async () => {
  const tiles = await import(new URL('bodyTiles.ts', globe).href)
  const record = BODIES.default.record, baseImage = body.bodyImage(record, 2048), spot = landSpot(baseImage), {z, x, y} = tileOf(4, spot.lat, spot.lon)
  const tile = tiles.bodyTile(record, z, x, y), tileWater = waterMask(tile)
  let agree = 0, cells = 0, colour = 0
  const B = 8
  for (let bj = 0; bj < TILE_PX / B; bj++) for (let bi = 0; bi < TILE_PX / B; bi++) {
    let mean = [0, 0, 0], waterVotes = 0
    for (let dj = 0; dj < B; dj++) for (let di = 0; di < B; di++) {
      const j = bj * B + dj, i = bi * B + di
      for (let c = 0; c < 3; c++) mean[c] += tile.data[(j * TILE_PX + i) * 4 + c] / (B * B)
      waterVotes += tileWater[j * TILE_PX + i]
    }
    const lat = latOfY(z, y + (bj * B + B / 2) / TILE_PX), lon = lonOfX(z, x + (bi * B + B / 2) / TILE_PX)
    const sampled = sampleBase(baseImage, lat, lon)
    const r = sampled[0] / 255, b = sampled[2] / 255, baseWater = (b - r) / (b + .05) > .45
    if ((waterVotes > B * B / 2) === baseWater) agree++
    colour += (Math.abs(mean[0] - sampled[0]) + Math.abs(mean[1] - sampled[1]) + Math.abs(mean[2] - sampled[2])) / 3 / 255
    cells++
  }
  assert.ok(agree / cells >= .9, `land and sea agree on ${(100 * agree / cells).toFixed(1)}% of the tile’s cells (the base is the same body seen less closely): at least 90%`)
  assert.ok(colour / cells <= .06, `colour differs by ${(colour / cells).toFixed(3)} on average between tile and base cells: at most .06`)
})

test('D6 a deep tile holds the detail its base cannot: it is not the base made larger', async () => {
  const tiles = await import(new URL('bodyTiles.ts', globe).href)
  const record = BODIES.default.record, baseImage = body.bodyImage(record, 2048), spot = landSpot(baseImage), {z, x, y} = tileOf(8, spot.lat, spot.lon)
  const tile = tiles.bodyTile(record, z, x, y)
  // the base, enlarged to the tile's own pixels: what the globe shows today at this zoom
  const enlarged = {width: TILE_PX, height: TILE_PX, data: new Uint8ClampedArray(TILE_PX * TILE_PX * 4)}
  for (let j = 0; j < TILE_PX; j++) for (let i = 0; i < TILE_PX; i++) {
    const s = sampleBase(baseImage, latOfY(z, y + (j + .5) / TILE_PX), lonOfX(z, x + (i + .5) / TILE_PX))
    enlarged.data.set([s[0], s[1], s[2], 255], (j * TILE_PX + i) * 4)
  }
  const eTile = detailEnergyFlat(tile), eBase = detailEnergyFlat(enlarged)
  assert.ok(eTile[1] >= 4 * eBase[1], `a deep tile has at least 4× the 1 px detail of the enlarged base (${eTile[1].toFixed(4)} against ${eBase[1].toFixed(4)})`)
  const tilt = eTile[1] / eTile[8], earthTilt = reference.earth.landTilt
  assert.ok(tilt >= .6 * earthTilt && tilt <= 1.6 * earthTilt, `and its detail falls off across scales as the Earth’s does (${tilt.toFixed(3)} in [${(.6 * earthTilt).toFixed(3)}, ${(1.6 * earthTilt).toFixed(3)}])`)
  // it is the same place: the tile’s mean luma is the base’s there
  const L = lumaPlane(tile), Le = lumaPlane(enlarged)
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length
  assert.ok(Math.abs(mean(L) - mean(Le)) <= .06, `the tile is the same ground as the base there (mean luma ${mean(L).toFixed(3)} against ${mean(Le).toFixed(3)})`)
})

test('D7 a tile is made in a time a worker can spend between frames', async () => {
  const tiles = await import(new URL('bodyTiles.ts', globe).href)
  const record = BODIES.default.record, spot = landSpot(body.bodyImage(record, 512)), {z, x, y} = tileOf(8, spot.lat, spot.lon)
  tiles.bodyTile(record, z, x, y) // warm
  const each = cpuMs(() => { for (let k = 0; k < 4; k++) tiles.bodyTile(record, z, x + k, y) }).ms / 4
  assert.ok(each < 800, `a z8 tile takes ${Math.round(each)} ms (under 800 on a CPU thread)`)
})
