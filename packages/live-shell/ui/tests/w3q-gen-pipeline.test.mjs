// T-PROCEDURAL-BODY, Lane A: the pipeline that carries the body's pixels to the eye. Ticket §5 "The pipeline":
//   widths from `BODY_WIDTHS` (the engine's 1024 : 512 goes): the globe draws a `first` image at once, then the larger ones as the worker finishes them, each
//   swapped in as the Earth's 2k and 8k are. Procedural tiles take the Earth's GIBS tiles' place for a generated body: `TileLayer` takes a tile source (the GIBS
//   source stays the default and its tests stay green); a procedural source asks the worker for `bodyTile`, never the network; tiles are requested only where
//   denser than the base (level log2(base/256)+1, as GIBS's are); no hole, no flash, an LRU bound on kept tiles; `earth.generated` no longer turns the layer off.
//
// Channels: scripted. The globe engine and its tile layer are the shell's own code in memory, on a stand-in WebGLRenderer that draws nothing and records what it is
// handed (the shim below exports it as three.js's WebGLRenderer for every shell module). The worker is a stand-in that holds each job until the test lets it
// answer, so that "at once", "then the larger ones" and "a later record" are observed in order; a job that is not a base picture (a tile) is answered by the real
// bodyWorker.ts handler. The network is a recorder: nothing is fetched.
//
// Elsewhere: that the worker falls back to the main thread when it cannot start or fails, and that a worker's bytes are the main thread's, is w3q-gen-determinism.test.mjs C1 to C6
// (it needs a module state of its own per case). The 2048-wide time budget is T1 below.
//
// NAMES THIS FILE CODES TO THAT THE TICKET'S §4 DOES NOT GIVE (the lead confirms or renames them before phase 2):
//   globe/bodyTiles.ts   `tileLevelFor(baseWidth)`: the first level a base of that width is denser than (log2(base/256) + 1)
//   globe/tiles.ts       `TileLayer.setSource(source)`; a `TileSource` is `{load(z, x, y, signal): Promise<ImageBitmap | HTMLImageElement | BodyImage>}`; the GIBS source is
//                        the layer's default and needs no call; `setSource` drops every tile and every load of the source it replaces
//   globe/bodyRender.ts  `renderBody(record, width, cloudWidth, look?)`, and `renderTile(record, z, x, y, look?)` (the determinism test's C5 and C6)
//
// Run the red state: W3Q_GATE=enforce node --experimental-strip-types --test tests/w3q-gen-pipeline.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

// ── stand-ins: a renderer, a page, a worker, a network ───────────────────────────────────────────────────────────────────

const element = () => ({
  style: {}, className: '', children: [], attrs: {}, listeners: {}, clientWidth: 800, clientHeight: 600,
  setAttribute(key, value) { this.attrs[key] = value }, appendChild(child) { this.children.push(child); return child }, remove() {},
  addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener) }, removeEventListener() {},
  getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600}), setPointerCapture() {}, releasePointerCapture() {},
})
globalThis.__GL = {made: [], maxTextureSize: 8192}
globalThis.__GL_STUB = class {
  constructor() { this.domElement = element(); this.capabilities = {maxTextureSize: globalThis.__GL.maxTextureSize, getMaxAnisotropy: () => 8}; this.inits = []; globalThis.__GL.made.push(this) }
  setClearColor() {} setPixelRatio() {} setSize() {} initTexture(texture) { this.inits.push(texture) } render() {} dispose() {} forceContextLoss() {} compile() {}
  setRenderTarget() {} clear() {} getRenderTarget() { return null } getClearColor() {} getClearAlpha() { return 0 } setClearAlpha() {} getSize(v) { return v }
  get info() { return {render: {}} }
}
const threeUrl = import.meta.resolve('three')
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'three' && c.parentURL && !c.parentURL.includes('node_modules')) return {url: 'oi-test:three', shortCircuit: true};
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u === 'oi-test:three') return {format: 'module', shortCircuit: true, source: 'export * from ' + ${JSON.stringify(JSON.stringify(threeUrl))} + '; export const WebGLRenderer = globalThis.__GL_STUB;'};
  const p = new URL(u).pathname;
  if (p.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!p.endsWith('.ts') && !p.endsWith('.tsx')) return n(u, c);
  const source = (await readFile(new URL(u), 'utf8')).replace(/import\\.meta\\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(source, {fileName: p,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

globalThis.window = Object.assign(new EventTarget(), {devicePixelRatio: 1, innerWidth: 800, innerHeight: 600})
globalThis.document = {body: {classList: {add() {}, remove() {}}, dataset: {}}, querySelector: () => null}
globalThis.matchMedia = () => ({matches: false})
globalThis.requestAnimationFrame = () => 0 // frames are stepped by the test (engine.advance), never by the page
globalThis.cancelAnimationFrame = () => {}
globalThis.HTMLImageElement = class {}
globalThis.Image = class extends HTMLImageElement { set src(value) { this.source = value; setTimeout(() => this.onload?.(), 0) } decode() { return Promise.resolve() } }

/** The network: every request is recorded and none is answered (the Earth's own sharp base, asked for after a moment, is among them and is not a tile). */
const network = {requests: [], tiles: () => network.requests.filter(url => /GoogleMapsCompatible|gibs\.earthdata/.test(url))}
globalThis.fetch = url => { network.requests.push(String(url)); return /GoogleMapsCompatible|gibs\.earthdata/.test(String(url)) ? Promise.reject(new Error('stand-in network')) : new Promise(() => {}) }
globalThis.createImageBitmap = () => Promise.resolve({close() {}, width: 256, height: 256})

// The worker. Each job is held; `answerWorker()` lets the held jobs answer, in the order they came. A base picture (a job that names a `width`) is answered with a picture
// of that width whose first byte is the record's seed, so the test can tell whose picture was drawn; anything else (a tile) is answered by the real bodyWorker.ts handler.
const worker = {jobs: [], held: [], scope: {onmessage: null, postMessage() {}}}
globalThis.self = worker.scope
class FakeWorker {
  constructor() { this.onmessage = null; this.onerror = null }
  postMessage(job) { worker.jobs.push(job); worker.held.push({to: this, job}) }
  terminate() {}
}
globalThis.Worker = FakeWorker
const marked = (width, height, mark) => { const data = new Uint8ClampedArray(width * height * 4); data[0] = mark; data[3] = 255; return {width, height, data} }
async function answerWorker() {
  while (worker.held.length) {
    const {to, job} = worker.held.shift()
    if (typeof job.width === 'number') {
      const mark = (job.record?.seed ?? 0) & 255
      to.onmessage?.({data: {id: job.id, image: marked(job.width, job.width / 2, mark), clouds: marked(job.cloudWidth ?? job.width / 2, (job.cloudWidth ?? job.width / 2) / 2, mark)}})
    } else {
      worker.scope.postMessage = answer => to.onmessage?.({data: answer})
      worker.scope.onmessage({data: job})
    }
    await flush()
  }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

const globe = new URL('../src/projections/atlas/src/globe/', import.meta.url)
await import(new URL('bodyWorker.ts', globe).href) // registers the real handler on the stand-in `self`
const body = await import(new URL('body.ts', globe).href)
const {TileLayer} = await import(new URL('tiles.ts', globe).href)
const {tileUrl, GIBS_URL, TILE_PX, MAX_ZOOM} = await import(new URL('tilemath.ts', globe).href)
const THREE = await import(threeUrl)
const lifetime = await import(new URL('../ui/lifetime.ts', globe).href)
const {GlobeEngine} = await import(new URL('engine.ts', globe).href)
/** A module this ticket adds: `{}` until it exists, so the test that needs it fails on an assertion, not on an import. */
async function optional(name) {
  try { return await import(new URL(name, globe).href) } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return {}
    throw error
  }
}


const DIALS = {landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3}, sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}}
const make = (seed, change = {}) => ({
  body_ref: 'body:pipeline', seed, generator: {id: 'fbm-sphere', version: 2},
  landmass: {...DIALS.landmass, ...change.landmass}, climate: {...DIALS.climate, ...change.climate}, sky: {...DIALS.sky, ...change.sky},
})
const dirOf = (lat, lon) => { const c = Math.cos(lat * Math.PI / 180); return [c * Math.cos(lon * Math.PI / 180), Math.sin(lat * Math.PI / 180), -c * Math.sin(lon * Math.PI / 180)] } // data/geo.ts dirFromLatLon

// ── the engine, on the stand-in renderer ────────────────────────────────────────────────────────────────────────────────

async function openGlobe({reduced = false, maxTextureSize = 8192} = {}) {
  globalThis.__GL.maxTextureSize = maxTextureSize
  worker.jobs.length = 0; worker.held.length = 0; network.requests.length = 0
  const life = lifetime.beginLifetime()
  const model = {occ: [], dir: [], colour: [], famPalette: new Map(), located: [], u: []}, time = {update() {}, cursorU: 0, trail: 1, on: 0}
  const engine = new GlobeEngine(element(), model, time, {onPick() {}, onHover() {}, onInteract() {}, onGrab() {}, onPalette() {}}, reduced)
  await engine.ready
  const gl = globalThis.__GL.made.at(-1)
  return {
    engine, gl,
    uniforms: () => engine.earth.mesh.material.uniforms,
    /** The width of the picture the Earth's sphere takes as its small base, and as its sharp one. */
    lo: () => engine.earth.mesh.material.uniforms.uBaseLo.value.image?.width, hi: () => engine.earth.mesh.material.uniforms.uBaseHi.value.image?.width,
    close() { engine.dispose(); life.dispose() },
  }
}
const frames = (g, seconds, step = .05) => g.engine.advance(seconds, step)

test('Q1 the globe is given the widths of the contract: first 256, then 2048 on a small GPU and 4096 on a capable one, each a power of two of tiles', () => {
  assert.ok(body.BODY_WIDTHS, 'body.ts exports BODY_WIDTHS')
  assert.deepEqual({...body.BODY_WIDTHS}, {first: 256, lo: 2048, hi: 4096}, 'the contract of the ticket (§4)')
  // each width is 256 × 2^k, so that the level a base is denser than (tileLevelFor) is a whole level
  for (const [name, width] of Object.entries(body.BODY_WIDTHS)) assert.ok(Number.isInteger(Math.log2(width / TILE_PX)), `${name} (${width}) is ${TILE_PX} times a power of two`)
})

test('Q2 a tile is wanted only where it is denser than the base: level log2(base/256) + 1, the rule the Earth’s GIBS tiles follow', async () => {
  const tiles = await optional('bodyTiles.ts')
  assert.equal(typeof tiles.tileLevelFor, 'function', 'bodyTiles.ts exports tileLevelFor(baseWidth)')
  // GIBS: the 8k base (8192 wide) asks tiles from level 6 and the 4k base from 5 (engine.ts upgradeBase: `which === '8k' ? 6 : 5`)
  assert.equal(tiles.tileLevelFor(8192), 6); assert.equal(tiles.tileLevelFor(4096), 5)
  assert.equal(tiles.tileLevelFor(2048), 4); assert.equal(tiles.tileLevelFor(256), 1)
  for (const width of [256, 512, 1024, 2048, 4096, 8192]) assert.equal(2 ** tiles.tileLevelFor(width) * TILE_PX, 2 * width, `level ${tiles.tileLevelFor(width)} has twice the pixels round the equator that a ${width}-wide base has`)
})

test('Q3 the globe draws a first image at once: the call that gives it a body returns with the body drawn, `first` wide, before any worker has answered', async () => {
  const g = await openGlobe()
  try {
    assert.equal(typeof body.BODY_WIDTHS, 'object', 'body.ts exports BODY_WIDTHS')
    const earthWidth = g.lo()
    g.engine.setBody(make(5))
    assert.equal(g.engine.earth.generated, true, 'the body stands in the Earth’s place at once')
    assert.equal(g.lo(), body.BODY_WIDTHS.first, `its first picture is ${body.BODY_WIDTHS.first} wide (the Earth’s was ${earthWidth})`)
    assert.equal(g.engine.bodyPictureState, 'coarse', 'and says the sharp one is still being made')
    assert.ok(worker.held.length >= 1, 'the larger ones are with the worker')
  } finally { g.close() }
})

test('Q4 then the larger ones, as the worker finishes them: the pictures come in order of width and the last is `lo` on a small GPU and `hi` on a capable one', async () => {
  assert.ok(body.BODY_WIDTHS, 'body.ts exports BODY_WIDTHS')
  for (const [maxTextureSize, expected] of [[2048, 'lo'], [4096, 'hi'], [8192, 'hi']]) {
    const g = await openGlobe({maxTextureSize})
    try {
      g.engine.setBody(make(5))
      await answerWorker()
      const widths = worker.jobs.filter(job => typeof job.width === 'number').map(job => job.width)
      assert.ok(widths.length >= 1, `${maxTextureSize}: the worker was asked for a base picture`)
      assert.deepEqual(widths, [...widths].sort((a, b) => a - b), `${maxTextureSize}: the worker is asked in order of width (${widths.join(', ')})`)
      assert.equal(widths.at(-1), body.BODY_WIDTHS[expected], `${maxTextureSize}: the last picture is BODY_WIDTHS.${expected} (${body.BODY_WIDTHS[expected]}); the engine asked for ${widths.at(-1)}`)
      assert.equal(g.engine.bodyPictureState, 'sharp', `${maxTextureSize}: the sharp picture has landed`)
      assert.equal(g.hi(), body.BODY_WIDTHS[expected], `${maxTextureSize}: and is the sharp base the sphere shows`)
    } finally { g.close() }
  }
})

test('Q5 each picture is swapped in as the Earth’s 2k and 8k are: uploaded ahead of its use, smaller before larger', async () => {
  assert.ok(body.BODY_WIDTHS, 'body.ts exports BODY_WIDTHS')
  const g = await openGlobe({maxTextureSize: 8192})
  try {
    const before = g.gl.inits.length
    g.engine.setBody(make(5))
    await answerWorker()
    const widths = g.gl.inits.slice(before).map(texture => texture.image?.width).filter(Number.isFinite)
    assert.ok(widths.includes(body.BODY_WIDTHS.hi), `the sharp picture is uploaded (${widths.join(', ')})`)
    for (let k = 1; k < widths.length; k++) assert.ok(widths[k] >= widths[k - 1], `uploads come smaller before larger: ${widths.join(', ')}`)
  } finally { g.close() }
})

test('Q6 the same record and look drawn twice is one drawing; a new look or a new record is another; the Earth is given back for null', async () => {
  const g = await openGlobe()
  try {
    const record = make(5)
    g.engine.setBody(record); await answerWorker()
    const jobs = worker.jobs.length
    g.engine.setBody(record); g.engine.setBody({...record}); g.engine.setBody(record, {}); g.engine.setBody(record, {barren: 0})
    assert.equal(worker.jobs.length, jobs, 'the same record and look (no look, an empty look, barren 0) is not drawn again')
    g.engine.setBody(record, {barren: .5})
    assert.ok(worker.jobs.length > jobs, 'a new look is drawn')
    assert.match(JSON.stringify(worker.jobs.at(-1)), /"barren":\s*0?\.5\b/, 'and the worker is told the look')
    const afterLook = worker.jobs.length
    g.engine.setBody({...record, seed: 6}, {barren: .5})
    assert.ok(worker.jobs.length > afterLook, 'a new record is drawn')
    g.engine.setBody(null)
    assert.equal(g.engine.earth.generated, false, 'the Earth is given back')
    assert.equal(g.engine.body, null)
  } finally { g.close() }
})

test('Q7 a picture for a record that is gone is not drawn: a later record, or the Earth, stands over a late answer', async () => {
  const g = await openGlobe()
  try {
    g.engine.setBody(make(5)); g.engine.setBody(make(6))
    await answerWorker()
    assert.equal(markOfImage(g.engine.earth.mesh.material.uniforms.uBaseHi.value.image), 6, 'only the later record’s picture is the sharp base')
    g.engine.setBody(make(7)); g.engine.setBody(null)
    await answerWorker()
    assert.equal(g.engine.earth.generated, false, 'and a body put down by the time its picture came is not drawn')
    assert.equal(g.engine.bodyPictureState, 'earth')
  } finally { g.close() }
})

// ── the tile layer ──────────────────────────────────────────────────────────────────────────────────────────────────────

const common = () => ({uDensity: {value: null}, uLightDir: {value: new THREE.Vector3()}, uSunDir: {value: new THREE.Vector3()}, uSunMix: {value: 0}, uFog: {value: new THREE.Vector3()},
  uGlow: {value: new THREE.Vector3()}, uDeep: {value: new THREE.Vector3()}, uCore: {value: new THREE.Vector3()}, uSpec: {value: 0}})
const layerOf = (reduced = true) => new TileLayer({capabilities: {getMaxAnisotropy: () => 4}, initTexture() {}}, common(), reduced)
/** A layer that takes a tile source: red, on an assertion, where TileLayer has no `setSource` yet. */
const sourcedLayer = (reduced = true) => { const layer = layerOf(reduced); assert.equal(typeof layer.setSource, 'function', 'TileLayer has setSource(source)'); return layer }
function cameraAt(lat, lon, dist = 1.02) {
  const camera = new THREE.PerspectiveCamera(38, 800 / 600, .0001, 60), [x, y, z] = dirOf(lat, lon)
  camera.position.set(x * dist, y * dist, z * dist); camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(); camera.updateProjectionMatrix(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
  return camera
}
async function run(layer, camera, count, dt = .06) { for (let k = 0; k < count; k++) { layer.update(camera, dt, 800, 600); await flush() } }
const tileImage = mark => { const data = new Uint8ClampedArray(TILE_PX * TILE_PX * 4); data[0] = mark; data[3] = 255; return {width: TILE_PX, height: TILE_PX, data} }
/** A tile source that records what it is asked, answers at once (or holds its answers until `release`), and marks its pictures: with `mark` (the source's own), or by
 * the order of the ask (`perCall`: 1 for the first ask, 2 for the second, and so on). */
function fakeSource(mark, {hold = false, perCall = false} = {}) {
  const calls = [], held = []
  return {
    mark, calls, held,
    load(z, x, y, signal) {
      const index = calls.length
      calls.push({z, x, y, signal, key: `${z}/${x}/${y}`})
      const image = () => tileImage(perCall ? (index % 250) + 1 : mark)
      return hold ? new Promise(resolve => { held[index] = () => resolve(image()) }) : Promise.resolve(image())
    },
    release(from = 0, to = held.length) { for (let k = from; k < to; k++) held[k]?.() },
  }
}
const meshes = layer => layer.group.children
/** The mark a picture was given (its first byte; a picture uploaded to a texture may have its rows turned over, which puts it at the first byte of the last row). */
const markOfImage = image => image.data[0] || image.data[(image.height - 1) * image.width * 4]
const markOf = mesh => markOfImage(mesh.material.uniforms.uMap.value.image)
/** Latitude and longitude of the `k`th of `n` places spread over the sphere (a golden-angle spiral inside 60°). */
const place = k => ({lat: 60 * Math.sin(k * 2.399963229728653 * .7), lon: ((k * 2.399963229728653 * 57.29578) % 360) - 180})

test('G1 the default tile source is GIBS and is unchanged: tiles are asked of the NASA service by its URL, only from the level denser than the base, one request each', async () => {
  const layer = layerOf(), camera = cameraAt(30, 20)
  network.requests.length = 0
  try {
    await run(layer, camera, 8)
    const urls = network.tiles()
    assert.ok(urls.length >= 1, 'a close camera asks for tiles')
    assert.equal(new Set(urls).size, urls.length, 'each tile once')
    for (const url of urls) {
      const m = new RegExp(`^${GIBS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(\\d+)/(\\d+)/(\\d+)\\.jpeg$`).exec(url)
      assert.ok(m, `${url} is a GIBS tile URL`)
      assert.equal(url, tileUrl(+m[1], +m[3], +m[2]), 'and is the URL tilemath.ts gives for that tile')
      assert.ok(+m[1] >= layer.minEmit && +m[1] <= MAX_ZOOM, `at a level from ${layer.minEmit} to ${MAX_ZOOM} (${m[1]})`)
    }
  } finally { layer.release() }
})

test('G2 a tile source is the layer’s to set: a procedural source is asked for tiles and the network is not', async () => {
  const layer = sourcedLayer()
  try {
    const source = fakeSource(2)
    layer.setSource(source)
    layer.minEmit = 4
    network.requests.length = 0
    await run(layer, cameraAt(30, 20), 12)
    assert.ok(source.calls.length >= 1, 'the source is asked for tiles')
    assert.deepEqual(network.tiles(), [], 'and no tile is fetched from the network')
    assert.ok(layer.stats.ready >= 1 && layer.group.children.length >= 1, 'and its tiles are uploaded and in the scene')
    assert.ok(meshes(layer).every(mesh => markOf(mesh) === 2), 'drawn from the source’s own pictures')
  } finally { layer.release() }
})

test('G3 tiles are asked only where denser than the base: nothing under `minEmit`, and at a distance whose tiles are no denser than the base, nothing at all', async () => {
  const tiles = await optional('bodyTiles.ts')
  assert.equal(typeof tiles.tileLevelFor, 'function', 'bodyTiles.ts exports tileLevelFor(baseWidth)')
  const asked = async (dist, minEmit) => {
    const layer = sourcedLayer(), source = fakeSource(2)
    try { layer.setSource(source); layer.minEmit = minEmit; await run(layer, cameraAt(30, 20, dist), 12); return [...new Set(source.calls.map(call => call.z))].sort((a, b) => a - b) } finally { layer.release() }
  }
  for (const dist of [2.0, 1.3, 1.02]) {
    const natural = await asked(dist, 3) // every level the camera could use (the root level of the quadtree is 3)
    assert.ok(natural.length >= 1, `at ${dist} radii the camera uses tiles`)
    const deepest = natural.at(-1)
    assert.deepEqual(await asked(dist, deepest + 1), [], `at ${dist} radii tiles are at level ${deepest}: a base that is denser than that needs none (minEmit ${deepest + 1})`)
    assert.deepEqual(await asked(dist, deepest), [deepest], `and a base that is less dense is given them, and no shallower ones (minEmit ${deepest})`)
  }
  for (const base of [2048, 4096]) {
    const levels = await asked(1.3, tiles.tileLevelFor(base))
    assert.ok(levels.length >= 1 && levels.every(z => z >= tiles.tileLevelFor(base)), `a ${base}-wide base asks levels ${tiles.tileLevelFor(base)} and deeper (asked ${levels.join(', ')})`)
  }
  assert.deepEqual(await asked(3.3, tiles.tileLevelFor(4096)), [], 'from far away the base is as dense as the screen: no tile is asked')
})

test('G4 no flash: a tile fades in over its base and is never drawn whole at its first frame', async () => {
  const layer = sourcedLayer(false) // motion not reduced: the fade is the layer's FADE_IN
  try {
    const source = fakeSource(2)
    layer.setSource(source); layer.minEmit = 4
    const camera = cameraAt(30, 20), alphas = []
    for (let k = 0; k < 30; k++) {
      layer.update(camera, .05, 800, 600); await flush()
      const shown = meshes(layer).filter(mesh => mesh.visible)
      if (shown.length) alphas.push(Math.max(...shown.map(mesh => mesh.material.uniforms.uAlpha.value)))
    }
    assert.ok(alphas.length >= 3, `a tile is drawn (alphas ${alphas.map(x => +x.toFixed(2)).join(', ')})`)
    assert.ok(alphas[0] < .5, `its first visible frame is faint (${alphas[0]}), not a pop`)
    for (let k = 1; k < alphas.length; k++) assert.ok(alphas[k] >= alphas[k - 1] - 1e-9, `and it only grows: ${alphas.map(x => +x.toFixed(2)).join(', ')}`)
    assert.ok(alphas.at(-1) >= .99, 'to whole')
  } finally { layer.release() }
})

test('G5 each tile is asked once while it is wanted: a tile that stands is not asked for again', async () => {
  const layer = sourcedLayer(), source = fakeSource(2)
  try {
    layer.setSource(source); layer.minEmit = 4
    await run(layer, cameraAt(30, 20), 40)
    const keys = source.calls.map(call => call.key)
    assert.ok(keys.length >= 1, 'tiles are asked')
    assert.equal(new Set(keys).size, keys.length, `no tile is asked twice (${keys.length} asks, ${new Set(keys).size} tiles)`)
  } finally { layer.release() }
})

test('G6 a tile nobody wants any more is cancelled and its late answer is dropped: leaving a place leaves nothing of it', async () => {
  const layer = sourcedLayer(), source = fakeSource(0, {hold: true, perCall: true})
  try {
    layer.setSource(source); layer.minEmit = 4
    await run(layer, cameraAt(30, 20), 6)
    const left = source.calls.length
    assert.ok(left >= 1, 'tiles were asked for at the first place')
    await run(layer, cameraAt(-30, 160), 12, .1) // the far side of the world, for longer than a load is kept (CANCEL_GRACE .3 s)
    assert.ok(source.calls.slice(0, left).every(call => call.signal.aborted), 'the asks for the place left behind are aborted')
    assert.ok(source.calls.length > left, 'and the new place is asked')
    source.release(0, left) // the answers for the first place come late
    await run(layer, cameraAt(-30, 160), 4)
    assert.ok(meshes(layer).every(mesh => markOf(mesh) > left), 'no tile of the place left behind is drawn (the pictures drawn are all from asks made after it)')
    source.release(left)
    await run(layer, cameraAt(-30, 160), 12)
    assert.ok(meshes(layer).length >= 1 && meshes(layer).every(mesh => markOf(mesh) > left), 'and the new place’s tiles come')
  } finally { layer.release() }
})

test('G7 the layer keeps a bounded number of tiles, the ones used last: a long sweep never holds more than the bound, and what is evicted is the oldest', async () => {
  const layer = sourcedLayer(), source = fakeSource(2)
  const bound = typeof layer.maxTiles === 'number' ? layer.maxTiles : +/const MAX_TILES = (\d+)/.exec(readFileSync(new URL('tiles.ts', globe), 'utf8'))?.[1]
  assert.ok(bound >= 64 && bound <= 512, `the layer names a bound on the tiles it keeps (MAX_TILES in tiles.ts, or layer.maxTiles): ${bound}; between 64 and 512 (a tile is 256 KB in memory and as much on the GPU)`)
  try {
    layer.setSource(source); layer.minEmit = 4
    let most = 0, spots = 0
    while (source.calls.length < bound + 80 && spots < 600) {
      const {lat, lon} = place(spots++), camera = cameraAt(lat, lon)
      for (let k = 0; k < 7; k++) { layer.update(camera, .06, 800, 600); await flush(); most = Math.max(most, layer.stats.ready) }
    }
    assert.ok(source.calls.length >= bound + 80, `the sweep asked for more tiles (${source.calls.length}) than the layer keeps (${bound})`)
    assert.ok(most <= bound + 24, `at no frame did the layer hold more than the bound (most ${most}, bound ${bound})`)
    // the first place was left long ago: its tiles are gone, so coming back asks for them again; the last place was just left: its tiles stand
    const firstPlace = place(0), lastPlace = place(spots - 1)
    await run(layer, cameraAt(lastPlace.lat, lastPlace.lon), 24) // long enough that every tile of the last place stands
    const before = source.calls.length
    await run(layer, cameraAt(lastPlace.lat, lastPlace.lon), 7)
    const againLast = source.calls.length - before
    await run(layer, cameraAt(firstPlace.lat, firstPlace.lon), 7)
    const againFirst = source.calls.length - before - againLast
    assert.equal(againLast, 0, 'the place visited last is still held: nothing is asked for again')
    assert.ok(againFirst >= 1, 'the place visited first has been let go: its tiles are asked for again')
  } finally { layer.release() }
})

test('G8 a change of body drops the old body’s tiles: `setSource` frees every tile and aborts every ask of the source it replaces, and a late answer is not drawn', async () => {
  const layer = sourcedLayer(), a = fakeSource(1), slow = fakeSource(3, {hold: true}), b = fakeSource(2)
  try {
    layer.setSource(a); layer.minEmit = 4
    const camera = cameraAt(30, 20)
    await run(layer, camera, 12)
    assert.ok(meshes(layer).length >= 1 && meshes(layer).every(mesh => markOf(mesh) === 1), 'the first body’s tiles stand')
    layer.setSource(slow)
    assert.equal(meshes(layer).length, 0, 'a new source frees the old tiles at once')
    await run(layer, camera, 6)
    const asks = [...slow.calls]
    assert.ok(asks.length >= 1, 'the slow source is asked')
    layer.setSource(b)
    assert.ok(asks.every(call => call.signal.aborted), 'the asks of the source that went are aborted')
    slow.release() // its answers come late
    await run(layer, camera, 12)
    assert.ok(meshes(layer).length >= 1, 'the new body’s tiles come')
    assert.ok(meshes(layer).every(mesh => markOf(mesh) === 2), 'and only its own: nothing from the sources that went is drawn')
  } finally { layer.release() }
})

// ── the globe's tiles ───────────────────────────────────────────────────────────────────────────────────────────────────

test('E1 a generated body keeps its tile layer: `earth.generated` no longer switches the close-zoom layer off', async () => {
  const g = await openGlobe()
  try {
    g.engine.setBody(make(5))
    await answerWorker()
    frames(g, .2)
    assert.equal(g.engine.tiles.group.visible, true, 'the tile layer is drawn over a generated body')
  } finally { g.close() }
})

test('E2 at the closest camera a generated body is given procedural tiles from the worker, and the network is never asked for one', async () => {
  const g = await openGlobe({maxTextureSize: 4096})
  try {
    // a body with land under the camera, so tiles are wanted at once; the camera is put down at 1.02 radii over a point of it
    g.engine.setBody(make(5))
    await answerWorker()
    g.engine.rig.lat = 30; g.engine.rig.lon = 20; g.engine.rig.dist = g.engine.rig.targetDist = 1.02
    const before = worker.jobs.length
    for (let k = 0; k < 40; k++) { frames(g, .15, .05); await answerWorker() }
    const tileJobs = worker.jobs.slice(before)
    assert.ok(tileJobs.length >= 1, 'the worker is asked for tiles')
    assert.ok(g.engine.tiles.stats.ready >= 1 && g.engine.tiles.group.children.length >= 1, `and its tiles are in the scene (ready ${g.engine.tiles.stats.ready})`)
    assert.deepEqual(network.tiles(), [], 'no tile of a generated body is fetched from the network')
    assert.ok(g.engine.tiles.stats.drawn >= 1, `a tile is drawn (${g.engine.tiles.stats.drawn})`)
  } finally { g.close() }
})

test('E3 the tile layer asks from the level the sharp base is less dense than: `minEmit` follows the base that stands', async () => {
  const tiles = await optional('bodyTiles.ts')
  assert.equal(typeof tiles.tileLevelFor, 'function', 'bodyTiles.ts exports tileLevelFor(baseWidth)')
  assert.ok(body.BODY_WIDTHS, 'body.ts exports BODY_WIDTHS')
  for (const [maxTextureSize, name] of [[2048, 'lo'], [4096, 'hi']]) {
    const g = await openGlobe({maxTextureSize})
    try {
      g.engine.setBody(make(5))
      await answerWorker()
      assert.equal(g.engine.tiles.minEmit, tiles.tileLevelFor(body.BODY_WIDTHS[name]), `a ${body.BODY_WIDTHS[name]}-wide base (BODY_WIDTHS.${name}) asks tiles from level ${tiles.tileLevelFor(body.BODY_WIDTHS[name])}`)
    } finally { g.close() }
  }
})

test('E4 and the Earth is given back its own layer: with no body the tiles are the GIBS service’s again', async () => {
  const g = await openGlobe({maxTextureSize: 8192})
  try {
    g.engine.setBody(make(5)); await answerWorker(); frames(g, .2)
    g.engine.setBody(null)
    g.engine.rig.lat = 30; g.engine.rig.lon = 20; g.engine.rig.dist = g.engine.rig.targetDist = 1.02
    network.requests.length = 0
    for (let k = 0; k < 20; k++) { frames(g, .15, .05); await flush() }
    assert.ok(network.tiles().length >= 1, 'the Earth’s close zoom asks the GIBS service')
    for (const url of network.tiles()) assert.ok(url.startsWith(GIBS_URL), `${url} is a GIBS tile`)
  } finally { g.close() }
})

// ── what the globe draws over a generated body ─────────────────────────────────────────────────────────────────────────
// The owner's globe screen pass found: the Earth's presences (the white dots, arcs and markers of the Earth's occurrences, and the glow they tint the ground with) drawn over
// a generated body; a rectangle of tile, clear and dark, in the middle of a base that has its clouds; a new empty world as a dark navy ball. None of these was a failure of
// the pictures (the gate held every one of them) but of what the globe does with them, so these tests run the engine, not the generator.

test('E5 a generated body is not the Earth: none of the Earth’s presences is drawn, tinted under or picked on it, and they all come back with the Earth', async () => {
  const g = await openGlobe()
  try {
    const e = g.engine, state = () => ({
      presences: e.presences.mesh.visible, arcs: e.arcs.group.visible,
      markers: [e.markers.sel, e.markers.hover, e.markers.head].map(m => !m.suppressed),
      glow: e.earth.u.uDensity.value === e.presences.densityTarget.texture, picked: e.surfaceOn,
    })
    const shown = {presences: true, arcs: true, markers: [true, true, true], glow: true, picked: true}, gone = {presences: false, arcs: false, markers: [false, false, false], glow: false, picked: false}
    frames(g, .2)
    assert.deepEqual(state(), shown, 'the Earth shows its presences, their arcs and markers, the glow under them, and picks them')
    let rendered = 0
    const renderDensity = e.presences.renderDensity.bind(e.presences)
    e.presences.renderDensity = () => { rendered++; renderDensity() }
    e.setBody(make(5)); frames(g, .2)
    assert.deepEqual(state(), gone, 'a generated body shows none of them: the presences, the arcs, the markers, and the glow the presences tint the ground with, and nothing is picked')
    const counted = rendered
    frames(g, .3)
    assert.equal(rendered, counted, 'and the glow is not even drawn for it')
    await answerWorker(); frames(g, .2)
    assert.deepEqual(state(), gone, 'nor when its sharp pictures have come')
    g.engine.setBody(make(6)); frames(g, .2)
    assert.deepEqual(state(), gone, 'nor for another body')
    e.setBody(null); frames(g, .2)
    assert.deepEqual(state(), shown, 'the Earth, given back, has them again')
    assert.ok(rendered > counted, 'and draws the glow again')
  } finally { g.close() }
})

/** The block of statements in a fragment shader's `main` that stands the body's clouds over the ground: from the cloud test to its closing brace, with the coordinate
 * the lookup goes by (`UV`) written in place of the varying the shader has it in. */
function skyBlock(frag, uv) {
  const main = frag.slice(frag.indexOf('void main'))
  const open = main.indexOf('if (uCloudMix'), from = main.indexOf('{', open)
  if (open < 0) return ''
  let depth = 0, end = from
  for (; end < main.length; end++) { if (main[end] === '{') depth++; else if (main[end] === '}' && --depth === 0) break }
  return main.slice(open, end + 1).replace(new RegExp(`\\b${uv}\\b`, 'g'), 'UV').replace(/\s+/g, ' ').trim()
}

test('E6 a tile has the sky its sphere has: the same clouds, from the same layer, carried by the same wind, over its ground, so a tile is not a clear rectangle in a clouded base', async () => {
  const shaders = await import(new URL('shaders.ts', globe).href)
  const sphere = skyBlock(shaders.EARTH_FRAG, 'vUv'), tile = skyBlock(shaders.TILE_FRAG, 'vDens')
  assert.ok(sphere.includes('texture2D(uCloud'), 'the sphere’s shader stands the cloud layer over the ground')
  assert.ok(tile.includes('texture2D(uCloud'), 'and the tile’s shader stands it over the ground as well (a tile without it is a clear, dark patch where its base is washed with cloud)')
  assert.equal(tile, sphere, 'the same statements: the same mask, lit by the same light, the same cover, at the same place (a tile’s own coordinate, in the sphere’s equirect)')
  assert.ok(/uCloudMix/.test(tile) && /uWeatherT/.test(tile), 'carried by the wind of the occasion')
  // and the layer is the sphere's own, by reference, so that a sky that comes after a tile (the sharp base's clouds come seconds after the first tiles) reaches it
  const g = await openGlobe({maxTextureSize: 4096})
  try {
    g.engine.setBody(make(5, {sky: {clouds: .9}}))
    await answerWorker()
    g.engine.rig.lat = 30; g.engine.rig.lon = 20; g.engine.rig.dist = g.engine.rig.targetDist = 1.02
    for (let k = 0; k < 40; k++) { frames(g, .15, .05); await answerWorker() }
    const made = g.engine.tiles.group.children
    assert.ok(made.length >= 1, 'tiles are made')
    const own = g.uniforms()
    assert.ok(own.uCloudMix.value === 1, 'the sphere draws the clouds')
    for (const mesh of made) {
      const u = mesh.material.uniforms
      for (const name of ['uCloud', 'uCloudMix', 'uAir', 'uWeatherT', 'uWeatherRate']) assert.ok(u[name] && u[name] === own[name], `the tile’s ${name} is the sphere’s own uniform, not a copy of its value`)
    }
  } finally { g.close() }
})

test('E7 a new empty world is a grey dust moon on the globe, at every width and in every tile: no navy sea, no cloud, no air, the look carried to the tiles', async () => {
  const record = make(5, {sky: {clouds: .9, atmosphere: .9}}), saturation = ({data}) => {
    let s = 0, n = 0, blue = 0
    for (let k = 0; k < data.length; k += 4) { const r = data[k], gr = data[k + 1], b = data[k + 2]; s += Math.max(r, gr, b) - Math.min(r, gr, b); blue += b - r; n++ }
    return {chroma: s / n, blue: blue / n}
  }
  const g = await openGlobe({maxTextureSize: 4096})
  try {
    g.engine.setBody(record, {barren: 1})
    const small = g.uniforms().uBaseLo.value.image, first = saturation(small)
    assert.ok(first.chroma < 22 && first.blue < 10, `its first picture is grey, with a sea of dust and no blue (mean chroma ${first.chroma.toFixed(1)}, mean blue over red ${first.blue.toFixed(1)}); the lived world beside it is far from grey`)
    const lived = (() => { g.engine.setBody(record); return saturation(g.uniforms().uBaseLo.value.image) })()
    assert.ok(lived.chroma > 2 * first.chroma || lived.blue > 3 * Math.max(first.blue, 1), `and the unchanged look of the same record is not (chroma ${lived.chroma.toFixed(1)}, blue ${lived.blue.toFixed(1)})`)
    g.engine.setBody(record, {barren: 1})
    worker.held.length = 0
    g.engine.rig.lat = 30; g.engine.rig.lon = 20; g.engine.rig.dist = g.engine.rig.targetDist = 1.02
    const before = worker.jobs.length
    for (let k = 0; k < 40; k++) { frames(g, .15, .05); await answerWorker() }
    const sent = worker.jobs.slice(before), bases = worker.jobs.filter(job => typeof job.width === 'number'), tilesAsked = sent.filter(job => typeof job.z === 'number')
    assert.ok(bases.length >= 1 && tilesAsked.length >= 1, 'the sharp bases and the tiles are made')
    assert.ok(tilesAsked.every(job => job.look && job.look.barren === 1), 'every tile asked of the worker is asked with the look barren 1: the look reaches the tiles, not only the base')
    const u = g.uniforms()
    assert.equal(u.uCloudMix.value, 0, 'no cloud layer is drawn over a barren world, whatever its clouds dial (the base’s cloud mask is empty and the mix is 0)')
    assert.equal(u.uAir.value, 0, 'and its air is 0 (the rim of the sphere is its own, not an atmosphere)')
    assert.equal(g.engine.shell.air.value, 0, 'nor is the shell round it lit')
    // a tile the real handler made, for the same look, is the base's own grey
    const grey = tilesAsked.find(job => job.look?.barren === 1)
    worker.scope.postMessage = answer => { grey.answer = answer }
    worker.scope.onmessage({data: {...grey, id: -1}})
    const tile = saturation(grey.answer.tile)
    assert.ok(tile.chroma < 22 && tile.blue < 10, `and so is a tile of it (mean chroma ${tile.chroma.toFixed(1)}, blue ${tile.blue.toFixed(1)})`)
  } finally { g.close() }
})

test('B2 the globe hands the grade the look: `setBody(record, {barren})` sets `uBarren` (the sphere’s and the tiles’, the same uniform), a lived world and the Earth have 0', async () => {
  const g = await openGlobe({maxTextureSize: 4096})
  try {
    const own = () => g.uniforms().uBarren
    assert.ok(own(), 'the earth material carries uBarren')
    assert.equal(own().value, 0, 'the Earth is not barren')
    g.engine.setBody(make(5), {barren: 1}); frames(g, .1)
    assert.equal(own().value, 1, 'a barren world is graded as one')
    g.engine.setBody(make(5), {barren: .4}); frames(g, .1)
    assert.equal(own().value, .4, 'a half barren one by half')
    g.engine.setBody(make(5), {barren: 7}); frames(g, .1)
    assert.equal(own().value, 1, 'a look out of range is held to its range (body.ts barrenOf)')
    g.engine.setBody(make(5)); frames(g, .1)
    assert.equal(own().value, 0, 'a lived world is not')
    g.engine.setBody(make(5), {barren: 1}); await answerWorker()
    g.engine.rig.lat = 30; g.engine.rig.lon = 20; g.engine.rig.dist = g.engine.rig.targetDist = 1.02
    for (let k = 0; k < 40; k++) { frames(g, .15, .05); await answerWorker() }
    const made = g.engine.tiles.group.children
    assert.ok(made.length >= 1, 'tiles are made')
    for (const mesh of made) assert.ok(mesh.material.uniforms.uBarren === own(), 'a tile of it is graded by the sphere’s own uniform, so its grey is the sphere’s')
    g.engine.setBody(null); frames(g, .1)
    assert.equal(own().value, 0, 'the Earth, given back, is not barren')
    assert.equal(g.uniforms().uAir.value, 1, 'and has its own air (a tile of the Earth is drawn with the air of its sphere: 1)')
  } finally { g.close() }
})

test('E8 the sky knows how close the camera is: `uPxRad`, the radians of the body one screen pixel spans, is handed to the sphere and its tiles, and shrinks as the camera comes in', async () => {
  const g = await openGlobe({maxTextureSize: 4096})
  try {
    g.engine.setBody(make(5, {sky: {clouds: .9}})); await answerWorker()
    const read = () => g.uniforms().uPxRad?.value
    assert.ok(g.uniforms().uPxRad, 'the earth material carries uPxRad')
    g.engine.rig.dist = g.engine.rig.targetDist = 3.2; frames(g, .3)
    const far = read()
    g.engine.rig.dist = g.engine.rig.targetDist = 1.35; frames(g, .3)
    const mid = read()
    g.engine.rig.dist = g.engine.rig.targetDist = 1.05; frames(g, .3)
    const near = read()
    assert.ok(far > 0 && mid > 0 && near > 0, `a pixel spans some of the body (far ${far}, mid ${mid}, near ${near} radians)`)
    assert.ok(far > 2 * mid && mid > 2 * near, `and less the nearer the camera is: ${far}, ${mid}, ${near} radians a pixel`)
    g.engine.rig.lat = 30; g.engine.rig.lon = 20
    for (let k = 0; k < 40; k++) { frames(g, .15, .05); await answerWorker() }
    const made = g.engine.tiles.group.children
    assert.ok(made.length >= 1 && made.every(mesh => mesh.material.uniforms.uPxRad === g.uniforms().uPxRad), 'the tiles take the sphere’s own uniform')
  } finally { g.close() }
})

test('E9 the globe tells the shader how fine its pictures are: `uTexRad` for the sphere and for each tile, and `uDetail` 1 for a generated body and 0 for the Earth', async () => {
  const g = await openGlobe({maxTextureSize: 4096})
  try {
    const u = () => g.uniforms()
    assert.ok(u().uDetail && u().uTexRad, 'the earth material carries uDetail and uTexRad')
    assert.equal(u().uDetail.value, 0, 'the Earth’s imagery is drawn as it was: no added detail')
    g.engine.setBody(make(5)); await answerWorker(); frames(g, .2)
    assert.equal(u().uDetail.value, 1, 'a generated body has the detail')
    const hi = body.BODY_WIDTHS.hi
    assert.ok(Math.abs(u().uTexRad.value - 2 * Math.PI / hi) < 1e-9, `the sphere’s texel is a ${hi}-wide picture’s: ${u().uTexRad.value} radians (${2 * Math.PI / hi})`)
    g.engine.rig.lat = 30; g.engine.rig.lon = 20; g.engine.rig.dist = g.engine.rig.targetDist = 1.02
    for (let k = 0; k < 40; k++) { frames(g, .15, .05); await answerWorker() }
    const made = g.engine.tiles.group.children
    assert.ok(made.length >= 1, 'tiles are made')
    for (const mesh of made) {
      const z = Math.round(Math.log2(2 * Math.PI / (mesh.material.uniforms.uTexRad.value * 256)))
      assert.ok(z >= 5 && z <= 8 && Math.abs(mesh.material.uniforms.uTexRad.value - 2 * Math.PI / 2 ** z / 256) < 1e-12, `a tile’s texel is its level’s: ${mesh.material.uniforms.uTexRad.value} radians (level ${z})`)
      assert.ok(mesh.material.uniforms.uDetail === u().uDetail, 'and its detail is the sphere’s own uniform')
    }
    g.engine.setBody(null); frames(g, .2)
    assert.equal(u().uDetail.value, 0, 'the Earth, given back, has none')
  } finally { g.close() }
})

// ── the time a body takes ───────────────────────────────────────────────────────────────────────────────────────────────

test('T1 a 2048-wide body is made in the time a CPU thread can spend on it (the ticket aims at 5 s; the gate allows 20)', () => {
  // The ticket's aim is 5 s on a CPU thread, "by tables and typed arrays, not by lowering the standard". The suite runs four test files at once, so a machine is shared by
  // four: twice the aim. The lead's gate (w3q-planet-gate.test.mjs, B) allows 20 s for the same image on the four bodies; this holds the nearer number for one.
  // The time the thread itself spends (process.cpuUsage: user and system), not the clock on the wall: a thread that waits its turn on a machine other sessions keep busy (a load of 16 to 22 on
  // 20 Oct, 2026) is not slow. The wall clock read 10.4 s and 13.4 s for the same image whose thread spent 5.5 s; the same code unloaded takes 2.7 to 3.9 s.
  const AIM = 5000, SHARED = 2
  const c0 = process.cpuUsage(), image = body.bodyImage(make(20261018), 2048), used = process.cpuUsage(c0), ms = (used.user + used.system) / 1000
  assert.equal(image.width, 2048)
  assert.ok(ms <= AIM * SHARED, `a 2048-wide body took ${Math.round(ms)} ms of its thread (the aim is ${AIM}; at most ${AIM * SHARED} on a shared machine)`)
})
