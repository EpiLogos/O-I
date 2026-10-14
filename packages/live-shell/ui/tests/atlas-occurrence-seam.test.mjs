// The Earth's occurrence seam (T-ATLAS-SEAM): one occurrence of the mounted model replaced in place, and the globe's buffers
// rewritten for that one slot only. The Sun (`sky-subsolar`) follows the shared window through this seam.
// Channels: the model and the Presences are the atlas's own code, run in memory (the occurrence-contract loader); the
// founding record is the FIXTURE of occurrence-contract.test.mjs (not owner output); the Sun's record is the QL adapter's
// own subsolarOccurrence on a snapshot shaped to the contract (FIXTURE values). The GPU is not run: a stub renderer stands
// in, and the buffers are read back as the draw would read them.
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

const {adaptFoundingFixture} = await import('./support/foundingFieldFixture.mjs')
const {buildModel} = await import('../src/projections/atlas/src/data/model.ts')
const {replaceModelOccurrence, OccurrenceSeamRefusal} = await import('../src/projections/atlas/src/data/occurrenceSeam.ts')
const {Presences} = await import('../src/projections/atlas/src/globe/presences.ts')
const {createShared} = await import('../src/projections/atlas/src/globe/shared.ts')
const qlSky = await import('../src/inhabitants/qlSkyEarthAdapter.ts')
const {checkOccurrence} = await import('../src/projections/occurrence.ts')

const founded = () => ({
  meta: {generatedAt: '2026-10-13T00:46:34.423Z', vaultPath: '/vault/jung-archetypal-field', vaultLedgerLine: 'LEDGER LINE',
    counts: {archetypes: 1, theoretics: 0, families: 1, occurrences: 1, cultures: 0, images: 0}, yearMin: 1698, yearMax: 1698},
  archetypes: [{id: 'wayfinding', name: 'Wayfinding', oneLine: 'A course held.', prime: false, spectrum: {position: 0.8}, palette: {core: '#fff', glow: '#eee', fog: '#111', deep: '#000'}, body: [], familyIds: ['lighthouse'], occurrenceCount: 1, archetypes: []}],
  theoretics: [],
  families: [{id: 'lighthouse', name: 'Lighthouse', subtype: 'object', aliases: [], oneLine: '', archetypes: [{id: 'wayfinding', basis: 'jung'}], spectrum: {position: 0.5}, palette: {core: '#fff', glow: '#eee', fog: '#111', deep: '#000'}, body: [], occurrenceIds: ['eddystone'], synthesised: false}],
  occurrences: [
    {id: 'eddystone', title: 'Eddystone', label: 'Eddystone', familyId: 'lighthouse', coFamilyIds: [], locusType: 'artifact', subject: 'jung', cultureIds: [], place: 'Channel', lat: 50.18, lon: -4.27, geoPrecision: 'place', year: 1698, yearDisplay: '1698', jung: [{work: 'cw12', workTitle: 'Psychology and Alchemy', year: '1936/44', locator: '¶357 (pdf p268)'}], body: [], parallelIds: []},
  ],
  cultures: [],
  joins: [],
})

// The founding field, as the occurrence contract builds it (FIXTURE; tests/support/foundingFieldFixture.mjs).
const foundingField = () => adaptFoundingFixture(founded())

// The Sun's record: the QL adapter's own admission of a stated subsolar point (FIXTURE snapshot, contract-shaped).
const snapshot = (epochUtc, lat, lon) => ({
  schema: 'ql.sky-snapshot/v1', snapshot_ref: `sha256:${epochUtc.replace(/\D/g, '').padEnd(64, '0')}`, epoch_utc: epochUtc,
  epoch_unix_ms: Date.parse(epochUtc), receipt_unix_ms: Date.parse(epochUtc) + 1000,
  subsolar: {latitude_degrees: lat, longitude_degrees: lon},
})
const sunOccurrence = (epochUtc, lat, lon) => {
  const checked = qlSky.subsolarOccurrence(snapshot(epochUtc, lat, lon))
  assert.equal(checked.ok, true, 'the stated point is admitted by the contract')
  return checked.value
}

// The Presences' per-slot buffers, read back as the draw reads them: the points and the splats share four attributes.
const POINT_ATTRS = {aDir: 3, aColor: 3, aMeta: 4, aRel: 1}
const SPLAT_ATTRS = {aLL: 2, aGlow: 3, aMeta: 4, aRel: 1}
function slotsOf(presences) {
  const splat = presences.densityScene.children[0].geometry
  const read = (geometry, attrs) => Object.fromEntries(Object.entries(attrs).map(([name, size]) => [name, geometry.getAttribute(name)]))
  return {points: read(presences.mesh.geometry, POINT_ATTRS), splats: read(splat, SPLAT_ATTRS)}
}
/** The values one occurrence slot holds, in every buffer the globe draws it from. */
function slotValues(presences, i) {
  const out = {}
  const sets = slotsOf(presences)
  for (const [group, attrs] of [['points', POINT_ATTRS], ['splats', SPLAT_ATTRS]]) {
    for (const [name, size] of Object.entries(attrs)) {
      const array = sets[group][name].array
      out[`${group}.${name}`] = Array.from(array.slice(i * size, i * size + size))
    }
  }
  return out
}
// A family the field ties to no archetype or theoretic (FIXTURE): the seam places its occurrences in place. The founding
// family `lighthouse` is tied to an archetype, so the seam refuses it by name (asserted below).
const PLAIN = {...qlSky.QL_SKY_FAMILY, id: 'plain-family', name: 'Plain', oneLine: '', archetypes: [], occurrenceIds: []}

const drawCount = presences => presences.mesh.geometry.instanceCount
const splatCount = presences => presences.densityScene.children[0].geometry.instanceCount

function setup() {
  const field = foundingField()
  const model = buildModel(field)
  const presences = new Presences(model, createShared(), {})
  return {model, presences}
}

/** Every slot in [0, count) except `skip`, as values: the other occurrences' buffers. */
function othersOf(presences, count, skip) {
  const out = {}
  for (let i = 0; i < count; i++) if (i !== skip) out[i] = slotValues(presences, i)
  return out
}

test('an occurrence appended at the tail, replaced in place, and removed: the others\' buffers are not written', () => {
  const {model, presences} = setup()
  assert.equal(model.occ.length, 1)
  const before = slotValues(presences, 0)

  // append a second occurrence in the founding family, then the Sun at the tail
  const other = {...model.occ[0], id: 'other-1', familyId: 'plain-family', title: 'Other', label: 'Other', lat: 12.5, lon: -40.25, year: 1500, yearDisplay: '1500', place: 'Elsewhere'}
  const appended = replaceModelOccurrence(model, checkOccurrence(other).value, 'other-1', PLAIN)
  assert.deepEqual([appended.index, appended.removed, appended.changed], [1, false, true])
  presences.sync(appended.index)
  assert.equal(model.occ.length, 2)
  assert.equal(drawCount(presences), 2)
  assert.equal(splatCount(presences), 2)
  assert.deepEqual(slotValues(presences, 0), before, 'slot 0 is not rewritten when an occurrence is appended')
  assert.equal(model.occIndex.get('other-1'), 1)
  assert.equal(model.field.occurrences, model.occ, 'the field the Earth reads holds the same occurrences')

  const sun = sunOccurrence('2026-03-20T12:00:00Z', -0.05, 1.9)
  const family = qlSky.QL_SKY_FAMILY
  const sunAdd = replaceModelOccurrence(model, sun, 'sky-subsolar', family)
  assert.equal(sunAdd.index, 2)
  presences.sync(sunAdd.index)
  assert.equal(drawCount(presences), 3)
  const oneBefore = slotValues(presences, 0)
  const twoBefore = slotValues(presences, 1)
  const sunBefore = slotValues(presences, 2)
  assert.equal(model.occIndex.get('sky-subsolar'), 2)
  assert.deepEqual(model.famOcc.get('ql-sky-subsolar'), [2], 'the Sun is the one occurrence of its family')
  assert.equal(model.located[2], 1)
  assert.ok(Math.abs(Math.hypot(...model.dir[2]) - 1) < 1e-9, 'the direction is a unit vector, as buildModel makes it')

  // replace in place: the same id moves to another instant and place; only slot 2 changes
  const moved = sunOccurrence('1931-01-01T00:00:00Z', 23.4, -120.0)
  const sunMove = replaceModelOccurrence(model, {...moved, id: 'sky-subsolar'}, 'sky-subsolar', family)
  assert.equal(sunMove.index, 2, 'a replacement keeps the index it holds')
  presences.sync(sunMove.index)
  assert.equal(drawCount(presences), 3, 'a replacement keeps the count')
  assert.deepEqual(slotValues(presences, 0), oneBefore, 'slot 0 is untouched by the replacement')
  assert.deepEqual(slotValues(presences, 1), twoBefore, 'slot 1 is untouched by the replacement')
  const sunAfter = slotValues(presences, 2)
  assert.notDeepEqual(sunAfter, sunBefore, 'slot 2 carries the new reading')
  assert.equal(model.u[2], model.scale.toU(1931), 'the Sun sits at its new year on the time scale')
  assert.equal(model.occ[2].year, 1931)
  assert.equal(model.occ.length, 3)

  // remove the tail: the count falls, the others stay
  const removed = replaceModelOccurrence(model, null, 'sky-subsolar', family)
  assert.deepEqual([removed.index, removed.removed, removed.changed], [-1, true, true])
  presences.sync(null)
  assert.equal(model.occ.length, 2)
  assert.equal(drawCount(presences), 2)
  assert.equal(splatCount(presences), 2)
  assert.equal(model.occIndex.has('sky-subsolar'), false)
  assert.deepEqual(model.famOcc.get('ql-sky-subsolar'), [], 'the family stays declared, with no occurrence')
  assert.deepEqual(slotValues(presences, 0), oneBefore, 'slot 0 is untouched by the removal')
  assert.deepEqual(slotValues(presences, 1), twoBefore, 'slot 1 is untouched by the removal')
  assert.equal(model.field.meta.counts.occurrences, 2)

  // an absence of an occurrence the model does not hold changes nothing
  const nothing = replaceModelOccurrence(model, null, 'sky-subsolar', family)
  assert.equal(nothing.changed, false)
  assert.equal(model.occ.length, 2)
})

test('the seam refuses by name and leaves the model as it was', () => {
  const {model, presences} = setup()
  replaceModelOccurrence(model, checkOccurrence({...model.occ[0], id: 'other-1', familyId: 'plain-family', lat: 1, lon: 1}).value, 'other-1', PLAIN)
  presences.sync(1)
  const snapshotCounts = () => ({occ: model.occ.length, index: [...model.occIndex.keys()].sort().join(), families: model.field.families.length, drawn: drawCount(presences)})
  const before = snapshotCounts()
  const beforeSlots = othersOf(presences, 2, -1)

  // removing a non-tail occurrence would move the index of the one after it
  assert.throws(() => replaceModelOccurrence(model, null, model.occ[0].id, undefined), OccurrenceSeamRefusal)
  // the founding family is tied to an archetype: its occurrences are rebuilt, not patched
  assert.throws(() => replaceModelOccurrence(model, {...model.occ[0], id: 'lighthouse-2', lat: 2, lon: 2}, 'lighthouse-2'), (e) => e instanceof OccurrenceSeamRefusal && /tied to archetypes/.test(e.message))
  // an occurrence whose family the field ties to an archetype is rebuilt, not patched
  const tiedFamily = {...qlSky.QL_SKY_FAMILY, id: 'tied-family', archetypes: [{id: 'wayfinding', basis: 'jung'}], occurrenceIds: []}
  assert.throws(() => replaceModelOccurrence(model, {...sunOccurrence('2026-03-20T12:00:00Z', 0, 0), id: 'tied-1', familyId: 'tied-family'}, 'tied-1', tiedFamily), OccurrenceSeamRefusal)
  // an undeclared family, given no declaration, is not placed
  assert.throws(() => replaceModelOccurrence(model, {...sunOccurrence('2026-03-20T12:00:00Z', 0, 0), id: 'undeclared-1', familyId: 'nowhere'}, 'undeclared-1'), OccurrenceSeamRefusal)
  // an occurrence given for another id is refused
  assert.throws(() => replaceModelOccurrence(model, sunOccurrence('2026-03-20T12:00:00Z', 0, 0), 'not-the-sun', qlSky.QL_SKY_FAMILY), OccurrenceSeamRefusal)

  assert.deepEqual(snapshotCounts(), before, 'a refusal changes no count, index or buffer')
  assert.deepEqual(othersOf(presences, 2, -1), beforeSlots)
})

test('a count past the capacity regrows the buffers and keeps every held slot', () => {
  const {model, presences} = setup()
  const held = slotValues(presences, 0)
  for (let k = 1; k <= 40; k++) {
    const occ = checkOccurrence({...model.occ[0], id: `grow-${k}`, familyId: 'plain-family', lat: (k % 80) - 40, lon: (k * 7) % 160 - 80, year: 1600 + k, yearDisplay: String(1600 + k), place: `Place ${k}`}).value
    presences.sync(replaceModelOccurrence(model, occ, `grow-${k}`, PLAIN).index)
  }
  assert.equal(model.occ.length, 41)
  assert.equal(drawCount(presences), 41)
  assert.equal(splatCount(presences), 41)
  assert.deepEqual(slotValues(presences, 0), held, 'the first slot survives the regrowth unchanged')
})
