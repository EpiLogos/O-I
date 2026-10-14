// T-DEVICES-CENTRAL: the Central family's devices through the one device runtime (FOUNDATION F5; manual §10.4): seven
// devices, compact on the chain (a small live picture and at most four readings), the Day die among them with its die as the
// picture, whole in the pool when chosen, full in a pane when opened — one device, the same live settings in all three.
// Scripted (SSR over the production components), not a screen pass; the UI legs are owed the lead's computer-use pass.
// Loader as central-devices-rack.test.mjs (it also resolves the document forms' `?raw`/.json imports, and gives the
// cradle's hooks and the shell's renderer one React, as the app's bundler does).
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

const model = await import('../src/central/devices/centralDeviceModel.ts')
const chain = await import('../src/central/devices/CentralDevices.tsx')
const dayDie = await import('../src/central/devices/dayDie.ts')
const door = await import('../src/frame/devices/deviceDoor.ts')
const {DevicePool} = await import('../src/frame/devices/DevicePool.tsx')
const {DeviceFullPane} = await import('../src/frame/devices/devicePane.tsx')
const {lightOf, compactRows} = await import('../src/frame/devices/deviceRuntime.ts')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {loadWorldShellFamilies} = await import('../src/inhabitants/worldShellFamilies.ts')
loadWorldShellFamilies() // the shell frame admits the declared families once per module load (shell/ModeDetail.tsx)
const {AGENT_SHELL_ADDRESS_TABLE} = await import('../src/inhabitants/agentParamAddresses.ts')
const vertical = await import('../src/central/centralVertical.ts')

const html = (element) => renderToStaticMarkup(element)
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const central = inhabitantManifest('central')
assert.ok(central, 'the central family is admitted by the shell\'s own door')
const FACES = ['day-die', 'flow-document', 'nara-conversation', 'context-world', 'agent-identity', 'ground-hygiene', 'impact']
const DAY_REF = 'central:day:control:root:2026-10-06'
const ready = vertical.interpretDayOpen(DAY_REF, {data: {schema: 'oi.central-day-open/v1', project: null, day: {
  document_state: 'ready', source: {ref: 'central:source:control:root:Control/user/day/2026-10-06/day.md'},
  document: {document_id: 'day-document:2026-10-06'}, revision: {revision: 'central.content-fnv1a64/v1:12:0000000000000001'}}}})
const uninitialised = vertical.interpretDayOpen(DAY_REF, {error: 'Current Day has no native document yet.'})
const DAY = {project: null, sourceRef: 'central:source:control:root:Control/user/day/2026-10-06/day.md', documentId: 'day-document:2026-10-06'}
const REVISION = 'central.content-fnv1a64/v1:12:0000000000000001'

const input = (extra = {}) => ({transport, faces: central.faces, manifest: central, reads: {}, day: null, conversation: null, flow: null, impact: null, deviceWindows: null, ...extra})
const entries = (extra) => chain.centralDeviceEntries(input(extra))
const compact = (entry, extra = {}) => html(createElement(DeviceViewOf, {entry, size: 'compact', ...extra}))
const {DeviceView} = await import('../src/frame/devices/DeviceView.tsx')
const {BaseDevicesDetail} = await import('../src/shell/ModeDetail.tsx')
/** One device's compact markup out of the chain. */
const deviceMarkup = (markup, faceId) => {
  const start = markup.indexOf(`data-device="central:${faceId}"`)
  assert.ok(start > 0, `the ${faceId} device stands on the chain`)
  const next = markup.indexOf('data-device="central:', start + 10)
  return markup.slice(start, next < 0 ? undefined : next)
}
function DeviceViewOf({entry, size}) { return createElement(DeviceView, {device: entry.device, size, picture: entry.picture(size)}) }

test('the family\'s seven faces are seven devices, in chain order, each its own family\'s declaration', () => {
  const set = entries()
  assert.deepEqual(set.map(entry => entry.id), FACES.map(id => `central:${id}`))
  for (const entry of set) {
    const declared = central.faces.find(face => `central:${face.id}` === entry.id)
    assert.ok(declared, `${entry.id} is a face the family declares`)
    assert.equal(entry.device.face.liveSemantic, declared.liveSemantic, 'the Live semantic is the family\'s own')
    assert.deepEqual(entry.device.face.invariant, declared.invariant, 'the invariant is the family\'s own')
  }
  assert.equal(set.find(entry => entry.id === 'central:day-die').device.face.liveSemantic, 'device-instrument')
})

test('a face the family declares but this chain does not know is drawn generically, never dropped', () => {
  const extra = {id: 'day-now', presentations: ['compact'], liveSemantic: 'transport-slot', note: 'The civil stratum.'}
  const set = entries({faces: [...central.faces, extra]})
  assert.equal(set.length, 8)
  assert.equal(set.at(-1).id, 'central:day-now')
  assert.equal(set.at(-1).device.face.title, 'Day Now')
  assert.match(compact(set.at(-1)), /data-central-picture="day-now"/, 'a picture, not a card of text')
})

test('every device is compact on the chain: a picture, at most four readings, no text-only card, and the doors to whole and full', () => {
  const markup = html(createElement(BaseDevicesDetail, {transport}))
  for (const id of FACES) {
    const device = deviceMarkup(markup, id)
    assert.match(device, /data-device-size="compact"/, id)
    assert.match(device, /class="device-picture"/, `${id} has its picture`)
    assert.match(device, /<svg[^>]*(?:role="img"|viewBox)/, `${id} draws a mark or a die`)
    assert.ok((device.match(/class="device-row"/g) ?? []).length <= 4, `${id}: at most four rows drawn`)
    assert.match(device, /Show every setting in the pool/, `${id} opens whole`)
    assert.match(device, /full size in a pane/, `${id} opens full`)
  }
  for (const entry of entries()) assert.ok(compactRows(entry.device.rows).length <= 4, `${entry.id}: at most four`)
})

test('the Day die\'s picture is the die: its net, the open face the owner\'s payload holds, no face inked when no Day stands', () => {
  const bare = entries().find(entry => entry.id === 'central:day-die')
  assert.match(compact(bare), /class="central-die-net" data-die-face=""/, 'no Day: no face inked')
  const reads = {day: {standing: ready, face: 3, revision: REVISION}}
  const lit = entries({reads, day: DAY}).find(entry => entry.id === 'central:day-die')
  const markup = compact(lit)
  assert.match(markup, /data-die-face="3"/, 'the open face is the payload\'s')
  assert.match(markup, /fill="var\(--inh-ink\)"/, 'the open face is inked')
  assert.equal(lit.device.values.face, '#3 Pattern — Observations', 'the face reads in the owners\' names')
  assert.equal(dayDie.dieFaceOf({meta: {face: 4}}), 4)
  assert.equal(dayDie.dieFaceOf({meta: {face: 9}}), 0, 'a face outside the die is no face')
  assert.equal(dayDie.dieFaceOf(null), 0)
})

test('the rows are the family\'s declared rows, and every one is a reading: owners write, faces read', () => {
  const set = entries()
  const rowsOf = id => set.find(entry => entry.id === `central:${id}`).device.rows
  const declared = (instance) => AGENT_SHELL_ADDRESS_TABLE.filter(row => row.family === 'central' && row.deviceInstance === instance).map(row => row.key)
  assert.deepEqual(rowsOf('context-world').map(row => row.key), declared('world'), 'the Context-world\'s rows are Central\'s world addresses')
  assert.deepEqual(rowsOf('agent-identity').map(row => row.key).filter(key => declared('agent').includes(key)), declared('agent'), 'the identity row is Central\'s agent address')
  for (const entry of set) {
    assert.equal(entry.device.submit, undefined, `${entry.id} has no write door`)
    assert.ok(entry.device.rows.every(row => !row.writePath), `${entry.id}: a row without an owner write is a reading`)
    assert.ok(entry.device.rows.every(row => row.family === 'central' && [entry.id.slice('central:'.length), 'world', 'agent'].includes(row.deviceInstance)), `${entry.id}: every row is Central's own`)
  }
})

test('a light is the owner\'s reading: dark when unknown, on only when the owner reports on', () => {
  const light = (id, reads) => lightOf(model.centralDevice(central.faces.find(face => face.id === id), reads))
  for (const id of FACES) assert.equal(light(id, {}), 'unknown', `${id}: no reading, no light`)
  assert.equal(light('day-die', {day: {standing: ready, face: null, revision: null}}), 'on')
  assert.equal(light('day-die', {day: {standing: uninitialised, face: null, revision: null}}), 'off')
  assert.equal(light('nara-conversation', {nara: {state: 'resolving', conversation: null, gap: null, expression: null, session: null}}), 'unknown', 'resolving is not yet known')
  assert.equal(light('nara-conversation', {nara: {state: 'bound', conversation: null, gap: null, expression: 'expression:x', session: 'session:y'}}), 'on')
  assert.equal(light('nara-conversation', {nara: {state: 'no-identity', conversation: null, gap: null, expression: null, session: null}}), 'off')
  assert.equal(light('agent-identity', {roster: {answer: 'refused', identity: null, accepted: 0, total: 0, fault: 'refused'}}), 'unknown', 'a refused roster is no reading')
  assert.equal(light('agent-identity', {roster: {answer: 'read', identity: 'agent/central-guardian', accepted: 2, total: 3, fault: null}}), 'on')
  assert.equal(light('ground-hygiene', {workcell: {answer: 'read', ref: 'workcell:mac', health: 'ok', ok: null, fault: null}}), 'unknown', 'an answer with no ok is not a lit light')
  assert.equal(light('ground-hygiene', {workcell: {answer: 'read', ref: 'workcell:mac', health: 'degraded', ok: false, fault: null}}), 'off')
})

test('the owners\' readings fill the rows: the roster\'s first accepted agent, the workcell, the conversation, the Day\'s revision', () => {
  const device = (id, reads) => model.centralDevice(central.faces.find(face => face.id === id), reads)
  assert.equal(device('agent-identity', {roster: {answer: 'read', identity: 'agent/central-guardian', accepted: 2, total: 3, fault: null}}).values.identity, 'agent/central-guardian')
  assert.equal(device('agent-identity', {roster: {answer: 'read', identity: null, accepted: 0, total: 1, fault: null}}).values.roster, '0 accepted · 1 on the roster')
  assert.equal(device('ground-hygiene', {workcell: {answer: 'read', ref: 'workcell:mac', health: 'ok', ok: true, fault: null}}).values.workcell, 'workcell:mac')
  assert.equal(device('day-die', {day: {standing: ready, face: 0, revision: REVISION}}).values.revision, ':000000000000 · 12 B')
  assert.equal(device('impact', {impact: {kind: 'folder', path: 'Work/O-I'}}).values.subject, 'folder · Work/O-I')
  assert.match(device('day-die', {day: {standing: uninitialised, face: null, revision: null}}).rows.find(row => row.key === 'day').disclosure, /central · initialise-day/, 'an uninitialised Day names the owner op that admits it')
})

test('the door shows the same device whole in the pool and full in a pane', () => {
  const set = entries({reads: {day: {standing: ready, face: 3, revision: REVISION}}, day: DAY})
  for (const entry of set) door.publishDevice(entry.id, {device: entry.device, picture: entry.picture})
  try {
    door.selectDevice('central:day-die')
    const pool = html(createElement(DevicePool))
    assert.match(pool, /data-device-pool="central:day-die"/)
    assert.match(pool, /data-device-size="whole"/)
    assert.match(pool, /class="central-die-net"/, 'the die stands whole too')
    assert.match(pool, /<legend>Die<\/legend>[\s\S]*<legend>Source<\/legend>/, 'every setting, grouped')
    assert.match(pool, /data-param="source"/, 'the whole size shows the rows the compact one folds')
    const pane = html(createElement(DeviceFullPane, {id: 'central:day-die'}))
    assert.match(pane, /data-device-size="full"/)
    assert.match(pane, /data-central-body="day-die"/)
    assert.match(pane, /data-document-device="ql-daily-die"/, 'the full size is the face\'s own hosted form, ported')
    assert.equal(set[0].device.values.face, '#3 Pattern — Observations', 'the same device, the same live settings')
    assert.match(pane, /data-param="face"/)
    door.selectDevice('central:nara-conversation')
    assert.match(html(createElement(DeviceFullPane, {id: 'central:nara-conversation'})), /data-conversation-device="nara"/)
    assert.match(html(createElement(DeviceFullPane, {id: 'central:ground-hygiene'})), /data-central-device="ground-hygiene"/)
    assert.match(html(createElement(DeviceFullPane, {id: 'central:impact'})), /data-central-picture="impact"/, 'no subject: the full size is its picture, not a blank')
  } finally {
    for (const entry of set) door.publishDevice(entry.id, null)
    door.selectDevice(null)
  }
  assert.match(html(createElement(DeviceFullPane, {id: 'central:day-die'})), /not on any chain right now/, 'withdrawn with its chain')
})

test('the impact opens full over the subject the browser selected', () => {
  const subject = {kind: 'folder', path: 'Work/O-I'}
  const entry = entries({impact: subject}).find(item => item.id === 'central:impact')
  assert.match(html(entry.picture('full')), /data-central-device="impact"[^>]*data-subject="Work\/O-I"/)
})

test('pop-out is kept where the face declares it: offered with a host and an aperture, disabled without, redock when out', () => {
  const calls = []
  const host = (popped = false) => ({popOut: identity => calls.push(['pop', identity.face]), redock: identity => calls.push(['redock', identity.face]), poppedOut: () => popped})
  const withHost = entries({deviceWindows: host(), day: DAY})
  assert.match(compact(withHost.find(entry => entry.id === 'central:day-die')), /data-action="pop-out"(?![^>]*disabled)/, 'the die pops out on its Day')
  assert.match(compact(withHost.find(entry => entry.id === 'central:nara-conversation')), /data-action="pop-out"/)
  assert.doesNotMatch(compact(withHost.find(entry => entry.id === 'central:context-world')), /pop-out/, 'a parameter face does not pop out')
  assert.match(compact(withHost.find(entry => entry.id === 'central:flow-document')), /data-action="pop-out"[^>]*disabled/, 'the Flow needs its flow in the aperture')
  assert.doesNotMatch(compact(entries({day: DAY}).find(entry => entry.id === 'central:day-die')), /pop-out/, 'no host door: no pop-out')
  const out = entries({deviceWindows: host(true), day: DAY}).find(entry => entry.id === 'central:day-die')
  assert.match(compact(out), /data-action="redock"/)
  assert.match(html(out.picture('full')), /data-popped-out="true"[\s\S]*Popped out/, 'the pane does not hold a second copy of a popped-out device')
})

test('the Devices chain no longer renders the rack\'s text cards', async () => {
  const source = await readFile(new URL('../src/shell/ModeDetail.tsx', import.meta.url), 'utf8')
  const body = source.slice(source.indexOf('export function BaseDevicesDetail'), source.indexOf('/** Base · Document'))
  assert.match(body, /<CentralDevicesChain /)
  assert.doesNotMatch(body, /<InhabitantRack/)
})
