// Lane W4 for Expressions, Live and Quaternal Logic: the Field (manual §20.2) published on its owners at the Studio's head (§20.3);
// Binding (§22.8) and the M′ matrices (§22.6, with its Kernel page) bound to what the owners answer and admitted where §22 and §16.16 put
// them; the Torus's Stage page redrawn when the frame announces a stage (TorusOnChain.tsx useTorusChainBinding).
//
// Channels:
// - REAL (tests/fixtures/ql-music-modes-2026-10-21.json): `ql music modes --json` from the installed quaternal-logic (ql 0.1.0,
//   9af17b080bc8) on workcell:mac, 21 Oct — the document the kernel's music_modes_read passes through (native/liveModeCatalogue.ts).
// - FIXTURE, owner-shaped: the retained editor's reading of an open Expression (NativeEditorReading, as field-design-bindings.test.mjs
//   shapes it); the M3 reception's answer (oi.m3-reception-context/v1 with ql.m3-state/v1, as ql-m3-clock-binding.test.mjs shapes it);
//   the frame's announced stage (stageReading.ts readFrameStage).
// - SCRIPTED: each catalogue design rendered through the runtime's host (deviceHost.HostedDevice) to static markup, on its binding.
// No owner state is written: every write goes to a stand-in send, a stand-in hand or is refused.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText.split('import.meta.env').join('({BASE_URL: "/"})').split('import.meta.glob').join('(() => ({}))')};
}`)}`, import.meta.url)

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
const door = await import(src('inhabitants/familyManifest.ts'))
const world = await import(src('inhabitants/worldShellFamilies.ts'))
const host = await import(src('frame/devices/deviceHost.tsx'))
const deviceDoor = await import(src('frame/devices/deviceDoor.ts'))
const {designKey} = await import(src('frame/devices/designs.ts'))
const model = await import(src('components/devices/expressionsDevice.ts'))
const field = await import(src('components/devices/fieldInstrument.ts'))
const {claimDevice} = await import(src('components/devices/devicePublication.ts'))
const qlB = await import(src('inhabitants/ql/devices/qlBinding.ts'))
const qlMx = await import(src('inhabitants/ql/devices/qlMatrices.ts'))
const m1 = await import(src('inhabitants/ql/devices/qlM1.ts'))
const m3c = await import(src('inhabitants/ql/devices/qlM3Clock.ts'))
const chain = await import(src('inhabitants/ql/devices/TechneDevices.tsx'))
const holds = await import(src('techne/devices/designDevices.ts'))
const {parseQlMusicModes} = await import(src('live/modes.ts'))
const {inhabitantManifest} = await import(src('inhabitants/manifest.ts'))
const onChain = await import(src('live/TorusOnChain.tsx'))
const torusDevice = await import(src('live/torusDevice.ts'))
const pane = await import(src('projections/expressionsPaneHost.ts'))
const {readFrameStage} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageReading.ts')
const {NATIVE_BINDINGS} = await import('@epilogos/expressions-boundary/parameters')
// Binding's own design (quaternal-logic__binding.tsx) was retired in the 22 Oct manual rewrite (#725): it is the M3 clock's Binding skin (§22.3,
// §22.8), drawn by the M3 clock's design under `binding.` on the clock's binding carrying Binding's (TechneDevices.tsx qlFaceEntry).
const DESIGNS = {
  field: (await import(src('inhabitants/catalogue/panels/expressions__field.tsx'))).design,
  studio: (await import(src('inhabitants/catalogue/panels/expressions__studio.tsx'))).design,
  matrices: (await import(src('inhabitants/catalogue/panels/quaternal-logic__m-prime-matrices.tsx'))).design,
  m3clock: (await import(src('inhabitants/catalogue/panels/quaternal-logic__m3-clock.tsx'))).design,
}

door.resetFamilyManifestsForTest()
world.loadWorldShellFamilies()

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const REAL_MODES = parseQlMusicModes(JSON.parse(readFileSync(new URL('./fixtures/ql-music-modes-2026-10-21.json', import.meta.url), 'utf8')))
assert.equal(REAL_MODES.ok, true, 'the real catalogue parses')
const views = ['folded', 'compact', 'whole', 'full', 'widget']
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const keysOf = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
/** The keys a design's controls set, read from its source: every `set('key'` (a control's, a handle's) and every dial a helper draws by key
 * (the Field's `DIAL(p, 'key'`). */
const setKeysOf = file => {
  const source = read(`inhabitants/catalogue/panels/${file}`)
  return [...new Set([...source.matchAll(/\bset\('([^']+)'/g), ...source.matchAll(/\bDIAL\(p, '([^']+)'/g)].map(m => m[1]))]
}

/** (b): each key is an owner reading, absent with a reason, or a local hold. */
function classify(design, binding) {
  const out = {reading: [], absent: [], local: []}
  for (const key of keysOf(design)) {
    if (key in binding.values) { out.reading.push(key); continue }
    if (binding.local && key in binding.local) { out.local.push(key); continue }
    const why = binding.standing?.[key]?.disabled
    assert.ok(typeof why === 'string' && why.length > 8, `${design.id} ${key}: absent with no reason`)
    assert.doesNotMatch(why, /undefined|NaN/, `${design.id} ${key}: the reason is words`)
    out.absent.push(key)
  }
  return out
}
/** (c): each control's key writes through an owner, is the view's own, or stands disabled with the operation's name. */
function controlStanding(binding, keys) {
  const out = {written: [], local: [], disabled: []}
  for (const key of keys) {
    if (binding.local && key in binding.local) out.local.push(key)
    else if (binding.write && (!binding.writes || binding.writes(key))) out.written.push(key)
    else {
      assert.ok(binding.standing?.[key]?.disabled, `${binding.id} ${key}: a control that neither writes nor stands disabled`)
      out.disabled.push(key)
    }
  }
  return out
}
/** The M3 clock's Binding skin as its own device's keys: the clock's `binding.` keys without the prefix (w4-family-classification's carriedOf). */
const skinOf = design => {
  const strip = values => Object.fromEntries(Object.entries(values).filter(([k]) => k.startsWith('binding.')).map(([k, x]) => [k.slice('binding.'.length), x]))
  return {...design, id: `${design.id} binding.*`, defaults: strip(design.defaults), fixtures: Object.fromEntries(Object.entries(design.fixtures ?? {}).map(([n, f]) => [n, strip(f)]))}
}
/** The controls the Binding skin sets, read from the M3 clock's source, its skin's part (between its heading and the scoping of its keys). */
const skinSetKeys = () => {
  const source = read('inhabitants/catalogue/panels/quaternal-logic__m3-clock.tsx')
  const part = source.slice(source.indexOf('// ================================================================ the Binding skin'), source.indexOf('const bindingOf = '))
  return [...new Set([...part.matchAll(/\bset\('([^']+)'/g)].map(m => m[1]))]
}
/** The M3 clock as the rack stands it: its binding carrying the Binding skin (TechneDevices.tsx qlFaceEntry). */
const clockEntry = m3 => chain.qlFaceEntry(inhabitantManifest('quaternal-logic').faces.find(face => face.id === 'm3-clock'), null, null, undefined, m3)

function hostedAll(design, binding, pages = ['']) {
  const out = views.filter(view => view !== 'whole').map(view => [view, renderToStaticMarkup(h(host.HostedDevice, {designed: design, binding, view, nav: {}}))])
  for (const page of pages) {
    host.setHostPage(binding.id, page)
    out.push(['whole', renderToStaticMarkup(h(host.HostedDevice, {designed: design, binding, view: 'whole', nav: {}}))])
  }
  host.resetHost(binding.id)
  return out
}
function drawsClean(design, binding, fixture, pages, known = null) {
  const drawn = hostedAll(design, binding, pages).map(([view, markup]) => [view, known ? markup.replace(known, '') : markup])
  for (const [view, markup] of drawn) {
    assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
    assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
  }
  return drawn.map(([, markup]) => markup).join('\n')
}

// ---------------------------------------------------------------------------------------------------------------- the Field

const nativeKey = path => NATIVE_BINDINGS.find(row => row.path === path).key
const ENGINE = {mediumEnabled: false, resonanceEnabled: true, templateDimension: '3D', collisionEnabled: false, pairwiseEnabled: false, morphEnabled: true,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'horizontal', autoOscillate: true,
  pointerMode: 'attract', relationalEnabled: false, volumeEnabled: false}
function editorReading() {
  return {
    basis: {expression_ref: 'expr:field', revision: 4, scene_ref: 'scene:field', authored_revision: 4},
    scene: {name: 'Seven centres', engine: {...ENGINE}, composition: {focus: 'parallel', frequencyDriver: 'torus', keySource: 'sky', symbolVoices: false},
      morph: {law: 'theta', thetaOffset: 0, dwell: 0.4}, automation: [],
      entities: [{id: 'a', name: 'Root', kind: 'formation', sound: {enabled: true}}, {id: 'b', name: 'Heart', kind: 'formation', sound: {enabled: true, gain: 0.3}},
        {id: 'c', name: 'Crown', kind: 'formation'}],
      field: {background: '#ffffff', palette: ['#112233'], material: 'ink', params: {[nativeKey('cymatics.frequencyHz')]: 512, [nativeKey('cymatics.dominance')]: 0.75,
        [nativeKey('cymatics.baseFrequency')]: 32, [nativeKey('fluid.timeScale')]: 1.5, [nativeKey('particleCount')]: 120000}}},
    entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null},
  }
}
function fieldInput({locked = false, muted = false, frame = true} = {}) {
  const r = editorReading(), sent = {}, applied = [], mutes = []
  const devices = Object.fromEntries(['resonance', 'physics', 'morph', 'ink'].map(family => [family, model.expressionsFieldDevice(r, family,
    locked ? null : async edits => { (sent[family] ??= []).push(edits); return {ok: true} })]))
  return {r, sent, applied, mutes, input: {reading: r, devices,
    sound: frame ? {muted, mute: async next => { mutes.push(next); return {ok: true} }} : {muted: null, mute: null, why: field.fieldSoundWhy({run: null, state: null})},
    apply: locked ? null : async changes => { applied.push(changes); return {ok: true} }}}
}

test('the Field reads its owners: the frame\'s object sound, Resonance\'s plate, medium and tone, Physics\'s time, Morph\'s dwell, Ink\'s count, the scene\'s key and voices', () => {
  const {input} = fieldInput()
  const binding = field.fieldBinding(input)
  assert.equal(binding.id, designKey('expressions', 'field'))
  assert.deepEqual(binding.values, {sound: true, plate: true, medium: 'chamber', resonance: 512, dominance: 0.75, baseFrequency: 32, tempo: 1.5, hold: 0.4,
    particles: 120000, keySource: 'sky', symbolVoices: false, voices: 2})
  const keys = classify(DESIGNS.field, binding)
  assert.deepEqual(keys.absent, ['level'], 'only the level has no owner')
  assert.match(binding.standing.level.disabled, /missing op: a field-wide level of the Expression's sound/)
  assert.deepEqual(keys.local, [])
  const controls = controlStanding(binding, setKeysOf('expressions__field.tsx'))
  assert.deepEqual(controls.disabled, ['level'])
  assert.deepEqual(controls.written.sort(), ['hold', 'keySource', 'medium', 'plate', 'resonance', 'sound', 'symbolVoices', 'tempo'])
  // A scene saved before the key carries none: Key source is absent, never the manual's default.
  const older = fieldInput()
  delete older.r.scene.composition.keySource
  assert.equal(field.fieldValues(older.input).keySource, undefined)
  // While the work is busy every row is a reading; with no frame, the sound says why.
  const busy = field.fieldBinding(fieldInput({locked: true, frame: false}).input)
  assert.equal(busy.writes('tempo'), false)
  assert.match(busy.standing.tempo.disabled, /Waiting for the native owner/)
  assert.match(busy.standing.sound.disabled, /No Expressions application is mounted/)
  assert.equal(busy.values.sound, undefined, 'the sound stays absent until the frame says')
})

test('a change on the Field goes through the device that carries it, the editor\'s panel setting, and the Activator', async () => {
  const {input, sent, applied, mutes} = fieldInput()
  const binding = field.fieldBinding(input)
  await binding.write([{key: 'resonance', value: 440}, {key: 'plate', value: false}, {key: 'medium', value: 'plate'}, {key: 'tempo', value: 2},
    {key: 'hold', value: 0.5}, {key: 'keySource', value: 'manual'}, {key: 'symbolVoices', value: true}, {key: 'sound', value: false}])
  const resonance = sent.resonance.flat()
  assert.ok(resonance.some(edit => edit.kind === 'parameter' && edit.target === `field.${nativeKey('cymatics.frequencyHz')}` && edit.value === 440), 'the tone, as Resonance\'s row')
  assert.ok(resonance.some(edit => edit.key === 'resonanceEnabled' && edit.value === false), 'the plate, as Resonance\'s switch')
  assert.ok(resonance.some(edit => edit.kind === 'panel-setting' && edit.key === 'templateDimension' && edit.value === '2D'), 'the medium, as Resonance\'s dimension')
  assert.deepEqual(sent.physics.flat().map(edit => [edit.target, edit.value]), [[`field.${nativeKey('fluid.timeScale')}`, 2]])
  assert.deepEqual(sent.morph.flat().map(edit => [edit.target, edit.value]), [[`field.${nativeKey('toroidalMorph.holdRatio')}`, 0.5]])
  assert.deepEqual(applied, [[{kind: 'panel-setting', key: 'keySource', value: 'manual'}, {kind: 'panel-setting', key: 'symbolVoices', value: true}]])
  assert.deepEqual(mutes, [true], 'Sound off is the Activator\'s mute')
  await assert.rejects(binding.write([{key: 'level', value: 2}]), /missing op: a field-wide level/)
  await assert.rejects(binding.write([{key: 'particles', value: 5}]), /set the count in Ink/)
  await assert.rejects(binding.write([{key: 'keySource', value: 'moon'}]), /the Torus, the Sky or your hand/)
})

test('the Field draws on its binding in every view — no NaN, no undefined, never its fixtures — and its absent level is drawn unread', () => {
  const binding = field.fieldBinding(fieldInput().input)
  // #757 closed the design's gap this test named (it was PROPOSE, design lane): the widget's meter draws an absent level unread, never
  // --level:NaN, and nothing else is let through.
  const widget = renderToStaticMarkup(h(host.HostedDevice, {designed: DESIGNS.field, binding, view: 'widget', nav: {}}))
  assert.doesNotMatch(widget, /NaN/)
  assert.match(widget, /class="ref-meter" data-unread="true"/)
  const all = drawsClean(DESIGNS.field, binding, /42k|5 : 3/, [''])
  assert.ok(all.includes('120k'), 'Ink\'s count')
  assert.ok(all.includes('512 Hz'), 'Resonance\'s tone')
  // The level, absent, is drawn unread: the ring alone and "—", nothing to turn; and since #757 its dial spreads its standing
  // (expressions__field.tsx DIAL), so the binding's reason is drawn on the dial.
  assert.match(all, /role="slider" aria-label="Level"[^>]*aria-valuetext="no reading" aria-disabled="true"/)
  assert.match(binding.standing.level.disabled, /missing op/)
  assert.ok(all.includes('missing op: a field-wide level'), 'the level\'s reason, on its dial')
})

test('(d) the Field stands at the Studio\'s head: published by the Studio over its field devices, drawn by the door at the Field\'s place in the Studio\'s Full', () => {
  assert.equal(`${field.FIELD_DEVICE.family}:${field.FIELD_DEVICE.face.id}`, DESIGNS.field.id, 'its family and face are the design\'s key')
  const binding = field.fieldBinding(fieldInput().input)
  const claim = claimDevice(field.FIELD_DEVICE_ID)
  claim.publish({device: field.FIELD_DEVICE, binding})
  try {
    assert.equal(deviceDoor.publishedByDesign('expressions:field')?.binding, binding, 'the door hands the Studio this Field')
    const asked = []
    const member = id => { asked.push(id); const entry = deviceDoor.publishedByDesign(id); return entry?.binding ? h(host.HostedDevice, {designed: DESIGNS.field, binding: entry.binding, view: 'whole', nav: {}}) : null }
    const markup = renderToStaticMarkup(h(() => DESIGNS.studio.full({v: {}, set: () => {}, nav: {}, page: 'macros', setPage: () => {}, frame: 'pane', room: {w: 1180, h: 620}, member})))
    assert.equal(asked[0], 'expressions:field', 'after your controls, the Field first, then each chain')
    assert.match(markup, /aria-label="Field"[\s\S]*data-device-view="whole"/, 'the Field\'s own Whole stands in the Studio\'s Full')
    assert.ok(markup.indexOf('Your controls') < markup.indexOf('data-device-view="whole"'), 'under your controls')
  } finally { claim.release() }
  assert.equal(deviceDoor.publishedByDesign('expressions:field'), undefined, 'withdrawn with its last claimant')
  const studio = read('components/expressions/studio/ExpressionsStudio.tsx')
  assert.match(studio, /const fieldDevices = useFieldDevices\(FIELD_FAMILIES, [^\n]*\n\s*useFieldInstrument\(fieldDevices, \{reading, apply: editor\.apply, locked: editor\.locked\}\)/,
    'the Studio publishes the Field over the very devices its chains hold')
  for (const family of ['resonance', 'physics', 'morph', 'ink']) assert.ok(read('inhabitants/sdk/semantics.ts').includes(`'expressions/${family}'`), `${family}: a device of the Studio's chains`)
  assert.equal(DESIGNS.field.views, undefined, 'the Field declares every view: it is an instrument (§16.1)')
})

const fieldFamilies = await import(src('components/devices/fieldDesignBinding.ts'))
test('the field devices close what their owners answer: Focus\'s Carry station, Colour\'s paper, Depth\'s swirl and bridge, Medium\'s plane; Focus\'s chosen row is the view\'s', async () => {
  holds.resetHolds()
  const r = editorReading()
  r.scene.composition.carryStation = true
  r.scene.engine.backgroundMode = 'vignette'
  r.scene.engine.vortex3d = 0.6
  const sent = []
  const send = async (edits, numeric, basis) => { sent.push(edits); return {ok: true} }
  const of = family => fieldFamilies.fieldDesignBinding(family, model.expressionsFieldDevice(r, family, send), r, send)
  const focus = of('focus'), colour = of('colour'), depth = of('depth'), medium = of('medium'), pointer = of('pointer')
  assert.equal(focus.values.carryStation, true, 'the scene\'s linked-station switch')
  assert.equal(colour.values.backgroundMode, 'vignette', 'the paper\'s glow, by the owner\'s value')
  assert.equal(depth.values.vortex3d, 0.6)
  assert.equal(depth.values.dispersion3d, undefined, 'a depth the scene does not set stays unread')
  assert.equal(depth.writes('dispersion3d'), true, 'and is still the owner\'s to set')
  assert.equal(medium.values.mediumPlane, 'horizontal')
  assert.match(medium.standing.mediumPlane.disabled, /set on Physics/)
  assert.match(pointer.standing.light.disabled, /no on or off/)
  await focus.write([{key: 'carryStation', value: false}])
  await colour.write([{key: 'backgroundMode', value: 'adaptive'}])
  await depth.write([{key: 'dispersion3d', value: 0.3}])
  assert.deepEqual(sent.flat(), [{kind: 'panel-setting', key: 'carryStation', value: false}, {kind: 'panel-setting', key: 'backgroundMode', value: 'adaptive'},
    {kind: 'panel-setting', key: 'dispersion3d', value: 0.3}])
  focus.local.chosen('b')
  assert.equal(of('focus').values.chosen, 'b', 'the chosen formation is held by the view, never sent')
  holds.resetHolds()
})

// ---------------------------------------------------------------------------------------------------------------- Quaternal Logic

// The person's M3 form as the installed QL answers it (REAL, tests/fixtures/ql-m3-state-2026-10-21.json: form 17 under moving and resting,
// with its generation law and the cells of all three matrices at hexagram 17), in the reception's envelope as m3_reception passes it.
const REAL_M3 = JSON.parse(readFileSync(new URL('./fixtures/ql-m3-state-2026-10-21.json', import.meta.url), 'utf8')).answer.state
/** QL's M1 engine's cells for family 0, each `ql kernel m1`'s own answer (REAL, tests/fixtures/ql-m1-family0-cells-2026-10-21.json). */
const REAL_M1 = JSON.parse(readFileSync(new URL('./fixtures/ql-m1-family0-cells-2026-10-21.json', import.meta.url), 'utf8'))
const identity = {selection_ref: 'nara-identity-selection:1', source: {source_ref: 'central:nara/identity/p1', revision: 'r9'},
  reading: {person_ref: 'person:p1', nara_ref: 'nara:p1'}}
const m3Of = (state = REAL_M3) => ({key: 'k', basis: {identity, expression: {expression_ref: 'expression:kept', revision: 3}}, busy: false, reason: null, view: {},
  reading: {schema: 'oi.m3-reception-context/v1', status: 'available', person_ref: 'person:p1', expression_ref: 'expression:kept', expression_revision: 3, state}})
const NO_M3 = {key: null, basis: null, reading: null, reason: 'No Nara identity is chosen: the M3 form is the person\'s own. Choose one in the Nara instrument.', busy: false, view: {}}
const MODES = {reading: {state: 'ready', catalogue: REAL_MODES.catalogue}, hold: {key: 'chromatic/L0\'/aeolian', root: 10}}
/** The chromatic basis's tonics, from the real catalogue (ql music modes --json, lens_cf: each lens's tonic for ionian … locrian). */
const CHROMATIC = [[0, 2, 4, 5, 7, 9, 11], [1, 3, 5, 6, 8, 10, 0], [2, 4, 6, 7, 9, 11, 1], [3, 5, 7, 8, 10, 0, 2], [4, 6, 8, 9, 11, 1, 3], [5, 7, 9, 10, 0, 2, 4],
  [6, 8, 10, 11, 1, 3, 5], [7, 9, 11, 0, 2, 4, 6], [8, 10, 0, 1, 3, 5, 7], [9, 11, 1, 2, 4, 6, 8], [10, 0, 2, 3, 5, 7, 9], [11, 1, 3, 4, 6, 8, 10]]
/** The kernel's ql_read answer for one cell, from the real family-0 matrix (owner_routes.rs ql_read: {route, data}). */
const m1Answer = op => {
  const {family, row12, col12} = op.request.request.config, [raw, dr, decimal] = REAL_M1.cells[row12][col12]
  return {outcome: {result: 'owner_route_reading', route: 'ql kernel m1', data: {schema: 'ql.m1.engine/v1', registry_revision: REAL_M1.registry_revision,
    cell: {family, row12, col12, raw, digit_root: dr, decimal10: decimal}}}}
}

test('the M3 clock reads the generation law and the cell of the form\'s hexagram from the real state, and chooses the matrix through set-matrix', () => {
  const values = m3c.qlM3Values(m3Of())
  assert.deepEqual([values['law.matrix'], values['law.seed'], values['law.poseMap']], ['moving-resting', 'sum-difference-mod', 'raw-bin'], 'QL\'s own names (form_cell.rs)')
  assert.deepEqual([values['generation.lower'], values['generation.upper'], values['generation.positive'], values['generation.negative'], values['generation.nonDual']],
    ['CT', 'CC', 'CCC', 'CTC', false], 'the cell, its codons under .sequence')
  assert.deepEqual(m3c.qlM3Operations(m3Of(), [{key: 'law.matrix', value: 'complementary'}]), [{operation: 'set-matrix', family: 0}], 'QL\'s order: complementary 0, moving and resting 1, same quality 2')
  assert.deepEqual(m3c.qlM3Operations(m3Of(), [{key: 'law.matrix', value: 'same-quality'}]), [{operation: 'set-matrix', family: 2}])
  assert.throws(() => m3c.qlM3Operations(m3Of(), [{key: 'law.matrix', value: 'diagonal'}]), /complementary, moving and resting, or same quality/)
  assert.throws(() => m3c.qlM3Operations(m3Of(), [{key: 'law.seed', value: 'four-charge'}]), /QL offers no operation that sets it/)
  const binding = m3c.qlM3Binding(m3Of())
  assert.equal(binding.writes('law.matrix'), true)
  assert.equal(binding.writes('generation.positive'), false)
  assert.deepEqual(Object.keys(m3c.QL_M3_ABSENT), [], 'no key lacks its owner now')
  const own = Object.fromEntries(Object.entries(DESIGNS.m3clock.defaults).filter(([key]) => key !== 'skin' && !key.startsWith('binding.')))
  const keys = classify({...DESIGNS.m3clock, defaults: own, fixtures: {}}, binding)
  assert.deepEqual(keys.absent.sort(), ['rack'], 'the rack, until it is read (qlRack.ts); the part is the view\'s own')
  // REPLACED (#725): "Skin and the Binding skin's `binding.` keys wait for qlM3Binding to carry them" — the rack now stands the M3 clock on its
  // binding carrying Binding's under `binding.` (§22.3 "The Binding skin"), and Skin is the clock's own choice (§22.3 Parameters: Wheel ·
  // Binding): every key of the design is classified on that binding, the skin's absences Binding's own.
  const carried = clockEntry(m3Of()).binding
  const all = classify(DESIGNS.m3clock, carried)
  assert.ok(all.local.includes('skin'), 'Skin is the clock\'s own choice')
  assert.equal(carried.writes('skin'), false, 'Skin writes to no owner')
  assert.deepEqual(all.absent.sort(), ['binding.coupling.alpha', 'binding.event.kind', 'binding.event.what', 'binding.m2.index', 'binding.nonet', 'binding.sound.stretchQ',
    'binding.string.energy', 'binding.string.stretch', 'binding.values.negative', 'binding.values.positive', 'rack'], 'the rack, and what Binding names absent with its route')
  assert.deepEqual(all.local.sort(), ['binding.charge.register', 'binding.coupling.scale', 'binding.nonets.show', 'binding.string.tension', 'open', 'rack.part', 'readout',
    'reciprocal', 'skin', 'turn'], 'the clock\'s view and Binding\'s own physics')
  for (const key of ['binding.nonet', 'binding.string.energy']) assert.equal(carried.standing[key].disabled, qlB.qlBindingBinding({m3: m3Of(), held: {}}).standing[key.slice('binding.'.length)].disabled, `${key}: Binding's own words`)
  assert.match(m3c.qlM3Binding(NO_M3).standing['law.matrix'].disabled, /No Nara identity is chosen/)
})

test('Binding draws the generation cell of the form\'s hexagram under its pairing, from the real state; the nonet, the events and its engine name their routes', () => {
  holds.resetHolds()
  const binding = qlB.qlBindingBinding({m3: m3Of(), held: {}})
  // REPLACED (#725): "keyed to its design" — Binding's design was retired; its binding keeps its holds under its own id.
  assert.equal(binding.id, qlB.QL_BINDING_DEVICE_ID)
  assert.deepEqual(binding.values, {'cell.hexagram': 17, 'pairing.matrix': 'moving-resting', 'cell.lower': 'CT', 'cell.upper': 'CC', 'cell.positive': 'CCC', 'cell.negative': 'CTC',
    'cell.nonDual': false, 'charges.positive': '[24,-8,8,8]', 'charges.negative': '[25,-9,7,9]'}, 'until a pairing is held, the matrix the form\'s law is read under')
  // Another pairing reads that matrix's cell, one of the three the state carries; Binding writes nothing to the form.
  binding.local['pairing.matrix']('complementary')
  const singlet = qlB.qlBindingBinding({m3: m3Of(), held: holds.heldFor(qlB.QL_BINDING_DEVICE_ID)})
  assert.deepEqual([singlet.values['cell.lower'], singlet.values['cell.positive'], singlet.values['cell.negative'], singlet.values['cell.nonDual']], ['GC', 'GCC', 'GCC', true],
    'complementary at hexagram 17 is non-dual: a singlet')
  // REPLACED (#725): classified against Binding's own design, retired — against the M3 clock's Binding skin, the keys the clock draws under
  // `binding.` (§22.3). Binding's on and off is the clock's Skin now (§22.3 "The clock's Skin chooses Wheel or Binding"), so the skin has no
  // `on` of its own.
  const keys = classify(skinOf(DESIGNS.m3clock), binding)
  assert.deepEqual(keys.local.sort(), [...qlB.QL_BINDING_LOCAL].filter(key => key !== 'pairing.matrix' && key !== 'binding.on').sort(), 'its own physics and choices are the view\'s (the pairing reads as the law\'s until held)')
  for (const key of ['values.positive', 'values.negative']) assert.match(binding.standing[key].disabled, /names each codon's sequence and charges, not its sites' coin values/, key)
  assert.match(binding.standing.nonet.disabled, /ql_m3_epogdoon/)
  assert.match(binding.standing['event.kind'].disabled, /an inscription, a matrix change, a line change/)
  assert.match(binding.standing['string.energy'].disabled, /Binding's string engine/)
  // REPLACED (#725): Binding's own controls, Skin among them disabled — the skin's controls on the M3 clock (§22.3); Skin is the clock's own.
  const controls = controlStanding(binding, skinSetKeys())
  assert.deepEqual(controls.disabled.sort(), ['sound.stretchQ'])
  assert.deepEqual(controls.written, [], 'Binding writes to no owner')
  const onClock = controlStanding(clockEntry(m3Of()).binding, skinSetKeys().map(key => `binding.${key}`))
  assert.deepEqual([onClock.disabled, onClock.written], [['binding.sound.stretchQ'], []], 'the same on the M3 clock that carries the skin')
  const none = qlB.qlBindingBinding({m3: NO_M3, held: {}})
  assert.equal(none.values['cell.positive'], undefined)
  for (const key of ['cell.hexagram', 'cell.positive', 'charges.negative']) assert.match(none.standing[key].disabled, /No Nara identity is chosen/, key)
  holds.resetHolds()
})

test('the M′ matrices read the real mode catalogue, the mode in force, the M3 form and QL\'s M1 engine\'s cells; the partners and the kernel\'s operators name their routes', async () => {
  holds.resetHolds()
  m1.resetQlM1()
  const set = [], applied = []
  const writers = {setHold: patch => set.push(patch), applyM3: async ops => { applied.push(ops) }}
  const state = {m3: m3Of(), modes: MODES, held: {}}
  const binding = qlMx.qlMatricesBinding(state, writers)
  assert.equal(binding.id, designKey('quaternal-logic', 'm-prime-matrices'))
  assert.deepEqual(JSON.parse(binding.values['m2.tonics']), CHROMATIC, 'the tonics of the basis in force, lens by lens')
  assert.equal(binding.values['m1.basis'], 'chromatic', 'until held, the basis is the mode in force\'s')
  assert.deepEqual([binding.values['m1.lens12'], binding.values['m1.context_frame'], binding.values['form.address']], [1, 6, 17], 'L0′ at CF6, aeolian; the form in force')
  assert.deepEqual([binding.values['m1.family'], binding.values['m1.row12'], binding.values['m1.col12']], [5, 3, 4], 'the engine opens where QL\'s example request does')
  assert.match(binding.standing['m1.cells'].disabled, /The engine opens on the Quintessence/)
  assert.match(binding.standing['m1.tick12'].disabled, /no M1 clock|nothing in the shell keeps an M1 clock/)
  const keys = classify(DESIGNS.matrices, binding)
  assert.deepEqual(keys.reading.sort(), ['form.address', 'form.matrix', 'm1.basis', 'm1.col12', 'm1.context_frame', 'm1.family', 'm1.lens12', 'm1.row12', 'm2.tonics'])
  // #757: the matrix the form stands under is the M3 state's own (form.matrix_axis 1, QL's MatrixFamily::ALL order).
  assert.equal(binding.values['form.matrix'], 'moving-resting')
  assert.match(binding.standing['m3.codons'].disabled, /`ql kernel m3`/)
  for (const key of ['form.partners', 'form.partner', 'form.scale']) assert.match(binding.standing[key].disabled, /ql_m3_apply_matrix/, key)
  for (const key of ['kernel.conjugate', 'kernel.class', 'kernel.version', 'kernel.depth', 'kernel.form']) assert.match(binding.standing[key].disabled, /Choose a position and a face/, key)
  const controls = controlStanding(binding, setKeysOf('quaternal-logic__m-prime-matrices.tsx'))
  assert.deepEqual(controls.written.sort(), ['form.address', 'form.apply', 'm1.context_frame', 'm1.lens12'], 'Apply writes m3_reception\'s apply-matrix (#757)')
  assert.deepEqual(controls.local.sort(), ['kernel.face', 'kernel.position', 'm1.basis', 'm1.col12', 'm1.family', 'm1.row12', 'matrix', 'valueForm'])
  assert.deepEqual(controls.disabled.sort(), ['form.partner', 'form.scale'])
  await binding.write([{key: 'm1.lens12', value: 3}, {key: 'm1.context_frame', value: 2}, {key: 'form.address', value: 40}])
  assert.deepEqual(set, [{root: 5, key: 'chromatic/L1\'/dorian'}])
  assert.deepEqual(applied, [[{operation: 'select-form', address: 40}]])
  // Apply: m3_reception's own apply-matrix {family}, under the matrix the form stands under (#757).
  await binding.write([{key: 'form.apply', value: 'moving-resting'}])
  assert.deepEqual(applied.at(-1), [{operation: 'apply-matrix', family: 1}])
  await assert.rejects(binding.write([{key: 'form.apply', value: 'sideways'}]), /one of QL's three matrices/)
  assert.match(qlMx.qlMatricesBinding({m3: NO_M3, modes: MODES, held: {}}, writers).standing['form.apply'].disabled, /No Nara identity is chosen/, 'no form: Apply says why')
  // Choosing a family reads its 144 cells from QL's M1 engine, one `ql kernel m1` each, through the kernel's ql_read.
  const asked = []
  m1.resetQlM1({call: async op => { asked.push(op); return m1Answer(op) }})
  binding.local['m1.family'](0)
  await m1.syncQlM1(0)
  assert.equal(asked.length, 144)
  assert.deepEqual(asked[0], {op: 'ql_read', request: {kind: 'kernel-m1', request: m1.m1Request(0, 0, 0)}})
  assert.equal(asked[0].request.request.config.selected_coordinate, '#1-2-0', 'the family\'s own coordinate, as QL names a cell\'s')
  const read = qlMx.qlMatricesBinding({...state, held: holds.heldFor(qlMx.QL_MATRICES_DEVICE_ID), m1: m1.qlM1State()}, writers)
  assert.deepEqual(JSON.parse(read.values['m1.cells']), REAL_M1.cells, 'the family\'s matrix, cell by cell, as QL answered')
  await m1.syncQlM1(0)
  assert.equal(asked.length, 144, 'a family read once is kept for the session')
  m1.resetQlM1({call: async () => ({outcome: null, error: 'ql: missing field `schema` at line 1 column 2'})})
  await m1.syncQlM1(2)
  const refused = qlMx.qlMatricesBinding({...state, held: {'m1.family': 2}, m1: m1.qlM1State()}, writers)
  assert.match(refused.standing['m1.cells'].disabled, /QL's M1 engine refused: ql: missing field `schema`/)
  // The basis is the view's: held, the Reading reads the other order the owner serves.
  const fifths = qlMx.qlMatricesBinding({...state, held: {'m1.basis': 'fifths'}}, writers)
  assert.deepEqual(JSON.parse(fifths.values['m2.tonics'])[1], [6, 8, 10, 11, 1, 3, 5], 'L0′ in the fifths basis')
  const bare = qlMx.qlMatricesBinding({m3: NO_M3, modes: {...MODES, hold: {key: null, root: 0}}, held: {}}, writers)
  assert.equal(bare.values['m2.tonics'], undefined)
  assert.match(bare.standing['m1.lens12'].disabled, /Choose a basis first/)
  assert.match(bare.standing['form.address'].disabled, /No Nara identity is chosen/)
  m1.resetQlM1()
  holds.resetHolds()
})

test('Binding and the M′ matrices draw on their bindings in every view and page — no NaN, no undefined, never their fixtures — and each refusal says why', () => {
  holds.resetHolds()
  // REPLACED (#725): Binding drawn by its own design — retired; the M3 clock draws it as its Binding skin, on the binding that carries
  // Binding's (§22.3), on the clock's Binding page.
  const binding = clockEntry(m3Of()).binding
  const boundAll = drawsClean(DESIGNS.m3clock, binding, /inscribed|Complementary to moving and resting|Line 5 of hexagram|0\.573|1\.176/, ['binding'])
  assert.ok(boundAll.includes('CT under CC'), 'the form\'s cell')
  // REPLACED (#725): "Skin names its missing route" — the manual made Skin the M3 clock's own setting (§22.3 Parameters: "Skin | Wheel ·
  // Binding | Wheel"), so it is held by the view, never refused.
  assert.equal(typeof binding.local.skin, 'function', 'Skin is the view\'s to choose')
  assert.ok(boundAll.includes(escaped(qlB.QL_BINDING_ABSENT['sound.stretchQ'])), 'Stretch → Q names its missing route')
  const matrices = qlMx.qlMatricesBinding({m3: m3Of(), modes: MODES, held: {}})
  const matrixAll = drawsClean(DESIGNS.matrices, matrices, /qladdr:sixfold@1|>explicate<|>implicate<|0\.1\.0-q1/, ['matrix', 'kernel'])
  assert.ok(matrixAll.includes('No reading of the oscillator'), 'the Quintessence\'s matrix is not read until a family is chosen')
  assert.ok(matrixAll.includes('No address'), 'the kernel page with no address held says so')
  holds.resetHolds()
})

test('today\'s centres: the installed ql\'s scene names no centre and is refused in words; the centres QL-MEF #345 composes draw on the Chakra and stand in the sitting\'s binding', async () => {
  const chakra = await import(src('inhabitants/ql/devices/qlChakra.ts'))
  const sittingMod = await import(src('inhabitants/ql/devices/qlSitting.ts'))
  const centresMod = await import(src('inhabitants/ql/devices/qlCentres.ts'))
  const deck = await import(src('inhabitants/ql/devices/qlDeck.ts'))
  const envelope = data => ({outcome: {result: 'owner_route_reading', data}})
  // REAL: the installed ql's `ql scene compose` names each centre only by its reference, anatomy and planets.
  const installed = JSON.parse(readFileSync(new URL('./fixtures/ql-scene-compose-2026-10-21.json', import.meta.url), 'utf8')).answer
  for (const centre of installed.centres) assert.deepEqual(Object.keys(centre).sort(), ['anatomy', 'centre_ref', 'receiving'], 'the scene\'s centre, as the installed ql answers it')
  assert.deepEqual(centresMod.readCentresAnswer(envelope(installed), installed.snapshot_ref), {ok: false, reason: centresMod.NO_NAMED_CENTRES})
  assert.match(centresMod.NO_NAMED_CENTRES, /QL-MEF #345/)
  // The centres QL-MEF #345 composes for its dated sky (fixture: the PR's scene::compose output), in the kernel's envelope for a route reading.
  const pr = JSON.parse(readFileSync(new URL('./fixtures/ql-scene-centres-pr345-2026-10-21.json', import.meta.url), 'utf8'))
  const scene = {schema: 'ql.scene/v1', snapshot_ref: pr.sky.snapshot_ref, epoch_utc: pr.sky.epoch_utc, centres: pr.centres, decan_held: pr.decan_held}
  assert.equal(centresMod.readCentresAnswer(envelope(scene), 'sha256:another-sky').ok, false, 'a scene of another sky is refused')
  const calls = []
  centresMod.resetQlCentres({call: async op => { calls.push(op); return envelope(scene) }})
  const snapshot = {schema: 'ql.sky-snapshot/v1', snapshot_ref: pr.sky.snapshot_ref, epoch_utc: pr.sky.epoch_utc, bodies: []}
  const sky = {snapshotRef: pr.sky.snapshot_ref, epochUtc: pr.sky.epoch_utc, epochMs: Date.parse(pr.sky.epoch_utc), bodies: [], status: 'available', snapshot}
  await centresMod.syncQlCentres(sky)
  await centresMod.syncQlCentres(sky)
  assert.equal(calls.length, 1, 'one scene for one sky')
  assert.deepEqual(calls[0], {op: 'ql_read', request: {kind: 'scene-compose', request: {schema: 'ql.scene-request/v1', tick12: 0, cycle: 0, sky_snapshot: snapshot}}},
    'the Sky\'s own snapshot, verbatim, with the scene\'s opening tick and cycle')
  const state = centresMod.qlCentresState()
  assert.equal(state.reading.ok, true)
  const drawn = JSON.parse(chakra.qlChakraValues(chakra.qlChakraState(), {reading: null}, state).centres)
  assert.deepEqual(drawn.map(c => c.name), ['Mūlādhāra', 'Svādhiṣṭhāna', 'Maṇipūra', 'Anāhata', 'Viśuddha', 'Ājñā', 'Sahasrāra'])
  assert.deepEqual(drawn.map(c => c.element), ['Prithvi Tattva', 'Jala Tattva', 'Agni Tattva', 'Vayu Tattva', 'Akasha Tattva', null, null], 'the tattva QL names, never a word the shell picks')
  assert.equal(drawn[0].mantra, 'LAM - earth element activation', 'the map\'s words, verbatim')
  assert.deepEqual([drawn[0].own, drawn[0].decan, drawn[6].decan], [['Saturn'], ['Mars'], ['Saturn']], 'receiving is the own route; decan the reception\'s')
  assert.ok(drawn.every(c => !('petals' in c)), 'QL holds no petal count, so none is drawn')
  const chakraBinding = chakra.qlChakraBinding(chakra.qlChakraState(), {reading: null}, state)
  assert.equal(chakraBinding.values.reason, undefined, 'with the centres read, nothing says they are missing')
  assert.equal(chakraBinding.standing.centres.disabled, chakra.CENTRES_READ)
  const chakraDesign = (await import(src('inhabitants/catalogue/panels/quaternal-logic__chakra.tsx'))).design
  const chakraAll = drawsClean(chakraDesign, chakraBinding, /Svādhiṣṭhāna.*VAM<|>VAM</)
  assert.ok(chakraAll.includes('Mūlādhāra') && chakraAll.includes('Prithvi Tattva'), 'the Chakra draws QL\'s centre and tattva')
  const sitting = sittingMod.qlSittingBinding(sittingMod.qlSittingState(), state)
  assert.deepEqual(JSON.parse(sitting.values.centres).map(c => [c.ordinal, c.name]).slice(0, 2), [[1, 'Mūlādhāra'], [2, 'Svādhiṣṭhāna']])
  // DELETED (#725): the Sitting's design drawn on that binding — the manual removed the Sitting as a device (§24.3: "A sitting is a clip of
  // the practice world's track (§24.1): its length, its bell and its intervals stand in its Clip panel, and Play rings the bell and begins");
  // its design is retired and the centres stand in its binding's own values (above).
  // With no sky, or the installed ql's scene, the centres stand absent with the reason.
  centresMod.resetQlCentres({call: async () => envelope(installed)})
  await centresMod.syncQlCentres({...sky, snapshotRef: installed.snapshot_ref, snapshot: {...snapshot, snapshot_ref: installed.snapshot_ref}})
  const none = chakra.qlChakraBinding(chakra.qlChakraState(), {reading: null}, centresMod.qlCentresState())
  assert.equal(none.values.centres, undefined)
  assert.equal(none.standing.centres.disabled, centresMod.NO_NAMED_CENTRES)
  assert.equal(sittingMod.qlSittingBinding(sittingMod.qlSittingState(), centresMod.qlCentresState()).standing.centres.disabled, centresMod.NO_NAMED_CENTRES)
  centresMod.resetQlCentres()
  const binding = deck.qlDeckBinding(deck.qlDeckState(), m3Of())
  assert.equal(binding.values['m3.card'], 'Ten of Wands', 'the real form\'s tarot, in the kernel\'s register')
})

test('the Deck reads the cast hexagram\'s cell from QL\'s generation law, asked of the M3 state as a read with generation_at; the Matrix chooses among its three cells', async () => {
  const deck = await import(src('inhabitants/ql/devices/qlDeck.ts'))
  const m3Mod = await import(src('inhabitants/ql/devices/qlM3Clock.ts'))
  // REAL: `ql kernel m3` answered generation_at [{hexagram: 23}] beside the state (tests/fixtures/ql-m3-state-2026-10-21.json).
  const real = JSON.parse(readFileSync(new URL('./fixtures/ql-m3-state-2026-10-21.json', import.meta.url), 'utf8'))
  assert.deepEqual(real.input.generation_at, [{hexagram: 23}])
  const basis = {identity: {selection_ref: 'sel:1', source: {source_ref: 'nara:identity:1', revision: 'r1'}, reading: {person_ref: 'person:1', nara_ref: 'nara:1'}},
    expression: {expression_ref: 'expr:1', revision: 3}}
  const reception = extra => ({outcome: {result: 'm3_reception', data: {schema: 'oi.m3-reception-context/v1', status: 'available', expression_ref: 'expr:1', expression_revision: 3,
    person_ref: 'person:1', identity_revision: 'r1', state: real.answer.state, ...extra}}})
  const m3 = {key: 'k1', basis, reading: reception().outcome.data, reason: null, busy: false, view: {}}
  // A cast whose lines read hexagram 23 from the bottom (QL's journey: bit 0 the bottom line): 7 7 7 8 7 8.
  const cast = {result: {reading: {status: 'open', concern: {title: 'q'}, spreads: [], symbolic_assignments: [], deck: {dealt: 0},
    iching: [{reading_ref: 'i1', lines: [7, 7, 7, 8, 7, 8], primary: 23, changing_mask: 0, resulting: null, nuclear: 0, day_ref: 'd'}]}}, journey: null, reason: null, busy: false, view: {}}
  assert.equal(deck.castHexagramOf(cast), 23)
  const calls = []
  deck.resetQlDeck({call: async op => { calls.push(op); return reception({generation_at: real.answer.generation_at}) }})
  deck.resetDeckCast()
  await deck.syncDeckCast(cast, m3)
  await deck.syncDeckCast(cast, m3)
  assert.equal(calls.length, 1, 'one ask for one cast under one state')
  assert.deepEqual(calls[0].request, {operation: 'read', generation_at: [{hexagram: 23}], binding: m3Mod.m3Binding(basis)}, 'QL\'s own spelling, on the encounter\'s binding')
  const state = deck.qlDeckCastState()
  const binding = deck.qlDeckBinding(cast, m3, state)
  assert.equal(binding.values.matrix, 'moving-resting', 'the M3 state\'s own matrix, until you choose one')
  assert.deepEqual(JSON.parse(binding.values.generation), {hexagram: 23, lower: 'TT', upper: 'CC', positive: 'TCC', negative: 'TTC', nonDual: false}, 'QL\'s cell, its codons under .sequence')
  assert.equal(typeof binding.local.matrix, 'function', 'the Matrix is the view\'s own choice among the three cells')
  const chosen = deck.qlDeckBinding({...cast, view: {matrix: 'complementary'}}, m3, state)
  const cell = real.answer.generation_at[0].cells.find(c => c.matrix.family === 'complementary')
  assert.equal(JSON.parse(chosen.values.generation).lower, cell.lower_pair.sequence, 'another matrix is another of the reading\'s cells, not another ask')
  assert.equal(calls.length, 1)
  // Refusals: no cast, no M3 form, another hexagram answered.
  deck.resetDeckCast()
  await deck.syncDeckCast({...cast, result: {...cast.result, reading: {...cast.result.reading, iching: []}}}, m3)
  assert.equal(deck.qlDeckBinding(cast, m3, deck.qlDeckCastState()).standing.generation.disabled, deck.NO_CAST)
  await deck.syncDeckCast(cast, {...m3, reading: null, reason: 'No Nara identity is chosen.'})
  assert.match(deck.qlDeckCastState().reason, /read from your M3 state: No Nara identity is chosen/)
  assert.equal(deck.readCastCell(real.answer.generation_at, 24).ok, false, 'a cell of another hexagram is refused')
  deck.resetDeckCast(); deck.resetQlDeck()
})

test('the Rack pages read their instrument\'s rack from the map\'s ledger: positions and parts by the registry\'s names, the three steps from each coordinate\'s own view, the device and control from the instrument\'s entry', async () => {
  const rackMod = await import(src('inhabitants/ql/devices/qlRack.ts'))
  const ledger = JSON.parse(readFileSync(new URL('./fixtures/ql-kernel-ledger-m3-rack-2026-10-21.json', import.meta.url), 'utf8'))
  const asked = []
  rackMod.resetQlRack({call: async op => {
    asked.push(op.request.coordinate)
    const view = ledger.views[op.request.coordinate]
    return view && !view.refused ? {outcome: {result: 'owner_route_reading', data: view}} : {outcome: null, error: view?.refused ?? 'unknown'}
  }})
  await rackMod.readQlRack(3)
  assert.deepEqual(asked.slice(0, 7), ['#3', '#3-0', '#3-1', '#3-2', '#3-3', '#3-4', '#3-5'], 'the instrument, then its positions, then their parts')
  const state = rackMod.qlRackState(3)
  assert.equal(state.reason, null)
  const rack = JSON.parse(state.rack)
  assert.deepEqual([rack.instrument, rack.coordinate, rack.name, rack.face], ['M3′', '#3', 'Mahamaya', 'quaternal-logic:m3-clock'])
  assert.deepEqual(rack.positions.map(p => p.name), ['Quaternionic Reception & Parashakti Integration Matrix', 'I-Ching System', 'Genetic Code Architecture',
    'Mahamaya Universal Transcription Engine', 'Minor Arcana', 'The 360° Mythic Synthesis Wheel'], 'the registry\'s names')
  assert.equal(rack.positions[1].parts.length, 8, 'the I Ching\'s eight trigrams, as the registry holds them')
  assert.deepEqual(rack.positions[4].parts.map(p => p.ref), ['#3-4-1', '#3-4-2', '#3-4-3', '#3-4-4', '#3-4-5/0', '#3-4.0'], 'the map\'s own segments, kept')
  assert.deepEqual(rack.positions[3].ledger, [true, true, true], 'the transcription engine: in the map, bound, verified (a row on it verified in C or Rust)')
  assert.deepEqual(rack.positions[1].ledger, [true, true, false], 'the I Ching: in the map, bound, not verified')
  assert.deepEqual(rack.positions[1].parts[0].ledger, [true, true, true], 'Qian: verified in C or Rust')
  // REPLACED (#725): position 0 (the reception) was worked in Binding — the nonets are the M3 clock's Binding skin now (§22.3 position 0:
  // "The nonets of the clock's Binding skin"; qlRack.ts RACK_CARRIED).
  assert.deepEqual(rack.positions.map(p => p.device), ['quaternal-logic:m3-clock', 'quaternal-logic:deck', 'quaternal-logic:m-prime-matrices', 'quaternal-logic:m3-clock',
    'quaternal-logic:deck', 'quaternal-logic:m3-clock'], 'the M3 clock\'s entry, "Where you work it"')
  // The M3 clock's Rack page draws it; the part is the view's own, the manual's 1 until chosen.
  const binding = m3c.qlM3Binding(m3Of(), state)
  assert.equal(binding.values['rack.part'], '1')
  assert.equal(binding.standing.rack.disabled, rackMod.RACK_READ)
  // The design's own fixture words for where a part is worked (its RACK_M3); the binding's are the manual's.
  const all = drawsClean(DESIGNS.m3clock, binding, /I Ching, Hexagram|Law and Generation|The wheel, Resonator bank/, ['wheel', 'binding', 'rack'])
  assert.ok(all.includes('Minor Arcana') && all.includes('I-Ching System'), 'the rack draws the registry\'s names')
  binding.local['rack.part']('4')
  assert.equal(m3c.qlM3Binding(m3Of(), rackMod.qlRackState(3)).values['rack.part'], '4')
  // Where both spellings are held, the nesting threshold's is kept (after a 4 the separator is ".").
  const kids = [{source_ref: '#4-0', local_segment: '0', separator: '-', name: 'a'}, {source_ref: '#4.0', local_segment: '0', separator: '.', name: 'a'},
    {source_ref: '#4-6', local_segment: '6', separator: '-', name: 'b'}]
  assert.deepEqual(rackMod.rackChildren('4', kids).map(c => c.source_ref), ['#4.0', '#4-6'])
  assert.deepEqual(rackMod.rackChildren('5', kids).map(c => c.source_ref), ['#4-0', '#4-6'])
  // REAL (the kernel's own capture, the installed ql): its view names children by id only, so the rack stands absent with the reason.
  const installed = JSON.parse(readFileSync(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/ql-kernel-ledger-2026-10-21.json', import.meta.url), 'utf8')).answer
  assert.equal('child_coordinates' in installed, false)
  rackMod.resetQlRack({call: async () => ({outcome: {result: 'owner_route_reading', data: {...installed, coordinate: {...installed.coordinate, source_ref: '#1'}}}})})
  await rackMod.readQlRack(1)
  assert.equal(rackMod.qlRackState(1).reason, rackMod.NO_CHILD_REFS)
  const torusModel = await import(src('live/torusDevice.ts'))
  const torusBinding = torusModel.torusDesignBinding(null, undefined, {}, null, rackMod.qlRackState(1))
  assert.equal(torusBinding.standing.rack.disabled, rackMod.NO_CHILD_REFS)
  assert.equal('rack' in torusBinding.values, false)
  rackMod.resetQlRack()
})

test('the Timeline reads the chronology\'s relation links and card categories as the frame announces them, and sets them through its commands', async () => {
  const frameB = await import(src('techne/devices/frameBindings.ts'))
  const runs = []
  const ruler = {projection: 'chronology', events: [], edges: [], views: [{id: 'War', label: 'War'}], centre: 1600, zoom: 2, links: true, hiddenCategories: ['myth']}
  const frame = {state: {lens: 'timeline', research: {timeline: ruler}}, run: async command => { runs.push(command); return {ok: true} }, window: undefined}
  const law = {yearOf: () => null, instantOf: year => String(year), write: () => null}
  const binding = frameB.timelineBinding(frame, law)
  assert.deepEqual([binding.values.links, binding.values.cat_source, binding.values.cat_myth, binding.values.cat_claim], [true, true, false, true])
  await binding.write([{key: 'cat_myth', value: true}, {key: 'cat_claim', value: false}])
  await binding.write([{key: 'links', value: false}, {key: 'links', value: true}])
  assert.deepEqual(runs, [{command: 'timeline', action: 'categories', hidden: ['claim']}, {command: 'timeline', action: 'links', on: false}],
    'one categories command for the set; links already standing is not sent again')
  const drawnElsewhere = frameB.timelineBinding({...frame, state: {lens: 'timeline', research: {timeline: {...ruler, links: undefined, hiddenCategories: undefined}}}}, law)
  assert.match(drawnElsewhere.standing.links.disabled, /The chronology is not drawn now/)
})

test('(d) the Binding skin and the M′ matrices are admitted where §22 and §16.16 put them: on the Journey through the M3 clock, on the app layers\' racks', () => {
  const faces = inhabitantManifest('quaternal-logic').faces
  const clock = faces.find(face => face.id === 'm3-clock'), matrices = faces.find(face => face.id === 'm-prime-matrices')
  assert.ok(clock && matrices)
  // REPLACED (#725): Binding admitted as a face of its own, held by the Journey and the Studio's body — it is the M3 clock's Binding skin
  // now (§22.8; §22.3 "the Torus and the Studio's body chain can draw the same skin"): the Journey holds it through the clock.
  assert.equal(faces.find(face => face.id === 'binding'), undefined, 'no Binding face')
  assert.equal(clock.admission, undefined, 'the M3 clock, which carries the skin, is admitted')
  assert.ok(clock.heldBy.includes('techne:m3'), 'the Journey holds the clock')
  assert.equal(matrices.admission, undefined, 'the matrices are admitted (quaternalLogicFamilyManifest.ts: no longer "waiting")')
  // REPLACED (#801): held by techne:m1–m4, Technē's instruments standing in for the app layers. Their layers are the insides of the
  // racks of the Torus (M1′), the Sky (M2′), the M3 clock (M3′) and the Chakra (M4′) (§22.6, §16.16).
  assert.deepEqual(matrices.heldBy, ['rack:torus', 'rack:sky', 'rack:m3-clock', 'rack:chakra'])
  assert.ok(!matrices.heldBy.some(holder => holder.startsWith('techne:')), 'no Technē instrument holds the matrices')
  for (const design of [DESIGNS.m3clock, DESIGNS.matrices]) {
    assert.equal(design.views, undefined, `${design.id}: an instrument, every view`)
    for (const view of views) assert.equal(host.viewIn(design, view), view, `${design.id} ${view}`)
  }
  const entries = chain.techneEntries([inhabitantManifest('quaternal-logic')], {atlas: null, surface: null, torus: null, instrumentReading: null,
    m3: m3Of(), modes: MODES, held: {}})
  for (const id of ['quaternal-logic:m3-clock', 'quaternal-logic:m-prime-matrices']) {
    const entry = entries.find(item => item.device.id === id)
    assert.ok(entry?.binding, `${id}: on the chain with its binding, not a waiting device`)
    assert.equal(`${entry.device.family}:${entry.device.face.id}`, id, `${id}: the door draws its catalogue design`)
  }
  assert.ok('binding.cell.hexagram' in entries.find(item => item.device.id === 'quaternal-logic:m3-clock').binding.values, 'the clock carries the Binding skin\'s readings')
  assert.ok(!entries.some(item => item.device.id === 'quaternal-logic:binding'), 'no Binding device on the rack')
  const journey = entries.filter(entry => entry.face.heldBy?.includes('techne:m3')).map(entry => entry.face.id)
  for (const face of ['m3-clock', 'deck']) assert.ok(journey.includes(face), `the Journey holds ${face}`)
  const m3Rack = entries.filter(entry => entry.face.heldBy?.includes('rack:m3-clock')).map(entry => entry.face.id)
  assert.deepEqual(m3Rack, ['m-prime-matrices'], 'the M3 clock\'s rack holds the M′ matrices, whose Form is M3′')
})

// ---------------------------------------------------------------------------------------------------------------- the Torus's stage

test('the Torus on Live\'s chain reads the stage the frame announces as a dependency of its binding, so a disclosure redraws the Stage page when it comes', () => {
  const source = read('live/TorusOnChain.tsx')
  assert.match(source, /const stage = chrome\?\.state\?\.instrumentStage \?\? null\n\s*const run = chrome\?\.run \?\? null\n\s*const rack = useQlRack\(1\)/)
  assert.match(source, /return useMemo\(\(\) => torusDesignBinding\(state, device, skyHeldTorusKeys\(plan\), stage, rack, run, held \?\? \{\}, condition, tattvaName, table\),\n\s*\[state, device, plan, stage, rack, run, held, condition, tattvaName, table\]\)/,
    'the stage, the frame\'s runner, M1′\'s rack, the Stage page\'s holds, the announced condition with its map name and M2\'s body constants are dependencies of the binding')
  assert.match(source, /const binding = useTorusChainBinding\(state, device\)/)
  const stage = slots => readFrameStage({subject: 'ql:subject:live', generation: 7, stale: false, slots, bindings: []})
  const device = torusDevice.torusDevice(null)
  let seen = null
  const Probe = () => { seen = onChain.useTorusChainBinding(null, device); return null }
  pane.publishHostedChrome({state: {instrumentStage: stage([{slot: 'form'}])}, run: null, faults: []})
  renderToStaticMarkup(h(Probe))
  assert.deepEqual(JSON.parse(seen.values['stage.slots']), [{slot: 'form'}])
  pane.publishHostedChrome({state: {instrumentStage: stage([{slot: 'form', owner: 'ta-onta:stage:cli-fold', revision: 1}, {slot: 'clock.lensing'}])}, run: null, faults: []})
  renderToStaticMarkup(h(Probe))
  assert.deepEqual(JSON.parse(seen.values['stage.slots']).map(slot => slot.slot), ['form', 'clock.lensing'], 'the new stage, with the same torus and device')
  pane.publishHostedChrome(null)
})

test('the M′ matrices\' Kernel page reads the kernel\'s three operators on the address you hold, through ql_read kernel-apply (REAL answers)', async () => {
  const kernel = await import(src('inhabitants/ql/devices/qlKernelApply.ts'))
  const real = JSON.parse(readFileSync(new URL('./fixtures/ql-kernel-apply-2026-10-21.json', import.meta.url), 'utf8'))
  const answers = new Map(real.cases.map(c => [`${c.operator} ${c.address}`, {outcome: {result: 'owner_route_reading', data: c.answer}}]))
  const asked = []
  kernel.resetKernelApply({call: async op => { asked.push(op.request); return answers.get(`${op.request.operator} ${op.request.address}`) ?? {outcome: null, error: 'no capture'} }})
  assert.equal(kernel.kernelAddressOf({}), null, 'no position or face: nothing is asked')
  const held = {'kernel.position': 2, 'kernel.face': 'direct'}
  await kernel.syncKernelApply(held)
  await kernel.syncKernelApply(held)
  assert.deepEqual(asked, kernel.KERNEL_OPERATORS.map(operator => ({kind: 'kernel-apply', operator, address: 'qladdr:sixfold@1/direct/P2/d0'})), 'three operators, once, on the sixfold address at the ground depth')
  const binding = qlMx.qlMatricesBinding({m3: m3Of(), modes: MODES, held, kernel: kernel.kernelApplyState()})
  assert.deepEqual(['kernel.conjugate', 'kernel.complement', 'kernel.class', 'kernel.version', 'kernel.form', 'kernel.depth'].map(key => binding.values[key]),
    ['qladdr:sixfold@1/conjugate/P2/d0', 'qladdr:sixfold@1/direct/P3/d0', 'explicate', '0.1.0-q1', 'sixfold@1', 0], 'the kernel\'s own answers')
  assert.match(binding.standing['kernel.class'].disabled, /A reading/)
  for (const key of ['kernel.position', 'kernel.face']) assert.equal(typeof binding.local[key], 'function', `${key}: the address is yours`)
  const markup = drawsClean(DESIGNS.matrices, binding, /Kernel, the ground conjugate/, ['kernel'])
  assert.ok(markup.includes('explicate'), 'the class is drawn')
  // Another address asks again; the frame position 0 on the conjugate face is implicate.
  await kernel.syncKernelApply({'kernel.position': 0, 'kernel.face': 'conjugate'})
  assert.equal(kernel.kernelValues(kernel.kernelApplyState())['kernel.class'], 'implicate')
  // An answer for another address is refused; with no address held the page says so.
  assert.equal(kernel.readKernelApply(answers.get('conjugate-address qladdr:sixfold@1/direct/P2/d0'), 'conjugate-address', 'qladdr:sixfold@1/direct/P3/d0').ok, false)
  const none = qlMx.qlMatricesBinding({m3: m3Of(), modes: MODES, held: {}, kernel: kernel.kernelApplyState()})
  assert.equal(none.values['kernel.conjugate'], undefined)
  assert.equal(none.standing['kernel.conjugate'].disabled, kernel.NO_ADDRESS)
  kernel.resetKernelApply({call: async () => ({outcome: null, error: real.refusal.stderr})})
  await kernel.syncKernelApply(held)
  assert.equal(kernel.kernelApplyState().reading.reason, 'ql: unsupported QL address frame: four-plus-two@1', 'a refusal stands in the kernel\'s words')
  kernel.resetKernelApply()
})
