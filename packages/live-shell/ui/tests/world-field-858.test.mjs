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
  assert.match(readings, /\{op: 'shared_field', request: \{kind: 'worlds'\}\}/, 'the Field scale asks the held field for the worlds alone')
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
    // Software Factory's acts at a star stand dimmed, naming the owner that has not built them
    assert.match(binding.standing.starShow?.disabled ?? '', /Software Factory/)
    assert.match(binding.standing.starOffer?.disabled ?? '', /Software Factory/)
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

test('the face lights, gathers and lets in at a star, and Factory’s acts at a star stand dimmed with their owner named', () => {
  const v = {...world.defaults, ...world.fixtures['Field, a star chosen']}
  const whole = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {
    starShow: {disabled: 'Software Factory has not built showing work in the field yet.'}, starOffer: {disabled: 'Software Factory has not built offering a task at a star yet.'}}}))
  for (const label of ['Light a star', 'Gather', 'Leave', 'Let in', 'Close', 'Show work', 'Offer a task']) assert.match(whole, new RegExp(`>${label}<`), `${label} stands on the face`)
  assert.match(whole, /Readings of the Rosarium plates/, 'the chosen star says what it gathers')
  assert.match(whole, /stranger/, 'a world waiting at its edge is named')
  assert.match(whole, /Software Factory has not built showing work/, 'Show work names the owner that has not built it')
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
