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
import {readFile} from 'node:fs/promises'

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

test('the World reads the worlds alone, so reading it brings no field’s rows into view; that reading reads as the snapshot’s world part does', async () => {
  const readings = await readFile(new URL('../src/projections/atlas/system/SystemReadings.tsx', import.meta.url), 'utf8')
  assert.match(readings, /\{op: 'shared_field', request: \{kind: 'worlds', aperture\}\}/, 'the Field scale asks the held field for the worlds alone, at the Aperture chosen')
  assert.match(readings, /useSyncExternalStore\(subscribeSystem, \(\) => fieldView\(\)\.aperture\)/, 'the Aperture chosen is the one read: choosing another reads the field again at it')
  assert.ok(!/request: \{kind: 'snapshot'\}/.test(readings), 'never the whole snapshot, whose glance keeps every field in view')
  const {schema: _schema, entries: _entries, counts: _counts, ...worldPart} = SNAPSHOT
  assert.deepEqual(model.heldFieldOf({schema: 'oi.shared-field.worlds/v1', ...worldPart}), held())
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

test('the World’s plate and its Technē compact choose the Field scale’s own Aperture and View as, dimmed with the field’s words until it is read and the Field is drawn', async () => {
  const {createElement} = await import('react')
  const {ViewSection} = await import('../src/projections/atlas/places/PlacesPlate.tsx')
  const {InstrumentCompact} = await import('../src/inhabitants/ql/devices/techneCompacts.tsx')
  const {TECHNE_INSTRUMENTS} = await import('../src/inhabitants/sdk/semantics.ts')
  const m4 = TECHNE_INSTRUMENTS.find(holder => holder.id === 'techne:m4')
  const plate = () => renderToStaticMarkup(createElement(ViewSection, {handle: null}))
  const compact = () => renderToStaticMarkup(createElement(InstrumentCompact, {holder: m4, mark: 'placed', light: 'unknown', onOpen() {}}))
  const chosen = (out, label) => {
    const at = out.indexOf(label === 'Aperture' ? 'Aperture' : 'View as')
    return out.slice(at, at + 1500)
  }
  try {
    store.publishField({state: 'reading'})
    for (const [name, out] of [['plate', plate()], ['compact', compact()]]) {
      assert.doesNotMatch(out, /no owner (?:opens the shared|discloses how the field)/i, `${name}: never the old words`)
      assert.match(chosen(out, 'Aperture'), /The shared field is being read\./, `${name}: Aperture waits on the field, in its words`)
      assert.match(chosen(out, 'View as'), /The shared field is being read\./, `${name}: View as waits on the field, in its words`)
    }
    store.publishField(model.heldFieldOf(SNAPSHOT))
    for (const [name, out] of [['plate', plate()], ['compact', compact()]]) {
      assert.match(chosen(out, 'Aperture'), /choose Field first/, `${name}: read, the field’s choices wait until the Field is the scale drawn, as on the face`)
    }
    store.chooseFieldView({field: true, aperture: 'shared', viewAs: 'field'})
    const p = plate(), k = compact()
    assert.match(chosen(p, 'Aperture'), /aria-checked="true"[^>]*>(?:<[^>]+>)*Shared</, 'the plate’s Aperture is the view’s own')
    assert.match(chosen(p, 'View as'), /aria-checked="true"[^>]*>(?:<[^>]+>)*Field</, 'the plate’s View as is the view’s own')
    assert.doesNotMatch(chosen(p, 'Aperture').slice(0, 400), /data-disabled="true"/, 'the plate’s Aperture can be pressed once the field is read')
    assert.match(chosen(k, 'Aperture'), /<option value="shared" selected="">Shared</, 'the compact’s Aperture is the view’s own')
    assert.match(chosen(k, 'View as'), /<option value="field" selected="">Field</, 'the compact’s View as is the view’s own')
    assert.doesNotMatch(chosen(k, 'Aperture').slice(0, 300), /disabled=""/, 'the compact’s Aperture can be chosen once the field is read')
    assert.match(p, /<span class="dp-label">Scale<\/span><output class="dp-value">field<\/output>/, 'with Field chosen, the plate’s scale reads field')
    assert.match(k, /<output class="dp-readout-value"[^>]*>field<\/output><span class="dp-label">Scale<\/span>/, 'with Field chosen, the compact’s scale reads field')
  } finally {
    store.chooseFieldView({field: false, aperture: 'world', viewAs: 'me'})
    store.publishField({state: 'reading'})
  }
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

// ── round 9: the camera's scale, and the acts at a star (manual §17.2 items 9 and 10; SF04, SF05, SF12, SF13) ─────────────

test('the camera’s scale reaches the World when Field is not chosen, and Field keeps it for the way back', () => {
  store.publishField(model.heldFieldOf(SNAPSHOT))
  store.chooseFieldView({field: false, aperture: 'world', viewAs: 'me'})
  for (const camera of ['system', 'body', 'region', 'place']) {
    const binding = atlasDevs.atlasGlobeBinding({...reading(), scale: camera})
    assert.equal(binding.values.scale, camera, `the camera stands at ${camera}, and the World reads it`)
    assert.equal(binding.values.cameraScale, camera)
  }
  store.chooseFieldView({field: true})
  const atField = atlasDevs.atlasGlobeBinding({...reading(), scale: 'region'})
  assert.equal(atField.values.scale, 'field', 'Field is the view’s own choice over the camera’s')
  assert.equal(atField.values.cameraScale, 'region', 'and the camera’s scale stands for the way back')
  store.chooseFieldView({field: false})
  for (const none of ['graph', null, undefined]) {
    const binding = atlasDevs.atlasGlobeBinding({...reading(), scale: none})
    assert.equal(binding.values.scale, undefined, `a camera at ${String(none)} hands no scale of the Earth`)
    assert.equal(binding.values.cameraScale, undefined)
  }
})

test('the Scale chooser takes Field and the camera’s own scale, and says the camera sets the others', () => {
  const v = {...world.defaults, cameraScale: 'body', scale: 'body'}
  const whole = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  assert.match(whole, /role="radio" aria-checked="false"[^>]*data-i="[^"]*The camera sets this scale[^"]*"[^>]*disabled=""[^>]*>Region</, 'Region is the camera’s to set')
  assert.match(whole, /role="radio" aria-checked="false"[^>]*data-i="Field[^"]*"[^>]*>Field</, 'Field stays open')
  assert.ok(!/data-i="Field[^"]*"[^>]*disabled=""/.test(whole), 'Field is never closed by the camera')
  assert.match(whole, />Place</, 'the fifth scale, Place, is named')
})

const H = () => store.heldField()
const YOURS_READING = () => { const base = reading(); return {...base, field: {...base.field, yours: YOURS}} }

test('a star’s acts are asked of the field for your own world, and each refuses in words when it cannot be done', () => {
  const field = held()
  const ask = act => model.starRequest(field, YOURS, act, Date.UTC(2026, 10, 4, 6))
  const lit = ask({act: 'light', name: 'The Bestiary', gathers: 'Readings of the beasts', comes: 'asked'})
  assert.ok('request' in lit, JSON.stringify(lit))
  assert.match(lit.request.star_ref, /^star:the-bestiary-[a-z0-9]+$/, 'a new star is named from its name, once')
  assert.deepEqual({...lit.request, star_ref: undefined}, {kind: 'star-light', star_ref: undefined, world_ref: 'world:me', name: 'The Bestiary', gathers: 'Readings of the beasts', comes: 'asked'})
  assert.deepEqual(ask({act: 'gather', star: 'star:far'}), {request: {kind: 'star-gather', star_ref: 'star:far', world_ref: 'world:me'}})
  assert.deepEqual(ask({act: 'leave', star: 'star:rosarium'}), {request: {kind: 'star-leave', star_ref: 'star:rosarium', world_ref: 'world:me'}})
  assert.deepEqual(ask({act: 'admit', star: 'star:rosarium', world: 'world:stranger'}), {request: {kind: 'star-admit', star_ref: 'star:rosarium', world_ref: 'world:stranger'}})
  assert.deepEqual(ask({act: 'close', star: 'star:rosarium'}), {request: {kind: 'star-close', star_ref: 'star:rosarium'}})
  const refusals = {
    'unnamed': [ask({act: 'light', name: ' ', gathers: 'x', comes: 'anyone'}), /Name the star/],
    'ungathering': [ask({act: 'light', name: 'A star', gathers: '', comes: 'anyone'}), /what the star gathers/],
    'already': [ask({act: 'gather', star: 'star:rosarium'}), /already gathered/],
    'not at': [ask({act: 'leave', star: 'star:far'}), /not at that star/],
    'not the lighter': [ask({act: 'admit', star: 'star:far', world: 'world:stranger'}), /Only the one who lit a star lets worlds in/],
    'not waiting': [ask({act: 'admit', star: 'star:rosarium', world: 'world:mara'}), /not waiting/],
    'not closing': [ask({act: 'close', star: 'star:far'}), /Only the one who lit a star closes it/],
    'no star': [ask({act: 'gather', star: 'star:nowhere'}), /not in the field/],
    'no world': [model.starRequest(field, null, {act: 'gather', star: 'star:far'}, 0), /Your world is not in the field/],
    'unread': [model.starRequest({state: 'unavailable', reason: 'This field’s service does not hold worlds yet'}, YOURS, {act: 'close', star: 'star:rosarium'}, 0), /does not hold worlds yet/],
  }
  for (const [name, [made, words]] of Object.entries(refusals)) {
    assert.ok('refusal' in made, `${name}: refused`)
    assert.match(made.refusal, words, name)
    assert.ok(!/_ref|star-|\bkind\b|`/.test(made.refusal), `${name}: the refusal is words, no field or op names: ${made.refusal}`)
  }
  // a world waiting at its own request, at a star someone else lit, leaves as it came
  const mine = model.heldFieldOf({...SNAPSHOT, gatherings: [...SNAPSHOT.gatherings, {star_ref: 'star:far', world_ref: 'world:me', state: 'asked'}]})
  assert.deepEqual(model.starRequest(mine, YOURS, {act: 'leave', star: 'star:far'}, 0), {request: {kind: 'star-leave', star_ref: 'star:far', world_ref: 'world:me'}})
  assert.match(model.starRequest(mine, YOURS, {act: 'gather', star: 'star:far'}, 0).refusal, /already waits/)
})

test('a star names the worlds waiting at its edge, and where your own world stands at it', () => {
  const scene = model.fieldScene(held(), {aperture: 'federated', viewAs: 'me'}, YOURS)
  const rosarium = scene.stars.find(star => star.ref === 'star:rosarium'), far = scene.stars.find(star => star.ref === 'star:far')
  assert.deepEqual(rosarium.asking, ['world:stranger'])
  assert.equal(rosarium.waiting, 1, 'the count stands as it did')
  assert.equal(rosarium.yoursAt, 'gathered')
  assert.equal(far.yoursAt, null)
})

test('the World binding asks the field for a star’s acts, and stands each one it cannot do dimmed with its reason', async () => {
  store.publishField(model.heldFieldOf(SNAPSHOT))
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.chooseStarHand({star: 'star:far', admit: null, name: '', gathers: '', comes: 'anyone'})
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.values.fieldStar, 'star:far')
    assert.equal(binding.standing.starGather, undefined, 'your world may gather at a star it is not at')
    assert.match(binding.standing.starLeave?.disabled ?? '', /not at that star/)
    assert.match(binding.standing.starAdmit?.disabled ?? '', /Only the one who lit a star lets worlds in/)
    assert.match(binding.standing.starClose?.disabled ?? '', /Only the one who lit a star closes it/)
    assert.equal(binding.writes('starGather'), true)
    assert.equal(binding.writes('starLeave'), false, 'a dimmed act is not written')
    await binding.write([{key: 'starGather', value: 1}])
    assert.deepEqual(asked.pop(), {kind: 'star-gather', star_ref: 'star:far', world_ref: 'world:me'})
    // REPLACED (round 30, SF12/SF13 on the face): Software Factory shows a Run's work and offers its tasks through the kernel; with no
    // Factory carrier bound in this window, the acts stand dimmed saying so, never that Factory has not built them
    for (const key of ['starShow', 'starOffer']) {
      assert.match(binding.standing[key]?.disabled ?? '', /Software Factory is not reached from this window/, `${key} names what it lacks`)
      assert.doesNotMatch(binding.standing[key]?.disabled ?? '', /has not built/, `${key}: Factory has built it`)
    }
    assert.equal(binding.writes('starShow'), false)
    assert.equal(binding.writes('starOffer'), false)
    // Light a star: the name, what it gathers and who may come are the view's own until the star is lit
    assert.match(binding.standing.starLight?.disabled ?? '', /Name the star/)
    binding.local.starName('The Bestiary')
    binding.local.starGathers('Readings of the beasts')
    binding.local.starComes('asked')
    binding.local.starComes('nobody')
    const {name, gathers, comes} = store.starHand()
    // REPLACED (round 10, SF06): the hand also holds what to say at a star and the pages turned to, so the star to light is read by its own three keys
    assert.deepEqual({name, gathers, comes}, {name: 'The Bestiary', gathers: 'Readings of the beasts', comes: 'asked'}, 'who may come is anyone or asked, nothing else')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.values.starName, 'The Bestiary')
    assert.equal(binding.standing.starLight, undefined)
    await binding.write([{key: 'starLight', value: 2}])
    const light = asked.pop()
    assert.equal(light.kind, 'star-light')
    assert.equal(light.world_ref, 'world:me')
    assert.equal(light.comes, 'asked')
    // Let in: at your own star, a world waiting at its edge
    binding.local.fieldStar('star:rosarium')
    binding.local.fieldAdmit('world:stranger')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.deepEqual(JSON.parse(binding.values.fieldWaiting), ['world:stranger'])
    assert.equal(binding.standing.starAdmit, undefined)
    assert.equal(binding.standing.starClose, undefined)
    await binding.write([{key: 'starAdmit', value: 3}])
    assert.deepEqual(asked.pop(), {kind: 'star-admit', star_ref: 'star:rosarium', world_ref: 'world:stranger'})
    // the field's own refusal reaches the person in its words
    store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async () => { throw Error('Only the one who lit a star lets worlds in') }})
    await assert.rejects(atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'starClose', value: 4}]), /Only the one who lit a star lets worlds in/)
    // a star the field no longer holds is not chosen
    binding.local.fieldStar('star:gone')
    assert.equal(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.fieldStar, undefined)
  } finally {
    store.bindSystemActs(null)
  }
  // with no field reached from this window, every act stands dimmed with that reason
  store.chooseStarHand({star: 'star:far'})
  const unbound = atlasDevs.atlasGlobeBinding(YOURS_READING())
  assert.match(unbound.standing.starGather?.disabled ?? '', /not reached from this window/)
})

test('the face lights, gathers and lets in at a star, and Factory’s acts at a star stand dimmed with what they lack named', () => {
  const v = {...world.defaults, ...world.fixtures['Field, a star chosen']}
  const whole = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {
    starShow: {disabled: 'Showing a piece of work takes a Run of Software Factory’s, and this window has no Run to choose yet.'},
    starOffer: {disabled: 'Offering a task takes a task of a Run of Software Factory’s, and this window has no Run to choose yet.'}}}))
  for (const label of ['Light a star', 'Gather', 'Leave', 'Let in', 'Close', 'Show work', 'Offer a task']) assert.match(whole, new RegExp(`>${label}<`), `${label} stands on the face`)
  assert.match(whole, /Readings of the Rosarium plates/, 'the chosen star says what it gathers')
  assert.match(whole, /stranger/, 'a world waiting at its edge is named')
  assert.match(whole, /Showing a piece of work takes a Run of Software Factory/, 'Show work names what it lacks')
  // whatever the host says, the face names what the acts lack, never that Factory has not built them
  const bare = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  assert.doesNotMatch(bare, /has not built/)
  // REPLACED (round 30): with no Run of Factory's read into the face, Show work asks for one; the Run chooser stands beside it
  assert.match(bare, /Choose a Run of Software Factory’s first/)
  assert.match(bare, /data-i="Run/, 'the Run chooser stands at the star')
})

test('a star’s day reads beside it: who came, was let in, showed something and left, in the order it happened (SF04)', () => {
  const day = [
    {star_ref: 'star:rosarium', world_ref: 'world:me', what: 'lit', at_micros: '1'},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'asked', at_micros: '2'},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'let-in', at_micros: '3'},
    {star_ref: 'star:rosarium', world_ref: 'world:me', what: 'showed', kind: 'page', at_micros: '4'},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'sang', at_micros: '5'},
    {star_ref: 'star:far', world_ref: 'world:stranger', what: 'came', at_micros: '6'},
  ]
  const field = model.heldFieldOf({...SNAPSHOT, star_day: {state: 'held'}, star_days: day})
  assert.equal(field.days.length, 5, 'a row that is not the contract’s is left out, never mended')
  const rosarium = model.fieldScene(field, {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === 'star:rosarium')
  assert.deepEqual(rosarium.day.map(entry => model.starDayLine(entry)), ['me lit the star', 'mara asked to come', 'mara was let in', 'me showed a page'])
  const none = model.heldFieldOf({...SNAPSHOT, star_day: {state: 'unavailable', detail: 'This field’s service does not keep a star’s day yet'}})
  assert.equal(none.days, null)
  assert.equal(none.dayWhy, 'This field’s service does not keep a star’s day yet', 'a service that keeps no day says so in its words')
  assert.equal(model.fieldScene(none, {aperture: 'federated', viewAs: 'me'}, YOURS).stars[0].day, null)
  // the binding hands the day with the field; the face reads the chosen star's day
  store.publishField(field)
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  const handed = JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.field)
  assert.equal(handed.days.length, 5)
  const v = {...world.defaults, ...world.fixtures['Field, a star chosen']}
  // REPLACED (round 11, ruling of 4 Nov): the star's day stands on the Star page only; the Space page keeps a one-line pointer to it.
  const space = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  assert.ok(!/The star’s day, as the field lets you read it/.test(space), 'the Space page states no star’s day')
  assert.match(space, /data-i="Star’s day ›[^"]*stands on the Star page/, 'it points to the Star page in one line')
  const whole = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'star', setPage() {}, standing: {}}))
  assert.match(whole, /Star’s day/)
  // REPLACED (round 10, SF06): the design's sample day grew by what was said there, and the face opens on its newest page: the line read
  // is the newest of SF04's, and the older ones are a page back
  assert.match(whole, /stranger asked to come/)
  const back = renderToStaticMarkup(world.whole({v: {...v, dayPage: 0}, set() {}, nav: {}, page: 'star', setPage() {}, standing: {}}))
  assert.match(back, /mara was let in/, 'a page back, who was let in')
})

test('the chosen star reads in lines that end short of their section, and while the field holds no worlds every act at a star stands dimmed with the field’s words', () => {
  const page = (fixture) => renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures[fixture]}, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  const chosen = page('Field, a star chosen')
  // the star's own words are a row's name, which ends in an ellipsis at the section's edge, never a one-line reading cut off at both ends
  for (const line of ['Readings of the Rosarium plates', 'Its lighter lets each world in', '2 gathered, 1 waiting', 'Your world is gathered here']) {
    assert.match(chosen, new RegExp(`class="dp-row-name">${line}<`), `${line} is a line of the star`)
  }
  const unheld = page('Field not held')
  const cellOf = (label) => unheld.match(new RegExp(`<[^>]*data-i="${label}[^"]*"[^>]*>`))?.[0] ?? ''
  for (const label of ['Gather', 'Leave', 'Let in', 'Close', 'Light a star', 'Name', 'Gathers', 'Who may come', 'Waiting']) {
    const cell = cellOf(label)
    assert.match(cell, /data-disabled="true"/, `${label} stands dimmed while the field holds no worlds`)
    assert.match(cell, /does not hold worlds yet/, `${label} says why in the field’s words`)
  }
})

test('what lies past the edge reads as a count that fits beside the star sections, and Widen names the aperture it widens to', () => {
  const whole = renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['Field scale']}, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  assert.match(whole, /<output class="dp-readout-value">1 world and 1 star<\/output><span class="dp-label">past the edge</, 'the count, one reading, with what it counts as its label')
  assert.ok(!/widen to Federated<\/output>/.test(whole), 'no sentence runs past its section')
  assert.match(whole, /data-i="Widen[^"]*Federated/, 'Widen says where it widens to')
})

test('with no star chosen, the star’s day stands empty, not as a reading the field has not given', () => {
  // REPLACED (round 11): read on the Star page, where the star's day now stands alone
  const whole = renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['Field scale']}, set() {}, nav: {}, page: 'star', setPage() {}, standing: {}}))
  const day = whole.match(/<[^>]*data-i="[^"]*The star’s day, as the field lets you read it[^"]*"[^>]*>/)?.[0] ?? ''
  assert.ok(day, 'the star’s day stands on the face')
  assert.ok(!/data-standing="(unread|awaiting)"/.test(day), `an unchosen star is no missing reading: ${day.slice(0, 160)}`)
  assert.match(day, /Choose a star first/, 'and says what to do')
})

// ── round 10: what was said to what, and when (SF06) ─────────────────────────────────────────────────────────────────────
//
// A star's day reads who is here now, what was brought and what was said to what, each entry naming who and when. A saying is a
// question, a finding, a correction or a reproduction, said by a world gathered at the star to something shown there or to something
// said there before; it stays its sayer's until they unsay it, and what it was said to goes back under cloud when it is taken back.

const AT = Date.UTC(2026, 10, 4, 7, 35)
const micros = ms => String(ms * 1000)
const SAID = {
  clearings: [...SNAPSHOT.clearings, c('world:mara', 'page:maras-reading', 'star', 'Mara’s reading of the second plate', 'star:rosarium')],
  star_saying: {state: 'held'},
  star_sayings: [
    {saying_ref: 'saying:q1', star_ref: 'star:rosarium', world_ref: 'world:mara', to_world_ref: 'world:me', to_part_ref: 'page:for-the-circle', to_saying_ref: null,
      what: 'question', words: 'Where does the circle open?', said_at_micros: micros(AT)},
    {saying_ref: 'saying:c1', star_ref: 'star:rosarium', world_ref: 'world:me', to_world_ref: 'world:mara', to_part_ref: null, to_saying_ref: null,
      what: 'correction', words: 'Not the red rose.', said_at_micros: micros(AT + 120_000)},
    {saying_ref: 'saying:f1', star_ref: 'star:rosarium', world_ref: 'world:me', to_world_ref: null, to_part_ref: null, to_saying_ref: 'saying:q1',
      what: 'finding', words: 'At the fourth plate.', said_at_micros: micros(AT + 60_000)},
    {saying_ref: 'saying:r1', star_ref: 'star:rosarium', world_ref: 'world:mara', to_world_ref: null, to_part_ref: null, to_saying_ref: 'saying:gone',
      what: 'reproduction', words: 'I drew it again.', said_at_micros: micros(AT + 180_000)},
    {saying_ref: 'saying:x', star_ref: 'star:rosarium', world_ref: 'world:mara', to_world_ref: 'world:me', to_part_ref: 'page:for-the-circle', to_saying_ref: null,
      what: 'shout', words: 'Hey', said_at_micros: micros(AT)},
    {saying_ref: 'saying:far', star_ref: 'star:far', world_ref: 'world:stranger', to_world_ref: 'world:stranger', to_part_ref: 'page:elsewhere', to_saying_ref: null,
      what: 'finding', words: 'Elsewhere.', said_at_micros: micros(AT)},
  ],
  star_day: {state: 'held'},
  star_days: [
    {star_ref: 'star:rosarium', world_ref: 'world:me', what: 'lit', at_micros: micros(AT - 3 * 86_400_000)},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'came', at_micros: micros(AT - 600_000)},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'said', kind: 'question', at_micros: micros(AT)},
    {star_ref: 'star:rosarium', world_ref: 'world:me', what: 'said', kind: 'finding', at_micros: micros(AT + 60_000)},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'unsaid', kind: 'question', at_micros: micros(AT + 240_000)},
  ],
}
const saidField = () => {
  const field = model.heldFieldOf({...SNAPSHOT, ...SAID})
  assert.equal(field.state, 'read')
  return field
}
const rosariumOf = field => model.fieldScene(field, {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === 'star:rosarium')

test('a star reads who is here now and what each world brought there (SF06)', () => {
  const rosarium = rosariumOf(saidField())
  assert.deepEqual(rosarium.gathered, ['world:me', 'world:mara'], 'who is here now')
  assert.deepEqual(rosarium.shown.map(s => [s.who, s.label, s.kind]), [['me', 'For the circle', 'page'], ['mara', 'Mara’s reading of the second plate', 'page']], 'what each brought')
  assert.equal(rosarium.shown[0].id, model.shownId('world:me', 'page:for-the-circle'))
  assert.deepEqual(rosariumOf(held()).shown.map(s => s.label), ['For the circle'])
})

test('what was said at a star reads as who said what to what, each under what it answers, with when (SF06)', () => {
  const field = saidField()
  assert.equal(field.sayings.length, 5, 'a saying that is not the contract’s is left out, never mended')
  const rosarium = rosariumOf(field)
  assert.deepEqual(rosarium.said.map(s => s.ref), ['saying:q1', 'saying:f1', 'saying:c1', 'saying:r1'], 'each under what it answers, in the order it was said')
  assert.deepEqual(rosarium.said.map(s => s.depth), [0, 1, 0, 0])
  assert.deepEqual(rosarium.said.map(s => model.starSayingLine(s)), [
    'mara asks about For the circle: Where does the circle open?',
    'me has a finding on mara’s question: At the fourth plate.',
    'me corrects something mara no longer shows here: Not the red rose.',
    'mara reproduces something since unsaid: I drew it again.',
  ])
  assert.deepEqual(rosarium.said.map(s => s.mine), [false, true, true, false], 'which were said by a world of yours')
  assert.equal(rosarium.said[0].at, AT)
  const two = n => String(n).padStart(2, '0'), local = new Date(AT)
  assert.equal(model.starWhen(AT, AT + 60_000), `${two(local.getHours())}:${two(local.getMinutes())}`, 'said today: the clock')
  assert.match(model.starWhen(AT, AT + 3 * 86_400_000), /^\d{1,2} Nov$/, 'said another day: the day')
  // the day names who and when: who said something there, and who unsaid it; never the words
  assert.deepEqual(rosarium.day.map(entry => model.starDayLine(entry)), ['me lit the star', 'mara came', 'mara asked a question', 'me shared a finding', 'mara unsaid a question'])
  assert.deepEqual(rosarium.day.map(entry => entry.at), [AT - 3 * 86_400_000, AT - 600_000, AT, AT + 60_000, AT + 240_000], 'each entry says when')
  assert.ok(!JSON.stringify(rosarium.day).includes('circle open'), 'the day says something was said, never what')
  // a service that keeps no sayings says so in its words, and the star's day still reads
  const none = model.heldFieldOf({...SNAPSHOT, ...SAID, star_saying: {state: 'unavailable', detail: 'This field’s service does not keep what is said at a star yet'}})
  assert.equal(none.sayings, null)
  assert.match(none.sayWhy, /does not keep what is said/)
  assert.equal(rosariumOf(none).said, null)
  assert.equal(rosariumOf(none).day.length, 5)
})

test('saying something at a star is asked of the field for your own world, and each refusal is words (SF06)', () => {
  const field = saidField()
  const ask = act => model.starRequest(field, YOURS, act, AT)
  const toMara = model.shownId('world:mara', 'page:maras-reading')
  const made = ask({act: 'say', star: 'star:rosarium', to: toMara, what: 'question', words: '  Which rose?  '})
  assert.ok('request' in made, JSON.stringify(made))
  assert.match(made.request.saying_ref, /^saying:[A-Za-z0-9._:-]+$/, 'a new saying is named once')
  assert.deepEqual({...made.request, saying_ref: undefined}, {kind: 'star-say', saying_ref: undefined, star_ref: 'star:rosarium', world_ref: 'world:me',
    to: {world_ref: 'world:mara', part_ref: 'page:maras-reading'}, what: 'question', words: 'Which rose?'})
  const reply = ask({act: 'say', star: 'star:rosarium', to: 'saying:q1', what: 'finding', words: 'At the rose.'})
  assert.deepEqual(reply.request.to, {saying_ref: 'saying:q1'}, 'a saying may answer a saying')
  assert.deepEqual(ask({act: 'unsay', star: 'star:rosarium', saying: 'saying:f1'}), {request: {kind: 'star-unsay', saying_ref: 'saying:f1'}})
  const refusals = {
    'not here': [ask({act: 'say', star: 'star:far', to: model.shownId('world:stranger', 'page:elsewhere'), what: 'finding', words: 'x'}), /only while it is gathered there/],
    'to nothing': [ask({act: 'say', star: 'star:rosarium', to: null, what: 'question', words: 'x'}), /Choose what to say it to/],
    'to what is gone': [ask({act: 'say', star: 'star:rosarium', to: 'saying:gone', what: 'question', words: 'x'}), /no longer shown or said at this star/],
    'unsaid words': [ask({act: 'say', star: 'star:rosarium', to: toMara, what: 'question', words: '   '}), /Say something first/],
    'too many words': [ask({act: 'say', star: 'star:rosarium', to: toMara, what: 'question', words: 'x'.repeat(1001)}), /at most 1000 characters/],
    'not a kind': [ask({act: 'say', star: 'star:rosarium', to: toMara, what: 'shout', words: 'x'}), /a question, a finding, a correction or a reproduction/],
    'no world': [model.starRequest(field, null, {act: 'say', star: 'star:rosarium', to: toMara, what: 'question', words: 'x'}, 0), /Your world is not in the field/],
    'not kept': [model.starRequest(model.heldFieldOf({...SNAPSHOT, ...SAID, star_saying: {state: 'unavailable', detail: 'This field’s service does not keep what is said at a star yet'}}), YOURS,
      {act: 'say', star: 'star:rosarium', to: toMara, what: 'question', words: 'x'}, 0), /does not keep what is said/],
    'not yours to unsay': [ask({act: 'unsay', star: 'star:rosarium', saying: 'saying:q1'}), /Only the one who said it unsays it/],
    'nothing to unsay': [ask({act: 'unsay', star: 'star:rosarium', saying: null}), /Choose something your world said/],
    'a shown thing is not unsaid': [ask({act: 'unsay', star: 'star:rosarium', saying: toMara}), /Choose something your world said/],
  }
  for (const [name, [made, words]] of Object.entries(refusals)) {
    assert.ok('refusal' in made, `${name}: refused`)
    assert.match(made.refusal, words, name)
    assert.ok(!/_ref|star-|\bkind\b|`/.test(made.refusal), `${name}: the refusal is words, no field or op names: ${made.refusal}`)
  }
  assert.equal(model.starNote({kind: 'star-say'}, {}), 'It is said at the star, under your world’s name.')
  assert.equal(model.starNote({kind: 'star-unsay'}, {}), 'It is unsaid: it no longer stands at the star.')
})

test('the World binding says and unsays at a star from the view’s own hand, and stands each act it cannot do dimmed (SF06)', async () => {
  store.publishField(saidField())
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.chooseStarHand({star: 'star:rosarium', admit: null, to: null, what: 'question', words: ''})
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.match(binding.standing.starSay?.disabled ?? '', /Choose what to say it to/)
    assert.match(binding.standing.starUnsay?.disabled ?? '', /Choose something your world said/)
    const toMara = model.shownId('world:mara', 'page:maras-reading')
    binding.local.fieldSayTo(toMara)
    binding.local.sayWhat('correction')
    binding.local.sayWhat('shout')
    binding.local.sayWords('Not the red rose.')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.values.fieldSayTo, toMara)
    assert.equal(binding.values.sayWhat, 'correction', 'what is said is a question, a finding, a correction or a reproduction, nothing else')
    assert.equal(binding.values.sayWords, 'Not the red rose.')
    assert.equal(binding.standing.starSay, undefined)
    assert.equal(binding.writes('starSay'), true)
    await binding.write([{key: 'starSay', value: 1}])
    const said = asked.pop()
    assert.deepEqual({...said, saying_ref: undefined}, {kind: 'star-say', saying_ref: undefined, star_ref: 'star:rosarium', world_ref: 'world:me',
      to: {world_ref: 'world:mara', part_ref: 'page:maras-reading'}, what: 'correction', words: 'Not the red rose.'})
    assert.equal(store.starHand().words, '', 'what was said is cleared from the hand once said')
    // Unsay: something your world said, chosen in what was said
    binding.local.fieldSayTo('saying:q1')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.match(binding.standing.starUnsay?.disabled ?? '', /Only the one who said it unsays it/)
    assert.equal(binding.writes('starUnsay'), false)
    binding.local.fieldSayTo('saying:f1')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.standing.starUnsay, undefined)
    await binding.write([{key: 'starUnsay', value: 2}])
    assert.deepEqual(asked.pop(), {kind: 'star-unsay', saying_ref: 'saying:f1'})
    assert.equal(store.starHand().to, null, 'what was unsaid is no longer chosen')
    // what is no longer at the star is not chosen; choosing another star lets the choice go
    binding.local.fieldSayTo('saying:gone')
    assert.equal(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.fieldSayTo, undefined)
    binding.local.fieldSayTo(toMara)
    binding.local.fieldStar('star:far')
    assert.equal(store.starHand().to, null)
    // the binding hands the face what was said, with the field
    const handed = JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.field)
    assert.equal(handed.sayings.length, 5)
    // the page of the star's day and of what was said there are the view's own, turned back to the newest when another star is chosen
    binding.local.fieldStar('star:rosarium')
    binding.local.dayPage(1)
    binding.local.dayPage(-1)
    binding.local.saidPage(0)
    let paged = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.deepEqual([paged.values.dayPage, paged.values.saidPage], [1, 0], 'a page is a whole number from 0')
    binding.local.fieldStar('star:far')
    paged = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.deepEqual([paged.values.dayPage, paged.values.saidPage], [undefined, undefined])
  } finally {
    store.bindSystemActs(null)
  }
})

test('the face reads who is here, what was brought and what was said to what beside the star’s day, and says and unsays there (SF06)', () => {
  const v = {...world.defaults, ...world.fixtures['Field, a star chosen']}
  // the Star page: the chosen star whole, beside the globe (the Space page keeps the acts at a star and its day as they were)
  const whole = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'star', setPage() {}, standing: {}}))
  assert.match(whole, /role="tab"[^>]*>Star</, 'the World has a Star page')
  assert.match(whole, /Star’s day/, 'the star’s day stands on it')
  for (const label of ['Here now', 'Said here', 'Say']) assert.match(whole, new RegExp(`>${label}<`), `${label} stands on the face`)
  for (const label of ['To', 'Kind', 'Words']) assert.match(whole, new RegExp(`data-i="${label}[^"]*"`), `${label} stands on the face`)
  assert.match(whole, />Unsay</)
  assert.match(whole, /class="dp-row-name[^"]*"[^>]*>mara asks about For the circle: [^<]+</, 'what was said to what is a line')
  assert.match(whole, /class="dp-row-name[^"]*"[^>]*>teraphim has a finding on mara’s question: [^<]+</, 'an answer names what it answers')
  assert.match(whole, /class="dp-row-name[^"]*"[^>]*>Mara’s reading of the second plate</, 'what a world brought is a line')
  assert.match(whole, /class="dp-row-name">mara asked a question</, 'the day names who said something there')
  assert.match(whole, /class="dp-row-note">(\d\d:\d\d|\d{1,2} [A-Z][a-z]{2})</, 'and when')
  assert.match(whole, /aria-label="Previous page">/, 'the star’s day pages back to what came before')
  const unheld = renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['Field not held']}, set() {}, nav: {}, page: 'star', setPage() {}, standing: {}}))
  const cellOf = (label) => unheld.match(new RegExp(`<[^>]*data-i="${label}[^"]*"[^>]*>`))?.[0] ?? ''
  for (const label of ['To', 'Kind', 'Words', 'Say', 'Unsay']) {
    const cell = cellOf(label)
    assert.match(cell, /data-disabled="true"/, `${label} stands dimmed while the field holds no worlds`)
    assert.match(cell, /does not hold worlds yet/, `${label} says why in the field’s words`)
  }
})

// ── round 27: the Graph side of the field (manual §17.2; TO10, SF02) ─────────────────────────────────────────────────────
//
// TO10: "Turned to its graph, each star is a node with its worlds and each contribution an edge. The graph holds no data of its own and
// shows only what each world has shown." The graph is drawn from the same scene as the Field scale, so Aperture and View as filter it the
// same way, and what lies under the cloud is in no node, edge or count of it.

const tiesOf = graph => graph.edges.map(edge => `${edge.tie} ${edge.from} > ${edge.to}`).sort()
const graphOf = (field, aperture, viewAs) => model.fieldGraph(model.fieldScene(field, {aperture, viewAs}, YOURS))

test('turned to its graph, the field is its worlds, its stars and what each world shows, tied by gathering, showing and contribution (TO10)', () => {
  const graph = graphOf(saidField(), 'federated', 'me')
  assert.deepEqual(graph.nodes.filter(node => node.kind === 'world').map(node => [node.id, node.label, node.yours]),
    [['world:me', 'me', true], ['world:me:o-i', 'o-i', false], ['world:mara', 'mara', false], ['world:stranger', 'stranger', false]])
  assert.deepEqual(graph.nodes.filter(node => node.kind === 'star').map(node => [node.id, node.label]), [['star:rosarium', 'The Rosarium plates'], ['star:far', 'Far']])
  const circle = model.shownId('world:me', 'page:for-the-circle'), marasReading = model.shownId('world:mara', 'page:maras-reading')
  assert.deepEqual(graph.nodes.filter(node => node.kind === 'shown').map(node => node.label),
    ['A reading of the fourth plate', 'Rosarium notes', 'For the circle', 'Mara’s plate', 'Mara’s reading of the second plate', 'Elsewhere'])
  assert.deepEqual(tiesOf(graph), [
    `at ${circle} > star:rosarium`, `at ${marasReading} > star:rosarium`,
    'asks world:stranger > star:rosarium',
    'gathered world:mara > star:rosarium', 'gathered world:me > star:rosarium', 'gathered world:stranger > star:far',
    `said world:mara > ${circle}`, 'said world:me > world:mara',
    `shows world:mara > ${model.shownId('world:mara', 'page:maras-plate')}`, `shows world:mara > ${marasReading}`,
    `shows world:me > ${circle}`, `shows world:me > ${model.shownId('world:me', 'page:reading-of-plate-4')}`, `shows world:me > ${model.shownId('world:me', 'place:rosarium-notes')}`,
    `shows world:stranger > ${model.shownId('world:stranger', 'page:elsewhere')}`,
  ].sort(), 'a contribution is an edge from its sayer to what it was said to; one said to what was taken back or unsaid ties nothing')
  for (const edge of graph.edges) assert.ok(graph.nodes.some(node => node.id === edge.from) && graph.nodes.some(node => node.id === edge.to), `an edge ties two nodes: ${JSON.stringify(edge)}`)
})

test('Aperture filters the graph as it filters the one system', () => {
  const field = saidField()
  const world = graphOf(field, 'world', 'me')
  assert.deepEqual(world.nodes.filter(node => node.kind !== 'shown').map(node => node.id), ['world:me'], 'World: your world alone')
  assert.deepEqual(world.edges.map(edge => edge.tie), ['shows', 'shows', 'shows'])
  const shared = graphOf(field, 'shared', 'me')
  assert.deepEqual(shared.nodes.filter(node => node.kind !== 'shown').map(node => node.id), ['world:me', 'world:me:o-i', 'world:mara', 'star:rosarium'])
  assert.ok(!tiesOf(shared).some(tie => tie.includes('world:stranger')), 'a world past the edge is in no tie, even its asking')
})

test('View as Field: what your world shows only at a star is in no node, edge or count of the graph the field sees, nor what was said to it (SF02)', () => {
  const MARK = 'PRIVATE-MARK-858-graph'
  const planted = model.heldFieldOf({...SNAPSHOT, ...SAID, clearings: [...SAID.clearings, c('world:me', 'page:private-858', 'star', MARK, 'star:rosarium')],
    star_sayings: [...SAID.star_sayings, {saying_ref: 'saying:to-mark', star_ref: 'star:rosarium', world_ref: 'world:mara', to_world_ref: 'world:me', to_part_ref: 'page:private-858',
      to_saying_ref: null, what: 'question', words: 'What is this?', said_at_micros: micros(AT)}]})
  assert.ok(JSON.stringify(graphOf(planted, 'federated', 'me')).includes(MARK), 'you see what you planted (non-vacuous)')
  for (const viewAs of ['field', 'public']) {
    const seen = graphOf(planted, 'federated', viewAs)
    const text = JSON.stringify(seen)
    for (const hidden of [MARK, 'page:private-858', 'page:for-the-circle', 'For the circle']) assert.ok(!text.includes(hidden), `as the ${viewAs} sees it the graph names ${hidden}: ${text.slice(0, 300)}`)
    assert.ok(!seen.edges.some(edge => edge.tie === 'said' && edge.from.startsWith('world:me')), 'what your world said at a star is said to those gathered there, not to the field')
    // the cloud says nothing of what lies under it, or how much: the graph reads exactly as it would with nothing planted under it
    const bare = model.heldFieldOf({...SNAPSHOT, ...SAID, clearings: SAID.clearings.filter(one => one.part_ref !== 'page:for-the-circle')})
    assert.deepEqual(seen, graphOf(bare, 'federated', viewAs), `as the ${viewAs} sees it`)
  }
  assert.deepEqual(graphOf(planted, 'federated', 'public').nodes.filter(node => node.kind === 'shown' && node.id.includes('world:me')).map(node => node.label), ['A reading of the fourth plate'])
})

test('the World turned to its graph at Field scale draws the field by connection, with Aperture and View as its own; at the other scales it draws the constellation as before', () => {
  const v = {...world.defaults, ...world.fixtures['Field, everything'], view: 'graph'}
  const page = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'graph', setPage() {}, standing: {}}))
  assert.match(page, /The Rosarium plates/, 'a star is a node by its name')
  assert.match(page, />mara</, 'a world is a node by its name')
  assert.match(page, /4 worlds · 2 stars/, 'the graph counts what it draws')
  // your world with its Link off is drawn on the Field as a ring that says why; the field's graph has no node for it, nor counts it
  const unlinked = JSON.parse(v.field)
  unlinked.worlds = unlinked.worlds.map(one => one.world_ref === 'world:teraphim' ? {...one, linked: false} : one)
  const asField = renderToStaticMarkup(world.whole({v: {...v, viewAs: 'field', field: JSON.stringify(unlinked)}, set() {}, nav: {}, page: 'graph', setPage() {}, standing: {}}))
  assert.match(asField, /3 worlds · 2 stars/, 'the graph counts only what it draws')
  const cellOf = (html, label) => html.match(new RegExp(`<[^>]*data-i="${label}[^"]*"[^>]*>`))?.[0] ?? ''
  for (const label of ['Aperture', 'View as']) assert.doesNotMatch(cellOf(page, label), /data-disabled="true"/, `${label} stands on the field’s graph`)
  assert.match(cellOf(page, 'Steps'), /data-disabled="true"/, 'the constellation’s steps do not shape the field')
  assert.match(cellOf(page, 'Steps'), /the field/, 'and say why')
  const compact = renderToStaticMarkup(world.compact({v, set() {}, nav: {}, standing: {}}))
  assert.match(compact, /data-i="Aperture/, 'the compact face carries Aperture beside the field’s graph')
  const full = renderToStaticMarkup(world.full({v, set() {}, nav: {}, standing: {}}))
  assert.match(full, /The Rosarium plates/)
  assert.ok(!full.includes('Amber: an archetype'), 'the field’s graph is no constellation')
  // at another scale the Graph is the constellation's, and Reach is the Field's alone
  const constellation = {...world.defaults, ...world.fixtures['Graph, three steps'], scale: 'body'}
  const before = renderToStaticMarkup(world.whole({v: constellation, set() {}, nav: {}, page: 'graph', setPage() {}, standing: {}}))
  assert.match(before, /\d+ nodes/, 'the constellation counts its nodes as before')
  assert.ok(!before.includes('The Rosarium plates'))
  assert.doesNotMatch(cellOf(before, 'Steps'), /the field/)
})

// ── SF12, SF13 on the face (round 30): a Run chosen at a star, its work shown and its tasks offered, taken, brought back, accepted and
// revoked, each act through Software Factory (the kernel's factory_owner) and the field (the kernel's shared_field). FIXTURE rows in the
// client's shape (field-lib.ts worldReading star_works, star_offers); Factory's documents in its own shapes (factory.shown-work/v1,
// factory.task-offer/v1, factory.task-offer-return/v1), as the r29 walk proved them between two Factories on a local SpacetimeDB.
const RUN = 'run:01ARZ3NDEKTSV4RRFFQ69G5FAA', UNIT = 'workflow-unit:01ARZ3NDEKTSV4RRFFQ69G5FAY', AT0 = Date.UTC(2026, 10, 6, 9)
const LAPSE = Date.now() + 2 * 3_600_000
const SHOWN = revision => ({schema: 'factory.shown-work/v1', owner: 'factory', work_ref: RUN, revision, name: 'The river maps', standing: 'live', lifecycle: 'active',
  agents: [{agent: 'Cartographer', at: 'runs'}, {agent: 'Surveyor', at: 'waits'}], made: [{label: 'The delta chart', standing: 'candidate'}], tasks: {runs: 1, waits: 1}, withheld: 0})
const OFFER = ref => ({schema: 'factory.task-offer/v1', offer_ref: ref, star_ref: 'star:rosarium', programme: {run_ref: RUN, workflow_unit_ref: UNIT},
  task: {key: 'inspect-source', asks: 'Chart the delta’s channels from the survey notes.', returns: 'factory.inspect-source/v1'},
  grant: {reads: ['project:river/docs'], touches: ['project:river/maps'], lapses_at: LAPSE}, offered_at: AT0, automatic_agent_or_model_invocation: false})
const BACK = ref => ({schema: 'factory.task-offer-return/v1', offer_ref: ref, star_ref: 'star:rosarium', by: {world_ref: 'world:mara', name: 'mara'},
  made: {label: 'The delta chart', summary: 'Charted the channels.', refs: ['project:river/maps/delta']}, returned_at: AT0 + 60_000, automatic_agent_or_model_invocation: false})
const offerRow = (ref, world_ref, state, taker, extra = {}) => ({offer_ref: ref, star_ref: 'star:rosarium', world_ref, state, taker_world_ref: taker, offer: OFFER(ref),
  lapses_at_micros: micros(LAPSE), offered_at_micros: micros(AT0), moved_at_micros: micros(AT0), ...extra})
const WORK = {
  star_work: {state: 'held'},
  star_works: [{star_ref: 'star:rosarium', world_ref: 'world:me', work_ref: RUN, standing: 'live', revision: 7, shown: SHOWN(7), shown_at_micros: micros(AT0), updated_at_micros: micros(AT0)}],
  star_offers: [offerRow('offer:mine-open', 'world:me', 'open', null), offerRow('offer:mine-back', 'world:me', 'returned', 'world:mara', {returned: BACK('offer:mine-back')}),
    offerRow('offer:maras', 'world:mara', 'open', null), offerRow('offer:maras-taken', 'world:mara', 'taken', 'world:me')],
  star_day: {state: 'held'},
  star_days: [{star_ref: 'star:rosarium', world_ref: 'world:me', what: 'showed', kind: 'work', at_micros: micros(AT0)},
    {star_ref: 'star:rosarium', world_ref: 'world:me', what: 'offered', kind: 'task', at_micros: micros(AT0 + 1000)},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'took', kind: 'task', at_micros: micros(AT0 + 2000)},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'brought-back', kind: 'task', at_micros: micros(AT0 + 3000)},
    {star_ref: 'star:rosarium', world_ref: 'world:me', what: 'revoked', kind: 'task', at_micros: micros(AT0 + 4000)}],
}
const atRosarium = data => model.fieldScene(model.heldFieldOf(data), {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === 'star:rosarium')

test('what is shown and offered at a star reads beside it: the work as Factory showed it, each task with its grant, and the day says offered, took, brought back and revoked (SF12, SF13)', () => {
  const star = atRosarium({...SNAPSHOT, ...WORK})
  assert.equal(star.works.length, 1)
  const [work] = star.works
  assert.deepEqual({world: work.world, mine: work.mine, name: work.name, standing: work.standing, revision: work.revision, agents: work.agents.length, made: work.made.length},
    {world: 'world:me', mine: true, name: 'The river maps', standing: 'live', revision: 7, agents: 2, made: 1})
  assert.deepEqual(star.offers.map(offer => [offer.ref, offer.mine, offer.state, offer.yoursTook]),
    [['offer:mine-open', true, 'open', false], ['offer:mine-back', true, 'returned', false], ['offer:maras', false, 'open', false], ['offer:maras-taken', false, 'taken', true]])
  const back = star.offers.find(offer => offer.ref === 'offer:mine-back')
  assert.deepEqual(back.returned, {label: 'The delta chart', summary: 'Charted the channels.', by: 'mara', refs: ['project:river/maps/delta']}, 'what came back reads under its maker’s name')
  assert.deepEqual({asks: back.asks, reads: back.reads, touches: back.touches, lapsesAt: back.lapsesAt}, {asks: 'Chart the delta’s channels from the survey notes.', reads: ['project:river/docs'], touches: ['project:river/maps'], lapsesAt: LAPSE})
  assert.deepEqual(star.day.map(model.starDayLine), ['me showed a piece of work', 'me offered a task', 'mara took a task', 'mara brought back a task', 'me revoked a task'])
  // a service that keeps no work at stars says so; nothing is drawn as if none were shown
  const none = model.heldFieldOf(SNAPSHOT)
  assert.equal(none.works, null)
  assert.match(none.workWhy, /work shown or tasks offered/)
  assert.equal(atRosarium(SNAPSHOT).works, null)
})

test('each act on work and tasks at a star is refused in words where it cannot be done, for your own world (SF12, SF13)', () => {
  const field = model.heldFieldOf({...SNAPSHOT, ...WORK})
  // [round 30b] the refusals and the grant are the binding's (atlasDevices.ts), out of the field model the first load carries
  const why = act => atlasDevs.workActWhy(field, YOURS, {star: 'star:rosarium', ...act})
  assert.match(why({act: 'show', run: null}), /Choose a Run of Software Factory’s first/)
  assert.equal(why({act: 'show', run: 'r'}), undefined)
  assert.match(atlasDevs.workActWhy(field, YOURS, {act: 'show', star: 'star:far', run: 'r'}), /only while it is gathered there/)
  assert.equal(why({act: 'unshow', work: RUN}), undefined)
  assert.match(why({act: 'unshow', work: null}), /Choose a work your world shows here/)
  const offer = {act: 'offer', run: 'r', unit: UNIT, reads: 'project:river/docs', touches: 'project:river/maps', days: 2}
  assert.equal(why(offer), undefined)
  assert.match(why({...offer, unit: null}), /Choose the task to offer/)
  assert.match(why({...offer, reads: ' '}), /what the task may read/)
  assert.match(why({...offer, touches: 'the maps'}), /refs/)
  assert.match(why({...offer, days: 31}), /thirty days/)
  assert.equal(why({act: 'take', offer: 'offer:maras'}), undefined)
  assert.match(why({act: 'take', offer: 'offer:mine-open'}), /your own/)
  // REPLACED (round 30b): a task your own world took stays to be taken again, which finishes a take your Factory did not hear
  assert.equal(why({act: 'take', offer: 'offer:maras-taken'}), undefined)
  const ret = {act: 'return', offer: 'offer:maras-taken', made: 'The delta chart', summary: 'Charted the channels.', ref: 'project:river/maps'}
  assert.equal(why(ret), undefined)
  assert.match(why({...ret, made: ''}), /Name what was made/)
  assert.match(why({...ret, offer: 'offer:maras'}), /Only the world that took/)
  assert.match(why({...ret, ref: 'project:river/docs'}), /grant does not let the task touch/)
  assert.equal(why({act: 'accept', offer: 'offer:mine-back'}), undefined)
  assert.match(why({act: 'accept', offer: 'offer:mine-open'}), /Nothing has come back/)
  assert.match(why({act: 'accept', offer: 'offer:maras'}), /Only the one who offered/)
  assert.equal(why({act: 'revoke', offer: 'offer:mine-open'}), undefined)
  assert.match(why({act: 'revoke', offer: 'offer:maras'}), /Only the one who offered/)
  assert.equal(model.workActWhy, undefined, 'the field model no longer carries the act refusals')
  assert.deepEqual(atlasDevs.grantOf('project:river/docs, project:river/notes', 'project:river/maps', 2, AT0),
    {grant: {reads: ['project:river/docs', 'project:river/notes'], touches: ['project:river/maps'], lapses_at: AT0 + 2 * 86_400_000}})
})

test('the World binding shows a Run’s work and offers, takes, brings back, accepts and revokes a task, each through Factory and then the field (SF12, SF13)', async () => {
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...WORK}))
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.chooseStarHand({star: 'star:rosarium', run: null, unit: null, offer: null})
  const key = JSON.stringify(['/ground/.factory/state.json', RUN])
  store.publishFactory({state: 'read', runs: [{key, statePath: '/ground/.factory/state.json', runRef: RUN, name: 'The river maps', standing: 'live', project: null}],
    takerState: '/ground/.factory/state.json', units: {run: key, units: [{ref: UNIT, key: 'inspect-source'}]}})
  const asked = []
  const answers = {
    'work-show-read': () => SHOWN(8),
    'offer-make': request => ({schema: 'factory.task-offer-receipt/v1', act: 'make', state: 'open', offer: {...OFFER('offer:made'), grant: request.grant}}),
    'offer-return': () => BACK('offer:maras-taken'),
  }
  const factory = async request => { asked.push(['factory', request]); const answer = answers[request.kind === 'task-offer-act' ? request.verb : request.kind]; return answer ? answer(request.request) : {schema: 'factory.task-offer-receipt/v1'} }
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', factory,
    fieldAct: async request => { asked.push(['field', request]); return 'The field took it.' }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.deepEqual(JSON.parse(binding.values.factoryRuns).map(option => [option.value, option.label]), [[key, 'The river maps']])
    assert.match(binding.standing.starShow?.disabled ?? '', /Choose a Run of Software Factory’s first/)
    binding.local.factoryRun(key)
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.values.factoryRun, key)
    assert.equal(binding.standing.starShow, undefined)
    await binding.write([{key: 'starShow', value: 1}])
    assert.deepEqual(asked.splice(0), [['factory', {kind: 'work-show-read', state_path: '/ground/.factory/state.json', run_ref: RUN}],
      ['field', {kind: 'work-show', star_ref: 'star:rosarium', world_ref: 'world:me', shown: SHOWN(8)}]])
    // Take back: the work goes back under cloud
    binding.local.fieldWork(RUN)
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'starUnshow', value: 2}])
    assert.deepEqual(asked.splice(0), [['field', {kind: 'work-unshow', star_ref: 'star:rosarium', world_ref: 'world:me', work_ref: RUN}]])
    // Offer a task: the Run's unit under a grant the person sets; Factory makes the offer, the field carries it
    binding.local.factoryUnit(UNIT)
    binding.local.grantReads('project:river/docs')
    binding.local.grantTouches('project:river/maps')
    binding.local.grantDays(2)
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.deepEqual(JSON.parse(binding.values.factoryUnits).map(option => option.value), [UNIT])
    assert.equal(binding.standing.starOffer, undefined)
    const before = Date.now()
    await binding.write([{key: 'starOffer', value: 3}])
    const [[, make], [, put]] = asked.splice(0)
    assert.equal(make.kind, 'task-offer-act')
    assert.equal(make.verb, 'offer-make')
    assert.deepEqual({...make.request, grant: {...make.request.grant, lapses_at: 0}}, {run_ref: RUN, workflow_unit_ref: UNIT, star_ref: 'star:rosarium',
      grant: {reads: ['project:river/docs'], touches: ['project:river/maps'], lapses_at: 0}})
    assert.ok(make.request.grant.lapses_at >= before + 2 * 86_400_000 && make.request.grant.lapses_at <= Date.now() + 2 * 86_400_000, 'the grant lapses the days the person set from now')
    assert.equal(put.kind, 'offer-put')
    assert.equal(put.offer.offer_ref, 'offer:made')
    // Take: the field first (one gathered world takes it), then the taker's Factory records it under the grant
    binding.local.fieldOffer('offer:maras')
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerTake', value: 4}])
    assert.deepEqual(asked.splice(0), [['field', {kind: 'offer-take', offer_ref: 'offer:maras', world_ref: 'world:me'}],
      ['factory', {kind: 'task-offer-act', state_path: '/ground/.factory/state.json', verb: 'offer-take', request: {offer: OFFER('offer:maras'), by: {world_ref: 'world:me', name: 'me'}}}]])
    // Return: the taker's Factory answers what was made within the grant, and the field brings it back
    binding.local.fieldOffer('offer:maras-taken')
    binding.local.madeLabel('The delta chart')
    binding.local.madeSummary('Charted the channels.')
    binding.local.madeRef('project:river/maps')
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerReturn', value: 5}])
    assert.deepEqual(asked.splice(0), [['factory', {kind: 'task-offer-act', state_path: '/ground/.factory/state.json', verb: 'offer-return',
      request: {offer_ref: 'offer:maras-taken', made: {label: 'The delta chart', summary: 'Charted the channels.', refs: ['project:river/maps']}}}],
    ['field', {kind: 'offer-return', offer_ref: 'offer:maras-taken', return: BACK('offer:maras-taken')}]])
    // Accept: what came back is received apart from the work, accepted into the Run, and the field closes the offer
    binding.local.fieldOffer('offer:mine-back')
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerAccept', value: 6}])
    assert.deepEqual(asked.splice(0), [['factory', {kind: 'task-offer-act', state_path: '/ground/.factory/state.json', verb: 'offer-receive', request: {return: BACK('offer:mine-back')}}],
      ['factory', {kind: 'task-offer-act', state_path: '/ground/.factory/state.json', verb: 'offer-accept', request: {offer_ref: 'offer:mine-back'}}],
      ['field', {kind: 'offer-accept', offer_ref: 'offer:mine-back'}]])
    // Revoke: Factory withdraws the grant, then the field
    binding.local.fieldOffer('offer:mine-open')
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerRevoke', value: 7}])
    assert.deepEqual(asked.splice(0), [['factory', {kind: 'task-offer-act', state_path: '/ground/.factory/state.json', verb: 'offer-revoke', request: {offer_ref: 'offer:mine-open'}}],
      ['field', {kind: 'offer-revoke', offer_ref: 'offer:mine-open'}]])
    // an act on an offer this world cannot do stands dimmed with its reason and is not written
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.match(binding.standing.offerTake?.disabled ?? '', /your own/)
    assert.equal(binding.writes('offerTake'), false)
    // Factory's refusal reaches the person in its words, and the field is not asked
    store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(['field', request]); return 'x' },
      factory: async () => { throw Error('The offer was revoked; nothing that comes back to it enters the work') }})
    binding.local.fieldOffer('offer:mine-back')
    await assert.rejects(atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerAccept', value: 8}]), /revoked/)
    assert.deepEqual(asked, [], 'nothing reached the field')
    // Factory's reading of its Runs, refused, stands the Run chooser dimmed with its words
    store.publishFactory({state: 'unavailable', reason: 'Factory keeps no state here'})
    assert.match(atlasDevs.atlasGlobeBinding(YOURS_READING()).standing.factoryRun?.disabled ?? '', /Factory keeps no state here/)
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    store.chooseStarHand({star: null, run: null, unit: null, work: null, offer: null, made: '', summary: '', madeRef: null, reads: '', touches: '', days: 7})
  }
})

test('the face shows a Run’s work and the tasks offered at a star, holds every act it cannot undo and never one it can (manual §16.10; SF12, SF13)', () => {
  const v = {...world.defaults, ...world.fixtures['Work at a star']}
  const page = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'work', setPage() {}, standing: {}}))
  assert.match(page, /The river maps/, 'the work shown at the star reads by its name')
  assert.match(page, /Cartographer/, 'its agents at work read')
  assert.match(page, /Chart the delta’s channels/, 'a task offered there reads by what it asks')
  assert.match(page, /data-i="Run/, 'the Run chooser stands on the page')
  const held = label => new RegExp(`data-hold="true"[^>]*><i[^>]*></i>${label}<`).test(page)
  const unheld = label => new RegExp(`class="dp-action"(?: disabled="")?>${label}<`).test(page)
  // what can be undone is pressed: Take back undoes Show work, Show work undoes Take back, Revoke withdraws an offer
  for (const label of ['Show work', 'Take back', 'Offer a task']) assert.ok(unheld(label), `${label} is pressed, not held`)
  // what cannot be undone is held: a take leaves no other world the task, what was brought back stands with its offerer, an
  // acceptance enters the Run, a revocation is for good
  for (const label of ['Take', 'Return', 'Accept', 'Revoke']) assert.ok(held(label), `${label} is held`)
  assert.match(page, /Hold to take it up/)
  assert.match(page, /Hold to revoke/)
  // the Space page's Factory section acts too: Show work beside the Run chooser, and a way to the Work page
  const space = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  assert.ok(/class="dp-action">Show work</.test(space), 'Show work acts from the Space page once a Run is chosen')
  assert.match(space, />Work ›</)
})

// ── round 30b: an act half done is finished, never stuck; a revocation reaches the Factory that took the task ─────────────────────
// Both halves of a take answer a repeat with what they answered first (the field's take_offer returns early for the same world;
// Factory's take answers the same receipt for the same offer and world), and Factory's give_back answers a repeat of the same made
// with the return it gave. So an act whose second half failed is finished by pressing it again.
const withOffers = (...rows) => ({...WORK, star_offers: rows})
const TAKER = '/taker/.factory/state.json'
const factoryRead = (extra = {}) => ({state: 'read', runs: [{key: JSON.stringify(['/ground/.factory/state.json', RUN]), statePath: '/ground/.factory/state.json', runRef: RUN, name: 'The river maps', standing: 'live', project: null}],
  takerState: TAKER, units: null, ...extra})
const resetHand = () => store.chooseStarHand({star: null, run: null, unit: null, work: null, offer: null, made: '', summary: '', madeRef: null, reads: '', touches: '', days: 7, taker: null})

test('a take the field heard and Factory did not stays pressable for the world that took it, and pressing it again finishes it in your Factory (SF13)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(offerRow('offer:maras', 'world:mara', 'open', null))}))
  store.publishFactory(factoryRead())
  store.chooseStarHand({star: 'star:rosarium', offer: 'offer:maras'})
  const asked = []
  let refuse = true
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded',
    fieldAct: async request => { asked.push(['field', request]); return 'The field took it.' },
    factory: async request => { asked.push(['factory', request]); if (refuse) { refuse = false; throw Error('Software Factory gave no answer.') } return {schema: 'factory.task-offer-receipt/v1', act: 'take', state: 'taken'} }})
  try {
    await assert.rejects(atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerTake', value: 1}]), /gave no answer/)
    assert.deepEqual(asked.splice(0).map(([who, request]) => [who, request.kind, request.verb ?? null]), [['field', 'offer-take', null], ['factory', 'task-offer-act', 'offer-take']])
    // the field read again: the task is your world's in the field, and your Factory has not taken it up
    store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(offerRow('offer:maras', 'world:mara', 'taken', 'world:me'), offerRow('offer:theirs', 'world:mara', 'taken', 'world:stranger'))}))
    store.publishFactory(factoryRead({taken: {}}))
    let binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.standing.offerTake, undefined, 'Take stays pressable for the world that took it')
    assert.match(JSON.parse(binding.values.offerNotes)['offer:maras'] ?? '', /Take finishes/, 'the face says in a line what pressing it again does')
    // another world's take stands as taken
    assert.match(atlasDevs.workActWhy(store.heldField(), YOURS, {act: 'take', star: 'star:rosarium', offer: 'offer:theirs'}), /taken already/)
    await binding.write([{key: 'offerTake', value: 2}])
    assert.deepEqual(asked.splice(0).map(([who, request]) => [who, request.kind, request.verb ?? null]), [['field', 'offer-take', null], ['factory', 'task-offer-act', 'offer-take']])
    // once your Factory holds it, nothing is left to finish
    store.publishFactory(factoryRead({taken: {'offer:maras': 'taken'}}))
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.match(binding.standing.offerTake?.disabled ?? '', /Your world took this task up/)
    assert.equal(JSON.parse(binding.values.offerNotes)['offer:maras'], undefined)
    // the face draws the line under the task
    const v = {...world.defaults, ...world.fixtures['Work at a star'], offerNotes: JSON.stringify({'offer:maras-index': 'Taken in the field; your Factory has not taken it up yet. Take finishes it there.'})}
    assert.match(renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'work', setPage() {}, standing: {}})), /your Factory has not taken it up yet/)
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

test('a Return Factory answered and the field did not hear carries Factory’s same return to the field when pressed again (SF13)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(offerRow('offer:maras-taken', 'world:mara', 'taken', 'world:me'))}))
  store.publishFactory(factoryRead({taken: {'offer:maras-taken': 'taken'}}))
  store.chooseStarHand({star: 'star:rosarium', offer: 'offer:maras-taken', made: 'The delta chart', summary: 'Charted the channels.', madeRef: 'project:river/maps'})
  const asked = []
  let fail = true
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded',
    fieldAct: async request => { asked.push(['field', request]); if (fail) { fail = false; throw Error('The shared field gave no answer.') } return 'The field took it.' },
    factory: async request => { asked.push(['factory', request]); return BACK('offer:maras-taken') }})
  try {
    await assert.rejects(atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerReturn', value: 1}]), /gave no answer/)
    const first = asked.splice(0)
    // the field still says taken: Return stands, and what was made stays in the hand
    const binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.standing.offerReturn, undefined)
    assert.equal(binding.values.madeLabel, 'The delta chart')
    await binding.write([{key: 'offerReturn', value: 2}])
    const again = asked.splice(0)
    assert.deepEqual(again, first, 'the same made asked of Factory again, and Factory’s same return carried to the field')
    assert.deepEqual(again[1], ['field', {kind: 'offer-return', offer_ref: 'offer:maras-taken', return: BACK('offer:maras-taken')}])
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

test('a grant revoked in the field reaches the Factory that took it up as revoked, once, and a refusal stays in view (SF13; DLW build ruling 2026-11-06)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  const revokedAt = AT0 + 5 * 60_000
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(
    offerRow('offer:maras-taken', 'world:mara', 'revoked', 'world:me', {moved_at_micros: micros(revokedAt)}),
    offerRow('offer:told', 'world:mara', 'revoked', 'world:me', {moved_at_micros: micros(revokedAt)}),
    offerRow('offer:refused', 'world:mara', 'revoked', 'world:me', {moved_at_micros: micros(revokedAt)}),
    offerRow('offer:open', 'world:mara', 'taken', 'world:me'))}))
  store.publishFactory(factoryRead({taken: {'offer:maras-taken': 'taken', 'offer:told': 'revoked', 'offer:refused': 'taken', 'offer:open': 'taken'}}))
  store.chooseStarHand({star: 'star:rosarium'})
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async () => 'x',
    factory: async request => { asked.push(request); if (request.request.offer_ref === 'offer:refused') throw Error('The record could not be written'); return {schema: 'factory.task-offer-receipt/v1', act: 'revoked', state: 'revoked'} }})
  try {
    await atlasDevs.relayRevoked()
    assert.deepEqual(asked.splice(0), [
      {kind: 'task-offer-act', state_path: TAKER, verb: 'offer-revoked', request: {offer_ref: 'offer:maras-taken', revoked_at: revokedAt}},
      {kind: 'task-offer-act', state_path: TAKER, verb: 'offer-revoked', request: {offer_ref: 'offer:refused', revoked_at: revokedAt}}],
      'only a revoked offer your Factory still holds taken is told, at the field’s time of the revocation')
    // read after read, it is told once
    await atlasDevs.relayRevoked()
    assert.deepEqual(asked, [])
    // and a refusal stays in view, in Factory's words, under the task
    const notes = JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.offerNotes)
    assert.match(notes['offer:refused'] ?? '', /could not be written/)
    assert.equal(notes['offer:maras-taken'], undefined)
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

// ── round 31: the Factory a task is taken up in is chosen on the face; a Return carries what Factory already gave back ─────────────
const CENTRAL_STATE = '/ground/.factory/state.json', RIVER_STATE = '/river/.factory/state.json'
const twoTakers = (extra = {}) => factoryRead({takers: [{statePath: CENTRAL_STATE, project: null}, {statePath: RIVER_STATE, project: 'river'}], takerState: CENTRAL_STATE, ...extra})
const bindFactory = (asked, answer) => store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded',
  fieldAct: async request => { asked.push(['field', request]); return 'The field took it.' },
  factory: async request => { asked.push(['factory', request]); return answer(request) }})

test('a task is taken up in the Factory chosen on the face, and a Return or a revocation goes to the Factory that took it up (SF13)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(offerRow('offer:maras', 'world:mara', 'open', null),
    offerRow('offer:maras-taken', 'world:mara', 'taken', 'world:me'), offerRow('offer:gone', 'world:mara', 'revoked', 'world:me', {moved_at_micros: micros(AT0)}))}))
  store.publishFactory(twoTakers({taken: {'offer:maras-taken': 'taken', 'offer:gone': 'taken'}, takenAt: {'offer:maras-taken': RIVER_STATE, 'offer:gone': RIVER_STATE}}))
  store.chooseStarHand({star: 'star:rosarium', offer: 'offer:maras'})
  const asked = []
  bindFactory(asked, request => request.verb === 'offer-return' ? BACK('offer:maras-taken') : {schema: 'factory.task-offer-receipt/v1', state: 'taken'})
  try {
    let binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.deepEqual(JSON.parse(binding.values.factoryTakers).map(option => [option.value, option.label]), [[CENTRAL_STATE, 'Central'], [RIVER_STATE, 'river']],
      'each Factory state this window locates is offered by its project')
    assert.equal(binding.values.factoryTaker, CENTRAL_STATE, 'the first located stands until another is chosen')
    binding.local.factoryTaker(RIVER_STATE)
    assert.equal(store.starHand().taker, RIVER_STATE, 'choosing a Factory is the view’s own: it goes to the hand')
    store.publishFactory(twoTakers({takerState: RIVER_STATE, taken: {'offer:maras-taken': 'taken', 'offer:gone': 'taken'}, takenAt: {'offer:maras-taken': RIVER_STATE, 'offer:gone': RIVER_STATE}}))
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    await binding.write([{key: 'offerTake', value: 1}])
    assert.deepEqual(asked.splice(0).filter(([who]) => who === 'factory').map(([, request]) => [request.verb, request.state_path]), [['offer-take', RIVER_STATE]],
      'Take goes to the Factory chosen')
    // a Return goes to the state that took the task up, whichever is chosen now
    store.publishFactory(twoTakers({taken: {'offer:maras-taken': 'taken', 'offer:gone': 'taken'}, takenAt: {'offer:maras-taken': RIVER_STATE, 'offer:gone': RIVER_STATE}}))
    store.chooseStarHand({offer: 'offer:maras-taken', made: 'The delta chart', summary: 'Charted the channels.', madeRef: 'project:river/maps'})
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerReturn', value: 1}])
    assert.deepEqual(asked.splice(0).filter(([who]) => who === 'factory').map(([, request]) => [request.verb, request.state_path]), [['offer-return', RIVER_STATE]])
    // and so does a revocation
    await atlasDevs.relayRevoked()
    assert.deepEqual(asked.splice(0).map(([, request]) => [request.verb, request.state_path, request.request.offer_ref]), [['offer-revoked', RIVER_STATE, 'offer:gone']])
    // the face offers the choice above Take
    const v = {...world.defaults, ...world.fixtures['Work at a star']}
    const page = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'work', setPage() {}, standing: {}}))
    assert.match(page, /data-i="Factory/, 'the Factory chooser stands in Take up')
    assert.match(page, />river</)
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

test('after a reload empties the hand, a Return the field did not hear is carried to it from what your Factory gave back (SF13)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(offerRow('offer:maras-taken', 'world:mara', 'taken', 'world:me'))}))
  store.publishFactory(twoTakers({taken: {'offer:maras-taken': 'returned'}, takenAt: {'offer:maras-taken': RIVER_STATE}, returns: {'offer:maras-taken': BACK('offer:maras-taken')}}))
  store.chooseStarHand({star: 'star:rosarium', offer: 'offer:maras-taken'})
  const asked = []
  bindFactory(asked, () => { throw Error('What the task made has gone back already') })
  try {
    const binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.values.madeLabel, '', 'the hand is empty')
    assert.equal(binding.standing.offerReturn, undefined, 'Return stands: Factory holds what it gave back')
    assert.match(JSON.parse(binding.values.offerNotes)['offer:maras-taken'] ?? '', /Return brings it there/)
    await binding.write([{key: 'offerReturn', value: 1}])
    assert.deepEqual(asked, [['field', {kind: 'offer-return', offer_ref: 'offer:maras-taken', return: BACK('offer:maras-taken')}]],
      'Factory’s own return goes to the field, and Factory is not asked again')
    // a task your Factory has not given back still asks what was made
    store.publishFactory(twoTakers({taken: {'offer:maras-taken': 'taken'}, takenAt: {'offer:maras-taken': RIVER_STATE}}))
    assert.match(atlasDevs.atlasGlobeBinding(YOURS_READING()).standing.offerReturn?.disabled ?? '', /Name what was made/)
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

// ── round 31: a work shown in the field is live while its source answers (manual §17.2) ───────────────────────────────────────
const RUN_B = 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB'
const workRow = (world_ref, work_ref, standing, revision, extra = {}) => ({star_ref: 'star:rosarium', world_ref, work_ref, standing, revision,
  shown: {...SHOWN(revision), work_ref, standing}, shown_at_micros: micros(AT0), updated_at_micros: micros(AT0 + 1_800_000), ...extra})
const withWorks = (...rows) => ({...WORK, star_works: rows})

test('a work shown at a star is live while the window that showed it answers, and reads as it was last shown once it answers no more (§17.2)', () => {
  const star = atRosarium({...SNAPSHOT, ...withWorks(workRow('world:me', RUN, 'live', 7, {answering: true}), workRow('world:mara', RUN_B, 'live', 3, {answering: false}),
    workRow('world:mara', 'run:01ARZ3NDEKTSV4RRFFQ69G5FAC', 'kept', 9, {answering: false}))})
  assert.deepEqual(star.works.map(work => [work.world, work.standing, work.away, work.shownAt]),
    [['world:me', 'live', false, AT0 + 1_800_000], ['world:mara', 'live', true, AT0 + 1_800_000], ['world:mara', 'kept', false, AT0 + 1_800_000]],
    'a live work whose window answers no more is away; a kept one stands as it was kept')
  // a field whose service keeps no answers reads each work by its standing alone, as it always did
  assert.equal(atRosarium({...SNAPSHOT, ...withWorks(workRow('world:mara', RUN_B, 'live', 3))}).works[0].away, false)
  // the face: the work away says so, and when it was last shown
  const v = {...world.defaults, ...world.fixtures['Work at a star']}
  const page = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'work', setPage() {}, standing: {}}))
  assert.match(page, /mara, away/, 'Mara’s work, whose window answers no more, is away')
  assert.match(page, /as it was last shown at [0-9:]+: the window that showed it answers no more/)
  assert.match(page, /live while it is open and its window answers/, 'your own work, answering, is live')
})

test('a work your world shows is shown again as its Run moves and when the field says it answers no more; nobody else’s, nothing kept and no Run this window does not locate (§17.2)', async () => {
  const runAt = (runRef, revision, statePath = '/ground/.factory/state.json') => ({key: JSON.stringify([statePath, runRef]), statePath, runRef, name: runRef, standing: 'live', project: null, revision})
  const asked = []
  const answers = {[RUN]: SHOWN(8), [RUN_B]: {...SHOWN(3), work_ref: RUN_B}}
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded',
    fieldAct: async request => { asked.push(['field', request.kind, request.shown?.work_ref, request.shown?.revision]); return 'The field took it.' },
    factory: async request => { asked.push(['factory', request.kind, request.run_ref]); return answers[request.run_ref] }})
  try {
    // your Run moved past the reading shown (8 > 7); your other work answers no more; Mara's and a kept one are not this window's
    store.publishField(model.heldFieldOf({...SNAPSHOT, ...withWorks(workRow('world:me', RUN, 'live', 7, {answering: true}), workRow('world:me', RUN_B, 'live', 3, {answering: false}),
      workRow('world:mara', 'run:01ARZ3NDEKTSV4RRFFQ69G5FAD', 'live', 2, {answering: false}), workRow('world:me', 'run:01ARZ3NDEKTSV4RRFFQ69G5FAC', 'kept', 9, {answering: false}),
      workRow('world:me', 'run:01ARZ3NDEKTSV4RRFFQ69G5FAE', 'live', 1, {answering: false}))}))
    store.publishFactory(factoryRead({runs: [runAt(RUN, 8), runAt(RUN_B, 3), runAt('run:01ARZ3NDEKTSV4RRFFQ69G5FAD', 5), runAt('run:01ARZ3NDEKTSV4RRFFQ69G5FAC', 10)]}))
    await atlasDevs.keepShownWorks()
    assert.deepEqual(asked.splice(0), [['factory', 'work-show-read', RUN], ['field', 'work-show', RUN, 8], ['factory', 'work-show-read', RUN_B], ['field', 'work-show', RUN_B, 3]],
      'Factory’s reading as it stands goes to the field, for your works alone; a Run this window does not locate is not its to answer for')
    // read again before the field has heard: nothing is asked twice
    await atlasDevs.keepShownWorks()
    assert.deepEqual(asked.splice(0), [])
    // the field heard: both answer, at the newer reading; nothing more is asked
    store.publishField(model.heldFieldOf({...SNAPSHOT, ...withWorks(workRow('world:me', RUN, 'live', 8, {answering: true}), workRow('world:me', RUN_B, 'live', 3, {answering: true}))}))
    await atlasDevs.keepShownWorks()
    assert.deepEqual(asked.splice(0), [])
    // the connection was made again: the work answers no more, and is shown again
    store.publishField(model.heldFieldOf({...SNAPSHOT, ...withWorks(workRow('world:me', RUN, 'live', 8, {answering: false}))}))
    await atlasDevs.keepShownWorks()
    assert.deepEqual(asked.splice(0), [['factory', 'work-show-read', RUN], ['field', 'work-show', RUN, 8]])
    // forward only: Factory reading the Run older than the one shown sends the field nothing
    store.publishField(model.heldFieldOf({...SNAPSHOT, ...withWorks(workRow('world:me', RUN, 'live', 9, {answering: false}))}))
    await atlasDevs.keepShownWorks()
    assert.deepEqual(asked.splice(0), [['factory', 'work-show-read', RUN]])
    // a field whose service keeps no answers: shown again only as the Run moves
    store.publishField(model.heldFieldOf({...SNAPSHOT, ...withWorks(workRow('world:me', RUN, 'live', 8))}))
    await atlasDevs.keepShownWorks()
    assert.deepEqual(asked.splice(0), [])
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
  }
})

// ── round 31b: your world into the field, a part of it shown at the reach you choose, and withdrawn (SF01, SF02, SF14) ──────────────
// Link puts your world into the field with your own body (the record every viewer draws the same planet from, and nothing beside it);
// Show opens a clearing for a part of your world, to the field, the public or the worlds at a star; Withdraw puts a clearing back under
// cloud, and Unlink your world out of the field, leaving everything in it as it was. What another world withdrew reads as withdrawn, in
// words, never as what it was. By the hold law (manual §16.10; DLW build ruling 2026-11-06) Link and Show raise your world's reach and
// are held; Unlink and Withdraw narrow it and are pressed; only the person's own press does any of them.
const YOUR_BODY = {...bodyOf(YOURS), seed: 11}
const fieldOf = snapshot => model.heldFieldOf(snapshot)
const withoutMe = rows => rows.filter(row => row.world_ref !== 'world:me')
const OUT_OF_FIELD = {...SNAPSHOT, worlds: withoutMe(SNAPSHOT.worlds), clearings: withoutMe(SNAPSHOT.clearings), gatherings: withoutMe(SNAPSHOT.gatherings)}
const UNLINKED = {...SNAPSHOT, worlds: SNAPSHOT.worlds.map(row => (row.world_ref === 'world:me' ? {...row, linked: false} : row))}
const PLACE = {id: 'place:the-study', kind: 'place', label: 'The study', at: {lat: 22, lon: 10}}
const NONCE = Date.UTC(2026, 10, 6, 9)
const yourAsk = (snapshot, act) => model.yourRequest(fieldOf(snapshot), YOURS, act, NONCE)
const resetYours = () => store.chooseStarHand({star: null, to: null, worldName: '', showPart: null, showTo: null, shownPart: null})
const readingWith = () => ({...YOURS_READING(), body: {state: {state: 'read', reading: {space: {ref: 'central:wiki:root', revision: 3, title: 'Root'}}, record: YOUR_BODY}, choice: 'own'},
  locations: {rows: [{id: 'place:the-study', name: 'The study', lat: 22, lon: 10, kind: 'place'}, {id: 'world:central:project:river', name: 'river', lat: -30, lon: -6, kind: 'place', written: true}]}})

test('Link puts your world into the field with your own body under the name you give it, and Unlink takes it out leaving everything as it was (SF01, SF14)', () => {
  // not in the field yet: named first, then put with your own body, linked
  assert.match(yourAsk(OUT_OF_FIELD, {act: 'link', name: '  ', body: YOUR_BODY}).refusal, /Name your world as the field will show it first/)
  assert.match(yourAsk(OUT_OF_FIELD, {act: 'link', name: 'x'.repeat(61), body: YOUR_BODY}).refusal, /at most 60 characters/)
  assert.match(yourAsk(OUT_OF_FIELD, {act: 'link', name: 'Teraphim', body: null}).refusal, /Your own body is not read yet/)
  assert.match(yourAsk(OUT_OF_FIELD, {act: 'link', name: 'Teraphim', body: bodyOf('body:someone-else')}).refusal, /Your own body is not read yet/)
  const put = yourAsk(OUT_OF_FIELD, {act: 'link', name: 'Teraphim’s World', body: {...YOUR_BODY, notes: 'my private notes'}})
  assert.ok('request' in put, JSON.stringify(put))
  assert.match(put.request.world_ref, /^world:[a-z0-9]+:teraphim-s-world$/, 'a new world is named in the field from the name you give it, once')
  assert.deepEqual({...put.request, world_ref: undefined}, {kind: 'world-put', world_ref: undefined, body: YOUR_BODY, linked: true},
    'your own body, exactly the record the field draws it from: nothing rides along with it')
  // in the field and unlinked: Link takes it back in under the name it has, as your body stands now
  assert.deepEqual(yourAsk(UNLINKED, {act: 'link', name: '', body: YOUR_BODY}), {request: {kind: 'world-put', world_ref: 'world:me', body: YOUR_BODY, linked: true}})
  assert.match(yourAsk(UNLINKED, {act: 'unlink'}).refusal, /Your world is not in the field/)
  // linked: Link has nothing to do; Unlink takes it out with its body as the field holds it, so nothing else changes
  assert.match(yourAsk(SNAPSHOT, {act: 'link', name: '', body: YOUR_BODY}).refusal, /Your world is in the field already/)
  assert.deepEqual(yourAsk(SNAPSHOT, {act: 'unlink'}), {request: {kind: 'world-put', world_ref: 'world:me', body: bodyOf(YOURS), linked: false}})
  assert.match(yourAsk(OUT_OF_FIELD, {act: 'unlink'}).refusal, /Your world is not in the field/)
  // the field's own words while it is not read
  assert.equal(model.yourRequest({state: 'reading'}, YOURS, {act: 'unlink'}, NONCE).refusal, 'The shared field is being read.')
  assert.equal(model.yourRequest({state: 'unavailable', reason: 'Not here.'}, YOURS, {act: 'link', name: 'T', body: YOUR_BODY}, NONCE).refusal, 'Not here.')
})

test('Show opens a clearing for a part of your world at the reach you choose: the field, the public or the worlds at the chosen star (SF02)', () => {
  const show = (to, star = null, part = PLACE, snapshot = SNAPSHOT) => yourAsk(snapshot, {act: 'show', part, to, star})
  const shown = {kind: 'place', label: 'The study', at: {lat: 22, lon: 10}}
  assert.deepEqual(show('field'), {request: {kind: 'clearing-open', world_ref: 'world:me', part_ref: 'place:the-study', audience: 'field', shown}})
  assert.deepEqual(show('public'), {request: {kind: 'clearing-open', world_ref: 'world:me', part_ref: 'place:the-study', audience: 'public', shown}})
  assert.deepEqual(show('star', 'star:rosarium'), {request: {kind: 'clearing-open', world_ref: 'world:me', part_ref: 'place:the-study', audience: 'star', star_ref: 'star:rosarium', shown}})
  assert.match(show('star', null).refusal, /Choose a star first/)
  assert.match(show('star', 'star:far').refusal, /only while it is gathered there/)
  assert.match(show(null).refusal, /Choose who sees it first/)
  assert.match(show('field', null, null).refusal, /Choose a part of your world to show first/)
  assert.match(show('field', null, PLACE, UNLINKED).refusal, /Link your world into the field before you show anything/)
  assert.match(show('field', null, PLACE, OUT_OF_FIELD).refusal, /Link your world into the field before you show anything/)
  // shown so already: nothing to do; shown wider, it is asked again
  const already = {...SNAPSHOT, clearings: [...SNAPSHOT.clearings, c('world:me', 'place:the-study', 'field', 'The study')]}
  assert.match(show('field', null, PLACE, already).refusal, /shown so already/)
  assert.ok('request' in show('public', null, PLACE, already))
  // a world of yours that lands on your planet is shown as the project it is
  assert.equal(show('field', null, {id: 'world:central:project:river', kind: 'project', label: 'river', at: {lat: -30, lon: -6}}).request.shown.kind, 'project')
  // a name the field would refuse is refused here, in words
  assert.match(show('field', null, {...PLACE, label: 'x'.repeat(161)}).refusal, /at most 160 characters/)
})

test('Withdraw puts a part you show back under cloud everywhere at once, and Load reads how much of your world you show (SF14, SF01)', () => {
  const yours = model.yourShown(fieldOf(SNAPSHOT), YOURS)
  assert.deepEqual(yours.map(row => [row.label, row.reach, row.star]), [['A reading of the fourth plate', 'public', null], ['Rosarium notes', 'field', null], ['For the circle', 'star', 'star:rosarium']],
    'what your world shows, and to whom: nobody else’s')
  assert.deepEqual(yourAsk(SNAPSHOT, {act: 'withdraw', shown: yours[1].id}), {request: {kind: 'clearing-withdraw', world_ref: 'world:me', part_ref: 'place:rosarium-notes'}})
  assert.deepEqual(yourAsk(SNAPSHOT, {act: 'withdraw', shown: yours[2].id}), {request: {kind: 'clearing-withdraw', world_ref: 'world:me', part_ref: 'page:for-the-circle', star_ref: 'star:rosarium'}})
  assert.match(yourAsk(SNAPSHOT, {act: 'withdraw', shown: null}).refusal, /Choose something your world shows first/)
  assert.match(yourAsk(SNAPSHOT, {act: 'withdraw', shown: model.shownKey('page:maras-plate', null)}).refusal, /That is no longer shown/)
  assert.equal(model.shownLoad(yours), '1 to the public, 1 to the field, 1 at a star')
  assert.equal(model.shownLoad([]), 'nothing: all of it is under cloud')
})

const AT_W = Date.UTC(2026, 10, 6, 9, 5) * 1000
const WITHDRAWN = {...SNAPSHOT, world_withdrawal: {state: 'held'}, world_withdrawals: [
  {world_ref: 'world:mara', star_ref: null, reach: 'field', kind: 'page', withdrawn_at_micros: String(AT_W)},
  {world_ref: 'world:mara', star_ref: 'star:rosarium', reach: 'star', kind: 'page', withdrawn_at_micros: String(AT_W + 1000)},
  {world_ref: 'world:gone', star_ref: null, reach: 'world', withdrawn_at_micros: String(AT_W + 2000)},
  {world_ref: 'world:me', star_ref: null, reach: 'public', kind: 'place', withdrawn_at_micros: String(AT_W + 3000)},
]}

test('what another world withdrew reads as withdrawn there, in words, never silently gone and never as what it was (SF14)', () => {
  const field = fieldOf(WITHDRAWN)
  assert.equal(field.withdrawals.length, 4)
  const scene = model.fieldScene(field, {aperture: 'federated', viewAs: 'me'}, YOURS)
  const mara = scene.worlds.find(row => row.ref === 'world:mara')
  assert.deepEqual(mara.withdrawn.map(model.withdrawnLine), ['mara withdrew a page from the field'])
  assert.equal(mara.withdrawn[0].at, AT_W / 1000, 'and says when')
  assert.deepEqual(scene.stars.find(star => star.ref === 'star:rosarium').withdrawn.map(model.withdrawnLine), ['mara took back a page shown here'])
  assert.deepEqual(scene.left.map(model.withdrawnLine), ['gone’s world left the field: what it showed is back under cloud'])
  assert.deepEqual(scene.worlds.find(row => row.ref === 'world:me').withdrawn, [], 'what you withdrew yourself is not read as another’s')
  // at World and Local your own worlds alone stand: nothing another world withdrew is read there
  for (const aperture of ['world', 'local']) assert.deepEqual(model.fieldScene(field, {aperture, viewAs: 'me'}, YOURS).left, [])
  // the reading names whose, what kind, from what reach and when: never which part, nor what it showed
  assert.ok(!JSON.stringify(scene.left.concat(mara.withdrawn)).includes('part'), 'no part is named')
  // a service that keeps no withdrawals says so, and reads as it always did
  const none = fieldOf(SNAPSHOT)
  assert.equal(none.withdrawals, null)
  assert.match(none.withdrawWhy, /does not keep what a world withdrew/)
  assert.deepEqual(model.fieldScene(none, {aperture: 'federated', viewAs: 'me'}, YOURS).left, [])
})

// FIXTURE: the field read whole (Federated), keeping what the worlds withdrew; Mara shows a page to the public, one to the field and one at
// a star lit by the stranger, where my world and hers are gathered.
const KEPT = {...SNAPSHOT, world_scope: 'whole', world_withdrawal: {state: 'held'}, world_withdrawals: [],
  clearings: [...SNAPSHOT.clearings, c('world:mara', 'page:maras-field', 'field', 'Mara’s field page'), c('world:mara', 'page:maras-circle', 'star', 'For the circle of three', 'star:circle')],
  stars: [...SNAPSHOT.stars, {star_ref: 'star:circle', name: 'Circle', gathers: 'Three worlds', comes: 'anyone', lit_by: 'world:stranger', mine: false}],
  gatherings: [...SNAPSHOT.gatherings, ...['world:me', 'world:mara', 'world:stranger'].map(world_ref => ({star_ref: 'star:circle', world_ref, state: 'gathered', asked_at_micros: '8', gathered_at_micros: '8'}))]}
const withoutPart = (snapshot, part) => ({...snapshot, clearings: snapshot.clearings.filter(row => row.part_ref !== part)})
const withRecord = (snapshot, record) => ({...snapshot, world_withdrawals: [...snapshot.world_withdrawals, {star_ref: null, kind: 'page', withdrawn_at_micros: String(AT_W + 9000), ...record}]})
const GONE_LINE = 'mara’s page you read is no longer shown here: why is older than the field keeps'

test('a part you read that is no longer shown here, with nothing the field still keeps to say why, reads so in words: older than the field keeps, never silently gone and never a made-up reason (SF14)', () => {
  const first = model.readParts(null, fieldOf(KEPT))
  assert.deepEqual(first.gone, [], 'nothing is gone on a first reading')
  const after = (snapshot, from = first) => model.readParts(from, fieldOf(snapshot)).gone
  // withdrawn with a record the field keeps: read as withdrawn, so not also as gone
  assert.deepEqual(after(withRecord(withoutPart(KEPT, 'page:maras-plate'), {world_ref: 'world:mara', reach: 'public'})), [])
  assert.deepEqual(after(withRecord(withoutPart(KEPT, 'page:maras-circle'), {world_ref: 'world:mara', reach: 'star', star_ref: 'star:circle'})), [])
  // its record older than the field keeps (past the last 64 a world's withdrawals keep): no longer shown here, in words, naming whose
  // and what kind, never which part nor what it showed
  const gone = after(withoutPart(KEPT, 'page:maras-plate'))
  assert.deepEqual(gone, [{world_ref: 'world:mara', star_ref: null, reach: 'public', kind: 'page'}])
  assert.deepEqual(gone.map(model.goneLine), [GONE_LINE])
  assert.ok(!/maras-plate|Mara’s plate/.test(JSON.stringify(gone)), 'no part is named')
  // a record the field kept before the part went does not say why it went; nor does one of another reach or kind
  const before = model.readParts(null, fieldOf(withRecord(KEPT, {world_ref: 'world:mara', reach: 'public'})))
  assert.equal(after(withRecord(withoutPart(KEPT, 'page:maras-plate'), {world_ref: 'world:mara', reach: 'public'}), before).length, 1)
  assert.equal(after(withRecord(withoutPart(KEPT, 'page:maras-plate'), {world_ref: 'world:mara', reach: 'field'})).length, 1)
  assert.equal(after(withRecord(withoutPart(KEPT, 'page:maras-plate'), {world_ref: 'world:mara', reach: 'public', kind: 'place'})).length, 1)
  // a world that left the field: read as having left while the field keeps that; past it, each part you read of it is no longer shown here
  const marasGone = {...KEPT, worlds: KEPT.worlds.filter(row => row.world_ref !== 'world:mara'), clearings: KEPT.clearings.filter(row => row.world_ref !== 'world:mara')}
  assert.deepEqual(after(withRecord(marasGone, {world_ref: 'world:mara', reach: 'world', kind: null})), [])
  assert.deepEqual(after(marasGone).map(model.goneLine), [GONE_LINE, GONE_LINE, GONE_LINE])
  // what is gone stays said on the readings after, and goes when the part is shown again
  const still = model.readParts(model.readParts(first, fieldOf(withoutPart(KEPT, 'page:maras-plate'))), fieldOf(withoutPart(KEPT, 'page:maras-plate')))
  assert.equal(still.gone.length, 1)
  assert.deepEqual(model.readParts(still, fieldOf(KEPT)).gone, [])
  // out of your view is not gone: the window read another scope, your world left the field, left the star, or another world left your
  // circle; a star that closed is gone itself; nor does a service that keeps no withdrawals say why anything went
  assert.deepEqual(after({...withoutPart(KEPT, 'page:maras-plate'), world_scope: 'circle'}), [])
  const unlinked = {...withoutPart(withoutPart(KEPT, 'page:maras-field'), 'page:maras-circle'), worlds: KEPT.worlds.map(row => (row.mine ? {...row, linked: false} : row))}
  assert.deepEqual(after(unlinked), [])
  assert.deepEqual(after({...withoutPart(KEPT, 'page:maras-circle'), gatherings: KEPT.gatherings.filter(row => !(row.star_ref === 'star:circle' && row.world_ref === 'world:me'))}), [])
  assert.deepEqual(after({...withoutPart(KEPT, 'page:maras-circle'), stars: KEPT.stars.filter(row => row.star_ref !== 'star:circle')}), [])
  const circle = {...KEPT, world_scope: 'circle'}
  const away = {...circle, clearings: circle.clearings.filter(row => row.world_ref !== 'world:mara'), gatherings: circle.gatherings.filter(row => row.world_ref !== 'world:mara')}
  assert.deepEqual(model.readParts(model.readParts(null, fieldOf(circle)), fieldOf(away)).gone, [])
  assert.deepEqual(after({...withoutPart(KEPT, 'page:maras-plate'), world_withdrawal: {state: 'unavailable'}}), [])
  // your own parts are yours to know: never read as gone
  assert.deepEqual(after(withoutPart(KEPT, 'page:reading-of-plate-4')), [])
  // the scene reads it at Shared and Federated, with what was withdrawn; at World and Local your own worlds stand alone
  const field = {...fieldOf(withoutPart(KEPT, 'page:maras-plate')), gone}
  assert.deepEqual(model.fieldScene(field, {aperture: 'federated', viewAs: 'me'}, YOURS).gone.map(model.goneLine), [GONE_LINE])
  for (const aperture of ['world', 'local']) assert.deepEqual(model.fieldScene(field, {aperture, viewAs: 'me'}, YOURS).gone, [])
})

test('the window keeps what it read of others’ parts, and the World’s binding hands on what is no longer shown here (SF14)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  try {
    // the pane's readings publish each reading through what the window keeps
    assert.match(await readFile(new URL('../src/projections/atlas/system/SystemReadings.tsx', import.meta.url), 'utf8'), /publishField\(withGone\(heldFieldOf\(/)
    store.publishField(model.withGone(fieldOf(KEPT)))
    assert.deepEqual(JSON.parse(atlasDevs.atlasGlobeBinding(readingWith()).values.field).gone, [])
    store.publishField(model.withGone(fieldOf(withoutPart(KEPT, 'page:maras-plate'))))
    const read = JSON.parse(atlasDevs.atlasGlobeBinding(readingWith()).values.field)
    assert.deepEqual(read.gone, [{world_ref: 'world:mara', star_ref: null, reach: 'public', kind: 'page'}])
    assert.deepEqual(model.fieldSceneOf(read, {aperture: 'federated', viewAs: 'me'}, YOURS).gone.map(model.goneLine), [GONE_LINE])
    store.publishField(model.withGone({state: 'reading'}))
    store.publishField(model.withGone(fieldOf(withoutPart(KEPT, 'page:maras-plate'))))
    assert.equal(store.heldField().gone.length, 1, 'a reading that was lost and came back keeps what it said')
  } finally {
    store.publishField(fieldOf(SNAPSHOT))
  }
})

test('the World binding links, shows and withdraws from the view’s own hand, and stands each act it cannot do dimmed (SF01, SF02, SF14)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(OUT_OF_FIELD))
  resetYours()
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.values.fieldWorld, undefined, 'your world is not in the field yet')
    assert.match(binding.standing.fieldLink?.disabled ?? '', /Name your world/)
    assert.match(binding.standing.fieldUnlink?.disabled ?? '', /not in the field/)
    assert.match(binding.standing.partShow?.disabled ?? '', /Link your world/)
    assert.deepEqual(JSON.parse(binding.values.yourParts), [{id: 'place:the-study', kind: 'place', label: 'The study'}, {id: 'world:central:project:river', kind: 'project', label: 'river'}],
      'the parts of your world: the places on your body, and the worlds of yours that land on it')
    binding.local.worldName('Teraphim')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.values.worldName, 'Teraphim')
    assert.equal(binding.standing.fieldLink, undefined)
    assert.equal(binding.writes('fieldLink'), true)
    await binding.write([{key: 'fieldLink', value: 1}])
    const put = asked.pop()
    assert.deepEqual([put.kind, put.linked, put.body], ['world-put', true, YOUR_BODY])
    assert.match(put.world_ref, /^world:[a-z0-9]+:teraphim$/)
    assert.equal(store.starHand().worldName, '', 'the name is the world’s once it is in the field')
    // in the field: a part shown at the reach chosen, and one withdrawn
    store.publishField(fieldOf(SNAPSHOT))
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.deepEqual([binding.values.fieldWorld, binding.values.fieldLinked], ['world:me', true])
    assert.match(binding.standing.fieldLink?.disabled ?? '', /in the field already/)
    assert.match(binding.standing.worldName?.disabled ?? '', /stands in the field as me/)
    assert.equal(binding.standing.fieldUnlink, undefined)
    assert.match(binding.standing.partShow?.disabled ?? '', /Choose a part of your world/)
    binding.local.showPart('place:the-study')
    binding.local.showTo('everyone')
    binding.local.showTo('public')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.deepEqual([binding.values.showPart, binding.values.showTo], ['place:the-study', 'public'], 'a reach is the field, the public or a star, nothing else')
    assert.equal(binding.standing.partShow, undefined)
    await binding.write([{key: 'partShow', value: 2}])
    assert.deepEqual(asked.pop(), {kind: 'clearing-open', world_ref: 'world:me', part_ref: 'place:the-study', audience: 'public', shown: {kind: 'place', label: 'The study', at: {lat: 22, lon: 10}}})
    assert.equal(store.starHand().showPart, null, 'what was shown is no longer chosen to show')
    assert.equal(binding.values.shownLoad, '1 to the public, 1 to the field, 1 at a star')
    assert.deepEqual(JSON.parse(binding.values.yourShown).map(row => row.label), ['A reading of the fourth plate', 'Rosarium notes', 'For the circle'])
    assert.match(binding.standing.partWithdraw?.disabled ?? '', /Choose something your world shows/)
    binding.local.shownPart(model.shownKey('place:rosarium-notes', null))
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    await binding.write([{key: 'partWithdraw', value: 3}])
    assert.deepEqual(asked.pop(), {kind: 'clearing-withdraw', world_ref: 'world:me', part_ref: 'place:rosarium-notes'})
    assert.equal(store.starHand().shownPart, null)
    await binding.write([{key: 'fieldUnlink', value: 4}])
    assert.deepEqual(asked.pop(), {kind: 'world-put', world_ref: 'world:me', body: bodyOf(YOURS), linked: false})
    // the field not reached from this window: every act stands dimmed
    store.bindSystemActs(null)
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    for (const key of ['fieldUnlink', 'partWithdraw']) assert.match(binding.standing[key]?.disabled ?? '', /not reached from this window|Choose something/)
    assert.equal(binding.writes('fieldUnlink'), false)
  } finally {
    store.bindSystemActs(null)
    resetYours()
  }
})

test('only the person’s own press links, shows or withdraws: no row an agent sets, no relay and no default does any of it (DLW build ruling 2026-11-06)', async () => {
  const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
  ;(await import('../src/inhabitants/familyManifest.ts')).resetFamilyManifestsForTest()
  ;(await import('../src/inhabitants/worldShellFamilies.ts')).loadWorldShellFamilies()
  const keys = ['fieldLink', 'fieldUnlink', 'partShow', 'partWithdraw', 'worldName', 'showPart', 'showTo', 'shownPart']
  assert.ok(!atlasDevs.ATLAS_DECLARED_ROWS.some(row => keys.includes(row.key)), 'no declared row of the World, which an agent may set, carries them')
  const device = atlasDevs.atlasDevice(inhabitantManifest('atlas-earth').faces.find(face => face.id === 'globe-engine'), readingWith())
  assert.ok(device.rows.length > 0, 'the World stands as a device')
  assert.ok(!device.rows.some(row => keys.includes(row.key)))
  for (const key of ['fieldLink', 'partShow']) await assert.rejects(device.submit([{key, value: 1}]), /no owner write path/)
  // no relay and no default: your world out of the field with a name, a part and a reach in the hand; reading the binding, keeping the
  // works your world shows and relaying a revocation send the field nothing
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(OUT_OF_FIELD))
  store.chooseStarHand({worldName: 'Teraphim', showPart: 'place:the-study', showTo: 'public'})
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' },
    factory: async () => ({})})
  try {
    atlasDevs.atlasGlobeBinding(readingWith())
    await atlasDevs.keepShownWorks()
    await atlasDevs.relayRevoked()
    assert.deepEqual(asked, [], 'nothing links, shows or withdraws but the press')
  } finally {
    store.bindSystemActs(null)
    resetYours()
  }
  // the hand starts with no name, no part and no reach: nothing is shown by default
  const source = await readFile(new URL('../src/projections/atlas/system/systemStore.ts', import.meta.url), 'utf8')
  assert.match(source, /worldName: '', showPart: null, showTo: null, shownPart: null/)
})

test('the face links and shows by a hold, and unlinks and withdraws by a press; what others withdrew reads there in words (manual §16.10; SF01, SF02, SF14)', () => {
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  const page = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}}))
  const held = label => new RegExp(`data-hold="true"[^>]*><i[^>]*></i>${label}<`).test(page)
  const unheld = label => new RegExp(`class="dp-action"(?: disabled="")?>${label}<`).test(page)
  assert.match(page, />Shown</, 'the World has a page for what your world shows')
  // what raises your world's reach is held: Link brings it among the others, Show opens a clearing others then see
  for (const label of ['Link', 'Show']) assert.ok(held(label), `${label} is held`)
  // what narrows it is pressed: Unlink takes your world out, Withdraw puts a clearing back under cloud
  for (const label of ['Unlink', 'Withdraw']) assert.ok(unheld(label), `${label} is pressed, not held`)
  assert.match(page, /Hold to link your world/)
  assert.match(page, /Hold to show it/)
  assert.match(page, /1 to the public, 1 to the field, 1 at a star/, 'Load reads how much of your world you show')
  assert.match(page, /mara withdrew a page from the field/, 'what another world withdrew reads in words')
  assert.match(page, /left the field: what it showed is back under cloud/)
  assert.match(page, /heron’s page you read is no longer shown here: why is older than the field keeps/, 'and a part read that went past what the field keeps')
  assert.match(page, />heron’s page: no longer shown here<[^]*?>older than kept</, 'said on its row, marked older than the field keeps')
})

// ── round 33: every line of the Withdrawn section whole, and the little map's names clear of one another (DLW build ruling 2026-11-06) ──
//
// A line of the Withdrawn section never ends in an ellipsis: a world that left the field says so in the short form a part no longer
// shown here uses, its time beside it, and the whole sentence stays the row's name to a reader. On the World's little map no name is
// drawn over another, over a world or a star, over the count in its corner or over the note below; a crowded field leaves out a name
// that has no room rather than overprint it.

/** The Withdrawn section's rows as drawn: the name shown, the mark beside it and the sentence a reader is given. */
const withdrawnRowsOf = page => {
  const section = page.slice(page.indexOf('>Withdrawn<'))
  const list = section.slice(0, section.indexOf('</ul>'))
  return [...list.matchAll(/<li class="dp-row"[^>]*>([^]*?)<\/li>/g)].map(([, row]) => ({
    name: row.match(/<span class="dp-row-name"[^>]*>([^<]*)</)?.[1] ?? '',
    note: row.match(/<span class="dp-row-note">([^<]*)</)?.[1] ?? '',
    said: row.match(/<span class="dp-row-said">([^<]*)</)?.[1] ?? null,
  }))
}
/** The most a row of the Withdrawn section holds whole at its 276 px, name and mark together: the gone row as the r32 capture drew it
 * ("heron’s page: no longer shown here" beside "older than kept"), the longest that stood without an ellipsis. */
const WITHDRAWN_LINE_ROOM = 49

test('every line of the Withdrawn section stands whole beside its mark, and a world that left the field says so short, the whole sentence its name to a reader (SF14; DLW build ruling 2026-11-06)', () => {
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  const rows = withdrawnRowsOf(renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}})))
  assert.equal(rows.length, 4)
  for (const row of rows) assert.ok(row.name.length + row.note.length <= WITHDRAWN_LINE_ROOM, `“${row.name}” beside “${row.note}” is cut off`)
  const left = rows.find(row => row.name.startsWith('heron’s world'))
  assert.equal(left?.name, 'heron’s world: left the field', 'the short form, as a part no longer shown here has')
  assert.match(left.note, /^\d\d:\d\d$/, 'its time beside it, as every withdrawal has')
  assert.equal(left.said, 'heron’s world left the field: what it showed is back under cloud', 'the whole sentence is the row’s name to a reader')
  assert.equal(rows[0].said, 'heron’s page you read is no longer shown here: why is older than the field keeps')
  for (const row of rows.filter(row => row.said === null)) assert.ok(row.name.length + row.note.length <= WITHDRAWN_LINE_ROOM)
  // the reading itself keeps the whole sentence
  assert.equal(model.withdrawnLine({world_ref: 'world:heron', star_ref: null, reach: 'world', kind: null}), 'heron’s world left the field: what it showed is back under cloud')
  assert.equal(model.withdrawnName({world_ref: 'world:heron', star_ref: null, reach: 'world', kind: null}), 'heron’s world: left the field')
})

/** The little map's marks and names as drawn: each name's box (its letters at half its size wide, the least a letter takes), each world's
 * and star's mark, the corner's count and the note below. */
const fieldMapOf = page => {
  const at = page.indexOf('aria-label="The field"')
  const svg = page.slice(page.lastIndexOf('<svg', at), page.indexOf('</svg>', at))
  const [w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number)
  const corner = page.slice(page.indexOf('</svg>', at)).match(/^<\/svg><span class="dp-display-corner">([^<]*)</)?.[1] ?? ''
  const box = (x0, y0, x1, y1, what) => ({x0, y0, x1, y1, what})
  const marks = [
    ...[...svg.matchAll(/<g><circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(([, x, y, r]) => box(+x - +r, +y - +r, +x + +r, +y + +r, `world at ${Math.round(x)},${Math.round(y)}`)),
    ...[...svg.matchAll(/<path d="M([\d.]+) ([\d.]+)L[^"]*" fill="var\(--dp-on\)"/g)].map(([, x, top]) => box(+x - 4, +top, +x + 4, +top + 8, `star at ${Math.round(x)},${Math.round(+top + 4)}`)),
    box(w - 5 - corner.length * 0.5 * 9.5, 3, w - 5, 15, `corner’s count, ${corner}`),
  ]
  const note = svg.match(/<text x="5" y="([\d.]+)" class="dp-axis">([^<]*)</)
  if (note) marks.push(box(5, +note[1] - 6, 5 + note[2].length * 0.5 * 8, +note[1] + 2, 'the note'))
  const names = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(start|middle|end)" class="dp-ink-dim" style="font-size:([\d.]+)px">([^<]*)</g)]
    .map(([, x, y, anchor, font, text]) => {
      const width = text.length * 0.5 * +font, left = anchor === 'start' ? +x : anchor === 'end' ? +x - width : +x - width / 2
      return {...box(left, +y - 0.75 * +font, left + width, +y + 0.2 * +font, `“${text}”`), text}
    })
  return {w, h, marks, names}
}
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const clashes = ({w, marks, names}) => names.flatMap((name, i) => [
  ...(name.x0 < 0 || name.x1 > w ? [`${name.what} runs off the map`] : []),
  ...names.slice(i + 1).filter(other => overlap(name, other)).map(other => `${name.what} over ${other.what}`),
  ...marks.filter(mark => overlap(name, mark)).map(mark => `${name.what} over the ${mark.what}`)])

test('the little map draws no name over another, over a world or a star, over its corner’s count or its note; a crowded field leaves a name out rather than overprint it (manual §17.2; DLW build ruling 2026-11-06)', () => {
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  const map = fieldMapOf(renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}})))
  assert.deepEqual(clashes(map), [])
  assert.deepEqual(map.names.map(name => name.text).sort(), ['Far', 'The Rosarium plates', 'mara', 'o-i', 'stranger', 'teraphim'], 'with room for each, each is named')
  // a crowded field: twelve other worlds and five stars with long names, in the same little map
  const field = JSON.parse(v.field)
  const crowded = {...field,
    worlds: [...field.worlds, ...Array.from({length: 12}, (_, i) => ({world_ref: `world:neighbour-${i}`, body: {body_ref: `body:n${i}`}, linked: true, mine: false}))],
    stars: [...field.stars, ...Array.from({length: 5}, (_, i) => ({star_ref: `star:s${i}`, name: `A star with a long name ${i}`, gathers: 'x', comes: 'anyone', lit_by: 'world:mara', mine: false}))]}
  const full = fieldMapOf(renderToStaticMarkup(world.whole({v: {...v, field: JSON.stringify(crowded)}, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}})))
  assert.deepEqual(clashes(full), [])
  assert.ok(full.names.length < 6 + 12 + 5, 'some names had no room and are left out')
  assert.ok(full.names.length >= 6, 'and those with room are named')
})

test('no world or star on the little map stands under its corner’s count or its note, however many the field holds (manual §17.2; DLW build ruling 2026-11-06)', () => {
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  const field = JSON.parse(v.field)
  const words = map => map.marks.filter(mark => mark.what.startsWith('corner') || mark.what === 'the note')
  const under = map => map.marks.filter(mark => mark.what.startsWith('world') || mark.what.startsWith('star'))
    .flatMap(mark => words(map).filter(word => overlap(mark, word)).map(word => `${mark.what} under the ${word.what}`))
  for (const more of [0, 3, 7, 12, 16, 20]) for (const stars of [0, 2, 5, 8]) {
    const crowded = {...field,
      worlds: [...field.worlds, ...Array.from({length: more}, (_, i) => ({world_ref: `world:neighbour-${i}`, body: {body_ref: `body:n${i}`}, linked: true, mine: false}))],
      stars: [...field.stars, ...Array.from({length: stars}, (_, i) => ({star_ref: `star:s${i}`, name: `A star with a long name ${i}`, gathers: 'x', comes: 'anyone', lit_by: 'world:mara', mine: false}))]}
    const map = fieldMapOf(renderToStaticMarkup(world.whole({v: {...v, field: JSON.stringify(crowded)}, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}})))
    assert.equal(words(map).length, 2, 'the map has its count and its note')
    assert.deepEqual(under(map), [], `${more} more worlds and ${stars} more stars`)
    assert.deepEqual(clashes(map), [], `and no name clashes, ${more} more worlds and ${stars} more stars`)
  }
})

// ── round 33: a contribution to what another world shows (SF07; manual §17.2 "Contribute") ─────────────────────────────────────────
// A question, a finding, a correction or a reproduction, contributed to a part another world shows or to a contribution there. It stands
// on its target under your world's name and waits for that world's owner; it becomes part of their world only when they accept it there,
// and their refusal reaches you with their words. Contribute sends your words into another's world, Accept makes another's stand in
// yours and Refuse sends your words to its contributor, so each is held; Take back narrows and is pressed (manual §16.10; DLW build
// ruling 2026-11-06). Only the person's own press does any of them.
const k = (ref, from, into, to, what, words, state, answer) => ({contribution_ref: ref, world_ref: into, from_world_ref: from, to, what, words, state, at_micros: '9',
  ...(answer ? {answer: {words: answer, at_micros: '10'}} : {})})
const MY_PAGE = {world_ref: 'world:me', part_ref: 'page:reading-of-plate-4', star_ref: null}, MARAS_PAGE = {world_ref: 'world:mara', part_ref: 'page:maras-plate', star_ref: null}
const CONTRIBUTED = {...SNAPSHOT, world_contribution: {state: 'held'}, world_contributions: [
  k('contribution:mara-asks', 'world:mara', 'world:me', MY_PAGE, 'question', 'Which rose is the fourth?', 'waiting'),
  k('contribution:me-asks', 'world:me', 'world:mara', MARAS_PAGE, 'question', 'Where is the white rose?', 'accepted', 'Here, on the left.'),
  k('contribution:me-finds', 'world:me', 'world:mara', MARAS_PAGE, 'finding', 'The plate is the sixth.', 'refused', 'It is the fourth.'),
  k('contribution:stranger-threads', 'world:stranger', 'world:mara', {contribution_ref: 'contribution:me-asks'}, 'reproduction', 'I found it there too.', 'accepted'),
  {contribution_ref: 'contribution:wordless', world_ref: 'world:me', from_world_ref: 'world:mara', to: MY_PAGE, what: 'question', state: 'waiting'},
]}
const contributeAsk = (snapshot, act) => atlasDevs.contributionRequest(fieldOf(snapshot), YOURS, act, NONCE)
const MARAS_PAGE_ID = JSON.stringify(['world:mara', 'page:maras-plate', ''])

test('contributions read as who contributed what to what, waiting, accepted or refused, the owner’s words under your own; a service without says so (SF07)', () => {
  const field = fieldOf(CONTRIBUTED)
  assert.deepEqual(field.contributions.map(row => [row.contribution_ref, row.state, row.answer]), [['contribution:mara-asks', 'waiting', null], ['contribution:me-asks', 'accepted', 'Here, on the left.'],
    ['contribution:me-finds', 'refused', 'It is the fourth.'], ['contribution:stranger-threads', 'accepted', null]], 'a row that is not the contract’s is left out, never mended')
  assert.deepEqual(field.contributions[3].to, {contribution_ref: 'contribution:me-asks'}, 'a contribution to a contribution threads under it')
  const none = fieldOf(SNAPSHOT)
  assert.deepEqual([none.contributions, none.contributeWhy], [null, 'This field’s service does not keep contributions to a world yet.'])
  assert.equal(contributeAsk(SNAPSHOT, {act: 'contribute', to: MARAS_PAGE_ID, what: 'question', words: 'Hello'}).refusal, 'This field’s service does not keep contributions to a world yet.')
  const lines = atlasDevs.contributionRows(field).map(row => [row.name, row.note])
  assert.deepEqual(lines, [['mara’s question on A reading of the fourth plate', 'waits for you'], ['your question on Mara’s plate', 'accepted'], ['your finding on Mara’s plate', 'refused'],
    ['stranger’s reproduction under your question', 'accepted']])
  assert.match(atlasDevs.contributionRows(field)[2].does, /It is the fourth\./, 'a refusal reads with its owner’s words')
})

test('contributing is asked of the field for your own world, to what another world shows or a contribution there; accepting, refusing and taking back each refuse in words (SF07)', () => {
  const field = fieldOf(CONTRIBUTED)
  assert.deepEqual(atlasDevs.contributionTargets(field).map(row => row.id), [JSON.stringify(['world:mara', 'page:maras-plate', '']), JSON.stringify(['world:stranger', 'page:elsewhere', '']),
    'contribution:me-asks', 'contribution:stranger-threads'], 'what another world shows and the contributions that stand there; never your own world, nor what was refused')
  assert.deepEqual(atlasDevs.contributionTargets(field).map(row => row.label), ['Mara’s plate · mara', 'Elsewhere · stranger', 'your question on Mara’s plate',
    'stranger’s reproduction under your question'], 'named as the World names a part, then whose world; a contribution as its line reads (DLW build ruling 2026-11-06)')
  const made = contributeAsk(CONTRIBUTED, {act: 'contribute', to: MARAS_PAGE_ID, what: 'correction', words: '  The rose is white.  '})
  assert.match(made.request.contribution_ref, /^contribution:[a-z0-9]+:me$/)
  assert.deepEqual({...made.request, contribution_ref: 'x'}, {kind: 'world-contribute', contribution_ref: 'x', world_ref: 'world:me', to: {world_ref: 'world:mara', part_ref: 'page:maras-plate'}, what: 'correction', words: 'The rose is white.'})
  assert.deepEqual(contributeAsk(CONTRIBUTED, {act: 'contribute', to: 'contribution:me-asks', what: 'finding', words: 'And the red.'}).request.to, {contribution_ref: 'contribution:me-asks'})
  const refusal = act => contributeAsk(CONTRIBUTED, act).refusal
  assert.equal(refusal({act: 'contribute', to: null, what: 'question', words: 'x'}), 'Choose what to contribute to first: something another world shows, or a contribution there.')
  assert.equal(refusal({act: 'contribute', to: JSON.stringify(['world:me', 'page:reading-of-plate-4', '']), what: 'question', words: 'x'}), 'That is no longer there to contribute to.', 'never your own world')
  assert.equal(refusal({act: 'contribute', to: MARAS_PAGE_ID, what: 'praise', words: 'x'}), 'Choose what it is: a question, a finding, a correction or a reproduction.')
  assert.equal(refusal({act: 'contribute', to: MARAS_PAGE_ID, what: 'question', words: '   '}), 'Say something first.')
  assert.equal(contributeAsk({...CONTRIBUTED, worlds: withoutMe(CONTRIBUTED.worlds)}, {act: 'contribute', to: MARAS_PAGE_ID, what: 'question', words: 'x'}).refusal,
    'Link your world into the field before you contribute to another.')
  assert.deepEqual(contributeAsk(CONTRIBUTED, {act: 'accept', contribution: 'contribution:mara-asks', words: ''}).request, {kind: 'world-contribution-accept', contribution_ref: 'contribution:mara-asks'})
  assert.deepEqual(contributeAsk(CONTRIBUTED, {act: 'accept', contribution: 'contribution:mara-asks', words: 'Thank you'}).request.words, 'Thank you')
  assert.equal(refusal({act: 'refuse', contribution: 'contribution:mara-asks', words: ' '}), 'Say why, in your own words.')
  assert.deepEqual(contributeAsk(CONTRIBUTED, {act: 'refuse', contribution: 'contribution:mara-asks', words: 'Not here.'}).request, {kind: 'world-contribution-refuse', contribution_ref: 'contribution:mara-asks', words: 'Not here.'})
  assert.equal(refusal({act: 'accept', contribution: 'contribution:me-asks', words: ''}), 'Only the owner of the world it was contributed to answers it.')
  assert.equal(refusal({act: 'accept', contribution: null, words: ''}), 'Choose a contribution first.')
  assert.deepEqual(contributeAsk(CONTRIBUTED, {act: 'take-back', contribution: 'contribution:me-finds'}).request, {kind: 'world-contribution-take-back', contribution_ref: 'contribution:me-finds'})
  assert.equal(refusal({act: 'take-back', contribution: 'contribution:mara-asks'}), 'Only the one who contributed it takes it back.')
  assert.equal(atlasDevs.contributionRequest({state: 'reading'}, YOURS, {act: 'take-back', contribution: 'contribution:me-finds'}, NONCE).refusal, 'The shared field is being read.')
})

const resetContributing = () => store.chooseStarHand({contributeTo: null, contributeWhat: 'question', contributeWords: '', contribution: null, answerWords: ''})

test('the World binding contributes, accepts, refuses and takes back from the view’s own hand, and stands each act it cannot do dimmed (SF07)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(CONTRIBUTED))
  resetContributing()
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(JSON.parse(binding.values.contributeTargets).length, 4)
    assert.match(binding.standing.contribute?.disabled ?? '', /Choose what to contribute to first/)
    assert.match(binding.standing.contributionAccept?.disabled ?? '', /Choose a contribution first/)
    binding.local.contributeTo(MARAS_PAGE_ID)
    binding.local.contributeWhat('praise')
    binding.local.contributeWhat('reproduction')
    binding.local.contributeWords('I made it again.')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.deepEqual([binding.values.contributeTo, binding.values.contributeWhat, binding.values.contributeWords], [MARAS_PAGE_ID, 'reproduction', 'I made it again.'], 'a kind is one of the four, nothing else')
    assert.equal(binding.standing.contribute, undefined)
    assert.equal(binding.writes('contribute'), true)
    await binding.write([{key: 'contribute', value: 1}])
    const sent = asked.pop()
    assert.deepEqual([sent.kind, sent.world_ref, sent.to, sent.what, sent.words], ['world-contribute', 'world:me', {world_ref: 'world:mara', part_ref: 'page:maras-plate'}, 'reproduction', 'I made it again.'])
    assert.deepEqual([store.starHand().contributeTo, store.starHand().contributeWords], [null, ''], 'what was contributed is no longer in the hand')
    binding.local.contribution('contribution:mara-asks')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.values.contribution, 'contribution:mara-asks')
    assert.match(binding.standing.contributionRefuse?.disabled ?? '', /Say why/)
    assert.match(binding.standing.contributionTakeBack?.disabled ?? '', /Only the one who contributed it/)
    await binding.write([{key: 'contributionAccept', value: 2}])
    assert.deepEqual(asked.pop(), {kind: 'world-contribution-accept', contribution_ref: 'contribution:mara-asks'})
    binding.local.contribution('contribution:mara-asks')
    binding.local.answerWords('Not on this page.')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    await binding.write([{key: 'contributionRefuse', value: 3}])
    assert.deepEqual(asked.pop(), {kind: 'world-contribution-refuse', contribution_ref: 'contribution:mara-asks', words: 'Not on this page.'})
    assert.deepEqual([store.starHand().contribution, store.starHand().answerWords], [null, ''])
    binding.local.contribution('contribution:me-finds')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    for (const key of ['contributionAccept', 'contributionRefuse']) {
      assert.equal(binding.standing[key]?.disabled, 'Only the owner of the world it was contributed to answers it.', `${key} stands dimmed, saying why, on your own contribution`)
      assert.equal(binding.writes(key), false)
    }
    binding.local.contribution('contribution:stranger-threads')
    assert.deepEqual(['contributionAccept', 'contributionRefuse', 'contributionTakeBack'].map(key => atlasDevs.atlasGlobeBinding(readingWith()).standing[key]?.disabled),
      ['Only the owner of the world it was contributed to answers it.', 'Only the owner of the world it was contributed to answers it.', 'Only the one who contributed it takes it back.'],
      'on one that is neither yours nor in your world, each stands dimmed, saying why')
    binding.local.contribution(null)
    assert.deepEqual(['contributionAccept', 'contributionRefuse', 'contributionTakeBack'].map(key => atlasDevs.atlasGlobeBinding(readingWith()).standing[key]?.disabled),
      Array(3).fill('Choose a contribution first.'), 'with none chosen, each stands dimmed, saying why')
    binding.local.contribution('contribution:me-finds')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    await binding.write([{key: 'contributionTakeBack', value: 4}])
    assert.deepEqual(asked.pop(), {kind: 'world-contribution-take-back', contribution_ref: 'contribution:me-finds'})
    store.bindSystemActs(null)
    binding.local.contribution('contribution:me-finds')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.match(binding.standing.contributionTakeBack?.disabled ?? '', /not reached from this window/)
    assert.equal(binding.writes('contributionTakeBack'), false)
  } finally {
    store.bindSystemActs(null)
    resetContributing()
  }
})

test('only the person’s own press contributes, accepts, refuses or takes back: no row an agent sets, no relay and no default does any of it (SF07; DLW build ruling 2026-11-06)', async () => {
  const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
  ;(await import('../src/inhabitants/familyManifest.ts')).resetFamilyManifestsForTest()
  ;(await import('../src/inhabitants/worldShellFamilies.ts')).loadWorldShellFamilies()
  const keys = [...atlasDevs.CONTRIBUTE_ACT_KEYS, 'contributeTo', 'contributeWhat', 'contributeWords', 'contribution', 'answerWords']
  assert.deepEqual([...atlasDevs.CONTRIBUTE_ACT_KEYS], ['contribute', 'contributionAccept', 'contributionRefuse', 'contributionTakeBack'])
  assert.ok(!atlasDevs.ATLAS_DECLARED_ROWS.some(row => keys.includes(row.key)), 'no declared row of the World, which an agent may set, carries them')
  const device = atlasDevs.atlasDevice(inhabitantManifest('atlas-earth').faces.find(face => face.id === 'globe-engine'), readingWith())
  assert.ok(!device.rows.some(row => keys.includes(row.key)))
  for (const key of ['contribute', 'contributionAccept']) await assert.rejects(device.submit([{key, value: 1}]), /no owner write path/)
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(CONTRIBUTED))
  store.chooseStarHand({contributeTo: MARAS_PAGE_ID, contributeWords: 'Waiting in the hand', contribution: 'contribution:mara-asks', answerWords: 'Yes'})
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' },
    factory: async () => ({})})
  try {
    atlasDevs.atlasGlobeBinding(readingWith())
    await atlasDevs.keepShownWorks()
    await atlasDevs.relayRevoked()
    assert.deepEqual(asked, [], 'nothing is contributed or answered but by the press')
  } finally {
    store.bindSystemActs(null)
    resetContributing()
  }
  const source = await readFile(new URL('../src/projections/atlas/system/systemStore.ts', import.meta.url), 'utf8')
  assert.match(source, /contributeTo: null, contributeWhat: 'question', contributeWords: '', contribution: null, answerWords: ''/, 'the hand starts with nothing to contribute to and nothing chosen')
})

test('the face contributes, accepts and refuses by a hold and takes back by a press, each contribution a line of who, what and on what (manual §16.10; SF07)', () => {
  const v = {...world.defaults, ...world.fixtures['Contributions']}
  const page = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'contribute', setPage() {}, standing: {}}))
  const held = label => new RegExp(`data-hold="true"[^>]*><i[^>]*></i>${label}<`).test(page)
  const unheld = label => new RegExp(`class="dp-action"(?: disabled="")?>${label}<`).test(page)
  assert.match(page, />Contribute</, 'the World has a page to contribute from')
  for (const label of ['Contribute', 'Accept', 'Refuse']) assert.ok(held(label), `${label} is held`)
  assert.ok(unheld('Take back'), 'Take back is pressed, not held')
  assert.match(page, /mara’s question on A reading of the fourth plate/)
  assert.match(page, /your finding on Mara’s plate/)
  assert.match(page, />Mara’s plate · mara</, 'To names the part, then whose world')
  assert.doesNotMatch(page, /mara’s</, 'never “Mara’s plate, mara’s”')
  assert.match(page, /Hold to contribute it/)
  const none = renderToStaticMarkup(world.whole({v: {...v, contributions: undefined, contributeTargets: undefined, contributeWhy: 'This field’s service does not keep contributions to a world yet.'},
    set() {}, nav: {}, page: 'contribute', setPage() {}, standing: {}}))
  assert.match(none, /does not keep contributions to a world yet/, 'a service without says so in its own words')
})

// ── round 34: a world whose owner's machine is off (SF11; manual §2) ──────────────────────────────────────────────────────────────
// A world answers while a window of its owner's stands. With its owner's machine off it is away: its clearings read as its owner last
// left them, saying when; its agent and anything live say they are away; and nothing is drawn to fill the gap.
const LEFT_AT = Date.UTC(2026, 10, 6, 9, 41)
const answering = {answering: true, since_micros: '1000'}
const AWAY = {...SNAPSHOT, world_answer: {state: 'held'},
  worlds: SNAPSHOT.worlds.map(world => ({...world, answer: world.world_ref === 'world:mara' ? {answering: false, since_micros: String(LEFT_AT * 1000)} : answering})),
  clearings: [...SNAPSHOT.clearings, c('world:mara', 'agent:cartographer', 'star', 'Cartographer', 'star:rosarium')]}

test('a world whose owner’s machine is off reads away since its last window went; one that answers, your own, and a field that keeps no word of it read as before (SF11)', () => {
  const field = fieldOf(AWAY)
  assert.deepEqual(field.worlds.map(world => [world.world_ref, world.answer]), [['world:me', {answering: true, since: 1}], ['world:me:o-i', {answering: true, since: 1}],
    ['world:mara', {answering: false, since: LEFT_AT}], ['world:stranger', {answering: true, since: 1}]])
  const sceneOf = (snapshot, aperture = 'federated') => model.fieldScene(fieldOf(snapshot), {aperture, viewAs: 'me'}, YOURS)
  assert.deepEqual(sceneOf(AWAY).worlds.map(world => [world.ref, world.left]), [['world:me', null], ['world:me:o-i', null], ['world:mara', {since: LEFT_AT}], ['world:stranger', null]])
  assert.deepEqual(sceneOf(AWAY).worlds.find(world => world.ref === 'world:mara').clearings.map(one => one.label), ['Mara’s plate', 'Cartographer'],
    'its clearings read as mara last left them')
  const never = {...AWAY, worlds: AWAY.worlds.map(world => (world.world_ref === 'world:stranger' ? {...world, answer: null} : world))}
  assert.deepEqual(sceneOf(never).worlds.find(world => world.ref === 'world:stranger').left, {since: null}, 'a world the field has no word of answering is away, since a time not known')
  assert.ok(sceneOf(SNAPSHOT).worlds.every(world => world.left === null), 'a field that keeps no word of who answers says no one is away')
  const mine = {...AWAY, worlds: AWAY.worlds.map(world => (world.mine ? {...world, answer: {answering: false, since_micros: '5000'}} : world))}
  assert.ok(sceneOf(mine).worlds.filter(world => world.mine).every(world => world.left === null), 'your own world is never read away to you')
  const now = LEFT_AT + 3_600_000, when = model.starWhen(LEFT_AT, now)
  assert.equal(model.leftWords('mara', 'page', {since: LEFT_AT}, now), `It reads as mara last left it at ${when}: mara is away.`)
  assert.equal(model.leftWords('mara', 'agent', {since: LEFT_AT}, now), `It is away since ${when}, with mara: nothing answers for it until mara is back.`)
  assert.equal(model.leftWords('mara', 'page', {since: null}, now), 'It reads as mara last left it: mara is away.')
  const target = atlasDevs.contributionTargets(field).find(row => row.id === MARAS_PAGE_ID)
  assert.match(target.does, /It reads as mara last left it at \d\d:\d\d|It reads as mara last left it at \d+ [A-Z][a-z]{2}/, 'what you may contribute to says its world is away')
})

test('the face names a world away on the little map and at the star, its agent away and its parts as last left; nothing is drawn in its place (SF11; manual §2)', () => {
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  const asHeld = snapshot => { const {state, ...field} = fieldOf(snapshot); return JSON.stringify(field) }
  const here = {...AWAY, worlds: AWAY.worlds.map(one => ({...one, answer: answering}))}
  const draw = (snapshot, page) => renderToStaticMarkup(world.whole({v: {...v, field: asHeld(snapshot), fieldYours: YOURS}, set() {}, nav: {}, page, setPage() {}, standing: {}}))
  const away = fieldMapOf(draw(AWAY, 'shown')), answered = fieldMapOf(draw(here, 'shown'))
  assert.ok(away.names.some(name => name.text === 'mara · away'), `the little map names mara away: ${away.names.map(name => name.text)}`)
  assert.deepEqual(away.marks, answered.marks, 'nothing is drawn in its place: the same marks as when it answered')
  const unnamed = page => { const at = page.indexOf('aria-label="The field"'); return page.slice(page.lastIndexOf('<svg', at), page.indexOf('</svg>', at)).replace(/<text[^>]*>[^<]*<\/text>/g, '') }
  assert.equal(unnamed(draw(AWAY, 'shown')), unnamed(draw(here, 'shown')), 'the map draws exactly what it drew while the world answered, but for its name')
  assert.deepEqual(away.names.map(name => name.text.replace(' · away', '')).sort(), answered.names.map(name => name.text).sort(), 'only its name says it is away')
  const star = draw(AWAY, 'star')
  assert.match(star, /Cartographer[^]*?mara, away/, 'at the star, its agent says it is away')
  assert.match(star, /Mara’s|mara, away/)
  assert.match(star, /nothing answers for it until mara is back/)
})

// ── round 34: what has reached you from the field, and why (SF08; manual §2, §17.2 Rules) ─────────────────────────────────────────
// Whatever reaches you names who sent it and how it came: addressed to you, or from a star you are gathered at. It comes in the order it
// came, never by how many others looked at it; nothing of your own reaches you, and nothing from a star you are not gathered at unless it
// was addressed to you.
const R0 = Date.UTC(2026, 10, 6, 8)
const atR = n => micros(R0 + n * 60_000)
const said = (saying_ref, star_ref, world_ref, to, what, words, n) => ({saying_ref, star_ref, world_ref, to_world_ref: null, to_part_ref: null, to_saying_ref: null, ...to, what, words, said_at_micros: atR(n)})
const MARAS_RUN = 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB'
const REACHED = {...SNAPSHOT,
  clearings: [...SNAPSHOT.clearings, c('world:mara', 'page:maras-reading', 'star', 'Mara’s reading of the second plate', 'star:rosarium')],
  star_day: {state: 'held'}, star_days: [{star_ref: 'star:rosarium', world_ref: 'world:stranger', what: 'asked', kind: null, at_micros: atR(1)}],
  star_saying: {state: 'held'}, star_sayings: [
    said('saying:q', 'star:rosarium', 'world:mara', {to_world_ref: 'world:me', to_part_ref: 'page:for-the-circle'}, 'question', 'Where does the circle open?', 2),
    said('saying:mine', 'star:rosarium', 'world:me', {to_world_ref: 'world:mara', to_part_ref: 'page:maras-reading'}, 'correction', 'Not the red rose.', 3),
    said('saying:f', 'star:rosarium', 'world:mara', {to_saying_ref: 'saying:mine'}, 'finding', 'The white one, then.', 4),
    said('saying:own', 'star:rosarium', 'world:mara', {to_world_ref: 'world:mara', to_part_ref: 'page:maras-reading'}, 'reproduction', 'I drew it again.', 5),
    said('saying:far', 'star:far', 'world:stranger', {to_world_ref: 'world:stranger', to_part_ref: 'page:elsewhere'}, 'finding', 'Elsewhere.', 6)],
  star_work: {state: 'held'}, star_works: [{star_ref: 'star:rosarium', world_ref: 'world:mara', work_ref: MARAS_RUN, standing: 'live', revision: 3,
    shown: {...SHOWN(3), work_ref: MARAS_RUN, name: 'The plate readings'}, shown_at_micros: atR(7), updated_at_micros: atR(7)}],
  star_offers: [offerRow('offer:mine-open', 'world:me', 'open', null, {moved_at_micros: atR(0)}), offerRow('offer:maras', 'world:mara', 'open', null, {moved_at_micros: atR(8)}),
    offerRow('offer:mine-back', 'world:me', 'returned', 'world:mara', {returned: BACK('offer:mine-back'), moved_at_micros: atR(9)})],
  world_contribution: {state: 'held'}, world_contributions: [
    {...k('contribution:mara-asks', 'world:mara', 'world:me', MY_PAGE, 'question', 'Which rose is the fourth?', 'waiting'), at_micros: atR(10)},
    {...k('contribution:me-asks', 'world:me', 'world:mara', MARAS_PAGE, 'question', 'Where is the white rose?', 'accepted', 'Here, on the left.'), at_micros: atR(11)},
    {...k('contribution:stranger-threads', 'world:stranger', 'world:mara', {contribution_ref: 'contribution:me-asks'}, 'reproduction', 'I found it there too.', 'accepted'), at_micros: atR(12)},
    {...k('contribution:me-waits', 'world:me', 'world:mara', MARAS_PAGE, 'finding', 'The plate is the sixth.', 'waiting'), at_micros: atR(13)}]}
const REACHED_LINES = [
  ['stranger asks to come to The Rosarium plates', 'to you'],
  ['mara asks about For the circle', 'to you'],
  ['mara has a finding on your correction', 'to you'],
  ['mara reproduces Mara’s reading of the second plate', 'The Rosarium plates'],
  ['mara shows a piece of work: The plate readings', 'The Rosarium plates'],
  ['mara offers a task: Chart the delta’s channels from the survey notes.', 'The Rosarium plates'],
  ['mara brought back The delta chart, for your task', 'to you'],
  ['mara’s question on A reading of the fourth plate', 'to you'],
  ['mara accepted your question on Mara’s plate', 'to you'],
  ['stranger’s reproduction under your question', 'to you']]

test('what has reached you names who sent it and how it came, addressed to you or from a star you are gathered at, in the order it came; your own and a star you are not at never reach you (SF08)', () => {
  const rows = atlasDevs.reachedRows(fieldOf(REACHED))
  assert.deepEqual(rows.map(row => [row.name, row.note]), REACHED_LINES)
  const by = name => rows.find(row => row.name === name)
  assert.match(by('mara asks about For the circle').does, /^“Where does the circle open\?” It reached you addressed to you: said to a part your world shows\.$/)
  assert.match(by('mara has a finding on your correction').does, /addressed to you: said to what your world said\./)
  assert.match(by('mara reproduces Mara’s reading of the second plate').does, /It reached you from The Rosarium plates, a star your world is gathered at\./)
  assert.match(by('mara accepted your question on Mara’s plate').does, /^“Here, on the left\.” It reached you addressed to you: the answer to your contribution\.$/)
  assert.match(by('stranger asks to come to The Rosarium plates').does, /addressed to you: it asks at a star your world lit\./)
  assert.ok(rows.every(row => !/Not the red rose|Elsewhere|The plate is the sixth/.test(`${row.name} ${row.does}`)), 'nothing of your own, and nothing from a star you are not at')
  const reversed = Object.fromEntries(Object.entries(REACHED).map(([key, value]) => [key, Array.isArray(value) ? [...value].reverse() : value]))
  assert.deepEqual(atlasDevs.reachedRows(fieldOf(reversed)).map(row => row.name), REACHED_LINES.map(([name]) => name), 'in the order it came, whatever order the field served it in')
  const crowd = {...REACHED, worlds: [...REACHED.worlds, ...Array.from({length: 9}, (_, i) => w(`world:reader-${i}`, `body:r${i}`, false))],
    gatherings: [...REACHED.gatherings, ...Array.from({length: 9}, (_, i) => ({star_ref: 'star:rosarium', world_ref: `world:reader-${i}`, state: 'gathered'}))]}
  assert.deepEqual(atlasDevs.reachedRows(fieldOf(crowd)).map(row => row.name), REACHED_LINES.map(([name]) => name), 'nothing comes first because more worlds are gathered round it')
  const left = {...REACHED, gatherings: REACHED.gatherings.filter(row => row.world_ref !== 'world:me')}
  assert.deepEqual(atlasDevs.reachedRows(fieldOf(left)).filter(row => row.note !== 'to you'), [], 'a star you have left sends you nothing more')
  assert.deepEqual(atlasDevs.reachedRows(fieldOf(SNAPSHOT)).map(row => row.name), ['stranger asks to come to The Rosarium plates'], 'a field that keeps no sayings, work or contributions sends what it keeps')
})

test('the Shown page lists what reached you, who sent it and how it came, opening on the newest (SF08)', () => {
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(REACHED))
  let rows
  try { rows = JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.reached) } finally { store.publishField(fieldOf(SNAPSHOT)); store.chooseFieldView({field: false, aperture: 'world', viewAs: 'me'}) }
  assert.deepEqual(rows.map(row => [row.name, row.note]), REACHED_LINES, 'the binding hands the World what reached you')
  const page = renderToStaticMarkup(world.whole({v: {...v, reached: JSON.stringify(rows)}, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}}))
  assert.match(page, />Reached you</)
  assert.match(page, />stranger’s reproduction under your question</, 'it opens on the newest')
  assert.match(page, />mara accepted your question on Mara’s plate</)
  assert.doesNotMatch(page, />stranger asks to come to The Rosarium plates</, 'the oldest is a page back')
  const none = renderToStaticMarkup(world.whole({v: {...v, reached: JSON.stringify([])}, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}}))
  assert.match(none, /Nothing has reached you from the field\./)
})
