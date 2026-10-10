import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production sources in memory, same loader as the sibling native tests: .ts/.tsx
// is transpiled, .css is a non-executing stub. The bar model and its controls are
// rendered through react-dom/server; no frame, store or engine is simulated.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
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
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const [bar, controls, parameters, stage] = await Promise.all([
  import('../src/components/nativeBarModel.ts'),
  import('../src/components/NativeBarControls.tsx'),
  import('@epilogos/expressions-boundary/parameters'),
  import('../src/native/stageCommands.ts'),
])
const {BarValue, BarTools, BarPointerGroup, BarEngineLight} = controls
const {NATIVE_BINDINGS, baseValue} = parameters

// Pin mode: the shell's pin store, what one pin click sends, and the chosen-control reducer it lands in.
const pins = await import('../src/components/nativePinMode.ts')
const sharedBindings = await import('../../../expressions-boundary/src/nativeSharedSettings.ts')
const chosen = await import('../../../expressions-boundary/src/chosenControls.ts')
const deviceEdits = await import('../../../expressions-boundary/src/nativeDeviceEdits.ts')
const model = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts')
const journeySettings = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings.ts')
const {readPinMode, setPinMode, subscribePinMode, planPin, pinnedEntry, pinScopeMark} = pins
const {sharedFieldBinding} = sharedBindings
const {applyNativeChosenControlChanges} = chosen
const {validateNativeSharedSettingChange} = deviceEdits
const {blankJourney} = model
const {initialiseShared} = journeySettings

const keyOf = path => {
  const found = NATIVE_BINDINGS.find(item => item.path === path)
  assert.ok(found, `registry defines ${path}`)
  return found.key
}
/** A reading carrying only the fields pin planning reads. */
const reading = ({entries = [], selected = [], sharedTargets = [], scene = blankJourney().scenes[0]} = {}) => ({
  scene, entityOccurrences: {}, chosenControls: {available: true, entries, controls: []}, selection: {entity_ids: selected, step_id: null}, sharedTargets,
})
const DEFAULT_MODE = {active: false, destination: 'field', shared: false}
const VISCOSITY = 'fluid.viscosity'
const GRAVITY_Y = 'fluid.gravityY'

test('pin mode starts off, pinning to the Field and local to the Scene', () => {
  assert.deepEqual(readPinMode(), DEFAULT_MODE)
})

test('setPinMode merges the change and notifies once per real change only', () => {
  let calls = 0
  const unsubscribe = subscribePinMode(() => {calls += 1})
  try {
    setPinMode({active: true})
    assert.equal(calls, 1)
    assert.deepEqual(readPinMode(), {active: true, destination: 'field', shared: false})
    setPinMode({active: true})
    assert.equal(calls, 1, 'an identical value does not notify')
    setPinMode({destination: 'bind', shared: true})
    assert.equal(calls, 2)
    assert.deepEqual(readPinMode(), {active: true, destination: 'bind', shared: true})
    setPinMode({})
    assert.equal(calls, 2, 'an empty change does not notify')
  } finally {
    unsubscribe()
    setPinMode(DEFAULT_MODE)
  }
  setPinMode({active: true})
  assert.equal(calls, 2, 'an unsubscribed listener is not notified')
  setPinMode(DEFAULT_MODE)
  assert.deepEqual(readPinMode(), DEFAULT_MODE)
})

test('a local Field pin is one chosen-add in the Field scope, with the registry key and no note', () => {
  assert.deepEqual(planPin(reading(), {kind: 'field', path: VISCOSITY}, {destination: 'field', shared: false}),
    {ok: true, verb: 'pin', changes: [{kind: 'chosen-add', key: keyOf(VISCOSITY), scope: 'field'}], note: null})
})

test('a shared Field pin adds the shared-setting in the same transaction, and only when it would change something', () => {
  const add = {kind: 'chosen-add', key: keyOf(GRAVITY_Y), scope: 'field'}
  const target = 'field.' + keyOf(GRAVITY_Y)
  assert.ok(sharedFieldBinding(target), 'gravity Y is shareable')
  const control = {kind: 'field', path: GRAVITY_Y}
  const share = {kind: 'shared-setting', target, shared: true}
  assert.deepEqual(planPin(reading(), control, {destination: 'field', shared: true}).changes, [add, share])
  assert.deepEqual(planPin(reading({sharedTargets: [target]}), control, {destination: 'field', shared: true}).changes, [add], 'already shared: no shared change')
  assert.deepEqual(planPin(reading(), control, {destination: 'field', shared: true}, true).changes, [add], 'inverted to local: no shared change')
  assert.deepEqual(planPin(reading(), control, {destination: 'field', shared: false}, true).changes, [add, share], 'inverted to shared')
  assert.deepEqual(planPin(reading({sharedTargets: [target]}), control, {destination: 'field', shared: true}, true).changes,
    [add, {kind: 'shared-setting', target, shared: false}], 'inverted off a shared pin un-shares it')
  assert.deepEqual(planPin(reading({sharedTargets: [target]}), control, {destination: 'field', shared: false}).changes,
    [add, {kind: 'shared-setting', target, shared: false}], 'local requested while shared un-shares it')
})

test('a Field parameter that cannot be shared pins locally, with a note only when shared was asked for', () => {
  const local = 'interaction.strength'
  assert.equal(sharedFieldBinding('field.' + keyOf(local)), undefined, 'interaction strength is not shareable')
  const add = {kind: 'chosen-add', key: keyOf(local), scope: 'field'}
  const asked = planPin(reading(), {kind: 'field', path: local}, {destination: 'field', shared: true})
  assert.equal(asked.ok, true)
  assert.deepEqual(asked.changes, [add])
  assert.equal(typeof asked.note, 'string')
  assert.ok(asked.note.length > 0)
  assert.deepEqual(planPin(reading(), {kind: 'field', path: local}, {destination: 'field', shared: false}), {ok: true, verb: 'pin', changes: [add], note: null})
})

test('a Field control already pinned unpins with the chosen-remove of its entry, whatever the mode', () => {
  const entries = [{id: 'v1', key: keyOf(VISCOSITY), scope: 'field'}]
  assert.deepEqual(planPin(reading({entries}), {kind: 'field', path: VISCOSITY}, {destination: 'field', shared: false}),
    {ok: true, verb: 'unpin', changes: [{kind: 'chosen-remove', entry_id: 'v1'}], note: null})
  assert.deepEqual(planPin(reading({entries, sharedTargets: ['field.' + keyOf(VISCOSITY)]}), {kind: 'field', path: VISCOSITY}, {destination: 'bind', shared: true}),
    {ok: true, verb: 'unpin', changes: [{kind: 'chosen-remove', entry_id: 'v1'}], note: null})
})

test('a Field path with no native definition cannot be pinned', () => {
  const plan = planPin(reading(), {kind: 'field', path: 'no.such.path'}, {destination: 'field', shared: false})
  assert.equal(plan.ok, false)
  assert.equal(typeof plan.reason, 'string')
})

test('an object control in the Field or Follow destination follows the selected object only', () => {
  const control = {kind: 'entity', entityId: 'e1', key: 'size.x'}
  const follow = {ok: true, verb: 'pin', changes: [{kind: 'chosen-add', key: 'size.x', scope: 'selected'}], note: null}
  for (const destination of ['field', 'follow']) {
    assert.deepEqual(planPin(reading({selected: ['e1']}), control, {destination, shared: false}), follow, destination)
    const refused = planPin(reading({selected: ['e2']}), control, {destination, shared: false})
    assert.equal(refused.ok, false, `${destination} refuses an unselected object`)
    assert.match(refused.reason, /Select this object/)
  }
  const refusedNone = planPin(reading(), control, {destination: 'follow', shared: false})
  assert.equal(refusedNone.ok, false)
})

test('an object control in the Bind destination pins by name, whatever is selected', () => {
  const control = {kind: 'entity', entityId: 'e1', key: 'size.x'}
  const named = {ok: true, verb: 'pin', changes: [{kind: 'chosen-add', key: 'size.x', scope: 'named', entity_id: 'e1'}], note: null}
  assert.deepEqual(planPin(reading({selected: ['e2']}), control, {destination: 'bind', shared: false}), named)
  assert.deepEqual(planPin(reading(), control, {destination: 'bind', shared: false}), named)
})

test('a named entry pins and unpins by entity and key, and a Follow of the same key does not match it', () => {
  const control = {kind: 'entity', entityId: 'e1', key: 'size.x'}
  const entries = [{id: 'n1', key: 'size.x', scope: 'named', entityId: 'e1', sceneId: 's1', journeyId: 'j1'}]
  const unpin = {ok: true, verb: 'unpin', changes: [{kind: 'chosen-remove', entry_id: 'n1'}], note: null}
  assert.deepEqual(planPin(reading({entries}), control, {destination: 'bind', shared: false}), unpin)
  assert.deepEqual(planPin(reading({entries, selected: ['e2']}), control, {destination: 'follow', shared: false}), unpin, 'named match ignores selection')
  const otherEntity = planPin(reading({entries}), {kind: 'entity', entityId: 'e2', key: 'size.x'}, {destination: 'bind', shared: false})
  assert.deepEqual(otherEntity, {ok: true, verb: 'pin', changes: [{kind: 'chosen-add', key: 'size.x', scope: 'named', entity_id: 'e2'}], note: null})
})

test('a selected entry matches only while its object is selected', () => {
  const control = {kind: 'entity', entityId: 'e1', key: 'size.x'}
  const entries = [{id: 's1', key: 'size.x', scope: 'selected'}]
  assert.deepEqual(planPin(reading({entries, selected: ['e1']}), control, {destination: 'follow', shared: false}),
    {ok: true, verb: 'unpin', changes: [{kind: 'chosen-remove', entry_id: 's1'}], note: null})
  const elsewhere = planPin(reading({entries, selected: ['e2']}), control, {destination: 'follow', shared: false})
  assert.equal(elsewhere.ok, false, 'not pinned here, and e1 is not selected')
  assert.deepEqual(planPin(reading({entries, selected: ['e2']}), control, {destination: 'bind', shared: false}),
    {ok: true, verb: 'pin', changes: [{kind: 'chosen-add', key: 'size.x', scope: 'named', entity_id: 'e1'}], note: null})
})

test('pinnedEntry finds the Field entry by key, and pinScopeMark reads shared, local or nothing', () => {
  const entry = {id: 'v1', key: keyOf(VISCOSITY), scope: 'field'}
  const pinnedHere = reading({entries: [entry]})
  assert.equal(pinnedEntry(pinnedHere, {kind: 'field', path: VISCOSITY}), entry)
  assert.equal(pinnedEntry(pinnedHere, {kind: 'field', path: GRAVITY_Y}), undefined)
  assert.equal(pinnedEntry(reading({entries: [{id: 'x', key: 'size.x', scope: 'selected'}], selected: ['e1']}), {kind: 'entity', entityId: 'e1', key: 'size.x'})?.id, 'x')

  assert.equal(pinScopeMark(reading(), {kind: 'entity', entityId: 'e1', key: 'size.x'}), null)
  assert.equal(pinScopeMark(reading(), {kind: 'field', path: 'interaction.strength'}), null)
  assert.equal(pinScopeMark(reading({sharedTargets: ['field.' + keyOf(VISCOSITY)]}), {kind: 'field', path: VISCOSITY}), 'shared')
  assert.equal(pinScopeMark(reading({sharedTargets: ['field.' + keyOf(GRAVITY_Y)]}), {kind: 'field', path: VISCOSITY}), 'local')
  assert.equal(pinScopeMark(reading(), {kind: 'field', path: VISCOSITY}), 'local')
})

test('a shared field pin carries a shared-setting that the device validator admits', () => {
  const plan = planPin(reading(), {kind: 'field', path: GRAVITY_Y}, {destination: 'field', shared: true})
  const share = plan.changes.find(change => change.kind === 'shared-setting')
  assert.deepEqual(validateNativeSharedSettingChange(share), {kind: 'shared-setting', target: 'field.' + keyOf(GRAVITY_Y), shared: true})
})

test('end to end: a field pin lands in Journey.shared.toolbelt, and its unpin removes exactly that entry', () => {
  const journey = initialiseShared(blankJourney())
  const sceneId = journey.scenes[0].id
  const before = structuredClone(journey.shared.toolbelt)
  assert.equal(before.some(entry => entry.key === keyOf(GRAVITY_Y)), false, 'the seed toolbelt does not already pin gravity Y')

  const pin = planPin(reading({entries: journey.shared.toolbelt, scene: journey.scenes[0]}), {kind: 'field', path: GRAVITY_Y}, {destination: 'field', shared: false})
  assert.equal(pin.verb, 'pin')
  const pinned = applyNativeChosenControlChanges(journey, sceneId, pin.changes.filter(change => change.kind === 'chosen-add'), [], {})
  assert.equal(pinned.shared.toolbelt.length, before.length + 1)
  assert.deepEqual(pinned.shared.toolbelt.slice(0, before.length), before)
  const added = pinned.shared.toolbelt.at(-1)
  assert.deepEqual({key: added.key, scope: added.scope}, {key: keyOf(GRAVITY_Y), scope: 'field'})
  assert.equal(journey.shared.toolbelt.length, before.length, 'the source journey is not mutated')

  const unpin = planPin(reading({entries: pinned.shared.toolbelt, scene: pinned.scenes[0]}), {kind: 'field', path: GRAVITY_Y}, {destination: 'field', shared: false})
  assert.equal(unpin.verb, 'unpin')
  assert.deepEqual(unpin.changes, [{kind: 'chosen-remove', entry_id: added.id}])
  const unpinned = applyNativeChosenControlChanges(pinned, sceneId, unpin.changes, [], {})
  assert.deepEqual(unpinned.shared.toolbelt, before)
})

test('the scope mark flips a shareable Field control between shared and local, and offers nothing for the rest', () => {
  const shareable = NATIVE_BINDINGS.find(item => sharedFieldBinding('field.' + item.key))
  const unshareable = NATIVE_BINDINGS.find(item => !sharedFieldBinding('field.' + item.key))
  const reading = shared => ({chosenControls: {available: true, entries: [], controls: []}, selection: {entity_ids: []}, sharedTargets: shared})
  assert.deepEqual(pins.scopeFlipChange(reading([]), {kind: 'field', path: shareable.path}), {kind: 'shared-setting', target: 'field.' + shareable.key, shared: true}, 'a local control is shared')
  assert.deepEqual(pins.scopeFlipChange(reading(['field.' + shareable.key]), {kind: 'field', path: shareable.path}), {kind: 'shared-setting', target: 'field.' + shareable.key, shared: false}, 'a shared control goes local')
  assert.equal(pins.scopeFlipChange(reading([]), {kind: 'entity', entityId: 'e1', key: 'scale'}), null, 'an object control has no share switch')
  if (unshareable) assert.equal(pins.scopeFlipChange(reading([]), {kind: 'field', path: unshareable.path}), null, 'a pointer-bucket parameter cannot be shared')
})
