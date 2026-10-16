import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// T-DEVICES-EXPRESSIONS: the Expressions field devices (physics, pointer, relational, medium, contacts, morph, focus, colour, ink,
// depth, resonance) as devices of the runtime — compact on the rack, whole in the pool, full in a pane — all through DeviceView,
// over the retained editor's reading and its one apply. Loader as live-browser-chain.test.mjs.
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
const model = await import('../src/components/devices/expressionsDevice.ts')
const sender = await import('../src/components/devices/fieldDeviceSend.ts')
const publication = await import('../src/components/devices/devicePublication.ts')
const views = await import('../src/components/devices/ExpressionsDeviceView.tsx')
const picture = await import('../src/components/devices/ExpressionsPicture.tsx')
const rackModule = await import('../src/components/NativeDeviceRack.tsx')
const runtime = await import('../src/frame/devices/deviceRuntime.ts')
const door = await import('../src/frame/devices/deviceDoor.ts')
const instruments = await import('../src/frame/instrumentDoor.ts')
const {DeviceView} = await import('../src/frame/devices/DeviceView.tsx')
const {DeviceFullPane} = await import('../src/frame/devices/devicePane.tsx')
const deviceHost = await import('../src/frame/devices/deviceHost.tsx')
/** A whole plate on every one of its pages (DEVICE-UI §1: "When a panel holds more than fits, it gets pages in its head"): the host
 * keeps the shown page per device, so each page is drawn by turning it there. */
const everyPage = (id, draw) => {
  const pages = []
  for (let at = 1; at <= 8; at++) {
    deviceHost.setHostPage(id, `p${at}`)
    const html = draw()
    pages.push(html)
    if ((html.match(/role="tab"/g) ?? []).length <= at) break
  }
  deviceHost.setHostPage(id, 'p1')
  return pages.join('\n')
}
const {EXPRESSIONS_FACE_SEMANTICS} = await import('../src/expressions/expressionsFamilyManifest.ts')
const {isWritePath} = await import('../src/inhabitants/sdk/semantics.ts')
const {ICON_NAMES} = await import('../src/inhabitants/sdk/icons.ts')
const {NATIVE_BINDINGS, bindValue, baseValue} = await import('@epilogos/expressions-boundary/parameters')

const FIELD = ['colour', 'contacts', 'depth', 'focus', 'ink', 'medium', 'morph', 'physics', 'pointer', 'relational', 'resonance']
const createElement = React.createElement
const binding = path => {
  const found = NATIVE_BINDINGS.find(row => row.path === path)
  assert.ok(found, `missing native binding ${path}`)
  return found
}

// A reading as the retained editor discloses it (the minimum the devices read). It is a fixture, not a native owner.
const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true,
  pointerMode: 'attract', relationalEnabled: false, volumeEnabled: false}
const lane = (over = {}) => ({id: 'lane-1', target: 'field.x', type: 'lfo', wave: 'sine', blend: 'replace', loop: 'loop', min: 0, max: 1,
  rate: 1, phase: 0, duration: 1, delay: 0, enabled: true, firedAt: null, easing: 'linear', ...over})
function reading({engine = {}, composition = {}, devices = [], pending = false, values = {}, automation = [], partial = false, sceneRef = 'scene:fixture'} = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE, ...engine}, composition: {focus: 'parallel', frequencyDriver: 'manual', ...composition},
    morph: {law: 'theta'}, automation, field: {background: '#ffffff', palette: ['#112233', '#445566', '#778899'], material: 'ink', params: {}}}
  if (partial) { delete scene.composition; delete scene.morph }
  for (const [path, value] of Object.entries(values)) bindValue(scene, binding(path).bind, value)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: sceneRef, authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices,
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending, notice: null},
  }
}
const placed = (...families) => families.map(family => ({id: `${family}-1`, family}))
const entryOf = family => model.expressionsFieldEntry(family)
const build = (family, r = reading(), send = null) => model.expressionsFieldDevice(r, family, send)
const NEVER = async () => ({ok: false, error: 'x'})
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const render = (r, request = NEVER) => renderToStaticMarkup(createElement(rackModule.NativeDeviceRack, {reading: r, request, onOpen() {}}))

// ── 1 — the eleven are devices of the runtime ─────────────────────────────

test('the Field devices of the catalogue are exactly the eleven this ticket realises, each a device of the runtime', () => {
  assert.deepEqual(model.expressionsFieldEntries().map(entry => entry.family).sort(), FIELD)
  for (const family of FIELD) {
    const device = build(family)
    assert.ok(device, `${family} builds`)
    assert.equal(device.id, `expressions:${family}`)
    assert.equal(device.family, 'expressions')
    assert.equal(device.face.id, family)
    assert.equal(device.face.title, entryOf(family).name)
    assert.equal(device.face.liveSemantic, EXPRESSIONS_FACE_SEMANTICS[family].liveSemantic, `${family} keeps its Live semantic`)
    assert.deepEqual(device.face.invariant, EXPRESSIONS_FACE_SEMANTICS[family].invariant)
    assert.ok(ICON_NAMES.includes(device.face.icon), `${family} wears a mark of the cut (${device.face.icon})`)
  }
  assert.equal(build('glyph'), null, 'a family that is not a Field device builds nothing')
  assert.equal(build('force'), null, 'an entity device is not a Field device')
})

test('the whole device carries every catalogue parameter once, under the catalogue\'s own groups, with the binding\'s label and range', () => {
  for (const family of FIELD) {
    const entry = entryOf(family), device = build(family)
    const numeric = device.rows.filter(row => row.type === 'number')
    assert.deepEqual(numeric.map(row => row.key).sort(), [...entry.paths].sort(), `${family}: every parameter exactly once`)
    for (const row of numeric) {
      const found = binding(row.key)
      assert.equal(row.title, found.label)
      assert.ok(row.range.min <= found.min && row.range.max >= found.max, `${family}.${row.key} spans the binding's performance range`)
      assert.ok(row.range.min >= found.hardMin && row.range.max <= found.hardMax)
      assert.equal(row.group, entry.groups.find(group => group.paths.includes(row.key)).title)
    }
    const groups = runtime.groupRows(device.rows, entry.name).map(group => group.group)
    // A group the catalogue holds only for a bespoke widget (Colour's palette stops) has no number to show; every group with one is here.
    for (const group of entry.groups.filter(item => item.paths.length)) assert.ok(groups.includes(group.title), `${family}: group ${group.title}`)
    assert.equal(new Set(device.rows.map(row => row.key)).size, device.rows.length, `${family}: row keys are unique`)
  }
})

test('compact is the catalogue\'s four most-played controls in its order, at most four, and never a switch', () => {
  for (const family of FIELD) {
    const entry = entryOf(family), device = model.inCompactOrder(build(family), entry)
    const shown = runtime.compactRows(device.rows).map(row => row.key)
    assert.deepEqual(shown, [...entry.compact], `${family}: the compact controls`)
    assert.ok(shown.length > 0 && shown.length <= 4)
  }
})

test('owners write, faces read: every row names the owner\'s write path, in the grammar, and a device without an owner to write is only readings', () => {
  for (const family of FIELD) {
    const device = build(family, reading(), async () => ({ok: true}))
    assert.equal(typeof device.submit, 'function')
    for (const row of device.rows) {
      assert.equal(row.writePath, 'kernel:native_expression', `${family}.${row.key}`)
      assert.ok(isWritePath(row.writePath))
    }
    assert.equal(build(family, reading(), null).submit, undefined, `${family}: the work is busy, so nothing here writes`)
  }
})

test('a partial reading never throws: what it does not carry is unknown, never a default', () => {
  const partial = reading({partial: true})
  for (const family of FIELD) {
    const device = build(family, partial)
    assert.ok(device, family)
    for (const key of Object.keys(device.values)) assert.ok(device.rows.some(row => row.key === key) || key === 'enabled', `${family}: value ${key} has a row`)
  }
  const morph = build('morph', partial)
  assert.equal(morph.values['set:law'], undefined, 'the conjugate law the reading does not carry is unknown')
  assert.equal(morph.values['set:trajectory'], 'toroidalHopf', 'the trajectory it does carry reads')
})

// ── 2 — the values and the lights are the owner's readings ───────────────

test('values are the reading\'s base values and follow the reading; a switch reads the scene\'s own field', () => {
  const first = build('morph', reading({values: {'toroidalMorph.oscillationSpeed': 1.5, 'toroidalMorph.driveDepth': 0.25}}))
  assert.equal(first.values['toroidalMorph.oscillationSpeed'], 1.5)
  assert.equal(first.values['toroidalMorph.driveDepth'], 0.25)
  const later = build('morph', reading({values: {'toroidalMorph.oscillationSpeed': 2.5}}))
  assert.equal(later.values['toroidalMorph.oscillationSpeed'], 2.5)
  assert.equal(first.values['toroidalMorph.oscillationSpeed'], 1.5, 'the earlier device is a pure value')
  assert.equal(build('physics', reading({engine: {mediumPlane: 'horizontal'}})).values['set:mediumPlane'], 'XZ · horizontal')
  assert.equal(build('contacts', reading({engine: {pairwiseEnabled: true}})).values['set:pairwiseEnabled'], true)
  assert.equal(build('resonance', reading({composition: {frequencyDriver: 'automation'}})).values['set:frequencyDriver'], 'Automation / station sweep')
  assert.equal(build('ink', reading({engine: {grainProfile: false}})).values['set:grainProfile'], false)
  assert.equal(build('ink', reading()).values['set:grainProfile'], true, 'an absent grain profile reads as the app does: on')
})

test('a light is the owner\'s reading: dark where no enable operation is disclosed, on and off only as the owner says', () => {
  for (const family of ['physics', 'pointer', 'ink']) {
    const device = build(family)
    assert.equal(runtime.lightOf(device), 'unknown', `${family} discloses no enable operation, so its light stays dark`)
    assert.equal(device.enabledKey, undefined)
    assert.ok(!device.rows.some(row => row.key === 'enabled'), `${family} has no Enabled row to dress as one`)
  }
  assert.equal(runtime.lightOf(build('medium', reading({engine: {mediumEnabled: true}}))), 'on')
  assert.equal(runtime.lightOf(build('medium', reading({engine: {mediumEnabled: false}}))), 'off')
  assert.equal(runtime.lightOf(build('relational', reading({engine: {relationalEnabled: true}}))), 'on')
  assert.equal(runtime.lightOf(build('depth', reading({engine: {volumeEnabled: true}}))), 'on')
  assert.equal(runtime.lightOf(build('colour', reading({engine: {colorEnabled: false}}))), 'off')
  assert.equal(runtime.lightOf(build('contacts', reading({engine: {pairwiseEnabled: true}}))), 'on', 'contacts is lit by either section')
  assert.equal(runtime.lightOf(build('focus', reading({composition: {focus: 'travelling'}}))), 'on')
  assert.equal(runtime.lightOf(build('focus', reading({composition: {focus: 'parallel'}}))), 'off')
  // A device with an enable operation carries it as the Enabled row; the one without carries none.
  assert.ok(build('medium').rows.some(row => row.key === 'enabled' && row.type === 'boolean'))
})

test('what moves a value shows on its row, and a row nothing moves says nothing', () => {
  const speed = binding('toroidalMorph.oscillationSpeed')
  const r = reading({automation: [lane({id: 'speed', target: 'field.' + speed.key})]})
  const device = build('morph', r)
  const moved = device.rows.find(row => row.key === 'toroidalMorph.oscillationSpeed')
  assert.match(moved.modulatedBy, new RegExp(`${speed.label} · lfo sine`))
  assert.match(moved.modulatedBy, /base .* · effective /)
  assert.equal(device.rows.find(row => row.key === 'toroidalMorph.poloidalRate').modulatedBy, undefined)
  assert.equal(build('morph').rows.some(row => row.modulatedBy), false)
})

// ── 3 — what a change is ──────────────────────────────────────────────────

test('a number leaves as the editor\'s own parameter change, refused outside the binding\'s hard bounds and for a row the device does not have', () => {
  const entry = entryOf('physics'), r = reading()
  const found = binding('fluid.viscosity')
  const {edits, numeric} = model.fieldDeviceEdits(entry, r, [{key: 'fluid.viscosity', value: 0.9}, {key: 'fluid.timeScale', value: 2}])
  assert.deepEqual(edits, [{kind: 'parameter', target: 'field.' + found.key, value: 0.9}, {kind: 'parameter', target: 'field.' + binding('fluid.timeScale').key, value: 2}])
  assert.deepEqual(numeric.map(edit => [edit.id, edit.value, edit.initial]), [
    ['field.' + found.key, 0.9, baseValue(r.scene, found.key)], ['field.' + binding('fluid.timeScale').key, 2, baseValue(r.scene, binding('fluid.timeScale').key)]])
  assert.throws(() => model.fieldDeviceEdits(entry, r, [{key: 'fluid.viscosity', value: found.hardMax + 1}]), new RegExp(`${found.label} must be from`))
  assert.throws(() => model.fieldDeviceEdits(entry, r, [{key: 'fluid.viscosity', value: Number.NaN}]), /takes a number/)
  assert.throws(() => model.fieldDeviceEdits(entry, r, [{key: 'medium.pressure', value: 1}]), /not a parameter of Physics/)
  assert.throws(() => model.fieldDeviceEdits(entry, r, [{key: 'set:nothing', value: true}]), /not a setting of Physics/)
})

test('the light\'s own toggle is the Enabled row and leaves as the admitted change the rack\'s activator already makes; contacts off clears its pairwise flag too', () => {
  const r = reading({engine: {pairwiseEnabled: true, collisionEnabled: true}})
  assert.deepEqual(model.fieldDeviceEdits(entryOf('contacts'), r, [{key: 'enabled', value: false}]).edits,
    [{kind: 'field-setting', key: 'collisionEnabled', value: false}, {kind: 'field-setting', key: 'pairwiseEnabled', value: false}])
  assert.deepEqual(model.fieldDeviceEdits(entryOf('relational'), r, [{key: 'enabled', value: true}]).edits, [{kind: 'panel-setting', key: 'relationalEnabled', value: true}])
  assert.deepEqual(model.fieldDeviceEdits(entryOf('colour'), r, [{key: 'enabled', value: false}]).edits, [{kind: 'colour-setting', key: 'colorEnabled', value: false}])
  assert.deepEqual(model.fieldDeviceEdits(entryOf('morph'), r, [{key: 'enabled', value: true}]).edits, [{kind: 'morph-setting', key: 'morphEnabled', value: true}])
  assert.deepEqual(model.fieldDeviceEdits(entryOf('medium'), r, [{key: 'enabled', value: true}]).edits, [{kind: 'field-setting', key: 'mediumEnabled', value: true}])
  assert.throws(() => model.fieldDeviceEdits(entryOf('physics'), r, [{key: 'enabled', value: true}]), /no enable operation/)
  assert.throws(() => model.fieldDeviceEdits(entryOf('medium'), r, [{key: 'enabled', value: 1}]), /on\/off/)
})

test('a switch leaves as the editor\'s own setting kind with the owner\'s value; a label the owner does not offer is refused', () => {
  const r = reading()
  const one = (family, key, value) => model.fieldDeviceEdits(entryOf(family), r, [{key: 'set:' + key, value}]).edits
  assert.deepEqual(one('physics', 'mediumPlane', 'XZ · horizontal'), [{kind: 'field-setting', key: 'mediumPlane', value: 'horizontal'}])
  assert.deepEqual(one('medium', 'mediumDimension', '3D'), [{kind: 'field-setting', key: 'mediumDimension', value: '3D'}])
  assert.deepEqual(one('contacts', 'collisionMode', 'Vessel'), [{kind: 'field-setting', key: 'collisionMode', value: 'vessel'}])
  assert.deepEqual(one('resonance', 'autoSweep', true), [{kind: 'panel-setting', key: 'autoSweep', value: true}])
  assert.deepEqual(one('resonance', 'sweepDirection', 'There and back'), [{kind: 'panel-setting', key: 'sweepDirection', value: 'pingpong'}])
  assert.deepEqual(one('pointer', 'pointerClick', 'Shove · random burst'), [{kind: 'panel-setting', key: 'pointerClick', value: 'shove'}])
  assert.deepEqual(one('focus', 'focus', 'Travelling focus'), [{kind: 'panel-setting', key: 'focus', value: 'travelling'}])
  assert.deepEqual(one('depth', 'volumeProfile', 'Dome · convex bulge'), [{kind: 'panel-setting', key: 'volumeProfile', value: 'dome'}])
  assert.deepEqual(one('morph', 'driveShape', 'pulse'), [{kind: 'morph-setting', key: 'driveShape', value: 'pulse'}])
  assert.deepEqual(one('morph', 'autoOscillate', false), [{kind: 'morph-setting', key: 'autoOscillate', value: false}])
  assert.deepEqual(one('colour', 'colorMode', 'Linear Wave'), [{kind: 'colour-setting', key: 'colorMode', value: 'linearGradient'}])
  assert.throws(() => one('physics', 'mediumPlane', 'XYZ'), /not one of the owner's choices/)
  assert.throws(() => one('resonance', 'autoSweep', 'yes'), /on\/off/)
  // Every setting row of every device round-trips: each choice the row offers is a change the boundary's validator admits.
  for (const family of FIELD) {
    const device = build(family)
    for (const row of device.rows.filter(item => item.key.startsWith('set:'))) {
      const offered = row.type === 'enumerated' ? row.values : [true, false]
      assert.ok(offered.length >= 2, `${family}.${row.key} offers a choice`)
      for (const value of offered) assert.equal(model.fieldDeviceEdits(entryOf(family), r, [{key: row.key, value}]).edits.length, 1, `${family}.${row.key} = ${value}`)
    }
  }
})

test('the switches of each whole panel that are plain on/off and choice settings are rows; the bespoke pickers stay in the Studio and are named', () => {
  assert.deepEqual(Object.fromEntries(FIELD.map(family => [family, model.expressionsSettingKeys(family)])), {
    colour: ['colorMode'],
    contacts: ['collisionMode', 'pairwiseEnabled'],
    depth: ['volumeProfile', 'depthPerspective', 'depthOcclusion'],
    focus: ['focus', 'focusOrder', 'carryTint', 'frequencyDriver'],
    ink: ['grainProfile', 'dotShape'],
    medium: ['mediumDimension'],
    morph: ['autoOscillate', 'trajectory', 'driveShape', 'law'],
    physics: ['mediumPlane'],
    pointer: ['pointerScope', 'pointerMode', 'pointerClick'],
    relational: ['relationalMode'],
    resonance: ['frequencyDriver', 'autoSweep', 'sweepDirection', 'templateDimension', 'resonatorMode'],
  })
})

test('submit sends the editor\'s changes on the reading\'s basis in one write, and a refusal comes back in the owner\'s words', async () => {
  const r = reading(), sent = []
  const device = build('physics', r, async (edits, numeric, basis) => { sent.push({edits, numeric, basis}); return {ok: true, reading: r} })
  await device.submit([{key: 'fluid.viscosity', value: 0.8}, {key: 'set:mediumPlane', value: 'XZ · horizontal'}])
  assert.equal(sent.length, 1, 'one write for one commit')
  assert.deepEqual(sent[0].edits.map(edit => edit.kind), ['parameter', 'field-setting'])
  assert.deepEqual(sent[0].basis, r.basis)
  const refused = build('physics', r, async () => ({ok: false, error: 'The owner refused: stale revision'}))
  await assert.rejects(refused.submit([{key: 'fluid.viscosity', value: 0.8}]), /The owner refused: stale revision/)
  await assert.rejects(refused.submit([{key: 'fluid.viscosity', value: 99999}]), /must be from/)
})

// ── 4 — how it is sent: one apply, with the private owner holding the numbers ──

function fakeAperture() {
  const copies = []
  let counter = 0
  const copyOf = material => ({writer_id: 'w1', writer_scope: {accessEpoch: 1}, input: material.input, basis: material.basis, target: material.target,
    ...(material.refusal ? {refusal: material.refusal} : {})})
  const owner = {
    writerId: 'w1', scope: {accessEpoch: 1},
    read: () => ({copies: copies.map(row => ({ref: row.ref, copy: row.copy}))}),
    retain: (material, _current, previous) => {
      if (previous) { const found = copies.find(row => row.ref === previous.ref); found.copy = copyOf(material); return found }
      const receipt = {ref: `r${++counter}`, copy: copyOf(material)}
      copies.push(receipt)
      return receipt
    },
    clear: receipt => { const at = copies.findIndex(row => row.ref === receipt.ref); if (at < 0) return false; copies.splice(at, 1); return true },
  }
  return {aperture: {owner, current: () => true, changed() {}}, copies}
}
const edit = {kind: 'parameter', target: 'field.fluid.viscosity', value: 0.7}
const numeric = [{id: 'field.fluid.viscosity', value: 0.7, initial: 0.5}]
const current = () => () => true
const basis = reading().basis

test('with no private owner the send is the apply, and work that moved on is refused before anything is sent', async () => {
  const calls = []
  const send = sender.fieldDeviceSend('physics', {apply: async (edits, at) => { calls.push([edits, at]); return {ok: true, reading: reading()} }, captureCurrent: current, aperture: () => null})
  const reply = await send([edit], numeric, basis)
  assert.equal(reply.ok, true)
  assert.deepEqual(calls, [[[edit], basis]])
  const moved = sender.fieldDeviceSend('physics', {apply: async () => { throw Error('must not be called') }, captureCurrent: () => () => false, aperture: () => null})
  assert.deepEqual(await moved([edit], numeric, basis), {ok: false, error: 'The native work moved on; your values are kept.'})
  const thrown = sender.fieldDeviceSend('physics', {apply: async () => { throw Error('transport down') }, captureCurrent: current, aperture: () => null})
  assert.deepEqual(await thrown([edit], numeric, basis), {ok: false, error: 'transport down'})
})

test('the private owner holds a number while the owner has not answered: cleared on ok, kept with the owner\'s refusal otherwise, left alone when the work moved on', async () => {
  const held = fakeAperture()
  let during = -1
  const ok = sender.fieldDeviceSend('physics', {apply: async () => { during = held.copies.length; return {ok: true, reading: reading()} }, captureCurrent: current, aperture: () => held.aperture})
  assert.equal((await ok([edit], numeric, basis)).ok, true)
  assert.equal(during, 1, 'the number was held before the owner was asked')
  assert.equal(held.copies.length, 0, 'an acknowledged number is cleared')
  assert.equal(held.copies[0], undefined)

  const refusing = fakeAperture()
  const refused = sender.fieldDeviceSend('physics', {apply: async () => ({ok: false, error: 'stale revision'}), captureCurrent: current, aperture: () => refusing.aperture})
  assert.deepEqual(await refused([edit], numeric, basis), {ok: false, error: 'stale revision'})
  assert.equal(refusing.copies.length, 1, 'a refused number is kept')
  assert.equal(refusing.copies[0].copy.refusal, 'stale revision')
  assert.equal(refusing.copies[0].copy.input.changes[0].target, 'field.fluid.viscosity')
  assert.equal(refusing.copies[0].copy.target.family, 'physics', 'the copy is addressed as the handle\'s is, so recovery shows one')

  const movedOn = fakeAperture()
  let flip = true
  const left = sender.fieldDeviceSend('physics', {apply: async () => ({ok: true, reading: reading()}), captureCurrent: () => reply => (reply === undefined ? true : (flip = false)), aperture: () => movedOn.aperture})
  await left([edit], numeric, basis)
  assert.equal(flip, false)
  assert.equal(movedOn.copies.length, 1, 'work that moved on leaves the copy to the recovery panel')

  // A switch carries no number, so the private owner is not asked for one.
  const none = fakeAperture()
  const toggle = sender.fieldDeviceSend('medium', {apply: async () => ({ok: true, reading: reading()}), captureCurrent: current, aperture: () => none.aperture})
  await toggle([{kind: 'field-setting', key: 'mediumEnabled', value: true}], [], basis)
  assert.equal(none.copies.length, 0)
})

// ── 5 — one device, three sizes, the same settings ────────────────────────

const draw = (device, size, extra = {}) => renderToStaticMarkup(createElement(DeviceView, {device, size, ...extra}))

test('one device draws compact, whole and full over the same rows and the same light, and a new reading moves all three', () => {
  const entry = entryOf('medium')
  const before = build('medium', reading({engine: {mediumEnabled: true}, values: {'medium.pressure': 3}}))
  const after = build('medium', reading({engine: {mediumEnabled: false}, values: {'medium.pressure': 7}}))
  const sizes = ['compact', 'whole', 'full']
  const shown = device => sizes.map(size => draw(size === 'compact' ? model.inCompactOrder(device, entry) : device, size))
  const first = shown(before), second = shown(after)
  first.forEach((html, index) => {
    assert.match(html, new RegExp(`data-device-size="${sizes[index]}"`))
    assert.match(html, /data-device="expressions:medium"/)
    assert.match(html, /data-device-light="on"/)
    if (sizes[index] === 'full') assert.doesNotMatch(html, /data-param=/, 'full is the material: its controls stay in Device view (DLW §16.1)')
    else assert.match(html, /data-param="medium.pressure"/, `${sizes[index]} carries the pressure row`)
  })
  second.forEach(html => assert.match(html, /data-device-light="off"/))
  // The runtime adopts the owner's readings after it mounts, so the numbers are the device's `values`: one object, read by all three sizes.
  assert.equal(before.values['medium.pressure'], 3)
  assert.equal(after.values['medium.pressure'], 7)
  assert.doesNotMatch(first[0], /class="dp-sec-label">Shared collision medium</, 'compact draws no groups')
  assert.match(first[1], /class="dp-sec-label">Shared collision medium</)
  assert.match(first[1], /class="dp-sec-label">Settings</)
})

test('the device the rack publishes is the device the pool and the pane read: claimants share the door, and the last to let go withdraws it', () => {
  const id = 'expressions:probe'
  const entry = device => ({device, picture: () => null})
  const a = publication.claimDevice(id), b = publication.claimDevice(id)
  assert.equal(door.publishedDevice(id), undefined)
  a.publish(entry('A1'))
  assert.equal(door.publishedDevice(id).device, 'A1')
  b.publish(entry('B1'))
  assert.equal(door.publishedDevice(id).device, 'B1', 'the most recent offer is the one the door holds')
  b.release()
  assert.equal(door.publishedDevice(id).device, 'A1', 'one claimant letting go leaves the other\'s device standing')
  assert.deepEqual(publication.claimedDeviceIds(), [id])
  a.release()
  assert.equal(door.publishedDevice(id), undefined)
  assert.deepEqual(publication.claimedDeviceIds(), [])
  a.release()
})

test('a pane shows the published device full size, and says so when the device is not on any chain', () => {
  const device = build('relational', reading({values: {'relational.attractorGravity': 12}}))
  const claim = publication.claimDevice(device.id)
  claim.publish({device, picture: size => createElement('i', {id: `pic-${size}`})})
  const html = renderToStaticMarkup(createElement(DeviceFullPane, {id: device.id}))
  assert.match(html, /data-device-size="full"/)
  assert.match(html, /data-device="expressions:relational"/)
  assert.match(html, /id="pic-full"/, 'the pane draws the picture at full size')
  assert.doesNotMatch(html, /data-param=/, 'and no controls: they stay in Device view under the pane')
  claim.release()
  assert.match(renderToStaticMarkup(createElement(DeviceFullPane, {id: device.id})), /not on any chain right now/)
})

test('opening a device full size asks the pane tree for the device by its id, and names the fault when no pane tree is mounted', () => {
  assert.match(views.openFieldDeviceFull('physics', 'Physics'), /No pane tree is mounted/)
  const asked = []
  instruments.publishInstrumentOpener((kind, at, subject) => asked.push([kind, at, subject]))
  try {
    assert.equal(views.openFieldDeviceFull('physics', 'Physics'), null)
  } finally { instruments.publishInstrumentOpener(null) }
  assert.deepEqual(asked, [['projection.device', undefined, {ref: 'expressions:physics', title: 'Physics'}]])
})

// ── 6 — on the rack ───────────────────────────────────────────────────────

const cardsOf = html => html.split('class="native-rack-card').slice(1)

test('every field device on the rack is a compact DeviceView: its picture and no more than four controls, never a text-only card', () => {
  const html = render(reading({devices: placed(...FIELD)}))
  const cards = cardsOf(html)
  assert.equal(cards.length, FIELD.length)
  for (const family of FIELD) {
    const card = cards.find(text => text.includes(`data-device="expressions:${family}"`))
    assert.ok(card, `${family} stands on the rack as expressions:${family}`)
    assert.match(card, /data-device-size="compact"/)
    assert.match(card, /class="dv-param"/, `${family} has its controls`)
    const rows = card.match(/data-param="/g) ?? []
    assert.ok(rows.length >= 1 && rows.length <= 4, `${family}: ${rows.length} controls`)
    assert.match(card, /role="slider"/, `${family}: the controls are real`)
    assert.match(card, /native-rack-summary/, `${family}: the summary line stays`)
    assert.match(card, /aria-label="Open [^"]+ full size in a pane"/, `${family}: it opens full in a pane`)
    // the established verbs of a rack card stay
    assert.match(card, /title="Open settings"/)
    assert.match(card, /aria-label="Reorder [^"]+: drag, or Alt\+Left or Alt\+Right"/)
    assert.match(card, /aria-label="Remove [^"]+ from the rack"/)
    assert.match(card, /aria-label="Fold /)
  }
  // the compact controls on the card are the catalogue's, by label
  const physics = cards.find(text => text.includes('data-device="expressions:physics"'))
  for (const path of entryOf('physics').compact) assert.ok(physics.includes(`data-param="${path}"`), path)
  assert.ok(!physics.includes('data-param="fluid.returnSpeed"'), 'a control outside the four stays in the whole device')
})

test('the rack keeps the light as the owner reads it and as a toggle only where an enable operation exists', () => {
  const html = render(reading({devices: placed('physics', 'medium'), engine: {mediumEnabled: true}}))
  const [physics, medium] = ['physics', 'medium'].map(family => cardsOf(html).find(text => text.includes(`data-device="expressions:${family}"`)))
  assert.doesNotMatch(physics, /native-rack-light/, 'physics has no toggle')
  assert.match(physics, /data-device-light="unknown"/, 'its light stays dark')
  assert.match(medium, /aria-pressed="true"[^>]*aria-label="Shared Medium on"/)
  assert.match(medium, /data-device-light="on"/)
})

test('a busy or pending work turns every control of a field device into a reading, and the rack disables the card\'s own verbs', () => {
  const r = reading({devices: placed('medium')})
  const send = async () => ({ok: true, reading: r})
  assert.equal(typeof views.hostedFieldDevice('medium', {reading: r, locked: false}, send).submit, 'function')
  assert.equal(views.hostedFieldDevice('medium', {reading: r, locked: true}, send).submit, undefined, 'locked: nothing here writes')
  assert.equal(views.hostedFieldDevice('glyph', {reading: r, locked: false}, send), null)
  const html = render(reading({devices: placed('medium'), pending: true}))
  assert.match(html, /aria-label="Remove Shared Medium from the rack"[^>]*disabled=""/)
  assert.match(html, /aria-pressed="false"[^>]*aria-label="Shared Medium off"[^>]*disabled=""/)
})

test('the diagram is the owner\'s own: a miniature on the rack with its handles off, the working diagram whole and full', () => {
  const r = reading({devices: placed('physics')})
  const compact = render(r)
  assert.match(compact, /data-expr-picture="physics"/)
  assert.match(compact, /expr-picture--compact/)
  assert.match(compact, /native-field-handle[^>]*aria-disabled="true"/, 'the miniature\'s handles are off')
  const whole = renderToStaticMarkup(createElement(views.ExpressionsFieldWhole, {reading: r, request: NEVER, family: 'physics'}))
  assert.match(whole, /expr-picture--whole/)
  assert.match(whole, /native-field-handle[^>]*aria-disabled="false"/, 'the whole diagram\'s handles work')
  assert.equal(picture.hasPicture('physics', 'compact'), true)
  assert.equal(picture.hasPicture('colour', 'compact'), true)
  assert.equal(picture.hasPicture('morph', 'compact'), false, 'on the rack the summary line is Morph\'s reading')
  assert.equal(picture.hasPicture('morph', 'whole'), true)
  const colour = render(reading({devices: placed('colour')}))
  assert.match(colour, /aria-label="Palette stops"/)
  assert.match(colour, /title="#112233"/)
  assert.doesNotMatch(render(reading({devices: placed('morph')})), /data-expr-picture="morph"/)
})

test('what moves a control shows beneath it on the rack: the source, the base and the effective value', () => {
  const speed = binding('toroidalMorph.oscillationSpeed')
  const html = render(reading({devices: placed('morph'), automation: [lane({id: 'speed', target: 'field.' + speed.key})]}))
  assert.ok(html.includes(escapeHtml(`Driven by ${speed.label} · lfo sine`)))
  assert.match(html, /Base /)
  assert.match(html, /Effective /)
  assert.doesNotMatch(render(reading({devices: placed('morph')})), /Driven by /)
})

test('entity and scene widgets and an unavailable family keep the rack\'s own bodies', () => {
  const html = render(reading({devices: [{id: 'glyph-1', family: 'glyph'}, {id: 'physics-1', family: 'physics'}]}))
  assert.match(html, /not available in this shell/)
  assert.match(html, /data-device="expressions:physics"/)
  assert.equal(cardsOf(html).length, 2)
})

// ── 7 — whole, in the pool ────────────────────────────────────────────────

test('whole is every setting, grouped: the switches first, then the catalogue\'s own groups', () => {
  for (const family of FIELD) {
    const entry = entryOf(family)
    const html = everyPage(model.expressionsDeviceId(family), () => renderToStaticMarkup(createElement(views.ExpressionsFieldWhole, {reading: reading(), request: NEVER, family})))
    assert.match(html, /data-device-size="whole"/)
    assert.match(html, new RegExp(`data-expr-whole="${family}"`))
    for (const group of entry.groups.filter(item => item.paths.length)) assert.ok(html.includes(`class="dp-sec-label">${escapeHtml(group.title)}`), `${family}: ${group.title}`)
    for (const path of entry.paths) assert.ok(html.includes(`data-param="${path}"`), `${family}: ${path} (on one of its pages)`)
    assert.match(html, /aria-label="Open [^"]+ full (size )?in a pane"/)
    if (model.expressionsSettingKeys(family).length || entry.toggle) assert.match(html, /class="dp-sec-label">Settings</, `${family}: its switches`)
  }
  assert.match(renderToStaticMarkup(createElement(views.ExpressionsFieldWhole, {reading: null, request: NEVER, family: 'physics'})), /Open a native Expression to see this device\./)
  assert.match(renderToStaticMarkup(createElement(views.ExpressionsFieldWhole, {reading: reading(), request: NEVER, family: 'glyph'})), /not a field device of this shell/)
})

test('the pool changes nothing on the rack: opening a device whole publishes it without adding it', () => {
  const r = reading()
  assert.deepEqual(r.devices, [])
  const html = renderToStaticMarkup(createElement(views.ExpressionsFieldWhole, {reading: r, request: NEVER, family: 'ink'}))
  assert.match(html, /data-device="expressions:ink"/)
  assert.deepEqual(r.devices, [], 'the reading\'s rack is untouched')
})
