import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})').split('import.meta.glob').join('(() => ({}))')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.__CRADLE_WALK__ = false
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const h = React.createElement
const src = path => new URL(`../src/${path}`, import.meta.url).href
const sky = await import(src('inhabitants/ql/devices/qlSky.ts'))
const places = await import(src('inhabitants/ql/devices/skyPlace.ts'))
const {HostedDevice} = await import(src('frame/devices/deviceHost.tsx'))
const {design: skyDesign} = await import(src('inhabitants/catalogue/panels/quaternal-logic__sky.tsx'))

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))
const hours = await fixture('ql-745/nara-hours-2026-10-29.json')
const privateHours = await fixture('ql-745/nara-hours-private-2026-10-29.json')
const privateSky = await fixture('ql-745/transit-private-2026-10-29.json')
const world = await fixture('ql-745/world-place-2026-10-29.json')
const identity = await fixture('ql-745/identity-saved-place-2026-10-29.json')
const route = (route, data) => ({outcome: {result: 'owner_route_reading', route, data}})
const dispatched = dispatch => ({outcome: {result: 'action_dispatched', dispatch}})
const invoked = data => dispatched({state: 'invoked', owner_operation: 'central.world-relations.read', data})
const transit = answer => ({outcome: {result: 'nara_identity', data: {schema: 'oi.nara-identity/v1', transit: answer}}})
const settle = ms => new Promise(resolve => setTimeout(resolve, ms))
const held = {reading: {profile: identity.profile}}
const ASKED = Date.UTC(2026, 8, 28, 12)
const whole = binding => renderToStaticMarkup(h(HostedDevice, {designed: skyDesign, binding, view: 'whole', nav: {}}))

/** The owners as the kernel answers them: Central's record of your world (placed, unplaced or none), QL's hours by scope, QL's dated sky. */
function owners(record = invoked(world.placed.data)) {
  const asked = []
  return {asked, call: async op => {
    asked.push(op)
    if (op.op === 'invoke_action') return record
    if (op.op === 'ql_read') return route('ql nara hours', op.request.request.scope === 'observer-private' ? privateHours.answer : hours.answer)
    if (op.op === 'nara_identity') return op.request.request.perspective === 'Topocentric' ? transit(privateSky.answer) : {outcome: null, error: 'no shared sky in this test'}
    return {outcome: null, error: `not asked: ${op.op}`}
  }}
}

// O-I #745 lane N: the Sky's place. Manual §22.1: "The hours are counted at a place: the world's place when Observer is Shared, yours when
// it is Private. With no place, the Sky reads no rulers"; Rules: "A shared view does not show a private observer's place."
// REAL: Central's answers (ctrl central.world.place and central.world-relations.read on a scratch ground), QL's identity read back
// with its saved place (ql nara inspect), QL's hours at that place (ql nara hours, observer-private) and QL's topocentric dated sky there
// (ql nara transit), all recorded 29 Oct in tests/fixtures/ql-745.

test('a place is read as its owner keeps it, and nothing else is taken for one', () => {
  assert.deepEqual(places.keptPlaceOf(world.placed.data.record.place), hours.input.place, 'your world\'s place is the place QL counted at')
  assert.deepEqual(places.savedPlaceOf(identity.profile_read_back), {ok: true, place: privateHours.input.place})
  for (const wrong of [{...hours.input.place, elevation: 3}, {...hours.input.place, latitude_degrees: 91}, {...hours.input.place, label: ' '}, 'Greenwich', null])
    assert.equal(places.keptPlaceOf(wrong), null, JSON.stringify(wrong))
  assert.deepEqual(places.savedPlaceOf({...identity.profile, observer_place: undefined}), {ok: false, reason: places.NO_SAVED_PLACE})
  assert.deepEqual(places.readSavedPlace(null), {ok: false, reason: places.NO_IDENTITY})
  assert.deepEqual(places.worldPlaceOf(invoked(world.unplaced.data)), {ok: false, reason: places.NO_WORLD_PLACE, revision: 'w1'})
  assert.equal(places.worldPlaceOf(invoked(world.placed.data)).revision, 'w2', 'the revision a declaration is made against')
  const refused = places.worldPlaceOf(dispatched({state: 'owner_refused', owner_operation: 'central.world-relations.read', message: 'Relation record not found'}))
  assert.equal(refused.ok, false)
  assert.match(refused.reason, /Relation record not found/)
})

test('Shared counts the hours at your world\'s declared place; Private at your saved place, under the sky as seen from it', async () => {
  const {asked, call} = owners()
  sky.resetQlSky({call})
  sky.askQlSky({now: false, epochMs: ASKED})
  await sky.readQlSkyPlaces(held)
  await settle(sky.SKY_SETTLE_MS + 40)
  assert.deepEqual(asked.find(op => op.op === 'invoke_action'), {op: 'invoke_action', invocation: {action: 'central.world-relations.read',
    target_ref: 'central:action:central.world-relations.read', input: {scope: 'root', ref: 'control:root'}}}, 'your world\'s record, from Central')
  assert.deepEqual(sky.qlSkyState().place, {...hours.input.place, scope: 'world-declared'})
  assert.deepEqual(asked.filter(op => op.op === 'ql_read').at(-1).request.request, hours.input, 'QL counts the hours at the world\'s place')
  let binding = sky.qlSkyBinding(sky.qlSkyState())
  assert.deepEqual(Object.fromEntries(['observer', 'place', 'havePlace', 'dayRuler', 'hourRuler', 'hourOf'].map(key => [key, binding.values[key]])),
    {observer: 'shared', place: 'Greenwich', havePlace: true, dayRuler: 'Moon', hourRuler: 'Mercury', hourOf: 7})
  assert.equal(binding.standing.observer, undefined, 'Observer is the view\'s own choice')
  assert.ok(binding.local.observer, 'the view holds Observer')
  assert.doesNotMatch(whole(binding), /Hastings/, 'a shared view does not show your place')

  binding.local.observer('private')
  await settle(sky.SKY_SETTLE_MS + 40)
  assert.deepEqual(sky.qlSkyState().place, {...privateHours.input.place, scope: 'observer-private'})
  assert.deepEqual(asked.filter(op => op.op === 'ql_read').at(-1).request.request, privateHours.input, 'QL counts the hours at your place')
  assert.deepEqual(asked.filter(op => op.op === 'nara_identity').at(-1), {op: 'nara_identity', request: {operation: 'transit', request: privateSky.input}},
    'the private sky is QL\'s sky as seen from your place')
  binding = sky.qlSkyBinding(sky.qlSkyState())
  assert.deepEqual(Object.fromEntries(['observer', 'place', 'dayRuler', 'hourRuler', 'hourHalf'].map(key => [key, binding.values[key]])),
    {observer: 'private', place: 'Hastings', dayRuler: 'Moon', hourRuler: 'Mercury', hourHalf: 'day'})
  assert.equal(sky.qlSkyState().reading.ok, true)
  assert.equal(sky.qlSkyState().reading.sky.scope, 'observer-private')
  assert.match(binding.standing.havePlace.disabled, /your own place/)
  const drawn = whole(binding)
  assert.match(drawn, /Hastings/)
  assert.doesNotMatch(drawn, /\bNaN\b|data-device-fault/)

  binding.local.observer('shared')
  await settle(sky.SKY_SETTLE_MS + 40)
  assert.doesNotMatch(whole(sky.qlSkyBinding(sky.qlSkyState())), /Hastings/, 'back to Shared, your place is not shown')
  sky.resetQlSky()
})

test('with no place declared or saved, the Sky reads no rulers and names each owner\'s act', async () => {
  const {call} = owners(invoked(world.unplaced.data))
  sky.resetQlSky({call})
  sky.askQlSky({now: false, epochMs: ASKED})
  await sky.readQlSkyPlaces(null)
  await settle(sky.SKY_SETTLE_MS + 40)
  let binding = sky.qlSkyBinding(sky.qlSkyState())
  for (const key of ['dayRuler', 'hourRuler', 'place']) {
    assert.equal(binding.values[key], undefined, key)
    assert.equal(binding.standing[key].disabled, places.NO_WORLD_PLACE, key)
  }
  assert.equal(binding.values.havePlace, undefined)
  binding.local.observer('private')
  await settle(20)
  binding = sky.qlSkyBinding(sky.qlSkyState())
  assert.equal(binding.standing.hourRuler.disabled, places.NO_IDENTITY)
  assert.equal(binding.values.reason, places.NO_IDENTITY, 'the private sky is not asked without your place')
  // Central's refusal of a world with no record is drawn in Central's words.
  const none = owners(dispatched({state: 'owner_refused', owner_operation: 'central.world-relations.read', message: world.no_record.error.message}))
  sky.resetQlSky({call: none.call})
  await sky.readQlSkyPlaces(held)
  binding = sky.qlSkyBinding(sky.qlSkyState())
  assert.match(binding.standing.hourRuler.disabled, /declares no world record/)
  sky.resetQlSky()
})

test('your world\'s place is declared through Central\'s own act on the record\'s revision; a moved record or a refusal is thrown in words', async () => {
  const asked = []
  const placed = await places.declareWorldPlace(async op => { asked.push(op); return invoked(world.placed_act.data) }, hours.input.place, 'w1')
  assert.deepEqual(asked, [{op: 'invoke_action', invocation: {action: 'central.world.place', target_ref: 'central:action:central.world.place',
    input: {place: hours.input.place, expected_revision: 'w1'}}}])
  assert.equal(placed.outcome, 'placed')
  assert.equal(placed.revision, 'w2')
  await assert.rejects(places.declareWorldPlace(async () => invoked({...world.placed_act.data, outcome: 'conflict'}), hours.input.place, 'w0'), /moved since it was read/)
  await assert.rejects(places.declareWorldPlace(async () => dispatched({state: 'owner_refused', owner_operation: 'central.world.place', message: world.no_record.error.message}),
    hours.input.place, 'w1'), /declares no world record/)
})
