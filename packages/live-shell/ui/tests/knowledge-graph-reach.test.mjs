// #772: the Knowledge graph's `reach.` keys (manual §17.3 "What a subject reaches", which took in Impact's reach of §18.6): References and
// Sessions are Impact's legs (groundDevices.ts useImpactDevice: a folder's listing, op files_list; the NOW register, op now kind:list) on
// the browser's selected folder, note or Day. The Knowledge graph's binding is handed neither the selection nor a kernel carrier in Technē
// (techneDesigns.ts useTechneDesignBindings), so each reach reading stands absent naming that; Sessions (reach.closed) is the view's own.
// Channel: SCRIPTED (the binding's own standing). Not a screen pass.
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

const graphB = await import('../src/techne/devices/graphBinding.ts')
const writes = {setter: async () => {}, patch: () => {}}

test('each reach reading stands absent naming what the graph is not handed; Sessions is the hand\'s', () => {
  const binding = graphB.graphBinding(null, null, writes)
  for (const key of ['reach.subject', 'reach.references', 'reach.sessions']) {
    assert.equal(binding.values[key], undefined, `${key} is absent`)
    assert.equal(binding.standing[key]?.disabled, graphB.REACH_ABSENT, `${key}: why`)
    assert.equal(graphB.graphAbsent(null, null, key), graphB.REACH_ABSENT)
  }
  assert.match(graphB.REACH_ABSENT, /useImpactDevice/)
  assert.match(graphB.REACH_ABSENT, /selected folder, note or Day/)
  assert.ok(binding.local?.['reach.closed'], 'Sessions (open only, or open and closed) is the view\'s own')
  assert.equal(binding.values['reach.closed'], false, 'Open only, the manual\'s default')
})
