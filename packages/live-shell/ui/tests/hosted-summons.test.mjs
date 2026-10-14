import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// The hosted Expressions summons (src/native/hostedSummons.ts): the frame's source and graph summons are answered by the
// shell's own surfaces, with the legacy resolver (sourceHandoff.ts) imported, not copied. The loader is the transpile-only
// .ts/.tsx loader the other shell tests use; the real resolver and knowledge admission run, and no kernel is reached.
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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {readSummon, answerHostedSummon, sourcePlan, summonBasis, sameSummonBasis} = await import('../src/native/hostedSummons.ts')
const {validateKnowledgeOpen, createKnowledgeBinding} = await import('../src/native/knowledgeOpen.ts')

const location = {schema: 'central.path-ref/v1', ref: 'central:file:notes/a.md', root: 'Control', path: 'notes/a.md'}
const subject = {ref: 'expression:abc', kind: 'expression', nativeOwner: 'oi', revision: 3, title: 'Doc', sceneRef: 'scene:1', entityRef: null, relationRef: null}
const sourceDetail = (overrides = {}) => ({kind: 'source', ref: 'central:file:notes/a.md', subject, ...overrides})
const graphDetail = (overrides = {}) => ({kind: 'graph', subject: {ref: 'expression:abc', nativeOwner: 'oi', kind: 'subject', revision: 3, title: 'Doc', sceneRef: 'scene:1', entityRef: null, relationRef: null}, ...overrides})
const summon = detail => ({request: 'summon', detail})
const unavailable = {kind: 'unavailable', reason: 'test transport: the kernel must not be reached'}

function harness({current = true, project = 'O-I', resolveSource, transport = unavailable} = {}) {
  const log = {files: [], knowledge: [], faults: [], cleared: 0}
  let live = current
  const deps = {
    transport,
    current: () => live,
    project: () => project ?? undefined,
    openFile: value => log.files.push(value),
    openKnowledge: value => log.knowledge.push(value),
    fault: reason => log.faults.push(reason),
    clear: () => {log.cleared++},
    ...(resolveSource ? {resolveSource} : {}),
  }
  return {deps, log, stale: () => {live = false}}
}

const fileTarget = {location, title: 'a.md', returnTo: {place: {ref: 'expression:abc', title: 'Doc'}, passageId: 'scene:1'}}
const addressTarget = {address: {kind: 'wiki', value: 'wiki:whole-1'}, title: 'Whole', project: 'O-I', returnTo: {place: {ref: 'expression:abc', title: 'Doc'}, passageId: 'scene:1'}}

// ---- Reading the frame's summon (untrusted data, bounded before use) ----

test('a source summon and a graph summon are read as their kinds', () => {
  const source = readSummon(summon(sourceDetail()))
  assert.equal(source.ok && source.kind, 'source')
  const graph = readSummon(summon(graphDetail()))
  assert.deepEqual(graph, {ok: true, kind: 'graph', subject_ref: 'expression:abc', native_owner: 'oi'})
})

test('any other kind is read as unhandled, named, never dropped', () => {
  assert.deepEqual(readSummon(summon({kind: 'verso', subject: null})), {ok: true, kind: 'unhandled', summonKind: 'verso'})
  assert.deepEqual(readSummon(summon({kind: 'instrument', lens: 'not-a-lens'})), {ok: true, kind: 'unhandled', summonKind: 'instrument'})
})

test('an unreadable summon is refused with a named reason', () => {
  const refusals = [
    [{request: 'workspace-mode', mode: 'techne'}, 'a request this shell cannot read'],
    [{request: 'summon'}, 'a summon with no detail'],
    [summon({kind: 'Source!'}), 'no readable kind'],
    [summon(sourceDetail({ref: ''})), 'no bounded source reference'],
    [summon(sourceDetail({ref: 'central:file:\u0007x'})), 'no bounded source reference'],
    [summon(sourceDetail({ref: 'x'.repeat(2049)})), 'no bounded source reference'],
    [summon(sourceDetail({subject: undefined})), 'no native Scene basis'],
    [summon(sourceDetail({subject: {...subject, revision: 0}})), 'no exact native Scene revision'],
    [summon(sourceDetail({context: ['not', 'an', 'object']})), 'malformed or too large'],
    [summon(sourceDetail({context: {node: {label: 'x'.repeat(70000)}}})), 'malformed or too large'],
    [summon({kind: 'graph'}), 'no native subject'],
  ]
  for (const [raw, fragment] of refusals) {
    const read = readSummon(raw)
    assert.equal(read.ok, false, JSON.stringify(raw).slice(0, 80))
    assert.ok(read.reason.includes(fragment), `${fragment} in "${read.reason}"`)
  }
})

// ---- Answering: the legacy resolver is imported and runs unchanged ----

test('a resolved file opens as a file surface, and clears the fault line', async () => {
  const {deps, log} = harness({resolveSource: async () => fileTarget})
  await answerHostedSummon(summon(sourceDetail()), deps)
  assert.deepEqual(log.files, [location])
  assert.deepEqual(log.knowledge, [])
  assert.deepEqual(log.faults, [])
  assert.equal(log.cleared, 1)
})

test('a resolved address opens in the Knowledge panel, and its refusal returns to the fault line', async () => {
  const {deps, log} = harness({resolveSource: async () => addressTarget})
  await answerHostedSummon(summon(sourceDetail()), deps)
  assert.deepEqual(log.files, [])
  assert.equal(log.knowledge.length, 1)
  const [input] = log.knowledge
  assert.deepEqual(input.address, {kind: 'wiki', value: 'wiki:whole-1'})
  assert.equal(input.title, 'Whole')
  assert.equal(input.project, 'O-I')
  input.complete('Native Knowledge refused the open')
  assert.deepEqual(log.faults, ['Native Knowledge refused the open'])
})

test('a stale answer opens nothing and names nothing', async () => {
  const {deps, log, stale} = harness({resolveSource: async () => {stale(); return fileTarget}})
  await answerHostedSummon(summon(sourceDetail()), deps)
  assert.deepEqual(log.files, [])
  assert.deepEqual(log.knowledge, [])
  assert.deepEqual(log.faults, [])
  assert.equal(log.cleared, 0)
})

test('a resolver refusal is named in the fault line, and nothing opens', async () => {
  const {deps, log} = harness({resolveSource: async () => {throw new Error('The file source changed; refresh its Scene binding before opening it.')}})
  await answerHostedSummon(summon(sourceDetail()), deps)
  assert.deepEqual(log.faults, ['The file source changed; refresh its Scene binding before opening it.'])
  assert.deepEqual(log.files, [])
})

test('the imported resolver refuses a Timeline selection that changed, before any kernel read', async () => {
  const {deps, log} = harness()
  const context = {node: {graphNodeId: 'other-node', sourceCoordinates: []}}
  await answerHostedSummon(summon(sourceDetail({context})), deps)
  assert.deepEqual(log.faults, ['The Timeline selection changed; open its current source again.'])
  assert.deepEqual(log.files, [])
  assert.deepEqual(log.knowledge, [])
})

test('a resolved target that is not a Central file location is refused by name', async () => {
  const {deps, log} = harness({resolveSource: async () => ({...fileTarget, location: {...location, schema: 'other/v1'}})})
  await answerHostedSummon(summon(sourceDetail()), deps)
  assert.deepEqual(log.files, [])
  assert.match(log.faults[0], /not a Central file location/)
})

test('an unhandled summon names its kind and opens nothing', async () => {
  const {deps, log} = harness()
  await answerHostedSummon(summon({kind: 'verso', subject: null}), deps)
  assert.deepEqual(log.faults, ['The hosted application asked for a "verso" summon, which the new shell does not open yet.'])
  assert.deepEqual(log.files, [])
  assert.deepEqual(log.knowledge, [])
})

test('a graph summon opens the Graph focused on the subject, and admits through the knowledge panel contract', async () => {
  const {deps, log} = harness({project: 'O-I'})
  await answerHostedSummon(summon(graphDetail()), deps)
  assert.equal(log.knowledge.length, 1)
  const input = log.knowledge[0]
  assert.equal(input.title, 'Graph')
  assert.equal(input.plane, 'graph')
  assert.equal(input.project, 'O-I')
  // The same admission the knowledge panel runs: the subject rides the binding's native view, so the Graph pane focuses it.
  const admitted = validateKnowledgeOpen(input)
  const binding = createKnowledgeBinding(input, 'binding-1')
  assert.equal(admitted.plane, 'graph')
  assert.equal(binding.kind, 'knowledge')
  assert.equal(binding.view.knowledgePlane, 'graph')
  assert.equal(binding.view.nativeKnowledge.subject_ref, 'expression:abc')
  assert.equal(binding.view.nativeKnowledge.native_owner, 'oi')
  assert.equal(binding.ref, 'expression:abc')
})

test('a graph summon with no register names it instead of opening a Graph for nothing', async () => {
  const {deps, log} = harness({project: null})
  await answerHostedSummon(summon(graphDetail()), deps)
  assert.deepEqual(log.faults, ["This subject's register has no wiki graph to show it in."])
  assert.deepEqual(log.knowledge, [])
})

test('a stale graph summon opens nothing', async () => {
  const {deps, log, stale} = harness()
  stale()
  await answerHostedSummon(summon(graphDetail()), deps)
  assert.deepEqual(log.knowledge, [])
  assert.deepEqual(log.faults, [])
})

// ---- Target planning ----

test('sourcePlan opens a file or a knowledge address, and refuses a target with neither', () => {
  assert.equal(sourcePlan(fileTarget).kind, 'file')
  assert.equal(sourcePlan(addressTarget).kind, 'knowledge')
  const none = sourcePlan({title: 'x', returnTo: {place: {ref: 'expression:abc', title: 'Doc'}, passageId: 'scene:1'}})
  assert.equal(none.ok, false)
  assert.match(none.reason, /neither a file nor a knowledge address/)
})

// ---- The currentness basis: frame, host, document, Scene and selection ----

test('the currentness basis holds only while the frame, document, Scene and selection stand', () => {
  const frame = {}, host = {}
  const state = {document: {id: 'expression:abc'}, sceneIndex: 0, selection: [{id: 'e1'}]}
  const at = summonBasis(frame, host, state)
  assert.equal(sameSummonBasis(at, summonBasis(frame, host, {...state})), true)
  assert.equal(sameSummonBasis(at, summonBasis({}, host, state)), false)
  assert.equal(sameSummonBasis(at, summonBasis(frame, {}, state)), false)
  assert.equal(sameSummonBasis(at, summonBasis(frame, host, {...state, document: {id: 'expression:other'}})), false)
  assert.equal(sameSummonBasis(at, summonBasis(frame, host, {...state, sceneIndex: 1})), false)
  assert.equal(sameSummonBasis(at, summonBasis(frame, host, {...state, selection: [{id: 'e2'}]})), false)
  assert.equal(sameSummonBasis(at, summonBasis(frame, host, {...state, selection: []})), false)
})

// ---- Wiring: the Expressions pane answers summons through this handler, and keeps its own two requests ----

test('the Expressions pane routes summons here and keeps workspace-mode and open-external', async () => {
  const source = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes("request.request === 'workspace-mode'"), 'workspace-mode is kept')
  assert.ok(source.includes("request.request === 'open-external'"), 'open-external is kept')
  assert.ok(source.includes("request.request === 'summon'"), 'summons reach the handler')
  assert.ok(source.includes('answerHostedSummon('), 'the summon is answered by the ported handler')
  assert.ok(source.includes('sameSummonBasis(hostedBasis(), at)'), 'the answer is guarded by the frame basis it arrived on')
})

test('a resolved file source presents the Workbench first, then opens there once — the receiver acts only while presented', async () => {
  const {readFile} = await import('node:fs/promises')
  const panel = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(panel, /openFile: location => window\.dispatchEvent\(new CustomEvent\(SOURCE_PRESENT, \{detail: \{location\}\}\)\)/, 'the panel asks App to present, never fires into a hidden Workbench')
  assert.match(app, /window\.addEventListener\(SOURCE_PRESENT, present\)/)
  assert.match(app, /setCenterPanel\('native\.workbench'\); setSourceIntent\(\{location\}\)/, 'the Workbench is presented in the same act')
  assert.match(app, /if \(!sourceIntent \|\| centerPanel !== 'native\.workbench'\) return\n\s*window\.dispatchEvent\(new CustomEvent\('oi:epi-open-source', \{detail: \{location: sourceIntent\.location\}\}\)\)\n\s*setSourceIntent\(null\)/, 'after that commit, the open is handed over once and the intent cleared')
})
