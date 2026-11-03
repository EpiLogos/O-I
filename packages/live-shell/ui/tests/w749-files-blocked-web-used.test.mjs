// O-I #749 lane AW: Files' Blocked and Web's used text (DLW §23.2 "A blocked place stays visible, with its reason"; §23.3 "Read the marked
// text. It is the text the agent used"), each from the owner that now records it.
// - Blocked: Central's `central.files.reach` (ctrl/src/files_reach.rs, central.files-reach/v1) keeps the reason its retrieval admission
//   finds — a .no-agent-retrieval marker on a place or above it, a link on the way — instead of reducing it to retrieval_allowed's bool.
//   The tree's files are judged, and the withheld places under the seat join it with Central's words.
// - Used text: AIKit's encounter owner records, at a turn's end, a `source-passage-used` journal event for each fetched page the reply
//   cites (ai-kit crates/aikit-cli/src/encounter_used.rs): by the harness (an ACP reply chunk naming the page as a resource, with the
//   text it took, or a link) or by the reply's own text carrying the url whole. Never from the words alone.
// Channels:
// - SCRIPTED: the reach answer and the journal events are made in the owners' own shapes (files_reach.rs `reach`; encounter_used.rs
//   `derive`, its record as the journal keeps it); the designs drawn through the host. The owners' own tests prove the shapes
//   (ctrl/tests/files_reach.rs; encounter_used.rs tests; encounter_service.rs a_turn_whose_reply_cites_a_fetched_page_…).
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
const rb = await import('../src/widgets/railBindings.ts')
const {tapeFromJournal} = await import('../../../../desktop/cradle/src/agent/tape/model.ts')
const filesDesign = (await import('../src/inhabitants/catalogue/panels/widgets__files.tsx')).design
const webDesign = (await import('../src/inhabitants/catalogue/panels/widgets__web.tsx')).design
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

const SEAT = '/ground/worktrees/env-2/o-i'
const MARKED = 'worktrees/env-2/o-i/private carries .no-agent-retrieval, so Central withholds everything under it from agent retrieval.'
const REACH = {schema: 'central.files-reach/v1', root: '/ground', reader: {agent_session_ref: 'agent-session/fizz'}, same_for_every_agent: true,
  places: [
    {path: `${SEAT}/src/a.ts`, relative: 'worktrees/env-2/o-i/src/a.ts', reachable: true},
    {path: `${SEAT}/private/notes.md`, relative: 'worktrees/env-2/o-i/private/notes.md', reachable: false, withheld: {code: 'deny-marker', at: 'worktrees/env-2/o-i/private', words: MARKED}},
    {path: '/tmp/scratch.md', relative: null, reachable: false, withheld: {code: 'outside', words: '/tmp/scratch.md stands outside the world Central reads (/ground): Retrieval source is outside its owner boundary.'}},
  ],
  under: {folder: SEAT, complete: true, withheld: [
    {code: 'redirected', at: 'worktrees/env-2/o-i/link', words: 'worktrees/env-2/o-i/link: Retrieval member is redirected or not ordinary material.'},
    {code: 'deny-marker', at: 'worktrees/env-2/o-i/private', words: 'worktrees/env-2/o-i/private carries .no-agent-retrieval, so Central withholds it from agent retrieval.'},
  ]}, automatic_agent_or_model_invocation: false}
const TREE = [{path: 'src/a.ts', verb: 'edit', adds: 2, dels: 1}, {path: 'private/notes.md', verb: 'read'}, {path: '/tmp/scratch.md', verb: 'read'}]

test('the tree asks Central about each of its files as a whole path', () => {
  assert.deepEqual(rb.reachPathsOf(TREE, SEAT), [`${SEAT}/src/a.ts`, `${SEAT}/private/notes.md`, '/tmp/scratch.md'])
  assert.deepEqual(rb.reachPathsOf(TREE, null), ['/tmp/scratch.md'], 'a relative path with no seat read yet is asked nothing')
})

test('a file Central withholds carries its words, and each withheld place under the seat joins the tree with its own', () => {
  const tree = rb.withReach(TREE, REACH, SEAT)
  assert.deepEqual(tree.map(f => [f.path, f.verb, f.blocked ?? null]), [
    ['src/a.ts', 'edit', null],
    ['private/notes.md', 'read', MARKED],
    // Outside Central's ground: none of Central's to withhold; the agent read it with its own hands, and it stays unmarked.
    ['/tmp/scratch.md', 'read', null],
    ['link', 'none', 'worktrees/env-2/o-i/link: Retrieval member is redirected or not ordinary material.'],
    ['private', 'none', 'worktrees/env-2/o-i/private carries .no-agent-retrieval, so Central withholds it from agent retrieval.'],
  ])
  assert.deepEqual(rb.withReach(TREE, null, SEAT), TREE, 'no answer marks nothing')
})

test('Files draws a withheld place struck through, its reason on it, and Blocked hides it', () => {
  const draw = values => { host.resetHost(); const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: filesDesign,
    binding: {id: 'files', values: {agent: 'Fizz', show: 'touched', ...values}}, view: 'full', nav: {}})); host.resetHost(); return markup }
  const files = JSON.stringify(rb.withReach(TREE, REACH, SEAT))
  const shown = draw({files, blocked: true})
  assert.match(shown, /Why private\/notes\.md is blocked/)
  assert.ok(shown.includes(`Blocked: ${MARKED}`), 'the reason stands on the place')
  assert.match(shown, /Why link is blocked/)
  const hidden = draw({files, blocked: false})
  assert.doesNotMatch(hidden, /is blocked/)
})

const provider = (kind) => ({kind: 'provider', event: {Signal: {sequence: 0, kind, provenance: []}}})
const PAGE = 'Max for Live devices\n\nLFO and Shaper are modulators: each maps one\nparameter at a time.'
const JOURNAL = [
  {cursor: 1, event: {kind: 'user-message', text: 'Read the manual'}},
  {cursor: 2, event: provider({kind: 'tool-call', payload: {sessionUpdate: 'tool_call', toolCallId: 'call-1', kind: 'fetch', title: 'https://example.org/m4l', rawInput: {url: 'https://example.org/m4l'}, status: 'pending'}})},
  {cursor: 3, event: provider({kind: 'tool-call', payload: {sessionUpdate: 'tool_call_update', toolCallId: 'call-1', status: 'completed', content: [{type: 'content', content: {type: 'text', text: PAGE}}]}})},
  {cursor: 4, event: provider({kind: 'tool-call', payload: {sessionUpdate: 'tool_call', toolCallId: 'call-2', kind: 'fetch', title: 'https://example.org/other', rawInput: {url: 'https://example.org/other'}, status: 'pending'}})},
  {cursor: 5, event: provider({kind: 'tool-call', payload: {sessionUpdate: 'tool_call_update', toolCallId: 'call-2', status: 'completed', content: [{type: 'content', content: {type: 'text', text: 'Another page'}}]}})},
  {cursor: 6, event: provider({kind: 'agent-message-chunk', text: 'Each maps one parameter at a time.'})},
  {cursor: 7, event: {kind: 'provider', event: {TurnEnded: {signals: 6}}}},
  // As encounter_used.rs records it: the harness gave the text it took from the first page, across two of its lines.
  {cursor: 8, event: {kind: 'source-passage-used', schema: 'aikit.encounter-source-used/v1', agent_session: 'agent-session/fizz', tool_call_id: 'call-1',
    url: 'https://example.org/m4l', fetch_cursor: 2, cited_by: 'harness', citation: 'resource', citing_cursor: 6, quote: 'each maps one\nparameter at a time',
    located: true, spans: [{line: 2, from: 31, to: 44}, {line: 3, from: 0, to: 19}], observed_at_ms: 1}},
]

test('a page the reply cites carries its passages as marks; a page no record cites carries none, and nothing is guessed', () => {
  const records = rb.usedRecordsOf(JOURNAL)
  assert.equal(records.length, 1)
  const pages = rb.pagesOf(tapeFromJournal(JOURNAL).rows, records)
  const cited = pages.find(p => p.url === 'https://example.org/m4l'), other = pages.find(p => p.url === 'https://example.org/other')
  assert.deepEqual(cited.used, [[2, 31, 44], [3, 0, 19]])
  assert.deepEqual(cited.cited, [{by: 'harness', form: 'resource', quote: 'each maps one\nparameter at a time', located: true}])
  assert.equal(other.used, undefined, 'the reply shares no url with it, and its words are not matched')
  assert.equal(other.cited, undefined)
})

test('Web marks the used text, and says when the reply cites a page with no passage named', () => {
  const draw = pages => { host.resetHost(); const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: webDesign,
    binding: {id: 'web', values: {agent: 'Fizz', mark: true, pages: JSON.stringify(pages)}}, view: 'widget', nav: {}})); host.resetHost(); return markup }
  const pages = rb.pagesOf(tapeFromJournal(JOURNAL).rows, rb.usedRecordsOf(JOURNAL))
  const marked = draw([pages.find(p => p.url === 'https://example.org/m4l')])
  assert.equal((marked.match(/stroke="var\(--dp-value\)"/g) ?? []).length, 2, 'one mark on each line of the passage')
  assert.doesNotMatch(marked, /no reading of the used text/)
  assert.match(draw([pages.find(p => p.url === 'https://example.org/other')]), /no reading of the used text/)
  const linked = [{url: 'https://example.org/m4l', title: 'm4l', lines: ['a page'], used: [], cited: [{by: 'reply', form: 'link'}]}]
  assert.match(draw(linked), /cited by the reply · no passage named/)
  const unlocated = [{url: 'https://example.org/m4l', title: 'm4l', lines: ['a page'], used: [], cited: [{by: 'harness', form: 'resource', quote: 'not here', located: false}]}]
  assert.match(draw(unlocated), /quoted, not verbatim on the page/)
})

test('the publisher reads Central\'s reach for Files and the journal\'s used records for Web', () => {
  const publisher = read('widgets/railDevices.tsx')
  assert.match(publisher, /useCentralAction\(transport \?\? \{kind: 'unavailable'[^)]*\}, 'central\.files\.reach', input\)/)
  assert.match(publisher, /withReach\(files, reach\.value, root\)/)
  assert.match(publisher, /usedRecordsOf\(events \?\? \[\]\)/)
  assert.match(publisher, /pagesOf\(tape\.rows, tape\.used\)/)
})
