import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// Production boundary and desktop owner sources, transpiled in memory. The native document is a minimal fixture; no owner, store or server is simulated.
const root = new URL('../../../', import.meta.url);
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

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const [{projectNativeScenes}, {isNativeScenesReading}, {kernelDocumentToJourney}, {blankJourney, clone}] = await Promise.all([
  import(new URL('packages/expressions-boundary/src/scenes.ts', root)),
  import(new URL('packages/expressions-boundary/src/scenesValidation.ts', root)),
  import(new URL('kernelDocumentBridge.ts', author)),
  import(new URL('model.ts', author)),
]);

const SCENE = 'expression:whole:scene:main';
const BASIS = {expression_ref: 'expression:whole', revision: 1, scene_ref: SCENE};
function seed() {
  const journey = blankJourney();
  journey.name = 'A working inquiry';
  journey.scenes[0].name = 'First';
  const document = {schema: 'oi.expression/v1', expression_ref: 'expression:whole', revision: 1, title: journey.name,
    scenes: [{scene_ref: SCENE, revision: 1, title: 'Main', entity_refs: []}], entities: {}, relations: {},
    selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: []};
  return kernelDocumentToJourney(document, {identity: {expression: journey.id, scenes: {[SCENE]: journey.scenes[0].id}}});
}

test('the scenes reading carries the working Expression description, empty included', () => {
  const view = seed();
  const working = clone(view.journey);
  working.description = 'A study of ink, in three movements.';
  const reading = projectNativeScenes(working, view);
  assert.equal(reading.description, 'A study of ink, in three movements.');
  assert.equal(reading.title, working.name, 'the title is still the Journey name');
  working.description = '';
  assert.equal(projectNativeScenes(working, view).description, '');
});

test('the scenes reading qualifies its description: text of at most 5000 characters, optional on the wire', () => {
  const view = seed();
  const reading = projectNativeScenes(clone(view.journey), view);
  assert.equal(isNativeScenesReading(reading, BASIS), true);
  assert.equal(isNativeScenesReading({...reading, description: 'x'.repeat(5000)}, BASIS), true);
  assert.equal(isNativeScenesReading({...reading, description: 'x'.repeat(5001)}, BASIS), false, 'overlong text is refused');
  assert.equal(isNativeScenesReading({...reading, description: 12}, BASIS), false, 'non-text is refused');
  const older = {...reading};
  delete older.description;
  assert.equal(isNativeScenesReading(older, BASIS), true, 'an older reading without a description still qualifies');
});

// O-I #855 round 24 (DLW build ruling 2026-11-05: "Project `take-lane:torus/*` into the Expressions track adapter"): the Torus takes a
// Scene's performance lays under it, as the kernel keeps them (expression_performance/torus.rs TorusTakeRecord: the take whole, the layer of
// its lane, the sample of the performance's transport it lies at; expression_performance.rs Layer and Counter, a canonical decimal).
test('the scenes reading carries the Torus takes a Scene\'s performance lays under it, each on its take lane, qualified whole', () => {
  const view = seed();
  const take = (ref, frames, rate = 48000) => ({schema: 'oi.torus-take/v1', take_ref: ref, sample_rate: rate, frames})
  const lane = (ref, title, enabled = true) => ({layer_ref: ref, title, enabled, solo: false})
  view.document.scenes[0].performance = {sample_rate: 48000,
    layers: [lane('take-lane:torus/3', 'Take 3'), lane('note-lane:keys', 'Keys'), lane('take-lane:torus/4', 'Take 4', false)],
    torus_takes: [{take: take('sha256:' + '1'.repeat(64), '144000'), layer: 0, at_sample: '96000'},
      {take: take('sha256:' + '2'.repeat(64), '48000'), layer: 1, at_sample: '0'},
      {take: take('sha256:' + '3'.repeat(64), '48000'), layer: 2, at_sample: '096000'},
      {take: take('sha256:' + '4'.repeat(64), '24000', 24000), layer: 2, at_sample: '480000'}]}
  const reading = projectNativeScenes(clone(view.journey), view);
  assert.deepEqual(reading.scenes[0].torus_takes, [
    {lane_ref: 'take-lane:torus/3', title: 'Take 3', enabled: true, solo: false, take_ref: 'sha256:' + '1'.repeat(64), at_sample: '96000', frames: '144000',
      sample_rate: 48000, at_seconds: 2, seconds: 3},
    {lane_ref: 'take-lane:torus/4', title: 'Take 4', enabled: false, solo: false, take_ref: 'sha256:' + '4'.repeat(64), at_sample: '480000', frames: '24000',
      sample_rate: 24000, at_seconds: 10, seconds: 1}],
    'a lane that is no Torus take lane, and a sample written as no counter, lay none; the transport runs at the performance\'s rate, a take\'s length at its own');
  assert.equal(isNativeScenesReading(reading, BASIS), true);
  const tampered = (edit) => { const copy = structuredClone(reading); edit(copy.scenes[0].torus_takes[0]); return isNativeScenesReading(copy, BASIS) }
  assert.equal(tampered(row => { row.seconds = 4 }), false, 'its length is its frames at its rate');
  assert.equal(tampered(row => { row.lane_ref = 'note-lane:keys' }), false, 'on a Torus take lane');
  assert.equal(tampered(row => { row.at_sample = 96000 }), false, 'its sample a counter as the kernel writes one');
  assert.equal(tampered(row => { row.sample_rate = 1 }), false);
  assert.equal(isNativeScenesReading({...reading, scenes: [{...reading.scenes[0], torus_takes: []}]}, BASIS), false, 'none is written as absent');
  delete view.document.scenes[0].performance;
  assert.equal('torus_takes' in projectNativeScenes(clone(view.journey), view).scenes[0], false, 'a Scene with no performance lays none');
});
