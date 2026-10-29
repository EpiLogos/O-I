// The device rack and the widget rail fold and open on their own (O-I #744; manual §10.1 "Showing, hiding and sizing": "The browser, the
// rail and the detail area work alike … Hide one and the main area takes its room. Show it again and it comes back at the size you left
// it"; §16.4: Device view ⌥⌘4 or ▲ beside Device, the rail ⌥⌘8 or its toggle at the top right). Each part's fold is its own state in the
// frame, and each comes back across a relaunch through the frame's one kept view (the application view), never a second store. The
// rail's `dock` and the detail area's `detail` were kept already; the side of the detail area you hid (Device view, or Clip view) is
// kept by `hiddenSide` (frame/detail/detailSides.ts hiddenSideOf, restoredSides).
// Channels: SCRIPTED (the pure helpers through the transpiling loader) and code-reading (App.tsx's view keys and its checkpoint).
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
  if (r) { if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}; return r }
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

const sides = await import('../src/frame/detail/detailSides.ts')
const areas = await import('../src/shell/workspaceAreas.ts')
const key = (code, k) => ({key: k, code, metaKey: true, altKey: true, ctrlKey: false, shiftKey: false})

test('the manual\'s keys reach each part alone: ⌥⌘4 Device view, ⌥⌘3 Clip view, ⌥⌘L the detail area, ⌥⌘8 the rail', () => {
  assert.equal(areas.frameToggleOf(key('Digit4', '4')), 'device')
  assert.equal(areas.frameToggleOf(key('Digit3', '3')), 'clip')
  assert.equal(areas.frameToggleOf(key('KeyL', '¬')), 'detail')
  assert.equal(areas.frameToggleOf(key('Digit8', '8')), 'rail')
})

test('the side you hid is what the frame keeps: the front side always shows, so at most the other one is hidden', () => {
  assert.equal(sides.hiddenSideOf({front: 'clip', hidden: {clip: false, device: true}}), 'device', 'Device view folded under Clip view')
  assert.equal(sides.hiddenSideOf({front: 'device', hidden: {clip: true, device: false}}), 'clip')
  assert.equal(sides.hiddenSideOf({front: 'device', hidden: {clip: false, device: false}}), undefined, 'both kept: nothing hidden')
  // Folding Device view and bringing it back round-trips through the kept field.
  const folded = sides.toggleSide({front: 'device', hidden: {clip: false, device: false}}, 'device', {clip: true, device: true})
  assert.deepEqual(folded, {front: 'clip', hidden: {clip: false, device: true}})
  const kept = sides.hiddenSideOf(folded)
  assert.deepEqual(sides.restoredSides(folded.front, kept), folded.hidden, 'restored as it was left')
  assert.deepEqual(sides.restoredSides('device', 'device'), {clip: false, device: false}, 'a kept view that names its front hides nothing')
  assert.deepEqual(sides.restoredSides('clip', undefined), {clip: false, device: false}, 'an older view, without the field, hides nothing')
})

test('code-reading: the rail and the rack are toggled apart, and each part\'s fold rides the frame\'s one kept view', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const chord = app.slice(app.indexOf('chord.current = part => {'), app.indexOf("if (part === 'pane')"))
  assert.match(chord, /if \(part === 'rail'\) setDock\(current => !current\)/, 'the rail\'s key moves the rail alone')
  assert.doesNotMatch(chord.split("if (part === 'rail')")[1].split('\n')[0], /setDetail|setHiddenSides/, 'it never folds the rack')
  assert.match(app, /checkpointApplicationView\(\{[^}]*\bdetail:[^}]*\bdock,/s, 'the detail area and the rail are kept apart in the frame\'s view')
})
