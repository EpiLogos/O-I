// Lane BF3: Workcell's devices on Factory's chains (src/agent/devices/workcellBindings.ts, FactoryDeviceChain.tsx) — Git / landing
// (workcell:git-seat, DLW §19.16), the Seat (workcell:seat, §19.20, inside Git / landing), the Remote carrier (workcell:remote-carrier,
// §19.21, the Gateways rack's fourth chain) and the Link (workcell:link, §19.22, the Main track).
//
// Channels:
// - REAL (tests/fixtures/workcell-readings-2026-10-16.json): `seat status --json`, `workcell status --json` and `aikit gateway who
//   --project-world project:O-I --json` as read on workcell:mac on 16 Oct, read-only. The Seat is proved on the instrument's own reading here, because no kernel op runs it in the shell.
// - FIXTURE: the chain's git reading (agentChainDevices.ts AgentChainReading shape) and a refused Workcell read.
// - SCRIPTED: the four catalogue designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
// No owner state is written: every write here is refused by the binding before any port is reached.
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
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const main = await import('../src/agent/devices/mainTrackBindings.ts')
const cell = await import('../src/agent/devices/workcellBindings.ts')
const {design: gitDesign} = await import('../src/inhabitants/catalogue/panels/workcell__git-seat.tsx')
const {design: seatDesign} = await import('../src/inhabitants/catalogue/panels/workcell__seat.tsx')
const {design: carrierDesign} = await import('../src/inhabitants/catalogue/panels/workcell__remote-carrier.tsx')
const {design: linkDesign} = await import('../src/inhabitants/catalogue/panels/workcell__link.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const REAL = JSON.parse(readFileSync(new URL('./fixtures/workcell-readings-2026-10-16.json', import.meta.url), 'utf8'))
const views = ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}})))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const answered = value => ({status: 'answered', value, error: null})

test('the four devices are keyed to their designs exactly, from the Workcell family\'s admitted faces; Git / landing is the chain\'s git slot', () => {
  const devices = cell.workcellDevices()
  for (const [device, design] of [[devices.seat, seatDesign], [devices.carrier, carrierDesign], [devices.link, linkDesign]]) {
    assert.ok(device, `${design.id}: the family admits the face`)
    assert.equal(designKey(device.family, device.face.id), design.id)
  }
  assert.deepEqual(bind.SLOT_DESIGN_FACE.git, {family: 'workcell', faceId: 'git-seat'})
  assert.equal(designKey('workcell', 'git-seat'), gitDesign.id)
  assert.equal(bind.designWaits(gitDesign.id, gitDesign), null, 'the design reads its commits, diff and checks from its values, so it is hosted')
  assert.equal(cell.GIT_ID, model.chainDeviceId('git'))
})

test('Git / landing reads the chain\'s git reading only; every policy and Land stand disabled with the command that does not exist', async () => {
  bind.resetHolds()
  const reading = {...model.INITIAL_READING, gitAdmitted: true, gitRepo: {branch: 'main', uncommitted: 3}}
  const binding = cell.gitBinding(reading, bind.chainHolds())
  assert.deepEqual(binding.values, {light: 'lit', branch: 'main', uncommitted: 3})
  assert.equal(cell.gitValues({...model.INITIAL_READING, gitAdmitted: false, gitRepo: {}}, bind.chainHolds()).light, 'dark')
  assert.deepEqual(cell.gitValues(model.INITIAL_READING, bind.chainHolds()), {}, 'unread: nothing, not even a light')
  for (const key of ['commit-policy', 'push-policy', 'landAs', 'land']) {
    assert.match(binding.standing[key].disabled, /missing op/, key)
    await assert.rejects(() => binding.write([{key, value: true}]), /missing op/)
  }
  assert.match(cell.GIT_REFUSE.land, /seat land \(no such command/)
  binding.local.sel('a/b.ts')
  assert.equal(cell.gitValues(reading, bind.chainHolds()).sel, 'a/b.ts', 'the file shown in the pane is the hand\'s')
  bind.resetHolds()
})

test('the Seat on the instrument\'s own reading: its rows and disk; a free seat\'s leftover zones are no claim; the product and seat start where the reading puts them', () => {
  bind.resetHolds()
  const read = cell.seatReading(REAL.seatStatus)
  assert.ok(read)
  const o = read.seats.find(seat => seat.workcell === 'env-1' && seat.product === 'o-i')
  assert.deepEqual([o.state, o.branch, o.claimedBy, o.dirty, o.untracked, o.ahead, o.behind], ['claimed', 'dlw/build', 'claude-code:dlw-lead', 29, 16, 254, 0])
  assert.match(o.drift, /register pose/)
  assert.equal(o.zones.length, 2, 'a held seat keeps its zones')
  assert.deepEqual(Object.keys(o.zones[0]), ['actor', 'regions', 'since'])
  for (const free of read.seats.filter(seat => seat.state === 'free')) assert.deepEqual(free.zones, [], `${free.workcell}/${free.product}: the instrument still lists zones, and they are no claim`)
  assert.ok(REAL.seatStatus.workcells[0].seats.find(seat => seat.state === 'free').zones.length > 0, 'the real reading does list them')
  const q = read.seats.find(seat => seat.workcell === 'env-2' && seat.product === 'ql-mef')
  assert.equal(q.admissionNote, 'admitted below the soft floor; breach recorded (17.4 GB free < soft 20 GB)')
  assert.deepEqual(read.disk[0], {workcell: 'env-1', freeGb: 38.3, softGb: 20, hardGb: null})
  const values = cell.seatValues({status: REAL.seatStatus, project: 'O-I', branch: 'dlw/build', holds: bind.chainHolds()})
  assert.deepEqual([values.product, values.seat, values.joinAs, values.floor], ['o-i', 'env-1', 'attach', 20], 'the session\'s project, the seat on its branch, Attach, the register\'s floor')
  assert.equal(values.actor, undefined, 'no reading names the session\'s actor ref')
  assert.equal(cell.seatValues({status: REAL.seatStatus, project: 'O-I', branch: 'elsewhere', holds: bind.chainHolds()}).seat, undefined, 'no seat holds the branch and none of o-i is free')
  assert.equal(cell.seatValues({status: REAL.seatStatus, project: 'ql-mef', branch: null, holds: bind.chainHolds()}).seat, 'env-1', 'else the first free seat')
  assert.equal(cell.seatReading({schema: 'something else'}), null)
})

test('the Seat without the instrument\'s reading (the shell: no kernel op runs `seat status`): only the hand\'s settings, and why; Join and Release refused', async () => {
  bind.resetHolds()
  const binding = cell.seatBinding({status: null, project: 'O-I', branch: 'dlw/build', holds: bind.chainHolds()})
  assert.deepEqual(binding.values, {joinAs: 'attach'})
  assert.equal(binding.standing.product.disabled, cell.SEAT_UNREAD)
  assert.equal(binding.standing.seat.disabled, cell.SEAT_UNREAD)
  for (const key of ['join', 'release']) {
    assert.match(binding.standing[key].disabled, /missing op: seat (join|release) through the kernel/)
    await assert.rejects(() => binding.write([{key, value: true}]), /missing op/)
  }
  binding.local.lane('agent/o-i-try')
  binding.local.joinAs('new-lane')
  const after = cell.seatValues({status: REAL.seatStatus, project: 'O-I', branch: null, holds: bind.chainHolds()})
  assert.deepEqual([after.lane, after.joinAs], ['agent/o-i-try', 'new-lane'], 'the join\'s settings are the hand\'s, never sent')
  bind.resetHolds()
})

test('the Remote carrier on `workcell status`: the connections as machines, Composed (connected, never carried), and its chain in the Gateways rack', async () => {
  bind.resetHolds()
  const machines = cell.carrierMachines(REAL.workcellStatus)
  assert.deepEqual(machines, [
    {id: 'omarchy', name: 'workcell:omarchy', endpoint: '100.92.62.101:7777', protocol: 'workcell.control/v1', state: 'composed', expiresAt: null},
    {id: 'omarchy-improvement-lanes', name: 'workcell:omarchy', endpoint: '100.92.62.101:7777', protocol: 'workcell.control/v1', state: 'composed', expiresAt: 1791419267453},
  ])
  const binding = cell.carrierBinding(answered(REAL.workcellStatus), bind.chainHolds())
  assert.equal(binding.values.here, 'workcell:mac')
  assert.equal(binding.values.light, 'dark', 'a composed carrier does not show as live (§19.21 Rules)')
  for (const key of ['where', 'grant', 'credential', 'rtt']) assert.equal(binding.values[key], undefined, `${key}: no reading`)
  assert.match(binding.standing.where.disabled, /missing op: a session carried to another machine/)
  await assert.rejects(() => binding.write([{key: 'where', value: 'connected'}]), /missing op/)
  binding.local.machine('omarchy')
  assert.equal(cell.carrierValues(answered(REAL.workcellStatus), bind.chainHolds()).machine, 'omarchy', 'the machine you read is the hand\'s')
  assert.deepEqual(cell.carrierChainState(answered(REAL.workcellStatus)), {state: 'composed'})
  assert.deepEqual(cell.carrierChainState({status: 'refused', value: null, error: 'workcell status read failed'}), {state: 'refused', why: 'workcell status read failed'})
  assert.deepEqual(cell.carrierChainState({status: 'reading', value: null, error: null}), {})
  const rack = JSON.parse(main.rackValues({reading: model.INITIAL_READING, holds: bind.chainHolds(), carrier: {state: 'composed'}}).chains)
  assert.deepEqual(rack.find(row => row.id === 'remote-carrier'), {id: 'remote-carrier', name: 'Remote carrier', state: 'composed'})
  assert.equal(main.rackValues({reading: model.INITIAL_READING, holds: bind.chainHolds(), carrier: {state: 'composed'}}).light, 'dark')
  assert.equal(JSON.parse(main.rackValues({reading: model.INITIAL_READING, holds: bind.chainHolds()}).chains).find(row => row.id === 'remote-carrier').state, undefined)
  bind.resetHolds()
})

test('the Link on `workcell status` and `gateway who` (the kernel\'s inhabitation_read population): this machine and its occupants, each declared remote with its standing in the owner\'s words; Link, Share and a machine\'s place refused', async () => {
  bind.resetHolds()
  const binding = cell.linkBinding(answered(REAL.workcellStatus), bind.chainHolds(), answered(REAL.population))
  const machines = JSON.parse(binding.values.machines)
  assert.equal(binding.values.here, 'workcell:mac')
  assert.equal(binding.values.link, true, 'a remote is declared, so the link is joined')
  assert.equal(binding.values.light, 'dark', 'no machine in the link answered (omarchy timed out)')
  assert.deepEqual(machines[0], {id: 'workcell:mac', self: true, sessions: [
    {id: 'central:position:control:root:nara', name: 'Nara (M4 domain agent)'},
    {id: 'central:position:project:O-I:aletheia-5', name: 'Aletheia 5 (M5 Epii × S5′ Aletheia)'},
    {id: 'central:position:project:O-I:central-guardian', name: 'Central Product Guardian'},
    {id: 'central:position:project:O-I:factory-guardian', name: 'Software Factory Guardian'},
    {id: 'central:position:project:O-I:workcell-guardian', name: 'Workcell Product Guardian'},
  ]}, 'the occupied Positions on this Workcell; the vacant ones are no session')
  assert.deepEqual(machines[1], {id: 'workcell:omarchy', in: true, state: 'unreachable', why: 'connect gateway at 100.92.62.101:7788: connection timed out'},
    'an unreachable machine reports no sessions, and no endpoint is read (`gateway remote list` has no kernel op)')
  for (const key of ['share', 'threads']) assert.equal(binding.values[key], undefined, `${key}: no reading`)
  for (const machine of machines) for (const key of ['lag', 'clock', 'endpoint', 'seats']) assert.equal(machine[key], undefined, `${machine.id} ${key}: no reading`)
  // The owner's other standings (FIXTURE rows in RemoteSurvey::statuses' own words, ai-kit gateway_contact.rs:663-697).
  const remote = (gateway_ref, detail, status = 'reachable') => ({workcell_ref: 'workcell:omarchy', gateway_ref, status, detail})
  assert.equal(cell.linkState(remote('gateway:omarchy', 'answered from its Workcell\'s Actuation at 100.92.62.101:7788')), 'answered')
  assert.equal(cell.linkState(remote('gateway:omarchy', 'the gateway answered, but its Actuation could not: `hermes status` failed: x')), 'limited')
  assert.equal(cell.linkState(remote(null, 'the gateway at 100.92.62.101:7788 refused the occupancy query (it may predate cross-Workcell occupancy): x')), 'refused')
  assert.equal(cell.linkState(remote(null, 'x', 'something else')), undefined, 'a word the owner does not write is not read')
  const answering = {...REAL.population, remotes: [remote('gateway:omarchy', 'answered from its Workcell\'s Actuation at 100.92.62.101:7788')],
    positions: [...REAL.population.positions, {position_ref: 'central:position:project:O-I:cradle-steward', label: 'Cradle steward', occupancy: {state: 'occupied', workcell_ref: 'workcell:omarchy'}}]}
  const lit = cell.linkValues(answered(REAL.workcellStatus), bind.chainHolds(), answered(answering))
  assert.equal(lit.light, 'lit')
  assert.deepEqual(JSON.parse(lit.machines)[1].sessions, [{id: 'central:position:project:O-I:cradle-steward', name: 'Cradle steward'}], 'an answering machine\'s occupants')
  assert.deepEqual(cell.linkValues(answered(REAL.workcellStatus), bind.chainHolds(), answered({...REAL.population, remotes: []})), {here: 'workcell:mac', link: false,
    machines: JSON.stringify([JSON.parse(binding.values.machines)[0]])}, 'no remote declared: the link is not joined, and nothing lights')
  assert.deepEqual(cell.linkValues({status: 'refused', value: null, error: 'x'}, bind.chainHolds(), answered(REAL.population)).here, 'workcell:mac', 'AIKit names this Workcell too')
  assert.deepEqual(cell.linkValues(answered(REAL.workcellStatus), bind.chainHolds(), {status: 'refused', value: null, error: 'aikit gateway who: x'}), {here: 'workcell:mac'}, 'population refused: no machines')
  assert.deepEqual(cell.linkValues({status: 'refused', value: null, error: 'x'}, bind.chainHolds()), {})
  for (const key of ['link', 'share']) {
    assert.match(binding.standing[key].disabled, /missing op/)
    await assert.rejects(() => binding.write([{key, value: true}]), /missing op/)
  }
  await assert.rejects(() => binding.write([{key: 'in:workcell:omarchy', value: true}]), /missing op: aikit gateway remote add/)
  binding.local.sel('workcell:omarchy')
  assert.equal(cell.linkValues(answered(REAL.workcellStatus), bind.chainHolds()).sel, 'workcell:omarchy', 'the machine open in the pane is the hand\'s')
  bind.resetHolds()
})

test('the four designs draw on their bindings in all five views — no NaN, no undefined, never their fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const git = {...model.INITIAL_READING, gitAdmitted: true, gitRepo: {branch: 'main', uncommitted: 3}}
  const cases = [
    [gitDesign, cell.gitBinding(git, bind.chainHolds()), /fold\/day-close-20261012|933731e|Native CLI/, []],
    [seatDesign, cell.seatBinding({status: REAL.seatStatus, project: 'O-I', branch: 'dlw/build', holds: bind.chainHolds()}), /claude-code:dlw-manual|59f94a3|point-cloud-demo/, [cell.SEAT_REFUSE.release]],
    [seatDesign, cell.seatBinding({status: null, project: 'O-I', branch: null, holds: bind.chainHolds()}), /claude-code:dlw-manual|dlw\/build|point-cloud-demo/, [cell.SEAT_UNREAD]],
    [carrierDesign, cell.carrierBinding(answered(REAL.workcellStatus), bind.chainHolds()), /100\.92\.62\.101:7788|ready-to-carry/, []],
    [linkDesign, cell.linkBinding(answered(REAL.workcellStatus), bind.chainHolds(), answered(REAL.population)), /cradle-steward|claude-code:dlw-conductor|fold\/day-close-20261012/, [cell.LINK_REFUSE.link]],
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
  assert.ok(hosted(seatDesign, cases[1][1]).join('\n').includes('dlw/build'), 'the Seat draws the real seat\'s lane')
  const link = hosted(linkDesign, cases[4][1]).join('\n')
  assert.ok(link.includes('omarchy') && link.includes('connection timed out'), 'the Link draws the real remote and its standing in the owner\'s words')
  cases[4][1].local.sel('workcell:mac')
  const here = hosted(linkDesign, cell.linkBinding(answered(REAL.workcellStatus), bind.chainHolds(), answered(REAL.population))).join('\n')
  assert.ok(here.includes('Central Product Guardian'), 'this machine open in the pane: who runs here')
  bind.resetHolds()
  host.resetHost()
})

test('the chain places them where the manual does: the Seat inside Git / landing, the carrier inside the Gateways rack, the Link on the Main track', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /slot\.id === 'git' && placed\(SEAT_ID, cells\.seat, seatDesignBinding/, 'the Seat stands inside Git / landing (§19.20)')
  assert.match(view, /placed\(CARRIER_ID, cells\.carrier, carrierDesignBinding, [^)]*\{member: true\}\)/, 'the Remote carrier is a member of the rack\'s slot (§19.21)')
  assert.match(view, /placed\(LINK_ID, cells\.link, linkDesignBinding, [^\n]*'data-main-slot': 'link'/, 'the Link on the Main track (§19.22)')
  assert.match(view, /gatewaysRackBinding\(\{reading, holds, carrier\}/, 'the rack\'s fourth chain reads the carrier')
  assert.match(view, /chain === 'remote-carrier' \? CARRIER_ID/, 'choosing that chain shows the carrier whole')
  assert.match(view, /seatBinding\(\{status: null, project: RACK_PROJECT/, 'no kernel op reads the seat instrument in the shell')
  assert.match(view, /linkBinding\(workcell, holds, population\)/, 'the Link reads Workcell\'s status and AIKit\'s population')
  assert.match(read('agent/devices/usePopulationAnswer.ts'), /readPopulation\(transport, project\)/, 'through the cradle\'s own population read (inhabitation_read)')
  for (const file of ['agent/devices/workcellBindings.ts', 'agent/devices/usePopulationAnswer.ts']) {
    assert.doesNotMatch(read(file), /\.defaults\[|\.fixtures|catalogue\/panels\//, `${file}: no design default or fixture`)
    assert.deepEqual(read(file).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
  }
})
