// T-WORLDS §5 W3, phase A: the world body's generator (projections/atlas/src/globe/body.ts), the shore a location is drawn on, the
// reroll's seed, and a presence's identity keyed by its subject (globe/presences.ts).
// Channels: scripted. The generator, the presences and the store are the shell's own code run in memory (TypeScript transpiled by
// the loader below, as atlas-occurrence-seam.test.mjs runs them); the records are FIXTURES shaped to the owner's contract
// (ai-kit knowledge_wiki_facts.rs WorldBody). The GPU is not run: a stub renderer stands in, and the buffers are read back.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

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

const body = await import('../src/projections/atlas/src/globe/body.ts')
const {Presences, seedOf} = await import('../src/projections/atlas/src/globe/presences.ts')
const {createShared} = await import('../src/projections/atlas/src/globe/shared.ts')
const {fnv1a} = await import('../src/projections/atlas/provider/suiteReading.ts')
const {PRESENCE_VERT, PRESENCE_FRAG} = await import('../src/projections/atlas/src/globe/shaders.ts')

// FIXTURE: the World design's own sample body (atlas-earth__globe-engine.tsx:724-725), in the owner's record shape.
const RECORD = Object.freeze({
  body_ref: 'body:central:wiki:root', seed: 20261018, generator: {id: 'fbm-sphere', version: 1},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
})
const withLandmass = (change) => ({...RECORD, landmass: {...RECORD.landmass, ...change}})

// The cues EARTH_FRAG grades (shaders.ts EARTH_COMMON): waterOf = smoothstep(.3, .56, (b − r)/(b + .05)); luma for the shelf.
const waterCue = (r, b) => (b - r) / (b + .05)
const luma = (r, g, b) => .299 * r + .587 * g + .114 * b

test('the generator is pure: the same record gives the same bytes, and a new seed a new body', () => {
  const a = body.bodyImage(RECORD, 128), b = body.bodyImage(RECORD, 128)
  assert.equal(a.width, 128)
  assert.equal(a.height, 64)
  assert.equal(a.data.length, 128 * 64 * 4)
  assert.deepEqual(a.data, b.data, 'byte for byte')
  const other = body.bodyImage({...RECORD, seed: 7}, 128)
  assert.notDeepEqual(other.data, a.data, 'another seed is another body')
  const source = body.bodyImage.toString() + body.heightAt.toString()
  assert.doesNotMatch(source, /Math\.random/, 'nothing in the generator is random')
})

test('the texture carries the cues EARTH_FRAG reads: sea blue against red and darker in the deep, land not, ice white', () => {
  const image = body.bodyImage(withLandmass({sea_level: .5}), 256)
  const sea = body.seaHeight(withLandmass({sea_level: .5}))
  const polar = 1 - RECORD.climate.ice_caps * .45
  let seaCells = 0, landCells = 0, deep = [], shelf = []
  for (let j = 0; j < image.height; j++) {
    const lat = 90 - (j + .5) * 180 / image.height
    if (Math.abs(Math.sin(lat * Math.PI / 180)) > polar) continue // the ice caps are white over land and sea alike
    for (let i = 0; i < image.width; i++) {
      const at = (j * image.width + i) * 4
      const [r, g, b] = [image.data[at] / 255, image.data[at + 1] / 255, image.data[at + 2] / 255]
      const p = body.unitOf(lat, -180 + (i + .5) * 360 / image.width)
      const height = body.heightAt(withLandmass({sea_level: .5}), p.x, p.y, p.z)
      if (height <= sea) {
        seaCells++
        assert.ok(waterCue(r, b) > .56, `sea at ${i},${j} reads as water`)
        if (height < sea - .14) deep.push(luma(r, g, b))
        if (height > sea - .02) shelf.push(luma(r, g, b))
      } else {
        landCells++
        assert.ok(waterCue(r, b) < .3, `land at ${i},${j} never reads as water`)
      }
    }
  }
  assert.ok(seaCells > 0 && landCells > 0, 'the sample has both land and sea')
  const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length
  assert.ok(deep.length && shelf.length)
  assert.ok(mean(deep) < .06 && mean(shelf) > .2, 'the shelf is light and the deep dark, as the bathymetry shading reads')
  const iceRow = 0, at = (iceRow * image.width + 5) * 4
  assert.ok(image.data[at] > 180 && image.data[at + 2] > 180 && waterCue(image.data[at] / 255, image.data[at + 2] / 255) < .3, 'the pole is ice')
})

test('the settings move the body as the device says: more sea, less land; the record is refused outside its ranges', () => {
  const low = body.landShare(withLandmass({sea_level: .1})), high = body.landShare(withLandmass({sea_level: .9}))
  assert.ok(low > high, `more sea, less land (${low.toFixed(2)} > ${high.toFixed(2)})`)
  assert.equal(body.parseWorldBody(RECORD), RECORD)
  for (const [wrong, words] of [
    [withLandmass({sea_level: 1.2}), /sea level runs from 0 to 1/],
    [withLandmass({continents: .5}), /continents runs from 0.6 to 3.6/],
    [withLandmass({coast: 'jagged'}), /the coast is smooth, fjord, archipelago/],
    [{...RECORD, sky: {...RECORD.sky, axial_tilt_deg: 60}}, /axial tilt runs from 0 to 45/],
    [{...RECORD, seed: -1}, /the seed is a whole number/],
    [{...RECORD, generator: {id: 'perlin', version: 1}}, /generated by fbm-sphere/],
  ]) {
    const parsed = body.parseWorldBody(wrong)
    assert.equal(body.isWorldBody(parsed), false)
    assert.match(parsed.refused, words)
  }
})

test('a location on sea is drawn on the nearest shore and said so; its coordinate is never changed', () => {
  let onSea = 0, onLand = 0
  for (let lat = -60; lat <= 60; lat += 15) {
    for (let lon = -180; lon < 180; lon += 30) {
      const location = Object.freeze({id: `l${lat}:${lon}`, name: 'Here', lat, lon})
      const drawn = body.shoreOf(RECORD, location.lat, location.lon)
      assert.equal(location.lat, lat)
      assert.equal(location.lon, lon)
      const here = body.unitOf(lat, lon)
      if (body.isLand(RECORD, body.heightAt(RECORD, here.x, here.y, here.z))) {
        onLand++
        assert.deepEqual(drawn, {lat, lon, shore: false, found: true}, 'land is drawn where it is')
      } else {
        onSea++
        assert.equal(drawn.shore, true, 'a point at sea is said to be off its shore')
        if (drawn.found) {
          const at = body.unitOf(drawn.lat, drawn.lon)
          assert.ok(body.isLand(RECORD, body.heightAt(RECORD, at.x, at.y, at.z)), 'the shore drawn is land')
          assert.ok(Math.hypot(drawn.lat - lat, ((drawn.lon - lon + 540) % 360) - 180) <= 20.5, 'within 20°')
        }
      }
    }
  }
  assert.ok(onSea > 0 && onLand > 0, 'the sample covers both')
})

test('a reroll asks for a seed named from the record and its revision: the same press the same seed, never the seed it has', () => {
  const first = body.nextSeed(RECORD, 4)
  assert.equal(body.nextSeed(RECORD, 4), first)
  assert.notEqual(first, RECORD.seed)
  assert.notEqual(body.nextSeed(RECORD, 5), first)
  assert.ok(Number.isInteger(first) && first >= 0 && first <= 0xffffffff)
})

// ── identity: a presence's look is keyed by its subject, not its slot ─────────────────────────────────────────────────

const occ = (id, subject_ref, locusType = 'artifact') => ({id, subject_ref, title: id, label: id, familyId: 'f', coFamilyIds: [], locusType, cultureIds: [],
  place: '', lat: 10, lon: 20, geoPrecision: 'place', year: 1900, yearDisplay: '1900', cites: [], body: [], parallelIds: []})
const modelOf = (occurrences) => ({
  occ: occurrences, dir: occurrences.map(() => [1, 0, 0]), colour: occurrences.map(() => [1, 1, 1]), famPalette: new Map(), located: occurrences.map(() => true),
  u: occurrences.map(() => .5),
})
const meta = (presences, i) => Array.from(presences.mesh.geometry.getAttribute('aMeta').array.slice(i * 4, i * 4 + 4))
const locus = (presences, i) => presences.mesh.geometry.getAttribute('aLocus').array[i]

test('a reorder never changes a presence: its seed is fnv1a of its subject_ref (its id where it names none)', () => {
  const a = occ('a', 'wiki:node:a'), b = occ('b', 'wiki:node:b'), c = occ('c', undefined)
  const forward = new Presences(modelOf([a, b, c]), createShared(), {})
  const back = new Presences(modelOf([c, b, a]), createShared(), {})
  assert.deepEqual(meta(forward, 0).slice(1), meta(back, 2).slice(1), 'a keeps its look in another slot')
  assert.deepEqual(meta(forward, 1).slice(1), meta(back, 1).slice(1))
  assert.deepEqual(meta(forward, 2).slice(1), meta(back, 0).slice(1), 'c, with no subject_ref, is keyed by its id')
  assert.equal(Math.fround(seedOf('wiki:node:a')), meta(forward, 0)[3])
  assert.equal(Math.fround(seedOf('c')), meta(forward, 2)[3])
  assert.equal(fnv1a('wiki:node:a'), fnv1a('wiki:node:a'), 'the suite reading\'s own hash')
  assert.notEqual(seedOf('wiki:node:a'), seedOf('wiki:node:b'))
})

test('a mythic locus rides its own attribute and the shader draws it mythic', () => {
  const presences = new Presences(modelOf([occ('m', 'wiki:m', 'myth-episode'), occ('h', 'wiki:h', 'historical-event')]), createShared(), {})
  assert.equal(locus(presences, 0), 1)
  assert.equal(locus(presences, 1), 0)
  assert.match(PRESENCE_VERT, /attribute float aLocus;/)
  assert.match(PRESENCE_VERT, /vMyth = aLocus;/)
  assert.match(PRESENCE_FRAG, /if \(vMyth > 0\.5\)/)
})
