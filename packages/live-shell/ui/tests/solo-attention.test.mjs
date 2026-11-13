// Solo is what you attend to, never what runs (manual §16.1 "Live's acts, kept as Live keeps them": Solo is "You attend to the soloed
// tracks alone: you see and hear only them, in the views and the instruments. The others keep running", never "A limit on what may run";
// §16.6 Rules: "Solo changes what you attend to, never what runs"; §19.1 the session's Solo row: "the views, the tiles and the instruments
// show only them. The others keep running. Off by default"; §19.15 the rack's chain list). The shell holds it beside THE selection, on the
// book's world context, and AIKit's own session Solo (a launch gate on its executor) is never written from here.
// Channels: the book's context helpers (desktop/cradle/src/workspace/store.ts), pure; Factory's set (timeline/factoryTrackAdapter.ts) over
// FIXTURE tracks shaped as agentRunModel.ts builds them, with a SPY on every owner port; the rack's binding (agent/devices/
// sessionChainBindings.ts); the source of the parts that hand the attention on (the agent shell, the tracks hook, the tile, the instrument).
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

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
const bus = new EventTarget()
globalThis.window ??= globalThis
globalThis.addEventListener ??= bus.addEventListener.bind(bus); globalThis.removeEventListener ??= bus.removeEventListener.bind(bus)
globalThis.dispatchEvent ??= bus.dispatchEvent.bind(bus)
const stored = new Map()
globalThis.localStorage ??= {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key), key: () => null, length: 0}

const store = await import('../../../../desktop/cradle/src/workspace/store.ts')
const adapter = await import('../src/timeline/factoryTrackAdapter.ts')
const model = await import('../src/agent/agentRunModel.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const own = await import('../src/agent/devices/sessionChainBindings.ts')
const {DECISION_HELPER_ID} = await import('../src/agent/devices/decisionHelperBinding.ts')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const {trackKey} = model

// ---------------------------------------------------------------------------------------------------------------- fixtures

const NOW = Date.UTC(2026, 10, 4, 14, 30)
const task = (n, over = {}) => ({n, title: `task ${n}`, state: 'running', startUnixMs: NOW - 600_000, lastActivityUnixMs: NOW - 5_000, softStop: false, disclosure: null, ...over})
const needle = {atUnixMs: NOW - 5_000, state: 'live', axisStartUnixMs: NOW - 3_600_000, axisEndUnixMs: NOW, disclosure: null}
const session = (sessionRef, spaceRef, over = {}) => ({sessionRef, purpose: sessionRef, agentRef: `agent/${sessionRef}`, agentName: sessionRef, agentAccepted: true,
  spaceRef, spaceLabel: spaceRef, depth: 1, parentRef: spaceRef, group: false, memberRefs: [], tasks: [task(1)], needle, telemetryOn: true,
  budget: {used: null, max: null}, disclosure: null, ...over})
const group = (spaceRef, members) => ({...session(spaceRef, spaceRef), agentRef: null, agentName: null, agentAccepted: null, depth: 0, parentRef: null, group: true,
  memberRefs: members.map(member => member.sessionRef), tasks: [], needle: null})
// Two spaces, as agentRunModel.ts buildTracks makes them: each a group track, its sessions beneath it.
const KITE = session('ses-kite', 'space:crew'), CAIRN = session('ses-cairn', 'space:crew'), WREN = session('ses-wren', 'space:solo')
const CREW = group('space:crew', [KITE, CAIRN]), LONE = group('space:solo', [WREN])
const TRACKS = [CREW, KITE, CAIRN, LONE, WREN]
const event = sessionRef => ({kind: 'message', stream: 'messages', subject_ref: sessionRef, instant_unix_ms: NOW - 60_000, summary: `${sessionRef} spoke`})

/** Every owner the set can reach, each a spy: the harness's controls, the sessions' own settings, a session's Stop and a Repeat. */
function owners() {
  const asked = []
  return {
    asked,
    controls: {control: async control => { asked.push(['aikit.gateway.agent', control]); return {ok: true, note: 'done'} }},
    settings: {of: sessionRef => ({telemetry: sessionRef !== 'ses-cairn', solo: sessionRef === 'ses-wren'}),
      set: async (sessionRef, setting, on) => { asked.push(['encounter_session_settings', sessionRef, setting, on]); return {ok: true, note: `${setting} ${on}`} }},
    sessionStop: async sessionRef => { asked.push(['encounter cancel', sessionRef]); return {ok: true, note: 'stopped'} },
    repeat: async sessionRef => { asked.push(['comparison-run', sessionRef]); return {ok: true, note: 'takes'} },
    takes: {of: sessionRef => [{sessionRef, attemptRef: `attempt:${sessionRef}`, runRef: 'run:1', statePath: '/state', taskRef: 'task:1', unit: null, unitRef: null, state: 'running',
        startUnixMs: NOW - 300_000, endUnixMs: null, summary: null, receivingRef: null}],
      choose: async take => { asked.push(['attempt-receiving', take.attemptRef]); return {ok: true} }},
  }
}
/** The shell's attention as the agent shell hands it to the set: what is soloed, and the press, recorded. */
function attention(soloed = []) {
  const pressed = []
  return {pressed, port: {soloed: new Set(soloed), solo: (ref, on) => { pressed.push([ref, on]) }}}
}
const project = (soloed, extra = {}) => {
  const spies = owners(), held = attention(soloed)
  const set = adapter.factoryTrackAdapter.project({tracks: TRACKS, nowUnixMs: NOW, controls: spies.controls, settings: spies.settings, sessionStop: spies.sessionStop,
    repeat: spies.repeat, takes: spies.takes, events: TRACKS.filter(t => !t.group).map(t => event(t.sessionRef)), attention: held.port, ...extra})
  return {set, spies, held}
}
const SOLO_ON = {ok: true, note: 'Soloed: the views, the tiles and the instruments show only what you solo. The others keep running.'}
const SOLO_OFF = {ok: true, note: 'Solo lifted: you attend to everything again; nothing stopped or started.'}
const clipsOf = (set, track) => set.clips.filter(clip => clip.trackId === trackKey(track)).length
const headOf = (set, track) => set.tracks.find(item => item.id === trackKey(track))

// ---------------------------------------------------------------------------------------------------------------- the book holds it

test('the book holds what you attend to beside THE selection: soloed by mode and ref, kept by a select, a walk and the bound, never on a stop', () => {
  const kite = trackKey(KITE)
  const one = store.soloOnContext({}, 'factory', kite, true)
  assert.deepEqual(one.soloed, [{mode: 'factory', ref: kite}])
  assert.deepEqual([...store.soloedIn(one, 'factory')], [kite])
  assert.deepEqual([...store.soloedIn(one, 'techne')], [], 'a solo is its mode\'s: Technē attends to everything still')
  assert.deepEqual(store.soloOnContext(one, 'factory', kite, true).soloed, [{mode: 'factory', ref: kite}], 'soloing what is soloed changes nothing')
  assert.equal('soloed' in store.soloOnContext(one, 'factory', kite, false), false, 'unsoloed, you attend to everything again')
  assert.deepEqual([...store.soloedIn(undefined, 'factory')], [], 'with no context you attend to everything')
  // A select is a move, and the stop it makes keeps the place, never the attention; a walk and the bound keep what you attend to.
  const selection = {mode: 'factory', kind: 'agent-session', ref: trackKey(CAIRN), title: 'cairn'}
  const moved = store.selectOnTrail(one, selection, NOW)
  assert.deepEqual(moved.soloed, one.soloed, 'a select keeps what you attend to')
  assert.equal(moved.trail.length, 1)
  assert.equal(JSON.stringify(moved.trail).includes('soloed'), false, 'a stop keeps the place only')
  const away = store.selectOnTrail(moved, {...selection, ref: trackKey(WREN), title: 'wren'}, NOW + 1)
  assert.deepEqual(store.walkTrail(away, 0).soloed, one.soloed, 'a walk back keeps what you attend to')
  assert.deepEqual(store.boundedContext(away).soloed, one.soloed)
  // The book's reading: kept as it was written, a part of another shape dropped, never a whole context refused for it.
  const decoded = store.decodeWorldContext(JSON.parse(JSON.stringify({soloed: [{mode: 'factory', ref: kite}, {mode: 'nowhere', ref: 'x'}, {mode: 'factory'}, 'kite']})))
  assert.deepEqual(decoded.soloed, [{mode: 'factory', ref: kite}])
  assert.equal(store.decodeWorldContext({soloed: [{mode: 'nowhere', ref: 'x'}]}), undefined, 'nothing readable: no context')
  assert.deepEqual(store.decodeWorldContext(JSON.parse(JSON.stringify(away))).soloed, one.soloed)
})

// ---------------------------------------------------------------------------------------------------------------- no owner is asked

test('soloing a session asks no owner: the press changes what you attend to, and every session keeps running', async () => {
  const {set, spies, held} = project([])
  const solo = set.actions.mixer.solo
  assert.equal(solo.op, adapter.FACTORY_SOLO_OP)
  assert.doesNotMatch(solo.op, /encounter_session_settings/, 'the op is the shell\'s, never AIKit\'s session Solo')
  assert.match(solo.op, /what you attend to/)
  assert.deepEqual(await solo.run(trackKey(KITE), true), SOLO_ON)
  assert.deepEqual(await solo.run(trackKey(CREW), true), SOLO_ON,
    'a group is soloed as a track is')
  assert.deepEqual(await solo.run(trackKey(KITE), false), SOLO_OFF)
  assert.deepEqual(held.pressed, [[trackKey(KITE), true], [trackKey(CREW), true], [trackKey(KITE), false]], 'the shell\'s attention took each press')
  assert.deepEqual(await solo.run('space:none:nobody', true), {ok: false, error: '"space:none:nobody" is not a session of this work.'})
  assert.deepEqual(spies.asked, [], 'no owner was asked: no setting written, no turn cancelled, nothing launched or paused')
  // The set's acts on the other sessions stand as they did: they keep running, and their Stop and Telemetry are still theirs.
  assert.equal(set.actions.stopTrack.op, adapter.FACTORY_SESSION_STOP_OP)
  assert.equal(set.actions.mixer.activator.op, adapter.FACTORY_TELEMETRY_OP)
  await set.actions.mixer.activator.run(trackKey(CAIRN), true)
  assert.deepEqual(spies.asked, [['encounter_session_settings', 'ses-cairn', 'telemetry', true]], 'Telemetry is still the session\'s own setting on AIKit')
  // The mixer's words are the manual's, and Solo's light is the attention, never AIKit's reading (WREN's own setting reads solo: true).
  assert.equal(set.mixer.solo.meaning, 'You attend to the soloed sessions alone: the views, the tiles and the instruments show only them. The others keep running. Off by default.')
  assert.equal(set.mixer.solo.disabled, undefined)
  assert.equal(headOf(set, WREN).mix.solo, false, 'AIKit\'s own session Solo is not read as the shell\'s')
  assert.equal(headOf(set, CAIRN).mix.activator, false, 'each session\'s Telemetry still reads its own setting')
  // The shell builds no write of AIKit's session Solo at all: its request builder takes Telemetry alone; AIKit's gate stays AIKit's.
  assert.match(read('agent/sessionSettings.ts'), /export const trackSettingChange = \(setting: 'telemetry', on: boolean\)/)
})

test('with no attention handed the Solo cell says what it waits for; the waiting words name the shell, never AIKit', () => {
  const set = adapter.factoryTrackAdapter.project({tracks: TRACKS, nowUnixMs: NOW})
  assert.match(set.mixer.solo.disabled, /no owner operation carries it yet — missing op: /, 'the grid\'s unread shape (r3-tracks-lanes)')
  assert.match(set.mixer.solo.disabled, /what you attend to.*\(the live shell\)\.$/)
  assert.doesNotMatch(set.mixer.solo.disabled, /Actuation|aikit\.gateway\.agent|pauses/)
  assert.match(adapter.FACTORY_WAITING['track.solo'], /what you attend to/)
  assert.doesNotMatch(adapter.FACTORY_WAITING['track.solo'], /AIKit/)
  assert.equal(set.actions?.mixer?.solo, undefined)
})

// ---------------------------------------------------------------------------------------------------------------- the views follow it

test('the views follow the attention: only what you attend to keeps its clips, needle and lanes; every track keeps its head and its mixer', () => {
  const all = project([]).set
  for (const track of [KITE, CAIRN, WREN]) assert.equal(clipsOf(all, track), 1, `${track.sessionRef}: with nothing soloed you attend to everything`)
  for (const track of TRACKS) assert.equal(headOf(all, track).mix.solo, false, `${track.sessionRef}: Solo off by default`)

  const {set} = project([trackKey(KITE)])
  assert.deepEqual(set.tracks.map(item => item.id), all.tracks.map(item => item.id), 'every track keeps its head, so you can solo another or lift this one')
  assert.equal(clipsOf(set, KITE), 1)
  assert.equal(clipsOf(set, CAIRN), 0, 'cairn keeps running, out of view')
  assert.equal(clipsOf(set, WREN), 0)
  assert.equal(headOf(set, KITE).mix.solo, true)
  assert.equal(headOf(set, CAIRN).mix.solo, false)
  assert.equal(typeof headOf(set, KITE).needle, 'number')
  assert.equal(headOf(set, CAIRN).needle, undefined, 'the needle of what you do not attend to leaves the ruler')
  assert.equal(headOf(set, CAIRN).mix.activator, false, 'its mixer stays: Telemetry still reads its own setting')
  assert.deepEqual([...new Set(set.lanes.events.map(lane => lane.trackId))], [trackKey(KITE)], 'only the attended session\'s events lie as lanes')
  assert.deepEqual([...new Set(set.lanes.takes.map(lane => lane.trackId))], [trackKey(KITE)], 'and only its takes')
  // A group soloed: you attend to what it holds; a session soloed: its group's head stands with it.
  const crew = project([trackKey(CREW)]).set
  assert.deepEqual([clipsOf(crew, KITE), clipsOf(crew, CAIRN), clipsOf(crew, WREN)], [1, 1, 0])
  // A solo the set no longer holds (a session that left) hides nothing: you attend to everything rather than to nothing.
  const gone = project(['space:gone:ses-gone']).set
  assert.deepEqual([clipsOf(gone, KITE), clipsOf(gone, CAIRN), clipsOf(gone, WREN)], [1, 1, 1])
})

test('what you attend to, by the tracks\' keys: a soloed group holds its sessions, a soloed session its group\'s head', () => {
  assert.equal(model.attendedKeys(TRACKS, new Set()), null, 'nothing soloed: everything')
  assert.deepEqual([...model.attendedKeys(TRACKS, new Set([trackKey(KITE)]))].sort(), [trackKey(CREW), trackKey(KITE)].sort())
  assert.deepEqual([...model.attendedKeys(TRACKS, new Set([trackKey(CREW)]))].sort(), [trackKey(CREW), trackKey(KITE), trackKey(CAIRN)].sort())
  assert.equal(model.attendedKeys(TRACKS, new Set(['space:gone:ses-gone'])), null, 'a solo of nothing here: everything')
  // A lone track with no group above it (a reading before groups): soloed, it alone is attended.
  const loose = {...WREN, spaceRef: 'space:loose', parentRef: null, depth: 0}
  assert.deepEqual([...model.attendedKeys([...TRACKS, loose], new Set([trackKey(loose)]))], [trackKey(loose)])
})

// ---------------------------------------------------------------------------------------------------------------- one attention, every reader

test('the tiles, the instrument and the rack read the one attention the agent shell holds on the book', () => {
  const shell = read('agent/AgentShellContext.tsx')
  assert.match(shell, /soloedIn\(continuity\.current\.context, 'factory'\)/, 'read from the book\'s world context')
  assert.match(shell, /continuity\.setContext\(context => soloOnContext\(context, 'factory', ref, on\)\)/, 'written through the book\'s one context writer')
  const hook = read('frame/tracks/useFactoryTracks.ts')
  assert.match(hook, /attention/)
  assert.doesNotMatch(hook, /'solo'/, 'the tracks write no Solo setting')
  // (agent/agentFidelity.ts keeps the reverse-engineered oracle's Solo line verbatim, as agent-shell-status-info requires; nothing draws it.)
  assert.doesNotMatch(read('timeline/factoryTrackAdapter.ts'), /Only soloed sessions may run|aikit\.gateway\.agent \{binding, operation: "solo"/)
  // DLW build ruling 2026-11-05: the Solo tip and the mockup line it is pinned to say §16.1's sense, word for word in both.
  const tip = read('agent/agentFidelity.ts').match(/solo: \['Solo', '([^']+)'\]/)?.[1]
  assert.equal(tip, 'You attend to the soloed sessions alone: the views, the tiles and the instruments show only them. The others keep running.')
  assert.doesNotMatch(tip, /may run/, 'never a limit on what may run')
  const mockup = readFileSync(new URL('../../../../desktop/cradle/docs/world-shell/agent-shell-mockup.html', import.meta.url), 'utf8')
  assert.ok(mockup.includes(`data-i="Solo|${tip}"`), 'the mockup line the tip is pinned to says the same')
  // Round 869 (DLW build ruling 2026-11-05): the agent device mockup's Solo says §16.1 word for word, never a limit on what may run.
  const device = readFileSync(new URL('../../../../desktop/cradle/docs/world-shell/agent-device-mockup.html', import.meta.url), 'utf8')
  assert.ok(device.includes('data-info="Solo|You attend to the soloed tracks alone: you see and hear only them, in the views and the instruments. The others keep running."'),
    'agent-device-mockup.html: Solo in §16.1\'s words')
  assert.doesNotMatch(device, /Solo\|[^"]*(may run|holds at the next quantize point)/, 'agent-device-mockup.html: no Solo that limits what runs (the Activator decides that)')
  const tile = read('agent/AgentDockTileBody.tsx'), panel = read('components/NativeContextPanel.tsx')
  assert.match(tile, /attendedKeys\(sessions\?\.tracks \?\? \[\], shell\?\.soloed \?\? NONE_SOLOED\)/, 'the tiles read what you attend to over the same tracks')
  assert.match(tile, /<NativeContextPanel project=\{project\} attends=\{attends\} \/>/)
  assert.match(tile, /<NativeContextPanel project=\{project\} initialTab="agents" attends=\{attends\} \/>/)
  assert.match(panel, /attends\?: \(row: \{spaceRef: string; sessionRef: string\}\) => boolean/)
  assert.match(panel, /agencyReading\.rows\.filter\(row => !attends \|\| attends\(row\)\)/)
  const system = read('projections/atlas/system/SystemReadings.tsx')
  assert.match(system, /attendedKeys\(sessions\?\.tracks \?\? \[\], soloed\)/, 'the Earth system draws only the sessions you attend to')
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /solo: \(ref, on\) => shell\.setSolo\(ref, on\)/)
  assert.match(chain, /soloed: shell\.soloed/)
  assert.doesNotMatch(read('inhabitants/catalogue/panels/dlw__session-grid.tsx'), /only the soloed tracks run|may run/, 'the design says Solo as the manual does')
})

test('the rack\'s chain list solos through the same attention: no owner asked, a chain that is no session refused in words', async () => {
  const pressed = [], asked = []
  const ports = {saveSet: async input => { asked.push(['save', input]) }, propose: async input => { asked.push(['propose', input]) }, solo: (ref, on) => { pressed.push([ref, on]) }}
  const rack = own.agentsetBinding({group: CREW, tracks: TRACKS, holds: bind.chainHolds(), nowUnixMs: NOW, soloed: new Set([trackKey(KITE)])}, ports)
  assert.equal(rack.values[`solo:${KITE.sessionRef}`], true)
  assert.equal(rack.values[`solo:${CAIRN.sessionRef}`], false)
  assert.equal(rack.standing.solo, undefined, 'Solo stands pressable')
  assert.equal(rack.writes(`solo:${CAIRN.sessionRef}`), true)
  await rack.write([{key: `solo:${CAIRN.sessionRef}`, value: true}])
  await rack.write([{key: `solo:${KITE.sessionRef}`, value: false}])
  assert.deepEqual(pressed, [[trackKey(CAIRN), true], [trackKey(KITE), false]], 'by the track\'s key, the one the views read')
  await assert.rejects(() => rack.write([{key: 'solo:agent-session/elsewhere', value: true}]), {message: 'Solo: "agent-session/elsewhere" is not a chain of this rack.'})
  await assert.rejects(() => rack.write([{key: `solo:${DECISION_HELPER_ID}`, value: true}]), /Solo: the Decision helper is a chain of the rack, not a session/)
  assert.deepEqual(asked, [], 'no owner was asked')
  // A lone session's rack: its one chain soloes as its track does.
  const lone = own.agentsetBinding({group: null, session: WREN, tracks: TRACKS, holds: bind.chainHolds(), nowUnixMs: NOW, soloed: new Set()}, ports)
  assert.equal(lone.values[`solo:${WREN.sessionRef}`], false)
  await lone.write([{key: `solo:${WREN.sessionRef}`, value: true}])
  assert.deepEqual(pressed.at(-1), [trackKey(WREN), true])
  // With no attention handed (a rack drawn detached), Solo waits in its words.
  const unported = own.agentsetBinding({group: CREW, tracks: TRACKS, holds: bind.chainHolds(), nowUnixMs: NOW})
  assert.equal(unported.standing.solo.disabled, own.AGENTSET_REFUSE.solo)
  assert.match(own.AGENTSET_REFUSE.solo, /^Solo: no owner operation carries it yet — missing op: .*what you attend to.*\(the live shell\)\.$/)
  await assert.rejects(() => unported.write([{key: `solo:${KITE.sessionRef}`, value: true}]), {message: own.AGENTSET_REFUSE.solo})
  bind.resetHolds()
})
