// Each mode opens on the view the manual puts it in (O-I #744; DLW.md §19 "Factory opens in Session view, its sessions as tracks"; §21 "Live
// opens in Session view, with the part's chain in Device view"; Central, Expressions and Technē open in Pane view). A mode stood in before
// keeps its own kept view; this is the frame a mode first opens on (shell/modeFrames.ts MODE_FRAMES). Channel: SCRIPTED.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) { if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}; return r }
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
globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {MODE_FRAMES} = await import('../src/shell/modeFrames.ts')

test('Live and Factory open in Session view; Central, Expressions and Technē in Pane view', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(MODE_FRAMES).map(([mode, frame]) => [mode, frame.view])),
    {live: 'session', base: 'pane', factory: 'session', expressions: 'pane', techne: 'pane'})
  assert.equal(MODE_FRAMES.factory.detailMode, 'clip', 'Factory: the selected task\'s log in Clip view')
  assert.equal(MODE_FRAMES.live.detailMode, 'device', 'Live: the part\'s chain in Device view')
})
