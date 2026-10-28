// #772, #786: the Knowledge graph's `reach.` keys (manual §17.3 "What a subject reaches", which took in Impact's reach of §18.6): "Select a
// folder, a note or a Day, and the reader beside the graph lists what a change to it would reach." References and Sessions are Impact's legs
// (groundDevices.ts readFilesLeg: a folder's listing, op files_list; readNowLeg: the NOW register, op now kind:list, projected by
// centralImpactModel.ts projectSessions) on the browser's selected folder, note or Day, which Technē's carrier hands the graph's binding
// (techneDesigns.ts useTechneDesignBindings: the book's selection, the kernel transport). Sessions (reach.closed) is the view's own.
// Channels: SCRIPTED — the legs' answers in their owners' shapes (central.directory-reading/v1 entries; the NOW register's list rows); the
// binding's values and standing, and the design drawn from them through the runtime's host. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

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
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
globalThis.__CRADLE_WALK__ = false
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const host = await import('../src/frame/devices/deviceHost.tsx')
const graphB = await import('../src/techne/devices/graphBinding.ts')
const {design: graphDesign} = await import('../src/inhabitants/catalogue/panels/knowledge-graph__graph.tsx')
const writes = {setter: async () => {}, patch: () => {}}
const REACH = ['reach.subject', 'reach.references', 'reach.sessions']
const drawn = binding => renderToStaticMarkup(createElement(host.HostedDevice, {designed: graphDesign, binding, view: 'whole', nav: {}}))

/** The folder's listing as `op files_list` answers it (central.directory-reading/v1 entries). */
const FOLDER = {kind: 'folder', path: 'Work/O-I/ProjectCentral/docs/2-design'}
const ENTRIES = [{name: 'CAPABILITY-MATRIX.md', kind: 'file', byte_len: 43247, location: {schema: 'central.path-ref/v1', root: '/ground', path: 'Work/O-I/ProjectCentral/docs/2-design/CAPABILITY-MATRIX.md'}},
  {name: 'devices', kind: 'directory', location: {schema: 'central.path-ref/v1', root: '/ground', path: 'Work/O-I/ProjectCentral/docs/2-design/devices'}}]
/** The NOW register's list rows (`op now` kind:list): one open session whose work is O-I's, one closed, one on another project. */
const NOW = [{now_ref: 'central:now:project:O-I:01', purpose: 'Docs reads its owners', lifecycle: 'active', work_refs: [{repo: 'O-I', branch: 'dlw/build-lane'}]},
  {now_ref: 'central:now:project:O-I:02', purpose: 'The pool keeps readings', lifecycle: 'resolved', work_refs: [{repo: 'O-I', branch: 'dlw/769'}]},
  {now_ref: 'central:now:project:ai-kit:03', purpose: 'Elsewhere', lifecycle: 'active', work_refs: [{repo: 'ai-kit', branch: 'main'}]}]
/** Impact's legs as the carrier reads them (groundDevices.ts readFilesLeg / readNowLeg's shapes), scripted. */
const legs = ({files = {entries: ENTRIES, boundaryOp: 'op files_list', at: 't', refusal: null}, now = {records: NOW, boundaryOp: 'op now (kind:list)', at: 't', refusal: null}} = {}) => {
  const asked = []
  return {asked, files: async subject => { asked.push(['files', subject.path]); return subject.kind === 'folder' ? files : undefined }, now: async () => { asked.push(['now']); return now }}
}

test('with nothing selected in the browser, each reach reading names the selection it waits for; Sessions is the hand\'s', () => {
  const binding = graphB.graphBinding(null, null, writes)
  for (const key of REACH) {
    assert.equal(binding.values[key], undefined, `${key} is absent`)
    assert.equal(binding.standing[key]?.disabled, graphB.REACH_NO_SUBJECT, `${key}: why`)
    assert.equal(graphB.graphAbsent(null, null, key), graphB.REACH_NO_SUBJECT)
  }
  assert.match(graphB.REACH_NO_SUBJECT, /folder, a note or a Day in the browser/)
  assert.ok(binding.local?.['reach.closed'], 'Sessions (open only, or open and closed) is the view\'s own')
  assert.equal(binding.values['reach.closed'], false, 'Open only, the manual\'s default')
})

test('a folder selected in the browser: reach draws Impact\'s legs, its listing and the sessions whose work names its project', async () => {
  const readers = legs()
  const reach = await graphB.readGraphReach(FOLDER, readers)
  assert.deepEqual(readers.asked, [['files', FOLDER.path], ['now']], 'Impact\'s two legs, each asked once')
  const binding = graphB.graphBinding(null, null, writes, {}, undefined, reach)
  assert.deepEqual(JSON.parse(binding.values['reach.subject']), {kind: 'folder', path: FOLDER.path, ref: null})
  assert.deepEqual(JSON.parse(binding.values['reach.references']), ENTRIES, 'the folder\'s listing, verbatim')
  assert.deepEqual(JSON.parse(binding.values['reach.sessions']).map(row => [row.nowRef, row.lifecycle, row.work]),
    [['central:now:project:O-I:01', 'active', ['O-I @ dlw/build-lane']], ['central:now:project:O-I:02', 'resolved', ['O-I @ dlw/769']]],
    'the sessions whose work names the subject\'s project, not another\'s')
  for (const key of REACH) assert.equal(binding.standing[key], undefined, `${key} stands read`)
  const markup = drawn(binding)
  assert.doesNotMatch(markup, /\bNaN\b|undefined|data-device-fault/)
  assert.match(markup, /CAPABILITY-MATRIX\.md/, 'the listing is drawn')
  assert.match(markup, /Docs reads its owners/, 'the open session is drawn')
  assert.doesNotMatch(markup, /The pool keeps readings/, 'Open only: the closed session waits behind Sessions')
  assert.match(drawn(graphB.graphBinding(null, null, writes, {'reach.closed': true}, undefined, reach)), /The pool keeps readings/, 'Open and closed draws it')
})

test('a note or a Day: its sessions are read, and its references name the reading no owner carries; a refused leg stands in its words', async () => {
  const note = {kind: 'note', path: 'Work/O-I/ProjectCentral/docs/1-vision/dlw/DLW.md'}
  const binding = graphB.graphBinding(null, null, writes, {}, undefined, await graphB.readGraphReach(note, legs()))
  assert.equal(JSON.parse(binding.values['reach.sessions']).length, 2)
  assert.equal(binding.values['reach.references'], undefined)
  assert.equal(binding.standing['reach.references']?.disabled, graphB.REACH_NO_FILE_MAP)
  assert.match(graphB.REACH_NO_FILE_MAP, /missing op/)
  const refused = await graphB.readGraphReach(FOLDER, legs({files: {entries: [], boundaryOp: 'op files_list', at: 't', refusal: 'Path is outside the disclosed ground'},
    now: {records: [], boundaryOp: 'op now (kind:list)', at: 't', refusal: 'The NOW register is unreadable'}}))
  const words = graphB.graphBinding(null, null, writes, {}, undefined, refused)
  assert.equal(words.values['reach.refusal:references'], 'Path is outside the disclosed ground')
  assert.equal(words.values['reach.refusal:sessions'], 'The NOW register is unreadable')
  assert.equal(words.values['reach.references'], undefined, 'a refused list stays empty')
  assert.equal(words.values['reach.sessions'], undefined)
  assert.match(drawn(words), /Path is outside the disclosed ground/)
  // While the legs are read, the binding waits on them.
  const reading = graphB.graphBinding(null, null, writes, {}, undefined, {subject: FOLDER, reading: true})
  assert.ok(reading.waiting?.includes('reach.references') && reading.waiting.includes('reach.sessions'))
  assert.deepEqual(JSON.parse(reading.values['reach.subject']).path, FOLDER.path)
})
