import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// R5: every field family's catalogue design on the engine's own readings and writes (components/devices/fieldDesignBinding.ts, after
// Physics's physicsBinding.ts). Numbers in the binding's display units, settings by the owner's value, the switch under the family's
// toggle key, what the scene keeps (Colour's palette and paper, Focus's route) read from the scene and written as the editor's own
// changes, and every key with no owner disabled with its reason. Loader as expressions-design-bindings.test.mjs; the readings are
// fixtures shaped as the retained editor discloses them, not a native owner.
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
const model = await import(src('components/devices/expressionsDevice.ts'))
const fieldBinding = await import(src('components/devices/fieldDesignBinding.ts'))
const {HostedDevice} = await import(src('frame/devices/deviceHost.tsx'))
const designOf = async family => (await import(src(`inhabitants/catalogue/panels/expressions__${family}.tsx`))).design
const {NATIVE_BINDINGS} = await import('@epilogos/expressions-boundary/parameters')

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'horizontal', autoOscillate: true,
  pointerMode: 'attract', relationalEnabled: false, volumeEnabled: false}
const nativeKey = path => NATIVE_BINDINGS.find(row => row.path === path).key
function reading({params = {}, paused, entities = [], selection = []} = {}) {
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene: {name: 'Fixture', entities, engine: {...ENGINE}, composition: {focus: 'parallel', frequencyDriver: 'manual'}, morph: {law: 'theta', thetaOffset: 0, dwell: 0},
      automation: [], field: {background: '#ffffff', palette: ['#112233'], material: 'ink', params}},
    entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null},
    ...(paused === undefined ? {} : {observation: {fieldPaused: paused}}),
  }
}

const formation = (id, name, tint) => ({id, name, tint, kind: 'formation'})

test('every field family\'s design draws on its device in every view: the engine\'s rows, nothing drawn as NaN or undefined', async () => {
  for (const family of fieldBinding.FIELD_DESIGN_FAMILIES) {
    const design = await designOf(family)
    assert.ok(design, `${family}: the catalogue has its design`)
    const r = reading({entities: [formation('a', 'Root', '#aa3333'), formation('b', 'Heart', '#33aa66')]})
    const device = model.expressionsFieldDevice(r, family, null)
    assert.ok(device, `${family}: the runtime carries its device`)
    const binding = fieldBinding.fieldDesignBinding(family, device, r, null)
    assert.equal(binding.id, `expressions:${family}`, `${family}: the design's own key`)
    for (const view of ['folded', 'compact', 'whole', 'widget']) {
      const html = renderToStaticMarkup(h(HostedDevice, {designed: design, binding, view, nav: {}}))
      assert.doesNotMatch(html, />NaN<|>undefined</, `${family} ${view}: drawn from the readings`)
    }
  }
})

test('a number is the engine\'s path in the binding\'s units; the switch is the family\'s toggle; a setting is the owner\'s value', async () => {
  const path = model.expressionsFieldEntry('medium').paths.find(p => p === 'medium.pressure')
  assert.ok(path, 'Medium carries its pressure')
  const r = reading({params: {[nativeKey(path)]: 6}})
  const sent = []
  const device = {...model.expressionsFieldDevice(r, 'medium', null), submit: async changes => {sent.push(changes)}}
  const binding = fieldBinding.fieldDesignBinding('medium', device, r, null)
  const factor = NATIVE_BINDINGS.find(row => row.path === path).factor ?? 1
  assert.equal(binding.values['medium.pressure'], 6 * factor)
  assert.equal(fieldBinding.toggleKeyOf('medium'), 'mediumEnabled')
  assert.equal(binding.values.mediumEnabled, false, 'the switch reads the engine\'s own flag')
  assert.equal(binding.enabledKey, 'mediumEnabled', 'the design\'s light is the switch')
  await binding.write([{key: 'medium.pressure', value: 8 * factor}, {key: 'mediumEnabled', value: true}])
  assert.deepEqual(sent, [[{key: 'medium.pressure', value: 8}, {key: 'enabled', value: true}]], 'one submit, in the engine\'s units, the switch as the device\'s enabled row')
  await assert.rejects(binding.write([{key: 'medium.nothing', value: 1}]), /no parameter of the engine/)
  assert.ok(binding.writes('medium.pressure') && binding.writes('mediumEnabled'))
  assert.equal(binding.writes('medium.nothing'), false)
  const locked = fieldBinding.fieldDesignBinding('medium', model.expressionsFieldDevice(r, 'medium', null), r, null)
  assert.equal(locked.write, undefined, 'while the work is busy every value is a reading')
})

test('Colour reads its palette and paper from the scene and writes them as the editor\'s own changes', async () => {
  const r = reading()
  r.scene.field.palette = ['#112233', '#445566']
  const edits = []
  const send = async (changes, numeric, basis) => { edits.push({changes, basis}); return {ok: true} }
  const device = {...model.expressionsFieldDevice(r, 'colour', null), submit: async () => {}}
  const binding = fieldBinding.fieldDesignBinding('colour', device, r, send)
  assert.equal(binding.values.palette, JSON.stringify(['#112233', '#445566']))
  assert.equal(binding.values.background, '#ffffff')
  await binding.write([{key: 'palette', value: JSON.stringify(['#000000', '#ffffff', '#ff0000'])}, {key: 'background', value: '#101010'}])
  assert.deepEqual(edits[0].changes, [{kind: 'colour-palette', colors: ['#000000', '#ffffff', '#ff0000']}, {kind: 'colour-background', value: '#101010'}])
  assert.deepEqual(edits[0].basis, r.basis, 'on the reading\'s own basis')
  await assert.rejects(binding.write([{key: 'palette', value: JSON.stringify(['#000000'])}]), /two to eight/)
  await assert.rejects(fieldBinding.fieldDesignBinding('colour', device, r, null).write([{key: 'background', value: '#000000'}]), /No native Expression/)
})

test('Focus reads its route from the scene\'s formations; what no owner reports stands disabled with its reason', () => {
  const r = reading({entities: [formation('a', 'Root', '#aa3333'), {id: 'p', kind: 'pin'}, formation('b', 'Heart', '#33aa66')]})
  const binding = fieldBinding.fieldDesignBinding('focus', model.expressionsFieldDevice(r, 'focus', null), r, null)
  assert.deepEqual(JSON.parse(binding.values.route), [{id: 'a', name: 'Root', tint: '#aa3333'}, {id: 'b', name: 'Heart', tint: '#33aa66'}], 'formations only, in order')
  assert.match(binding.standing['focus.at'].disabled, /does not report/)
  assert.match(binding.standing.route.disabled, /no reorder/)
  const morph = fieldBinding.fieldDesignBinding('morph', model.expressionsFieldDevice(r, 'morph', null), r, null)
  assert.match(morph.standing['phase.theta'].disabled, /observation\.phases/)
  assert.equal(fieldBinding.fieldDesignValues('ink', model.expressionsFieldDevice(r, 'ink', null), null).reason, 'No native Expression is open: its field has no reading here.')
})

// W6: what the frame announces of the field and the live scene. REAL condition and the engine's stations:
// tests/fixtures/field-announcements-2026-10-21.json. The phases are two numbers the engine reports (FAKE values here: no engine runs).
test('Morph reads the engine\'s own phases and Resonance its stations from the observation, verbatim; Resonance\'s tattva is the live scene\'s M2 condition, by the map\'s name', async () => {
  const {readFileSync} = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/field-announcements-2026-10-21.json', import.meta.url), 'utf8'))
  const names = await import(src('inhabitants/ql/devices/qlCoordinateName.ts'))
  const {conditionReadingOf} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/instrumentCondition.ts')
  const r = {...reading(), observation: {fieldPaused: false, phases: {theta: 7.4, phi: 2.1}, stations: fixture.stations}}
  const morph = fieldBinding.fieldDesignBinding('morph', model.expressionsFieldDevice(r, 'morph', null), r, null)
  assert.deepEqual([morph.values['phase.theta'], morph.values['phase.phi']], [7.4, 2.1], 'the engine\'s accumulators, radians, as reported')
  assert.match(morph.standing['phase.theta'].disabled, /A reading/)
  const condition = conditionReadingOf({current: {m2: {condition: {source_path: fixture.source_path}}}})
  const name = names.readCoordinateName({outcome: {result: 'owner_route_reading', data: fixture.tattva_view}}, condition.tattva_ref)
  assert.deepEqual(name, {ok: true, name: 'Prithvi Tattva'}, 'the map\'s own name for #2-2-2-5-5')
  const device = model.expressionsFieldDevice(r, 'resonance', null)
  const resonance = fieldBinding.fieldDesignBinding('resonance', device, r, null, {condition, name})
  assert.deepEqual(JSON.parse(resonance.values.stations), fixture.stations, 'the engine\'s stations, verbatim')
  assert.deepEqual([resonance.values['tattva.name'], resonance.values['tattva.fibre']], ['Prithvi Tattva', 'earth'])
  assert.equal(resonance.standing['tattva.name'].disabled, names.TATTVA_READ)
  // M2's body constants are read from QL (ql-745-readings.test.mjs); unread here, the body source and its standing wait on them.
  assert.match(resonance.standing['body.source'].disabled, /Reading M2's body constants/, 'the body source keeps its reason')
  assert.match(resonance.standing['tattva.standing'].disabled, /Reading M2's body constants/)
  const design = await designOf('resonance')
  for (const view of ['compact', 'whole', 'full']) {
    const markup = renderToStaticMarkup(h(HostedDevice, {designed: design, binding: resonance, view, nav: {}}))
    assert.doesNotMatch(markup, /\bNaN\b|undefined|data-device-fault/, view)
  }
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: design, binding: resonance, view: 'whole', nav: {}}))
  assert.ok(whole.includes('Mode 1:1') || whole.includes('80'), 'the stations are drawn')
  // No announcement: each key keeps its reason.
  const bare = fieldBinding.fieldDesignBinding('resonance', model.expressionsFieldDevice(reading(), 'resonance', null), reading(), null)
  for (const key of ['stations', 'tattva.name', 'tattva.fibre']) assert.equal(bare.values[key], undefined, key)
  assert.equal(bare.standing['tattva.name'].disabled, names.NO_CONDITION)
  assert.match(bare.standing.stations.disabled, /reports no stations/)
  const pending = fieldBinding.fieldDesignBinding('resonance', device, r, null, {condition, name: {ok: false, reason: 'Reading the map\'s name for #2-2-2-5-5…', busy: true}})
  assert.equal(pending.values['tattva.name'], undefined, 'the name waits for the map')
  assert.equal(pending.values['tattva.fibre'], 'earth')
})

// O-I #747, manual §20.1 Rules: "A parameter shows what moves it. When you take hold of a value a lane holds, the hand-back light comes on.
// Press it to give the value back." A field device reads the scene's lanes and the values the frame announces it holds (automationHolds,
// each target with the value held on it): a value an enabled lane plays stands automated; moving it takes hold of it in the frame (stage live
// hold), never a document write; while it is held its row shows the held value, not the document's; and its hand-back light (the kit's
// Re-enable) gives that one value back (stage automation resume, naming its target), when the row shows the document's value again.
const laneOn = (id, target, enabled = true) => ({id, enabled, target, type: 'lfo', wave: 'sine', min: 0, max: 1, rate: 1, phase: 0,
  blend: 'replace', duration: 1, delay: 0, loop: 'loop', firedAt: null})

test('#747: a value a lane plays shows its lane; the hand takes hold of it in the frame, not the document; its hand-back light gives that value back', async () => {
  const views = await import(src('components/devices/ExpressionsDeviceView.tsx'))
  const pressure = 'field.' + nativeKey('medium.pressure'), coupling = 'field.' + nativeKey('medium.coupling')
  const factor = NATIVE_BINDINGS.find(row => row.path === 'medium.pressure').factor ?? 1
  const r = reading({params: {[nativeKey('medium.pressure')]: 6}})
  r.scene.automation = [laneOn('lane-1', pressure), laneOn('lane-2', coupling, false)]
  const sent = [], ran = []
  let answer = {ok: true}
  const run = async command => {ran.push(command); return answer}
  const device = {...model.expressionsFieldDevice(r, 'medium', null), submit: async changes => {sent.push(changes)}}
  const plain = views.fieldDesignBinding('medium', device, r, null)
  assert.equal(plain.standing?.['medium.pressure']?.automated, undefined, 'without the frame\'s lanes nothing is claimed')
  const binding = views.fieldDesignBinding('medium', device, r, null, {}, {run, holds: []})
  assert.equal(binding.standing['medium.pressure'].automated, true, 'an enabled lane plays it')
  assert.equal(binding.standing['medium.coupling']?.automated, undefined, 'a lane switched off plays nothing')
  assert.equal(binding.values['medium.pressure'], 6 * factor, 'unheld, the row shows the document\'s value')
  const design = await designOf('medium')
  assert.match(renderToStaticMarkup(h(HostedDevice, {designed: design, binding, view: 'whole', nav: {}})), /data-automated="on"/, 'the parameter shows its lane')
  await binding.write([{key: 'medium.pressure', value: 8 * factor}, {key: 'mediumEnabled', value: true}])
  assert.deepEqual(ran, [{command: 'live', action: 'hold', target: pressure, value: 8}], 'the hand takes hold in the frame, in the engine\'s units')
  assert.deepEqual(sent, [[{key: 'enabled', value: true}]], 'the held value writes no document; the rest goes as before')
  answer = {ok: false, error: 'No enabled automation drives this parameter, so there is nothing to hold.'}
  await assert.rejects(binding.write([{key: 'medium.pressure', value: 9 * factor}]), /nothing to hold/, 'a refused hold says the frame\'s words')
  assert.equal(sent.length, 1, 'and writes nothing')
  answer = {ok: true}; ran.length = 0
  // The frame announces the hold with its value: the row shows the value the field plays, while the document keeps 6.
  const held = views.fieldDesignBinding('medium', device, r, null, {}, {run, holds: [{target: pressure, value: 8}]})
  assert.equal(held.standing['medium.pressure'].automated, 'overridden', 'the hand-back light is on')
  assert.equal(held.values['medium.pressure'], 8 * factor, 'the held value stands on its row, not the document\'s')
  assert.equal(held.values['medium.coupling'], binding.values['medium.coupling'], 'a value not held shows the document\'s')
  const markup = renderToStaticMarkup(h(HostedDevice, {designed: design, binding: held, view: 'whole', nav: {}}))
  assert.match(markup, /data-automated="overridden"/)
  assert.match(markup, /Give Pressure back to its automation lane|back to its automation lane/, 'the light is a button')
  assert.match(markup, new RegExp(`aria-label="Pressure"[^>]*aria-valuenow="${8 * factor}"|aria-valuenow="${8 * factor}"[^>]*aria-label="Pressure"`), 'the control draws the held value')
  held.standing['medium.pressure'].onReenable()
  assert.deepEqual(ran, [{command: 'automation', action: 'resume', target: pressure}], 'pressing it gives that one value back')
  // Given back, the frame holds nothing: the row shows the document's value again, and the lane plays it.
  const back = views.fieldDesignBinding('medium', device, r, null, {}, {run, holds: []})
  assert.equal(back.values['medium.pressure'], 6 * factor, 'given back, the row shows the document\'s value again')
  assert.equal(back.standing['medium.pressure'].automated, true)
})

// Physics's design keys its values by its own names (physicsBinding.ts PHYSICS_KEYS: radius is fluid.vortexRadius, drawn in px, factor 400):
// its lanes, its holds and the held value stand on those names, in the design's units.
test('#747: Physics shows its lanes and its held values on its own keys, in its own units', async () => {
  const views = await import(src('components/devices/ExpressionsDeviceView.tsx'))
  const {PHYSICS_KEYS} = await import(src('components/devices/physicsBinding.ts'))
  const path = PHYSICS_KEYS.radius, row = NATIVE_BINDINGS.find(item => item.path === path), target = 'field.' + row.key
  assert.equal(row.factor, 400, 'the radius is authored in stage units and drawn in px')
  const p = reading({params: {[row.key]: 0.25}})
  p.scene.automation = [laneOn('lane-3', target)]
  const ran = [], sent = []
  const run = async command => {ran.push(command); return {ok: true}}
  const device = {...model.expressionsFieldDevice(p, 'physics', null), submit: async changes => {sent.push(changes)}}
  const lit = views.fieldDesignBinding('physics', device, p, null, {}, {run, holds: []})
  assert.equal(lit.standing.radius?.automated, true, 'the design\'s Radius shows its lane')
  assert.equal(lit.standing[path], undefined, 'nothing stands on a key the design does not draw')
  assert.equal(lit.values.radius, 0.25 * 400)
  await lit.write([{key: 'radius', value: 200}])
  assert.deepEqual(ran, [{command: 'live', action: 'hold', target, value: 0.5}], 'moving Radius takes hold of it in the frame, in stage units')
  assert.deepEqual(sent, [], 'and writes no document')
  const held = views.fieldDesignBinding('physics', device, p, null, {}, {run, holds: [{target, value: 0.5}]})
  assert.equal(held.standing.radius.automated, 'overridden')
  assert.equal(held.values.radius, 200, 'the held value stands on Radius, in px')
  const markup = renderToStaticMarkup(h(HostedDevice, {designed: (await import(src('inhabitants/catalogue/panels/physics.tsx'))).physics, binding: held, view: 'whole', nav: {}}))
  assert.match(markup, /data-automated="overridden"/, 'the Physics design lights the hand-back on Radius')
})
