// O-I #747 round 894, the port ledger's native-save-file, native-resolve and native-retry-file, at the manual's home for them (§20.1 Where
// everything is: "Save, undo and redo | The File and Edit menus, and the Studio's head"). The app's own acts were its native-status line:
// a file dialog (native-save-file), "Resolve interrupted save" (native-resolve) and "Retry file save" (native-retry-file, app.ts native
// status). The DLW shows no such line; the Studio's Save carries all three:
//   - a work is a file: the Save writes the work's own bound file (the works home at New, or the file it was opened from) and reads it back;
//   - an interrupted Save is settled before the next Save writes anything (nativeWorking.ts settlePending): a file save that reached the
//     owner is adopted, one that did not is dropped, and the next Save writes the file again from the work as it stands. Nothing is
//     replayed blindly.
// Channels: SCRIPTED over the real NativeWorking with a fake owner and a fake file owner (as native-composition.test.mjs); the kernel's own
// save is kernel/src/expression.rs Request::Save and its tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {blankJourney,entity,clone} from '../build/model.js';
import {initialiseSceneSaves} from '../build/sceneWorkflow.js';
import {NativeWorking} from '../build/nativeWorking.js';

function empty(ref,title){
 return {schema:'oi.expression/v1',expression_ref:ref,revision:1,title,scenes:[{scene_ref:ref+':scene:main',revision:1,title:'Main',entity_refs:[]}],entities:{},relations:{},selection:{scene_ref:ref+':scene:main',entity_ref:null},provenance:[],representations:[],refinements:[]};
}
function ownerEdit(document,request){
 if(request.expected_revision!==document.revision)return {state:'revision_conflict',current_revision:document.revision};
 const d=clone(document),scene=ref=>d.scenes.find(s=>s.scene_ref===ref);
 for(const c of request.changes){switch(c.change){
  case 'rename':d.title=c.title;break;
  case 'composition_set':d.presentation=clone(c.presentation);break;
  case 'entity_add':d.entities[c.entity_ref]={entity_ref:c.entity_ref,title:c.title,revision:1,subject:null,parameters:{glyph:{value:'O'}}};scene(c.scene_ref).entity_refs.push(c.entity_ref);break;
  case 'scene_rename':scene(c.scene_ref).title=c.title;break;
  case 'scene_compose':scene(c.scene_ref).entity_refs=[...c.entity_refs];break;
  case 'scene_material_set':scene(c.scene_ref).presentation=clone(c.presentation);if(!c.presentation.saved)delete scene(c.scene_ref).presentation.saved;break;
  case 'focus':d.selection={scene_ref:c.scene_ref,entity_ref:c.entity_ref};break;
  default:assert.fail('Unexpected native operation '+c.change);
 }}
 if(request.changes.length)d.revision++;
 return {state:'ready',document:d};
}
function authored(){const j=initialiseSceneSaves(blankJourney());j.name='Dawn study';j.scenes[0].name='First';j.scenes[0].entities=[entity('source role','A')];return j;}
const snapshot=j=>({journey:j,sceneId:j.scenes[0].id,entityId:j.scenes[0].entities[0]?.id??null});
const BOUND={schema:'central.path-ref/v1',ref:'central:file:dawn',root:'work',path:'Work/Expressions/dawn-study.expression.json'};

/** A fake owner and file owner. The file owner keeps what it was asked to write; `lose` drops the reply of the next perform after the write
 * landed (or, with `before`, before it landed): the interrupted Save. */
function ports(){
 let doc,fileRevision=1,lose=null;const effects=[],files=[],written=[];
 const options={mint:()=>'expression:dawn',checkpoint:async()=>{},
  expression:async request=>{
   effects.push(clone(request));
   if(request.operation==='create'){doc=empty(request.expression_ref,request.title);return {state:'ready',document:clone(doc)};}
   if(request.operation==='inspect')return {state:'ready',document:clone(doc)};
   if(request.operation==='edit'){const result=ownerEdit(doc,request);if(result.document)doc=result.document;return result;}
   throw new Error('unexpected port request '+request.operation);
  },
  file:async request=>{
   files.push(clone(request));
   if(request.operation==='prepare')return {intent:files.length,document:clone(request.document),destination:clone(request.destination)};
   if(request.operation==='perform'){
    if(lose==='before'){lose=null;throw new Error('lost before the write');}
    fileRevision++;written.push({path:request.intent.destination.location?.path??request.intent.destination.parent_path,revision:String(fileRevision),document:clone(request.intent.document)});
    if(lose==='after'){lose=null;throw new Error('lost after the write');}
    return {document:clone(request.intent.document),file:{location:BOUND,revision:String(fileRevision)}};
   }
   if(request.operation==='inspect'){
    const landed=written.find(item=>item.document.revision===request.intent.document.revision);
    return landed?{state:'saved',artifact:{document:clone(landed.document),file:{location:BOUND,revision:landed.revision}}}:{state:'unchanged'};
   }
   throw new Error('unexpected file request '+request.operation);
  }};
 return {options,effects,files,written,get doc(){return doc;},lose:when=>{lose=when;}};
}

test('the Save writes the work\'s own bound file and reads it back: the work is that file', async()=>{
 const p=ports(),work=new NativeWorking(p.options),j=authored();
 const {file}=await work.saveFileRecorded(snapshot(j),{location:BOUND,revision:'1'});
 assert.deepEqual(p.files.map(item=>item.operation),['prepare','perform'],'one prepared write, performed once');
 assert.deepEqual(p.files[0].destination,{location:BOUND,revision:'1'},'at the work\'s own bound file and the revision it was read at');
 assert.equal(p.written.length,1);
 assert.equal(p.written[0].path,BOUND.path);
 assert.equal(p.written[0].document.expression_ref,'expression:dawn','the file holds the work under its own identity');
 assert.deepEqual(file,{location:BOUND,revision:'2',expression_ref:'expression:dawn'},'read back: the work stands bound to its file at the new revision');
 assert.equal(work.state.pending,undefined,'nothing is left pending');
 assert.deepEqual(work.state.file,file);
 j.scenes[0].name='Second light';
 await work.saveFileRecorded(snapshot(j),{location:BOUND,revision:'1'});
 assert.deepEqual(p.files.at(-2).destination,{location:BOUND,revision:'2'},'the next Save writes the same file at the revision it holds now');
});

test('an interrupted Save whose write landed is adopted by the next Save; the write is not replayed (native-resolve)', async()=>{
 const p=ports(),work=new NativeWorking(p.options),j=authored();
 p.lose('after');
 await assert.rejects(()=>work.saveFileRecorded(snapshot(j),{location:BOUND,revision:'1'}),/lost after the write/);
 assert.equal(work.state.pending.kind,'file','the interrupted file save is kept, never forgotten');
 assert.equal(p.written.length,1,'the write itself landed');
 const performs=()=>p.files.filter(item=>item.operation==='perform').length;
 assert.equal(performs(),1);
 await work.saveFileRecorded(snapshot(j),{location:BOUND,revision:'1'});
 const after=p.files.map(item=>item.operation);
 assert.deepEqual(after,['prepare','perform','inspect','prepare','perform'],'the next Save first asks the file owner what became of the interrupted one');
 assert.deepEqual(p.files[3].destination,{location:BOUND,revision:'2'},'the landed write is adopted: the next Save writes at the revision it left');
 assert.equal(work.state.pending,undefined,'and settles it');
 assert.equal(work.state.file.location.path,BOUND.path,'the work stays bound to its file');
});

test('an interrupted Save whose write never landed is dropped, and the next Save writes the file again (native-retry-file)', async()=>{
 const p=ports(),work=new NativeWorking(p.options),j=authored();
 p.lose('before');
 await assert.rejects(()=>work.saveFileRecorded(snapshot(j),{location:BOUND,revision:'1'}),/lost before the write/);
 assert.equal(work.state.pending.kind,'file');
 assert.equal(p.written.length,0,'nothing reached the file');
 const {file}=await work.saveFileRecorded(snapshot(j),{location:BOUND,revision:'1'});
 assert.deepEqual(p.files.map(item=>item.operation),['prepare','perform','inspect','prepare','perform'],'settled first, then written again');
 assert.equal(p.written.length,1,'the file is written once, from the work as it stands');
 assert.equal(file.location.path,BOUND.path);
 assert.equal(work.state.pending,undefined);
});
