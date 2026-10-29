import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {invertEdit} from '../build/kernelExpressions.js';
import {DocumentStore} from '../build/store.js';
import {NativeWorking} from '../build/nativeWorking.js';
import {connectActLabel,KERNEL_UPDATE_LABEL,OUTSIDE_UPDATE_REASON} from '../build/undoLabels.js';

// E15/E16: a native act is ONE labelled undo step. The owner edit, its adoption and any connector sides
// it saves together are recorded as that step, carrying the kernel edit that reached the owner, so
// Undo compensates the owner and Redo replays it. An adoption from outside this editor is its own
// labelled step, and Undo refuses it by name. app.ts is a DOM entry that cannot load under node, so the
// store and the owner are driven here, and the app's wiring is read from its source (typescript AST).

const E='expression:native-act-undo';
const S=n=>`${E}:scene:${n}`;
const A=S('a'),B=S('b');
const X=`${E}:entity:x`,Y=`${E}:entity:y`,Z=`${E}:entity:z`;
const clone=value=>JSON.parse(JSON.stringify(value));
const sortKeys=value=>Array.isArray(value)?value.map(sortKeys):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sortKeys(value[key])])):value;
// The kernel's revision counters are not content; the rest is compared exactly.
function digest(document){
 const content=clone(document);delete content.revision;
 for(const scene of content.scenes??[])delete scene.revision;
 for(const entity of Object.values(content.entities??{}))delete entity.revision;
 return JSON.stringify(sortKeys(content));
}
function base(){
 return {schema:'oi.expression/v1',expression_ref:E,revision:1,title:'Native act undo',
  scenes:[{scene_ref:A,revision:1,title:'Alpha',entity_refs:[X,Y]},{scene_ref:B,revision:1,title:'Beta',entity_refs:[Z]}],
  entities:{
   [X]:{entity_ref:X,title:'X',revision:1,subject:null,parameters:{glyph:{value:'O',automation:null}}},
   [Y]:{entity_ref:Y,title:'Y',revision:1,subject:null,parameters:{glyph:{value:'Q',automation:null}}},
   [Z]:{entity_ref:Z,title:'Z',revision:1,subject:null,parameters:{glyph:{value:'Z',automation:null}}},
  },
  relations:{},selection:{scene_ref:A,entity_ref:null},provenance:[],representations:[],refinements:[]};
}
// The kernel's edit rules for the kinds these acts emit. Anything else is a test failure, not a silent skip.
function applyChanges(doc,changes){
 const d=clone(doc);
 for(const c of changes){
  switch(c.change){
   case 'rename':d.title=c.title;break;
   case 'scene_rename':d.scenes.find(s=>s.scene_ref===c.scene_ref).title=c.title;break;
   case 'scene_material_set':d.scenes.find(s=>s.scene_ref===c.scene_ref).presentation=clone(c.presentation);break;
   case 'scene_material_clear':delete d.scenes.find(s=>s.scene_ref===c.scene_ref).presentation;break;
   case 'relation_bind':d.relations[c.binding.binding_ref]=clone(c.binding);break;
   case 'relation_remove':delete d.relations[c.binding_ref];break;
   case 'focus':d.selection={scene_ref:c.scene_ref,entity_ref:c.entity_ref??null};break;
   default:throw new Error(`the test owner has no rule for ${c.change}`);
  }
 }
 return d;
}
// A simulated owner: one Expression, edits at the expected revision, and a switch that refuses an edit.
function owner(){
 const state={doc:base(),refuse:false};
 const ports={
  mint:()=>'expression:unused',
  checkpoint:async()=>{},
  file:async()=>{throw new Error('No file owner in this test');},
  expression:async request=>{
   if(request.operation==='inspect')return {state:'ready',document:clone(state.doc)};
   if(request.operation==='edit'){
    if(state.refuse)throw new Error('owner refused the edit');
    if(request.expected_revision!==state.doc.revision)return {state:'revision_conflict',current_revision:state.doc.revision,expression_ref:E};
    state.doc=applyChanges(state.doc,request.changes);state.doc.revision++;
    return {state:'ready',document:clone(state.doc)};
   }
   throw new Error(`unexpected owner operation ${request.operation}`);
  },
 };
 return {state,ports};
}
async function opened(){
 const kernel=owner(),work=new NativeWorking(kernel.ports);
 const view=await work.adopt(clone(kernel.state.doc));
 const store=new DocumentStore(view.journey);
 store.markKernelSaved();
 return {kernel,work,store};
}
const connection=(ref,from,to)=>({change:'relation_bind',binding:{binding_ref:ref,native_owner:'oi',relation:{ref:`${ref}:connects`,revision:'1',availability:'available'},from_entity_ref:from,to_entity_ref:to,provenance:[]}});
const CONNECT=`${E}:relation:connection-1`,CONNECT2=`${E}:relation:connection-2`;
// The documents one Undo or Redo of a recorded step moves between: from the one the step left (or found), to the other.
const replay=(store,direction)=>{const {before,after}=store.checkpointAt(direction);return direction==='undo'?{from:after,to:before}:{from:before,to:after};};

// The app's native act, in the order nativeAct runs it: the owner edit is acknowledged first, the sides
// composition (when given) is saved with it, and ONE step is recorded. An owner refusal throws before
// anything is recorded.
async function act(store,work,label,changes,sides){
 const before=clone(work.state.view.document);
 const view=await work.editConnections(changes);
 const acknowledged=[...changes];
 let after=view.document,incoming=view.journey;
 if(sides){
  const saved=await work.commitRecorded({sceneId:store.document.scenes[0].id,entityId:null,journey:sides(clone(view.journey))});
  acknowledged.push(...saved.checkpoint.changes);after=saved.document;incoming=work.state.view.journey;
 }
 store.recordNativeAct(label,incoming,{changes:acknowledged,before,after:clone(after)});
}

test('a connect is one entry under its own label, and its adoption folds into that entry', async()=>{
 const {kernel,work,store}=await opened();
 const baseline=JSON.stringify(store.document);
 await act(store,work,connectActLabel(1),[connection(CONNECT,X,Y)]);
 assert.equal(store.undoStack.length,1,'one step for the act: no separate adoption entry');
 assert.equal(store.undoLabel(),'Connect');
 assert.equal(store.undoStack[0].label,'Connect');
 assert.deepEqual(store.undoStack[0].changes,[connection(CONNECT,X,Y)],'the entry carries the kernel edit that reached the owner');
 assert.ok(store.undoStack[0].inverse&&'changes' in store.undoStack[0].inverse,'the step has a compensation');
 assert.equal(kernel.state.doc.relations[CONNECT].from_entity_ref,X,'the owner holds the connection');
 assert.notEqual(JSON.stringify(store.document),baseline,'the document shows the connection');
 const plan=store.undoPlan();
 assert.equal(plan.label,'Connect');
 assert.ok(plan.kernel&&'changes' in plan.kernel,'undo has a kernel compensation');
 assert.ok(plan.kernel.changes.some(c=>c.change==='relation_remove'&&c.binding_ref===CONNECT),'the compensation removes the connection');
});

test('undo of a folded connect restores the document and the owner; redo re-applies both', async()=>{
 const {kernel,work,store}=await opened();
 const baseline=JSON.stringify(store.document),kernelBefore=digest(kernel.state.doc);
 await act(store,work,'Connect',[connection(CONNECT,X,Y)]);
 const kernelAfter=digest(kernel.state.doc);
 assert.notEqual(kernelAfter,kernelBefore);

 const undo=store.undoPlan();
 await work.replayKernelEdit(undo.kernel.changes,replay(store,'undo'));
 assert.equal(store.undoAccepted(),true);
 assert.equal(digest(kernel.state.doc),kernelBefore,'the owner returns to the pre-act document');
 assert.equal(JSON.stringify(store.document),baseline,'the app document returns to the pre-act document');
 assert.equal(store.undoStack.length,0);

 const redo=store.redoPlan();
 assert.equal(redo.label,'Connect');
 await work.replayKernelEdit(redo.kernel.changes,replay(store,'redo'));
 assert.equal(store.redo({compensated:true}),true);
 assert.equal(digest(kernel.state.doc),kernelAfter,'redo re-applies the connection once');
});

test('E15g: a selection after the act is no move of its document: undo reverses the act and the selection stays where it was put', async()=>{
 // Selecting writes the owner's focus at a new revision; it is where the person stands, not a change Undo covers (manual §10, Undo
 // and Redo). Before #763 the compensation landed and then its readback was refused, because it expected the act's old focus.
 const {kernel,work,store}=await opened();
 await act(store,work,'Connect',[connection(CONNECT,X,Y)]);
 await work.select({scene_ref:A,entity_ref:Y});
 assert.deepEqual(kernel.state.doc.selection,{scene_ref:A,entity_ref:Y});
 const undo=store.undoPlan();
 await work.replayKernelEdit(undo.kernel.changes,replay(store,'undo'));
 assert.equal(store.undoAccepted(),true);
 assert.deepEqual(kernel.state.doc.relations,{},'the owner no longer holds the connection');
 assert.deepEqual(kernel.state.doc.selection,{scene_ref:A,entity_ref:Y},'the selection is the person\'s, untouched');
 assert.deepEqual(work.state.view.document.selection,{scene_ref:A,entity_ref:Y});
});

test('connectMany plus its sides is one entry, and one undo reverses the relations and the sides together', async()=>{
 const {kernel,work,store}=await opened();
 const kernelBefore=digest(kernel.state.doc);
 const sides=journey=>{journey.scenes[0].title='Alpha with lines';return journey;};
 await act(store,work,connectActLabel(2),[connection(CONNECT,X,Y),connection(CONNECT2,Y,X)],sides);
 assert.equal(store.undoStack.length,1,'the relations and the sides are one step');
 assert.equal(store.undoLabel(),'Connect cards');
 assert.ok(store.undoStack[0].changes.some(c=>c.change==='relation_bind'&&c.binding.binding_ref===CONNECT2),'the step carries both relations');
 assert.ok(store.undoStack[0].changes.some(c=>c.change==='scene_material_set'),'the step carries the sides saved with them');
 assert.equal(kernel.state.doc.scenes[0].presentation.scene.title,'Alpha with lines','the owner saved the sides');

 const undo=store.undoPlan();
 await work.replayKernelEdit(undo.kernel.changes,replay(store,'undo'));
 assert.equal(store.undoAccepted(),true);
 assert.equal(digest(kernel.state.doc),kernelBefore,'one compensating edit returns the owner to its pre-act document');
 assert.equal(store.undoStack.length,0);
});

test('a mid-act failure before the owner acknowledges leaves no entry and no change (E16)', async()=>{
 const {kernel,work,store}=await opened();
 const baseline=JSON.stringify(store.document),kernelBefore=digest(kernel.state.doc);
 kernel.state.refuse=true;
 await assert.rejects(()=>act(store,work,'Connect',[connection(CONNECT,X,Y)]),/owner refused the edit/);
 assert.equal(store.undoStack.length,0,'no entry for a refused act');
 assert.equal(store.redoStack.length,0);
 assert.equal(JSON.stringify(store.document),baseline,'the document is byte-equal to before the act');
 assert.equal(digest(kernel.state.doc),kernelBefore,'the owner is unchanged');
});

test('an adoption from outside this editor is its own labelled step, and Undo refuses it by name', async()=>{
 const {kernel,work,store}=await opened();
 const external=clone(kernel.state.doc);external.title='Changed in another window';external.revision++;kernel.state.doc=external;
 const adopted=await work.adopt(clone(kernel.state.doc));
 store.recordOutsideUpdate(KERNEL_UPDATE_LABEL,adopted.journey,OUTSIDE_UPDATE_REASON);
 assert.equal(store.undoStack.length,1);
 assert.equal(store.undoLabel(),'Update from the kernel');
 const before=JSON.stringify(store.document);
 const plan=store.undoPlan();
 assert.deepEqual(plan.kernel,{refused:'outside-update',reason:OUTSIDE_UPDATE_REASON},'undo names the refusal');
 assert.equal(JSON.stringify(store.document),before,'planning an undo changes nothing');
});

test('undo refuses by name where the owner edit has no inverse, and changes nothing', async()=>{
 const {kernel,work,store}=await opened();
 const before=clone(kernel.state.doc);
 const after=clone(before);after.title='Renamed';after.revision++;
 after.relations.src={binding_ref:'src',native_owner:'ai-kit',relation:{ref:'src:connects',revision:'1',availability:'available'},from_entity_ref:X,to_entity_ref:Y,provenance:[]};
 const next=clone(store.document);next.name='Renamed';
 store.recordNativeAct('Rename expression',next,{changes:[{change:'rename',title:'Renamed'}],before,after});
 const plan=store.undoPlan();
 assert.equal(plan.label,'Rename expression');
 assert.ok(plan.kernel&&'refused' in plan.kernel,'the compensation is refused, not guessed');
 assert.equal(plan.kernel.refused,'source_relation');
 assert.ok(/source owner/.test(plan.kernel.reason),'the reason names the source-owned relation');
 assert.deepEqual(invertEdit(before,after),{refused:'source_relation',reason:plan.kernel.reason});
});

// The app's wiring, read from source: no act is recorded under the anonymous adoption label, every native
// edit names its act, and the host routes its acts and its reconcile through the one history.
const ts=createRequire(import.meta.url)('../../node_modules/typescript');
const appSource=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const workspaceSource=fs.readFileSync(new URL('../src/nativeWorkspace.ts',import.meta.url),'utf8');
const walk=(node,visit)=>{visit(node);ts.forEachChild(node,child=>walk(child,visit));};

test('no native act is recorded under the anonymous adoption label', ()=>{
 assert.doesNotMatch(appSource,/Adopt native expression/,'app.ts names no adoption "Adopt native expression"');
 assert.doesNotMatch(workspaceSource,/Adopt native expression/,'nativeWorkspace.ts names no adoption "Adopt native expression"');
});

test('every native edit names its act', ()=>{
 const sf=ts.createSourceFile('app.ts',appSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
 const edits=[];
 walk(sf,node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='edit'&&/nativeWorkspace/.test(node.expression.expression.getText(sf)))edits.push(node);});
 assert.ok(edits.length>=15,`the app's native edits are found (${edits.length})`);
 for(const call of edits)assert.ok(call.arguments.length>=2,`${call.getText(sf).slice(0,70)} passes its act label`);
});

test('the host records its acts as one step each and reconciles as an outside update', ()=>{
 assert.match(workspaceSource,/host\.load\(finalView,true,'act',/,'an owner act adopts as one act');
 assert.match(workspaceSource,/host\.load\(work\.state\.view,true,'outside'\)/,'a reconcile adopts as an outside update');
 assert.match(appSource,/store\.recordNativeAct\(act\.label,incoming,act\.record\)/,'applyNativeView records the act as one step');
 assert.match(appSource,/store\.recordOutsideUpdate\(KERNEL_UPDATE_LABEL,incoming,OUTSIDE_UPDATE_REASON\)/,'applyNativeView names the outside update');
});

test('the research connect family names each act in the app voice', ()=>{
 for(const label of [`connectActLabel(1)`,`'Reconnect'`,`'Reverse connection'`,`'Delete connection'`,`'Set connection type'`])
  assert.ok(appSource.includes(label),`${label} labels its act`);
 assert.equal(connectActLabel(1),'Connect');
 assert.equal(connectActLabel(3),'Connect cards');
});
