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

test('the World’s View chooses Space or Graph at every scale, the Field’s too, through the atlas’s own setter, mounted or not (O-I #858 TO10)', async () => {
  const {useAtlasView} = await import('../src/projections/atlas/AtlasProjectionPanel.tsx')
  const React = await import('react')
  const presented = () => renderToStaticMarkup(React.createElement(() => React.createElement('i', null, useAtlasView())))
  store.publishField(model.heldFieldOf(SNAPSHOT))
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  try {
    for (const binding of [atlasDevs.atlasGlobeBinding({...reading(), mounted: true}), atlasDevs.atlasGlobeBinding(reading())]) {
      assert.equal(binding.values.scale, 'field')
      assert.equal(binding.writes('view'), true, 'the View is the World’s to choose at the Field scale')
      assert.equal(binding.standing.view, undefined, 'never a reading with no reason')
      await binding.write([{key: 'view', value: 'graph'}])
      assert.equal(presented(), '<i>graph</i>', 'the atlas presents the Graph view')
      await binding.write([{key: 'view', value: 'earth'}])
      assert.equal(presented(), '<i>earth</i>')
    }
  } finally { store.chooseFieldView({field: false, aperture: 'world', viewAs: 'me'}); store.publishField({state: 'reading'}) }
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

test('asks are the holder’s: a star’s day read without a world’s ask says so on the line where it was let in (SF06; DLW build ruling 2026-11-06, O-I #858 r43)', () => {
  // me lit the Rosarium and handed it on to mara; mara's ask to come was answered by me while I held it, and is read now by whoever holds the
  // star (mara) and the world that asked alone: I read the rest of the day. stranger asked after, and its ask is in this reading.
  const day = [
    {star_ref: 'star:rosarium', world_ref: 'world:me', what: 'lit', at_micros: '1'},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'let-in', at_micros: '3'},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'took-on', at_micros: '4'},
    {star_ref: 'star:rosarium', world_ref: 'world:stranger', what: 'asked', at_micros: '5'},
    {star_ref: 'star:rosarium', world_ref: 'world:stranger', what: 'let-in', at_micros: '6'},
  ]
  const field = model.heldFieldOf({...SNAPSHOT, star_day: {state: 'held'}, star_days: day})
  const rosarium = model.fieldScene(field, {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === 'star:rosarium')
  assert.deepEqual(rosarium.day.map(model.starDayLine), ['me lit the star', 'mara was let in', 'mara took the star on', 'stranger asked to come', 'stranger was let in'])
  assert.match(model.ASKS_ARE_THE_HOLDERS, /asks are the holder’s/)
  assert.deepEqual(model.dayAskWhys(rosarium.day), [undefined, model.ASKS_ARE_THE_HOLDERS, undefined, undefined, undefined],
    'the hole is said where it shows: on mara let in, whose ask this reading does not hold; stranger’s ask is here')
  const v = {...world.defaults, field: JSON.stringify(field), fieldStar: 'star:rosarium', fieldYours: YOURS, dayPage: 0}
  const star = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'star', setPage() {}, standing: {}}))
  assert.match(star, /data-i="mara was let in[^"]*asks are the holder’s/, 'on the Star page, the line says asks are the holder’s')
  assert.match(star, /class="dp-row-why" aria-label="Its ask to come/, 'and marks the line')
  assert.doesNotMatch(star, /data-i="stranger was let in[^"]*asks are the holder’s/, 'a world let in whose ask is read says nothing of it')
  assert.match(star, /data-i="[^"]*The star’s day, as the field lets you read it[^"]*Asks to come are the holder’s/, 'the day says whose asks are')
})

test('the chosen star reads in lines that end short of their section, and while the field holds no worlds every act at a star stands dimmed with the field’s words', () => {
  const page = (fixture) => renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures[fixture]}, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  const chosen = page('Field, a star chosen')
  // each line of the star stands whole in its section (DLW build ruling 2026-11-06: no cut rows): the star's own words, too long for the
  // row, stand short there and whole to a reader
  for (const line of ['What it gathers', 'Its lighter lets worlds in', '2 gathered, 1 waiting', 'Your world is gathered here']) {
    assert.match(chosen, new RegExp(`class="dp-row-name[^"]*"[^>]*>${line}<`), `${line} is a line of the star`)
  }
  assert.match(chosen, /class="dp-row-said">Readings of the Rosarium plates</, 'the lighter’s words, whole to a reader')
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
  // REPLACED (round 42, the Star page split, DLW build ruling 2026-11-06): who is here and the day stand on the Star page; what was said
  // there and saying it, on the Said page beside it
  assert.match(whole, />Here now</, 'Here now stands on the Star page')
  const said = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'said', setPage() {}, standing: {}}))
  assert.match(said, /role="tab"[^>]*>Said</, 'the World has a Said page')
  for (const label of ['Said here', 'Say']) assert.match(said, new RegExp(`>${label}<`), `${label} stands on the Said page`)
  for (const label of ['Star', 'To', 'Kind', 'Words']) assert.match(said, new RegExp(`data-i="${label}[^"]*"`), `${label} stands on the Said page`)
  assert.match(said, />Unsay</)
  // what was said to what is a line: whole where it stands whole in the list's width, else who said what to what, whole to a reader
  assert.match(said, /aria-label="mara asks about For the circle: Where does the circle open on the fourth plate\?">mara asks about For the circle</, 'what was said to what is a line')
  assert.match(said, /aria-label="teraphim has a finding on mara’s question: [^"]+">teraphim has a finding on mara’s question</, 'an answer names what it answers')
  assert.match(whole, /class="dp-row-name[^"]*"[^>]*>Mara’s reading of the second plate</, 'what a world brought is a line')
  assert.match(whole, /class="dp-row-name">mara asked a question</, 'the day names who said something there')
  assert.match(whole, /class="dp-row-note">(\d\d:\d\d|\d{1,2} [A-Z][a-z]{2})</, 'and when')
  assert.match(whole, /aria-label="Previous page">/, 'the star’s day pages back to what came before')
  const unheld = renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['Field not held']}, set() {}, nav: {}, page: 'said', setPage() {}, standing: {}}))
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
    assert.deepEqual(asked.splice(0), [['factory', {kind: 'task-offer-act', state_path: '/ground/.factory/state.json', verb: 'offer-receive', by: 'world:mara', request: {return: BACK('offer:mine-back')}}],
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

// ── SF13.3c: the take the field verified, told to the Factory that made the offer ───────────────────────────────────────────────────
const MADE = '/ground/.factory/state.json', PROJECT_MADE = '/o-i/.factory/state.json'

test('a task of yours the field shows taken is told to the Factory that made it, with the world the field verified took it, once (SF13.3c; DLW build ruling 2026-11-09)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  const takenAt = AT0 + 7 * 60_000
  const at = {moved_at_micros: micros(takenAt)}
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(
    offerRow('offer:mine-taken', 'world:me', 'taken', 'world:mara', at),
    offerRow('offer:project-taken', 'world:me:o-i', 'taken', 'world:stranger', at),
    offerRow('offer:mine-kept', 'world:me', 'taken', 'world:mara', at),
    offerRow('offer:mine-elsewhere', 'world:me', 'taken', 'world:stranger', at),
    offerRow('offer:mine-refused', 'world:me', 'taken', 'world:mara', at),
    offerRow('offer:mine-open', 'world:me', 'open', null),
    // taken, then revoked before its take was told: the grant is gone, and no take is told for it
    offerRow('offer:mine-revoked', 'world:me', 'revoked', 'world:mara', at),
    offerRow('offer:mine-back', 'world:me', 'returned', 'world:mara', {returned: BACK('offer:mine-back')}),
    // a row under a ref your Factory made that another world put in the field: it is not yours, and its taker is never told
    offerRow('offer:posed', 'world:stranger', 'taken', 'world:mara', at),
    offerRow('offer:unmade', 'world:me', 'taken', 'world:mara', at))}))
  store.publishFactory(factoryRead({
    madeAt: {'offer:mine-taken': MADE, 'offer:project-taken': PROJECT_MADE, 'offer:mine-kept': MADE, 'offer:mine-elsewhere': MADE,
      'offer:mine-refused': MADE, 'offer:mine-open': MADE, 'offer:mine-revoked': MADE, 'offer:mine-back': MADE, 'offer:posed': MADE},
    madeTaker: {'offer:mine-taken': null, 'offer:project-taken': null, 'offer:mine-kept': 'world:mara', 'offer:mine-elsewhere': 'world:mara',
      'offer:mine-refused': null, 'offer:mine-open': null, 'offer:mine-revoked': null, 'offer:mine-back': null, 'offer:posed': null}}))
  store.chooseStarHand({star: 'star:rosarium'})
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async () => 'x',
    factory: async request => { asked.push(request); if (request.request.offer_ref === 'offer:mine-refused') throw Error('The offer’s record could not be written'); return {schema: 'factory.task-offer-receipt/v1', act: 'taken', state: 'open'} }})
  try {
    await atlasDevs.relayTaken()
    // the world goes beside the document, as `--by`, never in it (Factory #313's F1)
    const told = (state_path, offer_ref, world_ref, taken_at = takenAt) => ({kind: 'task-offer-act', state_path, verb: 'offer-taken', by: world_ref,
      request: {offer_ref, by: {name: model.whoOf(world_ref)}, taken_at}})
    assert.deepEqual(asked.splice(0), [told(MADE, 'offer:mine-taken', 'world:mara'), told(PROJECT_MADE, 'offer:project-taken', 'world:stranger'),
      told(MADE, 'offer:mine-refused', 'world:mara'), told(MADE, 'offer:mine-back', 'world:mara', AT0)],
      'each task of yours the field shows taken, or returned before its take was told, to the state that made it, with the field’s taker beside it, its name and the field’s moment')
    // read after read, it is told once in a window's life
    await atlasDevs.relayTaken()
    assert.deepEqual(asked, [])
    // the refusal stays under the task in Factory's words; a taker Factory keeps that the field does not show is said, and nothing told
    const notes = JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.offerNotes)
    assert.match(notes['offer:mine-refused'] ?? '', /told who took it up, and refused: The offer’s record could not be written/)
    assert.match(notes['offer:mine-elsewhere'] ?? '', /keeps mara as the world that took it up; the field shows stranger\. Nothing was told/)
    assert.equal(notes['offer:mine-taken'], undefined)
    assert.equal(notes['offer:posed'], undefined)
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

test('a take and what came back go to Factory under the world the field verified, never the world a document names (SF13.3c; Factory #313 F1, F2)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  // (an offer no other test told) the taker's own document names another world than the one the field verified took the task
  const forged = {...BACK('offer:forged-back'), by: {world_ref: 'world:mallory', name: 'mallory'}}
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(offerRow('offer:forged-back', 'world:me', 'returned', 'world:mara', {returned: forged}))}))
  store.publishFactory(factoryRead({madeAt: {'offer:forged-back': MADE}, madeTaker: {'offer:forged-back': null}}))
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded',
    fieldAct: async request => { asked.push(['field', request]); return 'The field took it.' },
    factory: async request => { asked.push(['factory', request]); return {schema: 'factory.task-offer-receipt/v1', state: 'returned'} }})
  try {
    await atlasDevs.relayTaken()
    store.chooseStarHand({star: 'star:rosarium', offer: 'offer:forged-back'})
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerAccept', value: 1}])
    const factory = asked.filter(([who]) => who === 'factory').map(([, request]) => request)
    assert.deepEqual(factory.map(request => [request.verb, request.by]), [['offer-taken', 'world:mara'], ['offer-receive', 'world:mara'], ['offer-accept', undefined]],
      'the take and the return go under the world the field verified, never the one the document names')
    assert.equal(factory[0].request.by.world_ref, undefined, 'the take names no world in its document')
    assert.equal(factory[1].request.return.by.world_ref, 'world:mallory', 'the document goes as the field carried it, for Factory to refuse')
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

test('a take Factory keeps already is never told again, so a window that starts again tells nothing it told before (SF13.3c)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(offerRow('offer:restart', 'world:me', 'taken', 'world:mara'))}))
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async () => 'x',
    factory: async request => { asked.push(request); return {schema: 'factory.task-offer-receipt/v1', act: 'taken', state: 'open'} }})
  try {
    // this window never told it (it was told before the window started again): Factory's own record says who took it
    store.publishFactory(factoryRead({madeAt: {'offer:restart': MADE}, madeTaker: {'offer:restart': 'world:mara'}}))
    await atlasDevs.relayTaken()
    assert.deepEqual(asked, [], 'what Factory keeps is not told again')
    // unread, nothing is told either
    store.publishFactory(factoryRead({madeAt: null, madeTaker: null}))
    await atlasDevs.relayTaken()
    assert.deepEqual(asked, [])
    // and what Factory's reading of what it made says is read from its own `made` records (SystemReadings readTakenOffers)
    const {readTakenOffers} = await import('../src/projections/atlas/system/SystemReadings.tsx')
    const offers = {
      [MADE]: {schema: 'factory.task-offers-reading/v1', made: [
        {offer: OFFER('offer:restart'), state: 'open', taken: {world_ref: 'world:mara', name: 'mara', taken_at: AT0}},
        {offer: OFFER('offer:untold'), state: 'open'}], taken: [], automatic_agent_or_model_invocation: false},
      [PROJECT_MADE]: {schema: 'factory.task-offers-reading/v1', made: [{offer: OFFER('offer:restart'), state: 'open'}], taken: [], automatic_agent_or_model_invocation: false},
    }
    const send = async op => ({outcome: {result: 'factory_development_reading', data: offers[op.request.state_path]}})
    const read = await readTakenOffers(send, [MADE, PROJECT_MADE])
    assert.deepEqual(read.madeAt, {'offer:restart': MADE, 'offer:untold': MADE}, 'the first state to hold an offer answers for it')
    assert.deepEqual(read.madeTaker, {'offer:restart': 'world:mara', 'offer:untold': null})
    // the window publishes both from that reading (what it does with them as the field moves is driven below: tellTakesDue)
    const readings = await readFile(new URL('../src/projections/atlas/system/SystemReadings.tsx', import.meta.url), 'utf8')
    assert.match(readings, /madeAt: takenAnswer\.value\?\.madeAt \?\? null, madeTaker: takenAnswer\.value\?\.madeTaker \?\? null/)
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

// ── SF13.3d: a take told however the field first shows it, and told again after a failure that passes ───────────────────────────
const {tellTakesDue, factoryData} = await import('../src/projections/atlas/system/SystemReadings.tsx')
/** A kernel answer as the window's own Factory act decodes it (SystemReadings factoryData): Factory's document, its refusal in the kernel's
 * envelope (kernel material.rs Error), or words no kernel envelope carries (the transport's). */
const kernelSays = {
  kept: data => ({outcome: {result: 'factory_development_reading', data}}),
  refused: (kind, message) => ({outcome: null, error: JSON.stringify({kind, message, operation_may_have_run: true})}),
  unreached: words => ({outcome: null, error: words}),
}
const TAKEN_KEPT = {schema: 'factory.task-offer-receipt/v1', act: 'taken', state: 'open'}
const bindAsked = (asked, answer) => store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded',
  fieldAct: async request => { asked.push(['field', request.kind]); return 'The field took it.' },
  factory: async request => { asked.push(['factory', request.verb, request.by, request.request]); return answer(request) }})
const verbs = asked => asked.map(([who, verb, by]) => who === 'field' ? [who, verb] : [who, verb, by])
/** A world whose name, as the field spells it, names a local path (fieldModel nameSpelling): Factory would refuse it as `by.name`. */
const PATHY = `world:${model.nameSpelling('/Users/ada/notes')}`

test('a task of yours the field shows only returned, its take never told, is told as the field moves, and Accept then receives it (SF13.3d H1; DLW build ruling 2026-11-09)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(offerRow('offer:only-back', 'world:me', 'returned', 'world:mara', {returned: BACK('offer:only-back')}))}))
  const made = {madeAt: {'offer:only-back': MADE}, madeTaker: {'offer:only-back': null}}
  store.publishFactory(factoryRead(made))
  const asked = []
  bindAsked(asked, () => ({schema: 'factory.task-offer-receipt/v1', state: 'returned'}))
  try {
    // a Factory that keeps the take already, or one not read yet, is told nothing, and nothing is loaded for it
    assert.equal(tellTakesDue(store.heldField(), {...made, madeTaker: {'offer:only-back': 'world:mara'}}), null)
    assert.equal(tellTakesDue(store.heldField(), null), null)
    assert.deepEqual(asked, [])
    // what the window does as the field moves: the take of a task the field shows only returned is told, as the field verified it
    await tellTakesDue(store.heldField(), made)
    assert.deepEqual(asked.splice(0), [['factory', 'offer-taken', 'world:mara', {offer_ref: 'offer:only-back', by: {name: 'mara'}, taken_at: AT0}]])
    // told once: the next move tells nothing
    assert.equal(tellTakesDue(store.heldField(), made), null)
    // and what came back is received as that world brought it, with nothing told twice
    store.chooseStarHand({star: 'star:rosarium', offer: 'offer:only-back'})
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerAccept', value: 1}])
    assert.deepEqual(verbs(asked), [['factory', 'offer-receive', 'world:mara'], ['factory', 'offer-accept', undefined], ['field', 'offer-accept']])
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

test('Accept on a returned task whose take your Factory keeps no taker for tells the take first, as the field’s taker, then receives; a take Factory keeps is not told (SF13.3d H1)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  const backAt = AT0 + 60_000
  const rows = [
    offerRow('offer:accept-untold', 'world:me', 'returned', 'world:mara', {returned: BACK('offer:accept-untold'), moved_at_micros: micros(backAt)}),
    offerRow('offer:accept-kept', 'world:me', 'returned', 'world:mara', {returned: BACK('offer:accept-kept')})]
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(...rows)}))
  const made = {madeAt: {'offer:accept-untold': MADE, 'offer:accept-kept': MADE, 'offer:accept-pathy': MADE},
    madeTaker: {'offer:accept-untold': null, 'offer:accept-kept': 'world:mara', 'offer:accept-pathy': null}}
  store.publishFactory(factoryRead(made))
  const asked = []
  bindAsked(asked, () => ({schema: 'factory.task-offer-receipt/v1', state: 'returned'}))
  try {
    // a window that opens straight onto the return (or an offer returned before SF13.3c landed): its take was never told
    store.chooseStarHand({star: 'star:rosarium', offer: 'offer:accept-untold'})
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerAccept', value: 1}])
    assert.deepEqual(asked[0], ['factory', 'offer-taken', 'world:mara', {offer_ref: 'offer:accept-untold', by: {name: 'mara'}, taken_at: backAt}],
      'told first, to the state that made it, as the world the field verified took it')
    assert.deepEqual(verbs(asked.splice(0)), [['factory', 'offer-taken', 'world:mara'], ['factory', 'offer-receive', 'world:mara'], ['factory', 'offer-accept', undefined], ['field', 'offer-accept']])
    // told by Accept, it is not told again as the field moves
    assert.equal(tellTakesDue(store.heldField(), made), null)
    // a take your Factory keeps goes straight to the receive
    store.chooseStarHand({offer: 'offer:accept-kept'})
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerAccept', value: 1}])
    assert.deepEqual(verbs(asked.splice(0)), [['factory', 'offer-receive', 'world:mara'], ['factory', 'offer-accept', undefined], ['field', 'offer-accept']])
    // the take Accept tells names its taker in words Factory keeps: a name that would name a local path goes as the world's ref
    store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(...rows, offerRow('offer:accept-pathy', 'world:me', 'returned', PATHY, {returned: BACK('offer:accept-pathy')}))}))
    store.chooseStarHand({offer: 'offer:accept-pathy'})
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerAccept', value: 1}])
    assert.deepEqual(asked[0], ['factory', 'offer-taken', PATHY, {offer_ref: 'offer:accept-pathy', by: {name: PATHY}, taken_at: AT0}])
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

test('a take Factory could not keep for a reason that passes is told again as the field moves, at most once a minute; a refusal that means something is told once (SF13.3d M2)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  // each first answer as the kernel carries it, decoded by the window's own Factory act; every later one keeps the take
  const passing = [
    ['offer:busy', kernelSays.refused('owner-busy', 'The offer’s record is held by another act: Operation timed out. Nothing was changed.')],
    ['offer:io', kernelSays.refused('owner-io', 'The offer’s record could not be read: Input/output error (os error 5) Nothing was changed.')],
    ['offer:uncertain', kernelSays.refused('owner-uncertain', 'The change may not be published. The change may have been published; read the offers back before trying again.')],
    ['offer:stopped', kernelSays.refused('timeout', 'Software Factory did not answer in time, so it was stopped.')],
    ['offer:unstarted', kernelSays.refused('unavailable', 'Software Factory could not be started: No such file or directory (os error 2)')],
    ['offer:crashed', kernelSays.refused('process-error', 'Software Factory failed as a process.')],
    ['offer:unreached', kernelSays.unreached('TypeError: Failed to fetch')],
    ['offer:silent', {outcome: null}],
  ]
  const meant = [['offer:meant', kernelSays.refused('owner-refused-or-failed', 'Another world took this offer up already. Nothing was changed.')]]
  const at = {moved_at_micros: micros(AT0 + 7 * 60_000)}
  const rows = [...passing, ...meant].map(([ref]) => offerRow(ref, 'world:me', 'taken', 'world:mara', at))
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(...rows)}))
  const made = {madeAt: Object.fromEntries(rows.map(row => [row.offer_ref, MADE])), madeTaker: Object.fromEntries(rows.map(row => [row.offer_ref, null]))}
  store.publishFactory(factoryRead(made))
  const first = new Map([...passing, ...meant])
  const asked = []
  bindAsked(asked, request => { const ref = request.request.offer_ref, answer = first.get(ref) ?? kernelSays.kept(TAKEN_KEPT); first.delete(ref); return factoryData(answer) })
  const notes = () => JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.offerNotes)
  const refs = list => list.map(([ref]) => ref)
  const told = () => asked.splice(0).map(([, , , request]) => request.offer_ref)
  try {
    const T = AT0 + 10 * 60_000
    await atlasDevs.relayTaken(T)
    assert.deepEqual(told(), refs([...passing, ...meant]))
    for (const [ref] of passing) assert.match(notes()[ref] ?? '', /^Your Factory could not hear who took it up just now: .+ It is told again as the field moves, at most once a minute\.$/, ref)
    // the kernel's envelope is read for its words, never shown raw
    assert.match(notes()['offer:busy'], /could not hear who took it up just now: The offer’s record is held by another act: Operation timed out\. Nothing was changed\. It is told/)
    assert.doesNotMatch(JSON.stringify(notes()), /\\"kind\\"|operation_may_have_run/)
    assert.equal(notes()['offer:meant'], 'Your Factory was told who took it up, and refused: Another world took this offer up already. Nothing was changed.')
    // within the minute, a move of the field tells nothing, and loads nothing
    assert.equal(tellTakesDue(store.heldField(), made, T + 59_999), null)
    await atlasDevs.relayTaken(T + 59_999)
    assert.deepEqual(told(), [])
    // a minute on, the next move tells each failure that passed again, once, and Factory keeps it now; the refusal is not told again
    await tellTakesDue(store.heldField(), made, T + 60_000)
    assert.deepEqual(told(), refs(passing))
    for (const [ref] of passing) assert.equal(notes()[ref], undefined, ref)
    assert.equal(tellTakesDue(store.heldField(), made, T + 10 * 60_000), null)
    await atlasDevs.relayTaken(T + 10 * 60_000)
    assert.deepEqual(told(), [])
    assert.match(notes()['offer:meant'], /and refused: Another world took/)
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

// Factory's own names_the_unshown on each case (factory/src/shown_work.rs at Factory #314's head, run in lane BE: wip/f313d/parity)
const UNSHOWN = [
  ['mara', false], ['Ada Lovelace', false], ['', false], ['/Users/ada/x', true], ['~/notes', true], ['file:///etc', true], ['wss://a', true],
  ['https://a.b', true], ['Bearer abc', true], ['AIKIT_GATEWAY_TOKEN', true], ['x .central/y', true], ['native-token', true], ['owner-token', true],
  ['agent-session', true], ['session-space', true], ['session:1', true], ['harness:x', true], ['workcell:a', true], ['machine:b', true],
  ['-----BEGIN KEY', true], ['box.ts.net', true], ['localhost', true], ['LOCALHOST', false], ['Users/ada', false], ['/private/x', true],
  ['a /tmp/x', true], ['(/etc/hosts)', true], ['/Volumes/D', true], ['./run', true], ['../up', true], ['C:\\dir', true], ['x;/tmp/y', true],
  ['x=/opt/z', true], ['a/tmp/x', false], ['/privatex', false], ['sk-12345678', true], ['sk-1234567', false], ['github_pat_abcdefgh', true],
  ['AKIAabcdefg', false], ['a'.repeat(31) + '1', true], ['a'.repeat(40), false], ['1'.repeat(40), false], ['abc123'.repeat(6), true],
  ['abc-123_+/='.repeat(4), false], ['abc.123'.repeat(6), false], ['abé'.repeat(12) + '1', false], ['10.0.0.7', true], ['10.0.0.7:8080', true],
  ['1.2.3', false], ['1.2.3.4.5', false], ['1234.1.1.1', false], ['10.0.0.', false], ['[10.0.0.1]', true], ['10.0.0.1,x', true],
  ['x\u00a010.0.0.1', true], ['x\u202810.0.0.1', true], ['x\ufeff10.0.0.1', false], ['x\u008510.0.0.1', true], ['x\u200b10.0.0.1', false],
  ['sk-éééé', true], ['éééé', false], ['Ada at 10.0.0.7', true], ['Mara’s world', false], ['café /tmp/y', true], ['<./q>', true],
]

test('who took a task goes to Factory in words it keeps: the field’s name for the world cut to 200 characters, else its ref, never a name that fails the tell (SF13.3d M2; Factory task_offer.rs text)', async () => {
  for (const [words, unshown] of UNSHOWN) assert.equal(model.namesTheUnshown(words), unshown, JSON.stringify(words))
  const named = name => model.nameForFactory(`world:${model.nameSpelling(name)}`)
  assert.equal(model.nameForFactory('world:mara'), 'mara')
  assert.equal(named('Ada Lovelace'), 'Ada Lovelace')
  // 200 characters, as Factory counts them (each a code point)
  assert.equal(named('é'.repeat(300)), 'é'.repeat(200))
  assert.equal(named('🌊'.repeat(201)), '🌊'.repeat(200))
  // a name that would name something never shown goes as the world's ref; a ref that would too, as no name of its own
  assert.equal(named('/Users/ada/notes'), `world:${model.nameSpelling('/Users/ada/notes')}`)
  assert.equal(named('Ada at 10.0.0.7'), `world:${model.nameSpelling('Ada at 10.0.0.7')}`)
  assert.equal(model.nameForFactory('world:localhost'), 'a world')
  // [SF13.3e] from any ref: a spelling that names no character reads as written, never a throw or half a pair; never a name Factory's
  // trim leaves empty or changes (Factory's own `text` took each as sent, or refused the one sent before: lane BE's wip/313e/oracle)
  assert.equal(model.whoOf('world:a.110000.b'), 'a.110000.b')
  assert.equal(model.nameForFactory('world:a.110000.b'), 'a.110000.b')
  assert.equal(model.whoOf('world:a.d800.b'), 'a.d800.b')
  assert.equal(model.nameForFactory('world:a.d800.b'), 'a.d800.b')
  assert.equal(model.nameForFactory('world:a\ud800'), 'a world')
  assert.equal(model.nameForFactory('world:.85._.85.'), 'world:.85._.85.')
  assert.equal(model.nameForFactory('world:.85.mara.85.'), 'mara')
  assert.equal(model.nameForFactory('world:.feff.'), '\ufeff')
  // and the take is told so, as is a take your world makes
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  const pathy = `world:${model.nameSpelling('/Users/ada/notes')}`
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(offerRow('offer:pathy-taker', 'world:me', 'taken', pathy))}))
  store.publishFactory(factoryRead({madeAt: {'offer:pathy-taker': MADE}, madeTaker: {'offer:pathy-taker': null}}))
  const asked = []
  bindAsked(asked, () => TAKEN_KEPT)
  try {
    // two moves of the field at once tell it once: every take due is marked before the first is asked
    await Promise.all([atlasDevs.relayTaken(), atlasDevs.relayTaken()])
    assert.deepEqual(asked.splice(0).map(([, verb, by, request]) => [verb, by, request.by]), [['offer-taken', pathy, {name: pathy}]])
    // your own world's Take names it to the Factory that takes the task up in such words too
    const pathyMe = `world:${model.nameSpelling('~/my notes')}`
    store.publishField(model.heldFieldOf(JSON.parse(JSON.stringify({...SNAPSHOT, ...withOffers(offerRow('offer:pathy-take', 'world:mara', 'open', null))})
      .replaceAll('"world:me"', JSON.stringify(pathyMe)))))
    store.chooseStarHand({star: 'star:rosarium', offer: 'offer:pathy-take'})
    await atlasDevs.atlasGlobeBinding(YOURS_READING()).write([{key: 'offerTake', value: 1}])
    assert.deepEqual(asked.filter(([who]) => who === 'factory').map(([, verb, , request]) => [verb, request.by]), [['offer-take', {world_ref: pathyMe, name: pathyMe}]])
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

// ── SF13.3e: the window's own effect, mounted; two takes marked before the first is asked; a note that would stay stale ─────────────
const {useTellTakesDue} = await import('../src/projections/atlas/system/SystemReadings.tsx')
const {flushSync} = await import('react-dom')
const {createRoot} = await import('react-dom/client')
const {createElement: hookElement} = await import('react')
/** A hook mounted as the window mounts it, its effects run as they run there: React's own DOM renderer (as browser-rows-one-read.test.mjs
 * mounts the browser rows), over a container it draws nothing into, with `window` lent only while it commits, where it reads it. */
function mountHook(useHook, args) {
  const commit = render => {
    if ('window' in globalThis) return flushSync(render)
    globalThis.window = {HTMLIFrameElement: class {}}
    try { flushSync(render) } finally { delete globalThis.window }
  }
  const ownerDocument = {nodeType: 9, addEventListener() {}, removeEventListener() {}}
  const root = createRoot({nodeType: 1, nodeName: 'DIV', tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument, addEventListener() {}, removeEventListener() {}})
  const Hook = ({args}) => { useHook(...args); return null }
  commit(() => root.render(hookElement(Hook, {args})))
  return {render: next => commit(() => root.render(hookElement(Hook, {args: next}))), unmount: () => commit(() => root.unmount())}
}
const settle = () => new Promise(resolve => setTimeout(resolve, 25))
async function until(holds, what) {
  for (let waited = 0; !holds(); waited += 5) {
    if (waited > 5_000) assert.fail(`never: ${what}`)
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

test('the window tells a take due as Factory’s reading comes in and as the field moves: its own effect, mounted (SF13.3e 1; SystemReadings useTellTakesDue)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  const rowA = offerRow('offer:hook-a', 'world:me', 'taken', 'world:mara'), rowB = offerRow('offer:hook-b', 'world:me', 'taken', 'world:mara')
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(rowA)}))
  const made = {madeAt: {'offer:hook-a': MADE, 'offer:hook-b': MADE}, madeTaker: {'offer:hook-a': null, 'offer:hook-b': null}}
  store.publishFactory(factoryRead(made))
  const asked = []
  bindAsked(asked, () => TAKEN_KEPT)
  const told = () => asked.splice(0).map(([, verb, by, request]) => [verb, by, request.offer_ref])
  // the window mounts it with the field it holds and Factory's reading of the offers
  const readings = await readFile(new URL('../src/projections/atlas/system/SystemReadings.tsx', import.meta.url), 'utf8')
  assert.match(readings, /\n {2}useTellTakesDue\(heldNow, taken \|\| null\)\n/)
  const hook = mountHook(useTellTakesDue, [store.heldField(), null])
  try {
    // Factory's reading of the offers not in yet: nothing is told
    await settle()
    assert.deepEqual(told(), [])
    // it comes in: the take due is told, once
    hook.render([store.heldField(), made])
    await until(() => asked.length > 0, 'told as Factory’s reading came in')
    await settle()
    assert.deepEqual(told(), [['offer-taken', 'world:mara', 'offer:hook-a']])
    // the field moves, with a second take of yours, and Factory's reading as it stood: that take is told
    store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(rowA, rowB)}))
    hook.render([store.heldField(), made])
    await until(() => asked.length > 0, 'told as the field moved')
    await settle()
    assert.deepEqual(told(), [['offer-taken', 'world:mara', 'offer:hook-b']])
  } finally {
    hook.unmount()
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

test('every take due is marked as being told before the first is asked: two moves of the field at once tell each of two takes once (SF13.3e 2)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  const refs = ['offer:pair-a', 'offer:pair-b']
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(...refs.map(ref => offerRow(ref, 'world:me', 'taken', 'world:mara')))}))
  store.publishFactory(factoryRead({madeAt: Object.fromEntries(refs.map(ref => [ref, MADE])), madeTaker: Object.fromEntries(refs.map(ref => [ref, null]))}))
  const asked = []
  bindAsked(asked, () => TAKEN_KEPT)
  try {
    await Promise.all([atlasDevs.relayTaken(), atlasDevs.relayTaken()])
    assert.deepEqual(asked.map(([, verb, , request]) => [verb, request.offer_ref]), [['offer-taken', 'offer:pair-a'], ['offer-taken', 'offer:pair-b']])
  } finally {
    store.bindSystemActs(null)
    store.publishFactory({state: 'reading'})
    resetHand()
  }
})

test('a take that failed for a reason that passes says it is told again only until a reading shows Factory keeps its taker, whichever comes first; a refusal that means something stays (SF13.3e 4)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  const refs = ['offer:kept-after', 'offer:kept-while', 'offer:meant-kept']
  store.publishField(model.heldFieldOf({...SNAPSHOT, ...withOffers(...refs.map(ref => offerRow(ref, 'world:me', 'taken', 'world:mara')))}))
  const made = keeps => ({madeAt: Object.fromEntries(refs.map(ref => [ref, MADE])), madeTaker: Object.fromEntries(refs.map(ref => [ref, keeps(ref) ? 'world:mara' : null]))})
  store.publishFactory(factoryRead(made(() => false)))
  const asked = []
  bindAsked(asked, request => {
    const ref = request.request.offer_ref
    // while this one is told, a reading of Factory comes in that shows its taker kept (another window told it, say), and then it fails
    if (ref === 'offer:kept-while') store.publishFactory(factoryRead(made(r => r === 'offer:kept-while')))
    return factoryData(ref === 'offer:meant-kept' ? kernelSays.refused('owner-refused-or-failed', 'Another world took this offer up already. Nothing was changed.')
      : kernelSays.refused('owner-busy', 'The offer’s record is held by another act: Operation timed out. Nothing was changed.'))
  })
  const notes = () => JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.offerNotes)
  const T = AT0 + 10 * 60_000
  try {
    await atlasDevs.relayTaken(T)
    assert.deepEqual(asked.splice(0).map(([, , , request]) => request.offer_ref), refs)
    assert.match(notes()['offer:kept-after'] ?? '', /^Your Factory could not hear who took it up just now: .+ It is told again as the field moves/)
    assert.equal(notes()['offer:kept-while'], undefined, 'a reading showed its taker kept before it failed')
    assert.match(notes()['offer:meant-kept'] ?? '', /and refused: Another world took/)
    // the next reading shows each taker kept: the note that said it would be told again goes; the refusal stays
    store.publishFactory(factoryRead(made(() => true)))
    assert.equal(notes()['offer:kept-after'], undefined)
    assert.match(notes()['offer:meant-kept'] ?? '', /and refused: Another world took/)
    // and stays gone while Factory is read again, and nothing is told
    store.publishFactory({state: 'reading'})
    assert.equal(notes()['offer:kept-after'], undefined)
    store.publishFactory(factoryRead(made(() => true)))
    assert.equal(tellTakesDue(store.heldField(), made(() => true), T + 10 * 60_000), null)
    await atlasDevs.relayTaken(T + 10 * 60_000)
    assert.deepEqual(asked, [])
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
  assert.match(page, /as it was last shown (at \d\d:\d\d|on \d{1,2} [A-Z][a-z]{2}): the window that showed it answers no more/, 'when, whatever day this is read')
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
  // REPLACED (round 42, SF01: the r41 walk read a world's name as a lowercase slug): the ref keeps the name as you gave it, in a spelling the
  // field's ref grammar holds (letters, digits and hyphens as they are, a space as _, any other character by its code point between dots)
  assert.match(put.request.world_ref, /^world:[a-z0-9]+:Teraphim\.2019\.s_World$/, 'a new world is named in the field from the name you give it, once')
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

test('a world stands in the field under the name its owner gave it, never a lowercase slug, and a world named before reads as it did (SF01)', () => {
  for (const name of ['Ada', 'Teraphim’s World', 'Zoë', 'Bea_2.0', 'Mara-Lou', 'A garden: east', '🌹 Rosarium']) {
    const put = yourAsk(OUT_OF_FIELD, {act: 'link', name, body: YOUR_BODY})
    assert.ok('request' in put, JSON.stringify(put))
    assert.match(put.request.world_ref, /^world:[a-z0-9]+:[A-Za-z0-9._-]+$/, `${name}: a ref the field's grammar holds (shared-field/spacetimedb/src/index.ts WORLD_REF_PATTERN)`)
    assert.ok(put.request.world_ref.length <= 512, `${name}: within the field's bound on a ref`)
    assert.equal(model.whoOf(put.request.world_ref), name, `${name}: read back as it was given`)
  }
  assert.equal(model.whoOf('world:mw69sc3s:ada'), 'ada', 'a world named before reads as it did')
  assert.equal(model.whoOf('world:me'), 'me')
  // the face names it so: on the field's map and in its table
  const ref = yourAsk(OUT_OF_FIELD, {act: 'link', name: 'Teraphim’s World', body: YOUR_BODY}).request.world_ref
  const field = JSON.parse(world.fixtures['Your world shown'].field)
  const renamed = JSON.parse(JSON.stringify(field).replaceAll('"world:mara"', JSON.stringify(ref)))
  const page = drawn('Your world shown', 'space', {field: JSON.stringify(renamed)})
  assert.match(page, />Teraphim’s World</, 'the map names the world as its owner named it')
  assert.doesNotMatch(page, />[^<]*(Teraphim\.2019\.s_World|teraphim-s-world)[^<]*</, 'never its ref’s spelling, in any words drawn')
})

test('the Earth stands among the worlds at the Field scale, given and no one’s: on the map, the pane’s map and its table; it counts as no one’s world (SF01; manual §17.2: “the one system that holds Earth and everyone else’s worlds”)', () => {
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  const page = drawn('Your world shown', 'space')
  const map = page.slice(page.indexOf('aria-label="The field"'), page.indexOf('</svg>', page.indexOf('aria-label="The field"')))
  assert.match(map, /data-earth="given"/, 'the Earth is drawn on the field’s map')
  assert.match(map, />Earth</, 'named Earth')
  const scene = JSON.parse(v.field)
  assert.match(page, new RegExp(`class="dp-display-corner">${scene.worlds.length} worlds? · `), 'the corner counts the worlds people made, not the Earth')
  const full = renderToStaticMarkup(world.full({v, set() {}, nav: {}, standing: {}}))
  assert.match(full, /data-earth="given"/, 'and on the pane’s map')
  assert.match(full, />Earth<\/text><text[^>]*>given</, 'the pane’s table reads it: given, everyone’s')
  for (const size of ['compact']) assert.match(renderToStaticMarkup(world.compact({v, set() {}, nav: {}, standing: {}})), /data-earth="given"/, `${size}: drawn there too`)
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
  assert.match(show('field', null, PLACE, already).refusal, /^“The study” is shown so already\.$/, 'named, as the part it is')
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
    assert.match(await readFile(new URL('../src/projections/atlas/system/SystemReadings.tsx', import.meta.url), 'utf8'), /const read = withGone\(heldFieldOf\(fieldAnswer\.value\.data\)\); publishField\(/)
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
    // REPLACED (round 42, SF01): the ref keeps the name as it was given, not as a lowercase slug
    assert.match(put.world_ref, /^world:[a-z0-9]+:Teraphim$/)
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

test('SF06: a Day entry reaches a star only by your own Show — the Day offers what it holds as parts, and Central names the part only on the press', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(SNAPSHOT))
  resetYours()
  const asked = [], brought = []
  const PART = {id: 'day-entry:0123456789abcdef', kind: 'page', label: 'Read the second plate'}
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  const HOLDER = {}
  store.holdDayEntries(HOLDER, {dayRef: 'central:day:control:root:2026-10-16', revision: 'rev-1', entries: [
    {id: 'day-entry-candidate:p1_must#t1', kind: 'page', label: 'Read the second plate', select: {field_id: 'p1_must', item_id: 't1'}}],
  bring: async offer => { brought.push(offer.select); if (offer.select.item_id === 'gone') throw Error('p1_must has no item gone'); return PART }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.deepEqual(JSON.parse(binding.values.yourParts).at(-1), {id: 'day-entry-candidate:p1_must#t1', kind: 'page', label: 'Read the second plate'},
      'today’s Day offers what it holds beside the places of your body')
    assert.deepEqual(brought, [], 'nothing of the Day is asked of Central until you press Show')
    binding.local.showPart('day-entry-candidate:p1_must#t1')
    store.chooseStarHand({star: 'star:rosarium'})
    binding.local.showTo('star')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.standing.partShow, undefined)
    assert.deepEqual(brought, [])
    await binding.write([{key: 'partShow', value: 5}])
    assert.deepEqual(brought, [{field_id: 'p1_must', item_id: 't1'}], 'Central is asked for the one entry chosen, on the press')
    assert.deepEqual(asked.pop(), {kind: 'clearing-open', world_ref: 'world:me', part_ref: PART.id, audience: 'star', shown: {kind: 'page', label: PART.label}, star_ref: 'star:rosarium'},
      'the field receives Central’s part: its opaque ref, its kind and its label, and nothing else of the Day')
    assert.equal(store.starHand().showPart, null)
    // Central refuses: its words, and nothing reaches the field
    store.holdDayEntries(HOLDER, {...store.dayEntries(), entries: [{id: 'day-entry-candidate:p1_must#gone', kind: 'page', label: 'Gone', select: {field_id: 'p1_must', item_id: 'gone'}}]})
    binding.local.showPart('day-entry-candidate:p1_must#gone')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    await assert.rejects(binding.write([{key: 'partShow', value: 6}]), /p1_must has no item gone/)
    assert.equal(asked.length, 0)
    // An entry that took an identical twin's place is named by the twin's part (Central #326): shown so already, it is said as that
    // part, and nothing reaches the field (DLW build ruling 2026-11-09)
    store.publishField(fieldOf({...SNAPSHOT, clearings: [...SNAPSHOT.clearings, {...c('world:me', PART.id, 'star', PART.label, 'star:rosarium'), shown: {kind: 'page', label: PART.label}}]}))
    store.holdDayEntries(HOLDER, {...store.dayEntries(), entries: [{id: 'day-entry-candidate:p1_must#0', kind: 'page', label: 'Read the second plate', select: {field_id: 'p1_must', index: 0}}]})
    binding.local.showPart('day-entry-candidate:p1_must#0')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    await assert.rejects(binding.write([{key: 'partShow', value: 7}]), /“Read the second plate” is shown so already\./)
    assert.deepEqual(brought.at(-1), {field_id: 'p1_must', index: 0}, 'Central named the part on the press')
    assert.equal(asked.length, 0)
    // no Day held: the Day offers nothing
    store.holdDayEntries(HOLDER, null)
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.ok(!JSON.parse(binding.values.yourParts).some(part => part.id.startsWith('day-entry-candidate:')))
  } finally {
    store.bindSystemActs(null)
    store.holdDayEntries(HOLDER, null)
    resetYours()
  }
})

test('SF06 (DLW build ruling 2026-11-09): Show fails closed — a part named as a Day entry with no offer standing for it, or an entry Central would refuse, never reaches the field', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(SNAPSHOT))
  resetYours()
  const asked = [], HOLDER = {}
  let brought = 0
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  // A place whose id poses as an entry of the Day: no offer of the Day stands for it, so it is refused, never sent as it stands.
  const posing = () => ({...readingWith(), locations: {rows: [{id: 'day-entry-candidate:p0_adjacencies', name: 'A private worry about the rent', lat: 22, lon: 10, kind: 'place'}]}})
  try {
    let binding = atlasDevs.atlasGlobeBinding(posing())
    binding.local.showPart('day-entry-candidate:p0_adjacencies')
    binding.local.showTo('field')
    binding = atlasDevs.atlasGlobeBinding(posing())
    await assert.rejects(binding.write([{key: 'partShow', value: 1}]), {message: atlasDevs.DAY_ENTRY_GONE})
    assert.deepEqual(asked, [], 'nothing reached the field')
    // A list whose items repeat an id: Central refuses the list whole, so the Day offers a row that says why, and Show never brings it.
    const WHY = 'Must do holds more than one item with the id twice: an id names one item, so none of its items is shown until each has its own.'
    store.holdDayEntries(HOLDER, {dayRef: 'central:day:control:root:2026-10-16', revision: 'rev-1', entries: [{id: 'day-entry-candidate:p1_must', kind: 'page', label: 'Must do', select: null, why: WHY}],
      bring: async () => { brought++; return {id: 'day-entry:0123456789abcdef', kind: 'page', label: 'Must do'} }})
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.deepEqual(JSON.parse(binding.values.yourParts).at(-1), {id: 'day-entry-candidate:p1_must', kind: 'page', label: 'Must do', why: WHY}, 'the row says why')
    binding.local.showPart('day-entry-candidate:p1_must')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.standing.partShow?.disabled, WHY, 'Show stands closed, saying why')
    await assert.rejects(binding.write([{key: 'partShow', value: 2}]), {message: WHY})
    assert.equal(brought, 0, 'nothing of the Day was asked of Central')
    assert.deepEqual(asked, [])
    const v = {...world.defaults, ...world.fixtures['Field scale'], yourParts: binding.values.yourParts}
    const drawn = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}}))
    assert.match(drawn, /<option value="day-entry-candidate:p1_must" disabled="" title="Must do holds more than one item with the id twice[^"]*">Must do<\/option>/, 'drawn closed, saying why')
    // A part the Day offers is a Day entry by membership, whatever its id (DLW build ruling 2026-11-09): it goes through the press, and
    // an answer that is still one of the Day's offers is refused.
    const PART = {id: 'day-entry:0123456789abcdef', kind: 'page', label: 'Plain words'}
    let answer = PART
    store.holdDayEntries(HOLDER, {dayRef: 'central:day:control:root:2026-10-16', revision: 'rev-1', entries: [
      {id: 'p0', kind: 'page', label: 'Plain words', select: {field_id: 'p0'}}, {id: 'p1', kind: 'page', label: 'Other words', select: {field_id: 'p1'}}],
    bring: async () => { brought++; return answer }})
    store.chooseStarHand({star: 'star:rosarium'})
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    binding.local.showPart('p0')
    binding.local.showTo('star')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    await binding.write([{key: 'partShow', value: 3}])
    assert.equal(brought, 1, 'an offer with no prefix is brought by the press')
    assert.equal(asked.pop()?.part_ref, PART.id, 'the field receives Central’s part, never the offer as it stands')
    answer = {id: 'p1', kind: 'page', label: 'Other words'}
    binding.local.showPart('p0')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    await assert.rejects(binding.write([{key: 'partShow', value: 4}]), {message: atlasDevs.DAY_ENTRY_GONE})
    assert.deepEqual(asked, [], 'an answer that is still an offer reaches nothing')
  } finally {
    store.bindSystemActs(null)
    store.holdDayEntries(HOLDER, null)
    resetYours()
  }
})

test('labels are plain text outbound too (DLW build ruling 2026-11-09): a part named with a control or an invisible character is refused before anything is sent, and markup in a label is drawn as the words it is', () => {
  const show = part => yourAsk(SNAPSHOT, {act: 'show', part, to: 'field', star: null})
  for (const c of ['\u0007', '\u001b', '\u0085', '\u2028', '\u2029', '\u202e', '\u2066', '\u200b', '\u200d', '\u2060', '\ufeff',
    '\u200e', '\u200f', '\u061c', '\u{e0000}', '\u{e0041}', '\u{e007f}']) {
    assert.equal(show({...PLACE, label: `The${c}study`}).refusal, 'A part is named in plain text: no control character and no invisible one (a line or paragraph separator, a bidi control or mark, a zero-width character or a tag character).',
      `U+${c.codePointAt(0).toString(16).padStart(4, '0')}`)
  }
  assert.equal(show({...PLACE, label: '<b>The study</b>'}).request.shown.label, '<b>The study</b>', 'markup is words like any other, sent as it reads')
  const v = {...world.defaults, ...world.fixtures['Field scale'], yourParts: JSON.stringify([{id: 'place:b', kind: 'place', label: '<b>bold</b>'}]),
    yourShown: JSON.stringify([{id: 'shown:i', part: 'place:i', label: '<i>shown</i>', kind: 'place', reach: 'field'}])}
  const drawn = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}}))
  assert.ok(drawn.includes('&lt;b&gt;bold&lt;/b&gt;'), 'a part to show: its label drawn as text')
  assert.ok(drawn.includes('&lt;i&gt;shown&lt;/i&gt;'), 'a part shown: its label drawn as text')
  assert.ok(!/<b>bold|<i>shown/.test(drawn), 'no label becomes markup')
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
  assert.match(left.note, /^(\d\d:\d\d|\d{1,2} [A-Z][a-z]{2})$/, 'its time beside it, as every withdrawal has, whatever day this is read')
  assert.equal(left.said, 'heron’s world left the field: what it showed is back under cloud', 'the whole sentence is the row’s name to a reader')
  assert.equal(rows[0].said, 'heron’s page you read is no longer shown here: why is older than the field keeps')
  for (const row of rows.filter(row => row.said === null)) assert.ok(row.name.length + row.note.length <= WITHDRAWN_LINE_ROOM)
  // the reading itself keeps the whole sentence
  assert.equal(model.withdrawnLine({world_ref: 'world:heron', star_ref: null, reach: 'world', kind: null}), 'heron’s world left the field: what it showed is back under cloud')
  assert.equal(model.withdrawnName({world_ref: 'world:heron', star_ref: null, reach: 'world', kind: null}), 'heron’s world: left the field')
})

/** The little map's marks and names as drawn: each name's box (its letters at half its size wide, the least a letter takes), each world's
 * and star's mark, the corner's count and the note below. */
const fieldMapOf = (page, label = 'The field') => {
  const at = page.indexOf(`aria-label="${label}"`)
  const svg = page.slice(page.lastIndexOf('<svg', at), page.indexOf('</svg>', at))
  const [w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number)
  const corner = page.slice(page.indexOf('</svg>', at)).match(/^<\/svg><span class="dp-display-corner">([^<]*)</)?.[1] ?? ''
  const box = (x0, y0, x1, y1, what) => ({x0, y0, x1, y1, what})
  const marks = [
    ...[...svg.matchAll(/<g><circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(([, x, y, r]) => box(+x - +r, +y - +r, +x + +r, +y + +r, `world at ${Math.round(x)},${Math.round(y)}`)),
    // the Earth among the worlds (round 42, SF01): no name stands over it either
    ...[...svg.matchAll(/<g data-earth="given"><circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(([, x, y, r]) => box(+x - +r, +y - +r, +x + +r, +y + +r, 'the Earth')),
    ...[...svg.matchAll(/<path d="M([\d.]+) ([\d.]+)L[^"]*" fill="var\(--dp-on\)"/g)].map(([, x, top]) => box(+x - 4, +top, +x + 4, +top + 8, `star at ${Math.round(x)},${Math.round(+top + 4)}`)),
    box(w - 5 - corner.length * 0.5 * 9.5, 3, w - 5, 15, `corner’s count, ${corner}`),
  ]
  const note = svg.match(/<text x="5" y="([\d.]+)" class="dp-axis">([^<]*)</)
  if (note) marks.push(box(5, +note[1] - 6, 5 + note[2].length * 0.5 * 8, +note[1] + 2, 'the note'))
  const names = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(start|middle|end)" class="dp-ink-dim" style="font-size:([\d.]+)px[^"]*">([^<]*)</g)]
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
  // REPLACED (round 42, SF01): the Earth stands among the worlds and is named with them
  assert.deepEqual(map.names.map(name => name.text).sort(), ['Earth', 'Far', 'The Rosarium plates', 'mara', 'o-i', 'stranger', 'teraphim'], 'with room for each, each is named')
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
  assert.equal(refusal({act: 'contribute', to: MARAS_PAGE_ID, what: 'praise', words: 'x'}), 'Choose what it is: a question, a finding, a correction, a reproduction or the same work.')
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

const resetContributing = () => store.chooseStarHand({contributeTo: null, contributeWhat: 'question', contributeWords: '', contributeBeside: null, contribution: null, answerWords: ''})

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
  assert.match(source, /contributeTo: null, contributeWhat: 'question', contributeWords: '', contributeBeside: null, contribution: null, answerWords: ''/, 'the hand starts with nothing to contribute to and nothing chosen')
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
  assert.match(model.leftWords('mara', 'page', {since: LEFT_AT}, LEFT_AT + 3 * 86_400_000), /^It reads as mara last left it on \d{1,2} Nov: mara is away\.$/, 'another day: on the day')
  assert.equal(model.leftWords('mara', 'agent', {since: LEFT_AT}, now), `It is away since ${when}, with mara: nothing answers for it until mara is back.`)
  assert.equal(model.leftWords('mara', 'page', {since: null}, now), 'It reads as mara last left it: mara is away.')
  const target = atlasDevs.contributionTargets(field).find(row => row.id === MARAS_PAGE_ID)
  assert.match(target.does, /It reads as mara last left it (at \d\d:\d\d|on \d{1,2} [A-Z][a-z]{2}):/, 'what you may contribute to says its world is away')
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
  assert.deepEqual(rows.map(row => [row.said, row.how]), REACHED_LINES)
  const by = said => rows.find(row => row.said === said)
  assert.match(by('mara asks about For the circle').does, /^“Where does the circle open\?” It reached you addressed to you: said to a part your world shows\.$/)
  assert.match(by('mara has a finding on your correction').does, /addressed to you: said to what your world said\./)
  assert.match(by('mara reproduces Mara’s reading of the second plate').does, /It reached you from The Rosarium plates, a star your world is gathered at\./)
  assert.match(by('mara accepted your question on Mara’s plate').does, /^“Here, on the left\.” It reached you addressed to you: the answer to your contribution\.$/)
  assert.match(by('stranger asks to come to The Rosarium plates').does, /addressed to you: it asks at a star your world lit\./)
  assert.ok(rows.every(row => !/Not the red rose|Elsewhere|The plate is the sixth/.test(`${row.said} ${row.does}`)), 'nothing of your own, and nothing from a star you are not at')
  const reversed = Object.fromEntries(Object.entries(REACHED).map(([key, value]) => [key, Array.isArray(value) ? [...value].reverse() : value]))
  assert.deepEqual(atlasDevs.reachedRows(fieldOf(reversed)).map(row => row.said), REACHED_LINES.map(([name]) => name), 'in the order it came, whatever order the field served it in')
  const crowd = {...REACHED, worlds: [...REACHED.worlds, ...Array.from({length: 9}, (_, i) => w(`world:reader-${i}`, `body:r${i}`, false))],
    gatherings: [...REACHED.gatherings, ...Array.from({length: 9}, (_, i) => ({star_ref: 'star:rosarium', world_ref: `world:reader-${i}`, state: 'gathered'}))]}
  assert.deepEqual(atlasDevs.reachedRows(fieldOf(crowd)).map(row => row.said), REACHED_LINES.map(([name]) => name), 'nothing comes first because more worlds are gathered round it')
  const left = {...REACHED, gatherings: REACHED.gatherings.filter(row => row.world_ref !== 'world:me')}
  assert.deepEqual(atlasDevs.reachedRows(fieldOf(left)).filter(row => row.how !== 'to you'), [], 'a star you have left sends you nothing more')
  assert.deepEqual(atlasDevs.reachedRows(fieldOf(SNAPSHOT)).map(row => row.said), ['stranger asks to come to The Rosarium plates'], 'a field that keeps no sayings, work or contributions sends what it keeps')
})

test('the Shown page lists what reached you, who sent it and how it came, opening on the newest (SF08)', () => {
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(REACHED))
  let rows
  try { rows = JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.reached) } finally { store.publishField(fieldOf(SNAPSHOT)); store.chooseFieldView({field: false, aperture: 'world', viewAs: 'me'}) }
  assert.deepEqual(rows.map(row => [row.said, row.how]), REACHED_LINES, 'the binding hands the World what reached you')
  const page = renderToStaticMarkup(world.whole({v: {...v, reached: JSON.stringify(rows)}, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}}))
  assert.match(page, />Reached you</)
  assert.match(page, />stranger’s reproduction under yours</, 'it opens on the newest')
  assert.match(page, />mara accepted your question</)
  assert.doesNotMatch(page, />stranger asks to come</, 'the oldest is a page back')
  const none = renderToStaticMarkup(world.whole({v: {...v, reached: JSON.stringify([])}, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}}))
  assert.match(none, /Nothing has reached you yet\./)
})

// ── round 35: no row is cut, and an empty list says so in words (DLW build ruling 2026-11-06) ─────────────────────────────────────
/** A section's rows as drawn, with the section's width: each row's drawn name, its note, and its whole sentence where the name is short. */
const sectionRowsOf = (page, label) => {
  const at = page.indexOf(`>${label}<`)
  assert.ok(at >= 0, `the page draws ${label}`)
  const width = Number(page.slice(page.lastIndexOf('class="dp-sec"', at), at).match(/width:(\d+)px/)?.[1] ?? NaN)
  const list = page.slice(at, page.indexOf('</ul>', at))
  return {width, empty: list.match(/<li class="dp-row dp-row--empty"[^>]*>([^]*?)<\/li>/)?.[1].replace(/<[^>]*>/g, '') ?? null,
    rows: [...list.matchAll(/<li class="dp-row"[^>]*>([^]*?)<\/li>/g)].map(([, row]) => ({
      name: row.match(/<(?:span|button)[^>]* class="dp-row-name[^"]*"[^>]*>([^<]*)</)?.[1] ?? '',
      note: row.match(/<span class="dp-row-note">([^<]*)</)?.[1] ?? '',
      said: row.match(/<span class="dp-row-said">([^<]*)</)?.[1] ?? null}))}
}
/** The most a row holds whole at a width, name and note together: 49 at 276 px, as the r32 capture measured the Withdrawn rows. */
const roomAt = width => Math.floor(width * WITHDRAWN_LINE_ROOM / 276)
const drawn = (fixture, page, more = {}) => renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['Your world shown'], ...world.fixtures[fixture], ...more},
  set() {}, nav: {}, page, setPage() {}, standing: {}}))

test('every row of Reached you stands whole, short, with how it came and when beside it; its whole sentence is its name to a reader (SF08; DLW build ruling 2026-11-06)', () => {
  const rows = atlasDevs.reachedRows(fieldOf(REACHED))
  assert.ok(rows.every(row => typeof row.said === 'string' && row.said.length > 0), 'each row keeps its whole sentence')
  assert.deepEqual(rows.map(row => row.said), REACHED_LINES.map(([name]) => name), 'the whole sentence is the line it was')
  for (const reached of [JSON.stringify(rows), undefined]) {
    const {width, rows: drawnRows} = sectionRowsOf(drawn('Your world shown', 'shown', reached ? {reached, reachedPage: 0} : {}), 'Reached you')
    for (const row of drawnRows) {
      assert.ok(row.name.length + row.note.length <= roomAt(width), `“${row.name}” beside “${row.note}” is cut off at ${width} px`)
      assert.match(row.note, /^(to you|The Rosarium plates) · (\d\d:\d\d|\d{1,2} [A-Z][a-z]{2})$/, `how it came and when: ${row.note}`)
      assert.ok(row.said, `${row.name} keeps its whole sentence for a reader`)
    }
  }
})

test('an empty Withdrawn or Reached you list says so in words; the design’s world away keeps what the worlds withdrew as read (DLW build ruling 2026-11-06)', () => {
  const none = sectionRowsOf(drawn('Your world shown', 'shown', {reached: JSON.stringify([]), field: JSON.stringify({...JSON.parse(world.fixtures['Your world shown'].field), withdrawals: [], gone: []})}), 'Withdrawn')
  assert.deepEqual(none.rows, [])
  assert.equal(none.empty, 'Nothing withdrawn where you read.')
  assert.equal(sectionRowsOf(drawn('Your world shown', 'shown', {reached: JSON.stringify([])}), 'Reached you').empty, 'Nothing has reached you yet.')
  const away = drawn('A world away', 'shown'), withdrawn = away.slice(away.indexOf('>Withdrawn<'), away.indexOf('</ul>', away.indexOf('>Withdrawn<')))
  assert.doesNotMatch(away.slice(away.lastIndexOf('class="dp-sec"', away.indexOf('>Withdrawn<'))).slice(0, 400), /data-standing="unread"/, 'the world away reads what was withdrawn')
  assert.match(withdrawn, /Nothing withdrawn where you read\./)
})

test('the Star page’s Here now stands whole beside who brought each thing and whether they are away (SF11; DLW build ruling 2026-11-06)', () => {
  for (const fixture of ['A world away', 'Field, a star chosen']) {
    const {width, rows} = sectionRowsOf(drawn(fixture, 'star'), 'Here now')
    assert.ok(rows.length > 0 && rows.every(row => row.name), 'each row is named')
    for (const row of rows) assert.ok(row.name.length + row.note.length <= roomAt(width), `${fixture}: “${row.name}” beside “${row.note}” is cut off at ${width} px`)
  }
})

// ── round 35: a watch (DLW build ruling 2026-11-06, from manual §2 "from someone you watch" and §17.2 "watch") ───────────────────────
// A watch is a relation your world holds to another world: yours alone, the watched world never told and nothing counting who watches
// whom. Watch and Unwatch are pressed acts on a world chosen on the Space page; the map draws your watch line for you alone; what a world
// you watch shows that you already read reaches you "from someone you watch", never more.
const WATCHED = {...SNAPSHOT, world_watch: {state: 'held'}, world_watches: [{world_ref: 'world:me', watched_world_ref: 'world:stranger', watched_at_micros: '9000000'}]}
const resetWatching = () => store.chooseStarHand({other: null})

test('the field keeps the worlds your worlds watch, or says in words it keeps none; the map’s scene draws your watch between worlds the aperture holds (DLW build ruling 2026-11-06)', () => {
  const field = fieldOf(WATCHED)
  assert.deepEqual(field.watches, [{world_ref: 'world:me', watched_world_ref: 'world:stranger', at: 9000}])
  assert.equal(fieldOf(SNAPSHOT).watches, null, 'a field that keeps no watches reads none')
  assert.match(fieldOf(SNAPSHOT).watchWhy, /does not keep the worlds you watch/)
  assert.equal(fieldOf({...SNAPSHOT, world_watch: {state: 'unavailable', detail: 'Not here yet'}}).watchWhy, 'Not here yet')
  assert.deepEqual(fieldOf({...WATCHED, world_watches: [{world_ref: 'world:me'}, {watched_world_ref: 'world:mara'}]}).watches, [], 'a row that is not the contract’s is left out')
  const whole = model.fieldScene(field, {aperture: 'federated', viewAs: 'me'}, YOURS)
  assert.deepEqual(whole.watching, [{from: 'world:me', to: 'world:stranger'}], 'your watch, from your world to the one it watches')
  assert.deepEqual(whole.worlds.map(world => [world.ref, world.watched]), [['world:me', false], ['world:me:o-i', false], ['world:mara', false], ['world:stranger', true]])
  const shared = model.fieldScene(field, {aperture: 'shared', viewAs: 'me'}, YOURS)
  assert.deepEqual(shared.watching, [], 'no line to a world this aperture does not hold')
  assert.deepEqual(model.fieldScene(fieldOf(SNAPSHOT), {aperture: 'federated', viewAs: 'me'}, YOURS).watching, [])
})

test('Watch and Unwatch are asked of the field for your own world on the world chosen, and refuse in words where they cannot be asked (DLW build ruling 2026-11-06)', () => {
  const field = fieldOf(WATCHED), ask = (act, world, yours = YOURS, on = field) => atlasDevs.watchRequest(on, yours, {act, world})
  assert.deepEqual(ask('watch', 'world:mara'), {request: {kind: 'world-watch', world_ref: 'world:me', watched_world_ref: 'world:mara'}})
  assert.deepEqual(ask('unwatch', 'world:stranger'), {request: {kind: 'world-unwatch', world_ref: 'world:me', watched_world_ref: 'world:stranger'}})
  assert.deepEqual(ask('watch', 'world:stranger'), {refusal: 'You watch stranger already.'})
  assert.deepEqual(ask('unwatch', 'world:mara'), {refusal: 'You don’t watch mara.'})
  assert.deepEqual(ask('watch', null), {refusal: 'Choose a world first.'})
  assert.deepEqual(ask('watch', 'world:me:o-i'), {refusal: 'That world is yours already: there is nothing to watch.'})
  assert.deepEqual(ask('watch', 'world:gone'), {refusal: 'That world is no longer in the field you read.'})
  assert.deepEqual(ask('watch', 'world:mara', null), {refusal: 'Your world is not in the field yet: Link puts it there.'})
  assert.match(ask('watch', 'world:mara', YOURS, fieldOf(SNAPSHOT)).refusal, /does not keep the worlds you watch/)
  assert.deepEqual(atlasDevs.watchRequest({state: 'reading'}, YOURS, {act: 'watch', world: 'world:mara'}), {refusal: model.FIELD_BEING_READ})
  assert.deepEqual(atlasDevs.watchRequest({state: 'unavailable', reason: 'Gone'}, YOURS, {act: 'watch', world: 'world:mara'}), {refusal: 'Gone'})
  const unlinked = {...WATCHED, worlds: WATCHED.worlds.map(row => (row.world_ref === 'world:me' ? {...row, linked: false} : row))}
  assert.deepEqual(ask('watch', 'world:mara', YOURS, fieldOf(unlinked)).request?.kind, 'world-watch', 'a watch shows nothing of yours, so your world need not be linked')
  assert.equal(model.starNote({kind: 'world-watch'}, {state: 'watching'}), 'Your world watches it: what it shows that you read reaches you. It is yours alone: that world is not told.')
  assert.equal(model.starNote({kind: 'world-unwatch'}, {state: 'unwatched'}), 'Your world no longer watches it.')
})

test('the World binding watches and unwatches the world chosen on a press and keeps it chosen; only the person’s own press does it (DLW build ruling 2026-11-06)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(WATCHED))
  resetWatching()
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' },
    factory: async () => ({})})
  try {
    let binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.deepEqual(JSON.parse(binding.values.field).watches, [{world_ref: 'world:me', watched_world_ref: 'world:stranger', at: 9000}], 'the face is handed your watches')
    assert.equal(binding.standing.worldWatch?.disabled, 'Choose a world first.')
    binding.local.otherWorld('world:mara')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.values.otherWorld, 'world:mara')
    assert.equal(binding.standing.worldWatch, undefined)
    assert.equal(binding.standing.worldUnwatch?.disabled, 'You don’t watch mara.')
    assert.equal(binding.writes('worldWatch'), true)
    assert.equal(binding.writes('worldUnwatch'), false)
    await binding.write([{key: 'worldWatch', value: 1}])
    assert.deepEqual(asked.pop(), {kind: 'world-watch', world_ref: 'world:me', watched_world_ref: 'world:mara'})
    assert.equal(store.starHand().other, 'world:mara', 'the world stays chosen, to unwatch')
    binding.local.otherWorld('world:stranger')
    await atlasDevs.atlasGlobeBinding(readingWith()).write([{key: 'worldUnwatch', value: 2}])
    assert.deepEqual(asked.pop(), {kind: 'world-unwatch', world_ref: 'world:me', watched_world_ref: 'world:stranger'})
    binding.local.otherWorld('world:nowhere')
    assert.equal(atlasDevs.atlasGlobeBinding(readingWith()).values.otherWorld, undefined, 'a world no longer read is no longer chosen')
    // only the press: no declared row, no relay, no default
    const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
    ;(await import('../src/inhabitants/familyManifest.ts')).resetFamilyManifestsForTest()
    ;(await import('../src/inhabitants/worldShellFamilies.ts')).loadWorldShellFamilies()
    const keys = [...atlasDevs.WATCH_ACT_KEYS, 'otherWorld']
    assert.deepEqual([...atlasDevs.WATCH_ACT_KEYS], ['worldWatch', 'worldUnwatch'])
    assert.ok(!atlasDevs.ATLAS_DECLARED_ROWS.some(row => keys.includes(row.key)), 'no declared row of the World, which an agent may set, carries them')
    const device = atlasDevs.atlasDevice(inhabitantManifest('atlas-earth').faces.find(face => face.id === 'globe-engine'), readingWith())
    for (const key of atlasDevs.WATCH_ACT_KEYS) await assert.rejects(device.submit([{key, value: 1}]), /no owner write path/)
    binding.local.otherWorld('world:mara')
    atlasDevs.atlasGlobeBinding(readingWith())
    await atlasDevs.keepShownWorks()
    await atlasDevs.relayRevoked()
    assert.deepEqual(asked, [], 'nothing is watched or unwatched but by the press')
  } finally {
    store.bindSystemActs(null)
    resetWatching()
  }
  const source = await readFile(new URL('../src/projections/atlas/system/systemStore.ts', import.meta.url), 'utf8')
  assert.match(source, /answerWords: '', other: null[,}]/, 'the hand starts with no world chosen to watch')
})

test('what a world you watch shows that you already read reaches you from someone you watch; never your own, never more, never once unwatched (DLW build ruling 2026-11-06)', () => {
  const watchRows = field => atlasDevs.reachedRows(field).filter(row => row.how === 'you watch')
  const rows = watchRows(fieldOf(WATCHED))
  assert.deepEqual(rows.map(row => [row.name, row.said, row.at]), [['stranger shows a page', 'stranger shows Elsewhere', 0]])
  assert.match(rows[0].does, /^It reached you from stranger, a world you watch\.$/)
  assert.deepEqual(watchRows(fieldOf(SNAPSHOT)), [], 'unwatched, nothing reaches you from it')
  const ownWatched = {...WATCHED, world_watches: [{world_ref: 'world:me', watched_world_ref: 'world:me:o-i', watched_at_micros: '1'}]}
  assert.deepEqual(watchRows(fieldOf(ownWatched)), [], 'nothing of your own reaches you')
  const unread = {...WATCHED, clearings: WATCHED.clearings.filter(row => row.world_ref !== 'world:stranger')}
  assert.deepEqual(watchRows(fieldOf(unread)), [], 'what you do not read never reaches you for a watch')
  assert.ok(atlasDevs.reachedRows(fieldOf(WATCHED)).every(row => !/Mara’s plate/.test(row.said)), 'a world you do not watch shows nothing to you this way')
})

test('the Space page watches and unwatches the world chosen by a press, the map draws your watch line, and what it shows reaches you (manual §16.10; DLW build ruling 2026-11-06)', () => {
  const page = drawn('A world you watch', 'space')
  const unheld = label => new RegExp(`class="dp-action"(?: disabled="")?>${label}<`).test(page)
  for (const label of ['Watch', 'Unwatch']) assert.ok(unheld(label), `${label} is pressed, not held`)
  assert.match(page, />Watch</)
  assert.equal((page.match(/data-watch="/g) ?? []).length, 1, 'the map draws your one watch line')
  assert.equal((drawn('Field, a star chosen', 'space').match(/data-watch="/g) ?? []).length, 0, 'and none where you watch nothing')
  const names = [...page.matchAll(/<text [^>]*class="dp-ink-dim" style="([^"]*)">(teraphim|stranger|The Rosarium plates)</g)]
  assert.equal(names.length, 3, 'the little map names your world, the world you watch and the star')
  for (const [, style] of names) assert.match(style, /paint-order:stroke;stroke:var\(--dp-well\)/, 'each name is haloed, so no line under it runs through its letters')
  const {width, rows} = sectionRowsOf(drawn('A world you watch', 'shown'), 'Reached you')
  const watched = rows.filter(row => /^you watch · /.test(row.note))
  assert.equal(watched.length, 1, 'what a world you watch shows reaches you, so noted')
  for (const row of rows) assert.ok(row.name.length + row.note.length <= roomAt(width), `“${row.name}” beside “${row.note}” is cut off at ${width} px`)
})

test('the Space page’s At this star stands whole: a star’s words too long for the row stand short, whole to a reader (DLW build ruling 2026-11-06)', () => {
  for (const fixture of ['Field, a star chosen', 'A world you watch']) {
    const {width, rows} = sectionRowsOf(drawn(fixture, 'space'), 'At this star')
    assert.equal(rows.length, 4)
    for (const row of rows) assert.ok(row.name.length + row.note.length <= roomAt(width), `${fixture}: “${row.name}” is cut off at ${width} px`)
    const gathers = rows[0]
    assert.ok(gathers.name === 'Readings of the Rosarium plates' || gathers.said === 'Readings of the Rosarium plates', 'the lighter’s words stand whole, on the row or to a reader')
  }
})

// ── round 35: a search you made (DLW build ruling 2026-11-06, from manual §18.4: a mark, `@name = search`, whose Reach is the shared field) ─
// No owner keeps a mark a client can read with its Reach (AIKit keeps `@name = expression` with no Reach, and no kernel op reads it; the
// shell's Search keeps no alias), so the World names its own searches, in this window, and matches them over the held field: what is
// newly shown, said, offered or contributed there that holds every word of one reaches you "from your search @name".
const SEARCHED = {...SNAPSHOT, clearings: [...SNAPSHOT.clearings,
  {...c('world:mara', 'page:rosarium-readings', 'public', 'Rosarium plate readings'), shown_at_micros: '5000000000'},
  {...c('world:me', 'page:my-readings', 'public', 'Rosarium readings of mine'), shown_at_micros: '5000000000'}]}
const ROSE = {name: 'rose', words: 'rosarium readings', at: 1_000_000}
const resetSearching = () => store.chooseStarHand({searchLine: '', searches: [], search: null})

test('a search is kept as @name = plain words, and refused in words otherwise (DLW build ruling 2026-11-06; manual §18.4)', () => {
  const keep = (line, kept = []) => atlasDevs.keptSearch(line, kept, 7)
  assert.deepEqual(keep('@rose = Rosarium readings'), {search: {name: 'rose', words: 'Rosarium readings', at: 7}})
  assert.deepEqual(keep('  '), {refusal: 'Type @name = the words to look for.'})
  assert.deepEqual(keep('rosarium readings'), {refusal: 'A search is kept as @name = words: its name, then the words to look for.'})
  for (const line of ['@rose = @1 rosarium', '@rose = rosarium + readings', '@rose = ( rosarium )', '@why = ? x roses']) {
    assert.match(keep(line).refusal ?? '', /plain words/, `${line} is Search’s to answer`)
  }
  assert.match(keep(`@long = ${'word '.repeat(50)}`).refusal ?? '', /at most 200 characters/)
  const twelve = Array.from({length: 12}, (_, i) => ({name: `s${i}`, words: 'x', at: 1}))
  assert.match(keep('@more = roses', twelve).refusal ?? '', /at most 12/)
  assert.deepEqual(keep('@s3 = roses again', twelve), {search: {name: 's3', words: 'roses again', at: 7}}, 'kept again under its name, it is replaced')
})

test('what is newly shown in the field and holds every word of a search you made reaches you from that search; never your own, never older, never twice (DLW build ruling 2026-11-06)', () => {
  const searched = (snapshot, searches) => atlasDevs.reachedRows(fieldOf(snapshot), searches).filter(row => row.how.startsWith('@'))
  assert.deepEqual(searched(SEARCHED, [ROSE]).map(row => [row.name, row.said, row.how, row.does, row.at]),
    [['mara shows a page', 'mara shows Rosarium plate readings', '@rose', 'It reached you from your search @rose: “rosarium readings”.', 5_000_000]])
  assert.deepEqual(searched(SEARCHED, [{...ROSE, at: 6_000_000}]), [], 'what was shown before the search was made does not reach you for it')
  assert.deepEqual(searched(SEARCHED, [{...ROSE, words: 'rosarium roses'}]), [], 'every word must be there')
  assert.deepEqual(searched(SEARCHED, []), [], 'no search, nothing from one')
  const watchedToo = {...SEARCHED, world_watch: {state: 'held'}, world_watches: [{world_ref: 'world:me', watched_world_ref: 'world:mara', watched_at_micros: '1'}]}
  const rows = atlasDevs.reachedRows(fieldOf(watchedToo), [ROSE]).filter(row => /Rosarium plate readings/.test(row.said))
  assert.deepEqual(rows.map(row => row.how), ['you watch'], 'one row for one thing: it reached you once')
})

test('the World binding keeps and forgets a search on a press, and hands on what reached you from it; only the person’s own press does it (DLW build ruling 2026-11-06)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(SEARCHED))
  resetSearching()
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' },
    factory: async () => ({})})
  try {
    let binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.standing.searchKeep?.disabled, 'Type @name = the words to look for.')
    assert.equal(binding.standing.searchForget?.disabled, 'You keep no search yet: there is none to forget.')
    binding.local.searchLine('@rose = rosarium readings')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.values.searchLine, '@rose = rosarium readings')
    assert.equal(binding.standing.searchKeep, undefined)
    await binding.write([{key: 'searchKeep', value: 1}])
    const kept = store.starHand().searches
    assert.deepEqual(kept.map(one => [one.name, one.words]), [['rose', 'rosarium readings']])
    assert.equal(store.starHand().searchLine, '', 'the line is cleared once kept')
    store.chooseStarHand({searches: [{...kept[0], at: 1_000_000}]})
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.deepEqual(JSON.parse(binding.values.fieldSearches), [{name: 'rose', words: 'rosarium readings', at: 1_000_000}])
    assert.deepEqual(JSON.parse(binding.values.reached).filter(row => row.how === '@rose').map(row => row.said), ['mara shows Rosarium plate readings'])
    assert.equal(binding.standing.searchForget?.disabled, 'Choose a search first.', 'with a search kept and none chosen, Forget says to choose one')
    binding.local.fieldSearch('rose')
    assert.equal(atlasDevs.atlasGlobeBinding(readingWith()).standing.searchForget, undefined)
    await atlasDevs.atlasGlobeBinding(readingWith()).write([{key: 'searchForget', value: 2}])
    assert.deepEqual(store.starHand().searches, [])
    assert.deepEqual(asked, [], 'a search asks the field nothing: it is matched over what the window already reads')
    const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
    ;(await import('../src/inhabitants/familyManifest.ts')).resetFamilyManifestsForTest()
    ;(await import('../src/inhabitants/worldShellFamilies.ts')).loadWorldShellFamilies()
    const keys = [...atlasDevs.SEARCH_ACT_KEYS, 'searchLine', 'fieldSearch']
    assert.deepEqual([...atlasDevs.SEARCH_ACT_KEYS], ['searchKeep', 'searchForget'])
    assert.ok(!atlasDevs.ATLAS_DECLARED_ROWS.some(row => keys.includes(row.key)), 'no declared row of the World, which an agent may set, carries them')
    const device = atlasDevs.atlasDevice(inhabitantManifest('atlas-earth').faces.find(face => face.id === 'globe-engine'), readingWith())
    for (const key of atlasDevs.SEARCH_ACT_KEYS) await assert.rejects(device.submit([{key, value: 1}]), /no owner write path/)
  } finally {
    store.bindSystemActs(null)
    resetSearching()
  }
  const source = await readFile(new URL('../src/projections/atlas/system/systemStore.ts', import.meta.url), 'utf8')
  assert.match(source, /other: null, searchLine: '', searches: \[\], search: null\}/, 'the hand starts with no search kept')
})

test('the Shown page keeps and forgets a search by a press, lists what you keep whole, and notes what reached you from one (manual §16.10, §18.4; DLW build ruling 2026-11-06)', () => {
  const page = drawn('A search you made', 'shown')
  const unheld = label => new RegExp(`class="dp-action"(?: disabled="")?>${label}<`).test(page)
  for (const label of ['Keep', 'Forget']) assert.ok(unheld(label), `${label} is pressed, not held`)
  const kept = sectionRowsOf(page, 'Your searches')
  assert.deepEqual(kept.rows.map(row => row.name), ['@rose', '@circle'])
  for (const row of kept.rows) assert.ok(row.name.length + row.note.length <= roomAt(kept.width), `“${row.name}” beside “${row.note}” is cut off at ${kept.width} px`)
  const reached = sectionRowsOf(page, 'Reached you')
  assert.equal(reached.rows.filter(row => /^@rose · /.test(row.note)).length, 1, 'what reached you from a search is noted with its name')
  for (const row of reached.rows) assert.ok(row.name.length + row.note.length <= roomAt(reached.width), `“${row.name}” beside “${row.note}” is cut off`)
  assert.match(sectionRowsOf(drawn('Your world shown', 'shown'), 'Your searches').empty ?? '', /No search kept/)
})

test('every design state at the Field reads what the worlds withdrew: no state draws Withdrawn unread (DLW build ruling 2026-11-06)', () => {
  for (const fixture of ['Your world shown', 'A world away', 'A world you watch', 'A search you made']) {
    const page = drawn(fixture, 'shown'), at = page.indexOf('>Withdrawn<')
    assert.doesNotMatch(page.slice(page.lastIndexOf('class="dp-sec"', at), page.indexOf('</ul>', at)), /data-standing="unread"/, `${fixture} reads Withdrawn`)
  }
})

/** An act's cell on a drawn page, by its label: whether it stands dimmed, and its Info line (where a dimmed act says why). */
const actionOf = (page, label) => {
  const at = page.search(new RegExp(`class="dp-action"(?: disabled="")?(?: data-hold="true"[^>]*)?>(?:<i [^>]*></i>)?${label}<`))
  assert.ok(at >= 0, `the page draws ${label}`)
  const cell = page.slice(page.lastIndexOf('<div class="dp-cell dp-cell--action"', at), at)
  return {dimmed: /data-disabled="true"/.test(cell), info: (cell.match(/data-i="([^"]*)"/)?.[1] ?? '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')}
}

test('an act on the world chosen to watch that would change nothing stands dimmed with its reason, on the design as in the shell (DLW build ruling 2026-11-06)', () => {
  const watched = drawn('A world you watch', 'space')
  assert.ok(actionOf(watched, 'Watch').dimmed, 'Watch stands dimmed on a world you watch')
  assert.match(actionOf(watched, 'Watch').info, /You watch stranger already\./)
  assert.ok(!actionOf(watched, 'Unwatch').dimmed, 'Unwatch stands live on a world you watch')
  const unwatched = drawn('A world you watch', 'space', {otherWorld: 'world:mara'})
  assert.ok(actionOf(unwatched, 'Unwatch').dimmed, 'Unwatch stands dimmed on a world you do not watch')
  assert.match(actionOf(unwatched, 'Unwatch').info, /You don’t watch mara\./)
  assert.ok(!actionOf(unwatched, 'Watch').dimmed, 'Watch stands live on a world you do not watch')
  const none = drawn('A world you watch', 'space', {otherWorld: undefined})
  for (const label of ['Watch', 'Unwatch']) assert.match(actionOf(none, label).info, /Choose a world first\./, `${label} asks for a world first`)
  const held = drawn('A world you watch', 'space', {otherWorld: 'world:mara'})
  const shell = renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['Your world shown'], ...world.fixtures['A world you watch'], otherWorld: 'world:mara'},
    set() {}, nav: {}, page: 'space', setPage() {}, standing: {worldWatch: {disabled: 'The shared field is being read.'}}}))
  assert.match(actionOf(shell, 'Watch').info, /The shared field is being read\./, 'the shell’s own reason stands first')
  assert.ok(!actionOf(held, 'Watch').dimmed)
})

test('Keep and Forget stand dimmed with their reasons where they would change nothing: no line typed, no search kept, none chosen (DLW build ruling 2026-11-06)', () => {
  const none = drawn('Your world shown', 'shown')
  assert.ok(actionOf(none, 'Forget').dimmed, 'Forget stands dimmed with no search kept')
  assert.match(actionOf(none, 'Forget').info, /You keep no search yet: there is none to forget\./)
  assert.ok(actionOf(none, 'Keep').dimmed, 'Keep stands dimmed with no line typed')
  assert.match(actionOf(none, 'Keep').info, /Type @name = the words to look for\./)
  const kept = drawn('A search you made', 'shown')
  assert.ok(!actionOf(kept, 'Forget').dimmed, 'Forget stands live on the search chosen')
  assert.ok(!actionOf(kept, 'Keep').dimmed, 'Keep stands live on a line typed')
  const unchosen = drawn('A search you made', 'shown', {fieldSearch: undefined})
  assert.match(actionOf(unchosen, 'Forget').info, /Choose a search first\./)
})

test('Accept, Refuse and Take back stand dimmed with the binding’s own reasons on the contribution chosen, on the design as in the shell (SF07; DLW build ruling 2026-11-06)', () => {
  const waiting = drawn('Contributions', 'contribute')
  assert.ok(!actionOf(waiting, 'Accept').dimmed, 'Accept stands live on a contribution waiting for you')
  assert.match(actionOf(waiting, 'Refuse').info, /Say why, in your own words\./, 'Refuse asks for your words first')
  assert.ok(!actionOf(drawn('Contributions', 'contribute', {answerWords: 'Not this rose.'}), 'Refuse').dimmed)
  assert.ok(actionOf(waiting, 'Take back').dimmed)
  assert.match(actionOf(waiting, 'Take back').info, /Only the one who contributed it takes it back\./)
  const yours = drawn('Contributions', 'contribute', {contribution: 'contribution:teraphim-asks'})
  for (const label of ['Accept', 'Refuse']) assert.match(actionOf(yours, label).info, /Only the owner of the world it was contributed to answers it\./, `${label} is not yours to answer`)
  assert.ok(!actionOf(yours, 'Take back').dimmed, 'your own you take back')
  const none = drawn('Contributions', 'contribute', {contribution: undefined})
  for (const label of ['Accept', 'Refuse', 'Take back']) assert.match(actionOf(none, label).info, /Choose a contribution first\./, `${label} asks for a contribution first`)
})

// ── the same work in two worlds (SF09; STORIES SF09; manual §17.2 "Contribute", §8 "readings that disagree laid side by side") ───────────

const MARAS_FOURTH = {world_ref: 'world:mara', part_ref: 'page:maras-fourth', star_ref: null}
const kSame = (ref, from, into, to, beside, words, state) => ({...k(ref, from, into, to, 'same', words, state), beside})
/** mara shows a page by the name of yours; your claim that they are one, and a claim of stranger's on mara's plate beside a page of theirs */
const SAMED = {...SNAPSHOT, clearings: [...SNAPSHOT.clearings, c('world:mara', 'page:maras-fourth', 'public', 'A reading of the fourth plate'),
  c('world:stranger', 'palace:the-book', 'public', 'The book')],
  world_contribution: {state: 'held'}, world_contributions: [
    kSame('contribution:me-same', 'world:me', 'world:mara', MARAS_FOURTH, {world_ref: 'world:me', part_ref: 'page:reading-of-plate-4', star_ref: null}, 'The same plate, read twice.', 'waiting'),
    kSame('contribution:stranger-same', 'world:stranger', 'world:mara', MARAS_PAGE, {world_ref: 'world:stranger', part_ref: 'page:elsewhere', star_ref: null}, 'Mine is hers.', 'refused'),
    {...k('contribution:bare-same', 'world:stranger', 'world:mara', MARAS_PAGE, 'same', 'No part beside it', 'waiting')},
  ]}
const sameScene = (snapshot, viewAs = 'me') => model.fieldScene(fieldOf(snapshot), {aperture: 'federated', viewAs}, YOURS)
const accepted = snapshot => ({...snapshot, world_contributions: snapshot.world_contributions.map(row => (row.contribution_ref === 'contribution:me-same' ? {...row, state: 'accepted'} : row))})
const withoutClaims = snapshot => ({...snapshot, world_contributions: []})
const MINE_FOURTH = JSON.stringify(['world:me', 'page:reading-of-plate-4']), MARAS_FOURTH_ID = JSON.stringify(['world:mara', 'page:maras-fourth'])

test('two things with one name in two worlds stay two until someone claims they are one; a claim sets a part beside another, read as a contribution of the kind same (SF09)', () => {
  const field = fieldOf(SAMED)
  assert.deepEqual(field.contributions.map(row => [row.contribution_ref, row.what, row.beside?.part_ref ?? null]),
    [['contribution:me-same', 'same', 'page:reading-of-plate-4'], ['contribution:stranger-same', 'same', 'page:elsewhere']], 'a claim with no part beside it is not the contract’s, and is left out')
  const apart = model.fieldGraph(sameScene(withoutClaims(SAMED)))
  assert.equal(apart.nodes.filter(node => node.kind === 'work').length, 0, 'unclaimed, the two pages by one name stay two')
  assert.ok(apart.nodes.some(node => node.id === MINE_FOURTH) && apart.nodes.some(node => node.id === MARAS_FOURTH_ID))
  const waiting = model.fieldGraph(sameScene(SAMED))
  const works = waiting.nodes.filter(node => node.kind === 'work')
  assert.deepEqual(works.map(node => node.label), ['A reading of the fourth plate'], 'claimed, the work stands once, named as what the claim stands on')
  const tied = waiting.edges.filter(edge => edge.to === works[0].id)
  assert.deepEqual(tied.map(edge => [edge.from, edge.tie]).sort(), [[MARAS_FOURTH_ID, 'claimed'], [MINE_FOURTH, 'claimed']], 'each world’s part tied to it, so the two readings stand side by side; claimed while it waits')
  assert.ok(!waiting.edges.some(edge => edge.from === JSON.stringify(['world:stranger', 'page:elsewhere']) && edge.tie !== 'shows'), 'a refused claim holds nothing as one')
  assert.deepEqual(model.fieldGraph(sameScene(accepted(SAMED))).edges.filter(edge => edge.tie === 'same' || edge.tie === 'claimed').map(edge => edge.tie), ['same', 'same'], 'accepted, it is held one work')
  assert.equal(model.fieldGraph(sameScene(SAMED, 'field')).nodes.filter(node => node.kind === 'work').length, 0, 'a claim that waits is its two worlds’ alone: the field does not see it')
  assert.equal(model.fieldGraph(sameScene(accepted(SAMED), 'field')).nodes.filter(node => node.kind === 'work').length, 1, 'accepted, the field reads it')
  const unseen = {...SAMED, world_contributions: SAMED.world_contributions.map(row => (row.beside ? {...row, beside: {...row.beside, part_ref: null}} : row))}
  assert.equal(model.fieldGraph(sameScene(unseen)).nodes.filter(node => node.kind === 'work').length, 0, 'a part beside it you may not read holds nothing as one: it lies under the cloud')
  const three = {...accepted(SAMED), clearings: [...SAMED.clearings, c('world:stranger', 'page:strangers-fourth', 'public', 'The fourth plate')],
    world_contributions: [...accepted(SAMED).world_contributions, kSame('contribution:stranger-fourth', 'world:stranger', 'world:me', MY_PAGE,
      {world_ref: 'world:stranger', part_ref: 'page:strangers-fourth', star_ref: null}, 'Ours too.', 'accepted')]}
  const one = model.fieldGraph(sameScene(three))
  assert.equal(one.nodes.filter(node => node.kind === 'work').length, 1, 'a third part claimed one with either is the same one work')
  assert.equal(one.edges.filter(edge => edge.tie === 'same').length, 3)
})

test('a part another shows by the name of one of yours is tied to your world for you alone, matched in your window: your unshown copy reaches no one (SF09)', () => {
  const names = ['The study', 'The book', 'river']
  const graph = model.fieldGraph(sameScene(withoutClaims(SAMED)), [...names, 'A reading of the fourth plate'])
  const matched = graph.edges.filter(edge => edge.tie === 'match')
  assert.deepEqual(matched.map(edge => [edge.from, edge.to]).sort(), [['world:me', JSON.stringify(['world:stranger', 'palace:the-book'])], ['world:me', MARAS_FOURTH_ID]].sort(),
    'what mara shows by the name of your page and what stranger shows by the name of your book are tied to your world')
  assert.equal(model.fieldGraph(sameScene(withoutClaims(SAMED), 'field'), names).edges.filter(edge => edge.tie === 'match').length, 0, 'as the field sees you, no match is drawn')
  assert.deepEqual(model.fieldGraph(sameScene(SAMED), [...names, 'A reading of the fourth plate']).edges.filter(edge => edge.tie === 'match').map(edge => edge.to),
    [JSON.stringify(['world:stranger', 'palace:the-book'])], 'one you hold as one work with yours is matched no more')
  assert.equal(model.nameKey('  A Réading of the FOURTH plate! '), model.nameKey('a reading of the fourth plate'), 'names match whatever the case, accents, spaces or marks')
  assert.notEqual(model.nameKey('A reading of the fourth plate'), model.nameKey('A reading of the fifth plate'))
  const targets = atlasDevs.contributionTargets(fieldOf(SAMED), names)
  assert.match(targets.find(row => row.id === JSON.stringify(['world:stranger', 'palace:the-book', ''])).does, /You hold one by this name/)
  assert.doesNotMatch(targets.find(row => row.id === MARAS_PAGE_ID).does, /You hold one by this name/)
  assert.equal(targets.find(row => row.id === MARAS_PAGE_ID).name, 'Mara’s plate', 'a part’s own name rides with it, for the face to match')
})

test('a claim of the same work is asked of the field for your own world on a part another shows, beside a part your world shows, and refuses in words otherwise (SF09)', () => {
  const MARAS_FOURTH_TARGET = JSON.stringify(['world:mara', 'page:maras-fourth', ''])
  const mine = model.shownKey('page:reading-of-plate-4', null)
  const ask = act => atlasDevs.contributionRequest(fieldOf(SAMED), YOURS, {act: 'contribute', what: 'same', words: 'The same plate, read twice.', ...act}, NONCE)
  assert.deepEqual(ask({to: MARAS_FOURTH_TARGET, beside: mine}).request, {kind: 'world-claim-same', contribution_ref: `contribution:${NONCE.toString(36)}:me`, world_ref: 'world:me',
    to: {world_ref: 'world:mara', part_ref: 'page:maras-fourth'}, beside: {part_ref: 'page:reading-of-plate-4'}, words: 'The same plate, read twice.'})
  assert.deepEqual(ask({to: MARAS_FOURTH_TARGET, beside: model.shownKey('page:for-the-circle', 'star:rosarium')}).request.beside, {part_ref: 'page:for-the-circle', star_ref: 'star:rosarium'})
  assert.equal(ask({to: 'contribution:me-same', beside: mine}).refusal, 'A work is claimed the same as something a world shows, not as a contribution.')
  assert.equal(ask({to: MARAS_FOURTH_TARGET, beside: null}).refusal, 'Choose the part of yours it is the same work as.')
  assert.equal(ask({to: MARAS_FOURTH_TARGET, beside: model.shownKey('page:never-shown', null)}).refusal, 'That part of yours is no longer shown: show it first.')
  assert.equal(ask({to: MARAS_FOURTH_TARGET, beside: mine, words: ' '}).refusal, 'Say why they are one work.')
  const rows = atlasDevs.contributionRows(fieldOf(SAMED))
  assert.deepEqual(rows.map(row => row.name), ['your claim of the same work on A reading of the fourth plate', 'stranger’s claim of the same work on Mara’s plate'])
  assert.match(rows[0].does, /It sets your A reading of the fourth plate beside it, as one work\./)
  const away = {...SAMED, clearings: SAMED.clearings.filter(row => row.part_ref !== 'page:elsewhere')}
  assert.match(atlasDevs.contributionRows(fieldOf(away))[1].does, /It sets a part of stranger’s you do not read beside it/, 'a part beside it you no longer read is named by its world alone')
  const reached = atlasDevs.reachedRows(fieldOf({...SAMED, world_contributions: [kSame('contribution:mara-same', 'world:mara', 'world:me', MY_PAGE,
    {world_ref: 'world:mara', part_ref: 'page:maras-fourth', star_ref: null}, 'Hers is yours.', 'waiting')]}))
  const claim = reached.filter(row => /claim/.test(row.name))
  assert.deepEqual(claim.map(row => [row.name, row.how]), [['mara’s claim on your page', 'to you']], 'a claim on what you show reaches you, short, from its claimant')
  assert.match(claim[0].said, /mara’s claim of the same work on A reading of the fourth plate/)
})

test('the World binding claims the same work from the view’s own hand on a hold, the part beside it chosen there; only the person’s own press does it (SF09)', async () => {
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.publishField(fieldOf(SAMED))
  resetContributing()
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(readingWith())
    const mine = model.shownKey('page:reading-of-plate-4', null)
    binding.local.contributeTo(JSON.stringify(['world:mara', 'page:maras-fourth', '']))
    binding.local.contributeWhat('same')
    binding.local.contributeWords('The same plate, read twice.')
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.values.contributeWhat, 'same')
    assert.equal(binding.standing.contribute?.disabled, 'Choose the part of yours it is the same work as.')
    binding.local.contributeBeside(model.shownKey('page:not-yours', null))
    assert.equal(atlasDevs.atlasGlobeBinding(readingWith()).values.contributeBeside, undefined, 'a part your world does not show is never chosen')
    binding.local.contributeBeside(mine)
    binding = atlasDevs.atlasGlobeBinding(readingWith())
    assert.equal(binding.values.contributeBeside, mine)
    assert.equal(binding.standing.contribute, undefined)
    assert.ok(JSON.parse(binding.values.contributeTargets).every(row => !row.value.startsWith('[') || typeof row.name === 'string'), 'each part to contribute to carries its own name')
    assert.deepEqual(JSON.parse(binding.values.field).sames.map(row => row.contribution_ref), ['contribution:me-same', 'contribution:stranger-same'], 'the scene is handed the claims of the same work')
    await binding.write([{key: 'contribute', value: 1}])
    const sent = asked.pop()
    assert.deepEqual([sent.kind, sent.to, sent.beside], ['world-claim-same', {world_ref: 'world:mara', part_ref: 'page:maras-fourth'}, {part_ref: 'page:reading-of-plate-4'}])
    assert.equal(store.starHand().contributeBeside, null, 'claimed, the part beside it is no longer in the hand')
    // only the press: no declared row carries the part beside it, and nothing else asks
    assert.ok(!atlasDevs.ATLAS_DECLARED_ROWS.some(row => row.key === 'contributeBeside'), 'no declared row of the World, which an agent may set, carries it')
    binding.local.contributeBeside(mine)
    atlasDevs.atlasGlobeBinding(readingWith())
    await atlasDevs.keepShownWorks()
    await atlasDevs.relayRevoked()
    assert.deepEqual(asked, [], 'nothing is claimed but by the hold')
  } finally {
    store.bindSystemActs(null)
    resetContributing()
  }
  const source = await readFile(new URL('../src/projections/atlas/system/systemStore.ts', import.meta.url), 'utf8')
  assert.match(source, /contributeWords: '', contributeBeside: null,/, 'the hand starts with no part beside')
})

test('the Contribute page claims the same work by a hold, the part of yours beside it chosen, matched by name first; the Graph page draws the work once and your match for you alone (SF09)', () => {
  const page = drawn('The same work', 'contribute')
  assert.match(page, />Beside it</)
  const kinds = page.slice(page.indexOf('>Kind<'), page.indexOf('>Words<'))
  assert.match(kinds, /Same work/, 'the Kind chooser offers Same work')
  const yours = page.slice(page.indexOf('>Beside it<'), page.indexOf('>Answer<'))
  assert.doesNotMatch(yours, /data-disabled="true"/, 'the part beside it is chosen while the kind is Same work')
  assert.match(yours, /A reading of the fourth plate/)
  const other = drawn('The same work', 'contribute', {contributeWhat: 'question'})
  const dimmed = other.slice(other.indexOf('>Beside it<') - 400, other.indexOf('>Answer<'))
  assert.match(dimmed, /data-disabled="true"/)
  assert.match(dimmed, /Choose Same work as the kind/, 'with another kind, the part beside it stands dimmed, saying why')
  const unshownHint = drawn('The same work', 'contribute', {contributeTo: '["world:stranger","palace:the-book",""]'})
  assert.match(unshownHint, /You hold The book by that name but do not show it: show it first to set it beside\./, 'your unshown copy is named to you alone, to show first')
  assert.match(actionOf(page, 'Contribute').info, /Hold to do it/, 'a claim sends your words into another’s world: it is held')
  const rows = sectionRowsOf(page, 'Contributions')
  assert.deepEqual(rows.rows.map(row => row.name), ['your claim of the same work on A reading of the fourth plate'])
  const graph = drawn('The same work', 'graph')
  assert.equal((graph.match(/data-work="/g) ?? []).length, 1, 'the Graph page draws the work once')
  assert.equal((graph.match(/data-tie="same"/g) ?? []).length, 2, 'with each world’s part tied to it')
  assert.equal((graph.match(/data-tie="match"/g) ?? []).length, 1, 'and, for you alone, what stranger shows by the name of your book')
  assert.equal((drawn('The same work', 'graph', {viewAs: 'field'}).match(/data-tie="match"/g) ?? []).length, 0, 'as the field sees you, no match')
  assert.equal((drawn('Your world shown', 'graph').match(/data-work="/g) ?? []).length, 0, 'and no work where nothing is claimed')
})

// ── round 37: the Graph page is the face of SF09's rings; a page shows its own content whatever Look says ──────────────────────────────

/** The Graph page's field graph as drawn, read as the little map is read: each name's box, each node's mark (a world, a star, a part shown,
 * a work's ring) and the corner's count. */
const fieldGraphMapOf = page => fieldMapOf(page, 'The graph')
const extentOf = marks => {
  const nodes = marks.filter(mark => !mark.what.startsWith('corner'))
  return {x: Math.max(...nodes.map(mark => mark.x1)) - Math.min(...nodes.map(mark => mark.x0)), y: Math.max(...nodes.map(mark => mark.y1)) - Math.min(...nodes.map(mark => mark.y0))}
}
const crowdedField = (v, more, stars) => { const field = JSON.parse(v.field)
  return JSON.stringify({...field,
    worlds: [...field.worlds, ...Array.from({length: more}, (_, i) => ({world_ref: `world:neighbour-${i}`, body: {body_ref: `body:n${i}`}, linked: true, mine: false}))],
    stars: [...field.stars, ...Array.from({length: stars}, (_, i) => ({star_ref: `star:s${i}`, name: `A star with a long name ${i}`, gathers: 'x', comes: 'anyone', lit_by: 'world:mara', mine: false}))]}) }

test('the Graph page’s field graph fills its display and, by the little map’s law, draws no name over another, over a node or a work’s ring, or over its corner’s count; a crowded field leaves a name out rather than overprint it (SF09; DLW build ruling 2026-11-06)', () => {
  for (const fixture of ['Your world shown', 'The same work']) {
    const map = fieldGraphMapOf(drawn(fixture, 'graph'))
    assert.deepEqual(clashes(map), [], fixture)
    assert.deepEqual(map.names.map(name => name.text).sort(), ['Far', 'The Rosarium plates', 'mara', 'o-i', 'stranger', 'teraphim'], `${fixture}: with room for each, each world and star is named`)
    const spread = extentOf(map.marks)
    assert.ok(spread.x >= map.w * .75 && spread.y >= map.h * .6, `${fixture}: the graph fills its display, ${Math.round(spread.x)} by ${Math.round(spread.y)} of ${map.w} by ${map.h}`)
    const corner = map.marks.find(mark => mark.what.startsWith('corner'))
    assert.deepEqual(map.marks.filter(mark => mark !== corner && overlap(mark, corner)).map(mark => mark.what), [], `${fixture}: no node stands under the corner’s count`)
  }
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  for (const [more, stars] of [[3, 2], [12, 5], [20, 8]]) {
    const map = fieldGraphMapOf(drawn('Your world shown', 'graph', {field: crowdedField(v, more, stars)}))
    assert.deepEqual(clashes(map), [], `${more} more worlds and ${stars} more stars`)
    assert.ok(map.names.length >= 4, `${more} more worlds and ${stars} more stars: those with room are named`)
    if (more >= 12) assert.ok(map.names.length < 6 + more + stars, 'some names had no room and are left out')
  }
  // at the big size, what each world shows and each work are named too, by the same law
  const big = renderToStaticMarkup(world.full({v: {...v, ...world.fixtures['The same work'], view: 'graph'}, set() {}, nav: {}, standing: {}}))
  assert.match(big, /data-work="A reading of the fourth plate"/)
})

test('the Graph page’s Display section sets its dials two to a row, so Node size, Link width, Text fade and Reset stand within the band (DLW build ruling 2026-11-06)', () => {
  const page = drawn('Your world shown', 'graph')
  const display = page.slice(page.indexOf('<div class="dp-sec-label">Display</div>'), page.indexOf('<div class="dp-sec-label">Display</div>') + 200)
  assert.match(display, /grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/)
  for (const label of ['Node size', 'Link width', 'Text fade']) assert.ok(page.includes(`>${label}<`), label)
})

test('a page of the whole World shows its own content whatever Look says: at the Field scale with Look set to Graph, Space, Star, Said, Talk, Work, Shown and Contribute draw the field and keep its sections, and only the Graph page draws the graph (DLW build ruling 2026-11-06)', () => {
  for (const page of ['space', 'star', 'said', 'talk', 'work', 'shown', 'contribute']) {
    const html = drawn('Your world shown', page, {view: 'graph'})
    assert.match(html, /aria-label="The field"/, `${page}: the field’s map`)
    assert.doesNotMatch(html, /No reading of the scale/, `${page}: never the Earth’s empty scale`)
  }
  const space = drawn('Your world shown', 'space', {view: 'graph'})
  for (const section of ['Star', 'At the star', 'Light a star', 'Watch', 'Reach']) assert.match(space, new RegExp(`<div class="dp-sec-label">${section}</div>`), `Space keeps ${section}`)
  const edge = page => page.match(/data-i="past the edge\|([^"]*?) — What lies/)?.[1]
  assert.equal(edge(drawn('Your world shown', 'space', {view: 'space'})), 'nothing')
  assert.equal(edge(space), 'nothing', 'Space’s Reach reads what lies past the edge as it does under Look set to Space')
  assert.match(drawn('Your world shown', 'graph', {view: 'graph'}), /aria-label="The graph"/, 'the Graph page draws the graph')
  assert.match(drawn('Your world shown', 'graph', {view: 'space'}), /aria-label="The graph"/, 'whatever Look says')
})

test('under Look set to Graph, the Space page says in words why its map stays the field, first in its words: the Graph page and the compact face draw the graph, and each page keeps its own (O-I #858 r43)', () => {
  const said = html => html.match(/data-i="The field\|([^"]*)"/)?.[1] ?? ''
  for (const page of ['space', 'star', 'said', 'talk', 'work', 'shown', 'contribute']) {
    const words = said(drawn('Your world shown', page, {view: 'graph'}))
    assert.match(words, /^Look is set to Graph: the Graph page draws this field by connection, and so does the World’s compact face;/, `${page}: why its map is the field, first, where the status bar’s line shows it`)
    assert.match(words, /each page of the World keeps its own/, `${page}: the page’s own content`)
  }
  assert.doesNotMatch(said(drawn('Your world shown', 'space', {view: 'space'})), /Look is set to Graph/, 'under Look set to Space, nothing to say')
  const compact = renderToStaticMarkup(world.compact({v: {...world.defaults, ...world.fixtures['Your world shown'], view: 'graph'}, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  assert.match(compact, /aria-label="The graph"/, 'the compact face follows Look')
})

// ── round 37: a world's agent asked at a star (O-I #858, SF10; manual §2 and §17.2: "The agent that keeps that world is there to talk to") ──
//
// Your world, gathered at a star, asks another world's agent there by its name, its role or the exact instance running; the field serves
// the ask and the agent's answer to the two worlds alone (shared-field/spacetimedb one-field-live-acceptance, SF10). The answer names the
// parts of its world it drew on, each only while you may see it. Asking is pressed; taking an ask back is held, as unsaying is.

const ASKED = {...SNAPSHOT,
  clearings: [...SNAPSHOT.clearings, c('world:mara', 'page:maras-reading', 'star', 'Mara’s reading of the second plate', 'star:rosarium')],
  agent_ask: {state: 'held'},
  agent_asks: [
    {ask_ref: 'ask:me-librarian', star_ref: 'star:rosarium', world_ref: 'world:me', to_world_ref: 'world:mara', by: 'role', address: 'librarian', words: 'Which plate shows the white rose?',
      asked_at_micros: micros(AT), answer: {agent: {name: 'Thoth', role: 'librarian', instance: null}, words: 'The second.',
        cites: [{part_ref: 'page:maras-reading', star_ref: 'star:rosarium'}, {part_ref: null, star_ref: 'star:rosarium'}], offer_ref: null, answered_at_micros: micros(AT + 60_000)}},
    {ask_ref: 'ask:mara-hermes', star_ref: 'star:rosarium', world_ref: 'world:mara', to_world_ref: 'world:me', by: 'name', address: 'Hermes', words: 'Where does your circle open?',
      asked_at_micros: micros(AT + 120_000), answer: null},
    {ask_ref: 'ask:mood', star_ref: 'star:rosarium', world_ref: 'world:mara', to_world_ref: 'world:me', by: 'mood', address: 'x', words: 'Hey', asked_at_micros: micros(AT), answer: null},
  ],
}
const askedField = () => {
  const field = model.heldFieldOf(ASKED)
  assert.equal(field.state, 'read')
  return field
}

test('what was asked of a world’s agent at a star reads as your two worlds’ own, each answer under its ask, a part it drew on named while you may see it (SF10)', () => {
  const field = askedField()
  assert.deepEqual(field.asks.map(ask => ask.ask_ref), ['ask:me-librarian', 'ask:mara-hermes'], 'an ask that is not the contract’s is left out')
  const rosarium = rosariumOf(field)
  assert.deepEqual(rosarium.asks.map(ask => [model.agentAskLine(ask), model.agentAnswerLine(ask)]), [
    ['You asked mara’s librarian: Which plate shows the white rose?', 'Thoth answered: The second. From Mara’s reading of the second plate, a part no longer shown here.'],
    ['mara asked Hermes, your agent: Where does your circle open?', 'Waiting for your agent’s answer.']])
  assert.deepEqual(rosarium.asks.map(ask => ask.mine), [true, false])
  assert.deepEqual(model.fieldScene(field, {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === 'star:far').asks, [], 'nothing was asked at another star')
  const none = model.heldFieldOf({...ASKED, agent_ask: {state: 'unavailable', detail: 'This field’s service does not keep what is asked of a world’s agent yet'}})
  assert.equal(none.asks, null)
  assert.match(none.askWhy, /does not keep what is asked of a world’s agent/)
  assert.equal(rosariumOf(none).asks, null)
  // what the binding hands the face reads back as the same asks
  const handed = model.fieldSceneOf({...field, asks: field.asks, askWhy: null}, {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === 'star:rosarium')
  assert.deepEqual(handed.asks, rosarium.asks)
})

test('asking a world’s agent at a star is asked of the field for your own world, and each refusal is words (SF10)', () => {
  const field = askedField()
  const ask = act => model.starRequest(field, YOURS, act, AT)
  const act = more => ({act: 'ask', star: 'star:rosarium', world: 'world:mara', by: 'role', address: ' librarian ', words: '  And the red one?  ', ...more})
  const made = ask(act({}))
  assert.ok('request' in made, JSON.stringify(made))
  assert.match(made.request.ask_ref, /^ask:[A-Za-z0-9._:-]+$/, 'a new ask is named once')
  assert.deepEqual({...made.request, ask_ref: undefined}, {kind: 'world-agent-ask', ask_ref: undefined, star_ref: 'star:rosarium', world_ref: 'world:me', to_world_ref: 'world:mara',
    by: 'role', address: 'librarian', words: 'And the red one?'})
  assert.equal(ask(act({by: 'name', address: 'Thoth'})).request.address, 'Thoth')
  assert.equal(ask(act({by: 'instance', address: 'actuation:generation:g7'})).request.by, 'instance')
  assert.deepEqual(ask({act: 'unask', star: 'star:rosarium', ask: 'ask:me-librarian'}), {request: {kind: 'world-agent-unask', ask_ref: 'ask:me-librarian'}})
  const refusals = {
    'not here': [ask(act({star: 'star:far', world: 'world:stranger'})), /only while it is gathered there/],
    'no world': [ask(act({world: null})), /Choose the world whose agent to ask/],
    'your own': [ask(act({world: 'world:me'})), /another world’s agent/],
    'waiting at the edge': [ask(act({world: 'world:stranger'})), /not gathered at this star/],
    'no way': [ask(act({by: null})), /its name, its role or the exact instance running/],
    'not a way': [ask(act({by: 'mood'})), /its name, its role or the exact instance running/],
    'no address': [ask(act({address: '  '})), /Write the agent’s role first/],
    'a role in two words': [ask(act({address: 'Head Librarian'})), /the name of its Position/],
    'a name with its @': [ask(act({by: 'name', address: '@Thoth'})), /without the @/],
    'not an instance': [ask(act({by: 'instance', address: 'g7'})), /actuation:generation:/],
    'nothing asked': [ask(act({words: '   '})), /Ask something first/],
    'too many words': [ask(act({words: 'x'.repeat(1001)})), /at most 1000 characters/],
    'no world of yours': [model.starRequest(field, null, act({}), 0), /Your world is not in the field/],
    'not kept': [model.starRequest(model.heldFieldOf({...ASKED, agent_ask: {state: 'unavailable', detail: 'This field’s service does not keep what is asked of a world’s agent yet'}}), YOURS,
      act({}), 0), /does not keep what is asked/],
    'not yours to take back': [ask({act: 'unask', star: 'star:rosarium', ask: 'ask:mara-hermes'}), /Only the world that asked takes an ask back/],
    'nothing to take back': [ask({act: 'unask', star: 'star:rosarium', ask: null}), /Choose something your world asked/],
  }
  for (const [name, [made, words]] of Object.entries(refusals)) {
    assert.ok('refusal' in made, `${name}: refused`)
    assert.match(made.refusal, words, name)
    assert.ok(!/_ref|world-agent|\bkind\b|`/.test(made.refusal), `${name}: the refusal is words, no field or op names: ${made.refusal}`)
  }
  assert.equal(model.starNote({kind: 'world-agent-ask'}, {}), 'It is asked: it waits for that agent’s answer, and your two worlds alone read it.')
  assert.equal(model.starNote({kind: 'world-agent-unask'}, {}), 'It is taken back: it stands nowhere now.')
})

test('the World binding asks a world’s agent and takes an ask back from the view’s own hand, and stands each act it cannot do dimmed (SF10)', async () => {
  store.publishField(askedField())
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.chooseStarHand({star: 'star:rosarium', askWorld: null, askBy: null, askAddress: '', askWords: '', ask: null})
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.match(binding.standing.agentAsk?.disabled ?? '', /Choose the world whose agent to ask/)
    assert.match(binding.standing.agentUnask?.disabled ?? '', /Choose something your world asked/)
    assert.equal(binding.values.askBy, undefined, 'no way of asking is chosen until you choose one')
    binding.local.askWorld('world:mara')
    binding.local.askBy('role')
    binding.local.askBy('mood')
    binding.local.askAddress('librarian')
    binding.local.askWords('And the red one?')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.deepEqual([binding.values.askWorld, binding.values.askBy, binding.values.askAddress, binding.values.askWords], ['world:mara', 'role', 'librarian', 'And the red one?'],
      'an agent is asked by its name, its role or the instance running, nothing else')
    assert.equal(binding.standing.agentAsk, undefined)
    assert.equal(binding.writes('agentAsk'), true)
    await binding.write([{key: 'agentAsk', value: 1}])
    const made = asked.pop()
    assert.deepEqual({...made, ask_ref: undefined}, {kind: 'world-agent-ask', ask_ref: undefined, star_ref: 'star:rosarium', world_ref: 'world:me', to_world_ref: 'world:mara',
      by: 'role', address: 'librarian', words: 'And the red one?'})
    assert.equal(store.starHand().askWords, '', 'what was asked is cleared from the hand once asked')
    // Take back: an ask of your world's, chosen in what was asked here
    binding.local.fieldAsk('ask:mara-hermes')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.match(binding.standing.agentUnask?.disabled ?? '', /Only the world that asked takes an ask back/)
    assert.equal(binding.writes('agentUnask'), false)
    binding.local.fieldAsk('ask:me-librarian')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.standing.agentUnask, undefined)
    await binding.write([{key: 'agentUnask', value: 2}])
    assert.deepEqual(asked.pop(), {kind: 'world-agent-unask', ask_ref: 'ask:me-librarian'})
    assert.equal(store.starHand().ask, null, 'what was taken back is no longer chosen')
    // a world not gathered at the star is not chosen; choosing another star lets the choice go
    binding.local.askWorld('world:stranger')
    assert.equal(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.askWorld, undefined, 'a world waiting at the edge is not one to ask')
    binding.local.askWorld('world:mara')
    binding.local.fieldAsk('ask:me-librarian')
    binding.local.fieldStar('star:far')
    assert.deepEqual([store.starHand().askWorld, store.starHand().ask], [null, null])
    // the binding hands the face what was asked, with the field
    const handed = JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.field)
    assert.deepEqual(handed.asks.map(ask => ask.ask_ref), ['ask:me-librarian', 'ask:mara-hermes'])
    // only the person's own press asks: no declared row of the World, which an agent may set, carries the ask, and an agent's write is refused
    const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
    ;(await import('../src/inhabitants/familyManifest.ts')).resetFamilyManifestsForTest()
    ;(await import('../src/inhabitants/worldShellFamilies.ts')).loadWorldShellFamilies()
    const keys = ['agentAsk', 'agentUnask', 'askWorld', 'askBy', 'askAddress', 'askWords', 'fieldAsk']
    assert.ok(!atlasDevs.ATLAS_DECLARED_ROWS.some(row => keys.includes(row.key)), 'no declared row of the World carries them')
    const device = atlasDevs.atlasDevice(inhabitantManifest('atlas-earth').faces.find(face => face.id === 'globe-engine'), YOURS_READING())
    for (const key of ['agentAsk', 'agentUnask']) await assert.rejects(device.submit([{key, value: 1}]), /no owner write path/)
    assert.equal(asked.length, 0, 'nothing an agent sent reached the field')
  } finally {
    store.bindSystemActs(null)
  }
})

test('the Talk page asks a world’s agent and reads what was asked here, each answer under its ask, and stands dimmed where it cannot ask (SF10)', () => {
  const v = {...world.defaults, ...world.fixtures['An agent asked']}
  const whole = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'talk', setPage() {}, standing: {}}))
  for (const label of ['Ask its agent', 'Ask', 'Asked here']) assert.match(whole, new RegExp(`>${label}<`), `${label} stands on the Talk page`)
  for (const label of ['World', 'By', 'Role', 'Words']) assert.match(whole, new RegExp(`data-i="${label}[^"]*"`), `${label} stands on the face`)
  assert.match(whole, />Take back</)
  assert.match(whole, /class="dp-row-name[^"]*"[^>]*>You asked mara’s librarian: Which plate shows the white rose\?</, 'what your world asked is a line')
  assert.match(whole, /class="dp-row-name[^"]*"[^>]*>Thoth: The second, as my reading of it says\.</, 'the answer stands under it, by the agent that gave it')
  assert.match(whole, /Thoth answered: The second, as my reading of it says\. From Mara’s reading of the second plate\./, 'whole to a reader, with what it was drawn from')
  assert.match(whole, /class="dp-row-name[^"]*"[^>]*>mara asked Hermes, your agent: Where does your circle open\?</, 'what was asked of your agent is a line')
  assert.match(whole, /Waiting for your agent’s answer\./)
  const cellOf = (markup, label) => markup.match(new RegExp(`<[^>]*data-i="${label}[^"]*"[^>]*>`))?.[0] ?? ''
  assert.doesNotMatch(cellOf(whole, 'Ask'), /data-disabled="true"/, 'Ask stands ready with a world, a way, an address and words')
  // at a star your world is not gathered at, it asks nothing
  const far = renderToStaticMarkup(world.whole({v: {...v, fieldStar: 'star:far'}, set() {}, nav: {}, page: 'talk', setPage() {}, standing: {}}))
  for (const label of ['World', 'Ask']) assert.match(cellOf(far, label), /data-disabled="true"[^>]*|only while it is gathered there/, `${label} stands dimmed at a star your world is not at`)
  assert.match(far, /only while it is gathered there/)
  const unheld = renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['Field not held']}, set() {}, nav: {}, page: 'talk', setPage() {}, standing: {}}))
  for (const label of ['World', 'By', 'Words', 'Ask', 'Take back']) {
    const cell = cellOf(unheld, label)
    assert.match(cell, /data-disabled="true"/, `${label} stands dimmed while the field holds no worlds`)
    assert.match(cell, /does not hold worlds yet/, `${label} says why in the field’s words`)
  }
})

/* [SF10 with SF11] Mara's machine is off: your world's ask of her librarian is asked all the same and waits until she is back; her agent is
 * away with her, as SF11 says, and nothing answers for it until then. */
const ASKED_AWAY = {...ASKED, world_answer: {state: 'held'}, worlds: AWAY.worlds,
  agent_asks: ASKED.agent_asks.map(ask => (ask.ask_ref === 'ask:me-librarian' ? {...ask, answer: null} : ask))}

test('an ask of an away world’s agent is asked all the same and waits until that world is back, its line saying so; the binding asks it as any other (SF10, SF11)', async () => {
  const field = model.heldFieldOf(ASKED_AWAY)
  const [mine, ofYours] = rosariumOf(field).asks
  assert.deepEqual(mine.left, {since: LEFT_AT}, 'the world asked is away, since when')
  assert.equal(model.agentAnswerLine(mine), 'Waiting until mara is back: nothing answers for mara’s librarian until then.')
  assert.equal(ofYours.left, null, 'your own world is never away to you')
  assert.equal(model.agentAnswerLine(ofYours), 'Waiting for your agent’s answer.')
  const back = rosariumOf(model.heldFieldOf({...ASKED_AWAY, worlds: AWAY.worlds.map(world => ({...world, answer: answering}))})).asks[0]
  assert.deepEqual([back.left, model.agentAnswerLine(back)], [null, 'Waiting for mara’s librarian.'], 'back, it waits for that agent')
  const unknown = rosariumOf(model.heldFieldOf({...ASKED_AWAY, world_answer: undefined, worlds: SNAPSHOT.worlds})).asks[0]
  assert.deepEqual([unknown.left, model.agentAnswerLine(unknown)], [null, 'Waiting for mara’s librarian.'], 'where the service keeps no word of who answers, it says nothing of it')
  const answered = rosariumOf(model.heldFieldOf({...ASKED, world_answer: {state: 'held'}, worlds: AWAY.worlds})).asks[0]
  assert.equal(answered.left, null, 'answered, it waits for nothing')
  assert.match(model.agentAnswerLine(answered), /^Thoth answered: The second\./, 'an answer given before it went away stands as given')
  // asking it is no refusal: the request is made, and waits
  const made = model.starRequest(field, YOURS, {act: 'ask', star: 'star:rosarium', world: 'world:mara', by: 'role', address: 'librarian', words: 'And the red one?'}, AT)
  assert.equal(made.request?.kind, 'world-agent-ask', JSON.stringify(made))
  // what the binding hands the face reads back the same
  const handed = model.fieldSceneOf({...field, asks: field.asks, askWhy: null}, {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === 'star:rosarium')
  assert.deepEqual(handed.asks[0].left, {since: LEFT_AT})
  // the binding asks it as any other: Ask stands live, and nothing waits on that world being back
  store.publishField(model.heldFieldOf(ASKED_AWAY))
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.chooseStarHand({star: 'star:rosarium', askWorld: null, askBy: null, askAddress: '', askWords: '', ask: null})
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    binding.local.askWorld('world:mara')
    binding.local.askBy('role')
    binding.local.askAddress('librarian')
    binding.local.askWords('And the red one?')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.values.askWorld, 'world:mara', 'an away world gathered at the star is one to ask')
    assert.equal(binding.standing.agentAsk, undefined, 'Ask stands live')
    await binding.write([{key: 'agentAsk', value: 1}])
    assert.equal(asked.pop()?.to_world_ref, 'world:mara')
  } finally {
    store.bindSystemActs(null)
  }
})

test('the Talk page asks an away world’s agent all the same, saying in SF11’s words that nothing answers for it until that world is back, and the ask reads as waiting for it (SF10, SF11)', () => {
  const v = {...world.defaults, ...world.fixtures['An agent away']}
  const whole = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'talk', setPage() {}, standing: {}}))
  const cellOf = (markup, label) => markup.match(new RegExp(`<[^>]*data-i="${label}[^"]*"[^>]*>`))?.[0] ?? ''
  assert.doesNotMatch(cellOf(whole, 'Ask'), /data-disabled="true"/, 'Ask stands ready: an away world’s agent is asked all the same')
  assert.match(whole, /nothing answers for it until mara is back, and what you ask waits until then/, 'the face says the ask waits, in SF11’s words')
  assert.match(cellOf(whole, 'World'), /data-i="World\|mara, away — [^"]*It is away since [^"]*, with mara: nothing answers for it until mara is back\. What you ask waits until mara is back\./,
    'the world to ask is named away, its agent away with it in SF11’s words')
  assert.match(whole, /<option value="world:mara" selected="">mara, away<\/option>/)
  assert.match(whole, /class="dp-row-name[^"]*"[^>]*>Waiting until mara is back</, 'the ask reads as waiting for that world to be back')
  assert.match(whole, /Waiting until mara is back: nothing answers for mara’s librarian until then\./, 'whole to a reader')
  assert.match(whole, /class="dp-row-name[^"]*"[^>]*>mara asked Hermes, your agent: Where does your circle open\?</, 'what was asked of your own agent reads as before')
  // mara back: her agent is asked as any other, and nothing says away
  const back = renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['An agent asked']}, set() {}, nav: {}, page: 'talk', setPage() {}, standing: {}}))
  assert.doesNotMatch(back, /mara is back|>mara, away</)
})

/* [SF03] "The star is mine to rename, close or hand on": your Rosarium is being handed on to Mara, and stranger hands Far on to your world,
 * which is gathered there. */
const HANDED = {...SNAPSHOT,
  gatherings: [...SNAPSHOT.gatherings, {star_ref: 'star:far', world_ref: 'world:me', state: 'gathered', asked_at_micros: '8', gathered_at_micros: '8'}],
  star_hand_on: {state: 'held'},
  star_hand_ons: [
    {star_ref: 'star:rosarium', from_world_ref: 'world:me', to_world_ref: 'world:mara', at_micros: micros(AT)},
    {star_ref: 'star:far', from_world_ref: 'world:stranger', to_world_ref: 'world:me', at_micros: micros(AT + 60_000)},
    {star_ref: 'star:nowhere', from_world_ref: 'world:stranger'},
  ],
}
const handedField = () => {
  const field = model.heldFieldOf(HANDED)
  assert.equal(field.state, 'read')
  return field
}

test('a star is renamed, handed on, kept and taken on through the field for your own world, each refusing in words where it cannot be done (SF03)', () => {
  const field = handedField()
  assert.deepEqual(field.handOns.map(row => [row.star_ref, row.from_world_ref, row.to_world_ref]), [['star:rosarium', 'world:me', 'world:mara'], ['star:far', 'world:stranger', 'world:me']],
    'a row that is not the contract’s is left out')
  const scene = model.fieldScene(field, {aperture: 'federated', viewAs: 'me'}, YOURS)
  const [rosarium, far] = ['star:rosarium', 'star:far'].map(ref => scene.stars.find(star => star.ref === ref))
  assert.deepEqual(rosarium.handOn, {from: 'world:me', to: 'world:mara', at: AT, byYou: true, toYou: false})
  assert.deepEqual(far.handOn, {from: 'world:stranger', to: 'world:me', at: AT + 60_000, byYou: false, toYou: true})
  assert.equal(model.handOnLine(rosarium), 'You are handing The Rosarium plates on to mara: it waits for mara to take it on.')
  assert.equal(model.handOnLine(far), 'stranger hands Far on to your world: it is yours once you take it on.')
  assert.equal(model.handOnLine({...rosarium, handOn: null}), 'No one is handing The Rosarium plates on.')
  const none = model.heldFieldOf({...HANDED, star_hand_on: {state: 'unavailable', detail: 'This field’s service does not hand stars on yet'}})
  assert.deepEqual([none.handOns, none.handOnWhy], [null, 'This field’s service does not hand stars on yet'])
  // what the binding hands the face reads back the same
  const handed = model.fieldSceneOf({...field, handOns: field.handOns, handOnWhy: null}, {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === 'star:rosarium')
  assert.deepEqual(handed.handOn, rosarium.handOn)

  const ask = act => model.starRequest(field, YOURS, act, AT)
  const rename = more => ({act: 'rename', star: 'star:rosarium', name: ' The Rosarium, read ', gathers: 'Readings of the Rosarium plates', comes: 'asked', ...more})
  assert.deepEqual(ask(rename({})), {request: {kind: 'star-light', star_ref: 'star:rosarium', world_ref: 'world:me', name: 'The Rosarium, read', gathers: 'Readings of the Rosarium plates', comes: 'asked'}},
    'renamed, the star is lit again by the world it stands in, under the same ref')
  const within = model.heldFieldOf({...HANDED, stars: HANDED.stars.map(star => (star.star_ref === 'star:rosarium' ? {...star, within: 'star:far'} : star))})
  assert.equal(model.starRequest(within, YOURS, rename({}), AT).request.within, 'star:far', 'and it stays where it stands')
  assert.deepEqual(ask({act: 'hand-on', star: 'star:rosarium', world: 'world:stranger'}).refusal, 'Hand a star on to a world gathered at it.')
  const plain = model.heldFieldOf({...HANDED, star_hand_ons: []})
  assert.deepEqual(model.starRequest(plain, YOURS, {act: 'hand-on', star: 'star:rosarium', world: 'world:mara'}, AT), {request: {kind: 'star-hand-on', star_ref: 'star:rosarium', to_world_ref: 'world:mara'}})
  assert.deepEqual(ask({act: 'keep', star: 'star:rosarium'}), {request: {kind: 'star-keep', star_ref: 'star:rosarium'}})
  assert.deepEqual(ask({act: 'take-on', star: 'star:far'}), {request: {kind: 'star-take-on', star_ref: 'star:far', world_ref: 'world:me'}})
  const refusals = {
    'rename another’s': [ask(rename({star: 'star:far'})), /Only the one who holds a star renames it/],
    'rename to the same': [ask(rename({name: 'The Rosarium plates'})), /named so already/],
    'rename unnamed': [ask(rename({name: '  '})), /Name the star first/],
    'rename gathering nothing': [ask(rename({gathers: ' '})), /Say what the star gathers first/],
    'rename no one may come': [ask(rename({comes: 'nobody'})), /lets anyone come, or asks you/],
    'rename no star': [ask(rename({star: null})), /Choose a star first/],
    'hand on another’s': [ask({act: 'hand-on', star: 'star:far', world: 'world:stranger'}), /Only the one who holds a star hands it on/],
    'hand on to no one': [ask({act: 'hand-on', star: 'star:rosarium', world: null}), /Choose a world gathered at the star to hand it on to/],
    'hand on to its own world': [ask({act: 'hand-on', star: 'star:rosarium', world: 'world:me'}), /stands in that world’s hands already/],
    'hand on again': [ask({act: 'hand-on', star: 'star:rosarium', world: 'world:mara'}), /handed on to mara already/],
    'keep another’s': [ask({act: 'keep', star: 'star:far'}), /Only the one who holds a star keeps it/],
    'keep what is not handed on': [model.starRequest(plain, YOURS, {act: 'keep', star: 'star:rosarium'}, AT), /not being handed on/],
    'take on what is not yours to': [ask({act: 'take-on', star: 'star:rosarium'}), /not being handed on to your world/],
    'take on away from it': [model.starRequest(model.heldFieldOf({...HANDED, gatherings: SNAPSHOT.gatherings}), YOURS, {act: 'take-on', star: 'star:far'}, AT), /only while it is gathered there/],
    'not kept': [model.starRequest(none, YOURS, {act: 'keep', star: 'star:rosarium'}, AT), /does not hand stars on yet/],
    'no world of yours': [model.starRequest(field, null, {act: 'take-on', star: 'star:far'}, AT), /Your world is not in the field/],
  }
  for (const [name, [made, words]] of Object.entries(refusals)) {
    assert.ok('refusal' in made, `${name}: refused: ${JSON.stringify(made)}`)
    assert.match(made.refusal, words, name)
    assert.ok(!/_ref|star-|\bkind\b|`/.test(made.refusal), `${name}: the refusal is words, no field or op names: ${made.refusal}`)
  }
  assert.equal(model.starNote({kind: 'star-hand-on'}, {}), 'It waits for that world’s owner to take it on: until then the star is yours, and Keep takes it back.')
  assert.equal(model.starNote({kind: 'star-keep'}, {}), 'The star stays in your hands.')
  assert.equal(model.starNote({kind: 'star-take-on'}, {}), 'The star is in your hands now.')
  assert.equal(model.starDayLine({star_ref: 'star:far', world_ref: 'world:me', what: 'took-on', kind: null, at: AT}), 'me took the star on')
})

test('the World binding renames, hands on, keeps and takes on a star from the view’s own hand, and stands each act it cannot do dimmed (SF03)', async () => {
  store.publishField(handedField())
  store.chooseFieldView({field: true, aperture: 'federated', viewAs: 'me'})
  store.chooseStarHand({star: 'star:rosarium', name: '', gathers: '', handTo: null})
  const asked = []
  store.bindSystemActs({open: async () => {}, land: async () => 'landed', unland: async () => 'unlanded', fieldAct: async request => { asked.push(request); return 'The field took it.' }})
  try {
    let binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.match(binding.standing.starRename?.disabled ?? '', /Name the star first/)
    assert.match(binding.standing.starHandOn?.disabled ?? '', /Choose a world gathered at the star to hand it on to/)
    assert.equal(binding.standing.starKeep, undefined, 'your star being handed on, Keep stands live')
    assert.match(binding.standing.starTakeOn?.disabled ?? '', /not being handed on to your world/)
    binding.local.handTo('world:stranger')
    assert.equal(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.handTo, undefined, 'a world waiting at the edge is not one to hand it on to')
    binding.local.handTo('world:mara')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.values.handTo, 'world:mara')
    assert.match(binding.standing.starHandOn?.disabled ?? '', /handed on to mara already/, 'an act that would change nothing stands dimmed')
    await binding.write([{key: 'starKeep', value: 1}])
    assert.deepEqual(asked.pop(), {kind: 'star-keep', star_ref: 'star:rosarium'})
    store.chooseStarHand({name: 'The Rosarium, read', gathers: 'Readings of the Rosarium plates', comes: 'asked'})
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.standing.starRename, undefined)
    await binding.write([{key: 'starRename', value: 2}])
    assert.deepEqual(asked.pop(), {kind: 'star-light', star_ref: 'star:rosarium', world_ref: 'world:me', name: 'The Rosarium, read', gathers: 'Readings of the Rosarium plates', comes: 'asked'})
    assert.deepEqual([store.starHand().name, store.starHand().gathers, store.starHand().star], ['', '', 'star:rosarium'], 'renamed, the words are cleared and the star stays chosen')
    // Far, handed on to your world: take it on
    binding.local.fieldStar('star:far')
    assert.equal(store.starHand().handTo, null, 'choosing another star lets the world chosen to hand on to go')
    binding = atlasDevs.atlasGlobeBinding(YOURS_READING())
    assert.equal(binding.standing.starTakeOn, undefined)
    assert.match(binding.standing.starHandOn?.disabled ?? '', /Only the one who holds a star hands it on/)
    await binding.write([{key: 'starTakeOn', value: 3}])
    assert.deepEqual(asked.pop(), {kind: 'star-take-on', star_ref: 'star:far', world_ref: 'world:me'})
    // the binding hands the face the stars being handed on, with the field
    assert.deepEqual(JSON.parse(atlasDevs.atlasGlobeBinding(YOURS_READING()).values.field).handOns.map(row => row.star_ref), ['star:rosarium', 'star:far'])
    // only the person's own press acts on a star: no declared row of the World carries these, and an agent's write is refused
    const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
    ;(await import('../src/inhabitants/familyManifest.ts')).resetFamilyManifestsForTest()
    ;(await import('../src/inhabitants/worldShellFamilies.ts')).loadWorldShellFamilies()
    const keys = ['starRename', 'starHandOn', 'starKeep', 'starTakeOn', 'handTo']
    assert.ok(!atlasDevs.ATLAS_DECLARED_ROWS.some(row => keys.includes(row.key)), 'no declared row of the World carries them')
    const device = atlasDevs.atlasDevice(inhabitantManifest('atlas-earth').faces.find(face => face.id === 'globe-engine'), YOURS_READING())
    for (const key of ['starRename', 'starHandOn', 'starKeep', 'starTakeOn']) await assert.rejects(device.submit([{key, value: 1}]), /no owner write path/)
    assert.equal(asked.length, 0, 'nothing an agent sent reached the field')
  } finally {
    store.bindSystemActs(null)
  }
})

test('the Star page hands a star on and takes one on, saying where it stands; Light a star renames the star you hold; Take it on is held, the rest pressed (SF03)', () => {
  const page = (fixture, at, more = {}) => renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures[fixture], ...more}, set() {}, nav: {}, page: at, setPage() {}, standing: {}}))
  const cellOf = (markup, label) => markup.match(new RegExp(`<[^>]*data-i="${label}[^"]*"[^>]*>`))?.[0] ?? ''
  const heldIn = (markup, label) => new RegExp(`data-hold="true"[^>]*><i[^>]*></i>${label}<`).test(markup)
  const handing = page('A star handed on', 'star')
  for (const label of ['Hand on', 'Handed on']) assert.match(handing, new RegExp(`class="dp-sec-label">${label}<`), `${label} stands on the Star page`)
  assert.match(handing, /class="dp-row-name[^"]*"[^>]*>You are handing The Rosarium plates on to mara</, 'where it stands, in a line')
  assert.match(handing, /You are handing The Rosarium plates on to mara: it waits for mara to take it on\./, 'whole to a reader')
  assert.match(cellOf(handing, 'Hand to'), /data-i="Hand to\|mara —/, 'the world it goes to is chosen')
  assert.doesNotMatch(cellOf(handing, 'Keep'), /data-disabled="true"/, 'Keep stands ready while it is handed on')
  assert.match(cellOf(handing, 'Take it on'), /data-disabled="true"[^>]*|not being handed on to your world/)
  assert.match(handing, /not being handed on to your world/)
  for (const [label, held] of [['Hand on', false], ['Keep', false], ['Take it on', true]]) {
    assert.equal(heldIn(handing, label), held, `${label} is ${held ? 'held' : 'pressed'}`)
  }
  const toYou = page('A star handed to you', 'star')
  assert.match(toYou, /class="dp-row-name[^"]*"[^>]*>stranger hands Far on to your world</)
  assert.doesNotMatch(cellOf(toYou, 'Take it on'), /data-disabled="true"/, 'Take it on stands ready for the world it was handed on to')
  assert.match(cellOf(toYou, 'Hand on'), /Only the one who holds a star hands it on/)
  // Light a star renames the star you hold, with its words
  const light = page('A star handed on', 'space', {starName: 'The Rosarium, read', starGathers: 'Readings of the Rosarium plates', starComes: 'asked'})
  assert.doesNotMatch(cellOf(light, 'Rename'), /data-disabled="true"/, 'Rename stands ready for your star')
  assert.match(light, /class="dp-action"[^>]*>Rename</, 'Rename stands in Light a star')
  assert.equal(heldIn(light, 'Rename'), false, 'Rename is pressed: renaming again undoes it')
  const theirs = page('A star handed to you', 'space', {starName: 'Near', starGathers: 'x', starComes: 'anyone'})
  assert.match(cellOf(theirs, 'Rename'), /Only the one who holds a star renames it/)
})

// ── round 39: a list says what it holds, in words, and never stands as a never-read light over blank rows (DLW build ruling 2026-11-06) ──
// The kit's law (sdk/panel.tsx Rows): a list read and empty says so in its own words in its first row's place; a list not read holds the
// No-reading mark "—" there, with which reading is missing on the Info line (§16.12: never the words in a row's place); neither stands as
// a hollow light over blank rows. The World's guard walks every design state, every view and page, and every list.
const {Rows} = await import('../src/inhabitants/sdk/panel.tsx')
const {createElement: el} = await import('react')

test('a list read and empty says so in its own words; one not read holds the No-reading mark; neither is a never-read light over blank rows (DLW build ruling 2026-11-06)', () => {
  const draw = props => renderToStaticMarkup(el(Rows, {label: 'Members', size: 4, ...props}))
  const firstRow = markup => markup.match(/<li class="dp-row dp-row--empty"><span class="dp-row-name">([^<]*)</)?.[1]
  for (const [what, props, row] of [['read and empty', {items: [], empty: 'No member yet.'}, 'No member yet.'], ['not read', {items: undefined, why: 'No reading of the members.'}, '—'],
    ['still to come', {items: undefined, waiting: true}, '—'], ['not read, as a design builds it', {items: kitRowsUnread('No reading of the members.')}, '—']]) {
    const markup = draw(props)
    assert.equal(firstRow(markup), row, `${what}: its first row's place says ${row}`)
    assert.doesNotMatch(markup, /data-light="unknown"/, `${what}: no never-read light`)
    assert.doesNotMatch(markup, /No reading of the members/.test(row) ? /$^/ : /<li[^>]*>[^]*No reading of the members[^]*<\/li>/, `${what}: the missing reading is named on the Info line, never in a row`)
  }
  assert.match(draw({items: undefined, why: 'No reading of the members.'}), /data-i="Members\|No reading from the owner yet\. No reading of the members\."/, 'which reading is missing, on the Info line')
  assert.match(draw({items: undefined, waiting: true}), /data-standing="awaiting"/, 'a reading still to come breathes')
})
const {unreadRows: kitRowsUnread} = await import('../src/inhabitants/sdk/panel.tsx')

/** Every list the World draws, in every design state (its defaults and each fixture, as the design sweep reads them), on every page of
 * its whole view and in its compact and full views: [where, the list's markup]. */
const worldLists = () => {
  const out = []
  // and one state more, every list's reading emptied, at the Field and on the body, so each list's own words for nothing are drawn
  const shown = world.fixtures['Your world shown'], held = JSON.parse(shown.field)
  const none = {...shown, field: JSON.stringify({...held, clearings: [], days: [], sayings: [], works: [], offers: [], asks: [], handOns: [], withdrawals: [], gone: [], sames: [],
    gatherings: held.gatherings.filter(row => row.world_ref === 'world:teraphim')}), yourShown: '[]', reached: '[]', fieldSearches: '[]', contributions: '[]', locations: '[]', places: '[]'}
  for (const [state, fixture] of [['defaults', {}], ...Object.entries(world.fixtures), ['every list emptied, at the Field', none], ['every list emptied, on the body', {...none, scale: 'body'}],
    ['every list emptied, on the Earth', {...none, scale: 'earth', view: 'earth'}]]) {
    const v = {...world.defaults}
    for (const [k, x] of Object.entries(fixture)) { if (x === undefined) delete v[k]; else v[k] = x }
    const views = [...['space', 'star', 'said', 'talk', 'work', 'shown', 'contribute', 'body', 'graph'].map(page => [page, () => world.whole({v, set() {}, nav: {}, page, setPage() {}, standing: {}})]),
      ['compact', () => world.compact({v, set() {}, nav: {}, standing: {}})], ['full', () => world.full({v, set() {}, nav: {}, standing: {}})]]
    const fieldRead = v.scale === 'field' && v.fieldHeld !== false && typeof v.field === 'string'
    for (const [view, draw] of views) {
      const markup = renderToStaticMarkup(draw())
      for (const {index} of markup.matchAll(/<div class="dp-cell dp-cell--rows"/g)) {
        const section = markup.slice(0, index).match(/class="dp-sec-label">[^<]*</g)?.pop()?.slice(21, -1) ?? "?"
        out.push({where: `${state} · ${view} · ${section}`, fieldRead, markup: markup.slice(index, markup.indexOf('</ul>', index) + 5)})
      }
    }
  }
  return out
}

test('the World guard: every list on every page, in every design state, says what it holds or lacks; none stands as a never-read light over blank rows (DLW build ruling 2026-11-06)', () => {
  const lists = worldLists(), faults = []
  for (const {where, fieldRead, markup} of lists) {
    const head = markup.slice(0, markup.indexOf('<ul'))
    if (/data-light="unknown"/.test(head)) faults.push(`${where}: a never-read light`)
    const rows = markup.match(/<li class="dp-row[ "]/g)?.length ?? 0
    const first = markup.match(/<li class="dp-row dp-row--empty"><span class="dp-row-name">([^<]*)</)?.[1]
    if (!rows) faults.push(`${where}: blank rows`)
    else if (first !== undefined && !first.trim()) faults.push(`${where}: a row's place without words`)
    // where the field is held and read at the Field scale, every list reads it: an empty one says so in its own words, never "not read"
    if (fieldRead && /^<div class="dp-cell dp-cell--rows" data-standing="(unread|awaiting)"/.test(markup)) faults.push(`${where}: never read, where the field is read`)
  }
  assert.ok(lists.length > 300, `the guard walks the World's lists: ${lists.length}`)
  assert.deepEqual(faults, [])
  // the two the lead saw: Asked here with nothing asked, Handed on with nothing handed on
  const byWhere = new Map(lists.map(list => [list.where, list.markup]))
  // REPLACED (round 42): Asked here stands on the Talk page since the Star page was split
  assert.match(byWhere.get('A star handed on · talk · Asked here') ?? '', />Nothing asked of an agent here yet\.</)
  assert.match(byWhere.get('An agent away · star · Handed on') ?? '', />No one is handing The Rosarium plates on\.</)
})

// ── SF11 · visiting another person's world (O-I #858 SF11; manual §2, §17.2 "Enter the place and you are on that world"; round 39) ──────────
// Your own world's body is drawn from its owner's record (body/worldBody.ts shownBody, system/bodyDraw.ts). Another's is drawn from what
// its owner gave the field: the world row's body, the record's own keys and nothing that rides along (fieldModel.ts fieldBodyOf), and
// what it shows you is what the field served you of it (the field decides; shared-field/spacetimedb/src/index.ts callerCanSeeClearing),
// each at the reach it was shown at. Nothing of yours is drawn on it, nothing of it is written, and nothing is kept once the field stops
// showing it.
const MARAS = {...bodyOf('body:mara'), seed: 4180, landmass: {sea_level: .62, continents: 2.4, relief: .7, coast: 'archipelago'}}
const VISIT = {...AWAY,
  worlds: AWAY.worlds.map(row => (row.world_ref === 'world:mara' ? {...row, body: {...MARAS, notes: 'Mara’s own notes'}} : row.world_ref === 'world:stranger' ? {...row, body: {body_ref: 'body:stranger'}} : row)),
  clearings: [...AWAY.clearings, c('world:mara', 'place:maras-garden', 'field', 'Mara’s garden')]}

test('a visit to another’s world is its body as its owner gave the field and what it shows you, at the reach each was shown; your own, an unknown and a bodiless world are refused in words (SF11)', () => {
  const field = fieldOf(VISIT)
  const visit = model.worldVisit(field, 'world:mara')
  assert.ok(visit && !('refusal' in visit), JSON.stringify(visit))
  assert.equal(visit.who, 'mara')
  assert.deepEqual(visit.body, MARAS, 'the body its owner gave the field, its own keys: nothing that rides along with it')
  assert.deepEqual(visit.shown.map(row => [row.label, row.kind, row.reach, row.starName]), [['Mara’s plate', 'page', 'public', null], ['Cartographer', 'agent', 'star', 'The Rosarium plates'],
    ['Mara’s garden', 'place', 'field', null]], 'what it shows you, each at its reach: nothing of another world’s')
  assert.deepEqual(visit.left, {since: LEFT_AT}, 'and it is away, since its owner’s last window went')
  assert.equal(model.worldVisit(fieldOf(SNAPSHOT), 'world:mara').left, null, 'a field that keeps no word of who answers says it is not away')
  assert.deepEqual(model.worldVisit(field, 'world:me:o-i'), {refusal: 'That world is yours: Your world shows your own body.'})
  assert.deepEqual(model.worldVisit(field, 'world:gone'), {refusal: 'That world is no longer in the field you read.'})
  assert.deepEqual(model.worldVisit(field, 'world:stranger'), {refusal: 'stranger shows the field no body yet.'})
  assert.deepEqual(model.worldVisit(field, null), {refusal: 'Choose another world to visit.'})
  assert.deepEqual(model.worldVisit({state: 'reading'}, 'world:mara'), {refusal: model.FIELD_BEING_READ})
  assert.deepEqual(model.visitable(field), [{ref: 'world:mara', left: {since: LEFT_AT}}], 'the worlds you may visit: another’s, with a body')
  assert.deepEqual(model.visitable({state: 'reading'}), [])
  const unlinked = fieldOf({...VISIT, worlds: VISIT.worlds.map(row => (row.world_ref === 'world:mara' ? {...row, linked: false} : row))})
  assert.deepEqual(model.worldVisit(unlinked, 'world:mara'), {refusal: model.LINK_OFF}, 'a world with Link off is not visited, should a reading still hold it')
  assert.deepEqual(model.visitable(unlinked), [])
  // the face reads the same from the values the binding hands it
  store.publishField(field)
  try {
    const values = atlasDevs.atlasGlobeBinding(YOURS_READING()).values
    assert.deepEqual(model.fieldVisitOf(JSON.parse(values.field), 'world:mara'), visit)
    assert.deepEqual(model.fieldVisitOf(undefined, 'world:mara'), {refusal: 'The shared field gave no reading of its worlds.'})
  } finally { store.publishField({state: 'reading'}) }
})

test('visiting another’s world makes its body the one the World draws, read-only, with no look of its own; it goes when the field stops showing it; a refused visit changes nothing; leaving returns to yours (SF11)', async () => {
  const entered = await import('../src/projections/atlas/system/enteredWorld.ts')
  const worldBody = await import('../src/projections/atlas/body/worldBody.ts')
  const drawMod = await import('../src/projections/atlas/system/bodyDraw.ts')
  const {createDisclosureSessionStore} = await import('../../../../desktop/cradle/src/techne/session.ts')
  store.publishField(fieldOf(VISIT))
  const drawn = []
  const bound = drawMod.bindBodyDraw({engine: {setBody: (...args) => drawn.push(args), setBodyTime() {}}, store: createDisclosureSessionStore()})
  try {
    const read = ref => model.visitedBody(store.heldField(), ref)
    assert.equal(entered.visitWorld('world:me', read), 'That world is yours: Your world shows your own body.')
    assert.equal(entered.visitWorld('world:stranger', read), 'stranger shows the field no body yet.')
    assert.equal(entered.visitedWorld(), null, 'a refused visit changes nothing')
    assert.deepEqual(model.visitedBody(store.heldField(), 'world:mara'), {name: 'mara', record: MARAS}, 'the body read for drawing is the one its owner gave the field')
    assert.equal(entered.visitWorld('world:mara', read), null, 'visited')
    assert.equal(entered.visitedWorld(), 'world:mara')
    assert.equal(worldBody.bodyChoice(), 'other', 'the Body is another world')
    assert.deepEqual(drawn.at(-1), [MARAS, {}], 'its body is the one drawn, with no look: the field gives none, and none of yours is lent')
    assert.equal(worldBody.bodyWriteRefusal(), worldBody.READ_ONLY, 'read-only: another world’s body is its owner’s')
    assert.deepEqual(entered.otherBody(), {ref: 'world:mara', name: 'mara', record: MARAS, visit: true})
    assert.deepEqual(atlasDevs.atlasReading(null, 'earth').body.other, {ref: 'world:mara', name: 'mara', record: MARAS, visit: true}, 'the World reads the body it draws')
    // the field stops showing it: nothing of it is kept
    store.publishField(fieldOf({...VISIT, worlds: VISIT.worlds.filter(row => row.world_ref !== 'world:mara'), clearings: VISIT.clearings.filter(row => row.world_ref !== 'world:mara')}))
    assert.equal(drawn.at(-1)[0], null, 'a world the field no longer shows is no longer drawn')
    assert.equal(entered.otherBody(), null)
    store.publishField(fieldOf(VISIT))
    assert.deepEqual(drawn.at(-1), [MARAS, {}], 'and is drawn again once the field shows it again')
    entered.leaveWorld()
    assert.equal(entered.visitedWorld(), null)
    assert.equal(worldBody.bodyChoice(), 'own', 'leaving returns to your own world')
  } finally { bound.dispose(); entered.leaveWorld(); worldBody.chooseBody('earth'); store.publishField({state: 'reading'}) }
})

test('the World hands the face the body visited, its settings as readings and the world to visit; nothing of it is writable (SF11)', () => {
  const other = {ref: 'world:mara', name: 'mara', record: MARAS, visit: true}
  const binding = atlasDevs.atlasGlobeBinding({...readingWith(), mounted: true, body: {...readingWith().body, choice: 'other', other}, look: {barren: .4}})
  assert.deepEqual(JSON.parse(binding.values.bodyRecord), MARAS, 'the record drawn is the one visited')
  assert.equal(binding.values.bodyLook, undefined, 'with no look: your own is not lent to it')
  assert.equal(binding.values.bodyName, 'mara')
  assert.equal(binding.values.visitWorld, 'world:mara')
  assert.deepEqual([binding.values.seed, binding.values.seaLevel, binding.values.continents, binding.values.coast], [4180, .62, 2.4, 'archipelago'], 'its settings, as readings')
  for (const key of atlasDevs.WORLD_BODY_KEYS) assert.equal(binding.standing[key]?.disabled, 'Another world’s body is its owner’s: you see what they show.', `${key} is not yours to write`)
  assert.equal(binding.writes('seed'), false)
  assert.equal(binding.values.generationNote, undefined, 'its next change is its owner’s, never this window’s')
  assert.equal(typeof binding.local.visitWorld, 'function', 'the world to visit is the view’s own hand')
  const none = atlasDevs.atlasGlobeBinding({...readingWith(), mounted: true, body: {...readingWith().body, choice: 'other', other: null}})
  assert.equal(none.values.bodyRecord, undefined, 'no world visited or entered: no body is handed')
  assert.match(none.standing.seed?.disabled ?? '', /No other world’s body is read/)
})

test('the Body page visits another’s world: chosen by name, drawn as theirs, what it shows you at its reach, away when it is, and nothing of yours on it (SF11)', () => {
  const page = drawn('A world visited', 'body')
  assert.match(page, /aria-label="Another world’s body"/, 'the display names the body as another world’s')
  const chooser = page.match(/<select class="dp-chooser" aria-label="Visit"[^>]*>([^]*?)<\/select>/)?.[1]
  assert.ok(chooser, 'a Visit chooser')
  assert.deepEqual([...chooser.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)</g)].map(([, value, label]) => [value, label]), [['world:mara', 'mara']], 'over the others’ worlds that show a body')
  assert.match(page, /<select class="dp-chooser" aria-label="Visit"[^>]*>[^]*?<option value="world:mara" selected="">/, 'mara’s, chosen')
  const shows = sectionRowsOf(page, 'What it shows')
  assert.deepEqual(shows.rows.map(row => [row.name, row.note]), [['Mara’s plate', 'to the public'], ['Mara’s garden', 'to the field'], ['Cartographer', 'The Rosarium plates']])
  assert.ok(!page.includes('>Locations<'), 'your locations are not on it')
  for (const name of ['The study', 'The book', 'To Mara’s world']) assert.ok(!page.includes(name), `nothing of yours is drawn on it: ${name}`)
  assert.ok(!/class="dp-sec-label">What it shows</.test(drawn('Your world shown', 'body')), 'your own body shows your locations')
  const away = drawn('A world visited, away', 'body')
  assert.match(away, />mara is away since (\d\d:\d\d|\d{1,2} [A-Z][a-z]{2})</, 'its body says it is away, since when')
  assert.deepEqual(sectionRowsOf(away, 'What it shows').rows.map(row => row.note), ['to the public', 'to the field', 'The Rosarium plates'])
  assert.match(away, /It is away since (\d\d:\d\d|\d{1,2} [A-Z][a-z]{2}), with mara: nothing answers for it until mara is back\./, 'its agent is away with it')
  const emptied = drawn('A world visited', 'body', {field: JSON.stringify({...JSON.parse(world.fixtures['A world visited'].field), clearings: []})})
  assert.equal(sectionRowsOf(emptied, 'What it shows').empty, 'mara shows you nothing.')
})

// ── TX14 · a world visited while its body cannot be read (O-I #858 walk, r41: "The Body page stays on 'Another world' with nothing to read
// once the visited world is gone") ──
// Lane BB's derivation (r42): the visit stands, so the body comes back with the field without a reload, and the World says why it is not
// drawn now, in the field's own words, with the way back to your own; your own body stands in the display meanwhile; never an empty
// "Another world".
const LOST = 'The SharedField is not reachable now. It comes back on its own once its service answers again; your world goes on here meanwhile.'

test('a world visited whose body the field cannot read now stays chosen, and the World says why in the field’s words; it is drawn again once the field reads it (TX14, SF11)', async () => {
  const entered = await import('../src/projections/atlas/system/enteredWorld.ts')
  const worldBody = await import('../src/projections/atlas/body/worldBody.ts')
  store.publishField(fieldOf(VISIT))
  try {
    const read = ref => model.visitedBody(store.heldField(), ref)
    assert.equal(entered.visitWorld('world:mara', read), null, 'visited')
    store.publishField({state: 'unavailable', reason: LOST})
    assert.equal(entered.otherBody(), null, 'nothing of it is drawn while the field reads none of it')
    const why = atlasDevs.atlasReading(null, 'earth').body.otherWhy
    assert.deepEqual(why, {ref: 'world:mara', why: LOST}, 'the visit stands, with why it is not drawn')
    const lost = atlasDevs.atlasGlobeBinding({...readingWith(), mounted: true, body: {...readingWith().body, choice: 'other', other: null, otherWhy: why}})
    assert.equal(lost.values.visitWorld, 'world:mara', 'the world visited stays chosen')
    assert.equal(lost.values.bodyName, 'mara')
    assert.equal(lost.values.visitWhy, LOST, 'and why it is not drawn, in the field’s words')
    assert.deepEqual(JSON.parse(lost.values.bodyRecord), YOUR_BODY, 'your own body stands in the display meanwhile, never mara’s settings')
    assert.equal(lost.values.seaLevel, undefined, 'and no setting is read as mara’s')
    assert.equal(lost.standing.seed?.disabled, LOST, 'its settings stand with the same words')
    // the face: the words in the display and in place of what it shows, never an empty body
    const page = renderToStaticMarkup(world.whole({v: {...world.defaults, ...lost.values}, set() {}, nav: {}, page: 'body', setPage() {}, standing: lost.standing}))
    assert.doesNotMatch(page, /No reading of the body/, 'never an empty “Another world”')
    assert.match(page, /not reachable now\./, 'the display says why')
    assert.match(page, /Your own body stands here meanwhile/, 'with yours meanwhile, and the way back to it')
    assert.match(page, /<select class="dp-chooser" aria-label="Visit"[^>]*>[^]*?<option value="world:mara" selected="">mara</, 'mara’s, still chosen')
    assert.match(page, /class="dp-sec-label">What it shows</, 'what it shows stands, unread')
    // the field reads again: drawn again, as it was
    store.publishField(fieldOf(VISIT))
    assert.equal(atlasDevs.atlasReading(null, 'earth').body.otherWhy, null)
    assert.deepEqual(entered.otherBody(), {ref: 'world:mara', name: 'mara', record: MARAS, visit: true}, 'it comes back without a reload')
  } finally { entered.leaveWorld(); worldBody.chooseBody('earth'); store.publishField({state: 'reading'}) }
})

// ── TO10 · contributions cross the gap as particles (manual §17.2 "The five scales": "Contributions cross the gap as particles"; round 39) ──
// At the Field scale a contribution crosses from the world that gave it to the world it went to: what one world contributes to a part
// another shows (SF07), and what it says at a star to a world gathered there (SF06). The scene holds no data of its own: a crossing is
// drawn only between two worlds the view draws, a refused one nowhere, and one only its two worlds read (a contribution still waiting, what
// is said at a star) only as you see it yourself.
const CROSSED = {...SNAPSHOT, ...SAID, world_contribution: {state: 'held'}, world_contributions: CONTRIBUTED.world_contributions}
const crossingsAt = (snapshot, viewAs, aperture = 'federated') => model.fieldScene(fieldOf(snapshot), {aperture, viewAs}, YOURS).crossings
  .map(row => `${row.from} > ${row.to} ${row.what}${row.accepted ? '' : ', waiting'}${row.star ? ` at ${row.star}` : ''}`).sort()

test('a contribution crosses from the world that gave it to the world it went to, between two worlds the view draws; refused ones never, and waiting ones and what is said at a star only as you see it yourself (TO10)', () => {
  assert.deepEqual(crossingsAt(CROSSED, 'me'), [
    'world:mara > world:me question at star:rosarium',
    'world:mara > world:me question, waiting',
    'world:me > world:mara correction at star:rosarium',
    'world:me > world:mara finding at star:rosarium',
    'world:me > world:mara question',
    'world:stranger > world:mara reproduction',
  ], 'contributions to a part, and what was said at a star to another world gathered there: never one refused, nor one said to something gone')
  assert.deepEqual(crossingsAt(CROSSED, 'field'), ['world:me > world:mara question', 'world:stranger > world:mara reproduction'], 'as the field sees it: what was accepted alone')
  assert.deepEqual(crossingsAt(CROSSED, 'public'), crossingsAt(CROSSED, 'field'))
  assert.deepEqual(crossingsAt(CROSSED, 'me', 'world'), [], 'your world alone: no other world is drawn, so nothing crosses')
  assert.deepEqual(crossingsAt(CROSSED, 'me', 'shared'), crossingsAt(CROSSED, 'me').filter(row => !row.startsWith('world:stranger')), 'a world past the edge sends nothing in')
  const unlinked = {...CROSSED, worlds: CROSSED.worlds.map(row => (row.world_ref === 'world:me' ? {...row, linked: false} : row))}
  assert.deepEqual(crossingsAt(unlinked, 'field'), ['world:stranger > world:mara reproduction'], 'with Link off your world is not drawn, so nothing crosses to or from it')
  assert.deepEqual(crossingsAt(SNAPSHOT, 'me'), [], 'a field that keeps no contributions draws none')
})

// ── SF07 on the Graph page (round 40): each contribution an edge from the world that gave it to what it was given to ─────────────────────
const contributedAt = (snapshot, viewAs, aperture = 'federated') => model.fieldGraph(model.fieldScene(fieldOf(snapshot), {aperture, viewAs}, YOURS)).edges
  .filter(edge => edge.tie === 'contributed').map(edge => `${edge.from} > ${edge.to}${edge.waiting ? ', waiting' : ''}`).sort()

test('SF07 on the Graph page: each contribution you read between two worlds the graph draws is an edge from the world that gave it to the part it was given to, or to the world where it threads under another; dashed while it waits, none refused; the field and the public see the accepted alone', () => {
  const mine = model.shownId('world:me', 'page:reading-of-plate-4'), maras = model.shownId('world:mara', 'page:maras-plate')
  assert.deepEqual(contributedAt(CROSSED, 'me'), [`world:mara > ${mine}, waiting`, `world:me > ${maras}`, 'world:stranger > world:mara'].sort(),
    'mara’s question waiting on your page, yours accepted on hers, stranger’s reproduction under yours to mara’s world; your refused finding nowhere')
  assert.deepEqual(contributedAt(CROSSED, 'field'), [`world:me > ${maras}`, 'world:stranger > world:mara'].sort(), 'as the field sees it: what was accepted alone')
  assert.deepEqual(contributedAt(CROSSED, 'public'), contributedAt(CROSSED, 'field'))
  assert.deepEqual(contributedAt(CROSSED, 'me', 'world'), [], 'your world alone: no other world is drawn, so no contribution is')
  assert.deepEqual(contributedAt(SNAPSHOT, 'me'), [], 'a field that keeps no contributions draws none')
  // what is said at a star stands as its own tie, once; a contribution never doubles it
  const graph = model.fieldGraph(model.fieldScene(fieldOf(CROSSED), {aperture: 'federated', viewAs: 'me'}, YOURS))
  assert.equal(graph.edges.filter(edge => edge.tie === 'said').length, model.fieldGraph(model.fieldScene(fieldOf({...SNAPSHOT, ...SAID}), {aperture: 'federated', viewAs: 'me'}, YOURS)).edges.filter(edge => edge.tie === 'said').length)
  // the Graph page draws each, dashed while it waits
  const page = renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['Contributions'], view: 'graph'}, set() {}, nav: {}, page: 'graph', setPage() {}, standing: {}}))
  const drawnTies = [...page.matchAll(/<path [^>]*data-tie="contributed"[^>]*>/g)].map(([tag]) => tag)
  assert.ok(drawnTies.length >= 2, `the Graph page draws the contributions: ${drawnTies.length}`)
  assert.ok(drawnTies.some(tag => /stroke-dasharray="2 2"/.test(tag)) && drawnTies.some(tag => !/stroke-dasharray/.test(tag)), 'one waiting dashed, one accepted solid')
})

test('the binding hands the face every contribution it reads, so the face draws the crossings the binding read (TO10)', () => {
  store.publishField(fieldOf(CROSSED))
  try {
    const values = atlasDevs.atlasGlobeBinding(YOURS_READING()).values, given = JSON.parse(values.field)
    assert.deepEqual(given.contributed.map(row => row.contribution_ref), fieldOf(CROSSED).contributions.map(row => row.contribution_ref))
    const view = {aperture: 'federated', viewAs: 'me'}
    assert.deepEqual(model.fieldSceneOf(given, view, YOURS).crossings, model.fieldScene(fieldOf(CROSSED), view, YOURS).crossings)
    assert.deepEqual(model.fieldSceneOf(given, view, YOURS).sames, model.fieldScene(fieldOf(CROSSED), view, YOURS).sames, 'and the claims of the same work read as before')
  } finally { store.publishField({state: 'reading'}) }
})

/** The particles a Field map draws, each with where its crossing starts and ends. */
const particlesOf = page => [...page.matchAll(/<circle[^>]*class="dp-particle"[^>]*>/g)].map(([tag]) => {
  const num = name => Number(tag.match(new RegExp(`${name}="(-?[\\d.]+)"`))?.[1] ?? tag.match(new RegExp(`${name}:(-?[\\d.]+)px`))?.[1] ?? NaN)
  const [cx, cy, x0, y0, x1, y1] = [num('cx'), num('cy'), num('--x0'), num('--y0'), num('--x1'), num('--y1')]
  return {from: tag.match(/data-from="([^"]*)"/)?.[1], to: tag.match(/data-to="([^"]*)"/)?.[1], at: [cx, cy], start: [cx + x0, cy + y0], end: [cx + x1, cy + y1]}
})

test('on the Field map each crossing is particles going from the world that gave it to the world it went to, spread along the gap between them (TO10)', () => {
  const page = drawn('Contributions', 'space')
  const map = page.slice(page.indexOf('aria-label="The field"'), page.indexOf('</svg>', page.indexOf('aria-label="The field"')))
  const particles = particlesOf(map)
  const crossings = model.fieldSceneOf(JSON.parse(world.fixtures['Contributions'].field), {aperture: 'federated', viewAs: 'me'}, 'body:own:teraphim').crossings
  assert.ok(crossings.length >= 3, `the design's Contributions sample crosses: ${crossings.length}`)
  assert.equal(particles.length, crossings.length * 3, 'three particles to each crossing')
  const spotOf = new Map([...map.matchAll(/<g data-world="([^"]*)"><circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="6"/g)].map(([, ref, x, y]) => [ref, [Number(x), Number(y)]]))
  const worlds = [...spotOf.values()]
  assert.ok(worlds.length >= 3, `the map draws its worlds: ${worlds.length}`)
  // a world's disc is 6 across its radius: a particle sets out from inside one and arrives inside the other, and stands outside both
  const inside = (spot, point) => Math.hypot(spot[0] - point[0], spot[1] - point[1]) < 6
  for (const particle of particles) {
    assert.ok(inside(spotOf.get(particle.from), particle.start), `it sets out from the world that gave it: ${JSON.stringify(particle)}`)
    assert.ok(inside(spotOf.get(particle.to), particle.end), `and goes to the world it went to: ${JSON.stringify(particle)}`)
    assert.ok(!worlds.some(spot => inside(spot, particle.at)), `standing in the gap between them: ${JSON.stringify(particle)}`)
  }
  const spots = particles.map(one => one.at.join(','))
  assert.equal(new Set(spots).size, spots.length, 'no two particles stand on one spot: each way and each crossing keeps its own')
  assert.ok(particles.every(one => one.from && one.to && one.from !== one.to), 'each says whose it is and where it goes')
  // nothing loops but what the owner reports (kit-motion): only one the field reports still waiting goes on crossing
  const waiting = new Set(crossings.filter(one => !one.accepted).map(one => one.ref))
  assert.ok(waiting.size > 0 && waiting.size < crossings.length, `the sample has crossings waiting and crossed: ${waiting.size} of ${crossings.length}`)
  for (const [tag] of map.matchAll(/<circle[^>]*class="dp-particle"[^>]*>/g)) {
    const ref = tag.match(/data-crossing="([^"]*)"/)?.[1]
    assert.equal(/data-standing="waiting"/.test(tag), waiting.has(ref), `${ref}: ${waiting.has(ref) ? 'waiting, so it goes on crossing' : 'crossed, so it crosses once and stands'}`)
  }
  assert.match(page, /data-i="The field\|[^"]*crossing the gap as particles/, 'the map says what its particles are')
  assert.ok(particlesOf(drawn('Contributions', 'space', {viewAs: 'public'})).length < particles.length, 'the public sees what was accepted alone')
  assert.equal(particlesOf(drawn('Contributions', 'space', {aperture: 'world'})).length, 0, 'your world alone: nothing crosses')
})

// ── r41: the walk on two worlds (one machine, each its own identity): another world's tie to a star never runs over a world it does not
// join. Lit by you with one other world gathered, the star stood opposite that world, so its tie crossed your own disc and read as a chain
// through your world (r41 walk sf04). The map turns the stars a smaller step, or turns the rings, until every tie stands clear.
const gap = ([ax, ay], [bx, by], [px, py]) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(ax + t * dx - px, ay + t * dy - py)
}
test('another world’s tie to a star never runs over a world it does not join, however many worlds and stars the field holds', () => {
  const faults = []
  for (let others = 1; others <= 6; others++) for (let stars = 1; stars <= 3; stars++) {
    const otherRefs = Array.from({length: others}, (_, i) => `world:other-${i}`)
    const starRefs = Array.from({length: stars}, (_, i) => `star:s${i}`)
    const field = {...SNAPSHOT, worlds: [w('world:me', YOURS, true), ...otherRefs.map(ref => w(ref, `body:${ref}`, false))], clearings: [],
      stars: starRefs.map(ref => ({star_ref: ref, name: ref.slice(5), gathers: 'x', comes: 'anyone', lit_by: 'world:me', mine: true})),
      gatherings: starRefs.flatMap((star, s) => [{star_ref: star, world_ref: 'world:me', state: 'gathered', asked_at_micros: '1', gathered_at_micros: '1'},
        ...otherRefs.filter((_, i) => i % stars === s).map(ref => ({star_ref: star, world_ref: ref, state: 'gathered', asked_at_micros: '2', gathered_at_micros: '2'}))])}
    const v = {...world.defaults, scale: 'field', aperture: 'federated', viewAs: 'me', field: JSON.stringify(field), fieldYours: YOURS}
    for (const [view, markup] of [['whole', renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))],
      ['full', renderToStaticMarkup(world.full({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))]]) {
      const discs = [...markup.matchAll(/<g data-world="([^"]+)"><circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)"/g)].map(m => ({ref: m[1], at: [+m[2], +m[3]], r: +m[4]}))
      const ties = [...markup.matchAll(/<path d="M([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)" class="dp-curve" opacity="0.7"/g)].map(m => [[+m[1], +m[2]], [+m[3], +m[4]]])
      assert.ok(discs.length >= others + 1 && ties.length >= others + stars, `${view} ${others}/${stars}: the map draws ${discs.length} worlds and ${ties.length} ties`)
      for (const [a, b] of ties) for (const disc of discs) {
        const joins = Math.hypot(a[0] - disc.at[0], a[1] - disc.at[1]) < .5 || Math.hypot(b[0] - disc.at[0], b[1] - disc.at[1]) < .5
        if (!joins && gap(a, b, disc.at) < disc.r + 1) faults.push(`${view}, ${others} other worlds, ${stars} stars: a tie runs over ${disc.ref}`)
      }
    }
  }
  assert.deepEqual([...new Set(faults)], [])
})

// ── round 41 walk: the Shown list names a star by the name its world gave it, never by its ref (O-I #858 walk, SF14) ──
test('what your world shows at a star is named by the star’s name on the Shown page, never by its ref', () => {
  const yours = model.yourShown(fieldOf(SNAPSHOT), YOURS)
  assert.deepEqual(yours.map(row => row.starName), [null, null, 'The Rosarium plates'], 'the star’s name rides with what is shown at it')
  const v = {...world.defaults, ...world.fixtures['Your world shown']}
  const page = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'shown', setPage() {}, standing: {}}))
  const row = page.match(/For the circle[^]*?(?=<\/li>|<\/button>|<\/tr>)/)?.[0] ?? ''
  assert.match(row, /The Rosarium plates/, 'the row names the star')
  assert.doesNotMatch(page, />rosarium</, 'never its ref’s tail')
  assert.doesNotMatch(page, /\(rosarium\)/)
})

// ── round 41 walk: a star read at your circle says who is there only where your circle reaches it (O-I #858 walk, SF05) ──
// After ada left a star bea held, ada's Shared aperture read "0 gathered" there though bea stood at it: a narrower aperture reads the
// gatherings of your circle alone (shared-field/spacetimedb field-lib CIRCLE_SUBSCRIPTION: the stars your worlds are gathered at and
// those you hold), so a count of a star outside it is no count. It says to widen; Federated reads the field whole and counts.
test('who is at a star outside your circle is said to need a wider aperture, never counted as nobody', () => {
  const heldAs = (scope) => { const {state, ...field} = fieldOf({...SNAPSHOT, world_scope: scope, gatherings: SNAPSHOT.gatherings.filter(row => row.star_ref !== 'star:far')}); return field }
  const starIn = (scope, ref) => model.fieldSceneOf(heldAs(scope), {aperture: 'federated', viewAs: 'me'}, YOURS).stars.find(star => star.ref === ref)
  assert.equal(starIn('circle', 'star:far').whoRead, false, 'a star none of yours is gathered at, read at your circle')
  assert.equal(starIn('circle', 'star:rosarium').whoRead, true, 'a star of your circle')
  assert.equal(starIn('whole', 'star:far').whoRead, true, 'the field read whole counts at every star')
  const v = {...world.defaults, ...world.fixtures['Your world shown'], field: JSON.stringify(heldAs('circle')), fieldStar: 'star:far'}
  const page = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  assert.match(page, />Widen to read who is here</)
  assert.doesNotMatch(page, />0 gathered</)
})
