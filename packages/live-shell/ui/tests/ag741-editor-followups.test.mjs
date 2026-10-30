import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {register} from 'node:module'

// Lane AG (O-I #741, #820): lane AF's open items on Central's editor side.
//   1. A draft is never dropped when its pane closes (DLW §2: "A draft you are writing stays in your hands until its owner
//      acknowledges the save"; §16.7: what a set could not keep, "such as a draft never saved, it names as it opens"). The manual
//      names no confirm on closing, so the pane keeps the draft on this device and the page brings it back when it opens again.
//   2. ⌘S inside a hosted page is the pane's Save through Central (§10.9 "save it … ⌘S"; §17.8 Save), not the form's portable copy.
//   3. ⌘F re-arms on a page whose frame was replaced while the find line stood open (a Re-read).
//   4. The search line's history (§18.4 "The line anywhere"): N× counts the routes the line records its opens as, how lately comes
//      from AIKit's own receipts, History Off ranks nothing by use, and ✕ forgets one item in the world the line stands in.
// Loader as af741-pane-find.test.mjs.
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
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})
globalThis.__CRADLE_WALK__ = false
const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

/** This device's storage, as the window keeps it; `refuse` makes it keep nothing (a full or blocked store). */
const stored = new Map()
let refuse = false
globalThis.localStorage = {getItem: key => (stored.has(key) ? stored.get(key) : null), setItem: (key, value) => { if (!refuse) stored.set(key, String(value)) },
  removeItem: key => { stored.delete(key) }, key: i => [...stored.keys()][i] ?? null, get length() { return stored.size }}

const read = path => readFile(new URL(path, import.meta.url), 'utf8').catch(() => null)

// ---- 1. the draft a closing pane held

test('1: the draft a pane held is kept on this device, read back by its document, and let go only by a save or a set-aside', async () => {
  const kept = await import('../src/central/documents/keptDrafts.ts')
  stored.clear()
  const flow = {form: 'Flow', ref: 'central:path:/c:Control/user/flows/a.html', basis: 'rev-1', draft: '{"meta":{"title":"Walked"}}', title: 'A Flow'}
  kept.keepDraft(flow)
  const back = kept.keptDraftOf('Flow', flow.ref)
  assert.equal(back?.draft, flow.draft, 'the draft comes back word for word')
  assert.equal(back?.basis, 'rev-1', 'with the revision it was written against')
  assert.ok(typeof back?.at === 'number' && back.at > 0, 'and when it was kept')
  assert.equal(kept.keptDraftOf('Being', flow.ref), null, 'one form\'s draft is not another\'s')
  // A later edit of the same document replaces the kept one.
  kept.keepDraft({...flow, draft: '{"meta":{"title":"Walked twice"}}'})
  assert.equal(kept.keptDraftOf('Flow', flow.ref)?.draft, '{"meta":{"title":"Walked twice"}}')
  // A release that names an older draft leaves the newer one: an edit made while a save was in flight stays kept.
  kept.releaseKeptDraft('Flow', flow.ref, flow.draft)
  assert.ok(kept.keptDraftOf('Flow', flow.ref), 'the newer draft stays')
  kept.releaseKeptDraft('Flow', flow.ref)
  assert.equal(kept.keptDraftOf('Flow', flow.ref), null, 'a save or a set-aside lets it go')
  // A store that keeps nothing is said, never passed over: the pane's close is refused with these words.
  refuse = true
  assert.throws(() => kept.keepDraft(flow), error => /draft/i.test(error.message) && !/localStorage|Error:/.test(error.message), 'said in plain words')
  refuse = false
  assert.equal(kept.keptDraftOf('Flow', flow.ref), null)
  // Something else in the slot is no draft.
  stored.set(kept.keptDraftKey('Flow', flow.ref), '{"schema":"other"}')
  assert.equal(kept.keptDraftOf('Flow', flow.ref), null)
})

test('1: a page opened over a kept draft says so, and says when its owner moved on since', async () => {
  const kept = await import('../src/central/documents/keptDrafts.ts')
  const draft = {schema: 'oi.central.kept-draft/v1', form: 'Flow', ref: 'r', basis: 'central.content-fnv1a64/v1:10:aaaaaaaa11', draft: '{}', title: 'A Flow', at: Date.now() - 60_000}
  const same = kept.keptDraftNotice(draft, draft.basis)
  assert.match(same, /draft/i)
  assert.match(same, /Save/)
  assert.doesNotMatch(same, /moved/i, 'the same revision: nothing moved')
  const moved = kept.keptDraftNotice(draft, 'central.content-fnv1a64/v1:12:bbbbbbbb22')
  assert.match(moved, /moved/i, 'a moved page is named')
  assert.match(moved, /aaaaaaaa/, 'with the revision the draft stands on, as the head shows revisions')
  assert.equal(kept.keptDraftMoved(draft, draft.basis), false)
  assert.equal(kept.keptDraftMoved(draft, 'other'), true)
})

test('1: each Central document face keeps its draft under its pane before a close, and brings it back as it opens', async () => {
  for (const [file, form] of [['../src/inhabitants/DocumentFlowFace.tsx', 'Flow'], ['../src/inhabitants/DocumentPageFace.tsx', 'page'], ['../src/inhabitants/DocumentDayDieFace.tsx', 'Day']]) {
    const source = await read(file)
    assert.match(source, /useDraftKeeping\(/, `${form}: the face registers its keeping under its pane (the workbench asks it before any close)`)
    assert.match(source, /keptDraftOf\(/, `${form}: the face reads a kept draft as it opens`)
    assert.match(source, /releaseKeptDraft\(/, `${form}: a save or a set-aside lets it go`)
  }
  const kept = await import('../src/central/documents/keptDrafts.ts')
  assert.equal(typeof kept.useDraftKeeping, 'function')
})

// ---- 2. ⌘S in a hosted page

const saveScript = await read('../../../../desktop/cradle/src/context/document-save-key.js')

/** The page script in a realm framed by a host (`parent` is another window) or standing alone. */
function saveRealm(framed) {
  const posted = [], heard = []
  const host = {postMessage: (message, origin) => posted.push({message, origin})}
  const window = {addEventListener: (type, listener, capture) => heard.push({type, listener, capture})}
  window.window = window
  window.parent = framed ? host : window
  vm.runInContext(saveScript, vm.createContext({window, parent: window.parent}))
  return {posted, heard}
}
const key = (over = {}) => {
  const event = {key: 's', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, isComposing: false, prevented: false, stopped: false,
    preventDefault() { this.prevented = true }, stopImmediatePropagation() { this.stopped = true }, ...over}
  return event
}

test('2: ⌘S in a hosted page asks its host to save, before the form\'s own ⌘S (the portable copy) can hear it', () => {
  assert.ok(saveScript, 'desktop/cradle/src/context/document-save-key.js: the key every hosted document frame carries')
  const {posted, heard} = saveRealm(true)
  assert.equal(heard.length, 1)
  assert.equal(heard[0].type, 'keydown')
  assert.equal(heard[0].capture, true, 'on the window, capturing: it hears the chord before the form\'s document listener')
  const press = key()
  heard[0].listener(press)
  assert.deepEqual(posted.map(p => p.message.type), ['oi:document-save'], 'the host is asked to save')
  assert.equal(press.prevented, true, 'the browser\'s own save-page is held back')
  assert.equal(press.stopped, true, 'the form\'s exportCopy never runs: no download')
  for (const other of [key({key: 'a'}), key({metaKey: false}), key({shiftKey: true, key: 'S'}), key({altKey: true}), key({isComposing: true})]) {
    heard[0].listener(other)
    assert.equal(other.stopped, false, `${other.key}${other.shiftKey ? ' with ⇧' : ''}: not the pane's Save, left to the page`)
  }
  heard[0].listener(key({metaKey: false, ctrlKey: true}))
  assert.equal(posted.length, 2, 'Ctrl+S is the same chord off a Mac')
})

test('2: a page opened by itself keeps its own ⌘S (its portable copy): with no host there is no pane Save', () => {
  assert.ok(saveScript, 'the page script exists')
  const {heard} = saveRealm(false)
  assert.equal(heard.length, 0)
})

test('2: every hosted document frame carries it, and the faces run their Save on it', async () => {
  const frame = await read('../../../../desktop/cradle/src/document/frame.ts')
  assert.match(frame, /document-save-key\.js\?raw/, 'frame.ts carries the page script')
  assert.match(frame, /withFrameScript\(withFrameScript\(\w+, documentFindScript\), documentSaveScript\)|documentSaveScript/, 'useDocumentFrame frames every hosted document with it')
  const keys = await import('../src/central/documents/useSaveKey.ts')
  assert.equal(keys.DOCUMENT_SAVE_MESSAGE, 'oi:document-save')
  for (const file of ['../src/inhabitants/DocumentFlowFace.tsx', '../src/inhabitants/DocumentPageFace.tsx', '../src/inhabitants/DocumentDayDieFace.tsx']) {
    assert.match(await read(file), /useSaveKey\(frame, /, `${file}: ⌘S in its page runs its own Save`)
  }
})

// ---- 3. ⌘F re-arms on a new frame

test('3: the page\'s find says it stands, so a find line left open re-arms on a frame that replaced the old one', async () => {
  const findScript = await read('../../../../desktop/cradle/src/context/document-find.js')
  const posted = []
  const listeners = {}
  const host = {postMessage: message => posted.push(message)}
  const window = {addEventListener: (type, listener) => { listeners[type] = listener }}
  const document = {readyState: 'complete', addEventListener: (type, listener) => { listeners[`doc:${type}`] = listener }}
  window.window = window
  window.parent = host
  vm.runInContext(findScript, vm.createContext({window, document, parent: host}))
  assert.deepEqual(posted.map(m => m.type), ['oi:document-find-ready'], 'a framed page that has loaded says its find stands')
  const loading = {readyState: 'loading', addEventListener: (type, listener) => { listeners[`loading:${type}`] = listener }}
  const later = []
  const w2 = {addEventListener: noop}; w2.window = w2; w2.parent = {postMessage: m => later.push(m)}
  vm.runInContext(findScript, vm.createContext({window: w2, document: loading, parent: w2.parent}))
  assert.equal(later.length, 0, 'still loading: not yet')
  listeners['loading:DOMContentLoaded']()
  assert.deepEqual(later.map(m => m.type), ['oi:document-find-ready'], 'once its words stand')

  const model = await import('../src/central/documents/documentFindModel.ts')
  assert.deepEqual(model.pageFindMessage({type: 'oi:document-find-ready'}), {kind: 'ready'})
  const line = await read('../src/central/documents/DocumentFind.tsx')
  assert.match(line, /message\.kind === 'ready'/, 'the line hears it, and asks the new page its words again')
})

// ---- 4. the search line's history

test('4: N× counts the routes the line records its opens as, in the world it is asked in', async () => {
  const binding = await import('../src/central/devices/searchBinding.ts')
  const hit = (resource, ranking) => ({resource, label: resource, kind: 'knowledge-source', snippet: '', provider: 'p', authority: 'a', score: 0.5,
    address: {kind: 'source', value: resource}, ranking})
  const rows = binding.searchResultsOf({query: 'x', pending: [], rows: [], hits: [
    hit('a', {provider_score: 0.5, navigation_score: 0.7, destination: {observations: 9, contextual_observations: 1, frecency: 3, contextual_frecency: 0.5},
      route: {observations: 4, contextual_observations: 2, frecency: 2, contextual_frecency: 1.25}}),
    hit('b', {provider_score: 0.4, navigation_score: 0.6, destination: {observations: 0, contextual_observations: 0, frecency: 0, contextual_frecency: 0},
      route: {observations: 3, contextual_observations: 3, frecency: 1, contextual_frecency: 1}}),
    hit('c', {provider_score: 0.9, navigation_score: 0.9, destination: {observations: 2, contextual_observations: 0, frecency: 1, contextual_frecency: 0}}),
  ]})
  assert.equal(rows[0].used, 3, 'one plain open and two routes, in this world')
  assert.equal(rows[0].frecency, 1.75, 'how often and how lately, together, as AIKit\'s own boost reads it (contextual)')
  assert.equal(rows[1].used, 3, 'a result opened only from the line (routes only) is counted')
  assert.equal(rows[2].used, undefined, 'opened only in another world: not counted here')
  assert.equal(rows[0].score, 0.5, 'the provider\'s own score, for an order with no history')
})

test('4: how lately comes from AIKit\'s knowledge history receipts: the newest route to each destination', async () => {
  const model = await import('../src/central/searchLineModel.ts')
  const receipt = (at, ...steps) => ({operation: 'route', recorded_at_ms: at, route: {route: `knowledge-route:${steps.join('+')}`, steps: steps.map(resource => ({resource}))}})
  const lately = model.latelyOf([receipt(3000, 'a'), receipt(2000, 'x', 'a'), receipt(5000, 'b'), {operation: 'frame', recorded_at_ms: 9000, frame: {}}, null])
  assert.equal(lately.get('a'), 3000, 'the newest receipt whose route ends at it')
  assert.equal(lately.get('b'), 5000)
  assert.equal(lately.has('x'), false, 'a step on the way is not where you went')
  assert.equal(lately.size, 2, 'a frame is not an open')
  const now = Date.UTC(2026, 9, 29, 12, 0, 0)
  assert.equal(model.latelyWords(now - 20_000, now), 'just now')
  assert.equal(model.latelyWords(now - 5 * 60_000, now), '5 min ago')
  assert.equal(model.latelyWords(now - 3 * 3600_000, now), '3 h ago')
  assert.equal(model.latelyWords(now - 30 * 3600_000, now), 'yesterday')
  assert.equal(model.latelyWords(now - 6 * 86400_000, now), '6 days ago')
  assert.match(model.latelyWords(now - 60 * 86400_000, now), /Aug/, 'longer ago: the date')
  assert.equal(model.usedWords({used: 4, lately: now - 3 * 3600_000}, now), '4× · 3 h ago')
  assert.equal(model.usedWords({used: 1}, now), '1×', 'no receipt: how often only')
  assert.equal(model.usedWords({}, now), '')
})

test('4: History Off — the line counts nothing and ranks nothing by use', async () => {
  const model = await import('../src/central/searchLineModel.ts')
  assert.equal(model.historyOn({}), true, 'Remember is the default')
  assert.equal(model.historyOn({history: 'remember'}), true)
  assert.equal(model.historyOn({history: 'off'}), false)
  const r = (ref, score, frecency, used) => ({ref, title: ref, kind: 'knowledge-source', group: 'document', score, ...(frecency ? {frecency, used} : {})})
  // AIKit's order, its learned ease folded in: b (opened often) before a (the better match).
  const owned = [r('b', 0.4, 2, 5), r('a', 0.9), r('c', 0.6)]
  assert.deepEqual(model.jumpOrder(owned).map(x => x.ref), ['b', 'a', 'c'], 'History on: what you open most first')
  const off = model.unranked(owned)
  assert.deepEqual(off.map(x => x.ref), ['a', 'c', 'b'], 'History off: the provider\'s own score, AIKit\'s learned ease left out')
  assert.ok(off.every(x => x.used === undefined && x.frecency === undefined), 'and no count is shown')
  const line = await read('../src/central/searchLine.tsx')
  assert.match(line, /if \(!remember\) return/, 'an open or a send is not counted when History is off')
  const wiring = (await import('../src/central/devices/searchBinding.ts')).SEARCH_WIRING
  assert.ok(wiring.keys.includes('history') && wiring.local.history, 'History is Search\'s own setting, held with Reach and Kinds')
  const design = await read('../src/inhabitants/catalogue/panels/central__search.tsx')
  assert.match(design, /'history'/, 'the Search design shows it')
})

test('4: ✕ forgets one item in the world the line stands in, through AIKit\'s own forget', async () => {
  const model = await import('../src/central/searchLineModel.ts')
  assert.deepEqual(model.forgetRequestOf({ref: 'source:paper:a'}, 'O-I'),
    {kind: 'knowledge-forget', scope: 'here', resource: 'source:paper:a', project: 'O-I'})
  assert.deepEqual(model.forgetRequestOf({ref: 'source:paper:a'}, undefined),
    {kind: 'knowledge-forget', scope: 'here', resource: 'source:paper:a', project: null}, 'your world: no project')
  const types = await read('../../../../desktop/cradle/src/kernel/types.ts')
  assert.match(types, /kind:"knowledge-forget";scope:"destination"\|"route"\|"project"\|"here"\|"all"/, 'the kernel takes the per-world forget')
})
