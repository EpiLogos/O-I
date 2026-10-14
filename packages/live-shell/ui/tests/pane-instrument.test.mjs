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

const {instrumentOfPane, deviceInstrumentFor, HOSTED_INSTRUMENT, BAR_LENS_OF_HOSTED, hostedLensOfBarId} = await import('../src/shell/paneInstrument.ts')
const {TECHNE_INSTRUMENTS} = await import('../src/inhabitants/sdk/semantics.ts')
const {TechneInstrumentsDetail, InstrumentDeviceDetail, BaseDevicesDetail, TechneLensBar} = await import('../src/shell/ModeDetail.tsx')

const html = element => renderToStaticMarkup(element)
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}

test('the pane → instrument table: every centre panel the shell uses maps as derived', () => {
  const table = [
    ['projection.earth', null, 'graph', 'techne:m0'],
    ['projection.earth', null, 'earth', 'techne:m0'],
    ['world.knowledge', null, 'graph', 'knowledge-graph'],
    ['world.expressions', null, 'graph', null], // no hosted lens reported yet: the pane holds none until it does
    // The Session · Arrangement pane is a view of the mode's material, never Technē's Journey or Timeline (FOUNDATION F3).
    ['world.ground', 'arrangement', 'graph', null],
    ['world.ground', 'session', 'graph', null],
    ['projection.timeline', 'arrangement', 'graph', null],
    ['projection.timeline', 'session', 'graph', null],
    ['native.arrangement', 'arrangement', 'graph', null],
    ['native.session', 'session', 'graph', null],
    ['native.workbench', null, 'graph', null],
    ['native.agent', null, 'graph', null],
    ['world.settings', null, 'graph', null],
    ['no.such.panel', null, 'graph', null],
  ]
  for (const [pane, presentation, view, expected] of table) {
    assert.equal(instrumentOfPane(pane, presentation, view), expected, `${pane} / ${presentation} / ${view}`)
  }
})

test('the knowledge graph is its own instrument, never the 0 instrument', () => {
  assert.equal(instrumentOfPane('world.knowledge', null, 'graph'), 'knowledge-graph')
  assert.notEqual(instrumentOfPane('world.knowledge', null, 'graph'), 'techne:m0')
  const holders = TECHNE_INSTRUMENTS.map(holder => holder.id)
  assert.ok(!holders.includes('knowledge-graph'), 'the knowledge graph is not a Technē holder')
  for (const id of ['techne:m0', 'techne:m1', 'techne:m2', 'techne:m3']) {
    assert.ok(holders.includes(id), `${id} is a Technē holder`)
  }
})

test('the Device-side gate: Expressions keeps its native rack for its own panes; Live\'s audio chain is the detail host\'s veto, not this module\'s', async () => {
  // Live keeps its own chain whatever pane is focused: MODE_DETAILS.live.ownsDeviceSide, applied once by the one detail host
  // (pane-instrument-app.test.mjs pins the host). This module pairs panes with instruments and names no mode in a branch.
  assert.equal(deviceInstrumentFor('live', 'projection.earth', null, 'graph'), 'techne:m0', 'the pairing is mode-blind: the host, not this module, keeps Live\'s chain')
  const details = await readFile(new URL('../src/shell/modeDetails.tsx', import.meta.url), 'utf8')
  assert.match(details, /live: \{clip: LiveClip, device: LiveChain, ownsDeviceSide: true/, 'Live registers its own Device side once')
  const host = await readFile(new URL('../src/frame/detail/DetailHost.tsx', import.meta.url), 'utf8')
  assert.match(host, /side === 'device' && !registration\.ownsDeviceSide \? reading\.focusedInstrument : null/, 'the host vetoes the instrument for a mode that owns its Device side')
  const source = await readFile(new URL('../src/shell/paneInstrument.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /[!=]==\s*'(?:live|base|factory|expressions|techne)'/, 'paneInstrument.ts holds no mode comparison: a mode\'s difference is a registration')
  assert.equal(deviceInstrumentFor('expressions', 'world.expressions', null, 'graph'), null, 'the Expressions pane keeps its native rack')
  assert.equal(deviceInstrumentFor('expressions', 'projection.earth', null, 'graph'), 'techne:m0', 'the atlas in Expressions takes its instrument')
})

test('the Device-side gate: every mode with an instrument pane presents it', () => {
  for (const mode of ['base', 'techne', 'factory', 'expressions']) {
    assert.equal(deviceInstrumentFor(mode, 'projection.earth', null, 'graph'), 'techne:m0', `${mode} · projection.earth`)
  }
  assert.equal(deviceInstrumentFor('base', 'projection.timeline', 'arrangement', 'graph'), null, 'Central · the tracks pane keeps Central\'s own chain')
  assert.equal(deviceInstrumentFor('techne', 'projection.expressions', null, 'graph', 'journey'), 'techne:m3', 'Technē · the stage turned to its Journey lens')
  assert.equal(deviceInstrumentFor('base', 'world.knowledge', null, 'graph'), 'knowledge-graph', 'Central · knowledge graph')
})

test('no instrument pane: the mode keeps its own Device side (Central → the ground devices)', () => {
  assert.equal(deviceInstrumentFor('base', 'native.workbench', null, 'graph'), null)
  assert.equal(deviceInstrumentFor('base', 'world.settings', null, 'graph'), null)
  assert.equal(deviceInstrumentFor('factory', 'native.agent', null, 'graph'), null, 'Factory keeps the agent device side')
  assert.match(html(createElement(BaseDevicesDetail, {transport})), /data-mode-detail="base-devices"/)
})

const expandedOf = (out, faceId) => {
  const match = out.match(new RegExp(`data-face-id="${faceId}"[^>]*data-expanded="(true|false)"`))
  assert.ok(match, `the face ${faceId} is on the rack`)
  return match[1]
}

test('the focused instrument rack: the 0 instrument stands open with its held faces; the other instruments fold', () => {
  const out = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: 'techne:m0'}))
  assert.match(out, /data-focus-instrument="techne:m0"/)
  assert.equal(expandedOf(out, 'graph-tools'), 'true', 'graph-tools is held by techne:m0')
  assert.equal(expandedOf(out, 'mode-switch'), 'true', 'mode-switch is held by techne:m0')
  assert.doesNotMatch(out, /data-face-id="torus"|data-face-id="sky"/, 'a face the instrument does not hold is not drawn open: it is inside its own instrument\'s fold')
  assert.match(out, /data-instrument="techne:m2" data-expanded="false"/, 'the Timeline folds')
})

test('the focused rack for the Timeline expands the faces it holds', () => {
  const out = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: 'techne:m2'}))
  assert.equal(expandedOf(out, 'sky'), 'true')
  assert.equal(expandedOf(out, 'time-control'), 'true')
  assert.equal(expandedOf(out, 'm3-clock'), 'true', 'm3-clock is held by techne:m2 too')
  assert.doesNotMatch(out, /data-face-id="torus"/, 'the torus is Body · 3:3\'s, not the Timeline\'s')
  assert.match(out, /data-instrument="techne:m0" data-expanded="false"/)
})

test('without a focus the Technē rack folds its six instruments; the QL faces none holds stand after them', () => {
  const out = html(createElement(TechneInstrumentsDetail, {transport}))
  assert.doesNotMatch(out, /data-focus-instrument/)
  assert.equal(expandedOf(out, 'torus'), 'false')
  assert.equal(expandedOf(out, 'ql-instrument'), 'true')
  assert.doesNotMatch(out, /data-face-id="graph-tools"/, 'the atlas faces are not drawn while their instrument folds')
})

test('the knowledge graph Device side draws its own family rack, never the 0 rack and never the placeholder', () => {
  const out = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'knowledge-graph'}))
  assert.doesNotMatch(out, /controls not yet declared/, 'the knowledge graph’s controls are declared (T-KNOWLEDGE-GRAPH-DEVICE)')
  assert.match(out, /data-family="knowledge-graph"/)
  for (const face of ['knowledge-scope', 'knowledge-filters', 'knowledge-display']) {
    assert.match(out, new RegExp(`data-face-id="${face}"`), `${face} docks on the knowledge graph's rack`)
  }
  assert.doesNotMatch(out, /data-mode-detail="techne-instruments"/)
  assert.doesNotMatch(out, /graph-tools/)
})

test('the atlas instrument device side goes through the focused rack', () => {
  const out = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m0'}))
  assert.match(out, /data-focus-instrument="techne:m0"/)
  assert.equal(expandedOf(out, 'graph-tools'), 'true')
})

test('the 0 instrument is the Earth and solar system: the globe face docks expanded with it (lock §0.1.3)', () => {
  const out = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m0'}))
  assert.equal(expandedOf(out, 'globe-engine'), 'true', 'the globe is the 0 instrument’s Earth view')
})

test('Central keeps its own devices: they lead the chain, then the focused instrument (never removed)', () => {
  const base = html(createElement(BaseDevicesDetail, {transport}))
  const centralFaces = [...base.matchAll(/data-face-id="([^"]+)"/g)].map(match => match[1])
  assert.ok(centralFaces.length > 0, 'Central declares device faces')
  const out = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m2', centralDevices: true}))
  for (const face of centralFaces) assert.match(out, new RegExp(`data-face-id="${face}"`), `${face} stays on Central's chain`)
  assert.ok(out.indexOf(`data-face-id="${centralFaces[0]}"`) < out.indexOf('data-face-id="time-control"'), 'Central’s devices lead, the instrument follows')
  assert.equal(expandedOf(out, 'time-control'), 'true')
  const knowledge = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'knowledge-graph', centralDevices: true}))
  assert.match(knowledge, new RegExp(`data-face-id="${centralFaces[0]}"`))
  assert.match(knowledge, /data-family="knowledge-graph"/, 'the knowledge graph’s rack follows Central’s devices')
  assert.doesNotMatch(knowledge, /controls not yet declared/)
  assert.doesNotMatch(knowledge, /graph-tools/)
})

test('focused, the knowledge graph opens its own faces on the rack, named as the panel names them', () => {
  const out = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'knowledge-graph'}))
  for (const face of ['knowledge-scope', 'knowledge-filters', 'knowledge-display']) assert.equal(expandedOf(out, face), 'true', `${face} docks expanded`)
  for (const title of ['Scope', 'Filters', 'Display']) assert.match(out, new RegExp(`>${title}<`))
  assert.doesNotMatch(out, />knowledge-scope</, 'no raw face id stands as a title')
})

const HOSTED = ['project', 'canvas', 'timeline', 'journey', 'place', 'palace']
const HOLDERS = ['techne:m0', 'techne:m1', 'techne:m2', 'techne:m3', 'techne:m4', 'techne:m5']

test('the hosted lens → holder table: each of the six hosted lenses stands on its own Technē holder', () => {
  assert.deepEqual(Object.keys(HOSTED_INSTRUMENT).sort(), [...HOSTED].sort())
  assert.deepEqual(HOSTED.map(lens => HOSTED_INSTRUMENT[lens]), HOLDERS)
})

test('the Expressions pane holds the instrument of the hosted lens the frame reports', () => {
  HOSTED.forEach((lens, i) => {
    assert.equal(instrumentOfPane('world.expressions', null, 'graph', lens), HOLDERS[i], `hosted ${lens}`)
  })
  assert.equal(instrumentOfPane('world.expressions', 'session', 'graph', 'timeline'), 'techne:m2', 'the hosted lens wins over the World presentation')
})

test('the lens bar and the hosted frame speak one table: project-graph↔project and places↔place, the rest identical', () => {
  assert.equal(BAR_LENS_OF_HOSTED.project, 'project-graph')
  assert.equal(BAR_LENS_OF_HOSTED.place, 'places')
  for (const lens of ['canvas', 'timeline', 'journey', 'palace']) assert.equal(BAR_LENS_OF_HOSTED[lens], lens)
  for (const lens of HOSTED) assert.equal(hostedLensOfBarId(BAR_LENS_OF_HOSTED[lens]), lens, `round trip ${lens}`)
  assert.equal(hostedLensOfBarId('project-graph'), 'project')
  assert.equal(hostedLensOfBarId('places'), 'place')
  assert.equal(hostedLensOfBarId('graph'), null, 'the Earth atlas graph view names no hosted lens')
  assert.equal(hostedLensOfBarId('no.such.lens'), null)
})

test('the hosted Expressions pane follows the hosted lens in every mode the ruling covers (Live\'s chain is the host\'s veto)', () => {
  for (const mode of ['base', 'techne', 'factory']) {
    assert.equal(deviceInstrumentFor(mode, 'world.expressions', null, 'graph', 'timeline'), 'techne:m2', `${mode} · hosted timeline`)
  }
  assert.equal(deviceInstrumentFor('techne', 'world.expressions', null, 'graph', 'palace'), 'techne:m5', 'Technē · hosted palace')
  assert.equal(deviceInstrumentFor('live', 'world.expressions', null, 'graph', 'timeline'), 'techne:m2', 'the pairing is mode-blind; the host keeps Live\'s audio chain')
  assert.equal(deviceInstrumentFor('base', 'world.expressions', null, 'graph', null), null, 'no hosted lens reported: the mode keeps its own Device side')
})

test('Expressions mode keeps its own native rack on its own panes, whatever lens the frame reports', () => {
  assert.equal(deviceInstrumentFor('expressions', 'world.expressions', null, 'graph', 'canvas'), null, 'the hosted Canvas keeps its native rack')
  assert.equal(deviceInstrumentFor('expressions', 'world.expressions', null, 'graph', null), null)
  assert.equal(deviceInstrumentFor('expressions', 'world.expressions', null, 'graph', 'project'), null, 'the frame’s default lens never displaces Expressions’ own rack')
  assert.equal(deviceInstrumentFor('expressions', 'world.expressions', null, 'graph', 'timeline'), null, 'Expressions mode is the pane’s own instrument')
  assert.equal(deviceInstrumentFor('expressions', 'native.session', 'session', 'graph', 'timeline'), null, 'the native session pane keeps its own rack')
  assert.equal(deviceInstrumentFor('expressions', 'native.arrangement', 'arrangement', 'graph', 'timeline'), null)
})

const pressedBars = out => [...out.matchAll(/aria-pressed="true"/g)].length
const barOf = out => (out.match(/data-lens="([^"]+)"/) ?? [])[1] ?? null
const disabledCount = out => [...out.matchAll(/ disabled=""/g)].length

test('the lens bar over the hosted pane presses the hosted lens and nothing else', () => {
  for (const [lens, barId] of [['project', 'project-graph'], ['canvas', 'canvas'], ['timeline', 'timeline'], ['journey', 'journey'], ['place', 'places'], ['palace', 'palace']]) {
    const out = html(createElement(TechneLensBar, {presentation: 'arrangement', atlasOpen: false, onLens() {}, hosted: {lens}}))
    assert.equal(barOf(out), barId, `hosted ${lens} presses ${barId}`)
    assert.equal(pressedBars(out), 1, `one press for hosted ${lens}`)
    assert.match(out, /data-hosted="true"/)
  }
})

test('over the hosted pane every lens entry is reachable (each names a hosted lens), so none is disabled', () => {
  const out = html(createElement(TechneLensBar, {presentation: 'session', atlasOpen: false, onLens() {}, hosted: {lens: 'canvas'}}))
  assert.equal(disabledCount(out), 0, 'the hosted lenses all stand on this bar')
})

test('the hosted pane with no lens reported presses nothing', () => {
  const out = html(createElement(TechneLensBar, {presentation: 'session', atlasOpen: false, onLens() {}, hosted: {lens: null}}))
  assert.equal(pressedBars(out), 0)
  assert.equal(barOf(out), null)
})

test('the World cut and Earth bar is unchanged when no hosted pane is focused', () => {
  const world = html(createElement(TechneLensBar, {presentation: 'arrangement', atlasOpen: false, onLens() {}}))
  assert.equal(barOf(world), 'timeline', 'the World arrangement presses Timeline, as before')
  assert.doesNotMatch(world, /data-hosted=/)
  assert.equal(disabledCount(world), 2, 'Canvas and Palace still hold their places, waiting')
  // The atlas press (Project / graph or Places) is pinned by atlas-host.test.mjs, which sets the atlas view.
})
