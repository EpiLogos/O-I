// O-I #747 round 893 (the OPEN list, walk 892 captures-21 45): the Session's receipt "Launch Dusk · The scene plays." stayed under the grid
// while another Expression (Of Central) was open. A receipt says the last act in the set it was pressed in; once the views show another
// set (none of the Expression's own tracks it was pressed among; the Main track every set shows is no one Expression's), it no longer
// says anything about what is shown, and it clears. A set that moves on with
// the same tracks keeps it (a launch's line follows its clip, round 886).
// Channels: SCRIPTED — the receipt both views make of a press (SessionGrid.tsx pressedIn, which ArrangementRuler.tsx uses too) and the line
// both run on every change of their set (heldLaunchReceipt), over sets made by the Expressions track adapter.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

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
const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

const GRID = {...await import('../src/frame/tracks/SessionGrid.tsx'), ...await import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx')}
const {projectExpressionsWork} = await import('../src/timeline/expressionsTrackAdapter.ts')
// Each set as the presented Expression's: its own two lanes, and the one Main track every Expression's set shows (XS15) — the walk's case
// (r893 walk captures-893a 60: "Launch Noon" stood under Of Central, found only through the Main track both sets show).
const sound = {active: true, soloOn: false, level: 1, main: 1, setLevel: () => ({ok: true}), setMain: () => ({ok: true})}
const work = (id, name, scenes, status = {}) => projectExpressionsWork({expressions: [{id, name, scenes: scenes.map(([scene, duration]) => ({id: scene, name: scene, duration, ...(status[scene] ? {status: status[scene]} : {})}))}],
  controls: {sound}})
const dawnField = (status) => work('expression:dawn-field', 'Dawn field', [['Dawn', 6], ['Noon', 12], ['Dusk', 12]], status)
const ofCentral = work('expression:of-central', 'Of Central', [['Scene 1', 8]])

test('a receipt pressed in one Expression clears when the views show another; in the same Expression it stays', () => {
  assert.ok(ofCentral.tracks.some(track => track.main) && dawnField().tracks.some(track => track.main), 'both sets show the Main track')
  assert.equal(typeof GRID.pressedIn, 'function', 'the views make a press\'s receipt with the set it was pressed in')
  const before = dawnField({Dusk: 'stopped'}), dusk = before.clips.find(clip => clip.label === 'Dusk')
  const receipt = GRID.pressedIn(before, `clip:${dusk.id}`, 'Launch Dusk', {ok: true, text: 'The scene plays.'})
  assert.deepEqual([receipt.key, receipt.what, receipt.ok, receipt.text], [`clip:${dusk.id}`, 'Launch Dusk', true, 'The scene plays.'])
  assert.equal(GRID.heldLaunchReceipt(receipt, dawnField({Dusk: 'running'})), receipt, 'the same Expression read again keeps the line')
  assert.equal(GRID.heldLaunchReceipt(receipt, ofCentral), null, 'Of Central open: the line about Dusk is gone')
  const stopAll = GRID.pressedIn(before, 'stop-all', 'Stop All', {ok: true, text: 'Stopped.'})
  assert.equal(GRID.heldLaunchReceipt(stopAll, ofCentral), null, 'a set-wide act\'s line too: it was said of the other set')
  assert.equal(GRID.heldLaunchReceipt(stopAll, before), stopAll)
})

test('a held launch still follows its clip until it lands (round 886), and a receipt from no set\'s tracks is left as it was', () => {
  const waiting = dawnField({Dusk: 'waiting'}), dusk = waiting.clips.find(clip => clip.label === 'Dusk')
  const held = GRID.pressedIn(waiting, `clip:${dusk.id}`, 'Launch Dusk', {ok: true, text: 'Launched: it lands at 4.00 s.', waits: true})
  const seen = GRID.heldLaunchReceipt(held, waiting)
  assert.equal(seen.seen, true)
  const landed = GRID.heldLaunchReceipt(seen, dawnField({Dusk: 'running'}))
  assert.match(landed.text, /Landed on its Quantize: Dusk plays\./)
  assert.equal(GRID.heldLaunchReceipt(landed, ofCentral), null, 'the landed line is Dawn field\'s too')
  assert.equal(GRID.heldLaunchReceipt(seen, ofCentral), null)
  const bare = {key: 'seat', what: 'Seat', ok: true, text: 'Seated.'}
  assert.equal(GRID.heldLaunchReceipt(bare, ofCentral), bare)
})
