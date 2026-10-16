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
const {design: rackDesign} = await import('../src/inhabitants/catalogue/panels/actuation__gateways-rack.tsx')
const {design: agencyDesign} = await import('../src/inhabitants/catalogue/panels/ai-kit__agency-gateway.tsx')
const {design: experimentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__experiment.tsx')
const {design: framesDesign} = await import('../src/inhabitants/catalogue/panels/actuation__frames-monitor.tsx')

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

test('each Main track device and the Frames monitor is keyed to its design exactly, from the families\' admitted faces', () => {
  const devices = main.mainDevices()
  for (const [device, design] of [[devices.rack, rackDesign], [devices.agency, agencyDesign], [devices.experiment, experimentDesign], [devices.frames, framesDesign]]) {
    assert.ok(device, `${design.id}: the family admits the face`)
    assert.equal(designKey(device.family, device.face.id), design.id)
  }
  assert.deepEqual([main.GATEWAYS_RACK_DESIGN, main.AGENCY_GATEWAY_DESIGN, main.EXPERIMENT_DESIGN, main.FRAMES_DESIGN], [rackDesign.id, agencyDesign.id, experimentDesign.id, framesDesign.id])
  assert.deepEqual(main.registeredChains(), ['hermes', 'aikit-agency-gateway', 'actuation-frank', 'remote-carrier'], 'the registered gateways (actuationFamilyManifest.ts:15)')
})

test('the gateway\'s answer: answered, the gateway itself unreachable, or the gateway refusing the binding — each in the owner\'s words', () => {
  assert.equal(model.gatewayLine(UNREACHABLE.gatewayDoc), `the gateway refused the read — ${SOCKET}`, 'the refusal line keeps the owner\'s words (they sit beside the flag)')
  assert.deepEqual(main.gatewayAnswer(model.INITIAL_READING), {kind: 'unread'})
  assert.deepEqual(main.gatewayAnswer(UNREACHABLE), {kind: 'unreachable', words: SOCKET})
  assert.deepEqual(main.gatewayAnswer(ANSWERED), {kind: 'answered'})
  assert.deepEqual(main.gatewayAnswer(BINDING_REFUSED), {kind: 'refused', words: 'no binding named cursor'})
  assert.deepEqual(main.gatewayAnswer({gatewayAdmitted: false, gatewayDoc: null}), {kind: 'unread'}, 'a kernel failure reached no gateway')
})

test('the Gateways rack: the registered chains, each with the state its reading earns — never the design\'s Ready/Composed/Refused fixture', async () => {
  bind.resetHolds()
  const chains = values => JSON.parse(values.chains)
  const down = main.rackValues({reading: UNREACHABLE, holds: bind.chainHolds()})
  assert.deepEqual(chains(down), [
    {id: 'hermes', name: 'Hermes gateway'},
    {id: 'aikit-agency-gateway', name: 'AIKit agency gateway', state: 'refused', why: SOCKET},
    {id: 'actuation-frank', name: 'Actuation gateway'},
    {id: 'remote-carrier', name: 'Remote carrier'},
  ], 'the AIKit gateway refused in its words; the harness behind it, the Actuation gateway and the carrier are not read')
  assert.equal(down.light, 'dark')
  for (const key of ['chain', 'fanOut', 'peers', 'frames']) assert.equal(down[key], undefined, `${key}: no owner reports it`)
  const up = main.rackValues({reading: ANSWERED, holds: bind.chainHolds()})
  assert.deepEqual(chains(up).slice(0, 2), [{id: 'hermes', name: 'Hermes gateway', state: 'ready', transport: 'ws'}, {id: 'aikit-agency-gateway', name: 'AIKit agency gateway', state: 'ready'}])
  assert.equal(up.light, 'lit')
  assert.deepEqual(chains(main.rackValues({reading: BINDING_REFUSED, holds: bind.chainHolds()})).slice(0, 2),
    [{id: 'hermes', name: 'Hermes gateway', state: 'refused', why: 'no binding named cursor'}, {id: 'aikit-agency-gateway', name: 'AIKit agency gateway', state: 'ready'}])
  assert.equal(main.rackValues({reading: model.INITIAL_READING, holds: bind.chainHolds()}).light, undefined, 'nothing read: no light')
  // Choosing a chain is the view's own, and shows that gateway whole; Fan-out has no carrier.
  const shown = []
  const binding = main.rackBinding({reading: UNREACHABLE, holds: bind.chainHolds()}, {show: chain => shown.push(chain)})
  binding.local.chain('aikit-agency-gateway')
  assert.equal(main.rackValues({reading: UNREACHABLE, holds: bind.chainHolds()}).chain, 'aikit-agency-gateway')
  assert.deepEqual(shown, ['aikit-agency-gateway'])
  assert.match(binding.standing.fanOut.disabled, /missing op: kernel:harness_agent_control configure \{fan_out\}/)
  await assert.rejects(() => binding.write([{key: 'fanOut', value: 3}]), /configure \{fan_out\}/)
  assert.equal(binding.writes('chains'), false, 'the chains are a reading')
  bind.resetHolds()
})

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
  assert.match(main.EXPERIMENT_REFUSE, /missing op: Actuation's matched comparison \(research comparison\.rs run_with\) through the kernel/)
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

test('the four designs draw on their bindings in all five views — no NaN, no undefined, never their fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const gateway = {reading: UNREACHABLE, harness: {binding: 'cursor', resolved: false}}
  const cases = [
    [rackDesign, main.rackBinding({reading: UNREACHABLE, holds: bind.chainHolds()}, {show() {}}), /build-lane|Terminate TLS|actuation-frank\b.*composed|14:02:0/, [main.RACK_REFUSE.fanOut]],
    [agencyDesign, main.agencyBinding(UNREACHABLE, bind.chainHolds()), /@nara|Telegram|launchd|100\.92\.62/, [main.AGENCY_REFUSE.service, main.AGENCY_REFUSE.agentPolicy]],
    [experimentDesign, main.experimentBinding(bind.chainHolds()), /deeper loop|S1-CODE-001|build-lane|exp-1014/, [main.EXPERIMENT_REFUSE]],
    [framesDesign, main.framesBinding(gateway, bind.chainHolds()), /build-lane|3f9a21c4|Type-check the three/, []],
  ]
  for (const [design, binding, fixture, reasons] of cases) {
    const drawn = hosted(design, binding)
    drawn.forEach((markup, index) => {
      assert.match(markup, new RegExp(`data-device-view="${views[index]}"`), `${design.id} ${views[index]} draws`)
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${views[index]}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${views[index]}: its own view drew`)
      assert.doesNotMatch(markup, fixture, `${design.id} ${views[index]}: its fixture never stands in`)
    })
    const all = drawn.join('\n')
    for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refused control says why (${why})`)
  }
  const rack = hosted(rackDesign, cases[0][1]).join('\n')
  assert.ok(rack.includes('AIKit agency gateway') && rack.includes(escaped(SOCKET).slice(0, 40)), 'the rack names the refused chain and keeps its reason visible')
  assert.ok(hosted(agencyDesign, cases[1][1])[3].includes(escaped(SOCKET).slice(0, 40)), 'the Agency gateway\'s pane gives the owner\'s refusal')
  host.resetHost()
})

test('the rail\'s Frames is the Frames monitor\'s own widget (§23.8): bare, on the device\'s binding; the launcher offers one Frames', () => {
  const registered = {id: 'frames', name: 'Frames', mark: 'link', Body: () => null}
  assert.equal(widgets.claimedWidget(registered), registered, 'unclaimed, the registration draws itself')
  widgets.claimRailWidget('frames', main.FRAMES_ID)
  const claimed = widgets.claimedWidget(registered)
  assert.equal(claimed.bare, true, 'the device\'s Tile is the tile: no second head')
  assert.equal(claimed.name, 'Frames')
  assert.notEqual(claimed.Body, registered.Body)
  const device = main.mainDevices().frames
  door.publishDevice(device.id, {device, binding: main.framesBinding({reading: UNREACHABLE, harness: {binding: 'cursor', resolved: false}}, bind.chainHolds())})
  try {
    assert.deepEqual(widgets.deviceWidgets([], 'frames').found, [], 'a search finds the claiming registration, not a second Frames')
    const tile = renderToStaticMarkup(createElement(claimed.Body, {subject: null, pinned: false}))
    assert.match(tile, /data-device-size="widget"/)
    assert.match(tile, /data-device-design="actuation:frames-monitor"|data-device-design="generic"/)
  } finally { door.publishDevice(device.id, null) }
  assert.match(read('agent/AgentDockTileBody.tsx'), /claimRailWidget\('frames', FRAMES_ID\)/, 'the Frames tile\'s own module claims it for the monitor')
  assert.doesNotMatch(read('agent/AgentDockTileBody.tsx'), /op: 'harness_agent_read'/, 'its raw gateway receipt is gone (MOVED)')
  assert.match(read('frame/widgets/WidgetRail.tsx'), /widgets\.map\(claimedWidget\)/)
})

test('with no session selected the chain draws the Main track, the Agency gateway inside the rack, and publishes each with its binding', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /<div className="factory-main" data-track="main"/)
  assert.match(view, /\{sessionRef == null && <div className="factory-main"/, 'with no session selected the Device side is the Main track')
  assert.match(view, /\{sessionRef != null && chain\.map\(/, 'a selected session shows its own chain')
  assert.match(view, /<DeviceView device=\{main\.rack\} size="compact" binding=\{mainBindings\.rack\}/)
  assert.match(view, /<DeviceView device=\{main\.agency\} size="compact" binding=\{mainBindings\.agency\}/)
  assert.match(view, /<DeviceView device=\{main\.experiment\} size="compact" binding=\{mainBindings\.experiment\}/)
  for (const [id, key] of [['GATEWAYS_RACK_ID', 'rack'], ['AGENCY_GATEWAY_ID', 'agency'], ['EXPERIMENT_ID', 'experiment'], ['FRAMES_ID', 'frames']]) {
    assert.match(view, new RegExp(`publishDevice\\(${id}, \\{device: main\\.${key}, binding: mainBindings\\.${key}\\}\\)`), `${key} is published with its binding`)
  }
  assert.match(view, /\.\.\.MAIN_DEVICE_IDS, \.\.\.SESSION_DEVICE_IDS, \.\.\.RECEIPT_DEVICE_IDS,\s+\.\.\.WORKCELL_DEVICE_IDS\]\) publishDevice\(id, null\)/, 'and withdrawn with the chain')
  assert.doesNotMatch(read('agent/devices/mainTrackBindings.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the bindings read no design default or fixture')
  for (const file of ['agent/devices/mainTrackBindings.ts', 'agent/devices/factoryDevices.css', 'frame/widgets/deviceWidgets.tsx']) {
    assert.deepEqual(read(file).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
  }
})
