// O-I #747 round 893 (the OPEN list): the Arrangement's receipt stayed after ⌘Z — "Trim Dawn: The Expression changed." still stood under
// the lanes once the trim was taken back. Now a change of the undo list (⌘Z, ⇧⌘Z, another act listed) clears the views' receipt, in the
// Arrangement and the Session alike: the receipt says the last act, and after Undo it no longer does.
// It holds because a press's own step is listed before its answer is shown (objectActions.ts ownerStepped records, then answers), so
// the press's receipt is set after the clearing its own listing caused. Channels: the undo list and ownerStepped, run; the views' wiring,
// code-reading (React effects).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)
const src = path => new URL(`../src/${path}`, import.meta.url)
const UNDO = await import(src('frame/menu/undo.ts').href)
const read = path => readFile(src(path), 'utf8')

test('a press\'s own step is listed before its answer comes back, so the clearing its listing causes comes before its receipt', async () => {
  UNDO.clearUndo()
  const order = []
  const stop = UNDO.subscribeUndo(() => order.push(`list: ${UNDO.undoState().undo}`))
  const {ownerStepped} = await import(src('frame/menu/objectActions.ts').href)
  const run = ownerStepped({record: UNDO.recordStep}, 'Trim Dawn', async () => ({ok: true, note: 'The Expression changed.', ownerStep: {undo: async () => ({ok: true}), redo: async () => ({ok: true})}}))
  await run().then(() => order.push('receipt'))
  await UNDO.undoStep()
  stop()
  assert.deepEqual(order, ['list: Trim Dawn', 'receipt', 'list: null'], 'listed, then the receipt shown, then Undo changes the list again')
  UNDO.clearUndo()
})

test('code-reading: the Arrangement and the Session clear their receipt on every change of the undo list', async () => {
  for (const path of ['inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx', 'inhabitants/catalogue/panels/dlw__session-grid.tsx']) {
    const source = await read(path)
    assert.match(source, /useEffect\(\(\) => subscribeUndo\(\(\) => setReceipt\(null\)\), \[\]\)/, `${path}: Undo, Redo or another listed act clears the receipt`)
    assert.match(source, /import \{[^}]*\bsubscribeUndo\b[^}]*\} from '(?:\.\.\/)+(?:frame\/)?menu\/undo'/, path)
  }
})
