// The suite corpus provider (T-N3-ATLAS-SUITE-PROVIDER): the atlas reads Central's owners, never an old corpus. Scripted over the
// recorded 14 Oct 2026 Graph reading (tests/fixtures/atlas-suite-reading.json: the owners' rows, edges, labels, refs and revisions
// as they returned them, no place and no time on any row) and over synthetic declarations where the owners declare none today.
//   - every occurrence carries its owner ref and basis; none is located without a declared place; none is dated without a declared time;
//   - the hard geography relations survive verbatim, and a myth relation never becomes a historical locus;
//   - an owner input that did not answer is named with the owner's own detail; the reading composes as each input arrives;
//   - the field the provider composes stands in the atlas's own model and graph, unplaced and undated, without a changed line of how it draws.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const root = new URL('../../../../', import.meta.url)
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  const source=(await readFile(new URL(url),'utf8')).replace(/import\\.meta\\.env/g,'({BASE_URL:"/"})');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const atlas = new URL('packages/live-shell/ui/src/projections/atlas/', root)
const providerUrl = new URL('provider/suiteProvider.ts', atlas)
const readingUrl = new URL('provider/suiteReading.ts', atlas)
const standingUrl = new URL('provider/suiteStanding.ts', atlas)
const {suiteProvider, readSuite, declarationsFromWiki, readDeclarations, ensureSuiteStanding} = await import(providerUrl)
const {composeSuite, locateFacet, locusOfRelation, yearOfDeclared, declaredTimeOfFacets, paletteOfRef, inputOfReading, unavailableInput, NO_DECLARATIONS, standingOf} = await import(readingUrl)
const {describeStanding, describeProgress, suiteStanding, subscribeSuiteStanding, publishSuiteStanding, resetSuiteStanding, IDLE_STANDING, SUITE_PROVIDER_ID, SUITE_PROVIDER_NAME} = await import(standingUrl)
const {checkOccurrence} = await import(new URL('packages/live-shell/ui/src/projections/occurrence.ts', root))
const {buildModel} = await import(new URL('src/data/model.ts', atlas))
const {buildGraph} = await import(new URL('src/graph/build.ts', atlas))
const time = await import(new URL('src/data/time.ts', atlas))
const {passes} = await import(new URL('src/shell/filter.ts', atlas))
const {uSpan} = await import(new URL('src/state/timeModel.ts', atlas))
const {replaceModelOccurrence} = await import(new URL('src/data/occurrenceSeam.ts', atlas))

const fixture = JSON.parse(await readFile(new URL('packages/live-shell/ui/tests/fixtures/atlas-suite-reading.json', root), 'utf8'))
const READ_AT = new Date('2026-10-14T15:17:18.000Z')
const clone = value => JSON.parse(JSON.stringify(value))
const WIKI_BASIS = {path: fixture.wikiFile.path, revision: fixture.wikiFile.revision, location: {schema: 'central.path-ref/v1', ref: 'ref:Control/agents/wiki/wiki.json', root: 'Control', path: fixture.wikiFile.path}}
const wikiContent = (objects = fixture.wikiFile.objects) => JSON.stringify({objects})
const recordedInputs = () => ({
  central_wiki: inputOfReading('central_wiki', clone(fixture.graph.central_wiki)),
  shared_field: inputOfReading('shared_field', clone(fixture.graph.shared_field)),
  aikit_resolution: inputOfReading('aikit_resolution', clone(fixture.graph.aikit_resolution)),
})
const recordedDeclarations = () => declarationsFromWiki(wikiContent(), WIKI_BASIS)
const compose = (extra = {}) => composeSuite({inputs: recordedInputs(), declarations: recordedDeclarations(), readAt: READ_AT, ...extra})

// ── the recorded reading ──────────────────────────────────────────────────

test('the fixture is the recorded 14 Oct reading: its rows carry no place and no time', () => {
  const nodes = ['central_wiki', 'shared_field', 'aikit_resolution'].flatMap(name => fixture.graph[name].nodes)
  assert.equal(nodes.length, 48)
  assert.equal(['central_wiki', 'shared_field'].flatMap(name => fixture.graph[name].edges).length, 94)
  assert.deepEqual(Object.keys(nodes[0]).sort(), ['actions', 'kind', 'label', 'native_owner', 'provenance', 'ref'], 'a row carries only ref, kind, label, native_owner, provenance, actions')
  assert.equal(nodes.some(node => 'place' in node || 'lat' in node || 'year' in node || 'valid_from' in node), false)
  assert.equal(fixture.graph.aikit_resolution.inputs.aikit_resolution.state, 'unavailable')
  assert.match(fixture.graph.aikit_resolution.inputs.aikit_resolution.detail, /did not return within 20 seconds/)
  assert.equal(JSON.stringify(fixture.wikiFile.objects).includes('aikit.techne-facet/v1'), false, 'no recorded wiki object declares a place or a time')
})

// ── every occurrence has an owner ref and basis ───────────────────────────

test('every occurrence carries its owner ref and basis, as the occurrence contract checks them', () => {
  const {field} = compose()
  const refs = new Set(['central_wiki', 'shared_field'].flatMap(name => fixture.graph[name].nodes).map(node => node.ref))
  assert.equal(field.occurrences.length, 45, '5 wiki nodes and 40 hosted rows: the 2 hosted worlds and Central\'s root space are registers, not subjects')
  for (const occurrence of field.occurrences) {
    const checked = checkOccurrence(occurrence)
    assert.equal(checked.ok, true, `${occurrence.id}: ${checked.reason}`)
    assert.ok(refs.has(occurrence.subject_ref), `${occurrence.subject_ref} is an owner row`)
    assert.equal(occurrence.basis.ref, occurrence.subject_ref, 'the basis names the owner ref')
    const row = ['central_wiki', 'shared_field'].flatMap(name => fixture.graph[name].nodes).find(node => node.ref === occurrence.subject_ref)
    assert.equal(occurrence.basis.revision, row.provenance.revision, 'the basis carries the revision the owner returned')
    assert.equal(occurrence.title, row.label, 'the title is the owner\'s own')
    assert.ok(occurrence.body[0] === `Ref: ${occurrence.subject_ref}`, 'the owner ref is the first line a reader sees')
    assert.deepEqual(occurrence.cites, [{work: row.native_owner, workTitle: row.provenance.source, year: `rev ${row.provenance.revision}`, locator: row.ref}], 'the cite names the owner and the read')
  }
  assert.equal(new Set(field.occurrences.map(occurrence => occurrence.id)).size, 45, 'ids are unique')
  assert.equal(new Set(field.occurrences.map(occurrence => occurrence.subject_ref)).size, 45, 'one occurrence per owner ref')
})

test('no occurrence is located without a declared place, and none is dated without a declared time', () => {
  const {field, counts, places} = compose()
  for (const occurrence of field.occurrences) {
    assert.equal(occurrence.geoPrecision, 'none', `${occurrence.subject_ref} is unlocated`)
    assert.equal(occurrence.lat, 0)
    assert.equal(occurrence.lon, 0)
    assert.equal(occurrence.place, '')
    assert.equal(occurrence.dated, false, `${occurrence.subject_ref} is undated`)
    assert.equal(occurrence.yearDisplay, 'undated')
    assert.equal(occurrence.year, field.meta.yearMax, 'the placeholder year is the field\'s yearMax, which no code reads as a date')
  }
  assert.deepEqual({subjects: counts.subjects, located: counts.located, unlocated: counts.unlocated, undated: counts.undated, dated: counts.dated}, {subjects: 45, located: 0, unlocated: 45, undated: 45, dated: 0})
  assert.equal(places.length, 15, 'each project space of Central is a place')
  assert.ok(places.every(place => place.kind === 'project' && place.located === false && place.precision === 'unlocated' && place.reason), 'every project place is unlocated, with its reason')
  assert.equal(counts.unlocatedPlaces, 15)
  assert.deepEqual(places.map(place => place.name).slice(0, 3), ['Actuation', 'Archetypal-Earth', 'Central'])
  assert.ok(places.every(place => /^central:wiki:project:/.test(place.ref)), 'the place refs are the owner\'s own')
})

test('the registers are the owners\' worlds, and each family is tied to its register by the owner\'s declared edge', () => {
  const {field} = compose()
  const names = field.archetypes.map(archetype => archetype.name)
  assert.equal(field.archetypes.length, 18, 'Central\'s root, 15 project spaces, 2 hosted worlds')
  assert.ok(names.includes('Central') && names.includes('O-I — a ProjectCentral world'))
  assert.equal(field.archetypes.filter(archetype => archetype.prime).length, 1)
  assert.equal(field.archetypes.find(archetype => archetype.prime).name, 'Central', 'Central is your planet')
  const root = field.archetypes.find(archetype => archetype.name === 'Central')
  assert.equal(root.occurrenceCount, 5, 'the five wiki nodes stand in Central\'s register (space-node / node-space)')
  const intent = field.families.find(family => family.name === 'wiki-node:intent')
  assert.ok(intent, 'a wiki node\'s own type is the kind within its owner')
  assert.deepEqual(intent.archetypes, [{id: root.id, basis: 'site'}])
  assert.ok(['wiki-node:identity', 'wiki-node:return', 'wiki-node:learning', 'hosted-practice', 'hosted-curated-artifact', 'hosted-wiki-node'].every(name => field.families.some(family => family.name === name)))
  const practice = field.families.find(family => family.name === 'hosted-practice')
  assert.equal(practice.occurrenceIds.length, 18)
  assert.equal(practice.archetypes.length, 2, 'darshana is carried in both hosted worlds')
  for (const family of field.families) {
    for (const tie of family.archetypes) assert.ok(field.archetypes.some(archetype => archetype.id === tie.id), 'a tie names a register')
    assert.ok(family.occurrenceIds.every(id => field.occurrences.some(occurrence => occurrence.id === id && occurrence.familyId === family.id)))
  }
  assert.deepEqual(field.meta.ties.bases, [{id: 'site', label: 'Declared by its owner'}])
  assert.deepEqual(field.meta.provider, {id: 'suite', name: 'Your world', home: 'central.wiki.read · shared-field.projection · aikit.knowledge.resolve', labels: field.meta.provider.labels})
})

test('the hard relations survive verbatim: the owner\'s relation names stay in the bodies and on the joins', () => {
  const {field} = compose()
  const hosted = id => field.occurrences.find(occurrence => occurrence.subject_ref === id)
  const a04 = hosted('world:central:project:O-I:region:a04-mask/wiki:node:record/A04')
  assert.ok(a04.body.some(line => /^wiki\.edge\/references → A04′ — The Mask as Document \(world:central:project:O-I:region:a04-mask\/wiki:node:record\/A04p\)$/.test(line)), 'the relation, its direction, the title and the ref')
  assert.ok(a04.body.some(line => line.startsWith('wiki.edge/re-sites ←')), 'an incoming relation keeps its own name')
  const a04p = hosted('world:central:project:O-I:region:a04-mask/wiki:node:record/A04p')
  assert.ok(a04.parallelIds.includes(a04p.id) && a04p.parallelIds.includes(a04.id), 'parallels are mutual')
  assert.deepEqual([...new Set(field.joins.map(join => join.system))].sort(), ['node-source', 'oi.world/carried-by', 'oi.world/practises', 'space-child-space', 'wiki.contains'],
    'a relation that joins two kinds is a join named with the owner\'s own relation; one between two things of one kind cannot be a join (the atlas ties no kind to itself)')
  const owned = ['wiki.edge/references', 'wiki.edge/explains', 'wiki.edge/re-sites', 'wiki.edge/follows-pattern-of']
  const edges = fixture.graph.shared_field.edges.filter(edge => owned.includes(edge.relation))
  assert.equal(edges.length, 13, 'the owners\' wiki.edge relations')
  for (const edge of edges) {
    const from = hosted(edge.from_ref)
    const to = hosted(edge.to_ref)
    assert.ok(from.body.some(line => line.startsWith(`${edge.relation} → `) && line.endsWith(`(${edge.to_ref})`)), `${edge.relation} on its source: ${edge.from_ref}`)
    assert.ok(to.body.some(line => line.startsWith(`${edge.relation} ← `) && line.endsWith(`(${edge.from_ref})`)), `${edge.relation} on its target: ${edge.to_ref}`)
    assert.ok(from.parallelIds.includes(to.id) && to.parallelIds.includes(from.id))
  }
  const children = field.joins.filter(join => join.system === 'space-child-space')
  assert.equal(children.length, 15)
  assert.ok(children.every(join => join.a.type === 'archetype' && join.b.type === 'archetype' && join.basis === 'site' && /^space-child-space: Central → /.test(join.note)))
  const ids = new Set([...field.archetypes.map(item => item.id), ...field.families.map(item => item.id)])
  for (const join of field.joins) assert.ok(ids.has(join.a.id) && ids.has(join.b.id), 'a join ends at nodes the field holds')
  const sources = field.occurrences.find(occurrence => occurrence.subject_ref === 'wiki:node:delivered-lane-loses-install')
  assert.equal(sources.body[1], 'Source: central:source:control:root:Work/O-I/.wayfinder/maps/command-encounter-convergence.md · commission:oi527-command-work-journey-20260927 · git:ai-kit@convergence/command-encounter-20260926 · git:ai-kit@guidance/development-world-shape', 'the node\'s sources, as the owner returned them')
})

test('the composed field is the same when composed twice, and a palette follows its ref', () => {
  assert.deepEqual(compose().field, compose().field)
  assert.deepEqual(paletteOfRef('central:wiki:root'), paletteOfRef('central:wiki:root'))
  assert.notDeepEqual(paletteOfRef('central:wiki:root'), paletteOfRef('central:wiki:project:O-I'))
  for (const value of Object.values(paletteOfRef('hosted-practice'))) assert.match(value, /^#[0-9a-f]{6}$/)
})

// ── a declared place and a declared time are the only way a subject is placed or dated ─────────────

const node = (ref, title, extra = {}) => ({object: 'node', profile: 'okf-wiki/v1', ref, revision: 1, title, type: 'learning', source_refs: [], space_refs: ['central:wiki:root'], ...extra})
const declaration = (spatial, temporal) => ({'aikit.techne-facet/v1': {contract: 'aikit.techne-facet/v1', ...(spatial ? {spatial} : {}), ...(temporal ? {temporal} : {})}})
const declaredObjects = () => [
  ...fixture.wikiFile.objects,
]
function withDeclarations(patch) {
  const objects = clone(declaredObjects())
  for (const [ref, change] of Object.entries(patch)) Object.assign(objects.find(object => object.ref === ref), change)
  return declarationsFromWiki(wikiContent(objects), WIKI_BASIS)
}
const IDENTITY = 'wiki:node:identity'
const PROPOSE = 'wiki:node:staged/propose-not-write'
const RETURN = 'wiki:node:root/ta-onta-and-the-thought-stream'
const LANE = 'wiki:node:delivered-lane-loses-install'
const PLACE = 'wiki:node:place-provider-reconciles-like-the-floor'

test('a place the owner declares locates exactly that subject, and only at the declared point and precision', () => {
  const declarations = withDeclarations({
    [IDENTITY]: {place: {names: [{name: 'The Chapel'}], geometry: {type: 'point', coordinates: [-4.27, 50.18]}, precision: 'exact'}},
    [PROPOSE]: {place: {geometry: {type: 'point', coordinates: [12.5, 41.9]}}},
    [RETURN]: declaration([{place_ref: 'place:chartres', precision: 'region', identity: {names: [{name: 'Chartres'}]}, geometry: {type: 'point', coordinates: [1.49, 48.45]}}]),
    [LANE]: {place: {geometry: {type: 'polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]]}, precision: 'region'}},
    [PLACE]: {place: {names: [{name: 'Nowhere yet'}]}},
  })
  assert.equal(declarations.state, 'available')
  const {field, counts, places} = compose({declarations})
  const by = ref => field.occurrences.find(occurrence => occurrence.subject_ref === ref)
  assert.deepEqual([by(IDENTITY).lat, by(IDENTITY).lon, by(IDENTITY).geoPrecision, by(IDENTITY).place], [50.18, -4.27, 'place', 'The Chapel'], 'GeoJSON order: longitude then latitude; exact is a place')
  assert.deepEqual([by(PROPOSE).lat, by(PROPOSE).lon, by(PROPOSE).geoPrecision], [41.9, 12.5, 'region'], 'a declared geometry with no declared precision is approximate, never upgraded to exact')
  assert.deepEqual([by(RETURN).lat, by(RETURN).lon, by(RETURN).geoPrecision, by(RETURN).place], [48.45, 1.49, 'region', 'Chartres'], 'the native aikit.techne-facet/v1 declaration places the row that declares it')
  assert.equal(by(LANE).geoPrecision, 'none', 'a polygon is not a point: the Earth draws points, so it is not drawn')
  assert.ok(by(LANE).body.includes('Not on the Earth: the owner declares a polygon; the Earth draws points.'))
  assert.equal(by(PLACE).geoPrecision, 'none', 'a declared place with no geometry is a real place, honestly unlocated')
  assert.ok(by(PLACE).body.includes('Not on the Earth: the owner declares it unlocated.'), 'the owner\'s declaration with no geometry carries the owner\'s own precision, unlocated')
  const undeclared = field.occurrences.filter(occurrence => ![IDENTITY, PROPOSE, RETURN].includes(occurrence.subject_ref))
  assert.ok(undeclared.every(occurrence => occurrence.geoPrecision === 'none' && occurrence.lat === 0 && occurrence.lon === 0), 'nothing else is placed')
  assert.equal(counts.located, 3)
  assert.equal(counts.unlocated, 42)
  const said = describeStanding(standingOf('ready', {inputs: recordedInputs(), declarations, readAt: READ_AT}, compose({declarations})))
  assert.match(said, /^Your world: 45 subjects read from their owners, 3 on the Earth\. 42 are unlocated: no owner declares where, so the Earth does not draw them\. /, 'the Earth names how many it does not draw')
  const declared = places.filter(place => place.kind === 'declared')
  assert.deepEqual(declared.map(place => [place.ref, place.located]), [[IDENTITY, true], [PROPOSE, true], [LANE, false], [PLACE, false], ['place:chartres', true]].sort((x, y) => declared.findIndex(p => p.ref === x[0]) - declared.findIndex(p => p.ref === y[0])))
  assert.ok(declared.find(place => place.ref === LANE).reason.includes('polygon'))
  assert.equal(places.filter(place => place.kind === 'project').length, 15, 'the project places stay, each unlocated until it declares a place')
})

test('a malformed or contradictory declaration is named, never drawn', () => {
  for (const [facet, reason] of [
    [{place_ref: 'p', precision: 'exact', geometry: {type: 'point', coordinates: [200, 10]}}, 'the declared point is not a longitude and latitude'],
    [{place_ref: 'p', precision: 'exact', geometry: {type: 'point', coordinates: [10]}}, 'the declared point has no coordinate pair'],
    [{place_ref: 'p', precision: 'exact', geometry: {type: 'point', coordinates: ['x', 'y']}}, 'the declared point has no coordinate pair'],
    [{place_ref: 'p', precision: 'unlocated', geometry: {type: 'point', coordinates: [1, 2]}}, 'the owner declares it unlocated'],
    [{place_ref: 'p', precision: 'exact'}, 'the owner declares no geometry'],
  ]) assert.deepEqual(locateFacet(facet), {located: false, reason})
  assert.deepEqual(locateFacet({place_ref: 'p', precision: 'approximate', geometry: {type: 'point', coordinates: [-180, -90]}}), {located: true, lat: -90, lon: -180, geoPrecision: 'region'})
  const bad = withDeclarations({[IDENTITY]: declaration([{place_ref: 'place:x', precision: 'sideways'}])})
  assert.equal(bad.state, 'unavailable', 'the owner\'s own reader refuses a declaration that is not the contract')
  assert.match(bad.detail, /place declarations: .*precision/)
  assert.equal(bad.types[IDENTITY], 'identity', 'the rest of the file is still read')
  const {counts} = compose({declarations: bad})
  assert.equal(counts.located, 0, 'a refused declaration places nothing')
  const text = describeStanding(standingOf('ready', {inputs: recordedInputs(), declarations: bad, readAt: READ_AT}, compose({declarations: bad})))
  assert.match(text, /Declared places and times: unavailable — Control\/agents\/wiki\/wiki\.json was read, but its place declarations: /)
})

test('a time the owner declares dates exactly that subject, and a time that only describes a record dates nothing', () => {
  const declarations = withDeclarations({
    [IDENTITY]: declaration(null, [{kind: 'occurrence', instant: '1698-11-27T00:00:00Z', precision: 'day'}]),
    [PROPOSE]: declaration(null, [{kind: 'valid', interval: {from: '-000044-03-15T12:00:00Z', to: '-000044-03-16T12:00:00Z'}, label: 'The Ides'}]),
    [RETURN]: declaration(null, [{kind: 'source-modified', instant: '2026-09-16T00:00:00Z'}, {kind: 'receipt', instant: '2026-09-17T00:00:00Z'}]),
    [LANE]: declaration(null, [{kind: 'day', day_ref: 'day:2026-09-26'}]),
  })
  assert.equal(declarations.state, 'available')
  const {field, counts} = compose({declarations})
  const by = ref => field.occurrences.find(occurrence => occurrence.subject_ref === ref)
  assert.deepEqual([by(IDENTITY).year, by(IDENTITY).yearDisplay, by(IDENTITY).dated], [1698, '1698-11-27', undefined])
  assert.deepEqual([by(PROPOSE).year, by(PROPOSE).yearDisplay], [-44, 'The Ides'], 'the owner\'s own label for the period is the display; BCE stays negative')
  assert.equal(by(RETURN).dated, false, 'a source\'s modification or a receipt is about the record, not the subject')
  assert.equal(by(LANE).dated, false, 'a day reference is a continuity facet with no year')
  assert.equal(counts.dated, 2)
  assert.equal(counts.undated, 43)
  assert.equal(field.meta.yearMin, -44)
  assert.equal(field.meta.yearMax, 1698)
  assert.ok(field.occurrences.filter(occurrence => occurrence.dated === false).every(occurrence => occurrence.year === 1698), 'an undated occurrence holds the placeholder year, never a date')
  assert.deepEqual([yearOfDeclared('1850'), yearOfDeclared('-44'), yearOfDeclared('2026-09-27'), yearOfDeclared('+012345-01-01T00:00:00Z'), yearOfDeclared('tomorrow'), yearOfDeclared(null), yearOfDeclared('18th c.')], [1850, -44, 2026, 12345, undefined, undefined, undefined])
  assert.equal(declaredTimeOfFacets([{kind: 'run', instant: '2026-01-01T00:00:00Z'}]), undefined)
})

test('a declared place\'s own validity dates the subject that declares it', () => {
  const declarations = withDeclarations({[IDENTITY]: {place: {geometry: {type: 'point', coordinates: [0, 0]}, precision: 'exact', valid_from: '1850'}}})
  const {field} = compose({declarations})
  const occurrence = field.occurrences.find(item => item.subject_ref === IDENTITY)
  assert.deepEqual([occurrence.year, occurrence.yearDisplay, occurrence.geoPrecision], [1850, '1850', 'place'])
  assert.deepEqual([field.meta.yearMin, field.meta.yearMax], [1849, 1850], 'one declared year: the clock face still has a track (the time control refuses a range that does not increase), ending at that year')
  const model = buildModel(field)
  assert.ok(model.scale.toU(field.meta.yearMin) < model.scale.toU(field.meta.yearMax), 'the face\'s range increases')
})

// ── the open Technē reading's place facets ────────────────────────────────

test('the open Technē reading\'s place facets carry their relation verbatim, and a myth is never a historical locus', () => {
  const reading = {
    subject_ref: 'wiki:node:identity', title: 'User identity', native_owner: 'wiki', revision: '1',
    spatial: [
      {place_ref: 'place:eddystone', relation: 'OCCURRED_AT', precision: 'exact', identity: {names: [{name: 'Eddystone'}]}, geometry: {type: 'point', coordinates: [-4.27, 50.18]}},
      {place_ref: 'place:atlantis', relation: 'MYTH_LOCATED_AT', precision: 'region', identity: {names: [{name: 'Atlantis'}]}, geometry: {type: 'point', coordinates: [-25, 35]}},
      {place_ref: 'place:chartres', relation: 'LOCATED_IN', precision: 'unlocated'},
      {place_ref: 'place:house', relation: 'WORKED_FROM', precision: 'exact', geometry: {type: 'point', coordinates: [8.5, 47.3]}},
    ],
  }
  const {field, places, counts} = compose({techne: reading})
  const facetOccurrences = field.occurrences.filter(occurrence => occurrence.subject_ref === 'wiki:node:identity' && occurrence.body.some(line => line.startsWith('Relation: ')))
  assert.equal(facetOccurrences.length, 4)
  const by = relation => facetOccurrences.find(occurrence => occurrence.body.includes(`Relation: ${relation}`))
  assert.equal(by('OCCURRED_AT').locusType, 'historical-event')
  assert.equal(by('MYTH_LOCATED_AT').locusType, 'myth-episode', 'MYTH_LOCATED_AT never becomes a historical locus')
  assert.equal(by('LOCATED_IN').locusType, 'artifact')
  assert.equal(by('WORKED_FROM').locusType, 'artifact', 'an owner-vocabulary relation is kept verbatim and gives the neutral locus')
  assert.deepEqual([by('OCCURRED_AT').lat, by('OCCURRED_AT').lon, by('OCCURRED_AT').place], [50.18, -4.27, 'Eddystone'])
  assert.equal(by('LOCATED_IN').geoPrecision, 'none', 'an unlocated facet is not drawn')
  for (const occurrence of facetOccurrences) {
    assert.equal(checkOccurrence(occurrence).ok, true)
    assert.equal(occurrence.basis.ref, 'wiki:node:identity')
    assert.equal(occurrence.basis.revision, '1')
  }
  assert.deepEqual(places.filter(place => place.source === 'ql.techne/v1').map(place => [place.ref, place.relation]), [['place:eddystone', 'OCCURRED_AT'], ['place:atlantis', 'MYTH_LOCATED_AT'], ['place:chartres', 'LOCATED_IN'], ['place:house', 'WORKED_FROM']])
  assert.equal(counts.located, 3)
  assert.equal(locusOfRelation('OPERATED_IN'), 'historical-event')
  assert.equal(locusOfRelation('TRAVELLED_TO'), 'historical-event')
  assert.equal(locusOfRelation(null), 'artifact')
})

// ── the owners that did not answer are named ──────────────────────────────

const flush = () => new Promise(resolve => setImmediate(resolve))
function fakeReaders({failing = {}, delay = {}} = {}) {
  const log = []
  return {
    log,
    graph: async input => {
      log.push(`graph ${input}`)
      if (delay[input]) await delay[input]
      if (failing[input]) throw new Error(failing[input])
      return clone(fixture.graph[input])
    },
    declarations: async () => {
      log.push('declarations')
      return recordedDeclarations()
    },
  }
}
const quiet = {publish() {}, wait: () => new Promise(() => {}), now: () => READ_AT}

test('an unavailable input is named with the owner\'s own detail, and the others still compose', async () => {
  const {standing, composition} = await readSuite(fakeReaders(), {...quiet, aikitWaitMs: 0, wait: () => flush().then(flush)})
  assert.equal(standing.phase, 'ready')
  assert.deepEqual(standing.inputs.aikit_resolution, {name: 'aikit_resolution', label: 'AIKit knowledge', state: 'unavailable', owner_operation: 'aikit.knowledge.resolve', detail: 'AIKit is unavailable: AIKit knowledge read did not return within 20 seconds', rows: 0})
  assert.equal(standing.inputs.central_wiki.state, 'available')
  assert.equal(standing.inputs.central_wiki.detail, 'central:source:control:root:Control/agents/wiki/wiki.json', 'an available input names its owner source')
  assert.equal(standing.inputs.shared_field.rows, 42)
  assert.equal(composition.counts.subjects, 45)
  const text = describeStanding(standing)
  assert.match(text, /^Your world: 45 subjects read from their owners, none on the Earth\. No owner declares where they are, so the Earth draws them nowhere\./)
  assert.match(text, /15 places are unlocated too\./)
  assert.match(text, /45 are undated\./)
  assert.match(text, /AIKit knowledge: unavailable — AIKit is unavailable: AIKit knowledge read did not return within 20 seconds\.$/)

  const failed = await readSuite(fakeReaders({failing: {shared_field: 'the shared field is not bound to a hosting target'}}), {...quiet, aikitWaitMs: 0, wait: () => flush().then(flush)})
  assert.deepEqual([failed.standing.inputs.shared_field.state, failed.standing.inputs.shared_field.detail], ['unavailable', 'the shared field is not bound to a hosting target'], 'a transport failure is named in its own words')
  assert.equal(failed.composition.counts.subjects, 5, 'Central\'s wiki alone: five subjects, and the 15 project places')
  assert.equal(failed.composition.places.length, 15)
})

test('with no owner answering, the reading is unavailable and names every input; no field is invented', async () => {
  const readers = fakeReaders({failing: {central_wiki: 'no kernel transport', shared_field: 'no kernel transport', aikit_resolution: 'no kernel transport'}})
  await assert.rejects(readSuite(readers, {...quiet, aikitWaitMs: 0}), error => {
    assert.match(error.message, /^The atlas data is unavailable\. /)
    for (const label of ['Central’s wiki', 'The shared field', 'AIKit knowledge']) assert.ok(error.message.includes(`${label}: unavailable — no kernel transport.`), label)
    return true
  })
  const empty = fakeReaders()
  empty.graph = async input => ({...clone(fixture.graph.aikit_resolution), inputs: {...clone(fixture.graph.aikit_resolution.inputs), [input]: {state: 'available', owner_operation: 'x', detail: 'ok'}}})
  await assert.rejects(readSuite(empty, {...quiet, aikitWaitMs: 0}), /^Error: The atlas data is unavailable\. /, 'owners that answer with no row compose no field')
})

test('the field is composed as each input arrives, and the standing is published after each', async () => {
  let releaseShared
  const gate = new Promise(resolve => { releaseShared = resolve })
  const seen = []
  const readers = fakeReaders({delay: {shared_field: gate}})
  const done = readSuite(readers, {...quiet, aikitWaitMs: 0, wait: () => flush().then(flush), publish: standing => seen.push({phase: standing.phase, subjects: standing.counts.subjects, inputs: Object.fromEntries(Object.entries(standing.inputs).map(([name, input]) => [name, input.state]))})})
  await flush(); await flush(); await flush()
  const midway = seen.at(-1)
  assert.deepEqual(midway.inputs, {central_wiki: 'available', shared_field: 'reading', aikit_resolution: 'reading'}, 'Central\'s wiki has arrived and the pane can say so while the shared field is awaited')
  assert.equal(midway.subjects, 5, 'its five subjects are composed already')
  assert.deepEqual(readers.log, ['graph central_wiki', 'declarations', 'graph shared_field'], 'the ground first, then Central\'s wiki file, then the hosted field; AIKit last, so it never holds the others')
  releaseShared()
  const {standing} = await done
  assert.equal(standing.counts.subjects, 45)
  assert.ok(seen.every(item => item.phase === 'reading' || item.phase === 'ready'))
  assert.deepEqual(seen.map(item => item.subjects).filter((count, index, all) => index === 0 || count !== all[index - 1]), [0, 5, 45])
  assert.equal(describeProgress({...seen[0], ...suiteStandingFrom(seen[0])}), 'Reading your world; waiting for Central’s wiki, the shared field, AIKit knowledge…')
})
function suiteStandingFrom(item) {
  const inputs = {}
  for (const [name, state] of Object.entries(item.inputs)) inputs[name] = {name, label: {central_wiki: 'Central’s wiki', shared_field: 'The shared field', aikit_resolution: 'AIKit knowledge'}[name], state, owner_operation: '', detail: '', rows: 0}
  return {inputs, counts: {subjects: item.subjects}}
}

test('an input that answers after the Earth has stood is named, and joins the next reading', async () => {
  let releaseAikit
  const slow = new Promise(resolve => { releaseAikit = resolve })
  const seen = []
  const readers = fakeReaders({delay: {aikit_resolution: slow}})
  const {standing, composition} = await readSuite(readers, {...quiet, aikitWaitMs: 0, wait: () => flush().then(flush), publish: item => seen.push(item)})
  assert.equal(standing.inputs.aikit_resolution.state, 'reading')
  assert.match(describeStanding(standing), /AIKit knowledge: still being read\./)
  const before = seen.length
  releaseAikit()
  await flush(); await flush()
  assert.equal(seen.length, before + 1, 'the late answer is published')
  assert.equal(seen.at(-1).inputs.aikit_resolution.state, 'unavailable')
  assert.equal(seen.at(-1).counts.subjects, composition.counts.subjects, 'the composition the Earth stands on is not changed by it')
  assert.equal(composition.field.occurrences.length, 45)
})

test('the provider is the suite: id and name by data, one bundle per load, nothing of any other corpus', async () => {
  const provider = suiteProvider({kind: 'unavailable', reason: 'unused'}, {readers: fakeReaders(), read: {...quiet, aikitWaitMs: 0, wait: () => flush().then(flush)}})
  assert.deepEqual([provider.id, provider.name], ['suite', 'Your world'])
  assert.deepEqual([SUITE_PROVIDER_ID, SUITE_PROVIDER_NAME], ['suite', 'Your world'])
  const [one, two] = [await provider.load(), await provider.load()]
  assert.equal(one.id, 'suite')
  assert.deepEqual(one.images, {})
  assert.equal(one.history, undefined)
  assert.equal(one.published, undefined)
  assert.notEqual(one.field, two.field, 'every load composes a new field, so a mount never holds one another mount changed')
  assert.deepEqual(clone(one.field.occurrences.map(item => item.subject_ref)), clone(two.field.occurrences.map(item => item.subject_ref)))
  const code = (await readFile(new URL('provider/suiteProvider.ts', atlas), 'utf8')).split('\n').filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n')
  assert.equal(/fetch\(|archetypalEarth|Archetypal-Earth|public\/data/.test(code), false, 'the suite provider reads no bundle of Archetypal-Earth and fetches nothing itself')
  const reading = (await readFile(new URL('provider/suiteReading.ts', atlas), 'utf8')).split('\n').filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n')
  assert.equal(/fetch\(|document\.|window\.|localStorage|Date\.now|new Date\(\)/.test(reading), false, 'the composition is pure: no transport, no DOM, no storage, no clock')
})

test('the host binds the suite and not the founding corpus: the panel loads the suite provider and names no other source', async () => {
  const panel = (await readFile(new URL('AtlasProjectionPanel.tsx', atlas), 'utf8')).split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n')
  assert.match(panel, /import\('\.\/provider\/suiteProvider'\)/)
  assert.doesNotMatch(panel, /archetypalEarthProvider|ARCHETYPAL_EARTH/, 'Archetypal-Earth\'s bundled corpus stops being read')
  assert.match(panel, /provider: SUITE_PROVIDER_ID/)
})

test('the transport reads the owners one input at a time through the kernel Graph op and Central\'s files', async () => {
  const calls = []
  const transport = {kind: 'bridge', url: 'http://bridge.test'}
  const previous = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const op = JSON.parse(init.body)
    calls.push(op)
    if (op.op === 'graph') return Response.json({ok: true, outcome: {result: 'graph_reading', reading: clone(fixture.graph[op.options.input])}})
    if (op.op === 'files_list') return Response.json({ok: true, outcome: {result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: {schema: 'central.path-ref/v1', ref: 'ref:Control/agents/wiki', root: 'Control', path: 'Control/agents/wiki'}, automatic_agent_or_model_invocation: false,
      entries: [{name: 'wiki.json', kind: 'file', byte_len: 9023, retrieval_allowed: true, location: WIKI_BASIS.location}]}}})
    if (op.op === 'file_read') return Response.json({ok: true, outcome: {result: 'file_read', reading: {schema: 'central.file-reading/v1', location: op.location, revision: fixture.wikiFile.revision, byte_len: 9023, content_encoding: 'utf-8', content: wikiContent(), project: null, source: null, automatic_agent_or_model_invocation: false}}})
    return Response.json({ok: false, error: `unexpected op ${op.op}`})
  }
  try {
    const {composition} = await readSuite({...await import(providerUrl).then(module => module.centralReaders(transport))}, {...quiet, aikitWaitMs: 0, wait: () => flush().then(flush).then(flush).then(flush)})
    assert.deepEqual(calls.map(call => call.op === 'graph' ? `graph:${call.options.input}` : call.op), ['graph:central_wiki', 'files_list', 'file_read', 'graph:shared_field', 'graph:aikit_resolution'])
    assert.ok(calls.filter(call => call.op === 'graph').every(call => call.query === '' && call.project === undefined && call.options.max_nodes === 4096), 'the Graph op, Central\'s own bounds, no project scope')
    assert.equal(calls.find(call => call.op === 'files_list').path, 'Control/agents/wiki')
    assert.equal(calls.find(call => call.op === 'file_read').location.path, 'Control/agents/wiki/wiki.json', 'the file is read at the location its folder\'s listing returned')
    assert.equal(composition.field.occurrences.find(item => item.subject_ref === IDENTITY).familyId, composition.field.families.find(family => family.name === 'wiki-node:identity').id)
    const unreadable = await readDeclarations({kind: 'unavailable', reason: 'the bridge is not running'})
    assert.deepEqual([unreadable.state, unreadable.detail], ['unavailable', 'the bridge is not running'])
  } finally {
    globalThis.fetch = previous
  }
})

test('the Places browser asks for the standing before the Earth is opened, and a read in flight is shared with the atlas\'s own load', async () => {
  resetSuiteStanding()
  const transport = {kind: 'bridge', url: 'http://shared-read.test'}
  const readers = fakeReaders()
  const options = {readers, read: {now: quiet.now, aikitWaitMs: 0, wait: () => flush().then(flush)}} // publishes to the shared store, as the host does
  const asked = ensureSuiteStanding(transport, options)
  const loading = suiteProvider(transport, options).load()
  const loadingToo = suiteProvider(transport, options).load()
  const [standing, bundle, other] = await Promise.all([asked, loading, loadingToo])
  assert.equal(readers.log.filter(line => line === 'graph central_wiki').length, 1, 'one read of the owners, shared')
  assert.equal(standing.phase, 'ready')
  assert.equal(standing.places.length, 15, 'the project places are on the standing, with no Earth opened')
  assert.equal(bundle.field.occurrences.length, 45)
  assert.notEqual(other.field, bundle.field, 'two loads that shared one read never share one Field, which the atlas\'s seam changes in place')
  assert.equal(suiteStanding(), standing, 'the store holds what the ask returned')
  const again = await ensureSuiteStanding(transport, options)
  assert.equal(again, standing, 'a standing already read is not read again')
  assert.equal(readers.log.filter(line => line === 'graph central_wiki').length, 1)
  resetSuiteStanding()
  const failed = await ensureSuiteStanding({kind: 'unavailable', reason: 'the bridge is not running'}, {readers: fakeReaders({failing: {central_wiki: 'the bridge is not running', shared_field: 'the bridge is not running', aikit_resolution: 'the bridge is not running'}}), read: {now: quiet.now, aikitWaitMs: 0}})
  assert.equal(failed.phase, 'unavailable', 'a failed read is a standing, not a throw')
  assert.match(describeStanding(failed), /Central’s wiki: unavailable — the bridge is not running\./)
  resetSuiteStanding()
})

// ── the atlas draws the composed field as it draws any field ──────────────

test('the atlas builds its model and its graph over the composed field: unplaced and undated, with nothing drawn on the Earth', () => {
  const {field} = compose()
  const model = buildModel(field)
  assert.equal(model.occ.length, 45)
  assert.ok([...model.located].every(flag => flag === 0), 'the model places none of them')
  assert.ok([...model.u].every(u => u === time.UNDATED_U), 'each stands outside the time scale')
  assert.equal(model.places.size, 0, 'a place is two or more located occurrences; none is located')
  assert.equal(model.scale.yearMin, 2025)
  assert.equal(model.scale.yearMax, 2026, 'with no date declared, the scale is the one year ending at the year the owners were read: a track for the clock face, never a date of any subject')
  assert.ok(model.scale.toU(field.meta.yearMin) < model.scale.toU(field.meta.yearMax), 'the time control\'s range increases (it refuses one that does not)')
  const graph = buildGraph(model)
  assert.equal(graph.nodes.length, field.archetypes.length + field.families.length + field.occurrences.length)
  assert.equal(graph.occurrenceIds.length, 45)
  assert.ok(graph.occurrenceIds.every(id => graph.nodes[id].placed === false && graph.nodes[id].yearDisplay === 'undated'), 'the graph holds them, hollow and undated')
  assert.ok(graph.edges.some(edge => edge.kind === 'parallel'), 'the owners\' edges between subjects are parallels')
  assert.equal(graph.edges.filter(edge => edge.kind === 'tie' && edge.basis === 'site').length > 15, true, 'the registers and kinds are tied by site')
  const window = {on: 1, cursorU: 0.4, trail: time.DEFAULT_TRAIL, ramp: time.DEFAULT_RAMP}
  for (const id of graph.occurrenceIds) assert.equal(time.timeVisibility(graph.nodes[id].u, window), 1, 'an undated subject is never gated by the time window')
  assert.equal(time.timeVisibility(0.9, window) < 1, true, 'a dated one still is: the found curve is untouched')
})

test('an occurrence declared with a place and a time stands on the Earth in the atlas\'s own model, at its own place and year', () => {
  const declarations = withDeclarations({[IDENTITY]: {place: {geometry: {type: 'point', coordinates: [-4.27, 50.18]}, precision: 'exact', valid_from: '1698'}}})
  const model = buildModel(compose({declarations}).field)
  const i = model.occIndex.get(model.occ.find(occurrence => occurrence.subject_ref === IDENTITY).id)
  assert.equal(model.located[i], 1)
  assert.ok(model.u[i] >= 0 && model.u[i] <= 1)
  assert.equal(model.located.reduce((sum, flag) => sum + flag, 0), 1, 'and only it')
  assert.equal(model.scale.yearMin < 1698, true)
})

test('the undated adaptation is the atlas\'s own, recorded: one sentinel, one rule in each mirror, found curves unchanged', async () => {
  assert.equal(time.UNDATED_U, -1)
  const window = {on: 1, cursorU: 0.5, trail: time.DEFAULT_TRAIL, ramp: time.DEFAULT_RAMP}
  assert.equal(time.pickablePresence(time.UNDATED_U, window, 1), true, 'an undated subject is present at every cursor, so pickable')
  assert.equal(time.pickablePresence(0.9, window, 1), false, 'a dated one far ahead of the cursor is not')
  assert.equal(time.timeVisibility(0.5, {...window, on: 0}), 1)
  assert.equal(passes({dated: false, year: 2026, cites: [], cultureIds: [], locusType: 'artifact'}, {era: [1000, 3000]}), false, 'an undated occurrence is in no era')
  assert.equal(passes({year: 2026, cites: [], cultureIds: [], locusType: 'artifact'}, {era: [1000, 3000]}), true)
  assert.equal(uSpan([-1, -1, 0.3, 0.6]).fromU < 0.3, true)
  assert.equal(uSpan([-1, -1, 0.3]), null, 'two undated and one dated are not a span: an undated subject has no date')
  const shaders = await readFile(new URL('src/globe/shaders.ts', atlas), 'utf8')
  for (const fn of ['float timeVis(float u)', 'float timeFlare(float u)', 'vec4 presenceCurve(float u, float rel)']) {
    const at = shaders.indexOf(fn)
    assert.ok(at > 0 && /if \(u < 0\.0\) return/.test(shaders.slice(at, at + 220)), `${fn} guards the undated sentinel`)
  }
  const model = buildModel(compose().field)
  const first = model.occ[0]
  const tail = {...first, id: 'sun-like', subject_ref: undefined, familyId: 'qlsky', dated: undefined}
  const family = {id: 'qlsky', name: 'Sky', subtype: 'unknown', aliases: [], oneLine: '', archetypes: [], spectrum: {position: 0.5}, palette: {core: '#ffffff', glow: '#eeeeee', fog: '#111111', deep: '#000000'}, body: [], occurrenceIds: [], synthesised: false}
  const change = replaceModelOccurrence(model, {...tail, year: 2026, yearDisplay: '2026', geoPrecision: 'place', lat: 1, lon: 2}, 'sun-like', family)
  assert.equal(change.changed, true, 'the atlas\'s refresh seam still admits a dated, untied occurrence beside the undated field')
  assert.ok(model.u[change.index] >= 0, 'and dates it on the scale')
})

// ── the standing store ────────────────────────────────────────────────────

test('the standing is one observable snapshot: idle until a reading publishes, and the Places are what the reading composed', () => {
  resetSuiteStanding()
  assert.equal(suiteStanding(), IDLE_STANDING)
  assert.equal(describeStanding(IDLE_STANDING), '', 'the pane says nothing before a reading')
  let heard = 0
  const stop = subscribeSuiteStanding(() => { heard++ })
  const sources = {inputs: recordedInputs(), declarations: recordedDeclarations(), readAt: READ_AT}
  const composition = composeSuite(sources)
  publishSuiteStanding(standingOf('ready', sources, composition))
  assert.equal(heard, 1)
  assert.equal(suiteStanding().places.length, 15)
  assert.equal(suiteStanding().counts.subjects, 45)
  stop()
  publishSuiteStanding(standingOf('ready', sources, composition))
  assert.equal(heard, 1, 'a subscriber that has left is not told')
  resetSuiteStanding()
  const unavailable = unavailableInput('central_wiki', 'the kernel is not running')
  assert.deepEqual([unavailable.state, unavailable.detail, unavailable.owner_operation], ['unavailable', 'the kernel is not running', 'central.wiki.read'])
  assert.equal(NO_DECLARATIONS.state, 'absent')
})
