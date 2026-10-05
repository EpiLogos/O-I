import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const nativeRoot='file:///Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/expressions-app/field-studies-journeys/src/';
const consumerRoot=process.env.TA_ONTA_PAGE_CONSUMER_ROOT??nativeRoot;
const {blankScene,entity,clone}=await import(nativeRoot+'model.ts');
const {toNativeConfig}=await import(nativeRoot+'nativeBridge.ts');
const {applyAutomations,createAutomationRuntime}=await import('file:///Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/expressions-app/src/engine/automation.ts');
const {kernelDocumentToJourney}=await import(consumerRoot+'kernelDocumentBridge.ts');
const {prepareCompositionEdit}=await import(consumerRoot+'kernelComposition.ts');
const expression='expression:independent-page',sceneRef=expression+':scene:main';
function document(){
 const s=blankScene('Actual hidden driver page');s.id=sceneRef;
 s.entities=Array.from({length:48},(_,i)=>{const e=entity('Retained '+i,String(i));e.id=expression+':entity:body-'+i;return e;});
 const hidden=s.entities[42];hidden.force.strength=.2;hidden.sequence.enabled=true;hidden.sequence.steps[0].id='step:continuing';hidden.sequence.steps[0].native={hold:1.25};
 const base={enabled:true,type:'lfo',wave:'sine',min:.1,max:.7,rate:.25,phase:0,blend:'replace',duration:5,delay:0,loop:'loop',firedAt:0};
 s.automation=[{...base,id:'driver:hidden-entity',target:`entity:${encodeURIComponent(hidden.id)}:forces.strength`,clockId:'clock:continuing'},
  {...base,id:'driver:hidden-link',target:`link:${encodeURIComponent(hidden.id)}:${encodeURIComponent('step:continuing')}:hold`,clockId:'clock:link'}];
 s.propertyTracks=[{id:'track:hidden',entityId:hidden.id,bind:'entity.force.strength',points:[{time:0,value:.2},{time:10,value:.4}]}];
 const config=toNativeConfig(s);s.native={config:{...clone(config),automation:clone(s.automation)},projection:{...clone(config),automation:clone(s.automation)},
  original:{identity:'opaque native original source bytes',nested:{text:'entity:'+encodeURIComponent(hidden.id)+':forces.strength'}}};
 return {schema:'oi.expression/v1',expression_ref:expression,revision:17,title:'Independent actual paged authoring',entities:Object.fromEntries(s.entities.map(e=>[e.id,{entity_ref:e.id,title:e.name,subject:null,parameters:{}}])),
  relations:{},scenes:[{scene_ref:sceneRef,title:s.name,entity_refs:s.entities.map(e=>e.id),presentation:{schema:'oi.journey-scene/v1',scene:s,saved:null}}],selection:{scene_ref:sceneRef,entity_ref:null,relation_ref:null}};
}

test('A02/A06/A13 actual page edit and native CAS material save retain hidden target-only entity/link drivers',()=>{
 const original=document(),before=clone(original),view=kernelDocumentToJourney(original);
 assert.equal(view.journey.scenes[0].entities.length,32);
 assert.equal(view.journey.scenes[0].automation.length,0,'hidden encoded targets must not leak into the disclosed page');
 const edited=clone(view.journey);edited.scenes[0].entities[0].force.strength=.61;
 const edit=prepareCompositionEdit(view,edited,{actor:'human:independent'});
 assert.equal(edit.expected_revision,17);
 const changes=edit.changes.filter(c=>c.change==='scene_material_set');assert.equal(changes.length,1);
 const material=changes[0].presentation.scene;
 assert.equal(material.entities.length,48);assert.equal(material.entities[0].force.strength,.61);
 assert.deepEqual(material.automation,original.scenes[0].presentation.scene.automation,'page save lost or revised hidden encoded target drivers');
 assert.deepEqual(material.propertyTracks,original.scenes[0].presentation.scene.propertyTracks);
 for(const bucket of ['config','projection'])assert.deepEqual(material.native[bucket].automation,original.scenes[0].presentation.scene.native[bucket].automation);
 assert.deepEqual(material.native.original,original.scenes[0].presentation.scene.native.original,'native original bytes were rewritten');
 assert.deepEqual(original,before,'ordinary edit production changed its original native basis');
 const saved=JSON.parse(JSON.stringify(original));saved.revision=18;saved.scenes[0].presentation=JSON.parse(JSON.stringify(changes[0].presentation));
 const reopened=kernelDocumentToJourney(saved,{pages:{[sceneRef]:1}}),scene=reopened.journey.scenes[0];
 assert.equal(scene.entities.length,16);assert.equal(scene.automation.length,2);
 assert.equal(scene.automation[0].clockId,'clock:continuing');assert.equal(scene.automation[1].clockId,'clock:link');
 const config=toNativeConfig(scene);assert.equal(config.automations.length,2);
 const actual=applyAutomations(config,config.automations,0,createAutomationRuntime());
 const target=actual.config.entities.find(e=>e.id===expression+':entity:body-42');
 assert.ok(Math.abs(target.forces.strength-.4)<1e-12,'retained driver did not reach its same actual CPU native target');
 assert.equal(prepareCompositionEdit(reopened,reopened.journey).changes.length,0,'reopen reminted or rewrote unchanged native material');
});

const worldPath=process.env.TA_ONTA_EXISTING_WORLD_DOCUMENT;
test('A09/A13 existing saved native EpiWorld remains byte exact through its ordinary page edit',{
 skip:!worldPath&&'Unexecuted: actual existing native saved EpiWorld document required',
},async()=>{
 const d=JSON.parse(await readFile(worldPath,'utf8')),original=clone(d);
 const nativeScene=d.scenes.find(s=>s.presentation?.scene?.epiWorld);
 assert.ok(nativeScene,'actual saved world has no native scene carrier');
 const worldBytes=JSON.stringify(nativeScene.presentation.scene.epiWorld);
 const view=kernelDocumentToJourney(d),scene=view.journey.scenes.find(s=>s.id===nativeScene.scene_ref);
 assert.ok(scene?.entities.length);const edited=clone(view.journey),changed=edited.scenes.find(s=>s.id===scene.id);
 changed.entities[0].force.strength=changed.entities[0].force.strength===.61?.62:.61;
 const edit=prepareCompositionEdit(view,edited,{actor:'human:independent'});
 const material=edit.changes.find(c=>c.change==='scene_material_set'&&c.scene_ref===nativeScene.scene_ref).presentation.scene;
 assert.equal(JSON.stringify(material.epiWorld),worldBytes);
 assert.deepEqual(d,original);const saved=clone(d);saved.revision++;
 saved.scenes.find(s=>s.scene_ref===nativeScene.scene_ref).presentation.scene=JSON.parse(JSON.stringify(material));
 assert.equal(JSON.stringify(kernelDocumentToJourney(saved).journey.scenes.find(s=>s.id===scene.id).epiWorld),worldBytes);
});
