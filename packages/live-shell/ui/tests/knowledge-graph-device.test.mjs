import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The atlas's exposed parameters, made true (lane dlw/build, the adopt-the-kit wiring moment). Each atlas-earth row names a
// shell.setAtlas* writer; each writer is registered in the shell's setter bridge and drives the SAME atlas face action the
// face body calls, on the one mounted atlas. The declared domains are read live from FORCE_ROWS, the TimeModel, the
// GraphView's controls() and its own setDepth clamp. Production modules in memory, the atlas-face-bodies.test.mjs loader.
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
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

// Imports: the door, the loaders, the SDK's registries and the knowledge graph's own modules. The knowledge graph's
// controls are the cradle's filter state (desktop/cradle/src/knowledge); the store that publishes its handle is the cradle's.
const door = await import('../src/inhabitants/familyManifest.ts')
const five = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const p0 = await import('../src/inhabitants/agentNativeP0.ts')
const adoptRows = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const sdkValidate = await import('../src/inhabitants/sdk/validate.ts')
const sdkSetters = await import('../src/inhabitants/sdk/shellSetters.ts')
const semantics = await import('../src/inhabitants/sdk/semantics.ts')
const bridge = await import('../src/agent/shellSetterBridge.ts')
const knowledgeFamily = await import('../src/inhabitants/knowledgeGraphFamilyManifest.ts')
const knowledgeActs = await import('../src/inhabitants/knowledgeGraphFaceActions.ts')
const handleStore = await import('../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle.ts')
const cradleFilters = await import('../../../../desktop/cradle/src/knowledge/filters.ts')

/** Stand the world the way the shell does: the families, the verified rows, the P0 batch, and the knowledge setters. */
function standWorld() {
  door.resetFamilyManifestsForTest()
  five.loadAgentShellFamilies()
  adoptRows.adoptVerifiedRows()
  p0.loadAgentNativeP0()
  bridge.registerKnowledgeShellSetters()
}

const KNOWLEDGE_ROW_KEYS = ['scope', 'depth', 'direction', 'shared', 'ghosts', 'text', 'kinds', 'relations', 'isolated', 'context', 'labels', 'arrows', 'zoom']

/** A graph surface as the cradle publishes it: the view's own filter state (through the cradle's own restore), its zoom,
 * the vocabularies the open reading holds (null until it loads), and the act functions the surface exposes. Each act is
 * recorded, so a test can see that a writer calls the surface's own action rather than keeping a copy. */
function fakeGraph({filters = {}, zoom = 1, kinds = ['wiki-node', 'wiki-space'], relations = ['node-source'], loaded = true, selected = null} = {}) {
  const calls = []
  return {
    calls,
    filters: cradleFilters.restoreGraphFilters(filters),
    zoom,
    domains: loaded ? {kinds, relations} : null,
    counts: null,
    selected,
    patchFilters(patch) { calls.push(['patch', patch]) },
    setZoom(next) { calls.push(['zoom', next]) },
    fit() { calls.push(['fit']) },
  }
}

/** Publish a graph as the open surface does; returns the token the surface would hold to unpublish it. */
function openGraph(graph) {
  const token = {}
  handleStore.publishKnowledgeGraphHandle(token, graph)
  return token
}
const closeGraph = token => handleStore.publishKnowledgeGraphHandle(token, null)
const fire = (path, value) => sdkSetters.shellSetter(path)(value)

// ---------------------------------------------------------------------------

test('the knowledge graph family admits three faces, each occupying the detail-device semantic the gate accepts', () => {
  standWorld()
  const manifest = door.familyManifest('knowledge-graph')
  assert.ok(manifest, 'the knowledge graph family is admitted at the door')
  assert.deepEqual(manifest.faces.map(face => face.id), ['knowledge-scope', 'knowledge-filters', 'knowledge-display'])
  for (const face of manifest.faces) {
    assert.equal(face.liveSemantic, 'detail-device')
    assert.deepEqual(semantics.validateFaceSemantic(face, {family: 'knowledge-graph'}), [], `${face.id} keeps its semantic`)
  }
  // The knowledge graph is its own standalone instrument (lock §8.1): its faces are held by it, never by a Technē instrument.
  for (const face of manifest.faces) assert.deepEqual(face.heldBy, ['knowledge-graph'], `${face.id} is held by the knowledge graph`)
  assert.ok(semantics.isHolder('knowledge-graph'), 'the knowledge graph is a declared standalone holder')
  assert.ok(!semantics.TECHNE_INSTRUMENTS.some(holder => holder.id === 'knowledge-graph'), 'and not one of Technē’s six')
})

test('the knowledge rows are the controls the cradle holds, each on the domain the cradle gives it', () => {
  standWorld()
  const rows = sdkDefine.sdkParamRows('knowledge-graph')
  assert.deepEqual(rows.map(row => row.key).sort(), [...KNOWLEDGE_ROW_KEYS].sort())
  const row = key => rows.find(candidate => candidate.key === key)
  assert.deepEqual(row('depth').range, {min: 0, max: 8, unit: 'steps'}, 'the depth input clamps to zero through eight')
  assert.deepEqual(row('zoom').range, {min: 0.15, max: 4, unit: '×'}, 'the zoom buttons clamp to the surface zoom range')
  assert.deepEqual(row('scope').values, ['field', 'local'])
  assert.deepEqual(row('direction').values, ['both', 'outgoing', 'incoming'])
  assert.deepEqual(row('context').values, ['structure', 'matches'])
  assert.deepEqual(row('labels').values, ['automatic', 'all', 'focus'])
  assert.deepEqual(row('kinds').values, knowledgeActs.KNOWLEDGE_KINDS)
  assert.deepEqual(row('relations').values, knowledgeActs.KNOWLEDGE_RELATIONS)
  assert.equal(row('text').type, 'string')
  for (const key of ['shared', 'ghosts', 'isolated', 'arrows']) assert.equal(row(key).type, 'boolean', `${key} is a switch`)
})

test('every shell.setKnowledge* path the rows name is registered, and the world passes the gate with no knowledge fault', () => {
  standWorld()
  const paths = sdkDefine.sdkParamRows('knowledge-graph').map(row => row.writePath)
  assert.ok(paths.every(path => path?.startsWith('shell.setKnowledge')), 'every row names a knowledge writer')
  for (const path of paths) assert.ok(sdkSetters.shellSetter(path), `${path} is registered on the shell`)
  assert.deepEqual([...new Set(paths)].sort(), [...bridge.KNOWLEDGE_SHELL_SETTERS].sort())
  const gate = sdkValidate.validateAdmittedWorld()
  const knowledgeFaults = [...(gate.byFamily.get('knowledge-graph') ?? []), ...gate.cross.filter(fault => fault.includes('knowledge'))]
  assert.deepEqual(knowledgeFaults, [])
})

test('every knowledge writer refuses by name while no knowledge graph is open', async () => {
  standWorld()
  for (const path of bridge.KNOWLEDGE_SHELL_SETTERS) {
    const receipt = await fire(path, undefined)
    assert.equal(receipt.kind, 'refused', `${path} refuses`)
    assert.match(receipt.reason, /no knowledge graph is open/, `${path} names the unopened graph`)
  }
})

test('depth takes whole steps from zero to eight in a local view, and refuses the rest by name', async () => {
  standWorld()
  const local = fakeGraph({filters: {scope: 'local'}, selected: 'ref:a'})
  const token = openGraph(local)
  try {
    assert.match((await fire('shell.setKnowledgeDepth', 9)).reason, /0 to 8/)
    assert.match((await fire('shell.setKnowledgeDepth', 1.5)).reason, /whole number/)
    assert.match((await fire('shell.setKnowledgeDepth', 'two')).reason, /takes a number/)
    const fired = await fire('shell.setKnowledgeDepth', 2)
    assert.equal(fired.kind, 'fired')
    assert.deepEqual(local.calls, [['patch', {depth: 2}]], 'the writer calls the same patch the depth input calls')
  } finally {
    closeGraph(token)
  }
  const field = fakeGraph({filters: {scope: 'field'}})
  const fieldToken = openGraph(field)
  try {
    const refused = await fire('shell.setKnowledgeDepth', 2)
    assert.equal(refused.kind, 'refused')
    assert.match(refused.reason, /local view/, 'the depth input is disabled outside a local view, and the writer says so')
    assert.deepEqual(field.calls, [])
  } finally {
    closeGraph(fieldToken)
  }
})

test('zoom takes the surface zoom range and calls the zoom act the buttons call', async () => {
  standWorld()
  const graph = fakeGraph()
  const token = openGraph(graph)
  try {
    assert.match((await fire('shell.setKnowledgeZoom', 5)).reason, /0\.15 to 4/)
    assert.match((await fire('shell.setKnowledgeZoom', 'close')).reason, /takes a number/)
    assert.equal((await fire('shell.setKnowledgeZoom', 1.5)).kind, 'fired')
    assert.deepEqual(graph.calls, [['zoom', 1.5]])
  } finally {
    closeGraph(token)
  }
})

test('scope, direction, constellation context and labels take only the choices the panel offers', async () => {
  standWorld()
  const graph = fakeGraph()
  const token = openGraph(graph)
  try {
    assert.match((await fire('shell.setKnowledgeScope', 'nowhere')).reason, /field or local/)
    assert.equal((await fire('shell.setKnowledgeScope', 'local')).kind, 'fired')
    assert.match((await fire('shell.setKnowledgeDirection', 'sideways')).reason, /both, outgoing or incoming/)
    assert.equal((await fire('shell.setKnowledgeDirection', 'incoming')).kind, 'fired')
    assert.match((await fire('shell.setKnowledgeContext', 'loud')).reason, /structure or matches/)
    assert.equal((await fire('shell.setKnowledgeContext', 'matches')).kind, 'fired')
    assert.match((await fire('shell.setKnowledgeLabels', 'loud')).reason, /automatic, all or focus/)
    assert.equal((await fire('shell.setKnowledgeLabels', 'focus')).kind, 'fired')
    assert.deepEqual(graph.calls, [
      ['patch', {scope: 'local'}],
      ['patch', {direction: 'incoming'}],
      ['patch', {context: 'matches'}],
      ['patch', {labels: 'focus'}],
    ])
  } finally {
    closeGraph(token)
  }
})

test('the switches take true or false and patch the same filter their checkbox patches', async () => {
  standWorld()
  const graph = fakeGraph()
  const token = openGraph(graph)
  try {
    assert.match((await fire('shell.setKnowledgeShared', 'yes')).reason, /true or false/)
    assert.equal((await fire('shell.setKnowledgeShared', true)).kind, 'fired')
    assert.equal((await fire('shell.setKnowledgeGhosts', false)).kind, 'fired')
    assert.equal((await fire('shell.setKnowledgeIsolated', false)).kind, 'fired')
    assert.equal((await fire('shell.setKnowledgeArrows', true)).kind, 'fired')
    assert.deepEqual(graph.calls, [
      ['patch', {shared: true}],
      ['patch', {unresolved: false}],
      ['patch', {isolated: false}],
      ['patch', {arrows: true}],
    ])
  } finally {
    closeGraph(token)
  }
})

test('the find field takes text up to the filter length and refuses the rest by name', async () => {
  standWorld()
  const graph = fakeGraph()
  const token = openGraph(graph)
  try {
    assert.match((await fire('shell.setKnowledgeText', 'x'.repeat(1025))).reason, /1024/)
    assert.match((await fire('shell.setKnowledgeText', 5)).reason, /text/)
    assert.equal((await fire('shell.setKnowledgeText', 'ring')).kind, 'fired')
    assert.deepEqual(graph.calls, [['patch', {text: 'ring'}]])
  } finally {
    closeGraph(token)
  }
})

test('kinds and relations refuse until the reading loads, and refuse names the open reading does not hold', async () => {
  standWorld()
  const unloaded = fakeGraph({loaded: false})
  const unloadedToken = openGraph(unloaded)
  try {
    assert.match((await fire('shell.setKnowledgeKinds', ['wiki-node'])).reason, /has not loaded its reading/)
  } finally {
    closeGraph(unloadedToken)
  }
  const graph = fakeGraph({kinds: ['wiki-node', 'wiki-space'], relations: ['node-source']})
  const token = openGraph(graph)
  try {
    assert.match((await fire('shell.setKnowledgeKinds', ['skill'])).reason, /holds no subject of kind skill/, 'the declared kind is not in the open reading')
    assert.match((await fire('shell.setKnowledgeKinds', ['bogus'])).reason, /not one of/, 'an undeclared kind is refused')
    assert.match((await fire('shell.setKnowledgeKinds', ['wiki-node', 'wiki-node'])).reason, /twice/)
    assert.equal((await fire('shell.setKnowledgeKinds', ['wiki-node'])).kind, 'fired')
    assert.match((await fire('shell.setKnowledgeRelations', ['wiki.contains'])).reason, /not one of/, 'a relation the rows do not declare is refused')
    assert.equal((await fire('shell.setKnowledgeRelations', ['node-source'])).kind, 'fired')
    assert.deepEqual(graph.calls, [
      ['patch', {kinds: ['wiki-node']}],
      ['patch', {relations: ['node-source']}],
    ])
  } finally {
    closeGraph(token)
  }
})
