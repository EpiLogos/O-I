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
  // REPLACED (lane K0): Telemetry is the session's own setting on AIKit (encounter_session_settings, as the mixer writes it); the Run is
  // not handed it, and says so. REPLACED (round 858, §16.1, §16.6): Solo is what you attend to, the shell's on the book, never AIKit's.
  assert.match(binding.standing.telemetry.disabled, /encounter_session_settings \{track: \{telemetry\}\}.*not handed the session's settings/)
  assert.match(binding.standing.solo.disabled, /what you attend to.*not handed the attention/)
  assert.doesNotMatch(binding.standing.solo.disabled, /encounter_session_settings/)
  for (const key of ['telemetry', 'solo']) await assert.rejects(() => binding.write([{key, value: true}]), {message: own.RUN_REFUSE[key]})
  assert.match(binding.standing.take.disabled, /factory_attempt_read needs the run ref/)
  bind.resetHolds()
})

test('Custody reads the Agent\'s light, shares Scope\'s Write mode (the same write, the same standing), refuses the retired Autonomy, and refuses the rest', async () => {
  const calls = []
  const scope = {write: async changes => { calls.push(...changes.map(change => [change.key, change.value])) }, standing: {writeMode: {disabled: 'Write mode: … (WO-SF2)'}}}
  const binding = own.custodyBinding({sessionRef: LEAD.sessionRef, agent: {light: 'lit'}}, scope)
  assert.deepEqual(binding.values, {light: 'lit'}, 'no Autonomy stands: the Agent\'s Autonomy is retired (§19.4, §19.12)')
  assert.deepEqual(own.custodyValues({sessionRef: null, agent: {light: 'lit'}}), {}, 'no session: nothing')
  // The retired Autonomy: a press that still names it is refused naming what took its place, and nothing is sent.
  assert.match(binding.standing.autonomy.disabled, /^Autonomy is retired: Scope's Tool calls, on its Asks page, answers the harness's request to use a tool/)
  await assert.rejects(() => binding.write([{key: 'autonomy', value: 'auto'}]), /^Error: Autonomy is retired: Scope's Tool calls/)
  assert.equal('autonomy' in own.CUSTODY_SETTING_FIELDS, false, 'Custody writes no Autonomy through Factory\'s custody assign')
  for (const key of ['gate', 'escalate', 'held', 'people', 'handBackLit', 'writeMode']) assert.equal(binding.values[key], undefined, `${key}: no reading`)
  assert.equal(binding.standing.writeMode.disabled, 'Write mode: … (WO-SF2)', 'Scope\'s standing, one row')
  await binding.write([{key: 'writeMode', value: 'direct'}])
  assert.deepEqual(calls, [['writeMode', 'direct']], 'through Scope\'s own write')
  // REPLACED (lane W11): the settings have their routes (custody-list, CustodyAssign); with no custody read handed in they say so
  // (w11-custody-turn-thought-settings.test.mjs writes them).
  // REPLACED (BD r20 PORT, round 869): Hand back is Factory's custody hold (factory_owner custody-hold); with no custody read handed in it
  // says where the list is read, and asks nothing.
  assert.match(binding.standing.handBack.disabled, /^Hand back: Factory's custody list \(the kernel's factory_owner custody-list\) is read on the session's own chain/)
  await assert.rejects(() => binding.write([{key: 'handBack', value: true}]), /^Error: Hand back: Factory's custody list/)
  for (const key of ['gate', 'escalate']) {
    assert.match(binding.standing[key].disabled, /custody list is not read here for this session/, key)
    await assert.rejects(() => binding.write([{key, value: 'auto'}]), /custody list is not read here for this session/)
  }
  assert.equal(calls.length, 1)
  const alone = own.custodyBinding({sessionRef: LEAD.sessionRef, agent: {}}, null)
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
  // REPLACED (round 861): a group's Model macro offered AIKit's catalogue. It turns each chain's session through its harness's own model
  // select, whose ids are the harness's, so it offers the models every chain's harness reports (agent-rack-842.test.mjs); a group whose
  // chains are not read offers none. The catalogue stays a lone session's, as its Agent offers it.
  assert.deepEqual([values.crew, values.light, values.models], ['Port crew', 'lit', undefined])
  assert.equal(own.agentsetValues({group: null, session: LEAD, tracks: TRACKS, models: ['glm-5.3-flash'], holds: bind.chainHolds()}).models, JSON.stringify([{id: 'glm-5.3-flash'}]))
  for (const key of ['fanOut', 'depth', 'handBack', 'returnCap']) assert.equal(values[key], undefined, `${key}: Hermes' delegation block, not read`)
  // REPLACED (DLW agency designs): `model` was the Subagent model, Hermes' delegation.model — §19.15 names no Subagent model; Model,
  // Effort and Budget are the rack's macros, each turning that setting of every member's Agent, and the rack holds no member's Agent.
  for (const key of ['model', 'effort', 'budget', 'unmapped', 'variations']) assert.equal(values[key], undefined, `${key}: the macros, not read`)
  assert.deepEqual(own.agentsetValues({group: LEAD, tracks: TRACKS, holds: bind.chainHolds()}), {}, 'a session is no group')
  const binding = own.agentsetBinding({group: GROUP, tracks: TRACKS, holds: bind.chainHolds()})
  binding.local.member(HELPER.sessionRef)
  // REPLACED (§19.15 revised): `device` was the plate of the chosen member's chain pressed to show it. The plates are gone: "Select a member
  // in the chain list and the rack's Devices view, beside the list, shows that member's chain", every device at once, so only the member is held.
  const held = own.agentsetValues({group: GROUP, tracks: TRACKS, holds: bind.chainHolds()})
  assert.equal(held.member, HELPER.sessionRef, 'the chosen member is the view\'s')
  assert.equal('device' in binding.local, false, 'no device of the chain is chosen: the Devices view shows them all')
  // REPLACED (BD r19; DLW build ruling 2026-11-05): `dev` was a missing op. A device of another session's chain is changed by a message to that
  // session through Messages' delegate, so a rack handed no carrier names that carrier (the last test).
  for (const key of ['fanOut', 'depth', 'handBack', 'returnCap', 'solo']) {
    assert.match(binding.standing[key].disabled, /missing op/, key)
    await assert.rejects(() => binding.write([{key, value: 1}]), /missing op/)
  }
  // REPLACED (BD r20; DLW build ruling 2026-11-05): Budget, Unmap, Store and Variations were missing ops. Each chain's task Budget is
  // AIKit's (encounter_task_read, then encounter_task_budget) and where the macros stand is Software Factory's (factory.rack-macros/v1,
  // the kernel's factory_owner rack-macros-read and rack-macros-write), so a rack handed no carrier names the one that carries it.
  for (const key of ['budget', 'unmapped', 'store', 'variation']) {
    assert.equal(binding.standing[key].disabled, own.AGENTSET_REFUSE[key], key)
    assert.doesNotMatch(binding.standing[key].disabled, /missing op/, key)
    await assert.rejects(() => binding.write([{key, value: 1}]), error => error.message === own.AGENTSET_REFUSE[key], key)
  }
  // REPLACED (round 861): a group's Model and Effort were missing ops; each chain's session carries its own (AIKit's model select), so a
  // rack handed no carrier names that one.
  for (const key of ['model', 'effort']) {
    assert.equal(binding.standing[key].disabled, own.AGENTSET_REFUSE[key], key)
    await assert.rejects(() => binding.write([{key, value: 'high'}]), error => error.message === own.AGENTSET_REFUSE[key])
  }
  // REPLACED (round 859): bench, extract and add were missing ops. AIKit carries each (the kernel's encounter_session_bench, _drag_out and
  // _attach), so a rack handed no carrier names the one that carries it. REPLACED (round 860): Hot-Swap was refused in AIKit's own law (a
  // session keeps its agent); AIKit's hot-swap seats the other agent's own session in the chain's place (the kernel's
  // encounter_session_hot_swap), and a rack handed no carrier names it too.
  for (const [key, op] of [['bench', 'encounter_session_bench'], ['extract', 'encounter_session_drag_out'], ['add', 'encounter_session_attach'],
    ['swap', 'encounter_session_hot_swap']]) {
    assert.match(binding.standing[key].disabled, new RegExp(`no carrier to AIKit's .*\\(the kernel's ${op}\\) stands on this chain`), key)
  }
  await assert.rejects(() => binding.write([{key: 'swap', value: HELPER.sessionRef}]), {message: own.AGENTSET_REFUSE.swap})
  // The chain list's own keys, one for each member, answer with their control's refusal (§19.15 The members).
  await assert.rejects(() => binding.write([{key: `bench:${HELPER.sessionRef}`, value: true}]), {message: own.AGENTSET_REFUSE.bench})
  await assert.rejects(() => binding.write([{key: `solo:${HELPER.sessionRef}`, value: true}]), {message: own.AGENTSET_REFUSE.solo})
  // REPLACED (lane K0): Factory's retry is routed (factory_owner attempt-retry), and the rack holds no Run or unit for a member.
  // REPLACED (BD r19, C26 6311e404c): Factory names a task's units (factory_owner attempt-task-units), so the rack's Retry reads them and
  // retries the chosen chain's unit; a rack handed no carrier says so.
  assert.match(binding.standing.retry.disabled, /no carrier to Factory's attempt-task-units and attempt-retry stands on this rack/)
  await assert.rejects(() => binding.write([{key: 'retry', value: 1}]), {message: own.AGENTSET_REFUSE.retry})
  await assert.rejects(() => binding.write([{key: own.memberDeviceKey(HELPER.sessionRef, 'actuation:harness-model'), value: '{"effort":"max"}'}]), {message: own.AGENTSET_REFUSE.dev})
  assert.match(own.AGENTSET_REFUSE.dev, /a message to that session through Messages' delegate/)
  bind.resetHolds()
})

test('the two designs draw on their bindings in all five views — no NaN, no undefined, never their fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const scope = {standing: {writeMode: {disabled: 'Write mode: missing op (WO-SF2)'}}}
  const cases = [
    [custodyDesign, own.custodyBinding({sessionRef: LEAD.sessionRef, agent: {light: 'lit'}}, scope), /drop old captures|portPlan|Kite/, [own.CUSTODY_REFUSE.gate]],
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
  // O-I 787: the Agent's Autonomy is retired (§19.4, §19.12), so Custody draws no Autonomy rail, dial, choice or readout in any view.
  assert.doesNotMatch(hosted(custodyDesign, cases[0][1]).join('\n'), /[Aa]utonomy/, 'no Autonomy is drawn')
  assert.equal('autonomy' in custodyDesign.defaults, false, 'nor is it a key of the design')
  // The compact well is 140 wide: its "nothing read" words stand on two lines inside it, not cut off at the well's edge (round 11 capture).
  const compact = hosted(custodyDesign, cases[0][1])[views.indexOf('compact')]
  assert.match(compact, /<tspan x="7"[^>]*>No reading of what<\/tspan><tspan x="7"[^>]*>the agent holds<\/tspan>/, 'the compact well\'s empty words wrap inside it')
  host.resetHost()
})

test('the chain places them where the manual does: Custody on the one Agent, the Run on no chain, the Agent rack on every session\'s chain', () => {
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  // REPLACED (R4): Custody stood in the Agent's slot as its own device; it is the one Agent's Custody page (custody.*) now.
  assert.doesNotMatch(view, /placed\(CUSTODY_ID/, 'no Custody device beside the Agent')
  assert.match(view, /composeAgentBinding\(agentDesignBinding, \{custody: custodyDesignBinding/, 'Custody composed onto the Agent')
  // REPLACED (R4): the Run stood after the landing; the chain is §16.2's (the connections, the Agent rack, Scope, Git / landing — O-I #842)
  // — the Run is published for the browser's Runs only.
  assert.doesNotMatch(view, /placed\(RUN_ID/, 'the Run stands on no chain')
  // REPLACED (ticket 772): "the Run stays published" — its constructor answered null since ticket 725 (Software Factory admits no run-device
  // face), so the door held nothing; constructor and publication are gone. A session's course is its track in Arrangement view (§16.1).
  assert.doesNotMatch(view, /ownDevices\.run|runDesignBinding/, 'no Run is published')
  assert.equal('run' in own.sessionDevices(), false, 'no Run device: no constructor stands')
  // REPLACED (lane W1-Factory): the chain draws its place's plan (factoryPlaces.ts chainSlots).
  // REPLACED (DLW agency designs): "the rack carries the Helper page on its own binding" (#725, `helper.`) — the manual makes the Decision
  // helper a device of its own, a chain of the rack in place of an Agent (§19.15, §19.20), so the rack stands on its own binding again and
  // lists the helper among its chains while it stands on a group.
  // REPLACED (O-I #842): `case 'agentset': return placed(AGENTSET_ID, …)` on a group's chain alone — the rack plate (rackPlate) stands on
  // every session's chain, its head the same placed plate, the lone session's own chain inside it (agent-rack-842.test.mjs).
  assert.match(view, /case 'agentset': return rackPlate\(\)/, 'the Agent rack on every session\'s chain (§19.15)')
  assert.match(view, /const head = placed\(AGENTSET_ID, ownDevices\.agentset, agentsetDesignBinding/, 'its head on the rack\'s own binding')
  assert.match(view, /\.\.\.\(helperStands && helperDevice \? \{helper: helperDesignBinding\.values\} : \{\}\)/, 'the rack lists the Decision helper among its chains')
  assert.match(view, /const place = factoryPlace\(\{sessionRef, group: !!groupTrack, workcell\}\)/)
  // REPLACED (lane W8): Custody takes the hand's holds, Actuation's authority list and the current person (the Grants page), and its
  // Revoke port; Scope still stands in its row. REPLACED (BD r20 PORT, round 869): its ports carry Factory's custody hold as well (Hand back).
  assert.match(view, /custodyBinding\(\{sessionRef, agent: agentDesignBinding\?\.values \?\? \{\}, holds, grants, person: currentPerson,\s*custody: custodyRead\}, scopeDesignBinding, custodyHoldPorts\)/, 'Custody and Scope, one row; no task record word as the retired Autonomy')
  assert.match(view, /const currentPerson = currentIdentity\(\)\?\.reading\.person_ref \?\? null/, 'the person is the current identity, never a value the desk composes')
  assert.doesNotMatch(read('agent/devices/sessionChainBindings.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the bindings read no design default or fixture')
})

test('(BD r19) the Group card carries its type, Discard removes the proposal, Retry reads the task\'s units and retries its unit, and another chain\'s device goes to its session as a message', async () => {
  bind.resetHolds()
  const calls = []
  const ports = {
    propose: async input => { calls.push(['propose', input]); return {record: {schema: 'central.agent-set/v1', agent_set_ref: input.ref, revision: 'r1', ...(input.type ? {type: input.type} : {})}} },
    removeSet: async input => { calls.push(['remove', input]); return {ref: input.ref} },
    retry: async input => { calls.push(['retry', input]); return {status: 'retried'} },
    ask: async input => { calls.push(['ask', input]); return {communique: 'communique:c1'} },
    suffix: () => 'x1',
  }
  const L = {...LEAD, agentRef: 'agent/aletheia'}, H = {...HELPER, agentRef: 'agent/anima'}
  const tracks = [GROUP, L, H, IDLE, OTHER]
  const rack = () => own.agentsetBinding({group: GROUP, tracks, holds: bind.chainHolds()}, ports)
  // Type: the card's own hold, a pattern's id; Central's propose takes it (Central #318).
  assert.equal(rack().standing['new.type'], undefined, 'Type stands')
  assert.equal(typeof rack().local['new.type'], 'function', 'the hand holds the type')
  assert.equal('type' in own.GROUP_REFUSE, false)
  await assert.rejects(() => rack().write([{key: 'new.make', value: JSON.stringify({for: 'Check the release', chains: [L.sessionRef, H.sessionRef], type: 'Quorum!'})}]),
    {message: own.GROUP_REFUSE.badType('Quorum!')})
  assert.equal(calls.length, 0, 'a malformed type asks Central nothing')
  await rack().write([{key: 'new.make', value: JSON.stringify({for: 'Check the release', chains: [L.sessionRef, H.sessionRef], type: 'quorum'})}])
  assert.deepEqual(calls.at(-1), ['propose', {scope: 'root', ref: 'agent-set:check-the-release-x1', revision: 'r1',
    members: [{kind: 'agent', agent_ref: 'agent/aletheia'}, {kind: 'agent', agent_ref: 'agent/anima'}], reason: 'Check the release', type: 'quorum'}])
  // Discard: Central's central.agent-set.remove of the ref it proposed, at the revision its record names; the card lets it go.
  assert.equal(rack().standing['new.discard'], undefined, 'Discard stands')
  assert.equal('discard' in own.GROUP_REFUSE, false)
  await rack().write([{key: 'new.discard', value: true}])
  assert.deepEqual(calls.at(-1), ['remove', {scope: 'root', ref: 'agent-set:check-the-release-x1', expected_revision: 'r1'}])
  assert.equal(bind.viewHolds(bind.chainHolds(), own.AGENTSET_ID)['new.proposal'], undefined, 'the card lets the proposal go')
  await assert.rejects(() => rack().write([{key: 'new.discard', value: true}]), {message: own.GROUP_REFUSE.noProposal})
  // Retry: the chosen chain's session, whose task's units Factory names; the carrier reads them and retries the unit (taskBindings.ts retryTask).
  assert.equal(rack().standing.retry, undefined, 'Retry stands with its carrier')
  await assert.rejects(() => rack().write([{key: 'retry', value: true}]), {message: own.CHAIN_LIST_REFUSE.noneChosen('Retry')})
  rack().local.member(H.sessionRef)
  await rack().write([{key: 'retry', value: true}])
  assert.deepEqual(calls.at(-1), ['retry', {project: H.project ?? '', agent_session: H.sessionRef}])
  // A device of another session's chain: a message to that session (Messages' delegate), never a write of its binding.
  assert.equal(rack().standing.dev, undefined, 'the Devices view stands with its carrier')
  await rack().write([{key: own.memberDeviceKey(H.sessionRef, 'actuation:harness-model'), value: '{"effort":"max"}'}])
  const [kind, asked] = calls.at(-1)
  assert.equal(kind, 'ask')
  assert.deepEqual([asked.agent_session, asked.agent_ref, asked.device], [H.sessionRef, 'agent/anima', 'actuation:harness-model'])
  assert.match(asked.words, /Effort to max/, 'the message says the change in words')
  await assert.rejects(() => rack().write([{key: own.memberDeviceKey(IDLE.sessionRef, 'actuation:harness-model'), value: '{"effort":"max"}'}]), /seats no agent/)
  await assert.rejects(() => rack().write([{key: own.memberDeviceKey(H.sessionRef, 'actuation:harness-model'), value: 'not json'}]), {message: own.CHAIN_LIST_REFUSE.devChange})
  bind.resetHolds()
})

// Round 870 (DLW build ruling 2026-11-05): Stop after's face sits beside Retry on the chain's task row, as Live keeps a Clip Stop button in
// every track's slots (§19.4). Its carrier asks Software Factory to stop the chosen chain's task's current attempt (taskBindings.ts
// stopAfterTask, factory_owner attempt-request-cancellation); it lights while the chain is at work.
test('(r870) Stop after stands beside Retry on the chosen chain: its carrier stops the task\'s current attempt, drawn and written down', async () => {
  bind.resetHolds()
  const calls = []
  const L = {...LEAD, agentRef: 'agent/aletheia'}, H = {...HELPER, agentRef: 'agent/anima'}
  const tracks = [GROUP, L, H, IDLE, OTHER]
  const rack = ports => own.agentsetBinding({group: GROUP, tracks, holds: bind.chainHolds()}, ports)
  assert.equal(rack({}).standing.stopAfter?.disabled, own.AGENTSET_REFUSE.stopAfter, 'no carrier: dark, saying why')
  assert.match(own.AGENTSET_REFUSE.stopAfter, /^Stop after: no carrier to Factory's attempt-task-units and attempt-request-cancellation stands on this rack/)
  const ports = {stopAfter: async input => { calls.push(['stopAfter', input]); return {status: 'cancel-requested'} }}
  assert.equal(rack(ports).standing.stopAfter, undefined, 'Stop after stands with its carrier')
  await assert.rejects(() => rack(ports).write([{key: 'stopAfter', value: true}]), {message: own.CHAIN_LIST_REFUSE.noneChosen('Stop after')})
  rack(ports).local.member('factory:decision-helper')
  await assert.rejects(() => rack(ports).write([{key: 'stopAfter', value: true}]), {message: own.CHAIN_LIST_REFUSE.helperStop})
  rack(ports).local.member(H.sessionRef)
  await rack(ports).write([{key: 'stopAfter', value: true}])
  assert.deepEqual(calls.at(-1), ['stopAfter', {project: H.project ?? '', agent_session: H.sessionRef}])
  // The face: Stop after beside Retry in the selected chain's row, lit while the chain works.
  const face = read('inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')
  assert.match(face, /\{retryAction\(p, chosen\)\}\n\s*\{stopAfterAction\(p, chosen\)\}/, 'beside Retry')
  assert.match(face, /label="Stop after" does=\{SAYS\.stopAfter\}/)
  assert.match(face, /can = chosen\?\.state === 'working'/, 'it lights while the chain is at work')
  // The chain wires the carrier: the chosen chain's bound task, its current unit asked to stop.
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /await stopAfterTask\(request => factoryOwnerWrite\(transport, request, `factory_owner \$\{request\.kind\}`\), custodyState, await boundTaskOf\(transport, project, agent_session, 'Stop after'\)\)/)
  // The manual's line (§19.4 Rules).
  const manual = readFileSync(new URL('../../../../ProjectCentral/docs/1-vision/dlw/DLW.md', import.meta.url), 'utf8')
  const agent = manual.slice(manual.indexOf('### 19.4 Agent'), manual.indexOf('### 19.5 Experiment'))
  assert.match(agent, /- Stop after stands beside Retry on the chain's task row, as Live keeps a\s+Clip Stop button in every track's slots\./)
  bind.resetHolds()
})

test('(BD r19, Central #318) the chain is the agent\'s profile: Rename on the Agent\'s head and a SkillSet dropped on the rack write it at its revision', async () => {
  const PROFILE = {profile_ref: 'agent-profile:kite', revision: 'p3', agent_ref: 'agent/kite', name: 'Kite', skill_set_refs: ['sets/core', 'sets/review']}
  const profile = own.chainProfileOf(PROFILE)
  assert.deepEqual(profile, {profileRef: 'agent-profile:kite', revision: 'p3', name: 'Kite', skillSetRefs: ['sets/core', 'sets/review']})
  assert.equal(own.chainProfileOf({agent_ref: 'agent/kite'}), null, 'no ref or revision: nothing to write at')
  const acts = []
  const heads = own.profileHeadActs(profile, async (action, input) => { acts.push([action, input]); return {state: 'saved'} })
  assert.deepEqual([heads.agent.rename.ask, heads.agent.rename.value], ['name', 'Kite'], 'Rename asks the name, the one standing first')
  await heads.agent.rename.run('Keeper')
  assert.deepEqual(acts.at(-1), ['agent-profile.rename', {scope: 'root', profile_ref: 'agent-profile:kite', expected_revision: 'p3', name: 'Keeper'}])
  assert.equal(heads.skillset['hot-swap'].refused, own.PROFILE_REFUSE.swapPress('sets/core'), 'the rack\'s Hot-swap is a drop from the browser, and says so')
  assert.deepEqual(own.replaceRequest(profile, 'sets/night'), {action: 'agent-profile.chain-replace',
    input: {scope: 'root', profile_ref: 'agent-profile:kite', expected_revision: 'p3', replace: 'sets/core', with: 'sets/night'}})
  assert.deepEqual(own.replaceRequest(profile, 'sets/review'), {refused: own.PROFILE_REFUSE.swapSame('sets/review')})
  assert.deepEqual(own.replaceRequest({...profile, skillSetRefs: []}, 'sets/night'), {refused: own.PROFILE_REFUSE.swapNone})
  // The order of what it carries (round 869): Central's agent-profile.chain-order, every ref the profile carries in the new order, at its revision.
  assert.deepEqual(own.orderRequest(profile, ['sets/review', 'sets/core']), {action: 'agent-profile.chain-order',
    input: {scope: 'root', profile_ref: 'agent-profile:kite', expected_revision: 'p3', skill_set_refs: ['sets/review', 'sets/core']}})
  assert.equal(own.profileHeadActs(null).agent.rename.refused, own.PROFILE_REFUSE.unread('Rename'))
  assert.equal(own.profileHeadActs(profile).agent.rename.refused, own.PROFILE_REFUSE.noCarrier('Rename'))
  // Factory's chain publishes them, and carries the rack's Discard, Retry and a device of another chain to their owners.
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /slot\.id === 'agent' \? \{acts: profileActs\.agent\} : slot\.id === 'skillset' \? \{acts: profileActs\.skillset\}/)
  assert.match(chain, /active\.drag\.family === 'skillset' && target\.kind === 'card' && target\.id === 'skillset'/, 'a SkillSet dropped on the rack hot-swaps')
  assert.match(chain, /reorder: async \(refs: readonly string\[\]\) => \{ const asked = orderRequest\(chainProfile, refs\); await profileAct\(asked\.action, asked\.input\) \}/,
    'the rack\'s Sets move through Central\'s chain-order')
  assert.match(chain, /removeSet: input => setAct\(transport, 'central\.agent-set\.remove', input\)/)
  assert.match(chain, /await retryTask\(request => factoryOwnerWrite\(transport, request/)
  // Another chain's device: a message sent to its agent's Position, then delegated into its task, both through AIKit's gateway (Messages' own
  // route); the chain never reaches the rail's Messages device for it (tests/agent-rail-devices.test.mjs "one publisher").
  assert.match(chain, /gatewayWriteOp\(\{kind: 'send', \.\.\.scope, to: position, body: words\}\), ROUTE_WORDS\.send\)/)
  assert.match(chain, /gatewayWriteOp\(\{kind: 'delegate', \.\.\.scope, communique, work,/)
  assert.doesNotMatch(chain, /publishedDevice\(MESSAGES_ID\)/)
  assert.match(chain, /acts: padsActs/, 'the pads\' head carries Save as preset and Hot-swap')
})

// BD round 20 PORT (round 869): Hand back is Factory's custody hold. A person takes a hold on what an agent holds when they edit it, and gives it
// back with Hand back (factory_owner {kind: 'custody-hold', state_path, custody_ref, act: take | give-back, reason, subject_ref?,
// expected_revision?}); the light is the custody listing's hand_back {lit, held} (Factory work_custody.rs HandBackReading). FAKE: the listing
// in Factory's own shape (factory.work-custody-listing/v1) and a recording port; never a real hold.
test('(BD r20) Hand back: the light is the custody listing\'s hand_back, a held record you edited reads edited, and the press gives back each hold the agent\'s work carries at its revision', async () => {
  const record = (ref, position, work, state, revision, hold) => ({schema: 'factory.work-custody/v1', custody_ref: ref, position_ref: position, work_ref: work, state,
    assigned_at_unix_ms: 1, reason: 'assigned', revision, updated_at_unix_ms: 2, transitions: [],
    ...(hold ? {person_hold: {held_by: 'person:frank', authority_ref: 'grant:frank', subject_ref: 'file:notes.md', reason: 'edited', taken_at_unix_ms: 3}} : {})})
  const LISTING = {schema: 'factory.work-custody-listing/v1', project_ref: 'project:o-i', filter: {}, count: 3, custody: [
    record('custody:1', 'position:lead', 'central:task:t1', 'in-progress', 3, true), record('custody:2', 'position:lead', 'central:task:t2', 'blocked', 5, false),
    record('custody:3', 'position:other', 'central:task:t3', 'in-progress', 1, true)], hand_back: {lit: true, held: ['custody:1', 'custody:3']}}
  const custody = (value = LISTING) => ({statePath: '/state', listing: {status: 'answered', value, error: null}, agentPosition: 'position:lead', work: 'central:task:t1'})
  const asked = []
  const hold = async request => { asked.push(request); return {schema: 'factory.work-custody-receipt/v1', result: 'applied'} }
  const binding = own.custodyBinding({sessionRef: LEAD.sessionRef, agent: {light: 'lit'}, person: 'person:frank', custody: custody()}, null, {hold})
  assert.equal(binding.values.handBackLit, true, 'lit: a hold stands on what the agent holds')
  assert.deepEqual(JSON.parse(binding.values.held), [{id: 'custody:1', name: 'central:task:t1', kind: 'work', state: 'edited', by: 'person:frank'},
    {id: 'custody:2', name: 'central:task:t2', kind: 'work', state: 'blocked'}], 'what you edited reads edited, by you; another Position\'s is not this agent\'s')
  for (const key of ['handBack', 'handBackLit']) assert.equal(binding.standing[key], undefined, key)
  await binding.write([{key: 'handBack', value: true}])
  assert.deepEqual(asked, [{kind: 'custody-hold', state_path: '/state', custody_ref: 'custody:1', act: 'give-back',
    reason: 'person:frank gave back what they edited, from the desk.', expected_revision: 3}], 'each hold on what this agent holds, at its revision as read')
  // REPLACED (round 870; DLW build ruling 2026-11-05, "No separate Take button"): the edit's side was a `take` write key on Custody, sent
  // with the record's ref (custody:2, its revision 5); the take is now the edit path's own first step (holdBeforeEdit, below).
  assert.equal(binding.writes('take'), false, 'Custody writes no take of its own')
  // Dark: nothing you edited is held, so the press asks nothing.
  const dark = own.custodyBinding({sessionRef: LEAD.sessionRef, agent: {}, person: 'person:frank', custody: custody({...LISTING, hand_back: {lit: false, held: []}})}, null, {hold})
  assert.equal(dark.values.handBackLit, false)
  asked.length = 0
  await assert.rejects(() => dark.write([{key: 'handBack', value: true}]), /^Error: Hand back: nothing you edited is held by this session's agent\.$/)
  assert.equal(asked.length, 0)
  // Lit for another agent's hold only: this agent's light stays dark.
  assert.equal(own.custodyValues({sessionRef: LEAD.sessionRef, agent: {}, custody: custody({...LISTING, hand_back: {lit: true, held: ['custody:3']}})}).handBackLit, false)
  // A Factory before round 20 answers no hand_back: the light names that, and Hand back asks nothing.
  const older = own.custodyBinding({sessionRef: LEAD.sessionRef, agent: {}, person: 'person:frank', custody: custody({...LISTING, hand_back: undefined})}, null, {hold})
  assert.equal(older.values.handBackLit, undefined)
  assert.match(older.standing.handBackLit.disabled, /Factory's custody list answers no hand_back/)
  assert.match(older.standing.handBack.disabled, /^Hand back: Factory's custody list answers no hand_back/)
  // No carrier, no person: each says so before Factory is asked.
  assert.match(own.custodyBinding({sessionRef: LEAD.sessionRef, agent: {}, person: 'person:frank', custody: custody()}, null, {}).standing.handBack.disabled,
    /^Hand back: the kernel carrier is unavailable here, so Factory cannot be asked\.$/)
  assert.match(own.custodyBinding({sessionRef: LEAD.sessionRef, agent: {}, custody: custody()}, null, {hold}).standing.handBack.disabled,
    /^Hand back: only the person sets it from here, and no person is current/)
  // Factory's refusal stands in its words.
  const refusing = own.custodyBinding({sessionRef: LEAD.sessionRef, agent: {}, person: 'person:frank', custody: custody()}, null,
    {hold: async () => { throw Error('custody custody:1 is already held by person:ada since 3') }})
  await assert.rejects(() => refusing.write([{key: 'handBack', value: true}]), {message: 'custody custody:1 is already held by person:ada since 3'})
  // The chain sends it through the kernel's factory_owner and reads the custody list again after it.
  // REPLACED (round 870): the port stood in FactoryDeviceChain.tsx (`.finally(refreshCustody)`); it is the session's custody's, shared with
  // the Clip view and the transport (sessionCustody.ts), and the chain takes it from there.
  const custodyModule = read('agent/devices/sessionCustody.ts')
  assert.match(custodyModule, /request => factoryOwnerWrite\(transport, request, '`factory development custody hold`'\)\.finally\(refresh\)/)
  assert.match(read('agent/devices/FactoryDeviceChain.tsx'), /hold: sessionCustody\.hold/)
})

// Round 870 (DLW build ruling 2026-11-05; §19.4 "When you edit something the agent holds, the agent does not overwrite your edit"): a
// person's edit of a record the agent holds takes the hold first, in the edit path itself; there is no separate Take button. FAKE: the
// listing in Factory's own shape and a recording port.
test('(r870) Take: an edit of what the agent holds takes Factory\'s hold first, naming what was edited at the record\'s revision; a hold that cannot be taken writes nothing', async () => {
  const record = (ref, position, work, state, revision, hold) => ({schema: 'factory.work-custody/v1', custody_ref: ref, position_ref: position, work_ref: work, state,
    assigned_at_unix_ms: 1, reason: 'assigned', revision, updated_at_unix_ms: 2, transitions: [],
    ...(hold ? {person_hold: {held_by: 'person:frank', authority_ref: 'grant:frank', subject_ref: 'file:notes.md', reason: 'edited', taken_at_unix_ms: 3}} : {})})
  const LISTING = {schema: 'factory.work-custody-listing/v1', project_ref: 'project:o-i', filter: {}, count: 3, custody: [
    record('custody:1', 'position:lead', 'central:task:t1', 'in-progress', 3, false), record('custody:2', 'position:lead', 'central:task:t2', 'blocked', 5, true),
    record('custody:3', 'position:other', 'central:task:t3', 'in-progress', 1, false)], hand_back: {lit: true, held: ['custody:2']}}
  const custody = (over = {}) => ({statePath: '/state', listing: {status: 'answered', value: LISTING, error: null}, agentPosition: 'position:lead', work: 'central:task:t1', ...over})
  const asked = []
  const hold = async request => { asked.push(request); return {schema: 'factory.work-custody-receipt/v1', result: 'applied'} }
  await own.holdBeforeEdit(custody(), 'person:frank', hold, 'agent-session/fx-aletheia/settings/name')
  assert.deepEqual(asked, [{kind: 'custody-hold', state_path: '/state', custody_ref: 'custody:1', act: 'take', reason: 'person:frank edited what the agent holds, from the desk.',
    subject_ref: 'agent-session/fx-aletheia/settings/name', expected_revision: 3}], 'the session\'s work is the agent\'s record: its hold is taken, with what was edited')
  asked.length = 0
  for (const over of [{work: 'central:task:t2'}, {work: 'central:task:t3'}, {work: 'central:task:none'}, {work: null}, {agentPosition: null},
    {listing: {status: 'reading', value: null, error: null}}, {listing: {status: 'refused', value: null, error: 'Factory refused'}}, {listing: null}]) {
    await own.holdBeforeEdit(custody(over), 'person:frank', hold, 's/settings/name')
  }
  await own.holdBeforeEdit(null, 'person:frank', hold, 's/settings/name')
  assert.equal(asked.length, 0, 'a record a person holds already, another Position\'s, work no record names, and a listing not read ask nothing: the edit is written as before')
  // What cannot be taken refuses the edit in words, and nothing is sent.
  const refusal = /^Error: Your edit: the agent holds this task's work \(custody:1\), and (.+); nothing was written, so the agent does not overwrite it\.$/
  await assert.rejects(() => own.holdBeforeEdit(custody({listing: {status: 'answered', value: {...LISTING, hand_back: undefined}, error: null}}), 'person:frank', hold, 's'),
    err => refusal.test(String(err)) && String(err).includes(own.EDIT_HOLD_WHY.noHandBack))
  await assert.rejects(() => own.holdBeforeEdit(custody({statePath: null}), 'person:frank', hold, 's'), err => String(err).includes(own.EDIT_HOLD_WHY.noState))
  await assert.rejects(() => own.holdBeforeEdit(custody(), null, hold, 's'), err => refusal.test(String(err)) && String(err).includes(own.EDIT_HOLD_WHY.noPerson))
  await assert.rejects(() => own.holdBeforeEdit(custody(), 'person:frank', undefined, 's'), err => String(err).includes(own.EDIT_HOLD_WHY.noCarrier))
  assert.equal(asked.length, 0)
  // Factory's refusal of the take stands in its words, and the edit is not written after it.
  await assert.rejects(() => own.holdBeforeEdit(custody(), 'person:frank', async () => { throw Error('custody custody:1 is already held by person:ada since 3') }, 's'),
    {message: 'custody custody:1 is already held by person:ada since 3'})
  // The paths that write a task's settings take it first: the Clip view's seams, the Tasks device's settings and Loop's song.
  const tasks = read('agent/devices/taskBindings.ts')
  assert.equal(tasks.match(/await context\.holdFirst\?\.\(settingSubject\([^)]*\)\)\n\s*await writeSessionSettings\(/g)?.length, 2, 'the seams and the Tasks device: the hold, then the write')
  const clips = read('agent/clipBinding.ts')
  assert.match(clips, /await seat\.context\.holdFirst\?\.\(settingSubject\(seat\.task\.sessionRef, 'loop'\)\)\n\s*await writeSessionSettings\(/)
  assert.match(clips, /const \{holdFirst\} = useSessionCustody\(transport, custodyAt\)/)
  assert.match(clips, /refused: answer\.reading\.error, holdFirst\}/)
  // The custody it reads is the chain's own reading (one key for the three views).
  assert.match(read('agent/devices/FactoryDeviceChain.tsx'), /const sessionCustody = useSessionCustody\(transport, custodyAt\)/)
})
