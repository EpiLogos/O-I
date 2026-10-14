// T-DEVICES-CENTRAL: the Central family's devices through the one device runtime (FOUNDATION F5; manual §10.4): six
// devices, compact on the chain (a small live picture and at most four controls), the Day die among them with its die as the
// picture, whole in the pool when chosen, full in a pane when opened — one device, the same live settings in all three. The
// two instruments (the die, the conversation) keep their Live semantic at every size: each carries the write row its
// declaration names, through the owner path its hosted body already uses (R2 objection 9). The Flow is a declared clip: it is
// off the chain and on the Clip side, with its states as a row.
// Channels: SCRIPTED (SSR over the production components) for what the sizes draw; SCRIPTED against a FAKE OWNER (a stubbed
// kernel bridge that holds one Day document and checks the CAS, the field map and the request ids as the owner's wire does) for
// the writes. Not a screen pass; the UI legs are owed the lead's computer-use pass.
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
const FACES = ['day-die', 'nara-conversation', 'context-world', 'agent-identity', 'ground-hygiene', 'impact']
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

test('the family\'s device faces are six devices, in chain order, each its own family\'s declaration; its clip is not one of them', () => {
  const set = entries()
  assert.deepEqual(set.map(entry => entry.id), FACES.map(id => `central:${id}`))
  for (const entry of set) {
    const declared = central.faces.find(face => `central:${face.id}` === entry.id)
    assert.ok(declared, `${entry.id} is a face the family declares`)
    assert.equal(entry.device.face.liveSemantic, declared.liveSemantic, 'the Live semantic is the family\'s own')
    assert.deepEqual(entry.device.face.invariant, declared.invariant, 'the invariant is the family\'s own')
    assert.notEqual(declared.liveSemantic, 'clip', `${entry.id} is a device, not a clip`)
  }
  assert.equal(set.find(entry => entry.id === 'central:day-die').device.face.liveSemantic, 'device-instrument')
  // The Flow is declared a clip (worldShellFamilies.ts): it stands on the Clip side, not on the Device chain.
  assert.equal(central.faces.find(face => face.id === 'flow-document').liveSemantic, 'clip')
  assert.ok(!set.some(entry => entry.id === 'central:flow-document'), 'no clip stands on the Device chain')
  assert.deepEqual(model.clipFaces(central.faces).map(face => face.id), ['flow-document'])
  assert.deepEqual(model.chainFaces(central.faces).map(face => face.id), FACES)
})

test('a face the family declares but this chain does not know is drawn generically, never dropped', () => {
  const extra = {id: 'day-now', presentations: ['compact'], liveSemantic: 'transport-slot', note: 'The civil stratum.'}
  const set = entries({faces: [...central.faces, extra]})
  assert.equal(set.length, 7)
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

test('the rows are the family\'s declared rows; a row is a reading unless the family\'s declaration names the path that writes it', () => {
  const set = entries()
  const rowsOf = id => set.find(entry => entry.id === `central:${id}`).device.rows
  const declared = (instance) => AGENT_SHELL_ADDRESS_TABLE.filter(row => row.family === 'central' && row.deviceInstance === instance).map(row => row.key)
  assert.deepEqual(rowsOf('context-world').map(row => row.key), declared('world'), 'the Context-world\'s rows are Central\'s world addresses')
  assert.deepEqual(rowsOf('agent-identity').map(row => row.key).filter(key => declared('agent').includes(key)), declared('agent'), 'the identity row is Central\'s agent address')
  // The two instruments declare `generates`; their write row goes through exactly that path. Every other row is a reading.
  const writing = Object.fromEntries(set.map(entry => [entry.id.slice('central:'.length), entry.device.rows.filter(row => row.writePath).map(row => [row.key, row.writePath])]))
  assert.deepEqual(writing, {'day-die': [['face', 'kernel:receiving']], 'nara-conversation': [['bound', 'kernel:nara_dialogue']],
    'context-world': [], 'agent-identity': [], 'ground-hygiene': [], 'impact': []})
  for (const entry of set) {
    const declaredPath = entry.device.face.invariant?.generates
    assert.equal(typeof entry.device.submit, declaredPath ? 'function' : 'undefined', `${entry.id}: a write door exactly where the declaration names a generating path`)
    assert.ok(entry.device.rows.every(row => !row.writePath || row.writePath === declaredPath), `${entry.id}: no row writes anywhere the declaration did not name`)
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
  assert.ok(!withHost.some(entry => entry.id === 'central:flow-document'), 'the Flow is a clip: its pop-out goes with it to the Clip side')
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

// ── the instruments keep their Live semantic at every size (R2 objection 9) ─────────────────────────────────────────────────

const writes = await import('../src/central/devices/centralDeviceWrites.ts')
const flowClip = await import('../src/central/devices/FlowClip.tsx')
const identity = await import('../../../../desktop/cradle/src/nara/identity/current.ts')
const bridge = {kind: 'bridge', url: 'http://owner.fixture'}
// A row's control as the markup draws it: a control (`sdk-enum`, `sdk-bool`), not a reading chip. Under SSR the runtime's draft
// custody has not adopted the owner's values (effects do not run), so every control stands dark here; whether it is live once
// adopted is the runtime's own (frame/devices/DeviceView.tsx: disabled only without a `submit`, a write path, or a value) and
// is a screen leg, owed the lead's pass.
const control = (markup, key, kind) => {
  const row = markup.match(new RegExp(`data-param="${key}">(?:(?!data-param=)[\\s\\S])*?<button type="button" class="sdk-${kind}`))
  return row !== null
}
const NARA_UNBOUND = {state: 'unbound', conversation: null, gap: null, expression: null, session: null}

test('the Day die and the conversation carry a generating control at every size — compact, whole and full — and the instance carries the door that writes it', () => {
  const reads = {day: {standing: ready, face: 3, revision: REVISION}, nara: NARA_UNBOUND}
  const set = entries({reads, day: DAY, conversation: {project: null, expressionRef: 'expression:x', conversation: null}})
  for (const entry of set) door.publishDevice(entry.id, {device: entry.device, picture: entry.picture})
  try {
    const die = set.find(entry => entry.id === 'central:day-die'), nara = set.find(entry => entry.id === 'central:nara-conversation')
    // compact: the chain's own markup
    assert.ok(control(compact(die), 'face', 'enum'), 'compact: the die turns')
    assert.ok(control(compact(nara), 'bound', 'bool'), 'compact: the conversation binds')
    // whole: the pool
    door.selectDevice('central:day-die')
    assert.ok(control(html(createElement(DevicePool)), 'face', 'enum'), 'whole: the die turns')
    door.selectDevice('central:nara-conversation')
    assert.ok(control(html(createElement(DevicePool)), 'bound', 'bool'), 'whole: the conversation binds')
    // full: a pane, over the hosted body
    const diePane = html(createElement(DeviceFullPane, {id: 'central:day-die'}))
    assert.match(diePane, /data-document-device="ql-daily-die"/)
    assert.ok(control(diePane, 'face', 'enum'), 'full: the die turns beside its hosted form')
    const naraPane = html(createElement(DeviceFullPane, {id: 'central:nara-conversation'}))
    assert.match(naraPane, /data-conversation-device="nara"/)
    assert.ok(control(naraPane, 'bound', 'bool'), 'full: the conversation binds beside its hosted face')
    // one device: the three sizes read the same instance, so one `submit` writes all three
    assert.equal(typeof die.device.submit, 'function')
    assert.equal(typeof nara.device.submit, 'function')
    // the other rows stay readings at every size
    assert.ok(!control(compact(die), 'revision', 'enum') && !control(compact(die), 'day', 'enum'), 'the Day and its revision are readings')
  } finally {
    for (const entry of set) door.publishDevice(entry.id, null)
    door.selectDevice(null)
  }
  // With no Day standing the control is still the die's: the instrument keeps its semantic, and its value is not disclosed.
  assert.ok(control(compact(entries().find(entry => entry.id === 'central:day-die')), 'face', 'enum'))
})

/** A fake owner behind a stubbed kernel bridge: it holds one Day document and checks the CAS, the field map and the request
 * ids the way the wire does (receiving Document / MutateField), and answers the nara_dialogue op. FIXTURE, not a capture. */
function fakeOwner({fieldMap, face = 3, stale = false, dialogue = true} = {}) {
  const fields = fieldMap ?? [{id: 'p3_pattern', template_pointer: '/fields/p3_pattern'}, {id: 'original:meta', template_pointer: '/meta'}, {id: 'original:fields', template_pointer: '/fields'}]
  const state = {revision: 1, payload: {meta: {uuid: 'day-uuid', date: '2026-10-06', timezone: 'Europe/London', created: '2026-10-06T07:00:00Z', face, zoomed: false},
    fields: {p3_pattern: 'seen'}, _oi_form_source: {schema: 'oi.original-day-form/v1', location: 'form', revision: 'f1'}}}
  const sent = []
  const reading = extra => ({schema: 'central.document-reading/v1', source: {ref: DAY.sourceRef, path: 'Control/user/day/2026-10-06/day.md'}, revision: {revision: `rev-${state.revision}`},
    document_id: DAY.documentId, document: {document_id: DAY.documentId, kind: 'day', fields, template_payload: state.payload}, automatic_agent_or_model_invocation: false, ...extra})
  const ok = (result, data) => ({json: async () => ({ok: true, outcome: {result, data}})})
  const refused = error => ({json: async () => ({ok: false, error})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'receiving') {
      const {Document, MutateField} = body.request
      if (Document) return ok('receiving_reading', reading())
      if (MutateField) {
        if (stale || MutateField.expected_revision !== `rev-${state.revision}`) return refused(`the owner holds rev-${state.revision}; revision ${MutateField.expected_revision} is stale`)
        const field = fields.find(candidate => candidate.id === MutateField.field_id)
        if (!field) return refused(`no field ${MutateField.field_id}`)
        state.payload = {...state.payload, [field.template_pointer.slice(1)]: MutateField.value}
        const previous = `rev-${state.revision}`
        state.revision++
        return ok('receiving_reading', reading({operation_receipt: {status: 'committed', previous_revision: previous, revision: `rev-${state.revision}`}}))
      }
    }
    if (body.op === 'nara_dialogue') {
      if (!dialogue) return refused('AIKit retained no binding')
      return ok('nara_dialogue', {schema: 'oi.nara-dialogue-binding/v1', binding: body.request, provisioning: {agent_session: 'session:fixture', space: 'space:fixture'}})
    }
    return refused(`unexpected op ${body.op}`)
  }
  return {fetch, sent, state, mutations: () => sent.filter(body => body.request?.MutateField).map(body => body.request.MutateField)}
}
async function withOwner(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}
const dieOf = (extra = {}) => entries({transport: bridge, reads: {day: {standing: ready, face: 3, revision: REVISION}}, day: DAY, ...extra}).find(entry => entry.id === 'central:day-die').device

test('turning the die writes the open face through the owner\'s mutate-field, CAS-checked, and nothing else of the Day', async () => {
  const owner = fakeOwner()
  let reread = 0
  await withOwner(owner, async () => {
    await dieOf({afterWrite: {day: () => { reread++ }}}).submit([{key: 'face', value: '#4 Context — Structure'}])
  })
  const [write] = owner.mutations()
  assert.equal(owner.mutations().length, 1, 'one field, one write')
  assert.deepEqual([write.source_ref, write.document_id, write.expected_revision, write.field_id], [DAY.sourceRef, DAY.documentId, 'rev-1', 'original:meta'], 'the owner\'s CAS: the revision the reading gave')
  assert.match(write.request_id, /^req\/desktop-/, 'a request id the owner deduplicates on')
  assert.equal(write.value.face, 4, 'the open face is the die position written')
  assert.deepEqual({...write.value, face: 3}, {uuid: 'day-uuid', date: '2026-10-06', timezone: 'Europe/London', created: '2026-10-06T07:00:00Z', face: 3, zoomed: false}, 'the Day\'s identity and its other meta are carried untouched')
  assert.equal(owner.state.payload.meta.face, 4, 'the owner holds the turned die')
  assert.equal(owner.state.payload.fields.p3_pattern, 'seen', 'no other field was touched')
  assert.equal(reread, 1, 'the chain reads the owner again, so the three sizes show what the owner holds')
  // already open: the device writes nothing
  await withOwner(owner, () => dieOf().submit([{key: 'face', value: '#4 Context — Structure'}]))
  assert.equal(owner.mutations().length, 1, 'turning to the open face is no write')
  assert.equal(writes.dieFaceOfLabel('#5 Synthesis — Crystallization'), 5)
  assert.equal(writes.dieFaceOfLabel('#9 Nowhere'), null)
})

test('a die turn the owner cannot take is refused in the owner\'s words or by name, and nothing is written', async () => {
  // no Day aperture: no owner path stands
  const none = fakeOwner()
  await withOwner(none, async () => {
    await assert.rejects(() => dieOf({day: null}).submit([{key: 'face', value: '#2 Operation — Sessions'}]), /No Day is selected/)
  })
  assert.equal(none.sent.length, 0, 'no aperture, no call to the owner')
  // a word that is no position of the die
  await withOwner(none, async () => {
    await assert.rejects(() => dieOf().submit([{key: 'face', value: '#9 Nowhere'}]), /is no position of the die/)
  })
  // a Day whose field map carries no field for the face (an old document): refused by name, never written nowhere
  const unmapped = fakeOwner({fieldMap: [{id: 'p3_pattern', template_pointer: '/fields/p3_pattern'}]})
  await withOwner(unmapped, async () => {
    await assert.rejects(() => dieOf().submit([{key: 'face', value: '#0 Ground — Capture'}]), /carries no field for the die's open face/)
  })
  assert.equal(unmapped.mutations().length, 0)
  // the owner's CAS refusal comes back verbatim, and the face stays where it was
  const stale = fakeOwner({stale: true})
  await withOwner(stale, async () => {
    await assert.rejects(() => dieOf().submit([{key: 'face', value: '#0 Ground — Capture'}]), /is stale/)
  })
  assert.equal(stale.state.payload.meta.face, 3, 'a refused turn moves nothing')
  // the device refuses a row that has no write path by name, as every device does
  await assert.rejects(() => dieOf().submit([{key: 'revision', value: 'x'}]), /no owner write is declared for this row/)
})

test('binding the conversation resolves the dialogue through the nara_dialogue op, as the encounter surface does; unbinding has no owner op', async () => {
  const conversation = {project: null, expressionRef: 'expression:bind-1', conversation: null}
  const device = (extra = {}) => entries({transport: bridge, reads: {nara: NARA_UNBOUND}, conversation, ...extra}).find(entry => entry.id === 'central:nara-conversation').device
  // no current identity: the face's own words
  identity.clearCurrentIdentity()
  const owner = fakeOwner()
  await withOwner(owner, async () => {
    await assert.rejects(() => device().submit([{key: 'bound', value: true}]), /No Nara identity is current/)
  })
  assert.equal(owner.sent.length, 0, 'nothing is asked of the owner without a person to bind')
  identity.selectCurrentIdentity(
    {person_ref: 'person:fixture', nara_ref: 'nara:fixture', profile: {person_ref: 'person:fixture', nara_ref: 'nara:fixture'}},
    {source_ref: 'central:source:identity-fixture', revision: 'rev-identity'})
  try {
    let bound = 0
    await withOwner(owner, async () => {
      await assert.rejects(() => device({conversation: {project: null, expressionRef: null, conversation: null}}).submit([{key: 'bound', value: true}]), /No expression is selected/)
      await assert.rejects(() => device({conversation: {project: null, expressionRef: null, conversation: 'conversation:space-1'}}).submit([{key: 'bound', value: true}]), /expression/i, 'a space with no expression names the owner gap')
      await assert.rejects(() => device().submit([{key: 'bound', value: false}]), /cannot unbind/)
      assert.equal(owner.sent.length, 0, 'every refusal came before the owner was asked')
      await device({afterWrite: {conversation: () => { bound++ }}}).submit([{key: 'bound', value: true}])
    })
    const [asked] = owner.sent
    assert.equal(owner.sent.length, 1, 'one resolve')
    assert.equal(asked.op, 'nara_dialogue')
    assert.deepEqual([asked.request.operation, asked.request.role, asked.request.expression_ref, asked.request.person_ref, asked.request.nara_ref, asked.request.source_ref, asked.request.expected_revision],
      ['resolve', 'nara', 'expression:bind-1', 'person:fixture', 'nara:fixture', 'central:source:identity-fixture', 'rev-identity'])
    assert.equal(bound, 1, 'the chain looks the binding up again')
    // the owner declines to retain a binding: its refusal reaches the row
    const declining = fakeOwner({dialogue: false})
    await withOwner(declining, async () => {
      await assert.rejects(() => device({conversation: {project: null, expressionRef: 'expression:bind-2', conversation: null}}).submit([{key: 'bound', value: true}]), /AIKit retained no binding/)
    })
  } finally {
    identity.clearCurrentIdentity()
  }
})

test('the Flow is a clip on the Clip side: its states are a row, read from the owner and the hosted form, never defaulted', () => {
  const flow = central.faces.find(face => face.id === 'flow-document')
  const states = flow.invariant.states
  assert.deepEqual(states, ['draft', 'saved', 'edited since save'])
  const instance = reads => model.centralDevice(flow, reads)
  const stateRow = instance({}).rows.find(row => row.key === 'state')
  assert.deepEqual([stateRow.type, stateRow.values, stateRow.writePath], ['enumerated', states, undefined], 'the declared states, as a reading')
  assert.deepEqual(instance({}).rows.map(row => row.key), ['document', 'revision', 'state'])
  assert.equal(instance({}).values.state, undefined, 'no flow, no state')
  assert.equal(instance({flow: {path: 'Control/user/flows/a.html', revision: REVISION, state: 'saved'}}).values.state, 'saved')
  assert.equal(instance({flow: {path: 'Control/user/flows/a.html', revision: null, state: null}}).values.state, undefined, 'an unknown state is not a value')
  assert.equal(instance({}).submit, undefined, 'a clip has no generating write')
  // the state, from the owner\'s revision and the form\'s own dirty disclosure
  assert.equal(flowClip.flowStateOf(states, null, null), null, 'the owner has not answered: nothing is saved')
  assert.equal(flowClip.flowStateOf(states, REVISION, null), 'saved')
  assert.equal(flowClip.flowStateOf(states, REVISION, 'false'), 'saved')
  assert.equal(flowClip.flowStateOf(states, REVISION, 'true'), 'edited since save')
  assert.equal(flowClip.flowStateOf(['draft'], REVISION, 'true'), null, 'a state the family did not declare is never invented')
  assert.equal(flowClip.flowStateOf(undefined, REVISION, 'true'), null)
})

test('the Flow clip draws its material, revision and state over the hosted form, and keeps the pop-out the device had', () => {
  const location = {schema: 'central.path-ref/v1', ref: 'central:path:/ground:Control/user/flows/mercurius.html', root: '/ground', path: 'Control/user/flows/mercurius.html'}
  const calls = []
  const host = (popped = false) => ({popOut: identity => calls.push(['pop', identity.face]), redock: identity => calls.push(['redock', identity.face]), poppedOut: () => popped})
  const markup = html(createElement(flowClip.CentralFlowClip, {transport, location, deviceWindows: host()}))
  assert.match(markup, /data-central-clip="flow"/)
  for (const key of ['document', 'revision', 'state']) assert.match(markup, new RegExp(`data-param="${key}"|sdk-row__name">${key[0].toUpperCase()}${key.slice(1)}<`), `the ${key} row`)
  assert.match(markup, /data-flow-clip-rows/)
  assert.match(markup, /data-flow-clip-body/)
  assert.match(markup, /Reading the flow instance|Flow document unavailable/, 'the hosted FlowFace is the body, under the same owner')
  assert.match(markup, /data-action="pop-out"(?![^>]*disabled)/, 'the flow is in the aperture, so its pop-out stands')
  assert.match(html(createElement(flowClip.CentralFlowClip, {transport, location, deviceWindows: host(true)})), /data-action="redock"[\s\S]*Popped out/)
  assert.doesNotMatch(html(createElement(flowClip.CentralFlowClip, {transport, location})), /pop-out/, 'no host door: no pop-out')
})

test('the Day die at whole and full is its net over the mockup\'s face list — index, name, role, the open face lit; the compact rack keeps the net alone', () => {
  const reads = {day: {standing: ready, face: 3, revision: REVISION}}
  const die = entries({reads, day: DAY}).find(entry => entry.id === 'central:day-die')
  const faces = markup => [...markup.matchAll(/<button[^>]*data-face="(\d)"[^>]*>/g)].map(match => match[0])
  assert.doesNotMatch(html(die.picture('compact')), /data-die-faces/, 'compact: the net, no list')
  const whole = html(die.picture('whole'))
  assert.equal(faces(whole).length, 6, 'whole: six faces')
  assert.deepEqual(faces(whole).filter(face => face.includes('data-open="true"')).map(face => face.match(/data-face="(\d)"/)[1]), ['3'], 'the open face is the owner\'s: #3, lit')
  assert.match(whole, /<span class="d">3<\/span><span class="n">Pattern<\/span><span class="d">Observations<\/span>/, 'index · name · role, as the mockup\'s .dli')
  assert.match(whole, /class="central-die-net"/, 'the net stays')
  // full, over the hosted form: the list stands above the body
  const full = html(die.picture('full'))
  assert.ok(full.indexOf('data-die-faces') > 0 && full.indexOf('data-die-faces') < full.indexOf('data-document-device="ql-daily-die"'), 'full: the face list above the hosted form')
  // with no Day nothing is lit and no face is pressable
  const bare = html(entries().find(entry => entry.id === 'central:day-die').picture('whole'))
  assert.doesNotMatch(bare, /data-open="true"/)
  assert.equal(faces(bare).filter(face => !face.includes('disabled')).length, 0, 'no Day: every face is dark')
})
