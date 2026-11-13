// Central's names the window keeps beside the kernel's Set (O-I #1004). Central's Set itself — today's worlds as tracks (your world first,
// then the Day's set), their pages as clips, the set's rows, the Day as the Main track — is the kernel's, built from the World Model's
// worlds, day and workcells slices (kernel mode_set.rs, whose own tests lay it out) and drawn through frame/tracks/kernelSet.ts
// (tests/kernel-mode-sets.test.mjs). What is proved here is what the window's other readers still share with it: the worlds Central
// discloses, a clip's ground subject, the pages that play, today's set as the Day keeps it, and the day surface's names.
//
// Channels (each claim below is carried by exactly one):
// - FIXTURE: Central's disclosure of its registers (central.world's shape, 18 Oct), the NOW listing rows of the playing test, and the
//   ground readings of the set's reading. Each is labelled where it is used.
// No computer-use pass, no browser: the on-screen legs are not covered here.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {worldsOfRoot} from './support/worldModelFixture.mjs'

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
const adapter = await import('../src/timeline/centralTrackAdapter.ts')
const daySet = await import('../src/central/daySet.ts')
const {setReadingOf} = daySet
const {playingOf} = adapter

// FIXTURE: Central's disclosure of its registers (central.world's shape, 18 Oct: the root's wiki and each project's ProjectCentral).
const ground = (path, ref, user = true) => ({path, user: {path: `${path}/user`, exists: user, sources: 1}, agent_governance: {path, exists: true, sources: 1},
  agent_wiki: {path, exists: true, sources: 1, wiki: {path, present: true, space_ref: ref, child_space_refs: [], dangling_child_space_refs: []}}, relations: {path, present: false, declared_overrides: 0}})
const root = {schema: 'central.world/v1', root: '/ground', ground_state: 'ready', control: ground('Control', 'central:wiki:root'),
  work: {path: 'Work', exists: true, projects: [
    {name: 'O-I', path: 'Work/O-I', source_files: 1, projectcentral: {...ground('Work/O-I/ProjectCentral', 'central:wiki:project:O-I'), state: 'ready'}},
    {name: 'face-rig', path: 'Work/face-rig', source_files: 1, projectcentral: {...ground('Work/face-rig/ProjectCentral', 'central:wiki:project:face-rig', false), state: 'ready'}},
  ]}}
const worlds = worldsOfRoot(root)
const loc = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
const today = '2026-10-14'

test('the worlds are disclosed by Central: yours first, then each project with a human ground and a wiki, by its wiki space ref', () => {
  assert.deepEqual(worlds.map(world => [world.ref, world.name, world.folder]), [['central:wiki:root', 'Your world', 'Control/user/flows'],
    ['central:wiki:project:O-I', 'O-I', 'Work/O-I/ProjectCentral/user']], 'a project with no human ground is no world yet')
})

test('a page\'s clip id is its Central-relative path, and selects as the browser\'s rows do; a track id is no ground subject', () => {
  assert.deepEqual(adapter.centralSubjectOfClip('Work/O-I/ProjectCentral/user/things-2026-10-09-1000.html'), {kind: 'note', path: 'Work/O-I/ProjectCentral/user/things-2026-10-09-1000.html'})
  assert.deepEqual(adapter.centralSubjectOfClip('Control/user/flows/oi203.html'), {kind: 'note', path: 'Control/user/flows/oi203.html'}, 'a clip selects as the browser\'s rows do')
  assert.equal(adapter.centralSubjectOfClip('central:world:central:wiki:root'), null)
  assert.equal(adapter.centralWorldTrackId('central:wiki:root'), 'central:world:central:wiki:root', 'a world\'s track, as the kernel\'s Set names it')
  assert.equal(adapter.CENTRAL_DAY_TRACK_ID, 'central:day')
})

test('a page plays in its NOW clearing: an active clearing whose task is a page\'s, and nothing else', () => {
  const since = Date.parse(`${today}T09:30:00Z`)
  // FIXTURE: a NOW listing (central.now-listing/v1) with a page's active clearing, a page's closed one and another task's.
  const playing = playingOf([{project: null, listing: {schema: 'central.now-listing/v1', automatic_agent_or_model_invocation: false, records: [
    {now_ref: 'now:1', task_ref: `oi:page:${loc('Control/user/flows/oi203.html').ref}`, lifecycle: 'active', created_at_unix_seconds: since / 1000},
    {now_ref: 'now:2', task_ref: `oi:page:${loc('Control/user/flows/flow-2026-10-07-1343.html').ref}`, lifecycle: 'closed', created_at_unix_seconds: since / 1000},
    {now_ref: 'now:3', task_ref: 'central:task:control:root:other', lifecycle: 'active', created_at_unix_seconds: since / 1000}]}}])
  assert.deepEqual(playing, [{pageRef: loc('Control/user/flows/oi203.html').ref, nowRef: 'now:1', project: null, sinceMs: since}])
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
  // Past the boundary (walk 13 Nov): today not opened yet, with the way on, never Central's stale-pointer words.
  assert.deepEqual(stale, {state: 'none', reason: 'Today has not opened yet. Open today opens it.'})
})

test('the owner\'s day surface (one folder per date holding day.md) names each day by its date, and a day\'s path opens as a day', async () => {
  const surface = await import('../src/central/daySurface.ts')
  const location = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
  const folder = date => ({name: date, kind: 'directory', byte_len: 96, retrieval_allowed: true, location: location(`Control/user/day/${date}`)})
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

test('a world leaves today\'s set as it came in: in then out leaves the set as it was', () => {
  const set = {schema: 'oi.day-set/v1', tracks: [{world: 'a'}, {world: 'b'}], rows: []}
  assert.deepEqual(daySet.withoutWorld(daySet.withWorld(set, 'c'), 'c'), set)
})

test('the bodies the system reads are one value until the system changes: a snapshot read twice is the same (r16: the grid drew nothing)', async () => {
  const store = await import('../src/projections/atlas/system/systemStore.ts')
  assert.equal(store.systemBodies(), store.systemBodies(), 'unread, the bodies are one empty list, not a new one per read')
})
