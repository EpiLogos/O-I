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

test('Central\'s set carries Open and Reveal: a clip\'s page file and a track\'s world folder, by the Central-relative path Central resolves', async () => {
  const asked = []
  const tracks = adapter.projectCentralTracks({...reading, controls: {openOrReveal: async (act, path) => { asked.push([act, path]); return {item: {path}} }}})
  const a = tracks.actions
  for (const key of ['openFile', 'revealFile', 'openFolder', 'revealFolder']) assert.match(a[key].op, /Central's work\.(open|reveal)/)
  assert.deepEqual(await a.openFile.run('Control/user/flows/oi203.html'), {ok: true, note: 'Multi-agent is open in the application your computer opens it with.'})
  assert.deepEqual(await a.revealFile.run('Work/O-I/ProjectCentral/user/things-1.html'), {ok: true, note: 'The lyre is shown in Finder.'})
  assert.deepEqual(await a.openFolder.run('central:world:central:wiki:root'), {ok: true, note: 'Your world\'s folder is open in the application your computer opens it with.'})
  assert.deepEqual(await a.revealFolder.run('central:world:central:wiki:project:O-I'), {ok: true, note: 'O-I\'s folder is shown in Finder.'})
  assert.deepEqual(asked, [['open', 'Control/user/flows/oi203.html'], ['reveal', 'Work/O-I/ProjectCentral/user/things-1.html'],
    ['open', 'Control/user/flows'], ['reveal', 'Work/O-I/ProjectCentral/user']])
  assert.equal((await a.openFile.run('Control/user/flows/gone.html')).ok, false, 'no page of today\'s worlds: refused before Central is asked')
  assert.equal((await a.revealFolder.run('central:world:nowhere')).ok, false)
  assert.equal(asked.length, 4)
  const plain = adapter.projectCentralTracks({...reading, controls: {addWorld: async () => {}}})
  for (const key of ['openFile', 'revealFile', 'openFolder', 'revealFolder']) assert.equal(plain.actions[key], undefined, 'no hand, no act')
})

test('the clip and track menus list Open and Reveal only where the set carries them, after the arrangement\'s acts and Retry, and keep them on a read track', async () => {
  const presses = []
  const run = []
  const carried = {owner: 'Central', openFile: {op: 'work.open', run: id => run.push(['openFile', id])}, revealFile: {op: 'work.reveal', run: id => run.push(['revealFile', id])},
    openFolder: {op: 'work.open', run: id => run.push(['openFolder', id])}, revealFolder: {op: 'work.reveal', run: id => run.push(['revealFolder', id])}}
  const theSet = actions => ({columns: [{id: 'r1', name: '1'}], tracks: [{id: 't1', name: 'Bollingen', kind: 'world'}, {id: 'ro', name: 'firings', kind: 'spine', readOnly: true}],
    clips: [{id: 'c1', trackId: 't1', columnId: 'r1', label: 'The stone'}, {id: 'c2', trackId: 'ro', columnId: 'r1', label: 'a firing'}], actions})
  const clip = acts.objectMenu({kind: 'clip', id: 'c1', trackId: 't1', name: 'The stone'}, theSet(carried), menuContext(presses, {view: 'arrangement'}))
  const order = ids(clip)
  assert.ok(order.indexOf('open') > order.indexOf('crop') && order.indexOf('reveal') === order.indexOf('open') + 1 && order.indexOf('colour') > order.indexOf('reveal'),
    'In Central, Open and Reveal the page\'s file, after the arrangement\'s acts and before the colour (§10.9)')
  clip.find(item => item.id === 'open').onSelect()
  clip.find(item => item.id === 'reveal').onSelect()
  const track = acts.objectMenu({kind: 'track', id: 't1', name: 'Bollingen'}, theSet(carried), menuContext(presses))
  assert.ok(ids(track).indexOf('open') > ids(track).indexOf('move-right') && ids(track).indexOf('colour') > ids(track).indexOf('reveal'), 'the world\'s folder, before the colour')
  track.find(item => item.id === 'open').onSelect()
  track.find(item => item.id === 'reveal').onSelect()
  assert.deepEqual(run, [['openFile', 'c1'], ['revealFile', 'c1'], ['openFolder', 't1'], ['revealFolder', 't1']])
  assert.deepEqual(presses, [['open:c1', 'Open The stone'], ['reveal:c1', 'Reveal The stone'], ['open:t1', 'Open Bollingen\'s folder'], ['reveal:t1', 'Reveal Bollingen\'s folder']])
  // A track read from another reading: every act that changes it is disabled, but Open and Reveal change nothing and stay.
  const read = acts.objectMenu({kind: 'track', id: 'ro', name: 'firings'}, theSet(carried), menuContext(presses))
  assert.ok(!read.find(item => item.id === 'open').disabled && !read.find(item => item.id === 'reveal').disabled)
  assert.ok(read.find(item => item.id === 'rename').disabled, 'rename still says the track is read')
  const readClip = acts.objectMenu({kind: 'clip', id: 'c2', trackId: 'ro', name: 'a firing'}, theSet(carried), menuContext(presses))
  assert.ok(!readClip.find(item => item.id === 'open').disabled)
  // Another mode's set carries none: no Open, no Reveal, and no dimmed stand-ins.
  const other = acts.objectMenu({kind: 'clip', id: 'c1', trackId: 't1', name: 'The stone'}, theSet({owner: 'Factory'}), menuContext(presses))
  assert.ok(!ids(other).includes('open') && !ids(other).includes('reveal'))
  assert.ok(!ids(acts.objectMenu({kind: 'track', id: 't1', name: 'Bollingen'}, theSet({owner: 'Factory'}), menuContext(presses))).includes('reveal'))
})

test('the Session grid\'s set reaches work.open and work.reveal through a light module, the old name kept', async () => {
  const {readFile} = await import('node:fs/promises')
  const hook = await readFile(new URL('../src/frame/tracks/useCentralTracks.ts', import.meta.url), 'utf8')
  assert.match(hook, /openOrReveal: \(act: 'open' \| 'reveal', path: string\) => openOrRevealInCentral\(transport, act, path\)/)
  assert.match(hook, /from '\.\.\/\.\.\/central\/devices\/centralOpenReveal'/)
  const light = await readFile(new URL('../src/central/devices/centralOpenReveal.ts', import.meta.url), 'utf8')
  assert.deepEqual([...light.matchAll(/^import .* from '([^']+)'/gm)].map(match => match[1]),
    ['../../../../../../desktop/cradle/src/kernel/types', '../../../../../../desktop/cradle/src/kernel/bridge', './centralActions'])
  const writes = await import('../src/central/devices/centralDeviceWrites.ts')
  const open = await import('../src/central/devices/centralOpenReveal.ts')
  assert.equal(writes.openOrRevealInCentral, open.openOrRevealInCentral)
})

// ── 4. The native Settings connector beyond the configuration plane ─────────────────────────────────────────────────────────────────

/** A kernel behind the bridge's fetch (FIXTURE): each op answered by `answers[op]` (a function of the body), every op recorded. */
function kernel(answers) {
  const sent = []
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    const given = answers[body.op]
    if (!given) return {json: async () => ({ok: false, error: `the fixture kernel answers no ${body.op}`})}
    const answer = given(body)
    return {json: async () => (answer.error ? {ok: false, error: answer.error} : {ok: true, outcome: answer})}
  }
  return {sent, fetch}
}
async function withKernel(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}
const transport = {kind: 'bridge', url: 'http://kernel.test'}
const context = (extra = {}) => ({ownerEpoch: 'epoch-1', isCurrent: () => true, scopeChoices: [
  {address: {scope_kind: 'world', scope_ref: null}, title: 'Current World'},
  {address: {scope_kind: 'workcell', scope_ref: 'workcell:mac'}, title: 'workcell:mac'}], ...extra})
// REAL CAPTURE (read only, 21 Oct): `workcell machine list --json`, `workcell connections list --json`, `workcell connections show omarchy --json`.
const WORKCELL = JSON.parse(readFileSync(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/workcell-connections-2026-10-21.json', import.meta.url), 'utf8'))
const route = (route, data) => ({result: 'owner_route_reading', route, data})

test('the native connector offers the pages beyond the configuration plane over the ops their owners already answer, and the Machines page over Workcell\'s own records', async () => {
  const {connectNativeSettings} = await import('../src/native/configuration.ts')
  const owner = kernel({
    system_composition_read: () => ({result: 'system_composition_reading', reading: {schema: 'oi.system-composition/v1', contract_revision: 'c1', observed_at_unix_ms: 1, census: {schema: 's', positions: []}, owners: [], obligations: []}}),
    profile_list: () => ({result: 'profile_listing', active_profile_ref: null, profiles: []}),
    routine: body => ({result: 'routine_reading', data: {asked: body.request.action}}),
    workcell_read: body => body.request.kind === 'machine-list' ? route('workcell machine list', WORKCELL.machines)
      : body.request.kind === 'connections-list' ? route('workcell connections list', WORKCELL.list)
      // FIXTURE: the second connection's show, from the captured one with its own label (only omarchy's show was captured).
      : route('workcell connections show', body.request.label === 'omarchy' ? WORKCELL.show : {ok: true, connection: {...WORKCELL.show.connection, label: body.request.label, connection_ref: `connection:${body.request.label}`, expires_at_unix_ms: 1791419267453}}),
    workcell_write: body => body.request.kind === 'machine-remove' ? {error: 'workcell machine remove: no machine is declared as `ghost` (exit 5)'}
      : route(`workcell ${body.request.kind}`, body.request.kind === 'connect' ? {connection: {label: body.request.connection}} : {label: body.request.label}),
  })
  await withKernel(owner, async () => {
    const adapter = await connectNativeSettings(transport, context())
    for (const key of ['invoke', 'profiles', 'readProducts', 'harnesses', 'remoteMachines', 'importTheme']) assert.ok(adapter[key], `${key} is offered`)
    assert.equal(adapter.visualPreferences, undefined, 'no store handed in, no visual preferences')
    assert.equal(adapter.routineAuthoring, undefined, 'routine authoring waits on ops the kernel does not carry (create, enable, options)')
    assert.equal(adapter.canEnterCredentialMaterial, undefined, 'no credential capability reading qualifies material entry')
    const invoked = await adapter.invoke({op: 'routine', request: {action: 'list'}})
    assert.deepEqual([invoked.outcome.result, invoked.outcome.data, invoked.error], ['routine_reading', {asked: 'list'}, null], 'the pages\' own ops go through the epoch-checked call')
    assert.equal((await adapter.readProducts()).schema, 'oi.system-composition/v1')
    assert.deepEqual(await adapter.profiles.listProfiles(), {active_profile_ref: null, profiles: []})
    const machines = adapter.remoteMachines
    assert.deepEqual(machines.scope, {scope_kind: 'workcell', scope_ref: 'workcell:mac'})
    assert.deepEqual(machines.allowedOperations, [], 'no Workcell read discloses its control operations: none is copied here')
    assert.deepEqual((await machines.readMachines()).map(m => [m.label, m.endpoint, m.credential_ref, m.operations]), [
      ['omarchy', '100.92.62.101:7777', 'keychain://workcell-connection/omarchy', ['status', 'discover', 'observe', 'inspect']],
      ['omarchy-improvement-lanes', '100.92.62.101:7777', 'keychain://workcell-connection/omarchy-improvement-lanes', []]])
    const connections = await machines.readConnections()
    assert.deepEqual(connections.map(c => [c.label, c.state, c.connection_ref, c.granted_operations.length]), [['omarchy', 'connected', 'connection:omarchy', 4], ['omarchy-improvement-lanes', 'connected', 'connection:omarchy-improvement-lanes', 4]])
    assert.match(connections[0].detail, /software revisions differ/)
    assert.deepEqual(await machines.add({label: 'lab', endpoint: 'lab.local:7777', credential_ref: null, operations: [], note: 'bench'}), {status: 'acknowledged', message: 'lab is declared.'})
    assert.deepEqual(await machines.connect('lab'), {status: 'acknowledged', message: 'lab is connected.'})
    assert.deepEqual(await machines.disconnect('lab'), {status: 'acknowledged', message: 'lab is disconnected; its record is kept.'})
    assert.deepEqual(await machines.remove('ghost'), {status: 'refused', message: 'workcell machine remove: no machine is declared as `ghost` (exit 5)'}, 'Workcell\'s words')
  })
  const writes = owner.sent.filter(body => body.op === 'workcell_write').map(body => body.request)
  assert.deepEqual(writes, [{kind: 'machine-add', label: 'lab', endpoint: 'lab.local:7777', credential_ref: null, allow: [], note: 'bench'},
    {kind: 'connect', connection: 'lab'}, {kind: 'disconnect', label: 'lab'}, {kind: 'machine-remove', label: 'ghost'}])
  // A retired owner epoch answers nothing: every page's call refuses before the kernel is asked.
  let live = true
  await withKernel(owner, async () => {
    const adapter = await connectNativeSettings(transport, context({isCurrent: () => live}))
    live = false
    await assert.rejects(adapter.invoke({op: 'routine', request: {action: 'list'}}), /retired/)
    await assert.rejects(adapter.remoteMachines.readMachines(), /retired/)
  })
  // Without a Workcell among the scopes, there is no Machines source.
  await withKernel(owner, async () => {
    const bare = await connectNativeSettings(transport, context({scopeChoices: [{address: {scope_kind: 'world', scope_ref: null}, title: 'Current World'}],
      visuals: {get: () => ({enabled: true, welcomeEnabled: true}), subscribe: () => () => {}, setEnabled: () => {}, setWelcomeEnabled: () => {}}}))
    assert.equal(bare.remoteMachines, undefined)
    assert.deepEqual(bare.visualPreferences.getSnapshot(), {enabled: true, welcomeEnabled: true}, 'the store the caller holds')
  })
})

test('the visual preferences are the renderer\'s own store, one snapshot while it stands; a theme file is converted by the cradle and kept by the appearance owner', async () => {
  const {nativeVisualPreferences, nativeImportTheme} = await import('../src/native/configuration.ts')
  let snapshot = {enabled: true, welcomeEnabled: false, other: 1}
  const listeners = new Set()
  const store = {get: () => snapshot, subscribe: l => { listeners.add(l); l(snapshot); return () => listeners.delete(l) },
    setEnabled: v => { snapshot = {...snapshot, enabled: v}; listeners.forEach(l => l(snapshot)) }, setWelcomeEnabled: v => { snapshot = {...snapshot, welcomeEnabled: v}; listeners.forEach(l => l(snapshot)) }}
  const prefs = nativeVisualPreferences(store)
  const {readFile} = await import('node:fs/promises')
  const foundation = await readFile(new URL('../src/native/Foundation.tsx', import.meta.url), 'utf8')
  assert.match(foundation, /connectNativeSettings\(access, \{ownerEpoch, isCurrent, visuals,/, 'the native Foundation hands in the renderer\'s store')
  const first = prefs.getSnapshot()
  assert.deepEqual(first, {enabled: true, welcomeEnabled: false})
  assert.equal(prefs.getSnapshot(), first, 'the same object while the switches stand')
  let heard = 0
  const stop = prefs.subscribe(() => heard++)
  prefs.setWelcomeEnabled(true)
  assert.deepEqual(prefs.getSnapshot(), {enabled: true, welcomeEnabled: true})
  assert.notEqual(prefs.getSnapshot(), first)
  stop()
  assert.ok(heard >= 2)
  const kept = []
  const call = async op => {
    if (op.op === 'presentation_read') return {outcome: {result: 'presentation_reading', document: {revision: 1, custom_themes: []}}}
    if (op.op === 'theme_import') { kept.push(op.theme); return {outcome: {result: 'presentation_reading', document: {revision: 2, custom_themes: [op.theme]}}} }
    return {outcome: null, error: 'unexpected'}
  }
  const theme = JSON.stringify({name: 'Night Desk', type: 'dark', colors: {'editor.background': '#101418', 'editor.foreground': '#e8e6e3', 'focusBorder': '#ffbe00',
    'button.background': '#ffbe00', 'sideBar.background': '#14191e', 'statusBar.background': '#0c0f12', 'terminal.ansiRed': '#e5484d', 'terminal.ansiGreen': '#46a758',
    'terminal.ansiBlue': '#3e63dd', 'terminal.ansiYellow': '#f5d90a'}})
  const document = await nativeImportTheme(call, theme, 'night-desk.json')
  assert.equal(document.revision, 2)
  assert.equal(kept.length, 1)
  assert.equal(kept[0].name, 'Night Desk')
  await assert.rejects(nativeImportTheme(call, '', 'empty.json'), /empty\.json is empty/, 'the cradle\'s converter refuses in its words before the owner is asked')
  assert.equal(kept.length, 1)
})
