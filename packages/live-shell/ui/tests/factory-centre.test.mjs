import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {readFile, readdir} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The Factory centre after F3's removal clause (FOUNDATION §7): one Session and one Arrangement, the shared tracks pane's. The
// agent tab is the thread and only the thread; the retired AgentSessionGrid and AgentArrangementView are gone. Production
// modules in memory, the mode-surface-fidelity loader pattern (`import.meta.env`, Vite's, is stood in for as the atlas suites do).
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

// The build's define, as the other suites that load the shared agent layer set it (tests/f8-widgets.test.mjs).
globalThis.__CRADLE_WALK__ = false

const {AgentThreadView, threadTrackOf} = await import('../src/agent/AgentThreadView.tsx')
const {AgentShellCentre} = await import('../src/agent/AgentShellRoot.tsx')
const {AgentShellProvider} = await import('../src/agent/AgentShellContext.tsx')
const {StubWorkspaceProvider} = await import('../src/shell/workspaceContext.tsx')
const {buildTracks, trackKey} = await import('../src/agent/agentRunModel.ts')

const src = new URL('../src/', import.meta.url)
const read = path => readFile(new URL(path, src), 'utf8')

// Two spaces: a crew of two sessions (one with a named agent) and a lone session.
const ROWS = [
  {spaceRef: 'space/alpha', spaceLabel: 'Alpha crew', sessionRef: 'sess-a1', purpose: 'Lead the port', agentRef: 'agent/fizz'},
  {spaceRef: 'space/alpha', spaceLabel: 'Alpha crew', sessionRef: 'sess-a2', purpose: 'Check the cites', agentRef: undefined},
  {spaceRef: 'space/beta', spaceLabel: 'Beta', sessionRef: 'sess-b1', purpose: 'Idle work', agentRef: undefined},
]
const ROSTER = new Map([['agent/fizz', {name: 'Fizz', accepted: true}]])
const tracks = buildTracks(ROWS, ROSTER)
const byRef = ref => tracks.find(track => track.sessionRef === ref)

test('the thread follows THE selection: a session, or the session of a task selected in the Session pane', () => {
  assert.equal(threadTrackOf(tracks, trackKey(byRef('sess-a2')), null), byRef('sess-a2'))
  // A task clip's selection resolves to its session's track key before it reaches here (AgentShellContext.sessionOfSelection).
  assert.equal(threadTrackOf(tracks, trackKey(byRef('sess-b1')), trackKey(byRef('sess-a1'))), byRef('sess-b1'), 'the selection wins over a session `openThread` once named: the thread follows the Session pane')
})

test('with nothing selected the session `openThread` named stands in, else the first session', () => {
  assert.equal(threadTrackOf(tracks, null, trackKey(byRef('sess-b1'))), byRef('sess-b1'))
  assert.equal(threadTrackOf(tracks, null, null), byRef('sess-a1'), 'the first session, not the first group')
  assert.equal(threadTrackOf(tracks, 'space/gone:sess-gone', null), byRef('sess-a1'), 'a selection the reading does not hold falls through')
  assert.equal(threadTrackOf([], null, null), undefined)
})

test('a group is not a conversation: its thread is its lead\'s, the first member with a named agent, else its first member', () => {
  const alpha = tracks.find(track => track.group && track.spaceRef === 'space/alpha')
  assert.equal(threadTrackOf(tracks, trackKey(alpha), null), byRef('sess-a1'), 'the member with the named agent leads')
  const beta = tracks.find(track => track.group && track.spaceRef === 'space/beta')
  assert.equal(threadTrackOf(tracks, trackKey(beta), null), byRef('sess-b1'), 'else the first member')
  const crewless = tracks.filter(track => track.group && track.spaceRef === 'space/beta')
  assert.equal(threadTrackOf(crewless, trackKey(beta), null), undefined, 'a group with no member has no thread')
})

const UNAVAILABLE = {kind: 'unavailable', reason: 'kernel not attached — test'}
const rendered = body => renderToStaticMarkup(createElement(StubWorkspaceProvider, {transport: UNAVAILABLE}, createElement(AgentShellProvider, null, body)))

test('with no session to follow the tab says where its thread comes from, in the Session pane\'s words, not the retired grid\'s', () => {
  const html = rendered(createElement(AgentThreadView, {tracks: []}))
  assert.match(html, /Select a session or a task in the Session pane to open its thread\./)
  assert.doesNotMatch(html, /Double-click/, 'the double-click that opened a thread belonged to the retired grid')
})

test('the tab body over an unavailable transport discloses it and draws no Session, no Arrangement and no track', () => {
  const html = rendered(createElement(AgentShellCentre))
  assert.match(html, /Native transport unavailable/)
  assert.match(html, /kernel not attached — test/, 'the reason is on the card, never swallowed')
  for (const retired of ['agent-track', 'agent-slot', 'agent-arr', 'session-scroll', 'aria-label="Time ruler"', 'agent-stoprow', 'agent-strip']) {
    assert.ok(!html.includes(retired), `${retired} is gone from the agent tab: the Session and the Arrangement are the tracks pane's`)
  }
})

test('the retired views are deleted, and nothing the candidate reaches imports them', async () => {
  for (const name of ['agent/AgentSessionGrid.tsx', 'agent/AgentArrangementView.tsx']) {
    assert.ok(!existsSync(new URL(name, src)), `${name} is deleted (FOUNDATION F3, §7)`)
  }
  const {reachable, repo} = await import('../scripts/candidate-reachable.mjs')
  const offenders = []
  for (const file of reachable()) {
    if (!file.startsWith(new URL('.', src).pathname)) continue
    const text = await readFile(file, 'utf8')
    if (/\bAgentSessionGrid\b|\bAgentArrangementView\b/.test(text.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ''))) offenders.push(file.slice(repo.length + 1))
  }
  assert.deepEqual(offenders, [], 'no product file mounts a second Session or Arrangement')
})

test('the agent tab body holds the thread only: it reads no centre view, no harness control, and mounts no grid or ruler', async () => {
  const root = await read('agent/AgentShellRoot.tsx')
  const thread = await read('agent/AgentThreadView.tsx')
  for (const [name, text] of [['AgentShellRoot', root], ['AgentThreadView', thread]]) {
    const code = text.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')
    assert.doesNotMatch(code, /centreView|setCentreView/, `${name} does not read the shell's centreView: the tab has one view`)
    assert.doesNotMatch(code, /harnessAgentControl|useHarnessBinding|controlNote/, `${name} runs no owner control: stop and retry are the tracks pane's actions (timeline/factoryTrackAdapter.ts)`)
    assert.doesNotMatch(code, /AgentSessionGrid|AgentArrangementView|SessionGrid|ArrangementRuler/, `${name} mounts no Session or Arrangement`)
  }
  assert.match(root, /<AgentThreadView tracks=\{tracks\} \/>/, 'the body is the thread')
})

test('the one Session and one Arrangement are the tracks pane\'s: the Factory tree is seeded with it, and its tracks are the agency store\'s', async () => {
  const centre = await read('agent/factoryCentre.ts')
  assert.match(centre, /FACTORY_TRACKS_KIND = 'projection\.timeline'/, 'the Session pane is the one tracks pane kind')
  const frames = await read('shell/modeFrames.ts')
  assert.match(frames, /factory: seedFactoryCentre,/, 'the Factory seed is the mode table\'s')
  // Ticket K: the World cut modes' registrations are wrapped by `worldCut` (useWorldCut.ts), which adds the spine's readings.
  assert.match(await read('frame/tracks/modeTracks.ts'), /factory: worldCut\(useFactoryTracks\)/, 'Factory\'s tracks are its registration of the one pane')
  const tracksHook = await read('frame/tracks/useFactoryTracks.ts')
  assert.match(tracksHook, /useAgencySessions\(transport\)/, 'the sessions are the agency store\'s one poll')
  assert.match(tracksHook, /harnessAgentControl\(transport, harness\.binding, control\)/, 'stop and retry reach the one owner path the grid\'s buttons used')
})

test('no stylesheet rule styles a retired view: the agent tab\'s CSS holds the thread body only', async () => {
  const css = await read('agent/agentShell.css')
  for (const retired of ['.agent-track', '.agent-slot', '.agent-arr ', '.agent-stoprow', '.agent-strip', '.agent-rails', '.session-scroll', '@keyframes agent-blink']) {
    assert.ok(!css.includes(retired), `${retired} is retired with its view`)
  }
  assert.match(css, /\.agent-shell-centre \{[^}]*flex-direction:column/, 'the tab body stacks its refusals above the thread')
  assert.match(css, /\.agent-thread \{[^}]*flex:1 1 0/, 'the thread fills what the refusals leave')
  // The agent directory holds no source file the retired views left behind.
  const names = await readdir(new URL('agent/', src))
  assert.ok(!names.some(name => /^Agent(SessionGrid|ArrangementView)/.test(name)))
})
