// T-PLACES-ONTO-ATLAS: the M4′ World / Places plate's readings, over the suite's places (projections/atlas/places/placesModel.ts). The
// frame's Places map retires (FOUNDATION §4); what it showed of a place — its precision grammar (lane-4 T10), its relation layers and
// legend (T8), its routes and hierarchy (T11, T12), its provenance (T13) and its standing class (T30) — is read here from what the
// owners declare, through the cradle's own authorities (world.ts, project.ts). Pure: no DOM.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const model = await import('../src/projections/atlas/places/placesModel.ts')
const {facetFieldsOf} = await import('../src/projections/atlas/provider/suiteReading.ts')
const {precisionMarker} = await import('../../../../desktop/cradle/src/techne/m0m5/place/project.ts')
const {GEOGRAPHY_RELATIONS} = await import('../../../../desktop/cradle/src/techne/m0m5/place/world.ts')

const place = (over = {}) => ({ref: 'wiki:place:x', name: 'X', kind: 'declared', owner: 'wiki', source: 'Central wiki', subject_ref: 'wiki:s', relation: 'OCCURRED_AT',
  located: true, precision: 'exact', lat: 47.2, lon: 8.8, reason: null, ...over})

test('each place reads the precision grammar from the cradle authority, located first, an absence named, never upgraded', () => {
  const rows = model.placeRows([
    place({ref: 'p:z', name: 'Zurich', precision: 'approximate'}),
    place({ref: 'p:u', name: 'Unplaced', located: false, precision: 'unlocated', lat: undefined, lon: undefined, reason: 'the owner declares it unlocated'}),
    place({ref: 'p:b', name: 'Bollingen'}),
    {ref: 'wiki:project:o-i', name: 'O-I', kind: 'project', owner: 'wiki', source: 'Central wiki', located: false, precision: 'unlocated', reason: null},
  ])
  assert.deepEqual(rows.map(row => row.name), ['Bollingen', 'Zurich', 'O-I', 'Unplaced'], 'located first, each by its name')
  for (const row of rows) assert.equal(row.marker, precisionMarker(row.precision).kind, `${row.name}: the marker is the authority's, for its own precision`)
  assert.equal(rows[1].marker, 'halo', 'approximate never reads as a solid fix')
  assert.equal(rows[3].reason, 'the owner declares it unlocated', 'the owner\'s reason, verbatim')
  assert.match(rows[2].reason, /a project space/, 'a project space is a register, said so')
  assert.equal(rows[0].lat, 47.2)
  assert.equal(rows[3].lat, undefined, 'an unlocated place carries no point')
})

test('provenance says where a place came from, and names an absence rather than inventing a source (T13)', () => {
  assert.equal(model.provenanceLine(place({revision: 'r7', evidence: 'wiki:source:letters'})), 'wiki · Central wiki · revision r7 · evidence wiki:source:letters')
  assert.equal(model.provenanceLine(place()), 'wiki · Central wiki · no revision disclosed · no evidence source disclosed')
  assert.equal(model.validityLine({valid_from: '1923', valid_to: '1961'}), '1923 – 1961')
  assert.equal(model.validityLine({valid_from: '1923'}), 'from 1923')
  assert.equal(model.validityLine({}), null)
})

test('the relations legend: the hard geography relations in their order, then the owner\'s own, unnamed last; mythic stays mythic (T8, T30)', () => {
  const rows = model.relationRows([
    place({relation: 'DREAMT_OF'}),
    place({relation: 'MYTH_LOCATED_AT', located: false}),
    place({relation: null}),
    place({relation: 'LOCATED_IN'}),
    place({relation: 'OCCURRED_AT'}),
    place({relation: 'OCCURRED_AT', located: false}),
    {ref: 'wiki:project:p', name: 'P', kind: 'project', owner: 'wiki', source: 'x', located: false, precision: 'unlocated', reason: null},
  ])
  assert.deepEqual(rows.map(row => row.relation), ['OCCURRED_AT', 'LOCATED_IN', 'MYTH_LOCATED_AT', 'DREAMT_OF', model.UNNAMED_RELATION])
  assert.deepEqual(rows.map(row => row.standing), ['factual', 'factual', 'mythic', 'owner-vocabulary', 'owner-vocabulary'])
  assert.deepEqual(rows[0], {relation: 'OCCURRED_AT', standing: 'factual', count: 2, located: 1, locus: 'historical-event'})
  assert.equal(rows[2].locus, 'myth-episode', 'a mythic place is never a historical locus')
  assert.equal(rows[1].locus, 'artifact', 'being located in a place is a placed thing')
  assert.ok(GEOGRAPHY_RELATIONS.indexOf('OCCURRED_AT') < GEOGRAPHY_RELATIONS.indexOf('LOCATED_IN'), 'the legend order is the authority\'s')
})

test('hierarchy is listed, not drawn; a walk needs two located TRAVELLED_TO stops (T11, T12)', () => {
  const places = [
    place({ref: 'p:kus', name: 'Küsnacht', within: [{place_ref: 'p:zh', relation: 'LOCATED_IN'}]}),
    place({ref: 'p:zh', name: 'Zurich'}),
    place({ref: 'p:far', name: 'Far', within: [{place_ref: 'p:nowhere', relation: 'LOCATED_IN'}]}),
    place({ref: 'p:a', relation: 'TRAVELLED_TO', subject_ref: 's:walker'}),
    place({ref: 'p:b', relation: 'TRAVELLED_TO', subject_ref: 's:walker'}),
    place({ref: 'p:c', relation: 'TRAVELLED_TO', subject_ref: 's:once'}),
    place({ref: 'p:d', relation: 'TRAVELLED_TO', subject_ref: 's:once', located: false}),
  ]
  assert.deepEqual(model.withinRows(places).map(row => `${row.childName} ${row.relation} ${row.parentName}`), ['Küsnacht LOCATED_IN Zurich', 'Far LOCATED_IN p:nowhere'],
    'a parent the world does not hold is named by its ref')
  assert.deepEqual(model.routeRows(places), [{subject_ref: 's:walker', stops: 2, walkable: true}, {subject_ref: 's:once', stops: 1, walkable: false}])
})

test('the plate\'s scale is the atlas\'s own: the sky is the system, its regional framing a region, the Graph no scale of the Earth', () => {
  assert.equal(model.atlasScaleOf({sky: true, graph: false, dist: 3.8}), 'system')
  assert.equal(model.atlasScaleOf({sky: false, graph: false, dist: 3.8}), 'body')
  assert.equal(model.atlasScaleOf({sky: false, graph: false, dist: model.REGION_DISTANCE}), 'region')
  assert.equal(model.atlasScaleOf({sky: false, graph: true, dist: 2}), 'graph')
})

test('the find narrows the world\'s own places by every word, over name, ref and relation', () => {
  const rows = model.placeRows([place({ref: 'p:b', name: 'Bollingen Tower'}), place({ref: 'p:k', name: 'Küsnacht', relation: 'LOCATED_IN'})])
  assert.deepEqual(model.findPlaceRows(rows, 'tower bol').map(row => row.ref), ['p:b'])
  assert.deepEqual(model.findPlaceRows(rows, 'located_in').map(row => row.ref), ['p:k'])
  assert.equal(model.findPlaceRows(rows, '  ').length, 2)
})

test('the provider carries the facet\'s own fields verbatim, and only those the owner declares', () => {
  assert.deepEqual(facetFieldsOf({place_ref: 'p', precision: 'approximate', uncertainty: 'about 2 km', source_ref: 'wiki:src', valid_from: '1923-01-01', valid_to: ' ',
    hierarchy: [{place_ref: 'p:zh', relation: 'LOCATED_IN'}, {place_ref: '', relation: 'LOCATED_IN'}]}),
  {uncertainty: 'about 2 km', evidence: 'wiki:src', valid_from: '1923-01-01', within: [{place_ref: 'p:zh', relation: 'LOCATED_IN'}]})
  assert.deepEqual(facetFieldsOf({place_ref: 'p', precision: 'exact'}), {})
})

test('the standing names the field\'s bodies: Central\'s root and each hosted world, never a project space (for the Bodies rows)', async () => {
  const {composeSuite, standingOf} = await import('../src/projections/atlas/provider/suiteReading.ts')
  const node = (ref, kind, label, native_owner = 'wiki') => ({ref, kind, label, native_owner, provenance: {source: 'Central wiki', revision: 'r1'}})
  const reading = {nodes: [node('wiki:space:central', 'wiki-space', 'Central'), node('field:world:ariadne', 'hosted-central-world', 'Ariadne', 'shared-field'),
    node('wiki:node:stone', 'wiki-node', 'The stone')],
    // a project space is named by its ref only, on the root's child edge (as the owner gives it): a place on a body, not a body
    edges: [{relation: 'space-child-space', from_ref: 'wiki:space:central', to_ref: 'wiki:space:o-i', provenance: {source: 'Central wiki'}}]}
  const sources = {inputs: {central_wiki: {name: 'central_wiki', state: 'available', owner_operation: 'graph', detail: '', reading}}, readAt: new Date('2026-10-15T10:00:00Z')}
  const composition = composeSuite(sources)
  assert.deepEqual(composition.bodies, [
    {ref: 'wiki:space:central', name: 'Central', kind: 'root', owner: 'wiki', source: 'Central wiki'},
    {ref: 'field:world:ariadne', name: 'Ariadne', kind: 'world', owner: 'shared-field', source: 'Central wiki'},
  ])
  assert.deepEqual(standingOf('ready', sources, composition).bodies, composition.bodies)
  assert.deepEqual(standingOf('idle', sources, null).bodies, [], 'no composition: no bodies, never a guess')
})
