import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentStore} from '../build/store.js';
import {NativeWorking} from '../build/nativeWorking.js';

// E15c: the kernel half of labelled undo. One Save is one kernel checkpoint on
// the undo step it began from. Undo past that step submits the Save's whole
// inverse as one edit at the owner's expected revision; the steps the Save
// covers then undo and redo locally; Redo replays the Save's forward edit once.
// The native owner is simulated by the kernel's edit rules applied at
// expected_revision (a stale revision is refused, as the owner refuses it). The
// digests compare content; revision counters are not content.

const E='expression:kernel-undo';
const MAIN=`${E}:scene:main`;
const clone=value=>JSON.parse(JSON.stringify(value));
const sortKeys=value=>Array.isArray(value)?value.map(sortKeys):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sortKeys(value[key])])):value;
function digest(document){
 const content=clone(document);delete content.revision;
 for(const scene of content.scenes??[])delete scene.revision;
 for(const entity of Object.values(content.entities??{}))delete entity.revision;
 return JSON.stringify(sortKeys(content));
}
function kernelDocument(){
 return {schema:'oi.expression/v1',expression_ref:E,revision:1,title:'Inquiry',
  scenes:[{scene_ref:MAIN,revision:1,title:'Main',entity_refs:[]}],entities:{},relations:{},
  selection:{scene_ref:MAIN,entity_ref:null},provenance:[],representations:[],refinements:[]};
}
// The kernel edit rules this flow emits: a rename, a scene rename, a scene's material set or clear, and focus.
function applyKernel(document,changes){
 const next=clone(document),scene=ref=>{const found=next.scenes.find(s=>s.scene_ref===ref);if(!found)throw new Error(`no scene ${ref}`);return found;};
 for(const change of changes){
  switch(change.change){
   case 'rename':next.title=change.title;break;
   case 'scene_rename':scene(change.scene_ref).title=change.title;break;
   case 'scene_material_set':scene(change.scene_ref).presentation=clone(change.presentation);break;
   case 'scene_material_clear':delete scene(change.scene_ref).presentation;break;
   case 'focus':next.selection={scene_ref:change.scene_ref,entity_ref:change.entity_ref??null};break;
   default:throw new Error(`the test owner has no rule for ${change.change}`);
  }
 }
 if(changes.length)next.revision++;
 return next;
}
// A simulated owner: one Expression, its edits at expected_revision, every request recorded.
function owner(){
 const state={doc:kernelDocument(),edits:[]};
 const ports={
  mint:()=>'expression:unused',
  checkpoint:async()=>{},
  file:async()=>{throw new Error('No file owner in this test');},
  expression:async request=>{
   if(request.operation==='inspect')return {state:'ready',document:clone(state.doc)};
   if(request.operation==='edit'){
    state.edits.push(clone(request));
    if(request.expected_revision!==state.doc.revision)return {state:'revision_conflict',current_revision:state.doc.revision,expression_ref:E};
    state.doc=applyKernel(state.doc,request.changes);
    return {state:'ready',document:clone(state.doc)};
   }
   throw new Error(`unexpected owner operation ${request.operation}`);
  },
 };
 return {state,ports};
}
// Open the work the way the app does: the kernel holds the document the work opened from.
async function opened(){
 const kernel=owner(),work=new NativeWorking(kernel.ports);
 const view=await work.adopt(kernelDocument());
 const store=new DocumentStore(view.journey);
 store.markKernelSaved();
 return {kernel,work,store};
}
const snapshot=store=>({journey:clone(store.document),sceneId:store.document.scenes[0].id,entityId:null});

test('acceptance: undo past a recorded Save submits one compensating edit back to the pre-save kernel document; redo replays it once', async()=>{
 const {kernel,work,store}=await opened();
 const before=clone(kernel.state.doc);
 store.change('Rename expression',d=>{d.name='Renamed';});
 store.change('Rename scene',d=>{d.scenes[0].name='Opening';});
 const anchor=store.kernelSaveAnchor();
 const saved=await work.commitRecorded(snapshot(store));
 const after=clone(kernel.state.doc);
 assert.equal(store.attachKernelCheckpoint(anchor,saved.checkpoint),true);
 assert.equal(kernel.state.edits.length,1,'the Save is one kernel edit');
 assert.notEqual(digest(after),digest(before));

 // Undo past the checkpoint: the Save's whole inverse, as one edit at the acknowledged revision.
 const undo=store.undoPlan();
 assert.equal(undo.label,'Rename scene');
 assert.ok(undo.kernel&&'changes' in undo.kernel&&undo.kernel.changes.length>0);
 await work.replayKernelEdit(undo.kernel.changes,store.checkpointAt('undo').before);
 assert.equal(store.undoAccepted(),true);
 assert.equal(kernel.state.edits.length,2,'exactly one compensating edit');
 assert.equal(kernel.state.edits[1].expected_revision,after.revision,'it is submitted at the saved revision');
 assert.equal(digest(kernel.state.doc),digest(before),'the result digest equals the pre-save kernel document');

 // The steps the Save covers undo locally: the owner is not asked again.
 assert.deepEqual(store.undoPlan(),{label:'Rename expression',kernel:null});
 assert.equal(store.undo(),true);
 assert.equal(store.document.name,'Inquiry');
 assert.equal(store.document.scenes[0].name,'Main');
 assert.equal(kernel.state.edits.length,2);

 // Redo: the covered steps return locally, then the Save's forward edit is replayed once.
 assert.deepEqual(store.redoPlan(),{label:'Rename expression',kernel:{changes:[]}});
 assert.equal(store.redo({compensated:true}),true);
 const redo=store.redoPlan();
 assert.equal(redo.label,'Rename scene');
 assert.ok(redo.kernel&&'changes' in redo.kernel&&redo.kernel.changes.length>0);
 await work.replayKernelEdit(redo.kernel.changes,store.checkpointAt('redo').after);
 assert.equal(store.redo({compensated:true}),true);
 assert.equal(kernel.state.edits.length,3,'redo is one forward edit');
 assert.equal(digest(kernel.state.doc),digest(after),'redo re-applies the Save');
 assert.equal(store.document.name,'Renamed');
 assert.equal(store.document.scenes[0].name,'Opening');
});

test('a revision the owner has moved past is refused by name, and nothing is written', async()=>{
 const {kernel,work,store}=await opened();
 store.change('Rename expression',d=>{d.name='Renamed';});
 const anchor=store.kernelSaveAnchor();
 const saved=await work.commitRecorded(snapshot(store));
 assert.equal(store.attachKernelCheckpoint(anchor,saved.checkpoint),true);

 // Another writer changes the Expression after this work's acknowledged revision.
 kernel.state.doc={...clone(kernel.state.doc),title:'Written elsewhere',revision:kernel.state.doc.revision+1};
 const owned=clone(kernel.state.doc),localBefore=clone(store.document),depth=store.undoStack.length;
 const undo=store.undoPlan();
 await assert.rejects(()=>work.replayKernelEdit(undo.kernel.changes,store.checkpointAt('undo').before),/revision_conflict/);

 assert.equal(digest(kernel.state.doc),digest(owned),'the owner keeps its own write');
 assert.equal(kernel.state.doc.revision,owned.revision,'the owner did not advance');
 assert.equal(store.undoStack.length,depth,'the local history is untouched');
 assert.deepEqual(store.document,localBefore,'the local document is untouched');
 assert.equal(work.state.pending,undefined,'the refused intent is cleared, not replayed');
});

test('a Save with nothing to submit records nothing, and undoing past it submits nothing', async()=>{
 const {kernel,work,store}=await opened();
 store.change('Rename expression',d=>{d.name='Renamed';});
 let anchor=store.kernelSaveAnchor();
 assert.equal(store.attachKernelCheckpoint(anchor,(await work.commitRecorded(snapshot(store))).checkpoint),true);
 store.change('Look only',()=>{});
 anchor=store.kernelSaveAnchor();
 const unchanged=await work.commitRecorded(snapshot(store));
 assert.deepEqual(unchanged.checkpoint.changes,[]);
 assert.equal(store.attachKernelCheckpoint(anchor,unchanged.checkpoint),true);
 const editsBefore=kernel.state.edits.length;
 // Review fix: the no-op Save records nothing, so the step above the kernel head undoes locally...
 assert.deepEqual(store.undoPlan(),{label:'Look only',kernel:null});
 assert.equal(store.undo(),true);
 assert.equal(kernel.state.edits.length,editsBefore,'no owner request');
 // ...and the earlier Save's real compensation is still there.
 const earlier=store.undoPlan();
 assert.ok(earlier.kernel&&'changes' in earlier.kernel&&earlier.kernel.changes.length>0);
});

test('a Save whose step was undone while the owner answered records nothing, and its redo is local', async()=>{
 const {work,store}=await opened();
 store.change('Rename expression',d=>{d.name='Renamed';});
 const anchor=store.kernelSaveAnchor();
 const saved=await work.commitRecorded(snapshot(store));
 store.undo();
 assert.equal(store.attachKernelCheckpoint(anchor,saved.checkpoint),false);
 assert.equal(store.undoStack.length,0);
 // Review fix: the store never recorded a kernel edit for this step, so its redo is local (it lands the document on what
 // the owner already holds); it is not refused and does not block the redo stack.
 assert.equal(store.redoPlan().kernel,null);
});

test('committing through commitRecorded submits exactly what commit submits', async()=>{
 const plain=owner(),recorded=owner();
 const first=new NativeWorking(plain.ports),second=new NativeWorking(recorded.ports);
 const viewA=await first.adopt(kernelDocument()),viewB=await second.adopt(kernelDocument());
 const edit=journey=>{journey.name='Renamed';journey.scenes[0].name='Opening';return journey;};
 const docA=await first.commit({journey:edit(clone(viewA.journey)),sceneId:viewA.journey.scenes[0].id,entityId:null});
 const saved=await second.commitRecorded({journey:edit(clone(viewB.journey)),sceneId:viewB.journey.scenes[0].id,entityId:null});
 assert.deepEqual(recorded.state.edits,plain.state.edits);
 assert.equal(digest(saved.document),digest(docA));
 assert.equal(digest(saved.checkpoint.after),digest(docA));
 assert.equal(digest(saved.checkpoint.before),digest(kernelDocument()));
});

// Review fixes (13 Oct 2026). A redo of a step the kernel never held is local; a Save that changed nothing records nothing.
{
 const {blankJourney}=await import('../build/model.js');
 const kdoc=(title,revision)=>({schema:'oi.expression/v1',expression_ref:'e',revision,title,scenes:[{scene_ref:'s',title:'S',entity_refs:[]}],entities:{},relations:{},provenance:[],refinements:[]});
 test('redo of an unsaved edit on a native expression is local, not refused',()=>{
  const s=new DocumentStore(blankJourney());s.acknowledge(s.document);
  s.change('Rename',d=>{d.title='X';});
  assert.equal(s.undoPlan().kernel,null);assert.ok(s.undo());
  assert.equal(s.redoPlan().kernel,null,'the kernel never held this step');
  assert.ok(s.redo());assert.equal(s.document.title,'X');
  assert.equal(s.undoPlan().kernel,null,'still unsaved after the redo');
 });
 test('a Save that changed nothing keeps the earlier Save\'s compensation',()=>{
  const s=new DocumentStore(blankJourney());s.acknowledge(s.document);
  s.change('Rename',d=>{d.title='t1';});
  assert.ok(s.attachKernelCheckpoint(s.kernelSaveAnchor(),{changes:[{change:'rename',title:'t1'}],before:kdoc('t0',1),after:kdoc('t1',2)}));
  const plan=JSON.stringify(s.undoPlan());assert.notEqual(JSON.parse(plan).kernel.changes.length,0);
  assert.ok(s.attachKernelCheckpoint(s.kernelSaveAnchor(),{changes:[],before:kdoc('t1',2),after:kdoc('t1',2)}));
  assert.equal(JSON.stringify(s.undoPlan()),plan,'the no-op Save did not overwrite the real compensation');
  const empty=new DocumentStore(blankJourney());empty.acknowledge(empty.document);
  assert.equal(empty.attachKernelCheckpoint(empty.kernelSaveAnchor(),{changes:[],before:kdoc('t1',2),after:kdoc('t1',2)}),true,'a no-op Save on an empty history is not a failure');
 });
}
