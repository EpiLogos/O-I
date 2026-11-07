// O-I #747 round 892, the walk's finding on XS09 (walk 19, captures-19/44-launch-tab-triggers.png): the Launch tab of a scene's Clip view
// listed its triggers by their kernel refs ("expression:authored-walk890-dawn:trigger:jump-mw6oa44x-1oqu6kb", cut at the chooser's width),
// where the Scene body & Jump device lists the same triggers by what they do ("Scene enters Jump to Dawn"). A trigger reads by when it acts
// and what it reaches — the scene it jumps to by that scene's title, a portal by its placement — short enough to stand whole in the
// chooser (walk 20 found "Scene enters · Jump to Dawn" cut there too); two that read the same are told apart by their place. The ref stays
// the chooser's value: it is what the owner keeps the trigger by.
// - SCRIPTED: the scene's readings on the design's keys (clipBinding.ts expressionsClipValues) over a hand-made owner reading; the Launch
//   panel's element tree read as drawn.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)
const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
const {expressionsClipValues} = await import('../src/components/expressions/clip/clipBinding.ts')
const {clip} = await import('../src/inhabitants/catalogue/clips/expressions.tsx')
const {Chooser} = await import('../src/inhabitants/sdk/panel.tsx')

const E = 'expression:whole', DUSK = `${E}:scene:dusk`, DAWN = `${E}:scene:dawn`, NOON = `${E}:scene:noon`
const ref = id => `${E}:trigger:${id}`
/** The owner's reading of Dusk, which keeps four triggers: an enter jump to Dawn, two that read the same, and a portal. */
const reading = {
  basis: {expression_ref: E, scene_ref: DUSK, revision: 9},
  scene: {name: 'Dusk', duration: 12, transition: 1, entities: [], automation: [], text: [], composition: {plane: 'XY'}},
  selection: {entity_ids: [], step_id: null},
  scenes: {scenes: [{scene_ref: DAWN, title: 'Dawn'}, {scene_ref: NOON, title: 'Noon'}, {scene_ref: DUSK, title: 'Dusk'}]},
  nativeScene: {body: null, triggers: [
    {trigger_ref: ref('jump-mw6oa44x-1oqu6kb'), occasion: 'scene_enter', target: {kind: 'navigate', scene_ref: DAWN}},
    {trigger_ref: ref('jump-a'), occasion: 'select', target: {kind: 'navigate', scene_ref: NOON}},
    {trigger_ref: ref('jump-b'), occasion: 'select', target: {kind: 'navigate', scene_ref: NOON}},
    {trigger_ref: ref('portal-c'), occasion: 'activate', target: {kind: 'portal', placement: 'beside', subject_ref: 'wiki:node:central'}},
  ]},
}

test('r892 (walk 19): the scene\'s triggers read on the Launch tab by what they do, never by their refs; the ref stays what each is kept by', () => {
  const triggers = JSON.parse(expressionsClipValues(reading).triggers)
  assert.deepEqual(triggers.map(trigger => trigger.name), reading.nativeScene.triggers.map(trigger => trigger.trigger_ref), 'each is still kept by its ref')
  assert.deepEqual(triggers.map(trigger => trigger.label), ['Enters → Dawn', 'Selected → Noon', 'Selected → Noon (2)', 'Activated → Beside portal'])
})

function* elements(node) {
  if (Array.isArray(node)) { for (const child of node) yield* elements(child); return }
  if (!node || typeof node !== 'object' || !('props' in node)) return
  yield node
  yield* elements(node.props.children)
}

test('r892 (walk 19): the Launch tab\'s Trigger chooser offers each trigger by what it reads, and chooses it by its ref', () => {
  const values = {...clip.defaults, ...expressionsClipValues(reading), trigger: ref('jump-a')}
  const set = []
  const launch = clip.panel.find(tab => tab.id === 'launch')
  const chooser = [...elements(launch.draw({v: values, set: (key, value) => set.push([key, value]), size: 'regular', room: {w: 300, h: 600}}))]
    .find(element => element.type === Chooser && element.props.label === 'Trigger')
  assert.ok(chooser, 'the Launch tab draws its Trigger chooser')
  assert.deepEqual(chooser.props.options.map(option => option.label), ['Enters → Dawn', 'Selected → Noon', 'Selected → Noon (2)', 'Activated → Beside portal'])
  assert.equal(chooser.props.options.some(option => /^expression:/.test(option.label)), false, 'no option reads as a ref')
  assert.equal(chooser.props.value, ref('jump-a'))
  const row = [...elements(launch.draw({v: values, set: noop, size: 'regular', room: {w: 300, h: 600}}))].find(element => element.props.label === 'Trigger' && element.type !== Chooser)
  assert.equal(row?.props.under, true, 'the chooser stands on the whole line under its label, as When and Does do')
  chooser.props.onChange(ref('jump-b'))
  assert.deepEqual(set, [['trigger', ref('jump-b')]])
})

// CODE-READING: the design's own fixtures name their triggers without a label, and still read (the chooser falls back to the name).
test('r892: a trigger with no label reads by its name, as the design\'s fixtures do', async () => {
  const source = await readFile(new URL('../src/inhabitants/catalogue/clips/expressions.tsx', import.meta.url), 'utf8')
  assert.match(source, /options=\{triggers\.map\(t => \(\{value: t\.name, label: t\.label \?\? t\.name\}\)\)\}/)
})
