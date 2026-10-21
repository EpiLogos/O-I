// Central's browser rows read once, and draw their last reading first (PATH §7 row L1: "the Flows rows read each Flow twice —
// the page listing reads every Flow to place it, then `useRowReadings` reads each again with `file_read`, one at a time").
//
// The instrument: the REAL rows (shell/ModeBrowser.tsx, mounted by React's own DOM renderer over a small DOM stand-in, so every
// effect runs as it does in the window) over a COUNTING FAKE KERNEL — `fetch` answering the bridge's ops (`page`, `file_read`,
// `files_list`, `day_read`) with the shapes the owners give, recording each op asked and how many were in flight together.
// Channel: scripted (headless, no browser). What a person sees in the window is the lead's screen pass: UNVERIFIED here.
//
// A window opened again is a second GENERATION of the shell's modules (fixtures/browser-rows-one-read/loader.mjs): fresh module
// state, the same storage — the relaunch of owners/keptReadings.ts, not a simulation of it.
import test, {after} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register('./fixtures/browser-rows-one-read/loader.mjs', {parentURL: import.meta.url, data: {compiler, reactFrom: import.meta.url}})

const fixture = JSON.parse(readFileSync(new URL('./fixtures/browser-rows-one-read/flows.json', import.meta.url), 'utf8'))

// ── a small DOM, enough for React to render the browser rows and run their effects ─────────────────────────────────────────

const HTML = 'http://www.w3.org/1999/xhtml'
class Node_ {
  constructor(nodeType, nodeName) { this.nodeType = nodeType; this.nodeName = nodeName; this.childNodes = []; this.parentNode = null }
  get ownerDocument() { return document_ }
  get firstChild() { return this.childNodes[0] ?? null }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null }
  get nextSibling() { const siblings = this.parentNode?.childNodes; return siblings ? siblings[siblings.indexOf(this) + 1] ?? null : null }
  get previousSibling() { const siblings = this.parentNode?.childNodes; return siblings ? siblings[siblings.indexOf(this) - 1] ?? null : null }
  appendChild(child) { return this.insertBefore(child, null) }
  insertBefore(child, before) {
    child.parentNode?.removeChild(child)
    this.childNodes.splice(before ? this.childNodes.indexOf(before) : this.childNodes.length, 0, child)
    child.parentNode = this
    return child
  }
  removeChild(child) {
    const at = this.childNodes.indexOf(child)
    if (at < 0) throw new Error('removeChild: not a child')
    this.childNodes.splice(at, 1)
    child.parentNode = null
    return child
  }
  addEventListener() {}
  removeEventListener() {}
  get textContent() { return this.childNodes.map(child => child.textContent).join('') }
  set textContent(value) { for (const child of this.childNodes) child.parentNode = null; this.childNodes = []; if (value) this.appendChild(new Text_(String(value))) }
}
class Text_ extends Node_ {
  constructor(data) { super(3, '#text'); this.data = data }
  get nodeValue() { return this.data }
  set nodeValue(value) { this.data = String(value) }
  get textContent() { return this.data }
  set textContent(value) { this.data = String(value) }
}
class Element_ extends Node_ {
  constructor(name, namespace = HTML) {
    super(1, namespace === HTML ? name.toUpperCase() : name)
    this.tagName = this.nodeName; this.namespaceURI = namespace; this.attributes = new Map(); this.style = {setProperty() {}, removeProperty() {}}
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  setAttributeNS(_, name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  removeAttribute(name) { this.attributes.delete(name) }
  removeAttributeNS(_, name) { this.attributes.delete(name) }
  hasAttribute(name) { return this.attributes.has(name) }
  /** A mark's drawing (dangerouslySetInnerHTML): kept as the string, not parsed. */
  get innerHTML() { return this.markup ?? '' }
  set innerHTML(value) { this.markup = String(value); for (const child of this.childNodes) child.parentNode = null; this.childNodes = [] }
}
const listeners = new Map()
const document_ = Object.assign(new Node_(9, '#document'), {
  createElement: name => new Element_(name), createElementNS: (namespace, name) => new Element_(name, namespace), createTextNode: data => new Text_(data),
  body: null, activeElement: null, visibilityState: 'visible', hidden: false, getElementById: () => null,
  addEventListener: (type, listener) => listeners.set(`document:${type}`, [...(listeners.get(`document:${type}`) ?? []), listener]),
  removeEventListener() {},
})
document_.body = new Element_('body'); document_.documentElement = new Element_('html')
const memoryStorage = () => { const memory = new Map(); return {getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, String(value)) }, removeItem: key => { memory.delete(key) }} }
const storage = memoryStorage()
const window_ = {
  document: document_, localStorage: storage, HTMLIFrameElement: class {}, location: {href: 'http://localhost/', origin: 'http://localhost', search: '', hash: ''},
  addEventListener: (type, listener) => listeners.set(`window:${type}`, [...(listeners.get(`window:${type}`) ?? []), listener]),
  removeEventListener() {}, matchMedia: () => ({matches: false, addEventListener() {}, removeEventListener() {}}),
  requestAnimationFrame: callback => setTimeout(callback, 16), cancelAnimationFrame: id => clearTimeout(id),
}
Object.assign(globalThis, {window: window_, document: document_, localStorage: storage})
/** The window is hidden or closed: its kept answers are written (owners/keptReadings.ts windowKeptReadings). */
const hideWindow = () => { for (const listener of listeners.get('window:pagehide') ?? []) listener({}) }

const {flushSync} = await import('react-dom')
const {createRoot} = await import('react-dom/client')
const {createElement} = await import('react')
const words = await import('../src/frame/browser/rowWords.ts')

/** A window opened: the shell's modules as generation `generation` loads them, with their own module state, and the kept readings of
 * the storage the window has when it opens (`own`: a storage of its own, where the suite's is not wanted). */
async function openWindow(generation, own = null) {
  const shared = globalThis.localStorage
  if (own) globalThis.localStorage = own
  try {
    const {ModeBrowser} = await import(`../src/shell/ModeBrowser.tsx?g=${generation}`)
    const {StubWorkspaceProvider} = await import(`../src/shell/workspaceContext.tsx?g=${generation}`)
    return {ModeBrowser, StubWorkspaceProvider}
  } finally { globalThis.localStorage = shared }
}

/** The browser's rows for one category, mounted. `close` unmounts them (their readers leave; the window keeps the last reading). */
function mountRows(shell, transport, category) {
  const container = new Element_('div')
  document_.body.appendChild(container)
  const root = createRoot(container)
  flushSync(() => root.render(createElement(shell.StubWorkspaceProvider, {transport},
    createElement(shell.ModeBrowser, {mode: 'base', onSelectSubject: () => {}, selectedSubject: null, controlled: {category, query: '', poolHost: null}}))))
  return {
    container,
    close: () => { flushSync(() => root.unmount()); document_.body.removeChild(container) },
    /** Each drawn row as [name, standing] (the mockup's `.nm` and `.st`). */
    rows: () => {
      const found = []
      const walk = node => {
        if (node.nodeType === 1 && node.attributes.get('class')?.split(' ')[0] === 'mode-browser-row') {
          const spans = node.childNodes.filter(child => child.nodeType === 1 && child.nodeName === 'SPAN')
          found.push([spans[1]?.textContent ?? '', spans[2]?.textContent ?? ''])
        } else for (const child of node.childNodes) walk(child)
      }
      walk(container)
      return found
    },
    text: () => container.textContent,
  }
}

// ── a counting fake kernel ─────────────────────────────────────────────────────────────────────────────────────────────────

const location = path => ({schema: 'central.path-ref/v1', ref: `central:path:${fixture.root}:${path}`, root: fixture.root, path})
const flowPath = name => `${fixture.path}/${name}`
const revisionOf = name => `central.content-fnv1a64/v1:${name.length}:${name.replace(/\W/g, '').slice(-12)}`
/** A Flow's page as its file holds it: the ql-doc island (flow/instance.ts parseInstance reads exactly this). */
const flowHtml = flow => `<!doctype html><html><body><script type="application/json" id="ql-doc">${JSON.stringify({entries: [], meta: flow.meta})}</script></body></html>`

/** What the page owner lists for the Flows (kernel page.rs list_pages). A Flow `carries` its words when the listing gives, beside
 * its place, the three `meta` keys its row draws — `{title, revision, participants: [{kind, name, initial}]}`, the shape PROPOSE asks
 * of the kernel; the kernel as it lists today carries none. A Being and a Thing stand in the same folder: they list, and are no Flow. */
function pageListing({flows, carries}) {
  const pages = flows.map(flow => ({location: location(flowPath(flow.name)), name: flow.name, form: 'flow', title: flow.meta.title ?? null, revision: revisionOf(flow.name), world: null,
    ...(carries(flow) ? {flow: {title: flow.meta.title ?? null, revision: flow.meta.revision ?? null,
      participants: (flow.meta.participants ?? []).map(({kind, name, initial}) => ({kind, name, initial}))}} : {})}))
  pages.push({location: location(flowPath('mira.html')), name: 'mira.html', form: 'being', title: 'Mira', revision: revisionOf('mira.html'), world: 'central:wiki:project:O-I'},
    {location: location(flowPath('stone.html')), name: 'stone.html', form: 'thing', title: 'The stone', revision: revisionOf('stone.html'), world: 'central:wiki:project:O-I'})
  return {schema: 'oi.page-list/v1', path: fixture.path, pages, not_pages: [{name: 'epi-card-2026-09-24-1250.html', why: 'This file is no page: it carries no ql-doc island'}], more: false}
}

const dayNamesOf = count => Array.from({length: count}, (_, index) => new Date(Date.UTC(2026, 9, 20 - index)).toISOString().slice(0, 10))

/** The fake kernel behind `transport.url`: every op recorded in the order asked, with how many were in flight together. `carries`
 * says which Flows the listing carries the words of; `gate` holds the page listing until released (a read still running). */
function fakeKernel({url, flows = fixture.flows, carries = () => true, days = 0, gate = null}) {
  const asked = []
  const state = {inflight: 0, mostInflight: 0, fileReadsInflight: 0, mostFileReadsInflight: 0}
  const original = globalThis.fetch
  const answer = op => {
    if (op.op === 'page' && op.request.operation === 'list') return {ok: true, outcome: {result: 'page_reading', data: pageListing({flows, carries})}}
    if (op.op === 'file_read') {
      const flow = flows.find(item => op.location.path === flowPath(item.name))
      return flow ? {ok: true, outcome: {result: 'file_read', reading: {schema: 'central.file-reading/v1', location: op.location, revision: revisionOf(flow.name), byte_len: flow.byte_len,
        content_encoding: 'utf-8', content: flowHtml(flow), project: null, source: null, automatic_agent_or_model_invocation: false}}} : {ok: false, error: `No such file: ${op.location.path}`}
    }
    if (op.op === 'files_list' && op.path === 'Control/user/day') {
      return {ok: true, outcome: {result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: location('Control/user/day'), automatic_agent_or_model_invocation: false,
        entries: dayNamesOf(days).map(name => ({name, kind: 'directory', byte_len: 0, retrieval_allowed: true, location: location(`Control/user/day/${name}`)}))}}}
    }
    if (op.op === 'day_read') {
      const date = String(op.day_ref).slice(-10)
      return {ok: true, outcome: {result: 'day_reading', data: {schema: 'central.day-reading/v1', day_ref: op.day_ref, source: {ref: `central:source:${date}`, path: `Control/user/day/${date}/day.md`},
        revision: {revision: revisionOf(date)}, content: '', temporal: {day_ref: op.day_ref, civil_date: date, lifecycle: 'closed'}, document_state: 'ready'}}}
    }
    return {ok: false, error: `the fake kernel answers no ${op.op}`}
  }
  globalThis.fetch = async (target, init) => {
    if (!String(target).startsWith(url)) return original(target, init)
    const op = JSON.parse(init.body)
    asked.push(op)
    state.inflight++; state.mostInflight = Math.max(state.mostInflight, state.inflight)
    if (op.op === 'file_read') { state.fileReadsInflight++; state.mostFileReadsInflight = Math.max(state.mostFileReadsInflight, state.fileReadsInflight) }
    try {
      await null
      if (gate && op.op === 'page') await gate.promise
      return {json: async () => answer(op)}
    } finally {
      state.inflight--
      if (op.op === 'file_read') state.fileReadsInflight--
    }
  }
  return {
    asked, state,
    /** The ops asked, in order, by name. */
    ops: () => asked.map(op => op.op === 'page' ? `page:${op.request.operation}` : op.op),
    count: name => asked.filter(op => op.op === name).length,
    restore: () => { globalThis.fetch = original },
  }
}
/** Run `body` over a fake kernel, whatever it does. */
async function over(options, body) {
  const kernel = fakeKernel(options)
  try { return await body(kernel) } finally { kernel.restore() }
}
const gate = () => { let release; const promise = new Promise(resolve => { release = resolve }); return {promise, release} }

/** Wait until the kernel is idle and has been asked nothing for a few turns. */
async function quiet(kernel) {
  let last = -1, still = 0
  for (let turn = 0; turn < 400 && still < 4; turn++) {
    await new Promise(resolve => setImmediate(resolve))
    still = kernel.asked.length === last && kernel.state.inflight === 0 ? still + 1 : 0
    last = kernel.asked.length
  }
}

/** The rows the Flows draw when each Flow's words are known: newest first, each by its own title, its agents and its revision. */
const expectedFlowRows = (flows = fixture.flows) => [...flows].sort(words.flowOrder)
  .map(flow => { const row = words.flowRowWords(flow.name, words.flowReadingOf({meta: flow.meta})); return [row.name, row.standing] })

let transports = 0
const transportFor = label => ({kind: 'bridge', url: `http://kernel.test/${label}-${++transports}`})
const KEPT_KEY = 'oi.owner-readings/v1'

after(() => hideWindow())

// ── the instrument's own check ─────────────────────────────────────────────────────────────────────────────────────────────

test('the rows the fixture should give are the owner\'s own words for thirteen Flows', () => {
  const rows = expectedFlowRows()
  assert.equal(rows.length, 13)
  assert.deepEqual(rows[0], ['Mercurius and the stone', 'with Fizz +1 · r12'], 'the newest minted name first; its two agents, the second by its initial alone')
  assert.ok(rows.some(row => row[0] === 'Factory original development Run — execution and continuation' && row[1] === 'with Factory coordinator · r8'))
  assert.deepEqual(rows.find(row => row[0] === 'flow-2026-09-23-1832'), ['flow-2026-09-23-1832', 'r0'], 'a Flow with no title is its file name; its revision stands alone')
  assert.deepEqual(rows.at(-1), ['OI203 joined two-Workcell episode: multiagent', 'with Mira · r1'], 'a hand-named Flow after every minted one')
})

test('flowReadingsOfListing: only a Flow the listing gives a words record for has an entry, and the words are the row parser\'s', async () => {
  const {flowReadingsOfListing} = await import('../src/shell/ModeBrowser.tsx?g=1')
  const page = (name, form, flow) => ({location: location(flowPath(name)), name, form, title: null, revision: 'r', world: null, ...(flow === undefined ? {} : {flow})})
  const readings = flowReadingsOfListing({schema: 'oi.page-list/v1', path: fixture.path, more: false, not_pages: [], pages: [
    page('a.html', 'flow', {title: ' A title ', revision: 4, participants: [{kind: 'agent', name: 'Fizz'}, {kind: 'person', initial: 'F'}]}),
    page('b.html', 'flow'), page('c.html', 'flow', null), page('d.html', 'being', {title: 'not a Flow'}), page('e.html', 'flow', 'words')]})
  assert.deepEqual([...readings.keys()], [location(flowPath('a.html')).ref], 'no record, a null one, a string, or a page of another form: no entry')
  assert.deepEqual(readings.get(location(flowPath('a.html')).ref), words.flowReadingOf({meta: {title: 'A title', revision: 4, participants: [{kind: 'agent', name: 'Fizz'}]}}))
  assert.deepEqual(readings.get(location(flowPath('a.html')).ref), {state: 'read', title: 'A title', revision: 4, agents: ['Fizz']})
})

// ── (a) the first draw ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('(a) first draw of 13 Flows: one listing and no read of any Flow — the rows take what the listing read', async () => {
  const shell = await openWindow(1)
  const transport = transportFor('first-draw')
  await over({url: transport.url}, async kernel => {
    const rows = mountRows(shell, transport, 'central-flows')
    assert.match(rows.text(), /Reading the Flows…/, 'before the owner answers, the rows say so')
    await quiet(kernel)
    assert.deepEqual(rows.rows(), expectedFlowRows(), 'every Flow by its title, its agents and its revision')
    assert.ok(kernel.asked.length <= 2, `at most one listing and one batch read, asked: ${kernel.ops().join(', ')}`)
    assert.deepEqual(kernel.ops(), ['page:list'], 'the listing alone: the Flows were read once, to place them')
    assert.equal(kernel.count('file_read'), 0, 'no Flow is read again, one at a time or otherwise')
    assert.doesNotMatch(rows.text(), /Reading the Flows…/)
    rows.close()
  })
})

test('a Flow whose words the listing does not carry is read on its own, one after another; the rest are not read', async () => {
  const shell = await openWindow(1)
  const transport = transportFor('listing-partly')
  const lacking = new Set(fixture.flows.slice(0, 5).map(flow => flow.name))
  await over({url: transport.url, carries: flow => !lacking.has(flow.name)}, async kernel => {
    const rows = mountRows(shell, transport, 'central-flows')
    await quiet(kernel)
    assert.deepEqual(rows.rows(), expectedFlowRows(), 'the same words, whichever way each Flow came by them')
    assert.deepEqual(kernel.ops(), ['page:list', ...Array(5).fill('file_read')])
    assert.equal(kernel.state.mostFileReadsInflight, 1, 'the carrier never sees a pile of reads')
    rows.close()
  })
})

test('a listing that carries no Flow\'s words (the kernel before it does) leaves the rows as they were: each Flow read once, one after another', async () => {
  const shell = await openWindow(1)
  const transport = transportFor('listing-without')
  await over({url: transport.url, carries: () => false}, async kernel => {
    const rows = mountRows(shell, transport, 'central-flows')
    await quiet(kernel)
    assert.deepEqual(rows.rows(), expectedFlowRows())
    assert.deepEqual(kernel.ops(), ['page:list', ...Array(13).fill('file_read')], 'measured: 14 ops for 13 Flows, the listing and a read of each')
    assert.equal(kernel.state.mostFileReadsInflight, 1)
    rows.close()
  })
})

// ── (b) a return, (c) a relaunch ───────────────────────────────────────────────────────────────────────────────────────────

test('(b) a return draws the last rows at once and asks the owner once behind them', async () => {
  const shell = await openWindow(1)
  const transport = transportFor('return')
  await over({url: transport.url}, async kernel => {
    const before = mountRows(shell, transport, 'central-flows')
    await quiet(kernel)
    assert.deepEqual(before.rows(), expectedFlowRows())
    before.close()
    await quiet(kernel)
  })
  // The return: the owner is slow to answer, and the rows stand drawn meanwhile.
  const held = gate()
  await over({url: transport.url, gate: held}, async kernel => {
    const back = mountRows(shell, transport, 'central-flows')
    assert.deepEqual(back.rows(), expectedFlowRows(), 'the last reading is drawn before the owner has answered, every Flow\'s words with it')
    assert.doesNotMatch(back.text(), /Reading the Flows…/, 'no waiting status over rows that are drawn')
    assert.deepEqual(kernel.ops(), ['page:list'], 'the listing is asked again behind them, and nothing else is asked')
    held.release()
    await quiet(kernel)
    assert.deepEqual(back.rows(), expectedFlowRows())
    assert.deepEqual(kernel.ops(), ['page:list'], 'the return read the owner once: the Flows come with the listing')
    back.close()
  })
})

test('(b, control) rows that were never read are not drawn from nothing: the waiting status stands, and the instrument sees it', async () => {
  const shell = await openWindow(1)
  const transport = transportFor('stranger')
  const held = gate()
  await over({url: transport.url, gate: held}, async kernel => {
    const rows = mountRows(shell, transport, 'central-flows')
    assert.match(rows.text(), /Reading the Flows…/)
    assert.deepEqual(rows.rows(), [])
    held.release()
    await quiet(kernel)
    assert.equal(rows.rows().length, 13)
    rows.close()
  })
})

test('(c) a relaunch draws the last rows first: the window\'s kept readings reach the browser rows, and the owner is asked once behind them', async () => {
  const transport = transportFor('relaunch')
  const shell = await openWindow(1)
  await over({url: transport.url}, async kernel => {
    const rows = mountRows(shell, transport, 'central-flows')
    await quiet(kernel)
    assert.deepEqual(rows.rows(), expectedFlowRows())
    rows.close()
  })
  hideWindow()
  assert.match(storage.getItem(KEPT_KEY) ?? '', /page_list/, 'the window kept the listing in its own storage')

  // The control: a window opened over an empty storage has nothing to draw first.
  const nothing = await openWindow(3, memoryStorage())
  assert.notEqual(nothing.ModeBrowser, shell.ModeBrowser, 'a window opened again is a fresh copy of the shell\'s modules')
  const waiting = gate()
  await over({url: transport.url, gate: waiting}, async kernel => {
    const rows = mountRows(nothing, transport, 'central-flows')
    assert.match(rows.text(), /Reading the Flows…/, 'with nothing kept, the first paint waits for the owner')
    assert.deepEqual(rows.rows(), [])
    waiting.release()
    await quiet(kernel)
    rows.close()
  })

  // The window is opened again: every module of the shell afresh, the kept readings the same.
  const again = await openWindow(2)
  assert.notEqual(again.ModeBrowser, shell.ModeBrowser)
  const held = gate()
  await over({url: transport.url, gate: held}, async kernel => {
    const rows = mountRows(again, transport, 'central-flows')
    assert.deepEqual(rows.rows(), expectedFlowRows(), 'the first paint of the new window is the last reading, every Flow\'s words with it')
    assert.doesNotMatch(rows.text(), /Reading the Flows…/)
    assert.deepEqual(kernel.ops(), ['page:list'])
    held.release()
    await quiet(kernel)
    assert.deepEqual(rows.rows(), expectedFlowRows())
    assert.deepEqual(kernel.ops(), ['page:list'], 'the relaunch asked the owner once')
    rows.close()
  })
})

// ── the other Central rows in the same file ────────────────────────────────────────────────────────────────────────────────

test('Beings and Things: the listing is all they read — one listing shared with the Flows, no read per row', async () => {
  const shell = await openWindow(1)
  const transport = transportFor('pages')
  await over({url: transport.url}, async kernel => {
    const flows = mountRows(shell, transport, 'central-flows')
    const beings = mountRows(shell, transport, 'central-beings')
    const things = mountRows(shell, transport, 'central-things')
    await quiet(kernel)
    assert.deepEqual(beings.rows(), [['Mira', 'being · O-I']])
    assert.deepEqual(things.rows(), [['The stone', 'thing · O-I']])
    assert.equal(flows.rows().length, 13, 'a Being and a Thing in the same folder are no Flow')
    assert.deepEqual(kernel.ops(), ['page:list'], 'three categories, one owner read')
    for (const mounted of [flows, beings, things]) mounted.close()
  })
})

test('Days: each listed day is read for its standing, one after another and no more than 31 (found: no batch owner action exists for a Day)', async () => {
  const shell = await openWindow(1)
  const transport = transportFor('days')
  await over({url: transport.url, days: 40}, async kernel => {
    const rows = mountRows(shell, transport, 'central-days')
    await quiet(kernel)
    assert.equal(kernel.count('files_list'), 1)
    assert.equal(kernel.count('day_read'), 31, 'measured: one day_read per listed day, the newest 31 — 32 ops for 40 days')
    assert.equal(kernel.state.mostInflight, 1, 'one after another: the carrier never sees a pile')
    assert.equal(rows.rows().length, 40)
    const standing = words.dayStandingWords(words.dayStandingOf({day_ref: 'x', temporal: {lifecycle: 'closed'}, document_state: 'ready', revision: {revision: revisionOf('2026-10-20')}}))
    assert.deepEqual(rows.rows()[0], [words.dayWords('2026-10-20'), standing])
    assert.deepEqual(rows.rows()[39], [words.dayWords(dayNamesOf(40)[39]), ''], 'a day past the 31 read keeps its listed words')
    rows.close()
  })
})
