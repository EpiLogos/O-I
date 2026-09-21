import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSTRUCTION, ACTOR} from '../src/knowledge/construction.ts';
import {compositionReturnRequest, attachCompositionReturn, compositionAttached, compositionReturnRecorded} from '../src/knowledge/constructionProjection.ts';
import {readSavedArtifact} from '../src/knowledge/artifactRecovery.ts';
import {emptyDraft, fromNative} from '../src/knowledge/constructionDraft.ts';
import {restoreConstructionCheckpoint} from '../src/knowledge/constructionCheckpoint.ts';
const transport={kind:'bridge',url:'http://controlled.invalid'};
const location={schema:'central.path-ref/v1',root:'/ground',path:'Work/Notes/inquiry.expression.json',ref:'central:path:ground:inquiry.expression.json'};
const frame={ref:'wiki:frame:one',revision:3,constellations:[{anchor_ref:'wiki:anchor:one',members:[]}],[CONSTRUCTION]:{title:'Inquiry',inquiry:{question:'What follows?'},frame:null,compositions:[]}};
const document={schema:'oi.expression/v1',expression_ref:'expression:one',revision:4,entities:{},relations:{},scenes:[],selection:{scene_ref:'scene:a',entity_ref:null},provenance:[],representations:[],refinements:[]};
const artifact={file:{location,revision:'file:r4',content:JSON.stringify(document)},document};
const register={file:{location:{...location,path:'ProjectCentral/agents/wiki/wiki.json',ref:'central:path:register'},revision:'register:r3'},source_ref:'source:register',frames:[frame],relations:[],spaces:[]};
function nativeReply(request){
 const returned={...frame,revision:4,[CONSTRUCTION]:{...frame[CONSTRUCTION],compositions:[request.changes[0].composition]}};
 return {result:'action_dispatched',dispatch:{state:'invoked',data:{schema:'aikit.constellation/v1',frame_ref:frame.ref,revision:4,persisted:true,state:'saved',reading:{frame:returned,construction:returned[CONSTRUCTION],relations:[]}}},receipts:[]};
}

test('an interrupted Return retries the same native operation, not a newly minted attachment',async()=>{
 const request=compositionReturnRequest(frame,artifact),calls=[];
 const apply=async op=>{calls.push(op);if(calls.length===1)return null;return nativeReply(op.invocation.input.request);};
 await assert.rejects(attachCompositionReturn(transport,'Notes',register,frame,artifact,apply,request),/did not return/);
 const result=await attachCompositionReturn(transport,'Notes',register,frame,artifact,apply,request);
 assert.equal(calls.length,2);
 assert.equal(calls[0].invocation.input.request.operation_ref,request.operation_ref);
 assert.deepEqual(calls[1].invocation.input.request,calls[0].invocation.input.request);
 assert.ok(compositionAttached(result.reading.frame,artifact));
 assert.equal(calls[0].invocation.input.sources[0].location.ref,location.ref);
});

test('a restored Return cannot redirect the attachment or hide other edits',async()=>{
 const request=compositionReturnRequest(frame,artifact);let calls=0;
 const apply=async()=>{calls++;return null;};
 for(const changed of [{...request,frame_ref:'wiki:another'},{...request,actor_ref:'agent:other'},{...request,changes:[...request.changes,{change:'member_remove',participation_ref:'part:a'}]},
  {...request,changes:[{change:'composition_attach',composition:{...request.changes[0].composition,revision:'8'}}]}]){
  await assert.rejects(attachCompositionReturn(transport,'Notes',register,frame,artifact,apply,changed),/no longer matches/);
 }
 assert.equal(calls,0);
});

test('the saved file and pending Return survive checkpoint restoration with exact identities',()=>{
 const pending=compositionReturnRequest(frame,artifact);
 const checkpoint={draft:fromNative(frame,[]),pending,saved:true,artifact:{location,revision:artifact.file.revision,expression_ref:document.expression_ref}};
 const restored=restoreConstructionCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
 assert.equal(restored.pending.operation_ref,pending.operation_ref);
 assert.deepEqual(restored.artifact,checkpoint.artifact);
 assert.equal(restored.pending.actor_ref,ACTOR);
});

test('recovery reads the exact saved artifact without opening, rewriting or replacing a live composition',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(_url,options)=>{const op=JSON.parse(options.body);calls.push(op);return {json:async()=>({ok:true,outcome:{result:'file_read',reading:artifact.file}})};};
 try{
  const held={location,revision:'file:r4',expression_ref:'expression:one'};
  assert.deepEqual(await readSavedArtifact(transport,held),artifact);
  await assert.rejects(readSavedArtifact(transport,{...held,revision:'file:older'}),/file has changed/);
  await assert.rejects(readSavedArtifact(transport,{...held,expression_ref:'expression:another'}),/recorded Expression/);
  assert.ok(calls.every(op=>op.op==='file_read'));
 }finally{globalThis.fetch=original;}
});

test('already-returned status requires the artifact revision and native file basis, not merely its name',()=>{
 const request=compositionReturnRequest(frame,artifact),recorded=nativeReply(request).dispatch.data.reading.frame;
 assert.ok(compositionAttached(recorded,artifact));
 assert.equal(compositionAttached(recorded,{...artifact,document:{...document,revision:5}}),false);
 assert.equal(compositionAttached(recorded,{...artifact,file:{...artifact.file,revision:'file:changed'}}),false);
 assert.equal(compositionAttached(recorded,{...artifact,file:{...artifact.file,location:{...location,root:'/other'}}}),false);
});


test('operation inspection requires current attachment and the recorded native actor/basis, not just an id',()=>{
 const request=compositionReturnRequest(frame,artifact);
 const recorded={...nativeReply(request).dispatch.data.reading.frame};
 recorded[CONSTRUCTION]={...recorded[CONSTRUCTION],applied:{[request.operation_ref]:{actor_ref:request.actor_ref,basis_revision:3,result_revision:4,request_digest:'a'.repeat(64)}}};
 assert.equal(compositionReturnRecorded(recorded,request),true);
 assert.equal(compositionReturnRecorded({...recorded,revision:8},request),true,'later unrelated edits do not erase a still-present Return');
 const mutate=patch=>({...recorded,[CONSTRUCTION]:{...recorded[CONSTRUCTION],...patch}});
 assert.equal(compositionReturnRecorded(mutate({compositions:[]}),request),false,'historical receipt is not current attachment');
 for(const patch of [{actor_ref:'agent:other'},{basis_revision:2},{result_revision:5},{request_digest:'unverified'}]){
  const applied={[request.operation_ref]:{...recorded[CONSTRUCTION].applied[request.operation_ref],...patch}};
  assert.equal(compositionReturnRecorded(mutate({applied}),request),false);
 }
 assert.equal(compositionReturnRecorded(recorded,{...request,frame_ref:'wiki:other'}),false);
});

test('a redirected or malformed saved artifact cannot become a retry basis',async()=>{
 const original=globalThis.fetch;let reading=artifact.file;
 globalThis.fetch=async()=>({json:async()=>({ok:true,outcome:{result:'file_read',reading}})});
 try{
  const held={location,revision:'file:r4',expression_ref:'expression:one'};
  reading={...artifact.file,location:{...location,root:'/different'}};
  await assert.rejects(readSavedArtifact(transport,held),/redirected/);
  for(const change of [{entities:[]},{relations:[]},{revision:0},{scenes:{}}]){
   reading={...artifact.file,content:JSON.stringify({...document,...change})};
   await assert.rejects(readSavedArtifact(transport,held),/recorded Expression/);
  }
 }finally{globalThis.fetch=original;}
});


test('an idempotent reply whose attachment was replaced cannot complete the old Return',async()=>{
 const request=compositionReturnRequest(frame,artifact);let calls=0;
 const apply=async()=>{
  calls++;const reply=nativeReply(request),saved=reply.dispatch.data;
  saved.state='unchanged';saved.reading.frame[CONSTRUCTION].compositions=[];
  return reply;
 };
 await assert.rejects(attachCompositionReturn(transport,'Notes',register,frame,artifact,apply,request),/current attachment differs/);
 assert.equal(calls,1,'a mismatch is inspectable, not a reason to dispatch another change');
});
