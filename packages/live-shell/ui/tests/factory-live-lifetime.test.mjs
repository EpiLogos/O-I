// T-FACTORY-1: the Run's Expression production is owned by the Run, not by
// the view that shows it (WORLD-SHELL-DESIGN.md §7). Views subscribe; closing
// every view never stops the work; only the Run's own explicit stop does, and
// Follow re-attaches. The IO is injected (followRunLive / startRunLive take a
// factory), so no kernel is needed: an empty but well-formed act world keeps
// the producer following until it is told to stop.
// Run: node --test tests/factory-live-lifetime.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {followRunLive, startRunLive, stopRunLive, heldLiveFollows, heldRunLive, runLiveSubscribers} = await import(new URL('desktop/cradle/src/contributions/factory/FactoryLive.tsx', root).href)

// A kernel-free world: no attempts, no material, an act that opens and reads back.
const act = (actRef) => ({act_ref: actRef, expression_ref: 'expression:test', mode: 'factory', phase: 'running', revision: 1, cast: [], bindings: {}, role_entities: {}, sequence: []})
function emptyIO(runRef) {
  const actRef = `act:factory-run-${runRef.replace(/[^A-Za-z0-9-_.]/g, '-')}`
  return {
    readAttempts: async () => ({attempts: []}),
    watch: async () => undefined,
    world: async request => {
      if (request.operation === 'material_list') return {state: 'materials', schema: 'oi.expression-material-list/v1', register: 'test', folders: {}, materials: [], unreadable: [], truncated: false}
      if (request.operation === 'act_list') return {state: 'acts', acts: [], persistent: true, store_errors: []}
      if (request.operation === 'act_open') return {state: 'act_opened', act: act(actRef)}
      return {state: 'act', act: act(actRef)}
    },
  }
}
const transport = {kind: 'unavailable', reason: 'test: no kernel attached'}
const source = runKey => ({runKey, runRef: `run:${runKey}`, statePath: '/nonexistent/state.json', goal: 'test run'})
const makeIO = (_transport, src) => emptyIO(src.runRef)
const settle = async runKey => {
  const deadline = Date.now() + 5000
  while (heldRunLive(runKey)?.state.status !== 'following' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(heldRunLive(runKey)?.state.status, 'following', 'the Run is following')
}

test('closing every view leaves the Run producing; reattach finds the same production', async () => {
  const runKey = 'lifetime-views-close'
  const first = followRunLive(transport, source(runKey), makeIO)
  await settle(runKey)
  const production = heldRunLive(runKey)
  const second = followRunLive(transport, source(runKey), makeIO)
  assert.equal(runLiveSubscribers(runKey), 2, 'two views subscribe to one production')
  first(); second()
  assert.equal(runLiveSubscribers(runKey), 0, 'no view is subscribed')
  assert.equal(heldLiveFollows(), 1, 'the production outlives its views')
  assert.equal(heldRunLive(runKey), production, 'the same production')
  assert.equal(production.following, true)
  const reattached = followRunLive(transport, source(runKey), makeIO)
  assert.equal(heldRunLive(runKey), production, 'reopening re-attaches to the in-flight production')
  reattached()
  await stopRunLive(runKey)
})

test('an explicit stop ends the production; Follow resumes it over the same Run', async () => {
  const runKey = 'lifetime-explicit-stop'
  const release = followRunLive(transport, source(runKey), makeIO)
  await settle(runKey)
  const production = heldRunLive(runKey)
  release()
  await stopRunLive(runKey)
  assert.equal(production.following, false, 'the Run stopped')
  assert.equal(production.state.status, 'stopped')
  assert.equal(heldLiveFollows(), 0)
  // A view opening a stopped Run does not restart it: only the Run's Follow does.
  const reopened = followRunLive(transport, source(runKey), makeIO)
  assert.equal(heldRunLive(runKey), production, 'the stopped production is what a reopened view sees')
  assert.equal(heldLiveFollows(), 0, 'a stopped Run stays stopped while viewed')
  reopened()
  await startRunLive(transport, source(runKey), makeIO)
  assert.notEqual(heldRunLive(runKey), production, 'Follow starts a successor over the same act')
  await settle(runKey)
  await stopRunLive(runKey)
})

test('stop then start never overlaps: the successor begins after the predecessor has exited', async () => {
  const runKey = 'lifetime-restart-race'
  const release = followRunLive(transport, source(runKey), makeIO)
  await settle(runKey)
  const predecessor = heldRunLive(runKey)
  release()
  const stopping = stopRunLive(runKey)
  const starting = startRunLive(transport, source(runKey), makeIO)
  await Promise.all([stopping, starting])
  assert.equal(predecessor.following, false)
  const successor = heldRunLive(runKey)
  assert.notEqual(successor, predecessor)
  assert.equal(successor.following, true, 'exactly one production follows the Run')
  assert.equal(heldLiveFollows(), 1)
  await stopRunLive(runKey)
})
