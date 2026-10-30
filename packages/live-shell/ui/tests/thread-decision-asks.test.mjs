// The Agent's Thread holds each ask the session put to the decision helper (DLW §19.4, the Ask row: "A typed question the agent put
// to a decision helper: the labels it allowed and the answer, marked as evidence"; O-I #684). AIKit keeps each ask against the session
// that asked (`aikit decide invoke --agent-session`, or the session's own AIKIT_SESSION_ID) and reads them back (`aikit decide asks
// --agent-session S`, aikit.decision-asks/v1; the kernel's aikit_read decision-asks).
//
// Channels:
// - REAL (tests/fixtures/aikit-decide-asks-2026-10-30.json): AIKit's answer for one session's three asks, two answered by the installed
//   Kev, one whose provider did not answer.
// - FIXTURE: the encounter view's blocks (two messages) and a consent request that waits, in the owner's shapes.
// - SCRIPTED: the catalogue's Thread rendered through the runtime's host to static markup. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(specifier,context,next){
  if(specifier.startsWith('@epilogos/expressions-boundary/'))return next(BOUNDARY+specifier.slice('@epilogos/expressions-boundary/'.length)+'.ts',context);
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const bind = await import('../src/agent/devices/designBindings.ts')
const thread = await import('../src/agent/devices/threadBinding.ts')
// The devices are of the families' admitted faces (lane BF3: the thread, tasks and attempt-review faces are admitted).
const familyDoor = await import('../src/inhabitants/familyManifest.ts')
familyDoor.resetFamilyManifestsForTest()
;(await import('../src/inhabitants/loadAgentShellFamilies.ts')).loadAgentShellFamilies()
;(await import('../src/inhabitants/worldShellFamilies.ts')).loadWorldShellFamilies()
const {foundHarnesses} = await import('../src/agent/useHarnessBinding.ts')
const {catalogueModels} = await import('../src/agent/devices/useModelCatalogue.ts')
const {design: threadDesign} = await import('../src/inhabitants/catalogue/panels/thread.tsx')
const {THREAD_PAGE} = await import('../src/agent/devices/oneAgentBinding.ts')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')

const views = ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => {
  const said = console.error
  console.error = (first, ...rest) => { if (!String(first).includes('useLayoutEffect does nothing on the server')) said(first, ...rest) }
  try { return views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))) } finally { console.error = said }
}
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const read = path => readFileSync(new URL(`../src/agent/${path}`, import.meta.url), 'utf8')

const ASKS = JSON.parse(readFileSync(new URL('./fixtures/aikit-decide-asks-2026-10-30.json', import.meta.url), 'utf8')).answer
const SESSION = 'agent-session/aletheia-gate-2'
const answered = value => ({status: 'answered', value})
const track = (sessionRef, over = {}) => ({sessionRef, purpose: null, agentRef: null, agentName: null, agentAccepted: null, spaceRef: `space/${sessionRef}`, spaceLabel: null, depth: 1,
  parentRef: `space/${sessionRef}`, group: false, memberRefs: [], tasks: [], needle: null, telemetryOn: true, budget: {used: null, max: null}, disclosure: null, ...over})
const TRACKS = [track(SESSION, {purpose: 'Gate 2', agentRef: 'agent/aletheia', agentName: 'aletheia'})]
const READING = {schema: 'aikit.encounter-view/v1', agent_session: SESSION, more: false, draft: {revision: 1, text: ''}, permissions: [],
  blocks: [{id: 1, kind: 'user', text: 'Read gate 2 for the join lane.'}, {id: 2, kind: 'assistant', text: 'Gate 2 reads annotated; the helper agreed.'}],
  connection: {error: null, resident: false, state: 'Disconnected'}, actions: []}
const CONSENT = {native_request_id: 'req-1', native_session_id: 'n-1', tool_call_id: 'call-1', raw: {}, provenance: [],
  tool_call: {kind: 'execute', title: 'bash', rawInput: {command: 'factory attempt read state.json'}},
  choices: [{option_id: 'allow-once', label: 'This time', kind: 'allow_once'}, {option_id: 'no', label: 'Refuse', kind: 'reject_once'}]}
const input = (over = {}) => ({selected: SESSION, chainSession: SESSION, tracks: TRACKS, nowUnixMs: 1_000_000,
  encounter: {reading: READING, status: READING.connection}, agent: {}, holds: bind.chainHolds(), asks: answered(ASKS), ...over})

test('each ask the session put to the decision helper is an Ask row: the labels it allowed, the answer as evidence, or why none came', () => {
  const rows = thread.askRowsOf(answered(ASKS), SESSION, 'aletheia')
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0], {who: 'aletheia', kind: 'ask', tool: 'kev-latest', text: 'Which gate reading fits the passage at this gate?',
    labels: ['aligned', 'annotated', 'hold', 'redirect'], out: 'annotated'})
  assert.deepEqual([rows[1].text, rows[1].labels, rows[1].out], ['How grounded is the retrieval?', ['empty', 'grounded', 'partial'], 'partial'])
  assert.equal(rows[2].out, 'no answer: Provider transport failed; payload and credential withheld, usage may be unknown', 'an ask with no answer says why')
  // Nothing is read for another session than the one asked about, or before AIKit answered.
  assert.deepEqual(thread.askRowsOf(answered(ASKS), 'agent-session/someone-else', 'aletheia'), [])
  assert.deepEqual(thread.askRowsOf({status: 'reading', value: null}, SESSION, 'aletheia'), [])
  assert.deepEqual(thread.askRowsOf({status: 'refused', value: null, error: "unrecognized subcommand 'asks'"}, SESSION, 'aletheia'), [])
})

test('the Thread holds the asks after the conversation and before a consent request that waits', () => {
  const kinds = rows => JSON.parse(rows).map(row => row.kind)
  assert.deepEqual(kinds(thread.threadValues(input()).thread), ['you', 'agent', 'ask', 'ask', 'ask'])
  const waiting = thread.threadValues(input({encounter: {reading: {...READING, permissions: [CONSENT]}, status: READING.connection}}))
  assert.deepEqual(kinds(waiting.thread), ['you', 'agent', 'ask', 'ask', 'ask', 'proposal'])
  // Unread asks leave the conversation as it was.
  assert.deepEqual(kinds(thread.threadValues(input({asks: undefined})).thread), ['you', 'agent'])
})

test('the Thread draws each ask with its helper, its labels and its answer, marked as evidence', () => {
  bind.resetHolds()
  host.resetHost()
  const binding = thread.threadBinding(input(), null, {select: () => {}})
  const full = hosted(threadDesign, binding)[3]
  assert.ok(full.includes(escaped('Asked kev-latest · Which gate reading fits the passage at this gate?')), 'the question, put to its helper')
  assert.ok(full.includes(escaped('aligned · annotated · hold · redirect → annotated · evidence')), 'the labels it allowed and the answer, as evidence')
  assert.ok(full.includes(escaped('→ no answer: Provider transport failed')), 'and the ask no answer came for')
  host.resetHost()
})
