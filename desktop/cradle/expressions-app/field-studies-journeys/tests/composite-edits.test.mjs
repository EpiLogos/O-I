import test from 'node:test';
import assert from 'node:assert/strict';
import {documentToChanges,invertEdit,saveKernelExpression,installKernelExpressions,kernelExpressionsAvailable,KERNEL_EDIT_BUDGET} from '../build/kernelExpressions.js';
import {DocumentStore,withComposite} from '../build/store.js';
import {NativeWorking} from '../build/nativeWorking.js';

// E16: atomic composite edits. A multi-step gesture is one labelled undo step,
// and its whole change list reaches the kernel as ONE edit. A failure anywhere
// inside restores the document byte-equal and records no entry and no edit.
// The host frame is simulated below: it is the real save path (installKernelExpressions
// + saveKernelExpression) talking to a fake parent that applies edits to a
// small kernel model. The kernel model enforces expected_revision.

const parent={postMessage:message=>kernelSide(message)};
const listeners=[];
globalThis.window={parent,addEventListener:(type,fn)=>{if(type==='message')listeners.push(fn);},
 setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
const deliver=message=>{for(const fn of listeners.slice())fn({source:parent,data:message});};

const kernel={doc:null,submitted:[]};
function kernelSide(message){
 if(message.kind==='oi-kernel-hello'){setTimeout(()=>deliver({v:1,kind:'oi-kernel-channel'}),0);return;}
 if(message.kind!=='kernel-expression'||message.request?.operation!=='edit')throw new Error(`unexpected host message ${message.kind}`);
 const request=message.request,req=message.req;
 kernel.submitted.push(request);
 setTimeout(()=>{
  if(request.expected_revision!==kernel.doc.revision){
   deliver({v:1,kind:'kernel-expression-result',req,ok:true,data:{state:'revision_conflict',current_revision:kernel.doc.revision}});return;
  }
  kernel.doc=applyChanges(kernel.doc,request.changes);kernel.doc.revision+=1;
  deliver({v:1,kind:'kernel-expression-result',req,ok:true,data:{state:'ready',document:{revision:kernel.doc.revision}}});
 },0);
}

installKernelExpressions();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(kernelExpressionsAvailable(),true,'the simulated host announces the kernel channel');

const E='expression:composite-edits';
const S=n=>`${E}:scene:${n}`;
const A=S('a'),B=S('b'),D=S('d');
const X=`${E}:entity:x`,Y=`${E}:entity:y`;
const clone=value=>JSON.parse(JSON.stringify(value));

function head(){
 return {schema:'oi.expression/v1',expression_ref:E,revision:3,title:'Composite',
  scenes:[
   {scene_ref:A,revision:1,title:'Alpha',entity_refs:[X,Y]},
   {scene_ref:B,revision:1,title:'Beta',entity_refs:[]},
  ],
  entities:{
   [X]:{entity_ref:X,title:'X',revision:1,subject:null,parameters:{glyph:{value:'O',automation:null},x:{value:10,automation:null}}},
   [Y]:{entity_ref:Y,title:'Y',revision:1,subject:null,parameters:{glyph:{value:'Q',automation:null}}},
  },
  relations:{},collections:['alpha'],selection:{scene_ref:A,entity_ref:null},provenance:[],representations:[],refinements:[]};
}

// A split of Alpha: Y moves into a new Scene D, and X's x parameter changes.
// `failAt` throws after that many steps, to inject a failure mid-composite.
function split(doc,failAt=-1){
 let step=0;const gate=()=>{if(step===failAt)throw new Error(`injected failure at step ${step}`);step+=1;};
 gate();doc.scenes.find(s=>s.scene_ref===A).entity_refs=[X];   // scene_compose A
 gate();doc.scenes.push({scene_ref:D,revision:1,title:'Alpha split',entity_refs:[Y]}); // scene_create D + scene_compose D
 gate();doc.entities[X].parameters.x.value=20;                  // parameter_set
 gate();
}

// The kernel's change grammar, for the kinds the fixtures emit.
function applyChanges(doc,changes){
 const d=clone(doc);
 const scene=ref=>{const s=d.scenes.find(x=>x.scene_ref===ref);if(!s)throw new Error(`no scene ${ref}`);return s;};
 const entity=ref=>{const e=d.entities[ref];if(!e)throw new Error(`no entity ${ref}`);return e;};
 for(const c of changes){
  switch(c.change){
   case 'rename':d.title=c.title;break;
   case 'scene_create':d.scenes.push({scene_ref:c.scene_ref,revision:1,title:c.title,entity_refs:[]});break;
   case 'scene_remove':d.scenes=d.scenes.filter(s=>s.scene_ref!==c.scene_ref);break;
   case 'scene_rename':scene(c.scene_ref).title=c.title;break;
   case 'scene_reorder':d.scenes=c.scene_refs.map(ref=>scene(ref));break;
   case 'scene_compose':for(const ref of c.entity_refs)entity(ref);scene(c.scene_ref).entity_refs=[...c.entity_refs];break;
   case 'entity_add':scene(c.scene_ref);d.entities[c.entity_ref]={entity_ref:c.entity_ref,title:c.title,revision:1,subject:null,parameters:{glyph:{value:'O',automation:null}}};break;
   case 'entity_remove':delete d.entities[c.entity_ref];break;
   case 'parameter_set':{const e=entity(c.entity_ref);(e.parameters[c.parameter]??={value:c.value,automation:null}).value=c.value;break;}
   case 'collections_set':d.collections=[...c.collections];break;
   case 'focus':d.selection={scene_ref:c.scene_ref,entity_ref:c.entity_ref};break;
   case 'scene_material_set':scene(c.scene_ref).presentation=clone(c.presentation);break;
   case 'scene_material_clear':delete scene(c.scene_ref).presentation;break;
   case 'composition_set':d.presentation=clone(c.presentation);break;
   default:throw new Error(`the test applier has no rule for ${c.change}`);
  }
 }
 return d;
}
// The kernel's revision counter and the store's updatedAt are not content.
function digest(doc){
 const d=clone(doc);delete d.revision;delete d.updatedAt;for(const s of d.scenes)delete s.revision;for(const e of Object.values(d.entities))delete e.revision;
 return JSON.stringify(d,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
}
function reset(){kernel.doc=clone(head());kernel.submitted=[];}

test('happy path: a composite is one undo entry, its whole change list is one kernel edit, and the revision advances once',async()=>{
 reset();
 const store=new DocumentStore(head());
 const result=withComposite(store,'Split scene',doc=>{split(doc);return 'split';});
 assert.equal(result,'split');
 assert.equal(store.undoStack.length,1);
 assert.equal(store.undoLabel(),'Split scene');
 const forward=documentToChanges(kernel.doc,store.document);
 assert.ok('changes' in forward,forward.error);
 assert.equal(store.attachKernelEdit(forward.changes,invertEdit(kernel.doc,applyChanges(kernel.doc,forward.changes))),true);
 const saved=await saveKernelExpression(store.document,{changes:forward.changes,expectedRevision:kernel.doc.revision});
 assert.equal(saved.ok,true,saved.error);
 assert.equal(kernel.submitted.length,1,'exactly one edit reached the kernel');
 assert.equal(saved.revision,head().revision+1,'the kernel revision advanced by one');
 assert.equal(digest(kernel.doc),digest(store.document),'the kernel holds the composite whole');
});

test('acceptance: a failure injected at every step leaves the document byte-equal, no undo entry, and no kernel edit',async()=>{
 for(const failAt of [0,1,2,3]){
  reset();
  const store=new DocumentStore(head());
  const before=JSON.stringify(store.document);
  assert.throws(()=>withComposite(store,'Split scene',doc=>split(doc,failAt)),new RegExp(`injected failure at step ${failAt}`));
  assert.equal(JSON.stringify(store.document),before,`step ${failAt}: the document is byte-equal to its baseline`);
  assert.equal(digest(store.document),digest(head()),`step ${failAt}: the content digest is unchanged`);
  assert.equal(store.undoStack.length,0,`step ${failAt}: no undo entry`);
  assert.equal(store.redoStack.length,0,`step ${failAt}: no redo entry`);
  assert.equal(store.transactionOpen,false,`step ${failAt}: no gesture is left open`);
  assert.equal(kernel.submitted.length,0,`step ${failAt}: no edit was submitted`);
  assert.equal(kernel.doc.revision,head().revision,'the kernel revision is unchanged');
  // The store is usable afterwards: the next gesture is one entry.
  withComposite(store,'Retitle',doc=>{doc.title='After';});
  assert.equal(store.undoLabel(),'Retitle');
  assert.equal(store.undoStack.length,1);
 }
});

test('a nested store.change joins the composite: one entry carries every step',()=>{
 reset();
 const store=new DocumentStore(head());
 withComposite(store,'Split scene',doc=>{store.change('Inner rename',d=>{d.title='Renamed';});split(doc);});
 assert.equal(store.undoStack.length,1);
 assert.equal(store.undoLabel(),'Split scene');
 assert.equal(store.document.title,'Renamed');
 assert.equal(store.document.scenes.length,3);
});

test('a nested change that throws restores only its own step; the composite continues and records the rest',()=>{
 reset();
 const store=new DocumentStore(head());
 withComposite(store,'Split scene',doc=>{
  assert.throws(()=>store.change('Bad step',d=>{d.title='Half';d.collections=['bad'];throw new Error('bad step');}),/bad step/);
  split(doc);
 });
 assert.equal(store.undoStack.length,1);
 assert.equal(store.document.title,'Composite','the failed nested step left no trace');
 assert.deepEqual(store.document.collections,['alpha']);
 assert.equal(store.document.scenes.length,3);
});

test('a composite refuses to nest, to start inside an open gesture, to finish mid-edit, and to be async; each refusal restores',async()=>{
 reset();
 const store=new DocumentStore(head());
 withComposite(store,'Outer',doc=>{
  assert.throws(()=>withComposite(store,'Inner',d=>{d.title='Inner';}),/cannot nest/);
  doc.title='Outer title';
 });
 assert.equal(store.undoStack.length,1);
 assert.equal(store.undoLabel(),'Outer');
 assert.equal(store.document.title,'Outer title');

 store.begin('Drag');
 assert.throws(()=>withComposite(store,'Split scene',()=>{}),/open gesture/);
 store.finish();

 const before=JSON.stringify(store.document),entries=store.undoStack.length;
 assert.throws(()=>withComposite(store,'Split scene',doc=>{split(doc);store.finish();}),/closes once/);
 assert.equal(JSON.stringify(store.document),before,'finish() mid-edit restores the baseline');
 assert.equal(store.undoStack.length,entries);
 assert.equal(store.transactionOpen,false);

 assert.throws(()=>withComposite(store,'Async split',async doc=>{doc.title='Half';await null;}),/synchronous/);
 assert.equal(JSON.stringify(store.document),before,'an async edit is restored, not left half-applied');
 assert.equal(store.undoStack.length,entries);
});

test('an edit with no effect records no entry; an edit that changes the document without touch() is still one entry',()=>{
 reset();
 const store=new DocumentStore(head());
 withComposite(store,'Nothing',()=>{});
 assert.equal(store.undoStack.length,0);
 withComposite(store,'Silent',doc=>{doc.title='Silent';});
 assert.equal(store.undoLabel(),'Silent');
 assert.equal(store.undoStack.length,1);
});

test('a failed composite leaves no step to attach a kernel edit to',()=>{
 reset();
 const store=new DocumentStore(head());
 withComposite(store,'Kept',doc=>{doc.title='Kept';});
 assert.throws(()=>withComposite(store,'Broken',doc=>{doc.title='Broken';throw new Error('x');}),/x/);
 assert.equal(store.attachKernelEdit([{change:'rename',title:'Z'}],{changes:[]}),false);
 assert.equal(store.undoStack.at(-1).label,'Kept');
 assert.equal(store.undoStack.at(-1).changes,undefined);
});

// Retired with the gesture-id guard (O-I #763, E15h): 'a split of one gesture across two kernel edits is refused by name', 'a
// conflicted gesture is spent', 'a gesture id must be a nonempty string'. Replaced by the E15h test at the end of this file.

test('an edit over the one-edit budget is refused whole before any submission; exactly the budget is accepted',async()=>{
 reset();
 const focus={change:'focus',scene_ref:A,entity_ref:null};
 const over=await saveKernelExpression(head(),{changes:Array.from({length:KERNEL_EDIT_BUDGET+1},()=>focus),expectedRevision:3});
 assert.equal(over.ok,false);
 assert.match(over.error,/one-edit budget of 256/);
 assert.equal(kernel.submitted.length,0,'the over-budget list was never split or submitted');
 const exact=await saveKernelExpression(head(),{changes:Array.from({length:KERNEL_EDIT_BUDGET},()=>focus),expectedRevision:3});
 assert.equal(exact.ok,true,exact.error);
 assert.equal(kernel.submitted.length,1);
});

// E15h (O-I #763): the gesture-id guard was test-only. It refused a second explicit edit carrying the same gesture through
// saveKernelExpression, a path no product code sends a composite through: the product submits a composite inside a Save
// (NativeWorking.commitRecorded), whose one edit is the whole document's difference from the owner's basis, so one gesture
// cannot be split across edits and a refused Save is re-made whole on the next. This test is the replacement of the retired
// guard tests ('a split of one gesture across two kernel edits is refused by name', 'a conflicted gesture is spent', 'a gesture
// id must be a nonempty string'): the same law, on the path the product runs.
test('E15h: a composite reaches the owner whole inside one Save; a refused Save lands none of it, and the next Save carries all of it once',async()=>{
 const owner={doc:clone(head()),edits:[]};
 const work=new NativeWorking({mint:()=>'expression:unused',checkpoint:async()=>{},file:async()=>assert.fail('No file owner in this test'),
  expression:async request=>{
   if(request.operation==='inspect')return {state:'ready',document:clone(owner.doc)};
   if(request.operation!=='edit')assert.fail(`unexpected owner operation ${request.operation}`);
   owner.edits.push(clone(request));
   if(request.expected_revision!==owner.doc.revision)return {state:'revision_conflict',current_revision:owner.doc.revision,expression_ref:E};
   owner.doc=applyChanges(owner.doc,request.changes);owner.doc.revision+=1;
   return {state:'ready',document:clone(owner.doc)};
  }});
 const store=new DocumentStore((await work.adopt(clone(owner.doc))).journey);
 withComposite(store,'Retitle',doc=>{doc.name='Composite retitled';doc.scenes[0].name='Alpha retitled';});
 assert.equal(store.undoStack.length,1);
 const snapshot=()=>({journey:clone(store.document),sceneId:store.document.scenes[0].id,entityId:null});
 // Another writer moved the owner: the Save is refused and none of the composite lands.
 owner.doc={...clone(owner.doc),collections:['alpha','elsewhere'],revision:owner.doc.revision+1};
 await assert.rejects(work.commitRecorded(snapshot()),/revision_conflict/);
 assert.deepEqual([owner.doc.title,owner.doc.scenes[0].title],['Composite','Alpha']);
 // The next Save carries the whole composite once, on the owner's current basis.
 const saved=await work.commitRecorded(snapshot());
 assert.equal(owner.edits.length,2,'the refused Save and the one that landed');
 assert.deepEqual(owner.edits[1].changes.filter(c=>c.change==='rename'||c.change==='scene_rename').map(c=>[c.change,c.title]),
  [['rename','Composite retitled'],['scene_rename','Alpha retitled']],'both steps of the gesture ride the one edit');
 assert.deepEqual([owner.doc.title,owner.doc.scenes[0].title,owner.doc.collections],['Composite retitled','Alpha retitled',['alpha','elsewhere']]);
 assert.deepEqual(saved.checkpoint.changes,owner.edits[1].changes);
 // The guard and its gesture ids are gone from the store and the save path.
 assert.equal('committedGesture' in store,false);
 assert.equal('gesture' in store.undoStack[0],false);
});
