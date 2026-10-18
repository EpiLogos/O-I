import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// R5: Scale mapping and Exact-ratio tuning on their owners. Scale mapping (live__scale-mapping.tsx) draws on the Scale note device (its
// power and tie, noteDeviceHold.ts) and the transport's mode with the owner's catalogue (liveModeCatalogue.ts, ql.music-modes/v1):
// writes go to those owners, root before scale, and a scale the catalogue does not offer on the root is refused in words. Exact-ratio
// (live__exact-ratio.tsx) draws only what an owner states — the bases' generators — and names, for every tuning key, that nothing
// that sounds takes a tuning; its Readout and Error are the view's own hand. The catalogue rows are the owner's (live-note-devices).
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
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const h = React.createElement
const modes = await import('../src/live/modes.ts')
const noteDevices = await import('../src/live/noteDevices/noteDevices.ts')
const scale = await import('../src/live/designBindings/scaleMappingBinding.ts')
const exact = await import('../src/live/designBindings/exactRatioBinding.ts')
const chainView = await import('../src/live/noteDevices/NoteDeviceChain.tsx')
const {HostedDevice} = await import('../src/frame/devices/deviceHost.tsx')
const {designKey} = await import('../src/frame/devices/designs.ts')
const door = await import('../src/frame/devices/deviceDoor.ts')
const scaleDesign = (await import('../src/inhabitants/catalogue/panels/live__scale-mapping.tsx')).design
const exactDesign = (await import('../src/inhabitants/catalogue/panels/live__exact-ratio.tsx')).design

const provenance = symbol => ({operator: 'mode_tonic_instance', owner: 'ql-mef', revision: '1.0.0', source: {blob: 'b', path: 'docs/sources/ql-musical-derivation-v3.md', vendor_commit: 'c', version: '1.0.0'}, symbol})
const aeolian = {
  anchor_basis: 'chromatic', context_frame: 'CF6', key: "chromatic/L0'/aeolian", kind: 'lens-cf', label: "aeolian on L0', chromatic basis",
  lens: "L0'", mode: 'aeolian', pitches: [10, 0, 1, 3, 5, 6, 8], provenance: provenance('mode_tonic_landscape'),
  scale_beneath_tonic: 1, steps_semitones: [2, 1, 2, 2, 1, 2, 2], tonic: 10, tuning: null,
}
const maqam = {
  cents_from_root: [0, 200, 350, 500, 700, 850, 1000, 1200], family: 'maqam', family_ratio: {den: 22, num: 27}, key: 'maqam/09',
  kind: 'source', label: 'Maqam 9 (family 0, mode 0)', maqam_family: 0, mode_in_family: 0, pitches: null, planet_ruler: 0,
  provenance: {owner: 'ql-mef', ratio_symbol: 'M2_MAQAM_RATIOS', ratio_table: 'ratio', registry_revision: 'r1', revision: 'r1', source_symbol: 'M2_MAQAM_DESC', sources: [{path: 'vendor/epi-kernel/reference/src/m2.c', sha256: 'h'}], symbol: 'maqam_pitches', table: 't'},
  quarter_tone_steps: [4, 3, 3, 4, 3, 3, 4], quarter_tones_from_root: [0, 4, 7, 10, 14, 17, 20, 24], tuning: null, tuning_unit: 'quarter-tone',
}
const parsed = modes.parseQlMusicModes({
  schema: 'ql.music-modes/v1',
  bases: [
    {basis: 'chromatic', conjugate_axis_semitones: 1, generator_ratio: {den: 8, num: 9}, generator_semitones: 2},
    {basis: 'fifths', conjugate_axis_semitones: 6, generator_ratio: {den: 2, num: 3}, generator_semitones: 7},
  ],
  lens_cf: [aeolian], source_scales: [maqam],
  sources_absent: [{scale: 'shem', status: 'absent', reason: 'no pitch set is retained for Shem'}],
  provenance: {m2_registry_revision: 'r1', owner: 'ql-mef'},
})
assert.equal(parsed.ok, true, parsed.refusal)
const ready = {state: 'ready', catalogue: parsed.catalogue}
const device = (over = {}) => ({...noteDevices.newNoteDevice('scale', 'nd-1'), ...over})
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']

test('the Scale device wears the design\'s face; its values are the device\'s and the mode\'s, as the owners report them', () => {
  const plain = {id: 'note-device:nd-1', family: 'note device', face: {id: 'note-scale', title: 'Scale'}, rows: [], values: {}}
  const worn = scale.asScaleMappingDevice(plain)
  assert.equal(designKey(worn.family, worn.face.id), scaleDesign.id); assert.equal(worn.id, plain.id, 'its place on the door is unchanged')
  const values = scale.scaleMappingValues(device(), ready, {key: aeolian.key, root: 10})
  assert.equal(values.enabled, true); assert.equal(values.tie, 'Up')
  assert.equal(values['mode.root'], 10); assert.equal(values['mode.key'], aeolian.key)
  assert.deepEqual(JSON.parse(values['mode.lens']), [{key: aeolian.key, basis: 'chromatic', lens: "L0'", cf: 'CF6', mode: 'aeolian', pitches: [10, 0, 1, 3, 5, 6, 8]}])
  assert.deepEqual(JSON.parse(values['mode.sources']), [{key: 'maqam/09', label: 'Maqam 9 (family 0, mode 0)', cents: [0, 200, 350, 500, 700, 850, 1000, 1200]}])
  assert.deepEqual(JSON.parse(values['mode.absent']), [{scale: 'shem', status: 'absent'}])
  const none = scale.scaleMappingValues(null, {state: 'refused', reason: 'no kernel'}, {key: null, root: 0})
  assert.deepEqual(none, {}, 'no device and no catalogue: nothing, never a default')
  const binding = scale.scaleMappingBinding('note-device:nd-1', null, {state: 'refused', reason: 'no kernel'}, {key: null, root: 0})
  assert.match(binding.standing.enabled.disabled, /No Scale device/); assert.match(binding.standing['mode.key'].disabled, /The mode catalogue is refused: no kernel/)
  assert.equal(binding.writes('mode.lens'), false)
})

test('a change goes to its owner, root before scale; a scale the catalogue does not offer on the root is refused before anything changes', async () => {
  const acts = []
  const writers = {setPower: (id, on) => acts.push(['power', id, on]), setTie: (id, tie) => acts.push(['tie', id, tie]), setHold: patch => acts.push(['hold', patch])}
  const binding = scale.scaleMappingBinding('note-device:nd-1', device(), ready, {key: null, root: 0}, writers)
  await binding.write([{key: 'mode.key', value: aeolian.key}, {key: 'mode.root', value: 10}, {key: 'tie', value: 'Down'}, {key: 'enabled', value: false}])
  assert.deepEqual(acts, [['hold', {root: 10}], ['hold', {key: aeolian.key}], ['tie', 'nd-1', 'down'], ['power', 'nd-1', false]])
  acts.length = 0
  await assert.rejects(binding.write([{key: 'tie', value: 'Down'}, {key: 'mode.key', value: aeolian.key}]), /the catalogue offers no such scale on this root/)
  assert.deepEqual(acts, [], 'a refused set changes nothing')
  await binding.write([{key: 'mode.key', value: 'maqam/09'}])
  assert.deepEqual(acts, [['hold', {key: 'maqam/09'}]], 'a source scale stands on any root')
  await assert.rejects(binding.write([{key: 'mode.lens', value: '[]'}]), /A reading: the owner's catalogue/)
})

test('the design draws every view on the binding; the chain\'s Scale plate wears it and publishes the binding', () => {
  const binding = scale.scaleMappingBinding('note-device:nd-1', device(), ready, {key: aeolian.key, root: 10})
  for (const view of VIEWS) assert.ok(renderToStaticMarkup(h(HostedDevice, {designed: scaleDesign, binding, view, nav: {}})).length > 0, view)
  const mode = modes.resolveModeInForce(parsed.catalogue.scales, {key: aeolian.key, root: 10})
  renderToStaticMarkup(h(chainView.NoteDeviceChainView, {devices: [device()], mode, catalogue: {reading: ready, hold: {key: aeolian.key, root: 10}}}))
  renderToStaticMarkup(h(chainView.NoteDeviceChainView, {devices: [device()], mode}))
})

test('Exact-ratio draws the bases\' generators the owner states, names why no tuning has an owner, and keeps Readout and Error in the view\'s hand', () => {
  exact.resetExactRatioView()
  let changed = 0
  const binding = exact.exactRatioBinding('live:exact-ratio', ready, () => changed++)
  assert.equal(designKey(exact.EXACT_RATIO_FAMILY, exact.EXACT_RATIO_FACE), exactDesign.id)
  assert.deepEqual(binding.values, {reason: 'No owner takes a tuning yet', 'basis.chromatic': '9:8', 'basis.fifths': '3:2'})
  for (const key of ['light', 'refNote', 'refHz', 'ratioSet', 'comma', 'export', 'bendRange', 'source.ratios']) {
    assert.equal(binding.writes(key), false); assert.equal(binding.standing[key].disabled, exact.EXACT_RATIO_ABSENT[key])
  }
  assert.match(binding.standing.refHz.disabled, /compose request carries no tuning operand/)
  assert.equal(binding.write, undefined, 'nothing here writes to an owner')
  binding.local.readout('cents'); binding.local.error(false)
  assert.equal(changed, 2)
  const again = exact.exactRatioBinding('live:exact-ratio', ready)
  assert.equal(again.values.readout, 'cents'); assert.equal(again.values.error, false)
  assert.deepEqual(exact.exactRatioBinding('live:exact-ratio', {state: 'loading'}).values, {reason: 'No owner takes a tuning yet', readout: 'cents', error: false})
  for (const view of VIEWS) assert.ok(renderToStaticMarkup(h(HostedDevice, {designed: exactDesign, binding: again, view, nav: {}})).length > 0, view)
  exact.resetExactRatioView()
})
