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
    assert.deepEqual({...store.starHand(), star: undefined, admit: undefined}, {star: undefined, admit: undefined, name: 'The Bestiary', gathers: 'Readings of the beasts', comes: 'asked'}, 'who may come is anyone or asked, nothing else')
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
  const whole = renderToStaticMarkup(world.whole({v, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  assert.match(whole, /Star’s day/)
  assert.match(whole, /mara was let in/)
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
  const whole = renderToStaticMarkup(world.whole({v: {...world.defaults, ...world.fixtures['Field scale']}, set() {}, nav: {}, page: 'space', setPage() {}, standing: {}}))
  const day = whole.match(/<[^>]*data-i="[^"]*The star’s day, as the field lets you read it[^"]*"[^>]*>/)?.[0] ?? ''
  assert.ok(day, 'the star’s day stands on the face')
  assert.ok(!/data-standing="(unread|awaiting)"/.test(day), `an unchosen star is no missing reading: ${day.slice(0, 160)}`)
  assert.match(day, /Choose a star first/, 'and says what to do')
})
