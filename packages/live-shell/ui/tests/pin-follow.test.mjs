import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// FOUNDATION F2, manual §10.2: "A pane follows what you select, unless you pin it. A pinned pane keeps its subject while you
// work elsewhere." The pane's subject (projectionModules.ts createPaneSubject) is what the host hands every module; the Earth and
// the Graph turn to it (registerAtlasHost.ts), the Timeline keeps it as its selected ref (timelinePane.tsx). The module door and
// the atlas's turning are run here headless with a fake atlas handle; the React effects that feed the subject (projectionPane.tsx)
// and the pane's pin control are read in the source — their on-screen behaviour is UNVERIFIED headless.
// Production modules in memory (the atlas-host loader): .ts/.tsx transpiled, CSS and JSON stubbed.
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const modules = await import('../../../../desktop/cradle/src/surface/projectionModules.ts')
const {ProjectionPaneSession} = await import('../../../../desktop/cradle/src/surface/projectionPaneSession.ts')
const atlasHost = await import('../src/projections/atlas/registerAtlasHost.ts')
const panel = await import('../src/projections/atlas/AtlasProjectionPanel.tsx')
const {registerTimelineHost} = await import('../src/projections/timelinePane.tsx')
const {registerDevicePane} = await import('../src/frame/devices/devicePane.tsx')
const {registerExpressionsPaneHost} = await import('../src/projections/expressionsPane.tsx')
const source = path => readFile(new URL(path, import.meta.url), 'utf8')

const {createPaneSubject, followedRefOf, followsSelection} = modules

// ── the pane's subject ─────────────────────────────────────────────────────

test('a pane shows the selection it follows until it is pinned, and a pinned pane keeps its subject while the selection moves', () => {
  const subject = createPaneSubject({followed: 'clip:a'})
  const seen = []
  subject.subscribe(() => seen.push([subject.pinned(), subject.shown()]))
  assert.equal(subject.shown(), 'clip:a'); assert.equal(subject.pinned(), undefined)
  subject.follow('clip:b')
  assert.deepEqual(seen.at(-1), [undefined, 'clip:b'], 'a following pane moves with the selection')
  subject.pin('clip:b')
  assert.deepEqual(seen.at(-1), [ 'clip:b', 'clip:b'], 'pinning the very thing shown still tells the module: its state is now pinned')
  const told = seen.length
  subject.follow('clip:c'); subject.follow('task:d')
  assert.equal(seen.length, told, 'the selection moving elsewhere tells a pinned pane nothing')
  assert.equal(subject.shown(), 'clip:b', 'and its subject stays')
  subject.pin('clip:z')
  assert.deepEqual(seen.at(-1), ['clip:z', 'clip:z'], 'a new pin replaces the old')
  subject.pin(undefined)
  assert.deepEqual(seen.at(-1), [undefined, 'task:d'], 'released, it follows the selection again — the one now standing')
  subject.pin(undefined); subject.follow('task:d')
  assert.equal(seen.length, told + 2, 'a call that changes nothing tells nobody')
})

test('a subscriber is dropped when it unsubscribes; a pane with no selection shows nothing until pinned', () => {
  const subject = createPaneSubject()
  let calls = 0
  const stop = subject.subscribe(() => { calls++ })
  assert.equal(subject.shown(), undefined)
  subject.pin('wiki:node:identity')
  assert.equal(subject.shown(), 'wiki:node:identity'); assert.equal(calls, 1)
  stop(); subject.pin(undefined)
  assert.equal(calls, 1)
})

test('what a pane follows is THE selection, else the encounter\'s subject', () => {
  assert.equal(followedRefOf({selection: {mode: 'base', kind: 'clip', ref: 'clip:a', title: 'A'}, subject: {ref: 'subj', title: 'S'}}), 'clip:a')
  assert.equal(followedRefOf({subject: {ref: 'subj', title: 'S'}}), 'subj')
  assert.equal(followedRefOf({}), undefined)
})

// ── which kinds offer a pin ────────────────────────────────────────────────

test('a pin is offered where it can be real: the Earth, the Graph and the Session · Arrangement follow; the stage and a device do not', () => {
  atlasHost.registerAtlasHost(); registerTimelineHost(); registerDevicePane(); registerExpressionsPaneHost()
  for (const kind of ['projection.earth', 'projection.constellation', 'projection.timeline']) assert.equal(followsSelection(kind), true, kind)
  assert.equal(followsSelection('projection.expressions'), false, 'one hosted frame, one lease: the stage has no second subject to pin')
  assert.equal(followsSelection('projection.device'), false, 'a device pane\'s subject is the device it holds, not a selection')
  assert.equal(followsSelection('projection.nothing'), false); assert.equal(followsSelection('not-a-kind'), false)
})

// ── the module door: a pin reaches the mounted module and does not remount it ──

test('a mounted module is told of a pin and an unpin through the pane\'s subject; it is created once and never remounted', async () => {
  const subject = createPaneSubject({followed: 'clip:a'})
  const log = []
  let creates = 0, unmounts = 0
  const registration = {id: 'probe', kind: 'projection.probe', follows: true, create(context) {
    creates++
    const read = () => log.push([context.subject.pinned() ?? null, context.subject.shown() ?? null])
    const release = context.subject.subscribe(read)
    read()
    return {unmount() { unmounts++; release() }}
  }}
  const session = new ProjectionPaneSession(registration, {kind: 'projection.probe', binding: {id: 'p1', title: 'Probe'}, element: {}, encounter: {}, subject}, message => assert.fail(message))
  await session.ready
  subject.pin('clip:a'); subject.follow('clip:b'); subject.pin(undefined)
  assert.deepEqual(log, [[null, 'clip:a'], ['clip:a', 'clip:a'], [null, 'clip:b']], 'created following, pinned, then released onto the selection that moved meanwhile')
  assert.equal(creates, 1, 'the pin did not remount the module'); assert.equal(unmounts, 0)
  session.dispose()
  assert.equal(unmounts, 1)
  subject.pin('x')
  assert.equal(log.length, 3, 'a disposed module hears nothing more')
})

// ── the Earth turns to the subject ─────────────────────────────────────────

const occ = (id, familyId, extra = {}) => ({id, familyId, ...extra})
const model = () => {
  const list = [occ('occ-1', 'fam-a', {subject_ref: 'clip:one'}), occ('occ-2', 'fam-b', {basis: {ref: 'session:two'}}), occ('occ-3', 'fam-b')]
  return {occ: list, occIndex: new Map(list.map((item, index) => [item.id, index]))}
}

test('the atlas draws the occurrence whose owner ref, basis ref or id the subject names — and nothing for a ref it does not draw', () => {
  const held = model()
  assert.equal(atlasHost.occurrenceOfSubject(held.occ, 'clip:one'), 'occ-1')
  assert.equal(atlasHost.occurrenceOfSubject(held.occ, 'session:two'), 'occ-2')
  assert.equal(atlasHost.occurrenceOfSubject(held.occ, 'occ-3'), 'occ-3')
  assert.equal(atlasHost.occurrenceOfSubject(held.occ, 'clip:unplaced'), null)
  assert.deepEqual(atlasHost.stateForSubject(held, 'clip:one', {}), {view: {kind: 'manifest', occId: 'occ-1', context: {type: 'family', id: 'fam-a'}}, deep: false})
  assert.equal(atlasHost.stateForSubject(held, 'clip:one', {graph: true}).graph, true, 'the graph stays the graph')
  assert.equal(atlasHost.stateForSubject(held, 'clip:one', {sky: {}}), null, 'a person in the sky is not pulled out of it')
  assert.equal(atlasHost.stateForSubject(held, 'clip:unplaced', {}), null)
})

function fakeAtlas() {
  const navigated = []
  const handle = {model: model(), ctl: {state: {}, navigate: state => navigated.push(state.view.occId)}}
  panel.publishAtlasHandle(handle)
  return navigated
}

test('a following Earth is left where the person has it, then turns when the selection moves to something it draws', () => {
  const navigated = fakeAtlas()
  const subject = createPaneSubject({followed: 'clip:one'})
  const turning = atlasHost.turnWithSubject(subject, {held: null})
  assert.deepEqual(navigated, [], 'the selection standing at mount is not turned to')
  subject.follow('session:two')
  assert.deepEqual(navigated, ['occ-2'])
  subject.follow('clip:unplaced')
  assert.deepEqual(navigated, ['occ-2'], 'a subject the atlas does not draw turns nothing')
  subject.follow('clip:one')
  assert.deepEqual(navigated, ['occ-2', 'occ-1'])
  turning.stop()
  subject.follow('session:two')
  assert.deepEqual(navigated, ['occ-2', 'occ-1'], 'a stopped pane turns no more')
  panel.publishAtlasHandle(null)
})

test('a pinned Earth turns to its pin and keeps it while the selection moves; released, it follows the selection again', () => {
  const navigated = fakeAtlas()
  const subject = createPaneSubject({followed: 'clip:one'})
  const turning = atlasHost.turnWithSubject(subject, {held: null})
  subject.pin('session:two')
  assert.deepEqual(navigated, ['occ-2'], 'pinning turns the Earth to the pin')
  subject.follow('clip:one'); subject.follow('occ-3')
  assert.deepEqual(navigated, ['occ-2'], 'the selection moving elsewhere moves nothing in a pinned pane')
  subject.pin(undefined)
  assert.deepEqual(navigated, ['occ-2', 'occ-3'], 'released, it turns to the selection now standing')
  turning.stop(); panel.publishAtlasHandle(null)
})

test('a pane mounted already pinned turns to its pin once; a concealed pane turns when shown; a pane that does not hold the atlas turns nothing', () => {
  let navigated = fakeAtlas()
  const pinned = createPaneSubject({pinned: 'clip:one', followed: 'session:two'})
  const turning = atlasHost.turnWithSubject(pinned, {held: null})
  assert.deepEqual(navigated, ['occ-1'], 'mounted pinned, it opens on its pin')
  turning.visible(false)
  pinned.pin('session:two')
  assert.deepEqual(navigated, ['occ-1'], 'concealed, it does not turn')
  turning.visible(true)
  assert.deepEqual(navigated, ['occ-1', 'occ-2'], 'shown again, it catches up once')
  turning.visible(true)
  assert.deepEqual(navigated, ['occ-1', 'occ-2'], 'and not again')
  turning.stop()
  navigated = fakeAtlas()
  const other = createPaneSubject({pinned: 'clip:one'})
  atlasHost.turnWithSubject(other, {held: 'The Earth atlas is already open in another pane of this session.'})
  other.pin('session:two')
  assert.deepEqual(navigated, [], 'a held pane has no atlas to turn')
  assert.doesNotThrow(() => atlasHost.turnWithSubject(undefined, {held: null}).stop(), 'a host with no pane subject leaves the atlas as it was')
  panel.publishAtlasHandle(null)
})

// ── the React side: read in the source (UI legs UNVERIFIED) ────────────────

test('the pane host feeds the subject and the mount effect is not keyed on it (code-reading)', async () => {
  const host = await source('../../../../desktop/cradle/src/surface/projectionPane.tsx')
  assert.match(host, /createPaneSubject\(\{pinned: binding\.projection\?\.subject_ref, followed: followedRefOf\(bridge\.snapshot\(\)\)\}\)/)
  assert.match(host, /useEffect\(\(\) => \{paneSubject\.pin\(pinnedRef\);\}, \[paneSubject, pinnedRef\]\)/, 'a pin or an unpin reaches the module')
  assert.match(host, /paneSubject\.follow\(followedRefOf\(bridge\.snapshot\(\)\)\)/, 'the same render that publishes the spine moves what a following pane follows')
  assert.match(host, /subject: paneSubject,/, 'the module is handed the subject')
  assert.match(host, /\}, \[binding\.id, registration\?\.id, epoch\]\);/, 'the mount effect is keyed on the binding, the module and the connection — a pin remounts nothing')
  const timeline = await source('../src/projections/timelinePane.tsx')
  assert.match(timeline, /useSyncExternalStore\(subject \? subject\.subscribe : noUnsubscribe, subject \? subject\.pinned : noPin, noPin\)/)
  assert.match(timeline, /<PinnedTracks pinnedRef=\{pinnedRef\} \/>/, 'the body is told the pin')
})

test('Follow/Pin stands only on a pane whose kind follows the selection; a document pane holds its subject with no unpin (lane F)', async () => {
  const {readFile: read} = await import('node:fs/promises')
  const bench = await read(new URL('../../../../desktop/cradle/src/surface/Workbench.tsx', import.meta.url), 'utf8')
  assert.match(bench, /props\.paneGrammar && active && state\.surfaces\[active\]\?\.projection && followsSelection\(state\.surfaces\[active\]\.projection!\.kind\) && \(\(\) => \{/)
  assert.doesNotMatch(bench, /projection\?\.subject_ref \|\| followsSelection\(/, 'a held subject alone no longer raises the toggle')
})
