import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Production sources in memory through the same TS loader the sibling
// native tests use; these modules are pure, so no store or engine is
// involved beyond the contract itself.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
// The hook runs in a worker with its own globals: everything it needs is
// interpolated into its source (the sibling native tests' pattern).
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFileSync} from 'node:fs';
const transpile = pathname =>
  ts.transpileModule(readFileSync(pathname, 'utf8'), {
    compilerOptions: {module: 'esnext', target: 'es2022'},
  }).outputText;
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('.ts')) {
    const url = new URL(specifier, context.parentURL).href;
    return {shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(transpile(new URL(url).pathname))};
  }
  return next(specifier, context, next);
}`)}`)


const {InhabitantRegistry, INHABITANT_MANIFEST_SCHEMA} = await import('../src/inhabitants/manifest.ts')
const {encounter, returnTo, encodeEncounter, decodeEncounter} = await import('../src/workspace/encounter.ts')

test('inhabitant manifest: a family admits and is discoverable by surface', () => {
  const registry = new InhabitantRegistry()
  const admitted = registry.admit({
    schema: INHABITANT_MANIFEST_SCHEMA,
    family: 'some-family',
    title: 'Some family',
    faces: [{id: 'main', title: 'Main face', operatesOn: ['expressions'], component: null, presentations: ['compact', 'deep']}],
    params: [{face: 'main', key: 'effort', type: 'number', range: {min: 0, max: 1}, writePath: 'engine.effort'}],
    browser: [{id: 'places', title: 'Places', places: [{id: 'p1', title: 'One place'}]}],
    inspectors: [{id: 'review', title: 'Review', selectionKinds: ['factory-run'], component: null}],
  })
  assert.equal(admitted.length, 1)
  assert.equal(admitted[0].address, 'some-family:main')
  assert.equal(registry.families()[0], 'some-family')
  assert.equal(registry.facesFor('expressions').length, 1)
  assert.equal(registry.facesFor('source').length, 0)
  assert.equal(registry.browserCategories()[0].category.id, 'places')
  assert.equal(registry.inspectorsFor('factory-run')[0].inspector.id, 'review')
  assert.equal(registry.facesFor('expressions')[0].params[0].key, 'effort')
})

test('inhabitant registry: two families, one shared face id — addresses do not collide', () => {
  const registry = new InhabitantRegistry()
  const face = {id: 'main', title: 'Main', operatesOn: [], component: null}
  registry.admit({schema: INHABITANT_MANIFEST_SCHEMA, family: 'alpha', title: 'A', faces: [face]})
  registry.admit({schema: INHABITANT_MANIFEST_SCHEMA, family: 'beta', title: 'B', faces: [face]})
  assert.deepEqual(registry.families(), ['alpha', 'beta'])
  assert.equal(registry.facesFor().length, 2)
})

test('inhabitant registry: re-admission replaces the family atomically', () => {
  const registry = new InhabitantRegistry()
  registry.admit({schema: INHABITANT_MANIFEST_SCHEMA, family: 'gamma', title: 'G', faces: [{id: 'old', title: 'Old', operatesOn: [], component: null}]})
  registry.admit({schema: INHABITANT_MANIFEST_SCHEMA, family: 'gamma', title: 'G', faces: [{id: 'new', title: 'New', operatesOn: [], component: null}]})
  assert.deepEqual(registry.facesFor().map(f => f.address), ['gamma:new'])
})

test('inhabitant registry: undeclared params and unknown schema refuse; face addresses are family-namespaced', () => {
  const registry = new InhabitantRegistry()
  const face = {id: 'main', title: 'Main', operatesOn: [], component: null}
  registry.admit({schema: INHABITANT_MANIFEST_SCHEMA, family: 'alpha', title: 'A', faces: [face]})
  // Same face id in another family is fine: addresses are namespaced.
  registry.admit({schema: INHABITANT_MANIFEST_SCHEMA, family: 'beta', title: 'B', faces: [face]})
  assert.equal(registry.facesFor().filter(f => f.address.endsWith(':main')).length, 2)
  assert.throws(() => registry.admit({schema: INHABITANT_MANIFEST_SCHEMA, family: 'delta', title: 'D',
    faces: [{id: 'x', title: 'X', operatesOn: [], component: null}],
    params: [{face: 'not-declared', key: 'k', type: 'number', writePath: 'w'}]}), /undeclared face/)
  assert.throws(() => registry.admit({schema: 'oi.inhabitant-manifest/v0', family: 'eps', title: 'E'}), /schema/)
})

test('encounter: switching any axis keeps the subject; the trail keeps every encounter', () => {
  const start = {arrangement: 'techne', projection: 'earth', subject: {ref: 'stone1950', kind: 'artefact'}, aperture: 'local', viewAs: 'me'}
  const {address, trail} = encounter(start, [], {projection: 'timeline'})
  assert.equal(address.subject.ref, 'stone1950')
  assert.equal(address.projection, 'timeline')
  assert.equal(address.arrangement, 'techne')
  assert.equal(trail.length, 1)
  const again = encounter(address, trail, {arrangement: 'factory'})
  assert.equal(again.address.subject.ref, 'stone1950')
  assert.equal(again.trail.length, 2)
})

test('encounter: explicit subject replacement is a transition the trail keeps', () => {
  const start = {arrangement: 'base', projection: 'constellation', aperture: 'world', viewAs: 'me'}
  const {address} = encounter(start, [], {subject: {ref: 'other', kind: 'artefact'}})
  assert.equal(address.subject.ref, 'other')
})

test('encounter: return to a trail entry restores the exact address and appends', () => {
  const a = {arrangement: 'base', projection: 'earth', aperture: 'world', viewAs: 'me'}
  const t1 = encounter(a, [], {subject: {ref: 'x', kind: 'k'}})
  const t2 = encounter(t1.address, t1.trail, {projection: 'timeline'})
  const back = returnTo(t2.trail, 0)
  assert.equal(back.address.subject.ref, 'x')
  assert.equal(back.address.projection, 'earth')
  assert.equal(back.trail.length, 3)
  assert.throws(() => returnTo(t2.trail, 9), /No trail encounter/)
})

test('encounter: linkable encode/decode round-trips and degrades honestly', () => {
  const address = {arrangement: 'techne', projection: 'earth', subject: {ref: 'stone1950', kind: 'artefact', project: 'field'}, aperture: 'shared', viewAs: 'field', occasion: 'k8-snapshot'}
  const decoded = decodeEncounter(encodeEncounter(address))
  assert.deepEqual(decoded, address)
  const degraded = decodeEncounter('arr=unknown&projection=unheard&ap=99&as=field')
  assert.equal(degraded.arrangement, 'base')
  assert.equal(degraded.projection, 'earth')
  assert.equal(degraded.aperture, 'world')
  assert.equal(degraded.viewAs, 'field')
})
