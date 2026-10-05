import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {blankScene,entity,clone,validateJourney} from '../expressions-app/field-studies-journeys/src/model.ts';
import {toNativeConfig} from '../expressions-app/field-studies-journeys/src/nativeBridge.ts';
import {resolveSequence} from '../expressions-app/src/engine/fieldModel.ts';
import {kernelDocumentToJourney,nativeSceneMaterial} from '../expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {prepareCompositionEdit} from '../expressions-app/field-studies-journeys/src/kernelComposition.ts';
import {emptyRetention,withRetention,retention} from '../expressions-app/field-studies-journeys/src/proceduralRetention.ts';
import {automationTargets} from '../expressions-app/field-studies-journeys/src/nativeParameters.ts';
import {mapSceneOccurrences as currentMapSceneOccurrences} from '../expressions-app/field-studies-journeys/src/sceneCorrespondence.ts';
import {evaluateTracks} from '../expressions-app/field-studies-journeys/src/propertyTracks.ts';

// The literal is the complete frozen producer template, not a produced native
// receipt. These tests exercise real application codecs and sequence consumers.
const templatePath=process.env.TA_ONTA_AUTHORING_TEMPLATE;
const template=templatePath?JSON.parse(await readFile(templatePath,'utf8')):null;
const mapSceneOccurrences=process.env.TA_ONTA_SCENE_CORRESPONDENCE_CANDIDATE
  ?(await import(process.env.TA_ONTA_SCENE_CORRESPONDENCE_CANDIDATE)).mapSceneOccurrences:currentMapSceneOccurrences;
const expression='expression:independent-composition',sceneRef=expression+':scene:main';
const journey=s=>({schema:'oi.journey',version:1,id:expression,name:'Independent ordinary material',description:'',loop:true,scenes:[s],savedScenes:{},updatedAt:'2026-10-02T00:00:00Z'});

test('A03/A07 frozen complete producer template reaches existing force, layers and sequence consumers',{
  skip:!template&&'Unexecuted: complete frozen TA_ONTA_AUTHORING_TEMPLATE source required',
},()=>{
  assert.equal(template.schema,'oi.journey-scene/v1');
  const admitted=validateJourney(journey(template.scene)).scenes[0],config=toNativeConfig(admitted);
  const formation=config.entities.find(e=>e.kind==='formation'),force=config.entities.find(e=>e.kind==='pin');
  assert.equal(formation.id,'source-form');assert.equal(formation.authoringSource.ascii.text,'ATG');
  assert.equal(formation.layers[0].id,'retained-layer');assert.equal(formation.layers[0].z,8);
  assert.equal(formation.layers[0].scale,0.9);assert.equal(formation.layers[0].source.ascii.text,'ATG');
  assert.equal(formation.forces.mode,'attract');assert.equal(formation.forces.strength,0.25);
  assert.equal(formation.forces.radius,120);
  assert.equal(force.forces.mode,'vortex');assert.equal(force.forces.strength,0.125);
  assert.equal(force.forces.radius,200);assert.equal(force.forces.spin,0.2);assert.equal(force.x,50);
  assert.equal(formation.sequence.advance,'time');assert.deepEqual(formation.sequence.links.map(l=>l.id),['source-1','source-2']);
  assert.equal(formation.sequence.links[1].source.ascii.text,'TGA');
  const held=resolveSequence(formation,1,0,0,0),transition=resolveSequence(formation,2.5,0,0,0),next=resolveSequence(formation,3.5,0,0,0);
  assert.equal(held.phase,'hold');assert.equal(held.linkIndex,0);assert.equal(transition.phase,'transition');
  assert.ok(Math.abs(transition.progress-0.5)<1e-12);assert.equal(next.linkIndex,1);assert.equal(next.phase,'hold');
  assert.deepEqual(resolveSequence(formation,2.5,0,0,0),transition,'the same actual clock position must resolve the same continuing state');
});

function wholeDocument(){
  const scene=blankScene('Native complete paged material');scene.id=sceneRef;
  scene.entities=Array.from({length:48},(_,i)=>{const e=entity('Native constituent '+i,String(i));e.id=expression+':entity:body-'+i;e.force.strength=i/100;return e;});
  const hidden=scene.entities[47],address={expression_ref:expression,scene_ref:sceneRef,entity_ref:hidden.id,component:'force',constituent_ref:null,property:'strength'};
  hidden.force.strength=0.875;const r=emptyRetention();
  r.contributions=[{contribution_ref:'contribution:hidden',procedure_ref:'procedure:whole',output_slot:'formation',subject_refs:['source:hidden'],occurrence_ref:hidden.id,recipe_revision:'1',owned_addresses:[{...address,component:'entity',property:null}],generated_basis:{force:{strength:0.47}},authored_overrides:[{address,value:0.875,actor:'human:owner'}],status:'active'}];
  const retained=withRetention(scene,r),entities=Object.fromEntries(retained.entities.map(e=>[e.id,{entity_ref:e.id,title:e.name,subject:null,parameters:{}}]));
  return {schema:'oi.expression/v1',expression_ref:expression,revision:17,title:'Native complete world',entities,relations:{},scenes:[{scene_ref:sceneRef,title:retained.name,entity_refs:retained.entities.map(e=>e.id),presentation:{schema:'oi.journey-scene/v1',scene:retained,saved:null}}],selection:{scene_ref:sceneRef,entity_ref:null,relation_ref:null}};
}

test('A07/A13 ordinary paged composition edits retain hidden generated constituents and exact intervention',()=>{
  const document=wholeDocument(),original=clone(document),view=kernelDocumentToJourney(document);
  assert.equal(view.bindings[sceneRef].page_count,2);assert.equal(view.journey.scenes[0].entities.length,32);
  assert.equal(nativeSceneMaterial(view.document,view.document.scenes[0]).entities.length,48);
  const edited=clone(view.journey);edited.scenes[0].entities[0].force.strength=0.61;
  const edit=prepareCompositionEdit(view,edited,{actor:'human:owner'});
  assert.equal(edit.expression_ref,expression);assert.equal(edit.expected_revision,17);
  const material=edit.changes.find(c=>c.change==='scene_material_set').presentation.scene;
  assert.equal(material.entities.length,48);assert.equal(material.entities[0].force.strength,0.61);
  assert.equal(material.entities.find(e=>e.id.endsWith('body-47')).force.strength,0.875);
  assert.deepEqual(retention(material),retention(document.scenes[0].presentation.scene));
  assert.deepEqual(document,original,'building the native CAS edit must preserve the captured original');
  const reopenedDoc=clone(document);reopenedDoc.revision=18;reopenedDoc.scenes[0].presentation.scene=JSON.parse(JSON.stringify(material));
  const reopened=kernelDocumentToJourney(reopenedDoc,{pages:{[sceneRef]:1}});
  assert.equal(reopened.journey.scenes[0].entities.length,16);
  assert.equal(reopened.journey.scenes[0].entities.find(e=>e.id.endsWith('body-47')).force.strength,0.875);
  assert.deepEqual(retention(reopened.journey.scenes[0]),retention(material));
  assert.equal(prepareCompositionEdit(reopened,reopened.journey).changes.length,0);
});

test('A02/A07 dropped view occurrence is presentation removal while its native membership and source remain explicit',()=>{
  const document=wholeDocument(),view=kernelDocumentToJourney(document),edited=clone(view.journey);
  const removed=edited.scenes[0].entities.shift().id;
  const edit=prepareCompositionEdit(view,edited),material=edit.changes.find(c=>c.change==='scene_material_set').presentation.scene;
  assert.ok(document.scenes[0].entity_refs.includes(removed));assert.equal(material.entities.length,47);
  assert.ok(!material.entities.some(e=>e.id===removed));assert.ok(!edit.changes.some(c=>c.change==='scene_compose'||c.change==='entity_remove'));
  assert.equal(material.entities.find(e=>e.id.endsWith('body-47')).force.strength,0.875);
});

test('A02/A06/A13 ordinary constituent addressing retains the same active automation target',()=>{
  const s=blankScene('Actual authored driver');s.entities=[entity('Actual force target','O')];s.entities[0].id='local-body';
  const target=automationTargets(s).find(t=>t.entityId==='local-body'&&t.bind==='entity.force.strength');
  s.automation=[{id:'driver:source',entityId:'local-body',target:target.target,enabled:true,type:'lfo',wave:'sine',
    min:0.1,max:0.7,rate:0.25,phase:0,blend:'replace',duration:5,delay:0,loop:'loop',firedAt:0}];
  const original=toNativeConfig(s);assert.equal(original.automations.length,1);
  const ref=expression+':entity:local-body',addressed=mapSceneOccurrences(s,sceneRef,new Map([['local-body',ref]]));
  const consumed=toNativeConfig(validateJourney(journey(addressed)).scenes[0]);
  assert.equal(addressed.automation[0].entityId,ref);
  assert.equal(consumed.automations.length,1,'normal stable occurrence qualification must not silently drop the existing native driver');
  assert.equal(consumed.automations[0].id,original.automations[0].id);assert.equal(consumed.automations[0].path,'entities.0.forces.strength');
});

test('A02/A06/A13 encoded entity and sequence targets, tracks and current-scene tools map without rewriting source',()=>{
  const s=blankScene('Exact declared references');s.id='scene:authored';s.entities=[entity('Named native body','O')];
  const e=s.entities[0];e.id='local:body';e.source={kind:'ascii',ascii:{text:'entity:local%3Abody:forces.strength'}};
  e.sequence.enabled=true;e.sequence.steps[0].id='step:retained';e.sequence.steps[0].native={hold:1.25};
  const target=automationTargets(s).find(t=>t.entityId===e.id&&t.bind==='entity.force.strength');
  const base={enabled:true,type:'lfo',wave:'sine',min:0.1,max:0.7,rate:0.25,phase:0,blend:'replace',duration:5,delay:0,loop:'loop',firedAt:0};
  s.automation=[{...base,id:'driver:entity',entityId:e.id,target:target.target,clockId:'clock:continuing'},
    {...base,id:'driver:link',target:`link:${encodeURIComponent(e.id)}:${encodeURIComponent(e.sequence.steps[0].id)}:hold`,clockId:'clock:link'}];
  s.propertyTracks=[{id:'track:retained',entityId:e.id,bind:'entity.force.strength',points:[{time:0,value:0.2},{time:10,value:0.4}]}];
  s.toolbelt=[{id:'tool:retained',key:'force.strength',scope:'named',entityId:e.id,sceneId:s.id,journeyId:expression}];
  s.character=target.target;s.native={config:toNativeConfig(s),projection:toNativeConfig(s)};const before=clone(s);
  const ref=expression+':entity:body',mapped=mapSceneOccurrences(s,sceneRef,new Map([[e.id,ref]]));
  assert.deepEqual(s,before);assert.equal(mapped.automation[0].target,`entity:${encodeURIComponent(ref)}:forces.strength`);
  assert.equal(mapped.automation[1].target,`link:${encodeURIComponent(ref)}:${encodeURIComponent('step:retained')}:hold`);
  assert.equal(mapped.automation[0].clockId,'clock:continuing');assert.equal(mapped.automation[1].clockId,'clock:link');
  assert.equal(mapped.propertyTracks[0].entityId,ref);assert.equal(mapped.toolbelt[0].entityId,ref);
  assert.equal(mapped.toolbelt[0].sceneId,sceneRef);assert.equal(mapped.toolbelt[0].journeyId,expression);
  assert.equal(mapped.character,before.character);assert.deepEqual(mapped.entities[0].source,before.entities[0].source);
  assert.equal(mapped.native.config.entities[0].id,ref);assert.equal(mapped.native.projection.entities[0].id,ref);
  const admitted=validateJourney(journey(mapped)).scenes[0],config=toNativeConfig(admitted);
  assert.equal(config.automations.length,2);assert.equal(config.automations[1].path,'entities.0.sequence.links.0.hold');
  assert.ok(Math.abs(evaluateTracks(admitted,5).entities[0].force.strength-0.3)<1e-12);
});

test('A02/A06 paged disclosure omits hidden target-only driver and refuses conflicting target metadata atomically',()=>{
  const s=blankScene('Actual bounded control membership');s.entities=[entity('A','A'),entity('B','B')];
  s.entities[0].id='a';s.entities[1].id='b';const target=automationTargets(s).find(t=>t.entityId==='b'&&t.bind==='entity.force.strength');
  s.automation=[{id:'driver:hidden',target:target.target,enabled:true,type:'lfo',wave:'sine',min:0.1,max:0.7,rate:0.25,phase:0,blend:'replace',duration:5,delay:0,loop:'loop',firedAt:0}];
  const refs=new Map([['a',expression+':entity:a'],['b',expression+':entity:b']]);
  assert.equal(mapSceneOccurrences(s,sceneRef,refs,new Set(['a'])).automation.length,0);
  s.automation[0].entityId='a';const before=clone(s);
  assert.throws(()=>mapSceneOccurrences(s,sceneRef,refs),/conflicting|identity|occurrence/i);assert.deepEqual(s,before);
});

const consumedDocumentPath=process.env.TA_ONTA_CONSUMED_DOCUMENT;
const consumedDocument=consumedDocumentPath?JSON.parse(await readFile(consumedDocumentPath,'utf8')):null;
test('A03/A07/A13 actual native producer and Application output reaches the existing whole-field consumer',{
  skip:!consumedDocument&&'Unexecuted: actual compiled producer consumed by native Application document required',
},()=>{
  assert.equal(consumedDocument.schema,'oi.expression/v1');assert.equal(consumedDocument.expression_ref,'expression:acceptance');
  assert.equal(consumedDocument.revision,4);assert.equal(Object.keys(consumedDocument.entities).length,6);
  const view=kernelDocumentToJourney(consumedDocument),materialScenes=view.journey.scenes.filter(s=>s.entities.length);
  assert.equal(materialScenes.length,3);let humanTargets=0;
  for(const scene of materialScenes){
    const binding=view.bindings[scene.id],config=toNativeConfig(scene);assert.equal(config.entities.length,2);
    assert.equal(binding.occurrences.length,2);assert.ok(binding.occurrences.every(o=>o.subject?.subject_ref));
    const formation=config.entities.find(e=>e.kind==='formation'),pin=config.entities.find(e=>e.kind==='pin');
    assert.equal(formation.layers[0].id,'retained-layer');assert.equal(formation.layers[0].source.ascii.text,'ATG');
    assert.equal(formation.authoringSource.ascii.text,'ATG');assert.equal(formation.sequence.advance,'time');
    assert.equal(formation.sequence.links.length,2);assert.equal(pin.forces.mode,'vortex');
    if(formation.forces.strength===0.875){
      humanTargets++;assert.equal(scene.entities.find(e=>e.id===formation.id).sequence.steps[1].hold,3.5);
      assert.equal(formation.sequence.links[1].hold,3.5,'regenerated timing must reach the actual native sequence override');
      const position=resolveSequence(formation,6.2,0,0,0);assert.equal(position.linkIndex,1);
      assert.equal(position.phase,'hold','actual revised second state must still hold at this native owner position');
    }
  }
  assert.equal(humanTargets,1,'actual native human intervention must survive producer regeneration at one exact constituent');
  assert.equal(prepareCompositionEdit(view,view.journey).changes.length,0,'reading actual admitted native material must not remint or rewrite it');
});
