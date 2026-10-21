// Link in the transport (manual §19.19, §16.1; HANDOFF-BUILD item 10): one Link in every mode — the transport's button, ▾ beside it
// expanding its Whole, the same device on the rail and in a pane, published once from the transport.
// - REAL: tests/fixtures/workcell-readings-2026-10-16.json (`workcell status`, `aikit gateway who`) as read on workcell:mac.
// - SCRIPTED: the slot rendered to static markup with no carrier.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

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
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}, addEventListener() {}, removeEventListener() {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {LinkSlot, linkButtonWords} = await import('../src/frame/transport/LinkSlot.tsx')
const cell = await import('../src/agent/devices/workcellBindings.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
family.resetFamilyManifestsForTest()
loadAgentShellFamilies()
const REAL = JSON.parse(readFileSync(new URL('./fixtures/workcell-readings-2026-10-16.json', import.meta.url), 'utf8'))
const answered = value => ({status: 'answered', value, error: null})

test('the Link button\'s light and words are the Link\'s own readings: the machines that answered, else the state, and why it cannot join', () => {
  const values = cell.linkValues(answered(REAL.workcellStatus), bind.chainHolds(), answered(REAL.population))
  const words = linkButtonWords(values)
  assert.equal(words.lit, false, 'omarchy answered unreachable: dark')
  assert.match(words.title, /0 of 1 machine answers/)
  assert.match(words.title, /missing op: aikit gateway remote add · remove through the kernel/)
  const unread = linkButtonWords({})
  assert.equal(unread.lit, undefined)
  assert.match(unread.title, /unread: no owner has answered for the link yet/)
})

test('the transport draws Link\'s button, disabled with the operation it lacks, and ▾ beside it; its Whole only while ▾ is pressed', () => {
  const markup = renderToStaticMarkup(React.createElement(LinkSlot))
  assert.match(markup, /<button[^>]*data-slot="link"[^>]*disabled=""/)
  assert.match(markup, /aria-label="Link&#x27;s settings" aria-expanded="false"/)
  assert.doesNotMatch(markup, /transport-link-band/, 'folded until ▾')
  assert.equal(cell.LINK_ID, 'factory:main:link')
})

test('Link stands on no chain: its views are Whole (from ▾), Full and its tile', async () => {
  const {design} = await import('../src/inhabitants/catalogue/panels/workcell__link.tsx')
  assert.equal(design.kind, 'connection')
  assert.deepEqual(design.views, ['whole', 'full', 'widget'])
  const source = readFileSync(new URL('../src/agent/devices/FactoryDeviceChain.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /LINK_ID|linkBinding/, 'Factory\'s chain neither places nor publishes the Link: the transport does')
})
