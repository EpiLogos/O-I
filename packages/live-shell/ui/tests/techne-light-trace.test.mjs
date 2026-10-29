import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Light on the Canvas (the catalogue's techne:light, carried as the Canvas's Light page; O-I #684): Technē's light trace (techne/devices/
// lightTrace.ts traceRays) over the Canvas positions — the cards' centres and the lines the frame reports — by the design's law: light
// leaves the source card and follows the lines up to Bounces deep, a card shares what it receives equally among its lines out, a line passes
// the share its standing allows and loses e^(−length/4000), and each element changes what leaves its card. The design's own trace is the
// display law, so the engine must give the design's numbers on the design's boards. The bench's settings are the person's own (view holds);
// the sensors' power is the engine's reading. Nothing is drawn by chance.
// Channels:
// - DESIGN: the catalogue's Seven centres board and its Light fixtures (techne__canvas.tsx), whose sensor readings the design says the law gives.
// - SCRIPTED: the frame's board as canvasValues reports it (items and lines, which carry no standing today), and a stand-in hold.
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

const {traceRays, boardOf} = await import('../src/techne/devices/lightTrace.ts')
const fx = await import('../src/techne/devices/effectBindings.ts')
const holds = await import('../src/techne/devices/designDevices.ts')
const canvasDesign = await import('../src/inhabitants/catalogue/panels/techne__canvas.tsx')
const D = canvasDesign.design

const settingsOf = v => ({on: v['light.on'] === true, source: v['light.source'], elements: JSON.parse(v['light.elements'] ?? '[]'), bounces: v['light.bounces'],
  tx: {fact: v['tx.fact'], claim: v['tx.claim'], inference: v['tx.inference'], guess: v['tx.guess']}})
const round = x => Math.round(x * 1000) / 1000

test('the engine gives the design\'s numbers on the design\'s boards: the Seven centres, a funnel at the heart, guesses that pass little', () => {
  for (const name of ['Seven centres', 'A funnel at the heart', 'Guesses pass little']) {
    const v = {...D.defaults, ...D.fixtures[name]}
    const read = traceRays(boardOf(v), settingsOf(v))
    const expected = JSON.parse(v['sensor.power'])
    assert.deepEqual(read.sensors.map(s => ({at: s.at, power: round(s.power)})), expected, name)
    // The design's own trace, the display law, agrees card by card.
    const drawn = canvasDesign.trace(v)
    for (const [card, load] of drawn.cardLoad) assert.ok(Math.abs((read.cards[card] ?? 0) - load) < 1e-12, `${name}: ${card}`)
  }
})

test('light that is off, or has no source on the board, reads nothing', () => {
  const v = {...D.defaults}
  assert.deepEqual(traceRays(boardOf(v), {...settingsOf(v), on: false}).sensors.map(s => s.power), [0, 0])
  assert.deepEqual(traceRays(boardOf(v), {...settingsOf(v), source: 'Nowhere'}).cards, {})
})

const board = (lines = [['Root', 'Sacral'], ['Sacral', 'Solar']]) => ({
  items: JSON.stringify([{id: 'Root', kind: 'card', x: 0, y: 0, w: 94, h: 94, name: 'Root'}, {id: 'Sacral', kind: 'card', x: 200, y: 0, w: 94, h: 94, name: 'Sacral'},
    {id: 'Solar', kind: 'card', x: 400, y: 0, w: 94, h: 94, name: 'Solar'}]),
  lines: JSON.stringify(lines)})

test('Light reads the board the frame reports: its settings the view\'s, its sensors the engine\'s; a line with no standing passes nothing, and says so', () => {
  holds.resetHolds?.()
  const unheld = fx.lightBinding(board(), {})
  assert.equal(unheld.values['light.bounces'], 35, 'the starting values until you set your own')
  assert.equal(unheld.values['tx.claim'], 85)
  assert.equal(unheld.values['light.on'], false, 'the light is off until you turn it on')
  assert.match(unheld.standing['sensor.power'].disabled, /Turn the light on/)
  for (const key of ['light.on', 'light.source', 'light.elements', 'tx.fact']) assert.equal(typeof unheld.local[key], 'function', `${key} is the view's`)
  const on = {'light.on': true, 'light.source': 'Root', 'light.elements': JSON.stringify([{at: 'Solar', kind: 'sensor'}])}
  const dark = fx.lightBinding(board(), on)
  assert.deepEqual(JSON.parse(dark.values['sensor.power']), [{at: 'Solar', power: 0}], 'the frame\'s lines carry no standing, so none passes light')
  assert.match(dark.standing['sensor.power'].disabled, /no standing/)
  const lit = fx.lightBinding(board([['Root', 'Sacral', 'fact'], ['Sacral', 'Solar', 'claim']]), on)
  const [solar] = JSON.parse(lit.values['sensor.power'])
  assert.ok(Math.abs(solar.power - 0.85 * Math.exp(-400 / 4000)) < 1e-12, 'a fact passes all, a claim 85 %, each line losing to its length')
  assert.equal(fx.lightBinding({}, on).standing['sensor.power'].disabled, fx.LIGHT_NO_BOARD)
})

test('the Canvas carries Light\'s hands: a change of the bench is held by the view, the Canvas\'s own keys stay the Canvas\'s', () => {
  const canvas = {id: 'techne:canvas', values: {zoom: 100}, standing: {}, writes: () => false}
  const light = fx.lightBinding(board(), {})
  const carried = fx.canvasCarryingLight(canvas, light)
  assert.equal(typeof carried.local['light.on'], 'function')
  assert.equal(carried.values.zoom, 100)
  assert.equal(carried.values['tx.guess'], 35)
})
