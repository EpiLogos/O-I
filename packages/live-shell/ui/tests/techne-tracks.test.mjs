// T-TRACKS-TECHNE: Technē's readings as tracks and its walks as stops, for the shared Session and Arrangement (manual §3 and §8; lock
// §9.1 Technē row, §9.2 a walk). Over the real projections, headless.
//
// Channels (each claim below is carried by exactly one):
// - REAL ADAPTERS over a FIXTURE CORPUS: the Aion reading, the field thread, the Red Book and the dynamics route are what the
//   production projections (projections/atlas/aionTimeline.ts, walkTimeline.ts) emit over the atlas's fixture corpus
//   (provider/fixtureCorpus.ts, the same inputs tests/journey-walks.test.mjs uses). The shape is the product's; the people,
//   places and years in it are a fixture's.
// - FIXTURE: the run receipts, a day-lane event, a conversation receipt, the Earth's standing and the BCE and Expression-bearing
//   walks. Run receipts are projected by the real run, day and conversation adapters (timeline/*TrackAdapter.ts); no kernel read
//   is made. Fields follow the kernel's temporal row (timeline/timeSpine.ts TemporalEventRow).
// - SOURCE TEXT: the place this adapter mirrors a constant from (suiteProvider.ts) is read and held to what is mirrored. The
//   ruler's break and the Expression rule were mirrored from the World cut presentation and JourneyRows until those were
//   deleted (15 Oct); the adapter is now their one declaration.
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
const adapter = await import('../src/timeline/techneTrackAdapter.ts')
const {walkReaches} = await import('../src/timeline/worldTrackAdapter.ts')
const {projectAionReading} = await import('../src/projections/atlas/aionTimeline.ts')
const {projectFieldThread, projectRedbookWalk, projectDynamicsRoute} = await import('../src/projections/atlas/walkTimeline.ts')
const {fixtureCorpus} = await import('../src/projections/atlas/provider/fixtureCorpus.ts')
const {buildModel} = await import('../src/projections/atlas/src/data/model.ts')
const {projectRunTracks, runClipEventIndex} = await import('../src/timeline/runTrackAdapter.ts')
const {projectDayTracks, dayClipEventIndex} = await import('../src/timeline/dayTrackAdapter.ts')
const {projectConversationTracks, conversationClipEventIndex} = await import('../src/timeline/conversationTrackAdapter.ts')
const {SessionGrid} = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler, placeClips} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {useTechneTracks, techneControls} = await import('../src/frame/tracks/useTechneTracks.ts')
const {browserCategoriesOf} = await import('../src/shell/modeGrammar.ts')
const {walkStopFocus} = await import('../src/timeline/journeyWalks.ts')
const standing = await import('../src/projections/atlas/provider/suiteStanding.ts')
const suiteStanding = {publish: standing.publishSuiteStanding, reset: standing.resetSuiteStanding, IDLE_STANDING: standing.IDLE_STANDING, NO_COUNTS: standing.NO_COUNTS}

const source = async path => readFile(new URL(path, import.meta.url), 'utf8')

// ── the readings ─────────────────────────────────────────────────────────────────────────────────

// REAL ADAPTERS over the FIXTURE CORPUS.
const corpus = fixtureCorpus()
const model = buildModel(corpus.field)
const READING = corpus.history.readings[0]
const THREAD = READING.threads[0]
const aionSet = projectAionReading({history: corpus.history, providerId: 'fixture'})
const fieldSet = projectFieldThread(model, 'family', 'lighthouse')
const redbookSet = projectRedbookWalk(model, {
  generatedAt: 'x', licence: {plates: '', text: '', vaultPathNote: ''}, plates: {vaultRelativeDir: '', urlPrefix: '', served: 'dev-only', note: ''},
  mode: {title: 'Liber Novus', subtitle: '', subject: 'jung', oneLine: ''},
  sections: [{id: 'descent', name: 'Descent', oneLine: ''}],
  stops: [{id: 'eddystone-1698', sectionId: 'descent'}, {id: 'curated-not-in-field', sectionId: 'descent'}],
  genesis: [],
})
const dynamicsSet = projectDynamicsRoute({
  version: 1, title: 'The lens walk', line: '',
  movements: [{id: 'm1', n: 'I', title: 'First', line: '', stops: [
    {id: 's1', figure: 'f', line: '', concept: 'strange-attractor', familyIds: ['lighthouse']},
    {id: 's2', figure: 'f', line: '', name: 'Named stop', familyIds: []},
  ]}],
})

// FIXTURE: the temporal rows the run, day and conversation lanes are drawn from.
const at = (day, hour, minute) => Date.UTC(2026, 9, day, hour, minute)
const isoDay = instant => new Date(instant).toISOString().slice(0, 10)
const row = (stream, subject, instant, summary, dayRef) => ({stream, kind: 'event', subject_ref: subject, instant_unix_ms: instant, summary,
  day_ref: dayRef ?? (instant === null ? null : `central:day:control:root:${isoDay(instant)}`), stream_position: `${subject}@${instant}`, evidence_refs: [`fixture:${subject}:${instant}`]})
const events = [
  row('factory-runs', 'agent-session/s-alpha', at(13, 9, 5), 'attempt 1 failed'),
  row('factory-runs', 'agent-session/s-alpha', at(14, 8, 30), 'attempt 2 correlating'),
  row('factory-runs', 'run:214', at(14, 13, 40), 'receipt'),
  row('factory-runs', 'run:215', null, 'dated by its day, no instant', 'central:day:control:root:2026-10-12'),
  row('central-now', 'central:now:fixture:1', at(14, 7, 0), 'a NOW clearing (Central\'s day)'),
  row('aikit-history', 'aikit:history:fixture', at(14, 7, 5), 'a machine NOW'),
  row('kernel-event-log', 'kernel:event:fixture', at(14, 7, 6), 'a kernel event'),
  row('conversation', 'session-space/fixture', at(14, 9, 0), 'a conversation receipt'),
]
const runSet = projectRunTracks(events, [{sessionRef: 'agent-session/s-alpha'}, {sessionRef: 'agent-session/s-idle'}])
const daySet = projectDayTracks(events)
const conversationSet = projectConversationTracks(events)
const eventByClipId = new Map([...runClipEventIndex(events), ...dayClipEventIndex(events), ...conversationClipEventIndex(events)])
/** The World cut's sets, in the order it merges them (useWorldTemporalReading.ts): the lanes, then the atlas's Aion reading. */
const worldSets = [daySet, runSet, conversationSet, aionSet]

const live = (sets, map = new Map(), todayYear = 2026) => ({state: 'live', sets, eventByClipId: map, todayYear})
const project = (sets, extra = {}, map = new Map()) => adapter.projectTechneTracks({world: live(sets, map), ...extra})
const STREAM_TRACKS = adapter.TECHNE_STREAM_IDS.map(adapter.techneStreamTrackId)
const columnOf = (set, clip) => set.columns.find(column => column.id === clip.columnId)

// ── 1 — the six streams ──────────────────────────────────────────────────────────────────────────

test('Technē shows six streams in the lock\'s order, whatever has been read; an unread World draws nothing', () => {
  assert.deepEqual([...adapter.TECHNE_STREAM_IDS], ['readings', 'occurrences', 'journeys', 'runs', 'revisions', 'sky'])
  for (const world of [{state: 'reading'}, {state: 'unavailable', reason: 'no carrier'}, live([])]) {
    const bare = adapter.projectTechneTracks({world})
    assert.deepEqual(bare.tracks.map(track => [track.id, track.name]), STREAM_TRACKS.map((id, i) => [id, ['Readings', 'Occurrences', 'Journeys', 'Runs', 'Revisions', 'Sky'][i]]), `${world.state}: the streams still stand`)
    assert.deepEqual([bare.columns, bare.clips, bare.ruler, bare.walks, bare.actions, bare.layers, bare.sections], [[], [], undefined, undefined, undefined, undefined, undefined], `${world.state}: nothing is drawn that was not read`)
  }
  assert.match(adapter.projectTechneTracks({world: {state: 'reading'}}).tracks[0].kind, /civil field is being read/)
  assert.match(adapter.projectTechneTracks({world: {state: 'unavailable', reason: 'no carrier'}}).tracks[3].kind, /civil field is unread \(no carrier\)/)
})

test('the World cut\'s temporal read is read as published: live, being read, or unread with the owner\'s words', () => {
  const published = {status: 'live', error: null, now: {instantUnixMs: Date.UTC(2026, 9, 14, 10), dayRef: null, source: 'fixture'}, sets: [aionSet], eventByClipId: new Map(), events: [], absences: []}
  const world = adapter.worldReadingOf(published)
  assert.equal(world.state, 'live')
  assert.equal(world.sets, published.sets, 'the sets are the published ones, not a copy')
  assert.equal(world.todayYear, 2026)
  assert.equal(adapter.worldReadingOf({...published, now: null}).todayYear, null)
  assert.deepEqual(adapter.worldReadingOf({status: 'reading', error: null}), {state: 'reading'})
  assert.deepEqual(adapter.worldReadingOf({status: 'unavailable', error: 'Temporal events reading unavailable'}), {state: 'unavailable', reason: 'Temporal events reading unavailable'})
  assert.equal(adapter.worldReadingOf({status: 'unavailable', error: null}).reason, 'the kernel temporal read is unavailable')
  assert.equal(adapter.worldReadingOf(undefined).state, 'unavailable')
})

// ── 2 — a reading, its thread, its stops ─────────────────────────────────────────────────────────

test('a reading is a track of its events, and its whole walk and its threads are tracks of their stops, under the ids the World cut gave them', () => {
  const set = project([aionSet])
  assert.deepEqual(set.tracks.slice(0, 3).map(track => track.id), aionSet.tracks.map(track => track.id), 'the reading, its whole walk, its thread: the sources\' own tracks')
  assert.deepEqual(set.tracks.slice(0, 3).map(track => track.layerId), [READING.id, READING.id, READING.id])
  assert.match(set.tracks[0].kind, /^reading · 5 events$/)
  assert.match(set.tracks[1].kind, /^a reading's whole walk · derived on read · 5 stops$/)
  assert.match(set.tracks[2].kind, /^a reading's thread · curated · 4 stops$/)
  assert.deepEqual(set.tracks.slice(3).map(track => track.id), STREAM_TRACKS.slice(1), 'every stream without an owner read stands, named')
  assert.equal(set.clips.length, aionSet.clips.length, 'every source clip, and no clip that was not read')
  for (const source of aionSet.clips) {
    const clip = set.clips.find(item => item.id === source.id)
    assert.ok(clip, `${source.id} keeps its id`)
    assert.equal(clip.trackId, source.trackId)
    assert.equal(clip.label, source.label)
    assert.equal(clip.state, source.state, 'the family\'s own word is kept verbatim')
  }
  assert.deepEqual(set.layers, aionSet.layers)
})

test('a walk stop is a row, n of N, walk after walk; a reading\'s event stands in the row of the whole walk\'s stop for the same event', () => {
  const set = project([aionSet])
  const whole = aionSet.walks.find(walk => walk.derived)
  const thread = aionSet.walks.find(walk => !walk.derived)
  assert.equal(whole.stops.length, 5)
  assert.deepEqual(set.columns.map(column => column.name), [...whole.stops.map((stop, i) => `${i + 1}/5 · ${stop.label}`), ...thread.stops.map((stop, i) => `${i + 1}/4 · ${stop.label}`)],
    'the whole reading\'s stops, then the thread\'s; the events add no row of their own')
  const eventClips = set.clips.filter(clip => clip.trackId === aionSet.tracks[0].id)
  const wholeClips = set.clips.filter(clip => clip.trackId === aionSet.tracks[1].id)
  assert.equal(eventClips.length, 5)
  for (const event of eventClips) {
    const stood = wholeClips.find(clip => clip.label === event.label)
    assert.ok(stood, `${event.label} is a stop of the whole walk`)
    assert.equal(event.columnId, stood.columnId, `${event.label}: the stop stands its event`)
  }
  assert.equal(new Set(set.clips.map(clip => `${clip.trackId} ${clip.columnId}`)).size, set.clips.length, 'one clip per track per row: the grid draws every one')
  // A stop launches into the walk's next stop; the last launches into nothing.
  assert.deepEqual(wholeClips.map(clip => clip.launch), whole.stops.map((stop, i) => whole.stops[i + 1] ? {follow: `stop ${i + 2}/5 · ${whole.stops[i + 1].label}`} : undefined))
})

test('walks ride along as the contract names them, re-pointed at the clips this set holds', () => {
  const set = project([aionSet])
  assert.deepEqual(set.walks.map(walk => walk.id), aionSet.walks.map(walk => walk.id))
  for (const walk of set.walks) {
    const reached = walkReaches(set, walk.id)
    for (const stop of walk.stops) {
      assert.ok(set.clips.some(clip => clip.id === stop.clipId), `${walk.id}: ${stop.id} stands a clip of this set`)
      assert.ok(reached.has(stop.id) && reached.has(stop.clipId))
    }
    const sourceWalk = aionSet.walks.find(item => item.id === walk.id)
    assert.deepEqual(walk.stops.map(stop => [stop.id, stop.year, stop.also, stop.place]), sourceWalk.stops.map(stop => [stop.id, stop.year, stop.also, stop.place]), 'year, place and bucket-mates are the source\'s')
  }
  assert.deepEqual(THREAD.eventIds, set.walks.find(walk => walk.layerId === READING.id && !walk.derived).stops.map(stop => stop.id))
})

// ── 3 — the ruler ────────────────────────────────────────────────────────────────────────────────

test('one ruler: a year is placed by the atlas\'s deep-time scale, in order, labelled as the year, whatever its sign', () => {
  const set = project([aionSet])
  const wholeClips = set.clips.filter(clip => clip.trackId === aionSet.tracks[1].id)
  const years = aionSet.walks.find(walk => walk.derived).stops.map(stop => stop.year)
  assert.deepEqual(years, [...years].sort((a, b) => a - b), 'the whole walk is in time order')
  const starts = wholeClips.map(clip => clip.at.start)
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b))
  assert.equal(new Set(starts).size, starts.length)
  years.forEach((year, i) => assert.equal(set.ruler.label(starts[i]), String(year), `${year} labels as itself`))
  assert.equal(set.ruler.unit, 'deep-time years (the atlas\'s non-linear scale)')
  assert.equal(starts[starts.length - 1], adapter.TECHNE_RULER_UNITS, 'the latest year is the end of the deep ruler (2064 is beyond today, clamped)')
  assert.equal(set.clips.every(clip => clip.span === undefined && clip.at.end === undefined), true, 'a source\'s years are not carried as a span, and no end is invented')
  // The epochs are sections on the same ruler: nested, half-open, in the same units.
  assert.deepEqual(set.sections.map(section => [section.id, section.parentId, section.layerId]), aionSet.sections.map(section => [section.id, section.parentId, section.layerId]))
  for (const section of set.sections) {
    const sourceSection = aionSet.sections.find(item => item.id === section.id)
    assert.ok(section.span.start >= 0 && section.span.end > section.span.start)
    assert.equal(set.ruler.label(section.span.start), String(sourceSection.span.start), `${section.id} starts where its year is`)
  }
})

test('before the common era the ruler still starts at 0: a BCE year is placed by the scale, never by its sign', () => {
  // FIXTURE: a field thread through deep time.
  const deep = {columns: [], tracks: [], clips: [], walks: [{id: 'field:deep', name: 'Deep', kind: 'field-thread', derived: true, stops: [
    {id: 'lascaux', label: 'Lascaux', year: -17000, also: []}, {id: 'caesar', label: 'Caesar', year: -44, also: []}, {id: 'rome', label: 'Rome', year: 476, also: []},
  ]}]}
  const set = project([deep])
  const starts = set.clips.map(clip => clip.at.start)
  assert.equal(Math.min(...starts), 0)
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b))
  assert.deepEqual(set.clips.map(clip => set.ruler.label(clip.at.start)), ['17,000 BCE', '44 BCE', '476'])
  assert.deepEqual(set.tracks[1].id, 'techne:walk:field:deep', 'a walk whose stops stand no clip is a track of its own')
  assert.match(set.tracks[1].kind, /^a subject's occurrences · derived on read · 3 stops$/)
})

test('the same year stands at the same place whichever stream it is on', () => {
  const set = project([aionSet, fieldSet, redbookSet])
  const clipAt = new Map(set.clips.map(clip => [clip.id, clip]))
  const placesOf = new Map()
  for (const walk of set.walks) {
    for (const stop of walk.stops) {
      if (stop.year === undefined) continue
      const found = placesOf.get(stop.year) ?? new Map()
      found.set(clipAt.get(stop.clipId).trackId, clipAt.get(stop.clipId).at.start)
      placesOf.set(stop.year, found)
    }
  }
  const shared = [...placesOf.entries()].filter(([, byTrack]) => byTrack.size >= 2)
  assert.ok(shared.length > 0, 'a year stands on more than one stream (1698: the Aion reading, the field thread and the Red Book)')
  for (const [year, byTrack] of shared) assert.equal(new Set(byTrack.values()).size, 1, `${year}: every stream puts it at one place on the one ruler`)
  // and the reading's event clips are at their stops' places too
  for (const event of set.clips.filter(clip => clip.trackId === aionSet.tracks[0].id)) {
    const stop = set.walks.flatMap(walk => walk.stops).find(item => item.label === event.label && item.year !== undefined)
    assert.equal(event.at.start, clipAt.get(stop.clipId).at.start, `${event.label}: the event is where its stop is`)
  }
})

test('the second of two readings that extend one another is a layer: its tracks follow the first\'s, named by their reading', () => {
  // FIXTURE: a later reading over the same corpus, its events and thread under ids of their own.
  const later = {...READING, id: 'reading-two', title: 'A later reading', extends: READING.id,
    events: READING.events.map(event => ({...event, id: `${event.id}-2`})),
    threads: [{...THREAD, id: `${THREAD.id}-2`, eventIds: THREAD.eventIds.map(id => `${id}-2`)}]}
  const two = projectAionReading({history: {...corpus.history, readings: [READING, later]}, providerId: 'fixture'})
  const set = project([two])
  assert.deepEqual(set.layers.map(layer => [layer.id, layer.extends]), [[READING.id, undefined], ['reading-two', READING.id]])
  const readingTracks = set.tracks.filter(track => track.layerId !== undefined)
  assert.deepEqual(readingTracks.map(track => track.layerId), [READING.id, READING.id, READING.id, 'reading-two', 'reading-two', 'reading-two'], 'each reading\'s events, then the walks through it')
  assert.match(readingTracks[3].kind, new RegExp(`^reading · 5 events · extends ${READING.title}$`))
  assert.ok(readingTracks.slice(1, 3).every(track => track.name.startsWith(`${READING.title} · `)), 'with two readings the walks say which they are through')
  assert.ok(readingTracks.slice(4).every(track => track.name.startsWith('A later reading · ')))
  assert.equal(set.clips.length, two.clips.length)
})

test('a clip two stops name is stood once; the second stop stands itself, so no id is twice in the set', () => {
  // FIXTURE: the same event twice in a thread.
  const twice = {columns: [], tracks: [{id: 't', name: 'T', kind: 'walk'}], clips: [{id: 'c1', trackId: 't', columnId: 'x', label: 'Once'}],
    walks: [{id: 'w', name: 'W', kind: 'aion-thread', derived: false, layerId: 'r', stops: [{id: 'e', label: 'Once', clipId: 'c1', year: 1900, also: []}, {id: 'e', label: 'Once', clipId: 'c1', year: 1900, also: []}]}]}
  const set = project([twice])
  assert.deepEqual(set.clips.map(clip => clip.id), ['c1', 'techne:stop:w:2'])
  assert.equal(set.clips[0].trackId, set.clips[1].trackId)
  assert.deepEqual(set.walks[0].stops.map(stop => stop.clipId), ['c1', 'techne:stop:w:2'])
  assert.equal(set.clips[0].at.start, set.clips[1].at.start)
})

// ── 4 — runs, and the declared break into today ──────────────────────────────────────────────────

test('the runs are the World cut\'s run lanes, newest first; Central\'s day, the machines, the kernel log and conversations are not Technē\'s', () => {
  const set = project(worldSets, {}, eventByClipId)
  const ids = set.tracks.map(track => track.id)
  assert.deepEqual(ids, [...aionSet.tracks.map(track => track.id), ...STREAM_TRACKS.slice(1, 3), ...runSet.tracks.map(track => track.id), ...STREAM_TRACKS.slice(4)])
  for (const lane of [...daySet.tracks, ...conversationSet.tracks]) assert.ok(!ids.includes(lane.id), `${lane.id} stays with Central`)
  assert.ok(ids.includes('run:agent-session/s-idle'), 'an admitted run with no receipt is an honestly empty track')
  const runClips = set.clips.filter(clip => runSet.clips.some(source => source.id === clip.id))
  assert.equal(runClips.length, 4)
  assert.deepEqual(runClips.map(clip => clip.id).sort(), runSet.clips.map(clip => clip.id).sort(), 'ids are the World cut\'s')
  const runRows = set.columns.filter(column => column.id.startsWith('techne:row:run:'))
  assert.deepEqual(runRows.map(column => column.name.replace(/ · .*/, '')), ['10-14 13:40', '10-14 08:30', '10-13 09:05', 'no time'], 'a row per receipt, newest first, the undated one last')
  assert.equal(set.columns.length, 9 + 4, 'the walk stops, then the receipts')
  for (const clip of runClips) {
    assert.equal(clip.standing, runSet.clips.find(source => source.id === clip.id).standing, 'standing is the one authority\'s reading, kept')
    assert.equal(clip.standing.visual, 'sourced')
    assert.ok(eventByClipId.get(clip.id), `${clip.id} resolves to its event: the occasion route`)
  }
})

test('the declared break into today: deep history keeps 61% of the ruler, the covered civil days take the rest, hours in UTC', async () => {
  assert.equal(adapter.TECHNE_DEEP_SHARE, 0.61)
  const set = project(worldSets, {}, eventByClipId)
  const byLabel = Object.fromEntries(set.clips.map(clip => [clip.label, clip]))
  const noTime = set.clips.filter(clip => set.ruler.label(clip.at.start).startsWith('no time'))
  assert.deepEqual(noTime.map(clip => clip.label), ['dated by its day, no instant'], 'the receipt with no instant stands in the no-time segment, no date invented')
  const slots = 1
  const deepStart = slots * 10
  const deepEnd = deepStart + 6100
  assert.equal(set.ruler.unit, 'no-time slots, then deep-time years (the atlas\'s non-linear scale), then UTC hours of the covered days')
  const deepClips = set.clips.filter(clip => clip.trackId === aionSet.tracks[0].id)
  assert.ok(deepClips.every(clip => clip.at.start >= deepStart && clip.at.start <= deepEnd), 'the years are in the first 61%')
  const civil = set.clips.filter(clip => runSet.clips.some(source => source.id === clip.id) && !noTime.includes(clip))
  assert.equal(civil.length, 3)
  assert.ok(civil.every(clip => clip.at.start >= deepEnd), 'the days come after the break')
  assert.equal(set.ruler.label(deepEnd), '10-13 00:00', 'the break opens the first covered day')
  assert.match(set.ruler.label(deepEnd - 1), /^\d+$/, 'just before the break is still a year')
  assert.deepEqual(civil.map(clip => set.ruler.label(clip.at.start)).sort(), ['10-13 09:05', '10-14 08:30', '10-14 13:40'])
  assert.ok(byLabel['receipt'].at.start > byLabel['attempt 2 correlating'].at.start && byLabel['attempt 2 correlating'].at.start > byLabel['attempt 1 failed'].at.start)
  const {placed, end} = placeClips(set)
  assert.equal(placed.length, set.clips.length, 'every clip has a place of its own: none falls back to its row')
  assert.equal(end, Math.max(...set.clips.map(clip => clip.at.start)), 'the ruler is the span of what was read, not of the rows')
})

test('a run lane beyond the World cut\'s bound is named, not drawn', () => {
  // FIXTURE: thirteen run subjects, one receipt each, past the World cut's twelve-lane bound.
  const many = Array.from({length: 13}, (_, i) => row('factory-runs', `run:${i + 100}`, at(14, 6, i), `receipt ${i}`))
  const world = projectRunTracks(many)
  const overflow = world.tracks.find(track => track.kind === 'run-overflow')
  assert.ok(overflow, 'the World cut names the lanes it did not draw (the kind this adapter reads)')
  const set = project([world], {}, new Map(runClipEventIndex(many)))
  const track = set.tracks.find(item => item.id === overflow.id)
  assert.equal(track.name, overflow.name)
  assert.equal(set.clips.filter(clip => clip.trackId === overflow.id).length, 0)
  assert.match(track.kind, /beyond the lane bound/)
})

// ── 5 — occurrences, journeys ────────────────────────────────────────────────────────────────────

test('a subject\'s field thread is an Occurrences track; the Red Book and the dynamics route are Journeys; their stops stand clips of their own', () => {
  const set = project([aionSet, fieldSet, redbookSet, dynamicsSet])
  const ids = set.tracks.map(track => track.id)
  const fieldWalk = fieldSet.walks[0]
  assert.deepEqual(ids.slice(3), ['techne:walk:' + fieldWalk.id, 'techne:walk:redbook', 'techne:walk:dynamics-route', ...STREAM_TRACKS.slice(3)])
  assert.match(set.tracks[3].kind, /^a subject's occurrences · derived on read · \d+ stops$/)
  assert.match(set.tracks[4].kind, /^a journey · the Red Book · curated · 2 stops$/)
  assert.match(set.tracks[5].kind, /^a journey · the dynamics route · curated · 2 stops$/)
  const dynamics = set.clips.filter(clip => clip.trackId === 'techne:walk:dynamics-route')
  assert.deepEqual(dynamics.map(clip => clip.id), ['techne:stop:dynamics-route:1', 'techne:stop:dynamics-route:2'])
  assert.deepEqual(dynamics.map(clip => clip.label), dynamicsSet.walks[0].stops.map(stop => stop.label))
  assert.deepEqual(dynamics.map(clip => columnOf(set, clip).name), dynamicsSet.walks[0].stops.map((stop, i) => `${i + 1}/2 · ${stop.label}`))
  // The route's stops carry no year: they stand in the no-time slots, in order, and no date is invented. So does the Red Book's
  // curated stop the field does not carry.
  const undated = set.clips.filter(clip => set.ruler.label(clip.at.start).startsWith('no time'))
  assert.deepEqual(new Set(undated.map(clip => clip.label)), new Set(['curated-not-in-field', ...dynamics.map(clip => clip.label)]))
  assert.ok(Math.max(...undated.map(clip => clip.at.start)) < Math.min(...set.clips.filter(clip => !undated.includes(clip)).map(clip => clip.at.start)), 'the no-time slots come first')
  assert.equal(set.ruler.unit, 'no-time slots, then deep-time years (the atlas\'s non-linear scale)')
  // The field thread keeps its bucket-mates: nothing is dropped.
  assert.deepEqual(set.walks.find(walk => walk.id === fieldWalk.id).stops.map(stop => stop.also), fieldWalk.stops.map(stop => stop.also))
})

test('the kinds this adapter reads by are what the projections emit', () => {
  assert.ok(aionSet.tracks.some(track => track.kind === adapter.READING_EVENTS_TRACK_KIND))
  assert.deepEqual(aionSet.walks.map(walk => walk.kind).sort(), [adapter.READING_THREAD_WALK_KIND, adapter.WHOLE_READING_WALK_KIND].sort())
  assert.equal(fieldSet.walks[0].kind, adapter.FIELD_THREAD_WALK_KIND)
  assert.equal(redbookSet.walks[0].kind, adapter.REDBOOK_WALK_KIND)
  assert.equal(dynamicsSet.walks[0].kind, adapter.DYNAMICS_ROUTE_WALK_KIND)
  assert.deepEqual(new Set(runSet.tracks.map(track => track.kind)), new Set(['run']))
  assert.deepEqual([...adapter.RUN_TRACK_KINDS].sort(), ['run', 'run-overflow'])
})

// ── 6 — streams with no owner read ───────────────────────────────────────────────────────────────

test('Occurrences, Journeys, Revisions and Sky stand as named, empty tracks; the absence is in the name tooltip, never a clip', () => {
  const set = project([aionSet])
  for (const stream of ['occurrences', 'journeys', 'runs', 'revisions', 'sky']) {
    const track = set.tracks.find(item => item.id === adapter.techneStreamTrackId(stream))
    assert.ok(track, `${stream} stands`)
    assert.equal(set.clips.filter(clip => clip.trackId === track.id).length, 0, `${stream} has no clip`)
    assert.match(track.kind, /^stream · /)
  }
  const kind = stream => set.tracks.find(item => item.id === adapter.techneStreamTrackId(stream)).kind
  const journeys = browserCategoriesOf('techne').find(category => category.id === 'techne-journeys')
  assert.equal(journeys.state, 'waiting', 'the grammar declares Journeys waiting: this adapter has no walk to show')
  assert.equal(kind('journeys'), `stream · waiting — ${journeys.hint}`, 'the owner\'s absence, in the grammar\'s words')
  assert.match(kind('revisions'), /no stream of the civil field reads a source's revisions/)
  assert.match(kind('sky'), /ql\.sky-snapshot\/v1/)
  assert.match(kind('runs'), /no run is admitted or has a receipt/)
})

test('a missing Aion reading is named with its owner\'s cause, and the cause holds: the suite provider yields no history', async () => {
  const kind = adapter.projectTechneTracks({world: live([])}).tracks[0].kind
  assert.match(kind, /no Aion reading is carried: the atlas publishes one only when its corpus bundle holds a history, and the suite provider yields none/)
  assert.doesNotMatch(await source('../src/projections/atlas/provider/suiteProvider.ts'), /history/i, 'suiteProvider.ts neither reads nor returns a history')
  assert.match(await source('../src/projections/atlas/AtlasProjectionPanel.tsx'), /publishAtlasAionReading\(bundle\.history \? \{providerId: SUITE_PROVIDER_ID, history: bundle\.history\} : null\)/, 'and the atlas publishes a reading only from the bundle\'s history')
})

test('the Earth\'s own standing is in the Occurrences track\'s words', () => {
  const kind = earth => adapter.projectTechneTracks({world: live([]), earth}).tracks[1].kind
  // FIXTURE: the standings (provider/suiteStanding.ts shape; the adapter reads only the phase and the counts).
  assert.match(kind(undefined), /the Earth has not read your world yet/)
  assert.match(kind({phase: 'idle'}), /the Earth has not read your world yet/)
  assert.match(kind({phase: 'reading'}), /the Earth is reading your world/)
  assert.match(kind({phase: 'unavailable'}), /the Earth could not read your world/)
  assert.match(kind({phase: 'ready', counts: {subjects: 3, located: 1, dated: 2, places: 4}}), /the Earth holds 3 subjects: 1 placed, 2 dated, 4 places$/)
  assert.match(kind({phase: 'ready', counts: {subjects: 1, located: 0, dated: 0, places: 1}}), /the Earth holds 1 subject: 0 placed, 0 dated, 1 place$/)
})

// ── 7 — honesty and actions ──────────────────────────────────────────────────────────────────────

test('the adapter reads and presents; it claims no state, take or timing the owner did not give', () => {
  const set = project(worldSets, {}, eventByClipId)
  for (const clip of set.clips) {
    for (const field of ['status', 'takes', 'span']) assert.equal(clip[field], undefined, `${clip.id} claims no ${field}`)
    if (clip.launch) assert.deepEqual(Object.keys(clip.launch), ['follow'], 'the walk\'s own next stop; the armed quantize is the shell\'s')
  }
  assert.equal(set.tracks.some(track => track.needle !== undefined), false, 'no needle without an owner reading of where a stream has got to')
  assert.equal(set.actions, undefined, 'no controls handed in: the grid stays read-only')
  assert.equal(adapter.techneTrackAdapter.id, 'techne-stream-tracks')
  assert.deepEqual(adapter.techneTrackAdapter.project({world: live(worldSets, eventByClipId)}).tracks.map(track => track.id), set.tracks.map(track => track.id), 'the registered adapter is the same projection')
})

/** FIXTURE: three stops, one carrying an Expression, one a scene of the family's own, one nothing. */
const scenic = {columns: [], tracks: [], clips: [], walks: [{id: 'scenic', name: 'Scenic', kind: 'redbook', derived: false, stops: [
  {id: 's1', label: 'Arrival', year: 1913, also: [], sceneRef: 'expression:folio'},
  {id: 's2', label: 'Tower', year: 1923, also: [], sceneRef: 'field-glyph'},
  {id: 's3', label: 'Quiet', year: 1925, also: []},
]}]}
const fakeControls = (overrides = {}) => {
  const log = {stood: [], opened: []}
  return {log, controls: {
    stand: async (walk, stop) => { log.stood.push(`${walk.id}:${stop.id}`); return stop.id === 's3' ? 'nothing in the spine or the atlas stands this stop' : null },
    openExpression: ref => { log.opened.push(ref) },
    ...overrides,
  }}
}

test('a walk stop stands its event and launches the Expression it carries, through the owners that exist; each half is reported on its own', async () => {
  const {log, controls} = fakeControls()
  const set = project([scenic], {controls})
  assert.deepEqual(Object.keys(set.actions).sort(), ['launch', 'launchStop'], 'no stop-track and no record: no owner op does either')
  assert.equal(set.actions.launchStop.op, `${adapter.TECHNE_STAND_OP} · ${adapter.TECHNE_OPEN_OP}`)
  const rows = set.columns.map(column => column.id)
  assert.deepEqual(await set.actions.launchStop.run(rows[0]), {ok: true, note: 'Stood Arrival. Opened expression:folio.'})
  assert.deepEqual(log, {stood: ['scenic:s1'], opened: ['expression:folio']})
  const second = await set.actions.launchStop.run(rows[1])
  assert.equal(second.ok, true)
  assert.equal(second.note, 'Stood Tower. Tower carries field-glyph, which is not an Expression the shell can open.', 'a scene that is not an Expression is named, never handed to the door')
  assert.deepEqual(log.opened, ['expression:folio'])
  assert.deepEqual(await set.actions.launchStop.run(rows[2]), {ok: false, error: 'nothing in the spine or the atlas stands this stop'}, 'a stop nothing stands, and carrying nothing, is refused in the owner\'s words')
  // a clip launches its stop
  assert.deepEqual(await set.actions.launch.run(set.clips[0].id), {ok: true, note: 'Stood Arrival. Opened expression:folio.'})
  assert.deepEqual((await set.actions.launch.run(set.clips[2].id)).ok, false)
})

test('a stop that stood but carries no Expression says so; a stop whose stand failed still opens the Expression it carries', async () => {
  const quiet = fakeControls({stand: async () => null})
  const set = project([scenic], {controls: quiet.controls})
  assert.deepEqual(await set.actions.launchStop.run(set.columns[2].id), {ok: true, note: 'Stood Quiet. It carries no Expression.'})
  const refused = fakeControls({stand: async () => 'the atlas holds no epoch for this stop'})
  const refusedSet = project([scenic], {controls: refused.controls})
  assert.deepEqual(await refusedSet.actions.launchStop.run(refusedSet.columns[0].id), {ok: true, note: 'Opened expression:folio. the atlas holds no epoch for this stop'})
  assert.deepEqual(refused.log.opened, ['expression:folio'])
  const thrown = fakeControls({stand: async () => { throw new Error('the spine refused') }})
  const thrownSet = project([scenic], {controls: thrown.controls})
  assert.deepEqual(await thrownSet.actions.launchStop.run(thrownSet.columns[2].id), {ok: false, error: 'the spine refused'})
})

test('with no shell door the Expression is named, not opened; the op says only what the owners do', async () => {
  const {controls, log} = fakeControls()
  delete controls.openExpression
  const set = project([scenic], {controls})
  assert.equal(set.actions.launchStop.op, adapter.TECHNE_STAND_OP)
  assert.deepEqual(await set.actions.launchStop.run(set.columns[0].id), {ok: true, note: 'Stood Arrival. Arrival carries expression:folio, but the shell offers no door to open it here.'})
  assert.deepEqual(log.opened, [])
})

test('an id that is not a walk stop is refused before any owner is called; with no controls, or no stop, there are no actions', async () => {
  const {controls, log} = fakeControls()
  const set = project(worldSets.concat([scenic]), {controls}, eventByClipId)
  const run = set.columns.find(column => column.id.startsWith('techne:row:run:'))
  const refusal = await set.actions.launchStop.run(run.id)
  assert.equal(refusal.ok, false)
  assert.match(refusal.error, /is not a walk stop of this work: an event or a run is read, not launched/)
  assert.equal((await set.actions.launch.run([...runClipEventIndex(events).keys()][0])).ok, false)
  assert.equal((await set.actions.launchStop.run('nonsense')).ok, false)
  assert.deepEqual(log, {stood: [], opened: []}, 'no owner was called')
  assert.equal(project([scenic]).actions, undefined, 'no controls')
  assert.equal(project([runSet], {controls}, eventByClipId).actions, undefined, 'no walk stop to launch')
})

// ── 8 — the shared views draw it ─────────────────────────────────────────────────────────────────

test('the shared Session grid draws every stream, every row and every clip; a row\'s stop launches only where the owners give a launch', () => {
  const read = project(worldSets, {}, eventByClipId)
  const markup = renderToStaticMarkup(React.createElement(SessionGrid, {set: read, selection: {ref: read.clips[0].id, select() {}}}))
  assert.equal((markup.match(/ data-track="/g) ?? []).length, read.tracks.length)
  assert.equal((markup.match(/data-clip="/g) ?? []).length, read.clips.length, 'every clip has its cell')
  assert.match(markup, /title="Revisions · stream · waiting — /, 'the owner\'s absence is in the name tooltip')
  assert.match(markup, /class="cs clip sel"/, 'the selected clip stands lit: THE selection\'s ref is the clip\'s id')
  assert.equal((markup.match(/class="stop-launch" disabled=""/g) ?? []).length, read.columns.length, 'no controls: no row launch')
  const {controls} = fakeControls()
  const launchable = project(worldSets, {controls}, eventByClipId)
  const enabled = renderToStaticMarkup(React.createElement(SessionGrid, {set: launchable, selection: {select() {}}}))
  assert.equal((enabled.match(/class="stop-launch"( disabled="")?/g) ?? []).filter(item => item.includes('disabled')).length, 0)
  assert.match(enabled, /Launch the row: every clip in it \(applyWalkStopFocus: /)
})

test('the shared Arrangement lays the same clips on one ruler, each at its own place, and names the ruler\'s units', () => {
  const set = project(worldSets, {}, eventByClipId)
  const markup = renderToStaticMarkup(React.createElement(ArrangementRuler, {set, selection: {select() {}}}))
  assert.equal((markup.match(/ data-track="/g) ?? []).length, set.tracks.length)
  assert.equal((markup.match(/data-clip="/g) ?? []).length, set.clips.length, 'what the Session shows, the ruler shows')
  assert.match(markup, /aria-label="Ruler in no-time slots, then deep-time years/)
  const {placed} = placeClips(set)
  const byTime = placed.filter(item => item.clip.trackId === aionSet.tracks[0].id).sort((a, b) => a.start - b.start).map(item => item.clip.label)
  assert.deepEqual(byTime, aionSet.clips.filter(clip => clip.trackId === aionSet.tracks[0].id).sort((a, b) => a.span.start - b.span.start).map(clip => clip.label), 'the events are laid in the order of their years')
})

// ── 9 — the hook ─────────────────────────────────────────────────────────────────────────────────

test('the hook reads the World cut as it is published — no second poller — and returns the six streams, with the owners behind the actions', () => {
  const published = {status: 'live', error: null, now: {instantUnixMs: at(14, 10, 0), dayRef: null, source: 'fixture'}, events, absences: [], sets: worldSets, eventByClipId,
    admittedRuns: null, admittedRunsError: null, readAtUnixMs: 1, readCadence: null}
  let seen
  const Probe = props => { seen = useTechneTracks(props); return null }
  const draw = props => renderToStaticMarkup(React.createElement(Probe, {set: null, document: null, ...props}))
  draw({world: {source: published, spine: {}, selectOccasion() {}}, journey: {openExpression() {}}})
  assert.deepEqual(seen.tracks.map(track => track.id), [...aionSet.tracks.map(track => track.id), STREAM_TRACKS[1], STREAM_TRACKS[2], ...runSet.tracks.map(track => track.id), STREAM_TRACKS[4], STREAM_TRACKS[5]])
  assert.equal(seen.clips.length, aionSet.clips.length + runSet.clips.length, 'the readings\' clips and the receipts, from the published sets')
  assert.equal(seen.actions.launchStop.op, `${adapter.TECHNE_STAND_OP} · ${adapter.TECHNE_OPEN_OP}`, 'the Aion stops can be stood, and the shell\'s door is handed in')
  draw({world: {source: published, spine: {}, selectOccasion() {}}})
  assert.equal(seen.actions.launchStop.op, adapter.TECHNE_STAND_OP, 'with no door the stops are stood and their Expressions named')
  draw({world: undefined})
  assert.deepEqual(seen.tracks.map(track => track.id), STREAM_TRACKS, 'with no published reading the streams still stand')
  assert.match(seen.tracks[0].kind, /civil field is unread \(the shell publishes no World reading to this pane\)/)
  assert.equal(seen.actions, undefined)
})

test('the hook wears the Earth\'s standing from the store the atlas host already reads', () => {
  let seen
  const Probe = props => { seen = useTechneTracks(props); return null }
  const draw = () => renderToStaticMarkup(React.createElement(Probe, {set: null, document: null, world: undefined}))
  draw()
  assert.match(seen.tracks[1].kind, /the Earth has not read your world yet/)
  // FIXTURE: a standing published as the suite provider publishes it.
  suiteStanding.publish({...suiteStanding.IDLE_STANDING, phase: 'ready', counts: {...suiteStanding.NO_COUNTS, subjects: 3, located: 1, dated: 2, places: 4}})
  try {
    draw()
    assert.match(seen.tracks[1].kind, /the Earth holds 3 subjects: 1 placed, 2 dated, 4 places$/)
  } finally {
    suiteStanding.reset()
  }
})

test('the controls stand a stop by the Timeline\'s own rule and open its Expression through the frame\'s door, read at the moment of the launch', async () => {
  const stopOf = id => aionSet.walks.find(walk => walk.derived).stops.find(stop => stop.id === id)
  const whole = aionSet.walks.find(walk => walk.derived)
  const calls = []
  const selected = []
  const apply = async (focus, select) => { calls.push(focus); return focus.kind === 'layer' ? null : (select(focus.event), null) }
  // FIXTURE: a stop whose clip the civil reading gives as an occasion, and one that is a layer's.
  const event = events[0]
  const occasionWalk = {id: 'w', name: 'W', kind: 'redbook', derived: false, stops: [{id: 'x', label: 'X', clipId: 'c1', also: []}]}
  let view = {source: {eventByClipId: new Map([['c1', event]])}, selectOccasion: next => selected.push(next.subject_ref)}
  let door = ref => calls.push(`door:${ref}`)
  const controls = techneControls(() => ({view, door}), apply)
  assert.equal(await controls.stand(occasionWalk, occasionWalk.stops[0]), null)
  assert.deepEqual(selected, [event.subject_ref], 'an occasion is stood on the spine')
  assert.deepEqual(calls[0], walkStopFocus(occasionWalk, occasionWalk.stops[0], view.source.eventByClipId), 'by walkStopFocus, the rule the Timeline and the Journey share')
  assert.equal(await controls.stand(whole, stopOf('eddystone-lit')), null)
  assert.deepEqual(calls[1], {kind: 'layer', layerId: READING.id, stopId: 'eddystone-lit'}, 'a reading\'s stop is that reading\'s epoch in the atlas')
  controls.openExpression('expression:a')
  door = ref => calls.push(`next:${ref}`)
  controls.openExpression('expression:b')
  assert.deepEqual(calls.slice(2), ['door:expression:a', 'next:expression:b'], 'the door is the one the latest render handed in')
  view = undefined
  assert.match(await controls.stand(occasionWalk, occasionWalk.stops[0]), /no World reading/)
  assert.equal(techneControls(() => ({view, door: undefined}), apply).openExpression, undefined, 'no door: no way to open')
})

test('the hook is a read of the frame\'s own reading: no poller, no transport, no second clock', async () => {
  const hook = await source('../src/frame/tracks/useTechneTracks.ts')
  const code = hook.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n')
  for (const forbidden of [/setInterval|setTimeout/, /kernelOp|listFiles|readFile|fetch\(/, /useWorldTemporalReading\(/, /useAtlasAionReading|useAtlasHandle/]) {
    assert.doesNotMatch(code, forbidden, String(forbidden))
  }
  assert.match(code, /subscribeSuiteStanding, suiteStanding/, 'the Earth\'s standing is the existing store')
  assert.equal(adapter.isExpressionRef('expression:folio'), true)
  assert.equal(adapter.isExpressionRef('field-glyph'), false)
})
