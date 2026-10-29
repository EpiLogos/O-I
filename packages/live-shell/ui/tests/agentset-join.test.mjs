import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// The Agentset rack's Join (DLW §19.15; O-I #684): how the members' returns combine is Central's agent set's (`central.agent-set/v1` `join`:
// none · all · first · quorum · weighted, written by central.agent-set.save). The group is an AIKit SessionSpace, and the space names the set
// it runs (AIKit `agent_set`, tied when its team is prepared, or staged as bind-agent-set): the rack reads that set's join through
// central.agent-set.read, and writes a new join through central.agent-set.save at the set's next revision. A group that names no set, or a
// set that names no join, says so.
// Channels:
// - REAL (tests/fixtures/central-agent-set-anima-2026-10-29.json): Central's read of the anima set, saved with no join.
// - FIXTURE, owner-shaped: agency_read rows whose space record carries AIKit's tie (aikit.session-space-application/v1 `agent_set`).
// - SCRIPTED: Central's save, a stand-in that records what it was asked.
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
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}

const model = await import('../src/agent/agentRunModel.ts')
const chain = await import('../src/agent/devices/sessionChainBindings.ts')
const binds = await import('../src/agent/devices/designBindings.ts')
const ANIMA = JSON.parse(readFileSync(new URL('./fixtures/central-agent-set-anima-2026-10-29.json', import.meta.url), 'utf8')).answer

const space = tie => ({version: 'aikit.session-space-application/v1', revision: 2, definition: {id: 'session-space/central-team', projects: []}, label: 'Central native team',
  agent_sessions: {'agent-session/eros': {agent_session: 'agent-session/eros', purpose: 'compose'}}, ...(tie ? {agent_set: tie} : {})})
const rows = tie => [{spaceRef: 'session-space/central-team', spaceLabel: 'Central native team', sessionRef: 'agent-session/eros', purpose: 'compose', agentRef: 'agent/anima-eros', raw: space(tie)}]

test('a group track carries the Central set its space names, and none where it names none', () => {
  const tracks = model.buildTracks(rows({agent_set_ref: 'anima', revision: 'r1', provenance: []}), new Map())
  assert.deepEqual(tracks.find(t => t.group).agentSet, {ref: 'anima', revision: 'r1'})
  assert.equal(tracks.find(t => !t.group).agentSet, undefined, 'a member carries no tie of its own')
  assert.equal(model.buildTracks(rows(null), new Map()).find(t => t.group).agentSet, undefined)
})

const groupOf = tie => { const tracks = model.buildTracks(rows(tie), new Map()); return {group: tracks.find(t => t.group), tracks} }
const answered = value => ({status: 'answered', value})

test('Join reads the set\'s join, and a set saved with none says so; a group with no set names the act that ties one', () => {
  const {group, tracks} = groupOf({agent_set_ref: 'anima', revision: 'r1'})
  const none = chain.agentsetBinding({group, tracks, holds: binds.chainHolds(), set: answered(ANIMA)}, {saveSet: async () => ({})})
  assert.equal(none.values.join, undefined, 'the anima set is saved with no join')
  assert.match(none.standing.join.disabled ?? none.standing.join.refused ?? '', /names no join/)
  assert.equal(none.writes('join'), true, 'and the rack can write one through Central')
  const quorum = chain.agentsetBinding({group, tracks, holds: binds.chainHolds(), set: answered({...ANIMA, record: {...ANIMA.record, join: 'quorum'}})})
  assert.equal(quorum.values.join, 'quorum')
  assert.equal(quorum.values.crew, 'anima', 'the crew is the set\'s ref in Central')
  assert.equal(chain.agentsetBinding({group: groupOf(null).group, tracks: groupOf(null).tracks, holds: binds.chainHolds()}).values.crew, 'Central native team', 'untied: the space\'s label')
  const untied = groupOf(null)
  const bare = chain.agentsetBinding({group: untied.group, tracks: untied.tracks, holds: binds.chainHolds()})
  assert.match(bare.standing.join.disabled, /names no Central agent set/)
  assert.match(bare.standing.join.disabled, /bind-agent-set/)
  const refused = chain.agentsetBinding({group, tracks, holds: binds.chainHolds(), set: {status: 'refused', error: 'no agent-set anima'}})
  assert.match(refused.standing.join.disabled, /no agent-set anima/)
})

test('a new Join is saved on Central\'s set at its next revision, and Central\'s refusal comes back in its words', async () => {
  const {group, tracks} = groupOf({agent_set_ref: 'anima', revision: 'r1'})
  const asked = []
  const ports = {saveSet: async input => { asked.push(input); return {ref: 'anima', revision: 'r2'} }}
  const binding = chain.agentsetBinding({group, tracks, holds: binds.chainHolds(), set: answered(ANIMA)}, ports)
  await binding.write([{key: 'join', value: 'all'}])
  assert.equal(asked.length, 1)
  assert.deepEqual([asked[0].scope, asked[0].expected_revision, asked[0].record.join, asked[0].record.revision, asked[0].record.ref], ['root', 'r1', 'all', 'r2', 'anima'])
  assert.deepEqual(asked[0].record.orchestrator_agent_ref, ANIMA.record.orchestrator_agent_ref, 'the rest of the record is Central\'s, unchanged')
  await assert.rejects(binding.write([{key: 'join', value: 'sometimes'}]), /none, all, first, quorum or weighted/)
  const failing = chain.agentsetBinding({group, tracks, holds: binds.chainHolds(), set: answered(ANIMA)}, {saveSet: async () => { throw Error('revision conflict on anima') }})
  await assert.rejects(failing.write([{key: 'join', value: 'all'}]), /revision conflict on anima/)
  const noPorts = chain.agentsetBinding({group, tracks, holds: binds.chainHolds(), set: answered(ANIMA)})
  await assert.rejects(noPorts.write([{key: 'join', value: 'all'}]), /no carrier/)
  // The other delegation settings stay Hermes', refused as before.
  await assert.rejects(binding.write([{key: 'fanOut', value: 3}]), /Hermes/)
})
