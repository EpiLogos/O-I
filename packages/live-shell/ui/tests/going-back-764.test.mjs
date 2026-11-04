import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import vm from 'node:vm'

// O-I #764 Going back: Back and Forward over one trail (DLW §10.7, §23.5). "Every place you go is kept on the trail … You return to the
// same place, the same page and the same point in the reading. Forward goes the other way, until you go somewhere new."
// The trail's law, the title line's Back and Forward and the Trail's times landed in 61e429b77 (tests/w1-pool-and-encounter.test.mjs
// '#764 …'). What the running shell did not yet do, and these tests hold it to:
//   - a mode switch made anywhere but the mode rail added no stop: the shell's one mode switch (continuity/workspace.tsx setMode) turned
//     the book's tree alone — the Canvas's return, the Expressions reveal, the Technē browser, the Workspace device, a hosted request;
//   - an open-where-it-lives (#846, frame/openWhereItLives.ts) made two stops — the mode, then the clip — the first a place nobody stood;
//   - no document told its point in the reading: the stops' `reading` was written only by a test's occasion intent, so Back landed on a
//     page at whatever point its frame stood. Now every hosted Central page tells its point (desktop/cradle/src/context/document-point.js)
//     through its pane's encounter, and a walk to a stop whose reading names the page brings that passage back.
// Channels: SCRIPTED — the book's trail law driven as the shell drives it (a fixture book with the workspace book's contract, the spine
// bridge, the title line's steps and the Trail's one return); the page script run in a VM realm against a fake page; the relay between a
// page's frame and its pane's encounter. CODE-READING — the wiring in App.tsx, the door, the faces, the pane and the frame. NOT a screen
// pass: the walk on the native candidate (Central → a document at a passage → Technē → Expressions, Back, Forward) is the lead's.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
const bus = new EventTarget()
globalThis.window ??= globalThis
globalThis.addEventListener = bus.addEventListener.bind(bus); globalThis.removeEventListener = bus.removeEventListener.bind(bus)
globalThis.dispatchEvent = bus.dispatchEvent.bind(bus)
const stored = new Map()
globalThis.localStorage ??= {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key), key: () => null, length: 0}

const store = await import('../../../../desktop/cradle/src/workspace/store.ts')
const {MODE_CURATION} = await import('../../../../desktop/cradle/src/workspace/mode.ts')
const frame = await import('../../../../desktop/cradle/src/document/frame.ts')
const encounterBridge = await import('../src/projections/encounterBridge.ts')
const rows = await import('../src/frame/encounter/encounterRows.ts')
const trailWidget = await import('../src/shell/TrailWidget.tsx')
const door = await import('../src/frame/openWhereItLives.ts')
const readingPoint = await import('../src/central/documents/readingPoint.ts').catch(error => ({missing: String(error)}))
const read = path => readFile(new URL(path, import.meta.url), 'utf8').catch(() => null)
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

// ── the book, driven as the shell drives it ──────────────────────────────────────────────────────────────────────────────────────

/** A fixture with the workspace book's contract: the context through its one bounded writer, the tree mode through switchMode, the
 * spine bridge over it, and the shell's acts — the mode rail's chooseMode (the move with the world it enters and THE selection an
 * opened thing lands on, then the shell's mode switch) and the shell's one mode switch (continuity/workspace.tsx setMode). */
const trailBook = (context = {}, mode = 'live') => {
  const book = {
    current: {context, layout: {mode}},
    setContext(change) { book.current = {...book.current, context: store.boundedContext(change(book.current.context ?? {}))} },
    switchMode(next) { book.current = {...book.current, layout: {...book.current.layout, mode: next}} },
  }
  const bridge = encounterBridge.createSpineEncounterBridge({current: {book, get workspace() { return {mode: book.current.layout.mode, accessEpoch: 1} }}})
  const setMode = (next, at) => encounterBridge.switchModeOnTrail(book, next, at)
  return {book, bridge, setMode, trail: () => book.current.context.trail ?? [], context: () => book.current.context, mode: () => book.current.layout.mode,
    chooseMode: (next, world, at, selection) => { book.setContext(c => encounterBridge.moveTo({...c, world, ...(selection ? {selection} : {})}, next, at)); setMode(next, at) },
    select: (selection, at) => book.setContext(c => store.selectOnTrail(c, selection, at)),
    /** The title line's Back or Forward: one step from the book's place on the trail, through the Trail's one return. */
    step(direction) {
      const index = rows.trailSteps(book.current.context.trail?.length ?? 0, store.standingOn(book.current.context))[direction]
      assert.notEqual(index, null, `${direction} stands`)
      trailWidget.returnToStop(book, index)
    }}
}
const SECRET = 'The whole text of the passage, which no stop holds.'
const SHAPE = {stop: ['mode', 'label', 'at', 'surfaceRef', 'surfaceKind', 'position', 'world', 'selection', 'subject', 'reading'],
  selection: ['mode', 'kind', 'ref', 'title', 'track'], subject: ['ref', 'kind', 'title', 'project'], reading: ['ref', 'position', 'title']}
/** Refs, titles, positions and a time: every key a stop holds is one of these, and no word of a page reaches it. */
const contentFree = stop => {
  for (const key of Object.keys(stop)) assert.ok(SHAPE.stop.includes(key), `a stop holds no ${key}`)
  for (const part of ['selection', 'subject', 'reading']) for (const key of Object.keys(stop[part] ?? {})) assert.ok(SHAPE[part].includes(key), `a stop's ${part} holds no ${key}`)
  assert.doesNotMatch(JSON.stringify(stop), /whole text/, 'no content reaches a stop')
}
const T = Date.UTC(2026, 10, 4, 9, 0)
const ESSAY = {mode: 'base', kind: 'note', ref: 'Control/user/flows/essay.html', title: 'Essay'}

// ── the page's point in the reading: the page script in a realm ─────────────────────────────────────────────────────────────────

const pointScript = await read('../../../../desktop/cradle/src/context/document-point.js')

/** A hosted page in a realm: `blocks` its text blocks (each a top, a height, shown or not), framed by a host or standing alone. The
 * realm's clock and timers turn by hand; `gesture` is the person's hand on the page (a wheel, a key); `scroll` scrolls the page. */
function pageRealm({framed = true, blocks = []} = {}) {
  const posted = [], listeners = [], timers = new Map(), observers = []
  let now = 1_000, nextTimer = 1
  const page = {scrollY: 0, innerHeight: 600, blocks: []}
  const block = ({text = 'words', top, height = 40, shown = true}) => ({textContent: text, top, height, shown, nodeType: 1, broughtUp: 0,
    getBoundingClientRect() { return {top: this.top - page.scrollY, bottom: this.top + this.height - page.scrollY} },
    checkVisibility() { return this.shown }, getClientRects() { return this.shown ? [{}] : [] },
    scrollIntoView(options) { assert.equal(options?.block, 'start', 'the passage comes to the top'); this.broughtUp++; page.scrollY = this.top }})
  page.blocks = blocks.map(block)
  const host = {postMessage: (message, origin) => posted.push({message: JSON.parse(JSON.stringify(message)), origin})}
  const window = {
    addEventListener: (type, listener, capture) => listeners.push({type, listener, capture}),
    get innerHeight() { return page.innerHeight },
  }
  window.window = window
  window.parent = framed ? host : window
  const document = {readyState: 'loading', nodeType: 9, querySelectorAll: () => page.blocks, documentElement: {nodeType: 1}}
  class MutationObserver { constructor(run) { observers.push(run) } observe() {} disconnect() {} }
  const context = vm.createContext({window, document, parent: window.parent, MutationObserver,
    Date: {now: () => now}, setTimeout: (run, ms) => { const id = nextTimer++; timers.set(id, {run, at: now + ms}); return id }, clearTimeout: id => { timers.delete(id) }})
  if (pointScript) vm.runInContext(pointScript, context)
  const fire = (type, event = {}) => { for (const heard of listeners.filter(h => h.type === type)) heard.listener(event) }
  return {posted, page, listeners,
    told: () => posted.map(p => p.message).filter(m => m.type === 'oi:document-point'),
    advance(ms) {
      const until = now + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0]); now = due[1].at; due[1].run()
      }
      now = until
    },
    gesture(type = 'wheel') { fire(type, {}) },
    scroll(y, target = document) { page.scrollY = y; fire('scroll', {target}) },
    /** The host's message to the page, from the host or from another window. */
    send(data, from = host) { fire('message', {data, source: from}) },
    drawn(more) { page.blocks.push(...more.map(block)); for (const run of observers) run([]) },
    shown(height) { page.innerHeight = height; fire('resize', {}) },
  }
}
/** A page of twelve paragraphs, 50 px apart. */
const TWELVE = Array.from({length: 12}, (_, i) => ({text: `Paragraph ${i + 1}: ${SECRET}`, top: i * 50}))

test('the page tells its host where the reader stands once a scroll they made settles — a position, never a word of the page', () => {
  assert.ok(pointScript, 'desktop/cradle/src/context/document-point.js: the point every hosted document frame tells')
  const page = pageRealm({blocks: TWELVE})
  assert.deepEqual(page.posted.map(p => p.message), [{type: 'oi:document-point-ready'}], 'it says it stands, so its host can send it the point it holds')
  for (const type of ['scroll', 'message', 'resize']) assert.ok(page.listeners.find(h => h.type === type), `${type} is heard`)
  assert.equal(page.listeners.find(h => h.type === 'scroll').capture, true, 'a scroll anywhere in the page: on the window, capturing (a scroll does not bubble)')
  page.gesture('wheel'); page.scroll(310)
  assert.deepEqual(page.told(), [], 'nothing while the scroll runs')
  page.advance(400)
  // 310 px down: paragraph 7 (300–340) is the first whose foot is below the top of the view.
  assert.deepEqual(page.told(), [{type: 'oi:document-point', position: '¶7'}], 'the passage at the top of the view, by its place in the page')
  page.gesture('keydown'); page.scroll(320); page.advance(400)
  assert.equal(page.told().length, 1, 'the same point is not told again')
  page.gesture('wheel'); page.scroll(560); page.advance(400)
  assert.deepEqual(page.told().at(-1), {type: 'oi:document-point', position: '¶12'})
  assert.doesNotMatch(JSON.stringify(page.posted), /Paragraph|whole text/, 'no word of the page leaves it')
  for (const {origin} of page.posted) assert.equal(origin, '*')
})

test('a scroll the page makes itself (its form drawing, a point it was sent) is no reading: it tells nothing', () => {
  const page = pageRealm({blocks: TWELVE})
  assert.deepEqual(page.posted.map(p => p.message.type), ['oi:document-point-ready'], 'the page script runs in the frame')
  page.scroll(400); page.advance(1_000)
  assert.deepEqual(page.told(), [])
  page.gesture('wheel'); page.advance(2_000); page.scroll(100); page.advance(400)
  assert.deepEqual(page.told(), [], 'a hand on the page long before is not this scroll')
  page.gesture('wheel'); page.scroll(300, {nodeType: 1, clientHeight: 240, getBoundingClientRect: () => ({top: 120})}); page.advance(400)
  assert.deepEqual(page.told(), [], 'a box within the page scrolling (a dialog\'s preview at 40% of the frame) is not a move through it')
  page.gesture('wheel'); page.scroll(300, {nodeType: 1, clientHeight: 550, getBoundingClientRect: () => ({top: 50})}); page.advance(400)
  // The page's own scroller under a 50 px head: paragraph 8 (350–390) is the first whose foot is below its top (50 + 300).
  assert.deepEqual(page.told(), [{type: 'oi:document-point', position: '¶8'}], 'the page\'s own scroller is the view')
})

test('the host sends a point: that passage comes to the top, and is not told back', () => {
  const page = pageRealm({blocks: TWELVE})
  page.send({type: 'oi:document-point-go', position: '¶7'})
  assert.equal(page.page.blocks[6].broughtUp, 1, 'paragraph 7 is brought to the top')
  page.scroll(300); page.advance(1_000)
  assert.deepEqual(page.told(), [], 'the scroll it made for its host is not told back')
  page.gesture('wheel'); page.scroll(305); page.advance(400)
  assert.deepEqual(page.told(), [], 'the reader standing at the point they were sent is no news')
  page.gesture('wheel'); page.scroll(110); page.advance(400)
  assert.deepEqual(page.told(), [{type: 'oi:document-point', position: '¶3'}], 'reading on is')
  page.send({type: 'oi:document-point-go', position: '¶9'}, {postMessage: noop})
  page.send({type: 'oi:document-point-go', position: 'Paragraph 9'})
  page.send({type: 'oi:document-point-go', position: '¶0'})
  assert.equal(page.page.blocks[8].broughtUp, 0, 'only its host sends it a point, and only a point')
})

test('a point not yet drawn — the form still drawing, the pane concealed — is brought up once it is; the reader moving on lets it go', () => {
  const page = pageRealm({blocks: TWELVE.slice(0, 3)})
  page.send({type: 'oi:document-point-go', position: '¶7'})
  page.drawn(TWELVE.slice(3))
  assert.equal(page.page.blocks[6].broughtUp, 1, 'drawn: brought up')
  const hidden = pageRealm({blocks: TWELVE})
  hidden.shown(0)
  hidden.send({type: 'oi:document-point-go', position: '¶5'})
  assert.equal(hidden.page.blocks[4].broughtUp, 0, 'a frame with no height (its pane concealed) has nowhere to bring it')
  hidden.shown(600)
  assert.equal(hidden.page.blocks[4].broughtUp, 1, 'shown again: brought up')
  const passed = pageRealm({blocks: TWELVE.slice(0, 3)})
  passed.send({type: 'oi:document-point-go', position: '¶7'})
  passed.gesture('wheel'); passed.scroll(60)
  passed.drawn(TWELVE.slice(3))
  assert.equal(passed.page.blocks[6].broughtUp, 0, 'the reader scrolled on before it was drawn: their place stands')
  // Hidden blocks (a die's faces not shown) keep their places, so a point names the same passage whichever face shows.
  const die = pageRealm({blocks: [{top: 0, shown: false}, {top: 0, shown: false}, ...TWELVE.slice(0, 4)]})
  die.gesture('wheel'); die.scroll(60); die.advance(400)
  assert.deepEqual(die.told(), [{type: 'oi:document-point', position: '¶4'}], 'the second shown paragraph is the page\'s fourth block')
})

test('a page opened by itself says nothing: with no host there is no one to tell', () => {
  assert.ok(pointScript, 'the page script exists')
  const page = pageRealm({framed: false, blocks: TWELVE})
  page.gesture('wheel'); page.scroll(300); page.advance(400)
  assert.deepEqual(page.posted, [])
  assert.equal(page.listeners.length, 0)
})

test('every hosted document frame carries it, after the find, ⌘S and the edits told; the host reads only a point from it', async () => {
  const frameSource = await read('../../../../desktop/cradle/src/document/frame.ts')
  assert.match(frameSource, /document-point\.js\?raw/, 'frame.ts carries the page script')
  assert.match(frameSource, /withFrameScript\(withFrameScript\(withFrameScript\(withFrameScript\(\w+, documentFindScript\), documentSaveScript\), documentEditScript\), documentPointScript\)/,
    'useDocumentFrame frames every hosted document with it')
  assert.equal(frame.DOCUMENT_POINT_GO, 'oi:document-point-go')
  assert.deepEqual(frame.documentPointOf({type: 'oi:document-point', position: '¶7'}), {position: '¶7'})
  assert.equal(frame.documentPointOf({type: 'oi:document-point-ready'}), 'ready')
  for (const bad of [{type: 'oi:document-point', position: 'Paragraph 7'}, {type: 'oi:document-point', position: '¶0'}, {type: 'oi:document-point'},
    {type: 'oi:document-edit', gesture: 'input'}, null, 'oi:document-point']) assert.equal(frame.documentPointOf(bad), null, `${JSON.stringify(bad)} says no point`)
})

// ── the relay: a page's frame and its pane's encounter ──────────────────────────────────────────────────────────────────────────

test('a page in a pane: the point it tells reaches the trail as an occasion of that page, and a reading that names it at another point is sent back', () => {
  assert.equal(readingPoint.missing, undefined, 'packages/live-shell/ui/src/central/documents/readingPoint.ts')
  const intents = [], sent = []
  const point = readingPoint.createReadingPoint(() => ({ref: ESSAY.ref, title: 'Essay'}), {transition: intent => intents.push(intent)}, position => sent.push(position))
  point.told({type: 'oi:document-point', position: '¶7', words: SECRET})
  assert.deepEqual(intents, [{kind: 'occasion', ref: ESSAY.ref, position: '¶7', title: 'Essay'}], 'the page, its title and the point — nothing the page holds')
  point.read({reading: {ref: ESSAY.ref, position: '¶7'}})
  assert.deepEqual(sent, [], 'the book holding the point the page stands at sends nothing')
  point.read({reading: {ref: ESSAY.ref, position: '¶3'}})
  assert.deepEqual(sent, ['¶3'], 'a walk to a stop where it stood at ¶3 brings ¶3 back')
  point.read({reading: {ref: ESSAY.ref, position: '¶3'}})
  point.read({reading: {ref: 'Control/user/flows/other.html', position: '¶9'}})
  point.read({reading: undefined})
  assert.deepEqual(sent, ['¶3'], 'once; another page\'s reading, or none, is not this page\'s')
  point.read({reading: {ref: ESSAY.ref, position: '¶5'}})
  point.told({type: 'oi:document-point-ready'})
  assert.deepEqual(sent, ['¶3', '¶5', '¶5'], 'a page drawn again (a Re-read, a restart) is sent the point the book holds for it')
  point.told({type: 'oi:document-edit', gesture: 'input'})
  assert.equal(intents.length, 1, 'what is not a point is not a reading')
})

test('the pane gives its encounter to the page it holds, and each Central page in a pane tells its point through it', async () => {
  const pane = await source('central/documents/CentralDocumentPane.tsx')
  assert.match(pane, /create: \(\{element, binding, encounter\}\)[\s\S]*?<ReadingEncounterContext\.Provider value=\{encounter\}>/, 'the pane\'s own encounter, never the window\'s')
  const reading = await source('central/documents/readingPoint.ts')
  assert.match(reading, /encounter\.subscribe\(snapshot => point\.read\(snapshot\)\)/, 'a walk reaches the page through the encounter')
  assert.match(reading, /event\.source === frame\.current\.contentWindow/, 'only its own frame tells it')
  for (const [face, page] of [['DocumentPageFace.tsx', /useReadingPoint\(frame, \{ref: location\.path, title\}\)/],
    ['DocumentFlowFace.tsx', /useReadingPoint\(frame, \{ref: location\.path, title: documentLabel\}\)/],
    ['DocumentDayDieFace.tsx', /useReadingPoint\(frame, dayReadingOf\(sourceRef, documentId\)\)/]]) {
    assert.match(await source(`inhabitants/${face}`), page, `${face}: its page, by the ref THE selection names it with`)
  }
  assert.deepEqual(readingPoint.dayReadingOf('central:source:control:root:Control/user/day/2026-10-16/day.md', 'day-document:2026-10-16'),
    {ref: 'Control/user/day/2026-10-16/day.md', title: 'Day 2026-10-16'})
  const project = 'central:source:project:project:o-i:ProjectCentral/user/day/2026-10-16/day.md'
  assert.equal(readingPoint.dayReadingOf(project, 'day-document:2026-10-16').ref, project, 'a project\'s Day, which no Days row selects, by the owner\'s whole ref')
})

// ── each kind of move: one stop ────────────────────────────────────────────────────────────────────────────────────────────────

test('#764 a mode switch made anywhere is a move: the shell\'s one mode switch grows the trail by the place it lands on', async () => {
  const f = trailBook({}, 'live')
  assert.equal(typeof encounterBridge.switchModeOnTrail, 'function', 'projections/encounterBridge.ts switchModeOnTrail')
  f.setMode('techne', T)
  assert.equal(f.mode(), 'techne')
  assert.deepEqual(f.trail(), [{mode: 'techne', label: MODE_CURATION.techne.label, at: T}], 'the Canvas\'s return, the Technē browser, a hosted request: one stop')
  f.setMode('techne', T + 1)
  assert.equal(f.trail().length, 1, 'turning to the mode you stand in is no move')
  f.chooseMode('base', 'central', T + 2)
  assert.equal(f.trail().length, 2, 'the mode rail\'s move and the mode switch under it are one stop')
  f.step('back')
  assert.equal(f.mode(), 'techne', 'Back walks it')
  assert.equal(f.trail().length, 2, 'and a walk turns the tree alone, adding none')
  const continuity = await source('continuity/workspace.tsx')
  assert.match(continuity, /const setMode = \(next: ShellMode\) => switchModeOnTrail\(book, BOOK_MODE_OF_SHELL\[next\]\)/, 'the shell\'s one mode switch is a move')
  assert.doesNotMatch(continuity, /const setMode = \(next: ShellMode\) => book\.switchMode/, 'and turns the tree alone no longer')
  // Every mode switch not made on the mode rail goes through it: App's Canvas return and Expressions reveal, the hosted Expressions'
  // request and its examine (shell/workspace.tsx setMode), the Technē browser, the Workspace device (pageDevices.ts book.setMode).
  const app = await source('App.tsx')
  assert.match(app, /continuity\.setMode\(retained\.mode\)/)
  assert.match(app, /continuity\.setMode\(workspace\.mode === 'techne' \? 'techne' : 'expressions'\)/)
  assert.match(await source('shell/workspace.tsx'), /const setMode = \(next: WorkspaceMode\) => continuity\.setMode\(next\)/)
  assert.match(await source('central/devices/pageDevices.ts'), /const switchMode = book\?\.setMode/)
})

test('#764 an open-where-it-lives is one stop: the mode the clip lives in and THE selection it names land together', async () => {
  const chosen = []
  const home = {kind: 'clip', mode: 'factory', clip: 'clip:eros-verify', title: 'eros-verify', track: 'track:anima'}
  assert.equal(typeof door.standClipHome, 'function', 'frame/openWhereItLives.ts standClipHome')
  door.standClipHome(home, {mode: 'live', chooseMode: (mode, landing) => chosen.push([mode, landing])})
  assert.deepEqual(chosen, [['factory', {kind: 'clip', ref: 'clip:eros-verify', title: 'eros-verify', track: 'track:anima'}]], 'the mode, landing on the clip')
  door.standClipHome(home, {mode: 'factory', chooseMode: (mode, landing) => chosen.push([mode, landing])})
  assert.equal(chosen.length, 1, 'in its mode already: no mode switch, only the selection')
  // On the book: the move lands with the clip selected; the selection the frame then makes is the one held, so it adds none.
  const f = trailBook({}, 'live')
  f.chooseMode('base', 'central', T)
  f.select(ESSAY, T + 1)
  const before = f.trail().length
  const clip = {mode: 'factory', kind: 'clip', ref: home.clip, title: home.title, track: home.track}
  f.chooseMode('factory', undefined, T + 2, clip)
  f.select(clip, T + 3)
  assert.equal(f.trail().length, before + 1, 'one stop')
  assert.deepEqual(f.trail().at(-1).selection, clip)
  f.step('back')
  assert.deepEqual([f.mode(), f.context().selection], ['base', ESSAY], 'Back returns where you were — never a Factory with the Essay selected')
  const app = await source('App.tsx'), opened = await source('frame/openWhereItLives.ts')
  assert.match(app, /const chooseMode = \(next: SurfMode, landing\?: ClipLanding\) => \{[\s\S]*?moveTo\(\{\.\.\.context, world: next === 'base' \? 'central' : undefined, \.\.\.\(landing \? \{selection: selectionOfTrackItem\(landing, mode\)\} : \{\}\)\}, mode\)[\s\S]*?continuity\.setMode\(shell\)/,
    'chooseMode lands THE selection with the mode, made as selectTrackItem makes it')
  assert.match(app, /const selectTrackItem = [\s\S]*?const next = selectionOfTrackItem\(target, /, 'one selection for the door and the frame')
  assert.match(opened, /publishClipHomeDoor\(home => \{[\s\S]*?standClipHome\(home, now\.current\)/, 'the door stands the clip\'s mode through it')
})

test('#764 each kind of move adds one stop, stamped with its time, and no stop carries content — a document\'s point included', () => {
  const f = trailBook({}, 'live')
  const intents = []
  const essay = readingPoint.createReadingPoint(() => ({ref: ESSAY.ref, title: 'Essay'}), {transition: intent => { intents.push(intent); f.bridge.transition(intent) }}, noop)
  const flow = readingPoint.createReadingPoint(() => ({ref: 'Control/user/flows/dialogue.html', title: 'Dialogue 28 Oct'}), f.bridge, noop)
  let stops = 0
  const kept = (what, added = 1) => { stops += added; assert.equal(f.trail().length, stops, added ? `${what} adds one stop` : `${what} adds none`) }
  f.chooseMode('base', 'central', T); kept('the mode rail')
  // The latest Flow stands in Central's own pane; read on in it without selecting it, and its page is where you went.
  flow.told({type: 'oi:document-point', position: '¶4'}); kept('a page read in its pane')
  assert.deepEqual([f.trail().at(-1).label, f.trail().at(-1).surfaceRef, f.trail().at(-1).position], ['Dialogue 28 Oct', 'Control/user/flows/dialogue.html', '¶4'],
    'a page with nothing selected is named by its title')
  flow.told({type: 'oi:document-point', position: '¶9'}); kept('reading on in the page you stand on', 0)
  assert.equal(f.trail().at(-1).position, '¶9', 'the stop takes the point')
  f.select({...ESSAY, content: SECRET}, T + 1); kept('a selection')
  essay.told({type: 'oi:document-point', position: '¶7'}); kept('the selected page\'s point', 0)
  assert.deepEqual(f.trail().at(-1).reading, {ref: ESSAY.ref, position: '¶7', title: 'Essay'}, 'the selection\'s stop takes it')
  f.bridge.transition({kind: 'subject', ref: 'wiki:node:mercurius', subjectKind: 'subject', title: 'Mercurius', content: SECRET}); kept('a subject')
  f.bridge.transition({kind: 'occasion', ref: 'occasion:day-2026-11-04', position: '¶2', content: SECRET}); kept('an occasion')
  f.setMode('techne', T + 5); kept('a mode switch off the rail')
  const clip = {mode: 'factory', kind: 'clip', ref: 'clip:x', title: 'x'}
  f.chooseMode('factory', undefined, T + 6, clip); f.select(clip, T + 7); kept('an open-where-it-lives')
  for (const stop of f.trail()) { assert.equal(typeof stop.at, 'number', `${stop.label} carries its time`); contentFree(stop) }
  assert.doesNotMatch(JSON.stringify(intents), /whole text/)
  // The book keeps what the stops name across a restart, the page's title with them.
  const decoded = store.decodeWorldContext(JSON.parse(JSON.stringify(f.context())))
  assert.deepEqual(decoded.trail.map(stop => stop.reading?.title ?? null), f.trail().map(stop => stop.reading?.title ?? null))
})

// ── the walk ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('#764 Back×3 and Forward through Central → a document at a passage → Technē → Expressions: the same place, page and point', () => {
  const f = trailBook({}, 'live')
  const sent = []
  const essay = readingPoint.createReadingPoint(() => ({ref: ESSAY.ref, title: 'Essay'}), f.bridge, position => sent.push(position))
  // The page's frame follows the encounter as its pane does: each publication after the host renders.
  const publish = () => essay.read(f.bridge.snapshot())
  f.chooseMode('base', 'central', T); publish()
  f.select(ESSAY, T + 60e3); publish()
  essay.told({type: 'oi:document-point', position: '¶3'}); publish()
  essay.told({type: 'oi:document-point', position: '¶7'}); publish()
  f.setMode('techne', T + 120e3); publish()
  f.setMode('expressions', T + 180e3); publish()
  assert.deepEqual(f.trail().map(stop => [stop.mode, stop.label, stop.position ?? null]),
    [['base', 'Central', null], ['base', 'Essay', '¶7'], ['techne', 'Essay', '¶7'], ['expressions', 'Essay', '¶7']])
  assert.deepEqual(f.trail().map(stop => stop.at), [T, T + 60e3, T + 120e3, T + 180e3], 'each stop keeps the time it was made')
  const clock = at => { const date = new Date(at); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
  assert.deepEqual(f.trail().map(trailWidget.stopTime), f.trail().map(stop => clock(stop.at)), 'the Trail lists the stops with their times')
  const kept = f.trail().length
  f.step('back'); publish()
  assert.equal(f.mode(), 'techne', 'Back: Technē')
  f.step('back'); publish()
  assert.deepEqual([f.mode(), f.context().selection, f.context().reading], ['base', ESSAY, {ref: ESSAY.ref, position: '¶7', title: 'Essay'}], 'Back again: the document at its passage')
  assert.deepEqual(sent, [], 'its frame stands at the passage already: nothing to send')
  f.step('back'); publish()
  assert.deepEqual([f.mode(), f.context().selection, f.context().world], ['base', undefined, 'central'], 'Back a third time: Central as you entered it')
  assert.equal(rows.trailSteps(f.trail().length, store.standingOn(f.context())).back, null, 'Back waits at the first stop')
  f.step('forward'); publish()
  assert.deepEqual([f.mode(), f.context().reading?.position], ['base', '¶7'], 'Forward: the document at its passage')
  f.step('forward'); f.step('forward'); publish()
  assert.equal(f.mode(), 'expressions', 'Forward returns to Expressions')
  assert.equal(rows.trailSteps(f.trail().length, store.standingOn(f.context())).forward, null, 'Forward waits at the newest stop')
  assert.equal(f.trail().length, kept, 'walking adds no stop')
  // Read on in the document while you stand on it, step away and back: each stop returns to its own point.
  f.step('back'); f.step('back'); publish()
  essay.told({type: 'oi:document-point', position: '¶12'}); publish()
  assert.equal(f.trail()[1].position, '¶12', 'the stop you stand on takes the point you read on to')
  f.step('forward'); publish()
  assert.deepEqual(sent, ['¶7'], 'Forward to Technē, which kept the Essay at ¶7: its frame is sent ¶7')
  f.step('back'); publish()
  assert.deepEqual(sent, ['¶7', '¶12'], 'Back: ¶12 again')
  // Somewhere new after a walk: Forward waits, and Back still goes where you were.
  f.chooseMode('factory', undefined, T + 240e3); publish()
  assert.equal(rows.trailSteps(f.trail().length, store.standingOn(f.context())).forward, null, 'Forward waits: you went somewhere new')
  f.step('back'); publish()
  assert.deepEqual([f.mode(), f.context().reading?.position], ['base', '¶12'], 'Back goes where you were, at the point you were')
  // The app drawn again (a restart, a Re-read): the page is sent the point the book holds for it.
  essay.told({type: 'oi:document-point-ready'})
  assert.equal(sent.at(-1), '¶12')
})
