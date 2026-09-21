import test from 'node:test';
import assert from 'node:assert/strict';
import {performArtifactSave, inspectArtifactSave, restorePendingArtifactDocument} from '../src/knowledge/artifactRecovery.ts';
import {saveCompositionFile} from '../src/knowledge/constructionProjection.ts';
import {restoreConstructionCheckpoint} from '../src/knowledge/constructionCheckpoint.ts';
import {emptyDraft} from '../src/knowledge/constructionDraft.ts';
const transport={kind:'bridge',url:'http://controlled.invalid'};
const parent={schema:'central.path-ref/v1',root:'/ground',path:'Work/Notes',ref:'path:notes'};
const location={...parent,path:'Work/Notes/work.expression.json',ref:'path:work'};
const document={schema:'oi.expression/v1',expression_ref:'expression:work',revision:4,title:'Work',entities:{},relations:{},scenes:[],selection:{scene_ref:'scene:a',entity_ref:null},provenance:[],representations:[],refinements:[]};
const intent={schema:'oi.wiki-artifact-save/v1',document,destination:{parent,name:'work.expression.json',operation_ref:'operation:exact'}};
function fixture(initial,live=document){
 const original=globalThis.fetch;let file=initial, writes=0, requests=[];
 globalThis.fetch=async(_url,options)=>{
  const op=JSON.parse(options.body);requests.push(op);let outcome;
  if(op.op==='expression'&&op.request.operation==='inspect')outcome={result:'expression',data:{state:'read',document:live}};
  else if(op.op==='expression'&&op.request.operation==='save_as'){
   writes++;file={location,revision:'file-r1',content:JSON.stringify(live)};
   outcome={result:'expression',data:{state:'saved',persisted:true,readback_verified:true,file:{location,revision:'file-r1'},expression_revision:4}};
  } else if(op.op==='expression'&&op.request.operation==='open'){
   outcome={result:'expression',data:live&&JSON.stringify(live)!==JSON.stringify(op.request.document)?{state:'revision_conflict'}:{state:'opened',document:op.request.document}};
  }else if(op.op==='files_list')outcome={result:'directory_read',directory:{location:parent,entries:file?[{name:'work.expression.json',kind:'file',location}]:[]}};
  else if(op.op==='file_read')outcome={result:'file_read',reading:file};
  else throw new Error(`Unexpected operation ${JSON.stringify(op)}`);
  return {json:async()=>({ok:true,outcome})};
 };
 return {restore(){globalThis.fetch=original;},get writes(){return writes;},requests};
}
test('native saved-file receipt need not contain a document copy',async()=>{
 const f=fixture();try{
  const saved=await performArtifactSave(transport,intent);
  assert.equal(saved.file.revision,'file-r1');assert.deepEqual(saved.document,document);assert.equal(f.writes,1);
  assert.equal(f.requests.find(op=>op.request?.operation==='save_as').request.operation_ref,'operation:exact');
 }finally{f.restore();}
});
test('existing save client accepts native receipt and independently checks the file',async()=>{
 const f=fixture();try{const saved=await saveCompositionFile(transport,document,intent.destination);assert.deepEqual(saved.document,document);assert.equal(f.writes,1);}finally{f.restore();}
});
test('interrupted save recovery reads exact file contents without replaying a write',async()=>{
 const f=fixture({location,revision:'file-r1',content:JSON.stringify(document)});try{
  const recovered=await inspectArtifactSave(transport,intent);assert.equal(recovered.state,'saved');assert.equal(f.writes,0);
 }finally{f.restore();}
});
test('matching ref and revision with different content is not successful recovery',async()=>{
 const f=fixture({location,revision:'file-r1',content:JSON.stringify({...document,title:'Changed by another writer'})});try{
  assert.equal((await inspectArtifactSave(transport,intent)).state,'conflict');assert.equal(f.writes,0);
 }finally{f.restore();}
});
test('changed live document cannot be submitted with an old first-save operation identity',async()=>{
 const f=fixture(undefined,{...document,revision:5});try{
  await assert.rejects(performArtifactSave(transport,intent),/changed or was closed/);assert.equal(f.writes,0);
 }finally{f.restore();}
});
test('pending document and exact destination survive checkpoint restoration and explicit native reopen',async()=>{
 const value=restoreConstructionCheckpoint({draft:emptyDraft('wiki:space'),artifactSave:intent});
 assert.equal(value.artifactSave.destination.operation_ref,'operation:exact');
 assert.throws(()=>restoreConstructionCheckpoint({...value,artifactSave:{...intent,destination:{...intent.destination,name:'../different'}}}));
 const f=fixture(undefined,null);try{
  assert.deepEqual(await restorePendingArtifactDocument(transport,value.artifactSave),document);assert.equal(f.writes,0);
 }finally{f.restore();}
});
