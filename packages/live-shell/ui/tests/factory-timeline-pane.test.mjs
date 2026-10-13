import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-FACTORY-TIMELINE-PANE: the Timeline as a projection-door pane body. Production sources in memory (the mode-surface-fidelity
// loader: .ts/.tsx transpiled, CSS stubbed). The pane reads the App's published reading, renders it through the World cut's
// residence, and carries its own presentation (Timeline = m2, Journey = m3).
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

const {fixtureCorpus} = await import('../src/projections/atlas/provider/fixtureCorpus.ts')
const {projectAionReading} = await import('../src/projections/atlas/aionTimeline.ts')
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')
const {TimelineProjectionResidence} = await import('../src/projections/timelineResidence.tsx')
const host = await import('../src/projections/timelinePaneHost.ts')
const pane = await import('../src/projections/timelinePane.tsx')
const {projectionModule} = await import('../../../../desktop/cradle/src/surface/projectionModules.ts')
const {factoryFocusedPane, deviceInstrumentFor} = await import('../src/shell/paneInstrument.ts')
const {LENSES, factoryLensPane} = await import('../src/shell/ModeDetail.tsx')

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const html = element => renderToStaticMarkup(element)

const corpus = fixtureCorpus()
const aionSet = projectAionReading({history: corpus.history, providerId: 'fixture'})
const world = {
  source: {status: 'live', error: null, now: null, events: [], sets: [aionSet], eventByClipId: new Map(), admittedRuns: null,
    admittedRunsError: null, readAtUnixMs: null, readCadence: null},
  spine: createTimeSpine(),
  selectOccasion() {},
}
const journey = {openExpression() {}}
const props = {set: null, document: null, selection: {track: 0, scene: null}, select() {}, colors: [], setColor() {}, world, journey}

test('the host door holds the App reading by reference and notifies its subscribers on each publish', () => {
  host.publishTimelineReading(null)
  assert.equal(host.timelineReading(), null, 'nothing is published until the App publishes')
  host.publishTimelineReading(props)
  assert.equal(host.timelineReading(), props, 'the published reading is the App\'s own object, never a copy')
})

test('the pane presentation is the pane\'s own: Timeline (arrangement) by default, changed only by the pane door', () => {
  assert.equal(host.timelinePanePresentation(), 'arrangement')
  host.setTimelinePanePresentation('session')
  assert.equal(host.timelinePanePresentation(), 'session')
  host.setTimelinePanePresentation('arrangement')
  assert.equal(host.timelinePanePresentation(), 'arrangement')
})

test('the pane body renders the same items as the World cut residence for the same reading and window', () => {
  host.publishTimelineReading(props)
  host.setTimelinePanePresentation('session')
  const residence = html(createElement(TimelineProjectionResidence, {...props, session: undefined, arrangement: undefined,
    compactTransport: false, presented: 'session'}))
  const body = html(createElement(pane.TimelinePaneBody))
  assert.ok(residence.includes('data-projection-presentation="session"'), 'the residence presents its Session')
  assert.ok(body.includes(residence), 'the pane body contains the residence markup, byte for byte')
})

test('the pane body presents its own presentation: Journey (session, m3) or Timeline (arrangement, m2)', () => {
  host.publishTimelineReading(props)
  host.setTimelinePanePresentation('session')
  const session = html(createElement(pane.TimelinePaneBody))
  const sessionTag = session.match(/<div class="inhabitant composition-view"[^>]*data-projection-presentation="session"[^>]*>/)[0]
  assert.ok(!sessionTag.includes('hidden=""'), 'the Session stands in the Journey presentation')
  host.setTimelinePanePresentation('arrangement')
  const arrangement = html(createElement(pane.TimelinePaneBody))
  const arrangementTag = arrangement.match(/<div class="inhabitant composition-view"[^>]*data-projection-presentation="arrangement"[^>]*>/)[0]
  assert.ok(!arrangementTag.includes('hidden=""'), 'the Arrangement stands in the Timeline presentation')
  const sessionAgain = arrangement.match(/<div class="inhabitant composition-view"[^>]*data-projection-presentation="session"[^>]*>/)[0]
  assert.ok(sessionAgain.includes('hidden=""'), 'the Session is concealed while the Arrangement stands')
  host.setTimelinePanePresentation('arrangement')
})

test('before the App publishes a reading the pane body says so, rather than presenting an empty timeline', () => {
  host.publishTimelineReading(null)
  assert.match(html(createElement(pane.TimelinePaneBody)), /waiting for the shell to publish its temporal reading/)
  host.publishTimelineReading(props)
})

test('the Timeline pane kind is admitted through the projection door, once, under its own module id', () => {
  pane.registerTimelineHost()
  pane.registerTimelineHost()
  const admitted = projectionModule('projection.timeline')
  assert.equal(admitted?.id, pane.TIMELINE_MODULE_ID)
  assert.equal(admitted?.kind, 'projection.timeline')
})

test('the Device side of a focused Timeline pane reads m2 or m3 through deviceInstrumentFor, by the pane\'s presentation', () => {
  const arrangement = factoryFocusedPane('projection.timeline', 'arrangement')
  assert.equal(arrangement.pane, 'projection.timeline')
  assert.equal(deviceInstrumentFor('factory', arrangement.pane, arrangement.presentation, 'graph'), 'techne:m2')
  const session = factoryFocusedPane('projection.timeline', 'session')
  assert.equal(deviceInstrumentFor('factory', session.pane, session.presentation, 'graph'), 'techne:m3')
})

test('the Timeline and Journey lenses reach the one Timeline pane kind, and the lens presentation is what the pane presents', () => {
  for (const id of ['timeline', 'journey']) {
    const lens = LENSES.find(item => item.id === id)
    assert.equal(factoryLensPane(lens), 'projection.timeline')
  }
  assert.equal(LENSES.find(item => item.id === 'timeline').presentation, 'arrangement')
  assert.equal(LENSES.find(item => item.id === 'journey').presentation, 'session')
})

test('App publishes the World cut\'s reading through the door, and the Factory lens press changes only the pane\'s presentation', () => {
  assert.match(app, /registerTimelineHost\(\)/)
  assert.match(app, /usePublishTimelineReading\(\{set: state\.set, document: deep\.document, selection, select: choose, colors, setColor, world: worldView,/)
  const block = app.slice(app.indexOf('if (agentShell) {'), app.indexOf('if (lens.atlas)'))
  assert.match(block, /setTimelinePanePresentation\(lens\.presentation/)
  assert.doesNotMatch(block, /setTab\(/, 'a Factory press never writes the World cut\'s presentation')
  assert.match(app, /<TechneLensBar presentation=\{factoryFocus \? factoryFocus\.presentation : presented \?\? 'session'\}/, 'the lens bar reads the focused Timeline pane presentation (null when the Factory focus holds none)')
})

test('the World cut residence call is unchanged: its presentation, native sources and Journey door stay as they were', () => {
  assert.match(app, /<TimelineProjectionResidence set=\{state\.set\} document=\{deep\.document\} selection=\{selection\} select=\{choose\} colors=\{colors\} setColor=\{setColor\}/)
  assert.match(app, /presented=\{settingsPresented \|\| centreFrameUp \? null : presented\}/)
  assert.match(app, /journey=\{worldCut && frameMode === 'techne' \? \{openExpression: workspace\.requestExpression\} : undefined\}/)
})

test('in Factory, the lens bar presses no Timeline or Journey lens while the agent tab (or an Earth pane) is focused', async () => {
  const {readFile} = await import('node:fs/promises')
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /<TechneLensBar presentation=\{factoryFocus \? factoryFocus\.presentation : presented \?\? 'session'\}/, 'a Factory focus without a presentation passes null, never the session fallback')
  const pane = await import('../src/shell/paneInstrument.ts')
  assert.equal(pane.factoryFocusedPane('agent-shell').presentation, null)
  assert.equal(pane.factoryFocusedPane('projection.earth').presentation, null)
  assert.equal(pane.factoryFocusedPane('projection.timeline', 'session').presentation, 'session')
})

test('the World cut mounts one World presentation per retained view — never a residence-level duplicate', async () => {
  const {readFile} = await import('node:fs/promises')
  const residence = await readFile(new URL('../src/projections/timelineResidence.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(residence, /<WorldTimelinePresentation/, 'the residence renders no World presentation of its own')
  for (const view of ['SessionView', 'ArrangementView']) {
    const src = await readFile(new URL(`../src/components/${view}.tsx`, import.meta.url), 'utf8')
    assert.match(src, /if \(world\) return <WorldTimelinePresentation/, `${view} presents the World cut itself`)
  }
})
