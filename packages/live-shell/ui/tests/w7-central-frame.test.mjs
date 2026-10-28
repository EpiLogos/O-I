// W7, Central and the frame: the design packages that landed for them, each bound to its owners or absent naming the op it waits for.
//   1. the world's track head opens the track's Workspace device in a pane (§18.1), its Name, Folder and Ground the selected world's;
//   2. the Day's close-out verify (design package D5, §18.2);
//   3. widgets:notifications (design package D10, §23.9): a monitor, its rail tile and its Full;
//   4. settings:window (design package D9) is parked on dlw/settings-window-port until its design has a place for every behaviour
//      the window has today (T-COVERAGE §2.1);
//   5. the Session grid and the Arrangement ruler against their designs (T-COVERAGE §1.4).
// Channels: SCRIPTED (the views and the catalogue designs rendered to static markup through the runtime's host; the pure bindings; a
// recording hand for every press). No owner state is written. Not a screen pass: the on-screen legs are the lead's.
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
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const host = await import('../src/frame/devices/deviceHost.tsx')
const heads = await import('../src/frame/tracks/trackHeads.ts')
const grid = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const pages = await import('../src/central/devices/pageBindings.ts')
// The Workspace's design (central__workspace.tsx) was retired in the 22 Oct manual rewrite (#725): a world's settings stand on its track's head
// and its account is Docs (§18.1, §18.5); the Workspace's binding stays (pageBindings.ts workspaceBinding) and is checked on its own values.

const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const viewsOf = design => design.views ?? ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => viewsOf(designed).filter(view => view !== 'popout').map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
/** Draw a design on a binding in all its views: no NaN, no undefined, its own view, never its fixture text; each reason drawn. */
function drawsOn(design, binding, fixture, reasons = []) {
  const drawn = hosted(design, binding)
  for (const [view, markup] of drawn) {
    assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
    assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
  }
  const all = drawn.map(([, markup]) => markup).join('\n')
  for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refusal is drawn as why (${why.slice(0, 80)}…)`)
  return all
}
const noop = () => {}

// ── 1. the world's head opens the track's Workspace device ──────────────────────────────────────────────────────────────────────────

const WORLD_TRACK = 'central:world:central:wiki:project:O-I'
const SET = {columns: [{id: 'r1', name: '1'}], clips: [], tracks: [{id: WORLD_TRACK, name: 'O-I', kind: 'world'}, {id: 'factory:session:x', name: 'Other', kind: 'session'}]}

test('a mode names the device its tracks\' heads open; the Session grid and the Arrangement ruler draw one head button for it, and a track no mode names draws none', () => {
  const opened = []
  // REPLACED (#725): the head named the Workspace — retired; a world's head opens its Docs (useCentralTracks.ts, §18.1, §18.5).
  heads.nameTrackHeadDevices('central', new Map([[WORLD_TRACK, {title: 'Docs', does: 'Open O-I\'s Docs full in a pane', open: () => opened.push('central:docs')}]]))
  try {
    const selected = []
    const selection = {select: target => selected.push(target)}
    const session = renderToStaticMarkup(createElement(grid.SessionGridView, {set: SET, selection, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))
    assert.match(session, new RegExp(`data-track-device="${WORLD_TRACK}"`))
    assert.match(session, /aria-label="Open O-I&#x27;s Docs in a pane"/)
    assert.doesNotMatch(session, /data-track-device="factory:session:x"/, 'a track no mode names: no button')
    const view = {window: null, onWindow: noop, snap: 'free', onSnap: noop, marker: null, onMarker: noop, width: 0}
    const ruler = renderToStaticMarkup(createElement(ArrangementRulerView, {set: SET, selection, view, receipt: null, onPress: noop, onDismiss: noop}))
    assert.match(ruler, new RegExp(`data-track-device="${WORLD_TRACK}"`), 'the Arrangement\'s head too')
    // The press selects the track first (so Docs reads that world), then opens the device.
    const button = grid.TrackDeviceButton({device: heads.trackHeadDevice(WORLD_TRACK), track: SET.tracks[0], selection})
    let stopped = false
    button.props.onClick({stopPropagation: () => { stopped = true }})
    assert.deepEqual(selected, [{kind: 'track', ref: WORLD_TRACK, title: 'O-I'}])
    assert.deepEqual(opened, ['central:docs'])
    assert.ok(stopped, 'the press is the button\'s, not the head\'s')
  } finally { heads.nameTrackHeadDevices('central', null) }
  assert.equal(heads.trackHeadDevice(WORLD_TRACK), undefined, 'taken back: no button')
})

test('the Workspace\'s binding on a world reads the world\'s name and folder, offers the worlds\' projects as Folder choices, and refuses a rename naming the op', async () => {
  pages.resetHolds()
  const book = {id: 'w1', name: 'Morning', project: 'Archetypal-Earth', layout: {root: null, mode: 'base'}}
  const world = {name: 'O-I', project: 'O-I'}
  const folders = ['Archetypal-Earth', 'O-I', 'face-rig']
  const binding = pages.workspaceBinding(pages.WORKSPACE_DEVICE_ID, book, Date.now(), {switchMode: noop, rename: noop}, {project: 'O-I'}, world, folders)
  assert.deepEqual([binding.values.name, binding.values.folder, JSON.parse(binding.values.folders)], ['O-I', 'O-I', folders])
  assert.equal(binding.values.mode, 'base', 'the Track page still draws the window\'s workspace book: the design\'s mismatch, kept in PROPOSE')
  assert.equal(binding.standing.name.disabled, pages.WORLD_NAME_REFUSED)
  await assert.rejects(binding.write([{key: 'name', value: 'X'}]), /missing op: a world rename in Central/)
  const yours = pages.workspaceBinding(pages.WORKSPACE_DEVICE_ID, null, Date.now(), null, {project: null}, {name: 'Your world', project: null}, folders)
  assert.deepEqual([yours.values.name, yours.values.folder], ['Your world', 'central'], 'your world: Central')
  const bookOnly = pages.workspaceBinding(pages.WORKSPACE_DEVICE_ID, book, Date.now(), {switchMode: noop, rename: noop}, null)
  assert.deepEqual([bookOnly.values.name, bookOnly.values.folder], ['Morning', 'Archetypal-Earth'], 'no world: the book\'s workspace, as before')
  // REPLACED (#725): "every key of the Workspace's design classified" and its drawing on the binding — the manual removed the Workspace as a
  // device (§18.1: "The settings stand on the track's head … The world's account of itself is Docs, on the track's chain"), so no design
  // draws these keys; every key the binding reports is still one its wiring classifies.
  for (const key of Object.keys(binding.values)) assert.ok(pages.WORKSPACE_WIRING.keys.includes(key) || key.includes(':'), `${key} classified`)
})

test('code-reading — Central names each world\'s head device, and publishes Docs on the door for the pane it opens', async () => {
  const {readFile} = await import('node:fs/promises')
  const tracks = await readFile(new URL('../src/frame/tracks/useCentralTracks.ts', import.meta.url), 'utf8')
  assert.match(tracks, /nameTrackHeadDevices\('central', devices\)/)
  // REPLACED (#725): the head opened the Workspace, which CentralDevices.tsx published on no chain — the Workspace was retired (§18.1); the
  // head opens the world's Docs, which stands on the world's chain (§16.2) and is published with the chain's own devices.
  assert.match(tracks, /openInstrument\(DEVICE_PANE_KIND, undefined, \{ref: DOCS_DEVICE, title: `\$\{world\.name\} · Docs`\}\)/)
  assert.match(tracks, /const DOCS_DEVICE = centralDeviceId\('docs'\)/)
  const chain = await readFile(new URL('../src/central/devices/CentralDevices.tsx', import.meta.url), 'utf8')
  assert.match(chain, /return \[centralDeviceId\('packet'\), CENTRAL_AGENT_ID, CENTRAL_SCOPE_ID, DOCS_DEVICE_ID\]/)
  assert.match(chain, /for \(const entry of entries\) publishDevice\(entry\.id, centralPublication\(entry, bindingOf\(entry\.id\)\)\)/)
  assert.doesNotMatch(await readFile(new URL('../src/frame/tracks/SessionGrid.tsx', import.meta.url), 'utf8'), /central:world|'central'/, 'the grid stays mode-blind')
})

// ── 2. the Day's close-out (design package D5) ──────────────────────────────────────────────────────────────────────────────────────

test('the Day\'s close-out stays absent naming its owner\'s missing route: Central keeps no close-out verify, and no kernel route reaches AIKit\'s', async () => {
  const day = await import('../src/central/devices/dayBinding.ts')
  const {day: dayDesign} = await import('../src/inhabitants/catalogue/panels/day.tsx')
  assert.ok('closeout' in dayDesign.defaults && designKeys(dayDesign).includes('closeout'), 'the design reads `closeout`; its press is `verifyCloseout`')
  assert.equal(day.DAY_ABSENT.closeout, day.NO_CLOSEOUT)
  assert.equal(day.DAY_STANDING.verifyCloseout.disabled, day.NO_CLOSEOUT)
  assert.match(day.NO_CLOSEOUT, /aikit work continuity closeout verify --json/)
  assert.match(day.NO_CLOSEOUT, /missing op: an aikit_read route for `work continuity closeout verify`/)
})

// ── 3. Notifications (design package D10) — since #725, Approvals' Requests ───────────────────────────────────────────────────────

test('Notifications\' readings stand in Approvals: Messages\' waiting agents read off their own device, the owners\' requests in its queue; before Central answers, the requests and the desktop absent naming their reading', async () => {
  // REPLACED (#725): the Notifications monitor on the rail and in a pane (widgets__notifications.tsx) — retired into Approvals (§23.9 "What an
  // owner or an agent raises for you to decide … waits in Approvals, under Requests"). Approvals is the device that draws them now
  // (railBindings.ts withOwnerRequests): Messages' waiting count as its `messages`, the owners' requests as queue rows of kind request.
  const rail = await import('../src/widgets/railBindings.ts')
  const receipts = await import('../src/agent/devices/receiptBindings.ts')
  const chainBind = await import('../src/agent/devices/designBindings.ts')
  const {design} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')
  // Messages' own agents (each in its occupant's run state): counted, never derived again.
  const agents = JSON.stringify([{id: 'position:flint', name: 'Flint', state: 'stalled'}, {id: 'position:nara', name: 'Nara', state: 'waiting'}, {id: 'position:kite', name: 'Kite', state: 'working'}, {id: 'position:lilt', name: 'Lilt'}])
  const carried = rail.ownerRequestsValues({messagesAgents: agents, nowUnixMs: 0})
  assert.equal(carried.messages, 2, 'the agents that wait for you or have stalled')
  const unread = rail.ownerRequestsValues({messagesAgents: undefined, nowUnixMs: 0})
  assert.deepEqual([unread.messages, unread.rows, unread.desktop], [undefined, null, undefined], 'no device read: absent, never zero')
  const own = receipts.approvalsBinding({gateway: {}, session: null, encounter: null, holds: chainBind.chainHolds()}, null, {}, 'central:main:approvals')
  const binding = rail.withOwnerRequests(own, {messagesAgents: agents, nowUnixMs: 0, ledger: {status: 'reading'}})
  assert.equal(binding.values.messages, 2)
  assert.deepEqual(binding.waiting, ['desktop'], 'the desktop\'s notice waits for personal.notifications.list')
  assert.equal(binding.values.queue, undefined, 'no request read: absent, never an empty queue')
  // DELETED (#725): "Messages ▸ and Approvals ▸ open the devices" — the Notifications monitor that stood apart from both is gone (§23.9); its
  // requests stand in Approvals itself, and its foot says how many wait in Messages.
  const keys = designKeys(design)
  for (const key of ['messages', 'desktop', 'queue']) assert.ok(keys.includes(key), `Approvals reads ${key}`)
  const all = drawsOn(design, binding, /prop:setModel|setModel/)
  assert.match(all, /2 wait in Messages/, 'Messages\' waiting agents, in Approvals\' foot')
})

test('Notifications\' rail tile is gone; Approvals\' tile and the door ids it reads are the devices\' own', async () => {
  const {readFile} = await import('node:fs/promises')
  // REPLACED (#725): "registered right after Approvals" — the Notifications tile is retired with its device (§23.9); Approvals' own tile stands.
  const widgets = await readFile(new URL('../src/shell/widgets.tsx', import.meta.url), 'utf8')
  assert.ok(widgets.includes("'ledger', 'approvals']"), 'the agent tiles end with Approvals')
  assert.doesNotMatch(widgets, /\{id: 'notifications'/, 'no Notifications tile')
  const railDevices = await readFile(new URL('../src/widgets/railDevices.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(railDevices, /\{id: 'notifications', title: 'Notifications'/, 'no Notifications device among the rail-born devices')
  const messages = await readFile(new URL('../src/agent/devices/messagesBinding.ts', import.meta.url), 'utf8')
  assert.match(messages, /export const MESSAGES_ID = 'ai-kit:messages'/)
  assert.match(railDevices, /export const NOTIFY_MESSAGES_ID = 'ai-kit:messages'/, 'the rail reads Messages\' agents off its own device')
  const receipts = await readFile(new URL('../src/agent/devices/receiptBindings.ts', import.meta.url), 'utf8')
  assert.match(receipts, /export const APPROVALS_ID = 'factory:main:approvals'/)
  const central = await readFile(new URL('../src/central/devices/CentralDevices.tsx', import.meta.url), 'utf8')
  assert.match(central, /export const CENTRAL_APPROVALS_ID = 'central:main:approvals'/)
  // REPLACED (#725): NOTIFY_APPROVALS_IDS (the monitor read Approvals' queue off the door) — Approvals carries the requests itself.
  assert.match(central, /withOwnerRequests\(commented, /, 'Central\'s Approvals carries the owners\' requests')
})

// ── 5. the Session grid and the Arrangement ruler against their designs (T-COVERAGE §1.4) ───────────────────────────────────────────

test('the Session grid takes the design\'s elements it lacked — the dark head under its colour rule, the armed mark, the legend and what the selected clip does — keeping its own', async () => {
  const set = {columns: [{id: 'r1', name: '1'}, {id: 'r2', name: '2'}], tracks: [{id: 'lead', name: 'Fizz · lead', kind: 'session', color: '#5cc6b4', mix: {arm: true}}, {id: 'test', name: 'test', kind: 'session'}],
    clips: [{id: 'c1', trackId: 'lead', columnId: 'r1', label: 'map field → plan', status: 'running', launch: {quantize: 'tool', follow: 'next'}}],
    actions: {recordSlot: {op: 'record', run: noop}, retry: {op: 'retry', run: noop}}, mixer: {}}
  const selection = {ref: 'c1', select: noop}
  const markup = renderToStaticMarkup(createElement(grid.SessionGridView, {set, selection, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))
  assert.match(markup, /class="trk-arm" role="img" aria-label="Armed"/, 'an armed track\'s head carries the record mark')
  assert.match(markup, /<footer class="sg-legend" aria-label="Legend">/)
  for (const word of ['Waiting', 'Running', 'Stopped', 'Recording', 'Stalled', 'Done']) assert.match(markup, new RegExp(`data-status="${word.toLowerCase()}"></i>${word}`))
  assert.match(markup, /<span class="sg-says">map field → plan · launches tool · then next<\/span>/, 'what the selected clip launches and does after')
  // Kept: the mixer row, the armed slots' record buttons, the retry, the Main column, the empty track.
  for (const kept of [/class="trk-mix"/, /class="sg-rec"/, /class="rt"/, /class="trk trk-main"/, /class="sg-fill"/]) assert.match(markup, kept)
  const {readFile} = await import('node:fs/promises')
  const css = await readFile(new URL('../src/frame/tracks/tracks.css', import.meta.url), 'utf8')
  assert.match(css, /\.trk \{[^}]*border-top: 3px solid var\(--tc\)/, 'the column wears its colour as the rule over its head')
  assert.match(css, /\.trk \.thd \{[^}]*background: var\(--bg-3\)/, 'the head itself is dark')
})

test('the Arrangement ruler takes the design\'s legend, with the lanes that stalled and how long since; the foot with the owner\'s answer stays as it was', () => {
  const set = {columns: [{id: 'r1', name: '1'}], ruler: {unit: 's', now: 528}, tracks: [{id: 'fixture', name: 'fixture-gen', kind: 'session', needle: 420, stalled: true}],
    clips: [{id: 'c1', trackId: 'fixture', columnId: 'r1', label: 'generate fixtures', status: 'stalled', at: {start: 400}}]}
  const view = {window: null, onWindow: noop, snap: 'free', onSnap: noop, marker: null, onMarker: noop, width: 0}
  const markup = renderToStaticMarkup(createElement(ArrangementRulerView, {set, selection: {select: noop}, view, receipt: null, onPress: noop, onDismiss: noop}))
  assert.match(markup, /<footer class="sg-legend tl-legend" aria-label="Legend">/)
  for (const word of ['Running', 'Waiting', 'Stopped', 'Stalled']) assert.match(markup, new RegExp(`data-status="${word.toLowerCase()}"></i>${word}`))
  assert.match(markup, /<span class="sg-says">fixture-gen · stalled 108 s<\/span>/)
  assert.doesNotMatch(markup, /class="tl-foot"/, 'nothing to say: still no foot')
})
