// O-I #743, round four: the owner operations Central's and Factory's dimmed acts waited for (see the first test's header).
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
const pageActs = await import('../src/central/pageActs.ts')
const acts = await import('../src/frame/menu/objectActions.ts')
const factory = await import('../src/timeline/factoryTrackAdapter.ts')
const taskActs = await import('../src/agent/factoryTaskActs.ts')

// O-I #743, round four (manual §10.9 "the acts on every object"; §18.1 Central's worlds and their pages; §19.1 Factory's sessions and
// tasks): the owner operations Central's and Factory's dimmed acts waited for, carried. SCRIPTED over fixture sets whose controls record
// each owner call, and over a kernel behind the bridge's fetch that records every op. Nothing is opened and no owner state is written.
// Not a screen pass.

// FIXTURE: Central's disclosure (central.world's shape, with a world's own name and its manifest revision: ctrl world_map.rs `world_name`,
// `manifest_revision`) and two worlds' page listings (oi.page-list/v1), as tests/mode-acts-other-modes.test.mjs builds them.
const ground = (path, ref) => ({path, user: {path: `${path}/user`, exists: true, sources: 1}, agent_governance: {path, exists: true, sources: 1},
  agent_wiki: {path, exists: true, sources: 1, wiki: {path, present: true, space_ref: ref, child_space_refs: [], dangling_child_space_refs: []}}, relations: {path, present: false, declared_overrides: 0}})
const root = {schema: 'central.world/v1', root: '/ground', ground_state: 'ready', control: ground('Control', 'central:wiki:root'),
  work: {path: 'Work', exists: true, projects: [
    {name: 'O-I', path: 'Work/O-I', source_files: 1, world_name: 'The Instrument', manifest_revision: 'm-1', projectcentral: {...ground('Work/O-I/ProjectCentral', 'central:wiki:project:O-I'), state: 'ready'}},
    {name: 'QL', path: 'Work/QL', source_files: 1, projectcentral: {...ground('Work/QL/ProjectCentral', 'central:wiki:project:QL'), state: 'ready'}}]}}
const worlds = worldsMod.worldsOf(root)
const loc = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
const listingOf = (folder, pages) => ({state: 'read', listing: {schema: 'oi.page-list/v1', path: folder, more: false, not_pages: [],
  pages: pages.map(([name, form, title]) => ({location: loc(`${folder}/${name}`), name, form, title, revision: `rev-${name}`, world: null}))}})
const pages = new Map([
  ['central:wiki:root', listingOf('Control/user/flows', [['oi203.html', 'flow', 'Multi-agent']])],
  ['central:wiki:project:O-I', listingOf('Work/O-I/ProjectCentral/user', [['things-1.html', 'thing', 'The lyre'], ['beings-1.html', 'being', 'Hildegard']])],
  ['central:wiki:project:QL', listingOf('Work/QL/ProjectCentral/user', [])],
])
const lyre = loc('Work/O-I/ProjectCentral/user/things-1.html')
const multi = loc('Control/user/flows/oi203.html')
const todaySet = {state: 'read', civilDate: '2026-10-29', set: {schema: 'oi.day-set/v1', tracks: [{world: 'central:wiki:project:O-I', name: 'O-I today'}, {world: 'central:wiki:project:QL'}],
  rows: [{id: 'r1', name: 'Morning', pages: [lyre.ref]}]}}
const oi = adapter.centralWorldTrackId('central:wiki:project:O-I')
const ql = adapter.centralWorldTrackId('central:wiki:project:QL')
const yours = adapter.centralWorldTrackId('central:wiki:root')
const menuContext = (presses = []) => ({view: 'session', binding: null, press: (key, what, run) => { presses.push([key, what]); return run() }, rename: () => {},
  writeClip: async () => ({ok: true})})

/** Central's set with controls that record each owner call and apply each change to a held copy of today's set. */
function centralSet({playing = [], controls: only} = {}) {
  let held = todaySet.set
  const calls = []
  const controls = only ?? {writeSet: async change => { held = change(held); calls.push(['set']); return {wrote: true} },
    launch: async () => ({}), stop: async item => { calls.push(['stop', item.nowRef]) }, removeWorld: async () => ({}),
    nameWorld: async (world, name) => { calls.push(['named', world.ref, world.revision ?? null, name]); return {outcome: 'named'} },
    copyPage: async (page, into) => { calls.push(['copied', page.location.path, into?.ref ?? null]); const path = `${into?.folder ?? page.location.path.replace(/\/[^/]+$/, '')}/copy-${calls.length}.html`; return {path, ref: `central:path:/ground:${path}`} },
    trashPage: async page => { calls.push(['trashed', page.location.path, page.revision]); return {schema: 'oi.page-trash/v1'} }}
  const tracks = adapter.projectCentralTracks({civil: {state: 'reading'}, worlds: {state: 'read', worlds}, set: todaySet, pages, playing, controls})
  return {tracks, calls, held: () => held}
}

test('a world is named by its own name where Central keeps one, and carries the manifest revision a rename is made on', () => {
  const [, oiWorld, qlWorld] = worlds
  assert.deepEqual([oiWorld.name, oiWorld.revision], ['The Instrument', 'm-1'])
  assert.deepEqual([qlWorld.name, qlWorld.revision], ['QL', undefined], 'a world Central keeps no name for is named by its project')
})

test('a world\'s Rename reaches the world itself: Central names it on its manifest revision, and the set\'s own name for it goes', async () => {
  const {tracks, calls, held} = centralSet()
  const a = tracks.actions
  assert.match(a.renameTrack.op, /central\.world\.name/)
  const answer = await a.renameTrack.run(oi, '  The Lyre  ')
  assert.equal(answer.ok, true)
  assert.deepEqual(calls[0], ['named', 'central:wiki:project:O-I', 'm-1', 'The Lyre'])
  assert.deepEqual(held().tracks[0], {world: 'central:wiki:project:O-I'})
  assert.match((await a.renameTrack.run(yours, 'Mine')).error, /Your world is named by your ground/)
  assert.match((await a.renameTrack.run(oi, '  ')).error, /A world's name is text/)
  assert.match((await a.renameTrack.run('central:world:gone', 'X')).error, /is no world of today's set/)
  // A world the set holds that Central no longer discloses has no world to name.
  const gone = adapter.projectCentralTracks({civil: {state: 'reading'}, worlds: {state: 'read', worlds}, pages, playing: [], controls: centralSet().tracks && {nameWorld: async () => ({})},
    set: {...todaySet, set: {...todaySet.set, tracks: [{world: 'central:wiki:project:Old', name: 'Old'}]}}})
  assert.match((await gone.actions.renameTrack.run(adapter.centralWorldTrackId('central:wiki:project:Old'), 'New')).error, /no longer discloses/)
})

test('a page\'s Duplicate makes it again in its world through the page owner, beside it in the named row it stands in', async () => {
  const {tracks, calls, held} = centralSet()
  const answer = await tracks.actions.duplicateClip.run(lyre.path)
  assert.equal(answer.ok, true)
  assert.deepEqual(calls[0], ['copied', lyre.path, null])
  assert.deepEqual(held().rows[0].pages, [lyre.ref, 'central:path:/ground:Work/O-I/ProjectCentral/user/copy-1.html'])
  // A loose page's copy is a loose page of its world: the set is not written.
  const loose = centralSet()
  assert.equal((await loose.tracks.actions.duplicateClip.run(multi.path)).ok, true)
  assert.deepEqual(loose.calls.map(call => call[0]), ['copied'])
  assert.match((await tracks.actions.duplicateClip.run('Control/user/flows/gone.html')).error, /no page of today's worlds/)
})

test('a page\'s Paste puts a copy in the world it is pasted in, tied to it; Cut then takes the page out of its own world', async () => {
  const {tracks, calls, held} = centralSet()
  const pasted = await tracks.actions.pasteClip.run(lyre.path, ql, 'central:row:r1', false)
  assert.equal(pasted.ok, true)
  assert.deepEqual(calls[0], ['copied', lyre.path, 'central:wiki:project:QL'])
  assert.ok(held().rows[0].pages.includes('central:path:/ground:Work/QL/ProjectCentral/user/copy-1.html'), 'the copy stands in the row it was pasted in')
  assert.ok(!calls.some(call => call[0] === 'trashed'), 'a copy leaves the page where it was')
  const moved = centralSet()
  const cut = await moved.tracks.actions.pasteClip.run(lyre.path, oi, 'central:slot:2', true)
  assert.equal(cut.ok, true)
  assert.deepEqual(moved.calls.map(call => call.slice(0, 3)), [['copied', lyre.path, null], ['trashed', lyre.path, 'rev-things-1.html']])
  assert.match(cut.note, /is moved into O-I today/, 'the world as today\'s track names it')
})

test('a page\'s Delete takes it out of its world into Central\'s trash on the revision listed, stopping it first, and out of today\'s rows', async () => {
  const playing = [{pageRef: lyre.ref, nowRef: 'now:lyre', project: 'O-I', sinceMs: null}]
  const {tracks, calls, held} = centralSet({playing})
  const answer = await tracks.actions.deleteClip.run(lyre.path)
  assert.equal(answer.ok, true)
  assert.deepEqual(calls.map(call => call.slice(0, 3)), [['stop', 'now:lyre'], ['trashed', lyre.path, 'rev-things-1.html'], ['set']])
  assert.deepEqual(held().rows[0].pages, [], 'the page is out of the row that held it')
  assert.match(answer.note, /Central's trash/)
  // With no Stop to press, a page that plays is refused in words, and stays.
  const {tracks: stopless, calls: none} = centralSet({playing, controls: {trashPage: async () => { none.push('trashed') }}})
  assert.match((await stopless.actions.deleteClip.run(lyre.path)).error, /plays now: stop it first/)
  assert.deepEqual(none, [])
})

test('a row\'s Duplicate copies each of its pages, and a named row is kept again beside it, holding the copies', async () => {
  const {tracks, calls, held} = centralSet()
  const answer = await tracks.actions.duplicateRow.run('central:row:r1')
  assert.equal(answer.ok, true)
  assert.deepEqual(held().rows.map(row => [row.name, row.pages.length]), [['Morning', 1], ['Morning', 1]])
  assert.notEqual(held().rows[1].id, 'r1')
  assert.deepEqual(calls.filter(call => call[0] === 'copied').length, 1)
  const loose = tracks.columns.find(column => column.id.startsWith('central:slot:'))
  const second = centralSet()
  assert.equal((await second.tracks.actions.duplicateRow.run(loose.id)).ok, true)
  assert.ok(!second.calls.some(call => call[0] === 'set'), 'a row of loose pages is copied as loose pages')
})

test('every act still dimmed in Central names what it waits for, with a carrier and without one', () => {
  const dimmed = items => items.filter(item => item.type !== 'separator' && item.disabled)
  const check = (set, label) => {
    const clip = set.clips.find(c => c.trackId === oi)
    const menus = [
      ...acts.objectMenu({kind: 'clip', id: clip.id, trackId: oi, name: clip.label}, set, {...menuContext(), view: 'arrangement', marker: null, span: null}),
      ...acts.objectMenu({kind: 'track', id: oi, name: 'O-I'}, set, menuContext()),
      ...acts.objectMenu({kind: 'slot', trackId: oi, rowId: 'central:slot:2', name: 'O-I'}, set, menuContext()),
      ...acts.objectMenu({kind: 'row', id: 'central:row:r1', name: 'Morning'}, set, menuContext()),
    ]
    for (const item of dimmed(menus)) {
      if (/^(rename|switch-off|colour|show-in-browser|split|consolidate)$/.test(item.id) && !/missing op/.test(item.why ?? '')) continue
      assert.match(item.why ?? '', /It waits for |Set the insert marker|Select a stretch|Nothing is held/, `${label}: ${item.id} — ${item.why}`)
    }
  }
  check(centralSet().tracks, 'with a carrier')
  // No carrier: the controls the shell hands are its write arm alone (useCentralTracks), and every owner's act waits for a carrier.
  const bare = adapter.projectCentralTracks({civil: {state: 'reading'}, worlds: {state: 'read', worlds}, set: todaySet, pages, playing: [], controls: {}})
  check(bare, 'without a carrier')
  assert.match(bare.actions.waiting['clip.delete'], /central\.files\.trash, which no kernel carrier hands this pane/)
  assert.match(bare.actions.waiting['track.move'], /today's set, kept in today's Day, which cannot be written now/)
})

/** A kernel behind the bridge's fetch: each op sent is kept, and answered by `answer`. */
function kernel(answer) {
  const sent = []
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    const reply = answer(body)
    return {json: async () => reply.error ? {ok: false, error: reply.error} : {ok: true, outcome: reply}}
  }
  return {fetch, sent}
}
async function withKernel(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}
const bridge = {kind: 'bridge', url: 'http://kernel.fixture'}

test('the page owner\'s duplicate and trash, and Central\'s world name, are the ops the kernel carries', async () => {
  const owner = kernel(body => {
    if (body.op === 'page' && body.request.operation === 'duplicate') return {result: 'page_reading', data: {schema: 'oi.page-copy/v1', location: loc('Work/QL/ProjectCentral/user/things-1-copy.html')}}
    if (body.op === 'page' && body.request.operation === 'trash') return {result: 'page_reading', data: {schema: 'oi.page-trash/v1', recover: {action: 'central.files.restore', expected_revision: '', revision: 'r1'}}}
    if (body.op === 'invoke_action') return {result: 'action_dispatched', dispatch: {state: 'invoked', data: {schema: 'central.world-name/v1', outcome: body.invocation.input.name === 'Stale' ? 'conflict' : 'named', name: body.invocation.input.name}}}
    if (body.op === 'world_browse') return {result: 'world_read', snapshot: {navigator: {root}}}
    return {error: `unexpected op ${body.op}`}
  })
  await withKernel(owner, async () => {
    const copy = await pageActs.duplicatePage(bridge, lyre, {folder: 'Work/QL/ProjectCentral/user', ref: 'central:wiki:project:QL'})
    assert.equal(copy.location.path, 'Work/QL/ProjectCentral/user/things-1-copy.html')
    assert.deepEqual(owner.sent[0], {op: 'page', request: {operation: 'duplicate', location: lyre, into: {folder: 'Work/QL/ProjectCentral/user', world: 'central:wiki:project:QL'}}})
    await pageActs.duplicatePage(bridge, lyre)
    assert.deepEqual(owner.sent[1], {op: 'page', request: {operation: 'duplicate', location: lyre}})
    const trashed = await pageActs.trashPage(bridge, lyre, 'rev-1')
    assert.equal(trashed.recover.action, 'central.files.restore')
    assert.deepEqual(owner.sent[2], {op: 'page', request: {operation: 'trash', location: lyre, expected_revision: 'rev-1'}})
    const named = await pageActs.nameWorld(bridge, worlds[1], 'The Lyre')
    assert.equal(named.outcome, 'named')
    assert.deepEqual(owner.sent[3], {op: 'invoke_action', project: 'O-I', invocation: {action: 'central.world.name', target_ref: 'central:action:central.world.name',
      input: {project: 'O-I', name: 'The Lyre', expected_revision: 'm-1'}}})
    assert.deepEqual(owner.sent[4], {op: 'world_browse', fresh: true}, 'the worlds are browsed afresh, so the browser reads the name')
    await assert.rejects(pageActs.nameWorld(bridge, worlds[1], 'Stale'), /moved since it was read/)
    await assert.rejects(pageActs.nameWorld(bridge, worlds[2], 'Q'), /names no manifest revision/)
    await assert.rejects(pageActs.nameWorld(bridge, worlds[0], 'Me'), /no project's world/)
  })
  assert.equal(owner.sent.filter(body => body.op === 'invoke_action').length, 2, 'a world with no revision, or yours, never reaches Central')
})

// FIXTURE: two sessions of one Project (agent/agentRunModel.ts tracks), the first holding a task, and a group (a SessionSpace).
const sessions = [
  {spaceRef: 'session-space/s', sessionRef: 'agent-session/a', agentName: 'Builder', purpose: null, group: false, project: 'O-I', tasks: []},
  {spaceRef: 'session-space/s', sessionRef: 'agent-session/b', agentName: 'Reviewer', purpose: null, group: false, project: 'O-I', tasks: []},
  {spaceRef: 'session-space/g', sessionRef: 'agent-session/g', spaceLabel: 'The lane', purpose: null, group: true, project: 'O-I', tasks: []},
]
const key = track => `${track.spaceRef}:${track.sessionRef}`
const [a, b, g] = sessions.map(key)
const factorySet = (status = 'done') => ({columns: [{id: 'batch:1', name: '1'}, {id: 'batch:2', name: '2'}],
  tracks: sessions.map(track => ({id: key(track), name: track.agentName ?? track.spaceLabel, kind: track.group ? 'group' : 'session'})),
  clips: [{id: factory.factoryTaskRef(a, 1), trackId: a, columnId: 'batch:1', label: 'Fixtures', status}], actions: {owner: 'AIKit'}})
function factoryActs(names = {}) {
  const calls = []
  const ok = what => async (...args) => { calls.push([what, ...args]); return {ok: true, note: what} }
  return {calls, acts: {remove: ok('remove'), copy: ok('copy'), blank: ok('blank'), rename: ok('rename'), detach: ok('detach'),
    nameOf: session => names[session] ?? null, projectOf: session => session === 'agent-session/elsewhere' ? 'QL' : 'O-I'}}
}

test('Factory\'s task Delete, Paste and Insert, and a session\'s Rename and Remove from the set, are AIKit\'s acts', async () => {
  const {calls, acts: port} = factoryActs({'agent-session/b': 'The reviewer'})
  const set = factory.withFactoryTaskActs(factorySet(), sessions, port)
  const x = set.actions
  assert.deepEqual(set.tracks.map(track => track.name), ['Builder', 'The reviewer', 'The lane'], 'a session wears its own name')
  assert.equal((await x.deleteClip.run(factory.factoryTaskRef(a, 1))).ok, true)
  assert.match((await x.pasteClip.run(factory.factoryTaskRef(a, 1), a, 'batch:2', false)).error, /A session holds one task: Builder holds Fixtures/)
  assert.equal((await x.pasteClip.run(factory.factoryTaskRef(a, 1), b, 'batch:1', false)).ok, true)
  assert.equal((await x.pasteClip.run(factory.factoryTaskRef(a, 1), b, 'batch:1', true)).ok, true)
  assert.match((await x.insertClip.run(a, 'batch:2')).error, /A session holds one task/)
  assert.equal((await x.insertClip.run(b, 'batch:1')).ok, true)
  assert.equal((await x.renameTrack.run(b, ' Reviews ')).ok, true)
  assert.equal((await x.removeTrack.run(b)).ok, true)
  assert.match((await x.removeTrack.run(g)).error, /a group of sessions/)
  assert.match((await x.renameTrack.run('nowhere', 'X')).error, /is not a session of this work/)
  assert.deepEqual(calls, [['remove', 'agent-session/a'], ['copy', 'agent-session/a', 'agent-session/b'], ['copy', 'agent-session/a', 'agent-session/b'],
    ['remove', 'agent-session/a'], ['blank', 'agent-session/b'], ['rename', 'agent-session/b', 'Reviews'], ['detach', 'agent-session/b']])
  // A running task is stopped before it is taken off its session.
  const running = factory.withFactoryTaskActs(factorySet('running'), sessions, factoryActs().acts)
  assert.match((await running.actions.deleteClip.run(factory.factoryTaskRef(a, 1))).error, /is running on Builder: stop it first/)
})

test('every act still dimmed in Factory names what it waits for, with AIKit\'s acts and without a carrier', async () => {
  const {MODE_WAITING} = await import('../src/frame/tracks/modeTracks.ts')
  const named = set => ({...set, actions: {...set.actions, waiting: {...MODE_WAITING.factory, ...set.actions?.waiting}}})
  for (const [label, set] of [['with AIKit\'s acts', named(factory.withFactoryTaskActs(factorySet(), sessions, factoryActs().acts))], ['without a carrier', named(factorySet())]]) {
    const menus = [
      ...acts.objectMenu({kind: 'clip', id: factory.factoryTaskRef(a, 1), trackId: a, name: 'Fixtures'}, set, {...menuContext(), view: 'arrangement', marker: null, span: null}),
      ...acts.objectMenu({kind: 'track', id: a, name: 'Builder'}, set, menuContext()),
      ...acts.objectMenu({kind: 'slot', trackId: b, rowId: 'batch:1', name: 'Reviewer'}, set, menuContext()),
      ...acts.objectMenu({kind: 'row', id: 'batch:1', name: '1'}, set, menuContext()),
    ]
    for (const item of menus.filter(item => item.type !== 'separator' && item.disabled)) {
      if (/^(rename|switch-off|colour|show-in-browser)$/.test(item.id) && !/missing op/.test(item.why ?? '')) continue
      assert.match(item.why ?? '', /It waits for |Set the insert marker|Select a stretch|Nothing is held/, `${label}: ${item.id} — ${item.why}`)
    }
  }
  assert.match(MODE_WAITING.factory['clip.duplicate'], /AIKit keeps one task per session/)
})

test('Factory\'s acts reach AIKit through the kernel: the task named on its revision read now, a blank task naming its purpose only', async () => {
  const owner = kernel(body => {
    if (body.op === 'encounter_task_read') return {result: 'encounter_task_reading', data: {schema: 'aikit.encounter-task/v1', revision: 'task-binding/7', request: {central: {task_ref: 'task:fixtures'}}}}
    if (body.op === 'encounter_task_remove') return {result: 'encounter_owner_act', data: {schema: 'aikit.encounter-task-removal/v1', agent_session: body.agent_session, outcome: 'removed'}}
    if (body.op === 'encounter_task_copy') return {result: 'encounter_owner_act', data: {schema: 'aikit.encounter-task-copy/v1', from_task_ref: 'task:fixtures', task_ref: 'task:fixtures-copy-1', settings_refused: null}}
    if (body.op === 'encounter_task_configure') return {result: 'encounter_task_reading', data: {schema: 'aikit.encounter-task/v1'}}
    if (body.op === 'encounter_session_detach') return {result: 'encounter_owner_act', data: {schema: 'oi.encounter-session-detach/v1', spaces: ['session-space/s']}}
    return {error: `unexpected op ${body.op}`}
  })
  await withKernel(owner, async () => {
    const port = taskActs.factoryTaskActs(bridge, () => 'O-I', () => null)
    assert.equal((await port.remove('agent-session/a')).ok, true)
    assert.deepEqual(owner.sent.find(body => body.op === 'encounter_task_remove'),
      {op: 'encounter_task_remove', project: 'O-I', agent_session: 'agent-session/a', task_ref: 'task:fixtures', expected_revision: 'task-binding/7'})
    const copied = await port.copy('agent-session/a', 'agent-session/b')
    assert.match(copied.note, /task:fixtures is copied onto the session as task:fixtures-copy-1/)
    assert.deepEqual(owner.sent.find(body => body.op === 'encounter_task_copy'), {op: 'encounter_task_copy', project: 'O-I', agent_session: 'agent-session/b', from_session: 'agent-session/a'})
    assert.equal((await port.blank('agent-session/b')).ok, true)
    const blank = owner.sent.find(body => body.op === 'encounter_task_configure')
    assert.equal(blank.request.purpose, 'A new task')
    assert.ok(!('source' in blank.request), 'a blank task names no constellation')
    assert.match(blank.request.task_ref, /^task:a-new-task-/)
    assert.match((await port.detach('agent-session/b')).note, /off the set \(detached from its space\)/)
  })
})
