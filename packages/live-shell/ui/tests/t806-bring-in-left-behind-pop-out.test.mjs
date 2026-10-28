// Ticket 806 — bringing a world into today works or refuses in words; a device's reasons are prose; a pop-out keeps its reasons.
//   - Bring-in (manual §18.1 "To bring a world into today, drag it from the browser onto an empty track"; §18.2 Whole, Close: "Close
//     routine, Close now, Open today"): today's set is kept in today's Day (central/daySet.ts). While Central names an earlier Day
//     (the kernel's Inspect marks it `stale`, central.rs Request::Inspect), the set had no seat at all: a drag fell on nothing and a
//     double-click said "Open Central's Session", which stood open. The seat now stands whenever Central discloses its worlds, and
//     refuses in the Day owner's words, naming the press that opens today (Close now, then Open today, on the Day device).
//     Run against the owner (28 Oct, a scratch Central root whose Day pointer was a day behind its civil-time policy): the set's write
//     (`central.document.mutate` field.set on `original:meta`) lands in the EARLIER Day; `central.day.close-carry` closes it and names
//     tomorrow; `central.day.ensure` then points at today, whose document Open today makes; the write then lands in today's Day.
//   - Left behind (§19.23 "What a run leaves behind"): the worlds' and bindings' reads showed Workcell's failure envelope raw
//     (`{"kind":"unavailable","message":"No such file or directory (os error 2)","operation_may_have_run":false}`, capture 13). Each
//     refusal on the page is now a sentence in Workcell's words.
//   - Pop-out (§16.3 Pop-out "Its own window … The material with every control docked under it"; §16.11 Disabled "The control at 40 %
//     strength. The status bar says why"): a device's window carries the status bar's Info line under its device.
// Channels: SCRIPTED (pure functions; the hygiene pages read through a stubbed kernel bridge answering as the kernel does — the
// envelope is the capture's own words; the designs drawn to markup) and code-reading. The native screen pass is the lead's: UNVERIFIED.
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
const daySet = await import('../src/central/daySet.ts')
const adapter = await import('../src/timeline/centralTrackAdapter.ts')
const tracksHook = await import('../src/frame/tracks/useCentralTracks.ts')
const {WorldRowList, seatWorldFromBrowser} = await import('../src/shell/ModeBrowser.tsx')
const groundDevices = await import('../src/central/devices/groundDevices.ts')
const groundBind = await import('../src/central/devices/groundBindings.ts')
const one = await import('../src/agent/devices/oneAgentBinding.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const designs = await import('../src/frame/devices/designs.ts')
const windows = await import('../src/frame/devices/DeviceWindows.tsx')
const windowsRelayed = await import('../src/frame/devices/RelayedDevice.tsx')
const kit = await import('../src/inhabitants/sdk/panel.tsx')
const {design: workcellDesign} = await import('../src/inhabitants/catalogue/panels/workcell__workcell.tsx')

const html = element => renderToStaticMarkup(element)
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

// ── bringing a world into today ───────────────────────────────────────────────────────────────────────────────────────────────────

// Shaped as the real root's readings on 28 Oct 2026 (`ctrl --json action run central.time.policy` and `central.day.read`, read-only):
// civil today 2026-10-28; the Day Central names 2026-10-19, open, its document ready, a relations revision to close it on. The kernel's
// words for the pair are central.rs Request::Inspect's.
const STALE_WORDS = 'The native today pointer belongs to an earlier civil Day; its writing is retained'
const TIME = {state: 'ready', action: 'central.time.policy', data: {civil_date: '2026-10-28', revision: 'time-rev',
  policy: {automatic_day_rollover: true, day_boundary_minutes: 0, timezone: 'Europe/London'}}}
const SOURCE = 'central:source:control:root:Control/user/day/2026-10-19/day.md'
const DOC = 'document:day-2026-10-19'
const documentReading = (day = '2026-10-19') => ({schema: 'central.document-reading/v1', source: {ref: SOURCE, path: `Control/user/day/${day}/day.md`}, revision: {revision: 'rev-1'},
  document_id: DOC, document: {document_id: DOC, kind: 'day', day_ref: `central:day:control:root:${day}`, fields: [{id: 'original:meta', template_pointer: '/meta'}],
    template_payload: {meta: {date: day}, fields: {}}}, automatic_agent_or_model_invocation: false})
const dayOf = (day, extra = {}) => ({day_ref: `central:day:control:root:${day}`, temporal: {civil_date: day, lifecycle: 'open', day_ref: `central:day:control:root:${day}`},
  document_state: 'ready', document: documentReading(day), revision: {revision: 'rev-1'}, relations_revision: 'rel-1', source: {ref: SOURCE, path: `Control/user/day/${day}/day.md`}, ...extra})
const leg = action => ({state: 'unavailable', action, error: {message: 'not read here'}})
const groundOf = day => ({schema: 'oi.central-ground/v1', project: null, time: TIME, day, now: leg('central.now.list'), sources: leg('projectcentral.change.horizon'), placement: leg('central.work.policy')})
const STALE = groundOf({state: 'stale', action: 'central.day.read', data: dayOf('2026-10-19'), error: {message: STALE_WORDS}})
const STALE_CLOSED = groundOf({state: 'stale', action: 'central.day.read', data: dayOf('2026-10-19', {temporal: {civil_date: '2026-10-19', lifecycle: 'closed'}}), error: {message: STALE_WORDS}})
const UNMADE = groundOf({state: 'ready', action: 'central.day.read', data: dayOf('2026-10-28', {document_state: 'uninitialised', document: null})})
const READY = groundOf({state: 'ready', action: 'central.day.read', data: dayOf('2026-10-28')})

const WORLDS = {state: 'read', worlds: [
  {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null},
  {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'}]}

test('a world refused today says why in the Day owner\'s words and names the press that opens today: Close now, then Open today', () => {
  const words = daySet.bringInRefusal('O-I', STALE, null)
  assert.match(words, /^O-I cannot come into today/)
  assert.ok(words.includes(STALE_WORDS), 'Central\'s own words, verbatim')
  assert.match(words, /Mon 19 Oct/, 'the Day Central names')
  assert.match(words, /Wed 28 Oct/, 'civil today')
  assert.match(words, /today's set is kept in today's Day/, 'why the Day matters to the set')
  assert.match(words, /Day device/)
  assert.ok(words.indexOf('Close now') >= 0 && words.indexOf('Close now') < words.indexOf('Open today'), 'Close now first, then Open today')
  assert.doesNotMatch(words, /[{}]/, 'prose, never an envelope')
  // The Day Central names is closed already: Open today alone opens today.
  const closed = daySet.bringInRefusal('O-I', STALE_CLOSED, null)
  assert.match(closed, /Open today/)
  assert.doesNotMatch(closed, /Close now/)
  // Today's Day without its document yet: Open today makes it.
  const unmade = daySet.bringInRefusal('O-I', UNMADE, null)
  assert.match(unmade, /Wed 28 Oct has no document yet/)
  assert.match(unmade, /Open today/)
  assert.doesNotMatch(unmade, /Close now/)
  // Central's ground did not answer, or is being read: said so.
  assert.match(daySet.bringInRefusal('O-I', null, 'the carrier is down'), /Central's ground did not answer: the carrier is down/)
  assert.match(daySet.bringInRefusal('O-I', null, null), /still being read/)
  // Today's Day stands: nothing to refuse.
  assert.equal(daySet.bringInRefusal('O-I', READY, null), null)
})

test('while today\'s set cannot be written, the empty track still takes a world, and refuses it in those words; a set that can seat keeps its own seat', async () => {
  const none = {state: 'none', reason: STALE_WORDS}
  const added = []
  const projected = adapter.projectCentralTracks({civil: {state: 'reading'}, worlds: WORLDS, set: none, controls: {addWorld: async world => { added.push(world.ref) }}})
  assert.equal(projected.actions?.seat, undefined, 'the adapter offers no seat on a set it cannot read (the drop fell on nothing)')
  const seated = tracksHook.withWorldSeat(projected, WORLDS, world => daySet.bringInRefusal(world.name, STALE, null))
  assert.equal(seated.actions.seat.accepts, adapter.CENTRAL_WORLD_DRAG, 'the drop is taken')
  const answer = await seated.actions.seat.run('central:wiki:project:O-I')
  assert.equal(answer.ok, false)
  assert.equal(answer.error, daySet.bringInRefusal('O-I', STALE, null), 'refused in the Day owner\'s words')
  assert.deepEqual(await seated.actions.seat.run('central:wiki:project:nowhere'), {ok: false, error: '"central:wiki:project:nowhere" is no world Central discloses.'})
  assert.deepEqual(added, [], 'nothing is written into an earlier Day')
  for (const kept of ['launch', 'stopTrack', 'removeTrack']) assert.equal(seated.actions[kept], projected.actions?.[kept], `${kept} stays as the adapter gave it`)
  // A set that seats keeps its own seat, untouched.
  const readSet = {state: 'read', civilDate: '2026-10-28', set: daySet.EMPTY_SET}
  const live = adapter.projectCentralTracks({civil: {state: 'reading'}, worlds: WORLDS, set: readSet, controls: {addWorld: async world => { added.push(world.ref) }}})
  assert.equal(tracksHook.withWorldSeat(live, WORLDS, () => 'never asked'), live, 'the owner\'s own seat stands')
  await live.actions.seat.run('central:wiki:project:O-I')
  assert.deepEqual(added, ['central:wiki:project:O-I'], 'and writes the world into today\'s set')
  // No worlds disclosed: no world can be named, so nothing is offered.
  const unread = adapter.projectCentralTracks({civil: {state: 'reading'}, worlds: {state: 'reading'}, set: none})
  assert.equal(tracksHook.withWorldSeat(unread, {state: 'reading'}, () => 'never'), unread)
})

test('the Central tracks pass their set through the refusing seat, on the ground the Day reads (code-reading: the binding is cut by removing it)', () => {
  const source = read('frame/tracks/useCentralTracks.ts')
  assert.match(source, /withWorldSeat\(\s*withWorksIn\(projectCentralTracks\(/, 'the projected set is offered the refusing seat')
  assert.match(source, /bringInRefusal\(world\.name, groundReading, groundError\)/, 'in the Day owner\'s words')
  assert.match(source, /const groundReading = ground\.reading, groundError = ground\.error/, 'from the ground the Day device reads (useCentralGroundAnswer)')
})

test('a double-click or Enter on a world goes through that seat: the refusal comes back, and the row list says it as an alert, not a status', async () => {
  const projected = adapter.projectCentralTracks({civil: {state: 'reading'}, worlds: WORLDS, set: {state: 'none', reason: STALE_WORDS}, controls: {}})
  const set = tracksHook.withWorldSeat(projected, WORLDS, world => daySet.bringInRefusal(world.name, STALE, null))
  const answer = await seatWorldFromBrowser(WORLDS.worlds[1], {presented: 'session', set})
  assert.deepEqual(answer, {ok: false, error: daySet.bringInRefusal('O-I', STALE, null)})
  const refused = html(createElement(WorldRowList, {worlds: WORLDS.worlds, onSeat() {}, said: null, fault: answer.error}))
  assert.match(refused, /role="alert"[^>]*data-seat-fault[^>]*>O-I cannot come into today/, 'the refusal stands as an alert under the rows')
  assert.doesNotMatch(refused, /role="status"/)
  const seated = html(createElement(WorldRowList, {worlds: WORLDS.worlds, onSeat() {}, said: 'O-I is in today\'s set.', fault: null}))
  assert.match(seated, /role="status"[^>]*>O-I is in today&#x27;s set\.</, 'a world brought in is a status')
  assert.doesNotMatch(seated, /role="alert"/)
})

// ── Left behind: Workcell's refusals as prose ─────────────────────────────────────────────────────────────────────────────────────

// Capture 13's words: the candidate's Workcell read failed with this envelope (kernel material.rs Error, serialised by owner_read.rs
// workcell_status and owner_routes.rs wire). REAL words; the envelope's shape is the kernel's.
const ENVELOPE = '{"kind":"unavailable","message":"No such file or directory (os error 2)","operation_may_have_run":false}'
const ok = outcome => ({json: async () => ({ok: true, outcome})})
const refused = error => ({json: async () => ({ok: false, error})})
async function withKernel(answer, run) {
  const real = globalThis.fetch
  globalThis.fetch = async (_url, init) => answer(JSON.parse(init.body))
  try { return await run() } finally { globalThis.fetch = real }
}
const CELL = {workcell_ref: 'workcell:mac', state_root: '/Users/admin/.workcell'}
const worldsRefusal = pages => pages.sources.filter(source => /material/.test(source.boundaryOp)).map(source => source.refusal)

test('Workcell\'s envelope is said as a sentence in its words: what was asked, its message, and that nothing ran', () => {
  assert.equal(groundDevices.workcellRefusal('its status (`workcell status`)', ENVELOPE),
    'Workcell could not be started to read its status (`workcell status`): No such file or directory (os error 2). Nothing ran.')
  assert.equal(groundDevices.workcellRefusal('its worlds', {kind: 'refused', message: 'the receipt root is unreadable.', operation_may_have_run: true}),
    'Workcell refused to read its worlds: the receipt root is unreadable. It may have run in part.')
  assert.equal(groundDevices.workcellRefusal('its worlds', 'the kernel carrier is down'), 'the kernel carrier is down', 'plain words pass as they came')
})

test('Left behind\'s worlds and bindings read Workcell\'s refusal as prose when its status, its worlds or a world\'s material fails', async () => {
  const centralRefused = body => (body.op === 'invoke_action' ? refused('not read in this fixture') : null)
  // Its status fails (capture 13: the candidate's Workcell read).
  const status = await withKernel(body => centralRefused(body) ?? (body.op === 'workcell_status_read' ? refused(ENVELOPE) : refused(`unexpected ${body.op}`)),
    () => groundDevices.readHygienePages({kind: 'bridge', url: 'http://t806-status.fixture'}, 'e', true))
  assert.deepEqual(worldsRefusal(status), ['Workcell could not be started to read its status (`workcell status`): No such file or directory (os error 2). Nothing ran.'])
  // Its status answers; its worlds' listing fails.
  const listing = await withKernel(body => centralRefused(body) ?? (body.op === 'workcell_status_read' ? ok({result: 'workcell_status_reading', data: CELL})
    : body.op === 'workcell_read' ? refused(ENVELOPE) : refused(`unexpected ${body.op}`)),
  () => groundDevices.readHygienePages({kind: 'bridge', url: 'http://t806-worlds.fixture'}, 'e', true))
  assert.deepEqual(worldsRefusal(listing), ['Workcell could not be started to read its worlds (`workcell worlds`): No such file or directory (os error 2). Nothing ran.'])
  // A world is listed; its material read fails (the kernel answers native_owner_reading with Workcell's failure object).
  const WORLD = {schema: 'workcell.world-receipts/v1', worlds: [{receipt: '/Users/admin/.workcell/worlds/a.json', world_ref: 'world:a', workcell_ref: 'workcell:mac'}], unreadable: []}
  const material = await withKernel(body => centralRefused(body) ?? (body.op === 'workcell_status_read' ? ok({result: 'workcell_status_reading', data: CELL})
    : body.op === 'workcell_read' ? ok({result: 'owner_route_reading', route: 'workcell worlds', data: WORLD, warnings: []})
      : body.op === 'material_read' ? ok({result: 'native_owner_reading', owner: 'workcell', data: null, failure: JSON.parse(ENVELOPE)}) : refused(`unexpected ${body.op}`)),
  () => groundDevices.readHygienePages({kind: 'bridge', url: 'http://t806-material.fixture'}, 'e', true))
  assert.deepEqual(worldsRefusal(material).filter(Boolean), ['Workcell could not be started to read world:a\'s material (`workcell material`): No such file or directory (os error 2). Nothing ran.'])
  // The page draws those words, never the envelope.
  host.setHostPage('factory:workcell', 'left')
  try {
    const hygiene = groundBind.hygieneBinding('central:ground-hygiene', {census: {sources: [], worktrees: [], branches: [], seats: [], machineRef: 'workcell:mac'}, findings: [], pages: status, at: 0}, 0, async () => {})
    const rack = one.carryPages({id: 'factory:workcell', values: {name: 'env-2'}}, [{page: one.LEFT_BEHIND_PAGE, binding: hygiene}])
    const markup = html(createElement(host.HostedDevice, {designed: workcellDesign, binding: rack, view: 'whole', nav: {}}))
    assert.match(markup, /Workcell could not be started to read its status/, 'the Worlds and Bindings rings\' refusal, in prose')
    assert.doesNotMatch(markup, /\{&quot;kind&quot;|\{"kind"/, 'no raw envelope on the page')
  } finally { host.resetHost('factory:workcell') }
})

// ── a pop-out keeps its reasons ───────────────────────────────────────────────────────────────────────────────────────────────────

const REASON = 'The Day shown is closed already, or is one you selected.'
const probeDesign = id => ({id, title: 'Probe', kind: 'effect', defaults: {},
  folded: () => createElement('span'), compact: () => createElement('span'), widget: () => createElement('span'),
  whole: () => createElement(kit.Action, {label: 'Close now', does: 'Closes the Day through Central.', onPress() {}, disabled: REASON}),
  full: () => createElement('i', {'data-probe': 'full'})})

test('a device\'s window carries the status bar\'s Info line under its device, and a disabled control there says why (§16.11)', () => {
  const device = {id: 't806:probe', family: 't806', face: {id: 'probe', title: 'Probe', icon: 'form', liveSemantic: 'device-audio-fx'}, rows: [], values: {}}
  designs.registerDesignedDevice(probeDesign('t806:probe'))
  door.publishDevice(device.id, {device})
  try {
    door.openDeviceWindow(device.id)
    const layer = html(createElement(windows.DeviceWindowLayer))
    assert.match(layer, /data-device-window="t806:probe"/)
    assert.match(layer, /class="device-window-room"[\s\S]*<footer class="device-window-info" data-region="window-info" role="status" data-info="idle"><b>Info<\/b>/,
      'the Info line stands under the device, idle until pointed at')
    // The disabled control carries its reason where the Info line reads it (the shell's one info law, components/StatusBar.tsx infoOf).
    const cell = layer.match(/data-i="(Close now\|[^"]*)"[^>]*data-disabled="true"/)
    assert.ok(cell, 'the dimmed control is in the window, with its words')
    const said = cell[1].replaceAll('&#x27;', '\'')
    const target = {closest: () => ({getAttribute: name => (name === 'data-i' ? said : null)})}
    const info = windows.windowInfoOf(target)
    assert.equal(info.label, 'Close now')
    assert.ok(info.fn.includes(REASON), 'the Info line says why it stands dimmed')
    const line = html(createElement(windows.WindowInfoLine, {info}))
    assert.match(line, /data-info="reading"><b>Close now<\/b>Closes the Day through Central\. The Day shown is closed already/)
  } finally {
    door.closeDeviceWindow(device.id); door.publishDevice(device.id, null); designs.unregisterDesignedDevice('t806:probe'); host.resetHost(device.id)
  }
  // The window reads what the pointer enters inside it, and the host's refusals said there (code-reading: SSR runs no mouseover).
  const source = read('frame/devices/DeviceWindows.tsx')
  assert.match(source, /onMouseOver=\{info\.onMouseOver\} data-i=\{`\$\{title\}\|\$\{WINDOW_SAYS\}`\}/, 'the in-window frame listens, and its reading stops at the window')
})

test('the host\'s own window (the native Pop-out) carries the same Info line around its relayed device', () => {
  globalThis.window = {__TAURI_INTERNALS__: {}}
  try {
    const {RelayedDevice} = windowsRelayed
    const markup = html(createElement(RelayedDevice, {bindingId: 'device:t806/probe', fallback: () => createElement('p', null, 'alone')}))
    assert.match(markup, /class="device-relayed-window"[\s\S]*Reaching the device in the main window[\s\S]*<footer class="device-window-info" data-region="window-info"/,
      'the relayed device, then its Info line under it')
  } finally { delete globalThis.window }
  assert.match(read('frame/devices/RelayedDevice.tsx'), /onMouseOver=\{info\.onMouseOver\} data-i=/, 'the host\'s window listens, and its reading stops at the window')
})
