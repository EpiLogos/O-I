// O-I #747 round 894, the port ledger's native-open-file, native-retry-file and native-retry-open. A Central file an Expression keeps (manual
// §10.3: "Expressions keeps an Expression as JSON") opens from the browser's Files as that Expression: double-click it (§10.3 Material:
// "Double-click it, or drag it into a pane, to open it"), or Open as Expression at the foot of the list while it is selected. The owner's own
// open_file reads and decodes the file and holds the work under the file's identity, bound to that file (kernel expression.rs
// Request::OpenFile); the works list is read again and the open door is asked. A refusal is the owner's words on the Files list, with Retry.
// And an open the field refuses (host.ts openExpression's answer) stands on the field's fault line with Retry opening, which asks the same
// open again; an open superseded by a newer one says nothing.
// The owner is a SCRIPTED STUB (as native-expression-open.test.mjs); what is real is the shell's sequence. The browser and panel wiring React
// effects hide is read from the source text, as expressions-works-home-shell.test.mjs reads it; the walk proves it on screen.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const root = new URL('../../../../', import.meta.url)
const shell = new URL('packages/live-shell/ui/src/', root)
const CMD = await import(new URL('components/nativeExpressionCommands.ts', shell))
const read = name => readFile(new URL(name, shell), 'utf8')

const location = {ref: 'central:file:dawn', path: 'Work/Dawn/dawn-study.expression.json'}
const document = {expression_ref: 'expression:authored-dawn', title: 'Dawn study', revision: 4}

function ports(answer) {
  const sent = [], opened = [], refreshed = []
  return {sent, opened, refreshed, ports: {
    expression: async request => { sent.push(structuredClone(request)); return answer(request) },
    current: () => true,
    refresh: async () => { refreshed.push(true); return [] },
    open: ref => opened.push(ref),
  }}
}

test('a Central file an Expression keeps is named so: its name ends .expression.json', () => {
  assert.equal(CMD.isExpressionFile('dawn-study.expression.json'), true)
  assert.equal(CMD.isExpressionFile('Dawn.Expression.JSON'), true)
  for (const name of ['dawn.json', 'dawn.md', 'expression.json', 'dawn.expression.json.bak']) assert.equal(CMD.isExpressionFile(name), false, name)
})

test('Open as Expression: the owner\'s open_file at the file\'s location, the works list again, then the open door', async () => {
  const run = ports(request => request.operation === 'open_file'
    ? {state: 'ready', dirty: false, document, file: {location, revision: 'r9'}} : null)
  const outcome = await CMD.openExpressionFile(run.ports, location, 'dawn-study.expression.json')
  assert.deepEqual(run.sent, [{operation: 'open_file', location, actor: CMD.OPEN_ACTOR}], 'one open_file, by the file\'s own location')
  assert.deepEqual(run.opened, ['expression:authored-dawn'], 'the open door is asked for the file\'s own identity')
  assert.equal(run.refreshed.length, 1, 'the works list is read again, so the opened work is listed')
  assert.equal(outcome.ok, true)
  assert.equal(outcome.expression_ref, 'expression:authored-dawn')
  assert.equal(outcome.title, 'Dawn study')
  assert.deepEqual(outcome.saved, {path: location.path, revision: 'r9'}, 'the work stands bound to the file it came from')
})

test('a draft of the same work the owner already holds stands and opens; nothing replaces it', async () => {
  const run = ports(() => ({state: 'revision_conflict', expression_ref: 'expression:authored-dawn', current_revision: 6, detail: 'An open draft is never replaced implicitly'}))
  const outcome = await CMD.openExpressionFile(run.ports, location, 'dawn-study.expression.json')
  assert.equal(outcome.ok, true)
  assert.deepEqual(run.opened, ['expression:authored-dawn'])
  assert.match(outcome.warning ?? '', /already open/, 'the person hears that the open draft stands')
})

test('a file the owner will not open is refused in the owner\'s words; nothing opens; Retry asks the same open again', async () => {
  let refuse = true
  const run = ports(() => {
    if (refuse) throw Error('central.files.read failed: Expression file JSON is malformed')
    return {state: 'ready', dirty: false, document, file: {location, revision: 'r9'}}
  })
  const first = await CMD.openExpressionFile(run.ports, location, 'dawn-study.expression.json')
  assert.equal(first.ok, false)
  assert.match(first.error, /dawn-study\.expression\.json did not open as an Expression: central\.files\.read failed: Expression file JSON is malformed/)
  assert.deepEqual(run.opened, [], 'nothing opens')
  refuse = false
  const again = await CMD.openExpressionFile(run.ports, location, 'dawn-study.expression.json')
  assert.equal(again.ok, true, 'Retry is the same open')
  assert.deepEqual(run.sent.map(request => request.operation), ['open_file', 'open_file'])
  assert.deepEqual(run.opened, ['expression:authored-dawn'])
})

test('an owner answer that is not this file\'s work is refused; with no owner attached nothing is sent', async () => {
  const other = ports(() => ({state: 'ready', document: {expression_ref: 7}}))
  const wrong = await CMD.openExpressionFile(other.ports, location, 'dawn-study.expression.json')
  assert.equal(wrong.ok, false)
  assert.deepEqual(other.opened, [])
  const none = await CMD.openExpressionFile({...ports(() => null).ports, expression: null}, location, 'dawn-study.expression.json')
  assert.deepEqual(none, {ok: false, error: CMD.OWNER_UNATTACHED, expression_ref: null})
})

test('Files: an Expression\'s file opens on double-click and by Open as Expression at the foot; its refusal stands with Retry (code-reading)', async () => {
  const source = await read('components/WorldBrowser.tsx')
  assert.match(source, /onDoubleClick=\{[^}]*isExpressionFile\(entry\.name\)[^}]*openFile\(entry\)/, 'double-click opens an Expression\'s file')
  assert.match(source, /Open as Expression/, 'the foot of the list offers the open for the selected Expression file')
  assert.match(source, /openExpressionFile\(/, 'the open is the owner sequence')
  assert.match(source, /data-file-open-fault/, 'the refusal stands on the Files list')
  assert.match(source, />Retry<\/button>/, 'with Retry')
})

test('Retry opening: a refused open stands on the field\'s fault line and the Studio\'s head offers Retry, a superseded one says nothing (native-retry-open)', async () => {
  assert.equal(CMD.openRefusal({ok: false, error: 'The native owner does not hold expression:gone'}), 'The native owner does not hold expression:gone')
  assert.equal(CMD.openRefusal({ok: true}), null)
  assert.equal(CMD.openRefusal({ok: false, error: 'A newer open superseded this one before the Expressions application was ready'}), null, 'a superseded open is no refusal')
  const panel = await read('panels/expressions.tsx'), host = await read('projections/expressionsPaneHost.ts')
  const pane = await read('projections/expressionsPane.tsx'), studio = await read('components/expressions/studio/ExpressionsStudio.tsx')
  assert.match(panel, /openExpression\(ref, 'world\.expressions'\)\.then\(/, 'the panel hears the field\'s answer to its open')
  // REPLACED (round 896, 0R-surface.5): the panel's frameActs hears the answer and keeps a refusal (frameActs.heard), run here.
  assert.match(panel, /\.then\(heard\(ref\), fail\)/, 'and keeps a refusal')
  const faults = []
  const acts = CMD.frameActs({live: () => true, frame: () => null, say() {}, show() {}, shown: () => null, openFault: fault => faults.push(fault),
    pendingOpen: {current: null}, selection: {current: null}, binding: () => null, surfaceEngine() {}})
  acts.heard('expression:gone')({ok: false, error: 'The native owner does not hold expression:gone'})
  acts.heard('expression:gone')({ok: false, error: 'A newer open superseded this one before the Expressions application was ready'})
  assert.deepEqual(faults, [{ref: 'expression:gone', text: 'The native owner does not hold expression:gone'}, null], 'a refusal stands; a superseded open clears it')
  acts.dispose()
  assert.match(panel, /retryOpen:/, 'the chrome carries Retry opening while a refusal stands')
  assert.match(host, /retryOpen\?: \(\(\) => void\) \| null/)
  assert.match(panel, /faults: \[hostFault, surfaceFault, viewFault, skyFault, fault\]\.concat\(openFault \? \[openFault\.text\] : \[\]\)/, 'the refusal stands among the frame\'s faults')
  assert.match(pane, /faults\.join\(' · '\)/, 'so the field pane\'s fault line says it')
  assert.doesNotMatch(pane, /retryOpen|<button/, 'and the pane carries no control (expressions-pane-studio-stage)')
  assert.match(studio, /chrome\?\.retryOpen && <Mark icon="orbit" label="Retry opening/, 'the Studio\'s head offers Retry opening')
})
