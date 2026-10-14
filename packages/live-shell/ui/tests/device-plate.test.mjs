import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

// The device plate at the mockup's floor (world-shell-mockup.html:331-347, `dev()` at :1410, knobSVG at :835): one runtime
// draws every family's device as the mockup's plate — a head of power ring, mark, name, owner, ▾ fold and ⤢ open full; a body
// of the picture box beside a two-column grid of controls; a fixed width per device derived from its rows. Knobs are rings,
// short choices and switches are segmented toggles, readings are a name over a mono value. A light is the owner's reading and
// turns the device only through the owner's write. The chain is one row of plates that scrolls sideways (frame/detail).
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
const runtime = await import('../src/frame/devices/deviceRuntime.ts')
const {DeviceView} = await import('../src/frame/devices/DeviceView.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const controls = await import('../src/inhabitants/sdk/controls.tsx')
const {createElement} = React
const html = element => renderToStaticMarkup(element)

const row = (key, extra = {}) => ({family: 'f', deviceInstance: 'd', key, type: 'number', title: key, range: {min: 0, max: 1}, writePath: 'kernel:x', ...extra})
const face = {id: 'probe', title: 'Probe', icon: 'form', liveSemantic: 'device-audio-fx'}
const device = (extra = {}) => ({id: 'f:probe', family: 'f', face, rows: [], values: {}, ...extra})
const actions = [{icon: 'detail', label: 'Show every setting in the pool', onPress: () => {}}, {icon: 'pane', label: 'Open Probe full size in a pane', onPress: () => {}}]

// ── the model: width, span, presentation, the ring's press ─────────────────────────────────────────────────────────────────

test('a plate\'s width comes from what it shows: its picture box beside one or two columns of controls, within the mockup\'s range', () => {
  const {plateWidth, PLATE} = runtime
  assert.equal(plateWidth([], true), PLATE.body, 'no controls: the picture takes the body (the mockup\'s list devices, 236)')
  assert.equal(plateWidth([], false), PLATE.min, 'nothing but its head: the narrowest plate')
  assert.equal(plateWidth([row('a')], true), 2 + 14 + 104 + 10 + 62, 'one knob beside the picture: one 62px column (.ctrls minmax(62px,auto))')
  assert.equal(plateWidth([row('a'), row('b')], true), 2 + 14 + 104 + 10 + 62 * 2 + 6, 'two knobs: two columns and their gap')
  assert.equal(plateWidth([row('a'), row('b')], false), 2 + 14 + 62 * 2 + 6, 'no picture box: the controls alone')
  const style = row('style', {type: 'enumerated', title: 'Style', values: ['Body', 'Head', 'Quote', 'List']})
  assert.ok(plateWidth([style, row('size')], true) > plateWidth([row('a'), row('b')], true), 'a wide segmented toggle widens its plate')
  for (const rows of [[], [row('a')], [style, style, style, style], [row('r', {writePath: undefined, title: 'a very long reading title indeed'})]]) {
    const width = plateWidth(rows, true)
    assert.ok(width >= PLATE.min && width <= PLATE.max, `${width} stands within ${PLATE.min}–${PLATE.max}`)
  }
})

test('a control takes one column or both: a knob, a switch, a two-word choice one; a longer choice and a reading both', () => {
  const {rowSpan, enumPresentation} = runtime
  assert.equal(rowSpan(row('a')), 1, 'a knob')
  assert.equal(rowSpan(row('b', {type: 'boolean'})), 1, 'a toggle of two (.tog.half)')
  assert.equal(rowSpan(row('m', {type: 'enumerated', values: ['DNA', 'RNA']})), 1, 'two short choices')
  assert.equal(rowSpan(row('i', {type: 'enumerated', values: ['steer', 'queue']})), 2, 'two longer choices take both columns rather than ellipsize')
  assert.equal(rowSpan(row('s', {type: 'enumerated', values: ['low', 'medium', 'high', 'max']})), 2, 'four choices (.tog)')
  assert.equal(rowSpan(row('r', {writePath: undefined})), 2, 'a reading: its name over its value, the plate\'s width')
  assert.equal(enumPresentation({values: ['ask', 'session', 'always']}), 'segmented')
  assert.equal(enumPresentation({values: ['L0', 'L0′', 'L1', 'L1′', 'L2', 'L2′']}), 'cycle', 'a long list steps through one value box')
  assert.equal(enumPresentation({values: []}), 'cycle', 'no choices published: one box, showing none')
  assert.equal(rowSpan(row('l', {type: 'enumerated', values: ['L0', 'L1', 'L2', 'L3', 'L4']})), 1)
})

test('the power ring turns the device only through the owner\'s write of the light\'s own row, from the owner\'s reading', () => {
  const {powerToggle} = runtime
  const submit = async () => {}
  const on = row('on', {type: 'boolean'})
  assert.deepEqual(powerToggle({enabledKey: 'on', rows: [on], values: {on: true}, submit}), {key: 'on', value: false})
  assert.deepEqual(powerToggle({enabledKey: 'on', rows: [on], values: {on: 'off'}, submit}), {key: 'on', value: 'on'}, 'in the owner\'s own form')
  assert.deepEqual(powerToggle({enabledKey: 'on', rows: [on], values: {on: 0}, submit}), {key: 'on', value: 1})
  assert.equal(powerToggle({enabledKey: 'on', rows: [on], values: {}, submit}), null, 'no reading: nothing to turn — the ring stays dark and inert')
  assert.equal(powerToggle({enabledKey: 'on', rows: [{...on, writePath: undefined}], values: {on: true}, submit}), null, 'a reading row: a light only')
  assert.equal(powerToggle({enabledKey: 'on', rows: [], values: {on: true}, submit}), null, 'the light is not a row of the device (the torus): a light only')
  assert.equal(powerToggle({enabledKey: 'on', rows: [on], values: {on: true}}), null, 'no owner write')
  assert.equal(powerToggle({rows: [on], values: {on: true}, submit}), null, 'no light')
})

test('the knob is the mockup\'s knobSVG ported: 270° of travel, the same arc path, the needle on the cap', () => {
  const {knobAngle, knobArc} = controls
  assert.equal(knobAngle(0.5), 0, 'half way stands straight up')
  assert.equal(knobAngle(1), 135)
  assert.ok(Math.abs(knobAngle(0) - (-135 + 270 * 0.001)) < 1e-9, 'the floor is clamped as the mockup clamps it (.001)')
  // arcP(15,15,11,-135,135) in world-shell-mockup.html:834, the track every knob draws
  assert.equal(knobArc(-135, 135), 'M7.2 22.8A11 11 0 1 1 22.8 22.8')
  assert.equal(knobArc(-135, 0), 'M7.2 22.8A11 11 0 0 1 15.0 4.0', 'the half arc takes the short sweep')
})

// ── compact: the plate on the chain ────────────────────────────────────────────────────────────────────────────────────

const probe = device({
  rows: [row('on', {type: 'boolean', title: 'On'}), row('size', {title: 'Size', compact: true, range: {min: 8, max: 24, unit: 'pt'}}),
    row('style', {type: 'enumerated', title: 'Style', compact: true, values: ['Body', 'Head', 'Quote']}),
    row('bound', {type: 'boolean', title: 'Bound', compact: true}), row('count', {title: 'In this document', writePath: undefined, compact: true})],
  values: {on: true, size: 15, style: 'Body', bound: false, count: '3 highlights'}, enabledKey: 'on', submit: async () => {},
})

test('compact is the mockup\'s plate: ring, mark, name, owner, ▾ and ⤢ on the head; the picture box beside the controls', () => {
  const out = html(createElement(DeviceView, {device: probe, size: 'compact', picture: createElement('i', {id: 'pic'}), actions}))
  assert.match(out, /^<div class="device device--compact" data-device="f:probe" data-device-size="compact" data-device-light="on" style="--plate-w:\d+px">/, 'a fixed width per device')
  const head = out.match(/<header class="sdk-face__head"[\s\S]*?<\/header>/)[0]
  assert.match(head, /title="Show every setting in the pool"/, 'pressing the plate shows it in the pool, and its head says so')
  assert.match(head, /^<header[^>]*><button type="button" class="sdk-power sdk-power--on" aria-pressed="true"/, 'the ring leads the head: lit, and a switch, since the owner writes it')
  assert.match(head, /<h3 class="sdk-face__title">Probe<\/h3><span class="sdk-face__owner">f<\/span>/, 'the name, then the owner')
  assert.match(head, /data-plate-mark="fold"[^>]*aria-label="Fold Probe to its title"/, '▾ folds')
  assert.match(head, /data-plate-mark="full"[^>]*aria-label="Open Probe full size in a pane"/, '⤢ opens full')
  assert.doesNotMatch(head, /data-plate-mark="detail"/, 'the pool is the plate\'s own press, not a third button')
  assert.ok(head.indexOf('data-plate-mark="fold"') < head.indexOf('data-plate-mark="full"'), '▾ then ⤢, as the mockup draws them')
  assert.match(out, /<div class="device-body" data-layout="beside"><div class="device-picture"><i id="pic"><\/i><\/div><div class="device-controls">/, 'the picture box beside the grid')
})

test('compact draws a knob as a ring, a short choice and a switch as segmented toggles, a reading as its name over its value', () => {
  const out = html(createElement(DeviceView, {device: probe, size: 'compact', picture: null}))
  const cell = key => out.match(new RegExp(`<div class="device-cell" data-span="(\\d)"><div class="device-row" data-param="${key}">[\\s\\S]*?(?=<div class="device-cell"|</div></div></section>)`))
  const size = cell('size'), style = cell('style'), bound = cell('bound'), count = cell('count')
  assert.equal(size[1], '1'); assert.match(size[0], /sdk-row--knob/); assert.match(size[0], /role="slider"[^>]*>\s*<svg class="sdk-knob" width="30" height="30" viewBox="0 0 30 30"/, 'the knob ring, 30 square')
  assert.match(size[0], /class="sdk-knob__base"/, 'the owner\'s value is an arc'); assert.match(size[0], /class="sdk-knob__needle"/); assert.match(size[0], /15 pt/)
  assert.equal(style[1], '2'); assert.match(style[0], /class="sdk-seg" role="radiogroup"/)
  assert.match(style[0], /aria-checked="true" class="sdk-seg__opt sdk-seg__opt--on"[^>]*>Body</, 'the acknowledged choice is lit')
  assert.equal(bound[1], '1'); assert.equal((bound[0].match(/<button type="button" class="sdk-bool sdk-seg__opt/g) ?? []).length, 2, 'a switch is a toggle of two')
  assert.match(bound[0], /class="sdk-bool sdk-seg__opt sdk-seg__opt--on"[^>]*>off</, 'off, as the owner reads it')
  assert.equal(count[1], '2'); assert.match(count[0], /sdk-row--reading[^>]*><span class="sdk-row__name">In this document<\/span><span class="sdk-chip">3 highlights<\/span>/)
  assert.doesNotMatch(out, /data-param="on"/, 'the light\'s row is the ring, not one of the four')
})

test('with no reading nothing is lit: the ring dark and inert, no arc and no needle, no choice lit, every control inert', () => {
  const dark = device({rows: probe.rows, values: {}, enabledKey: 'on'})
  const out = html(createElement(DeviceView, {device: dark, size: 'compact', picture: null, actions}))
  assert.match(out, /data-device-light="unknown"/)
  assert.match(out, /<span class="sdk-power sdk-power--unknown" role="img"/, 'a light only: nothing to turn')
  assert.doesNotMatch(out, /sdk-knob__base|sdk-knob__needle/, 'no default drawn as a value')
  assert.doesNotMatch(out, /sdk-seg__opt--on|aria-checked="true"|aria-pressed="true"/)
  assert.match(out, /role="slider" tabindex="-1"[^>]*aria-disabled="true"/)
  assert.match(out, />—<\/button>/, 'the knob\'s value says there is none')
})

test('a held value shows who holds it, by name, with the hand-back light (the specimen\'s back mark) that gives it back', () => {
  const held = device({rows: [row('depth', {title: 'Depth'})], values: {depth: 0.4}, heldBy: {depth: 'Fizz'}, handBack: async () => {}, submit: async () => {}})
  const out = html(createElement(DeviceView, {device: held, size: 'compact', picture: null}))
  assert.match(out, /<span class="sdk-face__owner">f · held by Fizz<\/span>/)
  assert.match(out, /data-param="depth" data-held-by="Fizz"/)
  assert.match(out, /class="device-handback"[^>]*aria-label="Give Depth back to Fizz"><svg[^>]*><path d="M19 12H8.5/, 'the back mark from the cut, not a glyph')
  assert.match(out, /<span class="device-holder"[^>]*>Fizz<\/span>/)
  const moved = html(createElement(DeviceView, {device: device({rows: [row('turns', {title: 'Turns', modulatedBy: 'Mars'})], values: {turns: 0.5}}), size: 'compact', picture: null}))
  assert.match(moved, /<span class="device-moved"[^>]*>Mars<\/span>/, 'a knob the sky turns shows the planet that turns it')
})

test('the plate the pool shows wears the accent outline; a folded plate is its light and name, pressed to open', () => {
  door.selectDevice('f:probe')
  try {
    assert.match(html(createElement(DeviceView, {device: probe, size: 'compact', picture: null, actions})), /<section class="sdk-face sdk-face--sel"/)
    assert.doesNotMatch(html(createElement(DeviceView, {device: probe, size: 'whole', picture: null})), /sdk-face--sel/, 'the pool itself is not outlined')
  } finally { door.selectDevice(null) }
  const folded = html(createElement(controls.FacePlate, {presentation: {family: 'f', faceId: 'probe', title: 'Probe', icon: 'form', owner: 'f'}, power: 'off', folded: true, onFold: () => {}}, createElement('i', {id: 'body'})))
  assert.match(folded, /<section class="sdk-face sdk-face--folded" aria-label="Probe"><button type="button" class="sdk-face__unfold" aria-expanded="false" aria-label="Open Probe"/)
  assert.match(folded, /sdk-power--off/, 'the light stays a reading while folded')
  assert.doesNotMatch(folded, /id="body"/, 'folded: the title alone')
})

test('whole and full are the same plate, larger: every row under its group\'s heading, no fold, the same live settings', () => {
  const grouped = device({...probe, rows: probe.rows.map(r => r.key === 'size' ? {...r, group: 'Type'} : r)})
  const whole = html(createElement(DeviceView, {device: grouped, size: 'whole', picture: createElement('i', {id: 'pic'})}))
  const full = html(createElement(DeviceView, {device: grouped, size: 'full', picture: createElement('i', {id: 'pic'})}))
  for (const out of [whole, full]) {
    assert.match(out, /<div class="device-groups"><fieldset class="device-group"><legend>Probe<\/legend><div class="device-controls">/)
    assert.match(out, /<fieldset class="device-group"><legend>Type<\/legend>/)
    assert.doesNotMatch(out, /data-plate-mark="fold"|--plate-w/, 'only the chain folds; the pool and a pane take their own width')
    assert.match(out, /class="sdk-knob"/, 'a knob is a ring at every size')
  }
  const params = out => [...out.matchAll(/data-param="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(params(whole), params(full))
  assert.deepEqual([...params(whole)].sort(), grouped.rows.map(r => r.key).sort(), 'every row, the light\'s own among them')
})

// ── the sheets: the plate's measures and the one row ───────────────────────────────────────────────────────────────────

const css = async path => (await readFile(new URL(path, import.meta.url), 'utf8'))

test('the sheets hold the mockup\'s measures: the 104 picture box, the two-column grid, the 21px head, the 10px ring', async () => {
  const devices = await css('../src/frame/devices/devices.css'), sdk = await css('../src/inhabitants/sdk/sdk.css')
  assert.match(devices, /\.device-picture \{[^}]*width: 104px; height: 104px[^}]*background: var\(--sdk-well\)/)
  assert.match(devices, /\.device-controls \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 8px 6px/)
  assert.match(devices, /\.device-cell\[data-span="2"\] \{ grid-column: span 2 \}/)
  assert.match(devices, /\.device--compact \{[^}]*width: var\(--plate-w/)
  assert.match(sdk, /\.sdk-face__head \{[^}]*height: 21px/)
  assert.match(sdk, /\.sdk-power \{[^}]*width: 10px;[^}]*height: 10px;[^}]*border: 2px solid/)
  assert.match(sdk, /\.sdk-power--on \{ border-color: var\(--sdk-accent\); \}/, 'lit only on the owner\'s on')
  for (const sheet of [devices, sdk]) assert.doesNotMatch(sheet.replace(/var\([^;]*\)/g, ''), /#[0-9a-fA-F]{3,8}\b(?![^{]*--sdk-)/, 'no raw colour outside a token\'s own fallback')
})

test('the chain is one row in the frame\'s detail area: fixed plates scrolling sideways, every family\'s body laid into it', async () => {
  const detail = await css('../src/frame/detail/detail.css')
  assert.match(detail, /\.detail-host \{ grid-area: chain;/, 'the host takes the frame\'s detail row (its residence is display:contents)')
  assert.match(detail, /\.frame\.agent-shell-frame \.detail-host \{ grid-area: ch \}/)
  assert.match(detail, /\.detail-chain \{[^}]*display: flex; gap: 6px; padding: 8px; overflow-x: auto;[^}]*align-items: stretch; background: var\(--bg-1\)/)
  const flattened = detail.match(/\.detail-chain :is\(([^)]*)\) \{\s*flex: none; display: flex; flex-flow: row nowrap/)
  assert.ok(flattened, 'the families\' wrappers become part of the row, never wrapping')
  for (const wrapper of ['.mode-detail', '.central-devices-chain', '.techne-devices', '.agent-device-chain', '.native-agent-rack', '.native-device-rack-row', '.native-rack-widgets']) {
    assert.ok(flattened[1].includes(wrapper), `${wrapper} lays into the row`)
  }
  assert.match(detail, /\.detail-chain \.chain\[data-detail-density="device"\] \{ display: contents \}/, 'Live\'s chain panel stands down to its plates')
  assert.match(detail, /\.dropz \{ width: 140px; flex: none; border: 1px dashed var\(--line-strong\)/, 'the row ends where a device can be dropped')
})

test('a plate is never narrower than its head: a long name and owner widen it, up to the mockup\'s maximum', async () => {
  const {plateWidth, headWidth, PLATE} = await import('../src/frame/devices/deviceRuntime.ts')
  const knob = {family: 'f', deviceInstance: 'd', key: 'k', type: 'number', title: 'K', range: {min: 0, max: 1}, writePath: 'kernel:x'}
  const narrow = plateWidth([knob], false)
  const head = {title: 'Glue Compressor', owner: 'audio effect', marks: 2}
  assert.ok(plateWidth([knob], false, head) >= Math.min(PLATE.max, Math.round(headWidth(head))), 'the head sets the floor')
  assert.ok(plateWidth([knob], false, head) > narrow, 'the long head widens a one-knob plate')
  assert.equal(plateWidth([knob], false, {title: 'x'.repeat(200), owner: 'y', marks: 1}), PLATE.max, 'clamped to the mockup\'s range')
})
