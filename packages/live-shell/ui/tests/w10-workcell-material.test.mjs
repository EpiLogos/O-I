// Lane W10, design package D1 (T-COVERAGE §2) on Workcell's routes (a4c97faa9, cdbde6fe7): the workcell rack's Services and harness
// processes from `workcell doctor` and `instances list|usage`; its World, Exposure and Release, whose reads and writes (`material`,
// `recover`, `release`, `reconcile`) each take a world's receipt that no reading names; the Remote carrier's Standing page — Offers from
// `workcell discover`, each machine's standing and round trip from `workcell connections probe` (a read that never writes the record), the
// Plan absent because no reading names the run's demand; Runs' Outputs (`workcell collect` on an attempt's world receipt).
//
// Channels:
// - REAL (read-only, 21 Oct): `workcell doctor|discover|plan|instances list|instances usage` (desktop/cradle/kernel/tests/fixtures/
//   owner-routes/workcell-material-2026-10-21.json); `workcell connections probe` against two scratch cells on loopback, from Workcell#117
//   built locally (workcell-connections-probe-2026-10-21.json); `workcell status --json` (tests/fixtures/workcell-readings-2026-10-21.json).
// - FAKE: a world as a material reading would hand it (its receipt, its ref, its bindings) and a collect reading in Workcell's own shape
//   (no world is prepared on this machine: persisted_world_receipts 0); every Workcell write goes to a recording port. Never a Workcell write
//   on the real machine.
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
const {design: rackDesign} = await import('../src/inhabitants/catalogue/panels/workcell__workcell.tsx')
const {design: carrierDesign} = await import('../src/inhabitants/catalogue/panels/workcell__remote-carrier.tsx')
// Runs' design (software-factory__attempt-review.tsx) was retired in the 22 Oct manual rewrite (#725): a run's attempts are takes on its track
// in Arrangement view (§16.1), its outputs the Results tile's and Approvals' review (§19.1, §19.14); its binding (taskBindings.ts runsBinding)
// stays and is checked on its own values.

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const ROUTES = '../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/'
const MATERIAL = json(`${ROUTES}workcell-material-2026-10-21.json`)
const PROBE = json(`${ROUTES}workcell-connections-probe-2026-10-21.json`)
const REAL = json('./fixtures/workcell-readings-2026-10-21.json')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const answered = value => ({status: 'answered', value, error: null})
const refused = error => ({status: 'refused', value: null, error})
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent'
  : binding.writes?.(key) ? 'write' : null
const INSTANCE = MATERIAL.instances.instances[0]
const USAGES = {[INSTANCE.instance_ref]: {value: MATERIAL.usage}}
const GATEWAY = bind.gatewayValues({reading: {...model.INITIAL_READING, gatewayAdmitted: true, gateway: {kind: 'reading', title: 'Gateway', line: 'answered', receipt: null},
  gatewayDoc: {state: 'ready', transport: 'stdio', approvals: 'session', stall_after_seconds: 300}}, harness: {binding: 'claude-code', resolved: true}})
const rackInput = (over = {}, holds = bind.chainHolds()) => ({name: 'env-1', project: 'O-I', seats: REAL.seatStatus,
  chain: {gateway: GATEWAY, carrier: cell.carrierValues(answered(REAL.workcellStatus), holds), git: null}, holds,
  doctor: answered(MATERIAL.doctor), instances: {list: answered(MATERIAL.instances), usages: USAGES}, ...over})
/** A world as a material reading would hand it (FAKE: no world is prepared on this machine). */
const WORLD = {receipt: '/Users/admin/.workcell/receipts/world-1.json', ref: 'world:demand:cli:1', bindings: ['workspace:primary', 'service:redis-now/personal-workcell']}
function recorder() {
  const calls = []
  return {calls, port: async request => { calls.push(request); return {} }}
}

// ------------------------------------------------------------------------------------------------------------- the workcell rack

test('1 · Services from `workcell doctor` and the harness processes from `instances list` with each live one\'s `instances usage` (REAL)', () => {
  const services = material.servicesOf(MATERIAL.doctor)
  assert.equal(services.length, MATERIAL.doctor.declared_services.length)
  assert.deepEqual(services[2], {ref: 'service:kev-decision/personal-workcell', endpoint: 'http://127.0.0.1:8019', health: 'healthy', availability: 'available', lifetime: 'target-owned'})
  assert.equal(material.usagePid(INSTANCE), MATERIAL.usage.material_binding.pid, 'the cost is read on the newest execution, as the capture was')
  const instances = material.instancesOf(MATERIAL.instances, USAGES)
  assert.deepEqual(instances[0], {ref: INSTANCE.instance_ref, harness: 'harness/claude-code', liveness: 'live', pids: INSTANCE.pids, cpu: 0, rss: 126926848})
  assert.deepEqual(Object.keys(material.instancesOf(MATERIAL.instances)[0]).sort(), ['harness', 'liveness', 'pids', 'ref'], 'no usage read: no cost invented')
  for (const map of [material.servicesOf, material.instancesOf, material.offersOf, material.planOf]) assert.equal(map({}), null)
  bind.resetHolds()
  const reread = []
  const binding = rack.workcellRackBinding(rackInput(), {gateway: null, rereadServices: () => reread.push(true)})
  assert.deepEqual(JSON.parse(binding.values.services), services)
  assert.deepEqual(JSON.parse(binding.values.instances), instances)
  assert.equal(binding.standing.services, undefined)
  assert.equal(binding.standing.readServices, undefined)
  return binding.write([{key: 'readServices', value: true}]).then(() => {
    assert.deepEqual(reread, [true], 'Read now asks doctor again')
    const workcellSays = 'workcell: the state root is not writable'
    const down = rack.workcellRackBinding(rackInput({doctor: refused(workcellSays), instances: {list: refused(workcellSays), usages: {}}}), {gateway: null})
    assert.equal(down.standing.services.disabled, workcellSays)
    assert.equal(down.standing.instances.disabled, workcellSays)
    assert.equal(down.standing.readServices.disabled, rack.WORKCELL_REFUSE.readServices, 'no carrier: Read now says so')
    const unread = rack.workcellRackBinding(rackInput({doctor: undefined, instances: undefined}), {gateway: null})
    assert.match(unread.standing.services.disabled, /Workcell has no `services` command, doctor declares them/)
  })
})

test('2 · the world\'s writes: none without a world\'s receipt (no reading names one); with one, Recover, Release and Apply go only on the press, on that receipt, refused in Workcell\'s words', async () => {
  bind.resetHolds()
  const none = rack.workcellRackBinding(rackInput(), {gateway: null, workcell: recorder().port})
  for (const key of ['recover', 'apply', 'releaseWorld', 'world', 'surfaces', 'omitted', 'reconciled']) assert.ok(none.standing[key].disabled.includes(rack.NO_RUN), key)
  // REPLACED (lane W12): `workcell worlds` lists the receipts now; not handed in, the rack says it is not read (w12-workcell-worlds.test.mjs).
  assert.match(rack.NO_RUN, /Workcell's world receipts \(`workcell worlds`\) are not read here/)
  assert.equal(REAL.workcellStatus.persisted_world_receipts, 0, 'none is prepared on this machine')
  await assert.rejects(none.write([{key: 'releaseWorld', value: 'world:x'}]), {message: rack.WORKCELL_REFUSE.releaseWorld})
  await assert.rejects(none.write([{key: 'want:workspace:primary', value: 'released'}]), {message: rack.FATE_REFUSE})
  const {calls, port} = recorder()
  const binding = rack.workcellRackBinding(rackInput({world: WORLD}), {gateway: null, workcell: port})
  for (const key of ['recover', 'apply', 'releaseWorld']) assert.equal(binding.standing[key], undefined, `${key} stands with a world read`)
  await binding.write([{key: 'recover', value: WORLD.ref}])
  await binding.write([{key: 'releaseWorld', value: WORLD.ref}])
  await assert.rejects(binding.write([{key: 'recover', value: 'world:other'}]), /not the world read here/)
  await assert.rejects(binding.write([{key: 'apply', value: true}]), /no binding's fate is set/)
  await binding.write([{key: 'want:service:redis-now/personal-workcell', value: 'suspended'}])
  await assert.rejects(binding.write([{key: 'want:service:not-a-binding', value: 'released'}]), /not a binding of the world/)
  await assert.rejects(binding.write([{key: 'want:workspace:primary', value: 'gone'}]), /fate is one of present, suspended, snapshotted, released/)
  await rack.workcellRackBinding(rackInput({world: WORLD}), {gateway: null, workcell: port}).write([{key: 'apply', value: true}])
  assert.deepEqual(calls, [{kind: 'recover', receipt: WORLD.receipt}, {kind: 'release', receipt: WORLD.receipt},
    {kind: 'reconcile', receipt: WORLD.receipt, desired: ['service:redis-now/personal-workcell=suspended']}])
  const workcellSays = 'workcell: the receipt names a world this cell no longer holds'
  await assert.rejects(rack.workcellRackBinding(rackInput({world: WORLD}), {gateway: null, workcell: async () => { throw new Error(workcellSays) }}).write([{key: 'recover', value: WORLD.ref}]),
    {message: workcellSays})
  assert.match(rack.workcellRackBinding(rackInput({world: WORLD}), {gateway: null}).standing.recover.disabled, /carrier is unavailable/)
  // REPLACED (lane K0): Workcell takes checkpoints (`workcell --receipt R checkpoint`, k0-owner-ops-bindings.test.mjs); no world, none taken.
  assert.match(rack.WORKCELL_REFUSE.checkpoint, /workcell --receipt R checkpoint/)
  bind.resetHolds()
})

test('3 · the rail reads doctor, the instances and their cost while the rack stands, asks doctor again for Read now, and writes worlds through workcell_write', () => {
  const rail = read('agent/devices/AgentRailDevices.tsx')
  assert.match(rail, /useWorkcellRead\(transport, asked \? \{kind: 'doctor'\} : null\)/)
  assert.match(rail, /useWorkcellRead\(transport, asked \? \{kind: 'instances-list'\} : null\)/)
  assert.match(rail, /useInstanceUsages\(transport, instanceList\.answer\)/)
  assert.match(rail, /rereadServices: doctor\.refresh/)
  assert.match(rail, /ownerRouteWrite\(transport, workcellWriteOp\(request\)/)
  const reads = read('agent/devices/workcellReads.ts')
  assert.match(reads, /workcellReadOp\(\{kind: 'instances-usage', instance_ref: ref, \.\.\.\(pid !== undefined \? \{pid\} : \{\}\), interval_ms: 0\}\)/)
})

// ------------------------------------------------------------------------------------------------------------- the Remote carrier

test('4 · the carrier\'s Offers from `workcell discover` (REAL); the Plan absent with the demand it lacks; Plan again refused', () => {
  const offers = material.offersOf(MATERIAL.discover)
  assert.equal(offers.length, MATERIAL.discover.offers.length)
  assert.deepEqual(offers[0], {ref: 'offer:provider:collapsed-local-git-worktree:git-worktree', port: 'workspace', health: 'healthy', availability: 'available'})
  const plan = material.planOf(MATERIAL.plan)
  assert.deepEqual(plan, {status: 'satisfiable', bindings: [], degradations: [], omissions: []})
  assert.deepEqual(material.planOf(MATERIAL.plan_unsatisfiable.stdout).omissions, [{requirement: 'affordance:workspace', necessity: 'required', reason: 'no offer supports this material requirement'}],
    'an unsatisfiable plan is Workcell\'s reading too')
  bind.resetHolds()
  const binding = cell.carrierBinding(answered(REAL.workcellStatus), bind.chainHolds(), undefined, {discover: answered(MATERIAL.discover)})
  assert.deepEqual(JSON.parse(binding.values.offers), offers)
  assert.equal(binding.standing.offers, undefined)
  // REPLACED (lane W12): the plan names the demand body it waits for (Workcell's kept demand, `workcell run show`).
  // REPLACED (lane W14): the run is the chosen world's ledger slug.
  assert.match(binding.standing.plan.disabled, /the chosen world's run \(`workcell worlds` runs\), read with `workcell run show`/)
  assert.equal(binding.standing.replan.disabled, cell.CARRIER_REFUSE.replan)
  const workcellSays = 'workcell: discover failed: the provider inventory is unreadable'
  assert.equal(cell.carrierBinding(answered(REAL.workcellStatus), bind.chainHolds(), undefined, {discover: refused(workcellSays)}).standing.offers.disabled, workcellSays)
})

test('5 · each machine\'s standing and round trip from `workcell connections probe` (REAL, Workcell#117): reached and admitted is Ready; reached but refused, Workcell\'s words; unreachable keeps its standing and says why', () => {
  const status = {...REAL.workcellStatus, connections: [{label: 'laptop', state: 'connected', endpoint: '127.0.0.1:63320', protocol: 'workcell.control/v1', remote_workcell_ref: 'workcell:laptop'}]}
  const machine = probe => cell.carrierMachines(status, undefined, material.probesByLabel(probe))[0]
  const reached = machine(PROBE.reachable)
  assert.equal(reached.state, 'refused', 'it answers but admits no credential')
  assert.equal(reached.why, 'this Workcell requires a connection credential and none was presented')
  assert.equal(reached.rtt, 0.4)
  assert.equal(reached.software, 'workcell 0.1.0 (unknown)')
  const admitted = {...PROBE.reachable, probes: [{...PROBE.reachable.probes[0], authorised: true}]}
  assert.equal(machine(admitted).state, 'ready')
  const gone = machine(PROBE.unreachable)
  assert.equal(gone.state, 'composed', 'the recorded standing is kept')
  assert.match(gone.why, /^Unreachable: connect Workcell control endpoint/)
  assert.equal(gone.rtt, undefined)
  assert.equal(machine({nothing: true}).state, 'composed', 'no probe reading: the recorded standing alone')
  const binding = cell.carrierBinding(answered(status), bind.chainHolds(), undefined, {probe: answered(PROBE.reachable)})
  assert.equal(JSON.parse(binding.values.machines)[0].rtt, 0.4)
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /useWorkcellRead\(transport, carrierLabels\.length \? \{kind: 'connections-probe'\} : null\)/)
  assert.match(chain, /useWorkcellRead\(transport, \{kind: 'discover'\}\)/)
  assert.match(PROBE.installed_refusal.error.message, /unknown connections subcommand `probe`/, 'the installed workcell refuses the probe: its words stand')
})

// ------------------------------------------------------------------------------------------------------------- Runs' Outputs

test('6 · Runs\' Outputs: absent with the receipt they lack; with an attempt\'s receipt, Collect reads `workcell collect` on it and the outputs stand as Workcell collected them', async () => {
  const COLLECT = {world_ref: 'world:demand:cli:1', outputs: [{logical_ref: 'output:report', material_locator: '/Users/admin/.workcell/out/report.md', provenance: 'workcell'}],
    omissions: [{requirement: 'output:logs', reason: 'no provider carries logs'}]}
  assert.deepEqual(material.collectedOf('attempt:1', COLLECT), {attempt: 'attempt:1', world: 'world:demand:cli:1',
    outputs: [{ref: 'output:report', locator: '/Users/admin/.workcell/out/report.md', provenance: 'workcell'}], omitted: [{requirement: 'output:logs', reason: 'no provider carries logs'}]})
  assert.equal(material.collectedOf('a', {outputs: []}), null)
  bind.resetHolds()
  const takes = {takes: [], choose: async () => ({ok: true})}
  const none = tasks.runsBinding('s', bind.chainHolds(), takes)
  assert.equal(none.standing.collected.disabled, tasks.RUNS_OUTPUTS.collected)
  assert.equal(none.standing.collect.disabled, tasks.RUNS_OUTPUTS.collect)
  await assert.rejects(none.write([{key: 'collect', value: 'attempt:1'}]), {message: tasks.RUNS_OUTPUTS.collect})
  const asked = []
  const withReceipts = tasks.runsBinding('s', bind.chainHolds(), {...takes, receipts: {'attempt:1': '/r/world-1.json'}, collected: {'attempt:1': {value: COLLECT}},
    collect: async (attempt, receipt) => { asked.push([attempt, receipt]) }})
  assert.deepEqual(JSON.parse(withReceipts.values.collected), [material.collectedOf('attempt:1', COLLECT)])
  await withReceipts.write([{key: 'collect', value: 'attempt:1'}])
  await assert.rejects(withReceipts.write([{key: 'collect', value: 'attempt:2'}]), /no world receipt is named for attempt:2/)
  assert.deepEqual(asked, [['attempt:1', '/r/world-1.json']])
  assert.equal(tasks.runsBinding('s', bind.chainHolds(), {...takes, receipts: {'attempt:1': '/r'}}).standing.collect.disabled, tasks.RUNS_OUTPUTS.noCarrier)
})

// ------------------------------------------------------------------------------------------------------------- drawn, and classified

test('7 · the designs draw on these bindings in all their views and pages — no NaN, no undefined, never their fixture text — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const rackBinding = rack.workcellRackBinding(rackInput(), {gateway: null, rereadServices: () => {}})
  const carrierBinding = cell.carrierBinding(answered(REAL.workcellStatus), bind.chainHolds(), undefined, {discover: answered(MATERIAL.discover), probe: answered(PROBE.reachable)})
  const runsBinding = tasks.runsBinding('s', bind.chainHolds(), {takes: [], choose: async () => ({ok: true})})
  const cases = [
    [rackDesign, rackBinding, ['chain', 'world', 'services', 'exposure', 'release', 'left'], /Claude Code · local|reads-round-2|omarchy · env-1|factory-attempt|Type-check the three|dlw\/uiux-kit-motion/, [rack.WORKCELL_REFUSE.releaseWorld]],
    [carrierDesign, carrierBinding, [undefined], /ready-to-carry|private-tailnet|1791417468786/, []],
  ]
  // REPLACED (#725): Runs' design drawn on its binding — no design draws Runs now (§16.1 "its attempts are takes"; §19.1 Results): the
  // binding's own values carry no absent key as text and none of the retired design's sample, and its Outputs stand disabled with why.
  const runsValues = JSON.stringify(runsBinding.values)
  assert.doesNotMatch(runsValues, /\bNaN\b|undefined/, 'Runs\' binding: no absent key as text')
  assert.doesNotMatch(runsValues, /Type-check the roots|run:3|AgentShellContext/, 'Runs\' binding: never the retired design\'s sample')
  for (const key of ['collected', 'collect']) assert.equal(runsBinding.standing[key].disabled, tasks.RUNS_OUTPUTS[key], `${key}: disabled, saying why`)
  for (const [design, binding, pages, fixture, reasons] of cases) {
    const drawn = []
    for (const view of host.viewsOf(design)) {
      for (const page of view === 'whole' || view === 'full' ? pages : [undefined]) {
        if (page) host.setHostPage(binding.id, page)
        const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view, nav: {}}))
        drawn.push(markup)
        assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view}/${page} draws`)
        assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}/${page}: no absent key drawn as text`)
        assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}/${page}: its own view drew`)
        assert.doesNotMatch(markup, fixture, `${design.id} ${view}/${page}: its fixture never stands in`)
      }
    }
    host.resetHost()
    const all = drawn.join('\n')
    for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refused control says why (${why.slice(0, 50)}…)`)
  }
  bind.resetHolds()
})

test('8 · (b) every key these designs read is an owner reading, absent with why, the hand\'s, or written through its owner', () => {
  bind.resetHolds()
  // A carried page's keys stand under its prefix and are hosted by prefixing that page's own binding, not this one (design.ts scoped):
  // the carrier carries the Machine page under `mc.` (DLW §19.18, "The Machine page"; central:machine's binding); the workcell its Left
  // behind page under `left.` and its tile's gateways under `gw.` (§19.23).
  const cases = [
    [rackDesign, rack.workcellRackBinding(rackInput(), {gateway: null, rereadServices: () => {}}), ['left.', 'gw.']],
    [carrierDesign, cell.carrierBinding(answered(REAL.workcellStatus), bind.chainHolds(), undefined, {discover: answered(MATERIAL.discover)}), ['mc.']],
  ]
  for (const [design, binding, carried] of cases) for (const key of designKeys(design).filter(key => !carried.some(prefix => key.startsWith(prefix)))) assert.ok(classify(binding, key), `${design.id} ${key}`)
  const runs = tasks.runsBinding('s', bind.chainHolds(), {takes: [], choose: async () => ({ok: true})})
  for (const key of ['collected', 'collect']) assert.equal(classify(runs, key), 'absent', key)
  bind.resetHolds()
})

test('9 · (b) the Gateway\'s link readings — beatAge, running, inflight, frames — stand absent with why where the gateway\'s answer carries no link', async () => {
  const {design: gatewayDesign} = await import('../src/inhabitants/catalogue/panels/actuation__gateway.tsx')
  const reading = {...model.INITIAL_READING, gatewayAdmitted: true, gateway: {kind: 'reading', title: 'Gateway', line: 'answered', receipt: null},
    // The gateway's answer as the kernel hands it on (`aikit --json gateway agent --binding B sessions`: the envelope's data, the engine's
    // result under `result`), from a gateway that predates the link (O-I #745: tests/t745-readings.test.mjs reads one that carries it).
    gatewayDoc: {binding_ref: 'gateway-binding/flint', operation: {op: 'sessions'}, type: 'conversation',
      result: {agent_session_ref: 'agent-session/flint', harness: 'claude-code', sessions: [{agent_session_ref: 'agent-session/flint', state: 'resident'}]}}}
  const binding = bind.gatewayBinding('factory:gateway', {reading, harness: {binding: 'claude-code', resolved: true}}, {}, async () => ({kind: 'fired'}))
  for (const key of ['beatAge', 'running', 'inflight', 'frames']) {
    assert.ok(key in gatewayDesign.defaults || Object.values(gatewayDesign.fixtures ?? {}).some(fixture => key in fixture), `${key} is a key of the Gateway's design`)
    assert.equal(classify(binding, key), 'absent', key)
    assert.match(binding.standing[key].disabled, /carries no link/, `${key}: says the answer carries no link`)
    assert.match(binding.standing[key].disabled, /aikit gateway agent --binding B sessions/, `${key}: names the document it reads`)
  }
  assert.equal(binding.values.harness, 'claude-code', 'what the reading does give stands as before')
})
