import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// A journey's Flow chooses Reading from its Open in menu (manual §18.1 Opening a page: "choose Open in from its menu … A choice the page has
// nothing for stays closed and says why"; §24.1 "A concern … Opens as: Flow, or Reading as an Expression"; §24.4 "Launch a journey as
// Reading and it opens as an Expression"). A page has no Launch tab (catalogue/clips/central.tsx), so the choice stands in its menu. The
// menu writes it through the clip's Clip view, which writes the page owner's `launch` field (kernel/src/page.rs launch_field) on the
// revision read and reads the page again; Launch then opens the journey's Reading scene. Channels: SCRIPTED — the production menu, door
// and binding in memory, a kernel behind the bridge's fetch that records every op. The native press is the lead's.
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
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText
    .split('import.meta.env').join('({BASE_URL: "/"})').split('import.meta.glob').join('(() => ({}))')};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}, body: {classList: {toggle: noop}}}

const acts = await import('../src/frame/menu/objectActions.ts')
const door = await import('../src/frame/menu/objectDoor.ts')
const central = await import('../src/central/clipBinding.ts')
const {writePageField} = await import('../../../../desktop/cradle/src/personal/pageOwner.ts')

const TRANSPORT = {kind: 'bridge', url: 'http://kernel'}
/** A kernel standing in for the page owner: each op answered by `answer(op)`, every op kept. */
function kernel(answer) {
  const ops = []
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body); ops.push(op)
    try { return {json: async () => ({ok: true, outcome: await answer(op)})} } catch (error) { return {json: async () => ({ok: false, error: error.message})} }
  }
  return ops
}

// A concern on the practice world: a journey's Flow, at its Central-relative path (the clip's id on the world's track, and the browser's
// subject Clip view reads, central/clipBinding.ts useCentralClip).
const PATH = 'Control/user/practice/journey-the-move.html'
const LOCATION = {schema: 'central.path-ref/v1', ref: `central:path:/ground:${PATH}`, root: '/ground', path: PATH}
const JOURNEY = {schema: 'ql.nara-oracle-journey/v1', journey_ref: 'journey:the-move', revision: 2}
const journeyIsland = launch => ({meta: {title: 'The move', revision: 3, journey: JOURNEY, ...(launch ? {launch} : {})}, entries: [], notes: []})
const flowValues = island => ({...central.flowValues({title: 'The move', people: [], entries: [], notes: []}), ...(island.meta.launch?.opensAs ? {opensAs: island.meta.launch.opensAs} : {})})
const set = {columns: [{id: 'r1', name: 'Today'}], tracks: [{id: 'practice', name: 'Practice', kind: 'world'}],
  clips: [{id: PATH, trackId: 'practice', columnId: 'r1', label: 'The move'}], actions: {owner: 'Central'}}
const target = {kind: 'clip', id: PATH, trackId: 'practice', name: 'The move'}
const context = (binding, extra = {}) => ({view: 'session', binding, press: (_key, _what, run) => run(), rename: noop, writeClip: door.writeClip, ...extra})
const byId = (items, id) => items.find(item => item.id === id)
/** The binding Clip view holds for the page, as useCentralClip builds it: the browser's subject ref, the clip it is on the track. */
const bindingOver = (island, write) => central.centralClipBinding({ref: `subject:note:${PATH}`, values: flowValues(island), location: LOCATION, island},
  {write, clip: PATH})

test('a journey\'s Flow offers Open in Reading; choosing it writes opensAs reading through the page owner, reads it back, and Launch opens its scene', async () => {
  // The page owner over the kernel: the field written on the revision read, then the page read again (useCentralClip's PageWrite).
  let held = journeyIsland(null)
  const ops = kernel(op => {
    const request = op.request ?? {}
    if (op.op !== 'page' || request.operation !== 'mutate_field' || request.field !== 'launch') throw new Error(`unexpected op ${JSON.stringify(op)}`)
    if (request.expected_revision !== 'r3') throw new Error('The page moved since it was read')
    held = journeyIsland({...(held.meta.launch ?? {}), ...request.value})
    return {result: 'page_reading', data: {schema: 'oi.page-mutation/v1', location: LOCATION, field: 'launch', value: held.meta.launch,
      before_revision: 'r3', revision: 'r4', outcome: 'written', receipt: null}}
  })
  const write = (field, value) => writePageField(TRANSPORT, LOCATION, 'r3', field, value)
  const binding = bindingOver(held, write)
  door.publishHostedClip(binding)
  try {
    const items = acts.objectMenu(target, set, context(binding))
    const flow = byId(items, 'open-in:flow'), reading = byId(items, 'open-in:reading')
    assert.ok(flow && reading, 'the Flow\'s menu lists Open in: its Flow and its Reading')
    assert.equal(reading.label, 'Open in Reading')
    assert.equal(flow.label, 'Open in Flow')
    assert.equal(flow.checked, true, 'a journey that keeps no launch opens as its Flow')
    assert.equal(reading.checked, false)
    assert.equal(reading.disabled, undefined, 'a journey has a Reading to open')
    reading.onSelect('open-in:reading')
    await new Promise(resolve => setTimeout(resolve, 0))
    // The one owner write: the page's launch field, on the revision read.
    assert.deepEqual(ops.map(op => [op.op, op.request.operation, op.request.field, op.request.value, op.request.expected_revision, op.request.location.ref]),
      [['page', 'mutate_field', 'launch', {opensAs: 'reading'}, 'r3', LOCATION.ref]], 'one write reaches the page owner: its launch, on the revision read')
    // Read back: the page read again keeps opensAs reading, and its menu says Reading is how it opens.
    assert.equal(held.meta.launch.opensAs, 'reading')
    const again = bindingOver(held, write)
    assert.equal(again.values.opensAs, 'reading', 'Clip view reads the launch back from the page')
    const after = acts.objectMenu(target, set, context(again))
    assert.equal(byId(after, 'open-in:reading').checked, true)
    assert.equal(byId(after, 'open-in:flow').checked, false)
    // Launch: the page read through its owner opens the journey's Reading scene (practiceLaunch.ts answerLaunch), not its Deck.
    const launch = await import('../src/inhabitants/ql/devices/practiceLaunch.ts')
    const opened = []
    await launch.answerLaunch({form: 'flow', location: LOCATION}, TRANSPORT, {read: async () => ({location: LOCATION, island: held, title: 'The move'}),
      reading: async location => { opened.push(['reading', location.ref]) }, deck: async location => { opened.push(['deck', location.ref]) }})
    assert.deepEqual(opened, [['reading', LOCATION.ref]], 'Launch opens its Reading scene')
  } finally { door.publishHostedClip(null) }
})

test('a Flow that keeps no journey has no Reading: the choice stays closed and says why; its Flow stays', () => {
  const plain = {meta: {title: 'Morning exchange', revision: 1}, entries: [], notes: []}
  const binding = central.centralClipBinding({ref: `subject:note:${PATH}`, values: flowValues(plain), location: LOCATION, island: plain}, {write: async () => {}, clip: PATH})
  const items = acts.objectMenu(target, set, context(binding))
  const reading = byId(items, 'open-in:reading')
  assert.equal(reading.disabled, true)
  assert.match(reading.why, /keeps no journey/)
  assert.equal(byId(items, 'open-in:flow').checked, true)
  // A journey's page made from New… that holds no journey yet is a journey's Flow: the page owner takes Reading for it (page.rs journey_flow).
  const made = {meta: {title: 'Journey', revision: 1, practice: 'journey'}, entries: [], notes: []}
  const fresh = central.centralClipBinding({ref: `subject:note:${PATH}`, values: flowValues(made), location: LOCATION, island: made}, {write: async () => {}, clip: PATH})
  assert.equal(byId(acts.objectMenu(target, set, context(fresh)), 'open-in:reading').disabled, undefined)
})

test('Open in stands where Clip view holds the page: its clip on the track is the subject Clip view reads; with none held, none is listed', () => {
  const binding = bindingOver(journeyIsland(null), async () => {})
  assert.equal(door.bindsClip(binding, PATH), true, 'the subject\'s binding is its clip\'s on the track')
  assert.equal(door.bindsClip(binding, 'Control/user/practice/other.html'), false)
  assert.equal(byId(acts.objectMenu(target, set, context(null)), 'open-in:reading'), undefined, 'nothing held: no choice is guessed')
  // A page Clip view cannot write (no revision read) refuses in the page family's words.
  const unwritten = central.centralClipBinding({ref: `subject:note:${PATH}`, values: flowValues(journeyIsland(null)), location: LOCATION, island: journeyIsland(null)}, {clip: PATH})
  const reading = byId(acts.objectMenu(target, set, context(unwritten)), 'open-in:reading')
  assert.equal(reading.disabled, true)
  assert.equal(reading.why, central.CENTRAL_WIRING.refused.opensAs)
})

test('the open menu reads the clip\'s acts again when its Clip view publishes: the page read after the menu opened brings its choices', () => {
  const heard = []
  const off = door.subscribeHostedClip(binding => heard.push(binding?.ref ?? null))
  try {
    const binding = bindingOver(journeyIsland(null), async () => {})
    door.publishHostedClip(binding)
    door.publishHostedClip(null)
  } finally { off() }
  door.publishHostedClip(null)
  assert.deepEqual(heard, [`subject:note:${PATH}`, null], 'each publish is heard while subscribed, and none after')
})

test('the menu draws a chosen way as a checked radio item (manual §10.9 menus, Live\'s checked entries)', async () => {
  const source = await readFile(new URL('../src/frame/menu/ObjectMenu.tsx', import.meta.url), 'utf8')
  assert.match(source, /menuitemradio/)
  assert.match(source, /aria-checked=\{item\.checked\}/)
})
