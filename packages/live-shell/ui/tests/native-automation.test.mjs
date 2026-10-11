import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production sources through the same TypeScript loader as the sibling native tests.
// Fixtures are in-memory Journeys; the commit test reads the same owner receipt as native-entity-settings.test.mjs.
const root = new URL('../../../../', import.meta.url)
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
  if(url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(url.split('?')[0]),'utf8'))};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const [automation, model, links, parameters, {kernelDocumentToJourney}, {prepareCompositionEdit}, {DocumentStore}, {createRetainedNativeEditor}] = await Promise.all([
  import(new URL('nativeAutomationEdits.ts', boundary)), import(new URL('model.ts', author)), import(new URL('automationLinks.ts', author)),
  import(new URL('parameters.ts', boundary)), import(new URL('kernelDocumentBridge.ts', author)), import(new URL('kernelComposition.ts', author)),
  import(new URL('store.ts', author)), import(new URL('hostEditor.ts', author)),
])
const hostEditorSource = await readFile(new URL('hostEditor.ts', author), 'utf8')
const appSource = await readFile(new URL('app.ts', author), 'utf8')
const {automationLeader, resolvedAutomation, linkAutomation, removeAutomation, removeGroupTarget} = links
const {NATIVE_AUTOMATION_WAVES, NATIVE_AUTOMATION_EASINGS, NATIVE_AUTOMATION_RANGES} = automation

const enc = id => encodeURIComponent(id)
const VALUE_REFUSAL = /admitted native automation setting and value/
const EDIT_REFUSAL = /admitted native automation edit/
const apply = (journey, changes) => automation.applyNativeAutomationChanges(journey, journey.scenes[0].id, changes)
const add = (target, group_id) => ({kind: 'automation-add', target, ...(group_id === undefined ? {} : {group_id})})
const set = (lane_id, values) => ({kind: 'automation-set', lane_id, values})
const link = (lane_id, leader_id) => ({kind: 'automation-link', lane_id, leader_id})
const remove = (lane_id, scope) => ({kind: 'automation-remove', lane_id, scope})
const order = lane_ids => ({kind: 'automation-order', lane_ids})
const lanesOf = journey => journey.scenes[0].automation
const laneOf = (journey, id) => lanesOf(journey).find(lane => lane.id === id)
const sceneWithEntities = () => {
  const journey = model.blankJourney()
  journey.scenes[0].entities = structuredClone(model.chakraEntities())
  return journey
}
const bindingOf = (journey, target) => parameters.automationTarget(journey.scenes[0], target)
const entityTarget = (journey, index, suffix) => 'entity:' + enc(journey.scenes[0].entities[index].id) + ':' + suffix

test('an add creates one independent lane with the app defaults, inside the target binding', () => {
  const before = model.blankJourney(), journey = apply(before, [add('field.dispersion')])
  const lane = lanesOf(journey)[0], binding = bindingOf(journey, 'field.dispersion')
  assert.equal(lanesOf(journey).length, 1)
  assert.equal(lane.target, 'field.dispersion')
  assert.equal(lane.syncWith, undefined, 'an independent lane has no leader')
  for (const [key, value] of Object.entries({enabled: true, type: 'lfo', wave: 'sine', rate: 0.08, phase: 0, blend: 'replace', duration: 4, delay: 0, loop: 'once', firedAt: null}))
    assert.equal(lane[key], value, key)
  assert.ok(lane.min >= binding.hardMin && lane.max <= binding.hardMax, 'the default range is clamped to the hard range')
  assert.deepEqual(lanesOf(before), [], 'the caller document is never mutated')
})

test('an add refuses unprefixed, unknown, duplicate and invalid-group targets', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  assert.throws(() => apply(journey, [add('dispersion')]), /Choose an admitted automation parameter/, 'unprefixed target')
  assert.throws(() => apply(journey, [add('field.nope')]), /no admitted automation target/, 'unknown field')
  assert.throws(() => apply(journey, [add('entity:nope:size.x')]), /no admitted automation target/, 'unknown entity')
  assert.throws(() => apply(journey, [add('field.dispersion')]), /already automated/, 'duplicate target')
  assert.throws(() => apply(journey, [add('field.speed', 'nope')]), /no longer belongs to this Scene/, 'missing group')
  const grouped = apply(journey, [add('field.speed', lanesOf(journey)[0].id)])
  assert.throws(() => apply(grouped, [add('field.recovery', lanesOf(grouped)[1].id)]), /through its leader/, 'a target is not a group leader')
})

test('an add joins a group as a follower; the leader keeps its own fields and the follower inherits them', () => {
  const leaderJourney = apply(model.blankJourney(), [add('field.dispersion')]), leader = lanesOf(leaderJourney)[0]
  const journey = apply(leaderJourney, [add('field.speed', leader.id)]), follower = lanesOf(journey)[1]
  assert.equal(follower.syncWith, leader.id)
  assert.equal(automationLeader(lanesOf(journey), follower).id, leader.id)
  assert.equal(follower.target, 'field.speed', 'the follower keeps its own target')
  const next = apply(journey, [set(leader.id, {wave: 'triangle', rate: 1.25})])
  assert.equal(resolvedAutomation(lanesOf(next), laneOf(next, follower.id)).wave, 'triangle', 'the follower reads the leader wave')
  assert.equal(resolvedAutomation(lanesOf(next), laneOf(next, follower.id)).rate, 1.25, 'the follower reads the leader rate')
})

test('an add of field.frequency switches the Scene frequency driver, as the app does', () => {
  const journey = apply(model.blankJourney(), [add('field.frequency')])
  assert.equal(journey.scenes[0].composition.frequencyDriver, 'automation')
})

test('every automation-set value is checked against its admitted option list or numeric range', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')]), id = lanesOf(journey)[0].id
  const admitted = {enabled: [true, false], type: ['lfo', 'ramp'], wave: [...NATIVE_AUTOMATION_WAVES], blend: ['replace', 'add', 'multiply'],
    loop: ['once', 'loop', 'pingpong'], easing: [...NATIVE_AUTOMATION_EASINGS], rate: [0, 0.5, 2], phase: [0, 1], duration: [0.01, 30], delay: [0, 10]}
  for (const [key, values] of Object.entries(admitted)) for (const value of values) {
    const next = apply(journey, [set(id, {[key]: value})])
    assert.equal(laneOf(next, id)[key], value, `${key}=${value}`)
  }
  const refused = {wave: ['randomStep', 'steps2', null, 1], type: ['oneShot', 'LFO'], blend: ['mix', 'Replace'], loop: ['none', 'restart'], easing: ['easeInOut', null],
    enabled: ['true', 1, null], rate: [-0.001, 2.001, NaN, Infinity, '1'], phase: [-0.001, 1.001, Infinity], duration: [0, 0.009, 30.5], delay: [-1, 10.5, NaN],
    min: [NaN, Infinity, '0.5', null], max: [NaN, '1']}
  for (const [key, values] of Object.entries(refused)) for (const value of values)
    assert.throws(() => apply(journey, [set(id, {[key]: value})]), key === 'min' || key === 'max' ? /finite|must be between|admitted native automation setting/ : VALUE_REFUSAL, `${key}=${String(value)}`)
  assert.deepEqual(NATIVE_AUTOMATION_RANGES, {rate: [0, 2], phase: [0, 1], duration: [0.01, 30], delay: [0, 10]})
})

test('an automation-set refuses empty, foreign and unknown operands, including fire and takeover', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')]), id = lanesOf(journey)[0].id
  assert.throws(() => apply(journey, [set(id, {})]), VALUE_REFUSAL, 'empty values')
  assert.throws(() => apply(journey, [set(id, null)]), VALUE_REFUSAL, 'null values')
  assert.throws(() => apply(journey, [set(id, {firedAt: 3})]), VALUE_REFUSAL, 'firedAt is not an authored value')
  assert.throws(() => apply(journey, [set(id, {target: 'field.speed'})]), VALUE_REFUSAL, 'the target is not editable here')
  assert.throws(() => apply(journey, [set(id, {id: 'x'})]), VALUE_REFUSAL, 'the id is not editable')
  assert.throws(() => apply(journey, [{...set(id, {enabled: true}), scope: 'scene'}]), /only its own operands/, 'foreign operand')
  assert.throws(() => apply(journey, [{kind: 'automation-fire', lane_id: id}]), EDIT_REFUSAL, 'fire is not admitted')
  assert.throws(() => apply(journey, [{kind: 'take-manual', target: 'field.dispersion'}]), EDIT_REFUSAL, 'manual takeover is not admitted')
  assert.throws(() => apply(journey, [set('nope', {enabled: false})]), /no longer belongs to this Scene/, 'unknown lane')
})

test('min and max are bounded by the target binding and admit its exact ends', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')]), id = lanesOf(journey)[0].id, binding = bindingOf(journey, 'field.dispersion')
  for (const value of [binding.hardMin, binding.hardMax]) {
    assert.equal(laneOf(apply(journey, [set(id, {min: value})]), id).min, value)
    assert.equal(laneOf(apply(journey, [set(id, {max: value})]), id).max, value)
  }
  assert.throws(() => apply(journey, [set(id, {min: binding.hardMin - 1e-4})]), /must be between/)
  assert.throws(() => apply(journey, [set(id, {max: binding.hardMax + 1e-4})]), /must be between/)
  const entities = sceneWithEntities(), entityLane = apply(entities, [add(entityTarget(entities, 0, 'size.x'))]), entityId = lanesOf(entityLane)[0].id
  const sizeBinding = bindingOf(entityLane, entityTarget(entities, 0, 'size.x'))
  assert.equal(laneOf(apply(entityLane, [set(entityId, {min: 0.001, max: 100})]), entityId).max, 100, 'the formation size range is 0.001–100')
  assert.throws(() => apply(entityLane, [set(entityId, {min: 0})]), /must be between/, 'zero is outside the formation size range')
  assert.throws(() => apply(entityLane, [set(entityId, {max: 100.5})]), /must be between/)
  assert.equal(sizeBinding.hardMax, 100)
})

test('a follower refuses its inherited fields, and admits its own target fields', () => {
  const leaderJourney = apply(model.blankJourney(), [add('field.dispersion')]), leader = lanesOf(leaderJourney)[0]
  const journey = apply(leaderJourney, [add('field.speed', leader.id)]), follower = lanesOf(journey)[1]
  for (const values of [{type: 'ramp'}, {wave: 'saw'}, {rate: 1}, {phase: 0.5}, {duration: 2}, {delay: 1}, {loop: 'loop'}, {easing: 'linear'}, {rate: 1, enabled: true}])
    assert.throws(() => apply(journey, [set(follower.id, values)]), /belongs to this group's leader/, JSON.stringify(values))
  const next = apply(journey, [set(follower.id, {min: 0.1, max: 0.2, blend: 'add', enabled: false})])
  assert.equal(laneOf(next, follower.id).min, 0.1)
  assert.equal(laneOf(next, follower.id).blend, 'add')
  assert.equal(laneOf(next, follower.id).enabled, false, 'enabled is the follower’s own switch, combined with the leader')
  assert.equal(laneOf(next, leader.id).enabled, true, 'the leader is untouched')
})

test('link and unlink follow the app group semantics and refuse self-links, nested groups and unknown leaders', () => {
  const base = apply(model.blankJourney(), [add('field.dispersion'), add('field.speed')])
  const journey = apply(base, [set(lanesOf(base)[0].id, {wave: 'saw', rate: 0.5})]), [first, second] = lanesOf(journey)
  const linked = apply(journey, [link(second.id, first.id)])
  assert.equal(laneOf(linked, second.id).syncWith, first.id)
  assert.equal(automationLeader(lanesOf(linked), laneOf(linked, second.id)).id, first.id)
  const unlinked = apply(linked, [link(second.id, null)])
  assert.equal(laneOf(unlinked, second.id).syncWith, undefined, 'unlink removes the link')
  assert.equal(laneOf(unlinked, second.id).wave, 'saw', 'unlink materialises the leader wave the target was reading')
  assert.equal(laneOf(unlinked, second.id).rate, 0.5, 'unlink materialises the leader rate')
  assert.throws(() => apply(journey, [link(first.id, first.id)]), /cannot lead itself/)
  assert.throws(() => apply(journey, [link(second.id, null)]), /not linked to a group/, 'an unlinked lane has nothing to unlink')
  assert.throws(() => apply(journey, [link(second.id, 'nope')]), /no longer belongs/)
  const third = apply(linked, [add('field.recovery', first.id)]), thirdId = lanesOf(third).at(-1).id
  assert.throws(() => apply(third, [link(thirdId, second.id)]), /Link to a group leader/, 'a target is not a leader')
  const fourth = apply(third, [add('field.snapRigidity')]), freeId = lanesOf(fourth).at(-1).id
  assert.throws(() => apply(fourth, [link(first.id, freeId)]), /leads a group/, 'a leader with targets refuses to join another group')
})

test('group-target removal promotes the first target and keeps the others in the group; lane removal detaches them', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')]), leader = lanesOf(journey)[0]
  const grouped = apply(journey, [add('field.speed', leader.id), add('field.recovery', leader.id)])
  const [, speed, recovery] = lanesOf(grouped)
  const promoted = apply(grouped, [remove(leader.id, 'group-target')])
  const newLeader = laneOf(promoted, speed.id)
  assert.equal(lanesOf(promoted).length, 2)
  assert.equal(newLeader.syncWith, undefined, 'the first target becomes the leader')
  assert.equal(newLeader.clockId, leader.clockId || leader.nativeId || leader.id, 'the group clock is kept')
  assert.equal(laneOf(promoted, recovery.id).syncWith, speed.id, 'the other target stays in the group')
  const dropped = apply(promoted, [remove(recovery.id, 'group-target')])
  assert.equal(lanesOf(dropped).length, 1, 'a follower removal drops only that target')
  assert.equal(laneOf(dropped, speed.id).syncWith, undefined)
  const detached = apply(grouped, [remove(leader.id, 'lane')])
  assert.deepEqual(lanesOf(detached).map(lane => lane.id), [speed.id, recovery.id])
  assert.equal(laneOf(detached, speed.id).syncWith, undefined, 'lane removal detaches each target')
  assert.equal(laneOf(detached, recovery.id).syncWith, undefined)
  assert.equal(laneOf(detached, speed.id).wave, leader.wave, 'detached targets keep the leader fields they were reading')
  assert.throws(() => apply(grouped, [remove('nope', 'lane')]), /no longer belongs/)
  assert.throws(() => apply(grouped, [remove(leader.id, 'everything')]), EDIT_REFUSAL)
})

test('order must be an exact permutation of the Scene lanes, and the array order is the stored order', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion'), add('field.speed'), add('field.recovery')])
  const [a, b, c] = lanesOf(journey).map(lane => lane.id)
  assert.throws(() => apply(journey, [order([a, b])]), /retain every automation exactly once/, 'missing lane')
  assert.throws(() => apply(journey, [order([a, a, b])]), /retain every automation exactly once/, 'duplicate lane')
  assert.throws(() => apply(journey, [order([a, b, 'nope'])]), /retain every automation exactly once/, 'unknown lane')
  assert.throws(() => apply(journey, [order([a, b, c, c])]), /retain every automation exactly once/, 'extra lane')
  assert.deepEqual(lanesOf(apply(journey, [order([c, a, b])])).map(lane => lane.id), [c, a, b])
  assert.deepEqual(lanesOf(apply(journey, [order([a, b, c])])).map(lane => lane.id), [a, b, c], 'an identity order is admitted')
})

test('a refused batch leaves the caller document untouched and an earlier change in the batch does not leak', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')]), before = structuredClone(journey), id = lanesOf(journey)[0].id
  assert.throws(() => apply(journey, [set(id, {enabled: false}), set(id, {rate: 9})]), VALUE_REFUSAL)
  assert.deepEqual(journey, before, 'the caller document is never mutated')
})

test('the host routes automation kinds into their own batch family, outside device and glyph reducers', () => {
  assert.match(hostEditorSource, /kind\.startsWith\('automation-'\)\?'automation'/)
  assert.match(hostEditorSource, /type==='automation'\?applyNativeAutomationChanges\(next,scene\.id,changes as NativeAutomationChange\[\]\)/)
  assert.match(hostEditorSource, /import \{applyNativeAutomationChanges\} from '[^']*nativeAutomationEdits'/)
  assert.doesNotMatch(hostEditorSource, /deviceKinds=new Set\(\[[^\]]*'automation-/, 'automation kinds never enter the device family')
})

test('parity with the app helpers: group operations and the add defaults match app.ts for the same inputs', () => {
  // Group operations: the reducer calls the same exported helpers app.ts calls, on the same lanes.
  const journey = apply(model.blankJourney(), [add('field.dispersion'), add('field.speed'), add('field.recovery')])
  const [a, b, c] = lanesOf(journey)
  const baseLanes = structuredClone(lanesOf(apply(journey, [link(b.id, a.id), link(c.id, a.id)])))
  const viaReducer = apply(journey, [link(b.id, a.id), link(c.id, a.id), link(b.id, null)])
  const viaHelpers = structuredClone(baseLanes), helperTarget = viaHelpers.find(lane => lane.id === b.id)
  linkAutomation(viaHelpers, b.id, '')
  assert.deepEqual(lanesOf(viaReducer), viaHelpers, 'link and unlink equal the helper result')
  assert.equal(helperTarget.syncWith, undefined)
  const removedReducer = apply(journey, [link(b.id, a.id), remove(a.id, 'group-target')])
  const removedHelpers = structuredClone(lanesOf(apply(journey, [link(b.id, a.id)])))
  assert.deepEqual(lanesOf(removedReducer), removeGroupTarget(removedHelpers, a.id), 'group-target removal equals removeGroupTarget')
  const deletedReducer = apply(apply(journey, [link(b.id, a.id)]), [remove(a.id, 'lane')])
  const deletedHelpers = structuredClone(lanesOf(apply(journey, [link(b.id, a.id)])))
  assert.deepEqual(lanesOf(deletedReducer), removeAutomation(deletedHelpers, a.id), 'lane removal equals removeAutomation')

  // Add defaults: app.ts addLane pushes this exact literal and clamps a 10% span into the hard range.
  assert.match(appSource, /const span=\(p\.max-p\.min\)\*\.1,low=clamp\(p\.value-span,p\.hardMin,p\.hardMax\),high=clamp\(p\.value\+span,p\.hardMin,p\.hardMax\)/)
  assert.match(appSource, /enabled:true,target,type:'lfo',wave:'sine',min:low,max:high,rate:\.08,phase:0,blend:'replace',duration:4,delay:0,loop:'once',firedAt:null/)
  const fresh = apply(model.blankJourney(), [add('field.dispersion')]), lane = lanesOf(fresh)[0], p = bindingOf(fresh, 'field.dispersion')
  const span = (p.max - p.min) * 0.1
  assert.equal(lane.min, Math.max(p.hardMin, Math.min(p.hardMax, p.value - span)), 'the low end matches addLane clamp')
  assert.equal(lane.max, Math.max(p.hardMin, Math.min(p.hardMax, p.value + span)), 'the high end matches addLane clamp')

  // Reorder: app.ts lane-up/lane-down swaps two adjacent lanes; the permutation result must equal that swap.
  const ids = lanesOf(journey).map(lane => lane.id)
  for (let index = 0; index + 1 < ids.length; index++) {
    const swapped = [...ids];[swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]]
    assert.deepEqual(lanesOf(apply(journey, [order(swapped)])).map(lane => lane.id), swapped, `adjacent swap ${index}`)
  }
  assert.match(appSource, /case 'lane-up':case 'lane-down':\{[^}]*\[s\.automation\[index\],s\.automation\[next\]\]=\[s\.automation\[next\],s\.automation\[index\]\]/)
})

test('readback and round trip: each gesture commits one document, the reading carries the lanes, and the composition material contains them', async () => {
  const receiptPath = process.env.OI_NATIVE_COMPOSITION_RECEIPT ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json'
  const nativeDocument = JSON.parse(await readFile(receiptPath, 'utf8')).after.document
  const view = kernelDocumentToJourney(nativeDocument)
  const store = new DocumentStore(view.journey)
  const scene = store.document.scenes.find(item => item.id === view.startSceneId) ?? store.document.scenes[0]
  let committed = 0
  const owner = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: () => {throw Error('closed')}, commit: async () => { committed++; return true }, change: mutate => store.change(mutate), afterHistory: () => {throw Error('closed')},
    selectLocal: () => {throw Error('closed')}, openEditor: () => {throw Error('closed')}, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false})
  await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [add('field.dispersion')]})
  assert.equal(committed, 1, 'one gesture, one commit')
  const laneId = store.document.scenes.find(item => item.id === scene.id).automation[0].id
  assert.equal(owner.read().scene.automation.length, 1, 'the reading carries the new lane')
  assert.equal(owner.read().standing.dirty, true, 'the new lane is a dirty composition change')
  await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [set(laneId, {min: 0.25, max: 0.75, wave: 'steps', easing: 'bounce'}), add('field.speed', laneId)]})
  assert.equal(committed, 2, 'a second gesture is a second commit')
  const reading = owner.read().scene.automation
  assert.equal(reading.length, 2, 'the follower is in the reading')
  assert.equal(reading[0].min, 0.25)
  assert.equal(reading[1].syncWith, laneId, 'the reading carries the group link')
  const request = prepareCompositionEdit(view, store.document, {sceneId: scene.id})
  const material = request.changes.find(change => change.change === 'scene_material_set' && change.scene_ref === view.bindings[scene.id]?.scene_ref)
  assert.ok(material, 'the edited Scene is one scene_material_set')
  assert.deepEqual(material.presentation.scene.automation, store.document.scenes.find(item => item.id === scene.id).automation, 'the committed material carries every lane, unchanged')
})
