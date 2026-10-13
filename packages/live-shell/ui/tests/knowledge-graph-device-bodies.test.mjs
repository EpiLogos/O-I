import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

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

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The knowledge graph's own controls on the Device side: the surface publishes its handle (the same filter state and
// zoom the panel and GraphCanvas read), the faces' bodies and acts drive that handle, and the rack docks the faces.
const bodies = await import('../src/inhabitants/knowledgeGraphFaceBodies.tsx')
const rack = await import('../src/inhabitants/inhabitantRack.tsx')
const knowledgeActsModule = await import('../src/inhabitants/knowledgeGraphFaceActions.ts')
const cradleFilters = await import('../../../../desktop/cradle/src/knowledge/filters.ts')
const handleStore = await import('../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle.ts')
const knowledgeFamily = await import('../src/inhabitants/knowledgeGraphFamilyManifest.ts')

const TRANSPORT = {kind: 'bridge', url: 'http://kernel.test'}

function fakeGraph({filters = {}, zoom = 1, kinds = ['wiki-node'], relations = ['node-source'], selected = null} = {}) {
  const calls = []
  return {
    calls,
    filters: cradleFilters.restoreGraphFilters(filters),
    zoom,
    domains: {kinds, relations},
    counts: null,
    selected,
    patchFilters(patch) { calls.push(['patch', patch]) },
    setZoom(next) { calls.push(['zoom', next]) },
    fit() { calls.push(['fit']) },
  }
}

test('the handle store holds one surface, and only the surface that published it can clear it', () => {
  const first = {}, second = {}
  const graphA = fakeGraph(), graphB = fakeGraph()
  handleStore.publishKnowledgeGraphHandle(first, graphA)
  assert.equal(handleStore.knowledgeGraphSurface(), graphA)
  handleStore.publishKnowledgeGraphHandle(second, null)
  assert.equal(handleStore.knowledgeGraphSurface(), graphA, 'another surface cannot clear the standing handle')
  handleStore.publishKnowledgeGraphHandle(second, graphB)
  assert.equal(handleStore.knowledgeGraphSurface(), graphB, 'the latest surface to publish stands')
  handleStore.publishKnowledgeGraphHandle(second, null)
  assert.equal(handleStore.knowledgeGraphSurface(), null)
})

test('subscribers hear each publish and clear, and read the standing handle', () => {
  const token = {}
  let heard = 0
  const off = handleStore.subscribeKnowledgeGraph(() => { heard += 1 })
  try {
    handleStore.publishKnowledgeGraphHandle(token, fakeGraph())
    handleStore.publishKnowledgeGraphHandle(token, null)
    assert.equal(heard, 2)
  } finally {
    off()
  }
  handleStore.publishKnowledgeGraphHandle(token, fakeGraph())
  handleStore.publishKnowledgeGraphHandle(token, null)
  assert.equal(heard, 2, 'an unsubscribed listener hears nothing more')
})

test('a toggle is the panel’s own: it adds a member that is absent and removes one that stands, patching only that key', () => {
  const graph = fakeGraph({filters: {kinds: ['wiki-node']}})
  knowledgeActsModule.toggleMember(graph, 'kinds', 'wiki-space')
  knowledgeActsModule.toggleMember(graph, 'kinds', 'wiki-node')
  assert.deepEqual(graph.calls, [
    ['patch', {kinds: ['wiki-node', 'wiki-space']}],
    ['patch', {kinds: []}],
  ])
})

test('the knowledge graph has a face body for each knowledge face and no body for the atlas faces', () => {
  assert.equal(bodies.isKnowledgeFaceId('knowledge-scope'), true)
  assert.equal(bodies.isKnowledgeFaceId('knowledge-filters'), true)
  assert.equal(bodies.isKnowledgeFaceId('knowledge-display'), true)
  assert.equal(bodies.isKnowledgeFaceId('graph-tools'), false)
})

test('a body with no open graph names that and keeps no state of its own', () => {
  const out = renderToStaticMarkup(createElement(bodies.KnowledgeFaceBody, {faceId: 'knowledge-scope'}))
  assert.match(out, /data-knowledge-face="knowledge-scope"/)
  assert.match(out, /data-mounted="no"/)
  assert.match(out, /not open/)
  assert.doesNotMatch(out, /<select/, 'no control is drawn without a graph to drive')
})

test('an open graph draws the controls its own filter state reports', () => {
  const token = {}
  handleStore.publishKnowledgeGraphHandle(token, fakeGraph({filters: {scope: 'local', depth: 2, direction: 'incoming'}, selected: 'ref:a'}))
  try {
    const scope = renderToStaticMarkup(createElement(bodies.KnowledgeFaceBody, {faceId: 'knowledge-scope'}))
    assert.match(scope, /data-mounted="yes"/)
    assert.match(scope, /aria-label="Graph scope"/)
    assert.match(scope, /aria-label="Graph depth"[^>]*value="2"/, 'depth reads the view’s own depth')
    assert.match(scope, /aria-label="Graph relation direction"/)
    const filters = renderToStaticMarkup(createElement(bodies.KnowledgeFaceBody, {faceId: 'knowledge-filters'}))
    assert.match(filters, /aria-label="Filter graph subjects"/)
    assert.match(filters, /data-knowledge-control="kinds"/)
    const display = renderToStaticMarkup(createElement(bodies.KnowledgeFaceBody, {faceId: 'knowledge-display'}))
    assert.match(display, /aria-label="Graph labels"/)
    assert.match(display, /aria-label="Graph zoom"/)
  } finally {
    handleStore.publishKnowledgeGraphHandle(token, null)
  }
})

test('the rack docks the three knowledge faces, each with its card, and draws no atlas face', () => {
  const out = renderToStaticMarkup(createElement(rack.InhabitantRack, {manifests: [knowledgeFamily.knowledgeGraphFamilyManifest], transport: TRANSPORT, focusInstrument: 'knowledge-graph'}))
  for (const id of ['knowledge-scope', 'knowledge-filters', 'knowledge-display']) assert.match(out, new RegExp(`data-face-id="${id}"`))
  assert.doesNotMatch(out, /data-face-id="graph-tools"/)
})
