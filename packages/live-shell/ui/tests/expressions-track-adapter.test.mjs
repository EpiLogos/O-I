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
const {expressionsTrackAdapter, projectExpressionsTracks, EXPRESSIONS_TRACK_ADAPTER_ID} = await import(new URL('expressionsTrackAdapter.ts', timeline));

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

test('the adapter declares its id and projects through the World track contract', () => {
  assert.equal(EXPRESSIONS_TRACK_ADAPTER_ID, 'expressions-track-adapter');
  assert.equal(expressionsTrackAdapter.id, 'expressions-track-adapter');
  assert.deepEqual(expressionsTrackAdapter.project(fixture()), projectExpressionsTracks(fixture()));
});

test('columns are the scenes, in reading order', () => {
  const set = projectExpressionsTracks(fixture());
  assert.deepEqual(set.columns, [
    {id: 'scene-a', name: 'Opening'},
    {id: 'scene-b', name: 'Turn'},
  ]);
});

test('tracks are one row per entity of the presented scene, plus an automation track', () => {
  const set = projectExpressionsTracks(fixture());
  assert.deepEqual(set.tracks, [
    {id: 'entity:glyph-1', name: 'Glyph', kind: 'entity'},
    {id: 'entity:force-1', name: 'Force', kind: 'entity'},
    {id: 'automation:scene-b', name: 'Automation', kind: 'automation'},
  ]);
});

test('a two-step glyph produces two glyph-state spans on the presented scene column', () => {
  const set = projectExpressionsTracks(fixture());
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
  const spans = projectExpressionsTracks(reading).clips.map((clip) => clip.span);
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
  assert.deepEqual(projectExpressionsTracks(reading).clips.map((clip) => clip.label), ['square', 'T', 'lonely']);
});

test('an automation lane appears as an automation track, and only when a lane exists', () => {
  const withLane = projectExpressionsTracks(fixture());
  assert.ok(withLane.tracks.some((track) => track.kind === 'automation'));

  const reading = fixture();
  reading.presented.automationLanes = [];
  const withoutLane = projectExpressionsTracks(reading);
  assert.equal(withoutLane.tracks.some((track) => track.kind === 'automation'), false);
  assert.equal(withoutLane.tracks.length, 2);
});

test('a property track is exposed as a transport take and is never a clock or a track', () => {
  const set = projectExpressionsTracks(fixture());
  assert.deepEqual(set.transport, {takes: [{id: 'take-1', target: 'entity:glyph-1.scale', name: 'Take take-1'}]});

  const everywhere = JSON.stringify({columns: set.columns, tracks: set.tracks, clips: set.clips});
  assert.equal(everywhere.includes('take-1'), false, 'a take does not appear as a column, track or clip');
  for (const track of set.tracks) assert.notEqual(track.kind, 'clock');
  assert.equal(set.tracks.some((track) => track.id.includes('take')), false);
});

test('the columns and clips follow the presented scene, not a fixed scene', () => {
  const reading = fixture({presentedSceneId: 'scene-a'});
  const set = projectExpressionsTracks(reading);
  assert.deepEqual(set.columns.map((column) => column.id), ['scene-a', 'scene-b']);
  assert.ok(set.clips.every((clip) => clip.columnId === 'scene-a'));
  assert.ok(set.tracks.some((track) => track.id === 'automation:scene-a'));
});

test('a presented scene absent from the reading is refused', () => {
  assert.throws(() => projectExpressionsTracks(fixture({presentedSceneId: 'missing'})), /Presented scene missing is not in the reading/);
});

test('a negative or non-finite step duration is refused', () => {
  const reading = fixture();
  reading.presented.entities[0].sequence[0].hold = -1;
  assert.throws(() => projectExpressionsTracks(reading), /hold must be a finite, non-negative number/);
});

test('the adapter sources import no React and no other family adapter', async () => {
  for (const file of ['worldTrackAdapter.ts', 'expressionsTrackAdapter.ts']) {
    const source = await readFile(new URL(file, timeline), 'utf8');
    assert.equal(/from ['"]react['"]/.test(source), false, `${file} must not import React`);
    assert.equal(/Factory|Central|techne|Techne/.test(source), false, `${file} must not name another family`);
  }
});
