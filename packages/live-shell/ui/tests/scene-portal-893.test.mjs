// O-I #747 round 893, XS10 (manual §20.1 The Launch panel: Target "Open a portal", Portal placement "Where a portal opens"). DLW build
// ruling 2026-11-07: a scene's trigger runs on every occasion the manual lists, and its target acts the same whatever the occasion — a
// "Scene enters → Open a portal (Beside)" opens. Walk 892 kept one on Of Central and launched it: nothing opened, because the frame's
// portal request (its scenePortal.ts `scene-portal`) had no answer in this shell, and the legacy admission opened only Activated portals.
// Now the shell answers it: the trigger is re-read from the native authored Scene (the frame supplies pointers only), its source opens
// where the shell opens a source, and the frame is told whether it opened; a refusal is also named on the fault line.
// Round 895 (OPEN 4): a file portal is answered once the Workbench has placed it where its placement says (portal-placement-895.test.mjs).
// Channels: SCRIPTED — answerScenePortal over an injected admission and recording owners. CODE-READING — the Expressions panel routes
// the request and answers through the boundary host; the legacy admission takes any occasion the kernel keeps.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

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

const {answerScenePortal} = await import('../src/native/hostedSummons.ts')

const subject = {ref: 'expression:made-of', revision: 4, sceneRef: 'expression:made-of:scene:central'}
const request = (overrides = {}) => ({v: 1, kind: 'host-request', request: 'scene-portal', request_id: 'r-1', detail: {trigger_ref: 'expression:made-of:trigger:p1', subject}, ...overrides})
const location = {schema: 'central.path-ref/v1', ref: 'central:file:notes/a.md', root: 'Control', path: 'notes/a.md'}
function harness({current = true, resolvePortal} = {}) {
  const log = {answers: [], files: [], knowledge: [], faults: [], cleared: 0, asked: []}
  const deps = {transport: {kind: 'unavailable', reason: 'test transport'}, current: () => current, project: () => 'O-I',
    openFile: (value, carry) => log.files.push([value.ref, carry]), openKnowledge: value => log.knowledge.push(value),
    fault: reason => log.faults.push(reason), clear: () => {log.cleared++}, answer: (id, error) => log.answers.push([id, error ?? null]),
    resolvePortal: async detail => {log.asked.push(detail); return resolvePortal(detail)}}
  return {deps, log}
}

test('XS10: a portal trigger\'s source opens where the shell opens a source, and the frame is answered', async () => {
  const knowledge = harness({resolvePortal: async () => ({target: {address: {kind: 'wiki', value: 'wiki:node:central'}, title: 'Central', project: 'O-I'}})})
  await answerScenePortal(request(), knowledge.deps)
  assert.deepEqual(knowledge.log.asked, [request().detail], 'the admission is given the frame\'s pointers as they came')
  assert.equal(knowledge.log.knowledge.length, 1)
  assert.deepEqual(knowledge.log.knowledge[0].address, {kind: 'wiki', value: 'wiki:node:central'})
  assert.deepEqual(knowledge.log.answers, [], 'answered when the Knowledge panel says it opened')
  knowledge.log.knowledge[0].complete()
  assert.deepEqual(knowledge.log.answers, [['r-1', null]])
  const file = harness({resolvePortal: async () => ({target: {location, title: 'a.md'}})})
  await answerScenePortal(request(), file.deps)
  assert.equal(file.log.files.length, 1)
  const [[ref, carry]] = file.log.files
  assert.equal(ref, 'central:file:notes/a.md')
  assert.equal(carry.portal.place, 'beside', 'the manual\'s default placement')
  assert.deepEqual(file.log.answers, [], 'answered once the Workbench has placed it (round 895)')
  carry.portal.complete()
  assert.deepEqual(file.log.answers, [['r-1', null]])
})

test('XS10: a portal that does not open is answered with its reason, which is also named; a request without its id is not answered', async () => {
  const refused = harness({resolvePortal: async () => { throw Error('This Scene keeps no such portal trigger.') }})
  await answerScenePortal(request(), refused.deps)
  assert.deepEqual(refused.log.answers, [['r-1', 'This Scene keeps no such portal trigger.']])
  assert.deepEqual(refused.log.faults, ['This Scene keeps no such portal trigger.'])
  const gone = harness({current: false, resolvePortal: async () => ({target: {location, title: 'a.md'}})})
  await answerScenePortal(request(), gone.deps)
  assert.deepEqual(gone.log.answers, [['r-1', 'The Expression is no longer presented.']])
  assert.deepEqual(gone.log.files, [])
  const unnamed = harness({resolvePortal: async () => ({target: {location, title: 'a.md'}})})
  await answerScenePortal(request({request_id: undefined}), unnamed.deps)
  assert.deepEqual([unnamed.log.asked, unnamed.log.answers, unnamed.log.files], [[], [], []])
})

test('CODE-READING: the panel routes the request and answers through the boundary host; the admission takes any occasion the kernel keeps', async () => {
  const panel = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')
  assert.match(panel, /if \(request\.request === 'scene-portal'\) answerPortal\(request\)/)
  assert.match(panel, /answer: \(id, error, note\) => at\?\.answerScenePortal\(id, error, note\),/)
  const host = await readFile(new URL('../../../expressions-boundary/src/host.ts', import.meta.url), 'utf8')
  assert.match(host, /answerScenePortal\(requestId: string, error\?: string, note\?: string\) \{\n\s*if \(!boundedText\(requestId, 128\)\) return;\n\s*this\.post\(\{v: CHANNEL_VERSION, kind: 'scene-portal-result', request_id: requestId, ok: !error,/)
  const admission = await readFile(new URL('../../../../desktop/cradle/src/expressions/scenePortal.ts', import.meta.url), 'utf8')
  assert.match(admission, /const TRIGGER_OCCASIONS:readonly string\[\]=\['scene_enter','scene_leave','activate','select','sequence_transition'\];/)
  assert.match(admission, /if\(!trigger\|\|!TRIGGER_OCCASIONS\.includes\(trigger\.occasion\)\|\|trigger\.target\.kind!=='portal'\)/)
  const frame = await readFile(new URL('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/scenePortal.ts', import.meta.url), 'utf8')
  assert.match(frame, /kind!=='scene-portal-result'\|\|event\.data\.request_id!==request_id/, 'the frame waits for exactly this answer')
})
