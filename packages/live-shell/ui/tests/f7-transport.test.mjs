import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// FOUNDATION F7: one transport. 28 slots in Live's places, the same marks in every mode; a slot is enabled only by a
// binding with a write path; a light shows only a reading; text appears only in readouts. The frame knows no mode.
// Loader as live-browser-chain.test.mjs.
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
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const {Transport} = await import('../src/frame/transport/Transport.tsx')
const {ModeTransport, MODE_TRANSPORT} = await import('../src/shell/modeTransports.tsx')
const {TRANSPORT_SLOT_IDS} = await import('../src/shell/modeGrammar.ts')

const slotsOf = markup => [...markup.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1]).filter((id, i, all) => all.indexOf(id) === i)
const words = id => ({label: id, fn: `does ${id}`, dataI: `${id}|does ${id}`, waiting: `${id} waits`})

test('every mode draws the same 28 slots in the same places', () => {
  assert.deepEqual(Object.keys(MODE_TRANSPORT).sort(), [...SURF_MODES].sort())
  const reading = {tempoBpm: null}
  const orders = SURF_MODES.map(mode => slotsOf(renderToStaticMarkup(React.createElement(ModeTransport, {mode, reading}))))
  for (const order of orders) assert.deepEqual(order, [...TRANSPORT_SLOT_IDS], 'the fixed order, every slot')
  assert.equal(TRANSPORT_SLOT_IDS.length, 28)
})

test('a slot is enabled only by a write path; a light only by a reading; a refusal keeps it drawn with its reason', () => {
  const html = bindings => renderToStaticMarkup(React.createElement(Transport, {bindings, words}))
  const tag = (markup, id) => markup.match(new RegExp(`<button[^>]*data-slot="${id}"[^>]*>`))?.[0] ?? ''
  const bare = html({})
  for (const id of ['play', 'stop', 'record', 'link', 'quantize', 'key']) assert.match(tag(bare, id), /disabled=""/, `${id} unbound is disabled`)
  assert.doesNotMatch(bare, /data-light=/, 'no light without a reading')
  const bound = html({play: {press() {}, lit: true}, stop: {press() {}, lit: false}, record: {press() {}, refused: 'the owner refused'}})
  assert.doesNotMatch(tag(bound, 'play'), /disabled=""/); assert.match(tag(bound, 'play'), /data-light="on"/)
  assert.match(tag(bound, 'stop'), /data-light="off"/)
  assert.match(tag(bound, 'record'), /disabled=""/); assert.match(tag(bound, 'record'), /the owner refused/)
  assert.match(html({tempo: {readout: {value: '120.00', title: 't'}}}), />120\.00</, 'a readout shows the owner\'s value')
})

test('the frame\'s transport names no mode', async () => {
  for (const file of ['frame/transport/Transport.tsx', 'frame/transport/slots.ts']) {
    assert.doesNotMatch(await source(file), /'(live|base|factory|expressions|techne|audio)'/, `${file} names no mode`)
  }
})
