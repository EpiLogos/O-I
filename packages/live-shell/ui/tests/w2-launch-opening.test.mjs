import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// W2 (manual §18.1 Launch panel; T-WORLDS §4 "A page plays when launched"): a launched page opens as its launch says — Opens as,
// Opens in — from the launch its island keeps. Channels: PURE (the planner and the layout), SCRIPTED (the page owner behind a stub
// bridge). NOT a screen pass.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  if(specifier.endsWith('?raw')){const r=await next(specifier.slice(0,-4),context);return {...r,url:r.url+'?raw'}}
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    for(const suffix of ['.ts','.tsx','/index.ts']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(url.slice(0,-4)),'utf8'))};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const opening = await import('../src/central/launchOpening.ts')

const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null})
const empty = () => ({root: group('g1', []), surfaces: {}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 320})
const panes = layout => {
  const out = [], walk = pane => { if (!pane) return; if (pane.type === 'group') out.push(pane.tabs.map(id => layout.surfaces[id].projection?.subject_ref)); else (pane.children ?? []).forEach(walk) }
  walk(layout.root); return out
}
const loc = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
const BEING = loc('Control/user/flows/beings-1.html'), FLOW = loc('Control/user/flows/flow-1.html')

test('a launched page opens as its launch says: a Being as its page, a Flow as its Flow, in the focused pane unless it asks for one beside', () => {
  assert.deepEqual(opening.launchOpeningOf('being', BEING, {}), {open: {target: {form: 'page', kind: 'being', location: BEING}, beside: false}, words: 'opened as its page in the focused pane'})
  assert.deepEqual(opening.launchOpeningOf('thing', BEING, {meta: {launch: {opensAs: 'page', opensIn: 'pane'}}}).open, {target: {form: 'page', kind: 'thing', location: BEING}, beside: true})
  assert.match(opening.launchOpeningOf('being', BEING, {meta: {launch: {opensAs: 'sky'}}}).words, /opened as its page in the focused pane; the Sky reads its Being's birth sky/)
  assert.match(opening.launchOpeningOf('thing', BEING, {meta: {launch: {opensAs: 'sky'}}}).words, /a Thing holds no placement in the sky, so Sky stays closed for it/)
  assert.equal(opening.launchOpeningOf('being', BEING, {launch: {opensIn: 'pane'}}).open.beside, false, 'a launch kept anywhere but meta.launch is none the page owner wrote')
  const flow = opening.launchOpeningOf('flow', FLOW, {meta: {launch: {opensAs: 'journal', opensIn: 'window'}}})
  assert.deepEqual(flow.open, {target: {form: 'flow', location: FLOW}, beside: false})
  assert.equal(flow.words, 'opened as its Flow in the focused pane; Journal is chosen at its head; a window is the pane\'s own ↗')
  assert.deepEqual(opening.launchOpeningOf('goal', loc('x.html'), {}), {open: null, words: 'a goal is no page the shell opens'})
})

test('after the launch the page is read through its owner and opened in the pane tree; with no tree nothing opens and it is said', async () => {
  const real = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    if (body.op === 'page' && body.request.operation === 'read') return {json: async () => ({ok: true, outcome: {result: 'page_reading',
      data: {schema: 'oi.page-reading/v1', location: BEING, revision: 'r', form: 'being', title: 'A', island: {meta: {launch: {opensAs: 'page', opensIn: 'focused'}}}}}})}
    return {json: async () => ({ok: false, error: 'unexpected'})}
  }
  try {
    const transport = {kind: 'bridge', url: 'http://central.fixture'}
    let layout = empty()
    const answer = await opening.openLaunched(transport, update => { layout = update(layout) }, {location: BEING})
    assert.equal(answer.opened, 'opened as its page in the focused pane')
    const bound = Object.values(layout.surfaces)
    assert.equal(bound.length, 1)
    assert.equal(bound[0].projection.subject_ref, `page:being:${BEING.ref}`)
    assert.deepEqual(await opening.openLaunched(transport, null, {location: BEING}), {opened: 'no pane tree is mounted to open it in'})
  } finally { globalThis.fetch = real }
})

test('a page that asks for a pane beside opens beside the focused one; the focused pane keeps what it held', async () => {
  const {openCentralDocumentAt} = await import('../src/central/documents/centralDocuments.ts')
  const start = openCentralDocumentAt(empty(), {form: 'flow', location: FLOW})
  const beside = opening.placeLaunched(openCentralDocumentAt, start, {target: {form: 'page', kind: 'being', location: BEING}, beside: true})
  assert.deepEqual(panes(beside), [[FLOW.ref], [`page:being:${BEING.ref}`]])
  const focused = opening.placeLaunched(openCentralDocumentAt, start, {target: {form: 'page', kind: 'being', location: BEING}, beside: false})
  assert.deepEqual(panes(focused), [[FLOW.ref, `page:being:${BEING.ref}`]])
})

test('a page launched as Reading opens its reading on the Earth when the Earth holds it; otherwise it opens as its page and says why', async () => {
  const {registerEarthReading} = await import('../src/central/earthReading.ts')
  const real = globalThis.fetch
  globalThis.fetch = async () => ({json: async () => ({ok: true, outcome: {result: 'page_reading',
    data: {schema: 'oi.page-reading/v1', location: BEING, revision: 'r', form: 'being', title: 'A', island: {meta: {launch: {opensAs: 'reading', opensIn: 'focused'}}}}}})})
  const transport = {kind: 'bridge', url: 'http://central.fixture'}
  try {
    const asked = []
    const withdraw = registerEarthReading(ref => { asked.push(ref); return {ok: true} })
    let layout = empty()
    assert.deepEqual(await opening.openLaunched(transport, update => { layout = update(layout) }, {location: BEING}), {opened: 'opened as its reading on the Earth'})
    assert.deepEqual(asked, [BEING.ref]); assert.deepEqual(layout.surfaces, {}, 'the reading opens on the Earth, no pane is opened')
    withdraw()
    const missing = registerEarthReading(() => ({ok: false, why: 'the Earth holds no occurrence of this page yet'}))
    const answer = await opening.openLaunched(transport, update => { layout = update(layout) }, {location: BEING})
    assert.equal(answer.opened, 'opened as its page in the focused pane; its reading did not open: the Earth holds no occurrence of this page yet')
    assert.equal(Object.values(layout.surfaces)[0].projection.subject_ref, `page:being:${BEING.ref}`)
    missing()
    let none = empty()
    assert.match((await opening.openLaunched(transport, update => { none = update(none) }, {location: BEING})).opened, /its reading did not open: no Earth stands in this session$/)
  } finally { globalThis.fetch = real }
})


test('a page launched as Walk opens its family\'s walk on the Earth, at its own stop; otherwise it opens as its page and says why', async () => {
  const {registerEarthWalk} = await import('../src/central/earthReading.ts')
  const real = globalThis.fetch
  globalThis.fetch = async () => ({json: async () => ({ok: true, outcome: {result: 'page_reading',
    data: {schema: 'oi.page-reading/v1', location: BEING, revision: 'r', form: 'thing', title: 'A', island: {meta: {launch: {opensAs: 'walk', opensIn: 'pane'}}}}}})})
  const transport = {kind: 'bridge', url: 'http://central.fixture'}
  try {
    const asked = []
    const withdraw = registerEarthWalk(ref => { asked.push(ref); return {ok: true} })
    let layout = empty()
    assert.deepEqual(await opening.openLaunched(transport, update => { layout = update(layout) }, {location: BEING}), {opened: 'opened its walk on the Earth, at its own stop'})
    assert.deepEqual(asked, [BEING.ref]); assert.deepEqual(layout.surfaces, {}, 'the walk opens on the Earth, no pane is opened')
    withdraw()
    const thin = registerEarthWalk(() => ({ok: false, why: 'a walk needs two placed pages of its kind, and the Earth holds one'}))
    const answer = await opening.openLaunched(transport, update => { layout = update(layout) }, {location: BEING})
    assert.equal(answer.opened, 'opened as its page in a pane beside the focused one; its walk did not open: a walk needs two placed pages of its kind, and the Earth holds one')
    assert.equal(Object.values(layout.surfaces)[0].projection.subject_ref, `page:thing:${BEING.ref}`)
    thin()
    assert.match((await opening.openLaunched(transport, update => { layout = update(layout) }, {location: BEING})).opened, /its walk did not open: no Earth stands in this session$/)
  } finally { globalThis.fetch = real }
})
