// Ticket 804 — nothing in the shell still serves a retired device, and the Answer's face is drawn in the Agent (DLW §19.4 "The answer's
// face", §19.14, §23.4, §16.7, §19.1).
//   - The Diff tile is retired: the Diff is Files' Diff page (§23.4 "Reading what changed before you approve it … is the Diff page of
//     Files (§23.2)"). The Factory browser's Git row opens that page in a pane.
//   - The Agent answers with its speaking face where its voice is read (Central's chain carries the Answer's voice as the Agent's Voice
//     page): the voice's state and the face's own keys on the one Agent's binding, the face drawn in the Agent's views. Ported from the
//     retired Answer (central__nara-conversation.tsx at 322134d71^).
//   - The files nothing in the candidate loads are gone from src/agent, each with its replacement named.
// Channels: SCRIPTED (the designs drawn through the host on the bindings Central composes; hands recorded, never sent) and code-reading.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {existsSync, readFileSync} from 'node:fs'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const bind = await import('../src/agent/devices/designBindings.ts')
const vb = await import('../src/agent/devices/voiceBinding.ts')
const carry = await import('../src/agent/devices/oneAgentBinding.ts')
const threads = await import('../src/agent/devices/threadBinding.ts')
const {VOICE_OFF} = await import('../src/central/devices/answerVoice.ts')
const chain = await import('../src/central/devices/CentralDevices.tsx')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')
const {maskStatic} = await import('../src/agent/maskFace.ts')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const draw = (binding, view, page) => {
  host.resetHost(binding.id)
  if (page) host.setHostPage(binding.id, page)
  try { return renderToStaticMarkup(createElement(host.HostedDevice, {designed: agentDesign, binding, view, nav: {}})) } finally { host.resetHost(binding.id) }
}
/** The mask FaceStage draws on the server in a pose (agent/FaceStage.tsx: the shell's ink and ground, 150 px). */
const mask = expr => maskStatic(expr, 'var(--fizz)', 'var(--fizz)', 150, 'var(--bg-0)')
const ABSENT = 'Voice needs the desktop\'s own speech on this machine (the kernel op nara_voice: whisper.cpp hears, Kokoro speaks), and no native kernel stands here: the test carrier is down'
const SAID = 'What does this entry ask of me'
/** Central's Agent as CentralDevices.tsx composes it: its own binding (here the readings the dialogue reports) carrying the voice's page. */
const centralAgent = (own, state = VOICE_OFF, why = null, written = []) =>
  carry.composeAgentBinding({id: 'central:agent', values: own}, {voice: chain.centralVoiceBinding(state, why, async (key, value) => { written.push([key, value]) })})
const THREAD = JSON.stringify([{who: 'you', kind: 'you', text: 'Which unit starts first?'}, {who: 'Nara', kind: 'agent', text: 'The first, once the image is repaired.'}])

// ── the Diff tile ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the Diff tile is retired: no tile id, no body, no browser row (§23.4 "the Diff page of Files")', async () => {
  const tiles = await import('../src/agent/agentDockTiles.ts')
  assert.equal('diff' in tiles.TILE_ICONS, false, 'no Diff mark on the rail')
  assert.doesNotMatch(read('agent/AgentShellContext.tsx'), /'diff'/, 'no Diff tile id')
  assert.doesNotMatch(read('agent/AgentDockTileBody.tsx'), /op: 'git_diff_read'|id [!=]== 'diff'/, 'no Diff body: Files\' Diff page reads the seat\'s diff (widgets/railDevices.tsx)')
  assert.doesNotMatch(read('agent/AgentShellBrowser.tsx'), /toggleTile\('diff'\)|id: 'diff'/, 'no Context row and no Git press toggles a Diff tile')
  assert.doesNotMatch(read('shell/widgets.tsx'), /\bdiff: '/, 'no launcher hint for a tile the rail does not register')
})

test('the Git row opens Files full in a pane on its Diff page, where the seat\'s working diff is read (§23.2, §23.4)', async () => {
  const opened = []
  const door = await import('../src/frame/instrumentDoor.ts')
  const browser = await import('../src/agent/AgentShellBrowser.tsx')
  const {railDeviceId} = await import('../src/widgets/railDevices.tsx')
  const {DEVICE_PANE_KIND} = await import('../src/frame/devices/devicePane.tsx')
  door.publishInstrumentOpener((kind, at, subject) => { opened.push([kind, at, subject]) })
  try {
    browser.openSeatDiff()
    assert.equal(host.hostState(railDeviceId('files')).page, 'diff', 'Files stands on its Diff page')
    assert.deepEqual(opened, [[DEVICE_PANE_KIND, undefined, {ref: railDeviceId('files'), title: 'Files'}]], 'Files opens full in a pane')
  } finally { door.publishInstrumentOpener(null); host.resetHost(railDeviceId('files')) }
  door.publishInstrumentOpener(null)
  browser.openSeatDiff()
  assert.match(door.instrumentFault() ?? '', /No pane tree is mounted/, 'with no pane tree, the press says why on the frame\'s fault line')
  door.reportInstrumentFault(null)
  assert.match(read('agent/AgentShellBrowser.tsx'), /if \(category === 'git'\) openSeatDiff\(\)/, 'a press on the Git row opens it')
})

// ── the manifest and the grammar ──────────────────────────────────────────────────────────────────────────────────────────────────

test('Software Factory declares no Runs and no Tasks browser entry, and no Diff tile inspector (§19.1: a run is its track and take lanes, a task a clip)', async () => {
  const manifests = await import('../src/inhabitants/manifest.ts')
  const sf = manifests.inhabitantManifest('software-factory')
  assert.deepEqual(sf.browserEntries ?? [], [], 'no entry a retired device filled')
  assert.ok(!sf.inspectors.includes('diff-tile'), 'the Diff tile is Files\' Diff page')
  const grammar = await import('../src/shell/modeGrammar.ts')
  assert.deepEqual(grammar.MODE_GRAMMAR.factory.browser.map(category => category.id), ['factory-sessions', 'factory-agents'], 'no Runs, no Knowledge category')
})

// ── the files nothing loads ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('DELETED (#804) — the agent dock, the old Factory bar, their fixture and the queue model: each replaced, none left in src/agent', async () => {
  // AgentContextDock.tsx → the one widget rail (shell/widgets.tsx WIDGETS, F8; tests/f8-widgets.test.mjs, widget-rail-craft.test.mjs).
  // AgentShellTransport.tsx → the one transport's Factory slots (shell/transports/useFactoryTransport.tsx; tests/f7-transport.test.mjs,
  //   browser-transport-craft.test.mjs, transport-bindings.test.mjs).
  // agentShellFixture.tsx → the shell itself, mounted whole by tests/agent-shell-live.browser.mjs (its live and cut modes).
  // factoryQueueAdvance.ts → the owner's own close and advance: the kernel's run close (desktop/cradle/kernel/src/factory.rs
  //   RUN_CLOSE_CONTRACT, oi.factory-run-close/v1), whose order rules desktop/cradle/tests/factory-run-close.test.mjs holds; Factory
  //   starts the next unit after your Recognition (§19.14 Recognition), through the Run map's Close (agent/devices/runMapBinding.ts).
  for (const file of ['AgentContextDock.tsx', 'AgentShellTransport.tsx', 'agentShellFixture.tsx', 'factoryQueueAdvance.ts']) {
    assert.equal(existsSync(new URL(`../src/agent/${file}`, import.meta.url)), false, `${file} is gone`)
  }
  for (const suite of ['factory-queue-advance.test.mjs', 'agent-shell-transport-ids.test.mjs', 'agent-shell-fidelity.browser.mjs', 'agent-native-p0.browser.mjs']) {
    assert.equal(existsSync(new URL(`./${suite}`, import.meta.url)), false, `${suite}, which held only a retired file, is gone`)
  }
  assert.doesNotMatch(readFileSync(new URL('./support/agentShellHarness.mjs', import.meta.url), 'utf8'), /export async function runFixtureHarness|'src\/agent\/agentShellFixture\.tsx'/,
    'the harness bundles no retired fixture: the refusal states are agent-shell-live.browser.mjs --cut\'s, on the real App')
  const {reachable, unreachedUnder, repo} = await import('../scripts/candidate-reachable.mjs')
  const {join, relative} = await import('node:path')
  assert.deepEqual(unreachedUnder([join(repo, 'packages/live-shell/ui/src/agent')], reachable()).map(file => relative(repo, file)), [],
    'candidate-reachable.mjs --unreached src/agent lists nothing')
})

// ── the Answer's face on the Agent ────────────────────────────────────────────────────────────────────────────────────────────────

test('the Agent\'s Voice page reports what the voice does now and writes Hears and Speaks to it (ported from answerBinding.ts)', async () => {
  const written = []
  const state = {...VOICE_OFF, hears: 'on', voice: 'listening', heard: SAID}
  const binding = vb.voiceBinding({state, why: null}, async (key, value) => { written.push([key, value]) })
  assert.deepEqual([binding.values.hears, binding.values.speaks, binding.values.now, binding.values.heard], ['on', 'off', 'listening', SAID])
  assert.equal(binding.writes('hears'), true)
  assert.equal(binding.writes('speaks'), true)
  assert.equal(binding.writes('now'), false, 'what the voice does is the owner\'s to report')
  await binding.write([{key: 'hears', value: 'off'}, {key: 'speaks', value: 'on'}])
  assert.deepEqual(written, [['hears', 'off'], ['speaks', 'on']])
  assert.equal(binding.standing.hears, undefined, 'it can open: nothing stands disabled')
  const away = vb.voiceBinding({state: VOICE_OFF, why: ABSENT}, async () => assert.fail('not pressed'))
  assert.equal(away.standing.hears.disabled, ABSENT)
  assert.equal(away.standing.speaks.disabled, ABSENT)
  await assert.rejects(away.write([{key: 'hears', value: 'on'}]), /no native kernel stands here/)
  const refused = vb.voiceBinding({state: {...VOICE_OFF, refused: {speaks: 'The Kokoro model is not installed'}}, why: null}, async () => {})
  assert.deepEqual(refused.standing.speaks, {refused: 'The Kokoro model is not installed'}, 'pressable again, with what the owner said')
})

test('where its voice is read, the one Agent holds its face\'s own keys for the session: every view of it reads one face', () => {
  bind.resetHolds()
  const agent = centralAgent({light: 'lit'})
  const FACE = ['face.chat', 'face.emotion', 'face.feeling.v', 'face.feeling.a', 'face.gaze.x', 'face.gaze.y', 'face.gesture', 'face.do']
  assert.deepEqual(FACE.map(key => agent.values[key]), ['on', 'neutral', 0, 0, 0, 0, 'nod', 0], 'the face at rest')
  for (const key of [...FACE, 'face.source']) assert.equal(typeof agent.local[key], 'function', `${key} is the view's`)
  agent.local['face.emotion']('curious'); agent.local['face.feeling.v'](0.4); agent.local['face.do'](3); agent.local['face.chat']('off')
  const again = centralAgent({light: 'lit'})
  assert.deepEqual([again.values['face.emotion'], again.values['face.feeling.v'], again.values['face.do'], again.values['face.chat']], ['curious', 0.4, 3, 'off'],
    'another view reads the same face')
  assert.equal(again.values['speech.now'], 'quiet', 'and the voice, under the Voice page\'s prefix')
  const factory = carry.composeAgentBinding({id: 'factory:agent', values: {light: 'lit'}}, {})
  assert.ok(!Object.keys(factory.values).some(key => key.startsWith('face.') || key.startsWith('speech.')), 'no voice read: no speaking face, no face keys')
  bind.resetHolds()
})

test('on Central\'s chain the Agent answers with its face: Full is mostly the face with its three marks, Whole opens on the Answer page, the chain and the rail draw the small face', () => {
  bind.resetHolds()
  const written = []
  const agent = centralAgent({light: 'lit', agent: 'Nara', thread: THREAD}, VOICE_OFF, null, written)
  const full = draw(agent, 'full')
  assert.match(full, /class="an-pane"/, 'Full is the answer\'s pane')
  assert.match(full, /class="face-stage an-stage-face" data-face="mask"/, 'the face fills it (the mask on the server, the live face in a browser)')
  assert.ok(full.includes(mask('neutral')), 'at rest while the agent waits')
  for (const kind of ['hears', 'speaks', 'chat']) assert.match(full, new RegExp(`class="an-mark" data-kind="${kind}"`), `the ${kind} mark`)
  assert.match(full, /The first, once the image is repaired\./, 'the conversation at its right: the exchange')
  assert.doesNotMatch(full, /hm-full|EnvironStage|No run event/, 'not the thread and the stage')
  const whole = draw(agent, 'whole')
  assert.match(whole, /role="tab" aria-selected="true"[^>]*>Answer</, 'Whole opens on the Answer page')
  for (const page of ['Answer', 'Face', 'Run', 'Custody', 'Grants', 'Identity', 'Type', 'Context', 'Voice']) assert.match(whole, new RegExp(`role="tab"[^>]*>${page}<`), `the ${page} page`)
  assert.match(whole, /class="face-stage an-well-face"/, 'the whole face at the left of the picture')
  assert.match(draw(agent, 'whole', 'face'), /Feeling[\s\S]*Eyes[\s\S]*Emotion[\s\S]*Gesture/, 'the Face page: the Feeling and Eyes pads, Emotion and Gesture')
  assert.match(draw(agent, 'compact'), /data-face="neutral"/, 'Compact: the small face beside the agent\'s name')
  assert.match(draw(agent, 'widget'), /data-face="neutral"/, 'the widget: the small face')
  for (const view of ['folded', 'compact', 'whole', 'full', 'widget']) assert.doesNotMatch(draw(agent, view), /\bNaN\b|undefined|data-device-fault/, view)
  bind.resetHolds()
})

test('the face moves only for what the voice and the run report: hearing you, speaking, asleep while nothing is bound', () => {
  bind.resetHolds()
  const hearing = centralAgent({light: 'lit', agent: 'Nara'}, {...VOICE_OFF, hears: 'on', voice: 'listening', heard: SAID})
  const full = draw(hearing, 'full')
  assert.ok(full.includes(mask('focus')), 'attending while you speak')
  assert.match(full, /data-who="you">What does this entry ask of me</, 'your words under the face')
  const speaking = draw(centralAgent({light: 'lit', agent: 'Nara', thread: THREAD}, {...VOICE_OFF, speaks: 'on', voice: 'speaking'}), 'full')
  assert.ok(speaking.includes(mask('speak')), 'its mouth moving with its words while it answers')
  const asleep = centralAgent({light: 'dark', agent: 'Nara'})
  assert.ok(draw(asleep, 'full').includes(mask('sleep')), 'asleep while no conversation is bound')
  assert.match(draw(asleep, 'compact'), /data-face="sleep"/, 'and its small face too')
  const reading = draw(centralAgent({light: 'lit', agent: 'Nara', run: 'thinking'}), 'full')
  assert.ok(reading.includes(mask('focus')), 'intent on the packet while it reads')
  bind.resetHolds()
})

test('the marks and the Answer page write through the owners: Hears and Speaks to the voice, a proposal\'s Accept and Decline to the session\'s consent', async () => {
  bind.resetHolds()
  const written = []
  const agent = centralAgent({light: 'lit', agent: 'Nara'}, VOICE_OFF, null, written)
  await agent.write([{key: 'speech.hears', value: 'on'}, {key: 'speech.speaks', value: 'on'}])
  assert.deepEqual(written, [['hears', 'on'], ['speaks', 'on']], 'the voice\'s own keys (recorded, never sent)')
  const away = centralAgent({light: 'lit'}, VOICE_OFF, ABSENT)
  assert.equal(away.standing['speech.hears'].disabled, ABSENT, 'where the voice cannot open, Hears says why')
  assert.match(draw(away, 'full'), /data-kind="hears"[^>]*disabled=""/, 'and its mark stands disabled')
  // A proposal's answers are the session's own consent verbs (threadBinding.ts): Accept is the harness's allow, Decline its reject.
  const answered = []
  const consent = {native_request_id: 'req-7', native_session_id: 'n', tool_call_id: 'call-1', raw: {}, provenance: ['aikit'],
    tool_call: {kind: 'edit', title: 'Edit: entry 9', rawInput: {}}, choices: [{option_id: 'o1', label: 'Allow', kind: 'allow_once'}, {option_id: 'o3', label: 'Reject', kind: 'reject_once'}]}
  const encounter = {reading: {blocks: [], permissions: [consent], actions: [{ref: 'aikit.encounter.permission', enabled: true}, {ref: 'aikit.encounter.cancel', enabled: true}]}, status: {state: 'Resident'}}
  const thread = threads.threadBinding({selected: 's', chainSession: 's', tracks: [], nowUnixMs: 0, encounter, agent: {}, holds: bind.chainHolds()}, null,
    {permission: async (id, decision) => { answered.push([id, decision]) }, cancel: async () => {}, select: () => {}})
  assert.equal(thread.writes('decline'), true)
  await thread.write([{key: 'approve', value: true}, {key: 'decline', value: true}])
  assert.deepEqual(answered, [['req-7', {outcome: 'selected', option_id: 'o1'}], ['req-7', {outcome: 'selected', option_id: 'o3'}]])
  const none = threads.threadBinding({selected: 's', chainSession: 's', tracks: [], nowUnixMs: 0, encounter: {...encounter, reading: {...encounter.reading, permissions: []}}, agent: {}, holds: bind.chainHolds()}, null,
    {permission: async () => assert.fail('nothing waits'), cancel: async () => {}, select: () => {}})
  assert.equal(none.standing.decline.disabled, threads.THREAD_REFUSE.noConsent, 'nothing waits: Decline says so')
  bind.resetHolds()
})

test('in Factory the Agent keeps the creature of its type and its Full the thread with the stage: no speaking face where no voice is read', () => {
  bind.resetHolds()
  const factory = carry.composeAgentBinding({id: 'factory:agent', values: {light: 'lit', agent: 'Kite', thread: THREAD}}, {})
  const full = draw(factory, 'full')
  assert.match(full, /class="hm-full"/, 'the thread and the stage')
  assert.doesNotMatch(full, /face-stage|an-pane/, 'no speaking face')
  assert.doesNotMatch(draw(factory, 'whole'), /role="tab"[^>]*>Answer</, 'no Answer page')
  bind.resetHolds()
})

test('the face is reached: FaceStage is product, through the Agent\'s design (candidate-reachable.mjs)', async () => {
  const {reachable, repo} = await import('../scripts/candidate-reachable.mjs')
  const {join} = await import('node:path')
  const product = reachable()
  for (const file of ['src/agent/FaceStage.tsx', 'src/agent/FaceStage.css', 'src/inhabitants/catalogue/panels/agent-answer.tsx']) {
    assert.ok(product.has(join(repo, 'packages/live-shell/ui', file)), `${file} is loaded by the candidate`)
  }
})

// ── the Answer's run, role and packet on Central's Agent (the #804 carries, ticket 806) ──────────────────────────────────────────────
// §19.4 "intent on the packet while it reads, its mouth moving with its words while it answers": the face answers from the session's
// own state, not only from the voice; the retired Answer's binding read the same (answerBinding.ts answerValues `state`, `packet` at
// c776a3007), and the Agent reads it as its run.

const answerMod = await import('../src/central/devices/answerBinding.ts')
const ROSTER = [{ref: 'agent/nara', name: 'Nara', accepted: true, role: 'nara'}]
// Shaped as the Packet's items (packetBinding.ts packetItemOf): a text selection of a Flow. FIXTURE.
const PACKET = JSON.stringify([{entry: 1, scope: 'selection', text: 'What does this entry ask of me', chars: 30, bytes: 30, label: 'Closing the day'}])
const inputOf = (status, packet) => ({nara: {state: 'bound', session: 'session:a'}, observed: {status: {state: status}, reading: {blocks: [], permissions: []}}, roster: ROSTER,
  ...(packet ? {packet} : {})})

test('Central\'s Agent reads its run from the session: producing while a turn is in flight, so the face answers with the voice quiet; its role is the binding\'s', () => {
  bind.resetHolds()
  for (const status of ['TurnInFlight', 'InterruptRequested']) assert.equal(answerMod.centralAgentValues('central:agent', inputOf(status)).run, 'producing', status)
  assert.equal(answerMod.centralAgentValues('central:agent', inputOf('Resident')).run, undefined, 'at rest: no run is read, the face rests')
  assert.equal(answerMod.centralAgentValues('central:agent', {...inputOf('TurnInFlight'), nara: {state: 'unbound', session: null}}).run, undefined, 'nothing bound: nothing runs')
  assert.equal(answerMod.centralAgentValues('central:agent', inputOf('Resident')).role, 'nara', 'the dialogue binding\'s role')
  const answering = centralAgent(answerMod.centralAgentValues('central:agent', inputOf('TurnInFlight')))
  assert.ok(draw(answering, 'full').includes(mask('speak')), 'its mouth moving with its words while it answers: from the run, the voice quiet')
  bind.resetHolds()
})

test('Central\'s Agent shows the packet it reads — the Packet\'s items, when they are prepared for this very session — and the chain hands them over', () => {
  bind.resetHolds()
  const own = answerMod.centralAgentValues('central:agent', inputOf('Resident', {items: PACKET, session: 'session:a'}))
  assert.equal(own.packet, PACKET)
  assert.equal(answerMod.centralAgentValues('central:agent', inputOf('Resident', {items: PACKET, session: 'session:b'})).packet, undefined, 'another session\'s packet is not this one\'s')
  const full = draw(centralAgent({...own, thread: JSON.stringify([{who: 'you', kind: 'you', text: 'Which unit starts first?'}])}), 'full')
  assert.match(full, /aria-label="Packet"><li[^>]*><b>selection<\/b>Closing the day/, 'the packet the turn carries, under your words')
  const chainSource = read('central/devices/CentralDevices.tsx')
  assert.match(chainSource, /packet: typeof packet\.values\.packet === 'string' \? \{items: packet\.values\.packet, session: packetSession\} : null/,
    'CentralDevices hands the Packet\'s items and their session to the Agent\'s input')
  bind.resetHolds()
})

test('REPLACED (#806) — the retired Answer\'s own binding is gone from answerBinding.ts; what the one Agent reads stays', () => {
  // answerBinding, answerValues, ANSWER_WIRING, ANSWER_DESIGN and ANSWER_VIEW_DEFAULTS served the Answer design retired in #804. Their
  // behaviours stand on the Agent: the voice's keys on its Voice page (voiceBinding.ts; the Voice page test above), the face's own keys
  // held for the session (oneAgentBinding.ts; the face-keys test above), the packet and the run on centralAgentValues (the two above).
  for (const name of ['answerBinding', 'answerValues', 'ANSWER_WIRING', 'ANSWER_DESIGN', 'ANSWER_VIEW_DEFAULTS']) assert.equal(name in answerMod, false, `${name} is retired`)
  for (const name of ['centralAgentValues', 'centralAgentBinding', 'centralAgentRef', 'CENTRAL_AGENT_ID', 'CENTRAL_AGENT_REFUSED']) assert.ok(name in answerMod, `${name} stays`)
})
