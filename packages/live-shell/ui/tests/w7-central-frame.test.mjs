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
const {design: workspaceDesign} = await import('../src/inhabitants/catalogue/panels/central__workspace.tsx')

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
  heads.nameTrackHeadDevices('central', new Map([[WORLD_TRACK, {title: 'Workspace', does: 'Open O-I\'s Workspace full in a pane', open: () => opened.push('central:workspace')}]]))
  try {
    const selected = []
    const selection = {select: target => selected.push(target)}
    const session = renderToStaticMarkup(createElement(grid.SessionGridView, {set: SET, selection, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))
    assert.match(session, new RegExp(`data-track-device="${WORLD_TRACK}"`))
    assert.match(session, /aria-label="Open O-I&#x27;s Workspace in a pane"/)
    assert.doesNotMatch(session, /data-track-device="factory:session:x"/, 'a track no mode names: no button')
    const view = {window: null, onWindow: noop, snap: 'free', onSnap: noop, marker: null, onMarker: noop, width: 0}
    const ruler = renderToStaticMarkup(createElement(ArrangementRulerView, {set: SET, selection, view, receipt: null, onPress: noop, onDismiss: noop}))
    assert.match(ruler, new RegExp(`data-track-device="${WORLD_TRACK}"`), 'the Arrangement\'s head too')
    // The press selects the track first (so the Workspace reads that world), then opens the device.
    const button = grid.TrackDeviceButton({device: heads.trackHeadDevice(WORLD_TRACK), track: SET.tracks[0], selection})
    let stopped = false
    button.props.onClick({stopPropagation: () => { stopped = true }})
    assert.deepEqual(selected, [{kind: 'track', ref: WORLD_TRACK, title: 'O-I'}])
    assert.deepEqual(opened, ['central:workspace'])
    assert.ok(stopped, 'the press is the button\'s, not the head\'s')
  } finally { heads.nameTrackHeadDevices('central', null) }
  assert.equal(heads.trackHeadDevice(WORLD_TRACK), undefined, 'taken back: no button')
})

test('the Workspace opened on a world reads the world\'s name and folder, offers the worlds\' projects as Folder choices, and refuses a rename naming the op', async () => {
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
  for (const key of designKeys(workspaceDesign)) assert.ok([pages.WORKSPACE_WIRING.reads, pages.WORKSPACE_WIRING.local, pages.WORKSPACE_WIRING.refused, pages.WORKSPACE_WIRING.absent].some(table => key in table), `${key} classified`)
  // The design's Name field spreads no standing (catalogue central__workspace.tsx:674, PROPOSE), so the refusal is said on the press (above).
  drawsOn(workspaceDesign, binding, /Archetypal-Earth\/wiki|sf1-walk|Palace/)
})

test('code-reading — Central names each world\'s head device, and publishes the Workspace on the door for the pane it opens', async () => {
  const {readFile} = await import('node:fs/promises')
  const tracks = await readFile(new URL('../src/frame/tracks/useCentralTracks.ts', import.meta.url), 'utf8')
  assert.match(tracks, /nameTrackHeadDevices\('central', devices\)/)
  assert.match(tracks, /openInstrument\(DEVICE_PANE_KIND, undefined, \{ref: WORKSPACE_DEVICE, title: `\$\{world\.name\} · Workspace`\}\)/)
  const chain = await readFile(new URL('../src/central/devices/CentralDevices.tsx', import.meta.url), 'utf8')
  assert.match(chain, /publishDevice\(WORKSPACE_DEVICE_ID, workspaceBinding \? \{device: workspaceDev, binding: workspaceBinding\} : \{device: workspaceDev\}\)/)
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

// ── 3. Notifications (design package D10) ───────────────────────────────────────────────────────────────────────────────────────────

test('Notifications: a monitor on the rail and in a pane; Messages\' waiting agents and Approvals\' queue read off their own devices; requests and the provider absent naming personal.notify', async () => {
  const rail = await import('../src/widgets/railBindings.ts')
  const {design} = await import('../src/inhabitants/catalogue/panels/widgets__notifications.tsx')
  assert.equal(design.kind, 'monitor')
  assert.deepEqual(viewsOf(design).filter(view => view !== 'popout').sort(), ['full', 'widget'], 'a monitor: its rail tile and its Full')
  // Messages' own agents (each in its occupant's run state) and Approvals' own queue: counted, never derived again.
  const agents = JSON.stringify([{id: 'position:flint', name: 'Flint', state: 'stalled'}, {id: 'position:nara', name: 'Nara', state: 'waiting'}, {id: 'position:kite', name: 'Kite', state: 'working'}, {id: 'position:lilt', name: 'Lilt'}])
  const queue = JSON.stringify([{id: 'r1', kind: 'proposal'}, {id: 'q1', kind: 'request'}])
  const values = rail.notificationsValues({messagesAgents: agents, approvalsQueue: queue, nowMinutes: 1052})
  assert.deepEqual([values.waiting, values.proposals, values.now], [2, 2, 1052])
  const unread = rail.notificationsValues({messagesAgents: undefined, approvalsQueue: undefined, nowMinutes: 0})
  assert.deepEqual([unread.waiting, unread.proposals], [undefined, undefined], 'no device read: absent, never zero')
  const held = {}
  const opened = []
  const binding = rail.notificationsBinding('widgets:notifications', {messagesAgents: agents, approvalsQueue: queue, nowMinutes: 1052}, held,
    {local: {show: v => { held.show = v }}, messages: () => opened.push('messages'), approvals: () => opened.push('approvals')})
  assert.deepEqual([binding.values.show, binding.values.follow], ['all', true], 'Show All and Follow On (§23.9)')
  for (const key of ['requests', 'provider']) assert.equal(binding.values[key], undefined, `${key}: absent`)
  for (const key of ['requests', 'provider']) assert.match(rail.NOTIFICATIONS_ABSENT[key], /personal\.notify/)
  binding.local.messages(true); binding.local.approvals(true)
  assert.deepEqual(opened, ['messages', 'approvals'], 'Messages ▸ and Approvals ▸ open the devices; nothing is written')
  await assert.rejects(binding.write([{key: 'open', value: 'n1'}]), /personal\.notify/)
  const keys = designKeys(design)
  const local = ['show', 'follow', 'selected', 'opened', 'now'], read = ['waiting', 'proposals'], absent = ['requests', 'provider']
  assert.deepEqual([...keys].sort(), [...local, ...read, ...absent].sort(), 'every key: the view\'s own, a reading, or absent with its reason')
  drawsOn(design, binding, /Morning checks failed|Kev decision service down|Flint asks for a decision|macOS Notification Centre/)
  assert.match(hosted(design, binding).map(([, m]) => m).join(''), /No reading of the requests/)
})

test('Notifications\' rail tile is registered right after Approvals, and the door ids it reads are the devices\' own', async () => {
  const {readFile} = await import('node:fs/promises')
  const widgets = await readFile(new URL('../src/shell/widgets.tsx', import.meta.url), 'utf8')
  const tiles = widgets.indexOf("'ledger', 'approvals']"), notify = widgets.indexOf("{id: 'notifications'"), wiki = widgets.indexOf("{id: 'wiki'")
  assert.ok(tiles > 0 && notify > tiles && notify < wiki, 'the agent tiles (ending with Approvals), then Notifications, then the other rail-born devices')
  const railDevices = await readFile(new URL('../src/widgets/railDevices.tsx', import.meta.url), 'utf8')
  assert.match(railDevices, /\{id: 'notifications', title: 'Notifications'/, 'claimed for its device with the other rail-born devices')
  const messages = await readFile(new URL('../src/agent/devices/messagesBinding.ts', import.meta.url), 'utf8')
  assert.match(messages, /export const MESSAGES_ID = 'ai-kit:messages'/)
  const receipts = await readFile(new URL('../src/agent/devices/receiptBindings.ts', import.meta.url), 'utf8')
  assert.match(receipts, /export const APPROVALS_ID = 'factory:main:approvals'/)
  const central = await readFile(new URL('../src/central/devices/CentralDevices.tsx', import.meta.url), 'utf8')
  assert.match(central, /export const CENTRAL_APPROVALS_ID = 'central:main:approvals'/)
  assert.match(railDevices, /NOTIFY_APPROVALS_IDS = \['central:main:approvals', 'factory:main:approvals'\]/)
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
