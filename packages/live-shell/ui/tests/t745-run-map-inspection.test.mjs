// O-I #745, the Run map's units (manual §19.25; software-factory__run-map.tsx `nodes` rows' `leg` and `waits`): each unit's attempt and
// each barrier's units still out, read from Factory's workflow inspection (`factory workflow inspect <state> <run-ref> --json`,
// factory.workflow-inspection/v1) through the kernel's factory_owner `workflow-inspect` (desktop/cradle/kernel/src/factory.rs), which
// exists. Before this the Run map read the run and its Journey only, so no unit ever stood failed or quiet and Retry could not be pressed.
//
// Channels:
// - REAL (read-only, 12 Nov): `factory development run` and `factory workflow inspect` of one Run in a scratch project
//   (tests/fixtures/factory-workflow-inspection-2026-11-12.json): six units, none started, no barrier.
// - FAKE: a kernel transport (a bridge whose fetch answers the two ops), and, in the inspection's own shape, a failed leg with two
//   attempts, a barrier still waiting, and a second page.
// - SCRIPTED: the catalogue design rendered through the runtime's host to static markup.
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
const host = await import('../src/frame/devices/deviceHost.tsx')
const bind = await import('../src/agent/devices/designBindings.ts')
const journeys = await import('../src/agent/devices/runJourney.ts')
const {design: runMapDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__run-map.tsx')
const runMap = await import('../src/agent/devices/runMapBinding.ts')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const REAL = JSON.parse(readFileSync(new URL('./fixtures/factory-workflow-inspection-2026-11-12.json', import.meta.url), 'utf8'))
const RUN = REAL.run.runRef, STATE = REAL.statePath
const NODES = Object.values(REAL.run.runMap.nodes)
const WORK = NODES.filter(node => node.kind === 'work')
const hosted = (designed, binding) => host.viewsOf(designed).map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
const answered = value => ({status: 'answered', value, error: null})

/** A fake kernel: factory_development_read answers from `readings` (by `read:subject`), factory_owner workflow-inspect from `pages` (one
 * per ask, in order), or refuses in Factory's words. */
let port = 0
function fakeKernel(readings, pages) {
  const asked = []
  const was = globalThis.fetch
  let page = 0
  globalThis.fetch = async (url, init) => {
    const op = JSON.parse(init.body)
    asked.push(op)
    const answer = op.op === 'factory_development_read' ? readings[`${op.read}:${op.subject}`]
      : op.op === 'factory_owner' && op.request.kind === 'workflow-inspect' && Array.isArray(pages) ? pages[page++] : undefined
    return {json: async () => (answer === undefined
      ? {ok: false, error: JSON.stringify({kind: 'owner-refused-or-failed', message: 'factory: Run has no native attempt field; attach its admitted source first', operation_may_have_run: false})}
      : {ok: true, outcome: {result: 'factory_development_reading', data: answer, receipts: []}})}
  }
  return {transport: {kind: 'bridge', url: `http://fake-inspect-${++port}.test`}, asked, restore: () => { globalThis.fetch = was }}
}
const alone = {...REAL.run, owningJourneyRefs: []}

test('the chain asks Factory\'s workflow inspection for the shown Run (REAL): every unit\'s leg by its unit, none started, no barrier', async () => {
  const kernel = fakeKernel({[`run:${RUN}`]: alone}, [REAL.inspection])
  try {
    const chain = await journeys.readRunJourney(kernel.transport, STATE, RUN)
    const inspect = kernel.asked.filter(op => op.op === 'factory_owner')
    assert.deepEqual(inspect.map(op => op.request), [{kind: 'workflow-inspect', state_path: STATE, run_ref: RUN, limit: 100}], 'one page: Factory named no next')
    assert.equal(chain.inspection.error, undefined)
    assert.deepEqual(Object.keys(chain.inspection.value.legs).sort(), WORK.map(node => node.semanticRef).sort(), 'a leg for each unit of the map')
    for (const leg of Object.values(chain.inspection.value.legs)) assert.deepEqual(leg, {attempts: 0}, 'not started: no status, no attempt')
    assert.deepEqual(chain.inspection.value.barriers, [])
    const drawn = runMap.runMapBinding(bind.chainHolds(), {statePath: STATE, runRef: RUN, units: {}}, {owner: async () => ({status: 'retried'})}, answered(chain))
    const nodes = JSON.parse(drawn.values.nodes)
    for (const node of nodes.filter(node => node.kind === 'work')) assert.deepEqual(node.leg, {attempts: 0}, `${node.id} carries its leg`)
    assert.equal(nodes.find(node => node.kind === 'destination').leg, undefined, 'only a unit has a leg')
    assert.equal(drawn.standing.retry, undefined, 'the legs are read: Retry stands as the design draws it for the unit you choose')
  } finally { kernel.restore() }
})

test('a failed unit, a barrier still waiting and a second page (FAKE, the inspection\'s own shape): the leg\'s status and attempts, the units still out by their labels', async () => {
  const [first, second, third] = WORK
  const cursor = {revision: 7, runRef: RUN, unit: null, attempt: null, offset: 100}
  const attempt = unit => ({attemptRef: `attempt:${unit}`, workflowUnitRef: unit, currentAttempt: true, status: 'failed'})
  const pages = [
    {contract: 'factory.workflow-inspection/v1', runRef: RUN,
      legs: {[first.semanticRef]: {status: 'failed', standing: 'native-leg'}, [second.semanticRef]: {status: 'returned', standing: 'native-leg'}},
      barriers: [{key: 'roots', waitsFor: [first.semanticRef, second.semanticRef], notReturned: [first.semanticRef], complete: false}],
      attempts: [attempt(first.semanticRef), attempt(first.semanticRef), attempt(second.semanticRef)], nextCursor: cursor},
    {contract: 'factory.workflow-inspection/v1', runRef: RUN,
      legs: {[third.semanticRef]: {status: null, standing: 'not-started'}}, barriers: [], attempts: [], nextCursor: null},
  ]
  const run = {...alone, runMap: {...REAL.run.runMap, nodes: {...REAL.run.runMap.nodes, 'barrier-roots': {id: 'barrier-roots', kind: 'gate', label: 'All roots', state: 'waiting', semanticRef: null}}}}
  const kernel = fakeKernel({[`run:${RUN}`]: run}, pages)
  try {
    const chain = await journeys.readRunJourney(kernel.transport, STATE, RUN)
    const inspect = kernel.asked.filter(op => op.op === 'factory_owner').map(op => op.request)
    assert.equal(inspect.length, 2, 'the next page is asked while Factory names one')
    assert.deepEqual(inspect[1].cursor, cursor, 'with Factory\'s own cursor, as it gave it')
    assert.deepEqual(chain.inspection.value.legs, {[first.semanticRef]: {status: 'failed', attempts: 2}, [second.semanticRef]: {status: 'returned', attempts: 1}, [third.semanticRef]: {attempts: 0}})
    bind.resetHolds()
    bind.holdView(runMap.RUN_MAP_ID, 'unit', first.id)
    const sent = []
    const drawn = runMap.runMapBinding(bind.chainHolds(), {statePath: STATE, runRef: RUN, units: {[first.id]: first.semanticRef}},
      {owner: async request => { sent.push(request); return {status: 'retried'} }}, answered(chain))
    const nodes = JSON.parse(drawn.values.nodes)
    assert.deepEqual(nodes.find(node => node.id === first.id).leg, {status: 'failed', attempts: 2})
    assert.deepEqual(nodes.find(node => node.id === 'barrier-roots').waits, [first.label], 'the barrier names the unit still out as the map labels it')
    assert.equal(nodes.find(node => node.id === first.id).custody, undefined, 'the inspection names no custody: none is given')
    assert.equal(drawn.standing.retry, undefined)
    const markup = hosted(runMapDesign, drawn).map(([, html]) => html).join('\n')
    assert.match(markup, /<dt>Attempt<\/dt><dd>failed<\/dd>/, 'the chosen unit\'s attempt is drawn')
    assert.doesNotMatch(markup, /The unit has not failed or gone quiet/, 'a failed unit\'s Retry is not refused for want of a leg')
    assert.doesNotMatch(markup, /\bNaN\b|undefined|data-device-fault/)
    await drawn.write([{key: 'retry', value: first.id}])
    assert.deepEqual(sent, [{kind: 'attempt-retry', state_path: STATE, run_ref: RUN, workflow_unit_ref: first.semanticRef}], 'Retry asks Factory for that unit')
  } finally { kernel.restore(); bind.resetHolds() }
})

test('an inspection Factory refuses leaves the map drawn without legs, and Retry says why in Factory\'s words', async () => {
  const kernel = fakeKernel({[`run:${RUN}`]: alone}, null)
  try {
    const chain = await journeys.readRunJourney(kernel.transport, STATE, RUN)
    assert.equal(chain.inspection.value, undefined)
    assert.match(chain.inspection.error, /Run has no native attempt field/)
    const drawn = runMap.runMapBinding(bind.chainHolds(), {statePath: STATE, runRef: RUN, units: {}}, {owner: async () => ({status: 'retried'})}, answered(chain))
    const nodes = JSON.parse(drawn.values.nodes)
    assert.equal(nodes.length, NODES.length, 'the run reading\'s map is still drawn')
    assert.ok(nodes.every(node => node.leg === undefined && node.waits === undefined), 'no leg is invented')
    assert.match(drawn.standing.retry.disabled, /Run has no native attempt field/, 'Retry is disabled with Factory\'s refusal, not "has not failed"')
    await assert.rejects(drawn.write([{key: 'retry', value: WORK[0].id}]), /Run has no native attempt field/)
  } finally { kernel.restore() }
})

test('a reading that is not Factory\'s inspection is refused by name, and an unread inspection says the Run map has none', async () => {
  const kernel = fakeKernel({[`run:${RUN}`]: alone}, [{contract: 'factory.wrong/v1'}])
  try {
    const chain = await journeys.readRunJourney(kernel.transport, STATE, RUN)
    assert.match(chain.inspection.error, /factory\.workflow-inspection\/v1/)
  } finally { kernel.restore() }
  const bare = runMap.runMapBinding(bind.chainHolds(), {statePath: STATE, runRef: RUN, units: {}}, {owner: async () => ({status: 'retried'})}, answered({run: alone, journey: null, runs: {}}))
  assert.equal(bare.standing.retry.disabled, runMap.NO_INSPECT)
})
