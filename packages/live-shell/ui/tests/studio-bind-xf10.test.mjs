import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// XF10 of the walk of O-I #857 (round 53; DLW build ruling 2026-11-09): Reach on a symbol's macro. The story: "Follow moves the selected
// symbol's parameter; Bind keeps to one symbol. A bound symbol that is not in the scene makes the macro say so and wait." Bind keeps the
// control on the symbol it acts on now (studioBinding.ts `bind`: the control's own symbol, else the one symbol selected). The walk
// (r52-XF10-b-01, r53-XF10) pressed Bind on a Follow macro with no symbol under it: the owner's refusal stood only in the group's hover
// words, and Bind looked as pressable as before. Bind is disabled there, with its reason; with a symbol under the control it stands
// enabled; a bound symbol absent from the scene makes the macro say so, in the owner's words. SCRIPTED: the Studio's design rendered to
// markup over the design's own value keys.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {design} = await import('../src/inhabitants/catalogue/panels/expressions__studio.tsx')

const control = (over) => ({id: 'm1', label: 'Rotation', scope: 'selected', subject: 'Heart', min: -180, max: 180, step: 1, log: false, def: 0, unit: 'degrees', plays: null, locked: false, why: null, ...over})
/** The Studio's whole, Macros page, with `controls` (the first stands chosen). */
const whole = controls => renderToStaticMarkup(createElement(() => design.whole({v: {...design.defaults, controls: JSON.stringify(controls), 'control:m1': 0},
  set() {}, nav: {}, page: 'macros', setPage() {}, standing: {}, owner: design.defaults, frame: 'pane'})))
/** The Reach option `label` as drawn: disabled or not, and its hover words. */
const option = (html, label) => {
  const match = new RegExp(`<button[^>]*role="radio"[^>]*>${label}</button>`).exec(html)
  assert.ok(match, `Reach draws ${label}`)
  return {disabled: / disabled=""/.test(match[0]), words: /data-i="([^"]*)"/.exec(match[0])?.[1] ?? ''}
}

test('a Follow macro with no symbol under it: Bind stands disabled and says why', () => {
  const bind = option(whole([control({subject: null, min: null, max: null, why: 'Select an object for this Follow control'})]), 'Bind')
  assert.equal(bind.disabled, true, 'Bind cannot keep a control on no symbol')
  assert.match(bind.words, /Select the one symbol to bind it to first\./)
})

test('a Follow macro on a symbol: Bind stands enabled, to keep the control on that symbol', () => {
  const html = whole([control({})])
  assert.equal(option(html, 'Bind').disabled, false)
  assert.equal(option(html, 'Follow').disabled, false)
})

test('a bound symbol absent from the scene: the macro says so in the owner\'s words', () => {
  const html = whole([control({scope: 'named', subject: null, min: null, max: null, why: 'The bound object is absent from this Scene'})])
  assert.match(html, /The bound object is absent from this Scene/)
})
