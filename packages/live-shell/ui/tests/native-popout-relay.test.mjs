// The native Pop-out (manual §16.3): on the host, a device pops out into the host's own window, a separate page, and its binding —
// readings, standing, the keys it reads, the view's holds, its writes to the owner — is relayed there from the main window's door
// (frame/devices/deviceRelay.ts); the page draws the device's own Pop-out on it (RelayedDevice.tsx). Channels: SCRIPTED bindings in
// memory (the relay's pure halves); CODE-READING for the wiring the host's event bus carries.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'
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

const relay = await import('../src/frame/devices/deviceRelay.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

const device = {id: 'factory:tasks', family: 'software-factory', face: {id: 'tasks', title: 'Tasks', icon: 'tasks', liveSemantic: 'session'},
  rows: [{key: 'mode', label: 'Mode'}, {key: 'elapsed', label: 'Elapsed'}], values: {mode: 'once'}, enabledKey: undefined}
function ownerBinding() {
  const sent = [], held = []
  return {sent, held, binding: {
    id: 'factory:tasks', values: {mode: 'once', elapsed: 42, 'view.tab': 'log'}, standing: {retry: {disabled: 'Retry: whole harness only.'}},
    heldBy: {effort: 'the sky'}, enabledKey: 'on',
    write: async changes => { if (changes.some(c => c.key === 'mode' && c.value === 'twice')) throw new Error('Launch takes one of once, hold, loop'); sent.push(...changes) },
    writes: key => key !== 'elapsed',
    local: {'view.tab': value => held.push(value)},
  }}
}

test('the relay carries the binding as data: readings, standing, holds, the keys it reads and the view\'s', () => {
  const {binding} = ownerBinding()
  const snap = relay.relaySnapshot('device:software-factory/tasks', 'factory:tasks', device, binding)
  assert.equal(snap.bindingId, 'device:software-factory/tasks')
  assert.deepEqual(snap.binding.values, {mode: 'once', elapsed: 42, 'view.tab': 'log'})
  assert.deepEqual(snap.binding.standing, {retry: {disabled: 'Retry: whole harness only.'}})
  assert.deepEqual(snap.binding.reads, ['elapsed'], 'a key the owner does not take is carried as a reading')
  assert.deepEqual(snap.binding.local, ['view.tab'])
  assert.equal(snap.binding.writes, true)
  assert.equal(JSON.stringify(snap).includes('function'), false, 'no function crosses')
  assert.equal(relay.relaySnapshot('b', 'd', device, undefined).binding, null)
})

test('the second window\'s binding sends every act back, and the main window applies it on the owner\'s binding', async () => {
  const owner = ownerBinding()
  const snap = relay.relaySnapshot('b', 'factory:tasks', device, owner.binding)
  const acts = []
  const far = relay.relayedBinding(snap.binding, async act => { acts.push(act); await relay.applyRelayAct(owner.binding, act) })
  assert.equal(far.writes('mode'), true); assert.equal(far.writes('elapsed'), false)
  await far.write([{key: 'mode', value: 'loop'}])
  assert.deepEqual(owner.sent, [{key: 'mode', value: 'loop'}])
  await assert.rejects(far.write([{key: 'mode', value: 'twice'}]), /Launch takes one of once, hold, loop/, 'the owner\'s words come back')
  far.local['view.tab']('envelopes')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(owner.held, ['envelopes'], 'a view hold goes to the binding\'s own hand')
  await assert.rejects(relay.applyRelayAct(undefined, {kind: 'write', changes: []}), /nothing writes it/)
  await assert.rejects(relay.applyRelayAct(owner.binding, {kind: 'local', key: 'mode', value: 1}), /not the view's to hold/)
})

test('code-reading: the main window routes Pop-out to the host on the host only; the detached page draws the relayed device, else its face', async () => {
  const windows = await source('frame/devices/DeviceWindows.tsx')
  assert.match(windows, /if \(!nativeHostMain\(\) \|\| !workspaceId\) return/)
  assert.match(windows, /openDeviceWindowHere\(id\)/, 'a refusal opens it here')
  const door = await source('frame/devices/deviceDoor.ts')
  assert.match(door, /if \(popOutRoute\?\.\(id\)\) return\n  openDeviceWindowHere\(id\)/)
  const detached = await source('native/Detached.tsx')
  assert.match(detached, /<RelayedDevice bindingId=\{binding\.id\}/)
  assert.match(detached, /fallback=\{\(\) => alone \?/, 'where no relay answers, the face drawn alone, held to its own rule')
  assert.match(await source('native/detachedAdmission.ts'), /const fault = deviceRelayAdmissionFault\(binding\)/, 'the window admits a relayed device by its identity')
  assert.match(detached, /detachedAdmission\(\{/)
  const relayed = await source('frame/devices/RelayedDevice.tsx')
  assert.match(relayed, /<PlacedDevice device=\{device\} view="popout" binding=\{binding\} onClose=\{onClose\} relayed ownFull=\{relayedFullDraw\(snapshot\.full, transport \?\? NO_CARRIER\)\} \/>/, 'drawn as relayed, so its design draws, with its own Full where one is relayed')
  // Seen on r8: Ground hygiene popped out drew the generic plate (two readings), because a design loads only for a device published
  // on the window's own door, and the Pop-out is its own page. A relayed device counts as published there.
  const view = await source('frame/devices/DeviceView.tsx')
  assert.match(view, /const published = useIsPublished\(device\.id\) \|\| relayed/)
  assert.match(view, /useHosting\(device, picture, actions, wrapRow, binding, generic, false, relayed, ownFull\)/)
  const rust = await readFile(new URL('../../../../desktop/cradle/src-tauri/src/windows.rs', import.meta.url), 'utf8')
  assert.match(rust, /"device"/, 'the host admits a device binding')
})

test('a relayed device is admitted by its identity alone, declared or not; the standalone face keeps the manifests\' rule (the torus on r6, Live\'s Filter on r7)', async () => {
  const kinds = await import('../src/native/detachedKinds.ts')
  const manifests = [{id: 'quaternal-logic', faces: [{id: 'torus', dock: ['dock']}], detachedKinds: []}]
  const aperture = {day: null, flow: null, conversation: null, instrument: null}
  const torus = {family: 'quaternal-logic', face: 'torus', aperture}
  const filter = {family: 'live', face: 'filter', aperture}
  for (const identity of [torus, filter]) {
    const binding = {kind: 'device', id: kinds.deviceBindingId(identity), device: identity}
    assert.equal(kinds.deviceRelayAdmissionFault(binding), null, `${identity.family}/${identity.face} is admitted for its relay`)
  }
  assert.match(kinds.deviceIdentityFault(torus, manifests), /does not declare pop-out/, 'drawn alone, the torus is refused')
  assert.match(kinds.deviceIdentityFault(filter, manifests), /no admitted family "live"/, 'drawn alone, Live\'s Filter is refused')
  assert.match(kinds.deviceRelayAdmissionFault({kind: 'device', id: 'device:live/other', device: filter}), /does not name its family and face/)
  assert.match(kinds.deviceRelayAdmissionFault({kind: 'device', id: 'device:live/filter'}), /carries no device identity/)
})

test('a device\'s own Full crosses as data and its Pop-out draws it there: the Day\'s page, never the design\'s template (r23)', async () => {
  // r23: the Day popped out drew a blank Full — its page is the main window's own drawing (centralPublication's `full.draw`), which
  // no second window holds, so the design's template stood in, with no template root on the native host.
  const {createElement} = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const fulls = await import('../src/frame/devices/relayedFulls.ts')
  const {binding} = ownerBinding()
  const day = {project: null, sourceRef: 'central:source:control:root:Control/user/day/2026-10-19/day.md', documentId: 'day-doc'}
  const snap = relay.relaySnapshot('device:central/day-die', 'central:day-die', device, binding, {kind: 'central:day-page', data: day})
  assert.deepEqual(snap.full, {kind: 'central:day-page', data: day}, 'the Full\'s data crosses')
  assert.equal(JSON.stringify(snap).includes('function'), false, 'no function crosses')
  assert.equal(relay.relaySnapshot('b', 'd', device, binding).full, null, 'a device with no own Full carries none')
  const drawn = []
  fulls.registerRelayedFull('test:page', (data, transport) => { drawn.push([data, transport.kind]); return createElement('p', {'data-test-page': ''}, `page ${data.documentId}`) })
  const transport = {kind: 'unavailable', reason: 'test'}
  const draw = fulls.relayedFullDraw({kind: 'test:page', data: {documentId: 'd-1'}}, transport)
  assert.equal(renderToStaticMarkup(draw()), '<p data-test-page="">page d-1</p>')
  assert.deepEqual(drawn, [[{documentId: 'd-1'}, 'unavailable']])
  assert.equal(fulls.relayedFullDraw({kind: 'nobody:draws-this', data: {}}, transport), undefined, 'a kind no window registered draws nothing of its own')
  assert.equal(fulls.relayedFullDraw(null, transport), undefined)
  // Central registers the Day's page for its Pop-out where the Detached window loads it
  const detachedSource = await source('native/Detached.tsx')
  assert.match(detachedSource, /transport=\{transport\}/, 'the Pop-out hands this window\'s carrier to the device it draws')
  assert.match(detachedSource, /import '\.\.\/central\/devices\/CentralDevices'/, 'the Pop-out window loads the Central family\'s drawer')
  const central = await source('central/devices/CentralDevices.tsx')
  assert.match(central, /registerRelayedFull\(DAY_PAGE_RELAY/, 'Central registers the Day page as the Day\'s relayed Full')
})

test('a popped-out device stays relayed across its window remounting: a bye then a hello from the same binding finds it again (r24)', () => {
  // r24: the Day and Scope popped out and never reached the main window. Their window's frame re-ran its admission when the window's
  // own access arrived, remounting the device: the remount's bye made the main window forget the binding, and the fresh hello found
  // nothing to publish.
  const registry = relay.relayRegistry()
  registry.popped('device:central/day-die', 'central:day-die')
  assert.deepEqual([...registry.entries()], [['device:central/day-die', 'central:day-die']])
  registry.bye('device:central/day-die')
  assert.deepEqual([...registry.entries()], [], 'a window that left is not published to')
  assert.equal(registry.hello('device:central/day-die'), true, 'its window came back: it is relayed again')
  assert.deepEqual([...registry.entries()], [['device:central/day-die', 'central:day-die']])
  assert.equal(registry.deviceOf('device:central/day-die'), 'central:day-die', 'its acts reach the device')
  assert.equal(registry.hello('device:nobody/never'), false, 'a binding never popped out is not relayed')
  registry.refused('device:central/day-die')
  assert.equal(registry.hello('device:central/day-die'), false, 'a pop-out the host refused is forgotten')
})
