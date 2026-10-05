import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {performance} from 'node:perf_hooks';
const compiled=await build({stdin:{contents:"export * from './materialFold.ts';export {makeFormation,DEFAULT_SEQUENCE} from './fieldModel.ts';export {sampleImageSource,sampleAlphaSource,computeInkField} from './sourceSampling.ts';export {DEFAULT_GLYPH_VOLUME} from './glyphVolume.ts';",resolveDir:fileURLToPath(new URL('../src/engine/',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
// Controlled analytic input exercises production geometry, never claims an
// executed native producer or physical/device reception.
export function analyticPlan(treatment='glyph-mask') {
 const cuts=[-1,-.5,0,.5,1],coord={source_ref:'#3-2-1-1-1',face:'bimba'};
 return {schema:api.MATERIAL_FOLD_SCHEMA,topology_ref:api.MATERIAL_TOPOLOGY,recipe_ref:'controlled:analytic-square',recipe_revision:'1',material_treatment:treatment,
  event_ref:'controlled:analytic-event',subject_ref:'controlled:analytic-subject',source_coordinate:coord,source_generation:1,source_revision:'controlled:source',domain_revision:'controlled:domain',registry_revision:'controlled:registry',
  stage_units_per_material_unit:200,metres_per_material_unit:.1,
  panels:Array.from({length:4},(_,i)=>({id:`panel-${i}`,bounds:[cuts[i],cuts[i+1],-1,1],parent:i?`panel-${i-1}`:null,crease:i?i-1:null})),
  creases:Array.from({length:3},(_,i)=>({id:`site-${['X','Y','Z'][i]}`,site_index:i,axis_start:[cuts[i+1],-1,0],axis_end:[cuts[i+1],1,0]})),
  crease_angles_rad:[Math.PI/8,Math.PI/8,Math.PI/8],site_velocities_deg10:[100,100,100],pose_axis:[1,0,0],pose_angle_rad:0,
  pose_projection:{rotation_slot:0,rotation_degrees:0,slot_degrees:45,pose_ordinal:0},construction_standing:'controlled analytic input; no native execution claim',
  native_state:{schema:'ql.m3-state/v1',subject_ref:'controlled:analytic-subject',identity:{event_ref:'controlled:analytic-event',profile_generation:1},source_revision:'controlled:source',domain_revision:'controlled:domain',registry_revision:'controlled:registry',form:{codon:{ref:coord.source_ref},angles_deg10:[225,225,225],velocities_deg10:[100,100,100],matrix_axis:0,pose:0,pose_ordinal:0}}};
}
function admitted(plan=analyticPlan()) {return api.admitNativeMaterialFold(plan,plan);}
function material(points,extra={}) {return api.retainMaterialSamples({source:{reference:'controlled:actual-RGBA',revision:'1',kind:'text'},allocationRef:'controlled:allocation',layerId:'layer-a',samplingSignature:'text|font-controlled|volume|topology-1',treatment:'glyph-mask',stageUnitsPerMaterialUnit:200,targetData:Float32Array.from(points.flatMap(p=>[...p,.8])),sampleCount:points.length,...extra});}
function nativeMaterial(native,plan) {
 const groups=new Map();for(const sample of native.samples){const key=JSON.stringify([sample.source_ref,sample.source_revision,sample.layer_ref]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(sample);}
 const layers=[...groups.values()].map(samples=>api.retainMaterialSamples({source:{reference:samples[0].source_ref,revision:samples[0].source_revision,kind:'volumetric'},allocationRef:'controlled:sampler-allocation',layerId:samples[0].layer_ref,samplingSignature:'native emitted controlled retained sample fixture',treatment:plan.material_treatment,stageUnitsPerMaterialUnit:plan.stage_units_per_material_unit,
  targetData:Float32Array.from(samples.flatMap(sample=>[...sample.rest_material.map(v=>v*plan.stage_units_per_material_unit),sample.density])),sampleCount:samples.length}));
 return api.retainLayeredMaterial({source:{reference:'controlled:fixture-layered-material',revision:'1',kind:'volumetric'},allocationRef:'controlled:fixture-body',bodyRef:'controlled:fixture-layered-body',layers});
}
const control=angles=>({sourceGeneration:1,creaseAnglesRad:angles,poseAxis:[1,0,0],poseAngleRad:0});
const xyz=(array,index)=>Array.from(array.slice(index*4,index*4+3));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const ABS_TOLERANCE=4e-5,REL_TOLERANCE=3e-7;
test('rigid panels retain hinge axes, intra-panel lengths, signed orientation and depth',()=>{
 const points=[[-100,-180,0],[-100,180,0],[-40,-90,-12],[-40,70,12],[30,-90,-12],[30,70,12],[150,-90,-12],[150,70,12]];
 const m=material(points),prepared=api.prepareFold(m,admitted());
 let max=0,sum=0,count=0;
 for(let angle=-Math.PI;angle<=Math.PI;angle+=Math.PI/24) {
  const target=api.evaluateFold(prepared,control([angle,angle/2,-angle/3]));
  for(const [a,b] of [[0,1],[2,3],[4,5],[6,7]]) {const error=Math.abs(distance(xyz(target,a),xyz(target,b))-distance(points[a],points[b]));max=Math.max(max,error);sum+=error*error;count++;
   assert.ok(error<=ABS_TOLERANCE+REL_TOLERANCE*distance(points[a],points[b]));}
  assert.deepEqual(xyz(target,0),points[0]);assert.deepEqual(xyz(target,1),points[1]);
 }
 const directed=api.evaluateFold(prepared,control([Math.PI/2,0,0]));assert.ok(directed[2*4+2]<0,'positive right-hand y hinge folds right panel toward -z');
 console.log(JSON.stringify({scope:'CPU controlled rigid-panel geometry',samples:points.length,comparisons:count,maxDistanceErrorStageUnits:max,rmsDistanceErrorStageUnits:Math.sqrt(sum/count),absoluteTolerance:ABS_TOLERANCE,relativeTolerance:REL_TOLERANCE}));
});
test('parent transforms compose articulated crease axes in source order',()=>{
 const prepared=api.prepareFold(material([[200,0,0]]),admitted());
 const target=api.evaluateFold(prepared,control([Math.PI/2,Math.PI/2,Math.PI/2]));
 assert.ok(distance(xyz(target,0),[-200,0,0])<ABS_TOLERANCE);
});
test('fixed allocation preserves samples/layer/depth through progress and caller transforms',()=>{
 const m=material([[150,40,16]],{layerZ:20}),prepared=api.prepareFold(m,admitted()),ids=[...m.sampleIds],key=m.preparationKey;
 const zero=api.evaluateFold(prepared,control([0,0,0]));assert.deepEqual(xyz(zero,0),[150,40,36]);
 for(let i=0;i<200;i++) {api.evaluateFold(prepared,control([i/100,-i/200,i/400]),zero);assert.deepEqual(m.sampleIds,ids);assert.equal(m.preparationKey,key);}
 assert.equal(m.layerId,'layer-a');assert.equal(m.sampleCount,1);
 assert.throws(()=>api.evaluateFold(prepared,{...control([0,0,0]),sourceGeneration:2}),/stale/);
});
test('admitted source and prepared plan are frozen, wrong subject/prime/pose/source refused',()=>{
 const p=analyticPlan(),admit=admitted(p);assert.throws(()=>{admit.native_state.form.angles_deg10[0]=0;},TypeError);
 const prepared=api.prepareFold(material([[10,10,2]]),admit);assert.throws(()=>{prepared.plan.source_generation=9;},TypeError);
 for(const mutate of [p=>p.subject_ref='wrong',p=>p.source_revision='wrong',p=>p.source_generation=2,
  p=>p.source_coordinate.face='pratibimba',p=>p.pose_axis=[0,1,0],p=>p.pose_angle_rad=1,p=>p.crease_angles_rad[0]*=-1]) {
  const bad=analyticPlan();mutate(bad);assert.throws(()=>api.admitNativeMaterialFold(bad,analyticPlan()));
 }
 assert.throws(()=>api.prepareFold(material([[10,10,2]]),analyticPlan()),/not admitted/);
});
test('source/volume/content changes invalidate preparation but retain explicit slot correspondence',()=>{
 const a=material([[10,10,2]]),b=material([[10,10,3]]),c=material([[10,10,2]],{samplingSignature:'font-controlled|volume-depth-3'});
 assert.notEqual(a.preparationKey,b.preparationKey);assert.notEqual(a.preparationKey,c.preparationKey);
 assert.deepEqual(api.materialCorrespondence(a,b).pairs,[{id:a.sampleIds[0],before:0,after:0}]);
 assert.throws(()=>api.materialCorrespondence(a,material([[10,10,2]],{source:{reference:'another-source',revision:'1',kind:'text'}})),/cross-source/);
 const expanded=material([[10,10,2],[20,20,2]]);assert.equal(api.materialCorrespondence(a,expanded).created.length,1);
});
test('actual image and ASCII ink sampling/volume feed retained fold geometry',()=>{
 const pixels=new Uint8Array(32*32*4);for(let y=4;y<28;y++)for(let x=10;x<22;x++) {const i=(y*32+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=255;}
 for(const [kind,sample] of [['image',api.sampleImageSource],['ascii',api.sampleAlphaSource]]) {
  const source=sample(pixels,32,32,{volume:{...api.DEFAULT_GLYPH_VOLUME,enabled:true,depth:16,jitter:0}});assert.equal(source.analysis.fallback,false);
  const target=Float32Array.from(source.candidates.flatMap(c=>[c.x,c.y,c.hz??0,c.density]));
  const m=api.retainMaterialSamples({source:{reference:`controlled:${kind}-pixels`,revision:'1',kind},allocationRef:'allocation-1',layerId:'ink-layer',samplingSignature:JSON.stringify(source.analysis),treatment:'glyph-mask',stageUnitsPerMaterialUnit:200,targetData:target,sampleCount:source.candidates.length});
  const deformed=api.evaluateFold(api.prepareFold(m,admitted()),control([.5,.1,-.2]));assert.equal(deformed.length,target.length);assert.deepEqual(m.sampleIds,api.retainMaterialSamples({source:m.source,allocationRef:m.allocationRef,layerId:m.layerId,samplingSignature:m.samplingSignature,treatment:m.treatment,stageUnitsPerMaterialUnit:200,targetData:target,sampleCount:m.sampleCount}).sampleIds);
  assert.ok(deformed.some((v,i)=>i%4===2&&v!==target[i]));
 }
});
test('layered material retains each exact source, sample identity and laminated depth',()=>{
 const a=material([[10,10,2]],{layerId:'layer-a',layerZ:-20}),b=material([[10,10,2]],{layerId:'layer-b',layerZ:20,source:{reference:'controlled:second-image',revision:'3',kind:'image'}});
 const joined=api.retainLayeredMaterial({source:{reference:'controlled:actual-body',revision:'1',kind:'volumetric'},allocationRef:'body-1',bodyRef:'native-layered-body',layers:[a,b]});
 assert.deepEqual(joined.sampleIds,[...a.sampleIds,...b.sampleIds]);assert.deepEqual(joined.layers.map(l=>l.source.reference),[a.source.reference,b.source.reference]);
 const targets=api.evaluateFold(api.prepareFold(joined,admitted()),control([0,0,0]));assert.equal(targets[2],-18);assert.equal(targets[6],22);
 assert.throws(()=>api.retainLayeredMaterial({source:joined.source,allocationRef:'body-1',bodyRef:'native-layered-body',layers:[a,a]}),/duplicate/);
});
test('sheet carrier spans square, preserves ink aspect/markings and seeded thickness',()=>{
 const pixels=new Uint8Array(32*32*4);for(let y=8;y<24;y++)for(let x=14;x<18;x++)pixels[(y*32+x)*4+3]=255;
 const inkField=api.computeInkField(pixels,32,32,{mode:'alpha'}),input={source:{reference:'controlled:sheet-ink',revision:'1',kind:'ascii'},allocationRef:'sheet-1',layerId:'sheet-layer',samplingSignature:'alpha-source|sheet-slab-16',stageUnitsPerMaterialUnit:200,sampleCount:1600,inkField,seed:416,carrierDensity:.2,volume:{...api.DEFAULT_GLYPH_VOLUME,enabled:true,depth:16,jitter:0,profile:'slab'}};
 const a=api.retainSheetCarrier(input),b=api.retainSheetCarrier(input),p=api.prepareFold(a,admitted(analyticPlan('sheet')));
 const target=api.evaluateFold(p,control([0,0,0]));assert.equal(a.preparationKey,b.preparationKey);assert.deepEqual(a.sampleIds,b.sampleIds);
 assert.ok(target.filter((v,i)=>i%4===3&&v<.3).length>1000);assert.ok(target.filter((v,i)=>i%4===3&&v>.9).length>100);
 assert.ok(target.filter((v,i)=>i%4===0).some(v=>v<-190)&&target.filter((v,i)=>i%4===0).some(v=>v>190));
 assert.ok(target.filter((v,i)=>i%4===2).some(v=>v!==0));
});
test('existing entity sequence supplies hold, eased transition, seek and interruption',()=>{
 const p=api.prepareFold(material([[150,40,16]]),admitted()),entity=api.makeFormation({id:'sequence-entity'});
 entity.sequence={...api.DEFAULT_SEQUENCE,advance:'time',hold:1,transition:2,easing:'smoothstep',links:[{id:'a',shape:{kind:'glyph',text:'A'}},{id:'b',shape:{kind:'glyph',text:'A'}}]};
 const states=new Map([['a',{creaseAnglesRad:[0,0,0],poseAngleRad:0}],['b',{creaseAnglesRad:[1,2,3],poseAngleRad:Math.PI}]]);
 const resolve=t=>api.resolveFoldSequence(p,entity,t,0,0,.3,states);
 assert.deepEqual(resolve(.5).control.creaseAnglesRad,[0,0,0]);resolve(2).control.creaseAnglesRad.forEach((v,i)=>assert.ok(Math.abs(v-[.5,1,1.5][i])<1e-12));
 assert.deepEqual(resolve(2),resolve(2));const held=api.interruptFoldSequence(resolve(2),2);
 assert.deepEqual(api.resolveFoldSequence(p,entity,50,0,0,.3,states,held).control,resolve(2).control);
 assert.equal(resolve(4).sequence.linkIndex,1);
});
test('gaps, cycles, disconnected panels and degenerate axes fail before evaluation',()=>{
 for(const mutate of [p=>p.panels[2].parent='missing',p=>p.panels[1].parent='panel-2',p=>p.panels[2].bounds[0]=.1,p=>p.creases[0].axis_end=p.creases[0].axis_start,
  p=>p.creases[0].axis_start[0]+=.1,p=>p.creases[1].id=p.creases[0].id]) {
  const bad=analyticPlan();mutate(bad);assert.throws(()=>api.prepareFold(material([[10,10,2]]),admitted(bad)));
 }
});
test('explicit physical correspondence receives displacement once and refuses cut/stale links',()=>{
 const m=material([[100,10,2]]),fold=api.prepareFold(m,admitted()),plan=fold.plan;
 const binding={eventRef:plan.event_ref,subjectRef:plan.subject_ref,sourceGeneration:1,sourceRevision:plan.source_revision,sourceCoordinate:plan.source_coordinate,preparationRef:'controlled:body-1',stateRef:'controlled:body-state',bodyRevision:1,nodeIds:[1,12],metresPerMaterialUnit:.1,sampleNodeWeights:[[{nodeId:1,weight:.25},{nodeId:12,weight:.75}]]};
 const projection=api.prepareBodyProjection(fold,binding),commanded=api.evaluateFold(fold,control([0,0,0])),before=commanded.slice();
 const observed={eventRef:plan.event_ref,preparationRef:binding.preparationRef,stateRef:binding.stateRef,bodyRevision:1,sampleCursor:128,nodeIds:[1,12],displacementsMetres:[[0,0,.001],[0,0,.003]]};
 const actual=api.applyBodyDisplacements(projection,commanded,observed,128);assert.equal(actual[2],7);assert.deepEqual(commanded,before);
 assert.deepEqual(api.applyBodyDisplacements(projection,commanded,observed,128),actual);
 assert.throws(()=>api.applyBodyDisplacements(projection,commanded,observed,128,new Float32Array(commanded.buffer,commanded.byteOffset,commanded.length)),/separate/);assert.deepEqual(commanded,before);
 assert.throws(()=>api.applyBodyDisplacements(projection,commanded,{...observed,preparationRef:'cut'},128),/disconnected/);
 assert.throws(()=>api.applyBodyDisplacements(projection,commanded,observed,129),/stale/);
 assert.throws(()=>api.prepareBodyProjection(fold,{...binding,sampleNodeWeights:[[]]}),/weights/);
 assert.throws(()=>{projection.binding.sampleNodeWeights[0][0].weight=1;},TypeError);
});
test('declared CPU material workload measures retained updates without raster/reseed calls',()=>{
 const allocated=4096,points=Array.from({length:allocated},(_,i)=>[(i%64+.5)/64*400-200,(Math.floor(i/64)+.5)/64*400-200,(i%7-3)*2]);
 const prepared=Array.from({length:16},(_,formation)=>{
  const body=formation<4?api.retainLayeredMaterial({source:{reference:`controlled:workload-body-${formation}`,revision:'1',kind:'volumetric'},allocationRef:`workload-${formation}`,bodyRef:`body-${formation}`,layers:Array.from({length:4},(_,layer)=>material(points.slice(layer*1024,(layer+1)*1024),{allocationRef:`workload-${formation}-layer-${layer}`,layerId:`layer-${layer}`,layerZ:layer*10}))}):material(points,{allocationRef:`workload-${formation}`});
  return {fold:api.prepareFold(body,admitted()),target:new Float32Array(allocated*4)};
 });
 const elapsed=[];for(let frame=0;frame<100;frame++) {const begin=performance.now();for(const p of prepared)api.evaluateFold(p.fold,control([frame/50,frame/100,-frame/80]),p.target);elapsed.push(performance.now()-begin);}
 elapsed.sort((a,b)=>a-b);console.log(JSON.stringify({scope:'CPU analytic evaluator; no installed frame/native-control/audio latency claim',formations:16,multiLayerFormations:4,samplesPerFormation:allocated,totalSamples:allocated*16,iterations:100,medianMs:elapsed[50],p95Ms:elapsed[95],p99Ms:elapsed[99],rasterCallsFromEvaluator:0,reseedCallsFromEvaluator:0}));
 for(const p of prepared)assert.equal(p.fold.material.sampleCount,allocated);
});
test('real native M3 producer fixture is consumed without scene-side symbolic reconstruction',{skip:!process.env.QL_MATERIAL_FOLD_FIXTURE?'Requires actual native emitted fixture from cargo test m3_material_fold':false},async()=>{
 const native=JSON.parse(await readFile(process.env.QL_MATERIAL_FOLD_FIXTURE,'utf8')),plan=api.admitNativeMaterialFold(native.plan,native.expected);
 assert.equal(native.receipt.status,'applied');assert.deepEqual(plan.native_state,native.receipt.after);
 const m=nativeMaterial(native,plan);
 assert.deepEqual(m.sampleIds,native.samples.map(s=>s.id));
 const targets=api.evaluateFold(api.prepareFold(m,plan),api.nativeFoldControl(plan));assert.equal(targets.length,native.samples.length*4);
 let max=0,sum=0,count=0;for(const [i,target] of native.native_targets.entries()) {
  assert.equal(target.id,m.sampleIds[i]);assert.equal(target.source_ref,native.samples[i].source_ref);assert.equal(target.layer_ref,native.samples[i].layer_ref);
  for(let axis=0;axis<3;axis++){const error=Math.abs(targets[4*i+axis]-target.local_stage[axis]);max=Math.max(max,error);sum+=error*error;count++;assert.ok(error<=ABS_TOLERANCE+REL_TOLERANCE*Math.abs(target.local_stage[axis]),`native/consumer mismatch for ${target.id} axis ${axis}`);}
  assert.ok(Math.abs(targets[4*i+3]-target.density)<1e-7);
 }
 console.log(JSON.stringify({scope:'executed native M3 operation to independent TS fold geometry; controlled rest samples; no live body/audio claim',nativeReceiptGeneration:native.receipt.after.identity.profile_generation,samples:native.samples.length,components:count,maxErrorStageUnits:max,rmsErrorStageUnits:Math.sqrt(sum/count),absoluteTolerance:ABS_TOLERANCE,relativeTolerance:REL_TOLERANCE}));
 assert.equal(plan.native_state.tarot.card_id,native.plan.native_state.tarot.card_id);
 assert.deepEqual(plan.native_state.clock,native.plan.native_state.clock);
 for(const mutate of [p=>p.subject_ref='wrong-native-subject',p=>p.source_coordinate.face=p.source_coordinate.face==='bimba'?'pratibimba':'bimba',p=>p.source_revision='wrong-native-source']) {
  const bad=structuredClone(native.plan);mutate(bad);assert.throws(()=>api.admitNativeMaterialFold(bad,native.expected));
 }
});
test('actual native source frames admit retained material correspondence and detect severed geometry',{skip:!process.env.QL_MATERIAL_FOLD_FIXTURE?'Requires actual native emitted source/body geometry':false},async()=>{
 const native=JSON.parse(await readFile(process.env.QL_MATERIAL_FOLD_FIXTURE,'utf8')),plan=api.admitNativeMaterialFold(native.plan,native.expected),m=nativeMaterial(native,plan),payload=native.body_material;
 const prepared=api.prepareNativeBodyMaterial(m,plan,payload,native.performance.physical_body,native.performance.source_form_recipe);assert.deepEqual(prepared.native.body,native.performance.physical_body);
 assert.deepEqual(prepared.native.body.form,plan.native_state.form);assert.deepEqual(prepared.native.body.clock,plan.native_state.clock);
 assert.throws(()=>{prepared.native.samples[0].node_weights[0].weight=1;},TypeError);
 for(const mutate of [p=>p.samples[0].sample.id='disconnected',p=>p.samples[0].node_weights[0].weight+=.01,p=>p.samples[0].normal[0]+=.1,
  p=>p.body.source_coordinate.face='bimba',p=>p.bounds.max_displacement_metres*=2,p=>p.samples[0].depth_metres+=.1,p=>p.body_recipe.frame_side_metres*=1.1]) {
  const bad=structuredClone(payload);mutate(bad);assert.throws(()=>api.prepareNativeBodyMaterial(m,plan,bad,native.performance.physical_body,native.performance.source_form_recipe));
 }
});
test('actual native Performance Engine/body snapshot produces retained visible material at the same PCM cursor',{skip:!(process.env.QL_MATERIAL_FOLD_FIXTURE&&process.env.QL_MATERIAL_PHYSICAL_FIXTURE)?'Requires qualified actual native producer and actual Performance Engine/PhysicalBody observation':false},async()=>{
 const native=JSON.parse(await readFile(process.env.QL_MATERIAL_FOLD_FIXTURE,'utf8')),observed=JSON.parse(await readFile(process.env.QL_MATERIAL_PHYSICAL_FIXTURE,'utf8'));
 assert.equal(observed.schema,'ql.m3-material-observation-fixture/v1');assert.ok(observed.measurements.nonzero_output_samples>0&&observed.measurements.pcm_peak>0&&observed.measurements.pcm_rms>0);
 assert.equal(observed.measurements.max_visible_error_metres<1e-12,true);assert.equal(observed.measurements.max_pickup_error_linear<1e-6,true);
 const plan=api.admitNativeMaterialFold(native.plan,native.expected),m=nativeMaterial(native,plan),prepared=api.prepareNativeBodyMaterial(m,plan,native.body_material,native.performance.physical_body,native.performance.source_form_recipe);
 const zero=observed.snapshots[0];assert.equal(zero.samples_elapsed,'0');const initial=api.evaluateNativeBodyMaterial(prepared,zero,'0');
 let max=0,sum=0,count=0;for(const [i,sample] of prepared.native.samples.entries())for(let axis=0;axis<3;axis++){const error=Math.abs(initial[4*i+axis]-sample.local_stage[axis]);max=Math.max(max,error);sum+=error*error;count++;assert.ok(error<=ABS_TOLERANCE+REL_TOLERANCE*Math.abs(sample.local_stage[axis]));}
 let moved=false;for(const snapshot of observed.snapshots.slice(1)) {const target=api.evaluateNativeBodyMaterial(prepared,snapshot,snapshot.samples_elapsed);moved ||= target.some((value,i)=>i%4!==3&&value!==initial[i]);assert.deepEqual(api.evaluateNativeBodyMaterial(prepared,snapshot,snapshot.samples_elapsed),target);}
 assert.ok(moved,'retained material must receive actual body displacement');assert.deepEqual(m.sampleIds,native.samples.map(s=>s.id));
 const current=observed.snapshots[1];for(const mutate of [p=>p.subject_ref='wrong',p=>p.pratibimba=!p.pratibimba,p=>p.preparation_ref='cut',p=>p.source_revision='stale',p=>p.node_identity[0]=999,p=>p.visible_positions_metres[0][0]+=1]) {const bad=structuredClone(current);mutate(bad);assert.throws(()=>api.evaluateNativeBodyMaterial(prepared,bad,current.samples_elapsed));}
 assert.throws(()=>api.evaluateNativeBodyMaterial(prepared,current,'0'),/stale/);
 console.log(JSON.stringify({scope:'executed native M1/M2/M3 and same actual P body/PCM -> retained material consumer; no installed app/device claim',snapshots:observed.snapshots.map(s=>s.samples_elapsed),bodyRevision:current.body_revision,sourceGeneration:current.source_generation,maxRestProjectionErrorStageUnits:max,rmsRestProjectionErrorStageUnits:Math.sqrt(sum/count),absoluteTolerance:ABS_TOLERANCE,relativeTolerance:REL_TOLERANCE,nativeMeasurements:observed.measurements}));
});
