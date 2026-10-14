import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

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

// Seams 7 and 8 (UX-SPINE-ALIGNMENT §5): the device pop-out identity, card and rack door, the receiving body's refusal
// and draw, and the Techne transport's Occasion on the World spine. Rendered under SSR (the central-devices-rack
// pattern) with the production components; the spine is the production createTimeSpine. Channel: scripted only.

const {InhabitantCard} = await import('../src/inhabitants/inhabitantCard.tsx')
const {InhabitantRack, DeviceFace} = await import('../src/inhabitants/inhabitantRack.tsx')
const {DETACHED_KINDS} = await import('../src/inhabitants/manifest.ts')
const {deviceBindingId, deviceIdentityFault} = await import('../src/native/detachedKinds.ts')
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')
const {ModeTransportBar, stepOccasion} = await import('../src/shell/ModeTransportBar.tsx')

const html = (element) => renderToStaticMarkup(element)
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const light = {state: 'admitted', title: 'admitted'}

// A synthetic admitted family: one pop-out face. `kinds` is what the family declares as its detached kinds.
const probeFace = {id: 'probe-face', presentations: ['compact', 'expanded'], dock: ['dock', 'expand', 'pop-out'], note: 'probe'}
const probeFamily = (kinds) => ({id: 'probe', faces: [probeFace], detachedKinds: kinds, telemetry: null})
const identityFor = (family) => ({family: family.id, face: 'probe-face', aperture: {day: null, flow: null, conversation: null, instrument: null}})
const buttonTag = (markup, action) => markup.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))[0]

test('the device kind is one the pane engine admits, beside the existing detached kinds', () => {
  assert.ok(DETACHED_KINDS.includes('device'))
  for (const kind of ['source', 'knowledge', 'file', 'encounter', 'browser', 'terminal', 'flow']) assert.ok(DETACHED_KINDS.includes(kind), kind)
})

test('a device identity stands only where its manifest declares the face, pop-out and the device kind', () => {
  const declared = probeFamily(['device'])
  assert.equal(deviceIdentityFault(identityFor(declared), [declared]), null)
  const undeclared = probeFamily(['flow'])
  assert.match(deviceIdentityFault(identityFor(undeclared), [undeclared]), /device detached kind/)
  assert.match(deviceIdentityFault(identityFor(declared), []), /no admitted family/)
  const noPopOut = {...declared, faces: [{...probeFace, dock: ['dock']}]}
  assert.match(deviceIdentityFault(identityFor(noPopOut), [noPopOut]), /does not declare pop-out/)
  assert.match(deviceIdentityFault({...identityFor(declared), face: 'missing'}, [declared]), /declares no face/)
})

test('one device, one binding: the binding id is the family and face, never the aperture', () => {
  const a = identityFor(probeFamily(['device']))
  const b = {...a, aperture: {...a.aperture, instrument: 'techne:m0'}}
  assert.equal(deviceBindingId(a), 'device:probe/probe-face')
  assert.equal(deviceBindingId(b), deviceBindingId(a))
})

test('the card pop-out is honest: disabled without a host door, live with it, and popped out it offers redock only', () => {
  const idle = html(createElement(InhabitantCard, {faceId: 'probe-face', kind: 'parameter', light, title: 'Probe', popOut: true, onPopOut: null}))
  assert.match(buttonTag(idle, 'pop-out'), /disabled/)
  const live = html(createElement(InhabitantCard, {faceId: 'probe-face', kind: 'parameter', light, title: 'Probe', popOut: true, onPopOut: () => {}}))
  assert.doesNotMatch(buttonTag(live, 'pop-out'), /disabled/)
  const popped = html(createElement(InhabitantCard, {faceId: 'probe-face', kind: 'parameter', light, title: 'Probe', popOut: true, poppedOut: true, onRedock: () => {}}))
  assert.doesNotMatch(popped, /data-action="pop-out"/)
  assert.match(popped, /popped out/)
  assert.match(popped, /is-popped-out/)
  assert.doesNotMatch(buttonTag(popped, 'redock'), /disabled/)
})

test('the rack offers pop-out only where the family declares the device kind and a host door stands', () => {
  const declared = probeFamily(['device'])
  const undeclared = probeFamily(['flow'])
  const host = (popped = false) => ({popOut() {}, redock() {}, poppedOut: () => popped})
  assert.match(buttonTag(html(createElement(InhabitantRack, {manifests: [declared], transport})), 'pop-out'), /disabled/)
  assert.doesNotMatch(buttonTag(html(createElement(InhabitantRack, {manifests: [declared], transport, deviceWindows: host()})), 'pop-out'), /disabled/)
  assert.match(buttonTag(html(createElement(InhabitantRack, {manifests: [undeclared], transport, deviceWindows: host()})), 'pop-out'), /disabled/)
  const poppedMarkup = html(createElement(InhabitantRack, {manifests: [declared], transport, deviceWindows: host(true)}))
  assert.match(poppedMarkup, /popped out/)
  assert.match(buttonTag(poppedMarkup, 'redock'), /Redock probe-face/)
  assert.doesNotMatch(poppedMarkup, /data-action="pop-out"/)
  assert.match(poppedMarkup, /data-device-binding="device:probe\/probe-face"/)
})

test('the receiving body draws the declared device from its manifest, and refuses a face no manifest declares', () => {
  const declared = probeFamily(['device'])
  const refused = html(createElement(DeviceFace, {identity: identityFor(declared), manifests: [probeFamily(['flow'])], transport}))
  assert.match(refused, /data-device-fault/)
  assert.match(refused, /device detached kind/)
  assert.doesNotMatch(refused, /data-device-window/)
  const drawn = html(createElement(DeviceFace, {identity: identityFor(declared), manifests: [declared], transport}))
  assert.match(drawn, /data-device-window/)
  assert.match(drawn, /data-device-face="probe-face"/)
})

test('the Occasion steps through the spine\'s retained occasions and keeps each saved basis and admission', () => {
  const spine = createTimeSpine()
  const event = (ref, instant) => ({subject_ref: ref, instant_unix_ms: instant, summary: `event ${ref}`, day_ref: null, evidence_refs: [`e:${ref}`]})
  spine.selectOccasion(event('occ:a', Date.UTC(1913, 0, 1)), 1000)
  spine.selectOccasion(event('occ:b', Date.UTC(1950, 0, 1)), 2000)
  spine.qualifyOccasions([event('occ:a', 0)], 3000, 'present in the reading')
  spine.selectOccasion(event('occ:a', 0), 9999)
  const first = stepOccasion(spine)
  assert.equal(first.basis.ref, 'occ:b')
  assert.equal(first.basis.retainedAtUnixMs, 2000)
  const wrapped = stepOccasion(spine)
  assert.equal(wrapped.basis.ref, 'occ:a')
  assert.equal(wrapped.basis.retainedAtUnixMs, 1000, 'a reopened occasion keeps the basis as first read')
  assert.equal(wrapped.basis.instantUnixMs, Date.UTC(1913, 0, 1))
  assert.equal(wrapped.admission.admitted, true, 'admission is the separate qualification and survives the reopen')
  assert.equal(stepOccasion(createTimeSpine()), null, 'no retained occasion, no step')
})

test('the Techne transport steps the Occasion on the World spine, and waits honestly without one', () => {
  const spine = createTimeSpine()
  spine.selectOccasion({subject_ref: 'occ:a', instant_unix_ms: Date.UTC(1913, 0, 1), summary: 'the 1913 descent'}, 1000)
  const drawn = html(createElement(ModeTransportBar, {mode: 'techne', timeSpine: spine}))
  const step = drawn.match(/<button[^>]*data-occasion-step[^>]*>/)[0]
  assert.doesNotMatch(step, /disabled/)
  assert.match(drawn, /the 1913 descent/)
  assert.ok(drawn.includes('data-i="Occasion window|a saved occasion keeps its snapshot and separately qualifies its admission"'), 'the grammar\'s own meaning')
  const waiting = html(createElement(ModeTransportBar, {mode: 'techne'}))
  assert.doesNotMatch(waiting, /data-occasion-step/)
  assert.ok(waiting.includes('data-i="Occasion window|a saved occasion keeps its snapshot and separately qualifies its admission"'))
})

// Seam 7, host side (UX-SPINE-ALIGNMENT §5 row 7): Back to Now, the two-way Occasion stepper, the loop brace read, the
// Instrument writes slot, and the one spine the App hands to the transport. Channel: scripted only.

const occasionEvent = (ref, instant) => ({subject_ref: ref, instant_unix_ms: instant, summary: `event ${ref}`, day_ref: null, evidence_refs: [`e:${ref}`]})
// Every <button> opening tag in a markup string, and the enabled ones (no bare `disabled`; `aria-disabled` is not that).
const buttonTags = (markup) => markup.split('<button').slice(1).map(rest => '<button' + rest.split('>')[0] + '>')
const enabledButtons = (markup) => buttonTags(markup).filter(tag => !/\sdisabled[=\s>]/.test(tag))
const buttonWith = (markup, fragment) => buttonTags(markup).find(tag => tag.includes(fragment))

test('Back to Now clears the selected occasion through the spine, keeps every retained basis, and notifies once', () => {
  const spine = createTimeSpine()
  spine.selectOccasion(occasionEvent('occ:a', Date.UTC(1913, 0, 1)), 1000)
  spine.selectOccasion(occasionEvent('occ:b', Date.UTC(1950, 0, 1)), 2000)
  let notified = 0
  const off = spine.subscribe(() => { notified += 1 })
  spine.returnToNow()
  assert.equal(spine.occasion(), null, 'the selection is cleared')
  assert.equal(spine.occasions().length, 2, 'retained occasions stay retained')
  assert.equal(spine.occasionFor('occ:b').basis.retainedAtUnixMs, 2000, 'the basis is untouched')
  assert.equal(notified, 1, 'subscribers are told once')
  spine.returnToNow()
  assert.equal(notified, 1, 'returning from Now is a no-op and does not notify')
  off()
})

test('the Technē tap is Back to Now: disabled with its reason while Now stands, enabled over a selected occasion', () => {
  const spine = createTimeSpine()
  const idle = html(createElement(ModeTransportBar, {mode: 'techne', timeSpine: spine}))
  const idleTap = buttonWith(idle, 'data-i="Back to Now|')
  assert.match(idleTap, /\sdisabled[=\s>]/)
  assert.match(idleTap, /title="[^"]*No occasion is selected/)
  spine.selectOccasion(occasionEvent('occ:a', Date.UTC(1913, 0, 1)), 1000)
  const selected = html(createElement(ModeTransportBar, {mode: 'techne', timeSpine: spine}))
  const tap = buttonWith(selected, 'data-i="Back to Now|')
  assert.doesNotMatch(tap, /\sdisabled[=\s>]/)
  assert.match(tap, /aria-label="Back to Now"/)
  assert.match(tap, /Back to Now/)
  // Without a spine the tap stays the drawn waiting state.
  const waiting = html(createElement(ModeTransportBar, {mode: 'techne'}))
  assert.match(buttonWith(waiting, 'data-i="Back to Now|'), /\sdisabled[=\s>]/)
})

test('the Occasion steps both ways in the spine\'s retention order, wrapping at both ends, and from Now the previous is the last', () => {
  const spine = createTimeSpine()
  spine.selectOccasion(occasionEvent('occ:a', Date.UTC(1913, 0, 1)), 1000)
  spine.selectOccasion(occasionEvent('occ:b', Date.UTC(1950, 0, 1)), 2000)
  spine.selectOccasion(occasionEvent('occ:c', Date.UTC(1969, 0, 1)), 3000)
  spine.selectOccasion(occasionEvent('occ:a', 0), 9999)
  assert.equal(stepOccasion(spine, -1).basis.ref, 'occ:c', 'previous from the first wraps to the last')
  assert.equal(stepOccasion(spine, -1).basis.ref, 'occ:b')
  assert.equal(stepOccasion(spine, 1).basis.ref, 'occ:c')
  assert.equal(stepOccasion(spine, 1).basis.ref, 'occ:a', 'next from the last wraps to the first')
  spine.returnToNow()
  assert.equal(stepOccasion(spine, -1).basis.ref, 'occ:c', 'from Now, previous is the last retained')
  spine.returnToNow()
  assert.equal(stepOccasion(spine, 1).basis.ref, 'occ:a', 'from Now, next is the first retained')
  assert.equal(stepOccasion(createTimeSpine(), -1), null, 'no retained occasion, no step either way')
})

test('the Occasion slot draws both steppers and the selected label, every enabled control named and tagged', () => {
  const spine = createTimeSpine()
  const empty = html(createElement(ModeTransportBar, {mode: 'techne', timeSpine: spine}))
  const emptySteps = buttonTags(empty).filter(tag => tag.includes('data-occasion-step'))
  assert.equal(emptySteps.length, 2, 'previous and next')
  assert.ok(emptySteps.every(tag => /\sdisabled[=\s>]/.test(tag)), 'nothing retained, nothing to step to')
  spine.selectOccasion({...occasionEvent('occ:a', Date.UTC(1913, 0, 1)), summary: 'the 1913 descent'}, 1000)
  spine.selectOccasion(occasionEvent('occ:b', Date.UTC(1950, 0, 1)), 2000)
  spine.selectOccasion({...occasionEvent('occ:a', 0), summary: 'the 1913 descent'}, 9999)
  const drawn = html(createElement(ModeTransportBar, {mode: 'techne', timeSpine: spine}))
  assert.match(drawn, /<output[^>]*data-occasion-label[^>]*>the 1913 descent<\/output>/)
  assert.match(drawn, /data-occasion-step="previous"[^>]*aria-label="Occasion window: previous occasion"/)
  assert.match(drawn, /data-occasion-step="next"[^>]*aria-label="Occasion window: next occasion"/)
  const enabled = enabledButtons(drawn)
  assert.ok(enabled.length >= 3, 'tap, previous and next are live')
  for (const tag of enabled) {
    assert.match(tag, /aria-label="[^"]+"/, 'an enabled control has an accessible name')
    assert.match(tag, /data-i="[^"]+"/, 'an enabled control carries the grammar\'s data-i')
  }
})

test('punch-in, punch-out and loop-length stay honest waiting states, and loop-length reads the spine\'s brace read-only', () => {
  const spine = createTimeSpine()
  spine.selectOccasion(occasionEvent('occ:a', Date.UTC(1913, 0, 1)), 1000)
  const plain = html(createElement(ModeTransportBar, {mode: 'techne', timeSpine: spine}))
  assert.match(buttonWith(plain, 'window opens here'), /\sdisabled[=\s>]/)
  assert.match(plain, /<output[^>]*data-i="Window span\|[^"]*"[^>]*>—<\/output>/)
  spine.setTransportLoop(['clip:1', 'clip:2'])
  const braced = html(createElement(ModeTransportBar, {mode: 'techne', timeSpine: spine}))
  assert.match(braced, /<output[^>]*data-i="Window span\|[^"]*"[^>]*>2 clips<\/output>/)
  assert.match(buttonWith(braced, 'window opens here'), /\sdisabled[=\s>]/, 'punch-in still waits')
})

test('Instrument writes names the focused instrument and waits for its writer: no fake toggle, no enabled control', () => {
  const focused = html(createElement(ModeTransportBar, {mode: 'techne', focusedInstrument: 'techne:m0'}))
  const arm = buttonWith(focused, 'data-i="Instrument writes|')
  assert.match(arm, /\sdisabled[=\s>]/)
  assert.match(focused, /<span> Project<\/span>/, 'the focused instrument\'s name stands in the slot')
  assert.match(arm, /Quaternal Logic family/, 'the title names the missing writer owner')
  assert.match(arm, /agent, not to the instrument/, 'the agent\'s write arm is named as not this gate')
  const none = html(createElement(ModeTransportBar, {mode: 'techne'}))
  assert.match(buttonWith(none, 'data-i="Instrument writes|'), /No instrument is focused/)
  assert.equal(enabledButtons(none).length, 0, 'with no spine and no focus, no Technē control is live')
  const base = html(createElement(ModeTransportBar, {mode: 'base', timeSpine: createTimeSpine()}))
  assert.equal(enabledButtons(base).length, 0, 'Base keeps every control waiting; the Occasion is Technē\'s slot')
  assert.doesNotMatch(base, /data-occasion-step/)
})

test('the App hands the one spine the temporal hook holds to the transport, and makes no second spine', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const hook = await readFile(new URL('../src/projections/useWorldTemporalReading.ts', import.meta.url), 'utf8')
  assert.match(app, /<TransportBar[\s\S]*?timeSpine=\{worldView\.spine\}/)
  assert.match(app, /<TransportBar[\s\S]*?focusedInstrument=\{focusedInstrument\}/)
  assert.equal(app.match(/createTimeSpine\(/g), null, 'App creates no spine of its own')
  assert.match(hook, /const spine = useMemo\(\(\) => createTimeSpine\(\), \[\]\);/)
})

// Seam 8, host side: the native door admits the device by its identity, the receiving window draws or refuses it by
// name, and the Workbench's door pops out and redocks through the existing window doors. Channel: scripted only.
// The build-time define the cradle's walk scenario reads at module evaluation (settings-apply-native.test.mjs does the same).
globalThis.__CRADLE_WALK__ = false
const {DeviceWindowBody, deviceAdmissionFault} = await import('../src/native/Detached.tsx')
const {deviceIdentityOf, placeDeviceDetached, dropDeviceDetached, nativeDetachedBodySupported} = await import('../src/native/detachedKinds.ts')
const boundDevice = (identity) => ({id: deviceBindingId(identity), kind: 'device', title: 'Probe', ref: deviceBindingId(identity), device: identity})

test('a device is a native detached kind, and its identity alone carries the device', () => {
  assert.equal(nativeDetachedBodySupported('device'), true)
  const identity = identityFor(probeFamily(['device']))
  assert.deepEqual(deviceIdentityOf(boundDevice(identity)), identity)
  assert.equal(deviceIdentityOf({id: 'device:probe/probe-face', kind: 'device', title: 'Probe'}), null)
})

test('the receiving window draws the declared device for a valid identity, and refuses an invalid one by name', () => {
  const declared = probeFamily(['device'])
  const drawn = html(createElement(DeviceWindowBody, {binding: boundDevice(identityFor(declared)), transport, manifests: [declared]}))
  assert.match(drawn, /data-device-window/)
  assert.match(drawn, /data-device-face="probe-face"/)
  assert.doesNotMatch(drawn, /data-device-fault/)
  const undeclared = probeFamily(['flow'])
  const refused = html(createElement(DeviceWindowBody, {binding: boundDevice(identityFor(undeclared)), transport, manifests: [undeclared]}))
  assert.match(refused, /data-device-fault/)
  assert.match(refused, /device detached kind/)
  assert.doesNotMatch(refused, /data-device-window/)
  assert.equal(deviceAdmissionFault(boundDevice(identityFor(declared)), [declared]), null)
  assert.match(deviceAdmissionFault({...boundDevice(identityFor(declared)), id: 'device:probe/other'}, [declared]), /binding id does not name/)
  assert.match(deviceAdmissionFault({id: 'device:probe/probe-face', kind: 'device', title: 'Probe'}, [declared]), /no device identity/)
})

test('the pop-out holds the device in the detached set, never as a centre tab, and a second pop-out finds the first', () => {
  const identity = identityFor(probeFamily(['device']))
  const binding = boundDevice(identity)
  const empty = {root: null, surfaces: {}, detached: undefined, focusedGroupId: null}
  const placed = placeDeviceDetached(empty, binding, '')
  assert.deepEqual(placed.surfaces[binding.id], binding)
  assert.deepEqual(placed.detached, [{surfaceId: binding.id, groupId: '', index: 0, pinned: false}])
  assert.equal(placed.root, null)
  assert.equal(placeDeviceDetached(placed, binding, '').detached.length, 1)
  const dropped = dropDeviceDetached(placed, binding.id)
  assert.equal(dropped.surfaces[binding.id], undefined)
  assert.deepEqual(dropped.detached, [])
})

test('the Workbench door pops out and redocks through the existing window doors; the frame never draws a device as knowledge', async () => {
  const workbench = await readFile(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
  const popOut = workbench.slice(workbench.indexOf('const popOutDevice'), workbench.indexOf('const redockDevice'))
  assert.match(popOut, /invoke\('window_detach'/)
  assert.match(popOut, /kind: 'device'/)
  assert.doesNotMatch(popOut, /detachBinding\(/)
  const redock = workbench.slice(workbench.indexOf('const redockDevice'), workbench.indexOf('// The device door the racks read'))
  assert.match(redock, /invoke\('window_redock_surface'/)
  assert.doesNotMatch(redock, /book\.redock\(/)
  assert.match(workbench, /publishDeviceWindowHost\(\{/)
  const listener = workbench.slice(workbench.indexOf("'oi:window-redock'"), workbench.indexOf('latest.current.book.redock(id, binding.id)'))
  assert.match(listener, /binding\.kind === 'device'[\s\S]*dropDeviceDetached/)
  const frame = await readFile(new URL('../../../../desktop/cradle/src/workspace/DetachedFrame.tsx', import.meta.url), 'utf8')
  const device = frame.indexOf('kind==="device"')
  assert.ok(device > 0 && device < frame.indexOf('<KnowledgeSurface'), 'a device binding is drawn by its renderer, never the knowledge fallback')
  assert.doesNotMatch(frame, /packages\/live-shell|live-shell\//, 'the cradle frame does not import the live shell')
})

test('every rack in the mode detail is handed the device door', async () => {
  const modeDetail = await readFile(new URL('../src/shell/ModeDetail.tsx', import.meta.url), 'utf8')
  const racks = modeDetail.match(/<InhabitantRack [^>]*\/>/g) ?? []
  assert.ok(racks.length >= 5, 'the mode detail stands its racks')
  for (const rack of racks) assert.match(rack, /deviceWindows=\{deviceWindows\}/, rack)
})
