// T-TRACKS-CENTRAL: Central's five streams as tracks for the shared Session and Arrangement (manual §3 and §5; lock §9.1
// Central row). Over recorded readings, headless.
//
// Channels (each claim below is carried by exactly one):
// - REAL CAPTURE (text redacted): tests/fixtures/central-vertical/*.capture.json — the shape of read-only `ctrl` answers on
//   14 Oct 2026 (central.now.list, central.files.list of the wiki returns, central.time.policy). The temporal events are
//   built from them by the kernel's own mapping rules, exactly as tests/central-vertical.test.mjs does. The kernel's temporal
//   read itself is not invoked here.
// - RECORDED LISTING: the names in Control/agents/now/day on this machine, 14 Oct 2026 (`ls`), as the owner's directory
//   reading would list them.
// - FIXTURE: the machine-NOW and kernel-log events (no capture of those streams), the explicit instants of the placement
//   test, and the stubbed bridge answers of the read leg. Each is labelled where it is used.
// - SCRIPTED: the shared views (SessionGrid, ArrangementRuler) rendered to static markup; the hook rendered once on the server.
// No computer-use pass, no browser: the on-screen legs are not covered here.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const adapter = await import('../src/timeline/centralTrackAdapter.ts')
const dayTrack = await import('../src/timeline/dayTrackAdapter.ts')
const {SessionGrid} = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler, placeClips} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {useCentralTracks, readDayRecords} = await import('../src/frame/tracks/useCentralTracks.ts')
const {civilReadingOf} = await import('../src/timeline/centralTrackAdapter.ts')
const {browserCategoriesOf} = await import('../src/shell/modeGrammar.ts')

const FIXTURES = new URL('./fixtures/central-vertical/', import.meta.url)
const capture = async name => JSON.parse(await readFile(new URL(name, FIXTURES), 'utf8'))
const source = async path => readFile(new URL(path, import.meta.url), 'utf8')

// ── the recorded readings ────────────────────────────────────────────────────────────────────────

// REAL CAPTURE: the civil-time policy, and the central.now.list rows → temporal_sources.rs now_record_to_event.
const policy = (await capture('time-policy.capture.json')).data.policy
const londonDate = unixMs => new Intl.DateTimeFormat('en-CA', {timeZone: policy.timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(unixMs))
const dayRefFor = unixMs => `central:day:${policy.scope_ref}:${londonDate(unixMs)}`
const nowEvents = (await capture('now-list.capture.json')).data.records.map(record => {
  const instant = record.created_at_unix_seconds * 1000
  return {stream: 'central-now', kind: 'now', subject_ref: record.now_ref, instant_unix_ms: instant, summary: record.purpose,
    day_ref: dayRefFor(instant), evidence_refs: [record.source_ref, record.revision?.revision].filter(Boolean)}
})
// REAL CAPTURE: central.files.list of Control/agents/wiki/returns → the wiki-returns placement (instant-less, no day).
const wikiEvents = (await capture('wiki-returns-list.capture.json')).data.entries.filter(entry => entry.kind === 'file').map(entry => ({
  stream: 'wiki-returns', kind: 'return', subject_ref: entry.location.ref, instant_unix_ms: null, summary: entry.name, day_ref: null, evidence_refs: [entry.location.ref]}))
// FIXTURE: streams the Day track must not draw (the World cut gives them their own lanes).
const machineEvent = {stream: 'aikit-history', kind: 'history', subject_ref: 'aikit:history:fixture', instant_unix_ms: Date.UTC(2026, 9, 13, 10), summary: 'machine NOW (fixture)', day_ref: 'central:day:control:root:2026-10-13', evidence_refs: ['aikit:fixture']}
const kernelEvent = {stream: 'kernel-event-log', kind: 'event', subject_ref: 'kernel:event:fixture', instant_unix_ms: Date.UTC(2026, 9, 13, 11), summary: 'kernel event (fixture)', day_ref: 'central:day:control:root:2026-10-13', evidence_refs: ['kernel:fixture']}
const events = [...nowEvents, ...wikiEvents, machineEvent, kernelEvent]

// RECORDED LISTING: Control/agents/now/day on this machine, 14 Oct 2026 (`.sources` are snapshots, not day records).
const listing = {entries: ['2026-09-06.md', '2026-09-06.sources', '2026-09-07.md', '2026-09-07.sources', '2026-09-08.md', '2026-09-08.sources',
  '2026-09-09.md', '2026-09-09.sources', '2026-09-11.md', '2026-09-11.sources', '2026-09-12.md', '2026-09-12.sources'].map(name => ({
  name, kind: name.endsWith('.md') ? 'file' : 'directory', byte_len: 4096, retrieval_allowed: true,
  location: {schema: 'central.path-ref/v1', ref: `central:path:/sample/ground:Control/agents/now/day/${name}`, root: '/sample/ground', path: `Control/agents/now/day/${name}`}}))}

const records = adapter.dayRecordsOf(listing)
const reading = {records: {state: 'read', records}, civil: {state: 'live', events, absences: []}}
const set = adapter.projectCentralTracks(reading)
const DAY = 'central:stream:day'
const dayClips = set.clips.filter(clip => clip.trackId === DAY)

// ── 1 — the five streams ─────────────────────────────────────────────────────────────────────────

test('Central shows five tracks, always in the manual\'s order, whatever has been read', () => {
  const order = [['central:stream:day', 'Day'], ['central:stream:flows', 'Flows'], ['central:stream:beings', 'Beings'], ['central:stream:things', 'Things'], ['central:stream:goals', 'Goals']]
  assert.deepEqual(set.tracks.map(track => [track.id, track.name]), order)
  assert.deepEqual([...adapter.CENTRAL_STREAM_IDS], ['day', 'flows', 'beings', 'things', 'goals'])
  for (const unread of [{state: 'reading'}, {state: 'unavailable', reason: 'no carrier'}]) {
    const bare = adapter.projectCentralTracks({records: unread, civil: unread})
    assert.deepEqual(bare.tracks.map(track => [track.id, track.name]), order, `${unread.state}: the streams still stand`)
    assert.deepEqual([bare.columns, bare.clips, bare.ruler], [[], [], undefined], `${unread.state}: nothing is drawn that was not read`)
  }
})

// ── 2 — the Day track's clips are the selection's own refs ───────────────────────────────────────

test('a day record\'s clip id is the Central-relative path the browser\'s Days row selects, and it opens as a day subject', async () => {
  assert.deepEqual(records.map(record => record.name), ['2026-09-12.md', '2026-09-11.md', '2026-09-09.md', '2026-09-08.md', '2026-09-07.md', '2026-09-06.md'], 'only the .md files are day records, newest first')
  const recordClips = dayClips.filter(clip => adapter.centralSubjectOfClip(clip.id))
  assert.deepEqual(recordClips.map(clip => clip.id), records.map(record => `Control/agents/now/day/${record.name}`))
  assert.deepEqual(recordClips.map(clip => clip.label), ['2026-09-12', '2026-09-11', '2026-09-09', '2026-09-08', '2026-09-07', '2026-09-06'])
  assert.deepEqual(adapter.centralSubjectOfClip('Control/agents/now/day/2026-09-12.md'), {kind: 'day', path: 'Control/agents/now/day/2026-09-12.md'})
  assert.equal(adapter.centralSubjectOfClip('Control/agents/now/day/2026-09-12.sources'), null)
  // The two places this adapter ports from still say what it says: the browser's day surface and ground-subject test, and the
  // shell's selection writing the subject's path as THE ref.
  const browser = await source('../src/shell/ModeBrowser.tsx')
  assert.ok(browser.includes(`const DAY_RECORDS_PATH = '${adapter.CENTRAL_DAY_RECORDS_PATH}'`), 'ModeBrowser reads the same day surface')
  assert.ok(browser.includes('/\\/now\\/day\\/\\d{4}-\\d{2}-\\d{2}\\.md$/'), 'ModeBrowser tells a day record from a note by the same expression')
  assert.match(await source('../src/App.tsx'), /ref: subject\.path/, 'selectCentralSubject writes the subject\'s path as the ref')
})

test('the Day track\'s entries are the World cut\'s own day-lane clips, under the ids the occasion route resolves', () => {
  const world = dayTrack.projectDayTracks(events)
  const index = dayTrack.dayClipEventIndex(events)
  const entries = dayClips.filter(clip => !adapter.centralSubjectOfClip(clip.id))
  const drawnByDayLane = world.clips.filter(clip => clip.trackId === 'central-day')
  assert.ok(nowEvents.length > 0 && wikiEvents.length > 0, 'the recorded readings carry NOW clearings and wiki returns')
  assert.equal(entries.length, nowEvents.length + wikiEvents.length)
  assert.deepEqual(entries.map(clip => clip.id).sort(), drawnByDayLane.map(clip => clip.id).sort(), 'the same clips, the same ids, as the World cut\'s Central · day lane')
  for (const clip of entries) {
    const event = index.get(clip.id)
    assert.ok(event, `${clip.id} resolves to its event (worldView.source.eventByClipId)`)
    assert.ok(['central-now', 'wiki-returns'].includes(event.stream), `${event.stream} is a Day stream`)
    assert.equal(clip.label, drawnByDayLane.find(item => item.id === clip.id).label, 'labelled as the World cut labels it')
  }
  assert.ok(!entries.some(clip => ['aikit-history', 'kernel-event-log'].includes(index.get(clip.id)?.stream)), 'machine NOWs and the kernel log keep their own lanes')
})

// ── 3 — streams whose owner read has not landed ──────────────────────────────────────────────────

test('Flows, Beings, Things and Goals stand as named, empty tracks; the absence is in the name tooltip, never a clip', () => {
  const categories = browserCategoriesOf('base')
  assert.equal(categories.find(category => category.id === 'central-days').state, 'cut', 'Days has an owner read')
  for (const [stream, category] of [['flows', 'central-flows'], ['beings', 'central-beings'], ['things', 'central-things'], ['goals', 'central-goals']]) {
    const declared = categories.find(item => item.id === category)
    assert.equal(declared.state, 'waiting', `${category} is waiting in the mode grammar: this adapter has no reader for it`)
    const track = set.tracks.find(item => item.id === `central:stream:${stream}`)
    assert.equal(set.clips.filter(clip => clip.trackId === track.id).length, 0, `${stream} has no clip`)
    assert.equal(track.kind, `stream · waiting — ${declared.hint}`, `${stream}: the owner's absence, in the grammar's words`)
    assert.match(track.kind, /not landed/)
  }
})

// ── 4 — rows and the ruler ───────────────────────────────────────────────────────────────────────

test('rows are days newest first — a day\'s record, then the entries it stood; the ruler is the covered days end to end', () => {
  // FIXTURE: four entries with explicit instants, a BST-night entry (23:40 UTC on the 13th is 00:40 on the 14th, London), and an
  // instant-less wiki return; two day records.
  const at = (day, hour, minute) => Date.UTC(2026, 9, day, hour, minute)
  const entry = (n, instant, civilDay) => ({stream: 'central-now', kind: 'now', subject_ref: `central:now:fixture:${n}`, instant_unix_ms: instant, summary: `entry ${n}`,
    day_ref: civilDay ? `central:day:control:root:${civilDay}` : null, evidence_refs: [`central:source:fixture:${n}`]})
  const fixture = [entry('C', at(14, 8, 15), '2026-10-14'), entry('A', at(13, 9, 30), '2026-10-13'), entry('B', at(13, 23, 40), '2026-10-14'),
    {stream: 'wiki-returns', kind: 'return', subject_ref: 'central:path:fixture:return.md', instant_unix_ms: null, summary: 'return.md', day_ref: null, evidence_refs: []}]
  const made = adapter.projectCentralTracks({
    records: {state: 'read', records: adapter.dayRecordsOf({entries: ['2026-09-12.md', '2026-10-14.md'].map(name => ({name, byte_len: 10, location: {path: `Control/agents/now/day/${name}`}}))})},
    civil: {state: 'live', events: fixture, absences: []},
  })
  const rowOf = clip => made.columns.find(column => column.id === clip.columnId).name
  // the day-lane clip ids are the World cut's: `day-clip:<subject>:<instant>:<ordinal>`.
  const byLabel = Object.fromEntries(made.clips.map(clip => [clip.label, clip]))
  assert.deepEqual(made.columns.map(column => column.name), ['2026-10-14', '10-14 · 1', '10-14 · 2', '10-13 · 1', '2026-09-12', 'no day · 1'])
  assert.deepEqual(made.clips.map(clip => clip.label), ['2026-10-14', 'entry B', 'entry C', 'entry A', '2026-09-12', 'return.md'], 'the face, then the day\'s entries by instant; the BST-night entry is the 14th\'s first')
  assert.equal(new Set(made.clips.map(clip => clip.columnId)).size, made.clips.length, 'one clip per track per row: the grid draws every one')
  assert.equal(made.columns.length, made.clips.length)
  assert.deepEqual(['entry B', 'entry C'].map(name => rowOf(byLabel[name])), ['10-14 · 1', '10-14 · 2'])
  // ruler: [no time][09-12][10-13][10-14], 1440 minutes each.
  assert.equal(made.ruler.unit, 'minutes (UTC) over the covered days, end to end')
  const starts = Object.fromEntries(made.clips.map(clip => [clip.label, clip.at.start]))
  assert.deepEqual(starts, {'return.md': 0, '2026-09-12': 1440, 'entry A': 2880 + 9 * 60 + 30, '2026-10-14': 4320, 'entry B': 4320, 'entry C': 4320 + 8 * 60 + 15},
    'a day record is a locator at its day\'s opening; an entry past a local midnight stands at its day\'s opening, not the day before')
  assert.equal(made.clips.every(clip => clip.at.end === undefined), true, 'no span is invented')
  assert.equal(made.ruler.label(starts['entry A']), '10-13 09:30')
  assert.equal(made.ruler.label(starts['entry C']), '10-14 08:15')
  assert.equal(made.ruler.label(starts['return.md']), 'no time · 1', 'no date is invented for an instant-less entry')
  // The Arrangement lays them by their own place, in order, on one ruler.
  const {placed} = placeClips(made)
  assert.deepEqual(placed.filter(item => item.clip.label.startsWith('entry')).sort((a, b) => a.start - b.start).map(item => item.clip.label), ['entry A', 'entry B', 'entry C'])
})

test('nothing is placed on the ruler by a guess: an entry with no instant, or whose day names no date, stands in the "no time" segment, in order', () => {
  // FIXTURE: one entry dated by its day but carrying no instant, one with an instant whose day ref names no date.
  const odd = [
    {stream: 'central-now', kind: 'now', subject_ref: 'central:now:fixture:noinstant', instant_unix_ms: null, summary: 'dated, no instant', day_ref: 'central:day:control:root:2026-10-12', evidence_refs: []},
    {stream: 'central-now', kind: 'now', subject_ref: 'central:now:fixture:nonsense', instant_unix_ms: Date.UTC(2026, 9, 12, 12), summary: 'day names no date', day_ref: 'central:day:control:root:today', evidence_refs: []},
  ]
  const made = adapter.projectCentralTracks({records: {state: 'read', records: []}, civil: {state: 'live', events: odd, absences: []}})
  const rowNames = made.columns.map(column => column.name)
  assert.ok(rowNames.includes('10-12 · 1 (no time)'), 'a dated entry with no instant is a row under its day, flagged')
  assert.ok(rowNames.includes('central:day:control:root:today · 1 (no time)'), 'a day that names no date keeps the owner\'s own word for it')
  assert.deepEqual(made.clips.map(clip => clip.at.start).sort(), [0, 1], 'both stand in the first segment, one minute apart, in the order read')
  assert.equal(made.ruler.label(0), 'no time · 1')
  assert.equal(made.ruler.label(1), 'no time · 2')
})

// ── 5 — honesty ──────────────────────────────────────────────────────────────────────────────────

test('what has not been read, or was refused, is named in the Day track — never an empty list passed off as read', () => {
  const kind = state => adapter.projectCentralTracks(state).tracks[0].kind
  assert.equal(kind({records: {state: 'reading'}, civil: {state: 'reading'}}), 'stream · day records being read · civil field being read')
  assert.equal(kind({records: {state: 'unavailable', reason: 'the day-records read refused'}, civil: {state: 'unavailable', reason: 'no carrier'}}),
    'stream · day records unread (the day-records read refused) · civil field unread (no carrier)')
  assert.equal(kind(reading), `stream · 6 day records · ${nowEvents.length + wikiEvents.length} ${nowEvents.length + wikiEvents.length === 1 ? 'entry' : 'entries'} from the civil field`)
  const absences = [{stream: 'central-now', reason: 'owner-timeout', owner_words: 'the NOW register did not answer'}, {stream: 'aikit-history', reason: 'owner-absent', owner_words: ''}]
  assert.equal(kind({records: {state: 'read', records: []}, civil: {state: 'live', events: [], absences}}),
    'stream · 0 day records · 0 entries from the civil field · central-now gave nothing: owner-timeout — the NOW register did not answer',
    'a Day stream\'s absence is named with the owner\'s words; a machine stream\'s is the World cut\'s to name, not this track\'s')
})

test('the adapter reads and presents; it launches, records and stops nothing, and claims no state the owner did not give', () => {
  assert.equal(set.actions, undefined, 'no owner op: the grid stays read-only')
  for (const clip of set.clips) {
    for (const field of ['status', 'launch', 'takes', 'span', 'state']) assert.equal(clip[field], undefined, `${clip.id} claims no ${field}`)
  }
  assert.equal(set.tracks.some(track => track.needle !== undefined), false, 'no needle without an owner reading of where the day has got to')
  assert.equal(adapter.centralTrackAdapter.id, 'central-stream-tracks')
  assert.deepEqual(adapter.centralTrackAdapter.project(reading).tracks.map(track => track.id), set.tracks.map(track => track.id), 'the registered adapter is the same projection')
})

// ── 6 — the shared views draw it ─────────────────────────────────────────────────────────────────

test('the shared Session grid draws the five streams, every row, and the Day track\'s clips', () => {
  const markup = renderToStaticMarkup(React.createElement(SessionGrid, {set, selection: {ref: records[0].path, select() {}}}))
  assert.equal((markup.match(/data-track="/g) ?? []).length, 5)
  assert.deepEqual([...markup.matchAll(/class="thd[^"]*" title="([^"]*)"/g)].map(match => match[1].split(' · ')[0]).slice(0, 5), ['Day', 'Flows', 'Beings', 'Things', 'Goals'])
  assert.match(markup, /title="Flows · stream · waiting — /, 'the owner\'s absence is in the name tooltip')
  assert.match(markup, /data-clip="Control\/agents\/now\/day\/2026-09-12\.md"/)
  assert.match(markup, /class="cs clip sel"/, 'the selected day record stands lit')
  assert.equal((markup.match(/data-clip="/g) ?? []).length, set.clips.length, 'every clip has its cell')
  assert.equal((markup.match(/class="stop-launch" disabled=""/g) ?? []).length, set.columns.length, 'a row per stop, none launchable: the owner gives no op')
})

test('the shared Arrangement lays the same clips on one civil ruler, each at its own place', () => {
  const markup = renderToStaticMarkup(React.createElement(ArrangementRuler, {set, selection: {select() {}}}))
  assert.equal((markup.match(/data-track="/g) ?? []).length, 5)
  assert.equal((markup.match(/data-clip="/g) ?? []).length, set.clips.length, 'what the Session shows, the ruler shows')
  assert.match(markup, /aria-label="Ruler in minutes \(UTC\) over the covered days, end to end"/)
  const {placed, end} = placeClips(set)
  assert.equal(placed.length, set.clips.length)
  assert.ok(end >= Math.max(...set.clips.map(clip => clip.at.start)), 'the ruler reaches the last entry')
})

// ── 7 — the hook ─────────────────────────────────────────────────────────────────────────────────

test('the hook reads the World cut\'s civil read as it is published, names the day records still being read, and returns five tracks', () => {
  const live = {status: 'live', error: null, events, absences: [], readAtUnixMs: 1}
  const Probe = ({transport, world}) => {
    const tracks = useCentralTracks({transport, set: null, document: null, world})
    return React.createElement('pre', null, JSON.stringify({tracks: tracks.tracks.map(track => track.name), kind: tracks.tracks[0].kind, entries: tracks.clips.length}))
  }
  const rendered = JSON.parse(/<pre>(.*)<\/pre>/.exec(renderToStaticMarkup(React.createElement(Probe, {transport: {kind: 'unavailable', reason: 'carrier down'}, world: {source: live}})))[1].replaceAll('&quot;', '"'))
  assert.deepEqual(rendered.tracks, ['Day', 'Flows', 'Beings', 'Things', 'Goals'])
  assert.equal(rendered.entries, nowEvents.length + wikiEvents.length, 'the entries come from the published reading; no second poller')
  assert.match(rendered.kind, /day records being read/, 'the first render has not read the day records yet, and says so')
  const none = JSON.parse(/<pre>(.*)<\/pre>/.exec(renderToStaticMarkup(React.createElement(Probe, {transport: undefined, world: undefined})))[1].replaceAll('&quot;', '"'))
  assert.deepEqual(none.tracks, ['Day', 'Flows', 'Beings', 'Things', 'Goals'], 'with no published reading the streams still stand')
  assert.match(none.kind, /civil field unread \(the shell publishes no civil reading to this pane\)/)
})

test('the civil reading is the published one: live, being read, or unread with the owner\'s words', () => {
  assert.deepEqual(civilReadingOf({status: 'live', events: [1], absences: [2]}), {state: 'live', events: [1], absences: [2]})
  assert.deepEqual(civilReadingOf({status: 'reading', error: null}), {state: 'reading'})
  assert.deepEqual(civilReadingOf({status: 'unavailable', error: 'Temporal events reading unavailable'}), {state: 'unavailable', reason: 'Temporal events reading unavailable'})
  assert.equal(civilReadingOf({status: 'unavailable', error: null}).reason, 'the kernel temporal read is unavailable')
  assert.equal(civilReadingOf(undefined).state, 'unavailable')
})

test('the day records are read through the owner\'s listing route, and a refusal is the reading', async () => {
  assert.deepEqual(await readDayRecords(undefined), {state: 'unavailable', reason: 'the shell published no kernel carrier to this pane'})
  assert.deepEqual(await readDayRecords({kind: 'unavailable', reason: 'no kernel transport'}), {state: 'unavailable', reason: 'no kernel transport'})
  const realFetch = globalThis.fetch
  const sent = []
  try {
    // FIXTURE: the bridge's answers. The recorded listing above stands in for the owner's directory reading.
    globalThis.fetch = async (url, init) => { sent.push([url, JSON.parse(init.body)]); return {json: async () => ({ok: true, outcome: {result: 'directory_read', directory: {...listing, schema: 'central.directory-reading/v1'}}})} }
    const read = await readDayRecords({kind: 'bridge', url: 'http://bridge.fixture'})
    assert.deepEqual(sent, [['http://bridge.fixture/op', {op: 'files_list', path: 'Control/agents/now/day'}]], 'one files_list at the root register\'s day surface — the browser\'s own route')
    assert.equal(read.state, 'read')
    assert.deepEqual(read.records.map(record => record.name), records.map(record => record.name))
    globalThis.fetch = async () => ({json: async () => ({ok: false, error: 'the owner refused the listing'})})
    assert.deepEqual(await readDayRecords({kind: 'bridge', url: 'http://bridge.fixture'}), {state: 'unavailable', reason: 'the owner refused the listing'})
    globalThis.fetch = async () => ({json: async () => ({ok: true, outcome: {result: 'something_else'}})})
    assert.equal((await readDayRecords({kind: 'bridge', url: 'http://bridge.fixture'})).state, 'unavailable', 'an answer that is not a directory reading is not a list of days')
  } finally {
    globalThis.fetch = realFetch
  }
})
