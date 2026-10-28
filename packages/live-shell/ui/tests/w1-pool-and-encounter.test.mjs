import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// W1 (T-WORLDS §3; manual §10.3, §16.4, §16.7): the pool under the browser holds your workspaces and nothing else (in Live, the set's
// grooves behind a switch); a device opens whole in its band above the chain and never fills the pool; the browser's aperture slot is
// gone — its context rows stand in the encounter bar above the panes, a document's Save and Re-read in its own head; the named sets
// became workspaces, kept in the book with what each keeps.
// Channels: SCRIPTED — the pool's acts as pure changes of a fixture book, the book's decode, the encounter rows, the trail's steps,
// the keys, the band's held device; SSR of the encounter bar. CODE-READING — the browser, the frame and the retired parts. NOT a
// screen pass: the pool and the bar on screen are the lead's native pass.
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
const stored = new Map()
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key), key: () => null, length: 0}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const rows = await import('../src/frame/encounter/encounterRows.ts')
const {TransportTitle} = await import('../src/components/TransportBar.tsx')
const pool = await import('../src/continuity/workspacePool.ts')
const store = await import('../../../../desktop/cradle/src/workspace/store.ts')
const areas = await import('../src/shell/workspaceAreas.ts')
const surfaceTypes = await import('../../../../desktop/cradle/src/surface/types.ts')
const devices = await import('../src/frame/devices/deviceDoor.ts')
const {workspaceTint, nameFromDrop} = await import('../src/frame/browser/WorkspacePool.tsx')
const encounterBridge = await import('../src/projections/encounterBridge.ts')
const trailWidget = await import('../src/shell/TrailWidget.tsx')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const h = React.createElement
const value = (list, key) => list.find(row => row.key === key)
const CONFIG = {default_set: '', world_scope: {owner: 'central', world: 'control:root', personal_ground: '/ground', workcell_ref: 'workcell:mac'}}

// ── the book: fixture trees ───────────────────────────────────────────────
const tree = (mode, tag, build) => ({root: null, surfaces: {[`s-${tag}`]: {id: `s-${tag}`, kind: 'projection', title: tag, ...(build ? {projection: {kind: 'projection.earth', build}} : {})}},
  closedStack: [], ...(mode && mode !== 'base' ? {mode} : {}), leftWidth: 240})
const workspace = (id, name, over = {}) => ({id, name, writing: '', layout: tree('base', `${id}-central`), modeLayouts: {factory: tree('factory', `${id}-factory`)},
  widgets: {open: [`${id}-widget`]}, context: {world: 'central'}, ...over})
const book = (over = {}) => ({version: 2, active: 'a', workspaces: [workspace('a', 'Writing', {context: {world: 'central', selection: {mode: 'base', kind: 'day', ref: 'day:1', title: 'Today'}}}),
  workspace('b', 'Research')], ...over})
const tags = layout => Object.keys(layout.surfaces)
const active = b => b.workspaces.find(w => w.id === b.active)

// ── the pool's acts ───────────────────────────────────────────────────────

test('Launch brings a workspace\'s trees and rail back, keeps your selection and world, and opens in its last mode', () => {
  const next = pool.launchWorkspace(book(), 'b', 100)
  assert.equal(next.active, 'b')
  const b = active(next)
  assert.deepEqual(tags(b.layout), ['s-b-central'], 'its Central tree comes forward (its last mode)')
  assert.deepEqual(tags(b.modeLayouts.factory), ['s-b-factory'], 'and the layout Factory opens with')
  assert.deepEqual(b.widgets.open, ['b-widget'], 'its rail')
  assert.equal(b.context.selection.ref, 'day:1', 'launching changes no page: the selection stays yours')
  assert.equal(b.lastVisitedAt, 100)
})

test('Opens in brings its mode forward; On launch "Restore open mode" restores that tree only, "Restore nothing" none', () => {
  const opened = pool.setWorkspaceOpensIn(book(), 'b', 'factory')
  const launched = active(pool.launchWorkspace(opened, 'b', 1))
  assert.equal(launched.layout.mode, 'factory'); assert.deepEqual(tags(launched.layout), ['s-b-factory'])
  const open = active(pool.launchWorkspace(pool.setPoolSettings(opened, {onLaunch: 'open'}), 'b', 1))
  assert.deepEqual(tags(open.layout), ['s-b-factory'], 'the mode that comes forward is restored')
  assert.deepEqual(tags(open.modeLayouts.base), ['s-a-central'], 'the other modes stay as they were in front of you')
  const nothing = active(pool.launchWorkspace(pool.setPoolSettings(book(), {onLaunch: 'nothing'}), 'b', 1))
  assert.deepEqual(tags(nothing.layout), ['s-a-central']); assert.deepEqual(nothing.widgets.open, ['a-widget'], 'nothing comes back')
})

test('a column Off keeps that part as it is in front of you; Instruments Off brings an instrument back on its default build', () => {
  let b = pool.setWorkspaceKeep(book(), 'b', 'panes', false)
  b = pool.setWorkspaceKeep(b, 'b', 'widgets', false)
  const launched = active(pool.launchWorkspace(b, 'b', 1))
  assert.deepEqual(tags(launched.layout), ['s-a-central'], 'Panes Off: the tree in front of you stays')
  assert.deepEqual(tags(launched.modeLayouts.factory), ['s-b-factory'], 'Layouts On: the other modes still come back')
  assert.deepEqual(launched.widgets.open, ['a-widget'], 'Widgets Off: the rail stays')
  const built = {...book(), workspaces: [workspace('a', 'A'), workspace('b', 'B', {layout: tree('base', 'b-earth', 'globe-gl')})]}
  const plain = active(pool.launchWorkspace(pool.setWorkspaceKeep(built, 'b', 'instruments', false), 'b', 1))
  assert.equal(plain.layout.surfaces['s-b-earth'].projection.build, undefined, 'the build is not kept')
  assert.equal(active(pool.launchWorkspace(built, 'b', 1)).layout.surfaces['s-b-earth'].projection.build, 'globe-gl', 'Instruments On keeps it')
  assert.equal(pool.keepsOf(pool.setWorkspaceKeep(b, 'b', 'panes', true)).panes, true)
  assert.equal(pool.setWorkspaceKeep(pool.setWorkspaceKeep(book(), 'b', 'panes', false), 'b', 'panes', true).workspaces[1].keeps, undefined, 'all On is the default, written as nothing')
})

test('Keep context: on leaving keeps what was in front; by hand, a launch brings back only what Keep stored', () => {
  const leave = pool.setPoolSettings(book(), {keepContext: 'leave'})
  const left = pool.launchWorkspace(leave, 'b', 5)
  assert.deepEqual(tags(left.workspaces[0].kept.layout), ['s-a-central'], 'leaving A, A keeps what was in front')
  const manual = pool.setPoolSettings(book(), {keepContext: 'manual'})
  const kept = pool.keepIntoWorkspace(manual, 'b', 7)
  assert.deepEqual(tags(kept.workspaces[1].kept.layout), ['s-a-central'], 'Keep stores what is in front into B')
  assert.equal(kept.workspaces[1].kept.keptAt, 7)
  assert.deepEqual(tags(active(pool.launchWorkspace(kept, 'b', 8)).layout), ['s-a-central'], 'B launches what Keep stored, not its record')
  const changed = pool.keepIntoWorkspace(pool.setWorkspaceKeep(manual, 'b', 'panes', false), 'b', 9)
  assert.deepEqual(tags(changed.workspaces[1].kept.layout), ['s-b-central'], 'a part B does not keep stays as it last kept it')
})

test('a dropped tab makes a new workspace of what is in front of you; the named sets become workspaces of their own', () => {
  const next = pool.workspaceFromFront(book(), 'Flow · today', 'new', 3)
  assert.equal(next.active, 'new'); const made = active(next)
  assert.equal(made.name, 'Flow · today'); assert.deepEqual(tags(made.layout), ['s-a-central']); assert.equal(made.kept.keptAt, 3)
  assert.equal(pool.workspaceFromFront(book(), '  ', 'x').active, 'a', 'no name, no workspace')
  assert.equal(nameFromDrop('  ', 'Writing · kept'), 'Writing · kept'); assert.equal(nameFromDrop('Day', 'x'), 'Day')
  const withSets = {...book(), workspaces: [workspace('a', 'A', {sets: [{id: 's1', name: 'Two panes', mode: 'factory', layout: tree('factory', 'set'), savedAt: 42}]}), workspace('b', 'B')]}
  let n = 0
  const moved = pool.setsAsWorkspaces(withSets, () => `w${++n}`)
  assert.equal(moved.workspaces[0].sets, undefined, 'the set leaves the record it was kept in')
  const fromSet = moved.workspaces.find(w => w.id === 'w1')
  assert.equal(fromSet.name, 'Two panes'); assert.equal(fromSet.opensIn, 'factory'); assert.equal(fromSet.layout.mode, 'factory')
  assert.deepEqual(tags(fromSet.layout), ['s-set']); assert.equal(fromSet.kept.keptAt, 42)
  const plain = book()
  assert.equal(pool.setsAsWorkspaces(plain), plain, 'a book with no sets is unchanged')
})

test('the book keeps what each workspace keeps, its Opens in, its kept context and the footer across a reload', () => {
  const key = 'oi.test.w1.book'
  const fresh = () => surfaceTypes.freshLayout()
  const real = {version: 2, active: 'a', workspaces: [{id: 'a', name: 'A', writing: '', layout: fresh()}, {id: 'b', name: 'B', writing: '', layout: fresh()}]}
  const saved = pool.setPoolSettings(pool.setWorkspaceOpensIn(pool.setWorkspaceKeep(pool.keepIntoWorkspace(pool.setPoolSettings(real, {keepContext: 'manual'}), 'b', 11),
    'b', 'widgets', false), 'b', 'techne'), {onLaunch: 'open'})
  stored.set(key, JSON.stringify(saved))
  const loaded = store.loadWorkspaceBook({storageKey: key, legacyLayoutKey: null}).book
  assert.deepEqual(loaded.pool, {onLaunch: 'open', keepContext: 'manual'})
  const b = loaded.workspaces.find(w => w.id === 'b')
  assert.equal(b.keeps.widgets, false); assert.equal(b.keeps.panes, true); assert.equal(b.opensIn, 'techne'); assert.equal(b.kept.keptAt, 11)
  assert.equal(loaded.workspaces.find(w => w.id === 'a').keeps, undefined, 'all On reads back as the default')
  assert.equal(store.decodePoolSettings({onLaunch: 'all', keepContext: 'change'}), undefined, 'the defaults are written as nothing')
  assert.equal(store.decodePoolSettings({onLaunch: 'sideways'}), undefined, 'an unknown value is the default')
})

test('a workspace\'s colour is one of the shell\'s tokens, the same for the same workspace', () => {
  assert.match(workspaceTint('abc'), /^var\(--[a-z-]+\)$/)
  assert.equal(workspaceTint('abc'), workspaceTint('abc'))
})

// ── the encounter bar ─────────────────────────────────────────────────────

test('with no reading, every encounter row says "—" and says why', () => {
  const list = rows.contextRows({pane: null, context: null, config: null, spine: null})
  assert.deepEqual(list.map(row => row.key), ['field', 'world', 'subject', 'occasion'], 'the mockup\'s spine, in its order')
  for (const row of list) { assert.equal(row.value, '—', `${row.key} waits`); assert.ok(row.info.length > 20, `${row.key} says why`) }
})

test('the rows read the World, THE selection and the civil Now; a selected occasion stands over it; a hosted pane names its field', () => {
  const instant = Date.UTC(2026, 9, 8, 13, 37)
  const spine = {now: () => ({instantUnixMs: instant, dayRef: 'central:day:control:root:2026-10-08', source: 'kernel temporal read'}), occasion: () => null}
  const context = {world: 'central', selection: {mode: 'base', kind: 'day', ref: 'Control/agents/now/day/2026-10-08.md', title: '2026-10-08.md'}}
  const list = rows.contextRows({pane: null, context, config: CONFIG, spine})
  assert.equal(value(list, 'world').value, 'Central'); assert.equal(value(list, 'world').dot, 'var(--accent)')
  assert.equal(value(list, 'subject').value, '2026-10-08.md'); assert.equal(value(list, 'subject').mark, 'day')
  assert.equal(value(list, 'occasion').value, `now · ${rows.clockOf(instant)}`)
  const occasion = {basis: {ref: 'event:1', instantUnixMs: null, summary: 'the stone carved', evidenceRefs: [], retainedAtUnixMs: 1, civilDayRef: 'central:day:control:root:1950-01-01'},
    admission: {admitted: false, qualifiedAtUnixMs: 2, disclosure: 'absent from the latest read'}}
  const hosted = rows.contextRows({pane: {fieldRef: 'field:jung-circle', worldRef: 'world:human:ariadne'}, context: {world: 'central'}, config: CONFIG,
    spine: {now: () => ({instantUnixMs: 1, dayRef: null, source: 's'}), occasion: () => occasion}})
  assert.equal(value(hosted, 'occasion').value, 'the stone carved · 01 Jan'); assert.equal(value(hosted, 'occasion').standing, 'not admitted now')
  assert.equal(value(hosted, 'field').value, 'field:jung-circle'); assert.equal(value(hosted, 'world').value, 'world:human:ariadne · projection')
})

test('Back and Forward walk the trail from the bar\'s place on it', () => {
  assert.deepEqual(rows.trailSteps(0, -1), {back: null, forward: null})
  assert.deepEqual(rows.trailSteps(3, 2), {back: 1, forward: null}, 'at the newest stop, Back only')
  assert.deepEqual(rows.trailSteps(3, 0), {back: null, forward: 1})
  assert.deepEqual(rows.trailSteps(3, 1), {back: 0, forward: 2})
})

test('the bar above the panes is gone (manual §10.1): Back and Forward stand at the head of the title line, waiting while the trail is empty', async () => {
  await assert.rejects(source('frame/encounter/EncounterBar.tsx'), {code: 'ENOENT'}, 'the encounter bar is retired')
  const html = renderToStaticMarkup(h(TransportTitle, {line: 'selection', workName: 'Today'}))
  assert.match(html, /<span class="title-trail"><button type="button" aria-label="Back" disabled=""[^>]*>‹<\/button><button type="button" aria-label="Forward" disabled=""/)
})

// ── the frame ─────────────────────────────────────────────────────────────

test('⌥⌘6 shows or hides the pool, by the key and by the character macOS gives it under Option', () => {
  assert.equal(areas.frameToggleOf({key: '6', code: 'Digit6', metaKey: true, altKey: true}), 'pool')
  assert.equal(areas.frameToggleOf({key: '§', metaKey: true, altKey: true}), 'pool')
  assert.equal(areas.frameToggleOf({key: '6', code: 'Digit6', metaKey: true, altKey: false}), null)
})

test('a device held in its band stands whole there, drawn by the band host; letting it go folds the band', () => {
  const entry = {device: {id: 'ql:sky', face: {id: 'sky', title: 'Sky'}, rows: []}}
  devices.holdInBand('ql:sky', entry)
  assert.equal(devices.flippedDeviceId(), 'ql:sky'); assert.equal(devices.heldInBand('ql:sky'), true); assert.equal(devices.selectedDeviceId(), 'ql:sky')
  devices.holdInBand('ql:sky', null)
  assert.equal(devices.flippedDeviceId(), null); assert.equal(devices.heldInBand('ql:sky'), false)
})

test('the pool holds the workspaces and nothing else; Whole stands only as the band; the aperture slot and the device pools are gone (code-reading)', async () => {
  const browser = await source('frame/browser/Browser.tsx')
  assert.match(browser, /<WorkspacePool grooves=\{poolFace\} \/>/)
  assert.doesNotMatch(browser, /DevicePool|ApertureSlot|poolHost/)
  const view = await source('frame/devices/DeviceView.tsx')
  assert.match(view, /FRAME_OF_VIEW[^=]*= \{whole: 'flip'/)
  const design = await source('inhabitants/catalogue/panels/design.ts')
  assert.match(design, /export type Frame = 'chain' \| 'flip' \| 'pane' \| 'window' \| 'rail'/)
  const app = await source('App.tsx')
  assert.doesNotMatch(app, /OPEN_DEVICE_EVENT|useSelectedDeviceId|poolDevice/, 'choosing a device never opens the browser or fills the pool')
  assert.match(app, /<main className="center" data-main-view=\{mainView\}><div className=/, 'the main area holds its view, with nothing above it')
  assert.doesNotMatch(app, /EncounterBar/)
  for (const gone of ['frame/devices/DevicePool.tsx', 'agent/AgentDevicePool.tsx', 'frame/browser/apertureViews.tsx', 'shell/SetsSection.tsx'])
    await assert.rejects(source(gone), {code: 'ENOENT'}, `${gone} is retired`)
  for (const file of ['agent/AgentShellBrowser.tsx', 'components/WorldBrowser.tsx', 'shell/ModeBrowser.tsx', 'shell/modeBrowsers.tsx', 'components/BrowserPane.tsx'])
    assert.doesNotMatch(await source(file), /SetsSection|poolHost|DevicePool \/>/, `${file} draws nothing into the pool`)
  const world = await source('components/WorldBrowser.tsx')
  assert.match(world, /createPortal\(<div className="dp-wide dp-flip device-flip native-device-band"/, 'a native device chosen in the browser stands in the band')
  for (const face of ['inhabitants/DocumentFlowFace.tsx', 'inhabitants/DocumentDayDieFace.tsx'])
    assert.match(await source(face), /className="document-pane-acts"[\s\S]*data-action="save"[\s\S]*data-action="reread"/, `${face}: Save and Re-read in its own head`)
})

test('in Live the pool\'s other face is the set\'s own Groove Pool, read and written through the set\'s owner (code-reading)', async () => {
  const faces = await readFile(new URL('../src/shell/modeBrowsers.tsx', import.meta.url), 'utf8')
  assert.match(faces, /live: \(\{setPath\}\) => \(\{label: 'Grooves', face: <LiveGroovePool path=\{setPath\} \/>\}\)/)
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /poolFace=\{MODE_POOL_FACES\[frameMode\]\?\.\(\{setPath: state\.set\?\.path \?\? null\}\) \?\? null\}/)
  const face = await readFile(new URL('../src/frame/browser/LiveGroovePool.tsx', import.meta.url), 'utf8')
  for (const write of [/writeLiveGroove\(path, index, 'base', event\.target\.value\)/, /writeLiveGroove\(path, index, amount\.field, value\)/, /writeLiveGlobalGroove\(path, value\)/])
    assert.match(face, write)
  assert.match(face, /useLiveGrooves\(path\)/, 'the face holds no groove of its own: it reads the set\'s')
  assert.match(face, /Global Amount/)
})

// ── #764 going back: Back and Forward over one trail (manual §10.7, §23.5) ──
// Channels: SCRIPTED — the book's trail law (desktop/cradle/src/workspace/store.ts) driven the way the shell drives it: chooseMode's
// move (projections/encounterBridge.ts moveTo), the book's select (selectOnTrail), the spine bridge's subject and occasion
// transitions, and the one return the title line's Back and Forward and the Trail share (shell/TrailWidget.tsx returnToStop).
// CODE-READING — chooseMode, the title line, the Trail's binding. NOT a screen pass: the walk on the native candidate is the lead's.

/** A fixture with the workspace book's contract: the context through its one bounded writer, the tree mode through switchMode. */
const trailBook = (context = {}, mode = 'base') => {
  const book = {
    current: {context, layout: {mode}},
    setContext(change) { book.current = {...book.current, context: store.boundedContext(change(book.current.context ?? {}))} },
    switchMode(next) { book.current = {...book.current, layout: {...book.current.layout, mode: next}} },
  }
  const bridge = encounterBridge.createSpineEncounterBridge({current: {book, get workspace() { return {mode: book.current.layout.mode, accessEpoch: 1} }}})
  return {book, bridge, trail: () => book.current.context.trail ?? [], context: () => book.current.context, mode: () => book.current.layout.mode,
    /** chooseMode's two writes (App.tsx): the move into the mode with the world it enters, then the tree. */
    chooseMode: (next, world, at) => { book.setContext(c => encounterBridge.moveTo({...c, world}, next, at)); book.switchMode(next) }}
}
const SECRET = 'The whole text of the passage, which no stop holds.'
const SHAPE = {stop: ['mode', 'label', 'at', 'surfaceRef', 'surfaceKind', 'position', 'world', 'selection', 'subject', 'reading'],
  selection: ['mode', 'kind', 'ref', 'title', 'track'], subject: ['ref', 'kind', 'title', 'project'], reading: ['ref', 'position']}
/** Refs, titles, positions and a time: every key a stop holds is one of these, every value a short string or a number. */
const contentFree = stop => {
  for (const key of Object.keys(stop)) assert.ok(SHAPE.stop.includes(key), `a stop holds no ${key}`)
  for (const part of ['selection', 'subject', 'reading']) for (const key of Object.keys(stop[part] ?? {})) assert.ok(SHAPE[part].includes(key), `a stop's ${part} holds no ${key}`)
  assert.doesNotMatch(JSON.stringify(stop), /whole text/, 'no content reaches a stop')
}

test('#764 each kind of move adds one stop, stamped with its time, and no stop carries content', () => {
  const f = trailBook({}, 'live')
  const T = Date.UTC(2026, 9, 28, 9, 0)
  f.chooseMode('base', 'central', T)
  assert.equal(f.trail().length, 1, 'a mode switch adds one stop')
  assert.deepEqual(f.trail()[0], {mode: 'base', label: 'Central', at: T, world: 'central'}, 'the place it lands on: the mode, the world it enters')
  f.book.setContext(c => store.selectOnTrail(c, {mode: 'base', kind: 'file', ref: 'Work/essay.md', title: 'Essay', content: SECRET}, T + 1))
  assert.equal(f.trail().length, 2, 'a selection adds one stop')
  f.bridge.transition({kind: 'subject', ref: 'wiki:node:mercurius', subjectKind: 'subject', title: 'Mercurius', content: SECRET})
  assert.equal(f.trail().length, 3, 'a subject change adds one stop')
  f.bridge.transition({kind: 'occasion', ref: 'occasion:day-2026-10-28', position: '¶2', content: SECRET})
  assert.equal(f.trail().length, 4, 'an occasion change adds one stop')
  f.chooseMode('techne', undefined, T + 4)
  assert.equal(f.trail().length, 5, 'and so does the next mode switch')
  const kept = f.trail().length
  f.chooseMode('techne', undefined, T + 5)
  assert.equal(f.trail().length, kept, 'choosing the mode you stand in is no move')
  f.book.setContext(c => store.selectOnTrail(c, {mode: 'base', kind: 'file', ref: 'Work/essay.md', title: 'Essay'}, T + 6))
  assert.equal(f.trail().length, kept, 'selecting what is selected is no move')
  f.bridge.transition({kind: 'subject', ref: 'wiki:node:mercurius', subjectKind: 'subject', title: 'Mercurius'})
  assert.equal(f.trail().length, kept, 'the same subject is no move')
  f.bridge.transition({kind: 'occasion', ref: 'occasion:day-2026-10-28', position: '¶9'})
  assert.equal(f.trail().length, kept, 'a new point in the reading you stand on is no move')
  assert.deepEqual(f.trail().at(-1).reading, {ref: 'occasion:day-2026-10-28', position: '¶9'}, 'the stop you stand on takes it')
  for (const stop of f.trail()) { assert.equal(typeof stop.at, 'number', `${stop.label} carries its time`); contentFree(stop) }
})

test('#764 Back and Forward walk one trail: Central, the document at its passage, Technē, Expressions; back to the passage and forward again', () => {
  const f = trailBook({}, 'live')
  const T = Date.UTC(2026, 9, 28, 9, 0)
  const essay = {mode: 'base', kind: 'file', ref: 'Work/essay.md', title: 'Essay'}
  f.chooseMode('base', 'central', T)
  f.book.setContext(c => store.selectOnTrail(c, essay, T + 60e3))
  // The document's pane names where its reading stands (the occasion intent), then the person scrolls to a passage.
  f.bridge.transition({kind: 'occasion', ref: essay.ref, position: '¶3'})
  f.bridge.transition({kind: 'occasion', ref: essay.ref, position: '¶7'})
  f.chooseMode('techne', undefined, T + 120e3)
  f.chooseMode('expressions', undefined, T + 180e3)
  assert.deepEqual(f.trail().map(stop => [stop.mode, stop.label, stop.position ?? null]),
    [['base', 'Central', null], ['base', 'Essay', '¶7'], ['techne', 'Essay', '¶7'], ['expressions', 'Essay', '¶7']])
  // The title line: a step from the book's place on the trail, through the one return.
  const step = direction => {
    const index = rows.trailSteps(f.trail().length, store.standingOn(f.context()))[direction]
    assert.notEqual(index, null, `${direction} stands`)
    trailWidget.returnToStop(f.book, index)
  }
  const kept = f.trail().length
  step('back')
  assert.equal(f.mode(), 'techne', 'one Back: Technē')
  step('back')
  assert.equal(f.mode(), 'base', 'Back again: Central')
  assert.deepEqual(f.context().selection, essay, 'on the document')
  assert.deepEqual(f.context().reading, {ref: essay.ref, position: '¶7'}, 'at the passage')
  assert.equal(f.context().world, 'central')
  assert.equal(f.context().trailAt, 1, 'the book holds the stop you stand on')
  assert.equal(f.trail().length, kept, 'walking adds no stop')
  step('forward'); step('forward')
  assert.equal(f.mode(), 'expressions', 'Forward returns to Expressions')
  assert.equal(f.context().trailAt, undefined, 'standing on the newest stop again')
  assert.equal(rows.trailSteps(f.trail().length, store.standingOn(f.context())).forward, null, 'Forward waits at the newest stop')
  assert.equal(f.trail().length, kept)
  for (const stop of f.trail()) assert.match(trailWidget.stopTime(stop), /^\d\d:\d\d$/, `the Trail lists ${stop.label} with its time`)
  // Somewhere new after a walk: the return is kept, then the new place, so Back goes where you were and nothing you went to is lost.
  step('back'); step('back')
  f.chooseMode('factory', undefined, T + 240e3)
  assert.deepEqual(f.trail().slice(-2).map(stop => [stop.mode, stop.label]), [['base', 'Essay'], ['factory', 'Essay']])
  assert.equal(f.trail().length, kept + 2, 'the return, then the new place; the stops walked past are kept')
  assert.equal(rows.trailSteps(f.trail().length, store.standingOn(f.context())).forward, null, 'Forward waits: you went somewhere new')
  step('back')
  assert.equal(f.mode(), 'base')
  assert.deepEqual(f.context().reading, {ref: essay.ref, position: '¶7'}, 'Back goes where you were')
})

test('#764 the stop you stand on is the book\'s: it decodes with the trail and follows the bound', () => {
  const trail = Array.from({length: 3}, (_, i) => ({mode: 'base', label: `S${i}`, at: i}))
  assert.equal(store.decodeWorldContext({trail, trailAt: 1}).trailAt, 1)
  assert.equal(store.decodeWorldContext({trail, trailAt: 2}).trailAt, undefined, 'the newest stop is where an unwalked trail stands')
  assert.equal(store.decodeWorldContext({trail, trailAt: 7}).trailAt, undefined, 'a place off the trail is none')
  const long = Array.from({length: 30}, (_, i) => ({mode: 'base', label: `S${i}`}))
  assert.equal(store.decodeWorldContext({trail: long, trailAt: 10}).trailAt, 4, 'the bound keeps the same stop')
  assert.equal(store.boundedContext({trail: long, trailAt: 10}).trailAt, 4)
  assert.equal(store.boundedContext({trail: long, trailAt: 2}).trailAt, undefined, 'a stop the bound drops is stood on no longer')
  const place = {mode: 'techne', label: 'Essay', at: 5, world: 'central', selection: {mode: 'base', kind: 'file', ref: 'Work/essay.md', title: 'Essay'},
    subject: {ref: 'wiki:node:m', kind: 'subject', title: 'M'}, reading: {ref: 'Work/essay.md', position: '¶7'}}
  const decoded = store.decodeWorldContext({trail: [place, {...place, reading: {position: 'no ref'}, selection: {ref: 'x'}}]}).trail
  // Each part decodes as the context's own does (an absent optional field read as undefined).
  assert.equal(decoded[0].world, 'central')
  assert.deepEqual(decoded[0].selection, {...place.selection, track: undefined})
  assert.deepEqual(decoded[0].subject, {...place.subject, project: undefined})
  assert.deepEqual(decoded[0].reading, place.reading)
  assert.equal(decoded[1].reading, undefined, 'a damaged reading is dropped')
  assert.equal(decoded[1].selection, undefined, 'a damaged selection is dropped')
})

test('#764 chooseMode, the title line and the Trail move and walk through the one law (code-reading)', async () => {
  const app = await source('App.tsx')
  assert.match(app, /const chooseMode = \(next: SurfMode\) => \{[\s\S]*?continuity\.setContext\(context => moveTo\(\{\.\.\.context, world: [^}]*\}, BOOK_MODE_OF_SHELL\[shell\]\)\)[\s\S]*?continuity\.setMode\(shell\)/,
    'a mode switch is a move: it appends the place it lands on')
  const bar = await source('components/TransportBar.tsx')
  assert.match(bar, /trailSteps\(trail\.length, standingOn\(context \?\? \{\}\)\)/, 'the title line steps from the book\'s place on the trail')
  assert.match(bar, /returnToStop\(continuity, index\)/, 'through the one return')
  assert.doesNotMatch(bar, /useState\(trail\.length - 1\)/, 'the line keeps no place of its own')
  const rail = await source('widgets/railDevices.tsx')
  assert.match(rail, /returnToStop\(book, index\)/, 'the Trail returns through the same')
  assert.doesNotMatch(rail, /book\.switchMode\(stop\.mode\)/, 'and has no return of its own')
})
