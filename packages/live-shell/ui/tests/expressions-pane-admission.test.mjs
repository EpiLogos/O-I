// Proposed with ticket S (lane S): the Expressions pane's placement record belongs to the module instance that admitted it.
//
// Seen headless against the real ground (15 Oct, lane S's own stack, the dev candidate under React StrictMode): the subject door
// opened the stage pane, the pane was shown (its concealment observer reported it intersecting, 835×568), and the frame never
// moved over it — the placement registry held no record for the pane. Discriminated in the page: telling the pane id it was
// presented, then giving it its slot, changed nothing; registering it again placed the frame at once. The pane module mounts
// twice for one pane id (StrictMode's mount, unmount, mount; the same happens to any remount within one commit):
// `registerExpressionsPane` is idempotent per id, so both instances shared one record, and the first instance's late
// `unregisterExpressionsPane` (its session disposed before its module stood) deleted the record the live instance held. With no
// placement the frame stays in its hidden residence, the navigator is never presented, and the ask is never taken.
//
// Channel: SCRIPTED — the registry (projections/expressionsPaneHost.ts) driven in the order the two instances reach it, with
// element-shaped slot stubs, as tests/factory-expressions-pane.test.mjs drives it.
import test from 'node:test'
import assert from 'node:assert/strict'
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

const door = await import('../src/projections/expressionsPaneHost.ts')
const slot = name => ({name})

test('the instance that admitted a pane holds its record: a leaving instance\'s late unmount and notices cannot reach it', () => {
  // StrictMode: the module is created twice for one pane, and the first instance unmounts after the second has registered.
  const first = door.registerExpressionsPane('stage', {})
  const second = door.registerExpressionsPane('stage', {})
  door.unregisterExpressionsPane('stage', first)
  door.attachExpressionsSlot('stage', null, first)
  door.setExpressionsPanePresented('stage', false, first)
  // The live instance's own notices: its pane is shown and its body attaches the slot.
  door.setExpressionsPanePresented('stage', true, second)
  const held = slot('stage')
  door.attachExpressionsSlot('stage', held, second)
  assert.deepEqual(door.framePlacement(), {paneId: 'stage', slot: held}, 'the frame is placed over the live instance\'s pane')
  door.attachExpressionsSlot('stage', null, first)
  assert.equal(door.framePlacement()?.slot, held, 'a late slot release from the leaving instance changes nothing')
  door.unregisterExpressionsPane('stage', second)
  assert.equal(door.framePlacement(), null, 'the live instance\'s own unmount releases it')
})

test('a notice that names no admission reaches the pane\'s record, as before', () => {
  door.registerExpressionsPane('plain')
  door.attachExpressionsSlot('plain', slot('plain'))
  door.setExpressionsPanePresented('plain', true)
  assert.equal(door.framePlacement()?.paneId, 'plain')
  door.unregisterExpressionsPane('plain')
  assert.equal(door.framePlacement(), null)
})
