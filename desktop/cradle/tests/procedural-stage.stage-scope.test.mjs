import test from 'node:test';
import assert from 'node:assert/strict';
import {blankScene,entity,clone} from '../expressions-app/field-studies-journeys/src/model.ts';
import {kernelDocumentToJourney} from '../expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {scopeContains} from '../expressions-app/field-studies-journeys/src/proceduralStudio.ts';
import {stageForceParameters,stageForceCommandTarget,stageForceChoice} from '../expressions-app/field-studies-journeys/src/proceduralStageSource.ts';

const descriptor={recipe:'force_parameters',label:'Native force parameter domain',native_operations:['parameter_set'],parameters:[
  {key:'force_strength',minimum:-20,maximum:20},{key:'force_spin',minimum:-20,maximum:20},{key:'force_radius',minimum:1,maximum:1600},
]};
function material(shared){
  const ref='expression:independent-native-scalar-scope',scene=blankScene('Actual force scalar source');
  scene.id=ref+':scene:main';const subject=entity('Continuing subject','A');subject.id=ref+':entity:a';scene.entities=[subject];
  const native={schema:'oi.expression/v1',expression_ref:ref,revision:4,title:'Native scalar scope',
    scenes:[{scene_ref:scene.id,revision:4,title:scene.name,entity_refs:[subject.id],presentation:{schema:'oi.journey-scene/v1',scene,saved:null}}],
    entities:{[subject.id]:{entity_ref:subject.id,revision:4,title:subject.name,
      subject:{subject_ref:'subject:continuing',native_owner:'ql',sources:[],readings:[],actions:[],presentation_role:'thing'},
      parameters:{glyph:{value:subject.text},kind:{value:subject.kind}}}},relations:{},
    selection:{scene_ref:scene.id,entity_ref:subject.id},provenance:[],representations:[],refinements:[]};
  if(shared){const second=clone(native.scenes[0]);second.scene_ref=ref+':scene:second';second.presentation.scene.id=second.scene_ref;native.scenes.push(second);}
  const view=kernelDocumentToJourney(native);return {view,journey:clone(view.journey),sceneId:view.journey.scenes[0].id,selected:[view.journey.scenes[0].entities[0].id]};
}

test('A02/A05 selecting a real force scalar preserves that write scope across every native Scene location',async t=>{
  for(const shared of [false,true])await t.test(shared?'shared continuing Entity':'single Scene',()=>{
    const snapshot=material(shared),radius=stageForceParameters(snapshot,descriptor,{kind:'expression'}).find(row=>row.parameter==='force_radius');
    const addresses=snapshot.view.document.scenes.map(scene=>({...radius.address,scene_ref:scene.scene_ref}));
    const original={kind:'addresses',addresses};const before=clone(snapshot);
    const command=stageForceCommandTarget(snapshot,descriptor,original,radius.target);
    assert.deepEqual(command.property_keys,['force_radius'],'the exact scalar read uses its actual native Parameter key');
    assert.equal(Object.hasOwn(command,'selector'),false,'a native issued occurrence selector requires the genuine read_source reply');
    for(const address of addresses){
      assert.equal(scopeContains(original,address,snapshot),true);
      assert.equal(scopeContains(command.scope,address,snapshot),true,'selected native radius became unreachable');
      for(const property of ['strength','spin']){
        const sibling={...address,property};
        assert.equal(scopeContains(original,sibling,snapshot),false);
        assert.equal(scopeContains(command.scope,sibling,snapshot),false,
          'reading the principal Entity expanded the Stage native write intent to a sibling force scalar');
      }
      const entityAddress={...address,component:'entity',constituent_ref:null,property:null};
      assert.equal(scopeContains(command.scope,entityAddress,snapshot),false,
        'the original force scalar scope became authority over the whole Entity');
    }
    assert.deepEqual(stageForceChoice(snapshot,descriptor,original,radius.target,.5,'radius'),
      {recipe:'force_parameters',writes:[{output_slot:'radius',parameter:'force_radius',value:{value_source:'constant',value:200}}]});
    assert.deepEqual(snapshot,before);
  });
});
