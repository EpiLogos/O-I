// The Base Devices chain takes its Central apertures from the one selection the
// Document row shows (WORLD-SHELL-DESIGN §5, §17.2; src/central), and draws the family's
// devices through the device runtime (T-DEVICES-CENTRAL; src/central/devices): each
// compact, with its own live picture, the Day die its die. Rendered under SSR (the
// mode-surface-fidelity pattern): the owner's Day reading is passed in as the
// `standing` the hook would have read, because effects do not run server-side.
//
// Channels: the events and the Day answers are constructed from the real capture's
// shape (the walk test reads the captures); the chain, the Day die, and the Nara face
// are the production components, rendered as they are. Scripted (SSR), not a screen pass.

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
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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

const {BaseDevicesDetail} = await import('../src/shell/ModeDetail.tsx')
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')
const vertical = await import('../src/central/centralVertical.ts')
const rack = await import('../src/central/centralRack.ts')
const devices = await import('../src/central/devices/CentralDevices.tsx')
const {NaraConversationFace} = await import('../src/inhabitants/ConversationNaraFace.tsx')
const model = await import('../src/central/devices/centralDeviceModel.ts')
const {DeviceView} = await import('../src/frame/devices/DeviceView.tsx')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')

const html = (element) => renderToStaticMarkup(element)
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}

// The Base Devices chain as it stands with no selection (the reference markup).
const todayMarkup = html(createElement(BaseDevicesDetail, {transport}))

// A world the Central selection reads: the spine and the reading the World cut holds.
const NOW_REF = 'central:now:control:root:' + '0'.repeat(63) + '1'
const DAY_REF = 'central:day:control:root:2026-10-06'
const nowEvent = {stream: 'central-now', kind: 'now', subject_ref: NOW_REF, instant_unix_ms: Date.UTC(2026, 9, 6, 10, 0), summary: 'sample clearing', day_ref: DAY_REF, evidence_refs: []}
const CONVERSATION_SPACE = 'session-space/nara-' + 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const conversationEvent = {stream: 'session-space', kind: 'conversation', subject_ref: CONVERSATION_SPACE, instant_unix_ms: Date.UTC(2026, 9, 6, 9, 30), summary: 'sample dialogue', day_ref: DAY_REF, evidence_refs: []}

function worldWith(events, selected) {
  const spine = createTimeSpine()
  if (selected) spine.selectOccasion(selected, Date.UTC(2026, 9, 14))
  return {spine, source: {events}}
}

// The owner's answers, as the kernel gives them: a ready Day (a fixture shape, the
// one `central.document-reading` form the Day die reads) and the uninitialised refusal.
const readyStanding = vertical.interpretDayOpen(DAY_REF, {data: {schema: 'oi.central-day-open/v1', project: null, day: {
  document_state: 'ready', source: {ref: 'central:source:control:root:Control/user/day/2026-10-06/day.md'},
  document: {document_id: 'day-document:2026-10-06'}, revision: {revision: 'central.content-fnv1a64/v1:12:0000000000000001'}}}})
const uninitialisedStanding = vertical.interpretDayOpen(DAY_REF, {error: 'Current Day has no native document yet. Use the explicit native initialisation path; its temporal artifact is not a Daily Die'})

const central = inhabitantManifest('central')
assert.ok(central, 'the central family is admitted by the shell\'s own door')

/** The chain's input with no owner answered and no aperture standing, over the family's own faces. */
const chainInput = (extra = {}) => ({transport, faces: central.faces, manifest: central, reads: {}, day: null, conversation: null, flow: null, impact: null, deviceWindows: null, ...extra})

/** One device's compact markup out of the chain. */
const deviceMarkup = (markup, faceId) => {
  const start = markup.indexOf(`data-device="central:${faceId}"`)
  assert.ok(start > 0, `the ${faceId} device stands on the chain`)
  const next = markup.indexOf('data-device="central:', start + 10)
  return markup.slice(start, next < 0 ? undefined : next)
}

test('no selected occasion: the chain is unchanged by a world with nothing retained', () => {
  // R4 (DLW §16.2): the family's chain faces are the Day, the Packet, Ground hygiene, Machine (W4, §18.7) and Impact (REPLACED: lane BC3's
  // seven), each on the door; Ground hygiene, Machine and Impact stand on a world whose folder holds code (w4-central-machine-chain.test.mjs).
  assert.match(todayMarkup, /data-central-devices="5"/, 'the five chain faces of the Central family stand on the door, reached document or not')
  const empty = worldWith([nowEvent], null)
  assert.equal(html(createElement(BaseDevicesDetail, {transport, world: empty, standing: null})), todayMarkup, 'a world with no retained occasion: unchanged')
  assert.equal(html(createElement(BaseDevicesDetail, {transport, standing: readyStanding})), todayMarkup, 'a Day standing with no occasion draws no Day: the die has no aperture')
})

test('a browser subject stands in the Document row: it shadows the occasion, the Day die keeps no Day, the Impact names the subject', () => {
  const selected = worldWith([nowEvent], nowEvent)
  const subject = {kind: 'note', path: 'Control/agents/now/day/2026-09-12.md'}
  const markup = html(createElement(BaseDevicesDetail, {transport, world: selected, subject, standing: readyStanding}))
  const die = deviceMarkup(markup, 'day-die')
  assert.match(die, /data-device-light="unknown"/, 'no Day aperture: the die\'s light stays dark')
  assert.doesNotMatch(die, /2026-10-06/, 'the occasion\'s Day is not read while a browser subject stands')
  // W4 (§16.2): with no world holding code selected, the Impact stands on no chain; its device, on the door, reads the selected subject.
  assert.ok(!markup.includes('data-device="central:impact"'), 'the Impact: on a world whose folder holds code only')
  const impact = devices.centralDeviceEntries(chainInput({reads: {impact: subject}, impact: subject})).find(entry => entry.id === 'central:impact')
  assert.match(html(createElement(DeviceView, {device: impact.device, size: 'compact', picture: impact.picture('compact')})),
    /data-central-picture="impact"[\s\S]*<small>Control\/agents\/now\/day\/2026-09-12\.md<\/small>/, 'the Impact reads the selected subject')
})

test('a selected Day occasion with a ready Day: the Day die stands lit on its Day, its body a pane away (its picture is its design\'s)', () => {
  const markup = html(createElement(BaseDevicesDetail, {transport, world: worldWith([nowEvent], nowEvent), standing: readyStanding}))
  const die = deviceMarkup(markup, 'day-die')
  assert.match(die, /data-device-light="on"/, 'the owner reports the Day ready, so the light is on')
  assert.doesNotMatch(die, /class="central-die-net"/, 'MOVED: the net is the design\'s (day.tsx), drawn once the Day\'s binding is published (central-day-binding.test.mjs)')
  assert.doesNotMatch(markup, /data-document-device="ql-daily-die"/, 'the hosted form is the full size\'s body, not the compact device\'s')
  assert.doesNotMatch(markup, /No Day is selected\. Select one in the browser[^<]*docks here/, 'the empty-slot copy does not claim there is no Day')
})

test('a selected Day occasion with an uninitialised Day: the owner state is named above the chain, and the die is lit off, never on', () => {
  const markup = html(createElement(BaseDevicesDetail, {transport, world: worldWith([nowEvent], nowEvent), standing: uninitialisedStanding}))
  assert.match(markup, /data-central-day-notice="uninitialised"/)
  assert.match(markup, /has no Day document yet/)
  assert.match(markup, /central · initialise-day/, 'the owner op that would admit the Day is named')
  assert.match(deviceMarkup(markup, 'day-die'), /data-device-light="off"/, 'the owner says the Day is not ready: off, not dark and not on')
})

test('a selected conversation occasion: the Nara face reads unbound with no identity; the owner gap shows whole and in its body (REPLACED: on the chain — the one Agent stands there now, r4-one-agent.test.mjs)', () => {
  const markup = html(createElement(BaseDevicesDetail, {transport, world: worldWith([conversationEvent], conversationEvent)}))
  assert.ok(!markup.includes('data-device="central:nara-conversation"'), 'the Answer is no chain device: the Agent answers on the workspace chain')
  assert.match(markup, /data-device="central:agent"/, 'the one Agent stands on the workspace chain')
  const face = central.faces.find(item => item.id === 'nara-conversation')
  const gap = vertical.conversationGap(CONVERSATION_SPACE)
  const device = model.centralDevice(face, {nara: {state: 'no-identity', conversation: CONVERSATION_SPACE, gap, expression: null, session: null}})
  assert.equal(device.values.conversation, CONVERSATION_SPACE, 'the device names this conversation')
  assert.match(html(createElement(DeviceView, {device, size: 'whole'})), /session-space/, 'whole: the expression row names the owner that owes the binding')
  // The face's hosted body names the gap where it is drawn (its Full), on or off a chain.
  const full = html(createElement(NaraConversationFace, {transport, project: null, expressionRef: null, conversation: CONVERSATION_SPACE}))
  assert.match(full, new RegExp(`data-conversation-gap="${CONVERSATION_SPACE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), 'full: the body names this conversation')
})

test('the apertures follow the Document row\'s own selection and the Day standing', () => {
  const world = worldWith([nowEvent], nowEvent)
  const resolved = vertical.resolveCentralOccasion(world.spine.occasion(), world.source.events)
  assert.equal(resolved.state, 'selected', 'the rack reads the same resolver the Document row reads')
  const apertures = rack.centralRackApertures(resolved.selection, readyStanding)
  assert.deepEqual(apertures.day, {project: null, sourceRef: 'central:source:control:root:Control/user/day/2026-10-06/day.md', documentId: 'day-document:2026-10-06'})
  assert.equal(apertures.conversation, undefined)
  assert.deepEqual(rack.centralRackApertures(null, readyStanding), {}, 'no occasion: no aperture')
})
