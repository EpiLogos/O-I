// Lane W12, on Workcell's world receipts (the kernel's workcell_read {worlds}, 1651990c0; EpiLogos/Workcell PR 120): the workcell rack's
// World, Exposure and Release pages and its last reconcile on the receipt listed for the machine's cell — none listed is no world, one is
// that world, several wait for the hand's choice and none is assumed — read with the kernel's material_read and written (recover, release,
// reconcile) as the person's press; Runs' Outputs on the receipt whose world_ref is the attempt's materialWorldRef; the Remote carrier's Plan
// still refused, naming the demand body it waits for.
//
// Channels:
// - REAL (read-only, 21 Oct): `workcell --json worlds` from Workcell PR 120 over a scratch state root, its empty answer, and the installed
//   workcell's refusal of the unknown command (desktop/cradle/kernel/tests/fixtures/owner-routes/workcell-worlds-2026-10-21.json).
// - FAKE, in the owner's own shape: a material reading of that receipt (workcell.material-reading/v1, as the kernel's native_owner_reading
//   carries it: kernel/src/material.rs Reading), a reconcile answer's deltas, a collect answer, a Factory attempt record naming its world.
//   Every Workcell write goes to a recording port; none runs on the machine.
// - SCRIPTED: the catalogue designs rendered through the runtime's host to static markup.
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
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const cell = await import('../src/agent/devices/workcellBindings.ts')
const rack = await import('../src/agent/devices/workcellRackBinding.ts')
const material = await import('../src/agent/devices/workcellMaterial.ts')
const tasks = await import('../src/agent/devices/taskBindings.ts')
const routes = await import('../src/agent/devices/ownerRoutes.ts')
const takes = await import('../src/agent/factoryTakes.ts')
const {design: rackDesign} = await import('../src/inhabitants/catalogue/panels/workcell__workcell.tsx')
const {design: runsDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__attempt-review.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const WORLDS = json('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/workcell-worlds-2026-10-21.json')
const REAL = json('./fixtures/workcell-readings-2026-10-21.json')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const answered = value => ({status: 'answered', value, error: null})
const refused = error => ({status: 'refused', value: null, error})
const LISTED = WORLDS.answer.worlds[0]
const CELL = LISTED.workcell_ref
/** A material reading of the listed receipt, in the kernel's own shape (material.rs Reading; FAKE: no world is prepared on this machine). */
const MATERIAL = {contract: 'workcell.material-reading/v1', backend: 'workcell', consistency: 'sequential-not-atomic',
  receipt_world: {version: 'workcell.material-world/v1', world_ref: LISTED.world_ref, workcell_ref: CELL, demand_ref: LISTED.demand_ref, retention: 'release', persistence: null, state: 'healthy',
    binding_graph: {bindings: [{logical_ref: 'workspace:checkout', port: 'workspace', provider_ref: 'provider:collapsed-local-git-worktree', necessity: 'required', health: 'healthy', presence: 'present'}]}},
  observation: {status: 'supplied', completed_at_unix_ms: 1_792_600_000_000, reading: {world_ref: LISTED.world_ref, observations: [{logical_ref: 'workspace:checkout', state: 'present'}]}},
  exposure: {status: 'supplied', completed_at_unix_ms: 1_792_600_000_000, reading: {world_ref: LISTED.world_ref, surfaces: [{logical_ref: 'surface:preview', interaction: 'http', material: {endpoint: 'http://127.0.0.1:4173'}, provenance: {}}],
    omissions: [{requirement: 'expose:logs', necessity: 'optional', reason: 'no provider exposes logs'}], degradations: []}},
  bodies: [{logical_ref: 'surface:preview', interaction: 'http', material: {endpoint: 'http://127.0.0.1:4173'}, provenance: {}}]}
const GATEWAY = bind.gatewayValues({reading: {...model.INITIAL_READING, gatewayAdmitted: true, gateway: {kind: 'reading', title: 'Gateway', line: 'answered', receipt: null},
  gatewayDoc: {state: 'ready', transport: 'stdio', approvals: 'session', stall_after_seconds: 300}}, harness: {binding: 'claude-code', resolved: true}})
/** The rack on this machine's carrier reading, with its cell's Workcell ref as the listing's (FAKE: the capture's scratch cell). */
const rackInput = (over = {}, here = CELL) => ({name: 'env-1', project: 'O-I', seats: REAL.seatStatus, chain: {gateway: GATEWAY, carrier: {here}, git: null}, holds: bind.chainHolds(),
  worlds: answered(WORLDS.answer), material: answered(MATERIAL), ...over})
function recorder() {
  const calls = []
  return {calls, port: async request => { calls.push(request); return {} }}
}

test('1 · Workcell\'s world receipts (REAL): each with its cell, its demand and its subjects; the unreadable receipt and the note kept', () => {
  const listing = material.worldsOf(WORLDS.answer)
  assert.deepEqual(listing.worlds, [{receipt: LISTED.receipt, worldRef: LISTED.world_ref, workcellRef: CELL, demandRef: 'demand:dlw-capture', state: 'healthy', retention: 'release',
    subjects: {run: 'opaque:factory-run-capture'}}])
  assert.equal(listing.unreadable.length, 1)
  assert.match(listing.note, /a receipt written elsewhere with --receipt is not listed/)
  assert.deepEqual(material.worldsOf(WORLDS.empty).worlds, [])
  assert.equal(material.worldsOf({schema: 'other'}), null)
  assert.match(routes.refusalWords(WORLDS.installed_refusal.stderr.trim()), /unknown command `worlds`/, 'the installed workcell\'s refusal, in its words')
})

test('2 · the rack\'s world is the receipt listed for its cell: none listed is no world, one is that world, several wait for the hand and none is assumed', () => {
  assert.deepEqual(rack.chosenWorld(answered(WORLDS.answer), 'workcell:mac', undefined), {listed: [], chosen: null, none: true, why: null}, 'this machine\'s cell lists none')
  assert.equal(rack.chosenWorld(answered(WORLDS.answer), CELL, undefined).chosen.receipt, LISTED.receipt)
  const two = {...WORLDS.answer, worlds: [LISTED, {...LISTED, receipt: '/r/world-2.json', world_ref: 'world:2'}]}
  const several = rack.chosenWorld(answered(two), CELL, undefined)
  assert.equal(several.chosen, null)
  assert.match(several.why, /2 worlds are listed for workcell:scratch-capture: choose one; none is assumed/)
  assert.equal(rack.chosenWorld(answered(two), CELL, '/r/world-2.json').chosen.worldRef, 'world:2')
  assert.equal(rack.chosenWorld(answered(two), CELL, '/r/not-listed.json').chosen, null, 'a choice not listed is no choice')
  const installed = routes.refusalWords(WORLDS.installed_refusal.stderr.trim())
  assert.equal(rack.chosenWorld(refused(installed), CELL, undefined).why, installed)
  assert.match(rack.chosenWorld(answered(WORLDS.answer), null, undefined).why, /Workcell ref is not read/)
  bind.resetHolds()
  const none = rack.workcellRackBinding(rackInput({}, 'workcell:mac'), {gateway: null})
  assert.equal(none.values.world, 'null', 'no world is prepared for this cell')
  assert.match(none.standing.surfaces.disabled, /No world is prepared for this cell .*a receipt written elsewhere with `--receipt` is not listed/)
  const choosing = rack.workcellRackBinding(rackInput({worlds: answered(two)}), {gateway: null})
  assert.match(choosing.standing.world.disabled, /choose one; none is assumed/)
  assert.equal(choosing.values.world, undefined, 'no world is drawn until the hand chooses')
  choosing.local.worldReceipt('/r/world-2.json')
  const chosen = rack.workcellRackBinding(rackInput({worlds: answered(two)}), {gateway: null, workcell: recorder().port})
  assert.equal(chosen.standing.world, undefined, 'the hand\'s choice stands')
  assert.ok(chosen.values.world, 'the chosen receipt\'s material is drawn')
  const workcellSays = rack.workcellRackBinding(rackInput({worlds: refused(installed)}), {gateway: null})
  assert.equal(workcellSays.standing.world.disabled, installed, 'the installed workcell\'s refusal is drawn')
  bind.resetHolds()
})

test('3 · the chosen receipt\'s material reading draws the World and Exposure pages and the run its receipt names', () => {
  const read1 = material.materialWorldOf(MATERIAL)
  assert.deepEqual(read1.world, {ref: LISTED.world_ref, demand: 'demand:dlw-capture', retention: 'release', state: 'healthy',
    bindings: [{ref: 'workspace:checkout', port: 'workspace', provider: 'provider:collapsed-local-git-worktree', necessity: 'required', health: 'healthy', presence: 'present', observed: 'present'}]})
  assert.deepEqual(read1.bindings, ['workspace:checkout'])
  assert.deepEqual(read1.surfaces, [{ref: 'surface:preview', interaction: 'http', endpoint: 'http://127.0.0.1:4173'}])
  assert.deepEqual(read1.omitted, [{requirement: 'expose:logs', necessity: 'optional', reason: 'no provider exposes logs'}])
  assert.equal(read1.readAt, 1_792_600_000_000)
  assert.equal(material.materialWorldOf({contract: 'other'}), null)
  bind.resetHolds()
  const binding = rack.workcellRackBinding(rackInput(), {gateway: null, rereadWorld: () => {}})
  assert.deepEqual(JSON.parse(binding.values.world), read1.world)
  assert.deepEqual(JSON.parse(binding.values.surfaces), read1.surfaces)
  assert.equal(binding.values.readAt, 1_792_600_000_000)
  assert.equal(binding.values.run, 'opaque:factory-run-capture', 'the run the receipt names among its subjects')
  const workcellSays = 'identity-mismatch: Receipt was replaced with a different active WorldRef'
  const replaced = rack.workcellRackBinding(rackInput({material: refused(workcellSays)}), {gateway: null})
  assert.equal(replaced.standing.world.disabled, workcellSays)
})

test('4 · Recover, Release world and Apply run on the listed receipt, as the person\'s press, through the kernel\'s workcell_write (fake port); the last reconcile is Apply\'s answer', async () => {
  bind.resetHolds()
  const {calls, port} = recorder()
  const rereads = []
  const binding = rack.workcellRackBinding(rackInput(), {gateway: null, workcell: port, rereadWorld: () => rereads.push(true)})
  for (const key of ['recover', 'apply', 'releaseWorld', 'reread']) assert.equal(binding.standing[key], undefined, `${key} stands`)
  await binding.write([{key: 'recover', value: LISTED.world_ref}])
  await binding.write([{key: 'releaseWorld', value: LISTED.world_ref}])
  await binding.write([{key: 'reread', value: true}])
  await binding.write([{key: 'want:workspace:checkout', value: 'released'}])
  await assert.rejects(binding.write([{key: 'want:workspace:other', value: 'released'}]), /not a binding of the world read here/)
  await rack.workcellRackBinding(rackInput(), {gateway: null, workcell: port}).write([{key: 'apply', value: true}])
  assert.deepEqual(calls, [{kind: 'recover', receipt: LISTED.receipt}, {kind: 'release', receipt: LISTED.receipt},
    {kind: 'reconcile', receipt: LISTED.receipt, desired: ['workspace:checkout=released']}])
  assert.deepEqual(rereads, [true], 'Read now reads the material again')
  await assert.rejects(binding.write([{key: 'recover', value: 'world:other'}]), /not the world read here/)
  const after = rack.workcellRackBinding(rackInput({reconciled: {deltas: [{logical_ref: 'workspace:checkout', observed: 'present', desired: 'released', action: 'release'}]}}), {gateway: null, workcell: port})
  assert.deepEqual(JSON.parse(after.values.reconciled), [{ref: 'workspace:checkout', desired: 'released', observed: 'present', action: 'release'}])
  assert.match(binding.standing.reconciled.disabled, /none ran in this window/)
  const none = rack.workcellRackBinding(rackInput({}, 'workcell:mac'), {gateway: null, workcell: port})
  await assert.rejects(none.write([{key: 'recover', value: 'world:x'}]), {message: rack.WORKCELL_REFUSE.recover})
  bind.resetHolds()
  const rail = read('agent/devices/AgentRailDevices.tsx')
  assert.match(rail, /useWorkcellRead\(transport, asked \? \{kind: 'worlds'\} : null\)/)
  assert.match(rail, /\{op: 'material_read' as const, target: \{receipt: picked\.chosen\.receipt, state_root: stateRoot, expected_world_ref: picked\.chosen\.worldRef\}\}/)
  assert.match(rail, /if \(request\.kind === 'reconcile'\) setLastReconcile/)
})

test('5 · Runs\' Outputs: the attempt\'s world is the listed receipt whose world_ref is its materialWorldRef; Collect reads `workcell collect` on it', async () => {
  const record = {attemptRef: 'attempt:1', workflowUnitRef: 'unit:check', attemptRecordedAt: '2026-10-21T09:00:00Z', executionRef: 'execution:1',
    disposition: {body: {materialWorldRef: LISTED.world_ref, workcellRef: CELL}}}
  const take = takes.takeOf('s', {attempt_ref: 'attempt:1', run_ref: 'run:1', state_path: '/s.json', task_ref: 't', workflow_unit: 'unit:check'}, record)
  assert.equal(take.materialWorldRef, LISTED.world_ref, 'the execution body\'s materialWorldRef')
  assert.equal(takes.takeOf('s', {attempt_ref: 'attempt:2', run_ref: 'run:1', state_path: '/s.json', task_ref: 't'}, {...record, attemptRef: 'attempt:2', disposition: {body: {}}}).materialWorldRef, null)
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /listed\?\.worlds\.find\(row => row\.worldRef === take\.materialWorldRef\)/)
  assert.match(chain, /workcellReadOp\(\{kind: 'collect', receipt\}\)/)
  bind.resetHolds()
  const asked = []
  const COLLECT = {world_ref: LISTED.world_ref, outputs: [{logical_ref: 'output:report', material_locator: '/w/out/report.md', provenance: 'workcell'}], omissions: []}
  const binding = tasks.runsBinding('s', bind.chainHolds(), {takes: [], choose: async () => ({ok: true}), receipts: {'attempt:1': LISTED.receipt}, collected: {'attempt:1': {value: COLLECT}},
    collect: async (attempt, receipt) => { asked.push([attempt, receipt]) }})
  assert.deepEqual(JSON.parse(binding.values.collected), [material.collectedOf('attempt:1', COLLECT)])
  await binding.write([{key: 'collect', value: 'attempt:1'}])
  assert.deepEqual(asked, [['attempt:1', LISTED.receipt]])
  const why = 'no receipt `workcell worlds` lists is the world an attempt names (a receipt written elsewhere with `--receipt` is not listed).'
  const unlisted = tasks.runsBinding('s', bind.chainHolds(), {takes: [], choose: async () => ({ok: true}), receipts: {}, outputsWhy: why})
  assert.equal(unlisted.standing.collect.disabled, `Collect: ${why}`)
  assert.equal(unlisted.standing.collected.disabled, `What Workcell collected from each attempt's world: ${why}`)
})

test('6 · the carrier\'s Plan stays refused, naming the demand body it waits for (Workcell\'s kept demand, `workcell run show`)', () => {
  bind.resetHolds()
  const binding = cell.carrierBinding(answered(REAL.workcellStatus), bind.chainHolds())
  // REPLACED (lane W13): `workcell run show` is routed; with no run handed in, the plan says it waits for the chosen world's run.
  assert.match(binding.standing.plan.disabled, /the run the chosen world's receipt names, read with `workcell run show`/)
  assert.equal(binding.standing.replan.disabled, cell.CARRIER_REFUSE.replan)
})

test('7 · the rack draws the world on every page and view, and Runs its outputs — no NaN, no undefined, never their fixture text', () => {
  bind.resetHolds()
  host.resetHost()
  const binding = rack.workcellRackBinding(rackInput(), {gateway: null, workcell: recorder().port, rereadWorld: () => {}})
  const runs = tasks.runsBinding('s', bind.chainHolds(), {takes: [], choose: async () => ({ok: true}), receipts: {'attempt:1': LISTED.receipt},
    collected: {'attempt:1': {value: {world_ref: LISTED.world_ref, outputs: [], omissions: []}}}, collect: async () => {}})
  for (const [design, b, pages, fixture] of [[rackDesign, binding, ['chain', 'world', 'services', 'exposure', 'release'], /Claude Code · local|reads-round-2|omarchy · env-1|factory-attempt|Type-check the three|dlw\/uiux-kit-motion/],
    [runsDesign, runs, [undefined], /Type-check the roots|run:3|AgentShellContext/]]) {
    for (const view of host.viewsOf(design)) {
      for (const page of view === 'whole' || view === 'full' ? pages : [undefined]) {
        if (page) host.setHostPage(b.id, page)
        const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: b, view, nav: {}}))
        assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view}/${page} draws`)
        assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}/${page}: no absent key drawn as text`)
        assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}/${page}: its own view drew`)
        assert.doesNotMatch(markup, fixture, `${design.id} ${view}/${page}: its fixture never stands in`)
      }
    }
    host.resetHost()
  }
  bind.resetHolds()
})
