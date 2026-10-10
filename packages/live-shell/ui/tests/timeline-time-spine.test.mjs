import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// Production sources in memory (the native-composition-views pattern): CSS
// is a non-executable asset; no build, no kernel transport, no fixtures
// beyond the ones declared as fixtures in-line.
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
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url);

const {createTimeSpine} = await import('../src/timeline/timeSpine.ts');
const {projectDayTracks, dayClipEventIndex} = await import('../src/timeline/dayTrackAdapter.ts');
const {projectRunTracks, runClipEventIndex, isRunSubject} = await import('../src/timeline/runTrackAdapter.ts');
const {projectConversationTracks, conversationClipEventIndex} = await import('../src/timeline/conversationTrackAdapter.ts');
const {registeredWorldTrackAdapterIds, manifestDeclaredProjections, isManifestDeclared, projectWorldTracks, projectLaneWorldTracks} = await import('../src/timeline/registerWorldTrackAdapters.ts');
const {admitFamilyManifest, resetFamilyManifestsForTest} = await import('../src/inhabitants/familyManifest.ts');
const {expressionsTrackAdapter, projectExpressionsTracks} = await import('../src/timeline/expressionsTrackAdapter.ts');
const {WorldTimelinePresentation} = await import('../src/projections/worldTimelinePresentation.tsx');
const React = await import('react');
const {renderToStaticMarkup} = await import('react-dom/server');

// The reading shape exactly as the kernel's temporal read gives it
// (temporal_sources.rs rows; the same rows the walk-bridge served the lane).
const clearing = (ref, dayRef, instant, summary, stream = 'central-now') =>
  ({stream, kind: 'now', subject_ref: ref, instant_unix_ms: instant, summary, day_ref: dayRef, evidence_refs: [`${ref}/now.json`]});

const READING = [
  clearing('central:now:control:root:664e4c58', 'central:day:control:root:2026-10-06', Date.UTC(2026, 9, 6, 10, 12, 34), 'Expression enrichment pass (owner brief 2026-10-06)'),
  clearing('central:now:control:root:5af25803', 'central:day:control:root:2026-10-06', Date.UTC(2026, 9, 6, 16, 44, 52), 'Central Field commission (O:I #592/#598)'),
  clearing('central:now:control:root:39ece031', 'central:day:control:root:2026-10-07', Date.UTC(2026, 9, 7, 0, 40), 'Reverse-engineering capability setup'),
  {stream: 'aikit-history', kind: 'now', subject_ref: 'session-space/development-entry-factory-guardian-20261008', instant_unix_ms: Date.UTC(2026, 9, 8, 2, 59, 44), summary: 'SessionSpace receipt 3 · 1 semantic change', day_ref: 'central:day:control:root:2026-10-08'},
  {stream: 'aikit-history', kind: 'now', subject_ref: 'session-space/development-entry-factory-guardian-20261008', instant_unix_ms: Date.UTC(2026, 9, 8, 5, 10, 0), summary: 'SessionSpace receipt 4 · 1 semantic change', day_ref: 'central:day:control:root:2026-10-08'},
  {stream: 'agent-session', kind: 'generation', subject_ref: 'agent-session/development-entry-root-pi-20261008', instant_unix_ms: Date.UTC(2026, 9, 8, 6, 0, 0), summary: 'run #214 · attempt 1 correlating', day_ref: 'central:day:control:root:2026-10-08'},
  {stream: 'agent-session', kind: 'now', subject_ref: 'agent-session/development-entry-root-pi-20261008', instant_unix_ms: Date.UTC(2026, 9, 8, 6, 30, 0), summary: 'run #214 · attempt 1 returned', day_ref: 'central:day:control:root:2026-10-08'},
  // Undated material keeps relative time (no fake dates).
  {stream: 'central-now', kind: 'now', subject_ref: 'central:now:control:root:undated-one', instant_unix_ms: null, summary: 'a clearing the owner never dated'},
];

const at = (utc) => Date.UTC(2026, 9, 9, utc);

test('the day track projects Central civil days with returns/clearings as clips', () => {
  const set = projectDayTracks(READING);
  assert.ok(set.columns.some((column) => column.id === 'day:undated'), 'undated material keeps a relative column');
  assert.ok(set.columns.some((column) => column.name === 'undated · relative order'), 'undated material keeps a relative column');
  assert.ok(set.columns.some((column) => column.name.includes('2026-10-06')), 'the reading’s own day refs name the columns');
  const centralClips = set.clips.filter((clip) => clip.trackId === 'central-day');
  assert.equal(centralClips.filter((clip) => clip.state === 'fact').length, centralClips.length, 'readings of record stand as fact — placement never upgrades standing');
  assert.ok(centralClips.every((clip) => clip.columnId.startsWith('day:')), 'clips place in their civil day column');
  const undated = centralClips.filter((clip) => clip.columnId === 'day:undated');
  assert.equal(undated.length, 1, 'the undated clearing stands in the undated column, undated');
  // Machines·NOW lane receives aikit-history; nothing else lands there.
  assert.ok(set.clips.some((clip) => clip.trackId === 'machines-now' && clip.columnId === 'day:2026-10-08'));
  assert.ok(set.clips.every((clip) => clip.trackId !== 'machines-now' || clip.columnId === 'day:2026-10-08'));
});

test('the run track groups agent-session and run subjects, bounded, overflow named', () => {
  const many = [...READING];
  for (let index = 0; index < 15; index += 1) {
    many.push({stream: 'agent-session', kind: 'now', subject_ref: `agent-session/overflow-run-${index}`, instant_unix_ms: Date.UTC(2026, 9, 8, 7, index), summary: `run ${index}`, day_ref: 'central:day:control:root:2026-10-08'});
  }
  const set = projectRunTracks(many);
  const runTracks = set.tracks.filter((track) => track.kind === 'run');
  assert.equal(runTracks.length, 12, 'the lane bound holds');
  const overflow = set.tracks.find((track) => track.kind === 'run-overflow');
  assert.ok(overflow, 'overflow is a named lane, never a silent truncation');
  assert.match(overflow.name, /4 more runs/);
  assert.ok(isRunSubject('agent-session/x') && isRunSubject('factory/run-01') && isRunSubject('run:214'));
  assert.equal(isRunSubject('session-space/conversation-x'), false, 'conversation spaces are not runs');
  const clip = set.clips[0];
  assert.ok(clip.id.startsWith('run-clip:'), 'ids are the adapter’s own');
  // The owner's admitted runs are the LANES; a run the read carries no
  // events for still stands as an honestly empty lane.
  const admittedOnly = projectRunTracks([{stream: 'aikit-history', kind: 'now', subject_ref: 'session-space/x', instant_unix_ms: Date.UTC(2026, 9, 8, 3), summary: 'receipt', day_ref: 'central:day:control:root:2026-10-08'}], [
    {sessionRef: 'agent-session/admitted-run-1', label: 'Fizz · lead'},
    {sessionRef: 'agent-session/admitted-run-2'},
  ]);
  const admittedTracks = admittedOnly.tracks.filter((track) => track.kind === 'run');
  assert.equal(admittedTracks.length, 2, 'admitted runs are lanes even without read events');
  assert.equal(admittedTracks[0].name, 'Fizz · lead', 'the owner’s label names the lane');
  assert.equal(admittedOnly.clips.length, 0, 'no events — no invented clips');
});

test('the conversation track places session-space receipts as clips', () => {
  const set = projectConversationTracks(READING);
  assert.equal(set.tracks.length, 1);
  assert.equal(set.tracks[0].kind, 'conversation');
  assert.equal(set.clips.length, 2, 'both receipts of the one space place');
  assert.ok(set.clips.every((clip) => clip.columnId === 'day:2026-10-08'));
});

test('clip ids recover their exact events through the adapters’ indexes', () => {
  for (const [project, index] of [
    [projectDayTracks, dayClipEventIndex],
    [projectRunTracks, runClipEventIndex],
    [projectConversationTracks, conversationClipEventIndex],
  ]) {
    const set = project(READING);
    const map = index(READING);
    for (const clip of set.clips) {
      const event = map.get(clip.id);
      assert.ok(event, `every clip of ${set.tracks[0]?.kind} recovers its event`);
      assert.equal(typeof event.subject_ref, 'string');
    }
  }
});

test('the found Expressions adapter composes unchanged under the same contract', () => {
  const reading = {
    scenes: [{id: 'sc-1', name: 'Main', duration: 4}],
    presentedSceneId: 'sc-1',
    presented: {entities: [{id: 'e1', name: 'Stone', glyph: {text: '◆'}, sequence: [{id: 's1', hold: 2, transition: 1}]}], automationLanes: [], propertyTracks: []},
  };
  const set = projectExpressionsTracks(reading);
  assert.equal(expressionsTrackAdapter.id, 'expressions-track-adapter');
  assert.equal(set.clips.length, 1);
  assert.deepEqual(set.clips[0].span, {start: 0, end: 3}, 'span is hold + transition in the family’s own seconds');
});

test('the time spine: occasion retains its basis across selections and readings; admission qualifies separately', () => {
  const spine = createTimeSpine();
  const first = READING[0];
  const second = READING[1];
  spine.selectOccasion(first, at(1));
  const retained = spine.occasion();
  assert.equal(retained.basis.ref, first.subject_ref);
  assert.equal(retained.basis.instantUnixMs, first.instant_unix_ms);
  assert.equal(retained.basis.retainedAtUnixMs, at(1));
  assert.equal(retained.admission, null, 'a fresh basis has no current admission yet');
  // A different selection, then a return: the ORIGINAL basis stands.
  spine.selectOccasion(second, at(2));
  spine.selectOccasion({...first, summary: 'a changed reading would not rebase the retained occasion'}, at(3));
  const returned = spine.occasion();
  assert.equal(returned.basis.summary, first.summary, 'reopening keeps the original snapshot basis');
  assert.equal(returned.basis.retainedAtUnixMs, at(1), 'the retention instant is the basis’s own');
  // Qualification is a separate field: it moves, the basis does not.
  spine.qualifyOccasions([second], at(4), 'qualified against the temporal reading of this refresh');
  const after = spine.occasion();
  assert.equal(after.basis.summary, first.summary);
  assert.equal(after.admission.admitted, false, 'the stale occasion’s current admission is separately refused');
  assert.equal(after.admission.qualifiedAtUnixMs, at(4));
  const secondOccasion = spine.occasionFor(second.subject_ref);
  assert.equal(secondOccasion.admission.admitted, true);
  assert.equal(secondOccasion.basis.retainedAtUnixMs, at(2));
  assert.equal(spine.occasions().length, 2);
});

test('the time spine: Now is a read civil field, never a wall clock', () => {
  const spine = createTimeSpine();
  assert.equal(spine.now(), null, 'an unread spine honestly has no Now');
  spine.readNow({instantUnixMs: at(3), dayRef: 'central:day:control:root:2026-10-09', source: 'kernel temporal read'});
  assert.equal(spine.now().dayRef, 'central:day:control:root:2026-10-09');
  assert.equal(spine.now().source, 'kernel temporal read');
});

test('the cron stratum: declared cadences fire real executions; every firing lands as a clip', () => {
  const spine = createTimeSpine();
  assert.throws(() => spine.fireCadence('never-declared', {atUnixMs: at(1)}), /never declared.*no synthetic history/);
  spine.declareCadence({id: 'central-temporal-read', everyMs: 90000, label: 'civil-field read', declaredBy: 'timeline projection'});
  spine.armCadence('central-temporal-read', true);
  const firing = spine.fireCadence('central-temporal-read', {atUnixMs: at(1), disclosure: 'the Timeline projection read the civil field'});
  assert.equal(firing.cadenceId, 'central-temporal-read');
  const clips = spine.cronClips();
  assert.equal(clips.length, 1);
  assert.equal(clips[0].trackId, 'cron');
  assert.equal(clips[0].state, 'fact', 'a real firing is a fact, and it is temporal material like anything else');
  // Chronos: the QL family binds read-only functions; the spine holds none.
  assert.equal(spine.chronos().length, 0);
  spine.bindChronos({id: 'sky-epoch', label: 'retained sky', read: () => '1913 (retained)'});
  assert.equal(spine.chronos()[0].read(), '1913 (retained)');
});

test('the registry: family door verifies manifest declarations; lane door serves its own', async () => {
  resetFamilyManifestsForTest();
  assert.ok(registeredWorldTrackAdapterIds().includes('atlas-aion-timeline'));
  assert.ok(registeredWorldTrackAdapterIds().includes('factory-run-track-adapter'));
  assert.ok(registeredWorldTrackAdapterIds().includes('central-day-track'));
  await assert.rejects(projectWorldTracks('atlas-aion-timeline', {}), /not declared by any admitted family manifest/, 'nothing projects through the family door undeclared');
  await assert.rejects(projectWorldTracks('central-day-track', []), /not declared by any admitted family manifest/, 'lane adapters do not impersonate family declarations');
  await assert.rejects(projectLaneWorldTracks('absent-adapter', []), /no World track adapter registered/);
  const daySet = await projectLaneWorldTracks('central-day-track', READING);
  assert.equal(daySet.tracks.length, 3);
  // The atlas family's declaration makes its projection resolvable.
  admitFamilyManifest({
    id: 'atlas-earth',
    browser: ['aion'],
    faces: [],
    params: {grammar: 'atlas/parameter-address/v1'},
    projections: ['atlas-aion-timeline'],
    inspectors: [],
    time: {consumes: ['occasion'], contributes: ['aion-epochs']},
    telemetry: null,
  });
  assert.ok(isManifestDeclared('atlas-aion-timeline'));
  assert.deepEqual(manifestDeclaredProjections(), ['atlas-aion-timeline']);
  const aionSet = await projectWorldTracks('atlas-aion-timeline', {
    history: {
      readings: [{
        id: 'northern-light',
        title: 'The Northern Light',
        epochs: [{id: 'e1', name: 'Discovery', from: 1950, to: 1960}],
        threads: [],
        events: [{id: 'ev1', name: 'The stone carved', year: 1950, epochId: 'e1', polarity: 'light'}],
      }],
    },
    providerId: 'fixture',
  });
  assert.equal(aionSet.tracks[0].id, 'aion-events', 'the atlas adapter resolves through the neutral door');
  resetFamilyManifestsForTest();
});

test('the World cut renders honest states and places day and run clips in both presentations', () => {
  const spine = createTimeSpine();
  spine.declareCadence({id: 'central-temporal-read', everyMs: 90000, label: 'civil-field read', declaredBy: 'timeline projection'});
  const source = {
    status: 'live',
    error: null,
    now: {instantUnixMs: at(3), dayRef: 'central:day:control:root:2026-10-08', source: 'kernel temporal read'},
    events: READING,
    sets: [projectDayTracks(READING), projectRunTracks(READING), projectConversationTracks(READING)],
    eventByClipId: new Map([...dayClipEventIndex(READING), ...runClipEventIndex(READING), ...conversationClipEventIndex(READING)]),
    readAtUnixMs: at(3),
    readCadence: {id: 'central-temporal-read', everyMs: 90000, label: 'civil-field read', declaredBy: 'timeline projection'},
  };
  const view = {source, spine, selectOccasion: () => {}};
  for (const presentation of ['session', 'arrangement']) {
    const html = renderToStaticMarkup(React.createElement(WorldTimelinePresentation, {view, presentation}));
    assert.ok(html.includes('2026-10-06'), `${presentation}: a civil day stands on the ruler`);
    assert.ok(html.includes('Central · civil field'), `${presentation}: the day track group renders`);
    assert.ok(html.includes('Runs · Factory &amp; agency'), `${presentation}: the run track group renders`);
    assert.ok(html.includes('data-standing="fact"'), `${presentation}: clips carry their standing`);
    assert.ok(html.includes('Cron'), `${presentation}: the cron chip renders`);
    if (presentation === 'arrangement') {
      assert.ok(html.includes('⟩ week'), 'the declared break into the civil strip renders on the integrated ruler');
      assert.ok(html.includes('wt-cursor wt-now'), 'the now cursor renders');
      assert.ok(html.includes('atlas non-linear scale'), 'the adopted deep-time scale is disclosed on the integrated ruler');
    }
  }
  // Honest refusals: an unavailable transport renders the named absence.
  const unavailable = {...view, source: {...source, status: 'unavailable', error: 'no kernel transport: neither the Tauri host nor a dev walk bridge is reachable', sets: [], events: []}};
  const empty = renderToStaticMarkup(React.createElement(WorldTimelinePresentation, {view: unavailable, presentation: 'arrangement'}));
  assert.match(empty, /The civil field is unread/);
  // An occasion selection is retained and shown with its separate admission light.
  spine.selectOccasion(READING[0], at(3));
  const withOccasion = renderToStaticMarkup(React.createElement(WorldTimelinePresentation, {view, presentation: 'arrangement'}));
  assert.ok(withOccasion.includes('Expression enrichment pass'.slice(0, 20)), 'the retained basis names its event');
  assert.ok(withOccasion.includes('is-unqualified'), 'current admission is a separate, unlit-when-unqualified reading');
});
