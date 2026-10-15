// The browser's row words (FOUNDATION F6; world-shell-mockup.html bi() :1478, renderBrowser() :1479–1500): a row is its mark,
// its name in the words a person uses and its standing, each from an owner's reading. Channel: SCRIPTED — the pure formatters
// of src/frame/browser/rowWords.ts over fixture readings shaped as the owners answer (day_read's central.day-reading/v1 as the
// dev walk-bridge answered it on 15 Oct; a Flow's ql-doc meta as the files in Control/user/flows carry it; agentRunModel's
// tracks). No screen leg here.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
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

const words = await import('../src/frame/browser/rowWords.ts')

/** day_read's answer for one day (central.day-reading/v1), as the owner gave it for 2026-10-08 and 2026-09-12. */
const dayReading = (date, {lifecycle = 'open', state = 'uninitialised', revision = 'central.content-fnv1a64/v1:0:cbf29ce484222325', today = '2026-10-13'} = {}) => ({
  schema: 'central.day-reading/v1', day_ref: `central:day:control:root:${date}`, content: '', document_state: state,
  revision: {revision}, source: {ref: `central:source:control:root:Control/user/day/${date}/day.md`, path: `Control/user/day/${date}/day.md`},
  temporal: {civil_date: date, day_ref: `central:day:control:root:${date}`, lifecycle},
  today: {civil_date: today, day_ref: `central:day:control:root:${today}`},
})

test('a day file reads as its weekday and date, the calendar\'s own', () => {
  assert.equal(words.civilDateOfDayFile('2026-10-08.md'), '2026-10-08')
  assert.equal(words.civilDateOfDayFile('2026-09-12.sources'), null, 'a day\'s sources folder is not a day record')
  assert.equal(words.civilDateOfDayFile('notes.md'), null)
  assert.equal(words.dayWords('2026-10-08'), 'Thu 08 Oct', '8 October 2026 is a Thursday (the mockup\'s "Wed 08 Oct" is its own calendar)')
  assert.equal(words.dayWords('2026-10-07'), 'Wed 07 Oct')
  assert.equal(words.dayWords('2026-09-12'), 'Sat 12 Sep')
  assert.equal(words.dayWords('2024-02-29'), 'Thu 29 Feb', 'a leap day')
  assert.equal(words.dayWords('2026-02-30'), null, 'no such day')
  assert.equal(words.dayWords('2026-10-08.md'), null)
})

test('a day stands on the owner\'s Day reading: its lifecycle, then the Day document\'s short revision while it stands', () => {
  const open = words.dayStandingOf(dayReading('2026-10-08'))
  assert.deepEqual(open, {state: 'read', lifecycle: 'open', document: 'uninitialised', revision: 'central.content-fnv1a64/v1:0:cbf29ce484222325', today: false})
  assert.equal(words.dayStandingWords(open), 'open', 'no Day document yet: the lifecycle alone, never the empty content\'s digest')
  const ready = words.dayStandingOf(dayReading('2026-10-13', {state: 'ready', revision: 'central.content-fnv1a64/v1:146275:54a54c3094faa373'}))
  assert.equal(words.dayStandingWords(ready), 'open · r54a54c30', 'the mockup\'s "open · r7": the revision as the aperture shows it')
  assert.equal(ready.today, true)
  assert.match(words.dayStandingHover(ready), /the owner names it today/)
  assert.equal(words.dayStandingWords(words.dayStandingOf(dayReading('2026-09-12', {lifecycle: 'closed'}))), 'closed')
  const refused = {state: 'refused', message: 'Central owner Action refused: DayRef is not recorded in this World'}
  assert.equal(words.dayStandingWords(refused), '—', 'a refused reading stands on nothing')
  assert.match(words.dayStandingHover(refused), /DayRef is not recorded in this World/, 'the refusal is the hover, verbatim')
  assert.equal(words.dayStandingWords(undefined), '', 'not read yet: nothing')
  const noLifecycle = words.dayStandingOf({...dayReading('2026-10-01'), temporal: {civil_date: '2026-10-01', day_ref: 'x'}})
  assert.equal(words.dayStandingWords(noLifecycle), '—', 'a reading with no lifecycle discloses none')
})

test('a size is hover words, never a standing', () => {
  assert.equal(words.sizeWords(2988), '2.9 KB')
  assert.equal(words.sizeWords(96), '96 bytes')
  assert.equal(words.sizeWords(28462 * 1024), '27.8 MB')
  assert.equal(words.sizeWords(undefined), null)
  assert.equal(words.withoutExtension('flow-2026-10-07-1343.html'), 'flow-2026-10-07-1343')
  assert.equal(words.withoutExtension('Default.als'), 'Default')
  assert.equal(words.withoutExtension('README'), 'README')
})

test('a Flow reads by its own title, its agents and its revision; else by its file name', () => {
  // Control/user/flows/flow-2026-10-03-1432.html's meta, as written.
  const titled = words.flowReadingOf({meta: {title: 'Factory original development Run — execution and continuation', revision: 8,
    participants: [{initial: 'F', kind: 'person'}, {initial: 'C', name: 'Factory coordinator', kind: 'agent'}]}, entries: []})
  assert.deepEqual(titled, {state: 'read', title: 'Factory original development Run — execution and continuation', revision: 8, agents: ['Factory coordinator']})
  const row = words.flowRowWords('flow-2026-10-03-1432.html', titled)
  assert.equal(row.name, 'Factory original development Run — execution and continuation')
  assert.equal(row.standing, 'with Factory coordinator · r8', 'the mockup\'s "with Fizz · r12"')
  // flow-2026-10-07-1343.html: a blank Flow — no title, revision 0.
  const blank = words.flowRowWords('flow-2026-10-07-1343.html', words.flowReadingOf({meta: {title: '', revision: 0, participants: [{kind: 'person'}]}}))
  assert.equal(blank.name, 'flow-2026-10-07-1343', 'no title: the file name without its extension')
  assert.equal(blank.standing, 'r0')
  // oi203-multiagent-20260930.html: three agents.
  const many = words.flowRowWords('oi203.html', words.flowReadingOf({meta: {title: 'OI203', revision: 1, participants: [
    {name: 'Owner', kind: 'person'}, {name: 'MacParticipant', kind: 'agent'}, {name: 'OmarchyParticipant', kind: 'agent'}, {name: 'OmarchyPeer', kind: 'agent'}]}}))
  assert.equal(many.standing, 'with MacParticipant +2 · r1', 'short as the mockup\'s: the first agent, then how many more')
  // epi-card-2026-09-24-1250.html carries no ql-doc island: the Flow's parser refuses it.
  const refused = words.flowRowWords('epi-card-2026-09-24-1250.html', {state: 'refused', message: 'This file is not a 0/1 dialogue/flow document'})
  assert.deepEqual([refused.name, refused.standing], ['epi-card-2026-09-24-1250', '—'])
  assert.match(refused.hover, /not a 0\/1 dialogue\/flow document/)
  assert.deepEqual(words.flowRowWords('flow-x.html', undefined), {name: 'flow-x', standing: '', hover: 'flow-x.html — the Flow\'s payload has not been read yet.'})
  assert.deepEqual(words.flowReadingOf('not a payload'), {state: 'refused', message: 'the payload carries no meta'})
})

test('the Flows rows are ordered as the Flow pane ranks them: minted names newest first, then those named by hand', () => {
  const names = ['epi-card-2026-09-24-1250.html', 'flow-2026-10-07-1343.html', 'oi203-multiagent-20260930.html', 'flow-2026-10-07-1343-2.html',
    'flow-2026-10-14-2050.html', 'flow-2026-09-14-2236.html']
  assert.deepEqual(names.map(name => ({name})).sort(words.flowOrder).map(row => row.name), ['flow-2026-10-14-2050.html', 'flow-2026-10-07-1343-2.html',
    'flow-2026-10-07-1343.html', 'flow-2026-09-14-2236.html', 'epi-card-2026-09-24-1250.html', 'oi203-multiagent-20260930.html'])
})

const task = (state, softStop = false) => ({n: 1, title: null, state, startUnixMs: null, lastActivityUnixMs: null, softStop, disclosure: null})
const track = (tasks, needle = null) => ({tasks, needle: needle ? {atUnixMs: null, state: needle, axisStartUnixMs: 0, axisEndUnixMs: 1, disclosure: null} : null})

test('a session stands on its own clips and needle: running, stalled, done, queued, idle — or nothing disclosed', () => {
  assert.equal(words.sessionState(track([task('done'), task('running'), task('queued')])), 'running', 'the mockup: a running clip runs the session')
  assert.equal(words.sessionState(track([task('done')], 'live')), 'running', 'a live needle is the session running now')
  assert.equal(words.sessionState(track([task('done')], 'live'), false), 'done', 'when the temporal read refused, the needle says nothing')
  assert.equal(words.sessionState(track([task('stalled'), task('done')])), 'stalled')
  assert.equal(words.sessionState(track([], 'stalled')), 'stalled')
  assert.equal(words.sessionState(track([task('done'), task('done'), task('queued', true)])), 'done', 'the soft-stop slot is no task')
  assert.equal(words.sessionState(track([task('queued')], 'idle')), 'queued')
  assert.equal(words.sessionState(track([task('unknown')], 'idle')), 'idle')
  assert.equal(words.sessionState(track([task('unknown')])), null, 'nothing disclosed')
  assert.equal(words.agentState(['done', 'running']), 'working')
  assert.equal(words.agentState(['idle', 'stalled']), 'stalled')
  assert.equal(words.agentState(['done', null]), 'idle')
  assert.equal(words.agentState([null, null]), null)
})

test('the NOW section: one row per machine the agency places sessions on, standing on what runs there now', () => {
  const sessions = [
    {host: 'host/localhost', agent: 'Fizz', state: 'running'},
    {host: 'host/localhost', agent: null, state: 'done'},
    {host: 'host/omarchy', agent: 'Honey', state: 'idle'},
    {host: null, agent: 'Bumble', state: 'running'},
  ]
  const rows = words.nowRows(sessions, 'workcell:mac')
  assert.deepEqual(rows.map(row => [row.name, row.standing]), [['mac', 'live · Fizz'], ['omarchy', 'quiet']],
    'the agency\'s localhost is the host\'s own workcell; a session naming no host places nothing')
  assert.match(rows[0].hover, /2 agency sessions on host\/localhost \(this host's workcell, workcell:mac\); 1 running now/)
  assert.deepEqual(words.nowRows(sessions, null).map(row => row.name), ['localhost', 'omarchy'], 'no workcell disclosed: the host\'s own name')
  assert.equal(words.nowRows([{host: 'host/localhost', agent: null, state: 'running'}, {host: 'host/localhost', agent: null, state: 'running'}], null)[0].standing, 'live · 2 sessions')
  assert.equal(words.nowRows([{host: 'host/localhost', agent: null, state: 'stalled'}], null)[0].standing, 'stalled')
  assert.equal(words.nowRows([{host: 'host/localhost', agent: null, state: null}], null)[0].standing, '—', 'no state disclosed')
  assert.deepEqual(words.nowRows([{host: null, agent: 'Fizz', state: 'running'}], 'workcell:mac'), [], 'no host named: the section is absent')
  // agency_read's space shape (the dev walk-bridge's answer, 15 Oct): project_contexts.<project>.basis.host.
  assert.equal(words.hostOfSpace({definition: {id: 's'}, project_contexts: {'O-I': {basis: {host: 'host/localhost', catalog_revision: 'x'}}}}), 'host/localhost')
  assert.equal(words.hostOfSpace({definition: {id: 's'}}), null)
  assert.equal(words.hostOfSpace(null), null)
})

test('the formatters live in the frame and name no mode', async () => {
  const source = await readFile(new URL('../src/frame/browser/rowWords.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /[!=]==\s*'(live|base|central|factory|expressions|techne|audio)'/)
  assert.doesNotMatch(source, /from 'react'/, 'pure: no React of its own')
})
