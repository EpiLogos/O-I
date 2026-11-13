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

const {ModeBrowser, DayRowList, NowSection, FlowRowList, NewForms, formOpenerId, WorldRowList, seatWorldFromBrowser} = await import('../src/shell/ModeBrowser.tsx')
const {Workspace, StubWorkspaceProvider} = await import('../src/shell/workspaceContext.tsx')
const {AgentShellProvider} = await import('../src/agent/AgentShellContext.tsx')
const agentBrowser = await import('../src/agent/AgentShellBrowser.tsx')
const {CollectionList, appCollectionItems} = await import('../src/components/NativeExpressionCollections.tsx')
const {collectionSections} = await import('../src/components/nativeExpressionCommands.ts')
const browserPane = await import('../src/components/BrowserPane.tsx')
const {BrowserPane} = browserPane
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
  assert.match(days, /useRowReadings<DayStanding>\('day_standing', transport, dates, date => dayRead\(transport, dayRefOfDate\(date\)\)\.then\(dayStandingOf,/,
    'day_read for each listed day, by the root register\'s day ref')
  assert.match(days, /<NowSection rows=\{now\} \/>/)
  const now = source.slice(source.indexOf('function useNowRows'), source.indexOf('export function NowSection'))
  assert.match(now, /useAgentSessionsOptional\(\)/, 'the one agent-sessions provider, no new read')
  assert.match(now, /config\?\.world_scope\?\.workcell_ref/, 'the World scope names this machine')
  // The rows read through the window's owner readings (owners/ownerReading.ts): asked one after another, each row's last answer
  // drawn at once when the rows come back (MAP's loading item).
  const readings = source.slice(source.indexOf('function useRowReadings'), source.indexOf('/** The Days rows'))
  assert.match(readings, /useOwnerReadingsOf<T>\(/, 'the row readings are owner readings')
  const owner = await read('owners/ownerReading.ts')
  assert.match(owner.slice(owner.indexOf('export async function ensureInOrder')), /for \(const entry of entries\) \{\n\s+if \(!live\(\)\) return\n\s+await entry\.ensure\(epoch\)/, 'one at a time, so the carrier never sees a pile')
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
  assert.match(listing, /yourWorldPages\(transport\)/, 'your world\'s pages as the World Model holds them, from the page owner\'s listing')
  assert.match(source, /async function yourWorldPages[^]*?readWorldPages\(transport, \{folder: USER_FLOWS_DIR\}\)/, 'read through the World Model\'s worlds slice')
  assert.match(listing, /entriesOfForm\(listed\.value, 'flow'\)/, 'only a Flow lists as a Flow: a Being or a Thing in the same folder does not (T-WORLDS W2)')
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
  assert.doesNotMatch(lit, /Your practice/, 'with no practice opener published, no practice row stands')
  const practice = html(createElement(NewForms, {openers: [{id: 'form.practice-journal', title: 'Journal', hint: 'your journal', open: () => { made = 'journal' }},
    {id: 'form.practice-dreams', title: 'Dream journal', hint: 'your dream journal', open: () => {}}, {id: 'surface.new', title: 'New tab', hint: 'x', open: () => {}}]}))
  assert.match(practice, /<span>Your practice<\/span>/)
  const kept = [...practice.matchAll(/data-new-form="(form\.practice-[^"]+)"[^>]*>(?:<b[^>]*>.*?<\/b>)([^<]+)<\/button>/g)].map(match => [match[1], match[2]])
  assert.deepEqual(kept, [['form.practice-journal', 'Journal'], ['form.practice-dreams', 'Dream journal']], 'one button per practice opener; no other opener joins them')
})

test('Beings and Things: the pages of that form in your world, through the page owner; Worlds: dragged onto the empty track (T-WORLDS W2)', async () => {
  const beings = browse('base', 'central-beings')
  assert.match(beings, /The kernel carrier is unavailable/, 'with no carrier the rows say so, never an empty list')
  assert.match(beings, /The Beings of your world list when the carrier answers\./)
  assert.match(browse('base', 'central-things'), /The Things of your world list when the carrier answers\./)
  const source = await read('shell/ModeBrowser.tsx')
  const rows = source.slice(source.indexOf('function PageRows'), source.indexOf('/** The Flows rows as drawn'))
  assert.match(rows, /yourWorldPages\(transport\)/)
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

// O-I #747 round two (manual §10.3: the browser holds "the recordings, renders and imports the sets use … An import keeps where it came
// from"): Import, moved from the Stage plate's Edition, stands under New and runs the field's own import; with no frame it says why.
test('Expressions collections: Import stands under New, one line like the rest; with no field mounted it says why and is off', () => {
  let imported = 0
  const sections = collectionSections(appCollectionItems(), '')
  const live = html(createElement(CollectionList, {sections, query: '', busy: null, report: null, onOpen: () => {}, onNew: () => {}, onImport: () => { imported++ }}))
  const newSection = live.slice(live.indexOf('aria-label="New"'), live.indexOf('</section>', live.indexOf('aria-label="New"')))
  assert.match(newSection, /data-collection-row="new"[^]*data-collection-row="import"/, 'Import stands after New, in New')
  assert.match(newSection, /data-collection-row="import"[^>]*><span class="world-collection-mark"[^]*Import Expression…<\/span><button type="button" data-browser-row="[^"]*" aria-label="Import an Expression">Import<\/button>/)
  const off = html(createElement(CollectionList, {sections, query: '', busy: null, report: null, onOpen: () => {}, onNew: () => {},
    onImport: 'Open Expressions first: the field imports an Expression once its application is mounted.'}))
  assert.match(off, /data-collection-row="import" data-i="Import Expression…\|Open Expressions first[^"]*"[^]*<button type="button" data-browser-row="[^"]*" disabled=""/)
  assert.doesNotMatch(html(createElement(CollectionList, {sections, query: '', busy: null, report: null, onOpen: () => {}, onNew: () => {}})), /data-collection-row="import"/)
})

// ── Live · the sets ─────────────────────────────────────────────────────────────────────────────────

test('Live sets: each set by its name without the extension, standing open, default or recent', () => {
  // SSR draws the sets this browser holds before its effects run: the host's default set (the recents are this device's store).
  const sets = ctx => [...html(createElement(BrowserPane, {defaultSet: '/sets/Default.als', ctx, controlled: {category: 'Sets', query: '', poolHost: null}}))
    .matchAll(/title="([^"]+)"><svg[^>]*>.*?<\/svg><span>([^<]+)<\/span><span class="mode-browser-row-meta">([^<]+)<\/span><\/button>/g)].map(match => match.slice(1))
  assert.deepEqual(sets({set: null, openSet: () => {}}), [['/sets/Default.als — the host&#x27;s default set; select opens it', 'Default', 'default']])
  assert.deepEqual(sets({set: {path: '/sets/Default.als', tracks: []}, openSet: () => {}}), [['/sets/Default.als — the set open now; select opens it', 'Default', 'open']])
  // REPLACED (O-I #749): "a recent set stands as recent" was read from the row's source line; the rows are now liveSetRows', whose
  // recent standing the test below checks on its own rows (['Recent', 'recent', null]).
  assert.deepEqual(browserPane.liveSetRows(null, '/sets/Default.als', ['/r/Recent.als'], null, '').map(row => row.standing), ['default', 'recent'], 'a recent set stands as recent')
})

// O-I #749 (manual §10.3, "What leads the browser — Live: Your sets"): the walk of 29 Oct found Live sets empty but for the host's
// default; only "Open set" found the person's set. The sets are the person's own, as the Live document owner lists them (kernel
// live_set_owner.rs sets_reading: the Music folder and Live's places, newest first, templates marked), then the default and the recents.
test('Live sets: the person\'s own sets from the owner\'s listing, newest first, each at its place; a template stands with them and is not opened as a set', () => {
  const {liveSetRows, LiveSetList} = browserPane
  const listing = {schema: 'oi.live-sets/v1', truncated: false, places: [{label: 'Music', path: '/home/Music', present: true}],
    sets: [{path: '/home/Music/Song.als', name: 'Song', place: 'Music', template: false, modified_unix_ms: 3},
      {path: '/home/Music/Ableton/User Library/Templates/Start.als', name: 'Start', place: 'User Library', template: true, modified_unix_ms: 2},
      {path: '/sets/Default.als', name: 'Default', place: 'Music', template: false, modified_unix_ms: 1}]}
  const rows = liveSetRows(listing, '/sets/Default.als', ['/elsewhere/Recent.als', '/home/Music/Song.als'], '/home/Music/Song.als', '')
  assert.deepEqual(rows.map(row => [row.name, row.standing, row.place ?? null]),
    [['Song', 'open', 'Music'], ['Start', 'template', 'User Library'], ['Default', 'default', 'Music'], ['Recent', 'recent', null]],
    'the owner\'s sets first (newest first), then a recent set it did not list; each set once')
  assert.deepEqual(liveSetRows(listing, '', [], null, 'sta').map(row => row.name), ['Start'], 'the search finds a set by its name')
  assert.deepEqual(liveSetRows(null, '/sets/Default.als', [], null, '').map(row => row.standing), ['default'], 'before the owner answers, the default stands')
  let opened = null
  const markup = html(createElement(LiveSetList, {rows, words: null, openSet: path => { opened = path }}))
  assert.match(markup, /data-live-set="\/home\/Music\/Song.als"[^>]*>.*?<span>Song<\/span><span class="mode-browser-row-meta">open · Music<\/span>/)
  // REPLACED (O-I #749, live_set_from_template): a template stood dimmed for want of an owner act; selecting it now offers a new set from it
  // (tests/w749-live-set-from-template.test.mjs), and it is still never opened as a set itself.
  assert.match(markup, /data-live-set="\/home\/Music\/Ableton\/User Library\/Templates\/Start.als" aria-pressed="false" data-i="Start\|A template of Live&#x27;s: select it to start a new set from it[^"]*"/, 'a template starts a new set; its words say so')
  assert.equal(opened, null)
  const empty = html(createElement(LiveSetList, {rows: [], words: 'No set stands in Music or User Library.', openSet: () => {}}))
  assert.match(empty, /class="browser-empty"[^>]*>No set stands in Music or User Library\.</, 'none: the owner\'s places, said')
})

// Walk of O-I 857, LV01 (DLW build ruling 2026-11-07, ruling 6: "Bare has no set-making act: name it if Setup owns it"). Setup owns no
// set (manual §10.11 has no set step); a new set starts from a template (the browser's Start from a template), and a world with no set
// has no template either, so the empty list names the act it lacks rather than the places alone.
test('no set and no template: the empty Live sets list names the act a new set needs', () => {
  const words = browserPane.liveSetsWords({status: 'ready'}, {places: [{label: 'Music', present: true}, {label: 'User Library', present: false}], sets: []})
  // REPLACED (DLW build ruling 2026-11-08, LV01): the words named only the template act; New set now makes a blank set (w749 test).
  assert.equal(words, 'No set stands in Music, and no template to start one from. New set makes a blank one in your Music folder: one MIDI part, the Main track and a return.')
  assert.equal(browserPane.liveSetsWords({status: 'ready'}, {places: [], sets: []}), 'No set stands in your Music folder or Live\'s places, and no template to start one from. New set makes a blank one in your Music folder: one MIDI part, the Main track and a return.')
})

// G14 (DLW build ruling 2026-11-08, item 6): Samples listed only what the opened set disclosed ("No samples disclosed by this set"), so
// no audio clip could be made from the world's own audio files (walk of O-I 857, LN10–LN13). Samples are the audio files of the set's
// folder and of the world's Music folder, as the Live document owner reads them (kernel live_set_owner.rs samples_reading); a sample is
// made an audio clip by live-set's act (acts.rs audio_clip_make), on the audio part THE selection chooses: in its selected slot, else
// its first empty one (Live: load a browser item; a sample dropped on an audio track's slot).
test('Samples: the audio files of the set\'s folder and the Music folder, each at its place; one is made an audio clip on the chosen audio part through live-set\'s act (G14)', async () => {
  const {sampleRows, SampleList, sampleClipAct, makeSampleClip, samplesWords} = browserPane
  const project = '/home/Music/Ableton/Tide Project'
  const listing = {schema: 'oi.live-samples/v1', truncated: false,
    places: [{label: 'This set\'s folder', path: project, present: true}, {label: 'Music', path: '/home/Music', present: true}],
    samples: [{path: `${project}/Samples/gull.wav`, name: 'gull.wav', place: 'This set\'s folder', bytes: 44},
      {path: '/home/Music/Audio/estuary-low-tide.wav', name: 'estuary-low-tide.wav', place: 'Music', bytes: 192044}]}
  assert.deepEqual(sampleRows(listing, '').map(row => [row.name, row.place, row.path]),
    [['gull', 'This set\'s folder', `${project}/Samples/gull.wav`], ['estuary-low-tide', 'Music', '/home/Music/Audio/estuary-low-tide.wav']])
  assert.deepEqual(sampleRows(listing, 'TIDE').map(row => row.name), ['estuary-low-tide'], 'the search finds a sample by its name')
  assert.deepEqual(sampleRows(null, ''), [])
  const file = '/home/Music/Audio/estuary-low-tide.wav'
  const set = {path: `${project}/Tide.als`, tracks: [{kind: 'audio', name: 'Estuary', devices: []}, {kind: 'midi', name: 'Tide pad', devices: []}]}
  // DLW build ruling 2026-11-08, 0.9 ("a sample made into a clip plays"): on the chosen part's Arrangement at the insert marker, the
  // playhead if none; a Session slot is refused in words, as the engine plays no audio from a slot yet.
  assert.deepEqual(sampleClipAct(set, {track: 0, scene: null}, file, 8), {ok: true, act: {kind: 'audio_clip_make', track: 0, file, start: 8}},
    'on the part\'s Arrangement, at the insert marker')
  assert.deepEqual(sampleClipAct(set, {track: 0, scene: null}, file), {ok: true, act: {kind: 'audio_clip_make', track: 0, file, start: 0}},
    'no marker and no playhead: the Arrangement\'s start')
  assert.deepEqual(sampleClipAct(set, {track: 0, scene: 2}, file, 8),
    {ok: false, error: 'Estuary\'s slot in row 3 is a Session slot, and the engine plays no audio from a slot yet: choose the part itself, and the clip is made on its Arrangement at the insert marker.'})
  assert.deepEqual(sampleClipAct(set, {track: 1, scene: null}, file),
    {ok: false, error: 'Tide pad is a MIDI part: a sample is made an audio clip on an audio part. Choose one, then make the clip.'})
  assert.deepEqual(sampleClipAct({...set, tracks: [...set.tracks, {kind: 'return', name: 'A-Reverb', devices: []}]}, {track: 2, scene: null}, file),
    {ok: false, error: 'A-Reverb is a return track: a sample is made an audio clip on an audio part. Choose one, then make the clip.'})
  assert.deepEqual(sampleClipAct(set, null, file), {ok: false, error: 'Choose an audio part to make the clip on its Arrangement.'})
  assert.deepEqual(sampleClipAct(null, null, file), {ok: false, error: 'Open a set to make a clip of a sample in it.'})
  // Where it lands: the insert marker the Arrangement's ruler publishes for this set (tracksDoor.ts shownMarkerNow), else the playhead its
  // owner reports there, else the start; another set's marker is not this one's.
  const {sampleStart} = browserPane
  const drawn = {tracks: [{id: `als:${set.path}#track/0`}], playhead: 5}
  assert.equal(sampleStart({set: drawn, at: 12}, set.path), 12)
  assert.equal(sampleStart({set: drawn, at: null}, set.path), 5, 'no marker: the playhead')
  assert.equal(sampleStart({set: {...drawn, playhead: undefined}, at: null}, set.path), 0)
  assert.equal(sampleStart({set: {tracks: [{id: 'als:/other/Other.als#track/0'}]}, at: 12}, set.path), 0, 'another set\'s marker')
  assert.equal(sampleStart(null, set.path), 0)
  // Made through the set's act, answered in its owner's words; a refusal in the owner's words.
  const acts = []
  const write = async (path, act) => { acts.push([path, act]); return {act: 'audio_clip_make', done: 'Made estuary-low-tide an audio clip on Estuary from beat 8: 2 seconds of estuary-low-tide.wav, unwarped, at its own rate.', at: {track: 0, arrangement: 0}, revision: 'sha256:b'} }
  assert.deepEqual(await makeSampleClip(set, {track: 0, scene: null}, file, write, 8),
    {ok: true, note: 'Made estuary-low-tide an audio clip on Estuary from beat 8: 2 seconds of estuary-low-tide.wav, unwarped, at its own rate.'})
  assert.deepEqual(acts, [[set.path, {kind: 'audio_clip_make', track: 0, file, start: 8}]])
  const refusing = async () => { throw new Error('The ruler has no beat -1') }
  assert.deepEqual(await makeSampleClip(set, {track: 0, scene: null}, file, refusing, 8), {ok: false, error: 'No clip was made. The ruler has no beat -1.'})
  assert.deepEqual(await makeSampleClip(set, {track: 1, scene: null}, file, write), sampleClipAct(set, {track: 1, scene: null}, file))
  assert.deepEqual(await makeSampleClip(set, {track: 0, scene: 2}, file, write, 8), sampleClipAct(set, {track: 0, scene: 2}, file, 8))
  assert.equal(acts.length, 1, 'a refused choice writes nothing')
  // The rows: each sample by its name without its extension, at its place; double-click or Enter makes the clip (Live: load a browser item).
  const markup = html(createElement(SampleList, {rows: sampleRows(listing, ''), words: null, make: () => {}, said: null}))
  assert.match(markup, /data-live-sample="\/home\/Music\/Audio\/estuary-low-tide.wav"[^>]*>.*?<span>estuary-low-tide<\/span><span class="mode-browser-row-meta">Music<\/span>/)
  assert.match(markup, /data-live-sample="\/home\/Music\/Ableton\/Tide Project\/Samples\/gull.wav"[^>]*data-i="gull\|A sample in this set&#x27;s folder \(44 bytes\): double-click it, or press Enter, to make it an audio clip on the Arrangement of the audio part you chose, at the insert marker\."/)
  const said = html(createElement(SampleList, {rows: [], words: 'No sample stands in this set\'s folder or your Music folder.', make: () => {}, said: {ok: false, words: 'No clip was made: x.'}}))
  assert.match(said, /class="browser-empty"[^>]*>No sample stands in this set&#x27;s folder or your Music folder\.</)
  assert.match(said, /role="alert"[^>]*>No clip was made: x\.</)
  // The words of the list, before and without samples.
  assert.equal(samplesWords({status: 'reading'}, null), 'Reading your samples…')
  assert.equal(samplesWords({status: 'refused', error: 'no HOME'}, null), 'The Live document owner did not list your samples: no HOME')
  assert.equal(samplesWords({status: 'answered'}, {...listing, samples: []}), 'No sample (a WAV or an AIFF file) stands in this set\'s folder or your Music folder.')
  assert.equal(samplesWords({status: 'answered'}, {...listing, places: [listing.places[1]], samples: []}), 'No sample (a WAV or an AIFF file) stands in your Music folder.')
  // The pane reads the owner while Samples is shown, for the set open; "disclosed by this set" is gone from Samples.
  const pane = await read('components/BrowserPane.tsx')
  assert.match(pane, /useOwnerOp\(transport, category === 'Samples' \? \{op: 'live_samples_list', \.\.\.\(ctx\.set \? \{path: ctx\.set\.path\} : \{\}\)\} : null, 'live_samples_reading'/)
  assert.doesNotMatch(pane, /category === 'Samples'\) && !filtered\.length/, 'Samples no longer says only what the set disclosed')
  assert.match(pane, /makeSampleClip\(ctx\.set, setSelectionOf\(selection, ctx\.set\?\.path\), file, undefined, sampleStart\(shownMarkerNow\(\), ctx\.set\?\.path \?\? ''\)\)/,
    'the clip lands at the insert marker the ruler publishes, read at the press')
  assert.match(await read('frame/tracks/ArrangementRuler.tsx'), /useEffect\(\(\) => \{ publishShownMarker\(\{set, at: marker\}\) \}, \[marker, set\]\)/)
  // The pane standing alone says on each Library button what that category holds: Samples is not "disclosed by the opened set".
  const alone = html(createElement(BrowserPane, {defaultSet: '/sets/Default.als', ctx: {set: null, openSet: () => {}}}))
  assert.match(alone, /title="Browse audio files in the set&#x27;s folder and your Music folder"><span class="category-icon">/)
  assert.match(alone, /title="Browse the instruments present in the opened set"><span class="category-icon">/)
  assert.doesNotMatch(alone, /title="Browse material disclosed by the opened set"/)
})

// DLW build ruling 2026-11-08, 0.4 ("truncated is set only when more exist, and the list says it in words"): each place's own words
// stand beside the rows, not only when nothing is listed, and the empty list names only the places that were read.
test('Samples: each place says in words what it did not list, beside the rows; the empty list names only the places read (0.4)', () => {
  const {sampleRows, SampleList, samplesWords, samplePlaceWords} = browserPane
  const more = 'Only the first 2 samples in this set\'s folder are listed; more stand in it.'
  const unscoped = 'The world\'s Music folder is not a scope of Central\'s file map, so its samples are not listed: Setup\'s Ground step keeps it on your acceptance.'
  const listing = {schema: 'oi.live-samples/v1', truncated: true,
    places: [{label: 'This set\'s folder', path: '/p', present: true, read: true, listed: 2, truncated: true, words: more},
      {label: 'Music', path: '/home/Music', present: true, read: false, listed: 0, truncated: false, words: unscoped}],
    samples: [{path: '/p/a.wav', name: 'a.wav', place: 'This set\'s folder', bytes: 2}, {path: '/p/b.wav', name: 'b.wav', place: 'This set\'s folder', bytes: 2}]}
  assert.deepEqual(samplePlaceWords(listing), [more, unscoped])
  assert.deepEqual(samplePlaceWords(null), [])
  const markup = html(createElement(SampleList, {rows: sampleRows(listing, ''), words: null, places: samplePlaceWords(listing), make: () => {}, said: null}))
  assert.match(markup, /data-live-sample="\/p\/b.wav"/)
  assert.match(markup, /role="note"[^>]*>Only the first 2 samples in this set&#x27;s folder are listed; more stand in it\.</)
  assert.match(markup, /role="note"[^>]*>The world&#x27;s Music folder is not a scope of Central&#x27;s file map/)
  const empty = {...listing, samples: [], places: [{...listing.places[0], listed: 0, truncated: false, words: undefined}, listing.places[1]]}
  assert.equal(samplesWords({status: 'answered'}, empty), 'No sample (a WAV or an AIFF file) stands in this set\'s folder.',
    'Music was not read, so the list does not say no sample stands in it')
  assert.equal(samplesWords({status: 'answered'}, {...empty, places: [empty.places[1]]}), 'No sample was listed.')
  const none = html(createElement(SampleList, {rows: [], words: 'No sample was listed.', places: [unscoped], make: () => {}, said: null}))
  assert.match(none, /class="browser-empty"[^>]*>No sample was listed\.<\/div><p class="browser-empty" role="note"[^>]*>The world&#x27;s Music folder/)
  return read('components/BrowserPane.tsx').then(pane => assert.match(pane, /<SampleList rows=\{sampleRows\(samples, filter\)\} places=\{samplePlaceWords\(samples\)\}/))
})

// ── Central · Worlds ──────────────────────────────────────────────────────────────────────────────────

test('a world comes into today from its row: dragged onto the empty track, or double-clicked or Entered (Live: load a browser item), through the seat the Session draws', async () => {
  const {CENTRAL_WORLD_DRAG} = await import('../src/timeline/centralTrackAdapter.ts')
  const worlds = [{ref: 'central:wiki:root', name: 'Central', kind: 'yours', folder: 'Control/user', project: null},
    {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'}]
  const markup = html(createElement(WorldRowList, {worlds, onSeat() {}, said: null}))
  assert.deepEqual(cells(markup), [['Central', 'yours'], ['O-I', 'project']])
  assert.equal((markup.match(/tabindex="0"/g) ?? []).length, 2, 'each row takes the keyboard')
  assert.match(markup, /draggable="true"/)
  assert.match(markup, /double-click it or press Enter/)
  assert.match(html(createElement(WorldRowList, {worlds, onSeat() {}, said: 'O-I is in today\'s set.'})), /role="status"[^>]*>O-I is in today&#x27;s set\.</)
  const seated = []
  const session = seat => ({presented: 'session', set: {columns: [], tracks: [], clips: [], actions: {seat}}})
  const rows = session({op: 'the set', accepts: CENTRAL_WORLD_DRAG, run: ref => { seated.push(ref); return {ok: true, note: 'O-I is in today\'s set.'} }})
  assert.deepEqual(await seatWorldFromBrowser(worlds[1], rows), {ok: true, note: 'O-I is in today\'s set.'})
  assert.deepEqual(seated, ['central:wiki:project:O-I'], 'the drop\'s own seat, with the world\'s ref')
  assert.match((await seatWorldFromBrowser(worlds[1], null)).error, /Open Central's Session/, 'no set drawn: nothing written, and said')
  assert.equal((await seatWorldFromBrowser(worlds[1], session({op: 'x', accepts: 'application/x-other', run() { throw Error('never') }}))).ok, false, 'a set that seats something else is not asked')
  assert.deepEqual(await seatWorldFromBrowser(worlds[1], session({op: 'x', accepts: CENTRAL_WORLD_DRAG, run() { throw Error('the Day changed') }})), {ok: false, error: 'the Day changed'})
})

test('the Work place\'s Add folder… chooses a folder and opens Setup\'s Projects step for it (manual §10.11); without the system\'s chooser it says so (O-I #740)', async () => {
  const {addFolderFromBrowser} = await import('../src/shell/ModeBrowser.tsx')
  const worlds = [{ref: 'central:wiki:root', name: 'Central', kind: 'yours', folder: 'Control/user', project: null}]
  const markup = html(createElement(WorldRowList, {worlds, onSeat() {}, said: null, onAddFolder() {}}))
  assert.match(markup, /<button[^>]*>Add folder…<\/button>/, 'the entry, after the worlds')
  assert.match(markup, /Setup&#x27;s Projects step/, 'it says where it leads')
  assert.doesNotMatch(html(createElement(WorldRowList, {worlds, onSeat() {}, said: null})), /Add folder/, 'no entry where none is offered')
  const opened = []
  assert.equal(await addFolderFromBrowser(async () => '/w/Arriving/tide-sketches', request => opened.push(request)), null)
  assert.equal(opened[0].page, 'setup')
  assert.equal(opened[0].folder, '/w/Arriving/tide-sketches')
  assert.equal(await addFolderFromBrowser(async () => null, request => opened.push(request)), null, 'cancelled: nothing opens')
  assert.equal(opened.length, 1)
  assert.match(await addFolderFromBrowser(async () => { throw new Error('The system\'s folder chooser is the native app\'s') }, () => {}), /native app/)
})
