/** Retire the eight test-only works from an actual pre-stop owner snapshot.
 * Opt-in OI_NATIVE_MATERIAL_RETIREMENT=1, existing OI_NATIVE_MATERIAL_URL,
 * OI_NATIVE_MATERIAL_OLD_SNAPSHOT and an existing owner-relative
 * OI_NATIVE_MATERIAL_EVIDENCE_DIRECTORY. No server/build/store purge. */
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
const {kernelOp}=await import(new URL('desktop/cradle/src/kernel/bridge.ts',root));
const ownRefs=[
 'expression:material-verification-267a7f4d-0c08-42f1-8e7e-3d1264595ae7',
 'expression:material-verification-c666c045-d5fa-4d2f-b395-e1a397deaabb',
 'expression:material-verification-349f6cb4-a8bb-48a2-a04a-173d43706973',
 'expression:material-verification-5ca92007-b7ca-45f7-bf70-977ffe7466da',
 'expression:material-verification-786ae5ed-0cfa-4048-814b-7077839886ff',
 'expression:material-verification-7c0dd553-e35d-4817-ac44-0a6950d3208e',
 'expression:material-verification-a86c5f73-6512-46be-b91b-7d33acab3efd',
 'expression:material-verification-e97c6038-aa8e-4026-a2c6-bb4860ad0837',
];
test('captured old-runtime test works are natively saved and retired without touching other works',{
 skip:process.env.OI_NATIVE_MATERIAL_RETIREMENT==='1'?false:'Opt in to exact old-test snapshot retirement',timeout:300000,
},async()=>{
 const url=process.env.OI_NATIVE_MATERIAL_URL,snapshotPath=process.env.OI_NATIVE_MATERIAL_OLD_SNAPSHOT,directoryPath=process.env.OI_NATIVE_MATERIAL_EVIDENCE_DIRECTORY;
 assert.ok(url);assert.ok(snapshotPath);assert.ok(directoryPath);
 const captured=JSON.parse(await readFile(snapshotPath,'utf8'));assert.equal(captured.runtime_pid,64538);
 const request=async input=>{const reply=await kernelOp({kind:'bridge',url},input);assert.equal(reply.error,undefined,reply.error);assert.ok(reply.outcome);return reply.outcome;};
 const operation=async(op,input)=>{const outcome=await request({op,request:input});assert.equal(outcome.result,op);return outcome.data;};
 const actor='agent:native-material-independent-verification';
 const directory=await request({op:'files_list',path:directoryPath,fresh:true});assert.equal(directory.result,'directory_read');
 const parent=directory.directory.location;assert.ok(parent.ref);assert.ok(parent.root);assert.equal(parent.path,directoryPath);
 const before=await operation('expression',{operation:'list'});
 assert.ok(Array.isArray(before.expressions));assert.equal(before.expressions.some(item=>ownRefs.includes(item.expression_ref)),false,'never overwrite a currently open work with a historical capture');
 const effects=[];
 try{
  for(const expression_ref of ownRefs){
   const original=captured.readings[expression_ref];assert.equal(original.ok,true);assert.equal(original.outcome.result,'expression');
   const document=original.outcome.data.document;assert.equal(document.expression_ref,expression_ref);
   const opened=await operation('expression',{operation:'open',document,actor});assert.equal(opened.state,'ready');assert.deepEqual(opened.document,document);
   const listed=await operation('expression_world',{operation:'act_list',expression_ref});assert.equal(listed.state,'acts');
   for(const item of listed.acts){
    assert.equal(item.expression_ref,expression_ref);
    const inspected=await operation('expression_world',{operation:'act_inspect',act_ref:item.act_ref});assert.equal(inspected.state,'act');assert.equal(inspected.act.expression_ref,expression_ref);
    if(!['completed','cancelled'].includes(inspected.act.phase)){
     const ended=await operation('expression_world',{operation:'act_complete',act_ref:item.act_ref,actor,cancelled:true,expected_act_revision:inspected.act.revision,expected_revision:document.revision});assert.equal(ended.state,'act_cancelled');
    }
    const archived=await operation('expression_world',{operation:'act_archive',act_ref:item.act_ref,actor});assert.equal(archived.state,'act_archived');
    effects.push({operation:'act_archive',expression_ref,act_ref:item.act_ref});
   }
   const saved=await operation('expression',{operation:'save_as',expression_ref,expected_revision:document.revision,parent,
    name:`old-runtime-${expression_ref.slice('expression:material-verification-'.length)}.expression.json`,operation_ref:`operation:native-material-retirement:${crypto.randomUUID()}`,actor,actor_kind:'agent'});
   assert.equal(saved.state,'saved');assert.equal(saved.readback_verified,true);assert.equal(saved.expression_revision,document.revision);assert.equal(saved.file.location.root,parent.root);
   assert.deepEqual((await operation('expression',{operation:'inspect',expression_ref})).document,document);
   const closed=await operation('expression',{operation:'close',expression_ref,actor});assert.equal(closed.state,'closed');
   effects.push({operation:'save-close',source_runtime_pid:captured.runtime_pid,expression_ref,revision:document.revision,file:saved.file});
   const checkpoint=await operation('expression_recovery',{operation:'read',scope:'expressions',kind:'checkpoint',id:expression_ref});
   if(checkpoint.record){
    assert.equal(checkpoint.record.id,expression_ref);
    const proofPath=join(parent.root,parent.path,`old-runtime-checkpoint-${expression_ref.slice('expression:material-verification-'.length)}.json`);
    await writeFile(proofPath,JSON.stringify({source_runtime_pid:captured.runtime_pid,candidate:url,record:checkpoint.record},null,2),{flag:'wx'});
    const removed=await operation('expression_recovery',{operation:'remove',scope:'expressions',kind:'checkpoint',id:expression_ref,expected_revision:checkpoint.record.revision});assert.equal(removed.state,'removed');
    effects.push({operation:'checkpoint-retirement',expression_ref,revision:checkpoint.record.revision,proof:proofPath});
   }
  }
  const after=await operation('expression',{operation:'list'});
  assert.equal(after.expressions.some(item=>ownRefs.includes(item.expression_ref)),false);
  const identity=list=>list.map(item=>item.expression_ref).sort();assert.deepEqual(identity(after.expressions),identity(before.expressions));
 }finally{
  console.info('old-runtime test retirement',JSON.stringify({candidate:url,source_runtime_pid:captured.runtime_pid,source_snapshot:snapshotPath,owned_expression_refs:ownRefs,effects,standing:'historical owner documents reopened solely for verified native save and retirement; current UI acceptance pending'}));
 }
});
