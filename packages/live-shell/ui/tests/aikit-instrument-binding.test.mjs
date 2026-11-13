// Parity D-08: AIKit's instrument (manual §19.26; the catalogue's ai-kit__ai-kit.tsx, `ai-kit:ai-kit`) was designed with six pages and never
// published. It is published now on its own binding (src/agent/devices/aikitInstrumentBinding.ts, AikitRailDevice.tsx) over the readings the
// UI already has: the Skillset rack's upkeep reads and binding, AIKit's continuity, its set list, and the rack's door values for the agent.
//
// Channels:
// - REAL: AIKit's answers as captured on 21 Oct (desktop/cradle/kernel/tests/fixtures/owner-routes/aikit-continuity-history-2026-10-21.json:
//   pressure, commands, bypass list, procedure list, collate; aikit-source-list-2026-10-21.json; tests/fixtures/aikit-procedure-diff-2026-10-21.json).
// - FIXTURE: the run's track, the Skillset rack's members for its agent, `aikit unused` and `aikit set list` (no capture on this machine),
//   and the write port, which records every request: nothing reaches AIKit.
// - SCRIPTED: the catalogue's own design drawn through the runtime's host (deviceHost.HostedDevice) to static markup, on the binding and on
//   the same values alone, page by page.
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
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const holds = await import('../src/agent/devices/chainHolds.ts')
const main = await import('../src/agent/devices/mainTrackBindings.ts')
const ai = await import('../src/agent/devices/aikitInstrumentBinding.ts')
const {design} = await import('../src/inhabitants/catalogue/panels/ai-kit__ai-kit.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const ROUTES = '../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/'
const CAPTURE = json(`${ROUTES}aikit-continuity-history-2026-10-21.json`)
const SOURCES = json(`${ROUTES}aikit-source-list-2026-10-21.json`).list.data
const DIFF = json('./fixtures/aikit-procedure-diff-2026-10-21.json').data
const answered = value => ({status: 'answered', value, error: null})
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim()

// FIXTURE: the Skillset rack's own door values for the session's agent (designBindings.ts rackValues: `members` as practice.ts Member, `carried`).
const MEMBERS = [
  {id: 'skill/aikit/wiki-inhabitation', name: 'wiki-inhabitation', form: 'skill', rev: 'r3', says: 'Inhabit the wiki.', rungs: [true, true, true, true, true, true, null, null, null, null]},
  {id: 'method/central/engineering-methodology', name: 'engineering-methodology', form: 'method', rev: 'r9', says: 'How code work is done.', rungs: [true, true, true, true, true, true, true, null, null, null]},
]
const RACK = {members: JSON.stringify(MEMBERS), carried: JSON.stringify([{name: 'central:core-development', members: 2}])}
const RUN = {name: 'Land the parity batch', group: false}
const AGENT = {id: 'agent:flint', name: 'flint', sessionRef: 'agent-session/flint'}
const UNUSED = {count: 1, unused: [{capability: 'skill/aikit/wiki-inhabitation', name: 'wiki-inhabitation', kind: 'skill', active: true, failed_runs: 0}]}
const SET_LIST = {sets: [{name: 'central:core-development', members: 2}, {name: 'central:documentation', members: 5}]}

function input(over = {}, writes = []) {
  return {holds: holds.chainHolds(), run: RUN, agent: AGENT, rack: RACK, asked: true, project: 'O-I',
    upkeep: {unused: answered(UNUSED), sources: answered(SOURCES), collate: answered(CAPTURE.collate_trimmed.data), bypasses: answered(CAPTURE.bypass_list.data),
      procedures: answered(CAPTURE.procedure_list.data), write: async request => { writes.push(request) }},
    context: {pressure: answered(CAPTURE.pressure.data), commands: answered(CAPTURE.commands.data), turn: answered({turn: null, blocks: [], scope: 'agent-session/flint'})},
    setList: answered(SET_LIST), ...over}
}
const PAGES = ['run', 'context', 'sources', 'adopt', 'package', 'procedures']
const drawn = (binding, page, view = 'full') => { host.setHostPage(binding.id, page); return renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view, nav: {}})) }

test('the instrument is AIKit\'s admitted face, drawn by the catalogue\'s design; the rail claims its tile and publishes it beside the agent devices', () => {
  const device = main.familyFaceDevice(ai.AIKIT_ID, 'ai-kit', 'ai-kit', 'AIKit', 'lib')
  assert.ok(device, 'the family admits the face')
  assert.equal(designKey(device.family, device.face.id), design.id)
  assert.equal(ai.AIKIT_ID, 'ai-kit:ai-kit')
  const tiles = read('agent/agentDockTiles.ts')
  assert.match(tiles, /claimRailWidget\('aikit', AIKIT_ID\)/)
  assert.match(tiles, /\{id: 'aikit', name: 'AIKit', mark: 'lib'/)
  assert.match(read('agent/devices/AgentRailDevices.tsx'), /<AikitRailDevice transport=\{transport\} \/>/)
})

test('every key the design sets is held, written or stands with why — none draws live and is refused on press', () => {
  holds.resetHolds()
  const binding = ai.aikitInstrumentBinding(input())
  const set = [...new Set([...readFileSync(new URL('../src/inhabitants/catalogue/panels/ai-kit__ai-kit.tsx', import.meta.url), 'utf8').matchAll(/p\.set\('([^']+)'/g)].map(match => match[1]))]
  assert.ok(set.length >= 20, 'the design\'s keys are read from its source')
  for (const key of set) {
    assert.ok(key in (binding.local ?? {}) || binding.writes(key) || binding.standing[key]?.disabled, `${key}: held, written, or standing with why`)
  }
})

test('drawn page by page on the real answers, the design shows what AIKit said — never its samples — exactly as it draws those values itself', () => {
  holds.resetHolds()
  const binding = ai.aikitInstrumentBinding(input())
  const bare = {id: 'design:ai-kit', values: binding.values, standing: {}, write: async () => {}}
  for (const page of PAGES) {
    const bound = drawn(binding, page), own = drawn(bare, page)
    host.resetHost()
    assert.equal(text(bound), text(own), `${page}: the bound draw is the design's own draw of the same values`)
    for (const sample of ['Reconcile the agency designs', 'mattpocock', 'byp_01M5EER9', 'prc_01M5EER86PB5JC206XZFWZ2C0A']) assert.doesNotMatch(bound, new RegExp(sample), `${page}: no design sample`)
  }
  const all = PAGES.map(page => text(drawn(binding, page))).join(' ')
  host.resetHost()
  assert.match(all, /Land the parity batch/, 'the run the selection names')
  assert.match(all, /wiki-inhabitation/, 'the agent\'s members as the rack reads them')
  assert.match(all, new RegExp(SOURCES.sources[0].id), 'AIKit\'s own sources')
  assert.match(all, /central:documentation/, 'AIKit\'s set list on Package')
  const widget = text(drawn(binding, 'run', 'widget'))
  host.resetHost()
  assert.match(widget, /AIKit/)
  assert.equal(JSON.parse(binding.values.agents)[0].sets[0], 'central:core-development')
})

test('the acts are AIKit\'s own, on what the page chose: Sync, Preview then Apply at the plan\'s digest, Run at the diff\'s digest, Export', async () => {
  holds.resetHolds()
  const writes = []
  const source = SOURCES.sources[0].id
  await ai.aikitInstrumentBinding(input({}, writes)).write([{key: 'sync', value: source}])
  assert.deepEqual(writes.splice(0), [{kind: 'source-sync', id: source}])
  // Preview holds the root's path; the plan is read for it; Cancel drops the plan and keeps the root.
  const root = JSON.parse(ai.aikitInstrumentBinding(input()).values.roots ?? '[]')[0]
  assert.ok(root, 'collate names a root AIKit does not own')
  await ai.aikitInstrumentBinding(input()).write([{key: 'adoptPreview', value: root.root}])
  const view = holds.viewHolds(holds.chainHolds(), ai.AIKIT_ID)
  assert.equal(view.adoptPreviewed, root.path ?? root.root)
  assert.equal(view.adoptRoot, view.adoptPreviewed)
  ai.aikitInstrumentBinding(input()).local.adoption(undefined)
  assert.equal(holds.viewHolds(holds.chainHolds(), ai.AIKIT_ID).adoptPreviewed, undefined, 'Cancel: the plan is dropped')
  assert.equal(holds.viewHolds(holds.chainHolds(), ai.AIKIT_ID).adoptRoot, root.path ?? root.root, 'the root stays chosen')
  // Run: only at the digest AIKit's diff of the chosen procedure names.
  holds.holdView(ai.AIKIT_ID, 'procedure', DIFF.procedure)
  const withDiff = ai.aikitInstrumentBinding(input({upkeep: {...input().upkeep, procedure: answered(DIFF), write: async request => { writes.push(request) }}}))
  await withDiff.write([{key: 'procRun', value: `${DIFF.procedure}@${DIFF.digest}`}])
  assert.deepEqual(writes.splice(0), [{kind: 'procedure-run', procedure: DIFF.procedure, expect_digest: DIFF.digest}])
  await assert.rejects(() => withDiff.write([{key: 'procRun', value: `${DIFF.procedure}@not-the-digest`}]), /digest/)
  // Export: the agent's first set until another is chosen, the target, the absolute directory.
  holds.holdView(ai.AIKIT_ID, 'outDir', '/tmp/packages')
  const exporting = ai.aikitInstrumentBinding(input({}, writes))
  assert.equal(exporting.standing.exported, undefined)
  await exporting.write([{key: 'exported', value: 'claude'}])
  assert.deepEqual(writes.splice(0), [{kind: 'set-package-export', project: 'O-I', set: 'central:core-development', target: 'claude', out: '/tmp/packages'}])
  await assert.rejects(() => exporting.write([{key: 'agents', value: '[]'}]), /is a reading/)
  holds.resetHolds()
})

test('with nothing selected, or the pages not drawn, every reading stands with why — never a sample, never "reading" for ever', () => {
  holds.resetHolds()
  const none = ai.aikitInstrumentBinding(input({run: null, agent: null, rack: null, asked: false, context: undefined, setList: undefined, upkeep: {}}))
  for (const key of ['run', 'agents', 'ctx.pressure', 'ctx.armed', 'ctx.turn', 'sets', 'unused', 'sources', 'roots', 'procedures', 'bypasses', 'unsupported']) {
    assert.ok(none.standing[key]?.disabled, `${key}: why it is absent`)
    assert.equal(none.values[key], undefined, `${key}: no value`)
  }
  assert.equal(none.standing.run.disabled, ai.AIKIT_ABSENT.run)
  assert.equal(none.standing.sources.disabled, ai.AIKIT_ABSENT.notAsked)
  assert.match(none.standing.sync.disabled, /kernel carrier is unavailable/)
  const group = ai.aikitInstrumentBinding(input({run: {name: 'A group', group: true}, agent: null, rack: null}))
  assert.equal(group.standing.agents.disabled, ai.AIKIT_ABSENT.group)
  assert.equal(group.values.run, 'A group')
})
