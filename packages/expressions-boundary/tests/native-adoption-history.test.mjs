import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

const root = new URL('../../../',import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){try{return await next(specifier,context)}catch(error){if(!specifier.startsWith('.'))throw error;if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}throw error}}
export async function load(url,context,next){if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:new URL(url).pathname}).outputText}}
`)}`,import.meta.url);
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{kernelDocumentToJourney},{prepareCompositionEdit},{DocumentStore},{applyNativeGlyphChanges},{nativeAdoptionHistory},{initialiseSceneSaves},{initialiseShared},ts] = await Promise.all([
  import(new URL('kernelDocumentBridge.ts',author)),import(new URL('kernelComposition.ts',author)),import(new URL('store.ts',author)),
  import(new URL('hostEditor.ts',author)),import(new URL('nativeAdoption.ts',author)),import(new URL('sceneWorkflow.ts',author)),import(new URL('sharedSettings.ts',author)),import(compiler),
]);
const evidence = '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/';
const inspection = JSON.parse(await readFile(process.env.OI_NATIVE_HISTORY_INSPECTION ?? evidence+'material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json','utf8'));
const acknowledgement = JSON.parse(await readFile(process.env.OI_NATIVE_HISTORY_ACK ?? evidence+'glyph-ui-timing-ack-20261008.json','utf8'));
const doc8 = inspection.after.document, doc9 = acknowledgement.response.outcome.data.document;
assert.equal(doc8.revision,8);assert.equal(doc9.revision,9);assert.equal(doc8.expression_ref,doc9.expression_ref);
assert.equal(acknowledgement.response.ok,true);assert.equal(acknowledgement.response.outcome.result,'expression');
const view8 = kernelDocumentToJourney(doc8),view9 = kernelDocumentToJourney(doc9);
const scene8 = view8.journey.scenes[0],entity8 = scene8.entities[0],step8 = entity8.sequence.steps[0];
const scene9 = view9.journey.scenes[0],entity9 = scene9.entities[0],step9 = entity9.sequence.steps[0];
assert.equal(step8.id,step9.id);assert.equal(step8.hold,2.05);assert.equal(step9.hold,2.35);
const timing = (document,stepId,hold) => applyNativeGlyphChanges(document,scene8.id,[{kind:'step-timing',entity_id:entity8.id,step_id:stepId,hold}]);

test('actual revision9 echo preserves exactly one local gesture Undo and rich Redo',()=>{
  const store = new DocumentStore(view8.journey),before = structuredClone(store.document);
  store.replace(timing(store.document,step8.id,step9.hold));
  assert.equal(store.undoStack.length,1);
  assert.deepEqual(prepareCompositionEdit(view9,store.document).changes,[]);
  assert.equal(nativeAdoptionHistory(view9,store.document),'preserve');
  store.acknowledge(view9.journey,nativeAdoptionHistory(view9,store.document));
  const acknowledged = structuredClone(store.document);
  assert.equal(store.undoStack.length,1);assert.equal(store.redoStack.length,0);
  assert.equal(store.undo(),true);assert.deepEqual(store.document,before);
  assert.equal(store.redo(),true);assert.deepEqual(store.document,acknowledged);
  assert.deepEqual(store.document.scenes[0].entities[0].sequence.steps,entity9.sequence.steps);
  assert.deepEqual(store.document.scenes[0].field,scene9.field);
});

test('a genuine incoming changed native body retires full-document Undo and Redo',()=>{
  const store = new DocumentStore(view8.journey);
  store.replace(timing(store.document,step8.id,1.8));
  store.replace(timing(store.document,entity8.sequence.steps[1].id,4.25));
  assert.equal(store.undo(),true);assert.equal(store.undoStack.length,1);assert.equal(store.redoStack.length,1);
  assert.notDeepEqual(prepareCompositionEdit(view9,store.document).changes,[]);
  assert.equal(nativeAdoptionHistory(view9,store.document),'retire');
  store.acknowledge(view9.journey,nativeAdoptionHistory(view9,store.document));
  assert.deepEqual(store.document,view9.journey);
  assert.equal(store.undo(),false);assert.equal(store.redo(),false);
  assert.equal(store.undoStack.length,0);assert.equal(store.redoStack.length,0);
  assert.deepEqual(store.document.scenes[0].entities[0].sequence.steps[0].layers,entity9.sequence.steps[0].layers);
});

test('direct authored native record adds one Undo; its following acknowledgement adds none',()=>{
  const store = new DocumentStore(view8.journey);
  store.replace(view9.journey);
  assert.equal(store.undoStack.length,1);assert.equal(nativeAdoptionHistory(view9,store.document),'preserve');
  store.acknowledge(view9.journey,nativeAdoptionHistory(view9,store.document));
  assert.equal(store.undoStack.length,1);assert.equal(store.undo(),true);assert.deepEqual(store.document,view8.journey);
  assert.equal(store.redo(),true);assert.deepEqual(store.document,view9.journey);
});

test('acknowledgement cannot consume a touched human transaction or clear either history stack',()=>{
  const store = new DocumentStore(view8.journey);
  store.replace(timing(store.document,step8.id,1.8));store.replace(timing(store.document,entity8.sequence.steps[1].id,4.25));store.undo();
  store.begin();store.document.scenes[0].entities[0].sequence.steps[2].hold=.8;store.touch();
  const draft = structuredClone(store.document),undo = structuredClone(store.undoStack),redo = structuredClone(store.redoStack),revision = store.revision;
  assert.throws(()=>store.acknowledge(view9.journey,'retire'),/Uncommitted authoring is retained/);
  assert.equal(store.transactionOpen,true);assert.equal(store.revision,revision);
  assert.deepEqual(store.document,draft);assert.deepEqual(store.undoStack,undo);assert.deepEqual(store.redoStack,redo);
  store.finish();assert.equal(store.transactionOpen,false);assert.equal(store.undoStack.length,2);
  assert.equal(store.undo(),true);assert.equal(store.document.scenes[0].entities[0].sequence.steps[2].hold,entity8.sequence.steps[2].hold);
});

test('same native work dirty recovery echo preserves rich history and different document acknowledgement refuses',()=>{
  const store = new DocumentStore(view8.journey);
  store.replace(timing(store.document,entity8.sequence.steps[1].id,4.25));
  const recovered = {...view8,journey:structuredClone(store.document)};
  assert.equal(nativeAdoptionHistory(recovered,store.document),'preserve');
  store.acknowledge(recovered.journey,nativeAdoptionHistory(recovered,store.document));
  assert.equal(store.undoStack.length,1);assert.equal(store.undo(),true);assert.deepEqual(store.document,view8.journey);
  const wrong = structuredClone(view9.journey);wrong.id+=':another';
  const before = structuredClone(store.document),revision = store.revision;
  assert.equal(nativeAdoptionHistory({...view9,journey:wrong},store.document),'retire');
  assert.throws(()=>store.acknowledge(wrong,'retire'),/another document/);
  assert.equal(store.revision,revision);assert.deepEqual(store.document,before);assert.equal(store.redoStack.length,1);
});

test('actual native material remains equivalent through production Scene/shared initialisation',()=>{
  const incoming = initialiseSceneSaves(initialiseShared(structuredClone(view9.journey)));
  assert.deepEqual(prepareCompositionEdit(view9,incoming).changes,prepareCompositionEdit(view9,view9.journey).changes);
  assert.equal(nativeAdoptionHistory(view9,incoming),'preserve');
});

// Static receiving classification is supplementary to actual store/body
// execution. Parse the real call expressions, not line numbers or summaries.
test('every production nativeWorkspace receiving path has its exact authored or acknowledged history policy',async()=>{
  const text = await readFile(new URL('nativeWorkspace.ts',author),'utf8'),file = ts.default.createSourceFile('nativeWorkspace.ts',text,ts.default.ScriptTarget.Latest,true);
  const calls = [];
  const scope = node => {
    for(let p=node.parent;p;p=p.parent){
      if(ts.default.isVariableDeclaration(p)&&p.initializer&&(ts.default.isArrowFunction(p.initializer)||ts.default.isFunctionExpression(p.initializer)))return p.name.getText(file);
      if(ts.default.isPropertyAssignment(p)&&(ts.default.isArrowFunction(p.initializer)||ts.default.isFunctionExpression(p.initializer)))return p.name.getText(file);
      if(ts.default.isFunctionDeclaration(p)&&p.name)return p.name.text;
    }
    throw Error('Receiving call has no authored source scope');
  };
  const visit = node => {if(ts.default.isCallExpression(node)&&node.expression.getText(file)==='host.load')calls.push([scope(node),node.arguments[2]?.getText(file)??'record']);ts.default.forEachChild(node,visit)};
  visit(file);
  assert.deepEqual(calls,[['adopt',"'acknowledge'"],['followOpen',"'acknowledge'"],['openReference',"'acknowledge'"],['changePage',"'acknowledge'"],['resolvePending','record'],['advance',"'acknowledge'"],['edit','record'],['duplicateOccurrence','record'],['insertSource','record'],['blueprint','record'],['refreshReference',"'acknowledge'"]]);
});

test('production app defaults native authored loads to record and does not shadow browser history',async()=>{
  const text = await readFile(new URL('app.ts',author),'utf8'),file = ts.default.createSourceFile('app.ts',text,ts.default.ScriptTarget.Latest,true);
  const declarations = new Map();ts.default.forEachChild(file,node=>{if(ts.default.isFunctionDeclaration(node)&&node.name)declarations.set(node.name.text,node)});
  for(const name of ['applyJourney','applyNativeView']) {
    const fn = declarations.get(name);assert.ok(fn);
    assert.equal(fn.parameters[2].initializer.getText(file),"'record'");
    assert.ok(fn.parameters.every(p=>p.name.getText(file)!=='history'));
  }
  assert.match(declarations.get('applyJourney').body.getText(file),/history\.replaceState/);
});
