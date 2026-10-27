// Lane W5: the faces stand in the posture of their run state, from real state (src/agent/devices/runFaces.ts; the Agent's binding
// designBindings.ts agentValues `run` and `stage`; the Agentset rack's members sessionChainBindings.ts agentsetMembers; Messages' occupied
// agents messagesBinding.ts). Manual §19.4 ("its posture is the agent's state"), §25.6; face-rig CREATURE-SPEC.md 25.
//
// Channels:
// - REAL (tests/fixtures/run-events-2026-10-21.json): the kernel's agency reading and 30 days of its temporal events, read on 21 Oct
//   read-only through the running walk-bridge.
// - OWNER-SHAPED: each run state built through the run model's own builders (agentRunModel.ts buildTaskClips, needleFor) from an
//   aikit.encounter-task/v1 record and oi.temporal-events/v1 rows, and the thread through threadBinding.ts threadRowsOf from AIKit's
//   encounter view shape (blocks user · assistant · tool · error, permissions) — the shapes the owners give.
// - SCRIPTED: the catalogue designs rendered through the runtime's host to static markup: the face's data-state is the posture.
// No owner state is written.
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
globalThis.getComputedStyle ??= () => ({getPropertyValue: () => ''})
// The faces' agency ontology (face-rig CREATURE-SPEC.md Part II as data) is a page's script that sets window.CREATURE_AGENCY; it is run here as a
// page runs it, before any design reads it, so the creatures stand in a Node render as in the window (faces/vendor.ts agency()).
globalThis.window ??= {matchMedia: () => ({matches: true, addEventListener() {}, removeEventListener() {}})}
await import('../src/inhabitants/catalogue/faces/vendor/creature-agency.js')
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const model = await import('../src/agent/agentRunModel.ts')
const runs = await import('../src/agent/devices/runFaces.ts')
const thread = await import('../src/agent/devices/threadBinding.ts')
const chain = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const session = await import('../src/agent/devices/sessionChainBindings.ts')
const msg = await import('../src/agent/devices/messagesBinding.ts')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')
const {design: rackDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__agentset-rack.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const REAL = JSON.parse(readFileSync(new URL('./fixtures/run-events-2026-10-21.json', import.meta.url), 'utf8'))
const NOW = REAL.observedAtUnixMs
const draw = (designed, binding, view) => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))

// ---- OWNER-SHAPED readings --------------------------------------------------------------------------------------------------------
const SESSION = 'agent-session/o-i-chat-1791392815-b898'
/** An aikit.encounter-task/v1 record: the task the session is bound to, with the owner's own state where it names one. */
const record = state => ({schema: 'aikit.encounter-task/v1', request: {central: {purpose: 'Type-check the three roots', task_ref: 'task:tsc'}}, ...(state ? {state} : {})})
/** oi.temporal-events/v1 rows of the session, `ago` seconds before the reading. */
const activity = (...ago) => ago.map((s, i) => ({stream: 'aikit-history', kind: 'generation', subject_ref: SESSION, instant_unix_ms: NOW - s * 1000, stream_position: `g:${i}`, summary: 'generation'}))
/** A track as the run model builds it from those readings. */
function track(state, events) {
  return {sessionRef: SESSION, spaceRef: 'session-space/o-i-chat-1791392815-b898', agentRef: 'agent/flint', agentName: 'Flint', group: false, parentRef: null, purpose: 'tsc',
    tasks: model.buildTaskClips(record(state), events, SESSION, NOW), needle: model.needleFor(events, SESSION, model.sharedAxis(events, NOW)), budget: {used: 3, max: 12}}
}
/** The thread from AIKit's encounter view: blocks, pending consent requests, the connection's state. */
const view = (blocks, permissions = []) => thread.threadRowsOf({blocks: blocks.map(([kind, text], id) => ({id: String(id), kind, text})), permissions}, {state: 'TurnInFlight'}, 'Flint')
const SAID = [['user', 'Type-check the three roots.'], ['assistant', 'Reading the shell root first.']]
const BASH = JSON.stringify({type: 'tool_execution_start', toolCallId: 'c1', toolName: 'Bash', args: {command: 'tsc --noEmit'}})
const READ = JSON.stringify({type: 'tool_execution_start', toolCallId: 'c2', toolName: 'Read', args: {path: 'src/App.tsx'}})
const ASK = {native_request_id: 'p1', tool_call_id: 'c1', tool_name: 'Bash', input: {command: 'rm -rf dist'}, choices: [{option_id: 'a', kind: 'allow_once', name: 'Allow'}]}
const FAILED = JSON.stringify({Failed: {reason: 'the provider stopped: context length exceeded'}})

/** Every run state, each from owner-shaped readings: [state, track, thread rows]. Producing has no owner signal (a return being made
 * is reported by no owner), so no reading stands an agent in it. */
const CASES = [
  ['queued', track('queued', []), null],
  ['thinking', track('running', activity(20, 5)), view(SAID)],
  ['thinking', track('running', activity(10)), view([...SAID, ['tool', READ]])],
  ['acting', track('running', activity(10)), view([...SAID, ['tool', BASH]])],
  ['waiting', track('running', activity(10)), view([...SAID, ['tool', BASH]], [ASK])],
  ['stalled', track('stalled', activity(400)), null],
  ['stalled', track(undefined, activity(300, 200)), view(SAID)],
  ['done', track('completed', activity(600)), null],
  ['failed', track(undefined, []), view([...SAID, ['error', FAILED]])],
]

test('every run state from the owners\' readings: the task\'s state, the needle against the 90 s horizon, the thread\'s last row', () => {
  for (const [state, t, rows] of CASES) assert.equal(runs.runStateOfSession(t, rows, NOW), state, `${state}: ${t.tasks[0]?.state ?? 'no task'} · ${rows?.at(-1)?.kind ?? 'no thread'}`)
  // A running task with no thread read stands acting (spec 25.1, as the rack maps Working); past the horizon it is stalled.
  assert.equal(runs.runStateOfSession(track('running', activity(10)), null, NOW), 'acting')
  assert.equal(runs.runStateOfSession(track('running', activity(120)), view(SAID), NOW), 'stalled', 'an owner-declared running task whose needle stopped is stalled')
  // Nothing read: no state, never a default.
  assert.equal(runs.runStateOfSession({tasks: [], needle: null}, null, NOW), null)
  const produced = CASES.map(([, t, rows]) => runs.runStateOfSession(t, rows, NOW))
  assert.ok(!produced.includes('producing'), 'producing has no owner signal')
  assert.deepEqual([...new Set(produced)].sort(), ['acting', 'done', 'failed', 'queued', 'stalled', 'thinking', 'waiting'])
})

test('the Agent stands in its session\'s run: `run` bound from the readings, its face drawn in that posture; nothing read, `run` absent with why', () => {
  bind.resetHolds()
  for (const [state, t, rows] of CASES) {
    const input = {sessionRef: SESSION, track: t, nowUnixMs: NOW, reading: {...chain.INITIAL_READING, attached: true}, accepted: {}, harness: {binding: 'pi', resolved: true},
      holds: bind.chainHolds(), ...(rows ? {thread: JSON.stringify(rows)} : {})}
    const values = bind.agentValues(input)
    assert.equal(values.run, state, state)
    // The face: the creature of the type the hand holds (Central's profile names no type yet), in the posture of the run.
    const binding = {id: 'factory:agent', values: {...values, 'id.agent': 'agent/flint', 'id.types': JSON.stringify({'agent/flint': 'ambush'})}}
    const markup = draw(agentDesign, binding, 'compact')
    assert.match(markup, new RegExp(`class="fx-face[^"]*"[^>]*data-state="${state}"`), `${state}: the face's posture`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/)
  }
  const none = bind.agentBinding('factory:agent', {sessionRef: null, track: null, nowUnixMs: NOW, reading: chain.INITIAL_READING, accepted: {}, harness: {binding: 'pi', resolved: false},
    holds: bind.chainHolds()}, {}, async () => ({kind: 'refused', channel: 'none', writePath: '', reason: 'x'}), () => false)
  assert.equal(none.values.run, undefined)
  assert.equal(none.standing.run.disabled, bind.RUN_UNREAD)
})

test('the Agentset rack and the Agents tile: each member in its session\'s state — Working, Idle, Stalled, Done — its creature in that posture', () => {
  bind.resetHolds()
  const group = {sessionRef: 'session-space/crew', spaceRef: 'session-space/crew', spaceLabel: 'Documentation', group: true, tasks: [], needle: null, purpose: 'docs', agentRef: null, agentName: null, parentRef: null}
  const member = (id, state, events) => ({...track(state, events.map(e => ({...e, subject_ref: id}))), sessionRef: id, parentRef: group.sessionRef, agentName: id.split('/')[1],
    tasks: model.buildTaskClips(record(state), events.map(e => ({...e, subject_ref: id})), id, NOW), needle: model.needleFor(events.map(e => ({...e, subject_ref: id})), id, model.sharedAxis([], NOW))})
  const tracks = [group, member('agent-session/kite', 'running', activity(10)), member('agent-session/cairn', 'queued', []), member('agent-session/flint', 'stalled', activity(400)),
    member('agent-session/lilt', 'completed', activity(900))]
  const members = session.agentsetMembers(group, tracks, NOW)
  assert.deepEqual(members.map(m => [m.name, m.state]), [['kite', 'working'], ['cairn', 'idle'], ['flint', 'stalled'], ['lilt', 'done']])
  assert.deepEqual(['acting', 'queued', 'stalled', 'done', 'failed'].map(runs.rackStateOf), ['working', 'idle', 'stalled', 'done', 'failed'])
  const binding = session.agentsetBinding({group, tracks, holds: bind.chainHolds(), nowUnixMs: NOW})
  const withPattern = {...binding, values: {...binding.values, pattern: 'ambush'}}
  const whole = draw(rackDesign, withPattern, 'whole'), full = draw(rackDesign, withPattern, 'full')
  const postures = markup => [...markup.matchAll(/class="fx-face[^"]*"[^>]*data-state="([a-z]+)"/g)].map(match => match[1])
  const tile = draw(rackDesign, withPattern, 'widget')
  assert.deepEqual(postures(whole), ['acting'], 'Whole: the chosen member (kite, Working) in its posture')
  assert.deepEqual([...new Set(postures(full))].sort(), ['acting', 'done', 'queued', 'stalled'], 'Full: every member\'s creature in its own posture')
  assert.deepEqual([...postures(tile)].sort(), ['acting', 'done', 'queued', 'stalled'], 'the Agents tile (§19.1): each agent in the posture of its state')
  assert.doesNotMatch(whole + tile, /\bNaN\b|undefined/)
})

test('Messages: an occupied agent stands in its session\'s state — working, waiting on you, stalled; a vacant one at rest; none read, absent', () => {
  bind.resetHolds()
  const population = {schema: 'aikit.population-reading/v1', local_world_ref: 'control:root', project_world_ref: 'project:O-I', positions: [
    {position_ref: 'central:position:project:O-I:flint', label: 'Flint', occupancy: {state: 'occupied', agent_ref: 'agent/flint', workcell_ref: 'workcell:mac'}},
    {position_ref: 'central:position:project:O-I:nara', label: 'Nara', occupancy: {state: 'occupied', agent_ref: 'agent/nara', workcell_ref: 'workcell:mac'}},
    {position_ref: 'central:position:project:O-I:kite', label: 'Kite', occupancy: {state: 'occupied', agent_ref: 'agent/kite', workcell_ref: 'workcell:mac'}},
    {position_ref: 'central:position:project:O-I:cairn', label: 'Cairn', occupancy: {state: 'occupied', agent_ref: 'agent/cairn'}},
    {position_ref: 'central:position:project:O-I:lilt', label: 'Lilt', occupancy: {state: 'vacant'}}], agents: []}
  const stateOf = (t, rows) => runs.runStateOfSession(t, rows, NOW)
  const map = new Map([['agent/flint', stateOf(track('stalled', activity(400)), null)], ['agent/nara', stateOf(track('running', activity(10)), view([...SAID, ['tool', BASH]], [ASK]))],
    ['agent/kite', stateOf(track('running', activity(10)), view([...SAID, ['tool', BASH]]))], ['agent/cairn', stateOf(track('completed', activity(900)), null)]])
  const values = msg.messagesValues({population: {status: 'answered', value: population, error: null}, gateway: chain.INITIAL_READING, runs: map, holds: bind.chainHolds()})
  const agents = Object.fromEntries(JSON.parse(values.agents).map(a => [a.name, a.state]))
  assert.deepEqual(agents, {Flint: 'stalled', Nara: 'waiting', Kite: 'working', Cairn: undefined, Lilt: 'rest'}, 'a done session\'s occupant is neither at rest nor working')
  assert.deepEqual(['thinking', 'acting', 'producing', 'waiting', 'stalled', 'queued', 'done', 'failed'].map(runs.messagesStateOf),
    ['working', 'working', 'working', 'waiting', 'stalled', undefined, undefined, undefined])
})

test('the stage plays the kernel\'s own run events at their instants — never a recording scripted from the thread; the real sessions name none yet', () => {
  // REAL: 30 days of the kernel's temporal events and the agency's sessions. The run kinds (generation, knowledge) name no session or space
  // in their subject, summary or evidence (the aikit-history stream), so no real session's stage has an event to play: it stands absent.
  const refs = REAL.spaces.flatMap(space => [space.definition.id, ...Object.keys(space.agent_sessions)])
  assert.ok(refs.length > 10)
  for (const ref of refs) assert.equal(runs.stageRecordingOf(REAL.events, ref), null, `${ref}: no run event names it`)
  assert.ok(REAL.events.some(event => event.kind === 'generation') && REAL.events.some(event => event.kind === 'knowledge'), 'the run kinds are in the field')
  // OWNER-SHAPED: the same kernel kinds, naming the session's space (a direct session's run is recorded on its space).
  const space = 'session-space/o-i-chat-1791392815-b898'
  const events = [
    {stream: 'aikit-history', kind: 'now', subject_ref: space, instant_unix_ms: NOW - 60_000, stream_position: 'n0', summary: 'receipt 0'},
    {stream: 'aikit-history', kind: 'knowledge', subject_ref: space, instant_unix_ms: NOW - 50_000, stream_position: 'k0', summary: 'used source:project:O-I:ProjectCentral/docs/1-vision/dlw/DLW.md'},
    {stream: 'aikit-history', kind: 'generation', subject_ref: space, instant_unix_ms: NOW - 20_000, stream_position: 'g0', summary: 'generation gen_1'},
    {stream: 'aikit-history', kind: 'curation', subject_ref: space, instant_unix_ms: NOW - 10_000, stream_position: 'c0'},
    {stream: 'aikit-history', kind: 'return', subject_ref: space, stream_position: 'r-no-instant'},
  ]
  const recording = runs.stageRecordingOf(events, [SESSION, space])
  assert.deepEqual(recording.events.map(e => [e.at, e.kind]), [[0, 'knowledge'], [30_000, 'generation']], 'each at its own instant; curation and NOW are no part of the tree; an instant-less event has no place')
  assert.equal(recording.events[0].output, 'used source:project:O-I:ProjectCentral/docs/1-vision/dlw/DLW.md', 'the owner\'s own words')
  assert.equal(recording.source.transcript, 'oi.temporal-events/v1')
  assert.equal(recording.length, 32_000)
  // The Agent's binding carries it as `stage` (the design's stage reads a recording; proposed to the design lane).
  const values = bind.agentValues({sessionRef: SESSION, track: track('running', activity(10)), nowUnixMs: NOW, reading: {...chain.INITIAL_READING, attached: true}, accepted: {},
    harness: {binding: 'pi', resolved: true}, holds: bind.chainHolds(), events})
  assert.deepEqual(JSON.parse(values.stage).events.map(e => e.kind), ['knowledge', 'generation'])
  assert.equal(bind.agentValues({sessionRef: SESSION, track: track('running', activity(10)), nowUnixMs: NOW, reading: chain.INITIAL_READING, accepted: {},
    harness: {binding: 'pi', resolved: true}, holds: bind.chainHolds(), events: REAL.events}).stage, undefined, 'no event names it: no stage')
})

test('the bindings script nothing: no recording made from a thread, no default state', () => {
  for (const file of ['agent/devices/runFaces.ts', 'agent/devices/sessionChainBindings.ts', 'agent/devices/messagesBinding.ts']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /recordingFromThread\(|recordedRun|\.defaults\[|\.fixtures/, file)
  }
})
