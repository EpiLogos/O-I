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

test('a session\'s chain is Agent, skills rack, scope; a group\'s leads with the Agentset rack — no gateway, no landing (§16.2, §19.23)', () => {
  const session = places.factoryPlace({sessionRef: 'ses-1', group: false, workcell: null})
  assert.deepEqual(session, {kind: 'session', group: false})
  assert.deepEqual(places.chainSlots(session), ['agent', 'skillset', 'world'])
  const group = places.factoryPlace({sessionRef: 'grp-1', group: true, workcell: null})
  // REPLACED (#725): the Agentset rack, then the Decision helper where its device stands — the Decision helper was retired into the Agentset
  // rack's Helper page (§19.20 "A decision helper is an agent of type Settle in a team's Agentset rack, on the rack's Helper page"), so a
  // group's chain is led by the rack alone, and no helper slot stands.
  assert.deepEqual(places.chainSlots(group), ['agentset', 'agent', 'skillset', 'world'])
  assert.deepEqual(places.GROUP_LEAD, ['agentset'])
  assert.ok(!('decision-helper' in places.SLOT_DEVICE), 'no Decision helper device')
  // REPLACED (#725): the Knowledge route inside Scope and Capture skill after it — retired into Scope's Knowledge page (§19.9) and the
  // Skillset rack's Capture page (§19.11): neither stands on any chain.
  for (const slot of ['knowledge', 'capture']) assert.ok(!(slot in places.SLOT_DEVICE), `no ${slot} device`)
  assert.equal(places.INSIDE.world, undefined, 'nothing stands inside Scope')
  for (const chain of [places.chainSlots(session), places.chainSlots(group)]) for (const slot of ['gateway', 'git', 'remote-carrier', 'workcell']) assert.ok(!chain.includes(slot), `${slot} is no session's`)
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

test('a workcell\'s chain is its rack, the Gateway, the Remote carrier and Git / landing with its Seat page (§16.2, §19.23)', () => {
  const place = places.factoryPlace({sessionRef: 'ses-1', group: false, workcell: 'env-2'})
  assert.deepEqual(place, {kind: 'workcell', name: 'env-2'}, 'a selected workcell\'s return track wins')
  assert.deepEqual(places.chainSlots(place), ['workcell', 'gateway', 'remote-carrier', 'git'])
  // REPLACED (#725): the Seat inside Git / landing as a device of its own — the Seat is Git / landing's Seat page (§19.17), its keys under
  // `seat.` on Git / landing's own device, so nothing stands inside the git slot.
  assert.equal(places.INSIDE.git, undefined)
  assert.equal(SEAT_PAGE.prefix, 'seat.')
  assert.ok(Object.keys(gitDesign.defaults).some(key => key.startsWith(SEAT_PAGE.prefix)), 'Git / landing\'s design draws the Seat page')
  assert.deepEqual([places.SLOT_DEVICE.workcell.id, places.SLOT_DEVICE['remote-carrier'].id, places.SLOT_DEVICE.git.id],
    [rack.WORKCELL_RACK_ID, cell.CARRIER_ID, cell.GIT_ID])
  assert.ok(!('seat' in places.SLOT_DEVICE), 'no Seat device')
})

test('no monitor and no connection stands on a session\'s or the Main track\'s chain; a workcell\'s chain is its rack and its connections (§16.1)', async () => {
  for (const place of [{kind: 'session', group: true}, {kind: 'main'}]) {
    for (const slot of places.chainSlots(place, {runMap: true, pads: true})) {
      const kind = await kindOf(slot)
      assert.ok(kind !== 'monitor' && kind !== 'connection', `${place.kind}: ${slot} is a ${kind}`)
    }
  }
  assert.equal(await kindOf('member'), 'effect')
  const kinds = await Promise.all(places.chainSlots({kind: 'workcell', name: 'env-1'}).map(kindOf))
  assert.deepEqual(kinds, ['rack', 'connection', 'connection', 'connection'], 'the workcell rack, then the Gateway, the Remote carrier, Git / landing')
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
  // REPLACED (#725): the Seat placed inside Git / landing — Git / landing carries it as its Seat page (§19.17), and its Checkouts page on a
  // workcell's chain (§19.16).
  assert.match(view, /carryPages\(gitDesignBinding, \[\{page: SEAT_PAGE, binding: seatDesignBinding\}, \.\.\.\(cellName != null \? \[\{page: CHECKOUTS_PAGE, binding: checkouts\}\] : \[\]\)\]\)/,
    'the Seat and Checkouts pages of Git / landing (§19.16, §19.17)')
  assert.doesNotMatch(view, /placed\(SEAT_ID|placed\(KNOWLEDGE_ROUTE_ID|placed\(CAPTURE_SKILL_ID|placed\(DECISION_HELPER_ID|placed\(EXPERIMENT_ID|main\.experiment/, 'no retired device placed')
  assert.match(view, /case 'workcell': return rackEntry\?\.binding \? placed\(WORKCELL_RACK_ID, rackEntry\.device, rackEntry\.binding/, 'the rack as the rail\'s publisher holds it')
  assert.match(view, /case 'remote-carrier': return placed\(CARRIER_ID, cells\.carrier, carrierCarrying/)
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
  assert.match(rail, /carryPages\(ownWorkcell, \[\{page: GATEWAYS_PAGE, binding: gateways\}, \{page: LEFT_BEHIND_PAGE, binding: leftBehind\}\]\)/, 'the Workcells tile carries the gateways')
  // REPLACED (#804): "SEAT_ID, CARRIER_ID, RUN_MAP_ID, PROMPT_PADS_ID withdrawn" — the chain withdraws only what it publishes: the Seat is
  // Git / landing's Seat page (§19.17), and nothing publishes its id (t804-retired-carries-answer-face.test.mjs).
  assert.match(view, /AGENTSET_ID, APPROVALS_ID, CARRIER_ID, RUN_MAP_ID, PROMPT_PADS_ID\]\) publishDevice\(id, null\)/, 'withdrawn with the chain — never the Link, never the rail\'s')
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
  const workcellsBinding = carryPages(rack.workcellRackBinding({name: null, project: 'O-I', seats: null, chain: {gateway: null, carrier: {}, git: null}, holds}, {gateway: null}),
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
