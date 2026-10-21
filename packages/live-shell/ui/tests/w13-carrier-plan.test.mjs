// Lane W13, the Remote carrier's Plan and Plan again on Workcell's run record (the kernel's workcell_read {run-show}, be90d694b;
// EpiLogos/Workcell PR 121): the run is the one the chosen world's receipt names (W12); where its demand is kept, the plan is Workcell's
// own for it (`workcell plan --demand-json <path>`), drawn as Workcell answered; not kept, a mismatch or unreadable, Workcell's standing is
// said and no demand is reconstructed; with no run, the reason stands.
//
// Channels:
// - REAL (read-only, 21 Oct): `workcell --json run show --run SLUG` from Workcell PR 121 over a scratch state root — a kept demand, a run
//   recorded before bodies were kept, the installed workcell's answer with no `demand`, and the refusal of an unknown slug
//   (workcell-run-show-2026-10-21.json); `workcell plan --json` (workcell-material-2026-10-21.json).
// - FAKE: the plan's answer for the kept demand is the REAL plan reading; a mismatch and an unreadable standing in run show's own shape.
// - SCRIPTED: the carrier's design rendered through the runtime's host to static markup.
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
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
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
const cell = await import('../src/agent/devices/workcellBindings.ts')
const material = await import('../src/agent/devices/workcellMaterial.ts')
const routes = await import('../src/agent/devices/ownerRoutes.ts')
const {design: carrierDesign} = await import('../src/inhabitants/catalogue/panels/workcell__remote-carrier.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const ROUTES = '../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/'
const SHOW = json(`${ROUTES}workcell-run-show-2026-10-21.json`)
const WORLDS = json(`${ROUTES}workcell-worlds-2026-10-21.json`)
const MATERIAL = json(`${ROUTES}workcell-material-2026-10-21.json`)
const REAL = json('./fixtures/workcell-readings-2026-10-21.json')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const answered = value => ({status: 'answered', value, error: null})
const refused = error => ({status: 'refused', value: null, error})
// The run the Plan reads is the chosen world's ledger slug (Workcell PR 122: `workcell worlds` runs), never the receipt's opaque subject.
const RUN = 'dlw-capture'
const carrier = (run, ports = {}) => cell.carrierBinding(answered(REAL.workcellStatus), bind.chainHolds(), undefined, {run}, ports)

test('1 · a run\'s demand as `workcell run show` answers it (REAL): kept with its path; not kept with Workcell\'s detail; the installed workcell\'s answer carries none', () => {
  assert.deepEqual(cell.runDemandOf(SHOW.kept), {path: SHOW.kept.demand.path, standing: 'kept'})
  assert.deepEqual(cell.runDemandOf(SHOW.not_kept), {path: SHOW.not_kept.demand.path, standing: 'not-kept', detail: SHOW.not_kept.demand.detail})
  assert.equal(cell.runDemandOf(SHOW.installed_show), null, 'the installed workcell answers run show without demand')
})

test('2 · a kept demand: the plan is Workcell\'s own for it, drawn as Workcell answered (REAL plan reading); Plan again asks it again', async () => {
  bind.resetHolds()
  const asked = []
  const binding = carrier({ref: RUN, show: answered(SHOW.kept), plan: answered(MATERIAL.plan)}, {replan: () => asked.push(true)})
  assert.deepEqual(JSON.parse(binding.values.plan), material.planOf(MATERIAL.plan))
  assert.equal(binding.standing.plan, undefined)
  assert.equal(binding.standing.replan, undefined)
  await binding.write([{key: 'replan', value: true}])
  assert.deepEqual(asked, [true])
  const unsatisfiable = carrier({ref: RUN, show: answered(SHOW.kept), plan: answered(MATERIAL.plan_unsatisfiable.stdout)})
  assert.equal(JSON.parse(unsatisfiable.values.plan).status, 'unsatisfiable', 'an unsatisfiable plan is Workcell\'s reading too')
  const workcellSays = 'invalid demand: --demand-json cannot be combined with other demand flags'
  assert.equal(carrier({ref: RUN, show: answered(SHOW.kept), plan: refused(workcellSays)}).standing.plan.disabled, workcellSays)
})

test('3 · not kept, a mismatch or unreadable: Workcell\'s standing in its words, no plan asked and no demand reconstructed', async () => {
  const notKept = carrier({ref: RUN, show: answered(SHOW.not_kept)}, {replan: () => { throw new Error('never asked') }})
  assert.equal(notKept.values.plan, undefined)
  assert.equal(notKept.standing.plan.disabled, `The run's plan: Workcell keeps the run's demand as not-kept (${SHOW.not_kept.demand.detail}); no plan is asked, and no demand is reconstructed.`)
  await assert.rejects(notKept.write([{key: 'replan', value: true}]), /Plan again: The run's plan: Workcell keeps the run's demand as not-kept/)
  for (const standing of ['mismatch', 'unreadable']) {
    const show = {...SHOW.kept, demand: {path: SHOW.kept.demand.path, digest: SHOW.kept.demand.digest, standing}}
    assert.match(carrier({ref: RUN, show: answered(show)}).standing.plan.disabled, new RegExp(`keeps the run's demand as ${standing}; no plan is asked, and no demand is reconstructed`))
  }
})

test('4 · no run: the reason stands; Workcell\'s refusal of the run (an unknown slug; the installed answer with no demand) is drawn in its words', () => {
  // REPLACED (lane W14): the run is the chosen world's ledger slug; with no world chosen, the reason names that.
  assert.match(carrier({ref: null}).standing.plan.disabled, /the chosen world's run \(`workcell worlds` runs\), read with `workcell run show` — no world is chosen here/)
  const notFound = routes.refusalWords(SHOW.not_found.stderr.trim())
  assert.match(notFound, /run `nosuch` is not in this ledger/)
  assert.equal(carrier({ref: 'nosuch', show: refused(notFound)}).standing.plan.disabled, notFound)
  assert.equal(carrier({ref: RUN, show: answered(SHOW.installed_show)}).standing.plan.disabled, '`workcell run show` answered no demand.')
  assert.match(carrier({ref: RUN, show: {status: 'reading', value: null, error: null}}).standing.plan.disabled, /has not answered `workcell run show --run dlw-capture` yet/)
})

test('5 · the chain reads run show for the chosen world\'s run, and plans only a kept demand, from its path alone', () => {
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /const carrierWorld = chosenWorld\(carrierWorlds, typeof machineRef === 'string' \? machineRef : null, viewHolds\(holds, WORKCELL_RACK_ID\)\.worldReceipt\)\.chosen/)
  // REPLACED (lane W14): the run is planRunOf over the world's ledger slugs, never its subjects.
  assert.match(chain, /const planRun = planRunOf\(carrierWorld, runLedger, viewHolds\(holds, CARRIER_ID\)\.planRun\)/)
  assert.doesNotMatch(chain, /subjects\.factory_run \?\? carrierWorld\.subjects\.run/, 'the receipt\'s opaque subject is never read as the slug')
  assert.match(chain, /useWorkcellRead\(transport, carrierRun \? \{kind: 'run-show', run: carrierRun\} : null\)/)
  assert.match(chain, /const keptPath = keptDemand\?\.standing === 'kept' \? keptDemand\.path \?\? null : null/)
  assert.match(chain, /useWorkcellRead\(transport, keptPath \? \{kind: 'plan', demand: \{demand_json: keptPath\}\} : null\)/)
})

test('6 · the carrier draws the plan in all its views — no NaN, no undefined, never its fixture text', () => {
  bind.resetHolds()
  host.resetHost()
  const binding = carrier({ref: RUN, show: answered(SHOW.kept), plan: answered(MATERIAL.plan_unsatisfiable.stdout)}, {replan: () => {}})
  for (const view of host.viewsOf(carrierDesign)) {
    const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: carrierDesign, binding, view, nav: {}}))
    assert.match(markup, new RegExp(`data-device-view="${view}"`), `${view} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${view}: its own view drew`)
    assert.doesNotMatch(markup, /ready-to-carry|private-tailnet|1791417468786/, `${view}: its fixture never stands in`)
  }
  bind.resetHolds()
})

test('7 · the carrier\'s run is the chosen world\'s ledger slug (REAL, Workcell PR 122): one is that run; several wait for the hand; none says outside a run or recorded elsewhere; null says the ledger\'s error verbatim', () => {
  const listing = material.worldsOf(WORLDS.answer)
  const world = listing.worlds[0]
  assert.deepEqual(world.runs, ['dlw-capture'], 'the REAL capture names its run\'s slug')
  assert.equal(world.subjects.run, 'opaque:factory-run-capture', 'while the receipt\'s subject stays opaque')
  assert.deepEqual(listing.runLedger, {read: true})
  // One: that slug.
  assert.deepEqual(cell.planRunOf(world, listing.runLedger, undefined), {ref: 'dlw-capture'})
  // Several (the REAL world with a second slug): the hand chooses, none assumed.
  const several = {...world, runs: ['dlw-capture', 'dlw-capture-2']}
  const waiting = cell.planRunOf(several, listing.runLedger, undefined)
  assert.equal(waiting.ref, null)
  assert.equal(waiting.why, `The run's plan: 2 runs name ${world.worldRef} (dlw-capture, dlw-capture-2): choose one; none is assumed.`)
  assert.deepEqual(cell.planRunOf(several, listing.runLedger, 'dlw-capture-2'), {ref: 'dlw-capture-2'})
  assert.equal(cell.planRunOf(several, listing.runLedger, 'not-a-run').ref, null, 'a choice not named is no choice')
  // None: the world was prepared outside a run, or its run is recorded elsewhere.
  const none = material.worldsOf({...WORLDS.answer, worlds: [{...WORLDS.answer.worlds[0], runs: []}]})
  assert.match(cell.planRunOf(none.worlds[0], none.runLedger, undefined).why, /no run in this cell's ledger names world:566bd9371b0f4376 — the world was prepared outside a run, or its run is recorded elsewhere/)
  // Null: Workcell's run-ledger error, verbatim.
  const ledgerSays = 'run ledger unreadable: permission denied (os error 13)'
  const unread = material.worldsOf({...WORLDS.answer, run_ledger: {read: false, error: ledgerSays}, worlds: [{...WORLDS.answer.worlds[0], runs: null}]})
  assert.deepEqual(unread.runLedger, {read: false, error: ledgerSays})
  assert.deepEqual(cell.planRunOf(unread.worlds[0], unread.runLedger, undefined), {ref: null, why: ledgerSays})
  // An older listing names no runs: said so, never filled from the subjects.
  const older = material.worldsOf({...WORLDS.answer, worlds: [Object.fromEntries(Object.entries(WORLDS.answer.worlds[0]).filter(([key]) => key !== 'runs'))]})
  assert.match(cell.planRunOf(older.worlds[0], older.runLedger, undefined).why, /names no runs for world:566bd9371b0f4376/)
  // Each reason stands on the carrier's Plan and Plan again.
  for (const why of [waiting.why, ledgerSays]) {
    const binding = carrier({ref: null, why})
    assert.equal(binding.standing.plan.disabled, why)
    assert.equal(binding.standing.replan.disabled, `Plan again: ${why}`)
  }
  bind.resetHolds()
  assert.ok(carrier({ref: null}).local.planRun, 'the hand holds the chosen run')
})
