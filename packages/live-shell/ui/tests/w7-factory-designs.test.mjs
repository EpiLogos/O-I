// Lane W7, Factory's design packages (D3, D4, D5, D7) and two of W3's own findings, on their owners: Messages' groups from Central's agent
// sets; Capture skill on the armed track's chain with AIKit's inbox and promote; the Prompt pads and the Run map bound for Factory's Main
// track (standing where Software Factory's family admits their faces); the Journey on Runs, Structure on the Run device and the Thought page
// on the Thread; the Skillset rack's and its member's upkeep pages; the Agent's Context page; the Grants page on Custody. Where no committed
// route answers, each reading stands absent and each act disabled naming its exact command.
//
// Channels:
// - REAL (read-only captures, 21 Oct): `ctrl --json action run central.agent-set.list {scope}` (tests/fixtures/central-agent-sets-
//   2026-10-21.json), `aikit inbox --json` (tests/fixtures/aikit-inbox-2026-10-21.json, five of its 37 items), `aikit gateway who`
//   (tests/fixtures/workcell-readings-2026-10-21.json).
// - FAKE: a skill candidate in the inbox's real item shape (the real inbox holds only script candidates); every write goes to a recording
//   port or a fake kernel transport — AIKit's promote is never run.
// - SCRIPTED: the catalogue designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
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
const {designKey} = await import('../src/frame/devices/designs.ts')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const routes = await import('../src/agent/devices/ownerRoutes.ts')
const msg = await import('../src/agent/devices/messagesBinding.ts')
const capture = await import('../src/agent/devices/captureSkillBinding.ts')
const pads = await import('../src/agent/devices/promptPadsBinding.ts')
const runMap = await import('../src/agent/devices/runMapBinding.ts')
const places = await import('../src/agent/devices/factoryPlaces.ts')
const tasks = await import('../src/agent/devices/taskBindings.ts')
const session = await import('../src/agent/devices/sessionChainBindings.ts')
const thread = await import('../src/agent/devices/threadBinding.ts')
const {design: messagesDesign} = await import('../src/inhabitants/catalogue/panels/ai-kit__messages.tsx')
const {design: captureDesign} = await import('../src/inhabitants/catalogue/panels/capture-skill.tsx')
const {design: padsDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__prompt-pads.tsx')
const {design: runMapDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__run-map.tsx')
const {design: custodyDesign} = await import('../src/inhabitants/catalogue/panels/agent-custody.tsx')
const {skills: rackDesign} = await import('../src/inhabitants/catalogue/panels/skills.tsx')
const {memberDevice: memberDesign} = await import('../src/inhabitants/catalogue/panels/member.tsx')
// Runs' and the Run device's designs were retired in the 22 Oct manual rewrite (#725; §16.1 "The course of a run is its track in Arrangement
// view; its attempts are takes; a task is a clip"); their bindings stay and are checked on their own values. Capture skill is the Skillset
// rack's Capture page (§19.11, `capture.`); capture-skill.tsx is the plain module the rack draws it through.
const carry = await import('../src/agent/devices/oneAgentBinding.ts')
const {design: threadDesign} = await import('../src/inhabitants/catalogue/panels/thread.tsx')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const SETS = json('./fixtures/central-agent-sets-2026-10-21.json')
const INBOX = json('./fixtures/aikit-inbox-2026-10-21.json')
const READ21 = json('./fixtures/workcell-readings-2026-10-21.json')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const answered = value => ({status: 'answered', value, error: null})
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const hosted = (designed, binding) => host.viewsOf(designed).map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent' : null
const ANSWERED = {gatewayAdmitted: true, gatewayDoc: {state: 'ready'}}

/** A fake kernel transport (a bridge whose fetch records each op and answers the owner's own shape). */
function fakeKernel(answer) {
  const ops = []
  const was = globalThis.fetch
  globalThis.fetch = async (url, init) => { const op = JSON.parse(init.body); ops.push(op); return {json: async () => ({ok: true, outcome: answer(op)})} }
  return {transport: {kind: 'bridge', url: 'http://fake-kernel.test'}, ops, restore: () => { globalThis.fetch = was }}
}

/** A skill candidate in the real inbox item's shape (FAKE: the real inbox holds only script candidates), kept under `dir`. */
const skillItem = (dir, created = '2026-10-21T12:00:00Z') => ({...INBOX.data.items[0], id: 'inb_skill', created, title: 'Save “release a skill” as a skill?',
  evidence: [{evidence: 'hash', label: 'candidate', value: 'cnd_skill'}, {evidence: 'hash', label: 'proposed-id', value: 'skill/personal/skill-release'},
    {evidence: 'file', path: `/Users/admin/.aikit/inbox/${dir}/cnd_skill/body`}, {evidence: 'summary', text: 'release a skill'}]})

test('1 · Messages\' groups are Central\'s agent sets (REAL), each member at the Position its agent occupies or is placed at, else its own agent ref', () => {
  bind.resetHolds()
  const agentSets = [{scope: 'root', answer: {status: 'answered', value: SETS.root}}, {scope: 'project', answer: {status: 'answered', value: SETS.project}}]
  const binding = msg.messagesBinding({population: answered(READ21.population), gateway: ANSWERED, project: 'O-I', agentSets, holds: bind.chainHolds()})
  const groups = JSON.parse(binding.values.groups)
  assert.deepEqual(groups.map(group => group.id), SETS.root.records.map(row => row.record.ref), 'the root\'s seven sets; the project holds none')
  const aletheia = groups.find(group => group.id === 'aletheia')
  assert.equal(aletheia.members[0], 'central:position:project:O-I:aletheia-5', 'the lead at the Position it occupies')
  assert.ok(aletheia.members.includes('agent/aletheia-janus'), 'a member no Position names stands as its agent ref, never invented')
  assert.match(aletheia.for, /^Owner instruction 2026-09-24: Aletheia made properly/)
  for (const group of groups) for (const key of ['join', 'last', 'at', 'unread']) assert.equal(group[key], undefined, `${group.id} ${key}: no reading`)
  assert.equal(msg.positionOfAgent('agent/nobody', READ21.population), null)
  const refused = msg.messagesBinding({population: answered(READ21.population), gateway: ANSWERED, project: 'O-I', holds: bind.chainHolds(),
    agentSets: [{scope: 'root', answer: {status: 'refused', error: 'central.agent-set.list requires scope.'}}]})
  assert.equal(refused.standing.groups.disabled, 'central.agent-set.list requires scope.', 'the refusal in Central\'s words')
  const rail = read('agent/devices/AgentRailDevices.tsx')
  assert.match(rail, /useCentralAction\(transport, AGENT_SET_LIST, ROOT_SETS\)/)
  assert.match(rail, /const PROJECT_SETS = \{scope: 'project', project: RACK_PROJECT\} as const/)
  const drawn = hosted(messagesDesign, binding).map(([, markup]) => markup).join('\n')
  assert.ok(drawn.includes('epi-logos-domain-team'), 'the real groups are drawn')
  assert.doesNotMatch(drawn, /Writes, audits and judges the manual/, 'never the design\'s sample group')
})

test('2 · Capture skill: the proposal that waits is AIKit\'s newest open Method or Skill candidate (Ready under ready/, Held under quarantine/); Accept promotes it', async () => {
  bind.resetHolds()
  assert.equal(capture.waitingProposal(INBOX.data), null, 'the REAL inbox waits on scripts only: no Method or Skill')
  assert.deepEqual(capture.waitingProposal({items: [skillItem('ready')]}), {candidate: 'cnd_skill', proposedId: 'skill/personal/skill-release', state: 'ready', title: 'Save “release a skill” as a skill?'})
  assert.equal(capture.waitingProposal({items: [skillItem('quarantine')]}).state, 'held')
  assert.equal(capture.waitingProposal({nope: true}), undefined)
  const none = capture.captureSkillBinding({inbox: answered(INBOX.data), holds: bind.chainHolds()}, {promote: async () => ({})})
  assert.equal(none.values.proposal, undefined)
  assert.match(none.standing.proposal.disabled, /No Method or Skill waits in AIKit's inbox/)
  assert.match(none.standing.accept.disabled, /No Method or Skill waits/)
  const promoted = []
  const inbox = answered({items: [...INBOX.data.items, skillItem('ready')]})
  const binding = capture.captureSkillBinding({inbox, holds: bind.chainHolds()}, {promote: async (candidate, id) => { promoted.push([candidate, id]) }})
  assert.deepEqual([binding.values.proposal, binding.values.name, binding.values.light], ['ready', 'skill/personal/skill-release', 'lit'])
  assert.equal(binding.standing.accept, undefined, 'a Ready proposal: Accept stands (the view asks first)')
  await binding.write([{key: 'accept', value: true}])
  assert.deepEqual(promoted, [['cnd_skill', 'skill/personal/skill-release']])
  binding.local.name('skill/personal/release-a-skill')
  await capture.captureSkillBinding({inbox, holds: bind.chainHolds()}, {promote: async (candidate, id) => { promoted.push([candidate, id]) }}).write([{key: 'accept', value: true}])
  assert.deepEqual(promoted.at(-1), ['cnd_skill', 'skill/personal/release-a-skill'], 'the name the hand gave is the id it is kept under')
  const held = capture.captureSkillBinding({inbox: answered({items: [skillItem('quarantine')]}), holds: bind.chainHolds()}, {promote: async () => ({})})
  assert.match(held.standing.accept.disabled, /never promoted/)
  for (const key of ['remove', 'release']) await assert.rejects(() => binding.write([{key, value: true}]), new RegExp(key === 'remove' ? 'aikit inbox reject' : 'rescan'))
  await assert.rejects(() => binding.write([{key: 'step:edit', value: false}]), /drafting the steps/)
  assert.match(capture.captureSkillBinding({inbox: {status: 'refused', value: null, error: routesEnvelope('aikit inbox: no home')}, holds: bind.chainHolds()}).standing.proposal.disabled, /^aikit inbox: no home$/)
  // Through the kernel: aikit_write promote.
  const kernel = fakeKernel(() => ({result: 'owner_route_reading', route: 'aikit promote', data: {id: 'skill/personal/skill-release'}, receipts: []}))
  try {
    await routes.ownerRouteWrite(kernel.transport, routes.aikitWriteOp({kind: 'promote', project: 'O-I', candidate: 'cnd_skill', id: 'skill/personal/skill-release'}), '`aikit promote`')
    assert.deepEqual(kernel.ops, [{op: 'aikit_write', request: {kind: 'promote', project: 'O-I', candidate: 'cnd_skill', id: 'skill/personal/skill-release'}}])
  } finally { kernel.restore() }
  bind.resetHolds()
})
const routesEnvelope = message => JSON.stringify({kind: 'owner-refused-or-failed', message, operation_may_have_run: false})

test('2 · Capture skill is the Skillset rack\'s Capture page on the armed track\'s chain — a session\'s — never a group\'s, a workcell\'s or the Main track\'s', () => {
  // REPLACED (#725): "Capture skill stands on the armed track's chain, after Scope; it is AIKit's own face" — the 22 Oct manual rewrite
  // retired it as a device of its own (§19.11: "Turning something you did by hand into a skill is the Capture page of the Skillset rack
  // (§19.7)"): AIKit admits no capture-skill face, no chain has a Capture plate, and the rack carries the capture binding under `capture.`
  // while it stands on a session's (the armed track's) chain.
  assert.equal(capture.captureSkillDevice(), null, 'no Capture skill device of its own')
  for (const key of Object.keys(captureDesign.defaults)) assert.ok(`capture.${key}` in rackDesign.defaults, `the rack carries capture.${key}`)
  assert.deepEqual(places.chainSlots({kind: 'session', group: false}), ['agent', 'skillset', 'world'])
  assert.deepEqual(places.chainSlots({kind: 'session', group: true}), ['agentset', 'agent', 'skillset', 'world'])
  assert.deepEqual(places.chainSlots({kind: 'main'}), ['approvals'])
  assert.equal(places.SLOT_DEVICE.capture, undefined, 'no Capture plate')
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /const captureOn = sessionChain && !groupTrack\n/)
  assert.match(view, /const rackCarrying = useMemo\(\(\) => \(rackDesignBinding \? carryPages\(rackDesignBinding, captureOn \? \[\{page: CAPTURE_PAGE, binding: captureDesignBinding\}\] : \[\]\) : null\)/)
  assert.doesNotMatch(view, /placed\(CAPTURE_SKILL_ID/, 'no Capture plate on any chain')
  assert.match(view, /promote: \(candidate, id\) => ownerRouteWrite\(transport, aikitWriteOp\(\{kind: 'promote', project: RACK_PROJECT, candidate/)
})

// REPLACED (lane W8): the Prompt pads read Factory's bank through factory_owner locate and pads-read and write through pads-write
// (w8-factory-routes.test.mjs); the Main track's order is still §16.2's.
test('3 · the Prompt pads stand on the Main track in §16.2\'s order: the Run map, Approvals and the prompt pads', () => {
  // REPLACED (#725): "the Run map, the experiments, Approvals and the prompt pads" — the manual's §16.2 now reads "On the Main track: the Run
  // map, Approvals and the prompt pads", the Experiment retired (§19.5: a task launched with Repeat, its takes compared with Compare).
  assert.deepEqual(places.chainSlots({kind: 'main'}, {pads: true, runMap: true}), ['run-map', 'approvals', 'prompt-pads'])
  const padsDevice = pads.promptPadsDevice()
  assert.ok(padsDevice, 'Software Factory admits the prompt-pads face: its plate stands on the Main track')
  assert.equal(padsDevice.id, pads.PROMPT_PADS_ID)
  assert.match(pads.PADS_REFUSE.press, /Factory never runs a pad/)
})

test('4 · the Run map: no Run is named on the Main track, so its readings stand absent saying so; Retry and Continue name T-COVERAGE §1.2\'s Software Factory row', async () => {
  bind.resetHolds()
  const binding = runMap.runMapBinding(bind.chainHolds())
  for (const key of ['run', 'nodes', 'edges', 'ret', 'recognition', 'journey']) assert.match(binding.standing[key].disabled, /no Run is named on the Main track/, key)
  assert.match(binding.standing.retry.disabled, /factory_owner attempt-retry \(the attempt `retry`/)
  assert.match(binding.standing.continue.disabled, /`factory development mutate` for ContinueCommission/)
  assert.match(binding.standing.recognise.disabled, /factory_owner Recognise takes the Journey and the Return/)
  await assert.rejects(() => binding.write([{key: 'close', value: true}]), /factory_owner RunClose/)
  assert.equal(binding.values.show, 'all')
  const mapDevice = runMap.runMapDevice()
  assert.ok(mapDevice, 'Software Factory admits the run-map face: its plate stands on the Main track')
  assert.equal(mapDevice.id, runMap.RUN_MAP_ID)
  // D3: the Journey on Runs' binding, Structure on the Run's, the Thought page on the Thread (the Runs and the Run devices were retired in the
  // 22 Oct manual rewrite, §16.1; their bindings stay, and the Thread is the Agent's Full, §19.4).
  const runs = tasks.runsBinding('s', bind.chainHolds())
  assert.match(runs.standing.journey.disabled, /factory_development_read `run`/)
  const run = session.runBinding({session: null, tracks: null, nowUnixMs: 0, agent: {}, holds: bind.chainHolds()}, {select: () => {}})
  assert.match(run.standing.structure.disabled, /StructuralFidelityEvidence through the kernel \(T-COVERAGE §1\.2, Software Factory/)
  const thr = thread.threadBinding({selected: null, chainSession: null, tracks: null, nowUnixMs: 0, encounter: null, agent: {}, holds: bind.chainHolds()}, null, {select: () => {}})
  assert.match(thr.standing.thoughts.disabled, /the cognitive view \(Run Thought\)/)
  assert.match(thr.standing.operative.disabled, /a read of the project-development ledger/)
  thr.local.life('active')
  assert.equal(thread.threadValues({selected: null, chainSession: null, tracks: null, nowUnixMs: 0, encounter: null, agent: {}, holds: bind.chainHolds()}).life, 'active', 'the Thought page\'s filters are the hand\'s')
  bind.resetHolds()
})

// REPLACED (lane W8): the rack's upkeep pages, the member's Why and History, the Agent's Context page and Custody's Grants read and write
// through AIKit's and Actuation's routes (w8-factory-routes.test.mjs). What stays refused here is what no route carries.
test('5 · what no route carries stays refused: Retire and Restore (PERSON_ACTS names neither), a procedure run, an adoption with no digest, the last turn', async () => {
  const member = bind.memberBinding(bind.MEMBER_DEVICE_ID, {}, null, bind.chainHolds())
  for (const key of ['retire', 'restore']) assert.match(member.standing[key].disabled, /PERSON_ACTS names it not/, key)
  const action = readFileSync(new URL('../../../../desktop/cradle/kernel/src/action.rs', import.meta.url), 'utf8')
  const acts = action.slice(action.indexOf('pub const PERSON_ACTS'), action.indexOf('];', action.indexOf('pub const PERSON_ACTS')))
  assert.doesNotMatch(acts, /control\.skills/)
  // REPLACED (lane W9): Apply and Run write at the reviewed digest since the kernel's round of cdbde6fe7 (w9-approvals-ledger-sets.test.mjs).
  // REPLACED (lane K0): a bypass issue writes through aikit_write bypass-issue (k0-routes-bindings.test.mjs); no upkeep act stays refused.
  assert.deepEqual(Object.keys(bind.RACK_UPKEEP_REFUSE), [])
  assert.equal(bind.RACK_UPKEEP_WRITES.issue, 'bypass-issue')
  // REPLACED (lane W11): the last turn is read through aikit_read continuity-turn; not handed in, it says so.
  assert.match(bind.AGENT_CONTEXT_ABSENT['ctx.turn'], /`aikit work continuity turn` through the kernel's aikit_read/)
})

test('the bound designs draw on their bindings in all their views — no NaN, no undefined, never their fixture text — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const inbox = answered({items: [skillItem('ready')]})
  const cases = [
    [captureDesign, capture.captureSkillBinding({inbox, holds: bind.chainHolds()}, {promote: async () => ({})}), /Release a changed skill|Release, take 2|central-skill-release|GITHUB_TOKEN/, [capture.CAPTURE_REFUSE.remove]],
    [padsDesign, pads.promptPadsBinding(bind.chainHolds()), /Sweep the manual|Morning NOWs|blake3:9f2c41d07a/, [pads.PADS_REFUSE.press]],
    [runMapDesign, runMap.runMapBinding(bind.chainHolds()), /Type-check the roots|run:3|AgentShellContext/, [runMap.RUN_MAP_REFUSE.retry]],
    [custodyDesign, session.custodyBinding({sessionRef: 's', autonomy: 'review', agent: {light: 'lit'}, holds: bind.chainHolds()}, null), /flint-ql-20261014|Archetypal-Earth|owner withdrawal/, [session.CUSTODY_REFUSE.gate]],
    [rackDesign, bind.rackBinding('factory:skillset', {profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: bind.chainHolds()}, null, {project: 'O-I', sessionRef: null}),
      /prc_01M29MA279X5V519PSFXT0K3WV|b3:91d04c2e7a/, []],
    [memberDesign, bind.memberBinding(bind.MEMBER_DEVICE_ID, {}, null, bind.chainHolds()), /2 Oct 09:14|r6 reviewed and trusted/, []],
    // REPLACED (#725): Capture skill drawn on its successor too — the Skillset rack's Capture page (§19.11), the rack carrying the capture
    // binding under `capture.` as the chain does (FactoryDeviceChain.tsx rackCarrying), the page in front.
    [rackDesign, carry.carryPages(bind.rackBinding('factory:skillset', {profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: bind.chainHolds()}, null, {project: 'O-I', sessionRef: null}),
      [{page: carry.CAPTURE_PAGE, binding: capture.captureSkillBinding({inbox, holds: bind.chainHolds()}, {promote: async () => ({})})}]),
      /Release a changed skill|Release, take 2|central-skill-release|GITHUB_TOKEN|prc_01M29MA279X5V519PSFXT0K3WV|b3:91d04c2e7a/, [capture.CAPTURE_REFUSE.remove], 'capture'],
  ]
  for (const [design, binding, fixture, reasons, page] of cases) {
    if (page) host.setHostPage(binding.id, page)
    const drawn = hosted(design, binding)
    for (const [view, markup] of drawn) {
      assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
      assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
    }
    const all = drawn.map(([, markup]) => markup).join('\n')
    for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refused control says why (${why.slice(0, 50)}…)`)
    if (page) host.resetHost()
  }
  bind.resetHolds()
  host.resetHost()
})

test('(b) every key the newly bound designs read is an owner reading, absent with why, or the hand\'s', () => {
  bind.resetHolds()
  const cases = [
    [captureDesign, capture.captureSkillBinding({inbox: answered({items: [skillItem('ready')]}), holds: bind.chainHolds()}, {promote: async () => ({})})],
    [captureDesign, capture.captureSkillBinding({inbox: answered(INBOX.data), holds: bind.chainHolds()}, {promote: async () => ({})})],
    [padsDesign, pads.promptPadsBinding(bind.chainHolds())],
    [runMapDesign, runMap.runMapBinding(bind.chainHolds())],
    [custodyDesign, session.custodyBinding({sessionRef: 's', autonomy: 'review', agent: {light: 'lit'}, holds: bind.chainHolds()}, null)],
  ]
  for (const [design, binding] of cases) for (const key of designKeys(design)) {
    // Custody's Write mode is Scope's own key (custodyBinding stands it on Scope's standing).
    if (design.id === custodyDesign.id && key === 'writeMode') continue
    assert.ok(classify(binding, key), `${design.id} ${key}: a reading, absent with why, or the hand's`)
  }
  // REPLACED (#725): Runs' `journey` and the Run device's `structure` classified against their designs — both designs were retired (§16.1);
  // the readings stand absent on the bindings' own standing, as the designs read them.
  assert.equal(classify(tasks.runsBinding('s', bind.chainHolds()), 'journey'), 'absent', 'Runs\' binding: journey')
  assert.equal(classify(session.runBinding({session: null, tracks: null, nowUnixMs: 0, agent: {}, holds: bind.chainHolds()}, {select: () => {}}), 'structure'), 'absent', 'the Run\'s binding: structure')
  for (const [design, binding] of [[threadDesign, thread.threadBinding({selected: null, chainSession: null, tracks: null, nowUnixMs: 0, encounter: null, agent: {}, holds: bind.chainHolds()}, null, {select: () => {}})]]) {
    for (const key of ['thoughts', 'operative'].filter(key => key in design.defaults || Object.values(design.fixtures ?? {}).some(f => key in f))) {
      assert.equal(classify(binding, key), 'absent', `${design.id} ${key}`)
    }
  }
  for (const key of Object.keys(bind.AGENT_CONTEXT_ABSENT)) assert.ok(key in agentDesign.defaults, `${key} is a key of the Agent's design`)
  bind.resetHolds()
})
