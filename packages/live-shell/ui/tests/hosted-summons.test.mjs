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

const {readSummon, answerHostedSummon, sourcePlan, summonBasis, sameSummonBasis, passageSpanOf} = await import('../src/native/hostedSummons.ts')
const {validateKnowledgeOpen, createKnowledgeBinding} = await import('../src/native/knowledgeOpen.ts')

const location = {schema: 'central.path-ref/v1', ref: 'central:file:notes/a.md', root: 'Control', path: 'notes/a.md'}
const subject = {ref: 'expression:abc', kind: 'expression', nativeOwner: 'oi', revision: 3, title: 'Doc', sceneRef: 'scene:1', entityRef: null, relationRef: null}
const sourceDetail = (overrides = {}) => ({kind: 'source', ref: 'central:file:notes/a.md', subject, ...overrides})
const graphDetail = (overrides = {}) => ({kind: 'graph', subject: {ref: 'expression:abc', nativeOwner: 'oi', kind: 'subject', revision: 3, title: 'Doc', sceneRef: 'scene:1', entityRef: null, relationRef: null}, ...overrides})
const summon = detail => ({request: 'summon', detail})
const unavailable = {kind: 'unavailable', reason: 'test transport: the kernel must not be reached'}

function harness({current = true, project = 'O-I', resolveSource, transport = unavailable} = {}) {
  const log = {files: [], carries: [], knowledge: [], faults: [], cleared: 0}
  let live = current
  const deps = {
    transport,
    current: () => live,
    project: () => project ?? undefined,
    openFile: (value, carry) => {log.files.push(value); log.carries.push(carry)},
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

// ---- lane-2 T19b: a source opens at the passage its event discloses ----

const SPAN = {unit: 'text_span', start: 4, end: 9, anchor_ref: null}
const passageAnchor = (overrides = {}) => ({source_ref: location.ref, selector: SPAN, revision: 'rev-7', ...overrides})
const passageContext = {node: {graphNodeId: 'event-1', sourceCoordinates: []}, anchor: {state: 'passage', source_ref: location.ref, selector: SPAN}}
const passageFrom = (carry) => carry.passage

test('a disclosed text span is carried to the file open, with the revision the resolver proved', async () => {
  const {deps, log} = harness({resolveSource: async () => ({...fileTarget, anchor: passageAnchor()})})
  await answerHostedSummon(summon(sourceDetail({context: passageContext})), deps)
  assert.deepEqual(log.files, [location])
  assert.deepEqual(passageFrom(log.carries[0]), {source_ref: location.ref, selector: {unit: 'text_span', start: 4, end: 9}, revision: 'rev-7'})
  assert.equal('note' in log.carries[0], false, 'a passage that opens is not named as refused')
})

test('an open that asked for no passage carries nothing, and names nothing', async () => {
  const {deps, log} = harness({resolveSource: async () => fileTarget})
  await answerHostedSummon(summon(sourceDetail()), deps)
  assert.deepEqual(log.carries, [{}])
})

test('a passage the reader cannot place (a timestamp) is named, and the file opens at its top', async () => {
  const refusal = 'A timestamp passage has no reader that positions it; the source opens at its top.'
  const {deps, log} = harness({resolveSource: async () => ({...fileTarget, anchorRefusal: refusal})})
  await answerHostedSummon(summon(sourceDetail({context: passageContext})), deps)
  assert.deepEqual(log.files, [location])
  assert.deepEqual(log.carries[0], {note: refusal})
})

test('an unasked refusal from the resolver is not named on a plain open', async () => {
  const {deps, log} = harness({resolveSource: async () => ({...fileTarget, anchorRefusal: 'No passage is disclosed for this event; its source opens at the top.'})})
  await answerHostedSummon(summon(sourceDetail({context: {node: {graphNodeId: 'event-1', sourceCoordinates: []}, anchor: {state: 'top', reason: 'x'}}})), deps)
  assert.deepEqual(log.carries[0], {})
})

test('a passage the shell cannot prove is refused by name and never carried, whatever the resolver said', async () => {
  const badSpans = [
    passageAnchor({source_ref: 'central:file:notes/other.md'}),
    passageAnchor({selector: {unit: 'text_span', start: 9, end: 4}}),
    passageAnchor({selector: {unit: 'text_span', start: 4, end: 4}}),
    passageAnchor({selector: {unit: 'timestamp_range', from: 'a', to: 'b'}}),
    passageAnchor({revision: ''}),
  ]
  for (const anchor of badSpans) {
    const {deps, log} = harness({resolveSource: async () => ({...fileTarget, anchor})})
    await answerHostedSummon(summon(sourceDetail({context: passageContext})), deps)
    assert.equal('passage' in log.carries[0], false, JSON.stringify(anchor))
    assert.match(log.carries[0].note, /malformed|top/)
  }
})

test('a knowledge reading names why a passage is not opened, and still opens its Knowledge page', async () => {
  const refusal = 'This source opens as a knowledge reading, which has no passage addressing; it opens at its top.'
  const {deps, log} = harness({resolveSource: async () => ({...addressTarget, anchorRefusal: refusal})})
  await answerHostedSummon(summon(sourceDetail({context: passageContext})), deps)
  assert.deepEqual(log.faults, [refusal])
  assert.equal(log.knowledge.length, 1)
})

test('passageSpanOf admits only a text span of the opened file at a revision, and refuses the rest', () => {
  assert.deepEqual(passageSpanOf(passageAnchor(), location.ref), {start: 4, end: 9, revision: 'rev-7'})
  assert.equal(passageSpanOf(passageAnchor(), 'central:file:notes/other.md'), undefined)
  assert.equal(passageSpanOf(passageAnchor({selector: {unit: 'text_span', start: -1, end: 3}}), location.ref), undefined)
  assert.equal(passageSpanOf(passageAnchor({selector: {unit: 'text_span', start: 1.5, end: 3}}), location.ref), undefined)
  assert.equal(passageSpanOf(passageAnchor({selector: {unit: 'image_region', x: 0, y: 0, width: 1, height: 1}}), location.ref), undefined)
  assert.equal(passageSpanOf(null, location.ref), undefined)
  assert.equal(passageSpanOf('rev-7', location.ref), undefined)
})

test('the source-open receiver is handed the passage, and the Workbench reveals it or names why not', async () => {
  const {readFile} = await import('node:fs/promises')
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const workbench = await readFile(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
  assert.match(app, /setSourceIntent\(\{location: detail\.location, passage: detail\.passage, note: detail\.note\}\)/, 'the presented intent keeps the passage and note')
  assert.match(app, /detail: \{location: sourceIntent\.location, passage: sourceIntent\.passage, note: sourceIntent\.note\}/, 'the Workbench is handed the same carry, once')
  assert.match(workbench, /const span = passageSpanOf\(request\.passage, location\.ref\)/, 'the Workbench admits only a passage it can place')
  assert.match(workbench, /queueSourcePassageReveal\(reveal\)/, 'the reveal is queued for the binding the file opened in, and the editor admits it at its revision')
  assert.match(workbench, /kind: 'source-passage' as const, bindingId: binding\.id/, 'the reveal names the binding it opened')
  assert.match(workbench, /callbacks\.current\.report\(request\.note\)/, 'a refusal the frame asked about is named on the Workbench line')
  assert.match(workbench, /requestMaterialViewOpen\(binding\.id, 'source'\)/, 'a Markdown or HTML passage asks its surface for the Source view, for this open only')
  assert.doesNotMatch(workbench, /materialViewKey|encodeMaterialViewPrefs|oi-cradle\.material-view/, 'the Workbench never writes the remembered Rendered|Source view; only the person\'s own toggle does (MaterialSurface)')
  assert.doesNotMatch(workbench, /span && !held/, 'a held tab is not exempt from the passage request')
  const requestAt = workbench.indexOf("requestMaterialViewOpen(binding.id, 'source')")
  const queueAt = workbench.indexOf('queueSourcePassageReveal(reveal)')
  assert.ok(requestAt > 0 && queueAt > requestAt, 'the Source request is made before the reveal is queued, in the same turn for a held tab and a new tab')
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
  assert.match(panel, /openFile: \(location, carry\) => window\.dispatchEvent\(new CustomEvent\(SOURCE_PRESENT, \{detail: \{location, \.\.\.carry\}\}\)\)/, 'the panel asks App to present, never fires into a hidden Workbench, and carries the passage')
  assert.match(app, /window\.addEventListener\(SOURCE_PRESENT, present\)/)
  assert.match(app, /setCenterPanel\('native\.workbench'\); setSourceIntent\(\{location: detail\.location, passage: detail\.passage, note: detail\.note\}\)/, 'the Workbench is presented in the same act')
  assert.match(app, /if \(!sourceIntent \|\| centerPanel !== 'native\.workbench'\) return\n\s*window\.dispatchEvent\(new CustomEvent\('oi:epi-open-source', \{detail: \{location: sourceIntent\.location, passage: sourceIntent\.passage, note: sourceIntent\.note\}\}\)\)\n\s*setSourceIntent\(null\)/, 'after that commit, the open is handed over once and the intent cleared')
})
