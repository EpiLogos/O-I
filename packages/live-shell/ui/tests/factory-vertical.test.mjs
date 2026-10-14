// The Factory vertical, scripted (WORLD-SHELL-DESIGN §17.1; DLW-PLAN Phase 3):
// one selected Factory run recovered through each projection on its own ref —
// select a run → its subject in the Earth → its moment on the Timeline → its
// subject in the Constellation → its Expression → its devices and files —
// with identity asserted at every step, then repeated with the Earth unmounted,
// an occupant change, and a retained occasion.
//
// Channels (every claim below is labelled by the one that carries it):
// - SHAPE (placeholder-valued): tests/fixtures/factory-vertical/*.placeholder.json are the owner's
//   `factory.inhabitation-reading/v1` and `factory.attempt-return-reading/v1` shapes with neutral
//   values (see the folder's README.md). The key sets of the Return and of the occupant body are
//   checked against the real capture desktop/cradle/tests/fixtures/factory-live-events.json.
// - REAL OWNER READER: the desk's inhabitation adapter `runInhabitationView` runs on the shape
//   fixture, so the claim that the desk's view keeps the owner's full custody ref (the tail is a
//   display label) is measured, not assumed; the join reads that view and matches the raw row.
// - FIXTURE: the temporal event, the atlas occurrences and the agency tracks are built here. The
//   event is shaped as desktop/cradle/kernel/src/temporal_sources.rs `history_entry_to_event`
//   would map an aikit-history `procedure` entry whose subject is the run; no kernel read is made.
// - SOURCE: the seam sentences name the owner, op and remedy read from the source (factoryVertical.ts).
// What is NOT claimed: no live Factory agent ran; no owner read was invoked; the native walk
// (computer use) is open. The Earth and Timeline states of the REAL state (unmounted Earth, no Factory
// stream) are scripted as reported by the source reading, not observed in a running shell.
// The React face (FactoryRunJoin.tsx) is checked by tsc, not here.

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production modules in memory (the central-vertical pattern): .ts/.tsx transpiled, CSS stubbed.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const join = await import('../src/factory/factoryVertical.ts')
const runTrack = await import('../src/timeline/runTrackAdapter.ts')
const model = await import('../../../../desktop/cradle/src/contributions/factory/inhabitation/model.ts')

const FIXTURES = new URL('./fixtures/factory-vertical/', import.meta.url)
const shape = async (name) => JSON.parse(await readFile(new URL(name, FIXTURES), 'utf8'))

const inhabitation = await shape('inhabitation.placeholder.json')
const attemptReturn = await shape('attempt-return.placeholder.json')
const realCapture = JSON.parse(await readFile(new URL('../../../../desktop/cradle/tests/fixtures/factory-live-events.json', import.meta.url), 'utf8'))

const RUN = inhabitation.runs[0].run_ref
const PROJECT = inhabitation.project_ref
const SUBJECT = 'central:path:Control:agents/now/placeholder-subject.md'
const ARTIFACT = 'central:path:Control:agents/now/placeholder-artifact.md'
const SURVEY = 'attempt:placeholder-survey-1'
const REVIEW = 'attempt:placeholder-review-1'
const SESSION = 'agent-session/placeholder-survey'

// ---------------------------------------------------------------------------
// the shape against the owner's real capture

test('SHAPE: the Return and the occupant body keep the owner\'s key sets (real capture cross-check)', () => {
  const realReturn = realCapture.attemptReadings.flatMap(reading => reading.attempts).find(item => item.readableReturn).readableReturn
  assert.deepEqual(Object.keys(attemptReturn.attempt.record.readableReturn).sort(), Object.keys(realReturn).sort(),
    'the placeholder Return carries the same readableReturn keys as the captured Return')
  const occupant = inhabitation.runs[0].occupants[0].body
  assert.ok(occupant.agent_session_ref.state === 'present' && typeof occupant.agent_session_ref.value === 'string',
    'a session facet is present with a value, the form model.ts reads')
})

// ---------------------------------------------------------------------------
// the desk's view and the owner's raw row: the full World object ref

test('REAL OWNER READER: the desk view keeps the full custody ref beside its tail label; the join reads the view and agrees with the raw row', () => {
  const view = model.runInhabitationView({state: 'read', data: inhabitation, source: 'shape'}, RUN)
  assert.equal(view.positions[0].custody[0].workRef, SUBJECT, 'runInhabitationView keeps the owner\'s full work_ref as the identity')
  assert.equal(view.positions[0].custody[0].work, 'placeholder-subject.md', 'the tail is a display label only')
  const positions = join.positionsOfRaw(inhabitation.runs[0])
  assert.equal(positions[0].custody[0].work, SUBJECT, 'the raw row carries the full central:path ref')
  assert.deepEqual(join.positionsOfView(view), positions, 'the join reads the view: the same Positions, custody refs and sessions as the raw row')
  const viewOccupants = join.occupantsOfView(view)
  const rawOccupants = join.occupantsOfRaw(inhabitation.runs[0])
  const byAttempt = (a, b) => a.attemptRef.localeCompare(b.attemptRef)
  assert.deepEqual([...viewOccupants].sort(byAttempt), [...rawOccupants].sort(byAttempt), 'every attempt the run names, once, with its session')
})

// ---------------------------------------------------------------------------
// the run: select → subject → Earth → Timeline → Constellation → Expression → devices → files

const positionsReal = join.positionsOfRaw(inhabitation.runs[0])
const occupantsReal = join.occupantsOfRaw(inhabitation.runs[0])
const returnFacts = join.returnFactsOf(SURVEY, attemptReturn.attempt.record, attemptReturn.runRef)
const runFacts = join.factsOf(RUN, PROJECT, positionsReal, occupantsReal, returnFacts ? [returnFacts] : [])

const base = (over = {}) => ({run: runFacts, events: [], occurrences: null, sessionRefs: [SESSION], ...over})

test('select a run: one identity through every row, with the Earth unmounted (the source reading\'s real state)', () => {
  const selected = join.factoryRunJoin(base())
  assert.equal(selected.runRef, RUN)
  assert.equal(selected.projectRef, PROJECT)
  assert.deepEqual(join.identityBreaks(selected), [], 'every owner-returned ref matches the identity it was joined on')
  assert.deepEqual(selected.subjects.map(item => ({ref: item.ref, kind: item.kind, custodyState: item.custodyState})),
    [{ref: SUBJECT, kind: 'central-path', custodyState: 'in-progress'}])
  assert.deepEqual(selected.earth, [{state: 'not-mounted', runRef: RUN, seam: join.EARTH_SEAM}])
  assert.deepEqual(selected.expression, {runRef: RUN, door: 'desk-run-live'})
})

test('the subject in the Earth: placed only when an occurrence bears the subject ref (FIXTURE occurrences)', () => {
  const unbound = join.factoryRunJoin(base({occurrences: [{id: 'occ-placeholder-other', subject_ref: 'central:path:Work:elsewhere.md'}]}))
  assert.equal(unbound.earth[0].state, 'absent')
  assert.equal(unbound.earth[0].subject.ref, SUBJECT)
  assert.equal(unbound.earth[0].seam.owner, join.EARTH_SEAM.owner, 'the absence names the atlas owner, op and remedy')
  const bound = join.factoryRunJoin(base({occurrences: [{id: 'occ-placeholder-bound', subject_ref: SUBJECT}]}))
  assert.deepEqual(bound.earth, [{state: 'placed', runRef: RUN, subject: bound.subjects[0], occurrenceId: 'occ-placeholder-bound'}])
  assert.deepEqual(join.identityBreaks(bound), [])
})

test('the moment on the Timeline: absent with its owner seam on the real read; selected when the reading carries the run (FIXTURE event)', () => {
  const none = join.factoryRunJoin(base())
  assert.equal(none.timeline.state, 'absent')
  assert.equal(none.timeline.seam.owner, join.TIMELINE_SEAM.owner, 'no moment in the window: the kernel temporal reading (factory-runs) names its owner')
  // FIXTURE, shaped as temporal_sources.rs history_entry_to_event maps an aikit-history `procedure` entry about the run.
  const event = {stream: 'aikit-history', subject_ref: RUN, summary: 'placeholder run receipt', instant_unix_ms: 1790000000000}
  const moment = join.factoryRunJoin(base({events: [{stream: 'kernel-event-log', subject_ref: 'oi:kernel-event:other'}, event]}))
  assert.equal(moment.timeline.state, 'selected')
  assert.equal(moment.timeline.event.subject_ref, RUN, 'the moment is the run\'s own identity')
  assert.equal(runTrack.isRunSubject(RUN), true, 'the Timeline\'s run track admits the run ref (runTrackAdapter.isRunSubject)')
  assert.deepEqual(join.identityBreaks(moment), [])
})

// FIXTURE: shaped as temporal_sources.rs `telemetry_day_to_events` emits a factory-runs signal (subject = the run ref,
// instant = the signal's updated_at_unix_ms, stream position = source#signal_ref) and as the World's Between window
// admits it (instant-bearing events only). No kernel read is made here.
test('the Timeline selects the run\'s moment from the field: the newest factory-runs moment with a stated instant', () => {
  const earlier = {stream: 'factory-runs', subject_ref: RUN, instant_unix_ms: Date.parse('2026-10-13T09:00:00Z'), summary: 'placeholder signal S1', stream_position: 'placeholder-source#signal:S1'}
  const other = {stream: 'factory-runs', subject_ref: 'run:placeholder-other', instant_unix_ms: Date.parse('2026-10-14T09:00:00Z'), summary: 'other run', stream_position: 'placeholder-source#signal:O1'}
  const later = {stream: 'factory-runs', subject_ref: RUN, instant_unix_ms: Date.parse('2026-10-14T08:30:00Z'), summary: 'placeholder signal S2', stream_position: 'placeholder-source#signal:S2'}
  const moment = join.factoryRunJoin(base({events: [earlier, other, later]}))
  assert.equal(moment.timeline.state, 'selected')
  assert.equal(moment.timeline.event.stream_position, 'placeholder-source#signal:S2', 'the newest of this run\'s moments, not the other run\'s')
  assert.equal(moment.timeline.event.subject_ref, RUN)
  assert.deepEqual(join.identityBreaks(moment), [], 'the Timeline row names the run it was joined from')
})

test('an instant-less run signal is not selected: the Timeline names the owner absence in its reasons', () => {
  const instantless = {stream: 'factory-runs', subject_ref: RUN, instant_unix_ms: null, summary: 'placeholder signal S3', stream_position: 'placeholder-source#signal:S3'}
  const row = join.factoryRunJoin(base({events: [instantless]})).timeline
  assert.equal(row.state, 'absent', 'a moment without a stated instant has no place on the instant axis')
  assert.equal(row.seam.owner, join.TIMELINE_SEAM.owner)
  assert.match(row.seam.remedy, /no instant/, 'the owner states no instant for the signal')
  assert.match(row.seam.remedy, /unreadable/, 'or the Factory owner was unreadable for the window')
})

test('the subject in the Constellation: a wiki node the Return names is opened; a wiki root names none', () => {
  const named = join.factoryRunJoin(base())
  assert.deepEqual(named.constellation, {state: 'named', runRef: RUN, refs: ['wiki:node:placeholder-node-a']})
  const noNode = join.factoryRunJoin(base({run: join.factsOf(RUN, PROJECT, positionsReal, occupantsReal, [])}))
  assert.equal(noNode.constellation.state, 'absent')
  assert.equal(noNode.constellation.seam.owner, join.CONSTELLATION_SEAM.owner)
  const nodeSubject = join.factsOf(RUN, PROJECT, [{...positionsReal[0], custody: [{state: 'in-progress', work: 'wiki:node:placeholder-node-b'}]}], occupantsReal, [])
  assert.deepEqual(join.factoryRunJoin(base({run: nodeSubject})).constellation, {state: 'named', runRef: RUN, refs: ['wiki:node:placeholder-node-b']})
})

test('the Expression: the desk\'s own Run Live door, keyed on the run ref', () => {
  assert.deepEqual(join.expressionRowOf(RUN), {runRef: RUN, door: 'desk-run-live'})
})

test('the devices and the files: the attempt\'s session selects its track; the Return\'s central:path artifact opens through the owner route', () => {
  const selected = join.factoryRunJoin(base())
  assert.deepEqual(selected.devices, [
    {state: 'selected', runRef: RUN, attemptRef: SURVEY, sessionRef: SESSION},
    {state: 'absent', runRef: RUN, attemptRef: REVIEW, seam: join.DEVICE_SEAM},
  ])
  assert.deepEqual(selected.files.openable.map(item => item.ref), [SUBJECT, ARTIFACT])
  assert.deepEqual(selected.files.openable[1], {ref: ARTIFACT, root: 'Control', path: 'agents/now/placeholder-artifact.md'})
  assert.deepEqual(selected.files.unopenable.map(item => item.ref), ['evidence:placeholder/citations'])
  assert.equal(selected.files.unopenable[0].seam.owner, join.FILE_SEAM.owner, 'an artifact or evidence ref no file route admits names its owner')
  const withoutAgency = join.factoryRunJoin(base({sessionRefs: []}))
  assert.equal(withoutAgency.devices[0].state, 'absent', 'a session the agency reading does not list is named, never selected')
  assert.deepEqual(join.identityBreaks(selected), [])
})

// ---------------------------------------------------------------------------
// repetition: views closed, reopening, occupant change, a retained occasion

test('repeated with views closed and reopened: the same inputs give the same join', () => {
  const first = join.factoryRunJoin(base({occurrences: [{id: 'occ-placeholder-bound', subject_ref: SUBJECT}]}))
  const reopened = join.factoryRunJoin(base({occurrences: [{id: 'occ-placeholder-bound', subject_ref: SUBJECT}]}))
  assert.deepEqual(reopened, first)
})

test('occupant change: a new occupant on the run appears as a device row; the subject and identity do not move', () => {
  const extra = {attempt_ref: 'attempt:placeholder-review-2', participant: {position_ref: {state: 'present', value: 'central:position:project:PLACEHOLDER-PROJECT:position-a'}},
    body: {agent_session_ref: {state: 'present', value: 'agent-session/placeholder-review'}}}
  const changedRun = {...inhabitation.runs[0], occupants: [...inhabitation.runs[0].occupants, extra]}
  const changed = join.factsOf(RUN, PROJECT, join.positionsOfRaw(changedRun), join.occupantsOfRaw(changedRun), runFacts.returns)
  const after = join.factoryRunJoin(base({run: changed, sessionRefs: [SESSION, 'agent-session/placeholder-review']}))
  assert.equal(after.devices.length, 3)
  assert.equal(after.devices[2].state, 'selected')
  assert.deepEqual(after.subjects, join.factoryRunJoin(base()).subjects)
  assert.deepEqual(join.identityBreaks(after), [])
})

test('a retained occasion: the Timeline moment stays selected while the Earth is unmounted, on the same run', () => {
  const event = {stream: 'aikit-history', subject_ref: RUN, summary: 'placeholder run receipt', instant_unix_ms: 1790000000000}
  const retained = join.factoryRunJoin(base({events: [event], occurrences: null}))
  assert.equal(retained.timeline.state, 'selected')
  assert.equal(retained.earth[0].state, 'not-mounted')
  assert.equal(retained.timeline.event.subject_ref, retained.runRef)
  assert.deepEqual(join.identityBreaks(retained), [])
})

// The identity check reads the refs the owner reads returned (FactoryRunJoin.identity), not the rows' own run key.
test('the owner\'s Return reading names the run the join reads it under (FIXTURE: the shape the desk reads)', () => {
  assert.equal(attemptReturn.runRef, RUN, 'the placeholder Return reading names the run the inhabitation reading names')
  assert.equal(returnFacts.ownerRunRef, RUN, 'the Return fact records the run ref the Return reading returned')
})

test('an owner read that names another run fires the break, and the clean fixture does not', () => {
  const OTHER = 'run:01Z0000000000000000000OTHER'
  const otherFacts = join.returnFactsOf(SURVEY, attemptReturn.attempt.record, OTHER)
  const named = join.factoryRunJoin({...base(), run: join.factsOf(RUN, PROJECT, positionsReal, occupantsReal, [otherFacts])})
  assert.deepEqual(join.identityBreaks(named), [`return[${SURVEY}] (Return reading, run_ref) names ${OTHER}, not ${RUN}`])
  assert.deepEqual(join.identityBreaks(join.factoryRunJoin(base())), [], 'the clean fixture: the Return names this run')
})

test('the identity check reads the recorded owner refs: a tampered recorded ref is reported on its own row', () => {
  const joined = join.factoryRunJoin(base({events: [{stream: 'factory-runs', subject_ref: RUN, instant_unix_ms: Date.parse('2026-10-14T08:30:00Z'), summary: 'placeholder signal', stream_position: 'placeholder-source#signal:S5'}]}))
  const tampered = {...joined, identity: joined.identity.map(item => item.where === 'timeline' ? {...item, ownerRef: 'run:other'} : item)}
  assert.deepEqual(join.identityBreaks(tampered), [`timeline (temporal reading, factory-runs subject_ref) names run:other, not ${RUN}`])
})

test('each owner-returned ref is recorded with the identity it was joined on; an absent read records nothing', () => {
  const event = {stream: 'factory-runs', subject_ref: RUN, instant_unix_ms: Date.parse('2026-10-14T08:30:00Z'), summary: 'placeholder signal', stream_position: 'placeholder-source#signal:S6'}
  const bound = join.factoryRunJoin(base({events: [event], occurrences: [{id: 'occ-placeholder-bound', subject_ref: SUBJECT}], sessionRefs: [SESSION]}))
  assert.deepEqual(bound.identity.map(item => item.where), ['earth[0]', 'timeline', 'return[' + SURVEY + ']', 'devices[0]', 'files[0]', 'files[1]'])
  const earthRecord = bound.identity.find(item => item.where === 'earth[0]')
  assert.deepEqual({ownerRef: earthRecord.ownerRef, joinedOn: earthRecord.joinedOn}, {ownerRef: SUBJECT, joinedOn: SUBJECT}, 'the atlas returned the subject ref the run holds')
  const unmounted = join.factoryRunJoin(base({events: [], occurrences: null, sessionRefs: []}))
  assert.deepEqual(unmounted.identity.map(item => item.where), ['return[' + SURVEY + ']', 'files[0]', 'files[1]'], 'no Earth, no moment and no agency session: no record for them')
  assert.deepEqual(join.identityBreaks(bound), [])
  assert.deepEqual(join.identityBreaks(unmounted), [])
})

test('a Return that names no readable material yields no Return fact', () => {
  assert.equal(join.returnFactsOf(REVIEW, {attemptRef: REVIEW, readableReturn: null}), null)
  assert.equal(join.returnFactsOf(REVIEW, undefined), null)
})

// The Timeline's named absence (SCRIPTED: the reason kinds and words are the temporal reading's own shape, as
// desktop/cradle/kernel/src/temporal_events.rs `StreamAbsence` serialises them; no kernel read is made here).
const ABSENCE_WORDS = 'factory telemetry day did not answer within 20000 ms'
const absenceFor = (reason, owner_words = ABSENCE_WORDS, stream = 'factory-runs') => ({stream, reason, owner_words})

test('the Timeline names a factory-runs absence in the reading\'s own reason and the owner\'s words, and keeps the seam', () => {
  const row = join.factoryRunJoin(base({absences: [absenceFor('owner-timeout')]})).timeline
  assert.equal(row.state, 'absent')
  assert.equal(row.absence.reason, 'owner-timeout')
  assert.equal(row.absence.ownerWords, ABSENCE_WORDS)
  assert.match(row.absence.text, /did not answer within its bound: factory telemetry day did not answer within 20000 ms$/)
  assert.deepEqual(row.seam, join.TIMELINE_SEAM, 'the seam stays as the remedy beside the named reason')
  assert.deepEqual(join.identityBreaks(join.factoryRunJoin(base({absences: [absenceFor('owner-timeout')]}))), [], 'the reason names the run it was joined from')
})

test('each owner state kind has its own Timeline words; the owner\'s words are shown, or said to be absent', () => {
  const kinds = ['owner-absent', 'owner-unreadable', 'owner-timeout', 'refused']
  const texts = kinds.map(reason => join.factoryRunJoin(base({absences: [absenceFor(reason)]})).timeline.absence.text)
  assert.equal(new Set(texts).size, kinds.length, 'four kinds, four distinct reasons')
  kinds.forEach((_, index) => assert.ok(texts[index].endsWith(ABSENCE_WORDS), `${kinds[index]} carries the owner's words`))
  const wordless = join.factoryRunJoin(base({absences: [absenceFor('owner-absent', '')]})).timeline
  assert.equal(wordless.absence.ownerWords, '')
  assert.match(wordless.absence.text, /is absent here; the owner stated no words$/)
  const unknown = join.timelineRowOf(RUN, [], [absenceFor('owner-future-kind', 'words')])
  assert.match(unknown.absence.text, /contributed nothing \(owner-future-kind\): words$/, 'an unknown kind is named as it arrives')
})

test('a partial failure names the located source it failed on, so a gap is not read as this run\'s own', () => {
  const partial = {stream: 'factory-runs', reason: 'owner-unreadable', owner_words: 'telemetry day reading names no signal_ref', source_ref: 'project:other'}
  const row = join.factoryRunJoin(base({absences: [partial]})).timeline
  assert.equal(row.state, 'absent')
  assert.equal(row.absence.sourceRef, 'project:other')
  assert.match(row.absence.text, /could not read the answer \(source project:other\): telemetry day reading names no signal_ref$/)
  const unnamed = join.factoryRunJoin(base({absences: [absenceFor('owner-timeout')]})).timeline
  assert.equal(unnamed.absence.sourceRef, null, 'a stream-wide absence names no source')
  assert.doesNotMatch(unnamed.absence.text, /\(source/)
})

test('a reading with no factory-runs absence keeps the Timeline row as it was: no absence key, the same seam', () => {
  const current = join.factoryRunJoin(base()).timeline
  assert.deepEqual(current, {state: 'absent', runRef: RUN, seam: join.TIMELINE_SEAM}, 'no reading, no absence: the row is unchanged')
  const otherStream = join.factoryRunJoin(base({absences: [absenceFor('owner-timeout', ABSENCE_WORDS, 'kernel-event-log')]})).timeline
  assert.deepEqual(otherStream, current, 'an absence on another stream does not reach the Timeline row')
  assert.equal(Object.hasOwn(otherStream, 'absence'), false)
  assert.deepEqual(join.factoryRunJoin(base({absences: []})).timeline, current)
})

test('a moment the reading holds is selected over a factory-runs absence in the same reading', () => {
  const event = {stream: 'factory-runs', subject_ref: RUN, instant_unix_ms: Date.parse('2026-10-14T08:30:00Z'), summary: 'placeholder signal', stream_position: 'placeholder-source#signal:S4'}
  const row = join.factoryRunJoin(base({events: [event], absences: [absenceFor('owner-timeout')]})).timeline
  assert.equal(row.state, 'selected', 'a held moment is the Timeline\'s answer; the absence names only a silence')
  assert.equal(row.event.stream_position, 'placeholder-source#signal:S4')
})
