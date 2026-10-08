/** Opt-in native checkpoint attachment of the parent's exact saved rich proof.
 * OI_NATIVE_MATERIAL_RICH_CHECKPOINT=1, OI_NATIVE_MATERIAL_URL and existing
 * OI_NATIVE_MATERIAL_EVIDENCE_DIRECTORY. No Expression edit/config/server. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
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
 const source=await readFile(new URL(url),'utf8');return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:new URL(url).pathname}).outputText};}
`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{kernelOp},{NativeWorking},{qualifyRecoveryBinding,acceptRecoveryDraft}]=await Promise.all([
 import(new URL('desktop/cradle/src/kernel/bridge.ts',root)),import(new URL('nativeWorking.ts',author)),import(new URL('nativeRecovery.ts',author)),
]);
test('actual saved rich owner work receives its explicit native checkpoint without editing its native basis',{
 skip:process.env.OI_NATIVE_MATERIAL_RICH_CHECKPOINT==='1'?false:'Opt in to parent-selected rich checkpoint attachment',timeout:120000,
},async()=>{
 const url=process.env.OI_NATIVE_MATERIAL_URL,directoryPath=process.env.OI_NATIVE_MATERIAL_EVIDENCE_DIRECTORY;assert.ok(url);assert.ok(directoryPath);
 const expression_ref='expression:rich-glyph-rack-bfae25f4-8639-4d16-a6c8-22302102880a';
 const binding=qualifyRecoveryBinding({scope:'expressions',checkpoint_id:expression_ref,expression_ref});
 const receipts=[];
 const raw=async input=>{const reply=await kernelOp({kind:'bridge',url},input);assert.equal(reply.error,undefined,reply.error);assert.ok(reply.outcome);
  receipts.push({operation:input.op,request:input.request?{...input.request,...(input.request.value?{value:{schema:input.request.value.schema}}:{})}:input,reply});return reply.outcome;};
 const operation=async(op,request)=>{const outcome=await raw({op,request});assert.equal(outcome.result,op);return outcome.data;};
 const directory=await raw({op:'files_list',path:directoryPath,fresh:true});assert.equal(directory.result,'directory_read');const parent=directory.directory.location;
 const before=await operation('expression',{operation:'inspect',expression_ref});assert.equal(before.state,'ready');assert.equal(before.document.expression_ref,expression_ref);
 assert.equal(before.dirty,false,'attach only the actual saved proof');assert.ok(before.file?.location);assert.ok(before.file.revision);
 const file={...before.file,expression_ref};
 const existing=await operation('expression_recovery',{operation:'read',scope:binding.scope,kind:'checkpoint',id:binding.checkpoint_id});assert.equal(existing.state,'ready');
 if(existing.record){
  acceptRecoveryDraft(binding,existing.record);
  assert.deepEqual(existing.record.value.view.document,before.document,'a different existing draft must be retained');
  assert.deepEqual(existing.record.value.file,file,'a different existing file basis must be retained');
  assert.equal(existing.record.value.pending,undefined,'retain any in-flight recovery work');
 }
 const work=new NativeWorking({expression:request=>operation('expression',request),file:async()=>assert.fail('Checkpoint attachment must not save or edit the file'),mint:()=>assert.fail('Checkpoint attachment must not mint work'),
  checkpoint:async(draft_id,value)=>{
   assert.equal(value.draft_id,draft_id);assert.equal(value.view.document.expression_ref,expression_ref);
   const written=await operation('expression_recovery',{operation:'write',scope:binding.scope,kind:'checkpoint',id:binding.checkpoint_id,expected_revision:existing.record?.revision??null,value});
   assert.equal(written.state,'written');assert.equal(acceptRecoveryDraft(binding,written.record),draft_id);
  }});
 const view=await work.adopt(before.document,file);
 const checkpoint=await operation('expression_recovery',{operation:'read',scope:binding.scope,kind:'checkpoint',id:binding.checkpoint_id});assert.equal(checkpoint.state,'ready');
 assert.deepEqual(checkpoint.record.value,work.state);assert.equal(checkpoint.record.value.schema,'oi.native-working/v1');assert.equal(checkpoint.record.id,expression_ref);
 const after=await operation('expression',{operation:'inspect',expression_ref});assert.deepEqual(after,before);
 assert.equal(view.document.revision,before.document.revision);assert.equal(view.document.selection.scene_ref,before.document.selection.scene_ref);
 const proof=join(parent.root,parent.path,`rich-native-checkpoint-${crypto.randomUUID()}.json`);
 await writeFile(proof,JSON.stringify({candidate:url,binding,native_revision:view.document.revision,scene_ref:view.document.selection.scene_ref,file,checkpoint:checkpoint.record,receipts,standing:'actual native checkpoint attachment; selected UI/GPU acceptance pending'},null,2),{flag:'wx'});
 console.info('rich native checkpoint',JSON.stringify({candidate:url,binding,record_schema:checkpoint.record.value.schema,checkpoint_revision:checkpoint.record.revision,draft_id:checkpoint.record.value.draft_id,native_revision:view.document.revision,scene_ref:view.document.selection.scene_ref,file,proof}));
});
