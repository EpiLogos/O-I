// O-I #747 round 888, XS13 ("I rename and recolour a scene so I find it fast in Session view": §20.1 The Clip panel, Rules): Enter keeps a
// change; Escape undoes one I have not kept. The Clip panel's Scene name is the kit's TextField (sdk/panel.tsx), wired to the scene's
// `name` act (clipBinding.ts: one Rename Scene edit of the owner), and a locked scene's field stands disabled with the reason.
// - SCRIPTED: the field's own key and blur handlers, run on a stand-in for the input as the browser hands it to them (its value, its
//   blur, which leaves the field); the panel's element tree read as drawn. No owner is reached: the act it calls is recorded.
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
const {Chooser, TextField} = await import('../src/inhabitants/sdk/panel.tsx')
const {clip} = await import('../src/inhabitants/catalogue/clips/expressions.tsx')

/** Every element in a drawn tree, depth first (elements are not rendered: their props are read). */
function* elements(node) {
  if (Array.isArray(node)) { for (const child of node) yield* elements(child); return }
  if (!node || typeof node !== 'object' || !('props' in node)) return
  yield node
  yield* elements(node.props.children)
}
/** The field's input as drawn, and a stand-in for it in the browser: its value, and its blur, which runs the field's own blur handler. */
function field(value, onChange) {
  const input = [...elements(TextField({label: 'Scene name', value, onChange}))].find(element => element.type === 'input')
  assert.ok(input, 'the field draws one text input')
  const node = {value, focused: true, blur() { if (!this.focused) return; this.focused = false; input.props.onBlur({currentTarget: node}) }}
  const key = name => { let prevented = false; input.props.onKeyDown({key: name, currentTarget: node, preventDefault: () => { prevented = true }}); return prevented }
  return {input, node, key}
}

test('XS13: Enter keeps the change: the scene\'s name is sent once, as typed', () => {
  const sent = [], f = field('Dawn swell', value => sent.push(value))
  assert.equal(f.input.props.defaultValue, 'Dawn swell', 'the field shows the name the owner reads')
  f.node.value = 'Dusk'
  assert.equal(f.key('Enter'), true, 'Enter is the field\'s own, not the form\'s')
  assert.deepEqual(sent, ['Dusk'], 'Enter keeps it')
})

test('XS13: Escape undoes a change not kept: the name is restored, the field is left, and nothing is sent', () => {
  const sent = [], f = field('Dawn swell', value => sent.push(value))
  f.node.value = 'Dus'
  f.key('Escape')
  assert.equal(f.node.value, 'Dawn swell', 'the field shows the kept name again')
  assert.equal(f.node.focused, false, 'Escape leaves the field')
  assert.deepEqual(sent, [], 'leaving after Escape keeps nothing')
})

test('XS13: leaving the field keeps a change; leaving it unchanged sends nothing', () => {
  const sent = [], left = field('Dawn swell', value => sent.push(value))
  left.node.value = 'Noon field'
  left.node.blur()
  assert.deepEqual(sent, ['Noon field'])
  const still = field('Dawn swell', value => sent.push(value))
  still.node.blur()
  assert.deepEqual(sent, ['Noon field'], 'an unchanged name is not sent again')
})

test('XS13: the Clip panel\'s Scene name is that field, on the scene\'s name act; a locked scene\'s stands disabled with the reason', () => {
  const panel = clip.panel.find(tab => tab.id === 'clip')
  const draw = v => { const set = []; return {set, tree: [...elements(panel.draw({v, set: (key, value) => set.push([key, value]), size: 'regular', room: {w: 800, h: 400}}))]} }
  const open = draw(clip.defaults)
  const name = open.tree.find(element => element.type === TextField && element.props.label === 'Scene name')
  assert.ok(name, 'the panel draws the Scene name with the kit\'s TextField')
  assert.equal(name.props.value, 'Dawn swell')
  assert.match(name.props.does, /Press Enter to keep a change, Escape to undo it\./)
  assert.equal(name.props.disabled, undefined)
  name.props.onChange('Dusk')
  assert.deepEqual(open.set, [['name', 'Dusk']], 'a kept name is the scene\'s name act')
  const locked = draw({...clip.defaults, locked: true}).tree.find(element => element.type === TextField && element.props.label === 'Scene name')
  assert.equal(locked.props.disabled, 'The scene is locked. Unlock it to change it.')
  const colour = open.tree.find(element => element.type === Chooser && element.props.label === 'Colour')
  assert.ok(colour, 'the Colour stands beside it')
  colour.props.onChange('var(--sea)')
  assert.deepEqual(open.set.at(-1), ['colour', 'var(--sea)'], 'a colour chosen is the scene\'s colour act')
})
