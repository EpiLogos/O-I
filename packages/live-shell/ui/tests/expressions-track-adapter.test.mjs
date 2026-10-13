import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// The same in-memory TypeScript loader as the native composition suites.
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

const timeline = new URL('packages/live-shell/ui/src/timeline/', root);
const {expressionsTrackAdapter, projectExpressionsWork, EXPRESSIONS_TRACK_ADAPTER_ID} = await import(new URL('expressionsTrackAdapter.ts', timeline));
const {projectSceneSequence, sceneSequenceAsTracks} = await import(new URL('expressionsSequenceEditor.ts', timeline));

// The pre-move projection of fixture(): projectExpressionsTracks at HEAD 8bf279d3e,
// captured before the move. The sequence editor must reproduce it exactly.
const PRE_CHANGE_PROJECTION = {
  columns: [{id: 'scene-a', name: 'Opening'}, {id: 'scene-b', name: 'Turn'}],
  tracks: [
    {id: 'entity:glyph-1', name: 'Glyph', kind: 'entity'},
    {id: 'entity:force-1', name: 'Force', kind: 'entity'},
    {id: 'automation:scene-b', name: 'Automation', kind: 'automation'},
  ],
  clips: [
    {id: 'clip:glyph-1:s1', trackId: 'entity:glyph-1', columnId: 'scene-b', label: 'Ω', span: {start: 0, end: 3}},
    {id: 'clip:glyph-1:s2', trackId: 'entity:glyph-1', columnId: 'scene-b', label: 'circle', span: {start: 3, end: 7.5}},
  ],
  transport: {takes: [{id: 'take-1', target: 'entity:glyph-1.scale', name: 'Take take-1'}]},
};

// Two scenes. The presented scene is 'scene-b'. Its glyph entity has two steps.
function fixture(overrides = {}) {
  return {
    scenes: [
      {id: 'scene-a', name: 'Opening', duration: 8},
      {id: 'scene-b', name: 'Turn', duration: 12},
    ],
    presentedSceneId: 'scene-b',
    presented: {
      entities: [
        {
          id: 'glyph-1',
          name: 'Glyph',
          glyph: {text: 'Ω'},
          sequence: [
            {id: 's1', hold: 2, transition: 1},
            {id: 's2', hold: 4, transition: 0.5, glyph: {shape: 'circle'}},
          ],
        },
        {id: 'force-1', name: 'Force'},
      ],
      automationLanes: [{id: 'lane-1', target: 'field.colour', enabled: true}],
      propertyTracks: [{id: 'take-1', bind: 'entity:glyph-1.scale'}],
    },
    ...overrides,
  };
}

// Two Expressions. 'ex-1' has two scenes, 'ex-2' one. Stop 1 stands sc-a and sc-c.
// Stop 2 stands sc-b.
function work() {
  return {
    expressions: [
      {id: 'ex-1', name: 'Stone', scenes: [
        {id: 'sc-a', name: 'Opening', duration: 8, takes: [{id: 't1', name: 'Take 1'}]},
        {id: 'sc-b', name: 'Turn', duration: 12},
      ]},
      {id: 'ex-2', name: 'Field', scenes: [
        {id: 'sc-c', name: 'Rise', duration: 5},
      ]},
    ],
    stops: [
      {id: 'stop-1', name: 'Open', scenes: [{expressionId: 'ex-1', sceneId: 'sc-a'}, {expressionId: 'ex-2', sceneId: 'sc-c'}]},
      {id: 'stop-2', name: 'Turn', scenes: [{expressionId: 'ex-1', sceneId: 'sc-b'}]},
    ],
  };
}

// ── the Timeline level: Expressions are tracks, scenes are their clips ─────────

test('the adapter declares its id and projects through the World track contract', () => {
  assert.equal(EXPRESSIONS_TRACK_ADAPTER_ID, 'expressions-track-adapter');
  assert.equal(expressionsTrackAdapter.id, 'expressions-track-adapter');
  assert.deepEqual(expressionsTrackAdapter.project(work()), projectExpressionsWork(work()));
});

test('each Expression is one track with a visual lane and an audio lane, grouped together', () => {
  const set = projectExpressionsWork(work());
  assert.deepEqual(set.tracks, [
    {id: 'expression:ex-1:visual', name: 'Stone: visual', kind: 'expression-visual', groupId: 'expression:ex-1', lane: 'visual'},
    {id: 'expression:ex-1:audio', name: 'Stone: audio', kind: 'expression-audio', groupId: 'expression:ex-1', lane: 'audio'},
    {id: 'expression:ex-2:visual', name: 'Field: visual', kind: 'expression-visual', groupId: 'expression:ex-2', lane: 'visual'},
    {id: 'expression:ex-2:audio', name: 'Field: audio', kind: 'expression-audio', groupId: 'expression:ex-2', lane: 'audio'},
  ]);
});

test('each scene is a clip on both lanes of its Expression, with one column-local span', () => {
  const set = projectExpressionsWork(work());
  assert.deepEqual(set.clips, [
    {id: 'scene:ex-1:sc-a:visual', trackId: 'expression:ex-1:visual', columnId: 'stop:stop-1', label: 'Opening', span: {start: 0, end: 8}},
    {id: 'scene:ex-1:sc-a:audio', trackId: 'expression:ex-1:audio', columnId: 'stop:stop-1', label: 'Opening', span: {start: 0, end: 8}},
    {id: 'scene:ex-1:sc-b:visual', trackId: 'expression:ex-1:visual', columnId: 'stop:stop-2', label: 'Turn', span: {start: 0, end: 12}},
    {id: 'scene:ex-1:sc-b:audio', trackId: 'expression:ex-1:audio', columnId: 'stop:stop-2', label: 'Turn', span: {start: 0, end: 12}},
    {id: 'scene:ex-2:sc-c:visual', trackId: 'expression:ex-2:visual', columnId: 'stop:stop-1', label: 'Rise', span: {start: 0, end: 5}},
    {id: 'scene:ex-2:sc-c:audio', trackId: 'expression:ex-2:audio', columnId: 'stop:stop-1', label: 'Rise', span: {start: 0, end: 5}},
  ]);
  for (const clip of set.clips.filter((c) => c.id.endsWith(':visual'))) {
    const audio = set.clips.find((c) => c.id === clip.id.replace(/:visual$/, ':audio'));
    assert.deepEqual(audio.span, clip.span, `the two sides of ${clip.id} share one span`);
    assert.equal(audio.columnId, clip.columnId, `the two sides of ${clip.id} share one column`);
  }
});

test('stops are the columns, in order; each scene sits in the stop that names it', () => {
  const set = projectExpressionsWork(work());
  assert.deepEqual(set.columns, [{id: 'stop:stop-1', name: 'Open'}, {id: 'stop:stop-2', name: 'Turn'}]);
});

test('a scene no stop names sits in a trailing unstopped column', () => {
  const reading = work();
  reading.stops[0].scenes = reading.stops[0].scenes.filter((ref) => ref.sceneId !== 'sc-c');
  const set = projectExpressionsWork(reading);
  assert.deepEqual(set.columns.map((column) => column.id), ['stop:stop-1', 'stop:stop-2', 'unstopped']);
  assert.equal(set.clips.find((clip) => clip.id === 'scene:ex-2:sc-c:visual').columnId, 'unstopped');
});

test('a scene named by two stops sits in the first of them', () => {
  const reading = work();
  reading.stops[1].scenes.push({expressionId: 'ex-1', sceneId: 'sc-a'});
  const set = projectExpressionsWork(reading);
  assert.equal(set.clips.find((clip) => clip.id === 'scene:ex-1:sc-a:visual').columnId, 'stop:stop-1');
});

test('without stops, the columns are the scene positions', () => {
  const reading = work();
  delete reading.stops;
  const set = projectExpressionsWork(reading);
  assert.deepEqual(set.columns, [{id: 'position:0', name: 'Scene 1'}, {id: 'position:1', name: 'Scene 2'}]);
  assert.deepEqual(set.clips.filter((clip) => clip.id.endsWith(':visual')).map((clip) => [clip.id, clip.columnId]), [
    ['scene:ex-1:sc-a:visual', 'position:0'],
    ['scene:ex-1:sc-b:visual', 'position:1'],
    ['scene:ex-2:sc-c:visual', 'position:0'],
  ]);
});

test('a scene’s captured takes are transport takes targeting the scene, never tracks or clips', () => {
  const set = projectExpressionsWork(work());
  assert.deepEqual(set.transport, {takes: [{id: 'scene:ex-1:sc-a:t1', target: 'scene:ex-1:sc-a', name: 'Take 1'}]});
  const everywhere = JSON.stringify({columns: set.columns, tracks: set.tracks, clips: set.clips});
  assert.equal(everywhere.includes('Take 1'), false, 'a take does not appear as a column, track or clip');
});

test('a stop that names a scene outside the reading is refused', () => {
  const reading = work();
  reading.stops[1].scenes.push({expressionId: 'ex-9', sceneId: 'sc-x'});
  assert.throws(() => projectExpressionsWork(reading), /Stop stop-2 names scene sc-x of ex-9, which is not in the reading/);
});

test('a negative scene duration is refused', () => {
  const reading = work();
  reading.expressions[0].scenes[0].duration = -1;
  assert.throws(() => projectExpressionsWork(reading), /Scene sc-a duration must be a finite, non-negative number/);
});

test('the projections read their reading and never write it', () => {
  const reading = work();
  const before = JSON.stringify(reading);
  projectExpressionsWork(reading);
  assert.equal(JSON.stringify(reading), before);

  const scene = fixture();
  const sceneBefore = JSON.stringify(scene);
  sceneSequenceAsTracks(scene);
  assert.equal(JSON.stringify(scene), sceneBefore);
});

// ── the inside of one scene: the sequence editor (no step lost) ───────────────

test('no step lost: the sequence editor reproduces the pre-move projection of the fixture, deep-equal', () => {
  assert.deepEqual(sceneSequenceAsTracks(fixture()), PRE_CHANGE_PROJECTION);
});

test('columns are the scenes, in reading order', () => {
  const set = sceneSequenceAsTracks(fixture());
  assert.deepEqual(set.columns, [
    {id: 'scene-a', name: 'Opening'},
    {id: 'scene-b', name: 'Turn'},
  ]);
});

test('tracks are one row per entity of the presented scene, plus an automation track', () => {
  const set = sceneSequenceAsTracks(fixture());
  assert.deepEqual(set.tracks, [
    {id: 'entity:glyph-1', name: 'Glyph', kind: 'entity'},
    {id: 'entity:force-1', name: 'Force', kind: 'entity'},
    {id: 'automation:scene-b', name: 'Automation', kind: 'automation'},
  ]);
});

test('a two-step glyph produces two glyph-state spans on the presented scene column', () => {
  const set = sceneSequenceAsTracks(fixture());
  const glyphClips = set.clips.filter((clip) => clip.trackId === 'entity:glyph-1');
  assert.equal(glyphClips.length, 2);
  assert.deepEqual(glyphClips, [
    {id: 'clip:glyph-1:s1', trackId: 'entity:glyph-1', columnId: 'scene-b', label: 'Ω', span: {start: 0, end: 3}},
    {id: 'clip:glyph-1:s2', trackId: 'entity:glyph-1', columnId: 'scene-b', label: 'circle', span: {start: 3, end: 7.5}},
  ]);
  assert.equal(set.clips.length, 2, 'an entity without a sequence produces no clips');
});

test('the span length is hold plus transition and spans follow in step order', () => {
  const reading = fixture();
  reading.presented.entities = [{
    id: 'glyph-1',
    name: 'Glyph',
    sequence: [
      {id: 'a', hold: 1, transition: 0},
      {id: 'b', hold: 0, transition: 2},
      {id: 'c', hold: 3, transition: 0.25},
    ],
  }];
  const spans = sceneSequenceAsTracks(reading).clips.map((clip) => clip.span);
  assert.deepEqual(spans, [{start: 0, end: 1}, {start: 1, end: 3}, {start: 3, end: 6.25}]);
});

test('a glyph label falls back from the step glyph to the entity glyph to the step id', () => {
  const reading = fixture();
  reading.presented.entities = [{
    id: 'e',
    name: 'E',
    glyph: {shape: 'square'},
    sequence: [{id: 'one', hold: 1, transition: 0}, {id: 'two', hold: 1, transition: 0, glyph: {text: 'T'}}],
  }, {
    id: 'bare',
    name: 'Bare',
    sequence: [{id: 'lonely', hold: 1, transition: 0}],
  }];
  assert.deepEqual(sceneSequenceAsTracks(reading).clips.map((clip) => clip.label), ['square', 'T', 'lonely']);
});

test('an automation lane appears as an automation track, and only when a lane exists', () => {
  const withLane = sceneSequenceAsTracks(fixture());
  assert.ok(withLane.tracks.some((track) => track.kind === 'automation'));

  const reading = fixture();
  reading.presented.automationLanes = [];
  const withoutLane = sceneSequenceAsTracks(reading);
  assert.equal(withoutLane.tracks.some((track) => track.kind === 'automation'), false);
  assert.equal(withoutLane.tracks.length, 2);
});

test('a property track is exposed as a transport take and is never a clock or a track', () => {
  const set = sceneSequenceAsTracks(fixture());
  assert.deepEqual(set.transport, {takes: [{id: 'take-1', target: 'entity:glyph-1.scale', name: 'Take take-1'}]});

  const everywhere = JSON.stringify({columns: set.columns, tracks: set.tracks, clips: set.clips});
  assert.equal(everywhere.includes('take-1'), false, 'a take does not appear as a column, track or clip');
  for (const track of set.tracks) assert.notEqual(track.kind, 'clock');
  assert.equal(set.tracks.some((track) => track.id.includes('take')), false);
});

test('the columns and clips follow the presented scene, not a fixed scene', () => {
  const reading = fixture({presentedSceneId: 'scene-a'});
  const set = sceneSequenceAsTracks(reading);
  assert.deepEqual(set.columns.map((column) => column.id), ['scene-a', 'scene-b']);
  assert.ok(set.clips.every((clip) => clip.columnId === 'scene-a'));
  assert.ok(set.tracks.some((track) => track.id === 'automation:scene-a'));
});

test('a presented scene absent from the reading is refused', () => {
  assert.throws(() => sceneSequenceAsTracks(fixture({presentedSceneId: 'missing'})), /Presented scene missing is not in the reading/);
});

test('a negative or non-finite step duration is refused', () => {
  const reading = fixture();
  reading.presented.entities[0].sequence[0].hold = -1;
  assert.throws(() => sceneSequenceAsTracks(reading), /hold must be a finite, non-negative number/);
});

test('a step is a note: hold is its length, transition its glide, and each note starts where the last ended', () => {
  const sequence = projectSceneSequence(fixture());
  assert.deepEqual(sequence.notes, [
    {id: 'clip:glyph-1:s1', laneId: 'entity:glyph-1', start: 0, length: 2, glide: 1, label: 'Ω'},
    {id: 'clip:glyph-1:s2', laneId: 'entity:glyph-1', start: 3, length: 4, glide: 0.5, label: 'circle'},
  ]);
});

test('lanes, envelopes and takes come from the entities, the automation lanes and the property tracks', () => {
  const sequence = projectSceneSequence(fixture());
  assert.deepEqual(sequence.lanes, [
    {id: 'entity:glyph-1', entityId: 'glyph-1', name: 'Glyph'},
    {id: 'entity:force-1', entityId: 'force-1', name: 'Force'},
  ]);
  assert.deepEqual(sequence.envelopes, [{id: 'lane-1', target: 'field.colour', enabled: true}]);
  assert.deepEqual(sequence.takes, [{id: 'take-1', target: 'entity:glyph-1.scale', name: 'Take take-1'}]);
});

test('every step of every entity is a note: none lost across several entities', () => {
  const reading = fixture();
  reading.presented.entities = [
    {id: 'a', name: 'A', sequence: [{id: '1', hold: 1, transition: 0}, {id: '2', hold: 1, transition: 1}]},
    {id: 'b', name: 'B', sequence: [{id: '1', hold: 0, transition: 0}]},
    {id: 'c', name: 'C', sequence: [{id: '1', hold: 2, transition: 0}, {id: '2', hold: 0, transition: 0}, {id: '3', hold: 3, transition: 3}]},
  ];
  const sequence = projectSceneSequence(reading);
  const steps = reading.presented.entities.reduce((sum, entity) => sum + (entity.sequence?.length ?? 0), 0);
  assert.equal(sequence.notes.length, steps);
  assert.equal(sceneSequenceAsTracks(reading).clips.length, steps);
});

// ── the family-free contract and the sources ──────────────────────────────────

test('the adapter sources import no React and name no other family; the World contract names no Expression', async () => {
  for (const file of ['worldTrackAdapter.ts', 'expressionsTrackAdapter.ts', 'expressionsSequenceEditor.ts']) {
    const source = await readFile(new URL(file, timeline), 'utf8');
    assert.equal(/from ['"]react['"]/.test(source), false, `${file} must not import React`);
    assert.equal(/Factory|Central|techne|Techne/.test(source), false, `${file} must not name another family`);
  }
  const contract = await readFile(new URL('worldTrackAdapter.ts', timeline), 'utf8');
  assert.equal(/xpression/.test(contract), false, 'the World track contract stays family-free');
});
