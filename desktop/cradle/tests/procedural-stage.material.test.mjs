import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as fold from '../expressions-app/src/engine/materialFold.ts';
import {sampleAlphaSource,computeInkField} from '../expressions-app/src/engine/sourceSampling.ts';
import {DEFAULT_GLYPH_VOLUME} from '../expressions-app/src/engine/glyphVolume.ts';

// CPU sampler and retained allocation tests execute production consumers.
// The transported native-plan cases require an actual native-produced artifact.
const pixels=new Uint8Array(48*48*4);
for(let y=5;y<43;y++)for(let x=18;x<30;x++)pixels[(y*48+x)*4+3]=255;
const sampled=sampleAlphaSource(pixels,48,48,{volume:{...DEFAULT_GLYPH_VOLUME,enabled:true,depth:16,jitter:0}});
const targets=Float32Array.from(sampled.candidates.flatMap(p=>[p.x,p.y,p.hz??0,p.density]));
const input={source:{reference:'independent:authored-alpha-mark',revision:'1',kind:'ascii'},
  allocationRef:'independent:actual-sampler-allocation',layerId:'ink',samplingSignature:JSON.stringify(sampled.analysis),
  treatment:'glyph-mask',stageUnitsPerMaterialUnit:200,targetData:targets,sampleCount:sampled.candidates.length};

test('A11 actual alpha sampler yields retained source/layer/allocation identities without fallback',()=>{
  assert.equal(sampled.analysis.fallback,false);assert.ok(sampled.candidates.length>32);
  const m=fold.retainMaterialSamples(input);assert.equal(m.sampleCount,sampled.candidates.length);
  assert.equal(new Set(m.sampleIds).size,m.sampleCount);
  for(let i=0;i<m.sampleCount;i++)assert.deepEqual(JSON.parse(m.sampleIds[i]),[input.source.reference,input.layerId,input.allocationRef,i]);
  assert.throws(()=>{m.sampleIds[0]='replaced';},TypeError);
  assert.throws(()=>{m.source.revision='replaced';},TypeError);
});

test('A11 source/depth/density/sampling changes invalidate preparation while named slots retain identity',()=>{
  const before=fold.retainMaterialSamples(input);
  for(const index of [0,1,2,3]){
    const edited=targets.slice();edited[index]+=index===3?-0.1:0.25;
    const after=fold.retainMaterialSamples({...input,targetData:edited});
    assert.notEqual(before.preparationKey,after.preparationKey);assert.deepEqual(before.sampleIds,after.sampleIds);
  }
  const after=fold.retainMaterialSamples({...input,source:{...input.source,revision:'2'}});
  assert.notEqual(before.preparationKey,after.preparationKey);
  assert.deepEqual(fold.materialCorrespondence(before,after).pairs.map(p=>p.id),before.sampleIds);
  const changedLayer=fold.retainMaterialSamples({...input,layerId:'other-layer'});
  assert.throws(()=>fold.materialCorrespondence(before,changedLayer),/cross-source correspondence/);
});

test('A11 invalid count/nonfinite density/source bounds refuse before retained preparation',()=>{
  for(const value of [0,-1,1.5,fold.MAX_MATERIAL_SAMPLES+1])assert.throws(()=>fold.retainMaterialSamples({...input,sampleCount:value}));
  for(const [index,value] of [[0,Infinity],[1,NaN],[3,-0.1],[3,1.1]]){
    const broken=targets.slice();broken[index]=value;assert.throws(()=>fold.retainMaterialSamples({...input,targetData:broken}));
  }
  assert.throws(()=>fold.retainMaterialSamples({...input,targetData:new Float32Array(4)}));
});

test('A11 sheet sampling uses actual ink field and versioned seed deterministically',()=>{
  const sheetInput={...input,sampleCount:1024,inkField:computeInkField(pixels,48,48,{mode:'alpha'}),
    seed:296,carrierDensity:0.2,volume:{...DEFAULT_GLYPH_VOLUME,enabled:true,depth:16,jitter:0}};
  const first=fold.retainSheetCarrier(sheetInput),same=fold.retainSheetCarrier(sheetInput);
  assert.equal(first.preparationKey,same.preparationKey);assert.deepEqual(first.sampleIds,same.sampleIds);
  assert.notEqual(first.preparationKey,fold.retainSheetCarrier({...sheetInput,seed:297}).preparationKey);
});

const artifactPath=process.env.QL_MATERIAL_FOLD_FIXTURE;
const native=artifactPath?JSON.parse(await readFile(artifactPath,'utf8')):null;
const nativeOnly={skip:!native?'Unexecuted: actual M3State-produced QL_MATERIAL_FOLD_FIXTURE is required':false};
function actualPrepared(){
  const p=fold.admitNativeMaterialFold(native.plan,native.expected);
  const m=fold.retainMaterialSamples({...input,stageUnitsPerMaterialUnit:p.stage_units_per_material_unit,
    // Project actual sampler units into the declared material domain.
    targetData:Float32Array.from(targets,(v,i)=>i%4===3?v:v*p.stage_units_per_material_unit/200)});
  return fold.prepareFold(m,p);
}

test('A11 real native producer basis and full native symbolic receipt reach retained evaluator',nativeOnly,()=>{
  const prepared=actualPrepared(),ids=[...prepared.material.sampleIds];
  assert.deepEqual(prepared.plan.native_state,native.receipt.after);
  const actual=fold.evaluateFold(prepared,fold.nativeFoldControl(prepared.plan));
  assert.equal(actual.length,prepared.material.sampleCount*4);
  assert.deepEqual(prepared.material.sampleIds,ids);assert.ok(actual.every(Number.isFinite));
});

test('A11 true native source/prime/subject/pose and topology mutations are refused',nativeOnly,()=>{
  for(const mutate of [p=>p.subject_ref='wrong-subject',p=>p.source_coordinate.face=p.source_coordinate.face==='pratibimba'?'bimba':'pratibimba',
    p=>p.source_generation++,p=>p.registry_revision='foreign',p=>p.pose_axis=[0,0,0],
    p=>p.pose_angle_rad+=0.25,p=>p.crease_angles_rad[0]+=0.125]){
    const p=structuredClone(native.plan);mutate(p);assert.throws(()=>fold.admitNativeMaterialFold(p,native.expected));
  }
  for(const mutate of [p=>p.creases[0].axis_start[0]+=0.1,p=>p.creases[1].id=p.creases[0].id,
    p=>p.panels[2].parent=p.panels[3].id]){
    const p=structuredClone(native.plan);mutate(p);
    assert.throws(()=>fold.prepareFold(fold.retainMaterialSamples({...input,stageUnitsPerMaterialUnit:p.stage_units_per_material_unit}),
      fold.admitNativeMaterialFold(p,native.expected)));
  }
});

test('A11 actual native-plan rigid panels preserve depth/density/distances across signed folds',nativeOnly,()=>{
  const prepared=actualPrepared(),plan=prepared.plan;
  const rest=fold.evaluateFold(prepared,{sourceGeneration:plan.source_generation,creaseAnglesRad:[0,0,0],poseAxis:plan.pose_axis,poseAngleRad:0});
  const distances=(data,a,b)=>Math.hypot(...[0,1,2].map(i=>data[a*4+i]-data[b*4+i]));
  // Find two actual sampled points inside the same source panel.
  const groups=new Map();for(let i=0;i<prepared.material.sampleCount;i++){
    const u=rest[i*4]/plan.stage_units_per_material_unit;
    const panel=plan.panels.find(p=>u>p.bounds[0]+1e-5&&u<p.bounds[1]-1e-5);
    if(panel){const ids=groups.get(panel.id)??[];ids.push(i);groups.set(panel.id,ids);}
  }
  const pair=[...groups.values()].find(ids=>ids.length>=2);assert.ok(pair,'actual sampled panel needs at least two points');
  const [a,b]=pair,expected=distances(rest,a,b);
  for(let step=-24;step<=24;step++){
    const actual=fold.evaluateFold(prepared,{sourceGeneration:plan.source_generation,creaseAnglesRad:[step*Math.PI/24,-step*Math.PI/48,step*Math.PI/72],poseAxis:plan.pose_axis,poseAngleRad:step*Math.PI/48});
    assert.ok(Math.abs(distances(actual,a,b)-expected)<4e-5+expected*3e-7);
    for(let i=0;i<prepared.material.sampleCount;i++)assert.equal(actual[i*4+3],rest[i*4+3]);
  }
});

test('A11 body projection refuses a distinct Float32Array view aliasing commanded storage',nativeOnly,()=>{
  const prepared=actualPrepared(),p=prepared.plan;
  const binding={eventRef:p.event_ref,subjectRef:p.subject_ref,sourceGeneration:p.source_generation,
    sourceRevision:p.source_revision,sourceCoordinate:p.source_coordinate,preparationRef:'independent:analytic-body-binding',
    stateRef:'independent:analytic-body-state',bodyRevision:1,nodeIds:[0],metresPerMaterialUnit:p.metres_per_material_unit,
    sampleNodeWeights:Array.from({length:prepared.material.sampleCount},()=>[{nodeId:0,weight:1}])};
  const projection=fold.prepareBodyProjection(prepared,binding),commanded=fold.evaluateFold(prepared,fold.nativeFoldControl(p));
  // This is an alias fence test, not evidence of a physical owner observation.
  const numericInput={eventRef:p.event_ref,preparationRef:binding.preparationRef,stateRef:binding.stateRef,
    bodyRevision:1,sampleCursor:128,nodeIds:[0],displacementsMetres:[[0,0,0.001]]};
  assert.throws(()=>fold.applyBodyDisplacements(projection,commanded,numericInput,128,
    new Float32Array(commanded.buffer,commanded.byteOffset,commanded.length)),/separate|alias/);
});

function nativeRetained(){
  const p=fold.admitNativeMaterialFold(native.plan,native.expected),groups=new Map();
  for(const sample of native.samples){const group=groups.get(sample.layer_ref)??[];group.push(sample);groups.set(sample.layer_ref,group);}
  const layers=[...groups].map(([layerId,samples])=>{
    const [sourceRef,idLayer,allocationRef]=JSON.parse(samples[0].id);assert.equal(idLayer,layerId);
    const source={reference:sourceRef,revision:samples[0].source_revision,kind:'ascii'};
    const data=Float32Array.from(samples.flatMap(s=>[...s.rest_material.map(v=>v*p.stage_units_per_material_unit),s.density]));
    const m=fold.retainMaterialSamples({source,allocationRef,layerId,treatment:p.material_treatment,
      samplingSignature:'actual-native-fixture:'+layerId,stageUnitsPerMaterialUnit:p.stage_units_per_material_unit,targetData:data,sampleCount:samples.length});
    assert.deepEqual(m.sampleIds,samples.map(s=>s.id));return m;
  });
  const material=fold.retainLayeredMaterial({source:layers[0].source,allocationRef:'independent:actual-native-layered',bodyRef:'independent:actual-native-material',layers});
  assert.deepEqual(material.sampleIds,native.samples.map(s=>s.id));
  return {p,material};
}

test('A11 actual Rust and existing TS retained fold evaluators agree at every source/layer sample',nativeOnly,()=>{
  const {p,material}=nativeRetained(),prepared=fold.prepareFold(material,p),actual=fold.evaluateFold(prepared,fold.nativeFoldControl(p));
  assert.equal(native.native_targets.length,material.sampleCount);
  for(let i=0;i<material.sampleCount;i++){
    const expected=native.native_targets[i];assert.equal(expected.id,material.sampleIds[i]);
    for(let axis=0;axis<3;axis++)assert.ok(Math.abs(actual[4*i+axis]-expected.local_stage[axis])<2e-5+Math.abs(expected.local_stage[axis])*2e-7);
    assert.ok(Math.abs(actual[4*i+3]-expected.density)<1e-7);
  }
});

test('A11/A12 body material joins the independently prepared real performance body and source recipe',nativeOnly,()=>{
  const {p,material}=nativeRetained(),body=native.performance.physical_body,recipe=native.performance.source_form_recipe;
  assert.deepEqual(native.body_material.body,body);assert.deepEqual(native.body_material.body_recipe,recipe);
  const prepared=fold.prepareNativeBodyMaterial(material,p,native.body_material,body,recipe);
  assert.equal(prepared.material.sampleCount,native.samples.length);assert.deepEqual(prepared.material.sampleIds,native.samples.map(s=>s.id));
  for(const mutate of [x=>x.samples[0].sample.id='wrong-sample',x=>x.samples[0].sample.source_revision='wrong-source',
    x=>x.samples[0].node_weights[0].weight+=0.01,x=>x.samples[0].node_weights[0].ds+=0.01,
    x=>x.samples[0].normal[0]+=0.01,x=>x.samples[0].local_stage[0]+=1,
    x=>x.body_recipe.frame_side_metres*=1.01,x=>x.body.source_coordinate.face=x.body.source_coordinate.face==='pratibimba'?'bimba':'pratibimba']){
    const bad=structuredClone(native.body_material);mutate(bad);
    assert.throws(()=>fold.prepareNativeBodyMaterial(material,p,bad,body,recipe));
  }
});

const observationsPath=process.env.QL_MATERIAL_PHYSICAL_FIXTURE??process.env.QL_MATERIAL_BODY_OBSERVATIONS;
const observed=observationsPath?JSON.parse(await readFile(observationsPath,'utf8')):null;
const realBodyOnly={skip:!native||!observed?'Unexecuted: actual native producer AND same PhysicalBody observation artifact required':false};

test('A11/A12 actual physical node snapshots move retained visible material on the same metric body',realBodyOnly,()=>{
  assert.equal(observed.schema,'ql.m3-material-observation-fixture/v1');
  assert.deepEqual(observed.snapshots.map(s=>String(s.samples_elapsed)),['0','128','256','4096','96000']);
  const {p,material}=nativeRetained(),prepared=fold.prepareNativeBodyMaterial(material,p,native.body_material,
    native.performance.physical_body,native.performance.source_form_recipe);
  const rest=fold.evaluateNativeBodyMaterial(prepared,observed.snapshots[0],'0');
  for(let i=0;i<material.sampleCount;i++)for(let axis=0;axis<3;axis++){
    const expected=native.body_material.samples[i].local_stage[axis];
    assert.ok(Math.abs(rest[4*i+axis]-expected)<2e-5+Math.abs(expected)*2e-7);
  }
  let moved=false;
  for(const snapshot of observed.snapshots.slice(1)){
    const actual=fold.evaluateNativeBodyMaterial(prepared,snapshot,snapshot.samples_elapsed),repeat=fold.evaluateNativeBodyMaterial(prepared,snapshot,snapshot.samples_elapsed);
    assert.deepEqual(actual,repeat);assert.deepEqual(material.sampleIds,native.samples.map(s=>s.id));
    for(let i=0;i<material.sampleCount;i++){
      assert.ok(Math.abs(actual[4*i+3]-native.samples[i].density)<1e-7);
      for(let axis=0;axis<3;axis++)moved ||= actual[4*i+axis]!==rest[4*i+axis];
    }
  }
  assert.ok(moved,'native acknowledgement without actual visible constituent motion must fail');
});

test('A05/A12 wrong physical subject, source, prime, cursor or node identity refuses without partial material change',realBodyOnly,()=>{
  const {p,material}=nativeRetained(),prepared=fold.prepareNativeBodyMaterial(material,p,native.body_material,
    native.performance.physical_body,native.performance.source_form_recipe),snapshot=observed.snapshots[1];
  for(const mutate of [x=>x.subject_ref='wrong-subject',x=>x.pratibimba=!x.pratibimba,
    x=>x.source_generation++,x=>x.source_revision='wrong-source',x=>x.samples_elapsed='00128',
    x=>x.node_identity[11]=999,x=>x.visible_positions_metres[11][2]+=100]){
    const bad=structuredClone(snapshot);mutate(bad);const target=new Float32Array(material.sampleCount*4).fill(17),before=target.slice();
    assert.throws(()=>fold.evaluateNativeBodyMaterial(prepared,bad,snapshot.samples_elapsed,target));
    assert.deepEqual(target,before,'refused physical observation must not partially replace continuing targets');
  }
});

test('A12 actual native force, pickup and captured WAV share finite nonzero PCM',realBodyOnly,async()=>{
  const m=observed.measurements;assert.equal(m.sample_rate,48000);assert.equal(m.frames,96000);
  assert.ok(m.max_visible_error_metres<1e-12);assert.ok(m.max_pickup_error_linear<1e-6);
  assert.equal(observed.force_pickup_output_prefix.length,256);
  const bytes=await readFile(process.env.QL_MATERIAL_CAPTURED_WAV??observed.audio_path);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
  assert.equal(bytes.readUInt16LE(20),3);assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),48000);
  assert.equal(bytes.readUInt16LE(34),32);assert.equal(bytes.toString('ascii',36,40),'data');assert.equal(bytes.readUInt32LE(40),m.frames*4);
  let sum=0,peak=0,nonzero=0;
  for(let i=0;i<m.frames;i++){
    const pcm=bytes.readFloatLE(44+4*i);assert.ok(Number.isFinite(pcm));sum+=pcm*pcm;peak=Math.max(peak,Math.abs(pcm));nonzero+=pcm!==0;
    if(i<256){const [force,pickup,captured]=observed.force_pickup_output_prefix[i];
      assert.ok(Number.isFinite(force)&&Number.isFinite(pickup));assert.equal(pcm,Math.fround(captured));}
  }
  assert.ok(peak>0&&nonzero>0&&m.max_force_newtons>0);assert.equal(nonzero,m.nonzero_output_samples);
  assert.ok(Math.abs(peak-m.pcm_peak)<1e-12);assert.ok(Math.abs(Math.sqrt(sum/m.frames)-m.pcm_rms)<1e-12);
  assert.equal(observed.applied_occurrences.length,2);assert.ok(observed.applied_occurrences.every(x=>x.applied));
});
