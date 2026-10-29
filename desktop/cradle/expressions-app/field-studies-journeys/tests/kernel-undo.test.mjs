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
 const state={doc:kernelDocument(),edits:[],checkpoints:[]};
 const ports={
  mint:()=>'expression:unused',
  checkpoint:async(_id,value)=>{state.checkpoints.push(clone(value));},
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
// The documents one Undo or Redo of a recorded Save moves between: from the one the Save left (or found), to the other.
const replay=(store,direction)=>{const {before,after}=store.checkpointAt(direction);return direction==='undo'?{from:after,to:before}:{from:before,to:after};};

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
 await work.replayKernelEdit(undo.kernel.changes,replay(store,'undo'));
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
 await work.replayKernelEdit(redo.kernel.changes,replay(store,'redo'));
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
 const edits=kernel.state.edits.length,checkpoints=kernel.state.checkpoints.length;
 const undo=store.undoPlan();
 // O-I #763 (E15g): the owner's document is read first, so the refusal comes before the compensation is persisted or sent.
 await assert.rejects(()=>work.replayKernelEdit(undo.kernel.changes,replay(store,'undo')),/document_moved: "Written elsewhere" is native revision 3, not the document this Save left/);
 assert.equal(kernel.state.edits.length,edits,'no compensation reached the owner');
 assert.equal(kernel.state.checkpoints.length,checkpoints,'no pending compensation was written');

 assert.equal(digest(kernel.state.doc),digest(owned),'the owner keeps its own write');
 assert.equal(kernel.state.doc.revision,owned.revision,'the owner did not advance');
 assert.equal(store.undoStack.length,depth,'the local history is untouched');
 assert.deepEqual(store.document,localBefore,'the local document is untouched');
 assert.equal(work.state.pending,undefined,'the refused intent is cleared, not replayed');
});

test('E15g: undo or redo past a Save whose document has moved at the revision this work holds is refused by name before anything is written', async()=>{
 const {kernel,work,store}=await opened();
 store.change('Rename expression',d=>{d.name='Renamed';});
 const anchor=store.kernelSaveAnchor();
 assert.equal(store.attachKernelCheckpoint(anchor,(await work.commitRecorded(snapshot(store))).checkpoint),true);
 // Another aperture renamed the Scene, and this clean work advanced onto that revision (advanceClean): its view and the owner
 // agree on the revision, but the document is no longer the one the Save left. Its compensation would rename the work back
 // over a Scene the Save never touched.
 kernel.state.doc={...clone(kernel.state.doc),scenes:[{...clone(kernel.state.doc.scenes[0]),title:'Renamed elsewhere'}],revision:kernel.state.doc.revision+1};
 assert.ok(await work.advanceClean(clone(store.document)));
 assert.equal(work.state.view.document.revision,kernel.state.doc.revision);
 const owned=clone(kernel.state.doc),edits=kernel.state.edits.length,checkpoints=kernel.state.checkpoints.length,depth=store.undoStack.length;
 const undo=store.undoPlan();
 await assert.rejects(()=>work.replayKernelEdit(undo.kernel.changes,replay(store,'undo')),/document_moved: "Renamed" is native revision 3, not the document this Save left; the recorded Save was not undone or redone and nothing was written/);
 assert.equal(kernel.state.edits.length,edits,'no compensation reached the owner');
 assert.equal(kernel.state.checkpoints.length,checkpoints,'no pending compensation was written');
 assert.deepEqual(kernel.state.doc,owned,'the owner keeps the moved document');
 assert.equal(work.state.pending,undefined);
 assert.equal(store.undoStack.length,depth,'the history is untouched');
 // Redo is held to the same rule: its forward edit stands only on the document the Save found.
 const {kernel:k2,work:w2,store:s2}=await opened();
 s2.change('Rename expression',d=>{d.name='Renamed';});
 const a2=s2.kernelSaveAnchor();
 assert.equal(s2.attachKernelCheckpoint(a2,(await w2.commitRecorded(snapshot(s2))).checkpoint),true);
 const back=s2.undoPlan();await w2.replayKernelEdit(back.kernel.changes,replay(s2,'undo'));assert.equal(s2.undoAccepted(),true);
 k2.state.doc={...clone(k2.state.doc),scenes:[{...clone(k2.state.doc.scenes[0]),title:'Renamed elsewhere'}],revision:k2.state.doc.revision+1};
 assert.ok(await w2.advanceClean(clone(s2.document)));
 const edits2=k2.state.edits.length,checkpoints2=k2.state.checkpoints.length;
 await assert.rejects(()=>w2.replayKernelEdit(s2.redoPlan().kernel.changes,replay(s2,'redo')),/document_moved/);
 assert.equal(k2.state.edits.length,edits2);
 assert.equal(k2.state.checkpoints.length,checkpoints2);
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

// O-I #763 (E15f): the DLW's own Undo and Redo (the Studio's head, the device editors) reach the frame through its editor
// receiver. Its history was the retained editor's own — store.undo() then a Save — so it never compensated a recorded Save
// on its owner, and the Save it made recorded on the step below. The retained editor app.ts creates now takes the frame's one
// step (historyStep) as its history. app.ts is a DOM entry that cannot load under node: the step and the history it hands the
// retained editor are read from its source (typescript AST) and run, through the real retained editor (hostEditor.ts), over
// the real store and NativeWorking, against the simulated owner above.
{
 const {createRequire}=await import('node:module');
 const fs=await import('node:fs');
 const {historyToast,historyWaitReason}=await import('../build/undoLabels.js');
 const {createRetainedNativeEditor}=await import('../build/hostEditor.js');
 const ts=createRequire(import.meta.url)('../../node_modules/typescript');
 const appFile=new URL('../src/app.ts',import.meta.url).pathname;
 const app=ts.createSourceFile(appFile,fs.readFileSync(appFile,'utf8'),ts.ScriptTarget.Latest,true);
 const emit=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 let installed=null;
 const walk=node=>{
  if(!installed&&ts.isCallExpression(node)&&node.expression.getText(app)==='createRetainedNativeEditor'){
   const history=node.arguments[0]?.properties?.find(p=>p.name?.getText(app)==='history');
   if(history)installed=history.initializer.getText(app);
  }
  ts.forEachChild(node,walk);
 };
 walk(app);
 const step=app.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='historyStep');
 /** The frame's step and the receiver's history over one app state: the store, the workspace's replay (its refusal is the
  * status line it names), and the app's own effects recorded. */
 function frameHistory({store,work}){
  const effects=[],state={text:null};
  const scope={store,historyToast,historyWaitReason,historyStepping:false,researchInstruments:undefined,commitResearch:async()=>{},
   markSaved:()=>effects.push('markSaved'),renderAll:()=>{},toast:(text)=>effects.push(`toast:${text}`),nativeState:state,
   nativeWorkspace:{replayCheckpoint:(changes,documents)=>work.replayKernelEdit(changes,documents).then(()=>true,cause=>{state.text=cause.message;effects.push(`toast:${cause.message}`);return false;})},
   commit:()=>assert.fail('Undo and Redo never Save')};
  const historyStep=new Function(...Object.keys(scope),`${emit(step.getText(app))}\nreturn historyStep;`)(...Object.values(scope));
  const retained=createRetainedNativeEditor({store,history:new Function('historyStep',`return ${emit(`(${installed})`)};`)(historyStep),
   commit:()=>assert.fail('Undo and Redo never Save'),afterHistory:()=>assert.fail('Undo and Redo are the frame\'s step')});
  return {history:operation=>retained.history(operation),effects};
 }
 test('E15f: the DLW\'s Undo through the editor receiver compensates the recorded Save on its owner, and its Redo replays it; neither Saves', async()=>{
  assert.ok(step,'app.ts has the one history step');
  assert.ok(installed,'the retained editor app.ts creates carries the frame\'s own history');
  const {kernel,work,store}=await opened();
  const before=clone(kernel.state.doc);
  store.change('Rename expression',d=>{d.name='Renamed';});
  const anchor=store.kernelSaveAnchor();
  assert.equal(store.attachKernelCheckpoint(anchor,(await work.commitRecorded(snapshot(store))).checkpoint),true);
  const after=clone(kernel.state.doc),edits=kernel.state.edits.length;
  const {history,effects}=frameHistory({store,work});
  await history('undo');
  assert.equal(kernel.state.edits.length,edits+1,'one compensating edit, and no Save');
  assert.equal(digest(kernel.state.doc),digest(before),'the owner holds the document before the Save');
  assert.equal(store.undoStack.length,0);
  assert.equal(store.document.name,'Inquiry');
  await history('redo');
  assert.equal(kernel.state.edits.length,edits+2,'one forward edit, and no Save');
  assert.equal(digest(kernel.state.doc),digest(after));
  assert.equal(store.document.name,'Renamed');
  assert.deepEqual(effects,['markSaved','toast:Undone: Rename expression. Simulation time has not been rewound.','markSaved','toast:Redone: Rename expression.']);
 });
 test('E15f: a refused step returns through the editor receiver by name, and nothing is changed', async()=>{
  const {kernel,work,store}=await opened();
  store.change('Rename expression',d=>{d.name='Renamed';});
  const anchor=store.kernelSaveAnchor();
  assert.equal(store.attachKernelCheckpoint(anchor,(await work.commitRecorded(snapshot(store))).checkpoint),true);
  kernel.state.doc={...clone(kernel.state.doc),title:'Written elsewhere',revision:kernel.state.doc.revision+1};
  const {history}=frameHistory({store,work}),edits=kernel.state.edits.length,depth=store.undoStack.length;
  await assert.rejects(history('undo'),/document_moved: "Written elsewhere" is native revision 3/);
  assert.equal(kernel.state.edits.length,edits);
  assert.equal(store.undoStack.length,depth);
  // While a .canvas import is open, the step waits and says why before the store is touched.
  store.openSpanningGesture('Import "a.canvas"');
  await assert.rejects(history('undo'),new RegExp(historyWaitReason('undo','Import "a.canvas"').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  store.abandonSpanningGesture();
  assert.equal(store.undoStack.length,depth);
 });
}
