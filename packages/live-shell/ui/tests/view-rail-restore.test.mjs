import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// A Live view saved while Live had no rail kept `dock: false` after F8 put the rail in every mode (lane D, 14 Oct). Views are
// now stamped `rail: true` when saved; an unstamped view's dock is not read and the mode's registration stands. A fresh book
// no longer checkpoints `alsPath: null` before the configuration answers, so the configured default set can open.
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

const {validateCandidateApplicationView} = await import('../src/continuity/applicationView.ts')

test('a view carries the rail stamp as a boolean and refuses anything else under it', () => {
  assert.deepEqual(validateCandidateApplicationView({dock: false, rail: true}), {dock: false, rail: true})
  assert.equal(validateCandidateApplicationView({dock: true, rail: 'yes'}), null)
  assert.deepEqual(validateCandidateApplicationView({dock: false}), {dock: false}, 'an old view still decodes')
})

test('the dock is read only from a stamped view; every save stamps it; alsPath stays unset until a set stands', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /setDock\(view\?\.rail \? view\.dock \?\? opening\.dock : opening\.dock\)/)
  assert.match(app, /checkpointApplicationView\(\{alsPath: state\.path \?\? restored\?\.alsPath \?\? undefined, rail: true,/)
})
