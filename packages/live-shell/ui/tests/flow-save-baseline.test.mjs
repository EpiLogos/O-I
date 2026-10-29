// A Flow's save compares the form against its baseline. Lane AF's walk (29 Oct) found an edit made in the first 2.5 s after a
// Flow opened became the baseline, so the face read "as read", Save answered unchanged and the edit was never written: the
// baseline was the first island read of a 2.5 s poll, and a save before that read took the form's own text as its baseline.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const model = await import('../src/inhabitants/documentDeviceModel.ts')
const face = await readFile(new URL('../src/inhabitants/DocumentFlowFace.tsx', import.meta.url), 'utf8')

test('before the form first answers, a save compares against the owner\'s page, so an early edit is a change', () => {
  const owner = {entries: [{text: 'as read'}]}
  const edited = JSON.stringify({entries: [{text: 'as read'}, {text: 'typed in the first second'}]})
  assert.equal(model.flowSaveBaseline(undefined, owner), JSON.stringify(owner))
  assert.notEqual(edited, model.flowSaveBaseline(undefined, owner), 'the early edit reads as changed and is written')
  assert.equal(model.flowSaveBaseline('{"taken":"at first answer"}', owner), '{"taken":"at first answer"}', 'once taken, the baseline stands')
})

test('the face never takes the form\'s current text as the save baseline', () => {
  assert.doesNotMatch(face, /baselineText\.current \?\? JSON\.stringify\(doc\)/)
  assert.match(face, /flowSaveBaseline\(baselineText\.current, instance\.doc\)/)
})

test('the face asks the form often until it first answers, then at the slower poll', () => {
  assert.ok(model.FLOW_FIRST_READ_MS <= 250 && model.FLOW_DRAFT_POLL_MS > model.FLOW_FIRST_READ_MS)
  assert.match(face, /baselined \? FLOW_DRAFT_POLL_MS : FLOW_FIRST_READ_MS/)
  assert.match(face, /SILENT_POLLS = 7500 \/ FLOW_FIRST_READ_MS/, 'the never-started notice still waits 7.5 s')
})
