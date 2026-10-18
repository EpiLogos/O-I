// The browser's rows at the mockup's floor in every mode (world-shell-mockup.html bi() :1478 — mark · .nm name · .st standing;
// renderBrowser() :1479–1500). Channels: SSR — the production row bodies rendered to markup over FIXTURE listings shaped as
// the owners answer (files_list entries from the dev walk-bridge's Control/agents/now/day and Control/user/flows on 15 Oct;
// agency rows; the retained app's works); CODE-READING where a body reads its owner in an effect SSR does not run (the Files
// rows). NOT a screen pass: every row as drawn in the window is the lead's computer-use leg (UNVERIFIED here).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

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

const {ModeBrowser, DayRowList, NowSection, FlowRowList, NewForms, formOpenerId} = await import('../src/shell/ModeBrowser.tsx')
const {Workspace, StubWorkspaceProvider} = await import('../src/shell/workspaceContext.tsx')
const {AgentShellProvider} = await import('../src/agent/AgentShellContext.tsx')
const agentBrowser = await import('../src/agent/AgentShellBrowser.tsx')
const {CollectionList, appCollectionItems} = await import('../src/components/NativeExpressionCollections.tsx')
const {collectionSections} = await import('../src/components/nativeExpressionCommands.ts')
const {BrowserPane} = await import('../src/components/BrowserPane.tsx')
const words = await import('../src/frame/browser/rowWords.ts')

const html = element => renderToStaticMarkup(element)
const read = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const UNAVAILABLE = {kind: 'unavailable', reason: 'test'}
const location = path => ({schema: 'central.path-ref/v1', ref: `central:path:/Users/admin/Central:${path}`, root: '/Users/admin/Central', path})
const file = (path, byteLen) => ({name: path.split('/').pop(), kind: 'file', byte_len: byteLen, location: location(path), retrieval_allowed: true})
/** A row's three cells as drawn: the name span and the standing span of each `.mode-browser-row`. */
const cells = markup => [...markup.matchAll(/class="mode-browser-row[^"]*"[^>]*>(?:(?!<\/(?:button|div)>).)*?<span>([^<]*)<\/span><span class="mode-browser-row-meta[^"]*">([^<]*)<\/span>/g)]
  .map(match => [match[1], match[2]])

// ── Central · Days and the NOW section ──────────────────────────────────────────────────────────────

test('Days: each row is the day\'s mark, the day in words and the owner\'s standing — never a byte count', () => {
  // FIXTURE: the dev walk-bridge's files_list at Control/agents/now/day (15 Oct), newest first, with the owner's day_read answers.
  const days = [file('Control/agents/now/day/2026-09-12.md', 2988), file('Control/agents/now/day/2026-09-11.md', 28462), file('Control/agents/now/day/2026-09-06.md', 1376)]
  const standings = new Map([
    ['2026-09-12', {state: 'read', lifecycle: 'closed', document: 'uninitialised', revision: 'central.content-fnv1a64/v1:0:cbf29ce484222325', today: false}],
    ['2026-09-06', {state: 'refused', message: 'Central owner Action refused: DayRef is not recorded in this World'}],
  ])
  const markup = html(createElement(DayRowList, {days, standings, selectedSubject: null, onSelectSubject: () => {}, openDay: () => {}, openFault: null}))
  assert.deepEqual(cells(markup), [['Sat 12 Sep', 'closed'], ['Fri 11 Sep', ''], ['Sun 06 Sep', '—']],
    'the day in words; its lifecycle where the owner read it; nothing while unread; — where it refused')
  assert.doesNotMatch(markup, /\d+ B</, 'no byte count stands on a row')
  assert.match(markup, /title="Control\/agents\/now\/day\/2026-09-12\.md · 2\.9 KB — select the day/, 'the path and size are hover words')
  assert.match(markup, /DayRef is not recorded in this World/, 'a refusal is said in the hover, verbatim')
  assert.match(markup, /data-i="Sat 12 Sep \(2026-09-12\)\|select the day/, 'the row states what it does')
  assert.equal((markup.match(/data-browser-row/g) ?? []).length, 3, 'every day joins the arrow-key walk')
  assert.equal((markup.match(/<svg/g) ?? []).length, 3, 'each row wears the cut\'s day mark')
  const selected = html(createElement(DayRowList, {days, standings, selectedSubject: {kind: 'day', path: 'Control/agents/now/day/2026-09-11.md'},
    onSelectSubject: () => {}, openDay: () => {}, openFault: 'refused: no pane'}))
  assert.match(selected, /class="mode-browser-row selected"[^>]*data-day="2026-09-11"/, 'the selected day is marked')
  assert.match(selected, /data-open-fault="true">refused: no pane</, 'an open refusal is said by the rows')
})

test('the NOW section: the machines sessions run on and what runs there; absent when nothing places a session', () => {
  const rows = words.nowRows([{host: 'host/localhost', agent: 'Fizz', state: 'running'}, {host: 'host/omarchy', agent: null, state: 'idle'}], 'workcell:mac')
  const markup = html(createElement(NowSection, {rows}))
  assert.match(markup, /class="mode-browser-sep"><span>NOW<\/span>/, 'the mockup\'s NOW separator')
  assert.deepEqual(cells(markup), [['mac', 'live · Fizz'], ['omarchy', 'quiet']])
  assert.doesNotMatch(markup, /<button/, 'a machine is read, not pressed')
  assert.equal(html(createElement(NowSection, {rows: []})), '', 'no reading places a session: no section')
})

test('code-reading: the Days rows read the owner\'s Day reading once per listing, and the NOW section reads what the shell holds', async () => {
  const source = await read('shell/ModeBrowser.tsx')
  const days = source.slice(source.indexOf('function DaysRows'), source.indexOf('export function DayRowList'))
  assert.match(days, /useRowReadings<DayStanding>\(transport, dates, date => dayRead\(transport, dayRefOfDate\(date\)\)\.then\(dayStandingOf,/,
    'day_read for each listed day, by the root register\'s day ref')
  assert.match(days, /<NowSection rows=\{now\} \/>/)
  const now = source.slice(source.indexOf('function useNowRows'), source.indexOf('export function NowSection'))
  assert.match(now, /useAgentSessionsOptional\(\)/, 'the one agent-sessions provider, no new read')
  assert.match(now, /config\?\.world_scope\?\.workcell_ref/, 'the World scope names this machine')
  const readings = source.slice(source.indexOf('function useRowReadings'), source.indexOf('/** The Days rows'))
  assert.match(readings, /for \(const key of keys\) \{\n\s+const reading = await read\(key\)/, 'one at a time, so the carrier never sees a pile')
  assert.doesNotMatch(readings, /setInterval|setTimeout/, 'read once per listing, never polled')
})

// ── Central · Flows ─────────────────────────────────────────────────────────────────────────────────

test('Flows: each Flow by its own title, its agents and revision; a Flow with no title by its file name', () => {
  // FIXTURE: Control/user/flows as listed on 15 Oct, with each file's own meta.
  const flows = [file('Control/user/flows/flow-2026-10-07-1343.html', 79872), file('Control/user/flows/flow-2026-10-03-1432.html', 95232),
    file('Control/user/flows/epi-card-2026-09-24-1250.html', 30720)]
  const readings = new Map([
    [flows[0].location.ref, words.flowReadingOf({meta: {title: '', revision: 0, participants: [{kind: 'person'}]}})],
    [flows[1].location.ref, words.flowReadingOf({meta: {title: 'Factory original development Run — execution and continuation', revision: 8,
      participants: [{initial: 'C', name: 'Factory coordinator', kind: 'agent'}]}})],
    [flows[2].location.ref, {state: 'refused', message: 'This file is not a 0/1 dialogue/flow document — its embedded document state is missing.'}],
  ])
  const markup = html(createElement(FlowRowList, {flows, readings, selectedSubject: null, onSelectSubject: () => {}, openFile: () => {}, openFault: null}))
  assert.deepEqual(cells(markup), [['flow-2026-10-07-1343', 'r0'],
    ['Factory original development Run — execution and continuation', 'with Factory coordinator · r8'], ['epi-card-2026-09-24-1250', '—']])
  assert.doesNotMatch(markup, /\d+ B</)
  assert.match(markup, /title="Control\/user\/flows\/flow-2026-10-03-1432\.html · 93\.0 KB — flow-2026-10-03-1432\.html — titled/)
  assert.equal((markup.match(/data-browser-row/g) ?? []).length, 3)
})

test('code-reading: a Flow row previews on select and opens on double-click or Enter, through the Central opener', async () => {
  const source = await read('shell/ModeBrowser.tsx')
  const flows = source.slice(source.indexOf('export function FlowRowList'), source.indexOf('/** The Files rows'))
  assert.match(flows, /onClick=\{\(\) => onSelectSubject\(\{kind: 'note', path, location: entry\.location\}\)\}/)
  assert.match(flows, /onDoubleClick=\{\(\) => openFile\(entry, path\)\}/)
  assert.match(flows, /event\.key === 'Enter'\) openFile\(entry, path\)/)
  const listing = source.slice(source.indexOf('function FlowsRows'), source.indexOf('export function FlowRowList'))
  assert.match(listing, /listWorldPages\(transport, USER_FLOWS_DIR\)/, 'the page owner\'s listing of your world\'s folder')
  assert.match(listing, /setListing\(entriesOfForm\(listing, 'flow'\)\)/, 'only a Flow lists as a Flow: a Being or a Thing in the same folder does not (T-WORLDS W2)')
  assert.match(listing, /readFlowInstance\(transport, byRef\.get\(ref\)!\.location\)\s*\.then\(instance => flowReadingOf\(instance\.doc\)/, 'each Flow\'s own payload, by the Flow\'s parser')
  assert.match(source, /if \(category\.id === 'central-flows'\) return <FlowsRows/)
})

// ── Central · Files, New, a waiting category ────────────────────────────────────────────────────────

test('code-reading: a Files row stands on no byte count; its size is hover words', async () => {
  const source = await read('shell/ModeBrowser.tsx')
  const ground = source.slice(source.indexOf('function GroundRows'), source.indexOf('/** The Technē Sources rows'))
  assert.doesNotMatch(ground, /byte_len\} B/, 'the size is not drawn as a standing')
  assert.match(ground, /sizeWords\(entry\.byte_len\)/)
  assert.match(ground, /title=\{`\$\{entryPath\}\$\{size \? ` · \$\{size\}` : ''\}/)
  assert.match(source, /note=\{ROW_NOTES\[category\.id\]\}/, 'Technē\'s note is its category\'s, by id — no mode branch')
})

const browse = (mode, category, workspace) => html(workspace
  ? createElement(Workspace.Provider, {value: workspace}, createElement(ModeBrowser, {mode, onSelectSubject: () => {}, selectedSubject: null, controlled: {category, query: '', poolHost: null}}))
  : createElement(StubWorkspaceProvider, {transport: UNAVAILABLE}, createElement(ModeBrowser, {mode, onSelectSubject: () => {}, selectedSubject: null, controlled: {category, query: '', poolHost: null}})))

test('New: the four document forms as the mockup\'s grid, each lit only by the Workbench\'s opener for it', () => {
  const markup = browse('base', 'central-new')
  assert.match(markup, /class="mode-browser-sep"><span>New document — the four forms<\/span>/)
  const forms = [...markup.matchAll(/data-new-form="([^"]+)"[^>]*>(?:<b[^>]*>.*?<\/b>)([^<]+)<\/button>/g)].map(match => [match[1], match[2]])
  assert.deepEqual(forms, [['document-42', 'Day'], ['document-01', 'Flow'], ['document-beings', 'Beings'], ['document-things', 'Things']])
  assert.equal((markup.match(/data-new-form="[^"]+" disabled=""/g) ?? []).length, 4, 'no opener published: every form stands drawn and unlit')
  assert.match(markup, /The Workbench publishes no opener for this form yet/, 'and says why')
  let made = null
  const lit = html(createElement(NewForms, {openers: [{id: formOpenerId('document-01'), title: 'Flow', hint: 'x', open: () => { made = 'flow' }}]}))
  assert.equal((lit.match(/disabled=""/g) ?? []).length, 3, 'the Flow lights when its opener exists')
  assert.match(lit, /data-new-form="document-01"[^>]*data-i="New Flow\|Dialogue · Flow · Journal \(0\/1\)\. Makes a new one in the focused pane\."/)
  assert.equal(made, null)
})

test('Beings and Things: the pages of that form in your world, through the page owner; Worlds: dragged onto the empty track (T-WORLDS W2)', async () => {
  const beings = browse('base', 'central-beings')
  assert.match(beings, /The kernel carrier is unavailable/, 'with no carrier the rows say so, never an empty list')
  assert.match(beings, /The Beings of your world list when the carrier answers\./)
  assert.match(browse('base', 'central-things'), /The Things of your world list when the carrier answers\./)
  const source = await read('shell/ModeBrowser.tsx')
  const rows = source.slice(source.indexOf('function PageRows'), source.indexOf('/** The Flows rows as drawn'))
  assert.match(rows, /listWorldPages\(transport, USER_FLOWS_DIR\)/)
  assert.match(rows, /page\.form === form/)
  assert.match(rows, /onClick=\{\(\) => onSelectSubject\(\{kind: 'note', path, location: page\.location\}\)\}/, 'a page previews in Clip view on select')
  const worlds = source.slice(source.indexOf('function WorldsRows'), source.indexOf('function PageRows'))
  assert.match(worlds, /event\.dataTransfer\.setData\(CENTRAL_WORLD_DRAG, world\.ref\)/, 'a world row carries its ref to the Session\'s empty track')
  assert.match(source, /if \(category\.id === 'central-worlds'\) return <WorldsRows/)
})

test('a waiting category is drawn at the rows\' rhythm, naming its owner', () => {
  const markup = browse('base', 'central-wiki')
  assert.match(markup, /data-waiting="central-wiki"/)
  assert.match(markup, /<strong>Wiki<\/strong><span class="mode-browser-empty-state">declared, waiting<\/span>/)
  assert.match(markup, /Fills from the <b>central<\/b> family/)
})

// ── Technē · Sources ────────────────────────────────────────────────────────────────────────────────

test('Technē Sources: the separator over the works, each by its title and revision, wearing the expression mark', () => {
  const workspace = {nativeWorks: [{expression_ref: 'expression:mark', title: 'O:I — the mark', revision: 3}, {expression_ref: 'expression:field', title: 'Field studies', revision: 12}],
    requestExpression: () => {}, transport: UNAVAILABLE}
  const markup = browse('techne', 'techne-sources', workspace)
  assert.match(markup, /<span>Rev<\/span>/, 'the head\'s right word, the mockup\'s "Rev"')
  assert.match(markup, /class="mode-browser-sep"><span>works · the retained app<\/span><span>open in an instrument<\/span>/)
  assert.deepEqual(cells(markup), [['O:I — the mark', 'r3'], ['Field studies', 'r12']])
})

// ── Factory · Sessions and Agents ───────────────────────────────────────────────────────────────────

const agencyRow = (sessionRef, extra = {}) => ({spaceRef: 'session-space/s1', spaceLabel: 'Joined improvement root Pi', sessionRef, raw: {}, ...extra})
const clip = state => ({n: 1, title: null, state, startUnixMs: null, lastActivityUnixMs: null, softStop: false, disclosure: null})
const sessionTrack = (sessionRef, tasks, needle = null) => ({sessionRef, group: false, tasks, needle: needle && {atUnixMs: 1, state: needle, axisStartUnixMs: 0, axisEndUnixMs: 2, disclosure: null}})

test('Factory Sessions and Agents: the session\'s name, its state from its own readings; the agent\'s roster name and its state', () => {
  const rows = [agencyRow('agent-session/lead', {purpose: 'Fizz · lead', agentRef: 'agent:fizz'}), agencyRow('agent-session/explore', {agentRef: 'agent:fizz'}),
    agencyRow('agent-session/honey', {purpose: 'glyph pass', agentRef: 'agent:honey'}), agencyRow('agent-session/quiet')]
  const sessions = {temporalError: null, roster: new Map([['agent:fizz', {name: 'Fizz', accepted: true}]]), tracks: [
    {sessionRef: 'session-space/s1', group: true, tasks: [], needle: null},
    sessionTrack('agent-session/lead', [clip('done'), clip('running'), clip('queued')]),
    sessionTrack('agent-session/explore', [clip('done'), clip('done')]),
    sessionTrack('agent-session/honey', [clip('done')], 'stalled'),
  ]}
  const listed = agentBrowser.sessionBrowserRows(rows, sessions)
  assert.deepEqual(listed.map(row => [row.label, row.standing]),
    [['Fizz · lead', 'running'], ['Fizz', 'done'], ['glyph pass', 'stalled'], ['Joined improvement root Pi', '—']],
    'its purpose (its track\'s name on the grid), else its agent\'s roster name, else its space; — where no reading discloses a state')
  assert.match(listed[1].hover, /in Joined improvement root Pi · agent Fizz · done, from the session's task reads and its needle · agent-session\/explore/)
  assert.deepEqual(listed[0].drag, {family: 'session', ref: 'session-space/s1:agent-session/lead', label: 'Fizz · lead'}, 'the drag payload is as it was')
  const agents = agentBrowser.agentBrowserRows(rows, sessions, false)
  assert.deepEqual(agents.map(row => [row.label, row.standing]), [['Fizz', 'working'], ['agent:honey', 'stalled']])
  assert.deepEqual(agents[0].drag, {family: 'agent', ref: 'agent:fizz', label: 'Fizz'})
  assert.deepEqual(agentBrowser.sessionBrowserRows(rows, {...sessions, temporalError: 'refused'}).map(row => row.standing), ['running', 'done', 'done', '—'],
    'a refused temporal read: the needle says nothing')
  assert.deepEqual(agentBrowser.sessionBrowserRows(rows, null).map(row => row.standing), ['—', '—', '—', '—'], 'no provider: no state invented')
  assert.equal(agentBrowser.agentBrowserRows([], sessions, true)[0].label, 'Reading…')
})

test('Factory rows as drawn: the agent\'s mark, the name, the state where the standing stands', () => {
  const rows = [agencyRow('agent-session/lead', {purpose: 'Fizz · lead'})]
  const markup = html(createElement(StubWorkspaceProvider, {transport: UNAVAILABLE}, createElement(AgentShellProvider, null,
    createElement(agentBrowser.AgentShellBrowser, {rows, error: null, loading: false, controlled: {category: 'sess', query: '', poolHost: null}}))))
  assert.match(markup, /class="agent-bitem"[^>]*title="Fizz · lead · in Joined improvement root Pi · no reading discloses its state · agent-session\/lead"/)
  assert.match(markup, /<span aria-hidden="true"><svg[^>]*>.*?<\/svg><\/span><span[^>]*>Fizz · lead<\/span><span class="st">—<\/span>/)
  assert.doesNotMatch(markup, /class="st">Joined improvement root Pi</, 'the space is hover words, not the standing')
})

// ── Expressions · the collections ───────────────────────────────────────────────────────────────────

test('Expressions collections: one line each — mark, name, its act where the standing stands; the description is hover words', () => {
  const markup = html(createElement(CollectionList, {sections: collectionSections(appCollectionItems(), ''), query: '', busy: null, report: null, onOpen: () => {}, onNew: () => {}}))
  assert.doesNotMatch(markup, /world-collection-description/, 'no second line')
  const first = appCollectionItems()[0]
  const row = markup.split('data-collection-row="').find(part => part.startsWith(`${first.id}"`))
  assert.match(row, /^[^"]+" title="[^"]*"/, 'the row carries its hover words')
  assert.match(row, /<span class="world-collection-mark" aria-hidden="true"><svg/, 'the expression mark')
  assert.match(row, /<span class="world-collection-name">[^<]+<\/span><button/, 'the name, then the act')
  assert.match(markup, /data-collection-row="new"[^>]*><span class="world-collection-mark" aria-hidden="true"><svg/)
})

// ── Live · the sets ─────────────────────────────────────────────────────────────────────────────────

test('Live sets: each set by its name without the extension, standing open, default or recent', () => {
  // SSR draws the sets this browser holds before its effects run: the host's default set (the recents are this device's store).
  const sets = ctx => [...html(createElement(BrowserPane, {defaultSet: '/sets/Default.als', ctx, controlled: {category: 'Sets', query: '', poolHost: null}}))
    .matchAll(/title="([^"]+)"><svg[^>]*>.*?<\/svg><span>([^<]+)<\/span><span class="mode-browser-row-meta">([^<]+)<\/span><\/button>/g)].map(match => match.slice(1))
  assert.deepEqual(sets({set: null, openSet: () => {}}), [['/sets/Default.als — the host&#x27;s default set; select opens it', 'Default', 'default']])
  assert.deepEqual(sets({set: {path: '/sets/Default.als', tracks: []}, openSet: () => {}}), [['/sets/Default.als — the set open now; select opens it', 'Default', 'open']])
  const source = readFile(new URL('../src/components/BrowserPane.tsx', import.meta.url), 'utf8')
  return source.then(text => assert.match(text, /const standing = p === ctx\.set\?\.path \? 'open' : p === defaultSet \? 'default' : 'recent'/, 'a recent set stands as recent'))
})
