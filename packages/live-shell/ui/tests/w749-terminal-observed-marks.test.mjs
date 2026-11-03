// O-I #749 lane AV, the Terminal's marks from what harnesses ran in a room's pane (DLW §17.9): AIKit's observer hook names the terminal
// pane a harness runs in (TMUX_PANE on its server, HERDR_PANE_ID on its socket, cmux's surface) with each command it observes, and the
// room's capture carries the commands kept for its own pane (`observed`, `aikit session-space working-surface capture`). A line is the
// agent's where a harness ran that command in the room's pane as the agent's, at a prompt or in a harness's own tool-call line
// (`Bash(…)`); a person's or an unnamed run marks nothing; AQ's journal marks stay.
// Channels:
// - OWNER-SHAPED: tests/fixtures/av-749/capture-*.json are `aikit session-space working-surface capture` as lane AV's AIKit printed it on a
//   scratch home (30 Oct): a tmux room on a private socket and a herdr room in a private herdr session, where a stand-in harness drew its
//   shell tool's call as Claude Code draws one (`⏺ Bash(…)`), ran it in its own process and handed the PostToolUse event to AIKit's shipped
//   observe-runs hook from inside the pane (keys typed straight to tmux and herdr, past AIKit); beside it a person's keys and an agent's
//   keys through `working-surface input`. Wrapped in the kernel's oi.working-surface-reading/v1 envelope (kernel working_surface.rs read
//   passes AIKit's document through whole).
// - SCRIPTED: owner documents written to the capture's shape here; the hands recorded, never sent.
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

const plan = name => ({name, views: [{id: 'main', steps: [{pane: 'shell', command: ['env', 'HISTFILE=/dev/null', 'PS1=$ ', 'sh']}]}]})
const ROOM = 'working-surface/av-walk-tmux'
const SPACE = {definition: {id: 'session-space/av-walk'}, working_surfaces: {
  [ROOM]: {binding: ROOM, surface: 'surface/terminal/main/shell', agent_session: 'agent-session/av-walk-tmux', provider: 'provider/tmux/current',
    plan: plan('av-walk-tmux'), plan_key: 'main/shell'}}}
SPACE.working_surfaces['working-surface/av-walk-herdr'] = {binding: 'working-surface/av-walk-herdr', surface: 'surface/terminal/main/shell',
  agent_session: 'agent-session/av-walk-herdr', provider: 'provider/herdr/current', plan: plan('av-walk-herdr'), plan_key: 'main/shell'}
const ROWS = [{spaceRef: 'session-space/av-walk', sessionRef: 'agent-session/av-walk-tmux', project: '', raw: SPACE}]
const TRACKS = [{sessionRef: 'agent-session/av-walk-tmux', agentName: 'Fizz'}, {sessionRef: 'agent-session/av-walk-herdr', agentName: 'Honey'}]
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/av-749/${name}`, import.meta.url), 'utf8'))
const WALK_TMUX = fixture('capture-tmux.json'), WALK_HERDR = fixture('capture-herdr.json')
const document = (text, observed, inputs = []) => ({schema: 'oi.working-surface-reading/v1', capture: {
  schema: 'aikit.session-space-working-surface-capture/v1', binding: ROOM, provider: 'provider/tmux/current',
  capture: {state: 'captured', native_id: '%0', format: 'ansi', text, truncated: false, pane: 'tmux:%0@/private/tmp/tmux-501/av-walk,4242'},
  input: {state: 'accepts'}, inputs, observed}})
const SCREEN = ['$ make lane-av-proof', 'proof made', '$ ls -la', 'total 0', '⏺ Bash(cargo test --workspace)', '  ⎿  ok', '$ echo by-the-person', 'by-the-person', '$'].join('\n')
const OBSERVED = [
  {command: 'make lane-av-proof', by: 'agent-session/av-walk-tmux', at_unix_ms: 1},
  {command: 'ls -la', by: 'agent-session/av-walk-tmux', at_unix_ms: 2, exit_code: 0},
  {command: 'cargo test --workspace', by: 'agent-session/av-walk-tmux', at_unix_ms: 3},
  {command: 'echo by-the-person', by: 'human', at_unix_ms: 4},
]
function hands() {
  const calls = []
  return {calls, hold: (key, value) => calls.push(['hold', key, value]), keys: async (room, data) => { calls.push(['keys', room.id, data]) }}
}
const input = (screen, session = 'agent-session/av-walk-tmux') => ({rooms: tb.sessionRoomsOf(ROWS, TRACKS), locals: [], followed: {session, words: null},
  holds: {}, screen, hands: hands()})
const shownLines = binding => JSON.parse(binding.values.rooms).find(room => room.id === binding.values.selected).lines

test('the room\'s screen carries what harnesses ran in its pane, from the owner\'s document', () => {
  const screen = tb.roomScreenOf(ROOM, document(SCREEN, OBSERVED))
  assert.deepEqual(screen.observed.map(run => [run.by, run.command]), OBSERVED.map(run => [run.by, run.command]))
  assert.equal(tb.roomScreenOf(ROOM, document(SCREEN, undefined)).observed, undefined, 'an owner that keeps none reports none')
  const odd = tb.roomScreenOf(ROOM, document(SCREEN, [{command: 'x'}, {by: 'agent-session/a'}, 'junk', {by: 'agent-session/a', command: 'make'}]))
  assert.deepEqual(odd.observed, [{by: 'agent-session/a', command: 'make'}], 'only a run with a command and its runner stands')
})

test('a command a harness ran in the room\'s pane marks its line as the agent\'s, at a prompt or in the harness\'s tool-call line', () => {
  const lines = shownLines(tb.terminalBinding(input(tb.roomScreenOf(ROOM, document(SCREEN, OBSERVED)))))
  assert.deepEqual(lines.filter(l => l.by === 'agent').map(l => l.t), ['$ make lane-av-proof', '$ ls -la', '⏺ Bash(cargo test --workspace)'])
  assert.equal(lines.find(l => l.t === '$ echo by-the-person').by, undefined, 'the person\'s run stays the person\'s')
  // Without the observer's records the same screen carries no mark: nothing is read from the text alone.
  const bare = shownLines(tb.terminalBinding(input(tb.roomScreenOf(ROOM, document(SCREEN, undefined)))))
  assert.ok(bare.every(l => l.by === undefined))
  // A multi-line command marks the line it starts on; a run nobody named marks nothing.
  assert.deepEqual(tb.markedLines(['$ cat <<EOF', '> a', '> EOF', '$ whoami', 'me'], [], undefined,
    [{by: 'agent-session/a', command: 'cat <<EOF\na\nEOF'}, {by: 'unknown', command: 'whoami'}]).map(l => l.by ?? '-'), ['agent', '-', '-', '-', '-'])
  // A harness that wraps its tool-call line indents what it wraps.
  assert.deepEqual(tb.markedLines(['⏺ Bash(cargo test --workspace --all-features -- --sk', '      ip keychain)', '  ⎿  ok'], [], undefined,
    [{by: 'agent-session/a', command: 'cargo test --workspace --all-features -- --skip keychain'}]).map(l => l.by ?? '-'), ['agent', '-', '-'])
  // AQ's journal marks stay: a command AIKit delivered as the agent's marks its line beside the observed ones.
  const both = tb.markedLines(['$ git status', 'clean', '$ make lane-av-proof', '$'], [{by: 'agent-session/a', text: 'git status\r'}], undefined,
    [{by: 'agent-session/a', command: 'make lane-av-proof'}])
  assert.deepEqual(both.map(l => l.by ?? '-'), ['agent', '-', 'agent', '-'])
})

test('walked: in a private tmux room and a private herdr room, the commands a harness ran in the pane carry the agent\'s mark; the person\'s do not', () => {
  const tmux = tb.roomScreenOf(ROOM, WALK_TMUX)
  assert.match(WALK_TMUX.capture.capture.pane, /^tmux:%0@\/private\/tmp\/tmux-501\/av-walk,\d+$/, 'the pane by its server, as the hook named it')
  assert.deepEqual(tmux.observed.map(run => run.command), ['git --version', 'ls /private/tmp/claude-501/avw/room'])
  const tmuxLines = shownLines(tb.terminalBinding(input(tmux)))
  assert.deepEqual(tmuxLines.filter(l => l.by === 'agent').map(l => l.t), ['⏺ Bash(git --version)', '⏺ Bash(ls /private/tmp/claude-501/avw/room)', '$ pwd'],
    'the harness\'s two tool calls (observed) and the agent\'s keys through AIKit (the journal)')
  assert.equal(tmuxLines.find(l => l.t === '$ echo typed-by-the-person').by, undefined)
  assert.ok(tmuxLines.filter(l => l.t.includes('harness.sh')).every(l => l.by === undefined), 'keys typed straight to tmux are no one\'s record')
  const herdr = tb.roomScreenOf('working-surface/av-walk-herdr', WALK_HERDR)
  assert.match(WALK_HERDR.capture.capture.pane, /^herdr:w1:p1@\/private\/tmp\/claude-501\/avh\/.*\/herdr\.sock$/)
  const herdrLines = shownLines(tb.terminalBinding(input(herdr, 'agent-session/av-walk-herdr')))
  assert.deepEqual(herdrLines.filter(l => l.by === 'agent').map(l => l.t), ['⏺ Bash(git --version)', '⏺ Bash(make --version)'])
  assert.equal(herdrLines.find(l => l.t === '$echo typed-by-the-person').by, undefined)
  host.resetHost()
  const full = renderToStaticMarkup(createElement(host.HostedDevice, {designed: terminalDesign, binding: tb.terminalBinding(input(herdr, 'agent-session/av-walk-herdr')), view: 'full', nav: {}}))
  assert.match(full, /<div>Honey<\/div>/, 'the gutter names the agent by its commands')
  host.resetHost()
})
