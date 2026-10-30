// The Agentset rack's Join lights First (DLW §19.15; O-I #684): Software Factory's barrier now combines a team step's returns by its set's
// join, read from Central's agent set as the Run starts and kept with the Run: All waits for every member, First closes the step on the
// first acceptable return (factory/src/orchestration.rs `record_step_join`, `barrier_reading`). Quorum and Weighted stay dark: the manual
// names no count for Quorum and no member weights for Weighted, and no Central set carries either, so Factory refuses a run on them.
//
// Channels:
// - REAL (tests/fixtures/central-agent-set-anima-2026-10-29.json): Central's read of the anima set.
// - FIXTURE, owner-shaped: agency_read rows whose space record carries AIKit's tie; a pattern of the agency ontology's shape.
// - SCRIPTED: the catalogue's rack rendered through the runtime's host to static markup; Central's save, a stand-in that records.
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

const model = await import('../src/agent/agentRunModel.ts')
const chain = await import('../src/agent/devices/sessionChainBindings.ts')
const agency = await import('../src/inhabitants/catalogue/faces/agency.ts')
const {design: rackDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')
const ANIMA = JSON.parse(readFileSync(new URL('./fixtures/central-agent-set-anima-2026-10-29.json', import.meta.url), 'utf8')).answer
const space = {version: 'aikit.session-space-application/v1', revision: 2, definition: {id: 'session-space/central-team', projects: []}, label: 'Central native team',
  agent_sessions: {'agent-session/eros': {agent_session: 'agent-session/eros', purpose: 'compose'}}, agent_set: {agent_set_ref: 'anima', revision: 'r1', provenance: []}}
const tracks = model.buildTracks([{spaceRef: 'session-space/central-team', spaceLabel: 'Central native team', sessionRef: 'agent-session/eros', purpose: 'compose',
  agentRef: 'agent/anima-eros', raw: space}], new Map())
const group = tracks.find(t => t.group)
const answered = value => ({status: 'answered', value})

test('the rack lights First, which Software Factory\'s barrier combines by; Quorum and Weighted stay dark and say what they lack', async () => {
  bind.resetHolds()
  host.resetHost()
  const asked = []
  const binding = chain.agentsetBinding({group, tracks, holds: bind.chainHolds(), set: answered({...ANIMA, record: {...ANIMA.record, join: 'all'}})},
    {saveSet: async input => { asked.push(input); return {} }})
  const whole = renderToStaticMarkup(createElement(host.HostedDevice, {designed: rackDesign, binding, view: 'whole', nav: {}}))
  assert.match(whole, /<option value="first">First<\/option>/, 'First is open')
  assert.match(whole, /<option value="quorum" disabled="" title="[^"]*no count[^"]*">Quorum<\/option>/, 'Quorum is dark: no count')
  assert.match(whole, /<option value="weighted" disabled="" title="[^"]*weight[^"]*">Weighted<\/option>/, 'Weighted is dark: no weights')
  await binding.write([{key: 'join', value: 'first'}])
  assert.deepEqual([asked[0].record.join, asked[0].expected_revision], ['first', ANIMA.revision], 'First is saved on Central\'s set')
  host.resetHost()
})

test('a type whose Join is First lands on the rack\'s Join; Quorum and Weighted stand named and dark with what they lack', () => {
  const pattern = {id: 'scout', name: 'Scout', family: 'sense', does: '', start: 'Called', stay: 'Task', count: 'Crew', reach: 'Read', link: 'Parent', change: 'Same',
    animals: [], breaks: '', asks: ''}
  const join = value => agency.presetRows({...pattern, join: value}).find(row => row.field === 'Join')
  assert.deepEqual(join('First').lands, [{device: 'Agentset rack', setting: 'Join', value: 'First'}])
  assert.equal(join('First').dark, undefined)
  assert.match(join('Quorum').dark, /no count/)
  assert.match(join('Weighted').dark, /weight/)
  assert.deepEqual(join('All').lands, [{device: 'Agentset rack', setting: 'Join', value: 'All'}])
})
