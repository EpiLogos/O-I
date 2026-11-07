// O-I #747 round 889, XS06 ("I set how long a scene holds and how long its change to the next takes": §20.1 The Clip panel, Duration,
// Transition): the Clip panel's Duration and Transition run over the owner's own range, 1–3600 s and 0–30 s (sceneEdits.ts pacing,
// SCENE_PACING), so the dial reaches every value the owner takes and none it refuses. Duration runs on a log scale (a second and an hour
// on one dial) and keeps half seconds; Transition runs in half seconds.
// - SCRIPTED: the panel's element tree read as drawn; the dial's own scale arithmetic (sdk/panel.tsx fromUnit); the act it calls is recorded.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
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
const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis
const {ValueBox, fromUnit} = await import('../src/inhabitants/sdk/panel.tsx')
const {clip} = await import('../src/inhabitants/catalogue/clips/expressions.tsx')
const {SCENE_PACING} = await import('../../../expressions-boundary/src/scenePacing.ts')

function* elements(node) {
  if (Array.isArray(node)) { for (const child of node) yield* elements(child); return }
  if (!node || typeof node !== 'object' || !('props' in node)) return
  yield node
  yield* elements(node.props.children)
}
const panel = clip.panel.find(tab => tab.id === 'clip')
const draw = v => { const set = []; return {set, tree: [...elements(panel.draw({v, set: (key, value) => set.push([key, value]), size: 'regular', room: {w: 800, h: 400}}))]} }
const dial = (tree, label) => tree.find(element => element.type === ValueBox && element.props.label === label)

test('XS06: the law is the owner\'s: a scene holds 1–3600 s and changes over 0–30 s', () => {
  assert.deepEqual(SCENE_PACING, {duration: {min: 1, max: 3600}, transition: {min: 0, max: 30}})
})

test('XS06: Duration\'s dial runs 1–3600 s, a second to an hour on one dial, and keeps half seconds', () => {
  const {set, tree} = draw(clip.defaults)
  const duration = dial(tree, 'Duration')
  assert.ok(duration, 'the panel draws Duration')
  const {scale} = duration.props
  assert.deepEqual([scale.min, scale.max], [1, 3600], 'its range is the law\'s')
  assert.equal(fromUnit(scale, 0), 1, 'all the way down: one second')
  assert.equal(fromUnit(scale, 1), 3600, 'all the way up: an hour')
  assert.ok(fromUnit(scale, 0.5) > 50 && fromUnit(scale, 0.5) < 70, 'half way is about a minute: a log dial')
  duration.props.onChange(37.284)
  duration.props.onChange(1.2)
  assert.deepEqual(set, [['duration', 37.5], ['duration', 1]], 'a value moved to is kept to the half second, inside the law')
})

test('XS06: Transition\'s dial runs 0–30 s in half seconds: a cut, or a slow swell longer than the scene', () => {
  const {set, tree} = draw(clip.defaults)
  const transition = dial(tree, 'Transition')
  const {scale} = transition.props
  assert.deepEqual([scale.min, scale.max, scale.step], [0, 30, 0.5])
  assert.equal(fromUnit(scale, 0), 0, 'a cut')
  assert.equal(fromUnit(scale, 1), 30, 'and no further than the law')
  transition.props.onChange(20)
  assert.deepEqual(set, [['transition', 20]])
})
