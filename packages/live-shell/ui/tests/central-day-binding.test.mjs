// Lane BC: Central's Day draws the catalogue's Day design (inhabitants/catalogue/panels/day.tsx, `central:day-die`) on Central's own
// readings and writes (central/devices/dayBinding.ts, CentralDevices.tsx). Owners write, faces read: a design key the
// owner reports is a reading, a key no owner reports is absent (never the design's default), a key is written only through an owner
// op — the die's turn (receiving mutate-field) and the person's "Open today" (the `central` op ensure-day), never on a timer.
//
// Channels, each claim carried by one:
// - REAL CAPTURE: the civil-time policy and today's Day reading as `ctrl --json action run central.time.policy '{}'` and
//   `central.day.read '{}'` answered on this machine, 16 Oct 2026 01:18 BST (the Day pointer at 2026-10-13 against a civil 16 Oct);
//   the `stale` state and its words are the kernel's own for that pair (desktop/cradle/kernel/src/central.rs, Request::Inspect).
// - FIXTURE: the ground's other legs (NOW, sources, placement: not read here), a ready Day document, and the owner behind a
//   stubbed kernel bridge that answers inspect, ensure-day and receiving the way the wire does. Never the owner's real ground.
// - SCRIPTED: the production views rendered to static markup (SSR); the runtime's own release path (deviceHost.flushDrafts).
// Not a screen pass: the on-screen legs are the lead's.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'
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

const bind = await import('../src/central/devices/dayBinding.ts')
const writes = await import('../src/central/devices/centralDeviceWrites.ts')
const daySet = await import('../src/central/daySet.ts')
const readings = await import('../src/central/devices/useCentralReadings.ts')
const chain = await import('../src/central/devices/CentralDevices.tsx')
const {day: catalogueDay} = await import('../src/inhabitants/catalogue/panels/day.tsx')
const designs = await import('../src/frame/devices/designs.ts')
const door = await import('../src/frame/devices/deviceDoor.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const {DeviceView, PlacedDevice} = await import('../src/frame/devices/DeviceView.tsx')
const {PlacedDevice: WholePlaced} = await import('../src/frame/devices/DeviceView.tsx')
const wholeDoor = await import('../src/frame/devices/deviceDoor.ts')
/** The selected device's Whole, as its band draws it above the chain (W1, manual §16.7: the pool holds no device; DevicePool retired). */
function WholeBand() {
  const held = wholeDoor.useDeviceDoor()
  const entry = held.selected ? held.device(held.selected) : undefined
  return entry ? createElement(WholePlaced, {device: entry.device, view: 'whole', picture: entry.picture, binding: entry.binding}) : null
}
const {DeviceFullPane} = await import('../src/frame/devices/devicePane.tsx')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {loadWorldShellFamilies} = await import('../src/inhabitants/worldShellFamilies.ts')
const {ownerReadings} = await import('../src/owners/ownerReading.ts')
const {spineEpochKey} = await import('../src/owners/spine.ts')
loadWorldShellFamilies()

const html = element => renderToStaticMarkup(element)
/** Central's Day readings, not handed in (the settings and the moves unread). */
const NO_OWN = {settings: null, settingsRefusal: null, moves: undefined, movesRefusal: null, timezone: null}
const central = inhabitantManifest('central')
const ID = 'central:day-die'
const bridge = {kind: 'bridge', url: 'http://owner.fixture'}
const unavailable = {kind: 'unavailable', reason: 'the test carrier is down'}

// ── REAL CAPTURE (16 Oct 2026 01:18 BST) ────────────────────────────────────────────────────────────────────────────────────────
const TIME = {civil_date: '2026-10-16', local_time: '2026-10-16T01:18:42+01:00', observed_at_unix_seconds: 1792109922,
  policy: {automatic_day_rollover: true, day_boundary_minutes: 0, schema: 'central.civil-time-policy/v1', scope_ref: 'control:root', timezone: 'Europe/London'},
  revision: 'central.content-fnv1a64/v1:741:69da4a44ad65b27f', schema: 'central.civil-time-reading/v1',
  source_ref: 'central:source:control:root:Control/user/civil-time-policy.json', source_revision: 'central.content-fnv1a64/v1:172:45c4df00122ed21d'}
const DAY_13 = {automatic_agent_or_model_invocation: false, content: '', day_ref: 'central:day:control:root:2026-10-13', document: null, document_state: 'uninitialised',
  relations_revision: 'central.content-fnv1a64/v1:146275:54a54c3094faa373', revision: {byte_len: 0, revision: 'central.content-fnv1a64/v1:0:cbf29ce484222325'},
  schema: 'central.day-reading/v1',
  source: {agent_retrieval_allowed: true, path: 'Control/user/day/2026-10-13/day.md', provenance: 'observed', ref: 'central:source:control:root:Control/user/day/2026-10-13/day.md',
    roles: ['human-day', 'personal-human-source-aperture'], standing: 'current-development-state', treatment: 'projectcentral-user'},
  temporal: {civil_date: '2026-10-13', created_at_unix_seconds: 1791846014, day_ref: 'central:day:control:root:2026-10-13', lifecycle: 'open', preexisting_bytes_retained: false,
    project_day_refs: [], schema: 'central.human-day/v1', template_fidelity: 'native-blank-text-not-an-original-HTML-fixture',
    time_policy_ref: 'central:source:control:root:Control/user/civil-time-policy.json', time_policy_revision: 'central.content-fnv1a64/v1:741:69da4a44ad65b27f', timezone: 'Europe/London'},
  today: {civil_date: '2026-10-13', day_ref: 'central:day:control:root:2026-10-13', updated_at_unix_seconds: 1791846014}}
// The kernel's words for this pair (central.rs Request::Inspect).
const STALE_WORDS = 'The native today pointer belongs to an earlier civil Day; its writing is retained'

// ── FIXTURE: the ground's other legs, and a ready Day ───────────────────────────────────────────────────────────────────────────
const leg = action => ({state: 'unavailable', action, error: {message: 'not read in this fixture'}})
const groundOf = (day, time = {state: 'ready', action: 'central.time.policy', data: TIME}) => ({schema: 'oi.central-ground/v1', project: null, time, day,
  now: leg('central.now.list'), sources: leg('projectcentral.change.horizon'), placement: leg('central.work.policy')})
const STALE = groundOf({state: 'stale', action: 'central.day.read', data: DAY_13, error: {message: STALE_WORDS}})

const SOURCE_16 = 'central:source:control:root:Control/user/day/2026-10-16/day.md'
const DOC_16 = 'document:day-2026-10-16'
const PAYLOAD = {meta: {uuid: 'day-uuid', date: '2026-10-16', timezone: 'Europe/London', face: 2, template: 'ql-daily v0.1'},
  fields: {p1_must: [{text: 'a'}], p1_should: [], p1_could: [{text: 'b'}, {text: 'c'}], p3_patterns_noticed: 'one'},
  capture: [{capture: 'x'}, {capture: 'y'}], sessions: [{session: 's'}], completed: [], contributions: []}
const FIELDS = [{id: 'p3_pattern', template_pointer: '/fields/p3_patterns_noticed'}, {id: 'original:meta', template_pointer: '/meta'}]
const documentReading = (payload = PAYLOAD, revision = 'rev-1') => ({schema: 'central.document-reading/v1', source: {ref: SOURCE_16, path: 'Control/user/day/2026-10-16/day.md'},
  revision: {revision}, document_id: DOC_16, document: {document_id: DOC_16, kind: 'day', day_ref: 'central:day:control:root:2026-10-16', fields: FIELDS, template_payload: payload},
  automatic_agent_or_model_invocation: false})
const DAY_16 = {...DAY_13, day_ref: 'central:day:control:root:2026-10-16', document_state: 'ready', document: documentReading(),
  revision: {revision: 'rev-1'}, source: {...DAY_13.source, path: 'Control/user/day/2026-10-16/day.md', ref: SOURCE_16},
  temporal: {...DAY_13.temporal, civil_date: '2026-10-16', day_ref: 'central:day:control:root:2026-10-16'},
  today: {civil_date: '2026-10-16', day_ref: 'central:day:control:root:2026-10-16', updated_at_unix_seconds: 1792110000}}
const READY = groundOf({state: 'ready', action: 'central.day.read', data: DAY_16})
// Today ensured, its document not made yet (T-WORLDS W2: Open today makes it from the Day form).
const POLICY = {state: 'ready', action: 'central.work.policy', data: {revision: 'policy-rev'}}
const UNMADE = {...groundOf({state: 'ready', action: 'central.day.read', data: {...DAY_16, document_state: 'uninitialised', document: null}}), placement: POLICY}

/** The owner behind a stubbed kernel bridge (FIXTURE): it answers `central` inspect from a sequence of grounds, records each
 * ensure-day it is asked, and holds one Day document behind `receiving` (Document, MutateField, CAS-checked). */
function fakeOwner({grounds = [STALE, READY], refuseEnsure = null, now = {}} = {}) {
  const sent = [], ensures = [], initialised = [], closes = []
  let inspected = 0
  const state = {revision: 1, payload: structuredClone(PAYLOAD)}
  const ok = (result, data) => ({json: async () => ({ok: true, outcome: {result, data}})})
  const refused = error => ({json: async () => ({ok: false, error})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'central') {
      if (body.request.kind === 'inspect') return ok('central_reading', grounds[Math.min(inspected++, grounds.length - 1)])
      if (body.request.kind === 'ensure-day') {
        if (refuseEnsure) return refused(refuseEnsure)
        ensures.push(body.request)
        return ok('central_reading', {schema: 'central.day-ensure/v1', day_ref: 'central:day:control:root:2026-10-16'})
      }
      if (body.request.kind === 'initialise-day') { initialised.push(body.request); return ok('central_reading', {schema: 'central.document-create/v1'}) }
      if (body.request.kind === 'close-day') { closes.push(body.request); return ok('central_reading', {schema: 'central.day-reading/v1', day_ref: body.request.day_ref}) }
    }
    // Each register's NOW listing, as the test gives it (your register under `root`).
    if (body.op === 'now') return ok('now_reading', now[body.project ?? 'root'] ?? {schema: 'central.now-listing/v1', automatic_agent_or_model_invocation: false, records: []})
    // The Day form, where Central's file route finds it (flow/documentForms.ts resolveDocumentForm).
    const formAt = {schema: 'central.path-ref/v1', ref: 'central:path:/ground:Work/O-I/desktop/cradle/documents/ql-daily-die.html', root: '/ground', path: 'Work/O-I/desktop/cradle/documents/ql-daily-die.html'}
    if (body.op === 'world_browse') return {json: async () => ({ok: true, outcome: {result: 'world_read', snapshot: {navigator: {root: {control: {agent_wiki: {wiki: {space_ref: 'central:wiki:root'}}},
      work: {projects: [{name: 'O-I', path: 'Work/O-I', projectcentral: {user: {exists: true, path: 'Work/O-I/ProjectCentral/user'}, agent_wiki: {wiki: {space_ref: 'central:wiki:project:O-I'}}}}]}}}}}})}
    if (body.op === 'files_list') return {json: async () => ({ok: true, outcome: {result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: {...formAt, path: body.path},
      entries: [{name: 'ql-daily-die.html', kind: 'file', byte_len: 1, retrieval_allowed: true, location: formAt}]}}})}
    if (body.op === 'file_read') return {json: async () => ({ok: true, outcome: {result: 'file_read', reading: {schema: 'central.file-reading/v1', location: formAt, revision: 'form-rev', content: '<html></html>', byte_len: 13, content_encoding: 'utf-8'}}})}
    if (body.op === 'receiving') {
      const {Document, MutateField} = body.request
      if (Document) return ok('receiving_reading', documentReading(state.payload, `rev-${state.revision}`))
      if (MutateField) {
        if (MutateField.expected_revision !== `rev-${state.revision}`) return refused(`the owner holds rev-${state.revision}; revision ${MutateField.expected_revision} is stale`)
        const field = FIELDS.find(candidate => candidate.id === MutateField.field_id)
        if (!field) return refused(`no field ${MutateField.field_id}`)
        state.payload = {...state.payload, [field.template_pointer.slice(1)]: MutateField.value}
        const previous = `rev-${state.revision}`
        state.revision++
        return ok('receiving_reading', {...documentReading(state.payload, `rev-${state.revision}`), operation_receipt: {status: 'committed', previous_revision: previous, revision: `rev-${state.revision}`}})
      }
    }
    return refused(`unexpected op ${body.op} ${body.request?.kind ?? ''}`)
  }
  return {fetch, sent, ensures, initialised, closes, state, mutations: () => sent.filter(body => body.request?.MutateField).map(body => body.request.MutateField)}
}
async function withOwner(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}

const factsOf = (ground, selected = null) => bind.dayFactsOf({ground, groundError: null, selected})
/** Every key the design reads (its defaults), so a test can say which ones the owner fills and which stay absent. */
const DESIGN_KEYS = Object.keys(catalogueDay.defaults)

// The catalogue's own Day, as the runtime's loader hands it to a published, bound Day (designs.ts requestDesign → the catalogue's
// loadDesign, which is Vite's import.meta.glob and does not run under Node): registered here in the loader's place, unchanged.
designs.registerDesignedDevice(catalogueDay)

// ── the readings ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('REAL CAPTURE — the stale Day pointer: the date is Central\'s civil today, the well is given the owner\'s words, Open today stands, and nothing reads a default', () => {
  const facts = factsOf(STALE)
  const values = bind.dayValuesOf(facts, null)
  assert.equal(values.date, 'Fri 16 Oct', 'the civil date the time policy reads, by its own calendar')
  assert.equal(values.tomorrow, undefined, 'no reading reports tomorrow\'s Day: absent, never a calendar guess')
  assert.equal(values.light, 'dark', 'the owner reports no Day for today: dark, not hollow and not lit')
  assert.equal(values.refusal, `${STALE_WORDS} (Central's Day: Tue 13 Oct; civil today: Fri 16 Oct)`, 'the owner\'s words, and the two dates it compares')
  assert.equal(values.canOpenToday, true, 'the ground panel\'s own rule: the policy answered and the Day is stale')
  assert.equal(values.dayStart, 0, 'the policy\'s day boundary: 00:00')
  assert.equal(values.rollover, 0, 'automatic rollover opens the next Day at the boundary')
  assert.equal(facts.aperture, null, 'no Day document stands, so the die has nothing to turn')
  for (const key of ['face', 'c0', 'c1', 'c1p', 'c2done', 'c2run', 'c2queue', 'c3', 'c3p', 'c4', 'c5']) assert.equal(key in values, false, `${key}: the Day document's, and none stands`)
  for (const key of DESIGN_KEYS) {
    if (key in values) continue
    assert.ok(bind.DAY_ABSENT[key] || bind.dayOwnAbsent(NO_OWN)[key] || ['face', 'c0', 'c1', 'c2done'].includes(key), `${key} is absent with a reason the return names`)
  }
  for (const key of Object.keys(values)) assert.ok(bind.DAY_KEYS.includes(key), `${key} is a key this binding owns a reading for`)
  assert.deepEqual(Object.keys(values).filter(key => key in catalogueDay.defaults && values[key] === catalogueDay.defaults[key] && !['light'].includes(key)), [],
    'no value is the design\'s default (the defaults hold Wed 15 Oct, face 1, Propose, every source on)')
})

test('a ready Day: its face and its records\' counts are the owner\'s; what the owner counts nothing for stays absent', () => {
  const facts = factsOf(READY)
  assert.deepEqual(facts.aperture, {project: null, sourceRef: SOURCE_16, documentId: DOC_16}, 'the aperture the die turns')
  const values = bind.dayValuesOf(facts, {face: 2, payload: PAYLOAD})
  assert.deepEqual({face: values.face, c0: values.c0, c1: values.c1, c2done: values.c2done, light: values.light, refusal: values.refusal, canOpenToday: values.canOpenToday},
    {face: 2, c0: 2, c1: 3, c2done: 1, light: 'lit', refusal: undefined, canOpenToday: false},
    'face 0 the capture rows, face 1 the three tiers, face 2 the sessions ledger; no refusal; nothing to open')
  for (const key of ['c1p', 'c2run', 'c2queue', 'c3', 'c3p', 'c4', 'c5']) assert.equal(key in values, false, `${key}: ${bind.DAY_ABSENT[key]}`)
  assert.deepEqual(bind.dayCountsOf({capture: 'not a list', fields: {p1_must: []}}), {}, 'a record that is not a list gives no count, and one missing tier gives no task count')
  assert.equal(bind.civilDayName('2026-02-29'), null, 'a date the calendar does not hold is no date')
  assert.equal(bind.civilDayName('2026-10-13'), 'Tue 13 Oct')
  assert.equal(bind.nextCivilDate('2026-12-31'), '2027-01-01')
})

test('a Day the person selected: its own date and the owner\'s words for it; Open today still answers to today\'s ground', () => {
  const standing = {state: 'uninitialised', dayRef: 'central:day:control:root:2026-10-06', civilDate: '2026-10-06', owner: 'Central (root register)', op: 'central · initialise-day',
    remedy: 'r', message: 'Current Day has no native document yet.'}
  const values = bind.dayValuesOf(factsOf(STALE, {standing, aperture: null}), null)
  assert.equal(values.date, 'Tue 6 Oct')
  assert.equal(values.refusal, 'Current Day has no native document yet.')
  assert.equal(values.canOpenToday, true)
  assert.equal('face' in values, false)
  const unread = bind.dayFactsOf({ground: null, groundError: 'the kernel carrier is unavailable: down', selected: null})
  assert.equal(unread.civilDate, null, 'no ground: no date, so no binding stands (the design would draw its date as missing words)')
  assert.match(unread.refusal, /did not answer: the kernel carrier is unavailable/)
})

// ── the writes, through the runtime's release, against the fixture owner ──────────────────────────────────────────────────────

const bindingOf = (ground, owner, extra = {}) => {
  const facts = factsOf(ground)
  return bind.dayDesignBinding(ID, facts, bind.dayValuesOf(facts, extra.document ?? null), {
    turn: (aperture, face) => writes.turnDieFace(bridge, aperture, face).then(() => {}),
    openToday: () => writes.openToday(bridge).then(() => {}),
  })
}

test('Open today is the person\'s press: on release one ensure-day goes to Central with the policy\'s revision; a Day already current is not ensured twice', async () => {
  const owner = fakeOwner({grounds: [STALE, READY]})
  const binding = bindingOf(STALE, owner)
  assert.equal(binding.writes('openToday'), true)
  host.resetHost(ID)
  await withOwner(owner, async () => {
    host.setDraft(ID, 'openToday', true)
    assert.equal(owner.sent.length, 0, 'nothing is sent while the hand holds it')
    assert.equal(await host.flushDrafts(binding, 0), null, 'the owner took it')
  })
  assert.deepEqual(owner.ensures, [{kind: 'ensure-day', expected_time_policy_revision: TIME.revision}], 'one ensure, under the time policy the owner read')
  assert.deepEqual(owner.sent.map(body => body.request.kind), ['inspect', 'ensure-day', 'inspect'],
    'the ground read again first, then the ensure, then read again: today\'s Day has its document, so nothing more')
  // The owner now holds today's Day: a second press reads the ground and ensures nothing.
  await withOwner(owner, () => writes.openToday(bridge).then(result => assert.deepEqual(result, {ensured: false, initialised: false, carried: null})))
  assert.equal(owner.ensures.length, 1)
  host.resetHost(ID)
})

test('Open today refused: the owner\'s words come back through the runtime to the Info line, and nothing is ensured without a policy', async () => {
  const owner = fakeOwner({grounds: [STALE], refuseEnsure: 'Central refused ensure: the native authority is missing'})
  const binding = bindingOf(STALE, owner)
  host.resetHost(ID)
  await withOwner(owner, async () => {
    host.setDraft(ID, 'openToday', true)
    assert.match(await host.flushDrafts(binding, 0), /native authority is missing/, 'the owner\'s refusal, verbatim')
  })
  assert.equal(host.hostState(ID).refused.openToday.reason.includes('native authority'), true, 'the control returns to the owner\'s value and says why')
  const noTime = fakeOwner({grounds: [groundOf(STALE.day, {state: 'failed', action: 'central.time.policy', error: {message: 'policy unreadable'}})]})
  await withOwner(noTime, async () => {
    await assert.rejects(() => writes.openToday(bridge), /civil time is failed: policy unreadable; the current Day cannot be ensured/)
  })
  assert.deepEqual(noTime.sent.map(body => body.request.kind), ['inspect'], 'no ensure without the policy\'s revision')
  await assert.rejects(() => binding.write([{key: 'openToday', value: false}]), /a press/, 'nothing here un-ensures or closes a Day')
  host.resetHost(ID)
})

test('the die turns through the owner\'s mutate-field on the ready Day; with no Day document the turn is refused in the owner\'s words, and nothing is sent', async () => {
  const owner = fakeOwner()
  const ready = bindingOf(READY, owner, {document: {face: 2, payload: PAYLOAD}})
  host.resetHost(ID)
  await withOwner(owner, async () => {
    host.setDraft(ID, 'face', 4)
    assert.equal(await host.flushDrafts(ready, 0), null)
  })
  const [write] = owner.mutations()
  assert.equal(owner.mutations().length, 1)
  assert.deepEqual([write.source_ref, write.document_id, write.expected_revision, write.field_id, write.value.face], [SOURCE_16, DOC_16, 'rev-1', 'original:meta', 4])
  assert.equal(owner.state.payload.meta.face, 4, 'the owner holds the turned die')
  host.resetHost(ID)
  const none = fakeOwner()
  const stale = bindingOf(STALE, none)
  await withOwner(none, async () => {
    host.setDraft(ID, 'face', 3)
    assert.match(await host.flushDrafts(stale, 0), /The native today pointer belongs to an earlier civil Day/, 'the well\'s words, on the Info line')
  })
  assert.equal(none.sent.length, 0, 'no aperture: the owner is not asked')
  host.resetHost(ID)
})

test('every other key of the design is a reading, or a setting of Central\'s that waits for its reading: the runtime sends nothing', async () => {
  const owner = fakeOwner()
  const binding = bindingOf(STALE, owner)
  for (const key of ['dayStart', 'template', 'view', 'date']) assert.equal(binding.writes(key), false, key)
  // REPLACED (W2): the Day's own settings write central.day.settings.write on the revision their reading gives (central-person-writes.test.mjs);
  // with no reading of them handed in, each stands closed saying so, and a write is refused in those words.
  for (const key of ['agentWrites', 'rollover', 'closeRoutine', 'src_live']) {
    assert.equal(binding.writes(key), true, key)
    assert.match(binding.standing[key].disabled, /Central's Day settings have not answered yet, and central\.day\.settings\.write is checked against the revision they give/, key)
  }
  host.resetHost(ID)
  await withOwner(owner, async () => {
    host.setDraft(ID, 'agentWrites', 'write')
    assert.match(await host.flushDrafts(binding, 0), /central\.day\.settings\.write/)
  })
  assert.equal(owner.sent.length, 0)
  host.resetHost(ID)
})

// ── the five views, hosted by the runtime on this binding ─────────────────────────────────────────────────────────────────────

const input = (extra = {}) => ({transport: unavailable, faces: central.faces, manifest: central, reads: {}, day: null, conversation: null, flow: null, impact: null, deviceWindows: null, ...extra})
const dayEntryOf = (facts, extra = {}) => chain.centralDeviceEntries(input({reads: {day: {standing: facts.standing, face: null, revision: null}}, day: facts.aperture, dayStanding: facts.standing, ...extra}))
  .find(entry => entry.id === ID)

/** The Day published as the chain publishes it (CentralDevices.tsx centralPublication): its picture, its marks, its binding and its
 * own Full. */
function hosting(facts, values, run, extra = {}) {
  const entry = dayEntryOf(facts, extra)
  const binding = bind.dayDesignBinding(ID, facts, values, {turn: async () => {}, openToday: async () => {}})
  door.publishDevice(ID, chain.centralPublication(entry, binding))
  try { return run(entry, binding) } finally { door.publishDevice(ID, null); door.selectDevice(null); host.resetHost(ID) }
}

test('the Day draws its catalogue design on the chain, in the pool, on the rail and folded — on the stale ground\'s own values', () => {
  const facts = factsOf(STALE)
  hosting(facts, bind.dayValuesOf(facts, null), (entry, binding) => {
    const compact = html(createElement(DeviceView, {device: entry.device, size: 'compact', picture: entry.picture('compact'), binding}))
    assert.match(compact, /data-device-design="central:day-die"/, 'the design draws, not the generic plate')
    assert.match(compact, /<span class="dp-display-corner">Fri 16<\/span>/, 'the date in the well\'s corner')
    assert.doesNotMatch(compact, /Wed 15|Thu 16 Oct/, 'never the design\'s fixture dates')
    assert.doesNotMatch(compact, /aria-checked="true" aria-label="\d /, 'no face of the net is open: no Day document stands')
    assert.match(compact, /aria-label="Face"[^>]*aria-valuetext="no reading"/, 'the Face dial: no reading, drawn "—"')
    door.selectDevice(ID)
    const whole = html(createElement(WholeBand))
    assert.match(whole, /data-device-design="central:day-die"/)
    assert.match(whole, /role="tab" aria-selected="true">Fri 16<\/button>/, 'the page: today, by the owner\'s civil date')
    assert.doesNotMatch(whole, /Sat 17<\/button>/, 'no tomorrow page while no reading reports tomorrow\'s Day')
    // The manual (§18.2): the day's bounds are Central's readings, drawn as readings; no hours are set on the Day.
    assert.match(whole, /<output class="dp-readout-value">00:00<\/output><span class="dp-label">closes<\/span>/, 'the policy\'s boundary, read')
    assert.match(whole, /<output class="dp-readout-value">00:00<\/output><span class="dp-label">opens tomorrow<\/span>/, 'automatic rollover, read')
    assert.doesNotMatch(whole, /aria-label="(Day start|Rollover|Runs at)"/, 'no time control')
    const widget = html(createElement(PlacedDevice, {device: entry.device, view: 'widget', picture: entry.picture, binding}))
    assert.match(widget, /aria-label="Day · Fri 16"/, 'the widget, titled by the owner\'s date')
    assert.match(widget, /<output class="dp-readout-value">—<\/output><span class="dp-label">tasks/, 'a count no owner reports is "—", never zero')
    host.setHostFolded(ID, true)
    assert.match(html(createElement(DeviceView, {device: entry.device, size: 'compact', picture: entry.picture('compact'), binding})), /dp-folded-reading">Fri 16<[\s\S]*dp-folded-reading">Face —</, 'folded: the date, and no face')
  })
})

test('Full is the Day\'s page as the owner stands it — the owner\'s words while no Day stands, the hosted form when one does — and no plate controls', () => {
  const stale = factsOf(STALE)
  hosting(stale, bind.dayValuesOf(stale, null), () => {
    const pane = html(createElement(DeviceFullPane, {id: ID}))
    assert.match(pane, /data-device-design="central:day-die"/)
    assert.match(pane, /data-central-absence="refused"/, 'the Day pane\'s own absence')
    assert.match(pane, /The native today pointer belongs to an earlier civil Day/, 'in the owner\'s words')
    assert.doesNotMatch(pane, /<iframe|data-param=|role="slider"/, 'no blank template, no controls in the pane')
  })
  const ready = factsOf(READY)
  hosting(ready, bind.dayValuesOf(ready, {face: 2, payload: PAYLOAD}), () => {
    const pane = html(createElement(DeviceFullPane, {id: ID}))
    assert.match(pane, /data-document-device="ql-daily-die"/, 'the Day die\'s hosted form, as the device pane drew it before')
    assert.doesNotMatch(pane, /data-die-faces/, 'the face list that stood over it is gone: the Face dial in Device view turns the die')
  })
})

test('the five views move together: the hand\'s face shows in every view at once, and the owner\'s face stands in each', () => {
  const ready = factsOf(READY)
  hosting(ready, bind.dayValuesOf(ready, {face: 2, payload: PAYLOAD}), (entry, binding) => {
    const views = () => [
      html(createElement(DeviceView, {device: entry.device, size: 'compact', picture: entry.picture('compact'), binding})),
      (door.selectDevice(ID), html(createElement(WholeBand))),
      html(createElement(PlacedDevice, {device: entry.device, view: 'widget', picture: entry.picture, binding})),
    ]
    for (const markup of views()) assert.match(markup, /aria-checked="true" aria-label="2 Operation"/, 'the owner\'s open face, 2, in the net of every view')
    // The manual (§18.2 Compact): a reading under the net says when tomorrow opens, Central's bound (automatic rollover at 00:00 here).
    assert.match(views()[0], /<text[^>]*>tomorrow opens (?:<!-- -->)?00:00<\/text>/, 'compact reads when tomorrow opens')
    assert.match(views()[1], /aria-label="Face"[^>]*aria-valuenow="2"/, 'the whole Face dial reads 2')
    assert.match(views()[0], />2</, 'face 0: two capture rows')
    host.setDraft(ID, 'face', 5)
    for (const markup of views()) assert.match(markup, /aria-checked="true" aria-label="5 Synthesis"/, 'the hand\'s draft, in every view at once')
    host.setHostFolded(ID, true)
    assert.match(html(createElement(DeviceView, {device: entry.device, size: 'compact', picture: entry.picture('compact'), binding})), /Face 5/, 'folded too')
  })
})

// ── the chain reads today on its own, from the window's one ground answer ─────────────────────────────────────────────────────

test('with no Day selected the Day device stands on today as Central\'s ground reads it — one shared answer, no Day lifecycle read or written', async () => {
  const epoch = spineEpochKey(0, null)
  const owner = fakeOwner({grounds: [STALE]})
  await withOwner(owner, () => ownerReadings.entry(readings.groundKey(bridge), readings.readGroundOf(bridge)).ensure(epoch))
  assert.deepEqual(owner.sent.map(body => [body.op, body.request.kind]), [['central', 'inspect']], 'one read: the ground')
  function Probe() {
    const device = chain.useDayDevice(bridge, null)
    return createElement('pre', null, JSON.stringify({values: device.binding?.values ?? null, writes: device.binding ? ['face', 'openToday', 'rollover'].map(key => device.binding.writes(key)) : null}))
  }
  const read = JSON.parse(html(createElement(Probe)).replace(/^<pre>|<\/pre>$/g, '').replace(/&quot;/g, '"'))
  assert.equal(read.values.date, 'Fri 16 Oct')
  assert.equal(read.values.canOpenToday, true)
  assert.match(read.values.refusal, /earlier civil Day/)
  assert.deepEqual(read.writes, [true, true, true], 'Rollover goes to the binding, which refuses it naming the person\'s route')
  // The chain's own plate: the binding stands as soon as the ground answers (no shell design to wait for), so the Day's design draws
  // on today's date, the light off.
  const markup = html(createElement(chain.CentralDevicesChain, {transport: bridge, dayStanding: null}))
  // The Day closes the Main track's chain; the workspace's chain follows it (R4: the Answer no longer stands after it).
  const day = markup.slice(markup.indexOf(`data-device="${ID}"`), markup.indexOf('data-track="workspace"'))
  assert.match(day, /data-device-light="off"/, 'the owner says no Day stands for today: off')
  assert.match(day, /data-device-design="central:day-die"/, 'the design draws on the chain')
  assert.match(day, /<span class="dp-display-corner">Fri 16<\/span>/, 'on civil today')
  assert.equal(owner.sent.length, 1, 'rendering asked the owner nothing more: no ensure, no close, no lifecycle')
})

test('the Day design is the catalogue\'s own in all five views; its Full is the Day\'s page, published with the device (MOVED: dayDesign.tsx → PublishedDevice.full)', async () => {
  assert.equal(designs.designFor(ID), catalogueDay, 'the runtime draws the catalogue\'s own Day')
  assert.equal(existsSync(new URL('../src/central/devices/dayDesign.tsx', import.meta.url)), false, 'the shell\'s Day design is gone')
  const facts = factsOf(STALE)
  const entry = dayEntryOf(facts)
  const published = chain.centralPublication(entry, null)
  assert.equal(typeof published.full.draw, 'function', 'the Day carries its own Full')
  assert.match(html(published.full.draw()), /data-central-absence="refused"/, 'its page as the owner stands it')
  for (const other of chain.centralDeviceEntries(input()).filter(candidate => candidate.id !== ID)) assert.equal(chain.centralPublication(other, null).full, undefined, `${other.id}: its design's Full`)
  const source = await readFile(new URL('../src/central/devices/CentralDevices.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /DayDieNet|DieFaceList|\/dayDesign'|registerDesignedDevice/, 'the net and face list the design replaces are not drawn, and the shell stands no Day of its own')
})

test('the Day\'s designed head carries the door\'s ↗ — its own window (R1) — and no native pop-out of the chain\'s (REPLACED: the face\'s pop-out and redock marks, R4)', () => {
  const ready = factsOf(READY)
  const windows = popped => ({popOut() {}, redock() {}, poppedOut: () => popped})
  hosting(ready, bind.dayValuesOf(ready, {face: 2, payload: PAYLOAD}), (entry, binding) => {
    const compact = html(createElement(DeviceView, {device: entry.device, size: 'compact', picture: entry.picture('compact'), binding, marks: entry.marks}))
    assert.match(compact, /data-device-design="central:day-die"/, 'the design draws')
    assert.match(compact, /<span class="dp-head-x">[\s\S]*class="dp-full dp-popout" aria-label="Pop Day out into its own window"/, 'the door\'s ↗ stands alone in the head')
    assert.doesNotMatch(compact, /data-action="(?:pop-out|redock)"/, 'no native pop-out mark of the chain\'s own')
  }, {deviceWindows: windows(false), manifest: central})
  hosting(ready, bind.dayValuesOf(ready, {face: 2, payload: PAYLOAD}), (entry, binding) => {
    assert.doesNotMatch(html(createElement(DeviceView, {device: entry.device, size: 'compact', picture: entry.picture('compact'), binding, marks: entry.marks})), /data-action="redock"/)
  }, {deviceWindows: windows(true), manifest: central})
})

test('Open today makes today\'s document from the Day form when it has none: initialise-day, with the form\'s revision and the placement policy\'s (T-WORLDS W2)', async () => {
  const owner = fakeOwner({grounds: [UNMADE]})
  await withOwner(owner, () => writes.openToday(bridge).then(result => assert.deepEqual(result, {ensured: false, initialised: true, carried: null})))
  assert.equal(owner.ensures.length, 0, 'today is current: nothing is ensured')
  assert.equal(owner.initialised.length, 1)
  const [made] = owner.initialised
  assert.equal(made.day_ref, 'central:day:control:root:2026-10-16')
  assert.equal(made.expected_revision, 'rev-1'); assert.equal(made.expected_policy_revision, 'policy-rev'); assert.equal(made.expected_form_revision, 'form-rev')
  assert.equal(made.form.path, 'Work/O-I/desktop/cradle/documents/ql-daily-die.html', 'the roster\'s own Day form, read through Central\'s file route')
  assert.match(made.document_id, /^document:/)
})

test('today\'s set is kept in the Day: a world brought in is written through the Day\'s own meta field on the revision read; the same set writes nothing', async () => {
  const owner = fakeOwner({grounds: [READY]})
  const day = {project: null, sourceRef: SOURCE_16, documentId: DOC_16}
  await withOwner(owner, async () => {
    const first = await daySet.writeDaySet(bridge, day, set => daySet.withWorld(set, 'central:wiki:project:O-I', 'O-I'))
    assert.deepEqual(first, {revision: 'rev-2', wrote: true})
    const again = await daySet.writeDaySet(bridge, day, set => daySet.withWorld(set, 'central:wiki:project:O-I', 'O-I'))
    assert.equal(again.wrote, false, 'a world already in the set is not written twice')
  })
  const [write] = owner.mutations()
  assert.equal(write.field_id, 'original:meta'); assert.equal(write.expected_revision, 'rev-1')
  assert.deepEqual(write.value.set, {schema: 'oi.day-set/v1', tracks: [{world: 'central:wiki:project:O-I', name: 'O-I'}], rows: []})
  assert.equal(write.value.face, 2, 'the rest of the Day\'s meta stands as it was')
  assert.deepEqual(daySet.daySetOf(owner.state.payload).tracks, [{world: 'central:wiki:project:O-I', name: 'O-I'}])
})

// ── The close, and what it carries (manual §18.1 "What carries to tomorrow"; §18.2 "Close now"; T-WORLDS W2 "The close carries") ────
const PAGE = path => `central:path:/ground:${path}`
const PLAYS_OI = PAGE('Work/O-I/ProjectCentral/user/beings-1.html')
const PLAYS_MINE = PAGE('Control/user/flows/flow-1.html')
const STOPPED = PAGE('Work/O-I/ProjectCentral/user/things-1.html')
const SET_15 = {schema: 'oi.day-set/v1', tracks: [{world: 'central:wiki:project:O-I', name: 'O-I'}, {world: 'central:wiki:project:Old', name: 'Old'}],
  rows: [{id: 'r1', name: 'Morning', pages: [PLAYS_OI, STOPPED]}, {id: 'r2', name: 'Stopped', pages: [STOPPED]}], lineage: ['central:day:control:root:2026-10-14']}
// The 15th's Day, closed, its document keeping the set (the ground's check: the document's revision and Day are the Day's own).
const DOC_15 = documentReading({...PAYLOAD, meta: {...PAYLOAD.meta, date: '2026-10-15', set: SET_15}}, 'rev-15')
const DAY_15_CLOSED = {...DAY_16, day_ref: 'central:day:control:root:2026-10-15', revision: {revision: 'rev-15'},
  document: {...DOC_15, document: {...DOC_15.document, day_ref: 'central:day:control:root:2026-10-15'}},
  temporal: {...DAY_16.temporal, civil_date: '2026-10-15', day_ref: 'central:day:control:root:2026-10-15', lifecycle: 'closed'}}
const CLOSED_15 = groundOf({state: 'stale', action: 'central.day.read', data: DAY_15_CLOSED, error: {message: STALE_WORDS}})
const clearing = (nowRef, page, lifecycle) => ({now_ref: nowRef, task_ref: `oi:page:${page}`, lifecycle, created_at_unix_seconds: 1792000000,
  scope_ref: 'control:root', purpose: `A page is open: ${page}`, source_refs: [], participant_refs: [], work_refs: []})
const listing = records => ({schema: 'central.now-listing/v1', automatic_agent_or_model_invocation: false, records})
const NOW_PLAYING = {root: listing([clearing('now:mine', PLAYS_MINE, 'active')]),
  'O-I': listing([clearing('now:oi', PLAYS_OI, 'active'), clearing('now:stopped', STOPPED, 'closed')])}

test('what still plays carries into tomorrow\'s set: the worlds holding a playing page, each row with only its playing pages, the closed Day in the lineage', () => {
  const worldOf = ref => ref.includes('Work/O-I/') ? {ref: 'central:wiki:project:O-I', name: 'O-I'} : ref.includes('Control/user/flows/') ? {ref: 'central:wiki:root', name: 'Your world', yours: true} : null
  const next = daySet.carriedSet(SET_15, 'central:day:control:root:2026-10-15', [PLAYS_OI, PLAYS_MINE], worldOf)
  assert.deepEqual(next, {schema: 'oi.day-set/v1', tracks: [{world: 'central:wiki:project:O-I', name: 'O-I'}],
    rows: [{id: 'r1', name: 'Morning', pages: [PLAYS_OI]}], lineage: ['central:day:control:root:2026-10-14', 'central:day:control:root:2026-10-15']},
    'Old holds nothing that plays and leaves; the stopped page leaves its row, and a row left empty goes; your world is every set\'s first track, never named')
  assert.deepEqual(daySet.carriedSet({...SET_15, tracks: []}, 'd', [PLAYS_OI], worldOf).tracks, [{world: 'central:wiki:project:O-I', name: 'O-I'}],
    'a world the closed set did not hold comes in when a page of it still plays')
  assert.deepEqual(daySet.daySetOf({meta: {set: next}}).lineage, next.lineage, 'the lineage reads back as written')
})

test('Close now closes the Day Central names on both of its revisions; a closed Day, or one you selected, offers no close, and nothing is sent', async () => {
  const owner = fakeOwner({grounds: [READY]})
  await withOwner(owner, () => writes.closeDay(bridge).then(result => assert.deepEqual(result, {closed: 'central:day:control:root:2026-10-16', civilDate: '2026-10-16'})))
  assert.deepEqual(owner.closes, [{kind: 'close-day', day_ref: 'central:day:control:root:2026-10-16', expected_revision: 'rev-1', expected_relations_revision: DAY_13.relations_revision}])
  const closedOwner = fakeOwner({grounds: [CLOSED_15]})
  await withOwner(closedOwner, () => assert.rejects(writes.closeDay(bridge), /closed already/))
  assert.equal(closedOwner.closes.length, 0)
  assert.equal(factsOf(READY).canClose, true)
  assert.equal(factsOf(STALE).canClose, true, 'an earlier Day still open is closed after its boundary')
  assert.equal(factsOf(CLOSED_15).canClose, false)
  assert.equal(factsOf(READY, {standing: null, aperture: null}).canClose, false, 'a Day you selected is never the one closed')
  assert.equal(bind.dayValuesOf(factsOf(READY), null).canClose, true, 'the design reads it as canClose')
})

test('Open today after a closed Day: today\'s Day is made, and what still plays is carried into its set through the Day\'s own meta', async () => {
  const owner = fakeOwner({grounds: [CLOSED_15, UNMADE, READY], now: NOW_PLAYING})
  const result = await withOwner(owner, () => writes.openToday(bridge))
  assert.deepEqual(result, {ensured: true, initialised: true, carried: {from: 'central:day:control:root:2026-10-15', worlds: 1, rows: 1, pages: 2}})
  const [write] = owner.mutations()
  assert.equal(write.field_id, 'original:meta')
  assert.deepEqual(daySet.daySetOf(owner.state.payload), {schema: 'oi.day-set/v1', tracks: [{world: 'central:wiki:project:O-I', name: 'O-I'}],
    rows: [{id: 'r1', name: 'Morning', pages: [PLAYS_OI]}], lineage: ['central:day:control:root:2026-10-14', 'central:day:control:root:2026-10-15']})
  assert.deepEqual(owner.sent.filter(body => body.op === 'now').map(body => body.project), [null, 'O-I'], 'NOW is read at your register and at each project world the closed set held')
  const open = fakeOwner({grounds: [STALE, UNMADE, READY], now: NOW_PLAYING})
  const plain = await withOwner(open, () => writes.openToday(bridge))
  assert.equal(plain.carried, null, 'an earlier Day never closed carries nothing'); assert.equal(open.mutations().length, 0)
})

test('the Day publishes its page as its own Full, and names it as data for its Pop-out: its aperture, never a drawing (r23)', () => {
  const aperture = {project: null, sourceRef: 'central:source:control:root:Control/user/day/2026-10-19/day.md', documentId: 'day-doc'}
  const entry = chain.centralDeviceEntries(input({day: aperture})).find(item => item.id === ID)
  assert.deepEqual(entry.fullRelay, {kind: chain.DAY_PAGE_RELAY, data: aperture})
  const published = chain.centralPublication(entry, null)
  assert.equal(typeof published.full.draw, 'function', 'the main window draws the page itself')
  assert.deepEqual(published.full.relay, {kind: 'central:day-page', data: aperture}, 'and names it for the second window')
  const none = chain.centralDeviceEntries(input()).find(item => item.id === ID)
  assert.equal(none.fullRelay, undefined, 'no Day document stands: nothing to relay')
  assert.equal(chain.centralPublication(none, null).full.relay, undefined)
})

// The Day's moves (manual §18.2, O-I main 1fd6697c0): five pads move the day's work from face to face. Close is Close now. REPLACED
// (T-COVERAGE §1.3): the moves' settings and runs are Central's readings (central.day.settings.read, central.day.moves.read — the REAL
// shapes are proved in stale-refusals-binding.test.mjs); with neither read, every reading of a move is absent with that reason, and the
// pads, every Runs at and Prompt, and Agent writes stand closed naming the route they wait on. Faces 2 and 4 still wait on the
// machines' NOWs (Workcell #72, ai-kit #275).
test('the moves: with Central\'s Day readings not read, every reading of a move is absent with that reason, never the design\'s sample', () => {
  const facts = factsOf(READY)
  const values = bind.dayValuesOf(facts, {face: 2, payload: PAYLOAD})
  const moveKeys = DESIGN_KEYS.filter(key => /^(at|prompt|last|gave|running)_/.test(key))
  assert.deepEqual([...new Set(moveKeys.map(key => key.split('_')[1]))], ['tasks', 'patterns', 'context', 'synthesis', 'close'], 'the design reads the five moves')
  const why = bind.dayOwnAbsent(NO_OWN, values)
  for (const key of moveKeys) {
    assert.equal(key in values, false, `${key}: no owner reading was handed in`)
    assert.match(why[key] ?? '', /central\.day\.(settings|moves)\.read/, `${key} names the reading it waits on`)
  }
  assert.match(bind.DAY_ABSENT.c2run, /every machine's NOW and its child NOWs.*Workcell #72.*ai-kit #275/, 'face 2 waits on the machines\' NOWs')
  assert.match(bind.DAY_ABSENT.c4, /each entry with its author/, 'face 4 gathers what the sessions touched, each with its author')
})

test('the moves: with Central\'s readings not handed in, every Runs at, Prompt and Agent writes stand closed saying why; the pads press on the Day shown', async () => {
  let wrote = 0
  const facts = factsOf(READY)
  const begun = []
  const binding = bind.dayDesignBinding(ID, facts, bind.dayValuesOf(facts, {face: 2, payload: PAYLOAD}),
    {turn: async () => { wrote++ }, openToday: async () => { wrote++ }, closeNow: async () => { wrote++ }, begin: async (move, ref) => { begun.push([move, ref]) }})
  // REPLACED (W2): a pad records its move's begin through central.day.move.record on the Day shown (central-person-writes.test.mjs).
  for (const move of ['tasks', 'patterns', 'context', 'synthesis']) assert.equal(binding.standing[`run_${move}`], undefined, `the ${move} pad presses`)
  await binding.write([{key: 'run_tasks', value: true}])
  assert.deepEqual(begun, [['tasks', 'central:day:control:root:2026-10-16']])
  for (const move of ['tasks', 'patterns', 'context', 'synthesis', 'close']) {
    assert.match(binding.standing[`at_${move}`]?.disabled ?? '', /central\.day\.settings\.write is checked against/, `${move}'s Runs at stands closed until the settings answer`)
    assert.match(binding.standing[`prompt_${move}`]?.disabled ?? '', /central\.day\.settings\.write is checked against/, `${move}'s Prompt stands closed until the settings answer`)
  }
  assert.match(binding.standing.agentWrites?.disabled ?? '', /have not answered yet/)
  assert.equal(binding.standing.run_close, undefined, 'the Close pad is Close now, which an owner takes')
  assert.equal(binding.standing.closeNow, undefined)
  assert.equal(wrote, 0, 'nothing else was sent to an owner')
})

test('the design: the Close pad presses Close now, the one move an owner takes; the other four press their own move', async () => {
  const source = await readFile(new URL('../src/inhabitants/catalogue/panels/day.tsx', import.meta.url), 'utf8')
  assert.match(source, /\{id: 'close', name: 'Close', faces: '5 → 0′', face: 0, press: 'closeNow'/)
  for (const move of ['tasks', 'patterns', 'context', 'synthesis']) assert.match(source, new RegExp(`id: '${move}'[^}]*press: 'run_${move}'`))
  // The manual (§18.2, §10.10): no pad keeps a time. A move wanted at a set time is a routine in Settings, Automations; Close runs by
  // itself when the day closes, at Central's bound, which the Day reads and never sets.
  assert.deepEqual(Object.keys(catalogueDay.defaults).filter(key => /^at_/.test(key)), [], 'no move keeps a time of its own')
  assert.doesNotMatch(source, /label="(Runs at|Day start|Rollover)"/, 'the Day draws no time control')
})
