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
  assert.match(morph.standing['phase.theta'].disabled, /accumulator/)
  assert.equal(fieldBinding.fieldDesignValues('ink', model.expressionsFieldDevice(r, 'ink', null), null).reason, 'No native Expression is open: its field has no reading here.')
})
