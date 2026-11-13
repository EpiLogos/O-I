// Builder A's next lane, the shell side (T-COVERAGE §1.5, the Central row; manual §10.9 "In Central, Open and Reveal"):
//   1. Open and Reveal in the track and clip menus: Central's set carries openFile/revealFile (a clip's page file) and openFolder/revealFolder
//      (a track's world folder), each Central's work.open / work.reveal by Central-relative path, the kernel's Set's Actions (O-I #1004);
//      the menus list them only where a set carries them, and a track read from another reading keeps them (they change nothing);
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
const acts = await import('../src/frame/menu/objectActions.ts')

const menuContext = (presses, extra = {}) => ({view: 'session', binding: null, press: (key, what, run) => { presses.push([key, what]); return run() }, rename: () => {},
  writeClip: async () => ({ok: true}), ...extra})
const daySet = await import('../src/central/daySet.ts')

// O-I #743, round three (manual §10.9; §18.1 Central): every mode's dimmed acts, and the words each act still dimmed waits for, in Central,
// Factory and Technē.
// REPLACED (O-I #1004): Central's set acts — a world's track named and moved, its rows inserted, named and taken out, a page made in a
// world, Stop all — were the window's Central adapter's, each writing today's set or a page through ports the hook handed it. Central's
// Set is the kernel's now (kernel mode_set.rs central, built from the World Model's worlds, day and workcells slices): each act it carries
// is one Action, run through the kernel's `act`; what no single Action carries yet waits in its words (O-I #1005). SCRIPTED over the
// kernel's Set in its shape (tests/support/modeSetFixture.mjs), with a runner that records each Action it is handed.
const fixture = await import('./support/modeSetFixture.mjs')
const {kernelSetTracks} = await import('../src/frame/tracks/kernelSet.ts')
const DAY_SET = 'today\'s set, kept in today\'s Day document (`meta.set`) and written on the Day\'s revision (central.document.mutate), which the Set does not compose into one Action yet (O-I #1005)'
const CENTRAL_WAITING = {
  'track.move': DAY_SET, 'track.remove': DAY_SET, 'row.insert': DAY_SET, 'row.rename': DAY_SET, 'row.delete': DAY_SET,
  'clip.insert': 'a blank page made in the world through Central\'s creation door (projectcentral.source.create, or central.files.write in your world) and tied to it, which no single Action carries yet (O-I #1005)',
  'set.stop-all': 'the page owner\'s stop (each playing page\'s NOW clearing closed, central.now.lifecycle), and the clearings that play are no slice of the World Model yet (O-I #1005)',
  'clip.info': 'a page\'s info text: the page owner keeps no note on the page as a whole apart from its notes',
  'tracks.group': 'a group of worlds: today\'s set keeps worlds side by side, none under another',
}
const oi = adapter.centralWorldTrackId('central:wiki:project:O-I')
const yours = adapter.centralWorldTrackId('central:wiki:root')
const NAME_WORDS = 'Central\'s central.world.name: the world\'s own name, written against the manifest revision Central disclosed'
/** Central's Set as the kernel answers it: your world and O-I's as tracks (O-I's named by its Action), today's row, a page on it. */
function centralSet() {
  const ran = []
  const runner = {act: async (action, input, project) => { ran.push({action, input, project}); return {outcome: 'named'} }, shell: async () => ({ok: false, error: 'no shell'})}
  const set = fixture.modeSetOf({owner: 'Central', ruler: {kind: 'day', unit: 'minutes', date: '2026-10-21'},
    rows: [{id: 'central:row:r1', name: 'Morning'}, {id: 'central:slot:1', name: '1'}],
    tracks: [
      fixture.setTrack(yours, 'Your world', {kind: 'world'}),
      fixture.setTrack(oi, 'O-I', {kind: 'world', acts: {renameTrack: {action: 'central.world.name', input: {project: 'O-I', expected_revision: 'manifest:7'},
        takes: 'name', project: 'O-I', words: NAME_WORDS, done: 'O-I\'s world has its new name.'}}}),
    ],
    clips: [fixture.setClip('central:path:/ground:Work/O-I/ProjectCentral/user/things-1.html', oi, 'central:row:r1', 'The lyre')],
    waiting: CENTRAL_WAITING})
  return {tracks: kernelSetTracks(set, {nowMs: Date.UTC(2026, 9, 21, 9), runner}), ran}
}

test('Central\'s Rename is its Action through the kernel\'s act: the world\'s own name, on the revision Central disclosed', async () => {
  const {tracks, ran} = centralSet()
  const a = tracks.actions
  assert.equal(a.renameTrack.op, NAME_WORDS)
  assert.deepEqual(await a.renameTrack.run(oi, ' The Instrument '), {ok: true, note: 'O-I\'s world has its new name.'})
  assert.deepEqual(ran, [{action: 'central.world.name', input: {project: 'O-I', expected_revision: 'manifest:7', name: 'The Instrument'}, project: 'O-I'}],
    'one Action, its input the Set\'s with the name the person gave')
  assert.match((await a.renameTrack.run(yours, 'Mine')).error, /Your world takes no name here: central\.world\.name names a project's world/)
  assert.deepEqual((await a.renameTrack.run(oi, '  ')), {ok: false, error: 'A name is text.'})
  assert.equal(ran.length, 1, 'nothing else reached an owner')
  for (const name of ['moveTrack', 'insertRow', 'renameRow', 'deleteRow', 'insertClip', 'stopAll']) assert.equal(a[name], undefined, `${name} is no Action the Set carries yet`)
})

test('in Central the acts still dimmed say what they wait for, in the Set\'s words; the carried ones stand enabled', () => {
  const {tracks} = centralSet()
  const context = menuContext([])
  const clip = tracks.clips.find(c => c.trackId === oi)
  const clipItems = acts.objectMenu({kind: 'clip', id: clip.id, trackId: oi, name: clip.label}, tracks, context)
  assert.match(clipItems.find(item => item.id === 'info').why, /missing op: clip\.info \(Central\)\. It waits for a page's info text/)
  const trackItems = acts.objectMenu({kind: 'track', id: oi, name: 'O-I'}, tracks, context)
  assert.ok(!trackItems.find(item => item.id === 'rename').disabled, 'rename is enabled')
  for (const id of ['move-left', 'move-right']) assert.match(trackItems.find(item => item.id === id).why, /missing op: track\.move \(Central\)\. It waits for today's set, kept in today's Day document/, id)
  assert.match(trackItems.find(item => item.id === 'group').why, /It waits for a group of worlds/)
  const row = acts.objectMenu({kind: 'row', id: 'central:row:r1', name: 'Morning'}, tracks, context)
  for (const [id, op] of [['insert', 'row.insert'], ['rename', 'row.rename'], ['delete', 'row.delete']]) {
    assert.match(row.find(item => item.id === id).why, new RegExp(`missing op: ${op.replace('.', '\\.')} \\(Central\\)\\. It waits for today's set`), id)
  }
  assert.match(row.find(item => item.id === 'stop-all').why, /It waits for the page owner's stop/)
  assert.match(acts.objectMenu({kind: 'slot', trackId: oi, rowId: 'central:row:r1', name: 'O-I'}, tracks, context).find(item => item.id === 'insert').why,
    /missing op: clip\.insert \(Central\)\. It waits for a blank page made in the world/)
})

test('today\'s set\'s own changes are pure: a track named and moved, a row placed and taken out', () => {
  const held = {schema: 'oi.day-set/v1', tracks: [{world: 'a'}, {world: 'b'}], rows: [{id: 'x', name: 'X', pages: []}]}
  assert.deepEqual(daySet.withTrackMoved(held, 'a', 1).tracks.map(t => t.world), ['b', 'a'])
  assert.equal(daySet.withTrackMoved(held, 'a', -1), held, 'at the edge it stays')
  assert.equal(daySet.withTrackName(held, 'b', 'Bee').tracks[1].name, 'Bee')
  assert.deepEqual(daySet.withoutTrackName(daySet.withTrackName(held, 'b', 'Bee'), 'b').tracks[1], {world: 'b'})
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
  const {TECHNE_WAITING} = await import('../src/timeline/techneTrackAdapter.ts')
  for (const op of ['clip.insert', 'clip.duplicate', 'clip.delete', 'track.rename', 'track.remove', 'row.insert']) assert.ok(TECHNE_WAITING[op], `Technē: ${op}`)
  // Registered with its mode (frame/tracks/modeTracks.ts MODE_WAITING), which the frame applies as it applies its owner.
  // REPLACED (O-I #1004): Factory's were registered there too (FACTORY_WAITING); Factory's Set is the kernel's now, and its waiting words
  // come with it (kernel mode_set.rs factory_waiting), as Central's do.
  const {MODE_WAITING} = await import('../src/frame/tracks/modeTracks.ts')
  assert.equal(MODE_WAITING.techne, TECHNE_WAITING)
  assert.equal(MODE_WAITING.factory, undefined)
  const SESSION_ACT = 'an act on the session\'s own settings or task at AIKit (the encounter\'s ops), which no Action of the registry carries yet (O-I #1006)'
  const factory = kernelSetTracks(fixture.modeSetOf({owner: 'Factory', rows: [{id: 'batch:1', name: '1'}], tracks: [fixture.setTrack('space:a:s1', 'Builder', {kind: 'session'})],
    waiting: Object.fromEntries(['clip.insert', 'clip.delete', 'track.rename', 'track.remove'].map(op => [op, SESSION_ACT]))}), {nowMs: Date.now()})
  const items = acts.objectMenu({kind: 'track', id: 'space:a:s1', name: 'Builder'}, factory, menuContext([]))
  assert.match(items.find(item => item.id === 'rename').why, /missing op: track\.rename \(Factory\)\. It waits for an act on the session's own settings or task at AIKit/)
})

test('CODE-READING — a Live track wears the set\'s own colour, and choosing one writes the set, not the display\'s storage', async () => {
  const {readFile} = await import('node:fs/promises')
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /liveColour\(deep\.document\?\.tracks\[i\]\?\.colourIndex\) \?\? overrides\[i\]/)
  assert.match(app, /writeLiveSetAct\(path, \{kind: 'track_colour', track, colour: index\}\)/)
})
