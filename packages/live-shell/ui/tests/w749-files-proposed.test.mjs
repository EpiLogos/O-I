// O-I #749 lane AQ, Files' Diff page: the changes an agent proposes (DLW §23.2 Changes: Proposed; "A proposed change shows its author"),
// from the one owner that records proposed changes with their author: Central's source returns (projectcentral.source.returns, read by
// the kernel's source_returns_read, the queue Approvals answers), each read through projectcentral.source.return_read for its basis and
// proposed content, its lines diffed here. The Gateway keeps no pending patch (AIKit holds a consent request in memory for its turn, with
// the provider's tool call, never a patch): it is named in OPEN, not invented.
// Channels:
// - SCRIPTED: the returns and their readings are made in Central's own shape (ctrl/src/source_return.rs SourceReturn, return_read's
//   central.source-return-reading/v1), since no return stands in any project of this world (projectcentral.source.returns answered
//   empty for o-i, central, ai-kit, factory, workcell and actuation, 30 Oct); the designs drawn through the host.
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
const filesDesign = (await import('../src/inhabitants/catalogue/panels/widgets__files.tsx')).design
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

const ENTRY = (n, status, session) => ({return_ref: `central:return:project:O-I:17933300000000000${n}-4242`, source_ref: `central:source:project:O-I:ProjectCentral/docs/note-${n}.md`,
  basis_revision: `sha256:${n}`, status, agent_session_ref: session, current_revision: `sha256:${n}`, project: 'O-I'})
const ENTRIES = [ENTRY(1, 'pending', 'agent-session/fizz'), ENTRY(2, 'applying', 'agent-session/honey'), ENTRY(3, 'accepted', 'agent-session/fizz'), ENTRY(4, 'pending', 'agent-session/unknown')]
const READING = (entry, basis, proposed) => ({schema: 'central.source-return-reading/v1', proposal: {schema: 'central.source-return/v1', return_ref: entry.return_ref, source_ref: entry.source_ref,
  basis_revision: entry.basis_revision, basis_content: basis, proposed_content: proposed, reason: 'clarify', evidence_refs: [], agent_session_ref: entry.agent_session_ref, status: entry.status},
  basis_current: true, acceptance: {available: true, reason: null}, authored_source_mutated: false})
const TRACKS = [{sessionRef: 'agent-session/fizz', agentName: 'Fizz'}, {sessionRef: 'agent-session/honey', agentName: 'Honey'}]

test('two texts make a unified patch: the lines added and removed, three lines of context, a hunk head for each stretch', () => {
  assert.deepEqual(rb.unifiedPatchOf('a\nb\nc\n', 'a\nB\nc\nd\n'), {patch: '@@ -1,3 +1,4 @@\n a\n-b\n+B\n c\n+d', adds: 2, dels: 1})
  assert.deepEqual(rb.unifiedPatchOf('same\n', 'same\n'), {patch: '', adds: 0, dels: 0})
  assert.deepEqual(rb.unifiedPatchOf('', 'new\n'), {patch: '@@ -0,0 +1,1 @@\n+new', adds: 1, dels: 0})
  const long = Array.from({length: 20}, (_, i) => `line ${i}`)
  const changed = long.map((l, i) => (i === 2 || i === 17 ? `${l}!` : l))
  const patch = rb.unifiedPatchOf(long.join('\n'), changed.join('\n')).patch
  assert.deepEqual(patch.split('\n').filter(l => l.startsWith('@@')), ['@@ -1,6 +1,6 @@', '@@ -15,6 +15,6 @@'], 'two stretches far apart are two hunks')
})

test('the proposed changes are the returns that wait, each with its author and session, its lines diffed from what it was read against', () => {
  const reads = new Map([[ENTRIES[0].return_ref, READING(ENTRIES[0], '# Note\nold line\n', '# Note\nnew line\n')],
    [ENTRIES[1].return_ref, READING(ENTRIES[1], '', '# Fresh\n')]])
  const rows = rb.proposedFilesOf(ENTRIES, reads, TRACKS)
  assert.deepEqual(rows.map(r => [r.path, r.status, r.author, r.session, r.adds ?? null, r.dels ?? null]), [
    ['ProjectCentral/docs/note-1.md', 'M', 'Fizz', 'agent-session/fizz', 1, 1],
    ['ProjectCentral/docs/note-2.md', 'A', 'Honey', 'agent-session/honey', 1, 0],
    ['ProjectCentral/docs/note-4.md', 'M', 'agent-session/unknown', 'agent-session/unknown', null, null],
  ], 'an accepted return waits no more; a return not yet read carries no lines, and none are invented')
  assert.equal(rows[0].patch, '@@ -1,2 +1,2 @@\n # Note\n-old line\n+new line')
  assert.equal(rows[2].patch, undefined)
})

test('the Diff page shows the proposed changes beside the uncommitted ones, by Changes and by Session, each with its author', () => {
  const reads = new Map([[ENTRIES[0].return_ref, READING(ENTRIES[0], '# Note\nold line\n', '# Note\nnew line\n')]])
  const proposed = rb.proposedFilesOf(ENTRIES, reads, TRACKS)
  const seat = [{path: 'src/a.ts', status: 'M', adds: 3, dels: 1, patch: '@@ -1 +1 @@\n-a\n+b'}]
  const draw = values => { host.resetHost(); host.setHostPage('files', 'diff'); const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: filesDesign,
    binding: {id: 'files', values: Object.fromEntries(Object.entries({files: JSON.stringify([...seat, ...proposed]), branch: 'dlw/build-lane', head: '19e9d17ed', ...values}).map(([k, v]) => [`diff.${k}`, v]))},
    view: 'full', nav: {}})); host.resetHost(); return markup }
  const both = draw({show: 'both', session: 'all'})
  assert.match(both, /note-1\.md/)
  assert.match(both, /Fizz/, 'a proposed change shows its author')
  assert.match(both, /a\.ts/)
  const mine = draw({show: 'proposed', session: 'selected', followed: 'agent-session/fizz'})
  assert.match(mine, /note-1\.md/)
  assert.doesNotMatch(mine, /note-2\.md|note-4\.md|a\.ts/, 'the selected session\'s proposals only')
  const uncommitted = draw({show: 'uncommitted', session: 'selected', followed: 'agent-session/fizz'})
  assert.match(uncommitted, /a\.ts/, 'the seat\'s uncommitted changes belong to no session and stand under either')
  assert.doesNotMatch(uncommitted, /note-1\.md/)
})

test('the publisher reads each waiting return through Central\'s return_read and carries the proposals onto the Diff page', () => {
  const publisher = read('widgets/railDevices.tsx')
  assert.match(publisher, /centralActionOp\('projectcentral\.source\.return_read', \{project: entry\.project, return_ref: entry\.return_ref\}, entry\.project\)/)
  assert.match(publisher, /useWorldReturns\(/)
  assert.match(publisher, /proposedFilesOf\(/)
})
