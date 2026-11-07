// O-I #747 round 890, XS01's proof ("It opens in Pane view, the field and the Studio side by side, with the sky and the Trail on the rail,
// and the agent composing in it when there is one"; manual §20: "the agent composing in it, the sky and the Trail stand on the rail"; the
// Sky device: "The Sky widget is on the rail in every mode. Tap the widget to return the date to now"). The proof found the rail's Sky
// tile drawing only "the sky's dated state — the QL family's sky owner — declared, waiting; the tile holds its place" (shell/
// ModeContextDock.tsx TileBody): the sky stood on the rail as a name. Now the rail's Sky is the QL Sky device's widget (quaternal-logic__sky
// .tsx `widget`: the ring you tap to return to now, each body with its degree), published from the rail while its tile is open and no
// chain (Technē's) holds the device. The Trail and the agent are proved by rail-tiles-per-mode and widget-rail-craft.
// SCRIPTED: the production registrations and the device door through the transpiling loader; the Sky's widget view drawn to static markup
// on a fixture sky as the kernel's transit answers it.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s.startsWith('@epilogos/expressions-boundary')) return {url: 'data:text/javascript,export {}', shortCircuit: true}
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
  if (u.includes('?raw') || u.includes('.html') || u.endsWith('.svg') || u.endsWith('.png') || u.endsWith('.md')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const ids = await import('../src/widgets/railDeviceIds.ts')
const {WIDGETS, defaultWidgets} = await import('../src/shell/widgets.tsx')
const {claimedWidget} = await import('../src/frame/widgets/deviceWidgets.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const {QL_SKY_DEVICE_ID} = await import('../src/inhabitants/ql/devices/qlSky.ts')
const railSky = await import('../src/widgets/railSky.tsx').catch(error => ({missing: error.message}))

test('XS01: Expressions opens with the agent, the sky and the Trail on the rail, and the rail\'s Sky is the QL Sky device\'s widget', () => {
  assert.deepEqual([...defaultWidgets('expressions')], ['agent', 'sky', 'trail'])
  assert.equal(ids.RAIL_SKY_DEVICE_ID, QL_SKY_DEVICE_ID, 'the claim names the Sky device the door holds (named here so the first frame loads no sky)')
  const sky = claimedWidget(WIDGETS.find(widget => widget.id === 'sky'))
  assert.equal(sky.bare, true, 'the tile is the device\'s own (its Tile: light, name, ⤢), not a second head over a waiting note')
  assert.notEqual(sky.Body, WIDGETS.find(widget => widget.id === 'sky').Body, 'the device\'s widget draws, not the mode dock\'s "declared, waiting" frame')
})

test('XS01: the rail publishes the Sky only while no chain holds it, and withdraws only its own', () => {
  assert.equal(railSky.missing, undefined, 'widgets/railSky.tsx publishes the Sky from the rail')
  const entry = name => ({device: {id: QL_SKY_DEVICE_ID, family: 'quaternal-logic', rows: [], values: {}, face: {id: 'sky', title: name}}, binding: {values: {}}})
  door.publishDevice(QL_SKY_DEVICE_ID, null)
  const a = entry('rail'), mine = railSky.publishRailSky(a, null)
  assert.equal(door.publishedDevice(QL_SKY_DEVICE_ID), a, 'nothing held it: the rail\'s Sky stands')
  assert.equal(mine, a.device)
  const b = entry('rail again'), next = railSky.publishRailSky(b, mine)
  assert.equal(door.publishedDevice(QL_SKY_DEVICE_ID), b, 'the rail\'s own Sky is published again as its sky is read again')
  const techne = entry('Technē')
  door.publishDevice(QL_SKY_DEVICE_ID, techne)
  assert.equal(railSky.publishRailSky(entry('rail, later'), next), null, 'Technē\'s chain holds the Sky with its rack and presences')
  assert.equal(door.publishedDevice(QL_SKY_DEVICE_ID), techne)
  railSky.withdrawRailSky(next)
  assert.equal(door.publishedDevice(QL_SKY_DEVICE_ID), techne, 'the rail never withdraws another chain\'s Sky')
  door.publishDevice(QL_SKY_DEVICE_ID, null)
  const back = entry('rail, after Technē'), after = railSky.publishRailSky(back, null)
  assert.equal(door.publishedDevice(QL_SKY_DEVICE_ID), back, 'when Technē lets it go, the rail\'s Sky stands again')
  railSky.withdrawRailSky(after)
  assert.equal(door.publishedDevice(QL_SKY_DEVICE_ID), undefined)
})

test('XS01: the rail reads the sky only while its Sky tile is open (no read for a tile no one shows)', async () => {
  door.publishRail({open: ['agent', 'sky', 'trail'], toggle: noop})
  assert.equal(door.railHolds('sky'), true)
  door.publishRail({open: ['agent', 'trail'], toggle: noop})
  assert.equal(door.railHolds('sky'), false)
  door.publishRail(null)
  assert.equal(door.railHolds('sky'), false)
  const rail = await source('widgets/railDevices.tsx')
  assert.match(rail, /const sky = useRailHolds\('sky'\)/)
  assert.match(rail, /\{sky && <RailSky \/>\}/)
})

test('XS01: the rail\'s Sky draws the device\'s widget view: the ring to tap back to now, and each body with its degree', async () => {
  const {renderToStaticMarkup} = await import('react-dom/server')
  const {createElement} = await import('react')
  const {design} = await import('../src/inhabitants/catalogue/panels/quaternal-logic__sky.tsx')
  assert.equal(design.id, QL_SKY_DEVICE_ID)
  assert.equal(typeof design.widget, 'function', 'the Sky design has a widget view for the rail')
  const markup = renderToStaticMarkup(createElement('div', null, design.widget({v: design.defaults, set: noop, nav: {full: noop, fold: noop, select: noop}, standing: {}})))
  assert.match(markup, /Sky/)
  assert.match(markup, /°/, 'each body with its degree')
})
