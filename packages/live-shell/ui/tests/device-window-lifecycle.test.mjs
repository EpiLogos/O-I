// A popped-out device's window lifecycle (seam 8, review findings 5 and 6): a device names no pane group, so it never keeps
// the focused pane alive; a stale entry (its window is gone) is dropped on either window-door answer, and a pop-out of a
// device whose window is gone pops out afresh instead of showing it popped out forever.
// Behavioural where the helpers are pure; the Workbench wiring is read from source (the Tauri window door is not runnable here).
// Run: node --experimental-strip-types --test tests/device-window-lifecycle.test.mjs  (see the loader below)
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

const {placeDeviceDetached, dropDeviceDetached, deviceWindowGone, popOutDeviceWindow, deviceBindingId} = await import('../src/native/detachedKinds.ts')
const {closeSurface, closeEmptyPane} = await import('../../../../desktop/cradle/src/surface/engine.ts')

const identity = {family: 'probe', face: 'face', aperture: {day: null, flow: null, conversation: null, instrument: null}}
const DEVICE = deviceBindingId(identity)
const binding = {id: DEVICE, kind: 'device', title: 'probe · face', ref: DEVICE, device: identity}
const tab = {id: 'tab1', kind: 'system', title: 'System tab'}

test('finding 5: a popped device names no pane group, so closing the last tab leaves no empty pane', () => {
  const layout = {root: {type: 'group', id: 'g1', tabs: ['tab1'], pinned: [], active: 'tab1'}, surfaces: {tab1: tab}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel'}
  const popped = placeDeviceDetached(layout, binding)
  assert.deepEqual(popped.detached, [{surfaceId: DEVICE, groupId: '', index: 0, pinned: false}], 'the entry names no group')
  const closed = closeSurface(popped, 'tab1')
  const dismissed = closeEmptyPane(closed, 'g1')
  assert.equal(dismissed.root, null, 'the empty pane is gone: nothing is left undismissable')
  assert.deepEqual(dismissed.detached.map(entry => entry.surfaceId), [DEVICE], 'the device stays popped out')
})

test('finding 5: the device still returns to its rack cleanly after its pane is gone', () => {
  const layout = {root: {type: 'group', id: 'g1', tabs: ['tab1'], pinned: [], active: 'tab1'}, surfaces: {tab1: tab}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel'}
  const redocked = dropDeviceDetached(closeEmptyPane(closeSurface(placeDeviceDetached(layout, binding), 'tab1'), 'g1'), DEVICE)
  assert.equal(redocked.root, null)
  assert.equal(redocked.surfaces[DEVICE], undefined)
  assert.deepEqual(redocked.detached, [])
})

test('finding 6: both window-door answers that a device window is gone are stale, and no other failure is', () => {
  assert.equal(deviceWindowGone('This workspace has no matching detached Surface'), true)
  assert.equal(deviceWindowGone('The detached Surface window is no longer available'), true)
  assert.equal(deviceWindowGone(new Error('The detached Surface window is no longer available')), true, 'an Error carrying the message counts')
  assert.equal(deviceWindowGone('The workspace window cannot re-dock itself'), false, 'a fault is never a stale entry')
  assert.equal(deviceWindowGone('Window state unavailable'), false)
})

const recordingDoor = ({focus}) => {
  const calls = []
  return {
    calls,
    door: {
      focusExisting: async () => { calls.push('focus'); if (focus instanceof Error) throw focus; return focus },
      dropStale: () => { calls.push('drop') },
      detach: async () => { calls.push('detach') },
    },
  }
}

test('finding 6: a pop-out of a device whose window is open focuses that window and does not pop out twice', async () => {
  const {calls, door} = recordingDoor({focus: true})
  assert.equal(await popOutDeviceWindow(true, door), 'focused')
  assert.deepEqual(calls, ['focus'], 'no drop, no second window')
})

test('finding 6: a pop-out whose entry names a window that is gone drops the entry, then pops out afresh', async () => {
  const {calls, door} = recordingDoor({focus: false})
  assert.equal(await popOutDeviceWindow(true, door), 'popped-out')
  assert.deepEqual(calls, ['focus', 'drop', 'detach'], 'the stale entry is dropped before the device pops out again')
})

test('finding 6: a pop-out with no entry simply pops out and never asks for focus', async () => {
  const {calls, door} = recordingDoor({focus: true})
  assert.equal(await popOutDeviceWindow(false, door), 'popped-out')
  assert.deepEqual(calls, ['detach'])
})

test('finding 6: a focus fault is not swallowed as a stale entry; it reaches the caller', async () => {
  const {calls, door} = recordingDoor({focus: new Error('Window state unavailable')})
  await assert.rejects(popOutDeviceWindow(true, door), /Window state unavailable/)
  assert.deepEqual(calls, ['focus'], 'nothing is dropped or detached on a fault')
})

test('finding 6: after a stale drop the device pops out with exactly one fresh entry, and the pane is not re-kept', () => {
  const layout = {root: null, surfaces: {[DEVICE]: binding}, detached: [{surfaceId: DEVICE, groupId: '', index: 0, pinned: false}], closedStack: [], focusedGroupId: null, agencyDepth: 'panel'}
  const fresh = placeDeviceDetached(dropDeviceDetached(layout, DEVICE), binding)
  assert.equal(fresh.detached.length, 1)
  assert.equal(fresh.detached[0].groupId, '')
})

test('the Workbench wires the device doors through the shared decisions, not its own string checks', async () => {
  const workbench = await readFile(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
  const popOut = workbench.slice(workbench.indexOf('const popOutDevice'), workbench.indexOf('const redockDevice'))
  assert.match(popOut, /popOutDeviceWindow\(/)
  assert.match(popOut, /window_focus_subject/)
  assert.match(popOut, /dropDetached\(workspaceId, id\)/)
  assert.doesNotMatch(popOut, /layout\.focusedGroupId/, 'a device never takes the focused pane group')
  assert.doesNotMatch(popOut, /\.some\(entry => entry\.surfaceId === id\)\) return/, 'a popped device is not an early return')
  const redock = workbench.slice(workbench.indexOf('const redockDevice'), workbench.indexOf('// The device door the racks read'))
  assert.match(redock, /deviceWindowGone\(cause\)/)
  assert.doesNotMatch(redock, /includes\('no matching detached Surface'\)/)
})
