import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Lane BL: Live's undesigned devices on the kit, each with a live picture in its well, in every place it is drawn. The keyboard's
// picture is its playing surface (one keyboard hears MIDI: the chain's plate); a note device's is the fold it makes of the twelve classes
// under the owner's mode; a set device's is its stored values on their ranges. Each is published with its picture, so the pool, a pane
// and the rail draw it too. Readings are fixtures shaped as the owners serve them — the mode row is the one `ql music modes --json`
// served on 16 Oct (scripted); the publish wiring is read from the code (code-reading). Loader as live-detail-chain.test.mjs.
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
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
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
const devices = await import('../src/live/liveChainDevices.ts')
const layout = await import('../src/live/keyboardLayout.ts')
const {JankoDevice, JankoDeviceView} = await import('../src/live/janko/JankoDevice.tsx')
const fold = await import('../src/live/noteDevices/NoteFoldPicture.tsx')
const setPicture = await import('../src/live/SetDevicePicture.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const {PlacedDevice} = await import('../src/frame/devices/DeviceView.tsx')
const read = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

// The aeolian row of `ql music modes --json` (ql.music-modes/v1), as the owner served it on 16 Oct.
const aeolian = {anchor_basis: 'chromatic', context_frame: 'CF6', key: "chromatic/L0'/aeolian", kind: 'lens-cf', label: "aeolian on L0', chromatic basis",
  lens: "L0'", mode: 'aeolian', pitches: [10, 0, 1, 3, 5, 6, 8], scale_beneath_tonic: 1, steps_semitones: [2, 1, 2, 2, 1, 2, 2], tonic: 10, tuning: null,
  provenance: {operator: 'mode_tonic_instance', owner: 'ql-mef', revision: '1.0.0', symbol: 'mode_tonic_landscape',
    source: {blob: '6414c56c6241c3da46e1ea6fdcd7a09b6b66c5aa', path: 'docs/sources/ql-musical-derivation-v3.md', vendor_commit: '9429a9fb5173f32138799046e8e2a4d7a2d86968', version: '1.0.0'}}}
const catalogue = modes.parseQlMusicModes({schema: 'ql.music-modes/v1', lens_cf: [aeolian], source_scales: [], sources_absent: [],
  bases: [{basis: 'chromatic', conjugate_axis_semitones: 1, generator_ratio: {den: 8, num: 9}, generator_semitones: 2}], provenance: {m2_registry_revision: 'r1', owner: 'ql-mef'}})
assert.equal(catalogue.ok, true, catalogue.refusal)
const inForce = modes.resolveModeInForce(catalogue.catalogue.scales, {key: aeolian.key, root: 10})
const none = {state: 'waiting', selection: null, line: 'No mode is in force.'}
const scale = (over = {}) => ({id: 'n1', kind: 'scale', enabled: true, params: {tie: 'up'}, ...over})

test('the keyboard\'s layout is one, held in the shell: the plate\'s choice moves every drawing of it', async () => {
  assert.equal(layout.keyboardLayout(), 'janko')
  const device = devices.keyboardDevice(layout.keyboardLayout(), layout.setKeyboardLayout)
  await device.submit([{key: 'layout', value: 'Piano'}])
  assert.equal(layout.keyboardLayout(), 'piano', 'the plate\'s write is the shell\'s layout')
  layout.setKeyboardLayout('janko')
})

test('one keyboard hears MIDI: a second drawing of it plays from the pointer and the keys only, and says nothing of MIDI', () => {
  const heard = renderToStaticMarkup(h(JankoDeviceView, {windowState: null, plate: true}))
  assert.match(heard, /data-janko-midi=/, 'the chain\'s plate hears MIDI and says so')
  const deaf = renderToStaticMarkup(h(JankoDeviceView, {windowState: null, plate: true, midi: false}))
  assert.doesNotMatch(deaf, /data-janko-midi=/, 'a picture of the keyboard elsewhere subscribes to nothing')
  assert.match(deaf, /class="janko-play"/, 'and is still a surface you play')
})

test('a note device\'s well is its own law: each class to where it sounds under the owner\'s mode; bypassed or modeless, straight down', () => {
  const folded = fold.foldMap(scale(), inForce)
  assert.deepEqual(folded.mask.map((held, pc) => held ? pc : null).filter(pc => pc !== null), [0, 1, 3, 5, 6, 8, 10], 'the owner\'s pitch set')
  assert.deepEqual(folded.to, [0, 1, 3, 3, 5, 5, 6, 8, 8, 10, 10, 0], 'each class to the nearest in the mode, ties up')
  assert.deepEqual(fold.foldMap(scale({params: {tie: 'down'}}), inForce).to, [0, 1, 1, 3, 3, 5, 6, 6, 8, 8, 10, 10], 'ties down')
  assert.deepEqual(fold.foldMap(scale({enabled: false}), inForce).to, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'bypassed: as played')
  assert.deepEqual(fold.foldMap(scale(), none), {to: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], mask: null}, 'no mode: as played, nothing lit')
  const markup = renderToStaticMarkup(h(fold.NoteFoldPicture, {device: scale(), mode: inForce}))
  assert.match(markup, /data-note-fold="fold"/)
  assert.equal((markup.match(/note-fold-line--moved/g) ?? []).length, 5, 'five classes move')
  assert.equal((markup.match(/note-fold-sound--held/g) ?? []).length, 7, 'seven classes are the mode\'s')
  assert.match(markup, /data-pitch-class="2" data-sounds-as="3"/, 'D sounds as D sharp')
  assert.match(markup, /onto aeolian on L0′?|onto aeolian/, 'the word under the lines names the mode')
  assert.doesNotMatch(renderToStaticMarkup(h(fold.NoteFoldPicture, {device: scale(), mode: none})), /note-fold-line--moved|note-fold-sound--held/)
})

test('a set device\'s well is its stored values on their ranges — the owner\'s table, or the document\'s disclosed range — never a likely curve', () => {
  const table = [
    {id: 'Threshold', ui_name: 'Threshold', stored_min: -40, stored_max: 0, unit: 'dB', kind: 'continuous', notes: ''},
    {id: 'Ratio', ui_name: 'Ratio', stored_min: 0, stored_max: 2, unit: '', kind: 'discrete', labels: ['2', '4', '10'], notes: ''},
    {id: 'Range', ui_name: 'Range', stored_min: 0, stored_max: 70, unit: 'dB', kind: 'continuous', notes: ''},
    {id: 'PeakClipIn', ui_name: 'Soft clip', stored_min: 0, stored_max: 1, unit: '', kind: 'toggle', notes: ''},
    {id: 'On', ui_name: 'On', stored_min: 0, stored_max: 1, unit: '', kind: 'toggle', notes: ''},
  ]
  const faced = devices.setDeviceFaced({id: 'live:set/0/0', elementName: 'GlueCompressor', title: 'Glue Compressor', descriptors: table,
    stored: {Threshold: '-10', Ratio: '1', PeakClipIn: 'true', On: 'true'}, write: async () => {}})
  assert.deepEqual(setPicture.setValueMarks(faced), [
    {key: 'Threshold', title: 'Threshold', kind: 'range', at: 0.75},
    {key: 'Ratio', title: 'Ratio', kind: 'step', step: 1, steps: 3},
    {key: 'PeakClipIn', title: 'Soft clip', kind: 'switch', on: true},
  ], 'Range is not stored, so it draws no mark; On is the light, not a mark')
  const params = [{id: 'Gain', value: '0.7943282127', min: '0', max: '1'}, {id: 'Mode', value: 'Fast'}]
  const reading = devices.setDeviceReading({id: 'live:set/0/1', elementName: 'PluginDevice', title: 'Plugin', params})
  assert.deepEqual(setPicture.setValueMarks(reading, params), [{key: 'Gain', title: 'Gain', kind: 'range', at: 0.7943282127}], 'a word with no range draws nothing')
  const markup = renderToStaticMarkup(h(setPicture.SetDevicePicture, {marks: setPicture.setValueMarks(faced), size: 'compact'}))
  assert.match(markup, /data-set-values="3"/)
  assert.match(markup, /data-set-value="Threshold" data-set-mark="range"/)
  assert.match(renderToStaticMarkup(h(setPicture.SetDevicePicture, {marks: [], size: 'compact'})), /No stored value/)
})

test('published with its picture, a device draws it whole in the pool, full in a pane and on the rail', () => {
  const device = devices.keyboardDevice('janko', layout.setKeyboardLayout)
  door.publishDevice(device.id, {device, picture: () => h(JankoDevice, {plate: true, layout: 'janko', midi: false})})
  try {
    for (const view of ['whole', 'full', 'widget']) {
      const markup = renderToStaticMarkup(h(PlacedDevice, {device, view, picture: door.publishedDevice(device.id).picture}))
      assert.match(markup, /class="janko janko--plate"/, `${view}: the surface in the well`)
      assert.doesNotMatch(markup, /data-janko-midi=/, `${view}: deaf to MIDI`)
    }
  } finally { door.publishDevice(device.id, null) }
})

test('code reading: the keyboard, each note device and each set device publish their pictures; the torus publishes its binding and its own Full, and draws its design', async () => {
  assert.match(await read('live/KeyboardOnChain.tsx'), /usePublishedDevice\(KEYBOARD_DEVICE_ID, device, picture\)/)
  assert.match(await read('live/KeyboardOnChain.tsx'), /<JankoDevice plate layout=\{layout\} midi=\{false\} \/>/, 'the published surface is deaf to MIDI')
  assert.match(await read('live/noteDevices/NoteDeviceChain.tsx'), /usePublishedDevice\(instance\.id, instance, picture\)/)
  assert.match(await read('live/SetDeviceOnChain.tsx'), /usePublishedDevice\(id, device, picture\)/)
  const torus = await read('live/TorusOnChain.tsx')
  assert.match(torus, /publishDevice\(TORUS_DEVICE_ID, \{device, binding, picture: .*, full: \{draw: \(\) => <TorusFull \/>\}\}\)/)
  // Lane BL2 (inverting lane BL's hold-back): the design now draws the four determinants and its See and hear, and the chain's wrap
  // reaches a design's kit controls by value key (sdk/panel.tsx ControlWrapContext), so hosting it takes no MIDI-mappable control off
  // the chain. The chain passes the binding and keeps its wrap (proved by render in live-torus-binding.test.mjs).
  assert.match(torus, /<DeviceView device=\{device\} binding=\{binding\}/, 'the chain draws the design on the owner\'s binding')
  assert.match(torus, /wrapRow=\{torusMapWrap\}/, 'and keeps the MIDI-map wrap')
})
