/** Read-only, real-owner rich-file inspection. Opt in with
 * OI_NATIVE_MATERIAL_ARTIFACT_INSPECTION=1, OI_NATIVE_MATERIAL_URL, and the
 * existing owner-relative OI_NATIVE_MATERIAL_EVIDENCE_DIRECTORY.
 * No Expression open, edit, save, close, or checkpoint operation is issued. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {register} from 'node:module';
import {join} from 'node:path';
const root=new URL('../../../',import.meta.url);
const typescript=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(typescript)};import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){try{return await next(specifier,context)}catch(error){
 if(specifier.startsWith('.')&&specifier.endsWith('.js'))return next(specifier.slice(0,-3)+'.ts',context);
 if(specifier.startsWith('.')&&!/\\.[cm]?[jt]s$/.test(specifier))return next(specifier+'.ts',context);throw error;}}
export async function load(url,context,next){if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
 return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:new URL(url).pathname}).outputText};}
`)}`,import.meta.url);
const [{kernelOp},{readFile},{inspectCompositionFile},{inspectArtifactSave,readSavedArtifact}]=await Promise.all([
 import(new URL('desktop/cradle/src/kernel/bridge.ts',root)),
 import(new URL('desktop/cradle/src/files/client.ts',root)),
 import(new URL('desktop/cradle/src/knowledge/constructionProjection.ts',root)),
 import(new URL('desktop/cradle/src/knowledge/artifactRecovery.ts',root)),
]);
const expression_ref='expression:rich-glyph-rack-bfae25f4-8639-4d16-a6c8-22302102880a';
const reference='central:path:/Users/admin/Central:Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/rich-glyph-rack-2026-10-08T00-08-12-830Z-bfae25f4/rich-glyph-rack.oi-expression.json';

/** Independent oracle from the actual file's disclosed storage contract.
 * It is never submitted to the owner or used to manufacture a native reply. */
function expandStored(stored){
 assert.equal(stored.schema,'oi.expression-storage/v1');
 assert.ok(stored.images.length>0,'use the actual embedded-image rich proof');
 const images=new Map(stored.images.map(image=>[image.ref,image.data_url]));
 assert.equal(images.size,stored.images.length);
 let references=0;
 const expand=value=>{
  if(Array.isArray(value))return value.map(expand);
  if(value&&typeof value==='object'){
   if(value.schema==='oi.expression-image-ref/v1'){
    assert.deepEqual(Object.keys(value).sort(),['ref','schema']);
    assert.ok(images.has(value.ref));references++;return images.get(value.ref);
   }
   return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,expand(item)]));
  }
  return value;
 };
 const document=expand(stored.document);
 assert.ok(references>=stored.images.length);
 return {document,image_count:images.size,image_occurrences:references};
}

test('actual rich storage inspection preserves every material field and refuses stale file basis without changing live work',{
 skip:process.env.OI_NATIVE_MATERIAL_ARTIFACT_INSPECTION==='1'?false:'Opt in to read-only actual native rich artifact inspection',timeout:240000,
},async t=>{
 const url=process.env.OI_NATIVE_MATERIAL_URL,directoryPath=process.env.OI_NATIVE_MATERIAL_EVIDENCE_DIRECTORY;
 assert.ok(url);assert.ok(directoryPath);
 const transport={kind:'bridge',url};const receipts=[];const originalFetch=globalThis.fetch;
 // Observe genuine HTTP exchanges, preserving the real response unchanged.
 globalThis.fetch=async(input,init)=>{
  const started=performance.now();
  try{
   const response=await originalFetch(input,init);
   const text=await response.clone().text();let reply;
   try{reply=JSON.parse(text);}catch{reply={text};}
   receipts.push({url:String(input),request:init?.body?JSON.parse(init.body):null,status:response.status,elapsed_ms:performance.now()-started,reply});
   return response;
  }catch(error){receipts.push({url:String(input),request:init?.body?JSON.parse(init.body):null,elapsed_ms:performance.now()-started,error:String(error)});throw error;}
 };
 let proof,before,inventoryBefore,after,inventoryAfter,standing='not executed',file,decoded,metrics;
 const raw=input=>kernelOp(transport,input);
 const operation=async request=>{const reply=await raw({op:'expression',request});assert.equal(reply.error,undefined,reply.error);assert.equal(reply.outcome?.result,'expression');return reply.outcome.data;};
 try{
  const directory=await raw({op:'files_list',path:directoryPath,fresh:true});assert.equal(directory.outcome?.result,'directory_read',directory.error);
  const parent=directory.outcome.directory.location;proof=join(parent.root,parent.path,`rich-artifact-inspection-${crypto.randomUUID()}.json`);
  before=await operation({operation:'inspect',expression_ref});assert.equal(before.state,'ready');
  inventoryBefore=await operation({operation:'list'});
  const resolved=await raw({op:'file_resolve',reference});assert.equal(resolved.outcome?.result,'file_resolved',resolved.error);assert.equal(resolved.outcome.location.ref,reference);
  file=await readFile(transport,resolved.outcome.location);
  metrics=expandStored(JSON.parse(file.content));
  assert.equal(metrics.document.expression_ref,expression_ref);
  const richScene=metrics.document.scenes[0].presentation.scene;
  assert.equal(richScene.entities[0].sequence.steps.length,3,'actual three-step Glyph proof');
  assert.equal(richScene.entities[0].sequence.steps[0].layers.length,2,'actual layered first step');
  assert.equal(richScene.parameterRacks.racks.length,2,'actual entity and field racks');
  assert.deepEqual(richScene.parameterRacks.racks.map(rack=>rack.scope.kind),['entity','field']);
  const request={operation:'inspect_file',location:file.location,expected_file_revision:file.revision};
  const actual=await raw({op:'expression',request});
  if(actual.outcome?.result!=='expression'){
   assert.match(actual.error??'',/unknown.*inspect_file|inspect_file.*unknown|unsupported/i,'retain genuine unsupported runtime only');
   standing='runtime does not support inspect_file; replay required after parent runtime rebuild';
   t.skip(standing);return;
  }
  decoded=actual.outcome.data;assert.equal(decoded.state,'ready');assert.deepEqual(decoded.file,{location:file.location,revision:file.revision});
  assert.deepEqual(decoded.document,metrics.document,'native decoder must retain the complete image-expanded rich file, including nested layers and racks');
  assert.deepEqual((await inspectCompositionFile(transport,file)).document,metrics.document);
  const intent={schema:'oi.wiki-artifact-save/v1',document:metrics.document,destination:{location:file.location,revision:file.revision}};
  const acknowledged=await inspectArtifactSave(transport,intent);assert.equal(acknowledged.state,'saved');assert.deepEqual(acknowledged.artifact.document,metrics.document);
  const mismatched=structuredClone(intent);mismatched.document.title+=' [different retained human intent]';
  assert.equal((await inspectArtifactSave(transport,mismatched)).state,'conflict','same identity and revision must not acknowledge different intended content');
  const held={location:file.location,revision:file.revision,expression_ref};
  assert.deepEqual((await readSavedArtifact(transport,held)).document,metrics.document);
  const stale=file.revision+':stale-test-basis';
  const refused=await operation({...request,expected_file_revision:stale});assert.equal(refused.state,'file_revision_conflict');assert.equal(refused.expected_revision,stale);assert.equal(refused.current_revision,file.revision);assert.equal(refused.document,undefined);
  await assert.rejects(inspectCompositionFile(transport,{...file,revision:stale}),/file_revision_conflict|exact inspected file|file revision/i);
  await assert.rejects(readSavedArtifact(transport,{...held,revision:stale}),/saved Expression file has changed/);
  await assert.rejects(readSavedArtifact(transport,{...held,expression_ref:expression_ref+':wrong-target'}),/no longer names the recorded Expression/);
  standing='actual native and production helper inspections passed; UI acceptance remains pending';
 }finally{
  try{
   if(before){after=await operation({operation:'inspect',expression_ref});inventoryAfter=await operation({operation:'list'});
    assert.deepEqual(after,before,'inspection must retain the full live document, selection, revision, dirty flag, and file identity');
    assert.deepEqual(inventoryAfter,inventoryBefore,'inspection must not mount or close any work');}
  }finally{
   globalThis.fetch=originalFetch;
   if(proof){await writeFile(proof,JSON.stringify({candidate:url,expression_ref,file,stored_image_count:metrics?.image_count,image_occurrences:metrics?.image_occurrences,saved_native_revision:metrics?.document.revision,standing,before,after,inventoryBefore,inventoryAfter,decoded,receipts},null,2),{flag:'wx'});
    console.info('rich artifact inspection',JSON.stringify({candidate:url,standing,file_revision:file?.revision,native_revision:before?.document?.revision,saved_native_revision:metrics?.document.revision,stored_image_count:metrics?.image_count,image_occurrences:metrics?.image_occurrences,proof}));}
  }
 }
});
