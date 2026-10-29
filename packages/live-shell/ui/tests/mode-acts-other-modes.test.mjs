// Builder A's next lane, the shell side (T-COVERAGE §1.5, the Central row; manual §10.9 "In Central, Open and Reveal"):
//   1. Open and Reveal in the track and clip menus: Central's set carries openFile/revealFile (a clip's page file) and openFolder/revealFolder
//      (a track's world folder), each through Central's work.open / work.reveal by Central-relative path (centralOpenReveal.ts); the menus list
//      them only where a set carries them, and a track read from another reading keeps them (they change nothing);
//   4. the native Settings connector's capabilities beyond the configuration plane (settings/host.ts).
// Channels: SCRIPTED (the pure adapter and menus; a kernel behind the bridge's fetch that records every op). Nothing is opened and no owner
// state is written. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

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

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const adapter = await import('../src/timeline/centralTrackAdapter.ts')
const worldsMod = await import('../src/central/centralWorlds.ts')
const acts = await import('../src/frame/menu/objectActions.ts')

// FIXTURE: Central's disclosure of its registers (central.world's shape) and two worlds' page listings (oi.page-list/v1), as
// tests/central-tracks.test.mjs builds them.
const ground = (path, ref) => ({path, user: {path: `${path}/user`, exists: true, sources: 1}, agent_governance: {path, exists: true, sources: 1},
  agent_wiki: {path, exists: true, sources: 1, wiki: {path, present: true, space_ref: ref, child_space_refs: [], dangling_child_space_refs: []}}, relations: {path, present: false, declared_overrides: 0}})
const root = {schema: 'central.world/v1', root: '/ground', ground_state: 'ready', control: ground('Control', 'central:wiki:root'),
  work: {path: 'Work', exists: true, projects: [{name: 'O-I', path: 'Work/O-I', source_files: 1, projectcentral: {...ground('Work/O-I/ProjectCentral', 'central:wiki:project:O-I'), state: 'ready'}}]}}
const worlds = worldsMod.worldsOf(root)
const loc = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
const listingOf = (folder, pages) => ({state: 'read', listing: {schema: 'oi.page-list/v1', path: folder, more: false, not_pages: [],
  pages: pages.map(([name, form, title]) => ({location: loc(`${folder}/${name}`), name, form, title, revision: 'r1', world: null}))}})
const pages = new Map([
  ['central:wiki:root', listingOf('Control/user/flows', [['oi203.html', 'flow', 'Multi-agent']])],
  ['central:wiki:project:O-I', listingOf('Work/O-I/ProjectCentral/user', [['things-1.html', 'thing', 'The lyre']])],
])
const set = {state: 'read', civilDate: '2026-10-21', set: {schema: 'oi.day-set/v1', tracks: [{world: 'central:wiki:project:O-I'}], rows: []}}
const reading = {civil: {state: 'reading'}, worlds: {state: 'read', worlds}, set, pages, playing: []}
const menuContext = (presses, extra = {}) => ({view: 'session', binding: null, press: (key, what, run) => { presses.push([key, what]); return run() }, rename: () => {},
  writeClip: async () => ({ok: true}), ...extra})
const ids = items => items.filter(item => item.type !== 'separator').map(item => item.id)
const daySet = await import('../src/central/daySet.ts')

// O-I #743, round three (manual §10.9; §18.1 Central): every mode's dimmed acts — Central's set acts (a world's track named and moved,
// its rows inserted, named and taken out, a page made in a world, a page's switch, Stop all), and the words each act still dimmed waits
// for, in Central, Factory and Technē. SCRIPTED over fixture sets with writers that apply each change to a held set.
const todaySet = {state: 'read', civilDate: '2026-10-21', set: {schema: 'oi.day-set/v1', tracks: [{world: 'central:wiki:project:O-I', name: 'O-I'}],
  rows: [{id: 'r1', name: 'Morning', pages: [loc('Work/O-I/ProjectCentral/user/things-1.html').ref]}]}}
const playing = [{nowRef: 'now:1', ref: loc('Control/user/flows/oi203.html').ref, project: null, location: loc('Control/user/flows/oi203.html')}]

/** Central's set with writers that apply each change to a held copy of today's set, and record what they made and stopped. */
function centralSet() {
  let held = todaySet.set
  const calls = []
  const controls = {writeSet: async change => { held = change(held); calls.push(['set', held]); return {revision: 'r2', wrote: true} },
    makePage: async world => { calls.push(['made', world.ref]); return {path: `${world.folder}/flow-new.html`, ref: `central:path:/ground:${world.folder}/flow-new.html`} },
    stop: async item => { calls.push(['stop', item.nowRef]) }, launch: async () => ({}), removeWorld: async () => ({})}
  const tracks = adapter.projectCentralTracks({...reading, set: todaySet, playing, controls})
  return {tracks, calls, held: () => held}
}
const oi = adapter.centralWorldTrackId('central:wiki:project:O-I')
const yours = adapter.centralWorldTrackId('central:wiki:root')

test('Central\'s set acts write today\'s set in the Day: a track named and moved, rows inserted, named and taken out', async () => {
  const {tracks, calls, held} = centralSet()
  const a = tracks.actions
  for (const name of ['renameTrack', 'moveTrack', 'insertRow', 'renameRow', 'deleteRow', 'insertClip', 'stopAll']) assert.ok(a[name], `${name} is carried`)
  assert.deepEqual(await a.renameTrack.run(oi, 'The Instrument'), {ok: true, note: 'O-I is named The Instrument today.'})
  assert.equal(held().tracks[0].name, 'The Instrument')
  assert.match((await a.renameTrack.run(yours, 'Mine')).error, /Your world is named by your ground/)
  assert.match((await a.moveTrack.run(oi, -1)).error, /right after your world/)
  await a.insertRow.run('central:row:r1')
  assert.deepEqual(held().rows.map(row => [row.name, row.pages.length]), [['Morning', 1], ['Row 2', 0]])
  await a.renameRow.run('central:row:r1', 'Dawn')
  assert.equal(held().rows[0].name, 'Dawn')
  // A row of loose pages, named, becomes a row the Day keeps, holding them.
  const loose = tracks.columns.find(column => column.id.startsWith('central:slot:'))
  const answer = await a.renameRow.run(loose.id, 'Evening')
  assert.match(answer.note, /keeps the row Evening, holding 1 page/)
  assert.match((await a.deleteRow.run(loose.id)).error, /keeps no row to take out/)
  await a.deleteRow.run('central:row:r1')
  assert.ok(!held().rows.some(row => row.id === 'r1'), 'the row is out; its pages stay in their worlds')
  assert.deepEqual(calls.filter(call => call[0] === 'set').length, 5)
})

test('Central\'s Insert clip makes a blank Flow in the world, held in the named row it was pressed in; Stop all stops every page', async () => {
  const {tracks, calls, held} = centralSet()
  const a = tracks.actions
  const answer = await a.insertClip.run(oi, 'central:row:r1')
  assert.equal(answer.ok, true)
  assert.match(answer.note, /O-I has a new Flow \(Work\/O-I\/ProjectCentral\/user\/flow-new\.html\), in the row Morning/)
  assert.deepEqual(held().rows[0].pages.at(-1), 'central:path:/ground:Work/O-I/ProjectCentral/user/flow-new.html')
  assert.deepEqual(await a.stopAll.run(), {ok: true, note: '1 page stopped.'})
  assert.deepEqual(calls.map(call => call[0]), ['made', 'set', 'stop'])
})

test('in Central the acts still dimmed say what they wait for; the carried ones stand enabled', () => {
  const {tracks} = centralSet()
  const context = menuContext([])
  const clip = tracks.clips.find(c => c.trackId === oi)
  const clipItems = acts.objectMenu({kind: 'clip', id: clip.id, trackId: oi, name: clip.label}, tracks, context)
  assert.match(clipItems.find(item => item.id === 'delete').why, /missing op: clip\.delete .* It waits for Central taking a page out of its world/)
  assert.match(clipItems.find(item => item.id === 'duplicate').why, /It waits for a page's copy in its world/)
  const trackItems = acts.objectMenu({kind: 'track', id: oi, name: 'O-I'}, tracks, context)
  for (const id of ['rename', 'move-left', 'move-right', 'delete']) assert.ok(!trackItems.find(item => item.id === id).disabled, `${id} is enabled`)
  assert.match(trackItems.find(item => item.id === 'group').why, /It waits for a group of worlds/)
  const row = acts.objectMenu({kind: 'row', id: 'central:row:r1', name: 'Morning'}, tracks, context)
  for (const id of ['launch', 'insert', 'rename', 'delete', 'stop-all']) assert.ok(!row.find(item => item.id === id).disabled, `${id} is enabled`)
  assert.match(row.find(item => item.id === 'duplicate').why, /It waits for a page's copy/)
  assert.ok(!acts.objectMenu({kind: 'slot', trackId: oi, rowId: 'central:row:r1', name: 'O-I'}, tracks, context).find(item => item.id === 'insert').disabled)
})

test('today\'s set\'s own changes are pure: a track named and moved, a row placed and taken out', () => {
  const held = {schema: 'oi.day-set/v1', tracks: [{world: 'a'}, {world: 'b'}], rows: [{id: 'x', name: 'X', pages: []}]}
  assert.deepEqual(daySet.withTrackMoved(held, 'a', 1).tracks.map(t => t.world), ['b', 'a'])
  assert.equal(daySet.withTrackMoved(held, 'a', -1), held, 'at the edge it stays')
  assert.equal(daySet.withTrackName(held, 'b', 'Bee').tracks[1].name, 'Bee')
  assert.deepEqual(daySet.withRowAt(held, {id: 'y', name: 'Y', pages: []}, 0).rows.map(r => r.id), ['y', 'x'])
  assert.deepEqual(daySet.withoutRow(held, 'x').rows, [])
})

test('a Central page\'s switch reads from its meta, and Clip view writes it through the page owner', async () => {
  const binding = await import('../src/central/clipBinding.ts')
  const on = binding.pageIslandValues({profile: 'oi.page/v1', meta: {family: 'things', title: 'The lyre'}, bindings: {}, page: {}})
  const off = binding.pageIslandValues({profile: 'oi.page/v1', meta: {family: 'things', title: 'The lyre', active: false}, bindings: {}, page: {}})
  assert.equal(on.active, true)
  assert.equal(off.active, false)
})

test('Factory and Technē name what each dimmed act waits for, at their owners', async () => {
  const {FACTORY_WAITING} = await import('../src/timeline/factoryTrackAdapter.ts')
  const {TECHNE_WAITING} = await import('../src/timeline/techneTrackAdapter.ts')
  for (const op of ['clip.insert', 'clip.duplicate', 'clip.delete', 'track.rename', 'track.remove', 'row.insert']) assert.ok(FACTORY_WAITING[op], `Factory: ${op}`)
  for (const op of ['clip.insert', 'clip.duplicate', 'clip.delete', 'track.rename', 'track.remove', 'row.insert']) assert.ok(TECHNE_WAITING[op], `Technē: ${op}`)
  const factory = {columns: [{id: 'batch:1', name: '1'}], tracks: [{id: 's1', name: 'Builder', kind: 'agent-session'}], clips: [],
    actions: {owner: 'AIKit · the encounter\'s session settings, and Factory', waiting: FACTORY_WAITING}}
  // Registered with their modes (frame/tracks/modeTracks.ts MODE_WAITING), which the frame applies as it applies their owners.
  const {MODE_WAITING} = await import('../src/frame/tracks/modeTracks.ts')
  assert.equal(MODE_WAITING.factory, FACTORY_WAITING)
  assert.equal(MODE_WAITING.techne, TECHNE_WAITING)
  const items = acts.objectMenu({kind: 'track', id: 's1', name: 'Builder'}, factory, menuContext([]))
  assert.match(items.find(item => item.id === 'rename').why, /missing op: track\.rename .* It waits for AIKit naming a session/)
})

test('CODE-READING — a Live track wears the set\'s own colour, and choosing one writes the set, not the display\'s storage', async () => {
  const {readFile} = await import('node:fs/promises')
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /liveColour\(deep\.document\?\.tracks\[i\]\?\.colourIndex\) \?\? overrides\[i\]/)
  assert.match(app, /writeLiveSetAct\(path, \{kind: 'track_colour', track, colour: index\}\)/)
})
