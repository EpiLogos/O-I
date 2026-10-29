import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSTRUCTION} from '../src/knowledge/construction.ts';
import {compositionReturnRequest, attachCompositionReturn, compositionAttached} from '../src/knowledge/constructionProjection.ts';
// The retired authoring panel's retained-Return checkpoint and its file and operation inspections retired with it (O-I #742): a Return is
// one act now (constellationActs.ts returnExpression), and pressing it again lands on its own file and attaches nothing twice.
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

test('already-returned status requires the artifact revision and native file basis, not merely its name',()=>{
 const request=compositionReturnRequest(frame,artifact),recorded=nativeReply(request).dispatch.data.reading.frame;
 assert.ok(compositionAttached(recorded,artifact));
 assert.equal(compositionAttached(recorded,{...artifact,document:{...document,revision:5}}),false);
 assert.equal(compositionAttached(recorded,{...artifact,file:{...artifact.file,revision:'file:changed'}}),false);
 assert.equal(compositionAttached(recorded,{...artifact,file:{...artifact.file,location:{...location,root:'/other'}}}),false);
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
