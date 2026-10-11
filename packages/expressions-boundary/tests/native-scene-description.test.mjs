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
