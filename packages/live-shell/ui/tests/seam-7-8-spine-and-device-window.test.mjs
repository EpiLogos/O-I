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
