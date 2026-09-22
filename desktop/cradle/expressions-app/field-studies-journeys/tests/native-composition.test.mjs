import test from 'node:test';
import assert from 'node:assert/strict';
import {blankJourney,entity,clone,validateJourney} from '../build/model.js';
import {initialiseSceneSaves,saveScene,nextSceneFrom,sceneSaveState} from '../build/sceneWorkflow.js';
import {kernelDocumentToJourney} from '../build/kernelDocumentBridge.js';
import {prepareCompositionEdit,rebaseCompositionView} from '../build/kernelComposition.js';
import {nativeConnections} from '../build/nativeCorrespondence.js';
import {NativeWorking,validateWorkingRecord} from '../build/nativeWorking.js';
import {sameSceneData,mergeScenePage} from '../build/sceneCorrespondence.js';

// Controlled owner-port responses for converter/state-machine unit tests.
// Actual Rust storage and browser tests are separate; this reducer is NOT a
// claimed native implementation or proof of persistence.
function empty(ref='expression:test',title='Test'){
 return {schema:'oi.expression/v1',expression_ref:ref,revision:1,title,scenes:[{scene_ref:ref+':scene:main',revision:1,title:'Main',entity_refs:[]}],entities:{},relations:{},selection:{scene_ref:ref+':scene:main',entity_ref:null},provenance:[],representations:[],refinements:[]};
}
const reorderKeys=value=>Array.isArray(value)?value.map(reorderKeys):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,reorderKeys(v)])):value;
function ownerEdit(document,request){
 if(request.expected_revision!==document.revision)return {state:'revision_conflict',current_revision:document.revision};
 const d=clone(document),scene=ref=>d.scenes.find(s=>s.scene_ref===ref);
 for(const c of request.changes){switch(c.change){
  case 'rename':d.title=c.title;break;
  case 'composition_set':d.presentation=clone(c.presentation);break;
  case 'scene_create':d.scenes.push({scene_ref:c.scene_ref,title:c.title,revision:1,entity_refs:[]});break;
  case 'entity_add':d.entities[c.entity_ref]={entity_ref:c.entity_ref,title:c.title,revision:1,subject:null,parameters:{glyph:{value:'O'}}};scene(c.scene_ref).entity_refs.push(c.entity_ref);break;
  case 'scene_rename':scene(c.scene_ref).title=c.title;if(scene(c.scene_ref).presentation)scene(c.scene_ref).presentation.scene.name=c.title;break;
  case 'scene_compose':scene(c.scene_ref).entity_refs=[...c.entity_refs];break;
  case 'scene_material_set':scene(c.scene_ref).presentation=clone(c.presentation);if(!c.presentation.saved)delete scene(c.scene_ref).presentation.saved;break;
  case 'scene_remove':d.scenes=d.scenes.filter(s=>s.scene_ref!==c.scene_ref);break;
  case 'scene_reorder':d.scenes=c.scene_refs.map(scene);break;
  case 'focus':d.selection={scene_ref:c.scene_ref,entity_ref:c.entity_ref};break;
  case 'relation_focus':d.selection={scene_ref:c.scene_ref,entity_ref:null,relation_ref:c.binding_ref};break;
  default:assert.fail('Unexpected native operation '+c.change);
 }}
 if(request.changes.length)d.revision++;
 return {state:'ready',document:reorderKeys(d)};
}
function authored(){const j=initialiseSceneSaves(blankJourney());j.name='A working inquiry';j.scenes[0].name='First';j.scenes[0].entities=[entity('source role','A')];return j;}
const snapshot=j=>({journey:j,sceneId:j.scenes[0].id,entityId:j.scenes[0].entities[0]?.id??null});
function seed(j){const d=empty('expression:whole',j.name);return kernelDocumentToJourney(d,{identity:{expression:j.id,scenes:{[d.scenes[0].scene_ref]:j.scenes[0].id}}});}
function ports(){let doc;const effects=[],checkpoints=[];return {
 effects,checkpoints,get doc(){return doc;},set doc(value){doc=value;},
 options:{mint:()=> 'expression:new',checkpoint:async(id,record)=>checkpoints.push(clone(record)),file:async()=>{throw new Error('No file owner in this unit test');},expression:async request=>{
  effects.push(clone(request));
  if(request.operation==='create'){doc=empty(request.expression_ref,request.title);return {state:'ready',document:clone(doc)};}
  if(request.operation==='inspect')return {state:'ready',document:clone(doc)};
  if(request.operation==='edit'){const result=ownerEdit(doc,request);if(result.document)doc=result.document;return result;}
  throw new Error('unexpected port request');
 }},
};}

test('saved and edited Scene versions, text, pacing and 3D survive serde key ordering and reopen',()=>{
 const j=authored();saveScene(j,j.scenes[0],'First');j.scenes[0].entities[0].position.z=.7;j.scenes[0].duration=36;j.scenes[0].character='question, not evidence';
 const second=nextSceneFrom(j,j.scenes[0]);second.name='Different framing';second.duration=18;
 const view=seed(j),request=prepareCompositionEdit(view,j,snapshot(j));
 const native=ownerEdit(view.document,request).document,returned=rebaseCompositionView(view,j,native);
 assert.equal(returned.journey.scenes[0].duration,36);assert.equal(returned.journey.scenes[0].entities[0].position.z,.7);
 assert.equal(returned.journey.savedScenes[returned.journey.scenes[0].id].entities[0].position.z,0);
 assert.equal(sceneSaveState(returned.journey,returned.journey.scenes[0]),'Edited since save');
 assert.equal(sceneSaveState(returned.journey,returned.journey.scenes[1]),'Draft');
 assert.equal(prepareCompositionEdit(returned,j,snapshot(j)).changes.length,0,'an acknowledged material result is not perpetually dirty');
 const restart=kernelDocumentToJourney(JSON.parse(JSON.stringify(native)));
 assert.equal(sceneSaveState(restart.journey,restart.journey.scenes[0]),'Edited since save');
 assert.equal(sceneSaveState(restart.journey,restart.journey.scenes[1]),'Draft');
 assert.equal(restart.document.expression_ref,native.expression_ref);
});
test('removing the Scene material binding loses the edited/saved distinction: explicit negative',()=>{
 const j=authored();saveScene(j,j.scenes[0],'First');j.scenes[0].duration=42;
 const view=seed(j),native=ownerEdit(view.document,prepareCompositionEdit(view,j)).document;
 const complete=kernelDocumentToJourney(native);delete native.scenes[0].presentation;
 const disconnected=kernelDocumentToJourney(native);
 assert.notEqual(complete.journey.scenes[0].duration,disconnected.journey.scenes[0].duration);
 assert.notEqual(sceneSaveState(complete.journey,complete.journey.scenes[0]),sceneSaveState(disconnected.journey,disconnected.journey.scenes[0]));
});
test('a saved-only formation is retained natively without being made visible or deleted',()=>{
 const j=authored();saveScene(j,j.scenes[0],'First');j.scenes[0].entities=[];
 const view=seed(j),native=ownerEdit(view.document,prepareCompositionEdit(view,j)).document,back=rebaseCompositionView(view,j,native);
 assert.equal(native.scenes[0].entity_refs.length,1);assert.equal(back.journey.scenes[0].entities.length,0);
 assert.equal(back.journey.savedScenes[back.journey.scenes[0].id].entities.length,1);
 assert.equal(prepareCompositionEdit(back,j).changes.length,0);
});
test('wire equality ignores map ordering, not sequence ordering or unsafe content',()=>{
 assert.ok(sameSceneData({a:1,b:{x:true,y:undefined}},{b:{x:true},a:1}));
 assert.ok(!sameSceneData(['a','b'],['b','a']));
});
test('checkpoint failure prevents even the first native creation',async()=>{
 const p=ports();p.options.checkpoint=async()=>{throw new Error('storage full');};const work=new NativeWorking(p.options);
 await assert.rejects(()=>work.commit(snapshot(authored())),/storage full/);assert.equal(p.effects.length,0);assert.equal(work.state,undefined);
});
test('actual edited material generates one captured CAS; successful reply never edits the human draft',async()=>{
 const p=ports(),work=new NativeWorking(p.options),j=authored(),before=clone(j);
 const d=await work.commit(snapshot(j));assert.equal(d.revision,2);assert.deepEqual(j,before);
 assert.deepEqual(p.effects.map(x=>x.operation),['create','edit']);assert.equal(work.state.pending,undefined);
 await work.commit(snapshot(j));assert.equal(p.effects.length,2,'idempotent unchanged commit has no second write');
 assert.doesNotThrow(()=>validateWorkingRecord(JSON.parse(JSON.stringify(work.state)),j));
});
test('lost native edit reply is inspected by value; the write is never replayed',async()=>{
 const p=ports(),call=p.options.expression;let lost=true;p.options.expression=async r=>{const data=await call(r);if(r.operation==='edit'&&lost){lost=false;throw new Error('lost response');}return data;};
 const work=new NativeWorking(p.options),j=authored();await assert.rejects(()=>work.commit(snapshot(j)),/lost/);
 assert.equal(work.state.pending.kind,'edit');const checkpoint=JSON.parse(JSON.stringify(work.state));
 const restart=new NativeWorking(p.options);restart.restore(checkpoint,j);j.scenes[0].duration=74;
 await restart.inspectPending();assert.equal(j.scenes[0].duration,74,'return must not replace newer human work');
 assert.equal(p.effects.filter(x=>x.operation==='edit').length,1);assert.equal(restart.state.pending,undefined);
 await restart.commit(snapshot(j));assert.equal(p.doc.scenes[0].presentation.scene.duration,74);
});
test('another native edit invalidates the returning operation basis and remains an explicit conflict',async()=>{
 const p=ports(),work=new NativeWorking(p.options),j=authored();await work.commit(snapshot(j));
 p.doc={...p.doc,revision:p.doc.revision+1,title:'Someone else changed the inquiry'};j.scenes[0].duration=22;
 await assert.rejects(()=>work.commit(snapshot(j)),/revision_conflict/);
 assert.equal(p.doc.title,'Someone else changed the inquiry');assert.equal(work.state.pending.kind,'edit');
 await assert.rejects(()=>work.inspectPending(),/revision_conflict/);
});
test('a late acknowledgement after navigation checkpoints its old work and does not bind the new draft',async()=>{
 const p=ports(),call=p.options.expression;let release,entered;const waiting=new Promise(resolve=>entered=resolve);
 p.options.expression=async request=>{const data=await call(request);if(request.operation==='edit'){entered();await new Promise(resolve=>release=resolve);}return data;};
 const work=new NativeWorking(p.options),promise=work.commit(snapshot(authored()));await waiting;work.detach();release();await promise;
 assert.equal(work.state,undefined);assert.equal(p.checkpoints.at(-1).pending,undefined,'old acknowledgement is durable for its own draft');
});
test('forged recovered operations are refused before any native action',async()=>{
 const p=ports(),work=new NativeWorking(p.options),j=authored();await work.commit(snapshot(j));const record=work.state;
 record.pending={kind:'edit',request:{operation:'edit',expression_ref:record.view.document.expression_ref,expected_revision:2,actor:'agent:forged',changes:[{change:'scene_remove',scene_ref:'foreign'}]},submitted:snapshot(j)};
 assert.throws(()=>validateWorkingRecord(record,j),/captured basis/);
});

test('dropping a whole-level carrier from one page cannot delete hidden occurrence data',()=>{
 const j=authored(),whole=j.scenes[0];whole.entities.push(entity('hidden member','B'));
 whole.semanticField={bindings:[{id:'source-role',carriers:[{kind:'entity',id:whole.entities[1].id}]}]};
 const partial=clone(whole);partial.entities=partial.entities.slice(0,1);delete partial.semanticField;
 const before=clone(whole);
 assert.throws(()=>mergeScenePage(whole,partial,new Set([whole.entities[0].id])),/hidden member page/);
 assert.deepEqual(whole,before,'refusal does not rewrite the whole or discard the edited proposal');
});

test('native creation uses the kernel ID grammar before checkpointing or dispatch',async()=>{
 const p=ports();p.options.mint=()=> 'expression:authored:invalid';const work=new NativeWorking(p.options);
 await assert.rejects(()=>work.commit(snapshot(authored())),/stable safe Expression identity/);
 assert.equal(p.effects.length,0);assert.equal(p.checkpoints.length,0);
});

function related(){
 const d=empty('expression:links','Related passages');
 for(const id of ['a','b','repeat']){const ref=d.expression_ref+':entity:'+id;d.entities[ref]={entity_ref:ref,title:id,revision:1,subject:{subject_ref:'same-source',native_owner:'ai-kit',presentation_role:'thing',sources:[],readings:[],actions:[]},parameters:{glyph:{value:id}}};d.scenes[0].entity_refs.push(ref);}
 for(const id of ['one','two']){const ref=d.expression_ref+':relation:'+id;d.relations[ref]={binding_ref:ref,native_owner:'ai-kit',relation:{ref:'wiki:relation:'+id,revision:'r1',availability:'available'},from_entity_ref:d.scenes[0].entity_refs[0],to_entity_ref:d.scenes[0].entity_refs[1],provenance:[]};}
 return d;
}
test('current-app correspondence retains repeated source occurrences and parallel native relations',()=>{
 const view=kernelDocumentToJourney(related()),rows=nativeConnections(view)[view.journey.scenes[0].id];
 assert.equal(rows.length,2);assert.notEqual(rows[0].relation.ref,rows[1].relation.ref);
 assert.equal(rows[0].native_to_entity_ref,'expression:links:entity:b');
 assert.notEqual(rows[0].to_entity_ref,'expression:links:entity:repeat');
 assert.deepEqual(nativeConnections(undefined),{},'disconnected owner/view has no invented relation representation');
 const missing=clone(view);missing.bindings[view.journey.scenes[0].id].occurrences=missing.bindings[view.journey.scenes[0].id].occurrences.filter(o=>o.entity_ref!=='expression:links:entity:b');
 assert.equal(nativeConnections(missing)[view.journey.scenes[0].id].length,0,'missing occurrence does not bind the repeated source');
});
test('native focus is exact and does not commit an edited material draft',async()=>{
 const p=ports();p.doc=related();const work=new NativeWorking(p.options),view=await work.adopt(p.doc);
 const edited=clone(view.journey);edited.scenes[0].duration=70;
 await work.select({scene_ref:p.doc.scenes[0].scene_ref,binding_ref:'expression:links:relation:two'});
 assert.equal(p.doc.selection.relation_ref,'expression:links:relation:two');
 assert.equal(p.doc.scenes[0].presentation,undefined,'selection does not author or commit material');
 assert.equal(edited.scenes[0].duration,70);assert.equal(p.effects.at(-1).changes[0].change,'relation_focus');
 assert.equal(work.state.view.document.revision,2);assert.equal(work.state.pending,undefined);
 await assert.rejects(()=>work.select({scene_ref:p.doc.scenes[0].scene_ref,binding_ref:'wiki:relation:two'}),/Relation occurrence/);
 await work.commit(snapshot(edited));assert.equal(p.doc.scenes[0].presentation.scene.duration,70);
});
test('a lost selection reply recovers its exact native focus without replay or replacing drafts',async()=>{
 const p=ports();p.doc=related();const work=new NativeWorking(p.options),view=await work.adopt(p.doc),call=p.options.expression;
 p.options.expression=async request=>{const result=await call(request);if(request.operation==='edit')throw new Error('lost selection reply');return result;};
 await assert.rejects(()=>work.select({scene_ref:p.doc.scenes[0].scene_ref,entity_ref:'expression:links:entity:repeat'}),/lost/);
 const record=JSON.parse(JSON.stringify(work.state)),restored=new NativeWorking(p.options);restored.restore(record,view.journey);
 await restored.inspectPending();assert.equal(p.effects.filter(r=>r.operation==='edit').length,1);assert.equal(restored.state.view.document.selection.entity_ref,'expression:links:entity:repeat');
});
