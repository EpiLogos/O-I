import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// The DLW reopens the world you chose with its own sets as you left them; a set from another world, or a copy a test left
// behind, is never reopened as remembered state (manual §10.4; O-I #708, #738). The candidate had remembered copies of an
// owner set (~/Music/O-I screen pass/…, a run's target/p0-r1/…/sets/…) and reopened them on every launch.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {rememberedSetOfWorld} = await import('../src/continuity/applicationView.ts')

test('a remembered set reopens only from the open world\'s Central', () => {
  const ground = '/Users/me/Central'
  assert.equal(rememberedSetOfWorld('/Users/me/Central/Work/Album/Sets/Album.als', ground), '/Users/me/Central/Work/Album/Sets/Album.als')
  assert.equal(rememberedSetOfWorld('/Users/me/Music/O-I screen pass/screen-pass-r11.als', ground), null, 'a copy outside the world')
  assert.equal(rememberedSetOfWorld('/Users/me/Central2/Set.als', ground), null, 'a sibling folder is not the world')
  assert.equal(rememberedSetOfWorld('/w/Bare/Central/Work/First/First.als', '/w/Bare/Central/'), '/w/Bare/Central/Work/First/First.als')
  assert.equal(rememberedSetOfWorld('/Users/me/Central/Work/Album/Sets/Album.als', null), null, 'a world with no ground yet reopens no set')
  assert.equal(rememberedSetOfWorld(null, ground), null)
  assert.equal(rememberedSetOfWorld(undefined, ground), undefined, 'nothing remembered: the configured default stands')
  assert.equal(rememberedSetOfWorld('/anywhere/Set.als', undefined), '/anywhere/Set.als', 'a host that names no world filters nothing')
})

test('the shell opens and keeps only the world\'s own remembered set, and waits for the host to name the world', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /const ofWorld = \(path: string \| null \| undefined\) => rememberedSetOfWorld\(path, setsGround\)/)
  assert.match(app, /const initialPath = worldPending \? undefined : rememberedPath === undefined \? config\?\.default_set : ofWorld\(rememberedPath\) \?\? undefined/)
  assert.match(app, /checkpointApplicationView\(\{alsPath: state\.path \?\? \(worldPending \? restored\?\.alsPath : ofWorld\(restored\?\.alsPath\)\) \?\? undefined, rail: true,/)
})
