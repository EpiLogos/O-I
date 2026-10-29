import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Manual §16.10 "Disabled: The control at 40 % strength. The status bar says why." (O-I #742): a refused transport slot puts its reason
// in its data-i, the line the status bar reads, as well as in its title. Record walk before Arm is the first case.
// Loader as f7-transport.test.mjs.
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
const {Transport} = await import('../src/frame/transport/Transport.tsx')
const {walkBindings} = await import('../src/projections/atlas/places/placesTransport.ts')
const {WALK_NOT_ARMED} = await import('../src/projections/atlas/walks/walkSession.ts')
const {slotMeaning} = await import('../src/shell/modeGrammar.ts')

const words = id => ({label: id, fn: `does ${id}`, dataI: `${id}|does ${id}`, waiting: `${id} waits`})
const html = (bindings, w = words) => renderToStaticMarkup(React.createElement(Transport, {bindings, words: w}))
const dataI = (markup, id) => [...markup.matchAll(new RegExp(`<[^>]*data-slot="${id}"[^>]*>`, 'g'))].map(m => m[0].match(/data-i="([^"]*)"/)?.[1] ?? '')
const unescape = text => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')

test('a refused slot says why on the status bar: its reason stands in its data-i after what it does', () => {
  const markup = html({record: {press() {}, refused: 'the owner refused'}, play: {press() {}}, tempo: {step() {}, refused: 'no pace yet', readout: {value: '6 s', title: 't'}}})
  assert.deepEqual(dataI(markup, 'record'), ['record|does record. the owner refused'])
  assert.deepEqual(dataI(markup, 'play'), ['play|does play'], 'a slot that is not refused says only what it does')
  const tempo = dataI(markup, 'tempo')
  assert.ok(tempo.length > 0 && tempo.every(line => line.endsWith('. no pace yet')), `every part of a refused stepped slot says why: ${tempo}`)
})

test('Record walk before Arm: the status bar names Arm', () => {
  const state = {bound: true, armed: false, recording: null, reading: {phase: 'none'}, busy: false, playing: null, line: null}
  const acts = {arm() {}, record() {}, stop() {}, capture() {}, tempo() {}, play() {}, halt() {}}
  const bindings = walkBindings(state, acts, null, 6000)
  const techne = id => { const meaning = slotMeaning('techne', id); return {label: meaning.label, fn: meaning.fn, dataI: `${meaning.label}|${meaning.fn}`, waiting: ''} }
  const line = unescape(dataI(html(bindings, techne), 'record')[0])
  assert.equal(line, `Record walk|record a new walk from your encounters. ${WALK_NOT_ARMED}`)
})
