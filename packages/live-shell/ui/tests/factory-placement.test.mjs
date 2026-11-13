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
const {design: workcellDesign} = await import('../src/inhabitants/catalogue/panels/workcell__workcell.tsx')
const {design: gitDesign} = await import('../src/inhabitants/catalogue/panels/workcell__git-seat.tsx')
const {GATEWAYS_PAGE, SEAT_PAGE, carryPages} = await import('../src/agent/devices/oneAgentBinding.ts')
const {RUN_MAP_ID} = await import('../src/agent/devices/runMapBinding.ts')
const {PROMPT_PADS_ID} = await import('../src/agent/devices/promptPadsBinding.ts')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const designOf = async id => [skills, memberDevice, scope].find(design => design.id === id)
  ?? (await import(`../src/inhabitants/catalogue/panels/${id.replace(':', '__')}.tsx`)).design
const kindOf = async slot => (await designOf(places.SLOT_DEVICE[slot].design)).kind
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent' : null
const ANSWERED = {...model.INITIAL_READING, gatewayAdmitted: true, gatewayDoc: {state: 'ready', transport: 'ws', connect: true, stall_after_seconds: 90}}

test('a session\'s chain is §16.2\'s Factory row, a group\'s and a lone session\'s alike: the connections, the Agent rack, Scope, Git / landing', () => {
  const session = places.factoryPlace({sessionRef: 'ses-1', group: false, workcell: null})
  assert.deepEqual(session, {kind: 'session', group: false})
  // REPLACED (O-I #842): "a session's chain is Agent, skills rack, scope" (['agent', 'skillset', 'world']) and "a group's leads with the
  // Agentset rack" (GROUP_LEAD, ['agentset', 'agent', 'skillset', 'world']), "no gateway, no landing" (§19.23 "A track has no gateway and no
  // landing of its own", gone from the manual). Every session holds one Agent rack (§19.15 "A session of one agent has a rack of that one
  // chain") between its connections and Scope, then Git / landing (§16.2 Factory row; §16.1 Connection "On a track's chain or inside an
  // agent's"); the session's own agent's devices stand inside the rack (agent-rack-842.test.mjs).
  // REPLACED (DLW build ruling 2026-11-05; §19.9 "Chain: before the Agent … ahead of the Agent rack for every agent, or inside one agent's
  // chain"): "Sources has no binding yet", so not placed — Sources stands before the Agent in both places: ahead of the Agent rack, the shared
  // reading every agent of the rack reads; inside the agent's own chain, before what it carries and its Agent, that agent's own.
  assert.deepEqual(places.chainSlots(session), ['gateway', 'remote-carrier', 'sources', 'agentset', 'world', 'git'])
  const group = places.factoryPlace({sessionRef: 'grp-1', group: true, workcell: null})
  assert.deepEqual(places.chainSlots(group), places.chainSlots(session), 'the rack\'s chains differ, never the track\'s')
  assert.deepEqual(places.RACK_CHAIN, ['chain-sources', 'skillset', 'agent'], 'what the agent reads, what it carries, then the Agent (§19.4, §19.9)')
  for (const [slot, id] of [['sources', 'factory:sources'], ['chain-sources', 'factory:chain-sources']]) {
    assert.deepEqual(places.SLOT_DEVICE[slot], {id, design: 'ai-kit:sources'}, `${slot}: AIKit's Sources, drawn by its design`)
  }
  assert.deepEqual(model.SOURCES_DEVICE_IDS, {rack: 'factory:sources', chain: 'factory:chain-sources'})
  for (const id of Object.values(model.SOURCES_DEVICE_IDS)) assert.ok(model.CHAIN_DEVICE_IDS.includes(id), `${id} is withdrawn with the chain`)
  // How far each reaches (§19.9 Rules: "Sources ahead of the Agent rack and Sources inside an agent's chain add up: the agent reads both").
  const chains = [{id: 'ses-1', name: 'Kite'}, {id: 'ses-2', name: 'Wren'}]
  const shared = places.reachOf('sources', chains)
  assert.equal(shared.reaches, 'every-chain')
  assert.match(shared.says, /^The shared reading every chain of the Agent rack reads \(Kite, Wren\); an agent's own Sources adds to it\.$/)
  assert.deepEqual(places.reachOf('chain-sources', chains, 'ses-1'), {reaches: 'chain', chain: 'ses-1', says: 'Kite alone: it stands inside Kite\'s chain of the Agent rack.'})
  // Where a drop of Sources stands: on the agent's own chain where it is dropped there, else ahead of the rack; and the setting AIKit keeps.
  for (const card of ['chain-sources', 'skillset', 'agent']) assert.equal(places.sourcesPlacementOf(card), 'chain', `dropped on ${card}: the agent's own`)
  for (const card of [null, 'gateway', 'world', 'git', 'agentset']) assert.equal(places.sourcesPlacementOf(card), 'rack', `dropped on ${card ?? 'the zone'}: the shared reading`)
  assert.deepEqual(places.sourcesPlaceRequest('chain'), {track: {sources: true}})
  assert.deepEqual(places.sourcesPlaceRequest('rack'), {track: {rack_sources: true}})
  assert.equal('GROUP_LEAD' in places, false)
  // The Decision helper is a chain inside the rack, in place of an Agent (§19.20 "Chain: a chain of an Agent rack, in place of an Agent";
  // decision-helper-binding.test.mjs), so no helper slot stands on the chain.
  assert.ok(!('decision-helper' in places.SLOT_DEVICE), 'no Decision helper slot: it is a chain of the rack')
  // REPLACED (#725): the Knowledge route inside Scope and Capture skill after it — retired into Scope's Knowledge page (§19.9) and the
  // Skillset rack's Capture page (§19.11): neither stands on any chain.
  for (const slot of ['knowledge', 'capture']) assert.ok(!(slot in places.SLOT_DEVICE), `no ${slot} device`)
  assert.equal(places.INSIDE.world, undefined, 'nothing stands inside Scope')
  // REPLACED (O-I #842): "gateway, git and remote-carrier are no session's" — they are, outside the rack; Workcell's instrument still
  // stands on no chain (§19.23).
  for (const chain of [places.chainSlots(session), places.chainSlots(group)]) assert.ok(!chain.includes('workcell'), 'workcell is no session\'s')
  assert.equal(places.INSIDE.skillset, 'member', 'the member inside the Skillset rack (§19.7)')
  assert.equal(places.SLOT_DEVICE.agent.id, model.chainDeviceId('agent'))
})

test('the Main track\'s chain is the Run map, Approvals and the prompt pads — the Gateways, the Ledger and the Link have left it (§16.2, §19.1)', () => {
  const place = places.factoryPlace({sessionRef: null, group: false, workcell: null})
  assert.deepEqual(place, {kind: 'main'})
  // REPLACED (#725): the Experiment, then Approvals — the manual's Main track is "the Run map, Approvals and the prompt pads" (§16.2; §19.1 The
  // Main track), and an experiment is a task launched with Repeat, its takes set side by side with Compare (§19.5), no device of its own.
  assert.deepEqual(places.chainSlots(place, {runMap: true, pads: true}), ['run-map', 'approvals', 'prompt-pads'])
  assert.deepEqual(places.chainSlots(place), ['approvals'], 'the Run map and the pads stand where their devices do')
  assert.deepEqual([places.SLOT_DEVICE['run-map'].id, places.SLOT_DEVICE.approvals.id, places.SLOT_DEVICE['prompt-pads'].id], [RUN_MAP_ID, rec.APPROVALS_ID, PROMPT_PADS_ID])
  assert.ok(!('experiment' in places.SLOT_DEVICE), 'no Experiment device')
})

test('a workcell\'s chain is the Gateway, the Remote carrier and Git / landing with its Seat page (§16.2, §19.23)', () => {
  const place = places.factoryPlace({sessionRef: 'ses-1', group: false, workcell: 'env-2'})
  assert.deepEqual(place, {kind: 'workcell', name: 'env-2'}, 'a selected workcell\'s return track wins')
  // REPLACED (§19.23 "It stands on no chain"; §16.2 "Connections keep the same order"): the rack first — Workcell's instrument stands on no
  // chain, so the road is the three connections.
  assert.deepEqual(places.chainSlots(place), ['gateway', 'remote-carrier', 'git'])
  // REPLACED (#725): the Seat inside Git / landing as a device of its own — the Seat is Git / landing's Seat page (§19.17), its keys under
  // `seat.` on Git / landing's own device, so nothing stands inside the git slot.
  assert.equal(places.INSIDE.git, undefined)
  assert.equal(SEAT_PAGE.prefix, 'seat.')
  assert.ok(Object.keys(gitDesign.defaults).some(key => key.startsWith(SEAT_PAGE.prefix)), 'Git / landing\'s design draws the Seat group')
  assert.deepEqual([places.SLOT_DEVICE['remote-carrier'].id, places.SLOT_DEVICE.git.id], [cell.CARRIER_ID, cell.GIT_ID])
  assert.ok(!('workcell' in places.SLOT_DEVICE), 'Workcell\'s instrument has no slot: it stands on no chain')
  assert.ok(!('seat' in places.SLOT_DEVICE), 'no Seat device')
})

test('no monitor stands on a chain; connections stand before and after a session\'s rack, never on the Main track\'s; a workcell\'s chain is its connections (§16.1)', async () => {
  // REPLACED (O-I #842): "no connection stands on a session's chain" — §16.1's Connection now stands "On a track's chain or inside an
  // agent's: Gateway and Remote carrier before the agents they bring in, Git / landing after the work it lands".
  for (const place of [{kind: 'session', group: true}, {kind: 'session', group: false}, {kind: 'main'}]) {
    const slots = places.chainSlots(place, {runMap: true, pads: true}), kinds = await Promise.all(slots.map(kindOf))
    for (const [at, kind] of kinds.entries()) assert.ok(kind !== 'monitor', `${place.kind}: ${slots[at]} is a monitor`)
    if (place.kind === 'main') { assert.ok(!kinds.includes('connection'), 'the Main track carries no connection'); continue }
    const rack = slots.indexOf('agentset')
    // REPLACED (DLW build ruling 2026-11-05; §19.9 "Kind: effect"): the two connections alone before the rack — Sources, an effect, stands
    // between them and the rack, before the Agent.
    assert.deepEqual(kinds.slice(0, rack), ['connection', 'connection', 'effect'], 'the Gateway and the Remote carrier, before the agents they bring in, then their Sources')
    assert.equal(kinds.at(-1), 'connection', 'Git / landing, after the work it lands')
  }
  assert.equal(await kindOf('member'), 'effect')
  const kinds = await Promise.all(places.chainSlots({kind: 'workcell', name: 'env-1'}).map(kindOf))
  // REPLACED (§19.23, 22 Oct manual): "Kind: rack" — Workcell's is an instrument ("Kind: instrument"); its slot is still factoryPlaces.ts's.
  // REPLACED (§19.23 "It stands on no chain"): the instrument first — the chain is the three connections.
  assert.deepEqual(kinds, ['connection', 'connection', 'connection'], 'the Gateway, the Remote carrier, Git / landing')
  // REPLACED (#725): the Seat, a connection — it is Git / landing's Seat page now (§19.17), and Git / landing is the connection that carries it.
  assert.equal(await kindOf('git'), 'connection')
})

test('the monitors and Messages stand on the rail and in a pane only: a chain asking for their Compact draws why, never a plate (§16.1, §16.3)', async () => {
  // REPLACED (#725): the Frames monitor and Gateways among them — both retired in the 22 Oct manual rewrite: the frames are the Gateway's
  // Frames page and its Full, its tile on the rail the Gateway's widget (§19.6), and the gateways are listed on the Workcells tile (§19.3).
  // The rail's Frames is therefore the Gateway's design, a connection that has its tile and its Full (below); the Ledger and Messages keep
  // only their tile and their Full.
  for (const id of [rec.LEDGER_DESIGN, msg.MESSAGES_DESIGN]) {
    const design = await designOf(id)
    assert.deepEqual(host.viewsOf(design), ['widget', 'full'], `${id}: its tile and its Full`)
    assert.equal(design.kind, id === msg.MESSAGES_DESIGN ? 'instrument' : 'monitor', id)
    const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: {id: 'x', values: {}}, view: 'compact', chain: true, nav: {}}))
    assert.match(markup, /data-device-absent="compact"/, `${id}: no chain plate`)
    assert.match(markup, /has no compact view/)
  }
  assert.equal(main.FRAMES_DESIGN, 'actuation:gateway', 'the rail\'s Frames is drawn by the Gateway\'s design')
  const gateway = await designOf(main.FRAMES_DESIGN)
  assert.equal(gateway.kind, 'connection')
  for (const view of ['widget', 'full']) assert.ok(host.viewsOf(gateway).includes(view), `the Gateway's ${view}: the rail's Frames tile and its Frames page at pane size`)
  // REPLACED (#725): the Agency gateway's own design, with no Compact — it is the Gateway's agency build, whose mark stands in the head of
  // Messages (§19.10): Messages reads it on its own `gateway` key, and Messages has no Compact.
  const messages = await designOf(msg.MESSAGES_DESIGN)
  assert.ok('gateway' in messages.defaults, 'Messages draws the agency gateway\'s mark in its head')
  assert.equal(host.viewIn(messages, 'compact'), null)
})

test('the chain draws the plan and no other plate: no Gateways rack, Agency gateway, Ledger, Frames or Link on a chain; the workcell\'s chain routed', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /const place = factoryPlace\(\{sessionRef, group: !!groupTrack, workcell\}\)/)
  assert.match(view, /const slots = chainSlots\(place, \{runMap: !!runMapDev, pads: !!padsDev\}\)/)
  assert.match(view, /\{place\.kind === 'main' && <div className="factory-main" data-track="main"/)
  assert.match(view, /\{place\.kind === 'workcell' && <div className="factory-main factory-workcell" data-track=\{workcellTrackId\(place\.name\)\}/)
  assert.match(view, /\{place\.kind === 'session' && <>\{plates\}\{trailingGap\}<\/>\}/)
  assert.doesNotMatch(view, /<DeviceView device=\{main\.(rack|agency|frames)\}/, 'no monitor and no Agency gateway drawn as a plate')
  assert.doesNotMatch(view, /placed\(LEDGER_ID|placed\(FRAMES_ID|placed\(GATEWAYS_RACK_ID|placed\(AGENCY_GATEWAY_ID|placed\(MESSAGES_ID/, 'no monitor placed on a chain')
  assert.doesNotMatch(view, /LINK_ID|linkBinding|LINK_DESIGN/, 'the Link is the transport\'s: neither placed nor published here')
  // REPLACED (#725): the Seat placed inside Git / landing — Git / landing carries it (§19.17). REPLACED (§19.16, 22 Oct manual): its Seat
  // and Checkouts pages left: the seat is its Seat group, the checkouts the Seats page of Workcell's instrument (the rail's, below).
  assert.match(view, /carryPages\(gitDesignBinding, \[\{page: SEAT_PAGE, binding: seatDesignBinding\}\]\)/, 'the Seat group of Git / landing (§19.16, §19.17)')
  assert.doesNotMatch(view, /placed\(SEAT_ID|placed\(KNOWLEDGE_ROUTE_ID|placed\(CAPTURE_SKILL_ID|placed\(DECISION_HELPER_ID|placed\(EXPERIMENT_ID|main\.experiment/, 'no retired device placed')
  // REPLACED (§19.23 "It stands on no chain"; §16.3 "Its window holds its Full"): the rack placed as the rail's publisher holds it — the
  // instrument is drawn in a pane and on the rail, never as a plate.
  assert.doesNotMatch(view, /case 'workcell'|placed\(WORKCELL_RACK_ID/, 'Workcell\'s instrument is placed on no chain')
  assert.match(view, /case 'remote-carrier': return placed\(CARRIER_ID, cells\.carrier, carrierDesignBinding/)
  assert.match(view, /seatBinding\(\{status: seats\.status === 'answered' \? seats\.value : null[^\n]*\n[^\n]*workcell: cellName/, 'the Seat starts at the workcell\'s seat')
  // REPLACED (O-I #740 lane B): the seat of RACK_PROJECT ('O-I'); the chain's register now — the session's own, else the root (worldScope.ts).
  assert.match(view, /cellName \? workcellGitReading\(seats, cellName, rackProject\) : reading/, 'Git / landing reads the workcell\'s seat of the chain\'s project')
  // Every monitor, Messages and the workcell rack stays published, for the rail and a pane — by the rail's publisher, in every mode
  // (agent-rail-devices.test.mjs mounts it with no chain).
  const rail = read('agent/devices/AgentRailDevices.tsx')
  // REPLACED (#725): Gateways and the Agency gateway published — both retired (§19.3, §19.10): the Workcells tile carries the gateways'
  // binding under `gw.`, and Messages reads the agency gateway's answer itself.
  for (const id of ['MESSAGES_ID', 'FRAMES_ID', 'LEDGER_ID', 'WORKCELL_RACK_ID']) assert.match(rail, new RegExp(`publish\\(${id}, `), `${id} is published`)
  for (const id of ['GATEWAYS_RACK_ID', 'AGENCY_GATEWAY_ID']) assert.doesNotMatch(rail, new RegExp(`publish\\(${id}, `), `${id} is not published`)
  // REPLACED (#772): the tile carries the gateways first, then the Left behind page (left., DLW §19.23 "What a run leaves behind").
  // REPLACED (§19.23, 22 Oct manual): then the Seats page (seat., co.) and the Machine page (carrier., mc.).
  assert.match(rail, /carryPages\(ownWorkcell, \[\{page: GATEWAYS_PAGE, binding: gateways\}, \{page: LEFT_BEHIND_PAGE, binding: leftBehind\},\s*\{page: SEAT_PAGE, binding: seat\}, \{page: CHECKOUTS_PAGE, binding: leftBehind\}, \{page: CARRIER_PAGE, binding: carrierPlan\}, \{page: MACHINE_PAGE, binding: machine\}\]\)/,
    'the Workcells tile carries the gateways')
  // REPLACED (#804): "SEAT_ID, CARRIER_ID, RUN_MAP_ID, PROMPT_PADS_ID withdrawn" — the chain withdraws only what it publishes: the Seat is
  // Git / landing's Seat page (§19.17), and nothing publishes its id (t804-retired-carries-answer-face.test.mjs).
  // The Decision helper is published beside a group's rack (§19.20, a chain of the rack), so it is withdrawn with the chain.
  // REPLACED (parity D-09): Approvals is the rail's publisher's in every mode (AgentRailDevices.tsx), so the chain withdraws it no more.
  assert.match(view, /AGENTSET_ID, DECISION_HELPER_ID, CARRIER_ID, RUN_MAP_ID, PROMPT_PADS_ID\]\) publishDevice\(id, null\)/, 'withdrawn with the chain — never the Link, never the rail\'s')
  assert.doesNotMatch(view, /SEAT_ID[^\n]*publishDevice\(id, null\)/, 'no retired Seat cleared')
  const detail = read('agent/AgentShellDeviceDetail.tsx')
  assert.match(detail, /import \{workcellOfTrack\} from '\.\.\/frame\/tracks\/returnTracks'/)
  assert.match(detail, /const workcell = workcellOfTrack\(shell\.selectedTrackId\)/)
  assert.match(detail, /<FactoryDeviceChain sessionRef=\{track\?\.sessionRef \?\? null\} workcell=\{workcell\} \/>/)
})

test('the rail: Messages first, then the monitors and the chain devices\' widgets — each claimed tile draws its device\'s own Widget, bare', () => {
  const claims = read('agent/agentDockTiles.ts').match(/claimRailWidget\('([a-z]+)', ([A-Z_]+)\)/g)
  // REPLACED (#725): the Gateways tile claimed for the Gateways monitor — retired into the Workcells tile (§19.3 "Every gateway your machines
  // reach, with its state, is listed on the Workcells tile"); the rail's Frames is the Gateway's widget (§19.6).
  assert.deepEqual(claims, ["claimRailWidget('messages', MESSAGES_ID)", "claimRailWidget('frames', FRAMES_ID)", "claimRailWidget('ledger', LEDGER_ID)",
    "claimRailWidget('approvals', APPROVALS_ID)", "claimRailWidget('workcells', WORKCELL_RACK_ID)"])
  assert.deepEqual(tiles.DEVICE_TILES.map(tile => tile.id), ['messages', 'workcells'], 'the tiles no old tile registered, Messages first')
  // The rail's own list (shell/widgets.tsx): Messages its first device (§19.24), the Workcells tile after the old tiles.
  const ids = registry.WIDGETS.map(widget => widget.id)
  assert.equal(ids[0], 'messages', 'Messages first')
  assert.deepEqual(ids.slice(-1), ['workcells'], 'Workcells after the old tiles')
  assert.ok(ids.indexOf('approvals') < ids.indexOf('workcells') && ids.indexOf('frames') < ids.indexOf('workcells'), 'after every old tile')
  assert.ok(!ids.includes('gateways'), 'no Gateways tile')
  for (const id of ['messages', 'workcells']) assert.equal(ids.filter(other => other === id).length, 1, `${id} once`)
  bind.resetHolds()
  const holds = bind.chainHolds()
  // The Workcells tile on the rack's binding carrying the gateways' under `gw.` (AgentRailDevices.tsx), as the rail publishes it.
  const workcellsBinding = carryPages(rack.workcellRackBinding({name: null, project: 'O-I', seats: null, chain: {gateway: null, carrier: {}, git: null}, holds}, {}),
    [{page: GATEWAYS_PAGE, binding: main.rackBinding({reading: ANSWERED, holds}, {show() {}})}])
  const devices = {
    messages: [msg.messagesDevice(), msg.messagesBinding({population: {status: 'reading', value: null, error: null}, gateway: model.INITIAL_READING, holds})],
    workcells: [rack.workcellRackDevice(), workcellsBinding],
    frames: [main.mainDevices().frames, main.framesBinding({reading: ANSWERED, harness: {binding: 'cursor', resolved: true}}, holds)],
    ledger: [rec.receiptDevices().ledger, rec.ledgerBinding({ground: null, groundError: null, holds}, {openSession: () => null})],
  }
  // The Workcells tile's design draws the gateways it carries: the first two by name, the rest counted (workcell__workcell.tsx TileGateways).
  const tileMarkup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: workcellDesign, binding: workcellsBinding, view: 'widget', nav: {}}))
  const chains = JSON.parse(workcellsBinding.values['gw.chains'])
  for (const chain of chains.slice(0, 2)) assert.ok(tileMarkup.includes(chain.name), `the Workcells tile lists ${chain.name}`)
  if (chains.length > 2) assert.ok(tileMarkup.includes(`+${chains.length - 2}`), 'and counts the rest')
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
    ['workcell:workcell gw.', main.rackBinding({reading: ANSWERED, holds}, {show() {}})],
  ]
  // REPLACED (#725): every key of the Frames monitor's design — retired into the Gateway's Frames page (§19.6, §19.2 Frames): every key that
  // page reads (actuation__gateway.tsx: the settings the shell holds and the frames the owner reports) is the frames' binding's to classify.
  const FRAMES_PAGE = ['session', 'direction', 'kinds', 'follow', 'pause', 'keep', 'frames', 'epoch', 'seq', 'ring', 'ringCap', 'lead']
  const gatewayKeys = designKeys(await designOf(main.FRAMES_DESIGN))
  for (const key of FRAMES_PAGE) {
    assert.ok(gatewayKeys.includes(key), `${key} is a key of the Gateway's Frames page`)
    assert.ok(classify(cases[0][1], key), `actuation:gateway (Frames) ${key}: a reading, absent with why, or the hand's`)
  }
  assert.ok(classify(cases[1][1], 'spend') !== null)
  for (const key of designKeys(await designOf(rec.LEDGER_DESIGN))) assert.ok(classify(cases[1][1], key), `${rec.LEDGER_DESIGN} ${key}: a reading, absent with why, or the hand's`)
  // REPLACED (#725): every key of the Gateways monitor's design — retired into the Workcells tile (§19.3), whose gateways stand under `gw.`
  // (workcell__workcell.tsx): every such key, without its prefix, is the gateways' binding's to classify.
  const gw = designKeys(workcellDesign).filter(key => key.startsWith(GATEWAYS_PAGE.prefix)).map(key => key.slice(GATEWAYS_PAGE.prefix.length))
  assert.ok(gw.length > 0, 'the Workcells tile reads the gateways under gw.')
  for (const key of gw) assert.ok(classify(cases[2][1], key), `workcell:workcell gw.${key}: a reading, absent with why, or the hand's`)
  // REPLACED (lane W6): the frames are AIKit's own gateway journal's (w3-factory-bindings.test.mjs); with none read, the standing says so.
  assert.match(cases[0][1].standing.frames.disabled, /AIKit's gateway journal is not read here/)
  assert.match(cases[1][1].standing.spend.disabled, /usage/)
  assert.match(cases[2][1].standing.peers.disabled, /missing op/)
  assert.equal(classify(cases[2][1], 'show'), 'local', 'the gateways\' Show is the hand\'s')
})

test('the Device side\'s head says what the chain now holds (shell/modeDetails.tsx)', () => {
  const details = read('shell/modeDetails.tsx')
  // REPLACED (#725): the Experiment and Approvals — the Main track is the Run map, Approvals and the prompt pads (§16.2, §19.1; §19.5).
  assert.match(details, /if \(!track\) return \{name: 'Main', line: 'Factory\\'s Main track: the Run map, Approvals and the prompt pads'\}/)
  // REPLACED (O-I #842): "the agent's chain: agent → skills → scope", and a group's "the Agentset rack and the Decision helper, then the
  // chain" — every session's head names §16.2's Factory row (agent-rack-842.test.mjs).
  assert.match(details, /'the session\\'s chain: Gateway → Remote carrier → the Agent rack → Scope → Git \/ landing'/)
  assert.doesNotMatch(details, /gateway → agent → skills → world → git|the Ledger, Approvals and the Link/)
})

test('the workcell rack and Messages are their families\' own faces: designKey(family, face.id) is the catalogue id by the family\'s declaration', () => {
  const workcell = inhabitantManifest('workcell')?.faces.find(face => face.id === 'workcell')
  // REPLACED (§19.23 "Kind: instrument · Pane: born in a pane"; §16.3 "an instrument born there | Widget and Full"): 'rack' — the face is a
  // device instrument; and its chains (the Gateway, the Remote carrier, Git / landing) — "It stands on no chain".
  assert.equal(workcell?.liveSemantic, 'device-instrument')
  assert.equal(workcell?.invariant?.chains, undefined, 'Workcell\'s instrument stands on no chain')
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
