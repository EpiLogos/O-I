// Lane BF2: Factory's Main track devices and the Frames monitor on their owners — the Gateways rack (actuation:gateways-rack, DLW
// §19.2), the Agency gateway as its chain (ai-kit:agency-gateway, §19.9), the Experiment (actuation:experiment, §19.4) and the Frames
// monitor with its widget on the rail (actuation:frames-monitor, §19.5, §23.8) — src/agent/devices/mainTrackBindings.ts,
// FactoryDeviceChain.tsx, frame/widgets/deviceWidgets.tsx. Owners write, faces read: the chains are the family's registered gateways,
// each with the state its reading earns; what no kernel op reaches is absent; every write no owner carries is disabled with why.
//
// Channels:
// - REAL CAPTURE: the gateway's answer below is the installed owner's on this machine, 16 Oct 2026 (`aikit --json gateway agent
//   --binding cursor sessions` → cli.gateway_unreachable), as the kernel passes it (agency.rs:144-176 `{refused, error, message}`).
// - FIXTURE: an answered gateway document (the gateway does not run here) and a gateway that answers but refuses the binding.
// - SCRIPTED: the catalogue's four designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
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
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const widgets = await import('../src/frame/widgets/deviceWidgets.tsx')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const main = await import('../src/agent/devices/mainTrackBindings.ts')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const views = ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}})))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

// ---- the owner's real answer (16 Oct) --------------------------------------------------------------------------------------
const SOCKET = 'connect gateway socket /Users/admin/.aikit/state/gateway.sock: No such file or directory (os error 2); start one with `aikit gateway serve`'
const UNREACHABLE = {...model.INITIAL_READING, gatewayAdmitted: false,
  gatewayDoc: {refused: true, error: {code: 'cli.gateway_unreachable', details: {hint: 'aikit gateway serve'}, message: SOCKET}, message: SOCKET}}
// ---- fixtures ---------------------------------------------------------------------------------------------------------------
const ANSWERED = {...model.INITIAL_READING, gatewayAdmitted: true, gatewayDoc: {state: 'ready', transport: 'ws', connect: true, stall_after_seconds: 90}}
const BINDING_REFUSED = {...model.INITIAL_READING, gatewayAdmitted: false, gatewayDoc: {refused: true, error: {code: 'gateway.binding_unknown', message: 'no binding named cursor'}, message: 'no binding named cursor'}}

// The Gateways rack, the Agency gateway, the Experiment and the Frames monitor were retired as devices of their own in the
// 22 Oct manual rewrite (the Gateway's Frames page and agency build carry them); their bindings stay for the devices that carry them,
// and are checked below on their own.
test('the gateway\'s answer: answered, the gateway itself unreachable, or the gateway refusing the binding — each in the owner\'s words', () => {
  assert.equal(model.gatewayLine(UNREACHABLE.gatewayDoc), `the gateway refused the read — ${SOCKET}`, 'the refusal line keeps the owner\'s words (they sit beside the flag)')
  assert.deepEqual(main.gatewayAnswer(model.INITIAL_READING), {kind: 'unread'})
  assert.deepEqual(main.gatewayAnswer(UNREACHABLE), {kind: 'unreachable', words: SOCKET})
  assert.deepEqual(main.gatewayAnswer(ANSWERED), {kind: 'answered'})
  assert.deepEqual(main.gatewayAnswer(BINDING_REFUSED), {kind: 'refused', words: 'no binding named cursor'})
  assert.deepEqual(main.gatewayAnswer({gatewayAdmitted: false, gatewayDoc: null}), {kind: 'unread'}, 'a kernel failure reached no gateway')
})

// The Gateways rack's registered chains were declared on its own face (actuation:gateways-rack), retired in the 22 Oct manual
// rewrite: mainTrackBindings.ts registeredChains() now finds none, and the binding lane carries the chain list to the Gateway when it
// moves rackBinding.
test('the Agency gateway: its light and refusal from whether it answered; every rule a write no kernel op carries, disabled with why', async () => {
  bind.resetHolds()
  assert.deepEqual(main.agencyValues(UNREACHABLE, bind.chainHolds()), {light: 'dark', refused: SOCKET})
  assert.deepEqual(main.agencyValues(ANSWERED, bind.chainHolds()), {light: 'lit', state: 'ready'})
  assert.deepEqual(main.agencyValues(model.INITIAL_READING, bind.chainHolds()), {})
  const binding = main.agencyBinding(UNREACHABLE, bind.chainHolds())
  for (const [key, op] of [['service', /aikit gateway serve · shutdown/], ['entry', /gateway setup --mode/], ['coexist', /coexistence --policy/], ['agentPolicy', /sender kind agent/], ['surfaces', /connector add/]]) {
    assert.match(binding.standing[key].disabled, op, `${key} stands disabled with its missing op`)
    await assert.rejects(() => binding.write([{key, value: true}]), op)
  }
  await assert.rejects(() => binding.write([{key: 'on:gateway-connector/telegram/main', value: true}]), /connector add/)
  binding.local.entryPending('loopback-service')
  assert.equal(main.agencyValues(UNREACHABLE, bind.chainHolds()).entryPending, 'loopback-service', 'a changed entry is the view\'s own ask until Confirm')
  bind.resetHolds()
})

test('the Experiment: no kernel op reaches Actuation\'s comparison, so nothing is drawn as declared or run, and every statement says so', async () => {
  bind.resetHolds()
  assert.deepEqual(main.experimentValues(bind.chainHolds()), {})
  const binding = main.experimentBinding(bind.chainHolds())
  for (const key of main.EXPERIMENT_WRITES) assert.equal(binding.standing[key].disabled, main.EXPERIMENT_REFUSE, key)
  // REPLACED (lane W3): the comparison's readings are routed, its run is not (it runs models), and nothing here holds the records they read.
  assert.match(main.EXPERIMENT_REFUSE, /missing op: Actuation's matched comparison run, `actuation-research comparison\.run` \(research comparison\.rs run_with\), which the kernel does not route because it runs models/)
  for (const key of Object.keys(main.EXPERIMENT_ABSENT)) assert.match(binding.standing[key].disabled, /missing op:/, key)
  await assert.rejects(() => binding.write([{key: 'repeats', value: 5}]), /run_with/)
  binding.local.plot('time')
  assert.deepEqual(main.experimentValues(bind.chainHolds()), {plot: 'time'}, 'the reading the picture draws is the view\'s own')
  bind.resetHolds()
})

test('the Frames monitor reads the Gateway\'s own reading and holds its filters; it writes nothing (§19.5 "The monitor only reads")', () => {
  bind.resetHolds()
  const gateway = {reading: UNREACHABLE, harness: {binding: 'cursor', resolved: false}}
  const values = main.framesValues(gateway, bind.chainHolds())
  assert.deepEqual(values, {...bind.gatewayValues(gateway), ...main.FRAMES_VIEW}, 'the Gateway\'s values and the monitor\'s own settings')
  assert.equal(values.light, 'dark')
  assert.equal(values.frames, undefined, 'no kernel op reads the gateway\'s frame ring')
  const binding = main.framesBinding(gateway, bind.chainHolds())
  assert.equal(binding.write, undefined)
  binding.local.kinds('tools,errors')
  binding.local.pause(true)
  assert.deepEqual([main.framesValues(gateway, bind.chainHolds()).kinds, main.framesValues(gateway, bind.chainHolds()).pause], ['tools,errors', true])
  host.resetHost()
  assert.equal(host.hostedStanding(host.hostState(main.FRAMES_ID), binding, ['harness']).harness.disabled, 'No owner takes a change here.')
  bind.resetHolds()
})

test('with no session selected the chain draws the Main track — the Experiment, then Approvals — and publishes Gateways, the Agency gateway and Frames for the rail and a pane', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  // REPLACED (lane W1-Factory; DLW §16.1, §16.2, §19.1, §19.3, §19.10): Gateways is a monitor, on the rail and full in a pane, never on a chain;
  // the Agency gateway stands in the head of Messages and on no chain. The Main track's chain is the Experiment, then Approvals.
  assert.match(view, /<div className="factory-main" data-track="main"/)
  assert.match(view, /\{place\.kind === 'main' && <div className="factory-main"/, 'with no session selected the Device side is the Main track')
  assert.match(view, /\{place\.kind === 'session' && <>\{plates\}/, 'a selected session shows its own chain')
  assert.doesNotMatch(view, /<DeviceView device=\{main\.rack\}/, 'Gateways stands on no chain')
  assert.doesNotMatch(view, /<DeviceView device=\{main\.agency\}/, 'nor does the Agency gateway')
  assert.match(view, /<DeviceView device=\{main\.experiment\} size="compact" binding=\{mainBindings\.experiment\}/)
  // REPLACED (lane W1-Factory, the rail's one publisher): Gateways, the Agency gateway and Frames stand on the rail in every mode, so the
  // rail's publisher (AgentRailDevices.tsx) publishes them with their bindings; the chain publishes the Experiment.
  assert.match(view, /publishDevice\(EXPERIMENT_ID, \{device: main\.experiment, binding: mainBindings\.experiment\}\)/, 'the Experiment is published with its binding')
  const rail = read('agent/devices/AgentRailDevices.tsx')
  for (const [id, binding] of [['GATEWAYS_RACK_ID', 'gateways'], ['AGENCY_GATEWAY_ID', 'agency'], ['FRAMES_ID', 'frames']]) {
    assert.match(rail, new RegExp(`publish\\(${id}, ${binding}\\)`), `${id} is published with its binding, in every mode`)
  }
  // REPLACED (lane W7): the Run map and the Prompt pads are withdrawn with the chain too.
  assert.match(view, /EXPERIMENT_ID, \.\.\.SESSION_DEVICE_IDS, APPROVALS_ID,\s+SEAT_ID, CARRIER_ID, RUN_MAP_ID, PROMPT_PADS_ID\]\) publishDevice\(id, null\)/, 'and withdrawn with the chain — never the rail\'s')
  assert.match(read('agent/agentDockTiles.ts'), /claimRailWidget\('gateways', GATEWAYS_RACK_ID\)/, 'the rail claims the Gateways tile for the monitor')
  assert.doesNotMatch(read('agent/devices/mainTrackBindings.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the bindings read no design default or fixture')
  for (const file of ['agent/devices/mainTrackBindings.ts', 'agent/devices/factoryDevices.css', 'frame/widgets/deviceWidgets.tsx']) {
    assert.deepEqual(read(file).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
  }
})
