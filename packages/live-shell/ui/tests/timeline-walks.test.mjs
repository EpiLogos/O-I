import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// Production sources in memory (the timeline-time-spine pattern): CSS is a
// non-executable asset; no build, no kernel transport, no fixtures beyond the
// fixture corpus the atlas ships for its own acceptance.
const root = new URL('../../../../', import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    for(const suffix of ['/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url);

const {walkReaches} = await import('../src/timeline/worldTrackAdapter.ts');
const {projectAionReading} = await import('../src/projections/atlas/aionTimeline.ts');
const {projectFieldThread, projectRedbookWalk, projectDynamicsRoute} = await import('../src/projections/atlas/walkTimeline.ts');
const {fixtureCorpus} = await import('../src/projections/atlas/provider/fixtureCorpus.ts');
const {buildModel} = await import('../src/projections/atlas/src/data/model.ts');
const {chronological} = await import('../src/projections/atlas/src/aion/walk.ts');
const {hexToRgb, rgbToHex} = await import('../src/projections/atlas/src/data/palette.ts');

const corpus = fixtureCorpus();
const reading = corpus.history.readings[0];
const READING_ID = reading.id;
const thread = reading.threads[0];
const threadWalkId = `${READING_ID}:${thread.id}`;

// ── Aion: layers, nested sections, events as clips, threads and the derived walk ─────────────────────────

test('Aion: every epoch is a section, nesting kept, its atmosphere the epoch palette core as hex', () => {
  const set = projectAionReading({history: corpus.history, providerId: 'fixture'});
  assert.deepEqual(set.layers, [{id: READING_ID, name: reading.title}]);
  for (const epoch of reading.epochs) {
    const section = set.sections.find((s) => s.id === epoch.id);
    assert.ok(section, `epoch ${epoch.id} is a section`);
    assert.deepEqual(section.span, {start: epoch.from, end: epoch.to});
    assert.equal(section.parentId, epoch.parentId, `${epoch.id} keeps its parent`);
    assert.equal(section.layerId, READING_ID);
    assert.equal(section.atmosphere, rgbToHex(hexToRgb(epoch.palette.core)), `${epoch.id} atmosphere is its palette core`);
  }
  const child = set.sections.find((s) => s.id === 'the-fixed-machine');
  const parent = set.sections.find((s) => s.id === child.parentId);
  assert.ok(parent && parent.span.start <= child.span.start && child.span.end <= parent.span.end, 'the nested section lies within its parent');
});

test('Aion: every event is a clip on the events track, the founding track keeps its id', () => {
  const set = projectAionReading({history: corpus.history, providerId: 'fixture'});
  assert.equal(set.tracks[0].id, 'aion-events');
  assert.equal(set.tracks[0].layerId, READING_ID);
  for (const event of reading.events) {
    const clip = set.clips.find((c) => c.id === `aion-event-${event.id}`);
    assert.ok(clip, `event ${event.id} is a clip`);
    assert.equal(clip.trackId, 'aion-events');
    assert.deepEqual(clip.span, {start: event.year, end: event.year + 1});
  }
});

test('Aion: every event of a curated thread is reachable from its walk, including also (occurrences)', () => {
  const set = projectAionReading({history: corpus.history, providerId: 'fixture'});
  const walk = set.walks.find((w) => w.id === threadWalkId);
  assert.ok(walk, 'the curated thread is a walk');
  assert.equal(walk.derived, false);
  assert.equal(walk.kind, 'aion-thread');
  assert.deepEqual(walk.stops.map((s) => s.id), thread.eventIds, 'stops stand the thread’s events in its order');
  const reached = walkReaches(set, threadWalkId);
  for (const eventId of thread.eventIds) {
    assert.ok(reached.has(eventId), `event ${eventId} reached`);
    const event = reading.events.find((e) => e.id === eventId);
    assert.ok(reached.has(`walk:${threadWalkId}:${eventId}`), `the walk stands the clip of ${eventId}`);
    for (const occurrenceId of event.occurrenceIds) assert.ok(reached.has(occurrenceId), `occurrence ${occurrenceId} reached through also`);
  }
  assert.ok(set.tracks.some((t) => t.id === `walk:${threadWalkId}` && t.kind === 'walk'), 'the walk draws on a walk track');
});

test('Aion: the whole-reading walk is derived on read, in chronological order, and never stored', () => {
  const before = structuredClone(corpus.history);
  const set = projectAionReading({history: corpus.history, providerId: 'fixture'});
  const walk = set.walks.find((w) => w.id === `${READING_ID}:all`);
  assert.ok(walk, 'the whole-reading walk is projected');
  assert.equal(walk.derived, true);
  assert.equal(walk.kind, 'aion-whole-reading');
  assert.deepEqual(walk.stops.map((s) => s.id), chronological(reading.events).map((e) => e.id), 'every event, earliest to latest');
  assert.ok(!reading.threads.some((t) => t.id === 'all'), 'the history carries no stored copy of the whole-reading walk');
  assert.deepEqual(corpus.history, before, 'projecting reads the history and writes nothing into it');
  const again = projectAionReading({history: corpus.history, providerId: 'fixture'});
  assert.deepEqual(again.walks, set.walks, 'the derived walk is the same on every read');
});

test('Aion: a later reading is a layer that extends the first and never rewrites it', () => {
  const first = projectAionReading({history: corpus.history, providerId: 'fixture'});
  const palette = reading.epochs[0].palette;
  const extending = {
    ...reading,
    id: 'antichrist-reading',
    title: 'The Antichrist reading',
    extends: READING_ID,
    epochs: [{id: 'the-second-age', name: 'The second age', from: 2000, to: 2100, polarity: 'shadow', spectrum: 0.2, palette, oneLine: '', body: [], passages: []}],
    events: [],
    threads: [],
  };
  const both = projectAionReading({history: {...corpus.history, readings: [reading, extending]}, providerId: 'fixture'});
  assert.deepEqual(both.layers.map((l) => l.id), [READING_ID, 'antichrist-reading']);
  assert.equal(both.layers[1].extends, READING_ID, 'the extension is kept');
  assert.equal(both.tracks[0].id, 'aion-events', 'the founding reading keeps its track');
  assert.ok(both.tracks.some((t) => t.id === 'aion-events:antichrist-reading'), 'the later reading has its own events track');
  assert.deepEqual(both.sections.filter((s) => s.layerId === READING_ID), first.sections, 'the first reading’s sections are unchanged');
  assert.deepEqual(both.clips.filter((c) => c.trackId === 'aion-events'), first.clips.filter((c) => c.trackId === 'aion-events'), 'the first reading’s events are unchanged');
  const extendingWalk = both.walks.find((w) => w.id === 'antichrist-reading:all');
  assert.ok(extendingWalk && extendingWalk.derived && extendingWalk.stops.length === 0);
});

test('Aion: an empty history projects nothing and does not fail', () => {
  const set = projectAionReading({history: {generatedAt: 'x', readings: []}, providerId: 'fixture'});
  assert.deepEqual([set.columns, set.tracks, set.clips, set.layers, set.sections, set.walks], [[], [], [], [], [], []]);
});

// ── field thread: thinned with bucket-mates, nothing dropped ──────────────────────────────────────────────

test('field thread: thinned to one stop per bucket, every occurrence of the subject reached (also, unplaced)', () => {
  const base = corpus.field;
  const template = base.occurrences[0];
  // The fixture's lighthouse family has 5 located occurrences; 30 more push it past the family thread bound (26).
  const extra = Array.from({length: 30}, (_, k) => ({
    ...template, id: `extra-${k}`, title: `extra ${k}`, label: `extra ${k}`, year: 1700 + k * 7, yearDisplay: String(1700 + k * 7),
    lat: 40 + k * 0.1, lon: -10 + k * 0.2, geoPrecision: 'place', place: `Place ${k}`, familyId: 'lighthouse', parallelIds: [],
  }));
  const unplaced = {...template, id: 'unplaced-lh', label: 'unplaced', year: 1750, lat: 0, lon: 0, geoPrecision: 'none', place: '(unplaced)', familyId: 'lighthouse', parallelIds: []};
  const model = buildModel({...base, occurrences: [...base.occurrences, ...extra, unplaced]});
  const set = projectFieldThread(model, 'family', 'lighthouse');
  const walk = set.walks[0];
  assert.equal(walk.derived, true, 'a field thread is derived on read');
  assert.equal(walk.kind, 'field-thread');
  assert.equal(walk.stops.length, 26, 'thinned to the family thread bound');
  assert.ok(walk.stops.some((s) => s.also.length > 0), 'bucket-mates are kept in also');
  const years = walk.stops.map((s) => s.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b), 'stops run in time order');
  const reached = walkReaches(set, walk.id);
  for (const i of model.famOcc.get('lighthouse')) assert.ok(reached.has(model.occ[i].id), `occurrence ${model.occ[i].id} reached`);
  assert.ok(reached.has('unplaced-lh'), 'an unplaced occurrence is reached through its nearest step');
});

// ── Red Book and dynamics route: the same shape ───────────────────────────────────────────────────────────

test('Red Book: curated order kept, nothing dropped (an uncarried stop stays, labelled by id), sections span their stops’ years', () => {
  const model = buildModel(corpus.field);
  const redbook = {
    generatedAt: 'x', licence: {plates: '', text: '', vaultPathNote: ''}, plates: {vaultRelativeDir: '', urlPrefix: '', served: 'dev-only', note: ''},
    mode: {title: 'Liber Novus', subtitle: '', subject: 'jung', oneLine: ''},
    sections: [{id: 'descent', name: 'Descent', oneLine: ''}, {id: 'return', name: 'Return', oneLine: ''}, {id: 'empty', name: 'Empty', oneLine: ''}],
    stops: [
      {id: 'eddystone-1698', sectionId: 'descent'},
      {id: 'bell-rock-1814', sectionId: 'descent'},
      {id: 'curated-not-in-field', sectionId: 'return'},
      {id: 'flannan-1899', sectionId: 'return'},
    ],
    genesis: [],
  };
  const set = projectRedbookWalk(model, redbook);
  const walk = set.walks[0];
  assert.equal(walk.derived, false);
  assert.deepEqual(walk.stops.map((s) => s.id), redbook.stops.map((s) => s.id), 'curated order, nothing dropped');
  assert.equal(walk.stops[2].label, 'curated-not-in-field');
  assert.equal(walk.stops[2].year, undefined);
  assert.ok(walk.stops[0].place && walk.stops[0].place.lat !== undefined, 'a placed stop carries its place');
  assert.deepEqual(set.sections.map((s) => s.id), ['descent', 'return'], 'an undated section has no span and is left out');
  assert.deepEqual(set.sections.find((s) => s.id === 'descent').span, {start: 1698, end: 1815});
  assert.deepEqual(set.sections.find((s) => s.id === 'return').span, {start: 1899, end: 1900});
});

test('dynamics route: stops in order, movements as stop-index spans, also is the familyIds', () => {
  const route = {
    version: 1, title: 'The lens walk', line: '',
    movements: [
      {id: 'm1', n: 'I', title: 'First', line: '', stops: [
        {id: 's1', figure: 'f', line: '', concept: 'strange-attractor', familyIds: ['lighthouse']},
        {id: 's2', figure: 'f', line: '', name: 'Named stop', familyIds: []},
      ]},
      {id: 'm2', n: 'II', title: 'Second', line: '', stops: [{id: 's3', figure: 'f', line: '', concept: 'c3', familyIds: ['chart', 'compass']}]},
      {id: 'm3', n: 'III', title: 'Empty', line: '', stops: []},
    ],
  };
  const set = projectDynamicsRoute(route);
  const walk = set.walks[0];
  assert.equal(walk.derived, false);
  assert.deepEqual(walk.stops.map((s) => s.id), ['s1', 's2', 's3']);
  assert.deepEqual(walk.stops.map((s) => s.label), ['strange-attractor', 'Named stop', 'c3']);
  assert.deepEqual(set.sections, [
    {id: 'm1', name: 'First', span: {start: 0, end: 2}},
    {id: 'm2', name: 'Second', span: {start: 2, end: 3}},
  ], 'the empty movement has no span and is left out');
  const reached = walkReaches(set, 'dynamics-route');
  for (const ref of ['s1', 's2', 's3', 'lighthouse', 'chart', 'compass']) assert.ok(reached.has(ref), `${ref} reached`);
});

// ── one shape, and the contract's laws ────────────────────────────────────────────────────────────────────

test('all four projections return one walk shape, and every stop’s clip resolves in its own set', () => {
  const sets = [
    projectAionReading({history: corpus.history, providerId: 'fixture'}),
    projectFieldThread(buildModel(corpus.field), 'family', 'lighthouse'),
    projectRedbookWalk(buildModel(corpus.field), {mode: {title: 'T'}, sections: [], stops: [{id: 'eddystone-1698', sectionId: 'x'}], genesis: []}),
    projectDynamicsRoute({version: 1, title: 'R', line: '', movements: [{id: 'm', n: 'I', title: 'M', line: '', stops: [{id: 's', figure: 'f', line: '', name: 'S'}]}]}),
  ];
  for (const set of sets) {
    assert.ok(Array.isArray(set.columns) && Array.isArray(set.tracks) && Array.isArray(set.clips), 'the base shape holds');
    assert.ok(set.walks.length > 0, 'each projection offers a walk');
    const clipIds = new Set(set.clips.map((c) => c.id));
    for (const walk of set.walks) {
      assert.equal(typeof walk.derived, 'boolean');
      for (const stop of walk.stops) {
        assert.ok(Array.isArray(stop.also), 'also is always an array');
        if (stop.clipId !== undefined) assert.ok(clipIds.has(stop.clipId), `clip ${stop.clipId} is in the set`);
      }
    }
  }
});

test('walkReaches of an unknown walk reaches nothing', () => {
  const set = projectAionReading({history: corpus.history, providerId: 'fixture'});
  assert.equal(walkReaches(set, 'no-such-walk').size, 0);
});

test('the Timeline contract stays family-free (no atlas, reading or route names in worldTrackAdapter.ts)', async () => {
  const source = await readFile(new URL('../src/timeline/worldTrackAdapter.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\batlas\b|\baion\b|redbook|dynamics|fieldthread|field-thread|archetype/i);
});

// ── leg 3 (T-TIMELINE-WALKS): the Timeline draws the walks and nested sections the sets carry ───────────────────
// The same sets the lanes draw: every walk an ordered rail (numbered n of N, each stop a focus), every section nested by
// its parent and coloured by its atmosphere. Rendered through the real presentation, in both presentations.

const {createElement} = await import('react');
const {renderToStaticMarkup} = await import('react-dom/server');
const {WorldTimelinePresentation} = await import('../src/projections/worldTimelinePresentation.tsx');
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts');
const {projectWorldTracks} = await import('../src/timeline/registerWorldTrackAdapters.ts');
// The shell admits its families at start (main.tsx); the family door reads the admitted manifests, so the test does too.
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts');
loadAgentShellFamilies();

const liveSet = projectAionReading({history: corpus.history, providerId: 'fixture'});
const dynamicsSet = projectDynamicsRoute({
  version: 1, title: 'The lens walk', line: '',
  movements: [{id: 'm1', n: 'I', title: 'First', line: '', stops: [
    {id: 's1', figure: 'f', line: '', concept: 'strange-attractor', familyIds: ['lighthouse']},
    {id: 's2', figure: 'f', line: '', name: 'Named stop', familyIds: []},
  ]}],
});
const liveSets = [liveSet, dynamicsSet];
const liveView = (sets) => ({
  source: {status: 'live', error: null, now: null, events: [], sets, eventByClipId: new Map(), admittedRuns: null, admittedRunsError: null, readAtUnixMs: null, readCadence: null},
  spine: createTimeSpine(),
  selectOccasion() {},
});
const drawn = (sets, presentation) => renderToStaticMarkup(createElement(WorldTimelinePresentation, {view: liveView(sets), presentation}));

test('the Timeline draws every walk as an ordered rail, n of N, in both presentations', () => {
  const walks = liveSets.flatMap((set) => set.walks ?? []);
  const refs = walks.flatMap((walk) => walk.stops.map((stop) => stop.id));
  for (const presentation of ['session', 'arrangement']) {
    const out = drawn(liveSets, presentation);
    const at = walks.map((walk) => out.indexOf(`data-walk-row="${walk.id}"`));
    assert.ok(at.every((index) => index >= 0), `${presentation}: every walk has its row`);
    assert.deepEqual(at, [...at].sort((a, b) => a - b), `${presentation}: the rows keep the sets’ order`);
    const rails = [...out.matchAll(/data-walk-stop="(\d+)" data-stop-ref="([^"]+)"/g)];
    assert.deepEqual(rails.map((match) => match[2]), refs, `${presentation}: the rail stops, walk by walk, in the walk’s order`);
    assert.deepEqual(rails.map((match) => Number(match[1])), walks.flatMap((walk) => walk.stops.map((_, i) => i + 1)), `${presentation}: numbered 1..N per walk`);
  }
});

test('the Timeline nests every section by its parent, coloured by its atmosphere', () => {
  const sections = liveSets.flatMap((set) => set.sections ?? []);
  const child = liveSet.sections.find((section) => section.parentId);
  assert.ok(child && child.atmosphere, 'the fixture has a nested, coloured section');
  for (const presentation of ['session', 'arrangement']) {
    const out = drawn(liveSets, presentation);
    assert.equal((out.match(/data-section="/g) ?? []).length, sections.length, `${presentation}: one chip per section`);
    const depth = Number(out.match(new RegExp(`data-section="${child.id}" data-depth="(\\d+)"`))?.[1]);
    assert.ok(depth >= 1, `${presentation}: the nested section is drawn nested (depth ${depth})`);
    assert.ok(out.includes(`border-left:3px solid ${child.atmosphere}`), `${presentation}: the section takes its atmosphere`);
  }
});

test('with no walk carried the Timeline draws no rail and names the absence', () => {
  const out = drawn([{columns: [], tracks: [], clips: []}], 'session');
  assert.ok(!out.includes('data-walk-row='), 'no walk row is drawn');
  assert.ok(out.includes('data-world-walks="0"'));
  assert.match(out, /No walks are carried by the World(&#x27;|')s track sets/, 'the absence is named, not left silent');
});

test('the World’s temporal hook and the Timeline wire the walk focus the shared way', async () => {
  const hook = await readFile(new URL('../src/projections/useWorldTemporalReading.ts', import.meta.url), 'utf8');
  assert.match(hook, /projectWorldTracks\('atlas-aion-timeline'/, 'the Aion reading reaches the sets through the family door');
  assert.match(hook, /useAtlasAionReading\(\)/);
  assert.match(hook, /return aionSet \? \[\.\.\.lanes, aionSet\] : lanes/, 'the Aion set joins the sets only when the atlas holds one');
  const presentation = await readFile(new URL('../src/projections/worldTimelinePresentation.tsx', import.meta.url), 'utf8');
  assert.match(presentation, /applyWalkStopFocus\(focus, selectOccasion\)/, 'a rail stop applies the shared focus');
  assert.match(presentation, /walkStopOfClip\(sets, entry\.clip\.id\)/, 'a walk clip selects its stop, not nothing');
  const family = await projectWorldTracks('atlas-aion-timeline', {history: corpus.history, providerId: 'fixture'});
  assert.deepEqual(family, liveSet, 'the family door projects the same set the Timeline draws');
});
