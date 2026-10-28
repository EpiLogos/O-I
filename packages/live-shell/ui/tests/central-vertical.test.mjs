// The Central vertical, scripted (WORLD-SHELL-DESIGN §17.2):
// one real day recovered through the Timeline and the Base detail row —
// select a day, then a return, then a conversation, then a wiki subject — with
// the detail row and the projection showing the same identity at every step.
//
// Channels (every claim below is labelled by the one that carries it):
// - REAL CAPTURE (text redacted): tests/fixtures/central-vertical/*.capture.* are the shape of
//   read-only `ctrl` answers from this machine on 14 Oct 2026, with the owner's text, subjects and
//   personal paths redacted for a public repo (see the folder's README.md). Structure, schemas,
//   ref forms, kinds, statuses, dates and counts are as captured (central.now.list, central.now.read,
//   central.day.read, central.files.list, central.time.policy, and the wiki's
//   own wiki.json). The temporal events are built from them by the kernel's own
//   mapping rules (desktop/cradle/kernel/src/temporal_sources.rs
//   `now_record_to_event`, the wiki-returns placement, temporal_events.rs
//   `day_ref_for`). The kernel's temporal read itself was not invoked here.
// - FIXTURE: the conversation event (no session-space capture on this machine)
//   and the ready-Day answer (no ready Day exists in this World on 14 Oct).
//   Each is labelled where it is used.
// - SOURCE: the kernel's refusal sentence for an uninitialised Day
//   (central.rs:96), quoted verbatim.
// The real pieces run: the projection adapters, the time spine, the occasion
// resolver, the Day/NOW/return interpreters, and the knowledge door's own
// validator (validateKnowledgeOpen). React components are checked by tsc, not here.

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production modules in memory (the central-family-l7 pattern): .ts/.tsx
// transpiled, CSS stubbed.
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

const spine = await import('../src/timeline/timeSpine.ts')
const dayTrack = await import('../src/timeline/dayTrackAdapter.ts')
const conversationTrack = await import('../src/timeline/conversationTrackAdapter.ts')
const vertical = await import('../src/central/centralVertical.ts')
const knowledge = await import('../src/native/knowledgeOpen.ts')

const FIXTURES = new URL('./fixtures/central-vertical/', import.meta.url)
const capture = async (name) => JSON.parse(await readFile(new URL(name, FIXTURES), 'utf8'))
const text = async (name) => readFile(new URL(name, FIXTURES), 'utf8')

// ---------------------------------------------------------------------------
// the reading the World cut holds, built from the captures

const timePolicy = (await capture('time-policy.capture.json')).data.policy
assert.equal(timePolicy.day_boundary_minutes, 0, 'REAL CAPTURE (text redacted): the day boundary is midnight, so the civil day is the local date')
const londonDate = (unixMs) => new Intl.DateTimeFormat('en-CA', {timeZone: timePolicy.timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(unixMs))
// temporal_events.rs day_ref_for: `central:day:<scope>:<date>`, scope = the policy's scope_ref.
const dayRefFor = (unixMs) => `central:day:${timePolicy.scope_ref}:${londonDate(unixMs)}`

// REAL CAPTURE (text redacted) — central.now.list rows → temporal_sources.rs now_record_to_event.
const nowRecords = (await capture('now-list.capture.json')).data.records
const nowEvents = nowRecords.map((record) => {
  const instantUnixMs = record.created_at_unix_seconds * 1000
  return {
    stream: 'central-now', kind: 'now', subject_ref: record.now_ref, instant_unix_ms: instantUnixMs,
    summary: record.purpose, day_ref: dayRefFor(instantUnixMs),
    evidence_refs: [record.source_ref, record.revision?.revision].filter(Boolean),
  }
})

// REAL CAPTURE (text redacted) — central.files.list of Control/agents/wiki/returns → the wiki-returns placement (instant-less).
const wikiEntries = (await capture('wiki-returns-list.capture.json')).data.entries.filter((entry) => entry.kind === 'file')
const wikiEvents = wikiEntries.map((entry) => ({
  stream: 'wiki-returns', kind: 'return', subject_ref: entry.location.ref, instant_unix_ms: null, summary: entry.name,
  day_ref: null, evidence_refs: [entry.location.ref],
}))

// FIXTURE — a conversation receipt (no session-space capture on this machine). The digest is a fixed 64-hex string.
const CONVERSATION_SPACE = 'session-space/nara-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const conversationInstant = Date.UTC(2026, 9, 6, 9, 30)
const conversationEvent = {
  stream: 'session-space', kind: 'conversation', subject_ref: CONVERSATION_SPACE, instant_unix_ms: conversationInstant,
  summary: 'Nara dialogue (fixture)', day_ref: dayRefFor(conversationInstant), evidence_refs: [],
}

const events = [...nowEvents, ...wikiEvents, conversationEvent]

// The projection exactly as the World cut draws it (useWorldTemporalReading.ts).
const daySet = dayTrack.projectDayTracks(events)
const conversationSet = conversationTrack.projectConversationTracks(events)
const eventByClipId = new Map([...dayTrack.dayClipEventIndex(events), ...conversationTrack.conversationClipEventIndex(events)])
const clipFor = (subjectRef) => {
  for (const set of [daySet, conversationSet]) {
    const clip = set.clips.find((item) => eventByClipId.get(item.id)?.subject_ref === subjectRef)
    if (clip) return {set, clip}
  }
  return null
}

// The one encounter spine, and the browser's subject — the two selections the
// Base detail row chooses between. The Timeline's select mirrors App.tsx's
// `centralWorld.selectOccasion` (it selects the spine's occasion and clears the
// browser subject); the detail choice mirrors CentralClipChooser.
const encounter = spine.createTimeSpine()
let browserSubject = null
const timelineSelect = (event) => { encounter.selectOccasion(event, Date.UTC(2026, 9, 14)); browserSubject = null }
const detailRow = () => {
  if (browserSubject) return {source: 'browser', subject: browserSubject}
  const resolved = vertical.resolveCentralOccasion(encounter.occasion(), events)
  return resolved.state === 'selected' ? {source: 'timeline', selection: resolved.selection} : {source: 'none'}
}
// The World cut presentation's `selected` rule (worldTimelinePresentation.tsx:152, deleted 15 Oct): a clip is selected when the
// occasion retains its event's subject.
const selectedClipSubjects = () => {
  const retained = new Set(encounter.occasions().map((entry) => entry.basis.ref))
  return [daySet, conversationSet].flatMap((set) => set.clips)
    .filter((clip) => { const event = eventByClipId.get(clip.id); return !!event && retained.has(event.subject_ref) })
    .map((clip) => eventByClipId.get(clip.id).subject_ref)
}
// The identity both sides must show: the detail row's subject, and the projection's clip for it.
const assertSameIdentity = (selection, expectedTrackId) => {
  const projected = clipFor(selection.subjectRef)
  assert.ok(projected, `the projection draws ${selection.subjectRef}`)
  assert.equal(projected.clip.trackId, expectedTrackId, 'the projection places the clip on its track')
  assert.equal(projected.clip.columnId, selection.civilDate ? `day:${selection.civilDate}` : 'day:undated', 'the projection places the clip on its civil day')
  // The spine's occasion is this selection; the projection marks it selected (the retained occasion rail marks every retained subject).
  assert.equal(encounter.occasion().basis.ref, selection.subjectRef, 'the spine\'s one occasion is this selection')
  assert.ok(selectedClipSubjects().includes(selection.subjectRef), 'the projection marks this clip selected')
  assert.equal(eventByClipId.get(projected.clip.id).subject_ref, selection.subjectRef, 'the clip resolves to the same identity the detail row shows')
}

// ---------------------------------------------------------------------------

test('the reading and projection place the captured clips on their civil days (REAL CAPTURE (text redacted) + kernel mapping)', () => {
  assert.equal(nowEvents.length, 3, 'the capture carries three NOW clearings (records 0-2 of 110)')
  assert.deepEqual(nowEvents.map((event) => event.day_ref), [
    'central:day:control:root:2026-10-06', 'central:day:control:root:2026-09-24', 'central:day:control:root:2026-09-17',
  ])
  const columns = daySet.columns.map((column) => column.id)
  assert.ok(columns.includes('day:2026-10-06') && columns.includes('day:2026-09-24') && columns.includes('day:undated'))
  // Every event the day track draws is one the lane rule admits; the conversation is not a day-track lane.
  assert.equal(daySet.clips.length, events.filter((event) => dayTrack.dayTrackLaneOf(event)).length)
  assert.equal(conversationSet.clips.length, 1)
  assert.equal(conversationSet.tracks[0].id, `conversation:${CONVERSATION_SPACE}`)
})

test('step 1 — a dated day-track clip selects the spine occasion and opens the Day document device for its day', async () => {
  const event = nowEvents[0]
  timelineSelect(event)
  const row = detailRow()
  assert.equal(row.source, 'timeline', 'the Timeline selection stands in the Base detail row')
  const {selection} = row
  assert.equal(selection.kind, 'return', 'a NOW clearing is a return; its day opens as day context')
  assert.equal(selection.returnKind, 'now')
  assert.equal(selection.civilDate, '2026-10-06')
  assertSameIdentity(selection, 'central-day')

  // The Day document device asks the owner for this day (the `central` op `open-day`).
  const request = vertical.dayOpenRequest(selection.dayRef)
  assert.deepEqual(request, {kind: 'open-day', day_ref: 'central:day:control:root:2026-10-06'})
  // REAL CAPTURE (text redacted): central.day.read for that day reports the document uninitialised.
  const day = await capture('day-read-2026-10-06.capture.json')
  assert.equal(day.data.document_state, 'uninitialised')
  assert.equal(day.data.day_ref, selection.dayRef, 'the captured day is the same day ref the clip stands in')
  // SOURCE: the kernel answers open-day for an uninitialised Day with its own sentence (central.rs:96).
  const kernelSentence = 'Current Day has no native document yet. Use the explicit native initialisation path; its temporal artifact is not a Daily Die'
  const standing = vertical.interpretDayOpen(selection.dayRef, {error: kernelSentence})
  assert.equal(standing.state, 'uninitialised')
  assert.equal(standing.civilDate, '2026-10-06')
  assert.equal(standing.owner, vertical.DAY_OWNER)
  assert.equal(standing.op, vertical.DAY_INITIALISE_OP, 'the face names the owner op that would admit the Day document')
  assert.equal(standing.message, kernelSentence, 'the owner\'s own words stay on the face')
})

test('step 1 (content) — the NOW return opens its own content from the owner reading (REAL CAPTURE (text redacted) central.now.read)', async () => {
  const selected = detailRow().selection
  const reading = (await capture('now-read.capture.json')).data
  const facts = vertical.nowReturnFacts(reading, selected.subjectRef)
  assert.ok(facts, 'the owner reading is for this clearing')
  assert.equal(facts.purpose, nowEvents[0].summary, 'the content is the clearing\'s own purpose, as the owner gives it')
  assert.equal(facts.lifecycle, 'active')
  assert.equal(facts.returns.length, 0, 'the owner reading shows no returns for this clearing')
  assert.equal(facts.source?.path, 'Control/agents/now/clearings/0000000000000000000000000000000000000000000000000000000000000001/now.json')
  assert.deepEqual(facts.namedWikiRefs, [], 'the clearing names no wiki node in its own record, so none is opened')
  assert.equal(vertical.nowReturnFacts(reading, 'central:now:control:root:not-this-one'), null, 'a reading for another clearing is refused, not drawn')
})

test('step 1 (non-return) — a dated day-track moment that is not a return opens the Day device alone (synthetic kernel-log moment)', () => {
  const kernelMoment = {stream: 'kernel-event-log', kind: 'receipt', subject_ref: 'oi:kernel-event:seq-7', instant_unix_ms: Date.UTC(2026, 9, 6, 12, 0), summary: 'central.day.ensure receipt (synthetic)', day_ref: dayRefFor(Date.UTC(2026, 9, 6, 12, 0)), evidence_refs: []}
  const selection = vertical.classifyCentralEvent(kernelMoment)
  assert.equal(selection.kind, 'day', 'a dated day-track moment opens its Day device')
  assert.equal(selection.civilDate, '2026-10-06')
  const undated = vertical.classifyCentralEvent({...kernelMoment, instant_unix_ms: null, day_ref: null})
  assert.equal(undated.kind, 'other', 'an undated moment with no civil day opens no Day device')
})

test('step 2 — a wiki return clip opens its own file content; undated, so no Day device stands for it (REAL CAPTURE (text redacted))', async () => {
  const event = wikiEvents.find((item) => item.summary.startsWith('return-sample-b'))
  assert.ok(event, 'REAL CAPTURE (text redacted): the wiki returns listing carries the sample return B')
  timelineSelect(event)
  const {selection} = detailRow()
  assert.equal(selection.kind, 'return')
  assert.equal(selection.returnKind, 'wiki-return')
  assert.equal(selection.civilDate, null, 'the directory listing carries no instant: the return is undated')
  assertSameIdentity(selection, 'central-day')

  // The return opens its own file through the owner's file route; the ref names the root and path.
  const location = vertical.parseCentralPathRef(selection.subjectRef)
  assert.deepEqual(location, {root: '/sample/ground', path: 'Control/agents/wiki/returns/return-sample-b-2026-09-16.md'})
  const content = await text('wiki-return-sample.capture.md')
  assert.match(content, /^# Return: sample subject/, 'REAL CAPTURE (text redacted): the return file is the one the owner lists')
  assert.deepEqual(vertical.namedWikiSubjects(content), [], 'the real return names no wiki node ref in its text: no Constellation subject is opened from it')
})

test('step 3 — a conversation clip opens the Nara device on its conversation; the owner gap is named (FIXTURE space)', () => {
  timelineSelect(conversationEvent)
  const {selection} = detailRow()
  assert.equal(selection.kind, 'conversation')
  assert.equal(selection.subjectRef, CONVERSATION_SPACE)
  assert.equal(selection.civilDate, '2026-10-06')
  assertSameIdentity(selection, `conversation:${CONVERSATION_SPACE}`)
  const gap = vertical.conversationGap(selection.subjectRef)
  assert.ok(gap.includes(CONVERSATION_SPACE), 'the face names this conversation')
  assert.ok(gap.includes(vertical.CONVERSATION_BINDING_GAP.owner) && gap.includes('session-space'), 'the face names the owner that owes the binding')
})

test('step 4 — a wiki subject a return or Day names opens the Constellation focused on it (REAL CAPTURE (text redacted) node ref, constructed probe)', async () => {
  const nodes = (await capture('wiki-nodes.capture.json'))
  const nodeRef = 'wiki:node:sample-node-c'
  assert.ok(nodes.space_node_refs.includes(nodeRef), 'REAL CAPTURE (text redacted): the wiki\'s own root space lists this node')
  // The real return names nothing (step 2). The probe is a constructed line appended to a copy of that text.
  const probe = `${await text('wiki-return-sample.capture.md')}\nSee \`${nodeRef}\`, then return.`
  const named = vertical.namedWikiSubjects(probe)
  assert.deepEqual(named, [nodeRef], 'only the explicit wiki:node ref is named; prose is never matched to a node')
  // The Constellation request is the knowledge door's own admitted shape (the panel's receiver validates it).
  const request = vertical.constellationRequest(named[0], named[0])
  const admitted = knowledge.validateKnowledgeOpen(request)
  assert.equal(admitted.plane, 'graph')
  assert.deepEqual(admitted.address, {kind: 'wiki', value: nodeRef}, 'the Constellation opens on this wiki subject')
  assert.equal(admitted.title, nodeRef)
})

test('the detail row chooses one selection: a browser subject stands until a Timeline clip is selected, and that clip clears it', () => {
  browserSubject = {kind: 'day', path: 'Control/agents/now/day/2026-09-12.md'}
  assert.equal(detailRow().source, 'browser', 'the browser subject (the existing Days rows) stands')
  timelineSelect(nowEvents[1])
  assert.equal(browserSubject, null, 'a Timeline selection replaces the browser subject')
  const {selection} = detailRow()
  assert.equal(selection.subjectRef, nowEvents[1].subject_ref)
  assert.equal(selection.civilDate, '2026-09-24')
})

test('owner refusals stay named, never a fallback Day (REAL CAPTURE (text redacted) refusal + ready-Day FIXTURE)', async () => {
  const refusal = await capture('day-read-unrecorded.capture.json')
  assert.equal(refusal.error.message, 'DayRef is not recorded in this World')
  const refused = vertical.interpretDayOpen('central:day:control:root:2026-10-14', {error: refusal.error.message})
  assert.equal(refused.state, 'refused', 'a day the World does not record is refused with the owner\'s words')
  assert.equal(refused.message, 'DayRef is not recorded in this World')

  // FIXTURE: a ready Day answer (no ready Day exists in this World on 14 Oct 2026). The identity is taken verbatim.
  const ready = vertical.interpretDayOpen('central:day:control:root:2026-10-06', {data: {
    schema: 'oi.central-day-open/v1', project: null,
    day: {document_state: 'ready', source: {ref: 'central:source:control:root:Control/user/day/2026-10-06/day.md'},
      document: {document_id: 'day-document:2026-10-06'}, revision: {revision: 'central.content-fnv1a64/v1:12:0000000000000001'}},
  }})
  assert.equal(ready.state, 'ready')
  assert.equal(ready.documentId, 'day-document:2026-10-06')
  assert.equal(ready.sourceRef, 'central:source:control:root:Control/user/day/2026-10-06/day.md')
  // Ready and without the owner's identity: refused, never drawn.
  assert.equal(vertical.interpretDayOpen('central:day:control:root:2026-10-06', {data: {day: {document_state: 'ready'}}}).state, 'refused')
})

test('the wiki subject grammar: only explicit wiki:node refs are named, in order, once each', () => {
  assert.deepEqual(vertical.namedWikiSubjects('`wiki:node:sample-node-b`, then wiki:node:sample-node-b again.'), ['wiki:node:sample-node-b'])
  assert.deepEqual(vertical.namedWikiSubjects('a wiki:node:sample-node-c. and wiki:node:sample-node-a'), [
    'wiki:node:sample-node-c', 'wiki:node:sample-node-a',
  ])
  assert.deepEqual(vertical.namedWikiSubjects('the wiki node sample-node-a, central:wiki:project:Sample'), [], 'prose and space refs are not nodes')
})

test('a Day\'s opening lands on Central · day at its instant (#756: the kernel\'s central-day stream)', () => {
  // The kernel emits a day-open moment on stream central-day once Central's Day reading states when it opened (opened_at_unix_seconds);
  // a Day that states none yields no moment. The Day track honestly receives that stream.
  const opening = {stream: 'central-day', kind: 'day', civil_instant: '2026-10-28T04:26:42Z',
    stream_position: 'central:day:control:root:2026-10-28#opened', subject_ref: 'central:day:control:root:2026-10-28'}
  const lane = dayTrack.dayTrackLaneOf(opening)
  assert.equal(lane?.id, 'central-day')
  assert.equal(lane?.kind, 'day')
})
