// Central's tracks, re-cut by T-WORLDS W2 (manual §18.1 "Central: the Day, its worlds and their pages"): today is the set, its
// tracks are the worlds brought into today (your world first, then the Day's set), their clips are the worlds' pages, the rows are
// the set's named rows then one row per slot, a page plays in its NOW clearing, and the Day is the Main track holding the day's
// entries on today's ruler. Over recorded readings and fixtures, headless.
//
// Channels (each claim below is carried by exactly one):
// - REAL CAPTURE (text redacted): tests/fixtures/central-vertical/*.capture.json — the shape of read-only `ctrl` answers on
//   14 Oct 2026 (central.now.list, central.files.list of the wiki returns, central.time.policy). The temporal events are
//   built from them by the kernel's own mapping rules, exactly as tests/central-vertical.test.mjs does. The kernel's temporal
//   read itself is not invoked here.
// - RECORDED LISTING: the names in Control/agents/now/day on this machine, 14 Oct 2026 (`ls`), as the owner's directory
//   reading would list them.
// - FIXTURE: the machine-NOW and kernel-log events (no capture of those streams), the explicit instants of the placement
//   test, and the stubbed bridge answers of the read leg. Each is labelled where it is used.
// - SCRIPTED: the shared views (SessionGrid, ArrangementRuler) rendered to static markup; the hook rendered once on the server.
// No computer-use pass, no browser: the on-screen legs are not covered here.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

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
const adapter = await import('../src/timeline/centralTrackAdapter.ts')
const dayTrack = await import('../src/timeline/dayTrackAdapter.ts')
const {walkReaches} = await import('../src/timeline/worldTrackAdapter.ts')
const {SessionGrid} = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler, placeClips} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {useCentralTracks, readDayRecords, setReadingOf, playingOf} = await import('../src/frame/tracks/useCentralTracks.ts')
const daySet = await import('../src/central/daySet.ts')
const worldsMod = await import('../src/central/centralWorlds.ts')
const {civilReadingOf} = await import('../src/timeline/centralTrackAdapter.ts')
const {browserCategoriesOf} = await import('../src/shell/modeGrammar.ts')

const FIXTURES = new URL('./fixtures/central-vertical/', import.meta.url)
const capture = async name => JSON.parse(await readFile(new URL(name, FIXTURES), 'utf8'))

// REAL CAPTURE: the civil-time policy, and the central.now.list rows → temporal_sources.rs now_record_to_event.
const policy = (await capture('time-policy.capture.json')).data.policy
const londonDate = unixMs => new Intl.DateTimeFormat('en-CA', {timeZone: policy.timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(unixMs))
const nowRows = (await capture('now-list.capture.json')).data.records
const nowEvents = nowRows.map(record => {
  const instant = record.created_at_unix_seconds * 1000
  return {stream: 'central-now', kind: 'now', subject_ref: record.now_ref, instant_unix_ms: instant, summary: record.purpose,
    day_ref: `central:day:${policy.scope_ref}:${londonDate(instant)}`, evidence_refs: [record.source_ref].filter(Boolean)}
})
// The newest day the capture names stands for today.
const today = nowEvents.map(event => new Date(event.instant_unix_ms).toISOString().slice(0, 10)).sort().pop()

// FIXTURE: Central's disclosure of its registers (central.world's shape, 18 Oct: the root's wiki and each project's ProjectCentral).
const ground = (path, ref, user = true) => ({path, user: {path: `${path}/user`, exists: user, sources: 1}, agent_governance: {path, exists: true, sources: 1},
  agent_wiki: {path, exists: true, sources: 1, wiki: {path, present: true, space_ref: ref, child_space_refs: [], dangling_child_space_refs: []}}, relations: {path, present: false, declared_overrides: 0}})
const root = {schema: 'central.world/v1', root: '/ground', ground_state: 'ready', control: ground('Control', 'central:wiki:root'),
  work: {path: 'Work', exists: true, projects: [
    {name: 'O-I', path: 'Work/O-I', source_files: 1, projectcentral: {...ground('Work/O-I/ProjectCentral', 'central:wiki:project:O-I'), state: 'ready'}},
    {name: 'face-rig', path: 'Work/face-rig', source_files: 1, projectcentral: {...ground('Work/face-rig/ProjectCentral', 'central:wiki:project:face-rig', false), state: 'ready'}},
  ]}}
const worlds = worldsMod.worldsOf(root)
const loc = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
const listingOf = (folder, pages) => ({state: 'read', listing: {schema: 'oi.page-list/v1', path: folder, more: false, not_pages: [{name: 'notes.html', why: 'it carries no ql-doc island'}],
  pages: pages.map(([name, form, title]) => ({location: loc(`${folder}/${name}`), name, form, title, revision: 'r1', world: null}))}})
const pages = new Map([
  ['central:wiki:root', listingOf('Control/user/flows', [['flow-2026-10-07-1343.html', 'flow', 'Closing the day'], ['beings-2026-10-08-0900.html', 'being', 'Hildegard'], ['oi203.html', 'flow', 'Multi-agent']])],
  ['central:wiki:project:O-I', listingOf('Work/O-I/ProjectCentral/user', [['things-2026-10-09-1000.html', 'thing', 'The lyre']])],
])
const set = {state: 'read', civilDate: today, set: {schema: 'oi.day-set/v1', tracks: [{world: 'central:wiki:project:O-I'}, {world: 'central:wiki:project:gone', name: 'A world gone'}],
  rows: [{id: 'morning', name: 'Morning', pages: [loc('Control/user/flows/oi203.html').ref, loc('Work/O-I/ProjectCentral/user/things-2026-10-09-1000.html').ref]}]}}
const reading = {civil: {state: 'live', events: nowEvents, absences: []}, worlds: {state: 'read', worlds}, set, pages, playing: []}
const tracks = adapter.projectCentralTracks(reading)
const DAY = adapter.CENTRAL_DAY_TRACK_ID

// RECORDED LISTING: Control/agents/now/day on this machine, 14 Oct 2026 (`.sources` are snapshots, not day records).
const listing = {entries: ['2026-09-06.md', '2026-09-06.sources', '2026-09-07.md', '2026-09-07.sources', '2026-09-12.md', '2026-09-12.sources'].map(name => ({
  name, kind: name.endsWith('.md') ? 'file' : 'directory', byte_len: 4096, retrieval_allowed: true,
  location: {schema: 'central.path-ref/v1', ref: `central:path:/sample/ground:Control/agents/now/day/${name}`, root: '/sample/ground', path: `Control/agents/now/day/${name}`}}))}
const records = adapter.dayRecordsOf(listing)

test('the worlds are disclosed by Central: yours first, then each project with a human ground and a wiki, by its wiki space ref', () => {
  assert.deepEqual(worlds.map(world => [world.ref, world.name, world.folder]), [['central:wiki:root', 'Your world', 'Control/user/flows'],
    ['central:wiki:project:O-I', 'O-I', 'Work/O-I/ProjectCentral/user']], 'a project with no human ground is no world yet')
})

test('the tracks are today\'s worlds — yours first, then the set\'s in order — and the Day is the Main track, last; a world gone is named, not dropped', () => {
  assert.deepEqual(tracks.tracks.map(track => [track.id, track.name, track.main ?? false]), [
    ['central:world:central:wiki:root', 'Your world', false], ['central:world:central:wiki:project:O-I', 'O-I', false],
    ['central:world:central:wiki:project:gone', 'A world gone', false], [DAY, 'Day', true]])
  assert.match(tracks.tracks[2].kind, /no longer discloses/)
  assert.match(tracks.tracks[0].kind, /your world · its folder Control\/user\/flows · 3 pages · 1 file in it no page/)
  assert.match(tracks.tracks[3].kind, new RegExp(`today, ${today}: 3 worlds, 1 named row`))
  const bare = adapter.projectCentralTracks({civil: {state: 'reading'}})
  assert.deepEqual(bare.tracks.map(track => track.name), ['Your world', 'Day'], 'with nothing read, your world and the Day still stand')
})

test('a world\'s clips are its pages, each by its title; the rows are the set\'s named rows, then one row per slot; the Day holds no clip in Session view', () => {
  assert.deepEqual(tracks.columns.map(column => [column.id, column.name]), [['central:row:morning', 'Morning'], ['central:slot:1', '2'], ['central:slot:2', '3']])
  const placed = tracks.clips.filter(clip => clip.trackId !== DAY).map(clip => [clip.columnId, clip.label, clip.id])
  assert.deepEqual(placed, [
    ['central:row:morning', 'Multi-agent', 'Control/user/flows/oi203.html'], ['central:row:morning', 'The lyre', 'Work/O-I/ProjectCentral/user/things-2026-10-09-1000.html'],
    ['central:slot:1', 'Closing the day', 'Control/user/flows/flow-2026-10-07-1343.html'], ['central:slot:2', 'Hildegard', 'Control/user/flows/beings-2026-10-08-0900.html']],
    'a named row holds its pages; the rest stand one per slot, in the order made')
  assert.ok(tracks.clips.filter(clip => clip.trackId === DAY).every(clip => clip.columnId === ''), 'the Day\'s entries stand on no row')
  assert.deepEqual(adapter.centralSubjectOfClip('Work/O-I/ProjectCentral/user/things-2026-10-09-1000.html'), {kind: 'note', path: 'Work/O-I/ProjectCentral/user/things-2026-10-09-1000.html'})
  assert.deepEqual(adapter.centralSubjectOfClip('Control/user/flows/oi203.html'), {kind: 'note', path: 'Control/user/flows/oi203.html'}, 'a clip selects as the browser\'s rows do')
  assert.equal(adapter.centralSubjectOfClip('central:world:central:wiki:root'), null)
})

test('the Day track lays today\'s entries at their instant on today\'s ruler, and no other day\'s', () => {
  const entries = tracks.clips.filter(clip => clip.trackId === DAY)
  const todays = nowEvents.filter(event => new Date(event.instant_unix_ms).toISOString().slice(0, 10) === today)
  assert.equal(entries.length, todays.length)
  assert.ok(entries.every(clip => clip.at.start >= 0 && clip.at.start < 1440))
  assert.equal(tracks.ruler.unit, `minutes (UTC) of ${today}`)
  assert.equal(tracks.ruler.label(61), `${today.slice(5)} 01:01`)
  assert.equal(tracks.main.name, `Day · ${today}`)
})

test('a page plays in its NOW clearing: its clip runs and lies on the ruler from when it opened; Stop closes only that world\'s playing pages', async () => {
  const since = Date.parse(`${today}T09:30:00Z`)
  const playing = playingOf([{project: null, listing: {schema: 'central.now-listing/v1', automatic_agent_or_model_invocation: false, records: [
    {now_ref: 'now:1', task_ref: `oi:page:${loc('Control/user/flows/oi203.html').ref}`, lifecycle: 'active', created_at_unix_seconds: since / 1000},
    {now_ref: 'now:2', task_ref: `oi:page:${loc('Control/user/flows/flow-2026-10-07-1343.html').ref}`, lifecycle: 'closed', created_at_unix_seconds: since / 1000},
    {now_ref: 'now:3', task_ref: 'central:task:control:root:other', lifecycle: 'active', created_at_unix_seconds: since / 1000}]}}])
  assert.deepEqual(playing.map(item => item.nowRef), ['now:1'], 'an active clearing whose task is a page\'s, and nothing else')
  const calls = []
  const controls = {launch: async page => calls.push(['launch', page.path]), stop: async item => calls.push(['stop', item.nowRef]), addWorld: async world => calls.push(['add', world.ref])}
  const live = adapter.projectCentralTracks({...reading, playing, controls})
  const clip = live.clips.find(item => item.id === 'Control/user/flows/oi203.html')
  assert.equal(clip.status, 'running'); assert.equal(clip.at.start, 570, 'it lies on the ruler from 09:30')
  assert.match(live.tracks[0].kind, /1 page plays now/)
  assert.deepEqual(await live.actions.stopTrack.run('central:world:central:wiki:project:O-I'), {ok: true, note: 'No page of O-I plays.'})
  await live.actions.stopTrack.run('central:world:central:wiki:root')
  await live.actions.launch.run('Control/user/flows/flow-2026-10-07-1343.html')
  assert.deepEqual(await live.actions.launch.run('Control/elsewhere.html'), {ok: false, error: '"Control/elsewhere.html" is no page of today\'s worlds.'})
  await live.actions.launchStop.run('central:row:morning')
  assert.deepEqual(calls, [['stop', 'now:1'], ['launch', 'Control/user/flows/flow-2026-10-07-1343.html'], ['launch', 'Control/user/flows/oi203.html'],
    ['launch', 'Work/O-I/ProjectCentral/user/things-2026-10-09-1000.html']], 'a row launcher launches every page in its row')
  assert.equal(live.actions.seat.accepts, adapter.CENTRAL_WORLD_DRAG)
  assert.match((await live.actions.seat.run('central:wiki:project:O-I')).note, /already in today's set/)
  assert.deepEqual(await live.actions.seat.run('central:wiki:project:nowhere'), {ok: false, error: '"central:wiki:project:nowhere" is no world Central discloses.'})
  const fewer = adapter.projectCentralTracks({...reading, set: {...set, set: {...set.set, tracks: []}}, controls})
  await fewer.actions.seat.run('central:wiki:project:O-I')
  assert.deepEqual(calls.at(-1), ['add', 'central:wiki:project:O-I'], 'a world dropped on the empty track is written into today\'s set')
})

test('the Day keeps its set in its meta: read by its schema, a world added once, a row named; a Day with none keeps an empty set', () => {
  assert.deepEqual(daySet.daySetOf({meta: {}}), daySet.EMPTY_SET)
  assert.deepEqual(daySet.daySetOf({meta: {set: {schema: 'other'}}}), daySet.EMPTY_SET)
  const held = daySet.daySetOf({meta: {set: {schema: 'oi.day-set/v1', tracks: [{world: 'w1'}, {name: 'no world'}], rows: [{id: 'r', name: 'R', pages: ['p', 3]}, {id: 'x'}]}}})
  assert.deepEqual(held, {schema: 'oi.day-set/v1', tracks: [{world: 'w1'}], rows: [{id: 'r', name: 'R', pages: ['p']}]})
  assert.equal(daySet.withWorld(held, 'w1'), held, 'a world already there stays where it is')
  assert.deepEqual(daySet.withWorld(held, 'w2', 'Two').tracks, [{world: 'w1'}, {world: 'w2', name: 'Two'}])
  assert.deepEqual(daySet.withoutWorld(held, 'w1').tracks, [])
  assert.deepEqual(daySet.withRow(held, {id: 'r', name: 'Renamed', pages: []}).rows, [{id: 'r', name: 'Renamed', pages: []}])
})

test('today\'s set reads from the ground\'s Day: a Day with no document says to open today; a refusal is said in the owner\'s words', () => {
  assert.deepEqual(setReadingOf(null, null), {state: 'reading'})
  assert.deepEqual(setReadingOf(null, 'carrier down'), {state: 'none', reason: 'carrier down'})
  const time = {state: 'ready', data: {civil_date: '2026-10-18'}}
  const uninitialised = setReadingOf({time, day: {state: 'ready', data: {day_ref: 'central:day:control:root:2026-10-18', temporal: {civil_date: '2026-10-18'}, document_state: 'absent'}}}, null)
  assert.equal(uninitialised.state, 'none'); assert.match(uninitialised.reason, /open today/)
  const stale = setReadingOf({time, day: {state: 'stale', error: {message: 'the Day is stale'}}}, null)
  assert.deepEqual(stale, {state: 'none', reason: 'the Day is stale'})
})

test('the hook returns your world and the Day whatever has been read, and names what has not', () => {
  const live = {status: 'live', error: null, events: nowEvents, absences: [], readAtUnixMs: 1}
  const Probe = ({transport, world}) => {
    const tracks = useCentralTracks({transport, set: null, document: null, world})
    return React.createElement('pre', null, JSON.stringify({tracks: tracks.tracks.map(track => track.name), kind: tracks.tracks.find(track => track.main).kind}))
  }
  const rendered = JSON.parse(/<pre>(.*)<\/pre>/.exec(renderToStaticMarkup(React.createElement(Probe, {transport: {kind: 'unavailable', reason: 'carrier down'}, world: {source: live}})))[1].replaceAll('&quot;', '"'))
  assert.deepEqual(rendered.tracks, ['Your world', 'Day'])
  assert.match(rendered.kind, /today keeps no set yet \(the kernel carrier is unavailable: carrier down\)/)
})

test('the civil reading is the published one: live, being read, or unread with the owner\'s words', () => {
  assert.deepEqual(civilReadingOf({status: 'live', events: [1], absences: [2]}), {state: 'live', events: [1], absences: [2]})
  assert.deepEqual(civilReadingOf({status: 'reading', error: null}), {state: 'reading'})
  assert.deepEqual(civilReadingOf({status: 'unavailable', error: 'Temporal events reading unavailable'}), {state: 'unavailable', reason: 'Temporal events reading unavailable'})
  assert.equal(civilReadingOf({status: 'unavailable', error: null}).reason, 'the kernel temporal read is unavailable')
  assert.equal(civilReadingOf(undefined).state, 'unavailable')
})

test('the day records are read through the owner\'s listing route, and a refusal is the reading', async () => {
  assert.deepEqual(await readDayRecords(undefined), {state: 'unavailable', reason: 'the shell published no kernel carrier to this pane'})
  assert.deepEqual(await readDayRecords({kind: 'unavailable', reason: 'no kernel transport'}), {state: 'unavailable', reason: 'no kernel transport'})
  const realFetch = globalThis.fetch
  const sent = []
  try {
    // FIXTURE: the bridge's answers. The recorded listing above stands in for the owner's directory reading.
    globalThis.fetch = async (url, init) => { sent.push([url, JSON.parse(init.body)]); return {json: async () => ({ok: true, outcome: {result: 'directory_read', directory: {...listing, schema: 'central.directory-reading/v1'}}})} }
    const read = await readDayRecords({kind: 'bridge', url: 'http://bridge.fixture'})
    assert.deepEqual(sent, [['http://bridge.fixture/op', {op: 'files_list', path: 'Control/user/day'}]], 'one files_list at the owner\'s day surface — the browser\'s own route')
    assert.equal(read.state, 'read')
    assert.deepEqual(read.records.map(record => record.name), records.map(record => record.name))
    globalThis.fetch = async () => ({json: async () => ({ok: false, error: 'the owner refused the listing'})})
    assert.deepEqual(await readDayRecords({kind: 'bridge', url: 'http://bridge.fixture'}), {state: 'unavailable', reason: 'the owner refused the listing'})
    globalThis.fetch = async () => ({json: async () => ({ok: true, outcome: {result: 'something_else'}})})
    assert.equal((await readDayRecords({kind: 'bridge', url: 'http://bridge.fixture'})).state, 'unavailable', 'an answer that is not a directory reading is not a list of days')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('the owner\'s day surface (one folder per date holding day.md) reads as day records beside the legacy files', async () => {
  const surface = await import('../src/central/daySurface.ts')
  const location = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
  const folder = date => ({name: date, kind: 'directory', byte_len: 96, retrieval_allowed: true, location: location(`Control/user/day/${date}`)})
  const made = adapter.dayRecordsOf({entries: [folder('2026-10-12'), folder('2026-10-13'), {name: 'notes.md', kind: 'file', byte_len: 3, location: location('Control/user/day/notes.md')}, {name: 'scratch', kind: 'directory', byte_len: 1, location: location('Control/user/day/scratch')}]})
  assert.deepEqual(made.map(record => [record.name, record.path]), [['2026-10-13.md', 'Control/user/day/2026-10-13/day.md'], ['2026-10-12.md', 'Control/user/day/2026-10-12/day.md']], 'date folders only, newest first, each its day.md')
  const [entry] = surface.dayEntriesOf([folder('2026-10-13')])
  assert.deepEqual([entry.kind, entry.location.ref], ['file', 'central:path:/ground:Control/user/day/2026-10-13/day.md'], 'the day document\'s own location, in the owner\'s ref grammar')
  assert.equal(surface.dateOfDayPath('Control/user/day/2026-10-13/day.md'), '2026-10-13')
  assert.equal(surface.dateOfDayPath('Control/agents/now/day/2026-09-12.md'), '2026-09-12', 'legacy records still name their date')
  assert.equal(surface.dateOfDayPath('Control/user/day/2026-10-13/notes.md'), null)
  assert.deepEqual(adapter.centralSubjectOfClip('Control/user/day/2026-10-13/day.md'), {kind: 'day', path: 'Control/user/day/2026-10-13/day.md'})
})

test('a day subject is named by its date — every day on the surface is a day.md (seen on screen 15 Oct)', async () => {
  const surface = await import('../src/central/daySurface.ts')
  assert.equal(surface.subjectWords('Control/user/day/2026-10-13/day.md'), 'Tue 13 Oct')
  assert.equal(surface.subjectWords('Control/agents/now/day/2026-09-12.md'), 'Sat 12 Sep')
  assert.equal(surface.subjectWords('Control/user/flows/flow-1.html'), 'flow-1.html', 'anything else by its file name')
})

