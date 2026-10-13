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

const {instrumentOfPane, deviceInstrumentFor, showsLensBar} = await import('../src/shell/paneInstrument.ts')
const {TECHNE_INSTRUMENTS} = await import('../src/inhabitants/sdk/semantics.ts')
const {TechneInstrumentsDetail, InstrumentDeviceDetail, BaseDevicesDetail} = await import('../src/shell/ModeDetail.tsx')

const html = element => renderToStaticMarkup(element)
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}

test('the pane → instrument table: every centre panel the shell uses maps as derived', () => {
  const table = [
    ['projection.earth', null, 'graph', 'techne:m0'],
    ['projection.earth', null, 'earth', 'techne:m0'],
    ['world.knowledge', null, 'graph', 'knowledge-graph'],
    ['world.expressions', null, 'graph', 'techne:m1'],
    ['world.ground', 'arrangement', 'graph', 'techne:m2'],
    ['world.ground', 'session', 'graph', 'techne:m3'],
    ['world.ground', null, 'graph', null],
    ['native.arrangement', 'arrangement', 'graph', 'techne:m2'],
    ['native.session', 'session', 'graph', 'techne:m3'],
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

test('the Device-side gate: Live keeps the audio chain, Expressions keeps its native rack for its own panes', () => {
  assert.equal(deviceInstrumentFor('live', 'projection.earth', null, 'graph'), null, 'Live presents no instrument')
  assert.equal(deviceInstrumentFor('expressions', 'world.expressions', null, 'graph'), null, 'the Expressions pane keeps its native rack')
  assert.equal(deviceInstrumentFor('expressions', 'projection.earth', null, 'graph'), 'techne:m0', 'the atlas in Expressions takes its instrument')
})

test('the Device-side gate: every mode with an instrument pane presents it', () => {
  for (const mode of ['base', 'techne', 'factory', 'expressions']) {
    assert.equal(deviceInstrumentFor(mode, 'projection.earth', null, 'graph'), 'techne:m0', `${mode} · projection.earth`)
  }
  assert.equal(deviceInstrumentFor('base', 'world.ground', 'arrangement', 'graph'), 'techne:m2', 'Central · Timeline')
  assert.equal(deviceInstrumentFor('techne', 'world.ground', 'session', 'graph'), 'techne:m3', 'Technē · Journey')
  assert.equal(deviceInstrumentFor('base', 'world.knowledge', null, 'graph'), 'knowledge-graph', 'Central · knowledge graph')
})

test('no instrument pane: the mode keeps its own Device side (Central → the ground devices)', () => {
  assert.equal(deviceInstrumentFor('base', 'native.workbench', null, 'graph'), null)
  assert.equal(deviceInstrumentFor('base', 'world.settings', null, 'graph'), null)
  assert.equal(deviceInstrumentFor('factory', 'native.agent', null, 'graph'), null, 'Factory keeps the agent device side')
  assert.match(html(createElement(BaseDevicesDetail, {transport})), /data-mode-detail="base-devices"/)
})

test('the lens bar stands over an instrument pane in every mode but Live', () => {
  assert.equal(showsLensBar('base', 'world.ground'), true, 'Central')
  assert.equal(showsLensBar('techne', 'projection.earth'), true, 'Technē')
  assert.equal(showsLensBar('expressions', 'projection.earth'), true, 'Expressions')
  assert.equal(showsLensBar('factory', 'projection.earth'), true, 'Factory')
  assert.equal(showsLensBar('live', 'world.ground'), false, 'Live shows the audio cut, no instrument pane')
  assert.equal(showsLensBar('base', 'native.agent'), false)
  assert.equal(showsLensBar('base', 'world.settings'), false)
})

const expandedOf = (out, faceId) => {
  const match = out.match(new RegExp(`data-face-id="${faceId}"[^>]*data-expanded="(true|false)"`))
  assert.ok(match, `the face ${faceId} is on the rack`)
  return match[1]
}

test('the focused instrument rack: the 0 instrument expands its held faces and folds the others', () => {
  const out = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: 'techne:m0'}))
  assert.match(out, /data-focus-instrument="techne:m0"/)
  assert.equal(expandedOf(out, 'graph-tools'), 'true', 'graph-tools is held by techne:m0')
  assert.equal(expandedOf(out, 'mode-switch'), 'true', 'mode-switch is held by techne:m0')
  assert.equal(expandedOf(out, 'torus'), 'false', 'a face the instrument does not hold stays folded')
  assert.equal(expandedOf(out, 'sky'), 'false')
})

test('the focused rack for the Timeline expands the faces it holds', () => {
  const out = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: 'techne:m2'}))
  assert.equal(expandedOf(out, 'sky'), 'true')
  assert.equal(expandedOf(out, 'time-control'), 'true')
  assert.equal(expandedOf(out, 'm3-clock'), 'true', 'm3-clock is held by techne:m2 too')
  assert.equal(expandedOf(out, 'torus'), 'false')
})

test('without a focus the Technē rack stands as it did: the QL faces, all folded', () => {
  const out = html(createElement(TechneInstrumentsDetail, {transport}))
  assert.doesNotMatch(out, /data-focus-instrument/)
  assert.equal(expandedOf(out, 'sky'), 'false')
  assert.doesNotMatch(out, /data-face-id="graph-tools"/, 'the atlas faces are not in the unfocused Technē rack')
})

test('the knowledge graph Device side states its controls are not declared and never shows the 0 rack', () => {
  const out = html(createElement(InstrumentDeviceDetail, {transport, instrument: 'knowledge-graph'}))
  assert.match(out, /controls not yet declared/)
  assert.doesNotMatch(out, /data-face-id=/, 'no device face is drawn for the knowledge graph')
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
  assert.match(knowledge, /controls not yet declared/)
  assert.doesNotMatch(knowledge, /graph-tools/)
})
