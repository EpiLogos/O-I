// O-I #747 round 894, the port ledger's native-save-file, native-resolve and native-retry-file, at the manual's home for them (§20.1 Where
// everything is: "Save, undo and redo | The File and Edit menus, and the Studio's head"). The app's own acts were its native-status line:
// a file dialog (native-save-file), "Resolve interrupted save" (native-resolve) and "Retry file save" (native-retry-file, app.ts native
// status). The DLW shows no such line; the Studio's Save carries all three:
//   - a work is a file: the Save writes the work's own bound file (the works home at New, or the file it was opened from) and reads it back;
//   - an interrupted Save is settled before the next Save writes anything (nativeWorking.ts settlePending): a file save that reached the
//     owner is adopted, one that did not is dropped, and the next Save writes the file again from the work as it stands. Nothing is
//     replayed blindly.
// Round 895 (O-I #747, DLW build ruling 2026-11-08): the fake file owner keeps the revision check the real one keeps, so a write lands only
// on the revision it was read at. That proves the two Saves a missing check would hide: an interrupted Save whose write landed is adopted,
// never replayed at the revision it left behind (a lost write); and a file another writer changed underneath the work is refused, kept
// refused and never written over.
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

/** A fake owner and a fake file owner that keeps the file as Central does: one file at one revision, and a write lands only on the
 * revision it was read at. The kernel's Save answers file_revision_conflict when `current.revision != expected_file_revision` (kernel
 * expression.rs Request::Save), and the shell's reader throws it in these words (desktop/cradle/src/knowledge/expressionOutcome.ts). The
 * file owner's inspect is an independent read of the bound file, saved only when it holds the retained composition (inspectArtifactSave,
 * desktop/cradle/src/knowledge/artifactRecovery.ts). `lose` drops the reply of the next perform after the write landed (or, with `before`,
 * before it landed): the interrupted Save. `elsewhere` is another writer's write to the same file. */
const REFUSED='Expression save: file revision conflict. Inspect the current revision; the pending intent has not been rebased.';
function ports(){
 let doc,lose=null;const effects=[],files=[],written=[],refused=[],file={revision:1,document:null};
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
    const at=request.intent.destination.revision;
    if(at!==String(file.revision)){refused.push({at,current:String(file.revision)});throw new Error(REFUSED);}
    file.revision++;file.document=clone(request.intent.document);
    written.push({path:request.intent.destination.location?.path??request.intent.destination.parent_path,revision:String(file.revision),document:clone(request.intent.document)});
    if(lose==='after'){lose=null;throw new Error('lost after the write');}
    return {document:clone(request.intent.document),file:{location:BOUND,revision:String(file.revision)}};
   }
   if(request.operation==='inspect'){
    return file.document&&JSON.stringify(file.document)===JSON.stringify(request.intent.document)
     ?{state:'saved',artifact:{document:clone(file.document),file:{location:BOUND,revision:String(file.revision)}}}
     :{state:'conflict',detail:'The destination does not match the retained composition. Keep the pending operation and inspect the other file.'};
   }
   throw new Error('unexpected file request '+request.operation);
  }};
 return {options,effects,files,written,refused,get doc(){return doc;},get file(){return clone(file);},lose:when=>{lose=when;},
  elsewhere:title=>{file.revision++;file.document={...clone(file.document),title};}};
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
 assert.deepEqual(p.refused,[],'the adopted write lands on the revision it left: a blind replay would have been refused');
 assert.equal(p.file.revision,3);
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

test('a file changed underneath the work is never written over: the Save is refused at the revision it holds, and stays refused', async()=>{
 const p=ports(),work=new NativeWorking(p.options),j=authored();
 await work.saveFileRecorded(snapshot(j),{location:BOUND,revision:'1'});
 assert.equal(work.state.file.revision,'2');
 p.elsewhere('Dawn study, as another writer left it');
 const theirs=p.file;
 assert.equal(theirs.revision,3);
 j.scenes[0].name='Second light';
 await assert.rejects(()=>work.saveFileRecorded(snapshot(j),{location:BOUND,revision:'1'}),/file revision conflict/);
 assert.deepEqual(p.refused,[{at:'2',current:'3'}],'written at the revision the work read, which the file no longer holds: refused');
 assert.deepEqual(p.file,theirs,'the other writer\'s file stands');
 assert.equal(work.state.file.revision,'2','the work stays bound at the revision it read: nothing is rebased onto the other write');
 assert.equal(work.state.pending?.kind,'file','the exact operation is kept, never forgotten');
 await assert.rejects(()=>work.saveFileRecorded(snapshot(j),{location:BOUND,revision:'1'}),/file revision conflict/);
 assert.deepEqual(p.files.slice(-3).map(item=>item.operation),['inspect','prepare','perform'],'the next Save first reads what became of it');
 assert.equal(p.refused.length,2,'and is refused again: never forced');
 assert.deepEqual(p.file,theirs,'the other writer\'s file still stands');
 assert.equal(p.written.length,1,'the work wrote the file once, at its first Save');
});
