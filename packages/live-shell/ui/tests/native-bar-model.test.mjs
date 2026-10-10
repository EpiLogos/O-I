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
const {STAGE_TOOL_LABELS} = stage

const SCENE = 'expression:whole:scene:main'
/** A Scene carrying only the fields the bar reads. */
const scene = (overrides = {}) => ({scene_ref: SCENE, field: {params: {timeScale: 1.25}}, engine: {pointerMode: 'attract'}, automation: [], ...overrides})
/** A minimal NativeEditorReading: the bar reads the Scene and the observation, the rest is inert. */
const reading = (sceneValue = scene(), observation = undefined) => ({
  basis: {expression_ref: 'expression:whole', revision: 1, scene_ref: SCENE, authored_revision: 1},
  scene: sceneValue, observation, entityOccurrences: {}, chosenControls: {available: true, entries: [], controls: []},
  devices: [], selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
  standing: {dirty: false, pending: false, notice: null},
})
// Same ready hosted state as native-stage-commands.test.mjs, with the stage readings the bar reads added.
const READY_STATE = {hostMode: 'expressions', sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}
const stub = async () => ({ok: true})
const attr = (tag, name) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1]
const buttonsOf = markup => markup.match(/<button[^>]*>/g) ?? []

test('the tool rail lists the five tools in order, labelled from the stage vocabulary, pressed from the frame', () => {
  const rail = bar.barToolRail({stage: {tool: 'pin'}})
  assert.deepEqual(rail.map(item => item.tool), ['select', 'interact', 'pin', 'text', 'formation'])
  assert.deepEqual(rail.map(item => item.label), ['Select', 'Interact', 'Pin', 'Text', 'Formation'])
  assert.deepEqual(rail.map(item => item.label), ['select', 'interact', 'pin', 'text', 'formation'].map(tool => STAGE_TOOL_LABELS[tool]))
  assert.deepEqual(rail.map(item => item.pressed), [false, false, true, false, false])
  assert.equal(rail.filter(item => item.pressed === true).length, 1)
  assert.deepEqual(bar.barToolRail(null).map(item => item.pressed), [undefined, undefined, undefined, undefined, undefined])
  assert.deepEqual(bar.barToolRail({hostMode: 'expressions'}).map(item => item.pressed), [undefined, undefined, undefined, undefined, undefined])
  assert.deepEqual(bar.barToolRail({stage: {tool: 'orbit'}}).map(item => item.pressed), [false, false, false, false, false])
})

test('barRepeatPins is visible only while Pin is the tool, and its pressed state mirrors stage.repeatPins', () => {
  assert.deepEqual(bar.barRepeatPins({stage: {tool: 'pin', repeatPins: true}}), {visible: true, pressed: true})
  assert.deepEqual(bar.barRepeatPins({stage: {tool: 'pin', repeatPins: false}}), {visible: true, pressed: false})
  assert.deepEqual(bar.barRepeatPins({stage: {tool: 'pin'}}), {visible: true, pressed: undefined})
  assert.deepEqual(bar.barRepeatPins({stage: {tool: 'select', repeatPins: true}}), {visible: false, pressed: true})
  assert.deepEqual(bar.barRepeatPins(null), {visible: false, pressed: undefined})
})

test('barPointer is null outside Interact, and inside it reports mode, click and scope with the option lists', () => {
  const interact = {stage: {tool: 'interact'}}
  assert.equal(bar.barPointer(reading(), {stage: {tool: 'pin'}}), null)
  assert.equal(bar.barPointer(reading(), null), null)
  assert.equal(bar.barPointer(null, interact), null)
  const plain = bar.barPointer(reading(scene({engine: {pointerMode: 'repel'}})), interact)
  assert.deepEqual([plain.mode, plain.click, plain.scope], ['repel', 'pulse', 'global'])
  const local = bar.barPointer(reading(scene({engine: {pointerMode: 'vortex', pointerClick: 'off'}, pointerScope: 'local'})), interact)
  assert.deepEqual([local.mode, local.click, local.scope], ['vortex', 'off', 'local'])
  assert.equal(bar.barPointer(reading(scene({engine: {pointerMode: 'attract'}, pointerScope: 'elsewhere'})), interact).scope, 'global')
  assert.deepEqual(plain.modes, ['attract', 'repel', 'vortex'])
  assert.deepEqual(plain.clicks, ['pulse', 'implode', 'vortex', 'shove', 'off'])
  assert.deepEqual(plain.scopes, ['global', 'local'])
})

test('barEngineLight: recording outranks held, held outranks running, and no playback reads unknown', () => {
  const light = (state, playback) => bar.barEngineLight(state, playback)
  assert.deepEqual([light({propertyRecording: true}, {field_paused: false}).kind, light({propertyRecording: true}, {field_paused: false}).label], ['recording', 'Recording'])
  assert.equal(light({recording: true}, {field_paused: false}).kind, 'recording')
  assert.equal(light({recording: true}, {field_paused: true}).kind, 'recording')
  assert.equal(light({propertyRecording: true}, {field_paused: true}).kind, 'recording')
  assert.deepEqual([light({}, null).kind, light({}, null).label], ['unknown', 'Engine'])
  assert.equal(light({}, undefined).kind, 'unknown')
  assert.deepEqual([light({}, {field_paused: true}).kind, light({}, {field_paused: true}).label], ['held', 'Held'])
  assert.deepEqual([light(null, {field_paused: false}).kind, light(null, {field_paused: false}).label], ['running', 'Running'])
})

test('barParameter reads the registry row for fluid.timeScale, keeps base and effective apart, and refuses unknown paths', () => {
  const row = NATIVE_BINDINGS.find(item => item.path === 'fluid.timeScale')
  assert.ok(row, 'the registry carries fluid.timeScale')
  const authored = reading(scene({field: {params: {timeScale: 1.25}}}), {effectiveValues: {'field.timeScale': 0.8}})
  const p = bar.barParameter(authored, 'fluid.timeScale')
  assert.equal(p.path, 'fluid.timeScale')
  assert.equal(p.key, row.key)
  assert.equal(p.key, 'timeScale')
  assert.equal(p.target, 'field.timeScale')
  assert.equal(p.label, row.label)
  assert.equal(p.label, 'Time Scale')
  assert.equal(p.unit, row.unit ?? '')
  assert.deepEqual([p.min, p.max, p.hardMin, p.hardMax, p.step], [row.min, row.max, row.hardMin, row.hardMax, row.step])
  assert.equal(p.base, baseValue(authored.scene, row.key))
  assert.equal(p.base, 1.25)
  // Effective is shown only through an enabled lane on the target with a finite observation.
  assert.deepEqual([p.automated, p.effective], [false, undefined])
  const lane = {enabled: true, target: 'field.timeScale'}
  const driven = bar.barParameter(reading(scene({automation: [lane]}), {effectiveValues: {'field.timeScale': 0.8}}), 'fluid.timeScale')
  assert.deepEqual([driven.automated, driven.effective], [true, 0.8])
  const disabled = bar.barParameter(reading(scene({automation: [{...lane, enabled: false}]}), {effectiveValues: {'field.timeScale': 0.8}}), 'fluid.timeScale')
  assert.deepEqual([disabled.automated, disabled.effective], [false, undefined])
  const otherTarget = bar.barParameter(reading(scene({automation: [{enabled: true, target: 'field.gravityX'}]}), {effectiveValues: {'field.timeScale': 0.8}}), 'fluid.timeScale')
  assert.deepEqual([otherTarget.automated, otherTarget.effective], [false, undefined])
  const nonFinite = bar.barParameter(reading(scene({automation: [lane]}), {effectiveValues: {'field.timeScale': Number.NaN}}), 'fluid.timeScale')
  assert.deepEqual([nonFinite.automated, nonFinite.effective], [true, undefined])
  const unobserved = bar.barParameter(reading(scene({automation: [lane]})), 'fluid.timeScale')
  assert.deepEqual([unobserved.automated, unobserved.effective], [true, undefined])
  assert.equal(bar.barParameter(authored, 'fluid.noSuchPath'), null)
})

test('parseBarValue admits only finite numbers inside the hard bounds, inclusive at both ends', () => {
  const bounds = {hardMin: -10, hardMax: 100}
  assert.equal(bar.parseBarValue('', bounds), null)
  assert.equal(bar.parseBarValue('   ', bounds), null)
  assert.equal(bar.parseBarValue('abc', bounds), null)
  assert.equal(bar.parseBarValue('Infinity', bounds), null)
  assert.equal(bar.parseBarValue('-10.01', bounds), null)
  assert.equal(bar.parseBarValue('100.5', bounds), null)
  assert.equal(bar.parseBarValue('-10', bounds), -10)
  assert.equal(bar.parseBarValue('100', bounds), 100)
  assert.equal(bar.parseBarValue('1.5', bounds), 1.5)
})

test('scrubBarValue moves one soft range per drag span, a fine drag moves a tenth, and the result clamps to the hard bounds', () => {
  const param = {min: 0, max: 4, hardMin: -10, hardMax: 100}
  // One drag span is one soft range (4); the soft maximum does not clamp, only the hard bounds do.
  assert.equal(bar.scrubBarValue(1, bar.BAR_DRAG_SPAN, param), 5)
  assert.equal(bar.scrubBarValue(1, -bar.BAR_DRAG_SPAN, param), -3)
  assert.equal(Number(bar.scrubBarValue(1, bar.BAR_DRAG_SPAN, param, true).toFixed(6)), 1.4)
  assert.equal(bar.scrubBarValue(1, 100 * bar.BAR_DRAG_SPAN, param), 100)
  assert.equal(bar.scrubBarValue(1, -100 * bar.BAR_DRAG_SPAN, param), -10)
})

test('stepBarValue moves one registry step, ten with large, and stays inside the hard bounds', () => {
  const param = {step: 0.1, hardMin: 0, hardMax: 20}
  assert.equal(bar.stepBarValue(1, param, 1), 1.1)
  assert.equal(bar.stepBarValue(1, param, -1), 0.9)
  assert.equal(bar.stepBarValue(1, param, 1, true), 2)
  assert.equal(bar.stepBarValue(1, param, -1, true), 0)
  assert.equal(bar.stepBarValue(19.95, param, 1, true), 20)
  assert.equal(bar.stepBarValue(0.05, param, -1), 0)
  assert.equal(bar.stepBarValue(20, param, 1), 20)
})

test('formatBarValue decimals follow the registry step, from none for a whole step to four at most', () => {
  assert.equal(bar.formatBarValue(1.5, {step: 0.01}), '1.50')
  assert.equal(bar.formatBarValue(2, {step: 1}), '2')
  assert.equal(bar.formatBarValue(3, {step: 0.1}), '3.0')
  assert.equal(bar.formatBarValue(1.25, {step: 0.001}), '1.250')
  assert.equal(bar.formatBarValue(1, {step: 0.00001}), '1.0000')
})

test('BarTools renders the group and five tool buttons, all disabled with the mounted reason when no application runs', () => {
  const markup = renderToStaticMarkup(createElement(BarTools, {state: null, run: null}))
  assert.match(markup, /<div class="bar-tools" role="group" aria-label="Stage tool">/)
  const buttons = buttonsOf(markup)
  assert.deepEqual(buttons.map(tag => attr(tag, 'aria-label')), ['Select', 'Interact', 'Pin', 'Text', 'Formation'])
  for (const tag of buttons) {
    assert.ok(/ disabled=""/.test(tag), tag)
    assert.equal(attr(tag, 'title'), 'No Expressions application is mounted.')
    assert.equal(attr(tag, 'aria-pressed'), undefined)
  }
})

test('BarTools with a ready application reports the pressed tool and offers Repeat pins only while Pin is active', () => {
  const render = state => renderToStaticMarkup(createElement(BarTools, {state, run: stub}))
  const pin = buttonsOf(render({...READY_STATE, stage: {tool: 'pin', repeatPins: true}}))
  assert.deepEqual(pin.map(tag => attr(tag, 'aria-label')), ['Select', 'Interact', 'Pin', 'Text', 'Formation', 'Repeat pins'])
  assert.deepEqual(pin.map(tag => attr(tag, 'aria-pressed')), ['false', 'false', 'true', 'false', 'false', 'true'])
  assert.ok(pin.every(tag => !/ disabled=""/.test(tag)))
  assert.deepEqual(pin.slice(0, 5).map(tag => attr(tag, 'title')), ['Select', 'Interact', 'Pin', 'Text', 'Formation'])
  const select = buttonsOf(render({...READY_STATE, stage: {tool: 'select'}}))
  assert.deepEqual(select.map(tag => attr(tag, 'aria-label')), ['Select', 'Interact', 'Pin', 'Text', 'Formation'])
  assert.deepEqual(select.map(tag => attr(tag, 'aria-pressed')), ['true', 'false', 'false', 'false', 'false'])
})

test('BarPointerGroup renders nothing outside Interact; in Interact it shows three selects at their current values and applies nothing on render', () => {
  let applied = 0
  const apply = async () => {applied += 1; return {ok: true}}
  const render = (authored, state) => renderToStaticMarkup(createElement(BarPointerGroup, {reading: authored, state, apply, disabled: false}))
  assert.equal(render(reading(), {stage: {tool: 'pin'}}), '')
  assert.equal(render(null, {stage: {tool: 'interact'}}), '')
  const markup = render(reading(scene({engine: {pointerMode: 'vortex', pointerClick: 'shove'}, pointerScope: 'local'})), {stage: {tool: 'interact'}})
  assert.match(markup, /<div class="bar-pointer" role="group" aria-label="Pointer">/)
  assert.deepEqual([...markup.matchAll(/<select aria-label="([^"]+)"/g)].map(match => match[1]), ['Pointer force', 'Click effect', 'Pointer scope'])
  assert.deepEqual([...markup.matchAll(/<option value="([^"]*)"/g)].map(match => match[1]),
    ['attract', 'repel', 'vortex', 'pulse', 'implode', 'vortex', 'shove', 'off', 'global', 'local'])
  assert.deepEqual([...markup.matchAll(/<option value="([^"]*)"[^>]*selected=""/g)].map(match => match[1]), ['vortex', 'shove', 'local'])
  assert.equal(applied, 0, 'rendering never applies a change')
})

test('BarEngineLight labels the engine state and carries the matching data-kind', () => {
  const render = (state, playback) => renderToStaticMarkup(createElement(BarEngineLight, {state, playback}))
  const cases = [
    [{propertyRecording: true}, null, 'recording', 'Engine: Recording'],
    [null, {field_paused: true}, 'held', 'Engine: Held'],
    [null, {field_paused: false}, 'running', 'Engine: Running'],
  ]
  for (const [state, playback, kind, label] of cases) {
    const tag = render(state, playback).match(/<output[^>]*>/)[0]
    assert.equal(attr(tag, 'data-kind'), kind)
    assert.equal(attr(tag, 'aria-label'), label)
  }
})

test('BarValue shows the base beside its real label, the effective only when automated, and disables the input when asked', () => {
  const session = {live() {}, commit: async () => true, cancel() {}}
  const render = (parameter, disabled = false) => renderToStaticMarkup(createElement(BarValue, {parameter, session, disabled}))
  const driven = bar.barParameter(reading(scene({automation: [{enabled: true, target: 'field.timeScale'}]}), {effectiveValues: {'field.timeScale': 0.8}}), 'fluid.timeScale')
  const markup = render(driven)
  const input = markup.match(/<input[^>]*>/)[0]
  assert.equal(attr(input, 'aria-label'), 'Time Scale')
  assert.equal(attr(input, 'value'), '1.25')
  assert.equal(/ disabled=""/.test(input), false)
  assert.match(markup, /<label class="bar-value" data-automated="true"/)
  assert.match(markup, /<small class="bar-value-effective"[^>]*>→ 0\.80<\/small>/)
  const plainMarkup = render(bar.barParameter(reading(), 'fluid.timeScale'))
  assert.match(plainMarkup, /<label class="bar-value" data-automated="false"/)
  assert.equal(plainMarkup.includes('bar-value-effective'), false)
  const off = render(bar.barParameter(reading(), 'fluid.timeScale'), true)
  assert.ok(/ disabled=""/.test(off.match(/<input[^>]*>/)[0]))
})

test('arm + Play starts a take, Stop finishes it, and a blocked take never blocks Play', () => {
  const route = input => bar.barPlayRoute(input)
  assert.deepEqual(route({armed: false, recording: false, startReason: null}), {route: 'play', blockedReason: null}, 'unarmed Play is a plain Scene play')
  assert.deepEqual(route({armed: true, recording: false, startReason: null}), {route: 'take-start', blockedReason: null})
  assert.deepEqual(route({armed: true, recording: false, startReason: 'Choose a local numeric property in the toolbelt first.'}),
    {route: 'play', blockedReason: 'Choose a local numeric property in the toolbelt first.'}, 'the Scene plays and the reason is named')
  assert.equal(route({armed: false, recording: false, startReason: 'x'}).blockedReason, null, 'an unarmed bar says nothing about takes')
  assert.equal(route({armed: true, recording: true, startReason: 'x'}).route, 'take-stop')
  assert.equal(route({armed: false, recording: true, startReason: null}).route, 'take-stop', 'a running take stops whatever the arm shows')
})

test('Re-enable automation is hidden until the frame reports held parameters', () => {
  assert.deepEqual(bar.barResume(null), {visible: false, count: 0})
  assert.deepEqual(bar.barResume({hostMode: 'expressions', sceneCount: 1}), {visible: false, count: 0})
  assert.deepEqual(bar.barResume({hostMode: 'expressions', sceneCount: 1, automationHeld: 0}), {visible: false, count: 0})
  assert.deepEqual(bar.barResume({hostMode: 'expressions', sceneCount: 1, automationHeld: 3}), {visible: true, count: 3})
})
