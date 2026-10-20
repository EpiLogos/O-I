// T-PROCEDURAL-BODY, Lane A: the body's look and its weather. Ticket §5 "Look and weather":
//   `look.barren` takes a body toward a grey, airless, dry moon: land loses its colour, the sea draws back to dust, the cloud mask empties,
//   `airOf` falls to 0; monotone in between. Weather is `weatherShift`: clouds are carried at a speed that differs by latitude band, a pure
//   function of the seed, the latitude and the time; the shader slides the mask by it through a uniform (`uWeatherT`), so a past occasion
//   shows the weather it had and Now moves slowly; reduced motion holds it still.
//
// (That the cloud cover rises with the clouds dial, and that its bands follow latitude, are the dials test's A3 and A4: w3q-gen-dials.test.mjs.)
//
// Channels: scripted, and code-reading for the shader. The generator is the shell's own TypeScript run in memory. The GPU is not run: the
// shader's GLSL is read as text (the uniform is declared and is used in the cloud lookup), and the globe engine runs with a stand-in
// WebGLRenderer so that what the engine does with an occasion and with the reduced-motion setting is observed on the uniform it hands the
// shader. Records are FIXTURES shaped to the owner's contract.
//
// Run the red state: W3Q_GATE=enforce node --experimental-strip-types --test tests/w3q-gen-look-weather.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'
import {waterMask} from './lib/planetMetrics.mjs'

// A renderer that does nothing, standing in for three.js's WebGLRenderer (the shim below exports it under that name for every shell module): it has a canvas
// element, a texture-size limit and calls that record themselves; nothing is drawn. Defined before any module is loaded, because the shim reads it then.
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

// The page the atlas runs in, as far as the engine reaches for it.
globalThis.window = Object.assign(new EventTarget(), {devicePixelRatio: 1, innerWidth: 800, innerHeight: 600})
globalThis.document = {body: {classList: {add() {}, remove() {}}, dataset: {}}, querySelector: () => null}
globalThis.matchMedia = () => ({matches: false})
globalThis.requestAnimationFrame = () => 0 // frames are stepped by the test (engine.advance), never by the page
globalThis.cancelAnimationFrame = () => {}
globalThis.HTMLImageElement = class {}
globalThis.Image = class extends HTMLImageElement { set src(value) { this.source = value; setTimeout(() => this.onload?.(), 0) } decode() { return Promise.resolve() } }

const globe = new URL('../src/projections/atlas/src/globe/', import.meta.url)
const body = await import(new URL('body.ts', globe).href)
const shaders = await import(new URL('shaders.ts', globe).href)
const earthModule = await import(new URL('earth.ts', globe).href)
const THREE = await import(threeUrl)
const lifetime = await import(new URL('../ui/lifetime.ts', globe).href)
const {GlobeEngine} = await import(new URL('engine.ts', globe).href)

const ENFORCE = process.env.W3Q_GATE === 'enforce'
/** Tests that are red until generator version 2 lands carry this (the lead's gate does the same); W3Q_GATE=enforce makes them real. */
const pending = ENFORCE ? {} : {todo: 'T-PROCEDURAL-BODY: red until generator v2 lands (W3Q_GATE=enforce runs it as a test)'}

// ── fixtures and measures ───────────────────────────────────────────────────────────────────────────────────────────────

const DIALS = {landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3}, sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}}
const SEEDS = [20261018, 7, 42]
const make = (seed, change = {}) => ({
  body_ref: 'body:look', seed, generator: {id: 'fbm-sphere', version: 2},
  landmass: {...DIALS.landmass, ...change.landmass}, climate: {...DIALS.climate, ...change.climate}, sky: {...DIALS.sky, ...change.sky},
})
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length
const f = (x, digits = 3) => (typeof x === 'number' ? +x.toFixed(digits) : x)
const latOf = (j, h) => 90 - (j + .5) * 180 / h
const LEVELS = [0, .25, .5, .75, 1]
const same = (a, b) => Buffer.compare(Buffer.from(a.data.buffer, a.data.byteOffset, a.data.byteLength), Buffer.from(b.data.buffer, b.data.byteOffset, b.data.byteLength)) === 0
const landAt = (record, lat, lon) => { const p = body.unitOf(lat, lon); return body.isLand(record, body.heightAt(record, p.x, p.y, p.z)) }
/** Mean colourfulness (largest channel minus smallest, 0–1) of the pixels the field says are land, and their mean luma. Rows within 60° of the equator, no ice caps in the records. */
function landColour(record, image) {
  const {width: w, height: h, data} = image
  let chroma = 0, n = 0
  for (let j = 0; j < h; j++) {
    const lat = latOf(j, h)
    if (Math.abs(lat) > 60) continue
    for (let i = 0; i < w; i++) {
      if (!landAt(record, lat, -180 + (i + .5) * 360 / w)) continue
      const at = (j * w + i) * 4, r = data[at] / 255, g = data[at + 1] / 255, b = data[at + 2] / 255
      chroma += Math.max(r, g, b) - Math.min(r, g, b); n++
    }
  }
  return {chroma: chroma / Math.max(1, n), n}
}
/** The share of the pixels the field says are sea (inside 60°) that read as water to the shader's cue. */
function seaStillWater(record, image) {
  const {width: w, height: h} = image, water = waterMask(image)
  let sea = 0, read = 0
  for (let j = 0; j < h; j++) {
    const lat = latOf(j, h)
    if (Math.abs(lat) > 60) continue
    for (let i = 0; i < w; i++) if (!landAt(record, lat, -180 + (i + .5) * 360 / w)) { sea++; read += water[j * w + i] }
  }
  return read / Math.max(1, sea)
}
const cloudCover = mask => { const {width: w, height: h, data} = mask; let sum = 0, area = 0; for (let j = 0; j < h; j++) { const a = Math.cos(latOf(j, h) * Math.PI / 180); for (let i = 0; i < w; i++) { sum += a * data[(j * w + i) * 4] / 255; area += a } } return sum / area }
const NO_ICE = {climate: {ice_caps: 0}}

// ── look.barren ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('K1 the default look is a lived-in body: no look, an empty look and `barren: 0` draw the same bytes, for every picture and the air', () => {
  const record = make(SEEDS[0])
  for (const look of [undefined, {}, {barren: 0}]) {
    assert.ok(same(body.bodyImage(record, 96, look), body.bodyImage(record, 96)), `bodyImage with ${JSON.stringify(look)}`)
    assert.ok(same(body.cloudImage(record, 96, look), body.cloudImage(record, 96)), `cloudImage with ${JSON.stringify(look)}`)
    assert.ok(same(body.bodyDisc(record, 48, look), body.bodyDisc(record, 48)), `bodyDisc with ${JSON.stringify(look)}`)
    assert.equal(body.airOf(record, look), body.airOf(record), `airOf with ${JSON.stringify(look)}`)
  }
})

test('K2 barren takes the colour from the land: its colourfulness falls as the look rises and at 1 the land is grey', () => {
  // A grey moon: the Moon’s own surface is a brown-grey whose largest channel is within about .03 of its smallest; the body is held to .08, with room for a tinge of rock.
  // At no barren the land has the colour of its climate (at least twice the barren land’s).
  const chroma = LEVELS.map(barren => mean(SEEDS.map(seed => { const record = make(seed, NO_ICE); return landColour(record, body.bodyImage(record, 256, {barren})).chroma })))
  for (let k = 1; k < chroma.length; k++) assert.ok(chroma[k] < chroma[k - 1] - .004, `land colourfulness falls with barren ${LEVELS.join(', ')}: ${chroma.map(x => f(x)).join(', ')} (each step by at least .004)`)
  assert.ok(chroma[4] <= .08, `at barren 1 the land is grey: colourfulness ${f(chroma[4])} (at most .08)`)
  assert.ok(chroma[0] >= 2 * chroma[4], `and a lived-in land is at least twice as colourful (${f(chroma[0])} against ${f(chroma[4])})`)
})

test('K3 barren draws the sea back to dust: the share of the sea that still reads as water falls as the look rises, to almost none at 1', () => {
  // `waterOf` (shaders.ts EARTH_COMMON) reads a pixel as water when it is blue well above red; dust is not. The field says where the sea was (look does not move it).
  const share = LEVELS.map(barren => mean(SEEDS.map(seed => { const record = make(seed, NO_ICE); return seaStillWater(record, body.bodyImage(record, 256, {barren})) })))
  assert.ok(share[0] >= .95, `a lived-in sea reads as water (${f(share[0], 2)})`)
  for (let k = 1; k < share.length; k++) assert.ok(share[k] <= share[k - 1] + .005, `the sea reads as water less and less: ${share.map(x => f(x, 2)).join(', ')}`)
  assert.ok(share[4] <= .05, `at barren 1 ${f(share[4], 3)} of the sea reads as water (at most .05)`)
})

test('K4 barren empties the clouds: the cover falls as the look rises and at 1 there is none', () => {
  // at the cloud dial's top, where a lived-in body is at least half cloud (the dials test's A3), so that there is a cover for barren to take away
  const cover = LEVELS.map(barren => mean(SEEDS.map(seed => cloudCover(body.cloudImage(make(seed, {sky: {clouds: 1}}), 128, {barren})))))
  assert.ok(cover[0] >= .3, `a lived-in cloudy body has cloud (cover ${f(cover[0], 3)}; at least .3)`)
  for (let k = 1; k < cover.length; k++) assert.ok(cover[k] < cover[k - 1], `the cover falls with barren ${LEVELS.join(', ')}: ${cover.map(x => f(x, 4)).join(', ')}`)
  assert.ok(cover[4] <= .001, `at barren 1 the mask is empty (cover ${f(cover[4], 5)})`)
})

test('K5 barren thins the air: `airOf` falls with the look and at 1 there is none', () => {
  const record = make(SEEDS[0]), air = LEVELS.map(barren => body.airOf(record, {barren}))
  assert.equal(air[0], body.airOf(record), 'barren 0 is the body’s own air')
  for (let k = 1; k < air.length; k++) assert.ok(air[k] < air[k - 1], `the air falls with barren ${LEVELS.join(', ')}: ${air.map(x => f(x, 3)).join(', ')}`)
  assert.equal(air[4], 0, 'a barely shaped moon has no air')
})

test('K6 the disc at the System scale is barren too: greyer, no air at its rim, no cloud over it', () => {
  const size = 96
  const read = barren => {
    const record = make(SEEDS[0], {sky: {clouds: 1}}), disc = body.bodyDisc(record, size, {barren})
    let chroma = 0, n = 0, glow = 0, g = 0, white = 0
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = -1 + (i + .5) * 2 / size, y = 1 - (j + .5) * 2 / size, r = Math.hypot(x, y), at = (j * size + i) * 4
      if (r >= 1 && r <= 1.12) { glow += disc.data[at + 3] / 255; g++ }
      else if (r < .85) { const R = disc.data[at] / 255, G = disc.data[at + 1] / 255, B = disc.data[at + 2] / 255; chroma += Math.max(R, G, B) - Math.min(R, G, B); n++; if (Math.min(R, G, B) > .8) white++ }
    }
    return {chroma: chroma / n, glow: glow / g, white: white / n}
  }
  const levels = [0, .5, 1].map(read)
  assert.ok(levels[0].chroma > levels[1].chroma && levels[1].chroma > levels[2].chroma, `the disc loses its colour with barren 0, .5, 1: ${levels.map(l => f(l.chroma)).join(', ')}`)
  assert.ok(levels[0].glow > levels[1].glow && levels[2].glow === 0, `its air thins to nothing at the rim: ${levels.map(l => f(l.glow, 4)).join(', ')}`)
  assert.ok(levels[2].white <= .002, `and no cloud stands over it at barren 1 (white pixels ${f(levels[2].white, 4)} of the disc)`)
})

test('K7 a barren tile is greyer than a lived-in one, the same ground: close-zoom tiles take the look', async () => {
  let tiles
  try { tiles = await import(new URL('bodyTiles.ts', globe).href) } catch (error) { if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error; tiles = {} }
  assert.equal(typeof tiles.bodyTile, 'function', 'bodyTiles.ts exports bodyTile(record, z, x, y, look?)')
  const record = make(SEEDS[0], NO_ICE), z = 5, n = 2 ** z
  // a tile whose centre is land
  let found = null
  for (let y = Math.floor(n * .35); y < Math.floor(n * .45) && !found; y++) for (let x = 0; x < n && !found; x++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + .5) / n))) * 180 / Math.PI, lon = (x + .5) / n * 360 - 180
    if (landAt(record, lat, lon)) found = {x, y}
  }
  assert.ok(found, 'the body has land at a middle latitude')
  const colour = barren => { const tile = tiles.bodyTile(record, z, found.x, found.y, {barren}); let c = 0; for (let k = 0; k < 256 * 256; k++) { const r = tile.data[k * 4], g = tile.data[k * 4 + 1], b = tile.data[k * 4 + 2]; c += (Math.max(r, g, b) - Math.min(r, g, b)) / 255 } return c / (256 * 256) }
  const levels = [0, .5, 1].map(colour)
  assert.ok(levels[0] > levels[1] && levels[1] > levels[2], `the tile loses its colour with barren 0, .5, 1: ${levels.map(x => f(x)).join(', ')}`)
})

test('K8 a look outside its range is held to it: barren below 0 is 0 and above 1 is 1', () => {
  const record = make(SEEDS[0])
  assert.ok(!same(body.bodyImage(record, 64, {barren: 1}), body.bodyImage(record, 64, {barren: 0})), 'the look changes the picture (else this test says nothing)')
  assert.ok(same(body.bodyImage(record, 64, {barren: 3}), body.bodyImage(record, 64, {barren: 1})), 'barren 3 is barren 1')
  assert.ok(same(body.bodyImage(record, 64, {barren: -2}), body.bodyImage(record, 64, {barren: 0})), 'barren -2 is barren 0')
  assert.equal(body.airOf(record, {barren: 5}), 0); assert.equal(body.airOf(record, {barren: -1}), body.airOf(record))
})

test('K9 a barren moon is still the same ground: the land keeps its shading, and where the land lies does not depend on the look', () => {
  // "a small grey moon you have barely shaped": the colour goes, the relief stays. The field does not take a look (heightAt(record, x, y, z)), so the Place tool is
  // undisturbed; and the land's luma at barren 1 follows its luma at barren 0 (correlation at least .5).
  const record = make(SEEDS[0], NO_ICE), a = body.bodyImage(record, 256), b = body.bodyImage(record, 256, {barren: 1}), {width: w, height: h} = a
  assert.equal(body.heightAt.length, 4, 'heightAt takes the record and a point, and no look')
  const x = [], y = []
  for (let j = 0; j < h; j++) { const lat = latOf(j, h); if (Math.abs(lat) > 60) continue; for (let i = 0; i < w; i++) if (landAt(record, lat, -180 + (i + .5) * 360 / w)) { const k = (j * w + i) * 4; x.push(.299 * a.data[k] + .587 * a.data[k + 1] + .114 * a.data[k + 2]); y.push(.299 * b.data[k] + .587 * b.data[k + 1] + .114 * b.data[k + 2]) } }
  const mx = mean(x), my = mean(y)
  let sxy = 0, sxx = 0, syy = 0
  for (let k = 0; k < x.length; k++) { sxy += (x[k] - mx) * (y[k] - my); sxx += (x[k] - mx) ** 2; syy += (y[k] - my) ** 2 }
  assert.ok(sxy / Math.sqrt(sxx * syy || 1) >= .5, `the barren land’s luma follows the lived-in land’s (correlation ${f(sxy / Math.sqrt(sxx * syy || 1), 3)}; at least .5)`)
})

test('K10 the disc carries its weather: `bodyDisc(record, size, look, timeMs)` shows the clouds of that moment, and the same moment shows the same disc', () => {
  // Lane B's contract addition (ticket §4): another world's small disc is drawn at the occasion, so it carries the weather the globe would show it with. A
  // generator holds no clock: a disc given no time (absent or null) is drawn at the weather's own zero, and the caller that means Now gives the clock's reading.
  const DAY_MS = 86400000, t0 = Date.UTC(2026, 9, 20), cloudy = make(SEEDS[0], {sky: {clouds: 1}}), clear = make(SEEDS[0], {sky: {clouds: 0}})
  const disc = (record, time, look) => body.bodyDisc(record, 96, look, time)
  assert.ok(same(disc(cloudy, t0), disc(cloudy, t0)), 'the same moment shows the same disc')
  assert.ok(same(disc(cloudy, undefined), body.bodyDisc(cloudy, 96)), 'no time is the disc as drawn with no fourth argument')
  assert.ok(same(disc(cloudy, null), disc(cloudy, undefined)), 'null is no time')
  assert.ok(!same(disc(cloudy, t0), disc(cloudy, t0 + 3 * DAY_MS)), 'three days later the clouds on the disc have moved')
  assert.ok(!same(disc(cloudy, t0 - 40 * DAY_MS), disc(cloudy, t0)), 'and a past occasion shows the weather it had')
  assert.ok(same(disc(clear, t0), disc(clear, t0 + 3 * DAY_MS)), 'a body with no cloud has no weather to move: the time changes nothing')
  assert.ok(same(disc(cloudy, t0, {barren: 1}), disc(cloudy, t0 + 3 * DAY_MS, {barren: 1})), 'nor does a barren one: its clouds are gone')
  // only the cloud moves: the ground under it, read where the cloud is thin, does not (the pixels that differ are few of the disc's and the same size, and none outside it)
  const a = disc(cloudy, t0), b = disc(cloudy, t0 + 3 * DAY_MS)
  for (let k = 0; k < 96 * 96; k++) {
    const x = -1 + ((k % 96) + .5) * 2 / 96, y = 1 - (Math.floor(k / 96) + .5) * 2 / 96
    if (Math.hypot(x, y) >= 1.0) assert.equal(a.data[k * 4 + 3], b.data[k * 4 + 3], 'the air round the disc is the same at any moment')
  }
})

// ── weatherShift ────────────────────────────────────────────────────────────────────────────────────────────────────────

const DAY = 86400000, T0 = Date.UTC(2026, 9, 20)
const needShift = () => assert.equal(typeof body.weatherShift, 'function', 'body.ts exports weatherShift(record, latDeg, timeMs)')
const wrap = d => ((d + 540) % 360 + 360) % 360 - 180
/** Degrees of longitude gained per day at a latitude, from one day's difference, wrapped to ±180°. */
const rateAt = (record, lat, t = T0) => wrap(body.weatherShift(record, lat, t + DAY) - body.weatherShift(record, lat, t))

test('V1 `weatherShift` is a function of the seed, the latitude and the time, and of nothing else of the record', () => {
  assert.equal(typeof body.weatherShift, 'function', 'body.ts exports weatherShift(record, latDeg, timeMs)')
  const a = make(SEEDS[0]), moved = make(SEEDS[0], {landmass: {sea_level: .2, continents: 3, relief: .9, coast: 'fjord'}, climate: {warmth: .1, moisture: .9, ice_caps: .8}, sky: {atmosphere: .1, clouds: .9, axial_tilt_deg: 40}})
  for (const lat of [0, 22, -47, 80]) assert.equal(body.weatherShift(moved, lat, T0), body.weatherShift(a, lat, T0), `the other dials do not move the weather (latitude ${lat})`)
  // another seed is other weather: at least three of the four latitude-and-time samples differ
  const b = make(SEEDS[1]), samples = [[0, T0], [22, T0 + 3 * DAY], [-47, T0 + 11 * DAY], [80, T0 - 30 * DAY]]
  assert.ok(samples.filter(([lat, t]) => body.weatherShift(a, lat, t) !== body.weatherShift(b, lat, t)).length >= 3, 'another seed has other weather')
})

test('V2 the weather differs by latitude band: the clouds are carried at different speeds in the tropics, the temperate zone and near the pole', () => {
  needShift()
  // Earth: trade winds in the tropics, westerlies in mid-latitudes, polar easterlies: three bands, not one speed. The rates (degrees of longitude per day) at 0°, 30°,
  // 50° and 70° must not be one number: the spread is at least a quarter of the largest, and at least three of the four band pairs differ by a twentieth of it.
  const record = make(SEEDS[0]), rates = [0, 30, 50, 70].map(lat => rateAt(record, lat)), top = Math.max(...rates.map(Math.abs))
  assert.ok(top > 0, `the clouds move (rates ${rates.map(x => f(x, 2)).join(', ')} °/day)`)
  assert.ok(Math.max(...rates) - Math.min(...rates) >= .25 * top, `the rates at 0°, 30°, 50°, 70° are ${rates.map(x => f(x, 2)).join(', ')} °/day: spread at least a quarter of the largest`)
  let differing = 0
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) if (Math.abs(rates[a] - rates[b]) >= .05 * top) differing++
  assert.ok(differing >= 4, `and ${differing} of the six pairs of bands differ by at least a twentieth of the largest (at least four of six)`)
})

test('V3 the shear between bands is smooth: the speed changes gently with latitude, so the cloud mask is smeared across a band’s edge, not torn', () => {
  needShift()
  // A speed that jumps between two latitudes opens a rift in the mask at that latitude. Across one degree the rate may not change by more than a quarter of the whole spread.
  const record = make(SEEDS[0]), rates = []
  for (let lat = -89; lat <= 89; lat++) rates.push(rateAt(record, lat))
  const spread = Math.max(...rates) - Math.min(...rates)
  assert.ok(spread > 0)
  for (let k = 1; k < rates.length; k++) assert.ok(Math.abs(rates[k] - rates[k - 1]) <= .25 * spread, `the rate jumps from ${f(rates[k - 1], 2)} to ${f(rates[k], 2)} °/day between ${k - 90}° and ${k - 89}° (spread ${f(spread, 2)})`)
})

test('V4 the shift is continuous in time: hourly samples over a month have no jumps, and a millisecond moves it by a thousandth of a degree at most', () => {
  needShift()
  const record = make(SEEDS[0])
  for (const lat of [0, 25, -40, 60, 85]) {
    const steps = []
    let last = body.weatherShift(record, lat, T0)
    for (let hour = 1; hour <= 24 * 30; hour++) { const next = body.weatherShift(record, lat, T0 + hour * 3600000); steps.push(wrap(next - last)); last = next }
    const largest = Math.max(...steps.map(Math.abs)), second = steps.slice(1).map((s, k) => Math.abs(s - steps[k]))
    assert.ok(Math.max(...second) <= .05 * largest + 1e-9, `latitude ${lat}: the hourly steps change by at most a twentieth of the largest step (largest ${f(largest, 5)}°, change ${f(Math.max(...second), 6)}°): no jump`)
    assert.ok(Math.abs(wrap(body.weatherShift(record, lat, T0 + 1) - body.weatherShift(record, lat, T0))) <= 1e-3, `latitude ${lat}: a millisecond moves the mask by at most .001°`)
  }
})

test('V5 the weather is bounded, and slow: the shift stays within a turn for any time, in the deep past and the far future, at the speeds of real weather', () => {
  needShift()
  const record = make(SEEDS[0]), lats = [-90, -63, -30, 0, 17, 45, 75, 90]
  const times = [-3.2e13, -1.5e12, -1, 0, 1, 1.7e12, T0, 3.2e13, 8.64e15]
  for (const lat of lats) for (const t of times) {
    const shift = body.weatherShift(record, lat, t)
    assert.ok(Number.isFinite(shift) && Math.abs(shift) <= 360, `weatherShift(${lat}°, ${t}) = ${shift}: a finite shift of at most a turn (the uniform a shader takes keeps its precision)`)
  }
  // slow: the fastest band moves the clouds a fraction of a turn in a day, and far less than a turn in an hour. The Earth's clouds circle a mid-latitude in five to twenty
  // days (18° to 72° a day); the bounds are a hundred days a turn (3.6°/day) at the least, for scrubbing to show it, and a turn a day (360°/day) at the most.
  const fastest = Math.max(...lats.map(lat => Math.abs(rateAt(record, lat))))
  assert.ok(fastest >= 3.6 && fastest <= 360, `the fastest band moves ${f(fastest, 2)} °/day (between 3.6 and 360)`)
})

test('V6 a past occasion has its weather and a different day has another: the shift at two dates a week apart differs by at least a degree at the fastest band', () => {
  needShift()
  const record = make(SEEDS[0]), at = t => [0, 30, 50, 70].map(lat => body.weatherShift(record, lat, t))
  const a = at(T0), b = at(T0 + 7 * DAY), c = at(T0)
  assert.deepEqual(a, c, 'the same occasion shows the same weather')
  assert.ok(Math.max(...a.map((x, k) => Math.abs(wrap(b[k] - x)))) >= 1, 'a week later the clouds have moved by at least a degree somewhere')
})

// ── the shader ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The text between a call's parentheses from `open`, nesting counted. */
function callArguments(text, open) {
  let depth = 0
  for (let k = open; k < text.length; k++) {
    if (text[k] === '(') depth++
    else if (text[k] === ')' && --depth === 0) return text.slice(open + 1, k)
  }
  return ''
}

test('S1 the shader slides the cloud mask by `uWeatherT`: the uniform is declared and the cloud lookup depends on it (read as source: the GPU is not run)', () => {
  const frag = shaders.EARTH_FRAG
  assert.ok(/uniform\s+(float|vec2|vec3|vec4|sampler2D)\s+uWeatherT\s*;/.test(frag), 'EARTH_FRAG declares the uniform uWeatherT')
  const main = frag.slice(frag.indexOf('void main'))
  // the names the uniform reaches before the lookup: locals assigned from an expression that holds it, followed two steps
  const reached = new Set(['uWeatherT'])
  for (let pass = 0; pass < 3; pass++) for (const m of main.matchAll(/(?:\b(?:float|vec2|vec3|vec4)\s+)?\b(\w+)\s*[-+*]?=\s*([^;]*);/g)) {
    if ([...reached].some(name => new RegExp(`\\b${name}\\b`).test(m[2]))) reached.add(m[1])
  }
  const lookup = main.indexOf('texture2D(uCloud')
  assert.ok(lookup >= 0, 'the cloud mask is looked up through uCloud')
  const args = callArguments(main, lookup + 'texture2D'.length)
  assert.ok([...reached].some(name => new RegExp(`\\b${name}\\b`).test(args)), `the cloud lookup texture2D(uCloud, ${args.trim()}) is carried by uWeatherT (directly or through a local it sets)`)
})

test('S2 the mask can be slid without a tear at the seam: the cloud texture repeats in longitude, as the base does', () => {
  const renderer = {capabilities: {getMaxAnisotropy: () => 4}}, image = body.cloudImage(make(SEEDS[0]), 32)
  const texture = earthModule.bodyTexture(image, renderer)
  assert.equal(texture.wrapS, THREE.RepeatWrapping, 'a texture the cloud mask is put in wraps in longitude')
})

test('S3 what feeds the uniform is the one table the tests hold: the earth material carries uWeatherT and the globe takes the wind from bodyWeather.ts', () => {
  // The shader needs the wind at each fragment's own latitude, which one call of weatherShift (one latitude) cannot give: so the globe hands it the occasion's time and the body's
  // rate, and the shader sums the same bands (WEATHER_BANDS, shared with weatherShift) at the fragment's latitude. The first form of this test asked the globe's source to name
  // weatherShift; the table is what must be shared, and S4 below holds the two formulas to the same numbers.
  const earth = readFileSync(new URL('earth.ts', globe), 'utf8'), engine = readFileSync(new URL('engine.ts', globe), 'utf8'), shader = readFileSync(new URL('shaders.ts', globe), 'utf8')
  assert.ok(/\buWeatherT\b/.test(earth), 'earth.ts hands the shader a uniform uWeatherT')
  assert.ok(/\bWEATHER_BANDS\b/.test(engine + shader) && /\bweatherScale\b/.test(engine), 'the globe and the shader take the wind from bodyWeather.ts (WEATHER_BANDS, weatherScale), not from a second table')
  assert.ok(/\bsetBodyTime\s*\(/.test(engine), 'the engine has setBodyTime(ms | null)')
})

test('S4 the shader’s wind is weatherShift’s: the bands the fragment shader sums, evaluated at the body’s rate, give weatherShift’s own shift at every latitude and time', async () => {
  const {WEATHER_BANDS, weatherScale, weatherClock} = await import(new URL('bodyWeather.ts', globe).href)
  const frag = shaders.EARTH_FRAG, m = /float r = ([^;]*);/.exec(frag.slice(frag.indexOf('float weatherTurns')))
  assert.ok(m, 'EARTH_FRAG has weatherTurns, with the sum of the bands')
  const sum = new Function('a', 'rate', `const exp = Math.exp; return ${m[1]}`)
  for (const seed of SEEDS) {
    const record = make(seed), rate = WEATHER_BANDS.map(band => band.weight * weatherScale(seed)) // what the globe hands the shader (engine.ts applyWeather)
    for (const lat of [-80, -47, -10, 0, 12, 30, 52, 77, 90]) for (const days of [0, 1.5, 20, 20741.37]) {
      const turns = (((sum(Math.abs(lat), rate) * weatherClock(seed, days * 86400000) / 360) % 1) + 1) % 1, shader = turns * 360, cpu = ((body.weatherShift(record, lat, days * 86400000) % 360) + 360) % 360
      const gap = Math.abs(shader - cpu)
      assert.ok(Math.min(gap, 360 - gap) < 1e-5, `seed ${seed}, ${lat}° after ${days} days: the shader’s bands give ${f(shader, 5)}°, weatherShift ${f(cpu, 5)}°`)
    }
  }
})

test('S5 the shear is bounded at every time: from one degree of latitude to the next the shift changes by at most three degrees of longitude, on any date in the past or the future (streaks, never a smear)', async () => {
  // The wind differs by latitude, so the mask is sheared by the difference of the rates times the time: a clock that ran on for ever (the days since 1970, twenty thousand of
  // them) sheared it by ten thousand degrees to the degree, and the globe was drawn in hairline rings from pole to pole (the owner's moiré). The weather's own clock is bounded
  // so the shear is: a band of real cloud is sheared a degree or two to the degree.
  const {weatherRate, weatherClock} = await import(new URL('bodyWeather.ts', globe).href)
  const dates = [T0, 0, -1, 1e12, -1e12, 3.2e13, -3.2e13, 8.64e15, ...Array.from({length: 480}, (_, k) => T0 + (k - 240) * 17.3 * DAY)]
  let worst = 0
  for (const seed of SEEDS) {
    const record = make(seed)
    for (const t of dates) for (let lat = 0; lat < 90; lat++) {
      const jump = Math.abs(wrap(body.weatherShift(record, lat + 1, t) - body.weatherShift(record, lat, t)))
      worst = Math.max(worst, jump)
      assert.ok(jump <= 3, `seed ${seed}, ${lat}° to ${lat + 1}° at ${t}: the shift changes by ${f(jump, 2)}° of longitude (at most 3)`)
    }
  }
  assert.ok(worst > 0 && Number.isFinite(worst) && typeof weatherRate === 'function' && typeof weatherClock === 'function')
  // and the clock the shader is given is the same bounded one: a day's reading of it, far in the future, is no larger than one a century back
  const clock = t => Math.abs(weatherClock(SEEDS[0], t))
  assert.ok(Math.max(...dates.map(clock)) < 2, `the weather's own clock stays within two days of its start (largest ${f(Math.max(...dates.map(clock)), 3)})`)
})

test('M1 the cloud lookup is continuous: the shader does not wrap the shift to a turn, which leaves a hairline ring at every latitude where it passes a whole turn', () => {
  // The texture unit chooses its detail from how fast the lookup coordinate changes across the screen. Wrapped with `fract` (or `mod`), the coordinate jumps by a whole turn at
  // the latitudes where the shift passes one, the change there is a turn, not a pixel, and the unit takes its coarsest picture: a hairline ring of smeared cloud, at each such
  // latitude. The texture repeats in longitude (S2), so there is nothing to wrap.
  for (const [name, frag] of [['the sphere', shaders.EARTH_FRAG], ['the tile', shaders.TILE_FRAG]]) {
    const at = frag.indexOf('float weatherTurns')
    assert.ok(at >= 0, `${name}’s shader has weatherTurns`)
    const fn = frag.slice(at, frag.indexOf('\n}', at) + 2)
    assert.ok(fn.includes('return') && !/\b(fract|mod)\s*\(/.test(fn), `${name}’s weatherTurns does not wrap its result (fract or mod): ${fn.replace(/\s+/g, ' ').slice(0, 160)}`)
    const main = frag.slice(frag.indexOf('void main')), sky = main.slice(main.indexOf('uCloudMix'))
    assert.ok(!/\b(fract|mod)\s*\(/.test(sky), `nor does ${name}’s cloud lookup wrap its coordinate`)
  }
})

test('B1 the grade does not tint a barren world toward the palette: the shader takes `uBarren`, the ramp and the sea test are driven by it, and dust is not sea', () => {
  // The globe grades every picture into the site's world (shadeEarth): land and sea are ramps of the palette (uDeep, uFog, uGlow), a deep navy. A grey airless moon passed through
  // it comes out blue (the owner's entered fresh world: red falls from 55 to 36 and blue rises from 47 to 79 between the picture and the screen). A barren body is graded toward
  // neutral by a uniform, and the sea test, which reads a dark low-chroma pixel's blue against its red, never calls dust sea. The GLSL is read as text (the GPU is not run).
  for (const [name, frag] of [['the sphere', shaders.EARTH_FRAG], ['the tile', shaders.TILE_FRAG]]) {
    assert.ok(/uniform\s+float\s+uBarren\s*;/.test(frag), `${name}’s shader declares the uniform uBarren`)
  }
  const frag = shaders.EARTH_FRAG, start = frag.indexOf('vec3 shadeEarth'), end = frag.indexOf('\n}', start)
  assert.ok(start >= 0 && end > start, 'the shader has shadeEarth')
  const fn = frag.slice(start, end)
  // the names uBarren reaches in shadeEarth, through the locals assigned from an expression that holds it (followed three steps)
  const reached = new Set(['uBarren'])
  for (let pass = 0; pass < 4; pass++) for (const m of fn.matchAll(/(?:\b(?:float|vec2|vec3|vec4)\s+)?\b(\w+)\s*[-+*]?=\s*([^;]*);/g)) {
    if ([...reached].some(name => new RegExp(`\\b${name}\\b`).test(m[2]))) reached.add(m[1])
  }
  assert.ok(reached.has('water'), `the sea test is driven by uBarren (it reaches: ${[...reached].join(', ')}): dust is not sea, whatever its blue`)
  assert.ok(reached.has('land'), 'and the land ramp is: the palette’s navy is mixed away from a barren world’s rock')
  assert.ok(reached.has('col'), 'and what is drawn is (the colour that leaves shadeEarth is graded by it)')
})

test('S6 a cloud’s edge is broken up as finely as the camera can see it and no finer: the detail is faded by the pixel’s size (`uPxRad`), so it is crisp close in and cannot shimmer from afar', () => {
  // A cloud mask of 1024 texels is a blur at a region view (a texel is thirty pixels across). The shader adds noise to the mask's soft edge, octave on octave; an octave finer than
  // the screen's pixel is aliasing, so each is faded out by the pixel's size in radians (the uniform the globe hands it), without screen derivatives (which band in 2 x 2 blocks and
  // break at the texture's seam). The GLSL is read as text.
  for (const [name, frag] of [['the sphere', shaders.EARTH_FRAG], ['the tile', shaders.TILE_FRAG]]) {
    assert.ok(/uniform\s+float\s+uPxRad\s*;/.test(frag), `${name}’s shader declares uPxRad`)
    const main = frag.slice(frag.indexOf('void main')), sky = main.slice(main.indexOf('uCloudMix'))
    assert.ok(/\buPxRad\b/.test(sky), `${name}’s sky block reads uPxRad`)
    assert.ok(!/\b(fwidth|dFdx|dFdy)\s*\(/.test(frag), `${name}’s shader takes no screen derivatives`)
    const reached = new Set(['uPxRad'])
    for (let pass = 0; pass < 4; pass++) for (const m of sky.matchAll(/(?:\b(?:float|vec2|vec3|vec4)\s+)?\b(\w+)\s*[-+*]?=\s*([^;]*);/g)) if ([...reached].some(n => new RegExp(`\\b${n}\\b`).test(m[2]))) reached.add(m[1])
    assert.ok(reached.has('cover'), `the cloud cover is reached by uPxRad (it reaches: ${[...reached].join(', ')}): the detail is faded by the pixel`)
  }
})

// ── the engine's occasion and its reduced motion ───────────────────────────────────────────────────────────────────────

/** The globe on a stand-in renderer, with the clock the page has (Date.now and performance.now) under the test's hand. */
async function openGlobe({reduced = false} = {}) {
  const life = lifetime.beginLifetime()
  const clock = {base: Date.UTC(2026, 9, 20, 12), offset: 0}, realNow = Date.now, realPerf = performance.now.bind(performance)
  Date.now = () => clock.base + clock.offset
  performance.now = () => realPerf() + clock.offset
  const model = {occ: [], dir: [], colour: [], famPalette: new Map(), located: [], u: []}, time = {update() {}, cursorU: 0, trail: 1, on: 0}
  const engine = new GlobeEngine(element(), model, time, {onPick() {}, onHover() {}, onInteract() {}, onGrab() {}, onPalette() {}}, reduced)
  await engine.ready
  if (typeof engine.setBodyTime !== 'function') {
    Date.now = realNow; delete performance.now; engine.dispose(); life.dispose()
    assert.fail('the engine has setBodyTime(ms: number | null)')
  }
  return {
    engine, clock,
    /** Let `seconds` pass for the page (its clock) and for the globe (its frames, in steps of ten minutes). */
    pass(seconds) { clock.offset += seconds * 1000; engine.advance(seconds, 600) },
    uniform() { const value = engine.earth.mesh.material.uniforms.uWeatherT?.value; return value === undefined ? undefined : JSON.stringify(value) },
    close() { Date.now = realNow; delete performance.now; engine.dispose(); life.dispose() },
  }
}

test('W1 the globe has an occasion: `setBodyTime(ms)` sets it, null is Now, and the shader is handed the weather of it through uWeatherT', async () => {
  const globeUnderTest = await openGlobe()
  try {
    const {engine} = globeUnderTest
    assert.equal(typeof engine.setBodyTime, 'function', 'the engine has setBodyTime(ms: number | null)')
    engine.setBody(make(SEEDS[0]))
    assert.notEqual(globeUnderTest.uniform(), undefined, 'the earth material carries uWeatherT')
    engine.setBodyTime(Date.UTC(2019, 2, 14)); const a = globeUnderTest.uniform()
    engine.setBodyTime(Date.UTC(1999, 5, 1)); const b = globeUnderTest.uniform()
    engine.setBodyTime(Date.UTC(2019, 2, 14)); const again = globeUnderTest.uniform()
    assert.notEqual(a, b, 'two occasions show two weathers')
    assert.equal(again, a, 'the same occasion shows the same weather again')
  } finally { globeUnderTest.close() }
})

test('W2 a past occasion holds its weather: the clouds do not move while the occasion is a day gone, and Now moves slowly', async () => {
  const globeUnderTest = await openGlobe()
  try {
    const {engine} = globeUnderTest
    engine.setBody(make(SEEDS[0]))
    engine.setBodyTime(Date.UTC(2019, 2, 14)); const held = globeUnderTest.uniform()
    globeUnderTest.pass(3 * 3600)
    assert.equal(globeUnderTest.uniform(), held, 'three hours pass and an occasion in 2019 shows the weather it had')
    engine.setBodyTime(null); const now0 = globeUnderTest.uniform()
    globeUnderTest.pass(86400)
    assert.notEqual(globeUnderTest.uniform(), now0, 'at Now a day passes and the clouds have moved')
  } finally { globeUnderTest.close() }
})

test('W3 reduced motion holds the weather still: at Now nothing moves, and an occasion shows the weather it had, as with motion', async () => {
  const still = await openGlobe({reduced: true})
  let stillAtOccasion, stillNow, stillLater
  try {
    still.engine.setBody(make(SEEDS[0]))
    still.engine.setBodyTime(Date.UTC(2019, 2, 14)); stillAtOccasion = still.uniform()
    still.engine.setBodyTime(null); stillNow = still.uniform()
    still.pass(86400); stillLater = still.uniform()
  } finally { still.close() }
  assert.notEqual(stillNow, undefined, 'the earth material carries uWeatherT')
  assert.equal(stillLater, stillNow, 'reduced motion: a day passes at Now and the clouds have not moved')
  const moving = await openGlobe()
  try {
    moving.engine.setBody(make(SEEDS[0]))
    moving.engine.setBodyTime(Date.UTC(2019, 2, 14))
    assert.equal(moving.uniform(), stillAtOccasion, 'a past occasion shows the same weather whether or not motion is reduced')
  } finally { moving.close() }
})

test('W4 the occasion is the globe’s, whatever order it is told in: an occasion set before the body is drawn is the weather the body shows when it is', async () => {
  const first = await openGlobe()
  let before
  try {
    first.engine.setBodyTime(Date.UTC(2019, 2, 14)); first.engine.setBody(make(SEEDS[0])); before = first.uniform()
  } finally { first.close() }
  const second = await openGlobe()
  try {
    second.engine.setBody(make(SEEDS[0])); second.engine.setBodyTime(Date.UTC(2019, 2, 14))
    assert.notEqual(before, undefined, 'the earth material carries uWeatherT')
    assert.equal(second.uniform(), before)
  } finally { second.close() }
})
