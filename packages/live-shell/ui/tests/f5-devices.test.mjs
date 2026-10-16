import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// FOUNDATION F5: one device in three sizes from one declaration. Compact shows its picture and up to four controls, macros
// first; whole shows every row grouped; full is the same device at pane size. A light is a reading. Loader as
// live-browser-chain.test.mjs.
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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {compactRows, groupRows, lightOf} = await import('../src/frame/devices/deviceRuntime.ts')
const {DeviceView} = await import('../src/frame/devices/DeviceView.tsx')
const {torusDevice, TORUS_DEVICE_ID} = await import('../src/live/torusDevice.ts')

const row = (key, extra = {}) => ({family: 'f', deviceInstance: 'd', key, type: 'number', title: key, range: {min: 0, max: 1}, writePath: 'kernel:x', ...extra})
const face = {id: 'probe', title: 'Probe', icon: 'form', liveSemantic: 'device-audio-fx'}

test('compact shows the macros first, else the rows marked compact, else the first write rows — never more than four', () => {
  const plain = ['a', 'b', 'c', 'd', 'e'].map(key => row(key))
  assert.deepEqual(compactRows(plain).map(r => r.key), ['a', 'b', 'c', 'd'])
  assert.deepEqual(compactRows([...plain, row('m', {macro: {maps: [{key: 'a'}]}})]).map(r => r.key), ['m'])
  assert.deepEqual(compactRows([...plain, row('k', {compact: true})]).map(r => r.key), ['k'])
  assert.deepEqual(compactRows([row('r', {writePath: undefined})]), [], 'a reading is no compact control')
})

test('whole groups every row by its group, the ungrouped under the device\'s own name', () => {
  assert.deepEqual(groupRows([row('a', {group: 'Tone'}), row('b'), row('c', {group: 'Tone'})], 'Probe').map(g => [g.group, g.rows.map(r => r.key)]), [['Tone', ['a', 'c']], ['Probe', ['b']]])
})

test('a light is a reading: on or off only as the owner reports, dark when unknown', () => {
  assert.equal(lightOf({values: {}}), 'unknown')
  assert.equal(lightOf({enabledKey: 'on', values: {}}), 'unknown')
  assert.equal(lightOf({enabledKey: 'on', values: {on: true}}), 'on')
  assert.equal(lightOf({enabledKey: 'on', values: {on: false}}), 'off')
})

test('one device draws in all three sizes with the same settings, and a held value shows who holds it where its controls stand', () => {
  const device = {id: 'd', family: 'f', face, rows: [row('a', {group: 'Tone'}), row('b'), row('c', {writePath: undefined})], values: {a: 0.5, c: 'read'}, heldBy: {a: 'Mars'}}
  const sizes = ['compact', 'whole', 'full'].map(size => renderToStaticMarkup(React.createElement(DeviceView, {device, size, picture: React.createElement('i', {id: 'pic'})})))
  sizes.forEach((markup, index) => {
    assert.match(markup, new RegExp(`data-device-size="${['compact', 'whole', 'full'][index]}"`))
    assert.match(markup, /id="pic"/, 'the picture stands in every size')
    assert.match(markup, /data-device-light="unknown"/)
  })
  for (const markup of sizes.slice(0, 2)) assert.match(markup, /data-held-by="Mars"/, 'who holds the value shows wherever its control stands')
  assert.doesNotMatch(sizes[2], /data-param=/, 'full is the material: its controls stay in Device view (DLW §16.1)')
  assert.doesNotMatch(sizes[0], /class="dp-sec-label">Tone</, 'compact draws no groups')
  assert.match(sizes[1], /class="dp-sec-label">Tone</); assert.match(sizes[1], /class="dp-sec-label">Probe</)
})

test('the torus is a device of the runtime: its four macros are the owner\'s determinants, its light the owner\'s standing', () => {
  const absent = torusDevice(null)
  assert.equal(absent.id, TORUS_DEVICE_ID); assert.equal(absent.rows.filter(r => r.compact).length, 4); assert.equal(lightOf(absent), 'unknown')
  assert.ok(absent.rows.every(r => !r.writePath), 'no reading, no writes')
  const state = {ok: true, determinants: {lens: {lens12: 3, label: 'L1′'}, contextFrame: 2, harmonic: {selection: 'canonical-basis', index: 0}, m3: 'DNA'},
    value: {schema: 'ql.instrument-reading/v1', standing: 'following', identity: {event_ref: 'event:t'}}, parameters: null}
  const live = torusDevice(state)
  assert.equal(lightOf(live), 'on')
  assert.ok(live.rows.filter(r => r.compact).every(r => r.writePath === 'stage:instrument'), 'a following instrument takes edits through the stage channel')
  // A reading that carries no parameters reports none: no cadence and no scale to set, each says why.
  assert.deepEqual(live.rows.filter(r => !r.writePath).map(r => [r.key, r.disclosure]), [['cadence', 'No scene is open, so there is no cadence to set.'], ['scale', 'The owner states no scale.']])
  assert.equal(live.values.lens, 'L1′', 'the owner\'s label, not its code')
})

test('a control that drafts and commits in one handler (a toggle, a typed value) sends what it just drafted', async () => {
  const {useFaceDrafts} = await import('../src/inhabitants/sdk/controls.tsx')
  const sent = []
  let held
  const Probe = () => { held = useFaceDrafts(async changes => { sent.push(changes) }); return null }
  renderToStaticMarkup(React.createElement(Probe))
  held.setDraft('enabled', true)
  await held.commit()
  assert.deepEqual(sent, [[{key: 'enabled', value: true}]], 'the commit in the same handler sees the draft')
})

test('a refused change returns the control to the owner\'s value and keeps the owner\'s own words for the status bar', async () => {
  const host = await import('../src/frame/devices/deviceHost.tsx')
  const binding = {id: 'f5:refuse', values: {face: 'Ground'}, write: async () => { throw new Error('The Day is closed; open it to turn its face.') }}
  host.setDraft(binding.id, 'face', 'Learning')
  const reason = await host.flushDrafts(binding)
  assert.equal(reason, 'The Day is closed; open it to turn its face.', 'the owner\'s own words')
  const state = host.hostState(binding.id)
  assert.equal(host.hostedValues(state, binding.values).face, 'Ground', 'the control shows the owner\'s value again')
  assert.equal(host.hostedStanding(state, binding, ['face']).face.refused, 'The Day is closed; open it to turn its face.', 'and says why')
  host.resetHost(binding.id)
})
