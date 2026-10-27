// Lane BF3: the session's own devices on their owners (src/agent/devices/sessionChainBindings.ts, FactoryDeviceChain.tsx) — the Run
// (software-factory:run-device, DLW §19.1, on the session's chain), Custody (software-factory:agent-custody, §19.13, in the Agent's
// slot) and the Agentset rack (software-factory:agentset-rack, §19.18, a group's chain).
//
// Channels:
// - FIXTURE: the sessions provider's tracks, shaped as agent/agentRunModel.ts builds them (a SessionSpace group with its sessions at
//   depth 1, TaskClip n · title · state · start · last activity, the needle on the shared axis), the Agent's values, Scope's binding.
//   The ports record their calls; no owner state is written.
// - SCRIPTED: the three catalogue designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
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
const bind = await import('../src/agent/devices/designBindings.ts')
const own = await import('../src/agent/devices/sessionChainBindings.ts')
// The Run's own design (software-factory:run-device) and Custody's face were retired as devices of their own in the 22 Oct manual
// rewrite; their bindings stay, and Custody's pages are the Agent's (agent-custody.tsx).
const {design: custodyDesign} = await import('../src/inhabitants/catalogue/panels/agent-custody.tsx')
const {design: agentsetDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const views = ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}})))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

const NOW = 1_800_000_000_000
const clip = (n, over = {}) => ({n, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: false, disclosure: null, ...over})
const track = over => ({sessionRef: 'agent-session/fx', purpose: null, agentRef: null, agentName: null, agentAccepted: null, spaceRef: 'session-space/fx', spaceLabel: 'Port crew',
  depth: 1, parentRef: 'session-space/fx', group: false, memberRefs: [], tasks: [], needle: null, telemetryOn: true, budget: {used: null, max: null}, disclosure: null, ...over})
const LEAD = track({sessionRef: 'agent-session/fx-aletheia', purpose: 'Explain run', agentName: 'aletheia', budget: {used: 3, max: 12},
  tasks: [clip(1, {title: 'Read the act', state: 'done', startUnixMs: NOW - 600_000, lastActivityUnixMs: NOW - 540_000}),
    clip(2, {title: 'Return the correction', state: 'running', startUnixMs: NOW - 300_000, lastActivityUnixMs: NOW - 12_000}), clip(3), clip(4, {softStop: true})],
  needle: {atUnixMs: NOW - 12_000, state: 'live', axisStartUnixMs: NOW - 1_800_000, axisEndUnixMs: NOW, disclosure: null}})
const HELPER = track({sessionRef: 'agent-session/fx-anima', agentName: 'anima', tasks: [clip(1, {title: 'Survey', state: 'stalled', startUnixMs: NOW - 200_000, lastActivityUnixMs: NOW - 150_000})]})
const IDLE = track({sessionRef: 'agent-session/fx-kite', purpose: 'Sketch', tasks: [clip(1, {title: 'Sketch', state: 'done'})]})
const OTHER = track({sessionRef: 'agent-session/elsewhere', parentRef: 'session-space/other', spaceRef: 'session-space/other', agentName: 'cairn'})
const GROUP = track({sessionRef: 'session-space/fx', depth: 0, parentRef: null, group: true, memberRefs: [LEAD.sessionRef, HELPER.sessionRef, IDLE.sessionRef]})
const TRACKS = [GROUP, LEAD, HELPER, IDLE, OTHER]
const THREAD = JSON.stringify([{who: 'you', kind: 'you', text: 'Return the correction'}])

test('the Agentset rack is keyed to its design exactly, from Software Factory\'s admitted faces', () => {
  const devices = own.sessionDevices()
  for (const [device, design] of [[devices.agentset, agentsetDesign]]) {
    assert.ok(device, `${design.id}: the family admits the face`)
    assert.equal(designKey(device.family, device.face.id), design.id)
  }
})

test('the Run reads the session\'s lane on the run model\'s own axis: its tasks with when they began and last moved, its needle, its thread', () => {
  bind.resetHolds()
  const values = own.runValues({session: LEAD, tracks: TRACKS, nowUnixMs: NOW, agent: {light: 'lit', thread: THREAD}, holds: bind.chainHolds()})
  assert.deepEqual(JSON.parse(values.tasks), [
    {n: 1, name: 'Read the act', state: 'done', from: 10, last: 9},
    {n: 2, name: 'Return the correction', state: 'running', from: 5, last: 0.2},
    {n: 3},
  ], 'the soft-stop slot is no task; a state nobody said is left out')
  assert.equal(values.needle, 12, 'seconds since the last check-in')
  assert.equal(values.window, 30, 'the shared axis the needle stands on: here half an hour, ending at the reading instant')
  const at = new Date(NOW)
  assert.equal(values.now, at.getHours() * 60 + at.getMinutes() + at.getSeconds() / 60)
  assert.deepEqual([values.session, values.light, values.thread], [LEAD.sessionRef, 'lit', THREAD])
  assert.deepEqual([values.watch, values.lanes, values.overview], ['auto', 'messages', true], 'the manual\'s starting values, the shell\'s own')
  for (const key of ['attempts', 'take', 'events', 'color', 'telemetry', 'solo', 'open']) assert.equal(values[key], undefined, `${key}: no reading`)
  assert.equal(JSON.parse(values.sessions).length, 4, 'the sessions to choose from, groups left out')
  assert.deepEqual(own.runValues({session: GROUP, tracks: TRACKS, nowUnixMs: NOW, agent: {}, holds: bind.chainHolds()}), {watch: 'auto', lanes: 'messages', overview: true}, 'a group is no session')
})

test('the Run holds its view, moves THE selection when you choose a session, and refuses Telemetry and Solo by name', async () => {
  bind.resetHolds()
  const calls = []
  const binding = own.runBinding({session: LEAD, tracks: TRACKS, nowUnixMs: NOW, agent: {}, holds: bind.chainHolds()}, {select: ref => calls.push(ref)})
  binding.local.lanes('all')
  binding.local.watch('off')
  binding.local.session(HELPER.sessionRef)
  assert.deepEqual(calls, [HELPER.sessionRef])
  const after = own.runValues({session: LEAD, tracks: TRACKS, nowUnixMs: NOW, agent: {}, holds: bind.chainHolds()})
  assert.deepEqual([after.lanes, after.watch], ['all', 'off'])
  // REPLACED (lane K0): Telemetry and Solo are the session's own settings on AIKit (encounter_session_settings, as the mixer writes them);
  // the Run is not handed them, and says so.
  for (const key of ['telemetry', 'solo']) {
    assert.match(binding.standing[key].disabled, new RegExp(`encounter_session_settings \\{track: \\{${key}\\}\\}.*not handed the session's settings`), key)
    await assert.rejects(() => binding.write([{key, value: true}]), {message: own.RUN_REFUSE[key]})
  }
  assert.match(binding.standing.take.disabled, /factory_attempt_read needs the run ref/)
  bind.resetHolds()
})

test('Custody reads the custody the task record names, shares Scope\'s Write mode (the same write, the same standing), and refuses the rest', async () => {
  const calls = []
  const scope = {write: async changes => { calls.push(...changes.map(change => [change.key, change.value])) }, standing: {writeMode: {disabled: 'Write mode: … (WO-SF2)'}}}
  const binding = own.custodyBinding({sessionRef: LEAD.sessionRef, autonomy: 'review', agent: {light: 'lit'}}, scope)
  assert.deepEqual(binding.values, {light: 'lit', autonomy: 'review'})
  assert.deepEqual(own.custodyValues({sessionRef: null, autonomy: 'review', agent: {light: 'lit'}}), {}, 'no session: nothing')
  for (const key of ['gate', 'escalate', 'held', 'people', 'handBackLit', 'writeMode']) assert.equal(binding.values[key], undefined, `${key}: no reading`)
  assert.equal(binding.standing.writeMode.disabled, 'Write mode: … (WO-SF2)', 'Scope\'s standing, one row')
  await binding.write([{key: 'writeMode', value: 'direct'}])
  assert.deepEqual(calls, [['writeMode', 'direct']], 'through Scope\'s own write')
  // REPLACED (lane W11): the settings have their routes (custody-list, CustodyAssign); with no custody read handed in they say so
  // (w11-custody-turn-thought-settings.test.mjs writes them).
  assert.match(binding.standing.handBack.disabled, /missing op/)
  await assert.rejects(() => binding.write([{key: 'handBack', value: true}]), /missing op/)
  for (const key of ['autonomy', 'gate', 'escalate']) {
    assert.match(binding.standing[key].disabled, /custody list is not read here for this session/, key)
    await assert.rejects(() => binding.write([{key, value: 'auto'}]), /custody list is not read here for this session/)
  }
  assert.equal(calls.length, 1)
  const alone = own.custodyBinding({sessionRef: LEAD.sessionRef, autonomy: null, agent: {}}, null)
  await assert.rejects(() => alone.write([{key: 'writeMode', value: 'direct'}]), /Write mode is Scope's/)
})

test('the Agentset rack: a group\'s sessions as its chains, each named by its agent, its state from its own tasks; the delegation and Retry refused', async () => {
  bind.resetHolds()
  const values = own.agentsetValues({group: GROUP, tracks: TRACKS, models: ['glm-5.3-flash'], holds: bind.chainHolds()})
  assert.deepEqual(JSON.parse(values.members), [
    {id: LEAD.sessionRef, name: 'aletheia', goal: 'Explain run', state: 'working'},
    {id: HELPER.sessionRef, name: 'anima', state: 'stalled'},
    {id: IDLE.sessionRef, name: 'Sketch', goal: 'Sketch', state: 'done'},
  ], 'only this group\'s sessions; no parent below the space is disclosed, so none is given')
  assert.deepEqual([values.crew, values.light, values.models], ['Port crew', 'lit', JSON.stringify([{id: 'glm-5.3-flash'}])])
  for (const key of ['fanOut', 'depth', 'handBack', 'returnCap', 'model']) assert.equal(values[key], undefined, `${key}: Hermes' delegation block, not read`)
  assert.deepEqual(own.agentsetValues({group: LEAD, tracks: TRACKS, holds: bind.chainHolds()}), {}, 'a session is no group')
  const binding = own.agentsetBinding({group: GROUP, tracks: TRACKS, holds: bind.chainHolds()})
  binding.local.member(HELPER.sessionRef)
  assert.equal(own.agentsetValues({group: GROUP, tracks: TRACKS, holds: bind.chainHolds()}).member, HELPER.sessionRef, 'the chosen member is the view\'s')
  for (const key of ['fanOut', 'depth', 'handBack', 'returnCap', 'model']) {
    assert.match(binding.standing[key].disabled, /missing op/, key)
    await assert.rejects(() => binding.write([{key, value: 1}]), /missing op/)
  }
  // REPLACED (lane K0): Factory's retry is routed (factory_owner attempt-retry), and the rack holds no Run or unit for a member.
  assert.match(binding.standing.retry.disabled, /factory_owner attempt-retry.*no reading here names the Run or the workflow unit/)
  await assert.rejects(() => binding.write([{key: 'retry', value: 1}]), {message: own.AGENTSET_REFUSE.retry})
  bind.resetHolds()
})

test('the two designs draw on their bindings in all five views — no NaN, no undefined, never their fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const scope = {standing: {writeMode: {disabled: 'Write mode: missing op (WO-SF2)'}}}
  const cases = [
    [custodyDesign, own.custodyBinding({sessionRef: LEAD.sessionRef, autonomy: 'review', agent: {light: 'lit'}}, scope), /drop old captures|portPlan|Kite/, [own.CUSTODY_REFUSE.gate]],
    [agentsetDesign, own.agentsetBinding({group: GROUP, tracks: TRACKS, holds: bind.chainHolds()}), /oi-guardians|aikit-guardian|tsc · three roots/, [own.AGENTSET_REFUSE.fanOut]],
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
  assert.ok(hosted(agentsetDesign, cases[1][1]).join('\n').includes('aletheia'), 'the rack draws the group\'s real member')
  host.resetHost()
})

test('the chain places them where the manual does: Custody on the one Agent, the Run on no chain, the Agentset rack leading a group\'s chain', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  // REPLACED (R4): Custody stood in the Agent's slot as its own device; it is the one Agent's Custody page (custody.*) now.
  assert.doesNotMatch(view, /placed\(CUSTODY_ID/, 'no Custody device beside the Agent')
  assert.match(view, /composeAgentBinding\(agentDesignBinding, \{custody: custodyDesignBinding/, 'Custody composed onto the Agent')
  // REPLACED (R4): the Run stood after the landing; the chain is §16.2's (Agent, skills rack, scope — lane W1-Factory) — the Run is
  // published for the browser's Runs only.
  assert.doesNotMatch(view, /placed\(RUN_ID/, 'the Run stands on no chain')
  assert.match(view, /\[RUN_ID, ownDevices\.run, runDesignBinding\]/, 'the Run stays published')
  // REPLACED (lane W1-Factory): the chain draws its place's plan (factoryPlaces.ts chainSlots — a group's leads with the Agentset rack).
  assert.match(view, /case 'agentset': return placed\(AGENTSET_ID, ownDevices\.agentset, agentsetDesignBinding/, 'the Agentset rack on a group\'s chain (§19.15)')
  assert.match(view, /const place = factoryPlace\(\{sessionRef, group: !!groupTrack, workcell\}\)/)
  // REPLACED (lane W8): Custody takes the hand's holds, Actuation's authority list and the current person (the Grants page), and its
  // Revoke port; Scope still stands in its row.
  assert.match(view, /custodyBinding\(\{sessionRef, autonomy: reading\.autonomy, agent: agentDesignBinding\?\.values \?\? \{\}, holds, grants, person: currentPerson,\s*custody: custodyRead\}, scopeDesignBinding, custodyPorts\)/, 'Custody and Scope, one row')
  assert.match(view, /const currentPerson = currentIdentity\(\)\?\.reading\.person_ref \?\? null/, 'the person is the current identity, never a value the desk composes')
  assert.doesNotMatch(read('agent/devices/sessionChainBindings.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the bindings read no design default or fixture')
})
