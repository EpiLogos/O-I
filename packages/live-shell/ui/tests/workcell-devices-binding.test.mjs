// Lane BF3: Workcell's devices (src/agent/devices/workcellBindings.ts, FactoryDeviceChain.tsx) — Git / landing (workcell:git-seat, DLW
// §19.16) with its Seat page (§19.17: the Seat, workcell:seat, was retired into it in the 22 Oct manual rewrite, #725; the seat binding is
// carried under `seat.`), the Remote carrier (workcell:remote-carrier, §19.18) — since lane
// W1-Factory on a workcell's chain (workcell-rack-binding.test.mjs, factory-placement.test.mjs) — and the Link (workcell:link, §19.19, the
// transport's).
//
// Channels:
// - REAL (tests/fixtures/workcell-readings-2026-10-16.json): `seat status --json`, `workcell status --json` and `aikit gateway who
//   --project-world project:O-I --json` as read on workcell:mac on 16 Oct, read-only. The Seat is proved on the instrument's own reading here, because no kernel op runs it in the shell.
// - FIXTURE: the chain's git reading (agentChainDevices.ts AgentChainReading shape) and a refused Workcell read.
// - SCRIPTED: the four catalogue designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
// No owner state is written: every write here is refused by the binding before any port is reached, but Git / landing's Land, whose
// port here records the Actions it is asked to run (act-registry.sh runs Workcell's landing Actions themselves).
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
const {SEAT_PAGE, carryPages} = await import('../src/agent/devices/oneAgentBinding.ts')
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

test('the three devices are keyed to their designs exactly, from the Workcell family\'s admitted faces; Git / landing is the chain\'s git slot', () => {
  const devices = cell.workcellDevices()
  // REPLACED (#725): four devices, the Seat among them — the Seat was retired as a device of its own in the 22 Oct manual rewrite (§19.17
  // "Claiming a seat … is the Seat page of Git / landing"): the family admits no Seat face, and Git / landing's design draws the Seat page.
  // REPLACED (ticket 772): "the Seat's constructor answers null" — it is gone: the workcell's devices name no Seat.
  assert.equal('seat' in devices, false, 'no Seat device: no constructor stands')
  assert.ok(Object.keys(gitDesign.defaults).some(key => key.startsWith(SEAT_PAGE.prefix)), 'Git / landing\'s design carries the Seat group\'s keys under seat.')
  for (const [device, design] of [[devices.carrier, carrierDesign], [devices.link, linkDesign]]) {
    assert.ok(device, `${design.id}: the family admits the face`)
    assert.equal(designKey(device.family, device.face.id), design.id)
  }
  assert.deepEqual(bind.SLOT_DESIGN_FACE.git, {family: 'workcell', faceId: 'git-seat'})
  assert.equal(designKey('workcell', 'git-seat'), gitDesign.id)
  assert.equal(bind.designWaits(gitDesign.id, gitDesign), null, 'the design reads its commits, diff and checks from its values, so it is hosted')
  assert.equal(cell.GIT_ID, model.chainDeviceId('git'))
})

test('Git / landing reads the chain\'s git reading; Land runs Workcell\'s landing Actions on the held seat in order, and Commit stands disabled', async () => {
  // REPLACED (O-I 1006): "every policy and Land stand disabled with the command that does not exist" (`workcell-cli git commit|push`, `seat
  // land`). Workcell's own Actions land a seat (workcell.lane.commit, .push and .land, which the kernel's `act` runs): Land runs them in
  // the design's order — the work committed, the lane pushed, the lane landed as Land as says — and waits while Push is Off. Push and Land
  // as are the hand's, from the manual's defaults. No owner commits on a cadence, so Commit stands disabled.
  bind.resetHolds()
  const seat = {workcell: 'env-1', product: 'O-I', held: true}
  const reading = {...model.INITIAL_READING, gitAdmitted: true, gitRepo: {branch: 'dlw/build', uncommitted: 3, ahead: 2, behind: 1}, gitSeat: seat}
  const asked = []
  const ports = {lane: async (action, input) => { asked.push([action, input]); return {} }}
  const binding = cell.gitBinding(reading, bind.chainHolds(), ports)
  assert.deepEqual(binding.values, {light: 'lit', branch: 'dlw/build', uncommitted: 3, ahead: 2, behind: 1, 'push-policy': 'off', landAs: 'draft'})
  assert.equal(cell.gitValues({...model.INITIAL_READING, gitAdmitted: false, gitRepo: {}}, bind.chainHolds()).light, 'dark')
  assert.deepEqual(cell.gitValues(model.INITIAL_READING, bind.chainHolds()), {'push-policy': 'off', landAs: 'draft'}, 'unread: no light and no reading, only the hand\'s settings')
  assert.match(binding.standing['commit-policy'].disabled, /no owner commits on a cadence/)
  await assert.rejects(() => binding.write([{key: 'commit-policy', value: 'per turn'}]), /no owner commits on a cadence/)
  await assert.rejects(() => binding.write([{key: 'branch', value: 'x'}]), /is a reading/)
  assert.equal(binding.standing.land, undefined, 'Land stands for the held seat, its carrier standing')
  // Push Off: Land waits, and no Action is asked.
  await assert.rejects(() => binding.write([{key: 'land', value: true}]), /Push is Off/)
  assert.deepEqual(asked, [])
  // Push On land: the work committed, the lane pushed, then landed as a draft — in that order, on the seat's workcell and product.
  binding.local['push-policy']('on land')
  await binding.write([{key: 'land', value: true}])
  const at = {workcell: 'env-1', product: 'O-I'}
  assert.deepEqual(asked, [
    ['workcell.lane.commit', {...at, message: 'The work of lane dlw/build, committed by Land'}],
    ['workcell.lane.push', at],
    ['workcell.lane.land', {...at, as: 'draft'}],
  ])
  // A clean seat lands with no commit, as Land as says.
  asked.length = 0
  binding.local.landAs('merge')
  await cell.gitBinding({...reading, gitRepo: {...reading.gitRepo, uncommitted: 0}}, bind.chainHolds(), ports).write([{key: 'land', value: true}])
  assert.deepEqual(asked, [['workcell.lane.push', at], ['workcell.lane.land', {...at, as: 'merge'}]])
  // Workcell's refusal is the press's: the steps after it are not asked.
  asked.length = 0
  const refusing = {lane: async action => { asked.push([action]); if (action === 'workcell.lane.push') throw Error('workcell lane push: the project has no remote named origin'); return {} }}
  await assert.rejects(() => cell.gitBinding(reading, bind.chainHolds(), refusing).write([{key: 'land', value: true}]), /no remote named origin/)
  assert.deepEqual(asked, [['workcell.lane.commit'], ['workcell.lane.push']])
  // No carrier, no seat named, a free seat: Land stands disabled in those words, and asks nothing.
  asked.length = 0
  for (const [git, given, why] of [[reading, {}, /carrier is unavailable/], [{...reading, gitSeat: null}, ports, /no seat of the project/],
    [{...reading, gitSeat: {...seat, held: false}}, ports, /seat is free/]]) {
    const standing = cell.gitBinding(git, bind.chainHolds(), given)
    assert.match(standing.standing.land.disabled, why)
    await assert.rejects(() => standing.write([{key: 'land', value: true}]), why)
  }
  assert.deepEqual(asked, [])
  binding.local.sel('a/b.ts')
  assert.equal(cell.gitValues(reading, bind.chainHolds()).sel, 'a/b.ts', 'the file shown in the pane is the hand\'s')
  assert.deepEqual(cell.gitValues(reading, bind.chainHolds())['push-policy'], 'on land', 'Push is the hand\'s hold')
  // The chain's Land is the kernel's `act` with Workcell's Action id (FactoryDeviceChain.tsx): no other path carries it.
  assert.match(read('agent/devices/FactoryDeviceChain.tsx'), /lane: \(action, input\) => ownerRouteWrite\(transport, actOp\(action, input\), LANE_WORDS\[action\]\)/)
  bind.resetHolds()
})

test('Land commits only the lane\'s regions: Workcell\'s "nothing to commit" goes on to push and land, and the device answers what the commit left outside (Workcell#130)', async () => {
  // Workcell's commit takes only the changes inside the lane's claimed regions (every zone's regions on the register seat; the whole seat
  // where no zone names one) and answers `regions` and `left_outside`; with no change inside them it refuses, "nothing to commit: …",
  // naming what lies outside, left as it is. The seat's `uncommitted` counts the whole seat, so Land asks for the commit and, on that
  // refusal, goes on: the lane's commits are pushed and landed, and the other work stays. Any other refusal of the commit stops Land.
  bind.resetHolds()
  host.resetHost()
  const seat = {workcell: 'env-1', product: 'O-I', held: true}
  const reading = {...model.INITIAL_READING, gitAdmitted: true, gitRepo: {branch: 'dlw/build', uncommitted: 4, ahead: 2, behind: 0}, gitSeat: seat}
  cell.gitBinding(reading, bind.chainHolds()).local['push-policy']('on land')
  const asked = []
  const outside = 'nothing to commit: /w/o-i holds no change inside the lane\'s regions (crates/a, docs) on dlw/build; outside them, left as they are: .env.local, README.md'
  const nothingInside = {lane: async (action, input) => {
    asked.push([action, input])
    if (action === 'workcell.lane.commit') throw Error(outside)
    return {route: cell.LANE_WORDS[action], data: {schema: 'workcell.landing/v1', act: action.slice('workcell.lane.'.length)}}
  }}
  await cell.gitBinding(reading, bind.chainHolds(), nothingInside).write([{key: 'land', value: true}])
  const at = {workcell: 'env-1', product: 'O-I'}
  assert.deepEqual(asked.map(([action]) => action), ['workcell.lane.commit', 'workcell.lane.push', 'workcell.lane.land'], 'the push and the landing go on')
  assert.deepEqual(asked.slice(1), [['workcell.lane.push', at], ['workcell.lane.land', {...at, as: 'draft'}]])
  assert.deepEqual(JSON.parse(cell.gitValues(reading, bind.chainHolds()).landed), {said: outside}, 'the device answers in Workcell\'s words')
  let drawn = hosted(gitDesign, cell.gitBinding(reading, bind.chainHolds(), nothingInside))
  assert.ok(drawn[2].includes('left out') && drawn[2].includes(escaped(outside)), 'Whole draws what was left out, in Workcell\'s words')
  assert.ok(drawn[3].includes(escaped(outside)), 'the pane draws it')

  // A commit that took the lane's files answers what it left outside, which the device lists.
  host.resetHost()
  const committing = {lane: async action => ({route: cell.LANE_WORDS[action], data: action === 'workcell.lane.commit'
    ? {schema: 'workcell.landing/v1', act: 'commit', files: 2, regions: ['crates/a', 'docs'], left_outside: ['.env.local', 'README.md']}
    : {schema: 'workcell.landing/v1'}})}
  await cell.gitBinding(reading, bind.chainHolds(), committing).write([{key: 'land', value: true}])
  assert.deepEqual(JSON.parse(cell.gitValues(reading, bind.chainHolds()).landed),
    {committed: 2, regions: ['crates/a', 'docs'], left_outside: ['.env.local', 'README.md']})
  drawn = hosted(gitDesign, cell.gitBinding(reading, bind.chainHolds(), committing))
  assert.ok(drawn[2].includes('2 files'), 'Whole counts the files left out')
  assert.ok(drawn[3].includes('.env.local') && drawn[3].includes('README.md'), 'the pane lists them')
  for (const markup of drawn) assert.doesNotMatch(markup, /\bNaN\b|undefined/)

  // Any other refusal of the commit is the press's: nothing after it is asked.
  asked.length = 0
  const merging = {lane: async action => {
    asked.push(action)
    if (action === 'workcell.lane.commit') throw Error('the seat\'s checkout is in the middle of a merge (MERGE_HEAD): conclude or abort it first')
    return {route: '', data: {}}
  }}
  await assert.rejects(() => cell.gitBinding(reading, bind.chainHolds(), merging).write([{key: 'land', value: true}]), /middle of a merge/)
  assert.deepEqual(asked, ['workcell.lane.commit'])
  bind.resetHolds()
  host.resetHost()
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

test('the Seat without the instrument\'s reading: only the hand\'s settings, and why; with no carrier Join and Release say so', async () => {
  bind.resetHolds()
  const binding = cell.seatBinding({status: null, project: 'O-I', branch: 'dlw/build', holds: bind.chainHolds()})
  assert.deepEqual(binding.values, {joinAs: 'attach'})
  assert.equal(binding.standing.product.disabled, cell.SEAT_UNREAD)
  assert.equal(binding.standing.seat.disabled, cell.SEAT_UNREAD)
  // R4 (lane K1's seat_status_read): a refusal is the owner's words on the Seat's choosers.
  assert.equal(cell.seatBinding({status: null, unread: 'seat status: the register is locked', project: 'O-I', branch: null, holds: bind.chainHolds()}).standing.product.disabled,
    'seat status: the register is locked')
  // REPLACED (lane W3): Join and Release are the seat instrument's Actions through the kernel's act (w3-factory-bindings.test.mjs); with no
  // carrier they say so.
  for (const key of ['join', 'release']) {
    assert.equal(binding.standing[key].disabled, cell.SEAT_REFUSE[key])
    await assert.rejects(() => binding.write([{key, value: true}]), /kernel carrier is unavailable/)
  }
  binding.local.lane('agent/o-i-try')
  binding.local.joinAs('new-lane')
  const after = cell.seatValues({status: REAL.seatStatus, project: 'O-I', branch: null, holds: bind.chainHolds()})
  assert.deepEqual([after.lane, after.joinAs], ['agent/o-i-try', 'new-lane'], 'the join\'s settings are the hand\'s, never sent')
  bind.resetHolds()
})

test('a seat dropped on the chain is the Seat\'s own Join: this machine\'s Workcell only, on the seat and project the Seat names (O-I #743; REAL seat reading, fake port)', async () => {
  bind.resetHolds()
  // The browser's Git row drags this machine's Workcell ref; another machine's, or one unread, joins nothing and says why.
  assert.equal(cell.seatDropRefusal('workcell:mac', 'workcell:mac'), null)
  assert.equal(cell.seatDropRefusal('workcell:omarchy', 'workcell:mac'), 'workcell:omarchy is not this machine\'s Workcell (workcell:mac): the Seat joins a seat of the machine the chain works on.')
  assert.match(cell.seatDropRefusal('workcell:mac', undefined), /has not answered/)
  // The drop presses Join as the button does: the seat instrument is asked once, for the seat on the session's branch, as the desk's actor.
  const asked = []
  const binding = cell.seatBinding({status: REAL.seatStatus, project: 'O-I', branch: 'dlw/build', machineRef: 'workcell:mac', actor: 'person:desk', holds: bind.chainHolds()},
    {seat: async request => { asked.push(request); return {register_written: true} }})
  await binding.write([{key: 'join', value: 1}])
  assert.deepEqual(asked, [{kind: 'join', workcell: 'env-1', product: 'o-i', actor: 'person:desk'}])
  assert.deepEqual([binding.values.seat, binding.values.product], ['env-1', 'o-i'], 'the receipt names the seat and the project joined')
  // With no seat of the project to name, the Seat refuses in its own words and nothing is asked.
  const none = cell.seatBinding({status: REAL.seatStatus, project: 'O-I', branch: 'elsewhere', machineRef: 'workcell:mac', actor: 'person:desk', holds: bind.chainHolds()},
    {seat: async request => { asked.push(request) }})
  await assert.rejects(() => none.write([{key: 'join', value: 1}]), new RegExp(cell.SEAT_CHOOSE.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.equal(asked.length, 1)
  bind.resetHolds()
})

test('the Remote carrier on `workcell status`: the connections as machines, Composed (connected, never carried), and its line among the gateways the Workcells tile lists', async () => {
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
  // REPLACED (#725): its chain in the Gateways rack — the Gateways monitor was retired into the Workcells tile (§19.3 "Every gateway your
  // machines reach, with its state, is listed on the Workcells tile"), which carries the same gateways' reading under `gw.`
  // (AgentRailDevices.tsx); the reading itself is unchanged.
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
    'an unreachable machine reports no sessions; with no remotes reading handed, no endpoint')
  for (const key of ['share', 'threads']) assert.equal(binding.values[key], undefined, `${key}: no reading`)
  for (const machine of machines) for (const key of ['lag', 'clock', 'endpoint', 'seats']) assert.equal(machine[key], undefined, `${machine.id} ${key}: no reading`)
  // R4 (lane K1's gateway_remotes_read, aikit.gateway-remotes/v1 — the REAL shape of K1's shapes/gateway-remotes.json): each declared
  // machine's endpoint, and the link joined because an endpoint is declared.
  const REMOTES = {schema: 'aikit.gateway-remotes/v1', remotes: [{token_location: 'file:/Users/admin/.aikit/credentials/remote-workcell-omarchy.token',
    websocket_bind: '100.92.62.101:7788', websocket_path: '/', workcell_ref: 'workcell:omarchy'}]}
  const withRemotes = cell.linkBinding(answered(REAL.workcellStatus), bind.chainHolds(), answered(REAL.population), answered(REMOTES))
  assert.equal(JSON.parse(withRemotes.values.machines)[1].endpoint, '100.92.62.101:7788')
  assert.equal(withRemotes.values.link, true)
  assert.equal(cell.linkValues(answered(REAL.workcellStatus), bind.chainHolds(), answered(REAL.population), answered({...REMOTES, remotes: []})).link, false, 'no endpoint declared: not joined')
  assert.doesNotMatch(withRemotes.values.machines, /token/, 'the token\'s location is never drawn')
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

test('the three designs draw on their bindings in all five views — no NaN, no undefined, never their fixtures — each refusal drawn as why; Git / landing draws its Seat group on the seat\'s binding', () => {
  bind.resetHolds()
  host.resetHost()
  const git = {...model.INITIAL_READING, gitAdmitted: true, gitRepo: {branch: 'main', uncommitted: 3}}
  // REPLACED (#725): the Seat's own design on the seat's binding — the Seat is Git / landing's now (§19.17), so Git / landing's design
  // draws it, on the same seat binding carried under `seat.` (FactoryDeviceChain.tsx gitCarrying), never on the design's sample (the
  // Seat's own fixture words, and Git / landing's). REPLACED (§19.16, 22 Oct manual): its Seat page left; the Seat group of Whole's one
  // view draws it.
  const SEAT_FIXTURE = /claude-code:dlw-manual|59f94a3|point-cloud-demo|fold\/day-close-20261012|933731e|Native CLI|5b3c3e0fc|65202d830/
  const carrying = seat => carryPages(cell.gitBinding(git, bind.chainHolds()), [{page: SEAT_PAGE, binding: seat}])
  const cases = [
    [gitDesign, cell.gitBinding(git, bind.chainHolds()), /fold\/day-close-20261012|933731e|Native CLI/, []],
    [gitDesign, carrying(cell.seatBinding({status: REAL.seatStatus, project: 'O-I', branch: 'dlw/build', holds: bind.chainHolds()})), SEAT_FIXTURE, [cell.SEAT_REFUSE.release]],
    [gitDesign, carrying(cell.seatBinding({status: null, project: 'O-I', branch: null, holds: bind.chainHolds()})), new RegExp(`${SEAT_FIXTURE.source}|dlw/build`), [cell.SEAT_UNREAD]],
    [carrierDesign, cell.carrierBinding(answered(REAL.workcellStatus), bind.chainHolds()), /100\.92\.62\.101:7788|ready-to-carry/, []],
    [linkDesign, cell.linkBinding(answered(REAL.workcellStatus), bind.chainHolds(), answered(REAL.population)), /cradle-steward|claude-code:dlw-conductor|fold\/day-close-20261012/, [cell.LINK_REFUSE.link]],
  ]
  for (const [design, binding, fixture, reasons] of cases) {
    host.resetHost(binding.id)
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
  assert.ok(hosted(gitDesign, cases[1][1]).join('\n').includes('dlw/build'), 'the Seat group draws the real seat\'s lane')
  host.resetHost(cases[1][1].id)
  const link = hosted(linkDesign, cases[4][1]).join('\n')
  assert.ok(link.includes('omarchy') && link.includes('connection timed out'), 'the Link draws the real remote and its standing in the owner\'s words')
  cases[4][1].local.sel('workcell:mac')
  const here = hosted(linkDesign, cell.linkBinding(answered(REAL.workcellStatus), bind.chainHolds(), answered(REAL.population))).join('\n')
  assert.ok(here.includes('Central Product Guardian'), 'this machine open in the pane: who runs here')
  bind.resetHolds()
  host.resetHost()
})

test('the chain places them where the manual does: a workcell\'s chain — the Remote carrier after the Gateway, the Seat Git / landing\'s page; the Link in the transport (lane W1-Factory)', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  // REPLACED (lane W1-Factory; DLW §16.2, §19.16–§19.19, §19.23): the Seat, the carrier and Git / landing left the session's chain and the
  // Main track for a workcell's chain; the Link left the Main track for the transport, which publishes it (the frame's own).
  // REPLACED (#725): "the Seat stands inside Git / landing" as a device of its own — the Seat is Git / landing's Seat page (§19.17): the
  // seat binding is carried under `seat.` on Git / landing's binding, and no Seat stands in the slot.
  assert.match(view, /carryPages\(gitDesignBinding, \[\{page: SEAT_PAGE, binding: seatDesignBinding\}\]\)/, 'the Seat is Git / landing\'s Seat group (§19.16, §19.17)')
  assert.doesNotMatch(view, /placed\(SEAT_ID/, 'no Seat device stands inside Git / landing')
  // REPLACED (#725): the carrier on its own binding. REPLACED (§19.18, §19.23, 22 Oct manual): its Machine page left — the machine is the
  // Machine page of Workcell's instrument, which the rail's publisher carries (below).
  assert.match(view, /case 'remote-carrier': return placed\(CARRIER_ID, cells\.carrier, carrierDesignBinding, [^\n]*\n[^\n]*'data-workcell-slot': 'remote-carrier'/,
    'the Remote carrier is the second device of a workcell\'s chain (§19.18)')
  assert.doesNotMatch(view, /MACHINE_PAGE|CHECKOUTS_PAGE/, 'the chain carries no Machine or Checkouts page')
  assert.doesNotMatch(view, /LINK_ID|linkBinding/, 'the Link stands in the transport (§19.19), on no chain of this file')
  // REPLACED (#725): the Gateways monitor on the rail — retired into the Workcells tile (§19.3), the rail's publisher carrying the gateways'
  // binding under `gw.` on the workcell rack's (AgentRailDevices.tsx).
  const rail = read('agent/devices/AgentRailDevices.tsx')
  assert.match(rail, /rackBinding\(\{reading, holds, carrier\}/, 'the gateways\' carrier line reads the carrier')
  // REPLACED (ticket 772): the rack carries its Left behind page too (§19.23; workcell-left-behind-page.test.mjs). REPLACED (§19.23, 22 Oct
  // manual): and its Seats page (the seats and the checkouts) and its Machine page (the carrier's plan and the machine).
  assert.match(rail, /carryPages\(ownWorkcell, \[\{page: GATEWAYS_PAGE, binding: gateways\}, \{page: LEFT_BEHIND_PAGE, binding: leftBehind\},\s*\{page: SEAT_PAGE, binding: seat\}, \{page: CHECKOUTS_PAGE, binding: leftBehind\}, \{page: CARRIER_PAGE, binding: carrierPlan\}, \{page: MACHINE_PAGE, binding: machine\}\]\)/,
    'the Workcells tile carries the gateways; the instrument its Left behind, Seats and Machine pages')
  assert.match(rail, /chain === 'remote-carrier' \? CARRIER_ID/, 'choosing that line shows the carrier whole')
  // REPLACED (R4, lane K1): the Seat reads the seat instrument through the kernel (seat_status_read); on a workcell's chain it starts at
  // that workcell's seat.
  assert.match(view, /seatBinding\(\{status: seats\.status === 'answered' \? seats\.value : null/, 'the seat instrument through the kernel')
  // REPLACED (O-I #740 lane B): readPopulation(transport, project); the root register (''/null) names no project world.
  assert.match(read('agent/devices/usePopulationAnswer.ts'), /readPopulation\(transport, world\)/, 'through the cradle\'s own population read (inhabitation_read)')
  for (const file of ['agent/devices/workcellBindings.ts', 'agent/devices/usePopulationAnswer.ts']) {
    assert.doesNotMatch(read(file), /\.defaults\[|\.fixtures|catalogue\/panels\//, `${file}: no design default or fixture`)
    assert.deepEqual(read(file).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
  }
})
