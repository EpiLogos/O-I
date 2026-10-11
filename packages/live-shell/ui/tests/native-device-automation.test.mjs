import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production modules in memory: .ts/.tsx transpiled, CSS stubbed, and @epilogos/expressions-boundary/<name> resolved to the boundary source.
// The desktop owner sources are imported by absolute URL, as the sibling boundary tests do. No owner, store, server or browser is simulated.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(s, c, n) {
  if (s.startsWith('@epilogos/expressions-boundary/')) return n(BOUNDARY + s.slice('@epilogos/expressions-boundary/'.length) + '.ts', c);
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const engine = new URL('desktop/cradle/expressions-app/src/engine/', root)
const [model, links, nativeBridgeSource, engineAutomation, edits, parameters, faceModel, faceView, registry, catalogue, sceneModels] = await Promise.all([
  import(new URL('model.ts', author)),
  import(new URL('automationLinks.ts', author)),
  readFile(new URL('nativeBridge.ts', author), 'utf8'),
  import(new URL('automation.ts', engine)),
  import(new URL('nativeAutomationEdits.ts', boundary)),
  import(new URL('parameters.ts', boundary)),
  import('../src/components/nativeSceneFace.automation.ts'),
  import('../src/components/NativeSceneFace.automation.tsx'),
  import('../src/components/nativeSceneFaceViews.tsx'),
  import('../src/components/nativeDeviceCatalogue.ts'),
  import('../src/components/nativeSceneFaceModel.ts'),
])
const {
  INHERITED_LANE_FIELDS, addLaneChange, admittedTargets, automationFaceModel, automationSummary, curveWindow, dragLaneIds, effectiveLane, handleFrame,
  handlePosition, handleStep, handleValue, laneCurve, laneFieldBounds, laneGroups, laneRole, laneValuesChange, linkLaneChange, moveLaneIds,
  orderLanesChange, parseLaneNumber, removeLaneChange, roundTo, rampValue, targetLabel, valueFraction, addLaneProblem,
} = faceModel
const {AutomationFacePanel} = faceView
const {SCENE_FACE_MODELS} = sceneModels
const {SCENE_FACE_VIEWS, sceneFaceView} = registry
const {applyNativeAutomationChanges, validateNativeAutomationChange, NATIVE_AUTOMATION_LANE_LIMIT} = edits
const {NATIVE_BINDINGS, automationTarget} = parameters
const {waveform, ease} = engineAutomation

const apply = (journey, changes) => applyNativeAutomationChanges(journey, journey.scenes[0].id, changes)
const add = (target, group_id) => ({kind: 'automation-add', target, ...(group_id === undefined ? {} : {group_id})})
const set = (lane_id, values) => ({kind: 'automation-set', lane_id, values})
const lanesOf = journey => journey.scenes[0].automation
const laneOf = (journey, id) => lanesOf(journey).find(lane => lane.id === id)
const SCENE_REF = 'expression:whole:scene:main'

/** A NativeEditorReading around one in-memory Journey's first Scene. Only the fields the panel reads are disclosed. */
function readingOf(journey, over = {}) {
  return {
    basis: {expression_ref: 'expression:whole', revision: 3, scene_ref: SCENE_REF, authored_revision: 5},
    scene: journey.scenes[0], entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null}, ...over,
  }
}
/** Renders the panel for a reading. The stub apply records every change it is handed; rendering itself must send nothing. */
function render(reading, over = {}) {
  const sent = []
  const send = async changes => {sent.push(...changes); return {ok: true, reading}}
  const markup = renderToStaticMarkup(createElement(AutomationFacePanel, {reading, request: async () => ({ok: true, reading}), disabled: false, apply: send, ...over}))
  return {markup, sent}
}
/** The opening tag of the first element whose aria-label is `label`. */
function tagFor(markup, label) {
  const at = markup.indexOf(`aria-label="${label}"`)
  if (at < 0) return null
  return markup.slice(markup.lastIndexOf('<', at), markup.indexOf('>', at) + 1)
}

/** Lanes: A leads B; C leads D (a follower each); engine order is A, B, C, D. */
function groupedJourney() {
  let journey = apply(model.blankJourney(), [add('field.dispersion'), add('field.speed')])
  const [a, b] = lanesOf(journey).map(lane => lane.id)
  journey = apply(journey, [{kind: 'automation-link', lane_id: b, leader_id: a}])
  journey = apply(journey, [add('field.recovery'), add('field.frequency')])
  const [, , c, d] = lanesOf(journey).map(lane => lane.id)
  return apply(journey, [{kind: 'automation-link', lane_id: d, leader_id: c}])
}
const ids = journey => lanesOf(journey).map(lane => lane.id)
const labelOf = key => NATIVE_BINDINGS.find(binding => binding.key === key).label

// ---- Registry and summary -----------------------------------------------------------

test('the automation device is one scene entry: summary and facts only, no activator, no compact action, studio automation', () => {
  assert.equal(SCENE_FACE_MODELS.automation, automationFaceModel)
  assert.equal(sceneFaceView('automation'), AutomationFacePanel)
  assert.equal(SCENE_FACE_VIEWS.automation, AutomationFacePanel)
  assert.equal(automationFaceModel.name, 'Automation')
  assert.deepEqual(automationFaceModel.groups.map(group => group.title), ['Lanes', 'Selected lane'])
  assert.equal(automationFaceModel.studio, 'automation')
  assert.equal(automationFaceModel.enabled(readingOf(model.blankJourney())), undefined, 'hollow light: no owner enable exists')
  assert.equal(automationFaceModel.compactActions, undefined, 'an add needs a target from the picker, so the widget shows the summary only')
  const device = catalogue.deviceCatalogue().find(item => item.family === 'automation')
  assert.equal(device.scope, 'scene')
  assert.deepEqual(device.actions(readingOf(model.blankJourney())), [], 'no compact action is offered')
})

test('the summary counts lanes and enabled lanes, a follower counting only when its leader runs', () => {
  assert.equal(automationSummary(undefined), 'Automation not disclosed')
  assert.equal(automationFaceModel.summary(readingOf(model.blankJourney())), '0 lanes · 0 enabled')
  const journey = groupedJourney()
  assert.equal(automationFaceModel.summary(readingOf(journey)), '4 lanes · 4 enabled')
  const [a, b] = ids(journey)
  const paused = apply(journey, [set(a, {enabled: false})])
  assert.equal(automationSummary(lanesOf(paused)), '4 lanes · 2 enabled', 'the leader off silences its follower too')
  assert.equal(effectiveLane(lanesOf(paused), laneOf(paused, b)).enabled, false)
})

// ---- The curve: the engine's own waveform and ease --------------------------------

test('a sine lane starts at the middle of its band, the value the engine gives at phase 0', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const lane = {...lanesOf(journey)[0], min: 2, max: 6, wave: 'sine', phase: 0, rate: 0.5, type: 'lfo'}
  const curve = laneCurve(lane)
  assert.equal(curve.kind, 'cycle')
  assert.equal(curve.xMax, 1)
  assert.deepEqual(curve.start, {x: 0, y: 4}, 'engine: lo + (hi - lo) * (0.5 + 0.5 * sin(0)) is the middle')
  const runtime = {startTime: 0, token: 0, randSeed: 0, lastStep: -1, lastValue: 0, nextValue: 0}
  for (const point of curve.points.filter((_, index) => index % 16 === 0)) {
    assert.equal(point.y, 2 + 4 * (0.5 + 0.5 * waveform('sine', point.x, runtime)), `sample at ${point.x} is the engine waveform`)
  }
  assert.match(curve.note, /2 s at 0\.5 Hz/, 'one cycle lasts 1 / rate seconds')
})

test('square and triangle start where the engine starts them, not where timeline.ts evaluates them', () => {
  // engine/automation.ts: square is +1 for f < 0.5 (high), triangle is 1 - 4|f - 0.5| (low at f = 0).
  // timeline.ts uses 0/1 unit waves (square low at t = 0, triangle at 0). The app's engine is the source of truth for the drawing.
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const base = {...lanesOf(journey)[0], min: 0, max: 10, phase: 0, rate: 1, type: 'lfo'}
  assert.equal(laneCurve({...base, wave: 'square'}).start.y, 10, 'square starts high')
  assert.equal(laneCurve({...base, wave: 'triangle'}).start.y, 0, 'triangle starts low')
})

test('a saw starts at the low end of the band at phase 0 and random waves draw four cycles from seed 0', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const base = {...lanesOf(journey)[0], min: 0, max: 10, phase: 0, rate: 1, type: 'lfo'}
  assert.equal(laneCurve({...base, wave: 'saw'}).points[0].y, 0, 'saw at f = 0 is -1, the low end')
  const random = laneCurve({...base, wave: 'steps'})
  assert.equal(random.xMax, 4)
  assert.equal(random.start, null, 'a random wave has no single start point')
  assert.match(random.note, /seed 0/)
  assert.equal(curveWindow({...base, wave: 'smooth'}), 4)
})

test('a morph drive lane draws no shape of its own, and says so', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const curve = laneCurve({...lanesOf(journey)[0], wave: 'morph', type: 'lfo'})
  assert.equal(curve.kind, 'drive')
  assert.deepEqual(curve.points, [])
  assert.match(curve.note, /Morph page/)
})

test('a ramp holds its From value through the delay, then runs the engine ease once and holds at To', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const lane = {...lanesOf(journey)[0], type: 'ramp', min: 1, max: 5, delay: 2, duration: 4, loop: 'once', easing: 'easeIn'}
  assert.equal(rampValue(lane, 1), 1, 'before the delay the value is From')
  assert.equal(rampValue(lane, 2), 1, 'at the start of the run u = 0')
  assert.equal(rampValue(lane, 4), 1 + 4 * ease('easeIn', 0.5), 'u = (elapsed / duration) at the middle of the run, through the engine ease')
  assert.equal(rampValue(lane, 9), 5, 'after the run it holds at To')
  const curve = laneCurve(lane)
  assert.equal(curve.kind, 'ramp')
  assert.equal(curve.xMax, 6, 'delay plus one run for a once ramp')
  assert.equal(curve.points.at(-1).y, 5)
})

test('a repeating ramp restarts or runs back and forth, as the engine does, over two runs', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const base = {...lanesOf(journey)[0], type: 'ramp', min: 0, max: 10, delay: 0, duration: 2, easing: 'linear'}
  assert.equal(curveWindow({...base, loop: 'loop'}), 4)
  assert.equal(rampValue({...base, loop: 'loop'}, 2), 0, 'restart: the second run starts again from From')
  assert.equal(rampValue({...base, loop: 'loop'}, 3), 5, 'restart: half-way through the second run')
  assert.equal(rampValue({...base, loop: 'pingpong'}, 3), 5, 'ping-pong: half-way back down after the forward run')
  assert.equal(rampValue({...base, loop: 'pingpong'}, 3.5), 2.5, 'ping-pong: returning, u = 0.25')
})

test('the rate-0 lane holds at its phase, and the drift guard keeps the nativeBridge wave names the panel depends on', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const lane = {...lanesOf(journey)[0], wave: 'sine', rate: 0, phase: 0.25, min: 0, max: 1, type: 'lfo'}
  assert.match(laneCurve(lane).note, /holds the lane at its phase value/)
  assert.match(nativeBridgeSource, /steps:'randomStep',smooth:'smoothRandom'/, 'steps and smooth are the engine random waves')
  assert.match(nativeBridgeSource, /loop:l\.loop==='restart'\?'loop'/, 'the engine restart is the lane loop')
})

// ---- Handles -----------------------------------------------------------------------

test('handles map a field to a point and back to the same value, clamped to the admitted range', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const hard = {hardMin: 0, hardMax: 10}
  const lane = {...lanesOf(journey)[0], min: 2, max: 8, phase: 0.5, delay: 1, duration: 2, type: 'lfo', wave: 'sine'}
  const frame = handleFrame(lane, hard)
  const at = valueFraction(8, hard)
  assert.equal(at, 0.2, 'the top of the plot is the hard maximum')
  assert.equal(handleValue('max', {x: 0.9, y: at}, lane, frame), 8)
  assert.equal(handleValue('min', {x: 0.9, y: 1}, lane, frame), 0, 'below the plot clamps to the hard minimum')
  assert.equal(handleValue('max', {x: 0.9, y: -1}, lane, frame), 10, 'above the plot clamps to the hard maximum')
  assert.equal(handleValue('phase', {x: 1.4, y: 0.1}, lane, frame), 1, 'phase clamps to one cycle')
  assert.deepEqual(handlePosition(lane, 'phase', frame), {x: 0.5, y: 0.12})
  const ramp = {...lane, type: 'ramp', loop: 'once', wave: 'sine', delay: 1, duration: 2}
  const rampFrame = handleFrame(ramp, hard)
  assert.equal(rampFrame.xMax, 3)
  assert.equal(handleValue('delay', {x: 0.99, y: 0.9}, ramp, rampFrame), 2.97, 'delay is clamped to the window')
  assert.equal(handleValue('duration', {x: 0, y: 0.9}, ramp, rampFrame), 0.01, 'duration never reaches zero')
  assert.equal(handleValue('delay', {x: 1, y: 0.9}, {...ramp, delay: 0}, handleFrame({...ramp, delay: 0}, hard)), 2, 'delay reaches the far edge of a two-second window')
})

test('arrow steps move one admitted increment, Shift a coarse one, and never leave the range', () => {
  const hard = {hardMin: 0, hardMax: 10}
  assert.equal(handleStep('phase', 0.5, 1, false, hard), 0.51)
  assert.equal(handleStep('phase', 0.5, -1, true, hard), 0.4)
  assert.equal(handleStep('phase', 1, 1, false, hard), 1, 'phase stops at 1')
  assert.equal(handleStep('delay', 9.95, 1, false, hard), 10)
  assert.equal(handleStep('duration', 0.05, -1, false, hard), 0.01)
  assert.equal(handleStep('min', 5, 1, false, hard), 5.05, 'min steps by a two-hundredth of the hard span')
  assert.equal(handleStep('max', 9.99, 1, true, hard), 10, 'the coarse step is clamped at the hard maximum')
  assert.equal(roundTo(0.1234567, 0.01), 0.12)
})

test('an exact value is admitted only inside its range, and the bounds text names it', () => {
  assert.deepEqual(parseLaneNumber('0.5', {min: 0, max: 2}, 'Rate · Hz'), {value: 0.5, problem: null})
  assert.equal(parseLaneNumber('', {min: 0, max: 2}, 'Rate · Hz').problem, 'Rate · Hz must be a number from 0 to 2')
  assert.equal(parseLaneNumber('2.5', {min: 0, max: 2}, 'Rate · Hz').problem, 'Rate · Hz must be from 0 to 2')
  assert.deepEqual(laneFieldBounds('phase', {hardMin: -5, hardMax: 5}), {min: 0, max: 1})
  assert.deepEqual(laneFieldBounds('min', {hardMin: -5, hardMax: 5}), {min: -5, max: 5}, 'min and max take the target hard range')
})

// ---- Change builders and the boundary --------------------------------------------

test('every control builds one exact change the boundary admits, and the lane set is the only write it sends', () => {
  const journey = groupedJourney()
  const [a, b, c, d] = ids(journey)
  const shapes = [
    addLaneChange('field.gravityX'), addLaneChange('field.speed', a),
    set(a, {min: 1, max: 2}), set(b, {blend: 'add'}), set(a, {enabled: false}),
    linkLaneChange(b, null), linkLaneChange(b, c), removeLaneChange(b, 'lane'), removeLaneChange(b, 'group-target'),
    orderLanesChange([d, c, b, a]),
  ]
  assert.deepEqual(shapes[0], {kind: 'automation-add', target: 'field.gravityX'}, 'no group key when the lane is independent')
  assert.deepEqual(shapes[1], {kind: 'automation-add', target: 'field.speed', group_id: a})
  assert.deepEqual(shapes[3], {kind: 'automation-set', lane_id: b, values: {blend: 'add'}})
  assert.deepEqual(shapes[6], {kind: 'automation-link', lane_id: b, leader_id: c})
  assert.deepEqual(shapes[7], {kind: 'automation-remove', lane_id: b, scope: 'lane'})
  assert.deepEqual(shapes[9], {kind: 'automation-order', lane_ids: [d, c, b, a]})
  for (const shape of shapes) assert.doesNotThrow(() => validateNativeAutomationChange(shape), `${shape.kind} is admitted`)
  assert.equal(lanesOf(apply(journey, [shapes[0]])).length, 5, 'an add is one new lane')
})

test('value changes carry only the fields that differ, and nothing when none differ', () => {
  const journey = groupedJourney()
  const lane = lanesOf(journey)[0]
  assert.equal(laneValuesChange(lane, {min: lane.min}), null, 'an unchanged value sends nothing')
  assert.deepEqual(laneValuesChange(lane, {min: lane.min, max: lane.max + 1, blend: lane.blend}),
    {kind: 'automation-set', lane_id: lane.id, values: {max: lane.max + 1}})
  assert.equal(laneValuesChange(lane, {enabled: !lane.enabled}).values.enabled, !lane.enabled)
})

test('follower refusals: the boundary refuses the group leader fields on a follower, and admits its own range, blend and enabled', () => {
  const journey = groupedJourney()
  const [, b] = ids(journey)
  assert.deepEqual(INHERITED_LANE_FIELDS, ['type', 'wave', 'rate', 'phase', 'duration', 'delay', 'loop', 'easing'])
  for (const field of INHERITED_LANE_FIELDS) {
    const values = {[field]: field === 'type' ? 'ramp' : field === 'wave' ? 'sine' : field === 'loop' ? 'once' : field === 'easing' ? 'linear' : field === 'duration' ? 1 : 0}
    assert.throws(() => apply(journey, [set(b, values)]), /belongs to this group's leader/, `${field} is the leader's on a follower`)
  }
  const follower = laneOf(journey, b)
  assert.doesNotThrow(() => apply(journey, [set(b, {min: follower.min, max: follower.max, blend: 'multiply', enabled: false})]))
})

test('an end-to-end sequence of picker, group, range, order and removal lands in the boundary Journey', () => {
  let journey = apply(model.blankJourney(), [add('field.dispersion')])
  const [a] = ids(journey)
  journey = apply(journey, [add('field.speed', a)])
  assert.equal(laneRole(lanesOf(journey), laneOf(journey, ids(journey)[1])), 'follower')
  const [, b] = ids(journey)
  assert.throws(() => apply(journey, [linkLaneChange(a, b)]), /Link to a group leader/, 'a led group cannot join another group')
  const ordered = apply(journey, [orderLanesChange([b, a])])
  assert.deepEqual(ids(ordered), [b, a])
  assert.equal(moveLaneIds(ids(ordered), b, -1), null, 'the first lane cannot move up')
  assert.throws(() => apply(journey, [orderLanesChange([a])]), /every automation exactly once/, 'a partial order is refused')
  const removed = apply(ordered, [removeLaneChange(b, 'group-target')])
  assert.deepEqual(ids(removed), [a], 'a follower leaves its group and the leader stays')
  assert.equal(laneRole(lanesOf(removed), laneOf(removed, a)), 'independent')
})

// ---- Groups, labels, roles and the picker ------------------------------------------

test('order arrows and drops build full permutations: ends and no-ops are null, and the boundary admits the result', () => {
  const three = ['a', 'b', 'c']
  assert.deepEqual(moveLaneIds(three, 'b', -1), ['b', 'a', 'c'])
  assert.deepEqual(moveLaneIds(three, 'b', 1), ['a', 'c', 'b'])
  assert.equal(moveLaneIds(three, 'a', -1), null, 'the first lane cannot move up')
  assert.equal(moveLaneIds(three, 'c', 1), null, 'the last lane cannot move down')
  assert.deepEqual(dragLaneIds(three, 'a', 'c'), ['b', 'c', 'a'], 'a dropped on c lands at its index')
  assert.deepEqual(dragLaneIds(three, 'c', 'a'), ['c', 'a', 'b'])
  assert.equal(dragLaneIds(three, 'b', 'b'), null)
  assert.equal(dragLaneIds(three, 'x', 'a'), null)
  const journey = groupedJourney()
  const [a, b, c, d] = ids(journey)
  assert.deepEqual(ids(apply(journey, [orderLanesChange(dragLaneIds([a, b, c, d], a, c))])), [b, c, a, d])
  assert.deepEqual(ids(apply(journey, [orderLanesChange(moveLaneIds([a, b, c, d], d, -1))])), [a, b, d, c])
})

test('lanes are grouped by leader, followers nested, and groups follow engine order', () => {
  const journey = groupedJourney()
  const [a, b, c, d] = ids(journey)
  const {groups, problem} = laneGroups(lanesOf(journey))
  assert.equal(problem, null)
  assert.deepEqual(groups.map(group => group.leader.id), [a, c])
  assert.deepEqual(groups.map(group => group.followers.map(lane => lane.id)), [[b], [d]])
  assert.deepEqual([laneRole(lanesOf(journey), laneOf(journey, a)), laneRole(lanesOf(journey), laneOf(journey, b))], ['leader', 'follower'])
  // A group sits where its earliest lane sits: with C and D moved ahead of A and B, the C group is first.
  const moved = apply(journey, [orderLanesChange([c, a, d, b])])
  assert.deepEqual(laneGroups(lanesOf(moved)).groups.map(group => group.leader.id), [c, a])
  assert.deepEqual(laneGroups(lanesOf(moved)).groups.map(group => group.followers.map(lane => lane.id)), [[d], [b]])
})

test('a link the lane list cannot resolve is named, not guessed', () => {
  const broken = [{id: 'a', target: 'field.dispersion'}, {id: 'x', syncWith: 'missing', target: 'field.speed'}]
  const result = laneGroups(broken)
  assert.deepEqual(result.groups, [])
  assert.match(result.problem, /cannot resolve/)
})

test('target labels are the binding label or the entity name, never the raw path', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const label = targetLabel(journey.scenes[0], 'field.dispersion')
  assert.equal(label.label, NATIVE_BINDINGS.find(binding => binding.key === 'dispersion').label)
  assert.notEqual(label.label, 'field.dispersion')
  assert.equal(label.unit, NATIVE_BINDINGS.find(binding => binding.key === 'dispersion').unit ?? null)
  assert.equal(targetLabel(journey.scenes[0], 'field.nope').label, 'Target no longer in this Scene')
  const entities = model.blankJourney()
  entities.scenes[0].entities = structuredClone(model.chakraEntities())
  const entity = entities.scenes[0].entities[0]
  const target = `entity:${encodeURIComponent(entity.id)}:size.x`
  const entityLabel = targetLabel(entities.scenes[0], target).label
  const entityName = entity.name?.trim() || 'Entity 1'
  assert.ok(entityLabel.includes(entityName), 'the entity name leads the label')
  assert.ok(!entityLabel.includes('entity:'), 'the raw target is not the label')
})

test('the picker lists unautomated field targets, the selected object only, and filters by search', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const lanes = lanesOf(journey)
  const all = admittedTargets(journey.scenes[0], lanes, null, '')
  assert.ok(!all.field.some(item => item.target === 'field.dispersion'), 'an automated parameter is not offered again')
  assert.deepEqual(all.entity, [], 'no object is selected, so no entity parameters')
  const filtered = admittedTargets(journey.scenes[0], lanes, null, 'speed')
  assert.ok(filtered.field.length >= 1 && filtered.field.every(item => `${item.label} ${item.detail}`.toLowerCase().includes('speed')))
  const entities = model.blankJourney()
  entities.scenes[0].entities = structuredClone(model.chakraEntities())
  const id = entities.scenes[0].entities[0].id
  assert.ok(admittedTargets(entities.scenes[0], [], id, '').entity.every(item => item.target.startsWith(`entity:${encodeURIComponent(id)}:`)))
  assert.equal(addLaneProblem(Array.from({length: NATIVE_AUTOMATION_LANE_LIMIT}, (_, index) => ({id: `l${index}`}))) !== null, true)
  assert.equal(addLaneProblem([]), null)
})

test('the follower disclosure and the leader order agree with the group shape the engine applies', () => {
  const journey = groupedJourney()
  const [, b] = ids(journey)
  const follower = laneOf(journey, b)
  const leader = lanesOf(journey)[0]
  const shape = effectiveLane(lanesOf(journey), follower)
  assert.equal(shape.wave, leader.wave)
  assert.equal(shape.type, leader.type)
  assert.equal(shape.min, follower.min, 'the follower keeps its own range')
})

// ---- The panel, rendered -------------------------------------------------------------

test('the panel renders the lane list, the selected lane, the monitor disclosure and no fire or takeover control', () => {
  const journey = groupedJourney()
  const {markup, sent} = render(readingOf(journey))
  assert.deepEqual(sent, [], 'rendering sends nothing')
  assert.match(markup, /aria-label="Automation"/)
  assert.match(markup, />Lanes</)
  assert.match(markup, />Selected lane</)
  assert.match(markup, />Monitor</)
  assert.match(markup, /live output not in the reading/i, 'the monitor states that live output is not in the reading')
  assert.match(markup, /4 \/ 64|4 \/ 64/, 'the lane count is shown against the limit')
  for (const label of ['Sync with leader', 'Source', 'Blend', 'Low', 'High']) assert.ok(tagFor(markup, label), `${label} is named`)
  const buttons = [...markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(match => match[1])
  for (const text of buttons) assert.doesNotMatch(text, /fire|restart|take manual|takeover|delete group/i, `no fire or takeover button: ${text}`)
  assert.doesNotMatch(markup, /aria-label="[^"]*(Fire|Restart group|Take manual|Delete group)/i)
  assert.match(markup, /Not built here: restart and manual takeover/)
})

test('the panel disables a follower\'s inherited fields and leaves its range, blend and enabled editable', () => {
  const journey = groupedJourney()
  const [a, b] = ids(journey)
  // Order B first: the default selection is the first lane, so the follower is the lane shown.
  const followerFirst = apply(journey, [orderLanesChange([b, a, ids(journey)[2], ids(journey)[3]])])
  const {markup} = render(readingOf(followerFirst))
  assert.match(markup, new RegExp(`Follows ${labelOf('dispersion')}\\.`), 'the follower says whose shape it takes')
  for (const label of ['Source', 'Wave']) assert.match(tagFor(markup, label), /disabled=""/, `${label} is disabled on a follower`)
  for (const label of ['Rate · Hz', 'Phase · cycles']) assert.match(tagFor(markup, label), /disabled=""/, `${label} is disabled on a follower`)
  for (const label of ['Low', 'High']) assert.doesNotMatch(tagFor(markup, label), /disabled=""/, `${label} stays editable`)
  assert.doesNotMatch(tagFor(markup, 'Blend'), /disabled=""/)
  assert.doesNotMatch(tagFor(markup, 'Sync with leader'), /disabled=""/, 'a follower can be made independent')
  assert.match(markup, /aria-label="Remove [^"]* from its group"/)
})

test('the leader keeps its shape controls and cannot join another group while leading one', () => {
  const journey = groupedJourney()
  const {markup} = render(readingOf(journey))
  assert.doesNotMatch(tagFor(markup, 'Source'), /disabled=""/, 'a leader edits its own shape')
  assert.match(tagFor(markup, 'Sync with leader'), /disabled=""/, 'a leader of targets cannot join another group')
  assert.match(markup, /This lane leads its group/)
  assert.match(markup, /Remove this target/)
})

test('the empty Scene names its state and offers the first lane', () => {
  const {markup} = render(readingOf(model.blankJourney()))
  assert.match(markup, /No automation lanes in this Scene/)
  assert.match(markup, />\+ Add lane</)
  assert.match(markup, /0 \/ 64/)
})

test('a pending standing or a disabled expression locks every control', () => {
  const journey = groupedJourney()
  const pending = render(readingOf(journey, {standing: {dirty: false, pending: true, notice: null}})).markup
  assert.match(tagFor(pending, 'Source'), /disabled=""/)
  assert.match(pending.match(/<input[^>]*aria-label="Run group:[^"]*"[^>]*>/)[0], /disabled=""/)
  const disabled = render(readingOf(journey), {disabled: true}).markup
  assert.match(tagFor(disabled, 'Blend'), /disabled=""/)
})

test('the selected lane shows base, effective and automated values and names the live output as absent', () => {
  const journey = apply(model.blankJourney(), [add('field.dispersion')])
  const reading = readingOf(journey, {observation: {effectiveValues: {'field.dispersion': 0.75}}})
  const {markup} = render(reading)
  assert.match(markup, /<dt>Base<\/dt><dd>[^<]+<\/dd>/)
  assert.match(markup, /<dt>Effective<\/dt><dd>0\.75/)
  assert.match(markup, /<dt>Automated<\/dt><dd>live output not in the reading<\/dd>/)
  const absent = render(readingOf(journey)).markup
  assert.match(absent, /<dt>Effective<\/dt><dd>not in the reading<\/dd>/)
})

test('a random-wave lane has no phase handle and a ramp has the delay and duration handles', () => {
  let journey = apply(model.blankJourney(), [add('field.dispersion')])
  journey = apply(journey, [set(lanesOf(journey)[0].id, {wave: 'steps'})])
  assert.doesNotMatch(render(readingOf(journey)).markup, /Phase · cycles · /)
  journey = apply(journey, [set(lanesOf(journey)[0].id, {wave: 'sine', type: 'ramp'})])
  const markup = render(readingOf(journey)).markup
  assert.match(markup, /aria-label="Delay · seconds · /)
  assert.match(markup, /aria-label="Duration · seconds · /)
  assert.doesNotMatch(markup, /aria-label="Phase · cycles · /)
})

test('the add picker is closed by default, so the lane list stays the first thing in the panel', () => {
  const {markup} = render(readingOf(groupedJourney()))
  assert.doesNotMatch(markup, /<h4 id="native-automation-picker-title">/, 'the picker opens only from + Add lane')
  assert.match(markup, /aria-label="Select /)
})

test('the render orders the lanes in engine order and nests each follower under its leader', () => {
  const journey = groupedJourney()
  const {markup} = render(readingOf(journey))
  const first = markup.indexOf(`aria-label="Select ${labelOf('dispersion')}"`)
  const second = markup.indexOf(`aria-label="Select ${labelOf('speed')}"`)
  const third = markup.indexOf(`aria-label="Select ${labelOf('recovery')}"`)
  assert.ok(first >= 0 && second > first && third > second, 'engine order is kept in the list')
  assert.match(markup, /class="native-automation-face-row is-nested"/)
})
