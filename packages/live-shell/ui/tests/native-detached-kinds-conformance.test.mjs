// The native detached-kind conformance (WORLD-SHELL-DESIGN §10 item 4, seam 8): the kinds the native host can receive are the
// door's declared detached kinds that also have a native receiving body. The shell derives that set from one table
// (native/detachedKinds.ts NATIVE_DETACHED_KINDS, over the door's DETACHED_KINDS). The Rust host keeps its own copy in
// window_detach's admission list; this test parses that list and fails on any difference, in either direction.
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

const schema = await import('../src/inhabitants/manifest.ts')
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const detached = await import('../src/native/detachedKinds.ts')

const WINDOWS_RS = new URL('../../../../desktop/cradle/src-tauri/src/windows.rs', import.meta.url)

/** The kinds `window_detach` admits as native detached bodies: the `matches!` list inside that function, and only there. */
async function nativeKindsInWindowsRs() {
  const source = await readFile(WINDOWS_RS, 'utf8')
  const start = source.indexOf('pub fn window_detach(')
  const end = source.indexOf('pub fn window_binding(')
  assert.ok(start > 0 && end > start, 'window_detach is located in windows.rs')
  const body = source.slice(start, end)
  const admission = body.match(/if\s*!\s*matches!\(\s*binding\.kind\.as_str\(\)\s*,([\s\S]*?)\)\s*\{/)
  assert.ok(admission, 'window_detach carries its native body admission list')
  return [...admission[1].matchAll(/"([^"]+)"/g)].map(match => match[1])
}

const sorted = kinds => [...kinds].sort()

test('the native host admits exactly the shell\'s derived native kinds, in both directions', async () => {
  const rust = await nativeKindsInWindowsRs()
  assert.ok(rust.length >= 8, `the parse found the admission list (${rust.length} kinds)`)
  assert.equal(new Set(rust).size, rust.length, 'the Rust list names no kind twice')
  assert.deepEqual(sorted(rust), sorted(detached.NATIVE_DETACHED_KINDS), 'windows.rs window_detach equals native/detachedKinds.ts NATIVE_DETACHED_KINDS')
  for (const kind of rust) assert.equal(detached.nativeDetachedBodySupported(kind), true, `${kind} is receivable`)
})

test('every native kind is one the door declares; the door kinds without a native body are the five non-native ones', () => {
  for (const kind of detached.NATIVE_DETACHED_KINDS) assert.ok(schema.DETACHED_KINDS.includes(kind), `${kind} is a door kind`)
  const nonNative = schema.DETACHED_KINDS.filter(kind => !detached.NATIVE_DETACHED_KINDS.includes(kind))
  assert.deepEqual(sorted(nonNative), ['draft', 'explore', 'object', 'presentation', 'system'])
  for (const kind of nonNative) assert.equal(detached.nativeDetachedBodySupported(kind), false, `${kind} has no native receiving body`)
  assert.equal(detached.nativeDetachedBodySupported(''), false)
})

test('every family the shell loads declares only pop-out kinds the host receives', () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  const loaded = schema.allInhabitantManifests()
  assert.ok(loaded.length >= 6, `the six families are admitted (${loaded.length})`)
  for (const manifest of loaded) {
    for (const kind of manifest.detachedKinds ?? []) {
      assert.ok(detached.nativeDetachedBodySupported(kind), `${manifest.id} declares ${kind}, which the native host can receive`)
    }
  }
})
