// The Earth's single-letter keys act only when the Earth's pane has focus (O-I #742, round one item 3). The ported controller
// (projections/atlas/src/app/controller.ts onKey) listens on the window and turns m, f, t, l, a, r, d, s and g into its menu, its
// lenses, Aion, the Red Book, the Dynamics lens, the sky and its graph wherever the focus stands — so with an Earth mounted, a letter
// pressed over a Flow, the browser or another mode's pane moved the Earth. The host guards them as it guards ⌘K (hostKeys.ts): a
// listener made before the controller stands a letter down when the Earth's pane does not have the keys. The port is unchanged.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const {earthLettersOnFocus, earthHasKeys, letterStandsDown, EARTH_LETTERS} = await import('../src/projections/atlas/hostKeys.ts')

// ── an element stand-in: the pane tree as the Workbench draws it (a pane group, data-focused, holding the Earth's .atlas-host) ──
class El {
  constructor(tagName, attrs = {}, parent = null, drawn = true) {
    this.tagName = tagName; this.attrs = attrs; this.parent = parent; this.drawn = drawn
  }
  getAttribute(name) { return this.attrs[name] ?? null }
  matches(selector) {
    if (selector === '[data-pane="group"]') return this.attrs['data-pane'] === 'group'
    if (selector === '.atlas-host') return (this.attrs.class ?? '').split(' ').includes('atlas-host')
    return false
  }
  closest(selector) { for (let at = this; at; at = at.parent) if (at.matches(selector)) return at; return null }
  contains(other) { for (let at = other; at; at = at?.parent) if (at === this) return true; return false }
  getClientRects() { for (let at = this; at; at = at.parent) if (!at.drawn) return {length: 0}; return {length: 1} }
}
const page = () => {
  const body = new El('BODY')
  // the main area's focus region (App.tsx: the centre residence, data-focus-region="pane", tabindex -1): a click in a pane focuses it
  const region = new El('DIV', {'data-focus-region': 'pane'}, body)
  const earthGroup = new El('SECTION', {'data-pane': 'group', 'data-focused': 'true'}, region)
  const earthTab = new El('BUTTON', {}, earthGroup)
  const host = new El('DIV', {class: 'atlas-host'}, earthGroup)
  const globe = new El('CANVAS', {}, host)
  const flowGroup = new El('SECTION', {'data-pane': 'group', 'data-focused': 'false'}, region)
  const flowLine = new El('BUTTON', {}, flowGroup)
  const browserRow = new El('BUTTON', {}, body)
  return {body, region, earthGroup, earthTab, host, globe, flowGroup, flowLine, browserRow}
}
const press = (key, target, more = {}) => ({key, target, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...more})

test('the Earth has the keys when its pane is the focused pane and drawn, and the press is on the page or inside the Earth', () => {
  const p = page()
  assert.equal(earthHasKeys(p.host, p.body), true, 'a press on the page goes to the focused pane: the Earth\'s')
  assert.equal(earthHasKeys(p.host, p.region), true, 'a click in the pane focuses the region the pane tree stands in: its press is the focused pane\'s')
  assert.equal(earthHasKeys(p.host, p.globe), true, 'a press inside the Earth is the Earth\'s')
  assert.equal(earthHasKeys(p.host, p.earthTab), true, 'a press on the Earth pane\'s own tab is the Earth pane\'s')
  assert.equal(earthHasKeys(p.host, p.browserRow), false, 'a press on a control outside the Earth is that control\'s')
  assert.equal(earthHasKeys(p.host, p.flowLine), false, 'a press inside another pane is that pane\'s')
  p.earthGroup.attrs['data-focused'] = 'false'; p.flowGroup.attrs['data-focused'] = 'true'
  assert.equal(earthHasKeys(p.host, p.body), false, 'another pane has focus: the press on the page is that pane\'s')
  assert.equal(earthHasKeys(p.host, p.region), false)
  p.earthGroup.attrs['data-focused'] = 'true'; p.earthGroup.drawn = false
  assert.equal(earthHasKeys(p.host, p.body), false, 'a concealed Earth (another mode\'s pane tree) never has the keys')
  assert.equal(earthHasKeys(null, p.body), false)
})

test('only the Earth\'s own plain letters stand down; chords, other keys and the Earth with focus pass', () => {
  assert.deepEqual([...EARTH_LETTERS].sort(), ['a', 'd', 'f', 'g', 'l', 'm', 'r', 's', 't'], 'the letters the ported controller acts on')
  const p = page()
  p.earthGroup.attrs['data-focused'] = 'false'; p.flowGroup.attrs['data-focused'] = 'true'
  for (const key of ['m', 'f', 't', 'l', 'a', 'r', 'd', 's', 'g', 'G', 'S']) assert.equal(letterStandsDown(press(key, p.body), p.host), true, `${key} stands down while the Flow has focus`)
  for (const key of ['/', 'Escape', 'ArrowLeft', 'k', 'z', ' ']) assert.equal(letterStandsDown(press(key, p.body), p.host), false, `${key} is not the Earth's letter`)
  assert.equal(letterStandsDown(press('f', p.body, {metaKey: true}), p.host), false, '⌘F is the frame\'s, never stood down here')
  assert.equal(letterStandsDown(press('s', p.body, {ctrlKey: true}), p.host), false)
  p.earthGroup.attrs['data-focused'] = 'true'; p.flowGroup.attrs['data-focused'] = 'false'
  assert.equal(letterStandsDown(press('g', p.body), p.host), false, 'G turns the Earth to its graph while its pane has focus')
})

test('through the window: the frame hears every letter; the Earth\'s controller hears its letters only while its pane has focus', () => {
  const p = page()
  const win = new EventTarget()
  const heard = {frame: [], earth: []}
  win.addEventListener('keydown', e => heard.frame.push(e.key))   // the frame's keys: mounted with the App, before any Earth
  earthLettersOnFocus((target, type, listener) => target.addEventListener(type, listener), p.host, win)
  win.addEventListener('keydown', e => heard.earth.push(e.key))   // the ported controller (controller.ts: listen(window, 'keydown', this.onKey))
  const key = (k, target) => { const e = new Event('keydown'); Object.assign(e, {key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false}); Object.defineProperty(e, 'target', {value: target}); win.dispatchEvent(e) }
  key('g', p.globe)
  p.earthGroup.attrs['data-focused'] = 'false'; p.flowGroup.attrs['data-focused'] = 'true'
  key('g', p.body); key('a', p.flowLine); key('Escape', p.body)
  assert.deepEqual(heard.frame, ['g', 'g', 'a', 'Escape'], 'the frame hears every press')
  assert.deepEqual(heard.earth, ['g', 'Escape'], 'the Earth hears its letter only while its pane has focus; other keys always reach it')
})

test('the mount guards the letters before the ported controller is made, beside the ⌘K guard; the port keeps its letter branches', async () => {
  const mount = await read('../src/projections/atlas/mount.ts')
  const guard = mount.indexOf('earthLettersOnFocus(listen'), made = mount.indexOf('new Controller(')
  assert.ok(guard > 0 && guard < made, 'the letter guard listens before the controller does')
  const controller = await read('../src/projections/atlas/src/app/controller.ts')
  for (const letter of ['m', 'f', 't', 'l', 'a', 'r', 'd']) assert.match(controller, new RegExp(`e\\.key\\.toLowerCase\\(\\) === '${letter}'`), `the ported ${letter} branch stands`)
  assert.match(controller, /\(e\.key === 's' \|\| e\.key === 'S'\)/)
  assert.match(controller, /\(e\.key === 'g' \|\| e\.key === 'G'\)/)
})
