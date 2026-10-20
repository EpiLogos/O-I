// T-PROCEDURAL-BODY, Lane A (the generator): nothing is random, and the generator's versions stay what they were.
// Contract: desktop/cradle/docs/world-shell/wayfinder/tickets/T-PROCEDURAL-BODY-at-the-earths-standard.md §2 ("Nothing is random": the same
// record, look and time give the same bytes, in a worker or on the main thread), §4 (names), §5 "Version policy".
//
// Channels: scripted. The generator is the shell's own TypeScript run in memory (transpiled by the loader below). The records are
// FIXTURES shaped to the owner's contract (ai-kit knowledge_wiki_facts.rs WorldBody). The worker is stood in for by an in-process
// class that runs the real globe/bodyWorker.ts handler, so "worker equals main" compares the real code on both sides.
//
// Kinds of test here:
//   A. purity and statelessness (always enforced where the function exists today; `pending` for the functions this ticket adds);
//   B. the generator's source holds nothing random, no clock, no DOM and no three.js (always enforced);
//   C. the worker and the main thread give the same bytes, and a worker that cannot run falls back (always enforced; look and tiles pending);
//   D. version dispatch: version 1 draws exactly as it did (always enforced), version 2 is another body (pending);
//   E. version policy: what parses, what is refused in words, what `firstBody` and `changedBody` write (pending);
//   F. golden images: four 256-wide bodies, compared with PNGs under tests/golden/planet/ (pending until generator v2 writes them:
//      UPDATE_GOLDEN=1 node --experimental-strip-types --test tests/w3q-gen-determinism.test.mjs).
//
// Run the red state: W3Q_GATE=enforce node --experimental-strip-types --test tests/w3q-gen-determinism.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {inflateSync, deflateSync} from 'node:zlib'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
// The loader the World's other tests use (w3-world-body-device.test.mjs), with the extension read from the path so a module can be
// imported afresh under a query string (bodyRender.ts keeps its worker in module state: each scenario below takes its own copy).
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  const p = new URL(u).pathname
  if (p.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || p.endsWith('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (p.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!p.endsWith('.ts') && !p.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: p,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

const globeUrl = new URL('../src/projections/atlas/src/globe/', import.meta.url)
const bodyUrl = new URL('../src/projections/atlas/body/', import.meta.url)
const body = await import(new URL('body.ts', globeUrl).href)
const store = await import(new URL('worldBody.ts', bodyUrl).href)
/** A module this ticket adds: `{}` until it exists, so the test that needs it fails on an assertion, not on an import. */
async function optional(name, query = '') {
  try { return await import(new URL(name, globeUrl).href + query) } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return {}
    throw error
  }
}

const ENFORCE = process.env.W3Q_GATE === 'enforce'
/** Tests that are red until generator version 2 lands carry this (the lead's gate does the same); W3Q_GATE=enforce makes them real. */
const pending = ENFORCE ? {} : {todo: 'T-PROCEDURAL-BODY: red until generator v2 lands (W3Q_GATE=enforce runs it as a test)'}

const sha = data => createHash('sha256').update(Buffer.from(data.buffer, data.byteOffset, data.byteLength)).digest('hex')
const DIALS = {
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
}
/** A record at the World design's own dials, with some of them changed: `change` names `landmass`, `climate` and `sky` parts. */
const base = (seed, change = {}, version = 2) => ({
  body_ref: 'body:gen', seed, generator: {id: 'fbm-sphere', version},
  landmass: {...DIALS.landmass, ...change.landmass}, climate: {...DIALS.climate, ...change.climate}, sky: {...DIALS.sky, ...change.sky},
})
// The gate's four bodies (tests/w3q-planet-gate.test.mjs BODIES): the default dials with two seeds, and the two coasts that are not smooth.
const BODIES = {
  default: base(20261018),
  seedB: base(7),
  fjord: base(42, {landmass: {coast: 'fjord', continents: 2.6, relief: .8}}),
  archipelago: base(99, {landmass: {coast: 'archipelago', sea_level: .6}}),
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const inner of Object.values(value)) deepFreeze(inner) }
  return value
}
/** Points on the unit sphere, evenly spread and fixed (a golden-angle spiral): where the field is asked its height. */
const spiral = n => Array.from({length: n}, (_, k) => {
  const y = 1 - 2 * (k + .5) / n, r = Math.sqrt(1 - y * y), a = k * 2.399963229728653
  return [r * Math.cos(a), y, r * Math.sin(a)]
})

// ── A. purity and statelessness ─────────────────────────────────────────────────────────────────────────────────────────

test('A1 the pictures of a version 2 record are pure: the same record gives the same bytes, whatever was drawn in between', () => {
  // The record is the only input. Anything a module keeps between calls (a table keyed by a seed, a cache left from another body) would
  // show here as a body that depends on which body was drawn before it. A, then B, then A again must give A's bytes both times.
  const a = BODIES.default, b = BODIES.fjord
  const first = {image: sha(body.bodyImage(a, 128).data), cloud: sha(body.cloudImage(a, 128).data), disc: sha(body.bodyDisc(a, 40).data)}
  body.bodyImage(b, 128); body.cloudImage(b, 128); body.bodyDisc(b, 40)
  assert.equal(sha(body.bodyImage(a, 128).data), first.image, 'bodyImage after another body')
  assert.equal(sha(body.cloudImage(a, 128).data), first.cloud, 'cloudImage after another body')
  assert.equal(sha(body.bodyDisc(a, 40).data), first.disc, 'bodyDisc after another body')
  assert.notEqual(sha(body.bodyImage(b, 128).data), first.image, 'and the other body is another body')
  assert.equal(body.bodyImage(a, 128).width, 128); assert.equal(body.bodyImage(a, 128).height, 64)
})

test('A2 the field is pure: height, land test, shore, land share and the air give the same numbers for the same record', () => {
  const r = BODIES.default, points = spiral(40)
  const read = () => ({
    heights: points.map(([x, y, z]) => body.heightAt(r, x, y, z)), share: body.landShare(r, 64), air: body.airOf(r),
    shores: [[10, 20], [-35, 140], [60, -100]].map(([lat, lon]) => body.shoreOf(r, lat, lon)),
    name: body.suggestName(r, 12.3, 45.6), seed: body.nextSeed(r, 3),
  })
  const before = read()
  body.heightAt(BODIES.seedB, .6, .6, .52) // another body in between
  assert.deepEqual(read(), before)
  assert.ok(before.heights.every(h => Number.isFinite(h)), 'every height is a number, at every point of the sphere (poles and the seam included)')
  assert.ok(Number.isFinite(body.heightAt(r, 0, 1, 0)) && Number.isFinite(body.heightAt(r, 0, -1, 0)), 'the poles')
})

test('A3 the generator reads the record and writes nothing: a frozen record draws, and is still the record it was', () => {
  const r = deepFreeze(base(20261018, {landmass: {coast: 'archipelago'}}))
  const copy = JSON.stringify(r)
  body.bodyImage(r, 64); body.cloudImage(r, 64); body.bodyDisc(r, 24); body.landShare(r, 32); body.airOf(r)
  body.shoreOf(r, 10, 20); body.heightAt(r, .6, .6, .52); body.suggestName(r, 1, 2); body.nextSeed(r, 1)
  assert.equal(JSON.stringify(r), copy)
})

test('A4 `weatherShift` and `bodyTile` are pure too: the same inputs, the same output, whatever was asked in between', async () => {
  const tiles = await optional('bodyTiles.ts')
  assert.equal(typeof body.weatherShift, 'function', 'body.ts exports weatherShift(record, latDeg, timeMs)')
  assert.equal(typeof tiles.bodyTile, 'function', 'bodyTiles.ts exports bodyTile(record, z, x, y, look?)')
  const r = BODIES.default, t = Date.UTC(2026, 9, 20)
  const first = [0, 23, -47, 80].map(lat => body.weatherShift(r, lat, t))
  body.weatherShift(BODIES.seedB, 10, t + 1)
  assert.deepEqual([0, 23, -47, 80].map(lat => body.weatherShift(r, lat, t)), first)
  const tile = tiles.bodyTile(r, 4, 7, 6)
  tiles.bodyTile(BODIES.fjord, 5, 3, 3)
  assert.equal(sha(tiles.bodyTile(r, 4, 7, 6).data), sha(tile.data), 'a tile after another body’s tile')
})

// ── B. what the generator's source holds ────────────────────────────────────────────────────────────────────────────────

/** The text of a TypeScript source with its comments taken out (what the code says, not what the notes beside it say). */
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(line => line.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n')
/** The relative modules a source imports (static and dynamic), as URLs under `from`. */
function imports(text, from) {
  const out = []
  for (const m of code(text).matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const url = new URL(m[1], from)
    for (const ext of ['', '.ts', '.tsx']) if (existsSync(url.pathname + ext) && /\.[tj]sx?$/.test(url.pathname + ext)) { out.push(new URL(url.href + ext)); break }
  }
  return out
}
/** Every module the entry reaches through relative imports: the generator is whatever `body.ts` and `bodyTiles.ts` stand on. */
function closure(entry) {
  const seen = new Map(), todo = [entry]
  while (todo.length) {
    const url = todo.pop()
    if (seen.has(url.href) || !existsSync(url.pathname)) continue
    const text = readFileSync(url, 'utf8')
    seen.set(url.href, text)
    todo.push(...imports(text, url))
  }
  return seen
}
const generator = () => new Map([...closure(new URL('body.ts', globeUrl)), ...closure(new URL('bodyTiles.ts', globeUrl))])

test('B1 the generator holds nothing random and no clock: the same record, look and time give the same bytes in a worker or not', () => {
  // The forbidden names, with why each breaks "the same record gives the same bytes": a random source is not the record; a clock reads
  // the machine, not the record; Intl and toLocale* answer by the locale of whoever runs them; hrtime and getRandomValues likewise.
  const forbidden = [/Math\.random/, /Date\.now/, /new\s+Date\b/, /\bDate\s*\(/, /performance\.now/, /process\.hrtime/, /crypto\.(getRandomValues|randomUUID)/, /\bIntl\./, /\.toLocale\w*\(/]
  const files = generator()
  assert.ok(files.size >= 1)
  for (const [url, text] of files) for (const pattern of forbidden) {
    assert.doesNotMatch(code(text), pattern, `${url.split('/globe/')[1] ?? url}: ${pattern} would make a body depend on the machine`)
  }
})

test('B2 the generator is pure TypeScript: no DOM and no three.js, so it runs in a worker', () => {
  for (const [url, text] of generator()) {
    const name = url.split('/globe/')[1] ?? url, source = code(text)
    assert.doesNotMatch(source, /from\s+['"]three['"]/, `${name} imports three.js`)
    assert.doesNotMatch(source, /\b(document|window|navigator|HTMLCanvasElement|OffscreenCanvas|localStorage|requestAnimationFrame)\b/, `${name} touches the DOM`)
    assert.doesNotMatch(source, /from\s+['"][^'"]*\/(engine|earth|tiles|bodyRender|bodyWorker)['"]/, `${name} reaches the globe’s plumbing; the generator sits under it`)
  }
})

test('B3 the generator is more than body.ts: the version 1 code and the tile field are modules it stands on, and the lot is scanned', () => {
  const names = [...generator().keys()].map(url => url.split('/globe/')[1])
  assert.ok(names.includes('bodyTiles.ts'), `bodyTiles.ts is part of the generator (found: ${names.join(', ')})`)
  assert.ok(names.length >= 3, `body.ts, the legacy version 1 module and bodyTiles.ts at least (found ${names.length}: ${names.join(', ')})`)
})

// ── C. the worker, and the main thread ──────────────────────────────────────────────────────────────────────────────────

/** A stand-in for `Worker` that runs the real bodyWorker.ts handler in this process and answers asynchronously, as a worker does. */
function installWorker(behaviour = 'works') {
  const scope = {onmessage: null, postMessage() { throw new Error('no job is running') }}
  globalThis.self = scope
  const made = []
  class InProcessWorker {
    constructor() {
      if (behaviour === 'cannot-start') throw new Error('this page cannot start a worker')
      this.onmessage = null; this.onerror = null; this.jobs = []; this.terminated = false
      made.push(this)
    }
    postMessage(job) {
      this.jobs.push(job)
      if (behaviour === 'fails') { setTimeout(() => this.onerror?.(new Error('the worker failed')), 0); return }
      setTimeout(() => { scope.postMessage = answer => this.onmessage?.({data: answer}); scope.onmessage({data: job}) }, 0)
    }
    terminate() { this.terminated = true }
  }
  globalThis.Worker = InProcessWorker
  return {made, scope}
}
const uninstallWorker = () => { delete globalThis.Worker; delete globalThis.self }
/** bodyRender.ts afresh (its worker lives in module state), with the worker behaving as asked and the real bodyWorker.ts behind it. */
async function renderer(behaviour) {
  if (behaviour === 'absent') uninstallWorker()
  else installWorker(behaviour)
  if (behaviour === 'works' || behaviour === 'fails') await import(new URL('bodyWorker.ts', globeUrl).href + `?scope=${behaviour}-${renderer.n = (renderer.n ?? 0) + 1}`)
  return {render: await import(new URL('bodyRender.ts', globeUrl).href + `?case=${behaviour}-${renderer.n = (renderer.n ?? 0) + 1}`)}
}

test('C1 a body made in the worker is the body made on the main thread, byte for byte (image and clouds)', async () => {
  const {render} = await renderer('works')
  try {
    const record = BODIES.fjord
    assert.equal(render.bodyRenderThread(), 'worker', 'the stand-in worker is the one that draws')
    const made = await render.renderBody(record, 128, 64)
    assert.equal(sha(made.image.data), sha(body.bodyImage(record, 128).data), 'the base image')
    assert.equal(sha(made.clouds.data), sha(body.cloudImage(record, 64).data), 'the cloud mask')
  } finally { uninstallWorker() }
})

test('C2 with no worker the main thread draws the same bytes, and says so', async () => {
  const {render} = await renderer('absent')
  const record = BODIES.seedB
  assert.equal(render.bodyRenderThread(), 'main')
  const made = await render.renderBody(record, 96, 48)
  assert.equal(sha(made.image.data), sha(body.bodyImage(record, 96).data))
  assert.equal(sha(made.clouds.data), sha(body.cloudImage(record, 48).data))
})

test('C3 a worker that cannot start, or fails mid-job, is not tried again: its job and every later one are drawn on the main thread, none dropped', async () => {
  for (const behaviour of ['cannot-start', 'fails']) {
    const {render} = await renderer(behaviour)
    try {
      const first = BODIES.default, second = BODIES.archipelago
      const [a, b] = await Promise.all([render.renderBody(first, 64, 32), render.renderBody(second, 64, 32)])
      assert.equal(sha(a.image.data), sha(body.bodyImage(first, 64).data), `${behaviour}: the job the worker held`)
      assert.equal(sha(b.image.data), sha(body.bodyImage(second, 64).data), `${behaviour}: the job beside it`)
      assert.equal(render.bodyRenderThread(), 'main', `${behaviour}: and nothing is sent to a worker again`)
      const later = await render.renderBody(first, 48, 24)
      assert.equal(sha(later.image.data), sha(body.bodyImage(first, 48).data), `${behaviour}: a later job`)
    } finally { uninstallWorker() }
  }
})

test('C4 the worker refuses a body it cannot read in the owner’s words, and a body of a newer generator is named as newer', async () => {
  const {render} = await renderer('works')
  try {
    await assert.rejects(render.renderBody({...BODIES.default, seed: -1}, 32, 16), /seed is a whole number/, 'a record out of range is refused as the owner words it')
    await assert.rejects(render.renderBody({...BODIES.default, generator: {id: 'fbm-sphere', version: 3}}, 32, 16), /newer/i, 'a version this shell does not draw is named as newer')
  } finally { uninstallWorker() }
})

test('C5 the look goes through the worker: a barren body made there is the barren body made here, and not the lived-in one', async () => {
  const {render} = await renderer('works')
  try {
    const record = BODIES.default, look = {barren: .6}
    assert.notEqual(sha(body.bodyImage(record, 96, look).data), sha(body.bodyImage(record, 96).data), 'the look changes the picture (else this test says nothing)')
    const made = await render.renderBody(record, 96, 48, look)
    assert.equal(sha(made.image.data), sha(body.bodyImage(record, 96, look).data), 'the base image, barren')
    assert.equal(sha(made.clouds.data), sha(body.cloudImage(record, 48, look).data), 'the cloud mask, barren')
  } finally { uninstallWorker() }
})

test('C6 a tile made in the worker is the tile made here (renderTile), and with no worker the main thread makes it', async () => {
  const tiles = await optional('bodyTiles.ts')
  assert.equal(typeof tiles.bodyTile, 'function', 'bodyTiles.ts exports bodyTile')
  const record = BODIES.default, z = 5, x = 17, y = 11
  for (const behaviour of ['works', 'absent']) {
    const {render} = await renderer(behaviour)
    try {
      assert.equal(typeof render.renderTile, 'function', 'bodyRender.ts exports renderTile(record, z, x, y, look?): Promise<BodyImage>')
      const made = await render.renderTile(record, z, x, y)
      assert.equal(sha(made.data), sha(tiles.bodyTile(record, z, x, y).data), `${behaviour}: the same tile`)
      const barren = await render.renderTile(record, z, x, y, {barren: 1})
      assert.equal(sha(barren.data), sha(tiles.bodyTile(record, z, x, y, {barren: 1}).data), `${behaviour}: the same tile, barren`)
    } finally { uninstallWorker() }
  }
})

// ── D. version dispatch ─────────────────────────────────────────────────────────────────────────────────────────────────

// What generator version 1 drew before this ticket, recorded from globe/body.ts at 023302338 (the commit that put the gate in): four
// records at the World design's dials and beyond, the pictures as hashes and the field as numbers. A body built by version 1 keeps
// drawing as version 1: its next change rebuilds it as version 2, and until then it is these bytes. The gate's C1 holds one record at 128
// wide; this holds the coasts, the extremes of the dials, a second width, the field and the shore the Place tool reads.
const V1 = {
  default: {record: base(20261018, {}, 1), image128: '914fb87a4d15b5d641cee203645fbf252608a00dd4e5fc1e278d3281173adf1e', image256: 'a7b4baf36b4e81b48aa1f49fb289b06aa6787a45988724c94e9b49002efbe013',
    cloud128: '0a5cc00a18d4abbf010c729f34286e65b16d8290b8c1fee5a2c00d6e9bc7c6b7', disc48: '724d835c83429e3287667d71c842cc0bb165101c7fdc4420654d641ac6b31bbb',
    landShare64: 0.520301724473, heights: [0.475776391078, 0.415282719201, 0.567276196304], air: 1,
    shores: [{lat: 28, lon: 20, shore: true, found: true}, {lat: -35, lon: 140, shore: false, found: true}, {lat: 60, lon: -104, shore: true, found: true}]},
  fjord: {record: base(42, {landmass: {coast: 'fjord', continents: 2.6, relief: .8}}, 1), image128: '7f7644c83c26382a357b13aa6e57d1077da4c068671e3b4af35c5eabf21055bd',
    image256: 'c9a2ccda429d933a5aa04487bef92d2d4fc63a07ba9faca230adee5133a12dd0', cloud128: '7e99992ca8a24416ef9476e40ff0531990e354e2577ce1a0c89c8825f6ab30b5',
    disc48: '31d8202b6fe972b6799e323cfbb6e693730665b1c717d612f093e4ce2d851337', landShare64: 0.507845442926, heights: [0.167408044881, 0.901994001856, 0.561730743717], air: 1,
    shores: [{lat: 10, lon: 20, shore: false, found: true}, {lat: -29, lon: 140, shore: true, found: true}, {lat: 60, lon: -100, shore: false, found: true}]},
  archipelago: {record: base(99, {landmass: {coast: 'archipelago', sea_level: .6}}, 1), image128: 'b4832819d555b9f62629dc017326126843d8f1458720f3f3f0ffed83426ade96',
    image256: '7bd6e8d08ae093efcc586fca1661b2b53fd2839e8348d35dfa6dcd52c51cfaa0', cloud128: '875140755b375a592a9284b1b5b189dfc24b672ea8f10114693480a4a76e9ca4',
    disc48: '41493cd34a19c48fb45e35f78661f845fedca5951f49b855e2a333825c5b5a3d', landShare64: 0.392070755435, heights: [0.387540150508, 0.543319929875, 0.448105601486], air: 1,
    shores: [{lat: 10, lon: 14, shore: true, found: true}, {lat: -35, lon: 140, shore: false, found: true}, {lat: 58, lon: -100, shore: true, found: true}]},
  coldDry: {record: base(5, {landmass: {sea_level: .3, relief: .1}, climate: {warmth: .1, moisture: .1, ice_caps: .9}, sky: {atmosphere: 0, clouds: 0, axial_tilt_deg: 40}}, 1),
    image128: '8a8014ebb65dbdf17825086694d79483315dcbbd912abaf9c761561396c04692', image256: '8f6031f8163889ed663d978fe2501ae3dc2aa2d938348b0ab0975113b603e711',
    cloud128: '14b646bf649b98428824e2be13cf4c032694ffa8c754a75dc133d979ca9b8781', disc48: 'ff6deb5ec5ca1a2f044c46a26db8e19bca4eb741922a83f146c4b4d485f40fb3',
    landShare64: 0.748099481698, heights: [0.589212095211, 0.633204479614, 0.361702664858], air: 0,
    shores: [{lat: 10, lon: 22, shore: true, found: true}, {lat: -35, lon: 140, shore: false, found: true}, {lat: 60, lon: -100, shore: false, found: true}]},
}
const V1_POINTS = [[.3, .4, .86], [.1, -.7, .7], [-.8, .2, .55]].map(([x, y, z]) => { const n = Math.hypot(x, y, z); return [x / n, y / n, z / n] })
const V1_SHORE_POINTS = [[10, 20], [-35, 140], [60, -100]]

test('D1 a body built by generator version 1 draws exactly as version 1 did: the pictures, the field, the shore and the air', () => {
  for (const [name, expected] of Object.entries(V1)) {
    const record = {...expected.record, body_ref: 'body:central:wiki:root'}
    assert.equal(sha(body.bodyImage(record, 128).data), expected.image128, `${name}: image at 128`)
    assert.equal(sha(body.bodyImage(record, 256).data), expected.image256, `${name}: image at 256`)
    assert.equal(sha(body.cloudImage(record, 128).data), expected.cloud128, `${name}: clouds at 128`)
    assert.equal(sha(body.bodyDisc(record, 48).data), expected.disc48, `${name}: disc at 48`)
    assert.equal(+body.landShare(record, 64).toFixed(12), expected.landShare64, `${name}: land share`)
    assert.deepEqual(V1_POINTS.map(([x, y, z]) => +body.heightAt(record, x, y, z).toFixed(12)), expected.heights, `${name}: the field at three points`)
    assert.deepEqual(V1_SHORE_POINTS.map(([lat, lon]) => body.shoreOf(record, lat, lon)), expected.shores, `${name}: the shore a Place is drawn on`)
    assert.equal(body.airOf(record), expected.air, `${name}: the air`)
  }
})

test('D2 the version that draws is the record’s, not the module’s: a version 1 record keeps drawing as 1 beside a version 2 record of the same dials', () => {
  // WORLD_BODY_GENERATOR_VERSION becomes 2; a record that says 1 must not follow it. Drawn in either order, each stays itself.
  const v1 = {...V1.default.record, body_ref: 'body:central:wiki:root'}, v2 = {...v1, generator: {id: 'fbm-sphere', version: 2}}
  const a = sha(body.bodyImage(v1, 128).data)
  body.bodyImage(v2, 128)
  assert.equal(sha(body.bodyImage(v1, 128).data), a)
  assert.equal(a, V1.default.image128)
})

test('D3 version 2 is another body from version 1 at every entry point: image, clouds, disc, height and land share', () => {
  const v1 = base(20261018, {}, 1), v2 = base(20261018, {}, 2)
  assert.notEqual(sha(body.bodyImage(v2, 128).data), sha(body.bodyImage(v1, 128).data), 'bodyImage draws version 2 for a version 2 record: today both are the version 1 picture')
  assert.notEqual(sha(body.cloudImage(v2, 128).data), sha(body.cloudImage(v1, 128).data), 'cloudImage')
  assert.notEqual(sha(body.bodyDisc(v2, 48).data), sha(body.bodyDisc(v1, 48).data), 'bodyDisc')
  const points = spiral(60), differing = points.filter(([x, y, z]) => body.heightAt(v2, x, y, z) !== body.heightAt(v1, x, y, z)).length
  assert.ok(differing >= 54, `heightAt dispatches on the record’s version: ${differing} of 60 points differ (at least 90% must, or the Place tool still reads version 1)`)
  assert.notEqual(body.landShare(v2, 64), body.landShare(v1, 64), 'landShare')
})

// ── E. version policy ───────────────────────────────────────────────────────────────────────────────────────────────────

test('E1 the shell draws generator version 2, reads versions 1 and 2, and refuses a newer one in words', () => {
  assert.equal(body.WORLD_BODY_GENERATOR_VERSION, 2, 'the shell draws generator version 2 (WORLD_BODY_GENERATOR_VERSION)')
  for (const version of [1, 2]) assert.ok(body.isWorldBody(body.parseWorldBody(base(1, {}, version))), `version ${version} reads`)
  const newer = body.parseWorldBody(base(1, {}, 3))
  assert.ok('refused' in newer, 'version 3 is refused')
  assert.match(newer.refused, /newer/i, 'in words that say it was made by a newer generator')
  assert.match(newer.refused, /\b3\b/, 'naming the version the body asks for')
  assert.match(newer.refused, /\b2\b/, 'and the one this shell draws')
})

test('E2 a version that is not a version is refused whatever the shell draws', () => {
  for (const version of [0, -1, 1.5, '2', null, undefined, NaN]) {
    const parsed = body.parseWorldBody({...base(1), generator: {id: 'fbm-sphere', version}})
    assert.ok('refused' in parsed, `version ${String(version)} is refused`)
  }
  assert.match(body.parseWorldBody({...base(1), generator: {id: 'perlin', version: 2}}).refused, /generated by fbm-sphere/, 'another generator is named as another')
})

test('E3 the dials are refused outside their ranges for version 2 as for version 1, in the owner’s words', () => {
  for (const version of [1, 2]) {
    for (const [change, words] of [
      [{landmass: {sea_level: 1.2}}, /sea level runs from 0 to 1/], [{landmass: {continents: .5}}, /continents runs from 0.6 to 3.6/],
      [{landmass: {coast: 'jagged'}}, /the coast is smooth, fjord, archipelago/], [{sky: {axial_tilt_deg: 60}}, /axial tilt runs from 0 to 45/],
      [{climate: {ice_caps: -.1}}, /ice caps runs from 0 to 1/],
    ]) assert.match(body.parseWorldBody(base(1, change, version)).refused, words, `version ${version}`)
  }
})

test('E4 the first body a register is given is built by version 2', () => {
  const first = store.firstBody('central:wiki:root', 3)
  assert.equal(first.generator.version, 2, 'firstBody writes generator version 2')
  assert.equal(first.generator.id, 'fbm-sphere')
  assert.ok(body.isWorldBody(body.parseWorldBody(first)))
})

test('E5 a version 1 body is rebuilt as version 2 by its next change, whichever dial that is, and by a reroll', () => {
  const old = {...base(20261018, {}, 1), body_ref: 'body:central:wiki:root'}
  const changes = [['seaLevel', .3], ['continents', 2], ['relief', .9], ['coast', 'fjord'], ['warmth', .2], ['moisture', .4], ['iceCaps', .6],
    ['atmosphere', .2], ['clouds', .8], ['tilt', 30], ['seed', 99], ['reroll', true]]
  assert.deepEqual(store.WORLD_BODY_SETTINGS.map(setting => setting.key).sort(), ['atmosphere', 'clouds', 'continents', 'iceCaps', 'moisture', 'relief', 'seaLevel', 'tilt', 'warmth'],
    'the settings the table below covers are the settings the store has (a new dial is a new row here)')
  for (const [key, value] of changes) {
    const next = store.changedBody(old, 7, {[key]: value})
    assert.equal(next.generator.version, 2, `${key}: the changed body is version 2`)
    assert.equal(next.body_ref, old.body_ref, `${key}: and it is still the same body`)
    assert.ok(body.isWorldBody(body.parseWorldBody(next)), `${key}: and it reads`)
  }
  assert.equal(old.generator.version, 1, 'the record that was read is not touched')
  assert.equal(store.changedBody(base(5, {}, 2), 7, {warmth: .1}).generator.version, 2, 'a version 2 body stays 2')
})

// ── F. golden images ────────────────────────────────────────────────────────────────────────────────────────────────────

const GOLDEN = new URL('./golden/planet/', import.meta.url)
const GOLDEN_WIDTH = 256
/** The tolerance. Floating-point arithmetic is the same on every machine V8 runs on, but a table or a library may round in the last bit,
 * and a last-bit change moves a stray pixel by one level. A body changed on purpose moves features: a river's course, a coast, a
 * mountain range. So two bounds: the mean over the whole picture (a stray pixel moves it by far less than .05 of a level), and the mean
 * over every 16×16 block (a changed river or range moves a block's mean by several levels; a stray pixel by .01). */
const GOLDEN_MEAN = .5, GOLDEN_BLOCK = 1

const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = buffer => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(kind, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0); out.write(kind, 4, 'latin1'); data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
function encodePng({width, height, data}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6
  const rows = Buffer.alloc(height * (1 + width * 4))
  for (let j = 0; j < height; j++) { rows[j * (1 + width * 4)] = 0; Buffer.from(data.buffer, data.byteOffset + j * width * 4, width * 4).copy(rows, j * (1 + width * 4) + 1) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, {level: 9})), chunk('IEND', Buffer.alloc(0))])
}
function decodePng(buffer) {
  let at = 8, width = 0, height = 0, depth = 0, type = 0
  const idat = []
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at), kind = buffer.toString('latin1', at + 4, at + 8), part = buffer.subarray(at + 8, at + 8 + length)
    if (kind === 'IHDR') { width = part.readUInt32BE(0); height = part.readUInt32BE(4); depth = part[8]; type = part[9] }
    if (kind === 'IDAT') idat.push(part)
    at += 12 + length
  }
  if (depth !== 8 || (type !== 2 && type !== 6)) throw new Error(`a golden is an 8-bit RGB or RGBA PNG (this is type ${type}, depth ${depth})`)
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(height * stride)
  for (let j = 0; j < height; j++) {
    const filter = raw[j * (stride + 1)], line = raw.subarray(j * (stride + 1) + 1, (j + 1) * (stride + 1)), cur = px.subarray(j * stride, (j + 1) * stride)
    const up = j ? px.subarray((j - 1) * stride, j * stride) : Buffer.alloc(stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = up[i], c = i >= bpp ? up[i - bpp] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      cur[i] = (line[i] + (filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : (pa <= pb && pa <= pc ? a : pb <= pc ? b : c))) & 255
    }
  }
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) { data[i * 4] = px[i * bpp]; data[i * 4 + 1] = px[i * bpp + 1]; data[i * 4 + 2] = px[i * bpp + 2]; data[i * 4 + 3] = bpp === 4 ? px[i * 4 + 3] : 255 }
  return {width, height, data}
}
/** Mean absolute difference per channel, in levels, over the picture and over its worst 16×16 block. */
function difference(a, b) {
  const {width, height} = a, block = 16
  let total = 0
  const blocks = new Map()
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const at = (j * width + i) * 4
    const d = (Math.abs(a.data[at] - b.data[at]) + Math.abs(a.data[at + 1] - b.data[at + 1]) + Math.abs(a.data[at + 2] - b.data[at + 2])) / 3
    total += d
    const key = Math.floor(j / block) * 1000 + Math.floor(i / block)
    blocks.set(key, (blocks.get(key) ?? 0) + d)
  }
  return {mean: total / (width * height), worstBlock: Math.max(...[...blocks.values()].map(sum => sum / (block * block)))}
}

test('F1 the four bodies of the gate, drawn 256 wide, are the goldens: a body that changes is seen and chosen, never silent', pending, () => {
  const update = process.env.UPDATE_GOLDEN === '1'
  if (update) mkdirSync(GOLDEN, {recursive: true})
  const stale = []
  for (const [name, record] of Object.entries(BODIES)) {
    const image = body.bodyImage(record, GOLDEN_WIDTH), file = new URL(`${name}.png`, GOLDEN)
    assert.equal(image.width, GOLDEN_WIDTH); assert.equal(image.height, GOLDEN_WIDTH / 2)
    if (update) { writeFileSync(file, encodePng(image)); continue }
    assert.ok(existsSync(file), `no golden for ${name} at tests/golden/planet/${name}.png: draw it once the generator is the one to keep, with UPDATE_GOLDEN=1`)
    const golden = decodePng(readFileSync(file))
    assert.equal(golden.width, image.width, `${name}: the golden is ${GOLDEN_WIDTH} wide`)
    const {mean, worstBlock} = difference(image, golden)
    if (mean > GOLDEN_MEAN || worstBlock > GOLDEN_BLOCK) stale.push(`${name}: mean ${mean.toFixed(3)} (at most ${GOLDEN_MEAN}), worst 16×16 block ${worstBlock.toFixed(3)} (at most ${GOLDEN_BLOCK})`)
  }
  assert.deepEqual(stale, [], `a body no longer draws as its golden; if that is meant, rewrite them: UPDATE_GOLDEN=1 node --experimental-strip-types --test tests/w3q-gen-determinism.test.mjs\n  ${stale.join('\n  ')}`)
})

test('F2 the golden harness itself: a PNG round-trips, a stray pixel is tolerated, and a moved river is seen where the mean alone would miss it', () => {
  const image = body.bodyImage(BODIES.default, GOLDEN_WIDTH), again = decodePng(encodePng(image))
  assert.deepEqual([again.width, again.height], [GOLDEN_WIDTH, GOLDEN_WIDTH / 2]); assert.deepEqual(again.data, image.data, 'the PNG round trip is exact')
  const stray = {...image, data: new Uint8ClampedArray(image.data)}
  for (let k = 0; k < 40; k++) stray.data[(k * 331 % (GOLDEN_WIDTH * GOLDEN_WIDTH / 2)) * 4] += 1 // forty pixels, one level each: last-bit noise
  const quiet = difference(image, stray)
  assert.ok(quiet.mean <= GOLDEN_MEAN && quiet.worstBlock <= GOLDEN_BLOCK, `stray pixels are tolerated (mean ${quiet.mean.toFixed(4)}, block ${quiet.worstBlock.toFixed(4)})`)
  const moved = {...image, data: new Uint8ClampedArray(image.data)}
  for (let j = 40; j < 64; j++) { const at = (j * GOLDEN_WIDTH + 100) * 4; for (let c = 0; c < 3; c++) moved.data[at + c] = 255 - moved.data[at + c] } // a one-pixel line, 24 rows
  const loud = difference(image, moved)
  assert.ok(loud.mean <= GOLDEN_MEAN, `the mean alone misses it (${loud.mean.toFixed(3)})`)
  assert.ok(loud.worstBlock > GOLDEN_BLOCK, `the block bound sees it (worst block ${loud.worstBlock.toFixed(3)} against ${GOLDEN_BLOCK})`)
})
