// Builder A's last lane: Search's `vak:` kind (design package D8, manual §18.4 "a `vak:` kind in Search with the neighbourhood at depth
// 0–2") on Quaternal Logic's Vāk registry through the kernel's ql_read vak-locate and vak-context (owner_routes.rs, a4c97faa9); and the
// Diff widget following the selected seat, else the selected project world's repository (T-COVERAGE §1.3).
// Channels: REAL (desktop/cradle/kernel/tests/fixtures/owner-routes/ql-registry-reads-2026-10-21.json: `ql vak locate M0` and its refusal;
// tests/fixtures/ql-vak-context-2026-10-21.json: `ql vak context M0-3 1`, read only, trimmed); SCRIPTED (the pure bindings, and the
// catalogue design rendered on them through the runtime's host). No owner state is written. Not a screen pass.
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
const host = await import('../src/frame/devices/deviceHost.tsx')
const search = await import('../src/central/devices/searchBinding.ts')
const holds = await import('../src/central/devices/pageBindings.ts')
const {design: searchDesign} = await import('../src/inhabitants/catalogue/panels/central__search.tsx')
const REGISTRY = JSON.parse(readFileSync(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/ql-registry-reads-2026-10-21.json', import.meta.url), 'utf8'))
const CONTEXT = JSON.parse(readFileSync(new URL('./fixtures/ql-vak-context-2026-10-21.json', import.meta.url), 'utf8'))
// The locate answer for M0-3 as `ql vak locate M0-3 --json` gives it (read on workcell:mac, 21 Oct): its centre's own fields.
const LOCATE_M03 = {vakRef: 'M0-3', name: CONTEXT.answer.centre.name, symbol: CONTEXT.answer.centre.symbol, primaryDesignation: CONTEXT.answer.centre.primaryDesignation, standing: 'SOURCE', sourceLine: CONTEXT.answer.centre.source.sourceLine}
const answered = value => ({status: 'answered', value})

test('a vak: term names a coordinate; QL\'s located entry is a vak-entry result, its neighbourhood the design\'s vak.context', () => {
  assert.equal(search.vakTermOf('vak:M0-3'), 'M0-3')
  assert.equal(search.vakTermOf('the ground vak:M0'), 'M0')
  assert.equal(search.vakTermOf('vakM0 or vak:X1'), null, 'only a coordinate of the registry (M0…), as the design reads it')
  assert.deepEqual([search.vakDepthOf(undefined), search.vakDepthOf(0), search.vakDepthOf(2), search.vakDepthOf(7), search.vakDepthOf(-3)], [1, 0, 2, 2, 0], 'QL\'s own bound, 0 to 2')
  assert.deepEqual(search.vakEntryResultOf(REGISTRY.vak_locate.answer), {ref: 'M0', title: 'Anuttara', kind: 'vak-entry',
    says: 'Subsystem #0 - The Foundational Void - Proto-Logy - The Ever-Present Origin', owner: 'Quaternal Logic'}, 'REAL: no horizon, since QL states none')
  assert.equal(search.vakEntryResultOf({name: 'x'}), null)
  const context = JSON.parse(search.vakContextValueOf(CONTEXT.answer))
  assert.equal(context.centre, 'M0-3')
  assert.equal(context.depth, 1)
  assert.equal(context.revision, CONTEXT.answer.sourceRevision)
  assert.equal(context.entries.length, CONTEXT.answer.entries.length)
  assert.deepEqual(context.entries.find(e => e[0] === 'M0-3'), ['M0-3', 'Archetypal Number Language', '12+4+2', 39], '[ref, name, symbol, source line]')
  assert.deepEqual(context.relations[0], ['M0-3', 'parent', 'M0'], 'every relation as QL derived it from the nesting')
  assert.equal(search.vakContextValueOf({contract: 'other'}), null)
  const centreless = JSON.parse(search.vakContextValueOf({...CONTEXT.answer, entries: CONTEXT.answer.entries.filter(e => e.vakRef !== 'M0-3')}))
  assert.equal(centreless.entries[0][0], 'M0-3', 'the centre stands among the entries the design draws round it')
})

test('Search binds the vak: kind: the entry first among the results, the neighbourhood at the depth the hand holds, QL\'s refusals in its words', () => {
  const id = 'central:search:vak-test'
  holds.setHeld(id, 'query', 'vak:M0-3')
  const vak = {ref: 'M0-3', depth: 1, locate: answered(LOCATE_M03), context: answered(CONTEXT.answer)}
  const values = search.searchValues(id, {query: 'vak:M0-3', hits: [], rows: [], pending: [], vak}, null)
  const results = JSON.parse(values.results)
  assert.deepEqual(results[0], {ref: 'M0-3', title: 'Archetypal Number Language', kind: 'vak-entry', says: LOCATE_M03.primaryDesignation, owner: 'Quaternal Logic'})
  assert.equal(JSON.parse(values['vak.context']).centre, 'M0-3')
  assert.equal(values['vak.depth'], 1, 'the depth starts at 1')
  holds.setHeld(id, 'vak.depth', 2)
  assert.equal(search.searchValues(id, {query: 'vak:M0-3', hits: [], rows: [], pending: []}, null)['vak.depth'], 2)
  const other = search.searchValues(id, {query: 'vak:M0-3', hits: [], rows: [], pending: [], vak: {...vak, ref: 'M0'}}, null)
  assert.deepEqual(JSON.parse(other.results), [], 'an answer for another coordinate is not this query\'s: AIKit\'s empty answer stands alone')
  assert.equal(other['vak.context'], undefined)
  const binding = search.searchBinding(id, {query: 'vak:M0-3', hits: [], rows: [], pending: [], vak}, null)
  assert.ok(binding.local['vak.depth'], 'the depth is the hand\'s')
  const html = ['full', 'whole'].map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed: searchDesign, binding, view, nav: {}}))).join('')
  assert.match(html, /Archetypal Number Language/, 'the design draws the located entry')
  assert.doesNotMatch(html, /\bNaN\b|undefined/)
  const refused = search.searchBinding(id, {query: 'vak:M0-3', hits: [], rows: [], pending: [], vak: {ref: 'M0-3', depth: 2,
    locate: {status: 'refused', error: REGISTRY.vak_locate.refusal_stderr}, context: {status: 'refused', error: REGISTRY.vak_locate.refusal_stderr}}}, null)
  assert.match(refused.standing['k:vak'].refused, /Quaternal Logic located no entry — ql: invalid Vāk ref `NOPE`/, 'REAL: QL\'s words')
  assert.match(refused.standing['vak.depth'].refused, /read no neighbourhood/)
  holds.setHeld(id, 'query', 'ground')
  const plain = search.searchValues(id, {query: 'ground', hits: [], rows: [], pending: []}, null)
  assert.equal(plain['vak.context'], undefined)
  assert.match(search.SEARCH_WIRING.absent['vak.context'], /names no `vak:` term/, 'without a term: absent, and why')
  assert.ok(!('vak.depth' in search.SEARCH_WIRING.refused), 'the depth is no longer refused: the route exists')
  for (const key of ['vak.depth', 'query']) holds.setHeld(id, key, undefined)
})

test('the Search device asks QL through the kernel\'s ql_read routes, a locate and a context at the held depth, as readings', async () => {
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/central/devices/agentChainDevices.ts', import.meta.url), 'utf8')
  assert.match(source, /\{op: 'ql_read', request: \{kind: 'vak-locate', vak_ref: ref\}\}/)
  assert.match(source, /\{op: 'ql_read', request: \{kind: 'vak-context', vak_ref: ref, depth\}\}/)
  assert.match(source, /useOwnerOp\(transport, ref \?/, 'held readings, asked only while the search names a vak: term')
  const routes = await readFile(new URL('../../../../desktop/cradle/kernel/src/owner_routes.rs', import.meta.url), 'utf8')
  assert.match(routes, /QlRead::VakLocate \{ vak_ref \}/)
  assert.match(routes, /QlCheck::Contract\("ql\.vak-context\/v1"\)/)
})

test('the Diff follows the selected seat, else the selected project world\'s repository, else the workspace\'s project, else the selected session\'s, else says why', async () => {
  const rail = await import('../src/widgets/railDevices.tsx')
  const scope = await import('../src/agent/worldScope.ts')
  assert.deepEqual(rail.diffProjectOf('Archetypal-Earth', 'O-I'), {project: 'Archetypal-Earth', from: 'world'}, 'the world a head opened the Workspace on')
  assert.deepEqual(rail.diffProjectOf('central', 'Factory'), {project: 'Factory', from: 'workspace'}, 'your world has no repository of its own: the book\'s project')
  // REPLACED (O-I #740 lane B): with neither, the shell's literal project 'O-I'; now the selected session's project (the register its agency
  // read listed it in), and with no session, or a root-register session, the words why — never a named project.
  assert.deepEqual(rail.diffProjectOf(undefined, undefined, {ref: 'ses-1', project: 'first-project'}), {project: 'first-project', from: 'session'})
  assert.deepEqual(rail.diffProjectOf(undefined, undefined), {project: null, from: 'none', words: scope.NO_SESSION})
  assert.deepEqual(rail.diffProjectOf('central', 'central', {ref: 'ses-1', project: ''}), {project: null, from: 'none', words: scope.ROOT_KEEPS_NO_REPOSITORY})
  // REPLACED (#725): the selected world's project was the Workspace's `folder` — the Workspace was retired into the track's head and Docs
  // (§18.1, §18.5), so the Diff reads the world Docs stands on: Docs' `subject` (pageBindings.ts docsValues, `world.project ?? 'central'`).
  const {centralDeviceId} = await import('../src/central/devices/centralDeviceModel.ts')
  assert.equal(rail.DIFF_WORLD_ID, centralDeviceId('docs'), 'the id named on the rail is Docs\' own (CentralDevices.tsx DOCS_DEVICE_ID)')
  assert.deepEqual([holds.docsValues('central:docs', {name: 'Archetypal-Earth', project: 'Archetypal-Earth'}).subject, holds.docsValues('central:docs', {name: 'Your world', project: null}).subject],
    ['Archetypal-Earth', 'central'], 'Docs\' subject is the world\'s project, or Central for your world: the words diffProjectOf reads')
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/widgets/railDevices.tsx', import.meta.url), 'utf8')
  assert.match(source, /publishedDevice\(DIFF_WORLD_ID\)\?\.binding\?\.values\.subject/)
  assert.match(source, /\{op: 'git_repository_read', project\}/, 'the repository read follows the project chosen')
  assert.match(source, /selectedSeatOf\(seatValues, seats\.value\)/, 'a selected seat still stands first (0321415ea)')
})
