import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DocumentStore} from '../build/store.js';
import {runCanvasImport,applyResearchMaterial,applyConnectorRecord} from '../build/researchMaterial.js';
import {canvasImportLabel,historyWaitReason} from '../build/undoLabels.js';
import {DraftSchedule} from '../build/draftSchedule.js';
import {parseObsidianCanvas,planObsidianImport} from '../build/obsidianCanvas.js';
import {installNativeWorkspace} from '../build/nativeWorkspace.js';

// lane-1 B2 / lane-3 E15-E16: one `.canvas` import is ONE labelled undo step. Its cards and frames (the material batch),
// its connections (native relations) and their connector sides are one owner act under one open gesture. One Undo
// removes the whole import; one Redo restores it. A connection whose end the owner does not hold is skipped and named
// while the rest lands; an owner refusal or a refused batch lands nothing.
//
// The store, the import orchestration, the obsidian planner and the native workspace's owner-write gate are the real
// modules. The native owner is a kernel-shaped fake: a flush saves the working cards, the relations bind as
// relation_bind changes, and the act records one step (the app's nativeAct order). The app's own wiring is read from
// source at the end, because app.ts is a DOM entry.

const E='expression:canvas-import';
const SCENE='scene-a';
const SCENE_REF=`${E}:scene:a`;
const clone=value=>JSON.parse(JSON.stringify(value));
const digest=value=>JSON.stringify(value);

function journeyWithScene(){
 return {schema:'oi.journey',version:1,id:'journey:canvas-import',name:'Canvas import',description:'',loop:false,
  updatedAt:'2026-10-14T00:00:00.000Z',scenes:[{id:SCENE,name:'Alpha',entities:[],duration:1,transition:0}]};
}
// A kernel-shaped owner document (as native-act-undo.test.mjs builds it), so invertEdit can diff it.
function kernelDoc(){
 return {schema:'oi.expression/v1',expression_ref:E,revision:1,title:'Canvas import',
  scenes:[{scene_ref:SCENE_REF,revision:1,title:'Alpha',entity_refs:[]}],entities:{},relations:{},
  selection:{scene_ref:SCENE_REF,entity_ref:null},provenance:[],representations:[],refinements:[]};
}
// The owner: a flush saves the working cards as entities, a relation_bind binds a connection, a sides save sets the connectors.
function makeOwner(){
 const owner={doc:kernelDoc(),refuseRelations:false,onAct:null};
 owner.occurrence=viewId=>owner.doc.entities[`${E}:entity:${viewId}`]?`${E}:entity:${viewId}`:undefined;
 owner.flush=localDoc=>{
  const scene=localDoc.scenes[0];const ids=(scene.entities??[]).map(item=>item.id);
  const missing=ids.filter(id=>!owner.doc.entities[`${E}:entity:${id}`]);
  if(!missing.length)return false;
  const next=clone(owner.doc);
  for(const id of missing){const ref=`${E}:entity:${id}`;next.entities[ref]={entity_ref:ref,title:id,revision:1,subject:null,parameters:{glyph:{value:'O',automation:null}}};next.scenes[0].entity_refs.push(ref);}
  next.revision++;owner.doc=next;return true;
 };
 owner.bind=changes=>{
  const next=clone(owner.doc);
  for(const change of changes){if(change.change==='relation_bind')next.relations[change.binding.binding_ref]=clone(change.binding);}
  next.revision++;owner.doc=next;
 };
 return owner;
}
// One native act, in the order the app's nativeAct runs it: the flush (the cards), the relations, the sides, then ONE record.
async function ownerAct(store,owner,label,relate,sides){
 const before=clone(owner.doc);
 const flushed=owner.flush(store.document);
 owner.onAct?.(store);
 const changes=relate(viewId=>owner.occurrence(viewId));
 if(owner.refuseRelations)throw new Error('the owner refused the connections');
 owner.bind(changes);
 const incoming=clone(store.document);
 const sideChanges=[];
 if(sides){sides(incoming);const connectors=incoming.scenes[0].research?.connectors;owner.doc={...owner.doc,scenes:[{...owner.doc.scenes[0],presentation:{connectors:clone(connectors??{})}}]};owner.doc.revision++;sideChanges.push({change:'scene_material_set'});}
 const recorded=[...(flushed?[{change:'cards_saved'}]:[]),...changes,...sideChanges];
 store.recordNativeAct(label,incoming,{changes:recorded,before,after:clone(owner.doc)});
}
function makeHost(store,owner){
 let seq=0;
 return {
  store,
  relationKind:kind=>{if(!kind.trim()||kind.length>120)throw new Error('Choose a connection type of 1–120 characters.');return encodeURIComponent(kind.trim());},
  bindingRef:()=>`${E}:relation:connection-${++seq}`,
  kernelDocument:()=>clone(owner.doc),
  saveCards:async()=>{
   const before=clone(owner.doc);const flushed=owner.flush(store.document);
   if(!flushed)return true;
   const anchor=store.kernelSaveAnchor();
   return store.attachKernelCheckpoint(anchor,{changes:[{change:'cards_saved'}],before,after:clone(owner.doc)});
  },
  act:(label,relate,sides)=>ownerAct(store,owner,label,relate,sides),
  rollback:async before=>{if(owner.doc.revision!==before.revision)owner.doc=clone(before);},
 };
}
const ALPHA='connection "supports" from "Alpha note" to "Beta note"';
const BETA='connection "answers" from "Beta note" to "Alpha note"';
// The import as the researchInstruments importer builds it: a batch of cards and frames, and links between the created cards.
function cardsAndLinks(){
 const actions=[
  {type:'create-card',id:'c1',kind:'note',position:{x:0,y:0},title:'Alpha note'},
  {type:'card-content',id:'c1',content:JSON.stringify([{type:'paragraph',content:[{type:'text',text:'Alpha note',styles:{}}]}])},
  {type:'resize',id:'c1',width:160,height:90},
  {type:'create-card',id:'c2',kind:'note',position:{x:1,y:0},title:'Beta note'},
  {type:'resize',id:'c2',width:160,height:90},
  {type:'frame-save',id:'f1',label:'Group',memberRefs:['c1','c2']},
 ];
 const links=[
  {sourceViewId:'c1',targetViewId:'c2',relationKind:'supports',named:ALPHA,connector:{kind:'curved',fromSide:'right',toSide:'left'}},
  {sourceViewId:'c2',targetViewId:'c1',relationKind:'answers',named:BETA},
 ];
 return {actions,links};
}

test('canvasImportLabel names the import for its file, in the Undo voice', ()=>{
 assert.equal(canvasImportLabel('Board.canvas'),'Import "Board.canvas"');
 assert.equal(canvasImportLabel('My  "odd"\nname.canvas'),'Import "My odd name.canvas"','quotes and line breaks are not carried into the label');
 assert.equal(canvasImportLabel(''),'Import "untitled.canvas"');
 assert.ok(canvasImportLabel('x'.repeat(200)).length<=90,'a long file name is cut');
});

test('a spanning gesture is one entry under its own label, closed by the owner act that records it', async()=>{
 const store=new DocumentStore(journeyWithScene());
 store.openSpanningGesture('Import "a.canvas"');
 assert.equal(store.transactionOpen,true,'the gesture holds the document open');
 assert.equal(store.spanningLabel,'Import "a.canvas"');
 store.recordNativeAct('Connect cards',clone(store.document),{changes:[{change:'x'}],before:{revision:1},after:{revision:2}});
 assert.equal(store.undoStack.length,1,'the act is the one step');
 assert.equal(store.undoLabel(),'Import "a.canvas"','the step carries the gesture label, not the act label');
 assert.equal(store.spanningLabel,null,'the act closed the gesture');
 assert.equal(store.transactionOpen,false);
});

test('a spanning gesture refuses other local edits by name, and abandons with nothing recorded', ()=>{
 const store=new DocumentStore(journeyWithScene());
 const original=digest(store.document);
 store.openSpanningGesture('Import "b.canvas"');
 assert.throws(()=>store.change('Edit title',d=>{d.name='changed';}),/"Import "b.canvas"" is in progress/);
 assert.throws(()=>store.composite('Split',d=>{d.name='changed';}),/in progress|open gesture/);
 assert.throws(()=>store.finish(),/in progress/);
 assert.throws(()=>store.redo(),/in progress/);
 assert.throws(()=>store.withdrawNewestStep('Import "b.canvas"'),/in progress/);
 store.abandonSpanningGesture();
 assert.equal(store.transactionOpen,false);
 assert.equal(store.spanningLabel,null);
 assert.equal(store.undoStack.length,0,'nothing was recorded');
 assert.equal(digest(store.document),original,'the document returns to where the gesture began');
 store.change('Edit title',d=>{d.name='after';});
 assert.equal(store.undoLabel(),'Edit title','edits are open again once the gesture is abandoned');
});

test('the import is one labelled undo step: one Undo removes the cards, frames and connections, one Redo restores them', async()=>{
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 const pre=digest(store.document),ownerPre=digest(owner.doc);
 const {actions,links}=cardsAndLinks();
 const result=await runCanvasImport(makeHost(store,owner),{sceneId:SCENE,label:canvasImportLabel('Board.canvas'),actions,links});
 assert.deepEqual(result,{connected:2,skipped:[]});
 assert.equal(store.undoStack.length,1,'the whole import is one undo entry');
 assert.equal(store.undoLabel(),'Import "Board.canvas"');
 assert.equal(Object.keys(owner.doc.relations).length,2,'the owner holds both connections');
 assert.ok(owner.doc.entities[`${E}:entity:c1`]&&owner.doc.entities[`${E}:entity:c2`],'the owner holds both cards');
 const afterImport=digest(store.document);
 assert.notEqual(afterImport,pre);
 assert.ok(store.undoStack[0].changes?.length,'the step carries the owner edit it made');

 // One Undo: the owner is compensated to the document before the import, and the local document follows.
 const undo=store.undoPlan();
 assert.ok(undo.kernel&&'changes' in undo.kernel,'the undo has a kernel compensation (not refused)');
 owner.doc=clone(store.checkpointAt('undo').before);
 assert.equal(store.undoAccepted(),true);
 assert.equal(digest(store.document),pre,'one Undo returns the document to before the import');
 assert.equal(digest(owner.doc),ownerPre,'one Undo returns the owner to before the import');
 assert.equal(store.undoStack.length,0);

 // One Redo: the owner and the document return to the imported state.
 const redo=store.redoPlan();
 assert.equal(redo.label,'Import "Board.canvas"');
 owner.doc=clone(store.checkpointAt('redo').after);
 assert.equal(store.redo({compensated:true}),true);
 assert.equal(digest(store.document),afterImport,'one Redo restores the whole import');
 assert.equal(Object.keys(owner.doc.relations).length,2,'one Redo restores both connections');
});

test('a connection whose end the owner does not hold is named and skipped; the cards and the other connections land as one entry', async()=>{
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 const {actions,links}=cardsAndLinks();
 links[1]={...links[1],sourceViewId:'missing-card'};
 const result=await runCanvasImport(makeHost(store,owner),{sceneId:SCENE,label:'Import "c.canvas"',actions,links});
 assert.deepEqual(result,{connected:1,skipped:[`${BETA} not imported: an end has no native occurrence yet`]},'the skipped connection is named with the existing refusal text');
 assert.equal(store.undoStack.length,1,'the import is one entry');
 assert.equal(store.undoLabel(),'Import "c.canvas"');
 assert.equal(Object.keys(owner.doc.relations).length,1,'the valid connection is held by the owner');
 assert.ok(owner.doc.entities[`${E}:entity:c1`]&&owner.doc.entities[`${E}:entity:c2`],'the cards land');
 const undo=store.undoPlan();
 assert.ok(undo.kernel&&'changes' in undo.kernel);
 owner.doc=clone(store.checkpointAt('undo').before);
 assert.equal(store.undoAccepted(),true);
 assert.equal(Object.keys(owner.doc.relations).length,0,'one Undo removes the cards and the connection together');
});

test('a file with one bad edge imports its cards and good edges as one entry, and names the bad edge', async()=>{
 const text=JSON.stringify({nodes:[
  {id:'a',type:'text',text:'Alpha note',x:0,y:0,width:200,height:100},
  {id:'b',type:'text',text:'Beta note',x:300,y:0,width:200,height:100},
  {id:'g',type:'group',label:'Frame',x:-50,y:-50,width:600,height:250},
 ],edges:[
  {id:'e1',fromNode:'a',toNode:'b',label:'supports'},
  {id:'e2',fromNode:'a',toNode:'g',label:'bad'},
 ]});
 const plan=planObsidianImport(parseObsidianCanvas(text));
 assert.equal(plan.edges.length,1,'the planner keeps the good edge');
 assert.ok(plan.skipped.some(line=>/connection "bad" .*not imported: a frame is not a connection end/.test(line)),'the planner names the bad edge');
 // The importer's own shape: the cards, the frame and one link per planned edge, named as the importer names them.
 const cardRef=key=>`r-${key}`;
 const actions=[];
 for(const card of plan.cards){actions.push({type:'create-card',id:cardRef(card.key),kind:'note',position:{x:card.x/100,y:-card.y/100},title:card.title});actions.push({type:'resize',id:cardRef(card.key),width:Math.max(40,card.width),height:Math.max(40,card.height)});}
 for(const frame of plan.frames)actions.push({type:'frame-save',id:'r-frame',label:frame.label,memberRefs:frame.memberKeys.map(cardRef)});
 const title=key=>plan.cards.find(card=>card.key===key)?.title??'an unnamed card';
 const links=plan.edges.map(edge=>({sourceViewId:cardRef(edge.fromKey),targetViewId:cardRef(edge.toKey),relationKind:edge.relationKind,named:`connection "${edge.relationKind}" from "${title(edge.fromKey)}" to "${title(edge.toKey)}"`}));
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 const result=await runCanvasImport(makeHost(store,owner),{sceneId:SCENE,label:canvasImportLabel('Board.canvas'),actions,links});
 assert.deepEqual(result,{connected:1,skipped:[]});
 assert.equal(store.undoStack.length,1,'the import is one entry');
 assert.equal(store.undoLabel(),'Import "Board.canvas"');
 assert.equal(Object.keys(owner.doc.relations).length,1,'the good edge is held');
 assert.ok(owner.doc.entities[`${E}:entity:r-a`]&&owner.doc.entities[`${E}:entity:r-b`],'the cards land');
});

test('an owner refusal after the cards reached it rolls them back and lands nothing', async()=>{
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 const pre=digest(store.document),ownerPre=digest(owner.doc);
 owner.refuseRelations=true;
 const {actions,links}=cardsAndLinks();
 await assert.rejects(runCanvasImport(makeHost(store,owner),{sceneId:SCENE,label:'Import "d.canvas"',actions,links}),
  /nothing was imported: the owner refused the connections/);
 assert.equal(store.undoStack.length,0);
 assert.equal(store.transactionOpen,false);
 assert.equal(digest(store.document),pre);
 assert.equal(digest(owner.doc),ownerPre,'the owner holds no cards from the refused import');
});

test('every connection skipped leaves no connection to make: the import is refused whole and lands nothing', async()=>{
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 const pre=digest(store.document),ownerPre=digest(owner.doc);
 const {actions,links}=cardsAndLinks();
 links[0]={...links[0],sourceViewId:'missing-a'};links[1]={...links[1],targetViewId:'missing-b'};
 await assert.rejects(runCanvasImport(makeHost(store,owner),{sceneId:SCENE,label:'Import "i.canvas"',actions,links}),
  /nothing was imported: none of its connections has an end the owner holds/);
 assert.equal(store.undoStack.length,0);
 assert.equal(digest(store.document),pre);
 assert.equal(digest(owner.doc),ownerPre);
});

test('an owner act that answers without recording is a failure: rolled back, and the gesture never left open', async()=>{
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 const pre=digest(store.document);
 const {actions,links}=cardsAndLinks();
 const host=makeHost(store,owner);host.act=async()=>{};
 await assert.rejects(runCanvasImport(host,{sceneId:SCENE,label:'Import "s.canvas"',actions,links}),
  /nothing was imported: the owner answered the import without recording it/);
 assert.equal(store.spanningLabel,null,'the owner-write gate is open again');
 assert.equal(store.transactionOpen,false);
 assert.equal(store.undoStack.length,0);
 assert.equal(digest(store.document),pre);
});

test('a refused batch writes nothing to the owner and lands nothing', async()=>{
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 const pre=digest(store.document),ownerPre=digest(owner.doc);
 const {actions,links}=cardsAndLinks();
 actions[2]={type:'resize',id:'c1',width:1,height:1};
 await assert.rejects(runCanvasImport(makeHost(store,owner),{sceneId:SCENE,label:'Import "e.canvas"',actions,links}),
  /nothing was imported: Invalid card size/);
 assert.equal(store.undoStack.length,0);
 assert.equal(store.transactionOpen,false);
 assert.equal(digest(store.document),pre);
 assert.equal(digest(owner.doc),ownerPre);
});

test('the draft is held and other edits wait while the import is open', async()=>{
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 const probes={};let flushes=0;
 const timers=[];
 const draft=new DraftSchedule({flush:()=>{flushes++;return true;},gestureOpen:()=>store.transactionOpen,timers:{set:run=>{timers.push(run);return timers.length;},clear(){}}});
 // Mid-act: the gesture is open, a local edit and an Undo are refused by name, and a draft flush asks for a write that waits.
 owner.onAct=s=>{
  probes.open=s.transactionOpen;probes.label=s.spanningLabel;
  probes.changeRefused=(()=>{try{s.change('Side edit',d=>{d.name='side';});return false;}catch(error){return /in progress/.test(error.message);}})();
  probes.undoRefused=(()=>{try{s.finish();return false;}catch(error){return /in progress/.test(error.message);}})();
  draft.request();void draft.flushNow('edit');
 };
 const {actions,links}=cardsAndLinks();
 await runCanvasImport(makeHost(store,owner),{sceneId:SCENE,label:'Import "f.canvas"',actions,links});
 assert.equal(probes.open,true,'the gesture is open during the owner act');
 assert.equal(probes.label,'Import "f.canvas"');
 assert.equal(probes.changeRefused,true,'a local edit during the import is refused by name');
 assert.equal(probes.undoRefused,true,'an Undo cannot close the import early');
 assert.equal(flushes,0,'the draft is not written while the import is open');
 await draft.flushNow('edit');
 assert.equal(flushes,1,'the draft is written once the import has recorded');
});

test('cards only: one composite step, one Save; a refused Save withdraws the step without a redo', async()=>{
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 const pre=digest(store.document);
 const {actions}=cardsAndLinks();
 await runCanvasImport(makeHost(store,owner),{sceneId:SCENE,label:'Import "g.canvas"',actions,links:[]});
 assert.equal(store.undoStack.length,1);
 assert.equal(store.undoLabel(),'Import "g.canvas"');
 assert.ok(store.undoStack[0].changes?.length,'the Save is recorded on the step');
 assert.equal(store.redoStack.length,0);

 const refusing=makeOwner();const store2=new DocumentStore(journeyWithScene());
 const host=makeHost(store2,refusing);host.saveCards=async()=>false;
 await assert.rejects(runCanvasImport(host,{sceneId:SCENE,label:'Import "h.canvas"',actions,links:[]}),
  /nothing was imported: the native owner did not acknowledge the cards/);
 assert.equal(store2.undoStack.length,0,'the refused step is withdrawn');
 assert.equal(store2.redoStack.length,0,'no redo survives a withdrawn import');
 assert.equal(digest(store2.document),pre,'the document is as it was');
});

test('the history wait reason names the open import and the direction, for the toast', ()=>{
 assert.equal(historyWaitReason('undo','Import "a.canvas"'),'Undo waits: Import "a.canvas" is still in progress, and it is one step once the native owner acknowledges it.');
 assert.equal(historyWaitReason('redo','Import "a.canvas"'),'Redo waits: Import "a.canvas" is still in progress, and it is one step once the native owner acknowledges it.');
});

// The owner-write gate is the native workspace's own entry check, driven here with the real installNativeWorkspace.
// A refused write sends nothing and names its reason through the toast; the import's own owner call passes the same gate.
function workspaceWithGate(){
 const toasts=[];const hold={reason:null,own:false};
 const ws=installNativeWorkspace({
  snapshot:()=>({journey:journeyWithScene(),sceneId:SCENE,entityId:null}),
  version:()=>1,load:()=>{},toast:message=>toasts.push(message),summon:()=>{},correspondence:()=>{},
  shouldRetainDraft:()=>false,anchor:()=>({entry:null,length:0,base:null}),
  gate:()=>(hold.own||hold.reason===null)?null:hold.reason,
 });
 return {ws,toasts,hold};
}
test('while an import is open, the owner writes a user can start are refused by name and nothing is sent', async()=>{
 const {ws,toasts,hold}=workspaceWithGate();
 const reason='Import "j.canvas" is in progress: this change waits until its native owner acknowledges it.';
 hold.reason=reason;
 assert.equal(await ws.select(SCENE,null),'invalidated','a scene or selection change is refused');
 assert.equal(await ws.advance(),false,'a clean advance to a newer owner revision is refused');
 assert.equal(await ws.commit(),false,'a Save is refused');
 assert.equal(await ws.saveFile('folder','name'),false,'a Save to a file is refused');
 assert.equal(await ws.openFile('/some/file.json'),false,'opening a file is refused');
 assert.equal(await ws.follow('expression:other'),false,'following another Expression is refused');
 assert.equal(await ws.refreshReference('expression:other'),false,'a refresh from the navigator is refused');
 assert.equal(await ws.open('expression:other'),false,'opening another Expression is refused');
 await assert.rejects(ws.edit([{change:'x'}],'Set collections'),e=>e.message===reason,'an edit is refused by name');
 assert.ok(toasts.length>=3,'each refusal is named through the toast');
 assert.ok(toasts.every(message=>message===reason),'every toast names the reason, and no other write is attempted');
});
test('the import\'s own owner call passes the same gate, and a write with no open import is not held', async()=>{
 const {ws,toasts,hold}=workspaceWithGate();
 hold.reason='Import "k.canvas" is in progress: this change waits until its native owner acknowledges it.';
 hold.own=true;
 await assert.rejects(ws.edit([{change:'x'}],'Connect cards'),e=>!/is in progress/.test(e.message),'the import act reaches the owner path');
 assert.ok(!toasts.some(message=>/is in progress/.test(message)),'the import act is not held');
 hold.own=false;hold.reason=null;
 await assert.rejects(ws.edit([{change:'x'}],'Connect'),e=>!/is in progress/.test(e.message),'with no open import, an edit is not held');
 assert.ok(!toasts.some(message=>/is in progress/.test(message)));
});

test('the app wires the import through one host call, one composite-or-act path, and the owner-write hold', ()=>{
 const appSource=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 const researchSource=fs.readFileSync(new URL('../src/researchInstruments.tsx',import.meta.url),'utf8');
 const materialSource=fs.readFileSync(new URL('../src/researchMaterial.ts',import.meta.url),'utf8');
 const workspaceSource=fs.readFileSync(new URL('../src/nativeWorkspace.ts',import.meta.url),'utf8');
 const importer=researchSource.slice(researchSource.indexOf('const importCanvasFile'),researchSource.indexOf('// B3 — the selection'));
 assert.ok(importer.length>200,'the importer is found');
 assert.equal((importer.match(/host\.importCanvas\(/g)??[]).length,1,'the importer makes one import call');
 assert.doesNotMatch(importer,/host\.material\(|host\.connectMany|host\.connect\(/,'no separate material batch or connect act remains in the importer');
 assert.match(importer,/canvasImportLabel\(file\.name\)/,'the step is named for the file');
 assert.match(appSource,/importCanvas:\(sceneId,label,actions,links\)=>\{researchScene\(sceneId\);const work=runCanvasImport\(canvasImportHost\(sceneId\)/,'app.ts wires importCanvas to runCanvasImport');
 assert.match(appSource,/gestureOpen:\(\)=>store\.transactionOpen/,'the draft is held while the store gesture is open');
 assert.match(materialSource,/export async function runCanvasImport/);
 assert.match(materialSource,/skipped\.push\(`\$\{link\.named\} not imported: an end has no native occurrence yet`\)/,'a missing end is skipped and named');
 // The owner-write hold: the workspace checks it at each owner-write entry, and app.ts supplies it.
 assert.match(appSource,/gate:ownerWriteRefusal/,'the workspace is given the owner-write hold');
 assert.match(appSource,/act:\(label,relate,sides\)=>asCanvasImportOwnerCall\(/,'the import act passes the hold');
 assert.match(appSource,/await asCanvasImportOwnerCall\(\(\)=>nativeWorkspace!\.replayCheckpoint/,'the import rollback passes the hold');
 assert.ok((workspaceSource.match(/refusedByHost\(\)/g)??[]).length>=10,'every owner-write entry checks the hold (the behaviour is pinned by the gate tests above)');
 // Undo and Redo while an import is open: they wait and say why, through the toast, before any store call.
 const stepSource=appSource.slice(appSource.indexOf('async function stepHistory'),appSource.indexOf('let nativeState'));
 assert.match(stepSource,/if\(openImport!==null\)\{toast\(historyWaitReason\(direction,openImport\),4200\);return;\}/,'Undo and Redo wait and say why');
 assert.ok(stepSource.indexOf('openImport')<stepSource.indexOf('store.finish()'),'the wait is checked before the store is touched');
 assert.match(appSource,/b\.disabled=!store\.undoStack\.length\|\|store\.spanningLabel!==null/,'the undo button is disabled while an import is open');
 assert.match(appSource,/b\.disabled=!store\.redoStack\.length\|\|store\.spanningLabel!==null/,'the redo button is disabled while an import is open');
});

test('a refused import with the undo history at its cap still returns the owner and lands nothing', async()=>{
 const owner=makeOwner();const store=new DocumentStore(journeyWithScene());
 for(let index=0;index<60;index+=1)store.change(`Edit ${index}`,d=>{d.name=`n${index}`;});
 assert.equal(store.undoStack.length,60,'the history is at its cap');
 const topBefore=store.undoStack.at(-1);
 const pre=digest(store.document),ownerPre=digest(owner.doc);
 owner.refuseRelations=true;
 const {actions,links}=cardsAndLinks();
 await assert.rejects(runCanvasImport(makeHost(store,owner),{sceneId:SCENE,label:'Import "cap.canvas"',actions,links}),/nothing was imported/);
 assert.equal(store.undoStack.at(-1),topBefore,'no step was recorded at the cap');
 assert.equal(digest(store.document),pre);
 assert.equal(digest(owner.doc),ownerPre,'the owner is returned even though the history did not grow');
});
