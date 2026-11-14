import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The window's store of the World Model's slices (src/owners/model.ts; kernel world_model.rs; O-I #1001). The store holds the
// kernel's answer for each slice at its version, shares one ask between concurrent readers, and asks again only when the kernel's
// `model_changed` notice names a newer version or a write this window completed. Channel: scripted over the real store with its
// send and its write registry handed in; the kernel's side is tested in the kernel (world_model.rs, tests/foundation.rs).
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

const {createModelStore, modelChangedOf, sliceOf, sliceValue} = await import('../src/owners/model.ts')

const answer = (slice, version, value = {version}, extra = {}) => ({outcome: {result: 'model_slice', data: {schema: 'oi.world-model-slice/v1', slice,
  owner: 'Central', scopes: ['root'], version, state: 'read', value, error: null, read_at_unix_ms: 1, ...extra}}})

/** A kernel the store asks: each ask recorded, answered by `answers(slice, n)` (the nth ask of that slice), held until `release` when
 * `holding` is set. */
function kernel(answers) {
  const asked = []
  const waiting = []
  let holding = false
  const send = (transport, slice) => {
    asked.push(`${transport.url}:${slice}`)
    const n = asked.filter(row => row === `${transport.url}:${slice}`).length
    const answered = Promise.resolve().then(() => answers(slice, n))
    if (!holding) return answered
    return new Promise(resolve => waiting.push(() => resolve(answered)))
  }
  return {send, asked, hold: () => { holding = true }, release: () => { holding = false; for (const go of waiting.splice(0)) go() }}
}
/** The window's write registry (bridge.ts onKernelWrite) as the store takes it. */
function writes() {
  const listeners = new Set()
  return {onWrite: listener => { listeners.add(listener); return () => listeners.delete(listener) }, wrote: () => { for (const listener of [...listeners]) listener() }}
}
const settle = async () => { for (let turn = 0; turn < 20; turn++) await new Promise(resolve => setImmediate(resolve)) }
const bridge = name => ({kind: 'bridge', url: `http://kernel.test/${name}`})

test('concurrent readers share one ask; a held slice no notice has moved answers without asking', async () => {
  const k = kernel((slice, n) => answer(slice, n))
  const store = createModelStore(k.send, writes().onWrite)
  const window_ = bridge('one')
  const [a, b] = await Promise.all([store.read(window_, 'worlds'), store.read(window_, 'worlds')])
  assert.equal(a, b)
  assert.equal(a.state, 'held')
  assert.equal(a.answer.version, 1)
  assert.deepEqual(k.asked, ['http://kernel.test/one:worlds'], 'two readers, one ask')
  await store.read(window_, 'worlds')
  assert.equal(k.asked.length, 1, 'the held slice is current: nothing asked')
  await store.read(window_, 'day')
  assert.deepEqual(k.asked, ['http://kernel.test/one:worlds', 'http://kernel.test/one:day'], 'each slice is its own')
  await store.read(bridge('two'), 'worlds')
  assert.equal(k.asked.at(-1), 'http://kernel.test/two:worlds', 'each transport holds its own slices')
})

test('a notice of a newer version: a listened slice is asked at once, another at its next read; an older or equal version asks nothing', async () => {
  const k = kernel((slice, n) => answer(slice, n))
  const store = createModelStore(k.send, writes().onWrite)
  const window_ = bridge('notice')
  let heard = 0
  store.listen(window_, 'worlds', () => { heard++ })
  await store.read(window_, 'day')
  await settle()
  assert.deepEqual(k.asked, ['http://kernel.test/notice:worlds', 'http://kernel.test/notice:day'])
  assert.equal(heard, 1)

  store.receive([{event: 'model_changed', slice: 'worlds', version: 1}, {event: 'model_changed', slice: 'day', version: 1}])
  await settle()
  assert.equal(k.asked.length, 2, 'a notice naming the version held asks nothing')

  store.receive([{event: 'model_changed', slice: 'worlds', version: 2}, {event: 'model_changed', slice: 'day', version: 2}])
  await settle()
  assert.deepEqual(k.asked.slice(2), ['http://kernel.test/notice:worlds'], 'the listened slice is asked at once; the other waits for its reader')
  assert.equal(heard, 2)
  assert.equal(store.held(window_, 'worlds').answer.version, 2)
  assert.equal((await store.read(window_, 'day')).answer.version, 2, 'its next read asks')
  assert.equal(k.asked.length, 4)
})

test('a notice that lands while an ask is in flight asks once more after it, so the newer slice is the one held', async () => {
  const k = kernel((slice, n) => answer(slice, n))
  const store = createModelStore(k.send, writes().onWrite)
  const window_ = bridge('crossing')
  k.hold()
  store.listen(window_, 'sessions', () => {})
  await settle()
  assert.equal(k.asked.length, 1, 'the first ask is out')
  store.receive([{event: 'model_changed', slice: 'sessions', version: 2}])
  assert.equal(k.asked.length, 1, 'no second ask while the first is in flight')
  k.release()
  await settle()
  assert.equal(k.asked.length, 2, 'the answer to the first ask (version 1) is older than the notice: asked once more')
  assert.equal(store.held(window_, 'sessions').answer.version, 2)
  await settle()
  assert.equal(k.asked.length, 2, 'and no more')
})

test('a write this window completed leaves nothing held current: listened slices are asked at once, the rest at their next read', async () => {
  const k = kernel((slice, n) => answer(slice, n))
  const registry = writes()
  const store = createModelStore(k.send, registry.onWrite)
  const window_ = bridge('write')
  store.listen(window_, 'worlds', () => {})
  await store.read(window_, 'day')
  await settle()
  assert.equal(k.asked.length, 2)
  registry.wrote()
  await settle()
  assert.deepEqual(k.asked.slice(2), ['http://kernel.test/write:worlds'], 'the listened slice is asked again at once')
  await store.read(window_, 'day')
  assert.equal(k.asked.length, 4, 'the other is asked at its next read: the kernel answers it after its own re-read')
  await store.read(window_, 'day')
  assert.equal(k.asked.length, 4, 'once')
})

test('an answer never replaces a newer one already held', async () => {
  const versions = [3, 2]
  const k = kernel(slice => answer(slice, versions.shift()))
  const registry = writes()
  const store = createModelStore(k.send, registry.onWrite)
  const window_ = bridge('older')
  assert.equal((await store.read(window_, 'factory')).answer.version, 3)
  registry.wrote()
  assert.equal((await store.read(window_, 'factory')).answer.version, 3, 'the older answer is not taken')
})

test('a refusal is the kernel\'s words; a listened slice that is refused waits for the next notice or write, never asks in a loop', async () => {
  const k = kernel(() => ({outcome: null, error: 'The kernel could not read Central.'}))
  const registry = writes()
  const store = createModelStore(k.send, registry.onWrite)
  const window_ = bridge('refused')
  let heard = 0
  store.listen(window_, 'worlds', () => { heard++ })
  await settle()
  assert.deepEqual(store.held(window_, 'worlds'), {state: 'unavailable', reason: 'The kernel could not read Central.'})
  assert.equal(heard, 1)
  assert.equal(k.asked.length, 1, 'no loop')
  store.receive([{event: 'model_changed', slice: 'worlds', version: 4}])
  await settle()
  assert.equal(k.asked.length, 2, 'the next notice asks again')
  registry.wrote()
  await settle()
  assert.equal(k.asked.length, 3, 'so does the next write')
})

test('an unavailable transport is said in its own words and nothing is sent', async () => {
  const k = kernel((slice, n) => answer(slice, n))
  const store = createModelStore(k.send, writes().onWrite)
  const reading = await store.read({kind: 'unavailable', reason: 'No kernel carrier in this window.'}, 'agents')
  assert.deepEqual(reading, {state: 'unavailable', reason: 'No kernel carrier in this window.'})
  assert.equal(k.asked.length, 0)
})

test('the contract: a notice names a known slice and a version of at least 1; an answer is the slice asked for', () => {
  assert.deepEqual(modelChangedOf({event: 'model_changed', slice: 'sky', version: 7}), {slice: 'sky', version: 7})
  for (const receipt of [{event: 'readings_changed', slice: 'sky', version: 7}, {event: 'model_changed', slice: 'weather', version: 7},
    {event: 'model_changed', slice: 'sky', version: 0}, {event: 'model_changed', slice: 'sky', version: 1.5}, {event: 'model_changed', slice: 'sky'}]) {
    assert.equal(modelChangedOf(receipt), null, JSON.stringify(receipt))
  }
  assert.equal(sliceOf(answer('day', 1).outcome, undefined, 'day').state, 'held')
  assert.match(sliceOf(answer('day', 1).outcome, undefined, 'worlds').reason, /not a slice/)
  assert.match(sliceOf({result: 'day_reading', data: {}}, undefined, 'day').reason, /answered day_reading/)
  assert.deepEqual(sliceOf(null, 'refused in words', 'day'), {state: 'unavailable', reason: 'refused in words'})
})

test('a slice\'s value: a held state, the owner\'s words for one never read, or the store\'s', () => {
  const held = sliceOf(answer('models', 2, {catalogue: []}).outcome, undefined, 'models')
  assert.deepEqual(sliceValue(held), {ok: true, value: {catalogue: []}, answer: held.answer})
  const refused = sliceOf(answer('models', 1, null, {state: 'refused', error: 'AIKit refused: no home.'}).outcome, undefined, 'models')
  assert.deepEqual(sliceValue(refused), {ok: false, reason: 'AIKit refused: no home.'})
  const unread = sliceOf(answer('models', 0, null, {state: 'unread', owner: 'AIKit'}).outcome, undefined, 'models')
  assert.deepEqual(sliceValue(unread), {ok: false, reason: 'AIKit has not been read yet.'})
  assert.deepEqual(sliceValue({state: 'reading'}), {ok: false, reason: 'The World Model has not answered yet.'})
})
