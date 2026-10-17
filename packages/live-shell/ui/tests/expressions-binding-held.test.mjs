import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The one application body's book binding is HELD, never placed (native/expressionsBinding.ts). Seen 15 Oct, headless at :5193: an
// "Expressions" tab joined Technē's Earth pane 20–140 s after entering Technē, with nothing pressed — the Expressions panel opened
// its checkpoint binding into whichever tree stood in front once the owner answered, and moved it into the tree in front on every
// mode switch (native: an empty Expressions pane in Technē and in Live). Scripted over the engine's own layouts. Loader as
// live-detail-chain.test.mjs.
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

const {readFile} = await import('node:fs/promises')
const engine = await import('../../../../desktop/cradle/src/surface/engine.ts')
const {freshLayout} = await import('../../../../desktop/cradle/src/surface/types.ts')
const {expressionsBindingOf, holdExpressionsBinding, unplaceExpressionsBinding} = await import('../src/native/expressionsBinding.ts')

const EXPRESSIONS = {id: 'world.expressions', kind: 'expressions', title: 'Expressions'}
const EARTH = {id: 'earth-1', kind: 'projection.earth', title: 'Earth', projection: {kind: 'projection.earth'}}
const tabs = layout => engine.groupsOf(layout.root).flatMap(group => group.tabs)
const workspace = (layout, modeLayouts = {}) => ({id: 'w', layout, modeLayouts})

test('a held binding joins the surfaces and no tab; the finder finds it, and the tree in front is untouched', () => {
  const technē = engine.openBinding(freshLayout(), EARTH)
  const held = holdExpressionsBinding(technē, EXPRESSIONS)
  assert.deepEqual(tabs(held), ['earth-1'], 'the Earth stands alone: no Expressions tab joins it')
  assert.equal(held.focusedGroupId, technē.focusedGroupId)
  assert.deepEqual(expressionsBindingOf(workspace(held)), {binding: EXPRESSIONS, placed: false, layout: held})
})

test('a binding an older book placed is found first, and taken off its tab without becoming a closed one', () => {
  const placed = engine.openBinding(engine.openBinding(freshLayout(), EARTH), EXPRESSIONS)
  assert.deepEqual(tabs(placed), ['earth-1', 'world.expressions'])
  assert.equal(expressionsBindingOf(workspace(placed)).placed, true)
  const unplaced = unplaceExpressionsBinding(placed, 'world.expressions')
  assert.deepEqual(tabs(unplaced), ['earth-1'], 'its tab leaves the tree')
  assert.equal(unplaced.closedStack.includes('world.expressions'), false, 'a held binding is not a closed one')
  assert.equal(unplaced.surfaces['world.expressions'], EXPRESSIONS, 'the binding, and the checkpoint it carries, stay')
  assert.deepEqual(expressionsBindingOf(workspace(unplaced)).placed, false)
})

test('a closed binding never stands in for an open host; a binding in another mode\'s layout is found where it stands', () => {
  const closed = engine.closeSurface(engine.openBinding(engine.openBinding(freshLayout(), EARTH), EXPRESSIONS), 'world.expressions')
  assert.equal(expressionsBindingOf(workspace(closed)), undefined)
  const live = holdExpressionsBinding(freshLayout(), EXPRESSIONS)
  const found = expressionsBindingOf(workspace(engine.openBinding(freshLayout(), EARTH), {live}))
  assert.equal(found.binding, EXPRESSIONS)
  assert.equal(found.layout, live, 'held by Live\'s layout, it stays there: nothing moves it into the tree in front')
})

test('code-reading: the panel holds its binding and never places it; native input is retained under the same finder', async () => {
  const panel = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')
  assert.match(panel, /current\.setLayout\(layout => holdExpressionsBinding\(layout, binding\)\)/, 'a new binding is held')
  assert.doesNotMatch(panel, /openBinding\(|moveSurface\(/, 'nothing opens it on a tab or moves it into a tree')
  assert.match(panel, /if \(found\.placed && found\.layout === owner\.layout\) book\.setLayout\(layout => unplaceExpressionsBinding\(layout, held\.id\)\)/)
  const retention = await readFile(new URL('../src/components/NativeInputRetention.tsx', import.meta.url), 'utf8')
  assert.match(retention, /return expressionsBindingOf\(owner\)\?\.binding\.id\?\?null/)
})
