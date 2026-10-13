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
const {seedFactoryCentre, hasFactoryCentre, openFactoryInstrumentPane, focusedSurfaceKind, agentTabClosable, AGENT_SHELL_ID, AGENT_SHELL_KIND} = await import('../src/agent/factoryCentre.ts')
const engine = await import('../../../../desktop/cradle/src/surface/engine.ts')
const {closeSurface, activateSurface, groupsOf} = engine
const {freshLayout} = await import('../../../../desktop/cradle/src/surface/types.ts')
const {switchWorkspaceMode} = await import('../../../../desktop/cradle/src/workspace/store.ts')

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const appLines = app.split('\n')
const nativeWorkbench = await readFile(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
const agentPanel = await readFile(new URL('../src/panels/agentShell.tsx', import.meta.url), 'utf8')
const engineTree = await readFile(new URL('../../../../desktop/cradle/src/surface/Workbench.tsx', import.meta.url), 'utf8')

test('the Factory tree seeds the agent tab once, pinned and active, as the default tab', () => {
  const seeded = seedFactoryCentre(freshLayout())
  assert.ok(hasFactoryCentre(seeded), 'the agent tab is placed')
  assert.equal(seeded.surfaces[AGENT_SHELL_ID].kind, AGENT_SHELL_KIND)
  const [group] = groupsOf(seeded.root)
  assert.equal(groupsOf(seeded.root).length, 1)
  assert.ok(group.pinned.includes(AGENT_SHELL_ID), 'the agent tab is pinned')
  assert.equal(group.active, AGENT_SHELL_ID)
  assert.deepEqual(seedFactoryCentre(seeded), seeded, 'seeding again changes nothing')
})

test('the agent tab cannot be closed: the engine refuses a pinned surface', () => {
  const seeded = seedFactoryCentre(freshLayout())
  assert.equal(closeSurface(seeded, AGENT_SHELL_ID), seeded)
  assert.equal(agentTabClosable(seeded), false)
})

test('an Earth pane opens beside the agent tab and closes on its own, the agent tab staying', () => {
  const withEarth = openFactoryInstrumentPane(seedFactoryCentre(freshLayout()), 'projection.earth')
  const tabs = groupsOf(withEarth.root).flatMap(group => group.tabs)
  assert.equal(tabs.length, 2)
  assert.ok(tabs.includes(AGENT_SHELL_ID))
  const earth = tabs.find(id => id !== AGENT_SHELL_ID)
  assert.equal(withEarth.surfaces[earth].kind, 'projection.earth')
  const closed = closeSurface(withEarth, earth)
  assert.notEqual(closed, withEarth)
  assert.deepEqual(groupsOf(closed.root).flatMap(group => group.tabs), [AGENT_SHELL_ID])
})

test('the focused Earth pane takes the Device side as the 0 instrument; the agent tab keeps its own Device side', () => {
  const withEarth = openFactoryInstrumentPane(seedFactoryCentre(freshLayout()), 'projection.earth')
  const earth = groupsOf(withEarth.root).flatMap(group => group.tabs).find(id => id !== AGENT_SHELL_ID)
  const onEarth = activateSurface(withEarth, earth)
  const earthPane = factoryFocusedPane(focusedSurfaceKind(onEarth))
  assert.equal(deviceInstrumentFor('factory', earthPane.pane, earthPane.presentation, 'graph'), 'techne:m0')
  const onAgent = activateSurface(onEarth, AGENT_SHELL_ID)
  const agentPane = factoryFocusedPane(focusedSurfaceKind(onAgent))
  assert.equal(agentPane.pane, 'native.agent')
  assert.equal(deviceInstrumentFor('factory', agentPane.pane, agentPane.presentation, 'graph'), null, 'the agent tab keeps AgentShellDeviceDetail')
})

test('a Timeline pane beside the agent tab takes the Timeline instrument, and a Graph pane the 0 instrument', () => {
  const withTimeline = activateSurface(openFactoryInstrumentPane(seedFactoryCentre(freshLayout()), 'projection.timeline'), groupsOf(openFactoryInstrumentPane(seedFactoryCentre(freshLayout()), 'projection.timeline').root).flatMap(group => group.tabs).find(id => id !== AGENT_SHELL_ID))
  const timeline = factoryFocusedPane(focusedSurfaceKind(withTimeline))
  assert.equal(deviceInstrumentFor('factory', timeline.pane, timeline.presentation, 'graph'), 'techne:m2')
  const graph = openFactoryInstrumentPane(seedFactoryCentre(freshLayout()), 'projection.constellation')
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
  assert.ok(groupsOf(back.layout.root)[0].pinned.includes(AGENT_SHELL_ID), 'the pin persists with the tree')
})

// Source pins: the centre identity, the Device-side routing and the agent body (the frame is not renderable in a test harness).
test('Factory centre is the Workbench tree: the centre is native.workbench, and the agent-shell chrome stands on Factory', () => {
  assert.match(app, /const agentShell = isFactoryMode\(frameMode\) && !settingsPresented/, 'the agent-shell chrome stands over every Factory tree')
  assert.match(app, /if \(next === 'base' \|\| next === 'techne'\) \{ setCenterPanel\('world\.ground'\); setDock\(true\); return \}\s*\n\s*setCenterPanel\('native\.workbench'\); setDock\(true\)/, 'entering Factory presents the Workbench tree')
  assert.doesNotMatch(app, /setCenterPanel\('native\.agent'\)/, 'the agent centre panel is no longer the Factory centre')
})

test('the focused Factory tab routes the Device side through the existing deviceInstrumentFor', () => {
  const focus = appLines.find(l => l.includes('const focusedInstrument = deviceInstrumentFor('))
  assert.ok(focus, 'the Device side reads the instrument through deviceInstrumentFor')
  assert.match(app, /factoryFocusedPane\(/, 'a Factory tree names its focused pane through factoryFocusedPane')
  assert.match(app, /const focusedPane = settingsPresented \? 'world\.settings' : factoryFocus \? factoryFocus\.pane : centerPanel/)
  const agentResidence = appLines.find(l => l.includes('<AgentShellDeviceDetail'))
  assert.ok(agentResidence, 'the agent Device side is in App')
  assert.match(agentResidence, /focusedInstrument !== null/, 'the agent Device side yields to a focused instrument pane')
})

test('the lens bar in Factory opens instrument panes inside the tree, never by leaving the centre', () => {
  assert.match(app, /if \(agentShell\) \{[^}]*factoryLensPane\(lens\)[^}]*openFactoryInstrumentPane\(/, 'a lens press in Factory opens only its admitted pane beside the agent tab')
})

test('the Workbench tree mounts the agent surface from the tree conversation, and admits no kernel surface for it', () => {
  assert.match(nativeWorkbench, /conversation: tree\.layout\.mode === 'factory' \? <AgentShellCentre\/> : <FactoryChat/, 'the Factory tree conversation is the agent surface')
  assert.match(nativeWorkbench, /seedFactoryCentre\(/, 'the Workbench seeds the Factory tree with its agent tab')
  assert.match(nativeWorkbench, /const unowned = new Set\(\['draft', 'blank', AGENT_SHELL_KIND\]\)/, 'the agent tab is not a kernel-owned surface')
  assert.match(engineTree, /if \(binding\.kind === "agent-shell"\) return <>\{conversation\}<\/>;/, 'the engine mounts the agent body from the tree conversation')
})

test('the native.agent centre panel no longer mounts a second agent body', () => {
  assert.doesNotMatch(agentPanel, /AgentShellCentre/, 'the agent body lives in the Workbench tree only')
})

test('Factory opens with the agent tab focused, and every agent-shell chrome piece stands over the tree', () => {
  const {activeBindingId} = engine
  assert.equal(activeBindingId(seedFactoryCentre(freshLayout())), AGENT_SHELL_ID, 'the agent tab is the focused default')
  for (const piece of ['<AgentShellTransportBridge', '<AgentStatusBarBridge', '<AgentContextDock', '<FactoryTaskLogDetail', '<AgentShellDeviceDetail', '<AgentShellBrowser']) {
    assert.ok(app.includes(piece), `${piece} is still rendered by App`)
  }
  const bridge = appLines.find(l => l.includes('{agentShell ? <AgentStatusBarBridge'))
  assert.ok(bridge, 'the status bar switches on the agent shell, not on the retired centre panel')
  assert.match(app, /const agentShell = isFactoryMode\(frameMode\) && !settingsPresented/)
})

// Factory's lens bar (lead review): a press opens only an admitted pane body. Timeline, Journey (Session), Canvas and Palace stay
// visible but disabled, each titled with its plain reason. Session never maps to the Timeline.
const {TechneLensBar, LENSES, factoryLensReason, factoryLensPane} = await import('../src/shell/ModeDetail.tsx')
const decode = text => text.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
const factoryBar = renderToStaticMarkup(createElement(TechneLensBar, {presentation: 'session', atlasOpen: true, onLens() {}, factory: true}))
const lensButton = name => {
  const part = factoryBar.split('<button').find(piece => piece.includes(`<span>${name}</span>`))
  assert.ok(part, `${name} is on the bar`)
  return part
}
const titleOf = name => decode(/title="([^"]*)"/.exec(lensButton(name))[1])

test('in Factory the Timeline and Journey lenses stay visible, disabled, and say why', () => {
  assert.match(lensButton('Timeline'), /disabled=""/)
  assert.equal(titleOf('Timeline'), "The Timeline isn't available as a pane in Factory yet — its body is held by the World view.")
  assert.match(lensButton('Journey'), /disabled=""/)
  assert.equal(titleOf('Journey'), "The Journey isn't available as a pane in Factory yet — its body is held by the World view.")
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

test('a Factory press on an enabled lens opens its one admitted pane beside the agent tab', () => {
  const layout = seedFactoryCentre(freshLayout())
  for (const lens of LENSES.filter(item => factoryLensReason(item) === null)) {
    const next = openFactoryInstrumentPane(layout, factoryLensPane(lens))
    assert.equal(groupsOf(next.root).flatMap(group => group.tabs).length, 2, `${lens.name} opens one pane`)
  }
})

test('Session (Journey) never maps to the Timeline pane, in any mode', () => {
  const journey = LENSES.find(lens => lens.id === 'journey')
  assert.equal(journey.presentation, 'session')
  assert.equal(factoryLensPane(journey), null)
  for (const lens of LENSES) assert.notEqual(factoryLensPane(lens), 'projection.timeline')
})

test('the App lens press reads the factory lens table, and the bar is told it is in Factory', () => {
  assert.match(app, /factoryLensPane\(lens\)/, 'the press opens the pane the table admits')
  assert.doesNotMatch(app, /'projection\.timeline'/, 'App maps no lens to the Timeline pane')
  assert.match(app, /factory=\{isFactoryMode\(frameMode\)\}/, 'the bar carries the Factory reading')
})
