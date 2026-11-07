// O-I #747 round 890, the walk's finding on XS06: on the Clip panel, Duration at one second and ArrowUp stayed one second. The log dial's
// key moves a hundredth of its throw (sdk/panel.tsx useScalar: toUnit + 0.01, then fromUnit), which near a second is less than a quarter
// second, and keeping the value to the half second rounded it straight back: below about three seconds the arrows did nothing, either way.
// A move the dial makes is never lost to the half second: where keeping it would give back the value it moved from, it goes on half a
// second in the direction moved, inside the law (1–3600 s). A drag runs through the same act.
// - SCRIPTED: the panel's element tree read as drawn; the dial's own key arithmetic (toUnit/fromUnit, as useScalar does it); the act recorded.
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
const {ValueBox, fromUnit, toUnit} = await import('../src/inhabitants/sdk/panel.tsx')
const {clip} = await import('../src/inhabitants/catalogue/clips/expressions.tsx')

function* elements(node) {
  if (Array.isArray(node)) { for (const child of node) yield* elements(child); return }
  if (!node || typeof node !== 'object' || !('props' in node)) return
  yield node
  yield* elements(node.props.children)
}
const panel = clip.panel.find(tab => tab.id === 'clip')
/** One key on the Duration dial as useScalar handles it: a hundredth of the throw (Shift: a thousandth), and the act it calls. */
function press(duration, key, shift = false) {
  const set = []
  const tree = [...elements(panel.draw({v: {...clip.defaults, duration}, set: (k, value) => set.push([k, value]), size: 'regular', room: {w: 800, h: 400}}))]
  const dial = tree.find(element => element.type === ValueBox && element.props.label === 'Duration')
  const {scale} = dial.props, unit = shift ? 0.001 : 0.01
  dial.props.onChange(fromUnit(scale, toUnit(scale, duration) + (key === 'ArrowUp' ? unit : -unit)))
  assert.equal(set.length, 1)
  assert.equal(set[0][0], 'duration')
  return set[0][1]
}

test('XS06 (walk 890): ArrowUp from one second moves Duration on, as it does at every held value up to the hour', () => {
  assert.equal(press(1, 'ArrowUp'), 1.5, 'one second, ArrowUp: a second and a half')
  for (const at of [1.5, 2, 2.5, 3, 4, 10, 60, 600, 3599.5]) {
    const next = press(at, 'ArrowUp')
    assert.ok(next > at, `ArrowUp from ${at} s moves on (gave ${next} s)`)
    assert.equal(next * 2, Math.round(next * 2), 'kept to the half second')
  }
  assert.equal(press(3600, 'ArrowUp'), 3600, 'an hour is the law\'s end')
})

test('XS06 (walk 890): ArrowDown moves Duration back to the second, and Shift\'s fine step is not lost either', () => {
  for (const at of [3600, 600, 10, 3.5, 3, 2.5, 2, 1.5]) {
    const next = press(at, 'ArrowDown')
    assert.ok(next < at, `ArrowDown from ${at} s moves back (gave ${next} s)`)
  }
  assert.equal(press(1, 'ArrowDown'), 1, 'one second is the law\'s floor')
  assert.equal(press(1, 'ArrowUp', true), 1.5, 'Shift-ArrowUp at a second still moves')
  assert.equal(press(3600, 'ArrowDown', true), 3570.5, 'Shift-ArrowDown at the hour: a fine step, kept to the half second')
})
