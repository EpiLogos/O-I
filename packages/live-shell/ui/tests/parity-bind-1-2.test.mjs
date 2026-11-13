import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Lane BE: Expressions' devices on the field's owner. Physics's catalogue design draws on the engine's own readings and writes through
// its device's one submit (physicsBinding.ts); the Field's design is not bound (its picture is the module's own symbols, and the shell
// has no Field device); the editors the frame summons over its field get device homes (summonedEditors.tsx); the Studio's sections fit
// their band (studioDevices.tsx, studioBand.ts) and the glyph sequence stands as a page of Selected, with the work's one Save in the head.
// Loader as expressions-devices.test.mjs; the readings are fixtures shaped as the retained editor discloses them, not a native owner.
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
const physicsBinding = await import(src('components/devices/physicsBinding.ts'))
const {physics} = await import(src('inhabitants/catalogue/panels/physics.tsx'))
const fieldBinding = await import(src('components/devices/fieldDesignBinding.ts'))
const designDevices = await import(src('techne/devices/designDevices.ts'))
const host = await import(src('frame/devices/deviceHost.tsx'))
const {HostedDevice} = await import(src('frame/devices/deviceHost.tsx'))
const editors = await import(src('components/devices/summonedEditors.tsx'))
const {publishHostedChrome} = await import(src('projections/expressionsPaneHost.ts'))
const studioDevices = await import(src('components/expressions/studio/studioDevices.tsx'))
const {chromeRows} = await import(src('components/expressions/studio/studioBand.ts'))
const studio = await import(src('components/expressions/studio/ExpressionsStudio.tsx'))
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


test('PARITY bind-1: Colour keeps the chosen stop as the view\'s own', async () => {
  const r = reading()
  const device = {...model.expressionsFieldDevice(r, 'colour', null), submit: async () => {}}
  const binding = fieldBinding.fieldDesignBinding('colour', device, r, null)
  assert.equal(typeof binding.local?.stop, 'function', 'stop has a hand')
  assert.equal(host.setHosted(binding, 'stop', 2), false, 'handled at once, nothing sent to the owner')
  assert.equal(fieldBinding.fieldDesignBinding('colour', device, r, null).values.stop, 2, 'and drawn back from the hold')
  designDevices.hold(device.id, 'stop', undefined)
})
test('PARITY bind-2: Physics keeps its Reset ask as the view\'s own, and Reset still needs the confirmation', async () => {
  const r = reading()
  const device = {...model.expressionsFieldDevice(r, 'physics', null), submit: async () => {}}
  const pressed = []
  const binding = physicsBinding.physicsDesignBinding(device, r, a => pressed.push(a))
  assert.equal(typeof binding.local?.resetAsk, 'function')
  assert.equal(host.setHosted(binding, 'resetAsk', true), false)
  assert.equal(physicsBinding.physicsDesignBinding(device, r, () => {}).values.resetAsk, true, 'the ask stands')
  designDevices.hold(device.id, 'resetAsk', undefined)
  assert.equal('resetAsk' in physicsBinding.physicsDesignBinding(device, r, () => {}).values, false, 'Cancel puts it away')
  await assert.rejects(binding.write([{key: 'reset', value: true}]), /asks first/)
})
