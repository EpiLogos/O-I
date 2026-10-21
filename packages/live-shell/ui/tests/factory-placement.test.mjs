// Lane W1-Factory: every Factory device stands where the manual puts it, with the views of those places only (HANDOFF-BUILD item 10;
// DLW §16.1 "Six kinds of device", §16.2 "Chains on tracks", §16.3 "Six views", §19.1, §19.23, §19.24) —
// src/agent/devices/factoryPlaces.ts (the chains), FactoryDeviceChain.tsx (which draws exactly those), AgentShellDeviceDetail.tsx (which
// routes a workcell's return track), agent/agentDockTiles.ts (the rail's claims).
//
// Channels:
// - SCRIPTED: the place plan (pure); every design on a chain loaded and its kind read; the catalogue designs rendered through the runtime's
//   host (deviceHost.HostedDevice) to static markup; the rail's claimed widgets drawn on devices published to the door.
// - CODE-READING: the chain's source draws the plan and no other plate.
// No owner state is read or written.
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
const door = await import('../src/frame/devices/deviceDoor.ts')
const widgets = await import('../src/frame/widgets/deviceWidgets.tsx')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const main = await import('../src/agent/devices/mainTrackBindings.ts')
const rec = await import('../src/agent/devices/receiptBindings.ts')
const cell = await import('../src/agent/devices/workcellBindings.ts')
const rack = await import('../src/agent/devices/workcellRackBinding.ts')
const msg = await import('../src/agent/devices/messagesBinding.ts')
const places = await import('../src/agent/devices/factoryPlaces.ts')
const tiles = await import('../src/agent/agentDockTiles.ts')
const registry = await import('../src/shell/widgets.tsx')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const {skills} = await import('../src/inhabitants/catalogue/panels/skills.tsx')
const {memberDevice} = await import('../src/inhabitants/catalogue/panels/member.tsx')
const {scope} = await import('../src/inhabitants/catalogue/panels/scope.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const designOf = async id => [skills, memberDevice, scope].find(design => design.id === id)
  ?? (await import(`../src/inhabitants/catalogue/panels/${id.replace(':', '__')}.tsx`)).design
const kindOf = async slot => (await designOf(places.SLOT_DEVICE[slot].design)).kind
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent' : null
const ANSWERED = {...model.INITIAL_READING, gatewayAdmitted: true, gatewayDoc: {state: 'ready', transport: 'ws', connect: true, stall_after_seconds: 90}}

test('a session\'s chain is Agent, skills rack, scope; a group\'s leads with the Agentset rack and the Decision helper — no gateway, no landing (§16.2, §19.23)', () => {
  const session = places.factoryPlace({sessionRef: 'ses-1', group: false, workcell: null})
  assert.deepEqual(session, {kind: 'session', group: false})
  assert.deepEqual(places.chainSlots(session), ['agent', 'skillset', 'world'])
  const group = places.factoryPlace({sessionRef: 'grp-1', group: true, workcell: null})
  assert.deepEqual(places.chainSlots(group), ['agentset', 'decision-helper', 'agent', 'skillset', 'world'])
  assert.deepEqual(places.chainSlots(group, {helper: false}), ['agentset', 'agent', 'skillset', 'world'], 'the helper stands where its device does')
  for (const chain of [places.chainSlots(session), places.chainSlots(group)]) for (const slot of ['gateway', 'git', 'remote-carrier', 'workcell']) assert.ok(!chain.includes(slot), `${slot} is no session's`)
  assert.equal(places.INSIDE.skillset, 'member', 'the member inside the Skillset rack (§19.7)')
  assert.equal(places.SLOT_DEVICE.agent.id, model.chainDeviceId('agent'))
})

test('the Main track\'s chain is the Experiment, then Approvals — the Gateways, the Ledger and the Link have left it (§16.2, §19.1)', () => {
  const place = places.factoryPlace({sessionRef: null, group: false, workcell: null})
  assert.deepEqual(place, {kind: 'main'})
  assert.deepEqual(places.chainSlots(place), ['experiment', 'approvals'])
  assert.deepEqual([places.SLOT_DEVICE.experiment.id, places.SLOT_DEVICE.approvals.id], [main.EXPERIMENT_ID, rec.APPROVALS_ID])
})

test('a workcell\'s chain is its rack, the Gateway, the Remote carrier and Git / landing with the Seat inside it (§16.2, §19.23)', () => {
  const place = places.factoryPlace({sessionRef: 'ses-1', group: false, workcell: 'env-2'})
  assert.deepEqual(place, {kind: 'workcell', name: 'env-2'}, 'a selected workcell\'s return track wins')
  assert.deepEqual(places.chainSlots(place), ['workcell', 'gateway', 'remote-carrier', 'git'])
  assert.equal(places.INSIDE.git, 'seat')
  assert.deepEqual([places.SLOT_DEVICE.workcell.id, places.SLOT_DEVICE['remote-carrier'].id, places.SLOT_DEVICE.git.id, places.SLOT_DEVICE.seat.id],
    [rack.WORKCELL_RACK_ID, cell.CARRIER_ID, cell.GIT_ID, cell.SEAT_ID])
})

test('no monitor and no connection stands on a session\'s or the Main track\'s chain; a workcell\'s chain is its rack and its connections (§16.1)', async () => {
  for (const place of [{kind: 'session', group: true}, {kind: 'main'}]) {
    for (const slot of places.chainSlots(place)) {
      const kind = await kindOf(slot)
      assert.ok(kind !== 'monitor' && kind !== 'connection', `${place.kind}: ${slot} is a ${kind}`)
    }
  }
  assert.equal(await kindOf('member'), 'effect')
  const kinds = await Promise.all(places.chainSlots({kind: 'workcell', name: 'env-1'}).map(kindOf))
  assert.deepEqual(kinds, ['rack', 'connection', 'connection', 'connection'], 'the workcell rack, then the Gateway, the Remote carrier, Git / landing')
  assert.equal(await kindOf('seat'), 'connection')
})

test('the monitors and Messages stand on the rail and in a pane only: a chain asking for their Compact draws why, never a plate (§16.1, §16.3)', async () => {
  for (const id of [main.FRAMES_DESIGN, rec.LEDGER_DESIGN, main.GATEWAYS_RACK_DESIGN, msg.MESSAGES_DESIGN]) {
    const design = await designOf(id)
    assert.deepEqual(host.viewsOf(design), ['widget', 'full'], `${id}: its tile and its Full`)
    assert.equal(design.kind, id === msg.MESSAGES_DESIGN ? 'instrument' : 'monitor', id)
    const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: {id: 'x', values: {}}, view: 'compact', chain: true, nav: {}}))
    assert.match(markup, /data-device-absent="compact"/, `${id}: no chain plate`)
    assert.match(markup, /has no compact view/)
  }
  // The Agency gateway stands in the head of Messages (§19.10): no chain place, no Compact.
  const agency = await designOf(main.AGENCY_GATEWAY_DESIGN)
  assert.equal(host.viewIn(agency, 'compact'), null)
})

test('the chain draws the plan and no other plate: no Gateways rack, Agency gateway, Ledger, Frames or Link on a chain; the workcell\'s chain routed', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /const place = factoryPlace\(\{sessionRef, group: !!groupTrack, workcell\}\)/)
  assert.match(view, /const slots = chainSlots\(place, \{helper: helperStands\}\)/)
  assert.match(view, /\{place\.kind === 'main' && <div className="factory-main" data-track="main"/)
  assert.match(view, /\{place\.kind === 'workcell' && <div className="factory-main factory-workcell" data-track=\{workcellTrackId\(place\.name\)\}/)
  assert.match(view, /\{place\.kind === 'session' && <>\{plates\}\{trailingGap\}<\/>\}/)
  assert.doesNotMatch(view, /<DeviceView device=\{main\.(rack|agency|frames)\}/, 'no monitor and no Agency gateway drawn as a plate')
  assert.doesNotMatch(view, /placed\(LEDGER_ID|placed\(FRAMES_ID|placed\(GATEWAYS_RACK_ID|placed\(AGENCY_GATEWAY_ID|placed\(MESSAGES_ID/, 'no monitor placed on a chain')
  assert.doesNotMatch(view, /LINK_ID|linkBinding|LINK_DESIGN/, 'the Link is the transport\'s: neither placed nor published here')
  assert.match(view, /\{slot\.id === 'git' && placed\(SEAT_ID, cells\.seat, seatDesignBinding/, 'the Seat inside Git / landing (§19.17)')
  assert.match(view, /case 'workcell': return rackEntry\?\.binding \? placed\(WORKCELL_RACK_ID, rackEntry\.device, rackEntry\.binding/, 'the rack as the rail\'s publisher holds it')
  assert.match(view, /case 'remote-carrier': return placed\(CARRIER_ID, cells\.carrier, carrierDesignBinding/)
  assert.match(view, /seatBinding\(\{status: seats\.status === 'answered' \? seats\.value : null[^\n]*\n[^\n]*workcell: cellName/, 'the Seat starts at the workcell\'s seat')
  assert.match(view, /cellName \? workcellGitReading\(seats, cellName, RACK_PROJECT\) : reading/, 'Git / landing reads the workcell\'s seat of the project')
  // Every monitor, Messages and the workcell rack stays published, for the rail and a pane — by the rail's publisher, in every mode
  // (agent-rail-devices.test.mjs mounts it with no chain).
  const rail = read('agent/devices/AgentRailDevices.tsx')
  for (const id of ['MESSAGES_ID', 'GATEWAYS_RACK_ID', 'AGENCY_GATEWAY_ID', 'FRAMES_ID', 'LEDGER_ID', 'WORKCELL_RACK_ID']) assert.match(rail, new RegExp(`publish\\(${id}, `), `${id} is published`)
  assert.match(view, /SEAT_ID, CARRIER_ID\]\) publishDevice\(id, null\)/, 'withdrawn with the chain — never the Link, never the rail\'s')
  const detail = read('agent/AgentShellDeviceDetail.tsx')
  assert.match(detail, /import \{workcellOfTrack\} from '\.\.\/frame\/tracks\/returnTracks'/)
  assert.match(detail, /const workcell = workcellOfTrack\(shell\.selectedTrackId\)/)
  assert.match(detail, /<FactoryDeviceChain sessionRef=\{track\?\.sessionRef \?\? null\} workcell=\{workcell\} \/>/)
})

test('the rail: Messages first, then the monitors and the chain devices\' widgets — each claimed tile draws its device\'s own Widget, bare', () => {
  const claims = read('agent/agentDockTiles.ts').match(/claimRailWidget\('([a-z]+)', ([A-Z_]+)\)/g)
  assert.deepEqual(claims, ["claimRailWidget('messages', MESSAGES_ID)", "claimRailWidget('frames', FRAMES_ID)", "claimRailWidget('ledger', LEDGER_ID)",
    "claimRailWidget('approvals', APPROVALS_ID)", "claimRailWidget('gateways', GATEWAYS_RACK_ID)", "claimRailWidget('workcells', WORKCELL_RACK_ID)"])
  assert.deepEqual(tiles.DEVICE_TILES.map(tile => tile.id), ['messages', 'gateways', 'workcells'], 'the tiles no old tile registered, Messages first')
  // The rail's own list (shell/widgets.tsx): Messages its first device (§19.24), Gateways and the Workcells tile after the old tiles.
  const ids = registry.WIDGETS.map(widget => widget.id)
  assert.equal(ids[0], 'messages', 'Messages first')
  assert.deepEqual(ids.slice(-2), ['gateways', 'workcells'], 'Gateways and Workcells after the old tiles')
  assert.ok(ids.indexOf('approvals') < ids.indexOf('gateways') && ids.indexOf('frames') < ids.indexOf('gateways'), 'after every old tile')
  for (const id of ['messages', 'gateways', 'workcells']) assert.equal(ids.filter(other => other === id).length, 1, `${id} once`)
  bind.resetHolds()
  const holds = bind.chainHolds()
  const devices = {
    messages: [msg.messagesDevice(), msg.messagesBinding({population: {status: 'reading', value: null, error: null}, gateway: model.INITIAL_READING, holds})],
    gateways: [main.mainDevices().rack, main.rackBinding({reading: ANSWERED, holds}, {show() {}})],
    workcells: [rack.workcellRackDevice(), rack.workcellRackBinding({name: null, project: 'O-I', seats: null, chain: {gateway: null, carrier: {}, git: null}, holds}, {gateway: null})],
    frames: [main.mainDevices().frames, main.framesBinding({reading: ANSWERED, harness: {binding: 'cursor', resolved: true}}, holds)],
    ledger: [rec.receiptDevices().ledger, rec.ledgerBinding({ground: null, groundError: null, holds}, {openSession: () => null})],
  }
  for (const [widget, [device, binding]] of Object.entries(devices)) {
    // The rail's own registration of the widget, claimed by its device.
    const registered = registry.WIDGETS.find(entry => entry.id === widget)
    assert.ok(registered, `${widget} is registered on the rail`)
    const claimed = widgets.claimedWidget(registered)
    assert.equal(claimed.bare, true, `${widget}: the device's Tile is the tile`)
    door.publishDevice(device.id, {device, binding})
    try {
      const tile = renderToStaticMarkup(createElement(claimed.Body, {subject: null, pinned: false}))
      assert.match(tile, /data-device-size="widget"/, `${widget}: its device's Widget view`)
      assert.doesNotMatch(tile, /is on no chain now/, `${widget}: its device stands`)
    } finally { door.publishDevice(device.id, null) }
  }
})

test('(b) the monitors placed on the rail: every key their designs read is an owner reading, absent with the read it waits for, or the hand\'s', async () => {
  bind.resetHolds()
  const holds = bind.chainHolds()
  const cases = [
    [main.FRAMES_DESIGN, main.framesBinding({reading: ANSWERED, harness: {binding: 'cursor', resolved: true}}, holds)],
    [rec.LEDGER_DESIGN, rec.ledgerBinding({ground: null, groundError: null, holds}, {openSession: () => null})],
    [main.GATEWAYS_RACK_DESIGN, main.rackBinding({reading: ANSWERED, holds}, {show() {}})],
  ]
  for (const [id, binding] of cases) {
    const design = await designOf(id)
    for (const key of designKeys(design)) assert.ok(classify(binding, key), `${id} ${key}: a reading, absent with why, or the hand's`)
  }
  assert.match(cases[0][1].standing.frames.disabled, /frame-ring read/)
  assert.match(cases[1][1].standing.spend.disabled, /usage/)
  assert.match(cases[2][1].standing.peers.disabled, /missing op/)
  assert.equal(classify(cases[2][1], 'show'), 'local', 'Gateways\' Show is the hand\'s')
})

test('the Device side\'s head says what the chain now holds (shell/modeDetails.tsx)', () => {
  const details = read('shell/modeDetails.tsx')
  assert.match(details, /if \(!track\) return \{name: 'Main', line: 'Factory\\'s Main track: the Experiment and Approvals'\}/)
  assert.match(details, /'the agent\\'s chain: agent → skills → scope'/)
  assert.doesNotMatch(details, /gateway → agent → skills → world → git|the Ledger, Approvals and the Link/)
})

test('the workcell rack and Messages are their families\' own faces: designKey(family, face.id) is the catalogue id by the family\'s declaration', () => {
  const workcell = inhabitantManifest('workcell')?.faces.find(face => face.id === 'workcell')
  assert.equal(workcell?.liveSemantic, 'rack')
  assert.deepEqual(workcell?.invariant?.chains, ['gateway', 'remote-carrier', 'git-seat'])
  const messages = inhabitantManifest('ai-kit')?.faces.find(face => face.id === 'messages')
  assert.equal(messages?.liveSemantic, 'device-instrument')
  assert.match(messages?.invariant?.generatesAbsent ?? '', /aikit gateway send/)
  for (const [device, id] of [[rack.workcellRackDevice(), 'workcell:workcell'], [msg.messagesDevice(), 'ai-kit:messages']]) {
    assert.ok(device, `${id}: the family admits the face`)
    assert.equal(designKey(device.family, device.face.id), id)
  }
  for (const file of ['agent/devices/workcellRackBinding.ts', 'agent/devices/messagesBinding.ts']) {
    assert.match(read(file), /return familyFaceDevice\(/, `${file}: built from the family's admitted face, not by hand`)
  }
})

test('the Device side\'s head for a workcell\'s return track names the workcell and its chain (shell/modeDetails.tsx)', () => {
  const details = read('shell/modeDetails.tsx')
  assert.match(details, /const cell = workcellOfTrack\(trackId\)\n\s+if \(cell\) return \{name: cell, line: 'the workcell\\'s chain: Gateway → Remote carrier → Git \/ landing, with its Seat'\}\n[^\n]*\n[^\n]*\n[^\n]*\n\s+if \(!track\)/,
    'before the Main track\'s line')
})
