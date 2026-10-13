import test from 'node:test';
import assert from 'node:assert/strict';
import {documentToChanges,invertEdit,saveKernelExpression,UNEXPRESSIBLE} from '../build/kernelExpressions.js';
import {DocumentStore} from '../build/store.js';
import {fieldStudies} from '../build/model.js';

// E15: labelled undo. Each undo step names its operation, and a step the kernel
// already holds is undone by one compensating kernel edit: the inverse of the
// step's own change list, read from the two kernel documents. The kernel side
// is simulated by a small applier below, covering the kinds these fixtures emit.
const E='expression:labelled-undo';
const S=n=>`${E}:scene:${n}`;
const A=S('a'),B=S('b'),C=S('c');
const X=`${E}:entity:x`,Y=`${E}:entity:y`,Z=`${E}:entity:z`,N=`${E}:entity:n`;
const AUTO={min:-100,max:100,rate_hz:1,waveform:'sine'};
const REF={ref:'source-r1',revision:'1',availability:'available'};
const SUBJECT={subject_ref:'wiki:shared-source',native_owner:'ai-kit',presentation_role:'thing',sources:[],readings:[],actions:[]};
const TRIGGER={trigger_ref:`${E}:trigger:t1`,occasion:'scene_enter',target:{kind:'navigate',scene_ref:B,entity_ref:null}};
const CONNECTION={binding_ref:`${E}:relation:connection-1`,native_owner:'oi',relation:{ref:`${E}:relation:connection-1:connects`,revision:'1',availability:'available'},from_entity_ref:X,to_entity_ref:Y,provenance:[]};
const clone=value=>JSON.parse(JSON.stringify(value));

function base(){
 return {schema:'oi.expression/v1',expression_ref:E,revision:3,title:'Labelled undo',
  scenes:[
   {scene_ref:A,revision:1,title:'Alpha',entity_refs:[X,Y],triggers:[clone(TRIGGER)]},
   {scene_ref:B,revision:1,title:'Beta',entity_refs:[Z]},
   {scene_ref:C,revision:1,title:'Gamma',entity_refs:[]},
  ],
  entities:{
   [X]:{entity_ref:X,title:'X',revision:1,subject:null,parameters:{glyph:{value:'O',automation:null},x:{value:10,automation:null}}},
   [Y]:{entity_ref:Y,title:'Y',revision:1,subject:null,parameters:{glyph:{value:'Q',automation:null},y:{value:4,automation:clone(AUTO)}}},
   [Z]:{entity_ref:Z,title:'Z',revision:1,subject:null,parameters:{glyph:{value:'Z',automation:null}}},
  },
  relations:{[CONNECTION.binding_ref]:clone(CONNECTION)},
  collections:['alpha'],selection:{scene_ref:A,entity_ref:null},provenance:[],representations:[],refinements:[]};
}

// One edit touching every family the acceptance path exercises.
function edited(current){
 const doc=clone(current);
 doc.title='Renamed';
 doc.scenes=doc.scenes.filter(s=>s.scene_ref!==B);                    // scene_remove B (with its member Z)
 doc.scenes.find(s=>s.scene_ref===A).title='Alpha Prime';            // scene_rename A
 doc.scenes.find(s=>s.scene_ref===A).triggers=[{...clone(TRIGGER),target:{kind:'navigate',scene_ref:C,entity_ref:null}}];
 doc.scenes.reverse();                                                // scene_reorder
 doc.scenes.find(s=>s.scene_ref===C).entity_refs=[N];                 // scene_compose C with the new member
 delete doc.entities[Z];                                              // entity_remove Z
 doc.entities[N]={entity_ref:N,title:'N',revision:1,subject:null,parameters:{glyph:{value:'N',automation:null},x:{value:1,automation:null}}};
 doc.entities[X].parameters.x.value=20;                               // parameter_set
 doc.entities[X].subject=clone(SUBJECT);                              // subject_bind
 doc.entities[Y].parameters.y={value:5,automation:null};             // parameter_manual + parameter_set
 doc.collections=['alpha','beta'];                                    // collections_set
 doc.selection={scene_ref:C,entity_ref:null};                         // focus
 return doc;
}

// A pure applier for the kernel Change kinds these fixtures emit. It enforces the
// ordering the kernel requires (a scene exists before its entities are added, an
// entity exists before a scene carries it), so a mis-ordered list fails here.
const scene=(d,ref)=>{const s=d.scenes.find(x=>x.scene_ref===ref);if(!s)throw new Error(`no scene ${ref}`);return s;};
const entity=(d,ref)=>{const e=d.entities[ref];if(!e)throw new Error(`no entity ${ref}`);return e;};
function applyChanges(doc,changes){
 const d=clone(doc);
 for(const c of changes){
  switch(c.change){
   case 'rename':d.title=c.title;break;
   case 'scene_create':d.scenes.push({scene_ref:c.scene_ref,revision:1,title:c.title,entity_refs:[]});break;
   case 'scene_remove':d.scenes=d.scenes.filter(s=>s.scene_ref!==c.scene_ref);break;
   case 'scene_rename':scene(d,c.scene_ref).title=c.title;break;
   case 'scene_reorder':d.scenes=c.scene_refs.map(ref=>scene(d,ref));break;
   case 'scene_compose':for(const ref of c.entity_refs)entity(d,ref);scene(d,c.scene_ref).entity_refs=[...c.entity_refs];break;
   case 'scene_trigger_attach':(scene(d,c.scene_ref).triggers??=[]).push(clone(c.trigger));break;
   case 'scene_trigger_detach':for(const s of d.scenes){if(!s.triggers)continue;s.triggers=s.triggers.filter(t=>t.trigger_ref!==c.trigger_ref);if(!s.triggers.length)delete s.triggers;}break;
   case 'entity_add':scene(d,c.scene_ref);d.entities[c.entity_ref]={entity_ref:c.entity_ref,title:c.title,revision:1,subject:null,parameters:{glyph:{value:'O',automation:null}}};break;
   case 'entity_remove':delete d.entities[c.entity_ref];break;
   case 'entity_pin':entity(d,c.entity_ref).pinned=c.pinned;break;
   case 'subject_bind':entity(d,c.entity_ref).subject=clone(c.binding);break;
   case 'subject_unbind':entity(d,c.entity_ref).subject=null;break;
   case 'parameter_set':{const e=entity(d,c.entity_ref);(e.parameters[c.parameter]??={value:c.value,automation:null}).value=c.value;break;}
   case 'parameter_automate':entity(d,c.entity_ref).parameters[c.parameter].automation=clone(c.automation);break;
   case 'parameter_manual':entity(d,c.entity_ref).parameters[c.parameter].automation=null;break;
   case 'relation_bind':d.relations[c.binding.binding_ref]=clone(c.binding);break;
   case 'relation_remove':delete d.relations[c.binding_ref];break;
   case 'collections_set':d.collections=[...c.collections];break;
   case 'focus':d.selection={scene_ref:c.scene_ref,entity_ref:c.entity_ref};break;
   default:throw new Error(`the test applier has no rule for ${c.change}`);
  }
 }
 return d;
}
// The kernel's own revision counter and entity/scene revisions are not content.
function digest(doc){
 const d=clone(doc);delete d.revision;for(const s of d.scenes)delete s.revision;for(const e of Object.values(d.entities))delete e.revision;
 return JSON.stringify(d,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
}

test('acceptance: edit, save, then the compensating edit restores the pre-edit kernel digest',()=>{
 const pre=base(),post=edited(pre);
 const forward=documentToChanges(pre,post);
 assert.ok('changes' in forward,forward.error);
 const kernelAfter=applyChanges(pre,forward.changes);
 assert.equal(digest(kernelAfter),digest(post),'the forward change list carries the whole edit');
 const compensation=invertEdit(pre,kernelAfter);
 assert.ok('changes' in compensation,compensation.reason);
 const restored=applyChanges(kernelAfter,compensation.changes);
 assert.equal(digest(restored),digest(pre),'undo restores the pre-edit document');
 // Membership and triggers come back in the kernel's own order.
 const kinds=compensation.changes.map(c=>c.change);
 assert.ok(kinds.indexOf('scene_create')<kinds.indexOf('entity_add'));
 assert.ok(kinds.indexOf('entity_add')<kinds.indexOf('scene_compose'));
});

test('an unedited document has an empty compensation',()=>{
 assert.deepEqual(invertEdit(base(),base()),{changes:[]});
});

test('a value edit inverts to the previous value and automation, in the kernel grammar',()=>{
 const pre=base(),post=clone(pre);
 post.entities[X].parameters.x.value=20;
 post.entities[Y].parameters.y.automation=null;post.entities[Y].parameters.y.value=5;
 const forward=documentToChanges(pre,post);
 const compensation=invertEdit(pre,applyChanges(pre,forward.changes));
 assert.deepEqual(compensation.changes,[
  {change:'parameter_set',entity_ref:X,parameter:'x',value:10},
  {change:'parameter_set',entity_ref:Y,parameter:'y',value:4},
  {change:'parameter_automate',entity_ref:Y,parameter:'y',automation:AUTO},
 ]);
});

test('what no kernel change can undo is refused by name, never dropped',()=>{
 const pre=base();
 const withRepresentation=clone(pre);withRepresentation.representations=[{kind:'image',representation:REF,provenance:[]}];
 const representation=invertEdit(pre,withRepresentation);
 assert.equal(representation.refused,'representation_removal');
 assert.ok(representation.reason.includes(UNEXPRESSIBLE.representation_removal));

 const withProperties=clone(pre);withProperties.presentation={schema:'oi.journey-properties/v1',description:'',loop:false};
 const propertiesRefusal=invertEdit(pre,withProperties);
 assert.equal(propertiesRefusal.refused,'composition_removal');

 const withParameter=clone(pre);withParameter.entities[X].parameters.w={value:1,automation:null};
 const parameterRefusal=invertEdit(pre,withParameter);
 assert.equal(parameterRefusal.refused,'parameter_removal');
 assert.ok(parameterRefusal.reason.includes(UNEXPRESSIBLE.parameter_removal));

 assert.equal(invertEdit(pre,{schema:'other'}).refused,'not_diffable');
});

test('a Scene restored by its inverse carries its members and their parameters',()=>{
 const pre=base();
 const post=clone(pre);post.scenes=post.scenes.filter(s=>s.scene_ref!==B);delete post.entities[Z];
 const kernelAfter=applyChanges(pre,documentToChanges(pre,post).changes);
 const compensation=invertEdit(pre,kernelAfter);
 const restored=applyChanges(kernelAfter,compensation.changes);
 assert.equal(digest(restored),digest(pre));
 assert.deepEqual(restored.scenes.find(s=>s.scene_ref===B).entity_refs,[Z]);
});

test('labelled steps: change(label, fn) names its step; change(fn) is "Edit"; the labels read back',()=>{
 const store=new DocumentStore(fieldStudies());
 store.change('Trim scene 3',doc=>{doc.scenes[0].name='Trimmed';});
 store.change(doc=>{doc.scenes[0].name='Plain';});
 assert.deepEqual(store.undoStack.map(entry=>entry.label),['Trim scene 3','Edit']);
 assert.equal(store.undoLabel(),'Edit');
 assert.equal(store.redoLabel(),null);
 store.undo();
 assert.equal(store.undoLabel(),'Trim scene 3');
 assert.equal(store.redoLabel(),'Edit');
 store.undo();
 assert.equal(store.undoLabel(),null);
 assert.equal(store.redoLabel(),'Trim scene 3');
 store.redo();store.redo();
 assert.equal(store.document.scenes[0].name,'Plain');
});

test('a gesture takes the label it begins with; a failed labelled edit leaves no step',()=>{
 const store=new DocumentStore(fieldStudies());
 store.begin('Move entity');store.touch();store.document.scenes[0].name='Dragged';store.touch();store.finish();
 assert.equal(store.undoLabel(),'Move entity');
 assert.throws(()=>store.change('Broken',doc=>{doc.scenes[0].name='Half';throw new Error('boom');}),/boom/);
 assert.equal(store.undoStack.length,1);
 assert.equal(store.document.scenes[0].name,'Dragged');
});

test('attachKernelEdit records the kernel edit on the step just committed, and only that step',()=>{
 const store=new DocumentStore(fieldStudies());
 assert.equal(store.attachKernelEdit([],{changes:[]}),false,'no step has been committed yet');
 store.change('Renamed',doc=>{doc.name='Renamed';});
 const changes=[{change:'rename',title:'Renamed'}];
 assert.equal(store.attachKernelEdit(changes,{changes:[{change:'rename',title:'Original'}]}),true);
 assert.deepEqual(store.undoStack.at(-1).changes,changes);
 store.finish();
 assert.equal(store.attachKernelEdit(changes,{changes:[]}),false,'a later finish commits nothing to attach to');
});

test('before any kernel save, undo is local and plans no kernel edit',()=>{
 const store=new DocumentStore(fieldStudies());
 assert.equal(store.undoPlan(),null);
 store.change('Edit A',doc=>{doc.scenes[0].name='A';});
 assert.deepEqual(store.undoPlan(),{label:'Edit A',kernel:null});
});

test('at the kernel head, undo is one compensating edit; undoing it restores the kernel digest, and redo re-applies the edit',()=>{
 const store=new DocumentStore(fieldStudies());
 const pre=base(),post=edited(pre);
 store.markKernelSaved();
 // The app's own edit is recorded as the kernel's change list and its inverse, then saved.
 store.change('Trim and rename',doc=>{doc.scenes[0].name='Trimmed';});
 const forward=documentToChanges(pre,post);
 const kernelAfter=applyChanges(pre,forward.changes);
 assert.equal(store.attachKernelEdit(forward.changes,invertEdit(pre,kernelAfter)),true);
 store.markKernelSaved();
 let kernel=kernelAfter;

 const plan=store.undoPlan();
 assert.equal(plan.label,'Trim and rename');
 assert.deepEqual(plan.kernel.changes,invertEdit(pre,kernelAfter).changes);
 kernel=applyChanges(kernel,plan.kernel.changes);
 assert.equal(digest(kernel),digest(pre));
 assert.equal(store.undo({compensated:true}),true);
 assert.equal(store.document.scenes[0].name,fieldStudies().scenes[0].name);
 assert.equal(store.undoStack.length,0);

 const redo=store.redoPlan();
 assert.equal(redo.label,'Trim and rename');
 kernel=applyChanges(kernel,redo.kernel.changes);
 assert.equal(digest(kernel),digest(kernelAfter));
 assert.equal(store.redo({compensated:true}),true);
 assert.equal(store.document.scenes[0].name,'Trimmed');
});

test('a step above the kernel head undoes locally; the saved step below it still needs its compensation',()=>{
 const store=new DocumentStore(fieldStudies());
 store.change('Saved',doc=>{doc.scenes[0].name='Saved';});
 store.attachKernelEdit([{change:'rename',title:'x'}],{changes:[{change:'rename',title:'y'}]});
 store.markKernelSaved();
 store.change('Unsaved',doc=>{doc.scenes[0].name='Unsaved';});
 assert.deepEqual(store.undoPlan(),{label:'Unsaved',kernel:null});
 assert.equal(store.undo(),true);
 assert.deepEqual(store.undoPlan(),{label:'Saved',kernel:{changes:[{change:'rename',title:'y'}]}});
});

test('a plain undo across the kernel head makes the kernel state unknown until the next save',()=>{
 const store=new DocumentStore(fieldStudies());
 store.change('One',doc=>{doc.scenes[0].name='One';});
 store.attachKernelEdit([{change:'rename',title:'x'}],{changes:[{change:'rename',title:'y'}]});
 store.change('Two',doc=>{doc.scenes[0].name='Two';});
 store.attachKernelEdit([{change:'rename',title:'x2'}],{changes:[{change:'rename',title:'y2'}]});
 store.markKernelSaved();
 assert.equal(store.undo(),true);
 assert.equal(store.undoPlan().kernel,null,'the kernel still holds Two, so the plan refuses to guess');
 store.markKernelSaved();
 assert.deepEqual(store.undoPlan(),{label:'One',kernel:{changes:[{change:'rename',title:'y'}]}});
});

test('an unrecorded step at the kernel head is refused by name, not undone silently',()=>{
 const store=new DocumentStore(fieldStudies());
 store.change('Unrecorded',doc=>{doc.scenes[0].name='U';});
 store.markKernelSaved();
 const plan=store.undoPlan();
 assert.equal(plan.label,'Unrecorded');
 assert.equal(plan.kernel.refused,'unrecorded');
});

test('the compensating path refuses an empty list rather than submitting a no-op edit',async()=>{
 const result=await saveKernelExpression(base(),{changes:[]});
 assert.equal(result.ok,false);
 assert.match(result.error,/no changes/);
});
