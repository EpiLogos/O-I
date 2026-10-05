import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import path from 'node:path';
import {readFileSync} from 'node:fs';
const root=path.resolve(import.meta.dirname,'..'),studioProposal=process.env.OI_PROCEDURAL_STUDIO_PROPOSAL;
const compiled=await build({absWorkingDir:root,stdin:{contents:`export * from './src/proceduralStudio';export {blankScene,entity,pin,clone} from './src/model';export {kernelDocumentToJourney} from './src/kernelDocumentBridge';export {retention,withRetention,emptyRetention,addressKey} from './src/proceduralRetention';export {initialiseShared} from './src/sharedSettings';`,resolveDir:root},plugins:studioProposal?[{name:'qualified-studio-owner-proposal',setup(b){b.onLoad({filter:/[/]proceduralStudio\.ts$/},()=>({contents:readFileSync(studioProposal,'utf8'),loader:'ts',resolveDir:path.join(root,'src')}));}}]:[],bundle:true,write:false,format:'esm',platform:'node',target:'es2022',nodePaths:[path.resolve(root,'../node_modules')]});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {blankScene,entity,pin,clone,kernelDocumentToJourney,retention,withRetention,emptyRetention,addressKey,initialiseShared,studioBasis,selectedAddresses,componentAddresses,resolveStudioScope,scopeContains,scopeBinding,buildStudioEnvelope,propertyReadings,sharedControlCapabilities,baseLayerMaterial,baseLayerControls,layerPrincipalBasis,sourceDifferences,effectiveProperty,generatedPropertyBasis,inspectComponentMaterial}=api;

// These are actual authored material + native converter/registry/operation
// builder tests. No owner port, applied receipt, physical state or ACK is
// mocked. Installed UI/consumer application is a separate required run.
function authored(){
 const ref='expression:studio-tests',first=blankScene('First'),second=blankScene('Second');
 first.id=ref+':scene:first';second.id=ref+':scene:second';
 const a=entity('Subject formation','A');a.id=ref+':entity:a';a.layers=[{id:'retained-layer',text:'A',z:.02}];a.sequence.steps=[{id:'retained-step',text:'B',shape:'text',hold:2,transition:1,position:null}];
 const b=pin({x:.1,y:0,z:0});b.id=ref+':entity:force';b.name='Force only';first.entities=[a,b];
 const c=entity('Other scene','C');c.id=ref+':entity:c';second.entities=[c];
 const d={schema:'oi.expression/v1',expression_ref:ref,revision:11,title:'Procedural unit work',scenes:[first,second].map(s=>({scene_ref:s.id,revision:11,title:s.name,entity_refs:s.entities.map(e=>e.id),presentation:{schema:'oi.journey-scene/v1',scene:s,saved:null}})),entities:Object.fromEntries([a,b,c].map(e=>[e.id,{entity_ref:e.id,revision:11,title:e.name,subject:{subject_ref:'subject:continuing',native_owner:'ql',sources:[],readings:[],actions:[],presentation_role:'thing'},parameters:{glyph:{value:e.text},kind:{value:e.kind}}}])),relations:{},selection:{scene_ref:first.id,entity_ref:a.id},provenance:[],representations:[],refinements:[]};
 const view=kernelDocumentToJourney(d),journey=clone(view.journey);return {view,journey,sceneId:journey.scenes[0].id,selected:[journey.scenes[0].entities[0].id]};
}
const operation_ref='operation:studio-controlled-input';
function control(snapshot,property='strength'){
 return propertyReadings(snapshot,{kind:'expression'},null).find(p=>p.capability.address.entity_ref===snapshot.view.bindings[snapshot.sceneId].occurrences[0].entity_ref&&p.capability.address.component==='force'&&p.capability.address.property===property);
}
function intent(snapshot,row,mode='set_base',value=.6){return {kind:'control',basis:studioBasis(snapshot),operation_ref,address:row.capability.address,target:row.capability.target,mode,value,lifetime:'persistent'};}
function material(envelope,scene_ref){return envelope.changes.find(c=>c.change==='scene_material_set'&&c.scene_ref===scene_ref)?.presentation.scene;}

test('actual native components distinguish force-only, layer and sequence identities without index addresses',()=>{
 const snapshot=authored(),a=selectedAddresses(snapshot)[0],components=componentAddresses(snapshot);
 assert.deepEqual(Object.keys(components[0].address).sort(),['expression_ref','scene_ref','entity_ref','component','constituent_ref','property'].sort(),'wire has no accidental document revision field');
 assert.ok(components.some(c=>c.address.component==='force'&&c.address.entity_ref===a.entity_ref));
 assert.ok(components.some(c=>c.address.component==='layer'&&c.address.constituent_ref==='retained-layer'));
 assert.ok(components.some(c=>c.address.component==='sequence_link'&&c.address.constituent_ref==='retained-step'));
 const before=selectedAddresses(snapshot);snapshot.journey.scenes[0].entities.reverse();snapshot.journey.scenes[0].name='Renamed';
 assert.deepEqual(selectedAddresses(snapshot),before);
 snapshot.selected=[snapshot.journey.scenes[0].entities.find(e=>e.kind==='pin').id];
 const force=componentAddresses(snapshot);assert.ok(force.some(c=>c.label.includes('Force occurrence')));assert.ok(force.some(c=>c.address.component==='force'));
});

test('principal, separate contributors and exact prime/deep locus drive native scopes',()=>{
 const snapshot=authored(),address=selectedAddresses(snapshot)[0],r=emptyRetention();
 const source={ref:"#1-2'-3-4/0'",revision:'authored-source-r7',availability:'available'};
 r.bindings=[{address,principal:{subject_ref:'subject:principal',native_owner:'ql',sources:[source]},contributors:[{subject_ref:'subject:contributor',native_owner:'ql',sources:[source]}],locus:source,tags:[]}];snapshot.journey.scenes[0]=withRetention(snapshot.journey.scenes[0],r);
 assert.equal(scopeBinding(snapshot,address).contributors[0].subject_ref,'subject:contributor');
 assert.deepEqual(resolveStudioScope(snapshot,'subject'),{kind:'subject',subject_ref:'subject:principal'});
 assert.deepEqual(resolveStudioScope(snapshot,'locus'),{kind:'locus',source_ref:source.ref,source_revision:source.revision});
 assert.notEqual(resolveStudioScope(snapshot,'locus').source_ref,source.ref.replaceAll("'",''));
 snapshot.selected=['missing-occurrence'];assert.throws(()=>resolveStudioScope(snapshot,'selection'),/not admitted/);
});

test('retained base/state layer and sequence editors resolve stable native IDs and refuse ambiguous projections',()=>{
 const snapshot=authored(),entity=snapshot.journey.scenes[0].entities[0],address=selectedAddresses(snapshot)[0];entity.sequence.steps[0].layers=[{id:'state-layer',text:'S',z:.15,source:{kind:'ascii',ascii:{text:'S  S',fontFamily:'monospace'}}}];
 const component=componentAddresses(snapshot).find(c=>c.address.component==='layer'&&c.address.constituent_ref==='state-layer');assert.ok(component);
 const read=inspectComponentMaterial(snapshot,component.address);assert.equal(read.editor.state_ref,'retained-step');assert.equal(read.editor.layer_ref,'state-layer');assert.ok(read.facts.includes('Authored depth · 0.15 stage units'));
 entity.sequence.steps.reverse();assert.equal(inspectComponentMaterial(snapshot,component.address).editor.state_ref,'retained-step');
 const state=inspectComponentMaterial(snapshot,{...address,component:'sequence_link',constituent_ref:'retained-step'});assert.equal(state.editor.state_ref,'retained-step');assert.ok(state.facts.some(s=>s.includes('1 retained state layers')));
 const base=inspectComponentMaterial(snapshot,{...address,component:'layer',constituent_ref:'retained-layer'});assert.equal(base.editor,null,'a dormant base layer must not be redirected to another state layer');
 entity.layers.push({...clone(entity.sequence.steps[0].layers[0]),z:.16});assert.equal(inspectComponentMaterial(snapshot,component.address).editor.state_ref,'retained-step');const legacy={...component.address};delete legacy.parent_ref;assert.throws(()=>inspectComponentMaterial(snapshot,legacy),/ambiguous/);
 assert.throws(()=>inspectComponentMaterial(snapshot,{...address,entity_ref:'expression:studio-tests:entity:missing'}),/absent/);
});

test('same-ID base/state layers stay exact native coordinates and whole sequence scopes cover only actual state descendants',()=>{
 const snapshot=authored(),e=snapshot.journey.scenes[0].entities[0],selected=selectedAddresses(snapshot)[0];
 e.sequence.steps[0].layers=[{...clone(e.layers[0]),text:'State geometry',z:.8,scale:2}];
 const rows=componentAddresses(snapshot).filter(c=>c.address.component==='layer'&&c.address.constituent_ref==='retained-layer');assert.equal(rows.length,2);
 const base=rows.find(c=>c.address.parent_ref===null),state=rows.find(c=>c.address.parent_ref==='retained-step');assert.ok(base&&state);assert.notEqual(addressKey(base.address),addressKey(state.address));
 assert.ok(inspectComponentMaterial(snapshot,base.address).facts.includes('Authored depth · 0.02 stage units'));assert.ok(inspectComponentMaterial(snapshot,state.address).facts.includes('Authored depth · 0.8 stage units'));assert.equal(inspectComponentMaterial(snapshot,state.address).editor.state_ref,'retained-step');
 const legacy={...base.address};delete legacy.parent_ref;assert.notEqual(addressKey(legacy),addressKey(base.address));assert.throws(()=>inspectComponentMaterial(snapshot,legacy),/ambiguous/);
 e.sequence.steps[0].layers=clone(e.layers);assert.throws(()=>inspectComponentMaterial(snapshot,legacy),/ambiguous/,'equal bytes do not merge different native parents');
 const sequence={kind:'addresses',addresses:[{...selected,component:'sequence'}]},link={kind:'addresses',addresses:[{...selected,component:'sequence_link',constituent_ref:'retained-step'}]};
 assert.equal(scopeContains(sequence,state.address,snapshot),true);assert.equal(scopeContains(sequence,base.address,snapshot),false);assert.equal(scopeContains(link,state.address,snapshot),true);assert.equal(scopeContains(link,base.address,snapshot),false);
 const reopened=clone(snapshot);assert.deepEqual(componentAddresses(reopened),componentAddresses(snapshot),'JSON reopen retains exact parent coordinates');
});

test('typed base Layer native producer edits exact continuing base text/depth/scale without modifying same-ID state material',()=>{
 const snapshot=authored(),e=snapshot.journey.scenes[0].entities[0];e.sequence.steps[0].layers=[{...clone(e.layers[0]),text:'State',z:.8,scale:2}];const before=clone(snapshot),address=componentAddresses(snapshot).find(c=>c.address.component==='layer'&&c.address.parent_ref===null).address;
 const controls=baseLayerControls(snapshot,address);assert.equal(controls.find(c=>c.address.property==='z').value,.02);
 for(const [property,value] of [['text','Human base'],['z',-.2],['scale',.5]]){
  const row=controls.find(c=>c.address.property===property),input={kind:'layer_material',basis:studioBasis(snapshot),operation_ref,address:row.address,original_value:row.value,value,principal_basis:layerPrincipalBasis(snapshot,address),source_basis:retention(snapshot.journey.scenes[0]).source_basis};
  const envelope=buildStudioEnvelope(snapshot,input),changed=material(envelope,studioBasis(snapshot).scene_ref);assert.equal(changed.entities[0].layers[0][property],value);assert.deepEqual(changed.entities[0].sequence.steps[0],e.sequence.steps[0]);assert.deepEqual(envelope.scope,{kind:'addresses',addresses:[row.address]});assert.ok(envelope.changes.some(c=>c.change==='scene_material_set'));
  assert.throws(()=>buildStudioEnvelope(snapshot,{...input,original_value:'wrong original basis'}),/original base Layer/);assert.throws(()=>buildStudioEnvelope(snapshot,{...input,principal_basis:'wrong subject prime'}),/principal/);assert.throws(()=>buildStudioEnvelope(snapshot,{...input,address:{...row.address,parent_ref:'retained-step'}}),/explicit native base/);
 }
 assert.deepEqual(snapshot,before);assert.equal(inspectComponentMaterial(snapshot,address).editor,null,'base has no state-editor redirect');
});
test('base source producer validates actual image/ASCII source law and preserves concurrent or foreign source material',()=>{
 const snapshot=authored(),e=snapshot.journey.scenes[0].entities[0],address={...componentAddresses(snapshot).find(c=>c.address.component==='layer').address,property:'source'},input={kind:'layer_material',basis:studioBasis(snapshot),operation_ref,address,original_value:undefined,value:{kind:'ascii',ascii:{text:' A  A\n  A ',fontFamily:'monospace'}},principal_basis:layerPrincipalBasis(snapshot,address),source_basis:[]};
 const envelope=buildStudioEnvelope(snapshot,input),changed=material(envelope,studioBasis(snapshot).scene_ref);assert.equal(changed.entities[0].layers[0].source.ascii.text,' A  A\n  A ');assert.deepEqual(changed.entities[0].sequence.steps,e.sequence.steps);
 assert.throws(()=>buildStudioEnvelope(snapshot,{...input,value:{kind:'image',image:{mode:'luminance',threshold:NaN,scale:1}}}),/Non-finite|Invalid image/);
 assert.throws(()=>buildStudioEnvelope(snapshot,{...input,source_basis:[{ref:"#1-2'",revision:'foreign-source',availability:'available'}]}),/source/);
 e.layers[0].source={kind:'ascii',ascii:{text:'Intervening native base source',fontFamily:'monospace'}};const before=clone(snapshot);assert.throws(()=>buildStudioEnvelope(snapshot,input),/original base Layer/);assert.deepEqual(snapshot,before);
});

test('continuing same-ID base/state Source law refuses a base-only source replacement without changing either carrier',()=>{
 const snapshot=authored(),e=snapshot.journey.scenes[0].entities[0];e.sequence.steps[0].layers=clone(e.layers);const address={...componentAddresses(snapshot).find(c=>c.address.component==='layer'&&c.address.parent_ref===null).address,property:'source'},before=clone(snapshot);
 assert.throws(()=>buildStudioEnvelope(snapshot,{kind:'layer_material',basis:studioBasis(snapshot),operation_ref,address,original_value:undefined,value:{kind:'ascii',ascii:{text:'New source',fontFamily:'monospace'}},principal_basis:layerPrincipalBasis(snapshot,address),source_basis:[]}),/Invalid state layer/);
 assert.deepEqual(snapshot,before,'the actual authored Source invariant refuses before native conversion; geometry independence is a separate tested domain');
});

test('whole scope lists properties in every actual Scene, exact component scope cannot edit siblings',()=>{
 const snapshot=authored(),whole=propertyReadings(snapshot,{kind:'expression'},null),second=snapshot.view.bindings[snapshot.journey.scenes[1].id].scene_ref;
 assert.ok(whole.some(p=>p.capability.address.scene_ref===second));
 const row=control(snapshot),scope={kind:'addresses',addresses:[row.capability.address]};
 const scoped=propertyReadings(snapshot,scope,null);assert.equal(scoped.length,1);assert.equal(addressKey(scoped[0].capability.address),addressKey(row.capability.address));
 const other=whole.find(p=>p.capability.address.scene_ref===second&&p.capability.address.property==='position.x');
 const result=buildStudioEnvelope(snapshot,intent(snapshot,other,'set_base',.3));
 assert.equal(material(result,second).entities[0].position.x,.3);assert.equal(result.scope.addresses[0].scene_ref,second);
});

test('Studio produces genuine existing native granular Changes with captured CAS and no in-place draft mutation',()=>{
 const snapshot=authored(),before=clone(snapshot),row=control(snapshot),result=buildStudioEnvelope(snapshot,intent(snapshot,row));
 assert.equal(result.expected_revision,11);assert.equal(result.operation_ref,operation_ref);assert.deepEqual(result.scope.addresses,[row.capability.address]);
 assert.equal(material(result,studioBasis(snapshot).scene_ref).entities[0].force.strength,.6);
 assert.deepEqual(snapshot,before);assert.ok(result.changes.every(c=>['scene_material_set','composition_set'].includes(c.change)));
 assert.equal(result.observations,undefined,'producer has no consumer ACK field');
 const stale=intent(snapshot,row);stale.basis.document_revision--;
 assert.throws(()=>buildStudioEnvelope(snapshot,stale),/revision changed/);assert.deepEqual(snapshot,before);
 const foreign=intent(snapshot,row);foreign.address={...row.capability.address,entity_ref:'expression:foreign:entity:a'};
 assert.throws(()=>buildStudioEnvelope(snapshot,foreign),/captured native target/);assert.deepEqual(snapshot,before);
 assert.throws(()=>buildStudioEnvelope(snapshot,intent(snapshot,row,'set_base',row.capability.max+1)),/admitted/);
});

test('takeover retains actual automation and tracks; release compiles exact dormant driver restoration',()=>{
 const snapshot=authored(),row=control(snapshot),scene=snapshot.journey.scenes[0];
 scene.automation=[{id:'native-lane',enabled:true,target:row.capability.target,type:'lfo',wave:'sine',min:0,max:.4,rate:.2,phase:0,blend:'replace',duration:1,delay:0,loop:'loop',firedAt:null}];
 scene.propertyTracks=[{id:'native-track',bind:'entity.force.strength',entityId:scene.entities[0].id,points:[{time:0,value:.1},{time:1,value:.4}]}];
 const r=emptyRetention();r.contributions=[{contribution_ref:'contribution:stable',procedure_ref:'procedure:one',output_slot:'formation',subject_refs:['subject:continuing'],occurrence_ref:row.capability.address.entity_ref,recipe_revision:'recipe-r1',owned_addresses:[selectedAddresses(snapshot)[0]],generated_basis:{force:{strength:.2}},authored_overrides:[],status:'active'}];snapshot.journey.scenes[0]=withRetention(scene,r);
 const envelope=buildStudioEnvelope(snapshot,intent(snapshot,row,'takeover',.7)),taken=material(envelope,studioBasis(snapshot).scene_ref);
 assert.equal(taken.automation.length,0);assert.equal(taken.propertyTracks.length,0);
 const retained=retention(taken);assert.equal(retained.controls[0].dormant_lanes[0].id,'native-lane');assert.equal(retained.controls[0].dormant_tracks[0].id,'native-track');assert.equal(retained.contributions[0].authored_overrides[0].value,.7);
 // Codec roundtrip is a material operation, not a simulated native reply.
 snapshot.journey.scenes[0]=taken;
 const released=material(buildStudioEnvelope(snapshot,intent(snapshot,row,'release')),studioBasis(snapshot).scene_ref);
 assert.equal(released.automation[0].id,'native-lane');assert.equal(released.propertyTracks[0].id,'native-track');assert.equal(retention(released).controls.length,0);
 assert.equal(released.entities[0].force.strength,scene.entities[0].force.strength);
 taken.automation.push({...scene.automation[0],id:'conflicting-lane'});snapshot.journey.scenes[0]=taken;
 assert.throws(()=>buildStudioEnvelope(snapshot,intent(snapshot,row,'release')),/new driver/);
});

test('whole Expression shared override uses real dotted key, registry units and composition owner',()=>{
 const snapshot=authored();initialiseShared(snapshot.journey);snapshot.journey.shared.values['field.params.speed']=.75;
 const row=sharedControlCapabilities(snapshot).find(c=>c.target==='shared:values:field.params.speed');assert.ok(row);assert.equal(row.address.scene_ref,null);assert.equal(row.address.component,'expression');assert.equal(row.address.property,'shared.values.field.params.speed');
 const before=clone(snapshot.journey),result=buildStudioEnvelope(snapshot,{kind:'shared_control',basis:studioBasis(snapshot),operation_ref,address:row.address,target:row.target,value:.9});
 assert.equal(result.changes.find(c=>c.change==='composition_set').presentation.shared.values['field.params.speed'],.9);
 assert.deepEqual(snapshot.journey,before);assert.equal(result.scope.addresses[0].property,'shared.values.field.params.speed');
 const local=propertyReadings(snapshot,{kind:'scenes',scene_refs:[studioBasis(snapshot).scene_ref]},null).find(p=>p.capability.target==='field.speed');
 assert.ok(local.shared);assert.ok(local.active.some(s=>s.includes('Expression shared override')));
 assert.throws(()=>buildStudioEnvelope(snapshot,intent(snapshot,local,'takeover',.8)),/Expression override owns/);
 assert.throws(()=>buildStudioEnvelope(snapshot,{kind:'shared_control',basis:studioBasis(snapshot),operation_ref,address:row.address,target:row.target,value:row.max+1}),/scalar domain/);
 const pointer=sharedControlCapabilities(snapshot).find(c=>c.target.startsWith('shared:pointer:'));assert.ok(pointer,'existing shared settings supply the admitted native pointer bucket');
 const pointerValue=pointer.base===pointer.min?pointer.max:pointer.min;
 const pointerEdit=buildStudioEnvelope(snapshot,{kind:'shared_control',basis:studioBasis(snapshot),operation_ref,address:pointer.address,target:pointer.target,value:pointerValue}),presentation=pointerEdit.changes.find(c=>c.change==='composition_set').presentation;
 assert.equal(presentation.shared.pointer[pointer.target.slice('shared:pointer:'.length)],pointerValue);assert.deepEqual(presentation.shared.values,snapshot.journey.shared.values);
});

test('takeover retains earlier human contribution overrides and release refuses intervening override changes',()=>{
 const snapshot=authored(),row=control(snapshot),scene=snapshot.journey.scenes[0],r=emptyRetention(),earlier={address:clone(row.capability.address),value:.35,actor:'human:prior-intervention'};
 r.contributions=[{contribution_ref:'contribution:continuing',procedure_ref:'procedure:continuing',output_slot:'force',subject_refs:['subject:continuing'],occurrence_ref:row.capability.address.entity_ref,recipe_revision:'recipe-r1',owned_addresses:[selectedAddresses(snapshot)[0]],generated_basis:{force:{strength:.1}},authored_overrides:[earlier],status:'active'}];
 snapshot.journey.scenes[0]=withRetention(scene,r);
 const taken=material(buildStudioEnvelope(snapshot,intent(snapshot,row,'takeover',.8)),studioBasis(snapshot).scene_ref);
 assert.deepEqual(retention(taken).controls[0].dormant_overrides[0].overrides,[earlier]);
 snapshot.journey.scenes[0]=taken;
 const released=material(buildStudioEnvelope(snapshot,intent(snapshot,row,'release')),studioBasis(snapshot).scene_ref);
 assert.deepEqual(retention(released).contributions[0].authored_overrides,[earlier]);
 const changed=retention(taken);changed.contributions[0].authored_overrides[0].value=.81;snapshot.journey.scenes[0]=withRetention(taken,changed);
 assert.throws(()=>buildStudioEnvelope(snapshot,intent(snapshot,row,'release')),/override|intervention/);
});

test('detach compiles existing material while retaining human intervention and generated source basis',()=>{
 const snapshot=authored(),row=control(snapshot),r=emptyRetention();r.contributions=[{contribution_ref:'contribution:stable',procedure_ref:'procedure:one',output_slot:'formation',subject_refs:['subject:continuing'],occurrence_ref:row.capability.address.entity_ref,recipe_revision:'recipe-r1',owned_addresses:[selectedAddresses(snapshot)[0]],generated_basis:{force:{strength:.2}},authored_overrides:[{address:row.capability.address,value:.7,actor:'human:owner'}],status:'active'}];snapshot.journey.scenes[0]=withRetention(snapshot.journey.scenes[0],r);
 const result=buildStudioEnvelope(snapshot,{kind:'detach',basis:studioBasis(snapshot),operation_ref,contribution_ref:'contribution:stable'}),changed=material(result,studioBasis(snapshot).scene_ref),record=retention(changed).contributions[0];
 assert.equal(record.status,'detached');assert.equal(record.authored_overrides[0].actor,'human:owner');assert.deepEqual(record.generated_basis,r.contributions[0].generated_basis);assert.equal(changed.entities.length,snapshot.journey.scenes[0].entities.length);
});

test('recorded keys use the existing track identity and explicit fractional Scene seconds',()=>{
 const snapshot=authored(),row=control(snapshot),scene=snapshot.journey.scenes[0];scene.propertyTracks=[{id:'track:continuing',bind:'entity.force.strength',entityId:scene.entities[0].id,points:[{time:0,value:.1}]}];
 const input={...intent(snapshot,row,'record',.6),record:{time_seconds:1.25,track_ref:'track:continuing'}};
 const changed=material(buildStudioEnvelope(snapshot,input),studioBasis(snapshot).scene_ref);assert.equal(changed.propertyTracks.length,1);assert.equal(changed.propertyTracks[0].id,'track:continuing');assert.deepEqual(changed.propertyTracks[0].points,[{time:0,value:.1},{time:1.25,value:.6}]);assert.deepEqual(scene.propertyTracks[0].points,[{time:0,value:.1}]);
 assert.throws(()=>buildStudioEnvelope(snapshot,{...input,record:{time_seconds:Infinity,track_ref:'track:continuing'}}),/time|position|record/i);
});

test('generated basis disclosure reads retained native Scene material, never current or registry fallback',()=>{
 const snapshot=authored(),row=control(snapshot),scene=clone(snapshot.journey.scenes[0]);scene.entities[0].force.strength=.17;
 const c={contribution_ref:'contribution:scene',procedure_ref:'procedure:scene',output_slot:'scene',subject_refs:['subject:continuing'],occurrence_ref:studioBasis(snapshot).scene_ref,recipe_revision:'recipe-r1',owned_addresses:[{...selectedAddresses(snapshot)[0],entity_ref:null,component:'scene'}],generated_basis:{schema:'oi.journey-scene/v1',scene},authored_overrides:[],status:'active'};
 assert.equal(generatedPropertyBasis(snapshot,c,row.capability.address),.17);assert.notEqual(generatedPropertyBasis(snapshot,c,row.capability.address),row.base);
 delete scene.entities[0].force.strength;assert.equal(generatedPropertyBasis(snapshot,c,row.capability.address),undefined);
 scene.id='expression:wrong:scene:wrong';assert.equal(generatedPropertyBasis(snapshot,c,row.capability.address),undefined);
});

test('scene insertion/reorder/continuation are different native operations with stable existing occurrence IDs',()=>{
 const snapshot=authored(),basis=studioBasis(snapshot),refs=snapshot.view.document.scenes.map(s=>s.scene_ref),old=clone(snapshot);
 const insert=buildStudioEnvelope(snapshot,{kind:'insert_scene',basis,operation_ref,name:'Authored next'});assert.equal(insert.changes.filter(c=>c.change==='scene_create').length,1);assert.equal(insert.scope.kind,'expression');
 const reorder=buildStudioEnvelope(snapshot,{kind:'reorder_scenes',basis,operation_ref,scene_refs:refs.slice().reverse()});assert.deepEqual(reorder.changes.find(c=>c.change==='scene_reorder').scene_refs,refs.slice().reverse());
 assert.throws(()=>buildStudioEnvelope(snapshot,{kind:'reorder_scenes',basis,operation_ref,scene_refs:[refs[0],refs[0]]}),/exactly once/);
 const transition=buildStudioEnvelope(snapshot,{kind:'transition',basis,operation_ref,to_scene_ref:refs[1],policy:'hold',cursor:19});assert.equal(transition.changes.find(c=>c.change==='focus').scene_ref,refs[1]);assert.equal(retention(material(transition,refs[0])).scene_flow[0].policy,'hold');assert.equal(retention(material(transition,refs[0])).scene_flow[0].cursor,19);
 assert.deepEqual(snapshot,old,'preview performs no mutation, focus or clock advance');
});

test('source diff preserves unavailable/current/saved distinctions; absent effective observations stay unobserved',()=>{
 const snapshot=authored(),row=control(snapshot),r={ref:'source:fold',revision:'r1',availability:'available'};
 assert.deepEqual(sourceDifferences([r],undefined),[{saved:r,current:null}]);assert.equal(sourceDifferences([r],[{...r,revision:'r2'}])[0].saved.revision,'r1');assert.equal(sourceDifferences([r],[{...r,availability:'withheld'}])[0].current.availability,'withheld');
 assert.equal(effectiveProperty(null,row.capability.address,11),null);
 assert.ok(propertyReadings(snapshot,{kind:'expression'},null).every(p=>p.effective===null),'authored base values are not fabricated native effect');
});

test('scalar disclosure refuses counterfeit, malformed and obsolete consumer wire data',()=>{
 const snapshot=authored(),address=control(snapshot).capability.address,p={owner:'counterfeit-test-input',instance_ref:'not-an-admitted-host',required_generation:7,targets:[address]},o={owner:p.owner,instance_ref:p.instance_ref,generation:7,document_revision:11,operation_ref:'not-an-owner-receipt',cursor:1,targets:[address],effective:{values:[{address,value:{metadata:'not a scalar'}}]}},reading={document_revision:11,effective_observations:[o]};
 assert.equal(effectiveProperty(reading,address,11),null,'missing actual host registry must remain unobserved');
 assert.equal(effectiveProperty(reading,address,11,[p]),null,'arbitrary blob cannot become scalar observation');
 o.effective={values:{bad:'shape'}};assert.equal(effectiveProperty(reading,address,11,[p]),null);
 o.effective={values:[{address:null,value:.4}]};assert.equal(effectiveProperty(reading,address,11,[p]),null);
 o.effective={values:[{address,value:.4}]};o.generation=6;assert.equal(effectiveProperty(reading,address,11,[p]),null);
 o.generation=7;o.instance_ref='older-instance';assert.equal(effectiveProperty(reading,address,11,[p]),null);
 o.instance_ref=p.instance_ref;o.document_revision=10;assert.equal(effectiveProperty(reading,address,11,[p]),null);
 o.document_revision=11;o.effective.values[0].value=Infinity;assert.equal(effectiveProperty(reading,address,11,[p]),null);
 // These deliberately invalid wire inputs detect refusal only. The positive
 // native observation is exercised by the actual joined browser run below.
});

test('validate executed native Studio/browser receipts and actual receiving measurements', {skip:!process.env.OI_PROCEDURAL_STUDIO_EVIDENCE&&'UNEXECUTED: requires joined native Studio/browser evidence'},async()=>{
 const {readFile}=await import('node:fs/promises'),receipt=JSON.parse(await readFile(process.env.OI_PROCEDURAL_STUDIO_EVIDENCE,'utf8'));
 assert.equal(receipt.schema,'oi.procedural-studio-browser-evidence/v1');assert.equal(receipt.execution,'passed');assert.equal(receipt.mocked_transport,false);assert.ok(receipt.actual_native_expression_ref?.startsWith('expression:'));assert.deepEqual(receipt.page_errors,[]);
 assert.deepEqual(receipt.checks.map(c=>c.name).sort(),['actual_native_host_and_acceptance_work','paused_studio_navigation_preserves_resident_particles','human_preview_is_actual_native_preparation','paused_human_apply_reaches_actual_field_consumer','typed_control_survives_close_reopen_and_native_adoption','native_retry_is_same_retained_application','agent_stale_and_wrong_subject_refused_without_effect','running_agent_and_human_use_same_native_target_and_consumer','native_scalar_units_match_actual_registry_and_field'].sort());assert.ok(receipt.checks.every(c=>c.passed===true));
 const {validateOperation}=await import('data:text/javascript;base64,'+Buffer.from((await build({absWorkingDir:root,stdin:{contents:`export {validateOperation} from './src/proceduralProtocol';`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',nodePaths:[path.resolve(root,'../node_modules')]})).outputFiles[0].text).toString('base64'));
 assert.equal(receipt.native_operations.length,4);for(const raw of receipt.native_operations){const o=validateOperation(raw);assert.equal(o.status,'applied');assert.equal(o.envelope.expression_ref,receipt.actual_native_expression_ref);assert.ok(o.envelope.participants.length&&o.observations.length);for(const c of o.envelope.changes)if(c.change==='scene_material_set'&&c.presentation.scene.procedural)assert.deepEqual(c.presentation.scene.procedural.operations,[],'prepared intent recursively embedded old receipts');}
 assert.deepEqual(receipt.native_operations[0].targets,receipt.native_operations[1].targets,'human and agent native targets differ');
 const m=receipt.resident_effect;assert.deepEqual(m.before_paused_navigation.positions,m.after_paused_navigation.positions);assert.equal(m.before_paused_navigation.seeds,m.after_paused_navigation.seeds);
 assert.ok(m.after_running.steps>m.before_running.steps);assert.equal(m.before_running.positions.length,m.after_running.positions.length);const differences=m.before_running.positions.map((v,i)=>Math.abs(v-m.after_running.positions[i]));assert.ok(differences.every(Number.isFinite));const max=differences.reduce((largest,d)=>Math.max(largest,d),0),rms=Math.sqrt(differences.reduce((s,d)=>s+d*d,0)/differences.length);assert.ok(max>1e-7);assert.ok(Math.abs(max-m.max_position_delta)<1e-12);assert.ok(Math.abs(rms-m.rms_position_delta)<1e-12);
 assert.equal(receipt.retry.repeated,true);assert.equal(receipt.retry.operation.envelope.operation_ref,receipt.native_operations[0].envelope.operation_ref);
 const units=receipt.checks.find(c=>c.name==='native_scalar_units_match_actual_registry_and_field').evidence;assert.ok(units.native_factor>1);assert.ok(Math.abs(units.actual_field_value-units.authored_value*units.native_factor)<1e-5);assert.ok(units.effective_rows.some(row=>Math.abs(row.value-units.authored_value)<1e-6));
});
