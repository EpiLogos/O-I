/** Original production app/relay/one current native Scene owner. All values
 * below are actual captured native replies, never substitute owner responses.
 * No installed/hardware/audio/H claim comes from this browser proof. */
import assert from 'node:assert/strict';
const STANDING='declared-material-policy: no source table fixes presentation scale, damping, strike amplitude or output gain (QL-MEF #135)';
const copy=value=>structuredClone(value);
const policy=material=>({schema:'oi.epi-current-material-policy/v1',material:copy(material),standing:STANDING});
const norm=value=>Math.hypot(value[0],value[1]);
const cursor=value=>{assert.match(value,/^(0|[1-9][0-9]*)$/);return BigInt(value);};
const fieldInvariant=['event_ref','subject_ref','registry_revision','geometry_ref','material_ref','model_ref','shape_ref','sample_rate','samples_elapsed','clock','amplitudes_metres','targets','standing'];
const hostRequest=row=>row.request?.request?.request;
async function witness(predicate){const end=Date.now()+20000;for(;;){if(predicate())return;if(Date.now()>=end)throw Error('The real native response witness did not complete.');await new Promise(resolve=>setTimeout(resolve,10));}}

/** The parent driver retains every real field reply/request through its normal
 * network witness. Operations remain ordinary controls; no direct fake/stub
 * port, renderer input override, numerical native request or new process. */
export async function runSceneDampingGate({frame,worldA,snapshot,action,sceneNavigate,exposeNativePanel,nativeFrames,nativeInspections,nativeDocument,savedFile,artifact,check}) {
 assert.ok(worldA.working.file?.location?.path,'The original completed A encounter supplies the ordinary same-file route');
 assert.equal(await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),worldA.working.file.location.path),true);
 await frame.waitForFunction(person=>window.__FIELD_STUDIES__.epiWorld()?.person_ref===person&&!window.__FIELD_STUDIES__.nativeWorking()?.pending,worldA.record.person_ref,{timeout:90000});
 const before=await snapshot('d30-before'),record=before.record;
 assert.ok(record?.world?.binding?.host?.material,'Exact admitted opening material is required');
 const original=copy(record.world.binding.host.material),cosmic=record.receiving.scene_ref;
 const constructor=record.world.basis.input;
 assert.deepEqual(constructor.m3.stamp.identity,constructor.m2.stamp.identity,'The original WorldRequest gives M2 and M3 one EventIdentity');
 const members=copy((await nativeDocument(record.world.instance_ref)).scenes.map(scene=>({scene_ref:scene.scene_ref,entity_refs:scene.entity_refs})));
 await sceneNavigate(cosmic);await action('step');await action('reset');await exposeNativePanel();
 const panel=frame.locator('.native-field-panel');
 await panel.locator('[data-ni="hold"]').click();
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='held');
 const trials=[];
 for(const damping of [0,2]) {
  // A deliberate Strike sets the same excitation precondition for each trial.
  // Damping itself must preserve whatever amplitudes that native Strike left.
  await panel.locator('[data-ni="strike"]').click();
  await frame.waitForFunction(()=>document.querySelector('.native-field-panel')?.getAttribute('aria-busy')==='false');
  const start=await snapshot('d30-pre-admission-'+damping);
  const lease=start.native.lease,first=nativeFrames.length;
  // Predict the coherent stamp successor BEFORE the damping request. A prior
  // acknowledged Strike may already have advanced that shared identity. M1's
  // EngineConfig revision is separate, and all clocks/form stay exact below.
  const priorInfluence=start.native.instrument.influence;
  const priorProfile=priorInfluence.native_readback.profile_generation;
  assert.ok(Number.isSafeInteger(priorProfile)&&priorProfile>=0&&priorProfile<Number.MAX_SAFE_INTEGER);
  assert.equal(priorInfluence.m3_generation,priorProfile);
  const expectedProfileGeneration=priorProfile+1;
  const details=frame.locator('.epi-play');if(!await details.evaluate(e=>e.open))await details.locator('summary').click();
  await frame.locator('[data-epi-damping]').fill(String(damping));await action('set-damping');
  const changed=await snapshot('d30-admitted-'+damping,true);
  assert.equal(changed.native.lease,lease,'Damping admission retains the exact Scene lease');
  assert.equal(changed.native.status,'held','A held owner remains held');
  await witness(()=>nativeFrames.slice(first).some(row=>row.lease===lease&&hostRequest(row)?.command?.operation==='set-damping'));
  const admitted=nativeFrames.slice(first).filter(row=>row.lease===lease&&hostRequest(row)?.command?.operation==='set-damping');
  assert.equal(admitted.length,1,'Exactly one actual damping operation, no retry');
  const acknowledgement=admitted[0],request=hostRequest(acknowledgement),field=acknowledgement.field;
  assert.deepEqual(request.command,{operation:'set-damping',per_second:damping});
  const previous=nativeFrames.slice(0,first).filter(row=>row.lease===lease&&row.field.generation===request.expected_generation&&row.field.samples_elapsed===request.expected_samples_elapsed).at(-1);
  assert.ok(previous,'Actual preceding native field at the request cursor is required');
  for(const key of fieldInvariant)assert.deepEqual(field[key],previous.field[key],'Damping zero-elapsed native invariant '+key);
  assert.equal(cursor(field.generation),cursor(previous.field.generation)+1n);
  assert.deepEqual(field.audio,[]);
  const influence=changed.native.instrument.influence;
  assert.equal(influence.material.damping_per_second,damping);assert.equal(influence.material_standing,STANDING);
  for(const key of ['strike_metres','audio_gain_per_metre','strike_on_event'])assert.equal(influence.material[key],original[key]);
  assert.equal(influence.voices.length,9);
  assert.equal(field.m2_identity.profile_generation,expectedProfileGeneration);
  assert.equal(influence.m3_generation,expectedProfileGeneration);
  assert.equal(influence.native_readback.profile_generation,expectedProfileGeneration);
  assert.equal(influence.native_readback.m3_generation,expectedProfileGeneration);
  await witness(()=>nativeInspections.some(row=>row.lease===lease&&row.field.generation===field.generation&&row.field.samples_elapsed===field.samples_elapsed));
  const source=nativeInspections.filter(row=>row.lease===lease&&row.field.generation===field.generation&&row.field.samples_elapsed===field.samples_elapsed).at(-1);
  assert.ok(source,'Actual current native Inspect at the damping admission cursor is required');
  const modes=source.sources.current.m2.resonator.modes;assert.equal(modes.length,9);
  for(let i=0;i<9;i++){assert.deepEqual(modes[i].excitation,[0,0],'Zero continuous forcing is an independently checked decay precondition');assert.equal(modes[i].damping_per_second,damping);assert.equal(modes[i].frequency_hz,influence.voices[i].frequency_hz);}
  for(const key of ['event_ref','subject_ref','m1_revision','shape_ref','address72','voices','geometry'])assert.deepEqual(influence[key],start.native.instrument.influence[key],'Native policy-only influence invariant '+key);
  for(const key of ['m1_clock','m1_carrier','m3_clock','selected_aperture','form','continuous_clock','continuation_start'])assert.deepEqual(influence.native_readback[key],start.native.instrument.influence.native_readback[key],'Native policy-only clock/form invariant '+key);
  assert.deepEqual(changed.record.world,record.world,'The dated opening material remains byte-value exact');
  // Resume only the continuous owner. No M1 tick, other determinant or shader
  // damping is used to supply a false decay pass.
  await panel.locator('[data-ni="resume"]').click();
  await frame.waitForFunction(start=>BigInt(window.__FIELD_STUDIES__.native()?.native?.presented?.samples_elapsed??'0')>=BigInt(start)+8192n,field.samples_elapsed,{timeout:30000});
  await panel.locator('[data-ni="hold"]').click();
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='held');
  const received=await snapshot('d30-received-'+damping,true);
  const targets=await frame.evaluate(()=>{const t=window.__FIELD_STUDIES__.nativeTargets();return t?{native:t.native,scale:t.presentation_units_per_metre,target_a:Array.from(t.target_a),target_b:Array.from(t.target_b),admitted_a:Array.from(t.admitted_a)}:null;});
  assert.ok(targets?.native,'The current damping field reached the actual native projection');
  await witness(()=>nativeFrames.some(row=>row.lease===lease&&['event_ref','subject_ref','generation','samples_elapsed','clock','m2_identity'].every(key=>JSON.stringify(row.field[key])===JSON.stringify(targets.native[key]))));
  const final=nativeFrames.filter(row=>row.lease===lease&&['event_ref','subject_ref','generation','samples_elapsed','clock','m2_identity'].every(key=>JSON.stringify(row.field[key])===JSON.stringify(targets.native[key]))).at(-1);
  assert.ok(final,'The projected cursor must equal an actual captured native frame');
  const n=Number(cursor(final.field.samples_elapsed)-cursor(field.samples_elapsed));assert.ok(n>=8192&&n<=1_000_000);
  assert.equal(final.field.generation,field.generation,'No intervening determinant admission');
  const frames=nativeFrames.slice(first).filter(row=>row.lease===lease&&cursor(row.field.samples_elapsed)>cursor(field.samples_elapsed)&&cursor(row.field.samples_elapsed)<=cursor(final.field.samples_elapsed));
  assert.ok(frames.length>0);assert.ok(frames.every(row=>hostRequest(row)?.command?.operation==='advance'||hostRequest(row)?.command?.operation==='read'),'Only continuous advancement and read may intervene');
  const fs=field.sample_rate,decay=Math.exp(-damping*n/fs),roundoff=64*n*Number.EPSILON;
  assert.equal(field.amplitudes_metres.length,9);assert.equal(final.field.amplitudes_metres.length,9);
  for(let i=0;i<9;i++) {
   const z0=field.amplitudes_metres[i],z1=final.field.amplitudes_metres[i],a0=norm(z0),a1=norm(z1);
   assert.ok(a0>0&&a1>0,'Positive resident native excitation is required for every mode');
   assert.ok(Math.abs(a1/a0-decay)<=roundoff,'Independently predicted native decay for mode '+i);
  }
  const torus=received.rendered.partitions.find(part=>part.entityId===record.receiving.torus.entity_ref);assert.ok(torus&&torus.end-torus.start>=4096);
  assert.equal(final.field.targets.length,4096);const mapped=new Set();
  for(let slot=torus.start;slot<torus.end;slot++) {
   const sample=Math.floor((slot-torus.start)*4096/(torus.end-torus.start));mapped.add(sample);
   assert.equal(final.field.targets[sample].identity,sample);
   for(let axis=0;axis<3;axis++) {
    const value=Math.fround(final.field.targets[sample].position[axis]),offset=slot*4+axis;
    assert.equal(targets.admitted_a[offset],value,'Current native damping sample admitted into torus slot');
    assert.equal(targets.target_a[offset],Math.fround(value*targets.scale));assert.equal(targets.target_b[offset],targets.target_a[offset]);
   }
  }
  assert.equal(mapped.size,4096);
  let movement=0;for(let slot=torus.start;slot<torus.end;slot++)for(let axis=0;axis<3;axis++)movement=Math.max(movement,Math.abs(received.rendered.positions[slot*4+axis]-changed.rendered.positions[slot*4+axis]));
  assert.ok(movement>1e-7,'The actual resident torus consumes native targets through shader stepping');
  if(damping>0)assert.notDeepEqual(final.field.targets,field.targets,'Positive damping plus native evolution changes the actual target field');
  trials.push({damping,lease,expected_profile_generation:expectedProfileGeneration,prior_profile_generation:priorProfile,request:acknowledgement.request,admission:field,actual_current_sources:source.sources,received:final.field,elapsed_samples:n,expected_decay:decay,binary64_roundoff_bound:roundoff,all_nine_modes:true,all_4096_samples:true,resident_torus_max_move:movement});
 }
 check(true,'D30 ordinary damping has independently predicted nine-mode native decay, exact no-reset admission and complete current torus receiving at zero and positive damping');
 // Same nine-driver personal positive/live-zero proofs already ran unchanged.
 // They keep damping fixed; this independent policy proof cannot replace them.
 const personal=members.filter(scene=>scene.entity_refs.includes(record.receiving.personal.locus_entity_ref));assert.equal(personal.length,1);assert.equal(personal[0].scene_ref,record.world.instance_ref+':scene:personal');
 await sceneNavigate(personal[0].scene_ref);
 await frame.locator('[data-epi-body]').selectOption(record.receiving.personal.locus_entity_ref);
 await frame.waitForFunction(ref=>window.__FIELD_STUDIES__.getState().selected.includes(ref),record.receiving.personal.locus_entity_ref);
 await action('save');const saved=await snapshot('d30-saved-current-material');
 const doc=await nativeDocument(record.world.instance_ref),carrier=doc.scenes.find(scene=>scene.scene_ref===cosmic).presentation.scene.epiWorld;
 assert.deepEqual(carrier.current_material_policy,policy({...original,damping_per_second:2}));
 assert.deepEqual(carrier.world,record.world);assert.deepEqual(doc.scenes.map(scene=>({scene_ref:scene.scene_ref,entity_refs:scene.entity_refs})),members);
 assert.ok(!saved.working.pending&&!saved.working.failed);assert.ok(saved.working.file);assert.equal(saved.working.revision,doc.revision);
 const acknowledgedFile=await savedFile(saved.working,'d30-current-material');
 assert.deepEqual(acknowledgedFile,doc,'Actual saved-file decode must equal the independently inspected current complete Document');
 assert.equal(await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),saved.working.file.location.path),true);
 await frame.waitForFunction(person=>window.__FIELD_STUDIES__.epiWorld()?.person_ref===person&&!window.__FIELD_STUDIES__.nativeWorking()?.pending,record.person_ref);
 const reopened=await snapshot('d30-reopened-current-material');
 assert.deepEqual(reopened.record.current_material_policy,carrier.current_material_policy);assert.deepEqual(reopened.record.continuation_start,carrier.continuation_start);
 assert.deepEqual(reopened.record.world,record.world);
 await action('step');const continued=await snapshot('d30-continued-current-material');
 assert.equal(continued.native.instrument.influence.material.damping_per_second,2,'Ordinary continuation constructor consumes saved damping');
 await action('reset');const returned=await snapshot('d30-returned-original-material');
 assert.equal(returned.record.current_material_policy,undefined);assert.deepEqual(returned.native.instrument.influence.material,original);
 assert.deepEqual(returned.record.world,record.world);
 const result={schema:'oi.epi-scene-damping-native-proof/v1',passed:true,trials,saved_file_artifact:'d30-current-material-file.json',saved_acknowledgement:{document:doc,working:saved.working,file_read:acknowledgedFile,policy:carrier.current_material_policy,person_ref:record.person_ref,event_ref:record.world.event_ref,instance_ref:record.world.instance_ref},same_process_reopen:true,return_restores_original:true,separate_process_restart:'required-pending-outer-owned-kernel-restart',scope:'Actual source-built browser/native owner receiving. No managed Mac, physical audio or H claim.'};
 artifact('d30-native-receiving-proof.json',result);
 check(true,'D30 ordinary native Save/file reopen preserves acknowledged material, person, occasion and scenes; Return restores original material');
 return result;
}
