// Live's tree healed of Central's documents (ticket D, item 4): a fresh book stood in Central's mode for its first render, so
// Central's seed laid its Day, a Flow and the tracks pane beside them, and the old-Live rename (continuity/workspace.tsx) then
// moved that tree into Live. Live's seed (shell/modeFrames.ts MODE_TREE_SEEDS.live, live/liveTreeHeal.ts) replaces such a tree
// with Live's own default — the instrument beside the set's tracks — once; a Live tree the owner arranged is untouched.
// Channel: SCRIPTED — layout fixtures over the cradle's own pane engine (the seeds and the engine operations the frame runs).
// Loader as central-documents.test.mjs (Central's seed reaches the document forms' ?raw/.json imports).
import test from 'node:test'
import assert from 'node:assert/strict'
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

const engine = await import('../../../../desktop/cradle/src/surface/engine.ts')
const {MODE_TREE_SEEDS} = await import('../src/shell/modeFrames.ts')
const {healLiveTree, holdsCentralSeed} = await import('../src/live/liveTreeHeal.ts')
const {seedInstruments, openInstrumentAt} = await import('../src/frame/openInstrument.ts')
const docs = await import('../src/central/documents/centralDocuments.ts')

const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null})
const empty = () => ({root: group('g1', []), surfaces: {}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 320})
const placed = layout => engine.groupsOf(layout.root).map(g => g.tabs.map(id => layout.surfaces[id].kind))
const kindsOf = layout => Object.values(layout.surfaces).map(binding => binding.kind).sort()
const live = MODE_TREE_SEEDS.live
/** Central's first tree, as its registration lays it — the tree the rename moved into Live. */
const centralSeed = () => MODE_TREE_SEEDS.base(empty())

test('Central\'s seed is the tree the rename moved: its Day and a Flow side by side; the set\'s tracks are no pane (manual §10.2)', () => {
  const tree = centralSeed()
  assert.deepEqual(placed(tree), [['projection.central-document'], ['projection.central-document']])
  assert.equal(holdsCentralSeed(tree), true)
})

test('a tree saved with the old tracks pane has it closed, and does not get it back (shell/tracksOutOfPanes.ts)', () => {
  const old = docs.seedCentralDocuments(empty(), {alongside: ['projection.timeline']})
  assert.deepEqual(placed(old), [['projection.central-document'], ['projection.central-document', 'projection.timeline']])
  const healed = MODE_TREE_SEEDS.base(old)
  assert.deepEqual(placed(healed), [['projection.central-document'], ['projection.central-document']])
  assert.ok(!healed.closedStack.some(id => healed.surfaces[id]?.kind === 'projection.timeline'), 'Reopen closed does not bring it back')
  assert.equal(MODE_TREE_SEEDS.base(healed), healed, 'healed once: the seed leaves it as it is')
  const intoLive = live(old)
  assert.deepEqual(placed(intoLive), [['projection.expressions']], 'the old Central tree moved into Live heals to the torus alone')
})

test('Live\'s seed heals that tree into Live\'s own default: the instrument; Central\'s documents leave Live\'s book', () => {
  const healed = live(centralSeed())
  assert.deepEqual(placed(healed), [['projection.expressions']], 'the torus on the stage; the set\'s tracks are Session view, a Tab away')
  assert.deepEqual(kindsOf(healed), ['projection.expressions'], 'no Central document is held, open or closed')
  assert.deepEqual(healed.closedStack, [], 'nothing of Central\'s waits to be reopened in Live')
  const fresh = live(empty())
  const focusAt = layout => engine.groupsOf(layout.root).findIndex(g => g.id === layout.focusedGroupId)
  assert.equal(focusAt(healed), focusAt(fresh), 'the focus stands where Live\'s own first tree puts it')
})

test('exactly once: the healed tree is Live\'s own, and the seed leaves it as it is', () => {
  const healed = live(centralSeed())
  assert.equal(holdsCentralSeed(healed), false)
  assert.equal(live(healed), healed, 'the same object: nothing to write')
})

test('a Live tree the owner arranged is untouched, even one that now shows only Central\'s documents', () => {
  // the owner puts a Day beside the instrument, then closes the instrument and the tracks: the tree has held the torus
  const own = live(empty())
  const withDay = engine.openBinding(own, docs.documentBinding(own, {form: 'day', date: null}))
  const [stage, tracks] = Object.values(withDay.surfaces).filter(binding => binding.kind !== docs.CENTRAL_DOCUMENT_PANE_KIND).map(binding => binding.id)
  const onlyDay = engine.closeSurface(engine.closeSurface(withDay, stage), tracks)
  assert.deepEqual(placed(onlyDay), [['projection.central-document']])
  assert.equal(holdsCentralSeed(onlyDay), false, 'it has held the instrument: it is the owner\'s arrangement')
  assert.equal(live(onlyDay), onlyDay)
  // a Central document beside anything else
  const mixed = openInstrumentAt(centralSeed(), 'projection.constellation')
  assert.equal(live(mixed), mixed, 'a graph beside the documents: the owner\'s')
})

test('a tree with a document standing in its own window is the owner\'s; an empty tree is seeded as before', () => {
  const tree = centralSeed()
  const day = Object.values(tree.surfaces).find(binding => binding.kind === docs.CENTRAL_DOCUMENT_PANE_KIND)
  const detached = {...tree, detached: [{surfaceId: day.id, groupId: 'g1', index: 0, pinned: false}]}
  assert.equal(holdsCentralSeed(detached), false)
  assert.deepEqual(placed(live(empty())), placed(seedInstruments(['projection.expressions'])(empty())))
})

test('the heal is Live\'s alone: Central\'s own tree stands under Central\'s seed', () => {
  const tree = centralSeed()
  assert.equal(MODE_TREE_SEEDS.base(tree), tree)
  assert.equal(healLiveTree(layout => layout)(empty()).root.tabs.length, 0, 'an empty tree is not a Central tree: the wrapped seed alone decides')
})
