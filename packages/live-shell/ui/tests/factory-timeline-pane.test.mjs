import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-FACTORY-TIMELINE-PANE, as F3 re-founded it: the Session · Arrangement pane as a projection-door pane body. Production
// sources in memory (the mode-surface-fidelity loader: .ts/.tsx transpiled, CSS stubbed). The pane reads the App's published
// reading and draws the mode's tracks through the one grid and ruler, with its own presentation.
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
const host = await import('../src/projections/timelinePaneHost.ts')
const pane = await import('../src/projections/timelinePane.tsx')
const {projectionModule} = await import('../../../../desktop/cradle/src/surface/projectionModules.ts')
const {factoryFocusedPane, deviceInstrumentFor} = await import('../src/shell/paneInstrument.ts')

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

test('the pane presentation is Session by default, as every mode frame opens, and moves only through the pane door', () => {
  assert.equal(host.timelinePanePresentation(), 'session')
  host.setTimelinePanePresentation('session')
  assert.equal(host.timelinePanePresentation(), 'session')
  host.setTimelinePanePresentation('arrangement')
  assert.equal(host.timelinePanePresentation(), 'arrangement')
})

// F3: the pane body is the one Session grid and Arrangement ruler over the mode's tracks (frame/tracks/TracksPane.tsx); the
// World cut residence it once wrapped is gone from the App. Technē stands on the World cut's sets until its own adapter.
const published = {...props, mode: 'techne'}

test('the pane body draws the mode\'s tracks through the shared grid, from the published reading', () => {
  host.publishTimelineReading(published)
  host.setTimelinePanePresentation('session')
  const body = html(createElement(pane.TimelinePaneBody))
  assert.match(body, /data-tracks-mode="techne"/); assert.match(body, /data-tracks-view="session"/)
  assert.equal(pane.TimelinePaneBody.name, 'TracksPane', 'the body is the one tracks pane')
})

test('the pane body presents its own presentation: Session as the grid, Arrangement as the ruler, the same tracks', () => {
  host.publishTimelineReading(published)
  host.setTimelinePanePresentation('session')
  assert.match(html(createElement(pane.TimelinePaneBody)), /data-tracks-view="session"/)
  host.setTimelinePanePresentation('arrangement')
  assert.match(html(createElement(pane.TimelinePaneBody)), /data-tracks-view="arrangement"/)
})

test('before the App publishes a reading the pane body says so, rather than presenting empty tracks', () => {
  host.publishTimelineReading(null)
  assert.match(html(createElement(pane.TimelinePaneBody)), /waiting for the shell to publish this work&#x27;s reading/)
  host.publishTimelineReading(props)
})

test('the Timeline pane kind is admitted through the projection door, once, under its own module id', () => {
  pane.registerTimelineHost()
  pane.registerTimelineHost()
  const admitted = projectionModule('projection.timeline')
  assert.equal(admitted?.id, pane.TIMELINE_MODULE_ID)
  assert.equal(admitted?.kind, 'projection.timeline')
})

test('a focused tracks pane holds no instrument of its own: its Device side is the selected track\'s chain (F3, F4)', () => {
  for (const presentation of ['arrangement', 'session']) {
    const focus = factoryFocusedPane('projection.timeline', presentation)
    assert.equal(focus.pane, 'projection.timeline')
    assert.equal(deviceInstrumentFor('factory', focus.pane, focus.presentation, 'graph'), null)
  }
})

// Retired with the Technē lens bar (#762: ModeDetail's TechneLensBar, LENSES and factoryLensPane were reached only by tests): 'the Timeline
// and Journey lenses reach the one Timeline pane kind, and the lens presentation is what the pane presents' → factory-instrument-panes.test.mjs
// 'the Timeline and the Journey are the one Timeline pane: opened twice, it stands once' and, above, 'a focused tracks pane holds no
// instrument of its own' (the pane presents arrangement and session itself).

test('App publishes the frame\'s reading through the door, with the mode it stands in; the lens bar and the World cut residence are gone (F2, F3)', () => {
  assert.match(app, /registerTimelineHost\(\)/)
  assert.match(app, /usePublishTimelineReading\(\{set: state\.set, document: deep\.document, selection, select: choose, colors, setColor, mode: frameMode,/)
  assert.doesNotMatch(app, /<TechneLensBar/, 'the lens bar is removed: instruments open as panes')
  assert.doesNotMatch(app, /<TimelineProjectionResidence/, 'Session and Arrangement are the tracks pane, unbound from Journey and Timeline')
})

test('a focus without a presentation names none: the agent tab and an Earth pane carry null, the tracks pane its own', async () => {
  const pane = await import('../src/shell/paneInstrument.ts')
  assert.equal(pane.factoryFocusedPane('agent-shell').presentation, null)
  assert.equal(pane.factoryFocusedPane('projection.earth').presentation, null)
  assert.equal(pane.factoryFocusedPane('projection.timeline', 'session').presentation, 'session')
})

// FOUNDATION §7 (15 Oct): the World cut's residence and the views it retained were drawn by nothing once the tracks pane became
// the centre; they are deleted, and the pane body above is the one Session and Arrangement.
test('the World cut residence, its Session and Arrangement views and the World presentation are deleted: the tracks pane is the one Session and Arrangement', async () => {
  const {existsSync} = await import('node:fs')
  for (const name of ['projections/timelineResidence.tsx', 'projections/timelinePresentation.ts', 'components/SessionView.tsx',
    'components/ArrangementView.tsx', 'projections/worldTimelinePresentation.tsx', 'timeline/JourneyRows.tsx']) {
    assert.ok(!existsSync(new URL(`../src/${name}`, import.meta.url)), `${name} is deleted`)
  }
  assert.equal(pane.TimelinePaneBody.name, 'TracksPane')
})
