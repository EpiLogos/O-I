import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// R3 (T-REALIGN §3; manual §16.6 "Tracks, Session view and Arrangement view", §16.8, §17.1–§21.1 "The mixer row"; lock §0.3 item 3–4):
// every track's mixer row with its mode's meaning, the Main track last with its row launchers, Stop All and Back to Arrangement,
// and the lanes under the tracks in Arrangement view — automation, take lanes with the comp, and why a lane is absent.
//
// Channels (each claim below is carried by exactly one):
// - FIXTURE: Central's and Factory's Sets in the shape the kernel builds them (kernel mode_set.rs; O-I #1004), a scene's property
//   tracks and automation lanes in the Expressions model's shape, a Live set summary. Each is labelled where it is used.
// - SCRIPTED: the shared views rendered to static markup, or called as stateless functions and pressed.
// No computer-use pass and no browser: the on-screen legs are not covered here.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const central = await import('../src/timeline/centralTrackAdapter.ts')
const {kernelSetTracks} = await import('../src/frame/tracks/kernelSet.ts')
const {modeSetOf, setClip, setTrack} = await import('./support/modeSetFixture.mjs')
const {techneTakeLanes, TECHNE_MIXER} = await import('../src/timeline/techneTrackAdapter.ts')
const {liveSetTrackAdapter, LIVE_MIXER} = await import('../src/timeline/liveSetTrackAdapter.ts')
const {nativeTracks, sceneAutomationOf} = await import('../src/frame/tracks/modeTracks.ts')
const {answerOf} = await import('../src/frame/tracks/SessionGrid.tsx')
const {SessionGrid, SessionGridView} = await import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx')
const {ArrangementRuler, ArrangementRulerView} = {...await import('../src/frame/tracks/ArrangementRuler.tsx'), ...await import('../src/inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx')}
const lanes = await import('../src/frame/tracks/trackLanes.ts')

const SELECT = {select() {}}
const noop = () => {}
const session = set => renderToStaticMarkup(React.createElement(SessionGrid, {set, selection: SELECT}))
const arrangement = set => renderToStaticMarkup(React.createElement(ArrangementRuler, {set, selection: SELECT}))
/** Every element of a stateless view's tree that satisfies `pred` (tests/tracks-views.test.mjs `find`). */
function find(tree, pred, out = []) {
  if (Array.isArray(tree)) { for (const child of tree) find(child, pred, out); return out }
  if (!tree || typeof tree !== 'object' || !tree.props) return out
  if (pred(tree)) out.push(tree)
  return find(tree.props.children, pred, out)
}
const RULER_VIEW = {window: null, onWindow: noop, snap: 'free', onSnap: noop, marker: null, onMarker: noop, width: 0}

// ── Central and Factory: their Sets from the kernel (O-I #1004) ────────────────────────────────────────────────────────────

// FIXTURE: Central's Set in the shape the kernel builds it from the worlds and day slices (kernel mode_set.rs `central`, whose own tests
// lay out what each slice gives): your world and O-I as tracks, a page of your world in its slot's row, the Day the Main track, and the
// mixer row as the kernel words it.
const firstDay = '2026-10-14'
const ARM = {action: 'shell.setWriteArm', takes: 'on', words: 'shell.setWriteArm — the shell\'s one write arm (agent/shellSetterBridge.ts): its receipt names the owner that enforces it'}
const PAGE = 'Control/user/flows/flow-2026-10-07-1014.html'
const centralSet = modeSetOf({
  owner: 'Central · its worlds, their pages and today\'s Day, through the Action registry',
  ruler: {kind: 'day', unit: `minutes (UTC) of ${firstDay}`, date: firstDay},
  rows: [{id: 'central:slot:1', name: '1'}],
  tracks: [setTrack('central:world:central:wiki:root', 'Your world', {kind: 'your world · its folder Control/user/flows · 1 page'}),
    setTrack('central:world:central:wiki:project:O-I', 'O-I', {kind: 'a project world · its folder Work/O-I/ProjectCentral/user · no page'}),
    setTrack('central:day', 'Day', {kind: `today, ${firstDay}`, main: true})],
  clips: [setClip(PAGE, 'central:world:central:wiki:root', 'central:slot:1', 'Closing the day', {subject: `central:path:/ground:${PAGE}`, note: `A Flow · ${PAGE}`})],
  main: {track: 'central:day', name: `Day · ${firstDay}`, chain: ['Day', 'Approvals']},
  mixer: {
    activator: {meaning: 'Send to Day: on, the work in this world reaches the Day\'s faces; off, it stays out of the Day. On by default',
      disabled: 'Send to Day: no owner operation carries it yet — missing op: a set track field `sendToDay: boolean` in the Day\'s set (central/daySet.ts) read by the Day\'s faces and its close (shell · Central).'},
    arm: {meaning: 'Lets the agent of this world write into its pages directly, each write with a receipt; off, every agent write arrives as a proposal', grain: 'the shell\'s one write arm: arming one world arms every one'},
    solo: {meaning: 'Shows only this world in the Day\'s faces and in the world instrument', disabled: 'Solo: no owner operation carries it yet — missing op: the Day\'s faces and the world instrument reading a soloed world from the set (shell · Central).'},
    input: {meaning: 'Its Folder: a file you add to the folder shows as a clip', route: 'the world\'s folder'},
    output: {meaning: 'Every world sends its work to the Day, the Main track', route: 'Day'},
  },
  lanes_absent: {takes: 'A page\'s revisions are its takes (manual §18.1): Central\'s file history is no slice of the World Model yet (O-I #1005).'},
  acts: {arm: ARM},
  waiting: {'track.stop': 'the page owner\'s stop (each playing page\'s NOW clearing closed, central.now.lifecycle), and the clearings that play are no slice of the World Model yet (O-I #1005)'},
})

test('Central: today\'s worlds are the tracks, each with its pages; the Day is the Main track, last, on today\'s ruler', () => {
  const set = kernelSetTracks(centralSet, {nowMs: Date.parse(`${firstDay}T12:00:00Z`)})
  assert.deepEqual(set.tracks.map(track => [track.id, track.main ?? false]), [['central:world:central:wiki:root', false], ['central:world:central:wiki:project:O-I', false], ['central:day', true]])
  assert.deepEqual(set.main, {name: `Day · ${firstDay}`, chain: ['Day', 'Approvals']}, 'the Main track\'s own chain: the Day, then Approvals (§18.1)')
  const page = set.clips.find(clip => clip.trackId === 'central:world:central:wiki:root')
  assert.equal(page.id, PAGE)
  assert.equal(set.columns.find(column => column.id === page.columnId).id, 'central:slot:1', 'a page no named row holds stands in its slot\'s row')
  assert.deepEqual(central.centralSubjectOfClip(page.id), {kind: 'note', path: PAGE}, 'it opens as the page the path names')
  assert.equal(set.ruler.unit, `minutes (UTC) of ${firstDay}`)
  assert.equal(set.ruler.label(61), `${firstDay.slice(5)} 01:01`)
  // The Session: the worlds are columns, the Day stands in the Main column at the end; the Arrangement lays the Day last.
  const grid = session(set)
  assert.deepEqual([...grid.matchAll(/data-track="([^"]*)"/g)].map(m => m[1]), ['central:world:central:wiki:root', 'central:world:central:wiki:project:O-I'])
  assert.ok(grid.lastIndexOf('aria-label="Stops"') > grid.lastIndexOf('data-track="central:world:central:wiki:project:O-I"'), 'the Main column is last')
  const ruler = arrangement(set)
  const order = [...ruler.matchAll(/data-track="([^"]*)"/g)].map(m => m[1])
  assert.equal(order.at(-1), 'central:day', 'the Day lies last on the ruler')
})

test('Central\'s mixer row says what each control means here; Arm is the shell\'s write arm through its Action; what no Action carries waits', async () => {
  const armed = []
  const runner = {act: async () => { throw new Error('no Action of the registry is pressed here') },
    shell: async (action, value) => { armed.push([action, value]); return {ok: false, error: 'refused: write-arm enforcement is Factory receiving (WO-SF2)'} }}
  const set = kernelSetTracks(centralSet, {nowMs: Date.parse(`${firstDay}T12:00:00Z`), armOn: false, runner})
  assert.deepEqual(Object.keys(set.mixer).sort(), ['activator', 'arm', 'input', 'output', 'solo'], 'Monitor is for a world you visit; yours have none (§18.1)')
  assert.equal(set.mixer.output.route, 'Day', 'the output is the Day: a route, never a setting')
  assert.match(set.mixer.activator.meaning, /^Send to Day/)
  assert.match(set.mixer.activator.disabled, /missing op: .*sendToDay/, 'Send to Day has no owner field yet, and says which')
  assert.equal(set.mixer.input.route, 'the world\'s folder', 'the input of a world is its folder')
  assert.deepEqual(set.tracks.filter(track => !track.main).map(track => track.mix), [{arm: false}, {arm: false}], 'Arm reads the shell\'s flag on every world')
  assert.equal(set.actions.stopTrack, undefined, 'a world\'s Stop is no Action yet')
  assert.match(set.actions.waiting['track.stop'], /O-I #1005/, 'and the Set says what it waits for')
  const cells = lanes.mixerCells(set, set.tracks[0], 0)
  assert.deepEqual(cells.map(cell => [cell.id, cell.state, !!cell.press]), [['activator', 'unread', false], ['solo', 'unread', false], ['arm', 'off', true], ['input', 'route', false], ['output', 'route', false]])
  assert.deepEqual(await answerOf(cells[2].press.run), {ok: false, text: 'refused: write-arm enforcement is Factory receiving (WO-SF2)'}, 'the owner\'s refusal is the receipt')
  assert.deepEqual(armed, [['shell.setWriteArm', true]], 'the press is the Set\'s own act: the shell\'s setter, given the value')
  assert.match(set.lanes.absent.takes, /Central's file history is no slice of the World Model yet/, 'revisions as takes: the reading they wait on')
  // The view: the mixer row under each world's head, its controls disabled where no owner writes them.
  const grid = session(set)
  assert.equal((grid.match(/data-mixer="central:world:/g) ?? []).length, 2, 'a mixer row under every world')
  assert.match(grid, /data-mix="activator" data-state="unread" aria-label="Activator" disabled=""/)
  assert.match(grid, /data-mix="arm" data-state="off" aria-label="Arm" aria-pressed="false" title="Arm · Lets the agent/)
})

// FIXTURE: Factory's Set in the shape the kernel builds it from the sessions, factory and workcells slices (kernel mode_set.rs `factory`).
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)
const factorySet = modeSetOf({
  owner: 'Factory and AIKit · the Agent sessions, Factory\'s tasks and their attempts',
  ruler: {kind: 'clock', unit: 'seconds', origin_unix_ms: NOW - 600_000},
  rows: [1, 2, 3, 4].map(n => ({id: `batch:${n}`, name: String(n)})),
  tracks: [setTrack('space:port:space:port', 'Port', {kind: 'a SessionSpace'}), setTrack('space:port:sess-lead', 'lead', {kind: 'an Agent session', depth: 1, parent: 'space:port:space:port'})],
  clips: [setClip('space:port:sess-lead#task/1', 'space:port:sess-lead', 'batch:1', 'map field', {subject: 'task:map', status: 'done',
    at: {start_unix_ms: NOW - 600_000, end_unix_ms: NOW - 120_000}})],
  main: {name: 'Main', chain: ['Gateways', 'Experiment', 'Approvals', 'Ledger', 'Link']},
  mixer: {
    activator: {meaning: 'Telemetry: on, the session feeds the widgets, the Ledger and other agents; off, it is muted', disabled: 'Telemetry: no owner operation carries it yet — missing op: the session\'s own Telemetry on AIKit (encounter-session-settings), whose settings are no slice of the World Model yet (O-I #1006).'},
    solo: {meaning: 'You attend to the soloed sessions alone', disabled: 'Solo: what you attend to is the shell\'s, and the kernel\'s Set carries none of it yet (O-I #1006).'},
    arm: {meaning: 'Lets the session\'s agent write directly, with receipts, where Scope allows', grain: 'the shell\'s one write arm: arming one session arms every one'},
    monitor: {meaning: 'Watch: In streams the session into the widgets always; Auto streams it when it is armed or selected; Off does not stream it', disabled: 'Watch: no owner operation carries it yet — missing op: shell.setSessionWatch(sessionRef, "in" | "auto" | "off"), a per-session watch the widgets read (shell).'},
    input: {meaning: 'The way in', route: 'Gateway'},
    output: {meaning: 'The way out', route: 'Landing'},
  },
  lanes_absent: {events: 'A session\'s events by their kind (run, return, generation …): the temporal stream is no slice of the World Model yet (O-I #1006).',
    takes: 'No task Factory holds has an attempt yet: Factory records each attempt it dispatches on its task.'},
  acts: {arm: ARM},
  waiting: {'set.stop-all': 'a session\'s stop on its own encounter owner, or the bound harness\'s (O-I #1006)'},
})

test('Factory: a task lies where it ran on the clock; event lanes and takes say why none is read, in the Set\'s words', () => {
  const set = kernelSetTracks(factorySet, {nowMs: NOW})
  assert.deepEqual(set.clips[0].at, {start: 0, end: 480})
  assert.equal(set.clips[0].status, 'done', 'a finished task is done (dim and settled), not stopped')
  assert.equal(set.lanes.events, undefined, 'no event lane is drawn from a stream the World Model does not hold')
  assert.match(set.lanes.absent.events, /the temporal stream is no slice of the World Model yet \(O-I #1006\)/)
  assert.match(set.lanes.absent.takes, /No task Factory holds has an attempt yet/)
  assert.equal(set.ruler.label(0), new Date(NOW - 600_000).toTimeString().slice(0, 8), 'the run\'s ruler is the clock')
  const ruler = arrangement(set)
  assert.match(ruler, /data-lanes="events" aria-pressed="false"/, 'Events are Off by default')
})

test('Factory\'s mixer row: Watch, Telemetry and Solo say what they lack; Arm is the shell\'s write arm; Stop All waits in the Set\'s words', async () => {
  const runner = {act: async () => { throw new Error('unexpected') }, shell: async (_action, on) => ({ok: true, note: `armed ${on}`})}
  const set = kernelSetTracks(factorySet, {nowMs: NOW, armOn: true, runner})
  assert.deepEqual(Object.keys(set.mixer).sort(), ['activator', 'arm', 'input', 'monitor', 'output', 'solo'])
  assert.match(set.mixer.monitor.meaning, /^Watch: In streams the session into the widgets always/)
  assert.match(set.mixer.activator.meaning, /^Telemetry/)
  for (const id of ['activator', 'solo', 'monitor']) assert.match(set.mixer[id].disabled, /O-I #1006|no owner operation carries it yet — missing op: /, `${id} names what it lacks`)
  assert.deepEqual([set.mixer.input.route, set.mixer.output.route], ['Gateway', 'Landing'])
  assert.deepEqual(set.main, {name: 'Main', chain: ['Gateways', 'Experiment', 'Approvals', 'Ledger', 'Link']})
  const sessionTrack = set.tracks.find(track => track.id === 'space:port:sess-lead')
  assert.deepEqual(sessionTrack.mix, {arm: true})
  assert.deepEqual(await answerOf(() => set.actions.mixer.arm.run(sessionTrack.id, false)), {ok: true, text: 'armed false'})
  assert.equal(set.actions.stopAll, undefined, 'Stop All is no Action of the Set yet')
  assert.match(set.actions.waiting['set.stop-all'], /O-I #1006/)
  const grid = session(set)
  assert.match(grid, /class="cs clip done"/)
})

// ── the comp: a stretch of a take, Return, the owner's comp ──────────────────────────────────────────────────────────────────────

test('a comp chooses what stands: a stretch of a take, Return, and the owner\'s comp runs with the take and the stretch; the main lane names its source', async () => {
  const comps = []
  const set = {
    columns: [{id: 'r1', name: '1'}], ruler: {unit: 'seconds', label: at => `${at}s`},
    tracks: [{id: 'lead', name: 'Lead', kind: 'session'}],
    clips: [{id: 'c1', trackId: 'lead', columnId: 'r1', label: 'map field', at: {start: 0, end: 100}}],
    lanes: {takes: [{id: 'attempt-1', trackId: 'lead', name: 'attempt 1', spans: [{start: 0, end: 60, label: 'attempt 1'}]},
      {id: 'attempt-2', trackId: 'lead', name: 'attempt 2', spans: [{start: 10, end: 100, label: 'attempt 2'}], standing: true}],
      comp: [{trackId: 'lead', takeId: 'attempt-2', start: 10, end: 100}]},
    actions: {comp: {op: 'test:land', run: (track, take, range) => { comps.push([track, take, range]); return {ok: true, note: `${take} lands`} }}},
  }
  const presses = []
  const tree = ArrangementRulerView({set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: (key, what, run) => presses.push({key, what, run}), onDismiss: noop,
    lanes: {shown: lanes.DEFAULT_LANES, onShown: noop, take: {trackId: 'lead', takeId: 'attempt-1', from: 50, to: 20}, onTake: noop, opened: null, onOpened: noop}})
  const [body] = find(tree, node => node.props?.['aria-label'] === 'Take attempt 1')
  body.props.onKeyDown({key: 'Enter', preventDefault() {}})
  assert.deepEqual(presses.map(p => [p.key, p.what]), [['comp:lead:attempt-1', 'Comp attempt 1 20s – 50s']])
  assert.deepEqual(await answerOf(presses[0].run), {ok: true, text: 'attempt-1 lands'})
  assert.deepEqual(comps, [['lead', 'attempt-1', {start: 20, end: 50}]], 'the stretch chosen, ordered and held inside the take')
  assert.deepEqual(lanes.compRange(set.lanes.takes[0], 80, 70), null, 'a stretch that touches none of the take is no comp')
  const markup = arrangement(set)
  assert.match(markup, /data-take="attempt-2" data-standing="true"/, 'the take that stands is marked')
  assert.match(markup, /class="tl-comp" data-comp-take="attempt-2"[^>]*title="10s – 100s came from attempt 2"/, 'the main lane shows which take each stretch came from')
  assert.match(markup, /aria-label="Audition attempt 1" disabled=""/, 'no audition op: the button stands disabled and says so')
})

test('Technē: a reading that extends another lies under it as a take lane; no comp copies it, since a later reading never erases', () => {
  const layers = [{id: 'L1', name: 'Jung 1955'}, {id: 'L2', name: 'Ariadne 2026', extends: 'L1'}]
  const tracks = [{id: 't1', name: 'Jung', kind: 'reading · 2 events', layerId: 'L1'}, {id: 't2', name: 'Ariadne', kind: 'reading · 1 event', layerId: 'L2'}]
  const clips = [{id: 'e1', trackId: 't1', columnId: 'r', label: 'Tower', at: {start: 10}}, {id: 'e2', trackId: 't2', columnId: 'r', label: 'the vessel', at: {start: 30, end: 40}}]
  assert.deepEqual(techneTakeLanes(tracks, clips, layers), [{id: 'techne:take:t1:L2', trackId: 't1', name: 'Ariadne 2026 · extends', spans: [{start: 30, end: 40, label: 'the vessel'}]}])
  assert.deepEqual(Object.keys(TECHNE_MIXER), ['activator', 'solo', 'arm', 'input', 'output'], 'Monitor is none (§17.1)')
})

// ── automation: a recorded move names its device and its parameter ───────────────────────────────────────────────────────────────

test('an automation lane names its device and its parameter: an armed take\'s recorded moves, and a generator that says what moves it', () => {
  // FIXTURE: a scene as the Expressions model holds it (Scene.propertyTracks, Scene.automation), presented through the editor reading.
  const presented = {basis: {expression_ref: 'expression:w', scene_ref: 's1'}, scene: {
    propertyTracks: [{id: 'pt1', bind: 'field.params.gravity', points: [{time: 0, value: 2}, {time: 2, value: 6}, {time: 4, value: 4}]}],
    automation: [{id: 'lfo1', enabled: true, target: 'field.params.swirl', type: 'lfo', wave: 'sine', rate: .5, min: 0, max: 1, blend: 'add'},
      {id: 'off', enabled: false, target: 'field.params.drift', type: 'lfo', wave: 'saw', rate: 1, min: 0, max: 1, blend: 'replace'}]}}
  assert.deepEqual(sceneAutomationOf(presented).map(lane => [lane.device, lane.parameter, lane.points.length, lane.modulatedBy ?? null]),
    [['Field', 'gravity', 3, null], ['Field', 'swirl', 0, 'lfo · sine · 0.5 Hz · modulation (add)']], 'a disabled generator moves nothing and has no lane')
  const content = {basis: {expression_ref: 'expression:w', scene_ref: 's1'}, playback: {scene_ref: 's1', scene_playing: true, saved_sequence_playing: false},
    scenes: {scenes: [{scene_ref: 's1', title: 'Opening', native_title: 'n', working: {duration: 8, transition: 0}, snapshot: {duration: null}, material: {available: true, reason: null}},
      {scene_ref: 's2', title: 'Second', native_title: 'n2', working: {duration: 4, transition: 0}, snapshot: {duration: null}, material: {available: false, reason: 'no material captured'}}]}}
  const set = nativeTracks(content, 'Work', {reading: presented, held: 2})
  const [recorded, generated] = set.lanes.automation
  assert.deepEqual([recorded.device, recorded.parameter, recorded.range, recorded.points.map(p => p.value)], ['Field', 'gravity', {min: 2, max: 6}, [0, 1, .5]], 'its points within the span it recorded')
  assert.equal(recorded.clipId, 'scene:expression:w:s1:visual', 'on the scene\'s own time')
  assert.deepEqual(set.clips.filter(clip => clip.id.endsWith(':visual')).map(clip => [clip.label, clip.status ?? null, clip.note ?? null]), [['Opening', 'running', null], ['Second', null, 'no material captured']])
  assert.equal(set.main.differs, true, 'a scene plays outside the saved sequence: Back to Arrangement lights')
  assert.equal(set.lanes.held, 2)
  const ruler = arrangement(set)
  assert.match(ruler, /data-automation="scene:expression:w:s1#lane\/pt1"[^>]*><span class="tl-head tl-auto-head" title="Field \/ gravity · 2 – 6 · 3 points"><span class="tl-lane-name">Field \/ gravity<\/span>/)
  assert.match(ruler, /<polyline points="0\.000,100\.000 /, 'the recorded move is drawn through its points, from the scene\'s start')
  assert.match(ruler, /<small class="tl-mod">lfo · sine · 0\.5 Hz · modulation \(add\)<\/small>/, 'a modulated parameter shows what moves it')
  assert.match(ruler, /class="tl-reenable lit" disabled=""/, 'two values are held by hand; no Re-enable op handed in here')
  assert.match(session(set), /class="ba lit" aria-label="Back to Arrangement" disabled=""/)
  // The Lanes setting turns Automation off: no lane is drawn.
  const off = renderToStaticMarkup(React.createElement(ArrangementRulerView, {set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: noop, onDismiss: noop,
    lanes: {shown: {takes: true, automation: false, events: false}, onShown: noop, take: null, onTake: noop, opened: null, onOpened: noop}}))
  assert.doesNotMatch(off, /data-automation=/)
})

// O-I #855 round 24 (DLW build ruling 2026-11-05: "Project `take-lane:torus/*` into the Expressions track adapter and the sequence editor";
// manual §20.1: "Takes lie as take lanes under the Expression's track in Arrangement view", and in the Sequence tab "The scene's sound lies
// beneath it"). FIXTURE: the scenes inventory's rows as expressions-boundary scenes.ts sceneTorusTakes reads a Scene's performance.
test('a Torus take under a scene lies as a take lane under its Expression\'s sound, from its second of the scene where the scene lies on the ruler', async () => {
  const {placeClips} = {...await import('../src/frame/tracks/ArrangementRuler.tsx'), ...await import('../src/inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx')}
  const take = {lane_ref: 'take-lane:torus/3', title: 'Take 3', enabled: true, solo: false, take_ref: 'sha256:' + '1'.repeat(64), at_sample: '96000', frames: '144000',
    sample_rate: 48000, transport_rate: 48000, at_seconds: 2, seconds: 3}
  const row = (ref, title, duration, extra = {}) => ({scene_ref: ref, title, native_title: title, working: {duration, transition: 0}, snapshot: {duration: null},
    material: {available: true, reason: null}, ...extra})
  const content = {basis: {expression_ref: 'expression:w', scene_ref: 's1'}, playback: null,
    scenes: {scenes: [row('s1', 'Opening', 8), row('s2', 'Second', 12, {torus_takes: [take]})]}}
  const set = nativeTracks(content, 'Work')
  assert.deepEqual(set.lanes.takes, [{id: 'scene:expression:w:s2#take-lane:torus/3', trackId: 'expression:expression:w:audio', name: 'Take 3',
    spans: [{start: 10, end: 13, label: 'Take 3'}], enabled: true, solo: false}], 'two seconds into the second scene, which lies from 8 s, for its three seconds')
  const second = placeClips(set).placed.find(p => p.clip.id === 'scene:expression:w:s2:audio')
  assert.equal(second.start + take.at_seconds, set.lanes.takes[0].spans[0].start, 'the lane lies where the ruler lays its scene')
  assert.equal(set.lanes.absent.takes, undefined, 'a take lane lies: the lanes are not absent')
  assert.match(arrangement(set), /data-take="scene:expression:w:s2#take-lane:torus\/3"[^>]*><span class="tl-head tl-take-head" title="Take 3 · a take/)
  const none = nativeTracks({...content, scenes: {scenes: [row('s1', 'Opening', 8)]}}, 'Work')
  assert.equal(none.lanes.takes, undefined)
  assert.equal(typeof none.lanes.absent.takes, 'string', 'no take lies: why the lanes are absent is still said')
  // O-I #855 round 25 (DLW build ruling 2026-11-05: "wire it into the product's sequence editor, or retire it with its replacement named.
  // Nothing ships that only tests call"): the scene's sound beneath its roll is the Clip view's Sequence tab (inhabitants/catalogue/clips/
  // expressions.tsx SoundUnder, from clipBinding.ts `takes`; tests/expressions-clip.test.mjs); the timeline projection only tests called is retired.
  const sequence = await readFile(new URL('../src/timeline/expressionsSequenceEditor.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(sequence, /torusTakes|takeLanes|soundTrackId|kind: 'sound'/, 'no Sound track or take lane is projected for tests alone')
  assert.match(sequence, /The scene's sound beneath the roll is drawn by the Clip view's Sequence tab/, 'its replacement named')
})

// O-I #855 round 25 (DLW build ruling 2026-11-05: "give the Torus take lanes Audition and Comp, and show their Activator and Solo, as Live's
// take lanes have them"; "Which lane sounds: one per row, the active lane (Live's main lane / comp); Audition on a take lane solos that lane in
// place of it"). FIXTURE: the scenes inventory's rows as expressions-boundary scenes.ts reads a Scene's performance; the owners are fakes.
test('a Torus take lane shows its Activator and Solo, auditions in place of the main lane, and comps a stretch chosen on it into the main lane', async () => {
  const take = (n, extra = {}) => ({lane_ref: `take-lane:torus/${n}`, title: `Take ${n}`, enabled: true, solo: false, take_ref: 'sha256:' + String(n).repeat(64),
    at_sample: '96000', frames: '144000', sample_rate: 48000, transport_rate: 48000, at_seconds: 2, seconds: 3, ...extra})
  const row = (ref, title, duration, extra = {}) => ({scene_ref: ref, title, native_title: title, working: {duration, transition: 0}, snapshot: {duration: null},
    material: {available: true, reason: null}, ...extra})
  const content = {basis: {expression_ref: 'expression:w', scene_ref: 's2'}, playback: null, scenes: {scenes: [row('s1', 'Opening', 8), row('s2', 'Second', 12, {
    torus_takes: [take(3), take(4, {enabled: false, solo: true})],
    torus_comp: [{lane_ref: 'take-lane:torus/3', start_sample: '120000', end_sample: '168000', sample_rate: 48000, start_seconds: 2.5, end_seconds: 3.5}]})]}}
  const calls = []
  const answer = note => ({ok: true, note})
  const takes = {audition: {op: 'test:audition', scene: 's2', lane: 'take-lane:torus/4', run: (scene, lane) => { calls.push(['audition', scene, lane]); return answer('heard') }},
    comp: {op: 'test:comp', run: (scene, stretch) => { calls.push(['comp', scene, stretch]); return answer('comped') }},
    lane: {op: 'test:lane', run: (scene, lane, setting) => { calls.push(['lane', scene, lane, setting]); return answer('set') }}}
  const set = nativeTracks(content, 'Work', {controls: {takes}})
  const id = n => `scene:expression:w:s2#take-lane:torus/${n}`, audio = 'expression:expression:w:audio'
  assert.deepEqual(set.lanes.takes.map(lane => [lane.id, lane.enabled, lane.solo, lane.auditioned]), [[id(3), true, false, false], [id(4), false, true, true]],
    'each lane\'s Activator and Solo as the Scene holds them, and the lane the frame auditions')
  assert.deepEqual(set.lanes.comp, [{trackId: audio, takeId: id(3), start: 10.5, end: 11.5}], 'the main lane shows which take its stretch came from, where the scene lies')
  assert.deepEqual([set.actions.audition.op, set.actions.comp.op, set.actions.takeLane.op], ['test:audition', 'test:comp', 'test:lane'])
  // Audition on a lane auditions it; on the lane auditioned, the main lane sounds again.
  assert.deepEqual(await set.actions.audition.run(audio, id(3)), answer('heard'))
  await set.actions.audition.run(audio, id(4))
  // Comp: the stretch chosen on the ruler, as samples of the Scene's transport, within the take.
  await set.actions.comp.run(audio, id(3), {start: 10.5, end: 12})
  await set.actions.comp.run(audio, id(3), {start: 9, end: 20})
  // Activator and Solo, on the lane's own layer.
  await set.actions.takeLane.run(audio, id(4), {enabled: true, solo: true})
  assert.deepEqual(calls, [['audition', 's2', 'take-lane:torus/3'], ['audition', 's2', null],
    ['comp', 's2', {lane_ref: 'take-lane:torus/3', start_sample: '120000', end_sample: '192000'}],
    ['comp', 's2', {lane_ref: 'take-lane:torus/3', start_sample: '96000', end_sample: '240000'}],
    ['lane', 's2', 'take-lane:torus/4', {enabled: true, solo: true}]], 'two and a half seconds into the scene is sample 120000 of its transport')
  calls.length = 0
  assert.match((await set.actions.comp.run(audio, `scene:expression:w:s2#take-lane:torus/9`, {start: 10, end: 11})).error, /is no take lane of this Expression/)
  assert.match((await set.actions.takeLane.run('expression:expression:w:visual', id(3), {enabled: false, solo: false})).error, /is no take lane of this Expression/)
  assert.match((await set.actions.comp.run(audio, id(3), {start: 30, end: 31})).error, /^The stretch chosen lies outside Take 3/)
  assert.deepEqual(calls, [], 'refused before any owner is called')
  // Drawn as Live's take lanes: the Activator and Solo on the lane's head, and Audition lit on the lane it sounds in place of the main lane.
  const ruler = arrangement(set)
  const head = n => ruler.slice(ruler.indexOf(`data-take="${id(n)}"`), ruler.indexOf('tl-take-body', ruler.indexOf(`data-take="${id(n)}"`)))
  assert.match(head(3), /class="mx mx-activator" data-mix="activator" data-state="on" aria-label="Activator of Take 3" aria-pressed="true"/)
  assert.match(head(3), /class="mx mx-solo" data-mix="solo" data-state="off" aria-label="Solo of Take 3" aria-pressed="false"/)
  assert.match(head(3), /class="tl-audition" aria-label="Audition Take 3" aria-pressed="false"/)
  assert.match(head(4), /data-state="off" aria-label="Activator of Take 4"/)
  assert.match(head(4), /data-state="on" aria-label="Solo of Take 4"/)
  assert.match(head(4), /class="tl-audition lit" aria-label="Audition Take 4" aria-pressed="true"[^>]*title="Take 4 sounds in place of the main lane · press to hear the main lane again \(test:audition\)"/)
  // Pressed, each goes through its owner op with the setting it turns to.
  const presses = []
  const tree = ArrangementRulerView({set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: (key, what, run) => presses.push({key, what, run}), onDismiss: noop,
    lanes: {shown: lanes.DEFAULT_LANES, onShown: noop, take: null, onTake: noop, opened: null, onOpened: noop}})
  for (const label of ['Activator of Take 3', 'Solo of Take 4', 'Audition Take 3']) find(tree, node => node.props?.['aria-label'] === label)[0].props.onClick()
  assert.deepEqual(presses.map(p => [p.key, p.what]), [[`take-activator:${audio}:${id(3)}`, 'Activator of Take 3 off'], [`take-solo:${audio}:${id(4)}`, 'Solo of Take 4 off'],
    [`audition:${audio}:${id(3)}`, 'Audition Take 3']])
  for (const press of presses) await answerOf(press.run)
  assert.deepEqual(calls, [['lane', 's2', 'take-lane:torus/3', {enabled: false, solo: false}], ['lane', 's2', 'take-lane:torus/4', {enabled: false, solo: false}],
    ['audition', 's2', 'take-lane:torus/3']])
  // A set whose owner gives no lane op shows the lane's Activator and Solo as they stand, and says why they cannot be pressed.
  const still = arrangement(nativeTracks(content, 'Work'))
  assert.match(still, /class="mx mx-activator" data-mix="activator" data-state="on" aria-label="Activator of Take 3" aria-pressed="true" disabled=""/)
})

// O-I #855 round 25: the presented Scene's take lanes act through their owners — Audition through the frame's stage (`take-audition`), the comp
// and a lane's Activator and Solo through the Scene's performance (`comp-take`, `take-lane`) — and a lane of a Scene not presented is refused in
// words before any owner is called. FIXTURE: the frame's link and the Scene's performance channel are fakes the test drives.
test('the presented Scene\'s take lanes act through the frame\'s stage and the Scene\'s performance; another Scene\'s are refused in words', async () => {
  const {expressionsControls} = await import('../src/frame/tracks/modeTracks.ts')
  const presets = await import('../src/live/LivePresets.tsx')
  const staged = [], performed = []
  const link = {state: {nativeScene: {expression_ref: 'expression:w', scene_ref: 's2'},
    instrument: {ok: true, parameters: {take: {sounding: null, audition: 'take-lane:torus/4', refusal: null}}}},
    run: async command => { staged.push(command); return command.command === 'take-audition' && command.lane_ref === 'take-lane:torus/9' ? {ok: false, error: 'The presented Scene has no take lane take-lane:torus/9 to audition.'} : {ok: true} }}
  presets.setLivePerformanceChannel(async action => { performed.push(action)
    return action.action === 'comp-take' ? {state: 'take-comped', lane_ref: action.lane_ref, start_sample: action.start_sample, end_sample: action.end_sample, unsaved: true}
      : {state: 'take-lane-set', lane_ref: action.lane_ref, enabled: action.enabled, solo: action.solo, unsaved: false} })
  try {
    const {takes} = expressionsControls(undefined, link)
    assert.deepEqual([takes.audition.scene, takes.audition.lane], ['s2', 'take-lane:torus/4'], 'the lane the frame reports auditioned on the presented Scene')
    assert.deepEqual(await takes.audition.run('s2', 'take-lane:torus/3'), {ok: true, note: 'The take sounds in place of the main lane.'})
    assert.deepEqual(await takes.audition.run('s2', null), {ok: true, note: 'The main lane sounds again.'})
    assert.deepEqual(await takes.audition.run('s2', 'take-lane:torus/9'), {ok: false, error: 'The presented Scene has no take lane take-lane:torus/9 to audition.'})
    assert.deepEqual(staged, [{command: 'take-audition', lane_ref: 'take-lane:torus/3'}, {command: 'take-audition', lane_ref: null}, {command: 'take-audition', lane_ref: 'take-lane:torus/9'}])
    const stretch = {lane_ref: 'take-lane:torus/3', start_sample: '120000', end_sample: '192000'}
    assert.deepEqual(await takes.comp.run('s2', stretch), {ok: true, note: 'The stretch stands in the main lane. The Scene keeps it until the Expression is saved, then the file does.'})
    assert.deepEqual(await takes.lane.run('s2', 'take-lane:torus/4', {enabled: true, solo: false}), {ok: true, note: 'The take lane is on, not soloed.'})
    assert.deepEqual(performed, [{action: 'comp-take', ...stretch}, {action: 'take-lane', lane_ref: 'take-lane:torus/4', enabled: true, solo: false}])
    // another Scene's lane: refused in words before any owner is called
    staged.length = 0; performed.length = 0
    const elsewhere = /^That take lies under another Scene than the one presented: present its Scene to act on its take lanes\.$/
    assert.match((await takes.audition.run('s1', 'take-lane:torus/3')).error, elsewhere)
    assert.match((await takes.comp.run('s1', stretch)).error, elsewhere)
    assert.match((await takes.lane.run('s1', 'take-lane:torus/3', {enabled: false, solo: false})).error, elsewhere)
    assert.deepEqual([staged, performed], [[], []])
    // the owner's refusal stands in its words; the answers it may give are read exactly
    presets.setLivePerformanceChannel(async () => ({state: 'refused', reason: 'The Scene has no take lane take-lane:torus/8.', missing: []}))
    assert.deepEqual(await takes.lane.run('s2', 'take-lane:torus/8', {enabled: true, solo: true}), {ok: false, error: 'The Scene has no take lane take-lane:torus/8.'})
    presets.setLivePerformanceChannel(async () => ({state: 'take-comped', lane_ref: 'take-lane:torus/3'}))
    assert.deepEqual(await presets.commitLivePerformance({action: 'comp-take', ...stretch}), {state: 'refused', reason: 'The owner answered the preset request in an unknown shape', missing: []})
    // no Scene presented: no take acts
    assert.equal(expressionsControls(undefined, {...link, state: {...link.state, nativeScene: null}}).takes, undefined)
    // the pane draws again when the frame reports another lane auditioned, so the Audition lit is the frame's
    const {MODE_REDRAWS} = await import('../src/frame/tracks/modeTracks.ts')
    const frame = await import('../src/native/frameTakes.ts')
    let drawn = 0
    const off = MODE_REDRAWS.expressions.subscribe(() => { drawn += 1 })
    try {
      frame.publishFrameTakeLink(link)
      assert.equal(MODE_REDRAWS.expressions.snapshot(), 'take-lane:torus/4')
      const heard = drawn
      frame.publishFrameTakeLink({...link, state: {...link.state, instrument: {ok: true, parameters: {take: {sounding: null, audition: null, refusal: null}}}}})
      assert.ok(drawn > heard, 'the frame\'s new report draws the pane again')
      assert.equal(MODE_REDRAWS.expressions.snapshot(), null, 'the main lane sounds again: no Audition lit')
    } finally { off(); frame.publishFrameTakeLink({state: null, run: null}) }
  } finally { presets.setLivePerformanceChannel(null) }
})

// O-I #849 round 22 (DLW build ruling 2026-11-05): "Its Torus parameters are baked in and carry no Overridden mark. Touching one says the
// take is frozen, in words, and offers Unfreeze, which returns the part to its live Torus." FIXTURE: the clip players' lane standing as
// live/clipPlayer.ts publishes a frozen take's, through Live's own adapter.
test('a frozen take\'s lane carries no Overridden mark: touched, it says the take is frozen, in words, and Unfreeze beside it lets the take go', async () => {
  const unfrozen = []
  const play = {launch: async () => ({ok: true, note: ''}), stop: () => ({ok: true, note: ''}), stopAll: () => ({ok: true, note: ''}), reenable: async () => ({ok: true, note: ''}),
    unfreeze: async track => { unfrozen.push(track); return {ok: true, note: 'Pads is unfrozen.'} }}
  const summary = {path: '/sets/a.als', tempo_bpm: 120, scene_count: 1, arrangement_clips: 0,
    tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'midi', name: 'Pads', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const words = 'Pads is frozen: its Torus is rendered into its sound, so its parameters do not move. Unfreeze returns the part to its live Torus.'
  const standing = {automated: [], overridden: ['carrier'], take: {address: {path: '/sets/a.als', track: 1, at: {slot: 0}}, name: 'Pads', at: 0, frozen: words},
    lanes: [{parameter: 'carrier', label: 'Carrier', points: [{beat: 0, value: 0}, {beat: 2, value: 1}]}]}
  const set = liveSetTrackAdapter.project({set: summary, document: null, play, lanes: standing})
  const ruler = arrangement(set)
  assert.match(ruler, /data-automation="als:\/sets\/a\.als#track\/1\/slot\/0#lane\/carrier" data-frozen="true"/)
  assert.doesNotMatch(ruler, /data-overridden="true"/, 'the hand holds Carrier off another take\'s lane; this one is baked in, never Overridden')
  assert.match(ruler, new RegExp(`<button type="button" class="tl-lane-name tl-frozen" title="${words.replace(/[.]/g, '\\.')}">Pads / Carrier</button>`))
  assert.match(ruler, /<button type="button" class="tl-reenable lit" title="Unfreeze: Pads&#x27;s part plays its live Torus again \(the clip player \(live\/clipPlayer\.ts unfreeze\): live_engine_unfreeze \{track\}[^"]*\)">Unfreeze<\/button>/)
  const presses = []
  const tree = ArrangementRulerView({set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: (key, what, run) => presses.push({key, what, run}), onDismiss: noop,
    lanes: {shown: lanes.DEFAULT_LANES, onShown: noop, take: null, onTake: noop, opened: null, onOpened: noop}})
  const [name] = find(tree, node => node.props?.className === 'tl-lane-name tl-frozen')
  name.props.onClick()
  const [unfreeze] = find(tree, node => node.type === 'button' && node.props?.children === 'Unfreeze')
  unfreeze.props.onClick()
  const lane = 'als:/sets/a.als#track/1/slot/0#lane/carrier'
  assert.deepEqual(presses.map(p => [p.key, p.what]), [[`frozen:${lane}`, 'Pads / Carrier'], [`unfreeze:${lane}`, 'Unfreeze Pads']])
  assert.deepEqual(await answerOf(presses[0].run), {ok: true, text: words}, 'touched, it says the take is frozen, in words')
  assert.deepEqual(await answerOf(presses[1].run), {ok: true, text: 'Pads is unfrozen.'})
  assert.deepEqual(unfrozen, [1], 'Unfreeze reaches the part its clip is on')
  // Handed no Unfreeze, the button stands disabled and says so.
  assert.match(arrangement(liveSetTrackAdapter.project({set: summary, document: null, play: {...play, unfreeze: undefined}, lanes: standing})),
    /class="tl-reenable lit" disabled="" title="Unfreeze: the owner gives no op that lets the frozen take go">Unfreeze<\/button>/)
  const css = await readFile(new URL('../src/frame/tracks/tracks.css', import.meta.url), 'utf8')
  assert.match(css, /\.tl-lane\.tl-auto\[data-frozen\] \.tl-auto-line polyline \{ stroke: var\(--text-faint\); stroke-dasharray: 3 2 \}/, 'its line drawn as baked')
})

// O-I #849 round 23 (DLW build ruling 2026-11-05: "Repeat a looping clip's lanes in Arrangement too"). FIXTURE: the clip player's lane
// standing for a looping take played from Arrangement view, as live/clipPlayer.ts publishes it, through Live's own adapter.
test('a looping arrangement clip\'s take lane is drawn again for each pass of its loop, from the clip\'s start to its end on the ruler', () => {
  const play = {launch: async () => ({ok: true, note: ''}), stop: () => ({ok: true, note: ''}), stopAll: () => ({ok: true, note: ''}), reenable: async () => ({ok: true, note: ''})}
  const summary = {path: '/sets/a.als', tempo_bpm: 120, scene_count: 1, arrangement_clips: 1,
    tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'midi', name: 'Pads', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const document = {path: '/sets/a.als', tempo: 120, scenes: 1, tracks: [{kind: 'midi', name: 'Keys', devices: [], arrangementClips: [], sessionSlots: {}},
    {kind: 'midi', name: 'Pads', devices: [], arrangementClips: [{name: 'Riff', kind: 'midi', start: 16, end: 24}], sessionSlots: {}}, {kind: 'master', name: 'Main', devices: [], arrangementClips: [], sessionSlots: {}}]}
  const standing = {automated: ['frame'], overridden: [], take: {address: {path: '/sets/a.als', track: 1, at: {arrangement: 0}}, name: 'Riff', loop: {start: 6, from: 4, to: 8}},
    lanes: [{parameter: 'frame', label: 'Frame', points: [{beat: 5, value: 0.4}, {beat: 7, value: 0.6}]}]}
  const ruler = arrangement(liveSetTrackAdapter.project({set: summary, document, play, lanes: standing}))
  assert.match(ruler, /data-automation="als:\/sets\/a\.als#track\/1\/clip\/0#lane\/frame"[^>]*><span class="tl-head tl-auto-head" title="Riff \/ Frame · 4 points">/,
    'beat 7 at the clip\'s start, then the loop\'s 5 and 7 a pass on, and again: four, none past the clip\'s end')
})

test('Expressions: a scene launches, Stop All pauses and Back to Arrangement plays the saved sequence, each through the presented composition', async () => {
  const sent = []
  const {expressionsControls} = await import('../src/frame/tracks/modeTracks.ts')
  const source = {isPresented: () => true, content: {playback: {saved_sequence_playing: false}},
    actions: {scene: async action => { sent.push(action); return {ok: true, reading: {}} }}}
  const controls = expressionsControls(source, {state: null, run: null})
  const content = {basis: {expression_ref: 'expression:w', scene_ref: 's1'}, playback: null,
    scenes: {scenes: [{scene_ref: 's1', title: 'Opening', native_title: 'n', working: {duration: 8, transition: 0}, snapshot: {duration: null}, material: {available: true, reason: null}}]}}
  const set = nativeTracks(content, 'Work', {controls})
  assert.deepEqual(await answerOf(() => set.actions.launch.run('scene:expression:w:s1:visual')), {ok: true, text: 'The scene plays.'})
  assert.deepEqual(await answerOf(() => set.actions.stopAll.run()), {ok: true, text: 'Every scene stopped.'})
  assert.deepEqual(await answerOf(() => set.actions.backToArrangement.run()), {ok: true, text: 'The saved sequence plays again.'})
  assert.deepEqual(sent, [{action: 'play-scene', scene_ref: 's1'}, {action: 'pause'}, {action: 'play-saved'}])
  assert.equal(controls.reenable, undefined, 'no frame link: no Re-enable')
  assert.equal(set.main.differs, undefined, 'no playback read: nothing to compare with the ruler')
})

// ── Live: the master is the Main track ───────────────────────────────────────────────────────────────────────────────────────────

test('Live: the set\'s master track is the Main track, its chain the devices on it; every control of the row names the op the set lacks', () => {
  // FIXTURE: a set summary in the live-set reading's shape (shell/useSet.ts SetSummary).
  const set = liveSetTrackAdapter.project({set: {path: '/sets/demo.als', tempo_bpm: 120, scene_count: 2, arrangement_clips: 0, tracks: [
    {kind: 'midi', name: 'Keys', devices: ['Torus']}, {kind: 'return', name: 'A-Reverb', devices: ['Reverb']}, {kind: 'master', name: 'Main', devices: ['Glue Compressor']}]}, document: null})
  assert.deepEqual(set.tracks.map(track => [track.name, track.main ?? false]), [['Keys', false], ['A-Reverb', false], ['Main', true]])
  assert.deepEqual(set.main, {name: 'Main', chain: ['Glue Compressor']})
  for (const control of Object.values(LIVE_MIXER)) assert.match(control.disabled, /missing op: live_track_mixer_write .*\(kernel · live-set\)/)
  assert.match(set.lanes.absent.automation, /AutomationEnvelopes/)
  const grid = session(set)
  assert.deepEqual([...grid.matchAll(/data-track="([^"]*)"/g)].map(m => m[1]), ['als:/sets/demo.als#track/0', 'als:/sets/demo.als#track/1'], 'the master is no column: it is Main')
  assert.equal((grid.match(/data-mixer="als:/g) ?? []).length, 2, 'every part shows its mixer row')
  assert.match(grid, /data-mix="monitor" data-state="unread" aria-label="Monitor" disabled=""[^>]*>—</, 'Monitor unread: never filled in')
})

// ── the views, mode-free ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the views: a mixer row under every track the set owns, the Main track last, every clip state drawn as the table says', async () => {
  const set = {
    columns: [{id: 'r1', name: '1'}, {id: 'r2', name: '2'}, {id: 'r3', name: '3'}], mixer: {solo: {meaning: 'Only soloed ones run'}, arm: {meaning: 'Writes directly'}},
    tracks: [{id: 'a', name: 'A', kind: 'k', mix: {solo: true}}, {id: 'b', name: 'B', kind: 'k'}, {id: 'ro', name: 'Firings', kind: 'cron', readOnly: true}, {id: 'm', name: 'Day', kind: 'day', main: true}],
    clips: ['waiting', 'running', 'stopped', 'recording', 'stalled', 'done'].map((status, i) => ({id: `c${i}`, trackId: i % 2 ? 'b' : 'a', columnId: `r${Math.floor(i / 2) + 1}`, label: status, status}))
      .concat([{id: 'face', trackId: 'm', columnId: 'r1', label: '10-17 · 2 entries'}]),
    actions: {mixer: {solo: {op: 'test:solo', run: (id, on) => ({ok: true, note: `solo ${id} ${on}`})}}},
  }
  const grid = session(set)
  assert.equal((grid.match(/data-mixer="(a|b)"/g) ?? []).length, 2, 'a row under each owned track; none under a track read from another reading')
  assert.match(grid, /data-mix="solo" data-state="on" aria-label="Solo" aria-pressed="true"/)
  assert.match(grid, /data-mix="arm" data-state="unread" aria-label="Arm" disabled="" title="Arm · Writes directly · unread: the owner reports none"/)
  assert.match(grid, /class="cs main-clip" role="gridcell"[^>]*data-clip="face"><button type="button" class="stop-launch"[^>]*>▸<\/button><button type="button" class="cs-label main-face"/, 'the Main track\'s own clip stands beside its row\'s launcher')
  assert.ok(grid.indexOf('aria-label="Stops"') > grid.indexOf('data-track="ro"'), 'the Main column stands last')
  for (const status of ['waiting', 'running', 'stopped', 'recording', 'stalled', 'done']) assert.match(grid, new RegExp(`class="cs clip ${status}"`))
  assert.match(grid, /<i class="cs-rec" role="img" aria-label="Recording"><\/i>/, 'recording is marked with the record light')
  const cells = lanes.mixerCells(set, set.tracks[0], 0)
  assert.deepEqual(await answerOf(cells.find(cell => cell.id === 'solo').press.run), {ok: true, text: 'solo a false'}, 'Solo on → pressed asks the owner for off')
  assert.deepEqual(lanes.mainLast(set.tracks).map(track => track.id), ['a', 'b', 'ro', 'm'])
  const css = await readFile(new URL('../src/frame/tracks/tracks.css', import.meta.url), 'utf8')
  assert.match(css, /\.cs\.clip\.done \{ opacity: \.5/, 'Done is dimmed and settled'); assert.doesNotMatch(css, /\.cs\.clip\.stopped \{/, 'Stopped is ready, in full colour')
  assert.match(css, /\.cs\.clip\.running::before \{[^}]*animation: tracks-fill/, 'Running: a fill that grows')
  assert.match(css, /\.cs\.clip\.waiting \.tri \{[^}]*animation: tracks-blink \.35s/, 'Waiting: a fast blink')
  assert.match(css, /\.cs\.clip\.stalled \{ background: repeating-linear-gradient/, 'Stalled: striped')
  // No raw colour in the new rules: shell tokens only.
  const r3 = css.slice(css.indexOf('/* R3 — the mixer row'))
  assert.doesNotMatch(r3, /#[0-9a-f]{3,8}\b|rgba?\(/i)
  // The Lanes setting stands under the ruler with each kind's count and the owner's reason for an absent kind.
  const ruler = arrangement({...set, lanes: {absent: {takes: 'no attempts read — missing op: x'}}})
  assert.match(ruler, /data-lanes="takes" aria-pressed="true" data-count="0" title="Takes · On · 0 lanes · no attempts read — missing op: x"/)
  assert.match(ruler, /data-lanes="events" aria-pressed="false"/, 'Events are Off by default')
  const order = [...ruler.matchAll(/data-track="([^"]*)"/g)].map(m => m[1])
  assert.equal(order.at(-1), 'm', 'the Main track\'s material lies last on the ruler')
})
