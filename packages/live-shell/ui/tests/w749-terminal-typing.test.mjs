// O-I #749 lane AQ, the Terminal's room work (DLW §17.9): typing into a room through AIKit's working-surface owner, the agent's marks
// (`by: agent`, `ask`) from what the owner records, and the capture read from the owner's document.
//   - Input: an agent's run is watched until you choose Type; your keys then go to the room through AIKit's own `working-surface
//     input` (kernel op working_surface_input), only while the owner says the room takes keys; Watch only stops them; a room whose
//     owner takes no keys says why; the choice to type is not kept across a reopen.
//   - Marks: a command line is the agent's when AIKit delivered it as the agent's (the capture's `inputs`, the working-surface input
//     journal); a person's keys are kept by count only and mark nothing; a line waits for an answer when the provider reports the
//     room's agent `blocked` (Herdr's lifecycle).
// Channels:
// - OWNER-SHAPED: tests/fixtures/aq-749/capture-*.json are `aikit session-space working-surface capture` as lane AQ's AIKit printed it
//   on a scratch home (30 Oct): a tmux room on a private socket and a herdr room in a private herdr session, after an agent's and a
//   person's input through `working-surface input`, and `herdr pane report-agent … --state blocked`; the herdr prompt's host name
//   trimmed. Wrapped in the kernel's oi.working-surface-reading/v1 envelope (kernel working_surface.rs read).
// - SCRIPTED: the hands (holds, keys) recorded, never sent; the designs drawn through the host.
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
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/aq-749/${name}`, import.meta.url), 'utf8'))
const TMUX = fixture('capture-tmux.json'), HERDR = fixture('capture-herdr.json')

const plan = name => ({name, views: [{id: 'main', steps: [{pane: 'shell', command: ['env', 'HISTFILE=/dev/null', 'PS1=$ ', 'sh']}]}]})
const SPACE = {definition: {id: 'session-space/aq-walk'}, working_surfaces: {
  'working-surface/aq-walk-tmux': {binding: 'working-surface/aq-walk-tmux', surface: 'surface/terminal/main/shell', agent_session: 'agent-session/aq-walk-tmux',
    provider: 'provider/tmux/current', plan: plan('aq-walk-tmux'), plan_key: 'main/shell'},
  'working-surface/aq-walk-herdr': {binding: 'working-surface/aq-walk-herdr', surface: 'surface/terminal/main/shell', agent_session: 'agent-session/aq-walk-herdr',
    provider: 'provider/herdr/current', plan: plan('aq-walk-herdr'), plan_key: 'main/shell'}}}
const ROWS = [{spaceRef: 'session-space/aq-walk', sessionRef: 'agent-session/aq-walk-tmux', project: '', raw: SPACE}]
const TRACKS = [{sessionRef: 'agent-session/aq-walk-tmux', agentName: 'Fizz'}, {sessionRef: 'agent-session/aq-walk-herdr', agentName: 'Honey'}]
const TMUX_ROOM = 'working-surface/aq-walk-tmux', HERDR_ROOM = 'working-surface/aq-walk-herdr'

function hands() {
  const calls = []
  return {calls, hold: (key, value) => calls.push(['hold', key, value]), keys: async (room, data) => { calls.push(['keys', room.id, data]) }}
}
function input(over = {}) {
  return {rooms: tb.sessionRoomsOf(ROWS, TRACKS), locals: [], followed: {session: 'agent-session/aq-walk-tmux', words: null}, holds: {},
    screen: tb.roomScreenOf(TMUX_ROOM, TMUX), hands: hands(), ...over}
}
const shownLines = binding => JSON.parse(binding.values.rooms).find(room => room.id === (binding.values.shell ?? binding.values.selected)).lines

test('the room\'s screen is read from the owner\'s document: its text, whether it takes keys, who sent what reached it, its agent\'s state', () => {
  const tmux = tb.roomScreenOf(TMUX_ROOM, TMUX)
  assert.equal(tmux.room, TMUX_ROOM)
  assert.deepEqual(tmux.lines.slice(0, 1), ['$ git -C /Users/admin/Central/worktrees/env-3/ai-kit log --oneline -1'], 'the escapes out')
  assert.deepEqual(tmux.input, {accepts: true})
  assert.deepEqual(tmux.inputs.map(i => [i.by, i.text ?? null]), [['agent-session/aq-walk-tmux', 'git -C /Users/admin/Central/worktrees/env-3/ai-kit log --oneline -1\r'], ['human', null]],
    'the agent\'s text is kept; the person\'s keys by count only')
  assert.equal(tmux.agentState, undefined, 'tmux reports no agent: none is invented')
  const herdr = tb.roomScreenOf(HERDR_ROOM, HERDR)
  assert.equal(herdr.agentState, 'blocked')
  assert.equal(herdr.lines.at(-1), 'remove /private/tmp/claude-501/aqw/room/scratch.txt? ', 'as the provider printed it')
  const refused = tb.roomScreenOf(TMUX_ROOM, {...TMUX, capture: {...TMUX.capture, capture: {state: 'unavailable', reason: 'cmux names the panes AIKit owns by AIKit\'s durable session id'}}}, ['kept'])
  assert.deepEqual([refused.lines, refused.refused], [['kept'], 'cmux names the panes AIKit owns by AIKit\'s durable session id'], 'the last lines stay with the owner\'s words')
  const closed = tb.roomScreenOf(TMUX_ROOM, {...TMUX, capture: {...TMUX.capture, input: {state: 'not-exposed', reason: 'provider/cmux/current: AIKit sends no keys to a cmux surface; type in cmux itself'}}})
  assert.deepEqual(closed.input, {accepts: false, reason: 'provider/cmux/current: AIKit sends no keys to a cmux surface; type in cmux itself'})
})

test('an agent\'s commands are what AIKit delivered as the agent\'s, edited as a terminal edits a line; a person\'s keys name none', () => {
  assert.deepEqual(tb.commandsOf([
    {by: 'agent-session/a', text: 'git status\r'},
    {by: 'human', bytes: 7},
    {by: 'agent-session/a', text: 'ls -lx\x7f\r'},
    {by: 'agent-session/b', text: 'npm te'}, {by: 'agent-session/b', text: 'st\x1b[D\r'},
    {by: 'agent-session/a', text: 'oops\x15pwd\n'},
    {by: 'unknown', text: 'whoami\r'},
    {by: 'agent-session/a', text: 'half a line'},
  ]), [{by: 'agent-session/a', command: 'git status'}, {by: 'agent-session/a', command: 'ls -l'}, {by: 'agent-session/b', command: 'npm test'},
    {by: 'agent-session/a', command: 'pwd'}], 'Backspace and Control-U edit the line; an escape is not text; an unsent line and an unnamed sender are no command')
})

test('the shown room marks the agent\'s command lines as the agent\'s, a wrapped one at its first line, and the line that waits for an answer', () => {
  const tmux = shownLines(tb.terminalBinding(input()))
  assert.deepEqual(tmux.filter(l => l.by === 'agent').map(l => l.t), ['$ git -C /Users/admin/Central/worktrees/env-3/ai-kit log --oneline -1'])
  assert.equal(tmux.find(l => l.t === '$ echo typed-by-the-person').by, undefined, 'the person\'s command stays the person\'s')
  assert.ok(tmux.every(l => !l.ask), 'no provider reports a waiting agent: nothing waits')
  const herdr = shownLines(tb.terminalBinding(input({followed: {session: 'agent-session/aq-walk-herdr', words: null}, screen: tb.roomScreenOf(HERDR_ROOM, HERDR)})))
  assert.deepEqual(herdr.filter(l => l.by === 'agent').map(l => l.t), ['$rm -i /private/tmp/claude-501/aqw/room/scratch.txt',
    '$touch /private/tmp/claude-501/aqw/room/scratch.txt; rm -i /private/tmp/claude-501/aqw/room/s'])
  assert.deepEqual(herdr.filter(l => l.ask).map(l => l.t), ['remove /private/tmp/claude-501/aqw/room/scratch.txt? '], 'Herdr reports the agent blocked: its last line waits')
  // A command the agent sent twice marks two lines, the newest, never more than it sent: the person's keys, kept by count only, name no line.
  assert.deepEqual(tb.markedLines(['$ ls', 'a', '$ ls', 'a', '$ ls', 'a', '$'], [{by: 'agent-session/a', text: 'ls\r'}, {by: 'agent-session/a', text: 'ls\r'}, {by: 'human', bytes: 3}], undefined)
    .map(l => l.by ?? '-'), ['-', '-', 'agent', '-', 'agent', '-', '-'])
  host.resetHost()
  const full = renderToStaticMarkup(createElement(host.HostedDevice, {designed: terminalDesign, binding: tb.terminalBinding(input({followed: {session: 'agent-session/aq-walk-herdr', words: null},
    screen: tb.roomScreenOf(HERDR_ROOM, HERDR)})), view: 'full', nav: {}}))
  assert.match(full, /<div>Honey<\/div>/, 'the gutter names the agent by its commands')
  assert.match(full, /waits for an answer/)
  host.resetHost()
})

test('keys reach the room only when you choose Type, through AIKit\'s working-surface input, while its owner says the room takes keys', () => {
  const h = hands()
  const watching = tb.terminalBinding(input({hands: h}))
  assert.deepEqual([watching.values.watch, watching.values.driving], [true, false], 'an agent\'s run is watched until you choose to type')
  watching.local.keys('ls\r')
  assert.deepEqual(h.calls, [], 'no key reaches a room you only watch')
  watching.local.watch(false)
  assert.deepEqual(h.calls, [['hold', 'typing', TMUX_ROOM]], 'Type is the Terminal\'s choice for this room')
  const typing = tb.terminalBinding(input({hands: h, holds: {typing: TMUX_ROOM}}))
  assert.deepEqual([typing.values.watch, typing.values.driving], [false, true])
  typing.local.keys('ls\r')
  typing.local.watch(true)
  assert.deepEqual(h.calls.slice(1), [['keys', TMUX_ROOM, 'ls\r'], ['hold', 'typing', undefined]], 'keys go to the room; Watch only stops them')
  // Typing chosen for another room: this one is watched.
  const elsewhere = tb.terminalBinding(input({holds: {typing: HERDR_ROOM}}))
  assert.deepEqual([elsewhere.values.watch, elsewhere.values.driving], [true, false])
  // A room whose owner takes no keys: Input says why, and nothing is sent.
  const closedHands = hands()
  const closed = tb.terminalBinding(input({hands: closedHands, holds: {typing: TMUX_ROOM}, screen: {...tb.roomScreenOf(TMUX_ROOM, TMUX), input: {accepts: false, reason: 'provider/cmux/current: AIKit sends no keys to a cmux surface; type in cmux itself'}}}))
  assert.equal(closed.standing.watch.disabled, 'Input: provider/cmux/current: AIKit sends no keys to a cmux surface; type in cmux itself')
  assert.equal(closed.values.driving, false)
  closed.local.keys('ls\r')
  assert.deepEqual(closedHands.calls, [])
  // A provider that does not answer takes no keys either.
  const quiet = tb.terminalBinding(input({holds: {typing: TMUX_ROOM}, screen: {...tb.roomScreenOf(TMUX_ROOM, TMUX), refused: 'mux.tmux_surface_not_live'}}))
  assert.equal(quiet.values.driving, false)
  // The choice to type is not kept across a reopen.
  assert.deepEqual(tb.holdsFrom(JSON.stringify({follow: false, shell: TMUX_ROOM, typing: TMUX_ROOM})), {follow: false, shell: TMUX_ROOM})
  host.resetHost()
  const full = renderToStaticMarkup(createElement(host.HostedDevice, {designed: terminalDesign, binding: typing, view: 'full', nav: {}}))
  assert.match(full, /class="wt-screen"[^>]*tabindex="0"[^>]*data-driving="true"/, 'the screen takes keys while it drives')
  host.resetHost()
})

test('the publisher sends keys through the kernel\'s working_surface_input and reads the owner\'s document whole; no takeover lease remains', () => {
  const publisher = read('widgets/railDevices.tsx')
  assert.match(publisher, /op: 'working_surface_input', project: target\.project, agent_session: target\.session, binding: target\.id, text: next\.data/)
  assert.match(publisher, /roomScreenOf\(shown\.id, result\.outcome\.document, kept\)/)
  assert.doesNotMatch(publisher, /workingSurfaceClient|takeover/, 'keys no longer take the native takeover lease')
})
