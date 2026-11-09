// O-I #747 round 895, the port ledger's tune-station (DLW build ruling 2026-11-08): the Resonance face draws the plate's stations as
// ticks under its tuning band, and a press on a tick tunes the plate there through the owner's one change, `resonance-station`
// (expressions-boundary nativeResonanceStation.ts: the app's "Tune frequency", resolved against the engine's own stations). The binding
// reads which station the drive stands at; with no stations reported, the tick has nothing to press and says why. The loader and the
// reading fixture are field-design-bindings.test.mjs's; the stations are the engine's, as the frame announced them
// (fixtures/field-announcements-2026-10-21.json).
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

const {readFileSync} = await import('node:fs')
const STATIONS = JSON.parse(readFileSync(new URL('./fixtures/field-announcements-2026-10-21.json', import.meta.url), 'utf8')).stations
const freq = nativeKey('cymatics.frequencyHz')
const tuned = (hz = 400, stations = STATIONS) => ({...reading({params: {[freq]: hz}}), observation: {fieldPaused: false, ...(stations ? {stations} : {})}})

test('a press on a station sends the owner\'s one station tune, on the reading\'s basis; the binding reads the station the drive stands at', async () => {
  const r = tuned(400), sent = []
  const device = {...model.expressionsFieldDevice(r, 'resonance', null), submit: async () => {}}
  const send = async (edits, rows, basis) => { sent.push({edits, basis}); return {ok: true} }
  const binding = fieldBinding.fieldDesignBinding('resonance', device, r, send)
  assert.equal(binding.values['station.tune'], 2, 'the drive stands at the engine\'s station 3 (400 Hz)')
  assert.equal(binding.writes('station.tune'), true, 'a station is the owner\'s to tune to')
  await binding.write([{key: 'station.tune', value: 5}])
  assert.deepEqual(sent, [{edits: [{kind: 'resonance-station', station_index: 5}], basis: r.basis}])
  await assert.rejects(binding.write([{key: 'station.tune', value: 1.5}]), /station by its number/)
  const off = tuned(500), between = fieldBinding.fieldDesignBinding('resonance', {...model.expressionsFieldDevice(off, 'resonance', null), submit: async () => {}}, off, send)
  assert.equal(between.values['station.tune'], undefined, 'between stations the drive stands at none')
})

test('with no stations reported there is nothing to tune to, and the tick says why', () => {
  const r = tuned(400, null)
  const device = {...model.expressionsFieldDevice(r, 'resonance', null), submit: async () => {}}
  const binding = fieldBinding.fieldDesignBinding('resonance', device, r, async () => ({ok: true}))
  assert.equal(binding.writes('station.tune'), false)
  assert.match(binding.standing['station.tune'].disabled, /no stations/)
})

/** The view's elements, function components drawn (a component that needs a renderer is left as it stands). */
function expand(node, out = []) {
  if (Array.isArray(node)) { for (const child of node) expand(child, out); return out }
  if (!node || typeof node !== 'object' || !node.props) return out
  if (typeof node.type === 'function') { try { return expand(node.type(node.props), out) } catch { return out } }
  out.push(node)
  expand(node.props.children, out)
  return out
}

test('the Resonance face draws each station as a tick to press, and a press asks the owner to tune there', async () => {
  const design = await designOf('resonance')
  const r = tuned(400), device = {...model.expressionsFieldDevice(r, 'resonance', null), submit: async () => {}}
  const binding = fieldBinding.fieldDesignBinding('resonance', device, r, async () => ({ok: true}))
  const markup = renderToStaticMarkup(h(HostedDevice, {designed: design, binding, view: 'whole', nav: {}}))
  for (const station of STATIONS) assert.ok(markup.includes(`aria-label="Tune to ${station.name}, ${Math.round(station.frequencyHz)} Hz"`), station.name)
  assert.match(markup, /aria-pressed="true"[^>]*aria-label="Tune to Mode 1:3, 400 Hz"|aria-label="Tune to Mode 1:3, 400 Hz"[^>]*aria-pressed="true"/, 'the station the drive stands at reads pressed')
  const set = []
  const p = {v: binding.values, standing: binding.standing, set: (key, value) => set.push([key, value]), nav: {}, page: 'tuning', setPage: () => {}, frame: undefined}
  const ticks = expand(design.full(p)).filter(el => typeof el.props['aria-label'] === 'string' && el.props['aria-label'].startsWith('Tune to'))
  assert.equal(ticks.length, STATIONS.length)
  ticks[4].props.onClick()
  ticks[1].props.onKeyDown({key: 'Enter', preventDefault: () => {}})
  assert.deepEqual(set, [['station.tune', 4], ['station.tune', 1]])
  // Held: the work is busy (no submit), so the ticks are drawn and say why they do not press.
  const held = fieldBinding.fieldDesignBinding('resonance', model.expressionsFieldDevice(r, 'resonance', null), r, null)
  const still = renderToStaticMarkup(h(HostedDevice, {designed: design, binding: held, view: 'whole', nav: {}}))
  assert.match(still, /aria-label="Tune to Mode 1:3, 400 Hz"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*aria-label="Tune to Mode 1:3, 400 Hz"/)
})
