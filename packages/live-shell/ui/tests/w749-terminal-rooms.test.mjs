// O-I #749, the Terminal as a room of a session space (DLW §17.9, §10.1). The room is AIKit's: one working-surface binding of a
// SessionSpace, read in the agency reading's spaces; its screen the owner's capture (kernel op working_surface_read); its provider the
// binding's (tmux, herdr, cmux), never the Terminal's. The Terminal follows the run you select or stays pinned, says so when the
// provider does not answer and keeps the room, returns to the same room when reopened, and sends keys only once you choose to type.
// Channels:
// - OWNER-SHAPED: the space is `aikit session-space list` as the installed AIKit printed it on a scratch home with a private tmux server
//   (29 Oct, b749), trimmed to the keys read; the capture text is that room's `working-surface capture` (format ansi) with an escape
//   added; the refusal is the owner's own words once the tmux server stopped.
// - SCRIPTED: the hands (holds, takeover, keys) recorded, never sent; the designs drawn through the host.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const host = await import('../src/frame/devices/deviceHost.tsx')
const tb = await import('../src/widgets/terminalBinding.ts')
const terminalPanel = await import('../src/inhabitants/catalogue/panels/widgets__terminal.tsx')
const terminalDesign = terminalPanel.design
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

// The space as `aikit session-space list` printed it (one session, one tmux room), and a second space of another agent's run.
const SPACE = {definition: {version: 'aikit.session-space/v1', id: 'session-space/b749-room'}, label: 'b749 room',
  agent_sessions: {'agent-session/b749-run': {agent_session: 'agent-session/b749-run', purpose: 'walk'}},
  working_surfaces: {'working-surface/b749-shell': {binding: 'working-surface/b749-shell', surface: 'surface/terminal/main/shell', agent_session: 'agent-session/b749-run',
    provider: 'provider/tmux/current', plan: {id: 'b749-room', name: 'b749-room', root: null, mux: 'tmux', attach: 'always', lifecycle: 'persist',
      views: [{id: 'main', name: null, steps: [{view: 'main', pane: 'shell', name: null, command: ['sh'], cwd: null, restart: 'never', focus: true}]}], backend_extensions: {}, warnings: []},
    plan_key: 'main/shell'}}}
const OTHER = {definition: {id: 'session-space/other'}, working_surfaces: {'working-surface/other-herdr': {binding: 'working-surface/other-herdr', surface: 'surface/terminal/main/run',
  agent_session: 'agent-session/other', provider: 'provider/herdr/current', plan: {name: 'env-1 · test', root: '/work/o-i', views: [{id: 'main', steps: [{pane: 'run', command: ['npm', 'test']}]}]}, plan_key: 'main/run'}}}
// Two sessions in the first space, as the agency reading lists them: one row each, the same space under both.
const ROWS = [{spaceRef: 'session-space/b749-room', sessionRef: 'agent-session/b749-run', project: '', raw: SPACE},
  {spaceRef: 'session-space/b749-room', sessionRef: 'agent-session/b749-helper', project: '', raw: SPACE},
  {spaceRef: 'session-space/other', sessionRef: 'agent-session/other', project: 'O-I', raw: OTHER},
  {spaceRef: 'session-space/bare', sessionRef: 'agent-session/bare', project: '', raw: {definition: {id: 'session-space/bare'}, working_surfaces: {}}}]
const TRACKS = [{sessionRef: 'agent-session/b749-run', agentName: 'Fizz'}, {sessionRef: 'agent-session/other', agentName: null}]
// The room's capture, as the owner returned it (format ansi), a colour escape and a title added.
const CAPTURE = 'sh-3.2$ echo hello-from-the-room; ls /\nhello-from-the-room\n\x1b[1;32mApplications\x1b[0m\tVolumes\n\x1b]0;b749-room\x07sh-3.2$\n\n\n\n'
const REFUSED = 'mux.tmux_surface_not_live: tmux has no live AIKit pane for `main/shell`'

function hands() {
  const calls = []
  return {calls, hold: (key, value) => calls.push(['hold', key, value]), type: async (room, on) => { calls.push(['type', room.id, on]) }, keys: async data => { calls.push(['keys', data]) }}
}
function input(over = {}) {
  return {rooms: tb.sessionRoomsOf(ROWS, TRACKS), locals: [], followed: {session: 'agent-session/b749-run', words: null}, holds: {},
    screen: {room: 'working-surface/b749-shell', lines: tb.screenOf(CAPTURE)}, hands: hands(), native: true, ...over}
}
const roomsIn = binding => JSON.parse(binding.values.rooms)

test('the rooms are the session spaces\' working-surface bindings, each once: its plan\'s name a label, its provider the binding\'s, its agent the session\'s track', () => {
  const rooms = tb.sessionRoomsOf(ROWS, TRACKS)
  assert.deepEqual(rooms, [
    {id: 'working-surface/b749-shell', name: 'b749-room', space: 'session-space/b749-room', session: 'agent-session/b749-run', project: '', provider: 'tmux', command: 'sh', agent: 'Fizz'},
    {id: 'working-surface/other-herdr', name: 'env-1 · test', space: 'session-space/other', session: 'agent-session/other', project: 'O-I', provider: 'herdr', command: 'npm test', folder: '/work/o-i'},
  ], 'one room per binding however many sessions its space lists; a space with none gives none')
  assert.equal(tb.providerWordOf('provider/cmux/current'), 'cmux')
  assert.deepEqual(tb.screenOf(CAPTURE), ['sh-3.2$ echo hello-from-the-room; ls /', 'hello-from-the-room', 'Applications\tVolumes', 'sh-3.2$'],
    'the escapes out, the blank lines under the last dropped')
})

test('it follows the run you select: that run\'s room, live, with the agent\'s name and its provider answering', () => {
  const binding = tb.terminalBinding(input())
  assert.equal(binding.values.selected, 'working-surface/b749-shell')
  assert.equal(binding.values.follow, true)
  assert.deepEqual([binding.values.provider, binding.values.answers, binding.values.light, binding.values.command, binding.values.lines], ['tmux', true, 'lit', 'sh', 4])
  const shown = roomsIn(binding).find(room => room.id === binding.values.selected)
  assert.equal(shown.agent, 'Fizz', 'the name of the agent whose run it is')
  assert.deepEqual(shown.lines.map(line => line.t), tb.screenOf(CAPTURE), 'its screen is the owner\'s capture')
  assert.equal(roomsIn(binding).find(room => room.id === 'working-surface/other-herdr').lines, undefined, 'another room\'s screen is not read, and none is invented')
  assert.equal(binding.values.watch, true, 'an agent\'s run is watched: Watch only until you choose to type')
  // Another run selected: the Terminal moves to its room.
  const moved = tb.terminalBinding(input({followed: {session: 'agent-session/other', words: null}, screen: null}))
  assert.equal(moved.values.selected, 'working-surface/other-herdr')
  assert.equal(moved.values.provider, 'herdr')
  assert.equal(moved.values.answers, undefined, 'its screen not yet read: no answer is invented')
  // A run whose space holds no room.
  const none = tb.terminalBinding(input({followed: {session: 'agent-session/bare', words: null}, screen: null}))
  assert.equal(none.values.selected, undefined)
  assert.match(none.standing.selected.disabled, /has no room in its session space/)
})

test('pinned, it keeps its room while you select elsewhere; Follow, the room and Wrap are the Terminal\'s own holds', () => {
  const h = hands()
  const pinned = tb.terminalBinding(input({holds: {follow: false, shell: 'working-surface/b749-shell'}, followed: {session: 'agent-session/other', words: null}, hands: h}))
  assert.equal(pinned.values.shell, 'working-surface/b749-shell')
  assert.equal(pinned.values.follow, false)
  assert.equal(pinned.values.provider, 'tmux', 'the pinned room shows, not the selected run\'s')
  assert.equal(pinned.values.selected, 'working-surface/other-herdr', 'the selected run\'s room is still named')
  pinned.local.follow(true)
  pinned.local.shell('working-surface/other-herdr')
  pinned.local.wrap(false)
  assert.deepEqual(h.calls, [['hold', 'follow', true], ['hold', 'shell', 'working-surface/other-herdr'], ['hold', 'follow', false], ['hold', 'wrap', false]])
  const gone = tb.terminalBinding(input({holds: {follow: false, shell: 'working-surface/gone'}}))
  assert.match(gone.standing.shell.disabled, /no longer stands/)
})

test('when the provider stops answering it says so in the provider\'s words, and the room stays with its last lines', () => {
  const quiet = tb.terminalBinding(input({screen: {room: 'working-surface/b749-shell', lines: tb.screenOf(CAPTURE), refused: REFUSED}}))
  assert.equal(quiet.values.answers, false)
  assert.equal(quiet.values.light, 'dark')
  assert.match(quiet.values.reason, /^tmux does not answer: mux\.tmux_surface_not_live: tmux has no live AIKit pane for `main\/shell`\. The room stays; its last lines are shown\.$/)
  assert.ok(roomsIn(quiet).some(room => room.id === 'working-surface/b749-shell' && room.lines.length === 4), 'the room stays, with its last lines')
  const never = tb.terminalBinding(input({screen: {room: 'working-surface/b749-shell', refused: REFUSED}}))
  assert.match(never.values.reason, /The room stays\.$/)
  host.resetHost()
  const full = renderToStaticMarkup(createElement(host.HostedDevice, {designed: terminalDesign, binding: quiet, view: 'full', nav: {}}))
  assert.match(full, /tmux does not answer/)
  assert.match(full, /b749-room/)
  host.resetHost()
})

test('reopened, it returns to the same room: its holds are kept and read back; the room is AIKit\'s binding, never a copy', () => {
  assert.deepEqual(tb.holdsFrom(JSON.stringify({follow: false, shell: 'working-surface/b749-shell', wrap: false, fontSize: 14, scrollback: 20000, stray: 1})),
    {follow: false, shell: 'working-surface/b749-shell', wrap: false, fontSize: 14, scrollback: 20000})
  assert.deepEqual(tb.holdsFrom('not json'), {})
  assert.deepEqual(tb.holdsFrom(null), {})
  const publisher = read('widgets/railDevices.tsx')
  assert.match(publisher, /const TERMINAL_HOLDS_KEY = 'oi\.terminal\.holds'/)
  assert.match(publisher, /globalThis\.localStorage\?\.setItem\(TERMINAL_HOLDS_KEY, JSON\.stringify\(next\)\)/, 'kept across a reopen')
  assert.match(publisher, /holdsFrom\(globalThis\.localStorage\?\.getItem\(TERMINAL_HOLDS_KEY\)/, 'read back when the Terminal opens again')
  assert.match(publisher, /kernelOp\(carrier, \{op: 'working_surface_read', project: shown\.project, agent_session: shown\.session, binding: shown\.id\}\)/,
    'the screen is the owner\'s capture of the exact binding')
  assert.doesNotMatch(publisher, /working-surface open|op: 'working_surface_open'/, 'the Terminal never creates or reopens a room')
})

test('keys reach the room only when you choose Type, through the takeover client; Watch only releases it; without it, Input says why', async () => {
  const h = hands()
  const watching = tb.terminalBinding(input({hands: h}))
  watching.local.keys('ls\r')
  assert.deepEqual(h.calls, [], 'no key reaches a room you only watch')
  watching.local.watch(false)
  assert.deepEqual(h.calls, [['type', 'working-surface/b749-shell', true]], 'Type takes the room\'s keyboard')
  const typing = tb.terminalBinding(input({hands: h, screen: {room: 'working-surface/b749-shell', lines: ['$'], driving: true}}))
  assert.deepEqual([typing.values.watch, typing.values.driving], [false, true])
  typing.local.keys('ls\r')
  typing.local.watch(true)
  assert.deepEqual(h.calls.slice(1), [['keys', 'ls\r'], ['type', 'working-surface/b749-shell', false]], 'keys while it drives; Watch only releases')
  const browser = tb.terminalBinding(input({native: false, hands: hands()}))
  assert.equal(browser.standing.watch.disabled, tb.NO_TAKEOVER)
  for (const key of ['command', 'folder']) await assert.rejects(watching.write([{key, value: 'x'}]), new RegExp(tb.ROOM_REFUSE[key].slice(0, 30)))
  assert.equal(watching.writes('command'), true)
  assert.equal(watching.writes('lines'), false)
  // The keys a driving screen sends, as a terminal sends them.
  const {keyData} = terminalPanel
  assert.deepEqual(['a', 'Enter', 'Backspace', 'ArrowUp', 'Tab', 'Escape'].map(key => keyData({key})), ['a', '\r', '\x7f', '\x1b[A', '\t', '\x1b'])
  assert.equal(keyData({key: 'c', ctrlKey: true}), '\x03')
  assert.equal(keyData({key: 'c', metaKey: true}), undefined, 'a ⌘ shortcut stays the app\'s')
  assert.equal(keyData({key: 'Shift'}), undefined)
  host.resetHost()
  const full = renderToStaticMarkup(createElement(host.HostedDevice, {designed: terminalDesign, binding: typing, view: 'full', nav: {}}))
  assert.match(full, /class="wt-screen"[^>]*tabindex="0"[^>]*data-driving="true"/, 'the screen takes keys while it drives')
  const still = renderToStaticMarkup(createElement(host.HostedDevice, {designed: terminalDesign, binding: watching, view: 'full', nav: {}}))
  assert.doesNotMatch(still, /data-driving/, 'a watched screen takes no keys')
  host.resetHost()
})

test('this computer\'s own terminal stays a room of its own: the Workbench\'s surface, its Text size, Scrollback and Watch through it', () => {
  const hand = {calls: [], fontSize: px => hand.calls.push(['fontSize', px]), scrollback: lines => hand.calls.push(['scrollback', lines]), watch: on => hand.calls.push(['watch', on])}
  const entry = {reading: {id: 'surface-1', title: 'Terminal', cwd: '/work/o-i', cwdStanding: 'launch-directory', command: null, exited: false, archived: false,
    fontSize: 12, scrollback: 5000, lines: 41, watch: false, attachedAt: 1}, hand}
  const own = tb.terminalBinding(input({rooms: [], locals: [entry], followed: {session: null, words: 'No run is selected.'}, screen: null}))
  assert.equal(own.values.selected, 'terminal:surface-1', 'with no run selected, the newest terminal of your own')
  assert.deepEqual([own.values.provider, own.values.folder, own.values.command, own.values.lines, own.values.watch], ['terminal', '/work/o-i', '', 41, false])
  own.local.fontSize(14); own.local.scrollback(20000); own.local.watch(true)
  assert.deepEqual(hand.calls, [['fontSize', 14], ['scrollback', 20000], ['watch', true]], 'through the surface that holds the lease')
  assert.ok(roomsIn(own).some(room => room.id === 'terminal:surface-1' && room.name === 'This terminal · o-i' && room.lines === undefined), 'its screen unread')
  host.resetHost()
  for (const view of ['compact', 'full']) assert.match(renderToStaticMarkup(createElement(host.HostedDevice, {designed: terminalDesign, binding: own, view, nav: {}})), /No reading: shell/,
    `${view}: the surface publishes no screen, said, not drawn from the design's own shells`)
  host.resetHost()
  assert.equal(tb.terminalBinding(input({rooms: [], locals: []})), null, 'no room and no terminal: no binding, the rail says where one comes from')
})

test('the Terminal draws on its rooms in all five views, never its fixture\'s screens', () => {
  host.resetHost()
  const binding = tb.terminalBinding(input())
  for (const view of ['folded', 'compact', 'whole', 'full', 'widget']) {
    const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: terminalDesign, binding, view, nav: {}}))
    assert.match(markup, new RegExp(`data-device-view="${view}"`))
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /git status -sb|Already up to date|env-1 · fixture-gen/, `${view}: the fixture never stands in`)
  }
  const full = renderToStaticMarkup(createElement(host.HostedDevice, {designed: terminalDesign, binding, view: 'full', nav: {}}))
  assert.match(full, /follows.*b749-room.*Fizz.*tmux/s, 'the bar: follows, the room, the agent, the provider')
  assert.match(full, /hello-from-the-room/)
  host.resetHost()
})
