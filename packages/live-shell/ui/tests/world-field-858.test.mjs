// O-I #858 slice 3: the World instrument over the held field (manual §17.2 "The five scales", "Aperture and view as"). The Field
// scale draws every world the field shows, clear where its owner has shown it and under one even cloud elsewhere, and the stars people
// have made with the worlds gathered at each; Aperture filters the one system and counts what lies just past its edge; View as shows
// your world as you, the field or the public see it. The reading is the window's held SharedField snapshot (kernel `shared_field`
// op, scoped `shared-field`, so the field's own news retires it), in the client's shape (shared-field/spacetimedb/field-lib.ts
// `worldReading`).
// Channels: scripted. The model, the store and the binding are the shell's own code in memory; the reading is a FIXTURE in the
// client's shape (the real one is proven by shared-field/spacetimedb/one-field-live-acceptance.ts on a local SpacetimeDB). The face is
// rendered to static markup. The native window is UNVERIFIED.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {renderToStaticMarkup} from 'react-dom/server'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
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
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const model = await import('../src/projections/atlas/system/fieldModel.ts')
const store = await import('../src/projections/atlas/system/systemStore.ts')
const palaces = await import('../src/projections/atlas/palaces/palacesModel.ts')
const atlasDevs = await import('../src/inhabitants/ql/devices/atlasDevices.ts')
const {design: world} = await import('../src/inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx')

// FIXTURE: a snapshot's world part as the held client answers it. Mine: my world (its body my own body's ref) and a project world I
// hold; theirs: Mara's world, gathered with mine at the Rosarium star; a stranger's world gathered at a star I am not at; a world asking
// to come to my star.
const bodyOf = ref => ({body_ref: ref, seed: 7, generator: {id: 'fbm-sphere', version: 2}, landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'},
  climate: {warmth: .58, moisture: .6, ice_caps: .3}, sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18}})
const YOURS = 'body:central:wiki:root'
const w = (world_ref, body_ref, mine, linked = true) => ({world_ref, body: bodyOf(body_ref), linked, mine, updated_at_micros: '1'})
const c = (world_ref, part_ref, audience, label, star_ref = null) => ({world_ref, part_ref, star_ref, audience, shown: {kind: part_ref.split(':')[0], label}, shown_at_micros: '2'})
const SNAPSHOT = {
  schema: 'oi.shared-field.snapshot/v1', entries: [], counts: {entries: 0, worlds: 4, clearings: 5, stars: 2, gatherings: 4},
  world_field: {state: 'held'},
  worlds: [w('world:me', YOURS, true), w('world:me:o-i', 'body:o-i', true), w('world:mara', 'body:mara', false), w('world:stranger', 'body:stranger', false)],
  clearings: [
    c('world:me', 'page:reading-of-plate-4', 'public', 'A reading of the fourth plate'),
    c('world:me', 'place:rosarium-notes', 'field', 'Rosarium notes'),
    c('world:me', 'page:for-the-circle', 'star', 'For the circle', 'star:rosarium'),
    c('world:mara', 'page:maras-plate', 'public', 'Mara’s plate'),
    c('world:stranger', 'page:elsewhere', 'public', 'Elsewhere'),
  ],
  stars: [
    {star_ref: 'star:rosarium', name: 'The Rosarium plates', gathers: 'Readings of the Rosarium plates', comes: 'asked', lit_by: 'world:me', mine: true},
    {star_ref: 'star:far', name: 'Far', gathers: 'Something else', comes: 'anyone', lit_by: 'world:stranger', mine: false},
  ],
  gatherings: [
    {star_ref: 'star:rosarium', world_ref: 'world:me', state: 'gathered', asked_at_micros: '3', gathered_at_micros: '3'},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', state: 'gathered', asked_at_micros: '4', gathered_at_micros: '5'},
    {star_ref: 'star:rosarium', world_ref: 'world:stranger', state: 'asked', asked_at_micros: '6'},
    {star_ref: 'star:far', world_ref: 'world:stranger', state: 'gathered', asked_at_micros: '7', gathered_at_micros: '7'},
  ],
}

const held = () => {
  const field = model.heldFieldOf(SNAPSHOT)
  assert.equal(field.state, 'read')
  return field
}
const refs = scene => scene.worlds.map(world => world.ref)

test('the held snapshot reads as the field: worlds, clearings, stars and gatherings; a service without worlds says so in words', () => {
  const field = held()
  assert.equal(field.worlds.length, 4)
  assert.equal(field.stars.length, 2)
  const none = model.heldFieldOf({...SNAPSHOT, world_field: {state: 'unavailable', detail: 'This field’s service does not hold worlds yet'}})
  assert.deepEqual(none, {state: 'unavailable', reason: 'This field’s service does not hold worlds yet'})
  const down = model.heldFieldOf({state: 'unavailable', owner_operation: 'shared-field', detail: 'The SharedField is not reachable now: The SharedField connection ended'})
  assert.equal(down.state, 'unavailable')
  assert.match(down.reason, /not reachable now/)
  assert.equal(model.heldFieldOf(null).state, 'unavailable')
})

test('Aperture filters the one system and counts what lies just past its edge', () => {
  const field = held()
  const at = aperture => model.fieldScene(field, {aperture, viewAs: 'me'}, YOURS)
  assert.deepEqual(refs(at('world')), ['world:me'], 'your world alone')
  assert.deepEqual(at('world').stars, [])
  assert.deepEqual(at('world').beyond, {worlds: 1, stars: 0, wider: 'local'}, 'the project world you hold is counted and offered')
  assert.deepEqual(refs(at('local')), ['world:me', 'world:me:o-i'], 'your world and the worlds it holds')
  assert.deepEqual(at('local').beyond, {worlds: 1, stars: 1, wider: 'shared'})
  const shared = at('shared')
  assert.deepEqual(refs(shared), ['world:me', 'world:me:o-i', 'world:mara'], 'the worlds you are gathered with')
  assert.deepEqual(shared.stars.map(star => star.ref), ['star:rosarium'], 'the stars you are gathered at')
  assert.deepEqual(shared.beyond, {worlds: 1, stars: 1, wider: 'federated'})
  const all = at('federated')
  assert.deepEqual(refs(all).sort(), ['world:mara', 'world:me', 'world:me:o-i', 'world:stranger'])
  assert.equal(all.beyond, null, 'nothing lies past the widest view')
  assert.match(all.note ?? '', /No other system/, 'no other system is joined, and the view says so')
  // The aperture takes you nowhere: your world stands the same at every aperture.
  for (const aperture of model.APERTURES) assert.deepEqual(at(aperture).worlds.find(world => world.ref === 'world:me'), at('world').worlds[0])
})

test('a star shows the worlds gathered at it, and a world not yet let in waits at its edge', () => {
  const rosarium = model.fieldScene(held(), {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === 'star:rosarium')
  assert.deepEqual(rosarium.gathered, ['world:me', 'world:mara'])
  assert.equal(rosarium.waiting, 1)
  assert.equal(rosarium.mine, true)
  assert.equal(rosarium.comes, 'asked')
})

test('View as: your world as you know it, as the field sees it and as the public sees it, under one even cloud', () => {
  const field = held()
  const mine = viewAs => model.fieldScene(field, {aperture: 'world', viewAs}, YOURS).worlds[0]
  assert.equal(mine('me').clouded, false, 'as you know it: no cloud')
  assert.deepEqual(mine('me').clearings.map(clearing => clearing.part), ['page:reading-of-plate-4', 'place:rosarium-notes', 'page:for-the-circle'])
  assert.equal(mine('field').clouded, true)
  assert.deepEqual(mine('field').clearings.map(clearing => clearing.part), ['page:reading-of-plate-4', 'place:rosarium-notes'], 'what is shown at a star is not shown to the field')
  assert.deepEqual(mine('public').clearings.map(clearing => clearing.part), ['page:reading-of-plate-4'])
  // The even cloud tells nobody what lies beneath it or how much: the public view of a world with more shown to the field reads the same.
  const fewer = model.heldFieldOf({...SNAPSHOT, clearings: SNAPSHOT.clearings.filter(clearing => clearing.part_ref !== 'place:rosarium-notes')})
  assert.deepEqual(model.fieldScene(fewer, {aperture: 'world', viewAs: 'public'}, YOURS).worlds[0], mine('public'))
  // Another world is always as its owner showed it: View as is your world's.
  const theirs = viewAs => model.fieldScene(field, {aperture: 'federated', viewAs}, YOURS).worlds.find(world => world.ref === 'world:mara')
  assert.deepEqual(theirs('public'), theirs('me'))
  assert.equal(theirs('me').clouded, true)
  // A world with Link off is not among the others: the field and the public do not see it.
  const unlinked = model.heldFieldOf({...SNAPSHOT, worlds: SNAPSHOT.worlds.map(world => world.world_ref === 'world:me' ? {...world, linked: false} : world)})
  const away = model.fieldScene(unlinked, {aperture: 'world', viewAs: 'field'}, YOURS).worlds[0]
  assert.deepEqual(away.clearings, [])
  assert.match(away.away ?? '', /Link is off/)
})

test('the Palace’s cloud is the same even cloud: a private room is shown to you alone', () => {
  for (const audience of model.AUDIENCES) {
    assert.equal(palaces.underCloud({private: true}, audience), model.cloudedFor('me', audience))
    assert.equal(palaces.underCloud({private: false}, audience), model.cloudedFor('public', audience))
  }
  assert.equal(model.cloudedFor('star', 'field'), true, 'shown at a star is not shown to the field')
  assert.equal(model.cloudedFor('field', 'public'), true)
  assert.equal(model.cloudedFor('field', 'field'), false)
})

const reading = () => atlasDevs.atlasReading(null, 'earth')

test('the World binding hands the face the field and its view, and keeps Aperture and View as as the view’s own', () => {
  store.publishField(model.heldFieldOf(SNAPSHOT))
  store.chooseFieldView({field: true, aperture: 'shared', viewAs: 'field'})
  const binding = atlasDevs.atlasGlobeBinding(reading())
  assert.equal(binding.values.scale, 'field')
  assert.equal(binding.values.aperture, 'shared')
  assert.equal(binding.values.viewAs, 'field')
  assert.equal(binding.standing.aperture, undefined)
  assert.equal(binding.standing.viewAs, undefined)
  const scene = model.fieldSceneOf(JSON.parse(binding.values.field), {aperture: binding.values.aperture, viewAs: binding.values.viewAs}, binding.values.fieldYours ?? null)
  assert.deepEqual(scene.worlds.map(world => world.ref), ['world:me', 'world:me:o-i', 'world:mara'])
  assert.equal(binding.values.fieldYours, undefined, 'your own body is not read here, so no world is named yours')
  const alone = model.fieldSceneOf(JSON.parse(binding.values.field), {aperture: 'world', viewAs: 'me'}, null)
  assert.deepEqual(alone.worlds, [], 'while your own body is not read, no world is named as yours')
  assert.match(alone.note ?? '', /not read/)
  binding.local.aperture('federated')
  binding.local.viewAs('public')
  binding.local.scale('body')
  assert.deepEqual(store.fieldView(), {field: false, aperture: 'federated', viewAs: 'public'})
  binding.local.aperture('nowhere')
  assert.equal(store.fieldView().aperture, 'federated', 'a value that is not an aperture is not taken')
})

test('while the field does not hold worlds, Aperture and View as stand dimmed with the owner’s words', () => {
  store.publishField(model.heldFieldOf({...SNAPSHOT, world_field: {state: 'unavailable', detail: 'This field’s service does not hold worlds yet'}}))
  const binding = atlasDevs.atlasGlobeBinding(reading())
  assert.equal(binding.standing.aperture?.disabled, 'This field’s service does not hold worlds yet')
  assert.equal(binding.standing.viewAs?.disabled, 'This field’s service does not hold worlds yet')
  assert.equal(binding.values.field, undefined, 'no field is drawn that was not read')
  store.publishField({state: 'reading'})
  assert.match(atlasDevs.atlasGlobeBinding(reading()).standing.aperture?.disabled ?? '', /being read/)
})

test('the face draws the Field scale from the scene and binds Reach to the view’s own choices', () => {
  assert.ok(world.fixtures['Field scale'], 'the design carries the Field scale on its fixture')
  const v = {...world.defaults, ...world.fixtures['Field scale']}
  const set = []
  const whole = renderToStaticMarkup(world.whole({v, set: (key, value) => set.push([key, value]), nav: {}, page: 'space', setPage() {}, standing: {}}))
  assert.match(whole, /The Rosarium plates/, 'a star stands by its name')
  assert.match(whole, /past the edge/i, 'what lies past the edge is counted and offered')
  assert.ok(!whole.includes('No owner opens the shared or federated field'), 'Aperture is no longer the old dimmed control')
  const compact = renderToStaticMarkup(world.compact({v, set() {}, nav: {}, standing: {}}))
  assert.match(compact, /Field/)
})
