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

test('Physics draws on the engine\'s readings: every design key is the engine\'s path, in the engine\'s units, or named as absent', () => {
  // The design's keys (physics.tsx defaults) are the engine's: each maps to a path of the Fluid and Physics+ groups, the plane, the two
  // presses, or is absent with a reason.
  const known = new Set([...Object.keys(physicsBinding.PHYSICS_KEYS), 'plane', ...Object.keys(physicsBinding.PHYSICS_PRESSES), ...Object.keys(physicsBinding.PHYSICS_ABSENT)])
  for (const key of Object.keys(physics.defaults)) assert.ok(known.has(key), `${key}: mapped to the engine or named absent`)
  for (const path of Object.values(physicsBinding.PHYSICS_KEYS)) assert.ok(model.expressionsFieldEntry('physics').paths.includes(path), `${path} is a Physics path of the engine`)
  const r = reading({params: {[nativeKey('fluid.vortexRadius')]: 1.125, [nativeKey('fluid.maxSpeed')]: 50, [nativeKey('fluid.vortexStrength')]: -3, [nativeKey('fluid.gravityY')]: -2}, paused: true})
  const device = model.expressionsFieldDevice(r, 'physics', null)
  const values = physicsBinding.physicsValuesOf(device, r)
  assert.equal(values.radius, 450, 'the reach in the engine\'s pixels: stage 1.125 × 400')
  assert.equal(values.speedLimit, 20000, 'the speed limit in the engine\'s units: stage 50 × 400')
  assert.equal(values.vortex, -3)
  assert.equal(values.gy, -2)
  assert.equal(values.plane, 'horizontal', 'the plane by the owner\'s value, not the row\'s label')
  assert.equal(values.paused, true, 'the engine\'s own reading of the hold')
  assert.equal(values.light, undefined, 'Physics has no on or off: no reading, never a default')
  assert.equal(physicsBinding.physicsValuesOf(device, reading()).paused, undefined, 'an engine that does not say is not read as running')
})

test('a change on the design leaves through the device\'s one submit, in the engine\'s units; a press runs the engine; a reading is refused', async () => {
  const sent = [], pressed = []
  const device = {...model.expressionsFieldDevice(reading(), 'physics', null), submit: async changes => {sent.push(changes)}}
  const binding = physicsBinding.physicsDesignBinding(device, reading(), action => pressed.push(action))
  assert.equal(binding.id, 'expressions:physics', 'the design\'s own key, the device\'s id')
  await binding.write([{key: 'radius', value: 800}, {key: 'gy', value: -1.5}, {key: 'plane', value: 'horizontal'}])
  assert.deepEqual(sent, [[{key: 'fluid.vortexRadius', value: 2}, {key: 'fluid.gravityY', value: -1.5}, {key: 'set:mediumPlane', value: 'XZ · horizontal'}]])
  await binding.write([{key: 'disperse', value: true}, {key: 'reset', value: 'confirmed'}])
  assert.deepEqual(pressed, ['disperse', 'reset'], 'Disperse runs once; Reset only once it is confirmed')
  await assert.rejects(binding.write([{key: 'reset', value: true}]), /asks first/, 'Reset reseeds every particle: never without its confirmation')
  await assert.rejects(binding.write([{key: 'paused', value: true}]), /reading/, 'the hold is the engine\'s reading')
  await assert.rejects(binding.write([{key: 'plane', value: 'diagonal'}]), /vertical or horizontal/)
  for (const key of ['viscosity', 'radius', 'plane', 'disperse']) assert.ok(binding.writes(key), `${key} goes to the engine`)
  for (const key of ['paused', 'light']) assert.equal(binding.writes(key), false, `${key} is a reading`)
  const locked = physicsBinding.physicsDesignBinding(model.expressionsFieldDevice(reading(), 'physics', null), reading(), noop)
  assert.equal(locked.write, undefined, 'while the work is busy every value is a reading')
})

test('the Physics design draws on the binding: the swirl from the engine\'s values, nothing drawn as NaN', () => {
  const r = reading({params: {[nativeKey('fluid.vortexStrength')]: 2.5}})
  const device = model.expressionsFieldDevice(r, 'physics', null)
  const binding = physicsBinding.physicsDesignBinding(device, r, noop)
  for (const view of ['compact', 'whole', 'folded', 'widget']) {
    const html = renderToStaticMarkup(h(HostedDevice, {designed: physics, binding, view, nav: {}}))
    assert.doesNotMatch(html, /NaN|undefined/, `${view}: drawn from the readings`)
  }
  const compact = renderToStaticMarkup(h(HostedDevice, {designed: physics, binding, view: 'compact', nav: {}}))
  assert.match(compact, /\+2\.5/, 'the corner reads the engine\'s vortex')
  assert.match(compact, /aria-label="The swirl"|The swirl/)
})

test('the Field\'s design is not bound: its picture is the module\'s own symbols, and the shell has no Field device to publish it on; every other field family is', async () => {
  const views = await readFile(new URL('../src/components/devices/ExpressionsDeviceView.tsx', import.meta.url), 'utf8')
  assert.match(views, /if \(family === 'physics'\) return physicsDesignBinding\(device, reading, enginePress\)/, 'Physics publishes its own binding')
  assert.match(views, /isFieldDesignFamily\(family\) \? familyDesignBinding\(family, device, reading, send\) : undefined/, 'the other field families publish theirs (fieldDesignBinding.ts); the Field, none')
  assert.match(views, /claims\.current\.get\(entry\.family\)\?\.publish\(\{device: entry\.device, picture: entry\.picture, \.\.\.\(entry\.binding \? \{binding: entry\.binding\} : \{\}\)\}\)/,
    'the binding is published with the device, so every place draws the design')
  const field = await readFile(new URL('../src/inhabitants/catalogue/panels/expressions__field.tsx', import.meta.url), 'utf8')
  assert.match(field, /^const SYMBOLS = \[/m, 'the Field\'s picture draws module constants: bound, it would draw the Seven centres over any work')
})

test('the summoned editors: Acts, Nara and Find open whole in the pool while the frame holds them open; the Library\'s summon opens its page', () => {
  assert.deepEqual(editors.SUMMONED_EDITORS.map(editor => editor.id), ['expressions:library', 'expressions:acts', 'expressions:nara-instrument', 'expressions:find'])
  const control = (id, home, kind = 'button', label = id) => ({id, home, kind, label})
  const reading = {lens: 'expressions', controls: [control('acts/l:Roles', 'acts'), control('tools/a:library', 'tools')], summons: {library: 3}}
  assert.deepEqual(editors.openEditors(reading).map(editor => editor.id), ['expressions:acts'], 'an editor is open while its home holds controls')
  assert.deepEqual(editors.openEditors(null), [])
  assert.deepEqual(editors.newSummons(reading, null), {count: 3, open: false}, 'the first reading is where the shell starts: nothing replays')
  assert.deepEqual(editors.newSummons(reading, 2), {count: 3, open: true}, 'a new summon opens the Library once')
  assert.deepEqual(editors.newSummons(reading, 3), {count: 3, open: false})
  assert.deepEqual(editors.newSummons({lens: 'expressions', controls: []}, 3), {count: 3, open: false}, 'a frame that hands nothing over opens nothing')
  // One band holds seven rows of keys in three columns; a choice stands two rows high and never splits between columns.
  const keys = n => Array.from({length: n}, (_, i) => control(`k${i}`, 'acts'))
  assert.equal(editors.editorPages(keys(21)).length, 1)
  assert.deepEqual(editors.editorPages(keys(22)).map(page => page.length), [21, 1])
  const mixed = [...keys(6), control('s', 'acts', 'select'), ...keys(1)]
  assert.deepEqual(editors.editorPages(mixed, 7, 1).map(page => page.map(item => item.id)), [['k0', 'k1', 'k2', 'k3', 'k4', 'k5'], ['s', 'k0']], 'the choice moves on whole')
  const device = editors.editorDevice(editors.SUMMONED_EDITORS[1])
  assert.equal(`${device.family}:${device.face.id}`, device.id, 'the design\'s key is the device\'s id (designs.ts designKey)')
})

test('an editor\'s plate draws the frame\'s own controls for its home, paged in its head, and nothing when the frame has closed it', () => {
  const acts = editors.SUMMONED_EDITORS[1]
  const design = editors.editorDesign(acts)
  const controls = Array.from({length: 30}, (_, i) => ({id: `acts/l:Row ${i}`, home: 'acts', kind: 'button', label: `Row ${i}`}))
  publishHostedChrome({state: {presentation: 'devices', nativeScene: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture'}, chrome: {lens: 'expressions', controls}}, run: async () => ({ok: true}), faults: []})
  const props = {v: {}, set: noop, nav: {}, page: '0', setPage: noop}
  const whole = renderToStaticMarkup(h(() => design.whole(props)))
  assert.match(whole, /data-chrome="acts\/l:Row 0"/, 'the frame\'s own control, pressed through its runner')
  assert.doesNotMatch(whole, /data-chrome="acts\/l:Row 21"/, 'the next page waits in the head')
  assert.match(whole, /role="tab"[^>]*>2</, 'pages in the head, never a scroller')
  publishHostedChrome({state: {presentation: 'devices', nativeScene: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture'}, chrome: {lens: 'expressions', controls: []}}, run: async () => ({ok: true}), faults: []})
  assert.match(renderToStaticMarkup(h(() => design.whole(props))), />closed</, 'closed in the frame, said in one word')
  publishHostedChrome(null)
  const library = renderToStaticMarkup(h(() => editors.editorDesign(editors.SUMMONED_EDITORS[0]).whole({...props, nav: {full: noop}})))
  assert.match(library, /Open the Library full in a pane/, 'the Library\'s plate opens its own page in a pane')
})

test('the Studio\'s sections fit the band: a held device scales between 80 and 100 %, below that its section folds; keys flow down the band', () => {
  assert.equal(studioDevices.heldScale(139, 168), 0.83)
  assert.equal(studioDevices.heldScale(200, 168), 1, 'never above the plate\'s own size in a section')
  assert.equal(studioDevices.heldScale(120, 168), null, 'cut even at 80 %: the section folds to its title')
  assert.equal(studioDevices.heldScale(null, 168), 1, 'unmeasured: as drawn')
  const entry = id => ({device: {id, face: {title: id}}, mark: 'form'})
  const devices = [entry('a'), entry('b'), entry('c')]
  assert.equal(studioDevices.shownDevice(devices, 'c', 'b').device.id, 'c', 'the person\'s pick')
  assert.equal(studioDevices.shownDevice(devices, 'gone', 'b').device.id, 'b', 'else the one the Studio shows first')
  assert.equal(studioDevices.shownDevice(devices, null, null).device.id, 'a')
  assert.equal(chromeRows(139), 7, 'the band\'s 139 px hold seven rows of keys')
  assert.equal(chromeRows(null), 6)
})

test('Selected\'s Glyph page: the sequence as kit controls through the one apply; its states in the clip; no box, no Save of its own', async () => {
  const steps = [{id: 'k0', text: 'a', shape: 'text', hold: 1, transition: 1}, {id: 'k1', text: 'b', shape: 'text', hold: 1, transition: 1}]
  const formation = {id: 'e-form', name: 'Seven centres', kind: 'formation', locked: false, sequence: {enabled: true, clock: 'morph', manual: false, order: 'pingpong', rateMul: 2, phaseOffset: 0, steps}}
  const r = reading({entities: [formation], selection: ['e-form']})
  assert.equal(studio.selectedFormation(r).id, 'e-form')
  assert.equal(studio.selectedFormation(reading({entities: [formation]})), null, 'only the one selected formation')
  const html = renderToStaticMarkup(h(studio.SelectedSequence, {reading: r, formation, locked: false, apply: noop, onExpand: noop}))
  assert.match(html, /role="radio" aria-checked="true"[^>]*>Play</, 'Compose reads the sequence\'s own state')
  assert.match(html, /role="radio" aria-checked="true"[^>]*>Morph</)
  assert.match(html, /role="radio" aria-checked="true"[^>]*>Ping-pong</)
  assert.match(html, /aria-label="Rate"[^>]*aria-valuenow="2"/)
  assert.match(html, /States ⤢/, 'the states open in the clip')
  assert.doesNotMatch(html, />Save<|glyph-editor|Glyph Sequence/, 'no box of its own and no second Save')
  const none = renderToStaticMarkup(h(studio.SelectedSequence, {reading: r, formation: null, locked: false, apply: noop, onExpand: noop}))
  assert.match(none, /Select a native formation/)
  const source = await readFile(new URL('../src/components/expressions/studio/ExpressionsStudio.tsx', import.meta.url), 'utf8')
  assert.match(source, /apply\(\[\{kind: 'sequence-settings', entity_id: formation\.id, \.\.\.\(step \? \{step_id: step\.id\} : \{\}\), values\}\]\)/, 'the glyph editor\'s own change (GlyphSequenceEditor.tsx:149)')
  assert.doesNotMatch(source, /<GlyphSequenceEditor/, 'the glyph editor no longer stands in the Studio')
})
