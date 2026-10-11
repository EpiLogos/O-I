import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production sources in memory, same loader as the sibling native tests: .ts/.tsx
// is transpiled, .css is a non-executing stub. The strip is rendered through
// react-dom/server; no frame, store or engine is simulated, and no click or drag is.
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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const [strip, slots, pin, parameters] = await Promise.all([
  import('../src/components/NativeBarStrip.tsx'),
  import('../src/components/nativeBarSlots.ts'),
  import('../src/components/nativePinMode.ts'),
  import('@epilogos/expressions-boundary/parameters'),
])
const {BarStrip} = strip
const {SEED_SLOTS, barMacroCreate, readHiddenSlots} = slots
const {baseValue, NATIVE_BINDINGS} = parameters
const {pinScopeMark} = pin

const SCENE = 'expression:whole:scene:main'
const ON = {volumeEnabled: true, resonanceEnabled: true, relationalEnabled: true}
const binding = path => NATIVE_BINDINGS.find(item => item.path === path)
const SHAPE_HOLD = SEED_SLOTS.find(slot => slot.id === 'shape-hold').macro
/** A minimal NativeEditorReading: the strip reads the Scene, the chosen controls, the sharing and the observation. The rest is inert. */
const view = ({engine = {}, params = {}, automation = [], entries = [], sharedTargets = [], racks, observation} = {}) => ({
  basis: {expression_ref: 'expression:whole', revision: 1, scene_ref: SCENE, authored_revision: 1},
  scene: {scene_ref: SCENE, field: {params}, engine: {pointerMode: 'attract', ...engine}, automation, ...(racks ? {parameterRacks: racks} : {})},
  observation, entityOccurrences: {}, chosenControls: {available: true, entries, controls: []}, sharedTargets,
  devices: [], selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
  standing: {dirty: false, pending: false, notice: null},
})
const stub = async () => ({ok: true})
const render = (reading, options = {}) => renderToStaticMarkup(createElement(BarStrip, {reading, apply: stub, run: null, disabled: false, ...options}))
const tags = (markup, tag) => markup.match(new RegExp(`<${tag}[^>]*>`, 'g')) ?? []
const attr = (tag, name) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1]
const byLabel = (markup, tag, label) => tags(markup, tag).find(item => attr(item, 'aria-label') === label)
const rackOf = reading => ({schema: 'oi.parameter-racks/v1', racks: [barMacroCreate(reading, SHAPE_HOLD).rack]})

test('a null reading renders nothing', () => {
  assert.equal(render(null), '')
})

test('the seed fills the row in its owner-approved order, and Time Scale is not in the strip', () => {
  const markup = render(view({engine: ON}))
  const order = ['aria-label="Viscosity Damp"', '>Add Shape hold<', 'aria-label="3D"', 'aria-label="Particle size"', 'aria-label="Cymatic"',
    'aria-label="Relational"', 'aria-label="Turbulence"', 'aria-label="Ink Opacity"']
  const at = order.map(needle => markup.indexOf(needle))
  assert.ok(at.every(index => index >= 0), `every seed control renders: ${at}`)
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'seed controls render in the approved order')
  assert.equal(markup.includes('Time Scale'), false, 'Time Scale lives in the transport group, not the strip')
})

test('a toggle presses from the Scene: true, false, or no claimed state when the flag is unread', () => {
  const pressed = (engine, label = '3D') => attr(byLabel(render(view({engine})), 'button', label), 'aria-pressed')
  assert.equal(pressed({volumeEnabled: true}), 'true')
  assert.equal(pressed({volumeEnabled: false}), 'false')
  assert.equal(pressed({}), undefined, 'an unread flag claims no pressed state')
  assert.equal(pressed({resonanceEnabled: true}, 'Cymatic'), 'true', 'the Cymatic pair carries its own switch')
  assert.equal(pressed({relationalEnabled: false}, 'Relational'), 'false')
})

test('Particle size is a two-handle range: sliders over the registry hard bounds, with the sweet-spot band', () => {
  const low = binding('particleSize.min'), high = binding('particleSize.max')
  const reading = view({engine: ON})
  const markup = render(reading)
  const handle = name => tags(markup, 'span').find(item => attr(item, 'aria-label') === name)
  for (const name of ['Particle size minimum', 'Particle size maximum']) {
    const tag = handle(name)
    assert.ok(tag, `${name} renders`)
    assert.equal(attr(tag, 'role'), 'slider')
    assert.equal(attr(tag, 'aria-valuemin'), String(low.hardMin))
    assert.equal(attr(tag, 'aria-valuemax'), String(high.hardMax))
    assert.notEqual(attr(tag, 'aria-valuenow'), undefined, `${name} states its value`)
  }
  assert.equal(attr(handle('Particle size minimum'), 'aria-valuenow'), String(baseValue(reading.scene, low.key)))
  assert.match(markup, /class="bar-band" aria-hidden="true"/, 'the sweet-spot band is decorative and present')
})

test('the Shape hold macro is an add button until its rack exists, then a range over the macro value', () => {
  const reading = view({engine: ON})
  const empty = render(reading)
  assert.ok(empty.includes('>Add Shape hold<'), 'no rack yet: the add button renders')
  assert.match(empty, /class="bar-macro-add"/)
  const racked = render(view({engine: ON, racks: rackOf(reading)}))
  assert.equal(racked.includes('Add Shape hold'), false, 'with the rack present, no add button')
  const input = byLabel(racked, 'input', 'Shape hold')
  assert.ok(input, 'the macro range renders')
  assert.equal(attr(input, 'type'), 'range')
  assert.equal(attr(input, 'min'), '0')
  assert.equal(attr(input, 'max'), '1')
  assert.equal(attr(input, 'step'), '0.01')
})

test('a Field-pinned control renders after the seed with its scope mark', () => {
  const gravity = binding('fluid.gravityX')
  const reading = view({engine: ON, entries: [{id: 'b1', key: gravity.key, scope: 'field'}], sharedTargets: ['field.' + gravity.key]})
  const markup = render(reading)
  const expected = pinScopeMark(reading, {kind: 'field', path: 'fluid.gravityX'})
  assert.notEqual(expected, null, 'the pinned path is a shareable Field parameter')
  assert.ok(byLabel(markup, 'input', 'Gravity X'), 'the pinned control renders')
  assert.ok(markup.indexOf('aria-label="Gravity X"') > markup.indexOf('aria-label="Ink Opacity"'), 'the pin follows the seed')
  assert.match(markup, new RegExp(`class="pin-scope"[^>]*>${expected === 'shared' ? 'S' : 'L'}<`))
})

test('a pin that duplicates a seed path renders once', () => {
  const viscosity = binding('fluid.viscosity')
  const markup = render(view({engine: ON, entries: [{id: 'v1', key: viscosity.key, scope: 'field'}]}))
  assert.equal(markup.split('aria-label="Viscosity Damp"').length - 1, 1)
})

test('disabled disables every button and input, and every slider is aria-disabled', () => {
  const reading = view({engine: ON, entries: [{id: 'b1', key: binding('fluid.gravityX').key, scope: 'field'}]})
  const markup = render(view({engine: ON, racks: rackOf(reading), entries: reading.chosenControls.entries}), {disabled: true})
  const controls = [...tags(markup, 'button'), ...tags(markup, 'input')]
  assert.ok(controls.length > 10, 'the strip and its menu render controls')
  for (const tag of controls) assert.match(tag, / disabled=""/, tag)
  const sliders = tags(markup, 'span').filter(item => attr(item, 'role') === 'slider')
  assert.equal(sliders.length, 2)
  for (const tag of sliders) assert.equal(attr(tag, 'aria-disabled'), 'true')
})

test('the Cymatic plate size is disabled while the Cymatic field is off', () => {
  const plate = markup => tags(markup, 'input').find(tag => attr(tag, 'aria-label') === 'Plate Size')
  assert.match(plate(render(view({engine: {resonanceEnabled: false}}))), / disabled=""/)
  assert.equal(/ disabled=""/.test(plate(render(view({engine: ON})))), false)
})

test('the Controls menu lists every seed control except Time Scale, and offers Reset to defaults', () => {
  const markup = render(view({engine: ON}))
  const menu = markup.slice(markup.indexOf('<details'))
  for (const label of ['Viscosity Damp', 'Shape hold', '3D', 'Particle size', 'Cymatic', 'Relational', 'Turbulence', 'Ink Opacity']) {
    assert.ok(menu.includes(`>${label}</label>`), `the menu lists ${label}`)
  }
  assert.equal((menu.match(/class="bar-strip-option"/g) ?? []).length, 8)
  assert.equal(menu.includes('Time Scale'), false)
  assert.ok(menu.includes('Reset to defaults'))
})

test('a seed control this viewer hid is not in the row, and its menu checkbox is unchecked', () => {
  globalThis.localStorage.setItem('oi.live-shell.bar-hidden', JSON.stringify(['viscosity']))
  try {
    assert.deepEqual([...readHiddenSlots()], ['viscosity'])
    const markup = render(view({engine: ON}))
    assert.equal(markup.includes('aria-label="Viscosity Damp"'), false, 'the hidden control is not in the row')
    const box = markup.match(/<input type="checkbox"([^>]*)\/>Viscosity Damp<\/label>/)
    assert.ok(box, 'the menu still lists the hidden control')
    assert.equal(/ checked=""/.test(box[1]), false)
  } finally {
    globalThis.localStorage.removeItem('oi.live-shell.bar-hidden')
  }
})
