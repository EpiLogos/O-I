import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// XR09 of the walk of O-I #857 (round 53; DLW build ruling 2026-11-09): the Resonance device's Compatibility switch says the manual's
// words. §20.14: "The device also has a Compatibility switch: Resonator · Template (default Resonator). Template keeps the older fixed
// pattern." The walk read Continuous · Legacy templates in the Studio's Resonator page (r52-XR09-b-01). The switch is drawn in four
// places, and each says Resonator · Template over the same two values: the Resonance device's Resonator page, the field face's
// switches, the field device's parameter choices, and the frame's own inspector. SCRIPTED: the designs and faces rendered to markup.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {createElement, isValidElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const [{design}, view, {expressionsSettingChoices}] = await Promise.all([
  import('../src/inhabitants/catalogue/panels/expressions__resonance.tsx'),
  import('../src/components/NativeFieldFace.resonance.tsx'),
  import('../src/components/devices/expressionsDevice.ts'),
])

const WORDS = [['resonator', 'Resonator'], ['template', 'Template']]
const OLD = /Continuous|Legacy template/
/** The <option>s of the first <select> in the device's section labelled `label`, as [value, words]. */
const optionsIn = (html, label) => {
  const select = new RegExp(`<div class="dp-sec-label">${label}</div>.*?<select[^>]*>(.*?)</select>`).exec(html)?.[1]
  assert.ok(select, `a switch in the section ${label}`)
  return [...select.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(match => [match[1], match[2]])
}

test('the Resonance device\'s Resonator page says Compatibility: Resonator · Template, and why Template, in the manual\'s words', () => {
  const html = renderToStaticMarkup(createElement(() => design.whole({v: design.defaults, set() {}, nav: {}, page: 'body', setPage() {},
    standing: {}, owner: design.defaults, frame: 'pane'})))
  assert.deepEqual(optionsIn(html, 'Compatibility'), WORDS)
  const section = /<div class="dp-sec-label">Compatibility<\/div>(.*?)<\/select>/.exec(html)[1]
  assert.match(section, /Template keeps the older fixed pattern\./)
  assert.doesNotMatch(section, OLD)
})

test('the field face\'s switch says Resonator · Template over the same values', () => {
  const els = []
  const walk = node => { if (Array.isArray(node)) node.forEach(walk); else if (isValidElement(node)) { els.push(node); walk(node.props.children) } }
  const reading = {basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene: {name: 'Fixture', entities: [], engine: {resonanceEnabled: true, resonatorMode: 'resonator'}, composition: {frequencyDriver: 'manual'},
      field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}},
    entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}}
  walk(view.resonanceFaceView.switches({reading, disabled: false, apply: async () => ({ok: true})}))
  const select = els.find(el => el.type === 'select' && el.props['aria-label'] === 'Medium implementation')
  assert.ok(select, 'the face draws the switch')
  const options = [select.props.children].flat(Infinity).filter(isValidElement).map(option => [option.props.value, [option.props.children].flat().join('')])
  assert.deepEqual(options, WORDS)
})

test('the field device\'s Compatibility choices say Resonator · Template', () => {
  assert.deepEqual(expressionsSettingChoices('resonance', 'resonatorMode').map(choice => [choice.value, choice.label]), WORDS)
})

test('the frame\'s inspector says Resonator · Template', async () => {
  const inspector = await readFile(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/inspector.ts', root), 'utf8')
  const line = inspector.split('\n').find(text => text.includes("'engine.resonatorMode'"))
  assert.ok(line, 'the inspector draws the switch')
  assert.match(line, /\['resonator','Resonator'\],\['template','Template'\]/)
  assert.doesNotMatch(line, OLD)
})
