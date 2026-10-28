// Lane W8, Runs' Journey: the Journey view on Runs (software-factory:attempt-review `journey`, D3) read from Factory's own developmental
// readings — the shown Run's reading names its Journey (owningJourneyRefs), the Journey's reading its purpose, status, Runs, Returns and
// Recognitions — through the kernel's factory_development_read (desktop/cradle/kernel/src/factory.rs), which exists.
//
// Channels:
// - REAL (read-only, 21 Oct): `factory development journey|run <Central/.factory/development-state.json> <ref> --json`
//   (tests/fixtures/factory-journey-2026-10-21.json).
// - FAKE: a kernel transport (a bridge whose fetch answers factory_development_read with the REAL readings, and a continued Run with a
//   recognised Return in the journey reading's own shape — the real state holds one Run per Journey and no Return yet).
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
const tasks = await import('../src/agent/devices/taskBindings.ts')
// Runs' design (software-factory__attempt-review.tsx) was retired in the 22 Oct manual rewrite (#725; §16.1 "The course of a run is its track
// in Arrangement view; its attempts are takes"); the Journey a Run belongs to is drawn by the Run map (§19.25 "Commission, Journey and
// Recognition"), whose design reads the same `journey` shape. Runs' binding stays and is checked on its own values.
const {design: runMapDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__run-map.tsx')
const runMap = await import('../src/agent/devices/runMapBinding.ts')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const REAL = JSON.parse(readFileSync(new URL('./fixtures/factory-journey-2026-10-21.json', import.meta.url), 'utf8'))
const RUN = REAL.run.runRef, JOURNEY = REAL.journey.journeyRef, STATE = REAL.statePath
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const hosted = (designed, binding) => host.viewsOf(designed).map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])

/** A fake kernel answering factory_development_read from `readings` (by `read:subject`), refusing in Factory's words otherwise. */
let port = 0
function fakeKernel(readings) {
  const asked = []
  const was = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const op = JSON.parse(init.body)
    asked.push(op)
    const answer = op.op === 'factory_development_read' ? readings[`${op.read}:${op.subject}`] : undefined
    return {json: async () => (answer === undefined
      ? {ok: false, error: JSON.stringify({kind: 'owner-refused-or-failed', message: `factory: Factory developmental provider error: NotFound("${op.subject}")`, operation_may_have_run: false})}
      : {ok: true, outcome: {result: 'factory_development_reading', data: answer, receipts: []}})}
  }
  return {transport: {kind: 'bridge', url: `http://fake-factory-${++port}.test`}, asked, restore: () => { globalThis.fetch = was }}
}

test('the chain reads the shown Run, its owning Journey and the Journey\'s Runs (REAL): the Commission\'s purpose, the status, each Run\'s lifecycle', async () => {
  const kernel = fakeKernel({[`run:${RUN}`]: REAL.run, [`journey:${JOURNEY}`]: REAL.journey})
  try {
    const chain = await journeys.readRunJourney(kernel.transport, STATE, RUN)
    assert.deepEqual(kernel.asked.map(op => [op.op, op.state_path, op.read, op.subject]), [['factory_development_read', STATE, 'run', RUN], ['factory_development_read', STATE, 'journey', JOURNEY]],
      'the Run once, its Journey once; the shown Run is not read twice')
    const journey = journeys.journeyOf(chain)
    assert.deepEqual(journey, {purpose: REAL.journey.commission.purpose, status: 'active', runs: [{ref: RUN, lifecycle: 'seeded'}]})
    assert.equal(journey.runs[0].recognised, undefined, 'a Run with no Return says nothing of Recognition')
    assert.equal(journey.runs[0].name, undefined, 'a run reading carries no name: none is given')
  } finally { kernel.restore() }
})

test('a continued Run and a recognised Return (FAKE, the journey reading\'s own shape): the Runs in Factory\'s order, recognised where a Recognition names one, a refused Run kept as its ref', async () => {
  const NEXT = 'run:01M4BK6JT0NEXT0000000000000', GONE = 'run:01M4BK6JT0GONE0000000000000'
  const journey = {...REAL.journey, runRefs: [RUN, NEXT, GONE],
    returns: [{return_ref: 'return:first', run_refs: [RUN], basis_refs: [], evidence_refs: [], summary: 'first pass'}, {return_ref: 'return:next', run_refs: [NEXT], basis_refs: [], evidence_refs: [], recognition_ref: 'recognition:next', summary: 'second pass'}],
    recognitions: [{recognition_ref: 'recognition:first', subject_ref: 'return:first', basis_refs: []}]}
  const next = {...REAL.run, runRef: NEXT, lifecycle: 'active', nativeAttempts: {attempts: [{}, {}]}}
  const kernel = fakeKernel({[`run:${RUN}`]: REAL.run, [`journey:${JOURNEY}`]: journey, [`run:${NEXT}`]: next})
  try {
    const chain = await journeys.readRunJourney(kernel.transport, STATE, RUN)
    assert.match(chain.runs[GONE].error, /NotFound/, 'Factory\'s refusal, in its words')
    assert.deepEqual(journeys.journeyOf(chain).runs, [{ref: RUN, lifecycle: 'seeded', recognised: true}, {ref: NEXT, lifecycle: 'active', attempts: 2, recognised: true}, {ref: GONE}])
    const unrecognised = journeys.journeyOf({...chain, journey: {...journey, recognitions: [], returns: [journey.returns[0]]}})
    assert.equal(unrecognised.runs[0].recognised, false, 'a Run with a Return no Recognition names')
    assert.equal(journeys.journeyOf({...chain, journey: {contract: 'something else'}}), null)
  } finally { kernel.restore() }
  const none = fakeKernel({[`run:${RUN}`]: {...REAL.run, owningJourneyRefs: []}})
  try {
    const chain = await journeys.readRunJourney(none.transport, STATE, RUN)
    assert.equal(chain.journey, null)
    assert.equal(none.asked.length, 1, 'no Journey named: none asked')
  } finally { none.restore() }
  const refused = fakeKernel({})
  try { await assert.rejects(() => journeys.readRunJourney(refused.transport, STATE, RUN), /NotFound/) } finally { refused.restore() }
})

const TAKE = {sessionRef: 's', attemptRef: 'attempt:1', runRef: RUN, statePath: STATE, taskRef: 'task:1', unit: 'self', state: 'returned', startUnixMs: 1, endUnixMs: 60_001, summary: 'done', receivingRef: null}

test('Runs draws the Journey of the Run it shows (the Journey view); unread, refused or none, the Journey stands absent saying why', () => {
  bind.resetHolds()
  const chain = {run: REAL.run, journey: REAL.journey, runs: {[RUN]: {value: REAL.run}}}
  const binding = tasks.runsBinding('s', bind.chainHolds(), {takes: [TAKE], choose: async () => ({}), journey: {status: 'answered', value: chain, error: null}})
  assert.deepEqual(JSON.parse(binding.values.journey), {purpose: REAL.journey.commission.purpose, status: 'active', runs: [{ref: RUN, lifecycle: 'seeded'}]})
  assert.equal(binding.standing.journey, undefined)
  const reading = tasks.runsBinding('s', bind.chainHolds(), {takes: [TAKE], choose: async () => ({}), journey: {status: 'reading', value: null, error: null}})
  assert.equal(reading.standing.journey.disabled, tasks.RUNS_JOURNEY_READING)
  const refused = tasks.runsBinding('s', bind.chainHolds(), {takes: [TAKE], choose: async () => ({}), journey: {status: 'refused', value: null, error: 'factory: NotFound'}})
  assert.equal(refused.standing.journey.disabled, 'factory: NotFound')
  const none = tasks.runsBinding('s', bind.chainHolds(), {takes: [TAKE], choose: async () => ({}), journey: {status: 'answered', value: {run: REAL.run, journey: null, runs: {}}, error: null}})
  assert.equal(none.standing.journey.disabled, tasks.RUNS_JOURNEY_NONE)
  assert.equal(tasks.runsBinding(null, bind.chainHolds()).standing.journey.disabled, tasks.RUNS_JOURNEY_UNREAD)
  // REPLACED (#725): drawn on Runs' Journey view — Runs was retired (§16.1); the Run map draws the Journey a Run belongs to (§19.25), so the
  // same reading (the Commission's purpose, the status, each Run's lifecycle) is drawn there, on the real Commission, never its sample. The
  // chain does not hand the Run map this reading yet (runMapBinding.ts holds `journey` absent): the drawing is of Runs' own reading, laid on
  // the Run map's binding.
  const own = runMap.runMapBinding(bind.chainHolds())
  const standing = {...own.standing}
  delete standing.journey
  const journeyed = {...own, values: {...own.values, journey: tasks.runsBinding('s', bind.chainHolds(), {takes: [TAKE], choose: async () => ({}), journey: {status: 'answered', value: chain, error: null}}).values.journey}, standing}
  const drawn = hosted(runMapDesign, journeyed)
  for (const [view, markup] of drawn) {
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${view}: its own view drew`)
  }
  assert.ok(drawn.map(([, markup]) => markup).join('\n').includes('Integrate the authored Agent self'), 'the real Commission\'s purpose is drawn')
  bind.resetHolds()
})

test('the chain hands Runs the Journey of the Run it shows, read from the take\'s state and ref', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /const runJourney = useRunJourney\(transport, shownState, shownRun\)/)
  // REPLACED (lane W12): Runs is handed its Outputs too (each attempt's world receipt, what was collected, Collect).
  assert.match(view, /\{takes: shownTakes, choose: runTakes\.choose, \.\.\.\(shownRun \? \{journey: runJourney\} : \{\}\),/)
  assert.match(read('agent/devices/runJourney.ts'), /op: 'factory_development_read', state_path: statePath, read, subject/)
})
