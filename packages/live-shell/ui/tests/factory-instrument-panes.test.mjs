import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The focused centre pane's instrument (owner ruling, 13 Oct 2026; paneInstrument.ts).
// Production modules in memory, the mode-surface-fidelity loader pattern.
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

// The Factory centre as a pane tree (owner ruling, DEVICE-SEMANTICS-LOCK §0.1 and §3). The agent surface is the default
// tab; instrument panes open beside it through the engine's own door; the Device side follows the focused tab.
const {factoryFocusedPane, deviceInstrumentFor} = await import('../src/shell/paneInstrument.ts')
const {seedFactoryCentre, hasFactoryCentre, hasFactoryTracks, openFactoryInstrumentPane, focusedSurfaceKind, agentTabClosable, AGENT_SHELL_ID, AGENT_SHELL_KIND, AGENT_TAB_TITLE, FACTORY_TRACKS_KIND, FACTORY_TRACKS_TITLE} = await import('../src/agent/factoryCentre.ts')
const engine = await import('../../../../desktop/cradle/src/surface/engine.ts')
const {closeSurface, activateSurface, groupsOf} = engine
const tabsOf = layout => groupsOf(layout.root).flatMap(group => group.tabs)
const tracksTabOf = layout => tabsOf(layout).find(id => layout.surfaces[id].kind === FACTORY_TRACKS_KIND)
const {freshLayout} = await import('../../../../desktop/cradle/src/surface/types.ts')
const {switchWorkspaceMode} = await import('../../../../desktop/cradle/src/workspace/store.ts')

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const appLines = app.split('\n')
const nativeWorkbench = await readFile(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
const agentPanel = await readFile(new URL('../src/panels/agentShell.tsx', import.meta.url), 'utf8')
const engineTree = await readFile(new URL('../../../../desktop/cradle/src/surface/Workbench.tsx', import.meta.url), 'utf8')
const modeFrames = await readFile(new URL('../src/shell/modeFrames.ts', import.meta.url), 'utf8')
const modeDetails = await readFile(new URL('../src/shell/modeDetails.tsx', import.meta.url), 'utf8')
const detailHost = await readFile(new URL('../src/frame/detail/DetailHost.tsx', import.meta.url), 'utf8')

test('the Factory tree seeds the mockup\'s [sessions] | [thread]: the shared Session pane left, the agent tab right, pinned, once', () => {
  const seeded = seedFactoryCentre(freshLayout())
  assert.ok(hasFactoryCentre(seeded), 'the agent tab is placed')
  assert.ok(hasFactoryTracks(seeded), 'the shared Session · Arrangement pane is placed')
  assert.equal(seeded.surfaces[AGENT_SHELL_ID].kind, AGENT_SHELL_KIND)
  assert.equal(seeded.surfaces[AGENT_SHELL_ID].title, AGENT_TAB_TITLE, 'the tab is named for what it holds: the thread')
  const groups = groupsOf(seeded.root)
  assert.equal(groups.length, 2, 'two panes: row, children [0, 1]')
  assert.equal(seeded.root.type, 'split')
  assert.equal(seeded.root.dir, 'h', 'side by side')
  const [left, right] = groups
  assert.deepEqual(left.tabs.map(id => seeded.surfaces[id].kind), [FACTORY_TRACKS_KIND], 'the Session pane stands on the left')
  assert.equal(seeded.surfaces[left.tabs[0]].title, FACTORY_TRACKS_TITLE, 'its tab reads as the mockup\'s: Sessions')
  assert.deepEqual(right.tabs, [AGENT_SHELL_ID], 'the thread stands on the right')
  assert.ok(right.pinned.includes(AGENT_SHELL_ID), 'the agent tab is pinned')
  assert.deepEqual(left.pinned, [], 'the Session pane is the user\'s to close')
  assert.equal(right.active, AGENT_SHELL_ID)
  assert.equal(seeded.focusedGroupId, left.id, 'the Session pane is focused: the mockup\'s focus:0')
  assert.deepEqual(seedFactoryCentre(seeded), seeded, 'seeding again changes nothing')
  assert.equal(seedFactoryCentre(seeded), seeded, 'and returns the same tree, so the Workbench\'s seed effect settles')
})

test('a book that stood with the agent tab alone gains the Session pane once, keeping its arrangement, focus and maximised pane', () => {
  // The old seed: the agent tab, pinned, alone in the tree (what every saved Factory book holds), under its old title.
  const old = freshLayout()
  const opened = engine.openBinding(old, {id: AGENT_SHELL_ID, kind: AGENT_SHELL_KIND, title: 'Agents'})
  const legacy = {...engine.activateSurface(opened, AGENT_SHELL_ID), focusedTabId: AGENT_SHELL_ID}
  const [home] = groupsOf(legacy.root)
  const pinned = {...legacy, root: {...legacy.root, pinned: [AGENT_SHELL_ID]}, maximizedGroupId: home.id}
  const gained = seedFactoryCentre(pinned)
  assert.ok(hasFactoryTracks(gained), 'the pane is added')
  const [left, right] = groupsOf(gained.root)
  assert.deepEqual(left.tabs.map(id => gained.surfaces[id].kind), [FACTORY_TRACKS_KIND], 'at the left edge of the agent tab\'s pane')
  assert.deepEqual(right.tabs, [AGENT_SHELL_ID])
  assert.equal(right.id, home.id, 'the agent tab\'s pane is the one it was')
  assert.ok(right.pinned.includes(AGENT_SHELL_ID), 'still pinned')
  assert.equal(gained.focusedGroupId, pinned.focusedGroupId, 'focus stays where the book left it')
  assert.equal(gained.focusedTabId, AGENT_SHELL_ID)
  assert.equal(gained.maximizedGroupId, home.id, 'a maximised pane stays maximised')
  assert.equal(gained.surfaces[AGENT_SHELL_ID].title, AGENT_TAB_TITLE, 'the saved title is brought to what the tab holds')
  assert.equal(seedFactoryCentre(gained), gained, 'a second open gains nothing')
})

test('a book that has the Session pane keeps its arrangement exactly; one that closed it is not given it back', () => {
  const seeded = seedFactoryCentre(freshLayout())
  const earth = openFactoryInstrumentPane(seeded, 'projection.earth')
  assert.equal(seedFactoryCentre(earth), earth, 'a placed tracks pane: nothing moves, nothing is added')
  // The user moves the tracks pane under the agent tab (a tab in the agent\'s pane): still placed, still not duplicated.
  const tracksId = tracksTabOf(seeded)
  const [, agentGroup] = groupsOf(seeded.root)
  const together = engine.moveTab(seeded, tracksId, agentGroup.id)
  assert.equal(seedFactoryCentre(together), together)
  // Closing is the user's act: the binding stays in `surfaces` (and on the closed stack), so the seed leaves the tree alone.
  const closed = closeSurface(seeded, tracksId)
  assert.notEqual(closed, seeded)
  assert.ok(!hasFactoryTracks(closed))
  assert.ok(closed.surfaces[tracksId], 'the closed binding is remembered')
  assert.equal(seedFactoryCentre(closed), closed, 'the seed respects a closed pane')
  const reopened = engine.reopenClosed(closed)
  assert.ok(hasFactoryTracks(reopened), 'Reopen closed brings it back')
  assert.equal(seedFactoryCentre(reopened), reopened)
})

test('a tree with other tabs and no agent tab gains the agent tab beside them and the Session pane left of it', () => {
  const earth = openFactoryInstrumentPane(freshLayout(), 'projection.earth')
  const seeded = seedFactoryCentre(earth)
  assert.ok(hasFactoryCentre(seeded) && hasFactoryTracks(seeded))
  assert.ok(tabsOf(seeded).some(id => seeded.surfaces[id].kind === 'projection.earth'), 'the other tab is kept')
  assert.equal(seedFactoryCentre(seeded), seeded)
})

test('the agent tab cannot be closed: the engine refuses a pinned surface', () => {
  const seeded = seedFactoryCentre(freshLayout())
  assert.equal(closeSurface(seeded, AGENT_SHELL_ID), seeded)
  assert.equal(agentTabClosable(seeded), false)
})

test('an Earth pane opens beside the seeded panes and closes on its own, the agent tab and the Session pane staying', () => {
  const seeded = seedFactoryCentre(freshLayout())
  const withEarth = openFactoryInstrumentPane(seeded, 'projection.earth')
  const tabs = tabsOf(withEarth)
  assert.equal(tabs.length, 3)
  assert.ok(tabs.includes(AGENT_SHELL_ID))
  assert.ok(tracksTabOf(withEarth), 'the Session pane stands')
  const earth = tabs.find(id => withEarth.surfaces[id].kind === 'projection.earth')
  const closed = closeSurface(withEarth, earth)
  assert.notEqual(closed, withEarth)
  assert.deepEqual(tabsOf(closed).sort(), tabsOf(seeded).sort())
})

test('the focused Earth pane takes the Device side as the 0 instrument; the agent tab keeps its own Device side', () => {
  const withEarth = openFactoryInstrumentPane(seedFactoryCentre(freshLayout()), 'projection.earth')
  const earth = tabsOf(withEarth).find(id => withEarth.surfaces[id].kind === 'projection.earth')
  const onEarth = activateSurface(withEarth, earth)
  const earthPane = factoryFocusedPane(focusedSurfaceKind(onEarth))
  assert.equal(deviceInstrumentFor('factory', earthPane.pane, earthPane.presentation, 'graph'), 'techne:m0')
  const onAgent = activateSurface(onEarth, AGENT_SHELL_ID)
  const agentPane = factoryFocusedPane(focusedSurfaceKind(onAgent))
  assert.equal(agentPane.pane, 'native.agent')
  assert.equal(deviceInstrumentFor('factory', agentPane.pane, agentPane.presentation, 'graph'), null, 'the agent tab keeps AgentShellDeviceDetail')
})

test('the seeded Session · Arrangement pane holds no instrument (FOUNDATION F3), and a Graph pane the 0 instrument', () => {
  const seeded = seedFactoryCentre(freshLayout())
  const timeline = factoryFocusedPane(focusedSurfaceKind(seeded))
  assert.equal(timeline.pane, 'projection.timeline', 'Factory opens with the Session pane focused')
  assert.equal(deviceInstrumentFor('factory', timeline.pane, timeline.presentation, 'graph'), null, 'the tracks pane keeps Factory\'s own chain')
  const graph = openFactoryInstrumentPane(seeded, 'projection.constellation')
  const graphPane = factoryFocusedPane(focusedSurfaceKind(graph))
  assert.equal(deviceInstrumentFor('factory', graphPane.pane, graphPane.presentation, 'graph'), 'techne:m0')
})

test('a knowledge pane is the standalone knowledge graph instrument; any other tab holds none', () => {
  assert.equal(deviceInstrumentFor('factory', factoryFocusedPane('knowledge').pane, null, 'graph'), 'knowledge-graph')
  assert.equal(deviceInstrumentFor('factory', factoryFocusedPane('file').pane, null, 'graph'), null)
})

test('the Factory tree and its agent tab persist through modeLayouts when the mode is left and returned to', () => {
  const layout = {...openFactoryInstrumentPane(seedFactoryCentre(freshLayout()), 'projection.earth'), mode: 'factory'}
  const away = switchWorkspaceMode({layout, modeLayouts: {}, context: undefined}, 'base')
  assert.ok(away.modeLayouts.factory, 'the Factory tree is kept under modeLayouts')
  assert.ok(away.modeLayouts.factory.surfaces[AGENT_SHELL_ID], 'the agent tab is kept')
  const back = switchWorkspaceMode(away, 'factory')
  assert.deepEqual(groupsOf(back.layout.root).flatMap(group => group.tabs), groupsOf(layout.root).flatMap(group => group.tabs))
  assert.ok(hasFactoryTracks(back.layout), 'the Session pane returns with the tree')
  assert.equal(seedFactoryCentre(back.layout), back.layout, 'and the seed finds nothing to add on the return')
  assert.ok(groupsOf(back.layout.root).find(group => group.tabs.includes(AGENT_SHELL_ID)).pinned.includes(AGENT_SHELL_ID), 'the pin persists with the tree')
})

// Source pins: the centre identity, the Device-side routing and the agent body (the frame is not renderable in a test harness).
test('Factory centre is the Workbench tree: the centre is native.workbench, and the agent-shell chrome stands on Factory', () => {
  assert.match(app, /const agentShell = isFactoryMode\(frameMode\) && !settingsPresented/, 'the agent-shell chrome stands over every Factory tree')
  // Every mode's centre is the Workbench tree (FOUNDATION F2); Factory first opens with its dock (shell/modeFrames.ts).
  assert.match(modeFrames, /factory: \{\.\.\.FRAME, centerPanel: 'native\.workbench', detailMode: 'clip', dock: true\}/, 'entering Factory presents the Workbench tree, its detail row on the mockup\'s Clip')
  assert.doesNotMatch(app, /setCenterPanel\('native\.agent'\)/, 'the agent centre panel is no longer the Factory centre')
})

test('the focused Factory tab routes the Device side through the existing deviceInstrumentFor', () => {
  const focus = appLines.find(l => l.includes('const focusedInstrument = deviceInstrumentFor('))
  assert.ok(focus, 'the Device side reads the instrument through deviceInstrumentFor')
  assert.match(app, /factoryFocusedPane\(/, 'a Factory tree names its focused pane through factoryFocusedPane')
  assert.match(app, /const focusedPane = settingsPresented \? 'world\.settings' : setStands \? paneFocus\.pane : centerPanel !== 'native\.workbench' \? centerPanel : paneFocus\.pane/)
  assert.match(app, /const paneFocus = setStands \? \{pane: 'projection\.timeline', presentation: timelinePane\} : factoryFocusedPane\(/, 'Session and Arrangement view stand for the set\'s tracks')
  // The one detail host (FOUNDATION F4) gives a focused instrument the Device side over the mode's own chain.
  assert.match(modeDetails, /factory: \{clip: FactoryClip, device: FactoryChain, dropHint: /, 'Factory\'s chain is its registered Device side')
  assert.match(detailHost, /const instrument = !registration\.ownsDeviceSide \? reading\.focusedInstrument : null/, 'a focused instrument pane takes the Device side')
})

test('an instrument opens as a pane inside the tree, never by leaving the centre (the browser\'s Instruments, FOUNDATION F2)', () => {
  assert.doesNotMatch(app, /TechneLensBar/, 'the lens bar is gone; its instruments are in the browser')
  // lane F (F2): the same door also answers 'in-view' (a palace entered brings the Earth into view: instrumentDoor.ts instrumentInView)
  assert.match(nativeWorkbench, /publishInstrumentOpener\(\(kind, at, subject\) => latest\.current\.book\.setLayout\(layout => at === 'in-view' \? instrumentInView\(layout, kind, subject\) : openInstrumentAt\(layout, kind, at, subject\)\)\)/, 'the presented tree is the one door an instrument opens through')
})

test('the Workbench tree mounts the agent surface from the tree conversation, and admits no kernel surface for it', () => {
  assert.match(nativeWorkbench, /conversation: tree\.layout\.mode === 'factory' \? <AgentShellCentre\/> : <FactoryChat/, 'the Factory tree conversation is the agent surface')
  assert.match(modeFrames, /factory: seedWithoutTracksPane\(seedFactoryCentre\),/, 'the Factory tree is seeded with its agent tab from the mode table, and no tracks pane')
  assert.match(nativeWorkbench, /MODE_TREE_SEEDS\[book\.current\.layout\.mode \?\? 'base'\]/, 'the Workbench seeds every mode\'s first tree from the table')
  assert.match(nativeWorkbench, /const unowned = new Set\(\['draft', 'blank', 'device', AGENT_SHELL_KIND\]\)/, 'the agent tab (and a popped-out device, seam 8) is not a kernel-owned surface')
  assert.match(engineTree, /if \(binding\.kind === "agent-shell"\) return <>\{conversation\}<\/>;/, 'the engine mounts the agent body from the tree conversation')
})

test('the native.agent centre panel no longer mounts a second agent body', () => {
  assert.doesNotMatch(agentPanel, /AgentShellCentre/, 'the agent body lives in the Workbench tree only')
})

test('Factory opens with the agent tab focused, and every agent-shell chrome piece stands over the tree', async () => {
  const {activeBindingId} = engine
  const seeded = seedFactoryCentre(freshLayout())
  assert.equal(activeBindingId(seeded), tracksTabOf(seeded), 'the Session pane is the focused default (the mockup\'s focus:0)')
  assert.equal(groupsOf(seeded.root).find(group => group.tabs.includes(AGENT_SHELL_ID)).active, AGENT_SHELL_ID, 'the agent tab is the active tab of its pane')
  // The agent dock's tiles are widgets of the one rail (F8), registered in shell/widgets.tsx.
  assert.match(await readFile(new URL('../src/shell/widgets.tsx', import.meta.url), 'utf8'), /AgentDockTileBody id=\{id\}/)
  // Factory's transport is the one bar (F7): its controls are bindings (shell/transports/useFactoryTransport.tsx).
  assert.ok(!app.includes('<AgentShellTransportBridge'), 'no Factory bar of its own')
  assert.match(await readFile(new URL('../src/shell/modeTransports.tsx', import.meta.url), 'utf8'), /factory: useFactoryTransport/)
  for (const piece of ['<AgentStatusBarBridge']) {
    assert.ok(app.includes(piece), `${piece} is still rendered by App`)
  }
  // The agent browser's rows are Factory's in the one browser (F6): registered, never a residence of their own.
  const modeBrowsers = await readFile(new URL('../src/shell/modeBrowsers.tsx', import.meta.url), 'utf8')
  assert.match(modeBrowsers, /factory: \(\) => \[AGENTS\]/); assert.match(modeBrowsers, /<AgentShellBrowser rows=/)
  assert.ok(app.includes('<Browser key={frameMode} sources={browserSources}'), 'App mounts the one browser')
  for (const piece of ['useFactoryClip()', '<AgentShellDeviceDetail']) assert.ok(modeDetails.includes(piece), `${piece} is Factory's registered detail (its clip hosted, R2)`)
  const bridge = appLines.find(l => l.includes('{agentShell ? <AgentStatusBarBridge'))
  assert.ok(bridge, 'the status bar switches on the agent shell, not on the retired centre panel')
  assert.match(app, /const agentShell = isFactoryMode\(frameMode\) && !settingsPresented/)
})

// Factory's lens bar (lead review): a press opens only an admitted pane body. Project / graph, Places, Timeline and Journey are
// the admitted bodies (T-FACTORY-TIMELINE-PANE: Timeline and Journey are the one Timeline pane's two presentations). Canvas and
// Palace stay visible but disabled, each titled with its plain reason.
const {TechneLensBar, LENSES, factoryLensReason, factoryLensPane} = await import('../src/shell/ModeDetail.tsx')
const decode = text => text.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
const factoryBar = renderToStaticMarkup(createElement(TechneLensBar, {presentation: 'session', atlasOpen: true, onLens() {}, factory: true}))
const lensButton = name => {
  const part = factoryBar.split('<button').find(piece => piece.includes(`<span>${name}</span>`))
  assert.ok(part, `${name} is on the bar`)
  return part
}
const titleOf = name => decode(/title="([^"]*)"/.exec(lensButton(name))[1])

test('in Factory the Timeline and Journey lenses are the admitted Timeline pane and stay enabled', () => {
  assert.doesNotMatch(lensButton('Timeline'), /disabled=""/)
  assert.doesNotMatch(lensButton('Journey'), /disabled=""/)
  assert.equal(titleOf('Timeline'), 'Timeline — the World cut — the Timeline')
  assert.equal(titleOf('Journey'), 'Journey — the World cut — the Journey')
  assert.equal(factoryLensPane(LENSES.find(lens => lens.id === 'timeline')), 'projection.timeline')
  assert.equal(factoryLensPane(LENSES.find(lens => lens.id === 'journey')), 'projection.timeline')
})

test('in Factory Canvas and Palace stay disabled with their planned reasons', () => {
  for (const name of ['Canvas', 'Palace']) {
    assert.match(lensButton(name), /disabled=""/, `${name} is disabled`)
    assert.match(titleOf(name), /\(planned\)/, `${name} names why it is not yet a pane`)
  }
})

test('in Factory the Project / graph and Places lenses are the admitted Earth atlas panes and stay enabled', () => {
  assert.doesNotMatch(lensButton('Project / graph'), /disabled=""/)
  assert.doesNotMatch(lensButton('Places'), /disabled=""/)
  assert.equal(factoryLensPane(LENSES.find(lens => lens.id === 'project-graph')), 'projection.constellation')
  assert.equal(factoryLensPane(LENSES.find(lens => lens.id === 'places')), 'projection.earth')
})

test('a Factory press on a disabled lens opens nothing: the tree is unchanged', () => {
  const layout = seedFactoryCentre(freshLayout())
  for (const lens of LENSES.filter(item => factoryLensReason(item) !== null)) {
    const kind = factoryLensPane(lens)
    const next = kind ? openFactoryInstrumentPane(layout, kind) : layout
    assert.equal(next, layout, `${lens.name} opens nothing in Factory`)
  }
})

test('a Factory press on an enabled lens opens its one admitted pane beside the seeded two; the Timeline lenses find theirs standing', () => {
  const layout = seedFactoryCentre(freshLayout())
  for (const lens of LENSES.filter(item => factoryLensReason(item) === null)) {
    const kind = factoryLensPane(lens)
    const next = openFactoryInstrumentPane(layout, kind)
    assert.equal(tabsOf(next).length, kind === FACTORY_TRACKS_KIND ? 2 : 3, `${lens.name} opens ${kind === FACTORY_TRACKS_KIND ? 'no new pane: the Session pane stands' : 'one pane'}`)
  }
})

test('Timeline and Journey open the one Timeline pane; the lens presentation is that pane\'s own presentation', () => {
  const timeline = LENSES.find(lens => lens.id === 'timeline')
  const journey = LENSES.find(lens => lens.id === 'journey')
  assert.equal(timeline.presentation, 'arrangement')
  assert.equal(journey.presentation, 'session')
  assert.equal(factoryLensPane(timeline), 'projection.timeline')
  assert.equal(factoryLensPane(journey), 'projection.timeline')
  const layout = seedFactoryCentre(freshLayout())
  const once = openFactoryInstrumentPane(openFactoryInstrumentPane(layout, factoryLensPane(timeline)), factoryLensPane(journey))
  assert.equal(tabsOf(once).length, 2, 'the agent tab and the one Session pane: the two lenses share it, never a second')
  assert.equal(Object.values(once.surfaces).filter(binding => binding.kind === FACTORY_TRACKS_KIND).length, 1, 'one binding of the tracks kind')
})

test('Tab moves between Session view and Arrangement view of the set, in Factory as in every mode (manual §10.2)', async () => {
  assert.match(app, /event\.preventDefault\(\); tabMainView\(\)/, 'Tab is the main area\'s, never a pane\'s')
  const mainView = await readFile(new URL('../src/shell/mainView.ts', import.meta.url), 'utf8')
  assert.match(mainView, /if \(layer === 'pane'\) showMainView\(timelinePanePresentation\(\)\)/, 'from Pane view, Tab returns to the view you left')
  // The agent tab holds the thread only (agent/AgentShellRoot.tsx), so the two views are the Session pane's alone: nothing in the
  // tab body reads the shell's centreView (see tests/factory-centre.test.mjs).
})
