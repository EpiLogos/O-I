// The occurrence contract (WORLD-SHELL-DESIGN §3.1, §10.6; T6): one `Occurrence` (projections/atlas/src/types/field.ts),
// two producers. A Factory binding and the QL family's stated subsolar point pass the same check, carry the basis of the
// owner reading they came from, and are admitted through the one admission path. A Jung record with no basis stays valid.
// The QL adapter is the family's (inhabitants/qlSkyEarthAdapter.ts), not the atlas port's (skyProvider.ts keeps the envelope).
//
// Channels (every claim is labelled by the one that carries it):
// - SHAPE: tests/fixtures/occurrence-contract/ql-sky-snapshot.shape.json is the `ql.sky-snapshot/v1` the producer
//   (Work/Quaternal-Logic providers/sky/kerykeion_snapshot.py, `produce`, commit 120f093) emits: its key set is the
//   producer's own, and `subsolar` carries the values the producer's test states for 2026-03-20T12:00Z (about -0.05 and
//   1.9 degrees). Every other value there is NOT-CAPTURED: swisseph and kerykeion are not installed here, so no live
//   snapshot was read and no QL process ran.
// - READ PATH: admitDatedSubsolar runs the real kernelOp on a `bridge` transport. Only `fetch` is stubbed, and the stub
//   answers with the transit reading's shape (desktop/cradle/src/nara/identity/types.ts NaraTransitReading, whose `sky`
//   the QL transit passes through, current.rs). No kernel process runs.
// - FIXTURE: the Factory binding and the Jung record below are built here, shaped to the contract. They are not owner
//   output: no Factory owner declares a binding (factoryVertical.ts EARTH_SEAM still holds).
// - LOADER: the founding adapter (adaptFoundingField) runs on a minimal founding record, as the atlas-provider suite does.
// What is NOT claimed: no browser draws the globe here; the Sun's draw on the live Earth is not observed.

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// The same in-memory TypeScript loader as the other atlas and factory suites; `import.meta.env` (Vite's) is stood in for.
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

const contract = await import('../src/projections/occurrence.ts')
const qlSky = await import('../src/inhabitants/qlSkyEarthAdapter.ts')
const factory = await import('../src/factory/factoryVertical.ts')
const founding = await import('../src/projections/atlas/provider/archetypalEarthProvider.ts')

const SHAPE = JSON.parse(await readFile(new URL('./fixtures/occurrence-contract/ql-sky-snapshot.shape.json', import.meta.url), 'utf8'))

// A Factory binding as the owner would declare it (FIXTURE): one work ref, one place.
const FACTORY_SUBJECT = 'work:placeholder-run-subject'
const factoryBinding = () => ({
  id: 'factory-placeholder-occurrence', subject_ref: FACTORY_SUBJECT, title: 'Placeholder work', label: 'Placeholder work',
  familyId: 'lighthouse', coFamilyIds: [], locusType: 'artifact', cultureIds: [], place: 'Placeholder place',
  lat: 50.18, lon: -4.27, geoPrecision: 'place', year: 2026, yearDisplay: '2026', cites: [], body: [], parallelIds: [],
})

// The founding record as the Jung vault's ingest writes it (FIXTURE; the atlas-provider suite's minimal shape): no basis.
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
const foundingField = () => founding.adaptFoundingField(founded())

// The kernel's bridge answers `POST <url>/op` with `{ok, outcome}`. Only fetch is stubbed; kernelOp runs as shipped.
const bridgeAnswering = (body, sent = []) => {
  globalThis.fetch = async (url, init) => { sent.push({url, body: JSON.parse(init.body)}); return {json: async () => body} }
  return {kind: 'bridge', url: 'http://kernel.test'}
}
const transitAnswer = (transit) => ({ok: true, outcome: {result: 'nara_identity', data: {schema: 'oi.nara-identity/v1', transit}}})

test('one contract: a Factory occurrence and a QL occurrence pass the same check, each carrying its basis', () => {
  const factoryBasis = contract.basisOf({ref: 'factory-run:placeholder-run', revision: '3'})
  assert.equal(factoryBasis.ok, true)
  const fromFactory = factory.factoryEarthOccurrence(factoryBinding(), {subjectRef: FACTORY_SUBJECT, basis: factoryBasis.value})
  assert.equal(fromFactory.ok, true, fromFactory.ok ? '' : fromFactory.reason)
  assert.deepEqual(fromFactory.value.basis, {ref: 'factory-run:placeholder-run', revision: '3'})

  const fromQl = qlSky.subsolarOccurrence(SHAPE)
  assert.equal(fromQl.ok, true, fromQl.ok ? '' : fromQl.reason)
  assert.deepEqual(fromQl.value.basis, {ref: SHAPE.snapshot_ref, epoch: SHAPE.epoch_utc, read_at_unix_ms: SHAPE.receipt_unix_ms})

  // The same check accepts both producers' records again, unchanged: one contract, not two.
  for (const record of [fromFactory.value, fromQl.value]) assert.deepEqual(contract.checkOccurrence(record), {ok: true, value: record})
})

test('a Jung occurrence without a basis stays valid: it passes the contract, carries no basis, and loads through the founding adapter', () => {
  const field = foundingField()
  assert.equal(field.occurrences.length, 1)
  for (const occurrence of field.occurrences) {
    const checked = contract.checkOccurrence(occurrence)
    assert.equal(checked.ok, true, checked.ok ? '' : checked.reason)
    assert.equal('basis' in occurrence, false, 'the founding record states no reading, so it carries none')
  }
})

test('the QL family admits the owner\'s stated subsolar point through the one admission path, with the snapshot as its basis', () => {
  const before = foundingField()
  const {field, admitted, refused} = qlSky.admitSubsolar(before, SHAPE)
  assert.deepEqual(refused, [])
  assert.equal(admitted.length, 1)
  const placed = field.occurrences.find(item => item.id === 'sky-subsolar:2026-03-20T12:00:00Z')
  assert.ok(placed, 'the stated point is in the field')
  assert.equal(placed.lat, SHAPE.subsolar.latitude_degrees, 'the latitude is the owner\'s, not recomputed')
  assert.equal(placed.lon, SHAPE.subsolar.longitude_degrees, 'the longitude is the owner\'s, not recomputed')
  assert.equal(placed.geoPrecision, 'place')
  assert.equal(placed.subject_ref, 'ql:sky-occasion:2026-03-20T12:00:00Z')
  assert.deepEqual(placed.basis, {ref: 'sha256:NOT-CAPTURED', epoch: '2026-03-20T12:00:00Z', read_at_unix_ms: 1789214400000})
  assert.deepEqual(field.families.find(item => item.id === 'ql-sky-subsolar').occurrenceIds, ['sky-subsolar:2026-03-20T12:00:00Z'], 'the family lists it, as for any occurrence')
  assert.equal(field.meta.counts.occurrences, before.occurrences.length + 1)
  assert.equal(before.occurrences.length, 1, 'the input field is not mutated')
  assert.equal(before.families.some(item => item.id === 'ql-sky-subsolar'), false, 'the input field declares no family of its own')
})

test('a field that already declares the family keeps its own entry; the family is not declared twice', () => {
  const corpus = {...foundingField(), families: [...foundingField().families, {...qlSky.QL_SKY_FAMILY, name: 'The corpus name'}]}
  const {field, admitted} = qlSky.admitSubsolar(corpus, SHAPE)
  assert.equal(admitted.length, 1)
  assert.equal(field.families.filter(item => item.id === 'ql-sky-subsolar').length, 1)
  assert.equal(field.families.find(item => item.id === 'ql-sky-subsolar').name, 'The corpus name')
})

test('a snapshot that states no subsolar point places no body, and the owner\'s words say why', () => {
  const legacy = {...SHAPE}
  delete legacy.subsolar
  const field = foundingField()
  const result = qlSky.admitSubsolar(field, legacy)
  assert.equal(result.admitted.length, 0)
  assert.equal(result.field.occurrences.length, field.occurrences.length)
  assert.equal(result.field.families.length, field.families.length, 'nothing is declared when nothing is placed')
  assert.match(result.refused[0].reason, /states no subsolar point/)
  assert.match(result.refused[0].reason, /additive/)
})

test('a snapshot that is not the owner\'s shape, or whose stated point is out of range, is refused by name', () => {
  assert.match(qlSky.subsolarOccurrence({...SHAPE, schema: 'ql.sky-snapshot/v0'}).reason, /not ql\.sky-snapshot\/v1/)
  assert.match(qlSky.subsolarOccurrence({...SHAPE, snapshot_ref: ''}).reason, /does not disclose its ref/)
  assert.match(qlSky.subsolarOccurrence({...SHAPE, subsolar: {latitude_degrees: 91, longitude_degrees: 0}}).reason, /not a latitude and longitude/)
})

test('the dated read asks the kernel for the current transit and admits the stated point the reply carries', async () => {
  const sent = []
  const state = await qlSky.admitDatedSubsolar(foundingField(), bridgeAnswering(transitAnswer({schema: 'ql.nara-transit/v1', status: 'available', sky: SHAPE}), sent), new Date('2026-10-14T10:20:30.456Z'))
  assert.equal(state.placed, true, state.reason ?? '')
  assert.equal(state.reason, null)
  assert.ok(state.field.occurrences.some(item => item.id === 'sky-subsolar:2026-03-20T12:00:00Z'))
  assert.equal(sent.length, 1)
  assert.equal(sent[0].url, 'http://kernel.test/op')
  assert.deepEqual(sent[0].body, {op: 'nara_identity', request: {operation: 'transit', request: {
    schema: 'ql.sky-request/v1', epoch: '2026-10-14T10:20:30Z', timezone: 'UTC', mode: 'current', perspective: 'Apparent Geocentric',
    zodiac: 'Tropical', ayanamsha: null, observer: null, max_age_seconds: 300, backend_policy: 'allow-moshier'}}})
})

test('absence is kept with its reason: an unavailable channel, a kernel refusal, a reading with no sky, and a sky with no stated point', async () => {
  const field = foundingField()
  const unavailable = await qlSky.admitDatedSubsolar(field, {kind: 'unavailable', reason: 'no kernel host'}, new Date())
  assert.equal(unavailable.placed, false)
  assert.equal(unavailable.field, field)
  assert.match(unavailable.reason, /did not answer: no kernel host/)

  const refused = await qlSky.admitDatedSubsolar(field, bridgeAnswering({ok: false, error: 'QL refused the request'}), new Date())
  assert.match(refused.reason, /QL refused the request/)

  const noSky = await qlSky.admitDatedSubsolar(field, bridgeAnswering(transitAnswer({schema: 'ql.nara-transit/v1', status: 'unavailable', sky: null})), new Date())
  assert.match(noSky.reason, /dated sky is unavailable \(transit status: unavailable\)/)

  const legacy = {...SHAPE}
  delete legacy.subsolar
  const noPoint = await qlSky.admitDatedSubsolar(field, bridgeAnswering(transitAnswer({schema: 'ql.nara-transit/v1', status: 'available', sky: legacy})), new Date())
  assert.equal(noPoint.placed, false)
  assert.match(noPoint.reason, /states no subsolar point/)
})

test('a basis is closed: it names an owner ref, carries only the four named fields, and keeps the read instant a number', () => {
  assert.equal(contract.basisOf({ref: 'x', epoch: '2026-03-20T12:00:00Z', read_at_unix_ms: 1, revision: '3'}).ok, true)
  assert.match(contract.basisOf({ref: ''}).reason, /no owner ref/)
  assert.match(contract.basisOf({ref: 'x', owner: 'y'}).reason, /names fields the contract does not carry: owner/)
  assert.match(contract.basisOf({ref: 'x', read_at_unix_ms: 'now'}).reason, /finite unix millisecond/)
  assert.match(contract.basisOf(null).reason, /not an object/)
})

test('the one check names the first violation: a record outside the contract is refused, not placed', () => {
  assert.match(contract.checkOccurrence({...factoryBinding(), locusType: 'made-up'}).reason, /locusType "made-up"/)
  assert.match(contract.checkOccurrence({...factoryBinding(), lat: 120}).reason, /lat is not a latitude/)
  assert.match(contract.checkOccurrence({...factoryBinding(), basis: {ref: ''}}).reason, /no owner ref/)
  assert.equal(contract.checkOccurrence({...factoryBinding(), basis: {ref: 'x'}}).ok, true)
})

test('a Factory binding for another work ref, or one with no place, is refused by name', () => {
  const basis = contract.basisOf({ref: 'factory-run:placeholder-run'}).value
  const other = factory.factoryEarthOccurrence({...factoryBinding(), subject_ref: 'work:other'}, {subjectRef: FACTORY_SUBJECT, basis})
  assert.equal(other.ok, false)
  assert.match(other.reason, /binds work:other, not the run's work work:placeholder-run/)
  const unplaced = factoryBinding()
  delete unplaced.lat
  assert.match(factory.factoryEarthOccurrence(unplaced, {subjectRef: FACTORY_SUBJECT, basis}).reason, /lat is not a latitude/)
})

test('the Factory join carries the basis of a placed occurrence; a row without one keeps its shape', () => {
  const subject = {ref: FACTORY_SUBJECT, kind: 'work', positionRef: 'position:placeholder', custodyState: 'present'}
  const basis = {ref: 'factory-run:placeholder-run', revision: '3'}
  const withBasis = factory.earthRowsOf('run:placeholder', [subject], [{id: 'o1', subject_ref: FACTORY_SUBJECT, basis}])
  assert.deepEqual(withBasis, [{state: 'placed', runRef: 'run:placeholder', subject, occurrenceId: 'o1', basis}])
  const without = factory.earthRowsOf('run:placeholder', [subject], [{id: 'o1', subject_ref: FACTORY_SUBJECT}])
  assert.deepEqual(without, [{state: 'placed', runRef: 'run:placeholder', subject, occurrenceId: 'o1'}])
  assert.equal('basis' in without[0], false)
})
