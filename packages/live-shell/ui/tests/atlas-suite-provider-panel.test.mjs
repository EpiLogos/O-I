// The Earth pane over the suite provider (T-N3-ATLAS-SUITE-PROVIDER, host leg). The real panel runs through its attach path with the
// real suite provider, reading the recorded 14 Oct 2026 owner readings (tests/fixtures/atlas-suite-reading.json) through the real
// kernel client over a stand-in fetch. Only the WebGL mount is stood in for (fixtures/atlas-mount-stub.mjs). What is claimed:
//   - the panel registers the suite as the default corpus provider and mounts it by id;
//   - the Earth side names how many of the owners' subjects it does not draw, before the Sun's words, in the Info view's hover —
//     the globe's data-i — never over the globe (T-PLACES-ONTO-ATLAS; the lead saw the paragraph over the globe at 11475cc3d);
//   - the Graph side does not say it (the Graph draws every subject), and the words return on the Earth;
//   - an owner that does not answer is named in the pane with its own detail, and the mount fails by name when none does;
//   - closing the pane removes the line.
// What is NOT claimed here: that the real globe draws. The harness over the recorded fixture is run in a browser (see the ticket receipt).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const mountStub = new URL('./fixtures/atlas-mount-stub.mjs', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const STUBS = {'./mount': ${JSON.stringify(mountStub)}};
export async function resolve(s, c, n) {
  if (c.parentURL && c.parentURL.endsWith('/AtlasProjectionPanel.tsx') && STUBS[s]) return {url: STUBS[s], format: 'module', shortCircuit: true};
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
  const text = (await readFile(new URL(u), 'utf8')).replace(/import\\.meta\\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(text, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

// ── a DOM stand-in (as tests/atlas-dispose.test.mjs): the attach path creates, appends and empties elements ──
class FakeClassList {
  set = new Set()
  add(...names) { names.forEach(n => this.set.add(n)) }
  remove(...names) { names.forEach(n => this.set.delete(n)) }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : !!force
    if (on) this.set.add(name)
    else this.set.delete(name)
    return on
  }
  contains(name) { return this.set.has(name) }
}
class FakeNode {
  children = []
  attrs = {}
  classList = new FakeClassList()
  dataset = {}
  className = ''
  textContent = ''
  isConnected = true
  parent = null
  constructor(tag) { this.tagName = tag }
  append(...nodes) { for (const node of nodes) node.parent = this; this.children.push(...nodes) }
  replaceChildren(...nodes) { this.children = [...nodes] }
  setAttribute(name, value) { this.attrs[name] = String(value) }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this) }
  closest() { return null }
}
class CountingTarget {
  addEventListener() {}
  removeEventListener() {}
}
class FakeObserver {
  observe() {}
  disconnect() {}
}
globalThis.window = new CountingTarget()
globalThis.document = {
  createElement: tag => new FakeNode(tag),
  body: new FakeNode('body'),
  documentElement: new FakeNode('html'),
  addEventListener() {},
  removeEventListener() {},
}
globalThis.MutationObserver = FakeObserver
globalThis.IntersectionObserver = FakeObserver

const fixture = JSON.parse(await readFile(new URL('./fixtures/atlas-suite-reading.json', import.meta.url), 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))
const location = {schema: 'central.path-ref/v1', ref: 'ref:Control/agents/wiki/wiki.json', root: 'Control', path: 'Control/agents/wiki/wiki.json'}
const calls = []
let failing = false
globalThis.fetch = async (url, init) => {
  const op = JSON.parse(init.body)
  calls.push(op.op === 'graph' ? `graph:${op.options.input}` : op.op)
  if (failing && op.op === 'graph') return Response.json({ok: false, error: `the kernel did not answer ${op.options.input}`})
  if (op.op === 'graph') return Response.json({ok: true, outcome: {result: 'graph_reading', reading: clone(fixture.graph[op.options.input])}})
  if (op.op === 'files_list') return Response.json({ok: true, outcome: {result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: {schema: 'central.path-ref/v1', ref: 'ref:Control/agents/wiki', root: 'Control', path: 'Control/agents/wiki'}, automatic_agent_or_model_invocation: false, entries: [{name: 'wiki.json', kind: 'file', byte_len: 9023, retrieval_allowed: true, location}]}}})
  if (op.op === 'file_read') return Response.json({ok: true, outcome: {result: 'file_read', reading: {schema: 'central.file-reading/v1', location: op.location, revision: fixture.wikiFile.revision, byte_len: 9023, content_encoding: 'utf-8', content: JSON.stringify({objects: fixture.wikiFile.objects}), project: null, source: null, automatic_agent_or_model_invocation: false}}})
  return Response.json({ok: false, error: `this stand-in does not serve ${op.op}`})
}

const transport = {kind: 'bridge', url: 'http://bridge.panel.test'}
const stub = await import(mountStub)
const panel = await import(new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url).href)
const registry = await import(new URL('../src/projections/atlas/provider/corpusProvider.ts', import.meta.url).href)
const standingStore = await import(new URL('../src/projections/atlas/provider/suiteStanding.ts', import.meta.url).href)
panel.bindAtlasScope({namespace: 'test.atlas-suite-panel', workspaceId: 'w1'})

const pane = () => new FakeNode('div')
/** What the Earth says of itself: its globe's Info view words (`data-i`, "Earth|…"). */
const said = element => element.children.find(child => child.id === 'globe')?.attrs['data-i'] ?? ''
const standingOf = element => /Your world: /.test(said(element)) ? said(element) : undefined
/** Anything drawn over the globe as a line of text (the pane's old status lines). */
const linesOver = element => element.children.filter(child => child.className === 'atlas-host-status' || /flex-direction:column/.test(child.attrs.style ?? ''))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

test('the pane reads the suite, registers it as the default corpus provider, and mounts it by id', async () => {
  const mounts = stub.stubState().mounts
  const element = pane()
  const attachment = await panel.attachAtlas({element, transport, follow: true})
  assert.equal(attachment.held, null)
  assert.equal(stub.stubState().mounts, mounts + 1)
  assert.deepEqual(calls.slice(0, 5), ['graph:central_wiki', 'files_list', 'file_read', 'graph:shared_field', 'graph:aikit_resolution'], 'the owners are read one input at a time through the kernel client')
  assert.equal(registry.corpusProvider().id, 'suite', 'the suite is the registered default')
  assert.equal(registry.corpusProvider().name, 'Your world')
  const bundle = await registry.loadProvider()
  assert.equal(bundle.field.occurrences.length, 45, 'the bundle the atlas mounts is the one the panel composed')
  assert.equal(bundle.field.meta.provider.name, 'Your world')
  attachment.unmount()
})

test('the Earth side names how many subjects it does not draw, before the Sun, in the Info view\'s hover — never over the globe', async () => {
  const element = pane()
  const attachment = await panel.attachAtlas({element, transport, follow: true})
  assert.deepEqual(linesOver(element), [], 'no line of text stands over the globe')
  const standing = standingOf(element)
  assert.ok(standing, 'the world\'s standing is said on the Earth')
  assert.match(standing, /^Earth\|Your world: 45 subjects read from their owners, none on the Earth\. No owner declares where they are, so the Earth draws them nowhere\. 15 places are unlocated too\. 45 are undated\. AIKit knowledge: unavailable — AIKit is unavailable: AIKit knowledge read did not return within 20 seconds\. /)
  await sleep(50)
  assert.match(said(element), /seconds\. The Sun /, 'the Sun\'s words follow the standing\'s')
  assert.ok(said(element).endsWith(panel.GLOBE_GESTURES), 'and the globe\'s own gestures close them')
  assert.equal(standingStore.suiteStanding().counts.unlocated, 45, 'the words say what the standing holds')
  attachment.unmount()
})

test('the Graph side is silent about it, the Earth says it again, and closing the pane removes it', async () => {
  const element = pane()
  const attachment = await panel.attachAtlas({element, transport, follow: true})
  assert.ok(standingOf(element))
  panel.presentAtlasView('graph')
  assert.equal(standingOf(element), undefined, 'the Graph draws every subject, so it does not say they are not drawn')
  panel.presentAtlasView('earth')
  assert.ok(standingOf(element), 'back on the Earth, the line returns')
  attachment.unmount()
  assert.equal(standingOf(element), undefined, 'closing the pane removes the words')
})

test('an owner input that does not answer is named in the pane, and a mount with no owner answering fails by name', async () => {
  failing = true
  try {
    await assert.rejects(panel.attachAtlas({element: pane(), transport, follow: true}), error => {
      assert.match(error.message, /^The atlas data is unavailable\. /)
      for (const input of ['central_wiki', 'shared_field', 'aikit_resolution']) assert.ok(error.message.includes(`the kernel did not answer ${input}`), input)
      assert.ok(error.message.includes('Central’s wiki: unavailable — the kernel did not answer central_wiki.'))
      return true
    })
    const claimed = await panel.attachAtlas({element: pane(), transport: {kind: 'unavailable', reason: 'no bridge'}, follow: true}).catch(error => error)
    assert.match(claimed.message, /no bridge/, 'the claim was released, and the next attach reads again')
  } finally {
    failing = false
  }
  const element = pane()
  const attachment = await panel.attachAtlas({element, transport, follow: true})
  assert.ok(standingOf(element), 'a later pane over answering owners mounts')
  attachment.unmount()
})

test('the panel names the suite and no other source', async () => {
  const code = (await readFile(new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url), 'utf8')).split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n')
  assert.match(code, /import\('\.\/provider\/suiteProvider'\)/)
  assert.match(code, /provider: SUITE_PROVIDER_ID/)
  assert.doesNotMatch(code, /archetypalEarth|ARCHETYPAL_EARTH/)
})
