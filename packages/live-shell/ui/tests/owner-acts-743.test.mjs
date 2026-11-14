// O-I #743, round four: the owner operations Central's and Factory's dimmed acts waited for (see the first test's header).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'
import {worldsOfRoot} from './support/worldModelFixture.mjs'

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
const factory = await import('../src/timeline/factoryTrackAdapter.ts')

// O-I #743, round four (manual §10.9 "the acts on every object"; §18.1 Central's worlds and their pages; §19.1 Factory's sessions and
// tasks): the owner operations Central's and Factory's dimmed acts waited for, carried. SCRIPTED over fixture sets whose controls record
// each owner call, and over a kernel behind the bridge's fetch that records every op. Nothing is opened and no owner state is written.
// Not a screen pass.

// FIXTURE: Central's disclosure (central.world's shape, with a world's own name and its manifest revision: ctrl world_map.rs `world_name`,
// `manifest_revision`), as the World Model's worlds slice holds it (tests/support/worldModelFixture.mjs).
const ground = (path, ref) => ({path, user: {path: `${path}/user`, exists: true, sources: 1}, agent_governance: {path, exists: true, sources: 1},
  agent_wiki: {path, exists: true, sources: 1, wiki: {path, present: true, space_ref: ref, child_space_refs: [], dangling_child_space_refs: []}}, relations: {path, present: false, declared_overrides: 0}})
const root = {schema: 'central.world/v1', root: '/ground', ground_state: 'ready', control: ground('Control', 'central:wiki:root'),
  work: {path: 'Work', exists: true, projects: [
    {name: 'O-I', path: 'Work/O-I', source_files: 1, world_name: 'The Instrument', manifest_revision: 'm-1', projectcentral: {...ground('Work/O-I/ProjectCentral', 'central:wiki:project:O-I'), state: 'ready'}},
    {name: 'QL', path: 'Work/QL', source_files: 1, projectcentral: {...ground('Work/QL/ProjectCentral', 'central:wiki:project:QL'), state: 'ready'}}]}}
const worlds = worldsOfRoot(root)
const loc = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
const lyre = loc('Work/O-I/ProjectCentral/user/things-1.html')
const oi = adapter.centralWorldTrackId('central:wiki:project:O-I')
const menuContext = (presses = []) => ({view: 'session', binding: null, press: (key, what, run) => { presses.push([key, what]); return run() }, rename: () => {},
  writeClip: async () => ({ok: true})})

test('a world is named by its own name where Central keeps one, and carries the manifest revision a rename is made on', () => {
  const [, oiWorld, qlWorld] = worlds
  assert.deepEqual([oiWorld.name, oiWorld.revision], ['The Instrument', 'm-1'])
  assert.deepEqual([qlWorld.name, qlWorld.revision], ['QL', undefined], 'a world Central keeps no name for is named by its project')
})

// REPLACED (O-I #1004): "a world's Rename reaches the world itself", "a page's Duplicate makes it again in its world", "a page's Paste puts a
// copy in the world it is pasted in", "a page's Delete takes it out of its world into Central's trash", "a row's Duplicate copies each of its
// pages" and "every act still dimmed in Central names what it waits for, with a carrier and without one": each through the window's Central
// adapter and the ports its hook handed it. Central's Set is the kernel's now (kernel mode_set.rs central): a world's Rename is its Action,
// central.world.name, run through the kernel's `act` (tests/mode-acts-other-modes.test.mjs); a page's Duplicate, Paste and Delete and a
// row's Duplicate are the page owner's ops that no single Action carries yet, so the Set says what each waits for (O-I #1005). With no
// carrier the Set itself waits, in the shell's words, and no act stands.

// CODE-READING: the ops each mode's Set says it waits for, by their keys (kernel mode_set.rs central_waiting, factory_waiting); the words
// are the kernel's, held by its own tests.
const kernelSource = readFileSync(new URL('../../../../desktop/cradle/kernel/src/mode_set.rs', import.meta.url), 'utf8')
function waitingOf(fn) {
  const body = kernelSource.slice(kernelSource.indexOf(`fn ${fn}() -> BTreeMap<String, String> {`))
  const keys = [...body.slice(0, body.indexOf('\n}\n')).matchAll(/\("([a-z-]+\.[a-z-]+)",/g)].map(match => match[1])
  assert.ok(keys.length > 10, `${fn} lists the ops its Set waits for`)
  return Object.fromEntries(keys.map(key => [key, `the kernel's words for ${key}`]))
}
const fixture = await import('./support/modeSetFixture.mjs')
const {kernelSetTracks} = await import('../src/frame/tracks/kernelSet.ts')
// Both Sets carry the shell's one write arm (mode_set.rs ARM_WORDS).
const ARM = {arm: {action: 'shell.setWriteArm', takes: 'on', words: 'shell.setWriteArm — the shell\'s one write arm (agent/shellSetterBridge.ts): its receipt names the owner that enforces it'}}
const dimmedWait = (label, items) => {
  for (const item of items.filter(item => item.type !== 'separator' && item.disabled)) {
    if (/^(rename|switch-off|colour|show-in-browser|split|consolidate)$/.test(item.id) && !/missing op/.test(item.why ?? '')) continue
    assert.match(item.why ?? '', /It waits for |Set the insert marker|Select a stretch|Nothing is held/, `${label}: ${item.id} — ${item.why}`)
  }
}

test('every act still dimmed in Central names what it waits for, in the kernel\'s Set', () => {
  const act = (action, query) => ({action, input: {query}, words: `Central's ${action}`})
  const set = kernelSetTracks(fixture.modeSetOf({owner: 'Central', ruler: {kind: 'day', unit: 'minutes', date: '2026-10-29'},
    rows: [{id: 'central:row:r1', name: 'Morning'}, {id: 'central:slot:2', name: '2'}],
    tracks: [fixture.setTrack(oi, 'The Instrument', {kind: 'world', acts: {openFolder: act('work.open', 'Work/O-I/ProjectCentral/user'), revealFolder: act('work.reveal', 'Work/O-I/ProjectCentral/user'),
      renameTrack: {action: 'central.world.name', input: {project: 'O-I', expected_revision: 'm-1'}, takes: 'name', project: 'O-I', words: 'Central\'s central.world.name'}}})],
    clips: [fixture.setClip(lyre.path, oi, 'central:row:r1', 'The lyre', {acts: {openFile: act('work.open', lyre.path), revealFile: act('work.reveal', lyre.path)}})],
    acts: ARM, waiting: waitingOf('central_waiting')}), {nowMs: Date.UTC(2026, 9, 29, 9)})
  dimmedWait('Central', [
    ...acts.objectMenu({kind: 'clip', id: lyre.path, trackId: oi, name: 'The lyre'}, set, {...menuContext(), view: 'arrangement', marker: null, span: null}),
    ...acts.objectMenu({kind: 'track', id: oi, name: 'The Instrument'}, set, menuContext()),
    ...acts.objectMenu({kind: 'slot', trackId: oi, rowId: 'central:slot:2', name: 'The Instrument'}, set, menuContext()),
    ...acts.objectMenu({kind: 'row', id: 'central:row:r1', name: 'Morning'}, set, menuContext()),
  ])
  for (const [id, op] of [['duplicate', 'clip.duplicate'], ['delete', 'clip.delete']]) {
    assert.match(acts.objectMenu({kind: 'clip', id: lyre.path, trackId: oi, name: 'The lyre'}, set, menuContext()).find(item => item.id === id).why, new RegExp(`missing op: ${op.replace('.', '\\.')} \\(Central\\)\\. It waits for`), id)
  }
})

// FIXTURE: two sessions of one Project (agent/agentRunModel.ts tracks), the first holding a task, and a group (a SessionSpace).
const sessions = [
  {spaceRef: 'session-space/s', sessionRef: 'agent-session/a', agentName: 'Builder', purpose: null, group: false, project: 'O-I', tasks: []},
  {spaceRef: 'session-space/s', sessionRef: 'agent-session/b', agentName: 'Reviewer', purpose: null, group: false, project: 'O-I', tasks: []},
  {spaceRef: 'session-space/g', sessionRef: 'agent-session/g', spaceLabel: 'The lane', purpose: null, group: true, project: 'O-I', tasks: []},
]
const key = track => `${track.spaceRef}:${track.sessionRef}`
const [a, b] = sessions.map(key)

// REPLACED (O-I #1004): "with AIKit's acts and without a carrier", over the window's Factory set and its registered waiting words
// (MODE_WAITING.factory). Factory's Set is the kernel's now, and so are the words each act it does not carry waits in.
test('every act still dimmed in Factory names what it waits for, in the kernel\'s Set', () => {
  const waiting = waitingOf('factory_waiting')
  const set = kernelSetTracks(fixture.modeSetOf({owner: 'Factory', ruler: {kind: 'clock', unit: 'seconds', origin_unix_ms: Date.UTC(2026, 9, 29, 9)},
    rows: [{id: 'batch:1', name: '1'}, {id: 'batch:2', name: '2'}],
    tracks: sessions.map(track => fixture.setTrack(key(track), track.agentName ?? track.spaceLabel, {kind: track.group ? 'group' : 'session'})),
    clips: [fixture.setClip(factory.factoryTaskRef(a, 1), a, 'batch:1', 'Fixtures', {status: 'done'})], acts: ARM, waiting}), {nowMs: Date.UTC(2026, 9, 29, 10)})
  dimmedWait('Factory', [
    ...acts.objectMenu({kind: 'clip', id: factory.factoryTaskRef(a, 1), trackId: a, name: 'Fixtures'}, set, {...menuContext(), view: 'arrangement', marker: null, span: null}),
    ...acts.objectMenu({kind: 'track', id: a, name: 'Builder'}, set, menuContext()),
    ...acts.objectMenu({kind: 'slot', trackId: b, rowId: 'batch:1', name: 'Reviewer'}, set, menuContext()),
    ...acts.objectMenu({kind: 'row', id: 'batch:1', name: '1'}, set, menuContext()),
  ])
  assert.match(kernelSource, /\("clip\.duplicate", "a second task on one session: AIKit keeps one task per session/)
})
