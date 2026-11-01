// Lane W1-Factory: a workcell on its owners (src/agent/devices/workcellRackBinding.ts; workcell:workcell, DLW §19.23 — "Kind: instrument ·
// Pane: born in a pane, and stands only there"): its Name, Machine and Seats, its chain list with each device's light and none of their
// settings ("The instrument shows the run's connections and changes none of their settings"), the run's world and its acts absent or
// refused with the Workcell command no kernel route reaches, and the Workcells tile; and the chain's own devices read for that workcell —
// the Seat starting at its seat, Git / landing on its seat of the project.
//
// Channels:
// - REAL (tests/fixtures/workcell-readings-2026-10-21.json): `seat status --json`, `workcell status --json` and `aikit gateway who`, read on
//   workcell:mac on 21 Oct, read-only.
// - FIXTURE: the Gateway's harness answer (the gateway's own document shape, designBindings.ts gatewayValues), and a refused seat read.
// - SCRIPTED: the catalogue design rendered through the runtime's host (deviceHost.HostedDevice) to static markup, on every page.
// No owner state is written: every write is refused before any port.
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
const cell = await import('../src/agent/devices/workcellBindings.ts')
const rack = await import('../src/agent/devices/workcellRackBinding.ts')
const {design} = await import('../src/inhabitants/catalogue/panels/workcell__workcell.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const REAL = JSON.parse(readFileSync(new URL('./fixtures/workcell-readings-2026-10-21.json', import.meta.url), 'utf8'))
const answered = value => ({status: 'answered', value, error: null})
// REPLACED (§19.23 Full "it has two views, Full and Widget (§16.3). Its window holds its Full"): Folded, Compact and Whole.
const views = ['full', 'widget']
const PAGES = ['chain', 'world', 'services', 'exposure', 'release', 'left', 'seats', 'machine']
const draw = (binding, view) => renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view, nav: {}}))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Every key the design reads: its defaults and its fixtures' keys. */
// The carried keys stand under their prefixes and are hosted by prefixing their own owners' bindings (design.ts scoped): the Left behind
// page under `left.`, the Seats page under `seat.` and `co.`, the Machine page under `carrier.` and `mc.`, the tile's gateways under `gw.`
// (DLW §19.23).
const CARRIED = ['left.', 'seat.', 'co.', 'carrier.', 'mc.', 'gw.']
const designKeys = [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
  .filter(key => !CARRIED.some(prefix => key.startsWith(prefix)))
/** (b): a key is an owner reading, absent with the reason named, a hold of the hand — or, for a fate, a write refused with its reason. */
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading'
  : binding.standing?.[key]?.disabled ? 'absent' : binding.writes?.(key) ? 'refused-write' : null

// ---- FIXTURE: the Gateway's answer, in the harness document's own fields (designBindings.ts gatewayValues) ------------------------
const GATEWAY = bind.gatewayValues({reading: {...model.INITIAL_READING, gatewayAdmitted: true, gateway: {kind: 'reading', title: 'Gateway', line: 'answered', receipt: null},
  gatewayDoc: {state: 'ready', transport: 'stdio', stall_after_seconds: 300}}, harness: {binding: 'claude-code', resolved: true}})

function inputFor(name, holds = bind.chainHolds()) {
  const git = cell.gitValues(rack.workcellGitReading(answered(REAL.seatStatus), name, 'O-I'), holds)
  return {name, project: 'O-I', seats: REAL.seatStatus, chain: {gateway: GATEWAY, carrier: cell.carrierValues(answered(REAL.workcellStatus), holds), git}, holds}
}

test('Workcell\'s instrument is keyed to its design, an instrument with the views of a pane and the rail', () => {
  const device = rack.workcellRackDevice()
  assert.equal(designKey(device.family, device.face.id), design.id)
  assert.equal(rack.WORKCELL_RACK_DESIGN, design.id)
  assert.equal(design.kind, 'instrument')
  // REPLACED (§19.23 Full "it has two views, Full and Widget (§16.3). Its window holds its Full"): Folded, Compact, Whole; Full and its
  // window; its tile.
  assert.deepEqual(host.viewsOf(design), ['widget', 'full'], 'its tile and its Full')
  assert.deepEqual(['transport', 'approvals', 'stallAfter', 'landAs'].filter(key => key in design.defaults), [],
    'no macros: the instrument changes none of its connections\' settings (§19.23)')
})

test('a workcell on the real seat reading: its name, machine, seats with their lanes, claims and co-workers, the chain list and the tile\'s chips', () => {
  bind.resetHolds()
  const values = rack.workcellRackValues(inputFor('env-1'))
  assert.equal(values.name, 'env-1')
  assert.equal(values.machine, 'workcell:mac', 'the Remote carrier\'s reading of `workcell status`')
  assert.equal(values.light, 'lit', 'the register holds env-1 and its gateway answered')
  const seats = JSON.parse(values.seats)
  // REPLACED (§19.23 Seats "One row for each seat of each project"): the reason "the folded workcell reads its lane" — there is no Folded.
  assert.deepEqual(seats.map(seat => seat.product), ['o-i', 'actuation', 'ai-kit', 'central', 'factory', 'ql-mef', 'workcell', 'point-cloud-demo'],
    'the project\'s seat first, then the instrument\'s order')
  const oi = seats.find(seat => seat.product === 'o-i')
  assert.deepEqual([oi.state, oi.lane, oi.claimedBy, oi.dirty, oi.ahead, oi.behind], ['claimed', 'dlw/build', 'claude-code:dlw-lead', 38, 35, 0], 'tracked 31 and untracked 7 have no commit')
  assert.ok(oi.workers.includes('claude-code:dlw-conductor') && !oi.workers.includes('claude-code:dlw-lead'), 'its co-workers are its zones\' actors, the claimant left out')
  const free = seats.find(seat => seat.product === 'workcell')
  assert.deepEqual([free.lane, free.claimedBy, free.workers], [null, null, []], 'a free seat holds no lane, and its leftover zones are no claim')
  assert.deepEqual(JSON.parse(values.chain), [
    {id: 'gateway', name: 'Gateway', light: 'lit', reading: 'claude-code · stdio'},
    {id: 'carrier', name: 'Remote carrier', light: 'dark', reading: 'workcell:mac'},
    {id: 'landing', name: 'Git / landing', light: 'lit', reading: 'dlw/build · 35 ahead'},
  ], 'each device with the light its own binding reads: the carrier is composed, never live (§19.18 Rules)')
  assert.deepEqual(JSON.parse(values.workcells), [{name: 'env-1', lane: 'dlw/build'}, {name: 'env-2', lane: 'dlw/native-build'}, {name: 'env-3', lane: 'dlw/t1-theme'}],
    'every workcell of the register with its seat of the project\'s lane')
  for (const key of ['transport', 'approvals', 'stallAfter', 'landAs']) assert.equal(values[key], undefined, `${key}: set on its own device, never here`)
  for (const key of Object.keys(rack.WORKCELL_ABSENT)) assert.equal(values[key], undefined, `${key}: no reading reaches it`)
  assert.deepEqual([values.needed, values.openIn], [false, 'web'], 'the pages\' own settings start where the manual starts them')
  const other = rack.workcellRackValues(inputFor('env-2'))
  assert.deepEqual(JSON.parse(other.seats).find(seat => seat.product === 'o-i').lane, 'dlw/native-build')
  assert.equal(JSON.parse(other.chain)[2].reading, 'dlw/native-build · 0 ahead')
})

test('with no workcell selected only the tile\'s chips stand; without the seat reading only the hand\'s settings', () => {
  bind.resetHolds()
  const none = rack.workcellRackBinding({...inputFor('env-1'), name: null}, {})
  assert.deepEqual(Object.keys(none.values).sort(), ['needed', 'openIn', 'workcells'])
  assert.match(none.standing.name.disabled, /No workcell is selected/)
  const unread = rack.workcellRackBinding({...inputFor('env-1'), seats: null, seatsUnread: 'seat status: the register is locked'}, {})
  assert.equal(unread.values.seats, undefined)
  assert.equal(unread.standing.seats.disabled, 'seat status: the register is locked', 'the refusal in the owner\'s words')
  assert.equal(unread.values.workcells, undefined)
  assert.equal(rack.workcellRackValues({...inputFor('env-1'), chain: {...inputFor('env-1').chain, gateway: {...GATEWAY, light: 'dark'}}}).light, 'dark', 'the gateway did not answer')
  assert.equal(rack.workcellRackValues({...inputFor('env-9')}).light, 'dark', 'the register does not hold it')
})

test('(b) every key the design reads is an owner reading, absent with its missing operation named, or a hold of the hand', () => {
  bind.resetHolds()
  const binding = rack.workcellRackBinding(inputFor('env-1'), {})
  const classes = Object.fromEntries(designKeys.map(key => [key, classify(binding, key)]))
  for (const [key, kind] of Object.entries(classes)) assert.ok(kind, `${key}: classified`)
  // REPLACED (§19.23 "It stands on no chain"; Full "it has two views, Full and Widget"): `project`, the chain's project, whose seat's lane
  // the folded workcell read (#757) — no chain, no Folded.
  assert.deepEqual(Object.entries(classes).filter(([, kind]) => kind === 'reading').map(([key]) => key).sort(),
    ['chain', 'light', 'machine', 'name', 'seats', 'workcells'])
  assert.deepEqual(Object.entries(classes).filter(([, kind]) => kind === 'local').map(([key]) => key).sort(), ['needed', 'openIn', 'worldReceipt'],
    'worldReceipt: the World page\'s choice among the worlds listed for the cell (#757)')
  assert.match(binding.standing.worlds.disabled, /missing op:/, 'worlds: no world read here, the operation it waits for named')
  // REPLACED (lane W10): Services and the harness processes have their routes (doctor, instances list|usage); unread here they say where
  // they are read (w10-workcell-material.test.mjs reads them).
  for (const [key, kind] of Object.entries(classes)) {
    if (kind === 'absent') assert.match(binding.standing[key].disabled, key === 'services' || key === 'instances' ? /is not read here/ : /missing op:/, `${key}: absent names the operation it waits for`)
    if (kind === 'refused-write') assert.match(key, /^want:/, `${key}: a fate, refused while no world is read`)
  }
  for (const key of ['working', 'instances', 'frames', 'run', 'world', 'lease', 'checkpoints', 'readAt', 'services', 'surfaces', 'omitted', 'reconciled']) assert.equal(classes[key], 'absent', key)
  // The design's own defaults never stand in: no reading equals a sample the design holds and the owner did not report.
  assert.notEqual(binding.values.chain, design.defaults.chain)
  assert.notEqual(binding.values.seats, design.defaults.seats)
})

test('(c) the instrument changes none of its connections\' settings; every act of the run\'s world refused with its command', async () => {
  bind.resetHolds()
  const binding = rack.workcellRackBinding(inputFor('env-1'), {})
  // "The instrument shows the run's connections and changes none of their settings: each is set on its device" (§19.23 Rules).
  for (const [key, value] of [['transport', 'ws'], ['approvals', 'ask'], ['stallAfter', 90], ['landAs', 'mr']]) {
    assert.equal(binding.writes(key), false, key)
    await assert.rejects(() => binding.write([{key, value}]), /is a reading/, `${key}: nothing here changes it`)
  }
  // REPLACED (lane W10): Recover, Apply and Release world name the receipt they lack (NO_RUN); Read services the carrier it lacks.
  for (const [key, op] of [['reread', /material_read/], ['recover', /workcell --receipt R recover/], ['checkpoint', /workcell --receipt R checkpoint/], ['readServices', /workcell doctor/], ['open', /endpoint/],
    ['apply', /reconcile --desired/], ['releaseWorld', /workcell --receipt R release/]]) {
    assert.match(binding.standing[key].disabled, op, key)
    await assert.rejects(() => binding.write([{key, value: true}]), op)
  }
  await assert.rejects(() => binding.write([{key: 'want:workspace:checkout', value: 'released'}]), /fate/)
  binding.local.openIn('pane')
  binding.local.needed(true)
  assert.deepEqual([rack.workcellRackValues(inputFor('env-1')).openIn, rack.workcellRackValues(inputFor('env-1')).needed], ['pane', true], 'the hand\'s settings, never sent')
  bind.resetHolds()
})

test('the chain\'s own devices read the selected workcell: the Seat starts at its seat, Git / landing on its seat of the project', () => {
  bind.resetHolds()
  assert.deepEqual(rack.workcellGitReading(answered(REAL.seatStatus), 'env-1', 'O-I'), {gitAdmitted: true, gitRepo: {branch: 'dlw/build', uncommitted: 38}})
  assert.deepEqual(rack.workcellGitReading(answered(REAL.seatStatus), 'env-2', 'ai-kit'), {gitAdmitted: true, gitRepo: {uncommitted: 0}}, 'a free seat stands on no lane')
  assert.deepEqual(rack.workcellGitReading({status: 'refused', value: null}, 'env-1', 'O-I'), {gitAdmitted: false, gitRepo: {}})
  assert.deepEqual(rack.workcellGitReading({status: 'reading', value: null}, 'env-1', 'O-I'), {gitAdmitted: null, gitRepo: {}})
  const git = cell.gitValues(rack.workcellGitReading(answered(REAL.seatStatus), 'env-3', 'O-I'), bind.chainHolds())
  assert.deepEqual(git, {light: 'lit', branch: 'dlw/t1-theme', uncommitted: 0})
  for (const name of ['env-1', 'env-2', 'env-3']) {
    assert.equal(cell.seatValues({status: REAL.seatStatus, project: 'O-I', branch: 'dlw/build', workcell: name, holds: bind.chainHolds()}).seat, name, `${name}: the Seat starts at its seat`)
  }
  assert.equal(cell.seatValues({status: REAL.seatStatus, project: 'O-I', branch: 'dlw/build', holds: bind.chainHolds()}).seat, 'env-1', 'with no workcell, the seat on the branch')
})

test('the design draws on its binding in all its views and pages — no NaN, no undefined, never its fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const FIXTURE = /Claude Code · local|reads-round-2|omarchy · env-1|redis-now|gliner25|factory-attempt|Type-check the three|instance:claude-code|dlw\/uiux-kit-motion|127\.0\.0\.1:5208/
  const bindings = [rack.workcellRackBinding(inputFor('env-1'), {}), rack.workcellRackBinding({...inputFor('env-1'), name: null, seats: null}, {})]
  for (const binding of bindings) {
    const drawn = []
    for (const view of views) {
      for (const page of view === 'full' ? PAGES : ['chain']) {
        host.setHostPage(rack.WORKCELL_RACK_ID, page)
        const markup = draw(binding, view)
        drawn.push(markup)
        assert.match(markup, new RegExp(`data-device-view="${view}"`), `${view}/${page} draws`)
        assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${view}/${page}: no absent key drawn as text`)
        assert.doesNotMatch(markup, /data-device-fault/, `${view}/${page}: its own view drew`)
        assert.doesNotMatch(markup, FIXTURE, `${view}/${page}: its fixture never stands in`)
      }
    }
    host.resetHost()
    const all = drawn.join('\n')
    for (const why of [rack.WORKCELL_REFUSE.recover, rack.WORKCELL_REFUSE.readServices, rack.WORKCELL_REFUSE.releaseWorld]) {
      assert.ok(all.includes(escaped(why)), `a refused control says why (${why.slice(0, 40)}…)`)
    }
  }
  const lit = bindings[0]
  host.setHostPage(rack.WORKCELL_RACK_ID, 'seats')
  const full = draw(lit, 'full')
  host.setHostPage(rack.WORKCELL_RACK_ID, 'chain')
  const tile = draw(lit, 'widget'), chain = draw(lit, 'full')
  assert.ok(full.includes('dlw/build') && full.includes('claude-code:dlw-lead') && full.includes('dlw/native-build') === false, 'the pane\'s Seats: env-1\'s own seats')
  assert.ok(tile.includes('env-2') && tile.includes('env-3') && tile.includes('dlw/build'), 'the Workcells tile: a chip for each workcell, the chosen one\'s lane')
  // REPLACED (§19.23 Widget "The chosen workcell shows its lane"; Chain "the Gateway, the Remote carrier and Git / landing, each with its
  // reading"): the Folded view's name and lane, and the Compact's chain list — the tile carries the one, the Full's Chain page the other.
  assert.ok(tile.includes('env-1') && !tile.includes('fold/day-close'), 'the tile: its name and the lane its seat of the project holds')
  assert.ok(chain.includes('claude-code · stdio') && chain.includes('dlw/build · 35 ahead'), 'the Chain page: the road with its readings')
  host.resetHost()
  bind.resetHolds()
})

test('the binding reads no design default or fixture, and writes no raw colour', () => {
  const source = readFileSync(new URL('../src/agent/devices/workcellRackBinding.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\.defaults\[|\.fixtures|catalogue\/panels\//)
  assert.deepEqual(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [])
})
