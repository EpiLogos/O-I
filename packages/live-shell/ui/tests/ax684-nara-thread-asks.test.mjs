// Nara's thread holds each ask its session put to the decision helper (DLW §19.4, the Ask row: "A typed question the agent put to a
// decision helper: the labels it allowed and the answer, marked as evidence"; O-I #684 follow-up, lane AX). Lane AN gave the Factory
// Agent's thread its asks (agent/devices/FactoryDeviceChain.tsx: aikit_read decision-asks for the chain's session and the shown one,
// askRowsOf into threadJson and threadBinding). Central's Agent is the same Agent on Nara's dialogue (central/devices/answerBinding.ts):
// its own thread and its Thread page read the same asks for the dialogue's session, and the shown one, the same way.
//
// Channels:
// - REAL (tests/fixtures/aikit-decide-asks-2026-10-30.json): AIKit's answer for one session's three asks (lane AN's capture).
// - FIXTURE: the encounter view's blocks and a consent request that waits, in the owner's shapes; the roster's Nara agent.
// - SCRIPTED: the bindings' values, and CentralDevices.tsx's wiring read as source (its hooks need the live window). Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const answer = await import('../src/central/devices/answerBinding.ts')

const ASKS = JSON.parse(readFileSync(new URL('./fixtures/aikit-decide-asks-2026-10-30.json', import.meta.url), 'utf8')).answer
const SESSION = 'agent-session/aletheia-gate-2'
const answered = value => ({status: 'answered', value})
const READING = {schema: 'aikit.encounter-view/v1', agent_session: SESSION, more: false, draft: {revision: 1, text: ''}, permissions: [],
  blocks: [{id: 1, kind: 'user', text: 'What does gate 2 hold?'}, {id: 2, kind: 'assistant', text: 'Gate 2 reads annotated; the helper agreed.'}],
  connection: {error: null, resident: false, state: 'Disconnected'}, actions: []}
const CONSENT = {native_request_id: 'req-1', native_session_id: 'n-1', tool_call_id: 'call-1', raw: {}, provenance: [],
  tool_call: {kind: 'execute', title: 'bash', rawInput: {command: 'ctrl day read'}},
  choices: [{option_id: 'allow-once', label: 'This time', kind: 'allow_once'}, {option_id: 'no', label: 'Refuse', kind: 'reject_once'}]}
const ROSTER = [{ref: 'agent/nara', name: 'Nara', accepted: true, purpose: 'answers on Central', role: 'nara'}]
const input = (over = {}) => ({nara: {state: 'bound', session: SESSION}, observed: {reading: READING, status: READING.connection}, roster: ROSTER,
  asks: answered(ASKS), ...over})
const rows = values => JSON.parse(values.thread)

test('Nara\'s own thread holds each ask its session put to the decision helper, after the conversation', () => {
  const thread = rows(answer.centralAgentValues('central:agent', input()))
  assert.deepEqual(thread.map(row => row.kind), ['you', 'agent', 'ask', 'ask', 'ask'])
  assert.deepEqual(thread[2], {who: 'Nara', kind: 'ask', tool: 'kev-latest', text: 'Which gate reading fits the passage at this gate?',
    labels: ['aligned', 'annotated', 'hold', 'redirect'], out: 'annotated'}, 'the question, its helper, the labels and the answer')
  assert.match(thread[4].out, /^no answer: Provider transport failed/, 'an ask no answer came for says why')
  // Before a consent request that waits, as on Factory's.
  const waiting = rows(answer.centralAgentValues('central:agent', input({observed: {reading: {...READING, permissions: [CONSENT]}, status: READING.connection}})))
  assert.deepEqual(waiting.map(row => row.kind), ['you', 'agent', 'ask', 'ask', 'ask', 'proposal'])
})

test('only the dialogue\'s own session\'s asks, once AIKit answered; unbound, no thread at all', () => {
  const kinds = over => rows(answer.centralAgentValues('central:agent', input(over))).map(row => row.kind)
  assert.deepEqual(kinds({asks: undefined}), ['you', 'agent'], 'unread asks leave the conversation as it was')
  assert.deepEqual(kinds({asks: {status: 'reading', value: null}}), ['you', 'agent'])
  assert.deepEqual(kinds({asks: {status: 'refused', value: null, error: "unrecognized subcommand 'asks'"}}), ['you', 'agent'])
  assert.deepEqual(kinds({nara: {state: 'bound', session: 'agent-session/someone-else'}}), ['you', 'agent'], 'another session\'s asks are not Nara\'s')
  assert.equal(answer.centralAgentValues('central:agent', input({nara: {state: 'unbound', session: null}})).thread, undefined)
})

test('Central\'s chain asks AIKit for the dialogue\'s asks and the shown session\'s, and hands them to the Agent and its Thread', () => {
  const source = readFileSync(new URL('../src/central/devices/CentralDevices.tsx', import.meta.url), 'utf8')
  assert.match(source, /useAikitRead\(transport, nara\.session \? \{kind: 'decision-asks', agent_session: nara\.session\} : null\)/, 'the dialogue\'s session')
  assert.match(source, /useAikitRead\(transport, threadShown \? \{kind: 'decision-asks', agent_session: threadShown\} : null\)/, 'the session the Thread shows')
  assert.match(source, /const answerInput = useMemo\(\(\) => \(\{nara:[\s\S]{0,400}?, asks: naraAsks\}\)/, 'the Agent\'s own thread')
  assert.match(source, /threadBinding\(\{selected: nara\.session, chainSession: nara\.session,[\s\S]{0,300}?, asks: shownAsks,/, 'the Thread page')
})
