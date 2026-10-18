import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// R3 (T-REALIGN §3; manual §16.6 "Tracks, Session view and Arrangement view", §16.8, §17.1–§21.1 "The mixer row"; lock §0.3 item 3–4):
// every track's mixer row with its mode's meaning, the Main track last with its row launchers, Stop All and Back to Arrangement,
// and the lanes under the tracks in Arrangement view — automation, take lanes with the comp, Factory's event lanes.
//
// Channels (each claim below is carried by exactly one):
// - REAL CAPTURE: tests/fixtures/central-vertical/now-list.capture.json (read-only `ctrl central.now.list`, 14 Oct 2026), mapped
//   to the Day's entries by the kernel's own rule, as tests/central-tracks.test.mjs maps it.
// - FIXTURE: the workspace book (in desktop/cradle/src/workspace/store.ts's own shape), the agency tracks (through the run model's
//   own builders, as tests/factory-tracks.test.mjs builds them), the temporal events in the kernel's wire shape
//   (desktop/cradle/kernel/src/temporal_events.rs: EventKind kebab-case), a scene's property tracks and automation lanes in the
//   Expressions model's shape, a Live set summary. Each is labelled where it is used.
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
const factory = await import('../src/timeline/factoryTrackAdapter.ts')
const model = await import('../src/agent/agentRunModel.ts')
const {techneTakeLanes, TECHNE_MIXER} = await import('../src/timeline/techneTrackAdapter.ts')
const {liveSetTrackAdapter, LIVE_MIXER} = await import('../src/timeline/liveSetTrackAdapter.ts')
const {nativeTracks, sceneAutomationOf} = await import('../src/frame/tracks/modeTracks.ts')
const {shellWriteArm} = await import('../src/frame/tracks/useFactoryTracks.ts')
const {SessionGrid, SessionGridView, answerOf} = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler, ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
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

// ── Central: workspaces are the tracks, the Day is the Main track ─────────────────────────────────────────────────────────────────

// REAL CAPTURE: the NOW clearings → the Day's entries (temporal_sources.rs now_record_to_event), as central-tracks.test.mjs maps them.
const FIXTURES = new URL('./fixtures/central-vertical/', import.meta.url)
const capture = async name => JSON.parse(await readFile(new URL(name, FIXTURES), 'utf8'))
const policy = (await capture('time-policy.capture.json')).data.policy
const londonDate = unixMs => new Intl.DateTimeFormat('en-CA', {timeZone: policy.timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(unixMs))
const nowEvents = (await capture('now-list.capture.json')).data.records.map(record => {
  const instant = record.created_at_unix_seconds * 1000
  return {stream: 'central-now', kind: 'now', subject_ref: record.now_ref, instant_unix_ms: instant, summary: record.purpose,
    day_ref: `central:day:${policy.scope_ref}:${londonDate(instant)}`, evidence_refs: [record.source_ref].filter(Boolean)}
})
const firstDay = new Date(Math.min(...nowEvents.map(event => event.instant_unix_ms))).toISOString().slice(0, 10)

// FIXTURE: the workspace book as desktop/cradle/src/workspace/store.ts holds it — two workspaces, the first opened a Flow on the day
// the first NOW clearing was made (its recentPlaces, the book's own record of the files it opened).
const visited = Date.parse(`${firstDay}T10:15:00Z`)
// FIXTURE: Central's worlds (central/centralWorlds.ts) and their pages (the page owner's listing), T-WORLDS W2.
const worlds = [{ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null},
  {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'}]
const at = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
const pages = new Map([['central:wiki:root', {state: 'read', listing: {schema: 'oi.page-list/v1', path: 'Control/user/flows', more: false, not_pages: [],
  pages: [{location: at('Control/user/flows/flow-2026-10-07-1014.html'), name: 'flow-2026-10-07-1014.html', form: 'flow', title: 'Closing the day', revision: 'r', world: null}]}}]])
const daySetReading = {state: 'read', civilDate: firstDay, set: {schema: 'oi.day-set/v1', tracks: [{world: 'central:wiki:project:O-I'}], rows: []}}

test('Central: today\'s worlds are the tracks, each with its pages; the Day is the Main track, last, with the day\'s entries', () => {
  const set = central.projectCentralTracks({civil: {state: 'live', events: nowEvents, absences: []}, worlds: {state: 'read', worlds}, set: daySetReading, pages})
  assert.deepEqual(set.tracks.map(track => [track.id, track.main ?? false]), [['central:world:central:wiki:root', false], ['central:world:central:wiki:project:O-I', false], ['central:day', true]])
  assert.deepEqual(set.main, {name: `Day · ${firstDay}`, chain: ['Day', 'Approvals']}, 'the Main track\'s own chain: the Day, then Approvals (§18.1)')
  const page = set.clips.find(clip => clip.trackId === 'central:world:central:wiki:root')
  assert.equal(page.id, 'Control/user/flows/flow-2026-10-07-1014.html')
  assert.equal(set.columns.find(column => column.id === page.columnId).id, 'central:slot:1', 'a page no named row holds stands in its slot\'s row')
  assert.deepEqual(central.centralSubjectOfClip(page.id), {kind: 'note', path: 'Control/user/flows/flow-2026-10-07-1014.html'}, 'it opens as the page the path names')
  // The Session: the worlds are columns, the Day stands in the Main column at the end; the Arrangement lays the Day last.
  const grid = session(set)
  assert.deepEqual([...grid.matchAll(/data-track="([^"]*)"/g)].map(m => m[1]), ['central:world:central:wiki:root', 'central:world:central:wiki:project:O-I'])
  assert.ok(grid.lastIndexOf('aria-label="Stops"') > grid.lastIndexOf('data-track="central:world:central:wiki:project:O-I"'), 'the Main column is last')
  const ruler = arrangement(set)
  const order = [...ruler.matchAll(/data-track="([^"]*)"/g)].map(m => m[1])
  assert.equal(order.at(-1), 'central:day', 'the Day lies last on the ruler')
})

test('Central\'s mixer row says what each control means here; Arm is the shell\'s write arm; a world\'s Stop closes the pages that play', async () => {
  const armed = [], stopped = []
  const writeArm = {on: false, set: async on => { armed.push(on); return {ok: false, error: 'refused: write-arm enforcement is Factory receiving (WO-SF2)'} }}
  const set = central.projectCentralTracks({civil: {state: 'reading'}, worlds: {state: 'read', worlds}, set: daySetReading, pages,
    playing: [{pageRef: at('Control/user/flows/flow-2026-10-07-1014.html').ref, nowRef: 'now:1', project: null, sinceMs: null}],
    controls: {stop: async item => stopped.push(item.nowRef), writeArm}})
  assert.deepEqual(Object.keys(set.mixer), ['activator', 'arm', 'solo', 'input', 'output'], 'Monitor is for a world you visit; yours have none (§18.1)')
  assert.equal(set.mixer.output.route, 'Day', 'the output is the Day: a route, never a setting')
  assert.match(set.mixer.activator.meaning, /^Send to Day/)
  assert.match(set.mixer.activator.disabled, /missing op: .*sendToDay/, 'Send to Day has no owner field yet, and says which')
  assert.equal(set.mixer.input.route, 'the world\'s folder', 'the input of a world is its folder')
  assert.deepEqual(set.tracks.filter(track => !track.main).map(track => track.mix), [{arm: false}, {arm: false}], 'Arm reads the shell\'s flag on every world')
  assert.deepEqual(await answerOf(() => set.actions.stopTrack.run('central:world:central:wiki:root')), {ok: true, text: '1 page of Your world stopped.'})
  assert.deepEqual(stopped, ['now:1'])
  assert.deepEqual(await answerOf(() => set.actions.stopTrack.run('central:day')), {ok: false, text: '"central:day" is no world of today\'s set.'}, 'the Day is not a world')
  const cells = lanes.mixerCells(set, set.tracks[0], 0)
  assert.deepEqual(cells.map(cell => [cell.id, cell.state, !!cell.press]), [['activator', 'unread', false], ['solo', 'unread', false], ['arm', 'off', true], ['input', 'route', false], ['output', 'route', false]])
  assert.deepEqual(await answerOf(cells[2].press.run), {ok: false, text: 'refused: write-arm enforcement is Factory receiving (WO-SF2)'}, 'the owner\'s refusal is the receipt')
  assert.deepEqual(armed, [true])
  assert.match(set.lanes.absent.takes, /missing op: central\.document\.revisions/, 'revisions as takes: the op they lack')
  // The view: the mixer row under each world's head, its controls disabled where no owner writes them.
  const grid = session(set)
  assert.equal((grid.match(/data-mixer="central:world:/g) ?? []).length, 2, 'a mixer row under every world')
  assert.match(grid, /data-mix="activator" data-state="unread" aria-label="Activator" disabled=""/)
  assert.match(grid, /data-mix="arm" data-state="off" aria-label="Arm" aria-pressed="false" title="Arm · Lets the agent/)
})

test('the shell\'s write arm, pressed from a track, is the transport\'s registered setter: its receipt, or the refusal that none is registered', async () => {
  const none = shellWriteArm(null, () => undefined)
  assert.deepEqual(await none.set(true), {ok: false, error: 'shell.setWriteArm is not registered in this session: the transport\'s write arm registers it, so the press reached no owner.'})
  const sent = []
  const refused = shellWriteArm(false, path => value => { sent.push([path, value]); return Promise.resolve({kind: 'refused', channel: 'none', writePath: path, reason: 'no shell write flow reads it yet', missingOp: 'WO-SF2'}) })
  assert.deepEqual(await refused.set(true), {ok: false, error: 'no shell write flow reads it yet — missing op: WO-SF2'})
  const fired = shellWriteArm(false, path => () => Promise.resolve({kind: 'fired', channel: 'shell', writePath: path, note: 'armed'}))
  assert.deepEqual(await fired.set(true), {ok: true, note: 'armed'})
  assert.deepEqual(sent, [['shell.setWriteArm', true]])
})

// ── Factory: sessions, attempts, events, needles ─────────────────────────────────────────────────────────────────────────────────

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)
// FIXTURE: an agency reading through the run model's own builders (tests/factory-tracks.test.mjs), and temporal events in the
// kernel's wire shape (EventKind kebab-case: run, return, gateway-delta).
const rows = [{spaceRef: 'space:port', spaceLabel: 'Port', sessionRef: 'sess-lead', purpose: 'lead', agentRef: 'agent:fizz'}]
const events = [
  {stream: 'factory-runs', kind: 'run', subject_ref: 'agency/sess-lead/tool.done', instant_unix_ms: NOW - 600_000, summary: 'read vault/cw13/iv.md'},
  {stream: 'factory-runs', kind: 'run', subject_ref: 'agency/sess-lead/tool.done', instant_unix_ms: NOW - 300_000, summary: 'explore.localWhole'},
  {stream: 'gateway', kind: 'gateway-delta', subject_ref: 'agency/sess-lead/approval', instant_unix_ms: NOW - 120_000, summary: 'approval asked'},
  {stream: 'factory-runs', kind: 'run', subject_ref: 'agency/sess-lead/tool.done', instant_unix_ms: null, summary: 'no instant'},
  {stream: 'factory-runs', kind: 'run', subject_ref: 'agency/sess-other/tool.done', instant_unix_ms: NOW - 200_000, summary: 'another session'},
]
const axis = model.sharedAxis([], NOW)
const reading = {request: {central: {purpose: 'map field', task_ref: 'task:map'}}, state: 'done'}
const tracks = model.buildTracks(rows, new Map([['agent:fizz', {name: 'Fizz', accepted: true}]])).map(track => track.group ? track : {
  ...track, tasks: model.buildTaskClips(reading, events, track.sessionRef, NOW), needle: model.needleFor(events, track.sessionRef, axis)})

test('Factory: each session\'s events lie in lanes by the kind the temporal stream gives, at their instants; a needle at its last check-in', () => {
  const set = factory.factoryTrackAdapter.project({tracks, nowUnixMs: NOW, events})
  const session = set.tracks.find(track => track.kind === 'session')
  assert.ok(session.needle !== undefined, 'the session\'s needle stands at its last check-in')
  const eventLanes = set.lanes.events
  assert.deepEqual(eventLanes.map(lane => [lane.trackId, lane.kind, lane.events.map(event => event.label)]),
    [[session.id, 'run', ['read vault/cw13/iv.md', 'explore.localWhole']], [session.id, 'gateway-delta', ['approval asked']]],
    'one lane per kind, its own session\'s events only, an event with no instant left off the ruler')
  assert.equal(set.ruler.label(eventLanes[0].events[1].at), new Date(NOW - 300_000).toTimeString().slice(0, 8), 'each where it happened on the run\'s ruler')
  assert.match(set.lanes.absent.events, /Messages, Files, Terminal and Pages read are not kinds it names — missing op/)
  assert.match(set.lanes.absent.takes, /missing op: agency_read rows naming each session's Factory run .*factory_attempt_land/, 'attempts as takes: the ops they lack')
  assert.equal(set.clips[0].status, 'done', 'a finished task is done (dim and settled), not stopped')
  // The Lanes setting: Events are Off by default (§16.6), so the ruler draws none until they are turned on; clicked, one opens beside it.
  assert.doesNotMatch(arrangement(set), /data-event-lane=/)
  const opened = []
  const tree = ArrangementRulerView({set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: noop, onDismiss: noop,
    lanes: {shown: {takes: true, automation: true, events: true}, onShown: noop, take: null, onTake: noop, opened: null, onOpened: next => opened.push(next)}})
  const ticks = find(tree, node => node.props?.className?.startsWith?.('tl-event') && node.props['data-event'] !== undefined && node.type === 'button')
  assert.equal(ticks.length, 3)
  ticks[0].props.onClick()
  assert.deepEqual(opened, [{laneId: eventLanes[0].id, eventId: eventLanes[0].events[0].id}])
  const open = renderToStaticMarkup(React.createElement(ArrangementRulerView, {set, selection: SELECT, view: RULER_VIEW, receipt: null, onPress: noop, onDismiss: noop,
    lanes: {shown: {takes: true, automation: true, events: true}, onShown: noop, take: null, onTake: noop, opened: opened[0], onOpened: noop}}))
  assert.match(open, /<aside class="tl-event-open" role="dialog" aria-label="run: read vault\/cw13\/iv\.md"/, 'the event opens beside the ruler')
})

test('Factory\'s mixer row: Watch, Telemetry and Solo say the op they lack; Arm is the shell\'s write arm; Stop All is the harness\'s stop', async () => {
  const calls = []
  const set = factory.factoryTrackAdapter.project({tracks, nowUnixMs: NOW, controls: {control: async word => { calls.push(word); return {ok: true, note: `${word} → done`} }},
    writeArm: {on: true, set: async on => ({ok: true, note: `armed ${on}`})}})
  assert.deepEqual(Object.keys(set.mixer), ['activator', 'solo', 'arm', 'monitor', 'input', 'output'])
  assert.match(set.mixer.monitor.meaning, /^Watch: In streams the session into the widgets always/)
  assert.match(set.mixer.activator.meaning, /^Telemetry/)
  for (const id of ['activator', 'solo', 'monitor']) assert.match(set.mixer[id].disabled, /no owner operation carries it yet — missing op: /, `${id} names its missing op`)
  assert.deepEqual([set.mixer.input.route, set.mixer.output.route], ['Gateway', 'Landing'])
  assert.deepEqual(set.main, {name: 'Main', chain: ['Gateways', 'Experiment', 'Approvals', 'Ledger', 'Link']})
  const sessionTrack = set.tracks.find(track => track.kind === 'session')
  assert.deepEqual(sessionTrack.mix, {arm: true})
  assert.deepEqual(await answerOf(() => set.actions.mixer.arm.run(sessionTrack.id, false)), {ok: true, text: 'armed false'})
  const stopped = await answerOf(() => set.actions.stopAll.run())
  assert.match(stopped.text, /^Whole harness: Stop All reached the bound harness/)
  assert.deepEqual(calls, ['stop'])
  // Armed, a session's empty slots are record buttons (Live cap 35) — disabled, since no owner records into a slot.
  const grid = session(set)
  assert.match(grid, /class="sg-rec" aria-label="Record on lead \(whole harness\)" disabled=""/)
  assert.match(grid, /aria-label="Stop All" data-receipt|aria-label="Stop All" title="Stop All: every clip stops/, 'Stop All stands in the Main column')
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
