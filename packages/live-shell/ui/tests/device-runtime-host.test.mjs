import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

// The device runtime on the owner's panel kit (docs/dlw/DEVICE-UI.md §2, §5.2, §6, §8, §11; lane R): one binding, five views; a
// change goes to the owner when you let go, waits in italics until the owner's reading confirms it, and returns to the owner's
// value with the owner's words when refused — no Send button anywhere. The generic plate is drawn only with the kit, in bands that
// never scroll (pages instead); the catalogue's designs draw a published device when one exists; the rail keeps a device's widget.
// Loader as f5-devices.test.mjs.
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
const host = await import('../src/frame/devices/deviceHost.tsx')
const layout = await import('../src/frame/devices/genericLayout.ts')
const scale = await import('../src/frame/devices/plateScale.ts')
const designs = await import('../src/frame/devices/designs.ts')
const designed = await import('../src/frame/devices/designed.ts')
const door = await import('../src/frame/devices/deviceDoor.ts')
const {DeviceView, PlacedDevice} = await import('../src/frame/devices/DeviceView.tsx')
const {genericDevice} = await import('../src/frame/devices/genericDevice.tsx')
const rail = await import('../src/frame/widgets/deviceWidgets.tsx')
const {WidgetRail} = await import('../src/frame/widgets/WidgetRail.tsx')
const kit = await import('../src/inhabitants/sdk/panel.tsx')
const {createElement} = React
const html = element => renderToStaticMarkup(element)
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

const row = (key, extra = {}) => ({family: 'f', deviceInstance: 'd', key, type: 'number', title: key[0].toUpperCase() + key.slice(1), range: {min: 0, max: 1}, writePath: 'kernel:x', ...extra})
const face = {id: 'probe', title: 'Probe', icon: 'form', liveSemantic: 'device-audio-fx'}

// ── §5.2 a change and its answer ───────────────────────────────────────────────────────────────────────────────────────

test('while the hand moves the control shows the draft and nothing is sent; on release one change goes to the owner and waits', async () => {
  const sent = []
  const binding = {id: 'r:wait', values: {gain: 0.2, pan: 0}, write: async changes => { sent.push(changes) }}
  host.setDraft(binding.id, 'gain', 0.5)
  host.setDraft(binding.id, 'gain', 0.7)
  assert.equal(host.hostedValues(host.hostState(binding.id), binding.values).gain, 0.7, 'the control shows the value you set')
  assert.deepEqual(sent, [], 'nothing is sent while you drag')
  await host.flushDrafts(binding, 60_000)
  assert.deepEqual(sent, [[{key: 'gain', value: 0.7}]], 'one change, the last value')
  const waiting = host.hostState(binding.id)
  assert.equal(host.hostedValues(waiting, binding.values).gain, 0.7, 'the sent value shows')
  assert.equal(host.hostedStanding(waiting, binding, []).gain.pending, true, 'drawn waiting (italics, the arc dashed) until the owner confirms')
  assert.equal(host.hostedStanding(waiting, binding, []).pan, undefined, 'a value nobody moved has no standing')
  const confirmed = host.reconcile(waiting, {gain: 0.7, pan: 0})
  assert.equal(confirmed.sent.gain, undefined, 'the owner\'s reading confirms it: the wait ends')
  assert.equal(host.reconcile(waiting, {gain: 0.65, pan: 0}).sent.gain, undefined, 'a reading that moves elsewhere ends it too: the owner\'s value stands')
  assert.equal(host.reconcile(waiting, {gain: 0.2, pan: 0}), waiting, 'the same reading again keeps it waiting')
  host.resetHost(binding.id)
})

test('a write the owner accepts with no new reading ends its wait after the grace, and the owner\'s value stands again', async () => {
  const binding = {id: 'r:grace', values: {gain: 0.2}, write: async () => {}}
  host.setDraft(binding.id, 'gain', 0.9)
  await host.flushDrafts(binding, 5)
  assert.equal(host.hostState(binding.id).sent.gain.resolved, true)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(host.hostedValues(host.hostState(binding.id), binding.values).gain, 0.2, 'never a copy the owner did not report')
  host.resetHost(binding.id)
})

test('a refusal returns the control to the owner\'s value and keeps the owner\'s words; the next move clears it', async () => {
  const binding = {id: 'r:refuse', values: {face: 2}, write: async () => { throw new Error('No Day is selected.') }}
  host.setDraft(binding.id, 'face', 4)
  assert.equal(await host.flushDrafts(binding), 'No Day is selected.')
  const state = host.hostState(binding.id)
  assert.equal(host.hostedValues(state, binding.values).face, 2)
  assert.equal(host.hostedStanding(state, binding, []).face.refused, 'No Day is selected.')
  host.setDraft(binding.id, 'face', 3)
  assert.equal(host.hostState(binding.id).refused.face, undefined, 'moving it again clears the refusal')
  host.resetHost(binding.id)
  const reading = {id: 'r:reading', values: {n: 1}, write: async () => assert.fail('never sent'), writes: key => key !== 'n'}
  host.setDraft(reading.id, 'n', 2)
  assert.match(await host.flushDrafts(reading), /A reading/, 'a reading is never sent; it says why')
  assert.match(host.hostedStanding(host.hostState(reading.id), reading, ['n']).n.disabled, /A reading/, 'and stands disabled with its reason')
  host.resetHost(reading.id)
  const none = {id: 'r:none', values: {}}
  host.setDraft(none.id, 'x', 1)
  assert.match(await host.flushDrafts(none), /No owner takes a change/)
  host.resetHost(none.id)
})

test('the owner\'s refusal reaches the status bar\'s Info line through the shell\'s one info law, and the plate\'s words are restored', () => {
  const said = []
  globalThis.MouseEvent = class { constructor(type, init) { this.type = type; this.bubbles = init?.bubbles } }
  const attrs = new Map([['data-device', 'x']])
  const element = {getAttribute: name => attrs.get(name) ?? null, setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name),
    dispatchEvent: event => { said.push([event.type, event.bubbles, attrs.get('data-i')]); return true }}
  host.sayOnInfoLine(element, 'Day: refused', 'No Day is selected.')
  assert.deepEqual(said, [['mouseover', true, 'Day: refused|No Day is selected.']], 'a bubbling mouseover from the plate, carrying the words')
  assert.equal(attrs.has('data-i'), false, 'and taken off again at once')
  delete globalThis.MouseEvent
})

test('no plate draws a Send or Cancel button; the runtime sources hold no commit bar', async () => {
  for (const file of ['DeviceView.tsx', 'deviceHost.tsx', 'genericDevice.tsx']) {
    const source = await readFile(new URL(`../src/frame/devices/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, />Send<|>Cancel<|device-commit|useFaceDrafts/, `${file}: release-to-send only`)
  }
})

// ── the generic plate: §3 measures, §5 controls, §1 nothing scrolls ─────────────────────────────────────────────────────

test('each row takes the kit control its values fit (§5, §8.1): no range is drawn that the owner does not have', () => {
  const of = (extra, place = 'whole') => layout.controlOf(row('k', extra), place)
  assert.equal(of({}), 'dial', 'a ranged number you sweep')
  assert.equal(of({}, 'widget'), 'box', 'a value box where space is short')
  assert.equal(of({range: undefined}), 'field', 'a number with no range is typed, never set on a made-up scale')
  assert.equal(of({type: 'boolean'}), 'toggle')
  assert.equal(of({type: 'enumerated', values: ['A', 'B']}), 'radio', 'one of two to five')
  assert.equal(of({type: 'enumerated', values: ['one', 'two', 'three', 'four', 'five', 'six']}), 'chooser', 'one of many')
  assert.equal(of({writePath: undefined}), 'readout', 'a row with no write path is a reading')
  assert.equal(of({type: 'stream', writePath: undefined}), 'readout')
})

test('whole: sections by group in declared order, each within the band; bands within the plate; pages when two bands are not enough', () => {
  const rows = Array.from({length: 22}, (_, i) => row(`p${i}`, {group: ['Swirl', 'Spring', 'Curl', 'Field', 'Gravity'][Math.floor(i / 5)]}))
  const pages = layout.planWhole(rows, 'Physics', {picture: true})
  assert.ok(pages.length >= 2, 'twenty-two dials do not fit two bands: pages, never a scroller')
  assert.ok(pages.every(page => page.bands.length <= 2), 'one or two bands to a page')
  assert.equal(pages[0].bands[0].picture, true, 'the display first, on band one')
  for (const band of pages.flatMap(page => page.bands)) {
    const used = band.sections.reduce((sum, section) => sum + section.width, band.picture ? 206 : 0)
    assert.ok(used <= layout.MEASURE.pool - 2, `a band holds its sections within the 400-wide plate (${used})`)
    for (const section of band.sections) assert.ok(layout.stackHeight(section.cells, section.cols) <= layout.SECTION_BODY, `${section.label} stands within the band`)
  }
  const order = pages.flatMap(page => page.bands.flatMap(band => band.sections.flatMap(section => section.cells.map(cell => cell.row.key))))
  assert.deepEqual(order, rows.map(r => r.key), 'every row once, in the order the device declares them')
  assert.deepEqual(layout.planWhole([row('a')], 'X').map(page => page.label), ['X'], 'a small device: one page, no tabs')
})

test('compact holds at most four controls, macros first, never the activator\'s own row', () => {
  const rows = [row('on', {type: 'boolean'}), ...'abcdef'.split('').map(key => row(key)), row('m', {macro: {maps: [{key: 'a'}]}})]
  assert.deepEqual(layout.compactCells(rows, 'on').map(cell => cell.row.key), ['m'])
  assert.deepEqual(layout.compactCells(rows.filter(r => r.key !== 'm'), 'on').map(cell => cell.row.key), ['a', 'b', 'c', 'd'])
  const plan = layout.planCompact(layout.compactCells(rows.filter(r => r.key !== 'm'), 'on'))
  assert.equal(plan.cols, 2, 'four dials stand two by two, as Live\'s macros do')
})

test('the plate scales 80–125 % with the chain\'s height and never reflows; the pool\'s plate fits the pool', () => {
  assert.equal(scale.chainScale(191), 1)
  assert.equal(scale.chainScale(120), 0.8, 'a short detail area: 80 %')
  assert.equal(scale.chainScale(400), 1.25, 'a tall one: 125 %')
  assert.equal(scale.chainScale(220), 1.15)
  assert.equal(scale.poolScale(400), 1)
  assert.equal(scale.poolScale(310), 0.78, 'a narrow pool scales the 400-wide plate down to it')
  assert.equal(scale.poolScale(500, 200, 380), 0.53, 'and a short pool by its height')
})

const probe = {id: 'r:probe', family: 'r', face, enabledKey: 'on', submit: async () => {},
  rows: [row('on', {type: 'boolean'}), row('size', {compact: true, range: {min: 8, max: 24, unit: 'pt'}}), row('style', {type: 'enumerated', values: ['A', 'B'], compact: true}),
    row('count', {writePath: undefined, compact: true}), row('depth', {group: 'Body'})],
  values: {on: true, size: 12, style: 'B', count: 3}}

test('the generic plate\'s folded strip and widget tile are the kit\'s: two readings read downward; a 136 tile with up to three', () => {
  const plain = genericDevice({id: 'r:probe', title: 'Probe', rows: probe.rows, enabledKey: 'on', picture: () => createElement('i', {id: 'pic'})})
  const props = {v: probe.values, owner: probe.values, set() {}, nav: {}, page: 'p1', setPage() {}, standing: {}}
  const folded = html(plain.folded(props))
  assert.match(folded, /^<section class="dp-folded"/)
  assert.equal((folded.match(/dp-folded-reading/g) ?? []).length, 2)
  const widget = html(plain.widget({...props, nav: {close() {}, full() {}}}))
  assert.match(widget, /^<section class="dp-tile" data-span="1"/)
  assert.ok((widget.match(/data-param=/g) ?? []).length <= 3, 'up to three readings or macros')
  assert.match(widget, /<div class="dp-display" data-raw="true" style="width:58px;height:104px"/, 'the picture small')
  assert.match(widget, /aria-label="Take Probe off the rail"/)
  const full = html(plain.full(props))
  assert.doesNotMatch(full, /data-param=|role="slider"/, 'full holds the material and no controls')
})

test('one device, five views on one binding: a value moved in one view is the value the others draw', () => {
  const id = 'r:probe'
  host.setDraft(id, 'size', 20)
  try {
    door.publishDevice(id, {device: probe})
    const views = [html(createElement(DeviceView, {device: probe, size: 'compact'})), html(createElement(DeviceView, {device: probe, size: 'whole'})),
      html(createElement(PlacedDevice, {device: probe, view: 'widget'}))]
    for (const markup of views) assert.match(markup, /aria-valuenow="20"|20 pt/, 'the hand\'s draft shows in every view at once')
  } finally { host.resetHost(id); door.publishDevice(id, null) }
})

// ── own views: the catalogue's design, or one registered here ──────────────────────────────────────────────────────────

const design = {id: 'r:probe', title: 'Probe', kind: 'effect', defaults: {},
  folded: p => createElement('b', {id: 'own-folded'}, String(p.v.size)), compact: p => createElement('b', {id: 'own-compact'}, String(p.v.size)),
  whole: p => createElement('b', {id: 'own-whole'}, String(p.v.size)), full: () => createElement('b', {id: 'own-full'}), widget: () => createElement('b', {id: 'own-widget'})}

test('a device draws its own views when a design stands for its <family>:<face>, on the owner\'s values; else the generic plate', () => {
  door.publishDevice('r:probe', {device: probe})
  try {
    assert.match(html(createElement(DeviceView, {device: probe, size: 'compact'})), /data-device-design="generic"/, 'no design yet: the generic plate')
    designs.registerDesignedDevice(design)
    const compact = html(createElement(DeviceView, {device: probe, size: 'compact'}))
    assert.match(compact, /data-device-design="r:probe"/)
    assert.match(compact, /<b id="own-compact">12<\/b>/, 'the design reads the owner\'s value')
    assert.match(html(createElement(DeviceView, {device: probe, size: 'whole'})), /id="own-whole"/)
    assert.match(html(createElement(DeviceView, {device: probe, size: 'full'})), /id="own-full"/)
    assert.match(html(createElement(PlacedDevice, {device: probe, view: 'widget'})), /id="own-widget"/)
    assert.match(html(createElement(DeviceView, {device: probe, size: 'compact', generic: true})), /data-device-design="generic"/, 'generic on request')
    const keyed = {id: 'r:probe', values: {size: 7}}
    door.publishDevice('r:probe', {device: probe, binding: keyed})
    assert.match(html(createElement(DeviceView, {device: probe, size: 'compact'})), /<b id="own-compact">7<\/b>/, 'a family\'s binding maps the design\'s keys to the owner\'s readings')
  } finally { designs.unregisterDesignedDevice('r:probe'); door.publishDevice('r:probe', null) }
})

test('a design key with no reading reaches the view as unknown, and the kit draws it as "—", never NaN or zero (DEVICE-UI §6, §7)', () => {
  const dial = html(createElement(kit.Dial, {label: 'Face', value: Number(undefined), scale: {min: 0, max: 5}, format: x => `${x}`, onChange() {}}))
  assert.match(dial, /data-unread="true"/); assert.match(dial, /<span class="dp-value">—<\/span>/); assert.doesNotMatch(dial, /dp-dial-value|NaN/)
  assert.match(html(createElement(kit.Readout, {label: 'running', value: Number(undefined)})), /<output class="dp-readout-value">—<\/output>/)
  assert.match(html(createElement(kit.Readout, {label: 'date', value: String(undefined)})), />—</)
  assert.match(html(createElement(kit.Folded, {title: 'Day', light: String(undefined), readings: ['Face NaN']})), /data-light="unknown"[\s\S]*>—</, 'a hollow light, a dash')
  assert.match(html(createElement(kit.Chooser, {label: 'T', value: 'undefined', options: [{value: 'a', label: 'A'}]})), /<option value="" disabled=""[^>]*>—<\/option>/)
})

// ── the rail ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('a device goes on the rail as a widget of the rail\'s own kind, stays in its open set, and draws its tile bare', () => {
  const opened = []
  const book = {rail: {open: ['device:r:probe']}, toggle: id => opened.push(id), pin() {}, savePreset() {}, applyPreset() {}, widen() {}}
  door.publishDevice('r:probe', {device: probe})
  try {
    const markup = html(createElement(WidgetRail, {widgets: [], book, selectionRef: null}))
    assert.match(markup, /<section class="mode-dock-tile mode-dock-tile--bare" data-widget="device:r:probe">/, 'the device\'s own tile, no second head')
    assert.match(markup, /<section class="dp-tile" data-span="1" aria-label="Probe"/, 'the kit\'s 136 tile')
    assert.deepEqual(rail.deviceWidgets(['device:r:probe', 'agent'], '').open.map(widget => widget.id), ['device:r:probe'])
    assert.deepEqual(rail.deviceWidgets([], 'prob').found.map(widget => widget.id), ['device:r:probe'], 'a search in the launcher finds a published device')
    assert.deepEqual(rail.deviceWidgets([], '').found, [], 'and only a search: the launcher stays the rail\'s own')
    door.publishRail({open: [], toggle: id => opened.push(id)})
    assert.equal(door.putOnRail('r:probe'), null)
    assert.deepEqual(opened, ['device:r:probe'], 'the head\'s rail mark opens it in the rail\'s own set')
    door.publishRail({open: ['device:r:probe'], toggle: id => opened.push(id)})
    door.putOnRail('r:probe')
    assert.equal(opened.length, 1, 'a device already on the rail stays')
    door.publishRail(null)
    assert.match(door.putOnRail('r:probe'), /rail is not open/, 'with no rail drawn, it says so')
  } finally { door.publishDevice('r:probe', null) }
  assert.match(html(createElement(rail.deviceWidget('device:r:gone').Body, {subject: null, pinned: false})), /on no chain now/, 'withdrawn with its chain, it says so and returns when the chain does')
})

test('the rail and the places bring no colour or scroller of their own', async () => {
  for (const path of ['../src/frame/devices/devices.css', '../src/frame/widgets/deviceWidgets.css', '../src/inhabitants/sdk/panel.css']) {
    const sheet = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.doesNotMatch(sheet.replace(/var\([^;]*\)/g, ''), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `${path}: shell tokens only`)
    assert.doesNotMatch(sheet, /overflow(-[xy])?: (auto|scroll)/, `${path}: nothing scrolls`)
  }
  await settle()
})

test('the binding of a runtime device: its rows are its keys, a row with no write path a reading, its light the owner\'s', () => {
  const binding = designed.bindingOf(probe)
  assert.equal(binding.id, 'r:probe')
  assert.equal(binding.writes('size'), true); assert.equal(binding.writes('count'), false, 'a reading')
  assert.equal(binding.writes('face'), true, 'a key the device does not declare is the owner\'s to refuse')
  assert.equal(designed.lightOfBinding(binding), 'lit')
  assert.equal(designed.lightOfBinding({enabledKey: 'on', values: {}}), 'unknown', 'no reading: hollow')
})
