import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

// The device plate on the owner's panel kit (docs/dlw/DEVICE-UI.md §3–§6, §11; inhabitants/sdk/panel.tsx): one runtime draws every
// family's device through the kit — a head of activator, ▾ fold, name, held mark and ⤢ open full; a band of sections; the device's
// picture in the well beside its controls. A ranged number is a dial, a few choices a radio, a switch a toggle, a reading a readout.
// A light is the owner's reading and turns the device only through the owner's write. No plate has a Send button. The chain is one
// row of plates that scrolls sideways (frame/detail).
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


const host = await import('../src/frame/devices/deviceHost.tsx')
const designed = await import('../src/frame/devices/designed.ts')

// ── the light's press ───────────────────────────────────────────────────────────────────────────────────────────────────

test('the activator turns the device only through the owner\'s write of the light\'s own row, from the owner\'s reading', () => {
  const {activatorChange, bindingOf} = designed
  const submit = async () => {}
  const on = row('on', {type: 'boolean'})
  const of = (extra) => activatorChange(bindingOf({id: 'f:probe', family: 'f', face, rows: [on], values: {}, enabledKey: 'on', submit, ...extra}))
  assert.deepEqual(of({values: {on: true}}), {key: 'on', value: false})
  assert.deepEqual(of({values: {on: 'off'}}), {key: 'on', value: 'on'}, 'in the owner\'s own form')
  assert.deepEqual(of({values: {on: 0}}), {key: 'on', value: 1})
  assert.equal(of({values: {}}), null, 'no reading: nothing to turn — the light stays hollow and inert')
  assert.equal(of({rows: [{...on, writePath: undefined}], values: {on: true}}), null, 'a reading row: a light only')
  assert.equal(of({values: {on: true}, submit: undefined}), null, 'no owner write')
  assert.equal(of({values: {on: true}, enabledKey: undefined}), null, 'no light')
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

test('compact is the kit\'s plate: activator, ▾, name and ⤢ on the head; the picture in its 140 × 146 well beside the controls; no Send', () => {
  const out = html(createElement(DeviceView, {device: probe, size: 'compact', picture: createElement('i', {id: 'pic'}), actions}))
  assert.match(out, /<div class="device device--compact" data-device="f:probe" data-device-size="compact" data-device-light="on"/)
  const head = out.match(/<header class="dp-head"[^>]*>[\s\S]*?<\/header>/)[0]
  assert.match(head, /^<header class="dp-head" data-i="Probe\|Show every setting in the pool"><button type="button" class="dp-activator" data-light="lit" aria-pressed="true"/,
    'the head says what pressing the plate does; the activator leads it, lit')
  assert.doesNotMatch(head.match(/<button type="button" class="dp-activator"[^>]*>/)[0], /disabled/, 'and a switch, since the owner writes it')
  assert.match(head, /<span class="dp-title">Probe<\/span>/)
  assert.ok(head.indexOf('aria-label="Fold Probe"') > 0 && head.indexOf('aria-label="Fold Probe"') < head.indexOf('aria-label="Open Probe full size in a pane"'), '▾ then ⤢, in the place\'s own words')
  assert.match(out, /<div class="dp-display" data-raw="true" style="width:140px;height:146px"[^>]*><div class="dv-picture"><i id="pic"><\/i><\/div><\/div>/, 'the picture in the well')
  assert.doesNotMatch(out, />Send<|>Cancel<|device-commit/, 'no Send button: a change goes when you let go (§5.2, §11)')
})

test('compact draws a ranged number as a dial, a few choices as a radio, a switch as a toggle, a reading as a readout — at most four', () => {
  const out = html(createElement(DeviceView, {device: probe, size: 'compact', picture: null}))
  const param = key => out.match(new RegExp(`<div class="dv-param" data-param="${key}"[^>]*>[\\s\\S]*?(?=<div class="dv-param"|</div></div></div></section>)`))[0]
  assert.match(param('size'), /data-control="dial"/); assert.match(param('size'), /<svg class="dp-dial" viewBox="0 0 28 28" role="slider"[^>]*aria-valuenow="15"/)
  assert.match(param('size'), /class="dp-dial-value"/, 'the owner\'s value is the teal arc'); assert.match(param('size'), /<span class="dp-value">15 pt<\/span>/)
  assert.match(param('style'), /data-control="radio(-stack)?"/); assert.match(param('style'), /role="radio" aria-checked="true">Body</, 'the owner\'s choice is lit')
  assert.match(param('bound'), /class="dp-toggle"[^>]*aria-pressed="false">Bound</, 'off, as the owner reads it')
  assert.match(param('count'), /<output class="dp-readout-value">3 highlights<\/output><span class="dp-label">In this document<\/span>/)
  assert.doesNotMatch(out, /data-param="on"/, 'the light\'s row is the activator, not one of the four')
  assert.ok((out.match(/data-param=/g) ?? []).length <= 4)
})

test('with no reading nothing is lit: the activator hollow and inert, no arc and no needle, no choice lit, "—" for every value', () => {
  const dark = device({rows: probe.rows, values: {}, enabledKey: 'on'})
  const out = html(createElement(DeviceView, {device: dark, size: 'compact', picture: null, actions}))
  assert.match(out, /data-device-light="unknown"/)
  assert.match(out, /<button type="button" class="dp-activator" data-light="unknown"[^>]*disabled=""/, 'a light only: nothing to turn')
  assert.doesNotMatch(out, /dp-dial-value|dp-dial-needle/, 'no default drawn as a value')
  assert.doesNotMatch(out, /aria-checked="true"|aria-pressed="true"/)
  assert.match(out, /data-unread="true"/); assert.match(out, /<span class="dp-value">—<\/span>/, 'the dial says there is no reading')
  assert.match(out, /class="dp-toggle"[^>]*data-unknown="true"/, 'a switch the owner has not read is neither on nor off')
  assert.match(out, /aria-disabled="true"/, 'and nothing to move from')
})

test('a held value shows who holds it in the head and under the control, with the hand-back that gives it back; a modulator is named', () => {
  const held = device({rows: [row('depth', {title: 'Depth'})], values: {depth: 0.4}, heldBy: {depth: 'Fizz'}, handBack: async () => {}, submit: async () => {}})
  const out = html(createElement(DeviceView, {device: held, size: 'compact', picture: null}))
  assert.match(out, /<span class="dp-head-held"[^>]*>Fizz<\/span>/, 'the held mark in the head (§4.1)')
  assert.match(out, /data-param="depth" data-held-by="Fizz"/)
  assert.match(out, /data-held="true"/, 'the arc in the stall colour (§6)')
  assert.match(out, /<button type="button" class="dp-handback" aria-label="Give Depth back to Fizz"[^>]*>Fizz<\/button>/, 'press the name to give it back')
  const moved = html(createElement(DeviceView, {device: device({rows: [row('turns', {title: 'Turns', modulatedBy: 'Mars'})], values: {turns: 0.5}}), size: 'compact', picture: null}))
  assert.match(moved, /data-i="Turns\|[^"]*Mars moves this value\.[^"]*"[^>]*data-modulated="true"/, 'the status bar names the modulator')
})

test('the plate the pool shows is marked selected on the chain; ▾ folds every chain view of the device to its strip', () => {
  door.selectDevice('f:probe')
  try {
    assert.match(html(createElement(DeviceView, {device: probe, size: 'compact', picture: null, actions})), /data-device-selected="true"/)
    assert.doesNotMatch(html(createElement(DeviceView, {device: probe, size: 'whole', picture: null})), /data-device-selected/, 'the pool itself is not marked')
  } finally { door.selectDevice(null) }
  host.setHostFolded('f:probe', true)
  try {
    const folded = html(createElement(DeviceView, {device: probe, size: 'compact', picture: null, actions}))
    assert.match(folded, /class="device device--compact device--folded"/)
    assert.match(folded, /<section class="dp-folded" aria-label="Probe, folded"><span class="dp-activator" data-light="lit"><\/span><button type="button" class="dp-folded-title"[^>]*aria-label="Unfold Probe"/)
    assert.match(folded, /class="dp-folded-reading">15 pt</, 'up to two readings, read downward')
  } finally { host.setHostFolded('f:probe', false) }
  const plate = html(createElement(controls.FacePlate, {presentation: {family: 'f', faceId: 'probe', title: 'Probe', icon: 'form', owner: 'f'}, power: 'off', folded: true, onFold: () => {}}, createElement('i', {id: 'body'})))
  assert.match(plate, /<section class="sdk-face sdk-face--folded" aria-label="Probe">/, 'the SDK\'s own plate still folds for the families that draw it')
})

test('whole is every row by its group, in declared order, beside the picture in its 194 × 146 well; full is the material and no controls', () => {
  const grouped = device({...probe, rows: probe.rows.map(r => r.key === 'size' ? {...r, group: 'Type'} : r)})
  const whole = html(createElement(DeviceView, {device: grouped, size: 'whole', picture: createElement('i', {id: 'pic'})}))
  const full = html(createElement(DeviceView, {device: grouped, size: 'full', picture: createElement('i', {id: 'pic'})}))
  assert.match(whole, /<section class="dp" data-view="whole"/)
  assert.match(whole, /<div class="dp-display" data-raw="true" style="width:194px;height:146px"/)
  const labels = [...whole.matchAll(/<div class="dp-sec-label">([^<]+)<\/div>/g)].map(match => match[1])
  assert.deepEqual(labels, ['Type', 'Probe'], 'a section per group, in the order the device declares them')
  assert.doesNotMatch(whole, /aria-label="Fold Probe"/, 'only the chain folds')
  const params = [...whole.matchAll(/data-param="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual([...params].sort(), grouped.rows.map(r => r.key).filter(key => key !== 'on').sort(), 'every row but the activator\'s own')
  assert.match(full, /data-device-size="full"/); assert.match(full, /<div class="dv-full"[^>]*><i id="pic"><\/i><\/div>/, 'the material at pane size')
  assert.doesNotMatch(full, /data-param=|role="slider"|class="dp-head"/, 'a pane holds no device controls (DLW §16.1)')
})

// ── the sheets: the kit's measures, its tokens, the places ─────────────────────────────────────────────────────────────

const css = async path => (await readFile(new URL(path, import.meta.url), 'utf8'))

test('the sheets hold DEVICE-UI §3\'s measures and the shell\'s tokens; nothing in a place scrolls', async () => {
  const devices = await css('../src/frame/devices/devices.css'), kit = await css('../src/inhabitants/sdk/panel.css')
  assert.match(kit, /--dp-head-h: 22px; --dp-body: 168px;/, 'head 22, band 168')
  assert.match(kit, /\.dp-dial \{ width: 28px; height: 28px;/)
  assert.match(kit, /\.dp-box \{[^}]*min-width: 50px; height: 16px;/)
  assert.match(kit, /\.dp-row \{[^}]*height: 17px;/)
  assert.match(kit, /\.dp-sec-label \{[^}]*height: 13px; font-size: 9px;[^}]*text-transform: uppercase;/)
  assert.match(kit, /\.dp-folded \{[^}]*width: 22px;/)
  assert.match(kit, /\.dp-tile \{[^}]*width: 136px; height: 136px;/); assert.match(kit, /\.dp-tile\[data-span="2"\] \{ width: 280px; \}/)
  assert.match(devices, /\.device--whole > \.dp \{ width: 400px \}/, 'the pool\'s plate is 400 wide')
  assert.match(kit, /:root \{[^}]*--dp-face: var\(--bg-2[^}]*--dp-well: color-mix\(in srgb, var\(--bg-0[^}]*--dp-value: var\(--fizz[^}]*--dp-on: var\(--accent/, 'the kit\'s colours are the shell\'s tokens, at :root')
  for (const sheet of [devices, kit]) {
    assert.doesNotMatch(sheet.replace(/var\([^;]*\)/g, ''), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'no raw colour outside a token\'s own fallback')
    assert.doesNotMatch(sheet, /overflow(-[xy])?: (auto|scroll)/, 'no scroller')
  }
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
