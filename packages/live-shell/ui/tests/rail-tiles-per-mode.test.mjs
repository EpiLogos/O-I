// The rail opens with each mode's tiles, from the manual (O-I #744): Central the agent, the Packet and the Trail (§18 "the agent of the world,
// the Packet and the Trail on the rail"); Factory Results, Agents and Terminal (§19); Expressions the agent, the sky and the Trail (§20);
// Technē the Journey and the Trail (§17); Live the Torus and the Trail (§21). These are the tiles a rail stands on until the person changes
// it; a rail the person changed is theirs and is never reset (the workspace book's own open set, desktop/cradle/src/workspace/store.ts).
// Channels: SCRIPTED (the registrations through the transpiling loader) and code-reading (App.tsx, agent/AgentShellContext.tsx).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  if (s.startsWith('@epilogos/expressions-boundary')) return {url: 'data:text/javascript,export {}', shortCircuit: true}
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
const defaults = await import('../src/shell/widgetDefaults.ts')
const {WIDGETS} = await import('../src/shell/widgets.tsx')
const {JOURNEY_DESIGN} = await import('../src/techne/devices/designDevices.ts')
const {deviceWidgetId} = await import('../src/frame/devices/deviceDoor.ts')
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('each mode\'s rail opens on the manual\'s tiles', () => {
  const ids = Object.fromEntries(['base', 'factory', 'expressions', 'techne', 'live'].map(mode => [mode, [...defaults.defaultWidgets(mode)]]))
  assert.deepEqual(ids, {
    base: ['agent', 'packet', 'trail'],
    factory: ['results', 'agents', 'terminal'],
    expressions: ['agent', 'sky', 'trail'],
    techne: [deviceWidgetId(JOURNEY_DESIGN), 'trail'],
    live: [deviceWidgetId('live:m1-torus'), 'trail'],
  })
  assert.match(read('../src/live/torusDevice.ts'), /export const TORUS_DEVICE_ID = 'live:m1-torus'/, 'the Torus tile is the torus device\'s widget')
})

test('every tile a mode opens with is one the rail draws: a widget it registers, or a device\'s own widget', () => {
  const registered = new Set(WIDGETS.map(widget => widget.id))
  for (const mode of ['base', 'factory', 'expressions', 'techne', 'live'])
    for (const id of defaults.defaultWidgets(mode)) assert.ok(registered.has(id) || id.startsWith('device:'), `${mode}: ${id} is a rail widget`)
})

test('code-reading: the mode\'s tiles stand only until the person changes the rail; a changed rail is never reset', () => {
  const app = read('../src/App.tsx')
  assert.match(app, /rail: continuity\.current\.widgets \?\? \{open: modeWidgets\}/, 'the book\'s own rail first, the mode\'s tiles only where it holds none')
  assert.match(app, /toggle: id => continuity\.toggleWidgetOpen\(id, modeWidgets\)/, 'a first change starts from the tiles shown')
  assert.match(app, /const modeWidgets = defaultWidgets\(frameMode\)/)
  assert.match(read('../src/agent/AgentShellContext.tsx'), /continuity\?\.current\.widgets\?\.open \?\? defaultWidgets\('factory'\)/, 'Factory\'s agent shell reads the same')
  assert.doesNotMatch(app + read('../src/agent/AgentShellContext.tsx'), /DEFAULT_WIDGETS/, 'no one rail for every mode')
})
